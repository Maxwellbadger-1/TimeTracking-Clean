# Phase 13: Korrigieren und rückgängig machen - Pattern Map

**Mapped:** 2026-08-22
**Files analyzed:** 16 (7 Server neu/geändert, 8 Desktop neu/geändert, 1 Migration)
**Analogs found:** 14 / 16 (2 ohne echtes Bestandsanalog, ausdrücklich vermerkt)

Es gibt keine RESEARCH.md für diese Phase (Research deaktiviert). Die Dateiliste ist aus
`13-CONTEXT.md` (D1–D7) und `13-UI-SPEC.md` (Abschnitte „Bildschirme und Komponenten“,
„Änderungen an Bestandskomponenten“, „Datenvertrag“) abgeleitet. **Wichtigste Erkenntnis
dieser Kartierung: Phase 12 hat für exakt diese Aufgabe (Periode ändern + Rebuild + eine
Buchung, alles in einer Transaktion, mit geteiltem Preview/Save-Pfad) bereits die vollständige
Blaupause gebaut.** `applyWorkTimeChange()` und `workTimeChangeToken.ts` sind keine losen
Analoga, sondern strukturell fast deckungsgleich mit dem, was D6/D7 aus `13-CONTEXT.md`
verlangen. Die Planung sollte prüfen, ob eine Erweiterung dieser beiden Dateien (neue
Modi/Funktionen) tragfähiger ist als zwei komplett neue Dateien — beides ist unten als Option
vermerkt.

**Korrektur seit 12-PATTERNS.md / 12-VERIFICATION.md:** Der Stand von Phase 12 wurde nicht aus
den dortigen Berichten übernommen, sondern am aktuellen Code erneut gegengelesen (Stichtag
22.08.2026, HEAD nach Phase 12). Zwei Abweichungen von den Pfaden im Auftrag:
- `desktop/src/lib/modalStack.ts` existiert **nicht** — die Datei liegt unter
  `desktop/src/components/ui/modalStack.ts`, ergänzt um `desktop/src/components/ui/useModalLayer.ts`
  (gemeinsame Fokusfallen-/Stack-Logik für `Modal` und `ConfirmDialog`, seit dem Phase-12-Review
  extrahiert).
- Die in `12-UI-SPEC.md` zitierten Zeilennummern in `OvertimeTransactions.tsx` (159/227/282)
  stimmen mit dem heutigen Stand **nicht mehr überein** — die Datei hat sich seither verändert.
  Die Zeilennummern in diesem Dokument sind gegen den tatsächlichen Stand vom 22.08.2026
  verifiziert.

---

## File Classification

| Neue/geänderte Datei | Rolle | Datenfluss | Nächstes Analog | Trefferqualität |
|---|---|---|---|---|
| `server/src/database/migrations/013_...ts` (neu, `deletedAt` auf `user_work_periods`) | migration | Schema-Änderung, Spalte hinzufügen | `server/src/database/migrations/011_add_model_change_transaction_type.ts` (Tabellen-Neubau-Technik) + Suche nach einem reinen `ALTER TABLE ADD COLUMN`-Muster für `deletedAt` | exact (Technik), kein 1:1-Vorbild für „Spalte zu bereits durch Trigger geschützter Tabelle hinzufügen“ |
| `server/src/database/migrations/014_...ts` (neu, `reversalOf`/`reversedBy`/`reversedAt`/`referenceId` auf `overtime_transactions`) | migration | Schema-Änderung, Selbstreferenz | `server/src/database/migrations/011_add_model_change_transaction_type.ts` / `012_fix_reference_type_check_constraint.ts` (Tabellen-Neubau-Technik) | Technik exact, Konzept „Selbstreferenz zweier Buchungszeilen“ **kein Analog** |
| `server/src/database/schema.ts` (Parity-Pflicht für beide Migrationen) | config/schema | — | sich selbst | exact (Parity-Pflicht, wie Migration 011/012 es vormachen) |
| `server/src/services/workPeriodChangeService.ts` (erweitert **oder** neue Datei `workPeriodCorrectionService.ts`) — Korrektur (D1/D6/D7) | service | CRUD + begrenzter Rebuild, atomar, Dry-Run/Save geteilt | **sich selbst** (`applyWorkTimeChange()`, Zeile 308-618) | exact — strukturell fast deckungsgleiches Problem |
| `server/src/services/workPeriodChangeService.ts` (erweitert) — Löschen (D2/D3/D4/D6/D7) | service | Soft-Delete + Gegenbuchung + begrenzter Rebuild, atomar | `applyWorkTimeChange()` (Rebuild/Transaktions-Rahmen) **kombiniert mit** `server/src/services/absenceService.ts` `revertBalancesAfterDeletion()` (Zeile 1336-1373, Gegenbuchungsmuster mit `reason`) | Verbund-Analog |
| `server/src/services/workTimeChangeToken.ts` (erweitert um Korrektur-/Lösch-Bindung, **oder** neue Bindungstypen) | utility | Signatur/Verifikation, zustandslos | **sich selbst** (vollständig, 189 Zeilen) | exact |
| `server/src/routes/workPeriods.ts` (erweitert um 4 Endpunkte: `POST /:id/correct/preview`, `PUT /:id`, `POST /:id/delete/preview`, `DELETE /:id`) | route | request-response, Dry-Run + Write | **sich selbst** (`POST /preview`, `POST /change`, Zeile 118-305) | exact |
| `server/src/services/workPeriodChangeService.test.ts` (erweitert) **oder** neue Testdatei | test | — | sich selbst (Kopf Zeile 1-60) | exact |
| `desktop/src/components/worktime/WorkTimePeriodEditModal.tsx` (neu) | component (Modal) | request-response, Formular + Mutation, Dry-Run/Save | `desktop/src/components/worktime/WorkTimeChangeModal.tsx` (vollständig, 870 Zeilen) | exact |
| `desktop/src/components/ui/ConfirmDialog.tsx` (geändert, 5 neue Props + Farbangleichung) | component (Primitive) | — | sich selbst (vollständig gelesen, 112 Zeilen) | exact (additiv) |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` (geändert, `accessDenied`/`footnote`, `renderActions` wird gesetzt) | component (Liste) | request-response, read-only | sich selbst (vollständig gelesen, 183 Zeilen) | exact (additiv) — `renderActions`-Andockpunkt existiert bereits vollständig |
| `desktop/src/components/worktime/OvertimeTransactions.tsx` (geändert, Storno-Badges/Beleg-Chip/Sprungmarke) | component (Liste) | — | sich selbst (vollständig gelesen, 341 Zeilen) | exact (additiv) |
| `desktop/src/components/users/EditUserModal.tsx` (geändert, Korrekturblock/Fußnote/Dialogsteuerung) | component (Modal) | — | sich selbst (Zeile 280-489 gelesen) | exact (additiv) — Andockstelle nach `WorkTimePeriodList` bereits vorhanden (Zeile 378-387) |
| `desktop/src/api/client.ts` (geändert, 403-Ausnahme präzisieren, `console.log` entfernen, Green-Server-Probe entfernen) | utility/HTTP-Client | — | sich selbst (vollständig gelesen, 283 Zeilen) | exact — **403-Ausnahme für `/work-periods*` existiert bereits** (Zeile 194), nur „schreibende Endpunkte einschließen“ ist schon erfüllt |
| `desktop/src/hooks/useWorkTimeChange.ts` (erweitert um `useCorrectWorkPeriod`, `useDeleteWorkPeriodPreview`, `useDeleteWorkPeriod`) | hook | request-response (Query + Mutation) | sich selbst (vollständig gelesen, 80 Zeilen) | exact |
| `desktop/src/types/index.ts` + `server/src/types/index.ts` (erweitert um `isFirst`/`isCurrent` auf `WorkTimePeriod`) | types | — | sich selbst | exact (additiv), **aktuell nicht vorhanden — verifiziert per grep, 0 Treffer** |

---

## Pattern Assignments

### 1. Server-Schreibweg „Korrigieren“ — Erweiterung von `workPeriodChangeService.ts`

**Rolle:** service, CRUD + begrenzter Rebuild, atomar, Dry-Run/Save über dasselbe Flag.

**Analog: die Datei selbst.** `applyWorkTimeChange()` (`server/src/services/workPeriodChangeService.ts:308-618`)
ist praktisch die fertige Vorlage für „Stammdaten korrigieren“:

- **Fehlerklasse-Muster** (Zeile 106-111):
```typescript
export class WorkTimeChangeValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkTimeChangeValidationError';
  }
}
```
Für die Korrektur ggf. eine eigene `WorkPeriodCorrectionValidationError`, damit die serverseitige
Trennung aus D1 auch in den Fehlerklassen sichtbar bleibt — kein gemeinsamer Fehlertyp mit
Modus-Flag, genau wie D1 es für den Endpunkt verlangt.

- **Dry-Run/Save-Weiche über EIN Flag, kein zweiter Rechenweg** (Zeile 119-124, 600-618):
```typescript
class PreviewRollback extends Error {
  constructor(readonly outcome: WorkTimeChangeOutcome) {
    super('Trockenlauf abgeschlossen — die Transaktion wird absichtlich zurückgerollt.');
    this.name = 'PreviewRollback';
  }
}
// ...
if (options.dryRun) {
  throw new PreviewRollback({ preview, period: null, transactionId: null });
}
return { preview, period: newPeriod, transactionId };
// ...
try { return run(); }
catch (err) {
  if (err instanceof PreviewRollback) return err.outcome;
  throw err;
}
```
Dieses Muster ist REQ-27-Analog: „die Vorschau zeigt denselben Wert, der danach im Konto steht“ —
in Phase 13 exakt dieselbe Anforderung für die Korrektur-Vorschau (Datenvertrag „Korrektur-Vorschau“
verlangt `previewToken`, `balanceBefore/After/Delta` — identisch zur Struktur von `WorkTimeChangePreview`).

- **Pflichtbegründung nur im Speicherpfad, nicht im Dry-Run** (Zeile 276-299, D7 aus 13-CONTEXT
  deckt sich mit D5 aus 12-CONTEXT):
```typescript
if (!dryRun) {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new WorkTimeChangeValidationError('Begründung ist erforderlich');
  }
  const trimmedReason = input.reason.trim();
  if (trimmedReason.length < 10) {
    throw new WorkTimeChangeValidationError('Begründung muss mindestens 10 Zeichen lang sein');
  }
  if (trimmedReason.length > MAX_REASON_LENGTH) { /* ... */ }
  if (containsControlCharacters(trimmedReason)) { /* ... */ }
}
```
Wortgleich für die Korrektur übernehmbar (13-UI-SPEC Textbuch: „Begründung ist erforderlich“,
„Begründung muss mindestens 10 Zeichen lang sein“ — identische deutsche Meldungen).

- **Transaktionsklammer + `db.transaction()`** (Zeile 312, 608): der gesamte Vorgang läuft in
  einer einzigen `run = db.transaction((): WorkTimeChangeOutcome => {...})`-Funktion — direkte
  Blaupause für D6 aus `13-CONTEXT.md` („Bearbeiten und Löschen laufen in einer Transaktion“).

**Unterschied zur Korrektur, den die Planung entscheiden muss:** `applyWorkTimeChange()` erzeugt
eine **neue** Periode (Split der bestehenden). Die Korrektur aus Phase 13 ändert laut D1 eine
**bestehende** Periode rückwirkend — kein Split, kein `createWorkPeriod`. Der richtige Baustein
dafür existiert bereits fertig in `workPeriodService.ts`:

```typescript
// server/src/services/workPeriodService.ts:365-387
export function updateWorkPeriodValues(
  periodId: number,
  weeklyHours: number,
  workSchedule: WorkSchedule | null
): UserWorkPeriod { /* UPDATE user_work_periods SET weeklyHours = ?, workSchedule = ? WHERE id = ? */ }

