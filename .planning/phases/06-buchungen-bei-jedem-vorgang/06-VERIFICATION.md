---
phase: 06-buchungen-bei-jedem-vorgang
verified: 2026-08-19T23:20:00Z
status: gaps_found
score: 11/14 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Journal-Saldo und vacation_balance stimmen nach jedem Vorgang überein"
    status: failed
    reason: >
      absenceService.initializeVacationBalance() legt vacation_balance-Zeilen weiterhin per
      rohem INSERT/UPDATE an — ohne jede Journalbuchung. Diese Funktion ist über zwei
      produktive Wege erreichbar: hasEnoughVacationDays() (Auto-Init, wenn ein Nutzer für ein
      Jahr ohne Konto Urlaub beantragt) und GET /api/absences/vacation-balance/:year (bloßes
      Anzeigen legt ein ungebuchtes Konto an). Unabhängig gegen den Code verifiziert (CR-02
      aus 06-REVIEW.md).
    artifacts:
      - path: "server/src/services/absenceService.ts"
        issue: "initializeVacationBalance() (Zeile 1379) verwendet rohes SQL statt upsertVacationBalance()/recordVacationTransaction(); hasEnoughVacationDays() (Zeile 190) ruft es bei fehlendem Konto automatisch auf"
      - path: "server/src/routes/absences.ts"
        issue: "GET /vacation-balance/:year (Zeile 730, Aufruf initializeVacationBalance Zeile ~761) legt beim bloßen Ansehen des Saldos ein ungebuchtes Konto an"
    missing:
      - "initializeVacationBalance() in absenceService.ts muss an den buchenden Pfad delegieren (vacationBalanceService.upsertVacationBalance), statt eigenes rohes SQL zu fahren — analog zum Fix-Vorschlag in 06-REVIEW.md CR-02"
      - "Regressionstest, der ein Konto exakt über diesen Auto-Init-Pfad (Urlaubsantrag für ein Jahr ohne bestehendes Konto) entstehen lässt und danach Journal == entitlement + carryover − taken prüft"
  - truth: "Jahreswechsel bucht Anspruch und Übertrag des neuen Jahres"
    status: failed
    reason: >
      bulkInitializeVacationBalances() überspringt jedes bereits existierende Konto
      vollständig (if (existing) continue), ohne einen fehlenden Übertrag nachzutragen.
      initializeVacationAccountsForNewUser() legt bei jeder Nutzeranlage bereits ein
      Folgejahreskonto mit carryover=0 an. Für diese Mitarbeiter wird beim späteren
      Jahreswechsel weder das Konto aktualisiert noch eine carryover-Buchung erzeugt — der
      Resttag-Übertrag geht ersatzlos und unprotokolliert verloren. Unabhängig gegen den Code
      verifiziert (CR-03 aus 06-REVIEW.md); in der Entwicklungsdatenbank betrifft dies laut
      Review 13 vorab angelegte 2027-Konten.
    artifacts:
      - path: "server/src/services/vacationBalanceService.ts"
        issue: "bulkInitializeVacationBalances() Zeile 656 (if (existing) { continue; }) trägt keinen fehlenden Übertrag nach"
    missing:
      - "bulkInitializeVacationBalances() muss bei bereits existierenden Konten prüfen, ob ein Übertrag aus dem Vorjahr aussteht (keine carryover-Buchung vorhanden, previousBalance.remaining > 0) und diesen nachbuchen, statt das Konto blind zu überspringen"
      - "Regressionstest: Nutzer im Vorjahr über initializeVacationAccountsForNewUser anlegen (legt Folgejahreskonto mit carryover=0 an), Resttage im Vorjahr erzeugen, performYearEndRollover ausführen, carryover > 0 und carryover-Buchung erwarten"
  - truth: "REQ-15: Tests decken jahresübergreifenden Antrag ab"
    status: failed
    reason: >
      REQUIREMENTS.md verlangt für REQ-15 explizit vier Testfälle: Storno eines genehmigten
      Antrags, Wieder-Genehmigung, Anlage mit 0 Urlaubstagen, jahresübergreifender Antrag.
      Die ersten drei sind abgedeckt (absenceVacationBooking.test.ts Tests 2/3,
      vacationEntitlementBooking.test.ts Test 2). Ein Test für einen jahresübergreifenden
      Antrag (z. B. 28.12.–05.01.) existiert in keiner der drei neuen Testdateien. Laut
      ROADMAP.md Out-of-Scope soll der zugrundeliegende Fehler nur getestet, nicht behoben
      werden — der Test selbst ist damit explizit gefordert und fehlt.
    artifacts:
      - path: "server/src/services/absenceVacationBooking.test.ts"
        issue: "kein Test für einen Antrag, der zwei Kalenderjahre überspannt"
    missing:
      - "Regressionstest: Urlaubsantrag mit startDate/endDate in unterschiedlichen Jahren genehmigen und dokumentieren, dass die Buchung vollständig ins Startjahr fällt (bekannter, bewusst nicht behobener Fehler laut ROADMAP.md)"
