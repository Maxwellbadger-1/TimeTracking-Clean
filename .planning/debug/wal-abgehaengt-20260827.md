# DRINGEND — Abgehängte WAL-Datei der Produktionsdatenbank

**Angelegt:** 27.08.2026, ca. 22:40 Ortszeit (20:40 UTC)
**Status:** GELÖST am 27.08.2026, 20:52 UTC — kein Datenverlust (siehe Nachtrag und Abschluss am Dateiende)
**Nächster Schritt:** `/gsd:debug` mit diesem Dokument als Einstieg

---

## ⛔ Das Wichtigste zuerst

**Der Serverprozess `timetracking-server` darf NICHT beendet oder neu gestartet werden.**

Kein `pm2 restart`, kein `pm2 stop`, kein `git push` auf `main` (löst Deployment mit
PM2-Neustart aus), kein Reboot.

Bei einem Neustart gehen **alle Änderungen seit dem 27.08.2026, 11:26 UTC** verloren —
darunter der erste reale Arbeitszeitmodellwechsel (Nutzer 16, Benedikt Jochem, 30 → 40 h ab
01.08.2026), den der Anwender am selben Abend eingetragen hat.

---

## Der Befund

Der Serverprozess (PID zum Zeitpunkt der Aufnahme: 3701715) hält folgende Dateizeiger:

```
fd 19 → /home/ubuntu/databases/production.db
fd 20 → /home/ubuntu/databases/production.db-wal  (deleted)
fd 21 → /home/ubuntu/databases/production.db-shm  (deleted)
```

Die Schreibprotokoll-Datei (WAL), in die der Server schreibt, ist **aus dem Dateisystem
gelöscht**. Der Prozess hält sie über einen offenen Dateizeiger weiter und kann sie lesen und
beschreiben — kein anderer Prozess kann das.

Dateizustände auf der Platte (Stand 20:22 UTC):

```
production.db       1740800 B   27. Aug 03:00   ← Stand des Nachtlaufs
production.db-shm     32768 B   27. Aug 20:21   ← neu, von Fremdverbindungen
production.db-wal         0 B   27. Aug 11:26   ← neu und leer
```

Die Hauptdatei trägt den Stand von **03:00 Uhr** (dem nächtlichen `fix-overtime.ts`-Lauf).
Seither hat sie keinen Prüfpunkt mehr gesehen — ihr Änderungszeitpunkt bewegt sich nicht.

### Nachweis, dass die Daten wirklich auseinanderlaufen

| | Anwendung (Serverprozess) | Datei auf Platte |
|---|---|---|
| Perioden Nutzer 16 | zwei (ab 01.01. mit 30 h, ab 01.08. mit 40 h) | **eine** (ab 01.01., 30 h) |
| `model_change`-Buchungen | eine, −28:00 h, sichtbar im Kontoauszug | **null** |
| August 2026 | Soll 152, Ist 104,5, OT −47:30 | Soll 114, Ist 94,5, OT −19:30 |
| Saldo Nutzer 16 | **−32:00 h** | **−4:00 h** |

Beides ist mehrfach gegengeprüft: die Anwendungsseite über Bildschirmfotos des Anwenders
(Monatliche Entwicklung, Überstunden-Kontoauszug mit der Modellwechsel-Buchung), die
Dateiseite über `VACUUM INTO` in eine Wegwerfkopie.

---

## Ursache

Wiederholte **Lesezugriffe von außen** auf `/home/ubuntu/databases/production.db` — im Zuge
der Zahlenprüfungen für den Anwender wurden mehrfach `VACUUM INTO`-Kopien aus einem eigenen
`npx tsx`-Prozess gezogen. SQLite räumt WAL und SHM auf, wenn sich eine Verbindung für die
letzte hält; der laufende Serverprozess wurde dabei nicht berücksichtigt. Danach legten neue
Verbindungen frische, leere WAL/SHM-Dateien an, während der Server weiter in die abgehängte
schreibt.

