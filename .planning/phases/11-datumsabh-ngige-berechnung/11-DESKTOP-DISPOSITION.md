# Desktop-Disposition (Plan 11-09, Task 2)

**Erstellt:** 2026-08-22
**Zweck:** Begründete, schriftliche Entscheidung über die vier Desktop-Fundstellen aus
`11-AUFRUFER-CHECKLISTE.md`. Kein drittes Ergebnis — stillschweigend offen lassen — ist
zulässig. Diese Datei belegt die Entscheidung, sie trifft sie nicht neu.

---

## Entscheidung

**Der Desktop wird in Phase 11 NICHT nachgezogen. Disposition: bewusste Auslassung,
zugeordnet an Phase 12.**

Zwei Begründungen tragen diese Entscheidung: ein struktureller Abhängigkeitskonflikt (immer
gültig) und ein Wirksamkeitsfenster (nur gültig, solange drei Messzahlen bei null liegen — hier
gemessen, nicht behauptet).

---

## Begründung 1: Abhängigkeitskonflikt

Der Desktop rechnet ohne eigenen Datenbankzugriff ausschließlich aus den Stammdaten, die die
API liefert (`user.weeklyHours`, `user.workSchedule` — aktueller Stand, keine Historie). Um
periodengetreu zu rechnen, bräuchte der Desktop einen Lesezugang zu den Arbeitszeitperioden
eines Nutzers. Eine solche API existiert nicht:

- `server/src/routes/` enthält keinen Endpunkt, der `user_work_periods` an einen Client
  ausliefert (verifiziert: kein Treffer für einen Perioden-Lese-Endpunkt in den Routen dieser
  Phase; die einzigen Aufrufer von `getWorkPeriods()`/`resolveWorkPeriodAt()` liegen in
  `server/src/services/` und `server/src/scripts/`).
- `.planning/phases/11-datumsabh-ngige-berechnung/11-CONTEXT.md` schließt eine solche API für
  Phase 11 ausdrücklich aus: „Keine Oberfläche und keine API zum Eintragen von Wechseln — das
  ist Phase 12."
