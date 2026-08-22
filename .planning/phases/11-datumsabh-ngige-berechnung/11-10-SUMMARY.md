---
phase: 11-datumsabh-ngige-berechnung
plan: 10
subsystem: testing
tags: [overtime, work-periods, sqlite, better-sqlite3, tsx, verification, nullwirkung]

# Dependency graph
requires:
  - phase: 11-datumsabh-ngige-berechnung (Pläne 11-01 bis 11-09, 11-11)
    provides: periodenbewusste Sollstunden-Berechnung, WorkPeriodContext, Modellwechsel-Fixture (seedModelChangeUser.ts), Snapshot A (11-nullwirkung.db)
provides:
  - unabhängiges, falsifizierbares Prüfwerkzeug für periodengetreue Sollstunden auf der GESAMTEN Population (verifyPeriodNullEffect.ts), einschließlich soft-gelöschter Nutzer, die der kanonische Lesepfad nicht auflöst
  - Snapshot B nach dem Umbau (11-SNAPSHOT-NACHHER.json), byte-identisch mit Snapshot A
  - abschließender Nullwirkungs- und Wirkungsnachweis der Phase 11 mit Urteilstabelle über alle vier ROADMAP-Erfolgskriterien (11-WIRKUNGSNACHWEIS.md)
affects: [12-stundenwechsel-bedienen, 14-absicherung-auslieferung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zweite, unabhängige Gegenrechnung im Validierungsskript ausgeschrieben statt aus workingDays.ts importiert — dieselbe Begründung wie validateOvertimeCalculation.ts (09-INVENTAR-SOLLSTUNDEN.md): eine echte Nachrechnung, kein Vergleich einer Zahl mit sich selbst"
    - "Falsifizierbarkeitsprobe als Pflichtschritt vor jedem Nullwirkungs-Claim: ein Werkzeug, das nicht fehlschlagen kann, ist kein Beweis (--erwarte-abweichung als expliziter Erwartungswert)"
    - "SHA-256 vor/nach als Unversehrtheitsbeleg eines Lese-Werkzeugs, ergänzend zu Dateigröße/Zeitstempel"

key-files:
  created:
    - server/src/scripts/verifyPeriodNullEffect.ts
    - .planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-NACHHER.json
    - .planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-NACHHER.users.json
    - .planning/phases/11-datumsabh-ngige-berechnung/11-WIRKUNGSNACHWEIS.md
  modified:
    - server/package.json

key-decisions:
  - "Unversehrtheitsprüfung der fünf Kennzahlen aus 11-AUSGANGSZUSTAND.md lief VOR jeder Messung (Plan-Vorgabe) — alle fünf stimmten überein, kein Abbruch nötig"
  - "Kontrollnutzer für die REQ-25-Gegenprobe ist userId 3 (Bestandsnutzerin mit individuellem Wochenplan), nicht userId 1 (System-Administrator mit weeklyHours=0) — realistischerer Regelfall statt trivialem 0h-Fall"
  - "11-WIRKUNGSNACHWEIS.md wurde als ein zusammenhängendes Dokument über alle drei Tasks committet (dritter Commit), weil die Urteilstabelle in Task 3 auf Task-1/2-Inhalten desselben Dokuments aufbaut und ein Teil-Commit den Bezug zerrissen hätte"

# Metrics
metrics:
  duration: "~70 Minuten"
  completed: "2026-08-22"
---

# Phase 11 Plan 10: Nullwirkungs- und Wirkungsnachweis (D5, D6, REQ-25) Summary

Abschließendes Prüfwerkzeug `verifyPeriodNullEffect.ts` (Tag-für-Tag-Gegenrechnung, unabhängig
vom kanonischen Lesepfad) plus `11-WIRKUNGSNACHWEIS.md` belegen alle vier ROADMAP-
Erfolgskriterien der Phase 11 mit Fundstelle — inklusive der zwei soft-gelöschten Nutzer, die
ein reiner Byte-Vergleich nicht erfasst hätte.

## Was wurde gebaut

**Task 1 — Der Nutzer mit Modellwechsel und die Tag-für-Tag-Gegenrechnung.**
`server/src/scripts/verifyPeriodNullEffect.ts` (npm-Skript `verify:period-nulleffect`) liest
`users` ungefiltert und vergleicht für jeden Nutzer, Tag für Tag von `hireDate` bis `--asOf`,
`getDailyTargetHours()` (periodengetreu, NEU) gegen eine im Skript selbst ausgeschriebene
Regel vor dem Umbau (ALT, liest ausschließlich die heutigen flachen `users`-Spalten). Die
Gegenrechnung importiert nichts aus der Datei mit `getDailyTargetHours` (`grep -c
"workingDays"` → genau 1 Treffer, der NEU-Import). Rein lesend (0 Treffer für
`toISOString|INSERT|UPDATE|DELETE|.run(`), `assertNotProduction()` synchron vor jedem
datenbankziehenden Import, `DATABASE_PATH` Pflicht.

**Falsifizierbarkeitsprobe (T-11-39):** Gegen `11-modellwechsel.db` meldet das Werkzeug GENAU
den Nutzer aus `seed:model-change` (userId 12291) als abweichend — 31 abweichende Werktage ab
dem Stichtag, ALT=8h (heutige 40h-Stammdaten) vs. NEU=4h (ab Stichtag gültige 20h-Periode).
Ohne `--erwarte-abweichung` endet derselbe Lauf mit Exit 1 (`Übereinstimmung: nein`) — das
Werkzeug kann also tatsächlich fehlschlagen.

**Erfolgskriterium 1:** Tagestabelle für 2026-05-09 bis 2026-05-19 in `11-WIRKUNGSNACHWEIS.md`
zeigt den Stichtag (2026-05-14) bereits in der NEUEN Periode (halboffenes Intervall, D1),
8h vor dem Stichtag vs. 4h danach, beide Wochenenden mit 0h aus beiden Perioden,
`checkPeriodChain(12291): {"ok":true,"findings":[]}`.

**Task 2 — Nullwirkung auf der echten Population.** Schritt 1 prüfte alle fünf Kennzahlen aus
`11-AUSGANGSZUSTAND.md` gegen `11-nullwirkung.db` VOR jeder Messung — alle fünf stimmten
überein, kein Abbruch. Snapshot B (`11-SNAPSHOT-NACHHER.json`, `--asOf=2026-08-20`, `--all`,
identisch zu Plan 11-01 bis auf den Zielpfad) ist byte-identisch mit Snapshot A (`cmp` →
IDENTISCH, 44785 Bytes, 20 Nutzer). Für die zwei soft-gelöschten Nutzer (userId 15, 26, die
der kanonische Lesepfad mit "User <id> not found" abweist) schließt
`verify:period-nulleffect` gegen `11-nullwirkung.db` das Loch: 0 Abweichungen bei allen 20
Nutzern (232 bzw. 176 geprüfte Tage für die beiden soft-gelöschten), SHA-256 der Datenbank vor
und nach dem Lauf identisch (`34f5d37e...8855e`).

**Task 3 — REQ-25 und Urteilstabelle.** `validate:overtime:detailed` gegen den
Modellwechsel-Nutzer in drei Monaten (Vormonat 2026-04, Stichtagsmonat 2026-05, Folgemonat
2026-06) meldet in allen drei Läufen `PASSED`, keine Abweichung. Gegenprobe auf Bestandsnutzer
userId 3 (individueller Wochenplan, kein Modellwechsel) ebenfalls `PASSED`. Urteilstabelle mit
allen vier ROADMAP-Erfolgskriterien im Wortlaut, je mit Urteil `erfüllt` und Fundstelle.

## Abschlusszahlen (Plan-Vorgabe, Schritt 4)

- **`11-nullwirkung.db` unverändert:** SHA-256 vor/nach identisch, Dateigröße 1306624 Bytes,
  Zeitstempel 2026-08-22 07:01 — über den gesamten Plan hinweg nicht berührt.
- **Testsuite:** 370/373, genau die drei vorbestehenden roten Tests aus
  `11-AUSGANGSZUSTAND.md` (unverändert gegenüber `11-IDEMPOTENZ-NACHWEIS.md` Schritt 8) — kein
  neuer roter Test durch diesen Plan. `npx tsc --noEmit`: 0 Fehler.
- **Abgehakte Checklistenzeilen:** `11-AUFRUFER-CHECKLISTE.md` ist seit Plan 11-09
  vollständig zusammengeführt und verifiziert (nicht Gegenstand dieses Plans erneut geprüft).
- **Blockierende Befunde: keine.** Phase 11 ist inhaltlich abgeschlossen — alle vier
  ROADMAP-Erfolgskriterien tragen ein Urteil `erfüllt` mit Fundstelle.

## Deviations from Plan

None — plan exactly as written. Die Unversehrtheitsprüfung in Task 2, Schritt 1 (die laut Plan
bei Abweichung zum blockierenden Abbruch geführt hätte) bestätigte alle fünf Kennzahlen
unverändert; kein Abbruchfall trat ein.

## Known Stubs

None.

## Threat Flags

None — alle Threat-IDs des Plans (T-11-37 bis T-11-42, T-11-SC) sind durch die im Plan
vorgesehenen Mitigations abgedeckt (rein lesendes Werkzeug, SHA-256-Kontrolle,
Falsifizierbarkeitsprobe, benannte soft-gelöschte Nutzer, keine Paketinstallation in diesem
Plan).

## Self-Check: PASSED

- FOUND: server/src/scripts/verifyPeriodNullEffect.ts
- FOUND: .planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-NACHHER.json
- FOUND: .planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-NACHHER.users.json
- FOUND: .planning/phases/11-datumsabh-ngige-berechnung/11-WIRKUNGSNACHWEIS.md
- FOUND commit 863c976 (feat(11-10): Tag-für-Tag-Gegenrechnung als unabhängiges Prüfwerkzeug)
- FOUND commit 3c18fd3 (docs(11-10): Snapshot B nach dem Umbau ziehen)
- FOUND commit 4fb2ddc (docs(11-10): Nullwirkungs- und Wirkungsnachweis mit Urteilstabelle)
