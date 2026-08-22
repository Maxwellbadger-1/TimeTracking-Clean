---
phase: 12-stundenwechsel-bedienen
fixed: 2026-08-22
scope: desktop
source_review: .planning/phases/12-stundenwechsel-bedienen/12-REVIEW-DESKTOP.md
upstream: .planning/phases/12-stundenwechsel-bedienen/12-REVIEW-FIXES-SERVER.md
findings_in_scope: 26
fixed_count: 26
not_confirmed: 0
skipped: 0
status: all_fixed
---

# Phase 12: Fix-Bericht Desktop

**Quelle:** `12-REVIEW-DESKTOP.md` (5 Critical, 21 Warning im Auftrag; die 8 Info-Befunde
waren ausdrücklich außerhalb des Auftrags und sind unberührt geblieben)

**Ergebnis:** 26 von 26 Befunden behoben. Kein Befund als „nicht bestätigt" eingestuft —
jeder war beim Nachlesen im Code real.

Dazu kam eine Aufgabe, die nicht aus dem Desktop-Review stammt, sondern aus dem
**Server-Fix-Lauf**: dessen CR-01 hat die `model_change`-Zeile zu einer reinen Journalzeile
mit `hours: 0` und dem neuen, nicht summierten Feld `documentedDelta` gemacht. Ohne Nachzug
hätte der Kontoauszug „0,0 h" gezeigt. Erledigt zusammen mit CR-04/WR-07 (siehe unten).

---

## Regressionsschranke (Ausgangs- gegen Endzustand)

| Prüfung | Vorher | Nachher |
|---------|--------|---------|
| `cd desktop && npx tsc --noEmit` | sauber (Exit 0) | **sauber (Exit 0)** |
| `cd server && npx tsc --noEmit` | sauber (Exit 0) | **sauber (Exit 0)** |
| `cd server && npx vitest run` | 418 grün / 3 rot / 421 | **418 grün / 3 rot / 421** |

Die drei roten sind namentlich unverändert genau die bekannten, vorbestehenden:

- `unifiedOvertimeService.test.ts` → „should respect hire date and not include pre-employment months"
- `unifiedOvertimeService.test.ts` → „REGRESSION: User hired on 1st of month should calculate correctly"
- `vacationBackfillService.test.ts` → „erkennt einen bereits gelaufenen Backfill"

**Die rote Menge ist nicht gewachsen.**

**Keine Serverdatei wurde angefasst.** `git diff --name-only 58c5d20..HEAD | grep '^server/'`
liefert nichts. Die 19 geänderten Dateien liegen ausnahmslos unter `desktop/`.

Die untracked Datei `.planning/phases/10-perioden-fundament/10-REVIEW.md` ist unberührt
geblieben; es wurde ausschließlich mit `git add <Pfad>` gearbeitet, nie mit `git add -A`.

### Zur Prüfbarkeit

`vitest` ist im Desktop projektweit kaputt (fehlendes `@babel/runtime`) — das ist
vorbestehend und wurde auftragsgemäß nicht angefasst. Für die Laufzeitnachweise wurden
deshalb, wie in Plan 12-02, `npx tsx`-Skripte mit `node:assert` verwendet, für die
React-Komponenten zusammen mit dem bereits installierten `jsdom` (27.2.0) und
`react-dom/client` + `act`. Sechs solche Skripte liegen im Scratchpad und wurden am Ende
noch einmal geschlossen gegen den Endzustand ausgeführt — alle sechs grün.

`playwright` ist in diesem Arbeitsbaum **nicht** installiert (`node_modules/@playwright`
fehlt). `desktop/tests/` liegt außerdem außerhalb von `tsconfig.include` (`["src"]`) und
wird von `tsc` nicht erfasst. Die Änderungen an `user-edit.spec.ts` (WR-12/13/14) sind
deshalb per esbuild-Syntaxparse und per `grep` geprüft, nicht durch einen Testlauf. Das ist
im Commit ausdrücklich vermerkt und unten unter „UAT-Punkte" aufgeführt.

---

## Commits

