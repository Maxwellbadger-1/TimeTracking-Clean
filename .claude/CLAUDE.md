# TimeTracking System — Entwicklungsleitlinien

**Stand:** 2026-08-27 · Milestone v3.0 ausgeliefert · Desktop v1.9.0 · Server `eaf5f5c`

---

# 📚 Wo steht was

| Frage | Datei |
|---|---|
| Wo stehen wir gerade? | `.planning/STATE.md` (GSD-Zustand, offene Pläne) |
| Was ist ausgeliefert / bekannt kaputt? | `PROJECT_STATUS.md` |
| WIE ist das System gebaut? | `ARCHITECTURE.md` (Patterns, ADRs) |
| WAS tut das System? | `PROJECT_SPEC.md` (Requirements, API, Datenmodell) |
| Wann funktionierte es zuletzt? | `CHANGELOG.md` |
| Umgebung, SSH, Deployment-Variablen | `ENV.md` |

**„Core Docs"** = PROJECT_STATUS · ARCHITECTURE · PROJECT_SPEC · CHANGELOG · ENV.

- **Session-Start:** `.planning/STATE.md` + `PROJECT_STATUS.md`. Alles Weitere bei Bedarf.
- **Feature:** PROJECT_SPEC (Requirements) + ARCHITECTURE (Patterns) → Plan → Umsetzung.
- **Bugfix:** CHANGELOG (seit wann?) + ARCHITECTURE (Sollverhalten) → reproduzieren → Root Cause.
- **Deployment/Skripte:** ENV.md. SSH-Key liegt im Projekt-Root unter `.ssh/oracle_server.key`.

---

# 🎯 Kern-Prinzipien

## 0. Keine Halluzinationen

Keine Annahmen, keine Interpretationen. Verboten sind Sätze wie „sieht korrekt aus",
„sollte funktionieren", „der Rest ist ähnlich" — und jede Erwähnung einer Funktion, die
nicht gelesen wurde.

Bei Code-Vergleichen gilt: jede relevante Funktion **gelesen**, jede SQL-Abfrage **exakt**
verglichen, jede Berechnung Schritt für Schritt nachvollzogen, jede Abweichung notiert
(auch kleine), jeder Fix mit echten Daten verifiziert. Belege mit Datei und Zeilennummer,
nicht mit Eindrücken.

Sagt der Anwender „durchforste komplett" oder „keine Halluzinationen" → gilt das absolut.

## 1. Keine Regression
Funktionierende Features dürfen nicht kaputtgehen. Vor jeder Änderung: Plan → Freigabe →
Umsetzung → Test (Happy Path **und** Randfälle).

## 2. Plan zuerst
Nie direkt drauflos coden. Bei Komplexität „think hard" nutzen.

## 3. Dokumentation mitführen
Core Docs vorher lesen, während der Arbeit aktualisieren. Commit-Nachricht erklärt das WARUM.

---

# ⚡ Kritische Regeln

## 🛑 Produktionsdatenbank: niemals aus einem eigenen Prozess öffnen

`/home/ubuntu/databases/production.db` darf **nie** aus einem eigenen Prozess geöffnet
werden — **auch nicht `readonly`, auch nicht mit `VACUUM INTO`.** Ein Lesezugriff wirkt
harmlos, ist es aber nicht: SQLite räumt WAL- und SHM-Datei auf, sobald sich eine
Verbindung für die letzte hält, und übersieht dabei den laufenden Serverprozess.

Zwei Vorfälle dieser Art: `.planning/debug/db-stabilisierung-20260818.md` und
`.planning/debug/wal-abgehaengt-20260827.md` (der Server schrieb neun Stunden lang in eine
aus dem Dateisystem gelöschte WAL-Datei; ein Neustart hätte alles seit 11:26 UTC vernichtet).

**Stattdessen:** über die API der laufenden Anwendung prüfen, `pm2 logs` lesen, den
Anwender um ein Backup **über die App** bitten, oder auf einer bereits vorhandenen Kopie
arbeiten. Gilt sinngemäß für jede SQLite-Datei, die ein laufender Dienst offen hält.

## 🗄️ Datenbank-Regeln

1. **`DATABASE_PATH` immer explizit setzen.** Auf dem Server existiert **kein Symlink**
   `server/database.db` mehr (entfernt 20.08.2026):
   ```bash
   DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production npx tsx <skript>
   ```
   Ohne die Variable legt ein Skript eine leere Datenbank an und fällt sofort mit 0
   Datensätzen auf — statt still die Produktion zu gefährden.
   - Produktion: `/home/ubuntu/databases/production.db` (PM2-Konfiguration)
   - Lokal: `server/database/development.db` (`server/.env.development`)
