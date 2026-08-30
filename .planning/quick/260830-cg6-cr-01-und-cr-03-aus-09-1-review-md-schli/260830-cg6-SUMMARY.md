---
phase: quick-260830-cg6
plan: 01
type: execute
completed: 2026-08-30
requirements: [CR-01, CR-03, WR-16]
commits:
  - ff02de5  # CR-01
  - 66f0867  # WR-16
  - aa46319  # CR-03
---

# Quick Task 260830-cg6: CR-01, WR-16 und CR-03 — Summary

Drei unvermischte Commits auf `main`, ausgehend von `1a648d9`. **Nicht gepusht.** Es wurde
kein laufendes System angefasst: kein `ssh`, kein `gh workflow run`, kein `crontab`, kein
Zugriff auf `production.db` oder `staging.db`.

## Befund → Commit

| Befund | Commit | Dateien |
|---|---|---|
| CR-01 — crontab-Block ersatzlos streichen | `ff02de5` | `deploy-server.yml`, `deploy-staging.yml` |
| WR-16 — `setup-cron.sh` entfernen, Doku umschreiben | `66f0867` | `scripts/database/setup-cron.sh` (gelöscht), `scripts/README.md`, `ENV.md` |
| CR-03 — Migration hinter `pm2 stop`, Neustart im Fehlerpfad | `aa46319` | `deploy-server.yml`, `deploy-staging.yml`, `migrate.ts`, `validateSchema.ts` |

---

## Zeilennummern-Tabelle: vorher / nachher

Alle Zahlen mit `grep -n` gemessen, nicht behauptet. „Vorher (Task 3)" ist der Stand **nach**
Task 1 — die Baseline-Tabelle des Plans galt für den Stand vor Task 1 und war als
Ausgangsbasis für Task 3 unbrauchbar, wie der Plan selbst vermerkt.

### `.github/workflows/deploy-server.yml`

| Element | Baseline `1a648d9` | Vorher (nach Task 1) | Nachher |
|---|---|---|---|
| `npm run migrate:prod` | 104 | 104 | **180** |
| `npm run validate:schema` | 113 | 113 | **190** |
| `pm2 stop timetracking-server` | 162 | 156 | **169** |
| `pm2 delete timetracking-server` | 163 | 157 | 170 |
| `export ALLOWED_ORIGINS` | 166 | 160 | 145 |
| `start_server()` Definition | — | — | 154 |
| `pm2 start dist/server.js` | 169 | 163 | 156 (in der Funktion) |
| `pm2 save` | 174 | 168 | 161 (in der Funktion) |
| `start_server` Aufruf (Erfolgspfad) | — | — | **195** |
| Dateilänge | 235 | 229 | 256 |

**Reihenfolge nachher, gemessen:** `stop=169` < `migrate=180` < `validate=190` < `start_server=195` ✅
(Vorher galt `migrate=104` < `stop=156` — genau der von CR-03 beschriebene Zustand.)

### `.github/workflows/deploy-staging.yml`

| Element | Baseline `1a648d9` | Vorher (nach Task 1) | Nachher |
|---|---|---|---|
| `npm run migrate:prod` | 97 | 97 | **174** |
| `npm run validate:schema` | 106 | 106 | **184** |
| `pm2 stop timetracking-staging` | 153 | 148 | **163** |
| `pm2 delete timetracking-staging` | 154 | 149 | 164 |
| `export ALLOWED_ORIGINS` | 157 | 152 | 137 |
| `start_server()` Definition | — | — | 148 |
| `pm2 start dist/server.js` | 162 | 157 | 150 (in der Funktion) |
| `pm2 save` | 167 | 162 | 155 (in der Funktion) |
| `start_server` Aufruf (Erfolgspfad) | — | — | **189** |
| Dateilänge | 196 | 191 | 218 |

**Reihenfolge nachher, gemessen:** `stop=163` < `migrate=174` < `validate=184` < `start_server=189` ✅

---

## Gemessene Verify-Ergebnisse

