---
phase: 10-perioden-fundament
plan: 05
subsystem: database
tags: [sqlite, better-sqlite3, cli, production-guard, verification]

# Dependency graph
requires:
  - phase: 10-perioden-fundament
    plan: 02
    provides: productionGuard.ts (assertNotProduction), applyMigrationsToCopy.ts (npm run migrate:copy)
  - phase: 10-perioden-fundament
    plan: 03
    provides: Migration 009 (Bestandsüberführung user_work_periods)
provides:
  - snapshotBalances.ts / npm run snapshot:balances — wiederverwendbares Salden-Snapshot-Werkzeug (ein Nutzer, Liste, alle) für Phase 11 und Phase 14
  - 10-NULLWIRKUNG-NACHWEIS.md — Byte-für-Byte-Nachweis der Nullwirkung auf einer Kopie der Produktionsdaten
  - Erfolgskriterien 1–4 der ROADMAP für Phase 10, mit wörtlicher Ausgabe belegt
affects: [phase-11-datumsabhaengige-berechnung, phase-14-produktionslauf]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard-vor-Import (assertNotProduction() synchron, erst danach await import() für connection.js/unifiedOvertimeService.js), wörtlich aus dem Muster von compareOvertimePaths.ts/productionGuard.ts übernommen"
    - "Ungefilterte --all-Population (kein WHERE deletedAt IS NULL), mit Selbstprüfung: Zeilenzahl users (ungefiltert) muss der Länge des users-Arrays im Snapshot entsprechen"
    - "Zweite Ausgabedatei *.users.json enthält ausschließlich das vergleichsrelevante users-Array — generatedAt/databasePath variieren zwangsläufig zwischen Läufen und dürfen den Byte-Vergleich nicht stören"
    - "Empirische Nebenwirkungsfreiheit vor dem eigentlichen Vergleich: zwei Läufe gegen dieselbe unmigrierte Kopie müssen zuerst byte-identisch sein, bevor der Vorher/Nachher-Vergleich über die Migration hinweg zählt"

key-files:
  created:
    - server/src/scripts/snapshotBalances.ts
    - .planning/phases/10-perioden-fundament/10-NULLWIRKUNG-NACHWEIS.md
    - .planning/phases/10-perioden-fundament/10-SNAPSHOT-VORHER.json
    - .planning/phases/10-perioden-fundament/10-SNAPSHOT-VORHER.users.json
    - .planning/phases/10-perioden-fundament/10-SNAPSHOT-NACHHER.json
    - .planning/phases/10-perioden-fundament/10-SNAPSHOT-NACHHER.users.json
  modified:
    - server/package.json

key-decisions:
  - "Der kanonische Überstunden-Lesepfad (unifiedOvertimeService.calculatePeriodOvertime) löst soft-gelöschte Nutzer nicht auf (getUser() filtert WHERE deletedAt IS NULL) und wirft 'User <id> not found'. snapshotBalances.ts fängt das je Nutzer ab und hält die Fehlermeldung wörtlich in overtimeError fest, statt den ganzen Lauf abzubrechen — die Stammdaten der beiden betroffenen Nutzer (userId 15, 26) bleiben trotzdem vollständiger Teil der Population (Zeilenzahl-Abgleich besteht). Das ist eine bereits vor Phase 10 bestehende Eigenschaft des Lesepfads, kein neuer Fund."
  - "server/database/development.db hatte Migration 008/009 zum Zeitpunkt dieses Plans bereits über den lokalen Dev-Server angewendet (dieselbe Konstellation wie in 10-02-SUMMARY.md dokumentiert). Eine reine VACUUM-INTO-Kopie hätte migrate:copy deshalb zu einem Leerlauf gemacht (0 neu angewendete Migrationen, keine Protokollzeilen von Migration 009). Die private Kopie 10-nullwirkung.db wurde deshalb vor Schritt 2 auf den Vor-008-Stand zurückgesetzt (DROP TABLE user_work_periods, DELETE FROM migrations WHERE name IN (008,009)) — analog zur Zusatzverifikation aus Plan 10-02. Betrifft ausschließlich die private, nicht committete Kopie."

