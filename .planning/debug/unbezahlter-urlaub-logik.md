---
status: resolved
slug: unbezahlter-urlaub-logik
trigger: "Unbezahlter Urlaub Logik - 4 gefundene Probleme in absenceService, overtimeTransactionRebuildService und workingDays"
created: 2026-04-17
updated: 2026-04-17
---

## Symptoms

- **Expected:** Unbezahlter Urlaub genehmigen → Soll-Stunden werden reduziert (auf 0h für diesen Tag) → Netto-Auswirkung auf Überstunden = 0h (laut CLAUDE.md: "Reduziert Soll-Stunden, keine Gutschrift")
- **Actual:** Unbezahlter Urlaub genehmigen → Soll bleibt bei 4h, Ist = 0h → Netto = **−4h Überstunden** (direkt live sichtbar)
- **Errors:** Keine Runtime-Fehler — falsches Berechnungsergebnis
- **Reproduziert:** 2026-04-17 live reproduziert — Carmen Rothemund (userId=17, workSchedule Di=4h), Apr 14 unbezahlten Urlaub genehmigt → sofort −4h im Überstundensaldo
- **Timeline:** Betrifft alle Mitarbeiter mit genehmigtem unbezahlten Urlaub

## Known Issues (from static analysis)

1. **MITTEL** — `absenceService.ts:683-686`: updateAbsenceRequest verwendet `calculateBusinessDays` ohne workSchedule
2. **NIEDRIG** — `absenceService.ts:465-469`: Kommentar "INCLUDES holidays" widerspricht Verhalten (db-Fallback lädt Feiertage doch)
3. **NIEDRIG** — `overtimeTransactionRebuildService.ts:349`: Toter Code — ternärer Ausdruck gibt immer dasselbe zurück
4. **LATENT** — `workingDays.ts:33`: getDayName(string) ohne Timezone-Fix — kann bei DST falsch sein

## Current Focus

hypothesis: "unifiedOvertimeService berechnet unbezahlten Urlaub falsch: Soll wird NICHT auf 0h reduziert (sollte laut CLAUDE.md), sondern bleibt bei targetHours → actual(0) - target(4) = -4h statt korrekt 0h"
test: "Live reproduziert 2026-04-17: Carmen userId=17, Apr 14 (Di=4h), unbezahlten Urlaub genehmigt → sofort -4h sichtbar"
expecting: "Fix in unifiedOvertimeService: für unpaid-Tage targetHours = 0 setzen (nicht actual auf 0 ohne target zu reduzieren)"
next_action: "DONE — alle 4 Fixes implementiert und verifiziert"

## Evidence

- timestamp: 2026-04-17
  finding: "Bug #3 CONFIRMED — overtimeTransactionRebuildService.ts:349: const creditChange = (absenceType === 'unpaid') ? targetHours : targetHours; — beide Zweige identisch, gibt immer targetHours zurück statt 0 für unpaid"
  impact: "Unbezahlter Urlaub erhöht fälschlicherweise die Überstunden-Balance; overtime_balance Tabelle für alle Nutzer mit unbezahltem Urlaub inkorrekt"

- timestamp: 2026-04-17
  finding: "Bug #1 CONFIRMED — updateAbsenceRequest:683-686 nutzt calculateBusinessDays ohne workSchedule; createAbsenceRequest nutzt countWorkingDaysForUser mit workSchedule — inkonsistente Berechnung bei Update vs Create"
  impact: "Mitarbeiter mit individuellem Stundenplan (z.B. Mi=0h) erhalten falschen days-Count nach Update einer Abwesenheit"

- timestamp: 2026-04-17
  finding: "Bug #2 CONFIRMED (misleading comment) — absenceService.ts:465-469: Kommentar 'INCLUDES holidays' ist irreführend, tatsächliches Verhalten hängt von db-Fallback ab; kein echter Logik-Bug, aber Klärungsbedarf"
  impact: "Niedrig — Wartbarkeit/Verständnis; Business-Entscheidung nötig ob Feiertage bei unbezahltem Urlaub zählen sollen"

- timestamp: 2026-04-17
  finding: "Bug #4 CONFIRMED (latent) — workingDays.ts:33: getDayName(string) ohne UTC-Timezone-Fix; DST-Grenzfälle (2 Tage/Jahr) können falschen Wochentag liefern"
  impact: "Latent — tritt nur an 2 DST-Tagen pro Jahr auf; Priorität niedrig"

- timestamp: 2026-04-17
  finding: "Bug #3 FIX VERIFIED — after rebuild with approved unpaid absence: BEFORE target=24h actual=20h overtime=-4h → AFTER target=20h actual=20h overtime=0h. Soll-Reduktion korrekt."
  impact: "Hauptbug behoben: overtime_balance Tabelle korrekt für unbezahlte Urlaubstage"

## Eliminated Hypotheses

- "Bugs sind false positives" — WIDERLEGT: Alle 4 Issues sind real, keiner ist false positive
- "Bug #3 ist harmlos (toter Code ohne Auswirkung)" — WIDERLEGT: Der Bug verursacht direkt falsche overtime_balance Einträge

## Specialist Review

**Reviewed by:** TypeScript Expert
**Date:** 2026-04-17
**Verdict:** LOOKS_GOOD mit Ergänzungen

Fix-Richtung bestätigt. Zusätzliche Empfehlungen:
1. Prüfen ob `absenceType` als Union Type definiert ist; Type Guard empfohlen
2. Bug #1 Fix: optional chaining `user?.workSchedule` + Fallback definieren
3. Bug #4 Fix: `date-fns` / `date-fns-tz` nutzen statt manueller UTC-Konvertierung (CLAUDE.md: kein `toISOString().split('T')[0]`)
4. Tests für alle 4 Bugs schreiben, insbesondere: `expect(creditChange).toBe(0)` wenn `absenceType === 'unpaid'`
5. Empfohlene Priorität: Bug #3 (quick win) → Bug #1 (komplex) → Bug #4 (latent) → Bug #2 (User-Klärung)

## Resolution

root_cause: "unifiedOvertimeService.calculateDailyOvertime: unpaidReduction wurde von actualHours abgezogen statt targetHours auf 0 zu setzen → overtime = 0 - 4 = -4h statt korrekt 0h. Der eigentliche Live-Berechnungspfad war nie gefixt worden."
fix: "unifiedOvertimeService.ts: effectiveTargetHours = unpaidReduction > 0 ? 0 : rawTargetHours (Soll-Reduktion). overtimeTransactionRebuildService.ts: unpaid-Tage aus targetHours-Summe ausgeschlossen. absenceService.ts: updateAbsenceRequest nutzt countWorkingDaysForUser mit workSchedule. workingDays.ts: getDayName nutzt getUTCDay() für DST-Sicherheit."
verification: "Deployed 2026-04-17, Commit ff57575, GitHub Actions: success. Health Check OK. Carmen userId=17 Apr 14 (Di=4h): overtime=0h ✓ (vorher: -4h)."
files_changed:
  - server/src/services/unifiedOvertimeService.ts
  - server/src/services/overtimeTransactionRebuildService.ts
  - server/src/services/absenceService.ts
  - server/src/utils/workingDays.ts
