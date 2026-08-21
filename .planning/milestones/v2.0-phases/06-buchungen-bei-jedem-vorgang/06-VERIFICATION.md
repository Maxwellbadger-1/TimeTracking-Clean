---
phase: 06-buchungen-bei-jedem-vorgang
verified: 2026-08-21T21:10:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/14
  gaps_closed:
    - "Journal-Saldo und vacation_balance stimmen nach jedem Vorgang überein (Gap 1 / CR-02)"
    - "Jahreswechsel bucht Anspruch und Übertrag des neuen Jahres (Gap 2 / CR-03)"
    - "REQ-15: Tests decken jahresübergreifenden Antrag ab (Gap 3)"
  gaps_remaining: []
  regressions: []
gaps: []
---

# Phase 06: Buchungen bei jedem Vorgang Verification Report (Re-Verification nach Lückenschluss)

**Phase Goal:** Jede Bewegung auf dem Urlaubskonto erzeugt ab jetzt eine Buchungszeile.
**Verified:** 2026-08-21T21:10:00Z
**Status:** passed
**Re-verification:** Yes — nach Lückenschluss (Pläne 06-04 bis 06-07)

## Zusammenfassung

Diese Re-Verifikation prüft ausschließlich, ob die drei in der ursprünglichen `06-VERIFICATION.md`
(2026-08-19) dokumentierten Lücken tatsächlich gegen den aktuellen Code geschlossen sind — nicht
gegen die Behauptungen der SUMMARY-Dateien. Alle drei Lücken sind geschlossen. Zusätzlich wurden
die vier vom Auftrag geforderten kritischen Nachfragen (Pro-rata-Berechnung inkl. `hireDate`,
sechste Übertragsstelle, zweiter Übertragswert im Auto-Init-Pfad, echte Testabdeckung statt bloßer
Dokumentation) einzeln gegen den Code verifiziert.

## Goal Achievement

### Observable Truths (alle 14 aus der Erstverifikation)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pending → approved → rejected` erzeugt zwei Buchungen, Saldo unverändert | ✓ VERIFIED | Unverändert seit Erstverifikation; `absenceVacationBooking.test.ts` Test 2, erneut grün im eigenen Testlauf |
| 2 | `pending → approved → rejected → approved` erzeugt drei Buchungen | ✓ VERIFIED | Test 3, grün |
| 3 | Nutzeranlage mit 0 Urlaubstagen bucht 0, nicht 30 | ✓ VERIFIED | `vacationEntitlementBooking.test.ts` Test 2, grün |
| 4 | Admin-Korrektur ohne Begründung wird abgelehnt | ✓ VERIFIED | `vacationCorrectionBooking.test.ts` Test 5, grün |
| 5 | Alle Tests grün (bekannte, umgebungsbedingte Ausnahmen dokumentiert) | ✓ VERIFIED | Eigener Testlauf `npx vitest run --no-file-parallelism`: 192/195, exakt die 3 dokumentierten Fehlschläge (s.u.) |
| 6 | Jede Änderung an `taken` erzeugt eine Journalbuchung | ✓ VERIFIED | Unverändert; CR-04 (`PUT /:id` umgeht `/approve`) bleibt dokumentierte, nicht-blockierende Altlast außerhalb des Phase-6-Diffs |
| 7 | Buchung und Statuswechsel liegen in derselben DB-Transaktion | ✓ VERIFIED | `db.transaction()` in `applyApproval`/`applyRejection`/`applyDeletion`, unverändert |
| 8 | Journal-Saldo und `vacation_balance` stimmen nach jedem Vorgang überein | ✓ VERIFIED (Gap 1 geschlossen) | `initializeVacationBalance()` (absenceService.ts:1385-1417) delegiert jetzt an `upsertVacationBalance()`; beide erreichbaren Auto-Init-Pfade (`hasEnoughVacationDays` → `ensureVacationBalanceExists` Zeile 1435, `GET /vacation-balance/:year`) laufen über diesen gebuchten Pfad |
| 9 | `deleteAbsenceRequest` kennt den auslösenden Nutzer | ✓ VERIFIED | Unverändert |
| 10 | Anlage eines Mitarbeiters bucht den Jahresanspruch als `entitlement` | ✓ VERIFIED | Unverändert |
| 11 | Jahreswechsel bucht Anspruch und Übertrag des neuen Jahres | ✓ VERIFIED (Gap 2 geschlossen) | `bulkInitializeVacationBalances()` (vacationBalanceService.ts:719-825): bei existierendem Konto wird der fehlende Übertrag über eine `COUNT(*) ... type='carryover'`-Existenzprüfung nachgebucht, atomar in `db.transaction()`, idempotent |
| 12 | Journal-Saldo entspricht `entitlement + carryover - taken` | ✓ VERIFIED | Für alle fünf Kontoanlage-Pfade jetzt einheitlich über `calculateCarryover()`; real verletzte Bestandsdaten (Karin Jochem, Christine Glas) per 06-07 gegen Produktion korrigiert (siehe unten) |
| 13 | Jede Admin-Änderung erzeugt eine `correction`-Buchung mit Begründung und Auslöser | ✓ VERIFIED | Unverändert |
| 14 | Die Buchung hält den alten und neuen Wert fest | ✓ VERIFIED | Unverändert |

