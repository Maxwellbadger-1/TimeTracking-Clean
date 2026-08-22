---
phase: 12-stundenwechsel-bedienen
plan: 08
subsystem: ui
tags: [react, typescript, sqlite, better-sqlite3, tauri, desktop]

# Dependency graph
requires:
  - phase: 12-stundenwechsel-bedienen
    plan: 04
    provides: "useWorkPeriods(userId) und die Desktop-Vertragstypen (WorkTimePeriod), Voraussetzung fuer die periodengetreue Client-Kopie"
  - phase: 11-datumsabh-ngige-berechnung
    plan: 99
    provides: "11-DESKTOP-DISPOSITION.md — Uebergabe des WR-12-Nachzugs mit gemessenem Wirksamkeitsfenster (drei Zahlen, damals alle 0)"
provides:
  - "desktop/src/utils/timeUtils.ts: periodengetreue calculateAbsenceHoursWithWorkSchedule/countWorkingDaysForUser (Signatur (startDate, endDate, periods, holidayDates)) plus resolveWorkTimePeriodIn — zeichengleiche Intervalllogik zu resolveWorkPeriodIn() im Server"
  - "AbsenceRequestForm.tsx rechnet die Vorschau periodengetreu ueber useWorkPeriods+useMultiYearHolidays; behauptet keine Zahl, solange Perioden/Feiertage nicht geladen sind"
  - "WorkScheduleDisplay.tsx nennt im Detail-Modus den Stichtag der heute gueltigen Periode (\"Aktuell gültiges Modell seit …\")"
  - "server/src/scripts/verifyDesktopEffectiveness.ts — rein lesendes Messwerkzeug fuer die drei Zahlen aus 11-DESKTOP-DISPOSITION.md"
