---
phase: 11-datumsabh-ngige-berechnung
fixed_at: 2026-08-22T11:20:00Z
review_path: .planning/phases/11-datumsabh-ngige-berechnung/11-REVIEW.md
iteration: 1
findings_in_scope: 22
fixed: 21
skipped: 1
status: partial
---

# Phase 11: Bericht zur Code-Review-Korrektur

**Korrigiert am:** 2026-08-22
**Grundlage:** `.planning/phases/11-datumsabh-ngige-berechnung/11-REVIEW.md`
**Durchlauf:** 1
**Umfang:** `critical_warning` (6 Critical + 16 Warning; die 8 Info-Befunde waren nicht im Umfang)

**Zusammenfassung:**
- Befunde im Umfang: 22
- Behoben: 21
- Übersprungen: 1 (WR-12 — gehört laut `11-DESKTOP-DISPOSITION.md` ausdrücklich in Phase 12)

## Arbeitsweise und Regressionsnachweis

Alle Änderungen entstanden in einem isolierten Git-Worktree; jeder Befund wurde einzeln
verifiziert und einzeln festgeschrieben (21 Commits, ein Commit je Befund).

**Ausgangsmessung vor der ersten Änderung** (`server`, gegen eine Arbeitskopie von
`database/development.db`):

- `npx tsc --noEmit` → 0 Fehler
- `npx vitest run` → **363 bestanden, 10 fehlgeschlagen** (27 Dateien). Die 10 Fehlschläge
  sind vorbestehend und in `balanceTracking.test.ts` (7), `unifiedOvertimeService.test.ts` (2)
  und `vacationBackfillService.test.ts` (1) verortet.

**Abschlussmessung nach allen 21 Korrekturen:**

- `npx tsc --noEmit` → 0 Fehler
- `npx vitest run` → **369 bestanden, 10 fehlgeschlagen** (27 Dateien)
- Die Menge der fehlgeschlagenen Tests ist **zeichengenau identisch** mit der Ausgangsmessung
  (maschinell verglichen, `diff`). Keine Regression. Die 6 zusätzlich bestandenen Tests sind
  die in diesem Lauf neu geschriebenen (3 für CR-01, 3 für WR-03).

Ergänzende Nachweise, die über die Testsuite hinausgehen:

- `npm run validate:overtime -- --scenario=all`: Ausgabe **byteweise identisch** vor und nach
  CR-04 und nach WR-09 (`diff` gegen einen vor der ersten Änderung erzeugten Mitschnitt).
- `verifyPeriodNullEffect` gegen eine Wegwerfkopie: 21 Nutzer geprüft, 0 Abweichungen,
  SHA-256 der Datenbankdatei vor und nach dem Lauf gleich, WAL-Datei 0 Bytes.
- Produktionsschutz-Kanarienproben: `DATABASE_PATH=/home/ubuntu/databases/production.db`
  bricht sowohl `validateAllTestUsers.ts` als auch `npx vitest run` mit Exitcode 2 ab,
  bevor irgendetwas geöffnet oder geschrieben wird.

---

## Behobene Befunde

### CR-01: `hireDate`-Änderung entkoppelt Nutzer und Periode

**Geänderte Dateien:** `server/src/services/userService.ts`,
`server/src/services/workPeriodService.ts`,
`server/src/services/userWorkPeriodProvisioning.test.ts`
**Commit:** `470edf3`

**Umgesetzte Korrektur:** Neue Funktion `setWorkPeriodValidFrom()` in
`workPeriodService.ts` (mit derselben `WorkPeriodConflictError`-Übersetzung wie die übrigen
Schreibwege). In `updateUser()` zieht die neue, private Funktion
`syncStartPeriodToHireDate()` die Startperiode nach — **in derselben Transaktion wie das
`UPDATE users`**. Drei Fälle sind ausdrücklich entschieden und im Quelltext begründet:
(1) keine Periode vorhanden → `ensureInitialWorkPeriod()` mit dem NEUEN Datum;
(2) `hireDate` vorverlegt → Kette nach vorn verlängern;
(3) `hireDate` nach hinten verlegt → Kette bewusst stehen lassen (Daten vor `hireDate`
liefern per D4-Ausnahme ohnehin 0; ein Kürzen würde bei mehrgliedriger Kette eine Lücke
erzeugen).