---

# Phase 06: Buchungen bei jedem Vorgang Verification Report

**Phase Goal:** Jede Bewegung auf dem Urlaubskonto erzeugt ab jetzt eine Buchungszeile.
**Verified:** 2026-08-19T23:20:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pending → approved → rejected` erzeugt zwei Buchungen, Saldo unverändert | ✓ VERIFIED | `absenceVacationBooking.test.ts` Test 2 (Zeile 83); Code: `updateBalancesAfterApproval`/`revertBalancesAfterDeletion` (absenceService.ts:1225, 1277) rufen `recordVacationTransaction` |
| 2 | `pending → approved → rejected → approved` erzeugt drei Buchungen, `taken` = Tage (nicht 2×) | ✓ VERIFIED | Test 3 (Zeile 102), grün in eigenem Testlauf |
| 3 | Nutzeranlage mit 0 Urlaubstagen bucht 0, nicht 30 | ✓ VERIFIED | `vacationEntitlementBooking.test.ts` Test 2 (Zeile 114); Code prüft `currentYearEntitlement === 0` und überspringt Buchung (vacationBalanceService.ts:397) — für den produktiv genutzten `POST /api/users`-Pfad |
| 4 | Admin-Korrektur ohne Begründung wird abgelehnt | ✓ VERIFIED | `vacationCorrectionBooking.test.ts` Test 5 (Zeile 153); Route weist leere Zeichenkette mit HTTP 400 ab (vacationBalance.ts:168, 217) |
| 5 | Alle Tests grün (die zwei vorbestehend roten in `unifiedOvertimeService.test.ts` ausgenommen) | ✓ VERIFIED | Eigener Testlauf: 135/137 grün, exakt die zwei dokumentierten, datumsabhängigen Fehlschläge in `unifiedOvertimeService.test.ts` (unverändert von diesem Phasen-Diff) |
| 6 | Jede Änderung an `taken` erzeugt eine Journalbuchung | ✓ VERIFIED (mit Einschränkung) | Code bestätigt für den vorgesehenen Weg (approve/reject/delete). **Einschränkung:** `PUT /api/absences/:id` erlaubt Statuswechsel unter Umgehung von `approve`/`reject` (CR-04, pre-existing, siehe Warnungen) — literal ändert sich `taken` dort nicht ungebucht, aber eine spätere Ablehnung bucht eine ungedeckte Gutschrift |
| 7 | Buchung und Statuswechsel liegen in derselben DB-Transaktion | ✓ VERIFIED | `applyApproval`/`applyRejection`/`applyDeletion` als `db.transaction()` bestätigt in absenceService.ts |
| 8 | Journal-Saldo und `vacation_balance` stimmen nach jedem Vorgang überein | ✗ FAILED | Nur für Konten wahr, die über den buchenden Pfad entstanden sind. `absenceService.initializeVacationBalance()` legt weiterhin ungebuchte Konten an (CR-02, siehe Gaps) |
| 9 | `deleteAbsenceRequest` kennt den auslösenden Nutzer | ✓ VERIFIED | Signatur `deleteAbsenceRequest(id, deletedBy)`, Aufruf `routes/absences.ts:682` mit `req.session.user!.id` |
| 10 | Anlage eines Mitarbeiters bucht den Jahresanspruch als `entitlement` | ✓ VERIFIED | `initializeVacationAccountsForNewUser()` bucht pro-rata für laufendes und volles für Folgejahr (vacationBalanceService.ts:380 ff.), Test 1/3 |
| 11 | Jahreswechsel bucht Anspruch und Übertrag des neuen Jahres | ✗ FAILED | Gilt nur für tatsächlich neu angelegte Konten. Für bereits vorab angelegte Folgejahreskonten (Regelfall bei jeder Nutzeranlage) wird der Übertrag beim Jahreswechsel übersprungen (CR-03, siehe Gaps) |
| 12 | Journal-Saldo entspricht `entitlement + carryover - taken` | ✗ FAILED | Gilt nur in den getesteten Szenarien, in denen das Konto über den korrekten Pfad entsteht. In Produktion durch CR-02/CR-03 real verletzt (leere `vacation_transactions`-Tabelle bei 18 Bestandskonten laut 06-REVIEW.md, empirisch belegt) |
| 13 | Jede Admin-Änderung erzeugt eine `correction`-Buchung mit Begründung und Auslöser | ✓ VERIFIED | `updateVacationBalance`/`upsertVacationBalance` buchen Differenz je Feld mit `createdBy`, Tests 1–3, 9 |
| 14 | Die Buchung hält den alten und neuen Wert fest | ✓ VERIFIED | `buildCorrectionDescription()` erzeugt `Korrektur Anspruch 30 → 0 (Grund: ...)` |

**Score:** 11/14 truths verified (3 FAILED)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/services/absenceService.ts` | Buchung bei Genehmigung, Ablehnung, Löschung | ✓ VERIFIED | `recordVacationTransaction` an beiden `updateVacationTaken`-Aufrufern (Zeile 1225, 1277); ⚠️ enthält zugleich den ungebuchten Pfad `initializeVacationBalance` (Gap 1) |
| `server/src/services/absenceVacationBooking.test.ts` | Regressionstests für die auslösenden Fehler | ✓ VERIFIED, aber unvollständig | 10 Tests, alle grün; REQ-15-Fall "jahresübergreifender Antrag" fehlt (Gap 3) |
| `server/src/services/vacationEntitlementBooking.test.ts` | Tests für Anspruch, Übertrag, 0-Tage-Fall | ✓ VERIFIED | 6 Tests, alle grün; deckt aber nicht den CR-03-Fall (Folgejahreskonto existiert bereits) ab |
| `server/src/services/vacationCorrectionBooking.test.ts` | Tests für Pflichtbegründung und Korrekturbuchung | ✓ VERIFIED | 11 Tests, alle grün |
| `server/src/routes/absences.ts` | `deletedBy` durchgereicht | ✓ VERIFIED | Zeile 682 |
| `server/src/services/vacationBalanceService.ts` | Buchung bei Massenanlage/Jahreswechsel, Korrektur | ⚠️ TEILWEISE | Buchungslogik korrekt implementiert, aber `if (existing) continue` (Zeile 656) verhindert Nachbuchung des Übertrags für vorab angelegte Konten (Gap 2) |
| `server/src/routes/vacationBalance.ts` | Pflichtbegründung, `reason`/`actorId` durchgereicht | ✓ VERIFIED | Zeile 168, 217 (400 bei leerer Begründung) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `updateBalancesAfterApproval` / `revertBalancesAfterDeletion` | `recordVacationTransaction` | direkter Aufruf | ✓ WIRED | Bestätigt, Zeile 1225 / 1277 |
| `upsertVacationBalance` / `bulkInitializeVacationBalances` / `performYearEndRollover` | `recordVacationTransaction` | `type: 'entitlement'`/`'carryover'` | ⚠️ PARTIAL | Für Neuanlagen WIRED; für bereits existierende Folgejahreskonten NOT_WIRED (kein Nachtrag, Gap 2) |
| `updateVacationBalance` / `upsertVacationBalance` | `recordVacationTransaction` | `type: 'correction'` | ✓ WIRED | Bestätigt, Zeile 327 / 575 |
| `hasEnoughVacationDays` / `GET vacation-balance/:year` | `recordVacationTransaction` | — | ✗ NOT_WIRED | `initializeVacationBalance()` (absenceService.ts:1379) bucht nicht (Gap 1) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npx tsc --noEmit` fehlerfrei | `cd server && npx tsc --noEmit` | keine Ausgabe / Exit 0 | ✓ PASS |
| Testsuite Gesamtstatus | `cd server && npx vitest run` | 135 passed / 2 failed (8 Dateien) | ✓ PASS (deckt sich exakt mit dokumentiertem Referenzwert) |
| Auto-Init-Pfad bucht nicht | `grep -n "recordVacationTransaction" server/src/services/absenceService.ts` (im Umfeld von `initializeVacationBalance`) | keine Treffer zwischen Zeile 1379–1423 | ✓ PASS (bestätigt Gap 1) |
| Jahreswechsel überspringt bestehende Konten | `sed -n '650,660p' server/src/services/vacationBalanceService.ts` | `if (existing) { continue; }` ohne Buchungslogik | ✓ PASS (bestätigt Gap 2) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REQ-05 | 06-01 | Genehmigung/Ablehnung/Löschung erzeugen je eine Buchung, gleiche Transaktion | ✓ SATISFIED (mit Warnung) | Für `/approve`, `/reject`, `DELETE` bestätigt. `PUT /api/absences/:id` (pre-existing, nicht Teil dieser Phase) umgeht die Genehmigungslogik vollständig — kein Fix in dieser Phase enthalten, siehe Warnung CR-04 |
| REQ-06 | 06-03 | Admin-Änderungen erzeugen `correction`-Buchung mit Pflichtbegründung | ✓ SATISFIED | Vollständig verifiziert, inkl. Ersatztext-Übergangsregel |
| REQ-07 | 06-02 | Anspruch und Übertrag bei Nutzeranlage und Jahreswechsel werden gebucht | ✗ BLOCKED | Für Neuanlage über `POST /api/users` erfüllt; für den Jahreswechsel bestehender (vorab angelegter) Konten nicht — Gap 2. Zusätzlich existiert mit `absenceService.initializeVacationBalance` ein zweiter, konkurrierender Kontoanlage-Pfad, der nie bucht — Gap 1 |
| REQ-15 | 06-01 | Regressionstests für die auslösenden Fehler (inkl. jahresübergreifender Antrag) | ✗ BLOCKED | 3 von 4 in REQUIREMENTS.md geforderten Testfällen vorhanden; Test für jahresübergreifenden Antrag fehlt — Gap 3 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/src/services/absenceService.ts` | 1379–1423 | Zweiter, ungebuchter Kontoanlage-Pfad (`initializeVacationBalance`) parallel zum gebuchten (`upsertVacationBalance`) | 🛑 Blocker | Bricht die Kerninvariante des Phasenziels für alle über diesen Pfad entstandenen Konten (Gap 1) |
| `server/src/services/vacationBalanceService.ts` | 656 | `if (existing) { continue; }` ohne Nachbuchung eines fehlenden Übertrags | 🛑 Blocker | Übertrag geht bei jedem Jahreswechsel für vorab angelegte Folgejahreskonten unprotokolliert verloren (Gap 2) |
| `server/src/routes/absences.ts` | 391–434 | `PUT /:id` erlaubt Statuswechsel durch den Antragseigentümer selbst, umgeht `/approve` vollständig | ⚠️ Warning | Pre-existing, nicht durch Phase 6 eingeführt oder behoben; widerspricht aber der "per Konstruktion"-Aussage des Phasen-Plans (CR-04 aus 06-REVIEW.md) |
| `server/src/routes/vacationBalance.ts` | 67–140 | `GET /:userId` ohne Admin-/Owner-Prüfung (IDOR) | ⚠️ Warning | Pre-existing, außerhalb des Phase-6-Diffs (nur `POST`/`PUT` wurden geändert); DSGVO-relevant, dringend empfohlen dies zeitnah zu beheben (CR-05) |
| `server/src/services/absenceService.ts` | 1127–1130, 1346 | `require()` in ESM-Modul (`type: module`) — wirft `ReferenceError`, verschluckt von try/catch | ℹ️ Info | Verifiziert real (CR-01), aber nachweislich bereits vor dem ersten Phase-6-Commit vorhanden — keine Phase-6-Regression, nicht blockierend für dieses Verifikationsziel |
| `server/src/services/vacationEntitlementBooking.test.ts` | diverse | Tests laufen ohne DB-Isolation gegen die gemeinsam genutzte Entwicklungsdatenbank, ungescopte `DELETE`-Aufräumroutinen | ⚠️ Warning | Risiko für Datenverlust bei Testabbruch; Tests selbst liefen in dieser Verifikation reproduzierbar grün (CR-06) |

