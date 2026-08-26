# 14-RELEASE — Desktop-Release v1.9.0

**Datum:** 2026-08-26
**Ausführender:** Claude (GSD Plan Executor), Freigabe des Anwenders liegt vor
**Ausgangsstand:** HEAD `465d50a` auf `main`, Arbeitsbaum sauber, nichts unveröffentlicht
**Versionssprung:** 1.8.0 → **1.9.0** (Minor — neue Funktionen, kein Bruch bestehender Bedienwege)

---

## 0. Warum dieses Release nötig ist

`deploy-server.yml` liefert ausschließlich `server/**` aus. Die gesamte Desktop-Arbeit der
Phasen 12, 13, 14.1 und 14.2 erreicht die Anwender nur über ein Release.

**Der konkrete Anlass:** Die installierte Desktop-App des Anwenders ist v1.8.0 vom 20.08.2026 —
älter als Phase 12. Ihr fehlt der gesamte Stundenwechsel-Dialog. Gleichzeitig weist der Server
seit dem Deployment vom 23.08. jede Änderung der Wochenstunden über `PUT /api/users/:id` mit
`WorkPeriodBypassError` zurück (Fix aus Plan 14-02). Der alte Weg ist damit gesperrt, der neue
nicht installiert — **die Wochenstunden lassen sich derzeit bei niemandem ändern.** Dieses
Release schließt die Lücke.

## 0.1 Vorbedingungen — nachgeprüft, nicht übernommen

| Vorbedingung | Prüfung | Befund |
|---|---|---|
| D7 „Release erst nach erfolgreicher Produktionsverifikation" | Produktion läuft seit 26.08. auf `eaf5f5c`, Actions-Lauf `success`, Health-Check grün, Migrationsstand 18; der Anwender hat die Zahlen in der laufenden App selbst nachgeprüft (alle acht Monate auf die Minute, Saldo +2:00 h, kein Monat in der Zukunft, Urlaub 35 Tage) | **erfüllt** |
| `depends_on: ["14-10"]` (Journal-Backfill) | Plan 14-10 wurde nicht als Plan ausgeführt; sein Inhalt lief am 26.08. im Rahmen der Auslieferung als Vollaufbau (`--all-months`, Variante (b), vom Anwender gewählt) gegen die Produktion: +991 Journalzeilen, 0 Bewegung im angezeigten Saldo, danach 15 von 15 Nutzern deckungsgleich mit dem kanonischen Rechenweg. Beleg: `14-AUSLIEFERUNG.md`, Abschnitt 5 | **sachlich erfüllt** |
| Ausgangsversion in allen drei Dateien 1.8.0 | `grep` je Datei | **bestätigt** |
| Arbeitsbaum sauber | `git status --porcelain` → leer | **bestätigt** |

**Kein Zugriff auf die Produktionsdatenbank, kein weiteres Server-Deployment.** Der Server läuft
bereits auf dem richtigen Stand; dieses Release betrifft ausschließlich die Desktop-App.

---

## 1. Versionssprung — jede Datei einzeln geprüft

Der klassische Fehler dieser Checkliste ist eine vergessene der drei Dateien. Deshalb jede
einzeln, mit Zeilennummer:

| Datei | Zeile | Inhalt nach der Änderung |
|---|---:|---|
| `desktop/package.json` | 4 | `  "version": "1.9.0",` |
| `desktop/src-tauri/Cargo.toml` | 3 | `version = "1.9.0"` |
| `desktop/src-tauri/tauri.conf.json` | 4 | `  "version": "1.9.0",` |

**Gegenprobe auf verbliebenes `1.8.0`:**

```
$ grep -n "1\.8\.0" desktop/package.json desktop/src-tauri/tauri.conf.json desktop/src-tauri/Cargo.toml
(kein Treffer)
```

**Umfang der Änderung (T-14-SC — dieser Plan installiert kein Paket und ändert keine
Abhängigkeit):**

```
$ git diff --stat
 desktop/package.json              | 2 +-
 desktop/src-tauri/Cargo.toml      | 2 +-
 desktop/src-tauri/tauri.conf.json | 2 +-
 3 files changed, 3 insertions(+), 3 deletions(-)
```

Genau drei Dateien, genau drei Zeilen — ausschließlich das Feld `version`. Kein Eingriff an
`dependencies`.

