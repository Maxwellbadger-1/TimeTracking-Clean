# Vergleich der Ist-Stände

**VORHER:** Produktion VOR dem Deployment (aus der Sicherung production.PRE-14-08_20260823_111541.db, VACUUM INTO der laufenden Produktion um 11:15:41 Ortszeit)
  `../.planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VOR-DEPLOYMENT.json` — erhoben 2026-08-23T09:20:23.349Z

**NACHHER:** Produktion NACH Deployment und Migration 008-015 (VACUUM INTO der laufenden Produktion um 11:56:27 Ortszeit, WAL-vollstaendig)
  `../.planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-NACH-MIGRATION.json` — erhoben 2026-08-23T09:56:38.605Z

**Geprüfte Nutzer:** 20 vorher / 20 nachher (namentlich, soft-gelöschte eingeschlossen)

## Ergebnis: **99 BLOCKER**

| Bereich | Gegenstand | vorher | nachher |
|---|---|---|---|
| Stunden | Nutzer 2 (Karin Jochem) · overtime_balance.sumTargetHours | `159` | `155` |
| Stunden | Nutzer 2 (Karin Jochem) · overtime_balance.sumOvertime | `6` | `10` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-03 · targetHours | `22` | `20` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-03 · overtime | `-19.5` | `-17.5` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-04 · targetHours | `20` | `25` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-04 · overtime | `1.5` | `-3.5` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-05 · targetHours | `18` | `15` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-05 · overtime | `9.5` | `12.5` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-06 · targetHours | `21` | `15` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-06 · overtime | `39` | `45` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-07 · targetHours | `23` | `25` |
| Stunden | Nutzer 2 (Karin Jochem) · 2026-07 · overtime | `-4.5` | `-6.5` |
| Stunden | Nutzer 3 (Christine Glas) · overtime_balance.sumTargetHours | `290.4` | `288` |
| Stunden | Nutzer 3 (Christine Glas) · overtime_balance.sumActualHours | `243.97` | `272.77` |
| Stunden | Nutzer 3 (Christine Glas) · overtime_balance.sumOvertime | `-46.43` | `-15.23` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-01 · targetHours | `32` | `28` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-01 · actualHours | `17.18` | `29.18` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-01 · overtime | `-14.82` | `1.18` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-02 · actualHours | `28.28` | `33.08` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-02 · overtime | `-3.72` | `1.08` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-03 · targetHours | `35.2` | `40` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-03 · overtime | `4.97` | `0.17` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-04 · targetHours | `32` | `28` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-04 · overtime | `-3.41` | `0.59` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-05 · targetHours | `28.8` | `28` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-05 · actualHours | `19.15` | `28.75` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-05 · overtime | `-9.65` | `0.75` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-06 · targetHours | `33.6` | `40` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-06 · overtime | `7.73` | `1.33` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-07 · targetHours | `36.8` | `32` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-07 · overtime | `-5.64` | `-0.84` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-08 · actualHours | `22.11` | `24.51` |
| Stunden | Nutzer 3 (Christine Glas) · 2026-08 · overtime | `-1.89` | `0.51` |
| Stunden | Nutzer 16 (Benedikt Jochem) · overtime_balance.sumActualHours | `1058` | `974` |
| Stunden | Nutzer 16 (Benedikt Jochem) · overtime_balance.sumOvertime | `104` | `20` |
| Stunden | Nutzer 16 (Benedikt Jochem) · 2026-04 · actualHours | `176.25` | `146.25` |
| Stunden | Nutzer 16 (Benedikt Jochem) · 2026-04 · overtime | `56.25` | `26.25` |
| Stunden | Nutzer 16 (Benedikt Jochem) · 2026-05 · actualHours | `141.5` | `87.5` |
| Stunden | Nutzer 16 (Benedikt Jochem) · 2026-05 · overtime | `33.5` | `-20.5` |
| Stunden | Nutzer 17 (Carmen Rothemund) · overtime_balance.sumTargetHours | `428.8` | `420` |
| Stunden | Nutzer 17 (Carmen Rothemund) · overtime_balance.sumActualHours | `382.74` | `374.74` |
| Stunden | Nutzer 17 (Carmen Rothemund) · overtime_balance.sumOvertime | `-46.06` | `-45.26` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-01 · targetHours | `48` | `44` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-01 · actualHours | `51.49` | `53.09` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-01 · overtime | `3.49` | `9.09` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-02 · actualHours | `45.22` | `46.82` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-02 · overtime | `-2.78` | `-1.18` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-03 · targetHours | `52.8` | `56` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-03 · overtime | `4.78` | `1.58` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-04 · targetHours | `43.2` | `40` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-04 · actualHours | `31.37` | `32.17` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-04 · overtime | `-11.83` | `-7.83` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-05 · targetHours | `43.2` | `40` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-05 · actualHours | `40.69` | `39.09` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-05 · overtime | `-2.51` | `-0.91` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-06 · targetHours | `50.4` | `52` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-06 · actualHours | `51.26` | `49.66` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-06 · overtime | `0.86` | `-2.34` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-07 · targetHours | `55.2` | `52` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-07 · actualHours | `51.98` | `53.58` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-07 · overtime | `-3.22` | `1.58` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-08 · actualHours | `45.15` | `34.75` |
| Stunden | Nutzer 17 (Carmen Rothemund) · 2026-08 · overtime | `9.15` | `-1.25` |
| Stunden | Nutzer 18 (Silvia Lachner) · overtime_balance.sumTargetHours | `636` | `640` |
| Stunden | Nutzer 18 (Silvia Lachner) · overtime_balance.sumActualHours | `631.5` | `651.5` |
| Stunden | Nutzer 18 (Silvia Lachner) · overtime_balance.sumOvertime | `-4.5` | `11.5` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-01 · targetHours | `80` | `84` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-01 · actualHours | `93.75` | `89.75` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-01 · overtime | `13.75` | `5.75` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-03 · targetHours | `88` | `80` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-03 · actualHours | `67.25` | `83.25` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-03 · overtime | `-20.75` | `3.25` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-04 · targetHours | `80` | `92` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-04 · overtime | `10.75` | `-1.25` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-06 · targetHours | `84` | `72` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-06 · actualHours | `64.75` | `72.75` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-06 · overtime | `-19.25` | `0.75` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-07 · targetHours | `92` | `100` |
| Stunden | Nutzer 18 (Silvia Lachner) · 2026-07 · overtime | `20.5` | `12.5` |
| Stunden | Nutzer 19 (Ute Stock) · overtime_balance.sumTargetHours | `79.5` | `77.5` |
| Stunden | Nutzer 19 (Ute Stock) · overtime_balance.sumOvertime | `10.41` | `12.41` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-03 · targetHours | `11` | `10` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-03 · overtime | `6.92` | `7.92` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-04 · targetHours | `10` | `12.5` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-04 · overtime | `1` | `-1.5` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-05 · targetHours | `9` | `7.5` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-05 · overtime | `5.75` | `7.25` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-06 · targetHours | `10.5` | `7.5` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-06 · overtime | `1.5` | `4.5` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-07 · targetHours | `11.5` | `12.5` |
| Stunden | Nutzer 19 (Ute Stock) · 2026-07 · overtime | `-6.25` | `-7.25` |
| Stunden | Nutzer 24 (Kathrin Leeb) · overtime_balance.sumActualHours | `249.5` | `201.5` |
| Stunden | Nutzer 24 (Kathrin Leeb) · overtime_balance.sumOvertime | `249.5` | `201.5` |
| Stunden | Nutzer 24 (Kathrin Leeb) · 2026-03 · actualHours | `41` | `-7` |
| Stunden | Nutzer 24 (Kathrin Leeb) · 2026-03 · overtime | `41` | `-7` |
| Stunden | Nutzer 29 (Christina Wasensteiner) · overtime_balance.sumActualHours | `85.78` | `65.28` |
| Stunden | Nutzer 29 (Christina Wasensteiner) · overtime_balance.sumOvertime | `85.78` | `65.28` |
| Stunden | Nutzer 29 (Christina Wasensteiner) · 2026-03 · actualHours | `9.66` | `-10.84` |
| Stunden | Nutzer 29 (Christina Wasensteiner) · 2026-03 · overtime | `9.66` | `-10.84` |

