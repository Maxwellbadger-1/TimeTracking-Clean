---
phase: 12-stundenwechsel-bedienen
plan: 03
subsystem: server
tags: [sqlite, better-sqlite3, node-crypto, overtime, work-periods, dry-run]

# Dependency graph
requires:
  - phase: 12-stundenwechsel-bedienen
    plan: 01
    provides: "Buchungstyp model_change, referenceType work_period, Vertragstypen WorkTimeChangeInput/Preview/PreviewResponse/Outcome, GET /api/work-periods"
  - phase: 11-datumsabh-ngige-berechnung
    provides: "workPeriodContext.ts (createWorkPeriodContext, D1/D2), periodenbewusste getDailyTargetHours()"
  - phase: 10-perioden-fundament
    provides: "workPeriodService.ts (getWorkPeriods, resolveWorkPeriodIn, createWorkPeriod, closeWorkPeriod, checkPeriodChain, WorkPeriodConflictError)"
provides:
  - "issuePreviewToken/verifyPreviewToken (workTimeChangeToken.ts) — zustandsloses, HMAC-signiertes 15-Minuten-Token, bindet userId/validFrom/weeklyHours/workSchedule"
  - "applyWorkTimeChange (workPeriodChangeService.ts) — der eine Vorgang fuer Vorschau UND Speichern (D2), inkl. WorkTimeChangeValidationError"
