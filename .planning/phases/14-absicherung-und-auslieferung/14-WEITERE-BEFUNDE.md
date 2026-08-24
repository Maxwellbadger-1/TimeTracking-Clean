---
phase: 14-absicherung-und-auslieferung
reviewed: 2026-08-24
depth: deep
scope: Überstunden- und Abwesenheits-Rechenwerk (server/src + desktop/src)
beweisdatenbanken:
  - server/database/14-produktionskopie.db (readonly, Stand vor Deployment)
  - server/database/14-prod-nach-migration.db (readonly, Stand nach Migration)
findings:
  blocker: 5
  warning: 10
  total: 15
status: issues_found
---

# Phase 14 — Weitere Befunde im Überstunden- und Abwesenheits-Rechenwerk

**Auftrag:** Systematische Suche nach Defekten, die vor dem Milestone-Abschluss noch im
Bestand stecken. Reine Suche, nichts geändert.

**Arbeitsweise:** Jede Behauptung ist am Quelltext mit Datei und Zeile belegt. Wo ein
Verdacht an echten Daten prüfbar war, wurde er an den beiden Beweisdatenbanken
nachgemessen (nur lesend geöffnet). Wo ich unsicher bin, steht das ausdrücklich dabei.

**Nicht erneut gemeldet** (bereits bekannt, aber als Muster verwendet): Zukunftsmonate im
Rebuild, `approvedBy = null` bei vier Krankmeldungen, soft-gelöschte Nutzer in
Gesamtauswertungen, Konten mit `weeklyHours = 0`, `countWorkingDaysBetween()`-Zeitzonen,
CLI-Einstieg unter Windows.

---

## Wie die Liste zu lesen ist

Jeder Befund trägt zwei Angaben:

- **Schweregrad** — `BLOCKER` (falsche Zahlen, Datenverlust oder Sicherheitslücke) oder
  `WARNUNG` (Qualität, Robustheit, Wartbarkeit).
- **Wirkt heute / Latent** — **Wirkt heute** heißt: für einen echten Mitarbeiter im
  aktuellen Bestand entsteht schon jetzt eine falsche Zahl. **Latent** heißt: der Fehler
  steckt im Code, aber die heutige Datenlage löst ihn nicht aus — er wartet auf den ersten
  Nutzer, der die auslösende Bedingung erfüllt.

**Zusammenfassung:** 3 Befunde erzeugen heute nachweislich falsche Zahlen (BL-01, BL-03,
BL-05), 2 weitere erzeugen sie zeitweise oder hinterlassen eine falsche Datenspur (BL-02,
BL-04). Der auffälligste Einzelbefund ist **BL-01**: Der Saldo über dem Kontoauszug rechnet
in die Zukunft, die Buchungsliste direkt darunter nicht — nachgemessen für Nutzer 17 sind
das heute **8,00 Stunden Unterschied** auf einem Bildschirm.

---

# BLOCKER

## BL-01 — Der Saldo über dem Kontoauszug rechnet in die Zukunft, die Liste darunter nicht

**Schweregrad:** BLOCKER · **Wirkt heute**