**Nebenbefund, nicht behoben:** `desktop/src-tauri/Cargo.lock` führt das Paket `desktop` mit
`version = "1.3.2"` (Zeile 750) und ist damit seit mehreren Releases veraltet. Die Datei wurde
**nicht** angefasst: `tauri-action` baut ohne `--locked`, `cargo` schreibt den Wert im Runner
selbst nach, und v1.8.0 ist mit derselben veralteten Zeile fehlerfrei gebaut worden. Eine
Änderung hier wäre eine Abweichung ohne Anlass. Der Punkt gehört in `deferred-items.md`.

---

## 2. CHANGELOG

Neuer Abschnitt `## [1.9.0] - 2026-08-26` in `CHANGELOG.md` (Zeile 14), eingefügt zwischen
`## [Unreleased]` und `## [1.8.0]`. Vorhandene Einträge unverändert — `## [1.8.0]` steht
weiterhin vollständig ab Zeile 150.

**Umfang:** 19 Änderungspunkte (`#### `-Überschriften) in drei Gruppen — Added (6), Changed (2),
Fixed (11). Gefordert waren mindestens fünf. Die Punkte stammen aus `.planning/ROADMAP.md`
(Phasen 9 bis 14.2) und den SUMMARY-Dateien; nichts ist hinzuerfunden.

**T-14-68 (Information Disclosure) — vor dem Commit gegengelesen:** keine Nutzer-IDs, keine
Namen aus dem realen Umstellungsfall, keine Serveradressen, keine Zugangsdaten. Die Texte
beschreiben Funktionen in Anwendersprache, nicht in Klassennamen.

---

## 3. Gates vor dem Tag

Alle vier Gates liefen **vor** dem Tag (T-14-69). Ausgaben wörtlich:

### 3.1 `cd server && npx tsc --noEmit`

```
SERVER_TSC_EXIT=0
```

Keine Ausgabe, Exit 0. ✅

### 3.2 `cd desktop && npx tsc --noEmit`

```
DESKTOP_TSC_EXIT=0
```

Keine Ausgabe, Exit 0. ✅

### 3.3 `cd desktop && npm run check:rules`

Warum zusätzlich zur Checkliste in `.claude/CLAUDE.md`: `vitest` ist in `desktop/` nicht lauffähig
(fehlendes `@babel/runtime`); die Prüfskripte aus Phase 13 sind dort der einzige laufende Testweg
und dürfen vor einem Release nicht übersprungen werden.

```
> desktop@1.9.0 check:rules
> npm run check:rules:types && tsx src/components/ui/confirmDialogProps.check.ts && tsx src/components/worktime/overtimeTransactionFormat.check.ts && tsx src/components/worktime/workTimePeriodEditRules.check.ts && tsx src/components/worktime/workTimePeriodDeleteRules.check.ts && tsx src/components/worktime/workTimePeriodActionsSize.check.ts

> desktop@1.9.0 check:rules:types
> tsc -p tsconfig.check.json --noEmit

3 Tests bestanden.
17 Tests bestanden.
25 Tests bestanden.
19 Tests bestanden.
5 Tests bestanden.
EXIT=0
```

Fünf Prüfskripte, zusammen **69 Tests bestanden**, Exit 0. ✅
Die Kopfzeile bestätigt nebenbei den Versionssprung: `desktop@1.9.0`.

### 3.4 `cd server && npx vitest run`

```
 Test Files  2 failed | 45 passed (47)
      Tests  3 failed | 578 passed (581)
   Duration  27.78s
```

**Genau 3 rot, und zwar mit den bekannten Titeln:**

```
 FAIL  src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > should respect hire date and not include pre-employment months
 FAIL  src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > REGRESSION: User hired on 1st of month should calculate correctly
 FAIL  src/services/vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill
```

Wortgleich mit den in `14-01-PLAN.md` (Zeile 200-201), `14-ABNAHME-AUTO.md` (Zeile 142/146),
`14-PRODUKTIONSLAUF.md` (Zeile 606/609) und `14-REQ32-NACHWEIS.md` (Zeile 83/87) festgehaltenen
Titeln. Kein neuer roter Fall. ✅

Zum Vergleich: Plan 14-08 protokollierte 527 grün, jetzt 578 grün — die Zunahme stammt aus den
Tests der Phasen 14.1 und 14.2.

### 3.5 `git status --porcelain` nach dem Commit

Siehe Abschnitt 4.

---

## 4. Commit und Tag

*(wird in Task 1 Schritt D gefüllt)*

---

## 5. Workflow-Lauf

*(wird in Task 2 gefüllt)*

---

## 6. `latest.json` — Befund je Plattform

*(wird in Task 2 gefüllt)*

---

## 7. Abschließende Gates

*(wird in Task 3 gefüllt)*
