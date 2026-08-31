---
phase: quick-260831-t5j
plan: 01
type: execute
completed: 2026-08-31
requirements: [CR-02, CR-04, WR-02, WR-03, WR-05, WR-07, WR-14]
commits:
  - ffe29e4  # WR-05
  - 80da0b7  # CR-02
  - 54b970b  # WR-14
  - 04b441e  # CR-04
  - 8a06d38  # WR-02
  - efb2e86  # WR-07
  - c5a12d9  # WR-03
---

# Quick Task 260831-t5j: sieben Restbefunde aus 09.1-REVIEW.md - Summary

Sieben unvermischte Commits auf main, ausgehend von e7beee2. Nicht gepusht.
Es wurde
kein laufendes System angefasst: kein ssh, kein gh workflow run, kein crontab, kein
Zugriff auf production.db. .planning/STATE.md, .planning/ROADMAP.md und
09.1-NACHWEIS-BEOBACHTUNG.md sind unveraendert (per git diff e7beee2 HEAD --stat gegen
diese drei Pfade geprueft - leere Ausgabe).

## Befund -> Commit

| Befund | Commit | Dateien |
|---|---|---|
| WR-05 - Signalbehandler an den Anfang des Startfensters | ffe29e4 | server/src/server.ts |
| CR-02 - db.close() aus fixOvertime.ts entfernen | 80da0b7 | server/src/scripts/fixOvertime.ts |
| WR-14 - SESSION_SECRET nicht kuerzen, nicht still neu erzeugen | 54b970b | deploy-server.yml, deploy-staging.yml |
| CR-04 - sync-db.ts richtige Quelle, Sicherung mit Uhrzeit | 04b441e | server/src/scripts/sync-db.ts |
| WR-02 - db:sync:remote entfernen (falscher Schluesselname) | 8a06d38 | server/src/scripts/sync-db.ts, server/package.json |
| WR-07 - Fehlerobjekt ausgeben, Close vereinheitlichen | efb2e86 | server/src/scripts/migrate.ts, server/src/scripts/seed.ts |
| WR-03 - verbotenes toISOString-Split-UTC-Muster | c5a12d9 | server/src/scripts/migrate.ts, server/src/scripts/sync-db.ts (Kommentartext) |

Reihenfolge weicht bewusst von der Plan-Nummerierung ab: WR-05 und CR-02 zuerst (unabhaengig),
dann WR-14 (unabhaengig), dann CR-04 vor WR-02 (beide in sync-db.ts, CR-04 legt die
SYNC_SOURCE_DB-Quelle und die Sicherungslogik fest, WR-02 entfernt danach den ganzen
syncRemote()-Zweig), dann WR-07 vor WR-03 (beide in migrate.ts; um einen unvermischten
Commit pro Befund zu garantieren, wurde der WR-03-Hunk vor dem WR-07-Commit voruebergehend
zurueckgenommen und danach erneut angewandt - siehe Abschnitt zu ueberlappenden Dateien unten).

## Vorgehen bei ueberlappenden Dateien (Task 6/7, migrate.ts)

WR-07 und WR-03 aendern beide server/src/scripts/migrate.ts, an unterschiedlichen,
nicht ueberlappenden Stellen (Fehlerpfad von runMigrations() vs. createMigration()).
Um trotzdem einen unvermischten Commit pro Befund zu bekommen, wurden beide Aenderungen erst
gemeinsam entworfen, dann der WR-03-Teil (inkl. des dafuer noetigen formatDate-Imports)
gezielt zurueckgenommen, WR-07 allein committet (efb2e86), und der WR-03-Teil danach erneut
eingefuegt und separat committet (c5a12d9). git diff vor jedem Commit bestaetigte, dass
jeweils nur der beabsichtigte Hunk gestaged war.

## Aufloesung des scheinbaren Widerspruchs CR-02 und WR-07

Wie im Plan vorgegeben: CR-02 entfernt db.close() aus fixOvertime.ts, WR-07 ergaenzt ein
einheitliches Close-Verhalten in migrate.ts und seed.ts. Beide Kommentare verweisen jetzt
wechselseitig aufeinander:

- fixOvertime.ts laeuft als Handbetriebs-Werkzeug potenziell NEBEN einem aktiven
  Serverprozess auf derselben Datei (--allow-production gegen production.db) - ein Close
  wuerde dessen WAL abhaengen.
