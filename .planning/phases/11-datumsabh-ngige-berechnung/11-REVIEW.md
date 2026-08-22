---
phase: 11-datumsabh-ngige-berechnung
reviewed: 2026-08-22T14:20:00Z
depth: standard
iteration: 2
files_reviewed: 17
files_reviewed_list:
  - server/scripts/create-admin.ts
  - server/src/scripts/migrateOvertimeToTransactions.ts
  - server/src/scripts/seedTestUsers.ts
  - server/src/scripts/validateAllTestUsers.ts
  - server/src/scripts/validateOvertimeCalculation.ts
  - server/src/scripts/verifyPeriodNullEffect.ts
  - server/src/services/absenceService.ts
  - server/src/services/exportService.ts
  - server/src/services/overtimeService.ts
  - server/src/services/overtimeTransactionRebuildService.ts
  - server/src/services/unifiedOvertimeService.ts
  - server/src/services/userService.ts
  - server/src/services/workPeriodContext.ts
  - server/src/services/workPeriodService.ts
  - server/src/utils/workingDays.ts
  - server/vitest.config.ts
  - server/vitest.setup.ts
findings:
  critical: 3
  warning: 9
  info: 6
  total: 18
status: findings
---

# Phase 11: Code-Review-Bericht (Durchlauf 2)

**Geprüft:** 2026-08-22
**Tiefe:** standard
**Geprüfte Dateien:** 17
**Status:** findings
**Grundlage:** Stand `6174c42`, verglichen gegen `c2cebce` (Fix-Lauf 1, 21 Korrekturen)

## Zusammenfassung

Der Fix-Lauf ist handwerklich überdurchschnittlich: `npx tsc --noEmit` läuft sauber, alle
Importe der geänderten Dateien werden benutzt, in `absenceService.ts`, `overtimeService.ts`,
`exportService.ts`, `userService.ts`, `workPeriodService.ts` und `workingDays.ts` steht kein
`console.log` mehr, und die CSV-Maskierung habe ich gegen 24 Eingaben nachgestellt und
ausgeführt — sie tut genau, was der Bericht behauptet.

Trotzdem hat der Lauf drei Löcher hinterlassen bzw. nicht gesehen, die schwerer wiegen als
die meisten Altbefunde. Die gezielten Prüffragen zuerst:

- **CR-01 (hireDate → validFrom):** Die drei Fälle sind schlüssig, und die Kette bleibt
  triggerkonform — ich habe Vorverlegung gegen `trg_user_work_periods_update_guard`
  durchgerechnet, sowohl ein- als auch mehrgliedrig (Lücken- und Überlappungsklausel
  schlagen in beiden Fällen nicht an). Die Nachführung liegt **in derselben Transaktion wie
  `UPDATE users`**, das Löschen von `overtime_balance` liegt jedoch **außerhalb** und
  verschluckt seinen Fehler (WR-09). Der eigentliche Defekt ist ein anderer: Bei einem
  nicht wohlgeformten `hireDate` steigt die Nachführung mit einer Warnung aus, die
  Saldolöschung läuft trotzdem, und der Wiederaufbau kann danach nicht mehr greifen (CR-02).
- **CR-05 (CSV):** Ausgeführt geprüft. `-3,50`, `8,00`, `-0,08`, `0,00` bleiben unangetastet;
  `=1+1`, `@SUM(A1)`, `+1+1`, `-1+1`, `-1e5`, `=cmd|'/c calc'!A1` werden entwertet; Semikolon,
  Anführungszeichen (verdoppelt) und Zeilenumbruch werden korrekt gequotet; die Reihenfolge
  entwerten→quoten stimmt; `null`/`undefined` werden leer. Kein `join(';')` in der Datei geht
  mehr an `csvField` vorbei. Einzige Lücke: führendes Leerzeichen vor dem Formelzeichen
  (IN-01).
- **CR-06 (Migration):** Ja, es wird vor dem Löschen gerechnet — `getDailyTargetHours()` und
  die Ist-Summe stehen vor `applyDate()`. Transaktional sauber ist der **Tag**, nicht der
  **Lauf**: Bei Abbruch bleiben alle vorher committeten Tage und Nutzer umgeschrieben stehen
  (WR-08).
