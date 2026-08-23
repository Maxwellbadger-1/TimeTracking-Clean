---
phase: 14-absicherung-und-auslieferung
plan: 07
subsystem: database
tags: [sqlite, better-sqlite3, backfill, overtime-transactions, phase-9.1, req-33, d2, d3, d5]

# Dependency graph
requires:
  - phase: 14-absicherung-und-auslieferung
    provides: "14-04 (server/database/14-produktionskopie.db + Rohkennzahlen, asOf 2026-08-21), 14-05 (applyModelChange.ts als Muster für Zwei-Stufen-Werkzeuge, 14-generalprobe.db mit einer model_change-Buchung)"
provides:
  - "14-URTEIL-PHASE-9.1.md — begründetes Urteil in drei Teilen mit am Quelltext nachgeschlagenen Zeilenbelegen, plus vollständiges Probelaufprotokoll gegen eine Produktionskopie"
  - "server/src/scripts/backfillOvertimeJournal.ts — Zwei-Stufen-Backfill der unvollständigen Monatsenden, ohne eigene Schreiblogik, mit --apply / --allow-production / --userId / --maxMonths / --all-months"
  - "server/src/scripts/backfillOvertimeJournal.test.ts — 20 Tests der Findelogik und Argumentauswertung, ohne Datenbankzugriff"
  - "Gemessene Entscheidungsgrundlage für Plan 14-10: Teilaufbau (40 Monate) vs. Vollaufbau (100 Monate), je mit Wirkung auf den sichtbaren Saldo"
