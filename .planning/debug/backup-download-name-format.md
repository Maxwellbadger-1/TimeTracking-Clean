---
slug: backup-download-name-format
status: awaiting_human_verify
trigger: "wenn ich ein backup downloade, zeigt er im titel den falschen namen. also nicht heutiges datum. zudem sind es nun verschiedene Dateiformate. das muss funktionieren. einwandfrei. Sieh im download ordner nach. da habe ich die letzten backups gedownloaded. C:\\Users\\maxfe\\Downloads"
created: 2026-09-03
updated: 2026-09-03
---

# Debug Session: backup-download-name-format

## Symptoms

**Expected behavior**
Ein Backup-Download liefert genau EINE Datei, deren Name den korrekten (lokalen, deutschen) Zeitstempel trägt — beim Download heute also das heutige Datum.

**Actual behavior**
1. Der Dateiname im Downloads-Ordner trägt nicht das heutige Datum, sondern einen abweichenden Zeitstempel.
2. Es landen zusätzlich Dateien anderer Formate im Downloads-Ordner: `.db-shm` und `.db-wal` neben der `.db`.

**Client**
Desktop-App (Tauri), nicht Browser.

**Where visible**
Dateiname im Downloads-Ordner `C:\Users\maxfe\Downloads`.

**Error messages**
Keine — Download läuft ohne Fehlermeldung durch.

**Timeline**
Nutzer sagt "nun verschiedene Dateiformate" → das Zusatzdatei-Verhalten ist neu.

**Reproduction**
In der Desktop-App auf der BackupPage den Download-Button eines Backups klicken.

## Evidence

- timestamp: 2026-09-03 (Orchestrator, Vorab-Sichtung)
  observation: Downloads-Ordner enthält 11 Dateien `database-backup-<ISO-UTC>.db`, dazu 4 Paare `.db-shm` (32768 B) / `.db-wal` (0 B) mit identischem Basename.
  Beispiel: `database-backup-2026-09-02T21-33-37-052Z.db` (mtime 2026-09-02 23:34),
  `…-052Z.db-shm` (mtime 2026-09-03 06:28), `…-052Z.db-wal` (mtime 2026-09-02 23:37).

- timestamp: 2026-09-03 (Orchestrator, Code-Sichtung)
  observation: `server/src/services/backupService.ts:35` erzeugt den Dateinamen aus
  `new Date().toISOString().replace(/[:.]/g, '-')` → UTC. Deutsche Sommerzeit ist UTC+2,
  d. h. ein Backup zwischen 00:00 und 02:00 MESZ trägt den VORTAG im Namen.
  Der Dateiname stammt zudem vom Erstellungszeitpunkt des Backups auf dem Server,
  nicht vom Download-Zeitpunkt.

- timestamp: 2026-09-03 (Orchestrator, Code-Sichtung)
  observation: Download-Kette: `desktop/src/pages/BackupPage.tsx:114-140`
  (fetch → `response.blob()` → `downloadBlob(blob, filename)`),
  `desktop/src/utils/downloadFile.ts` (Anchor-`download`-Attribut),
  Server: `server/src/routes/backup.ts` GET `/api/backup/download/:filename` → `res.download(backupPath, filename)`.
  Der Server sendet ausschließlich die `.db` — `.db-shm`/`.db-wal` können auf diesem Weg nicht mitkommen.
  → Herkunft der Begleitdateien ist offen (lokaler SQLite-Zugriff auf die Download-Datei? Tauri-Sidecar? Restore-Pfad?).

- timestamp: 2026-09-03 (Orchestrator, Code-Sichtung)
  observation: `server/src/services/cronService.ts:29` → `cron.schedule('0 2 * * *', …)` ohne
  explizite Timezone. Erzeugte Dateinamen wie `database-backup-2026-08-20T00-00-00-022Z.db`
  deuten darauf hin, dass der Server in Europe/Berlin läuft (02:00 lokal = 00:00 UTC).

- timestamp: 2026-09-03 (Orchestrator, Code-Sichtung)
  observation: `server/src/routes/backup.ts` POST `/api/backup` verwendet
  `backupPath.split('/').pop()` — auf Windows-Pfaden (Backslash) liefert das den
  kompletten Pfad statt des Dateinamens. Nur relevant, falls der Server je auf Windows läuft.

