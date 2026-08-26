# Schritt 5 - Bewegung allein durch den Journal-Backfill (--all-months)

- Stand A: `Produktion NACH Bereinigung der Zukunftszeilen, VOR Backfill, 2026-08-26` (erhoben 2026-08-26T04:52:21.242Z, SHA-256 Nutzdatenkern `-`)
- Stand B: `Produktion NACH Bereinigung und Backfill (--all-months), 2026-08-26` (erhoben 2026-08-26T04:53:31.129Z, SHA-256 Nutzdatenkern `-`)
- Stichtag fuer den angezeigten Saldo: Monatszeilen mit `month <= 2026-08`

## Saldo je Nutzer

| ID | Name | Wochenstd. | angezeigt A | angezeigt B | Bewegung | roh A | roh B | Bewegung roh | Zukunftsmonate B |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | System Administrator | 0 | 0 | 0 | - | 0 | 0 | - | - |
| 2 | Karin Jochem | 5 | 10 | 10 | - | 10 | 10 | - | - |
| 3 | Christine Glas | 8 | 5.19 | 5.19 | - | 5.19 | 5.19 | - | - |
| 15 | Test Test _(geloescht)_ | 0 | -83.46 | -83.46 | - | -83.46 | -83.46 | - | - |
| 16 | Benedikt Jochem | 30 | 2 | 2 | - | 2 | 2 | - | - |
| 17 | Carmen Rothemund | 12 | 1.24 | 1.24 | - | 1.24 | 1.24 | - | - |
| 18 | Silvia Lachner | 20 | 3.5 | 3.5 | - | 3.5 | 3.5 | - | - |
| 19 | Ute Stock | 2.5 | 12.41 | 12.41 | - | 12.41 | 12.41 | - | - |
| 20 | Hans Schauer | 7 | -20 | -20 | - | -20 | -20 | - | - |
| 21 | Maria Schauer | 5 | -17 | -17 | - | -17 | -17 | - | - |
| 22 | Beate Walleiter | 0 | 47.5 | 47.5 | - | 47.5 | 47.5 | - | - |
| 23 | Sepp Wasensteiner | 0 | 0 | 0 | - | 0 | 0 | - | - |
| 24 | Kathrin Leeb | 0 | 201.5 | 201.5 | - | 201.5 | 201.5 | - | - |
| 25 | Heidemarie Tretter | 8 | -240.95 | -240.95 | - | -240.95 | -240.95 | - | - |
| 26 | Test Test _(geloescht)_ | 0 | 0 | 0 | - | 0 | 0 | - | - |
| 27 | Reinhold Merl | 0 | 0 | 0 | - | 0 | 0 | - | - |
| 28 | Test Test _(geloescht)_ | 12 | -192.5 | -192.5 | - | -192.5 | -192.5 | - | - |
| 29 | Christina Wasensteiner | 0 | 65.28 | 65.28 | - | 65.28 | 65.28 | - | - |
| 30 | Test Urlaub _(geloescht)_ | 40 | -1272 | -1272 | - | -1272 | -1272 | - | - |
| 31 | UA T _(geloescht)_ | 40 | -1272 | -1272 | - | -1272 | -1272 | - | - |

## Bewegungen namentlich

**Keine Bewegung.** Der Saldo ist bei jedem Nutzer in beiden Abgrenzungen unveraendert.

## Urlaub

- Urlaubskonten gesamt: **40**
- davon schluessig (`Anspruch + Uebertrag - Genommen = Rest`): **40**
- Kein Konto unschluessig.
- **Urlaub unveraendert:** kein einziger Jahreswert hat sich zwischen A und B bewegt.

## Tabellenumfang

| Tabelle | A | B | Bewegung |
|---|---:|---:|---:|
| `users` | 20 | 20 | unveraendert |
| `time_entries` | 718 | 718 | unveraendert |
| `absence_requests` | 43 | 43 | unveraendert |
| `overtime_transactions` | 2590 | 3581 | **+991** |
| `overtime_balance` | 141 | 141 | unveraendert |
| `vacation_balance` | 40 | 40 | unveraendert |
| `vacation_transactions` | 59 | 59 | unveraendert |
| `user_work_periods` | 20 | 20 | unveraendert |