## Human Verification Required

Keine — alle Prüfpunkte dieser Phase sind Backend-Logik und über Code-Lektüre, `tsc`, und Testläufe verifizierbar. Kein UI-Anteil in Phase 6.

## Gaps Summary

Die drei zentralen, in den PLAN-Dateien und im ROADMAP explizit geforderten Erfolgskriterien
(Genehmigung/Ablehnung/Löschung, Doppelbuchungs-Schutz, Pflichtbegründung, grüne Testsuite)
sind vollständig erfüllt und wurden unabhängig vom Code aus verifiziert — nicht nur aus
SUMMARY.md übernommen.

Das Phasenziel selbst — **"Jede Bewegung auf dem Urlaubskonto erzeugt ab jetzt eine
Buchungszeile"** — ist jedoch nicht vollständig erreicht. Zwei vom Code-Review (06-REVIEW.md
CR-02, CR-03) behauptete Lücken wurden hier unabhängig gegen den aktuellen Code nachvollzogen
und bestätigt:

1. **CR-02 (Gap 1):** `absenceService.initializeVacationBalance()` ist ein zweiter,
   konkurrierender Weg, auf dem ein Urlaubskonto entsteht — erreichbar über den Auto-Init in
   `hasEnoughVacationDays()` (jeder Urlaubsantrag für ein Jahr ohne bestehendes Konto) und über
   das bloße Ansehen des Saldos (`GET /vacation-balance/:year`). Dieser Pfad bucht nie ins
   Journal. Die mitgelieferten Tests in `absenceVacationBooking.test.ts` grünen unabhängig
   davon nur, weil ihre Testkonten zufällig `entitlement = 0` im Journal-Vergleich ergeben —
   der Test verifiziert damit nicht das, was er zu verifizieren behauptet.