// server/src/services/workPeriodService.ts:400-423
export function setWorkPeriodValidFrom(periodId: number, validFrom: string): UserWorkPeriod {
  /* UPDATE user_work_periods SET validFrom = ? WHERE id = ? */
}
```
Diese beiden Funktionen sind schon der „ein Schreibweg“-Baustein (kein rohes SQL nötig) — die
neue Korrektur-Funktion in `workPeriodChangeService.ts` ruft sie auf, statt `closeWorkPeriod` +
`createWorkPeriod` zu verwenden. **Wichtig:** `setWorkPeriodValidFrom()` trägt laut eigenem
Kopfkommentar (Zeile 390-399) die Einschränkung „bewusst KEIN allgemeines Periode verschieben“ —
sie wurde bisher nur für das Vorverlegen des `hireDate` verwendet. Die Planung muss prüfen, ob
diese Funktion für den in 13-UI-SPEC beschriebenen Fall „`validFrom` einer normalen Periode wird
verschoben, die Vorperiode wächst/schrumpft mit“ ausreicht, oder ob eine begleitende Anpassung der
Vorperiode (`closeWorkPeriod` auf die Vorperiode) im selben Aufruf nötig ist — die Trigger aus
Migration 008 (Überlappungs-/Lückenschutz) weisen jede Inkonsistenz ohnehin ab, `translateWorkPeriodError()`
übersetzt den Fehler.

**Rebuild-Baustein:** identisch zu Phase 12 — `rebuildOvertimeTransactionsForMonth()`
(`server/src/services/overtimeTransactionRebuildService.ts`), aufgerufen für `monthsInRange(rangeStart, rangeEnd)`
wie in `applyWorkTimeChange()` Zeile 350/381/454. D4 aus `13-CONTEXT.md` („Neuberechnung ab Beginn
der betroffenen Periode“) ist exakt D3 aus `12-CONTEXT.md` — dieselbe Funktion, derselbe Bereich
(`validFrom` der Periode bis heute).

---

### 2. Server-Schreibweg „Löschen“ — Gegenbuchung statt Löschung

**Rolle:** service, Soft-Delete + Gegenbuchung + begrenzter Rebuild, atomar.

**Zwei Analoga, kombiniert:**

**(a) `applyWorkTimeChange()`** liefert Transaktionsrahmen, Rebuild-Schleife und das
`db.transaction()`-Muster (siehe oben).

**(b) `server/src/services/absenceService.ts` — `revertBalancesAfterDeletion()`** (Zeile 1327-1373)
ist das einzige Bestandsmuster für „Storno statt Löschung, mit `reason`-Parameter“ — genau das,
was `13-CONTEXT.md` (Abschnitt „Existing Code Insights“) ausdrücklich als wiederzuverwendendes
Vorbild aus Milestone v2.0 nennt:

```typescript
// server/src/services/absenceService.ts:1336-1362
function revertBalancesAfterDeletion(
  requestId: number,
  actorId: number | null,
  reason: 'rejected' | 'deleted'
): void {
  const request = getAbsenceRequestById(requestId);
  if (!request) return;
  // ...
  const reasonLabel = reason === 'rejected' ? 'Ablehnung' : 'Löschung';
  recordVacationTransaction({
    userId: request.userId,
    year,
    date: request.startDate,
    type: 'vacation_reverted',
    days: request.days, // positiv: Gutschrift — GEGENBUCHUNG, kein UPDATE des Alt-Werts
    description: `Urlaub ${request.startDate} bis ${request.endDate} storniert (${reasonLabel})`,
    referenceType: 'absence',
    referenceId: request.id,
    createdBy: actorId,
  });
}
```
Kernprinzip 1:1 übertragbar: Die **Originalbuchung bleibt unverändert stehen** (kein UPDATE ihres
`hours`-Werts), eine **neue Buchung mit umgekehrtem Vorzeichen** neutralisiert sie. Das deckt sich
wörtlich mit `13-UI-SPEC.md`: „Der Stundenwert der Originalzeile bleibt unverändert stehen — kein
Durchstreichen, keine Ausgrauung.“

**Was dieses Analog NICHT abdeckt (D2, „Storno-Geschichte bleibt sichtbar mit erkennbarem
Bezug“):** `vacation_reverted` markiert die Gegenbuchung nur über ihren `type` und
`referenceType`/`referenceId` (zeigt auf den `absence_request`, nicht auf die stornierte
Transaktion selbst). Es gibt **keine Selbstreferenz zwischen zwei `overtime_transactions`-Zeilen**
im gesamten Bestand — weder `reversalOf` noch `reversedBy` noch eine geteilte „Belegnummer“
existieren heute (verifiziert per grep über `schema.ts`, `overtimeTransactionManager.ts`,
`server/src/types/index.ts` — 0 Treffer außer dem bereits belegten `referenceId`, das auf eine
FREMDE Entität zeigt, z. B. `work_period`, nicht auf eine andere Buchungszeile). **Das ist ein
echtes Konzept-Novum dieser Phase, kein Bestandsmuster — siehe „No Analog Found“.**

**Lückenschluss (D3):** kein eigenes Bestandsmuster nötig — `closeWorkPeriod()`
(`server/src/services/workPeriodService.ts:330-350`) auf die Vorperiode angewendet (ihr `validTo`
wird auf das `validTo` der gelöschten Periode gesetzt) ist exakt der Baustein, den Phase 12 schon
für den Stichtagswechsel verwendet — hier nur in umgekehrter Richtung (Vorperiode wächst, statt
eine neue Periode einzufügen).

**Sonderfall erste Periode (D3, „hat keine Vorgängerin“):** `checkAllPeriodChains()`
(`workPeriodService.ts:509 ff.`) iteriert bereits über alle Nutzer und deren `hireDate` — als
Fundstelle dafür, wie „die erste Periode eines Nutzers“ im Bestand identifiziert wird
(`validFrom === user.hireDate` bzw. die Periode ohne Vorgänger in der sortierten Liste). Kein
eigenes „ist erste Periode“-Flag existiert heute in `UserWorkPeriod` — muss wie `isFirst` (siehe
Abschnitt 6) neu berechnet und ausgeliefert werden.

---

### 3. Soft-Delete auf `user_work_periods` — Migration + Zusammenspiel mit dem DELETE-Trigger

**Rolle:** migration, Schema-Änderung.

**Wichtiger Befund, der die Planung unmittelbar betrifft:** `user_work_periods` hat **aktuell
keine `deletedAt`-Spalte** (verifiziert: `SELECT_COLUMNS` in `workPeriodService.ts:80-82` führt
sie nicht, `schema.ts:271-290` (CREATE TABLE) ebenfalls nicht). D2 aus `13-CONTEXT.md`
(„Soft-Delete statt `DELETE`, Projektregel“) verlangt aber genau diese Spalte — **eine neue
Migration ist zwingend Teil dieser Phase**, keine reine Anwendungsänderung.

**Zusätzlich existiert bereits ein `BEFORE DELETE`-Trigger** auf dieser Tabelle
(`trg_user_work_periods_delete_guard`, Definition in
`server/src/database/migrations/008_create_user_work_periods.ts:81-96`, nachgerüstet in
Migration 010), der ein echtes `DELETE` auf `user_work_periods` verweigert, wenn es den Nutzer
periodenlos zurückließe oder eine Lücke aufrisse:
```sql
-- server/src/database/migrations/008_create_user_work_periods.ts:81-90 (Ausschnitt)
CREATE TRIGGER IF NOT EXISTS trg_user_work_periods_delete_guard
BEFORE DELETE ON user_work_periods
BEGIN
  SELECT RAISE(ABORT, 'user_work_periods: Löschen würde den Nutzer ohne jede Periode zurücklassen')
  WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)
    AND NOT EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = OLD.userId AND p.id <> OLD.id);
  SELECT RAISE(ABORT, 'user_work_periods: Löschen würde eine Lücke in der Periodenkette hinterlassen')
  WHERE OLD.validTo IS NOT NULL /* ... */;
