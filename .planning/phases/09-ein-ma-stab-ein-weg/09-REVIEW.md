---
phase: 09-ein-ma-stab-ein-weg
reviewed: 2026-08-22T00:00:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - server/package.json
  - server/scripts/fix-overtime.ts
  - server/src/scripts/compareOvertimePaths.ts
  - server/src/scripts/overtimePathComparison.ts
  - server/src/scripts/overtimePathComparison.test.ts
  - server/src/scripts/reproduceOvertimeCompDefect.ts
  - server/src/services/overtimeLiveCalculationService.ts
  - server/src/services/overtimeLiveCalculationService.test.ts
  - server/src/services/overtimeService.ts
  - server/src/services/overtimeTransactionRebuildService.ts
  - server/src/services/unifiedOvertimeService.ts
  - server/src/services/unifiedOvertimeService.test.ts
findings:
  critical: 1
  warning: 7
  info: 0
  total: 8
status: findings
---

# Phase 09: Code Review Report — "Ein Maßstab, ein Weg"

**Reviewed:** 2026-08-22
**Depth:** deep (Cross-File-Analyse über die fünf REQ-19-Kreditpfade, Aufrufketten bis zur Route)
**Files Reviewed:** 12
**Status:** issues_found (1 Blocker, 7 Warnungen)

## Summary

Die fünf explizit angeforderten Prüfpunkte wurden Zeile für Zeile nachvollzogen:

1. **Die fünf entfernten `if (isWeekend) continue;`-Vorfilter in `overtimeService.ts`** sind an
   allen fünf Stellen verhaltensneutral für Nutzer ohne `workSchedule`: `getDailyTargetHours()`
   (`workingDays.ts:66-91`) prüft Feiertag zuerst, dann `workSchedule`, dann (nur im
   `weeklyHours`-Fallback) das Wochenende — für Nutzer ohne `workSchedule` liefert die Funktion
   an arbeitsfreien Tagen exakt wie vorher `0`. Drei der fünf Schleifen behalten zusätzlich
   einen expliziten `if (targetHours === 0) continue;` bei, der die alte Filterwirkung
   redundant dupliziert. Für Nutzer MIT `workSchedule` ist die Änderung sogar ein Bugfix (ein
   `workSchedule.saturday > 0` wurde vom alten Vorfilter fälschlich verworfen). Keine Zähler,
   Divisoren oder Array-Längen hängen an diesen Schleifen — **kein Befund**.

2. **Die Doppelschreibung von `overtime_balance`** in `updateMonthlyOvertime()`
   (`overtimeService.ts:406`, schreibt zuerst über `unifiedOvertimeService`, dann über
   `rebuildOvertimeTransactionsForMonth()` → `updateOvertimeBalanceForMonth()`) rechnet an
   beiden Stellen nach dem REQ-19-Fix **konsistent**: Beide Pfade schließen `overtime_comp` in
   `targetHours` ein, aber aus `actualHours`/`absenceCredit` aus (Beleg unten). Die bereits
   bekannte, zurückgestellte `targetHours`-Abweichung (`deferred-items.md`) bleibt unverändert
   bestehen — bestätigt, nicht neu bewertet.

3. **`server/scripts/fix-overtime.ts`** wurde vollständig gelesen. Die Umstellung auf
   `ensureOvertimeBalanceEntries()` ist der richtige strukturelle Schritt (behebt REQ-17 in
   diesem Skript), erzeugt aber neue, bisher nicht betrachtete Nebenwirkungen beim Import aus
   `../dist/` — siehe WR-03 bis WR-05.

4. **Die beiden neuen Skripte** `compareOvertimePaths.ts` und `reproduceOvertimeCompDefect.ts`
   halten den D5-Produktionsschutz strukturell ein: import-sichere Module am Dateikopf,
   `assertNotProduction()` synchron auf Modulebene vor jedem `await import(...)` der
   schreibenden/DB-öffnenden Module. Verifiziert per `grep` der Importzeilen und der
   Aufrufreihenfolge. Eine Schwäche der Guard-Heuristik selbst: WR-06.

