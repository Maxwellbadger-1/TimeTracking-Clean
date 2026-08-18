# Debug-Session: Urlaubstage bei Ablehnung genehmigter Anträge verloren

**Status:** DIAGNOSTIZIERT (kein Fix angewendet — Live-DB unangetastet)
**Datum:** 2026-08-18
**Auslöser:** Carmen Rothemund, Urlaubsantrag #61 (24.08.–03.09.2026, 6 Tage), abgelehnt mit "Änderung" — Tage nicht gutgeschrieben.
**Live-DB:** `/home/ubuntu/databases/production.db` (nur lesende Kopie unter `/tmp/dbg/ro.db` analysiert)

---

## Root Cause

`server/src/services/absenceService.ts` → `rejectAbsenceRequest()` (Zeile 917–1046)

Beim Ablehnen eines **bereits genehmigten** Antrags wird ausschließlich `updateMonthlyOvertime()`
aufgerufen. Der Gegenbuchungspfad `revertBalancesAfterDeletion()` / `updateVacationTaken(..., -days)`
fehlt vollständig.

```ts
if (request.type === 'vacation' && !wasApproved) {   // Z. 976
  decrementVacationPending(...)                       // = No-Op (Z. 1391)
}
if (wasApproved) {                                    // Z. 984
  // NUR Überstunden-Recalc — KEIN revertBalancesAfterDeletion()!
}
```

Zum Vergleich: `deleteAbsenceRequest()` (Z. 1059) macht es korrekt —
`if (request.status === 'approved') revertBalancesAfterDeletion(id)`.

**Folge:** `vacation_balance.taken` bleibt um `days` zu hoch. Da `remaining` eine
GENERATED-Spalte (`entitlement + carryover - taken`) ist, sinkt der Resturlaub dauerhaft.
Es existiert kein Kompensationspfad — auch späteres Löschen des Antrags heilt es nicht
(Status ist dann `rejected`, nicht `approved` → beide Zweige greifen nicht).

### Beleg Carmen Rothemund (userId 17)

audit_log: `create@2026-05-18 07:38:45 → approve@2026-05-22 08:00:45 → reject@2026-08-18 08:28:50`

| | |
|---|---|
| `vacation_balance` 2026 | entitlement 20, carryover 0, **taken 21**, remaining **-1** |
| Summe genehmigter Urlaubstage 2026 | **15** |
| Differenz | **+6** = exakt Antrag #61 |

Korrekt wäre `taken = 15`, `remaining = 5`.

---

## Betroffene Datensätze (Live-DB, Vollprüfung)

Kriterium: `absence_requests.status='rejected'` **und** audit_log enthält vorher `approve`.

| Antrag | User | Typ | Tage | Zeitraum | Verlust |
|---|---|---|---|---|---|
| #27 | Benedikt Jochem (16) | vacation | 5 | 01.–08.05.2026 | 5 Urlaubstage |
| #44 | Benedikt Jochem (16) | vacation | 5 | 07.–14.05.2026 | 5 Urlaubstage |
| #61 | Carmen Rothemund (17) | vacation | 6 | 24.08.–03.09.2026 | 6 Urlaubstage |
| #67 | Benedikt Jochem (16) | overtime_comp | 2 | 13.–16.08.2026 | s. Bug 3 |
| #57 | Carmen Rothemund (17) | unpaid | 1 | 14.04.2026 | kein Urlaubskonto-Effekt |
| #41, #42 | Test Test (15) | vacation | 3+3 | — | Testnutzer |
| #53 | Test Test (28) | overtime_comp | 1 | — | Testnutzer |

**Soll/Ist-Abgleich `vacation_balance.taken` (alle Nutzer, alle Jahre):**

| User | Jahr | taken (ist) | taken (soll) | Diff |
|---|---|---|---|---|
| Benedikt Jochem (16) | 2026 | 23 | 13 | **+10** |
| Carmen Rothemund (17) | 2026 | 21 | 15 | **+6** |
| Test Test (15) | 2026 | 6 | 0 | +6 (Testnutzer) |

Alle übrigen 33 Konten: Diff 0.

---

## Weitere Fehler in derselben Richtung

### Bug 2 — Doppelbuchung bei Wieder-Genehmigung (latent, noch nicht eingetreten)

