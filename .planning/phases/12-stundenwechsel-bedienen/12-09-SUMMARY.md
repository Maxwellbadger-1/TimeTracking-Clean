---
phase: 12-stundenwechsel-bedienen
plan: 09
subsystem: testing
tags: [playwright, vitest, typescript, e2e, ci-gates]

# Dependency graph
requires:
  - phase: 12-stundenwechsel-bedienen
    plan: 05
    provides: "POST /api/work-periods/preview und /change, previewToken-Vertrag"
  - phase: 12-stundenwechsel-bedienen
    plan: 07
    provides: "Einbindung des Wechsel-Dialogs in EditUserModal.tsx, schreibgeschuetzte Stundenfelder (D1)"
  - phase: 12-stundenwechsel-bedienen
    plan: 08
    provides: "Desktop-Nachzug periodengetreuer Berechnung (WR-12)"
provides:
  - "desktop/tests/user-edit.spec.ts bedient die Nullstunden-Umstellung ueber den neuen Wechsel-Dialog statt des jetzt schreibgeschuetzten Feldes"
  - "Gate-Protokoll: beide tsc-Gates gruen, Server-Testsuite ohne neue rote Tests (403/406, 3 vorbestehend rot), Desktop-Testdateien dieser Phase gruen, 16 console.log belegt entfernt, kein any in neuem Code"
  - "Vier ROADMAP-Erfolgskriterien der Phase 12 mit benanntem Testbeleg (workPeriodChangeService.test.ts, REQ-26/27/28/29)"
  - "Gebuendelte, durchnummerierte UAT-Liste (38 Punkte aus den Plaenen 12-01 bis 12-08 plus 1 neuer Punkt) fuer die Abnahme am Ende von Phase 14"
