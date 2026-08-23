# Ist-Stand — Produktion VOR dem Deployment (aus der Sicherung production.PRE-14-08_20260823_111541.db, VACUUM INTO der laufenden Produktion um 11:15:41 Ortszeit)

**Datenbank:** `C:\Users\maxfe\Maxflow Software\Projekte\Stiftung TimeTracker\TimeTracking-Clean\server\database\backups\production.PRE-14-08_20260823_111541.db` (1286144 Bytes)
**Erhoben:** 2026-08-23T09:20:23.349Z
**Erhebungsweise:** ausschliesslich readonly, rohe Tabellenwerte (kein Rechenweg).

**SHA-256 des Nutzdatenkerns** (ohne `label`/`generatedAt`/`databasePath`/`databaseSizeBytes`):

```
2edff31a9fd6d73162aa7db4516c0a2359b659b8c0b90e3f69a851c7042ac07d
```

**SHA-256 der gesamten JSON-Datei:** `a9f503c2f771c874b2b4daf2eb0150f7797fb7c15d0fd7489ab30c5d35cadce6`

## Tabellenzählwerte

| Tabelle | Zeilen |
|---|---|
| `users` | 20 |
| `time_entries` | 712 |
| `absence_requests` | 43 |
| `overtime_transactions` | 2671 |
| `overtime_balance` | 144 |
| `vacation_balance` | 40 |
| `vacation_transactions` | 59 |
| `user_work_periods` | *Tabelle nicht vorhanden* |

`integrity_check`: `[{"integrity_check":"ok"}]` — `foreign_key_check`: `[]`

Angewendete Migrationen (10): `004_drop_overtime_unique_index`, `005_add_balance_tracking_columns`, `001_backfill_overtime_transactions`, `002_extend_transaction_types`, `003_add_pending_to_vacation_balance`, `20260208_add_position_column`, `20260208_add_time_entry_type.sql`, `20260208_add_position_column.sql`, `006_add_time_entry_transaction_type`, `007_create_vacation_transactions`

## Stundenstand je Nutzer

`Soll`/`Ist`/`Saldo` sind die Summen über alle in `overtime_balance` erfassten Monate.

