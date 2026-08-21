# Phase 14: Absicherung und Auslieferung - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Auto-generated (discuss übersprungen, Empfehlungen des Orchestrators gesetzt)

<domain>
## Phase Boundary

Der Umbau ist belegt, generalprobt und bei den Anwendern.

**Im Umfang:**
- Testabdeckung: Reduzierung mit künftigem Stichtag, Erhöhung mit rückwirkendem Stichtag,
  Stichtag mitten im Monat, Wechsel über einen Jahreswechsel, Periode löschen und neu rechnen
- Vollständiger Durchlauf auf einer Kopie der Produktionsdatenbank mit Vorher/Nachher-Vergleich
  aller Salden
- Backup vor dem Produktionslauf, Rückweg dokumentiert und erprobt
- Der konkret anstehende Umstellungsfall wird eingetragen und verifiziert
- Desktop-Release, damit die Änderungen die Anwender erreichen

**Requirements:** REQ-32, REQ-33

</domain>

<decisions>
## Implementation Decisions

### Entschieden (Empfehlung des Orchestrators, vom Anwender pauschal autorisiert)

**D1 — Die Generalprobe läuft vor dem Produktionslauf und ist eine eigene Freigabe.**
Reihenfolge, nicht verhandelbar: Testabdeckung grün → Generalprobe auf der
Produktionskopie mit Vorher/Nachher-Vergleich → Backup → Deployment → Produktionslauf →
Verifikation → Release. Jeder Schritt ist ein eigener Plan-Abschnitt mit eigenem
Nachweis.

**D2 — Der Produktionslauf pausiert für den Anwender.**
Alles bis zur Generalprobe einschließlich läuft autonom. Der Schritt, der die
Produktionsdatenbank schreibt (Migration + realer Umstellungsfall), wird als
`autonomous: false` geplant und wartet auf ausdrückliche Freigabe. Grund: Das ist die
einzige Stelle im Milestone, an der ein Fehler echte Mitarbeiterdaten trifft. Die
Erfahrung aus Phase 6 (Plan 06-07) zeigt außerdem: Der Code muss vor dem Datenlauf
deployed sein, sonst existiert das Skript auf dem Server gar nicht — das ist hier als
Vorbedingung mitzuplanen.

**D3 — Zwei-Stufen-Ablauf für jedes Skript gegen Produktion.**
Trockenlauf → Prüfung der Ausgabe → `--apply`. Dasselbe Muster wie in Plan 06-07. Kein
Skript schreibt beim ersten Aufruf.

**D4 — `DATABASE_PATH` explizit in jedem Skript und jedem Workflow-Schritt.**
`DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production npx tsx <skript>`.
Der Symlink `server/database.db` existiert auf dem Server nicht mehr. Ohne die Variable
entsteht eine leere Datenbank. In Phase 8 hatten `deploy-server.yml`, `migrate.ts` und
`validateSchema.ts` das noch nicht nachgezogen — vor dem Produktionslauf prüfen, ob das
inzwischen überall stimmt.

**D5 — Der Vorher/Nachher-Vergleich ist maschinell, nicht per Augenmaß.**
Das Salden-Snapshot-Werkzeug aus Phase 10 (D6) wird hier für alle Nutzer gefahren.
Ausgabe: eine Liste der Nutzer mit Differenz ungleich null. Erwartet wird genau die
Menge der Nutzer mit tatsächlichem Modellwechsel — jeder weitere Name ist ein Blocker,
kein Hinweis.

**D6 — Der reale Umstellungsfall wird vom Anwender bestätigt, bevor er eingetragen wird.**
Die konkreten Werte (welcher Nutzer, ab wann, von wie viel auf wie viel) stehen bisher
nirgends im Planungsstand. Der Plan fragt sie an der richtigen Stelle ab, statt sie zu
erfinden. Bis dahin wird der Fall als Platzhalter mit klar markierten offenen Werten
geführt.

**D7 — Release erst nach erfolgreicher Produktionsverifikation.**
Versionssprung in allen drei Dateien (`desktop/package.json`,
`desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`), sauberer
`git status`, `tsc --noEmit` grün für Server und Desktop, Tag, Release, danach Prüfung
dass `latest.json` alle vier Plattformschlüssel mit Signatur enthält. Muster aus Plan
08-05.

**D8 — Der Rückweg wird beschrieben und erprobt, nicht nur beschrieben.**
Backup ziehen, Rückspielen auf einer Kopie testen, Ergebnis dokumentieren. Ein
ungetesteter Rollback-Plan ist kein Rollback-Plan.

### Claude's Discretion
Testframework-Details, Skriptnamen, genaue Release-Notes und die Gliederung der
Dokumentation liegen im Ermessen der Planung.

</decisions>

<code_context>
## Existing Code Insights

- Release-Checkliste und die drei Versionsdateien: `.claude/CLAUDE.md` → „Release
  (Desktop App)". `latest.json` MUSS alle Plattformen enthalten, sonst ist Auto-Update
  kaputt.
- Deployment-Verifikation ist Pflicht: `gh run list`, danach Health-Check
  `curl http://129.159.8.19:3000/api/health`, danach Funktionstest.
- Backups liegen unter `/home/ubuntu/databases/backups/`. Namensmuster aus Phase 6:
  `production.PRE-<plan>_<YYYYMMDD>_<HHMMSS>.db`.
- `npm run sync-dev-db` zieht die Produktionskopie nach lokal.
- Frische Daten sind per direktem Dateizugriff nicht sichtbar (WAL) — Verifikation über
  API oder `pm2 logs timetracking-server`.
- Testdaten in Produktion, die beim Vorher/Nachher-Vergleich auftauchen werden:
  User 30 „Test Urlaub", User 31 „UAT", Antrag 73 (storniert).
- `deploy-server.yml` deployt ausschließlich `server/**` — Desktop-Änderungen erreichen
  Anwender nur über ein Release.

</code_context>

<specifics>
## Specific Ideas

- Die fünf Testfälle aus REQ-32 einzeln benennen und einzeln nachweisen, nicht als
  Sammelposten „Tests grün" abhaken.
- Die gesammelten UAT-Punkte aller Phasen 9–13 laufen hier zusammen — der Anwender hat
  ausdrücklich verfügt, dass die menschliche Abnahme des gesamten Milestones am Ende
  stattfindet. Der Plan soll sie als geschlossene Liste vorbereiten.

</specifics>

<deferred>
## Deferred Ideas

- Restpunkte aus der DB-Stabilisierung (Staging-Sync, Cron mit `DATABASE_PATH`,
  Quarantänedateien) — ausdrücklich out of scope dieses Milestones
- Urlaubsanspruch bei Teilzeitwechsel — eigener Seed

</deferred>
