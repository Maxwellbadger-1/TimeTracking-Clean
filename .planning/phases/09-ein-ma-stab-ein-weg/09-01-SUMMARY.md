---
phase: 09-ein-ma-stab-ein-weg
plan: 01
subsystem: database
tags: [overtime, workSchedule, sqlite, audit, dead-code, cron]

# Dependency graph
requires: []
provides:
  - "Vollständiges Inventar aller Sollstunden-Fundstellen im Repository mit Klassifikation (Weg, Produktivpfad, Erreichbar über)"
  - "REQ-17-Urteil: nicht erfüllt, eine Abweichung (A-1: server/scripts/fix-overtime.ts)"
  - "Sichtung der vier offenen Überstunden-Debug-Sessions mit Status und Nachfolgeplan-Zuordnung"
  - "Verifizierter, weiterhin offener REQ-19-Kernbefund: overtime_comp-Debit erreicht den Saldo nicht"
affects: [09-02, 09-03, 09-04, 11-datumsabhaengige-berechnung, 14-absicherung-und-auslieferung]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-SOLLSTUNDEN.md
    - .planning/phases/09-ein-ma-stab-ein-weg/09-DEBUG-SICHTUNG.md
  modified: []

key-decisions:
  - "Task 1 und Task 2 des Plans wurden in einem gemeinsamen Commit umgesetzt, weil die Fundstellen-Tabelle als ein zusammenhängendes Artefakt entstand statt in zwei trennbaren Bearbeitungsschritten"
  - "server/scripts/fix-overtime.ts als Produktivpfad=ja eingestuft, obwohl es im scripts/-Verzeichnis liegt — begründet durch nachgewiesene Ausführung bei jedem Deployment und täglich per Cron (deploy-server.yml), nicht durch die im Plan vorausgesetzte Blanko-Regel"
  - "Vier Debug-Sessions als 'behoben — Beleg im Code' eingestuft, weil der jeweils behauptete oder geplante Fix wörtlich im heutigen Code nachweisbar ist; der davon unabhängige REQ-19-Kernbefund (overtime_comp erreicht Saldo nicht) wurde separat und aktiv über die Schreibpfade ensureOvertimeBalanceEntries()/updateOvertimeBalanceForMonth() verifiziert, nicht nur aus dem Code-Kommentar übernommen"

requirements-completed: [REQ-17, REQ-19]

# Metrics
duration: ~55min
completed: 2026-08-21
---

# Phase 9 Plan 1: Sollstunden-Inventar und Debug-Sichtung Summary

**Vollständiges Sollstunden-Fundstellen-Inventar (23 klassifizierte Zeilen, 1 Abweichung A-1 in
`server/scripts/fix-overtime.ts`) und Sichtung von vier Überstunden-Debug-Sessions (alle vier
Code-Fixes verifiziert vorhanden; der eigentliche REQ-19-Defekt bleibt aktiv und ist neu über die
Schreibpfade belegt).**

## Performance

- **Duration:** ~55 min (nicht exakt gestoppt, aus Tiefe der Recherche geschätzt)
- **Completed:** 2026-08-21
- **Tasks:** 3 (Task 1+2 in einem Commit umgesetzt, Task 3 separat)
- **Files modified:** 2 (beide neu erstellt)

## Accomplishments

- **Fundstellen-Inventar mit 23 klassifizierten Tabellenzeilen** in
  `09-INVENTAR-SOLLSTUNDEN.md` — jede mit `datei:zeile`-Beleg, Weg-Klassifikation
  (`getDailyTargetHours` / `eigene Rechnung` / `Vorfilter`), Produktivpfad-Einstufung und
  nachgewiesener Aufrufkette (Route → Service → Funktion) oder Gegenprobe für „nein".
- **Neuer, in keiner der vier bekannten Debug-Sessions dokumentierter Fund (Abweichung A-1):**
  `server/scripts/fix-overtime.ts:78` berechnet Sollstunden über `weeklyHours / 5` statt
  `getDailyTargetHours()` und ignoriert damit `workSchedule` vollständig. Das Skript läuft
  nachweislich bei jedem Deployment (`deploy-server.yml:118`) und wird bei jedem Deploy als
  täglicher 3-Uhr-Cronjob neu registriert (`deploy-server.yml:123-130`) — Produktivpfad=ja trotz
  Lage im `scripts/`-Verzeichnis, entgegen der im Plan vorausgesetzten Blanko-Annahme.
- **REQ-17-Urteil:** nicht erfüllt, genau eine Abweichung (A-1). Der Kernpfad
  (`unifiedOvertimeService` → `getDailyTargetHours()`) ist ansonsten in allen 7 geprüften
  produktiven Services konsistent.