### Task 1 (CR-01) — `ff02de5`

```
YAML/Schrittzahl:  deploy-server.yml steps=5 (erwartet 5)
                   deploy-staging.yml steps=4 (erwartet 4)
bash -n:           srv.sh 161 Zeilen, stg.sh 136 Zeilen -> Shell-Syntax OK
crontab-Befehle:   deploy-server.yml:  crontab-Befehle=0  cleanup-echo=0
                   deploy-staging.yml: crontab-Befehle=0  cleanup-echo=0
Erklaerkommentar:  D-03 + NACHWEIS-PRODUKTION + NACHWEIS-STAGING in beiden Dateien vorhanden
Toter Verweis:     'weiter unten beim Bereinigungsschritt' -> 0 Treffer
Commit-Umfang:     genau 2 Dateien
```

### Task 2 (WR-16) — `66f0867`

```
Datei entfernt (Arbeitsbaum + Index): ja
setup-cron-Verweise ausserhalb .planning: 0
  (Kontrolle: .planning/.../09.1-REVIEW.md 3 Treffer bleiben - Historie, gewollt)
fix-overtime: scripts/README.md=0   ENV.md=0
Ersatztext:   cronService.ts + startOvertimeRecalcScheduler + 03:15 + wal-abgehaengt-20260827 -> vollstaendig
ENV.md:       scripts/database/backup.sh-Verweis erhalten
Commit-Umfang: 3 Dateien (2 geaendert, 1 geloescht)
```

### Task 3 (CR-03) — `aa46319`

```
YAML/Schrittzahl:  deploy-server.yml steps=5   deploy-staging.yml steps=4   (unveraendert)
bash -n:           Shell-Syntax OK (beide)
Reihenfolge:       deploy-server.yml   stop=169 migrate=180 validate=190 start_server=195
                   deploy-staging.yml  stop=163 migrate=174 validate=184 start_server=189
Keine Duplizierung: deploy-server.yml   pm2-start-Vorkommen=1  Funktionsdefinitionen=1
                    deploy-staging.yml  pm2-start-Vorkommen=1  Funktionsdefinitionen=1
Fehlerpfad:        beide Dateien enthalten start_server UND exit 1 im migrate-Zweig
ALLOWED_ORIGINS:   deploy-server.yml  AO=145 < Funktion=154
                   deploy-staging.yml AO=137 < Funktion=148
Kopfkommentare:    migrate.ts + validateSchema.ts: 'gestopptem' und 'wal-abgehaengt-20260827' vorhanden
                   validateSchema.ts: readonly-Hinweis vorhanden
.ts-Diff:          nur Kommentarzeilen; keine entfernten Zeilen
Compiler:          cd server && npx tsc --noEmit -> tsc sauber
```

**Zusatzprüfung (nicht im Plan gefordert):** Der `pm2 start`-Aufruf wurde gegen `1a648d9`
zeichenweise verglichen (Einrückung entfernt) — in beiden Dateien **identisch**. Die vom Plan
geforderte Byte-Gleichheit des Startaufrufs ist damit belegt, nicht angenommen.

**Zeilennummern in den Kopfkommentaren geprüft:** Die Kommentare zitieren nach der Einfügung
`migrate.ts:135` (`new Database(dbPath)`) / `:172` (`db.close()`) und
`validateSchema.ts:165` (`new Database(dbPath, { readonly: true })`) / `:230` (`db.close()`).
Alle vier Zitate zeigen nach der durch die Einfügung verursachten Verschiebung auf die
richtige Zeile (gegengeprüft mit `grep -n`).

---

## Abweichungen vom Plan

### 1. [Rule 1 — Bug im Verify-Gate] Schrittzahl-Gate war auf dem Ausgangsstand rot

Der Plan schreibt in allen Verify-Blöcken `if(n!==5)` für **beide** Workflows. Gemessen auf
dem unveränderten Ausgangsstand `1a648d9`:

```
.github/workflows/deploy-server.yml steps=5
.github/workflows/deploy-staging.yml steps=4
```

