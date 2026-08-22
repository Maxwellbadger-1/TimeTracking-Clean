---
phase: 11-datumsabh-ngige-berechnung
fixed_at: 2026-08-22T14:05:00Z
review_path: .planning/phases/11-datumsabh-ngige-berechnung/11-REVIEW.md
iteration: 2
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 11: Bericht zur Code-Review-Korrektur (Durchlauf 2)

**Korrigiert am:** 2026-08-22
**Grundlage:** `.planning/phases/11-datumsabh-ngige-berechnung/11-REVIEW.md` (Durchlauf 2,
Stand `6174c42`/`802a089`)
**Vorgänger:** `11-REVIEW-FIX.iter2.md` (Durchlauf 1, 21 Korrekturen, `470edf3..6174c42`)
**Durchlauf:** 2
**Umfang:** `critical_warning` — 3 Critical + 9 Warning. Die 6 Info-Befunde (IN-01 bis
IN-06) waren nicht im Umfang und sind unten unter „Weiterhin offen" aufgeführt.

**Zusammenfassung:**
- Befunde im Umfang: 12
- Behoben: 12
- Übersprungen: 0

---

## Arbeitsweise

Alle Änderungen entstanden in einem isolierten Git-Worktree auf einem eigenen Zweig
(`gsd-reviewfix/11-iter2`). Jeder Befund wurde einzeln umgesetzt, einzeln nachgemessen und
einzeln festgeschrieben — zwölf Commits, ein Commit je Befund. Der Zweig wurde am Ende per
`--ff-only` auf `main` gezogen; die Vorabfassung dieses Berichts aus Durchlauf 1 liegt
unverändert als `11-REVIEW-FIX.iter2.md` daneben.

Während der Arbeit hat die Vordergrund-Sitzung zweimal auf `main` festgeschrieben
(`fdfdfe3`, `f6fc52a` — beides ausschließlich `.planning/`-Dokumente, kein Quelltext). Der
Fix-Zweig wurde deshalb zweimal auf den neuen Stand von `main` rebasiert; die
Fehlschlagsliste der Testsuite wurde nach dem letzten Rebase erneut geprüft und war
unverändert. Es gab keinen einzigen Konflikt, weil sich die Dateimengen nicht berühren.

---

## Regressionsnachweis

### Ausgangsmessung (im Worktree, vor der ersten Änderung, gegen eine Arbeitskopie von `database/development.db`)

- `npx tsc --noEmit` → **0 Fehler**
- `npx vitest run` → **369 bestanden, 10 fehlgeschlagen** (27 Dateien)

Die 10 Fehlschläge verteilen sich auf `balanceTracking.test.ts` (7),
`unifiedOvertimeService.test.ts` (2) und `vacationBackfillService.test.ts` (1) — dieselbe
Menge, die schon Durchlauf 1 als vorbestehend ausgewiesen hat.

### Abschlussmessung (im Worktree, nach allen zwölf Korrekturen, gegen dieselbe Arbeitskopie)

- `npx tsc --noEmit` → **0 Fehler**
- `npx vitest run` → **369 bestanden, 10 fehlgeschlagen** (27 Dateien)
- Die Menge der fehlgeschlagenen Tests ist **zeichengenau identisch** mit der
  Ausgangsmessung (maschinell verglichen mit `diff` über die sortierte `FAIL`-Liste, nicht
  nur über die Anzahl). Keine Regression.

Diese Messung wurde nach jedem einzelnen Fix wiederholt, der Quelltext außerhalb von
Skripten berührt (WR-01, WR-03, WR-05, WR-06, WR-08, WR-09) — jedes Mal mit demselben
Ergebnis.

### Kontrollmessung im Hauptrepository (nach dem `--ff-only`-Merge)

- `npx tsc --noEmit` → **0 Fehler**
- `npx vitest run` → **376 bestanden, 3 fehlgeschlagen** (27 Dateien)

Die verbliebenen drei sind eine **echte Teilmenge** der zehn aus der Ausgangsmessung:

```
 FAIL  src/services/unifiedOvertimeService.test.ts > … > REGRESSION: User hired on 1st of month should calculate correctly
 FAIL  src/services/unifiedOvertimeService.test.ts > … > should respect hire date and not include pre-employment months
 FAIL  src/services/vacationBackfillService.test.ts > … > erkennt einen bereits gelaufenen Backfill
```

**Warum die Zahlen auseinandergehen — nachgemessen, nicht vermutet:** Die sieben zusätzlich
fehlschlagenden Tests aus `balanceTracking.test.ts` scheitern alle an
`SqliteError: UNIQUE constraint failed: users.email` beim Anlegen ihres Testnutzers
`testuser_balance` / `test@balance.com`. Dieser Nutzer (ID 12877) steckt als Rückstand eines
früheren, abgebrochenen Testlaufs in der Arbeitskopie, die ich zu Beginn in den Worktree
kopiert habe — er hat dort zusätzlich keine Arbeitszeitperiode und war deshalb während der
gesamten Arbeit der praktische Prüffall für alle D4-Pfade. In
`server/database/development.db` des Hauptrepositoriums existiert er nicht:

```
SELECT id,username,email FROM users WHERE username='testuser_balance' … → []
Nutzer ohne Arbeitszeitperiode                                          → []
```

Die Differenz ist damit ein **Datenunterschied zwischen zwei Datenbankdateien**, keine
Code-Wirkung. Die Anzahl der Fehlschläge ist nach den Korrekturen kleiner oder gleich —
die Vorgabe aus `.claude/CLAUDE.md` ist erfüllt.

### Nullwirkungsnachweis über die Testsuite hinaus

Gegen **denselben Datenbestand** wurde der Stand vor den Korrekturen (`802a089`, in einem
zweiten Worktree ausgecheckt) und der Stand danach mit einer gemeinsamen Messsonde
verglichen. Verglichen wurden:

- SHA-256 der vollständigen DATEV-Exportdatei (`2026-01-01` … `2026-08-01`)
- `getAllUsersOvertimeSummary(2026, '2026-03')` — alle Zeilen, alle Zahlen
- `getAggregatedOvertimeStats(2026, '2026-03')`
- `calculateAbsenceHoursWithWorkSchedule()` und `calculateTargetHoursForPeriod()` für
  **jeden** nicht gelöschten Nutzer

Ergebnis: **Die Ausgabe ist vor und nach allen zwölf Korrekturen zeichengleich.**
DATEV-Hash `5bfe0f91b89acf705e1a7a229fb6e536a0959104360b23855f4d36a6419b5cd2`, 602 Zeilen,
Aggregat `{"totalTargetHours":781.2,"totalActualHours":418.08,"totalOvertime":-363.12,"userCount":16}`
— beide Male.

Zusätzlich: `npm run validate:overtime -- --scenario=all` liefert vor und nach den
Korrekturen **byteweise identische** 250 Zeilen Ausgabe.

### Produktionsschutz-Kanarienproben

```
DATABASE_PATH=/home/ubuntu/databases/production.db validateOvertimeCalculation.ts --all
  → "FEHLER: Produktionsschreibzugriff verweigert", Exitcode 2

DATABASE_PATH=/home/ubuntu/databases/production.db checkPeriodChains.ts   (NEU, WR-02)
  → Exitcode 2, bevor eine Datei geöffnet wird
```

---

## Behobene Befunde

### CR-01: Das Validierungswerkzeug bricht in seinem Hauptmodus immer ab

**Geänderte Datei:** `server/src/scripts/validateOvertimeCalculation.ts`
**Commit:** `b97fcb4`

**Was tatsächlich kaputt war — mehr als der Befund benennt.** Der Befund nennt
`deletedAt` in der `time_entries`-Abfrage. Nach dessen Korrektur lief das Werkzeug immer
noch nicht: Die unmittelbar folgende `absence_requests`-Abfrage hat **zwei** falsche
Spaltennamen, die vorher unsichtbar waren, weil SQLite schon beim `prepare()` der
Zeiteintragsabfrage abbrach.

Alle drei Spalten wurden gegen `server/src/database/schema.ts` **und** gegen
`PRAGMA table_info(...)` der Arbeitsdatenbank geprüft:

| Abfrage | Falsch | Tatsächlich | Beleg |
|---|---|---|---|
| `time_entries` | `deletedAt IS NULL` | Spalte existiert nicht | `schema.ts:164-181`, PRAGMA |
| `absence_requests` | `daysRequired` | Spalte heißt `days` | `schema.ts:187`, PRAGMA |
| `absence_requests` | `deletedAt IS NULL` | Spalte existiert nicht | `schema.ts:183-200`, PRAGMA |

**Zur ausdrücklichen Prüffrage „wie werden Zeiteinträge gelöscht":** hart, nicht weich.
Beide Löschwege sind `DELETE FROM time_entries WHERE id = ?` —
`timeEntryService.deleteTimeEntry()` (Zeile 756) und die Abwesenheits-Bereinigung
(Zeile 911). Es bleibt keine Markierung zurück, die diese Abfrage mitzählen könnte; eine
gelöschte Zeile ist physisch weg. Alle übrigen Leser der Tabelle (`overtimeService.ts:474`,
`unifiedOvertimeService.ts:357`, `overtimeTransactionRebuildService.ts:299`,
`timeEntryService.ts:160`) filtern aus demselben Grund ebenfalls nicht. Die Bedingung
entfällt deshalb ersatzlos — mit dieser Begründung im Quelltext, nicht kommentarlos.
Für `absence_requests` gilt dasselbe: Abwesenheiten werden nicht gelöscht, sondern über
`status` geführt; der bereits vorhandene Filter `status = 'approved'` leistet, was die
gedachte Bedingung leisten sollte. Der Alias `days AS daysRequired` behält den in
`generateTestData.ts` benutzten Namen bei — dasselbe Vorgehen wie in
`reproduceOvertimeCompDefect.ts:226`.

**Zweiter Teil, ohne den `--all` weiterhin unbenutzbar wäre:** Nach der Spaltenkorrektur
gab das Werkzeug 18 von 19 Nutzern aus und brach dann bei Nutzer 12877 mit
`MissingWorkPeriodError` ab. Für ein Werkzeug, das den Bestand PRÜFEN soll, ist das die
falsche Reaktion — dieselbe Begründung und dieselbe Behandlung wie in
`verifyPeriodNullEffect.ts:399-413` (WR-13 aus Durchlauf 1): eigene Ergebniskategorie, der
Lauf geht weiter, die Zusammenfassung meldet den Defekt, **Exitcode 1**. Jeder andere
Fehler fliegt unverändert weiter.

**Nachweis (Abschlusslauf, wie im Befund verlangt):**

```
$ DATABASE_PATH=./database/development.db npm run validate:overtime -- --all
⚠️  Nutzer 12877 übersprungen — Datendefekt (D4): Keine Arbeitszeitperiode …
✅ 18 von 19 Benutzern validiert.
❌ 1 Nutzer ohne lückenlose Arbeitszeitperiode (Datendefekt, D4): 12877
Exitcode: 1
```

Vorher: `❌ Error: SqliteError: no such column: deletedAt`, Exitcode 1, kein einziger Nutzer
ausgewertet. Damit ist auch die CR-04-Korrektur aus Durchlauf 1 erstmals überhaupt
ausgeführt worden.

**Nicht behoben, ausdrücklich benannt:** `.claude/CLAUDE.md` verbietet Hard Delete;
`time_entries` verletzt das, und der Kopfkommentar von `deleteTimeEntry()` behauptet
fälschlich „soft delete". Das ist eine Schemaänderung samt Anpassung aller Leser und gehört
nicht in eine Review-Korrektur an einem Validierungswerkzeug. Als Kommentar im Quelltext
festgehalten.

---

### CR-02: Ein unbrauchbares `hireDate` löscht die Salden und verhindert deren Wiederaufbau