2. **`server/database.db` ist NICHT die Arbeitsdatenbank.** Unmigrierter Altbestand von
   April 2026 (ohne `user_work_periods`) — wer sie öffnet, sieht ein Schema von vor v3.0.
3. **WAL-Modus** (`journal_mode = WAL`). Beim Beenden setzt `shutdownDatabase()`
   (`server/src/database/connection.ts`) einen `wal_checkpoint(TRUNCATE)` und schließt die
   Verbindung; `server/src/server.ts` ruft das bei `SIGTERM`/`SIGINT` auf (seit 27.08.2026 —
   davor starb der Prozess ungefragt). Auch ohne das wäre ein `pm2 restart` im Regelfall
   folgenlos: die WAL bleibt liegen und wird beim nächsten Start eingelesen. Gefährlich ist
   nur eine vom Dateisystem **abgehängte** WAL — sie hängt dann allein am offenen
   Dateizeiger des Prozesses und verschwindet mit ihm. Ursache war beide Male ein
   Fremdzugriff auf die laufende Datei (siehe oben). Vor Neustart/Deployment prüfen (lesend):
   ```bash
   PID=$(pm2 jlist | jq -r '.[]|select(.name=="timetracking-server").pid')
   ls -l /proc/$PID/fd | grep production.db     # steht "(deleted)" dabei → STOPP
   ```
   Bei `(deleted)`: **nicht neu starten.** Erst in der App über „Datenbank Backups" →
   „Backup erstellen" einen Prüfpunkt erzwingen — `createBackup()`
   (`server/src/services/backupService.ts:39-41`) führt `wal_checkpoint(TRUNCATE)` auf der
   *eigenen* Verbindung des Servers aus und ist der einzige Weg, der eine abgehängte WAL
   noch rettet. Danach muss `stat -L -c%s /proc/$PID/fd/20` den Wert `0` liefern.
4. **Prepared Statements** — Pflicht (SQL-Injection).
5. **Soft Delete** (`deletedAt`) statt `DELETE`.

**21 Tabellen:** users, time_entries, absence_requests, vacation_balance,
vacation_transactions, overtime_balance, overtime_daily, overtime_weekly,
overtime_transactions, overtime_corrections, work_time_accounts, user_work_periods,
work_period_chain_guard, departments, projects, activities, holidays, notifications,
audit_log, password_change_log, migrations.

## 📊 Überstunden (geschäftskritisch)

```
Überstunden = Ist-Stunden − Soll-Stunden
```

1. **Referenz-Datum ist immer heute** — nie das Monatsende. Für Tage in der Zukunft wird
   nichts gerechnet und nichts geschrieben.
2. **Das Arbeitszeitmodell kommt seit v3.0 aus `user_work_periods`**, nicht aus den
   Stammdaten: `resolveWorkPeriodAt(userId, date)` bzw.
   `getDailyTargetHours(user, date, periods)` (`server/src/utils/workingDays.ts:176`). Ohne
   passende Periode wirft die Funktion `MissingWorkPeriodError` — **kein stiller Rückfall**
   auf `user.weeklyHours`/`user.workSchedule`. Eine Stundenumstellung gilt ab ihrem Stichtag
   und verschiebt keine Vergangenheit.
3. **Reihenfolge innerhalb einer Periode:** Feiertag (→ 0 h) überschreibt alles, dann
   `period.workSchedule`, sonst `period.weeklyHours / 5` (Wochenende 0 h).
4. **Krankheit, Urlaub und Sonderurlaub** zählen als gearbeitete Stunden (Gutschrift).
   **Unbezahlter Urlaub** reduziert das Soll und gibt **keine** Gutschrift.
5. **Live berechnen, nie cachen.**

**Zwei Rechenwege — Gefahrenquelle:** Backend `overtimeService.ts` → `overtime_balance`
(maßgeblich) und Frontend `reportService.ts` → API-Antwort. Bei Abweichungen immer beide
Seiten messen, nie nur eine.

**Zeitzonen:** `date.toISOString().split('T')[0]` verschiebt das Datum über UTC → falscher
Tag. Immer `formatDate(date, 'yyyy-MM-dd')`.

