# 14-ROLLBACK-RUNBOOK — Rückweg für den Produktionslauf (Plan 14-08/14-09)

**Erstellt:** 2026-08-23 (Plan 14-06)
**Zweck (D8):** Ein ungetesteter Rollback-Plan ist kein Rollback-Plan. Dieser Abschnitt
dokumentiert eine **tatsächlich lokal durchgeführte** Erprobung: Sicherung ziehen, Schaden
herbeiführen, zurückspielen, Ergebnis maschinenlesbar mit dem Ausgangsstand vergleichen.
Der Ablauf für den echten Produktionsernstfall folgt in einem späteren Abschnitt dieses
Dokuments (Task 2).

---

## Erprobung des Rückwegs (Plan 14-06)

**Zielobjekt:** `server/database/14-generalprobe.db` — die migrierte Arbeitskopie aus Plan
14-04, die in Plan 14-05 bereits einen echten Modellwechsel (Generalprobenfall userId 2,
Karin Jochem) erhalten hat. Es wird also gegen einen Stand mit echter Schreibwirkung geprobt,
nicht gegen eine leere Datenbank.

**Kein Befehl dieses Abschnitts berührt `production.db` oder eine SSH-Verbindung** — alle
Operationen laufen ausschließlich gegen lokale Dateien unter `server/database/`.

### Schritt 1 — Kennzahlen des Ausgangsstands erheben

```
$ cd server && node -e "... readonly gegen ./database/14-generalprobe.db ..."
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
migrations count: 18
overtime_transactions: {"c":2682,"s":-343.48}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":21}
time_entries: {"c":712}
absence_requests: {"c":43}
--- Generalprobenfall (userId 2) ---
overtime_transactions userId=2: {"c":194,"s":79.2}
user_work_periods userId=2: {"c":2}
```

**Saldo des Generalprobenfalls (userId 2)**, erhoben über dasselbe Werkzeug wie in Plan 14-05
(`snapshot:balances`, Lesepfad `unifiedOvertimeService.calculatePeriodOvertime()`):

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npm run snapshot:balances -- \
    --user=2 --asOf=2026-08-21 --json=../.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-RB-BASELINE.json
