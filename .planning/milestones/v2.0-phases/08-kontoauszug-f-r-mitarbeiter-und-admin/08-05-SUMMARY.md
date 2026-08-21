---
phase: 08-kontoauszug-f-r-mitarbeiter-und-admin
plan: 05
subsystem: infra
tags: [tauri, github-actions, release, auto-update, semver]

# Dependency graph
requires:
  - phase: 08-kontoauszug-f-r-mitarbeiter-und-admin
    provides: "Kontoauszug-Backend, -Oberfläche und Begründungspflicht (08-01 bis 08-04), Server bereits in Produktion deployed und abgenommen"
provides:
  - "Desktop-Release v1.8.0 mit Installationsdateien für Windows, macOS (arm64+x64) und Linux (AppImage/deb/rpm)"
  - "Vollständige latest.json mit allen vier Auto-Update-Plattformschlüsseln (darwin-aarch64, darwin-x86_64, linux-x86_64, windows-x86_64)"
  - "CHANGELOG.md und PROJECT_STATUS.md auf dem Stand von v1.8.0"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Release-Ablauf exakt nach .claude/CLAUDE.md 'Release (Desktop App)': tsc --noEmit -> Versionsdreiklang -> Commit -> Push -> Tag -> Push Tag -> Watch -> Artefakt-/latest.json-Verifikation"

key-files:
  created: []
  modified:
    - desktop/package.json
    - desktop/src-tauri/Cargo.toml
    - desktop/src-tauri/tauri.conf.json
    - CHANGELOG.md
    - PROJECT_STATUS.md
    - .planning/phases/08-kontoauszug-f-r-mitarbeiter-und-admin/deferred-items.md

key-decisions:
  - "Vor dem Versionssprung zwei untracked Debris-Dateien entfernt (.claude/CLAUDETESTOUT.md, zwei bereits als 'stale' markierte WAL/SHM-Quarantänedateien) — keine davon je unter Versionskontrolle, das Löschen berührt keine Git-Historie; nötig, um die verbindliche Vorbedingung 'git status muss sauber sein' zu erfüllen"
  - "Kein manuelles gh release create — tauri-action legt das Release selbst an (releaseDraft: false), wie im Plan vorgegeben"

patterns-established: []

requirements-completed: [REQ-11, REQ-12, REQ-13]

# Metrics
duration: ~20min
completed: 2026-08-20
---

# Phase 08 Plan 05: Desktop-Release v1.8.0 Summary

**Release v1.8.0 veröffentlicht (kein Entwurf) mit Installationsdateien für Windows (exe+msi), macOS (arm64+x64 dmg) und Linux (AppImage+deb+rpm); `latest.json` enthält alle vier Auto-Update-Plattformschlüssel mit gesetzter Signatur — der Kontoauszug aus 08-01 bis 08-04 erreicht damit die Anwender.**

## Performance

- **Duration:** ~20 min (davon ~11 min Wartezeit auf den vierteiligen Matrix-Build)
- **Started:** 2026-08-20T21:00:00+02:00 (ca.)
- **Completed:** 2026-08-20T23:17:00+02:00
- **Tasks:** 3/3
- **Files modified:** 6 (5 aus Task 1 + deferred-items.md)

## Accomplishments

- Nebenversionssprung 1.7.3 → 1.8.0 in allen drei Versionsdateien (`package.json`, `Cargo.toml`, `tauri.conf.json`) durchgeführt und mit `tsc --noEmit` (Exit 0) vor dem Commit abgesichert
- `CHANGELOG.md`: `[Unreleased]`-Inhalt aus Plan 08-04 (Kontoauszug-Feature + IDOR-Fix) nach `## [1.8.0] - 2026-08-20` überführt, um den während der Abnahme gefundenen Saldo-Ketten-Fix ergänzt; `[Unreleased]` bleibt leer stehen
- `PROJECT_STATUS.md`: Version und "Recent Deployments"-Tabelle auf v1.8.0 aktualisiert, mit Hinweis, dass die Serveränderungen bereits am 20.08. über `deploy-server.yml` in Produktion sind
- Tag `v1.8.0` gesetzt und gepusht, Release-Workflow (`release.yml`, Run `32417477805`) mit allen vier Matrix-Jobs (macOS arm64, macOS x86_64, Windows, Linux) erfolgreich durchgelaufen (11m17s)
- Release `v1.8.0` verifiziert: `isDraft: false`, Name `TimeTracking System v1.8.0`, 16 Assets inklusive `.dmg` (×2), `.exe`/`.msi`, `.AppImage`/`.deb`/`.rpm` und `latest.json`
- `latest.json` heruntergeladen und programmatisch geprüft: alle vier Schlüssel `darwin-aarch64`, `darwin-x86_64`, `linux-x86_64`, `windows-x86_64` mit gesetztem `url` und `signature`, `version: "1.8.0"`

## Task Commits

Each task was committed atomically:

1. **Task 1: Versionsstand 1.8.0 und Dokumentation** - `513c851` (chore)
2. **Task 2: Tag setzen und Release-Build auslösen** - kein Commit (Plan sieht für diesen Task explizit keine Datei-Änderungen vor — reine Tag-/CI-Auslösung: `git tag v1.8.0`, `git push origin v1.8.0`)
3. **Task 3: Release-Artefakte und latest.json verifizieren** - kein Commit (reine Verifikation, keine Datei-Änderungen)

