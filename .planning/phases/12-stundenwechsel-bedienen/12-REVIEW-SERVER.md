---
phase: 12-stundenwechsel-bedienen
reviewed: 2026-08-22T00:00:00Z
depth: standard
scope: server
files_reviewed: 13
files_reviewed_list:
  - server/src/database/migrations/011_add_model_change_transaction_type.ts
  - server/src/database/schema.ts
  - server/src/routes/workPeriods.ts
  - server/src/scripts/verifyDesktopEffectiveness.ts
  - server/src/server.ts
  - server/src/services/overtimeLiveCalculationService.ts
  - server/src/services/overtimeTransactionManager.ts
  - server/src/services/overtimeTransactionService.ts
  - server/src/services/workPeriodChangeService.ts
  - server/src/services/workPeriodChangeService.test.ts
  - server/src/services/workTimeChangeToken.ts
  - server/src/services/workTimeChangeToken.test.ts
  - server/src/types/index.ts
findings:
  critical: 6
  warning: 14
  info: 6
  total: 26
status: issues_found
---

# Phase 12: Code-Review Server

**Geprüft:** 2026-08-22
**Tiefe:** standard
**Dateien:** 13
**Status:** issues_found

## Zusammenfassung

Geprüft wurde der komplette Server-Schreibweg des Stundenwechsels: Migration 011,
Schema-Parität, beide Schreibrouten, der Vorschau-Token, der zentrale Service
`applyWorkTimeChange()`, die beteiligten Überstunden-Services und die zwei Testdateien.

Die Transaktionsklammer (D7), die Admin-Rollenprüfung (D6), der Produktionsschutz des
Prüfskripts, die Prepared Statements und die Zeitzonenbehandlung (`formatDate`, kein
`toISOString().split('T')[0]`) sind sauber umgesetzt. Auch der Token ist handwerklich
ordentlich (HMAC, `timingSafeEqual`, Längenprüfung vor dem Vergleich, kein
Entwicklungsschlüssel in Produktion).

Der schwerwiegende Befund liegt genau dort, wo `.claude/CLAUDE.md` es warnt: beim **Dual
Calculation System**. Die `model_change`-Buchung wird zusätzlich zu einem bereits
durchgeführten, stillen Rebuild in dieselbe Tabelle geschrieben, aus der drei andere
Lesepfade den Saldo aufsummieren. Der Nachweis dafür ist nicht theoretisch: der
Kontoauszug-Endpunkt und die „Monatliche Entwicklung" liefern nach einem Stundenwechsel
nachweislich abweichende Zahlen, und die Laufsaldo-Kette der Rebuilds wird mit Werten aus
einer fremden Skala vergiftet. Der einzige Test dazu (REQ-29) prüft ausschließlich
`getOvertimeBalance()` — genau den einen Lesepfad, der als einziger nicht betroffen ist.

Zusätzlich fehlt eine echte Kalenderprüfung des Stichtags und jede Wertebereichsprüfung des
Tagesplans; beides erlaubt es, unsinnige Daten dauerhaft in `user_work_periods` abzulegen.

---

## Critical Issues

### CR-01: Die `model_change`-Buchung doppelt den Differenzbetrag in allen transaktionssummierenden Lesepfaden (Dual Calculation System)

**Datei:** `server/src/services/workPeriodChangeService.ts:350-352, 396-416`

**Problem:**
Schritt 12 (`rebuildOvertimeTransactionsForMonth` mit der neuen Periode) rechnet die
betroffenen Monate vollständig neu: Es entstehen neue `time_entry`-Tageszeilen mit dem
neuen Tagessoll UND `overtime_balance` wird neu geschrieben. Die Saldoänderung ist damit
bereits vollständig eingetreten, **bevor** Schritt 16 zusätzlich eine `model_change`-Zeile
mit `hours = balanceDelta` in dieselbe Tabelle `overtime_transactions` einfügt.

`getOvertimeBalance()` liest aus `overtime_balance` (`overtimeTransactionService.ts:430-435`)
und bemerkt die Zeile deshalb nicht — genau das prüft der Test REQ-29
(`workPeriodChangeService.test.ts:349-379`). Alle anderen Lesepfade summieren jedoch
`overtime_transactions.hours`:

1. **Kontoauszug (live, produktiv):** `routes/overtime.ts:519-527` liefert
   `transactions` aus `calculateLiveOvertimeTransactions()` — dort werden die Tageszeilen
   aus den Rohdaten neu gerechnet (`overtimeLiveCalculationService.ts:414-460` hängt die
   `model_change`-Zeile zusätzlich an) — und daneben `currentBalance` aus
   `unifiedOvertimeService`, das `model_change` nicht kennt. Ergebnis:
   `Summe(transactions) = currentBalance + balanceDelta`. Die angezeigten Zeilen summieren
   sich nachweislich nicht mehr auf den angezeigten Saldo.
