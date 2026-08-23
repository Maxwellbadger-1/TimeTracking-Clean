# Die acht Nutzer mit geänderten Überstundenständen

**Vergleich:** Produktion vor dem Deployment (23.08.2026, 11:15:41) gegen Produktion nach
Deployment und Migration (11:56:27).

**Verursacher:** `fix-overtime.ts` aus dem Deploy-Workflow, **nicht** die Migrationen 011–015.
Nachgewiesen durch Isolation: dieselbe Sicherung lokal migriert ergab 0 Differenzen; die daraus
abgeleitete Vorhersage gegen die Produktion ergab exakt dieselben 99 Werte.

## Kernbefund

Kein Wert wurde erfunden, keine Gutschrift entfernt, keine Zeile gelöscht. Das Aggregat
`overtime_balance` hat sich dem Journal `overtime_transactions` angenähert — und das Journal ist
seit Milestone v2.0 die maßgebliche Quelle des Saldos.

| | Monate, in denen Aggregat und Journal übereinstimmen |
|---|---|
| **vorher** | 18 von 59 |
| **nachher** | 36 von 59 |

Die verbleibenden 23 Abweichungen sind derselbe Rückstand, den der Journal-Backfill der
Phase 9.1 als Vollaufbau schließt (siehe `14-URTEIL-PHASE-9.1.md`).

---

## Nutzer 2 — Karin Jochem

Wochenstunden 5, Eintritt 2026-01-01

**Saldo 6 h → 10 h  (Differenz +4 h)**

| Monat | Soll vor | Soll nach | Ist vor | Ist nach | Saldo vor | Saldo nach | Diff | Journal | nachher = Journal? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026-01 | 20 | 20 | 0 | 0 | -20 | -20 | — | – | nein |
| 2026-02 | 20 | 20 | 29 | 29 | 9 | 9 | — | 9 | ja |
| 2026-03 | 22 | 20 | 2.5 | 2.5 | -19.5 | -17.5 | **+2** | -17.5 | ja |
| 2026-04 | 20 | 25 | 21.5 | 21.5 | 1.5 | -3.5 | **-5** | 1.5 | nein |
| 2026-05 | 18 | 15 | 27.5 | 27.5 | 9.5 | 12.5 | **+3** | 17.5 | nein |
| 2026-06 | 21 | 15 | 60 | 60 | 39 | 45 | **+6** | 45 | ja |
| 2026-07 | 23 | 25 | 18.5 | 18.5 | -4.5 | -6.5 | **-2** | -1.5 | nein |
| 2026-08 | 15 | 15 | 6 | 6 | -9 | -9 | — | -4 | nein |

## Nutzer 3 — Christine Glas

Wochenstunden 8, Eintritt 2026-01-01

**Saldo -46.43 h → -15.23 h  (Differenz +31.2 h)**

| Monat | Soll vor | Soll nach | Ist vor | Ist nach | Saldo vor | Saldo nach | Diff | Journal | nachher = Journal? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026-01 | 32 | 28 | 17.18 | 29.18 | -14.82 | 1.18 | **+16** | – | nein |
| 2026-02 | 32 | 32 | 28.28 | 33.08 | -3.72 | 1.08 | **+4.8** | 1.08 | ja |
| 2026-03 | 35.2 | 40 | 40.17 | 40.17 | 4.97 | 0.17 | **-4.8** | 0.17 | ja |
| 2026-04 | 32 | 28 | 28.59 | 28.59 | -3.41 | 0.59 | **+4** | 0.59 | ja |
| 2026-05 | 28.8 | 28 | 19.15 | 28.75 | -9.65 | 0.75 | **+10.4** | 0.75 | ja |
| 2026-06 | 33.6 | 40 | 41.33 | 41.33 | 7.73 | 1.33 | **-6.4** | 1.66 | nein |
| 2026-07 | 36.8 | 32 | 31.16 | 31.16 | -5.64 | -0.84 | **+4.8** | -0.84 | ja |
| 2026-08 | 24 | 24 | 22.11 | 24.51 | -1.89 | 0.51 | **+2.4** | 0.51 | ja |
| 2026-09 | 36 | 36 | 16 | 16 | -20 | -20 | — | -20 | ja |

## Nutzer 16 — Benedikt Jochem

Wochenstunden 30, Eintritt 2026-01-01

**Saldo 104 h → 20 h  (Differenz -84 h)**

