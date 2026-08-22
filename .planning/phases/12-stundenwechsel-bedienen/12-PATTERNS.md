# Phase 12: Stundenwechsel bedienen - Pattern Map

**Mapped:** 2026-08-22
**Files analyzed:** 20 (9 Server, 8 Desktop neu/geändert, 1 Migration, 1 E2E-Test, 1 Schema-Datei)
**Analogs found:** 18 / 20 (2 ohne Analog, ausdrücklich vermerkt)

Es gibt keine RESEARCH.md für diese Phase (Research deaktiviert). Die Dateiliste ist aus
`12-CONTEXT.md`, `12-UI-SPEC.md` (Abschnitt „Änderungen an Bestandskomponenten" + „Neue
Dateien") und `11-DESKTOP-DISPOSITION.md` (WR-12-Nachzug) abgeleitet.

---

## File Classification

| Neue/geänderte Datei | Rolle | Datenfluss | Nächstes Analog | Trefferqualität |
|---|---|---|---|---|
| `server/src/services/workPeriodChangeService.ts` (neu) | service | CRUD + Rebuild, atomar | `server/src/services/vacationTransactionService.ts` + `server/src/services/workPeriodService.ts` + `server/src/services/overtimeCorrectionsService.ts` | Verbund-Analog (Buchungsmuster + Periodenschreibweg + Rebuild-Trigger) |
| `server/src/routes/workTimeChange.ts` (neu, oder Erweiterung von `workTimeAccounts.ts`) | route | request-response, POST (write) | `server/src/routes/overtime.ts` (`POST /corrections`) | role-match, sehr nah |
| `server/src/routes/workTimeChange.ts` — `GET .../preview` (neu, Dry-Run) | route | request-response, Dry-Run | `server/src/routes/yearEndRollover.ts` (`GET /preview/:year`) | exact — einziges echtes Preview-Muster im Bestand |
| `server/src/routes/workPeriods.ts` (neu, Perioden-Lese-API) | route | request-response, read-only, Query-Param `userId` | `server/src/routes/workTimeAccounts.ts` (`GET /history`) | exact |
| `server/src/database/migrations/011_add_model_change_transaction_type.ts` (neu) | migration | Schema-Änderung, Tabellen-Neubau | `server/src/database/migrations/006_add_time_entry_transaction_type.ts` | exact (identisches Muster, gleiche Zieltabelle) |
| `server/src/database/schema.ts` (Zeile 517-523, CHECK-Liste) | config/schema | — | sich selbst — muss synchron mit der neuen Migration gehalten werden | exact (Parity-Pflicht) |
| `desktop/src/components/worktime/WorkTimeChangeModal.tsx` (neu) | component (Modal) | request-response, Formular + Mutation | `desktop/src/components/corrections/OvertimeCorrectionModal.tsx` | exact |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` (neu) | component (Liste) | request-response, read-only | `desktop/src/components/worktime/OvertimeTransactions.tsx` (Tabellenteil) | role-match |
| `desktop/src/components/ui/modalStack.ts` (neu) | utility | Modul-State (Stack) | kein Analog im Bestand | kein Analog |
| `desktop/src/components/ui/Modal.tsx` (geändert) | component (Primitive) | — | sich selbst (additive Änderung) | exact |
| `desktop/src/components/ui/ConfirmDialog.tsx` (geändert) | component (Primitive) | — | sich selbst (additive Änderung) | exact |
| `desktop/src/pages/UserManagementPage.tsx` (geändert) | component (Seite) | — | sich selbst (additive Änderung) | exact |
| `desktop/src/components/users/WorkScheduleEditor.tsx` (geändert, `readOnly`-Prop) | component (Formular-Baustein) | — | sich selbst (additive Änderung) | exact |
| `desktop/src/components/users/EditUserModal.tsx` (geändert) | component (Modal) | — | sich selbst (additive Änderung) | exact |
| `desktop/src/components/worktime/OvertimeTransactions.tsx` (geändert, `model_change`) | component (Liste) | — | sich selbst (additive Änderung) | exact |
| `desktop/src/hooks/useWorkTimeChange.ts` (neu, Hook-Schicht) | hook | request-response (Query + Mutation) | `desktop/src/hooks/useVacationBalanceAdmin.ts` + `desktop/src/hooks/useOvertimeCorrections.ts` | exact |
| `desktop/src/utils/timeUtils.ts:213-247` (WR-12-Nachzug) | utility | transform (reine Funktion) | Server-Gegenstück `server/src/utils/workingDays.ts:240` (`calculateAbsenceHoursWithWorkSchedule`) | Signatur-Vorbild, kein Desktop-internes Analog |
| `desktop/src/components/absences/AbsenceRequestForm.tsx:64-76` (WR-12-Nachzug) | component (Formular) | request-response | sich selbst (Aufrufstelle wird umgehängt) | exact |
| `desktop/src/components/worktime/WorkScheduleDisplay.tsx:41-67` (WR-12-Nachzug) | component (Anzeige) | request-response | sich selbst (additive Änderung) | exact |
| `desktop/src/components/users/WorkScheduleEditor.tsx:44` (WR-12, Vorschlagswert) | component | transform | sich selbst | exact |
| `desktop/tests/user-edit.spec.ts` (geändert) | test (E2E) | — | sich selbst (ein Testfall wird umgeschrieben) | exact |
| `server/src/services/workPeriodChangeService.test.ts` (neu) | test (unit/integration) | — | `server/src/services/workPeriodService.test.ts` | exact |

---

## Pattern Assignments

### 1. `server/src/services/workPeriodChangeService.ts` (neu) — der zentrale Schreibweg

**Rolle:** service, CRUD + begrenzter Rebuild, atomar in einer `db.transaction()`.

**Analoga (drei kombiniert, kein einzelnes deckt den ganzen Vorgang ab):**
- `server/src/services/workPeriodService.ts` — `createWorkPeriod()` (Zeile 285-317) und
  `closeWorkPeriod()` (Zeile 324-344) sind laut eigenem Kopfkommentar (Zeile 38-40) genau der
  Zweischritt, den Phase 12 zu einem Vorgang klammern soll: *„GRENZE DIESES PLANS:
  `closeWorkPeriod()` + `createWorkPeriod()` sind der Zweischritt für einen Stichtagswechsel.
  Die Aneinanderreihung beider Schritte zu einem einzigen, ggf. transaktional geklammerten
  Vorgang gehört NICHT in Phase 10 — das ist Phase 12."* Fehlerübersetzung über
  `WorkPeriodConflictError`/`translateWorkPeriodError()` (Zeile 92-97, 178-188) ist das
  Muster für „Überlappung/Lücke verständlich melden" (D3, D6).
- `server/src/services/vacationTransactionService.ts` — `recordVacationTransaction()`
  (Zeile 364-437) ist das Buchungsmuster für D5: Pflichtprüfung auf leere Begründung
  (Zeile 384-389), `balanceBefore`/`balanceAfter` mitschreiben, `logger.info` mit Klartext.
  `syncTakenFromJournal()`-Idee (aus Journal abgeleiteter Wert statt fortgeschriebenem
  Zähler) ist die Blaupause für „der Saldo wird nicht separat gepflegt, sondern bleibt
  Summe der Buchungen" — deckt sich mit D4.
- `server/src/services/overtimeCorrectionsService.ts` — `createOvertimeCorrection()`
  (Zeile 22-110) zeigt das Zusammenspiel aus Validierung (Reason ≥ 10 Zeichen, Zeile 28-30),
  Schreiben, und anschließendem **Rebuild** (`rebuildOvertimeTransactionsForMonth`,
  Zeile 90). Das ist das nächstliegende Vorbild für „nach dem Schreiben wird neu gerechnet",
  auch wenn der dortige Rebuild monatsbasiert ist und Phase 12 einen Datumsbereich
  (`validFrom` bis heute, D3) braucht — der Rebuild-Bereich muss selbst gebaut werden,
  nicht monatsweise wie `overtimeTransactionRebuildService.ts` es tut.

**Rebuild-Baustein:** `server/src/services/overtimeTransactionRebuildService.ts` —
`rebuildOvertimeTransactionsForMonth()` (Zeile 74 ff.) zeigt das Zusammenspiel aus
`workPeriodContextModule.createWorkPeriodContext()` (D1/D2 aus Phase 11, vorladender Cache
pro Berechnungslauf — **nicht** modul-global) und `transactionManager.createTransaction()`
(`server/src/services/overtimeTransactionManager.ts` Zeile 51-124). Die Buchungslöschung vor
dem Neuaufbau folgt `deleteTransactionsInRange()` (Zeile 152-183) — **wichtig:** diese Funktion
löscht per Typfilter; für Phase 12 darf sie NICHT blind alle Typen im Bereich löschen, weil
D4 nur EINE neue Buchung vom Typ `model_change` verlangt, keinen Tages-Rebuild der
`earned`/`time_entry`-Buchungen. Die Planung muss entscheiden, ob überhaupt ein Löschen
bestehender Buchungen nötig ist, oder ob nur eine Differenzbuchung ergänzt wird (D4: „nicht
als stille Neuberechnung und nicht als viele Tagesbuchungen").

**Periodenkontext für die Berechnung:** `server/src/services/workPeriodContext.ts` —
`createWorkPeriodContext()` (Zeile 58-71) für den einen Berechnungslauf von Vorschau/Speichern;
`directWorkPeriodLookup` (Zeile 80-84) NUR für Einzelabfragen, nicht in einer Tagesschleife
über den Rebuild-Zeitraum.

**Fehlerklasse-Vorbild:**
```typescript
// server/src/services/workPeriodService.ts:92-97
export class WorkPeriodConflictError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkPeriodConflictError';
  }
}
```

**Buchungs-Validierung (Vorbild für D5, Pflichtbegründung):**
```typescript
// server/src/services/vacationTransactionService.ts:377-395
if (!Number.isFinite(days) || days === 0) {
  throw new Error(`Ungültige Buchung: days muss eine Zahl ungleich 0 sein (erhalten: ${days})`);
}
if (!description || description.trim() === '') {
  throw new Error(
    'Ungültige Buchung: description ist Pflicht — eine Buchung ohne Begründung ist im ' +
    'Kontoauszug wertlos'
  );
}
```

**Transaktionsklammer (D7):** Kein direktes Analog mit exakt „Periode + Rebuild + Buchung in
einer Klammer", aber `overtimeTransactionManager.createTransactionsBatch()`
(Zeile 134-140) zeigt das `db.transaction()`-Grundmuster:
```typescript
// server/src/services/overtimeTransactionManager.ts:134-140
export function createTransactionsBatch(transactions: TransactionParams[]): Array<number | null> {
  const result = db.transaction(() => {
    return transactions.map(tx => createTransaction(tx));
  })();
  return result;
}
```
Der neue Service muss `createWorkPeriod`/`closeWorkPeriod` (workPeriodService), den
Rebuild-Ausschnitt und `recordVacationTransaction`-artiges Buchen von `overtime_transactions`
in genau so einer `db.transaction()`-Klammer zusammenführen. **Wichtig:** `better-sqlite3` ist
synchron — kein `async`/`await` innerhalb der Transaktionsfunktion (Kopfkommentar-Regel aus
`workPeriodService.ts:58-60` und `vacationTransactionService.ts:24-28`).

---

### 2. `server/src/routes/workTimeChange.ts` (neu) — Speichern-Endpunkt (D6, D7)

**Analog:** `server/src/routes/overtime.ts` — `POST /corrections` (Zeile 132-180).

**Auth/Rollen-Muster (D6, sofortige Rollenprüfung):**
```typescript
// server/src/routes/overtime.ts:137-141
router.post(
  '/corrections',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
```

**Validierung + Delegation an den Service:**
```typescript
// server/src/routes/overtime.ts:143-166
const { userId, hours, date, reason, correctionType } = req.body as OvertimeCorrectionCreateInput;
const createdBy = req.session.user!.id;

if (!userId || !hours || !date || !reason || !correctionType) {
  res.status(400).json({ success: false, error: 'Missing required fields' });
  return;
}
if (reason.trim().length < 10) {
  res.status(400).json({ success: false, error: 'Reason must be at least 10 characters' });
  return;
}
const correction = createOvertimeCorrection({ userId, hours, date, reason, correctionType }, createdBy);
res.json({ success: true, data: correction });
```

**Fehlerantwort-Muster:**
```typescript
// server/src/routes/overtime.ts:172-178
} catch (error) {
  console.error('Error creating overtime correction:', error);
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Failed to create overtime correction',
  });
}
```
(`vacationTransactions.ts` nutzt stattdessen `logger.error({ err: error }, ...)` statt
`console.error` — für neuen Code ist `logger` das modernere, zu bevorzugende Muster, siehe
Abschnitt „Shared Patterns".)

---

### 3. `server/src/routes/workTimeChange.ts` — `GET .../preview` (Dry-Run, D2)

**Analog:** `server/src/routes/yearEndRollover.ts` — `GET /preview/:year` (Zeile 26-57) +
`server/src/services/yearEndRolloverService.ts` — `previewYearEndRollover()` (Zeile 162-230).

Dies ist das **einzige** echte Preview-Muster im Bestand (Suche nach `preview`/`dry-run`/
`simulate` in `server/src/` außerhalb von Skripten ergab nur diesen Treffer plus
`migrateToNewTransactionSystem.ts`, ein CLI-Skript, kein Routen-Endpunkt).

**Wichtiger Befund, den die Planung beachten muss:** `previewYearEndRollover()` teilt sich
**nicht** exakt denselben Code mit `performYearEndRollover()` — Preview ruft
schreibfreie Lesefunktionen (`getYearEndOvertimeBalance`, `calculateCarryover`), Execute ruft
separate `bulkInitialize*`-Schreibfunktionen auf. Das ist **kein** Vorbild für D2, das
ausdrücklich „exakt dieselbe Codebahn" verlangt (Vermeidung des in `.claude/CLAUDE.md`
beschriebenen „Dual Calculation System"). Die Planung sollte für Phase 12 stattdessen einen
echten Dry-Run-Parameter im neuen Service selbst bauen (z. B. `computeWorkTimeChange(input,
{ dryRun: boolean })`, der bei `dryRun: true` die `db.transaction()` am Ende mit
`db.transaction(() => { ...; if (dryRun) throw new RollbackForPreview(); })` verwirft, oder
eine reine Berechnungsfunktion, die sowohl von der Vorschau- als auch von der
Speichern-Route aufgerufen wird und nur im Speicherpfad tatsächlich schreibt). **Kein
Bestandsmuster deckt das exakt ab — ausdrücklich vermerkt, siehe „No Analog Found".**

**Routen-Grundgerüst (Auth, Parametervalidierung, Response-Form):**
```typescript
// server/src/routes/yearEndRollover.ts:26-56
router.get(
  '/preview/:year',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<any>>) => {
    try {
      const year = parseInt(req.params.year, 10);
      if (isNaN(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ success: false, error: 'Invalid year parameter (must be 2000-2100)' });
      }
      logger.info({ year, userId: req.session?.user?.id }, 'Year-end rollover preview requested');
      const preview = previewYearEndRollover(year);
      res.json({ success: true, data: preview });
    } catch (error) {
      logger.error({ err: error }, '❌ Failed to preview year-end rollover');
      res.status(500).json({ success: false, error: 'Failed to preview year-end rollover' });
    }
  }
);
```

**`previewToken`-Signierung:** kein Analog im Bestand (kein zustandsloses, signiertes,
zeitlich begrenztes Token existiert im Projekt — Sessions laufen über `req.session`, nicht
über eigens ausgestellte Tokens). Die Planung muss ein neues, kleines Signaturschema wählen
(z. B. HMAC über die vier gebundenen Felder + Ausstellungszeitstempel, `SESSION_SECRET` als
Schlüssel, da dieser Wert laut `.claude/CLAUDE.md` bereits als Secret geführt wird). **Kein
Bestandsmuster — ausdrücklich vermerkt.**

---

### 4. `server/src/routes/workPeriods.ts` (neu) — Perioden-LESE-API

**Analog:** `server/src/routes/workTimeAccounts.ts` — `GET /history` (Zeile 139-179).

```typescript
// server/src/routes/workTimeAccounts.ts:139-165
router.get(
  '/history',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const requestedUserId = req.query.userId ? parseInt(req.query.userId as string) : req.session.user!.id;
      const months = req.query.months ? parseInt(req.query.months as string) : 12;

      if (!isAdmin && requestedUserId !== req.session.user!.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      if (isNaN(requestedUserId) || isNaN(months) || months < 1 || months > 24) {
        res.status(400).json({ success: false, error: 'Invalid parameters' });
        return;
      }
      const history = getWorkTimeAccountHistory(requestedUserId, months);
      res.json({ success: true, data: history });
    } catch (error) { /* ... */ }
  }
);
```
Direkt übertragbar: `userId`-Query-Param, Admin-vs-Eigenes-Konto-Prüfung (dasselbe Muster
auch in `vacationTransactions.ts:23-59`), Delegation an
`server/src/services/workPeriodService.ts` → `getWorkPeriods(userId)` (bereits vorhanden,
Zeile 191-197 — die Route muss nur noch die Rollenprüfung und HTTP-Hülle drumlegen, keine
neue Service-Funktion).

---

### 5. Migration `011_add_model_change_transaction_type.ts` (neu)

**Analog:** `server/src/database/migrations/006_add_time_entry_transaction_type.ts` —
wortgleiches Muster: Tabellen-Neubau mit erweitertem CHECK-Constraint (SQLite erlaubt kein
`ALTER TABLE ... ADD CONSTRAINT`), Daten kopieren, Zeilenzahl vergleichen, alte Tabelle
löschen, neue umbenennen, Indizes neu anlegen.

**Aktueller Stand des CHECK-Constraints** (verifiziert `server/src/database/schema.ts:517-523`,
identisch mit dem Ergebnis von Migration 006 — Migrationen 007-010 haben `overtime_transactions`
nicht mehr angefasst):
```sql
type TEXT NOT NULL CHECK(type IN (
  'worked', 'time_entry', 'vacation_credit', 'sick_credit',
  'overtime_comp_credit', 'special_credit', 'unpaid_deduction',
  'holiday_credit', 'weekend_credit', 'carry_over', 'payout',
  'correction', 'initial_balance', 'year_end_balance',
  'earned', 'compensation', 'carryover', 'unpaid_adjustment'
))
```
Migration 011 fügt `'model_change'` an dieser Liste an (in Migration UND `schema.ts` — siehe
„Parity-Pflicht" unten).

**Vollständiges Muster (Schritt-für-Schritt-Kopie von Migration 006, Zeile 24-147):**
```typescript
// server/src/database/migrations/006_add_time_entry_transaction_type.ts:24-60
export default {
  up(db: Database.Database): void {
    logger.info('🚀 Migration 006: ...');
    const countBefore = (db.prepare(`SELECT COUNT(*) as count FROM overtime_transactions`).get() as { count: number }).count;
    db.prepare(`
      CREATE TABLE overtime_transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ( /* + 'model_change' */ )),
        hours REAL NOT NULL,
        description TEXT,
        referenceType TEXT CHECK(referenceType IN ('time_entry', 'absence', 'manual', 'system', NULL)),
        referenceId INTEGER,
        balanceBefore REAL,
        balanceAfter REAL,
        createdAt TEXT DEFAULT (datetime('now')),
        createdBy INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id)
      )
    `).run();
    // ... INSERT INTO ... SELECT ... (Zeile 71-89), Zeilenzahl-Vergleich (91-97),
    // DROP TABLE (103), RENAME TO (107), drei CREATE INDEX (111-119)
  }
};
```

**Referenz auf die Periode (D5 „mit Bezug auf die Periode"):** Die bestehende Tabelle hat
bereits `referenceType`/`referenceId` (CHECK erlaubt `'time_entry', 'absence', 'manual',
'system'`). Für `model_change` muss geprüft werden, ob `referenceType` um `'work_period'`
erweitert werden muss (eigener CHECK auf derselben Spalte, Zeile in der neuen Tabelle) —
**keine neue Spalte nötig**, nur ein weiterer erlaubter Wert im bestehenden
`referenceType`-CHECK, analog zum type-CHECK selbst.

**Registrierung:** kein manuelles Eintragen nötig — `server/src/database/migrationRunner.ts`
(`loadMigrations()`, Zeile 178-215) lädt jede `*.ts`-Datei im Ordner alphabetisch und führt
sie synchron in einer `db.transaction()` aus (Zeile 120-128), sofern `up()` keine
`AsyncFunction` ist. Migration 011 muss synchron sein (wie 002/006), kein `async up()`.

**Parity-Pflicht (kritisch, sonst bricht `schemaMigrationParity.test.ts`-artige Prüfung
implizit):** `server/src/database/schema.ts` Zeile 507-533 (`CREATE TABLE IF NOT EXISTS
overtime_transactions`) MUSS denselben erweiterten CHECK bekommen wie die neue Migration —
sonst erzeugt eine frische Installation (`schema.ts`-Pfad) ein anderes Schema als eine
migrierte Bestandsdatenbank (Migrations-Pfad). Es existiert zwar aktuell nur ein
Parity-Test für `user_work_periods` (`schemaMigrationParity.test.ts`), aber das Muster —
`schema.ts` und Migration synchron halten — gilt projektweit und ist in mehreren
Migrationskopfkommentaren (002, 006) explizit als Grund für die Tabellen-Neubau-Technik
genannt.

---

### 6. `desktop/src/components/worktime/WorkTimeChangeModal.tsx` (neu)

**Analog:** `desktop/src/components/corrections/OvertimeCorrectionModal.tsx` (vollständig,
259 Zeilen) — nahezu deckungsgleiche Struktur: `Modal` mit `size="lg"`, Mitarbeiter-Infopanel
(blau), Formularfehler-Banner (rot), `grid grid-cols-1 md:grid-cols-2 gap-6` für zwei
Eingabefelder, Pflicht-`Textarea` mit Zeichenzähler, Aktionszeile `flex justify-end gap-3`.

**Imports-Muster:**
```typescript
// desktop/src/components/corrections/OvertimeCorrectionModal.tsx:1-9
import { useState, FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useCreateOvertimeCorrection } from '../../hooks/useOvertimeCorrections';
import { AlertCircle } from 'lucide-react';
```

**Validierungsmuster (Begründung ≥ 10 Zeichen, direkt wiederverwendbar für D5):**
```typescript
// desktop/src/components/corrections/OvertimeCorrectionModal.tsx:72-79
if (!reason.trim()) {
  setReasonError('Begründung ist erforderlich');
  isValid = false;
} else if (reason.trim().length < 10) {
  setReasonError('Begründung muss mindestens 10 Zeichen lang sein');
  isValid = false;
}
```

**Submit-Pfad (Mutation, Reset, Fehlerbanner):**
```typescript
// desktop/src/components/corrections/OvertimeCorrectionModal.tsx:84-115
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  if (!validateForm()) return;
  if (!userId) { setFormError('Kein Benutzer ausgewählt'); return; }
  try {
    await createCorrection.mutateAsync({ userId, hours: parseFloat(hours), date, reason: reason.trim(), correctionType });
    setHours(''); setDate(getTodayLocal()); setReason(''); setCorrectionType('manual');
    onClose();
  } catch (error) {
    console.error('Failed to create overtime correction:', error);
    setFormError(error instanceof Error ? error.message : 'Fehler beim Erstellen der Korrektur');
  }
};
```

**Wichtige Abweichung, die die UI-SPEC bereits vorschreibt und die dieses Analog NICHT
zeigt:** `OvertimeCorrectionModal` wird direkt im JSX-Baum gerendert (kein Modal-im-Modal-Fall).
`WorkTimeChangeModal` MUSS gemäß `12-UI-SPEC.md` Abschnitt „Formulargrenzen im verschachtelten
Baum" außerhalb des `<form>` von `EditUserModal` gerendert werden, `zIndexClass="z-[60]"`
tragen, und sein `onSubmit` zusätzlich `e.stopPropagation()` aufrufen — keines davon hat ein
Vorbild in `OvertimeCorrectionModal`, weil dort keine Verschachtelung vorliegt.

**Zweites, ergänzendes Analog für den Vorbefüllungs-/Vorschau-Teil:**
`desktop/src/components/vacation/VacationBalanceEditModal.tsx` — zeigt das Muster
„Formular vorbelegen aus Prop, `useEffect` synchronisiert bei Prop-Wechsel" (Zeile 60-67) und
eine **Vorschau-Karte** (Zeile 229-268). **Warnung:** Diese Vorschau wird im Frontend
gerechnet (`total`, `remaining` aus lokalem State, Zeile 137-138) — das ist exakt das
„Dual Calculation System", das D2 für Phase 12 ausdrücklich verbietet. Für
`WorkTimeChangeModal` NICHT diesen Rechen-Teil kopieren, nur die JSX-Struktur der Vorschaukarte
als Layout-Vorbild — die Werte müssen aus der Server-Antwort (`GET .../preview`) kommen, nie
lokal berechnet werden.

---

### 7. `desktop/src/components/worktime/WorkTimePeriodList.tsx` (neu)

**Analog:** `desktop/src/components/worktime/OvertimeTransactions.tsx` — Tabellenteil
(Zeile 190-270): `<div className="overflow-x-auto">`, `divide-y divide-gray-200
dark:divide-gray-700`, Zeilen-Hover `hover:bg-gray-50 dark:hover:bg-gray-800/50
transition-colors`, Zellen `px-4 py-3 text-sm`. Lade-/Fehler-/Leerzustand-Muster
(Zeile 29-76) — `LoadingSpinner` zentriert, `AlertCircle` + Fehlertext, zentrierter
Leerzustandstext. Datumsanzeige-Timezone-Muster:
```typescript
// desktop/src/components/worktime/OvertimeTransactions.tsx:215
{new Date(transaction.date + 'T12:00:00').toLocaleDateString('de-DE')}
```
Genau das Muster, das `12-UI-SPEC.md` (Zeile 566-568) für die neue Komponente vorschreibt —
niemals `toISOString().split('T')[0]`.

**Für den `renderActions`-Schnitt (Phase-13-Vorbereitung):** kein direktes Bestandsvorbild für
eine optionale Render-Prop-Spalte; am nächsten kommt das bedingte Rendern der Aktionsspalte in
`UserManagementPage.tsx` (Zeile 464-486, Button-Gruppe je nach `user.isActive`) — als
Belegung, dass bedingtes Spalten-Rendering im Projekt üblich ist, nicht als 1:1-Vorlage für
eine generische Prop.

---

### 8. `desktop/src/components/ui/modalStack.ts` (neu)

**Kein Analog im Bestand.** `12-UI-SPEC.md` bestätigt das ausdrücklich (Zeile 410-411: „Im
gesamten `desktop/src` gibt es **kein** `createPortal` … es existiert kein Bestandsmuster für
ein Modal im Modal."). Die Spezifikation selbst liefert die vollständige Funktionssignatur
(`pushModal(id: symbol)`, `popModal(id: symbol)`, `isTopModal(id: symbol): boolean`) inklusive
Index-Guard-Pflicht (`12-UI-SPEC.md` Zeile 470-476). Für die Planung ist die UI-SPEC selbst die
maßgebliche Quelle, kein Codebestand-Analog nötig oder verfügbar.

---

### 9. `desktop/src/components/ui/Modal.tsx` (geändert) — additive Änderungen

**Aktueller Bestand (vollständig gelesen, 88 Zeilen):**
```typescript
// desktop/src/components/ui/Modal.tsx:13-34
export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
```
Bestätigt exakt die in `12-UI-SPEC.md` beschriebenen Fundstellen: ESC pro Instanz auf
`document` (kein Stack), `transform` in Zeile 59 (`relative w-full ${sizeClasses[size]} ...
transform transition-all`), `aria-label="Close modal"` in Zeile 73, kein `role="dialog"`,
keine Fokusfalle. Die additiven Änderungen (createPortal, zIndexClass, Modal-Stack,
Fokusfalle/-rückgabe, deutsches `aria-label`) sind vollständig in `12-UI-SPEC.md` Abschnitt
„Änderungen an Bestandskomponenten → A" spezifiziert und dort mit exakten Zeilennummern
belegt — kein zusätzliches Code-Analog nötig, die Spezifikation ist bereits die konkrete
Quelle.

### 10. `desktop/src/components/ui/ConfirmDialog.tsx` (geändert) — additive Änderungen

**Aktueller Bestand (vollständig gelesen, 89 Zeilen):** bestätigt `if (!isOpen) return null;`
in Zeile 32 (vor jedem Hook — die neuen Hooks müssen darüber stehen), zwei `console.log` in
Zeile 35 und 41, kein `aria-label` am X-Button (Zeile 64-69), `Card`-basiert statt
`Modal`-basiert (Zeile 9, 55), kein `role="dialog"`. Additive Änderungen ebenfalls vollständig
in `12-UI-SPEC.md` spezifiziert.

---

### 11. `desktop/src/pages/UserManagementPage.tsx`, `EditUserModal.tsx`,
`WorkScheduleEditor.tsx`, `OvertimeTransactions.tsx` (geändert)

Alle vier sind **additive Änderungen an eigenem Bestandscode** — das jeweilige „Analog" ist
die Datei selbst vor der Änderung. Die exakten Zeilenbereiche wurden für diesen Report
gegengelesen und stimmen mit den in `12-UI-SPEC.md` zitierten Zeilennummern überein:

- `UserManagementPage.tsx:38` → `useState<User | null>(null)` (wird zu `editingUserId:
  number | null`); Zeile 464 `setEditingUser(user)`; Zeile 523-527 bedingtes Rendern von
  `EditUserModal`. `console.log`-Fundstellen im Löschpfad bestätigt (Zeile 127-131, 139,
  147-148, 152-153).
- `EditUserModal.tsx:41-54` Reset-`useEffect` mit Abhängigkeit `[user]` (wird zu
  `[user.id]` + zweiter schmaler Sync-Effekt); Zeile 168/336 `<form>`-Grenzen; Zeile 249-260
  Wochenstundenfeld; Zeile 274-278 `WorkScheduleEditor`-Aufruf; `console.log` in
  Zeile 103-106 und 123 bestätigt.
- `WorkScheduleEditor.tsx:90-104` Toggle-Button (`<button type="button">`, kein `<select>`,
  keine Checkbox — UI-SPEC-Behauptung verifiziert); Zeile 110 `grid grid-cols-2 gap-3`;
  Zeile 127-138 Tagesfelder (`<input type="number">`); Zeile 146-151 Summenkarte
  (`text-lg font-bold`); Zeile 159-162 Abweichungswarnung `⚠️ Summe weicht von Wochenstunden
  ({weeklyHours}h) ab!` — wortgleich für den neuen Dialog zu übernehmen (D-Vorgabe der
  UI-SPEC).
- `OvertimeTransactions.tsx:78-146` die drei Zuordnungsfunktionen `getTypeLabel`,
  `getTypeDescription`, `getTypeBadgeColor`, `isAbsenceType` — neuer `case 'model_change':`
  Zweig in allen dreien, siehe Code-Auszug oben unter Abschnitt „Core Pattern".

---

### 12. Hook-Schicht: `desktop/src/hooks/useWorkTimeChange.ts` (neu)

**Analoga:** `desktop/src/hooks/useVacationBalanceAdmin.ts` (`useUpsertVacationBalance`,
Zeile 118-133) und `desktop/src/hooks/useOvertimeCorrections.ts`
(`useCreateOvertimeCorrection`, Zeile 121 ff.) — beide nutzen `apiClient` aus
`desktop/src/api/client.ts`, der intern `universalFetch` aus `../lib/tauriHttpClient`
verwendet (Zeile 2 der Datei) — die Tauri-Session-Regel ist dort bereits zentral gelöst, ein
Aufrufer muss nicht selbst `universalFetch` importieren, solange er über `apiClient` geht.

```typescript
// desktop/src/hooks/useVacationBalanceAdmin.ts:118-133
export function useUpsertVacationBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: VacationBalanceCreateInput) => {
      const response = await apiClient.post<VacationBalance>('/vacation-balances', data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create vacation balance');
      }
      return response.data;
    },
    // onMutate: optimistisches Update — für Phase 12 NICHT nötig/sinnvoll, da der
    // Speichern-Button ohnehin an ein gültiges previewToken gebunden ist (D2) und ein
    // optimistisches Update den angezeigten Saldo vorwegnähme, den der Server erst
    // bestätigen muss.