5. **Ein vierter, bisher nicht untersuchter Kreditpfad für `overtime_comp`** wurde beim
   Cross-File-Tracing der REQ-19-Aufrufketten gefunden: `overtimeLiveCalculationService.ts`
   speist einen echten, aktiven Endpunkt (`GET /api/overtime/transactions/live`,
   `routes/overtime.ts:485`) und kreditiert `overtime_comp` dort weiterhin identisch zu
   `vacation`/`sick`/`special` — der REQ-19-Fix wurde auf diesen Pfad nicht angewendet, weil er
   in keiner der drei Hypothesen (H1/H2/H3, `09-REQ19-BEFUND.md`) und in keinem Lesezitat des
   09-04-Plans vorkam (der Plan vermerkt sogar ausdrücklich „keine Überschneidung" zwischen
   `overtimeLiveCalculationService.ts` und der REQ-19-Untersuchung — siehe Beleg unten). Das ist
   der schwerwiegendste Befund dieser Prüfung: **CR-01**.

Zwei vorbestehende Testfehlschläge in `unifiedOvertimeService.test.ts`
(„should respect hire date…", „REGRESSION: User hired on 1st of month…") wurden per
`npx vitest run` erneut reproduziert und bestätigen exakt die im Auftrag mitgeteilte
Vorbestehens-Aussage — keine neue Bewertung nötig. Alle neuen/geänderten Testdateien dieser
Phase (`unifiedOvertimeService.test.ts` REQ-19-Block, `overtimeLiveCalculationService.test.ts`,
`overtimePathComparison.test.ts`) laufen grün (25/27 Tests bestanden, die 2 Fehlschläge sind die
o.g. vorbestehenden).

## Critical Issues

### CR-01: REQ-19-Fix nicht auf den vierten Kreditpfad angewendet — `overtimeLiveCalculationService.ts` kreditiert `overtime_comp` weiterhin wie `vacation`/`sick` auf einem aktiven Live-Endpunkt

**File:** `server/src/services/overtimeLiveCalculationService.ts:228-236, 300-331`
**Aufrufkette:** `server/src/routes/overtime.ts:499-509` (`GET /api/overtime/transactions/live`, `requireAuth`, kein Admin-Only) → `calculateLiveOvertimeTransactions()` → Schritt 4 (Zeile 228-236) und Schritt 5 (Zeile 300-331) desselben Moduls.

**Beleg (Zeile für Zeile):**

Schritt 4 (Zeile 228-236) überspringt für **alle** Tage mit `absenceDates.has(date)` — das
schließt `overtime_comp`-Tage ein, siehe Aufbau von `absenceDates` (Zeile 153-172, filtert
NICHT nach Abwesenheitstyp) — die Erzeugung einer negativen „earned"-Buchung:

```ts
for (const date of allWorkingDays) {
  // Skip days with absences (they get their own credit transactions below)
  if (absenceDates.has(date)) {
    continue;
  }
  ...
}
```

Schritt 5 (Zeile 300-331) erzeugt für `overtime_comp` weiterhin eine **positive** Gutschrift,
exakt in derselben Fallunterscheidung wie `vacation`/`sick`/`special`:

```ts
case 'overtime_comp':
  transactionType = 'overtime_comp_credit';
  description = `Überstundenausgleich (genehmigt #${absence.id})`;
  break;
...
const hours = absence.type === 'unpaid' ? 0 : targetHours;   // Zeile 328 — overtime_comp fällt NICHT in den Sonderfall
transactions.push({ date: dateStr, type: transactionType, hours: Math.round(hours * 100) / 100, ... });
```

Nettoeffekt pro Ausgleichstag in dieser Liste: **+targetHours**, ohne jede ausgleichende
negative Buchung — nicht saldoneutral (der alte, vor REQ-19 gültige Defekt), sondern sogar mit
umgekehrtem Vorzeichen zur fachlich korrekten Erwartung (Saldo muss um `targetHours` **sinken**,
`.claude/CLAUDE.md` → Überstunden-Berechnung). Der numerische Gesamtsaldo desselben Moduls
(`calculateCurrentOvertimeBalance()`, Zeile 443-471) delegiert dagegen korrekt an
`unifiedOvertimeService.calculatePeriodOvertime()` und ist bereits REQ-19-fest. Ergebnis: Der
Endpunkt `GET /api/overtime/transactions/live` zeigt Nutzer:innen eine Transaktionsliste, deren
Summe **nicht** mit dem daneben ausgegebenen `currentBalance` übereinstimmt — für einen
Ausgleichstag erscheint dort „Überstundenausgleich: +Xh", während der Saldo tatsächlich um Xh
sinkt.

**Beleg, dass dieser Pfad nicht Teil der REQ-19-Untersuchung war:**
`09-04-PLAN.md:9`: „09-03 ändert overtimeLiveCalculationService.ts und overtimeService.ts —
keine Überschneidung [mit der REQ-19-Untersuchung]." `09-04-PLAN.md:123`: „die Hypothesen H1-H3
liegen in unifiedOvertimeService.ts, overtimeTransactionService.ts und absenceService.ts" —
`overtimeLiveCalculationService.ts` fehlt in dieser Aufzählung vollständig.
`09-REQ19-BEFUND.md` erwähnt die Datei kein einziges Mal (`grep` bestätigt). Zur Einordnung:
H2 (`overtimeTransactionService.ts`) und H3 (`absenceService.ts`) wurden im Befund geprüft und
begründet verworfen (`09-REQ19-BEFUND.md:79-104`) — das war korrekt und ist kein Neubefund.
`overtimeLiveCalculationService.ts` wurde dagegen nie geprüft.

**Fix:**
```ts
// overtimeLiveCalculationService.ts, Schritt 4 (ca. Zeile 233): earned-Buchung NICHT
// für overtime_comp-Tage überspringen — sie sollen wie ein normaler "kein Zeiteintrag"-Tag
// eine negative earned-Buchung erhalten:
for (const date of allWorkingDays) {
  const isOvertimeCompDay = /* absence.type für dieses date === 'overtime_comp' ermitteln */;
  if (absenceDates.has(date) && !isOvertimeCompDay) {
    continue;
  }
  // ... earned-Buchung wie gehabt berechnen und pushen, auch für overtime_comp-Tage
}

// Schritt 5 (Zeile 328): overtime_comp wie unpaid von der Gutschrift ausnehmen
const hours = (absence.type === 'unpaid' || absence.type === 'overtime_comp') ? 0 : targetHours;
```
Die genaue Umsetzung sollte sich an `overtimeTransactionRebuildService.ts:335-345` orientieren
(dort ist die REQ-19-Logik für earned+credit bereits korrekt implementiert: earned bleibt
stehen, Credit entfällt für `overtime_comp`). Zusätzlich fehlt ein Regressionstest für
`calculateLiveOvertimeTransactions()` analog zum neuen REQ-19-Block in
`unifiedOvertimeService.test.ts`.

## Warnings

### WR-01: `reproduceOvertimeCompDefect.ts:173` — `monthEnd` per `toISOString()` auf einem lokal-mitternächtlichen `Date` berechnet, Off-by-one-Tag in UTC+1/+2

**File:** `server/src/scripts/reproduceOvertimeCompDefect.ts:173`
**Issue:**
```ts
const monthEnd = new Date(yy, mm, 0).toISOString().slice(0, 10);
```
`new Date(yy, mm, 0)` erzeugt ein `Date`-Objekt auf lokale Mitternacht (00:00:00) des letzten
Kalendertags von `month` — korrekt als Kalenderdatum, aber `.toISOString()` konvertiert diesen
Zeitpunkt nach UTC. In `Europe/Berlin` (UTC+1 im Winter, UTC+2 im Sommer) liegt lokale
Mitternacht in UTC noch am **Vortag** (22:00 bzw. 23:00 UTC). `.slice(0, 10)` liefert daher für
`month="2026-05"` nicht `"2026-05-31"`, sondern `"2026-05-30"` — exakt das Muster, das
`.claude/CLAUDE.md` unter „Timezone Bugs" ausdrücklich verbietet (`toISOString().split('T')[0]`
bzw. hier äquivalent `.slice(0, 10)`), mit Verweis auf `formatDate(date, 'yyyy-MM-dd')` als
korrekten Ersatz. Andere Datumsberechnungen in derselben Datei (Zeile 283, 304) verwenden
korrekt einen `T12:00:00`-Anker und sind dadurch vom Bug nicht betroffen — `monthEnd` (Zeile
173) hat diesen Anker nicht.

**Auswirkung:** `monthEnd` wird als obere Schranke in zwei SQL-Abfragen verwendet
(`compRequests`-Abfrage `startDate <= ?`, Zeile ~183; `txByType`-Abfrage `date <= ?`, Zeile
~217). Ein genehmigter `overtime_comp`-Antrag, dessen `startDate` exakt der letzte Kalendertag
des geprüften Monats ist, wird dadurch von `compRequests` und damit von `erwarteterAbzug`
stillschweigend ausgeschlossen — für ein Werkzeug, dessen erklärter Zweck „Nachweis statt
Behauptung" ist (09-CONTEXT.md), ein Widerspruch in sich.

**Fix:**
```ts
import { formatDate } from '../utils/timezone.js';
const monthEnd = formatDate(new Date(yy, mm, 0), 'yyyy-MM-dd');
```

### WR-02: Vierter/fünfter Kreditpfad nicht mit Tests abgesichert

**File:** `server/src/services/overtimeService.ts`, `server/src/services/overtimeTransactionRebuildService.ts`
**Issue:** Beide Dateien wurden in dieser Phase mit fachlich bedeutsamen Änderungen versehen
(Vorfilter-Entfernung bzw. REQ-19-Kreditlogik), besitzen aber keine einzige dedizierte
Testdatei (`find server/src/services -iname "*overtimeService.test*"` und
`*overtimeTransactionRebuildService.test*` liefern keinen Treffer). Nur
`unifiedOvertimeService.ts` erhielt neue Regressionstests. Für
`overtimeTransactionRebuildService.ts` ist bereits eine (zurückgestellte) Diskrepanz bekannt
(`deferred-items.md`) — genau die Art von Abweichung, die ein Unit-Test hier abfangen würde.
**Fix:** Mindestens einen Test für `handleAbsenceDay()`/`updateOvertimeBalanceForMonth()`
(`overtimeTransactionRebuildService.ts`) ergänzen, der einen `overtime_comp`-Tag isoliert prüft
(analog zum neuen Block in `unifiedOvertimeService.test.ts`).

### WR-03: `fix-overtime.ts` löst durch den Wechsel auf `ensureOvertimeBalanceEntries()` beim reinen Import eine vollständige Schema-Initialisierung/-Migration gegen die Produktionsdatenbank aus

**File:** `server/scripts/fix-overtime.ts:37`
**Issue:** `import { db } from '../dist/database/connection.js';` (transitiv ohnehin durch den
Import von `ensureOvertimeBalanceEntries` aus `overtimeService.js` gezogen) führt beim bloßen
Modul-Import `initializeConnection()` aus (`connection.ts:30-50`): `initializeDatabase()`
(14 `CREATE TABLE IF NOT EXISTS`, mehrere `ALTER TABLE`-Versuche in try/catch, eine bedingte
`BEGIN TRANSACTION; CREATE TABLE users_new; ... DROP TABLE users; ... COMMIT;`-Migration,
`schema.ts:104-155`), danach `createIndexes()` (~30 `CREATE INDEX IF NOT EXISTS`,
`indexes.ts`) und `verifyIndexes()`. Vor dieser Phase öffnete das Skript die Datenbank über
`new Database(dbPath)` direkt, ohne jede DDL-Ausführung. Dieses Skript läuft laut
`.github/workflows/deploy-server.yml:118` bei jedem Deployment und laut `:123-129` **täglich um
3 Uhr per Cron** als eigener, von PM2 unabhängiger Prozess gegen dieselbe
Produktionsdatenbankdatei, während der Server-Prozess bereits eine eigene, offene Verbindung
hält. `grep -rn "busy_timeout" server/src/` liefert keinen Treffer — es ist an keiner Stelle im
Projekt ein `busy_timeout`-Pragma gesetzt. Genau dieses Skript war bereits einmal ursächlich an
einer Produktions-DB-Inzidenz beteiligt (`.planning/debug/db-stabilisierung-20260818.md`,
Abschnitt „Grundursache: zwei Prozesse, zwei Pfade, eine Datenbank"); die dortige Ursache
(unterschiedliche Pfade durch fehlendes `DATABASE_PATH`) ist durch die inzwischen entfernte
Symlink- und die jetzt konsequent gesetzte `DATABASE_PATH`-Variable behoben und **nicht**
identisch mit diesem Befund — aber die grundsätzliche Konstellation „zweiter, unabhängiger
Prozess mit eigener Verbindung auf dieselbe Live-Datei, jetzt zusätzlich mit DDL-Ausführung"
ist neu und erhöht das Risiko in einem Bereich, der bereits einmal zum Vorfall führte.
**Einordnung:** Der Wechsel auf die kanonische Funktion ist die richtige Entscheidung (er behebt
REQ-17 in diesem Skript) — die Nebenwirkung ist ein notwendiger Kollateraleffekt, kein
unabhängiger Fehlgriff. Trotzdem verdient sie explizite Prüfung/Abschwächung, bevor sie
unbeobachtet täglich gegen Produktion läuft.
**Fix:** Prüfen, ob eine leichtgewichtigere, nur-lesende/nur-schreibende Verbindung ohne
`initializeDatabase()`/`createIndexes()`-Overhead für dieses Skript ausreicht, oder zumindest
ein `PRAGMA busy_timeout` projektweit ergänzen, um transiente `SQLITE_BUSY`-Fehler bei
zeitgleichem DDL-Zugriff abzufangen.

### WR-04: `fix-overtime.ts` — `ensureOvertimeBalanceEntries()` wird ohne jede Typprüfung aufgerufen

**File:** `server/scripts/fix-overtime.ts:7, 13, 36-37`
**Issue:** `server/tsconfig.json:26` setzt `"include": ["src/**/*"]` — `server/scripts/**`
wird von `npx tsc --noEmit` nicht erfasst (verifiziert: `npx tsc --noEmit` auf dieses File
angewendet liefert vier `TS7016`-Fehler „implicitly has an 'any' type", weil `server/tsconfig.json`
kein `"declaration": true` setzt und `dist/*.js` daher nie `.d.ts`-Dateien besitzt). Damit sind
`databaseConfig`, `getCurrentMonth`, `ensureOvertimeBalanceEntries` und `db` in diesem Skript
faktisch `any`-typisiert — ein Verstoß gegen die im Projekt sonst durchgesetzte
Zero-`any`-Regel (`.claude/CLAUDE.md` → TypeScript Strict Mode). Eine künftige
Signaturänderung an `ensureOvertimeBalanceEntries()` (Parameterreihenfolge, Rückgabetyp) würde
weder im lokalen `tsc --noEmit` noch im CI-Schritt „TypeScript Type Check" auffallen, sondern
erst als Laufzeitfehler im nächtlichen Produktions-Cron sichtbar.
**Fix:** `server/tsconfig.json` um ein zweites, separates Projekt für `scripts/**` und
`src/scripts/**` ergänzen (oder `server/scripts` in ein eigenes `tsconfig.scripts.json` mit
`"include": ["scripts/**/*", "src/**/*"]` aufnehmen) und in CI prüfen; alternativ
`"declaration": true` im Haupt-Build aktivieren, damit `dist/*.d.ts` entsteht und
`../dist/`-Importe wieder typisiert sind.

### WR-05: `fix-overtime.ts` — keine Fehlerisolierung pro Nutzer, `db.close()` fehlt im Fehlerpfad

**File:** `server/scripts/fix-overtime.ts:55-93, 96-99`
**Issue:** Die `for`-Schleife (Zeile 55-87) umschließt `await ensureOvertimeBalanceEntries(...)`
mit keinem `try`/`catch`. Wirft die Funktion für einen einzigen Nutzer (z. B. wegen
fehlerhafter `hireDate` oder eines DB-Constraint-Verstoßes), bricht `main()` sofort ab; alle
nachfolgenden Nutzer in der Liste werden in diesem Lauf **nicht** verarbeitet — bei einem
täglichen Batch-Job für alle Mitarbeiter:innen ein Verhalten, das die Überstundenkorrektur der
gesamten Belegschaft an einem einzelnen defekten Datensatz aufhängt. Zusätzlich ruft der
Fehlerpfad `main().catch(...)` (Zeile 96-99) `process.exit(1)` auf, ohne zuvor `db.close()`
aufzurufen — der Erfolgspfad schließt die Verbindung explizit (Zeile 93), der Fehlerpfad nicht.
**Fix:**
```ts
for (const user of users) {
  try {
    await ensureOvertimeBalanceEntries(user.id, currentMonth);
    // ... Zähl-/Log-Logik
  } catch (error) {
    console.error(`  ❌ Fehler bei userId=${user.id}:`, error);
    // weiter mit dem nächsten Nutzer
  }
}
```
und `db.close()` auch im `.catch()`-Handler von `main()` aufrufen (in einem `finally`
oder explizit vor `process.exit`).

### WR-06: Produktionsschutz-Heuristik prüft nur auf Substring `"production"` statt auf den kanonischen Pfad

**File:** `server/src/scripts/compareOvertimePaths.ts:57-73`, `server/src/scripts/reproduceOvertimeCompDefect.ts:47-63`
**Issue:**
```ts
if (resolvedPath.includes('production') || nodeEnv === 'production') { ... process.exit(2); }
```
Der Schutz ist heute wirksam, weil der reale Produktionspfad
(`/home/ubuntu/databases/production.db`) die Zeichenkette „production" enthält und weil die
dokumentierte Betriebsweise `DATABASE_PATH` und `NODE_ENV=production` stets gemeinsam setzt
(`.claude/CLAUDE.md` → Database Rules). Der Schutz ist aber eine Zeichenketten-Heuristik statt
eines Vergleichs mit dem kanonischen Pfad — würde jemand `DATABASE_PATH` explizit auf die reale
Produktionsdatei setzen, dabei aber (abweichend von der dokumentierten Konvention) `NODE_ENV`
nicht auf `production` setzen, UND der Pfad enthielte „production" nicht wörtlich (z. B. eine
zukünftige Umbenennung oder ein Backup-Restore-Pfad ohne dieses Wort), würde der Guard
lautlos durchlassen. `getProductionDatabasePath()` (`server/src/config/database.ts:41-43`) ist
bereits exportiert, import-sicher (löst nur `path.join()` auf, öffnet keine Datei — erfüllt
damit exakt das im Dateikopf selbst formulierte Kriterium für Kopfimporte) und würde einen
robusten, nicht-heuristischen Vergleich erlauben.
**Fix:**
```ts
import { getDatabasePath, getProductionDatabasePath } from '../config/database.js';
...
function assertNotProduction(): void {
  const resolvedPath = path.resolve(getDatabasePath());
  const productionPath = path.resolve(getProductionDatabasePath());
  if (resolvedPath === productionPath || process.env.NODE_ENV === 'production') {
    ...
  }
}
```