```
**Konsequenz für die Planung:** Dieser Trigger feuert **nur bei echtem `DELETE`**, nicht bei einem
`UPDATE ... SET deletedAt = ...` (Soft-Delete). Die Planung darf sich für D3 (Lückenschutz beim
Soft-Delete) **nicht** auf diesen Trigger verlassen — die Lückenschluss-Logik (Vorperiode über
`closeWorkPeriod()` erweitern, siehe Abschnitt 2) muss **vor** dem Setzen von `deletedAt`
denselben Effekt manuell herstellen, den der Trigger bei einem echten `DELETE` erzwingen würde.
Der Trigger bleibt als Sicherheitsnetz für den (in dieser Phase nicht vorgesehenen) Fall eines
echten `DELETE` bestehen — er muss nicht angepasst werden, solange kein Code-Pfad ein echtes
`DELETE FROM user_work_periods` ausführt (D2 verbietet das ohnehin ausdrücklich).

**Migrations-Technik-Vorbild** (reiner `ALTER TABLE ADD COLUMN`, kein Tabellen-Neubau nötig, weil
keine `CHECK`-Liste erweitert wird — anders als Migration 006/011/012):
Kein Bestandsbeispiel für ein einfaches `ALTER TABLE ... ADD COLUMN deletedAt TEXT` auf einer
Tabelle mit aktiven Triggern wurde gefunden; die Technik selbst (Vorher/Nachher-Zeilenzahl,
Selbstverifikation, `logger.info`) ist aber durchgängiges Muster aller Migrationen ab 006
(`006_add_time_entry_transaction_type.ts`, `010_fix_user_work_periods_delete_guard.ts`). Migration
010 zeigt zusätzlich das Muster „Selbstverifikation nach der Änderung, sonst wird die Migration
NICHT als angewendet markiert“ (Zeile 60-82) — direkt für die neue Migration übertragbar (prüfen,
dass `PRAGMA table_info(user_work_periods)` die neue Spalte enthält).

**Parity-Pflicht:** `server/src/database/schema.ts:271-290` (CREATE TABLE) muss dieselbe Spalte
erhalten wie die Migration — wortgleiche Regel wie bei Migration 011 (siehe dortiger
Kopfkommentar „PARITY-PFLICHT“).

**Nächste freie Migrationsnummer:** `013` (höchste vorhandene: `012_fix_reference_type_check_constraint.ts`).
Registrierung erfolgt automatisch — `migrationRunner.ts` lädt jede `*.ts`-Datei im Ordner
alphabetisch (kein manuelles Eintragen).

---

### 4. Selbstreferenz für das Storno-Paar — `overtime_transactions` erweitern

**Rolle:** migration, Schema-Änderung (Selbstreferenz).

**Kein Analog im Bestand** (siehe Abschnitt 2). Der Datenvertrag aus `13-UI-SPEC.md`
(„Kontoauszug — zusätzlich je Transaktion: `id`, `referenceId`, `reversalOf|null`,
`reversedBy|null`, `reversedAt|null`, `reversedByName|null`, ...“) verlangt mindestens:

1. Eine neue Spalte (z. B. `reversalOf INTEGER REFERENCES overtime_transactions(id)`) auf der
   Gegenbuchung, die auf die stornierte Originalzeile zeigt.
2. **Namenskollision zu beachten:** `overtime_transactions.referenceId` ist bereits belegt — es
   zeigt auf die FREMDE Entität, die die Buchung ausgelöst hat (`work_period`, `time_entry`,
   `absence`, ...), siehe `referenceType`-CHECK (`schema.ts:517-523`, erweitert in Migration
   011/012). Der in der UI-SPEC verwendete Begriff „gemeinsame Belegnummer“ (`referenceId` auf
   BEIDEN Zeilen des Storno-Paars) ist ein **anderes Konzept** als das bestehende `referenceId`
   und darf nicht in dieselbe Spalte geschrieben werden, ohne die bestehende Bedeutung zu
   überladen. Die Planung muss hier entweder (a) eine neue Spalte einführen (z. B.
   `receiptId`/eigener Belegzähler) oder (b) begründen, warum das bestehende `referenceId` beide
   Zeilen tragen kann, ohne den Read-Pfad für `work_period`-Referenzen zu brechen — dieser Konflikt
   ist ausdrücklich ungelöst und gehört in den Plan.
3. `reversedAt`/`reversedByName` sind laut Datenvertrag reine Anzeigefelder — sie lassen sich
   wahrscheinlich aus `createdAt`/`createdBy` der GEGENBUCHUNG ableiten (join `users` für den
   Namen), ohne redundante Spalten auf der Originalzeile. Das ist eine Entscheidung für die
   Planung, kein vorgegebenes Muster.

**Technik:** Tabellen-Neubau nach dem Muster von Migration 011/012 (`server/src/database/migrations/012_fix_reference_type_check_constraint.ts`,
vollständig gelesen, 152 Zeilen) — Zeilenzahl-Vergleich vor/nach, `DROP`/`RENAME`, Indizes neu
anlegen. Falls nur eine reine `ADD COLUMN` ohne `CHECK`-Änderung nötig ist, genügt (wie bei der
Migration aus Abschnitt 3) ein einfaches `ALTER TABLE ADD COLUMN` ohne Tabellen-Neubau.

**Nächste freie Nummer:** `014`, falls Abschnitt 3 als `013` läuft (Reihenfolge innerhalb der
Planung frei wählbar, muss aber alphabetisch nach `012` einsortiert und lückenlos nummeriert sein
— Muster aus dem gesamten `migrations/`-Ordner).

---

### 5. `server/src/routes/workPeriods.ts` — neue Endpunkte (D5, D6)

**Analog: die Datei selbst.** `POST /preview` und `POST /change` (Zeile 118-305) sind die fertige
Vorlage für alle vier neuen Endpunkte (Korrektur-Vorschau, Korrektur-Speichern,
Lösch-Vorschau, Löschen):

```typescript
// server/src/routes/workPeriods.ts:167-174 (Auth+Rollen-Muster, D5/D6)
router.post(
  '/preview',
  workTimeChangePreviewLimiter,   // Rate-Limit VOR der Rollenprüfung — Rebuild ist teuer
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<WorkTimeChangePreviewResponse>>) => { /* ... */ }
);
```
```typescript
// server/src/routes/workPeriods.ts:118-156 (GET /, Rollenprüfung für Lesezugriff, D5)
router.get('/', requireAuth, (req: Request, res: Response<ApiResponse<UserWorkPeriod[]>>) => {
  const isAdmin = req.session.user!.role === 'admin';
  const requestedUserId = /* ... */;
  if (!isAdmin && requestedUserId !== req.session.user!.id) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  // ...
});
```
Für die vier neuen Schreibendpunkte gilt dieselbe Kombination `requireAuth` + `requireAdmin` wie
`POST /preview`/`POST /change` — D5 aus `13-CONTEXT.md` fordert exakt das für „alle Perioden-
Endpunkte (lesen, anlegen, bearbeiten, löschen, Vorschau)“. Der Ratenbegrenzer
`workTimeChangePreviewLimiter` (`server/src/middleware/rateLimits.ts:65-73`, 30 Aufrufe/Minute in
Produktion) ist wortgleich auf die zwei neuen Vorschau-Endpunkte (Korrektur, Löschung) übertragbar
— beide sind wie der bestehende ein echter Rebuild in einer exklusiven Schreibtransaktion, kein
billiger Lesezugriff.

**Typwächter statt Cast** (Zeile 55-80, 95-106): `parseWorkTimeChangeRequestBody()` liest den
Anfragekörper über einen `unknown`-Typwächter, kein `as`-Cast — dasselbe Muster für die neuen
Bodies (`WorkPeriodCorrectionRequestBody`, `WorkPeriodDeleteRequestBody`).

**Fehlerübersetzung** (Zeile 197-208, 290-301): `WorkTimeChangeValidationError` → 400,
`WorkPeriodConflictError` → 409, alles andere → 500 mit `logger.error`. Direkt für die neuen
Routen übertragbar, ggf. mit den in Abschnitt 1 vorgeschlagenen eigenen Fehlerklassen.

**previewToken-Bindung für die neuen Vorschauen (D6, Datenvertrag verlangt `previewToken` für
BEIDE neuen Vorschauarten):** `workTimeChangeToken.ts` bindet aktuell genau die vier Felder eines
Stundenwechsels (`adminId, userId, validFrom, weeklyHours, workSchedule`). Für die Korrektur passt
das nahezu unverändert (dieselben vier Felder plus `periodId`). Für die Löschung gibt es **nichts
zu binden außer `periodId`** — die Planung muss entscheiden, ob ein eigener, einfacherer
Bindungstyp (`{ adminId, periodId }`) sinnvoller ist als eine Wiederverwendung des bestehenden
`PreviewTokenBinding`-Interfaces mit vielen ungenutzten Feldern. Die Signier-/Prüf-Mechanik selbst
(HMAC-SHA256, `v2`-Versionierung, 15-Minuten-TTL, `timingSafeEqual`) ist 1:1 übertragbar:
```typescript
// server/src/services/workTimeChangeToken.ts:98-124 (Ausstellung)
function buildCanonicalString(binding: PreviewTokenBinding, issuedAtMs: number): string {
  return [TOKEN_VERSION, String(binding.adminId), String(binding.userId), binding.validFrom,
          binding.weeklyHours.toFixed(2), canonicalizeWorkSchedule(binding.workSchedule),
          String(issuedAtMs)].join('|');
}
export function issuePreviewToken(binding: PreviewTokenBinding): string {
  const secret = resolveSecret();
  const issuedAtMs = Date.now();
  const canonical = buildCanonicalString(binding, issuedAtMs);
  return `${TOKEN_VERSION}.${issuedAtMs}.${sign(canonical, secret)}`;
}
```

---

### 6. `isFirst`/`isCurrent` — neues Feld auf `UserWorkPeriod`/`WorkTimePeriod`

**Kein Analog — Typerweiterung, aktuell nicht vorhanden.** Verifiziert per `grep -n "isFirst\|isCurrent"`
über `server/src/types/index.ts`, `server/src/services/workPeriodService.ts`,
`desktop/src/types/index.ts`: **0 Treffer.** `13-UI-SPEC.md` weist das selbst ausdrücklich aus
(„Typerweiterung — ausdrücklich für den Planer“).

**Nächstliegende Berechnungsbausteine im Bestand:**
- `isCurrent`: Das Desktop berechnet „aktuell gültige Periode“ bereits heute clientseitig in
  `WorkTimePeriodList.tsx:71-74` über `resolveWorkTimePeriodIn(sortedPeriods, today)?.id` — **dieselbe
  Auflösungsfunktion**, die auch server-seitig als `resolveWorkPeriodIn()`
  (`workPeriodService.ts:247-262`) existiert. Wird `isCurrent` künftig vom Server geliefert (wie
  die UI-SPEC es verlangt, „Frontend-Ableitung wäre falsch, sobald gefiltert/begrenzt wird“), ist
  `getWorkPeriods()` (`workPeriodService.ts:197-210`) die Stelle, an der das Flag ergänzt wird —
  über exakt dieselbe `resolveWorkPeriodIn()`-Logik, kein zweiter Vergleich.
- `isFirst`: kein Bestandsvorbild als Flag, aber die Erkennung „Periode ohne Vorgänger“ ist
  bereits Nebenprodukt der Sortierung in `getWorkPeriods()` (aufsteigend nach `validFrom`) bzw.
  von `checkAllPeriodChains()` (`workPeriodService.ts:509 ff.`), die je Nutzer über `hireDate`
  iteriert.

**Wichtige Nebenfolge, wenn `isCurrent`/`isFirst` vom Server kommen:** `WorkTimePeriodList.tsx`
berechnet `currentPeriodId` aktuell selbst (Zeile 62-74, WR-19/WR-06-Kommentare warnen bereits vor
genau diesem Dual-Calculation-Risiko). Wird das Feld künftig vom Server geliefert, muss diese
lokale Berechnung entfernt werden, nicht nur ergänzt — sonst entstehen zwei Quellen für dieselbe
Aussage in derselben Komponente.

---

### 7. `desktop/src/components/worktime/WorkTimePeriodEditModal.tsx` (neu)

**Analog: `desktop/src/components/worktime/WorkTimeChangeModal.tsx`** (vollständig, 870 Zeilen) —
nahezu deckungsgleiche Struktur für Formular, Vorschau-Panel, Bestätigung, Speichern.

**Imports-Muster** (Zeile 1-23):
```typescript
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WorkScheduleEditor } from '../users/WorkScheduleEditor';
import { useWorkPeriods, usePreviewWorkTimeChange, useSaveWorkTimeChange } from '../../hooks/useWorkTimeChange';
```

**Entprellte, bei jeder Feldänderung verworfene Vorschau** (Zeile 36, Kopfkommentar Zeile 26-35) —
`PREVIEW_DEBOUNCE_MS = 400`, wortgleich für den neuen Dialog zu übernehmen (13-UI-SPEC verlangt
exakt „400 ms entprellt“).

**Panelvarianten nach Rückwirkung** (Zeile 546-571) — direkt übertragbar, nur die Farbkombination
für die Korrektur ist laut 13-UI-SPEC **immer** amber bei Vergangenheit / blau bei Zukunft (kein
neutraler „noop“-Zustand wie in Phase 12, weil die Korrektur nie „nichts zu tun“ sein darf — jede
Änderung an bestehenden Werten ist per Definition eine Korrektur):
```typescript
const previewPanelVariantClasses: Record<PreviewPanelState, string> = {
  placeholder: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  loading: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  noop: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  future: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  past: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
};
```

**Submit → Bestätigung bei Rückwirkung → Speichern** (Zeile 510-526):
```typescript
function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  e.stopPropagation();               // Formulargrenzen im verschachtelten Baum — PFLICHT
  if (isSaving) return;
  if (!validateForm()) return;
  if (!preview || preview.isNoOp) return;
  if (preview.isRetroactive) { setShowConfirm(true); return; }
  void performSave();
}
function handleConfirmRetroactive() { setShowConfirm(false); void performSave(); }
```
Für den Korrektur-Dialog gilt laut 13-UI-SPEC „immer Bestätigung, wenn die Periode die Vergangenheit
berührt“ — dieselbe Weiche, nur ohne den `isNoOp`-Kurzschluss (eine Korrektur mit identischen
Werten wäre laut D7/13-UI-SPEC ein Validierungsfehler „Es wurde nichts geändert“, kein stiller
No-Op).

**Fehlerbehandlung bei abgelaufenem Token** (Zeile 483-507) — Zustand 10 aus 13-UI-SPEC
(„Vorschau ist nicht mehr aktuell“) ist wortgleich zu Zustand 14 aus Phase 12; dieselbe
Zwei-Versuche-Eskalation (`staleFailureCount`) ist 1:1 übertragbar.

**`e.stopPropagation()` + Rendern außerhalb des `<form>`** (Kommentar Zeile 451-454 in
`EditUserModal.tsx`, siehe Abschnitt 9): Pflicht laut `12-UI-SPEC.md` „Formulargrenzen im
verschachtelten Baum“, von `13-UI-SPEC.md` (N-1) ausdrücklich auf `WorkTimePeriodEditModal` und
beide neuen `ConfirmDialog`-Aufrufe dieser Phase ausgeweitet.

**Was NICHT 1:1 übertragbar ist:** `WorkTimeChangeModal` befüllt die Felder aus `user`
(Stammdaten-Vorschlagswerte für eine NEUE Periode). `WorkTimePeriodEditModal` muss aus einer
BESTEHENDEN, übergebenen Periode vorbelegen (`period: WorkTimePeriod` Prop statt `user: User`) —
das Vorbelegungsmuster („`useEffect` synchronisiert bei Prop-Wechsel“) selbst ist aus
`desktop/src/components/vacation/VacationBalanceEditModal.tsx:60-67` (bereits von 12-PATTERNS.md
als Analog identifiziert) übertragbar, nicht aus `WorkTimeChangeModal` selbst.

---

### 8. `ConfirmDialog.tsx` — additive Erweiterung (5 neue Props, Farbangleichung)

**Analog: die Datei selbst** (vollständig gelesen, 112 Zeilen). Aktueller Bestand, exakt gegen den
Auftrag verifiziert:

```typescript
// desktop/src/components/ui/ConfirmDialog.tsx:26-44 (Signatur, Hook-Reihenfolge)
export function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmText = 'Bestätigen', cancelText = 'Abbrechen',
  variant = 'danger', zIndexClass = 'z-50',
}: ConfirmDialogProps) {
  const { panelRef, handlePanelKeyDown } = useModalLayer(isOpen, onClose, 'confirm');
  const titleId = useId();
  if (!isOpen) return null;   // NACH den Hooks — Rules of Hooks
```

**Farbangleichung (E2 aus 13-UI-SPEC), exakte Fundstelle:**
```typescript
// desktop/src/components/ui/ConfirmDialog.tsx:55-59
const iconColors = {
  danger: 'text-red-600 dark:text-red-400',
  warning: 'text-yellow-600 dark:text-yellow-400',   // → text-amber-600 dark:text-amber-400
  info: 'text-blue-600 dark:text-blue-400',
};
```
Verifiziert: **kein Aufrufer im gesamten `desktop/src` nutzt `variant="warning"`** — die Änderung
ist gefahrlos additiv.

**X-Button ist ein rohes `<button>`, kein `Button`-Primitiv** (Zeile 84-91) — bestätigt N-2 aus
13-UI-SPEC: `cancelDisabled` muss eigene `disabled:opacity-50 disabled:cursor-not-allowed`-Klassen
auf dieses Element setzen, es „erbt“ sie nicht automatisch von `Button`:
```typescript
<button type="button" onClick={handleCancel} aria-label="Abbrechen"
  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
  <X className="w-5 h-5" />
</button>
```

**`CardFooter`-Aktionszeile** (Zeile 99-106) — Andockpunkt für `confirmLoading`
(`<LoadingSpinner size="sm" className="mr-2" />` vor `confirmText`, Muster aus
`WorkTimeChangeModal.tsx` Primärbutton) und `confirmDisabled`:
```typescript
<CardFooter className="flex justify-end space-x-3">
  <Button type="button" variant="ghost" onClick={handleCancel}>{cancelText}</Button>
  <Button type="button" variant={confirmButtonVariant} onClick={handleConfirm}>{confirmText}</Button>
</CardFooter>
```

**`details`-Prop:** kein Andockpunkt vorhanden — muss unter `<CardContent><p>{message}</p></CardContent>`
(Zeile 95-97) neu eingefügt werden, `mt-4`, `bg-gray-50 dark:bg-gray-800`-Panel laut 13-UI-SPEC.

**ESC-Unterdrückung über `cancelDisabled` — Abweichung von der Phase-12-Regel, bereits von der
UI-SPEC selbst deklariert (N-2):** `useModalLayer()` schließt heute bei ESC bedingungslos, sobald
das Panel oberste Instanz ist (`useModalLayer.ts:58-73`). `cancelDisabled` muss diesen Pfad
zusätzlich sperren — kein Bestandsmuster für ein bedingtes ESC innerhalb von `useModalLayer`,
die Planung muss hier einen neuen Parameter an `useModalLayer()` selbst vorsehen oder die
ESC-Prüfung in `ConfirmDialog` dupliziert vor `onClose` abfangen.

---

### 9. `WorkTimePeriodList.tsx` — `accessDenied`/`footnote`, `renderActions` wird gesetzt

**Analog: die Datei selbst** (vollständig gelesen, 183 Zeilen). **Wichtigster Befund:** Die Prop
`renderActions` existiert bereits vollständig und exakt so, wie 13-UI-SPEC sie beschreibt — diese
Phase muss sie nur noch **aufrufen**, nicht mehr bauen:
```typescript
// desktop/src/components/worktime/WorkTimePeriodList.tsx:1-15
interface WorkTimePeriodListProps {
  userId: number;
  highlightPeriodId?: number | null;
  renderActions?: (period: WorkTimePeriod) => ReactNode;
}
// ...
// Zeile 132-136 (Kopfzeile) und 171-175 (Zelle):
{renderActions && (<th className="px-4 py-3 text-right ...">Aktionen</th>)}
{renderActions && (<td className="px-4 py-3 text-sm text-right">{renderActions(period)}</td>)}
```
Fehlt die Prop, entfällt die Spalte vollständig — genau das von 13-UI-SPEC verlangte Verhalten für
Nicht-Admins.

**Lade-/Fehler-/Leerzustand** (Zeile 76-113) — vorhandenes Muster, `accessDenied` muss als
**zusätzlicher, früherer** Zweig eingefügt werden (Zustand 3 aus 13-UI-SPEC: „Kein Zugriff" darf
NICHT den Leerzustand-Text zeigen). Reihenfolge der Prüfung wichtig: `accessDenied` vor
`sortedPeriods.length === 0`, sonst zeigt ein 403-Fall fälschlich „Noch kein Stichtag hinterlegt“.

**Zeitzonen-sichere Datumsanzeige** (Zeile 29-31), bereits vorhanden, für den neuen Dialog und die
Fußnote wiederzuverwenden:
```typescript
function formatIsoDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE');
}
```

**Aktuell client-seitig berechnetes `isCurrent`** (Zeile 48-74) — siehe Abschnitt 6, Dual-
Calculation-Risiko, falls der Server künftig `isCurrent` mitliefert.

---

### 10. `OvertimeTransactions.tsx` — Storno-Badges, Beleg-Chip, Sprungmarke

**Analog: die Datei selbst** (vollständig gelesen, 341 Zeilen). **Tatsächliche Zeilennummern
(weichen von den in `12-UI-SPEC.md`/`13-UI-SPEC.md` zitierten Nummern 159/227/282 ab — dort stand
ein älterer/anderer Zwischenstand):**

**Typ-Badge + Tooltip-Muster, HOVER-ONLY (13-UI-SPEC E8/N — muss um `focus-within` und ESC ergänzt
werden, das Bestandsmuster reicht nicht):**
```typescript
// desktop/src/components/worktime/OvertimeTransactions.tsx:232-246
<div className="group relative inline-block">
  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-help ${getTypeBadgeColor(transaction.type)}`}>
    {getTypeLabel(transaction.type)}
  </span>
  {getTypeDescription(transaction.type) && (
    <div className="absolute left-0 top-8 w-64 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
      {getTypeDescription(transaction.type)}
    </div>
  )}
</div>
```
Zweites, gleichartiges Tooltip-Muster (Header-Infoicon) bei Zeile 172-185 — beide sind
`group-hover:`-only, exakt das, was 13-UI-SPEC als unzureichend markiert (fehlt:
`group-focus-within:`, ESC-Ausblendbarkeit mit `stopPropagation()`).

