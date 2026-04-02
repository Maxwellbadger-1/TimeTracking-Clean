# DB Setup Refactoring — 2-Tier Architecture

## What This Is

Umbau der chaotischen 3-Tier DB-Struktur (Dev→Green→Blue) zu einer sauberen 2-Tier-Architektur (Dev→Blue Production). Der Fokus liegt auf verlässlichen, schnellen Deployments ohne manuelle SSH-Debugging-Sessions. Die Production DB läuft bereits live auf Oracle Cloud und darf zu keinem Zeitpunkt verändert oder gelöscht werden.

## Core Value

Ein `git push main` deployt in unter 10 Minuten — ohne manuelle Eingriffe, ohne Überraschungen.

## Requirements

### Validated

- ✓ Production Server (Blue) läuft auf Oracle Cloud 129.159.8.19:3000 — existing
- ✓ GitHub Actions Auto-Deploy via `deploy-server.yml` bei Push auf `main` — existing
- ✓ SSH-Zugang zum Server mit `.ssh/oracle_server.key` — existing
- ✓ PM2 managed Node.js Server mit `timetracking-server` — existing
- ✓ SQLite WAL Mode für Multi-User-Betrieb — existing
- ✓ Green Server (Staging) auf Port 3001 — existing (broken, on-demand only)

### Active

- [ ] Zentralisiertes DB-Verzeichnis `/home/ubuntu/databases/` auf dem Server
- [ ] Production DB als Master: `/home/ubuntu/databases/production.db` (COPY, nie Move!)
- [ ] Blue Server zeigt via Symlink auf zentrales production.db
- [ ] PM2 Ecosystem File mit explizitem `DATABASE_PATH` ENV
- [ ] `npm run sync-dev-db` Script — zieht Schema+Daten von Prod lokal (Windows-kompatibel)
- [ ] Lokale Dev DB heißt `server/database.db` (konfigurierbar über DATABASE_PATH)
- [ ] `deploy-server.yml` prüft DB-Pfad nach Deployment
- [ ] Green Server on-demand: startet/stoppt manuell für kritische Änderungen

### Out of Scope

- Staging DB als permanente dritte Ebene — Hauptproblem war der Sync-Aufwand, nicht das Fehlen von Staging
- Datenmigration oder Schema-Änderungen — das ist ein separates Projekt
- Neue DB-Engine (PostgreSQL etc.) — SQLite reicht für diese Nutzerzahl
- Anonymisierung der Dev-Daten — kein Compliance-Requirement vorhanden

## Context

**Ausgangsproblem:**
- 2h Debugging pro Deployment wegen PORT-Konflikten, fehlenden DBs, xattr-Korruption
- Green Server crashed permanent (PM2 lud .env nicht → PORT-Variable ignoriert)
- Unklar welche DB die echten Produktionsdaten enthält (`database-shared.db` vs `database-production.db`)
- Mehrere lokale DB-Kopien auf macOS durch Extended Attributes korrupt

**Technische Umgebung:**
- Entwicklung jetzt auf **Windows** (C:\Users\maxfe\Maxflow Software\Projekte\Stiftung TimeTracker\TimeTracking-Clean)
- Production: Oracle Cloud Frankfurt, Ubuntu, PM2, Node.js 20
- SSH Key: `.ssh/oracle_server.key` im Projekt-Root
- Repo: https://github.com/Maxwellbadger-1/TimeTracking-Clean

**Kritische Regel:**
Production DB (`/home/ubuntu/database-shared.db` oder aktueller Pfad) darf NICHT verändert, verschoben oder gelöscht werden. Nur kopieren.

## Constraints

- **Safety**: Production DB ist live — kein direktes Modifizieren, kein Bewegen, keine Ausfallzeit außer beim PM2-Restart (~30s)
- **Windows-Kompatibel**: Sync-Script muss auf Windows (Git Bash / WSL) laufen, nicht nur macOS
- **No New Dependencies**: Keine neuen npm-Pakete für das Sync-Script — nur bash + sqlite3 + scp
- **Rollback Ready**: Jede Phase muss einen dokumentierten Rollback-Weg haben

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 2-Tier statt 3-Tier | Green Server war der Hauptverursacher der 2h-Debugging-Sessions | — Pending |
| Green Server bleibt optional (nicht abschalten) | Emergency-Fallback für riskante DB-Migrationen | — Pending |
| Symlink statt DATABASE_PATH-Änderung als primäre Lösung | Symlinks funktionieren transparent für Node.js ohne Config-Änderungen | — Pending |
| Copy, never Move | Production DB muss jederzeit rollback-fähig bleiben | ✓ Festgelegt |
| `server/database.db` als lokaler Dev-Name | Konsistent mit bestehender .gitignore-Konfiguration | — Pending |

## Evolution

Dieses Dokument entwickelt sich bei Phase-Übergängen und Milestone-Abschlüssen.

**Nach jeder Phase** (via `/gsd:transition`):
1. Requirements invalidiert? → Out of Scope mit Grund
2. Requirements validiert? → Validated mit Phase-Referenz
3. Neue Requirements entstanden? → Active
4. Entscheidungen zu loggen? → Key Decisions

---
*Last updated: 2026-04-02 after initialization*