- timestamp: 2026-09-03 (Session-Manager, unberührter mtime-Snapshot VOR jeder Untersuchung)
  observation: Vollständige Auflistung `C:\Users\maxfe\Downloads` (`ls -la --time-style=full-iso`),
  aufgenommen bevor irgendein Agent eine Datei angefasst hat. Maßgeblicher Referenzstand —
  spätere mtime-Änderungen an diesen Dateien stammen aus der Untersuchung, nicht vom Symptom.

  | Datei | Größe | mtime (lokal, +0200) |
  |---|---|---|
  | database-backup-2026-08-18T18-21-32-245Z.db | 1529775 | 2026-08-18 20:21:41 |
  | database-backup-2026-08-20T00-00-00-022Z.db | 1528180 | 2026-08-20 20:56:28 |
  | database-backup-2026-08-20T00-00-00-022Z.db-shm | 32768 | 2026-08-27 22:29:48 |
  | database-backup-2026-08-20T00-00-00-022Z.db-wal | 0 | 2026-08-27 22:29:48 |
  | database-backup-2026-08-21T16-40-08-001Z.db | 1541808 | 2026-08-21 18:40:19 |
  | database-backup-2026-08-21T16-40-08-001Z.db-shm | 32768 | 2026-08-27 22:29:48 |
  | database-backup-2026-08-21T16-40-08-001Z.db-wal | 0 | 2026-08-27 22:29:48 |
  | database-backup-2026-08-27T20-27-22-251Z.db | 1910123 | 2026-08-27 22:27:39 |
  | database-backup-2026-08-27T20-27-22-251Z.db-shm | 32768 | 2026-08-27 22:29:48 |
  | database-backup-2026-08-27T20-27-22-251Z.db-wal | 0 | 2026-08-27 22:29:09 |
  | database-backup-2026-08-27T20-57-37-065Z.db | 1910071 | 2026-08-27 22:57:42 |
  | database-backup-2026-08-28T12-06-40-241Z.db | 1909395 | 2026-08-28 14:06:46 |
  | database-backup-2026-08-28T18-51-33-270Z.db | 1909395 | 2026-08-28 20:51:39 |
  | database-backup-2026-08-29T19-19-42-699Z.db | 1740800 | 2026-08-29 21:19:46 |
  | database-backup-2026-08-30T06-51-48-072Z.db | 1740800 | 2026-08-30 08:51:56 |
  | database-backup-2026-09-02T21-33-37-052Z.db | 1740800 | 2026-09-02 23:34:31 |
  | database-backup-2026-09-02T21-33-37-052Z.db-shm | 32768 | 2026-09-03 06:28:18 |
  | database-backup-2026-09-02T21-33-37-052Z.db-wal | 0 | 2026-09-02 23:37:01 |

  Ableitungen aus dem Snapshot:
  (a) Jede `-shm`/`-wal` ist JÜNGER als die zugehörige `.db` — sie entstand also nach dem
      Download, nicht währenddessen. Ein HTTP-Download kann sie nicht mitgeliefert haben.
  (b) Drei der vier Paare tragen exakt denselben Stempel 2026-08-27 22:29:48 für die
      Backups vom 20.08., 21.08. und 27.08. → ein einzelner Vorgang öffnete an diesem Abend
      drei heruntergeladene `.db` nacheinander. Zeitlich deckt sich das mit dem in
      `.claude/CLAUDE.md` dokumentierten `integrity_check` vom 27.08.2026.
  (c) `-wal` ist durchweg 0 B und `-shm` 32768 B — Signatur einer geöffneten und sauber
      geschlossenen, aber nicht aufgeräumten SQLite-Verbindung im WAL-Modus.
  (d) Die `.db`-Dateien selbst wurden nie nachträglich verändert (mtime = Downloadzeit).

- timestamp: 2026-09-03 (Debugger, Korrektur einer Zählung im Vorab-Befund)
  checked: Die Tabelle des mtime-Snapshots, Zeile für Zeile ausgezählt.
  found: Der Snapshot listet 18 Zeilen: **10** `.db`-Dateien, 4 `-shm`, 4 `-wal`.
  Der Vorab-Befund des Orchestrators sprach von 11 `.db` — das ist um eins zu hoch.
  implication: Maßgeblich ist die Tabelle. Alle folgenden Zählungen gehen von 10 `.db` aus.

- timestamp: 2026-09-03 (Debugger, Ausschluss eines App-Codepfads für die `-shm`/`-wal`)
  checked: Vollständige Suche nach jedem Codepfad, der eine Datei lokal als SQLite öffnen könnte.
  found:
    * `desktop/src-tauri/Cargo.toml:20-30` — Abhängigkeiten sind ausschließlich `tauri`,
      `tauri-plugin-opener` / `-http` / `-notification` / `-dialog` / `-fs` / `-updater` /
      `-process`, `serde`, `serde_json`. KEIN `rusqlite`, KEIN `tauri-plugin-sql`, KEIN `libsql`.
    * `desktop/src-tauri/tauri.conf.json:59-69` — der einzige konfigurierte Plugin-Eintrag
      ist `updater`. Kein SQL-Plugin.
    * `desktop/src-tauri/src/lib.rs:1-82` — der gesamte Rust-Code besteht aus Tray-Menü,
      Plugin-Registrierung und dem Kommando `greet` (Zeile 8-11). Der einzige registrierte
      `invoke_handler` ist `greet` (Zeile 79). Kein Dateizugriff, kein DB-Zugriff.
    * `desktop/package.json:22-52` — keine SQLite-Abhängigkeit (weder `better-sqlite3`,
      `sql.js` noch `@tauri-apps/plugin-sql`).
    * `desktop/src/utils/downloadFile.ts:20-37` — `downloadBlob()` erzeugt eine Object-URL,
      setzt `a.download = filename` und klickt den Anker, danach `revokeObjectURL`. Die
      geschriebene Datei wird nicht wieder angefasst.
    * `desktop/src/pages/BackupPage.tsx:114-141` — die Download-Mutation endet nach
      `downloadBlob(blob, filename)` (Zeile 131) mit einem Toast. Kein Nachlesen der Datei.
    * Suche nach `sqlite|rusqlite|libsql|sql` in `desktop/src-tauri/` (ohne `target/`):
      null Treffer.
  implication: Weder der React- noch der Rust-Teil der Desktop-App öffnet jemals eine
  heruntergeladene Datei. Ein App-Codepfad als Ursache der `-shm`/`-wal` ist ausgeschlossen.