| Commit | Befunde |
|--------|---------|
| `a939d01` | CR-01 |
| `3bb385c` | CR-02, WR-15 |
| `698d9e0` | CR-03 |
| `fff4272` | CR-04, WR-07 (+ Nachzug Server-CR-01: `documentedDelta`) |
| `9b3f3f0` | CR-05 |
| `11d3c0c` | WR-01, WR-02 |
| `313800e` | WR-03, WR-09 |
| `283b7ed` | WR-04, WR-05 |
| `ffbf28f` | WR-06, WR-19 |
| `fa4a3c0` | WR-08, WR-17 |
| `150e59f` | WR-11 |
| `f3326e1` | WR-10 |
| `c32b07e` | WR-12, WR-13, WR-14 |
| `b58cf85` | WR-16 |
| `554f1ff` | WR-18 |
| `e4e54b7` | WR-20, WR-21 |

---

## Critical

### CR-01 — Rules-of-Hooks-Verletzung in `UserManagementPage`

Die Zugriff-verweigert-Rückgabe stand vor drei `useMemo`-Hooks. Sie steht jetzt hinter
allen elf Hooks, unmittelbar vor `handleDeleteClick`. Damit bleibt die TypeScript-Verengung
von `currentUser` für `handleDeleteClick` (Zeile mit `currentUser.id`) und für das JSX
(`user.id !== currentUser.id`) erhalten — `tsc` bestätigt das.

**Bewusst nicht übernommen:** der Vorschlag, `useUsers(true)` auf
`useUsers(currentUser?.role === 'admin')` umzustellen. Das wäre eine Verhaltensänderung
(die Abfrage liefe für Nicht-Admins nicht mehr an), die für den Befund nicht nötig ist —
die Hookanzahl ist so oder so konstant. Minimaleingriff bevorzugt.

### CR-02 — Die Fokusfalle griff nie

Beide Primitive implementieren den Tab-Ring über `onKeyDown` **auf dem Panel**; ein solcher
Handler feuert nur, wenn der Fokus bereits innerhalb des Panels liegt. Keine der beiden
setzte beim Öffnen einen Anfangsfokus. Der Öffnungs-Effekt zieht den Fokus jetzt auf das
erste sichtbare fokussierbare Element des Panels, ersatzweise (kein fokussierbares Element)
auf das Panel selbst über `tabIndex = -1`.

**Nachweis (jsdom + `act` + `node:assert`), für `Modal` UND `ConfirmDialog`:** Anfangsfokus
liegt im Panel; Tab auf dem letzten Element springt auf das erste zurück (der Ring ist also
tatsächlich geschlossen, was er vorher nicht war); Fokusrückgabe auf den Auslöser beim
Schließen; Scroll-Lock danach wieder freigegeben.
**Gegenprobe:** mit deaktiviertem Anfangsfokus schlägt genau die erste Zusicherung fehl —
`AssertionError: … liegt aber auf trigger`. Die Verfälschung wurde unmittelbar
zurückgenommen.

**Aufrufer-Anfangsfokus bleibt wirksam:** `WorkTimeChangeModal` setzt den Fokus in seinem
eigenen Effekt auf das Feld „Stichtag". Kind-Effekte (`Modal`) laufen vor Eltern-Effekten,
der Aufrufer gewinnt also. Das ist nicht bloß behauptet, sondern im selben Skript mit einer
Nachbau-Komponente belegt.

**Nebenwirkung, bewusst in Kauf genommen:** Bei allen 13 `Modal`-Aufrufern liegt der
Anfangsfokus jetzt auf dem Schließen-Knopf im Kopf (er ist das erste fokussierbare Element
im Panel). Vorher lag er außerhalb des Dialogs — das ist in jeder Hinsicht die schlechtere
Ausgangslage. Kein Aufrufer und kein Test hängt an der Fokusposition; `page.fill()` in
Playwright ist fokusunabhängig.

### CR-03 — Tagesstunden ohne Wertebereich

`min`/`max` am rohen `<input type="number">` sind reine Hinweise, solange kein
`form.checkValidity()` läuft — der Dialog validiert von Hand. `parseFloat('-5') || 0` ergibt
`-5`, `parseFloat('88') || 0` ergibt `88`.