**Nachweis:** Drei neue Tests in `userWorkPeriodProvisioning.test.ts`. Der zentrale Test
verlegt `hireDate` von `2026-03-01` auf `2026-01-01` und prüft danach: genau eine Periode,
`validFrom = 2026-01-01`, `checkPeriodChain()` → `{ ok: true, findings: [] }`, und
`getDailyTargetHours(user, '2026-01-05', ctx)` wirft nicht mehr, sondern liefert 8. Das ist
exakt der Tag, an dem vorher `MissingWorkPeriodError` flog.

### CR-02: `seedTestUsers.upsertUser()` aktualisiert Nutzer, aber nicht deren Periode

**Geänderte Dateien:** `server/src/scripts/seedTestUsers.ts`,
`server/src/services/userService.ts`, `server/src/services/workPeriodService.ts`
**Commit:** `b54661b`

**Umgesetzte Korrektur:** Statt eines dritten Schreibwegs im Seed-Skript wurde die
Spiegelung als wiederverwendbare, exportierte Funktion `mirrorUserToWorkPeriod()` in
`userService.ts` angelegt. Sie ist idempotent und macht drei Dinge: Startperiode anlegen
falls keine existiert, `validFrom` bei vorverlegtem `hireDate` nachziehen (CR-01),
`weeklyHours`/`workSchedule` der offenen Periode angleichen. Der Update-Zweig von
`upsertUser()` ruft jetzt diese Funktion statt der idempotenten Anlagefunktion, die bei
vorhandener Periode nichts tat.

Zusätzlich wurde das rohe `UPDATE user_work_periods SET weeklyHours = ?, workSchedule = ?`,
das bis dahin in `userService.updateUser()` stand, als `updateWorkPeriodValues()` nach
`workPeriodService.ts` gezogen. Beide Aufrufer gehen jetzt durch **einen** Schreibweg für
Periodenwerte — genau das, was der Befund als saubere Variante benannte.

### CR-03: `validateAllTestUsers.ts` vergleicht Daten aus zwei verschiedenen Datenbanken

**Geänderte Datei:** `server/src/scripts/validateAllTestUsers.ts`
**Commit:** `a6b867e`

**Umgesetzte Korrektur:** `new Database('./database/development.db')` ersatzlos gestrichen.
Das Skript folgt jetzt dem Muster aus `validateOvertimeDetailed.ts`: nur import-sichere
Module am Kopf (`fs`, `path`, `timezone.ts`, `productionGuard.ts`), danach synchron
`assertNotProduction()`, danach `await import()` der datenbankziehenden Module — inklusive
`const { db } = await import('../database/connection.js')`. Damit lesen Sollstunden,
Zeiteinträge, Abwesenheiten und Salden aus **einer** Datei. Das `db.close()` am Ende
entfiel, weil `db` jetzt die geteilte Verbindung ist und nicht diesem Skript gehört.

**Nachweis:** Lauf mit `DATABASE_PATH=./database/development.db` funktioniert und
protokolliert diesen Pfad; Lauf mit dem Produktionspfad bricht mit Exitcode 2 ab, bevor eine
Datei geöffnet oder angelegt wird.

### CR-04: `validateOvertimeCalculation.validateUser()` rechnet über den heutigen Stammdatensatz

**Geänderte Datei:** `server/src/scripts/validateOvertimeCalculation.ts`
**Commit:** `3fc2049`

**Umgesetzte Korrektur:** Die Verzweigung `if (user.workSchedule) … else daysRequired ×
(weeklyHours / 5)` ist in `validateUser()` ersatzlos entfernt;
`calculateAbsenceHoursWithWorkSchedule()` behandelt beide Fälle bereits über die Periode und
kennt zusätzlich Feiertage und Wochenenden. Dieselbe Verzweigung in `validateScenario()`
wurde aus demselben Grund (eine Regel, eine Stelle) mit entfernt.

**Nachweis:** `--scenario=all` liefert vor und nach der Änderung **byteweise identische**
Ausgabe — die Zusammenführung bewegt in den Szenarien keine Zahl. Für den
Datenbank-Modus (`--userId`/`--all`) besteht ein vorbestehender, hier NICHT verursachter
Fehler (`SqliteError: no such column: deletedAt`, Zeile 208, `time_entries`), der auch auf
dem unveränderten Stand identisch auftritt — geprüft per `git stash`.