- `.planning/ROADMAP.md`, Abschnitt „Phase 12: Stundenwechsel bedienen", nennt als Umfang
  ausdrücklich „API und Oberfläche für „Stundenwechsel ab Datum""" — das ist exakt die
  fehlende Voraussetzung.

Der Desktop kann in dieser Phase nicht nachgezogen werden, **weil das Fehlende erst in Phase 12
entsteht** — nicht, weil es aufwendig wäre. Ein Umbau des Desktop-Codes auf Basis einer noch
nicht existierenden API wäre Kompilat gegen Wunschdenken.

---

## Begründung 2: Wirksamkeitsfenster (Behauptung — hier gemessen, nicht angenommen)

Solange kein Nutzer eine zweite Arbeitszeitperiode haben kann, liefert die
Stammdaten-Rechnung des Desktops (`user.weeklyHours`/`user.workSchedule`, aktueller Stand)
dasselbe Ergebnis wie die periodengetreue Rechnung des Servers (`getDailyTargetHours(user,
date, periods)`) — für JEDES Datum, nicht nur für heute. Der Grund: Migration 009 hat jedem
Nutzer genau eine offene Periode mit den Werten seiner damaligen Stammdaten gegeben, Plan 11-03
spiegelt jede Stammdatenänderung seither in genau diese eine offene Periode (kein zweiter
Schreibweg), und es gibt in Phase 11 keinen Weg, eine zweite Periode für einen Nutzer
anzulegen (Perioden-Schreibzugriff ist nicht verdrahtet auf eine Route oder UI-Aktion — nur
interne Skripte und Services rufen `createWorkPeriod()`/`closeWorkPeriod()` auf).

### Drei Messzahlen gegen `server/database/11-nullwirkung.db` (nur lesend)

Befehl (readonly, `PRAGMA query_only = ON`, ausschließlich `SELECT`):

```
$ cd server && node -e "
const Database = require('better-sqlite3');
const db = new Database('./database/11-nullwirkung.db', {readonly:true});
db.pragma('query_only = ON');

// 1. Nutzer mit mehr als einer Periode
const multiPeriod = db.prepare(\`
  SELECT userId, COUNT(*) c FROM user_work_periods GROUP BY userId HAVING COUNT(*) > 1
\`).all();
console.log('1) Nutzer mit >1 Periode:', multiPeriod.length, JSON.stringify(multiPeriod));

// 2. Drift zwischen users.weeklyHours/workSchedule und offener Periode
const drift = db.prepare(\`
  SELECT u.id as userId, u.weeklyHours as usersWeeklyHours, u.workSchedule as usersWorkSchedule,
         p.weeklyHours as periodWeeklyHours, p.workSchedule as periodWorkSchedule
  FROM users u
  JOIN user_work_periods p ON p.userId = u.id AND p.validTo IS NULL
\`).all();
let driftCount = 0;
const driftIds = [];
for (const row of drift) {
  const wsA = row.usersWorkSchedule || null;
  const wsB = row.periodWorkSchedule || null;
  if (row.usersWeeklyHours !== row.periodWeeklyHours || wsA !== wsB) {
    driftCount++;
    driftIds.push(row.userId);
  }
}
console.log('2) Drift-Zahl:', driftCount, 'userIds:', JSON.stringify(driftIds));

// 3. Nutzer ohne offene Periode
const noOpen = db.prepare(\`
  SELECT u.id FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = u.id AND p.validTo IS NULL)
\`).all();
console.log('3) Nutzer ohne offene Periode:', noOpen.length, JSON.stringify(noOpen));

console.log('Gesamtzahl users:', db.prepare('SELECT COUNT(*) c FROM users').get().c);
console.log('Gesamtzahl user_work_periods:', db.prepare('SELECT COUNT(*) c FROM user_work_periods').get().c);

db.close();
"
```

**Wörtliche Ausgabe:**

```
1) Nutzer mit >1 Periode: 0 []
2) Drift-Zahl: 0 userIds: []
3) Nutzer ohne offene Periode: 0 []
Gesamtzahl users: 20
Gesamtzahl user_work_periods: 20
```

Alle drei Zahlen sind **0**, wie erwartet. Damit trägt Begründung 2: **Zum Zeitpunkt dieses
Plans zeigt der Desktop für jeden der 20 Nutzer in dieser Arbeitskopie exakt denselben Wert wie
der Server, für jedes Datum.** (Zahl 2 deckt sich mit der bereits in
`11-AUSGANGSZUSTAND.md` erhobenen Drift-Zahl aus Plan 11-01 — dort ebenfalls 0. Diese Messung
wiederholt sie bewusst, weil seither weiterer Code gelaufen ist, u. a. Plan 11-03, der
`users`-Änderungen in die offene Periode spiegelt.)

**Unversehrtheitsnachweis `11-nullwirkung.db`:** Dateigröße und Zeitstempel vor und nach dieser
Messung identisch (`1306624 Bytes`, `2026-08-22 07:01`) — kein Schreibzugriff, `readonly:true`
plus `PRAGMA query_only = ON` als doppelte Absicherung.

### Ab wann trägt Begründung 2 nicht mehr

Ab Phase 12 gibt es einen Weg, eine zweite Periode anzulegen (Stundenwechsel-Feature) — ab da,
und keinen Tag früher, kann die Desktop-Anzeige einem Anwender andere Sollstunden zeigen als
der Server (z. B. eine rückwirkende Umstellung: der Desktop würde weiterhin mit den heutigen
Stammdaten rechnen, der Server bereits mit der neuen, ab dem Stichtag gültigen Periode). Das ist
exakt der Zeitpunkt, an dem Phase 12 den Desktop nachziehen muss — s. Übergabe unten.

---

## Die vier Desktop-Dateien einzeln

### 1. `desktop/src/utils/timeUtils.ts:213-247`

Eigenständige Reimplementierung von `calculateAbsenceHoursWithWorkSchedule(startDate, endDate,
workSchedule, weeklyHours)`. Nimmt (anders als die Server-Funktion seit Plan 11-04) keinen
`user`/`periods`-Parameter, sondern `workSchedule` und `weeklyHours` bereits aufgelöst als
Parameter — sie kann strukturell keine Periode auflösen, selbst wenn sie eine API dafür hätte,
ohne einen eigenen Umbau ihrer Signatur.

**Rechnet sie über einen vergangenen Zeitraum oder nur über den heutigen/künftigen Stand?**
Aus dem Code: Die Funktion selbst ist zeitraumagnostisch — sie iteriert `startDate` bis
`endDate` und wendet für jeden Tag das übergebene `workSchedule`/`weeklyHours` an, unabhängig
davon, ob der Zeitraum in der Vergangenheit oder Zukunft liegt. Sie trägt also **kein eigenes
Zeitraum-Merkmal** — das hängt vollständig davon ab, welche Werte ihr einziger Aufrufer
(`AbsenceRequestForm.tsx`) übergibt, s. u.

### 2. `desktop/src/components/absences/AbsenceRequestForm.tsx:15,64-76`

Der einzige Aufrufer von `timeUtils.ts:213` (belegt: `grep -rn
"calculateAbsenceHoursWithWorkSchedule" desktop/src --include=*.tsx` findet außer dieser Datei
keinen zweiten Aufrufer). Ruft die Funktion mit `selectedUser.workSchedule`,
`selectedUser.weeklyHours` — den **aktuellen** Stammdaten des ausgewählten Nutzers, nicht
periodenbezogen — für den vom Formular gewählten `startDate`/`endDate` auf (Zeile 62-69).

**Wofür dient der Wert, und berechnet der Server ihn beim Speichern ohnehin neu?** — aus dem
Code belegt, nicht angenommen:

- Der berechnete `requiredHours`-Wert wird ausschließlich in lokalem React-State
  (`setRequiredHours(hours)`, Zeile 68) gehalten und für die Live-Vorschau im Formular
  angezeigt (z. B. Validierung „Du hast nur X Überstunden verfügbar", Zeile 121-125) —
  **nicht** für Persistenz-Entscheidungen der Vergangenheit, sondern für eine
  Momentaufnahme-Anzeige während der Antragstellung.
- Der Submit-Handler (`handleSubmit`, Zeile 135-150) sendet an `createRequest.mutateAsync(...)`
  ausschließlich `{ userId: selectedUserId, type, startDate, endDate, reason }` — **kein
  `requiredHours`-Feld im Payload.** Wörtlich geprüft (Zeilen 140-146):
  ```
  await createRequest.mutateAsync({
    userId: selectedUserId,
    type,
    startDate,
    endDate,
    reason: reason.trim() || undefined,
  });
  ```
- Der Server berechnet den tatsächlich gespeicherten/gebuchten Stundenwert beim Anlegen bzw.
  bei der Genehmigung selbst neu, über die periodengetreue Server-Funktion — belegt durch
  `server/src/services/absenceService.ts:364` (`getAbsenceRequestsPaginated()`,
  `calculateAbsenceHoursWithWorkSchedule(user, absence.startDate, absence.endDate, periods)`)
  und `:828`/`:902` (`approveAbsenceRequest()`, dieselbe Server-Funktion mit
  `directWorkPeriodLookup`/periodengetreuem Kontext) — beide in `11-AUFRUFER-CHECKLISTE.md`
  bereits als `[x]` (Plan 11-07) geführt.

**Ergebnis:** Der Client-Wert ist eine reine UI-Vorschau ohne Persistenzwirkung. Selbst ein
falscher Client-Wert (z. B. durch einen künftigen Stundenwechsel veraltet) würde keine falsche
Buchung erzeugen — nur eine irreführende Vorschauzahl vor dem Absenden. Das ist ein
UX-Mangel, kein Korrektheits-/Sicherheitsrisiko der gespeicherten Daten. Trägt zur
Begründung 2 zusätzlich bei: Selbst außerhalb des Wirksamkeitsfensters wäre der fachliche
Schaden auf eine falsche Vorschau begrenzt, nicht auf einen falschen Saldo.

**Zeitraum:** Formular zur Antragstellung — `startDate`/`endDate` liegen typischerweise im
künftigen oder laufenden Zeitraum (Urlaubsantrag), können aber technisch auch rückwirkend
gewählt werden (kein Datums-Minimum im Formular ersichtlich, `getTodayDate()` ist nur der
Vorgabewert). Die Funktion selbst ist zeitraumagnostisch (s. Punkt 1) — die Vorschau **kann**
sich auf einen vergangenen Zeitraum beziehen, ohne Persistenzwirkung (s. o.).

### 3. `desktop/src/components/worktime/WorkScheduleDisplay.tsx:41-67`

Zeigt das hinterlegte Arbeitszeitmodell eines Nutzers (Dashboard-Widget/Detailansicht).
`hasIndividualSchedule = !!user.workSchedule` (Zeile 43); ohne individuelles Modell:
`const dailyHours = user.weeklyHours / 5;` (Zeile 60), Verteilung auf eine synthetische
Mo-Fr-Standardwoche zur Tabellen-/Chart-Darstellung.

**Rechnet sie über einen vergangenen Zeitraum oder nur über den heutigen/künftigen Stand?**
Aus dem Code: `user` kommt als Prop vom aktuellen, per API geladenen Nutzerobjekt — es gibt
**keinen** Datums-/Zeitraum-Parameter in der Komponente (`interface
WorkScheduleDisplayProps { user: User; mode; onDetailsClick? }`, Zeile 13-17). Die Komponente
zeigt **ausschließlich den heutigen Stand** des hinterlegten Modells, nie einen historischen
Wert. Kein Widerspruch zum Server für vergangene Zeiträume möglich, weil sie für vergangene
Zeiträume gar nichts behauptet.

### 4. `desktop/src/components/users/WorkScheduleEditor.tsx:29-60,186`

Eingabemaske beim Anlegen/Bearbeiten eines Nutzers. `handleToggle()` erzeugt beim Umschalten
auf „individuelles Modell" einen Vorschlagswert (`dailyHours = Math.round((weeklyHours / 5) *
100) / 100`, Zeile 44) für eine Mo-Fr-Verteilung; Zeile 186 zeigt denselben Hilfetext
(„{weeklyHours}h ÷ 5 Arbeitstage = ...h/Tag").

**Rechnet sie über einen vergangenen Zeitraum oder nur über den heutigen/künftigen Stand?**
Aus dem Code: `WorkScheduleEditorProps { value; weeklyHours; onChange }` (Zeile 4-8) — kein
Datums-Parameter. Der fachliche Fall ist strukturell zukunftsgerichtet: Ein Admin trägt hier
ein **neues** Arbeitszeitmodell ein (Formular-Vorschlagswert für die Eingabe, kein Bezug auf
einen historischen Zeitraum). Bestätigt den bereits in `11-AUFRUFER-TEIL-05.md`/
`11-AUFRUFER-CHECKLISTE.md` vermerkten Befund aus Phase 9 („Formular-Vorschlagswert und
Hilfetext, keine Berechnung mit Auswirkung auf Salden").

---

## Übergabe an Phase 12

`.planning/ROADMAP.md`, Abschnitt „Phase 12: Stundenwechsel bedienen", ist um einen Punkt unter
„**Umfang**" ergänzt, der die drei Desktop-Dateien (die vierte, `desktop/src/utils/index.ts`,
ist nur ihr Re-Export und folgt derselben Änderung) namentlich nennt und auf dieses Dokument
verweist. Sobald Phase 12 eine Perioden-Lese-API und eine UI zum Eintragen von Wechseln liefert,
sind `timeUtils.ts`, `AbsenceRequestForm.tsx`, `WorkScheduleDisplay.tsx` und
`WorkScheduleEditor.tsx` auf denselben periodengetreuen Maßstab zu bringen wie der Server —
nicht früher, weil vorher (Begründung 1) die Voraussetzung fehlt, und nicht ohne erneute
Prüfung der drei Messzahlen, weil ab Phase 12 mindestens eine von ihnen aufhören wird, null zu
sein (das ist der Zweck von Phase 12).

---

## Ergebnis

Kein blockierender Befund. Alle drei Messzahlen sind 0. Disposition: **nicht nachgezogen,
zugeordnet an Phase 12**, mit schriftlicher Begründung (Abhängigkeitskonflikt) und gemessenem
Wirksamkeitsfenster (drei Zahlen, alle 0) in diesem Dokument.