**Das ist derselbe Mechanismus wie im Vorfall vom 18.08.2026**
(`.planning/debug/db-stabilisierung-20260818.md`). Die Regel dagegen steht in
`.claude/CLAUDE.md` unter „Database Rules": frische Daten nicht per direktem Dateizugriff
prüfen, sondern über die API oder `pm2 logs`. Die Regel wurde zitiert und dann gebrochen.

---

## Zweiter, unabhängiger Befund: Die Backup-Funktion erzeugt defekte Dateien

Alle drei geprüften Sicherungen aus der App sind **nicht wiederherstellbar**:

| Datei | Größe | Rest zu 4096 | Öffnen |
|---|---:|---:|---|
| `database-backup-2026-08-20T00-00-00-022Z.db` | 1.528.180 | 372 | `database disk image is malformed` |
| `database-backup-2026-08-21T16-40-08-001Z.db` | 1.541.808 | 1.712 | `database disk image is malformed` |
| `database-backup-2026-08-27T20-27-22-251Z.db` | 1.910.123 | 1.387 | `unsupported file format` |

Alle liegen im Download-Ordner des Anwenders. Eine gültige SQLite-Datei hat eine Größe, die
ein Vielfaches der Seitengröße (hier 4096 B) ist — keine der drei erfüllt das.

Ursache vermutlich: Die Backup-Funktion kopiert die Datei (`copyfile`, belegt durch
`❌ Backup creation failed: Error: ENOENT ... copyfile` im Fehlerprotokoll vom 20.08.),
während in die Datenbank geschrieben wird. Bei WAL-Betrieb entsteht dabei ein zerrissener
Zwischenstand. Richtig wäre `VACUUM INTO` oder die SQLite-Backup-API.

**Folge:** Die Sicherung, die der Anwender heute Abend zur Rettung angelegt hat, ist
wertlos. Sie enthält den Umstellungsfall nicht und ließe sich ohnehin nicht einspielen.

---

## Was intakt ist

Diese Sicherungen sind mit `VACUUM INTO` gezogen, geprüft (`integrity_check: ok`) und
brauchbar — sie enthalten allerdings **nicht** die heutige Umstellung:

| Datei | Stand |
|---|---|
| `~/Downloads/TimeTracking-Sicherung-20260826_063302/production.VOR-RELEASE_20260826_063302.db` | 26.08. vor der Auslieferung |
| `~/Downloads/TimeTracking-Sicherung-20260825_033810/production.AKTUELL_20260825_033810.db` | 25.08. |
| `~/Downloads/TimeTracking-Sicherung-20260825_033810/production.VOR-DEPLOYMENT_20260823_111541.db` | 23.08. vor dem Deployment |
| auf dem Server: `/home/ubuntu/databases/backups/production.PRE-RELEASE_20260826_063302.db` | 26.08. |

---

## Aufgabe für die Untersuchung

**Ziel:** Den Stand aus der abgehängten WAL-Datei in die Hauptdatei überführen, ohne den
Prozess zu beenden — oder, falls das nicht geht, den Informationsgehalt so sichern, dass er
danach wiederhergestellt werden kann.

**Denkbare Wege, alle noch zu bewerten:**

1. **Prüfpunkt aus dem laufenden Prozess heraus erzwingen.** Der Server müsste
   `PRAGMA wal_checkpoint(TRUNCATE)` auf seiner eigenen Verbindung ausführen. Zu klären: Gibt
   es einen Endpunkt, der das auslöst oder auslösen kann? Reicht ein Schreibvorgang über die
   API, damit der automatische Prüfpunkt greift (Standardschwelle 1000 Seiten)? Der
   Änderungszeitpunkt der Hauptdatei zeigt, ob es gewirkt hat.

2. **Datenexport über die API.** Alles, was der Server sieht, über seine eigenen Endpunkte
   auslesen und als Datei sichern. Rettet den Informationsgehalt, nicht die Datei.