### CR-05: DATEV-/Historien-Export erzeugt CSV ohne jede Maskierung

**Geänderte Datei:** `server/src/services/exportService.ts`
**Commit:** `2966b58`

**Umgesetzte Korrektur:** Eine einzige Maskierfunktion `csvField()` eingeführt und
ausnahmslos verwendet — in beiden DATEV-Zeilentypen, in der Kopfzeile und in allen Blöcken
von `historicalExportToCSV()` inklusive der Metadaten- und Statistikzeilen.

**Eine bewusste Abweichung von der Fix-Empfehlung:** Der vorgeschlagene reguläre Ausdruck
`/^[=+\-@\t\r]/` hätte auch echte negative Zahlen entwertet — der Export trägt Überstunden
wie `-3,50`, und ein vorangestelltes Apostroph hätte sie für DATEV zu Text gemacht. Die
Maskierung prüft deshalb zusätzlich gegen `/^-?\d+(?:[.,]\d+)?$/` und lässt reine Zahlen
unangetastet. Die Maßnahme gegen die Injektion hätte sonst den Export beschädigt.

**Nachweis:** Tabelle geprüfter Fälle (Eingabe → Ausgabe):
`-3,50` → `-3,50` · `8,00` → `8,00` · `-Text` → `'-Text` · `@user` → `'@user` ·
`=cmd\|'/c calc'!A1` → `'=cmd\|'/c calc'!A1` · `Notiz; mit Semikolon` → `"Notiz; mit Semikolon"` ·
`Zeile1\nZeile2` → gequotet · `Er sagte "hallo"` → `"Er sagte ""hallo"""` · `null`/`undefined` → leer.
Realer Exportlauf: 67 DATEV-Zeilen, negative Werte wie `-0,08` unverändert.

### CR-06: `migrateOvertimeToTransactions` löscht Buchungen, bevor es sie neu berechnen kann

**Geänderte Datei:** `server/src/scripts/migrateOvertimeToTransactions.ts`
**Commit:** `57fb016`

**Umgesetzte Korrektur:** Reihenfolge umgedreht — erst `getDailyTargetHours()` und die
Ist-Stunden ermitteln, dann Löschen und Neuschreiben **in einer `db.transaction`**. Wirft die
Berechnung, ist zu diesem Zeitpunkt nichts angefasst. Der `catch` der Tagesschleife
unterscheidet jetzt: `MissingWorkPeriodError` wird protokolliert und **weitergeworfen**
(Datendefekt per D4, Lauf bricht ab); jeder andere Fehler bleibt wie bisher eine Warnung mit
Fortsetzung. Damit der Abbruch auch trägt, wirft auch der umgebende `catch` der Nutzerschleife
diese Fehlerklasse weiter, statt sie in `stats.errors` zu versenken.

**Nachweis:** Lauf gegen die Arbeitskopie: `{"totalUsers":19,"totalDates":577,
"totalTransactions":515,"errors":[]}`, Exitcode 0.

### WR-01: `getDailyTargetHours()` bestimmt den Wochentag aus drei verschiedenen Quellen

**Geänderte Datei:** `server/src/utils/workingDays.ts`
**Commit:** `5b324e8`

**Umgesetzte Korrektur:** Neue Hilfsfunktion `dayIndexFromDateString()` leitet den Wochentag
ausschließlich aus der bereits gebildeten `YYYY-MM-DD`-Zeichenkette ab (`Date.UTC()` +
`getUTCDay()`, damit zeitzonen- und sommerzeitfrei). Beide vorher abweichenden Stellen — der
Wochenplan-Zweig (vorher `getDayName(date)`) und die Wochenendprüfung (vorher
`new Date(date).getDay()`) — benutzen jetzt denselben `dayIndex`. `getDayName()` selbst
bleibt unverändert, weil es weitere Aufrufer außerhalb dieser Funktion hat.

### WR-02: `directWorkPeriodLookup` in Tagesschleifen

**Geänderte Datei:** `server/src/services/absenceService.ts`
**Commit:** `3100709`