**`type: 'model_change'`-Sonderbehandlung** (bereits aus Phase 12 vorhanden, Vorbild für die
Storno-Zeilen-Sonderbehandlung dieser Phase):
```typescript
// Zeile 84-99 (getTypeLabel), 101-128 (getTypeDescription), 130-153 (getTypeBadgeColor)
case 'model_change': return 'Modellwechsel';                                    // Label
case 'model_change': return 'Saldodifferenz aus einer rückwirkenden Umstellung...'; // Beschreibung
case 'model_change': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'; // Badge
```
Die Storno-Zeile behält laut 13-UI-SPEC dasselbe teal-Badge — kein `case` in `getTypeBadgeColor`
für „storniert“ nötig, nur ein ZUSÄTZLICHES graues Zustands-Badge daneben (neues Element, kein
Ersatz der Funktion).

**Zweite Beschreibungszeile für `model_change`** (Zeile 253-260) — direktes Vorbild für „Storniert
am … von …“ bzw. „Storno zur Buchung vom …“:
```typescript
{transaction.type === 'model_change' && (
  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
    Periode ab {new Date(transaction.date + 'T12:00:00').toLocaleDateString('de-DE')}
    {transaction.createdAt && formatCreatedAtDe(transaction.createdAt) && ` · eingetragen am ${formatCreatedAtDe(transaction.createdAt)}`}
    {transaction.adminName ? ` von ${transaction.adminName}` : ''}
  </p>
)}
```

