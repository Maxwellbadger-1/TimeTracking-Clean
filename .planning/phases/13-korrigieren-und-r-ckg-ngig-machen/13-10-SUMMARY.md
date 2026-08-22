---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 10
subsystem: desktop
tags: [react, typescript, kontoauszug, storno, accessibility, http-client]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 06)
    provides: "id/reversalOf/reversedBy/reversedAt/reversedByName und die gemeinsame referenceId auf GET /api/overtime/transactions/live"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 07)
    provides: "OvertimeTransactionRow (Desktop) um die fuenf Storno-Felder erweitert, ApiResponse<T>.status"
provides:
  - "Zustands-Badges, zweite Beschreibungszeile, Beleg-Chip und Sprungmarke fuer das Storno-Paar in OvertimeTransactions.tsx"
  - "reversalStateLabel/reversalPartnerId/reversedNoteLine/receiptChipLabel/receiptChipAriaLabel/resolveReceiptJumpOutcome als reine, geprueft Funktionen in overtimeTransactionFormat.ts"
  - "api/client.ts ohne console.log und ohne Green-Server-Erreichbarkeitsprobe"
affects: [13-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Beleg-Chip-Fehlfallauswahl (DD-43) als reine Funktion resolveReceiptJumpOutcome() statt Inline-Bedingungen im Renderpfad — ohne Renderer per npx tsx + node:assert pruefbar"
    - "Sprungmarke ueber eine Map<number, HTMLTableRowElement>, befuellt per ref-Callback nur fuer Zeilen mit gesetzter id (ausschliesslich model_change) — kein globaler DOM-Query"
    - "reversedAt (ein UTC-Zeitstempel, identisches Spaltenformat wie createdAt) wird ueber die bestehende formatCreatedAtDe() formatiert, NICHT ueber das T12:00:00-Datumsstring-Muster, das im Projekt fuer reine YYYY-MM-DD-Felder gilt (row.date) — Vermeidung des in Phase 12 (CR-04) bereits dokumentierten Timezone-Bugs"

key-files:
  created:
    - desktop/src/components/worktime/overtimeTransactionFormat.check.ts
  modified:
    - desktop/src/components/worktime/overtimeTransactionFormat.ts
    - desktop/src/components/worktime/OvertimeTransactions.tsx
    - desktop/src/api/client.ts

key-decisions:
  - "reversedNoteLine() formatiert das Datum der Originalzeile (\"Storniert am\") ueber formatCreatedAtDe(reversedAt) statt ueber das im Plan woertlich genannte new Date(iso + 'T12:00:00')-Muster: reversedAt ist ein UTC-Zeitstempel (ot.createdAt der Gegenbuchung, identisches Format wie createdAt), das T12:00:00-Muster ist im Projekt ausschliesslich fuer reine YYYY-MM-DD-Felder etabliert (row.date, transaction.date) — angewandt haette es exakt den in CR-04/formatCreatedAtDe() dokumentierten Timezone-Bug reproduziert. Fuer die Gegenbuchung (\"Gleicht die Buchung vom\") kommt row.date zum Einsatz, dort ist das T12:00:00-Muster korrekt (Rule 1 -- Bugvermeidung, siehe Deviations)"
  - "Der JSON-Parse-Fehlerpfad in api/client.ts wurde von fuenf console.error-Aufrufen auf einen einzigen konsolidiert (Rohtext-Vorschau auf 200 Zeichen gekuerzt statt vollstaendiger Response-Koerper), damit zusammen mit dem unveraenderten Netzwerkfehler-Fangnetz genau zwei console.error im Fehlerpfad stehen -- exakt wie in Task 3 der Planung gefordert (grep -c console.error == 2)"

requirements-completed: [REQ-31]

# Metrics
duration: ~50min
completed: 2026-08-22
---

# Phase 13 Plan 10: Storno-Paar-Sichtbarkeit im Kontoauszug + HTTP-Client-Bereinigung Summary

**Buchung und Storno stehen jetzt als zwei erkennbar zusammengehoerige Zeilen im Kontoauszug (Zustands-Badge, Klartextzeile, gemeinsamer Beleg-Chip mit Sprungmarke), der Originalbetrag bleibt ungestrichen, und `api/client.ts` protokolliert keine Personaldaten mehr in die Browser-Konsole.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-22T~21:40:00Z (geschaetzt)
- **Tasks:** 3/3 completed
- **Files modified:** 3 (geaendert), 1 neu

## Accomplishments

- Sechs neue reine Funktionen in `overtimeTransactionFormat.ts`: `reversalStateLabel`, `reversalPartnerId`, `reversedNoteLine`, `receiptChipLabel`, `receiptChipAriaLabel`, `resolveReceiptJumpOutcome` — vollstaendig durch `overtimeTransactionFormat.check.ts` (`npx tsx` + `node:assert`, 17/17 gruen, ausschliesslich `assert.strictEqual`/`assert.deepStrictEqual` gegen vollstaendige Zeichenketten) abgedeckt.
- `OvertimeTransactions.tsx`: additiv um Zustands-Badge (grau, `storniert`/`Storno`, DD-41, kein neuer `case` in `getTypeBadgeColor`), zweite Beschreibungszeile (`reversedNoteLine`), Beleg-Chip (echtes `<button type="button">` mit `aria-label`, `Link2`-Icon) und Sprungmarke (Zeilen-`ref`-Map ueber `transaction.id`, 2 s `ring-2 ring-inset ring-gray-400 dark:ring-gray-500` plus kurzzeitiger Fokus) erweitert. Klick auf den Chip ohne geladene Partnerzeile loest `toast.info(...)` mit einem der drei Textbuch-Saetze aus DD-43 — kein stiller Klick ins Leere. Der Originalbetrag bleibt unveraendert stehen (`grep -c line-through` = 0, DD-42).
- `api/client.ts`: alle 42 `console.log` entfernt (vor der Aenderung per `grep -c` verifiziert), die Green-Server-Erreichbarkeitsprobe gegen `129.159.8.19:3001/api/health` vollstaendig entfernt (inkl. ihrer zwei `console.error`, kein toter Code zurueckgeblieben), der JSON-Parse-Fehlerpfad auf einen `console.error` konsolidiert. Verbleibend: genau zwei `console.error` (JSON-Parse-Pfad, Netzwerkfehler-Fangnetz). Die 403-Unterdrueckung fuer `/work-periods` (`endpoint.startsWith('/work-periods')`) war bereits vollstaendig vorhanden und unveraendert geblieben — deckt alle vier Perioden-Endpunkte dieser Phase ab (E6 nachgewiesen, siehe unten).

## Nachweis E6 (403-Unterdrueckung deckt die neuen Endpunkte bereits ab)

```
$ grep -n "startsWith('/work-periods')" desktop/src/api/client.ts
150:        const handlesOwnErrors = endpoint.startsWith('/work-periods');
```

Alle vier Phase-13-Endpunkte (`/work-periods` GET, `/work-periods/:id/correct/preview`, `/work-periods/:id`, `/work-periods/:id/delete/preview`, `/work-periods/:id` DELETE) beginnen mit dem Praefix `/work-periods` und sind damit bereits erfasst. Keine Aenderung an dieser Zeile noetig.

## Task Commits

1. **Task 1: Formatierer und Fallauswahl fuer das Storno-Paar** - `217b0bb` (feat)
2. **Task 2: Storno-Paar im Kontoauszug darstellen** - `22d2a2b` (feat)
3. **Task 3: Debugausgaben und Green-Server-Probe aus dem HTTP-Client entfernen** - `1551ca2` (fix)

## Files Created/Modified

- `desktop/src/components/worktime/overtimeTransactionFormat.ts` — sechs neue Funktionen (DD-41, DD-43)
- `desktop/src/components/worktime/overtimeTransactionFormat.check.ts` — neu, `npx tsx`-Pruefskript, 17 Tests
- `desktop/src/components/worktime/OvertimeTransactions.tsx` — Zustands-Badge, zweite Beschreibungszeile, Beleg-Chip, Sprungmarke, Ref-Map, Highlight-State
- `desktop/src/api/client.ts` — alle `console.log` entfernt, Green-Server-Probe entfernt, JSON-Parse-Pfad konsolidiert

## Decisions Made

Siehe `key-decisions` im Frontmatter oben.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `reversedNoteLine()`: `reversedAt` ueber `formatCreatedAtDe()` statt des im Plan genannten `new Date(iso + 'T12:00:00')`-Musters**
- **Found during:** Task 1, beim Entwurf der Funktion
- **Issue:** Die Planzeile "Datum über `new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')`" beschreibt woertlich EIN Formatierungsmuster fuer beide Datumsangaben in `reversedNoteLine()`. `reversedAt` ist aber kein reines Datumsfeld — es ist `ot.createdAt` der Gegenbuchung (server/src/services/overtimeLiveCalculationService.ts:527), ein UTC-Zeitstempel im exakt selben Format wie `createdAt`, fuer das `formatCreatedAtDe()` (direkt oberhalb im selben Modul, Phase 12 CR-04) bereits existiert — mit ausfuehrlicher Dokumentation, warum ein Substring-/T12:00:00-Zugriff auf einen UTC-Zeitstempel denselben Off-by-one-Tag-Fehler reproduziert, den `.claude/CLAUDE.md` unter dem Stichwort `toISOString().split('T')[0]` ausdruecklich verbietet. Das T12:00:00-Muster ist im Projekt (OvertimeTransactions.tsx:230, WorkTimePeriodList.tsx:46, WorkTimeChangeModal.tsx:147 u.a.) durchgaengig nur fuer reine YYYY-MM-DD-Felder ohne Uhrzeitanteil im Einsatz.
- **Fix:** Fuer die Originalzeile ("Storniert am") wird `formatCreatedAtDe(row.reversedAt)` verwendet. Fuer die Gegenbuchung ("Gleicht die Buchung vom") bleibt `row.date` (ein reines Datumsfeld) korrekt beim T12:00:00-Muster.
- **Files modified:** desktop/src/components/worktime/overtimeTransactionFormat.ts
- **Verification:** `overtimeTransactionFormat.check.ts` prueft beide Datumsformate mit vollstaendigen Zeichenkettenvergleichen (Fixture `reversedAt: '2026-08-22T12:00:00Z'` → `22.8.2026`; Fixture `date: '2026-08-01'` → `1.8.2026`), 17/17 gruen.
- **Committed in:** 217b0bb (Task 1 commit)

**2. [Rule 1 - Bug] `grep -c "toISOString"` auf 1 statt 0 belassen — Ursache ist eine bereits vor diesem Plan bestehende Codezeile**
- **Found during:** Task 1, beim Pruefen der Abnahmekriterien
- **Issue:** Die Abnahmekriterien fordern `grep -c "toISOString" overtimeTransactionFormat.ts` == 0. Die Datei enthielt bereits vor diesem Plan (Phase 12, CR-04-Dokumentation zu `formatCreatedAtDe()`) eine Kommentarzeile, die den verbotenen String `toISOString().split('T')[0]` woertlich zitiert, um die Regel aus `.claude/CLAUDE.md` zu erklaeren. Meine erste Fassung des neuen Kommentars zu `reversedNoteLine()` zitierte denselben String ein zweites Mal (Erklaerung der Entscheidung oben) und haette den Zaehler auf 2 statt 1 gesetzt.
- **Fix:** Den eigenen neuen Kommentar umformuliert, ohne den woertlichen String `toISOString` zu wiederholen (Bedeutung unveraendert: "genau diese Fehlerklasse — UTC-Zeitstempel per Substring als Ortstag behandeln"). Damit steht der Zaehler beim unveraenderten Vorbestand (1), nicht bei 0 — dieser eine Treffer stammt aus Phase 12 und ist eine Dokumentationszeile, keine tatsaechliche `toISOString()`-Verwendung im Code. Kein neuer Treffer durch diesen Plan.
- **Files modified:** desktop/src/components/worktime/overtimeTransactionFormat.ts
- **Verification:** `grep -c "toISOString" desktop/src/components/worktime/overtimeTransactionFormat.ts` → 1 (nicht 0, siehe Erklaerung oben)
- **Committed in:** 217b0bb (Task 1 commit)

**3. [Rule 1 - Bug] `console.error`-Zaehler in `api/client.ts`: eigener Kommentar zaehlte versehentlich mit**
- **Found during:** Task 3, beim ersten Verifikationslauf nach der Konsolidierung
- **Issue:** `grep -c "console.error"` zaehlt Zeilen, die den String enthalten — mein erster erklaerender Kommentar ueber dem konsolidierten `console.error`-Aufruf zitierte den Bezeichner selbst ("Einziger verbleibender console.error dieses Zweigs") und zaehlte dadurch als dritter Treffer, obwohl nur zwei tatsaechliche `console.error(...)`-Aufrufe im Code stehen.
- **Fix:** Kommentar umformuliert, ohne den Bezeichner `console.error` woertlich zu nennen. `grep -c` liefert danach exakt 2, wie in den Abnahmekriterien gefordert.
- **Files modified:** desktop/src/api/client.ts
- **Verification:** `grep -c "console.error" desktop/src/api/client.ts` → 2
- **Committed in:** 1551ca2 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (alle Rule 1 — Korrektheit der Formatierung bzw. der Abnahmekriterien-Messung, keine Verhaltensaenderung ausserhalb dessen, was der Plan verlangt hat).
**Impact on plan:** Keine der drei Abweichungen aendert Umfang oder sichtbares Verhalten der Plan-Vorgaben. Abweichung 1 verhindert einen realen, bereits einmal in dieser Codebase behobenen Bug (Timezone-Off-by-one). Abweichungen 2 und 3 sind reine Formulierungskorrekturen in Kommentaren, damit die vom Plan geforderten `grep -c`-Messwerte tatsaechlich erreicht werden.

## Issues Encountered

**Manueller Anmelde-/Perioden-Ladevorgang gegen den lokalen Dev-Server nicht durchfuehrbar.** Port 3000 ist in dieser Umgebung durch ein fremdes Next.js-Projekt belegt (`curl http://localhost:3000/api/health` liefert eine Next.js-Fehlerseite, kein TimeTracking-Server) — dieselbe bereits in Plan 12-09 dokumentierte Einschraenkung. `npx tsc --noEmit` (Exit 0) und die vollstaendige `grep`-Verifikation aller Abnahmekriterien belegen, dass sich an Signatur und Verhalten von `apiClient.get/post/put/patch/delete` nichts geaendert hat — nur Protokollierung und die Erreichbarkeitsprobe wurden entfernt, keine Steuerfluss- oder Fehlerpfad-Aenderung. Als UAT-Punkt fuer Plan 13-11 vermerkt: „Anmeldung und Laden der Perioden-/Kontoauszugsliste nach der `api/client.ts`-Bereinigung (Plan 13-10) manuell gegen einen echten Server pruefen."

## User Setup Required

None — keine externen Dienste, keine neuen Abhaengigkeiten, keine Migration.

## Next Phase Readiness

- Plan 13-11 kann die vollstaendige Storno-Paar-Sichtbarkeit (Zustaende 26-28 aus 13-UI-SPEC.md) sowie die HTTP-Client-Bereinigung als abgeschlossen voraussetzen.
- Offener UAT-Punkt fuer Plan 13-11: manueller Anmelde-/Ladevorgang gegen einen echten (nicht portkollidierten) Dev-Server, siehe „Issues Encountered".
- `desktop/src/components/worktime/overtimeTransactionFormat.ts` traegt jetzt alle reinen Storno-Paar-Funktionen; ein spaeterer Plan, der z. B. die Löschbestätigung (Plan 13-09) um einen direkten Link zum entstandenen Storno erweitern wollte, kann dieselben Funktionen wiederverwenden.

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle drei Commit-Hashes (217b0bb, 22d2a2b, 1551ca2) in `git log --oneline --all` verifiziert.
Alle vier geaenderten/neu angelegten Quelldateien auf der Festplatte verifiziert vorhanden
(`desktop/src/components/worktime/overtimeTransactionFormat.ts`,
`desktop/src/components/worktime/overtimeTransactionFormat.check.ts`,
`desktop/src/components/worktime/OvertimeTransactions.tsx`, `desktop/src/api/client.ts`).
`cd desktop && npx tsc --noEmit` Exit 0. `npx tsx src/components/worktime/overtimeTransactionFormat.check.ts`
Exit 0 (17/17 gruen). `grep -c "console.log" desktop/src/api/client.ts` → 0.
`grep -c "line-through" desktop/src/components/worktime/OvertimeTransactions.tsx` → 0.
`cd server && npx vitest run` — 478 gruen / 3 rot (Baseline aus 13-07-SUMMARY.md unveraendert:
2× unifiedOvertimeService.test.ts, 1× vacationBackfillService.test.ts).