2. **CR-03 (Gap 2):** `bulkInitializeVacationBalances()` — der einzige Pfad, der beim
   Jahreswechsel den Übertrag bucht — überspringt jedes bereits existierende Konto ohne
   Nachbuchung. Da `initializeVacationAccountsForNewUser()` bei jeder Nutzeranlage bereits ein
   Folgejahreskonto anlegt, betrifft dies praktisch jeden Mitarbeiter: Beim Jahreswechsel
   verfällt sein Resturlaub ersatzlos und unprotokolliert — exakt der Schadensfall, den dieser
   Milestone laut REQUIREMENTS.md verhindern soll.

Beide Lücken sind nicht auf Rand- oder Admin-Sonderfälle beschränkt, sondern auf die
Alltagsprozesse "Urlaub für ein neues Jahr beantragen" und "Jahreswechsel" — also exakt den
Kern des Phasenziels. Sie werden von keiner der 27 neuen Tests aus 06-01/06-02/06-03 erfasst,
weil keiner der Tests diese beiden konkreten Codepfade auslöst.

Zusätzlich fehlt der in REQUIREMENTS.md für REQ-15 explizit geforderte Testfall
"jahresübergreifender Antrag" (Gap 3) — er wird laut ROADMAP.md bewusst nur getestet, nicht
behoben, ist aber in keiner der drei neuen Testdateien vorhanden.