**Umgesetzte Korrektur:** `approveAbsenceRequest()` baut zu Beginn **einen** Kontext
(`const approvalPeriods = createWorkPeriodContext()`) und übergibt ihn sowohl an den
Genehmigungsvorbehalt als auch an die Abbuchung. Damit sehen beide Rechnungen garantiert
denselben Periodenstand — zwischen ihnen liegen ein Commit und mehrere `await`. Der Import
von `directWorkPeriodLookup` wurde entfernt, da in dieser Datei kein Aufrufer mehr existiert.

### WR-03: Ein Nutzer ohne Periode legt Report, Statistik und Export für alle lahm

**Geänderte Dateien:** `server/src/services/overtimeService.ts`,
`server/src/services/exportService.ts`, `server/src/services/workPeriodService.ts`,
`server/src/services/workPeriodService.test.ts`
**Commit:** `dabc771`

**Umgesetzte Korrektur (beide vom Befund geforderten Maßnahmen):**

1. **Vereinzelung.** `ensureOvertimeBalanceEntriesIsolated()` in `overtimeService.ts` fängt
   `MissingWorkPeriodError`, protokolliert ihn als Datendefekt und überspringt den einen
   Nutzer; jeder andere Fehler fliegt unverändert weiter. Alle drei Sammelschleifen
   (`getAllUsersOvertimeSummary()` monatlich und jährlich, `getAggregatedOvertimeStats()`)
   gehen jetzt darüber. Im DATEV-Export ist die Nutzerschleife entsprechend geklammert —
   zusätzlich werden die Zeilen eines Nutzers erst gesammelt und nur bei vollständigem Erfolg
   angehängt, damit keine halben Nutzerdaten in der Ausgabedatei stehen bleiben.
2. **Bestands-Check.** Neue Funktion `checkAllPeriodChains()` in `workPeriodService.ts`
   prüft alle nicht gelöschten Nutzer und meldet drei Befundarten: Nutzer ganz ohne Periode
   (den `checkPeriodChain()` allein strukturell NICHT findet, weil eine leere Liste keine
   Lücke hat), Ketten die erst nach `hireDate` beginnen, sowie alles, was
   `checkPeriodChain()` ohnehin liefert — über dieselbe Funktion, keine zweite Kopie der Regel.

**Nachweis:** Drei neue Tests in `workPeriodService.test.ts`, darunter einer, der
ausdrücklich belegt, dass `checkPeriodChain()` für einen Nutzer ohne Periode `ok: true`
meldet, `checkAllPeriodChains()` ihn aber findet.

### WR-04: `create-admin.ts` legt Nutzer und Startperiode ohne Transaktion an

**Geänderte Datei:** `server/scripts/create-admin.ts`
**Commit:** `44d141c`

**Umgesetzte Korrektur:** `INSERT INTO users`, `getUserById()` und
`ensureInitialWorkPeriod()` laufen jetzt gemeinsam in `db.transaction()`. Scheitert die
Periodenanlage, wird auch der Admin nicht angelegt — kein halber Zustand beim allerersten
Nutzer eines Systems.

### WR-05: „Überschreiben? (ja/nein)" überschreibt nichts

**Geänderte Datei:** `server/scripts/create-admin.ts`
**Commit:** `93db4d6`

**Umgesetzte Korrektur:** Die Frage lautet jetzt wahrheitsgemäß: „Es existiert bereits ein
Admin-User. Er bleibt unverändert bestehen. Trotzdem einen WEITEREN Admin anlegen?
(ja/nein)". Die vom Befund alternativ genannte Variante (tatsächliches Überschreiben) wurde
bewusst NICHT gewählt: Sie wäre eine Verhaltensänderung des Skripts und gehört nicht in eine
Review-Korrektur. Die Entscheidung steht als Kommentar an der Stelle.

### WR-06: `create-admin.ts` gibt das Klartext-Passwort auf der Konsole aus

**Geänderte Datei:** `server/scripts/create-admin.ts`
**Commit:** `73fdcbe`

**Umgesetzte Korrektur:** Beide Teile des Befunds. Die Ausgabezeile
`console.log(\`   Passwort: ${password}\`)` ist entfernt (ersetzt durch einen Hinweis ohne
Wert). Neue Funktion `questionHidden()` liest das Passwort **ohne Echo**, indem sie den
`_writeToOutput`-Rückruf der readline-Schnittstelle für die Dauer der Eingabe stummschaltet
und danach wiederherstellt — ohne zusätzliche Abhängigkeit. Der Zugriff auf die nicht
öffentlich typisierte Methode läuft über einen engen, benannten Strukturtyp, nicht über `any`
(Strict-Mode-Regel).