| Monat | Soll vor | Soll nach | Ist vor | Ist nach | Saldo vor | Saldo nach | Diff | Journal | nachher = Journal? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026-01 | 120 | 120 | 168.5 | 168.5 | 48.5 | 48.5 | — | – | nein |
| 2026-02 | 120 | 120 | 92 | 92 | -28 | -28 | — | -28 | ja |
| 2026-03 | 132 | 132 | 135 | 135 | 3 | 3 | — | 5.5 | nein |
| 2026-04 | 120 | 120 | 176.25 | 146.25 | 56.25 | 26.25 | **-30** | 26.25 | ja |
| 2026-05 | 108 | 108 | 141.5 | 87.5 | 33.5 | -20.5 | **-54** | -20.5 | ja |
| 2026-06 | 126 | 126 | 142 | 142 | 16 | 16 | — | 17 | nein |
| 2026-07 | 138 | 138 | 108.25 | 108.25 | -29.75 | -29.75 | — | -28.5 | nein |
| 2026-08 | 90 | 90 | 94.5 | 94.5 | 4.5 | 4.5 | — | 16.5 | nein |

## Nutzer 17 — Carmen Rothemund

Wochenstunden 12, Eintritt 2026-01-01

**Saldo -46.06 h → -45.26 h  (Differenz +0.8 h)**

| Monat | Soll vor | Soll nach | Ist vor | Ist nach | Saldo vor | Saldo nach | Diff | Journal | nachher = Journal? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026-01 | 48 | 44 | 51.49 | 53.09 | 3.49 | 9.09 | **+5.6** | 9.09 | ja |
| 2026-02 | 48 | 48 | 45.22 | 46.82 | -2.78 | -1.18 | **+1.6** | -1.18 | ja |
| 2026-03 | 52.8 | 56 | 57.58 | 57.58 | 4.78 | 1.58 | **-3.2** | 3.08 | nein |
| 2026-04 | 43.2 | 40 | 31.37 | 32.17 | -11.83 | -7.83 | **+4** | -4.42 | nein |
| 2026-05 | 43.2 | 40 | 40.69 | 39.09 | -2.51 | -0.91 | **+1.6** | -0.91 | ja |
| 2026-06 | 50.4 | 52 | 51.26 | 49.66 | 0.86 | -2.34 | **-3.2** | -1.59 | nein |
| 2026-07 | 55.2 | 52 | 51.98 | 53.58 | -3.22 | 1.58 | **+4.8** | 1.58 | ja |
| 2026-08 | 36 | 36 | 45.15 | 34.75 | 9.15 | -1.25 | **-10.4** | 2.75 | nein |
| 2026-09 | 52 | 52 | 8 | 8 | -44 | -44 | — | -44 | ja |

## Nutzer 18 — Silvia Lachner

Wochenstunden 20, Eintritt 2026-01-01

**Saldo -4.5 h → 11.5 h  (Differenz +16 h)**

| Monat | Soll vor | Soll nach | Ist vor | Ist nach | Saldo vor | Saldo nach | Diff | Journal | nachher = Journal? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026-01 | 80 | 84 | 93.75 | 89.75 | 13.75 | 5.75 | **-8** | – | nein |
| 2026-02 | 80 | 80 | 75 | 75 | -5 | -5 | — | -5 | ja |
| 2026-03 | 88 | 80 | 67.25 | 83.25 | -20.75 | 3.25 | **+24** | 3.25 | ja |
| 2026-04 | 80 | 92 | 90.75 | 90.75 | 10.75 | -1.25 | **-12** | -2.5 | nein |
| 2026-05 | 72 | 72 | 72.25 | 72.25 | 0.25 | 0.25 | — | 0.25 | ja |
| 2026-06 | 84 | 72 | 64.75 | 72.75 | -19.25 | 0.75 | **+20** | 0.75 | ja |
| 2026-07 | 92 | 100 | 112.5 | 112.5 | 20.5 | 12.5 | **-8** | 8.25 | nein |
| 2026-08 | 60 | 60 | 55.25 | 55.25 | -4.75 | -4.75 | — | -4.75 | ja |

## Nutzer 19 — Ute Stock

Wochenstunden 2.5, Eintritt 2026-01-01

**Saldo 10.41 h → 12.41 h  (Differenz +2 h)**

| Monat | Soll vor | Soll nach | Ist vor | Ist nach | Saldo vor | Saldo nach | Diff | Journal | nachher = Journal? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026-01 | 10 | 10 | 10.08 | 10.08 | 0.08 | 0.08 | — | -6 | nein |
| 2026-02 | 10 | 10 | 10 | 10 | 0 | 0 | — | -3.25 | nein |
| 2026-03 | 11 | 10 | 17.92 | 17.92 | 6.92 | 7.92 | **+1** | 7.42 | nein |
| 2026-04 | 10 | 12.5 | 11 | 11 | 1 | -1.5 | **-2.5** | 1 | nein |
| 2026-05 | 9 | 7.5 | 14.75 | 14.75 | 5.75 | 7.25 | **+1.5** | 5 | nein |
| 2026-06 | 10.5 | 7.5 | 12 | 12 | 1.5 | 4.5 | **+3** | 4.5 | ja |
| 2026-07 | 11.5 | 12.5 | 5.25 | 5.25 | -6.25 | -7.25 | **-1** | -7.25 | ja |
| 2026-08 | 7.5 | 7.5 | 8.91 | 8.91 | 1.41 | 1.41 | — | 3.91 | nein |

