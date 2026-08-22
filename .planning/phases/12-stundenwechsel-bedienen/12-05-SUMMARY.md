---
phase: 12-stundenwechsel-bedienen
plan: 05
subsystem: server
tags: [express, sqlite, better-sqlite3, vitest, overtime, work-periods, hmac-token]

# Dependency graph
requires:
  - phase: 12-stundenwechsel-bedienen
    plan: 01
    provides: "Buchungstyp model_change, referenceType work_period, Vertragstypen WorkTimeChangeInput/Preview/PreviewResponse/Outcome, GET /api/work-periods"
  - phase: 12-stundenwechsel-bedienen
    plan: 03
    provides: "applyWorkTimeChange(input, { dryRun, createdBy }) und issuePreviewToken/verifyPreviewToken"
  - phase: 12-stundenwechsel-bedienen
    plan: 04
    provides: "Desktop-Hooks (useWorkTimeChange.ts), die exakt die hier gebauten Endpunktpfade und Antwortformen erwarten"
provides:
  - "POST /api/work-periods/preview und POST /api/work-periods/change — admin-pflichtig (D6), token-gebunden (T-12-24), ohne req.body-Cast"
  - "workPeriodChangeService.test.ts — automatisierter Nachweis fuer REQ-26 bis REQ-29 und D2/D3/D4/D7 (14 Testfaelle)"
  - "OvertimeTransaction.type/.referenceType kennen jetzt 'model_change'/'work_period' (Lesevertrag von getOvertimeHistory())"
