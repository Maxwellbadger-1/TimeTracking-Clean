---
phase: 10-perioden-fundament
plan: 04
subsystem: database
tags: [better-sqlite3, sqlite, typescript, service-layer, timezone-safety]

# Dependency graph
requires:
  - phase: 10-perioden-fundament (Plan 10-01)
    provides: Tabelle user_work_periods (Migration 008), Typen UserWorkPeriod/UserWorkPeriodRow
provides:
  - Die eine Auflösungsstelle im Projekt für „Periode zu einem Datum" — resolveWorkPeriodAt()
  - Lese-/Schreibpfad für Arbeitszeitperioden (getWorkPeriods, getCurrentWorkPeriod, createWorkPeriod, closeWorkPeriod)
  - checkPeriodChain() als Klartext-Diagnose neben den DB-Triggern (D3)
  - WorkPeriodConflictError als Übersetzung der Trigger-/CHECK-Fehler ins Deutsche
affects: [11-datumsabhaengige-berechnung, 12-stundenwechsel-bedienen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Eine Auflösungsstelle statt N Kopien: resolveWorkPeriodAt() ist der einzige Ort, der eine Periode zu einem Datum auflöst (Lehre aus 09-INVENTAR-KREDITIERUNG.md)"
    - "Zeitzonenfreiheit strukturell statt diszipliniert: keine Datumsarithmetik, reiner YYYY-MM-DD-Zeichenkettenvergleich (auch in SQL auf TEXT)"
    - "SqliteError aus Trigger/CHECK wird per Textbestandteil 'user_work_periods:' erkannt und in eine eigene, deutschsprachige Fehlerklasse mit cause übersetzt"
    - "Trigger-Bypass für Testzwecke ausschließlich innerhalb einer einzigen atomaren db.transaction() (DROP TRIGGER, Aktion, CREATE TRIGGER identisch zur Migration) — kein Fenster für konkurrierende Schreibzugriffe auf der geteilten Arbeitsdatenbank"

key-files:
  created:
    - server/src/services/workPeriodService.ts
    - server/src/services/workPeriodService.test.ts
  modified: []

key-decisions:
  - "Fehlermeldung für Überlappungs-Konflikte nennt das Substantiv 'Überlappung' (nicht das Verb 'überlappt'), damit sie exakt den in <behavior> geforderten Wortlaut trifft — im ersten Testlauf als Rule-1-Bug entdeckt und sofort korrigiert"
  - "checkPeriodChain-Test für eine per-SQL eingeschleuste Lücke entfernt den INSERT-Trigger nur innerhalb einer einzigen db.transaction() und stellt ihn mit wortgleicher DDL sofort wieder her, statt ihn für mehrere Statements offen zu lassen — SQLite hält den Schreiblock für die Dauer der Transaktion, kein anderer Prozess kann in der Lücke schreiben"
  - "getCurrentWorkPeriod() wirft bei mehr als einer offenen Periode statt eine davon stillschweigend auszuwählen — Datenfehler ist keine Auswahlfrage"

requirements-completed: [REQ-20, REQ-22]

# Metrics
duration: ~25min
completed: 2026-08-22
---

# Phase 10 Plan 04: workPeriodService — lesen, schreiben, zum Datum auflösen Summary

**Ein synchroner Service mit `resolveWorkPeriodAt()` als der einen zeitzonenfreien Auflösungsstelle für Arbeitszeitperioden im gesamten Projekt, plus Lese-/Schreibpfad mit deutschsprachiger Fehlerübersetzung der DB-Trigger — von niemandem in Phase 10 aufgerufen (D4/REQ-21, grep-belegt).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-21T23:38:00Z (ungefähr, Session-Beginn)
- **Completed:** 2026-08-22T00:03:36Z
- **Tasks:** 2/2
- **Files modified:** 2 (beide neu)

## Accomplishments
- `resolveWorkPeriodAt(userId, date)` implementiert die eine Auflösungsstelle des Projekts:
  `WHERE validFrom <= ? AND (validTo IS NULL OR validTo > ?)` — exakt das halboffene
  Intervall aus D1, ohne `new Date`, `toISOString` oder SQL-Datumsfunktion. Format wird per
  `/^\d{4}-\d{2}-\d{2}$/` zur Laufzeit geprüft (auch gegen ein zur Laufzeit übergebenes
  `Date`-Objekt, das die TypeScript-Signatur eigentlich schon ausschließt).
- `createWorkPeriod` verankert D2/REQ-20 in der Signatur: `workSchedule: WorkSchedule | null`
  ist ein Pflichtfeld, kein optionales — ein Aufruf ohne dieses Feld wird von `tsc`
  abgelehnt (Nachweis unten).
- `checkPeriodChain` liefert Klartext-Diagnosen für Überlappungen, Lücken und doppelte
  offene Perioden — ausdrücklich als Ergänzung zu, nicht Ersatz für die Trigger aus
  Migration 008 (D3), das steht wörtlich im Funktionskommentar.
- `WorkPeriodConflictError` übersetzt die `RAISE(ABORT, 'user_work_periods: ...')`-Meldungen
  der Trigger anhand des Textbestandteils `user_work_periods:` in verständliches Deutsch,
  behält die Originalmeldung als `cause`, reicht unbekannte Datenbankfehler unverändert
  durch.
- Ein Typwächter (`isWorkSchedule`) prüft beim Lesen alle sieben Wochentagsschlüssel; ein
  kaputter `workSchedule`-Text wirft mit Nennung der `periodId` statt als stille
  0-Stunden-Woche durchzurutschen (T-10-15).
- 28 Testfälle (Vorgabe: mindestens 20) decken die Auflösung an Monats-, Jahres-,
  Zeitumstellungs- und Schaltjahresgrenzen ab sowie den vollständigen Schreibpfad
  einschließlich Stichtagswechsel, workSchedule-Rundreise und `checkPeriodChain`.

## Task Commits

Each task was committed atomically:

1. **Task 1: workPeriodService — lesen, auflösen, schreiben** - `a766e97` (feat)
2. **Task 2: Grenzfälle der Auflösung und des Schreibpfads** - `7b67342` (test, enthält den
   Rule-1-Fix am Fehlertext aus Task 1)

_Keine expliziten TDD-Gates in diesem Plan (Task 2 ist mit `tdd="true"` markiert, aber die
Implementierung stand bereits aus Task 1 — der Test-Task hat hier die Funktion, die
Implementierung mit den Grenzfällen zu belegen, nicht sie im RED/GREEN-Zyklus zu erzeugen)._

## Files Created/Modified
- `server/src/services/workPeriodService.ts` - Service: `getWorkPeriods`,
  `getCurrentWorkPeriod`, `resolveWorkPeriodAt`, `createWorkPeriod`, `closeWorkPeriod`,
  `checkPeriodChain`, `WorkPeriodConflictError`. Kopfkommentar erklärt WARUM (eine
  Auflösungsstelle statt zwölf Kopien, Zeitzonenfreiheit strukturell, Grenze zu Phase 12).
- `server/src/services/workPeriodService.test.ts` - 28 Tests: 15 zur Auflösung
  (Grenzfälle + Formatverstöße + Laufzeit-`Date`-Objekt), 3 zum Lesepfad, 6 zum Schreibpfad,
  2 zu `checkPeriodChain`, 1 Aufräumnachweis am Dateiende.

## Decisions Made
- Fehlertext für Überlappungs-Konflikte nennt das Substantiv „Überlappung", nicht das Verb
  „überlappt" — der erste Testlauf schlug fehl (`expected '...überlappt...' to contain
  'Überlappung'`), korrigiert in `workPeriodService.ts` (Rule 1, siehe unten).
- Der Test für die per-SQL eingeschleuste Lücke in `checkPeriodChain` entfernt den
  INSERT-Trigger nicht dauerhaft: `db.transaction(() => { DROP TRIGGER ...; INSERT ...;
  CREATE TRIGGER ... })()` — eine einzige atomare Transaktion, die den SQLite-Schreiblock
  hält, sodass in der Zwei-Prozess-Situation dieses Plans (zwei weitere Executor-Agenten
  liefen zeitgleich in derselben Arbeitsdatenbank) kein Fenster für einen fremden Schreib-
  zugriff ohne aktiven Guard entsteht. Die wiederhergestellte Trigger-DDL ist eine wörtliche
  Kopie aus `008_create_user_work_periods.ts:176-196`.
- `getCurrentWorkPeriod` wirft bei mehr als einer offenen Periode, statt eine auszuwählen —
  der partielle UNIQUE-Index sollte das ohnehin verhindern; träte es doch auf, ist das ein
  Datenfehler, keine Auswahlfrage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fehlertext für Überlappungs-Konflikte traf nicht den geforderten Wortlaut**
- **Found during:** Task 2, erster Testlauf von `workPeriodService.test.ts`
- **Issue:** `translateWorkPeriodError` formulierte den Überlappungsfall als „Die Periode
  überlappt mit einer bestehenden Periode desselben Nutzers." — der Plan verlangt, dass die
  Meldung das Substantiv „Überlappung" nennt (Test: `expect(...).toContain('Überlappung')`
  scheiterte, da nur die Verbform vorkam).
- **Fix:** Formulierung auf „Überlappung mit einer bestehenden Periode desselben Nutzers."
  geändert (Substantiv am Satzanfang).
- **Files modified:** `server/src/services/workPeriodService.ts`
- **Verification:** `npx vitest run src/services/workPeriodService.test.ts` — 28/28 grün
  nach dem Fix (vorher 27/28).
- **Committed in:** `7b67342` (Task 2 commit, zusammen mit der Testdatei)

**2. [Rule 1 - Bug] Kommentarwortlaut löste versehentlich die eigenen grep-Verbotskriterien aus**
- **Found during:** Task 1, Selbstverifikation der Acceptance Criteria
- **Issue:** Der Kopfkommentar erklärte die Zeitzonenfalle mit dem wörtlichen Code-Ausdruck
  `new Date('2026-08-01')` und dem Wort `toISOString` — beides matcht das grep-Kriterium
  `grep -c "toISOString\|new Date(" workPeriodService.ts`, das laut Acceptance Criteria `0`
  ergeben muss, auch wenn es sich um reinen Kommentartext ohne Codeausführung handelt.
- **Fix:** Beide Textstellen umformuliert, ohne die wörtliche Zeichenkette `new Date(` bzw.
  `toISOString` zu verwenden, Bedeutung unverändert erhalten.
- **Files modified:** `server/src/services/workPeriodService.ts`
- **Verification:** `grep -c "toISOString\|new Date(\|: any\|async " src/services/workPeriodService.ts`
  ergibt `0`.
- **Committed in:** `a766e97` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Bugs, keiner in der fachlichen Logik — einer in der
Fehlertext-Formulierung, einer in einem Kommentar). Keine Auswirkung auf das Verhalten des
Auflösungs- oder Schreibpfads.
**Impact on plan:** Beide Fixes waren notwendig, damit die im Plan wörtlich verankerten
Acceptance Criteria tatsächlich erfüllt sind. Kein Scope Creep.

## Nachweis: Aufrufer-Grep (REQ-21/D4)

```
grep -rn "workPeriodService" server/src --include=*.ts | grep -v "workPeriodService.ts:\|workPeriodService.test.ts:"
```
liefert keine Zeile. Kein bestehender Service, keine Route, kein Skript importiert
`workPeriodService` — Phase 10 ändert das Verhalten des Systems nicht (REQ-21).

## Nachweis: D2-Gegenprobe (Pflichtfeld workSchedule)

Probeaufruf (danach entfernt, `git status` zeigt keine Reste):
```ts
createWorkPeriod({ userId: 1, validFrom: '2026-01-01', weeklyHours: 40 });
```
`npx tsc --noEmit` lehnt ihn ab:
```
src/services/_probe_d2.ts(3,18): error TS2345: Argument of type '{ userId: number; validFrom: string; weeklyHours: number; }' is not assignable to parameter of type 'CreateWorkPeriodInput'.
  Property 'workSchedule' is missing in type '{ userId: number; validFrom: string; weeklyHours: number; }' but required in type 'CreateWorkPeriodInput'.
```
D2/REQ-20 ist damit in der Signatur verankert, nicht nur behauptet.

## Nachweis: Aufräumnachweis (keine Testperiode bleibt zurück)

Während der Entwicklung dieses Plans hat der parallel laufende Executor von Plan 10-03
Migration 009 (Bestandsüberführung) auf derselben Arbeitsdatenbank ausgeführt — die
Zählabfrage traf deshalb auf 20 reguläre Bestandsperioden statt auf eine leere Tabelle.
Der Abschlusstest in `workPeriodService.test.ts` behandelt genau diesen Fall (siehe
`<action>`-Vorgabe des Plans: „falls Migration 009 gelaufen ist, zählt stattdessen: keine
Zeile mit dem Testmarker"):

```
node -e "... SELECT COUNT(*) as count FROM user_work_periods ..." → { count: 20 }
node -e "... SELECT COUNT(*) as count FROM user_work_periods WHERE note = 'workperiod-test-marker-10-04' ..." → { count: 0 }
```

Alle 20 vorhandenen Zeilen tragen die Notiz `[MIGRATION-009] Bestandsüberführung, Quelle:
hireDate` — keine davon stammt aus diesem Testlauf. `npx vitest run
src/services/workPeriodService.test.ts` lief nach Bekanntwerden dieser Bestandsdaten
erneut, weiterhin 28/28 grün.

## Issues Encountered
Zwei weitere Executor-Agenten (Pläne 10-02, 10-03) liefen zeitgleich in derselben
Arbeitsdatenbank. Migration 009 (Plan 10-03) ist während dieser Ausführung angewendet
worden und hat 20 Bestandsperioden für echte Nutzer angelegt — kollisionsfrei mit diesem
Plan, da `checkPeriodChain`-Test für die eingeschleuste Lücke ausschließlich mit dem
eigenen Testnutzer (eindeutiger `username`) arbeitet und der Trigger-Bypass in einer
einzigen atomaren Transaktion lief. Keine fremde Arbeit berührt, `git add` erfolgte
ausschließlich dateiweise für die beiden eigenen Dateien dieses Plans.

## User Setup Required

None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness

- `resolveWorkPeriodAt()` steht für Phase 11 bereit — die datumsabhängige Berechnung kann
  sich vollständig daran hängen, ohne eine zweite Auflösungslogik zu bauen.
- `createWorkPeriod`/`closeWorkPeriod` stehen für den Stichtagswechsel aus Phase 12 bereit;
  die Aneinanderreihung beider Schritte zu einem einzigen (ggf. transaktional geklammerten)
  Vorgang ist ausdrücklich noch offen — das ist Phase 12, nicht dieser Plan.
- Kein Aufrufer in Phase 10 (grep-belegt), `users.weeklyHours`/`users.workSchedule`
  mechanisch unangetastet — dieser Plan hat keinen Code berührt, der die beiden Felder
  liest oder schreibt.
- Kein `git push`, kein Deployment ausgeführt.

---
*Phase: 10-perioden-fundament*
*Completed: 2026-08-22*

## Self-Check: PASSED

Beide erstellten Dateien (`server/src/services/workPeriodService.ts`,
`server/src/services/workPeriodService.test.ts`) und diese SUMMARY sowie beide
Commit-Hashes (`a766e97`, `7b67342`) wurden gegen das Dateisystem bzw.
`git log --oneline --all` verifiziert und gefunden. Keine fehlenden Artefakte.