**Nicht-summierende Dokumentationszeile** (Zeile 264-287, Kommentar Zeile 265-279) — `hours: 0` +
`documentedDelta` für `model_change`. Falls die Korrekturbuchung (nicht die Löschung) ebenfalls
nicht-summierend sein soll (Analogie zu `model_change`), ist das dasselbe Prinzip; die Planung
muss festlegen, ob eine neue Buchungsart nötig ist oder `model_change` für Korrekturen mitverwendet
wird. **13-UI-SPEC nennt an keiner Stelle einen neuen `type`-Wert für die Korrektur** — Hinweis für
die Planung, dass `model_change` ggf. auch für Phase-13-Korrekturen wiederverwendet werden soll
(sprachlich passt „Modellwechsel“ dafür allerdings nicht genau; ggf. ist eine Umbenennung des
Labels je nach Referenztyp nötig, keine neue Spalte).

**Fußzeile mit Abschneidegrenze** (Zeile 324-337, insbesondere Zeile 329):
```typescript
{limit && data.transactions.length >= limit && ` • Maximal ${limit} angezeigt`}
```
Direkte Grundlage für die Beleg-Chip-Fallback-Erkennung „Abschneidegrenze erreicht“ aus 13-UI-SPEC
(`transactions.length >= limit`).