3. **Die WAL-Datei über den Dateizeiger des Prozesses lesen.** `/proc/3701715/fd/20` ist
   lesbar, solange der Prozess läuft. Ob sich daraus zusammen mit der Hauptdatei ein
   konsistenter Stand herstellen lässt, ist zu prüfen — die Reihenfolge (erst Hauptdatei
   kopieren, dann WAL) ist dabei entscheidend.

4. **Kontrollierter Neustart mit sauberem Schließen.** Nur wenn belegt ist, dass die
   Anwendung beim Beenden `db.close()` aufruft und SQLite dabei den Prüfpunkt setzt. **Ohne
   diesen Beleg ist das Datenverlust.** Zu prüfen: `server/src/server.ts`, Signalbehandlung.

**Reihenfolge:** Erst Weg 2 oder 3 (sichern), dann Weg 1 (reparieren), Weg 4 nur als letztes
und nur mit Nachweis.

---

## Was die Untersuchung NICHT tun darf

- **Keine weiteren Verbindungen von außen** auf `/home/ubuntu/databases/production.db` —
  weder lesend noch mit `VACUUM INTO`. Genau das hat den Schaden verursacht. Prüfungen
  ausschließlich über die API oder `pm2 logs`.
- Kein `pm2 restart` / `stop` / `reload`, kein `git push` auf `main`, kein Deployment.
- Keine Wiederherstellung aus einer der drei defekten App-Sicherungen.

---

## Zustand des Milestones, unabhängig von diesem Vorfall

Milestone v3.0 ist inhaltlich abgeschlossen: Phasen 9 bis 14.2 fertig, Produktion läuft auf
`eaf5f5c`, Desktop-Release **v1.9.0** ist veröffentlicht und beim Anwender installiert. Der
Anwender hat die ausgelieferten Zahlen selbst gegengeprüft und bestätigt (Benedikt Jochem,
acht Monate auf die Minute). Der erste reale Umstellungsfall wurde erfolgreich eingetragen —
die Vorschau versprach −32:00 h, das Ergebnis lautete −32:00 h.

**Offen nach diesem Vorfall:**

- die Rettung des Standes (dieses Dokument)
- die defekte Backup-Funktion (eigener Befund, gehört in einen Folge-Milestone)
- Plan 14-09 formal abschließen, sobald der Stand gesichert ist
- 89 Abnahme-Entscheidungen, 10 Warnungen aus `14-WEITERE-BEFUNDE.md`, AB-01 und AB-02 aus
  `.planning/phases/14-absicherung-und-auslieferung/deferred-items.md`
- Milestone-Abschluss: `/gsd:audit-milestone` → `/gsd:complete-milestone` → `/gsd:cleanup`

---

# NACHTRAG — Untersuchung 27.08.2026, 20:38–20:50 UTC

**Status: ENTWARNUNG.** Es ist nichts verloren. Beide Befunde des ursprünglichen
Dokuments haben sich anders aufgelöst als angenommen.

## 1. Der Stand ist bereits in der Hauptdatei

Der Anwender hat gegen 20:27 in der App ein Backup angelegt. `createBackup()`
(`server/src/services/backupService.ts:39-41`) führt vor dem Kopieren
`db.pragma('wal_checkpoint(TRUNCATE)')` **auf der eigenen Verbindung des Servers** aus —
also genau den Prüfpunkt, den „Weg 1" des Dokuments suchte. Belege:

- `production.db` trägt mtime `2026-08-27 20:27:22.266` (vorher 03:00) — es wurde geschrieben.
- Der WAL-Header der abgehängten Datei zeigt `ckpt_seq = 4` und einen frischen Salt
  (`e0621bed/acf9a2ca`) — die WAL wurde zurückgesetzt.
- Die 115 Frames darin sind alle *nach* diesem Reset entstanden.

Die Panik-Sicherung des Anwenders hat die Datenbank also gerettet.

## 2. Die 115 WAL-Frames enthalten keine Fachdaten

Auswertung der abgehängten WAL über `/proc/3701715/fd/20`:

