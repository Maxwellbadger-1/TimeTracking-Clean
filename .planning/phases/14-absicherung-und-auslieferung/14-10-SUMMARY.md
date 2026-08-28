---
phase: 14-absicherung-und-auslieferung
plan: 10
subsystem: ops
tags: [produktion, backfill, overtime-transactions, phase-9.1, nachtraeglich]

requires:
  - phase: 14-07
    provides: Urteil zu Phase 9.1, Werkzeug backfillOvertimeJournal.ts, Probelauf auf einer Produktionskopie
  - phase: 14-08
    provides: Produktion auf dem v3.0-Codestand, geprueftes Wartungsfenster
provides:
  - Journal-Backfill der Phase 9.1 ist auf der Produktion ausgefuehrt — 991 Journalzeilen ergaenzt
  - Aggregat und Journal sind fuer alle 15 aktiven Nutzer deckungsgleich (vorher 10 von 15)
  - 14-BACKFILL-PRODUKTION.md mit Sicherung, Fundliste, Schreiblauf, Wirkungsnachweis und Reihenfolge-Abweichung
affects: [14-VERIFICATION, phase-9.1, v3.0-MILESTONE-AUDIT]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/14-absicherung-und-auslieferung/14-BACKFILL-PRODUKTION.md
  modified: []

key-decisions:
  - "Variante Vollaufbau (--all-months, 100 Monate ueber 15 Nutzer) statt Reparatur der 39 gefundenen Fundstellen — deckt auch unentdeckte Luecken ab"
  - "Eigene, zweite Sicherung vor dem Schritt statt Wiederverwendung der Deployment-Sicherung"
  - "Die Abweichung von der geplanten Wellenreihenfolge wird benannt und mit Zahlen entkraeftet, nicht verschwiegen"

patterns-established: []

deviations:
  - "Der Backfill lief am 26.08.2026 und damit VOR dem realen Umstellungsfall (27.08.2026), obwohl Plan 14-10 als Welle 7 nach Plan 14-09 (Welle 6) angesetzt war. Unschaedlich und belegt: der Backfill hat overtime_balance nicht bewegt (141 vor, 141 nach, 0 von 20 Nutzern), und es existierte zu diesem Zeitpunkt keine model_change-Zeile. Siehe 14-BACKFILL-PRODUKTION.md, Abschnitt 6."
  - "Das Protokoll wurde im selben Wartungsfenster in 14-AUSLIEFERUNG.md Abschnitt 5 mitgeschrieben. 14-BACKFILL-PRODUKTION.md und dieses SUMMARY tragen es am 28.08.2026 an den vom Plan vorgesehenen Ort nach; es ist eine Zusammenfuehrung vorhandener Belege, keine neue Messung."

open:
  - "Muss-Aussage 4 (Modellwechsel-Buchungen nach dem Backfill unveraendert vorhanden) ist nur trivial erfuellt — 0 vor, 0 nach. Den nicht-trivialen Fall deckt die Generalprobe in 14-VORHER-NACHHER.md ab."
  - "Phase 9.1, Teil 3 (Code-Haertung WR-02 bis WR-05) bleibt offen — durch diesen Plan nicht beruehrt"

requirements-completed: [REQ-19, REQ-33]

# Metrics
duration: nachtraeglich erstellt
completed: 2026-08-28
---

# Plan 14-10 — Journal-Backfill der Phase 9.1 auf der Produktion

**Nachträglich erstellt am 28.08.2026.** Der Backfill selbst lief am 26.08.2026, 04:35–04:58 UTC.

## Was gelaufen ist

Zweiter schreibender Schritt des Wartungsfensters, mit eigener Freigabe und eigener
Sicherung (`production.PRE-BACKFILL-ALLMONTHS_20260826_045220.db`, SHA-256 geprüft,
`integrity_check: ok`).

Der Trockenlauf fand **12 Nutzer mit 39 unvollständigen Monaten**. Ausgeführt wurde die
Variante Vollaufbau: alle **100 vergangenen Monate über 15 Nutzer**, 5 soft-gelöschte Nutzer
übersprungen.

```
100 von 100 Monaten verarbeitet
overtime_transactions: 2590 → 3581   (+991 Zeilen)
model_change-Zeilen:   0 → 0
integrity_check: ok
```

## Die Wirkung

**0 von 20 Nutzern mit Saldoänderung.** `overtime_balance` blieb bei 141 Zeilen unverändert.
Der Vollaufbau hat ausschließlich das Journal wieder in Deckung mit dem Aggregat gebracht —
der Kontoauszug zeigt oben und unten dieselbe Rechnung, ohne dass sich für einen Mitarbeiter
eine Zahl geändert hätte.

Deckungsgleichheit mit dem kanonischen Rechenweg: **10 von 15 aktiven Nutzern vorher,
15 von 15 nachher.** Fünf Nutzer (16, 18, 20, 21, 25) gingen von einer Restdifferenz auf 0 h.

## Was das für Phase 9.1 bedeutet

Teil 1 und Teil 2 des Urteils aus `14-URTEIL-PHASE-9.1.md` sind damit umgesetzt. **Teil 3,
die Code-Härtung (WR-02 bis WR-05), bleibt offen** und ist durch diesen Plan nicht berührt.
