# Aufrufer-Teilbeleg: Plan 11-08

**Zweck:** Teilbeleg für die Zusammenführung in Plan 11-09 (Task 3, 11-08-PLAN.md). Enthält
ausschließlich die Fundstellen dieses Plans — dieselbe Spaltenform wie
`11-AUFRUFER-CHECKLISTE.md`: `Fundstelle` (datei:zeile), `Funktion/Kontext`, `Produktivpfad`
(ja/nein, mit Beleg), `Zuständiger Plan`, `Disposition`, `✓`.

`11-AUFRUFER-CHECKLISTE.md` wurde von diesem Plan NICHT verändert (`git diff --name-only`
zeigt für diesen Plan keine Änderung an dieser Datei).

---

## Fundstellen-Tabelle

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/scripts/validateOvertimeDetailed.ts:499` | `validateOvertimeForUser()`, Tagesschleife „Day-by-Day Breakdown" — `getDailyTargetHours(user, dateStr, periods)` | nein (kein Import aus `server/src/routes/`; `npm run validate:overtime:detailed`) | 11-08 | Erledigt: Signatur nachgezogen, EIN `WorkPeriodContext` je Nutzer-/Monatslauf, vor der Schleife erzeugt | ✓ |
| `server/src/scripts/validateOvertimeDetailed.ts:660` | `validateOvertimeForUser()`, Tagesschleife „Absence Credits" — `getDailyTargetHours(user, dateStr, periods)` | nein (wie oben) | 11-08 | Erledigt: derselbe Kontext wie Zeile 499 (kein zweiter Kontext je Schleife) | ✓ |
| `server/src/scripts/validateOvertimeDetailed.ts:708` | `validateOvertimeForUser()`, Tagesschleife „Unpaid Reduction" — `getDailyTargetHours(user, dateStr, periods)` | nein (wie oben) | 11-08 | Erledigt: derselbe Kontext wie Zeile 499 | ✓ |
| `server/src/scripts/validateOvertimeCalculation.ts:199` | `validateUser()` — `calculateTargetHoursForPeriod(userPublic, user.hireDate, referenceDate, periods)` | nein (kein Import aus `server/src/routes/`; `npm run validate:overtime`) | 11-08 | Erledigt: `createWorkPeriodContext()` (echter DB-Nutzer), Kontext einmal je `validateUser()`-Aufruf | ✓ |
| `server/src/scripts/validateOvertimeCalculation.ts:260` | `validateUser()`, Abwesenheits-Kredit — `calculateAbsenceHoursWithWorkSchedule(userPublic, absence.startDate, absence.endDate, periods)` | nein (wie oben) | 11-08 | Erledigt: vier alte Positionsparameter (startDate, endDate, workSchedule, weeklyHours) durch (user, startDate, endDate, periods) ersetzt | ✓ |
| `server/src/scripts/validateOvertimeCalculation.ts:483` | `validateScenario()` — `calculateTargetHoursForPeriod(userPublic, scenario.user.hireDate, scenario.referenceDate, periods)` | nein (Szenario-Modus, synthetische Testdaten) | 11-08 | Erledigt: `stubWorkPeriodContext()` statt `createWorkPeriodContext()`, weil Szenario-Nutzer (in-memory Zähler-ID aus `generateTestData.ts`) nicht in `user_work_periods` existieren — `createWorkPeriodContext()` hätte `MissingWorkPeriodError` geworfen. Beleg für die Notwendigkeit: Probelauf unten (`--scenario=hans-individual-schedule`). `stubWorkPeriodContext()` löst über dieselbe `resolveWorkPeriodIn()` auf wie der echte Kontext — keine zweite Auflösungslogik | ✓ |
| `server/src/scripts/validateOvertimeCalculation.ts:507` | `validateScenario()`, Abwesenheits-Kredit — `calculateAbsenceHoursWithWorkSchedule(userPublic, absence.startDate, absence.endDate, periods)` | nein (wie oben) | 11-08 | Erledigt: wie Zeile 483, derselbe Stub-Kontext | ✓ |
| `server/src/scripts/validateAllTestUsers.ts:84` | `validateUser()`, Zielstunden-Tagesschleife — `getDailyTargetHours(user, dateStr, periods)` | nein (kein Import aus `server/src/routes/`; `npm run validate:all-test-users`) | 11-08 | Erledigt: Signatur nachgezogen, `createWorkPeriodContext()` einmal je `validateUser()`-Aufruf. Produktionsschutz-Lücke dieser Datei (kein `assertNotProduction()`, `new Database('./database/development.db')` fest verdrahtet, ignoriert `DATABASE_PATH`) bewusst NICHT angefasst — siehe 11-08-SUMMARY.md, Abschnitt „Deferred Issues" | ✓ |
| `server/src/scripts/validateAllTestUsers.ts:118` | `validateUser()`, Abwesenheits-Tagesschleife — `getDailyTargetHours(user, dateStr, periods)` | nein (wie oben) | 11-08 | Erledigt: derselbe Kontext wie Zeile 84 | ✓ |
| `server/src/scripts/migrateOvertimeToTransactions.ts:203` | `migrateUserOvertimeTransactions()`, Tagesschleife — `getDailyTargetHours(user, date, periods)` | nein (kein Import aus `server/src/routes/`/`server.ts`; `npm run migrate:overtime`, nicht in `.github/workflows/*.yml`) | 11-08 | Erledigt: `createWorkPeriodContext()` EINMAL je Nutzer-Migrationslauf (vor der Tagesschleife), nicht je Tag. ZUSÄTZLICH (Rule 2, T-11-27): Produktionsschutz nachgerüstet — die Datei importierte `db`/`getDailyTargetHours`/`getUserById` zuvor statisch ohne `assertNotProduction()`, obwohl sie Überstundentransaktionen SCHREIBT; jetzt `assertNotProduction()` synchron vor `ensureDependencies()` (dynamischer Importblock) | ✓ |
| `server/src/scripts/reproduceOvertimeCompDefect.ts:255` | `main()`, `erwarteterAbzug`-Schleife — `calculateAbsenceHoursWithWorkSchedule(userPublic, r.startDate, r.endDate, periods)` | nein (kein Import aus `server/src/routes/`; `npm run repro:overtime-comp`, nicht in `.github/workflows/*.yml`) | 11-08 | Erledigt: `createWorkPeriodContext()` (echter DB-Nutzer, ein Kontext je Lauf). Musste denselben periodengültigen Maßstab wie `absenceService` (Plan 11-07) benutzen, sonst reproduziert das Skript einen selbst erzeugten Defekt | ✓ |

**Zeilenzahl:** 11 Fundstellen (3 `validateOvertimeDetailed.ts` + 4 `validateOvertimeCalculation.ts`
+ 2 `validateAllTestUsers.ts` + 1 `migrateOvertimeToTransactions.ts` + 1
`reproduceOvertimeCompDefect.ts`) — deckt sich mit `11-AUFRUFER-CHECKLISTE.md:277-282`
(„Fehlerliste dieses Abgleichs zeigt 9 direkte Fehlerzeilen für 11-08" + 2 weitere
`validateOvertimeDetailed.ts`-Aufrufstellen, die mit demselben sichtbaren Fehler
zusammenfallen — insgesamt 11).

---

## Grep-Belege je Datei (wörtlich)

### `server/src/scripts/validateOvertimeDetailed.ts`

```
$ grep -n "getDailyTargetHours(user, dateStr, periods)" server/src/scripts/validateOvertimeDetailed.ts
499:    const dailyTarget = getDailyTargetHours(user, dateStr, periods);
660:        const dailyHours = getDailyTargetHours(user, dateStr, periods);
708:        const dailyHours = getDailyTargetHours(user, dateStr, periods);
```

### `server/src/scripts/validateOvertimeCalculation.ts`

```
$ grep -n "calculateTargetHoursForPeriod(\|calculateAbsenceHoursWithWorkSchedule(\|userPublic,\|periods$\|periods)" server/src/scripts/validateOvertimeCalculation.ts
199:  const targetHours = calculateTargetHoursForPeriod(
200:    userPublic,
203:    periods
260:        credit = calculateAbsenceHoursWithWorkSchedule(
261:          userPublic,
264:          periods
483:  const targetHours = calculateTargetHoursForPeriod(
484:    userPublic,
487:    periods
507:      absenceCredits += calculateAbsenceHoursWithWorkSchedule(
508:        userPublic,
511:        periods
```

### `server/src/scripts/validateAllTestUsers.ts`

```
$ grep -n "getDailyTargetHours(user, dateStr, periods)" server/src/scripts/validateAllTestUsers.ts
84:    const dailyTarget = getDailyTargetHours(user, dateStr, periods);
118:      const dailyHours = getDailyTargetHours(user, dateStr, periods);
```

### `server/src/scripts/migrateOvertimeToTransactions.ts`

```
$ grep -n "getDailyTargetHours(user, date, periods)" server/src/scripts/migrateOvertimeToTransactions.ts
203:      const targetHours = getDailyTargetHours(user, date, periods);

$ grep -n "assertNotProduction\|import(" server/src/scripts/migrateOvertimeToTransactions.ts
32:function assertNotProduction(): void {
51:assertNotProduction();
73:    import('../database/connection.js'),
74:    import('../utils/logger.js'),
75:    import('../utils/workingDays.js'),
76:    import('../services/userService.js'),
77:    import('../services/workPeriodContext.js'),
78:    import('../services/overtimeTransactionService.js'),
```

### `server/src/scripts/reproduceOvertimeCompDefect.ts`

```
$ grep -n "calculateAbsenceHoursWithWorkSchedule(" -A4 server/src/scripts/reproduceOvertimeCompDefect.ts
255:    erwarteterAbzug += calculateAbsenceHoursWithWorkSchedule(
256:      userPublic,
257:      r.startDate,
258:      r.endDate,
259:      periods
```

---

## Probeläufe (gegen `server/database/11-werkzeugprobe.db`, NICHT `11-nullwirkung.db`)

### 1. `validateOvertimeDetailed.ts` — Periodenausgabe (Task 1, Beleg für REQ-25)

Befehl:
```
DATABASE_PATH=./database/11-werkzeugprobe.db npx tsx src/scripts/validateOvertimeDetailed.ts --userId=1 --month=2026-01
```

Relevanter Ausschnitt der Ausgabe:
```
👤 USER INFORMATION
────────────────────────────────────────────────────────────────────────────────
Name:          System Administrator
User ID:       1
Hire Date:     2025-11-13
Weekly Hours:  0h
Work Schedule: Standard (Mo-Fr, weeklyHours / 5)

📐 GÜLTIGE PERIODEN (REQ-25 — periodengültiger Maßstab)
────────────────────────────────────────────────────────────────────────────────
  2025-11-13 bis (laufend) — 0h/Woche

📆 CALCULATION PERIOD
────────────────────────────────────────────────────────────────────────────────
From:  2026-01-01
To:    2026-01-31
Days:  31
```

Die Periodenausgabe erscheint vor dem Vergleich, wie im Kopfkommentar (REQ-25-Absatz)
dokumentiert. Datenbestand dieser Probe: 20 Nutzer, jeder mit genau 1 Periode (kein
Modellwechsel im aktuellen Datenbestand — die Ausgabe zeigt trotzdem korrekt die einzige
Periode je Nutzer).

### 2. `validateOvertimeCalculation.ts` — Szenario-Modus (Beleg für `stubWorkPeriodContext()`)

Befehl:
```
DATABASE_PATH=./database/11-werkzeugprobe.db npx tsx src/scripts/validateOvertimeCalculation.ts --scenario=hans-individual-schedule
```

Ausgabe:
```
🧪 Validiere Test-Szenario: hans-individual-schedule
================================================================================
Beschreibung: Hans with individual schedule (Tuesday = 0h)
User: Hans Schmidt
Referenzdatum: 2025-02-07

Erwartet:
  Target: 30:00h
  Actual: 30:00h
  Overtime: +0:00h

Berechnet:
  Target: 30:00h
  Actual: 30:00h
  Overtime: +0:00h

Validierung:
  Target: ✅
  Actual: ✅
  Overtime: ✅

✅ Szenario erfolgreich validiert!
================================================================================
```

Zweiter Lauf zur Absicherung des Abwesenheits-Kredit-Pfads:
```
DATABASE_PATH=./database/11-werkzeugprobe.db npx tsx src/scripts/validateOvertimeCalculation.ts --scenario=vacation-week
```
→ Target 40:00h, Actual 40:00h, Overtime +0:00h — alle drei Validierungen ✅.

Beide Läufe bestätigen: `stubWorkPeriodContext()` liefert für synthetische Szenario-Nutzer
exakt dieselben Werte wie vor dem Umbau (Erwartet == Berechnet), ohne Datenbankzugriff für die
Periodenauflösung.

**Bekannter, vorbestehender Fehler (out of scope, nicht dieser Plan):** Der DB-Modus
(`--userId=`) von `validateOvertimeCalculation.ts` bricht bei einer nachfolgenden, von diesem
Plan nicht berührten Query ab: `SqliteError: no such column: deletedAt` bei der
`time_entries`-Abfrage (`validateOvertimeCalculation.ts:208`, unverändert seit vor diesem
Plan — `git diff HEAD~1` zeigt an dieser Zeile keine Änderung). Der Fehler tritt NACH der
periodenbasierten Zielstunden-Berechnung auf (die also nachweislich fehlerfrei durchläuft,
bevor die unabhängige, vorbestehende Query scheitert). Dokumentiert in
`11-08-SUMMARY.md`, Abschnitt „Deferred Issues".

### 3. `reproduceOvertimeCompDefect.ts`

Befehl:
```
DATABASE_PATH=./database/11-werkzeugprobe.db npx tsx src/scripts/reproduceOvertimeCompDefect.ts --userId=18 --month=2026-01
```

Relevanter Ausschnitt:
```
1. Stammdaten des Nutzers
   Name: Silvia Lachner (userId 18)
   weeklyHours: 20
   workSchedule: {"monday":0,"tuesday":0,"wednesday":8,"thursday":8,"friday":4,"saturday":0,"sunday":0}
   hireDate: 2026-01-01

2. Genehmigte overtime_comp-Anträge im Monat
   id=25 startDate=2026-01-02 endDate=2026-01-02 daysRequired=1

3. erwarteterAbzug (Sollstunden des Ausgleichszeitraums)
   erwarteterAbzug: 4h
...
ERGEBNIS: Der Ausgleich hat den Saldo erreicht (Differenz < 0.01h). Exit 0.
```

2026-01-02 ist ein Freitag; `workSchedule.friday = 4` → `erwarteterAbzug = 4h`, korrekt über
den periodengültigen Kontext berechnet.

### `11-nullwirkung.db` — Unversehrtheitsnachweis

Kein Befehl dieses Plans hat `DATABASE_PATH` auf `11-nullwirkung.db` oder `production.db`
gesetzt (siehe Befehle oben — ausschließlich `11-werkzeugprobe.db`). Kontrolle vor/nach allen
Probeläufen dieses Plans:
```
$ ls -la database/11-nullwirkung.db && md5sum database/11-nullwirkung.db
-rw-r--r-- 1 maxfe 197609 1306624 Aug 22 07:01 database/11-nullwirkung.db
bbb486dbc5756bc2b8d4e82ae5eb3665 *database/11-nullwirkung.db
```
Größe und Zeitstempel unverändert vor und nach allen Läufen dieses Plans.
