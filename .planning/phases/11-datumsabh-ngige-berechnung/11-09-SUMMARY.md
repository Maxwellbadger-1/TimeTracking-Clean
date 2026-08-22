---
phase: 11-datumsabh-ngige-berechnung
plan: 09
subsystem: testing
tags: [overtime, work-periods, sqlite, better-sqlite3, tsx, verification]

# Dependency graph
requires:
  - phase: 11-datumsabh-ngige-berechnung (Pläne 11-01 bis 11-08, 11-11)
    provides: periodenbewusste Sollstunden-Berechnung, WorkPeriodContext, Aufrufer-Teilbelege der Welle 3
provides:
  - vollständige, zusammengeführte Aufrufer-Checkliste (11-AUFRUFER-CHECKLISTE.md) mit erschöpfender Nachsuche, sechs bewerteten Neufunden, Rückwärtsabgleich gegen alle 24 Fundstellen aus Phase 9
  - schriftliche Desktop-Disposition mit gemessenem Wirksamkeitsfenster (11-DESKTOP-DISPOSITION.md), Übergabe an Phase 12 in ROADMAP.md verankert
  - wiederverwendbares Fixture-Skript für Nutzer mit echtem Modellwechsel (seedModelChangeUser.ts), von Plan 11-10 weiterverwendbar
  - REQ-24-Idempotenznachweis auf echten Daten (11-IDEMPOTENZ-NACHWEIS.md), inkl. Gegenprobe unwirksamer Modellwechsel
