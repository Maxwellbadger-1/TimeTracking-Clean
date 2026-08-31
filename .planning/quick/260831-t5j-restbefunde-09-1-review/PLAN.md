---
quick_id: 260831-t5j
slug: restbefunde-09-1-review
type: quick
created: 2026-08-31
source: .planning/phases/09.1-journal-backfill-und-betriebs-h-rtung/09.1-REVIEW.md
findings: [CR-02, CR-04, WR-02, WR-03, WR-05, WR-07, WR-14]
autonomous: true
---

# Quick Task 260831-t5j: sieben Restbefunde aus 09.1-REVIEW.md

## Ziel

Die sieben Befunde mit nachweisbarer Folge aus `09.1-REVIEW.md` beheben. Je Befund ein
unvermischter Commit. **Nicht pushen.**

## Harte Randbedingungen

1. **KEIN `git push`.** Ein Push nach `main` mit Änderungen unter `server/**` löst
   `deploy-server.yml` aus, startet PM2 neu, wechselt die PID — und setzt damit die laufende
   D-17-Beobachtung (Plan 09.1-08, Befund D) zum dritten Mal zurück. Der Push erfolgt erst
   nach der Messung am 01.09.2026 und ist nicht Teil dieser Aufgabe.
2. **Kein Serverzugriff.** Kein `ssh`, kein `gh workflow run`, kein `crontab`, kein Zugriff
   auf `production.db` — weder lesend noch schreibend.
3. **Baseline der Testsuite:** 591 grün / 4 rot. Die vier roten stammen aus der geteilten
   `server/database/development.db` und sind nicht zu beheben. Jeder NEUE rote Test ist ein
   Fehler dieser Aufgabe.

## Auflösung eines scheinbaren Widerspruchs (vor Task 6 lesen)

CR-02 verlangt, `db.close()` zu **entfernen**; WR-07 schlägt vor, `db.close()` zu **ergänzen**.
Das ist kein Widerspruch, sondern kontextabhängig:

- `fixOvertime.ts` (CR-02) läuft **neben** einem aktiven Serverprozess auf derselben Datei.
  Ein `sqlite3_close` räumt dort WAL/SHM ab und hängt die WAL des Servers ab. → kein Close.
- `migrate.ts` / `seed.ts` (WR-07) laufen im Deploy seit CR-03 **hinter `pm2 stop`**, also
  ohne konkurrierenden Serverprozess. Ein sauberes Close ist dort richtig.

Diese Unterscheidung ist in beiden Dateien als Kommentar festzuhalten, damit sie nicht beim
nächsten Aufräumen wieder eingeebnet wird.

## Tasks

### Task 1 — WR-05: Signalbehandler an den Anfang des Startfensters
`server/src/server.ts` (Registrierung derzeit `:329-331`, ungeschützt `:212-258`)

`process.on('SIGTERM'/'SIGINT')` wird erst am Ende von `startServer()` registriert. Alles davor
— `seedDatabase()`, `runMigrations(db)`, `resetStaleChainGuardSuspension()`,
`initializeHolidays()` (Netzabruf, Sekunden) — läuft ohne Behandler. Ein SIGTERM in diesem
Fenster tötet den Prozess ohne `shutdownDatabase()` und ohne `wal_checkpoint(TRUNCATE)`.

Handler an den Anfang von `startServer()` ziehen, `httpServer` optional halten,
Doppelauslösung sperren, und im `catch`-Pfad `shutdownDatabase()` vor `process.exit(1)` rufen.
Vorlage in `09.1-REVIEW.md` unter WR-05. Bestehendes Shutdown-Verhalten (Log-Zeilen,
Reihenfolge) nicht verändern, nur früher verfügbar machen.

**Abnahme:** `npx tsc --noEmit` sauber; `grep -n "process.on('SIGTERM'" server/src/server.ts`
zeigt die Registrierung vor dem ersten `await` des Startpfads.

### Task 2 — CR-02: `db.close()` aus `fixOvertime.ts` entfernen
`server/src/scripts/fixOvertime.ts:163-167`

`finally { db.close(); }` ersatzlos streichen und durch den Begründungskommentar aus
`09.1-REVIEW.md` ersetzen. Beim harten `process.exit()` läuft `sqlite3_close` nicht — die
Dateizeiger eines gleichzeitig laufenden Servers bleiben intakt. `shutdownDatabase()` wäre
hier ebenso falsch.

**Abnahme:** `grep -n "db.close()" server/src/scripts/fixOvertime.ts` → kein Treffer;
`npx tsc --noEmit` sauber.

### Task 3 — WR-14: `SESSION_SECRET` nicht kürzen, nicht stillschweigend neu erzeugen
`.github/workflows/deploy-server.yml` (~`:150-156`), `.github/workflows/deploy-staging.yml` (~`:141-147`)

