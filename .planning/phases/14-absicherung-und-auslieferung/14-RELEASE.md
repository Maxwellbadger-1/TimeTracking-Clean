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

Zwei Commits, atomar getrennt — der Versionssprung ist eine Sache, das Protokoll darüber eine
andere:

| Commit | Betreff | Dateien |
|---|---|---|
| `69987aa` | `chore: Bump version to v1.9.0` | `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `CHANGELOG.md` |
| `e341824` | `docs(14-11): Release-Protokoll v1.9.0 anlegen - Versionssprung und Gates` | `14-RELEASE.md` |

Nachkontrolle auf ungewollte Löschungen (`git diff --diff-filter=D --name-only HEAD~1 HEAD`):
leer — kein Wegfall einer verfolgten Datei.

**`git status --porcelain` nach den Commits:** leer. ✅

### Push nach `main`

```
$ git push origin main
   d0d080e..e341824  main -> main
```

**Anmerkung:** Der Push umfasste außer den beiden neuen Commits auch die beiden bereits vor
diesem Plan erzeugten Dokumentations-Commits `91b9c05` und `465d50a`, die lokal noch nicht
veröffentlicht waren. Beide berühren ausschließlich `.planning/**` und lösen kein Deployment aus.

### `deploy-server.yml` — nicht ausgelöst, wie erwartet

Geänderte Pfade des Pushes:

```
$ git diff --name-only d0d080e..HEAD | grep "^server/"
(keine server/**-Änderung)
```

```
$ gh run list --workflow="deploy-server.yml" --limit 1
completed  success  docs(14.2): Phase 14.2 verifiziert …  32931242550  2026-08-26T04:42:47Z
```

Der jüngste Lauf ist der Produktionslauf vom Morgen des 26.08. (`success`). Kein neuer Lauf
durch diesen Push — korrekt, da kein `server/**`-Pfad berührt wurde.

### Tag

```
$ git tag v1.9.0 && git push origin v1.9.0
 * [new tag]         v1.9.0 -> v1.9.0

$ git tag --list v1.9.0
v1.9.0

$ git ls-remote --tags origin v1.9.0
e34182436ca47d1e5dfbd9023455c131ba195f51	refs/tags/v1.9.0
```

Der Tag steht lokal **und** auf dem Fernrepository und zeigt auf `e341824`. ✅

---

## 5. Workflow-Lauf

| Feld | Wert |
|---|---|
| Workflow | `Release Desktop App` (`.github/workflows/release.yml`) |
| **Lauf-Id** | **`33005681228`** |
| Auslöser | Push des Tags `v1.9.0` |
| Commit | `e34182436ca47d1e5dfbd9023455c131ba195f51` |
| Beginn | 2026-08-26 19:32:24 UTC |
| Ende | 2026-08-26 19:43:17 UTC |
| **Dauer** | **10 min 53 s** (erwartet waren 8 bis 12 Minuten) |

### Job-Ergebnisse — alle vier Matrixeinträge

```
$ gh run view 33005681228 --json jobs --jq '[.jobs[].conclusion] | unique'
["success"]
```

| Job | Ergebnis |
|---|---|
| `release (windows-latest)` | `success` |
| `release (macos-latest, --target aarch64-apple-darwin)` | `success` |
| `release (macos-latest, --target x86_64-apple-darwin)` | `success` |
| `release (ubuntu-22.04)` | `success` |

Kein Fehlschlag, kein erneuter Versuch, kein verschobener Tag. ✅

### Release

```
$ gh release view v1.9.0 --json isDraft,name,tagName,isPrerelease,url
{"isDraft":false,"isPrerelease":false,"name":"TimeTracking System v1.9.0","tagName":"v1.9.0",
 "url":"https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/tag/v1.9.0"}
```

**`isDraft` = `false`** ✅ — das Release ist öffentlich sichtbar, nicht als Entwurf hängengeblieben.
Veröffentlicht 2026-08-26 19:39:30 UTC durch `github-actions[bot]`.

**Kein `gh release create` verwendet — und das ist kein Versehen.**
`.claude/CLAUDE.md` nennt unter „Release erstellen", Schritt 9, den Befehl
`gh release create v1.X.Y`. Für **diesen** Workflow ist diese Anleitung **überholt**:
`tauri-apps/tauri-action` läuft mit `releaseDraft: false` (release.yml Zeile 88) und
`includeUpdaterJson: true` (Zeile 90) und legt Release **und** `latest.json` selbst an. Ein
manuell erzeugtes Release würde mit dem des Workflows kollidieren (T-14-67 — doppeltes oder
fremdes Release). **Beim nächsten Release ebenfalls weglassen.**

### Artefakte — die vollständige Liste

17 Dateien, `gh release view v1.9.0 --json assets --jq '.assets[].name'`:

| Datei | Größe |
|---|---:|
| `latest.json` | 7.707 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_x64-setup.exe` | 4.789.714 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_x64-setup.exe.sig` | 448 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_x64_en-US.msi` | 6.737.920 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_x64_en-US.msi.sig` | 448 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_aarch64.dmg` | 6.734.729 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_x64.dmg` | 7.188.957 B |
| `Stiftung.der.DPolG.TimeTracker_aarch64.app.tar.gz` | 6.857.249 B |
| `Stiftung.der.DPolG.TimeTracker_aarch64.app.tar.gz.sig` | 436 B |
| `Stiftung.der.DPolG.TimeTracker_x64.app.tar.gz` | 7.245.646 B |
| `Stiftung.der.DPolG.TimeTracker_x64.app.tar.gz.sig` | 436 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_amd64.AppImage` | 85.531.128 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_amd64.AppImage.sig` | 448 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_amd64.deb` | 8.430.784 B |
| `Stiftung.der.DPolG.TimeTracker_1.9.0_amd64.deb.sig` | 444 B |
| `Stiftung.der.DPolG.TimeTracker-1.9.0-1.x86_64.rpm` | 8.430.952 B |
| `Stiftung.der.DPolG.TimeTracker-1.9.0-1.x86_64.rpm.sig` | 448 B |

### Die vier Zählprüfungen — jede einzeln

| # | Prüfung | Soll | Ist | Dateien | Urteil |
|---|---|---|---:|---|---|
| 1 | macOS `.dmg` | ≥ 1 | **2** | `…_1.9.0_aarch64.dmg`, `…_1.9.0_x64.dmg` | ✅ |
| 2 | Windows `.exe` oder `.msi` | ≥ 1 | **2** | `…_1.9.0_x64-setup.exe`, `…_1.9.0_x64_en-US.msi` | ✅ |
| 3 | Linux `.AppImage` oder `.deb` | ≥ 2 | **2** | `…_1.9.0_amd64.AppImage`, `…_1.9.0_amd64.deb` | ✅ |
| 4 | `latest.json` | = 1 | **1** | `latest.json` | ✅ |

Zusätzlich, nicht gefordert, aber vorhanden: ein `.rpm` für Linux und die beiden
`.app.tar.gz`-Bündel für macOS (das sind die Dateien, aus denen der Updater auf macOS zieht).

---

## 6. `latest.json` — Befund je Plattform

Das ist die Prüfung, an der das Auto-Update kaputtgeht, wenn man sie überspringt. Ein
vorhandenes `latest.json` sagt für sich genommen **nichts** darüber, ob es alle Plattformen
enthält (T-14-65).

Heruntergeladen mit `gh release download v1.9.0 -p latest.json -D <tmp>`, Größe 7.707 B.

**Kopfdaten:**

| Feld | Wert | Urteil |
|---|---|---|
| `version` | `1.9.0` | ✅ stimmt mit dem Tag und den drei Versionsdateien überein |
| `pub_date` | `2026-08-26T19:42:29.007Z` | — |

**Vorhandene Plattformschlüssel (11 insgesamt):**

```
darwin-aarch64, darwin-aarch64-app, darwin-x86_64, darwin-x86_64-app,
linux-x86_64, linux-x86_64-appimage, linux-x86_64-deb, linux-x86_64-rpm,
windows-x86_64, windows-x86_64-nsis, windows-x86_64-msi
```

Die vier geforderten sind darunter; die sieben weiteren sind Varianten, die `tauri-action`
zusätzlich einträgt, und stören nicht.

### Je Schlüssel eine eigene Zeile — keine Sammelaussage

| Schlüssel | `url` | `signature` | Ziel | Urteil |
|---|---|---|---|---|
| **`darwin-aarch64`** | gesetzt, 128 Zeichen | gesetzt, 436 Zeichen | `…/v1.9.0/Stiftung.der.DPolG.TimeTracker_aarch64.app.tar.gz` | ✅ |
| **`darwin-x86_64`** | gesetzt, 124 Zeichen | gesetzt, 436 Zeichen | `…/v1.9.0/Stiftung.der.DPolG.TimeTracker_x64.app.tar.gz` | ✅ |
| **`linux-x86_64`** | gesetzt, 130 Zeichen | gesetzt, 448 Zeichen | `…/v1.9.0/Stiftung.der.DPolG.TimeTracker_1.9.0_amd64.AppImage` | ✅ |
| **`windows-x86_64`** | gesetzt, 129 Zeichen | gesetzt, 448 Zeichen | `…/v1.9.0/Stiftung.der.DPolG.TimeTracker_1.9.0_x64-setup.exe` | ✅ |

Geprüft wurde je Schlüssel **beides**: dass das Feld existiert **und** dass es nach `trim()`
nicht leer ist. Alle Signaturen beginnen mit `dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRh…`
(Base64 für „untrusted comment: signature from ta…") — es sind echte minisign-Signaturen, keine
Platzhalter.

`windows-x86_64` zeigt auf die NSIS-`.exe` und nicht auf die `.msi`; das ist die Wirkung von
`updaterJsonPreferNsis: true` (release.yml Zeile 91) und beabsichtigt.

**Vergleich mit v1.8.0:** Diese Fassung trägt dieselben vier Schlüssel vollständig — kein
Rückschritt gegenüber der Vorversion.

### Erreichbarkeit — alle vier statt nur einer Stichprobe

Gefordert war eine Stichprobe auf **eine** URL. Geprüft wurden alle vier, weil eine Zeile,
deren Datei nicht liegt, genauso kaputt ist wie eine fehlende Zeile:

```
$ curl -sIL -o /dev/null -w "%{http_code}" <url>
darwin-aarch64 -> HTTP 200
darwin-x86_64  -> HTTP 200
linux-x86_64   -> HTTP 200
windows-x86_64 -> HTTP 200
```

Alle vier ✅.

### Urteil

**Alle vier Plattformschlüssel sind vollständig, signiert und erreichbar. Das Auto-Update
funktioniert für Windows, macOS (Apple Silicon und Intel) und Linux.** Der Anwender bekommt
v1.9.0 über den eingebauten Updater seiner installierten v1.8.0 angeboten.

---

## 7. Abschließende Gates

Nach den Dokumentationsänderungen erneut gefahren — dieselben vier Gates, damit das Protokoll
nicht nur den Stand vor dem Tag belegt:

| Gate | Ergebnis | Urteil |
|---|---|---|
| `cd server && npx tsc --noEmit` | keine Ausgabe, `SERVER_TSC_EXIT=0` | ✅ |
| `cd desktop && npx tsc --noEmit` | keine Ausgabe, `DESKTOP_TSC_EXIT=0` | ✅ |
| `cd desktop && npm run check:rules` | 5 Prüfskripte, alle „Tests bestanden", `CHECKRULES_EXIT=0` | ✅ |
| `cd server && npx vitest run` | `Test Files 2 failed \| 45 passed (47)` / `Tests 3 failed \| 578 passed (581)` | ✅ genau 3 rot |

Die drei roten Titel sind unverändert dieselben wie in Abschnitt 3.4:

```
 FAIL  src/services/unifiedOvertimeService.test.ts > … > should respect hire date and not include pre-employment months
 FAIL  src/services/unifiedOvertimeService.test.ts > … > REGRESSION: User hired on 1st of month should calculate correctly
 FAIL  src/services/vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill
```

Kein neuer roter Fall durch die Änderungen dieses Plans.

---

## 8. Zusammenfassung

| Punkt | Ergebnis |
|---|---|
| Version in allen drei Dateien | **1.9.0**, jede einzeln geprüft, keine Restspur von `1.8.0` |
| CHANGELOG | Abschnitt `## [1.9.0] - 2026-08-26`, 19 Änderungspunkte in Anwendersprache |
| Gates vor dem Tag | 4 von 4 wie erwartet (2 × `tsc` Exit 0, `check:rules` Exit 0, `vitest` 578 grün / genau 3 bekannte rot) |
| `git status` nach dem Commit | leer |
| Tag | `v1.9.0` → `e341824`, lokal und auf dem Fernrepository |
| Workflow-Lauf | **`33005681228`**, 10 min 53 s, alle vier Matrixjobs `success` |
| Release | veröffentlicht, `isDraft: false`, 17 Artefakte |
| Zählprüfungen | `.dmg` 2 ✅ · `.exe`/`.msi` 2 ✅ · `.AppImage`/`.deb` 2 ✅ · `latest.json` 1 ✅ |
| **`latest.json`** | **`version` 1.9.0; alle vier Plattformschlüssel mit gesetzter `url` und `signature`; alle vier URLs HTTP 200** |
| Abschließende Gates | 4 von 4 unverändert |
| Produktionsdatenbank | **nicht berührt** — kein Zugriff, kein weiteres Server-Deployment |

**Release:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/tag/v1.9.0

### Was das für den Anwender heißt

Seine installierte v1.8.0 vom 20.08. bekommt v1.9.0 über den eingebauten Updater angeboten —
der `windows-x86_64`-Eintrag ist vorhanden, signiert und die hinterlegte Datei liegt (HTTP 200).
Damit steht ihm der Stundenwechsel-Dialog zur Verfügung, und die seit dem 23.08. bestehende
Sackgasse (Server sperrt den alten Weg, neuer Weg nicht installiert) ist aufgelöst.

**Ein Vorbehalt, der nicht weggeredet wird:** Ein vollständiges `latest.json` ist die
*Voraussetzung* dafür, dass der Updater greift — nicht der *Beweis*, dass er es tut. Ob eine
installierte Vorversion das Update wirklich zieht, zeigt erst das Gerät. Das bleibt Punkt
`14-U3` der Abnahmesitzung (Gruppe C).

### Für das nächste Release

1. **Kein `gh release create`.** Schritt 9 der Anleitung in `.claude/CLAUDE.md` ist für diesen
   Workflow überholt — `tauri-action` legt Release und `latest.json` selbst an.
2. **`latest.json` je Schlüssel einzeln prüfen**, auf `url` **und** `signature`, nicht nur auf
   Anwesenheit des Schlüssels. Eine Sammelaussage „alle vorhanden" ist keine Prüfung.
3. **`desktop/src-tauri/Cargo.lock`** führt `desktop` weiterhin mit `1.3.2`. Bisher folgenlos,
   aber ein Aufräumpunkt.
