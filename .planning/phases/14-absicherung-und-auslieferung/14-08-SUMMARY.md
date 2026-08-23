---
phase: 14-absicherung-und-auslieferung
plan: 08
subsystem: infra
tags: [deployment, migration, sqlite, github-actions, pm2, overtime, rollback]

requires:
  - phase: 14-03
    provides: Gates und Ausgangszustand der Testlage
  - phase: 14-04
    provides: Migrationsstand der Produktion, Fehlliste 008-015, Vortestung auf der Kopie
  - phase: 14-06
    provides: erprobter Rueckweg, 14-ROLLBACK-RUNBOOK.md
  - phase: 14-07
    provides: Urteil zu Phase 9.1, Befund zur Aufrufreihenfolge von fix-overtime.ts
provides:
  - Produktion laeuft auf dem v3.0-Codestand 41c9c09 (382 Commits ausgeliefert)
  - Migrationen 008-015 sind auf der Produktion angewendet, integrity_check ok
  - Geprueft Sicherung production.PRE-14-08_20260823_111541.db liegt doppelt vor
  - Nachweis, dass die Migrationen 008-015 keine Zahl bewegen — auf dem heutigen Produktionsdatenstand, vor dem Push gemessen
  - Namentlicher, wertgenauer Ist-Stand der Produktion vor und nach dem Deployment
  - Werkzeuge 14-ist-stand-report.mjs und 14-ist-stand-vergleich.mjs
  - BLOCKER-Befund - fix-overtime.ts hat 99 Werte in overtime_balance bei 8 Nutzern bewegt
affects: [14-09, 14-10, 14-11, phase-9.1]

tech-stack:
  added: []
  patterns:
    - "Ist-Stand-Erhebung ueber rohe Tabellenwerte, damit sie beidseits eines Migrationsschnitts funktioniert"
    - "Vorhersagemessung vor dem Push: Sicherung lokal migrieren und gegen den Vorher-Stand vergleichen"
    - "SHA-256 ueber einen Nutzdatenkern ohne Zeitstempel und Pfad, damit der Hash als Gleichheitsnachweis taugt"

key-files:
  created:
    - .planning/phases/14-absicherung-und-auslieferung/14-PRODUKTIONSLAUF.md
    - .planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VOR-DEPLOYMENT.json
    - .planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VOR-DEPLOYMENT.md
    - .planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VORHERSAGE-NACH-MIGRATION.json
    - .planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-NACH-MIGRATION.json
    - .planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-NACH-MIGRATION.md
    - .planning/phases/14-absicherung-und-auslieferung/14-VERGLEICH-VORHERSAGE.md
    - .planning/phases/14-absicherung-und-auslieferung/14-VERGLEICH-VOR-NACH.md
    - .planning/phases/14-absicherung-und-auslieferung/14-08-DEPLOYMENT-LOG.txt
    - .planning/phases/14-absicherung-und-auslieferung/deferred-items.md
    - server/scripts/14-ist-stand-report.mjs
    - server/scripts/14-ist-stand-vergleich.mjs
  modified:
    - .github/workflows/deploy-server.yml

key-decisions:
  - "Der Ist-Stand wird zweigleisig erhoben, weil snapshot:balances gegen den unmigrierten Stand konstruktionsbedingt nicht rechnen kann (D4 verbietet den Rueckfall auf users.weeklyHours)"
  - "Die Nullwirkung der Migrationen wird vor dem Push auf dem heutigen Produktionsdatenstand gemessen, nicht nur auf der aelteren Kopie aus 14-04"
  - "Die frische Produktionskopie wird per VACUUM INTO und scp gezogen statt per sync-dev-db — das beseitigt T-14-45 statt es zu mildern"
  - "Bei 99 bewegten Werten wird abgebrochen und nicht repariert; der Rueckweg wird benannt, nicht ausgefuehrt"

