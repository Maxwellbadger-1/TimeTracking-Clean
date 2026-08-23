---
phase: 14-absicherung-und-auslieferung
plan: 03
subsystem: documentation
tags: [uat, abnahmesitzung, doku, milestone-v3.0]

# Dependency graph
requires:
  - phase: 11-datumsabh-ngige-berechnung
    provides: 6 UAT-Punkte (11-U1 bis 11-U6) und 3 Festlegungen (11-F1 bis 11-F3) in 14-UAT-SAMMLUNG.md
  - phase: 12-stundenwechsel-bedienen
    provides: 51 UAT-Punkte (1-51) in 14-UAT-SAMMLUNG.md, plus 12-UI-REVIEW-FIX.md (6 behobene UI-Befunde)
  - phase: 13-korrigieren-und-r-ckg-ngig-machen
    provides: 29 UAT-Punkte (13-U1 bis 13-U19, 13-F1 bis 13-F10) in 14-UAT-SAMMLUNG.md, plus 13-UI-REVIEW-FIX.md (5 behobene UI-Befunde) und 13-SECURITY-FIX.md (B-2)
  - phase: 14-absicherung-und-auslieferung
    provides: 14-01-SUMMARY.md/14-REQ32-NACHWEIS.md (REQ-32), 14-02-SUMMARY.md/14-WR07-ENTSCHEIDUNG.md (WR-07/B-1)
provides:
  - "Prüfweg-Zuordnung aller 86 Bestandspunkte auf A/B/C/D in 14-UAT-SAMMLUNG.md"
  - "14-UAT-SITZUNG.md: durchführbarer Sitzungsablauf mit Vorbedingungen, Reihenfolge, Zeitschätzung, Abbruchregeln"
  - "14-U1 bis 14-U9: eigene Phase-14-Punkte inkl. der fünf UI-Korrekturen Phase 13, sechs UI-Korrekturen Phase 12, B-2-Sicherheitsfix, REQ-32-Nachweis, WR-07-Oberflächenwirkung"