**Nicht blockierend, aber zur Kenntnis:** CR-04 (Statuswechsel per `PUT` unter Umgehung von
`/approve`) und CR-05 (IDOR auf `GET /api/vacation-balances/:userId`) sind real und relevant,
liegen aber in Code, der von keinem der drei Phase-6-Pläne berührt wurde — sie werden hier
als Warnung dokumentiert, nicht als Blocker dieser Phase gewertet. CR-01 (`require()` in
ESM) ist als Altlast vor dem ersten Phase-6-Commit bestätigt und ebenfalls nicht als
Phase-6-Regression gewertet.

**Warum keine Deferred-Einstufung:** Phase 7 ("Saldo aus Buchungen + Backfill") behandelt laut
ROADMAP.md die *rückwirkende* Rekonstruktion der Historie und macht `taken` zur abgeleiteten
Größe — sie enthält keine Zusage, die hier gefundenen, weiterhin *aktiven* Schreibpfade
(CR-02, CR-03) zu schließen. Im Gegenteil: Phase 7s eigene Erfolgskriterien ("Prüfer meldet
null Abweichungen") würden durch diese beiden offenen Lücken sofort verletzt. Die Gaps bleiben
daher als reale, nicht verschobene Befunde dieser Phase stehen.

---

_Verified: 2026-08-19T23:20:00Z_
_Verifier: Claude (gsd-verifier)_