| Kennzahl | Wert |
|---|---|
| Frames gesamt / gültig | 115 / 115 |
| betroffene Seiten (unique) | **1** — Seite 5 |
| Seite 5 laut `sqlite_master` | `sqlite_sequence` |
| `nTruncate` je Commit | 425 Seiten = 1.740.800 B (= Hauptdatei) |

Vergleich zweier Kopien (Hauptdatei mit angehängter WAL vs. ohne):

| | mit WAL | ohne WAL |
|---|---|---|
| `integrity_check` | ok | ok |
| Perioden Nutzer 16 | id 5 (01.01.→01.08., 30 h), **id 21 (ab 01.08., 40 h)** | **identisch** |
| `overtime_transactions` | 3843 Zeilen, max id 38097 | identisch |
| `user_work_periods` | 21 Zeilen, max id 21 | identisch |
| `sqlite_sequence.overtime_balance` | 67276 | 67161 |

Einziger Unterschied: der AUTOINCREMENT-Zähler, Differenz **genau 115** — die 115 Frames.
Der Modellwechsel (Periode id 21, `createdAt 2026-08-27 11:33:54`) steht bereits auf der Platte.

## 3. Die Backup-Funktion ist NICHT defekt — der Download-Weg ist es

Alle 31 App-Sicherungen in `/home/ubuntu/TimeTracking-Clean/backups/` sind
seitenausgerichtet (`size % 4096 == 0`); die drei aus dem Dokument geprüft:
`integrity_check: ok`.

| Datum | auf dem Server | beim Anwender | Delta |
|---|---:|---:|---:|
| 20.08. | 1.409.024 | 1.528.180 | +8,5 % |
| 21.08. | 1.421.312 | 1.541.808 | +8,5 % |
| 27.08. | 1.740.800 | 1.910.123 | +9,7 % |

**Ursache:** `desktop/src/lib/tauriHttpClient.ts`

```ts
const text = await response.text();   // Zeile 81  — Binärkörper als UTF-8 dekodiert
return new Response(text, { ... });   // Zeile 127 — als UTF-8 neu kodiert
```

Jedes Byte ohne gültige UTF-8-Sequenz wird zu `U+FFFD` (3 Bytes). `BackupPage.tsx:129`
ruft `response.blob()` erst danach auf und erhält bereits zerstörte Bytes.
**`desktop/src/api/exports.ts:132,173` nehmen denselben Weg** — Excel- und PDF-Exporte
sind mit hoher Wahrscheinlichkeit genauso betroffen (noch zu verifizieren).

Der ursprünglich vermutete `copyfile`-Fehler vom 20.08. war ein `ENOENT` (fehlendes
Verzeichnis), nicht ein zerrissener Zwischenstand.

## 4. Weg 4 bleibt gesperrt — Beleg nachgetragen

`server/src/server.ts` hat **keinen** `SIGTERM`/`SIGINT`-Handler und ruft nirgends
`db.close()` beim Beenden. Ein `pm2 restart` würde den Prozess töten, der Inode der
abgehängten WAL würde freigegeben — alles seit dem letzten Prüfpunkt wäre weg.
**Erst Prüfpunkt, dann Neustart.**

## 5. Angelegte Sicherungen (Server)

`/home/ubuntu/rescue_20260827/` — reine Dateikopien, zu keinem Zeitpunkt eine
SQLite-Verbindung auf die Produktion:

| Datei | Inhalt |
|---|---|
| `ARCHIV-unberuehrt/rescue.db` | `cp` der Hauptdatei, sha256 identisch mit dem Original |
| `ARCHIV-unberuehrt/rescue.db-wal` | `cat /proc/3701715/fd/20` — die abgehängte WAL |
| `BEWEIS-production.db-shm.bin` | `cat /proc/3701715/fd/21` |
| `work-mit-wal/`, `work-ohne-wal/` | Arbeitskopien der Auswertung |

## 6. Offen