`deploy-staging.yml` hat echte 4 Schritte — ihm fehlt der Schritt „Verify DB path post-deploy",
den nur die Produktionsfassung hat. Die Zahl 5 im Plan stammt aus einer Messung an
`deploy-server.yml`, die auf beide Dateien verallgemeinert wurde.

Das Gate war damit **vor** jeder Änderung rot. Die Absicht des Gates ist „Schrittzahl
unverändert" — es wurde auf die gemessene Baseline kalibriert (`server=5`, `staging=4`) und in
dieser Form bei jedem Task ausgeführt. Das Gate wurde nicht abgeschwächt: es prüft weiterhin
exakte Gleichheit, nur gegen den tatsächlichen statt gegen einen angenommenen Ausgangswert.

Die übrige Kette (`script:`-Block extrahieren → `bash -n`) war auf dem Ausgangsstand grün und
lieferte die vom Auftrag genannten Zahlen exakt: **srv 167 Zeilen, stg 141 Zeilen**.

### 2. [Rule 1 — Bug] Eigener Ersatztext verletzte das Gate von Task 2

Der erste Entwurf des README-Abschnitts enthielt den Satz „Hier stand bis Phase 9.1 das Skript
`setup-cron.sh`". Damit war Gate 2 („null Verweise auf `setup-cron` außerhalb `.planning/`")
rot — verursacht durch den eigenen Text. Der Satz wurde umformuliert („ein Skript, das dafür
einen crontab-Eintrag einrichtete"), ohne den Grabstein-Hinweis zu verlieren. Gate danach grün.

### 3. [Beobachtung] Verifikationsschritt 6 des Plans traf nicht zu

Der Plan erwartet, dass `git log origin/main..HEAD` „genau die drei neuen Commits" zeigt.
Gemessen:

```
origin/main = e4866a4
Unveroeffentlicht VOR dieser Arbeit: 7
Unveroeffentlicht JETZT:            10
Eigene Commits:                      3
```

Es lagen bereits **sieben** unveröffentlichte Commits vor (Dokumentation aus Phase 9.1). Der
nächste `git push` trägt also 10 Commits, nicht 3. Das ist kein Fehler dieser Arbeit, aber für
die Deployment-Beobachtung relevant: der Push löst das Produktions-Deployment aus.

### 4. [Ermessen, vom Plan freigestellt] Ein Commit für WR-16

`git rm` und die beiden Doku-Änderungen liegen in einem Commit (`66f0867`) — die Doku-Änderung
ohne die Löschung wäre unvollständig gewesen.

---

## Verbleibende Restrisiken

**(a) Verlängertes Wartungsfenster.** Jedes Deployment hat ab jetzt zwischen `pm2 stop` und
`start_server` eine Lücke, die um die Laufzeit von `migrate:prod` **plus** `validate:schema`
länger ist als bisher. Vorher liefen beide Schritte, während der alte Server noch bediente.
Das ist der bewusst in Kauf genommene Preis dafür, dass kein zweiter Prozess mehr auf
`production.db` zugreift, während der Server sie offen hält.

**(b) Start auf einem Stand mit fehlgeschlagener Migration.** Schlägt `migrate:prod` fehl,
startet `start_server` den Dienst wieder — auf einem Code-Stand, dessen Migration **nicht**
durchlief. Das Deployment endet mit `exit 1` und ist sichtbar rot, aber der laufende Server
kann in diesem Moment neuen Code gegen ein altes Schema ausführen. Der Fehlerfall verlangt
menschliches Hinsehen; er ist kein selbstheilender Zustand. Der Kommentar an der Stelle
benennt das ausdrücklich.

**(c) Staging-Backup zeigt auf den Altbestand (IN-07).** `deploy-staging.yml` sichert
weiterhin `cp server/database.db …` — also die unmigrierte Altdatei von April 2026, nicht die
Arbeitsdatenbank. Dieser Befund war **nicht beauftragt** und wurde unangetastet gelassen. Das
Staging-Deployment hat damit faktisch kein brauchbares Backup.

---

## Was NICHT geprüft werden konnte

**Die Workflows wurden nicht ausgeführt.** Es gab keinen Testlauf, kein `gh workflow run`,
kein Deployment, keinen SSH-Zugriff — das war ausdrücklich verboten und wurde eingehalten.

Verifiziert ist damit ausschließlich, was sich am Text prüfen lässt: YAML-Parsbarkeit,
unveränderte Schrittzahl, `bash -n` auf dem extrahierten `script:`-Block, die Reihenfolge über
gemessene Zeilennummern, die Einmaligkeit von `pm2 start`, und `tsc --noEmit`.

**Nicht verifiziert, weil dafür ein Lauf nötig wäre:**
- ob `start_server` im Fehlerzweig auf dem Server tatsächlich durchläuft (PM2-Zustand nach
  `pm2 delete` bei fehlgeschlagener Migration),
- ob `migrate:prod` bei gestopptem Server erfolgreich gegen `production.db` arbeitet,
- ob der Health-Check nach dem verlängerten Fenster noch innerhalb `sleep 5` greift —
  **dieser Punkt verdient beim ersten Lauf besondere Aufmerksamkeit**, denn der Server startet
  jetzt später im Skript, während die Wartezeit unverändert 5 Sekunden beträgt,
- das Verhalten von `set -e` im rechten `||`-Zweig auf dem echten Runner (durch `bash -n` nur
  syntaktisch, nicht semantisch abgedeckt).

---

## Nächster Schritt

**Es wurde nicht gepusht.** Der erste Deployment-Lauf nach dem Push sollte beobachtet werden:

```bash
gh run list --workflow="deploy-server.yml" --limit 1   # completed + success?
curl -s http://129.159.8.19:3000/api/health | jq       # nach 2-3 Min
```

Empfehlung: Da `deploy-staging.yml` symmetrisch geändert wurde, zeigt sich die neue
Reihenfolge zuerst gefahrlos auf Staging.

---

## Vollständiger Diff beider Workflow-Dateien

`git diff 1a648d9 -- .github/workflows/`

```diff
diff --git a/.github/workflows/deploy-server.yml b/.github/workflows/deploy-server.yml
index fdb68dd..8a85b31 100644
--- a/.github/workflows/deploy-server.yml
+++ b/.github/workflows/deploy-server.yml
@@ -99,42 +99,26 @@ jobs:
               exit 1
             fi
 
-            # Run database migrations
-            echo "🗄️  Running database migrations..."
-            DATABASE_PATH=$DATABASE_PATH NODE_ENV=production npm run migrate:prod || {
-              echo "❌ Migration failed! Deployment aborted."
-              echo "💡 Database backup available: server/database.backup.*.db"
-              exit 1
-            }
-            echo "✅ Migrations completed successfully"
-
-            # Validate database schema (non-blocking)
-            echo "🔍 Validating database schema..."
-            DATABASE_PATH=$DATABASE_PATH NODE_ENV=production npm run validate:schema || true
-            echo "✅ Schema validation completed"
+            # Migration und Schemapruefung standen bis CR-03 an dieser Stelle - also noch
+            # BEVOR der Serverprozess gestoppt wurde. Sie sind bewusst nach unten hinter
+            # "pm2 stop"/"pm2 delete" gewandert; die Begruendung steht dort.
 
             # HINWEIS: Der Schritt "Fix overtime calculations" stand frueher an dieser Stelle.
-            # Er ist seit Phase 9.1 (D-04) entfallen — Begruendung weiter unten beim
-            # Bereinigungsschritt und im Kopfkommentar von server/src/server.ts.
-
-            # Bereinigung: alten externen Cronjob-Eintrag entfernen (Phase 9.1, D-03).
-            # Der naechtliche Neuberechnungslauf laeuft seit Phase 9.1 im Serverprozess ueber
-            # den In-Prozess-Scheduler (server/src/services/cronService.ts) statt als externer
-            # Cronjob. Ein externer Cron auf das ehemalige Handbetriebs-Skript war die Ursache
-            # der taeglich abgehaengten WAL (.planning/debug/wal-abgehaengt-20260827.md): er
-            # oeffnete eine eigene Verbindung auf production.db und schloss sie am Ende
-            # selbst, wodurch SQLite WAL/SHM des laufenden Serverprozesses mit aufraeumte.
-            # Dieser Schritt entfernt einen ggf. noch vorhandenen alten Eintrag, damit sich
-            # der Server beim naechsten Deployment selbst bereinigt und kein manueller
-            # Eingriff auf dem Server noetig ist. Der Filter unten bleibt bewusst eng gefasst —
-            # auf demselben Server steht ein weiterer, woechentlicher crontab-Eintrag fuer
-            # den DB-Sync-Job, den ein breiterer Filter mitloeschen wuerde (siehe
-            # 14-AUSLIEFERUNG.md).
-            echo "🧹 Removing legacy overtime cron entry (Phase 9.1, D-03)..."
-            (crontab -l 2>/dev/null | grep -v "fix-overtime.ts") | crontab - || {
-              echo "⚠️  Cron cleanup failed, continuing..."
-            }
-            echo "✅ Cron cleanup attempted"
+            # Er ist seit Phase 9.1 (D-04) entfallen - Begruendung im Kopfkommentar von
+            # server/src/server.ts.
+            #
+            # An dieser Stelle stand bis Phase 9.1 zusaetzlich ein crontab-Bereinigungsschritt,
+            # der einen alten externen Cronjob-Eintrag auf fix-overtime.ts entfernte. Er war eine
+            # Einmal-Migration (D-03) und hat seinen Zweck erfuellt: auf beiden Servern existiert
+            # kein solcher Eintrag mehr - 09.1-NACHWEIS-PRODUKTION.md:215 und
+            # 09.1-NACHWEIS-STAGING.md:165 belegen je "grep -c fix-overtime" = 0; der crontab
+            # traegt dort nur noch den woechentlichen sync-prod-to-staging.sh.
+            # Er entfaellt ersatzlos statt gehaertet zu werden, weil "crontab -" den GESAMTEN
+            # crontab durch stdin ersetzt: scheitert "crontab -l" oder filtert "grep -v" alles
+            # weg, installiert der Schritt still einen leeren crontab, ohne dass der ||-Zweig
+            # greift. Ein Schritt ohne verbleibenden Nutzen riskiert damit den fremden
+            # Sync-Eintrag (Befund CR-01, 09.1-REVIEW.md:75).
+            # Hier steht bewusst nichts mehr - kein Deployment fasst den crontab noch an.
 
             # Create .env file if it doesn't exist
             echo "🔐 Setting up environment..."
@@ -157,21 +141,58 @@ jobs:
 
             echo "✅ Environment ready (SESSION_SECRET length: ${#SESSION_SECRET})"
 
-            # Restart PM2
-            echo "🔄 Restarting PM2..."
+            # Set ALLOWED_ORIGINS for CORS (muss gesetzt sein, bevor start_server laeuft)
+            export ALLOWED_ORIGINS='tauri://localhost,https://tauri.localhost,http://tauri.localhost,http://localhost:1420'
+
+            # Serverstart als Funktion statt als zwei Kopien: der Aufruf traegt fuenf
+            # Umgebungsvariablen und vier PM2-Optionen. Zwei Kopien driften auseinander,
+            # sobald jemand eine Variable ergaenzt - und vergessen wuerde mit hoher
+            # Wahrscheinlichkeit die im Fehlerpfad, weil sie im Normalbetrieb nie laeuft.
+            # Die Funktion wird aus zwei Pfaden gerufen: aus dem Fehlerzweig der Migration
+            # und aus dem Erfolgspfad. "pm2 save" gehoert mit hinein, damit beide Pfade
+            # PM2 in demselben wiederherstellbaren Zustand verlassen.
+            start_server() {
+              TZ=Europe/Berlin NODE_ENV=production DATABASE_PATH=$DATABASE_PATH SESSION_SECRET=$SESSION_SECRET ALLOWED_ORIGINS=$ALLOWED_ORIGINS \
+                pm2 start dist/server.js \
+                --name timetracking-server \
+                --cwd /home/ubuntu/TimeTracking-Clean/server \
+                --time \
+                --update-env
+              pm2 save
+            }
+
+            # Server anhalten, BEVOR ein Fremdprozess production.db anfasst (CR-03,
+            # .planning/debug/wal-abgehaengt-20260827.md). Ein zweiter Halter auf der Datei
+            # ist genau der Mechanismus, der die WAL des laufenden Serverprozesses abhaengt;
+            # .claude/CLAUDE.md verbietet ihn einschliesslich readonly.
+            echo "🔄 Stopping PM2 before database access..."
             pm2 stop timetracking-server || true
             pm2 delete timetracking-server || true
 
-            # Set ALLOWED_ORIGINS for CORS
-            export ALLOWED_ORIGINS='tauri://localhost,https://tauri.localhost,http://tauri.localhost,http://localhost:1420'
+            # Schlaegt die Migration fehl, wird der Server wieder gestartet, damit ein
+            # fehlgeschlagenes Deployment keinen Ausfall erzeugt. Gestartet wird dann aber
+            # auf einem Code-Stand, dessen Migration NICHT durchlief - deshalb danach
+            # "exit 1", damit der Lauf sichtbar rot ist und jemand hinsieht.
+            # Schlaegt auch start_server fehl, bleibt es bei "exit 1": "set -e" ist im
+            # rechten Zweig eines "||" ausgesetzt, der Ausstiegscode ist deshalb
+            # unabhaengig vom Erfolg des Neustarts.
+            echo "🗄️  Running database migrations (server stopped)..."
+            DATABASE_PATH=$DATABASE_PATH NODE_ENV=production npm run migrate:prod || {
+              echo "❌ Migration failed! Deployment aborted."
+              echo "💡 Database backup available: server/database.backup.*.db"
+              start_server
+              exit 1
+            }
+            echo "✅ Migrations completed successfully"
+
+            # Validate database schema (non-blocking, Server ist weiterhin gestoppt)
+            echo "🔍 Validating database schema..."
+            DATABASE_PATH=$DATABASE_PATH NODE_ENV=production npm run validate:schema || true
+            echo "✅ Schema validation completed"
 
-            TZ=Europe/Berlin NODE_ENV=production DATABASE_PATH=$DATABASE_PATH SESSION_SECRET=$SESSION_SECRET ALLOWED_ORIGINS=$ALLOWED_ORIGINS \
-              pm2 start dist/server.js \
-              --name timetracking-server \
-              --cwd /home/ubuntu/TimeTracking-Clean/server \
-              --time \
-              --update-env
-            pm2 save
+            # Erfolgspfad: Server wieder starten
+            echo "🚀 Starting PM2..."
+            start_server
 
             # Wait for server to start
             echo "⏳ Waiting for server to start..."
diff --git a/.github/workflows/deploy-staging.yml b/.github/workflows/deploy-staging.yml
index d9cc143..ab38624 100644
--- a/.github/workflows/deploy-staging.yml
+++ b/.github/workflows/deploy-staging.yml
@@ -92,40 +92,25 @@ jobs:
               exit 1
             fi
 
-            # Run database migrations
-            echo "🗄️  Running database migrations..."
-            NODE_ENV=staging npm run migrate:prod || {
-              echo "❌ Migration failed! Deployment aborted."
-              echo "💡 Database backup available: server/database.backup.*.db"
-              exit 1
-            }
-            echo "✅ Migrations completed successfully"
-
-            # Validate database schema (non-blocking)
-            echo "🔍 Validating database schema..."
-            NODE_ENV=staging npm run validate:schema || true
-            echo "✅ Schema validation completed"
+            # Migration und Schemapruefung standen bis CR-03 an dieser Stelle - also noch
+            # BEVOR der Serverprozess gestoppt wurde. Sie sind bewusst nach unten hinter
+            # "pm2 stop"/"pm2 delete" gewandert; die Begruendung steht dort.
 
             # Ueberstunden-Neuberechnung nach Deployment: seit Phase 9.1 (D-04) entfallen.
             # Der Lauf geschieht jetzt einmalig und nicht blockierend im Serverprozess nach
             # runMigrations(db) — vollstaendige Begruendung im Kopfkommentar von
             # server/src/server.ts.
 
-            # Bereinigung: alten externen Cronjob-Eintrag entfernen (Phase 9.1, D-03).
-            # Der naechtliche Neuberechnungslauf laeuft seit Phase 9.1 im Serverprozess ueber
-            # den In-Prozess-Scheduler (server/src/services/cronService.ts) statt als externer
-            # Cronjob. Ein externer Cron auf das ehemalige Handbetriebs-Skript war die Ursache
-            # der taeglich abgehaengten WAL (.planning/debug/wal-abgehaengt-20260827.md).
-            # Dieser Schritt entfernt einen ggf. noch vorhandenen alten Eintrag, damit sich
-            # der Server beim naechsten Deployment selbst bereinigt. Der Filter unten bleibt
-            # bewusst eng gefasst — auf demselben Server steht ein weiterer, woechentlicher
-            # crontab-Eintrag fuer den DB-Sync-Job, den ein breiterer Filter mitloeschen
-            # wuerde (siehe 14-AUSLIEFERUNG.md).
-            echo "🧹 Removing legacy overtime cron entry (Phase 9.1, D-03)..."
-            (crontab -l 2>/dev/null | grep -v "fix-overtime.ts") | crontab - || {
-              echo "⚠️  Cron cleanup failed, continuing..."
-            }
-            echo "✅ Cron cleanup attempted"
+            # An dieser Stelle stand bis Phase 9.1 ein crontab-Bereinigungsschritt, der einen
+            # alten externen Cronjob-Eintrag auf fix-overtime.ts entfernte. Er war eine
+            # Einmal-Migration (D-03) und hat seinen Zweck erfuellt: 09.1-NACHWEIS-PRODUKTION.md:215
+            # und 09.1-NACHWEIS-STAGING.md:165 belegen je "grep -c fix-overtime" = 0; der crontab
+            # traegt dort nur noch den woechentlichen sync-prod-to-staging.sh.
+            # Er entfaellt ersatzlos statt gehaertet zu werden, weil "crontab -" den GESAMTEN
+            # crontab durch stdin ersetzt: scheitert "crontab -l" oder filtert "grep -v" alles
+            # weg, installiert der Schritt still einen leeren crontab, ohne dass der ||-Zweig
+            # greift (Befund CR-01, 09.1-REVIEW.md:75).
+            # Hier steht bewusst nichts mehr - kein Deployment fasst den crontab noch an.
 
             # Create .env file if it doesn't exist
             echo "🔐 Setting up environment..."
@@ -148,23 +133,60 @@ jobs:
 
             echo "✅ Environment ready (SESSION_SECRET length: ${#SESSION_SECRET})"
 
-            # Restart PM2
-            echo "🔄 Restarting PM2..."
-            pm2 stop timetracking-staging || true
-            pm2 delete timetracking-staging || true
-
-            # Set ALLOWED_ORIGINS for CORS
+            # Set ALLOWED_ORIGINS for CORS (muss gesetzt sein, bevor start_server laeuft)
             export ALLOWED_ORIGINS='tauri://localhost,https://tauri.localhost,http://tauri.localhost,http://localhost:1420'
 
+            # Serverstart als Funktion statt als zwei Kopien: der Aufruf traegt sechs
+            # Umgebungsvariablen und vier PM2-Optionen. Zwei Kopien driften auseinander,
+            # sobald jemand eine Variable ergaenzt - und vergessen wuerde mit hoher
+            # Wahrscheinlichkeit die im Fehlerpfad, weil sie im Normalbetrieb nie laeuft.
+            # Die Funktion wird aus zwei Pfaden gerufen: aus dem Fehlerzweig der Migration
+            # und aus dem Erfolgspfad. "pm2 save" gehoert mit hinein, damit beide Pfade
+            # PM2 in demselben wiederherstellbaren Zustand verlassen.
             # PORT must be passed as prefix — PM2 does NOT load .env files
             # (see ENV.md Green Server Critical Notes for full explanation)
-            TZ=Europe/Berlin NODE_ENV=staging SESSION_SECRET=$SESSION_SECRET ALLOWED_ORIGINS=$ALLOWED_ORIGINS PORT=3001 \
-              pm2 start dist/server.js \
-              --name timetracking-staging \
-              --cwd /home/ubuntu/TimeTracking-Green/server \
-              --time \
-              --update-env
-            pm2 save
+            start_server() {
+              TZ=Europe/Berlin NODE_ENV=staging SESSION_SECRET=$SESSION_SECRET ALLOWED_ORIGINS=$ALLOWED_ORIGINS PORT=3001 \
+                pm2 start dist/server.js \
+                --name timetracking-staging \
+                --cwd /home/ubuntu/TimeTracking-Green/server \
+                --time \
+                --update-env
+              pm2 save
+            }
+
+            # Server anhalten, BEVOR ein Fremdprozess die Datenbank anfasst (CR-03,
+            # .planning/debug/wal-abgehaengt-20260827.md). Ein zweiter Halter auf der Datei
+            # ist genau der Mechanismus, der die WAL des laufenden Serverprozesses abhaengt;
+            # .claude/CLAUDE.md verbietet ihn einschliesslich readonly.
+            echo "🔄 Stopping PM2 before database access..."
+            pm2 stop timetracking-staging || true
+            pm2 delete timetracking-staging || true
+
+            # Schlaegt die Migration fehl, wird der Server wieder gestartet, damit ein
+            # fehlgeschlagenes Deployment keinen Ausfall erzeugt. Gestartet wird dann aber
+            # auf einem Code-Stand, dessen Migration NICHT durchlief - deshalb danach
+            # "exit 1", damit der Lauf sichtbar rot ist und jemand hinsieht.
+            # Schlaegt auch start_server fehl, bleibt es bei "exit 1": "set -e" ist im
+            # rechten Zweig eines "||" ausgesetzt, der Ausstiegscode ist deshalb
+            # unabhaengig vom Erfolg des Neustarts.
+            echo "🗄️  Running database migrations (server stopped)..."
+            NODE_ENV=staging npm run migrate:prod || {
+              echo "❌ Migration failed! Deployment aborted."
+              echo "💡 Database backup available: server/database.backup.*.db"
+              start_server
+              exit 1
+            }
+            echo "✅ Migrations completed successfully"
+
+            # Validate database schema (non-blocking, Server ist weiterhin gestoppt)
+            echo "🔍 Validating database schema..."
+            NODE_ENV=staging npm run validate:schema || true
+            echo "✅ Schema validation completed"
+
+            # Erfolgspfad: Server wieder starten
+            echo "🚀 Starting PM2..."
+            start_server
 
             # Wait for server to start
             echo "⏳ Waiting for server to start..."
```

---

## Self-Check: PASSED

Alle drei Commits im Log gefunden (`ff02de5`, `66f0867`, `aa46319`). Alle geaenderten
Dateien existieren. `scripts/database/setup-cron.sh` ist korrekt entfernt und ist die
**einzige** Loeschung zwischen `1a648d9` und `HEAD` (`git diff --diff-filter=D`) - es wurde
keine Datei versehentlich mitgeloescht.

Arbeitsbaum sauber bis auf die Planungsdateien unter `.planning/quick/`. Die Doku-Artefakte
(SUMMARY.md, STATE.md) wurden absprachegemaess **nicht** committet - das uebernimmt der
Orchestrator. `ROADMAP.md` wurde nicht angefasst. Es wurde **nicht gepusht**.