- migrate.ts laeuft seit CR-03 im Deploy ausschliesslich HINTER pm2 stop / pm2 delete,
  seed.ts laeuft wegen checkEnvironment() nie gegen production.db - in beiden Faellen kein
  konkurrierender Serverprozess auf derselben Datei, ein Close ist dort korrekt.

Kein Feld wurde harmonisiert - die gegensaetzliche Behandlung ist beabsichtigt und in beiden
Dateien als Kommentar mit Verweis auf die jeweils andere Begruendung hinterlegt.

## Entscheidung WR-02: db:sync:remote entfernen statt Pfad zu flicken

Der Plan verlangt eine begruendete Entscheidung zwischen Pfad korrigieren und Befehl
streichen. Entschieden: streichen, aus drei Gruenden, alle durch Lesen des Codes belegt:

1. scripts/sync-dev-db.sh existiert bereits im Repo und ist laut .claude/CLAUDE.md
   (Frische Produktionsdaten lokal: npm run sync-dev-db) der kanonische Weg - eine zweite
   Implementierung desselben Zwecks ist unnoetige Redundanz, die wieder auseinanderlaufen kann
   (genau das ist hier passiert: der Schluesselname wich seit dem Verschieben nach src/ ab,
   ohne dass es auffiel, weil der Pfad nie ausgefuehrt wurde).
2. scripts/sync-dev-db.sh ist technisch ueberlegen: es laedt per VACUUM INTO einen
   konsistenten Schnappschuss auf dem Server (kein WAL-Risiko wie bei rohem scp einer
   WAL-Mode-Datei) und prueft integrity_check, bevor die Datei installiert wird.
   syncRemote() in sync-db.ts transportierte dagegen per rohem scp, ohne jede Pruefung.
3. syncRemote() war seit dem Verschieben nach server/src/scripts/sync-db.ts (Phase 9.1)
   funktionsloser Code - ORACLE_KEY_PATH zeigte auf eine SSH-Schluesseldatei, die im Projekt
   nie existierte, nur .ssh/oracle_server.key liegt im Root. existsSync() griff bei jedem
   Aufruf, der Pfad wurde also nie durchlaufen und war nicht durch Nutzung geschuetzt vor
   weiterem Auseinanderdriften.

Der Kopfkommentar von sync-db.ts dokumentiert diese Begruendung jetzt im Code selbst.

## Gemessene Verify-Ergebnisse

