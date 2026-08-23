# 14-ROLLBACK-RUNBOOK — Rückweg für den Produktionslauf (Plan 14-08/14-09)

**Erstellt:** 2026-08-23 (Plan 14-06)
**Zweck (D8):** Ein ungetesteter Rollback-Plan ist kein Rollback-Plan. Dieser Abschnitt
dokumentiert eine **tatsächlich lokal durchgeführte** Erprobung: Sicherung ziehen, Schaden
herbeiführen, zurückspielen, Ergebnis maschinenlesbar mit dem Ausgangsstand vergleichen.
Der Ablauf für den echten Produktionsernstfall folgt in einem späteren Abschnitt dieses
Dokuments (Task 2).

---

## Erwartungswerte aus der lokalen Erprobung (Plan 14-06, Task 1)

Gemessen gegen eine ≈1,3-MB-Datenbank (20 Nutzer, 712 Zeiteinträge, 2682 Journalzeilen —
größenordnungsmäßig identisch mit der echten `production.db`, siehe `14-MIGRATIONSSTAND.md`:
`server/database/14-produktionskopie.db` lag bei 1.286.144 Bytes). Vollständiges Protokoll
mit allen Befehlen im Abschnitt „Erprobung des Rückwegs (Plan 14-06)" weiter unten.

| Operation | Dauer (lokal gemessen) | Dateigröße |
|---|---|---|
| Sicherung (`VACUUM INTO`) | 15 ms | 1.331.200 Bytes (≈ 1,3 MB) |
| Zurückspielen (`VACUUM INTO`) | 13 ms | 1.331.200 Bytes (≈ 1,3 MB) |

**Einordnung für den Ernstfall:** Ein Sicherungs- oder Rückspiellauf gegen die echte
`production.db`, der mehrere Sekunden statt Millisekunden braucht, ist ein Hinweis auf einen
hängenden Lauf oder eine ungewöhnlich groß gewordene Datenbank — dann nachsehen (`ls -la` auf
dem Server, laufender Prozess?), nicht einfach abwarten. SSH-Overhead (Verbindungsaufbau,
Netzwerklatenz Windows-PC ↔ Oracle Cloud Frankfurt) kommt bei den Server-Befehlen zusätzlich
hinzu und ist in diesen Werten nicht enthalten — als Erwartung für die reine `VACUUM INTO`-
Operation auf dem Server gelten dieselben Millisekundenwerte, für den Gesamtablauf inklusive
SSH/`scp` eher ein bis wenige Sekunden.

---

## Ablauf für den Produktionsernstfall (Plan 14-06, Task 2)

Sechs Abschnitte: Sicherung vor dem Push, Abbruchkriterien, Rückweg A (nur Daten), Rückweg B
(Daten und Code), Verifikation nach dem Rückweg, was der Rückweg nicht zurücknimmt. Jeder
Befehl vollständig, mit explizitem `DATABASE_PATH` — kein „analog zu oben", kein Platzhalter
ohne Erklärung.

### Abschnitt 1 — Sicherung vor dem Push (Pflichtschritt von Plan 14-08)

**Warum eine eigene Sicherung nötig ist, obwohl der Deploy-Workflow bereits eine anlegt:**
`.github/workflows/deploy-server.yml`, Zeile 62-65:

```
mkdir -p /home/ubuntu/databases/backups
cp /home/ubuntu/databases/production.db \
   /home/ubuntu/databases/backups/production.predeploy_$(date +%Y%m%d_%H%M%S).db || true
```

