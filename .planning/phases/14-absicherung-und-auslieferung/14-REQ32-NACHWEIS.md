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
| 2 | Erhöhung, Stichtag rückwirkend | OFFEN — wird in Task 2 geschlossen | `REQ-32: Eine Erhoehung der Wochenstunden mit rueckwirkendem Stichtag senkt den Saldo und laesst jede Buchung vor dem Stichtag unveraendert` | OFFEN — wird in Task 2 geschlossen |
| 3 | Stichtag mitten im Monat | `workPeriodChangeService.test.ts:577` | `Stichtag mitten im Monat: midMonthEffective ist true, ein Tag davor traegt das alte, ein Tag ab dem Stichtag das neue Tagessoll` | `Tests  1 passed \| 493 skipped (494)` |
| 4 | Wechsel über einen Jahreswechsel | `workPeriodChangeService.test.ts:670` | `Wechsel ueber einen Jahreswechsel: affectedMonths deckt zwei Kalenderjahre ab, der Lauf endet ohne Fehler` | `Tests  1 passed \| 493 skipped (494)` |
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

Fall 2 (Erhöhung mit rückwirkendem Stichtag): **OFFEN — wird in Task 2 geschlossen.**

## Warum vier Fälle nicht neu gebaut werden

Am Code nachgeprüft (nicht aus PATTERNS.md übernommen): Jeder `createEmployee(...)`-Aufruf
in `workPeriodChangeService.test.ts` legt den Nutzer mit `weeklyHours = 40` an; jeder
**erfolgreiche** `applyWorkTimeChange`-Aufruf setzt einen **kleineren** Zielwert (20/25/30).
Die einzigen Aufrufe mit einem größeren Zielwert stehen in Validierungstests, die vor dem
Schreiben abbrechen (Zeile 769 `doppelter Stichtag`, Zeile 897 `Tagesplan ausserhalb 0..24`,
Zeile 1035 `isNoOp`). Ein Lauf „von wenig auf viel" wird damit nirgends geschrieben und
nirgends geprüft.

Für die vier übrigen Fälle existieren bereits einzeln benannte, laufende Tests aus Phase 12
und 13 — sie decken exakt den in REQ-32 verlangten Fall ab (Reduzierung mit künftigem
Stichtag, Stichtag mitten im Monat, Jahreswechsel, Löschen-und-neu-rechnen) und wurden
oben einzeln, nicht als Sammelbehauptung, gegen die aktuelle Datei nachgewiesen.