2. **Monatliche Entwicklung:** `overtimeTransactionService.ts:678-683` bildet
   `previousBalance` als `SUM(hours)` über **alle** Typen vor dem Fensterbeginn — inklusive
   `model_change`. Innerhalb des Fensters wird `model_change` dagegen verworfen
   (`:704-707`, nur die vier Legacy-Typen). Ein Wechsel älter als das Fenster (Standard 12
   Monate) wird also doppelt gezählt, ein Wechsel innerhalb des Fensters verschwindet
   stillschweigend. Beide Varianten sind falsch.
3. **`getOvertimeBalanceAtDate()`** (`:508-520`) und **`getAggregatedOvertimeStats()`**
   (`:558-580`) summieren ebenfalls ungefiltert.

D4 verlangt, dass die Differenz „nie als stille Neuberechnung" entsteht. Umgesetzt ist das
Gegenteil: die stille Neuberechnung IST der wirksame Vorgang, die Buchung ist ein
dekoratives Duplikat.

**Fix:** Eine der beiden Wirkungen muss verschwinden. Empfohlen, weil rückwirkungsarm:
`model_change` explizit aus jedem Summenpfad ausschließen und das dokumentieren, statt sich
darauf zu verlassen, dass der eine geprüfte Pfad die Tabelle nicht liest.

```ts
// overtimeTransactionService.ts — previousBalance (Zeile 678)
const previousBalance = db.prepare(`
  SELECT COALESCE(SUM(hours), 0) as balance
  FROM overtime_transactions
  WHERE userId = ?
    AND date < ?
    AND type <> 'model_change'   -- reine Journalzeile, Wirkung steckt bereits in den Tageszeilen
`).get(userId, `${startMonth}-01`) as { balance: number };
```

Dasselbe `AND type <> 'model_change'` in `getOvertimeBalanceAtDate()` (:512),
`getAggregatedOvertimeStats()` (:565) und in `getPreviousMonthBalance()` (siehe CR-02).
Alternativ: `hours = 0` in die Journalzeile schreiben und den Differenzbetrag in ein
eigenes, nicht summiertes Feld (z. B. in die Beschreibung/`referenceId`-Metadaten) legen.
In jedem Fall gehört der Test REQ-29 um genau diese drei Lesepfade erweitert — die aktuelle
Fassung prüft nur den einen, der nicht betroffen ist.

---

### CR-02: `model_change` vergiftet die Laufsaldo-Kette (`balanceBefore`/`balanceAfter`) jedes späteren Rebuilds

**Datei:** `server/src/services/workPeriodChangeService.ts:404-415`
(zusammen mit `overtimeTransactionRebuildService.ts:246-258`)

**Problem:**
Die Zeile wird mit `balanceBefore`/`balanceAfter` aus `getOvertimeBalance()` geschrieben —
also aus der **Aggregatskala von `overtime_balance`** (Summe `actualHours - targetHours`
über alle Monate bis heute). Die übrigen Zeilen in `overtime_transactions` tragen dagegen
den **kumulativen Laufsaldo der Journalkette**, den der Rebuild über
`getPreviousMonthBalance()` fortschreibt. Das sind zwei verschiedene Zahlenreihen.

`getPreviousMonthBalance()` liest:

```sql
SELECT COALESCE(balanceAfter, 0) FROM overtime_transactions
WHERE userId = ? AND date < ? ORDER BY date DESC, id DESC LIMIT 1
```

Die `model_change`-Zeile wird nach dem Rebuild eingefügt und trägt daher die höchste `id`
ihres Datums. Fällt `validFrom` auf den letzten Tag eines Monats (oder ist es der einzige
Eintrag vor dem Monatsanfang), gewinnt sie das `ORDER BY date DESC, id DESC` und liefert dem
Rebuild des Folgemonats einen Startwert aus der falschen Skala. Ab da ist die gesamte
`balanceBefore`/`balanceAfter`-Spur — laut Kopfkommentar des Rebuild-Service der
Audit-Trail für DATEV/Personio-Konformität — falsch.

Zusätzlich ist die Zeile in sich unstimmig: `balanceAfter` ist der Saldo **vor** dem
Einfügen der eigenen Zeile, nicht danach.

**Fix:**