- **WR-01 (Wochentagsquelle):** Innerhalb von `getDailyTargetHours()` ja — eine Quelle, aus
  `dateStr` abgeleitet. Die Zwillingsfunktion **in derselben Datei**
  (`calculateAbsenceHoursWithWorkSchedule`) trägt die Divergenz unverändert weiter (WR-01).
- **WR-03/WR-07 (Vereinzelung, await):** Das `await` ist an beiden Stellen richtig gesetzt.
  Die Vereinzelung verschluckt aber: Der DATEV-Export liefert nach dem Fix eine
  augenscheinlich vollständige Datei ohne die Daten des defekten Nutzers (CR-03), die
  Sammelauswertungen liefern stillschweigend unvollständige Summen (WR-03), und der als
  Gegenmaßnahme gebaute Bestands-Check `checkAllPeriodChains()` hat außerhalb der Tests
  **keinen einzigen Aufrufer** (WR-02).

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Das Validierungswerkzeug aus CLAUDE.md bricht in seinem Hauptmodus immer ab

**Datei:** `server/src/scripts/validateOvertimeCalculation.ts:234-242`
**Befund:** `validateUser()` liest
`SELECT date, hours FROM time_entries WHERE userId = ? AND deletedAt IS NULL`. Die Tabelle
`time_entries` hat **keine Spalte `deletedAt`** (`server/src/database/schema.ts:165-182`,
kein `ALTER TABLE time_entries ADD COLUMN` in irgendeiner Migration). Jeder Aufruf mit
`--userId=` oder `--all` endet deshalb mit `SqliteError: no such column: deletedAt`, gefangen
erst von `main().catch()` (Zeile 668). Damit ist genau der Befehl unbenutzbar, den
`.claude/CLAUDE.md` unter „Validation Tools" und „Overtime Bug Fix (Special Case)" als
Pflichtschritt vorschreibt (`npm run validate:overtime -- --userId=X`).

Der Fix-Lauf hat diese Funktion zweimal angefasst (CR-04 und WR-09) und den Fehler im
Fix-Bericht als „vorbestehend, außerhalb des Umfangs" notiert — als Befund erfasst wurde er
nie. Ein Werkzeug, das nie läuft, kann keine Nullwirkung belegen; die CR-04-Korrektur in
derselben Funktion ist damit bis heute unausgeführt.

**Fix:** Entweder die Bedingung streichen (das Projekt löscht Zeiteinträge hart) oder die
Spalte nachziehen, falls Soft Delete für `time_entries` gewollt ist (CLAUDE.md verbietet Hard
Delete). Minimal:

```ts
const timeEntries = db
  .prepare(`SELECT date, hours FROM time_entries WHERE userId = ?`)
  .all(userId) as Array<{ date: string; hours: number }>;
```

Danach `npm run validate:overtime -- --all` einmal ausführen und die Ausgabe dem
Verifikationsnachweis beilegen — sonst bleibt unbelegt, ob CR-04 überhaupt wirkt.

---

### CR-02: Ein unbrauchbares `hireDate` löscht die Salden und verhindert deren Wiederaufbau

**Dateien:** `server/src/services/userService.ts:111-140` (`syncStartPeriodToHireDate`),
`server/src/services/userService.ts:573-587` (Saldolöschung),
`server/src/services/overtimeService.ts:315-336`
**Befund:** `updateUser()` schreibt `data.hireDate` **ungeprüft** in die Spalte
(`values.push(data.hireDate)`, Zeile 449-452). Es gibt weder eine Routenvalidierung
(`validateUserUpdate` in `server/src/middleware/validation.ts:122-190` prüft `hireDate`
nicht) noch ein CHECK in `users` (`schema.ts:45`: nur `NOT NULL DEFAULT (date('now'))`).

Ablauf bei `PUT /api/users/:id` mit `{"hireDate":"31.12.2026"}` oder `""`:

1. `UPDATE users` schreibt den Müllwert — Erfolg.
2. `syncStartPeriodToHireDate()` erkennt das unpassende Format, **protokolliert eine Warnung
   und kehrt zurück** (Zeile 118-124). Die Periode bleibt stehen.
3. Direkt danach: `DELETE FROM overtime_balance WHERE userId = ?` (Zeile 581) — bedingungslos,
   weil `data.hireDate !== existingUser.hireDate` erfüllt ist.