...
$ node -e "... liest 14-SNAPSHOT-RB-BASELINE.json, druckt overtimePeriod.overtime für userId 2 ..."
userId 2 overtimePeriod.overtime 29.599999999999923
```

Saldo Ausgangsstand: **29,6 h** (identisch mit dem in `14-VORHER-NACHHER.md` protokollierten
Saldo „nach dem Lauf" aus Plan 14-05 — konsistent, da `14-generalprobe.db` seit Plan 14-05
unverändert war).

### Schritt 2 — Sicherung ziehen nach Produktionsmuster (`VACUUM INTO`, nicht `cp`)

Zielverzeichnis `server/database/backups/` existierte noch nicht und wurde angelegt
(`mkdir -p`). Namensmuster lokal nachgebildet aus dem Produktionsmuster
`production.PRE-<plan>_<YYYYMMDD>_<HHMMSS>.db` (06-07-SUMMARY.md):

```
$ cd server && mkdir -p database/backups
$ node -e "
const D = require('better-sqlite3');
const src = new D('./database/14-generalprobe.db', { readonly: true });
src.exec(\"VACUUM INTO './database/backups/generalprobe.PRE-14-06_20260823_024004.db'\");
src.close();
"
VACUUM INTO abgeschlossen
```

**Ergebnisdatei:** `server/database/backups/generalprobe.PRE-14-06_20260823_024004.db`,
1331200 Bytes.

**Bewusst `VACUUM INTO`, nicht `cp`** — genau der Unterschied, an dem der Predeploy-Backup-
Befehl im Deploy-Workflow schwach ist (siehe Abschnitt „Sicherung vor dem Push" weiter unten
und `.planning/debug/db-stabilisierung-20260818.md`: ein `cp` auf eine WAL-aktive Datei kann
die jüngsten, noch nicht in die Haupt-Datei geschriebenen Transaktionen verlieren).

**Laufzeit gemessen** (separate Zeitmessung mit einer wegwerfbaren Prüfdatei, identische
Quelle, identisches Ergebnis — Beleg für die Erwartungswerte weiter unten):

```
$ node -e "... VACUUM INTO in eine Wegwerf-Datei, Date.now()-Differenz ..."
Dauer VACUUM INTO (Sicherung): 15 ms
Dateigroesse: 1331200 Bytes
Timing-Probe-Datei geloescht
```

### Schritt 3 — Sicherung prüfen, bevor auf sie gebaut wird

```
$ cd server && node -e "... prüft server/database/backups/generalprobe.PRE-14-06_20260823_024004.db ..."
Dateigroesse: 1331200 Bytes (> 0: true )
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
migrations count: 18
overtime_transactions: {"c":2682,"s":-343.48}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":21}
time_entries: {"c":712}
absence_requests: {"c":43}
```

| Kennzahl | Schritt 1 (Ausgangsstand) | Sicherungsdatei (Schritt 3) | Differenz |
|---|---|---|---|
| `integrity_check` | ok | ok | — |
| `foreign_key_check` | leer | leer | — |
| Migrationsanzahl | 18 | 18 | 0 |
| `overtime_transactions` COUNT | 2682 | 2682 | **0** |
| `overtime_transactions` SUM(hours) | −343.48 | −343.48 | **0** |
| `overtime_balance` COUNT | 144 | 144 | **0** |
| `overtime_balance` SUM(targetHours) | 6267.3 | 6267.3 | **0** |
| `overtime_balance` SUM(actualHours) | 3435.19 | 3435.19 | **0** |
| `users` COUNT | 20 | 20 | **0** |
| `user_work_periods` COUNT | 21 | 21 | **0** |
| `time_entries` COUNT | 712 | 712 | **0** |
| `absence_requests` COUNT | 43 | 43 | **0** |

Eine ungeprüfte Sicherung ist keine Sicherung — alle Zahlen stimmen, bevor auf die Sicherung
gebaut wird.

### Schritt 4 — Schaden herbeiführen (damit der Rückweg etwas zu tun hat)

Gelöscht in `14-generalprobe.db`: alle `overtime_transactions`-Zeilen des Generalprobenfalls
(userId 2) und seine jüngste Arbeitszeitperiode (`id=21`, `validFrom=2026-06-01` — genau die
Periode, die der Modellwechsel aus Plan 14-05 angelegt hat).

```
$ cd server && node -e "... db.transaction(): DELETE overtime_transactions WHERE userId=2; DELETE user_work_periods WHERE id=21 ..."
=== VOR dem Schaden ===
overtime_transactions userId=2: {"c":194}
user_work_periods userId=2: {"c":2}
overtime_transactions gesamt: {"c":2682}
user_work_periods gesamt: {"c":21}
juengste Periode userId=2: {"id":21,"validFrom":"2026-06-01"}
Geloeschte overtime_transactions-Zeilen: 194
Geloeschte user_work_periods-Zeile (juengste, id=21): 1
=== NACH dem Schaden ===
overtime_transactions userId=2: {"c":0}
user_work_periods userId=2: {"c":1}
overtime_transactions gesamt: {"c":2488}
user_work_periods gesamt: {"c":20}
```

Vollständiger Kennzahlensatz nach dem Schaden:

```
$ cd server && node -e "... readonly gegen die beschädigte 14-generalprobe.db ..."
integrity_check: [{"integrity_check":"ok"}]
overtime_transactions: {"c":2488,"s":-422.68}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":20}
```

| Kennzahl | Schritt 1 (Ausgangsstand) | nach dem Schaden (Schritt 4) | Differenz |
|---|---|---|---|
| `overtime_transactions` COUNT | 2682 | 2488 | **−194** (messbare Abweichung) |
| `overtime_transactions` SUM(hours) | −343.48 | −422.68 | **−79.2** |
| `user_work_periods` COUNT | 21 | 20 | **−1** (messbare Abweichung) |
| `overtime_transactions` userId=2 COUNT | 194 | 0 | **−194** |
| `user_work_periods` userId=2 COUNT | 2 | 1 | **−1** |
| `overtime_balance` COUNT/Summen | unverändert | unverändert | 0 (Tabelle nicht direkt gelöscht — nur Journal/Perioden) |
| `integrity_check` | ok | ok | — (Löschung ist syntaktisch gültiges SQL, kein Strukturschaden) |

**Nachweis erbracht:** Sowohl `COUNT(*) FROM overtime_transactions` (2682 → 2488, −194) als
auch `COUNT(*) FROM user_work_periods` (21 → 20, −1) sind gegenüber Schritt 1 nachweislich
kleiner geworden — der Rückweg hat jetzt etwas zu tun.

### Schritt 5 — Zurückspielen auf eine Kopie (nicht über die beschädigte Datei schreiben)

Der Ernstfall auf dem Server arbeitet ebenfalls mit einer neuen Datei, die anschließend an
die Stelle der alten tritt (siehe Abschnitt „Rückweg A" weiter unten) — dieselbe Logik wird
hier erprobt:

```
$ cd server && node -e "
const D = require('better-sqlite3');
const backup = new D('./database/backups/generalprobe.PRE-14-06_20260823_024004.db', { readonly: true });
backup.exec(\"VACUUM INTO './database/14-rollback-probe.db'\");
backup.close();
"
Dauer VACUUM INTO (Ruecksspielen auf Kopie): 13 ms
Dateigroesse 14-rollback-probe.db: 1331200 Bytes
```

### Schritt 6 — Vergleichen: `14-rollback-probe.db` gegen Schritt 1

```
$ cd server && node -e "... readonly gegen ./database/14-rollback-probe.db ..."
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
migrations count: 18
overtime_transactions: {"c":2682,"s":-343.48}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":21}
time_entries: {"c":712}
absence_requests: {"c":43}
overtime_transactions userId=2: {"c":194,"s":79.2}
user_work_periods userId=2: {"c":2}
```

**Saldo-Vergleich des Generalprobenfalls** (`snapshot:balances --user=2` gegen die
zurückgespielte Kopie):

```
$ cd server && DATABASE_PATH=./database/14-rollback-probe.db npm run snapshot:balances -- \
    --user=2 --asOf=2026-08-21 --json=../.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-RB-RESTORED.json
...
userId 2 overtimePeriod.overtime (nach Rueckspielen) 29.599999999999923
```

| Kennzahl | Schritt 1 (Ausgangsstand) | Schritt 6 (`14-rollback-probe.db`) | Differenz |
|---|---|---|---|
| `integrity_check` | ok | ok | — |
| `foreign_key_check` | leer | leer | — |
| Migrationsanzahl | 18 | 18 | **0** |
| `overtime_transactions` COUNT | 2682 | 2682 | **0** |
| `overtime_transactions` SUM(hours) | −343.48 | −343.48 | **0** |
| `overtime_balance` COUNT | 144 | 144 | **0** |
| `overtime_balance` SUM(targetHours) | 6267.3 | 6267.3 | **0** |
| `overtime_balance` SUM(actualHours) | 3435.19 | 3435.19 | **0** |
| `overtime_balance` SUM(carryoverFromPreviousYear) | 0 | 0 | **0** |
| `users` COUNT | 20 | 20 | **0** |
| `user_work_periods` COUNT | 21 | 21 | **0** |
| `time_entries` COUNT | 712 | 712 | **0** |
| `absence_requests` COUNT | 43 | 43 | **0** |
| `overtime_transactions` userId=2 COUNT | 194 | 194 | **0** |
| `overtime_transactions` userId=2 SUM(hours) | 79.2 | 79.2 | **0** |
| `user_work_periods` userId=2 COUNT | 2 | 2 | **0** |
| **Saldo Generalprobenfall (userId 2)** | 29.599999999999923 h | 29.599999999999923 h | **0** |

**Jede Zahl identisch, alle Differenzen exakt 0.** Der Rückweg funktioniert: `integrity_check`
= `ok`, `foreign_key_check` leer, Migrationsliste identisch, Saldo des Generalprobenfalls
wieder auf dem Wert von Schritt 1.

### Schritt 7 — Zeitmessung (Erwartungswerte für den Ernstfall)

| Operation | Dauer | Dateigröße |
|---|---|---|
| Sicherung (`VACUUM INTO`, Schritt 2) | 15 ms | 1.331.200 Bytes (≈ 1,3 MB) |
| Zurückspielen (`VACUUM INTO`, Schritt 5) | 13 ms | 1.331.200 Bytes (≈ 1,3 MB) |

**Einordnung für den Ernstfall:** Diese Werte gelten für die ≈1,3-MB-Kopie des Generalprobe-
Bestands (20 Nutzer, 712 Zeiteinträge, 2682 Journalzeilen). Die echte Produktionsdatenbank ist
größenordnungsmäßig vergleichbar (production.db lag zuletzt bei ≈1,3 MB, siehe
`14-MIGRATIONSSTAND.md`), so dass diese Millisekundenwerte als grobe Erwartung taugen: Ein
Sicherungs- oder Rückspiellauf, der mehrere Sekunden statt Millisekunden braucht, ist ein
Hinweis auf einen hängenden Lauf oder eine ungewöhnlich große Datenbank — dann nachsehen,
nicht einfach abwarten.

### Schritt 8 — Aufräumen: `14-generalprobe.db` wiederherstellen

Die beschädigte `14-generalprobe.db` (samt WAL/SHM) wurde entfernt und aus der geprüften
Sicherung neu aufgebaut — **nicht** aus `14-rollback-probe.db` zurückkopiert, sondern erneut
per `VACUUM INTO` direkt aus der Sicherungsdatei, damit der Wiederherstellungsweg identisch
zum Ernstfall bleibt:

```
$ cd server && rm -f database/14-generalprobe.db database/14-generalprobe.db-wal database/14-generalprobe.db-shm
$ node -e "
const D = require('better-sqlite3');
const backup = new D('./database/backups/generalprobe.PRE-14-06_20260823_024004.db', { readonly: true });
backup.exec(\"VACUUM INTO './database/14-generalprobe.db'\");
backup.close();
"
14-generalprobe.db aus der Sicherung wiederhergestellt
```

**Kennzahlensatz nach der Wiederherstellung:**

```
$ cd server && node -e "... readonly gegen die wiederhergestellte 14-generalprobe.db ..."
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
migrations count: 18
overtime_transactions: {"c":2682,"s":-343.48}
overtime_balance: {"c":144,"st":6267.3,"sa":3435.19,"sc":0}
users: {"c":20}
user_work_periods: {"c":21}
time_entries: {"c":712}
absence_requests: {"c":43}
overtime_transactions userId=2: {"c":194,"s":79.2}
user_work_periods userId=2: {"c":2}
```

Identisch mit Schritt 1 in jeder Zahl (siehe Vergleichstabelle Schritt 6 — dieselben Werte).

**Kettenprüfung gegen die wiederhergestellte Kopie:**

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npm run check:period-chains
==============================================================================
BESTANDS-CHECK ARBEITSZEITPERIODEN (checkAllPeriodChains)
==============================================================================
Datenbank: ./database/14-generalprobe.db

✅ Keine Befunde — jeder nicht gelöschte Nutzer hat eine lückenlose
   Periodenkette ab seinem Eintrittsdatum.
EXIT_CODE=0
```

**Temporäre Prüfkopie aufgeräumt:**

```
$ cd server && rm -f database/14-rollback-probe.db database/14-rollback-probe.db-wal database/14-rollback-probe.db-shm
14-rollback-probe.db entfernt
```

**Kontrolle: unbeteiligte Datenbanken unangetastet**

```
$ node -e "... readonly gegen 14-produktionskopie.db ..."
integrity_check: [{"integrity_check":"ok"}]
overtime_transactions: {"c":2671,"s":-372.68}
users: {"c":20}
```
Identisch mit dem in `14-04-SUMMARY.md` protokollierten Stand (`14-produktionskopie.db`
wurde von diesem Plan nicht geöffnet außer readonly zur Kontrolle).

```
$ node -e "... readonly gegen development.db ..."
COUNT users: {"c":30}
COUNT user_work_periods: {"c":30}
```
Identisch mit dem in `14-MIGRATIONSSTAND.md`/`14-05-SUMMARY.md` protokollierten Stand.
`development.db` wurde ausschließlich readonly geöffnet.

```
$ tasklist //FI "PID eq 39860"   → node.exe, PID 39860, weiterhin aktiv (Dev-Server)
$ tasklist //FI "PID eq 26124"   → node.exe, PID 26124, weiterhin aktiv (Tauri-Prozess)
```
Beide vom Anwender gestarteten Prozesse liefen während der gesamten Erprobung unverändert
weiter, wurden nicht beendet.

---

### Ergebnis der Erprobung

**Der Rückweg ist erprobt, nicht nur beschrieben:** Eine Sicherung wurde nach dem
Produktionsnamensmuster gezogen (`VACUUM INTO`, nicht `cp`), geprüft, ein echter Schaden an
einem Datensatz mit Schreibwirkung herbeigeführt (194 Journalzeilen + 1 Arbeitszeitperiode
gelöscht), auf eine neue Datei zurückgespielt und mit einem maschinenlesbaren
Kennzahlenvergleich (13 Kennzahlen inkl. Saldo) gegen den Ausgangsstand verglichen — jede
Differenz exakt `0`. Die Arbeitskopie `14-generalprobe.db` wurde anschließend auf denselben
Ausgangsstand zurückgeführt (ebenfalls kennzahlengenau belegt), damit Folgepläne wieder auf
dem Stand nach Plan 14-05 aufsetzen. `14-produktionskopie.db`, `development.db` und die
laufenden lokalen Prozesse blieben während der gesamten Erprobung unangetastet.