- timestamp: 2026-09-03 (Debugger, positiver Herkunftsnachweis der drei Paare vom 27.08.)
  checked: `.planning/debug/wal-abgehaengt-20260827.md` (mtime 2026-08-27 23:15).
  found: Der Abschnitt "Zweiter, unabhängiger Befund: Die Backup-Funktion erzeugt defekte
  Dateien" listet in einer Tabelle (Zeile 84-86) GENAU die drei Dateien, die im Snapshot ein
  `-shm`/`-wal`-Paar mit dem Stempel 2026-08-27 22:29:48 tragen:
    `database-backup-2026-08-20T00-00-00-022Z.db` → `database disk image is malformed`
    `database-backup-2026-08-21T16-40-08-001Z.db` → `database disk image is malformed`
    `database-backup-2026-08-27T20-27-22-251Z.db` → `unsupported file format`
  Zeile 88 desselben Protokolls: "Alle liegen im Download-Ordner des Anwenders."
  Die Tabellenspalte "Öffnen" enthält SQLite-Fehlermeldungen — sie kann nur entstanden sein,
  indem die Dateien als SQLite-Datenbank GEÖFFNET wurden.
  implication: Die drei Paare vom 27.08. sind vollständig durch die Untersuchung jenes
  Abends erklärt. Kein Produktfehler.

- timestamp: 2026-09-03 (Debugger, Herkunftsnachweis des vierten Paars vom 02./03.09.)
  checked: `.planning/STATE.md:306` (Eintrag zur Auslieferung `4d8b3de` vom 02.09.2026).
  found: Wörtlich: "Vorab-Sicherung dreifach und geprüft: App-Backup
  `database-backup-2026-09-02T21-33-37-052Z.db` (md5 `5a09600…`, `integrity_check: ok`,
  22 Tabellen), Zweitkopie `/home/ubuntu/databases/backups/pre-t5j-deploy_20260902_213337.db`,
  plus lokale Kopie beim Anwender — der Download war byte-identisch, was zugleich den
  v1.9.1-Binärdownload an einer echten Binärdatei bestätigt."
  Zeitliche Deckung: `.db` mtime 2026-09-02 23:34:31 (Download), `-wal` mtime 23:37:01
  (2 min 30 s später = Prüfung), `-shm` mtime 2026-09-03 06:28:18 (zweite Öffnung heute früh,
  9 Minuten vor Anlage dieses Debug-Files um 06:37).
  implication: Auch das vierte Paar stammt aus einer manuellen Verifikation, nicht aus der App.

- timestamp: 2026-09-03 (Debugger, Kontrollgruppe im Snapshot)
  checked: Der unberührte mtime-Snapshot oben, gezählt nach `.db`-Dateien mit und ohne Begleiter.
  found: 10 `.db`-Dateien, davon 4 mit `-shm`/`-wal` und 6 OHNE:
  `…2026-08-18T18-21-32-245Z`, `…2026-08-27T20-57-37-065Z`, `…2026-08-28T12-06-40-241Z`,
  `…2026-08-28T18-51-33-270Z`, `…2026-08-29T19-19-42-699Z`, `…2026-08-30T06-51-48-072Z`.
  implication: Entscheidende Kontrollgruppe. Alle 10 Dateien kamen über denselben
  Download-Weg. Erzeugte der Download die Begleitdateien, müssten ALLE 10 sie tragen.
  6 tragen sie nicht. Die Begleitdateien hängen also nicht am Download, sondern am
  späteren Öffnen einzelner Dateien.