**Werkzeuge** (laufen in `server/`):
```bash
cd server
npm run validate:overtime:detailed -- --userId=X --month=YYYY-MM
npm run verify:balance-vs-journal      # kanonischer Weg gegen Journal
npm run verify:future-overtime         # Zeilen für Monate in der Zukunft
```
**Details:** `ARCHITECTURE.md` 6.3.9 / 6.3.10 / ADR-006, `PROJECT_SPEC.md` 6.3.5.

## 🖥️ Tauri

```typescript
// ❌ verliert Session-Cookies bei Cross-Origin
await fetch('http://localhost:3000/api/...', { credentials: 'include' });

// ✅
import { universalFetch } from '../lib/tauriHttpClient';
await universalFetch('http://localhost:3000/api/...', { credentials: 'include' });
```

⚠️ **Downloads aus der App: erst ab Desktop-Release > 1.9.0 brauchbar.** `tauriHttpClient.ts`
las den Antwortkörper früher mit `response.text()` und baute ihn mit `new Response(text)`
wieder auf — UTF-8 rein, UTF-8 raus. Binärdateien wurden dabei zerstört (+8–10 % Größe,
nicht mehr öffenbar): Datenbank-Sicherungen sowie Excel- und PDF-Exporte
(`desktop/src/api/exports.ts`). CSV war nie betroffen (`text/csv; charset=utf-8`). Behoben
am 27.08.2026 (Regressionstest `desktop/src/lib/tauriHttpClient.test.ts`), **aber die beim
Anwender installierte v1.9.0 trägt den Defekt noch.** Bis zum nächsten Release:
```bash
scp -i .ssh/oracle_server.key \
  ubuntu@129.159.8.19:/home/ubuntu/TimeTracking-Clean/backups/<datei>.db ~/Downloads/
```
Die Sicherungen auf dem Server sind intakt (geprüft 27.08.2026, `integrity_check: ok`) —
der Fehler lag nie in `createBackup()`.

## 🔒 TypeScript

Strict Mode. Kein `any` → `unknown` plus Type Guards. Null-Checks und Optional Chaining
überall.

---

# 🚀 Betrieb

## Umgebungsvariablen (Server)

```bash
TZ=Europe/Berlin        # ohne: Zeitberechnungen laufen in UTC → falsche Überstunden
NODE_ENV=production     # ohne: Zeitbuchungen in der Zukunft erlaubt (Dev-Modus)
SESSION_SECRET=<...>    # ohne: Server startet nicht
```

## Deployment

Ablauf: lokal entwickeln → `git push origin main` → Auto-Deploy auf Blue (Port 3000) über
`deploy-server.yml` (Type-Check → Security-Audit → SSH → DB-Backup → Build → PM2 →
Health-Check). Frische Produktionsdaten lokal: `npm run sync-dev-db`.

Der Green-Server (`/green`, `/sync-green`, Port 3001) ist optional für isolierte Tests,
nicht Teil des Standardwegs. `/promote-to-prod` und `/rollback-prod` sind Notfallwerkzeuge.
Migrationen müssen abwärtskompatibel sein.

**Nach jedem Deployment Pflicht — Anweisung des Anwenders vom 2026-02-08:**
```bash
gh run list --workflow="deploy-server.yml" --limit 1   # completed + success?
curl -s http://129.159.8.19:3000/api/health | jq       # nach 2–3 Min
# dann Funktionstest: Login, Zeitbuchung, Überstunden
```
Bei Fehlschlag: `gh run view <run-id>`, `pm2 logs timetracking-server`, Rollback erwägen.
Häufige Ursachen: TypeScript-Fehler (lokal `npx tsc --noEmit`), fehlgeschlagene Migration
(`manual-migration.yml`), PM2 nicht hochgekommen (502/503), CHECK-Constraints (500er).
Fehlgeschlagene Deployments in `CHANGELOG.md` unter `[Unreleased]` festhalten.

## Release (Desktop-App)

```bash
cd desktop && npx tsc --noEmit     # muss sauber sein
git status                         # muss sauber sein

# Version in DREI Dateien bumpen:
#   desktop/package.json · desktop/src-tauri/Cargo.toml · desktop/src-tauri/tauri.conf.json

git commit -m "chore: Bump version to v1.X.Y"
git push origin main
git tag v1.X.Y && git push origin v1.X.Y
gh release create v1.X.Y --title "..." --notes "..."
```
Nach 8–12 Min prüfen: `*.dmg`, `*.exe`, `*.msi`, `*.AppImage`, `*.deb` vorhanden — und
**`latest.json` enthält alle Plattformen** (sonst ist das Auto-Update kaputt). Danach
`CHANGELOG.md` und `PROJECT_STATUS.md` nachziehen.