patterns-established:
  - "Anmeldeschranke erkennen statt Wiederholen: haengt ein Push ohne Ausgabe, erst den tatsaechlichen Fernstand pruefen"
  - "Erwartete Strukturaenderungen im Vergleichswerkzeug benennen statt unterdruecken — sie erscheinen als eigene Kategorie im Bericht"

requirements-completed: []

duration: 3h 20min
completed: 2026-08-23
---

# Phase 14 Plan 08: Produktionsfenster Summary

**Der v3.0-Milestone ist auf der Produktion, die Migrationen 008–015 sind angewendet und
bewegen nachweislich keine Zahl — aber `fix-overtime.ts` hat am Ende des Deployments 99
Überstundenwerte bei 8 Mitarbeitern neu berechnet, was die Zusicherung des Anwenders verletzt
und den Lauf zum Abbruch bringt.**

## Performance

- **Dauer:** rund 3 h 20 min (11:13–14:30 Uhr Ortszeit), davon rund 25 min durch eine
  hängende Anmeldeschranke beim Push
- **Tasks:** 2 von 3 abgeschlossen, Task 3 nach Schritt E abgebrochen
- **Geänderte Dateien:** 1 Codedatei (`deploy-server.yml`), 2 neue Werkzeuge, 10 Nachweisdokumente

## Was erreicht wurde

### Task 1 — Freigabe
Die Nachweislage wurde dem Anwender vollständig vorgelegt, die Zahlen zum Checkpoint-Zeitpunkt
neu gemessen (**379 Commits, 336 Dateien** statt der im Plan genannten 337/293 — die Differenz
sind die Commits der Pläne 14-01 bis 14-07). Die Freigabe steht wörtlich mit Zeitpunkt in
`14-PRODUKTIONSLAUF.md`. Vor der Freigabe lief kein Befehl gegen die Produktion.

### Task 2 — Sicherung, Workflow-Korrektur, Auslieferung
- **Sicherung** `production.PRE-14-08_20260823_111541.db`, 1.286.144 Bytes, per `VACUUM INTO`
  in 113 ms, `integrity_check` = `ok`, `foreign_key_check` leer. Zweite Kopie auf dem
  Arbeitsrechner, **SHA-256 beider Kopien identisch**
  (`082ff7434ec8c75560f06c6469093c088c921f70a9cc35162f4bf9b21222ee7d`).
- **Rohkennzahlen** der Sicherung sind wortgleich mit der Produktionskopie aus Plan 14-04 —
  die Produktion hatte sich seit dem Ziehen jener Kopie in keiner geprüften Kennzahl bewegt.
- **Workflow korrigiert:** „Fix overtime calculations" steht jetzt hinter `pm2 save` (Zeile 206
  gegen Zeile 164) und hinter dem Health-Check, mit Begründung als Kommentar.
- **Vier Gates** bestanden: `tsc` Server und Desktop Exit 0, `vitest run` genau 3 rot mit den
  bekannten Titeln bei 527 grün, `check:rules` Exit 0.
- **T-14-SC:** `dependencies` und `devDependencies` in `server/package.json` sind zwischen
  `origin/main` und `HEAD` byteidentisch — keine neue Abhängigkeit.
- **Deployment** Lauf `32632007657`: `completed` / `success`, alle Jobs `success`, 6 min 2 s.

### Task 3 — Verifikation
- **Migrationsstand 10 → 18**, alle acht Namen der Fehlliste angewendet,
  `015_unique_reversal_of_index` eingeschlossen. `integrity_check` = `ok`,
  `foreign_key_check` leer.
- `user_work_periods` = `COUNT(*) FROM users` = 20 (REQ-21).
- Kettenprüfung gegen den Produktionsbestand: keine Befunde, Exit 0.
- Health-Check `status: ok`, HTTP 200.
- **Nichts verloren:** keine Zeile in `users`, `time_entries`, `absence_requests`,
  `overtime_transactions`, `overtime_balance`, `vacation_balance` oder
  `vacation_transactions` hat sich in der Zahl bewegt. Journal unangetastet
  (2671 Zeilen, `SUM(hours)` −372,68 unverändert). Urlaubsjahre mit Abweichung: 0.

