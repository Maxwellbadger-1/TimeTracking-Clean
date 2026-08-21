---
phase: 07-saldo-aus-buchungen-backfill
status: complete
completed: 2026-08-19
deployed: true
---

# Phase 7 — Saldo aus Buchungen + Backfill

Alle drei Pläne umgesetzt, deployed, Backfill auf Produktion ausgeführt.

## Ergebnis in Produktion

| | |
|---|---|
| Journal-Buchungen | **52** |
| Gesamt Verbleibend 2026 | **98 → 98** (unverändert) |
| Carmen Rothemund | Rest **5** |
| Benedikt Jochem | Rest **15** |
| Konsistenzprüfer | **0 Fehler**, 0 Warnungen, 15 Hinweise |
| `integrity_check` | ok |

Carmens Kontoauszug liest sich jetzt als Geschichte — 22.05. genehmigt −6 (Saldo 10),
18.08. storniert +6 (Saldo 10), Endstand 5. Genau der Vorgang, der drei Monate unsichtbar war.

## Was gebaut wurde

**07-01 Konsistenzprüfer** — bewusst vor dem Backfill, als Werkzeug zu dessen Verifikation.
Vier Prüfungen; die dritte (Storno ohne Gegenbuchung) ist der ursprüngliche Fehler.
Admin-Endpunkt `GET /api/vacation-balances/consistency`. 9 Tests.

**07-02 Backfill** — rekonstruiert die Historie aus `absence_requests` und `audit_log`.
Bricht ab, wenn für ein Konto die geplante Summe vom Ist-Wert abweicht. Genehmigungsbuchungen
tragen das Genehmigungsdatum statt des Urlaubsbeginns, sonst stünde ein Storno im Auszug vor
der Genehmigung. 9 Tests.

**07-03 `taken` abgeleitet** — der Kern. Statt inkrementell fortzuschreiben, wird
`taken = entitlement + carryover − Journal-Saldo` absolut berechnet. Über diese Invariante
entfällt die sonst nötige (und fragile) Unterscheidung von `correction`-Buchungen nach
Zielfeld.

## Erkenntnisse

**Die Ableitung setzt gebuchten Anspruch voraus.** Fehlt die `entitlement`-Buchung, fällt der
Journal-Saldo zu niedrig und `taken` zu hoch aus — ein Konto mit 30 Tagen Anspruch und 2 Tagen
Urlaub käme auf `taken = 32`. `ensureVacationBalanceExists()` trägt fehlende Grundbuchungen
deshalb nach.

**Semantik vereinheitlicht.** Die Phase-6-Tests nahmen an, das Journal enthalte nur Verbrauch
(`journal == −taken`). Seit es auch Anspruch und Übertrag führt, ist die Journal-Summe der
*verfügbare Rest*. Die Tests prüfen jetzt die richtige Invariante.

**Beinahe-Fehler beim Produktionslauf:** Der erste Trockenlauf auf dem Server meldete 283,5
statt 98 Tage — er lief ohne `DATABASE_PATH` gegen `development.db`. Kein Schaden, aber ein
Beleg dafür, wie leicht der Symlink-Pfad in die falsche Datenbank führt. Der offene Punkt
"Symlink auflösen" aus der DB-Stabilisierung bleibt relevant.

## Offen

- **REQ-16 (Konsistenzprüfer in CI)** nicht umgesetzt — verschoben, siehe unten
- `vacationEntitlementBooking.test.ts` schlägt in der **Gesamtsuite** fehl, isoliert und in
  Gruppe mit den anderen Vacation-Tests aber grün (27/27). Geteilte Test-Datenbank über
  Dateigrenzen — dasselbe Muster wie bei den zwei vorbestehenden Fehlschlägen in
  `unifiedOvertimeService.test.ts`.
- Phase-6-Verifikation der Parallelsession meldete `gaps_found` (11/14 must_haves) — nicht
  von mir geprüft.
