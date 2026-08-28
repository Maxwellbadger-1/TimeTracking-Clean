---
phase: 14-absicherung-und-auslieferung
plan: 09
subsystem: ops
tags: [produktion, arbeitszeitmodell, model-change, uat, nachtraeglich]

requires:
  - phase: 14-08
    provides: Produktion auf dem v3.0-Codestand, Migrationen 008-015 angewendet
  - phase: 12
    provides: Vorschau und Speichern eines Stundenwechsels in der Desktop-App (REQ-26 bis REQ-29)
  - phase: 14-11
    provides: Desktop-Release v1.9.0, ueber das der Anwender den Wechsel eingetragen hat
provides:
  - Der erste reale Arbeitszeitmodellwechsel ist in der Produktion eingetragen und geprueft
  - Nachweis am realen Konto, dass eine Stundenumstellung keine Vergangenheit verschiebt
  - 14-UMSTELLUNGSFALL.md mit den vier Werten, der Vorschau, dem Ergebnis und zwei offenen Punkten
affects: [14-VERIFICATION, v3.0-MILESTONE-AUDIT]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/14-absicherung-und-auslieferung/14-UMSTELLUNGSFALL.md
  modified: []

key-decisions:
  - "Der Wechsel wurde nicht ueber applyModelChange.ts gefahren, sondern vom Anwender selbst in der Desktop-App eingetragen — das Produkt traegt den Fall, nicht ein Wartungsskript"
  - "Die Vorschau der Anwendung (REQ-27) tritt an die Stelle des vom Plan geforderten Trockenlaufs"
  - "Zwei nicht belegbare Muss-Aussagen werden benannt statt als erfuellt gefuehrt (Snapshot ueber alle Nutzer, Wortlaut der Begruendung)"

patterns-established: []

deviations:
  - "Der Plan sah einen skriptgefuehrten Ablauf mit Trockenlauf und Vorher/Nachher-Snapshots vor. Tatsaechlich hat der Anwender den Wechsel am 27.08.2026 in der App eingetragen. Die Belege stammen deshalb aus der forensischen Auswertung in .planning/debug/wal-abgehaengt-20260827.md, nicht aus einem geplanten Protokoll."
  - "Dieses SUMMARY wurde am 28.08.2026 nachtraeglich erstellt, angestossen durch /gsd:audit-milestone. Der Plan lief nie als Plan."

open:
  - "Kein Vorher/Nachher-Snapshot ueber alle Nutzer fuer den 27.08.2026 — dass sich der Saldo genau eines Nutzers unterscheidet, ist plausibel, aber nicht gemessen"
  - "Der Wortlaut der Pflichtbegruendung der model_change-Buchung ist nirgends festgehalten"

requirements-completed: [REQ-33]

# Metrics
duration: nachtraeglich erstellt
completed: 2026-08-28
---

# Plan 14-09 — Der reale Umstellungsfall

**Nachträglich erstellt am 28.08.2026.** Der Vorgang selbst fand am 27.08.2026 statt.

## Was gelaufen ist

Der Anwender hat am 27.08.2026 um 11:33:54 UTC den ersten realen Arbeitszeitmodellwechsel
eingetragen: **Nutzer 16, Benedikt Jochem, 30 → 40 Wochenstunden ab 01.08.2026** — mit einem
Stichtag in der Vergangenheit, also dem schwierigeren der beiden Fälle aus REQ-26.

Nicht über das dafür gebaute Wartungsskript `applyModelChange.ts`, sondern über die
Desktop-App v1.9.0. Das ist der stärkere Nachweis für den Milestone: die Oberfläche aus den
Phasen 12 und 13 trägt den Fall.

## Das Ergebnis

| Größe | Wert |
|---|---|
| Saldo vor dem Wechsel | −4:00 h |
| `model_change`-Buchung | −28:00 h |
| Saldo nach dem Wechsel | **−32:00 h** |
| Vorschau vor dem Speichern | **−32:00 h** |

Januar bis Juli 2026 blieben unverändert. Periode id 5 (30 h) endet am Stichtag, Periode
id 21 (40 h) läuft ab dem Stichtag. `overtime_transactions` an allen Messpunkten des Abends
unverändert bei 3843 Zeilen, max id 38097.

Damit ist am realen Konto belegt, was der Milestone verspricht: eine Stundenumstellung
verschiebt keine Vergangenheit, der Saldo wird nicht umgerechnet (REQ-28), und die Differenz
steht als eigene sichtbare Buchung im Journal (REQ-29).

## Was offen bleibt

Zwei der vier Muss-Aussagen des Plans sind aus den vorhandenen Belegen nicht nachweisbar und
in `14-UMSTELLUNGSFALL.md`, Abschnitt 5, einzeln benannt — kein Vorher/Nachher-Snapshot über
alle Nutzer, kein festgehaltener Wortlaut der Pflichtbegründung. Beides ist ohne Risiko
nachholbar, beides ohne direkten Zugriff auf `production.db`.