```

Für die Perioden-Leseliste (`WorkTimePeriodList`) ist `useQuery`-Muster aus
`useVacationBalances` (Zeile 45-65) zu kopieren: `queryKey`, `apiClient.get(...)`,
`retry: false`.

---

### 13. WR-12-Nachzug (Phase-11-Erbe): Desktop-Berechnungsdateien

**Betroffene Dateien laut `11-DESKTOP-DISPOSITION.md`:**
`desktop/src/utils/timeUtils.ts:213-247`, `desktop/src/components/absences/
AbsenceRequestForm.tsx:64-76`, `desktop/src/components/worktime/
WorkScheduleDisplay.tsx:41-67`, `desktop/src/components/users/WorkScheduleEditor.tsx:44`
(Re-Export über `desktop/src/utils/index.ts`).

**Server-Gegenstück, an dem sich der Umbau ausrichten muss:**
```typescript
// server/src/utils/workingDays.ts:240-245
export function calculateAbsenceHoursWithWorkSchedule(
  user: UserPublic,
  startDate: string,
  endDate: string,
  periods: WorkPeriodContext
): number {
```
gegenüber der heutigen Desktop-Signatur:
```typescript
// desktop/src/utils/timeUtils.ts:213-218
export function calculateAbsenceHoursWithWorkSchedule(
  startDate: string,
  endDate: string,
  workSchedule: WorkSchedule | null | undefined,
  weeklyHours: number
): number {
```
**Kernbefund:** Der Server löst die Periode selbst auf (`periods: WorkPeriodContext`
Parameter, siehe `workPeriodContext.ts`), der Desktop bekommt `workSchedule`/`weeklyHours`
bereits aufgelöst. Ein periodengetreuer Umbau des Desktops erfordert entweder (a) einen neuen
API-Aufruf, der die zum Datum gültige Periode auflöst (nutzt die neue Perioden-Lese-API aus
Abschnitt 4 dieses Dokuments), oder (b) das Mitgeben mehrerer Perioden an den Aufrufer und
eine Client-seitige Auflösung nach demselben Intervallschema wie
`resolveWorkPeriodIn()` (`server/src/services/workPeriodService.ts:241-251`:
`period.validFrom <= date && (period.validTo === null || period.validTo > date)`) — **wenn
eine Client-seitige Auflösung gewählt wird, MUSS exakt dieselbe Intervalllogik verwendet
werden, sonst entsteht erneut ein Dual-Calculation-Risiko.** Das ist eine Entscheidung für die
Planung, kein vorgegebenes Muster — `11-DESKTOP-DISPOSITION.md` benennt nur die
Voraussetzung (Lese-API), nicht die Umbaumethode.

**`AbsenceRequestForm.tsx` Aufrufstelle (heute):**
```typescript
// desktop/src/components/absences/AbsenceRequestForm.tsx:64-69
const hours = calculateAbsenceHoursWithWorkSchedule(
  startDate,
  endDate,
  selectedUser.workSchedule,
  selectedUser.weeklyHours
);
```
Laut `11-DESKTOP-DISPOSITION.md` (Zeile 165-181) ist dieser Wert reine UI-Vorschau ohne
Persistenzwirkung (`requiredHours` geht NICHT in `createRequest.mutateAsync(...)`) — der
Umbau ist ein UX-Korrektheitsthema, kein Datenrisiko.

**`WorkScheduleDisplay.tsx` — reiner Anzeigepfad, kein Datumsparameter:**
```typescript
// desktop/src/components/worktime/WorkScheduleDisplay.tsx:42-58
const scheduleData = useMemo(() => {
  const hasIndividualSchedule = !!user.workSchedule;
  if (hasIndividualSchedule && user.workSchedule) {
    const schedule = user.workSchedule;
    // ...
  } else {
    const dailyHours = user.weeklyHours / 5;
```
Zeigt ausschließlich den **heutigen** Stand — kein Widerspruchsrisiko zum Server für
vergangene Zeiträume, weil die Komponente für die Vergangenheit nichts behauptet
(`11-DESKTOP-DISPOSITION.md` Zeile 210-216, hier bestätigt).

---

### 14. Tests

**`desktop/tests/user-edit.spec.ts`** — Analog ist der bestehende Test selbst
(„Change employee to 0 hours", Zeile 85-115). Der Selektor `[name="weeklyHours"]` wird gegen
das schreibgeschützte Feld hart fehlschlagen (`readOnly` verhindert `page.fill()`); die
UI-SPEC schreibt bereits exakt vor, wie umzuschreiben ist (Umleitung über den neuen
Wechsel-Dialog, plus Reparatur des kaputten Selektors `button[aria-label="Bearbeiten"]` →
`button:has-text("Bearbeiten")` — **nur in diesem einen Test**, kein Aufräumfeldzug über die
übrigen sieben Vorkommen).

**Server-Testmuster:** `server/src/services/workPeriodService.test.ts` (Kopf gelesen,
Zeile 1-40) — Vorbild für den neuen `workPeriodChangeService.test.ts`: läuft gegen die
geteilte Verbindung aus `connection.js` (kein `:memory:`), Fixtures je Test mit eindeutigem
`username`, Aufräumen über `DELETE FROM users WHERE id = ?` (CASCADE räumt Perioden ab).
Direkter Aufruf von `resolveWorkPeriodAt()`/`createWorkPeriod()` statt Nachbau der
Auflösungslogik — dieselbe Disziplin gilt für Tests des neuen Service.

---

## Shared Patterns

### A. Auth/Rollen-Middleware
**Quelle:** `server/src/middleware/auth.ts` (`requireAuth`, `requireAdmin`).
**Anwenden auf:** `POST .../save`, `GET .../preview`, `GET workPeriods` (Lese-Route erlaubt
ggf. auch Employee-Eigenzugriff nach dem Muster aus `vacationTransactions.ts:38-48` — Admin
darf fremde `userId`, Employee nur die eigene, sonst 403).

```typescript
router.post('/save', requireAuth, requireAdmin, (req, res) => { /* ... */ });
```

### B. `ApiResponse`-Hülle und Fehlerantwort
**Quelle:** durchgängig in `server/src/routes/*.ts` (`{ success: true, data }` /
`{ success: false, error }`), Typ `ApiResponse` aus `server/src/types/index.ts`.
**Anwenden auf:** alle drei neuen Server-Routen.

### C. Buchungsmuster mit Pflichtbegründung (D5)
**Quelle:** `server/src/services/vacationTransactionService.ts:364-437`
(`recordVacationTransaction`).
**Anwenden auf:** die eine `model_change`-Buchung, die `workPeriodChangeService.ts` erzeugt.

### D. `db.transaction()`-Klammerung (D7)
**Quelle:** `server/src/services/overtimeTransactionManager.ts:134-140`
(`createTransactionsBatch`), Kopfkommentar-Regel „bleibt synchron" aus
`vacationTransactionService.ts:24-28` und `workPeriodService.ts:58-60`.
**Anwenden auf:** `workPeriodChangeService.ts` — Periode schließen/anlegen, Rebuild-Ausschnitt,
Buchung, alles in einer Klammer.

### E. `universalFetch`/`apiClient` Pflicht (Tauri)
**Quelle:** `desktop/src/api/client.ts:2` (`import { universalFetch } from
'../lib/tauriHttpClient'`), durchgängig verwendet von allen Hooks in `desktop/src/hooks/`.
**Anwenden auf:** jeder neue Desktop-Datenzugriff — niemals rohes `fetch()`.

### F. Zeitzonen-sichere Datumsanzeige
**Quelle:** `desktop/src/components/worktime/OvertimeTransactions.tsx:215`
(`new Date(transaction.date + 'T12:00:00').toLocaleDateString('de-DE')`).
**Anwenden auf:** `WorkTimePeriodList.tsx`, `WorkTimeChangeModal.tsx`, jede neue
Datumsdarstellung. Server-seitig gilt das Gegenstück `formatDateBerlin()` aus
`server/src/utils/timezone.ts` (nirgends `toISOString().split('T')[0]` oder `new
Date('YYYY-MM-DD')` ohne Zeitanteil).

### G. Modal-Primitiv-Verwendung
**Quelle:** `desktop/src/components/corrections/OvertimeCorrectionModal.tsx` (vollständig).
**Anwenden auf:** `WorkTimeChangeModal.tsx` — `<Modal size="lg">`, `<form
onSubmit className="space-y-6">`, `flex justify-end gap-3` Aktionszeile,
`Button type="button" variant="secondary"` für Abbrechen, Ladezustand via
`<LoadingSpinner size="sm" />` im Primärbutton.

### H. Soft-Delete / Prepared Statements
**Quelle:** durchgängig `db.prepare(...).run(...)` mit Platzhaltern (kein String-Concat),
Soft-Delete-Muster `WHERE deletedAt IS NULL` (z. B. `overtimeCorrectionsService.ts:37`,
`workPeriodService.ts:495`). `user_work_periods` selbst kennt keinen Soft-Delete (Perioden
werden über `validTo` geschlossen, nicht gelöscht) — das ist bereits das korrekte Muster für
Phase 12, kein Soft-Delete auf `user_work_periods` einführen.

---

## No Analog Found

| Datei/Baustein | Rolle | Datenfluss | Begründung |
|---|---|---|---|
| `desktop/src/components/ui/modalStack.ts` | utility | Modul-State (Stack) | Kein `createPortal`, kein Modal-Stack-Konzept irgendwo im Bestand (von `12-UI-SPEC.md` selbst bestätigt, Zeile 410-411). Die UI-SPEC liefert die vollständige Signatur — dort nachschlagen, kein Codeanalog verfügbar. |
| Zustandsloses, signiertes `previewToken` (D2, 15 Min. Gültigkeit) | Konzept, kein einzelner Dateiort | — | Kein bestehendes Signatur-/Token-Schema im Projekt (Sessions laufen über `req.session`, keine eigens ausgestellten, zeitlich begrenzten Tokens). Muss neu entworfen werden — HMAC über die vier gebundenen Felder + Zeitstempel mit `SESSION_SECRET` ist der naheliegende Ansatz, aber ohne Bestandsvorbild. |

**Wichtiger Grenzfall, kein vollständiges „kein Analog", aber mit Einschränkung:**
`previewYearEndRollover()`/`performYearEndRollover()` teilen sich nicht dieselbe Codebahn
(siehe Abschnitt 3) — als Vorbild für „Route + Auth + Parametervalidierung" geeignet, als
Vorbild für „D2: exakt dieselbe Berechnung für Vorschau und Speichern" ausdrücklich
**ungeeignet**. Die Planung muss hierfür einen neuen, echten Dry-Run-Mechanismus im neuen
Service selbst entwerfen.

---

## Metadata

**Analog-Suchbereich:** `server/src/services/`, `server/src/routes/`,
`server/src/database/migrations/`, `server/src/database/schema.ts`, `desktop/src/components/`,
`desktop/src/hooks/`, `desktop/src/utils/`, `desktop/tests/`.
**Dateien gelesen (vollständig oder gezielter Ausschnitt):** 24
(`workPeriodService.ts`, `workPeriodContext.ts`, `vacationTransactionService.ts`,
`vacationTransactions.ts` (Route), `overtimeTransactionManager.ts`,
`overtimeCorrectionsService.ts`, `overtimeTransactionRebuildService.ts` (Kopf),
`overtime.ts` (Route, Ausschnitte), `workTimeAccounts.ts` (Route, Ausschnitte),
`yearEndRollover.ts` (Route), `yearEndRolloverService.ts` (Ausschnitt),
`migrations/002_extend_transaction_types.ts`, `migrations/006_add_time_entry_transaction_type.ts`,
`migrationRunner.ts`, `schema.ts` (Ausschnitt), `schemaMigrationParity.test.ts` (Kopf),
`workPeriodService.test.ts` (Kopf), `workingDays.ts` (Ausschnitt), `auth.ts` (Middleware,
Ausschnitt), `OvertimeCorrectionModal.tsx`, `VacationBalanceEditModal.tsx`,
`useVacationBalanceAdmin.ts` (Ausschnitt), `client.ts` (Ausschnitt), `Modal.tsx`,
`ConfirmDialog.tsx`, `Input.tsx`, `Button.tsx`, `EditUserModal.tsx`, `WorkScheduleEditor.tsx`,
`OvertimeTransactions.tsx` (Ausschnitt), `UserManagementPage.tsx` (Ausschnitte),
`timeUtils.ts` (Ausschnitt), `AbsenceRequestForm.tsx` (Ausschnitt),
`WorkScheduleDisplay.tsx` (Ausschnitt)).
**Pattern-Extraktion:** 2026-08-22
