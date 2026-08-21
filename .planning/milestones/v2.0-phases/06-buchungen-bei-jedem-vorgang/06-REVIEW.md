---
phase: 06-buchungen-bei-jedem-vorgang
reviewed: 2026-08-19T22:15:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - server/src/routes/absences.ts
  - server/src/routes/users.ts
  - server/src/routes/vacationBalance.ts
  - server/src/services/absenceService.ts
  - server/src/services/absenceVacationBooking.test.ts
  - server/src/services/vacationBalanceService.ts
  - server/src/services/vacationCorrectionBooking.test.ts
  - server/src/services/vacationEntitlementBooking.test.ts
  - server/src/services/yearEndRolloverService.ts
findings:
  critical: 7
  warning: 20
  info: 0
  total: 27
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-08-19T22:15:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Geprüft wurde die Einführung des Urlaubs-Journals (`vacation_transactions`) parallel zum
bestehenden Zähler `vacation_balance.taken`. Die Transaktionsklammern in
`approveAbsenceRequest`, `rejectAbsenceRequest`, `deleteAbsenceRequest`,
`upsertVacationBalance`, `updateVacationBalance`, `bulkInitializeVacationBalances` und
`initializeVacationAccountsForNewUser` sind korrekt gesetzt; Vorzeichen und Differenzbildung
der Korrekturbuchungen (`taken` invertiert, `entitlement`/`carryover` direkt) stimmen.

Das erklärte Ziel der Phase — „per Konstruktion kann eine Änderung an `taken` nicht mehr ohne
zugehörige Buchung passieren" — wird jedoch **nicht** erreicht. Es existieren mehrere
Schreibpfade auf `vacation_balance`, die ohne Journalbuchung auskommen (CR-02), ein
Genehmigungspfad, der die gesamte Buchungslogik umgeht (CR-04), und ein Jahreswechsel-Loch,
das genau die Urlaubstage vernichtet, deren Verlust dieser Milestone verhindern soll (CR-03).
Zusätzlich ist ein in dieser Phase neu kommentierter `require()`-Aufruf in einem
ESM-Modul faktisch toter Code (CR-01, empirisch verifiziert).

Empirischer Befund aus der Entwicklungsdatenbank (`server/database/development.db`,
18 Bestandsnutzer): `vacation_balance` enthält 18 Zeilen für 2026 und 13 für 2027,
`vacation_transactions` ist **leer**. Die Invariante `Journal == entitlement + carryover −
taken`, auf die Phase 7 aufbauen soll, ist für sämtliche Bestandskonten heute verletzt — und
die 13 vorab angelegten 2027-Konten lösen beim Jahreswechsel CR-03 aus.

## Critical Issues

### CR-01: `require()` in einem ESM-Modul — Überstunden-Neuberechnung nach Löschung läuft nie

**File:** `server/src/services/absenceService.ts:1127-1130` (zusätzlich `:1346`)
**Issue:**
`server/package.json` setzt `"type": "module"`, `tsconfig.json` setzt `"module": "ESNext"`.
In einem ESM-Modul ist `require` nicht definiert. Der in dieser Phase neu hinzugefügte
Kommentar behauptet das Gegenteil:

```ts
// Bleibt außerhalb der Transaktion — abgeleiteter Wert, nutzt require() (CJS-Interop).
if (request.status === 'approved') {
  try {
    const { updateMonthlyOvertime } = require('./overtimeService.js');
```

Der Aufruf wirft sofort `ReferenceError: require is not defined`; das umgebende `try/catch`
verschluckt ihn und protokolliert irreführend „Failed to import overtimeService". Ergebnis:
**Nach dem Löschen eines genehmigten Urlaubs-/Krankheits-Antrags wird das Überstundenkonto
nie neu berechnet.** Die Gutschrift-Transaktionen der gelöschten Abwesenheit bleiben stehen.
Dieselbe Zeile in `deleteSickLeaveTimeEntries` (`:1346`) läuft in einer Tagesschleife und
scheitert dort bei jedem Schleifendurchlauf.

Empirisch verifiziert (Node, `{"type":"module"}`): `require FAILED: ReferenceError require is
not defined`. Es sind die einzigen zwei `require(`-Aufrufe im gesamten `server/src`; ein
`createRequire`-Shim existiert nicht. `tsc --noEmit` schlägt nicht an, weil `@types/node`
`require` global deklariert — genau der „kompiliert, funktioniert aber nicht"-Fall.

Die übrigen drei Aufrufstellen im selben Kontext (`approveAbsenceRequest:837`,
`rejectAbsenceRequest:1030`) verwenden korrekt `await import()`. Hier ist es nicht möglich,
weil `deleteAbsenceRequest` synchron ist.

**Fix:**
```ts
// Datei-Kopf (statisch, kein dynamischer Import nötig — Zirkularität besteht nur
// timeEntryService -> absenceService, nicht overtimeService -> absenceService; bitte
// verifizieren, sonst createRequire verwenden):
import { updateMonthlyOvertime } from './overtimeService.js';
import { updateAllOvertimeLevels } from './overtimeService.js';

// ...und die require()-Zeilen ersatzlos entfernen.
```
Falls der statische Import tatsächlich einen Zyklus erzeugt, `deleteAbsenceRequest` zu
`async` machen und `await import()` verwenden (der Aufrufer `routes/absences.ts:682` liegt
bereits in einem Request-Handler und kann `await`en). Zusätzlich: das `catch` darf einen
`ReferenceError` nicht als „Import fehlgeschlagen" schönreden — Fehlertyp mitloggen.

---