**Formatierungs-Helfer, bereits ausgelagert** (Import Zeile 6-10):
```typescript
import { documentedDeltaToneClass, formatCreatedAtDe, formatDocumentedDelta } from './overtimeTransactionFormat';
```
Diese Datei (`desktop/src/components/worktime/overtimeTransactionFormat.ts`, nicht einzeln
gelesen, aber als Fundort verifiziert) ist der richtige Ort für neue Formatierer wie
„formatReversalReference“ o. ä. — Musterort für neue, reine Formatierfunktionen dieser Phase statt
Inline-Logik in der Komponente.

---

### 11. `EditUserModal.tsx` — Korrekturblock, Fußnote, Dialogsteuerung

**Analog: die Datei selbst** (Zeile 280-489 gelesen). Andockstelle bereits exakt vorhanden:
```typescript
// desktop/src/components/users/EditUserModal.tsx:378-387
<div className="pt-6 border-t border-gray-200 dark:border-gray-700">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
    Arbeitszeitmodell — Perioden
  </h3>
  <WorkTimePeriodList userId={user.id} highlightPeriodId={conflictPeriodId} />
</div>
```
Direkt darunter (13-UI-SPEC Reihenfolge 4/5) kommen: die dauerhafte Fußnote zur ersten Periode,
dann der neue Korrekturblock — als Geschwister-`<div>`, nicht als Kind der Tabelle.

**Modal-in-Modal-Wiring-Muster** (Zeile 455-485) — direkte Vorlage für den Aufruf von
`WorkTimePeriodEditModal` und die beiden `ConfirmDialog`s:
```typescript
<WorkTimeChangeModal
  isOpen={isChangeModalOpen}
  onClose={() => { setIsChangeModalOpen(false); setConflictPeriodId(null); changeButtonRef.current?.focus(); }}
  user={user}
  onConflict={setConflictPeriodId}
  onSaved={(result: WorkTimeChangeResult) => {
    setIsChangeModalOpen(false);
    setSuccessBanner({ validFrom: result.period.validFrom, weeklyHours: result.period.weeklyHours });
    // 8s-Timer, toast.success(...), Fokus zurück auf den auslösenden Button
  }}
/>
```
Fokus-Rückgabe an den auslösenden Button (`changeButtonRef.current?.focus()`) und der 8-Sekunden-
Banner-Timer (Zeile 471-477, inkl. `window.clearTimeout` gegen Doppel-Banner-Timer-Race) sind
wortgleich für „Korrigieren“/„Löschen“ zu übernehmen — je ein eigener Ref pro Auslöser (Button im
Korrekturblock, Zeilenaktion „Korrigieren“, Zeilenaktion „Löschen“).