affects: [12-06, 12-07, 12-08, 13-korrigieren-und-rueckgaengig-machen, 14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Namensraum-Import fuer issuePreviewToken/verifyPreviewToken (workTimeChangeTokenModule.*), damit ein grep auf den Funktionsnamen ausschliesslich die tatsaechliche Aufrufstelle zeigt, nicht zusaetzlich die Importzeile (Muster aus 12-PATTERNS.md Abschnitt zu createWorkPeriodContext)"
    - "previewToken wird beim Speichern NICHT wie die vier Basisfelder mit 400 abgelehnt, wenn es fehlt — ein fehlendes Token ist 'keine gueltige Vorschau vorhanden', beantwortet von verifyPreviewToken()/409 PREVIEW_STALE, nicht vom Anfragekoerper-Typwaechter"
    - "Testfixtures bilden 'heute' ueber getTodayString() (Berlin) und reine Kalenderarithmetik auf Zahlen ab (firstOfMonthOffset/lastOfMonth) statt harter Kalenderdaten — der Testlauf bleibt unabhaengig vom tatsaechlichen Ausfuehrungsdatum reproduzierbar"

key-files:
  created:
    - server/src/services/workPeriodChangeService.test.ts
  modified:
    - server/src/routes/workPeriods.ts
    - server/src/services/overtimeTransactionService.ts

key-decisions:
  - "reason und previewToken werden im Anfragekoerper von POST /change permissiv gelesen (leere Zeichenkette statt 400 bei fehlendem Typ) — ein fehlendes previewToken ist kein kaputt geformter Anfragekoerper, sondern der Fall, den T-12-24 (409 PREVIEW_STALE) beantwortet. Ohne diese Anpassung waere ein Aufruf ohne previewToken 400 statt 409 gewesen und haette die im Plan geforderte Live-Verifikation nicht erfuellt."
  - "OvertimeTransaction.type/.referenceType (overtimeTransactionService.ts) um 'model_change'/'work_period' erweitert — Migration 011 (Plan 12-01) hatte den Wert bereits im CHECK-Constraint zugelassen, der Lesevertrag von getOvertimeHistory() kannte ihn noch nicht. Reine additive Typerweiterung (kein any, keine Verhaltensaenderung), noetig fuer den REQ-29-Test gegen die echte Journalfunktion."
  - "requireAdmin erscheint literal 3x in workPeriods.ts (Import + zwei Routen), nicht 2x wie im Plan-Acceptance-Criterion angenommen — dieselbe Kategorie Zaehlfehler wie in 12-01-SUMMARY.md dokumentiert (grep zaehlt Zeilen, die Importzeile zaehlt mit). Funktional erfuellt (D6 gilt fuer beide Routen, per Codelesung und Live-403-Nachweis verifiziert), keine Codeaenderung noetig."

patterns-established:
  - "Typwaechter statt req.body-Cast fuer jeden neuen Schreibendpunkt dieses Routers (Vorbild fuer Phase 13)"

requirements-completed: [REQ-26, REQ-27, REQ-28, REQ-29]

# Metrics
duration: ~100min
completed: 2026-08-22
---

# Phase 12 Plan 05: Die Schreibendpunkte und der automatisierte Nachweis Summary

**`POST /api/work-periods/preview` und `POST /api/work-periods/change` sind admin-pflichtig und tokengebunden live verifiziert (403/409/409 ohne Schreibwirkung), und 14 automatisierte Testfaelle in `workPeriodChangeService.test.ts` belegen alle vier ROADMAP-Erfolgskriterien inklusive eines nachweislich scharfen Vorschau=Speichern-Tests.**

## Performance

- **Duration:** ~100 min
- **Tasks:** 2/2 completed
- **Files modified:** 3 (1 neu, 2 geändert)

## Accomplishments

- Beide Schreibendpunkte tragen `requireAuth` UND `requireAdmin` (D6); eine Employee-Session
  wurde live gegen den lokalen Dev-Server mit 403 nachgewiesen, ein Aufruf ohne `previewToken`
  und ein Aufruf mit einem zu anderen Wochenstunden ausgestellten Token je mit 409
  `PREVIEW_STALE`/Mismatch — in allen drei Faellen war `SELECT COUNT(*) FROM
  user_work_periods` vor und nach dem Aufruf identisch (kein Schreibvorgang). Ein
  vollstaendiger Happy-Path-Lauf (Vorschau → Speichern mit gueltigem Token) wurde ebenfalls
  live verifiziert und danach wieder zurueckgesetzt.
- `workPeriodChangeService.test.ts`: 14 Testfaelle, alle gruen (392ms), decken REQ-26 bis
  REQ-29 sowie die Nebenbedingungen aus `<behavior>` (Trockenlauf schreibt nichts,
  Stichtag mitten im Monat, Jahreswechsel, fuenf Validierungsfaelle, D7-Atomaritaet bei
  eingeschleuster Kettenluecke, Aufraeumnachweis) ab.
- Die Schaerfe des REQ-27-Tests wurde durch einen absichtlich verfaelschten Lauf
  nachgewiesen: `targetHoursAfter` im Speicherpfad um 1 erhoeht → sofortiger roter Testlauf
  (`expected 229 to be 228`) → Verfaelschung vollstaendig zurueckgenommen (`git diff` zeigt
  danach keine Aenderung an `workPeriodChangeService.ts`).
- `npx tsc --noEmit` bleibt gruen, `npm test` in `server/`: 403 passed / 3 failed (die drei
  bekannten, vorbestehenden Fehlschlaege aus dem Ausgangsstand von Plan 12-01) von 406 Tests
  gesamt — keine neuen roten Tests gegenueber dem Ausgangsstand.

## Task Commits

Each task was committed atomically:

1. **Task 1: POST /preview und POST /change mit Rollen- und Tokenpruefung** - `c71b7be` (feat)
2. **Task 2: Der Nachweis — Nullwirkung, Rueckwirkung, Vorschau gleich Speichern** - `f6d3dc0` (test)

**Plan metadata:** (folgt mit diesem Commit — docs: complete plan)

## Files Created/Modified

- `server/src/routes/workPeriods.ts` - `POST /preview` (Dry-Run + Token-Ausstellung) und
  `POST /change` (Token-Pruefung + Speichern) ergaenzt, beide admin-pflichtig
- `server/src/services/workPeriodChangeService.test.ts` - 14 Testfaelle fuer
  `applyWorkTimeChange()`, gegen die geteilte Arbeitsdatenbank, Praefix `test-12-05-`
- `server/src/services/overtimeTransactionService.ts` - `OvertimeTransaction.type`/
  `.referenceType` um `'model_change'`/`'work_period'` erweitert (additive Typkorrektur)

## Bestaetigung des Saldo-Lesepfads

Empirisch gemessen (nicht nur code-gelesen wie in 12-03-SUMMARY.md): Im REQ-29-Testfall
erzeugt `applyWorkTimeChange()` eine `model_change`-Buchung mit `balanceAfter = 152`
(`overtime_transactions`-Zeile). `getOvertimeBalance(userId)` unmittelbar danach liefert
**152**. Nach dem gezielten Loeschen genau dieser einen Zeile aus `overtime_transactions`
liefert `getOvertimeBalance(userId)` erneut **152** — unveraendert. Der von der Oberflaeche
gelesene Saldo (`overtime_balance`-Aggregat) zaehlt die Journalzeile also nachweislich nicht
doppelt; die Zeile ist reine Sichtbarkeit (REQ-29), keine zusaetzliche Rechengroesse.

## Beleg der Testschaerfe

Waehrend der Verifikation wurde `targetHoursAfter` im Speicherpfad von
`applyWorkTimeChange()` testweise um 1 verfaelscht (`if (!options.dryRun) { targetHoursAfter
+= 1; }`, ausschliesslich im Speicherpfad, damit Vorschau und Speichern auseinanderdriften).
Der isolierte Lauf von `npm test -- workPeriodChangeService -t "REQ-27"` schlug sofort fehl:

```
AssertionError: expected 229 to be 228 // Object.is equality
- Expected
+ Received
- 228
+ 229
 ❯ src/services/workPeriodChangeService.test.ts:300:44
```

Die Verfaelschung wurde unmittelbar danach zurueckgenommen; `git diff
server/src/services/workPeriodChangeService.ts` zeigt seither keine Abweichung vom
committeten Stand, und der volle Testlauf ist wieder gruen (14/14, 392ms).

## Decisions Made

- `reason`/`previewToken` werden im Speicherpfad-Anfragekoerper permissiv gelesen (leere
  Zeichenkette statt 400-Ablehnung bei fehlendem Typ) — ein fehlendes Token beantwortet
  `verifyPreviewToken()` bereits mit 409 `PREVIEW_STALE` (T-12-24); eine 400-Ablehnung waere
  ein anderer, vom Plan nicht geforderter Fehlerpfad gewesen und haette den geforderten
  Live-Nachweis ("ohne previewToken antwortet 409") nicht erfuellt.
- `OvertimeTransaction.type`/`.referenceType` additiv um die beiden neuen Werte erweitert,
  statt in `workPeriodChangeService.test.ts` einen Cast/`any` zu verwenden — die uebrigen,
  bereits vorher unvollstaendigen Werte dieses Interfaces (z. B. `'earned'`,
  `'vacation_credit'`) bleiben unangetastet (ausserhalb des Plan-Scopes).
- Testfixtures verwenden ausschliesslich `getTodayString()` (Berlin) plus reine
  Kalenderarithmetik auf Zahlen (kein `new Date('YYYY-MM-DD')`) — der Testlauf bleibt
  unabhaengig vom tatsaechlichen Ausfuehrungsdatum reproduzierbar, statt wie einige
  Bestandstests auf ein hart codiertes Jahr angewiesen zu sein.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - fehlende Typgenauigkeit] `OvertimeTransaction.type`/`.referenceType` kannten `'model_change'`/`'work_period'` nicht**