affects: [11-10-perioden-nullwirkung, 12-stundenwechsel-bedienen, 14-absicherung-auslieferung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture-Skripte für periodenbewusste Nutzer: createUser() legt Startperiode automatisch an, closeWorkPeriod()+createWorkPeriod() bilden den Zweischritt für einen Stichtagswechsel — kein zweiter Schreibweg"
    - "Erschöpfende Nachsuche statt geerbter Liste: fünf Suchgruppen (Funktionsnamen, flache Formel, Feldzugriffe, SELECT FROM users, Gegenprobe-Kontext) statt Abgleich gegen eine vorgegebene Fundstellen-Liste"

key-files:
  created:
    - server/src/scripts/seedModelChangeUser.ts
    - .planning/phases/11-datumsabh-ngige-berechnung/11-DESKTOP-DISPOSITION.md
    - .planning/phases/11-datumsabh-ngige-berechnung/11-IDEMPOTENZ-NACHWEIS.md
  modified:
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md
    - .planning/ROADMAP.md
    - server/package.json

key-decisions:
  - "Desktop wird in Phase 11 nicht nachgezogen (Abhängigkeitskonflikt: fehlende Perioden-Lese-API) — Wirksamkeitsfenster mit drei Messzahlen (alle 0) statt behauptet"
  - "Sechs Neufunde aus der erschöpfenden Nachsuche (drei tote Funktionen in workingDays.ts, timeEntryService.updateOvertimeBalance, verifyTestData.ts, check_overtime.ts) sind alle Produktivpfad=nein — kein blockierender Befund, für Phase 14 als Aufräumkandidaten vermerkt"
  - "Stichtag 2026-05-14 fällt auf Christi Himmelfahrt (Feiertag) — Gegenprobe verwendet deshalb 2026-05-13/2026-05-15 statt des Stichtags selbst, um den Modellwechsel unvermischt vom Feiertagseffekt zu zeigen"
  - "index.ts-Re-Export von timeUtils.ts wurde zu einer Checklisten-Zeile zusammengeführt (5→4 Desktop-Zeilen), passend zu den vier im Plan einzeln benannten Desktop-Dateien"

requirements-completed: [REQ-23, REQ-24]

# Metrics
duration: 60min
completed: 2026-08-22
---

# Phase 11 Plan 09: Vollständigkeits- und Idempotenz-Nachweis Summary

**Erschöpfende Nachsuche über fünf Suchgruppen bestätigt Vollständigkeit der Sollstunden-Umstellung (24/24 Phase-9-Fundstellen wiedergefunden, 6 harmlose Neufunde), Desktop-Disposition mit gemessenem Wirksamkeitsfenster (3 Messzahlen = 0), und REQ-24 auf echten Daten belegt (zweifacher Rebuild über einen künstlichen Modellwechsel mitten im Monat, byte-identisch).**

## Performance

- **Duration:** ca. 60 min
- **Completed:** 2026-08-22
- **Tasks:** 3
- **Files modified:** 6 (3 neu, 3 geändert)

## Accomplishments

- Die fünf Teilbelege der Welle 3 (11-AUFRUFER-TEIL-05 bis -08, -11) in `11-AUFRUFER-CHECKLISTE.md` zusammengeführt und um eine echte, unabhängige Nachsuche ergänzt (nicht bloß ein Abhaken der geerbten Liste)
- Sechs Neufunde aus der Nachsuche identifiziert, bewertet und dispositioniert — keiner im Produktivpfad, aber alle einzeln benannt statt stillschweigend übergangen (drei tote Funktionen `calculateDailyTargetHours`/`calculateMonthlyTargetHours`/`calculateTargetHoursUntilToday` in `workingDays.ts`, ein toter `updateOvertimeBalance()` in `timeEntryService.ts` mit fachlich falscher `weeklyHours/7`-Formel, `verifyTestData.ts`, `check_overtime.ts`)
- Alle 24 Fundstellen aus `09-INVENTAR-SOLLSTUNDEN.md` rückwärts abgeglichen (der Plan nannte „23" — Abweichung dokumentiert statt geglättet)
- Desktop-Disposition mit zwei Begründungen belegt: struktureller Abhängigkeitskonflikt (fehlende Perioden-Lese-API, existiert erst Phase 12) und gemessenes Wirksamkeitsfenster (Nutzer mit >1 Periode: 0, Drift Stammdaten/offene Periode: 0, Nutzer ohne offene Periode: 0 — alle drei gegen `11-nullwirkung.db`)
- `AbsenceRequestForm.tsx` gegen den echten Code geprüft: `requiredHours` wird im Request-Payload nicht mitgesendet, der Server rechnet beim Speichern neu — kein Persistenzrisiko durch den veralteten Client-Wert
- `seedModelChangeUser.ts` als wiederverwendbares Fixture erstellt: legt einen Nutzer mit echtem Modellwechsel (40h→20h, Stichtag mitten im Monat) an, verweigert nachweislich den Lauf gegen `11-nullwirkung.db`, ist idempotent (zweiter Lauf legt keinen zweiten Nutzer an)
- REQ-24 auf echten Daten bewiesen: zweifacher `rebuildOvertimeTransactionsForMonth()`-Lauf für Stichtagsmonat, Vormonat und Folgemonat liefert byte-identische Ergebnisse (kanonisch sortiertes JSON, `id`/`createdAt` bewusst ausgeklammert)
- Gegenprobe bestanden: Sollstunden vor (8h) und nach (4h) dem Stichtag sind nachweislich verschieden — der Idempotenzvergleich prüft einen wirksamen Modellwechsel, kein Nullresultat
- `npx tsc --noEmit` fehlerfrei (Rotphase seit Plan 11-04 beendet), Testsuite exakt bei den drei vorbestehend roten Tests (370/373), keine Regression

## Task Commits

1. **Task 1: Erschöpfende Nachsuche und Zusammenführung der Aufrufer-Checkliste** - `1866c76` (docs)
2. **Task 2: Desktop-Disposition entscheiden und festschreiben** - `95883c8` (docs)
3. **Task 3: REQ-24 auf echten Daten — zweifacher Rebuild über einen Modellwechsel, plus Gesamtgrün** - `9bc38b3` (feat)

**Plan metadata:** wird mit diesem Commit erstellt (docs: complete plan)

## Files Created/Modified

- `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md` - zusammengeführte, vollständige Aufrufer-Checkliste mit erschöpfender Nachsuche, Neufunden und Rückwärtsabgleich
- `.planning/phases/11-datumsabh-ngige-berechnung/11-DESKTOP-DISPOSITION.md` - Desktop-Disposition mit Abhängigkeitskonflikt, gemessenem Wirksamkeitsfenster, Einzelbewertung der vier Dateien
- `.planning/phases/11-datumsabh-ngige-berechnung/11-IDEMPOTENZ-NACHWEIS.md` - neun Schritte REQ-24-Nachweis mit wörtlichen Befehlen/Ausgaben, Urteilstabelle, „Was dieser Nachweis NICHT zeigt"
- `server/src/scripts/seedModelChangeUser.ts` - wiederverwendbares Fixture-Skript für einen Nutzer mit echtem Modellwechsel
- `.planning/ROADMAP.md` - Phase-12-Abschnitt um Desktop-Übergabepunkt ergänzt (nur innerhalb des Abschnitts)
- `server/package.json` - npm-Skript `seed:model-change` ergänzt

## Decisions Made

- Desktop-Nachzug bewusst an Phase 12 verschoben, mit gemessenem statt behauptetem Wirksamkeitsfenster (siehe key-decisions oben)
- Sechs Neufunde alle als „kein blockierender Befund" eingestuft (Produktivpfad=nein, mit Beleg), aber einzeln dokumentiert statt in eine Sammelzeile verdichtet
- Gegenprobe in Schritt 7 des Idempotenznachweises bewusst gegen die Tage unmittelbar vor/nach dem Stichtag geführt (nicht gegen den Stichtag selbst), weil dieser zufällig auf einen Feiertag fällt

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bugfix am eigenen Dokument] Verify-Skript aus Task 1 zählte Kopfabschnitt- und Rückwärtsabgleich-Tabellen fälschlich als Fundstellen-Datenzeilen**
- **Found during:** Task 1, erster Lauf des Prüfbefehls
- **Issue:** Der im Plan vorgegebene Prüfbefehl zählt jede Zeile, die mit `|` beginnt, als Datenzeile — meine ursprüngliche Kopfabschnitt-Tabelle und die Rückwärtsabgleich-Tabelle (Markdown-Tabellen ohne die Ausschlussbegriffe „Fundstelle"/„Disposition") wurden mitgezählt und verfälschten die Kennzahlen (60/43/17 statt tatsächlich 55/42/13)
- **Fix:** Kopfabschnitt und Rückwärtsabgleich von Tabellen- auf Fließtext-/Listenformat umgestellt, damit sie nicht als Fundstellen-Datenzeilen erkannt werden; Kennzahlen im Kopfabschnitt auf die tatsächlich gemessenen Werte (55 Zeilen gesamt, 42 `[x]`, 13 `[n/a]`) korrigiert
- **Files modified:** `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md`
- **Verification:** Prüfbefehl aus dem Plan liefert nach der Korrektur exakt `Datenzeilen: 55 davon Desktop: 4 ohne Haken/Disposition: 0`, Exit 0
- **Committed in:** `1866c76` (Task 1 commit)

**2. [Rule 1 - Bugfix am eigenen Skript] Grep-Kommandotext in zwei Neufund-Zeilen enthielt selbst die Zeichenkette „desktop/" und verfälschte die Desktop-Zählung**
- **Found during:** Task 1, Prüfbefehl-Verifikation
- **Issue:** Zwei Neufund-Zeilen zitierten wörtlich einen `grep`-Befehl mit dem Pfad `../desktop/src` — der Prüfbefehl zählt jede Fundstellen-Zeile mit der Zeichenkette „desktop/" als Desktop-Zeile, wodurch die gemessene Desktop-Anzahl (6 statt der im Plan erwarteten 4) nicht mit der Erwartung übereinstimmte
- **Fix:** Pfadangabe in den beiden Neufund-Zeilen durch die neutrale Bezeichnung „[Desktop-Quellbaum]" ersetzt
- **Files modified:** `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md`
- **Verification:** Prüfbefehl liefert danach exakt „davon Desktop: 4" wie im Plan gefordert
- **Committed in:** `1866c76` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (beide Rule 1, Selbstkorrektur der eigenen Dokumente gegen die vom Plan vorgegebenen Prüfbefehle)
**Impact on plan:** Beide Korrekturen betreffen ausschließlich die Formatierung/Zählbarkeit der Checkliste selbst, nicht die fachliche Aussage. Kein Scope Creep.

## Issues Encountered

- Der gewählte Stichtag (2026-05-14) fiel zufällig auf einen Feiertag (Christi Himmelfahrt), wodurch die naheliegendste Gegenprobe (Stichtag selbst) `0h` statt der erwarteten `4h` lieferte. Kein Fehler des Skripts oder der Berechnung — `getDailyTargetHours()` prüft laut kanonischer Reihenfolge den Feiertag zuerst, das überschreibt jedes Modell. Gelöst durch Verwendung der Tage unmittelbar vor/nach dem Stichtag für die Gegenprobe, mit dem Feiertagsbefund als dokumentierter Nebenbefund im Nachweis festgehalten.

## User Setup Required

None - keine externe Service-Konfiguration nötig.

## Next Phase Readiness

- Plan 11-10 kann `seedModelChangeUser.ts` unverändert für den Wirkungsnachweis weiterverwenden (D6)
- `11-nullwirkung.db` ist über den gesamten Plan hinweg nachweislich unverändert geblieben — Snapshot A für Plan 11-10 ist intakt
- Phase 12 hat einen konkreten, dreiteiligen Übergabepunkt in der ROADMAP mit Verweis auf die Desktop-Disposition
- Kein blockierender Befund aus diesem Plan — Phase 11 kann nach Plan 11-10 als vollständig gelten

---
*Phase: 11-datumsabh-ngige-berechnung*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle sieben referenzierten Dateien gefunden (seedModelChangeUser.ts, 11-DESKTOP-DISPOSITION.md,
11-IDEMPOTENZ-NACHWEIS.md, 11-AUFRUFER-CHECKLISTE.md, 11-09-SUMMARY.md, server/package.json,
.planning/ROADMAP.md). Alle drei Task-Commit-Hashes (`1866c76`, `95883c8`, `9bc38b3`) im
Git-Log bestätigt.
