# Inventar: Sollstunden-Ermittlung im TimeTracking-System

**Erstellt:** 2026-08-21 (Plan 09-01)
**Zweck:** Vollständige Bestandsaufnahme aller Stellen im Repository, die Soll-Arbeitszeit für
einen Tag oder Zeitraum ermitteln — mit Klassifikation, ob die Stelle über `getDailyTargetHours()`
(`server/src/utils/workingDays.ts:63`) läuft, und ob sie im Produktivpfad liegt. Dieses Dokument
ist ein dauerhaftes Artefakt und wird von den Plänen 09-02 bis 09-04 sowie Phase 11 und 14
wiederverwendet (siehe 09-CONTEXT.md, „Specific Ideas").

Jede Aussage unten ist mit `datei:zeile` belegt und wurde durch tatsächliches Lesen der Datei
verifiziert (Zero-Hallucination-Policy, `.claude/CLAUDE.md` Abschnitt 0). Wo eine Zeile nicht das
enthält, was aus dem Kontext zu erwarten wäre, steht das explizit da statt stillschweigend
korrigiert zu werden.

---

## Suchläufe (Rohtreffer)

Ausgeführt gegen den aktuellen Arbeitsstand, `node_modules` ausgeschlossen:

| Suchlauf | Befehl | Rohtreffer |
|----------|--------|------------|
| 1 | `grep -rn "getDailyTargetHours" --include=*.ts --include=*.tsx server desktop` | 68 |
| 2 | `grep -rn "weeklyHours" --include=*.ts --include=*.tsx server/src desktop/src server/scripts` | 350 |
| 3 | `grep -rn "workSchedule" --include=*.ts --include=*.tsx server/src desktop/src` | 339 |
| 4 | `grep -rn "targetHours" --include=*.ts server/src` | 298 |

Suchläufe 2–4 sind dominiert von Typdefinitionen, UI-Anzeige von Stammdaten (z. B. `{weeklyHours}h`
in Formularen) und Testdateien — das ist erwartbar, da `weeklyHours`/`workSchedule`/`targetHours`
in praktisch jeder Schicht des Systems als Feld vorkommen. Um die tatsächlichen
Berechnungsstellen (nicht bloße Feldverwendung) zu isolieren, wurde zusätzlich gezielt nach dem
Rechenmuster gesucht:

`grep -rn "weeklyHours\s*/\s*5" --include=*.ts --include=*.tsx server desktop` → 27 Treffer in 16
Dateien (Kommentare, Typdefinitionen und tatsächliche Berechnungen gemischt; jede Datei wurde
einzeln geprüft, siehe Tabelle und Ausschlussliste unten).

Jeder Treffer aus allen vier Suchläufen wurde gelesen, bevor er in die Tabelle, die
Ausschlussliste oder gar nicht aufgenommen wurde. Suchlauf 1 ist vollständig in der Tabelle
abgebildet (68 Treffer → Definitionen, Importe, Kommentare, Testdatei-Assertions und tatsächliche
Aufrufstellen unterschieden). Aus den Suchläufen 2–4 sind zusätzlich zum `weeklyHours/5`-Muster
alle Stellen aufgenommen, die eine Berechnung durchführen (nicht nur ein Feld anzeigen).

---

## Fundstellen-Tabelle

Spalten: `Fundstelle`, `Funktion/Kontext`, `Was wird ermittelt`, `Weg`
(`getDailyTargetHours` | `eigene Rechnung` | `Vorfilter vor getDailyTargetHours`), `Beleg`,
`Produktivpfad` (`ja`/`nein`), `Erreichbar über`.

„Produktivpfad = ja" ist durch eine Aufrufkette Route → Service → Funktion nachgewiesen (siehe
Beleg-Spalte „Erreichbar über"). „nein" ist durch eine gezielte Gegenprobe belegt (`grep` nach dem
Funktionsnamen im gesamten `server/src` — kein Treffer außerhalb der eigenen Definition, oder kein
Import aus `server/src/routes/`/`server/src/server.ts`).

### Kanonischer Weg

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/utils/workingDays.ts:63` | `getDailyTargetHours(user, date)` | Sollstunden für einen Tag | — (kanonisch) | `export function getDailyTargetHours(user: UserPublic, date: Date \| string): number {` | ja | von praktisch allen unten gelisteten `ja`-Zeilen aus aufgerufen |
| `server/src/utils/workingDays.ts:336` | `calculateTargetHoursForPeriod(user, fromDate, toDate)` | Summe der Sollstunden über einen Zeitraum durch Tagesschleife | getDailyTargetHours | `totalHours += getDailyTargetHours(user, d);` | nein | nur `server/src/scripts/validateOvertimeCalculation.ts` und `workingDays.test.ts` importieren diese Funktion (`grep -rln calculateTargetHoursForPeriod server/src desktop/src` → 3 Treffer, davon 2 Test/Script, 1 die Definition selbst); kein Import aus `server/src/routes/` |

### UnifiedOvertimeService — der vorgesehene gemeinsame Weg

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/services/unifiedOvertimeService.ts:115` | `calculateDailyOvertime(userId, date)` | `rawTargetHours` für einen Tag, Basis für `targetHours` (Zeile 118–119) | getDailyTargetHours | `const rawTargetHours = getDailyTargetHours(user, date);` | ja | `calculateMonthlyOvertime()` (Zeile 190) ← `updateMonthlyOvertime()` (`overtimeService.ts:454`) ← `GET /api/overtime/balance/:userId/:month` (`routes/overtime.ts:865-902`, Aufruf `updateMonthlyOvertime(userId, month)` in Zeile 902); zusätzlich ← `ensureOvertimeBalanceEntries()` (`overtimeService.ts:745`) ← `GET /api/overtime/:userId` und `GET /api/reports/overtime/user/:userId` |

### overtimeLiveCalculationService.ts — Live-Anzeige (`GET /api/overtime/transactions/live`)

Reachability: `routes/overtime.ts:500-501` importiert `calculateLiveOvertimeTransactions` aus
diesem Service innerhalb des Handlers für `router.get('/transactions/live', ...)`
(`routes/overtime.ts:467`). Alle Fundstellen dieser Funktion sind damit Produktivpfad = ja.

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/services/overtimeLiveCalculationService.ts:66` | `getAllWorkingDaysBetween()`, Zweig `else` (kein `workSchedule`) | Ob ein Wochentag als Arbeitstag zählt (Vorstufe, nicht die Stundenzahl selbst) | Vorfilter vor getDailyTargetHours | Zeile 66 selbst ist `} else {` (Blockende des `if (workSchedule)`-Zweigs); die eigentliche Vorfilter-Logik steht in Zeile 60–68: `if (workSchedule) { ... isWorkingDay = hoursForDay > 0; } else { isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5; }` | ja | s. o. |
| `server/src/services/overtimeLiveCalculationService.ts:181` | `calculateLiveOvertimeTransactions()`, Abwesenheits-Datumsschleife | Sollstunden für einen Abwesenheitstag (Filter, ob Tag zählt) | getDailyTargetHours | `const targetHours = getDailyTargetHours(userForCalc, dateStr);` | ja | s. o. |
| `server/src/services/overtimeLiveCalculationService.ts:250` | `calculateLiveOvertimeTransactions()`, Arbeitstage-Schleife | Sollstunden für Zeiteintrag-Vergleich | getDailyTargetHours | `const targetHours = getDailyTargetHours(userForCalc, date);` | ja | s. o. |
| `server/src/services/overtimeLiveCalculationService.ts:301` | `calculateLiveOvertimeTransactions()`, Abwesenheits-Credit-Schleife | Sollstunden für Gutschrift-Transaktion | getDailyTargetHours | `const targetHours = getDailyTargetHours(userForCalc, dateStr);` | ja | s. o. |
| `server/src/services/overtimeLiveCalculationService.ts:395` | `calculateLiveOvertimeTransactions()`, Arbeit an Nicht-Arbeitstagen | Sollstunden für Feiertags-/Wochenendarbeit | getDailyTargetHours | `const targetHours = getDailyTargetHours(userForCalc, date);` | ja | s. o. |

### overtimeService.ts — Legacy-Pfad (`overtime_balance`)

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/services/overtimeService.ts:110` | `_calculateAbsenceCreditsForMonth()` | Abwesenheits-Gutschrift pro Tag | getDailyTargetHours | `absenceHours += getDailyTargetHours(user, dateStr);` | nein | Funktionsname beginnt mit `_` (Konvention „ungenutzt" in dieser Datei); `grep -rn "_calculateAbsenceCreditsForMonth(" server/src` findet nur die Definition selbst (Zeile 46) — kein Aufrufer |
| `server/src/services/overtimeService.ts:198` | `_calculateUnpaidLeaveForMonth()` | Unbezahlter-Urlaub-Reduktion pro Tag | getDailyTargetHours | `totalUnpaidHours += getDailyTargetHours(user, dateStr);` | nein | `grep -rn "_calculateUnpaidLeaveForMonth(" server/src` findet nur die Definition (Zeile 145) — kein Aufrufer |
| `server/src/services/overtimeService.ts:309` | `ensureAbsenceTransactionsForMonth()`, PHASE 1 (earned-Transaktionen) | Wochentagsprüfung vor Sollstunden-Ermittlung | Vorfilter vor getDailyTargetHours | `const dayOfWeek = d.getDay();` (Zeile 309); Zeile 310 `const isWeekend = dayOfWeek === 0 \|\| dayOfWeek === 6;`, Zeile 311 `if (isWeekend) continue;` | nein | `ensureAbsenceTransactionsForMonth` ist `function` (nicht `export`); `grep -n "ensureAbsenceTransactionsForMonth(" server/src/services/overtimeService.ts` findet ausschließlich die eigene Definition (Zeile 229) und ihr eigenes `console.log` (Zeile 230) — **kein Aufrufer irgendwo im Repository**, die Funktion ist toter Code |
| `server/src/services/overtimeService.ts:320` | `ensureAbsenceTransactionsForMonth()`, PHASE 1 | Sollstunden für einen Abwesenheitstag | getDailyTargetHours | `const targetHours = getDailyTargetHours(user, dateStr);` | nein | wie Zeile 309 — toter Code |
| `server/src/services/overtimeService.ts:347` | `ensureAbsenceTransactionsForMonth()`, PHASE 2 (Credit-Transaktionen) | — | — | Zeile 347 ist eine **Leerzeile** (verifiziert mit `node -e` gegen die Datei); sie steht zwischen `const absenceEnd = ...` (Zeile 346) und dem Kommentar `// Iterate through each day` (Zeile 348). Diese Fundstelle ist im Plan als bereits verifiziert vorausgesetzt; die tatsächliche Berechnung in diesem Block steht bei Zeile 349–352 (`isWeekend`-Vorfilter) und Zeile 360 (`getDailyTargetHours`) | nein | wie Zeile 309 — derselbe tote Codeblock (PHASE 2, Zeilen 344–392) |
| `server/src/services/overtimeService.ts:360` | `ensureAbsenceTransactionsForMonth()`, PHASE 2 | Sollstunden für Credit-Buchung je Abwesenheitstyp | getDailyTargetHours | `const dailyHours = getDailyTargetHours(user, dateStr);` | nein | wie Zeile 309 — toter Code |
| `server/src/services/overtimeService.ts:564` | `_updateOvertimeTransactionsForDate()` | Sollstunden für Transaktions-Update eines einzelnen Tages | getDailyTargetHours | `const targetHours = getDailyTargetHours(user, date);` | nein | Funktion trägt selbst den Kommentar `// @deprecated Not currently used - kept for reference` (Zeile 548); `grep -rn "_updateOvertimeTransactionsForDate" server/src` findet nur die eigene Definition (Zeile 549) |
| `server/src/services/overtimeService.ts:847` | `ensureDailyOvertimeTransactions()` | Sollstunden für Zeiteintrags-Tage | getDailyTargetHours | `const targetHours = getDailyTargetHours(user, dateStr);` | ja | `export async function ensureDailyOvertimeTransactions` (Zeile 796) ← `routes/overtime.ts:610` (`await ensureDailyOvertimeTransactions(userId, startMonth, endMonth);`) im Handler `GET /api/overtime/transactions/monthly-summary` (Zeile 556–557) |
| `server/src/services/overtimeService.ts:1323` | `ensureAbsenceTransactions()` | Sollstunden für Abwesenheitstage (Transaktions-Rebuild) | getDailyTargetHours | `const targetHours = getDailyTargetHours(user, dateStr);` | ja | `export async function ensureAbsenceTransactions` (Zeile 1251) ← aufgerufen von `ensureDailyOvertimeTransactions()` selbst (Zeile 869: `await ensureAbsenceTransactions(userId, startMonth, endMonth);`) — dieselbe Aufrufkette wie Zeile 847 |
| `server/src/services/overtimeService.ts:595-660` | `getOvertimeSummary()` | Jahres-Summe aus `overtime_balance` (liest vorberechnete Werte, ermittelt keine Sollstunden selbst) | — (Pass-Through) | Zeile 633: `WHERE userId = ? AND month LIKE ? AND month <= ?` — Monatsfilter vorhanden (siehe Debug-Sichtung, Angelpunkt b) | ja | `routes/overtime.ts:681` (`GET /:userId`) und `routes/reports.ts:68` (`GET /overtime/user/:userId`, via `getUserOvertimeReport`) |

### unifiedOvertimeService-Migration (Legacy delegiert korrekt)

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/services/overtimeService.ts:454` | `updateMonthlyOvertime()` | delegiert vollständig an UnifiedOvertimeService | getDailyTargetHours (indirekt) | `const monthlyResult = unifiedOvertimeService.calculateMonthlyOvertime(userId, month);` | ja | `routes/overtime.ts:902` |

### overtimeTransactionRebuildService.ts

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/services/overtimeTransactionRebuildService.ts:250` | `collectDailyCalculations()` | Sollstunden je Tag (Basis für Transaktions-Rebuild + `overtime_balance`-Schreibung) | getDailyTargetHours | `const targetHours = getDailyTargetHours(user, dateStr);` | ja | `rebuildOvertimeTransactionsForMonth()` ← `updateMonthlyOvertime()` (`overtimeService.ts:493`) ← `routes/overtime.ts:902`; zusätzlich ← `updateAllOvertimeLevels()` (`overtimeService.ts:527`), aufgerufen aus `timeEntryService.ts` bei jedem Zeiteintrag |

### overtimeTransactionService.ts — Saldo-Lesepfad

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/services/overtimeTransactionService.ts:406-418` | `getOvertimeBalance(userId)` | Aktueller Gesamtsaldo aus `overtime_balance` (liest vorberechnete Werte) | — (Pass-Through) | Zeile 418: `AND month <= strftime('%Y-%m', 'now')` — Monatsfilter vorhanden (siehe Debug-Sichtung, Angelpunkt a) | ja | `absenceService.ts:880` (`getOvertimeBalance`-Import für `overtime_comp`-Genehmigung) und `routes/overtime.ts:615` (`/transactions/monthly-summary`) |

### absenceService.ts

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/services/absenceService.ts:1195` | `calculateAbsenceCredits(userId, startDate, endDate)` | Sollstunden je Tag einer Abwesenheit (Basis für `overtime_comp`-Abzug) | getDailyTargetHours | `const dailyHours = getDailyTargetHours(user, d);` | ja | `updateBalancesAfterApproval()` Zeile 1244 (`deductOvertimeHours(request.userId, hoursToDeduct)` für `overtime_comp`) ← `approveAbsenceRequest()` Zeile 832 ← `routes/absences.ts:495` (`approveAbsenceRequest(...)`) |

### exportService.ts

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/src/services/exportService.ts:98` | `generateDATEVExport()` | Sollstunden je Zeiteintrag-Tag für DATEV-Export | getDailyTargetHours | `const dailyTargetHours = getDailyTargetHours(fullUser, entry.date);` | ja | `server/src/routes/exports.ts:18` importiert `generateDATEVExport` aus `exportService.js` |

### Skripte (server/scripts/, server/src/scripts/) — Ausnahme von der Blanko-Regel

Der Plan setzt voraus, dass Dateien unter `server/scripts/` und `server/src/scripts/` grundsätzlich
`nein` sind, weil kein Import aus `server/src/routes/` auf sie zeigt. Für die meisten Skripte
trifft das zu (siehe Ausschlussliste unten). **Eine Ausnahme wurde gefunden und wird hier bewusst
nicht in die Ausschlussliste einsortiert:**

| Fundstelle | Funktion/Kontext | Was wird ermittelt | Weg | Beleg | Produktivpfad | Erreichbar über |
|---|---|---|---|---|---|---|
| `server/scripts/fix-overtime.ts:78` | `ensureOvertimeBalanceEntries()` (eigenständige Kopie, nicht die aus `overtimeService.ts`) | `targetHoursPerDay` für alle Nutzer, unabhängig von `workSchedule` | eigene Rechnung | `const targetHoursPerDay = user.weeklyHours / 5;` | **ja** | **Kein Express-Endpunkt, sondern ein geplanter Job:** `.github/workflows/deploy-server.yml:118` führt das Skript bei **jedem Deployment** aus (`DATABASE_PATH=$DATABASE_PATH NODE_ENV=production npx tsx scripts/fix-overtime.ts`); zusätzlich registriert `deploy-server.yml:123-130` einen **täglichen Cronjob um 3 Uhr** (`CRON_COMMAND="0 3 * * * ... npx tsx scripts/fix-overtime.ts"`), der bei jedem Deploy neu gesetzt wird (`crontab -l | grep -v fix-overtime.ts; echo "$CRON_COMMAND" \| crontab -`) |

**Warum das zählt:** Task 2 definiert Produktivpfad = ja auch für „einen geplanten Job" — nicht
nur für Express-Routen. `fix-overtime.ts` läuft nachweislich als Teil des Deployment-Workflows und
als täglicher Cron. Das Skript verwendet `countWorkingDaysBetween()` aus `workingDays.ts` (Zeile 22
Import, SSOT für Feiertags-/Wochenend-Ausschluss), berechnet die Sollstunden pro Tag aber selbst
über `user.weeklyHours / 5` (Zeile 78–79) und ruft **nicht** `getDailyTargetHours()` auf — für
Nutzer mit `workSchedule` ist das Ergebnis falsch (siehe Abweichung A-1 unten).

---

## Ausgeschlossene Treffer

Fundstellen, die nur Stammdaten anzeigen oder speichern (Eingabemasken, reine
Anzeigekomponenten) — mit Begründung je Eintrag:

| Fundstelle | Begründung |
|---|---|
| `desktop/src/components/users/WorkScheduleEditor.tsx:44` | UI-Komponente zur **Eingabe** des Arbeitszeitmodells beim Anlegen/Bearbeiten eines Nutzers. `const dailyHours = Math.round((weeklyHours / 5) * 100) / 100;` erzeugt einen **Vorschlagswert** für das Formular (Default-Verteilung Mo–Fr), keine Überstundenberechnung. Kein Bezug zu `overtime_balance` oder `overtime_transactions`. |
| `desktop/src/components/worktime/WorkScheduleDisplay.tsx:60` | UI-Komponente zur **Anzeige** des Arbeitszeitmodells (Dashboard-Widget/Detailansicht). `const dailyHours = user.weeklyHours / 5;` dient ausschließlich der Tabellen-/Chart-Darstellung des hinterlegten Modells, fließt nicht in eine Überstundenberechnung ein. |
| `desktop/src/components/users/WorkScheduleEditor.tsx:186` | Anzeige „`{weeklyHours}h ÷ 5 Arbeitstage = ...h/Tag`" — reiner Hilfetext im Formular, keine Berechnung mit Auswirkung auf Salden. |
| `server/src/database/schema.ts:76` | Kommentar in der Schema-Definition (`// NULL = Fallback to weeklyHours/5 ...`), keine Berechnung. |
| `server/src/types/index.ts:26,64,84` | Kommentare in Typdefinitionen (`// NULL = use weeklyHours/5 fallback`), keine Berechnung. |
| `desktop/src/types/index.ts:26` | Wie oben, Frontend-Typdefinition. |
| `desktop/src/test/overtimeCalculation.test.ts:45,224,247,274` | Testdatei — reproduziert die Formel zur Testvorbereitung, ist keine Produktivstelle. |
| `server/src/utils/workingDays.test.ts` (mehrfach) | Testdatei für `getDailyTargetHours` selbst — Assertions, keine eigenständige Berechnung. |
| `server/debug_overtime_comparison.ts`, `server/debug_target_calculation.ts`, `server/test_absence_days.ts`, `server/test_loop_debug.ts`, `server/test_updateMonthlyOvertime_exact.ts` | `debug_*.ts`/`test_*.ts` im Serverwurzelverzeichnis, laut Plan explizit ausgeschlossen. Gegenprobe: `grep -rn "debug_target_calculation\|test_updateMonthlyOvertime_exact" server/src/routes server/src/server.ts` liefert keinen Treffer — kein Import aus dem Produktivpfad. `debug_target_calculation.ts:22` definiert sogar eine **eigene, lokale Kopie** von `getDailyTargetHours()` (nicht die aus `workingDays.ts`) — ein Hinweis darauf, dass diese Datei isoliert zum Debuggen entstand und nie in den Produktivpfad eingebunden war. |
| `server/src/scripts/migrateOvertimeToTransactions.ts:131`, `server/src/scripts/validateAllTestUsers.ts:73,107`, `server/src/scripts/validateOvertimeDetailed.ts:416,570,618` | `server/src/scripts/`-Verzeichnis, laut Plan ausgeschlossen. Gegenprobe: `grep -rn "validateOvertimeDetailed\|validateAllTestUsers\|migrateOvertimeToTransactions" server/src/routes server/src/server.ts` liefert keinen Treffer. Erreichbar nur über npm-Skripte (`npm run validate:overtime:detailed`, `npm run validate:all-test-users`, `npm run migrate:overtime`), nicht über einen Express-Handler oder Cron — anders als `fix-overtime.ts` sind diese Skripte nicht in `deploy-server.yml` verdrahtet. |
| `desktop/src/utils/timeUtils.ts:236-238` | Frontend-eigene Reimplementierung von `calculateAbsenceHoursWithWorkSchedule()` (Funktion trägt denselben Namen wie `workingDays.ts:117`, ist aber eine unabhängige Kopie im Desktop-Client). Da die Definition von Produktivpfad im Auftrag ausdrücklich an `server/src/routes/` gebunden ist, fällt Frontend-Code kategorisch unter `nein`. Siehe „Nicht-Abweichungen mit Begründung" — dieser Fund wird dort nicht ignoriert, sondern für Phase 14 vorgemerkt. |

---

## Referenz: getDailyTargetHours()

Ableitungsreihenfolge aus `server/src/utils/workingDays.ts:63-94`, mit Zeilennummer:

1. **Feiertag zuerst** (Zeile 66-71): `const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr); if (holiday) { return 0; }` — überschreibt alles Weitere, auch ein `workSchedule` mit positiven Stunden an diesem Tag.
2. **workSchedule** (Zeile 73-77): `if (user.workSchedule) { const dayName = getDayName(date); return user.workSchedule[dayName] || 0; }` — wenn gesetzt, endet die Funktion hier; `weeklyHours` wird nicht mehr angesehen.
3. **weeklyHours === 0** (Zeile 80-83): `if (user.weeklyHours === 0) { return 0; }` — Sonderfall Aushilfen ohne `workSchedule`.
4. **Wochenende** (Zeile 85-91): `const dayOfWeek = d.getDay(); if (dayOfWeek === 0 || dayOfWeek === 6) { return 0; }` — nur relevant für Nutzer ohne `workSchedule`.
5. **weeklyHours / 5** (Zeile 93): `return Math.round((user.weeklyHours / 5) * 100) / 100;` — Fallback-Formel für die Standard-5-Tage-Woche.

Jede Stelle, die diese Reihenfolge nicht in dieser Reihenfolge nachvollzieht (z. B. Wochenende
prüfen, bevor `workSchedule` geprüft wurde), weicht vom Maßstab ab.

---

## Abweichungen (REQ-17)

Aufgenommen wird jede Fundstelle mit `Produktivpfad = ja` **und** `Weg != getDailyTargetHours`
(Pass-Through-Stellen, die nur `overtime_balance` lesen, zählen nicht als eigene
Sollstunden-Ermittlung und sind daher nicht Gegenstand dieser Liste — ihre Korrektheit hängt an
der Stelle, die den gelesenen Wert ursprünglich geschrieben hat).

### A-1: `server/scripts/fix-overtime.ts:78` — überspringt Stufe 2 (`workSchedule`)

**Status:** beseitigt in 09-03 Task 3 (Angleichen), belegt in 09-03 Task 4 (Vorher/Nachher-
Messung: Delta 0,00 für alle drei Prüfnutzer nach der Angleichung). Siehe
`.planning/phases/09-ein-ma-stab-ein-weg/09-A1-NACHWEIS.md`.

**Übersprungene Stufe:** Stufe 2 von `getDailyTargetHours()` (`user.workSchedule[dayName]`).
Das Skript berechnet stattdessen für **jeden** Nutzer `targetHoursPerDay = user.weeklyHours / 5`
(Zeile 78) und multipliziert das mit der über `countWorkingDaysBetween()` ermittelten
Arbeitstage-Zahl (Zeile 76, 79). `countWorkingDaysBetween()` selbst kennt kein `workSchedule` —
es zählt nur Mo–Fr abzüglich Feiertage (`workingDays.ts:264-300`), unabhängig vom individuellen
Wochenplan.

**Fachlicher Fall, der falsch gerechnet wird:** Ein Nutzer mit `workSchedule.saturday > 0` (z. B.
Carmen Rothemund, `userId 17`, laut `.planning/debug/carmen-rothemund-overtime-analysis.md:31-40`
mit `{"monday":4,"tuesday":4,"wednesday":0,"thursday":4,"friday":0,"saturday":0,"sunday":0}` —
in diesem konkreten Datensatz ist `saturday: 0`, aber das Prinzip gilt für jeden Nutzer mit
`workSchedule`, dessen Verteilung von einer gleichmäßigen 5-Tage-Woche abweicht, z. B. `{"monday":8,
"tuesday":8,"wednesday":8,"thursday":8,"friday":2,"saturday":0,"sunday":0}` aus dem Docstring von
`getDailyTargetHours()` selbst, `workingDays.ts:56-58`):
- `getDailyTargetHours()` liefert für Freitag `2h` (Stufe 2 greift, `workSchedule.friday = 2`).
- `fix-overtime.ts:78-79` liefert für **jeden** Arbeitstag denselben Wert
  `weeklyHours / 5 = 40/5 = 8h` — für Freitag also `8h` statt der korrekten `2h`.
- Da das Skript bei jedem Deployment und täglich um 3 Uhr läuft (siehe Tabelle oben) und
  `overtime_balance` per UPSERT überschreibt (Zeile 125-130: `INSERT ... ON CONFLICT(userId, month)
  DO UPDATE SET targetHours = ?, actualHours = ?`), wird jede vorher korrekt von
  `unifiedOvertimeService` berechnete `targetHours`-Spalte binnen höchstens 24 Stunden mit dem
  falschen Wert überschrieben.

**Zusätzlicher Fund, nicht Teil der ursprünglichen vier Debug-Sessions:** Dieses Verhalten ist in
keiner der vier gesichteten Debug-Sessions dokumentiert (siehe 09-DEBUG-SICHTUNG.md). Es wurde
während dieser Inventur durch Lesen von `deploy-server.yml` gefunden, weil die Blanko-Annahme des
Plans („Skripte sind nein") anhand der tatsächlichen Cron-/Deploy-Verdrahtung geprüft wurde statt
übernommen.

---

## Nicht-Abweichungen mit Begründung

Fundstellen mit `Produktivpfad = nein`, die trotzdem eigenständig rechnen — sie fallen nicht unter
REQ-17 (weil nicht produktiv erreichbar), sollen aber dokumentiert bleiben, damit Phase 14 sie
nicht erneut untersucht:

- **`server/src/services/overtimeService.ts:110,198,309,320,347,360,564`** — Toter Code aus der
  Vor-`UnifiedOvertimeService`-Ära (`_calculateAbsenceCreditsForMonth`,
  `_calculateUnpaidLeaveForMonth`, `ensureAbsenceTransactionsForMonth`,
  `_updateOvertimeTransactionsForDate`). Alle vier Funktionen sind entweder namentlich als
  `@deprecated`/mit führendem Unterstrich markiert oder haben nachweislich keinen Aufrufer
  (`grep` nach dem Funktionsnamen findet nur die eigene Definition). Interessant: Alle vier nutzen
  `getDailyTargetHours()` korrekt — wären sie produktiv erreichbar, wären sie keine Abweichung.
  Empfehlung für Phase 14: Toten Code entfernen, um künftige Verwechslungen mit den aktiven
  gleichnamigen Konzepten (`ensureDailyOvertimeTransactions`, `ensureAbsenceTransactions`) zu
  vermeiden.
- **`server/src/scripts/validateOvertimeCalculation.ts:211`, `server/src/scripts/verifyTestData.ts:92`** —
  Beide Validierungs-/Testskripte berechnen `weeklyHours / 5` als Fallback für Nutzer ohne
  `workSchedule` in ihrer eigenen, unabhängigen Nachrechnung (das ist der Zweck eines
  Validierungsskripts: eine zweite, unabhängige Berechnung zum Vergleich). Da sie nur über
  `npm run validate:overtime` bzw. `npm run verify-test-data` laufen und nicht über Express-Route
  oder Cronjob erreichbar sind, zählen sie nicht als Produktivpfad. Sollte Phase 14 das
  Validierungswerkzeug (`D3` aus `09-CONTEXT.md`) ausbauen, ist zu prüfen, ob diese Skripte
  `workSchedule` überhaupt korrekt vergleichen — `validateOvertimeCalculation.ts:201-208` behandelt
  den `workSchedule`-Fall separat über `calculateAbsenceHoursWithWorkSchedule()`, nur der
  `else`-Zweig (Zeile 211) nutzt die flache Formel.
- **`desktop/src/utils/timeUtils.ts:213-239`** — Der Desktop-Client enthält eine eigenständige
  Kopie von `calculateAbsenceHoursWithWorkSchedule()`, die `workSchedule` korrekt respektiert
  (Zeile 232-234: `if (workSchedule) { totalHours += workSchedule[dayName] || 0; }`) und nur im
  `else`-Zweig auf `weeklyHours / 5` zurückfällt (Zeile 236-238). Diese Funktion läuft im Browser/
  Tauri-Prozess, nicht auf dem Server — „Produktivpfad" im Sinne dieses Plans (Express-Route)
  trifft nicht zu, obwohl der Code in der ausgelieferten Desktop-App aktiv genutzt wird. Diese
  Doppelimplementierung (Server- und Client-Kopie derselben Funktion mit identischem Namen) ist
  ein eigenständiges Wartungsrisiko, aber kein REQ-17-Fall (REQ-17 spricht laut 09-CONTEXT.md von
  „allen Berechnungswegen", die Formulierung im Plan-Task 2 grenzt Produktivpfad jedoch explizit
  auf `server/src/routes/` ein). Für Phase 14 vorgemerkt.
- **`server/debug_target_calculation.ts:22`** — Enthält eine eigene, lokale Neudefinition von
  `getDailyTargetHours()` (nicht die aus `workingDays.ts`, auch wenn identisch benannt). Datei ist
  nicht in `server/src/routes/` oder `server/src/server.ts` importiert und liegt im Serverwurzel-
  verzeichnis (`debug_*.ts`-Ausschluss laut Plan). Kein Risiko für den Produktivpfad, aber ein
  Kandidat zum Aufräumen.

---

## Urteil REQ-17 (Stand 09-01)

**Nicht erfüllt — 1 Abweichung, siehe A-1.**

Der Kernpfad (`unifiedOvertimeService` → `getDailyTargetHours()`, genutzt von
`updateMonthlyOvertime()`, `ensureOvertimeBalanceEntries()`, `overtimeLiveCalculationService.ts`,
`overtimeTransactionRebuildService.ts`, `absenceService.ts` und `exportService.ts`) ist
durchgängig konsistent und respektiert `workSchedule` korrekt. Die einzige gefundene Abweichung
liegt außerhalb der Service-Schicht, die die vier bekannten Debug-Sessions untersucht hatten: das
Cron-/Deploy-Skript `server/scripts/fix-overtime.ts` überschreibt `overtime_balance` täglich mit
einer `workSchedule`-blinden Berechnung. Für Nutzer ohne individuellen Wochenplan (Standard-5-Tage-
Woche) ist der Effekt unsichtbar, weil `weeklyHours / 5` in diesem Fall mit `getDailyTargetHours()`
übereinstimmt. Für Nutzer mit `workSchedule` — laut `carmen-rothemund-overtime-analysis.md`
mindestens ein bekannter, realer Fall — liefert das Skript falsche Werte für jeden Tag, an dem die
individuelle Verteilung von der Gleichverteilung abweicht.

Plan 09-03 (REQ-17/18) sollte A-1 als Fixgegenstand aufnehmen: `fix-overtime.ts` entweder auf
`ensureOvertimeBalanceEntries()`/`unifiedOvertimeService` umstellen oder ersatzlos streichen, falls
der tägliche Cron durch die On-Demand-Berechnung (`ensureOvertimeBalanceEntries()` wird bei jedem
Report-/Dashboard-Aufruf ohnehin ausgeführt) überflüssig ist — diese Bewertung liegt außerhalb des
Umfangs von Plan 09-01.

---

## Urteil REQ-17

**Erfüllt nach Plan 09-03.** Die einzige festgehaltene Abweichung (A-1) ist beseitigt und mit
gemessenen Vorher/Nachher-Werten belegt (`09-A1-NACHWEIS.md`: Delta 0,00 für alle drei
Prüfnutzer nach der Angleichung, während userId 16 — ohne `workSchedule` — auch vorher schon
0,00 zeigte, was NO REGRESSION für diesen Nutzertyp bestätigt).

Zusätzlich zur formal als A-1 klassifizierten Abweichung hat Plan 09-03 Task 1 einen weiteren,
funktional verwandten Fund in `server/src/services/overtimeLiveCalculationService.ts:57-68`
korrigiert: Die Funktion `getAllWorkingDaysBetween()` traf dort eine eigene
Arbeitstags-Entscheidung (Feiertagsabfrage + `dayOfWeek >= 1 && dayOfWeek <= 5` als Default für
Nutzer ohne `workSchedule`), statt sich auf `getDailyTargetHours()` zu verlassen. Dieser Fund war
in der ursprünglichen Fundstellen-Tabelle (Abschnitt „overtimeLiveCalculationService.ts — Live-
Anzeige" oben) bereits mit `Weg = Vorfilter vor getDailyTargetHours` und `Produktivpfad = ja`
verzeichnet, wurde in der Abweichungsliste von Plan 09-01 aber nicht als eigenständiges `A-n`
geführt — ein Umstand, der hier zur Nachvollziehbarkeit festgehalten wird, statt stillschweigend
übergangen zu werden. Die fachliche Wirkung war identisch zu A-1: Ein Nutzer mit
`workSchedule.saturday > 0` verlor seinen Samstag, weil der einzige Aufrufer
(`overtimeLiveCalculationService.ts:242`) vor der Umstellung nur `workSchedule` und
`weeklyHours` statt des vollständigen `user`-Objekts weiterreichte. Task 1 hat das behoben und
mit sechs Testfällen abgesichert (`overtimeLiveCalculationService.test.ts`, Commit `348b70f`
RED, `9a984b6` GREEN).

Task 2 hat außerdem die fünf Wochenend-/Feiertags-Vorfilter in `overtimeService.ts` entfernt
(Commit `2826f68`) — auch hier lag `Produktivpfad = ja` bei zwei der fünf Stellen
(`ensureAbsenceTransactionsForMonth` war laut Fundstellen-Tabelle als „nein" (toter Code)
eingestuft, `ensureAbsenceTransactions` dagegen als „ja"), sodass die Angleichung auch dort eine
reale Produktivwirkung hatte.

**Kernpfad weiterhin konsistent, jetzt lückenlos:** Alle Stellen, die laut Fundstellen-Tabelle
`Produktivpfad = ja` UND eine Sollstunden-Ermittlung (nicht nur Pass-Through aus
`overtime_balance`) tragen, lösen jetzt ausschließlich über `getDailyTargetHours()`
(`server/src/utils/workingDays.ts:63`) auf: `unifiedOvertimeService`,
`overtimeLiveCalculationService.ts` (Task 1), `overtimeService.ts` (Task 2),
`server/scripts/fix-overtime.ts` (Task 3, A-1), `overtimeTransactionRebuildService.ts`,
`absenceService.ts` und `exportService.ts`. Siehe `09-ANGLEICHUNG-NACHWEIS.md`, Abschnitt
„Belegkette REQ-18 (D1)", für die vollständige, mit Zeilennummern belegte Aufrufkette vom
Dashboard-Endpunkt bis zur kanonischen Funktion.