affects: [13-korrigieren-und-rueckgaengig-machen, 14-absicherung-und-auslieferung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Label+Input ohne htmlFor/id in Input.tsx/Textarea.tsx: E2E-Selektor ueber CSS-Adjazenz label:has-text(\"X\") + input statt [name=...], weil WorkTimeChangeModal.tsx (anders als CreateUserModal) keine name-Attribute auf den Formularfeldern traegt"
    - "Primaerbutton-Wartezustand ueber expect(locator).toBeEnabled({ timeout }) statt page.waitForTimeout() — wartet auf die eingetroffene Server-Vorschau (previewToken), nicht auf eine feste Zeitspanne"

key-files:
  created: []
  modified:
    - desktop/tests/user-edit.spec.ts

key-decisions:
  - "Format der Periodenliste in der Assertion ist '0 h' (ohne Nachkommastelle), nicht '0,0 h' wie im Plantext als Platzhalter genannt — verifiziert gegen WorkTimePeriodList.tsx:39/153 (toLocaleString('de-DE', { maximumFractionDigits: 2 }) zeigt bei 0 keine erzwungene Nachkommastelle). Der Plan selbst raeumt diese Formulierungsfreiheit ausdruecklich ein ('bzw. dem im Projekt verwendeten Format')."
  - "Stichtag zeitzonensicher ohne toISOString().split('T')[0] aufgebaut (lokale Jahr/Monat/Tag-Komposition) — Pflicht aus .claude/CLAUDE.md, obwohl der unveraenderte Bestandstest 'Set end date for employee' in derselben Datei weiterhin die verbotene Form nutzt (ausserhalb des Aenderungsumfangs dieser einen Testfunktion, siehe Vorbestehende Defekte)."
  - "E2E-Ausfuehrung in dieser lokalen Windows-Umgebung als blockiert dokumentiert statt stillschweigend uebersprungen — Port 3000 ist durch ein unabhaengiges, bereits laufendes Next.js-Projekt belegt, Port 1420 bedient bereits eine aktive Desktop-Dev-Session, die gegen denselben (falschen) Port 3000 zeigt. Exakte Fehlermeldung siehe Abschnitt 'E2E-Ausfuehrung'."

patterns-established: []

requirements-completed: [REQ-26, REQ-27, REQ-28, REQ-29]

# Metrics
duration: ~50min
completed: 2026-08-22
---

# Phase 12 Plan 09: Abschluss — E2E-Test, Pflicht-Gates, gebündelte UAT-Liste Summary

**Der eine E2E-Test, den der Schreibschutz aus Plan 12-07 gebrochen hatte, bedient jetzt den neuen Wechsel-Dialog; beide TypeScript-Gates und die Server-Testsuite (403/406, keine neuen roten Tests) sind grün, und 38 UAT-Punkte aus acht Plänen liegen als eine nummerierte Liste für die Abnahme am Ende von Phase 14 vor.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2/2 completed
- **Files modified:** 1 (desktop/tests/user-edit.spec.ts)

## Accomplishments

- `user-edit.spec.ts`: Der Test „Change employee to 0 hours (critical bug fix test)" bedient
  die Umstellung auf 0 Stunden jetzt über `button:has-text("Stundenwechsel ab Datum")` →
  Dialogtitel `Stundenwechsel:` → Stichtag (Zukunft) / Neue Wochenstunden (0) / Begründung →
  Warten auf den freigeschalteten Primärbutton `Stundenwechsel speichern` (server-vorschau-
  gebunden, kein `waitForTimeout`) → Speichern → Prüfung der Periodenliste im `EditUserModal`
  auf eine Zeile mit `0 h`. Der kaputte Selektor `button[aria-label="Bearbeiten"]` ist in
  diesem einen Test durch `button:has-text("Bearbeiten")` ersetzt; die übrigen sieben
  Vorkommen in derselben Datei sind unangetastet.
- Beide Pflicht-Gates (`server && desktop npx tsc --noEmit`) sind grün, exitcode 0, keine
  Ausgabe.
- `server && npm test`: 403 bestanden / 3 fehlgeschlagen von 406 — exakt die drei
  vorbestehenden, in `12-05-SUMMARY.md` bereits als Ausgangsstand dokumentierten Fehlschläge
  (`unifiedOvertimeService.test.ts` × 2, `vacationBackfillService.test.ts` × 1). Kein zuvor
  grüner Test ist rot geworden.
- Beide in dieser Phase angelegten Desktop-Testdateien laufen weiterhin grün:
  `modalStack.test.ts` 6/6, `timeUtils.periods.test.ts` 9/9 (beide über `npx tsx`, da `vitest`
  projektweit durch fehlendes `@babel/runtime` blockiert bleibt — unverändert gegenüber
  12-02/12-08).
- Debugausgaben-Gate: `grep -rn "console.log"` über `ConfirmDialog.tsx`, `EditUserModal.tsx`,
  `UserManagementPage.tsx` liefert 0 Treffer; `console.error`/`console.warn` sind an den drei
  bekannten Stellen erhalten. `Modal.tsx`, `WorkScheduleEditor.tsx`, `OvertimeTransactions.tsx`
  bleiben ebenfalls bei 0.
- `any`-Gate: 13 in dieser Phase neu angelegte Dateien geprüft, 0 echte `: any`-Treffer (ein
  scheinbarer Treffer in `verifyDesktopEffectiveness.ts` ist ein Zählartefakt, siehe
  Deviations).
- Alle vier ROADMAP-Erfolgskriterien der Phase 12 haben einen benannten, grün laufenden
  Testbeleg (siehe „Abgleich gegen die ROADMAP-Erfolgskriterien").
- 38 UAT-Punkte aus den Plänen 12-01 bis 12-08 sind zu einer einzigen, durchnummerierten Liste
  zusammengezogen (siehe unten).

## Task Commits

Each task was committed atomically:

1. **Task 1: Den einen E2E-Test auf den neuen Bedienweg umschreiben** - `db06971` (test)
2. **Task 2: Pflicht-Gates fahren und die UAT-Liste für Phase 14 bündeln** - kein Codecommit
   (die Task ändert laut Plan ausdrücklich keinen Produktivcode; Ergebnis fließt in dieses
   SUMMARY und die abschließende Metadaten-Commit)

**Plan metadata:** (folgt mit diesem Commit — docs: complete plan)

## Files Created/Modified

- `desktop/tests/user-edit.spec.ts` - Ein Testfall auf den Wechsel-Dialog umgeschrieben,
  kaputter Selektor in genau diesem Test repariert

## Gate-Protokoll

**1. TypeScript-Gate**
```
cd server && npx tsc --noEmit   → exit 0, keine Ausgabe
cd desktop && npx tsc --noEmit  → exit 0, keine Ausgabe
```

**2. Testgate Server** (`cd server && npm test`)
```
Test Files  2 failed | 27 passed (29)
     Tests  3 failed | 403 passed (406)
```
Die drei Fehlschläge:
- `unifiedOvertimeService.test.ts` — „REGRESSION TESTS: Corrections and Hire Date (User 6 & 7
  Bug)" (zwei Fälle)
- `vacationBackfillService.test.ts` — „erkennt einen bereits gelaufenen Backfill"

Alle drei sind wortgleich die in `12-05-SUMMARY.md` dokumentierten, aus dem Ausgangsstand von
Plan 12-01 stammenden Fehlschläge. Kein neuer roter Test.

**3. Testgate Desktop** (in dieser Phase angelegte Testdateien)
```
npx tsx src/components/ui/modalStack.test.ts        → 6 Tests bestanden (Exit 0)
npx tsx src/utils/timeUtils.periods.test.ts          → 9 Tests bestanden (Exit 0)
npx vitest run src/services/workPeriodChangeService.test.ts (Server) → 14 passed (Exit 0)
```

**4. Debugausgaben-Gate**
```
grep -rn "console.log" desktop/src/components/ui/ConfirmDialog.tsx \
  desktop/src/components/users/EditUserModal.tsx \
  desktop/src/pages/UserManagementPage.tsx
→ 0 Treffer

grep -c "console.log" desktop/src/components/ui/Modal.tsx \
  desktop/src/components/users/WorkScheduleEditor.tsx \
  desktop/src/components/worktime/OvertimeTransactions.tsx
→ 0 / 0 / 0

grep -n "console.error\|console.warn" ConfirmDialog.tsx EditUserModal.tsx UserManagementPage.tsx
→ EditUserModal.tsx:164 console.error; UserManagementPage.tsx:132 console.warn,
  UserManagementPage.tsx:148-149 console.error — alle drei erhalten
```
Summe entfernter `console.log` über die Phase (aus 12-02 und 12-07 SUMMARYs, hier nur
gegengelesen, nicht erneut entfernt): `ConfirmDialog.tsx` 2 + `EditUserModal.tsx` 5 +
`UserManagementPage.tsx` 9 = **16**, deckt sich mit der in `12-UI-SPEC.md` genannten Zielzahl.

**5. `any`-Gate für neuen Code dieser Phase** (`grep -c ": any"`, geprüfte Dateien):
```
server/src/database/migrations/011_add_model_change_transaction_type.ts   0
server/src/routes/workPeriods.ts                                          0
server/src/services/workTimeChangeToken.ts                                0
server/src/services/workTimeChangeToken.test.ts                           0
server/src/services/workPeriodChangeService.ts                            0
server/src/services/workPeriodChangeService.test.ts                       0
server/src/scripts/verifyDesktopEffectiveness.ts                          1 (Zählartefakt, s.u.)
desktop/src/components/ui/modalStack.ts                                   0
desktop/src/components/ui/modalStack.test.ts                              0
desktop/src/hooks/useWorkTimeChange.ts                                    0
desktop/src/components/worktime/WorkTimePeriodList.tsx                    0
desktop/src/components/worktime/WorkTimeChangeModal.tsx                   0
desktop/src/utils/timeUtils.periods.test.ts                               0
```

## Abgleich gegen die ROADMAP-Erfolgskriterien

| # | Erfolgskriterium (ROADMAP Phase 12) | Beleg |
|---|---|---|
| 1 | Eine Umstellung 40→20 zum 01.10. verändert die Überstunden vor dem 01.10. um keine Minute | `workPeriodChangeService.test.ts:158` — `it('REQ-28: Ein Stichtag in der Zukunft laesst jede Buchung davor unveraendert und erzeugt keine model_change-Buchung')`, grün |
| 2 | Ein rückwirkender Stichtag rechnet ab dem 01.07. neu und lässt davor alles stehen | `workPeriodChangeService.test.ts:210` — `it('REQ-26: Ein rueckwirkender Stichtag rechnet ab seinem Datum neu und laesst jede Buchung davor unveraendert')`, grün |
| 3 | Die Vorschau zeigt vor dem Speichern denselben Wert, der danach tatsächlich im Konto steht | `workPeriodChangeService.test.ts:270` — `it('REQ-27: Vorschau und Speichern liefern paarweise exakt dieselben Werte, der gespeicherte Saldo stimmt mit getOvertimeBalance() ueberein')`, grün; zusätzlich in `12-05-SUMMARY.md` durch einen absichtlich verfälschten Lauf als scharf nachgewiesen (`expected 229 to be 228` bei künstlicher Abweichung) |
| 4 | Die Saldodifferenz ist im Kontoauszug als eigene Zeile mit Begründung sichtbar | `workPeriodChangeService.test.ts:349` — `it('REQ-29: Die model_change-Zeile ist im Journal sichtbar, traegt die Begruendung woertlich, und wird im ueber getOvertimeBalance() gelesenen Saldo nicht doppelt gezaehlt')`, grün; UI-seitig durch den in `12-07-SUMMARY.md` dokumentierten Merge-Fix in `overtimeLiveCalculationService.ts` sichtbar gemacht |

Alle vier Kriterien sind belegt (automatisierter Test, Exit 0). Kein blockierender Befund.

## E2E-Ausführung

Der umgeschriebene Test wurde tatsächlich ausgeführt (`node
node_modules/@playwright/test/cli.js test tests/user-edit.spec.ts -g "Change employee to 0
hours"`), nicht nur code-seitig geprüft. Ergebnis: **blockiert durch die lokale Umgebung, vor
Erreichen des geänderten Testcodes** — der Test scheitert bereits im gemeinsamen
`beforeEach`-Login (`loginAsAdmin`, unverändert, nicht Teil dieses Plans):

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('text=Admin Dashboard') to be visible
    at fixtures\auth.ts:26
```

**Ursache, verifiziert vor dem Testlauf:** Port 3000 (die von `desktop/.env.development`
(`VITE_API_URL=http://localhost:3000/api`) erwartete Backend-Adresse) ist auf dieser Maschine
durch ein unabhängiges, bereits laufendes Next.js-Projekt belegt
(„Stiftung DPolG Website" — `curl http://localhost:3000/api/health` liefert dessen
Next.js-Fehlerseite, kein `{"status":"ok",...}`). Port 1420 bedient bereits eine aktive
Vite-Dev-Session (Prozess `node.exe`, PID 26124, mit einer verbundenen Chrome-Instanz, PID
44944) — diese zeigt ebenfalls auf den falschen Port 3000 und darf nicht angehalten werden, da
sie nicht Teil dieser Ausführung ist und möglicherweise von einer parallelen Sitzung genutzt
wird. `playwright.config.ts` bindet `baseURL` fest an `http://localhost:1420` (kein
Env-Override vorgesehen) — dessen Änderung liegt außerhalb des in diesem Plan festgelegten
Änderungsumfangs (`files_modified: desktop/tests/user-edit.spec.ts`).

Dasselbe Port-3000-Problem ist in `12-01-SUMMARY.md` und `12-05-SUMMARY.md` bereits für reine
HTTP-Verifikationen dokumentiert (dort mit `PORT=3099` umgangen) — für einen vollständigen
Playwright-Lauf reicht das nicht, weil die bereits laufende Desktop-Session auf Port 1420 nicht
angehalten werden darf und `baseURL` nicht per Kommandozeile überschrieben werden kann, ohne
die Konfigurationsdatei zu ändern.

**Bewertung:** Kein Befund am geänderten Testcode selbst — der Fehler tritt vor jeder Zeile
dieses Plans auf, im unveränderten Login-Fixture. Der Test ist bereit; seine Ausführung bis zum
Ende ist in dieser lokalen Umgebung nicht möglich, ohne entweder die laufende Fremd-Session auf
Port 1420 zu stören oder `playwright.config.ts` außerhalb des Plan-Scopes zu ändern. Als
UAT-Punkt für Phase 14 aufgenommen (siehe Liste, Punkt 39).

## Vorbestehende, nicht behobene Defekte

- **Sieben Vorkommen von `button[aria-label="Bearbeiten"]`** in `desktop/tests/user-edit.spec.ts`
  (in den übrigen sechs Testfällen dieser Datei) — das Attribut existiert nicht im DOM
  (`UserManagementPage.tsx:461-467` rendert `<Button variant="ghost">Bearbeiten</Button>` ohne
  `aria-label`), diese sechs Tests würden am selben Selektorfehler scheitern wie der hier
  reparierte. Kein Aufräumfeldzug laut Plan-Anweisung — nur der eine betroffene Test war
  Gegenstand dieses Plans.
- **Starre `grid-cols-2`/`grid-cols-3` ohne Breakpoint** in `EditUserModal.tsx` (Zeile
  ~197/216/238/280) — bereits in `12-07-SUMMARY.md` als vorbestehende Altlast vermerkt.
- **`any`-Typ in `OvertimeTransactions.tsx`**
  (`data.transactions.map((transaction: any, index: number) => ...)`) — bereits in
  `12-07-SUMMARY.md` dokumentiert, dort bewusst nicht angefasst.
- **Fehlende Spalten `balanceBefore`/`balanceAfter` im `CREATE TABLE overtime_transactions` von
  `schema.ts`** — vorbestehend seit Migration 005, in `12-01-SUMMARY.md` als „Beobachtete
  Altlast" dokumentiert; betrifft nur eine theoretische Neuinstallation ohne Migrationslauf,
  nicht den realen Migrationspfad.
- **Vollständige Auflösung der Desktop-Client-Kopie aus WR-12** bleibt offen —
  `desktop/src/utils/timeUtils.ts` trägt weiterhin eine eigene, zeichengleiche Kopie der
  Server-Intervalllogik (`resolveWorkTimePeriodIn`/`calculateAbsenceHoursWithWorkSchedule`)
  statt eines gemeinsamen Codepfads; in `12-08-SUMMARY.md` ausdrücklich als „mittelfristig,
  außerhalb dieser Phase" benannt.

## D8 — kein Release in dieser Phase

Phase 12 liefert Server- und Desktop-Code, veröffentlicht aber **kein** Release. Kein Tag, kein
Versionssprung in `desktop/package.json`/`Cargo.toml`/`tauri.conf.json`, kein
`gh release create`. Die Abnahme dieser Phase läuft über den lokalen Dev-Server (`server && npm
run dev` bzw. der bereits laufende Prozess) plus `npm run sync-dev-db` gegen eine frische
Kopie der Produktionsdatenbank. Die in Phase 12 gebauten Desktop-Änderungen (Wechsel-Dialog,
schreibgeschützte Stammdatenfelder, Modal-Stack, Periodenliste) erreichen die Anwender erst mit
dem gebündelten Release in Phase 14 — bis dahin läuft die produktiv installierte Desktop-App
(v1.8.0) unverändert mit dem alten Bedienweg weiter.

## Decisions Made

Siehe `key-decisions` im Frontmatter.

## Deviations from Plan

### Beobachtung (kein Auto-Fix nötig)

**1. `any`-Gate-Zählartefakt in `verifyDesktopEffectiveness.ts`**
- **Gefunden während:** Task 2, `any`-Gate
- **Befund:** `grep -c ": any"` liefert 1 statt 0. Die Fundstelle ist Zeile 153,
  `      : anyNonZero` — der Doppelpunkt des Ternary-Operators gefolgt von der Variable
  `anyNonZero` matcht die Zeichenfolge `": any"` rein textuell, ist aber keine
  TypeScript-`any`-Typannotation.
- **Bewertung:** `npx tsc --noEmit` (server) läuft sauber; ein echter `any`-Typ hätte dort
  keinen Compilerfehler ausgelöst (isoliertes Skript ohne strikten Kontext an dieser Stelle),
  aber eine manuelle Prüfung des Quelltexts bestätigt: keine Typannotation, reiner
  Variablenname. Dieselbe Kategorie Zählkonflikt wie in `12-01-SUMMARY.md`
  (`work_period`/`user_work_periods`) und `12-05-SUMMARY.md` (`requireAdmin`-Importzeile)
  dokumentiert. Kein Code geändert.

**2. E2E-Testartefakte nach dem Verifikationslauf entfernt**
- **Gefunden während:** Task 1, nach dem tatsächlichen Playwright-Lauf (siehe
  „E2E-Ausführung")
- **Befund:** Der Lauf erzeugte `desktop/test-results/` (Screenshot, Video, Trace,
  Error-Context) als neue untracked Dateien.
- **Bewertung:** Reines Testlauf-Artefakt, nicht Teil der Deliverables dieses Plans (weder in
  `files_modified` noch inhaltlich relevant für die Abnahme). Verzeichnis nach der Auswertung
  gelöscht (`rm -rf desktop/test-results`), `git status --short` danach wieder auf den
  Ausgangsstand (nur die bereits vor diesem Plan vorhandene, nicht zugehörige
  `10-REVIEW.md`).

---

**Total deviations:** 0 auto-fixed, 2 Beobachtungen ohne Codeänderung.
**Impact on plan:** Keine — beide Beobachtungen sind Zähl-/Artefaktfragen ohne fachliche
Auswirkung auf das Plan-Ziel.

## Issues Encountered

- Die Formularfelder in `WorkTimeChangeModal.tsx` (`Input`/`Textarea`) tragen keine
  `name`-Attribute und ihr `<label>` ist nicht über `htmlFor`/`id` mit dem Feld verknüpft
  (verifiziert in `Input.tsx`/`Textarea.tsx`, Zeile für Zeile gelesen) — der im Plan
  angedeutete Selektorstil `[name="..."]` (wie im `CreateUserModal`) funktioniert hier nicht.
  Der Test nutzt stattdessen die CSS-Adjazenz `label:has-text("Feldname") + input` bzw.
  `+ textarea`, die exakt der tatsächlichen DOM-Struktur entspricht (Label unmittelbar vor dem
  Feld, beide Geschwister desselben `<div>`).
- `npx playwright` ist über den `desktop/`-Workspace nicht auffindbar (kein `.bin`-Symlink);
  das Paket liegt im Root-`node_modules`. Direkter Aufruf über
  `node node_modules/@playwright/test/cli.js` aus dem Root funktioniert und wurde für den
  tatsächlichen Verifikationslauf verwendet.

## User Setup Required

None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness

- Phase 12 ist mit diesem Plan vollständig: alle 9 Pläne haben eine SUMMARY, der zuvor rot
  gewordene Bestandstest ist repariert, beide Pflicht-Gates sind grün, alle vier
  ROADMAP-Erfolgskriterien sind belegt.
- Phase 13 (Korrigieren und rückgängig machen) kann auf dem unveränderten
  `renderActions`-Schnitt von `WorkTimePeriodList` und der `readOnly`-Prop von
  `WorkScheduleEditor` aufsetzen (aus Plan 12-02/12-04/12-07).
- Phase 14 (Absicherung und Auslieferung) erbt: die gebündelte UAT-Liste unten (38+1 Punkte),
  den offenen E2E-Ausführungsblocker aus dieser lokalen Umgebung (Punkt 39), D8 (kein Release
  in Phase 12/13, gebündelt in Phase 14), und die fünf oben gelisteten vorbestehenden Defekte.
- Kein Blocker für Phase 13.

## UAT-Punkte für Phase 14

Gebündelt aus den Abschnitten „UAT-Punkte für Phase 14" der Pläne 12-01 bis 12-08, durchnummeriert. Format je Punkt: was zu prüfen ist / wo / erwartetes Ergebnis — (Herkunftsplan).

1. Migration 011 auf der Produktionskopie: Zeilenzahl `overtime_transactions` vor/nach identisch, `PRAGMA integrity_check` = `ok`. Lokal bereits verifiziert; Produktionslauf ist Teil von Phase 14 (D8). — (12-01)
2. `GET /api/work-periods` mit echter Mitarbeiter-Session gegen fremde `userId`: HTTP 403, keine Perioden im Antwortkörper. Lokal bereits verifiziert; Produktionsnachweis mit echten Passwörtern ist Sache der Phase-14-Abnahme. — (12-01)
3. Bestehendes Modal (z. B. Zeiteintrag/Benutzer bearbeiten) im hellen und dunklen Modus: Erscheinungsbild, Backdrop-Klick, ESC unverändert zu v1.8.0, kein Flackern durch Portal-Rendering. — (12-02)
4. `ConfirmDialog` öffnen (z. B. „Benutzer löschen"): X-Button hat zugänglichen Namen, ESC schließt (bisher nicht), „Löschen"/„Abbrechen" sonst unverändert. — (12-02)
5. Zwei übereinanderliegende Dialoge (Wechsel-Dialog über `EditUserModal`, `ConfirmDialog` über dem Wechsel-Dialog) mit ESC: nur der oberste schließt, darunterliegende Formulare bleiben mit allen Eingaben offen. Jetzt im realen Einbettungskontext prüfbar (seit 12-07). — (12-02, 12-07)
6. Nach Schließen eines Dialogs per Tab weiterspringen: Fokus steht auf dem auslösenden Element. — (12-02)
7. Screenreader/Accessibility-Panel am X-Button beider Dialogtypen: „Dialog schließen"/„Abbrechen" angesagt, nicht „Schaltfläche". — (12-02)
8. Innerhalb eines offenen Dialogs mehrfach Tab drücken: Fokusfalle springt vom letzten zum ersten Element zurück, nicht aus dem Dialog heraus. — (12-02)
9. Rückwirkender Wechsel auf einer Kopie der Produktionsdatenbank für einen Nutzer mit vielen Zeiteinträgen: Laufzeit von `applyWorkTimeChange()` unter 10 Sekunden, Server bleibt antwortfähig. — (12-03)
10. Abgebrochener Speichervorgang (Server während des Laufs beendet): weder neue Periode noch `model_change`-Buchung darf danach vorhanden sein (Transaktionsklammer). — (12-03)
11. `previewToken` über einen echten Serverneustart hinweg: ein vor dem Neustart ausgestelltes, noch gültiges Token bleibt gültig (Zustandslosigkeit). — (12-03)
12. Rundungsverhalten bei `balanceDelta`/`targetHoursDelta` über mehrere Monate bei sehr langen rückwirkenden Zeiträumen — Abgleich mit `npm run validate:overtime:detailed`. — (12-03)
13. Periodenliste im hellen/dunklen Modus: Kontrast der Badges („Aktuell"/„Geplant") und Tabellentexte mindestens so gut wie im bestehenden Kontoauszug. — (12-04)
14. Fenster unter 640 px: Periodenliste horizontal scrollbar, kein abgeschnittener Inhalt. — (12-04)
15. Nutzer mit mehreren Perioden: jüngste Umstellung oben, heute gültige trägt „Aktuell", künftige „Geplant" — visuell mit echten Mehrperioden-Daten zu bestätigen. — (12-04)
16. Fehler-/Wiederholzustand der Periodenliste bei gestopptem Server: Fehlertext erscheint, „Perioden erneut laden" lädt nach Serverneustart erfolgreich nach. — (12-04)
17. Vollständiger Vorschau→Speichern-Zyklus auf einer Kopie der Produktionsdatenbank für einen realen Nutzer: derselbe im Kontoauszug angezeigte Saldo wie in der Vorschau notiert. — (12-05)
18. Für alle Nutzer OHNE Modellwechsel: `getOvertimeBalance()` vor/nach einem Testlauf identisch — kein Seiteneffekt auf unbeteiligte Nutzer, gegen vollständigen Produktionsbestand zu messen. — (12-05)
19. `checkAllPeriodChains()` gegen die Produktionskopie nach einem realen Wechsel: kein Befund. — (12-05)
20. `PREVIEW_STALE` in der Desktop-Oberfläche: Dialog länger als 15 Minuten offen lassen, dann speichern — verständliche deutsche Fehlermeldung. — (12-05)
21. Visuelle Abnahme des Wechsel-Dialogs im hellen/dunklen Modus: hervorgehobene Saldoänderung (fett, farbig, Trendpfeil) ist das dominante Element, kein Konkurrenzelement. — (12-06)
22. Bedienung ausschließlich mit der Tastatur: Tab-Reihenfolge, Fokus beim Öffnen auf „Stichtag", ESC schließt nur obersten Dialog, Fokusrückgabe nach Schließen auf den Einstiegs-Button. — (12-06)
23. Rückwirkender Wechsel mit Differenz 0: Zeitraumsatz, „± 0:00h"-Anzeige, `ConfirmDialog` mit Nulldifferenz-Textvariante. — (12-06)
24. Fenster auf unter 640 px ziehen: Stichtag/Wochenstunden und Sollstunden-Kennzahlen stehen untereinander, nichts abgeschnitten. — (12-06)
25. Vorschau abrufen, 15 Minuten warten, dann speichern: automatische Neuberechnung beim ersten Fehlschlag, Rückfall in den Fehlerzustand beim zweiten. — (12-06)
26. Nutzer ohne jede vorherige Periode (frisch angelegt): Infopanel zeigt „Aktuell gültig seit {Eintrittsdatum}" als Fallback. — (12-06)
27. Kontrast des schreibgeschützten Wochenstundenfelds im hellen/dunklen Modus: mindestens 4,5:1, klar lesbar (kein `opacity`). — (12-07)
28. Vollständiger Bedienfluss im Desktop: Bearbeiten → „Stundenwechsel ab Datum …" → Dialog über Stammdatendialog → Eingaben → Vorschau → Speichern → Erfolgsbanner (8s)+Toast → Periodenliste und Wochenstundenfeld zeigen sofort den neuen Wert. — (12-07)
29. Kontoauszug desselben Nutzers: Zeile „Modellwechsel" (Teal-Badge) mit Betrag, Vorzeichen, Trendpfeil, Begründung, zweiter Zeile „Periode ab … · eingetragen am … von {Admin}" mit echtem Admin-Namen. — (12-07)
30. Bestehende Bedienwege der Nutzerverwaltung (Anlegen, Löschen, Deaktivieren, Passwort-Reset) verhalten sich unverändert zu v1.8.0. — (12-07)
31. Verschachtelter Dialog bei rückwirkendem Stichtag: `ConfirmDialog` (z-[70]) sichtbar über dem Wechsel-Dialog (z-[60]), der über dem `EditUserModal` (z-50) liegt — erstmals im realen Einbettungskontext sichtbar. — (12-07)
32. Abwesenheitsantrag über einen Stichtag hinweg im Desktop stellen: angezeigte Stundenzahl entspricht der nach Genehmigung tatsächlich gebuchten. — (12-08)
33. Abwesenheitsantrag über einen Feiertag: der Feiertag wird in der Vorschau nicht als Arbeitstag gezählt. — (12-08)
34. Server während des Ausfüllens nicht erreichbar: kein Zahlenanspruch, Hinweistext erscheint, Antrag bleibt absendbar. — (12-08)
35. `WorkScheduleDisplay` bei einem Nutzer mit mehreren Perioden: Zeile „Aktuell gültiges Modell seit …" nennt das `validFrom` der heute gültigen Periode. — (12-08)
36. Kompakter Modus von `WorkScheduleDisplay` (Dashboard-Widget) zeigt bewusst keine Stichtag-Zeile — zu klären, ob Phase 13/14 sie dort ergänzen soll. — (12-08)
37. Der E2E-Test „Change employee to 0 hours" (dieser Plan) ist auf den neuen Wechsel-Dialog umgestellt — vor einem Release in Phase 14 gegen eine funktionierende lokale Umgebung (Backend tatsächlich auf Port 3000, keine kollidierende Fremd-Session) auszuführen, da er in dieser Ausführungsumgebung nur bis zum Login-Fixture lief (siehe „E2E-Ausführung"). — (12-07, 12-09)
38. Die übrigen sieben `button[aria-label="Bearbeiten"]`-Selektoren in `user-edit.spec.ts` (sechs andere Testfälle) sind vorbestehend kaputt und laufen aktuell gegen denselben Fehler wie der hier reparierte — vor einem verlässlichen vollständigen E2E-Lauf in Phase 14 zu beheben (kein Aufräumfeldzug in diesem Plan). — (12-09)
39. Vollständiger Playwright-Lauf der gesamten `user-edit.spec.ts`-Datei gegen eine sauber konfigurierte lokale Umgebung (eigener Port 3000, kein Fremdprozess) — in dieser Ausführungsumgebung nicht möglich gewesen (siehe „E2E-Ausführung"). — (12-09)

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*

## Self-Check: PASSED

`desktop/tests/user-edit.spec.ts` verifiziert vorhanden und enthält die erwarteten Änderungen
(`grep -c "Stundenwechsel"` = 3, `grep -c 'button:has-text("Bearbeiten")'` = 1). Commit
`db06971` in `git log --oneline` nachgewiesen. `npx tsc --noEmit` läuft ohne Ausgabe (Exit 0)
in `server/` und `desktop/`. Server-Testsuite 403/406 grün (3 vorbestehend rot, unverändert
gegenüber Ausgangsstand). Beide Desktop-Testdateien dieser Phase (`modalStack.test.ts`,
`timeUtils.periods.test.ts`) laufen grün. Der tatsächliche Playwright-Lauf wurde ausgeführt und
sein Ergebnis (Blockade im Login-Fixture durch Portkonflikt) wortgetreu dokumentiert, nicht nur
behauptet. `git status --short` zeigt nach Aufräumen der Testartefakte nur die vor diesem Plan
bereits vorhandene, nicht zugehörige `10-REVIEW.md`.