- timestamp: 2026-09-03 (Debugger, Namensbildung und der Widerspruch in der Oberfläche)
  checked: `server/src/services/backupService.ts:35-36`, `:60-83`,
  `desktop/src/pages/BackupPage.tsx:151-158`, `:271`, `server/src/utils/timezone.ts:56-59`.
  found:
    * `backupService.ts:35` bildet den Zeitstempel mit
      `new Date().toISOString().replace(/[:.]/g, '-')` → reine UTC-Zeit, Suffix `Z`.
    * `listBackups()` (`:60-76`) liefert `created: stats.birthtime` — den echten
      Erstellzeitpunkt der Datei, nicht den Namen.
    * `BackupPage.tsx:151-158` formatiert dieses `created` mit
      `toLocaleString('de-DE', …)`, also in der Ortszeit des Anwenders (Europe/Berlin),
      und zeigt es in Spalte "Erstellt am" (`:271`).
    * `server/src/utils/timezone.ts:56-59`: `formatDate(date, formatString)` existiert und
      rechnet über `toZonedTime(date, 'Europe/Berlin')` (`:19`, `:57`) in deutsche Ortszeit um.
  implication: Für ein und dasselbe Backup zeigt die App ZWEI verschiedene Zeiten.
  Beispiel `database-backup-2026-09-02T21-33-37-052Z.db`: die Tabellenspalte "Erstellt am"
  zeigt `02.09.2026, 23:33` (Berlin), der Dateiname sagt `21-33-37` (UTC). Zwei Stunden
  Unterschied bei MESZ. Genau dieser Widerspruch ist der Befund "falscher Name".
  Verschärfung: für jedes Backup, das zwischen 00:00 und 02:00 Berliner Zeit entsteht,
  fällt der UTC-Name auf den VORTAG. Der nächtliche Cron `cron.schedule('0 2 * * *', …)`
  (`server/src/services/cronService.ts:29`, ohne Timezone-Option; Server läuft laut
  `.claude/CLAUDE.md` Abschnitt "Umgebungsvariablen (Server)" mit `TZ=Europe/Berlin`)
  feuert exakt an dieser Grenze — belegt durch den vorhandenen Namen
  `database-backup-2026-08-20T00-00-00-022Z.db` (02:00 Berlin = 00:00 UTC).
  `toISOString()` zur Datumsbildung ist in `.claude/CLAUDE.md` unter "Verbote" ausdrücklich
  untersagt; vorgeschrieben ist `formatDate(date, 'yyyy-MM-dd')`.

- timestamp: 2026-09-03 (Debugger, Regressionsfläche einer Namensänderung)
  checked: `grep -rn "database-backup" server/src desktop/src .github scripts` sowie
  `server/src/services/backupService.ts:66,76,116-128,173-188` und `server/src/routes/backup.ts`.
  found: Nur ZWEI Fundstellen im gesamten Produktivcode:
  `backupService.ts:36` (Erzeugung) und `backupService.ts:66` (Filter
  `startsWith('database-backup-') && endsWith('.db')`). Keine Workflow-, Skript- oder
  Frontend-Datei kennt das Muster.
    * Sortierung: `backupService.ts:76` sortiert nach `b.created.getTime()` (birthtime),
      NICHT nach dem Namen → namensunabhängig.
    * Aufbewahrung: `cleanOldBackups()` (`:173-188`) nutzt `listBackups()` → ebenfalls
      birthtime, namensunabhängig.
    * Wiederherstellung: `restoreBackup(filename)` (`:116-118`) setzt den Namen nur wieder
      zum Pfad zusammen; der Name kommt aus der API-Liste → namensunabhängig.
    * Route `GET /download/:filename` und `POST /restore/:filename` reichen den Parameter
      durch; ein Name aus `[0-9a-zA-Z._-]` erzeugt kein URL-Problem.
  implication: Solange Präfix `database-backup-` und Endung `.db` erhalten bleiben, ist eine
  Änderung des Zeitstempelformats regressionsfrei. Alte und neue Namen koexistieren, weil
  beide denselben Filter passieren und die Sortierung nicht am Namen hängt.

- timestamp: 2026-09-03 (Debugger, welcher Name tatsächlich auf der Platte landet)
  checked: `desktop/src/pages/BackupPage.tsx:118-131`, `desktop/src/utils/downloadFile.ts:20-37`,
  `server/src/routes/backup.ts:107`.
  found: Der Server setzt den Namen über `res.download(backupPath, filename)`
  (`routes/backup.ts:107`) in den `Content-Disposition`-Kopf. Die App liest den Körper aber
  als Blob (`BackupPage.tsx:130`) und speichert ihn über eine Object-URL mit
  `a.download = filename` (`downloadFile.ts:27`), gespeist aus `backup.filename` der
  API-Liste (`BackupPage.tsx:131`).
  implication: Bei einer Blob-URL entscheidet ausschließlich das `download`-Attribut über den
  Dateinamen; `Content-Disposition` ist wirkungslos. Der Name auf der Platte ist damit 1:1
  der serverseitig vergebene Backup-Dateiname. Ein Fix am Erzeugungsort wirkt vollständig —
  ein reines Umschreiben beim Download im Client würde dagegen eine zweite Wahrheit erzeugen
  (Downloads-Name ≠ Servername ≠ Restore-Name) und wird deshalb verworfen.

