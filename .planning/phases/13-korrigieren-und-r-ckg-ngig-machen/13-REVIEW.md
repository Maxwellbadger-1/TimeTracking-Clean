---
phase: 13-korrigieren-und-r-ckg-ngig-machen
reviewed: 2026-08-22T21:19:13Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - desktop/src/api/client.ts
  - desktop/src/components/ui/ConfirmDialog.tsx
  - desktop/src/components/ui/confirmDialogProps.check.ts
  - desktop/src/components/ui/useModalLayer.ts
  - desktop/src/components/users/EditUserModal.tsx
  - desktop/src/components/worktime/overtimeTransactionFormat.check.ts
  - desktop/src/components/worktime/overtimeTransactionFormat.ts
  - desktop/src/components/worktime/OvertimeTransactions.tsx
  - desktop/src/components/worktime/workTimePeriodActions.tsx
  - desktop/src/components/worktime/workTimePeriodDeleteRules.check.ts
  - desktop/src/components/worktime/workTimePeriodDeleteRules.ts
  - desktop/src/components/worktime/WorkTimePeriodEditModal.tsx
  - desktop/src/components/worktime/workTimePeriodEditRules.check.ts
  - desktop/src/components/worktime/workTimePeriodEditRules.ts
  - desktop/src/components/worktime/WorkTimePeriodList.tsx
  - desktop/src/hooks/useWorkTimeAccounts.ts
  - desktop/src/hooks/useWorkTimeChange.ts
  - desktop/src/types/index.ts
  - desktop/src/utils/timeUtils.periods.test.ts
  - desktop/tsconfig.json
  - server/src/database/migrations/013_soft_delete_user_work_periods.test.ts
  - server/src/database/migrations/013_soft_delete_user_work_periods.ts
  - server/src/database/migrations/014_add_reversal_of_to_overtime_transactions.test.ts
  - server/src/database/migrations/014_add_reversal_of_to_overtime_transactions.ts
  - server/src/database/schema.ts
  - server/src/database/schemaMigrationParity.test.ts
  - server/src/routes/workPeriods.authorization.test.ts
  - server/src/routes/workPeriods.ts
  - server/src/scripts/applyMigrationsToCopy.ts
  - server/src/scripts/snapshotBalances.ts
  - server/src/scripts/verifyDesktopEffectiveness.ts
  - server/src/services/overtimeLiveCalculationService.test.ts
  - server/src/services/overtimeLiveCalculationService.ts
  - server/src/services/overtimeTransactionManager.ts
  - server/src/services/workPeriodChangeService.test.ts
  - server/src/services/workPeriodChangeService.ts
  - server/src/services/workPeriodCorrectionService.test.ts
  - server/src/services/workPeriodCorrectionService.ts
  - server/src/services/workPeriodDeletionService.test.ts
  - server/src/services/workPeriodDeletionService.ts
  - server/src/services/workPeriodService.test.ts
  - server/src/services/workPeriodService.ts
  - server/src/services/workTimeChangeToken.test.ts
  - server/src/services/workTimeChangeToken.ts
  - server/src/test-support/workPeriodFixtures.ts
  - server/src/types/index.ts
findings:
  critical: 2
  warning: 13
  info: 4
  total: 19
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-08-22T21:19:13Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

Reviewed the Phase-13 surface end to end: migrations 013/014 plus their `schema.ts` parity, the
three write services (`workPeriodChangeService`, `workPeriodCorrectionService`,
`workPeriodDeletionService`), the six HTTP endpoints and their token/rate-limit/role wiring, the
journal read path (`overtimeLiveCalculationService`), and the desktop dialogs, hooks and pure
rule modules.

The things the phase set out to protect are, in the main, actually protected:

- **No double counting.** `model_change` rows (originals *and* the new `reversalOf`
  counter-bookings) are excluded from every balance path I could find:
  `overtimeTransactionService.getOvertimeBalance()` reads the `overtime_balance` aggregate,
  `getOvertimeBalanceAtDate()` / `getOvertimeStatistics()` / the 12-month history query all carry
  `EXCLUDE_JOURNAL_ONLY_TYPES`, `getBalanceBeforeDate()` and
  `overtimeTransactionRebuildService.getPreviousMonthBalance()` carry `type <> 'model_change'`,
  and the live statement pushes `hours: 0` + `documentedDelta` for both sides of the pair. No
  path sums `documentedDelta`.
- **Transaction bracketing.** Correction and deletion each run inside one `db.transaction()`;
  `withSuspendedChainGuard()` restores the guard in a `finally`, and `checkPeriodChain()` runs
  inside the same bracket in both services.
- **Authorization.** All six routes carry `requireAuth` + `requireAdmin`; `periodId` comes from
  the path, never the body; the three token flavours are mutually non-redeemable by construction
  (`'correct'`/`'delete'` purpose field in the canonical string).
- **Soft-delete read paths.** Every read of `user_work_periods` in service code goes through
  `getWorkPeriods`/`getCurrentWorkPeriod`/`getWorkPeriodById`, all of which filter
  `deletedAt IS NULL`.

Two defects are nevertheless blocking. One is a deterministic dead end: a period that carries two
mutually-negating `model_change` rows can never be deleted, and re-applying a previously reverted
correction fails with a 500 — both caused by `createTransaction()`'s duplicate heuristic, which
cannot tell a reversal from an unrelated booking of the opposite sign. The other is an audit
promise the server does not keep: when `balanceDelta === 0` the correction writes no journal row
at all, while the confirmation dialog literally tells the admin "Korrektur und Begründung bleiben
im Kontoauszug dauerhaft sichtbar".