- **Found during:** Task 2 (beim Schreiben des REQ-29-Tests gegen `getOvertimeHistory()`)
- **Issue:** Migration 011 (Plan 12-01) hatte `'model_change'`/`'work_period'` bereits im
  CHECK-Constraint der Tabelle zugelassen; der TypeScript-Lesevertrag in
  `overtimeTransactionService.ts` (`OvertimeTransaction`-Interface) kannte diese Werte nicht.
  Ein Literalvergleich `row.type === 'model_change'` waere ohne Cast/`any` ein
  TypeScript-Fehler gewesen — direkt blockierend fuer den in diesem Plan geforderten Test.
- **Fix:** Beide Unions additiv um den jeweils fehlenden Wert erweitert. Keine
  Verhaltensaenderung, keine weitere Aufrufstelle beruehrt.
- **Files modified:** `server/src/services/overtimeTransactionService.ts`
- **Verification:** `npx tsc --noEmit` bleibt gruen; kein `any` im Testfile
  (`grep -c ": any"` = 0).
- **Committed in:** `f6d3dc0` (Teil des Task-2-Commits)

### Beobachtung (kein Auto-Fix noetig)

**Acceptance-Criterion "grep -c requireAdmin liefert genau 2" trifft nicht literal zu**
- **Gefunden während:** Task 1 Verifikation
- **Befund:** `grep -c "requireAdmin"` zaehlt Zeilen, nicht Vorkommen der Route-Middleware;
  die Importzeile (`import { requireAuth, requireAdmin } from ...`) zaehlt zusaetzlich mit,
  macht daraus 3 statt 2. Dieselbe Kategorie Zaehlfehler wie in `12-01-SUMMARY.md`
  dokumentiert (dort: `work_period`-Grep kollidierte mit `user_work_periods`).
- **Bewertung:** Die fachliche Anforderung (D6: beide POST-Routen admin-pflichtig) ist
  erfuellt und exakt lokalisiert nachgewiesen (`grep -n "requireAdmin" workPeriods.ts` zeigt
  die beiden Routenzeilen 168 und 217, zusaetzlich zur Importzeile 18) — zusaetzlich live
  gegen den Dev-Server mit einer Employee-Session (403) bestaetigt. Kein Code geaendert.

## Known Stubs

Keine.

## Threat Flags

Keine neue, im `<threat_model>` dieses Plans nicht bereits erfasste Angriffsflaeche
gefunden — beide neuen Routen, das Token-Schema und der Testzugriff sind vollstaendig durch
T-12-22 bis T-12-27 abgedeckt.

## Issues Encountered