- timestamp: 2026-09-03 (Debugger, Nebenbefunde im selben Codebereich)
  checked: `server/src/services/backupService.ts:89-109`, `:131`, `server/src/routes/backup.ts:142`.
  found:
    * `backupService.ts:131` bildet den Sicherheits-Backup-Namen
      `database-before-restore-${new Date().toISOString().replace(/[:.]/g,'-')}.db` —
      derselbe UTC-Fehler. Zusatzbefund: dieses Präfix passiert den Filter in `:66` NICHT,
      solche Dateien werden also weder gelistet noch von `cleanOldBackups()` aufgeräumt.
    * `backupService.ts:89-109` `validateBackupIntegrity()` öffnet die Backup-Datei mit
      `new Database(backupPath, { readonly: true })` (`:92`) und schließt sie (`:96`).
      Das ist derselbe Mechanismus, der `-shm`/`-wal` erzeugt — aber im SERVER-Backup-
      Verzeichnis auf Linux, nicht im Windows-Downloads-Ordner. Erklärt das Symptom nicht.
    * `routes/backup.ts:142` `backupPath.split('/').pop()` — auf Windows liefert
      `path.join()` Backslashes, das Ergebnis wäre der komplette Pfad statt des Namens.
      In Produktion läuft der Server unter Linux (`desktop/.env.production`:
      `VITE_API_URL=http://129.159.8.19:3000/api`), dort wirkt der Fehler sich nicht aus;
      im lokalen Windows-Dev-Betrieb schon.
  implication: Drei Nebenbefunde im Backup-Namensbereich, keiner davon Ursache des
  gemeldeten Symptoms.

- timestamp: 2026-09-03 (Debugger, Fix angewandt)
  checked: `server/src/services/backupService.ts` nach der Änderung, `npx tsc --noEmit`.
  found: siehe Abschnitt Resolution.

## Eliminated

- Der HTTP-Download liefert die `-shm`/`-wal` mit: WIDERLEGT durch mtime-Snapshot (a) —
  die Begleitdateien sind jünger als die `.db`, teils Tage später.

- Der Download erzeugt die Begleitdateien (zweiter, unabhängiger Beweis): WIDERLEGT durch
  die Kontrollgruppe — 6 der 10 `.db`-Dateien im Snapshot haben überhaupt keine
  Begleitdateien, obwohl sie denselben Weg genommen haben.

- Ein Codepfad der Desktop-App (React oder Rust/Tauri) öffnet die heruntergeladene Datei als
  SQLite: WIDERLEGT. Keine SQLite-Abhängigkeit in `desktop/package.json:22-52`, keine in
  `desktop/src-tauri/Cargo.toml:20-30`, kein SQL-Plugin in `tauri.conf.json:59-69`, und der
  einzige Rust-Befehl ist `greet` (`lib.rs:8-11,79`). Suche nach `sqlite|rusqlite|libsql|sql`
  in `src-tauri/`: 0 Treffer.

- Der Server erzeugt die `-shm`/`-wal` im Downloads-Ordner: WIDERLEGT. Der Server läuft unter
  Linux auf 129.159.8.19 und hat keinen Zugriff auf `C:\Users\maxfe\Downloads`. Der einzige
  serverseitige SQLite-Öffnungspfad auf eine Backup-Datei ist `validateBackupIntegrity()`
  (`backupService.ts:89-109`), und der arbeitet im Backup-Verzeichnis des Servers.

- Ein Skript des Projekts fasst den Downloads-Ordner an: WIDERLEGT. `scripts/sync-dev-db.sh`
  arbeitet ausschließlich auf `/tmp` (Zeile 42-43), `server/database/development.db`
  (Zeile 40) und `server/database.db.backup.<TIMESTAMP>` (Zeile 104) — das erklärt die
  vorhandenen `server/database.db.backup.20260821_215424-shm`/`-wal`, nicht die im
  Downloads-Ordner. Kein Treffer auf "Downloads" in `scripts/` oder `server/scripts/`.

- "Der Name ist falsch, weil beim Download die `Content-Disposition` verlorengeht":
  WIDERLEGT als Ursache. `Content-Disposition` ist hier von vornherein wirkungslos
  (Blob-URL, `downloadFile.ts:27`); der Name auf der Platte stimmt exakt mit dem
  serverseitig vergebenen Namen überein. Die Ursache liegt in der Namensbildung, nicht in
  der Übertragung.

## Current Focus

