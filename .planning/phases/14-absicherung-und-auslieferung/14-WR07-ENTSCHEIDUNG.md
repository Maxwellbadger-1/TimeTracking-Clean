# WR-07: Entscheidung, Wortlaut vor der Änderung, Gates nach Plan 14-02

**Plan:** 14-02
**Datum:** 2026-08-23
**Ausgangslage:** `.planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-SECURITY.md`, Befund
B-1 (HOCH) — `PUT /api/users/:id` schreibt Periodenwerte an `POST /api/work-periods/change`
und `PUT /api/work-periods/:id` vorbei: ohne Vorschau-Token, ohne Pflichtbegründung, ohne
Kettenprüfung, ohne Rebuild, ohne Journalzeile und ohne `audit_log`-Eintrag.

---

## Entscheidung des Planners: WR-07 wird VOR dem Produktionslauf geschlossen

**Abgewogen wurde gegen die Alternative „geht als bekannter Restposten mit".**

Für das Schließen:

1. Es ist ein Schreibweg an der Perioden-Historie vorbei. Ändert ein Admin nach dem
   Produktionslauf über die normale Nutzerverwaltung die Wochenstunden, entsteht exakt der
   stille Zustand, den dieser Milestone beseitigt: `user_work_periods` trägt neue Werte, es
   gibt keine `model_change`-Buchung, keinen `audit_log`-Eintrag und keine Begründung. Der
   Kontoauszug zeigt eine Saldoänderung ohne Ursache.
2. Der gesamte Milestone geht in **einer** Auslieferung auf die Produktion (siehe
   Plan 14-08: `origin/main` steht auf `0f2a03e`, lokal liegen 337 unveröffentlichte
   Commits). Den Bypass jetzt zu schließen kostet keine zusätzliche Auslieferung. Ihn
   mitzunehmen bedeutet, ihn später in einem eigenen Deployment nachzuziehen.
3. Der Umfang ist begrenzt und vollständig bekannt: der Spiegelungszweig in
   `userService.updateUser()` und fünf der 17 Tests in `userWorkPeriodProvisioning.test.ts`.
4. Das Risiko der Änderung ist beherrschbar, weil die eigene Oberfläche den Weg nicht mehr
   nutzt: `EditUserModal.handleSubmit` schickt `weeklyHours` **unverändert** mit. Genau
   deshalb darf die Abweisung nur bei einer **Wertänderung** greifen, nicht bei bloßer
   Anwesenheit des Feldes — sonst bricht jedes Speichern von Stammdaten.

Gegen das Schließen sprach nur, dass es eine Vertragsänderung an `updateUser()` ist. Das ist
ein Umfangs-, kein Risikoargument, und der Umfang ist gemessen (siehe Punkt 3).

**Betriebliche Zwischenmaßnahme entfällt**, weil der Weg geschlossen wird und nicht mitgeht.

---

## Tatsächlich vorgefundene Zeilennummern (Stand vor der Änderung, `server/src/services/userService.ts`)

- Zeile 589-594: `weeklyHoursChanged` / `workScheduleChanged` / `mustMirrorPeriod` — die
  Bedingung, die künftig abweist statt spiegelt.
- Zeile 599-601: `mirroredWeeklyHours` / `mirroredWorkSchedule` — entfallen mit dem Zweig.
- Zeile 640-673: der Block `if (!mustMirrorPeriod) return;` bis einschließlich
  `DELETE FROM overtime_balance WHERE userId = ?` innerhalb von `applyUpdate = db.transaction(...)`.
- Zeile 613-638: der `hireDateChanged`-Zweig mit `syncStartPeriodToHireDate()` und seinem
  eigenen `DELETE FROM overtime_balance` — bleibt **unverändert**, nicht Teil von WR-07.
- Zeile 697-730: der nachgelagerte Block „If weeklyHours/workSchedule changed, recalculate
  all overtime_balance entries" — wird durch Schritt 2 (Abweisung vor dem SQL-Aufbau)
  unerreichbar und entfällt.
- Zeile 8: Import `updateWorkPeriodValues` aus `workPeriodService.js` — wird nach dem Umbau
  von `userService.ts` nicht mehr gebraucht.
- Zeile 508-519: die beiden Zweige `if (data.weeklyHours !== undefined)` /
  `if (data.workSchedule !== undefined)`, die `weeklyHours = ?` / `workSchedule = ?` in
  `updates`/`values` schieben — nach der Abweisung nur noch für unveränderte Werte
  erreichbar, ersatzloser Wegfall.

## Wortlaut des entfernten Blocks (vor der Änderung, Zeile 556-673)

Der entfernte Kommentarblock trug die Überschrift „WR-07 (Code-Review Phase 13) —
RICHTIGSTELLUNG EINER FALSCHEN ZUSAGE" und hielt fest:

