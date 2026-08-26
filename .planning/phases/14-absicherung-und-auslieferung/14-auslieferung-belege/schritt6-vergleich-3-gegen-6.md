# Schritt 6 - Bewegung durch Bereinigung und Backfill (Schritt 3 gegen Schritt 6)

- Stand A: `Produktion NACH Deployment eaf5f5c (inkl. fix-overtime), 2026-08-26` (erhoben 2026-08-26T04:50:22.437Z, SHA-256 Nutzdatenkern `-`)
- Stand B: `Produktion NACH Bereinigung und Backfill (--all-months), 2026-08-26` (erhoben 2026-08-26T04:53:31.129Z, SHA-256 Nutzdatenkern `-`)
- Stichtag fuer den angezeigten Saldo: Monatszeilen mit `month <= 2026-08`

## Saldo je Nutzer

| ID | Name | Wochenstd. | angezeigt A | angezeigt B | Bewegung | roh A | roh B | Bewegung roh | Zukunftsmonate B |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | System Administrator | 0 | 0 | 0 | - | 0 | 0 | - | - |
| 2 | Karin Jochem | 5 | 10 | 10 | - | 10 | 10 | - | - |
| 3 | Christine Glas | 8 | 5.19 | 5.19 | - | -14.81 | 5.19 | +20 | - |
| 15 | Test Test _(geloescht)_ | 0 | -83.46 | -83.46 | - | -83.46 | -83.46 | - | - |
| 16 | Benedikt Jochem | 30 | 2 | 2 | - | 2 | 2 | - | - |
| 17 | Carmen Rothemund | 12 | 1.24 | 1.24 | - | -42.76 | 1.24 | +44 | - |
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
| 30 | Test Urlaub _(geloescht)_ | 40 | -1272 | -1272 | - | -1448 | -1272 | +176 | - |
| 31 | UA T _(geloescht)_ | 40 | -1272 | -1272 | - | -1272 | -1272 | - | - |

## Bewegungen namentlich

| ID | Name | angezeigt vorher | angezeigt nachher | Betrag | roh vorher | roh nachher | Betrag roh |
|---|---|---:|---:|---:|---:|---:|---:|
| 3 | Christine Glas | 5.19 h | 5.19 h | 0 h | -14.81 h | 5.19 h | +20 h |
| 17 | Carmen Rothemund | 1.24 h | 1.24 h | 0 h | -42.76 h | 1.24 h | +44 h |
| 30 | Test Urlaub | -1272 h | -1272 h | 0 h | -1448 h | -1272 h | +176 h |

**3 von 20 Nutzern bewegt.**

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
| `overtime_transactions` | 2690 | 3581 | **+891** |
| `overtime_balance` | 144 | 141 | **-3** |
| `vacation_balance` | 40 | 40 | unveraendert |
| `vacation_transactions` | 59 | 59 | unveraendert |
| `user_work_periods` | 20 | 20 | unveraendert |