4. Der versprochene Wiederaufbau („will recalculate on next access") kann nicht greifen:
   `ensureOvertimeBalanceEntries()` bildet `new Date(user.hireDate)` → `Invalid Date`,
   `getFullYear()` → `NaN`, die Monatsschleife `while (current <= targetDate)` läuft **null
   mal**. Es entsteht kein einziger Saldo-Datensatz mehr.

Ergebnis: HTTP 200, in der Oberfläche steht das falsche Datum, und die gesamte
Überstundenhistorie des Mitarbeiters zeigt 0 — ohne Fehlermeldung an irgendeiner Stelle. Die
gelöschten `overtime_balance`-Zeilen sind erst nach manueller Korrektur des Datums wieder
herstellbar; bis dahin ist der Bestand faktisch weg. Genau diesen Zustand („weder Saldo noch
die Möglichkeit, wieder einen zu bekommen") wollte CR-01 verhindern — für die eine Eingabe,
die die neue Funktion nicht behandelt, tritt er weiterhin ein.

**Fix:** Nicht warnen, sondern ablehnen — vor jedem Schreibvorgang:

```ts
if (data.hireDate !== undefined && !HIRE_DATE_PATTERN.test(data.hireDate ?? '')) {
  throw new Error(`hireDate muss YYYY-MM-TT sein, erhalten: ${String(data.hireDate)}`);
}
```

(analog zur bereits vorhandenen `weeklyHours`-Prüfung in Zeile 435-438, plus dieselbe Prüfung
in `validateUserUpdate`). `syncStartPeriodToHireDate()` kann den Warn-Zweig danach zu einem
`throw` verschärfen — er ist dann unerreichbar und dokumentiert die Zusage.

---

### CR-03: Der DATEV-Export liefert nach der Vereinzelung stillschweigend unvollständige Dateien

**Datei:** `server/src/services/exportService.ts:151-217`
**Befund:** Die WR-03-Vereinzelung fängt `MissingWorkPeriodError` je Nutzer, protokolliert
und `continue`t. Die Route (`server/src/routes/exports.ts:95-108`) antwortet danach mit
HTTP 200 und einer CSV-Datei, in der Zeiteinträge **und** Abwesenheiten des betroffenen
Nutzers vollständig fehlen — ohne Zeile, ohne Kommentar, ohne Hinweis im Dateinamen. Der
Empfänger dieser Datei ist laut Kopfkommentar Steuerberater und Betriebsprüfung (GoBD).

Das ist wörtlich dieselbe Eigenschaft, mit der der Fix-Bericht WR-11 begründet: „Die Datei
sah dabei vollständig aus — stiller Datenverlust." WR-11 hat einen solchen stillen Ausfall
beseitigt (soft-gelöschte Nutzer), WR-03 hat im selben Codeblock einen neuen eingeführt. Der
Vorzustand (500er) war unbequem, aber ehrlich; der jetzige Zustand ist ein prüfungsrelevantes
Dokument mit unbemerkter Lücke.

Zusätzlich fällt der Nutzer aus dem `catch` heraus, sobald der **erste** Tag wirft — die
Abwesenheitszeilen (Zeile 184-204), die gar kein `getDailyTargetHours()` brauchen, gehen
dabei mit verloren.

**Fix:** Den Defekt in die Antwort tragen, statt nur ins Log. Zum Beispiel: betroffene
Nutzer sammeln und
(a) mit `res.status(409)` samt Nutzerliste abbrechen, wenn die Datei vollständig sein muss, oder
(b) die Datei ausliefern und die übersprungenen Nutzer als eigenen, unübersehbaren
CSV-Block am Ende anhängen plus Warn-Header:

```ts
const skipped: number[] = [];
// ... im catch: skipped.push(user.id);
if (skipped.length > 0) {
  rows.push(['', '', '', '', '', '', '', '', 'EXPORT UNVOLLSTAENDIG', '', '',
    `Nutzer ohne Arbeitszeitperiode (Datendefekt D4): ${skipped.join(', ')}`]
    .map(csvField).join(';'));
  res.setHeader('X-Export-Incomplete', String(skipped.length)); // in der Route
}
```

Mindestens muss die Abwesenheitsschleife aus dem Fehlerbereich der Sollstunden-Berechnung
heraus (eigenes `try`), damit ein Datendefekt bei Zeiteinträgen nicht auch die Urlaubszeilen
verschluckt.

---

## Warnings

### WR-01: Die Zeitzonen-Vereinheitlichung endet an der Funktionsgrenze

**Datei:** `server/src/utils/workingDays.ts:247-283`, ergänzend `:372-385`
**Befund:** WR-01 hat `getDailyTargetHours()` auf eine Wochentagsquelle gebracht —
nachvollzogen und korrekt. Die Schwesterfunktion **in derselben Datei**,
`calculateAbsenceHoursWithWorkSchedule()`, trägt die beanstandete Konstruktion unverändert:

```ts
const dateStr = formatDateBerlin(d, 'yyyy-MM-dd');  // Europe/Berlin
const dayOfWeek = d.getDay();                        // PROZESS-Zeitzone
const dayName = DAY_NAMES[dayOfWeek];
```

Damit stammen Datum (Feiertagsabfrage, Periodenauflösung) und Wochentag (Wochenendfilter,
`period.workSchedule[dayName]`) wieder aus zwei verschiedenen Zeitauffassungen — dieselbe
Fehlerklasse, dieselbe Auslöserlage („PM2-Neustart ohne `TZ`"), die der WR-01-Kommentar 15
Zeilen weiter oben ausführlich begründet. Die Funktion ist kein Randweg: Sie bestimmt die
Stundenzahl jeder genehmigten Abwesenheit und jeder overtime_comp-Abbuchung
(`absenceService.ts:846`, `:920`).

Gleiche Klasse, zweite Stelle: `isPublicHoliday()` bildet über `formatDate()` (Zeile 380-385,
**lokale** Getter) den Datumsschlüssel für ein `Date`, das `countWorkingDaysBetween()` und
`countWorkingDaysForUser()` als **UTC**-Mitternacht konstruiert haben (Zeile 420, 602). Unter
einer Zeitzone mit negativem Versatz liegt der Feiertagsvergleich damit einen Tag daneben.

**Fix:** `dayIndexFromDateString(dateStr)` auch in `calculateAbsenceHoursWithWorkSchedule()`
benutzen und `d.getDay()` streichen; in `isPublicHoliday()` den Datumsschlüssel per
`getUTCFullYear()/getUTCMonth()/getUTCDate()` bilden, passend zur UTC-Konstruktion der
Aufrufer.

---

### WR-02: `checkAllPeriodChains()` hat keinen Aufrufer — der Bestands-Check läuft nie

**Datei:** `server/src/services/workPeriodService.ts:493-526`
**Befund:** Die zweite von WR-03 geforderte Maßnahme ist implementiert und getestet, aber
nirgends verdrahtet. Über das gesamte Repository findet sich außerhalb von
`workPeriodService.test.ts` kein einziger Aufruf — kein CLI-Skript, kein npm-Script, keine
Admin-Route, kein Startlauf; die einzige weitere Erwähnung ist ein Kommentar in
`overtimeService.ts:512`. Damit gilt die Zusage aus dem Fix-Bericht („Diese Funktion findet
denselben Defekt VORHER") faktisch nicht: Der Defekt fällt weiterhin erst auf, wenn ihn
jemand in `pm2 logs` sucht — und nach CR-03/WR-03 gibt es keinen sichtbaren Ausfall mehr, der
zum Nachsehen anleitet. Die Vereinzelung hat den Alarm abgeschaltet, ohne den Ersatzmelder
anzuschließen.

**Fix:** Einen der drei Wege verdrahten (bevorzugt alle):
`server/src/scripts/checkPeriodChains.ts` als CLI mit `npm run check:period-chains` und
Exitcode 1 bei Befunden; ein Aufruf beim Serverstart mit `logger.error` je Befund; eine
Admin-Route `GET /api/admin/period-chains`.

---

### WR-03: Sammelauswertungen melden nach der Vereinzelung stillschweigend falsche Summen

**Datei:** `server/src/services/overtimeService.ts:515-528`, Aufrufer `:554`, `:564`, `:613`
**Befund:** `ensureOvertimeBalanceEntriesIsolated()` überspringt den defekten Nutzer, danach
läuft die Abfrage unverändert weiter. In `getAllUsersOvertimeSummary()` liefert der
`LEFT JOIN` mit `COALESCE(..., 0)` für diesen Nutzer 0/0/0 — in der Oberfläche nicht von
einem Mitarbeiter zu unterscheiden, der tatsächlich nichts gearbeitet hat.
`getAggregatedOvertimeStats()` summiert über alle Zeilen und gibt eine **Gesamtsumme** aus,
in der ein Mitarbeiter fehlt oder mit veraltetem Stand steckt; die API-Antwort enthält kein
Feld, das darauf hinweist.

Für eine Kennzahl, die als Grundlage für Auszahlung und Abbau dient, ist eine stillschweigend
falsche Zahl schlechter als eine ausbleibende. Die Vereinzelung selbst ist richtig — die
fehlende Rückmeldung ist der Mangel.

**Fix:** Die übersprungenen `userId`s aus der Hilfsfunktion zurückgeben und in die
Antwortstruktur aufnehmen, z. B.
`{ data: [...], dataQuality: { skippedUserIds: number[], reason: 'missing_work_period' } }`,
und in der Oberfläche als Warnbanner darstellen. Solange die Antwortstruktur nicht geändert
werden soll, mindestens `logger.error` beibehalten **und** WR-02 verdrahten.

---

### WR-04: WR-09 hat in `unifiedOvertimeService` ein `any` durch einen falschen Typ ersetzt

**Datei:** `server/src/services/unifiedOvertimeService.ts:334-342`
**Befund:** Die Zusicherung lautet jetzt
`as (Omit<UserPublic, 'workSchedule'> & { workSchedule: string | null }) | undefined`. Die
SELECT-Liste enthält aber nur `id, username, firstName, lastName, email, role, weeklyHours,
workSchedule, hireDate, endDate, position, department`. In `UserPublic`
(`server/src/types/index.ts:54-73`) sind darüber hinaus **`vacationDaysPerYear`, `status`,
`privacyConsentAt` und `createdAt` pflichtig**. Das Objekt liefert für diese vier zur Laufzeit
`undefined`, während der Compiler sie als vorhanden garantiert — die Funktion gibt es
anschließend als vollständiges `UserPublic` zurück (Zeile 346-350). Ein `any` sagt „ich weiß
es nicht"; dieser Typ sagt „ich weiß es" und liegt falsch. Heute liest nur `user.hireDate`
(Zeile 189, 277) daraus, der Schaden ist also latent — genau das macht ihn zur Falle für den
nächsten Aufrufer.

Dass es anders geht, steht im selben Fix-Lauf: `absenceService.ts:770-788` benutzt dieselbe
Konstruktion mit einer SELECT-Liste, die tatsächlich alle Felder enthält.

**Fix:** Entweder die vier Spalten in die Abfrage aufnehmen (wie in `absenceService.ts`) oder
einen ehrlichen Zeilentyp deklarieren und den Rückgabetyp auf das einschränken, was die
Funktion wirklich liefert:

```ts
type OvertimeUserRow = Pick<UserPublic,
  'id'|'username'|'firstName'|'lastName'|'email'|'role'|'weeklyHours'|'hireDate'|'endDate'|'position'|'department'
> & { workSchedule: string | null };
```

---

### WR-05: `getPublicHolidays()` verschluckt Fehler und macht Feiertage zu Arbeitstagen

**Datei:** `server/src/utils/workingDays.ts:354-367`
**Befund:** WR-09 hat hier die Signatur angefasst (`dbInstance?: BetterSqlite3.Database`), den
Rumpf aber stehen lassen:

```ts
} catch (error) {
  console.error('❌ Error fetching holidays:', error);
  return [];
}
```

Zwei Mängel in vier Zeilen. Erstens: Ein leeres Array ist von „dieses Jahr hat keine
Feiertage" nicht zu unterscheiden — `countWorkingDaysBetween()` und
`countWorkingDaysForUser()` zählen danach Feiertage als volle Arbeitstage und heben die
Sollstunden für jeden betroffenen Zeitraum an. Zweitens: `console.error` in einem aktiven
Servicepfad ist genau das, was WR-08 in zwei anderen Dateien beseitigt hat und was
`.claude/CLAUDE.md` unter „VERBOTE → Code Quality" untersagt; die Datei ist damit die letzte
in der Prüfmenge mit einem Konsolenaufruf.

**Fix:**

```ts
} catch (error) {
  logger.error({ err: error, year }, '❌ Feiertagsabfrage fehlgeschlagen');
  throw error;   // kein stiller Rückfall auf "keine Feiertage"
}
```

`logger` ist in der Datei bereits importiert (Zeile 6).

---

### WR-06: Fehlerobjekte unter dem Schlüssel `error` — pino serialisiert sie zu `{}`

**Dateien:** `server/src/scripts/migrateOvertimeToTransactions.ts:155,169,264,269,352`,
`server/src/scripts/seedTestUsers.ts:739`
**Befund:** `server/src/utils/logger.ts` konfiguriert keinen eigenen Serializer; pino wendet
den Fehler-Serializer ausschließlich auf den Schlüssel `err` an. Ein `Error` unter `error`
landet über `JSON.stringify` im Log — `message` und `stack` sind nicht aufzählbar, übrig
bleibt `"error": {}`.

`seedTestUsers.ts:764-768` beschreibt genau diesen Fallstrick als behobenen Bug — und
Zeile 739 derselben Datei macht ihn weiterhin (`logger.error({ userId: user.id, error }, '❌
Failed to calculate overtime balance')`).

Am schwersten wiegt `migrateOvertimeToTransactions.ts:269`: Das ist der Zweig, den CR-06
ausdrücklich als „Warnung mit Fortsetzung" belassen hat. Ein hier auftretender Fehler — etwa
ein `WorkPeriodConflictError` oder ein kaputter `workSchedule`-Text aus
`parseWorkSchedule()` — wird übersprungen **und** hinterlässt keinerlei Angabe darüber, was
schiefging. Der Lauf meldet danach `errors: []` und „MIGRATION COMPLETED".

**Fix:** In allen sechs Zeilen `{ error }` → `{ err: error }`. Als Dauerlösung
`errorKey`/`serializers` in `logger.ts` setzen, damit beide Schlüssel tragen.

---

### WR-07: Der Unversehrtheitsnachweis deckt jetzt die riskanteste Schreibphase nicht mehr ab

**Datei:** `server/src/scripts/verifyPeriodNullEffect.ts:319-340`
**Befund:** WR-13 hat den Ausgangs-Hash bewusst **hinter** `await import('../database/
connection.js')` verschoben. Dieser Import führt `initializeDatabase()`, `createIndexes()`
und `verifyIndexes()` aus (`server/src/database/connection.ts:30-50`) — also `CREATE TABLE IF
NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` und in der Folge Migrationen. Genau diese Phase ist
der einzige Zeitpunkt, an dem dieses Werkzeug überhaupt schreiben kann; der Rest der Datei
enthält nachweislich kein `.run(`. Vorher lag der Hash davor und hätte solche Schreibvorgänge
angezeigt. Der Nachweis ist nach der Korrektur WAL-fest, prüft aber die Phase nicht mehr, die
er prüfen sollte — eine andere Blindstelle, nicht keine.

Zwei kleinere Folgen im selben Block: In der `catch`-Kategorie wird `daysChecked++` gezählt,
obwohl an diesem Tag kein Vergleich stattfand (Zeile 406) — „geprüfte Tage" überzeichnet.
Und weil `altDailyTargetHours()` für diese Tage gar nicht erst gerufen wird, sind die Tage
mit Datendefekt aus der Abweichungszählung ausgenommen; die Aussage „0 Abweichungen" gilt
dann für eine kleinere Menge als angegeben.

**Fix:** Beide Hashes bilden — einen vor dem dynamischen Import (deckt Schemainitialisierung
ab) und einen nach dem Checkpoint (deckt WAL ab) — und beide getrennt ausweisen. Ferner
`daysChecked` erst nach erfolgtem Vergleich erhöhen und die Zeile
`Tage ohne Periode` in der Zusammenfassung neben `geprüfte Tage` als Abzug ausweisen.

---

### WR-08: Die Migration meldet Erfolg trotz Fehlern und hinterlässt bei Abbruch einen Halbzustand

**Datei:** `server/src/scripts/migrateOvertimeToTransactions.ts:208-272`, `:363-394`
**Befund:** Zwei Punkte an der CR-06-Korrektur.

1. **Exitcode:** Der CLI-Zweig gibt `stats.errors` aus, wertet sie aber nicht. Ist
   `verifyMigration()` zufrieden, endet der Lauf mit `console.log('✅✅✅ MIGRATION
   SUCCESSFUL')` und `process.exit(0)` — auch wenn zuvor beliebig viele Nutzer in
   `stats.errors` gelandet sind. In einer Pipeline ist das ein grünes Häkchen auf einem
   unvollständigen Lauf.
2. **Abbruch:** Der `MissingWorkPeriodError` wird korrekt bis nach oben durchgereicht, aber
   jeder Tag ist eine eigene `db.transaction` und jeder Nutzer eine eigene Schleifenrunde.
   Beim Abbruch sind alle vorher verarbeiteten Tage und Nutzer bereits committet — der
   Bestand steht zwischen altem und neuem Stand. Das ist bei einem
   wiederholbaren Skript verkraftbar (nichts geht verloren, weil vor dem Löschen gerechnet
   wird), muss aber ausgesprochen sein: Die Formulierung „Wirft die Berechnung, ist zu diesem
   Zeitpunkt nichts angefasst" gilt für den einzelnen Tag, nicht für den Lauf.

**Fix:** `process.exit(stats.errors.length > 0 || !verification.success ? 1 : 0)` und im
Abbruchpfad die Zahl der bereits verarbeiteten Nutzer/Tage ausgeben, damit der Bediener weiß,
wo er steht. Den Halbzustand im Kopfkommentar unter „SAFE TO RUN MULTIPLE TIMES" benennen.

---

### WR-09: Die Saldolöschung nach einer `hireDate`-Änderung steht außerhalb der Klammer und schluckt ihren Fehler

**Datei:** `server/src/services/userService.ts:527-556` (Transaktion) und `:573-587` (Löschung)
**Befund:** Zur gezielten Prüffrage: Die CR-01-Nachführung liegt in derselben Transaktion wie
`UPDATE users` — richtig und belegt. Das `DELETE FROM overtime_balance` läuft jedoch erst
nach `applyUpdate()`, in einem eigenen `try/catch`, das den Fehler nur protokolliert
(„Don't fail the update"). Scheitert es (gesperrte Datei, Verbindungsverlust), bleibt der
Nutzer mit neuem `hireDate`, neuer Periode und Salden zurück, die gegen das **alte**
`hireDate` gerechnet wurden — und die API antwortet mit 200 und dem aktualisierten Nutzer.
Die Reihenfolge ist immerhin richtig herum (erst Periode, dann Löschung), der Ausfall bleibt
aber unsichtbar.

**Fix:** Die Löschung in `applyUpdate()` ziehen (sie ist synchron und passt in die
better-sqlite3-Transaktion) oder mindestens den Fehler in die Antwort tragen, statt ihn zu
verschlucken:

```ts
if (hireDateChanged) {
  syncStartPeriodToHireDate(id, data.hireDate, existingUser);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(id);
}
```

---

## Info

### IN-01: `csvField()` entwertet keine Formel mit führendem Leerzeichen

**Datei:** `server/src/services/exportService.ts:30,55-67`
**Befund:** Ausgeführt geprüft: `' =1+1'` (führendes Leerzeichen) passiert die Maskierung
unverändert, weil `CSV_FORMULA_PREFIX` am Zeichenkettenanfang verankert ist. Excel wertet das
nicht als Formel; Importwege, die Felder trimmen (LibreOffice mit „Leerzeichen abschneiden",
viele Weiterverarbeitungsskripte), schon.
**Fix:** Vor der Prüfung auf einer getrimmten Kopie testen:
`if (CSV_FORMULA_PREFIX.test(s.trimStart()) && !CSV_PLAIN_NUMBER.test(s.trim())) …`

### IN-02: Toter Rückfall und toter Eintrag in `getCreditType()`

**Datei:** `server/src/services/overtimeTransactionRebuildService.ts:469-481`
**Befund:** Das Mapping ist seit WR-09 ein vollständiges `Record<AbsenceDayType, …>`; der
Ausdruck `mapping[absenceType] || 'time_entry'` kann daher nie den rechten Zweig nehmen — der
Fallback, dessen Wegfall der Kommentar als Gewinn beschreibt, steht noch im Code. Der
Eintrag `'unpaid': 'unpaid_deduction'` ist ebenfalls unerreichbar (der einzige Aufrufer,
Zeile 396, schließt `unpaid` und `overtime_comp` vorher aus) — nachgeprüft und korrekt so
kommentiert, aber die Kombination aus totem Eintrag und totem Fallback lädt zu Fehlschlüssen
ein.
**Fix:** `return mapping[absenceType];` und den Fallback streichen.

### IN-03: `db.close()` auf der geteilten Verbindung

**Datei:** `server/src/scripts/validateOvertimeCalculation.ts:666`
**Befund:** CR-03 hat in `validateAllTestUsers.ts` das `db.close()` mit der Begründung
entfernt, die geteilte Verbindung gehöre dem Skript nicht. Dieses Skript arbeitet seit dem
Umbau ebenfalls auf `database/connection.js` und schließt sie am Ende trotzdem. Für einen
CLI-Lauf folgenlos, als Muster inkonsistent und für einen künftigen Importeur ein Fußangel.
**Fix:** Zeile streichen, mit demselben Kommentar wie in `validateAllTestUsers.ts:328-330`.

### IN-04: Wochenplan-Vergleich über `JSON.stringify` ist von der Schlüsselreihenfolge abhängig

**Dateien:** `server/src/services/userService.ts:175-177` und `:508-511`
**Befund:** `JSON.stringify(current.workSchedule ?? null) !== JSON.stringify(desiredSchedule)`
vergleicht Text, nicht Werte. Zwei fachlich gleiche Wochenpläne mit anderer
Schlüsselreihenfolge gelten als verschieden und lösen ein überflüssiges `UPDATE` aus. Die
Zusage „ein zweiter Aufruf mit unveränderten Stammdaten schreibt nichts" im Kopfkommentar von
`mirrorUserToWorkPeriod()` gilt damit nicht unbedingt.
**Fix:** Feldweise über `WEEKDAY_KEYS` vergleichen (die Liste existiert in
`workPeriodService.ts:72-80`) oder vor dem Vergleich kanonisch sortiert serialisieren.

### IN-05: `questionHidden()` stellt die Ausgabe nicht in jedem Fall wieder her

**Datei:** `server/scripts/create-admin.ts:44-63`
**Befund:** Der Kopfkommentar sagt zu, das ursprüngliche Verhalten werde wiederhergestellt
„auch dann, wenn `rl.question()` mit einem Fehler endet" — es gibt aber weder `try/finally`
noch einen Fehlerpfad. Endet der Eingabestrom (`close`, Ctrl-D), wird der Rückruf nie
gerufen: Das Promise bleibt offen, `_writeToOutput` bleibt stummgeschaltet, das Skript hängt
ohne Ausgabe. Die Maskierung selbst ist korrekt (Prototypmethode wird sauber gesichert und
zurückgeschrieben).
**Fix:** `rl.once('close', …)` mit `reject`/`resolve('')` versehen und die Wiederherstellung
in einen gemeinsamen `restore()`-Aufruf ziehen; alternativ die Zusage aus dem Kommentar
streichen.

### IN-06: `validateAllTestUsers.ts` bricht weiterhin beim ersten Nutzer ohne Periode ab

**Datei:** `server/src/scripts/validateAllTestUsers.ts:100-106`, `:240-249`
**Befund:** WR-13 hat `verifyPeriodNullEffect.ts` eine eigene Ergebniskategorie für
`MissingWorkPeriodError` gegeben, damit ein Prüfwerkzeug den Bestand vollständig durchsieht.
Das Schwesterwerkzeug hat sie nicht: `getDailyTargetHours()` läuft dort ungeschützt in der
Tagesschleife, der Fehler beendet das Skript, bevor ein Bericht geschrieben wird — dieselbe
Begründung, dieselbe Datei-Kategorie, andere Behandlung.
**Fix:** Denselben `catch`-Block wie in `verifyPeriodNullEffect.ts:402-414` einsetzen und die
betroffenen Nutzer im Bericht als eigene Statuskategorie („DATENDEFEKT") ausweisen.

---

_Geprüft: 2026-08-22_
_Prüfer: Claude (gsd-code-reviewer)_
_Tiefe: standard · Durchlauf 2_
