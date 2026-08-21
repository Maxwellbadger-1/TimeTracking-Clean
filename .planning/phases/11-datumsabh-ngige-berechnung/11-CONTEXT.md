# Phase 11: Datumsabhängige Berechnung - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Auto-generated (discuss übersprungen, Empfehlungen des Orchestrators gesetzt)

<domain>
## Phase Boundary

Die Sollstunden eines Tages kommen aus der Periode, die an diesem Tag galt.

**Im Umfang:**
- `getDailyTargetHours(user, datum)` löst über die Periode auf statt über den aktuellen
  Stammdatensatz
- Entscheidung und Umsetzung: Perioden vorladen oder je Aufruf nachschlagen
- Alle Aufrufer nachziehen (Services, Validierungsskripte, Desktop-Anzeigen)
- `scripts/validateOvertimeDetailed.ts` prüft gegen den periodengültigen Maßstab
- Rebuild-Wege (`overtimeTransactionRebuildService`, `refreshOvertimeBalances`)
  periodenbewusst machen

**Requirements:** REQ-23, REQ-24, REQ-25

**Nicht im Umfang:**
- Keine Oberfläche und keine API zum Eintragen von Wechseln — das ist Phase 12
- Kein Produktionslauf — Generalprobe ist Phase 14
- Kein Entfernen von `users.weeklyHours`/`users.workSchedule`

</domain>

<decisions>
## Implementation Decisions

### Entschieden (Empfehlung des Orchestrators, vom Anwender pauschal autorisiert)

**D1 — Perioden vorladen, nicht je Aufruf nachschlagen.**
(Das ist die in REQUIREMENTS.md „Offene Fragen" Nr. 1 ausdrücklich hierher verwiesene
Entscheidung.) Umsetzung: ein expliziter Perioden-Cache je Nutzer, der beim Eintritt in
eine Berechnung einmal gefüllt und danach in-memory aufgelöst wird. Grund: Der kritische
Fall sind Tagesschleifen über ein ganzes Jahr — 365 zusätzliche DB-Zugriffe pro Nutzer
pro Rebuild sind bei mehreren Nutzern nicht vertretbar. Ein Nutzer hat typischerweise
ein bis drei Perioden; die Liste ist winzig.

**D2 — Cache-Lebensdauer: explizit übergeben, nicht global.**
Kein prozessweiter Singleton-Cache und kein modul-globales `Map`, das über Requests
hinweg lebt — sonst liefert eine Berechnung nach einem Perioden-Update stille
Altwerte. Der Cache wird als Parameter/Kontextobjekt durch die Berechnung gereicht und
lebt nur für den einen Berechnungslauf. Aufrufer ohne Cache bekommen einen Fallback,
der direkt nachschlägt — dann ist die Semantik gleich, nur langsamer.

**D3 — Signatur ändern, nicht raten.**
`getDailyTargetHours()` bekommt die Perioden (oder den Cache) explizit übergeben, statt
sie sich intern zu holen. Grund: Die Zero-Hallucination-Policy des Projekts verlangt
nachvollziehbare Datenflüsse; ein versteckter DB-Zugriff in einer Utility-Funktion, die
in Tagesschleifen läuft, ist genau die Sorte Nebenwirkung, die später niemand findet.
Ein Compiler-Fehler an jeder Aufrufstelle ist hier ein Feature — er beweist, dass alle
Aufrufer nachgezogen wurden (REQ-23).

**D4 — Fallback bei fehlender Periode ist ein Fehler, kein stiller Rückfall.**
Findet die Auflösung für ein Datum keine gültige Periode, wird geloggt und mit einem
klaren Fehler abgebrochen — kein stilles Zurückfallen auf `users.weeklyHours`. Nach der
Migration aus Phase 10 hat jeder Nutzer eine lückenlose Periodenkette ab `hireDate`;
eine fehlende Periode ist ein Datendefekt und muss auffallen. Ausnahme: Daten *vor*
`hireDate` liefern wie bisher 0 Sollstunden.

**D5 — Nullwirkungs-Nachweis ist Abnahmebedingung, kein Nebenprodukt.**
Vor und nach dem Umbau wird auf einer Kopie der Produktionsdatenbank derselbe
Salden-Snapshot gezogen (Werkzeug aus Phase 10, D6) und verglichen. Für Nutzer ohne
Modellwechsel muss die Differenz exakt null sein. Ein zweifach ausgeführter Rebuild muss
identische Ergebnisse liefern (REQ-24) — das wird als wiederholbarer Test abgelegt, nicht
einmalig von Hand geprüft.

**D6 — Testnutzer mit Modellwechsel wird künstlich angelegt, lokal.**
Für REQ-24/REQ-25 braucht es einen Nutzer mit echtem Modellwechsel. Der wird als
Testfixture auf der lokalen Kopie erzeugt (nicht in Produktion), mit Stichtag mitten im
Monat, damit der Randfall gleich mitgeprüft ist.

**D7 — Legacy-Pfad zieht mit.**
Was in Phase 9 auf `getDailyTargetHours()` angeglichen wurde, wird hier automatisch
periodenbewusst. Es wird ausdrücklich geprüft, dass kein Aufrufer aus dem
`overtimeService.ts`-Pfad an der neuen Signatur vorbei rechnet.

### Claude's Discretion
Form des Cache-Objekts, genaue Modulgrenzen, Testframework-Details und Skriptnamen
liegen im Ermessen der Planung.

</decisions>

<code_context>
## Existing Code Insights

- `server/src/utils/workingDays.ts:63` — `getDailyTargetHours(user, datum)`. Bekommt das
  Datum schon, löst aber aus dem heutigen User-Objekt auf. Macht in Zeile 67 bereits
  einen DB-Zugriff für `holidays` — ein zweiter Lookup wäre architektonisch konsistent,
  in Tagesschleifen aber teuer (genau der Grund für D1).
- Reihenfolge laut `.claude/CLAUDE.md`: `workSchedule` schlägt `weeklyHours`; ein
  Feiertag überschreibt `workSchedule` auf 0h; unbezahlter Urlaub reduziert das Soll
  ohne Ist-Gutschrift. Diese Reihenfolge darf sich durch den Umbau nicht verschieben.
- `toISOString().split('T')[0]` ist im Projekt verboten (Timezone-Bug) — stattdessen
  `formatDate(date, 'yyyy-MM-dd')`. Bei Stichtagsvergleichen besonders relevant.
- Betroffene Aufrufer laut ROADMAP: 7 Services, 3 Validierungsskripte, Desktop-Anzeigen.
  Die genaue Liste stammt aus dem Inventar der Phase 9 — dort nachschlagen statt neu
  suchen.
- `overtimeTransactionRebuildService`, `refreshOvertimeBalances`,
  `recalculateOvertimeBalances` sind die Rebuild-Wege.
- `scripts/validateOvertimeDetailed.ts` = `npm run validate:overtime:detailed`.

</code_context>

<specifics>
## Specific Ideas

- Die Aufrufer-Liste aus dem Phase-9-Inventar als Checkliste im Plan führen, damit
  „alle Aufrufer nachgezogen" belegbar statt behauptet ist.
- Die Idempotenz des Rebuilds (REQ-24) als Test formulieren: zweimal laufen lassen,
  Ergebnisse byteweise vergleichen.

</specifics>

<deferred>
## Deferred Ideas

- Performance-Optimierung über den Cache hinaus (Batch-Laden für mehrere Nutzer) — erst
  wenn ein konkreter Engpass gemessen ist
- Human-Verifikation / UAT dieser Phase — auf Anweisung des Anwenders ans Ende des
  Milestones gestellt

</deferred>