cd server und npx tsc --noEmit: sauber (nach jedem einzelnen Commit erneut geprueft)
grep -n process.on(SIGTERM: server.ts Zeile 258, vor dem ersten await in startServer()
grep -n db.close() fixOvertime.ts: kein Treffer
grep -n cut -d= -f2- und Zeile mit doppeltem Redirect (beide Workflows): vorhanden
node yaml.load Test (deploy-server.yml, deploy-staging.yml): beide laden fehlerfrei
grep -n oracle_key (server/, ohne .planning/): kein Treffer
grep -rn verbotenes toISOString-Split-Muster server/src/scripts/: kein Treffer

CR-04 (Guard-Logik von syncLocal()) wurde NICHT gegen die echte
server/database/development.db getestet - das haette die von der Testsuite genutzte,
geteilte Datenbank ueberschrieben. Stattdessen wurde die Guard-Logik (Quelle-Pflicht,
Sicherung-mit-Uhrzeit, Abbruch bei existierender Sicherung) in einem isolierten
Node-Skript im Scratchpad-Verzeichnis nachgebildet und mit echten Dateien verifiziert:
- Ohne SYNC_SOURCE_DB gesetzt: Abbruch mit Exitcode 2, Zieldatei unveraendert.
- Zwei Laeufe direkt hintereinander: der zweite bricht ab, weil die Sicherungsdatei (mit
  Sekundenaufloesung im Namen) bereits existiert - die erste Sicherung bleibt unangetastet.

WR-07 (Fehlerobjekt-Ausgabe) wurde per isoliertem node-Aufruf verifiziert:
console.error(error) gibt Fehlermeldung und Stacktrace vollstaendig aus.

Testsuite (cd server, npx vitest run --reporter=dot, gegen die geteilte
server/database/development.db):

Test Files: 2 failed, 48 passed (50)
Tests: 3 failed, 592 passed (595)

Alle drei roten Tests sind Teilmenge der vier Baseline-Fehlschlaege:
- unifiedOvertimeService.test.ts: 2 Tests in REGRESSION TESTS: Corrections and Hire Date
- vacationBackfillService.test.ts: erkennt einen bereits gelaufenen Backfill

Der vierte Baseline-Fehlschlag (overtimeCompFutureCommitment.test.ts, Test 5, der Zeitraum
der HEUTE ueberspannt) ist in diesem Lauf GRUEN (isoliert nachgeprueft: 5 von 5 bestanden).
Erklaerung: der Test bezieht sich auf das aktuelle Systemdatum (Referenz-Datum ist immer
heute, .claude/CLAUDE.md) - zwischen der Baseline-Messung und diesem Lauf ist ein Kalendertag
vergangen (Sitzungsdatum wechselte waehrend der Ausfuehrung von 2026-08-29 auf 2026-08-31),
wodurch der urspruenglich getestete HEUTE-Grenzfall nicht mehr zutrifft. Keine der sieben
Aenderungen dieser Aufgabe beruehrt Ueberstundenlogik oder Zeitzonenberechnung - betroffen
sind ausschliesslich Shutdown-Verhalten, ein Handbetriebs-Skript, zwei Deploy-Workflows und
Datenbank-Sync-/Migrationsskripte. Es gibt KEINEN neuen roten Test gegenueber der Baseline,
nur einen Fehlschlag weniger.

## Prozesshygiene

Beim ersten vitest run wurden drei bereits laufende, verwaiste tsx-src-server.ts-Prozesse
gefunden (PIDs 4140, 53268, 35268, jeweils mit Kindprozessen) - exakt das im Auftrag
beschriebene Muster von drei verwaisten npm-run-dev-Baeumen. Diese wurden nicht von dieser
Aufgabe gestartet, aber vor Abschluss per taskkill /T /F beendet (alle Teilbaeume erfolgreich
beendet, danach keine node.exe-Prozesse mehr aktiv).

## Abweichungen vom Plan

### 1. Formulierungskorrektur: zwei eigene Kommentare enthielten woertlich verbotene bzw. gepruefte Muster

Beim Formulieren der Begruendungskommentare fuer CR-02 und WR-03 wurden zunaechst die exakten
Zeichenketten fuer db.close() bzw. das verbotene toISOString-Split-Muster verwendet, um den
vorherigen Zustand zu beschreiben. Das haette die im Plan vorgegebenen grep-Abnahmen (die
genau nach diesen Zeichenketten suchen) faelschlich rot gemacht - verursacht durch den eigenen
Kommentartext, nicht durch verbliebenen Code. Beide Kommentare wurden umformuliert, ohne den
inhaltlichen Bezug zu verlieren. Betrifft fixOvertime.ts (Commit 80da0b7), migrate.ts
und sync-db.ts (Commit c5a12d9). Analog wurde der WR-02-Kopfkommentar in sync-db.ts so
formuliert, dass der volle SSH-Schluesselpfad nirgends woertlich vorkommt (Commit 8a06d38).

### 2. Eigener Tippfehler korrigiert: Commit-Nachricht von Task 1

Der erste Commit (WR-05) enthielt in der allerersten Fassung der Commit-Message eine
Titelzeile, die dem Fliesstext widersprach (ans Ende statt an den Anfang). Da dieser Fehler
erst Sekunden nach dem eigenen git commit-Aufruf auffiel, der Commit nicht gepusht und von
niemand sonst eingesehen worden war, wurde er per git commit --amend korrigiert (Titel
an den Anfang, Inhalt unveraendert) - keine Historie fremder Arbeit betroffen.

---

Total deviations: 2 (beide redaktionell/formulierungsbedingt, keine Auswirkung auf
Codeverhalten oder Testergebnisse)

## Self-Check: PASSED

Alle sieben Commits im Log gefunden (ffe29e4, 80da0b7, 54b970b, 04b441e, 8a06d38,
efb2e86, c5a12d9). Alle geaenderten Dateien existieren:

server/src/server.ts, server/src/scripts/fixOvertime.ts,
.github/workflows/deploy-server.yml, .github/workflows/deploy-staging.yml,
server/src/scripts/sync-db.ts, server/package.json,
server/src/scripts/migrate.ts, server/src/scripts/seed.ts

git status --short nach dem letzten Fach-Commit: leer (keine untracked/geaenderten Dateien
ausser dieser SUMMARY.md). git diff e7beee2 HEAD --stat gegen .planning/STATE.md,
.planning/ROADMAP.md und 09.1-NACHWEIS-BEOBACHTUNG.md: leer - keine dieser drei Dateien
wurde beruehrt. Es wurde NICHT gepusht, kein ssh, kein production.db-Zugriff.

---
Quick Task: 260831-t5j
Completed: 2026-08-31