Beyond those, the biggest quality problem is that the phase's stated verification mechanism — the
four `*.check.ts` scripts — is wired to nothing: `desktop/tsconfig.json` excludes `src/**/*.check.ts`
from the program, and no npm script executes them. `confirmDialogProps.check.ts` states in its own
comment that its central assertion "traegt AUSSCHLIESSLICH `tsc --noEmit`" — the very check that
was excluded.

## Critical Issues

### CR-01: Korrektur mit `balanceDelta === 0` schreibt keine Journalzeile — der Bestätigungsdialog verspricht das Gegenteil

**File:** `server/src/services/workPeriodCorrectionService.ts:409` (Bedingung),
`desktop/src/components/worktime/WorkTimePeriodEditModal.tsx:463-464, 807`

**Issue:**
`correctWorkPeriod()` legt die `model_change`-Zeile nur an, wenn `balanceDelta !== 0`:

```ts
// workPeriodCorrectionService.ts:408-409
let transactionId: number | null = null;
if (!options.dryRun && balanceDelta !== 0) {
```

Die Oberfläche sagt dem Admin in genau diesem Fall das Gegenteil zu. `buildConfirmMessage()`
liefert für `balanceDelta === 0` (Zeile 463-464):

> „… Der Überstundensaldo bleibt dabei unverändert. **Die Korrektur wird trotzdem als eigener
> Eintrag festgehalten.**"

und der `details`-Text derselben `ConfirmDialog` (Zeile 807) lautet unbedingt:

> „Korrektur und Begründung bleiben **im Kontoauszug dauerhaft sichtbar**."

Beides ist falsch, sobald `balanceDelta` 0 ist. Es entsteht dann:
- keine Zeile in `overtime_transactions` → nichts im Kontoauszug
  (`overtimeLiveCalculationService.ts:527` liest ausschließlich `type = 'model_change'`),
- kein Eintrag in `user_work_periods.note` — `correctWorkPeriod()` ruft `updateWorkPeriodValues()`
  und `setWorkPeriodValidFrom()`, die `note` nicht anfassen (`workPeriodService.ts:389-449`),
- die Pflichtbegründung existiert danach ausschließlich in `audit_log.changes`
  (`workPeriodCorrectionService.ts:450-478`), das keine Oberfläche im Projekt darstellt.

Der Fall ist nicht exotisch: jede Verschiebung von `validFrom` über Tage ohne Sollstunden
(Wochenende, Feiertag, Urlaub mit Gutschrift), jede Korrektur des Tagesplans mit gleicher
Wochensumme und jede Korrektur einer reinen Zukunftsperiode liefert `balanceDelta === 0`. Für
eine Personalverwaltung ist eine rückwirkende Stammdatenänderung ohne jede sichtbare Spur genau
der Zustand, den REQ-30/D7 verhindern sollen.

**Fix:** Entweder die Journalzeile unbedingt schreiben (mit `hours: 0` — sie ist ohnehin
rechenneutral, die Anzeige zeigt `documentedDelta`), oder die Zusage der Oberfläche zurücknehmen.
Die erste Variante hält den Vertrag:

```ts
// workPeriodCorrectionService.ts — Schritt 11
if (!options.dryRun) {
  // Auch bei balanceDelta === 0: die Korrektur ist ein dokumentationspflichtiger Vorgang.
  // hours bleibt rechenneutral (model_change fliegt aus jedem Summenpfad, CR-01 Phase 12).
  const journalBalance = getJournalBalanceBeforeDate(period.userId, input.validFrom);
  transactionId = createTransaction({ /* … */ hours: balanceDelta, /* … */ });
  if (transactionId === null) { /* … bestehende Duplikatbehandlung … */ }
}
```

Wird stattdessen die Oberfläche geändert, müssen **beide** Textstellen fallen
(`WorkTimePeriodEditModal.tsx:464` und `:807`) und der Dialog muss stattdessen sagen, dass die
Begründung nur im internen Prüfprotokoll landet.

---

### CR-02: `createTransaction()`-Duplikaterkennung macht das Stornieren dauerhaft unmöglich und lässt eine wiederholte Korrektur mit 500 scheitern

**File:** `server/src/services/overtimeTransactionManager.ts:78-97`,
`server/src/services/workPeriodDeletionService.ts:320-343`,
`server/src/services/workPeriodCorrectionService.ts:423-444`

**Issue:**
Die Duplikatprüfung vergleicht `userId`, `date`, `type`, `ABS(hours - ?) < 0.01`, `referenceType`
und `referenceId` — bewusst **ohne** `reversalOf` (Kommentar Zeile 72-77). Die Begründung dort
("Eine Gegenbuchung unterscheidet sich von ihrem Original bereits im Vorzeichen von `hours`")
übersieht, dass zu einer Periode mehrere Originalzeilen mit demselben `date` und derselben
`referenceId` gehören können — genau das sagt DD-15 im Kopf von `workPeriodDeletionService.ts`
selbst zu ("Es können mehrere sein").

Deterministische Abfolge, alle Werte aus dem Code nachvollzogen:

1. Stundenwechsel ab `2026-03-01`, 40 → 32 h. `applyWorkTimeChange()` schreibt Zeile **A**:
   `date = '2026-03-01'`, `type = 'model_change'`, `hours = d`, `referenceType = 'work_period'`,
   `referenceId = newPeriod.id` (`workPeriodChangeService.ts:541-551`).