## Rechnerwechsel (Mac ↔ Windows)

Sagt der Anwender „wechseln wir auf den PC", ist Windows gemeint. Übertragen wird
ausschließlich über Git: vorher `git add . && git commit && git push origin main`, nachher
`git pull origin main`. `npm install` nur, wenn sich eine `package.json` geändert hat
(`git log -1 --name-only | grep package.json`). Kein Rebuild nötig.

Erstaufsetzung: `git clone` → `npm install` in Root, `desktop/` und `server/` → Server und
Desktop je `npm run dev` (erster Tauri-Build 5–10 Min; braucht Rust, Visual Studio Build
Tools und WebView2). Platz freimachen: `/cleanup` (entfernt `desktop/src-tauri/target/`).

---

# 🚫 Verbote

**Datenbank**
- Produktions-DB aus einem eigenen Prozess öffnen — auch nicht lesend (siehe oben)
- Neue DB-Dateien anlegen → nur der Pfad aus `DATABASE_PATH`
- String-Konkatenation in SQL → Prepared Statements
- Hard Delete → Soft Delete
- `toISOString().split('T')[0]` → `formatDate(date, 'yyyy-MM-dd')`

**Überstunden**
- Eigene Berechnungslogik danebenbauen → `UnifiedOvertimeService` nutzen
- `user.weeklyHours` direkt lesen, wo ein Datum im Spiel ist → Periode auflösen
- Nur eine Seite prüfen → Backend und Frontend vergleichen

**Code**
- `any`, Duplikate, `console.log` in Produktion, Geschäftslogik in mehreren Services

**Workflow**
- Ohne Plan coden · direkt auf dem Produktionsserver arbeiten · ohne Test mergen

**Sicherheit**
- Passwörter im Klartext (bcrypt nutzen) · unvalidierte Eingaben · Secrets im Code

**Tauri**
- `fetch()` statt `universalFetch` · sensible Daten im `localStorage`

**Umgebung**
- `export VITE_API_URL=...` — Shell-Variablen überschreiben **alle** `.env`-Dateien.
  Stattdessen `/dev`, `/green`, `/promote-to-prod`.
  Prüfen: `printenv | grep VITE_API_URL` → falls gesetzt: `unset VITE_API_URL`

---

# ✅ Prüfliste vor dem Commit

```
☐ npx tsc --noEmit sauber          ☐ Dark-Mode-Klassen (dark:)
☐ kein `any`                       ☐ Responsive (sm:/md:/lg:)
☐ Fehlerbehandlung + Null-Checks   ☐ Lade- und Fehlerzustände
☐ Debug-Logs entfernt              ☐ Eingaben validiert (Backend + Frontend)
☐ keine Secrets im Code            ☐ manuell getestet, Konsole fehlerfrei
```

Beim Release zusätzlich: Version in 3 Dateien · Tag und GitHub-Release · Binaries aller
Plattformen · `latest.json` vollständig · CHANGELOG und PROJECT_STATUS aktualisiert.

---

# 🔗 Kurzreferenz

```bash
# Entwicklung
npm run dev                        # Server bzw. Desktop
/dev | /green | /sync-green | /promote-to-prod | /rollback-prod | /cleanup

# Prüfen
npx tsc --noEmit
cd server && npm run validate:overtime:detailed -- --userId=X --month=YYYY-MM
sqlite3 server/database/development.db "SELECT * FROM overtime_balance WHERE userId=X"

# Produktion
ssh ubuntu@129.159.8.19            # Key: .ssh/oracle_server.key
pm2 logs timetracking-server
curl http://129.159.8.19:3000/api/health
```

**Stack:** Tauri 2 + React 18 + TypeScript + TanStack Query + Zustand + Tailwind ·
Node 20 + Express + SQLite (WAL) · Oracle Cloud Frankfurt · GitHub Actions.

**Verzeichnisse:** `server/` (Backend), `desktop/` (Tauri-App),
`.github/workflows/` (CI/CD), `.planning/` (GSD-Pläne, Phasen, Debug-Protokolle).

**Funktionsumfang:** Mehrbenutzer-Zeiterfassung · Überstunden nach deutschem Arbeitsrecht ·
historisierte Arbeitszeitmodelle · Abwesenheiten (Urlaub, Krankheit, Überstundenausgleich) ·
WebSocket-Synchronisation · Auto-Update · Dark Mode · deutsche Feiertage · DATEV-Export.

**GitHub:** https://github.com/Maxwellbadger-1/TimeTracking-Clean