requirements-completed: [REQ-21, REQ-20]

# Metrics
duration: ~50min
completed: 2026-08-22
---

# Phase 10 Plan 05: Salden-Snapshot-Werkzeug und Nullwirkungs-Nachweis Summary

**`snapshotBalances.ts` erhebt den Saldenstand eines, mehrerer oder aller Nutzer ausschließlich über den nebenwirkungsfreien `unifiedOvertimeService`-Lesepfad (grep-bestätigt kein INSERT/UPDATE/DELETE) und liest `--all` ungefiltert inklusive soft-gelöschter Nutzer; der Nullwirkungs-Nachweis auf einer Kopie der Produktionsdaten zeigt zwei byte-identische `.users.json`-Dateien vor und nach dem Durchlauf von Migration 008/009, während `user_work_periods` von 0 auf 20 Zeilen wächst.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2/2
- **Files modified:** 7 (6 neu, 1 geändert)

## Accomplishments

- `snapshotBalances.ts` (`npm run snapshot:balances`) erhebt je Nutzer: Stammdaten
  (`hireDate`, `endDate`, `status`, `deletedAt`, `weeklyHours`, `workSchedule` als Rohtext),
  Überstunden über `unifiedOvertimeService.calculatePeriodOvertime(userId, hireDate, asOf)`
  (`targetHours`, `actualHours`, `overtime`, vollständiger `breakdown`, ohne `dailyResults`),
  alle `overtime_balance`-Zeilen sortiert nach Monat, und je Urlaubsjahr die
  `vacation_balance`-Zeile plus die Journalsumme aus `vacation_transactions`.
- `--all` liest `SELECT id FROM users` ungefiltert (kein `WHERE deletedAt IS NULL`) — die
  Population umfasst beide soft-gelöschten Nutzer der Datenbank (`userId` 15, 26). Ein
  eingebautes Abnahmekriterium vergleicht die ungefilterte Zeilenzahl von `users` mit der
  Länge des erhobenen `users`-Arrays und wirft bei Abweichung.
