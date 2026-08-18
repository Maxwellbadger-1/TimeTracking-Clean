# DB-Stabilisierung Produktion — 18.08.2026

**Status:** ABGESCHLOSSEN ✅
**Anlass:** Beim Backup-Versuch für den Urlaubs-Bugfix schlug `db.backup()` mit
`database disk image is malformed` fehl.
**Ergebnis:** `integrity_check: ok`, Server läuft, kein Datensatz verloren.

---

## Was kaputt war

### 1. Zwei verwaiste WAL-Dateien auf dieselbe Datenbank

`~/TimeTracking-Clean/server/database.db` ist ein **Symlink** auf `~/databases/production.db`.
SQLite legt die WAL-Datei neben dem *geöffneten* Pfad an, nicht neben dem Symlink-Ziel.
Dadurch existierten zwei WAL-Dateien für eine Datenbank:

| Datei | Größe | Datum | Blockierte |
|---|---|---|---|
| `~/databases/production.db-wal` | 107 KB | 06.05.2026 | Zugriff über den direkten Pfad |
| `~/TimeTracking-Clean/server/database.db-wal` | 4,0 MB | 09.02.2026 | Zugriff über den Symlink-Pfad |

Beide passten nicht mehr zum aktuellen Datenstand. Jeder **neue** Verbindungsaufbau
scheiterte an `SQLITE_CORRUPT`.

**Der Server lief nur weiter, weil sein Prozess (PID 2598550, seit April) eigene,
inzwischen gelöschte Dateihandles offen hielt.** Simulation auf einer Kopie:

- Serverstart mit verwaister WAL → `database disk image is malformed`, jede Abfrage scheitert
- Serverstart ohne verwaiste WAL → alles intakt, 42 Anträge, alle Daten vorhanden

Ein PM2-Restart, Reboot, Deployment oder Stromausfall hätte das System lahmgelegt.

### 2. Grundursache: zwei Prozesse, zwei Pfade, eine Datenbank

PM2 startet den Server mit explizitem `DATABASE_PATH=/home/ubuntu/databases/production.db`
(`ecosystem.production.config.js:38`).

Der nächtliche Cronjob (`0 3 * * * … npx tsx scripts/fix-overtime.ts`) setzt diese Variable
**nicht**. `fix-overtime.ts` fällt auf `databaseConfig.path` zurück und öffnet dieselbe
Datenbank über den **Symlink-Pfad**. Belegt im Log:
`"path":"/home/ubuntu/TimeTracking-Clean/server/database.db"`.

Zwei Prozesse mit unterschiedlichen WAL- und SHM-Dateien auf derselben Datenbank →
SQLites Sperrmechanismus (der im SHM liegt) greift nicht → Korruption.

### 3. Zwei defekte Indizes

`idx_overtime_month` und `idx_overtime_user` meldeten `wrong # of entries`.
Reine Index-Inkonsistenz, keine Nutzdaten betroffen — per `REINDEX` behoben.

### 4. Nebenbefunde

- **`fix-overtime.ts` läuft seit ~10.02.2026 nicht mehr** — 107 gescheiterte Nächte im Log.
  Was das Skript nachts korrigieren sollte, wurde seither nicht korrigiert.
- **Wöchentlicher Staging-Sync scheitert seit Monaten:** `sync-prod-to-staging.sh:
  Permission denied` (fehlendes Execute-Bit). Cron: `0 2 * * 0`.
- **Automatische Backups funktionieren** (Entwarnung): Der serverinterne Scheduler schreibt
  täglich um 00:00 nach `~/TimeTracking-Clean/backups/` — lückenlos bis 18.08.2026.
  Das leere `~/databases/backups/` hatte einen Fehlalarm ausgelöst.

---

## Durchgeführte Maßnahmen

| # | Schritt | Ergebnis |
|---|---|---|
| 1 | Rohbackup (byteweise, ohne SQLite-Zugriff) | `~/databases/backups/RAW_20260818_181946/` |
| 2 | Verifiziertes Backup + lokaler Download | `DB-Backups/production.CLEAN_20260818.db` |
| 3 | Serverstart-Szenarien auf Kopie simuliert | Ursache belegt |
| 4 | `pm2 stop timetracking-server` | MD5 vor/nach identisch — kein Datenverlust |
| 5 | Backup im gestoppten Zustand | `~/databases/backups/STOPPED_20260818_182909/` |
| 6 | Verwaiste WAL/SHM **verschoben** (nicht gelöscht) | `~/databases/quarantine_20260818_182909/` |
| 7 | `REINDEX` | `integrity_check: ok`, `foreign_key_check: []` |
| 8 | Datensatzvergleich vorher/nachher | **identisch** |
| 9 | `pm2 start` + API-Test | HTTP 200 in 8 ms |
| 10 | Cronjob entschärft (auskommentiert, gesichert) | `~/crontab.backup.20260818_183112.txt` |
| 11 | Post-Repair-Backup + lokaler Download | `DB-Backups/production.POST-REPAIR_20260818.db` |

**Datenbestand unverändert:** 18 Nutzer · 42 Abwesenheitsanträge · 36 Urlaubskonten ·
709 Zeiteinträge · 2.634 Überstundenbuchungen · 1.057 Audit-Einträge.

---

## Offen

1. **Cronjob wieder aktivieren** — erst mit `DATABASE_PATH=/home/ubuntu/databases/production.db`
   im Cron-Eintrag, damit beide Prozesse denselben Pfad nutzen. Vorher klären, ob
   `fix-overtime.ts` überhaupt noch gebraucht wird: Es lief seit Februar nicht und würde
   beim ersten Lauf Überstundendaten von sechs Monaten neu berechnen.
2. **Symlink auflösen** — `server/database.db` sollte nicht auf die Produktions-DB zeigen.
   Solange er existiert, kann jedes Skript ohne gesetztes `DATABASE_PATH` das Problem
   erneut auslösen.
3. **Staging-Sync reparieren** — Execute-Bit auf `sync-prod-to-staging.sh` setzen.
4. **Quarantäne aufräumen** — `~/databases/quarantine_20260818_182909/` nach einer
   Bewährungszeit löschen (enthält nur die verwaisten WAL/SHM-Dateien).

Siehe [urlaubstage-bei-ablehnung-verloren.md](urlaubstage-bei-ablehnung-verloren.md)
für den eigentlichen Anlass dieser Untersuchung.
