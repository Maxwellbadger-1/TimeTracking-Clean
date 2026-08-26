# Ist-Stand — Produktion VOR Auslieferung (Code 41c9c09), 2026-08-26

**Datenbank:** `/home/ubuntu/databases/production.db` (1740800 Bytes)
**Erhoben:** 2026-08-26T04:38:16.937Z
**Erhebungsweise:** ausschliesslich readonly, rohe Tabellenwerte (kein Rechenweg).

**SHA-256 des Nutzdatenkerns** (ohne `label`/`generatedAt`/`databasePath`/`databaseSizeBytes`):

```
516cadd67c79b51a4fa62e2f7bc1d86e517a98fe7858a8d2ed6e4a6d68893d33
```

**SHA-256 der gesamten JSON-Datei:** `f895b7dc1832c22a05cd6b744980f69c8923672eed8240c2b3fe3d6301144f6b`

## Tabellenzählwerte

| Tabelle | Zeilen |
|---|---|
| `users` | 20 |
| `time_entries` | 718 |
| `absence_requests` | 43 |
| `overtime_transactions` | 2690 |
| `overtime_balance` | 144 |
| `vacation_balance` | 40 |
| `vacation_transactions` | 59 |
| `user_work_periods` | 20 |

`integrity_check`: `[{"integrity_check":"ok"}]` — `foreign_key_check`: `[]`

Angewendete Migrationen (18): `004_drop_overtime_unique_index`, `005_add_balance_tracking_columns`, `001_backfill_overtime_transactions`, `002_extend_transaction_types`, `003_add_pending_to_vacation_balance`, `20260208_add_position_column`, `20260208_add_time_entry_type.sql`, `20260208_add_position_column.sql`, `006_add_time_entry_transaction_type`, `007_create_vacation_transactions`, `008_create_user_work_periods`, `009_backfill_user_work_periods`, `010_fix_user_work_periods_delete_guard`, `011_add_model_change_transaction_type`, `012_fix_reference_type_check_constraint`, `013_soft_delete_user_work_periods`, `014_add_reversal_of_to_overtime_transactions`, `015_unique_reversal_of_index`

## Stundenstand je Nutzer

`Soll`/`Ist`/`Saldo` sind die Summen über alle in `overtime_balance` erfassten Monate.