| ID | Name | gelöscht | Wochenstunden | Wochenplan | Monate | Soll (h) | Ist (h) | Saldo (h) | Buchungen | Buchungssumme (h) | Zeiteinträge | Zeiteintragssumme (h) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | System Administrator | nein | 0 | — | 10 | 0 | 0 | 0 | 103 | 0 | 0 | — |
| 2 | Karin Jochem | nein | 5 | `{"monday":0,"tuesday":0,"wednesday":0,"thursday":5,"friday":0,"saturday":0,"sunday":0}` | 8 | 159 | 165 | 6 | 183 | 50 | 46 | 165 |
| 3 | Christine Glas | nein | 8 | `{"monday":4,"tuesday":4,"wednesday":0,"thursday":0,"friday":0,"saturday":0,"sunday":0}` | 9 | 290.4 | 243.97 | -46.43 | 240 | -16.08 | 53 | 208.77 |
| 15 | Test Test | ja (2026-02-28 14:01:48) | 0 | `{"monday":8,"tuesday":0,"wednesday":8,"thursday":0,"friday":4,"saturday":0,"sunday":0}` | 3 | 252 | 168.54 | -83.46 | 87 | -91.96 | 102 | 861.04 |
| 16 | Benedikt Jochem | nein | 30 | — | 8 | 954 | 1058 | 104 | 230 | -11.75 | 134 | 824 |
| 17 | Carmen Rothemund | nein | 12 | `{"monday":4,"tuesday":4,"wednesday":0,"thursday":4,"friday":0,"saturday":0,"sunday":0}` | 9 | 428.8 | 382.74 | -46.06 | 254 | -35.6 | 87 | 326.74 |
| 18 | Silvia Lachner | nein | 20 | `{"monday":0,"tuesday":0,"wednesday":8,"thursday":8,"friday":4,"saturday":0,"sunday":0}` | 8 | 636 | 631.5 | -4.5 | 201 | 0.25 | 88 | 591.5 |
| 19 | Ute Stock | nein | 2.5 | `{"monday":0,"tuesday":0,"wednesday":0,"thursday":2.5,"friday":0,"saturday":0,"sunday":0}` | 8 | 79.5 | 89.91 | 10.41 | 221 | 5.33 | 45 | 89.91 |
| 20 | Hans Schauer | nein | 7 | — | 5 | 135.8 | 120 | -15.8 | 215 | -87.9 | 27 | 120 |
| 21 | Maria Schauer | nein | 5 | — | 5 | 97 | 83 | -14 | 205 | -59.5 | 21 | 83 |
| 22 | Beate Walleiter | nein | 0 | — | 8 | 0 | 47.5 | 47.5 | 119 | 44.5 | 25 | 47.5 |
| 23 | Sepp Wasensteiner | nein | 0 | — | 8 | 0 | 0 | 0 | 0 | — | 0 | — |
| 24 | Kathrin Leeb | nein | 0 | — | 8 | 0 | 249.5 | 249.5 | 175 | 197 | 48 | 249.5 |
| 25 | Heidemarie Tretter | nein | 8 | — | 8 | 254.4 | 18.25 | -236.15 | 110 | -105.75 | 5 | 18.25 |
| 26 | Test Test | ja (2026-02-27 15:50:29) | 0 | — | 1 | 0 | 0 | 0 | 0 | — | 0 | — |
| 27 | Reinhold Merl | nein | 0 | — | 7 | 0 | 0 | 0 | 0 | — | 0 | — |
| 28 | Test Test | ja (2026-08-21 19:08:00) | 12 | `{"monday":4,"tuesday":4,"wednesday":0,"thursday":4,"friday":0,"saturday":0,"sunday":0}` | 6 | 284 | 91.5 | -192.5 | 93 | -148.5 | 0 | — |
| 29 | Christina Wasensteiner | nein | 0 | — | 8 | 0 | 85.78 | 85.78 | 205 | 63.28 | 31 | 85.78 |
| 30 | Test Urlaub | ja (2026-08-21 19:06:59) | 40 | — | 9 | 1448 | 0 | -1448 | 30 | -176 | 0 | — |
| 31 | UA T | ja (2026-08-21 19:07:45) | 40 | — | 8 | 1272 | 0 | -1272 | 0 | — | 0 | — |

## Urlaubsstand je Nutzer und Jahr