- **Testnutzer-Anmeldedaten fuer die Live-HTTP-Verifikation.** Der lokale Testnutzer `admin`
  (id 1, dev-DB) hatte trotz erfolgreichem Lauf von `npm run seed:test-users` kein zu
  `admin123` passendes Passwort-Hash — Ursache nicht abschliessend geklaert (moeglich: ein
  spaeterer Schritt des Seed-Skripts oder ein anderer, parallel gegen dieselbe
  `development.db` laufender Prozess hat den Hash nach dem Update erneut veraendert). Der
  Hash wurde direkt und minimal-invasiv per `bcrypt.hashSync('admin123', 10)` +
  `UPDATE users SET password = ?` gesetzt und funktionierte danach zuverlaessig. Reine
  lokale Entwicklungsdatenbank (`server/database/development.db`, gitignored), keine
  Produktionsdatenbank beruehrt.
- **Der HTTP-Verifikationsserver lief auf Port 3099** (Port 3000 war durch einen anderen,
  bereits laufenden Serverprozess belegt — Muster aus `12-01-SUMMARY.md`). Nach den drei
  Pflichtnachweisen plus einem Happy-Path-Lauf sauber beendet (verifiziert: kein Prozess mehr
  auf Port 3099, `curl` liefert keine Antwort mehr).
- **Der Happy-Path-Testlauf** (Vorschau → Speichern mit gueltigem Token gegen den
  Testnutzer `test.vollzeit`, id 15015) legte eine echte Periode an (id 3694). Nach der
  Verifikation direkt per SQL zurueckgesetzt (Periode geloescht, Vorperiode wieder geoeffnet)
  — `SELECT COUNT(*) FROM user_work_periods` vor und nach dem gesamten Verifikationslauf
  identisch (30).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Beide Schreibendpunkte stehen exakt unter den Pfaden und mit den Antwortformen, die
  `desktop/src/hooks/useWorkTimeChange.ts` (Plan 12-04) bereits erwartet — keine
  Vertragsaenderung noetig fuer Plan 12-06 (Wechsel-Dialog, `EditUserModal.tsx`-Einbindung).
- Alle vier ROADMAP-Erfolgskriterien (REQ-26 bis REQ-29) sind automatisiert und gruen belegt
  — Plan 12-06/12-07 koennen sich auf einen bereits verifizierten Server-Schreibweg
  verlassen, ohne diesen selbst nochmals zu pruefen.
- Kein Blocker fuer die naechste Welle.

## UAT-Punkte für Phase 14

1. **Vollstaendiger Vorschau→Speichern-Zyklus auf einer Kopie der Produktionsdatenbank fuer
   einen realen Nutzer:** Vorschau abrufen, den angezeigten neuen Saldo notieren, danach
   speichern. Erwartetes Ergebnis: exakt derselbe Saldo steht anschliessend im Kontoauszug
   (Phase 8). Lokal mit einem Testnutzer bereits verifiziert (dieser Plan); der reale
   Produktionslauf ist Sache der Phase-14-Abnahme (D8).
2. **Fuer alle Nutzer OHNE Modellwechsel:** `getOvertimeBalance()` vor und nach einem
   Testlauf identisch — kein Seiteneffekt auf unbeteiligte Nutzer. Code-seitig durch den
   begrenzten Rebuild-Bereich (D3, nur `validFrom..heute` des betroffenen Nutzers) und die
   Testfaelle dieses Plans nahegelegt, aber nicht gegen einen vollstaendigen
   Produktionsbestand gemessen.
3. **`checkAllPeriodChains()` gegen die Produktionskopie nach einem realen Wechsel:** kein
   Befund. Der D7-Testfall dieses Plans belegt lokal, dass ein Kettenproblem den gesamten
   Vorgang zurueckrollt (keine halb angelegte Periode) — der Produktionsnachweis mit echten
   Bestandsdaten ist Sache der Phase-14-Abnahme.
4. **`PREVIEW_STALE` in der Desktop-Oberflaeche:** Ein Admin oeffnet den
   Stundenwechsel-Dialog, laesst ihn laenger als 15 Minuten offen und klickt dann
   "Speichern" — die Oberflaeche muss die 409-Antwort in eine verstaendliche deutsche
   Meldung uebersetzen (Aufgabe von Plan 12-06/12-07, hier nur der Server-Vertrag
   verifiziert).

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle drei geänderten/erstellten Dateien (`server/src/routes/workPeriods.ts`,
`server/src/services/workPeriodChangeService.test.ts`,
`server/src/services/overtimeTransactionService.ts`) verifiziert vorhanden. Beide
Task-Commits (`c71b7be`, `f6d3dc0`) in `git log --oneline --all` nachgewiesen.
