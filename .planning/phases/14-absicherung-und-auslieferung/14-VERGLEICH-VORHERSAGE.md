# Vergleich der Ist-Stände

**VORHER:** Produktion VOR dem Deployment (aus der Sicherung production.PRE-14-08_20260823_111541.db, VACUUM INTO der laufenden Produktion um 11:15:41 Ortszeit)
  `../.planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VOR-DEPLOYMENT.json` — erhoben 2026-08-23T09:20:23.349Z

**NACHHER:** Vorhersage: dieselbe Sicherung, lokal mit 008-015 migriert (vor dem Push erhoben)
  `../.planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VORHERSAGE-NACH-MIGRATION.json` — erhoben 2026-08-23T09:20:23.525Z

**Geprüfte Nutzer:** 20 vorher / 20 nachher (namentlich, soft-gelöschte eingeschlossen)

## Ergebnis: **KEINE unerwartete Differenz**

Kein Stundenwert, kein Urlaubswert, kein Stammdatenfeld und kein Zählwert hat sich
bewegt. Nichts ist verschwunden, nichts ist hinzugekommen.

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