| ID | Name | gelöscht | Wochenstunden | Wochenplan | Monate | Soll (h) | Ist (h) | Saldo (h) | Buchungen | Buchungssumme (h) | Zeiteinträge | Zeiteintragssumme (h) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | System Administrator | nein | 0 | — | 10 | 0 | 0 | 0 | 103 | 0 | 0 | — |
| 2 | Karin Jochem | nein | 5 | `{"monday":0,"tuesday":0,"wednesday":0,"thursday":5,"friday":0,"saturday":0,"sunday":0}` | 8 | 155 | 165 | 10 | 183 | 50 | 46 | 165 |
| 3 | Christine Glas | nein | 8 | `{"monday":4,"tuesday":4,"wednesday":0,"thursday":0,"friday":0,"saturday":0,"sunday":0}` | 9 | 296 | 281.19 | -14.81 | 247 | -15.66 | 55 | 217.19 |
| 15 | Test Test | ja (2026-02-28 14:01:48) | 0 | `{"monday":8,"tuesday":0,"wednesday":8,"thursday":0,"friday":4,"saturday":0,"sunday":0}` | 3 | 252 | 168.54 | -83.46 | 87 | -91.96 | 102 | 861.04 |
| 16 | Benedikt Jochem | nein | 30 | — | 8 | 966 | 974 | 8 | 230 | -11.75 | 134 | 824 |
| 17 | Carmen Rothemund | nein | 12 | `{"monday":4,"tuesday":4,"wednesday":0,"thursday":4,"friday":0,"saturday":0,"sunday":0}` | 9 | 428 | 385.24 | -42.76 | 266 | -37.1 | 91 | 333.24 |
| 18 | Silvia Lachner | nein | 20 | `{"monday":0,"tuesday":0,"wednesday":8,"thursday":8,"friday":4,"saturday":0,"sunday":0}` | 8 | 640 | 651.5 | 11.5 | 201 | 0.25 | 88 | 591.5 |
| 19 | Ute Stock | nein | 2.5 | `{"monday":0,"tuesday":0,"wednesday":0,"thursday":2.5,"friday":0,"saturday":0,"sunday":0}` | 8 | 77.5 | 89.91 | 12.41 | 221 | 5.33 | 45 | 89.91 |
| 20 | Hans Schauer | nein | 7 | — | 5 | 138.6 | 120 | -18.6 | 215 | -87.9 | 27 | 120 |
| 21 | Maria Schauer | nein | 5 | — | 5 | 99 | 83 | -16 | 205 | -59.5 | 21 | 83 |
| 22 | Beate Walleiter | nein | 0 | — | 8 | 0 | 47.5 | 47.5 | 119 | 44.5 | 25 | 47.5 |
| 23 | Sepp Wasensteiner | nein | 0 | — | 8 | 0 | 0 | 0 | 0 | — | 0 | — |
| 24 | Kathrin Leeb | nein | 0 | — | 8 | 0 | 201.5 | 201.5 | 175 | 197 | 48 | 249.5 |
| 25 | Heidemarie Tretter | nein | 8 | — | 8 | 257.6 | 18.25 | -239.35 | 110 | -105.75 | 5 | 18.25 |
| 26 | Test Test | ja (2026-02-27 15:50:29) | 0 | — | 1 | 0 | 0 | 0 | 0 | — | 0 | — |
| 27 | Reinhold Merl | nein | 0 | — | 7 | 0 | 0 | 0 | 0 | — | 0 | — |
| 28 | Test Test | ja (2026-08-21 19:08:00) | 12 | `{"monday":4,"tuesday":4,"wednesday":0,"thursday":4,"friday":0,"saturday":0,"sunday":0}` | 6 | 284 | 91.5 | -192.5 | 93 | -148.5 | 0 | — |
| 29 | Christina Wasensteiner | nein | 0 | — | 8 | 0 | 65.28 | 65.28 | 205 | 63.28 | 31 | 85.78 |
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

| ID | Name | Perioden | Zeitraeume |
|---|---|---|---|
| 1 | System Administrator | 1 | 2025-11-13→offen (0h) |
| 2 | Karin Jochem | 1 | 2026-01-01→offen (5h) |
| 3 | Christine Glas | 1 | 2026-01-01→offen (8h) |
| 15 | Test Test | 1 | 2026-01-01→offen (0h) |
| 16 | Benedikt Jochem | 1 | 2026-01-01→offen (30h) |
| 17 | Carmen Rothemund | 1 | 2026-01-01→offen (12h) |
| 18 | Silvia Lachner | 1 | 2026-01-01→offen (20h) |
| 19 | Ute Stock | 1 | 2026-01-01→offen (2.5h) |
| 20 | Hans Schauer | 1 | 2026-04-01→offen (7h) |
| 21 | Maria Schauer | 1 | 2026-04-01→offen (5h) |
| 22 | Beate Walleiter | 1 | 2026-01-01→offen (0h) |
| 23 | Sepp Wasensteiner | 1 | 2026-01-01→offen (0h) |
| 24 | Kathrin Leeb | 1 | 2026-01-01→offen (0h) |
| 25 | Heidemarie Tretter | 1 | 2026-01-01→offen (8h) |
| 26 | Test Test | 1 | 2026-02-26→offen (0h) |
| 27 | Reinhold Merl | 1 | 2026-02-27→offen (0h) |
| 28 | Test Test | 1 | 2026-03-01→offen (12h) |
| 29 | Christina Wasensteiner | 1 | 2026-01-01→offen (0h) |
| 30 | Test Urlaub | 1 | 2026-01-01→offen (40h) |
| 31 | UA T | 1 | 2026-01-01→offen (40h) |

