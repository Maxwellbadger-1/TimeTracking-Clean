---
phase: 14-absicherung-und-auslieferung
plan: 11
subsystem: release
tags: [release, desktop, tauri, auto-update, ci-cd, dokumentation]
requires:
  - "14-08 — Produktionsauslieferung (Serverstand eaf5f5c)"
  - "14-10 — Journal-Backfill (sachlich erfüllt, siehe Abschnitt „Zur Abhängigkeit 14-10“)"
provides:
  - "GitHub Release v1.9.0 mit Binärdateien für Windows, macOS (arm64 + x64) und Linux"
  - "latest.json mit allen vier Plattformschlüsseln, je mit url und signature — Auto-Update funktionsfähig"
  - "14-RELEASE.md — vollständiges Release-Protokoll mit Gates, Lauf-Id, Artefakten und plattformweisem latest.json-Befund"
affects:
  - "Alle installierten Desktop-Apps: v1.8.0 bekommt v1.9.0 über den eingebauten Updater angeboten"
  - "PROJECT_STATUS.md und ROADMAP.md tragen den tatsächlichen Stand"
tech-stack:
  added: []
  patterns:
    - "Release entsteht ausschließlich über tauri-action (releaseDraft: false) — kein manuelles gh release create"
    - "latest.json wird je Plattformschlüssel einzeln auf url UND signature geprüft, nicht pauschal"
key-files:
  created:
    - ".planning/phases/14-absicherung-und-auslieferung/14-RELEASE.md"
    - ".planning/phases/14-absicherung-und-auslieferung/14-11-SUMMARY.md"
  modified:
    - "desktop/package.json"
    - "desktop/src-tauri/Cargo.toml"
    - "desktop/src-tauri/tauri.conf.json"
    - "CHANGELOG.md"
    - "PROJECT_STATUS.md"
    - ".planning/ROADMAP.md"
    - ".planning/phases/14-absicherung-und-auslieferung/14-UAT-SITZUNG.md"
    - ".planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md"
decisions:
  - "Version 1.9.0 (Minor): neue Funktionen, kein Bruch bestehender Bedienwege"
  - "Kein gh release create — tauri-action legt Release und latest.json selbst an; die Anleitung in .claude/CLAUDE.md ist für diesen Workflow überholt"
  - "Versionssprung und Release-Protokoll in zwei getrennte Commits (Atomarität), Tag auf den zweiten"
  - "latest.json: alle vier URLs auf HTTP 200 geprüft statt der geforderten einen Stichprobe"
  - "Cargo.lock (desktop = 1.3.2) bewusst nicht angefasst — Abweichung ohne Anlass"
metrics:
  duration: "~35 Minuten (davon 10 min 53 s Bauzeit)"
  completed: 2026-08-26
requirements-completed: [REQ-32, REQ-33]
---

# Phase 14 Plan 11: Release v1.9.0 Summary

Desktop-Release v1.9.0 veröffentlicht — alle vier Plattformen gebaut, `latest.json` je
Plattformschlüssel einzeln als vollständig und signiert belegt, Auto-Update damit funktionsfähig.

**Release:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/tag/v1.9.0

---

## Warum dieses Release dringend war

Die installierte Desktop-App des Anwenders war v1.8.0 vom 20.08.2026 — älter als Phase 12 und
damit ohne den gesamten Stundenwechsel-Dialog. Gleichzeitig weist der Server seit dem Deployment
vom 23.08. jede Änderung der Wochenstunden über `PUT /api/users/:id` mit `WorkPeriodBypassError`
zurück (Fix aus Plan 14-02).

Der alte Weg war gesperrt, der neue nicht installiert: **die Wochenstunden ließen sich bei
niemandem ändern.** Dieses Release löst die Sackgasse auf.

---

## Was gemacht wurde

### Task 1 — Versionssprung, CHANGELOG, Gates, Tag

**Version 1.8.0 → 1.9.0 in allen drei Dateien**, jede einzeln geprüft — ein vergessener Sprung
in einer der drei ist der klassische Fehler dieser Checkliste:

| Datei | Zeile | Inhalt |
|---|---:|---|
| `desktop/package.json` | 4 | `"version": "1.9.0",` |
| `desktop/src-tauri/Cargo.toml` | 3 | `version = "1.9.0"` |
| `desktop/src-tauri/tauri.conf.json` | 4 | `"version": "1.9.0",` |

Gegenprobe auf verbliebenes `1.8.0`: kein Treffer. `git diff --stat` zeigte genau drei Dateien
mit je einer Zeile — ausschließlich das Feld `version`, kein Eingriff an `dependencies` (T-14-SC).

**CHANGELOG:** Abschnitt `## [1.9.0] - 2026-08-26` mit **19 Änderungspunkten** (gefordert waren
mindestens fünf), gegliedert in Added (6), Changed (2) und Fixed (11). Die Punkte stammen aus
`.planning/ROADMAP.md` (Phasen 9 bis 14.2) und den SUMMARY-Dateien; nichts ist hinzuerfunden.
Vorhandene Einträge sind unverändert. Vor dem Commit auf T-14-68 gegengelesen: keine Nutzer-IDs,
keine Namen aus dem realen Umstellungsfall, keine Serveradressen, keine Zugangsdaten.

**Die vier Gates liefen vor dem Tag** (T-14-69):

| Gate | Ergebnis |
|---|---|
| `cd server && npx tsc --noEmit` | Exit 0, keine Ausgabe |
| `cd desktop && npx tsc --noEmit` | Exit 0, keine Ausgabe |
| `cd desktop && npm run check:rules` | Exit 0, 5 Prüfskripte, 69 Tests bestanden |
| `cd server && npx vitest run` | 578 grün, **genau 3 rot mit den bekannten Titeln** |
| `git status --porcelain` nach dem Commit | leer |

Die drei roten Titel sind wortgleich mit den in `14-01-PLAN.md`, `14-ABNAHME-AUTO.md`,
`14-PRODUKTIONSLAUF.md` und `14-REQ32-NACHWEIS.md` festgehaltenen. Kein neuer roter Fall.

**Commit, Push, Tag.** Der Push nach `main` berührte keinen `server/**`-Pfad; `deploy-server.yml`
wurde erwartungsgemäß **nicht** ausgelöst (jüngster Lauf bleibt der Produktionslauf
`32931242550` vom Morgen des 26.08., `success`). Danach `v1.9.0` gesetzt und gepusht — lokal und
auf dem Fernrepository bestätigt, zeigt auf `e341824`.

### Task 2 — Workflow überwacht, `latest.json` plattformweise geprüft

| Feld | Wert |
|---|---|
| **Lauf-Id** | `33005681228` |
| Dauer | **10 min 53 s** (erwartet 8–12 min) |
| Job-Ergebnisse | `["success"]` — alle vier Matrixjobs |
| Release | `isDraft: false`, `TimeTracking System v1.9.0`, 17 Artefakte |

**Die vier Zählprüfungen, einzeln:**

| Prüfung | Soll | Ist | Urteil |
|---|---|---:|---|
| macOS `.dmg` | ≥ 1 | 2 (`aarch64`, `x64`) | ✅ |
| Windows `.exe`/`.msi` | ≥ 1 | 2 (`x64-setup.exe`, `x64_en-US.msi`) | ✅ |
| Linux `.AppImage`/`.deb` | ≥ 2 | 2 (+ zusätzlich ein `.rpm`) | ✅ |
| `latest.json` | = 1 | 1 | ✅ |

**`latest.json` — die kritischste Prüfung des Plans.** Ein vorhandenes `latest.json` sagt für
sich genommen nichts darüber, ob es alle Plattformen enthält (T-14-65). Deshalb je Schlüssel
eine eigene Zeile, geprüft auf Existenz **und** auf nach `trim()` nicht leeren Inhalt:

| Schlüssel | `url` | `signature` | HTTP |
|---|---|---|---|
| `darwin-aarch64` | gesetzt, 128 Zeichen | gesetzt, 436 Zeichen | 200 ✅ |
| `darwin-x86_64` | gesetzt, 124 Zeichen | gesetzt, 436 Zeichen | 200 ✅ |
| `linux-x86_64` | gesetzt, 130 Zeichen | gesetzt, 448 Zeichen | 200 ✅ |
| `windows-x86_64` | gesetzt, 129 Zeichen | gesetzt, 448 Zeichen | 200 ✅ |

`version` = `1.9.0`. Alle Signaturen beginnen mit
`dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRh…` (Base64 für „untrusted comment: signature
from ta…") — echte minisign-Signaturen, keine Platzhalter. `windows-x86_64` zeigt auf die
NSIS-`.exe`; das ist die beabsichtigte Wirkung von `updaterJsonPreferNsis: true`.

Gefordert war eine HTTP-Stichprobe auf **eine** URL. Geprüft wurden **alle vier** — eine Zeile,
deren Datei nicht liegt, ist genauso kaputt wie eine fehlende Zeile.

### Task 3 — Dokumentation nachgezogen

- **`PROJECT_STATUS.md`:** Version auf v1.9.0, Deployment-Eintrag für 2026-08-26, neuer Abschnitt
  „Produktionslauf Milestone v3.0" mit Sicherung, Deployment, Migrationsstand, Bereinigung,
  Backfill, Saldowirkung und den geschützten Tabellen — **samt der offenen Punkte**. Der
  Restposten-Abschnitt (in Plan 14-02 gepflegt) wurde nicht angefasst.
- **`.planning/ROADMAP.md`, Fortschrittstabelle:** an `STATE.md` gegengeprüft und richtiggestellt.
- **`14-UAT-SITZUNG.md`:** Gruppe C als ab jetzt prüfbar ausgewiesen, mit Version v1.9.0 und Datum.
- **`14-UAT-SAMMLUNG.md`:** bei `14-U3` das maschinelle Prüfergebnis und der verbliebene offene
  Rest. `git diff` zeigt für diese Datei ausschließlich Ergänzungen im Phase-14-Abschnitt.

---

## Zur Abhängigkeit `depends_on: ["14-10"]` — nicht stillschweigend übergangen

Plan 14-10 wurde **nicht als Plan** ausgeführt; ein `14-10-SUMMARY.md` existiert nicht. Sein
**Inhalt** ist jedoch erledigt: Der Journal-Backfill lief am 26.08.2026 im Rahmen der
Auslieferung als Vollaufbau (`--all-months`, Variante (b), vom Anwender gewählt) gegen die
Produktion.

| Kennzahl | Ergebnis |
|---|---|
| Journalzeilen | **+991** (2590 → 3581), 100 Monate ohne Abbruch |
| Bewegung im angezeigten Saldo | **0** — der Backfill zog die Buchungsliste nach, ohne die Zahl zu verschieben |
| Übereinstimmung mit dem kanonischen Rechenweg | **15 von 15** Nutzern (vorher 10 von 15) |
| Geschützte Tabellen | SHA-256 vor und nach dem Lauf identisch |

Beleg: `14-AUSLIEFERUNG.md`, Abschnitt 5. **Die Abhängigkeit ist damit sachlich erfüllt** — was
fehlt, ist die Plan-Bahn, nicht das Ergebnis.

## Zu D7 („Release erst nach erfolgreicher Produktionsverifikation") — erfüllt

Die Produktion läuft seit dem 26.08. auf `eaf5f5c`, Actions-Lauf `success`, Health-Check grün,
Migrationsstand 18. Entscheidend: **Der Anwender hat die Zahlen selbst in der laufenden App
nachgeprüft** und bestätigt — alle acht Monate auf die Minute, Saldo +2:00 h, kein Monat in der
Zukunft, Urlaub 35 Tage. Das ist die Verifikation, die D7 verlangt; das Release liegt danach,
nicht davor.

---

## Abweichungen vom Plan

### 1. [Rule 2 — Dokumentationskorrektheit] ROADMAP-Fortschrittstabelle: fehlende Zeile für Phase 14.2 ergänzt

- **Gefunden bei:** Task 3, Schritt B
- **Befund:** Der Plan verlangte, die Zeilen für Phase 10 und 11 richtigzustellen und die Zeile
  für Phase 14 zu ergänzen, mit dem Zusatz „Keine anderen Zeilen ändern". Beim Bearbeiten zeigte
  sich, dass die Tabelle für **Phase 14.2 überhaupt keine Zeile** trägt — obwohl die Phase mit
  13 von 13 Plänen abgeschlossen und verifiziert ist. Der Zweck des Schritts („die Tabelle trägt
  einen veralteten Stand") wäre bei wörtlicher Auslegung verfehlt worden.
- **Behandlung:** Zeile für Phase 14.2 **additiv** ergänzt (13/13, elf Befunde geschlossen,
  F-7 eingeschränkt, Verifikation `human_needed` 8/10 + 2/10, 45 offene Abnahmepunkte). Keine
  bestehende Zeile außer 10, 11 und 14 wurde verändert — die Vorgabe bleibt eingehalten.
- **Commit:** `c68f393`

### 2. [Rule 3 — Blockierendes Werkzeug] Dateibearbeitung über Node statt Python

- **Gefunden bei:** Task 1, Schritt B
- **Befund:** `python` ist auf diesem Rechner nicht installiert (Windows-Store-Alias). Zusätzlich
  scheiterten mehrzeilige Bash-Heredocs mit umfangreichem Unicode-Inhalt an der Shell-Umhüllung.
- **Behandlung:** Die Textbearbeitungen liefen über kurze Node-Skripte im Scratchpad, jeweils mit
  einer Eindeutigkeitsprüfung des Ankers (`throw` bei ≠ 1 Treffer), damit keine Ersetzung
  versehentlich mehrfach greift. Keine Projektdatei und keine Abhängigkeit betroffen.

### 3. Erweiterte Prüftiefe (über den Plan hinaus, kein Abstrich)

- **HTTP-Prüfung:** alle vier `latest.json`-URLs statt der geforderten einen Stichprobe.
- **Zwei Commits statt einem** für Task 1: Versionssprung (`chore`) und Release-Protokoll
  (`docs`) getrennt, weil es zwei verschiedene Dinge sind. Der Tag sitzt auf dem zweiten, damit
  `git status --porcelain` vor dem Tag leer ist.

### 4. Abweichung von `.claude/CLAUDE.md` — bewusst und begründet

Schritt 9 der Anleitung „Release erstellen" nennt `gh release create v1.X.Y`. Für diesen Workflow
ist das **überholt**: `tauri-action` läuft mit `releaseDraft: false` und `includeUpdaterJson: true`
und legt Release **und** `latest.json` selbst an. Ein manuelles Release hätte kollidiert (T-14-67).
Im Protokoll ausdrücklich vermerkt, damit die Stelle beim nächsten Release nicht erneut zu einem
doppelten Release führt.

---

## Nicht behoben — bewusst

**`desktop/src-tauri/Cargo.lock`** führt das Paket `desktop` mit `version = "1.3.2"` (Zeile 750)
und ist damit seit mehreren Releases veraltet. Nicht angefasst: `tauri-action` baut ohne
`--locked`, `cargo` schreibt den Wert im Runner selbst nach, und v1.8.0 ist mit derselben
veralteten Zeile fehlerfrei gebaut worden — dieser Lauf ebenso. Eine Änderung wäre eine
Abweichung ohne Anlass gewesen. Aufräumpunkt für später.

## Offen — nicht beschönigt

1. **Plan 14-09 ist nicht ausgeführt.** Der reale Umstellungsfall ist auf der Produktion noch
   **nicht** eingetragen; `14-UMSTELLUNGSFALL.md` existiert nicht. Er ist der zweite
   Schreibzugriff auf echte Mitarbeiterdaten (D2) und wartet auf die Freigabe des Anwenders.
   Mit v1.9.0 steht der dafür nötige Bedienweg jetzt erstmals zur Verfügung.
   **Folge für die Dokumentation:** In `PROJECT_STATUS.md` steht deshalb **nicht**, der
   Umstellungsfall sei eingetragen — der Plan-Text für Schritt A hätte das nahegelegt, es wäre
   aber unwahr gewesen.
2. **`14-U3` ist nur zur Hälfte erledigt.** Ein vollständiges `latest.json` ist die
   *Voraussetzung* dafür, dass der Updater greift — nicht der *Beweis*, dass er es tut. Ob eine
   installierte Vorversion das Update tatsächlich zieht, zeigt erst das echte Gerät. Bleibt
   Punkt der Abnahmesitzung, Gruppe C.
3. **75 Abnahmepunkte offen** — 30 aus Phase 14.1, 45 aus Phase 14.2, gesammelt in
   `14-UAT-SAMMLUNG.md`.
4. **29 Monatszeilen** stimmen weiterhin nicht mit dem Journal überein (4 der 11 betroffenen
   Nutzer sind soft-gelöschte Testkonten, die der Backfill bewusst überspringt).
5. **Nebenbefunde B-1 und B-2** aus der Auslieferung: Der Deploy-Workflow schaltet den
   pausierten Nachtlauf bei jedem Deployment wieder an und löscht die `.mjs`-Messwerkzeuge aus
   dem Server-Checkout.

---

## Bekannte Stubs

Keine. Dieser Plan hat keinen Anwendungscode geschrieben — die Änderungen beschränken sich auf
drei Versionsfelder und Dokumentation.

## Threat Flags

Keine. Der Plan führt keine neue Netzwerkschnittstelle, keinen Auth-Pfad, keinen Dateizugriff und
keine Schemaänderung an einer Vertrauensgrenze ein. Die Produktionsdatenbank wurde nicht berührt,
und es lief kein weiteres Server-Deployment.

---

## Commits

| Hash | Betreff |
|---|---|
| `69987aa` | `chore: Bump version to v1.9.0` |
| `e341824` | `docs(14-11): Release-Protokoll v1.9.0 anlegen - Versionssprung und Gates` |
| `c68f393` | `docs(14): Release v1.9.0 und Produktionslauf festschreiben` |

Tag `v1.9.0` → `e341824`, lokal und auf dem Fernrepository.

---

## Erfüllung der Muss-Aussagen

| Aussage | Beleg | Urteil |
|---|---|---|
| Version in allen drei Dateien identisch auf 1.9.0 | Abschnitt 1 in `14-RELEASE.md`, `grep` je Datei plus Negativprobe | ✅ |
| Release veröffentlicht, Binärdateien für Windows, macOS und Linux | 17 Artefakte, `isDraft: false`, alle vier Matrixjobs `success` | ✅ |
| `latest.json` mit allen vier Plattformschlüsseln, je mit `url` und `signature` | Abschnitt 6 in `14-RELEASE.md`, je Schlüssel eine eigene Zeile, plus 4 × HTTP 200 | ✅ |
| `tsc --noEmit` grün für Server und Desktop, `git status` sauber | Abschnitte 3 und 7 in `14-RELEASE.md`, vor **und** nach dem Tag gefahren | ✅ |

---

## Self-Check: PASSED

Alle 10 in dieser SUMMARY genannten Dateien existieren auf der Platte. Alle drei Commit-Hashes
(`69987aa`, `e341824`, `c68f393`) sind in `git log --oneline --all` auffindbar. Der Tag `v1.9.0`
steht auf dem Fernrepository und zeigt auf `e34182436ca47d1e5dfbd9023455c131ba195f51`. Das
Release trägt `isDraft=false` und den Tag `v1.9.0`. Keine Behauptung ohne Beleg.
