# A-1-Nachweis: `server/scripts/fix-overtime.ts` auf den kanonischen Weg gezogen

**Erstellt:** 2026-08-21 (Plan 09-03, Task 3 — Vorher-Abschnitt; Task 4 ergänzt den Rest)
**Zweck:** Gemessener Vorher/Nachher-Beleg für Abweichung A-1
(`.planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-SOLLSTUNDEN.md`, Abschnitt „A-1"):
`server/scripts/fix-overtime.ts` ermittelte seine Sollstunden bislang selbst
(`targetHoursPerDay = user.weeklyHours / 5`, Zeile 78 der ursprünglichen Fassung) statt über
`getDailyTargetHours()` (`server/src/utils/workingDays.ts:63`). Dieses Dokument belegt die
Wirkung mit gemessenen Zahlen, nicht mit einer Behauptung.

**Messverfahren (bewusst umgedreht, siehe `09-03-PLAN.md` → „Randbedingungen für den Umbau"):**
`npm run validate:overtime:paths` kann A-1 nicht direkt beweisen, weil es im selben Lauf
repariert, was es messen soll — `overtimeService.ts:618` (`getOvertimeSummary()`) ruft darin
`ensureOvertimeBalanceEntries()` auf, bevor `compareOvertimePaths.ts:265` `overtime_balance`
liest. Deshalb: Lesung *vor* dem Werkzeuglauf = Skriptwert, Lesung *nach* dem Werkzeuglauf =
kanonischer Wert. Die Differenz zwischen beiden Lesungen ist A-1, gemessen statt behauptet.

---

## Vorher (Skriptwert) gegen kanonischen Wert

**Datenbasis:** Kopie `server/database/a1-vorher.db` von `server/database/development.db`
(inkl. `-wal`/`-shm`), gezogen vor jeder Codeänderung an `fix-overtime.ts`.
**Build:** `cd server && npm run build` (dist/ existierte vorher nicht im Arbeitsverzeichnis).
**Skriptlauf (unveränderte Fassung, 188 Zeilen):**
`cd server && DATABASE_PATH=./database/a1-vorher.db npx tsx scripts/fix-overtime.ts`
(`NODE_ENV` blieb auf `development`, D5).
**Sofort danach, direkte SQL-Lesung** von `overtime_balance.targetHours`/`actualHours` für die
drei Prüfnutzer aus `09-PRUEFNUTZER.csv` — das sind die Skriptwerte.
**Werkzeuglauf gegen dieselbe Kopie:**
`cd server && DATABASE_PATH=./database/a1-vorher.db npm run validate:overtime:paths -- --from=../.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv --json=../.planning/phases/09-ein-ma-stab-ein-weg/09-A1-VORHER.json`
— Exit-Code **0** (`09-A1-VORHER.json`: `"divergent": false` für alle drei Prüfnutzer; der
Exit-Code sagt hier nichts über A-1 aus, siehe Abschnitt „Warum der Exit-Code allein nichts
beweist" unten — er bestätigt lediglich, dass die fünf Lesewege UNTEREINANDER übereinstimmen,
weil sie zum Lesezeitpunkt bereits alle denselben, gerade frisch geschriebenen kanonischen Wert
lesen).
**Sofort danach, dieselbe direkte SQL-Lesung ein zweites Mal** — das sind die kanonischen Werte.

| userId | Monat | targetHours Skript | targetHours kanonisch | Delta (Skript − kanonisch) |
|---|---|---|---|---|
| 2 (Karin Jochem) | 2026-07 | 23,00 | 25,00 | −2,00 |
| 16 (Benedikt Jochem) | 2026-07 | 138,00 | 138,00 | **0,00** |
| 17 (Carmen Rothemund) | 2026-04 | 43,20 | 40,00 | +3,20 |

Zusätzlich `actualHours` (informativ — der Bypass betrifft laut Inventar `targetHours`, nicht
`actualHours` direkt, wirkt aber über `targetHoursPerDay` auch in `absenceCredits` und
`unpaidLeaveReduction` hinein, siehe `fix-overtime.ts:101,117` der ursprünglichen Fassung):

| userId | Monat | actualHours Skript | actualHours kanonisch |
|---|---|---|---|
| 2 | 2026-07 | 18,50 | 18,50 |
| 16 | 2026-07 | 108,25 | 108,25 |
| 17 | 2026-04 | 31,37 | 36,17 |

**Rechnerische Einordnung der Deltas (Nachvollzug, keine neue Messung):**

- **userId 2 (Karin Jochem):** `workSchedule = {monday:0, tuesday:0, wednesday:0, thursday:5,
  friday:0, saturday:0, sunday:0}`, `weeklyHours = 5`. Juli 2026 hat 5 Donnerstage (2., 9., 16.,
  23., 30.) → kanonisch `5 × 5h = 25h`. Das Skript kennt `workSchedule` nicht und nimmt
  `targetHoursPerDay = weeklyHours / 5 = 1h` für jeden der 23 Werktage (Mo–Fr) im Juli 2026
  (keine Feiertage im Juli) → `23 × 1h = 23h`. Differenz: 2h — der Bypass verteilt Karin
  Jochems 5 Wochenstunden gleichmäßig auf fünf Tage statt sie korrekt auf den Donnerstag zu
  konzentrieren.
- **userId 16 (Benedikt Jochem):** `workSchedule IS NULL`, `weeklyHours = 30`. Für diesen
  Nutzer stimmt `getDailyTargetHours()` selbst mit der Fallback-Formel `weeklyHours / 5 = 6h`
  pro Werktag überein (`workingDays.ts:93`) — genau der Fall, für den der Bypass unsichtbar
  bleibt. Delta = 0,00, wie vor dem Lauf erwartet und schriftlich festgehalten.
- **userId 17 (Carmen Rothemund):** `workSchedule = {monday:4, tuesday:4, wednesday:0,
  thursday:4, friday:0, saturday:0, sunday:0}`, `weeklyHours = 12`. Kanonisch: April 2026 hat
  (nach Abzug des Feiertags Ostermontag, 2026-04-06, der auf einen Montag fällt) 3 Montage
  (13., 20., 27.) + 4 Dienstage (7., 14., 21., 28.) + 5 Donnerstage (2., 9., 16., 23., 30.) →
  `3×4 + 4×4 + 5×4 = 48h` Rohwert vor Abzug des unbezahlten Urlaubs; die
  `UnifiedOvertimeService`-Aufschlüsselung des Werkzeuglaufs weist für April
  `unpaidReduction: 8` aus → `48 − 8 = 40h` kanonisch. Das Skript kennt `workSchedule` nicht,
  verteilt `targetHoursPerDay = 12 / 5 = 2,4h` auf jeden der von `countWorkingDaysBetween()`
  gezählten Werktage und wendet dieselbe flache Formel auch auf die Abwesenheits- und
  Unbezahlt-Reduktion an (`fix-overtime.ts:101,117` der ursprünglichen Fassung) → 43,20h.
  Differenz: 3,20h.

**Erwartung vor dem Lauf (schriftlich festgehalten, bevor eine Zeile Code geändert wurde):**
Für userId 16 darf sich `targetHours` nicht ändern, weil `weeklyHours / 5` für ihn mit
`getDailyTargetHours()` übereinstimmt. Für userId 2 und 17 wird eine Änderung erwartet — sie
ist der Beleg, dass der Bypass real ist. **Eingetreten wie erwartet:** Delta userId 16 = 0,00,
Deltas userId 2 und 17 ≠ 0,00. Kein Blocker.