```ts
// overtimeTransactionRebuildService.ts — getPreviousMonthBalance()
WHERE userId = ? AND date < ? AND type <> 'model_change'
```

und in `workPeriodChangeService.ts` die beiden Felder gar nicht setzen bzw. auf der
Journal-Skala berechnen (`getBalanceBeforeDate()` aus dem Manager), damit die Zeile in
derselben Reihe steht wie ihre Nachbarn.

---

### CR-03: Ungültige Kalenderdaten passieren die Validierung und landen dauerhaft in `user_work_periods.validFrom`

**Datei:** `server/src/services/workPeriodChangeService.ts:71, 199-201`
(gleicher Mangel in `workPeriodService.ts:70, 105-112`)

**Problem:**
Geprüft wird ausschließlich `^\d{4}-\d{2}-\d{2}$`. `2026-02-31`, `2026-13-45` oder
`0000-00-00` bestehen diese Prüfung. Die Route filtert nicht schärfer
(`workPeriods.ts:78-80` prüft nur „String, nicht leer").

Folgen für `validFrom = '2026-13-45'` (nachvollzogen entlang des Codes):
- `monthsInRange('2026-13-45', ...)` (`:180`) liefert `[]` → **kein Rebuild**, `balanceDelta = 0`,
  keine Buchung.
- `sumTargetHoursInRange` bildet `new Date(2026, 12, 45)` → rollt auf den 14.02.2027 über,
  gemessen wird also ein völlig anderer Tag als der gespeicherte.
- `createWorkPeriod()` (`workPeriodService.ts:286`) prüft mit derselben Regex und schreibt
  die Zeichenkette unverändert in die Datenbank.
- Danach ist jede lexikografische Datumsvergleichslogik (`resolveWorkPeriodIn`,
  `checkPeriodChain`, die Trigger aus Migration 008) für diesen Nutzer dauerhaft verzerrt —
  `'2026-13-45'` sortiert hinter jedes echte Datum des Jahres 2026.

Das ist eine schreibende Adminroute; ein Tippfehler oder ein Client, der ein Feld nicht
normalisiert, genügt.

**Fix:** Echte Kalenderprüfung, weiterhin ohne Zeitzonenbezug:

```ts
function isRealCalendarDate(value: string): boolean {
  if (!DATE_FORMAT.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate(); // Monatslänge inkl. Schaltjahr
}

if (!input.validFrom || !isRealCalendarDate(input.validFrom)) {
  throw new WorkTimeChangeValidationError('Stichtag ist erforderlich');
}
```

Dieselbe Prüfung gehört in `assertDateFormat()` in `workPeriodService.ts`, sonst bleibt der
Weg über andere Aufrufer offen.

---

### CR-04: Der Tagesplan wird serverseitig auf keinen Wertebereich geprüft — die 0-bis-60-Grenze für Wochenstunden ist damit umgehbar

**Datei:** `server/src/services/workPeriodChangeService.ts:120-126, 203-214`
(identische, ebenso lückenhafte Kopie in `routes/workPeriods.ts:47-53`)

**Problem:**
`isWorkSchedule()` prüft nur „Zahl und endlich". Akzeptiert werden damit
`{ monday: -100, ... }`, `{ monday: 999999, ... }` oder `{ monday: 8.5e15, ... }`.
`input.weeklyHours` wird sorgfältig auf `0..60` begrenzt (`:206-208`), aber wenn ein
`workSchedule` gesetzt ist, gewinnt dieser laut `.claude/CLAUDE.md` („workSchedule existiert
→ weeklyHours wird IGNORIERT!") — die Begrenzung läuft also ins Leere.

Konkrete Wirkung: negative Tagessollstunden erzeugen über
`sumTargetHoursInRange`/`rebuildOvertimeTransactionsForMonth` negative Soll-Summen und damit
einen frei wählbaren, beliebig großen `balanceDelta`, der als `model_change`-Buchung
festgeschrieben wird. Das ist eine schreibende Gutschrift auf ein Arbeitszeitkonto ohne jede
Obergrenze.

Weiter fehlt jede Konsistenzprüfung zwischen `weeklyHours` und der Summe des Tagesplans; die
Typdokumentation (`types/index.ts:2-10`) sagt ausdrücklich „Hours for Monday (0-24)", der
Code setzt das nirgends durch.

**Fix:**

```ts
const MAX_DAILY_HOURS = 24;

function isWorkSchedule(value: unknown): value is WorkSchedule {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return WEEKDAY_KEYS.every((key) => {
    const v = record[key];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_DAILY_HOURS;
  });
}
```

Zusätzlich in `validateInput()` die Wochensumme prüfen (`sum(workSchedule) <= 60`) und die
Fehlermeldung aus dem UI-Textbuch verwenden. Die Funktion existiert doppelt (Service und
Route) — siehe IN-03; die Korrektur muss an beiden Stellen ankommen oder die Duplikation
wird vorher aufgelöst.

---

### CR-05: Der `referenceType`-CHECK aus Migration 011 ist wirkungslos — `NULL` in der `IN`-Liste hebt die Prüfung auf

**Datei:** `server/src/database/migrations/011_add_model_change_transaction_type.ts:58`
gegenüber `server/src/database/schema.ts:527`

**Problem:**

```sql
-- Migration 011 (jede migrierte Bestandsdatenbank, also Produktion):
referenceType TEXT CHECK(referenceType IN ('time_entry','absence','manual','system','work_period', NULL))
-- schema.ts (jede frische Installation):
referenceType TEXT CHECK(referenceType IN ('time_entry','absence','manual','system','work_period'))
```

SQL-Dreiwertlogik: `'beliebig' IN ('a', NULL)` ergibt **NULL**, nicht FALSE. Ein
CHECK-Constraint schlägt nur bei FALSE fehl. Durch das `NULL` in der Liste akzeptiert die
migrierte Tabelle **jeden beliebigen** `referenceType`-Wert. Das `NULL` ist dort auch
funktional überflüssig — ein `NULL`-Wert besteht den CHECK ohnehin, wie die Fassung in
`schema.ts` zeigt.

Ergebnis: Produktion (migriert) und frische Installation verhalten sich unterschiedlich —
exakt die Divergenz, die der Kopfkommentar der Migration unter „PARITY-PFLICHT" (Zeile
19-21) zu verhindern verspricht. Ein Schreibfehler im Referenztyp fällt lokal auf und in
Produktion nicht.

**Fix:** `NULL` aus der `IN`-Liste der Migration entfernen und den Constraint über eine
Folgemigration in Bestandsdatenbanken korrigieren (Tabellen-Neubau nach demselben Muster).
Migration 006 trägt denselben Fehler und sollte in derselben Folgemigration mitgezogen
werden.

```sql
referenceType TEXT CHECK(referenceType IN ('time_entry','absence','manual','system','work_period'))
```

---

### CR-06: `createTransaction()` kann `null` liefern, ohne dass der Aufrufer das bemerkt — die versprochene „genau eine Buchung" (D4) bleibt dann aus

**Datei:** `server/src/services/workPeriodChangeService.ts:404-416`
(Ursache: `overtimeTransactionManager.ts:66-85`)

**Problem:**
`createTransaction()` ist idempotent und liefert `null`, wenn eine Zeile mit gleichem
`userId`/`date`/`type`/`hours` (±0,01) und gleicher Referenz existiert. Der Service
übernimmt den Rückgabewert ungeprüft nach `transactionId`.

Der Typvertrag sagt aber etwas anderes (`types/index.ts:380-382`): „ID der erzeugten
`model_change`-Buchung, oder null, **wenn `balanceDelta` 0 ist**". Ein `null` aus dem
Duplikatpfad ist von diesem Fall nicht unterscheidbar. Der Aufrufer — und die Route, die
`outcome` direkt an den Desktop weiterreicht (`workPeriods.ts:267`) — meldet dann „Wechsel
gespeichert", obwohl die von D4/D5 geforderte Journalzeile fehlt. Es gibt weder einen
Fehler noch eine Protokollzeile (`logger.debug` im Manager, in Produktion regelmäßig
abgeschaltet).

**Fix:** Im Speicherpfad ist ein `null` bei `balanceDelta !== 0` ein Fehlerzustand und muss
die Transaktion zurückrollen:

```ts
transactionId = createTransaction({ /* ... */ });
if (transactionId === null) {
  throw new Error(
    `Stundenwechsel für Nutzer ${input.userId} ab ${input.validFrom}: die model_change-Buchung ` +
    `wurde als Duplikat verworfen (balanceDelta ${balanceDelta}) — D4 verlangt genau eine Buchung.`
  );
}
```

---

## Warnings

### WR-01: `balanceDelta` wird über einen UTC-Monatsfilter gemessen — im ersten Stundenfenster eines Monats fällt der laufende Monat aus der Messung

**Datei:** `server/src/services/overtimeTransactionService.ts:430-435`, benutzt in
`workPeriodChangeService.ts:288, 365`

`getOvertimeBalance()` filtert `AND month <= strftime('%Y-%m', 'now')`. `strftime('now')`
ist **UTC**, `getTodayString()` im Service ist **Europe/Berlin**. Am Monatsersten zwischen
00:00 und 01:00/02:00 Berliner Zeit liefert `strftime` noch den Vormonat. `affectedMonths`
enthält dann den neuen Monat, der Rebuild schreibt ihn, aber beide Messungen
(`balanceBefore`, `balanceAfter`) blenden ihn aus — der gemessene und gebuchte
`balanceDelta` ist zu klein bzw. 0.

**Fix:** Den Monatsvergleich in `getOvertimeBalance()` gegen `formatDate(getCurrentDate(),
'yyyy-MM')` als gebundenen Parameter führen statt gegen `strftime('%Y-%m','now')`.

### WR-02: Bereits materialisierte Zukunftsmonate behalten das alte Sollmodell

**Datei:** `server/src/services/workPeriodChangeService.ts:267-274, 307-318`

Die alte Periode wird bei `validFrom` geschlossen, die neue erhält deren `validTo` — das
neue Modell gilt damit für den **gesamten** Rest der alten Periode, also auch für die
Zukunft. Neu gerechnet wird per D3 aber nur bis heute. `overtime_balance`-Zeilen für
Zukunftsmonate, die durch genehmigten Zukunftsurlaub bereits existieren (der Kommentar in
`overtimeTransactionService.ts:427-429` belegt, dass es sie gibt), bleiben mit dem alten
Sollmodell stehen und werden erst irgendwann später zufällig überschrieben.

**Fix:** Bewusst entscheiden und dokumentieren: entweder Zukunftsmonate mit vorhandener
`overtime_balance`-Zeile ebenfalls in `affectedMonths` aufnehmen (die
`model_change`-Buchung bleibt davon unberührt, weil `getOvertimeBalance()` Zukunftsmonate
ausblendet), oder diese Zeilen beim Wechsel gezielt löschen, damit sie neu entstehen.

### WR-03: Kein oberes Limit für den rückwirkenden Zeitraum; `/preview` führt bei jedem Aufruf einen echten Schreib-Rebuild in einer exklusiven SQLite-Schreibtransaktion aus

**Datei:** `server/src/routes/workPeriods.ts:169-207`,
`server/src/services/workPeriodChangeService.ts:267-280, 350-352`

`validFrom` ist nach unten nur durch `hireDate` begrenzt. Bei einem Eintrittsdatum von 2015
umfasst `affectedMonths` über 130 Monate; jeder dieser Monate wird **zweimal**
(Schritt 6 und Schritt 12) vollständig neu aufgebaut — mit DELETE und Tages-INSERTs — und
das alles innerhalb einer einzigen Schreibtransaktion, die better-sqlite3 als exklusive
Sperre hält. Für die Dauer blockiert jeder andere Schreibvorgang des Servers. Die Vorschau
verwirft die Arbeit anschließend vollständig. Geschützt ist die Route nur durch den
allgemeinen `apiLimiter` (600 Anfragen/Minute, `server.ts:152`).

**Fix:** Obergrenze für die Rückwirkung serverseitig festlegen (z. B. „nicht weiter zurück
als der Beginn des Vorjahres", mit Fehlermeldung aus dem UI-Textbuch) und für
`/api/work-periods/preview` einen eigenen, engen Rate-Limiter registrieren.

### WR-04: `reason` ohne Maximallänge und ohne Bereinigung, wird unverändert gespeichert und angezeigt

**Datei:** `server/src/services/workPeriodChangeService.ts:228-235, 399-402, 316`

Geprüft wird nur „mindestens 10 Zeichen nach `trim()`". Der Text landet unverändert in
`user_work_periods.note` und wortwörtlich in `overtime_transactions.description`
(`:402`) und wird von dort in den Kontoauszug jedes Mitarbeiters übernommen
(`overtimeLiveCalculationService.ts:454`). Ein Megabyte-Text ist ebenso möglich wie
HTML-/Skript-Markup; ob daraus ein gespeichertes XSS wird, hängt allein daran, ob der
Desktop-Renderer escaped — der Server sollte sich darauf nicht verlassen.

**Fix:** Obergrenze (z. B. 500 Zeichen) und Ablehnung von Steuerzeichen in
`validateInput()`, `input.reason.trim()` speichern statt der Rohfassung.

### WR-05: Kein `audit_log`-Eintrag für einen der eingriffsintensivsten Adminvorgänge

**Datei:** `server/src/routes/workPeriods.ts:244-267`,
`server/src/services/workPeriodChangeService.ts:418-422`

Das Projekt führt eine `audit_log`-Tabelle. Ein Stundenwechsel ändert rückwirkend das
Arbeitszeitkonto eines fremden Mitarbeiters und erzeugt eine Saldobuchung — protokolliert
wird das ausschließlich über `logger.info`, also in eine rotierende Datei ohne
Aufbewahrungsgarantie. Wer wann welchen Wechsel für wen vorgenommen hat, ist nach der
Logrotation nicht mehr rekonstruierbar (die `createdBy`-Spalte der Periode allein trägt
weder Zeitpunkt der Aktion noch die Vorwerte).

**Fix:** Im Speicherpfad innerhalb derselben Transaktion einen `audit_log`-Eintrag mit
`adminId`, `userId`, `validFrom`, Vor-/Nachwerten und `balanceDelta` schreiben.

### WR-06: `typePriority` in der Live-Sortierung kennt weder `time_entry` noch `unpaid_deduction` — `model_change` sortiert vor der Tagesbuchung

**Datei:** `server/src/services/overtimeLiveCalculationService.ts:504-514`

Erzeugt werden die Typen `time_entry`, `feiertag`, `vacation_credit`, `sick_credit`,
`overtime_comp_credit`, `special_credit`, `unpaid_deduction`, `correction`, `model_change`.
Die Prioritätentabelle enthält aber `earned: 1` und `unpaid_adjustment: 2` — beides Typen,
die diese Funktion nie erzeugt — und **nicht** `time_entry` und `unpaid_deduction`. Beide
fallen auf `|| 99` und sortieren dadurch hinter das in dieser Phase ergänzte
`model_change: 4`. Am Stichtag steht die Modellwechsel-Zeile also **über** der Tagesbuchung
desselben Tages, entgegen der im Kommentar beschriebenen Absicht („dann Korrekturen", also
zuletzt).

Zusätzlich verdeckt `|| 99` einen echten Nullwert: Priorität `0` (`feiertag`) fällt durch
den falschy-Test ebenfalls auf 99.

**Fix:**

```ts
const typePriority: Record<string, number> = {
  feiertag: 0,
  time_entry: 1,
  vacation_credit: 2, sick_credit: 2, overtime_comp_credit: 2, special_credit: 2,
  unpaid_deduction: 2,
  correction: 3,
  model_change: 4,
};
return (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99);
```

### WR-07: `schema.ts` und Migration 011 erzeugen weiterhin unterschiedliche Tabellen (`balanceBefore`/`balanceAfter` fehlen im Schema)

**Datei:** `server/src/database/schema.ts:513-533` gegenüber
`server/src/database/migrations/011_add_model_change_transaction_type.ts:44-67`

Die Migration legt `balanceBefore REAL` und `balanceAfter REAL` an, `schema.ts` nicht. Eine
frische Installation erzeugt damit eine Tabelle, in die
`overtimeTransactionManager.createTransaction()` (`:92-109`, INSERT mit beiden Spalten)
nicht schreiben kann — funktionsfähig wird sie erst, nachdem Migration 005 nachträglich
`ALTER TABLE` fährt. Das funktioniert derzeit nur, weil `runMigrations()` in `server.ts:215`
zufällig nach der Schemaerstellung läuft. Die im Kopf der Migration behauptete Parität
(„damit eine frische Installation und eine migrierte Bestandsdatenbank denselben Constraint
tragen") besteht nicht.

**Fix:** Beide Spalten in `schema.ts` ergänzen, damit die `CREATE TABLE` in beiden Wegen
identisch ist.

### WR-08: `/change` verwirft den Ablehnungsgrund des Tokens — Manipulation ist von Ablauf nicht unterscheidbar und wird nicht protokolliert

**Datei:** `server/src/routes/workPeriods.ts:230-242`

`verifyPreviewToken()` liefert sorgfältig `malformed | mismatch | expired`
(`workTimeChangeToken.ts:47-49`). Die Route wertet nur `verification.valid` aus und
antwortet in allen drei Fällen mit demselben Text „PREVIEW_STALE". Ein `mismatch` bedeutet
aber: gültige Signatur, aber **andere Eingabewerte als in der Vorschau** — also entweder ein
Client-Fehler oder ein gezielter Umgehungsversuch der geprüften Berechnung. Es gibt dafür
keine Protokollzeile.

**Fix:** `verification.reason` bei `mismatch`/`malformed` mit `logger.warn` protokollieren
(userId, adminId, Grund — keine Begründungstexte) und die Antwort weiterhin einheitlich
halten.

### WR-09: Der `previewToken` bindet weder die ausstellende Sitzung noch verbraucht er sich

**Datei:** `server/src/services/workTimeChangeToken.ts:105-114`,
`server/src/routes/workPeriods.ts:186-191`

Gebunden sind nur `userId`, `validFrom`, `weeklyHours`, `workSchedule`. Ein von Admin A
ausgestelltes Token kann Admin B 14 Minuten später einlösen; die `createdBy`-Spalte weist
dann B aus, obwohl nur A die Vorschau tatsächlich gesehen hat. Ebenso ist das Token
mehrfach einlösbar (in der Praxis abgefangen, weil der zweite Versuch am exakten
Periodenbeginn scheitert — das ist Glück, keine Absicht).

**Fix:** Die Sitzungs-/Admin-ID in die kanonische Zeichenkette aufnehmen:
`[TOKEN_VERSION, adminId, userId, validFrom, ...]`.

### WR-10: `req.query.userId as string` — Typzusicherung auf einen Wert, der auch ein Array sein kann

**Datei:** `server/src/routes/workPeriods.ts:138-140`

`req.query.userId` ist bei `?userId=1&userId=2` ein `string[]`. `parseInt(array as string)`
wirft nicht, sondern liefert über die implizite Konvertierung `"1,2"` das Ergebnis `1`. Die
Rollenprüfung greift zwar noch, aber die Route verhält sich bei unerwarteter Eingabe still
statt mit 400 — und die Datei behauptet in ihrem eigenen Kopfkommentar (`:63-68`), an keiner
Stelle einen solchen Cast zu enthalten.

**Fix:**

```ts
const raw = req.query.userId;
if (raw !== undefined && typeof raw !== 'string') {
  res.status(400).json({ success: false, error: 'Invalid userId' });
  return;
}
const requestedUserId = raw ? Number.parseInt(raw, 10) : req.session.user!.id;
```

### WR-11: `verifyDesktopEffectiveness` zählt soft-gelöschte Nutzer mit und meldet Scheindrift

**Datei:** `server/src/scripts/verifyDesktopEffectiveness.ts:99-126`

Beide Abfragen (Drift und „ohne offene Periode") selektieren aus `users` ohne
`WHERE deletedAt IS NULL`. Ein soft-gelöschter Mitarbeiter hat typischerweise keine offene
Periode mehr und erscheint damit dauerhaft in Kennzahl 3 — die Zahl kann strukturell nie 0
werden, obwohl die Ergebnisaussage (`:149-156`) genau darauf aufbaut.

Der Driftvergleich `wsA !== wsB` (`:110-112`) vergleicht **rohe JSON-Zeichenketten**. Zwei
inhaltsgleiche Tagespläne mit unterschiedlicher Schlüsselreihenfolge oder Formatierung
werden als Drift gezählt. Wie es richtig geht, steht im selben Repository:
`workTimeChangeToken.canonicalizeWorkSchedule()`.

**Fix:** `AND u.deletedAt IS NULL` in beide Abfragen; den Tagesplan vor dem Vergleich
kanonisieren.

### WR-12: `process.exit(0)` am Ende des Prüfskripts kann die Berichtsausgabe abschneiden

**Datei:** `server/src/scripts/verifyDesktopEffectiveness.ts:157`

`process.stdout` ist beim Umleiten in eine Datei oder Pipe gepuffert und asynchron.
`process.exit()` beendet den Prozess ohne den Puffer zu leeren — genau bei dem Werkzeug, das
seine Ausgabe als Messnachweis in eine Datei schreiben soll.

**Fix:** Am Erfolgspfad einfach zurückkehren (`return`) statt `process.exit(0)`; die
Fehlerpfade mit `process.exitCode = 1/2` plus `return` statt `process.exit()`.

### WR-13: `JSON.parse` ohne Typwächter und `as UserPublic`-Doppelcast in einer in dieser Phase geänderten Datei

**Datei:** `server/src/services/overtimeLiveCalculationService.ts:116, 144-149`

```ts
const workSchedule = user.workSchedule ? JSON.parse(user.workSchedule) : null; // any
const userForCalc: UserPublic = { id, weeklyHours, workSchedule, hireDate } as UserPublic;
```

`JSON.parse` liefert `any`; der Wert wandert ungeprüft in `getDailyTargetHours()` und damit
in jede Sollstundenrechnung. Der Cast unterdrückt zusätzlich, dass das Objekt die meisten
Pflichtfelder von `UserPublic` gar nicht trägt. Das verletzt die verbindliche Regel „kein
`any` — `unknown` + Type Guards" aus `.claude/CLAUDE.md`. Der Typwächter existiert im
Repository bereits mehrfach (`workPeriodChangeService.ts:120`,
`routes/workPeriods.ts:47`).

**Fix:** `JSON.parse(...) as unknown` + `isWorkSchedule()`-Prüfung; bei Fehlschlag
protokollieren und `null` verwenden statt still weiterzurechnen.

### WR-14: Der Nachweis-Test zum Token ist tautologisch, der Nachweis-Test zu REQ-29 prüft den einzigen nicht betroffenen Lesepfad

**Datei:** `server/src/services/workTimeChangeToken.test.ts:32-38`,
`server/src/services/workPeriodChangeService.test.ts:349-379`

- Test 2 („Verifiziert erfolgreich, auch wenn sich die Begründung geändert hat") ruft
  `verifyPreviewToken(token, { ...BASE_BINDING })` auf — also mit einer identischen Kopie.
  Es wird nichts geändert und folglich nichts belegt; der Test kann nicht fehlschlagen.
- Der REQ-29-Test belegt, dass `getOvertimeBalance()` die `model_change`-Zeile nicht doppelt
  zählt. Das ist trivialerweise wahr, weil diese Funktion `overtime_balance` liest und
  `overtime_transactions` gar nicht anfasst. Die drei Pfade, die die Zeile tatsächlich
  summieren (CR-01), sind ungetestet.

**Fix:** Test 2 durch einen echten Nachweis ersetzen (etwa: ein Token gegen dieselbe Bindung
prüfen, nachdem die Begründung im umgebenden Aufruf verändert wurde — oder den Test
streichen, weil `reason` gar nicht Teil von `PreviewTokenBinding` ist). Für REQ-29
Assertions auf `getMonthlyTransactionSummary()` und die Summe der Zeilen aus
`calculateLiveOvertimeTransactions()` gegen `calculateCurrentOvertimeBalance()` ergänzen.

---

## Info

### IN-01: `isWorkSchedule()` und `WEEKDAY_KEYS` liegen doppelt vor

`server/src/routes/workPeriods.ts:36-53` und
`server/src/services/workPeriodChangeService.ts:73-126` enthalten dieselbe Funktion mit
derselben (lückenhaften, siehe CR-04) Prüfung. Eine gemeinsame Stelle
(`utils/workSchedule.ts`) verhindert, dass eine Verschärfung nur an einer Stelle ankommt.
Eine dritte, abweichende Kanonisierung steht in `workTimeChangeToken.ts:92-103`.

### IN-02: `verification.reason` wird nirgends ausgewertet

Der Union-Typ `PreviewTokenVerification` (`workTimeChangeToken.ts:47-49`) trägt einen
sorgfältig differenzierten `reason`, den der einzige Aufrufer verwirft (siehe WR-08).
Entweder auswerten oder den Typ vereinfachen.

### IN-03: Tote Deployment-Kommentare am Dateiende

`server/src/server.ts:255-257` — `// Deployment attempt #3` bis `#5`. Auch
`:43-44` („CI/CD Pipeline Active", „SSH Key uploaded via GitHub CLI") ist ein
Arbeitsnotiz-Rückstand.

### IN-04: Emoji-Protokollierung in Migration und Manager

`011_add_model_change_transaction_type.ts:32-125` und
`overtimeTransactionManager.ts:83, 121, 180` protokollieren mit Emojis in strukturierte
Logs. Konsistent mit dem Bestand, aber in `pino`-JSON-Feldern schlecht durchsuchbar. Die
Migration schreibt zudem drei leere `logger.info('')`-Zeilen (`:117, 125`).

### IN-05: `isRetroactive` und `rangeEnd` prüfen dieselbe Sache mit zwei verschiedenen Bedingungen

`workPeriodChangeService.ts:269-271`: `input.validFrom < today` bzw.
`input.validFrom > today`. Für `validFrom === today` ist das Ergebnis korrekt, aber die
Doppelbedingung lädt zu einer einseitigen späteren Änderung ein. Eine einzelne Fallunter-
scheidung (`past | today | future`) wäre eindeutig.

### IN-06: `getOvertimeHistory()` castet auf einen Union-Typ, der die meisten realen Werte nicht enthält

`overtimeTransactionService.ts:32, 473`: Die Abfrage liefert auch `vacation_credit`,
`holiday_credit`, `payout` usw., der Rückgabetyp kennt nur fünf Werte. Der Kommentar
(`:24-31`) benennt das als bewusste Scope-Grenze — bleibt eine offene Unwahrheit im
Typsystem, die den Aufrufer zu falschen `switch`-Annahmen verleitet.

---

_Geprüft: 2026-08-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Tiefe: standard_