affects: [12-04, 12-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Trockenlauf durch echtes Schreiben + Messen + gezieltes Werfen innerhalb der db.transaction()-Klammer (PreviewRollback), statt einer zweiten, schreibfreien Rechenbahn — D2"
    - "Namensraum-Import fuer createWorkPeriodContext (workPeriodContextModule.createWorkPeriodContext()), damit ein grep auf den Funktionsnamen ausschliesslich die beiden tatsaechlichen Aufrufstellen zeigt (Muster aus overtimeTransactionRebuildService.ts, Plan 11-05)"
    - "Zustandsloses HMAC-Token ueber SESSION_SECRET mit Ersatzwert nur ausserhalb NODE_ENV=production (Muster aus server.ts:69)"

key-files:
  created:
    - server/src/services/workTimeChangeToken.ts
    - server/src/services/workTimeChangeToken.test.ts
    - server/src/services/workPeriodChangeService.ts
  modified: []

key-decisions:
  - "previousWeeklyHours fuer die Journalbeschreibung: currentPeriod.weeklyHours, falls eine Periode am Stichtag aktiv war, sonst user.weeklyHours als Rueckfallwert (Luecken-Fall) — im Textbuch der UI-SPEC nicht explizit benannt, folgt aber dem Sinn des Satzes 'X,X -> Y,Y h/Woche'"
  - "Bei einer Luecke am Stichtag (kein currentPeriod) wird validTo der neuen Periode aus der naechsten Periode mit groesserem validFrom abgeleitet (sonst null) — wortgleich zur Vorgabe in 12-03-PLAN.md Task 2, Schritt 10"
  - "Der Trockenlauf schreibt und rechnet exakt wie der Speicherpfad, inklusive isNoOp-Fall — nur der Speicherpfad verweigert bei isNoOp mit WorkTimeChangeValidationError; im Trockenlauf entsteht eine (später zurueckgerollte) Periode mit identischen Werten, damit keine zweite Rechenbahn fuer diesen Fall noetig wird"

patterns-established:
  - "applyWorkTimeChange(input, { dryRun, createdBy }) als einziger Einstiegspunkt fuer Vorschau- und Speichern-Route in Plan 12-05"

requirements-completed: [REQ-27]

# Metrics
duration: ~45min
completed: 2026-08-22
---

# Phase 12 Plan 03: Der zentrale Schreibweg — previewToken und applyWorkTimeChange Summary

**`applyWorkTimeChange()` ist ab jetzt die einzige Rechenbahn für Vorschau und Speichern eines Stundenwechsels (D2); ein zustandsloses, 15 Minuten gültiges HMAC-Token (`workTimeChangeToken.ts`) bindet die vier entscheidungsrelevanten Felder ohne die Begründung.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2 completed
- **Files modified:** 3 (alle neu)

## Accomplishments

- `workTimeChangeToken.ts`: `issuePreviewToken`/`verifyPreviewToken` binden `userId`, `validFrom`, `weeklyHours`, `workSchedule` per HMAC-SHA256 über `SESSION_SECRET`, 15 Minuten Gültigkeit, 60 Sekunden Vorlauftoleranz, `timingSafeEqual`-Vergleich, kein Modul-Zustand. Alle acht Verhaltensregeln aus dem Plan sind als eigene Testfälle belegt (13 Tests, u. a. Ablauf und Zukunfts-Vorlauf über `vi.useFakeTimers` statt `sleep`).
- `workPeriodChangeService.ts`: `applyWorkTimeChange(input, { dryRun, createdBy })` klammert Periode schließen/anlegen, den auf `validFrom..heute` begrenzten Rebuild (D3) und die eine `model_change`-Buchung (D4) in **einer** `db.transaction()`-Klammer (D7). Der Trockenlauf ist ein echter Trockenlauf: rechnen, schreiben, messen, `PreviewRollback` werfen — better-sqlite3 rollt die gesamte Klammer zurück. Es gibt keine zweite Rechenbahn.
- Serverseitige Validierung (Stichtag, Wochenstunden 0–60, Tagesplan-Typwächter, Eintritts-/Austrittsdatum, Pflichtbegründung ≥ 10 Zeichen im Speicherpfad) mit den wörtlichen Fehlertexten aus `12-UI-SPEC.md`. `WorkPeriodConflictError` aus dem Perioden-Service wird nicht geschluckt, sondern als `WorkTimeChangeValidationError` mit derselben Meldung weitergereicht.
- Alle grep-basierten Acceptance-Criteria beider Tasks exakt erfüllt (siehe Self-Check), inklusive der scharfen "genau N"-Kriterien (eine Transaktionsklammer, genau eine `model_change`-Stelle, genau zwei `createWorkPeriodContext`-Aufrufe, null `directWorkPeriodLookup`-Treffer).

## Task Commits

Each task was committed atomically:

1. **Task 1: workTimeChangeToken.ts — zustandsloses, signiertes previewToken** - `1e05c8d` (feat)
2. **Task 2: workPeriodChangeService.ts — ein Vorgang, zwei Ausgänge** - `92ecf34` (feat)

**Plan metadata:** (folgt mit diesem Commit — docs: complete plan)

## Files Created/Modified

- `server/src/services/workTimeChangeToken.ts` - `issuePreviewToken`/`verifyPreviewToken`, `PreviewTokenBinding`, `PreviewTokenVerification`
- `server/src/services/workTimeChangeToken.test.ts` - 13 Tests, alle acht Verhaltensregeln aus dem Plan
- `server/src/services/workPeriodChangeService.ts` - `applyWorkTimeChange`, `WorkTimeChangeValidationError`, interne Hilfsfunktionen (`sumTargetHoursInRange`, `monthsInRange`, `validateInput`, `toGermanDate`, `formatWeeklyHoursDe`, `workScheduleEquals`, `PreviewRollback`)

## Gemessener Befund zum Saldo-Lesepfad

Bestätigt, nicht widerlegt: `getOvertimeBalance()` (`server/src/services/overtimeTransactionService.ts:412-428`) liest ausschließlich

```sql
SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
FROM overtime_balance
WHERE userId = ? AND month <= strftime('%Y-%m', 'now')
```

— eine Aggregattabelle, die von `rebuildOvertimeTransactionsForMonth()` je Monat aus den Tagesberechnungen (Zeiteinträge, Abwesenheiten, Korrekturen) neu geschrieben wird. Diese Abfrage berührt `overtime_transactions` an keiner Stelle. Die von `applyWorkTimeChange()` erzeugte `model_change`-Zeile in `overtime_transactions` fließt also nicht in den von `getOvertimeBalance()` gelesenen Saldo ein — sie kann ihn nicht doppelt zählen, weil sie schlicht nicht gelesen wird. Das ist die geforderte sichtbare Journalzeile (REQ-29) zu einer Verschiebung, die sonst still im aktualisierten `overtime_balance` verschwände.

Das ist ein Code-Lesebefund (Zeile für Zeile nachvollzogen, nicht angenommen), **kein** empirischer Datenbanktest — die zehn Verhaltensregeln aus `<behavior>` inklusive dieser Zusicherung sind laut Plan ausdrücklich Testabdeckung von Plan 12-05, nicht dieses Plans. Kein blockierender Befund für 12-05: Der gemessene Code-Pfad bestätigt exakt die im Plan festgehaltene Erwartung.

## Decisions Made

- `previousWeeklyHours` für die Journalbeschreibung fällt auf `user.weeklyHours` zurück, wenn am Stichtag keine Periode aktiv war (Lücken-Fall) — im Textbuch nicht wörtlich vorgegeben, aber die einzige sinnvolle Deutung von "bisherige Wochenstunden" ohne eine bisherige Periode.
- Bei einer Lücke am Stichtag wird `validTo` der neuen Periode aus der nächsten Periode mit größerem `validFrom` abgeleitet (sonst `null`) — wortgleich zur Plan-Vorgabe.
- Der Trockenlauf überspringt den Schreibpfad auch im `isNoOp`-Fall nicht: Er legt (innerhalb der Klammer, später zurückgerollt) eine Periode mit identischen Werten an, statt einen Sonderfall ohne Schreiben zu bauen — hält D2 strikt ein (keine zweite Rechenbahn für Randfälle).

## Deviations from Plan

None — plan executed exactly as written. Die Acceptance-Criteria (insbesondere die scharfen "genau N"-Grep-Kriterien für `db.transaction(`, `model_change`, `createWorkPeriodContext`) wurden vor dem Commit gemessen und exakt erfüllt; keine nachträgliche Korrektur nötig.

## Beobachtete Altlasten

- `getOvertimeBalance()` filtert `month <= strftime('%Y-%m', 'now')` — `'now'` ist SQLite-UTC, nicht Europe/Berlin. Vorbestehend, außerhalb des Scopes dieses Plans, keine Auswirkung auf `applyWorkTimeChange()`, weil dieser Service dieselbe Funktion unverändert wiederverwendet statt eine eigene Kopie zu bauen.

## UAT-Punkte für Phase 14

1. **Rückwirkender Wechsel auf einer Kopie der Produktionsdatenbank für einen Nutzer mit vielen Zeiteinträgen:** Laufzeit von `applyWorkTimeChange()` mit `dryRun: false` unter 10 Sekunden, Server bleibt während des Laufs antwortfähig (die Transaktionsklammer hält den SQLite-Schreiblock für die volle Dauer des Rebuilds). Zu prüfen mit einem Nutzer mit langer Historie (mehrere Jahre) und einem Stichtag zu Beginn dieser Historie.
2. **Abgebrochener Speichervorgang (Server während des Laufs beendet):** Weder eine neue Periode noch eine `model_change`-Buchung darf danach vorhanden sein. Die einzige Transaktionsklammer (D7, `grep -c "db.transaction("` = 1) ist die technische Grundlage dafür — ein Prozessabbruch mitten in der Klammer lässt SQLite die gesamte Transaktion nicht committen. Manueller Nachweis (z. B. `kill -9` während eines künstlich verlangsamten Rebuilds) ist Sache der Phase-14-Abnahme.
3. **`previewToken` über einen echten Serverneustart hinweg:** Ein vor dem Neustart ausgestelltes, noch nicht abgelaufenes Token muss danach weiterhin gültig verifizieren (Zustandslosigkeit). Mit dem lokalen Dev-Server und `npm run sync-dev-db` nachvollziehbar.
4. **Rundungsverhalten bei `balanceDelta`/`targetHoursDelta` über mehrere Monate:** Die Rundung auf zwei Nachkommastellen läuft je Messlauf einmal am Ende, nicht kumulativ pro Tag — bei sehr langen rückwirkenden Zeiträumen (mehrere Jahre) ist ein Abgleich mit `npm run validate:overtime:detailed` sinnvoll, sobald Plan 12-05 die Route liefert.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `applyWorkTimeChange` und `issuePreviewToken`/`verifyPreviewToken` stehen für Plan 12-05 (Routen: `POST .../preview`, `POST .../change`) mit fertiger Signatur bereit — keine weitere Rechenlogik dort nötig, nur HTTP-Hülle, Rollenprüfung (D6) und Token-Verdrahtung.
- Die zehn Verhaltensregeln aus `<behavior>` dieses Plans (Zukunft/Vergangenheit, isNoOp, monatsmittiger Stichtag, Abbruch mitten im Vorgang usw.) sind für Plan 12-05 als Testfälle vorgesehen — dieser Plan liefert dafür die Funktion, ihre Signatur und die Fehlerklasse, aber keine Integrationstests gegen die echte Datenbank.
- Kein Blocker für die nächste Welle.

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*
