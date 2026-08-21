# A-1-Nachweis: `server/scripts/fix-overtime.ts` auf den kanonischen Weg gezogen

**Erstellt:** 2026-08-21 (Plan 09-03, Task 3 — Vorher-Abschnitt; Task 4 vollständig)
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

---

## Nachher (Skriptwert) gegen kanonischen Wert

**Datenbasis:** Frische Kopie `server/database/a1-nachher.db` von `server/database/development.db`
(inkl. `-wal`/`-shm`), gezogen NACH der Angleichung in Task 3. `a1-vorher.db` wurde bewusst
nicht weiterverwendet — sie enthält bereits kanonisch überschriebene Zeilen aus dem
Werkzeuglauf in Task 3 und wäre kein sauberer Ausgangspunkt für einen zweiten Vorher-Vergleich.

**Skriptlauf (geänderte Fassung, nutzt `ensureOvertimeBalanceEntries()` aus
`overtimeService.ts:669` — im Plan-Interfaces-Abschnitt zum Zeitpunkt der Planerstellung noch
als `overtimeService.ts:684` benannt; Task 2 hat die Datei durch die Entfernung der fünf
Vorfilter um 19 Zeilen gekürzt, die Funktion selbst wurde nicht verschoben, nur ihre Zeilennummer):**
`cd server && DATABASE_PATH=./database/a1-nachher.db npx tsx scripts/fix-overtime.ts`
(`NODE_ENV` blieb `development`, D5). Exit-Code des Skriptlaufs: **0**, 18 aktive Nutzer
verarbeitet (siehe Konsolenausgabe „✅ DONE!" / „📊 Users processed: 18").
**Sofort danach, direkte SQL-Lesung** derselben drei Zeilen — das sind die (jetzt kanonisch
berechneten) Skriptwerte.

**Werkzeuglauf gegen dieselbe Kopie:**
`cd server && DATABASE_PATH=./database/a1-nachher.db npm run validate:overtime:paths -- --from=../.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv --json=../.planning/phases/09-ein-ma-stab-ein-weg/09-A1-NACHHER.json`
— Exit-Code **0** (`09-A1-NACHHER.json`: `"divergent": false` für alle drei Prüfnutzer).
**Sofort danach, dieselbe direkte SQL-Lesung ein zweites Mal** — das sind die kanonischen Werte.

| userId | Monat | targetHours Skript (nachher) | targetHours kanonisch (nachher) | Delta |
|---|---|---|---|---|
| 2 (Karin Jochem) | 2026-07 | 25,00 | 25,00 | **0,00** |
| 16 (Benedikt Jochem) | 2026-07 | 138,00 | 138,00 | **0,00** |
| 17 (Carmen Rothemund) | 2026-04 | 40,00 | 40,00 | **0,00** |

| userId | Monat | actualHours Skript (nachher) | actualHours kanonisch (nachher) | Delta |
|---|---|---|---|---|
| 2 | 2026-07 | 18,50 | 18,50 | 0,00 |
| 16 | 2026-07 | 108,25 | 108,25 | 0,00 |
| 17 | 2026-04 | 36,17 | 36,17 | 0,00 |

**Ergebnis: Für alle drei Prüfnutzer ist das Delta zwischen Skriptwert und kanonischem Wert
nach der Angleichung 0,00 — kein verbleibendes Delta, keine Ausnahme zu benennen.** Das
Skript berechnet keine eigene Zahl mehr; es ruft dieselbe Funktion auf, die auch Dashboard und
Berichte verwenden, und liest deshalb zwangsläufig denselben Wert wie der kanonische
Vergleichslauf unmittelbar danach.

---

## Wirkung je Prüfnutzertyp

**Nutzer ohne `workSchedule` (userId 16, Benedikt Jochem, `weeklyHours = 30`):** Vorher-Delta
0,00, Nachher-Delta 0,00 — für diesen Nutzertyp war der Bypass strukturell unsichtbar, weil
`weeklyHours / 5` und `getDailyTargetHours()` für ihn dieselbe Formel anwenden
(`workingDays.ts:80-93`, Stufe 3+4+5). Die Angleichung ändert für ihn nichts — genau das war
die vor dem Lauf schriftlich festgehaltene Erwartung, und sie ist eingetreten. Das ist der
Beleg, dass die Angleichung NO REGRESSION für diesen Nutzertyp einhält.