- `DATABASE_PATH` ist Pflicht (Exit 2 ohne, real getestet), `--asOf=<YYYY-MM-DD>` ist Pflicht
  (kein Rückfall auf „heute", real getestet), `assertNotProduction()` läuft synchron vor
  jedem `await import()` eines schreibenden Moduls. Der Kanarienpfad
  `/home/ubuntu/databases/production.db` bricht mit Exit 2 ab, ohne dass ein Verzeichnis
  angelegt wird — real gemessen vor und nach dem Aufruf.
- Zweite Ausgabedatei `*.users.json` enthält ausschließlich das vergleichsrelevante
  `users`-Array (ohne `generatedAt`/`databasePath`, die zwischen Läufen zwangsläufig
  variieren) — die eigentliche Vergleichsgrundlage für den Byte-Vergleich.
- `grep -c "getUserOvertimeReport\|getOvertimeSummary\|ensureOvertimeBalanceEntries"
  server/src/scripts/snapshotBalances.ts` → `0`. `grep -cE "INSERT|UPDATE|DELETE"
  server/src/services/unifiedOvertimeService.ts` → `0` (Bestätigung, nicht Vertrauen —
  Zero-Hallucination-Policy).
- Nullwirkungs-Nachweis (`10-NULLWIRKUNG-NACHWEIS.md`): Snapshot A und die Eigenprobe A′ (vor
  jeder Migration) sind byte-identisch (Nebenwirkungsfreiheit des Werkzeugs zuerst empirisch
  belegt, wie von der Aufgabe verlangt). Nach dem Durchlauf von Migration 008/009 auf einer
  `VACUUM INTO`-Kopie von `development.db` (`integrity_check: ok`, `foreign_key_check: leer`,
  20 neu eingefügte Perioden, alle Quelle `hireDate`) ist Snapshot B byte-identisch zu
  Snapshot A — trotz `user_work_periods` 0 → 20 Zeilen. Alle vier ROADMAP-Erfolgskriterien
  sind mit wörtlicher Ausgabe belegt (Tabelle im Nachweisdokument).

## Task Commits

Each task was committed atomically:

1. **Task 1: snapshotBalances.ts — Salden festhalten, ohne etwas anzufassen** - `0b3f7aa` (feat)
2. **Task 2: Nullwirkungs-Nachweis auf einer Kopie der Produktionsdaten** - `aca2213` (test)

## Files Created/Modified

- `server/src/scripts/snapshotBalances.ts` - CLI: `--all`/`--user=<id>`/`--users=<id,id,...>`,
  `--asOf` Pflicht, `--json` Pflicht, `DATABASE_PATH` Pflicht, Guard-vor-Import,
  Selbstprüfung Zeilenzahl, `*.users.json` als Vergleichsdatei
- `server/package.json` - Eintrag `"snapshot:balances": "tsx src/scripts/snapshotBalances.ts"`
- `.planning/phases/10-perioden-fundament/10-NULLWIRKUNG-NACHWEIS.md` - sieben Schritte mit
  wörtlichem Befehl und Ausgabe, Erfolgskriterien-Tabelle, Abschnitt „Was dieser Nachweis
  NICHT zeigt"
- `.planning/phases/10-perioden-fundament/10-SNAPSHOT-VORHER.json` /
  `10-SNAPSHOT-VORHER.users.json` - Messpunkt vor der Migration (20 Nutzer,
  `user_work_periods: 0`)
- `.planning/phases/10-perioden-fundament/10-SNAPSHOT-NACHHER.json` /
  `10-SNAPSHOT-NACHHER.users.json` - Messpunkt nach der Migration (20 Nutzer,
  `user_work_periods: 20`), `.users.json` byte-identisch zur Vorher-Datei

## Kurzfassung des Nullwirkungs-Nachweises

- **Byte-Vergleich:** `cmp 10-SNAPSHOT-VORHER.users.json 10-SNAPSHOT-NACHHER.users.json` →
  `IDENTISCH` (beide Dateien 44785 Bytes, 1966 Zeilen, 20 Nutzer).
- **`integrity_check`:** `ok` (Migrationslauf, Schritt 4).
- **Überführte Nutzer:** 20 von 20, alle mit Quelle `hireDate` in der `note`-Spalte
  (`[MIGRATION-009] Bestandsüberführung, Quelle: hireDate`) — kein Nutzer löste den
  Ersatzdatum-Zweig (D5) auf diesem Datenstand aus.
- **Liste der Nutzer mit Ersatzdatum (D5):** keine — deckt sich mit dem in
  `10-03-SUMMARY.md` dokumentierten Befund, dass der Ersatzdatum-Zweig auf dem aktuellen
  Produktionsbestand voraussichtlich nie betreten wird.
- **Abgewiesener Überlappungsversuch (Erfolgskriterium 3, echte Daten):** `userId=1`,
  bestehende Periode `validFrom=2025-11-13`. Versuchter `INSERT` mit
  `validFrom='2026-06-01'` wurde abgewiesen mit:
  `user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blockierendes Problem] `development.db` hatte Migration 008/009 bereits
angewendet — Kopie musste vor dem Nachweis auf den Vor-008-Stand zurückgesetzt werden**
- **Found during:** Task 2, Vorbereitung von Schritt 1 (Kopie ziehen)
- **Issue:** `server/database/development.db` (Quelle der `VACUUM INTO`-Kopie) hatte
  Migration `008_create_user_work_periods` und `009_backfill_user_work_periods` bereits
  angewendet — der lokale Dev-Server wendet neue Migrationsdateien bei jedem Start
  automatisch an, und die parallel gelaufenen Pläne 10-01/10-03 haben diese Migrationen
  bereits vor diesem Plan zusammengeführt (identische Konstellation wie in
  `10-02-SUMMARY.md` dokumentiert). Ohne Gegenmaßnahme hätte `npm run migrate:copy` in
  Schritt 4 nichts Neues angewendet (`runMigrations()` überspringt bereits in der
  `migrations`-Tabelle verzeichnete Namen vollständig, `migrationRunner.ts:44-46`) — die
  vom Plan geforderten Protokollzeilen der Migration 009 wären nicht entstanden, und
  Schritt 6 hätte zwei Snapshots gegen denselben, bereits migrierten Zustand verglichen
  statt einen echten Vorher/Nachher-Vergleich zu liefern.
- **Fix:** Die private Kopie `server/database/10-nullwirkung.db` wurde vor Schritt 2 auf
  den Stand vor Migration 008 zurückgesetzt (`DROP TABLE user_work_periods`,
  `DELETE FROM migrations WHERE name IN ('008_create_user_work_periods',
  '009_backfill_user_work_periods')`) — analog zur bereits in Plan 10-02 dokumentierten
  Zusatzverifikation. Betrifft ausschließlich die private, nicht committete Kopie; die
  geteilte Arbeitsdatenbank `development.db` blieb unangetastet.
- **Files modified:** keine Produktionsdatei — nur die lokale, gitignorete Kopie
  `server/database/10-nullwirkung.db` (nicht committet, nach Abschluss gelöscht).
- **Verification:** Schritt 4 zeigt `Neu angewendete Migrationen (2):
  008_create_user_work_periods, 009_backfill_user_work_periods` mit den geforderten
  Protokollzeilen; `user_work_periods` wuchs zwischen Snapshot A (0 Zeilen) und
  Snapshot B (20 Zeilen) tatsächlich — ein echter Vorher/Nachher-Vergleich.
- **Committed in:** `aca2213` (Task 2 commit, im Nachweisdokument selbst als eigener
  Abschnitt „Befund vor Schritt 1" dokumentiert, nicht verschwiegen)

**2. [Rule 2 - fehlende kritische Funktionalität] Behandlung soft-gelöschter Nutzer im
Überstunden-Lesepfad**
- **Found during:** Task 1, erster Probelauf gegen `development.db`
- **Issue:** `unifiedOvertimeService.calculatePeriodOvertime()` ruft intern `getUser()` auf,
  das mit `WHERE id = ? AND deletedAt IS NULL` filtert. Für die zwei soft-gelöschten Nutzer
  der Datenbank (`userId` 15, 26) wirft der Aufruf deshalb `User <id> not found` — ohne
  Abfangen hätte `--all` beim ersten soft-gelöschten Nutzer mit einem unbehandelten Fehler
  abgebrochen und damit den in D5/Task 1 geforderten Nachweis für die volle Population
  verhindert.
- **Fix:** `collectUser()` fängt den Fehler je Nutzer ab, setzt `overtimePeriod: null` und
  hält die Fehlermeldung wörtlich in `overtimeError` fest. Die Stammdaten (aus einer
  eigenen, ungefilterten Abfrage) bleiben für diese Nutzer vollständig Teil des Snapshots.
- **Files modified:** `server/src/scripts/snapshotBalances.ts`
- **Verification:** `--all`-Lauf gegen `development.db` erhebt 20/20 Nutzer (Zeilenzahl-
  Abgleich besteht), `userId` 15 und 26 zeigen `overtimePeriod: null,
  overtimeError: "User 15 not found"` bzw. `"User 26 not found"` in beiden Snapshot-Dateien
  konsistent.
- **Committed in:** `0b3f7aa` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blockierendes Problem an der Datengrundlage, 1 fehlende
Fehlerbehandlung für einen bereits vor Phase 10 bestehenden Lesepfad-Fall). Keines davon
ändert Produktionscode oder die Migration selbst — beide Fixes betreffen ausschließlich das
neue Snapshot-Werkzeug bzw. die private Verifikationskopie.
**Impact on plan:** Ohne beide Fixes wäre der Nullwirkungs-Nachweis entweder unvollständig
(soft-gelöschte Nutzer fehlen) oder trivial (kein echter Vorher/Nachher-Unterschied) gewesen —
beide Korrekturen waren notwendig, damit der Nachweis das leistet, was D6 verlangt.

## Verifikation

- `cd server && npx tsc --noEmit` — grün, keine Fehler.
- `cd server && npx vitest run` — 299/302 grün, dieselben drei vorbestehenden Fehlschläge wie
  in allen vorherigen Plänen dieser Phase (`unifiedOvertimeService.test.ts`: zwei
  Hire-Date-Regressionstests, `vacationBackfillService.test.ts`: ein Backfill-Erkennungstest)
  — keine der drei Dateien von diesem Plan berührt.
- `cd server && npx vitest run src/database/ src/services/workPeriodService.test.ts` —
  81/81 grün.
- Byte-Vergleich `10-SNAPSHOT-VORHER.users.json` vs. `10-SNAPSHOT-NACHHER.users.json` →
  `IDENTISCH`.
- `PRAGMA integrity_check` der migrierten Kopie → `ok` (wörtlich zitiert in
  `10-NULLWIRKUNG-NACHWEIS.md`, Schritt 4).
- `grep -ciE "firstName|lastName|email|@"` auf beiden Snapshot-Dateien → `0`.
- `git status` zeigt keine `*.db`-Datei als zu committen (geprüft vor jedem Commit).

## Issues Encountered

- `git status` zeigte während der Ausführung eine parallel neu angelegte
  `.planning/phases/11-datumsabh-ngige-berechnung/11-01-PLAN.md` bzw. `11-02-PLAN.md`
  (paralleler Planer für Phase 11) — gemäß Anweisung unberührt gelassen, ausschließlich
  eigene Dateien einzeln gestaged und committet.

## User Setup Required

None — keine externe Service-Konfiguration erforderlich. `npm run snapshot:balances` ist ab
sofort für Phase 11 (Salden-Vergleich vor/nach Umbau) und Phase 14 (Generalprobe gegen eine
frische Produktionskopie) nutzbar. Die private Verifikationskopie
`server/database/10-nullwirkung.db` wurde nach Abschluss gelöscht (war ohnehin gitignored).

## Next Phase Readiness

- Alle vier ROADMAP-Erfolgskriterien der Phase 10 sind mit wörtlicher Ausgabe belegt
  (Tabelle in `10-NULLWIRKUNG-NACHWEIS.md`).
- Das Snapshot-Werkzeug deckt einen Nutzer, eine Liste und alle Nutzer ab (D6) und ist
  bereit für Phase 11 (Vergleich vor/nach dem Umbau des Rechenwerks) und Phase 14
  (Generalprobe gegen eine frische Produktionskopie).
- Bekannter, dokumentierter Fund für Phase 11: Der kanonische Überstunden-Lesepfad löst
  soft-gelöschte Nutzer nicht auf (`getUser()`-Filter). Falls Phase 11 diesen Lesepfad
  umbaut, ist zu prüfen, ob dieses Verhalten für soft-gelöschte Nutzer weiterhin gewollt
  ist — hier nur festgehalten, nicht verändert (out of scope für Phase 10, REQ-21).
- Kein `git push`, kein Deployment ausgeführt — Produktionslauf bleibt Phase 14 vorbehalten.

---
*Phase: 10-perioden-fundament*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle fünf referenzierten Dateien (`server/src/scripts/snapshotBalances.ts`,
`10-NULLWIRKUNG-NACHWEIS.md`, `10-SNAPSHOT-VORHER.json`, `10-SNAPSHOT-NACHHER.json`, dieses
SUMMARY) sowie beide Commit-Hashes (`0b3f7aa`, `aca2213`) wurden gegen das Dateisystem bzw.
`git log --oneline --all` verifiziert und gefunden. Keine fehlenden Artefakte.