reasoning_checkpoint:
  hypothesis: >
    Teilproblem (1) NAME ist ein Produktfehler: `backupService.ts:35` bildet den Dateinamen
    mit `new Date().toISOString()` in UTC, während dieselbe Oberfläche denselben Zeitpunkt in
    Spalte "Erstellt am" über `toLocaleString('de-DE')` (`BackupPage.tsx:151-158`) in
    Europe/Berlin anzeigt. Daraus folgen zwei unterschiedliche Zeiten für dasselbe Objekt
    (2 h Abweichung bei MESZ, 1 h bei MEZ) und ein Datum, das für Backups zwischen 00:00 und
    02:00 Berliner Zeit auf den Vortag fällt.
    Teilproblem (2) FORMATE ist KEIN Produktfehler: die `-shm`/`-wal` stammen nachweislich
    aus manuellen SQLite-Öffnungen der bereits heruntergeladenen Dateien (drei am 27.08.,
    eine am 02./03.09.).
  confirming_evidence:
    - "backupService.ts:35 — `new Date().toISOString().replace(/[:.]/g,'-')`, gelesen."
    - "BackupPage.tsx:151-158 und :271 — `toLocaleString('de-DE')` auf `backup.created`, gelesen."
    - "backupService.ts:70-73 — `created: stats.birthtime`, echte Ortszeit-Quelle, gelesen."
    - "Vorhandener Dateiname `database-backup-2026-08-20T00-00-00-022Z.db` = Cronlauf 02:00 Berlin."
    - "wal-abgehaengt-20260827.md:84-88 nennt genau die drei Dateien mit Paar-Stempel 22:29:48."
    - "STATE.md:306 nennt genau die vierte Datei als am 02.09. lokal geprüftes App-Backup."
    - "Kontrollgruppe: 6 von 10 `.db` haben trotz identischem Downloadweg kein Paar."
  falsification_test: >
    (1) wäre widerlegt, wenn der Server nicht in Europe/Berlin liefe oder wenn die Spalte
    "Erstellt am" denselben Wert wie der Dateiname zeigte. Beides ist geprüft und trifft
    nicht zu.
    (2) wäre widerlegt, wenn eine `.db` ohne jede manuelle Öffnung ein Paar trüge — dann
    müsste die 6er-Kontrollgruppe ebenfalls Paare tragen. Tut sie nicht.
  fix_rationale: >
    Der Fix setzt an der EINZIGEN Erzeugungsstelle des Namens an (`backupService.ts:35`) und
    nutzt den vorhandenen, projektweit vorgeschriebenen Helfer `formatDate(date, …)` aus
    `server/src/utils/timezone.ts:56`, der über `toZonedTime(date, 'Europe/Berlin')` rechnet.
    Damit stimmen Dateiname, Spalte "Erstellt am" und die Wanduhr des Anwenders überein.
    Ein Umschreiben erst beim Download wäre Symptombehandlung und erzeugte eine zweite Wahrheit.
  blind_spots: >
    - Der Fix wirkt erst für NEUE Backups. Die 10 bereits heruntergeladenen Dateien behalten
      ihre historischen UTC-Namen; nachträgliches Umbenennen wird bewusst NICHT gemacht, weil
      es Downloads-Name und Servername auseinanderlaufen ließe.
    - Ich konnte nicht messen, ob der Anwender mit "nicht heutiges Datum" die UTC-Verschiebung
      meint oder erwartet, dass ein Backup vom Vortag beim Download das heutige Datum trägt.
      Die zweite Lesart ist fachlich schädlich — deshalb Rückfrage statt stiller Entscheidung.
    - Der Fix ist serverseitig und wird erst nach einem Deployment wirksam. Deployment ist
      ohne ausdrückliche Zustimmung untersagt (Staging und Produktion teilen einen Host).
    - Der Server wurde nicht kontaktiert; `TZ=Europe/Berlin` ist aus `.claude/CLAUDE.md` und
      aus den vorhandenen Dateinamen erschlossen, nicht per `printenv` auf dem Host gemessen.
    - Die Änderung ist zur Laufzeit nicht gegen einen laufenden Server verifiziert, sondern
      über `npx tsc --noEmit` und über die reine Formatlogik. Der Beweis am echten Backup
      steht bis nach dem Deployment aus.

next_action: CHECKPOINT gestellt — warte auf Anwender — (a) fachliche Entscheidung Erstellzeitpunkt vs.
Downloadzeitpunkt, (b) Freigabe für das Deployment des serverseitigen Fixes.

## Resolution

root_cause: |
  ZWEI unabhängige Sachverhalte, von denen nur einer ein Produktfehler ist.

  (1) NAME — Produktfehler, bestätigt.
      `server/src/services/backupService.ts:35` bildete den Zeitstempel des Backup-
      Dateinamens mit `new Date().toISOString().replace(/[:.]/g, '-')`, also in UTC.
      Dieselbe Oberfläche zeigt denselben Zeitpunkt in der Spalte "Erstellt am" über
      `toLocaleString('de-DE')` (`desktop/src/pages/BackupPage.tsx:151-158`, gespeist aus
      `stats.birthtime`, `backupService.ts:73`) in deutscher Ortszeit. Dadurch trägt ein und
      dasselbe Backup zwei verschiedene Zeiten: die Liste `02.09.2026, 23:33`, der Dateiname
      `2026-09-02T21-33-37-052Z`. Bei MESZ sind das 2 Stunden Differenz; für jedes Backup
      zwischen 00:00 und 02:00 Berliner Zeit springt das Datum im Namen auf den Vortag.
      Der Name auf der Platte ist exakt dieser Servername, weil die App über eine Blob-URL
      speichert und `a.download` (`desktop/src/utils/downloadFile.ts:27`) den Namen bestimmt.

  (2) FORMATE (`-shm`/`-wal`) — KEIN Produktfehler.
      Die Begleitdateien entstehen nicht beim Download, sondern beim späteren Öffnen
      einzelner heruntergeladener `.db` als SQLite-Datenbank. Belege:
      - kein SQLite-Codepfad in der Desktop-App (React und Rust vollständig geprüft),
      - alle Begleitdateien sind jünger als die zugehörige `.db`,
      - 6 von 10 `.db` haben gar keine Begleitdateien (Kontrollgruppe),
      - die drei Paare vom 27.08.2026 22:29:48 gehören exakt zu den drei Dateien, die
        `.planning/debug/wal-abgehaengt-20260827.md:84-88` als im Downloads-Ordner geöffnet
        protokolliert,
      - das vierte Paar gehört zu der Datei, die `.planning/STATE.md:306` als am 02.09.
        lokal gegengeprüftes App-Backup ausweist.

