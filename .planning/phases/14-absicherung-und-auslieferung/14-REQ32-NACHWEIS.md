# REQ-32 — Nachweisliste der fünf Wechselfälle

**Wortlaut REQ-32** (`.planning/REQUIREMENTS.md`, Zeile 111-113):

> Tests decken ab: Reduzierung (40→20) mit Stichtag in der Zukunft, Erhöhung mit
> rückwirkendem Stichtag, Stichtag mitten im Monat, Wechsel über einen Jahreswechsel
> hinweg, Periode löschen und danach neu rechnen.

Diese Datei weist jeden der fünf Fälle einzeln nach — Datei, vollständiger `it(...)`-Titel,
per `grep -n` bestätigte Zeilennummer, und die wörtliche `vitest`-Ausgabezeile eines
einzelnen, benannten Testlaufs (`npx vitest run -t "<Titel>"`). Kein Sammellauf, kein
pauschales „Tests grün".

## Tabelle der fünf Fälle

| # | REQ-32-Fall | Fundstelle | `it(...)`-Titel | Nachweislauf |
|---|---|---|---|---|
| 1 | Reduzierung (40→20), Stichtag in der Zukunft | `workPeriodChangeService.test.ts:172` | `REQ-28: Ein Stichtag in der Zukunft laesst jede Buchung davor unveraendert und erzeugt keine model_change-Buchung` | `Tests  1 passed \| 493 skipped (494)` |
| 2 | Erhöhung, Stichtag rückwirkend | `workPeriodChangeService.test.ts:284` | `REQ-32: Eine Erhoehung der Wochenstunden mit rueckwirkendem Stichtag senkt den Saldo und laesst jede Buchung vor dem Stichtag unveraendert` | `Tests  1 passed \| 494 skipped (495)` |
| 3 | Stichtag mitten im Monat | `workPeriodChangeService.test.ts:642` | `Stichtag mitten im Monat: midMonthEffective ist true, ein Tag davor traegt das alte, ein Tag ab dem Stichtag das neue Tagessoll` | `Tests  1 passed \| 493 skipped (494)` |
| 4 | Wechsel über einen Jahreswechsel | `workPeriodChangeService.test.ts:735` | `Wechsel ueber einen Jahreswechsel: affectedMonths deckt zwei Kalenderjahre ab, der Lauf endet ohne Fehler` | `Tests  1 passed \| 493 skipped (494)` |
| 5 | Periode löschen und danach neu rechnen | `workPeriodDeletionService.test.ts:180-264` | `Zusicherung A/B/C/D — Umstellung eintragen, loeschen: der TATSAECHLICH BERECHNETE Saldo ist danach auf die Minute genau wieder der Stand von vorher (nicht nur die Journalsumme). Eine Gegenbuchung, die tatsaechlich in eine Summe eingeht, wuerde die Rueckabwicklung verdoppeln — Zusicherung A wuerde dann um genau balanceDelta danebenliegen.` | `Tests  1 passed \| 493 skipped (494)` |

**Einzelläufe, wörtlich (Ausführung `cd server && npx vitest run -t "<Titel>"`):**

Fall 1 (`-t "REQ-28: Ein Stichtag in der Zukunft laesst jede Buchung davor unveraendert und erzeugt keine model_change-Buchung"`):
```
 Test Files  1 passed | 35 skipped (36)
      Tests  1 passed | 493 skipped (494)
```

Fall 3 (`-t "Stichtag mitten im Monat: midMonthEffective ist true, ein Tag davor traegt das alte, ein Tag ab dem Stichtag das neue Tagessoll"`):
```
 Test Files  1 passed | 35 skipped (36)
      Tests  1 passed | 493 skipped (494)
```

Fall 4 (`-t "Wechsel ueber einen Jahreswechsel: affectedMonths deckt zwei Kalenderjahre ab, der Lauf endet ohne Fehler"`):
```
 Test Files  1 passed | 35 skipped (36)
      Tests  1 passed | 493 skipped (494)
```

Fall 5 (`-t "Zusicherung A/B/C/D"`):
```
 Test Files  1 passed | 35 skipped (36)
      Tests  1 passed | 493 skipped (494)
```

Fall 2 (`-t "REQ-32: Eine Erhoehung der Wochenstunden mit rueckwirkendem Stichtag"`):
```
 Test Files  1 passed | 35 skipped (36)
      Tests  1 passed | 494 skipped (495)
```

## Warum vier Fälle nicht neu gebaut werden

Am Code nachgeprüft (nicht aus PATTERNS.md übernommen): Jeder `createEmployee(...)`-Aufruf
in `workPeriodChangeService.test.ts` legt den Nutzer mit `weeklyHours = 40` an; jeder
**erfolgreiche** `applyWorkTimeChange`-Aufruf setzt einen **kleineren** Zielwert (20/25/30).
Die einzigen Aufrufe mit einem größeren Zielwert stehen (Stand vor Task 2) in
Validierungstests, die vor dem Schreiben abbrechen (nach Task 2s Verlängerung der Datei:
Zeile 828 `doppelter Stichtag`, Zeile 937 `Tagesplan ausserhalb 0..24`, Zeile 1089 `isNoOp`).
Ein Lauf „von wenig auf viel" wurde damit vor diesem Plan nirgends geschrieben und nirgends
geprüft — Task 2 hat genau diese Lücke mit dem neuen `it`-Block bei Zeile 284 geschlossen.

Für die vier übrigen Fälle existieren bereits einzeln benannte, laufende Tests aus Phase 12
und 13 — sie decken exakt den in REQ-32 verlangten Fall ab (Reduzierung mit künftigem
Stichtag, Stichtag mitten im Monat, Jahreswechsel, Löschen-und-neu-rechnen) und wurden
oben einzeln, nicht als Sammelbehauptung, gegen die aktuelle Datei nachgewiesen.

## Gates nach Plan 14-01

Vier Pflichtprüfungen, wörtlich protokolliert. Alle vier bestanden.

**1. `cd server && npx tsc --noEmit`** — Exit 0, keine Ausgabe.

**2. `cd desktop && npx tsc --noEmit`** — Exit 0, keine Ausgabe.

**3. `cd server && npx vitest run`** — genau 3 rote Tests, Titel unverändert gegenüber
`11-AUSGANGSZUSTAND.md`; grüne Zahl 492 (Ausgangsstand 491 + der eine neue REQ-32-Test):
```
 FAIL  src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > ... > should respect hire date and not include pre-employment months
AssertionError: expected 40 to be 10 // Object.is equality
 ❯ src/services/unifiedOvertimeService.test.ts:285:39

 FAIL  src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > REGRESSION: User hired on 1st of month should calculate correctly
AssertionError: expected 40 to be 10 // Object.is equality
 ❯ src/services/unifiedOvertimeService.test.ts:340:39

 FAIL  src/services/vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill
AssertionError: expected true to be false // Object.is equality
 ❯ src/services/vacationBackfillService.test.ts:138:35

 Test Files  2 failed | 34 passed (36)
      Tests  3 failed | 492 passed (495)
```
Die drei Titel stimmen wörtlich mit `11-AUSGANGSZUSTAND.md` überein — kein vierter roter
Test, keine Titeländerung. Diese drei sind PRE-EXISTING und nicht Gegenstand dieses Plans.

**4. `cd desktop && npm run check:rules`** — Exit 0, alle `PASS:`-Zeilen, kein `FAIL`.