## Der Blocker

**99 Werte in `overtime_balance` haben sich bewegt, 8 Nutzer betroffen, Summe der
Saldodifferenzen −98,5 h.**

| ID | Name | Saldo vorher | Saldo nachher | Differenz |
|---|---|---|---|---|
| 2 | Karin Jochem | 6 | 10 | +4 |
| 3 | Christine Glas | −46,43 | −15,23 | +31,2 |
| 16 | Benedikt Jochem | 104 | 20 | **−84** |
| 17 | Carmen Rothemund | −46,06 | −45,26 | +0,8 |
| 18 | Silvia Lachner | −4,5 | 11,5 | +16 |
| 19 | Ute Stock | 10,41 | 12,41 | +2 |
| 24 | Kathrin Leeb | 249,5 | 201,5 | −48 |
| 29 | Christina Wasensteiner | 85,78 | 65,28 | −20,5 |

**Die Ursache ist isoliert und es sind nicht die Migrationen.** Zwei Vergleiche belegen das:

| Vergleich | Ergebnis |
|---|---|
| Vorher-Stand **gegen** dieselbe Sicherung, nur mit 008–015 migriert | **0 unerwartete Differenzen** |
| Nur migriert **gegen** Produktion (migriert **und** `fix-overtime.ts`) | **exakt dieselben 99** |

Verursacher ist `scripts/fix-overtime.ts`, das am Ende des Deployments `overtime_balance` per
UPSERT neu schreibt — erstmals mit dem periodenbasierten Rechenwerk der Phase 11, während die
gespeicherten Werte vom alten Rechenwerk stammten.

Sachlich ist das **keine Datenzerstörung**, sondern die Materialisierung des neuen Modells in
den abgeleiteten Monatssalden. Die Zusicherung des Anwenders lautete jedoch, dass sich an den
Stundenständen nichts ändern darf und jede Bewegung ein Blocker ist. **Deshalb Abbruch.**

## Wohin sich die Zahlen bewegt haben

Eine Zahlenbewegung ohne Richtung ist keine Entscheidungsgrundlage. Deshalb wurde zusaetzlich
gemessen, wohin die 99 Werte gewandert sind — gegen den kanonischen Rechenweg
(`unifiedOvertimeService.calculatePeriodOvertime()`, `asOf=2026-08-21`):

| | vorher | nachher |
|---|---|---|
| Aktive Nutzer, deren Aggregat **exakt** dem kanonischen Rechenweg entspricht | **7 von 15** | **13 von 15** |
| Nutzer, die schlechter stehen | — | **keiner** |

Die verbleibenden zwei (userId 3 Christine Glas, userId 17 Carmen Rothemund) sind naeher an
den kanonischen Wert gerueckt, nicht weiter weg.

**Das ist zahlengleich der Zustand, den der Anwender fuer Plan 14-10 gewaehlt hat.**
`14-URTEIL-PHASE-9.1.md` Abschnitt 7.6 misst fuer die Variante **Vollaufbau** auf der
Produktionskopie wortgleich `13 von 15` (vorher `7 von 15`) und `kein Nutzer steht danach
schlechter`, mit denselben Zielwerten (2 → 10,00; 16 → 20,00; 18 → 11,50; 19 → 12,41;
24 → 201,50; 29 → 65,28). Der bestehende Blocker in `STATE.md` nennt fuer den
Journal-Backfill ebenfalls `8 von 20 Nutzern` und `bis zu 84 Stunden` — derselbe Effekt aus
derselben Ursache.