fix: |
  Angewandt in `server/src/services/backupService.ts`:

  1. Import von `formatDate` aus `../utils/timezone.js` ergänzt.
  2. `createBackup()`: Zeitstempel jetzt `formatDate(new Date(), 'yyyy-MM-dd_HH-mm-ss')`
     (Europe/Berlin) statt `toISOString()`. Neues Namensmuster:
     `database-backup-2026-09-03_08-14-22.db`.
     Präfix `database-backup-` und Endung `.db` unverändert → Filter, Sortierung,
     Aufbewahrung und Restore bleiben unberührt; alte und neue Namen koexistieren.
  3. Kollisionsschutz ergänzt: die Sekundenauflösung (statt Millisekunden) könnte zwei
     Backups derselben Sekunde denselben Namen geben; `copyFileSync` hätte das erste
     stillschweigend überschrieben. Existiert der Name bereits, wird `-2`, `-3`, …
     angehängt.
  4. `restoreBackup()`: Name des Sicherheits-Backups (`database-before-restore-…`) auf
     denselben Berliner Zeitstempel umgestellt.
  5. `server/src/routes/backup.ts`: `backupPath.split('/').pop()` → `path.basename(backupPath)`
     (Nebenbefund; unter Windows lieferte die alte Fassung den ganzen Pfad).

  BEWUSST NICHT gemacht:
  - Kein clientseitiges Umbenennen beim Download (erzeugte eine zweite Wahrheit).
  - Kein nachträgliches Umbenennen bestehender Backups.
  - Nichts an `-shm`/`-wal`, weil das kein Produktfehler ist.

verification: |
  1. `npx tsc --noEmit` im Verzeichnis `server/`: Exitcode 0, keine Ausgabe.

  2. Formatprobe, gefahren mit `npx tsx` gegen `server/src/utils/timezone.ts` (nur dieses
     Modul importiert — KEIN Datenbankzugriff; Probedatei danach gelöscht). Rohausgabe:

     | UTC-Eingabe              | ALT (toISOString)        | NEU (formatDate Berlin) | Fall |
     |---|---|---|---|
     | 2026-09-02T21:33:37.052Z | 2026-09-02T21-33-37-052Z | 2026-09-02_23-33-37 | reales Backup vom 02.09. |
     | 2026-08-20T00:00:00.022Z | 2026-08-20T00-00-00-022Z | 2026-08-20_02-00-00 | nächtlicher Cron 02:00 Berlin |
     | 2026-09-02T22:30:00.000Z | 2026-09-02T22-30-00-000Z | 2026-09-03_00-30-00 | 00:30 Berlin am 03.09. |
     | 2026-01-15T23:30:00.000Z | 2026-01-15T23-30-00-000Z | 2026-01-16_00-30-00 | Winterzeit MEZ, 00:30 am 16.01. |

     Auswertung:
     - Zeile 1 ist der Beweis gegen das Symptom: die App-Liste zeigt für dieses Backup
       `02.09.2026, 23:33`; der neue Name sagt `23-33-37`, der alte `21-33-37`.
       Die zwei Stunden Widerspruch sind weg.
     - Zeile 2: der 02:00-Cron heißt jetzt auch `02-00-00` statt `00-00-00`.
     - Zeile 3 ist genau der gemeldete Fall "nicht heutiges Datum": alter Name trägt den
       02.09., neuer Name den 03.09. — den Tag, an dem das Backup tatsächlich entstand.
     - Zeile 4 belegt, dass auch MEZ (+1 h) korrekt behandelt wird, die Verschiebung also
       nicht fest verdrahtet ist.

  3. Regressionsprüfung ohne Laufzeit: `grep -rn "database-backup" server/src desktop/src
     .github scripts` liefert nach der Änderung weiterhin nur die Erzeugungsstelle und den
     Filter in `backupService.ts`. Kein Test, kein Workflow, kein Skript und kein
     Frontend-Code hängt am Zeitstempelformat. Sortierung und Aufbewahrung laufen über
     `birthtime`, nicht über den Namen.

  4. AUSSTEHEND — Nachweis am echten Backup. Erfordert ein Deployment auf den Server.
     Staging und Produktion teilen einen Host; ein `git push` löst `deploy-server.yml`
     samt PM2-Neustart auf der Produktionsmaschine aus. Wird ohne ausdrückliche Zustimmung
     des Anwenders NICHT ausgeführt.

files_changed:
  - server/src/services/backupService.ts
  - server/src/routes/backup.ts

## Specialist Review

- reviewer: typescript-expert (specialist_hint: typescript)
- timestamp: 2026-09-03
- verdict: **SUGGEST_CHANGE** — Kern des Fixes korrekt, aber drei offene Punkte,
  einer davon sicherheitsrelevant und blockierend.

### Bestaetigt