2. Der Admin korrigiert dieselbe Periode zurück auf 40 h, **ohne** `validFrom` zu verschieben.
   `correctWorkPeriod()` rechnet über denselben Bereich (`rangeStart = period.validFrom`,
   `rangeEnd = heute`) und schreibt Zeile **B** mit `date = '2026-03-01'`, `referenceId =
   period.id` und `hours = -d` (`workPeriodCorrectionService.ts:423-434`). Kein Duplikat, weil
   `+d ≠ -d`. Der Vorgang gelingt.
3. **Jetzt lässt sich die Periode nie wieder löschen.** `deleteWorkPeriod()` erhebt A und B
   (beide `reversalOf IS NULL`, beide ohne Gegenbuchung, Zeile 234-247) und ruft für A
   `createTransaction({ date: A.date, hours: -A.hours, referenceId: period.id, … })`. Die
   Duplikatabfrage findet **B** (gleiche userId, gleiches Datum, gleicher Typ, `ABS(-d - (-d)) = 0`,
   gleiche Referenz) → `null` → Zeile 337-343 wirft einen nackten `Error` → die gesamte
   Transaktionsklammer rollt zurück → die Route antwortet mit **500 „Failed to delete work
   period"**. Bei jedem Versuch, dauerhaft.
4. Ebenso deterministisch: korrigiert der Admin nach Schritt 2 erneut auf 32 h, ist
   `balanceDelta` wieder `d`, die neue Zeile kollidiert mit **A**, `createTransaction()` liefert
   `null`, `workPeriodCorrectionService.ts:438-444` wirft — **500**, obwohl die Vorschau eben noch
   erfolgreich war.

Die Auswirkung ist ein funktionaler Sackgassenzustand ohne jede verständliche Meldung: der
Kontoauszug zeigt zwei Buchungen, die Vorschau rechnet sauber, das Speichern/Löschen scheitert mit
einem generischen Serverfehler. `logger.debug` im Manager (in Produktion regelmäßig abgeschaltet)
ist die einzige Spur des wahren Grundes.

**Fix:** Die Duplikaterkennung muss `reversalOf` einbeziehen — eine Gegenbuchung ist per
Definition nie ein Duplikat einer Originalzeile, und zwei Originalzeilen mit demselben
Vorzeichenbetrag sind nur dann Duplikate, wenn auch `reversalOf` gleich ist:

```sql
-- overtimeTransactionManager.ts, Duplikatprüfung
SELECT id FROM overtime_transactions
WHERE userId = ?
  AND date = ?
  AND type = ?
  AND ABS(hours - ?) < 0.01
  AND COALESCE(referenceType, '') = COALESCE(?, '')
  AND COALESCE(referenceId, -1) = COALESCE(?, -1)
  AND COALESCE(reversalOf, -1) = COALESCE(?, -1)   -- NEU
```

mit `reversalOf ?? -1` als zusätzlichem Parameter. Damit kollidiert Schritt 3 nicht mehr (A/B
tragen `reversalOf IS NULL`, die Gegenbuchung trägt `reversalOf = A.id`).

Für Schritt 4 (zwei Originalzeilen gleichen Betrags am selben Tag an derselben Periode) reicht das
nicht — dort muss die Korrektur die Zeile bewusst als neue Buchung anlegen dürfen. Empfehlung:
`createTransaction()` um ein ausdrückliches `allowDuplicate: true` erweitern, das die
Korrektur-/Storno-Pfade setzen (sie prüfen ihre Eindeutigkeit bereits selbst: `isNoOp`-Riegel bzw.
`NOT EXISTS (… r.reversalOf = ot.id)`), oder die Journalzeile zusätzlich über eine monoton
steigende Kennung (z. B. `createdAt`) unterscheidbar machen. In jedem Fall darf der Nutzer keinen
nackten 500 sehen: die beiden `throw new Error(...)` in
`workPeriodDeletionService.ts:338` und `workPeriodCorrectionService.ts:439` sollten
`WorkPeriodDeletionValidationError`/`WorkPeriodCorrectionValidationError` mit einer
verständlichen Meldung werfen, damit die Route 400 statt 500 liefert.

## Warnings

### WR-01: `deleteDetailReversal()` behauptet eine Buchung, die es nicht gibt, und meldet „± 0:00h", wenn sich Buchungen aufheben

**File:** `desktop/src/components/worktime/workTimePeriodDeleteRules.ts:209-216`

**Issue:** Die Funktion hat keinen Zweig für `reversedTransactions.length === 0`. Bei einer
Periode ohne jede `model_change`-Buchung (Regelfall: Stichtag in der Zukunft, oder
`balanceDelta === 0` beim Anlegen — siehe CR-01) fällt sie in den Einzahl-Zweig und die
Löschbestätigung sagt:

> „Die zugehörige Buchung über ± 0:00h wird nicht entfernt. Sie wird durch eine Gegenbuchung
> ausgeglichen. Beide Zeilen bleiben im Kontoauszug sichtbar."

Es gibt keine Buchung, keine Gegenbuchung wird angelegt (`workPeriodDeletionService.ts:312-347`
iteriert über eine leere Liste), und keine zwei Zeilen bleiben sichtbar.

Zweiter Fall: bei zwei Buchungen `+5` und `-5` liefert `reduce` die Summe `0`, der Satz lautet
„Die zugehörigen Buchungen über ± 0:00h werden nicht entfernt" — eine Summenangabe über
Journalzeilen, die nebeneinander im selben Panel neben dem echten `balanceDelta` aus Punkt 3
steht und dadurch als Saldoaussage missverstanden wird.

**Fix:**