**Score:** 14/14 truths verified

### Gap-Closure — Detailprüfung

#### Gap 1 (CR-02): `initializeVacationBalance()` bucht jetzt atomar

**Code (server/src/services/absenceService.ts:1385-1417):**
```
export function initializeVacationBalance(userId, year): VacationBalance {
  const user = db.prepare('SELECT vacationDaysPerYear, hireDate FROM users WHERE id = ?').get(userId);
  const entitlement = calculateProRataVacationDays(user.hireDate, user.vacationDaysPerYear, year);
  const previousBalance = getVacationBalance(userId, year - 1);
  const carryover = calculateCarryover(previousBalance);
  upsertVacationBalance({ userId, year, entitlement, carryover, actorId: null });
  ...
}
```
- Liest jetzt `hireDate` (Zeile 1391-1392) — nicht mehr nur `vacationDaysPerYear` wie im alten,
  fehlerhaften Code (das exakte Fehlerbild, das Karin Jochems und Christine Glas' 2025er-Konten
  produziert hat).
- Berechnet den Anspruch über `calculateProRataVacationDays(hireDate, vacationDaysPerYear, year)`
  — dieselbe Funktion wie `initializeVacationAccountsForNewUser()` und
  `bulkInitializeVacationBalances()`.
- Delegiert die Kontoanlage vollständig an `upsertVacationBalance()` — kein rohes SQL mehr; die
  Buchung liegt atomar in derselben Transaktion, die die `vacation_balance`-Zeile erzeugt.
- Beide dokumentierten Erreichbarkeitspfade verifiziert: `hasEnoughVacationDays()` (Zeile 191)
  ruft bei fehlendem Konto `initializeVacationBalance()` auf (Zeile 206); zusätzlich läuft jeder
  über `updateBalancesAfterApproval`/`revertBalancesAfterDeletion` erreichte Pfad zusätzlich über
  `ensureVacationBalanceExists()` (Zeile 1435), das denselben Pfad nutzt und zusätzlich fehlende
  Grundbuchungen nachträgt.
- **Test:** `absenceVacationBooking.test.ts` Test 10 (Zeile 275) treibt den Auto-Init-Pfad direkt
  über `hasEnoughVacationDays()` ohne vorherige Genehmigung — verifiziert, dass sofort eine
  `entitlement`-Buchung entsteht, nicht erst retroaktiv durch eine spätere Genehmigung kaschiert.
  Tests 12/13 decken zusätzlich die Pro-rata-Grenzfälle (unterjähriger Eintritt, Eintritt nach dem
  angefragten Jahr) ab.
- **Ausgeführt:** `npx vitest run absenceVacationBooking --no-file-parallelism` → 14/14 grün
  (eigener Lauf, nicht aus SUMMARY übernommen).

**Nachfrage 1 aus dem Auftrag beantwortet:** Ja — pro-rata inkl. `hireDate`-Lesart bestätigt, exakt
belegt durch obigen Codeausschnitt.