**Plan metadata:** wird zusammen mit dieser SUMMARY.md committet (siehe finaler Commit)

## Files Created/Modified

- `desktop/package.json` - `"version": "1.7.3"` → `"1.8.0"`
- `desktop/src-tauri/Cargo.toml` - `version = "1.7.3"` → `"1.8.0"`
- `desktop/src-tauri/tauri.conf.json` - `"version": "1.7.3"` → `"1.8.0"`
- `CHANGELOG.md` - `[Unreleased]`-Inhalt nach `## [1.8.0] - 2026-08-20` überführt, Saldo-Ketten-Fix als weiterer Fixed-Eintrag ergänzt
- `PROJECT_STATUS.md` - Version/Last-Updated-Kopf und Recent-Deployments-Tabelle um v1.8.0 ergänzt
- `.planning/phases/08-kontoauszug-f-r-mitarbeiter-und-admin/deferred-items.md` - Fund zu zwei entfernten Debris-Dateien dokumentiert

## Decisions Made

- Zwei untracked Debris-Dateien (`.claude/CLAUDETESTOUT.md`, zwei `*.stale_20260820_214843`-Quarantänedateien aus einer vorherigen Session) vor dem Versionssprung entfernt, um den von der Release-Checkliste verbindlich geforderten sauberen `git status` zu erreichen — keine der Dateien war je getrackt, kein Git-Historie-Eingriff
- Kein manuelles `gh release create` vor dem Tag-Push — `tauri-action` erzeugt das Release selbst (`releaseDraft: false`), wie im Plan explizit begründet

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Untracked Debris-Dateien verhinderten den geforderten sauberen `git status`**
- **Found during:** Task 1, Vorbereitung des Versionssprungs
- **Issue:** `.claude/CLAUDETESTOUT.md` (veraltete Kopie von CLAUDE.md mit 3-Tier-Workflow-Inhalt) sowie zwei bereits als `stale` markierte WAL/SHM-Quarantänedateien standen als untracked im Arbeitsverzeichnis. Die Release-Checkliste in `.claude/CLAUDE.md` verlangt "git status MUSS sauber sein, bevor der Tag gesetzt wird" als Pflicht-Vorbedingung.
- **Fix:** Alle drei Dateien mit `rm` entfernt (kein Git-Kommando, da sie nie getrackt waren). Fund in `deferred-items.md` dokumentiert.
- **Files modified:** keine Code-Datei betroffen; Dokumentation in `deferred-items.md`
- **Verification:** `git status --short` zeigte danach nur noch die fünf beabsichtigten Task-1-Änderungen
- **Committed in:** `513c851` (Task 1 commit, Löschung selbst ist keine Git-Änderung da untracked)

---

**Total deviations:** 1 auto-fixed (1 Blocking, Rule 3)
**Impact on plan:** Reine Aufräumarbeit an nicht-getrackten Debris-Dateien, keine Verhaltensänderung am Produktcode. Kein Scope Creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Risiken (für die Abnahme relevant, kein Blocker)

- **Notification-Guard nur im Browser getestet, nicht in der gebauten Tauri-App.** Der in Plan 08-04 nachgezogene Fix (`checkPermission()`/`send()` steigen still aus ohne `__TAURI_INTERNALS__`) wurde während der Entwicklung im Browser-Dev-Modus verifiziert. Der Guard selbst greift ausschließlich dort — in der ausgelieferten Desktop-App ist `__TAURI_INTERNALS__` immer vorhanden, sodass sich am Verhalten nichts ändert. Dennoch wurde der reguläre Erfolgspfad (Benachrichtigung wird angezeigt) in diesem Release nicht gegen die gebaute `.exe`/`.dmg`/`.AppImage` gegengeprüft, nur der Guard-Pfad im Browser.

## Next Phase Readiness

- Phase 8 vollständig abgeschlossen (5/5 Pläne). Alle vier Requirements (REQ-11 bis REQ-14) erfüllt und deployed.
- Milestone 2 ("Urlaubskonto: Korrektheit & Nachvollziehbarkeit") damit inhaltlich abgeschlossen — offener Restpunkt bleibt Phase 6 mit `gaps_found` (11/14 must_haves, unabhängig von Phase 8, blockiert nichts hier).
- Keine Blocker aus diesem Plan.

---
*Phase: 08-kontoauszug-f-r-mitarbeiter-und-admin*
*Completed: 2026-08-20*

## Self-Check: PASSED

Alle 7 im SUMMARY genannten Dateien auf der Festplatte gefunden. Commit `513c851` in `git log --all` gefunden. Tag `v1.8.0` unter `refs/tags/v1.8.0` auf `origin` bestätigt. Release-Workflow `32417477805` `completed`/`success` (alle 4 Matrix-Jobs `success`), `gh release view v1.8.0` liefert `isDraft: false`, `latest.json` enthält alle vier Plattformschlüssel mit `url`+`signature` und `version: "1.8.0"`.