**Schreibgeschütztes Wochenstunden-Feld mit Verweis auf den eigenen Dialog** (Zeile 324-337) —
Strukturvorbild dafür, wie ein Feld auf eine externe Aktion verweist statt selbst editierbar zu
sein; für Phase 13 nicht direkt gebraucht (die Periodenliste selbst trägt die Aktionen), aber
Beleg dafür, dass `helperText` mit Verweis auf einen benannten Dialog bereits Projektkonvention
ist.

---

### 12. `desktop/src/api/client.ts` — 403-Ausnahme, `console.log` entfernen

**Analog: die Datei selbst** (vollständig gelesen, 283 Zeilen). **Wichtiger Befund: Die 403-
Ausnahme für `/work-periods*` existiert bereits vollständig, inklusive der in 13-UI-SPEC (E6)
geforderten Ausweitung auf schreibende Endpunkte** — dieser Teil der Phase-13-Änderungsliste ist
schon erledigt:
```typescript
// desktop/src/api/client.ts:182-195
const is403OnUsers = response.status === 403 && endpoint === '/users';
// WR-10 (Code-Review Phase 12): SUPPRESS fuer Endpunkte, die ihre Fehler selbst im
// Vertragstext darstellen. ...
const handlesOwnErrors = endpoint.startsWith('/work-periods');
const shouldShowToast = response.status !== 401 && !is403OnUsers && !handlesOwnErrors;
```
Die neuen Endpunkte dieser Phase (`/work-periods/:id/correct`, `/work-periods/:id`, etc.) fallen
bereits unter `endpoint.startsWith('/work-periods')` — **keine Änderung an dieser Zeile nötig**,
solange die neuen Routen unter demselben Präfix registriert werden (was Abschnitt 5 ohnehin
vorsieht). Zu prüfen bleibt nur: Zeigen die neuen Dialoge (Korrektur, Löschung) ihre 403-Fehler
tatsächlich selbst im Formularbanner an (13-UI-SPEC verlangt das ausdrücklich) — sonst verschwindet
der Fehler stillschweigend, weil der globale Toast unterdrückt ist, ohne dass ein Ersatz existiert.

**Zu entfernende `console.log`-Blöcke** (verifiziert, exakte Fundstellen):
- Zeile 18-20, 25-29: Startup-Debugblock („✅ FINALE Werte“, „🔥 LAYER 2 DEBUG“).
- Zeile 31-48: **Green-Server-Erreichbarkeitsprobe** — feuert bei jedem Modulladen, auch in
  Produktion, gegen `http://129.159.8.19:3001/api/health`. Enthält 4× `console.log` (Zeile 41-43)
  UND 2× `console.error` (Zeile 46-47), die **nicht** in einem Fehlerpfad der Anwendung liegen,
  sondern zu dieser Diagnoseprobe gehören — laut 13-UI-SPEC (N-4) gehört der gesamte Block
  vollständig entfernt, nicht nur die `console.log`-Zeilen darin.
- Zeile 50: `console.log('====...')`.
- Zeile 107-115: Request-Dump (inkl. `console.log('📦 Body:', options?.body)` Zeile 110 — vollständige
  Nutzdaten im Klartext).
- Zeile 136-150: Response-Dump (inkl. `console.log('📄 RAW RESPONSE TEXT:', rawText)` Zeile 144).
- Zeile 245-249, 256: PUT-Pfad (`console.log` vor UND nach dem Request).
- Zeile 268-271, 278: DELETE-Pfad (identisches Muster zum PUT-Pfad).

**Zu erhaltende `console.error`:** Zeile 152-156 (JSON-Parse-Fehler, einziger diagnostisch
tragender Pfad laut 13-UI-SPEC N-4) und Zeile 211 (`console.error('API Request Error:', error)`,
Netzwerkfehler-Fangnetz). **6 in echten Fehlerpfaden**, nicht 8 wie ursprünglich in `12-UI-SPEC.md`
behauptet — die Korrektur aus N-4 ist am aktuellen Code bestätigt.

---

### 13. `desktop/src/hooks/useWorkTimeChange.ts` — Erweiterung

**Analog: die Datei selbst** (vollständig gelesen, 80 Zeilen). Drei bestehende Hooks sind die
Vorlage für die vier neuen (`useCorrectWorkPeriodPreview`, `useCorrectWorkPeriod`,
`useDeleteWorkPeriodPreview`, `useDeleteWorkPeriod`):

```typescript
// desktop/src/hooks/useWorkTimeChange.ts:42-55 (Vorschau-Mutation, D2-Prinzip: keine eigene Rechnung)
export function usePreviewWorkTimeChange() {
  return useMutation({
    mutationFn: async (input: Omit<WorkTimeChangeInput, 'reason'>) => {
      const response = await apiClient.post<WorkTimeChangePreviewResponse>('/work-periods/preview', input);
      if (!response.success) throw new Error(response.error || 'Die Vorschau konnte nicht berechnet werden');
      return response.data;
    },
  });
}
```
```typescript
// desktop/src/hooks/useWorkTimeChange.ts:62-80 (Speichern-Mutation, Invalidierung)
export function useSaveWorkTimeChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkTimeChangeInput & { previewToken: string }) => {
      const response = await apiClient.post<WorkTimeChangeResult>('/work-periods/change', input);
      if (!response.success) throw new Error(response.error || 'Der Stundenwechsel wurde nicht gespeichert');
      return response.data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['work-periods', variables.userId] });
      await invalidateUserAffectedQueries(queryClient);
    },
  });
}
```
Für die Löschung zusätzlich zu invalidieren: dieselben Query-Keys — eine Löschung ändert sowohl
die Periodenliste als auch den Kontoauszug (Storno-Buchung), `invalidateUserAffectedQueries` deckt
laut Namen vermutlich bereits beides ab (nicht einzeln gelesen, aber als Fundort für die
Invalidierungsliste zu prüfen).

**`apiClient` kapselt `universalFetch` bereits zentral** (`desktop/src/api/client.ts:2`,
`import { universalFetch } from '../lib/tauriHttpClient'`) — kein neuer Hook dieser Phase muss
`universalFetch` selbst importieren, solange er über `apiClient.get/post/put/delete` geht (Regel
aus `.claude/CLAUDE.md`, bereits zentral gelöst).

---

## Shared Patterns

### A. `db.transaction()`-Klammer für „Periode ändern + Rebuild + Buchung“ (D6/D7)
**Quelle:** `server/src/services/workPeriodChangeService.ts:308-618`, insbesondere die
`run = db.transaction((): WorkTimeChangeOutcome => {...})`-Hülle (Zeile 312) und der
`PreviewRollback`-Mechanismus für den geteilten Dry-Run/Save-Pfad (Zeile 119-124, 600-618).
**Anwenden auf:** die neuen Funktionen für Korrektur und Löschung — beide in derselben Datei oder
als benachbarte, gleich aufgebaute Funktionen.

### B. Gegenbuchung statt Korrektur des Saldos, mit `reason`-Parameter (D2)
**Quelle:** `server/src/services/absenceService.ts:1336-1373` (`revertBalancesAfterDeletion`).
**Anwenden auf:** die Löschfunktion — Originalbuchung bleibt stehen, neue Buchung mit
umgekehrtem Vorzeichen und sprechender `description`.

### C. Auth/Rollen-Middleware, Rate-Limit vor der Rollenprüfung (D5)
**Quelle:** `server/src/routes/workPeriods.ts:118-121, 167-174, 222-225`
(`requireAuth`/`requireAdmin`, `workTimeChangePreviewLimiter`).
**Anwenden auf:** alle vier neuen Endpunkte.

### D. previewToken — HMAC, zustandslos, 15-Min-TTL, `timingSafeEqual`
**Quelle:** `server/src/services/workTimeChangeToken.ts` (vollständig, 189 Zeilen).
**Anwenden auf:** beide neuen Vorschauarten (Korrektur, Löschung) — eigene, engere
`Binding`-Typen statt Wiederverwendung des vollen `PreviewTokenBinding`.