## Ausdrücklich erwartete Strukturänderungen (9)

| Bereich | Gegenstand | vorher | nachher |
|---|---|---|---|
| Tabellenzählwerte | user_work_periods (Migration 009, REQ-21) | `Tabelle nicht vorhanden` | `20 (= COUNT(*) FROM users = 20)` |
| Migrationen | neu angewendet: 008_create_user_work_periods | `nicht angewendet` | `angewendet` |
| Migrationen | neu angewendet: 009_backfill_user_work_periods | `nicht angewendet` | `angewendet` |
| Migrationen | neu angewendet: 010_fix_user_work_periods_delete_guard | `nicht angewendet` | `angewendet` |
| Migrationen | neu angewendet: 011_add_model_change_transaction_type | `nicht angewendet` | `angewendet` |
| Migrationen | neu angewendet: 012_fix_reference_type_check_constraint | `nicht angewendet` | `angewendet` |
| Migrationen | neu angewendet: 013_soft_delete_user_work_periods | `nicht angewendet` | `angewendet` |
| Migrationen | neu angewendet: 014_add_reversal_of_to_overtime_transactions | `nicht angewendet` | `angewendet` |
| Migrationen | neu angewendet: 015_unique_reversal_of_index | `nicht angewendet` | `angewendet` |