**Was dadurch nicht vorweggenommen wurde:**
- Das **Journal** ist unangetastet (2671 Zeilen, SUM −372,68). Plan 14-10 bleibt offen.
- Die Reihenfolge aus Teil 2 des Urteils ist **verletzt**: Der Backfill sollte erst nach der
  Verifikation aus 14-09 laufen, weil er genau diese Groessen bewegt. `fix-overtime.ts` hat
  sie vorher bewegt. **Plan 14-09 muss seinen Ausgangsstand neu erheben.**
- Die Auflage des Anwenders bleibt verletzt: Er wollte jede Bewegung **vorher** sehen. Dass
  die Richtung guenstig ist, aendert daran nichts.

**Folge fuer die Abwaegung:** Rueckweg B naehme nicht nur die Aenderung zurueck, sondern den
gesamten v3.0-Milestone — und stellte einen Aggregatstand wieder her, der bei 8 von 15 aktiven
Nutzern **nicht** mit dem kanonischen Rechenweg uebereinstimmt. Diese Abwaegung wird hier
nicht entschieden.

## Abweichungen vom Plan

### 1. [Zusatzauflage des Anwenders] Namentlicher Ist-Stand vor und nach dem Deployment
- **Gefunden bei:** Task 2, vor dem Deployment
- **Anlass:** Der Anwender verfügte vier Auflagen, bevor irgendetwas geschrieben wurde.
- **Umsetzung:** `snapshot:balances` erwies sich als gegen den unmigrierten Stand unbrauchbar
  — der kanonische Rechenweg hat seit D4 keinen Rückfall auf `users.weeklyHours` und wirft für
  jeden Nutzer „Keine Arbeitszeitperiode gefunden". Deshalb zwei neue, ausschließlich lesende
  Werkzeuge: `14-ist-stand-report.mjs` (rohe Tabellenwerte, namentlich, soft-gelöschte
  eingeschlossen) und `14-ist-stand-vergleich.mjs` (Feld-für-Feld-Vergleich, Exit 1 bei
  Blocker).
- **Commit:** `8280930`

### 2. [Rule 3 - Blockierend] Push hing an einer interaktiven Anmeldeschranke
- **Gefunden bei:** Task 2, Schritt E
- **Befund:** `git-credential-manager.exe` wartete auf eine Anmeldung, die aus einer nicht
  interaktiven Sitzung nicht beantwortbar ist. Zwei Versuche liefen 5 bzw. 10 Minuten ohne
  jede Ausgabe. Geprüft statt wiederholt: `origin/main` stand unverändert auf `0f2a03e`, kein
  Deployment ausgelöst, Produktion unberührt.
- **Behebung:** Über die **bereits erteilten** `gh`-Zugangsdaten (`repo`, `workflow`), ohne
  ein Geheimnis abzulegen. `gh auth setup-git` hat dabei die globale git-Konfiguration
  ergänzt — dokumentiert in `14-PRODUKTIONSLAUF.md`.
- **Commit:** kein eigener (Anmeldung, keine Codeänderung)

### 3. [Rule 2 - Risikovermeidung] Produktionskopie per `VACUUM INTO` statt `sync-dev-db`
- **Gefunden bei:** Task 3, Schritt C
- **Anlass:** Der Plan sah `sync-dev-db` mit Sicherung und Wiederherstellung von
  `development.db` vor (T-14-45). Derselbe Zweck ist über `VACUUM INTO` und `scp` erreichbar,
  **ohne `development.db` anzufassen**.
- **Beleg:** `development.db` ist vorher und nachher byteidentisch
  (SHA-256 `8b3b08c2…a4fcb`, 1.699.840 Bytes, mtime unverändert). T-14-45 ist damit beseitigt,
  nicht nur gemildert.
- **Commit:** `ae83d9d`

## Befunde, die nicht Gegenstand dieses Plans waren

Festgehalten in `deferred-items.md`, nicht repariert:

1. **`scripts/validateSchema.ts` erwartet ein Schema, das es nicht mehr gibt** — schlägt bei
   jedem Deployment fehl, wird durch `|| true` verschluckt. Ein Prüfschritt, dessen Fehlschlag
   als normal gilt, ist schlechter als keiner.
2. **`.claude/CLAUDE.md` erwartet `database: connected` im Health-Check** — dieses Feld hat der
   Endpunkt nie geliefert, weder vor noch nach dem Deployment (beide Fassungen am Code
   geprüft, byteidentisch). Ein grüner Health-Check belegt hier keine Datenbankverbindung.
3. **`fix-overtime.ts` schreibt unbeaufsichtigt und ohne Nachweis** — im Deployment und
   täglich um 3 Uhr per Cron, ohne Trockenlauf, ohne Erwartungsprüfung, ohne Protokoll, und
   laut WR-05 ohne Fehlerisolierung je Nutzer.

## Zustand der Produktion

| Gegenstand | Zustand |
|---|---|
| Server | läuft, PM2-Id 41, PID 3684814, `online` |
| Codestand | `41c9c09` |
| Migrationen | 18, einschließlich 008–015 |
| `integrity_check` | `ok` |
| `foreign_key_check` | leer |
| Periodenketten | keine Befunde |
| Datenbestand | vollständig, keine Zeile verloren |
| Überstundensalden | bei 8 Nutzern verändert |

Die Produktion ist lauffähig und in sich konsistent.

## Rückweg, falls gewünscht

**Rückweg B** (`14-ROLLBACK-RUNBOOK.md`, Abschnitt 4) — Daten **und** Code gemeinsam.
Rückweg A allein wäre wirkungslos, weil der nächste PM2-Neustart die Migrationen erneut
anwendet und `fix-overtime.ts` die Salden erneut überschreibt.

Die geprüfte Sicherung liegt auf dem Server und auf dem Arbeitsrechner bereit.

**Preis:** Der gesamte v3.0-Milestone verschwindet wieder von der Produktion; Zeiteinträge
seit 11:15:41 gingen verloren (zum Messzeitpunkt keine — `MAX(date)` unverändert `2026-08-21`,
712 Zeilen).

## Nicht ausgeführt

- **Task 3 Schritt F** — Funktionstest mit Anmeldung (Abbruch; zudem liegen keine
  Zugangsdaten vor)
- **Task 3 Schritt G** — `14-SNAPSHOT-PROD-VORHER.json` als Ausgangsstand für Plan 14-09

**Plan 14-09 ist nicht anlaufbereit** — weder liegen die vier D6-Werte vor, noch ist über den
Ausgangsstand entschieden.

Für später festgehalten: Der Anwender hat für **Plan 14-10** die Variante **Vollaufbau
(`--all-months`)** gewählt.

## Selbstprüfung

Siehe Abschnitt „Self-Check" unten.

## Self-Check: PASSED

Alle behaupteten Dateien und Commits wurden nachgeprüft.

**Dateien (12 von 12 gefunden):** `14-PRODUKTIONSLAUF.md`, `14-PROD-IST-VOR-DEPLOYMENT.json`
und `.md`, `14-PROD-IST-NACH-MIGRATION.json`, `14-VERGLEICH-VOR-NACH.md`,
`14-VERGLEICH-VORHERSAGE.md`, `14-08-DEPLOYMENT-LOG.txt`, `deferred-items.md`,
`server/scripts/14-ist-stand-report.mjs`, `server/scripts/14-ist-stand-vergleich.mjs`,
`server/database/backups/production.PRE-14-08_20260823_111541.db`,
`server/database/14-prod-nach-migration.db`.

**Commits (4 von 4 gefunden):** `b5d378a`, `8280930`, `41c9c09`, `ae83d9d`.

**Sicherung auf dem Server geprüft:**
```
$ ssh ... "ls -la /home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db"
-rw-r--r-- 1 ubuntu ubuntu 1286144 Aug 23 09:15 /home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db
```