### CR-02: Urlaubskonten entstehen weiterhin ohne Journalbuchung — Kerninvariante der Phase gebrochen

**File:** `server/src/services/absenceService.ts:1379-1423`, `:1428-1442`, `:198-211`;
`server/src/routes/absences.ts:759-763`
**Issue:**
`absenceService.initializeVacationBalance()` legt `vacation_balance`-Zeilen mit
`entitlement` und `carryover` an bzw. überschreibt sie — **ohne jede Journalbuchung**:

```ts
const query = `
  INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
  VALUES (?, ?, ?, ?, 0)
  ON CONFLICT(userId, year) DO UPDATE SET entitlement = ?, carryover = ?
`;
```

Diese Funktion ist über drei Wege erreichbar, alle in Produktion aktiv:

1. `hasEnoughVacationDays()` (`:202-211`) → aufgerufen aus `createAbsenceRequest` bei jedem
   Urlaubsantrag für ein Jahr ohne Konto.
2. `updateVacationTaken()` (`:1430-1433`) → aufgerufen aus `updateBalancesAfterApproval` und
   `revertBalancesAfterDeletion`, also **innerhalb** der neuen Buchungsklammer.
3. `GET /api/absences/vacation-balance/:year` (`routes/absences.ts:761-763`) → das bloße
   *Anzeigen* eines Saldos legt ein ungebuchtes Konto an.

Konkretes Szenario: Mitarbeiter (30 Tage, angelegt 2025, Konten für 2025/2026 vorhanden)
beantragt im Dezember 2026 Urlaub für Januar 2028. `hasEnoughVacationDays(…, 2028, …)` legt
still ein Konto mit `entitlement = 30, carryover ≤ 5` an. Journal 2028 = 0, Konto = 35.
Nach Genehmigung von 2 Tagen: Journal = −2, `entitlement + carryover − taken` = 33.
**Abweichung: 35 Tage.** Ab Phase 7, wenn das Journal maßgeblich wird, verliert der
Mitarbeiter seinen kompletten Jahresanspruch.

Der Widerspruch ist in den mitgelieferten Tests bereits eingebacken und damit beweisbar:

* `absenceVacationBooking.test.ts:195-216` behauptet die Invariante `taken + journal === 0`.
* `vacationEntitlementBooking.test.ts:266-270` behauptet
  `journal === entitlement + carryover − taken`.

Beide können nur gleichzeitig gelten, wenn `entitlement + carryover === 0`. In
`absenceVacationBooking.test.ts` ist das der Fall — aber nur, weil das Konto dort über den
ungebuchten Pfad aus `hasEnoughVacationDays` entsteht (die Testnutzer werden ohne
`vacationDaysPerYear` angelegt, Schema-Default 30 → Konto mit `entitlement = 30`, Journal
leer). Der Test grünt also **aus dem falschen Grund** und zementiert genau den Defekt.

**Fix:**
```ts
// absenceService.ts: eigene Kontoanlage entfernen und an den buchenden Pfad delegieren.
import { upsertVacationBalance, getVacationBalance as getVB }
  from './vacationBalanceService.js';

export function initializeVacationBalance(userId: number, year: number): VacationBalance {
  const user = db.prepare('SELECT vacationDaysPerYear FROM users WHERE id = ?')
    .get(userId) as { vacationDaysPerYear: number } | undefined;
  if (!user) throw new Error('User not found');

  const prev = getVB(userId, year - 1);
  const carryover = prev && prev.remaining > 0 ? Math.min(prev.remaining, 5) : 0;

  // bucht entitlement/carryover ins Journal (Neuanlage-Zweig)
  return upsertVacationBalance({
    userId, year, entitlement: user.vacationDaysPerYear, carryover, actorId: null,
  });
}
```
Zusätzlich `absenceVacationBooking.test.ts` so umstellen, dass das Konto über
`initializeVacationAccountsForNewUser` entsteht, und dort **beide** Invarianten prüfen
(`journal === entitlement + carryover − taken`). Die Bestandskonten (18 Zeilen 2026 / 13
Zeilen 2027 ohne jede Journalzeile) brauchen einen Backfill, bevor Phase 7 den Zähler ablöst.

---

### CR-03: Jahreswechsel verliert den Übertrag aller im Vorjahr angelegten Mitarbeiter