- `WorkScheduleEditor`: `clampDayHours()` begrenzt jede Eingabe auf 0..24.
- `WorkTimeChangeModal`: zusätzlich ein **blockierender** Feldfehler am Tagesplan, wenn ein
  Tag außerhalb 0..24 liegt — der Klemmwert greift nur beim Tippen, nicht bei einem aus
  einer Bestandsperiode vorbelegten Plan.

**Die Gegenstelle im Server war bereits geschlossen:** der Server-Fix-Lauf hat mit seinem
CR-04 `server/src/utils/workSchedule.ts` angelegt (`MAX_DAILY_HOURS = 24`, Bereichsprüfung in
`isWorkSchedule()`, dazu die Wochensumme gegen 60). Nachgelesen und bestätigt — deshalb war
hier ausschließlich die vom Review geforderte Frontend-Seite offen.

**Nachweis (jsdom):** „88" → 24, „-5" → 0, „7.5" unverändert, „" → 0.
**Gegenprobe:** ohne Begrenzung „war 88".

### CR-04 — „eingetragen am" zeigte das UTC-Datum

`createdAt` kommt aus `overtime_transactions.createdAt` mit dem Spaltendefault
`datetime('now')`; SQLite liefert dort immer UTC, unabhängig von `TZ=Europe/Berlin` im
Serverprozess. `slice(0, 10)` schnitt den UTC-Tag heraus und behandelte ihn als Ortstag.
`formatCreatedAtDe()` behandelt den Zeitstempel jetzt als UTC-Moment und formatiert ihn in
Ortszeit; trägt er bereits eine Zonenkennzeichnung (ISO mit `Z` oder Offset), wird sie
respektiert. Unlesbares liefert `''` statt „Invalid Date" — der Aufrufer lässt die Angabe
dann ersatzlos weg.

**Nachweis (Zone Europe/Berlin, geprüft über
`Intl.DateTimeFormat().resolvedOptions().timeZone`, weil `TZ=` als Kommandopräfix unter
Git Bash/Windows nicht bis in den Node-Prozess durchschlägt):** Sommerzeit-Grenzfall
`2026-08-21 23:30:00` → 22.8.2026, Winterzeit-Grenzfall `2026-01-15 23:30:00` → 16.1.2026,
Tagesmitte unverändert, ISO mit `Z` und mit Offset korrekt, Unlesbares → `''`.
**Gegenprobe im Test selbst:** die alte `slice(0,10)`-Fassung liefert nachweislich
21.8.2026, also den Vortag.

### CR-05 — Fehlgeschlagene Feiertagsabfrage blieb unbemerkt

`apiClient.request()` wirft bei einem Serverfehler nicht, sondern liefert
`{ success: false, error, data: undefined }`. Beide Feiertags-Hooks prüften `response.success`
nicht und lieferten stumm `[]`. `holidaysError` wurde damit nie wahr, `previewUnavailable`
im `AbsenceRequestForm` war ein Scheinschutz, jeder Feiertag zählte als voller Arbeitstag —
und die Prüfung „Du hast nur noch {n} Urlaubstage verfügbar" blockierte einen sachlich
zulässigen Weihnachtsurlaub.

Beide Hooks werfen jetzt bei `!success`. `useHolidays()` wurde mitgezogen, obwohl es keinen
Aufrufer hat (`useCurrentYearHolidays` ebenfalls nicht) — derselbe Defekt, dieselbe Datei,
kein Risiko.

**Verträglichkeit geprüft:** `CalendarPage` ist der zweite Verbraucher von
`useMultiYearHolidays()`. Es liest `holidays` an allen drei Stellen bereits über
`holidays || []` und wertet `isError` nicht aus — ein Fehlschlag führt dort also weiterhin zu
einer leeren Feiertagsliste, nicht zu einem Absturz. Verhalten unverändert.

---

## Warnings

### WR-01 — Vorzeichen an den Sollstunden
`bisher` und `neu` laufen jetzt über `formatHours()`, nur die `Differenz` bleibt
vorzeichenbehaftet — wörtlich nach dem Textbuch in `12-UI-SPEC.md`.