**Geänderte Dateien:** `server/src/services/userService.ts`,
`server/src/middleware/validation.ts`
**Commit:** `60971ce`

**Umgesetzte Korrektur — ablehnen statt warnen, an drei Stellen:**

1. Neue Funktion `assertWellFormedHireDate()` in `userService.ts`. Sie prüft nicht nur die
   **Form** (`JJJJ-MM-TT`, dieselbe Prüfung wie das GLOB-CHECK von
   `user_work_periods.validFrom` aus Migration 008), sondern zusätzlich die **kalendarische
   Gültigkeit**: `2026-02-31` und `2026-13-01` passen auf das Muster, sind aber keine
   Kalendertage — `new Date('2026-02-31')` ergibt in JavaScript den 3. März. Die Rückprobe
   läuft über `Date.UTC` und ist damit von der Prozess-Zeitzone unabhängig.
2. Aufruf in `updateUser()` **vor dem Bau der SQL-Anweisung**, also vor jedem
   Schreibvorgang — analog zur bereits vorhandenen `weeklyHours`-Prüfung.
3. `syncStartPeriodToHireDate()`: Der Warn-und-Weiter-Zweig ist ein `throw`. Für den
   Update-Weg ist er damit unerreichbar; er bleibt als Zusicherung für den anderen Aufrufer
   (`mirrorUserToWorkPeriod()`, der ein `hireDate` aus einer bestehenden `users`-Zeile
   weiterreicht) stehen und dokumentiert die Zusage.
4. `validateUserUpdate` in `validation.ts` prüft `hireDate` jetzt ebenfalls und liefert
   HTTP 400 statt HTTP 500 — die Regel ist dort bewusst dupliziert statt importiert, weil
   `userService.ts` die Datenbankverbindung zieht und die Validierungsschicht ohne
   Datenbankzugriff ladbar bleiben soll. Beide Stellen verweisen im Kommentar aufeinander.

**`createUser()` brauchte keine Änderung — nachgeprüft:** Dort geht `data.hireDate` durch
`resolveInitialValidFrom()` und in die Spalte wandert `resolvedHireDate`, also entweder ein
wohlgeformtes Datum oder das Anlagedatum. Ein Müllwert kann auf diesem Weg gar nicht in
`users.hireDate` gelangen.

**Nachweis (Verhaltensprobe gegen die Arbeitskopie):** Neuer Nutzer mit `hireDate`
`2026-03-01` und einem Saldo-Datensatz.

```
  "31.12.2026"  -> abgelehnt: hireDate muss das Format JJJJ-MM-TT haben …
  ""            -> abgelehnt: hireDate muss das Format JJJJ-MM-TT haben …
  "2026-02-31"  -> abgelehnt: hireDate ist kein gültiges Kalenderdatum …
  "2026-13-01"  -> abgelehnt: hireDate ist kein gültiges Kalenderdatum …
hireDate nach den Versuchen: 2026-03-01 | Salden: 1     ← unverändert, nichts gelöscht
gültige Änderung auf 2026-01-01: Perioden [{"validFrom":"2026-01-01"}] | Salden: 0
```

Der letzte Schritt belegt, dass der gewollte Weg unverändert funktioniert: Periode wird
nachgezogen, Saldo wird geleert.

---

### CR-03: Der DATEV-Export liefert stillschweigend unvollständige Dateien

**Geänderte Dateien:** `server/src/services/exportService.ts`,
`server/src/routes/exports.ts`
**Commit:** `3e294c9`

**Entscheidung: Abbruch (Variante a), nicht Warnblock (Variante b).** Begründung, wie im
Auftrag verlangt je Aufrufer entschieden — der einzige Aufrufer ist
`GET /api/exports/datev`:

Empfänger der Datei sind laut Kopfkommentar Steuerberater und Betriebsprüfung (GoBD). Ein
Warnblock am Dateiende hilft dort nicht zuverlässig: DATEV-Importwege lesen die Zeilen
maschinell, ein Kommentarblock wird überlesen oder als Datensatz missdeutet. Eine Datei, die
vollständig aussieht, aber die Zeiteinträge und Abwesenheiten eines Mitarbeiters weglässt,
ist ein prüfungsrelevantes Dokument mit unbemerkter Lücke — schlimmer als ein ausgebliebener
Export.

**Die WR-03-Vereinzelung aus Durchlauf 1 bleibt trotzdem erhalten** und ist damit nicht
umsonst gewesen: Die Nutzerschleife läuft weiterhin vollständig durch und **sammelt** alle
Datendefekte, statt beim ersten abzubrechen. Der Bediener bekommt dadurch in einem Durchgang
die Liste **aller** zu korrigierenden Nutzer, nicht einen nach dem anderen wie im Vorzustand
(500er beim ersten). Nur das stille `continue` am Ende ist durch einen Abbruch ersetzt.