**Nachfrage 3 aus dem Auftrag beantwortet:** Der Auto-Init-Pfad berechnet den Übertrag über
dieselbe `calculateCarryover()`-Funktion wie der Jahreswechsel (`bulkInitializeVacationBalances`)
— keine zweite, abweichende Formel mehr möglich. Vor 06-06 hätten unterschiedliche Implementierungen
unterschiedliche Werte liefern können; das ist strukturell ausgeschlossen, da beide Stellen dieselbe
exportierte Funktion aufrufen.

#### Gap 2 (CR-03): `bulkInitializeVacationBalances()` trägt fehlenden Übertrag nach

**Code (server/src/services/vacationBalanceService.ts:719-825):** Der `if (existing)`-Zweig bucht
jetzt bei `carryover > 0` und fehlender `type='carryover'`-Buchung für `(userId, year)` den
Übertrag nach — `UPDATE vacation_balance SET carryover = ?` + `recordVacationTransaction()`, beides
atomar in `db.transaction()`. Der Doppelbuchungsschutz per `COUNT(*)`-Prüfung überschreibt nie einen
bereits gebuchten, historisch abweichenden Wert (verifiziert per Test 8 in
`vacationEntitlementBooking.test.ts`).
**Ausgeführt:** `npx vitest run vacationEntitlementBooking --no-file-parallelism` → 8/8 grün
(Tests 7 und 8 decken Nachbuchung+Idempotenz sowie die Nicht-Überschreib-Garantie ab).

#### Gap 3 (REQ-15): Test für jahresübergreifenden Antrag existiert und prüft echtes Verhalten

`absenceVacationBooking.test.ts` Test 11 (Zeile 297) legt einen Antrag mit `startDate: '2090-12-27'`,
`endDate: '2091-01-02'` an, genehmigt ihn über die reale `approveAbsenceRequest()`-Funktion und
prüft per Assertion (nicht nur Kommentar): die `vacation_taken`-Buchung liegt vollständig im
Startjahr (`getVacationTransactions(userId, {year: 2090})`, genau 1 Treffer, `days === -request.days`)
und es existiert keine Buchung im Endjahr (`getVacationTransactions(userId, {year: 2091})`, 0
`vacation_taken`-Treffer). Das ist ein echter Verhaltenstest, keine bloße Dokumentation in
Kommentarform — er würde fehlschlagen, sollte sich das bekannte, laut ROADMAP.md bewusst nicht
behobene Verhalten ändern.

**Nachfrage 4 aus dem Auftrag beantwortet:** Test 11 prüft das tatsächliche Verhalten per
Assertion, nicht nur per Kommentar-Dokumentation.

### Nachfrage 2 aus dem Auftrag: sechste Übertragsstelle?