**File:** `server/src/services/vacationBalanceService.ts:419-427` i.V.m. `:653-658`, `:679-684`
**Issue:**
`initializeVacationAccountsForNewUser` legt bei jeder Nutzeranlage **zwei** Konten an:
laufendes Jahr *und* Folgejahr (`:421-427`, „full entitlement for planning").

`bulkInitializeVacationBalances` — der einzige Pfad, der beim Jahreswechsel den Übertrag
berechnet und bucht — überspringt jedes bereits existierende Konto:

```ts
const existing = getVacationBalance(user.id, year);
if (existing) {
  continue; // Skip if already exists
}
```

Für einen 2026 angelegten Mitarbeiter existiert das 2027-Konto bereits mit `carryover = 0`.
Beim Jahreswechsel auf 2027 wird er übersprungen: **kein Übertrag im Konto, keine
`carryover`-Buchung im Journal.** Seine Resttage aus 2026 verfallen ersatzlos und
unprotokolliert — exakt der Schadensfall, den dieser Milestone abstellen soll.

Empirisch belegt: die Entwicklungsdatenbank enthält heute 13 vorab angelegte 2027-Konten.
Alle 13 verlieren zum 01.01.2027 ihren Übertrag.

Der Docstring `:626-627` („Idempotent: Ein zweiter Lauf überspringt bereits existierende
Konten — dadurch entstehen auch keine doppelten Buchungen") beschreibt diese Lücke als
Feature und verdeckt sie dadurch.

**Fix:**
```ts
// bulkInitializeVacationBalances: bestehende Konten nicht blind überspringen, sondern
// einen fehlenden Übertrag nachtragen (weiterhin idempotent, weil nur gebucht wird,
// wenn carryover tatsächlich von 0 abweicht und noch keine carryover-Buchung existiert).
const existing = getVacationBalance(user.id, year);
if (existing) {
  const alreadyBooked = db.prepare(`
    SELECT COUNT(*) AS c FROM vacation_transactions
    WHERE userId = ? AND year = ? AND type = 'carryover'
  `).get(user.id, year) as { c: number };

  if (alreadyBooked.c === 0 && carryover > 0) {
    db.transaction(() => {
      db.prepare('UPDATE vacation_balance SET carryover = ? WHERE userId = ? AND year = ?')
        .run(carryover, user.id, year);
      recordVacationTransaction({
        userId: user.id, year, date: `${year}-01-01`, type: 'carryover', days: carryover,
        description: `Übertrag aus ${previousYear}`, referenceType: 'system', createdBy,
      });
    })();
    count++;
  }
  continue;
}
```
Regressionstest ergänzen: Nutzer im Vorjahr über `initializeVacationAccountsForNewUser`
anlegen, Resttage im Vorjahr erzeugen, `performYearEndRollover` ausführen, `carryover > 0`
und `carryover`-Buchung erwarten.

---

### CR-04: Mitarbeiter kann eigenen Antrag per PUT selbst genehmigen — komplette Buchungslogik umgangen

**File:** `server/src/routes/absences.ts:391-434`; `server/src/services/absenceService.ts:719-722`;
`server/src/middleware/validation.ts:517-525`
**Issue:**
`PUT /api/absences/:id` ist nur mit `requireAuth` und `validateAbsenceUpdate` geschützt. Die
Berechtigungsprüfung lässt den Eigentümer passieren (`:419-428`), `validateAbsenceUpdate`
erlaubt `status` ausdrücklich (`'pending' | 'approved' | 'rejected'`), und
`updateAbsenceRequest` schreibt ihn ungeprüft:

```ts
if (data.status !== undefined) {
  fields.push('status = ?');
  values.push(data.status);
}
```

Ein Mitarbeiter kann damit
`PUT /api/absences/42 {"status":"approved"}` auf den eigenen Antrag ausführen. Folgen:

* Rechteausweitung — `requireAdmin` auf `/approve` wird vollständig umgangen.
* `updateBalancesAfterApproval()` läuft nicht → **keine `vacation_taken`-Buchung**, `taken`
  bleibt unverändert. Ein genehmigter Urlaub existiert ohne jede Spur im Journal.
* Keine Überstundenprüfung bei `overtime_comp`, keine Bereinigung kollidierender
  Zeiterfassungen, keine Benachrichtigung, keine Überstunden-Neuberechnung.
* Wird der Antrag später über `/reject` abgelehnt, ist `wasApproved === true` →
  `revertBalancesAfterDeletion` bucht eine `vacation_reverted`-**Gutschrift** und
  `updateVacationTaken(-days)`, obwohl nie etwas abgezogen wurde. Der Mitarbeiter gewinnt
  Urlaubstage.

Das ist der direkteste Gegenbeweis zur Kernaussage der Phase („eine Änderung an `taken` kann
nicht mehr ohne Buchung passieren") — hier ändert sich der Antragsstatus ohne Buchung, und
die spätere Gegenbuchung erzeugt aktiv falsche Salden.

**Fix:**
```ts
// absenceService.updateAbsenceRequest: Statuswechsel gehört ausschließlich in
// approveAbsenceRequest/rejectAbsenceRequest.
if (data.status !== undefined && data.status !== existing.status) {
  throw new Error(
    'Invalid: Statuswechsel nur über /approve bzw. /reject (dort liegt die Journalbuchung)'
  );
}
```
Zusätzlich `status` aus `AbsenceRequestUpdateInput` (`:25-31`) und aus
`validateAbsenceUpdate` entfernen, damit der Pfad gar nicht erst antwortbar ist.

---

### CR-05: IDOR — jeder angemeldete Nutzer kann das Urlaubskonto beliebiger Kollegen lesen

**File:** `server/src/routes/vacationBalance.ts:67-140`
**Issue:**
```ts
router.get('/:userId', requireAuth, (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  ...
  const balances = getAllVacationBalances({ userId, year });
```
Kein `requireAdmin`, keine Eigentümerprüfung. Der Router ist unter `/api/vacation-balances`
**und** `/api/vacation-balance` gemountet (`server/src/server.ts:186-187`). Damit liefert
`GET /api/vacation-balance/7?year=2026` jedem Mitarbeiter Anspruch, Übertrag, genommene und
verbleibende Urlaubstage jedes Kollegen — inklusive `firstName`, `lastName`, `email` aus dem
JOIN in `getAllVacationBalances` (`:126-135`).

Das ist eine Autorisierungslücke mit Personalbezug (DSGVO-relevant) und steht im Widerspruch
zur bewussten Privacy-Entscheidung an anderer Stelle des Systems
(`routes/absences.ts:39-53`: „Returns only approved absences for privacy").

**Fix:**
```ts
router.get('/:userId', requireAuth, (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, error: 'Invalid user ID' });
  }

  const isAdmin = req.session.user!.role === 'admin';
  if (!isAdmin && userId !== req.session.user!.id) {
    return res.status(403).json({
      success: false,
      error: 'Kein Zugriff auf das Urlaubskonto anderer Nutzer',
    });
  }
  ...
```

---

### CR-06: Tests laufen ohne DB-Isolation gegen die Bestandsdatenbank und führen ungescopte DELETEs aus

**File:** `server/src/services/vacationEntitlementBooking.test.ts:175`, `:192`, `:197-198`,
`:216`, `:233-239`; `server/vitest.config.ts:1-24`
**Issue:**
`vitest.config.ts` definiert weder `setupFiles` noch `env` noch eine separate Datenbank.
`src/database/connection.ts:9` verwendet `databaseConfig.path`; im Testlauf (Vitest-Mode
`test` lädt `.env.development` nicht) fällt das auf `server/database/development.db` zurück —
**die geteilte Entwicklungsdatenbank mit 18 echten Nutzern** (verifiziert; die Datei wurde
zuletzt am 19.08. 23:01 durch einen Testlauf geschrieben).

Die Tests mutieren diese Datenbank global:

* `bulkInitializeVacationBalances(2033, adminId)` (`:175`, `:192`) legt für **alle 18 aktiven
  Nutzer** Konten an und bucht ins Journal.
* `performYearEndRollover(2032, adminId)` (`:216`) läuft zusätzlich über
  `bulkInitializeOvertimeBalancesForNewYear(2032)` durch **alle** Nutzer und schreibt einen
  Audit-Eintrag.
* Aufgeräumt wird mit ungescopten Massenlöschungen ohne `userId`-Filter:
  ```ts
  db.prepare('DELETE FROM vacation_transactions WHERE year = ?').run(BULK_YEAR);
  db.prepare('DELETE FROM vacation_balance WHERE year = ?').run(BULK_YEAR);
  db.prepare(`DELETE FROM overtime_balance WHERE month = ?`).run(`${NEW_YEAR}-01`);
  db.prepare(`DELETE FROM audit_log WHERE entity = 'year_end_rollover' AND entityId = ?`)...
  ```
  Träfe ein Jahr wider Erwarten doch echte Daten (oder wird der Testlauf abgebrochen, bevor
  `finally` läuft), sind fremde Zeilen gelöscht bzw. verwaiste Konten für alle Nutzer
  zurückgeblieben. Die Auswahl „exklusiver" Jahre ist eine Konvention, keine Absicherung.

Vitest führt Testdateien zudem standardmäßig parallel aus; alle drei neuen Testdateien
schreiben in dieselbe SQLite-Datei, und `bulkInitializeVacationBalances` iteriert über die
gerade von einer anderen Datei angelegten Testnutzer.

**Fix:**
```ts
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: { NODE_ENV: 'test', DATABASE_PATH: './database/test.db' },
    setupFiles: ['./src/test/setup.ts'], // legt test.db vor jedem Lauf frisch an
    fileParallelism: false,              // eine SQLite-Datei, keine Parallelität
    ...
  },
});
```
`src/test/setup.ts`: `test.db` in `beforeAll` löschen/neu erzeugen (Schema über
`initializeDatabase`), damit jeder Lauf reproduzierbar bei null startet. Danach dürfen die
`finally`-Blöcke der Tests entfallen.

---

### CR-07: `updateAbsenceRequest` rechnet Tage neu, prüft aber nichts nach — Anspruchsprüfung umgehbar

**File:** `server/src/services/absenceService.ts:676-701`
**Issue:**
Beim Ändern von `startDate`/`endDate` eines noch offenen Antrags wird `days` neu berechnet:

```ts
if (existing.type === 'vacation' || existing.type === 'overtime_comp') {
  days = countWorkingDaysForUser(startDate, endDate, workSchedule, weeklyHours, db);
}
```

`createAbsenceRequest` führt vor dem INSERT fünf Prüfungen durch (Eintrittsdatum `:434`,
Überschneidung `:487`, kollidierende Zeiterfassungen `:508`, Urlaubsanspruch `:536`,
Überstundenguthaben `:553`). `updateAbsenceRequest` führt **keine davon** aus.

Ein Mitarbeiter beantragt 1 Tag Urlaub (Anspruchsprüfung bestanden) und weitet ihn per
`PUT /api/absences/:id {"startDate":"2026-01-01","endDate":"2026-12-31"}` auf 250 Tage aus.
Die Genehmigung bucht `−250` ins Journal und `taken += 250`, ohne dass irgendwo geprüft wird,
ob der Anspruch reicht. `approveAbsenceRequest` hat für `type = 'vacation'` bewusst **keine**
Guthabenprüfung (nur `overtime_comp` wird bei `:772-809` geprüft). Ebenso lassen sich damit
Überschneidungen und Termine vor dem Eintrittsdatum erzeugen.

**Fix:**
```ts
// Nach der Neuberechnung von days, vor dem UPDATE:
if (data.startDate || data.endDate) {
  const start = data.startDate || existing.startDate;
  const end   = data.endDate   || existing.endDate;

  if (user && start < user.hireDate) {
    throw new Error(`Invalid: Abwesenheit vor Eintrittsdatum (${user.hireDate})`);
  }
  const overlap = checkOverlappingAbsence(existing.userId, start, end, id);
  if (overlap) throw new Error(`Überschneidung mit ${overlap.startDate} – ${overlap.endDate}`);

  const conflicts = checkTimeEntriesInPeriod(existing.userId, start, end);
  if (conflicts.hasEntries) {
    throw new Error('In diesem Zeitraum existieren bereits Zeiterfassungen');
  }
  if (existing.type === 'vacation') {
    const year = parseInt(start.substring(0, 4));
    if (!hasEnoughVacationDays(existing.userId, year, days)) {
      throw new Error('Insufficient vacation days remaining');
    }
  }
}
```
Ergänzend: `approveAbsenceRequest` sollte für `type === 'vacation'` dieselbe Guthabenprüfung
durchführen wie für `overtime_comp` — sonst bleibt die Genehmigung die einzige Buchung ohne
Deckungsprüfung.

## Warnings

### WR-01: `performYearEndRollover` dokumentiert eine Transaktion, die es nicht gibt

**File:** `server/src/services/yearEndRolloverService.ts:9`, `:42-43`, `:73-104`
**Issue:** Der Docstring behauptet „Transaction-safe (all-or-nothing)" und „CRITICAL: Uses
SQLite transactions! If ANY step fails, ALL changes are rolled back (data integrity!)". Im
Code existiert keine umschließende `db.transaction()`. Schlägt Schritt 2 (Überstunden) fehl,
bleiben sämtliche in Schritt 1 committeten Urlaubskonten **und deren Journalbuchungen**
bestehen; der Aufrufer erhält `success: false` und wird den Lauf wiederholen — beim zweiten
Lauf greift zwar `if (existing) continue`, aber der Zustand ist zwischenzeitlich
inkonsistent. Auch `bulkInitializeVacationBalances` selbst committet pro Nutzer einzeln
(`:688-736`); ein Fehler bei Nutzer 12 lässt Nutzer 1-11 committed zurück.
**Fix:** Entweder Schritt 1+2 in eine gemeinsame `db.transaction()` klammern (beide sind
synchron, das ist möglich) oder den Docstring korrigieren und die tatsächliche
Wiederaufsetz-Semantik beschreiben. Die Falschaussage ist gefährlicher als die fehlende
Transaktion, weil sie Prüfungen verhindert.

### WR-02: `skipCreationBooking` schützt nur den Neuanlage-Zweig — latente Doppelbuchung

**File:** `server/src/services/vacationBalanceService.ts:285-311` vs. `:312-332`, `:388-394`
**Issue:** `skipCreationBooking` unterdrückt ausschließlich den `if (!existingBalance)`-Zweig.
Trifft `initializeVacationAccountsForNewUser` auf ein bereits existierendes Konto, läuft
`upsertVacationBalance` in den `else`-Zweig und bucht eine **`correction`** — und
anschließend bucht `initializeVacationAccountsForNewUser` (`:407-416`) zusätzlich das
`entitlement`. Zwei Buchungen für einen Vorgang. Heute nicht erreichbar (POST /api/users
liefert stets eine frische ID), aber die Funktion ist exportiert und der Schutz trägt genau
den Namen, der die Doppelbuchung verhindern soll.
**Fix:** In `initializeVacationAccountsForNewUser` vorab prüfen und hart abbrechen:
```ts
if (getVacationBalance(userId, currentYear) || getVacationBalance(userId, nextYear)) {
  throw new Error(
    `Urlaubskonten für User ${userId} existieren bereits — Neuanlage würde doppelt buchen`
  );
}
```
Alternativ `skipCreationBooking` in `skipBooking` umbenennen und auch den Korrekturzweig
unterdrücken.

### WR-03: Widersprüchliche Übertragsregeln — Konten aus dem Jahreswechsel sind nicht mehr editierbar

**File:** `server/src/services/vacationBalanceService.ts:210-212`, `:474-501` vs. `:679-684`;
`server/src/services/absenceService.ts:1395-1398`
**Issue:** Drei Stellen implementieren drei verschiedene Übertragsregeln:
`bulkInitializeVacationBalances` überträgt **unbegrenzt** (`previousBalance.remaining`),
`absenceService.initializeVacationBalance` deckelt bei **5**, `upsertVacationBalance`/
`updateVacationBalance` lehnen alles über **10** ab. Folge: Legt der Jahreswechsel ein Konto
mit `carryover = 20` an (genau der von `vacationEntitlementBooking.test.ts:222` erwartete
Wert), scheitert jede spätere Admin-Bearbeitung über die Oberfläche mit „Carryover must be
between 0 and 10 days" — das Konto ist eingefroren, auch für Korrekturen.
**Fix:** Übertragsregel als eine Konstante/Funktion zentralisieren
(`MAX_CARRYOVER_DAYS` bzw. `calculateCarryover(prev)`) und in allen drei Pfaden verwenden;
die Obergrenze der Validierung an die tatsächliche Politik anpassen.

### WR-04: `NaN` passiert die Bereichsprüfungen

**File:** `server/src/services/vacationBalanceService.ts:206-212`, `:468-476`;
`server/src/routes/vacationBalance.ts:175-182`, `:224-230`
**Issue:** Die Route konvertiert ungeprüft (`Number(entitlement)`), der Service prüft mit
`data.entitlement < 0 || data.entitlement > 50` — beide Vergleiche sind für `NaN` falsch, die
Validierung greift also nicht. `POST /api/vacation-balances {"entitlement":"abc",...}`
gelangt bis zum INSERT. Der Schaden wird derzeit nur zufällig abgefangen (entweder durch
`NOT NULL` auf `entitlement` oder durch `Number.isFinite`-Prüfung in
`recordVacationTransaction`), und die Fehlermeldung ist für den Admin unbrauchbar.
Bei `carryover` fehlt die `NOT NULL`-Absicherung (`DEFAULT 0`, nullable) — dort wäre ein
`NULL` in der generierten Spalte `remaining` die Folge.
**Fix:**
```ts
for (const [name, value] of [['entitlement', data.entitlement], ['carryover', data.carryover]] as const) {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} muss eine gültige Zahl sein (erhalten: ${value})`);
  }
}
```
Analog in `updateVacationBalance` für alle drei optionalen Felder.

### WR-05: Jahresübergreifende Abwesenheiten werden vollständig ins Startjahr gebucht

**File:** `server/src/services/absenceService.ts:1218`, `:1270`, `:826`, `:993`, `:1107`
**Issue:** Überall wird das Jahr aus `parseInt(request.startDate.substring(0, 4))` abgeleitet.
Ein Urlaub vom 28.12.2026 bis 05.01.2027 belastet damit vollständig das Konto 2026 —
sowohl `taken` als auch die `vacation_taken`-Journalbuchung. Fachlich müssten die Tage auf
beide Jahre aufgeteilt werden. Solange `taken` maßgeblich war, fiel das nur im Saldo auf; mit
dem Journal ist es jetzt eine dauerhaft falsche Buchungszeile mit falschem `year`-Wert, auf
die Phase 7 aufsetzt.
**Fix:** Kurzfristig in `createAbsenceRequest` jahresübergreifende Urlaubsanträge ablehnen
(`if (startDate.slice(0,4) !== endDate.slice(0,4)) throw ...`), langfristig zwei Buchungen mit
den jeweils im Jahr liegenden Werktagen erzeugen.

### WR-06: Fehlgeschlagene Kontoanlage bei der Nutzeranlage wird verschluckt

**File:** `server/src/routes/users.ts:324-327`
**Issue:**
```ts
} catch (error) {
  console.error('⚠️ Failed to initialize vacation balances:', error);
  // Don't fail user creation if vacation balance initialization fails
}
```
Der Nutzer wird mit HTTP 201 als erfolgreich angelegt gemeldet, obwohl weder Urlaubskonto
noch Anspruchsbuchung existieren. Genau diese Klasse von stillem Zustand („Konto sagt X,
niemand weiß warum") ist der Anlass dieses Milestones. Auch der äußere `catch` (`:344-349`)
protokolliert überhaupt nichts und liefert nur „Failed to create user".
**Fix:** Fehler mit `logger.error` protokollieren **und** dem Aufrufer melden, z. B. über ein
`warnings`-Feld in der 201-Antwort, damit die Oberfläche den Admin auffordert, das Konto
manuell anzulegen. Der äußere `catch` braucht ein `logger.error({ err: error }, ...)`.

### WR-07: `console.log`/`console.error` in Produktionscode

**File:** `server/src/services/absenceService.ts:932-1087` (ca. 25 Aufrufe);
`server/src/routes/absences.ts:71`, `:171`; `server/src/routes/vacationBalance.ts:31`, `:54`,
`:117-127`, `:134`, `:189`, `:237`, `:268`, `:303`; `server/src/routes/users.ts:100`, `:107`,
`:137`, `:146`, `:160`, `:184`, `:325`
**Issue:** `.claude/CLAUDE.md` verbietet `console.log` in Produktionscode ausdrücklich
(„Debug console.logs entfernt" in der Pre-Commit-Checklist). `rejectAbsenceRequest` ist
praktisch ein Debug-Skript; `routes/vacationBalance.ts:117-127` protokolliert bei **jedem**
Saldo-Abruf die Typen der Rückgabewerte. Diese Ausgaben umgehen Pino komplett (keine Level,
keine Redaction, keine strukturierte Suche).
**Fix:** Alle `console.*` durch `logger.debug`/`logger.error` ersetzen und die reinen
Typ-Debug-Blöcke (`vacationBalance.ts:116-127`) ersatzlos entfernen.

### WR-08: Vollständiger Request-Body und Session-Nutzer werden auf `info` protokolliert

**File:** `server/src/routes/absences.ts:248-256`, `:274-280`, `:356`;
`server/src/services/absenceService.ts:406`, `:582`, `:650`
**Issue:** `logger.info({ body: req.body, sessionUser: {...} })` schreibt personenbezogene
Daten (Nutzername, Rolle, Abwesenheitsgrund im Klartext) bei jedem Antrag ins Log;
`absenceService.ts:582` protokolliert zusätzlich SQL-Statement **und** gebundene Parameter.
Bei einer DSGVO-relevanten Anwendung (das Projekt implementiert Art.-15-Export) sind
Abwesenheitsgründe — potenziell Gesundheitsdaten bei Krankmeldungen — besonders schützenswert.
**Fix:** Auf `logger.debug` herabstufen und auf nicht-sensible Felder reduzieren:
```ts
logger.debug({ userId, type: data.type, startDate: data.startDate, endDate: data.endDate },
  'Absence request received');
