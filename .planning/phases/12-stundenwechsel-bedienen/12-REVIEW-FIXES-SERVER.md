---
phase: 12-stundenwechsel-bedienen
fixed: 2026-08-22
scope: server
source_review: .planning/phases/12-stundenwechsel-bedienen/12-REVIEW-SERVER.md
findings_in_scope: 20
fixed_count: 20
not_confirmed: 0
skipped: 0
status: all_fixed
---

# Phase 12: Fix-Bericht Server

**Quelle:** `12-REVIEW-SERVER.md` (6 Critical, 14 Warning im Auftrag; die 6 Info-Befunde
waren ausdrücklich außerhalb des Auftrags und sind unberührt geblieben)

**Ergebnis:** 20 von 20 Befunden behoben. Kein Befund als „nicht bestätigt" eingestuft —
jeder war beim Nachlesen im Code real.

## Regressionsschranke (Ausgangs- gegen Endzustand)

| Prüfung | Vorher | Nachher |
|---------|--------|---------|
| `cd server && npx tsc --noEmit` | sauber | sauber |
| `cd desktop && npx tsc --noEmit` | sauber | sauber |
| `cd server && npx vitest run` | 403 grün / 3 rot / 406 | **418 grün / 3 rot / 421** |

Die drei roten sind unverändert genau die bekannten, vorbestehenden:
2× `unifiedOvertimeService.test.ts` (hire-date-Regression), 1× `vacationBackfillService.test.ts`
(„erkennt einen bereits gelaufenen Backfill"). **Die rote Menge ist nicht gewachsen.**
15 neue Testfälle sind dazugekommen.

Keine Desktop-Datei wurde angefasst (`git show --stat` je Commit: ausschließlich `server/`).

---

## Commits

| Commit | Befunde |
|--------|---------|
| `e3869d8` | CR-05, WR-07 |
| `ca1d722` | CR-03 |
| `98e832f` | CR-04 |
| `4aa26c6` | CR-01, CR-02, CR-06 |
| `329856a` | WR-01 |
| `5d8055e` | WR-02 |
| `ff894a0` | WR-03 |
| `bdf76ed` | WR-04 |
| `46ed434` | WR-05 |
| `ef11cfa` | WR-06 |
| `bb1afc5` | WR-13 |
| `351a28a` | WR-08, WR-10 |
| `495869b` | WR-09, WR-14 (Teil 1) |
| `ec7bd02` | WR-11, WR-12 |
| `d5d179f` | WR-14 (Teil 2) |

---

## Critical

### CR-01 — `model_change` doppelte den Differenzbetrag in allen Summenpfaden

**Gewählte Richtung:** die vom Review empfohlene. `model_change` ist eine **reine
Journalzeile**: sie dokumentiert den Betrag, den die Umstellung bewirkt hat, ist aber keine
zusätzliche Rechengröße — die Wirkung steckt bereits in den vom Rebuild neu geschriebenen
Tageszeilen. Die Buchung selbst bleibt bestehen (D4: genau eine Buchung, keine Umrechnung
des angesparten Saldos); sie wird aus jedem Summenpfad ausgeschlossen und das ist am
Dateikopf von `overtimeTransactionService.ts` mit voller Begründung dokumentiert
(Konstante `EXCLUDE_JOURNAL_ONLY_TYPES` macht jede Fundstelle greppbar).

Ausgeschlossen in:

| Lesepfad | Datei |
|----------|-------|
| `getOvertimeBalanceAtDate()` | `overtimeTransactionService.ts` |
| `getAggregatedOvertimeStats()` | `overtimeTransactionService.ts` |
| `getMonthlyTransactionSummary()` — **previousBalance UND Fensterinhalt** | `overtimeTransactionService.ts` |
| `getBalanceBeforeDate()` (privat) | `overtimeTransactionService.ts` |
| `getBalanceBeforeDate()` | `overtimeTransactionManager.ts` |
| `getPreviousMonthBalance()` | `overtimeTransactionRebuildService.ts` (CR-02) |

`getOvertimeBalance()` ist unverändert — die Funktion liest `overtime_balance`, nicht
`overtime_transactions`. Die reinen Anzeige-Abfragen (`getOvertimeHistory()`,
`getOvertimeHistoryByDateRange()`) sind ebenfalls unverändert: dort **muss** die Zeile
erscheinen, genau dafür ist sie da (REQ-29).

**Kontoauszug (Lesepfad 1, der produktive):** Hier war eine eigene Entscheidung nötig, weil
`calculateLiveOvertimeTransactions()` die Tageszeilen aus den Rohdaten mit den **aktuell**
gültigen Perioden neu rechnet — der Differenzbetrag ist darin also schon enthalten. Die
Journalzeile wird jetzt mit `hours: 0` angehängt; ihr dokumentierter Betrag steht im neuen,
nicht summierten Feld `documentedDelta`. Die Zeile bleibt damit vollständig sichtbar
(Datum, Typ-Badge, Beschreibung, Admin, `createdAt` — alles unverändert), und die
geforderte Invariante gilt wieder:

> **Summe der angezeigten Zeilen == der daneben angezeigte Saldo.**

Die Beschreibung wurde bewusst **nicht** angetastet, weil `12-UI-SPEC.md` Zeile 282 ihren
Wortlaut festlegt; der Betrag steht deshalb in einem eigenen Feld statt im Text.

**Nachweis (Auftragsvorgabe „REQ-29-Test erweitern"):** zwei neue Testfälle in
`workPeriodChangeService.test.ts`:

1. *„CR-01: Die model_change-Zeile wird in KEINEM transaktionssummierenden Lesepfad
   mitgezählt"* — prüft `Summe(calculateLiveOvertimeTransactions()) ≈
   calculateCurrentOvertimeBalance()` über denselben Zeitraum, dazu
   `getMonthlyTransactionSummary()` und `getOvertimeBalanceAtDate()` vor und nach dem
   gezielten Löschen genau dieser einen Zeile.
2. *„CR-01: Ein Wechsel VOR dem Fenster der Monatlichen Entwicklung"* — der Fall, der vorher
   über `previousBalance` doppelt zählte; deckt zusätzlich `getAggregatedOvertimeStats()` ab.

**Schärfe belegt (nicht behauptet):**
- `hours: 0` im Kontoauszug testweise zurückgenommen → `AssertionError: expected 152 to be +0`.
- Filter in `getAggregatedOvertimeStats()` testweise durch `WHERE 1=1` ersetzt →
  `AssertionError: expected { totalUsers: 18, … } to deeply equal { totalUsers: 17, … }`.
Beide Verfälschungen wurden unmittelbar zurückgenommen.

### CR-02 — `model_change` vergiftete die Laufsaldo-Kette

`getPreviousMonthBalance()` (Rebuild) und `getBalanceBeforeDate()` (Manager und Service)
überspringen `model_change`. In `workPeriodChangeService` stehen `balanceBefore` und
`balanceAfter` der Journalzeile jetzt auf der **Journal-Skala** — geholt über genau die
Funktion, die auch der Rebuild verwendet (`getBalanceBeforeDate` ist dafür aus
`overtimeTransactionManager.ts` exportiert; kein zweiter Abfrageaufbau, kein Dual
Calculation System). Beide Felder tragen denselben Wert: die Zeile verschiebt den Laufsaldo
der Kette um 0. Damit ist auch die vom Review benannte Unstimmigkeit weg, dass `balanceAfter`
den Saldo *vor* dem Einfügen der eigenen Zeile trug.

Nachweis: `expect(journalRow.balanceAfter).toBe(journalRow.balanceBefore)` im CR-01-Testfall.

### CR-03 — Ungültige Kalenderdaten in `validFrom`

Neu: `isRealCalendarDate()` in `server/src/utils/validation.ts` — Monatslänge inklusive
Schaltjahr über `new Date(y, m, 0).getDate()`, rein lokale Kalenderfelder, kein
`toISOString()`. Eingesetzt in `workPeriodChangeService.validateInput()` **und** in
`workPeriodService.assertDateFormat()`, damit der Weg über andere Aufrufer
(`createWorkPeriod`, `closeWorkPeriod`) nicht offen bleibt.

Nachweis: neuer Testfall über `2026-02-31`, `2026-13-45`, `0000-00-00`, `2025-02-29`, je im
Speicher- und im Vorschaupfad, mit Schreibwirkungs-Gegenprobe.

### CR-04 — Kein Wertebereich für den Tagesplan

Neu: `server/src/utils/workSchedule.ts` als **eine** Stelle (`WEEKDAY_KEYS`,
`MAX_DAILY_HOURS = 24`, `MAX_WEEKLY_HOURS = 60`, `isWorkSchedule`, `sumWorkScheduleHours`).
Route und Service importieren sie; die beiden wortgleichen, lückenhaften Kopien sind
entfernt. Zusätzlich prüft `validateInput()` die **Wochensumme** des Tagesplans gegen 60 —
sonst wäre die Grenze über sieben Tage à 24 h weiterhin umgehbar.

`workPeriodService.isWorkSchedule()` blieb bewusst unangetastet: der prüft Tagespläne, die
aus der **Datenbank** gelesen werden; ihn zu verschärfen würde Bestandszeilen unlesbar machen.

Nachweis: vier unzulässige Pläne (−100, 25, 8.5e15, Wochensumme 168) plus Gegenprobe mit
einem zulässigen 30-h-Plan.

### CR-05 — Wirkungsloser `referenceType`-CHECK

`'x' IN ('a', NULL)` ergibt in SQL NULL, nicht FALSE; ein CHECK schlägt nur bei FALSE fehl.
Das `NULL` in der IN-Liste hob die Prüfung vollständig auf.

- Migration 011 legt die Liste jetzt ohne `NULL` an.
- Neue **Migration 012** baut die Tabelle in Bestandsdatenbanken neu auf und zieht
  Migration 006 mit (deren `type`-Liste ist eine echte Teilmenge). Unzulässige Bestandswerte
  werden vorab erhoben, protokolliert und auf NULL gesetzt, damit der Kopiervorgang nicht den
  Serverstart blockiert; die Buchungszeilen selbst bleiben erhalten.

Nachweis: `012_fix_reference_type_check_constraint.test.ts` (5 Tests), **inklusive
Gegenprobe**, dass die alte Tabellenform jeden erfundenen `referenceType` akzeptierte.
Zusätzlich gegen eine **Kopie von `development.db`** ausgeführt: 2723 Zeilen vorher wie
nachher, Constraint danach wirksam (`CHECK constraint failed: referenceType IN (…)`), alle
drei Indizes neu angelegt.

### CR-06 — `createTransaction()` konnte still `null` liefern

Im Speicherpfad ist ein `null` bei `balanceDelta !== 0` jetzt ein Fehlerzustand und rollt die
gesamte Transaktionsklammer zurück (D4 verlangt genau eine Buchung, D7 die Atomarität).
Die Fehlermeldung nennt Nutzer, Stichtag und Betrag.

---

## Warnings

### WR-01 — UTC-Monatsfilter in `getOvertimeBalance()`
Vergleichsmonat kommt als gebundener Parameter aus `formatDate(getCurrentDate(), 'yyyy-MM')`
(Europe/Berlin) statt aus `strftime('%Y-%m','now')` (UTC). `grep` bestätigt: keine weitere
`strftime('%Y-%m','now')`-Fundstelle im Server.

### WR-02 — Zukunftsmonate behielten das alte Sollmodell
**Bewusste Entscheidung, wie vom Review verlangt:** Monate mit einer **bereits vorhandenen**
`overtime_balance`-Zeile jenseits von `rangeEnd` werden mit neu gerechnet. Neue
Zukunftsmonate anzulegen wäre falsch (sie erzeugten ein volles Monatssoll ohne Ist);
vorhandene stehenzulassen ebenso. `preview.affectedMonths` bleibt der zusammenhängende
**Anzeige**-Zeitraum (Vertrag mit dem Desktop unverändert); die Zukunftsmonate stehen in der
internen Liste `rebuildMonths`. `balanceDelta` ändert sich dadurch nicht, weil
`getOvertimeBalance()` Zukunftsmonate ausblendet — im Test mit abgesichert.

### WR-03 — Keine Rückwirkungsgrenze, `/preview` nur am allgemeinen Limiter
- `validateInput()`: Stichtag nicht weiter zurück als der **Beginn des Vorjahres**
  (höchstens 24 betroffene Monate). Steht nach der `hireDate`-Prüfung, damit deren Meldung
  Vorrang behält.
- Neuer `workTimeChangePreviewLimiter` (30/min in Produktion, 10.000/min in Entwicklung wie
  die übrigen Limiter), direkt an `POST /preview` vor der Rollenprüfung.
- Der Fehlertext ist neu formuliert — `12-UI-SPEC.md` kennt für diesen Fall keinen
  Textbausteine; er folgt dem Register der übrigen Meldungen.

### WR-04 — `reason` ohne Grenze und Bereinigung
500 Zeichen Obergrenze, Ablehnung von C0-/C1-Steuerzeichen (Tabulator, Zeilenvorschub und
Wagenrücklauf bleiben erlaubt — das Feld ist im Dialog eine `textarea`), und gespeichert wird
`input.reason.trim()` in Periodennotiz **und** Journaltext.

**Zur Spannung mit `12-UI-SPEC.md` Zeile 285 („kein Trimmen"):** Diese Regel steht dort im
Abschnitt Kontoauszug und begründet sich mit `formatDescription()` im Desktop — sie betrifft
den **Anzeigepfad** (kein Umformatieren von Datumsmustern beim Rendern), nicht das
Abschneiden umgebender Leerzeichen beim Schreiben. Die Validierung rechnete ohnehin schon
ausschließlich mit `trim()`-Längen; gespeichert wurde bisher die Rohfassung — das war die
eigentliche Inkonsistenz.

### WR-05 — Kein `audit_log`-Eintrag
Eintrag `entity = 'work_period_change'`, `entityId` = Perioden-ID, `userId` = handelnder
Admin (Muster aus `overtimeCorrectionsService.deleteOvertimeCorrection()`), `changes` mit
betroffenem Nutzer, Stichtag, Zeitraum, Vor- und Nachwerten, Sollstunden, Salden,
`balanceDelta`, Begründung und Buchungs-ID. Liegt **innerhalb** derselben
Transaktionsklammer (D7): ein zurückgerollter Wechsel hinterlässt keinen Eintrag, der
Trockenlauf schreibt keinen — beides im Test abgesichert.

Nebenbefund beim Umsetzen: `audit_log.userId` zeigt per FOREIGN KEY auf `users(id)` **ohne**
`ON DELETE CASCADE`. Das Testaufräumen musste entsprechend ergänzt werden, sonst hätte das
Löschen des Testadmins an der Fremdschlüsselprüfung gescheitert.

### WR-06 — `typePriority` kannte die eigenen Typen nicht
`time_entry: 1` und `unpaid_deduction: 2` ergänzt, die nie erzeugten `earned` und
`unpaid_adjustment` entfernt, `|| 99` durch `?? 99` ersetzt (sonst fiel Priorität 0 für
`feiertag` durch den falsy-Test ebenfalls auf 99).

### WR-07 — `schema.ts` und Migration 011 erzeugten unterschiedliche Tabellen
`balanceBefore REAL` und `balanceAfter REAL` in `schema.ts` ergänzt. Migration 006 prüft die
Spalten vor dem Kopieren (`pragma table_info`) und nimmt danach den `hasBalanceColumns`-Zweig
— der Migrationspfad bleibt unverändert lauffähig. Der bestehende Paritätstest für
`user_work_periods` bleibt grün.

### WR-08 — Ablehnungsgrund des Tokens wurde verworfen
`logger.warn` mit `reason`, `userId`, `adminId` und `validFrom`. Die HTTP-Antwort bleibt für
alle drei Gründe bewusst **einheitlich** (kein Orakel für einen Angreifer); protokolliert
werden ausschließlich IDs und der Grund, keine Begründungstexte (T-12-26).

### WR-09 — Token band weder Sitzung noch verbrauchte sich
`adminId` steht jetzt in der kanonischen Zeichenkette; beide Routen reichen
`req.session.user!.id` durch. `TOKEN_VERSION` von `v1` auf `v2` angehoben, weil sich das
Signaturformat geändert hat — ein noch offenes `v1`-Token wird als `malformed` abgewiesen
(409 `PREVIEW_STALE`, die Oberfläche rechnet neu). Das Zeitfenster dafür ist höchstens
15 Minuten nach dem Rollout.

**Der Einmalverbrauch bleibt offen** (siehe UAT-Punkte): Er verlangt Serverzustand und
widerspricht damit der ausdrücklichen Zustandslosigkeit des Tokens (12-03-PLAN.md). In der
Praxis scheitert der zweite Versuch am exakten Periodenbeginn — das Review nennt das
zutreffend „Glück, keine Absicht". Die Bindung an den Admin ist der Teil, den das Review
konkret verlangt hat, und der ist umgesetzt.

Nachweis: neuer Test 2b mit Gegenprobe; Schärfe verifiziert (adminId aus der kanonischen
Zeichenkette entfernt → genau dieser Test wird rot).

### WR-10 — `req.query.userId as string`
`unknown` + Typprüfung, bei einem Array 400 statt stiller Konvertierung. Damit stimmt auch
der Kopfkommentar der Datei wieder, der behauptet, keinen solchen Cast zu enthalten.

### WR-11 — Prüfskript zählte soft-gelöschte Nutzer und verglich Rohtext
`AND u.deletedAt IS NULL` in beiden Abfragen (und in der Gesamtzahl); der Tagesplan wird vor
dem Vergleich kanonisiert. `canonicalizeWorkSchedule()` ist dafür aus
`workTimeChangeToken.ts` nach `utils/workSchedule.ts` gezogen — **eine** Fassung für
Token-Signatur und Prüfskript (die dritte Kopie aus IN-01 fällt damit mit weg, ohne dass
IN-01 sonst angefasst wurde). Ein Text, der kein auswertbarer Tagesplan ist, wird bewusst als
Rohtext verglichen: dann ist er die einzige verfügbare Information.

### WR-12 — `process.exit(0)` konnte die Ausgabe abschneiden
Alle vier `process.exit()`-Aufrufe durch `process.exitCode = …` + `return` ersetzt.

Verifiziert gegen eine Kopie von `development.db`: vollständige Ausgabe in einer
**umgeleiteten Datei**, Exit 0, Unversehrtheitsnachweis „ja"; ohne `DATABASE_PATH` Exit 2 mit
vollständiger Fehlerausgabe.

### WR-13 — `JSON.parse` ohne Typwächter, `as UserPublic`-Doppelcast
- `parseStoredWorkSchedule()`: `JSON.parse` in `try/catch`, Ergebnis als `unknown` durch den
  neuen, **bewusst lenienten** `isStoredWorkSchedule()` (sieben Schlüssel, endliche Zahlen,
  **keine** Bereichsprüfung — es sind Bestandsdaten, und eine Verschärfung würde still die
  Sollstundenrechnung eines Nutzers ändern). Bei Fehlschlag `logger.warn` und `null`.
- Neuer Typ `TargetHoursUser` (`Pick<UserPublic, 'id'|'hireDate'|'weeklyHours'|'workSchedule'>`)
  in `workingDays.ts`; `getDailyTargetHours()`, `resolvePeriodForDate()` und
  `getAllWorkingDaysBetween()` nehmen ihn. Das **erweitert** den Parametertyp — jedes
  vollständige `UserPublic` erfüllt ihn weiterhin, kein Aufrufer musste geändert werden
  (22 Dateien mit `getDailyTargetHours` geprüft, `tsc` grün).

### WR-14 — Tautologischer Token-Test, REQ-29-Test prüfte den falschen Pfad
- **Test 2** rief `verifyPreviewToken(token, { ...BASE_BINDING })` auf — eine identische
  Kopie; er konnte nicht fehlschlagen. Jetzt trägt das übergebene Objekt tatsächlich eine
  andere Begründung, und die Zusicherung aus `12-UI-SPEC.md` („das Tippen der
  Pflichtbegründung entwertet die Vorschau nicht") ist damit wirklich belegt.
- **REQ-29** ist um die drei betroffenen Lesepfade erweitert, plus
  `getAggregatedOvertimeStats()` als vierten (siehe CR-01).

---

## UAT-Punkte für Phase 14

1. **Bestandsdaten vor Migration 012.** Weil der alte `referenceType`-CHECK wirkungslos war,
   *kann* eine Bestands-/Produktionsdatenbank Zeilen mit einem unzulässigen `referenceType`
   enthalten. Migration 012 setzt solche Werte auf NULL und protokolliert sie vollständig
   (`logger.warn` mit Wert und Anzahl). In der lokalen `development.db` ist die Menge leer
   (nur `NULL` und `'absence'`). **Vor dem Produktionslauf** einmal prüfen:
   `SELECT referenceType, COUNT(*) FROM overtime_transactions GROUP BY referenceType;` —
   ist dort etwas außerhalb der fünf erlaubten Werte, gehört die Entscheidung „auf NULL
   setzen" ausdrücklich bestätigt, bevor die Migration läuft.

2. **Kontoauszug-Darstellung der `model_change`-Zeile (CR-01).** Die Zeile zeigt jetzt
   `0,0 h` in der Stundenspalte, weil ihr Betrag bereits in den Tageszeilen steckt; der
   dokumentierte Betrag liegt im neuen Feld `documentedDelta`. Ob die Oberfläche statt der
   Null lieber den `documentedDelta` als klar gekennzeichneten, nicht-summierenden Hinweis
   zeigen soll, ist eine Gestaltungsentscheidung — sie berührt `OvertimeTransactions.tsx` und
   damit den Desktop-Teil, den dieser Lauf ausdrücklich nicht anfassen durfte.

3. **Rückwirkungsgrenze „Beginn des Vorjahres" (WR-03).** Der Wert ist gesetzt, weil das
   Review eine Obergrenze verlangt und diese Grenze im Vorschlag genannt war. Ob die
   Stiftung tatsächlich nie weiter zurück umstellen muss (z. B. bei einer sehr späten
   Vertragskorrektur), ist eine fachliche Frage an den Anwender. Der Sonderfall wäre dann ein
   bewusster, dokumentierter Eingriff außerhalb der Adminoberfläche.

4. **Rate-Limit 30/min für `/preview` (WR-03).** Angemessen für einen Knopfdruck pro
   Vorschau, aber pro IP gezählt. Sitzen mehrere Admins hinter derselben Adresse und arbeiten
   gleichzeitig, ist der Wert im Realbetrieb einmal gegenzuprüfen.

5. **Einmalverbrauch des `previewToken` (WR-09, Rest).** Die Sitzungsbindung ist umgesetzt;
   ein echter Einmalverbrauch verlangt Serverzustand und widerspricht der ausdrücklich
   entschiedenen Zustandslosigkeit. Ob das Risiko (dasselbe Token zweimal innerhalb von
   15 Minuten einlösen — praktisch bereits durch den Periodenbeginn-Konflikt blockiert) eine
   Zustandstabelle rechtfertigt, ist eine Architekturentscheidung für Phase 13/14.

6. **Zukunftsmonate (WR-02) auf einer Produktionskopie.** Die Entscheidung „vorhandene
   `overtime_balance`-Zeilen jenseits von heute mit nachziehen" ist lokal getestet, aber noch
   nicht gegen einen echten Bestand mit genehmigtem Zukunftsurlaub gemessen. Ein
   rückwirkender Wechsel für einen Nutzer mit genehmigtem Urlaub im nächsten Quartal gehört
   in die Abnahme.

---

_Erstellt: 2026-08-22_
_Bearbeiter: Claude (Server-Scope, sequentieller Lauf auf dem Hauptarbeitsbaum)_