```ts
export function deleteDetailReversal(args: DeleteDetailReversalArgs): string {
  if (args.reversedTransactions.length === 0) {
    return 'Zu dieser Periode gibt es keine Buchung im Kontoauszug — es wird nichts storniert.';
  }
  if (args.reversedTransactions.length > 1) {
    // Mehrzahl: Einzelbeträge statt einer Summe, damit sich +5/-5 nicht zu "± 0:00h" verdichten.
    const amounts = args.reversedTransactions.map((t) => formatSignedHours(t.hours)).join(', ');
    return `Die zugehörigen Buchungen (${amounts}) werden nicht entfernt. …`;
  }
  return `Die zugehörige Buchung über ${formatSignedHours(args.reversedTransactions[0].hours)} …`;
}
```

---

### WR-02: Der Löschdialog behandelt `PREVIEW_STALE` nicht — der interne Fehlercode landet im Text für den Anwender

**File:** `desktop/src/components/users/EditUserModal.tsx:291-302`

**Issue:** Das Lösch-Token ist 15 Minuten gültig (`workTimeChangeToken.ts:84`). Die Vorschau wird
genau einmal beim Öffnen des Dialogs geholt (`openDeletion()`, Zeile 245-252) und danach nie
erneuert. Bleibt der Dialog länger offen — der Dialog verlangt zusätzlich eine Begründung mit
mindestens 10 Zeichen, der Anwender tippt also darin —, antwortet `DELETE /api/work-periods/:id`
mit 409 und `'PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell.'`
(`workPeriods.ts:661-665`). `handleConfirmDeletion()` kennt nur `Forbidden` und die
Erst-Perioden-Meldung und fällt sonst in den Sammelzweig:

```ts
setDeletionError(
  `Die Periode wurde nicht gelöscht. Es wurde nichts verändert — weder die Periode noch der Kontoauszug. ${message}`
);
```

Der Anwender liest also „… ${message}" = „… PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell."
Genau das hat `api/client.ts:139-149` (WR-10 aus Phase 12) ausdrücklich abstellen wollen — der
globale Toast wurde für `/work-periods*` unterdrückt, weil „ein interner Code in der Oberfläche
einer Personalverwaltung in keinem Textbuch steht". `WorkTimePeriodEditModal.tsx:417-431` macht es
für die Korrektur richtig (eigener Zweig plus automatische Neuberechnung); der Löschpfad hat diese
Behandlung nicht bekommen.

**Fix:** Denselben Zweig wie im Korrektur-Dialog ergänzen:

```ts
} else if (message.startsWith('PREVIEW_STALE')) {
  setDeletionError('Die Auswirkung ist nicht mehr aktuell. Sie wurde neu berechnet — bitte prüfen und erneut bestätigen.');
  setDeletionPreview(null);
  runDeletionPreview(deletionPeriod.id);
} else {
```

---

### WR-03: Ungeprüfte Non-Null-Casts auf die Vorperiode in beiden neuen Services

**File:** `server/src/services/workPeriodDeletionService.ts:198`,
`server/src/services/workPeriodCorrectionService.ts:334`

**Issue:**

```ts
// workPeriodDeletionService.ts:194-198
const previous = periodIndex > 0 ? periodsWithFlags[periodIndex - 1] : null;
validateDeletionInput(input, isFirst, options.dryRun);
const previousPeriod = previous as NonNullable<typeof previous>;
```

```ts
// workPeriodCorrectionService.ts:334
const previousBeforeShift = previous as UserWorkPeriod;
```

Beide Casts stützen sich auf eine Invariante, die aus `periodIndex === 0 ⇒ isFirst ⇒ wirft`
folgt. `findIndex` liefert aber auch `-1`, und `-1` ergibt `isFirst === false` **und**
`previous === null`. Der Cast unterdrückt dann still den Nullwert, und die nächste Zeile
dereferenziert ihn (`extendWorkPeriodTo(previousPeriod.id, …)` bzw.
`previousBeforeShift.validFrom`) → `TypeError`, Route antwortet 500. Heute ist der Fall nicht
erreichbar, weil `getWorkPeriodById()` und `getWorkPeriodsWithFlags()` denselben
`deletedAt IS NULL`-Filter tragen — das ist eine Kopplung zwischen zwei Funktionen, die der Cast
unsichtbar macht. `.claude/CLAUDE.md` verlangt ausdrücklich „Null Type Guards verwenden".

**Fix:**

```ts
if (previous === null) {
  throw new WorkPeriodDeletionValidationError(
    `Periode ${period.id}: keine Vorperiode in der Kette gefunden (periodIndex ${periodIndex}).`
  );
}
const previousPeriod = previous; // ab hier vom Compiler verengt, kein Cast
```

---

### WR-04: Die vier `*.check.ts`-Prüfskripte laufen nirgends und werden nicht typgeprüft

**File:** `desktop/tsconfig.json:26`, `desktop/package.json:6-21`,
`desktop/src/components/ui/confirmDialogProps.check.ts:29-33`

**Issue:** `desktop/tsconfig.json` enthält in `exclude`:

```json
"exclude": ["node_modules", "../node_modules", "../server", "src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.check.ts", …]
```

Keine der vier neuen Prüfdateien (`confirmDialogProps.check.ts`,
`overtimeTransactionFormat.check.ts`, `workTimePeriodDeleteRules.check.ts`,
`workTimePeriodEditRules.check.ts`) wird von einer eingeschlossenen Datei importiert — sie sind
damit nicht Teil des `tsc`-Programms und werden von `npx tsc --noEmit` (dem in `.claude/CLAUDE.md`
verankerten Pflicht-Gate) nicht angefasst. In `desktop/package.json` gibt es außerdem kein Skript,
das sie ausführt; die Dateien nennen die Ausführung nur im Kopfkommentar
(`npx tsx src/components/...`).

