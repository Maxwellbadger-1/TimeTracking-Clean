---
phase: 11-datumsabh-ngige-berechnung
plan: 11
subsystem: scripts
tags: [user-work-periods, seed-scripts, create-admin, production-guard, ensureInitialWorkPeriod]

# Dependency graph
requires:
  - phase: 11-datumsabh-ngige-berechnung
    provides: "ensureInitialWorkPeriod(user, createdBy?) aus userService.ts (Plan 11-03), D4 harter Fehler bei fehlender Periode (Plan 11-04)"
provides:
  - "Alle acht Skripte, die Nutzer per direktem INSERT INTO users anlegen, legen danach auch die Startperiode an — kein Nutzer im Projekt entsteht mehr ohne Periode"
  - "11-AUFRUFER-TEIL-11.md — Teilbeleg für die Zusammenführung in 11-AUFRUFER-CHECKLISTE.md durch Plan 11-09"
affects: [11-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Produktionsschutz (assertNotProduction()) synchron vor jedem dynamischen import(), der transitiv die Datenbank öffnet — sieben src/scripts/-Dateien hatten das vorher gar nicht (Rule 2, T-11-45)"
    - "ESM top-level await statt async-main()-Wrapper für den dynamischen Importblock — kleinstmögliche, mechanisch wiederholbare Änderung in sieben strukturell ähnlichen Skripten"
    - "server/scripts/*.ts (außerhalb des tsc-Umfangs) importiert aus der kompilierten dist/-Ausgabe, Muster aus fix-overtime.ts"

key-files:
  created:
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-11.md
  modified:
    - server/src/scripts/seedTestData.ts
    - server/src/scripts/seedTestUsers.ts
    - server/src/scripts/createCompleteTestUser.ts
    - server/src/scripts/createEnhancedTestUser.ts
    - server/src/scripts/createNewEmployeeTestUser.ts
    - server/src/scripts/createOneTestUser.ts
    - server/src/scripts/createSuperTestUser.ts
    - server/scripts/create-admin.ts

key-decisions:
  - "Statische `import { db } from '../database/connection.js'` in allen sieben src/scripts/-Dateien auf dynamischen import() nach assertNotProduction() umgestellt statt nur den neuen userService-Import dynamisch zu machen — ES-Module-Imports werden vor jedem Modul-Code ausgeführt, ein Guard NACH einer statischen db-Import-Zeile wäre wirkungslos gewesen, weil die Datenbank zu dem Zeitpunkt bereits offen ist"
  - "create-admin.ts von einer eigenen `new Database('server/database.db')`-Instanz auf die geteilte Verbindung aus dist/database/connection.js umgestellt (Rule 3, blockierend) — das Skript ignorierte DATABASE_PATH vollständig und hätte den geforderten Probelauf gegen eine Wegwerfkopie unmöglich gemacht"
  - "In seedTestUsers.ts ensureInitialWorkPeriod() auch im UPDATE-Zweig von upsertUser() ergänzt (Sicherheitsnetz für Alt-Fälle), nicht nur im Create-Zweig — deckt Nutzer ab, die vor Migration 009/Plan 11-03 entstanden sind und beim erneuten Seed-Lauf aktualisiert statt neu angelegt werden"

patterns-established:
  - "Skripte außerhalb des tsc-Umfangs (server/scripts/) werden von Hand vollständig gelesen und mit einem echten Probelauf gegen eine Wegwerfkopie belegt, nicht nur per grep überflogen"

requirements-completed: [REQ-23]

# Metrics
duration: 105min
completed: 2026-08-22
---

# Phase 11 Plan 11: Startperiode für die acht Nutzer-Anlagestellen außerhalb userService Summary

**Alle acht Skripte, die Nutzer per direktem `INSERT INTO users` an `userService.createUser()` vorbei anlegen, rufen jetzt nach jeder Anlagestelle `ensureInitialWorkPeriod()` auf — kein Nutzer im Projekt entsteht mehr ohne Arbeitszeitperiode, D4s harter Fehler kann keinen dieser acht Wege mehr treffen.**

## Performance

- **Duration:** ~105 min
- **Tasks:** 3
- **Files modified:** 8 (7 unter `server/src/scripts/`, 1 unter `server/scripts/`)
- **Files created:** 1 (Teilbeleg)

## Accomplishments

- Sieben Skripte unter `server/src/scripts/` rufen `ensureInitialWorkPeriod()` nach jeder
  Anlagestelle auf; kein zweiter Schreibweg für Perioden (`grep -rn "INSERT INTO
  user_work_periods" server/src/scripts server/scripts` → keine Zeile)
- `server/scripts/create-admin.ts` — die eine Stelle außerhalb des `tsc`-Umfangs — von Hand
  gefunden, geändert und mit einem echten Probelauf gegen `11-werkzeugprobe.db` belegt
- Rule 2 (Nebenbefund, T-11-45): Keinem der sieben `src/scripts/`-Skripte fehlte nur die
  Periode, allen fehlte auch jeder Produktionsschutz — `assertNotProduction()` ergänzt, dafür
  die db-Imports auf dynamisch umgestellt (ESM top-level await)
- Rule 3 (blockierender Fund): `create-admin.ts` ignorierte `DATABASE_PATH` vollständig
  (fest verdrahteter Pfad `server/database.db`) — auf die geteilte, DATABASE_PATH-bewusste
  Verbindung aus `dist/database/connection.js` umgestellt (Muster `fix-overtime.ts`)
- Rule 1 (Bugfund im Probelauf): drei Testnutzer in `seedTestUsers.ts` hatten unvollständige
  `workSchedule`-Objekte (nur Arbeitstage gesetzt) — brach an der neuen
  Perioden-Selbstverifikation (`parseWorkSchedule`) ab; mit allen sieben Wochentagsschlüsseln
  ergänzt, fachlich unverändert
- Rule 1 (Bugfund im Probelauf): `logger.error({ error }, ...)` in `seedTestUsers.ts`
  serialisierte zu `{}` (pinos Standard-Serializer greift nur bei `err`) und verschluckte die
  Fehlermeldung, die genau den obigen Bug diagnostizierbar gemacht hätte — auf `{ err: error
  }` korrigiert
- Drei echte Probeläufe gegen `server/database/11-werkzeugprobe.db` protokolliert
  (`create-admin.ts`, `npm run seed:test-users`, `npm run seed-test-data`); `checkPeriodChain`
  liefert für alle 14 dabei betroffenen Nutzer `ok: true`
- `server/database/11-nullwirkung.db` nachweislich unverändert (Dateizeitstempel identisch
  vor und nach allen Probeläufen dieses Plans)

## Task Commits

Each task was committed atomically:

1. **Task 1: Sieben Skripte unter src/scripts** - `cab4d39` (feat)
2. **Task 2: create-admin.ts** - `4972d18` (feat)
3. **Rule-1-Bugfix (gefunden während Task 3):** `5194982` (fix)
4. **Task 3: Probelauf und Teilbeleg** - `448f4ab` (docs)

## Files Created/Modified

- `server/src/scripts/seedTestData.ts` - `ensureInitialWorkPeriod()` in der `createUser()`-Helper-Funktion (greift für David/Emma/Frank), `assertNotProduction()` + dynamischer Importblock ergänzt
- `server/src/scripts/seedTestUsers.ts` - `ensureInitialWorkPeriod()` in `upsertUser()` (Create- und Update-Zweig), `assertNotProduction()` + dynamischer Importblock ergänzt, drei unvollständige `workSchedule`-Objekte vervollständigt, `logger.error`-Schlüssel korrigiert
- `server/src/scripts/createCompleteTestUser.ts`, `createEnhancedTestUser.ts`, `createNewEmployeeTestUser.ts`, `createSuperTestUser.ts` - je `ensureInitialWorkPeriod()` nach dem `db.transaction()`-Commit (Nutzer über `getUserById()` geladen), `assertNotProduction()` + dynamischer Importblock
- `server/src/scripts/createOneTestUser.ts` - `ensureInitialWorkPeriod()` direkt nach der Anlage, `assertNotProduction()` + dynamischer Importblock
- `server/scripts/create-admin.ts` - `ensureInitialWorkPeriod()` über `dist/services/userService.js`, Datenbankverbindung von fest verdrahtetem Pfad auf `dist/database/connection.js` (respektiert `DATABASE_PATH`) umgestellt
- `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-11.md` - Teilbeleg mit acht Fundstellen und Probelauf-Protokoll

## Decisions Made

Siehe `key-decisions` im Frontmatter — statische db-Imports auf dynamisch umgestellt (nicht
nur der neue userService-Import), `create-admin.ts` auf geteilte Verbindung umgestellt,
Sicherheitsnetz auch im Update-Zweig von `seedTestUsers.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Fehlende kritische Funktionalität] Produktionsschutz fehlte in allen sieben `src/scripts/`-Dateien vollständig**
- **Found during:** Task 1, `read_first`-Schritt (grep nach `assertNotProduction`)
- **Issue:** Keines der sieben Skripte rief `assertNotProduction()` auf; alle importierten `db` statisch am Dateikopf, wodurch die Datenbank bereits vor jeder denkbaren Prüfung offen gewesen wäre (T-11-45)
- **Fix:** `assertNotProduction()` synchron zuerst, `db`/`userService`/`overtimeService` danach per `await import()` (ESM top-level await, tsx-kompatibel) — Muster aus `snapshotBalances.ts`
- **Files modified:** alle sieben Dateien aus Task 1
- **Verification:** `grep -n "assertNotProduction\|await import"` je Datei, siehe Teilbeleg
- **Committed in:** `cab4d39`

**2. [Rule 3 - Blockierender Fund] create-admin.ts ignorierte DATABASE_PATH vollständig**
- **Found during:** Task 2, `read_first`-Schritt (vollständiges Lesen der Datei)
- **Issue:** `new Database('server/database.db')` fest verdrahtet — der vom Plan geforderte Probelauf mit `DATABASE_PATH=./database/11-werkzeugprobe.db` wäre wirkungslos gewesen und hätte stattdessen `server/database.db` (laut `.continue-here.md` eine tote Altlast) beschrieben
- **Fix:** Ersetzt durch die geteilte Verbindung aus `dist/database/connection.js`, die `databaseConfig.path` (und damit `DATABASE_PATH`) respektiert — Muster aus `fix-overtime.ts`
- **Files modified:** `server/scripts/create-admin.ts`
- **Verification:** Probelauf mit gesetztem `DATABASE_PATH` schrieb nachweislich in `11-werkzeugprobe.db`, nicht in `server/database.db`
- **Committed in:** `4972d18`

**3. [Rule 1 - Bug] Unvollständige workSchedule-Objekte in seedTestUsers.ts**
- **Found during:** Task 3, erster Probelauf von `npm run seed:test-users` (ROLLBACK)
- **Issue:** `workPeriodService.ts:parseWorkSchedule` verlangt beim Lesen einer Periode alle sieben Wochentagsschlüssel. Drei Testnutzer (Christine, ein Mo-Do-10h-Nutzer, ein Sa+So-Nutzer) hatten nur die Arbeitstage gesetzt — unschädlich, solange niemand diesen Wert durch die Perioden-Validierung schickte. `ensureInitialWorkPeriod()` (Task 1 dieses Plans) deckte das beim ersten Lauf auf
- **Fix:** Fehlende Wochentage explizit auf 0 ergänzt, fachlich unverändert
- **Files modified:** `server/src/scripts/seedTestUsers.ts`
- **Verification:** Zweiter Probelauf lief durch (exit 0), 10 Nutzer mit je genau einer Periode, `checkPeriodChain` ok:true für alle
- **Committed in:** `5194982`

**4. [Rule 1 - Bug] Verschluckter Fehler in seedTestUsers.ts**
- **Found during:** Task 3, Diagnose des obigen Rollbacks
- **Issue:** `logger.error({ error }, ...)` statt `{ err: error }` — pinos Standard-Serializer greift nur beim Schlüssel `err` (Konvention wie in `userService.ts`), das Fehlerobjekt serialisierte zu `{}` ohne Message oder Stack
- **Fix:** Schlüssel auf `err` korrigiert
- **Files modified:** `server/src/scripts/seedTestUsers.ts`
- **Verification:** Zweiter Diagnoselauf zeigte die vollständige Fehlermeldung inkl. Stack, die zu Fund 3 führte
- **Committed in:** `5194982`

---

**Total deviations:** 4 auto-fixed (2× Rule 1, 1× Rule 2, 1× Rule 3)
**Impact on plan:** Kein Scope Creep — alle vier Funde entstanden direkt aus den Änderungen dieses Plans (fehlender Schutz in genau den Dateien, die dieser Plan ohnehin ändert; blockierender Fund beim Probelauf, den der Plan selbst verlangt; Bugs, die erst durch `ensureInitialWorkPeriod()` erreichbar wurden). Kein Fund außerhalb der acht Plan-Dateien wurde angefasst.

## Issues Encountered

- Interaktive Eingabe an `create-admin.ts` (Node `readline.question()`) verliert Zeilen, wenn
  alle Antworten in einem Rutsch per Pipe ankommen, bevor die jeweils nächste `question()`
  ihren Listener registriert hat — gelöst durch zeitversetzte Eingabe (`sleep` zwischen den
  Zeilen in einer Subshell-Pipe statt `printf ... |`)
- Ein erster Probelauf-Versuch hing fest (Prozess wartete auf eine sechste, nicht gesendete
  Antwort — `create-admin.ts` fragt bei bereits vorhandenem Admin zusätzlich „Überschreiben?
  (ja/nein)"; `development.db`, aus der die Wegwerfkopie gezogen wurde, hat bereits einen
  echten Admin). Prozess über `Stop-Process` beendet, Wegwerfkopie neu gezogen, sechste
  Antwort (`ja`) ergänzt

## User Setup Required

None - keine externe Konfiguration nötig.

## Next Phase Readiness

- REQ-23 (Teilaspekt „alle direkten `INSERT INTO users`-Stellen") erfüllt: kein Skript im
  Projekt legt mehr einen Nutzer ohne Periode an
- Plan 11-09 (sequenzielle Zusammenführung der Aufrufer-Teilbelege, Welle 4) kann
  `11-AUFRUFER-TEIL-11.md` direkt übernehmen
- Kein Blocker für 11-09 aus diesem Plan
- Bekannt, unverändert übergeben: `server/database/11-werkzeugprobe.db` trägt jetzt
  zusätzliche Testnutzer aus den Probeläufen dieses Plans (werkzeugprobe-admin, die 10
  seed:test-users-Nutzer, david/emma/frank_test) — Wegwerfkopie, keine Auswirkung auf
  `11-nullwirkung.db` oder Produktion

---
*Phase: 11-datumsabh-ngige-berechnung*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle acht geänderten/geprüften Dateien und der Teilbeleg existieren. Alle vier genannten
Commit-Hashes (`cab4d39`, `4972d18`, `5194982`, `448f4ab`) gefunden in `git log --oneline
--all`.