**Nachweis:** Nachbau der Funktion in einem Prüfskript: Eingabe `geheim123` wird vollständig
und korrekt gelesen (`LEN=9`), ohne Echo während der Eingabe.

### WR-07: Zwei nicht abgewartete Promises in `updateUser()`

**Geänderte Datei:** `server/src/services/userService.ts`
**Commit:** `8ddbda0`

**Umgesetzte Korrektur:** `await recalculateOvertimeForUser(id);` an beiden Stellen
(weeklyHours-Zweig und workSchedule-Zweig). Damit greift der umgebende `try/catch` wieder,
der Erfolgs-Log erscheint nach der Berechnung, und die Antwort an den Client geht erst raus,
wenn die Neuberechnung abgeschlossen ist.

### WR-08: `console.log`-Debugausgaben in aktiven Produktionspfaden

**Geänderte Dateien:** `server/src/services/absenceService.ts`,
`server/src/services/overtimeService.ts`
**Commit:** `8958c5f`

**Umgesetzte Korrektur:** Alle 26 `console.log`/`console.error`-Aufrufe in
`rejectAbsenceRequest()` sind auf `logger.debug({...}, '...')` mit strukturierten Feldern
umgestellt bzw. entfernt, wo eine `logger.error`-Zeile direkt daneben dasselbe bereits
meldete. In `overtimeService.updateMonthlyOvertime()` (aktiver Pfad) sind die 10 Ausgaben
umgestellt; die frühere siebenzeilige Blockausgabe steckt vollständig in dem bereits
vorhandenen strukturierten `logger.debug`. Die übrigen 11 `console.log`-Zeilen lagen in
totem Code und sind mit WR-16 verschwunden. In beiden Dateien steht jetzt **kein einziger**
`console.log`-Aufruf mehr.

### WR-09: `any` an zwölf Stellen

**Geänderte Dateien:** `server/src/utils/workingDays.ts`,
`server/src/services/userService.ts`, `server/src/services/unifiedOvertimeService.ts`,
`server/src/services/overtimeTransactionRebuildService.ts`,
`server/src/services/exportService.ts`, `server/src/scripts/validateOvertimeCalculation.ts`
**Commit:** `22fcde9`

**Umgesetzte Korrektur — alle zwölf Stellen:**

- `workingDays.ts:322,364,547`: `dbInstance?: any` → `dbInstance?: BetterSqlite3.Database`
  (genau die Fehlerklasse, die hinter CR-03 steckte).
- `userService.ts:91,116`: neuer Zeilentyp `UserRow` (JSON-Zeichenkette + 0/1-Zahl) statt
  `as any`/`as any[]`.
- `userService.ts:812`: `as any` → `as GDPRDataExport & { absences: AbsenceRequest[] }` — der
  Alias steht damit ausdrücklich im Typ, statt die Prüfung ganz abzuschalten.
- `unifiedOvertimeService.ts:340` und `validateOvertimeCalculation.ts:139`: konkrete
  Zeilentypen.
- `overtimeTransactionRebuildService.ts:308`: Typwächter `isAbsenceDayType()` samt
  `ABSENCE_TYPES`-Wertliste, genau wie im Befund vorgeschlagen. Ein unbekannter Typ aus der
  Datenbank wird jetzt laut protokolliert und wie „kein Abwesenheitstag" behandelt, statt
  unbemerkt durch alle `case`-Zweige zu fallen.
- `overtimeTransactionRebuildService.ts:482,485`: `insertTransactionWithBalance()` bekommt
  enge, benannte Parametertypen (`RebuildTransactionType`, `RebuildReferenceType`);
  `getCreditType()` liefert statt `string` denselben engen Typ, und sein Mapping ist jetzt
  ein vollständiges `Record` über die Union — ein künftiger neuer Abwesenheitstyp erzeugt
  damit einen Übersetzungsfehler statt eines stillen Rückfalls.
- `exportService.ts:276,304,305`: Ergebnistypen aus `HistoricalExportData` statt `as any[]`
  und `entry: any`.

**Zwei Stellen, die dabei bewusst NICHT geglättet wurden — jeweils im Quelltext begründet:**