**Nutzer mit `workSchedule` (userId 2 und 17, Karin Jochem und Carmen Rothemund):**
Vorher-Deltas von −2,00h (Karin Jochem, Juli 2026) und +3,20h (Carmen Rothemund, April 2026),
Nachher-Delta bei beiden 0,00. Die gemessene Änderung ist der Beleg, dass der Bypass real war:
Vor der Angleichung berechnete `fix-overtime.ts` für beide Nutzer eine falsche Sollstundenzahl
(gleichmäßige `weeklyHours / 5`-Verteilung statt der individuellen `workSchedule`-Verteilung);
nach der Angleichung stimmt der Wert exakt mit dem kanonischen Wert überein, weil dieselbe
Funktion (`ensureOvertimeBalanceEntries()`, `overtimeService.ts:669`) beide berechnet.

**Zusammenfassung:** Die Angleichung wirkt genau dort, wo sie laut Inventar wirken muss
(Nutzer mit individuellem `workSchedule`), und wirkt nicht dort, wo sie laut NO REGRESSION
nicht wirken darf (Nutzer ohne `workSchedule`, reine `weeklyHours`-Berechnung).

---

## Warum der Exit-Code allein nichts beweist

`getOvertimeSummary()` (`server/src/services/overtimeService.ts:603`: `await
ensureOvertimeBalanceEntries(userId, endMonth);` — Zeile 618 im Stand zum Zeitpunkt der
Planerstellung, vor der Vorfilter-Entfernung in Plan 09-03 Task 2, die die Datei um 19 Zeilen
kürzer gemacht hat) ruft `ensureOvertimeBalanceEntries()` auf, **bevor**
`compareOvertimePaths.ts:265` (`.prepare('SELECT overtime FROM overtime_balance WHERE userId
= ? AND month = ?')`) die Zeile `balance_row` liest. Die Erhebung des `dashboard`-Wegs in
`compareOvertimePaths.ts:239` läuft über exakt diese Funktion. Eine von `fix-overtime.ts`
falsch geschriebene `overtime_balance`-Zeile wird also im selben Lauf des Vergleichswerkzeugs
überschrieben, bevor sie gelesen wird — der Exit-Code von `npm run validate:overtime:paths`
kann A-1 deshalb weder beweisen noch widerlegen. Das gilt für den Vorher- UND den Nachher-Lauf
gleichermaßen; beide zeigen Exit-Code 0, unabhängig vom Zustand von `fix-overtime.ts`.

**Trotzdem genannt, weil er der Regressionswächter dieser Änderung ist, nicht der A-1-Beleg:**

| Lauf | Datenbasis | Exit-Code `validate:overtime:paths` |
|---|---|---|
| Vorher (Task 3, unveränderte Skriptfassung) | `a1-vorher.db` | 0 |
| Nachher (Task 4, geänderte Skriptfassung) | `a1-nachher.db` | 0 |

Beide Exit-Codes sind 0, weil die fünf Lesewege zum Lesezeitpunkt bereits alle denselben,
gerade frisch geschriebenen kanonischen Wert lesen (siehe Erklärung oben) — nicht, weil A-1
bereits vor Task 3 unwirksam gewesen wäre. Der eigentliche A-1-Beleg ist ausschließlich die
direkte SQL-Lesung von `overtime_balance.targetHours` unmittelbar nach dem jeweiligen
Skriptlauf, in den Abschnitten „Vorher" und „Nachher" oben.

---

## Auslieferungslogik (Übergabe an Phase 14)

`server/scripts/fix-overtime.ts` ist kein isoliertes Werkzeug, sondern fest in den
Deployment-Workflow verdrahtet (`.github/workflows/deploy-server.yml`, Zeilen 110-132,
**in Phase 9 nicht geändert**):

- **`deploy-server.yml:118`:** `DATABASE_PATH=$DATABASE_PATH NODE_ENV=production npx tsx
  scripts/fix-overtime.ts || {` — das Skript läuft bei **jedem** Deployment (jedem `git push`
  nach `main`, der `server/**` betrifft) gegen die Produktionsdatenbank.
- **Zeile 119-120** fängt einen Fehlschlag ab (`echo "⚠️  Overtime fix had issues, but
  continuing deployment..."`) und lässt das Deployment trotzdem weiterlaufen — ein
  fehlschlagender Lauf blockiert den Rollout nicht, fällt aber auch nicht auf (siehe
  Bewertung im `<threat_model>` dieses Plans, T-09-03-A1-R).