**Was passiert.** Im Kontoauszug („Zeitkonto-Saldo" über der Buchungstabelle) stehen zwei
Zahlen nebeneinander, die aus zwei verschiedenen Zeiträumen stammen. Die Buchungsliste hört
korrekt bei heute auf. Der fette Saldo darüber rechnet bis zum **Monatsende** weiter — und
weil für Tage in der Zukunft keine Arbeitszeit erfasst ist, zählt jeder künftige Arbeitstag
mit dem vollen Tagessoll als Minus.

**Beleg im Quelltext.**

Die Route reicht denselben Endzeitpunkt an zwei Funktionen weiter:

- `server/src/routes/overtime.ts:519` → `calculateLiveOvertimeTransactions(userId, fromDateStr, toDateStr)`
- `server/src/routes/overtime.ts:527` → `calculateCurrentOvertimeBalance(userId, fromDateStr, toDateStr)`

Die **erste** deckelt auf heute — genau dafür wurde in Phase 13 der WR-10-Fix gebaut:

- `server/src/services/overtimeLiveCalculationService.ts:226-228`
  ```
  const today = formatDate(getCurrentDate(), 'yyyy-MM-dd');
  const journalEndDate = toDate || today;
  const endDate = journalEndDate > today ? today : journalEndDate;
  ```

Die **zweite** deckelt nicht:

- `server/src/services/overtimeLiveCalculationService.ts:712`
  ```
  const endDate = toDate || formatDate(getCurrentDate(), 'yyyy-MM-dd'); // Today
  ```
  Der Kommentar `// Today` beschreibt nur den Fall, dass gar kein `toDate` ankommt. Kommt
  eines an, wird es ungeprüft übernommen.

Sie reicht es an eine dritte Stelle weiter, die ebenfalls keine Obergrenze kennt:

- `server/src/services/unifiedOvertimeService.ts:265-287` — `calculatePeriodOvertime()`
  läuft `for (let d = ...; d <= requestedEnd; ...)`. Anders als das Schwestermodell
  `calculateMonthlyOvertime()` (dort Zeile 185: `const effectiveEndDate = endDate > today ? today : endDate;`)
  fehlt hier jede Deckelung.

Und der Client schickt tatsächlich ein Datum in der Zukunft:

- `desktop/src/hooks/useWorkTimeAccounts.ts:296-304, :318-319` — `toDate` ist der letzte Tag
  des gewählten Monats. Der WR-10-Kommentar an Ort und Stelle sagt ausdrücklich: „`toDate`
  wird NICHT mehr auf heute gedeckelt … Die Deckelung steht jetzt serverseitig". Sie steht
  serverseitig — aber nur in einer der beiden Funktionen, die das Datum bekommen.
- Angezeigt wird der Wert in `desktop/src/components/worktime/OvertimeTransactions.tsx:240-253`
  („Zeitkonto-Saldo"), eingebunden über `desktop/src/pages/ReportsPage.tsx:346-351` mit dem
  aktuell gewählten Monat.

**An den echten Daten nachgemessen.** Heute ist Montag, der 24.08.2026. Nutzer 17 hat
Arbeitszeitperiode ab 01.01.2026 mit Wochenplan Mo 4 h, Di 4 h, Do 4 h
(`user_work_periods`, id 6). Für August gibt es keine Feiertage in der Datenbank. Öffnet
dieser Mitarbeiter den Kontoauszug für August, schickt der Client `toDate = 2026-08-31`:

| Tag | Wochentag | Soll | Ist | Abwesenheit | Wirkung auf den Saldo |
|---|---|---|---|---|---|
| 25.08. | Dienstag | 4 h | 0 h | — | **−4 h** |
| 26.08. | Mittwoch | 0 h | 0 h | — | 0 |
| 27.08. | Donnerstag | 4 h | 0 h | Urlaub #72 (genehmigt) | 0 (Gutschrift gleicht aus) |
| 28.08. | Freitag | 0 h | — | — | 0 |
| 29./30.08. | Sa/So | 0 h | — | — | 0 |
| 31.08. | Montag | 4 h | 0 h | — | **−4 h** |

**Ergebnis: −8,00 Stunden.** Der Saldo über der Liste ist heute für Nutzer 17 um acht
Stunden zu niedrig — und er widerspricht der Buchungsliste unmittelbar darunter, deren
Zeilen sich auf einen anderen Wert summieren. Für jeden Mitarbeiter mit Sollstunden gilt
dasselbe in Höhe seines Restmonatssolls; am Monatsanfang ist der Fehlbetrag am größten.

**Zusatzmangel an derselben Funktion.** `calculateCurrentOvertimeBalance()` liest den Nutzer
mit `SELECT id, hireDate FROM users WHERE id = ?`
(`overtimeLiveCalculationService.ts:697-702`) — **ohne** `deletedAt IS NULL`. Für einen
soft-gelöschten Nutzer liefert die Funktion einen Saldo, statt ihn abzulehnen.

**Reparaturhinweis.** `calculateCurrentOvertimeBalance()` muss dieselbe Deckelung anwenden
wie `calculateLiveOvertimeTransactions()` (die drei Zeilen aus `:226-228`). Zusätzlich
gehört die Deckelung in `calculatePeriodOvertime()` selbst, damit kein künftiger Aufrufer
sie erneut vergisst — dort steht sie im Schwestermodell bereits.

---

## BL-02 — Nach dem Löschen einer genehmigten Abwesenheit wird nichts nachgerechnet

**Schweregrad:** BLOCKER · **Wirkt heute** (bei jeder Löschung; Teilfolgen heilen sich später)

**Was passiert.** Löscht ein Administrator einen bereits genehmigten Urlaub oder eine
Krankmeldung, soll das System anschließend die betroffenen Monate neu rechnen. Der Code, der
das tun soll, kann gar nicht laufen: Er benutzt ein Sprachmittel, das in dieser Betriebsart
nicht existiert. Der Fehler wird abgefangen und weggeloggt — nach außen sieht die Löschung
erfolgreich aus.

**Beleg im Quelltext.**

- `server/src/services/absenceService.ts:1198`
  ```
  const { updateMonthlyOvertime } = require('./overtimeService.js');
  ```
- `server/src/services/absenceService.ts:1421`
  ```
  const { updateAllOvertimeLevels } = require('./overtimeService.js');
  ```

Der Server läuft als ES-Modul:

- `server/package.json:4` → `"type": "module"`
- `server/tsconfig.json` → `"module": "ESNext"`

In einem ES-Modul ist `require` **nicht definiert**. Jeder dieser beiden Aufrufe wirft
sofort einen `ReferenceError`. Beide stehen in einem `try`-Block
(`absenceService.ts:1197-1215` bzw. `:1420-1425`), der den Fehler abfängt und nur
protokolliert:

> `'❌ Failed to import overtimeService for recalculation'`

Der Kommentar eine Zeile darüber (`absenceService.ts:1195`) begründet die Wahl sogar
ausdrücklich mit „nutzt require() (CJS-Interop)" — genau das gibt es hier nicht.

**Folge.** Die Löschung selbst greift (`absenceService.ts:1189`, harte Löschung — die
Tabelle `absence_requests` hat kein `deletedAt`, geprüft am Schema beider Beweisdatenbanken).
Was ausbleibt:

1. Die Gutschriftszeilen der gelöschten Abwesenheit bleiben im gespeicherten Journal
   (`overtime_transactions`) stehen. Nur ein Rebuild löscht sie
   (`overtimeTransactionRebuildService.ts:154-173`) — und der Rebuild wird über
   `updateMonthlyOvertime` angestoßen, das nie erreicht wird.
2. Der zwischengespeicherte Saldo in `work_time_accounts` wird nicht nachgezogen.
3. Beim zweiten Vorkommen (`:1421`, Löschung einer Krankmeldung) läuft die gesamte
   nachfolgende Tagesschleife ins Leere.

**Was sich selbst heilt — und was nicht.** Die Monatssummen in `overtime_balance` werden bei
der nächsten Berichtsabfrage ohnehin neu gerechnet (`reportService.ts:115` ruft
`ensureOvertimeBalanceEntries`). Das gespeicherte Journal und der Kontostand-Cache heilen
sich **nicht**. Der Kontoauszug im Desktop rechnet live aus den Rohdaten
(`overtimeLiveCalculationService`) und zeigt den Rest deshalb korrekt — die Fehlerspur liegt
in den gespeicherten Tabellen, nicht zwingend auf dem Bildschirm.

**Unsicherheit, die ich benenne:** Ich habe nicht experimentell ausgelöst, ob der
`ReferenceError` tatsächlich fliegt — der Beleg ist rein statisch (ESM + `require`). Er ist
allerdings eindeutig; ein Löschversuch mit anschließendem Blick ins Server-Log
(Suchbegriff `Failed to import overtimeService`) bestätigt oder widerlegt ihn in einer
Minute.

---

## BL-03 — Der Historien-Export mischt abgelehnte Anträge und gelöschte Nutzer ein

**Schweregrad:** BLOCKER · **Wirkt heute**

**Was passiert.** Der Historien-Export (JSON, für Archivierung und Nachweispflichten) nimmt
**alle** Abwesenheitsanträge auf — auch abgelehnte — und **alle** Nutzer, auch
soft-gelöschte. Ein abgelehnter Urlaub erscheint darin nicht von einem genehmigten zu
unterscheiden.

**Beleg im Quelltext.** In `server/src/services/exportService.ts`:

- `:353` — `SELECT * FROM users WHERE id = ?` (Einzelnutzer) — kein `deletedAt`-Filter
- `:356` — `SELECT * FROM users ORDER BY lastName, firstName` (alle) — kein `deletedAt`-Filter
- `:370-371` — `SELECT * FROM absence_requests WHERE ... startDate <= date(?) AND endDate >= date(?)`
  — **kein `status`-Filter**

Zum Vergleich der DATEV-Export in derselben Datei, der die Regel sauber anwendet:

- `:137-141` — Nutzer bewusst inklusive gelöschter, mit ausdrücklicher Begründung
  („including deleted for historical accuracy", WR-11 aus Phase 11)
- `:177-183` — Abwesenheiten **mit** `AND status = 'approved'`

Die Regel ist also im Haus bekannt und an einer Stelle bewusst entschieden — im
Historien-Export ist sie schlicht nicht angewandt. Das ist die von Schwerpunkt D
gesuchte Inkonsistenz.

**An den echten Daten nachgemessen** (`14-prod-nach-migration.db`): Es gibt **15 abgelehnte**
Abwesenheitsanträge (10 Urlaub, 2 Krank, 2 Überstundenausgleich, 1 unbezahlt), darunter
Anträge, die bis in den September und Oktober 2026 reichen (z. B. Antrag 61: Nutzer 17,
24.08.–03.09.2026, abgelehnt). Sie alle landen heute im Historien-Export. Weiter fließen
fünf soft-gelöschte Nutzer (ids 15, 26, 28, 30, 31) mitsamt ihren Monatssalden ein.

**Zusatz.** Die Kennzahl `totalOvertime` im selben Export (`exportService.ts:425`) summiert
`overtime_balance` über den Zeitraum **ohne** Nutzerfilter und **ohne** Monatsdeckel — sie
enthält damit sowohl die gelöschten Nutzer als auch die fehlerhaften Zukunftsmonate.

---

## BL-04 — Überstundenausgleich: doppelter Abzug, und dabei werden vergangene Monate überschrieben

**Schweregrad:** BLOCKER · **Wirkt heute, aber vorübergehend** (der Fehler verschwindet bei
der nächsten Neuberechnung und kommt bei der nächsten Genehmigung wieder)

**Was passiert.** Wird ein Überstundenausgleich genehmigt, läuft der Abzug auf **drei**
Wegen gleichzeitig — von denen einer in bereits abgeschlossene Vormonate hineinschreibt und
einer folgenlos verpufft.

**Beleg im Quelltext.** In `approveAbsenceRequest` (`server/src/services/absenceService.ts`):

1. **Weg A — schreibt in die Vergangenheit.**
   `:1310-1315` ruft `deductOvertimeHours(userId, hoursToDeduct)`.
   Diese Funktion (`:1597-1631`) sucht die **ältesten Monate mit positivem Überstundensaldo**
   und zieht die Stunden dort vom `actualHours`-Wert ab:
   ```
   SELECT * FROM overtime_balance WHERE userId = ? AND overtime > 0 ORDER BY month ASC
   ...
   UPDATE overtime_balance SET actualHours = actualHours - ? WHERE id = ?
   ```
   `overtime_balance` ist eine **abgeleitete** Tabelle: Sie wird aus Zeiterfassung,
   Abwesenheiten und Korrekturen neu berechnet — an zwei Stellen
   (`overtimeService.ts:144-156` und `overtimeTransactionRebuildService.ts:609-621`). Der
   handgeschriebene Abzug wird von der nächsten Neuberechnung **stillschweigend gelöscht**.
   Bis dahin steht in einem längst abgeschlossenen Monat eine Ist-Stundenzahl, die nicht
   mehr zu den Zeiteinträgen dieses Monats passt.

2. **Weg B — verpufft folgenlos.**
   `:920-932` ruft `recordOvertimeCompensation(...)`, das eine Journalzeile vom Typ
   `compensation` schreibt (`overtimeTransactionService.ts:156-180`). Der Saldo, den das
   System dem Mitarbeiter zeigt, kommt aber aus `getOvertimeBalance()`
   (`overtimeTransactionService.ts:454-479`) — und das summiert `overtime_balance`, **nicht**
   das Journal. Diese Zeile bewegt keine einzige Zahl.

3. **Weg C — der eigentlich richtige.**
   `:891-906` stößt `updateMonthlyOvertime` für die betroffenen Monate an; der Rebuild bucht
   den Ausgleichstag korrekt als Minus in Höhe des Tagessolls (REQ-19,
   `overtimeTransactionRebuildService.ts:412-448`).

Zwischen Weg A und Weg C wird der Tag also **doppelt** abgezogen, bis die nächste
Neuberechnung Weg A wieder auflöst. Da praktisch jede Berichtsabfrage alle Monate ab
Eintrittsdatum neu rechnet (`overtimeService.ts:331-337` erzeugt die Monatsliste,
`:361` rechnet sie), springt der Saldo: bei Genehmigung nach unten, beim nächsten Aufruf
wieder nach oben.

**An den echten Daten nachgemessen.** In `14-prod-nach-migration.db` gibt es **null**
Journalzeilen vom Typ `compensation` — bei **drei** genehmigten Überstundenausgleichen
(Anträge 25, 56, 64). Der Prüfnachweis für diese drei Ausgleichstage ist dauerhaft
verloren. Der Rebuild-Fix vom 18.08. verhindert nur, dass es künftig wieder passiert
(`overtimeTransactionRebuildService.ts:137-166`); die drei bestehenden Zeilen hat er nicht
zurückgeholt.

Eine Suche nach überlebenden Spuren von Weg A („Monat, dessen Ist-Stunden unter den
erfassten Arbeitsstunden liegen") ergab in **beiden** Beweisdatenbanken 0 Treffer — die
Vollberechnung des Backfills hat sie überschrieben. Der Codeweg ist damit belegt, ein
dauerhafter Datenschaden im heutigen Bestand ist es **nicht**. Das ist der ehrliche Stand.

---

## BL-05 — Krankmeldungen werden ohne Genehmiger und ohne Neuberechnung eingebucht

**Schweregrad:** BLOCKER · **Wirkt heute**

Der unter Schwerpunkt C gesuchte Pfad ist gefunden. Er hat **zwei** Folgen, von denen nur
eine bekannt war.

**Der Pfad.** In `server/src/services/absenceService.ts`:

- `:573` — `const status = data.type === 'sick' ? 'approved' : 'pending';`
- `:581-585` —
  ```
  INSERT INTO absence_requests (userId, type, startDate, endDate, days, status, reason)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ```
  Die Spalten `approvedBy` und `approvedAt` kommen in dieser Einfügung **nicht vor**. Eine
  Krankmeldung entsteht damit als `status = 'approved'` mit leerem Genehmiger und leerem
  Genehmigungszeitpunkt.

Der reguläre Genehmigungsweg macht es richtig (`:867-871`:
`SET status='approved', approvedBy=?, approvedAt=datetime('now')`) — die Auto-Genehmigung
umgeht ihn vollständig.

**An den echten Daten bestätigt.** Alle vier Anträge mit `approvedBy IS NULL` sind vom Typ
`sick`: ids 46 (Nutzer 3), 60 (Nutzer 16), 68 (Nutzer 3), 70 (Nutzer 16). Kein einziger
Antrag anderen Typs ist betroffen. Damit ist der Pfad eindeutig identifiziert.

**Die zweite, bisher unbenannte Folge — hier liegt der eigentliche Schaden.** Der
Genehmigungsweg stößt nach der Statusänderung die Neuberechnung der betroffenen Monate an:

- `:891-906` — Tagesschleife über den Zeitraum → `affectedMonths` → `updateMonthlyOvertime`
  je Monat.

Der Auto-Genehmigungsweg tut das **nicht**. Er ruft nur
`updateBalancesAfterApproval(...)` (`:602`), und diese Funktion behandelt Krankheit
ausdrücklich als „nichts zu tun":

- `absenceService.ts:1317` — `// Note: Sick days don't need any balance updates here`

**Folge:** Nach dem Eintragen einer Krankmeldung bleibt das gespeicherte Journal
(`overtime_transactions`) ohne die Krankheits-Gutschriften und ohne die negativen
Tageszeilen der Krankheitstage, und der Kontostand-Cache in `work_time_accounts` bleibt
stehen. Der Antrag 60 (Nutzer 16, 29.04.–10.05.2026) — genau der Fall aus dem
Kundennachweis — ist auf diesem Weg entstanden.

Wie bei BL-02 heilt sich `overtime_balance` bei der nächsten Berichtsabfrage; Journal und
Cache heilen sich nicht.

**Zusatz zur Datenlage:** In der Tabelle `absence_requests` fehlt die Spalte `deletedAt`
(Schema in beiden Beweisdatenbanken geprüft, ebenso `server/src/database/schema.ts:186-201`).
Abwesenheiten werden hart gelöscht — das widerspricht der Projektregel „Hard Delete →
Soft Delete (`deletedAt`)" aus `.claude/CLAUDE.md` und nimmt jeder Nachforschung die
Grundlage.

---

# WARNUNGEN

## WR-01 — Der Zeitkonto-Saldo im `/live`-Endpunkt kennt den Zukunftsfilter seines Zwillings nicht

**Schweregrad:** WARNUNG · **Latent in der Oberfläche, falsch über die Schnittstelle**

`server/src/services/workTimeAccountService.ts:421-428`:
```
SELECT COALESCE(SUM(overtime), 0) as totalOvertime
FROM overtime_balance
WHERE userId = ?
```

Die Schwesterfunktion `getOvertimeBalance()`
(`server/src/services/overtimeTransactionService.ts:470-476`) hat genau für diesen Fall
einen Filter — mit einer ausführlichen Begründung darüber (`:459-462`):

> „Filter month <= current month to exclude future months. Future months may have negative
> balances (e.g. approved future vacation already recorded in overtime_balance) which must
> NOT count against current balance."

Hier fehlt er.

**Nachgemessen:** Die drei Zukunftsmonate im Bestand sind Nutzer 3 / 2026-09 = **−20 h**,
Nutzer 17 / 2026-09 = **−44 h**, Nutzer 30 / 2026-10 = **−176 h**. Genau um diese Beträge
liefert `GET /api/work-time-accounts/live` heute zu niedrige Salden.

**Warum trotzdem nur WARNUNG:** Der einzige Verbraucher im Desktop,
`desktop/src/components/worktime/WorkTimeAccountWidget.tsx:22`, wird **nirgends eingebunden**
(Suche über das gesamte `desktop/src` ergibt keinen Treffer außerhalb der eigenen Datei).
Auf dem Bildschirm eines Mitarbeiters erscheint die Zahl heute nicht. Die Route
(`server/src/routes/workTimeAccounts.ts:82-108`) ist für jede angemeldete Sitzung erreichbar.

**Gleiche Lücke, ebenfalls ohne Aufrufer:**
`server/src/services/overtimeTransactionRebuildService.ts:637-644` —
`getCurrentOvertimeBalance()` summiert `overtime_balance` ohne Monatsfilter. Exportiert,
projektweit kein Aufrufer.

---

## WR-02 — Fünf Tagesschleifen leiten den Wochentag aus der Prozess-Zeitzone ab

**Schweregrad:** WARNUNG · **Latent** (schlägt zu, sobald der Serverprozess ohne
`TZ=Europe/Berlin` startet)

Das ist dieselbe Fehlerklasse, die Phase 11 als WR-01 in `workingDays.ts` beseitigt hat:
Innerhalb einer Schleife wird das **Datum** über Europe/Berlin gebildet, der **Wochentag**
aber über die Prozess-Zeitzone. Solange beide gleich sind, fällt es nicht auf. Der damalige
Kommentar nennt den realistischen Auslöser selbst: „ein PM2-Neustart ohne Environment".

Unbereinigte Fundstellen:

| Datei:Zeile | Was dort steht |
|---|---|
| `services/overtimeLiveCalculationService.ts:289-296` | Zeiger `new Date(absence.startDate + 'T12:00:00')` (lokal), Schlüssel `formatDate(d,…)` (Berlin), Wochentag `d.getDay()` (lokal) |
| `services/overtimeLiveCalculationService.ts:403-414` | dieselbe Konstruktion in der Gutschriftenschleife |
| `services/overtimeLiveCalculationService.ts:57-61` | `getAllWorkingDaysBetween()`, gleiche Konstruktion |
| `services/absenceService.ts:1247-1248` | `new Date(startDate)` (UTC-Mitternacht!), `d.getDay()` (lokal), `formatDate(d,…)` (Berlin) — **drei** Zeitauffassungen in einer Schleife |
| `services/overtimeTransactionRebuildService.ts:301-304` | `d.getDay()` für `isWeekend`, Schlüssel über `formatDate` |

Die beiden Fundstellen in `overtimeLiveCalculationService.ts` sind besonders unangenehm:
Sie bestimmen, welche Tage einer genehmigten Abwesenheit überhaupt als Abwesenheitstag
gelten. Das ist exakt die Funktion, deren Zwilling in `workingDays.ts` seinerzeit unter
`TZ=Pacific/Kiritimati` nachweislich 40 statt 36 Stunden gutschrieb.

**Nebenbefund zum Rebuild:** Die Felder `isWeekend` und `isHoliday` in `DayCalculation`
(`overtimeTransactionRebuildService.ts:65-66`) werden befüllt, aber danach **nirgends
gelesen**. Toter Ballast — und ausgerechnet der zeitzonenanfällige Wert.

**Zusätzlich, verbotenes Muster im Desktop:**
`desktop/src/hooks/useBalances.ts:34`
```
const targetMonth = month || new Date().toISOString().substring(0, 7);
```
`.claude/CLAUDE.md` verbietet unter „VERBOTE → Database & Date Handling" ausdrücklich
`toISOString()` für Datumsbildung. Konkrete Wirkung: Am Monatsersten zwischen 00:00 und
02:00 Berliner Zeit steht in UTC noch der Vormonat — der Baustein fragt dann den falschen
Monat ab; am 1. Januar das falsche Jahr. Der Haken ist über `desktop/src/hooks/index.ts:29`
exportiert, hat derzeit aber keinen Verbraucher.

---

## WR-03 — Zwei Schreiber auf dieselbe Tabelle runden unterschiedlich

**Schweregrad:** WARNUNG · **Wirkt heute** (sichtbar in den gespeicherten Daten, nicht auf
dem Bildschirm)

Antwort auf Schwerpunkt F: Gerundet wird im Rechenwerk durchgehend nach demselben Muster
`Math.round(x * 100) / 100` (zwei Nachkommastellen) — **außer** an einer Stelle, und diese
Stelle schreibt in dieselben Spalten wie die andere.

- `server/src/services/overtimeService.ts:144-156` schreibt `monthlyResult.targetHours` und
  `monthlyResult.actualHours` **ungerundet** nach `overtime_balance`.
  `unifiedOvertimeService.calculateMonthlyOvertime()` rundet an keiner Stelle
  (`unifiedOvertimeService.ts:220-256`: reine `reduce`-Summen).
- `server/src/services/overtimeTransactionRebuildService.ts:609-621` schreibt in dieselben
  Spalten mit `Math.round(x * 100) / 100`.

Beide laufen **in derselben Funktion**, 30 Zeilen auseinander: `updateMonthlyOvertime()`
schreibt erst den ungerundeten Wert (`:144`) und ruft dann den Rebuild (`:163`), der den
gerundeten darüberschreibt. Welcher Wert am Ende in der Zeile steht, hängt davon ab, ob der
Rebuild durchlief oder in seinen `catch`-Zweig fiel (`:164-167`).

**Nachgemessen** in `14-prod-nach-migration.db`, Nutzer 17: `actualHours = 46.81999999999999`
(2026-02), `overtime = 9.090000000000003` (2026-01), `39.089999999999996` (2026-05). Der
Fingerabdruck des ungerundeten Schreibers liegt im Bestand.

**Wirkung.** In der Anzeige unsichtbar (dort wird ohnehin gerundet). Aber jeder
Vorher-/Nachher-Vergleich, jeder Snapshot-Abgleich und jede Gleichheitsprüfung auf diesen
Spalten — also genau die Werkzeuge dieser Phase — zeigt Scheinabweichungen. Eine Tabelle,
zwei Schreiber, zwei Genauigkeiten.

---

## WR-04 — Das Austrittsdatum wird nirgends im Rechenwerk berücksichtigt

**Schweregrad:** WARNUNG · **Latent** (heute hat kein Nutzer ein Austrittsdatum)

`users.endDate` wird gepflegt und ausgewertet — aber nur an den Rändern:

- gespeichert: `services/userService.ts:552-554`
- geprüft: `services/workPeriodChangeService.ts:296-299`,
  `services/workPeriodCorrectionService.ts:207-210` („Der Stichtag liegt nach dem
  Austrittsdatum")
- exportiert: `services/exportService.ts:447`, `:507`

**Keine** Berechnung deckelt daran:

- `utils/workingDays.ts:176-223` (`getDailyTargetHours`) kennt nur `hireDate`
- `services/unifiedOvertimeService.ts:178-196` deckelt `hireDate` und heute — nicht `endDate`
- `services/overtimeTransactionRebuildService.ts:108-125` ebenso

Zudem schließt das Setzen eines Austrittsdatums die Arbeitszeitperiode nicht: `validTo`
bleibt `NULL` (in `14-prod-nach-migration.db` gilt das für alle 20 Perioden).

**Folge, sobald jemand austritt:** Für jeden Arbeitstag nach dem Austritt bucht das System
weiterhin das volle Tagessoll als Minus — dieselbe Mechanik wie beim bekannten
Zukunftsmonats-Defekt, nur in der Gegenwart. Der Saldo eines ausgeschiedenen Mitarbeiters
sinkt Tag für Tag weiter.

**Heute nicht ausgelöst:** `SELECT id FROM users WHERE endDate IS NOT NULL` → 0 Zeilen.

---

## WR-05 — Abwesenheitstage werden aus dem heutigen Stammsatz gerechnet, nicht aus der gültigen Periode

**Schweregrad:** WARNUNG · **Latent** (heute hat kein Nutzer mehr als eine Periode)

`server/src/services/absenceService.ts:417`:
```
SELECT hireDate, weeklyHours, workSchedule FROM users WHERE id = ?
```
Die so gelesenen Werte gehen direkt in die Tageszählung:
- `:469` (Urlaub/Ausgleich) und `:476` (Krank/unbezahlt) →
  `countWorkingDaysForUser(startDate, endDate, workSchedule, user.weeklyHours, …)`
- gleiches Muster in `updateAbsenceRequest`, `:693-696`

Seit Phase 11 ist die **Periode** die maßgebliche Quelle für das Arbeitszeitmodell —
`getDailyTargetHours()` liest ausschließlich `user_work_periods`
(`utils/workingDays.ts:193`, D3/D4). Die Stundenrechnung der Abwesenheit folgt dieser Regel,
die **Tagerechnung** nicht. Für einen Mitarbeiter, dessen Modell sich geändert hat, werden
die Urlaubstage nach dem heutigen Plan gezählt und die Stunden nach dem damaligen — zwei
Zahlen zu einem Vorgang aus zwei Modellen.

**Heute nicht ausgelöst:** `SELECT COUNT(*), COUNT(DISTINCT userId) FROM user_work_periods`
→ 20 Perioden für 20 Nutzer, also genau eine je Person. Der Defekt wird mit dem **ersten
Stundenwechsel** scharf — also mit genau der Funktion, die dieser Milestone ausliefert.

**Zweite Folge derselben Zeile.** Für ein Konto mit `weeklyHours = 0` und ohne Wochenplan
liefert `countWorkingDaysForUser` konsequent 0 (`utils/workingDays.ts:711-713`), worauf
`absenceService.ts:482-485` den Antrag abweist:

> „Absence request must span at least one business day"

Diese Mitarbeiter können **überhaupt keine Abwesenheit beantragen** — auch keine
Krankmeldung. Betroffen sind heute die Nutzer 1, 22, 23, 24, 27 und 29. (Die
`weeklyHours = 0`-Lage selbst ist bekannt; diese konkrete Blockade nenne ich, weil sie eine
andere Wirkung hat als die bekannte.)

---

## WR-06 — Urlaub über den Jahreswechsel wird komplett dem Startjahr belastet

**Schweregrad:** WARNUNG · **Latent** (heute reicht kein Antrag über einen Jahreswechsel)

Das ist der Rest des unter Schwerpunkt E gesuchten Musters. **Auf der Überstundenseite ist
es beseitigt:** Der Genehmigungsweg zerlegt den Zeitraum in Kalendertage, sammelt daraus die
betroffenen Monate und rechnet jeden Monat einzeln tageweise nach
(`absenceService.ts:894-906` → `overtimeService.ts:130-167` → Tagesschleife im Rebuild).
Ich habe die sechs monatsübergreifenden Anträge im Bestand geprüft — keiner wird doppelt
gebucht.

**Auf der Urlaubskontoseite lebt es weiter.** Das Jahr wird überall allein aus dem
**Startdatum** abgeleitet:

- `services/absenceService.ts:539` — Deckungsprüfung:
  `const year = parseInt(data.startDate.substring(0, 4))`
- `services/absenceService.ts:1288` — Verbrauchsbuchung bei Genehmigung
- `services/absenceService.ts:1344` — Gegenbuchung bei Ablehnung/Löschung
- `services/vacationBackfillService.ts:130-137` und `:153-160` —
  `WHERE ... AND substr(startDate, 1, 4) = ?`

Ein Urlaub vom 28.12. bis 05.01. wird damit **vollständig** dem alten Jahr belastet: Die
Deckungsprüfung fragt nur das alte Kontingent ab, die Buchung nimmt alle Tage von dort, und
das neue Jahr bleibt unberührt. Fachlich müssen die Tage dem Jahr zugeordnet werden, in dem
sie liegen.

**Heute nicht ausgelöst:** `WHERE substr(startDate,1,4) <> substr(endDate,1,4)` → 0 Zeilen.

---

## WR-07 — Das Datum einer Überstundenkorrektur wird nirgends geprüft

**Schweregrad:** WARNUNG · **Latent** (setzt eine fehlerhafte Admin-Eingabe voraus)

Eine Überstundenkorrektur ist ein manueller Eingriff eines Administrators in den Saldo. Ihr
Datum durchläuft **keine** Prüfung:

- Route `server/src/routes/overtime.ts:156-163` — prüft nur, ob das Feld vorhanden ist
- Dienst `server/src/services/overtimeCorrectionsService.ts:27-46` — prüft Begründung
  (≥ 10 Zeichen), Stunden (≠ 0), Nutzer und Ersteller; das Datum nicht
- Schema `server/src/database/schema.ts:516-530` — `date TEXT NOT NULL`, keine CHECK-Bedingung

Dabei gibt es im Haus zwei passende Prüffunktionen, die anderswo benutzt werden:
`validateDateString()` und `isRealCalendarDate()` (`server/src/utils/validation.ts:21`, `:45`).
Der Abwesenheitsweg (`absenceService.ts:80-81`) und die Periodenwege
(`workPeriodChangeService.ts:65`) rufen sie — der Korrekturweg nicht.

**Was ein unsinniger Wert anrichtet.** Ein Wert wie `2026-13-05` würde
1. gespeichert, aber von keiner Tagesabfrage (`WHERE date = ?`) je gefunden — die
   Korrekturstunden wären still verloren, und
2. über `input.date.substring(0, 7)` (`overtimeCorrectionsService.ts:86`) zu
   `rebuildOvertimeTransactionsForMonth(userId, '2026-13')` führen. Dort wird
   `new Date(2026, 12, 1)` gebildet (`overtimeTransactionRebuildService.ts:105`) — das ist
   der **Januar 2027**. Ein völlig unbeteiligter Monat würde neu aufgebaut.

**Zweiter Mangel derselben Funktion: keine Klammer.** `createOvertimeCorrection()` läuft
ohne `db.transaction(...)` in dieser Reihenfolge:
Einfügen (`:48-61`) → Benachrichtigung (`:75-83`) → Rebuild (`:86-93`).
Kommt `hours` als Zeichenkette an — die Route lässt `"5"` durch, weil sie nur auf
`!hours` prüft —, wirft `input.hours.toFixed(2)` (`:82`) in der Benachrichtigung. Ergebnis:
Korrekturzeile geschrieben, Monat **nicht** neu gerechnet, Administrator sieht einen
500er und glaubt, nichts sei passiert.

Zum Vergleich: Genehmigung und Ablehnung von Abwesenheiten sind ausdrücklich in
`db.transaction(...)` geklammert, mit Begründung (`absenceService.ts:872-887`).

---

## WR-08 — Ein dritter Schreiber auf `overtime_balance` mit einer völlig anderen Formel

**Schweregrad:** WARNUNG · **Latent** (Funktion ist exportiert, hat aber keinen Aufrufer)

`server/src/services/timeEntryService.ts:783-838` — `updateOvertimeBalance(userId, month)`:

```
const targetHours = Math.round(((user.weeklyHours / 7) * daysInMonth) * 100) / 100;
...
SELECT COALESCE(SUM(hours), 0) as total FROM time_entries WHERE userId = ? AND date LIKE ?
...
INSERT INTO overtime_balance (...) ON CONFLICT(userId, month) DO UPDATE SET ...
```

Diese Formel ignoriert: Wochenplan, Wochenenden, Feiertage, die Arbeitszeitperiode, das
Eintrittsdatum, Abwesenheitsgutschriften, Korrekturen, unbezahlten Urlaub und die
Deckelung auf heute. Sie teilt die Wochenstunden durch **sieben** und multipliziert mit der
Zahl der **Kalendertage**.

Für Nutzer 17 (12 h/Woche) im August 2026 ergäbe das 53,14 Sollstunden statt der korrekten
36 — und die Ist-Stunden fielen von 34,75 auf die reine Zeiterfassung, ohne jede Gutschrift.

Sie wird heute **von niemandem aufgerufen** (projektweite Suche: nur die Definition selbst
und die eigene Fehlerzeile). Sie ist exportiert und liegt in einer Datei, die bei jeder
Zeiterfassungsänderung angefasst wird. Ein einziger Import genügt, um einen Monat zu
zerstören — ohne dass irgendetwas Alarm schlägt. `.claude/CLAUDE.md` verbietet unter
„VERBOTE → Overtime Calculation" ausdrücklich: „Neue Calculation Logic erstellen → Use
UnifiedOvertimeService!"

---

## WR-09 — `special` ist im Code überall vorgesehen und in der Datenbank verboten

**Schweregrad:** WARNUNG · **Latent** (der Zustand kann heute nicht entstehen)

Der Abwesenheitstyp `special` (Sonderurlaub) ist im Rechenwerk durchgängig ausmodelliert:

- `services/overtimeTransactionRebuildService.ts:49` (`ABSENCE_TYPES`), `:487`
  (`'special' → 'special_credit'`), `:508` („Sonderurlaub-Gutschrift")
- `services/unifiedOvertimeService.ts:400` — `type IN ('vacation', 'sick', 'special')`
- `services/overtimeService.ts:1036` — `type IN ('vacation', 'sick', 'special', 'unpaid')`
- `services/overtimeLiveCalculationService.ts:457-460` — eigener `case`-Zweig für Sonderurlaub

Die Datenbank lässt ihn nicht zu:

- `server/src/database/schema.ts:189` —
  `CHECK(type IN ('vacation', 'sick', 'unpaid', 'overtime_comp'))`
- identisch in beiden Beweisdatenbanken

Alle `special_credit`-Zweige sind damit unerreichbar. Entweder fehlt der Typ im Schema oder
er gehört aus dem Code. So wie es steht, verspricht das Typmodell einen Fall, den es nicht
geben kann — und verdeckt beim Lesen, welche Fälle real vorkommen.

---

## WR-10 — Die Routenschicht protokolliert weiterhin über `console`

**Schweregrad:** WARNUNG · **Latent** (Betriebs- und Datenschutzrisiko, keine Rechenfehler)

`.claude/CLAUDE.md` verbietet `console.log` in Production ausdrücklich („VERBOTE → Code
Quality", „Pre-Commit Checklist"). In den **Diensten** ist die Umstellung auf `logger`
vollzogen — dort finden sich nur noch Kommentare, die die früheren Stellen beschreiben
(`utils/workingDays.ts:413`, `:421`; `services/absenceService.ts:989-992`;
`services/overtimeService.ts:94`, `:132`).

In der **Routenschicht** ist sie nicht vollzogen: **140 tatsächliche `console.*`-Aufrufe**
in `server/src/routes` und `server/src/services` (Kommentare abgezogen), Schwerpunkte:

| Datei | Anzahl |
|---|---|
| `services/backupService.ts` | 25 |
| `routes/timeEntries.ts` | 20 |
| `routes/overtime.ts` | 18 |
| `routes/users.ts` | 12 |
| `routes/notifications.ts` | 11 |

Diese Ausgaben umgehen Loglevel, Redaktion und strukturierte Felder und landen ungefiltert
in `pm2 logs`. Beispiele im Überstundenpfad: `routes/overtime.ts:76`, `:181`, `:717`;
`routes/workTimeAccounts.ts:121`.

**Kleiner Nebenbefund am selben Ort:** `catch (error: any)` in `routes/overtime.ts:443` und
`:537`, `routes/settings.ts:34, 65, 87, 111`, `routes/holidays.ts:86` sowie
`(n: any)` in `routes/notifications.ts:59, 137, 184` — `any` ist projektweit untersagt
(„VERBOTE → Code Quality").

---

# Antworten auf die sechs Schwerpunkte

**A — Weitere Tagesschleifen ohne Obergrenze.** Ja, drei:
`unifiedOvertimeService.calculatePeriodOvertime()` (`:265-287`, gar keine Deckelung),
`overtimeLiveCalculationService.calculateCurrentOvertimeBalance()` (`:712`, übernimmt ein
Zukunftsdatum ungeprüft) und `workingDays.calculateTargetHoursForPeriod()` (`:553`, keine
Deckelung — hat außerhalb der Prüfskripte keinen Aufrufer). Die ersten beiden hängen
zusammen und ergeben BL-01. Zwei **Leser** von `overtime_balance` fehlt derselbe
Monatsdeckel, den ihr jeweiliger Zwilling hat (WR-01). Sonderfall ohne Zeitbezug: `endDate`
wird nirgends beachtet (WR-04) — dieselbe Mechanik, nur in der Gegenwart.

**B — Zeitzonen.** Fünf unbereinigte Stellen derselben Fehlerklasse wie WR-01 aus Phase 11,
zwei davon (`overtimeLiveCalculationService.ts:296`, `:414`) im Kern der
Abwesenheitsgutschrift; siehe WR-02. Das verbotene
`toISOString()` findet sich einmal im Desktop: `useBalances.ts:34`.

**C — Genehmigung ohne Genehmiger.** Pfad gefunden und an den Daten bestätigt: die
Auto-Genehmigung von Krankmeldungen (`absenceService.ts:573` + `:581`). Sie unterschlägt
zusätzlich die Neuberechnung (BL-05). Abgelehnte Anträge werden im Überstundenrechenwerk
korrekt ausgefiltert (alle Abfragen tragen `status = 'approved'`), **außer** im
Historien-Export (BL-03). Gelöschte Anträge gibt es nicht — sie werden hart gelöscht, ohne
`deletedAt`-Spalte.

**D — Soft-Delete-Disziplin.** Die zentralen Auswertungen filtern sauber
(`overtimeService.ts:591`, `:673`, `:635`; `unifiedOvertimeService.ts:325`;
`workTimeAccountService.ts:399-411`). Der DATEV-Export (WR-11 aus Phase 11) schließt
gelöschte Nutzer bewusst ein und filtert dafür auf genehmigte Anträge — konsistent
begründet. Der **Historien-Export** in derselben Datei tut weder das eine noch das andere
(BL-03). Zusätzlich fehlt der Filter in `calculateCurrentOvertimeBalance()`
(`overtimeLiveCalculationService.ts:697-702`, Teil von BL-01) und in dreizehn weiteren
Einzelabfragen `FROM users WHERE id = ?` ohne `deletedAt`.

**E — Doppelbuchung über Monatsgrenzen.** Auf der Überstundenseite **nicht mehr vorhanden**:
Der Genehmigungsweg zerlegt jeden Zeitraum tageweise und rechnet je Monat nach; die sechs
monatsübergreifenden Anträge im Bestand wurden geprüft. Auf der **Urlaubskontoseite** lebt
das Muster in Jahresauflösung weiter (WR-06); heute löst es kein Antrag aus.

**F — Rundung.** Einheitlich `Math.round(x * 100) / 100` an allen Stellen — mit **einer**
Ausnahme, die in dieselben Spalten schreibt wie die gerundete Variante und sie
überschreibt (WR-03). Der Fingerabdruck des ungerundeten Schreibers liegt im Bestand.

---

# Empfohlene Reihenfolge für die Reparaturphase

1. **BL-01** — kleinster Eingriff, größte sichtbare Wirkung. Drei Zeilen aus
   `overtimeLiveCalculationService.ts:226-228` sinngemäß nach `:712` übernehmen und die
   Deckelung zusätzlich in `calculatePeriodOvertime()` verankern.
2. **BL-05** und **BL-02** — beides Lücken im Nachrechnen. Sie gehören zusammen, weil sie
   dieselbe Ursache haben: ein Nebenweg, der die Neuberechnung des Hauptwegs nicht mitnimmt.
3. **BL-03** — zwei fehlende `WHERE`-Bedingungen, an der Schwesterfunktion in derselben
   Datei ablesbar.
4. **BL-04** — braucht eine Entscheidung, keinen Einzeiler: `deductOvertimeHours()` darf
   eine abgeleitete Tabelle nicht anfassen. Vermutlich ersatzlos entfernen, weil Weg C den
   Abzug bereits korrekt vornimmt. **Vor dem Entfernen an Testdaten nachmessen.**
5. **WR-03** und **WR-08** — beide betreffen „wer darf `overtime_balance` schreiben". Sinnvoll
   gemeinsam zu klären.
6. Der Rest nach Aufwand; **WR-05** sollte vor dem ersten produktiven Stundenwechsel
   erledigt sein, weil er genau dann scharf wird.

---

_Erstellt: 2026-08-24 · Prüfer: Claude (gsd-code-reviewer) · Tiefe: deep_
_Beweisdatenbanken ausschließlich lesend geöffnet (`readonly: true`), nichts verändert._