`cut -d= -f2` → `cut -d= -f2-` (sonst wird jedes Secret am ersten `=` abgeschnitten).
Fehlt die Zeile in `.env`, das erzeugte Secret **zurückschreiben** und eine Warnung ausgeben —
sonst werden bei jedem Deployment alle Sitzungen ungültig, ohne erkennbare Ursache im Log.

**Abnahme:** beide Dateien enthalten `cut -d= -f2-` und ein `>> .env` im Erzeugungszweig;
YAML lädt fehlerfrei (`node -e` mit `js-yaml`, kein `python3` auf diesem Rechner).

### Task 4 — CR-04: `sync-db.ts` — richtige Quelle, Sicherung mit Uhrzeit
`server/src/scripts/sync-db.ts:25,33,47,54,99`

`syncLocal()` nimmt `databaseConfig.productionPath` = `server/database.db` — der unmigrierte
Altbestand vom April (kein Symlink mehr seit 20.08.2026). Quelle auf eine explizit gesetzte
Umgebungsvariable umstellen, ohne stillen Rückfall (Abbruch mit Exitcode, wenn nicht gesetzt).
Sicherungsname mit Uhrzeit statt nur Datum, und Abbruch, wenn die Zieldatei schon existiert —
sonst zerstört ein zweiter Lauf am selben Tag die einzige gute Kopie.

**Abnahme:** zweimaliger Trockenlauf am selben Tag überschreibt keine Sicherung; ohne gesetzte
Quellvariable bricht das Skript mit Exitcode ab und legt keine Datei an.

### Task 5 — WR-02: falscher Schlüsselname in `sync-db.ts`
`server/src/scripts/sync-db.ts:24,87-91`

`ORACLE_KEY_PATH` zeigt auf `.ssh/oracle_key`; im Projekt existiert ausschließlich
`.ssh/oracle_server.key`. `db:sync:remote` ist damit funktionsloser Code.

Entscheide begründet zwischen Korrektur des Pfades und Streichen von `db:sync:remote`
zugunsten des in `.claude/CLAUDE.md` als kanonisch benannten `scripts/sync-dev-db.sh`.
Die Begründung gehört in die SUMMARY.

**Abnahme:** kein Verweis auf `.ssh/oracle_key` mehr im Repo; `npm run` listet keinen
Skripteintrag, der auf einen nicht existierenden Pfad zeigt.

### Task 6 — WR-07: Fehlerobjekt ausgeben, Close-Verhalten vereinheitlichen
`server/src/scripts/migrate.ts:160-166`, `server/src/scripts/seed.ts:183-189`

`error` wird nie ausgegeben — Fehler aus `initMigrationsTable()` und `getAppliedMigrations()`
(etwa `SQLITE_BUSY`) verschwinden spurlos, genau im Deploy-Protokoll, wo man sie braucht.
Zusätzlich beendet `process.exit(1)` im `try` den Prozess, bevor `finally { db.close() }`
läuft — Erfolgs- und Fehlerpfad verhalten sich unterschiedlich, ohne dass das beabsichtigt ist.

Fehlerobjekt protokollieren, Close in beiden Pfaden gleich behandeln. **Siehe den Abschnitt
„Auflösung eines scheinbaren Widerspruchs" oben** — hier ist ein Close richtig, in
`fixOvertime.ts` nicht. Den Grund als Kommentar hinterlegen.

**Abnahme:** ein erzwungener Fehlerfall gibt das Fehlerobjekt aus; `npx tsc --noEmit` sauber.

### Task 7 — WR-03: verbotenes `toISOString().split('T')[0]`
`server/src/scripts/migrate.ts:180` (und in `sync-db.ts` bereits mit Task 4 erledigt)

In `migrate.ts:180` bestimmt das Muster den Dateinamen einer neuen Migration. Nach 22:00 bzw.
23:00 Ortszeit trägt sie das Datum des Folgetags — und da die Migrationen alphabetisch über
genau diesen Namen sortiert werden (`migrate.ts:62`), kann das die Ausführungsreihenfolge
verschieben. `.claude/CLAUDE.md` verbietet das Muster ausdrücklich.

Auf `formatDate(new Date(), 'yyyyMMdd')` aus `../utils/timezone.js` umstellen.

**Abnahme:** `grep -rn "toISOString().split('T')\[0\]" server/src/scripts/` → kein Treffer.

## Abschluss

Nach allen Tasks: `npx tsc --noEmit` im `server/`-Verzeichnis, dann `npx vitest run`.
Erwartet 591 grün / 4 rot (Baseline). Jeder neue rote Test ist zu beheben oder als
blockierender Befund zu melden. Danach SUMMARY.md schreiben und committen.