affects: [13-korrigieren-und-rueckgaengig-machen, 14-absicherung-und-auslieferung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-Kopie einer Server-Regel wird mit einem Kopfkommentar versehen, der die Zeilennummer der Server-Quelle nennt und jede Abweichung als Dual-Calculation-Fehler kennzeichnet (Muster aus 11-Review, hier erstmals im Desktop angewendet)"
    - "vitest ist im lokalen Environment projektweit durch eine fehlende @babel/runtime-Abhaengigkeit blockiert; Testdateien mit demselben Namensmuster (*.test.ts) laufen stattdessen als npx-tsx-Pruefskript mit node:assert/strict (Muster aus 12-02-SUMMARY.md, hier erweitert um einen Kindprozess-Zeitzonentest via createRequire + tsx/cli statt npx.cmd, um den Windows-shell:true-Quotingfehler bei Pfaden mit Leerzeichen zu vermeiden)"
    - "Read-only Messwerkzeuge gegen eine Arbeitskopie: readonly:true + PRAGMA query_only=ON (doppelte Absicherung), Produktionsschutz-Guard aus verifyPeriodNullEffect.ts uebernommen, Unversehrtheitsnachweis ueber Dateigroesse/Zeitstempel vor und nach der Messung"

key-files:
  created:
    - desktop/src/utils/timeUtils.periods.test.ts
    - server/src/scripts/verifyDesktopEffectiveness.ts
    - .planning/phases/12-stundenwechsel-bedienen/deferred-items.md
  modified:
    - desktop/src/utils/timeUtils.ts
    - desktop/src/utils/index.ts
    - desktop/src/components/absences/AbsenceRequestForm.tsx
    - desktop/src/components/worktime/WorkScheduleDisplay.tsx

key-decisions:
  - "WR-12 Weg (b) gewaehlt (Client-Kopie periodengetreu machen, nicht Server-Vorschau-Endpunkt) — wortgleich mit der im Plan vorgegebenen Begruendung: kein bestehender Endpunkt fuer eine Vorschau vor Antragstellung, Perioden-Lese-API aus 12-01 bereits vorhanden"
  - "Arbeitskopie fuer die Wirksamkeitsmessung aus server/database/development.db statt server/database.db gezogen — server/database.db ist in dieser lokalen Windows-Umgebung eine veraltete, unmigrierte Datei ohne user_work_periods-Tabelle (Rule 3, siehe Deviations)"
  - "Aktuell gültiges Modell seit …\" nur im Detail-Modus von WorkScheduleDisplay ergaenzt, nicht im Kompakt-Modus — die Acceptance-Criteria verlangt genau einen Treffer der Zeichenkette in der Datei"
  - "Zeitzonentest fuer die neun Verhaltensregeln laeuft ueber einen echten Kindprozess mit TZ=UTC und TZ=Europe/Berlin (process.execPath + tsx/cli-Pfad ueber createRequire, keine npx.cmd/shell:true-Invocation) statt einer Behauptung — auf Windows brach die erste Fassung mit shell:true an einem Pfad mit Leerzeichen"

patterns-established: []

requirements-completed: [REQ-26]

# Metrics
duration: ~35min
completed: 2026-08-22
---

# Phase 12 Plan 08: Desktop-Nachzug auf den periodengetreuen Massstab (WR-12) Summary

**Desktop-Berechnungsfunktionen (`calculateAbsenceHoursWithWorkSchedule`, `countWorkingDaysForUser`) rechnen jetzt periodengetreu mit zeichengleicher Intervalllogik zum Server, die Antragsvorschau behauptet keine Zahl mehr ohne geladene Perioden, und die drei Messzahlen aus `11-DESKTOP-DISPOSITION.md` sind erneut erhoben — Zahl 1 ist nach einem eingetragenen Wechsel nicht mehr null.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completed
- **Files modified:** 7 (3 neu, 4 geändert)

## Accomplishments

- `desktop/src/utils/timeUtils.ts`: neue, exportierte `resolveWorkTimePeriodIn(periods, date)` mit einer Intervallbedingung, die Zeichen für Zeichen `resolveWorkPeriodIn()` (`server/src/services/workPeriodService.ts:241-251`) entspricht; `calculateAbsenceHoursWithWorkSchedule`/`countWorkingDaysForUser` auf `(startDate, endDate, periods, holidayDates)` umgestellt, Reihenfolge Wochenende → Feiertag → Periode → Stunden wie im Server-Gegenstück (`server/src/utils/workingDays.ts:240`)
- `timeUtils.periods.test.ts`: neun Testfälle (ein Fall je `<behavior>`-Punkt des Plans), inklusive eines echten Kindprozess-Laufs mit `TZ=UTC` und `TZ=Europe/Berlin`, der bestätigt, dass kein Ergebnis von der Rechner-Zeitzone abhängt — alle neun grün, Exitcode 0
- `AbsenceRequestForm.tsx`: `useWorkPeriods` + `useMultiYearHolidays` speisen die Vorschau; solange Perioden/Feiertage laden oder das Laden fehlschlägt, erscheint keine Zahl, sondern ein neutraler Hinweis — der Antrag bleibt in beiden Fällen absendbar, weil der Server ohnehin selbst rechnet (`requiredHours` geht nicht in den Payload)
- `WorkScheduleDisplay.tsx`: additive Zeile „Aktuell gültiges Modell seit {TT.MM.JJJJ}" im Detail-Modus, Datum = `validFrom` der heute gültigen Periode aus `useWorkPeriods`
- `server/src/scripts/verifyDesktopEffectiveness.ts`: rein lesendes Werkzeug (Produktionsschutz, `readonly:true` + `PRAGMA query_only=ON`), erhebt die drei Messzahlen aus der Disposition wortgleich erneut — siehe „Wirksamkeitsfenster nach Phase 12" unten
- Alle grep-basierten Acceptance-Criteria beider Desktop-Tasks und aller drei Task-Verify-Kommandos sind grün, `npx tsc --noEmit` ist sowohl in `desktop/` als auch in `server/` sauber

## Task Commits

Each task was committed atomically:

1. **Task 1: timeUtils periodengetreu machen — Perioden, Wochenenden, Feiertage** - `5c46478` (feat)
2. **Task 2: Aufrufstellen umhaengen — AbsenceRequestForm und WorkScheduleDisplay** - `15a375e` (feat)
3. **Task 3: Wirksamkeitsfenster erneut messen — die drei Zahlen aus der Desktop-Disposition** - `85ad248` (feat)

**Plan metadata:** (folgt mit diesem Commit — docs: complete plan)

## Files Created/Modified

- `desktop/src/utils/timeUtils.ts` - `resolveWorkTimePeriodIn` (neu), `calculateAbsenceHoursWithWorkSchedule`/`countWorkingDaysForUser` auf periodengetreue Signatur umgestellt
- `desktop/src/utils/index.ts` - Re-Export um `resolveWorkTimePeriodIn` ergänzt
- `desktop/src/utils/timeUtils.periods.test.ts` - neun Testfälle (npx tsx + node:assert, vitest projektweit blockiert)
- `desktop/src/components/absences/AbsenceRequestForm.tsx` - periodengetreue Vorschau, kein Zahlenanspruch ohne geladene Perioden/Feiertage, zwei vorbestehende Debug-Logs entfernt
- `desktop/src/components/worktime/WorkScheduleDisplay.tsx` - Stichtag-Zeile im Detail-Modus
- `server/src/scripts/verifyDesktopEffectiveness.ts` - Messwerkzeug für die drei Zahlen der Disposition
- `.planning/phases/12-stundenwechsel-bedienen/deferred-items.md` - zwei vorbestehende, außerhalb des Scopes liegende Funde

## Gewaehlter Weg fuer WR-12

`11-DESKTOP-DISPOSITION.md` nennt zwei Wege: (a) die Vorschau vom Server holen, oder (b) die
Client-Kopie periodengetreu machen. Gewählt ist **(b)**, wörtlich aus dem Plan übernommen:
Für (a) gibt es heute keinen Endpunkt — die Anreicherung `calculatedHours` in
`getAbsenceRequestsPaginated()` gilt für **bestehende** Anträge, nicht für einen noch nicht
angelegten; (a) hieße, in dieser Phase einen weiteren Endpunkt samt Entprellung zu bauen,
während die Perioden-Lese-API (`useWorkPeriods`, aus Plan 12-01/12-04) bereits vorhanden ist.

Der Preis von (b) ist das bekannte Dual-Calculation-Risiko. Er wird in diesem Plan bezahlt,
indem:
- die Intervalllogik zeichengleich aus `resolveWorkPeriodIn()` übernommen wurde (Kopfkommentar
  nennt die Quellzeile `server/src/services/workPeriodService.ts:241-251`),
- die Reihenfolge Wochenende → Feiertag → Periode → Stunden exakt dem Server-Gegenstück
  (`server/src/utils/workingDays.ts:240`) folgt,
- ein Testfall (`timeUtils.periods.test.ts`) `validFrom` inklusiv und `validTo` exklusiv
  festnagelt,
- eine Gegenprobe (unten) denselben Zeitraum einmal über die Desktop-Funktion und einmal über
  die Server-Funktion rechnet und beide Werte vergleicht.

**Die vollständige Auflösung der Client-Kopie bleibt offen.** WR-12 nennt sie "mittelfristig" —
das ist außerhalb dieser Phase und dieses Plans. Solange `timeUtils.ts` eine eigene
Implementierung der Server-Regel trägt, ist jede künftige Änderung an
`calculateAbsenceHoursWithWorkSchedule`/`resolveWorkPeriodIn` im Server verpflichtet, das
Desktop-Gegenstück zu prüfen — der Kopfkommentar in `timeUtils.ts` hält das ausdrücklich fest.

## Wirksamkeitsfenster nach Phase 12

`11-DESKTOP-DISPOSITION.md` sagte voraus: "Ab Phase 12 gibt es einen Weg, eine zweite Periode
anzulegen ... ab da ... kann die Desktop-Anzeige einem Anwender andere Sollstunden zeigen als
der Server." Gemessen, nicht angenommen — zwei Läufe gegen dieselbe Arbeitskopie
(`server/database/12-08-wirksamkeit.db`, gezogen aus `server/database/development.db`, siehe
Deviations für die Pfadanpassung).

**Lauf 1 — vor einem eingetragenen Wechsel** (wörtliche Ausgabe):

```
=== verifyDesktopEffectiveness: Wirksamkeitsfenster nach Phase 12 ===
Aufgelöster Datenbankpfad: C:\Users\maxfe\Maxflow Software\Projekte\Stiftung TimeTracker\TimeTracking-Clean\server\database\12-08-wirksamkeit.db
Dateigröße (vor der Messung): 1630208 Bytes
Zeitstempel (vor der Messung): 2026-08-22T14:36:21.090Z

1) Nutzer mit >1 Periode: 0 []
2) Drift-Zahl: 0 userIds: []
3) Nutzer ohne offene Periode: 1 [15359]
Gesamtzahl users: 32
Gesamtzahl user_work_periods: 31

=== Unversehrtheitsnachweis ===
Dateigröße (nach der Messung): 1630208 Bytes
Zeitstempel (nach der Messung): 2026-08-22T14:36:21.090Z
Unverändert: ja

ERGEBNIS: Zahl 1 (Nutzer mit >1 Periode) ist weiterhin 0; mindestens eine der anderen beiden Zahlen ist nicht 0 (siehe oben) — kein Aussagewert fuer Begruendung 2, die ausschliesslich an Zahl 1 haengt.
```

Zahl 3 ("Nutzer ohne offene Periode") ist bereits hier `1` (userId 15359) — ein vorbestehender
Datenbefund der lokalen `development.db` (32 Nutzer statt der 20 aus der Disposition-Messung),
nicht durch Phase 12 verursacht. Dokumentiert in `deferred-items.md`, Punkt 1. Zahl 1 (die für
Begründung 2 allein maßgebliche Zahl) ist an dieser Stelle noch 0.

Danach wurde gegen dieselbe Arbeitskopie ein echter Stundenwechsel eingetragen — über
`applyWorkTimeChange({ userId: 2, validFrom: '2027-01-01', weeklyHours: 20, workSchedule: null,
reason: '...' }, { dryRun: false, createdBy: 1 })`, exakt der produktive Schreibweg aus Plan
12-01/12-03, nicht eine SQL-Direktschreibung. Ergebnis: neue Periode `id=3919`,
`validFrom=2027-01-01`.

**Lauf 2 — nach dem eingetragenen Wechsel** (wörtliche Ausgabe):

```
=== verifyDesktopEffectiveness: Wirksamkeitsfenster nach Phase 12 ===
Aufgelöster Datenbankpfad: C:\Users\maxfe\Maxflow Software\Projekte\Stiftung TimeTracker\TimeTracking-Clean\server\database\12-08-wirksamkeit.db
Dateigröße (vor der Messung): 1630208 Bytes
Zeitstempel (vor der Messung): 2026-08-22T14:36:36.532Z

1) Nutzer mit >1 Periode: 1 [2]
2) Drift-Zahl: 1 userIds: [2]
3) Nutzer ohne offene Periode: 1 [15359]
Gesamtzahl users: 32
Gesamtzahl user_work_periods: 32

=== Unversehrtheitsnachweis ===
Dateigröße (nach der Messung): 1630208 Bytes
Zeitstempel (nach der Messung): 2026-08-22T14:36:36.532Z
Unverändert: ja

ERGEBNIS: Zahl 1 (Nutzer mit >1 Periode) ist groesser als 0 — Begruendung 2 der Disposition traegt nicht mehr.
```

**Zahl 1 ist jetzt 1 (userId 2)** — genau die von der Disposition vorausgesagte Wirkung. Zahl 2
(Drift) ist ebenfalls auf 1 gesprungen: Der Stichtag `2027-01-01` liegt in der Zukunft, daher
ist die per SQL-Definition "offene" Periode (`validTo IS NULL`) jetzt die künftige Periode
(`weeklyHours=20`, kein Tagesplan) — die flachen `users`-Spalten spiegeln aber weiterhin den
heute gültigen Stand (`weeklyHours=5`, Tagesplan). Das ist eine genaue Illustration dessen, was
WR-12 beschreibt: Sobald es zwei Perioden gibt, ist "die eine offene Periode" nicht mehr
zwingend "die heute gültige Periode" — die Drift-Abfrage aus der Disposition setzt implizit
voraus, dass beides zusammenfällt, eine Annahme, die ab Phase 12 nicht mehr uneingeschränkt
gilt. Wörtlich aus der Disposition übernommen, nicht verändert — die Abweichung wird hier nur
gemessen und dokumentiert, nicht durch eine andere Abfrageform verdeckt.

**Unversehrtheitsnachweis:** Dateigröße (1630208 Bytes) und Zeitstempel sind in beiden Läufen
vor und nach der jeweiligen Messung identisch — das rein lesende Werkzeug hat nicht
geschrieben.

**Bewertung:** Begründung 2 der Disposition trägt nicht mehr — der Nachzug war fällig und ist
erfolgt.

## Gegenprobe Desktop gegen Server

Für `userId=2` (Perioden: `validFrom 2026-01-01/validTo 2027-01-01`, `weeklyHours=5`,
Tagesplan `{thursday: 5}` sonst 0; ab `2027-01-01`: `weeklyHours=20`, kein Tagesplan) über den
Zeitraum `2026-12-28` bis `2027-01-04` (schließt den Stichtag `2027-01-01` = "Neujahr",
Feiertag, ein):

- **Desktop** (`calculateAbsenceHoursWithWorkSchedule(startDate, endDate, periods, holidays)`,
  mit den echten Perioden-Zeilen der Arbeitskopie): **9**
- **Server** (`calculateAbsenceHoursWithWorkSchedule(user, startDate, endDate, periods)` aus
  `server/src/utils/workingDays.ts`, gegen dieselbe Arbeitskopie): **9**

Beide Werte stimmen überein. Herleitung: Mo 28.12. (Tagesplan Mo=0) → 0h, Di 29.12. (Di=0) →
0h, Mi 30.12. (Mi=0) → 0h, Do 31.12. (Do=5) → 5h, Fr 01.01. (Feiertag, übersteuert jede Periode)
→ 0h, Sa/So (Wochenende) → 0h/0h, Mo 04.01. (neue Periode, `weeklyHours=20`, kein Tagesplan →
`20/5=4h`) → 4h. Summe 5+4 = 9h.

## Decisions Made

Siehe `key-decisions` im Frontmatter. Zusätzlich: Der Zeitzonentest (Behaviorpunkt 9) läuft
über einen echten Kindprozess statt einer bloßen Behauptung — die erste Fassung nutzte
`npx tsx` mit `shell: true` (Windows-Standardmuster für `.cmd`-Dateien) und scheiterte am
Leerzeichen im Repository-Pfad (`...\Stiftung TimeTracker\...`), weil Node die Argumente beim
`.cmd`-Umweg über `cmd.exe` nicht zuverlässig quotet. Die endgültige Fassung ruft `node.exe`
direkt mit dem aufgelösten `tsx/cli`-Pfad (`createRequire(...).resolve('tsx/cli')`) auf — kein
Shell-Umweg, keine Quoting-Probleme, unabhängig vom Repository-Pfad.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Arbeitskopie aus `server/database/development.db` statt `server/database.db` gezogen**
- **Found during:** Task 3
- **Issue:** Der Plan gibt wörtlich `cp server/database.db server/database/12-08-wirksamkeit.db`
  vor. In dieser lokalen Windows-Arbeitsumgebung ist `server/database.db` eine veraltete,
  unmigrierte Datei (letzte Migration Februar 2026, keine `user_work_periods`-Tabelle) — das
  Messwerkzeug scheiterte mit `SqliteError: no such table: user_work_periods`. Die tatsächlich
  von `getDatabasePath()` für `NODE_ENV=development` gewählte lokale Arbeitsdatenbank ist
  `server/database/development.db` (32 Nutzer, `user_work_periods` vorhanden, alle 11
  Migrationen inklusive `011_add_model_change_transaction_type` angewendet).
- **Fix:** Arbeitskopie aus `server/database/development.db` gezogen statt aus
  `server/database.db`. Beide Messläufe liefen gegen diese korrekte Arbeitskopie.
- **Files modified:** keine Codeänderung — nur der Bash-Befehl zum Ziehen der Arbeitskopie war
  betroffen. `deferred-items.md`, Punkt 2, dokumentiert den Befund.
- **Verification:** Beide Messläufe liefen fehlerfrei (Exitcode 0), alle drei Zahlen plausibel.
- **Committed in:** n/a (kein Codeartefakt — Arbeitskopie ist gitignored)

**2. [Rule 1/2 - Bug/Missing Critical] Zwei vorbestehende `console.log`/`console.error` in `AbsenceRequestForm.tsx` entfernt**
- **Found during:** Task 2
- **Issue:** Die Acceptance-Criteria von Task 2 verlangt `grep -c "console\." ... liefert 0 für
  beide Dateien` — `AbsenceRequestForm.tsx` enthielt zwei vorbestehende, von diesem Plan nicht
  verursachte Aufrufe (`console.log` bei fehlender Begründung für Krankmeldung,
  `console.error` im Submit-Catch-Block). `.claude/CLAUDE.md` verbietet Debug-Logs in
  Production ausdrücklich.
- **Fix:** Beide Aufrufe entfernt, Kommentare an derselben Stelle belassen (der
  Fehler-Catch-Block bleibt funktional identisch — der Fehler wird weiterhin vom Hook per Toast
  angezeigt, nur ohne zusätzliche Konsolenausgabe).
- **Files modified:** `desktop/src/components/absences/AbsenceRequestForm.tsx`
- **Verification:** `grep -c "console\." desktop/src/components/absences/AbsenceRequestForm.tsx` = 0, `npx tsc --noEmit` clean, kein Verhaltensunterschied (Toast-Anzeige unverändert über den Hook).
- **Committed in:** `15a375e` (Task 2 commit)

**3. [Rule 1 - Bug] `ERGEBNIS`-Zeile in `verifyDesktopEffectiveness.ts` korrigiert, damit sie nicht "alle drei Zahlen sind 0" behauptet, wenn nur Zahl 1 gemeint ist**
- **Found during:** Task 3 (erster Messlauf)
- **Issue:** Die ursprüngliche Fassung der abschließenden `ERGEBNIS`-Zeile prüfte ausschließlich
  `multiPeriod.length > 0` und hätte im ELSE-Zweig wörtlich "Alle drei Zahlen sind 0" behauptet
  — obwohl Zahl 3 im ersten Lauf bereits `1` war. Eine falsche Zusammenfassung in einem
  Messwerkzeug ist ein Bug (Rule 1).
- **Fix:** Dreiwertige Fallunterscheidung ergänzt: "Zahl 1 > 0" / "Zahl 1 = 0, aber mindestens
  eine andere Zahl ≠ 0 — kein Aussagewert" / "alle drei Zahlen sind 0".
- **Files modified:** `server/src/scripts/verifyDesktopEffectiveness.ts`
- **Verification:** Beide Messläufe zeigen die jeweils korrekte, zur tatsächlichen Datenlage passende Zeile (siehe „Wirksamkeitsfenster nach Phase 12" oben).
- **Committed in:** `85ad248` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking/Pfadanpassung, 1 missing critical/Debug-Logs, 1 Bug/irreführende Zusammenfassung)
**Impact on plan:** Keine der drei Korrekturen ändert die fachliche Aussage des Plans — Weg (b) für WR-12, periodengetreue Berechnung, drei erneut erhobene Messzahlen. Alle drei sind notwendige Korrekturen für Korrektheit (Pfad, Datenschutz-Vorgabe aus CLAUDE.md, Wahrheitsgehalt der Messwerkzeug-Ausgabe), kein Scope Creep.

## Issues Encountered

- **`npx tsx` mit `shell: true` scheiterte am Leerzeichen im Repository-Pfad** (Windows,
  `...\Stiftung TimeTracker\...`) beim Zeitzonen-Kindprozesstest. Gelöst durch direkten Aufruf
  von `process.execPath` mit dem über `createRequire(...).resolve('tsx/cli')` aufgelösten
  Pfad — kein Shell-Umweg mehr nötig, siehe „Decisions Made" oben.
- **`vitest` ist projektweit blockiert** (`@babel/runtime` fehlt, siehe `12-02-SUMMARY.md`) —
  bestätigt erneut an einem eigenen Probelauf gegen den unveränderten Bestandstest
  `timeUtils.test.ts`. `timeUtils.periods.test.ts` läuft stattdessen als `npx tsx`-Skript mit
  `node:assert/strict`, exakt wie in der Plan-Verify-Zeile als Fallback vorgesehen.

## User Setup Required

None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness

- WR-12 ist für den Umfang dieser Phase geschlossen: Desktop-Vorschau und Server stimmen im
  Gegenprobefall überein, keine Zahl wird ohne geladene Grundlage behauptet.
- Die vollständige Auflösung der Client-Kopie (WR-12 "mittelfristig") bleibt ein offener Punkt
  für eine spätere Phase — der Kopfkommentar in `timeUtils.ts` hält die Kopplung an das
  Server-Gegenstück fest.
- Zwei vorbestehende, außerhalb des Scopes liegende Funde sind in `deferred-items.md`
  dokumentiert (Datenbefund `userId=15359`, veraltete `server/database.db`).
- Kein Blocker für Plan 12-09 oder Phase 13.

## UAT-Punkte für Phase 14

1. **Abwesenheitsantrag über einen Stichtag hinweg im Desktop stellen:** die angezeigte
   Stundenzahl entspricht der, die nach der Genehmigung tatsächlich gebucht wird. Codeseitig
   durch die Gegenprobe oben belegt (9h Desktop = 9h Server für denselben Zeitraum); der
   interaktive UI-Test mit echtem Antragsformular steht aus.
2. **Abwesenheitsantrag über einen Feiertag:** der Feiertag wird in der Vorschau nicht als
   Arbeitstag gezählt. Codeseitig durch Testfall 5 (`timeUtils.periods.test.ts`) belegt;
   visuelle Bestätigung im laufenden Formular steht aus.
3. **Server während des Ausfüllens nicht erreichbar:** es erscheint keine Zahl, sondern der
   Hinweis „Vorschau kann gerade nicht berechnet werden. Der Antrag kann trotzdem gestellt
   werden.“; der Antrag bleibt absendbar. Logik ist verdrahtet (`previewUnavailable` aus
   `isError` von `useWorkPeriods`/`useMultiYearHolidays`); der interaktive Test (Server
   stoppen, Formular öffnen) steht aus.
4. **`WorkScheduleDisplay` bei einem Nutzer mit mehreren Perioden:** die Zeile „Aktuell
   gültiges Modell seit …“ nennt das `validFrom` der heute gültigen Periode. Codeseitig über
   `resolveWorkTimePeriodIn(periods, getTodayDate())` belegt; visuelle Bestätigung im
   Detail-Modus (Einstellungen/Modal) mit einem echten Mehrperioden-Nutzer steht aus — der in
   dieser Messung angelegte Testnutzer (`userId=2`, Stichtag `2027-01-01`) eignet sich dafür,
   ist aber Teil der Arbeitskopie, nicht der Produktions- oder Entwicklungsdatenbank, mit der
   die App normalerweise verbunden ist.
5. **Kompakter Modus von `WorkScheduleDisplay` (Dashboard-Widget):** zeigt bewusst KEINE
   Stichtag-Zeile (nur der Detail-Modus tut das, siehe „Decisions Made“/Acceptance-Criteria).
   Zu prüfen: Ist das im Dashboard-Kontext ausreichend, oder sollte Phase 13/14 die Zeile auch
   dort ergänzen?

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle sieben erstellten/geänderten Dateien wurden vor dem Schreiben dieser SUMMARY verifiziert
(`FOUND` für jede) und alle drei Task-Commits (`5c46478`, `15a375e`, `85ad248`) sind in
`git log --oneline --all` nachweisbar. `npx tsc --noEmit` ist sowohl in `desktop/` als auch in
`server/` sauber (Exitcode 0, keine Ausgabe). Der Testlauf `timeUtils.periods.test.ts` endet
mit `9 Tests bestanden.` und Exitcode 0. Beide Messläufe von
`verifyDesktopEffectiveness.ts` liefen mit Exitcode 0 gegen die Arbeitskopie.