`approveAbsenceRequest()` erlaubt seit "PHASE 2 FIX" (Z. 763) `rejected → approved`
und ruft dabei erneut `updateBalancesAfterApproval()` → `updateVacationTaken(+days)`.
Da die Ablehnung nicht gegengebucht hat, ergibt der Zyklus
`pending → approved → rejected → approved` **taken = 2 × days**.
Aktuell in der Live-DB nicht eingetreten (kein Antrag hat zwei `approve`-Events).

### Bug 3 — Überstunden-Ausgleich wird nie vom Konto abgebucht

`recordOvertimeCompensation()` schreibt eine Transaktion `type='compensation'`
(`overtimeTransactionService.ts:114–138`).
`overtimeTransactionRebuildService.ts:97–102` löscht beim Monats-Rebuild
**alle** Transaktionen des Monats ohne Typfilter und erzeugt `compensation` nicht neu.

Live-DB: **0 Transaktionen vom Typ `compensation`** bei 3 genehmigten `overtime_comp`-Anträgen —
die Gutschriften (`overtime_comp_credit`, 2 Stück) sind dagegen vorhanden.
**Folge:** Mitarbeiter erhalten den Ausgleichstag frei *und* behalten die Überstunden.

### Bug 4 — `deductOvertimeHours()` verpufft

`updateBalancesAfterApproval()` ruft bei `overtime_comp` `deductOvertimeHours()`, das
`overtime_balance.actualHours` reduziert. Das direkt danach laufende `updateMonthlyOvertime()`
berechnet `actualHours` neu und überschreibt den Abzug. Toter Code mit irreführender Semantik.

### Bug 5 — Zeiteinträge werden bei Ablehnung nicht wiederhergestellt

`approveAbsenceRequest()` löscht per `deleteTimeEntriesDuringAbsence()` (STRICT MODE)
alle Zeiteinträge im Abwesenheitszeitraum. `rejectAbsenceRequest()` stellt sie nicht wieder her.
In der Live-DB aktuell kein Schaden (die betroffenen Zeiträume enthielten keine Einträge),
aber der Datenverlustpfad ist offen.

### Bug 6 — Jahresübergreifende Anträge buchen aufs falsche Jahr

`updateBalancesAfterApproval()` / `revertBalancesAfterDeletion()` verwenden durchgängig
`year = parseInt(request.startDate.substring(0,4))`. Ein Urlaub 28.12. – 05.01. bucht
alle Tage auf das Startjahr. Live-DB: aktuell **0** jahresübergreifende Anträge.

### Bug 7 — Keine Transaktionsklammer

`rejectAbsenceRequest()`/`approveAbsenceRequest()` laufen ohne DB-Transaktion. Das
Status-UPDATE ist bereits committet, wenn ein späterer Schritt wirft → inkonsistenter Zustand.

### Bug 8 — `pending` wird nirgends geführt / Migration 003 als angewendet markiert, aber wirkungslos

`incrementVacationPending()` / `decrementVacationPending()` sind seit einem früheren Fix
No-Ops. Das Frontend (`EmployeeDashboard.tsx:158–162`) liest jedoch `vacationBalance.pending`
und zeigt "X beantragt" — der Wert ist immer 0/undefined.

**Strukturelle Ursache:** `003_add_pending_to_vacation_balance` steht in der Live-Tabelle
`migrations` als angewendet (`2026-02-07 21:20:25`), die Live-Tabelle `vacation_balance`
hat aber **keine `pending`-Spalte** (nur id, userId, year, entitlement, carryover, taken,
remaining). Die Migration hat nicht durchgegriffen bzw. die Tabelle wurde danach ohne die
Spalte neu erzeugt — und läuft nie wieder an, weil sie als erledigt gilt.

### Bug 9 — Änderung von `vacationDaysPerYear` überschreibt `entitlement` rückwirkend für ALLE Jahre

`userService.ts:349` → `updateVacationEntitlementForUser()` setzt bei jeder Änderung von
`vacationDaysPerYear` das `entitlement` **aller** `vacation_balance`-Einträge auf den neuen Wert —
auch für abgeschlossene Vorjahre. Zwei Konsequenzen:

1. **Historie wird verfälscht.** Belegt: Christine Glas wurde am 02.02.2026 von 12 auf 13 Tage
   gesetzt (audit_log #240); ihr `entitlement` **2025** steht seither ebenfalls auf 13.
   Gleiches Muster bei Silvia Lachner (18 → 19, audit_log #186).
2. **Pro-rata-Berechnung wird zerstört.** `bulkInitializeVacationBalances()` berechnet für
   unterjährige Eintritte anteilig (z. B. Reinhold Merl 2026 = 25,5). Ein späterer Nutzer-Edit
   überschreibt das mit dem vollen Jahreswert.

Der `carryover` der Folgejahre wird dabei nicht neu berechnet — die Jahreskette bleibt inkonsistent.

### Bug 10 — Latenter Totalverlust bei 6 Konten (`vacationDaysPerYear = 0`)

Sechs Nutzer haben `users.vacationDaysPerYear = 0`, ihre Urlaubskonten führen aber einen
Anspruch: Hans Schauer, Maria Schauer, Beate Walleiter, Sepp Wasensteiner,
Christina Wasensteiner (je 30 Tage in 2026 und 2027) sowie Reinhold Merl (25,5 / 30).
Bei Hans und Maria Schauer wurde `vacationDaysPerYear` am 24.07.2026 auf 0 gesetzt
(audit_log #871/#872), ohne dass `entitlement` mitgezogen wurde.

**Risiko:** Der nächste beliebige Nutzer-Edit an einem dieser Datensätze löst Bug 9 aus und
setzt `entitlement` aller Jahre auf 0 — der komplette Urlaubsanspruch dieser sechs Konten
verschwindet in einem Schritt. Vor Fix von Bug 9 sollte geklärt werden, welcher Wert
(0 oder 30/25,5) der fachlich richtige ist.

---

## Nachvollziehbarkeit der Urlaubstransaktionen — Ist-Zustand

**Es gibt keine.** `vacation_balance` speichert nur den Aggregatwert `taken`; eine
Journal-Tabelle analog zu `overtime_transactions` existiert für Urlaub nicht.

| Rolle | Verfügbar | Fehlt |
|---|---|---|
| Mitarbeiter | Resturlaub-Kachel (`EmployeeDashboard.tsx:149–162`), eigene Antragsliste mit Status (`AbsencesPage.tsx`) | Kein Konto-Verlauf; Zusammenhang Antrag → Saldo-Änderung nicht sichtbar |
| Admin | `VacationBalanceManagementPage.tsx` — Tabelle entitlement/carryover/taken/remaining + manuelles Editieren; Antragsliste mit Filtern | Kein Buchungsjournal, keine Historie, keine Anzeige *wer wann warum* `taken` verändert hat |

Asymmetrie: Für **Überstunden** existiert ein vollständiges Journal
(`overtime_transactions` + `components/worktime/OvertimeTransactions.tsx`, eingebunden in
`ReportsPage.tsx:346`). Für **Urlaub** gibt es das Äquivalent nicht.

Die einzige belastbare Historie ist `audit_log` (entity `absence_request`, changes
`{"action":"approve"|"reject"}`) — vollständig und auswertbar, aber **im Frontend
nirgends sichtbar** und es existiert keine API-Route dafür.

---

## Empfohlene nächste Schritte (nicht ausgeführt)

1. **Backup der Live-DB** vor jedem Eingriff.
2. **Datenkorrektur** — Carmen +6, Benedikt +10 Urlaubstage (`taken` reduzieren), idealerweise
   als nachvollziehbare Korrekturbuchung statt stillem UPDATE.
3. **Code-Fix Bug 1**: in `rejectAbsenceRequest()` bei `wasApproved` `revertBalancesAfterDeletion(id)`
   aufrufen — behebt zugleich Bug 2.
4. **Bug 10 vorziehen** (fachliche Klärung): Soll-Anspruch der sechs Konten mit
   `vacationDaysPerYear = 0` festlegen, *bevor* Bug 9 gefixt wird — sonst droht Totalverlust.
5. **Bug 9**: `entitlement` nur für das laufende und künftige Jahre anpassen, Vorjahre und
   Pro-rata-Werte unangetastet lassen.
6. **Bug 3** separat: `compensation` im Rebuild erhalten oder neu erzeugen.
7. **Transaktionsklammer** (Bug 7) um approve/reject legen.
8. **Bug 8**: Migration 003 aus `migrations` entfernen und erneut laufen lassen, oder
   `pending` aus dem Frontend nehmen — aktuell zeigt die UI ein Feld, das es nicht gibt.
9. **Urlaubs-Journal** einführen (`vacation_transactions`) — schafft die fehlende
   Nachvollziehbarkeit *und* macht solche Bugs künftig sofort sichtbar.