- Zustand normalisieren: `POST /api/backup` (bzw. „Backup erstellen" in der App) auslösen,
  danach `stat -c%s /proc/3701715/fd/20` prüfen → 0 Bytes = alles auf der Platte.
  Erst dann ist ein Neustart gefahrlos; er löst die abgehängten Zeiger endgültig auf.
- Verwaiste `production.db-wal` (0 B) und `production.db-shm` (32 KB) auf der Platte
  entfernen — **erst nachdem der Prozess beendet ist**.
- `tauriHttpClient.ts` reparieren (Binärantworten nicht durch `text()` schleusen).
- Prüfen, ob Excel-/PDF-Exporte denselben Defekt zeigen.

---

# ABSCHLUSS — 27.08.2026, 20:52 UTC

**Status: GELÖST. Kein Datenverlust.**

## Durchgeführte Schritte

| # | Schritt | Beleg |
|---|---|---|
| 1 | Sicherung per `cp` + `/proc/3701715/fd/20` | `rescue_20260827/ARCHIV-unberuehrt/`, sha256 identisch |
| 2 | Prüfpunkt über „Backup erstellen" in der App | `fd 20` von 473.832 B auf **0 B**, `production.db` mtime 20:49:50 |
| 3 | Kopie nach Prüfpunkt | drei Dateien mit identischer sha256 `25bbcf8c…` |
| 4 | Guards vor dem Neustart | WAL = 0 B, Prüfsumme bestätigt, 0 offene Zeiger nach Stop |
| 5 | Verwaiste `production.db-wal`/`-shm` entfernt | erst nach Prozessende, WAL nachweislich 0 B |
| 6 | `pm2 start timetracking-server` | neue PID 3732349, online |

## Zustand danach

```
fd 19 → /home/ubuntu/databases/production.db
fd 20 → /home/ubuntu/databases/production.db-wal      ← kein (deleted) mehr
fd 21 → /home/ubuntu/databases/production.db-shm      ← kein (deleted) mehr
```

`DATABASE_PATH=/home/ubuntu/databases/production.db`, `NODE_ENV=production`,
`TZ=Europe/Berlin` — alle gesetzt, auch im `dump.pm2` für den Reboot-Fall.
API antwortet mit HTTP 200. Keine neuen Fehlerzeilen im Protokoll.

Datenprüfung auf einer Kopie nach dem Neustart: `integrity_check: ok`,
Periode id 21 (ab 01.08.2026, **40 h**) vorhanden, `overtime_transactions` 3843 Zeilen,
max id 38097 — unverändert gegenüber allen Messpunkten des Abends.

## Korrektur am ursprünglichen Dokument

Die Vergleichstabelle unter „Nachweis, dass die Daten wirklich auseinanderlaufen" war zum
Aufnahmezeitpunkt korrekt, aber bereits durch die 20:27-Sicherung überholt. Der Abschnitt
„Zweiter Befund: Die Backup-Funktion erzeugt defekte Dateien" ist **falsch** — die
Backup-Funktion ist einwandfrei, der Download-Weg zerstört die Dateien. Der `ENOENT` vom
20.08. war ein fehlender Pfad (`server/database.db` nach Entfernung des Symlinks), kein
zerrissener Zwischenstand; er ist im Fehlerprotokoll bis heute nachlesbar.

## Offen (Folge-Milestone, nichts davon eilt)

1. **`desktop/src/lib/tauriHttpClient.ts` reparieren.** Zeile 81 (`response.text()`) und
   Zeile 127 (`new Response(text)`) zerstören jeden Binärkörper. Binärantworten müssen über
   `arrayBuffer()`/`blob()` laufen; die Text-Auswertung darf nur bei Textinhalten greifen
   (Prüfung über `Content-Type`).
2. **Excel-/PDF-Exporte prüfen.** `desktop/src/api/exports.ts:132,173` rufen `blob()` auf
   derselben umkodierten Antwort auf — vermutlich derselbe Defekt.
3. **`SIGTERM`/`SIGINT`-Handler in `server/src/server.ts`** mit
   `db.pragma('wal_checkpoint(TRUNCATE)')` und `db.close()`. Dann ist ein Neustart auch ohne
   vorherigen Handgriff unbedenklich.
4. Die drei defekten Dateien im Download-Ordner des Anwenders löschen — die brauchbaren
   Sicherungen liegen auf dem Server.

---

# BEHEBUNG — 27.08.2026, 23:15 Ortszeit

Die unter „Offen" gelisteten Punkte 1–3 sind im Code erledigt. **Noch nicht ausgeliefert:**
Der Serverfix wirkt erst nach einem Deployment, der Clientfix erst mit einem neuen
Desktop-Release. Die beim Anwender laufende v1.9.0 trägt den Download-Defekt weiter.

## 1. Binärsicherer HTTP-Client — `desktop/src/lib/tauriHttpClient.ts`

`response.text()` → `response.arrayBuffer()`. Der Content-Type entscheidet nur noch über die
Protokollierung, nie über den Körper; der wird immer unverändert als Bytes weitergereicht.
Zusätzlich behandelt: 204/205/304 dürfen keinen Körper tragen — `new Response(text)` warf
dort bisher einen `TypeError`.

**Korrektur des Nachtrags:** Die Excel-/PDF-Exporte gibt es im Projekt gar nicht, und die
CSV-Exporte waren **nie betroffen** — beide Routen senden `text/csv; charset=utf-8`
(`server/src/routes/exports.ts:107,273`), und UTF-8-Text übersteht den Umweg über `text()`
verlustfrei. Betroffen war ausschließlich der Backup-Download, die einzige echte Binärdatei.

Regressionstest `desktop/src/lib/tauriHttpClient.test.ts` (6 Fälle). Gegenprobe gegen den
alten Code durchgeführt: 3 Fälle schlagen fehl, die Binärdaten kommen mit **66 statt 36
Bytes** an — die U+FFFD-Aufblähung, exakt das Schadensbild. Die Textfälle (JSON, CSV mit
Umlauten) bestehen auch im alten Code und belegen die Abgrenzung.

## 2. Prüfpunkt beim Beenden — `server/src/database/connection.ts`, `server/src/server.ts`

Neu: `shutdownDatabase()` — `wal_checkpoint(TRUNCATE)`, dann `close()`, idempotent. Der
Proxy in `connection.ts` verweigert während des Herunterfahrens den automatischen Reconnect,
sonst legte ein noch feuernder Cron-Job eine frische WAL/SHM an, kurz bevor der Prozess endet.

`server.ts` registriert `SIGTERM`/`SIGINT`. Der Prüfpunkt läuft **sofort**, nicht im
`close()`-Rückruf: PM2 räumt nach `kill_timeout` (1600 ms) mit SIGKILL auf, und offene
WebSocket-Verbindungen können `httpServer.close()` beliebig lange hinhalten.

Regressionstest `server/src/database/connection.shutdown.test.ts` (3 Fälle) auf einer eigenen
Temp-Datenbank. Der erste Fall zeigt den Kontrast: vor dem Prüfpunkt kennt die Hauptdatei die
Tabelle nicht (`no such table`), danach trägt sie alle 50 Zeilen.

## 3. Prüfstand

| Prüfung | Ergebnis |
|---|---|
| `tsc --noEmit` Server / Desktop | beide sauber |
| Desktop-Tests | 56/56, davon 6 neue |
| Server-Tests | 581/584 — die 3 Fehler sind die in `vitest.config.ts` dokumentierten bekannten |
| ESLint geänderte Dateien | keine neuen Befunde; 3 `no-explicit-any` bestehen bereits in HEAD |

Hinweis für spätere Läufe: Der `forks`-Pool von Vitest bricht auf diesem Windows-Rechner mit
`Timeout starting forks runner` ab. Mit `--pool=threads` läuft die Suite durch.

## 4. Noch offen

- **Deployment des Serverfix** und **neuer Desktop-Release** — beides bewusst nicht getan.
- Die drei defekten Dateien im Download-Ordner des Anwenders löschen.
- `desktop/src/api/exports.ts:132,173` unverändert — durch den Clientfix mit abgedeckt.
