# TimeTracking System — Entwicklungsleitlinien

**Stand:** 2026-09-02 · Milestone v3.0 ausgeliefert · Desktop v1.9.1 · Server `e4866a4`
(Phase 9.1 Betriebs-Härtung abgeschlossen, D-17 belegt)

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
   Dateizeiger des Prozesses und verschwindet mit ihm.

   **Die Ursache war der Nachtlauf, nicht nur manuelle Fremdzugriffe** (gemessen 28.08.2026):
   Der Cron um 03:00 startete `scripts/fix-overtime.ts` als **eigenen** `npx tsx`-Prozess auf
   `production.db` und rief am Ende `db.close()` auf. SQLite räumt WAL und SHM beim Schließen
   auf, sobald der schließende Prozess kurz die exklusive Sperre bekommt — nachts um 03:00 war
   der Server idle, also bekam er sie. Danach schrieb der Serverprozess in eine gelöste Datei.

   **Endstand (02.09.2026, Plan 09.1-08 — belegt):** Der externe Nachtlauf ist mit dem
   Server-Deployment `e4866a4` (29.08.2026) entfallen; die Neuberechnung läuft seit diesem
   Zeitpunkt im Serverprozess selbst um 03:15 Uhr Europe/Berlin über dieselbe Verbindung wie
   der übrige Betrieb — es gibt keinen externen `npx tsx`-Prozess mehr, der sich die
   exklusive Sperre holen und die WAL abhängen könnte. Über zwei vollständige Nächte unter
   derselben PID (4911, seit dem Deployment vom 31.08.2026 ohne Neustart im Lauf — Nacht zum
   01.09. und Nacht zum 02.09.2026) trug kein Dateizeiger `(deleted)`, die Verzeichnis-mtime
   von `databases/` zeigte keinen 03:00-Stempel mehr, und der In-Prozess-Nachtlauf feuerte
   beide Nächte fehlerfrei (15/15 verarbeitet). Zusätzlich war die WAL nach drei voneinander
   unabhängigen Prozessstarts seit der Auslieferung (Deployment 29.08., Kalt-Reboot 30.08.,
   Deployment 31.08.) jeweils regulär verknüpft. Strukturell beseitigt: der externe Cron ist
   entfernt (D-03), `setup-cron.sh` gelöscht, sodass er sich nicht reinstallieren kann
   (WR-16), Migration und Schemaprüfung laufen im Deploy hinter `pm2 stop` statt neben dem
   laufenden Server (CR-03). Vollständiger Nachweis mit Rohausgaben und Urteil:
   `.planning/phases/09.1-journal-backfill-und-betriebs-h-rtung/09.1-NACHWEIS-BEOBACHTUNG.md`.
   Grenzen der Beobachtung (siehe dort Abschnitt 6): für die Nächte zum 30.08./31.08. liegt
   nur die Positivmessung vor, nicht die beiden D-17-Messgrößen selbst; die Messungen der
   Nächte zum 01.09./02.09. erfolgten am Folgetag, nicht unmittelbar nach dem Nachtlauf. Die
   Rettungsanweisung unten gilt unverändert weiter, sollte doch wieder `(deleted)` auftreten.

   Vor Neustart/Deployment prüfen (lesend):
   ```bash
   PID=$(pm2 jlist | jq -r '.[]|select(.name=="timetracking-server").pid')
   ls -l /proc/$PID/fd | grep production.db     # steht "(deleted)" dabei → STOPP
   ```
   Bei `(deleted)`: **nicht neu starten.** Erst in der App über „Datenbank Backups" →
   „Backup erstellen" einen Prüfpunkt erzwingen — `createBackup()`
   (`server/src/services/backupService.ts:123`) führt `wal_checkpoint(TRUNCATE)` auf der
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

✅ **Downloads aus der App: ab v1.9.1 in Ordnung** (Release 28.08.2026). `tauriHttpClient.ts`
las den Antwortkörper früher mit `response.text()` und baute ihn mit `new Response(text)`
wieder auf — UTF-8 rein, UTF-8 raus. Binärdateien wurden dabei zerstört (+8–10 % Größe,
nicht mehr öffenbar). **Betroffen war ausschließlich der Backup-Download** — die einzige
echte Binärdatei der App. Excel- und PDF-Exporte gibt es im Projekt nicht; `exports.ts`
kennt nur `exportDATEV()` und `exportHistoricalCSV()`, und beide Routen senden
`text/csv; charset=utf-8` (`server/src/routes/exports.ts:107,273`) — UTF-8-Text übersteht
den Umweg über `text()` verlustfrei. Der Körper wird jetzt immer als `arrayBuffer()` gelesen
und unverändert weitergereicht; der Content-Type entscheidet nur noch über die
Protokollierung. Regressionstest: `desktop/src/lib/tauriHttpClient.test.ts` (6 Fälle).

Wer noch eine Fassung ≤ 1.9.0 installiert hat, holt Sicherungen weiterhin so:
```bash
scp -i .ssh/oracle_server.key \
  ubuntu@129.159.8.19:/home/ubuntu/TimeTracking-Clean/backups/<datei>.db ~/Downloads/
```
Die Sicherungen auf dem Server waren zu keiner Zeit betroffen (geprüft 27.08.2026,
`integrity_check: ok`) — der Fehler lag nie in `createBackup()`.

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
