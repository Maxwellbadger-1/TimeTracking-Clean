# 14-BACKFILL-PRODUKTION — Journal-Backfill der Phase 9.1 auf der Produktion

**Ausgeführt:** 26.08.2026, Zeitfenster 04:35–04:58 UTC (06:35–06:58 Berlin)
**Zieldatenbank:** `/home/ubuntu/databases/production.db`
**Freigabe:** liegt vor (Anwender, im selben Wartungsfenster wie Auslieferung und Bereinigung)
**Dokument erstellt:** 28.08.2026

---

## ⚠ Was dieses Dokument ist

Der Backfill ist am 26.08.2026 **tatsächlich gelaufen** und vollständig protokolliert — nur
nicht in dieser Datei. Das Protokoll steht in `14-AUSLIEFERUNG.md`, Abschnitt 5
(„Journal-Backfill, Variante Vollaufbau"), weil der Schritt im selben Wartungsfenster wie die
Auslieferung und die Bereinigung der Zukunftszeilen lief und dort mitgeschrieben wurde.

Dieses Dokument trägt die Belege an den vom Plan 14-10 vorgesehenen Ort nach und prüft sie
gegen die vier Muss-Aussagen des Plans. **Es ist eine Zusammenführung vorhandener Belege,
keine neue Messung.** Alle Zahlen stammen aus `14-AUSLIEFERUNG.md` und
`14-auslieferung-belege/schritt5-vergleich-zwischen-gegen-6.md`.

---

## 1. Die zweite, geprüfte Sicherung vor dem Eingriff

Der Backfill ist der zweite schreibende Schritt des Fensters. Vor ihm wurde eine eigene,
zusätzliche Sicherung gezogen — nicht die des Deployments wiederverwendet:

```
VACUUM INTO '/home/ubuntu/databases/backups/production.PRE-BACKFILL-ALLMONTHS_20260826_045220.db'
```

| Prüfung | Ergebnis |
|---|---|
| SHA-256 | `8583e48e1b4b77a80a3b6ae536508fed68eb99c108cce5735dd1f33f6a952d49` |
| `integrity_check` | `ok` |
| `overtime_transactions` | 2590 |
| `overtime_balance` | 141 |
| übrige Tabellen | time_entries 718, absence_requests 43, overtime_corrections 4, vacation_balance 40, vacation_transactions 59 |

2590 = 2690 − 100 und 141 = 144 − 3: Die Sicherung enthält nachweislich den Stand **nach** der
Bereinigung der Zukunftszeilen und **vor** dem Backfill. Die Zeitscheibe ist damit eindeutig.

## 2. Stufe 1 — Trockenlauf ohne Schreibzugriff

```
DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production \
  npx tsx src/scripts/backfillOvertimeJournal.ts --all-months --allow-production
```

Fundliste — 12 betroffene Nutzer, 39 unvollständige Monate:

| Nutzer | unvollständige Monate |
|---|---|
| 2 Karin Jochem | 4 — 2026-01, 04, 05, 07 |
| 3 Christine Glas | 3 — 2026-01, 03, 06 |
| 16 Benedikt Jochem | 6 — 2026-01, 03, 04, 05, 06, 07 |
| 17 Carmen Rothemund | 4 — 2026-03, 04, 05, 06 |
| 18 Silvia Lachner | 3 — 2026-01, 04, 07 |
| 19 Ute Stock | 5 — 2026-01, 02, 03, 04, 05 |
| 20 Hans Schauer | 3 — 2026-04, 06, 07 |
| 21 Maria Schauer | 3 — 2026-04, 06, 07 |
| 22 Beate Walleiter | 1 — 2026-07 |
| 24 Kathrin Leeb | 1 — 2026-05 |
| 25 Heidemarie Tretter | 5 — 2026-03, 04, 05, 06, 07 |
| 29 Christina Wasensteiner | 1 — 2026-07 |

Mit `--all-months` verarbeitet der Schreiblauf statt der 39 gefundenen **alle 100 vergangenen
Monate über 15 Nutzer** — der Vollaufbau statt der Reparatur einzelner Fundstellen.
5 soft-gelöschte Nutzer werden übersprungen.

Ausgangswerte: `overtime_transactions` COUNT = 2590, SUM(hours) = −133,76,
`model_change`-Zeilen = 0.

## 3. Stufe 2 — der Schreiblauf

```
100 von 100 Monaten verarbeitet — userId=29, Monat=2026-07

overtime_transactions nach dem Lauf: COUNT=3581, SUM(hours)=-207.09, model_change-Zeilen=0
Differenz: COUNT=991, SUM(hours)=-73.33
integrity_check: [{"integrity_check":"ok"}]
model_change-Zeilen unveraendert (0 vor, 0 nach dem Lauf).

### FERTIG ###
```

**+991 Journalzeilen, kein Abbruch, `integrity_check: ok`.**

## 4. Wirkung auf den sichtbaren Saldo

Beleg: `14-auslieferung-belege/schritt5-vergleich-zwischen-gegen-6.md`

> **Keine Bewegung.** Der Saldo ist bei jedem Nutzer in beiden Abgrenzungen unverändert.
> **0 von 20 Nutzern bewegt.**

| Tabelle | vor Backfill | nach Backfill | Bewegung |
|---|---:|---:|---|
| `overtime_transactions` | 2590 | 3581 | **+991** |
| `overtime_balance` | 141 | 141 | unverändert |
| alle übrigen | | | unverändert |

Das ist das bestmögliche Ergebnis. Der Vollaufbau hat den für Mitarbeiter sichtbaren Saldo
nicht angetastet — er hat ausschließlich das **Journal** wieder in Deckung mit dem Aggregat
gebracht. Das Monatsaggregat war nach dem Lauf von `fix-overtime.ts` bereits richtig; der
Backfill hat die Buchungsliste darunter nachgezogen. Der Kontoauszug zeigt oben und unten
dieselbe Rechnung, ohne dass sich für einen Mitarbeiter eine Zahl geändert hätte.

Deckungsgleichheit mit dem kanonischen Rechenweg, vor und nach dem gesamten Fenster:

| | vorher | nachher |
|---|---:|---:|
| aktive Nutzer deckungsgleich | 10 von 15 | **15 von 15** |

Fünf Nutzer (16, 18, 20, 21, 25) gingen von einer Restdifferenz auf 0 h; die übrigen zehn
waren bereits deckungsgleich und blieben es.

## 5. Prüfung gegen die vier Muss-Aussagen des Plans 14-10

| # | Muss-Aussage | Urteil |
|---|---|---|
| 1 | Läuft als eigener, gesondert freigegebener Schritt nach der Verifikation der Phase 14 | ⚠ **teilweise** — eigener, gesondert freigegebener Schritt: ja. „Nach der Verifikation aus Plan 14-09": **nein**, siehe Abschnitt 6 |
| 2 | Vor dem Backfill liegt eine zweite, geprüfte Sicherung vor | ✅ `production.PRE-BACKFILL-ALLMONTHS_20260826_045220.db`, SHA-256 und `integrity_check` geprüft |
| 3 | Nach dem Backfill endet kein vollständig vergangener Monat mehr vor seinem letzten Solltag | ✅ alle 100 vergangenen Monate über 15 Nutzer neu aufgebaut, kein Abbruch; Deckungsgleichheit 10/15 → 15/15 |
| 4 | Die Modellwechsel-Buchungen sind nach dem Backfill unverändert vorhanden | ⚠ **trivial erfüllt** — der Zähler meldet 0 vor und 0 nach dem Lauf. Zum Zeitpunkt des Backfills existierte in der Produktion noch keine einzige `model_change`-Zeile; der erste reale Modellwechsel kam einen Tag später. Die Aussage ist also nicht verletzt, aber sie wurde auch nicht auf die Probe gestellt. Den nicht-trivialen Fall deckt die Generalprobe ab (`14-VORHER-NACHHER.md`). |

## 6. Abweichung von der geplanten Reihenfolge

Plan 14-10 setzte den Backfill als **Welle 7** an, also nach Plan 14-09 (Welle 6, realer
Umstellungsfall) — mit der Begründung, der Backfill bewege sowohl `overtime_transactions` als
auch `overtime_balance` und damit genau die Größen, über die die Verifikation des
Umstellungsfalls urteilt.

**Gelaufen ist es umgekehrt:** Backfill am 26.08.2026, Umstellungsfall am 27.08.2026.

Die Umkehrung hat keinen Schaden angerichtet, und das ist belegt, nicht angenommen:

- Der Backfill hat `overtime_balance` **nicht** bewegt (141 vor, 141 nach; 0 von 20 Nutzern
  mit Saldoänderung). Die Größe, über die die Verifikation des Umstellungsfalls urteilt, war
  also zum Zeitpunkt des Wechsels bereits stabil.
- Es gab zum Zeitpunkt des Backfills keine `model_change`-Zeile, die er hätte beschädigen
  können.
- Der Umstellungsfall vom 27.08. rechnete auf einem Journal, das der Backfill gerade erst in
  Deckung mit dem Aggregat gebracht hatte — die günstigere, nicht die riskantere Reihenfolge.

## 7. Verbleibender Umfang der Phase 9.1

Mit diesem Backfill ist **Teil 1 und Teil 2** des Urteils aus `14-URTEIL-PHASE-9.1.md`
umgesetzt. Offen bleibt Teil 3, die Code-Härtung, die dort ausdrücklich in Phase 9.1
verbleibt:

- **WR-05** — `server/scripts/fix-overtime.ts` ohne Fehlerisolierung pro Nutzer, `db.close()`
  fehlt im Fehlerpfad
- **WR-03 (Rest)** — kein `PRAGMA busy_timeout` im Projekt
- **WR-04** — `server/scripts/**` von `tsconfig.json:26` ausgeschlossen und damit ungetypt
- **WR-02 (Rest)** — Servicefunktionen ohne dedizierte Tests

WR-07 hat Plan 14-02 geschlossen.