1. `getAllUsers()`/`getUserById()` gehen weiterhin über `as unknown as UserPublic`. Grund:
   SQLite liefert `isActive` als 0/1-Zahl, `UserPublic.isActive` ist `boolean`. Eine
   Umstellung würde die API-Ausgabe ändern und den Desktop-Filter `u.isActive !== false`
   (`AbsenceRequestForm.tsx:234`, `TimeEntryForm.tsx:150`) kippen: heute filtert er wegen
   `0 !== false` nicht, danach würde er filtern. Das ist eine Verhaltensänderung und gehört
   nicht in eine Typkorrektur. Der Zeilentyp fängt jetzt trotzdem Tippfehler in Spaltennamen ab.
2. `type as TransactionParams['type']` bleibt als **enge, benannte** Zusicherung stehen, weil
   `'time_entry'` und `'unpaid_deduction'` in `TransactionParams` fehlen, obwohl die
   CHECK-Bedingung von `overtime_transactions` (`schema.ts:517-522`) sie erlaubt. Diese Lücke
   im Typmodell eines anderen Moduls einseitig zu schließen wäre über den Befund hinausgegangen.

**Nebenbefund, mitkorrigiert:** Das Typisieren der Nutzerabfrage in
`validateOvertimeCalculation.ts` legte offen, dass `username` dort gelesen, aber gar nicht
selektiert wurde (mit `as any` unbemerkt `undefined`). Die Spalte steht jetzt in der Abfrage.

### WR-10: Dynamisch zusammengesetztes SQL im Historien-Export

**Geänderte Datei:** `server/src/services/exportService.ts`
**Commit:** `12767da`

**Umgesetzte Korrektur:** Jahreszahlen werden als `?`-Platzhalter gebunden statt in die
Abfrage geschrieben. Davor prüft eine Eingabevalidierung
(`Number.isInteger` + `endYear >= startYear`) und wirft mit verwertbarer deutscher Meldung.

**Nachweis:** Gültiger Zweijahres-Zeitraum liefert 25 Zeilen `vacationBalance` und einen
796-zeiligen CSV; vertauschter Zeitraum (`2026-12-31` bis `2025-01-01`) und unparsbares Datum
(`kaputt`) werden mit benannter Meldung abgewiesen statt als SQL-Syntaxfehler zu enden.

### WR-11: DATEV-Export überspringt gelöschte Nutzer trotz gegenteiliger Absicht

**Geänderte Dateien:** `server/src/services/exportService.ts`,
`server/src/services/userService.ts`
**Commit:** `e5d8515`

**Umgesetzte Korrektur:** Neue Funktion `getUserByIdIncludingDeleted()` in `userService.ts`
(ausdrücklich nur für historische Auswertungen; für jeden laufenden Betriebsfall bleibt
`getUserById()` richtig). Der DATEV-Export benutzt sie statt `getUserById()`.

**Nachweis:** Derselbe Exportlauf lieferte vorher 67 Zeilen mit zwei Warnungen
„User not found, skipping", jetzt 72 Zeilen ohne Warnung — die Daten der soft-gelöschten
Nutzer sind enthalten.

### WR-13: Der Unversehrtheitsnachweis in `verifyPeriodNullEffect` trägt unter WAL nicht

**Geänderte Datei:** `server/src/scripts/verifyPeriodNullEffect.ts`
**Commit:** `40992cb`

**Umgesetzte Korrektur, beide Teile:**

1. Der Ausgangs-Hash wird jetzt **nach** dem Öffnen der Verbindung und nach einem
   `wal_checkpoint(TRUNCATE)` gebildet; derselbe Checkpoint läuft am Ende erneut. Damit steht
   zu beiden Messzeitpunkten die gesamte Datenbank in der Hauptdatei. Zusätzlich wird die
   Größe der `-wal`-Datei vor und nach dem Lauf ausgegeben. Vorher verglich der Lauf zwei
   Hashes einer Datei, in die wegen WAL ohnehin nichts geflossen wäre — der Nachweis konnte
   gar nicht fehlschlagen.
2. `MissingWorkPeriodError` wird je Tag gefangen und als eigene Ergebniskategorie geführt
   (`daysWithoutPeriod`, `firstMissingPeriodDates`), inklusive eigener Zeile in der
   Zusammenfassung und eigenem Exit-Grund.