Diese Sicherung ist als alleiniger Rückweg **nicht ausreichend**, aus zwei Gründen:
1. Sie nutzt `cp` statt `VACUUM INTO`. Bei einer WAL-aktiven Datei kann ein reiner Datei-Kopiervorgang
   die jüngsten, noch nicht in die Haupt-Datenbankdatei geschriebenen Transaktionen verlieren
   (`.planning/debug/db-stabilisierung-20260818.md`, Abschnitt „Zwei verwaiste WAL-Dateien").
2. Sie trägt `|| true` — **nicht fehlerabbrechend**. Scheitert das Kopieren (volle Platte,
   Rechteproblem), läuft das Deployment trotzdem weiter, ohne dass irgendjemand es bemerkt.

Die eigene Sicherung vor dem Push ersetzt diese Predeploy-Sicherung nicht (sie bleibt als
zusätzliches Netz bestehen), sondern kommt **zusätzlich** und ist die einzige, auf die sich
dieses Runbook verlässt.

**Befehl — Sicherung per `VACUUM INTO` über den absoluten `better-sqlite3`-Modulpfad**
(dasselbe Muster wie `scripts/sync-dev-db.sh` Schritt [3/6]):

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "DATABASE_PATH=/home/ubuntu/databases/production.db node << 'EOF'
const D = require('/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3');
const db = new D('/home/ubuntu/databases/production.db', { readonly: true });
db.exec(\"VACUUM INTO '/home/ubuntu/databases/backups/production.PRE-14-08_${TIMESTAMP}.db'\");
db.close();
EOF"
```

**Dateigröße prüfen** (muss > 0 sein):

```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "ls -la /home/ubuntu/databases/backups/production.PRE-14-08_${TIMESTAMP}.db"
```

**`integrity_check` gegen die Sicherung fahren** (nicht gegen die laufende Produktion — die
Sicherungsdatei selbst muss geprüft werden, bevor auf sie gebaut wird):

```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "DATABASE_PATH=/home/ubuntu/databases/production.db node -e \"
const D = require('/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3');
const db = new D('/home/ubuntu/databases/backups/production.PRE-14-08_${TIMESTAMP}.db', { readonly: true });
console.log(JSON.stringify(db.pragma('integrity_check')));
db.close();
\""
```

Erwartete Ausgabe: `[{"integrity_check":"ok"}]`. Alles andere: Sicherung verwerfen, Lauf
wiederholen — eine ungeprüfte Sicherung ist keine Sicherung.

**Sicherung per `scp` auf den Arbeitsrechner holen.** Eine Sicherung, die nur auf demselben
Server liegt, überlebt einen Ausfall dieses Servers nicht:

```bash
mkdir -p ./database-backups-lokal
scp -i .ssh/oracle_server.key -o StrictHostKeyChecking=no \
  ubuntu@129.159.8.19:/home/ubuntu/databases/backups/production.PRE-14-08_${TIMESTAMP}.db \
  ./database-backups-lokal/production.PRE-14-08_${TIMESTAMP}.db
```

### Abschnitt 2 — Abbruchkriterien

Wann wird zurückgerollt statt nachgebessert — jedes Kriterium mit dem Befehl, der es
feststellt:

**1. Der Health-Check antwortet nach dem Deployment nicht mit `status: ok`.**
```bash
curl -s http://129.159.8.19:3000/api/health | jq
```
Erwartet: `{"status":"ok","database":"connected",...}`. Jede andere Antwort (inkl. Timeout,
HTTP != 200, fehlendes `status`-Feld) löst Abbruch/Rückweg aus.

**2. `pm2 logs timetracking-server` zeigt einen Fehler aus `runMigrations`.**
```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "pm2 logs timetracking-server --lines 200 --nostream | grep -i 'runMigrations\|Migration.*failed\|Migration.*abgebrochen'"
```
Jeder Treffer ist ein Abbruchkriterium — `migrationRunner.ts` markiert eine Migration bei
einem Fehler in `up()` ausdrücklich NICHT als angewendet (siehe `14-PATTERNS.md`, Abschnitt 6),
die Datenbank bleibt dabei im vorherigen, konsistenten Zustand; der Fehler zeigt aber, dass
der Server nicht produktiv lauffähig ist.

**3. `PRAGMA integrity_check` auf der Produktion liefert etwas anderes als `ok`.**
```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "DATABASE_PATH=/home/ubuntu/databases/production.db node -e \"
const D = require('/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3');
const db = new D('/home/ubuntu/databases/production.db', { readonly: true });
console.log(JSON.stringify(db.pragma('integrity_check')));
console.log(JSON.stringify(db.pragma('foreign_key_check')));
db.close();
\""
```
Erwartet: `[{"integrity_check":"ok"}]` und eine leere `foreign_key_check`-Liste `[]`.

**4. Der Vorher/Nachher-Vergleich zeigt einen Nutzer mit Differenz ungleich null, der nicht
der Umstellungsfall ist.**
```bash
diff 14-SNAPSHOT-PROD-VORHER.users.json 14-SNAPSHOT-PROD-NACHHER.users.json
```
Muster aus `14-VORHER-NACHHER.md` (D5): Jede Zeile im Diff wird namentlich einem `userId`
zugeordnet (`grep -n '"userId"' 14-SNAPSHOT-PROD-VORHER.users.json`). Jeder Name außer dem
bestätigten D6-Umstellungsfall ist ein Blocker, kein Hinweis — Rückweg auslösen, nicht
weiterprüfen.

### Abschnitt 3 — Rückweg A: nur Daten

**Anwendbar,** solange der Code noch nicht ausgeliefert ist oder unverändert bleibt (Abbruch
vor `git push` oder ein Abbruchkriterium schlägt an, ohne dass zwischenzeitlich Migrationen
gelaufen sind).

**Reihenfolge:**

**1. Server stoppen:**
```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 "pm2 stop timetracking-server"
```

**2. Sicherung per `VACUUM INTO` in eine NEUE Datei zurückschreiben** (nicht direkt über
`production.db` schreiben — dieselbe Logik wie in der lokalen Erprobung, Schritt 5):
```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "DATABASE_PATH=/home/ubuntu/databases/production.db node << 'EOF'
const D = require('/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3');
const backup = new D('/home/ubuntu/databases/backups/production.PRE-14-08_${TIMESTAMP}.db', { readonly: true });
backup.exec(\"VACUUM INTO '/home/ubuntu/databases/production.RESTORED_${TIMESTAMP}.db'\");
backup.close();
EOF"
```

**3. Alte `production.db` samt `-wal` und `-shm` beiseiteschieben** (umbenennen, nicht
löschen — die alte Datei bleibt als Nachweis erhalten, für den Fall, dass der Rückweg selbst
untersucht werden muss):
```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "mv /home/ubuntu/databases/production.db /home/ubuntu/databases/production.db.PRE-ROLLBACK_${TIMESTAMP}
   mv /home/ubuntu/databases/production.db-wal /home/ubuntu/databases/production.db-wal.PRE-ROLLBACK_${TIMESTAMP} 2>/dev/null || true
   mv /home/ubuntu/databases/production.db-shm /home/ubuntu/databases/production.db-shm.PRE-ROLLBACK_${TIMESTAMP} 2>/dev/null || true"
```

**4. Neue Datei an die Stelle der alten setzen:**
```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "mv /home/ubuntu/databases/production.RESTORED_${TIMESTAMP}.db /home/ubuntu/databases/production.db"
```

**5. `pm2 start` mit vollständiger Umgebungszeile** — wörtlich aus `deploy-server.yml:161`:
```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "cd /home/ubuntu/TimeTracking-Clean/server
   pm2 delete timetracking-server || true
   SESSION_SECRET=\$(grep '^SESSION_SECRET=' .env | head -1 | cut -d= -f2)
   TZ=Europe/Berlin NODE_ENV=production DATABASE_PATH=/home/ubuntu/databases/production.db SESSION_SECRET=\$SESSION_SECRET ALLOWED_ORIGINS='tauri://localhost,https://tauri.localhost,http://tauri.localhost,http://localhost:1420' \
     pm2 start dist/server.js --name timetracking-server --cwd /home/ubuntu/TimeTracking-Clean/server --time --update-env
   pm2 save"
```

**Ausdrücklich vermerkt:** **Nur `pm2 start` mit gesetztem `DATABASE_PATH`.** Ohne die
Variable legt der Server eine leere Datenbank an (`server/database.db` existiert seit
20.08.2026 nicht mehr als Symlink, siehe `.claude/CLAUDE.md` „Database Rules"); ohne
`TZ=Europe/Berlin` rechnet er in UTC — beides bereits einmal produktionswirksam gewesen
(`.planning/debug/db-stabilisierung-20260818.md`).

**6. Health-Check:**
```bash
curl -s http://129.159.8.19:3000/api/health | jq
```

**7. Funktionstest:** Anmeldung als ein bekannter Nutzer (Desktop-App oder
`curl -s -c cookies.txt -X POST http://129.159.8.19:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"<user>","password":"<pw>"}'`),
danach ein Kontoauszug-Aufruf desselben Nutzers.

### Abschnitt 4 — Rückweg B: Daten und Code

**Anwendbar,** sobald `runMigrations()` gelaufen ist — nach `git push origin main`, unabhängig
davon, ob der Server bereits neu gestartet wurde.

**Begründung:** Ein reines Zurückspielen der Daten (Rückweg A) ist in diesem Fall
**wirkungslos**, weil der nächste PM2-Neustart die Migrationen 008–015 (bzw. jede weitere,
mit Plan 14-08 hinzugekommene Migration) über `runMigrations()` erneut anwendet
(`server/src/server.ts:215`) — die Datenbank würde sofort wieder auf den neuen Stand
vorrücken. Code und Daten müssen deshalb **gemeinsam** zurückgenommen werden.

**Reihenfolge:**

**1. Veröffentlichten Stand auf den Commit vor Plan 14-08 zurücksetzen.** Der Commit-Hash
`0f2a03e` ist der Stand, auf dem `origin/main` vor Plan 14-08 stand (gemessen per
`git ls-remote origin main` am 23.08.2026 — Ergebnis:
`0f2a03efba0d5c7880407290be2c4caf9a88184d refs/heads/main`):
```bash
git push origin +0f2a03e:main
```
**Ausdrücklich als Historienumschreibung gekennzeichnet:** Dieser Befehl schreibt die
Historie von `origin/main` um (Force-Push) und wird **nur im Ernstfall** ausgeführt, nicht
routinemäßig. Die Alternative `git revert` wurde geprüft und verworfen: Bei über 337 Commits
zwischen einem Revert-Ziel und `HEAD` erzeugt ein einzelner `git revert <merge-commit>` oder
eine Kette von Einzel-Reverts keinen sinnvoll prüfbaren Zustand (Merge-Konflikte über
Dutzende Dateien, kein Weg, das Ergebnis vor dem Deployment manuell zu verifizieren) — ein
direktes Zurücksetzen auf einen bekannten guten Commit ist die einzige Option, die in der
verfügbaren Zeit eines Ernstfalls nachvollziehbar bleibt.

**2. Deploy-Workflow abwarten und prüfen:**
```bash
gh run list --workflow="deploy-server.yml" --limit 1
```
Erwartung: `status: completed`, `conclusion: success`. Bei `failure`:
`gh run view <run-id> --log` und danach trotzdem mit Schritt 3 fortfahren — der Code-Stand
auf `origin/main` ist bereits zurückgesetzt, die Datenbank muss unabhängig davon konsistent
gemacht werden.

**3. Danach Rückweg A für die Daten** (Abschnitt 3, Schritte 1–7 vollständig, mit demselben
oder einem neuen `${TIMESTAMP}`, falls seit Schritt 1 dieses Abschnitts Zeit vergangen ist).

**4. Health-Check und Funktionstest** wie in Rückweg A, Schritte 6–7.

### Abschnitt 5 — Verifikation nach dem Rückweg

**1. Health-Check:**
```bash
curl -s http://129.159.8.19:3000/api/health | jq
```

**2. Echter Funktionstest** — nicht nur der Health-Check: Anmeldung eines bekannten Nutzers
und Aufruf seines Kontoauszugs (Desktop-App gegen die Produktions-URL oder `curl` mit
Session-Cookie, siehe Abschnitt 3 Schritt 7).

**3. `PRAGMA integrity_check`:**
```bash
ssh -i .ssh/oracle_server.key -o StrictHostKeyChecking=no ubuntu@129.159.8.19 \
  "DATABASE_PATH=/home/ubuntu/databases/production.db node -e \"
const D = require('/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3');
const db = new D('/home/ubuntu/databases/production.db', { readonly: true });
console.log(JSON.stringify(db.pragma('integrity_check')));
db.close();
\""
```

**4. Kennzahlenvergleich gegen die zurückgespielte Sicherung** — dieselbe Kennzahlentabelle
wie in der lokalen Erprobung (Schritt 6 dieses Dokuments): `integrity_check`,
`foreign_key_check`, Migrationsliste, `overtime_transactions`/`overtime_balance`
COUNT/SUM, `users`/`time_entries`/`absence_requests` COUNT, `user_work_periods` COUNT.
Jede Differenz zur Sicherung außerhalb der bewusst zurückgenommenen Änderung ist ein neuer
Blocker.

**Ausdrücklich vermerkt:** Frische Daten sind wegen WAL per direktem Dateizugriff nicht
sichtbar (`14-CONTEXT.md`, „Existing Code Insights") — die Prüfung läuft deshalb über die API
(`curl .../api/health`, Funktionstest) oder `pm2 logs timetracking-server`, nicht über ein
direktes Lesen der `.db`-Datei während der Server läuft. Die `PRAGMA`-Befehle in diesem
Abschnitt laufen bewusst bei **gestopptem** Server (Rückweg A/B, Schritt 1) bzw. gegen die
bereits zurückgespielte, vom laufenden Server verwaltete Datei — nicht als Live-Abfrage
gegen einen aktiven WAL-Schreibprozess.

### Abschnitt 6 — Was der Rückweg nicht zurücknimmt

**Ein bereits veröffentlichtes Desktop-Release (Plan 14-11) lässt sich nicht zurückziehen,**
sobald Anwender es über die Auto-Update-Funktion gezogen haben. Deshalb liegt das Release in
der Planreihenfolge **nach** der Produktionsverifikation und nicht davor (D7,
`14-CONTEXT.md`) — ein Rückweg, der vor dem Release stattfindet, trifft keine
Anwender-Clients; ein Rückweg nach dem Release kann die Server-Seite zurücknehmen, aber
nicht die bereits installierte Desktop-Version.

**Zeiteinträge, die Anwender nach der Sicherung und vor dem Rückspielen erfassen, gehen beim
Rückweg verloren.** Das ist eine technische Grenze, keine Nachlässigkeit: Der Rückweg ersetzt
die Datenbankdatei durch den Stand der Sicherung, jede Schreibung danach ist im
zurückgespielten Stand nicht enthalten. Daraus folgt die Empfehlung, das Produktionsfenster
für Plan 14-08/14-09 außerhalb der Arbeitszeit der Stiftung zu legen und die Zeitspanne
zwischen Sicherung und der Entscheidung „zurückrollen oder nicht" so kurz wie möglich zu
halten (Abbruchkriterien, Abschnitt 2, sofort nach dem Deployment prüfen, nicht erst am
nächsten Tag).

---

**Zielobjekt:** `server/database/14-generalprobe.db` — die migrierte Arbeitskopie aus Plan
14-04, die in Plan 14-05 bereits einen echten Modellwechsel (Generalprobenfall userId 2,
Karin Jochem) erhalten hat. Es wird also gegen einen Stand mit echter Schreibwirkung geprobt,
nicht gegen eine leere Datenbank.

**Kein Befehl dieses Abschnitts berührt `production.db` oder eine SSH-Verbindung** — alle
Operationen laufen ausschließlich gegen lokale Dateien unter `server/database/`.

### Schritt 1 — Kennzahlen des Ausgangsstands erheben

```
$ cd server && node -e "... readonly gegen ./database/14-generalprobe.db ..."
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
migrations count: 18
overtime_transactions: {"c":2682,"s":-343.48}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":21}
time_entries: {"c":712}
absence_requests: {"c":43}
--- Generalprobenfall (userId 2) ---
overtime_transactions userId=2: {"c":194,"s":79.2}
user_work_periods userId=2: {"c":2}
```

**Saldo des Generalprobenfalls (userId 2)**, erhoben über dasselbe Werkzeug wie in Plan 14-05
(`snapshot:balances`, Lesepfad `unifiedOvertimeService.calculatePeriodOvertime()`):

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npm run snapshot:balances -- \
    --user=2 --asOf=2026-08-21 --json=../.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-RB-BASELINE.json
...
$ node -e "... liest 14-SNAPSHOT-RB-BASELINE.json, druckt overtimePeriod.overtime für userId 2 ..."
userId 2 overtimePeriod.overtime 29.599999999999923
```

Saldo Ausgangsstand: **29,6 h** (identisch mit dem in `14-VORHER-NACHHER.md` protokollierten
Saldo „nach dem Lauf" aus Plan 14-05 — konsistent, da `14-generalprobe.db` seit Plan 14-05
unverändert war).

### Schritt 2 — Sicherung ziehen nach Produktionsmuster (`VACUUM INTO`, nicht `cp`)

Zielverzeichnis `server/database/backups/` existierte noch nicht und wurde angelegt
(`mkdir -p`). Namensmuster lokal nachgebildet aus dem Produktionsmuster
`production.PRE-<plan>_<YYYYMMDD>_<HHMMSS>.db` (06-07-SUMMARY.md):

```
$ cd server && mkdir -p database/backups
$ node -e "
const D = require('better-sqlite3');
const src = new D('./database/14-generalprobe.db', { readonly: true });
src.exec(\"VACUUM INTO './database/backups/generalprobe.PRE-14-06_20260823_024004.db'\");
src.close();
"
VACUUM INTO abgeschlossen
```

**Ergebnisdatei:** `server/database/backups/generalprobe.PRE-14-06_20260823_024004.db`,
1331200 Bytes.

**Bewusst `VACUUM INTO`, nicht `cp`** — genau der Unterschied, an dem der Predeploy-Backup-
Befehl im Deploy-Workflow schwach ist (siehe Abschnitt „Sicherung vor dem Push" weiter unten
und `.planning/debug/db-stabilisierung-20260818.md`: ein `cp` auf eine WAL-aktive Datei kann
die jüngsten, noch nicht in die Haupt-Datei geschriebenen Transaktionen verlieren).

**Laufzeit gemessen** (separate Zeitmessung mit einer wegwerfbaren Prüfdatei, identische
Quelle, identisches Ergebnis — Beleg für die Erwartungswerte weiter unten):

```
$ node -e "... VACUUM INTO in eine Wegwerf-Datei, Date.now()-Differenz ..."
Dauer VACUUM INTO (Sicherung): 15 ms
Dateigroesse: 1331200 Bytes
Timing-Probe-Datei geloescht
```

### Schritt 3 — Sicherung prüfen, bevor auf sie gebaut wird

```
$ cd server && node -e "... prüft server/database/backups/generalprobe.PRE-14-06_20260823_024004.db ..."
Dateigroesse: 1331200 Bytes (> 0: true )
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
migrations count: 18
overtime_transactions: {"c":2682,"s":-343.48}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":21}
time_entries: {"c":712}
absence_requests: {"c":43}
```

| Kennzahl | Schritt 1 (Ausgangsstand) | Sicherungsdatei (Schritt 3) | Differenz |
|---|---|---|---|
| `integrity_check` | ok | ok | — |
| `foreign_key_check` | leer | leer | — |
| Migrationsanzahl | 18 | 18 | 0 |
| `overtime_transactions` COUNT | 2682 | 2682 | **0** |
| `overtime_transactions` SUM(hours) | −343.48 | −343.48 | **0** |
| `overtime_balance` COUNT | 144 | 144 | **0** |
| `overtime_balance` SUM(targetHours) | 6267.3 | 6267.3 | **0** |
| `overtime_balance` SUM(actualHours) | 3435.19 | 3435.19 | **0** |
| `users` COUNT | 20 | 20 | **0** |
| `user_work_periods` COUNT | 21 | 21 | **0** |
| `time_entries` COUNT | 712 | 712 | **0** |
| `absence_requests` COUNT | 43 | 43 | **0** |

Eine ungeprüfte Sicherung ist keine Sicherung — alle Zahlen stimmen, bevor auf die Sicherung
gebaut wird.

### Schritt 4 — Schaden herbeiführen (damit der Rückweg etwas zu tun hat)

Gelöscht in `14-generalprobe.db`: alle `overtime_transactions`-Zeilen des Generalprobenfalls
(userId 2) und seine jüngste Arbeitszeitperiode (`id=21`, `validFrom=2026-06-01` — genau die
Periode, die der Modellwechsel aus Plan 14-05 angelegt hat).

```
$ cd server && node -e "... db.transaction(): DELETE overtime_transactions WHERE userId=2; DELETE user_work_periods WHERE id=21 ..."
=== VOR dem Schaden ===
overtime_transactions userId=2: {"c":194}
user_work_periods userId=2: {"c":2}
overtime_transactions gesamt: {"c":2682}
user_work_periods gesamt: {"c":21}
juengste Periode userId=2: {"id":21,"validFrom":"2026-06-01"}
Geloeschte overtime_transactions-Zeilen: 194
Geloeschte user_work_periods-Zeile (juengste, id=21): 1
=== NACH dem Schaden ===
overtime_transactions userId=2: {"c":0}
user_work_periods userId=2: {"c":1}
overtime_transactions gesamt: {"c":2488}
user_work_periods gesamt: {"c":20}
```

Vollständiger Kennzahlensatz nach dem Schaden:

```
$ cd server && node -e "... readonly gegen die beschädigte 14-generalprobe.db ..."
integrity_check: [{"integrity_check":"ok"}]
overtime_transactions: {"c":2488,"s":-422.68}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":20}
```

| Kennzahl | Schritt 1 (Ausgangsstand) | nach dem Schaden (Schritt 4) | Differenz |
|---|---|---|---|
| `overtime_transactions` COUNT | 2682 | 2488 | **−194** (messbare Abweichung) |
| `overtime_transactions` SUM(hours) | −343.48 | −422.68 | **−79.2** |
| `user_work_periods` COUNT | 21 | 20 | **−1** (messbare Abweichung) |
| `overtime_transactions` userId=2 COUNT | 194 | 0 | **−194** |
| `user_work_periods` userId=2 COUNT | 2 | 1 | **−1** |
| `overtime_balance` COUNT/Summen | unverändert | unverändert | 0 (Tabelle nicht direkt gelöscht — nur Journal/Perioden) |
| `integrity_check` | ok | ok | — (Löschung ist syntaktisch gültiges SQL, kein Strukturschaden) |

**Nachweis erbracht:** Sowohl `COUNT(*) FROM overtime_transactions` (2682 → 2488, −194) als
auch `COUNT(*) FROM user_work_periods` (21 → 20, −1) sind gegenüber Schritt 1 nachweislich
kleiner geworden — der Rückweg hat jetzt etwas zu tun.

### Schritt 5 — Zurückspielen auf eine Kopie (nicht über die beschädigte Datei schreiben)

Der Ernstfall auf dem Server arbeitet ebenfalls mit einer neuen Datei, die anschließend an
die Stelle der alten tritt (siehe Abschnitt „Rückweg A" weiter unten) — dieselbe Logik wird
hier erprobt:

```
$ cd server && node -e "
const D = require('better-sqlite3');
const backup = new D('./database/backups/generalprobe.PRE-14-06_20260823_024004.db', { readonly: true });
backup.exec(\"VACUUM INTO './database/14-rollback-probe.db'\");
backup.close();
"
Dauer VACUUM INTO (Ruecksspielen auf Kopie): 13 ms
Dateigroesse 14-rollback-probe.db: 1331200 Bytes
```

### Schritt 6 — Vergleichen: `14-rollback-probe.db` gegen Schritt 1

```
$ cd server && node -e "... readonly gegen ./database/14-rollback-probe.db ..."
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
migrations count: 18
overtime_transactions: {"c":2682,"s":-343.48}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":21}
time_entries: {"c":712}
absence_requests: {"c":43}
overtime_transactions userId=2: {"c":194,"s":79.2}
user_work_periods userId=2: {"c":2}
```

**Saldo-Vergleich des Generalprobenfalls** (`snapshot:balances --user=2` gegen die
zurückgespielte Kopie):

```
$ cd server && DATABASE_PATH=./database/14-rollback-probe.db npm run snapshot:balances -- \
    --user=2 --asOf=2026-08-21 --json=../.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-RB-RESTORED.json
...
userId 2 overtimePeriod.overtime (nach Rueckspielen) 29.599999999999923
```

| Kennzahl | Schritt 1 (Ausgangsstand) | Schritt 6 (`14-rollback-probe.db`) | Differenz |
|---|---|---|---|
| `integrity_check` | ok | ok | — |
| `foreign_key_check` | leer | leer | — |
| Migrationsanzahl | 18 | 18 | **0** |
| `overtime_transactions` COUNT | 2682 | 2682 | **0** |
| `overtime_transactions` SUM(hours) | −343.48 | −343.48 | **0** |
| `overtime_balance` COUNT | 144 | 144 | **0** |
| `overtime_balance` SUM(targetHours) | 6267.3 | 6267.3 | **0** |
| `overtime_balance` SUM(actualHours) | 3435.19 | 3435.19 | **0** |
| `overtime_balance` SUM(carryoverFromPreviousYear) | 0 | 0 | **0** |
| `users` COUNT | 20 | 20 | **0** |
| `user_work_periods` COUNT | 21 | 21 | **0** |
| `time_entries` COUNT | 712 | 712 | **0** |
| `absence_requests` COUNT | 43 | 43 | **0** |
| `overtime_transactions` userId=2 COUNT | 194 | 194 | **0** |
| `overtime_transactions` userId=2 SUM(hours) | 79.2 | 79.2 | **0** |
| `user_work_periods` userId=2 COUNT | 2 | 2 | **0** |
| **Saldo Generalprobenfall (userId 2)** | 29.599999999999923 h | 29.599999999999923 h | **0** |

**Jede Zahl identisch, alle Differenzen exakt 0.** Der Rückweg funktioniert: `integrity_check`
= `ok`, `foreign_key_check` leer, Migrationsliste identisch, Saldo des Generalprobenfalls
wieder auf dem Wert von Schritt 1.

### Schritt 7 — Zeitmessung (Erwartungswerte für den Ernstfall)

| Operation | Dauer | Dateigröße |
|---|---|---|
| Sicherung (`VACUUM INTO`, Schritt 2) | 15 ms | 1.331.200 Bytes (≈ 1,3 MB) |
| Zurückspielen (`VACUUM INTO`, Schritt 5) | 13 ms | 1.331.200 Bytes (≈ 1,3 MB) |

**Einordnung für den Ernstfall:** Diese Werte gelten für die ≈1,3-MB-Kopie des Generalprobe-
Bestands (20 Nutzer, 712 Zeiteinträge, 2682 Journalzeilen). Die echte Produktionsdatenbank ist
größenordnungsmäßig vergleichbar (production.db lag zuletzt bei ≈1,3 MB, siehe
`14-MIGRATIONSSTAND.md`), so dass diese Millisekundenwerte als grobe Erwartung taugen: Ein
Sicherungs- oder Rückspiellauf, der mehrere Sekunden statt Millisekunden braucht, ist ein
Hinweis auf einen hängenden Lauf oder eine ungewöhnlich große Datenbank — dann nachsehen,
nicht einfach abwarten.

### Schritt 8 — Aufräumen: `14-generalprobe.db` wiederherstellen

Die beschädigte `14-generalprobe.db` (samt WAL/SHM) wurde entfernt und aus der geprüften
Sicherung neu aufgebaut — **nicht** aus `14-rollback-probe.db` zurückkopiert, sondern erneut
per `VACUUM INTO` direkt aus der Sicherungsdatei, damit der Wiederherstellungsweg identisch
zum Ernstfall bleibt:

```
$ cd server && rm -f database/14-generalprobe.db database/14-generalprobe.db-wal database/14-generalprobe.db-shm
$ node -e "
const D = require('better-sqlite3');
const backup = new D('./database/backups/generalprobe.PRE-14-06_20260823_024004.db', { readonly: true });
backup.exec(\"VACUUM INTO './database/14-generalprobe.db'\");
backup.close();
"
14-generalprobe.db aus der Sicherung wiederhergestellt
```

**Kennzahlensatz nach der Wiederherstellung:**

```
$ cd server && node -e "... readonly gegen die wiederhergestellte 14-generalprobe.db ..."
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
migrations count: 18
overtime_transactions: {"c":2682,"s":-343.48}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":21}
time_entries: {"c":712}
absence_requests: {"c":43}
overtime_transactions userId=2: {"c":194,"s":79.2}
user_work_periods userId=2: {"c":2}
```

Identisch mit Schritt 1 in jeder Zahl (siehe Vergleichstabelle Schritt 6 — dieselben Werte).

**Kettenprüfung gegen die wiederhergestellte Kopie:**

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npm run check:period-chains
==============================================================================
BESTANDS-CHECK ARBEITSZEITPERIODEN (checkAllPeriodChains)
==============================================================================
Datenbank: ./database/14-generalprobe.db

✅ Keine Befunde — jeder nicht gelöschte Nutzer hat eine lückenlose
   Periodenkette ab seinem Eintrittsdatum.
EXIT_CODE=0
```

**Temporäre Prüfkopie aufgeräumt:**

```
$ cd server && rm -f database/14-rollback-probe.db database/14-rollback-probe.db-wal database/14-rollback-probe.db-shm
14-rollback-probe.db entfernt
```

**Kontrolle: unbeteiligte Datenbanken unangetastet**

```
$ node -e "... readonly gegen 14-produktionskopie.db ..."
integrity_check: [{"integrity_check":"ok"}]
overtime_transactions: {"c":2671,"s":-372.68}
users: {"c":20}
```
Identisch mit dem in `14-04-SUMMARY.md` protokollierten Stand (`14-produktionskopie.db`
wurde von diesem Plan nicht geöffnet außer readonly zur Kontrolle).

```
$ node -e "... readonly gegen development.db ..."
COUNT users: {"c":30}
COUNT user_work_periods: {"c":30}
```
Identisch mit dem in `14-MIGRATIONSSTAND.md`/`14-05-SUMMARY.md` protokollierten Stand.
`development.db` wurde ausschließlich readonly geöffnet.

```
$ tasklist //FI "PID eq 39860"   → node.exe, PID 39860, weiterhin aktiv (Dev-Server)
$ tasklist //FI "PID eq 26124"   → node.exe, PID 26124, weiterhin aktiv (Tauri-Prozess)
```
Beide vom Anwender gestarteten Prozesse liefen während der gesamten Erprobung unverändert
weiter, wurden nicht beendet.

---

### Ergebnis der Erprobung

**Der Rückweg ist erprobt, nicht nur beschrieben:** Eine Sicherung wurde nach dem
Produktionsnamensmuster gezogen (`VACUUM INTO`, nicht `cp`), geprüft, ein echter Schaden an
einem Datensatz mit Schreibwirkung herbeigeführt (194 Journalzeilen + 1 Arbeitszeitperiode
gelöscht), auf eine neue Datei zurückgespielt und mit einem maschinenlesbaren
Kennzahlenvergleich (13 Kennzahlen inkl. Saldo) gegen den Ausgangsstand verglichen — jede
Differenz exakt `0`. Die Arbeitskopie `14-generalprobe.db` wurde anschließend auf denselben
Ausgangsstand zurückgeführt (ebenfalls kennzahlengenau belegt), damit Folgepläne wieder auf
dem Stand nach Plan 14-05 aufsetzen. `14-produktionskopie.db`, `development.db` und die
laufenden lokalen Prozesse blieben während der gesamten Erprobung unangetastet.