### WR-07: `overtimeLiveCalculationService.test.ts` — Feiertagstest hängt von Fixture-Daten der Entwicklungsdatenbank ab

**File:** `server/src/services/overtimeLiveCalculationService.test.ts:96-112`
**Issue:** Der Test „schließt einen Feiertag aus…" verifiziert `getDailyTargetHours()` für
`2026-05-01`, mit dem Kommentar „nachweislich in der holidays-Tabelle der
Entwicklungsdatenbank (verifiziert per SQL vor Testerstellung)" (Zeile 97-98) — der Test bezieht
sich also nicht auf eine Fixture, die von diesem Test selbst kontrolliert wird, sondern auf den
tatsächlichen Inhalt von `server/database/development.db` zum Zeitpunkt der Testerstellung.
Läuft die Testsuite in einer Umgebung, in der dieser Feiertag nicht (mehr) eingetragen ist (z. B.
eine neu aufgesetzte Entwicklungsdatenbank vor dem Feiertags-Seeding, oder ein zukünftiges Jahr),
schlägt der Test fehl oder — schlimmer — validiert lautlos das Falsche, falls zufällig ein
anderer Tag betroffen ist. Aktuell grün (verifiziert per `npx vitest run`), aber fragil.
**Fix:** Feiertag für den Testzeitraum direkt in der Testdatei anlegen/entfernen (Setup/Teardown
via `db.prepare('INSERT INTO holidays ...')`) statt auf die aktuelle Fixture-Datenlage zu
vertrauen.

---

_Reviewed: 2026-08-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