```
`reason`/`adminNote` nie loggen. Pino-`redact` für `req.body.reason` konfigurieren.

### WR-09: `as any` und ungeprüfter Nullzugriff in `approveAbsenceRequest`

**File:** `server/src/services/absenceService.ts:783`, `:861-867`
**Issue:** `const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.userId) as any;`
verstößt gegen die Strict-Mode-Regel aus `.claude/CLAUDE.md` („NIEMALS `any`"). An `:861`
fehlt zudem die Null-Prüfung, die an `:784-786` noch vorhanden ist — `user.workSchedule` bei
`:865` dereferenziert potenziell `undefined` und lässt die Genehmigung mitten im Vorgang mit
einem TypeError abbrechen (nach bereits committeter Buchung).
**Fix:**
```ts
const user = getUserById(request.userId);
if (!user) throw new Error('User not found');
```
`getUserById` ist bereits importiert (`:6`) und liefert einen typisierten Wert.

### WR-10: `account?.maxMinusHours || -20` verwirft den Wert 0

**File:** `server/src/services/absenceService.ts:799`, `:806`
**Issue:** Ist für einen Mitarbeiter bewusst `maxMinusHours = 0` hinterlegt („kein
Minusstunden-Rahmen"), liefert `0 || -20` den Wert `-20` — der Mitarbeiter darf 20
Minusstunden aufbauen. Es ist derselbe Fehlertyp, den `routes/users.ts:308-317` für
`vacationDaysPerYear` als Ursache eines Produktionsvorfalls dokumentiert.
**Fix:** `account?.maxMinusHours ?? -20` (an beiden Stellen). Die Konstante `-20` gehört
zusätzlich in eine benannte Konstante `DEFAULT_MAX_MINUS_HOURS`.

### WR-11: `updateAbsenceRequest` erzeugt bei leerem Body fehlerhaftes SQL

**File:** `server/src/services/absenceService.ts:704-740`
**Issue:** Bleiben alle Felder `undefined` und ändert sich `days` nicht, ist `fields` leer:
```sql
UPDATE absence_requests SET  WHERE id = ?
```
`validateAbsenceUpdate` lässt einen leeren Body passieren (alle Prüfungen sind
`!== undefined`-gated). Ergebnis: `SqliteError` → HTTP 500 statt einer verständlichen 400.
**Fix:**
```ts
if (fields.length === 0) {
  return existing; // nichts zu ändern
}
```

### WR-12: Ungeschütztes `JSON.parse` im Rollover-Verlauf

**File:** `server/src/services/yearEndRolloverService.ts:276`
**Issue:** `JSON.parse(entry.changes || '{}')` — eine einzige beschädigte oder nicht als JSON
gespeicherte `audit_log.changes`-Zeile lässt den gesamten Endpunkt mit 500 fehlschlagen; der
komplette Verlauf ist dann unerreichbar.
**Fix:**
```ts
let metadata: Record<string, unknown> = {};
try {
  metadata = JSON.parse(entry.changes || '{}');
} catch {
  logger.warn({ year: entry.year }, 'Audit-Eintrag enthält kein gültiges JSON');
}
```

### WR-13: `previewYearEndRollover` verarbeitet fehlendes `hireDate` weiter

**File:** `server/src/services/yearEndRolloverService.ts:210-217`
**Issue:** Nach `if (!user.hireDate) warnings.push('Missing hire date')` folgt ohne `return`
oder `else` die Zeile `const hireYear = new Date(user.hireDate).getFullYear();`. Bei `null`
ergibt das 1970, bei `undefined` `NaN` — die Vorschau zeigt dem Admin eine erfundene bzw.
fehlende Warnung an, obwohl das der einzige Zweck der Funktion ist.
**Fix:** Den Hire-Date-Block in `else` setzen bzw. `if (user.hireDate) { const hireYear = ... }`.

### WR-14: `calculateProRataVacationDays` mischt UTC- und lokale Zeit und ignoriert Schaltjahre

**File:** `server/src/services/vacationBalanceService.ts:50`, `:64-77`
**Issue:** `new Date(hireDate)` parst `'YYYY-MM-DD'` als **UTC**-Mitternacht,
`new Date(year, 11, 31, 23, 59, 59)` erzeugt eine **lokale** Zeit. Die Differenz wird
anschließend mit `Math.ceil(...) + 1` auf Tage gerundet — die Zeitzonenverschiebung kann das
Ergebnis um einen Tag kippen. `const daysInYear = 365` ignoriert Schaltjahre, sodass ein am
01.01. eines Schaltjahres eingetretener Mitarbeiter rechnerisch mehr als den vollen Anspruch
erhält (durch `Math.round(x*2)/2` meist, aber nicht garantiert, wieder eingefangen).
`.claude/CLAUDE.md` verlangt für Datumsarithmetik durchgängig die Helfer aus `utils/timezone`
— die Datei importiert `parseDate` bereits (`:3`) und verwendet es nur zum Formatieren.
**Fix:**
```ts
const hire = parseDate(hireDate);
const endOfYear = new Date(year, 11, 31);
const daysInYear = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
const daysRemaining = Math.max(0, differenceInCalendarDays(endOfYear, hire) + 1); // date-fns
```
Gleiches gilt für `new Date(hireDate).getFullYear()` in `:382` und `:702`.

### WR-15: Team-Kalender wird still auf 100 Einträge pro Jahr gekappt

**File:** `server/src/routes/absences.ts:47-61` i.V.m. `server/src/services/absenceService.ts:285`
**Issue:** Die Route dokumentiert „No pagination - returns all approved absences" und übergibt
`limit: 1000`. `getAbsenceRequestsPaginated` kappt jedoch: `Math.min(options.limit || 30, 100)`.
Ab der 101. genehmigten Abwesenheit eines Jahres fehlen Einträge im Team-Kalender — ohne
Fehlermeldung und ohne Hinweis in der Antwort (`pagination` wird von dieser Route gar nicht
zurückgegeben). Bei 18 Mitarbeitern ist diese Schwelle im Regelbetrieb erreichbar.
**Fix:** Eine dedizierte, ungepaginierte Abfragefunktion verwenden oder in einer Schleife
über `hasMore` paginieren. *(Vorbestehend, außerhalb des Phasen-Diffs — betrifft aber die
Datenrichtigkeit derselben Tabelle.)*

### WR-16: Offene Anträge gehen nicht in die Anspruchsprüfung ein

**File:** `server/src/services/absenceService.ts:190-217`, `:1455-1479`
**Issue:** `incrementVacationPending`/`decrementVacationPending` sind dokumentierte No-ops;
`hasEnoughVacationDays` vergleicht ausschließlich gegen `balance.remaining`, das nur
genehmigte Tage kennt. Ein Mitarbeiter mit 30 Tagen kann damit 5 × 30 Tage beantragen — jeder
einzelne Antrag besteht die Prüfung. Genehmigt der Admin mehrere, entsteht ein negativer
Saldo und eine entsprechende Kette negativer Journalbuchungen ohne Deckung.
**Fix:** In `hasEnoughVacationDays` die offenen Tage abziehen:
```sql
SELECT COALESCE(SUM(days), 0) AS pending FROM absence_requests
WHERE userId = ? AND type = 'vacation' AND status = 'pending'
  AND strftime('%Y', startDate) = ?
