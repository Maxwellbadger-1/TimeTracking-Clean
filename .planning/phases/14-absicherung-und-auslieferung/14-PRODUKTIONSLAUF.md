# 14-PRODUKTIONSLAUF — Protokoll des Produktionsfensters (Plan 14-08)

**Angelegt:** 2026-08-23, 11:13 Uhr (Europe/Berlin)
**Plan:** `.planning/phases/14-absicherung-und-auslieferung/14-08-PLAN.md`
**Zweck (D2):** Das ist die erste Stelle des Milestones, an der ein Fehler echte
Mitarbeiterdaten trifft. Dieses Dokument protokolliert lückenlos: Freigabe, Sicherung,
Auslieferung und Migrationsverifikation — jede Zahl mit dem Befehl, der sie ermittelt hat.

**Nicht in diesem Dokument enthalten (T-14-47):** keine Zugangsdaten, kein `SESSION_SECRET`,
kein Schlüsselinhalt. Wo das Deployment-Log den Wert einer Umgebungsvariablen ausgeben würde,
wird nur die Längenangabe übernommen.

---

## Task 1 — Freigabe des Produktionsfensters

### Die dem Anwender vorgelegte Nachweislage

#### 1. Testabdeckung (REQ-32) — fünf Fälle, fünf Fundstellen, fünf Einzelläufe

Aus `14-REQ32-NACHWEIS.md`:

| # | REQ-32-Fall | Fundstelle | Nachweislauf |
|---|---|---|---|
| 1 | Reduzierung (40→20), Stichtag in der Zukunft | `workPeriodChangeService.test.ts:172` | `1 passed \| 493 skipped (494)` |
| 2 | Erhöhung, Stichtag rückwirkend | `workPeriodChangeService.test.ts:284` | `1 passed \| 494 skipped (495)` |
| 3 | Stichtag mitten im Monat | `workPeriodChangeService.test.ts:642` | `1 passed \| 493 skipped (494)` |
| 4 | Wechsel über einen Jahreswechsel | `workPeriodChangeService.test.ts:735` | `1 passed \| 493 skipped (494)` |
| 5 | Periode löschen und danach neu rechnen | `workPeriodDeletionService.test.ts:180-264` | `1 passed \| 493 skipped (494)` |

