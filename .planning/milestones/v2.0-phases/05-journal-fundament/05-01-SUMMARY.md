---
phase: 05-journal-fundament
plan: 01
status: complete
completed: 2026-08-19
files_modified:
  - server/src/database/migrations/007_create_vacation_transactions.ts
  - server/src/database/schema.ts
---

# 05-01 — Journal-Tabelle angelegt

Migration 007 erstellt `vacation_transactions`, die Definition steht identisch in `schema.ts`
für Neuinstallationen. **Kein Verhalten geändert** — es wird noch nichts gebucht.

## Tabelle

13 Spalten, zwei Indizes. Sechs Buchungstypen als CHECK-Constraint:
`entitlement`, `carryover`, `vacation_taken`, `vacation_reverted`, `correction`, `expiry`.

Vorzeichen: positiv = Gutschrift auf den verfügbaren Urlaub, negativ = Verbrauch.
Genehmigung und Storno sind bewusst zwei Typen statt eines mit Vorzeichenwechsel — das
Fehlen der Gegenbuchung war die Ursache, im Journal soll ein Storno als eigener Vorgang
sichtbar sein.

Indizes nach den tatsächlichen Lesepfaden: `(userId, year)` für den Kontoauszug,
`(referenceType, referenceId)` für die Buchungen zu einem Antrag.

## Verifikation gegen eine Kopie der Produktionsdatenbank

Ausgeführt gegen `production.POST-DATENKORREKTUR_20260818.db`:

| Prüfung | Ergebnis |
|---|---|
| Tabelle mit allen 13 Spalten | ✅ |
| Beide Indizes angelegt | ✅ |
| Bestehende Daten unverändert | ✅ 18 / 42 / 36 / 709 / 2.634 / 1.057 |
| `integrity_check` | ✅ `ok` |
| Zweiter Lauf (Idempotenz) | ✅ übersprungen, nichts verändert |
| CHECK-Constraint weist unbekannten Typ ab | ✅ |
| Gültige Buchung schreiben und lesen | ✅ |

## Selbstverifikation — der eigentliche Gewinn

Die Migration prüft ihr eigenes Ergebnis und wirft bei Unvollständigkeit, damit der
`migrationRunner` sie **nicht** als angewendet markiert.

Grund ist Migration 003: Sie steht in der Produktionsdatenbank als angewendet, ihre Spalte
`pending` existiert dort aber nicht. Eine als erledigt gebuchte Migration läuft nie wieder
an — der Fehler wurde dadurch dauerhaft.

Getestet, indem exakt dieses Szenario nachgestellt wurde: eine bereits vorhandene,
unvollständige Tabelle, an der `CREATE TABLE IF NOT EXISTS` wirkungslos abprallt.

**Abweichung vom Plan:** Beim ersten Testlauf warf zwar die Migration, aber der Index-Aufbau
zuerst — mit `no such column: year`. Die Spaltenprüfung wurde deshalb **vor** die
Index-Erstellung gezogen. Jetzt lautet die Meldung:

> Migration 007 unvollständig: fehlende Spalten in vacation_transactions: year, date, type,
> days, … Vermutlich existierte bereits eine abweichende Tabelle. Migration wird NICHT als
> angewendet markiert.

Für jemanden, der das nachts im Log findet, ist das der Unterschied zwischen Rätselraten
und sofortiger Diagnose.

## Qualitätsgates

- `npx tsc --noEmit` fehlerfrei
- Produktionsdatenbank nicht angefasst — sämtliche Tests liefen auf Kopien