- `formatDate` (`server/src/utils/timezone.ts:56-59`) ist prozess-TZ-unabhaengig:
  `toZonedTime(date, 'Europe/Berlin')` (`:57`) + `dateFnsFormat` (`:58`) liefern bei
  `TZ=UTC` dasselbe Ergebnis wie bei `TZ=Europe/Berlin`.
  `backupTimestamp()` (`backupService.ts:41-43`) uebergibt ein rohes `Date`, also genau
  eine Konvertierung. Korrekt.
- Kollisionsschutz greift prozessintern: zwischen `uniqueBackupPath()` (`:72`) und
  `fs.copyFileSync` (`:79`) liegt nur synchroner Code, kein Event-Loop-Yield.
- Das neue Namensmuster bricht keinen Konsumenten. `listBackups()` filtert per
  `startsWith`/`endsWith` (`:102`) und sortiert ueber `birthtime` (`:109`, `:112`).
  Frontend zeigt den Namen nur an (`BackupPage.tsx:268`). Shell-Globs in
  `scripts/database/backup.sh:201,217-227` matchen `database_*.db` und greifen nicht.

### BLOCKIEREND — Path Traversal (vorbestehend, nicht vom Fix eingefuehrt)

`getBackupPath()` (`backupService.ts:252-254`) macht ein blankes
`path.join(BACKUP_DIR, filename)` ohne Normalisierung oder Praefixpruefung;
`routes/backup.ts:84-95` reicht `req.params.filename` ungefiltert durch.
Express 4 dekodiert Routenparameter nach dem Matching, `%2f` ist beim Matching kein
Segmenttrenner. Ein Request auf
`/api/backup/download/..%2f..%2fdatabases%2fproduction.db` verlaesst damit BACKUP_DIR.
Die als "Security check" kommentierte Pruefung in `:98` prueft nur Existenz, nicht Lage.
Betroffen sind alle drei Parameter-Routen; Download ist die harmloseste Variante:
`restoreBackup` ueberschreibt die DB mit dem Ergebnis (`:184`), `deleteBackup` ruft
`fs.unlinkSync` (`:273`) -> beliebige Dateiloeschung.
Derzeit nur durch `requireAuth` + `requireAdmin` entschaerft
(`routes/backup.ts:80-81`, `:169-170`, `:205-206`).
Fix: in `getBackupPath()` `path.resolve` bilden und Praefix pruefen, oder gegen
`/^database-(backup|before-restore)-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?\.db$/`
validieren. Kleinste ausreichende Massnahme: `path.basename(filename)` als Guard.

### Weitere Befunde

- `cronService.ts:29` ist der EINZIGE Cron ohne `timezone`-Angabe (vgl. `:113`, `:181`
  mit explizit `Europe/Berlin`). Ohne gesetztes `TZ` feuert das Backup 02:00 UTC =
  04:00 Berlin, und der Kommentar in `backupService.ts:35` stimmt dann nicht mehr.
- `getTodayString()` (`timezone.ts:41`) uebergibt das bereits per `toZonedTime`
  verschobene `getCurrentDate()` (`:30`) erneut an `formatDate` -> doppelte Konvertierung.
  Bei `TZ=Europe/Berlin` unsichtbar, bei `TZ=UTC` liefert es nachts 22:00-24:00 den
  Folgetag. Gleiches in `getCurrentMonth()` (`:89`) und `getCurrentISOWeek()` (`:96`).
  Das System haengt also weiterhin an `TZ=Europe/Berlin`.
- Prozessuebergreifende Race: `.github/workflows/deploy-server.yml:73-74` und
  `scripts/production/backup-db.sh:19` schreiben aus fremden Prozessen ins selbe
  `backups/`; `copyFileSync` ueberschreibt still. Empfehlung: `COPYFILE_EXCL` +
  Retry-Schleife mit Obergrenze. Die `while`-Schleife in `:56-59` ist unbegrenzt.
- `database-before-restore-*.db` faellt durch den `startsWith`-Filter (`:102`), wird nie
  gelistet, nie von `cleanOldBackups()` (`:216`) abgeraeumt, waechst unbegrenzt.
  (Deckt sich mit dem Nebenbefund des Investigators.)
- Rollback-Block in `restoreBackup` (`:196-202`) enthaelt nur Kommentare, keinen Code —
  suggeriert eine Absicherung, die nicht existiert.
- Sortierung nach `birthtime` (`:109`) ist filesystemabhaengig; der jetzt lexikografisch
  sortierbare Name bleibt ungenutzt. Randfall: `…-22-2.db` sortiert vor `…-22.db`.
- Stale Referenz: `.claude/CLAUDE.md` verweist fuer `wal_checkpoint(TRUNCATE)` auf
  `backupService.ts:39-41`; der Checkpoint steht jetzt in `:76`.
- Korrektur am Investigator-Text: das Fehlerfenster "22:00-24:00" ist UTC; in Ortszeit
  ist es 00:00-02:00 (MESZ) bzw. 00:00-01:00 (MEZ). Der Code-Kommentar
  (`backupService.ts:33-34`) hat es richtig.