### WR-02 — Saldoänderung 0 war grün mit Aufwärtspfeil
Dreiwegunterscheidung: grün/`TrendingUp`, rot/`TrendingDown`, bei 0 **kein Icon** und
`text-gray-600 dark:text-gray-400`, wie der Vertrag es für diesen Randfall festlegt. Der Text
„± 0:00h" trägt die Aussage weiterhin allein — Farbe ist nicht der einzige Träger.

### WR-03 — Wettlauf zweier Vorschauanfragen
Laufende Nummer je Anfrage; späte Antworten werden in `onSuccess` **und** `onError`
verworfen. Zusätzlich erhöht jede Feldänderung (Stichtag, Wochenstunden, Tagesplan) die
Nummer — sonst könnte eine noch unterwegs befindliche Antwort landen, obwohl ihr gar keine
neue Anfrage folgt (z. B. weil die neue Eingabe ungültig ist). Diesen Zusatz nennt das Review
nicht; ohne ihn bliebe das Loch für genau diesen Fall offen.

### WR-04 — Wochenstunden außerhalb 0–60 waren eine stumme Sackgasse
Der Wertebereich wird jetzt beim Tippen geprüft, nicht erst beim Absenden. Damit erreicht die
Vertragsmeldung „Wochenstunden müssen zwischen 0 und 60 liegen" (Zustand 9) den Anwender
überhaupt erst — vorher entstand sie nur in `validateForm()`, das nur `handleSubmit` aufruft,
und ein Submit war bei deaktiviertem Submit-Button nicht auslösbar.

### WR-05 — Fehlendes Eintrittsdatum
`hireDate` wird ausdrücklich als `string | null` geführt. Anzeige „nicht hinterlegt",
Stichtagsprüfung nur bei vorhandenem Datum. **Zusätzlich zum Review:** auch der Satz
„Aktuell gültig seit …" im Infopanel griff auf `user.hireDate` zurück und hätte dort
„Invalid Date" gerendert; er verzichtet jetzt auf den Datumsteil, wenn weder Periode noch
Eintrittsdatum vorliegen.

### WR-06 — Periodenauflösung dreimal implementiert
Beide Nachbauten laufen jetzt über `resolveWorkTimePeriodIn()`. Die Liste bestimmt die heute
gültige Periode einmal und vergleicht je Zeile nur die Id.

**Nachweis (`node:assert`):** Äquivalenz beider entfernter Inline-Fassungen zum Helfer über
zehn Stichtage und **beide** Sortierreihenfolgen (der Dialog liest die API-Reihenfolge, die
Liste sortiert absteigend), plus die Vorbedingung „höchstens eine Periode je Stichtag".

**Ein echter Unterschied, gefunden und festgehalten:** Bei einer *überschneidenden*
Periodenkette (zwei offene Perioden) markierte die Vorfassung **beide** Zeilen als „Aktuell",
die neue Fassung genau eine. Der Server schließt diesen Fall in derselben Transaktion aus
(D6/D7); die neue Darstellung ist die richtigere. Der Fall steht ausdrücklich im Prüfskript,
damit er nicht als übersehene Abweichung durchgeht.

### WR-07 — `any` im Renderpfad
`OvertimeTransactionRow` ist aus `useWorkTimeAccounts` exportiert; die Annotation entfällt
ersatzlos, `transaction` ist inferiert.

### WR-08 — `alert()` im `EditUserModal`
Ersetzt durch `endDateError` über die `error`-Prop von `Input` (die `role="alert"` bereits
mitbringt), zurückgesetzt beim Tippen, bei jeder Validierung und beim Schließen.

### WR-09 — Steuerfluss an deutschen Servertexten
Die beiden Textmuster stehen jetzt als benannte, greppbare Konstanten
(`SERVER_MESSAGE_PATTERNS`) mit Zeiger auf die erzeugende Serverstelle. Das ist die vom
Review ausdrücklich benannte Zwischenlösung. Die saubere Fassung (maschinenlesbarer Code in
der Antwort) verlangt eine Vertragsänderung über `ApiResponse`, `apiClient.request()` (das
heute nur `{ success, error }` zurückgibt), die Hooks und den Server — sie steht unter
„Offene Punkte".