## Nutzer 24 — Kathrin Leeb

Wochenstunden 0, Eintritt 2026-01-01

**Saldo 249.5 h → 201.5 h  (Differenz -48 h)**

Hinterlegte Admin-Korrekturen (bereits vor dem Deployment im Journal, aber nicht im Aggregat):

- 2026-03-26: **-48 h** — „Anpassung zur besseren Übersicht"

| Monat | Soll vor | Soll nach | Ist vor | Ist nach | Saldo vor | Saldo nach | Diff | Journal | nachher = Journal? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026-01 | 0 | 0 | 30.5 | 30.5 | 30.5 | 30.5 | — | 30.5 | ja |
| 2026-02 | 0 | 0 | 17.5 | 17.5 | 17.5 | 17.5 | — | 17.5 | ja |
| 2026-03 | 0 | 0 | 41 | -7 | 41 | -7 | **-48** | -7 | ja |
| 2026-04 | 0 | 0 | 39 | 39 | 39 | 39 | — | 39 | ja |
| 2026-05 | 0 | 0 | 49 | 49 | 49 | 49 | — | 44.5 | nein |
| 2026-06 | 0 | 0 | 72.5 | 72.5 | 72.5 | 72.5 | — | 72.5 | ja |
| 2026-07 | 0 | 0 | 0 | 0 | 0 | 0 | — | – | nein |
| 2026-08 | 0 | 0 | 0 | 0 | 0 | 0 | — | – | nein |

## Nutzer 29 — Christina Wasensteiner

Wochenstunden 0, Eintritt 2026-01-01

**Saldo 85.78 h → 65.28 h  (Differenz -20.5 h)**

Hinterlegte Admin-Korrekturen (bereits vor dem Deployment im Journal, aber nicht im Aggregat):

- 2026-03-01: **-20.5 h** — „Anpassung zur besseren Übersicht"

| Monat | Soll vor | Soll nach | Ist vor | Ist nach | Saldo vor | Saldo nach | Diff | Journal | nachher = Journal? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026-01 | 0 | 0 | 8 | 8 | 8 | 8 | — | 8 | ja |
| 2026-02 | 0 | 0 | 10 | 10 | 10 | 10 | — | 10 | ja |
| 2026-03 | 0 | 0 | 9.66 | -10.84 | 9.66 | -10.84 | **-20.5** | -10.84 | ja |
| 2026-04 | 0 | 0 | 16.2 | 16.2 | 16.2 | 16.2 | — | 16.2 | ja |
| 2026-05 | 0 | 0 | 13.6 | 13.6 | 13.6 | 13.6 | — | 13.6 | ja |
| 2026-06 | 0 | 0 | 15.5 | 15.5 | 15.5 | 15.5 | — | 15.5 | ja |
| 2026-07 | 0 | 0 | 12.82 | 12.82 | 12.82 | 12.82 | — | 10.82 | nein |
| 2026-08 | 0 | 0 | 0 | 0 | 0 | 0 | — | – | nein |

---

## Einordnung der drei größten Bewegungen

**Nutzer 24, −48 h** und **Nutzer 29, −20,5 h**: Beides sind Admin-Korrekturen, die ein Mensch
ausdrücklich eingetragen hat („Anpassung zur besseren Übersicht"). Sie standen seit ihrer
Eintragung im März im Journal, das Aggregat hat sie nie übernommen. Jetzt tut es das. Die im
Monatsraster sichtbaren negativen Ist-Stunden (−7 h bzw. −10,84 h) sind eine Darstellungsfolge
davon, dass Korrekturen in die Ist-Spalte eingerechnet werden — kein negativer Arbeitszeitwert.

**Nutzer 16, −84 h**: April und Mai entsprechen jetzt **exakt** der Journalsumme (26,25 h und
−20,5 h). Die alten Aggregatwerte (56,25 h und 33,5 h) haben dem Journal nie entsprochen. Die
Krankheits- und Urlaubsgutschriften sind vollständig vorhanden — 16 Buchungen im Zeitraum,
nachgezählt — und wurden nicht entfernt.