### E. Modal-Primitiv + Formulargrenzen im verschachtelten Baum
**Quelle:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx` (vollständig) +
`desktop/src/components/ui/useModalLayer.ts` (vollständig, 132 Zeilen, gemeinsame Stack-/Fokus-
Logik für `Modal` und `ConfirmDialog`).
**Anwenden auf:** `WorkTimePeriodEditModal.tsx`, beide `ConfirmDialog`-Aufrufe, jede Zeilenaktion
der Periodenliste (`e.stopPropagation()` im `onSubmit`, `type="button"` überall im
Teilbaum, Rendern außerhalb des `<form>` von `EditUserModal`).

### F. Zeitzonen-sichere Datumsanzeige
**Quelle:** `desktop/src/components/worktime/WorkTimePeriodList.tsx:29-31`
(`new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')`), spiegelbildlich in
`OvertimeTransactions.tsx:230`.
**Anwenden auf:** jede neue Datumsanzeige dieser Phase. Serverseitig: kein `toISOString().split('T')[0]`,
kein `new Date('YYYY-MM-DD')` ohne Zeitanteil — Regel aus `.claude/CLAUDE.md` und durchgängig in
`workPeriodChangeService.ts` befolgt (`toGermanDate()`, Zeile 127-130, reine Zeichenkettenumformung).

### G. Rot als Zeilenaktion „Löschen“
**Quelle:** `desktop/src/components/corrections/CorrectionsTable.tsx:177-189`
(`Button variant="ghost" size="sm"` mit `text-red-600 hover:text-red-700 hover:bg-red-50
dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20`, `Trash2`-Icon,
`LoadingSpinner size="sm"` während des Löschens statt des Icons).
**Anwenden auf:** die Zeilenaktion „Löschen“ in `WorkTimePeriodList.tsx` über `renderActions`.
**Abweichung, die zu beachten ist:** `CorrectionsTable.tsx` nutzt noch `confirm()`/`alert()`
(Zeile 21-35) — das ist ein Altmuster, **nicht** für Phase 13 zu übernehmen (Tauri unterstützt
`window.confirm()` laut `ConfirmDialog.tsx`-Kopfkommentar Zeile 1-5 nicht zuverlässig; Phase 13
nutzt ausschließlich den erweiterten `ConfirmDialog`).

### H. Migrations-Technik: Tabellen-Neubau mit Selbstverifikation
**Quelle:** `server/src/database/migrations/011_add_model_change_transaction_type.ts`,
`012_fix_reference_type_check_constraint.ts` (beide vollständig gelesen), Selbstverifikations-
Zusatz aus `010_fix_user_work_periods_delete_guard.ts:60-86` („Migration wird NICHT als
angewendet markiert, wenn die Prüfung nach der Änderung fehlschlägt“).
**Anwenden auf:** beide neue Migrationen (Abschnitt 3, 4) sowie die Parity-Pflicht in `schema.ts`.

### I. Testmuster — geteilte DB-Verbindung, Präfix-Cleanup
**Quelle:** `server/src/services/workPeriodChangeService.test.ts:1-60` (Kopf gelesen) +
`server/src/test-support/workPeriodFixtures.ts` (`insertTestWorkPeriod`, referenziert in Zeile 4,
nicht einzeln gelesen).
**Anwenden auf:** neue Tests für Korrektur/Löschung — läuft gegen die geteilte Verbindung aus
`connection.js` (kein `:memory:`), Testnutzer mit eindeutigem `username`-Präfix (Vorschlag:
`test-13-0X-`), Aufräumen über `DELETE FROM users WHERE id = ?` (CASCADE räumt Perioden und
Buchungen ab), `db.pragma('foreign_keys = ON')` in `beforeAll()`, alle Datumswerte relativ zu
`getTodayString()`.

---

## No Analog Found

| Datei/Baustein | Rolle | Datenfluss | Begründung |
|---|---|---|---|
| Selbstreferenz zwischen zwei `overtime_transactions`-Zeilen (`reversalOf`/`reversedBy` + geteilte „Belegnummer“) | Konzept, Schema-Erweiterung | — | Kein Bestandsmuster: `referenceType`/`referenceId` existiert, zeigt aber auf eine FREMDE auslösende Entität (`work_period`, `time_entry`, ...), nicht auf eine andere Buchungszeile. `vacation_reverted` (absenceService.ts) markiert Stornos nur über `type`, ohne Selbstreferenz. Namenskollision mit dem bestehenden `referenceId` ist ausdrücklich zu klären (siehe Abschnitt 4). |
| `deletedAt` auf `user_work_periods` **kombiniert mit** dem bereits vorhandenen `BEFORE DELETE`-Trigger | Konzept, Migration + Service-Logik | — | Kein Bestandsbeispiel für „Soft-Delete auf einer Tabelle, die bereits einen aktiven Hard-Delete-Guard-Trigger trägt“. Der Trigger feuert nicht bei `UPDATE ... SET deletedAt`, also muss die Lückenschluss-Logik (D3) manuell im Service repliziert werden, nicht über den Trigger erzwungen. Siehe Abschnitt 3. |
| Eigener, engerer `PreviewTokenBinding`-Typ für die Löschvorschau (nur `periodId`, kein `weeklyHours`/`workSchedule`) | Konzept, Token-Design | — | `workTimeChangeToken.ts` bindet aktuell genau vier feste Felder eines Stundenwechsels; für eine reine Löschung sind die meisten davon gegenstandslos. Die Signier-/Prüf-Mechanik ist übertragbar, der Bindungstyp selbst ist eine neue Entscheidung ohne 1:1-Vorbild. |

---

## Metadata

**Analog-Suchbereich:** `server/src/services/`, `server/src/routes/`, `server/src/database/migrations/`,
`server/src/database/schema.ts`, `server/src/middleware/`, `desktop/src/components/worktime/`,
`desktop/src/components/users/`, `desktop/src/components/ui/`, `desktop/src/components/corrections/`,
`desktop/src/hooks/`, `desktop/src/api/`.

**Dateien gelesen (vollständig oder gezielter Ausschnitt):** 22 —
`workPeriodChangeService.ts` (vollständig, 618 Zeilen), `workTimeChangeToken.ts` (vollständig,
189 Zeilen), `workPeriods.ts` (Route, vollständig, 305 Zeilen), `workPeriodService.ts` (Ausschnitte
Zeile 1-100, 280-440), `absenceService.ts` (Ausschnitt Zeile 1320-1400),
`preHireVacationCorrectionService.ts` (vollständig, 201 Zeilen), `schema.ts` (Ausschnitte
`overtime_transactions`, `vacation_transactions`, `user_work_periods`),
`migrations/010_fix_user_work_periods_delete_guard.ts` (vollständig, 89 Zeilen),
`migrations/011_add_model_change_transaction_type.ts` (Kopf, aus 12-PATTERNS übernommen und
gegengelesen), `migrations/012_fix_reference_type_check_constraint.ts` (vollständig, 152 Zeilen),
`migrations/008_create_user_work_periods.ts` (Ausschnitte, Trigger-Definitionen),
`rateLimits.ts` (Ausschnitt `workTimeChangePreviewLimiter`), `workPeriodChangeService.test.ts`
(Kopf, Zeile 1-60), `WorkTimeChangeModal.tsx` (vollständig, 870 Zeilen),
`WorkTimePeriodList.tsx` (vollständig, 183 Zeilen), `OvertimeTransactions.tsx` (vollständig,
341 Zeilen), `ConfirmDialog.tsx` (vollständig, 112 Zeilen), `modalStack.ts` (vollständig,
44 Zeilen), `useModalLayer.ts` (vollständig, 132 Zeilen), `EditUserModal.tsx` (Ausschnitt
Zeile 280-489), `client.ts` (vollständig, 283 Zeilen), `useWorkTimeChange.ts` (vollständig,
80 Zeilen), `CorrectionsTable.tsx` (vollständig, 199 Zeilen). Zusätzlich `grep` über
`server/src/types/index.ts`, `desktop/src/types/index.ts` (isFirst/isCurrent, reversalOf/reversedBy
— 0 Treffer, verifiziert).

**Pattern-Extraktion:** 2026-08-22