```
`return balance.remaining - pending >= requestedDays;`

### WR-17: Tote No-op-Funktionen mit irreführenden Aufrufstellen

**File:** `server/src/services/absenceService.ts:1444-1479`; Aufrufe `:605`, `:827`, `:994`, `:1108`
**Issue:** Beide Funktionen tun nachweislich nichts, werden aber an vier Stellen aufgerufen —
darunter **innerhalb** der neuen Buchungstransaktionen (`:827` in `applyApproval`, `:994` in
`applyRejection`). Das erzeugt beim Lesen den Eindruck, dort werde ein Zähler geführt, und
verdeckt WR-16. Kommentare wie „Decrement pending balance for vacation requests (before
updating taken)" beschreiben Verhalten, das es nicht gibt.
**Fix:** Beide Funktionen und alle vier Aufrufe entfernen; die Fachentscheidung („offene
Anträge werden nicht in `vacation_balance` geführt") gehört als Kommentar an
`hasEnoughVacationDays`, wo sie relevant ist.

### WR-18: Doppelte, divergierende Implementierungen von `getVacationBalance`/`initializeVacationBalance`

**File:** `server/src/services/absenceService.ts:1360-1374`, `:1379-1423` vs.
`server/src/services/vacationBalanceService.ts:174-188`, `:194-343`
**Issue:** Zwei Services führen zwei identisch benannte, aber unterschiedlich implementierte
Funktionen auf derselben Tabelle. `absenceService` bucht nicht ins Journal (CR-02), deckelt
den Übertrag bei 5 und prüft keine Bereichsgrenzen; `vacationBalanceService` bucht, validiert
und läuft in einer Transaktion. Welche Regeln für ein Konto gelten, hängt davon ab, welcher
Pfad es zuerst angelegt hat. Verstößt gegen „Business Logic in mehreren Services → Extract to
shared service" aus `.claude/CLAUDE.md`.
**Fix:** `vacationBalanceService` als einzige Quelle etablieren; `absenceService` importiert
von dort (siehe Fix zu CR-02) und exportiert die Namen allenfalls als Re-Export für
bestehende Importeure.

### WR-19: Regressionstests hängen an Kalenderdaten, Feiertagstabelle und festen Nutzernamen

**File:** `server/src/services/absenceVacationBooking.test.ts:32`, `:36-45`, `:65-81`, `:179-193`
**Issue:** Drei voneinander unabhängige Fragilitäten:
1. Feste Nutzernamen (`testuser_absence_booking`). Bricht ein Lauf vor `afterEach` ab,
   scheitern alle Folgeläufe am `UNIQUE`-Constraint auf `username`.
2. `expect(request.days).toBe(2)` hängt vom Inhalt der `holidays`-Tabelle der geteilten
   Datenbank ab. Wird für 02./03.03.2026 ein Feiertag eingetragen, schlägt der Test aus einem
   Grund fehl, der nichts mit Buchungen zu tun hat.
3. Fest verdrahtetes `YEAR = 2026` in Kombination mit `getOvertimeBalance`, das nach
   `month <= strftime('%Y-%m','now')` filtert (Test 7b) — zeitabhängiges Verhalten.
**Fix:** Nutzernamen mit `Date.now()`/Zähler eindeutig machen (wie in den beiden anderen neuen
Testdateien bereits geschehen), benötigte Feiertagszeilen im Test explizit anlegen bzw. für
den Testzeitraum löschen, und `YEAR` aus einer isolierten Test-DB (CR-06) statt aus dem
Kalender ableiten.

### WR-20: Irreführende Kommentare zur Herkunft des Überstundensaldos

**File:** `server/src/services/absenceService.ts:552-554`, `:1481-1483`;
`server/src/services/overtimeTransactionService.ts:406-419`
**Issue:** `absenceService` kommentiert `getOvertimeBalance` als „PROFESSIONAL: Use
transaction-based balance" und begründet die Entfernung der alten Funktion mit „All
validation now uses the NEW transaction-based system for consistency". Tatsächlich summiert
`getOvertimeBalance` über die **Monatsaggregate** `overtime_balance`
(„FIXED: Sum overtime from overtime_balance (NOT transactions!)"). Wer die Validierung
prüft, sucht an der falschen Tabelle — im Zusammenspiel mit dem in `.claude/CLAUDE.md`
beschriebenen „Dual Calculation System" ist das eine echte Fehlerquelle bei der Diagnose.
**Fix:** Die drei Kommentare an die Implementierung anpassen (`overtime_balance` als Quelle
benennen) oder die Implementierung auf `overtime_transactions` umstellen — aber nicht beides
widersprüchlich stehen lassen.

---

_Reviewed: 2026-08-19T22:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