- **Zeile 123-130** installiert bei **jedem** Deployment einen täglichen Cronjob neu:
  ```
  CRON_COMMAND="0 3 * * * cd /home/ubuntu/TimeTracking-Clean/server && DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production npx tsx scripts/fix-overtime.ts >> /home/ubuntu/logs/overtime-fix.log 2>&1"
  ```
  (Zeile 125) und schreibt ihn mit
  ```
  (crontab -l 2>/dev/null | grep -v "fix-overtime.ts"; echo "$CRON_COMMAND") | crontab -
  ```
  (Zeile 127). Der Cron läuft täglich um 3 Uhr und trägt `DATABASE_PATH` bereits explizit
  gesetzt — das WAL-Problem aus `.planning/debug/db-stabilisierung-20260818.md` ist damit
  entschärft (siehe Abschnitt „Korrektur an STATE.md" unten).

**Phase 9 ändert diesen Workflow ausdrücklich nicht.** `git diff --name-only` bestätigt, dass
`.github/workflows/deploy-server.yml` in keinem Commit dieses Plans auftaucht. Die Angleichung
in Task 3 betrifft ausschließlich den Inhalt von `fix-overtime.ts` selbst — die
Auslieferungslogik (wann und wie es läuft) ist unverändert.

**Offene Frage für Phase 14** (nicht Gegenstand von Plan 09-03, hier nur schriftlich
übergeben): Wird der tägliche Cron (`deploy-server.yml:123-130`) überhaupt noch gebraucht,
nachdem `ensureOvertimeBalanceEntries()` ohnehin bei jedem Dashboard- und Berichtsaufruf
on-demand läuft? Belegstellen für das On-Demand-Verhalten:
`server/src/services/overtimeService.ts:603` (`getOvertimeSummary()`, aufgerufen aus
`server/src/routes/overtime.ts`) und die beiden weiteren `ensureOvertimeBalanceEntries()`-Aufrufer
in `overtimeService.ts:886` und `:896`. Der tägliche Cron liefe dann redundant zur
On-Demand-Berechnung — ob das absichtlich als Vorwärmung/Konsistenz-Netz gedacht ist oder ein
Überbleibsel aus der Zeit vor `UnifiedOvertimeService` ist, ist eine Bewertung, die außerhalb
des Umfangs von Phase 9 liegt (Auslieferungslogik, siehe Objective dieses Plans).

---

## Korrektur an STATE.md

**Bisheriger Wortlaut** (`.planning/STATE.md`, Tabelle „Zurückgestellte Punkte", Zeile zu
`db-stabilisierung-20260818`, Spalte „Weiterbehandlung"):
> Restpunkt: Cron mit `DATABASE_PATH` reaktivieren

**Neuer Wortlaut:**
> Kein Restpunkt: Cron läuft weiter, wird bei jedem Deployment neu installiert
> (`deploy-server.yml:123-130`) und trägt `DATABASE_PATH` bereits gesetzt
> (`deploy-server.yml:125`) — siehe `09-A1-NACHWEIS.md`

**Begründung mit Zeilenbeleg:** Der bisherige Wortlaut unterstellt, der Cron sei deaktiviert
und müsse reaktiviert werden. Das ist falsch. `deploy-server.yml:123-130` installiert den Cron
bei **jedem** Deployment neu (`crontab -l 2>/dev/null | grep -v "fix-overtime.ts"; echo
"$CRON_COMMAND" | crontab -`, Zeile 127) — der Cron war zu keinem Zeitpunkt dauerhaft
deaktiviert, er wird lediglich bei jedem Deploy-Lauf ersetzt. `CRON_COMMAND` in Zeile 125
enthält `DATABASE_PATH=/home/ubuntu/databases/production.db` bereits fest codiert. Das
WAL-Problem vom 18.08.2026 (`.planning/debug/db-stabilisierung-20260818.md`: fehlendes
`DATABASE_PATH` führte zu einer zweiten WAL/SHM-Datei auf demselben Pfad über den entfernten
Symlink) ist damit für den Cron bereits entschärft, seit der Symlink am 20.08.2026 entfernt
wurde. Es gibt nichts zu „reaktivieren" — der einzig offene Punkt war A-1, und der ist mit
diesem Plan behoben.