**Die vier Gates nach Plan 14-01 mit ihrem tatsächlichen Ergebnis** (`14-REQ32-NACHWEIS.md`,
Abschnitt „Gates nach Plan 14-01"):

| Gate | Ergebnis |
|---|---|
| `cd server && npx tsc --noEmit` | Exit 0, keine Ausgabe |
| `cd desktop && npx tsc --noEmit` | Exit 0, keine Ausgabe |
| `cd server && npx vitest run` | `Tests 3 failed \| 492 passed (495)` — genau die drei bekannten, vorbestehenden Titel aus `11-AUSGANGSZUSTAND.md`, kein vierter roter Test |
| `cd desktop && npm run check:rules` | Exit 0, alle `PASS:`-Zeilen, kein `FAIL` |

#### 2. Umfang der Auslieferung — zum Checkpoint-Zeitpunkt neu gemessen

Nicht die Zahlen aus dem Plan zitiert, sondern am 23.08.2026 um 11:13 Uhr neu erhoben:

```
$ git fetch origin main
From https://github.com/Maxwellbadger-1/TimeTracking-Clean
 * branch            main       -> FETCH_HEAD

$ git ls-remote origin main
0f2a03efba0d5c7880407290be2c4caf9a88184d	refs/heads/main

$ git rev-list --count origin/main..HEAD
379

$ git diff --name-only origin/main..HEAD | wc -l
336

$ git rev-parse --short HEAD
b75738a

$ git status --short
?? .planning/phases/10-perioden-fundament/10-REVIEW.md
```

**Abweichung gegenüber dem Plantext festgehalten:** Der Plan nennt „337 Commits und 293
geänderte Dateien" (Stand beim Planen). Zum Checkpoint-Zeitpunkt sind es **379 Commits** und
**336 geänderte Dateien** — die Differenz sind die seither in Phase 14 selbst erzeugten
Commits (Pläne 14-01 bis 14-07 mit ihren Nachweisdokumenten). `origin/main` steht unverändert
auf `0f2a03e`, dem im Runbook (Rückweg B, Schritt 1) hinterlegten Rücksetzpunkt.

Die einzige nicht versionierte Datei (`10-REVIEW.md`) ist ein Planungsdokument aus Phase 10
ohne Codewirkung; sie wird in diesem Plan nicht angefasst.

#### 3. Migrationsstand — was auf der Produktion fehlt

Fehlliste aus `14-MIGRATIONSSTAND.md`, in Laufreihenfolge (alphabetische Ladereihenfolge von
`loadMigrations()`):

1. `008_create_user_work_periods`
2. `009_backfill_user_work_periods`
3. `010_fix_user_work_periods_delete_guard`
4. `011_add_model_change_transaction_type`
5. `012_fix_reference_type_check_constraint`
6. `013_soft_delete_user_work_periods`
7. `014_add_reversal_of_to_overtime_transactions`
8. `015_unique_reversal_of_index`

**Die Folge lief auf einer Produktionskopie fehlerfrei durch** (Plan 14-04, hartes
`--expect-migration=015_unique_reversal_of_index`, Exit 1 bei Verstoß):
`integrity_check` = `ok`, `foreign_key_check` leer, und in `overtime_transactions`
(COUNT 2671, SUM(hours) −372,68) sowie `overtime_balance` (COUNT 144, SUM(targetHours) 6290,9,
SUM(actualHours) 3435,19) **Differenz exakt 0**. `user_work_periods` ging von „nicht
vorhanden" auf genau `COUNT(*) FROM users` = 20.

#### 4. Generalprobe (REQ-33)

Aus `14-VORHER-NACHHER.md`: **Genau ein Nutzer mit Differenz ungleich null** — der
Generalprobenfall userId 2 (Karin Jochem), Differenz **+19,6 h**, identisch mit dem vom
Werkzeug gemeldeten `balanceDelta: 19.6 h`. Alle übrigen Nutzer unbewegt.

Das vorab benannte Rauschen wurde einzeln geprüft und ist **unbewegt**: User 30
(„Test Urlaub", soft-gelöscht), User 31 („UAT", soft-gelöscht), Antrag 73 (storniert,
gehört User 30).

**Ausdrücklich festgehalten:** userId 2 (Karin Jochem) war ein nach Regel bestimmter
**Prüf**nutzer der Generalprobe — **nicht** der reale D6-Umstellungsfall. Aus der Generalprobe
darf nichts über den realen Fall abgeleitet werden.

#### 5. Rückweg

`14-ROLLBACK-RUNBOOK.md` liegt vor und ist **erprobt** (Plan 14-06: Sicherung ziehen, Schaden
herbeiführen, zurückspielen, maschinell vergleichen). Gemessene Laufzeiten gegen eine
größenordnungsgleiche 1,3-MB-Datenbank: Sicherung (`VACUUM INTO`) 15 ms, Zurückspielen 13 ms;
mit SSH-/`scp`-Overhead ein bis wenige Sekunden. Das Runbook enthält sechs Abschnitte:
Sicherung, Abbruchkriterien, Rückweg A (nur Daten), Rückweg B (Daten und Code), Verifikation,
und was der Rückweg nicht zurücknimmt.

#### 6. Was in diesem Fenster noch **nicht** passiert

- **Plan 14-09** — der reale Umstellungsfall (D6) — ist ein eigener, erneut freizugebender
  Schritt.
- **Plan 14-10** — der Journal-Backfill der Phase 9.1 — ist ein eigener, erneut freizugebender
  Schritt und läuft erst nach der Verifikation aus 14-09.

#### 7. Was nach dem Push nicht mehr ohne Rückweg B zurückgeht

Der `git push` **ist** der Produktionsschreibzugriff. Es gibt keinen Zwischenstand, in dem der
Code auf dem Server liegt und die Migrationen noch nicht gelaufen sind:
`.github/workflows/deploy-server.yml:104` fährt `npm run migrate:prod`, das nur `.sql`-Dateien
verarbeitet — die TypeScript-Migrationen 008–015 laufen dort **nicht**. Sie laufen unbeaufsichtigt
beim PM2-Start über `server/src/server.ts:215` → `runMigrations(db)`.

Ein reines Zurückspielen der Daten (Rückweg A) wäre danach **wirkungslos**, weil der nächste
PM2-Neustart die Migrationen erneut anwenden würde. Ab dem Push gilt daher ausschließlich
Rückweg B (Daten **und** Code), einschließlich eines Force-Push auf `0f2a03e`.

#### 8. Empfehlung zum Zeitpunkt

Das Fenster außerhalb der Arbeitszeit der Stiftung legen: Zeiteinträge, die Anwender zwischen
der Sicherung und einem etwaigen Rückweg erfassen, gehen beim Rückspielen verloren
(`14-ROLLBACK-RUNBOOK.md`, Abschnitt 6 — technische Grenze, keine Nachlässigkeit).

#### Hinweis auf den nächsten Plan (14-09)

Für den realen Umstellungsfall werden **vier Werte** gebraucht, die **dort** abgefragt werden
und **nicht** Gegenstand dieses Checkpoints sind:

1. Nutzer-ID und Name des umzustellenden Nutzers
2. Stichtag der Umstellung
3. bisherige Wochenstunden
4. neue Wochenstunden

Keiner dieser Werte darf aus der Generalprobe abgeleitet werden.

---

### Entscheidung des Anwenders

**Zeitpunkt:** 2026-08-23, 11:13 Uhr (Europe/Berlin)

**Gestellte Frage:** „Die drei gesperrten Pläne 14-08 bis 14-10 schreiben auf die
Produktionsdatenbank. Soll ich sie starten?"

**Antwort des Anwenders, wörtlich:**

> Ja — Produktionslauf starten

**Gewählte Option:** `jetzt` — Fenster jetzt öffnen.

**Ausdrücklich mit der Freigabe verbundene Grenzen, vom Anwender gesetzt:**

- Ausgeführt wird **nur Plan 14-08**. Nach dessen Abschluss wird angehalten, es wird **nicht**
  auf 14-09 weitergeschaltet.
- **14-09** wartet auf die vier D6-Werte, die noch nicht vorliegen; sie werden gerade beim
  Anwender erfragt. Nichts davon wird erfunden oder aus der Generalprobe abgeleitet.
- **14-10** (Journal-Backfill) läuft erst nach der Verifikation aus 14-09. Der Anwender hat
  dafür bereits die Variante **Vollaufbau (`--all-months`)** gewählt — festgehalten für später,
  in diesem Fenster nicht ausgeführt.
- **14-11** (Release) hängt an der Produktionsverifikation.

**Vor dieser Freigabe ist kein Befehl gelaufen, der die Produktionsdatenbank schreibt.** Die
bis hierher ausgeführten Befehle waren ausschließlich lokale, lesende Git-Abfragen
(`git fetch`, `git ls-remote`, `git rev-list`, `git diff --name-only`, `git status`,
`git rev-parse`).