Konkret: neue Fehlerklasse `IncompleteExportError` mit `skippedUserIds`; die Route
unterscheidet sie und antwortet mit **HTTP 409** (Conflict — der Server arbeitet korrekt,
der Bestand widerspricht der Anforderung „vollständiger Export") samt Nutzerliste im
JSON-Feld `skippedUserIds`.

Die im Befund als Mindestmaßnahme genannte Trennung der Abwesenheitsschleife in ein eigenes
`try` entfällt damit gegenstandslos: Es gibt keine Teildatei mehr, aus der Urlaubszeilen
verschluckt werden könnten. Das ist im Quelltext so begründet.

**Nachweis (Kanarienprobe gegen die Arbeitskopie):** Nutzer 12877 hat keine Periode, aber
auch keine Zeiteinträge — der Defekt wird deshalb im Normalfall gar nicht ausgelöst und der
Export läuft durch (602 Zeilen). Für den Nachweis bekam er einen Zeiteintrag:

```
ABBRUCH (erwartet). skippedUserIds = [12877]
Meldung: DATEV-Export abgebrochen: 1 Nutzer haben keine lückenlose Arbeitszeitperiode
         (Datendefekt D4) — Nutzer-IDs: 12877. … Perioden prüfen mit
         `npm run check:period-chains`, danach den Export wiederholen.
Kanarien-Zeiteintrag entfernt: 1
Gegenprobe ohne Defekt: Export erzeugt, Zeilen: 602
```

Der Export ohne Defekt ist byteweise derselbe wie vor der Korrektur (SHA-256 im
Nullwirkungsnachweis oben).

---

### WR-01: Die Zeitzonen-Vereinheitlichung endet an der Funktionsgrenze

**Geänderte Datei:** `server/src/utils/workingDays.ts`
**Commit:** `843a499`

**Drei Stellen, nicht zwei.** Die im Befund genannten zwei wurden korrigiert; bei der
Messung fiel eine dritte in derselben Funktion auf, ohne die die erste wirkungslos geblieben
wäre.

1. **`calculateAbsenceHoursWithWorkSchedule()`, Wochentagsquelle** (Befund):
   `const dayOfWeek = d.getDay()` → `dayIndexFromDateString(dateStr)`. Dieselbe
   Hilfsfunktion, dieselbe Lösung wie bei WR-01 aus Durchlauf 1 in `getDailyTargetHours()`.
2. **`calculateAbsenceHoursWithWorkSchedule()`, Schleifenzeiger** (bei der Messung
   gefunden): Der Zeiger stand als `new Date(startDate + 'T12:00:00')` in der
   Prozess-Zeitzone, der Tagesschlüssel wurde eine Zeile weiter über `formatDateBerlin()`
   gebildet. Die Schleife lief also über andere Tage, als sie auswertete. Ohne diese
   Korrektur wäre Punkt 1 folgenlos geblieben — der Zeitraum war weiterhin verschoben.
   Zeiger jetzt UTC-Mittag, Schlüssel über UTC-Getter; Mittag statt Mitternacht bleibt als
   Sicherheitsabstand gegen Sommerzeitsprünge erhalten.
3. **`isPublicHoliday()`** (Befund): Datumsschlüssel über `getUTCFullYear()/getUTCMonth()/
   getUTCDate()`, passend zur UTC-Konstruktion der beiden Aufrufer. Die lokale Hilfsfunktion
   `formatDate()` heißt jetzt `formatDateUtc()` — der Name trägt die Zeitauffassung und
   verhindert die Verwechslung mit `formatDate()` aus `utils/timezone.ts`.

**Nachweis (gemessen, nicht argumentiert).** Dieselbe Sonde unter vier Zeitzonen, jeweils
vor und nach der Korrektur, gegen dieselbe Datenbank:

| Messwert | TZ | vorher | nachher |
|---|---|---|---|
| `countWorkingDaysBetween('2025-12-22','2026-01-06')` | Europe/Berlin | 8 | 8 |
| dieselbe | America/New_York | **9** | **8** |
| Abwesenheitsstunden, 6 Nutzer, zwei Zeiträume | Europe/Berlin | Referenz | identisch |
| dieselben | UTC | — | identisch zu Berlin |
| dieselben | America/New_York | — | identisch zu Berlin |
| dieselben | Pacific/Kiritimati (UTC+14) | **4 von 12 Werten abweichend** | identisch zu Berlin |

Die 9 unter `America/New_York` ist Neujahr, das als Arbeitstag mitgezählt wurde:

```
Date.UTC(2026,0,1) mit lokalen Gettern  → "2025-12-31"   (alt)
Date.UTC(2026,0,1) mit UTC-Gettern      → "2026-01-01"   (neu)
```

Unter `Europe/Berlin` und `UTC` — den beiden Zeitzonen, in denen dieses System tatsächlich
läuft — ändert die Korrektur **keine einzige Zahl**. Die Nullwirkung ist damit gewahrt und
die Fehlerklasse trotzdem geschlossen.

**Nebenbefund, hier NICHT behoben** (siehe „Weiterhin offen" unten): `countWorkingDaysBetween()`
liefert für `2026-01-01`..`2026-01-31` unter `America/New_York` weiterhin 21 statt 20. Ursache
ist eine dritte, vom Befund nicht erfasste Mischung: Die Bereichsgrenzen werden in
Zeile 432/615 mit **lokalen** Gettern aus einem als UTC geparsten String gebildet. Der
Kommentar dort benennt die Zweideutigkeit ausdrücklich („Use LOCAL get*() when input dates
are Berlin time (from parseDate())") — eine einseitige Umstellung würde die Aufrufer treffen,
die tatsächlich Berlin-lokale `Date`-Objekte übergeben. Das ist ein eigener Befund, kein
Bestandteil von WR-01.

---

### WR-02: `checkAllPeriodChains()` hat keinen Aufrufer

**Geänderte/neue Dateien:** `server/src/scripts/checkPeriodChains.ts` (neu),
`server/src/routes/admin.ts` (neu), `server/src/server.ts`, `server/package.json`,
`server/src/services/workPeriodService.ts`
**Commit:** `c5624d8`

**Zwei der drei vom Befund genannten Wege sind verdrahtet; der dritte ist begründet
abgelehnt** — wie im Auftrag verlangt, nicht ersatzlos gestrichen.

1. **CLI:** `server/src/scripts/checkPeriodChains.ts`, `npm run check:period-chains`.
   Exitcode **1** bei Befunden, **0** ohne, **2** bei Produktionsschutz. Produktionsschutz
   und dynamischer Import nach dem bestehenden Muster.
2. **Admin-Route:** `GET /api/admin/period-chains` (neuer Router, in `server.ts` unter
   `/api/admin` eingehängt). Antwortet immer HTTP 200 mit
   `{ ok, userCount, findingCount, issues }` — ein Defekt IM BESTAND ist kein Fehler DIESER
   Anfrage; das Ergebnis muss auswertbar bleiben. Bei Befunden zusätzlich `logger.error`.
   Dies ist der Weg, der **auch die Produktion abdeckt**: Der Check läuft im ohnehin
   laufenden Serverprozess auf der bereits geöffneten Verbindung und liest nur. Das CLI kann
   das nicht, weil `import('../database/connection.js')` `CREATE TABLE IF NOT EXISTS` /
   `CREATE INDEX IF NOT EXISTS` ausführt und damit schreibt — der Produktionsschutz greift
   dort zu Recht.
3. **Serverstart: bewusst NICHT.** Der Check läuft über alle Nutzer und lädt je Nutzer die
   Periodenliste; das verzögert jeden PM2-Neustart um eine mit dem Bestand wachsende
   Zeitspanne, und ein `logger.error` beim Start ist genau die Meldung, die in einem
   Neustart-Log untergeht. Die Admin-Route liefert dieselbe Aussage auf Abruf. Diese
   Entscheidung steht im Kopf von `checkPeriodChains.ts`, damit sie nicht als Vergessen
   gelesen wird.

Der Kopfkommentar von `checkAllPeriodChains()` nennt die Aufrufer jetzt namentlich; der Satz
„diese Funktion findet denselben Defekt VORHER" ist damit belegt statt behauptet.

**Nachweis:**

```
$ DATABASE_PATH=./database/development.db npm run check:period-chains
❌ 1 Nutzer mit insgesamt 1 Befund(en):
  Nutzer 12877:
    - Nutzer 12877 hat keine einzige Arbeitszeitperiode — jede Sollstunden-Berechnung
      für ihn wirft MissingWorkPeriodError (D4).
Exitcode: 1

# Gegenprobe: Kopie derselben Datenbank, Periode für 12877 ergänzt
✅ Keine Befunde — jeder nicht gelöschte Nutzer hat eine lückenlose Periodenkette …
Exitcode: 0

# Produktionspfad
Exitcode: 2, bevor eine Datei geöffnet wird

# HTTP-Probe der Route (Express-Instanz, Admin-Sitzung vorgetäuscht)
HTTP 200
{"success":true,"data":{"ok":false,"userCount":1,"findingCount":1,
 "issues":[{"userId":12877,"findings":["Nutzer 12877 hat keine einzige …"]}]}}
```

---

### WR-03: Sammelauswertungen melden stillschweigend falsche Summen

**Geänderte Dateien:** `server/src/services/overtimeService.ts`,
`server/src/routes/overtime.ts`, `server/src/types/index.ts`
**Commit:** `1a5ea66`

**Umgesetzte Korrektur:** `ensureOvertimeBalanceEntriesIsolated()` nimmt einen
`Set<number>` entgegen und trägt jeden übersprungenen Nutzer dort ein.
`getAllUsersOvertimeSummary()` liefert `{ users, dataQuality }`,
`getAggregatedOvertimeStats()` liefert `{ stats, dataQuality }`. `dataQuality` ist `null`,
solange kein Nutzer übersprungen wurde.

**Bewusste Abweichung von der Fix-Empfehlung — die Antwortstruktur bleibt unverändert.**
Der Befund schlägt `{ data: [...], dataQuality: {...} }` vor. Das hätte `data` von einem
Array zu einem Objekt gemacht und den Desktop-Client gebrochen; Desktop-Änderungen liegen
laut `11-DESKTOP-DISPOSITION.md` ausdrücklich in Phase 12. Stattdessen bleibt `data` exakt
das, was es war (Array bzw. Kennzahlenobjekt), und `dataQuality` steht **daneben** im
`ApiResponse`-Umschlag — rein additiv, für bestehende Clients unsichtbar, für jeden neuen
Auswerter sofort lesbar. Das Feld erscheint nur, wenn tatsächlich etwas fehlt. Der optionale
Eintrag ist in `ApiResponse` typisiert und dort begründet.

Der Meldetext nennt die betroffenen `userId`s, sagt ausdrücklich „die ausgewiesenen Summen
sind entsprechend zu klein" und verweist auf `GET /api/admin/period-chains` bzw.
`npm run check:period-chains` (WR-02) als nächsten Schritt.

**Nachweis:**

```
all-users:   Zeilen = 19 | dataQuality = {"skippedUserIds":[12877],
             "reason":"missing_work_period","message":"Unvollständige Auswertung: 1 Nutzer …"}
  Zeile des defekten Nutzers: {"userId":12877,…,"targetHours":0,"actualHours":0,"totalOvertime":0}
aggregated:  stats = {"totalTargetHours":781.2,…,"userCount":16}
             dataQuality = {"skippedUserIds":[12877],…}
```

Die 0/0/0-Zeile bleibt in der Liste — `dataQuality` ist das Einzige, was sie von einem
echten Nullwert unterscheidet, und genau das war der Mangel.

**Nicht enthalten:** die vom Befund ergänzend gewünschte Darstellung als Warnbanner in der
Oberfläche. Das ist eine Desktop-Änderung und gehört nach Phase 12.

---

### WR-04: Falscher Typ statt `any` in `unifiedOvertimeService`

**Geänderte Datei:** `server/src/services/unifiedOvertimeService.ts`
**Commit:** `fc4fab9`

**Umgesetzte Korrektur:** die vom Befund als erste genannte Variante — `vacationDaysPerYear`,
`status`, `privacyConsentAt` und `createdAt` in die SELECT-Liste aufnehmen, exakt wie
`absenceService.ts:772-777` es bereits tut. Der Rückgabetyp bleibt damit `UserPublic`, was
`getDailyTargetHours(user: UserPublic, …)` ohnehin verlangt; die zweite Variante (engerer
Zeilentyp) hätte diesen Aufruf gebrochen. Die abschließende `as UserPublic`-Zusicherung ist
entfallen — die Form stimmt jetzt ohne Nachhelfen und der Compiler prüft sie wieder.

**Nachweis:** Die Abfrage liefert gegen die Arbeitskopie alle 16 Pflichtfelder von
`UserPublic`; die Prüfung „fehlende Pflichtfelder" meldet **keine**. `unifiedOvertimeService.test.ts`
unverändert 19 bestanden / 2 vorbestehend fehlgeschlagen.

---

### WR-05: `getPublicHolidays()` verschluckt Fehler

**Geänderte Datei:** `server/src/utils/workingDays.ts`
**Commit:** `ae28383`

**Umgesetzte Korrektur:** `console.error(...) + return []` → `logger.error({ err: error, year }, …)`
und `throw error`. Beide vom Befund benannten Mängel sind damit weg: kein stiller Rückfall
auf „keine Feiertage" mehr (der Feiertage zu Arbeitstagen machte und die Sollstunden anhob),
und der letzte `console.*`-Aufruf dieser Datei ist verschwunden.

**Nachweis (Kanarienprobe):** `countWorkingDaysBetween()` mit einer Verbindung ohne
`holidays`-Tabelle:

```
vorher:  stiller Rückfall, Ergebnis = <Zahl ohne Feiertagsabzug>
nachher: Fehler wird weitergeworfen: no such table: holidays
         + strukturierter logger.error mit err/year
```

`grep -n "console\." src/utils/workingDays.ts` findet nur noch Treffer in Kommentaren.

---

### WR-06: Fehlerobjekte unter dem Schlüssel `error` werden zu `{}`

**Geänderte Dateien:** `server/src/scripts/migrateOvertimeToTransactions.ts`,
`server/src/scripts/seedTestUsers.ts`, `server/src/utils/logger.ts`
**Commit:** `f39c015`

**Beide vom Befund genannten Maßnahmen umgesetzt:**

1. Die sechs namentlich genannten Zeilen (`migrateOvertimeToTransactions.ts:155,169,264,269,352`
   und `seedTestUsers.ts:739`) schreiben jetzt `{ err: error }`.
2. **Dauerlösung** in `logger.ts`: `serializers: { err: pino.stdSerializers.err, error:
   pino.stdSerializers.err }`. Damit tragen beide Schlüssel. Das ist wichtiger als die sechs
   Zeilen: Im Projekt stehen **über 25 weitere** `{ error }`-Aufrufe (u. a.
   `migrationRunner.ts`, `yearEndRolloverService.ts`, `websocket/server.ts`,
   `absenceService.ts`), die sonst weiter leere Objekte protokolliert hätten.

**Verträglichkeit nachgeprüft, nicht angenommen:** `pino.stdSerializers.err` gibt Werte, die
keine `Error`-Instanz sind, unverändert zurück. Das ist relevant, weil z. B.
`timeEntryService.ts:575` eine Zeichenkette unter `error` protokolliert.

**Nachweis (gemessen, `NODE_ENV=production`, also JSON-Ausgabe):**

```
vorher:   {"level":50,…,"error":{},"msg":"Schlüssel \"error\" VOR dem Fix"}
nachher:  Schlüssel "error" -> {"type":"Error","message":"Kaputt: Testfall WR-06","stack":"…"}
          Schlüssel "err"   -> {"type":"Error","message":"Kaputt: Testfall WR-06","stack":"…"}
          Schlüssel "error" mit Zeichenkette -> "nur ein Text"
```

---

### WR-07: Der Unversehrtheitsnachweis deckt die riskanteste Schreibphase nicht ab

**Geänderte Datei:** `server/src/scripts/verifyPeriodNullEffect.ts`
**Commit:** `f20e0f4`

**Alle drei Punkte des Befunds umgesetzt:**

1. **Zwei Phasen, drei Hashes.** `shaAtStart` wird **vor** dem dynamischen Import gebildet
   (deckt die Schemainitialisierung ab: `initializeDatabase()`, `createIndexes()`,
   `verifyIndexes()` und in der Folge Migrationen), `shaBefore` nach Import und
   `wal_checkpoint(TRUNCATE)`, `shaAfter` am Ende nach dem zweiten Checkpoint. Phase A
   (Verbindungsaufbau) und Phase B (Messlauf) werden **getrennt** ausgewiesen. Lag beim
   Start eine gefüllte WAL-Datei vor, meldet das Werkzeug für Phase A ausdrücklich
   „NICHT BEURTEILBAR" statt eine nicht belegbare Aussage zu treffen — der Checkpoint würde
   in diesem Fall fremden Inhalt einfalten.
2. **`daysChecked`** wird im `catch` nicht mehr erhöht. An einem Tag ohne Periode findet
   kein Vergleich statt; `altDailyTargetHours()` wird nicht einmal gerufen.
3. **Zusammenfassung** weist beide Mengen nebeneinander aus.

**Nachweis — und der Fix hat sofort etwas gefunden.** Gegen eine frische Wegwerfkopie
(`VACUUM INTO`, WAL-konsistent):

```
Tage verglichen: 3967 — davon abweichend: 0
Tage NICHT verglichen (keine Periode, Abzug): 203 — Summe betrachteter Tage: 4170
Phase B — Messlauf: unverändert
Phase A — Schemainitialisierung: VERÄNDERT — der Verbindungsaufbau hat geschrieben
                                 (CREATE TABLE/INDEX, Migrationen)
```

Vorher hätte dieselbe Ausgabe „geprüfte Tage 4170" und „Unversehrtheit: ja" gemeldet. Beides
war falsch: 203 Tage waren gar nicht verglichen, und der Verbindungsaufbau **hat**
geschrieben. Zweiter Lauf gegen dieselbe, nun initialisierte Kopie:

```
Phase A — Schemainitialisierung: unverändert
Gesamturteil (nur bei beurteilbarer Phase A): ja — Datei unverändert
```

Damit ist beides belegt: Der Nachweis kann fehlschlagen, und er schlägt nur dann fehl, wenn
tatsächlich geschrieben wurde.

---

### WR-08: Die Migration meldet Erfolg trotz Fehlern

**Geänderte Datei:** `server/src/scripts/migrateOvertimeToTransactions.ts`
**Commit:** `534be6d`

**Beide Punkte des Befunds umgesetzt, plus ein Nebenbefund, ohne den der erste Punkt auf
diesem Rechner gar nicht prüfbar gewesen wäre:**

1. **Exitcode:** `stats.errors` wird jetzt ausgewertet. Erfolg (Exitcode 0) nur bei
   `verification.success && stats.errors.length === 0`. Die Fehlerzahl erscheint zusätzlich
   in der Abschlussmeldung.
2. **Abbruch:** Der `catch` gibt den erreichten Stand aus — verarbeitete Nutzer von gesamt,
   verarbeitete Tage, geschriebene Buchungen — strukturiert im Log und als Klartextzeile auf
   der Konsole. Der Halbzustand ist im Kopfkommentar unter „SAFE TO RUN MULTIPLE TIMES"
   ausdrücklich benannt: transaktional ist der **Tag**, nicht der **Lauf**.
3. **Nebenbefund (bei der Verifikation gemessen):** Der CLI-Einstieg lautete
   `import.meta.url === \`file://${process.argv[1]}\``. Unter Windows steht in
   `process.argv[1]` ein Pfad mit Laufwerksbuchstaben und Rückschrägstrichen, in
   `import.meta.url` eine `file:///C:/…`-URL — der Vergleich ist dort **immer falsch**, und
   `npm run migrate:overtime` tat schlicht nichts, ohne Ausgabe und mit Exitcode 0. Unter
   Linux traf die Bedingung zu, weshalb es nie auffiel. Behoben mit
   `pathToFileURL(process.argv[1]).href` — plattformunabhängig, ohne Verhaltensänderung
   unter Linux. Ohne diese Korrektur wäre Punkt 1 auf einem Windows-Arbeitsplatz nicht
   einmal erreichbar gewesen.

**Nachweis:**

```
# Lauf gegen Wegwerfkopie, Verifikation findet Abweichungen
⚠️⚠️⚠️ MIGRATION COMPLETED WITH ISSUES ⚠️⚠️⚠️   → Exitcode 1   (vorher: lief gar nicht)

# Lauf mit erzwungenem Datendefekt (Zeiteintrag für Nutzer 12877 ohne Periode)
⚠️ ABBRUCH — bereits festgeschrieben: 18 von 19 Nutzern, 577 Tage, 515 Buchungen.
   Der Bestand steht zwischen altem und neuem Stand; ein erneuter Lauf nach Behebung
   der Ursache stellt ihn vollständig her (das Skript rechnet vor dem Löschen).
Exitcode: 1
```

**Dasselbe CLI-Muster steht unkorrigiert in** `src/database/test-indexes.ts`,
`src/scripts/backfillOvertimeBalances.ts` und `src/scripts/syncWorkTimeAccounts.ts`. Diese
drei sind nicht Gegenstand des Befunds und wurden nicht angefasst — der Punkt steht unten
unter „Weiterhin offen" und als Kommentar im korrigierten Skript.

---

### WR-09: Die Saldolöschung steht außerhalb der Klammer und schluckt ihren Fehler

**Geänderte Datei:** `server/src/services/userService.ts`
**Commit:** `09518fb`

**Umgesetzte Korrektur:** die vom Befund bevorzugte Variante — `DELETE FROM overtime_balance`
ist in `applyUpdate()` gezogen, direkt hinter `syncStartPeriodToHireDate()`. Die Reihenfolge
bleibt damit erhalten (erst Periode nachführen, dann Salden löschen), und
`db.prepare(...).run()` ist synchron, passt also in die better-sqlite3-Transaktion, die kein
`await` verträgt. Das `try/catch` mit „Don't fail the update" ist ersatzlos entfallen: Ein
Fehlschlag rollt jetzt die gesamte Änderung zurück und erreicht den Aufrufer.

An der alten Stelle steht ein Kommentar, der den Umzug und seinen Grund benennt; die dort
verbliebenen Seiteneffekte sind genau die, die tatsächlich asynchron sind und deshalb nicht
in eine better-sqlite3-Transaktion passen.

**Nachweis (Atomizität, gegen die Arbeitskopie).** Nutzer mit zwei Saldo-Datensätzen und
**geschlossener** Periode, damit der Spiegel-Zweig **nach** der Saldolöschung wirft:

```
Vorher:  hireDate = 2026-01-01 | Salden = 2 | offene Perioden = 0
Transaktion abgebrochen (erwartet): updateUser: Nutzer … hat auch nach
  ensureInitialWorkPeriod keine offene Periode.
Nachher: hireDate = 2026-01-01 | Salden = 2 | weeklyHours = 40
```

Alle drei Werte sind unverändert — die bereits ausgeführte Löschung wurde mit
zurückgerollt. Zusätzlich die Gegenprobe aus CR-02: Eine gültige `hireDate`-Änderung führt
die Periode weiterhin nach und leert die Salden wie vorgesehen.

---

## Hinweise für die menschliche Nachprüfung

Zwei Korrekturen ändern das nach außen sichtbare Verhalten und sollten fachlich bestätigt
werden, bevor die Verifikationsphase beginnt. Beide sind durch Syntax- und Testprüfung
allein nicht abschließend zu belegen:

- **CR-03 — der DATEV-Export bricht jetzt ab (HTTP 409) statt eine Datei auszuliefern.**
  Das ist die vom Befund vorgeschlagene Variante (a) und für ein GoBD-Dokument die richtige,
  aber es ist eine Verhaltensänderung an einem Endpunkt, den Administratoren benutzen. Auf
  dem heutigen Bestand tritt sie nicht ein (der einzige Nutzer ohne Periode hat keine
  Zeiteinträge im Exportzeitraum); sobald ein Datendefekt auftritt, bekommt der
  Administrator statt einer Datei eine 409-Antwort mit Nutzerliste. Wer stattdessen
  Variante (b) will (Datei plus Warnblock), muss das entscheiden — die Stelle ist im
  Quelltext klar markiert.

- **CR-02 — `PUT /api/users/:id` weist ein unbrauchbares `hireDate` jetzt mit HTTP 400 ab.**
  Vorher lief derselbe Aufruf mit HTTP 200 durch. Ein Client, der versehentlich ein
  deutsches Datumsformat sendet, bekommt jetzt eine Fehlermeldung statt einer stillen
  Datenzerstörung. Das ist die Absicht, ändert aber die Schnittstelle.

Ergänzend, weniger dringlich:

- **WR-09** verschärft das Fehlerverhalten von `updateUser()`: Scheitert die Saldolöschung,
  scheitert der gesamte Aufruf. Vorher blieb er erfolgreich. Das ist gewollt (der stille
  Halbzustand war der Befund), sollte aber bekannt sein.
- **WR-05** lässt `getPublicHolidays()` werfen. Falls es im Betrieb einen Pfad gibt, in dem
  die `holidays`-Tabelle legitim fehlen darf, würde dort jetzt eine Ausnahme fliegen statt
  eine falsche Zahl entstehen. In der geprüften Codebasis existiert ein solcher Pfad nicht.

---

## Weiterhin offen — nicht behoben, weil außerhalb des Befundumfangs

**Bei dieser Arbeit neu gefunden, im Review nicht enthalten:**

1. **`countWorkingDaysBetween()` / `countWorkingDaysForUser()`: Bereichsgrenzen aus lokalen
   Gettern.** `workingDays.ts:432-433` und `:615-616` bilden `startUTC`/`endUTC` mit
   `getFullYear()/getMonth()/getDate()` aus einem `Date`, das aus einem `YYYY-MM-DD`-String
   als UTC-Mitternacht entstanden ist. Unter negativem Zeitzonenversatz beginnt der Bereich
   dadurch einen Tag zu früh (gemessen: 21 statt 20 Arbeitstage im Januar 2026 unter
   `America/New_York`). Nicht behoben, weil die Aufrufer teils Berlin-lokale `Date`-Objekte
   übergeben (der Kommentar an Ort und Stelle benennt genau diese Zweideutigkeit) — eine
   einseitige Umstellung wäre eine Wette, keine Korrektur. Eigener Befund für den nächsten
   Durchlauf.
2. **CLI-Einstieg unter Windows in drei weiteren Skripten:** `src/database/test-indexes.ts`,
   `src/scripts/backfillOvertimeBalances.ts`, `src/scripts/syncWorkTimeAccounts.ts` benutzen
   dasselbe `import.meta.url === \`file://${process.argv[1]}\``, das unter Windows nie
   zutrifft. Diese Skripte tun dort beim direkten Aufruf nichts, ohne Fehlermeldung.
   Behebung identisch zu WR-08 (`pathToFileURL`).
3. **`deleteTimeEntry()` behauptet im Kopfkommentar „soft delete", löscht aber hart.**
   `time_entries` und `absence_requests` haben keine `deletedAt`-Spalte; `.claude/CLAUDE.md`
   verbietet Hard Delete. Das ist eine Schema- und Architekturfrage, keine
   Review-Korrektur — bei CR-01 im Quelltext festgehalten.

**Aus dem Review, außerhalb des Umfangs `critical_warning`:**

4. Die sechs Info-Befunde **IN-01 bis IN-06**. Anzumerken ist, dass IN-06
   (`validateAllTestUsers.ts` bricht beim ersten Nutzer ohne Periode ab) inhaltlich der
   Zwilling dessen ist, was in CR-01 für `validateOvertimeCalculation.ts` behoben wurde —
   dieselbe Behandlung ließe sich dort mit wenigen Zeilen übernehmen. IN-03 (`db.close()`
   auf der geteilten Verbindung) betrifft dieselbe Datei wie CR-01 und wurde dort bewusst
   nicht mitgeändert.

**Aus früheren Durchläufen:**

5. **WR-12 aus Durchlauf 1** (Desktop-Vorschau rechnet mit dem heutigen Stammdatensatz) —
   laut `11-DESKTOP-DISPOSITION.md` ausdrücklich Phase 12.
6. Die vorbestehenden Testfehlschläge in `unifiedOvertimeService.test.ts` (2) und
   `vacationBackfillService.test.ts` (1).
7. Ein Rückstand aus einem abgebrochenen Testlauf in manchen Arbeitskopien: Nutzer
   `testuser_balance` (`test@balance.com`) ohne Arbeitszeitperiode. Er lässt
   `balanceTracking.test.ts` mit `UNIQUE constraint failed: users.email` scheitern und ist
   die Ursache der 7 zusätzlichen Fehlschläge in der Worktree-Messung. Im
   Hauptrepositorium ist er nicht vorhanden. `npm run check:period-chains` (neu, WR-02)
   findet ihn jetzt.

---

## Commits

| Befund | Commit | Geänderte Dateien |
|---|---|---|
| CR-01 | `b97fcb4` | `scripts/validateOvertimeCalculation.ts` |
| CR-02 | `60971ce` | `services/userService.ts`, `middleware/validation.ts` |
| CR-03 | `3e294c9` | `services/exportService.ts`, `routes/exports.ts` |
| WR-01 | `843a499` | `utils/workingDays.ts` |
| WR-02 | `c5624d8` | `scripts/checkPeriodChains.ts` (neu), `routes/admin.ts` (neu), `server.ts`, `package.json`, `services/workPeriodService.ts` |
| WR-03 | `1a5ea66` | `services/overtimeService.ts`, `routes/overtime.ts`, `types/index.ts` |
| WR-04 | `fc4fab9` | `services/unifiedOvertimeService.ts` |
| WR-05 | `ae28383` | `utils/workingDays.ts` |
| WR-06 | `f39c015` | `utils/logger.ts`, `scripts/migrateOvertimeToTransactions.ts`, `scripts/seedTestUsers.ts` |
| WR-07 | `f20e0f4` | `scripts/verifyPeriodNullEffect.ts` |
| WR-08 | `534be6d` | `scripts/migrateOvertimeToTransactions.ts` |
| WR-09 | `09518fb` | `services/userService.ts` |

Alle Pfade relativ zu `server/src/` bzw. `server/`.

---

_Korrigiert: 2026-08-22_
_Bearbeiter: Claude (gsd-code-fixer)_
_Durchlauf: 2_