affects: [14-04, 14-11, uat-abnahmesitzung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prüfweg-Zuordnung (A=Dev-Server/B=Produktionskopie/C=nach Release/D=Festlegung) als wiederverwendbares Raster für künftige gebündelte UAT-Runden"
    - "Dublettenmerge auf einen Leitpunkt mit Kennungen in Klammern, statt Punkte stillschweigend zu löschen"

key-files:
  created:
    - .planning/phases/14-absicherung-und-auslieferung/14-UAT-SITZUNG.md
  modified:
    - .planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md

key-decisions:
  - "11-F1 bis 11-F3 sind laut der Kontrollsummen-Arithmetik im Bestand (6+51+29=86) NICHT Teil der 86 Bestandspunkte, obwohl sie inhaltlich Festlegungen sind wie 13-F1-10 — als separater Zusatz mit Prüfweg D geführt statt die Kontrollsumme 86 zu verfälschen"
  - "Von acht vorgeprüften Dublettenkandidaten wurden zwei vollständig verworfen (Migration 011 vs. 015 — unterschiedliche Migrationen trotz gleichem Prüfweg; das war ein Fehler im Kandidatenvorschlag) und zwei nur teilweise bestätigt (Kontrast-Kandidat enthielt zwei Responsive-Layout-Punkte statt Kontrast, Fokus-Kandidat enthielt eine offene Entscheidungsfrage statt eines Verhaltenstests)"
  - "Punkt 48 (Playwright-E2E-Suite) läuft in der Sitzung als manueller Nachvollzug des Bedienpfads statt als automatisierter Lauf — Playwright ist in dieser Umgebung nicht installiert und die Installation ist laut Auftrag nicht autorisiert"
  - "Fünf zusätzliche Punktgruppen aus dem Ausführungsauftrag (Phase-13-UI-Fixes, Phase-12-UI-Fixes, B-2-Sicherheitsfix, REQ-32-Nachweis, WR-07-Oberflächenwirkung) als 14-U5 bis 14-U9 in die Phase-14-eigenen Punkte aufgenommen, gemessene Zählungen aus den Quelldateien übernommen (5 bzw. 6 Befunde), nicht geschätzt"

metrics:
  duration: "~90min"
  completed: "2026-08-23"
  tasks: 2
  files_modified: 2
---

# Phase 14 Plan 03: UAT-Sitzungsplan Summary

**86 gesammelte Abnahmepunkte aus Phase 11/12/13 auf vier Prüfwege (A=Dev-Server,
B=Produktionskopie, C=nach dem Release, D=Festlegung) verteilt, acht Dublettenkandidaten am
Wortlaut geprüft und teils korrigiert, und in `14-UAT-SITZUNG.md` zu einer durchführbaren
Sitzung mit Reihenfolge, Vorbedingungen, Zeitschätzung und Abbruchregeln zusammengeführt —
ergänzt um neun eigene Phase-14-Punkte inklusive der zwischenzeitlich gelandeten UI- und
Sicherheitskorrekturen aus den Phasen 12/13.**

## Was gebaut wurde

**Task 1 — Prüfweg-Zuordnung aller 86 Punkte.** An `14-UAT-SAMMLUNG.md` wurde ausschließlich
angehängt: ein neuer Abschnitt „Prüfweg-Zuordnung aller 86 Punkte (Plan 14-03)" mit einer Tabelle
je Phase (11: 6 Punkte, 12: 51 Punkte, 13: 29 Punkte), die jedem Bestandspunkt genau einen
Prüfweg zuweist. Kontrollzeile: A=58, B=11, C=0, D=17, Summe=86 — bestätigt gegen
`6+51+29=86` aus dem `<bestand>`-Block des Plans. Die acht im Plankontext vorgeschlagenen
Dublettenkandidaten wurden am tatsächlichen Wortlaut beider (bzw. aller) beteiligten Punkte
geprüft, nicht ungeprüft übernommen:

- **Sechs Kandidaten bestätigt** (ganz oder teilweise): Generalprobe auf Produktionskopie
  (11-U6, P12-18 → Leitpunkt 13-U11), Playwright-Lauf (P12-37/38/39 → Leitpunkt 48, dessen
  eigener Wortlaut „ersetzt und präzisiert die Punkte 37-39" die Dublette selbst belegt),
  verschachtelte Dialoge (P12-31 → Leitpunkt 5), Drosselung (P12-42 → Leitpunkt 13-U17, weil der
  von P12-42 beschriebene IP-Eimer seit Commit `74a8be6` überholt ist), `PREVIEW_STALE`
  (P12-20 → Leitpunkt 13-U18), Fokusverhalten (P12-6/8 → Leitpunkt 22).
- **Zwei Kandidaten vollständig verworfen:** Migration auf Produktionskopie (P12-1 vs. 13-U14) —
  das sind zwei verschiedene Migrationen (011 und 015) mit eigenständigen
  Integritätsprüfungen, ein Merge hätte fälschlich nahegelegt, eine Prüfung ersetze die andere.
- **Zwei Kandidaten teilweise verworfen:** Der Kontrast-Kandidat listete P12-24 und 13-U10 mit —
  beide sind bei genauer Lektüre Responsive-Layout-Prüfungen bei <640px, keine
  Kontrast-/Dunkelmodus-Prüfungen; sie bleiben eigenständig. Der Fokus-Kandidat listete P12-46
  mit — der Punkt sagt selbst „ist zu entscheiden" und ist eine offene Gestaltungsfrage
  (jetzt Prüfweg D), kein Verhaltenstest wie 6/8/22.

Eine zusätzliche Suche nach im Kontextblock nicht genannten Dubletten (11-U3 vs. P12-19, P12-9
vs. P12-17, 13-U1 vs. P12-3) fand keine weiteren Treffer — alle drei geprüften Paare
unterscheiden sich in Prüfziel oder Komponente.

Der Platzhaltersatz unter der bestehenden Überschrift „## Phase 14 — Absicherung und
Auslieferung" wurde durch neun konkrete Punkte ersetzt: `14-U1` bis `14-U4` wie vom Plan
vorgegeben (realer Umstellungsfall, Freigabe Produktionslauf, Release-Verifikation,
WR-07-Kenntnisnahme), und `14-U5` bis `14-U9` aus dem Ausführungsauftrag zusätzlich verlangt —
die fünf UI-Korrekturen aus Phase 13 (`13-UI-REVIEW-FIX.md`, M-1 bis M-5, gemessen: 5 von 5
behoben), die sechs UI-Korrekturen aus Phase 12 (`12-UI-REVIEW-FIX.md`, gemessen: 6 von 6
behoben), der B-2-Sicherheitsfix (bereits committet `2c1c2ce`, informativ, automatisiert
verifiziert), der REQ-32-Nachweis (informativ, kein manueller Retest nötig, fünf Fälle
maschinell nachgewiesen) und die konkrete Oberflächenwirkung von WR-07 im `EditUserModal`
(manuell zu prüfen — unverändertes Speichern muss weiter gehen, eine echte Änderung muss
abgewiesen und auf den Stundenwechsel-Dialog verwiesen werden).

**Task 2 — Der durchführbare Sitzungsablauf.** `14-UAT-SITZUNG.md` neu angelegt: Kopf mit
Zweck und Kontrollsumme (86 + 3 zusätzliche Festlegungen 11-F1–F3 + 9 Phase-14-Punkte = 98),
sechs harte Vorbedingungen mit je einem prüfbaren Befehl (Port 3000 frei, Health-Check,
Desktop-Dev-Modus, Produktionskopie-Pfad, zwei ausdrücklich offene Nutzer-Platzhalter, frischer
`sync-dev-db`). Gruppe A (61 Punkte) in acht Blöcken ohne Kontextwechsel: Admin-Werkzeuge →
Wechsel-Dialog → Korrektur-/Löschdialog → Kontoauszug → Nutzerverwaltung → Abwesenheitsanträge
→ ein Kontrast-/Dunkelmodus-Durchgang → ein reiner Tastatur-Durchgang. Gruppe B (13 Punkte) in
D1-Reihenfolge: Migrationsstand/Bestandsdaten → Vorher/Nachher-Saldenvergleich →
Laufzeit-/Lastpunkte. Gruppe C (1 Punkt, `latest.json`) mit dem Hinweis auf ein zweites Fenster
nach Plan 14-11. Gruppe D (23 Punkte) in drei Untertabellen: bereits umgesetzte Festlegungen
zum Bestätigen/Widersprechen, offene Entscheidungsfragen, und reine Kenntnisnahme-Punkte.
Zeitschätzung je Gruppe mit sichtbarem Minutenansatz (A: 61×3min=183min, B: 13×12min=156min,
C: 1×20min=20min, D: 23×3min=69min — Gesamt A+B+D ≈ 6,8 Std., C separat nach dem Release).
Fünf Abbruchregeln, davon die geforderte „Saldoänderung bei Nutzer ohne Modellwechsel" als
erste und wichtigste. Für Punkt 48 (Playwright-E2E-Suite) explizit ein manueller Ersatzweg
dokumentiert, da Playwright in dieser Umgebung nicht installierbar ist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Interne Punktzahl-Arithmetik in der ersten Fassung von 14-UAT-SITZUNG.md
war inkonsistent**
- **Gefunden während:** Erstellung von Task 2, beim Ableiten der Zeitschätzung.
- **Problem:** Die erste Fassung zählte `14-U5` (5 Einzelbefunde) und `14-U6` (6 Einzelbefunde)
  als 5 bzw. 6 Punkte in der Gruppe-A-Punktzahl, während der Kopf der Datei gleichzeitig
  behauptete, es gäbe „9 eigene Punkte der Phase 14" — beide Zahlen konnten nicht gleichzeitig
  stimmen (70 vs. 61 als Gruppe-A-Punktzahl, 107 vs. 98 als Gesamtsumme).
- **Fix:** `14-U5`/`14-U6` zählen als je ein Sammlungspunkt (konsistent mit der „9 Punkte"-
  Aussage im Kopf und in `14-UAT-SAMMLUNG.md`); die interne Mehrfachigkeit ist als Anmerkung im
  Herleitungstext vermerkt, nicht in der Zählung verdoppelt. Gruppe A korrigiert auf 61 Punkte
  (183 min), Gesamtsumme auf 98 (86 + 3 zusätzliche Festlegungen 11-F1–F3 + 9 Phase-14-Punkte),
  Ergebnisprotokoll-Tabelle am Fuß der Datei nachgezogen.
- **Dateien:** `.planning/phases/14-absicherung-und-auslieferung/14-UAT-SITZUNG.md`
- **Commit:** enthalten in `05a8c35` (Datei wurde vor dem ersten Commit korrigiert)

## Threat Flags

Keine. Dieser Plan schreibt ausschließlich Markdown unter `.planning/`, führt keinen Befehl
gegen eine Datenbank aus und öffnet keine neue Angriffsfläche (T-14-15 aus dem Threat Model
trifft zu: kein DB-Zugriff).

## Known Stubs

Keine. Beide Vorbedingungen — die Produktionskopie unter
`server/database/14-produktionskopie.db` (Plan 14-04 zieht sie) und die zwei namentlich zu
benennenden Prüfnutzer — sind als ausdrückliche, offene Platzhalter geführt
(`<vom Anwender vor der Sitzung zu benennen>`), nicht mit erfundenen Werten gefüllt. Das ist
kein Stub im Sinne fehlender Funktionalität, sondern die vom Plan geforderte Behandlung
außerhalb dieses Plans liegender Eingaben.

## Verifikation gegen die Plan-Abnahmekriterien

- `grep -c "Prüfweg-Zuordnung aller 86 Punkte" 14-UAT-SAMMLUNG.md` → 1. ✅
- Zuordnungstabelle: für jeden der 86 Bestandspunkte genau eine Zeile, Kontrollzeile summiert
  auf 86 (A=58, B=11, C=0, D=17). ✅
- Jeder Punkt trägt genau einen Buchstaben A/B/C/D. ✅
- Alle acht Dublettenkandidaten einzeln geprüft: sechs bestätigt (davon zwei nur teilweise),
  zwei verworfen — jeweils mit Begründung. ✅
- Unter „## Phase 14 — Absicherung und Auslieferung" stehen `14-U1` bis `14-U9`. ✅
- `git diff 023657d -- 14-UAT-SAMMLUNG.md | grep '^-[^-]'` → ausschließlich die zwei Zeilen des
  ursprünglichen Platzhaltersatzes, keine Löschung in den Abschnitten der Phasen 11/12/13. ✅
  (023657d ist der Commit unmittelbar vor Beginn dieses Plans.)
- `grep -c "^| 11-U\[1-6\]" 14-UAT-SAMMLUNG.md` (korrekt ohne Backslash-Escaping:
  `grep -c "^| 11-U[1-6]"`) → 12 (6 in der Bestandstabelle + 6 in der neuen Zuordnungstabelle,
  Bestandstabelle unangetastet). ✅
- `test -f 14-UAT-SITZUNG.md && grep -c "Gruppe [ABCD]" 14-UAT-SITZUNG.md` → Datei vorhanden,
  12 Treffer. ✅
- Alle vier Gruppen tragen eine Zeitschätzung in Minuten und den zugrunde gelegten
  Minutenansatz pro Punkt. ✅
- Vorbedingungsliste enthält einen prüfbaren Befehl für „Port 3000 frei" (V1) und für den
  Health-Check (V2). ✅
- `comm -23 <(grep -o "1[1-4]-U[0-9]*" 14-UAT-SITZUNG.md | sort -u) <(grep -o "1[1-4]-U[0-9]*"
  14-UAT-SAMMLUNG.md | sort -u)` → leer, jede Kennung in der Sitzung kommt in der Sammlung vor. ✅
- Abschnitt „Abbruchregeln" vorhanden mit der geforderten Regel (Saldoänderung bei Nutzer ohne
  Modellwechsel als Regel 1). ✅
- Beide Prüfnutzer als offener Platzhalter geführt, kein erfundener Name. ✅

## Self-Check: PASSED

- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-UAT-SITZUNG.md
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md (Abschnitt
  „Prüfweg-Zuordnung aller 86 Punkte (Plan 14-03)" vorhanden, siehe grep oben)
- FOUND commit 8861d11 (docs(14-03): Praefweg-Zuordnung aller 86 UAT-Punkte anhaengen)
- FOUND commit 05a8c35 (docs(14-03): durchfuehrbaren Abnahmesitzungsablauf anlegen)
- Append-only-Nachweis erneut ausgeführt gegen den Vor-Plan-Commit `023657d`: nur die zwei
  Platzhalterzeilen als Löschung, keine sonstige Veränderung.

---
*Phase: 14-absicherung-und-auslieferung*
*Completed: 2026-08-23*