**Nachweis (Wegwerfkopie, `--asOf=2026-08-01`):** Der unveränderte Stand brach mit
`FATAL: MissingWorkPeriodError … Nutzer 12877 am 2026-01-02` ab, nachdem er 20 Nutzer geprüft
hatte. Der korrigierte Stand prüft **alle 21** Nutzer, meldet 0 Abweichungen, weist
`Nutzer mit fehlender Arbeitszeitperiode (Datendefekt, D4): 1 — userIds: [12877]` aus und
belegt die Unversehrtheit mit identischem SHA-256 vor und nach dem Lauf bei WAL-Größe 0 Bytes.

### WR-14: Tests schreiben in die Arbeitsdatenbank ohne Produktionsschutz

**Geänderte Dateien:** `server/vitest.setup.ts` (neu), `server/vitest.config.ts`,
`server/src/services/overtimeTransactionRebuildService.test.ts`
**Commit:** `ca20b7a`

**Umgesetzte Korrektur:** Neue Datei `server/vitest.setup.ts` ruft `assertNotProduction()`
und ist als `setupFiles` in `vitest.config.ts` eingetragen. `setupFiles` läuft einmal pro
Testdatei **vor deren Importen** — die einzige Stelle, an der der Riegel noch greifen kann,
bevor ein Modul `database/connection.ts` zieht und die Datei öffnet. `createT1105User()`
bekam denselben `Math.random().toString(36).slice(2, 8)`-Suffix wie die übrigen Testdateien;
das `t1105-`-Präfix bleibt, damit der Aufräumnachweis (`LIKE 't1105-%'`) weiter greift.

**Nachweis:** `DATABASE_PATH=/home/ubuntu/databases/production.db npx vitest run …` bricht mit
„FEHLER: Produktionsschreibzugriff verweigert" ab, bevor die Suite lädt. Der normale
Testlauf ist unverändert (369/379).

### WR-15: Kopfkommentare beschreiben den Stand vor Phase 11 als gültig

**Geänderte Dateien:** `server/src/services/workPeriodContext.ts`,
`server/src/services/workPeriodService.ts`
**Commit:** `6174c42`

**Umgesetzte Korrektur:** Beide falschen Absätze fortgeschrieben. In
`workPeriodContext.ts` ersetzt eine namentliche Aufruferliste (7 Services, 6 Skripte, mit
Verweis auf `11-AUFRUFER-CHECKLISTE.md`) den Satz „nach ihm ruft weiterhin niemand diesen
Kontext auf". In `workPeriodService.ts` benennt der neue Absatz „SEIT PHASE 11 IST DIESER
SERVICE DIE RECHENGRUNDLAGE" den heutigen Stand, zitiert die abgelöste Aussage ausdrücklich
und erklärt, welche Rolle `users.weeklyHours`/`users.workSchedule` noch haben.

### WR-16: Toter Code in `overtimeService.ts` mit neuer Perioden-Verdrahtung

**Geänderte Datei:** `server/src/services/overtimeService.ts`
**Commit:** `45c68ad`

**Umgesetzte Korrektur:** Alle vier Funktionen gelöscht —
`_calculateAbsenceCreditsForMonth()`, `_calculateUnpaidLeaveForMonth()`,
`ensureAbsenceTransactionsForMonth()`, `_updateOvertimeTransactionsForDate()`. Vorher wurde
belegt, dass außerhalb der Datei kein einziger Aufrufer existiert (nur Kommentar-Erwähnungen
in drei anderen Dateien). Die Datei schrumpft von 1315 auf 1124 Zeilen; die 21
`console.log`-Zeilen und der `recordOvertimeEarned()`-Schreibpfad aus
`ensureAbsenceTransactionsForMonth()` sind damit weg. Die dadurch aufruferlos gewordenen
Importe `deleteEarnedTransactionsForDate` und `directWorkPeriodLookup` wurden mit entfernt.
Ein Kopfkommentar nennt die vier Namen und verweist auf die Git-Historie als Archiv.

---

## Übersprungener Befund

### WR-12: Desktop-Vorschau rechnet weiter mit dem heutigen Stammdatensatz

**Datei:** `desktop/src/utils/timeUtils.ts:213-245`,
`desktop/src/components/absences/AbsenceRequestForm.tsx:62-80`
**Grund:** **Nicht behoben — zugeordnet an Phase 12.**