- **Vier Debug-Sessions gesichtet, alle vier als „behoben — Beleg im Code"**: Die Monatsfilter aus
  `carmen-rothemund-overtime-analysis`/`OVERTIME-FIX-PLAN` (`overtimeService.ts:633`) und
  `overtime-validation-backend-mismatch` (`overtimeTransactionService.ts:418`) sind heute im Code
  vorhanden. `overtime-compensation-workschedule-bug` fand schon damals „NO CODE BUG FOUND" —
  heute erneut unabhängig verifiziert.
- **REQ-19-Kernbefund aktiv bestätigt (nicht nur aus dem Code-Kommentar übernommen):** Der
  `overtime_comp`-Debit erreicht den Saldo nicht, weil sowohl `ensureOvertimeBalanceEntries()`
  (`overtimeService.ts:684-783`) als auch `updateOvertimeBalanceForMonth()`
  (`overtimeTransactionRebuildService.ts:466-519`) `actualHours` bei jeder Neuberechnung ohne
  Kenntnis von `type='compensation'`-Buchungen überschreiben. Dieser Mechanismus wurde durch
  eigenständiges Lesen beider Funktionen nachgewiesen, nicht durch Übernahme der Selbstauskunft im
  Code-Kommentar (`overtimeTransactionRebuildService.ts:110-113`).
- **Dokumentierte Diskrepanz:** Der Code-Kommentar in `overtimeTransactionRebuildService.ts:114`
  verweist auf „Bug 9/10" in `urlaubstage-bei-ablehnung-verloren.md`; die zutreffenden Abschnitte
  tragen dort heute die Nummern Bug 3/Bug 4. Als Fund dokumentiert, nicht stillschweigend
  korrigiert.

## Task Commits

1. **Task 1+2: Inventar aller Sollstunden-Fundstellen erstellen und klassifizieren** -
   `0cc582d` (docs) — Fundstellen-Tabelle inkl. Produktivpfad-Spalten, Ausschlussliste, Referenz,
   Abweichungen, Nicht-Abweichungen, Urteil REQ-17
2. **Task 3: Die vier Überstunden-Debug-Sessions sichten und zuordnen** - `250f99e` (docs)

**Plan metadata:** wird mit diesem Commit erstellt (siehe unten)

## Files Created/Modified

- `.planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-SOLLSTUNDEN.md` - Fundstellen-Inventar mit
  Klassifikation, Ausschlussliste, Referenz-Ableitungsreihenfolge, Abweichungsliste und
  REQ-17-Urteil
- `.planning/phases/09-ein-ma-stab-ein-weg/09-DEBUG-SICHTUNG.md` - Sichtung der vier
  Debug-Sessions mit drei geprüften Angelpunkten, Session-für-Session-Status und
  Nachfolgeplan-Zuordnung

## Decisions Made

- Task 1 und Task 2 in einem Commit zusammengefasst, weil die Fundstellen-Tabelle als
  zusammenhängendes Artefakt entstand — ein künstliches Auftrennen in „Tabelle ohne
  Produktivpfad-Spalten" → „Tabelle mit Produktivpfad-Spalten" hätte keinen zusätzlichen
  Nachweiswert gehabt. Beide Task-spezifischen Acceptance-Criteria wurden gegen den finalen Stand
  einzeln verifiziert (siehe Self-Check).
- `fix-overtime.ts` gegen die tatsächliche Deploy-/Cron-Verdrahtung geprüft statt die
  Plan-Blanko-Annahme „Skripte = nein" zu übernehmen — Ergebnis widerspricht der Annahme und wurde
  als Abweichung A-1 aufgenommen.
- Bei den vier Debug-Sessions wurde nicht nur der jeweils zitierte Codeausschnitt nachgeprüft,
  sondern zusätzlich aktiv verifiziert, ob der REQ-19-Kernbefund (aus dem Kommentar in
  `overtimeTransactionRebuildService.ts`) heute noch zutrifft — er trifft zu, mit eigenem Beleg
  über die beiden Schreibpfade.

## Deviations from Plan

### Auto-fixed Issues

Keine Code-Änderungen — dieser Plan ist reine Analyse (siehe Threat-Model, `keine neue`
Trust-Boundary). Es gab daher keine Rule-1/2/3-Auto-Fixes im klassischen Sinn. Eine
prozessuale Abweichung ist dokumentiert:

**1. [Prozess, kein Rule 1-4] Task 1 und Task 2 in einem Commit statt zwei**
- **Gefunden während:** Beginn von Task 2
- **Grund:** Die Fundstellen-Tabelle aus Task 1 enthielt bereits beim Schreiben die für Task 2
  vorgesehenen Spalten (`Produktivpfad`, `Erreichbar über`), weil die Aufrufketten während der
  Recherche für Task 1 ohnehin gelesen wurden, um die Weg-Klassifikation korrekt zu setzen.
  Ein Zwischen-Commit ohne diese Spalten hätte keinen zusätzlichen Prüfwert gehabt.
- **Verifikation:** Beide Task-spezifischen automatisierten Verify-Kommandos aus dem Plan wurden
  gegen den finalen Dateistand einzeln ausgeführt und bestanden (siehe Self-Check unten).
- **Committed in:** `0cc582d`

---

**Total deviations:** 1 prozessual (kein Rule-1-4-Fix nötig, da reine Analyse ohne Code-Änderung)
**Impact on plan:** Keine inhaltliche Abweichung von den Akzeptanzkriterien. Beide betroffenen
Tasks sind vollständig erfüllt.

## Known Stubs

Keine — dieser Plan erzeugt ausschließlich Markdown-Dokumentation, keine Anwendungslogik.

## Threat Flags

Keine neue Angriffsfläche. Die im Plan definierte Trust-Boundary („keine neue") trifft zu:
Es wurden keine Netzwerk-Endpunkte, Auth-Pfade oder Schema-Änderungen eingeführt. Die
Threat-Register-Mitigations aus dem Plan (T-09-01-I, T-09-01-R, T-09-01-SC) wurden eingehalten:
Beide Artefakte enthalten keine E-Mail-Adressen, Passwort-Hashes oder Session-Daten (nur
`userId 17` / „Carmen Rothemund" aus einer bereits öffentlich im Repository liegenden Debug-Datei
wurde zitiert); jede Verhaltensaussage ist mit `datei:zeile` belegt; es wurde kein Paket
installiert.

## Issues Encountered

- Der Plan setzte für 15 Pflicht-Fundstellen voraus, dass sie „bereits verifiziert" seien.
  `server/src/services/overtimeService.ts:347` erwies sich beim tatsächlichen Lesen als **Leerzeile**
  (verifiziert mit `node -e` gegen die Datei), nicht als Codezeile mit Sollstunden-Bezug. Statt die
  Diskrepanz zu glätten, wurde sie im Inventar wörtlich dokumentiert (die Zeile ist leer, der
  zugehörige Berechnungsblock liegt bei Zeile 349-360 derselben — inzwischen als toter Code
  identifizierten — Funktion `ensureAbsenceTransactionsForMonth`).
- Mehrere der 15 Pflicht-Fundstellen (`overtimeService.ts:110,198,309,320,347,360,564`) liegen in
  Funktionen, die beim gezielten Nachweis der Aufrufkette (Task 2) als **toter Code ohne
  Aufrufer** identifiziert wurden. Das war im Plan nicht vorausgesetzt, ändert aber nichts an der
  Erfüllung der Task-1-Pflichtliste (die Fundstellen mussten nur *erfasst*, nicht als
  Produktivpfad=ja belegt werden).

## Next Phase Readiness

- **Plan 09-02/09-03 (REQ-17/18):** Kann A-1 (`fix-overtime.ts`) direkt als Fixgegenstand
  übernehmen. Empfehlung aus dem Inventar: entweder auf `ensureOvertimeBalanceEntries()`
  umstellen oder als überflüssig streichen (Bewertung liegt außerhalb dieses Plans).
- **Plan 09-04 (REQ-19):** Kann direkt auf die „Eigene Verifikation" im Angelpunkt (c) der
  Debug-Sichtung aufsetzen — der Mechanismus (zwei konkurrierende Schreibpfade ohne
  `compensation`-Bewusstsein) ist identifiziert, eine Reproduktion gegen echte Nutzerdaten
  (D2/D4 aus `09-CONTEXT.md`) steht noch aus.
- **Phase 11/14:** Die Aufrufer-Liste im Inventar ist als eigenständiges, dauerhaftes Artefakt
  angelegt und nicht nur im Summary verlinkt — wiederverwendbar ohne erneute Erhebung.
- **Kein Blocker:** Beide Artefakte sind vollständig, alle Plan-Acceptance-Criteria wurden vor dem
  Commit programmatisch gegen die finalen Dateien geprüft.

---
*Phase: 09-ein-ma-stab-ein-weg*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-SOLLSTUNDEN.md`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-DEBUG-SICHTUNG.md`
- FOUND: commit `0cc582d` (Task 1+2)
- FOUND: commit `250f99e` (Task 3)