Besonders deutlich in `confirmDialogProps.check.ts:29-33`: Der erste Testfall ist ein reiner
Compiler-Beweis und die Datei sagt selbst, die Zusicherung „traegt AUSSCHLIESSLICH `tsc --noEmit`".
Diese Zusicherung existiert faktisch nicht. Damit hat die Phase ihre eigene
Verifikationsmechanik dokumentiert, aber nicht verdrahtet — jede spätere Regression in
`workTimePeriodEditRules.ts`/`workTimePeriodDeleteRules.ts`/`overtimeTransactionFormat.ts` bleibt
unbemerkt.

**Fix:** Ein Skript ergänzen und in die Pre-Commit-Checkliste aufnehmen; die Ausnahme aus
`tsconfig.json` streichen (oder eine eigene `tsconfig.check.json` mit `include: ["src/**/*.check.ts"]`
anlegen, falls die Node-Typen im Haupt-Programm stören):

```json
"scripts": {
  "check:rules": "tsx src/components/ui/confirmDialogProps.check.ts && tsx src/components/worktime/overtimeTransactionFormat.check.ts && tsx src/components/worktime/workTimePeriodEditRules.check.ts && tsx src/components/worktime/workTimePeriodDeleteRules.check.ts"
}
```

---

### WR-05: `WorkTimePeriod.isFirst`/`isCurrent` sind Pflichtfelder, die der Server in zwei Antworten nicht liefert

**File:** `desktop/src/types/index.ts:160-164, 303`, `server/src/types/index.ts:385, 474`

**Issue:** Der Desktop-Typ `WorkTimePeriod` verlangt seit dieser Phase `isFirst: boolean` und
`isCurrent: boolean`. Zwei Antwortverträge verwenden diesen Typ, obwohl der Server dort **keine**
Flags mitschickt:

- `WorkPeriodCorrectionOutcome.period: WorkTimePeriod | null` (desktop, Zeile 303) — der Server
  liefert `getWorkPeriodById(period.id)` (`workPeriodCorrectionService.ts:498`), also ein reines
  `UserWorkPeriod` ohne Flags.
- `WorkTimeChangeResult.period: WorkTimePeriod` (desktop, Zeile 217) — der Server liefert
  `newPeriod` aus `createWorkPeriod()`, ebenfalls ohne Flags.

Nur `GET /api/work-periods` (`getWorkPeriodsWithFlags`) trägt sie. Der Typ behauptet also
Laufzeitwerte, die nie ankommen. Heute liest niemand `outcome.period.isFirst` (geprüft per grep
über `desktop/src`), aber der Compiler würde einen solchen Zugriff ohne Warnung durchlassen und
`undefined` läge dort, wo `boolean` versprochen ist — genau die Klasse Fehler, wegen der
`isCurrent` überhaupt vom Client in den Server gewandert ist (DD-35).

**Fix:** Für die Outcome-Verträge einen eigenen, flaglosen Typ verwenden, spiegelbildlich zur
Server-Trennung `UserWorkPeriod` vs. `UserWorkPeriodListItem`:

```ts
export interface WorkTimePeriodBase { id: number; userId: number; validFrom: string; /* … */ }
export interface WorkTimePeriod extends WorkTimePeriodBase { isFirst: boolean; isCurrent: boolean; }
// WorkPeriodCorrectionOutcome.period: WorkTimePeriodBase | null
// WorkTimeChangeResult.period: WorkTimePeriodBase
```

---

### WR-06: Die drei Vorschau-Endpunkte teilen einen IP-Eimer von 30/min, der vor `requireAuth` zählt — die Speicherpfade sind gar nicht gedrosselt

**File:** `server/src/routes/workPeriods.ts:285, 432, 585`,
`server/src/middleware/rateLimits.ts:65-79`,
`desktop/src/components/worktime/WorkTimePeriodEditModal.tsx:250-260`

**Issue:** Drei Punkte, die zusammen ein reales Bedienproblem ergeben:

1. `workTimeChangePreviewLimiter` (30 Anfragen/Minute in Produktion, Schlüssel = IP) bedient jetzt
   **drei** Routen statt einer: `/preview`, `/:id/correct/preview` und `/:id/delete/preview`.
2. Der Korrektur-Dialog löst bei **jeder** Feldänderung eine entprellte Vorschau aus
   (`useEffect` mit `[isOpen, validFrom, weeklyHours, workScheduleKey]`, 400 ms). Der
   `WorkScheduleEditor` hat sieben Tagesfelder; ein Durchgang durch den Tagesplan plus
   Wochenstunden plus Datum erreicht ohne Weiteres 10-15 Anfragen. Zwei Admins hinter derselben
   NAT-Adresse (Regelfall in einer Stiftung) teilen sich denselben Eimer.
3. Bei 429 liefert der Limiter `success: false`; der Dialog setzt `previewErrorMessage`, `preview`
   bleibt `null`, und `isPrimaryDisabled({ hasPreviewToken: false, … })` sperrt „Korrektur
   speichern" — die Aktion ist bis zum Ablauf des Fensters komplett blockiert.