affects: [14-10, 09.1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Findelogik als reine Funktion mit den gelesenen Daten als Parameter (findIncompleteMonths), DB-Zugriff ausschließlich in main() — dieselbe Trennung wie parseArgs/assertExpectationsMatch in applyModelChange.ts"
    - "Mutationsprobe als Ersatz für eine nicht mehr herstellbare RED-Phase: vier Wächter einzeln entfernt, jede Mutation muss Tests rot machen"
    - "Plausibilitäts-Gegenprobe gegen eine bekannte Beispielliste ist kein Ritual — jeder Ausreißer wird einzeln am Bestand geprüft, statt ihn mit 'der Bestand hat sich geändert' abzutun"
    - "Ein Nachweis-grep darf nicht von seiner eigenen Dokumentation unterlaufen werden: die gesuchten SQL-Literale stehen deshalb nirgends im Kopfkommentar"

key-files:
  created:
    - server/src/scripts/backfillOvertimeJournal.ts
    - server/src/scripts/backfillOvertimeJournal.test.ts
    - .planning/phases/14-absicherung-und-auslieferung/14-URTEIL-PHASE-9.1.md
    - .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-BF-VORHER.json
    - .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-BF-VORHER.users.json
    - .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-BF-NACHHER.json
    - .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-BF-NACHHER.users.json
  modified:
    - server/package.json
    - .planning/ROADMAP.md

key-decisions:
  - "Urteil zu Phase 9.1: aufgeteilt — der Journal-Backfill läuft im Produktionsfenster der Phase 14 mit (Plan 14-10), die Code-Härtung WR-02 bis WR-05 bleibt in Phase 9.1. WR-07 ist bereits über Plan 14-02 geschlossen."
  - "Begründung 3 des Planners zu Teil 1 ('der Backfill schreibt ausschließlich in overtime_transactions und kann die D5-Zahlen nicht bewegen') am Quelltext widerlegt und ersetzt: rebuildOvertimeTransactionsForMonth schreibt über STEP 7 auch overtime_balance, und snapshotBalances.ts liest daraus. Teil 2 (Backfill strikt nach der Verifikation) wird dadurch von einer Vorsichtsmaßnahme zur zwingenden Anordnung."
  - "Findelogik gegenüber <behavior> korrigiert: maßgeblich ist der letzte Tag mit Sollstunden ODER Zeiteintrag ODER genehmigter Abwesenheit, nicht nur mit Sollstunden. Die Planregel übersah zwei Nutzer mit echten, nicht gebuchten Arbeitsstunden."
  - "Kein Beschnitt der Suche auf endDate innerhalb des Austrittsmonats — rebuildOvertimeTransactionsForMonth kennt endDate nicht und schreibt bis zum Monatsende; ein Beschnitt hier hätte eine Lücke unentdeckt gelassen. Ganze Monate nach dem Austritt bleiben ausgeschlossen."
  - "Neuer Schalter --all-months (Vorgabe: aus) statt einer stillen Änderung der Vorgabe — welcher Weg in Produktion gefahren wird, ist nach D2 eine Entscheidung des Anwenders und gehört in Plan 14-10."
  - "Plan 14-10 als blockiert gemeldet: der Backfill bewegt den für Mitarbeiter sichtbaren Saldo um bis zu 84 Stunden, und der dort vorgesehene Teilaufbau ist der messbar schlechtere der beiden Wege."

patterns-established:
  - "Bei einer widerlegten Plan-Annahme gilt der Befund: Annahme im Dokument wörtlich zitieren, widerlegen, Urteil neu begründen — statt den Text durchzuwinken oder still umzuschreiben"
  - "Wirkungsnachweis immer als Paar: 'kein Unterschied in X' ist nur zusammen mit 'nachweislicher Unterschied in Y' aussagekräftig"

requirements-completed: [REQ-33]

# Metrics
duration: ~35min
completed: 2026-08-23
---

# Phase 14 Plan 07: Urteil zu Phase 9.1, Backfill-Werkzeug und Probelauf Summary

**Das Urteil zu Phase 9.1 steht als eigenes, an jeder Stelle am Quelltext belegtes Dokument (Backfill kommt ins Fenster, aber strikt nach der Verifikation; Code-Härtung bleibt), das Zwei-Stufen-Werkzeug `backfillOvertimeJournal.ts` ist gebaut und mit 20 Tests abgesichert — und der Probelauf gegen eine Produktionskopie hat zwei Annahmen des Plans widerlegt: die Findelogik übersah zwei Nutzer mit echten nicht gebuchten Arbeitsstunden, und der D5-Diff ist nicht leer, weil der Backfill über `overtime_balance` den für Mitarbeiter sichtbaren Saldo bewegt. Plan 14-10 ist deshalb blockiert.**

## Vorgefundener Stand

Ein vorheriger Lauf war durch ein Sitzungslimit mitten in diesem Plan abgebrochen. Im
Arbeitsbaum lag untracked `server/src/scripts/backfillOvertimeJournal.ts` (589 Zeilen).

Abgleich gegen die Tasks des Plans, am Dateiinhalt und am Git-Stand geprüft:

| Task | Vorgefunden | Bewertung |
|------|-------------|-----------|
| 1 — Urteil + ROADMAP | nichts | offen: kein `14-URTEIL-PHASE-9.1.md`, `grep "14-URTEIL-PHASE-9" .planning/ROADMAP.md` ohne Treffer |
| 2 — Werkzeug | Skript vorhanden und **vollständig** | Test-Datei fehlte, `package.json`-Eintrag fehlte |
| 3 — Probelauf | nichts | offen: keine Probekopie, keine Snapshots |

Das Skript war **nicht** mitten im Schreiben abgebrochen: Es endete mit dem vollständigen
`isMainModule`-Wächter, alle sieben Ablaufschritte waren vorhanden, und jedes importierte
Symbol wurde einzeln am Quelltext bestätigt (`getUserByIdIncludingDeleted:327`,
`getDailyTargetHours:176`, `createWorkPeriodContext:58`, `getTodayString:40`,
`rebuildOvertimeTransactionsForMonth:78`, `assertNotProduction:42`). `npx tsc --noEmit` lief
darüber mit Exit 0.

Nichts davon wurde neu gebaut. Ergänzt wurden die fehlenden Teile, korrigiert wurde nur, was
sich im Probelauf als falsch erwies.

## Was gemacht wurde

### Task 1 — Urteil (Commit `ff85a99`)

`14-URTEIL-PHASE-9.1.md` mit den sechs geforderten Gliederungspunkten. Jeder Codebeleg wurde
selbst nachgeschlagen; die Zeilennummern im Dokument sind die tatsächlich vorgefundenen.

ROADMAP: Absatz „Einordnung nach Plan 14-07" im Abschnitt der Phase 9.1 und die
Fortschrittstabellenzeile auf „Aufgeteilt (Plan 14-07)" umgestellt. `git diff --stat` zeigte
ausschließlich diese beiden Stellen (9 Zeilen hinzugefügt, 1 ersetzt).

### Task 2 — Werkzeug (Commit `d610b66`)

`backfillOvertimeJournal.test.ts` mit zunächst 18, am Ende 20 Tests; `package.json`-Eintrag
`backfill:overtime-journal`; Aufräumung eines doppelten Casts im übernommenen Stand.

### Task 3 — Probelauf (Commit `f995afe`)

Probekopie `14-backfill-probe.db` aus `14-produktionskopie.db` (2671 Journalzeilen, Summe
−372,68 — deckungsgleich mit `14-MIGRATIONSSTAND.md`), migriert bis
`015_unique_reversal_of_index`. Danach Snapshot VORHER, Trockenlauf, Schreiblauf, Snapshot
NACHHER, Diff, Gegenproben, Kettenprüfung. Vollständiges Protokoll in Abschnitt 7 von
`14-URTEIL-PHASE-9.1.md`.

## Das Urteil zu Phase 9.1

**Aufgeteilt.**

1. **Der Backfill läuft im Produktionsfenster der Phase 14 mit** — dieselbe Sicherung, dasselbe
   Risikofenster, dieselbe Freigabe; und er wird durch das Deployment aus Plan 14-08 überhaupt
   erst möglich, weil der Monatsend-Fix (`overtimeTransactionRebuildService.ts:104-106`) sonst
   nicht auf dem Server liegt.
2. **Aber strikt NACH der Verifikation aus Plan 14-09**, als eigens freigegebener Schritt
   (Plan 14-10). Er bewegt `overtime_transactions` (Kontoauszug, `getOvertimeBalanceAtDate`
   `:549-562`) **und** `overtime_balance` (Saldo, `getOvertimeBalance` `:454-479`) — also genau
   die Größen, über die diese Verifikation urteilt.
3. **Die Code-Härtung WR-02 bis WR-05 bleibt in Phase 9.1.** WR-07 hat Plan 14-02 bereits
   geschlossen; der ROADMAP-Eintrag führte ihn noch als offen.

Ausnahme, die Plan 14-08 übernimmt: die Aufrufreihenfolge von `fix-overtime.ts` im
Deploy-Workflow.

## Ergebnis der Backfill-Probe auf der Produktionskopie

| Schritt | Ergebnis |
|---------|----------|
| Probekopie + Migration | Exit 0, `integrity_check` ok, `--expect-migration=015_…` erfüllt (Negativprobe mit erfundener Migration → Exit 1) |
| Trockenlauf | 12 Nutzer, 40 Monate, 5 soft-gelöschte übersprungen; `COUNT`/`SUM`/`overtime_balance` vor und nach identisch |
| Schreiblauf | Exit 0, `COUNT` +308, `integrity_check` ok |
| `model_change` unverändert | ja — auf dieser Kopie 0→0 (inhaltsleer), deshalb zusätzlich auf einer Kopie von `14-generalprobe.db` belegt: Buchung `id 33626` überstand einen Vollaufbau ihres eigenen Monats unverändert |
| Wirkungsnachweis | `getOvertimeBalanceAtDate` bewegt sich bei userId 22 um **+3,00** und bei 29 um **+2,00** — auf die Stunde die gefundenen fehlenden Einträge |
| **Diff der `*.users.json`** | **NICHT leer: 164 Zeilen** |
| Kettenprüfung | Exit 0, keine Befunde |

## Deviations from Plan

### [Rule 1 – Bug] Findelogik übersah Nutzer mit `weeklyHours = 0`

- **Gefunden bei:** Task 3, durch die im Plan vorgesehene Plausibilitäts-Gegenprobe gegen die
  ROADMAP-Beispiel-IDs (3, 15, 17, 21, 22, 29). Die erste Fundliste enthielt nur 3, 17 und 21.
- **Befund:** userId 22 und 29 sind Aushilfen mit `weeklyHours = 0` und haben deshalb an
  **keinem** Tag Sollstunden — der „letzte Tag mit Sollstunden" aus `<behavior>` ist für sie
  immer `null`. Beide haben aber am 31.07.2026 einen echten Zeiteintrag über 3,0 bzw. 2,0
  Stunden **ohne** zugehörige Journalzeile: genau den Off-by-one, den dieser Plan finden soll.
  userId 15 ist soft-gelöscht und damit regelkonform übersprungen.
- **Fix:** Maßgeblich ist jetzt der letzte Tag mit Sollstunden **ODER** Zeiteintrag **ODER**
  genehmigter Abwesenheit (`MonthCandidate.lastRelevantDay`). Vor der Umstellung wurden alle
  drei denkbaren Regeln gemessen: 32 (Planregel) / 40 (umgesetzt) / 100 (Rebuild 1:1
  gespiegelt) Monate. Die umgesetzte ist echte Obermenge der Planregel — kein zuvor gefundener
  Monat fällt weg.
- **Dateien:** `server/src/scripts/backfillOvertimeJournal.ts`,
  `server/src/scripts/backfillOvertimeJournal.test.ts` (Regressionstest ergänzt)
- **Commit:** `f995afe`

### [Rule 2 – fehlende kritische Funktionalität] Schalter `--all-months`

- **Gefunden bei:** Task 3, bei der Auswertung des nicht leeren Diffs.
- **Befund:** Ein Teilaufbau mischt zwei Rechenstände im Aggregat `overtime_balance`. Gegen den
  kanonischen Rechenweg gemessen rückten 2 Nutzer näher heran und **3 weiter weg** (userId 18:
  16 h Abweichung vorher, 44 h nachher). Nach einem Vollaufbau aller 100 Monate stimmen
  dagegen **13 von 15** aktiven Nutzern exakt mit dem kanonischen Weg überein (vorher 7), und
  **kein** Nutzer steht schlechter als zuvor.
- **Fix:** Schalter `--all-months`, Vorgabe **aus**. Die Vorgabe wurde bewusst nicht geändert —
  die Wahl gehört nach D2 dem Anwender und wird in Plan 14-10 getroffen.
- **Commit:** `f995afe`

### [Rule 1 – Bug] Doppelter Cast im übernommenen Skript

- `computeLastWorkday()` nahm einen `UserForBackfill` entgegen und reichte ihn per
  `as unknown as {…}` an `getDailyTargetHours()` weiter, obwohl dieser Typ `weeklyHours` und
  `workSchedule` gar nicht trägt. Zur Laufzeit folgenlos (die Funktion liest seit REQ-23 nur
  `id` und `hireDate`), aber eine unbelegte Zusicherung gegen `.claude/CLAUDE.md`. Jetzt nimmt
  der Helfer den echten `TargetHoursUser` (reiner Typ-Import). **Commit:** `d610b66`

### [Dokumentation] Nachweis-grep wurde von seiner eigenen Dokumentation unterlaufen

- Das Abnahmekriterium „`grep "DELETE FROM overtime_transactions\|INSERT INTO
  overtime_transactions"` liefert keinen Treffer" schlug an, weil der Kopfkommentar diese
  Literale ausschrieb, um zu erklären, dass es sie nicht gibt. Kommentar umformuliert; der
  grep ist jetzt aussagekräftig. **Commit:** `d610b66`

### [TDD] RED-Phase nicht herstellbar

Das Skript lag aus dem abgebrochenen Vorlauf bereits vollständig vor. Ersatzweise vier
Mutationsproben: Wächter für den laufenden Monat, `hireDate`-Filter, `endDate`-Filter und
`deletedAt`-Wächter je einzeln entfernt — jede Mutation machte Tests rot (3/1/1/1), das
Original danach wieder vollständig grün. Die Tests haben nachweislich Zähne.

## Threat Flags

Keine neue Angriffsfläche. `T-14-34` (Schutz der `model_change`-Buchungen) wurde gegenüber dem
Plan **verschärft** nachgewiesen, weil die vorgesehene Prüfung auf der Probekopie mangels
`model_change`-Zeilen inhaltsleer gewesen wäre.

## Known Stubs

Keine.

## Blocker für Plan 14-10

**Plan 14-10 darf auf dieser Beweislage nicht ohne Entscheidung des Anwenders gegen die
Produktion laufen.**

1. Der Backfill bewegt den Saldo, den der Mitarbeiter sieht — auf der Produktionskopie bei
   8 von 20 Nutzern, im Einzelfall um bis zu 84 Stunden. Das ist keine unsichtbare
   Journalpflege.
2. Der in 14-10 vorgesehene Teilaufbau ist der messbar schlechtere der beiden Wege.

Zur Wahl stehen, jeweils mit gemessener Wirkung: **(a)** Teilaufbau (40 Monate, +308 Zeilen;
2 Nutzer besser, 3 schlechter), **(b)** Vollaufbau `--all-months` (100 Monate, +995 Zeilen;
13 von 15 deckungsgleich, keiner schlechter), **(c)** Verschieben. Einzelheiten in Abschnitt 8
von `14-URTEIL-PHASE-9.1.md`.

Unberührt davon bleibt: Der Backfill läuft in jedem Fall erst **nach** der Verifikation aus
Plan 14-09.

## Gates

| Gate | Ergebnis |
|------|----------|
| `cd server && npx tsc --noEmit` | Exit 0 |
| `cd desktop && npx tsc --noEmit` | Exit 0 |
| `cd desktop && npm run check:rules` | Exit 0 — 19 Tests bestanden |
| `cd server && npx vitest run` | `3 failed, 527 passed (530)` — die drei vorbestehenden, namentlich bestätigt (`unifiedOvertimeService.test.ts:285`, `:340`, `vacationBackfillService.test.ts:138`). Menge nicht gewachsen. |
| `DATABASE_PATH=./database/14-backfill-probe.db npm run check:period-chains` | Exit 0 |

## Harte Grenzen eingehalten

Kein `git push`, kein `gh release`, keine SSH-Verbindung zu 129.159.8.19, kein Zugriff auf
`/home/ubuntu/databases/production.db`, kein Aufruf mit `--allow-production`.
`14-produktionskopie.db` und `14-generalprobe.db` wurden ausschließlich `readonly` geöffnet.
`DATABASE_PATH` war in jedem Skriptaufruf explizit gesetzt; `server/database.db` (Altbestand)
wurde nicht angefasst. Nach 14-07 wird angehalten — 14-08 bis 14-11 bleiben gesperrt.

## Self-Check: PASSED

Alle 7 im Frontmatter unter `key-files.created` genannten Dateien existieren; die drei
Commit-Hashes `ff85a99`, `d610b66` und `f995afe` sind in `git log` vorhanden; der
ROADMAP-Verweis auf `14-URTEIL-PHASE-9.1.md`, der neue Tabellenstatus „Aufgeteilt (Plan
14-07)", der `package.json`-Eintrag `backfill:overtime-journal` und der Schalter
`--all-months` sind je durch `grep` bestätigt; der Diff der beiden `*.users.json` liefert
erneut 164 Zeilen.