| ID | Name | gelöscht | Jahr | Anspruch | Übertrag | genommen | Rest | Buchungen | Buchungssumme (Tage) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | System Administrator | nein | 2025 | 30 | 0 | 0 | 30 | 1 | 30 |
| 1 | System Administrator | nein | 2026 | 30 | 5 | 0 | 35 | 2 | 35 |
| 2 | Karin Jochem | nein | 2025 | 0 | 0 | 0 | 0 | 2 | 0 |
| 2 | Karin Jochem | nein | 2026 | 7 | 0 | 0 | 7 | 1 | 7 |
| 3 | Christine Glas | nein | 2025 | 0 | 0 | 0 | 0 | 2 | 0 |
| 3 | Christine Glas | nein | 2026 | 13 | 0 | 13 | 0 | 5 | 0 |
| 15 | Test Test | ja | 2025 | 10 | 0 | 5 | 5 | 2 | 5 |
| 15 | Test Test | ja | 2026 | 10 | 0 | 6 | 4 | 6 | 4 |
| 16 | Benedikt Jochem | nein | 2025 | 0 | 0 | 0 | 0 | 0 | 0 |
| 16 | Benedikt Jochem | nein | 2026 | 28 | 0 | 13 | 15 | 8 | 15 |
| 17 | Carmen Rothemund | nein | 2026 | 20 | 0 | 15 | 5 | 11 | 5 |
| 17 | Carmen Rothemund | nein | 2027 | 20 | 0 | 0 | 20 | 1 | 20 |
| 18 | Silvia Lachner | nein | 2026 | 19 | 0 | 9 | 10 | 4 | 10 |
| 18 | Silvia Lachner | nein | 2027 | 19 | 0 | 0 | 19 | 1 | 19 |
| 19 | Ute Stock | nein | 2026 | 6 | 0 | 0 | 6 | 1 | 6 |
| 19 | Ute Stock | nein | 2027 | 6 | 0 | 0 | 6 | 1 | 6 |
| 20 | Hans Schauer | nein | 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| 20 | Hans Schauer | nein | 2027 | 0 | 0 | 0 | 0 | 0 | 0 |
| 21 | Maria Schauer | nein | 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| 21 | Maria Schauer | nein | 2027 | 0 | 0 | 0 | 0 | 0 | 0 |
| 22 | Beate Walleiter | nein | 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| 22 | Beate Walleiter | nein | 2027 | 0 | 0 | 0 | 0 | 0 | 0 |
| 23 | Sepp Wasensteiner | nein | 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| 23 | Sepp Wasensteiner | nein | 2027 | 0 | 0 | 0 | 0 | 0 | 0 |
| 24 | Kathrin Leeb | nein | 2026 | 8 | 0 | 0 | 8 | 1 | 8 |
| 24 | Kathrin Leeb | nein | 2027 | 8 | 0 | 0 | 8 | 1 | 8 |
| 25 | Heidemarie Tretter | nein | 2026 | 12 | 0 | 0 | 12 | 1 | 12 |
| 25 | Heidemarie Tretter | nein | 2027 | 12 | 0 | 0 | 12 | 1 | 12 |
| 26 | Test Test | ja | 2026 | 25.5 | 0 | 0 | 25.5 | 1 | 25.5 |
| 26 | Test Test | ja | 2027 | 30 | 0 | 0 | 30 | 1 | 30 |
| 27 | Reinhold Merl | nein | 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| 27 | Reinhold Merl | nein | 2027 | 0 | 0 | 0 | 0 | 0 | 0 |
| 28 | Test Test | ja | 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| 28 | Test Test | ja | 2027 | 0 | 0 | 0 | 0 | 0 | 0 |
| 29 | Christina Wasensteiner | nein | 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| 29 | Christina Wasensteiner | nein | 2027 | 0 | 0 | 0 | 0 | 0 | 0 |
| 30 | Test Urlaub | ja | 2026 | 15 | 0 | 0 | 15 | 4 | 15 |
| 30 | Test Urlaub | ja | 2027 | 20 | 0 | 0 | 20 | 1 | 20 |
| 31 | UA T | ja | 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| 31 | UA T | ja | 2027 | 0 | 0 | 0 | 0 | 0 | 0 |

## Soft-gelöschte Nutzer — gesondert ausgewiesen

Der kanonische Rechenweg (`unifiedOvertimeService`) löst diese Nutzer nicht auf und liefert für sie `"User <id> not found"`. Ihre Werte stehen deshalb hier direkt aus den Tabellen — sie sind Teil des Ist-Stands und dürfen nicht verloren gehen. Anzahl: **5**.

| ID | Name | gelöscht am | Wochenstunden | Monate | Saldo (h) | Buchungen | Zeiteinträge | Urlaubsjahre |
|---|---|---|---|---|---|---|---|---|
| 15 | Test Test | 2026-02-28 14:01:48 | 0 | 3 | -83.46 | 87 | 102 | 2025, 2026 |
| 26 | Test Test | 2026-02-27 15:50:29 | 0 | 1 | 0 | 0 | 0 | 2026, 2027 |
| 28 | Test Test | 2026-08-21 19:08:00 | 12 | 6 | -192.5 | 93 | 0 | 2026, 2027 |
| 30 | Test Urlaub | 2026-08-21 19:06:59 | 40 | 9 | -1448 | 30 | 0 | 2026, 2027 |
| 31 | UA T | 2026-08-21 19:07:45 | 40 | 8 | -1272 | 0 | 0 | 2026, 2027 |

## Arbeitszeitperioden (`user_work_periods`)

Tabelle in dieser Datenbank **nicht vorhanden** (Migration 008 noch nicht angewendet).