### WR-10 — Toast leakte `PREVIEW_STALE:`
`endpoint.startsWith('/work-periods')` unterdrückt den globalen Toast, analog zur
bestehenden `is403OnUsers`-Ausnahme. **Geprüft:** es gibt genau drei `/work-periods`-Aufrufe
(`useWorkTimeChange.ts`), und alle drei Verbraucher stellen ihre Fehler selbst dar —
`WorkTimeChangeModal` (Banner + Feldfehler), `WorkTimePeriodList` (Fehlerzustand mit
„Perioden erneut laden"), `AbsenceRequestForm` (`previewUnavailable`).

### WR-11 — Zustand 10 war nicht verdrahtet
Der Wechsel-Dialog meldet die Kollisionsperiode über den neuen, **optionalen** Rückruf
`onConflict?: (periodId: number | null) => void` — aus der eigenen Validierung **und** aus dem
Fall, in dem erst der Server die Kollision meldet. Das `EditUserModal` hält die Id und reicht
sie als `highlightPeriodId` weiter. Jede Änderung am Stichtag, das Zurücksetzen des
Formulars, das Schließen und das erfolgreiche Speichern heben die Markierung wieder auf.
`WorkTimePeriodList` ist unverändert — der Auswertungspfad war schon da, ihm fehlte nur der
Aufrufer.

Ist die Liste in Zustand 2 (Ladefehler), gibt es nichts hervorzuheben; dann trägt der
Feldfehler die Information allein, genau wie der Vertrag es vorsieht.

### WR-12 — Sechs (tatsächlich sieben) E2E-Tests mit einem Selektor, den es nicht gibt
Das Review nennt sechs Zeilen; im Code waren es **sieben** (`:39`, `:71`, `:161`, `:197`,
`:209`, `:236`, `:270`) — die Zeile 71 fehlt in der Aufzählung des Berichts. Alle sieben sind
auf `button:has-text("Bearbeiten")` umgestellt, wie der eine bereits reparierte Test.

Zusätzlich bekommt der Zeilenbutton ein nutzerbezogenes
`aria-label="Bearbeiten: {Vorname} {Nachname}"`. **Wichtig:** Das allein hätte die Tests
*nicht* repariert — `button[aria-label="Bearbeiten"]` ist ein exakter Attributvergleich und
hätte auch danach nicht getroffen. Deshalb beides: Textselektor in den Tests, aria-label für
die Barrierefreiheit. Der sichtbare Text bleibt „Bearbeiten", der Textselektor greift also.

### WR-13 — `toISOString().split('T')[0]` im E2E-Test
Ersetzt durch den 1. des Folgemonats, zeitzonensicher aus lokalen Kalenderfeldern. Damit ist
auch der zweite Teil des Befunds erledigt: `setMonth(getMonth() + 1)` lief an Monatsenden
über (31. Januar → 2./3. März).

### WR-14 — Zusicherung traf auch auf „40 h" zu
`table td` mit `/^0 h$/` statt `table tr:has-text("0 h")`.

### WR-15 — Modal-Infrastruktur zweimal wörtlich
Neu: `desktop/src/components/ui/useModalLayer.ts`. `FOCUSABLE_SELECTOR`, die vier Refs, der
Stack-Effekt, der ESC-Effekt, der Fokusrückgabe-Effekt und `handlePanelKeyDown` liegen dort
einmal; `Modal` und `ConfirmDialog` behalten nur ihr eigenes Markup. Genau diese Duplikation
war die Ursache dafür, dass CR-02 zweimal übersehen wurde.

Die Prop-Signaturen beider Komponenten sind unverändert (`isOpen`, `onClose`, `title`,
`children`, `size`, `zIndexClass` bzw. `onConfirm`, `message`, `confirmText`, `cancelText`,
`variant`, `zIndexClass`). `modalStack.ts` ist unberührt.

### WR-16 — Labels nicht mit ihren Eingaben verknüpft
`Input` und `Textarea` bekommen über `useId()` eine `id`, das Label ein `htmlFor`, das Feld
`aria-invalid` bei Fehler und `aria-describedby` auf Fehler- bzw. Hilfstext. Rein additiv;
kein Aufrufer übergibt heute eine eigene `id` (per `grep` geprüft), und falls doch, gewinnt
sie, weil `{...props}` nachgestellt bleibt und `htmlFor` ihr folgt.

**Die DOM-Struktur ist bewusst unangetastet** (Label direkt gefolgt vom Feld), weil
`user-edit.spec.ts` mit `label:has-text("Stichtag") + input` und
`label:has-text("Begründung") + textarea` auf die Geschwisterbeziehung angewiesen ist. Genau
das ist im Prüfskript mit abgesichert.

**Nachweis (jsdom):** `label.for == input.id`, Hilfstext und Fehlermeldung über
`aria-describedby` erreichbar, `role="alert"` erhalten, `aria-invalid` nur bei Fehler, zwei
Instanzen mit verschiedenen Ids, Aufrufer-Id gewinnt, Geschwisterbeziehung unverändert — für
`Input` und `Textarea`.

### WR-17 — Erfolgsbanner-Timer ohne Aufräumen
Timer in einer `useRef`, vor jedem Neusetzen gelöscht, beim Abmelden aufgeräumt.

### WR-18 — Selbstlösch-Schutz ohne Rückmeldung
`toast.error('Sie können Ihr eigenes Konto nicht löschen.')` statt `console.warn` + TODO; im
`catch` von `handleDeleteConfirm` ein Toast mit der Servermeldung statt zweier
`console.error` mit Debug-Emojis. Die Datei enthält damit keinen `console`-Aufruf mehr.

### WR-19 — „Heute" einmalig beim Montieren berechnet
Beide `useMemo(..., [])` sind durch `getTodayDate()` bei jedem Render ersetzt. Die beiden
lokalen `formatDateLocal`-Kopien entfallen damit ersatzlos — **IN-01 fällt nebenbei mit weg**,
ohne dass er eigens angefasst wurde. Die dritte Kopie (`timeUtils.ts:75-81`) ist
`getTodayDate()` selbst und bleibt.

### WR-20 — Toter `reasonError`, Pflichtgrund wurde nicht geprüft
Aufgelöst zugunsten von „optional": `required={type === 'sick'}` ist entfernt, der tote
Zustand samt seiner beiden Rücksetzer ebenfalls.

**Warum diese und nicht die andere Richtung:** Das Label sagt selbst „Grund (empfohlen)", der
Kommentar im Code nennt ihn „optional but recommended … just a hint, not blocking", und der
Server nimmt ihn als optionales Feld entgegen (`absenceService`: `reason?: string`,
gespeichert wird `data.reason || null` — nachgelesen). `required` war die einzige Stelle, die
etwas anderes behauptete. Den Grund verpflichtend zu machen wäre eine fachliche
Neufestlegung, keine Fehlerbehebung, und hätte die Serverseite mitgezogen.

### WR-21 — Feiertagsfenster ±2 Jahre
`AbsenceRequestForm` verweigert die Vorschau, wenn der gewählte Zeitraum außerhalb des
geladenen Fensters liegt — eine ehrliche Enthaltung statt einer falschen Zahl. Der Antrag
bleibt möglich; der Server rechnet ohnehin verbindlich.

**Abweichung vom Vorschlag des Reviews, mit Begründung:** Das Review schlägt vor, die
abgedeckten Jahre aus den *gelieferten* Feiertagsdaten abzuleiten
(`new Set(holidays.map(h => h.date.slice(0,4)))`). Das verwechselt „Jahr ohne Feiertagstreffer"
mit „Jahr nicht geladen". Geprüft wird deshalb gegen das **Fenster**, und das Fenster steht
in dem neuen, abhängigkeitsfreien Modul `hooks/holidayWindow.ts` — einer Stelle für Ladecode
und Prüfung.

**Nachweis (`node:assert`):** geladenes Fenster == geprüftes Fenster über 2020–2032, Jahre
knapp außerhalb werden abgewiesen, `NaN` gilt als außerhalb, und nach einem Jahreswechsel
rutscht das Fenster mit.

---

## Nachzug zum Server-Review: die `model_change`-Zeile im Kontoauszug

Server-CR-01 hat `model_change` zu einer reinen Journalzeile gemacht: `hours: 0`, der
dokumentierte Betrag im neuen, **nicht summierten** Feld `documentedDelta`. Der Grund ist
zwingend — die Live-Berechnung rechnet die Tageszeilen mit den aktuell gültigen Perioden neu,
die Wirkung der Umstellung steckt also bereits darin; summierte die Buchung mit, läge die
Summe der angezeigten Zeilen um genau diesen Betrag über dem daneben angezeigten Saldo.

Ohne Nachzug hätte die Stundenspalte „0,0 h" gezeigt — für den Leser falsch, denn die
Umstellung *hat* einen Betrag bewirkt. Die Zeile zeigt jetzt:

```
dokumentierte Differenz
+2:30h
```

- **Beschriftet** (`text-xs`, gray-500/400) — die Zahl ist ausdrücklich als Dokumentation
  gekennzeichnet, nicht als Kontobewegung.
- **Kein Trendpfeil.** Der bleibt den summierenden Zeilen vorbehalten; er ist das stärkste
  „das hat das Konto bewegt"-Signal. Vorzeichen und Farbe tragen die Richtung, Farbe ist
  also nicht der einzige Träger.
- **Nulldifferenz als „± 0:00h" in gray-600/400** — dasselbe Muster wie im Vorschaupanel.
- **`font-bold` bleibt**, wie `12-UI-SPEC.md` es für den Betrag der Journalzeile festlegt.
- **Fußnote unter der Tabelle**, nur wenn eine solche Zeile im angezeigten Zeitraum vorkommt:
  „Zeilen vom Typ ‚Modellwechsel' dokumentieren die Differenz, die eine Umstellung des
  Arbeitszeitmodells bewirkt hat. Der Betrag zählt **nicht** zusätzlich zum Saldo — er steckt
  bereits in den neu gerechneten Tageszeilen ab dem Stichtag."

Die Beschreibung, das Typ-Badge, der Tooltip und die zweite Beschreibungszeile („Periode ab …
· eingetragen am … von …") sind unverändert — `12-UI-SPEC.md` legt deren Wortlaut fest.

Damit ist **UAT-Punkt 2 des Server-Fix-Berichts erledigt**: die Gestaltungsentscheidung ist
getroffen und umgesetzt.

---

## Nebenbefund (nicht behoben, außerhalb des Auftrags)

**Die Typ-Union des Kontoauszugs stimmt nicht mit dem überein, was der Server liefert.**

`useWorkTimeAccounts.ts` deklariert (und deklarierte schon vorher) die Typen
`'earned' | 'compensation' | 'carryover' | 'unpaid_adjustment' | …`.
`calculateLiveOvertimeTransactions()` erzeugt aber `'time_entry'`, `'feiertag'`,
`'vacation_credit'`, `'sick_credit'`, `'overtime_comp_credit'`, `'special_credit'`,
`'unpaid_deduction'`, `'correction'`, `'model_change'` — geprüft an
`overtimeLiveCalculationService.ts` (Zeilen 114, 292, 347, 467, 522, 556) und an der Route
`GET /overtime/transactions/live`, die die Liste unverändert durchreicht.

`'earned'`, `'compensation'`, `'carryover'` und `'unpaid_adjustment'` können also nie
auftreten; `'time_entry'` und `'unpaid_deduction'` fehlen in der Union und fallen in
`getTypeLabel()` in den `default`-Zweig, der den **Rohwert** ausgibt.

Das ist **nicht** Gegenstand eines der 26 Befunde und wurde deshalb nicht geändert — eine
Korrektur würde die sichtbaren Typ-Bezeichnungen im Kontoauszug ändern und berührt beide
Seiten. WR-07 verlangt nur, das `any` durch den *im Hook deklarierten* Typ zu ersetzen; genau
das ist geschehen. Der Befund gehört in die Abnahme (siehe UAT-Punkt 4).

---

## Offene Punkte (bewusst nicht in diesem Lauf)

1. **Maschinenlesbarer Fehlercode statt Textmuster (WR-09, Rest).** Umgesetzt ist die vom
   Review benannte Zwischenlösung (benannte Konstanten mit Quellenzeiger). Die vollständige
   Fassung verlangt `code?: string` in `ApiResponse`, eine Durchreichung durch
   `apiClient.request()` (das heute bewusst nur `{ success, error }` zurückgibt), einen
   Fehlertyp in den Hooks, der den Code trägt, **und** eine Serveränderung. Das ist eine
   Vertragsänderung über fünf Dateien plus Server und gehört in eine eigene, geplante
   Änderung — nicht in einen Fix-Lauf mit der Auflage „Server nur, wo zwingend nötig".

---

## UAT-Punkte für Phase 14

1. **Fokusverhalten aller 13 `Modal`-Aufrufer (CR-02).** Der Anfangsfokus liegt jetzt auf dem
   Schließen-Knopf im Kopf des Dialogs, weil er das erste fokussierbare Element im Panel ist.
   Das ist maschinell belegt und in jedem Fall besser als der bisherige Zustand (Fokus
   außerhalb des Dialogs), aber ob es für die häufig benutzten Dialoge — `EditUserModal`,
   `TimeEntryForm`, `AbsenceRequestForm` — angenehm ist oder ob dort das erste Eingabefeld
   den Fokus bekommen sollte, ist eine Bedienentscheidung am laufenden Programm. Der Weg dahin
   ist offen: jeder Aufrufer kann seinen Anfangsfokus in einem eigenen Effekt setzen, genau
   wie es der Wechsel-Dialog für „Stichtag" tut (belegt).

2. **Kontrast und Lesbarkeit der neuen Elemente.** Die zweizeilige Stundenspalte der
   Modellwechsel-Zeile („dokumentierte Differenz" in `text-xs` gray-500/400 über dem Betrag),
   die neutrale Saldozeile in gray-600/400 (WR-02) und die Fußnote unter der Tabelle sind
   nach dem Farbvertrag der Phase gebaut, aber nicht am Bildschirm gegen ≥ 4,5:1 gemessen —
   das ist eine Sichtprüfung in beiden Modi.

3. **E2E-Suite `user-edit.spec.ts` (WR-12/13/14) einmal wirklich laufen lassen.** In diesem
   Arbeitsbaum ist `playwright` nicht installiert; geprüft wurde per Syntaxparse und `grep`.
   Ob die sieben reparierten Tests jetzt tatsächlich grün sind — insbesondere der
   umgeschriebene 0-Stunden-Test, der durch den Wechsel-Dialog läuft — gehört an eine
   Umgebung mit laufendem Server und installiertem Playwright.

4. **Typ-Union des Kontoauszugs (Nebenbefund oben).** Zu prüfen ist, was der Kontoauszug
   heute in der Spalte „Typ" für gewöhnliche Tageszeilen anzeigt. Nach Lage des Codes müsste
   dort der Rohwert `time_entry` stehen statt einer deutschen Bezeichnung. Ist das so, gehört
   die Union in `useWorkTimeAccounts.ts` an den Server angeglichen und `getTypeLabel()` um
   `time_entry` und `unpaid_deduction` ergänzt — ein eigener Befund, kein Teil dieses Laufs.

5. **Verweigerte Abwesenheitsvorschau außerhalb des Feiertagsfensters (WR-21).** Der Text
   lautet jetzt „Vorschau kann gerade nicht berechnet werden. Der Antrag kann trotzdem
   gestellt werden." — ein Bestandstext, der für einen Ladefehler gedacht war. Für den Fall
   „Zeitraum liegt mehr als zwei Jahre entfernt" wäre eine eigene, erklärende Formulierung
   besser. `12-UI-SPEC.md` kennt für diesen Fall keinen Textbaustein; die Formulierung ist
   eine Entscheidung für den Anwender.

6. **Der Grund bei einer Krankmeldung ist jetzt ausdrücklich optional (WR-20).** Das folgt
   Label, Codekommentar und Serververhalten. Sollte die Stiftung fachlich einen
   Pflicht-Grund wollen, ist das eine Neufestlegung, die beide Seiten betrifft — und dann in
   `validateForm()` **und** im Server zu verankern, nicht über das `required`-Attribut.

---

_Erstellt: 2026-08-22_
_Bearbeiter: Claude (Desktop-Scope, sequentieller Lauf auf dem Hauptarbeitsbaum)_