> Hier stand bis zum Code-Review, Phase 12 ersetze diesen Weg durch den Stichtagswechsel
> und „Phase 13 durch die ausdrückliche Aktion ‚Stammdaten korrigieren' mit
> Pflichtbegründung". Beide Aktionen sind gebaut — der Übergangsweg wurde aber NICHT
> entfernt. Der Kommentar las sich, als wäre er erledigt; er war es nicht.
>
> WAS DAS HEISST: Über `PUT /api/users/:id` lässt sich mit veränderten
> `weeklyHours`/`workSchedule` weiterhin das erreichen, was `PUT /api/work-periods/:id`
> unter Vorschau-Token, Pflichtbegründung, Kettenprüfung, Rebuild, Journalzeile und
> audit_log-Eintrag stellt — nur ohne all das. Die eigene Oberfläche nutzt den Weg nicht
> mehr (`EditUserModal.handleSubmit` schickt `weeklyHours` unverändert), über die API ist
> er erreichbar.
>
> WARUM ER (NOCH) STEHT: Das Entfernen ist eine Vertragsänderung an `updateUser()`
> ausserhalb des Änderungsumfangs von Phase 13 und berührt eine eigene Testdatei einer
> früheren Phase (`userWorkPeriodProvisioning.test.ts`). Als ausdrücklicher Restposten
> in PROJECT_STATUS.md geführt („Offene Restposten") statt hier stillschweigend als
> erledigt behauptet.

Der eigentliche Schreibcode dahinter (Zeile 640-673) rief `getCurrentWorkPeriod(id)` auf,
legte bei einem Nutzer ohne Periode über `ensureInitialWorkPeriod()` eine neue an, schrieb
per `updateWorkPeriodValues(currentPeriod.id, mirroredWeeklyHours, mirroredWorkSchedule ?? null)`
die neuen Werte in die offene Periode und löschte anschließend
`overtime_balance WHERE userId = ?`, damit der nächste Zugriff die Aggregatzeilen neu
berechnet. Kein Vorschau-Token, keine Pflichtbegründung, keine `checkPeriodChain()`-Prüfung,
kein `model_change`-Journaleintrag, kein `audit_log`-Eintrag.

Dieser gesamte Absatz — Kommentarblock und Schreibcode — ist mit Plan 14-02 entfernt. An
seine Stelle tritt eine Abweisung mit `WorkPeriodBypassError`, die **vor** dem Aufbau des
SQL-`UPDATE` und **vor** `applyUpdate()` wirft, sobald `weeklyHours` oder `workSchedule`
sich gegenüber dem gespeicherten Wert tatsächlich ändern.

---

## Gates nach Plan 14-02

Vier Pflichtprüfungen, ausgeführt nach Abschluss aller Codeänderungen (Tasks 1+2), wörtlich
protokolliert:

### 1. `cd server && npx tsc --noEmit`

```
(kein Output — Exit 0)
```

### 2. `cd desktop && npx tsc --noEmit`

```
(kein Output — Exit 0)
```

### 3. `cd server && npx vitest run`

```
Test Files  2 failed | 34 passed (36)
     Tests  3 failed | 493 passed (496)
```

Die drei roten Titel sind wörtlich identisch mit dem in `<test_baseline>` des Ausführungsauftrags
benannten Bestand (Referenz: `11-AUSGANGSZUSTAND.md`):
- `src/services/unifiedOvertimeService.test.ts:285` — `expected 40 to be 10`
- `src/services/unifiedOvertimeService.test.ts:340` — `expected 40 to be 10`
- `src/services/vacationBackfillService.test.ts:138` — `expected true to be false`

Kein vierter roter Titel, kein geänderter Titel — kein Abbruchgrund. Die Zunahme von 491
(Baseline vor Plan 14-01) auf 493 grüne Tests erklärt sich durch den einen REQ-32-Testfall aus
Plan 14-01 und den einen zusätzlichen Nachweistest (`WR-07: die Fehlermeldung nennt beide
Ersatzwege woertlich`) aus diesem Plan; die 18 statt vorher 17 Tests in
`userWorkPeriodProvisioning.test.ts` liefern den Rest der Differenz.

### 4. `cd desktop && npm run check:rules`

```
(alle PASS-Zeilen, insgesamt 4 Prüfskripte — Exit 0)
```

Alle vier Gates bestanden. WR-07 ist damit vor dem Produktionslauf geschlossen.

---

## Nachtrag: Audit der verbleibenden Schreibpfade (Sicherheits-Scope dieses Plans)

Nach der Änderung erneut gegen `server/src` geprüft (siehe SUMMARY.md für den vollständigen
Befund): Der einzige verbleibende `UPDATE users`-Aufruf, der `weeklyHours`/`workSchedule`
betrifft, ist die jetzt entfernte Stelle — `grep -rn "weeklyHours|workSchedule"` mit
`update|insert|set ` als Filter liefert außerhalb von Migrationen, Seed-Skripten und dem
mandatory-reason-Pfad (`workPeriodService.ts`, `workPeriodChangeService.ts`,
`workPeriodCorrectionService.ts`) keinen Treffer mehr. Details siehe SUMMARY.md.