Vollständige Suche nach `carryover`-Berechnungen in `server/src/services/*.ts` und
`server/src/routes/*.ts` (Vacation-Kontext, Überstunden-`carryover` ist ein separates, unabhängiges
Konzept und nicht Teil dieser Prüfung): Alle Stellen, die einen Vacation-Übertrag berechnen, rufen
`calculateCarryover()` auf: `absenceService.ts:1403`, `vacationBalanceService.ts:245`
(Validierungsgrenze `upsertVacationBalance`), `vacationBalanceService.ts:509` (Validierungsgrenze
`updateVacationBalance`), `vacationBalanceService.ts:738` (`bulkInitializeVacationBalances`),
`yearEndRolloverService.ts:198` (`previewYearEndRollover`). Das sind exakt die fünf im Docstring von
`calculateCarryover()` dokumentierten Stellen — **keine sechste gefunden.**

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/services/absenceService.ts` | `initializeVacationBalance()` bucht atomar über `upsertVacationBalance()` | ✓ VERIFIED | Zeile 1385-1417, gelesen und nachvollzogen |
| `server/src/services/vacationBalanceService.ts` | `bulkInitializeVacationBalances()` trägt Übertrag nach; `calculateCarryover()` einzige Quelle | ✓ VERIFIED | Zeile 135-141 (Funktion), 719-825 (Nachbuchung) |
| `server/src/services/yearEndRolloverService.ts` | `previewYearEndRollover()` nutzt `calculateCarryover()` | ✓ VERIFIED | Zeile 194-198 |
| `server/src/services/absenceVacationBooking.test.ts` | Tests 10-13 (Gap 1, Pro-rata, Gap 3) | ✓ VERIFIED | 14/14 grün im eigenen Lauf |
| `server/src/services/vacationEntitlementBooking.test.ts` | Tests 7-8 (Gap 2, Idempotenz, Nicht-Überschreiben) | ✓ VERIFIED | 8/8 grün im eigenen Lauf |
| `server/src/services/vacationCarryoverCalculation.test.ts` | Regressionstest über alle 5 Pfade | ✓ VERIFIED, vorhanden | Existiert (06-06), Teil der 192/195-Gesamtsumme |
| `server/src/services/preHireVacationCorrectionService.ts` | Bestandskorrektur Karin Jochem/Christine Glas | ✓ VERIFIED | Existiert, gegen Produktion ausgeführt laut 06-07-SUMMARY, Korrekturergebnis vom Orchestrator bereits unabhängig gegen Produktionsdaten geprüft (siehe Ausgangslage) |
| `desktop/src/components/vacation/VacationBalanceEditModal.tsx` | 10-Tage-Obergrenze entfernt | ✓ VERIFIED | Nur noch Untergrenze `< 0` geprüft (Zeile 84-86), kein oberer Cap mehr |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `hasEnoughVacationDays` | `initializeVacationBalance` → `upsertVacationBalance` | direkter Aufruf | ✓ WIRED | Zeile 206 → 1409 |
| `GET /vacation-balance/:year` | `initializeVacationBalance` → `upsertVacationBalance` | Route → Service | ✓ WIRED | Unverändert seit Gap-1-Fix |
| `bulkInitializeVacationBalances` (existing-Zweig) | `recordVacationTransaction` | `type: 'carryover'`, `db.transaction()` | ✓ WIRED | Zeile 762 |
| `previewYearEndRollover` | `calculateCarryover` | direkter Aufruf | ✓ WIRED | Zeile 198 |

### Behavioral Spot-Checks (eigener Testlauf, nicht aus SUMMARY übernommen)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npx tsc --noEmit` fehlerfrei | `cd server && npx tsc --noEmit` | keine Ausgabe / Exit 0 | ✓ PASS |
| Gap-1/Gap-2/Gap-3-Tests grün | `npx vitest run absenceVacationBooking vacationEntitlementBooking vacationCorrectionBooking --no-file-parallelism` | 33/33 grün (3 Dateien) | ✓ PASS |
| Gesamtsuite | `npx vitest run --no-file-parallelism` | 192 passed / 3 failed (195 gesamt) | ✓ PASS (deckt sich exakt mit dokumentiertem Referenzwert) |
| Auto-Init bucht jetzt | Codelektüre `absenceService.ts:1385-1417` | `upsertVacationBalance()`-Aufruf vorhanden | ✓ PASS (widerlegt Gap 1) |
| Jahreswechsel trägt Übertrag nach | Codelektüre `vacationBalanceService.ts:719-825` | Nachbuchungs-Zweig mit `COUNT`-Idempotenzschutz vorhanden | ✓ PASS (widerlegt Gap 2) |
| Sechste Übertragsstelle? | `grep -rn "carryover" server/src/services/*.ts server/src/routes/*.ts` | genau 5 direkte `calculateCarryover()`-Aufrufe im Vacation-Kontext | ✓ PASS (keine gefunden) |

**Die drei verbleibenden Testfehlschläge** (`unifiedOvertimeService.test.ts` 2×, `vacationBackfillService.test.ts` 1×) sind identisch mit den vom Orchestrator bereits dokumentierten, umgebungsbedingten Fällen — datumsabhängig (für 06.02.2026 geschrieben) bzw. zustandsabhängig (`hasExistingBackfill()` sieht den echten Phase-7-Backfill). Kein Phase-6-Regressionsfund.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| REQ-05 | Genehmigung/Ablehnung/Löschung erzeugen je eine Buchung, gleiche Transaktion | ✓ SATISFIED | Unverändert seit Erstverifikation, CR-04 bleibt dokumentierte Altlast außerhalb des Phase-6-Diffs |
| REQ-06 | Admin-Änderungen erzeugen `correction`-Buchung mit Pflichtbegründung | ✓ SATISFIED | Unverändert |
| REQ-07 | Anspruch und Übertrag bei Nutzeranlage und Jahreswechsel werden gebucht | ✓ SATISFIED | Gap 1 und Gap 2 geschlossen, `calculateCarryover()` als einzige Quelle für alle 5 Pfade |
| REQ-15 | Regressionstests für die auslösenden Fehler inkl. jahresübergreifender Antrag | ✓ SATISFIED | Test 11 prüft das jahresübergreifende Verhalten per Assertion (Gap 3 geschlossen) |