Die Behebung liegt außerhalb von Phase 11. `.planning/phases/11-datumsabh-ngige-berechnung/11-DESKTOP-DISPOSITION.md`
trifft diese Entscheidung ausdrücklich und begründet sie zweifach:

1. **Abhängigkeitskonflikt (immer gültig):** Der Desktop hat keinen Datenbankzugriff und
   bräuchte eine Perioden-Lese-API. Die existiert nicht, und `11-CONTEXT.md` schließt sie für
   Phase 11 ausdrücklich aus („Keine Oberfläche und keine API zum Eintragen von Wechseln —
   das ist Phase 12"). Ein Umbau des Desktop-Codes gegen eine noch nicht existierende
   Schnittstelle wäre Kompilat gegen Wunschdenken.
2. **Gemessenes Wirksamkeitsfenster:** Drei Messzahlen gegen `11-nullwirkung.db` sind alle 0
   (Nutzer mit mehr als einer Periode: 0; Drift zwischen Stammdaten und offener Periode: 0;
   Nutzer ohne offene Periode: 0). Solange kein Nutzer eine zweite Periode haben kann, zeigt
   der Desktop für jedes Datum denselben Wert wie der Server.

Ergänzend belegt dieselbe Disposition, dass der Client-Wert eine reine UI-Vorschau ohne
Persistenzwirkung ist: Der Submit-Handler sendet kein `requiredHours`-Feld, der Server
berechnet den gebuchten Wert selbst periodengetreu neu. Ein falscher Client-Wert erzeugt
also eine irreführende Vorschauzahl, keine falsche Buchung.

**Ursprünglicher Befund:** Die Desktop-Kopie von `calculateAbsenceHoursWithWorkSchedule()`
bekommt `selectedUser.workSchedule`/`selectedUser.weeklyHours` — den heutigen Stand — und
kennt keine Feiertage. Für eine Abwesenheit über einen Stichtag zeigt das Formular damit 40h
an, während der Server 28h bucht.

**Zielphase:** Phase 12 („Stundenwechsel bedienen"). Die Übergabe ist in `.planning/ROADMAP.md`
unter „Umfang" der Phase 12 verankert und nennt die betroffenen Dateien namentlich.

---

## Hinweise für die menschliche Nachprüfung

Zwei Korrekturen ändern Ablauf- bzw. Zustandslogik und sind durch Syntax- und Testprüfung
allein nicht abschließend belegbar. Sie sollten vor der Verifikationsphase fachlich
bestätigt werden:

- **CR-01, Fall 3** (`hireDate` nach hinten verlegt → Periodenkette bleibt stehen). Die
  Entscheidung ist im Quelltext begründet und durch einen Test abgedeckt, sie ist aber eine
  fachliche Festlegung: Die Startperiode deckt danach mehr ab als das Beschäftigungsverhältnis.
  Für die Berechnung ist das folgenlos (Daten vor `hireDate` liefern 0), für die Datenhygiene
  ist es eine bewusste Wahl.
- **CR-06** (Abbruch des Migrationslaufs bei `MissingWorkPeriodError` statt Fortsetzung mit
  Warnung). Das entspricht D4, ändert aber das Verhalten eines Wartungsskripts von „läuft
  durch" zu „bricht ab". Der Probelauf auf der Arbeitskopie war fehlerfrei (0 Fehler,
  515 Buchungen), ein Bestand mit Datendefekt würde den Lauf jetzt jedoch beenden.

Weiterhin offen und hier **nicht** behoben, weil außerhalb des Befundumfangs:

- `validateOvertimeCalculation.ts:208` wirft im Datenbank-Modus
  `SqliteError: no such column: deletedAt` (`time_entries`). Vorbestehend, auf dem
  unveränderten Stand identisch reproduziert.
- Die 10 vorbestehenden Testfehlschläge in `balanceTracking.test.ts`,
  `unifiedOvertimeService.test.ts` und `vacationBackfillService.test.ts`.
- Die 8 Info-Befunde (IN-01 bis IN-08) waren nicht im Umfang `critical_warning`. IN-06
  (unvollständige Objekte per `as UserPublic`) berührt dieselbe Datei wie WR-13, wurde dort
  aber nicht mitgeändert.

---

_Korrigiert: 2026-08-22_
_Bearbeiter: Claude (gsd-code-fixer)_
_Durchlauf: 1_
