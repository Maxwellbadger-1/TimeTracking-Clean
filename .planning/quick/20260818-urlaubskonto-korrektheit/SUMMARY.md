---
quick_id: 260818-v3q
slug: urlaubskonto-korrektheit
date: 2026-08-18
status: complete
---

# Zusammenfassung — Urlaubskonto: Korrektheit wiederhergestellt

Alle neun Tasks abgeschlossen. Code deployed, Produktionsdaten korrigiert, verifiziert.

## Commits

| Commit | Inhalt |
|---|---|
| `7b8b1fc` | Gegenbuchung beim Ablehnen genehmigter Anträge + Transaktionsklammer |
| `d305e2b` | `\|\| 30` → `??` an allen Stellen, Dialog-Vorbelegung aus Stammdaten |
| `29c227a` | Urlaubsanspruch nicht mehr rückwirkend für Vorjahre überschreiben |
| `2ac20cc` | Einmalige Überstundenbuchungen überleben den Monats-Rebuild |
| `6ebbac4` | CHANGELOG, Root-Cause-Analysen, Plan |

## Qualitätsgates

- `npx tsc --noEmit` — Server **und** Desktop fehlerfrei
- Tests: 92 grün, 2 rot — **beide bereits vor den Änderungen rot**
  (`unifiedOvertimeService.test.ts`, „User hired on 1st of month": `targetHours` 40 statt 10).
  Gegen den ungeänderten Stand verifiziert, keine Regression. Nicht Teil dieses Tasks.
- Deployment `32183051255`: success in 5m49s, inkl. DB-Pfad-Verifikation
- Health Check: HTTP 200 in 67 ms

Der Deploy war zugleich der erste echte Serverneustart nach der DB-Stabilisierung —
die Datenbank öffnete fehlerfrei, die Reparatur hält.

## Datenkorrektur Produktion

Trockenlauf mit unabhängiger Nachrechnung der Sollwerte, danach in einer DB-Transaktion:

| Mitarbeiter | Änderung | Verbleibend |
|---|---|---|
| Carmen Rothemund | `taken` 21 → 15 | −1 → **5** |
| Benedikt Jochem | `taken` 23 → 13 | 5 → **15** |
| Hans Schauer, Maria Schauer, Beate Walleiter, Sepp + Christina Wasensteiner | `entitlement` 2026+2027 30 → 0 | **0** |
| Reinhold Merl | `entitlement` 2026 25,5 → 0, 2027 30 → 0 | **0** |

**Gesamt Verbleibend 2026: 257,5 → 98 Tage**

Verifikation nach der Korrektur:
- Anspruch = Stammdaten bei allen 16 aktiven Mitarbeitern
- Soll/Ist-Abgleich `taken` gegen genehmigte Anträge: **keine Abweichung**
- `integrity_check: ok`, `foreign_key_check: []`
- Datensatzzahlen unverändert (18 / 42 / 36 / 709 / 2.634 / 1.057)

## Backups

| Zeitpunkt | Ort |
|---|---|
| Vor DB-Reparatur (roh) | `~/databases/backups/RAW_20260818_181946/` |
| Vor DB-Reparatur (verifiziert) | lokal `DB-Backups/production.CLEAN_20260818.db` |
| Server gestoppt | `~/databases/backups/STOPPED_20260818_182909/` |
| Nach DB-Reparatur | lokal `DB-Backups/production.POST-REPAIR_20260818.db` |
| Vor Datenkorrektur | `~/databases/backups/production.PRE-DATENKORREKTUR_20260818.db` |
| Nach Datenkorrektur | `~/databases/backups/production.POST-DATENKORREKTUR_20260818.db` |

## Bewusst nicht erledigt

- **Urlaubs-Journal** (`vacation_transactions`) → eigener Milestone. Solange `taken` ein
  gepflegter Zähler statt einer Summe von Buchungen ist, bleibt diese Fehlerklasse möglich.
- **Überstunden-Ausgleich erreicht den Saldo nicht** — `getOvertimeBalance()` summiert das
  Monatsaggregat, nicht die Transaktionen. Defekt des Dual Calculation Systems, zu riskant
  für diesen Durchgang.
- Zwei vorbestehend rote Tests in `unifiedOvertimeService.test.ts`
- Jahresübergreifende Anträge (aktuell 0 Fälle), `pending`-Spalte / Migration 003,
  Wiederherstellung gelöschter Zeiteinträge bei Ablehnung
- Aus der DB-Stabilisierung offen: Staging-Sync (`Permission denied`), Cron-Reaktivierung
  mit `DATABASE_PATH`, Symlink `server/database.db` auflösen, Quarantäne aufräumen