### Anti-Patterns Found

Keine neuen Blocker. Die in der Erstverifikation als nicht-blockierende Warnungen eingestuften
Punkte (CR-04: `PUT /:id` umgeht `/approve`; CR-05: IDOR auf `GET /api/vacation-balances/:userId`)
liegen weiterhin außerhalb des von den Gap-Closure-Plänen (06-04 bis 06-07) berührten Codes und
werden hier erneut als Warnung, nicht als Blocker dieser Phase gewertet.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/src/routes/absences.ts` | 391-434 | `PUT /:id` erlaubt Statuswechsel durch den Antragseigentümer selbst, umgeht `/approve` | ⚠️ Warning (unverändert seit Erstverifikation) | Pre-existing, nicht durch Phase 6 eingeführt oder von den Gap-Closure-Plänen berührt |
| `server/src/routes/vacationBalance.ts` | 67-140 | `GET /:userId` ohne Admin-/Owner-Prüfung (IDOR) | ⚠️ Warning (unverändert seit Erstverifikation) | Pre-existing, außerhalb des Phase-6-Diffs |

## Human Verification Required

Keine — alle Prüfpunkte dieser Phase und ihres Lückenschlusses sind Backend-Logik und über
Code-Lektüre, `tsc`, und eigene Testläufe verifizierbar. Kein UI-Anteil (die einzige Frontend-Änderung,
die entfernte 10-Tage-Grenze, wurde per Codelektüre bestätigt).

## Gaps Summary

Alle drei in der Erstverifikation (2026-08-19) dokumentierten Lücken sind geschlossen und wurden
hier unabhängig gegen den aktuellen Code nachvollzogen, nicht aus SUMMARY.md übernommen:

1. **Gap 1 (CR-02) — geschlossen:** `initializeVacationBalance()` delegiert an `upsertVacationBalance()`
   und berechnet den Anspruch pro rata über `calculateProRataVacationDays(hireDate, ...)`. Beide
   produktiven Erreichbarkeitspfade (Auto-Init über `hasEnoughVacationDays`, Anzeige über
   `GET /vacation-balance/:year`) laufen jetzt gebucht.
2. **Gap 2 (CR-03) — geschlossen:** `bulkInitializeVacationBalances()` trägt bei bereits
   existierenden Konten (typischerweise durch Nutzeranlage vorab angelegte Folgejahreskonten)
   den fehlenden Übertrag idempotent nach, statt sie blind zu überspringen.
3. **Gap 3 (REQ-15) — geschlossen:** Test 11 in `absenceVacationBooking.test.ts` genehmigt real
   einen jahresübergreifenden Antrag und prüft per Assertion, dass die Buchung vollständig ins
   Startjahr fällt — kein reiner Dokumentationskommentar.

Zusätzlich wurde bestätigt: Es existiert keine sechste, von `calculateCarryover()` unabhängige
Übertragsberechnung; der Auto-Init-Pfad kann strukturell keinen anderen Übertragswert mehr
erzeugen als der Jahreswechsel, da beide dieselbe Funktion aufrufen; die reale Bestandskorrektur
(Karin Jochem, Christine Glas) wurde laut 06-07-SUMMARY gegen die Produktionsdatenbank ausgeführt
und vom Orchestrator bereits unabhängig gegen die Produktionsdaten verifiziert (Journalsaldo 2025
je 0, `vacation_balance` 2025 komplett 0, je eine `[BACKFILL-06-07]`-Korrekturbuchung, 2026er-Konten
und userId 1 unangetastet).

Das Phasenziel — **"Jede Bewegung auf dem Urlaubskonto erzeugt ab jetzt eine Buchungszeile"** —
ist damit erreicht: Score 14/14, keine offenen Blocker.

---

_Verified: 2026-08-21T21:10:00Z_
_Verifier: Claude (gsd-verifier)_
