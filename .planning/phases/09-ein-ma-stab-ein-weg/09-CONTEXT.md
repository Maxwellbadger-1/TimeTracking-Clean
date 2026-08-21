# Phase 9: Ein Maßstab, ein Weg - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Auto-generated (discuss übersprungen, Empfehlungen des Orchestrators gesetzt)

<domain>
## Phase Boundary

Vor dem ersten Umbau steht fest, dass alle Überstundenzahlen aus derselben Quelle kommen.
Kein Fundament mit Riss.

**Im Umfang:**
- Inventar aller Stellen, die Soll-Arbeitszeit berechnen; jede läuft über
  `getDailyTargetHours()` (`server/src/utils/workingDays.ts:63`)
- Legacy-Pfad `overtimeService.ts` (monatliche Aggregation über `overtime_balance`)
  auf dieselbe Sollstunden-Auflösung setzen wie `unifiedOvertimeService.ts`
- Den bekannten Defekt „Überstundenausgleich (`overtime_comp`) erreicht den Saldo nicht"
  verifizieren, beheben oder als bewusst offen dokumentieren
- Die vier offenen Überstunden-Debug-Sessions sichten und zuordnen

**Requirements:** REQ-17, REQ-18, REQ-19

**Nicht im Umfang:**
- Vollständiger Rückbau des Legacy-Überstundensystems (eigener Milestone, siehe
  REQUIREMENTS.md „Out of Scope")
- Alles, was Perioden voraussetzt — das beginnt erst in Phase 10
- Datenmodell-Änderungen an `users`

</domain>

<decisions>
## Implementation Decisions

### Entschieden (Empfehlung des Orchestrators, vom Anwender pauschal autorisiert)

**D1 — REQ-18: Angleichen, nicht stilllegen.**
`overtimeService.ts` bleibt bestehen und schreibt weiter `overtime_balance`, aber seine
Sollstunden-Auflösung wird nachweislich auf `getDailyTargetHours()` gezogen. Grund: Der
vollständige Rückbau ist in REQUIREMENTS.md ausdrücklich out of scope; Ziel ist ein
gemeinsamer Maßstab, nicht das Entfernen von Altstrukturen. Stilllegen würde alle
Aufrufer (Dashboard, Berichte, Cronjobs) in einer Phase mitreißen, die eigentlich nur
das Fundament absichern soll.

**D2 — REQ-19: Erst reproduzieren, dann entscheiden.**
Der `overtime_comp`-Defekt wird zuerst mit einem Reproduktionsnachweis gegen eine Kopie
der Produktionsdatenbank belegt (konkreter Nutzer, konkreter Monat, erwarteter vs.
tatsächlicher Saldo). Fällt der Fix in den Rahmen dieser Phase (Änderung in ein bis zwei
Services, ohne Datenmigration), wird er hier behoben. Erweist er sich als größer
(Datenkorrektur an Bestandsbuchungen nötig), wird er dokumentiert und als eigene Phase
9.1 in die ROADMAP eingefügt, statt Phase 9 aufzublähen.

**D3 — Nachweis statt Behauptung.**
REQ-17/18 gelten erst als erfüllt, wenn ein ausführbarer Vergleich existiert: Ein Skript
oder Test, das für dieselben Nutzer/Monate den Dashboard-Wert und den Berichts-Wert
gegenüberstellt und bei Abweichung fehlschlägt. Ein Code-Review allein reicht nicht —
die Zero-Hallucination-Policy in `.claude/CLAUDE.md` verlangt den exakten Vergleich.

**D4 — Prüfumfang: mindestens drei reale Nutzer.**
Auswahl nach Vielfalt der Stammdaten: ein Nutzer mit `workSchedule`, einer nur mit
`weeklyHours`, einer mit genehmigtem `overtime_comp`-Antrag. Erfolgskriterium der
ROADMAP verlangt drei; mehr ist willkommen, weniger nicht.

**D5 — Kein Produktionsschreibzugriff in dieser Phase.**
Phase 9 arbeitet lesend gegen Produktion (bzw. gegen eine per `npm run sync-dev-db`
gezogene Kopie). Code-Fixes gehen den normalen Weg über `git push origin main`.
Datenkorrekturen sind hier nicht vorgesehen; falls nötig, gehören sie in Phase 14.

### Claude's Discretion
Alle übrigen Implementierungsentscheidungen (Dateiaufteilung, Testform, genaue
Skriptnamen) liegen im Ermessen der Planung — Leitplanken sind die Konventionen des
Codebestands und `.claude/CLAUDE.md`.

</decisions>

<code_context>
## Existing Code Insights

- `server/src/utils/workingDays.ts:63` — `getDailyTargetHours(user, datum)`: bekommt das
  Datum, löst aber aus dem heutigen User-Objekt auf. Macht bereits einen DB-Zugriff für
  `holidays` (Zeile 67).
- `server/src/services/overtimeService.ts` — Legacy, monatliche Aggregation über
  `overtime_balance`. Ist laut `.claude/CLAUDE.md` einer von zwei unabhängigen
  Berechnungswegen („Dual Calculation System").
- `server/src/services/unifiedOvertimeService.ts` — der vorgesehene gemeinsame Weg.
- `scripts/validateOvertimeDetailed.ts` — `npm run validate:overtime:detailed`,
  bestehendes Vergleichswerkzeug. Naheliegender Ort für den Nachweis aus D3.
- Offene Debug-Sessions in `.planning/debug/`, alle vier zu sichten:
  `carmen-rothemund-overtime-analysis`, `overtime-compensation-workschedule-bug`,
  `overtime-validation-backend-mismatch`, `OVERTIME-FIX-PLAN`.
- `.claude/CLAUDE.md` → „Überstunden-Berechnung" nennt die Fallstricke:
  `workSchedule` schlägt `weeklyHours`; Feiertag überschreibt `workSchedule` auf 0h;
  unbezahlter Urlaub reduziert Soll ohne Ist-Gutschrift; `toISOString()` verursacht
  Timezone-Bugs, stattdessen `formatDate()`.
- Produktionsskripte MÜSSEN `DATABASE_PATH` explizit setzen — Symlink auf dem Server
  existiert seit 20.08.2026 nicht mehr.

</code_context>

<specifics>
## Specific Ideas

- Das Inventar aus REQ-17 als dauerhaftes Artefakt ablegen (nicht nur im SUMMARY), damit
  die Phasen 11 und 14 die Aufrufer-Liste wiederverwenden können.
- Den Vergleichsnachweis aus D3 so bauen, dass Phase 11 ihn erneut laufen lassen kann,
  um „Salden unverändert für Nutzer ohne Modellwechsel" zu belegen.

</specifics>

<deferred>
## Deferred Ideas

- Vollständiger Legacy-Rückbau — eigener Milestone (REQUIREMENTS.md, Out of Scope)
- `unpaid-leave-logic-issues` und `notifications-position-column-missing` — offene
  Debug-Sessions ohne Bezug zu diesem Milestone
- Human-Verifikation / UAT dieser Phase — auf Anweisung des Anwenders ans Ende des
  Milestones gestellt, nicht phasenweise

</deferred>