Zusätzlich läuft der Limiter **vor** `requireAuth`, zählt also auch unauthentifizierte Anfragen
mit; und die tatsächlichen Schreibpfade `PUT /:id`, `DELETE /:id` und `POST /change` — die
denselben doppelten Rebuild ausführen wie die Vorschau, plus Schreibvorgänge — tragen gar keinen
Limiter. Die im Kommentar genannte Begründung („der Trockenlauf ist ein echter Schreib-Rebuild")
trifft auf sie mindestens genauso zu.

**Fix:** Getrennte Eimer je Route oder ein deutlich höheres Limit für die Vorschauen (z. B. 120/min),
Schlüssel auf die Session-/Admin-Id statt der IP (nach `requireAuth` einhängen, mit einem
schmalen Vor-Limiter gegen unauthentifizierte Last), und einen eigenen, engeren Limiter auf die
drei Speicherpfade.

---

### WR-07: `PUT /api/users/:id` schreibt weiterhin Periodenwerte — ohne Vorschau-Token, Begründung, Rebuild oder Journalzeile

**File:** `server/src/services/userService.ts:565-641` (außerhalb des geänderten Dateisatzes),
Zusammenspiel mit `server/src/services/workPeriodCorrectionService.ts`

**Issue:** `updateUser()` spiegelt eine geänderte `weeklyHours`/`workSchedule` weiterhin per
`updateWorkPeriodValues(currentPeriod.id, …)` in die offene Periode. Der Kommentar dort sagt
inzwischen selbst:

> „3. Phase 12 ersetzt diesen Weg durch den Stichtagswechsel …, **Phase 13 durch die ausdrückliche
> Aktion ‚Stammdaten korrigieren' mit Pflichtbegründung.**"

Phase 13 hat die Aktion gebaut, den Übergangsweg aber nicht entfernt. Ein Admin (oder ein Skript
mit Admin-Sitzung) kann damit über `PUT /api/users/:id` genau das tun, was `PUT
/api/work-periods/:id` unter Vorschau-Token, Pflichtbegründung, Kettenprüfung, Rebuild,
Journalzeile und `audit_log`-Eintrag stellt — nur ohne all das. Der Saldo wird dabei **nicht**
neu gerechnet: die Periode trägt danach neue Sollstunden, `overtime_balance` die alten, bis
irgendein späterer Rebuild den Unterschied zufällig materialisiert.

Der Desktop nutzt den Weg nicht mehr (`EditUserModal.handleSubmit` schickt
`weeklyHours: user.weeklyHours` unverändert, Zeile 543-544), und die Spiegelung greift nur bei
`data.weeklyHours !== existingUser.weeklyHours` — die Lücke ist also nicht über die eigene
Oberfläche erreichbar, wohl aber über die API.

**Fix:** Den Spiegelungszweig in `updateUser()` entfernen und `weeklyHours`/`workSchedule` aus
`UpdateUserInput` verwerfen (400, wenn sie abweichend mitgeschickt werden), mit Verweis auf die
beiden vorgesehenen Endpunkte. Falls das den Rahmen von Phase 13 sprengt: als ausdrücklichen
Restposten in `PROJECT_STATUS.md` führen, statt den Kommentar so stehen zu lassen, als wäre er
erledigt.

---

### WR-08: Korrektur und Löschung legen `overtime_balance`-Zeilen für Zukunftsmonate an — entgegen der Begründung, die sie selbst kopiert haben

**File:** `server/src/services/workPeriodCorrectionService.ts:290-314`,
`server/src/services/workPeriodDeletionService.ts:204-228`

**Issue:** Beide Services übernehmen den WR-02-Baustein aus Phase 12 wörtlich, samt der
Entscheidung „**Neue Zukunftsmonate anzulegen wäre falsch** (sie würden ein volles Monatssoll
ohne Ist erzeugen)" (`workPeriodChangeService.ts:517-519`). Der Baustein hält das aber nur für
`staleFutureMonths` ein. `affectedMonths` kommt aus `monthsInRange(rangeStart, rangeEnd)`, und für
eine Periode, die vollständig in der Zukunft liegt, gilt `rangeStart > today ⇒ rangeEnd =
rangeStart` — `affectedMonths` enthält dann genau diesen Zukunftsmonat, und
`rebuildOvertimeTransactionsForMonth()` legt für ihn eine `overtime_balance`-Zeile mit vollem
Monatssoll und ohne Ist an (`overtimeTransactionRebuildService.ts:107-112`: `endDate = monthEnd`
für jeden Monat ≠ aktueller Monat, auch für zukünftige).

Auf den gemessenen `balanceDelta` wirkt sich das nicht aus (`getOvertimeBalance()` filtert
`month <= currentMonth`), aber die Zeile bleibt in `overtime_balance` stehen, taucht bei jedem
späteren Aufruf als `staleFutureMonths` wieder auf und verfälscht jede Auswertung, die
`overtime_balance` ohne Monatsfilter liest.

**Fix:** Die Rebuild-Liste auf Monate bis einschließlich des aktuellen Monats beschränken und
Zukunftsmonate nur dann aufnehmen, wenn bereits eine Zeile existiert:

```ts
const currentMonth = today.slice(0, 7);
const rebuildMonths = [
  ...affectedMonths.filter((m) => m <= currentMonth),
  ...staleFutureMonths,
];
```

---

### WR-09: Client- und Server-Vergleich des Tagesplans weichen voneinander ab (`JSON.stringify` vs. Feldvergleich)

**File:** `desktop/src/components/worktime/workTimePeriodEditRules.ts:113-121`,
`server/src/services/workPeriodChangeService.ts:164-168`

**Issue:** Die „nichts geändert"-Prüfung im Formular vergleicht

```ts
JSON.stringify(args.workSchedule) === JSON.stringify(args.original.workSchedule)
```

`JSON.stringify` ist schlüsselreihenfolgeabhängig. Der Server verwendet an derselben Stelle
`workScheduleEquals()`, das feldweise über `WEEKDAY_KEYS` vergleicht
(`workPeriodChangeService.ts:164-168`). Zwei inhaltsgleiche Tagespläne mit anderer
Schlüsselreihenfolge — etwa, wenn `WorkScheduleEditor` ein Objekt neu aufbaut — gelten
clientseitig als geändert, serverseitig als No-Op. Folge: Das Formular lässt das Speichern zu,
der Server antwortet mit 400 „Es wurde nichts geändert. Ändern Sie einen Wert oder brechen Sie
ab." Zwei Wahrheiten für dieselbe Regel — dieselbe Klasse Problem, die
`.claude/CLAUDE.md` unter „Dual Calculation System" verbietet und die DD-35 im selben Feature
gerade beseitigt hat.

Randnotiz zur selben Datei: `validateCorrectionForm()` prüft `weeklyHours` gegen 0-60, aber nicht
die Tagesplansumme gegen `MAX_WEEKLY_HOURS` — diese Prüfung liegt in
`WorkTimePeriodEditModal.findInvalidScheduleDay()` und deckt nur die Tagesobergrenze (24 h) ab,
nicht die Wochensumme, die der Server abweist
(`workPeriodCorrectionService.ts:175-183`).

**Fix:** Denselben feldweisen Vergleich clientseitig verwenden (die sieben Tagesschlüssel liegen
im Desktop bereits als `DAY_ORDER`/`DAY_LABELS_DE` vor) und die Wochensummenprüfung in
`validateCorrectionForm()` nachziehen.

---

### WR-10: Ein Storno-Paar mit Datum in der Zukunft ist im Kontoauszug nicht sichtbar

**File:** `desktop/src/hooks/useWorkTimeAccounts.ts:306-311`

**Issue:** Der Hook deckelt `toDate` hart auf heute:

```ts
const today = `${now.getFullYear()}-…`;
if (toDate > today) { toDate = today; }
```

`overtimeLiveCalculationService.ts:534-537` filtert `model_change`-Zeilen mit
`ot.date >= ? AND ot.date <= ?`. Eine Korrekturbuchung mit `date = input.validFrom` in der
Zukunft (Korrektur einer geplanten Periode, siehe WR-08 — `balanceDelta` kann dort ≠ 0 sein) und
ihre Gegenbuchung (`date = original.date`, ebenfalls Zukunft) erscheinen deshalb in keinem
Zeitraum des Kontoauszugs. REQ-31 („die Storno-Geschichte bleibt im Auszug sichtbar") gilt für
diese Zeilen faktisch nicht.

**Fix:** Für `model_change`-Zeilen nicht auf heute deckeln (die Deckelung stammt aus der
Tagesberechnung, die für Zukunftstage keine Ist-Daten hat), bzw. `toDate` auf das Ende des
gewählten Monats/Jahres belassen und stattdessen die Tageszeilen-Erzeugung serverseitig auf
`<= heute` begrenzen.

---

### WR-11: Der Selbst-Join auf `reversalOf` verdoppelt die Originalzeile, sobald mehr als eine Gegenbuchung auf sie zeigt

**File:** `server/src/services/overtimeLiveCalculationService.ts:527-537`,
`server/src/database/migrations/014_add_reversal_of_to_overtime_transactions.ts:58-65`

**Issue:**

```sql
LEFT JOIN overtime_transactions r ON r.reversalOf = ot.id
```

Der Join ist 1:n. Die Datenbank erzwingt nirgends, dass höchstens eine Zeile auf dieselbe
Originalzeile zeigt: Migration 014 legt `idx_overtime_transactions_reversal_of` als **nicht**
eindeutigen Index an, `schema.ts:660` genauso. Die einzige Absicherung ist die Anwendungslogik
(`NOT EXISTS (… r.reversalOf = ot.id)` in `workPeriodDeletionService.ts:242-244`). Kommt jemals
eine zweite Gegenbuchung zustande (Reparaturskript, manueller Eingriff, künftiger Aufrufer), zeigt
der Kontoauszug die Originalzeile doppelt, jeweils mit anderem `reversedBy` — und die Spaltenwerte
`documentedDelta` beider Kopien werden dem Leser zweimal gezeigt.

**Fix:** Den Teilindex eindeutig machen, dann ist die Invariante von der Datenbank getragen statt
von der Aufrufreihenfolge:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_overtime_transactions_reversal_of
ON overtime_transactions(reversalOf) WHERE reversalOf IS NOT NULL;
```

(in Migration 014 **und** in `schema.ts` — beide müssen laut Kopfkommentar identisch bleiben).

---

### WR-12: Die vier UPDATE-Schreibwege auf `user_work_periods` tragen keinen `deletedAt IS NULL`-Riegel — und der Trigger prüft für gelöschte Zeilen gar nichts

**File:** `server/src/services/workPeriodService.ts:358, 396, 430, 614`

**Issue:** `closeWorkPeriod()`, `updateWorkPeriodValues()`, `setWorkPeriodValidFrom()` und
`extendWorkPeriodTo()` schreiben alle mit `WHERE id = ?`, ohne `AND deletedAt IS NULL` —
im Gegensatz zu `softDeleteWorkPeriod()` (Zeile 656), das den Filter trägt. Migration 013 hat
gleichzeitig dem UPDATE-Riegel die Bedingung `NEW.deletedAt IS NULL` mitgegeben (Zeile 192, 202).
Beides zusammen heißt: Ein Aufruf mit der Id einer weggenommenen Periode ändert deren Werte
**und umgeht dabei jede Überlappungs-/Lückenprüfung** — der Trigger überspringt die Zeile,
`checkPeriodChain()` liest sie nicht (`getWorkPeriods()` filtert sie heraus).

Heute ist kein Aufrufer betroffen (alle beziehen ihre Ids über die gefilterten Getter), aber der
Kopfkommentar des Services stellt die Soft-Delete-Zusage ausschließlich über die Lesepfade her
(Zeile 573-577) — der Schreibpfad hat kein Gegenstück.

**Fix:** `AND deletedAt IS NULL` in allen vier UPDATEs ergänzen; `result.changes === 0` wirft
bereits eine sprechende Meldung, die dann auch den Fall „bereits gelöscht" abdeckt (wie in
`softDeleteWorkPeriod()` formuliert).

---

### WR-13: Ein einziges Ref-Objekt für alle Zeilenaktionen — die Fokusrückgabe aus DD-39 trifft die falsche Schaltfläche

**File:** `desktop/src/components/users/EditUserModal.tsx:184-186, 770-782, 290, 261`,
`desktop/src/components/worktime/workTimePeriodActions.tsx:295-298`

**Issue:** `renderActions` gibt jeder Zeile **dieselben** Ref-Objekte mit:

```tsx
correctButtonRef={rowCorrectButtonRef}
deleteButtonRef={rowDeleteButtonRef}
```

React weist Ref-Objekte beim Mounten der Reihe nach zu; nach dem Rendern zeigt
`rowCorrectButtonRef.current` auf die Schaltfläche der **zuletzt** gerenderten Zeile. Die
Zusicherung in `workTimePeriodActions.tsx:295-296` („DD-39: eigenes Ref je Zeilenaktion — der
Aufrufer gibt den Fokus … an genau den Knopf zurueck, der ihn geoeffnet hat") ist damit nicht
eingelöst: `focusCorrectionTrigger('row')` und `rowDeleteButtonRef.current?.focus()`
(Zeile 261, 290) fokussieren die letzte Zeile, nicht die auslösende. Nach dem Löschen zeigt das
Ref zusätzlich auf eine Schaltfläche, die es nach dem Refetch so nicht mehr gibt.

Ob der Anwender das bemerkt, hängt an der Effektreihenfolge: `useModalLayer`
(`useModalLayer.ts:309-314`) stellt beim Abmelden den vorher fokussierten Knoten wieder her und
überschreibt den manuellen Aufruf möglicherweise wieder. Auf diese Reihenfolge zu bauen ist genau
das, wovor der CR-02-Kommentar in derselben Datei warnt.

**Fix:** Entweder die Refs je Zeile führen (`Map<periodId, RefObject>`) oder — einfacher — sich
auf die Fokusrückgabe von `useModalLayer` verlassen und die manuellen `focus()`-Aufrufe streichen;
sie sind dann redundant.

## Info

### IN-01: Kopfkommentar in `workPeriods.ts` behauptet Castfreiheit, die die Datei nicht einhält

**File:** `server/src/routes/workPeriods.ts:80-84, 89, 130, 162, 183`
**Issue:** „diese Datei enthält an keiner Stelle einen solchen Cast" — tatsächlich stehen
`body as Record<string, unknown>` (dreimal) und `record.workSchedule as WorkSchedule`
(Zeile 183) darin. Die Casts sind hinter Typwächtern abgesichert und damit unbedenklich, der
Kommentar ist es nicht: er lädt dazu ein, einen künftigen Cast für „schon immer so" zu halten.
**Fix:** Den Satz auf „kein ungeprüfter Cast auf den Ergebnistyp" präzisieren.

### IN-02: `containsControlCharacters()` und `MAX_REASON_LENGTH` liegen in drei wortgleichen Kopien vor

**File:** `server/src/services/workPeriodChangeService.ts`,
`server/src/services/workPeriodCorrectionService.ts:106-125`,
`server/src/services/workPeriodDeletionService.ts:95-113`
**Issue:** Die Duplizierung ist im Kommentar begründet (D1: getrennte Validierungsbausteine je
Aktion), betrifft aber keinen fachlichen Text, sondern eine reine Zeichenprüfung. Eine
Verschärfung (z. B. Unicode-Richtungszeichen U+202E, die in einem Kontoauszug Text umdrehen
können) erreicht nur eine der drei Stellen — exakt das Muster, das CR-04/IN-01 in derselben Phase
für `isWorkSchedule` behoben hat.
**Fix:** Nach `server/src/utils/validation.ts` ziehen; die Meldungstexte bleiben je Service.

### IN-03: `reversedNoteLine()` kann „Storniert am  von X" mit doppeltem Leerzeichen erzeugen

**File:** `desktop/src/components/worktime/overtimeTransactionFormat.ts:110-114`
**Issue:** Ist `reversedAt` null oder unparsbar, liefert `formatCreatedAtDe()` `''` und der Satz
lautet „Storniert am  von Anna Berger · Beleg #12". Erreichbar ist der Fall heute nicht
(`overtime_transactions.createdAt` hat einen Spaltendefault), abgesichert ist er auch nicht.
**Fix:** Den Datumsteil weglassen statt leer einzusetzen, analog zum bereits vorhandenen
`namePart`-Muster.

### IN-04: `formatGermanDate()` existiert in fünf Kopien im Desktop

**File:** `desktop/src/components/worktime/workTimePeriodEditRules.ts:72`,
`workTimePeriodDeleteRules.ts:142`, `workTimePeriodActions.tsx:283`,
`WorkTimePeriodEditModal.tsx:123`, `WorkTimePeriodList.tsx:45`,
`EditUserModal.tsx:55`
**Issue:** Sechs identische Definitionen von `new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')`.
Jede ist für sich zeitzonensicher, aber jede künftige Anpassung (z. B. zweistelliges Jahr,
abweichende Locale) muss sechsmal erfolgen.
**Fix:** Nach `desktop/src/utils/timeUtils.ts` ziehen, wo `formatHours` bereits liegt.

---

_Reviewed: 2026-08-22T21:19:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
