---
phase: 12-stundenwechsel-bedienen
reviewed: 2026-08-22T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - desktop/src/components/absences/AbsenceRequestForm.tsx
  - desktop/src/components/ui/ConfirmDialog.tsx
  - desktop/src/components/ui/Modal.tsx
  - desktop/src/components/ui/modalStack.ts
  - desktop/src/components/ui/modalStack.test.ts
  - desktop/src/components/users/EditUserModal.tsx
  - desktop/src/components/users/WorkScheduleEditor.tsx
  - desktop/src/components/worktime/OvertimeTransactions.tsx
  - desktop/src/components/worktime/WorkScheduleDisplay.tsx
  - desktop/src/components/worktime/WorkTimeChangeModal.tsx
  - desktop/src/components/worktime/WorkTimePeriodList.tsx
  - desktop/src/hooks/useWorkTimeAccounts.ts
  - desktop/src/hooks/useWorkTimeChange.ts
  - desktop/src/pages/UserManagementPage.tsx
  - desktop/src/types/index.ts
  - desktop/src/utils/index.ts
  - desktop/src/utils/timeUtils.ts
  - desktop/src/utils/timeUtils.periods.test.ts
  - desktop/tests/user-edit.spec.ts
findings:
  critical: 5
  warning: 17
  info: 8
  total: 30
status: issues_found
---

# Phase 12: Code-Review-Bericht (Desktop)

**Geprüft:** 2026-08-22
**Tiefe:** standard
**Geprüfte Dateien:** 19
**Status:** issues_found

## Zusammenfassung

Geprüft wurde der Desktop-Anteil von Phase 12 „Stundenwechsel bedienen": der neue
Wechsel-Dialog, die Periodenliste, der Modal-Stack samt Umbau von `Modal`/`ConfirmDialog`,
die schreibgeschützten Stammdatenfelder im `EditUserModal`, die Journalzeile im Kontoauszug
sowie die periodengetreuen Zeitfunktionen und die beiden Prüfskripte.

`npx tsc --noEmit` läuft im Verzeichnis `desktop/` fehlerfrei durch. Die Kernentscheidungen
der Phase sind eingehalten: **D2** (Vorschau ausschließlich vom Server) wird nirgends
verletzt — weder `useWorkTimeChange.ts` noch `WorkTimeChangeModal.tsx` rechnen eine Differenz
oder Zwischensumme nach; **D1** ist umgesetzt (Wochenstunden und Tagesplan im
`EditUserModal` schreibgeschützt, Absendepfad nimmt die Werte aus `user`, nicht aus dem
Formularzustand); **D4** ist im Fußnotentext des Vorschaupanels sichtbar. Alle Serveraufrufe
laufen über `apiClient`, der intern `universalFetch` benutzt (`src/api/client.ts:130`) —
kein direktes `fetch()` in den geprüften Dateien. `console.log` ist aus den betroffenen
Dateien verschwunden.

Trotzdem ist der Stand nicht auslieferbar. Fünf Befunde führen zu falschem Verhalten:
eine Verletzung der Rules of Hooks, die die Benutzerverwaltung zum Absturz bringen kann;
eine Fokusfalle, die faktisch nie greift (damit sind Zustand 11 des UI-Vertrags und die
Barrierefreiheitszusage nicht erfüllt); fehlende Wertprüfung der Tagesstunden in Frontend
**und** Backend; ein Zeitzonenfehler im Prüfpfad des Kontoauszugs; und eine stumm
fehlschlagende Feiertagsabfrage, die die Abwesenheitsvorschau falsch rechnen *und* einen
korrekten Antrag blockieren lässt.

Dazu kommen zwei ausdrückliche Abweichungen vom bindenden `12-UI-SPEC.md`
(vorzeichenbehaftete Sollstunden, grüner Aufwärtspfeil bei Differenz 0) und ein Zustand
des Vertrags, der überhaupt nicht verdrahtet wurde (Zustand 10, `highlightPeriodId`).

---

## Critical Issues

### CR-01: Rules-of-Hooks-Verletzung — `useMemo` steht hinter einer frühen Rückgabe

**Datei:** `desktop/src/pages/UserManagementPage.tsx:51-63` (frühe Rückgabe), `:66`, `:75`, `:118` (Hooks danach)

**Problem:** Die Komponente ruft acht `useState`-Hooks (Zeile 37–49) auf, gibt dann bei
`!currentUser || currentUser.role !== 'admin'` früh eine Zugriff-verweigert-Karte zurück
(Zeile 51–63) und ruft **erst danach** drei `useMemo`-Hooks auf (`departments` Zeile 66,
`filteredUsers` Zeile 75, `stats` Zeile 118).

Solange der angemeldete Nutzer Admin ist, werden 11 Hooks gerendert. Wechselt
`currentUser` während der Lebensdauer der Komponente auf `null` (Abmeldung, Sessionablauf,
`authStore`-Reset) oder die Rolle auf `employee` (Rollenänderung durch einen zweiten Admin
plus WebSocket-Invalidierung), rendert derselbe montierte Komponentenknoten nur noch
8 Hooks. React bricht dann mit „Rendered fewer hooks than expected. This may be caused by
an accidental early return statement." ab — weißer Bildschirm statt sauberer Weiterleitung.
Ob der Router die Seite vorher abmeldet, ist nicht garantiert: Zustand benachrichtigt
Abonnenten direkt, die Reihenfolge gegenüber dem Elternrender ist nicht zugesichert.

Ausgerechnet diese Datei wurde in Phase 12 angefasst (Umstellung auf `editingUserId`), die
Hookanzahl ist dabei unverändert geblieben — der Defekt bleibt bestehen.

**Fix:** Die Berechtigungsprüfung hinter alle Hooks ziehen:

```tsx
export function UserManagementPage() {
  const { user: currentUser } = useAuthStore();
  const { data: users, isLoading } = useUsers(currentUser?.role === 'admin');
  // ... alle useState ...

  const departments = useMemo(() => { /* … */ }, [users]);
  const filteredUsers = useMemo(() => { /* … */ }, [users, searchQuery, roleFilter, statusFilter, departmentFilter]);
  const stats = useMemo(() => { /* … */ }, [users]);
  const editingUser = users?.find(u => u.id === editingUserId) ?? null;

  // ERST JETZT die frühe Rückgabe
  if (!currentUser || currentUser.role !== 'admin') {
    return ( /* Zugriff verweigert */ );
  }

  // … restliches JSX (currentUser.id in Zeile 131/473 bleibt gültig)
}
```

---

### CR-02: Die Fokusfalle greift nie — kein Anfangsfokus in `Modal` und `ConfirmDialog`

**Dateien:** `desktop/src/components/ui/Modal.tsx:70-115`, `desktop/src/components/ui/ConfirmDialog.tsx:81-128`

**Problem:** Beide Komponenten implementieren einen Tab-Ring über `onKeyDown` **auf dem
Panel** (`Modal.tsx:133`, `ConfirmDialog.tsx:147`). Ein `keydown`-Handler auf dem Panel
feuert nur, wenn der Fokus bereits *innerhalb* des Panels liegt. Keine der beiden
Komponenten setzt beim Öffnen einen Anfangsfokus — es gibt in beiden Dateien keinen
einzigen `.focus()`-Aufruf im Öffnungspfad, nur im Cleanup der Fokusrückgabe
(`Modal.tsx:78`, `ConfirmDialog.tsx:89`).

Folge in der Praxis:

- `EditUserModal` wird über den Zeilenbutton „Bearbeiten" geöffnet
  (`UserManagementPage.tsx:459-465`). Der Fokus bleibt auf diesem Button — er liegt im
  DOM **vor** dem per Portal an `document.body` angehängten Dialog. Tab führt den
  Tastaturnutzer damit in die Tabelle **hinter** dem Modal („Passwort zurücksetzen",
  „Löschen" der nächsten Zeilen). Es gibt kein Containment.
- Gleiches beim `ConfirmDialog` der Löschbestätigung (`UserManagementPage.tsx:536-546`):
  Bei offener Bestätigung ist die Liste dahinter voll bedienbar; der Admin kann per Tastatur
  einen *anderen* Nutzer löschen, während die Bestätigung für den ersten offensteht.
- **Zustand 11 des UI-Vertrags ist damit nicht erfüllt.** `12-UI-SPEC.md` fordert wörtlich:
  „der Wechsel-Dialog bleibt sichtbar, aber **nicht bedienbar** (Fokusfalle liegt auf der
  Bestätigung)". Tatsächlich bleibt der Fokus beim Öffnen des `ConfirmDialog` auf dem
  Primärbutton des Wechsel-Dialogs stehen, und dessen eigener Tab-Ring ist wegen
  `!isTopModal(...)` (`Modal.tsx:93`) abgeschaltet — der Ring ist an dieser Stelle also
  *doppelt* wirkungslos.
- Screenreader kündigen den Dialog nicht an, weil der Fokus außerhalb von
  `role="dialog" aria-modal="true"` verbleibt. `aria-modal` allein blendet den Hintergrund
  nur für einige Screenreader aus, nicht für die Tabulatorreihenfolge.

`WorkTimeChangeModal` ist der einzige Aufrufer, der das selbst löst
(`WorkTimeChangeModal.tsx:150`, `validFromRef.current?.focus()`) — der Vertrag verlangt das
Containment aber von der Primitive, für **jede** oberste Instanz.

**Fix:** Anfangsfokus in beiden Primitiven setzen, wenn er noch außerhalb des Panels liegt.
In `Modal.tsx` (analog in `ConfirmDialog.tsx`):

```tsx
useEffect(() => {
  if (!isOpen) return;
  previouslyFocusedRef.current = document.activeElement;

  // Anfangsfokus: erstes fokussierbares Element im Panel, sonst das Panel selbst.
  const panel = panelRef.current;
  if (panel && !panel.contains(document.activeElement)) {
    const first = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).find((el) => el.offsetParent !== null);
    if (first) {
      first.focus();
    } else {
      panel.tabIndex = -1;
      panel.focus();
    }
  }

  return () => { /* Fokusrückgabe wie bisher */ };
}, [isOpen]);
```

Aufrufer, die einen abweichenden Anfangsfokus wollen (`WorkTimeChangeModal` → Stichtag),
setzen ihn danach in ihrem eigenen Effekt — die Reihenfolge stimmt bereits, weil
Kind-Effekte (`Modal`) vor Eltern-Effekten (`WorkTimeChangeModal`) laufen.

---

### CR-03: Tagesstunden im Tagesplan werden weder im Frontend noch im Backend geprüft

**Dateien:** `desktop/src/components/users/WorkScheduleEditor.tsx:133-145`,
`desktop/src/components/worktime/WorkTimeChangeModal.tsx:244-285` (Validierung),
Gegenstelle: `server/src/routes/workPeriods.ts:46-52`, `server/src/services/workPeriodChangeService.ts:200-233`

**Problem:** Das Tagesfeld ist ein rohes `<input type="number" min="0" max="24">`. `min`/`max`
sind bei einer per Tastatur eingegebenen Zahl reine Hinweise — sie verhindern nichts, solange
kein `form.checkValidity()` läuft (und der Dialog ruft es nicht auf, er validiert von Hand in
`validateForm()`). Der Änderungshandler übernimmt jeden Wert:

```tsx
onChange={(e) => handleDayChange(day, parseFloat(e.target.value) || 0)}
```

`parseFloat('-5')` → `-5`, `parseFloat('88')` → `88`. `validateForm()` in
`WorkTimeChangeModal.tsx:244-285` prüft ausschließlich `validFrom`, `weeklyHours` und
`reason` — der Tagesplan wird nicht angefasst. Die Summenwarnung
(`WorkScheduleEditor.tsx:166-170`) ist ausdrücklich nicht blockierend.

Serverseitig gibt es ebenfalls keine Bereichsprüfung: `isWorkSchedule()`
(`workPeriods.ts:46-52`) prüft nur „sieben Schlüssel, jeweils eine endliche Zahl";
`validateInput()` in `workPeriodChangeService.ts:206` prüft nur `weeklyHours` gegen 0–60.
Ein Tagesplan `{ monday: -40, … }` oder `{ monday: 880, … }` wird also gespeichert.

Damit landen negative oder absurd hohe Tagessollstunden in `user_work_periods` und gehen
direkt in die Sollstundenberechnung ein (`timeUtils.ts:285` im Client, das Server-Pendant
identisch). Das ist ein Tippfehler weit — „88" statt „8" — und produziert eine
geschäftskritisch falsche Überstundenbilanz, die rückwirkend über den Rebuild-Zeitraum
gebucht wird. `.claude/CLAUDE.md` fordert Input Validation ausdrücklich **auf beiden Seiten**.

**Fix (Frontend, `WorkScheduleEditor.tsx`):**

```tsx
const clampDayHours = (raw: string): number => {
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(24, Math.max(0, parsed));
};

const handleDayChange = (day: keyof WorkSchedule, hours: number) => { /* unverändert */ };
// …
onChange={(e) => handleDayChange(day, clampDayHours(e.target.value))}
```

Zusätzlich in `WorkTimeChangeModal.validateForm()` einen blockierenden Feldfehler ergänzen,
wenn `workSchedule` einen Tag außerhalb 0–24 trägt, und in
`server/src/routes/workPeriods.ts:46-52` die Bereichsprüfung in `isWorkSchedule()` nachziehen
(`record[key] >= 0 && record[key] <= 24`).

---

### CR-04: „eingetragen am" im Kontoauszug zeigt das UTC-Datum, nicht das lokale

**Datei:** `desktop/src/components/worktime/OvertimeTransactions.tsx:246-249`

**Problem:**

```tsx
{transaction.createdAt &&
  ` · eingetragen am ${new Date(
    transaction.createdAt.slice(0, 10) + 'T12:00:00'
  ).toLocaleDateString('de-DE')}`}
```

`createdAt` kommt aus `overtime_transactions.createdAt`, Spaltendefault
`datetime('now')` (`server/src/database/migrations/011_add_model_change_transaction_type.ts:62`,
`server/src/database/schema.ts:529`). SQLite liefert dort **immer UTC** im Format
`YYYY-MM-DD HH:MM:SS`, unabhängig von `TZ=Europe/Berlin` im Prozess. `slice(0, 10)` schneidet
damit den **UTC-Tag** heraus und die Zeile behandelt ihn anschließend als Ortstag.

Ein Stundenwechsel, den ein Admin am 22.08. um 01:30 Uhr Ortszeit einträgt, wird als
`2026-08-21 23:30:00` gespeichert und im Kontoauszug als „eingetragen am 21.08.2026"
angezeigt — ein Tag zu früh. Betroffen ist täglich das Zeitfenster 00:00–02:00 (Sommerzeit)
bzw. 00:00–01:00 (Winterzeit).

Das ist derselbe Fehlerklasse, die `.claude/CLAUDE.md` unter „`toISOString().split('T')[0]`
→ Timezone bugs!" verbietet — nur über `slice(0, 10)` statt `split('T')`. Die Zeile ist
Bestandteil der Nachvollziehbarkeit einer Personaldatenänderung (REQ-29,
`12-UI-SPEC.md`: „Periode ab {TT.MM.JJJJ} · eingetragen am {TT.MM.JJJJ} von {Admin}"); ein
falsches Datum in einem Prüfpfad ist kein Schönheitsfehler.

**Fix:** Den Zeitstempel als das behandeln, was er ist — ein UTC-Moment — und in Ortszeit
formatieren, statt den Datumsteil abzuschneiden:

```tsx
function formatCreatedAtDe(createdAt: string): string {
  // SQLite `datetime('now')` liefert UTC ohne Zonenkennzeichen: 'YYYY-MM-DD HH:MM:SS'.
  const utc = new Date(createdAt.replace(' ', 'T') + 'Z');
  return Number.isNaN(utc.getTime())
    ? ''
    : utc.toLocaleDateString('de-DE');
}
```

Sauberer wäre, dass der Server `createdAt` bereits als ISO-Zeichenkette mit Zonenangabe
liefert; solange er das nicht tut, muss der Client die Zone ergänzen.

---

### CR-05: Fehlgeschlagene Feiertagsabfrage bleibt unbemerkt — Abwesenheitsvorschau rechnet falsch und blockiert

**Datei:** `desktop/src/components/absences/AbsenceRequestForm.tsx:69-104`, `:136-139`
**Ursache:** `desktop/src/hooks/useHolidays.ts:57-61` (nicht im Prüfumfang, aber der Auslöser)

**Problem:** Die Vorschau ist bewusst so gebaut, dass sie „keine Zahl behauptet, solange
Perioden/Feiertage nicht sicher geladen sind" (Kommentar Zeile 100). Der Schutz greift aber
nicht, weil `useMultiYearHolidays()` einen API-Fehler nicht als Fehler meldet:

```ts
const response = await apiClient.get(`/holidays?year=${year}`);
const yearHolidays = (response.data || []) as Array<{ … }>;
allHolidays.push(...yearHolidays);
```

`apiClient.request()` **wirft nicht** bei einem Serverfehler, sondern gibt
`{ success: false, error, data: undefined }` zurück (`src/api/client.ts:190-193`). Der Hook
prüft `response.success` nicht, liefert also stumm `[]`, und `holidaysError` in
`AbsenceRequestForm.tsx:72` wird niemals `true`. `previewUnavailable` ist damit ein
Scheinschutz.

Folge: `holidayDateSet` ist leer, `calculateAbsenceHoursWithWorkSchedule()` und
`countWorkingDaysForUser()` (`timeUtils.ts:272`, `:331`) zählen jeden Feiertag als vollen
Arbeitstag. Die Anzeige „Erforderlich: n Tage" ist zu hoch, und — schwerwiegender — die
Prüfung in Zeile 136 blockiert dann einen zulässigen Antrag:

```ts
if (type === 'vacation' && requiredDays !== null && requiredDays > vacationDays) {
  setEndDateError(`Du hast nur noch ${vacationDays} Urlaubstage verfügbar`);
```

Ein Urlaub über die Weihnachtsfeiertage kann so mit einer sachlich falschen Begründung
abgelehnt werden, ohne dass irgendetwas auf den Ladefehler hinweist.

**Fix (in `useHolidays.ts`, Wirkung in der geprüften Datei):**

```ts
for (const year of years) {
  const response = await apiClient.get<Array<{ id: number; date: string; name: string; federal: number }>>(
    `/holidays?year=${year}`
  );
  if (!response.success) {
    throw new Error(response.error || `Feiertage ${year} konnten nicht geladen werden`);
  }
  allHolidays.push(...(response.data || []));
}
```

Erst dann trägt `holidaysError` und damit `previewUnavailable` in `AbsenceRequestForm.tsx:78`
die Information, die der Kommentar dort bereits voraussetzt.

---

## Warnings

### WR-01: Sollstunden „bisher" und „neu" werden mit Vorzeichen ausgegeben — Vertragsbruch und irreführend

**Datei:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:605`, `:611`, `:617`

**Problem:** `12-UI-SPEC.md`, Textbuch Vorschaupanel: „Sollstunden im Zeitraum · bisher
{H:MMh} · neu {H:MMh} · Differenz {±H:MMh}". Nur die **Differenz** trägt ein Vorzeichen.
Der Code nutzt für alle drei Werte `formatSignedHours()`. Aus „bisher 160:00h" wird
„+160:00h", aus einem Sollwert von 0 wird „± 0:00h". Sollstunden sind absolute Größen; ein
vorangestelltes Plus suggeriert eine Gutschrift und stellt die drei Zellen visuell gleich,
obwohl nur eine eine Bilanzgröße ist.

**Fix:**

```tsx
{/* bisher */}<p className="…">{formatHours(preview.targetHoursBefore)}</p>
{/* neu    */}<p className="…">{formatHours(preview.targetHoursAfter)}</p>
{/* Differenz bleibt */}<p className="…">{formatSignedHours(preview.targetHoursDelta)}</p>
```

### WR-02: Saldoänderung 0 wird grün mit Aufwärtspfeil dargestellt

**Datei:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:629-642`

**Problem:** `preview.balanceDelta >= 0` steuert sowohl Icon als auch Farbe. Bei
`balanceDelta === 0` erscheint `TrendingUp` in Grün mit dem Text „Änderung des
Überstundensaldos: ± 0:00h". `12-UI-SPEC.md` legt für genau diesen Randfall fest:
„die Saldozeile zeigt „± 0:00h" in **gray-600/400**". Grün + Aufwärtspfeil ist im
Farbvertrag der Phase mit „Gutschrift" belegt — hier gibt es keine.

**Fix:** Dreiweg-Unterscheidung, neutral bei 0:

```tsx
const deltaTone =
  preview.balanceDelta > 0 ? 'positive' : preview.balanceDelta < 0 ? 'negative' : 'neutral';
// neutral: kein Trend-Icon, Klasse 'text-gray-600 dark:text-gray-400'
```

### WR-03: Wettlauf zweier Vorschauanfragen kann eine veraltete Vorschau anzeigen

**Datei:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:172-208`

**Problem:** `requestPreview()` startet `previewM.mutate(...)` mit einem Callback, das
`setPreview(data)` bedingungslos ausführt. Es gibt keine Sequenznummer und kein Verwerfen
älterer Antworten. Ändert der Admin ein Feld, wartet 400 ms (Anfrage A geht raus), ändert
dann erneut (Anfrage B geht 400 ms später raus) und ist A langsamer als
`Latenz(B) + 400 ms`, überschreibt A's `onSuccess` die frischere Antwort B.

Angezeigt werden dann Zahlen zu den *alten* Eingaben, während das Formular die neuen zeigt —
genau die Abweichung zwischen angezeigter und tatsächlicher Größe, die REQ-27 ausschließen
soll. Gespeichert wird nichts Falsches (das `previewToken` bindet die alten Werte, der Server
antwortet mit `PREVIEW_STALE`), der Admin läuft aber in Zustand 14 hinein und hat vorher eine
falsche Zahl gelesen.

**Fix:** Anfragen laufend nummerieren und späte Antworten verwerfen:

```tsx
const previewSeqRef = useRef(0);

function requestPreview(vFrom: string, wHours: number, schedule: WorkSchedule | null) {
  const seq = ++previewSeqRef.current;
  setPreviewErrorMessage(null);
  previewM.mutate({ userId: user.id, validFrom: vFrom, weeklyHours: wHours, workSchedule: schedule }, {
    onSuccess: (data) => {
      if (seq !== previewSeqRef.current || !data) return; // veraltete Antwort verwerfen
      setPreview(data);
      setFormError('');
    },
    onError: (error) => {
      if (seq !== previewSeqRef.current) return;
      /* … wie bisher … */
    },
  });
}
```

### WR-04: Wochenstunden außerhalb 0–60 führen in eine stumme Sackgasse

**Datei:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:81-87`, `:384`, `:416`, `:552-556`

**Problem:** `parseWeeklyHoursValue()` liefert für Werte außerhalb 0–60 `null`. Dann gilt:
keine Vorschau (`:200`), Panel in `placeholder` (`:384`), Primärbutton deaktiviert (`:416`).
Der Platzhaltertext lautet aber „Die Vorschau erscheint, sobald Stichtag und **neue
Wochenstunden gesetzt** sind" — beides *ist* gesetzt. Die vom Vertrag vorgesehene Meldung
„Wochenstunden müssen zwischen 0 und 60 liegen" (Zustand 9) erreicht den Anwender nie: Sie
entsteht nur in `validateForm()`, das nur `handleSubmit` aufruft, und ein Submit ist nicht
auslösbar, weil der Standard-Submit-Button `disabled` ist (auch die implizite Absendung per
Enter unterbleibt dann laut HTML-Standard).

Der Admin tippt „65", sieht einen grauen Kasten mit einem falschen Satz und einen toten
Button — ohne jeden Hinweis, warum.

**Fix:** Beim Ändern sofort validieren, statt erst beim Absenden:

```tsx
function handleWeeklyHoursChange(e: ChangeEvent<HTMLInputElement>) {
  const raw = e.target.value;
  setWeeklyHours(raw);
  setPreview(null); setPreviewErrorMessage(null); setStaleFailureCount(0); setFormError('');
  const outOfRange = raw !== '' && (Number.isNaN(Number(raw)) || Number(raw) < 0 || Number(raw) > 60);
  setFieldErrors((prev) => ({
    ...prev,
    weeklyHours: outOfRange ? 'Wochenstunden müssen zwischen 0 und 60 liegen' : undefined,
  }));
}
```

### WR-05: Fehlendes Eintrittsdatum erzeugt „Invalid Date" und hebelt die Stichtagsprüfung aus

**Datei:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:249-250`, `:434`

**Problem:** `User.hireDate` ist im Typ als `string` deklariert
(`src/types/index.ts:28`), der Bestand behandelt es aber als möglicherweise leer:
`EditUserModal.tsx:45` und `:73` schreiben `user.hireDate || getTodayDate()`. Ist
`hireDate` leer/`null`, dann

- rendert `formatGermanDate(user.hireDate)` (Zeile 434) den Text
  `Eintrittsdatum: Invalid Date`, weil `new Date('T12:00:00')` bzw.
  `new Date('nullT12:00:00')` ungültig ist;
- ist `validFrom < user.hireDate` (Zeile 249) für jeden Wert `false` (Vergleich mit `''`
  bzw. `undefined`) — die Prüfung „Stichtag darf nicht vor dem Eintrittsdatum liegen"
  entfällt stillschweigend. Der Server fängt es ab, der Anwender bekommt aber statt eines
  Feldfehlers einen späten Serverfehler.

**Fix:**

```tsx
const hireDate = user.hireDate || null;
// Anzeige
Eintrittsdatum: {hireDate ? formatGermanDate(hireDate) : 'nicht hinterlegt'}
// Validierung
} else if (hireDate && validFrom < hireDate) {
  errors.validFrom = `Der Stichtag darf nicht vor dem Eintrittsdatum (${formatGermanDate(hireDate)}) liegen.`;
}
```

### WR-06: Die Periodenauflösung ist dreimal implementiert — genau der Dual-Calculation-Fehler, den der Code selbst benennt

**Dateien:** `desktop/src/utils/timeUtils.ts:217-224`,
`desktop/src/components/worktime/WorkTimeChangeModal.tsx:120-128`,
`desktop/src/components/worktime/WorkTimePeriodList.tsx:128`

**Problem:** `timeUtils.ts:212-216` erklärt sich selbst zur „**DIE EINE** Auflösungsstelle im
Desktop, zeichengleich zu `resolveWorkPeriodIn()` … Jede Abweichung von dieser Bedingung ist
ein Dual-Calculation-Fehler". Zwei der drei neuen Dateien bauen die Bedingung trotzdem
erneut nach:

```tsx
// WorkTimeChangeModal.tsx:124-126
periods.find((p) => p.validFrom <= todayStr && (p.validTo === null || p.validTo > todayStr))
// WorkTimePeriodList.tsx:128
const isCurrent = period.validFrom <= today && (period.validTo === null || period.validTo > today);
```

Heute sind alle drei zeichengleich. Ändert sich die Intervallauslegung (z. B. `validTo`
inklusiv), muss sie an drei Stellen nachgezogen werden — und die Kommentare in `timeUtils.ts`
werden dann zur Falle, weil sie behaupten, es gäbe nur eine Stelle.
`WorkScheduleDisplay.tsx:90` macht es richtig vor.

**Fix:** Beide Vorkommen auf `resolveWorkTimePeriodIn(periods, date)` aus `../../utils`
umstellen (in `WorkTimePeriodList` einmalig `resolveWorkTimePeriodIn(sortedPeriods, today)?.id`
bestimmen und je Zeile gegen `period.id` vergleichen).

### WR-07: `any` im Renderpfad des Kontoauszugs

**Datei:** `desktop/src/components/worktime/OvertimeTransactions.tsx:214`

**Problem:** `data.transactions.map((transaction: any, index: number) => …)` verwirft die
Typinformation, die `useOvertimeTransactions()` in `useWorkTimeAccounts.ts:258-267`
vollständig deklariert — inklusive der in Phase 12 neu ergänzten Felder `createdAt` und
`adminName`. `.claude/CLAUDE.md` verbietet `any` ausdrücklich. Konkret ungeschützt bleiben
dadurch `transaction.createdAt.slice(0, 10)` (Zeile 248, siehe CR-04) und
`transaction.type` gegen die Union der elf zulässigen Typen.

`12-UI-SPEC.md` führt das `any` zwar als „beobachtete Altlast", die Zeile liegt aber
unmittelbar neben dem in dieser Phase eingefügten `model_change`-Block und trägt das
Sicherheitsnetz für genau diesen neuen Code.

**Fix:** Den Elementtyp aus dem Hook exportieren und hier verwenden:

```ts
// useWorkTimeAccounts.ts
export interface OvertimeTransactionRow { date: string; type: '…' | 'model_change'; /* … */ }
// OvertimeTransactions.tsx
{data.transactions.map((transaction, index) => ( /* … */ ))}
```

`transaction` ist dann bereits korrekt inferiert; die explizite Annotation entfällt ersatzlos.

### WR-08: `alert()` im `EditUserModal` — in Tauri wirkungslos, Validierung schlägt stumm fehl

**Datei:** `desktop/src/components/users/EditUserModal.tsx:119-124`

**Problem:**

```tsx
if (endDate && hireDate) {
  if (endDate < hireDate) {
    alert('Austrittsdatum muss nach dem Eintrittsdatum liegen');
    isValid = false;
  }
}
```

Der Projektbestand hält ausdrücklich fest, dass Browserdialoge in Tauri nicht funktionieren —
`ConfirmDialog.tsx:1-5`: „Replaces `window.confirm()` which doesn't work in Tauri". Für
`window.alert()` gilt dasselbe. `isValid = false` bricht das Absenden ab, der Anwender sieht
aber keinerlei Rückmeldung: Der Klick auf „Änderungen speichern" tut scheinbar nichts.

**Fix:** In die vorhandene Fehlerzustandsführung einreihen, wie bei `emailError`:

```tsx
const [endDateError, setEndDateError] = useState('');
// in validateForm(): setEndDateError(''); … setEndDateError('Austrittsdatum muss nach dem Eintrittsdatum liegen');
<Input name="endDate" … error={endDateError} />
```

### WR-09: Steuerfluss hängt an deutschen Servertexten

**Dateien:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:184`, `:328`

**Problem:** Zwei Verzweigungen werten Fehlertexte aus:

```tsx
if (message.includes('existiert bereits eine Periode')) { /* Feldfehler am Stichtag */ }
if (message.startsWith('PREVIEW_STALE')) { /* Zustand 14 */ }
```

Der erste Text stammt aus `server/src/services/workPeriodChangeService.ts:263` und ist eine
für Menschen formulierte, jederzeit umformulierbare Meldung. Wird dort ein Wort geändert,
wandert der Fehler wortlos in den generischen Zweig — der Anwender bekommt dann
„Die Vorschau konnte nicht berechnet werden" statt des Feldfehlers am Stichtag, und Zustand 10
ist endgültig unerreichbar. Der zweite Fall ist besser (`PREVIEW_STALE:` ist ein Präfix mit
Vertragscharakter, `12-05`), bleibt aber eine Zeichenkettenprüfung ohne Typvertrag.

**Fix:** Serverseitig einen maschinenlesbaren Code mitschicken (`{ success: false, code:
'PERIOD_EXISTS' | 'PREVIEW_STALE', error: '…' }`), `ApiResponse` um `code?: string` erweitern
und im Client gegen den Code prüfen. Solange das offen ist: die beiden Textmuster als
benannte Konstanten neben der Servermeldung dokumentieren.

### WR-10: Globaler Fehler-Toast leakt „PREVIEW_STALE:" an den Endanwender und dupliziert das Banner

**Dateien:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:326-349` (Konsument),
`desktop/src/api/client.ts:181-188` (Auslöser)

**Problem:** `apiClient.request()` zeigt für jede Antwort ≠ 2xx (außer 401 und 403 auf
`/users`) einen `toast.error(data.error)`. Der Wechsel-Dialog behandelt genau diese Fälle
bereits selbst mit den im Textbuch festgelegten Formulierungen. Der Admin sieht bei einem
abgelehnten Token daher gleichzeitig:

- das rote Banner „Die Vorschau ist nicht mehr aktuell. Sie wird gerade neu berechnet …"
  (Vertragstext) **und**
- einen roten Toast „PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell." mit dem
  Untertitel „Die Anfrage konnte nicht verarbeitet werden."

Ein interner Fehlercode in der Oberfläche einer Personalverwaltung ist kein Text aus dem
Textbuch, und die doppelte Meldung widerspricht Zustand 13/14, die je *ein* Banner vorsehen.

**Fix:** Die Toast-Unterdrückung im Client um die Endpunkte erweitern, die ihre Fehler selbst
darstellen — analog zur bestehenden `is403OnUsers`-Ausnahme:

```ts
const handlesOwnErrors = endpoint.startsWith('/work-periods');
const shouldShowToast = response.status !== 401 && !is403OnUsers && !handlesOwnErrors;
```

### WR-11: Zustand 10 ist nicht verdrahtet — `highlightPeriodId` hat keinen Aufrufer

**Dateien:** `desktop/src/components/worktime/WorkTimePeriodList.tsx:10-11`, `:130`,
`desktop/src/components/users/EditUserModal.tsx:349`

**Problem:** `WorkTimePeriodList` nimmt die Prop `highlightPeriodId` entgegen und wertet sie
aus (`ring-2 ring-red-400`). Der einzige Aufrufer im Projekt ist
`<WorkTimePeriodList userId={user.id} />` (`EditUserModal.tsx:349`) — ohne die Prop. Der
Wechsel-Dialog rendert die Liste gar nicht.

`12-UI-SPEC.md`, Zustand 10 verlangt: „Feldfehler am Stichtag. **Zusätzlich, sofern die
Periodenliste geladen ist:** die betroffene Zeile wird mit `ring-2 ring-red-400`
hervorgehoben." Umgesetzt ist nur der Feldfehler; der Hervorhebungspfad ist toter Code.

**Fix:** Entweder die Kollisionsperiode im `EditUserModal` durchreichen (der Dialog meldet
sie über einen neuen `onConflict?: (periodId: number) => void`-Rückruf, das Modal hält sie
und gibt sie als `highlightPeriodId` weiter), oder die Prop entfernen und den Zustand
ausdrücklich auf Phase 13 verschieben. Nicht implementiert stehen lassen ist beides nicht.

### WR-12: Sechs E2E-Tests greifen auf einen Selektor zu, den es nicht gibt

**Datei:** `desktop/tests/user-edit.spec.ts:39`, `:161`, `:197`, `:209`, `:236`, `:270`

**Problem:** Diese Zeilen suchen `button[aria-label="Bearbeiten"]`.
`UserManagementPage.tsx:459-465` rendert `<Button size="sm" variant="ghost">Bearbeiten</Button>`
— **ohne** `aria-label`. Alle sechs Tests laufen damit in den Locator-Timeout. Die Datei
weiß das sogar: Zeile 99–100 kommentiert für den einen reparierten Test „Selektor repariert:
kein aria-label auf diesem Button". Eine Testdatei, deren Mehrheit rot ist, gibt keine
Regressionssicherheit für den in dieser Phase geänderten Bearbeiten-Dialog.

`12-UI-SPEC.md` grenzt das ausdrücklich als „vorbestehenden Mangel … als eigener Defekt zu
führen" ab. Hiermit ist er geführt.

**Fix:** Entweder alle sechs Vorkommen auf `button:has-text("Bearbeiten")` umstellen (eine
Zeile je Test), oder — besser, weil es zugleich die Barrierefreiheit verbessert — den
Zeilenbuttons in `UserManagementPage.tsx` ein `aria-label` mit Nutzerbezug geben:

```tsx
<Button size="sm" variant="ghost"
  aria-label={`Bearbeiten: ${user.firstName} ${user.lastName}`}
  onClick={() => setEditingUserId(user.id)}>
  Bearbeiten
</Button>
```

### WR-13: `toISOString().split('T')[0]` im E2E-Test — verbotenes Muster, direkt neben der gegenteiligen Zusicherung

**Datei:** `desktop/tests/user-edit.spec.ts:240-243`

**Problem:**

```ts
const futureDate = new Date();
futureDate.setMonth(futureDate.getMonth() + 1);
const endDateString = futureDate.toISOString().split('T')[0];
```

`.claude/CLAUDE.md` verbietet dieses Muster ausdrücklich. Dieselbe Datei baut das Datum
80 Zeilen weiter oben korrekt auf und kommentiert es mit „Zeitzonensicher aufgebaut, kein
toISOString()-Split" (Zeile 111–114) — der zweite Fall ist beim Umschreiben übersehen worden.
In der Sommerzeit (UTC+2) liefert der Ausdruck zwischen 00:00 und 02:00 Ortszeit den Vortag.

Zweitens: `setMonth(getMonth() + 1)` läuft bei Monatsenden über — am 31. Januar ergibt es den
2./3. März. Für „Austrittsdatum in der Zukunft" unschädlich, aber es macht den Test vom
Ausführungsdatum abhängig.

**Fix:** Dasselbe Muster wie in Zeile 112–114 verwenden und den Tag auf 1 setzen:

```ts
const d = new Date();
const future = new Date(d.getFullYear(), d.getMonth() + 1, 1);
const endDateString = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-01`;
```

### WR-14: Die zentrale Zusicherung des umgeschriebenen Tests trifft auch auf „40 h" zu

**Datei:** `desktop/tests/user-edit.spec.ts:131`

**Problem:**

```ts
await expect(page.locator('table tr:has-text("0 h")')).toBeVisible({ timeout: 10000 });
```

`has-text` prüft auf **Teilzeichenketten**. Die Periodenzeile der Ausgangsperiode zeigt
„40 h" (`WorkTimePeriodList.tsx:153`) und enthält damit ebenfalls „0 h". Der Locator trifft
nach dem Speichern also mindestens zwei Zeilen: Playwright bricht dann im Strict Mode mit
„resolved to 2 elements" ab — oder, falls die alte Periode zuerst gerendert wird, wäre der
Test schon **vor** dem Stundenwechsel grün. In beiden Fällen prüft er nicht, was er zu
prüfen behauptet („der kritische 0-Stunden-Fall").

**Fix:** Auf die Zelle abstellen und exakt vergleichen:

```ts
await expect(
  page.locator('table td', { hasText: /^0 h$/ })
).toBeVisible({ timeout: 10000 });
```

### WR-15: `Modal` und `ConfirmDialog` tragen dieselbe Modal-Infrastruktur zweimal wörtlich

**Dateien:** `desktop/src/components/ui/Modal.tsx:17-18`, `:28-115` und
`desktop/src/components/ui/ConfirmDialog.tsx:27-28`, `:43-128`

**Problem:** `FOCUSABLE_SELECTOR`, die vier Refs, der Stack-Effekt, der ESC-Effekt, der
Fokusrückgabe-Effekt und `handlePanelKeyDown` sind in beiden Dateien Zeile für Zeile
identisch (rund 70 Zeilen). Das ist genau der Duplikationsfall, den `.claude/CLAUDE.md`
unter „Code duplizieren → DRY Principle" verbietet. Praktisch heißt es: Jeder Fix an der
Fokusfalle (CR-02) muss zweimal gemacht werden, und jedes Vergessen erzeugt zwei Dialogtypen
mit unterschiedlichem Tastaturverhalten.

**Fix:** Einen Hook neben den Stack legen, der beide Primitive bedient:

```ts
// desktop/src/components/ui/useModalLayer.ts
export function useModalLayer(isOpen: boolean, onClose: () => void) {
  const idRef = useRef(Symbol('modal-layer'));
  const panelRef = useRef<HTMLDivElement>(null);
  // Stack, ESC, Fokusrückgabe, Anfangsfokus, Tab-Ring — einmalig
  return { panelRef, handlePanelKeyDown };
}
```

`Modal` und `ConfirmDialog` behalten ihr eigenes Markup und rufen nur noch den Hook.

### WR-16: Labels der neuen Dialogfelder sind nicht mit ihren Eingaben verknüpft

**Dateien:** `desktop/src/components/ui/Input.tsx:17-22`, `desktop/src/components/ui/Textarea.tsx:17-22`
(Wirkung in `WorkTimeChangeModal.tsx:464-490`, `:511-520`)

**Problem:** Das `<label>` in beiden Primitiven trägt weder `htmlFor` noch umschließt es das
Eingabefeld, und das Eingabefeld hat weder `id` noch `aria-label`. Ein Screenreader liest
für die drei zentralen Felder des neuen Dialogs („Stichtag", „Neue Wochenstunden",
„Begründung") daher nur „Bearbeitungsfeld" ohne Namen. Ebenso fehlt die Verknüpfung der
Fehlermeldung: Die `<p role="alert">` (`Input.tsx:44`) wird zwar beim Erscheinen vorgelesen,
ist aber nicht über `aria-describedby` an das Feld gebunden, und `aria-invalid` fehlt — beim
späteren Ansteuern des Feldes erfährt der Nutzer den Fehler nicht mehr.

`12-UI-SPEC.md` stellt unter Barrierefreiheit ausdrücklich auf `Input.tsx:44` als
Fehlerkanal ab; der Kanal ist ohne Verknüpfung nur halb vorhanden. Der Vertrag verbietet
allerdings einen Umbau von `Input.tsx` innerhalb dieser Phase nicht — er verbietet nur einen
zusätzlichen `readOnly`-Zweig.

**Fix (additiv, keine Signaturänderung nach außen):**

```tsx
const generatedId = useId();
const inputId = props.id ?? generatedId;
const errorId = `${inputId}-error`;
const helperId = `${inputId}-helper`;
// <label htmlFor={inputId}> … <input id={inputId} aria-invalid={!!error}
//   aria-describedby={error ? errorId : helperText ? helperId : undefined} … />
```

### WR-17: Erfolgsbanner-Timer ohne Aufräumen, zweiter Wechsel löscht das Banner zu früh

**Datei:** `desktop/src/components/users/EditUserModal.tsx:421-434`

**Problem:**

```tsx
setSuccessBanner({ … });
window.setTimeout(() => setSuccessBanner(null), 8000);
```

Der Timer wird nirgends festgehalten und nirgends abgeräumt. Zwei Folgen:

1. Speichert der Admin binnen 8 Sekunden einen zweiten Stundenwechsel, löscht der Timer des
   *ersten* das Banner des *zweiten* nach der Restlaufzeit — im Extremfall nach 200 ms. Der
   Vertrag (Zustand 15) sagt „8 s".
2. Schließt der Admin das `EditUserModal` innerhalb der 8 Sekunden, feuert der Timer auf eine
   abgemeldete Komponente. Unter React 18+ folgenlos, aber ein nicht aufgeräumter Timer
   bleibt ein Leck.

**Fix:** Den Timer in einer `useRef` halten, vor dem Neusetzen löschen und beim Abmelden
aufräumen:

```tsx
const bannerTimerRef = useRef<number | null>(null);
useEffect(() => () => { if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current); }, []);
// im onSaved:
if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
bannerTimerRef.current = window.setTimeout(() => setSuccessBanner(null), 8000);
```

### WR-18: Selbstlösch-Schutz gibt dem Anwender keine Rückmeldung, offenes TODO im Guard-Pfad

**Datei:** `desktop/src/pages/UserManagementPage.tsx:130-138`

**Problem:**

```tsx
const handleDeleteClick = (userId: number, userName: string) => {
  if (userId === currentUser.id) {
    console.warn('⚠️ Cannot delete yourself!');
    // TODO: Show error dialog instead of alert
    return;
  }
```

Der Zweig schreibt in die Konsole und kehrt zurück — sichtbar passiert nichts. Der Kommentar
benennt den Mangel selbst und bezieht sich auf ein `alert()`, das gar nicht mehr existiert.
Auch die beiden `console.error` in Zeile 148–149 tragen Debug-Emojis („💥 Delete mutation
failed with error:") statt einer Anwendermeldung; der Fehlerfall des Löschens bleibt in der
Oberfläche unsichtbar.

Der Zweig ist heute schwer erreichbar (der Löschbutton wird für den eigenen Nutzer gar nicht
gerendert, Zeile 473), aber `handleDeleteClick` ist eine öffentliche Funktion der Seite und
der Guard existiert genau für den Fall, dass er es doch wird.

**Fix:** `toast.error('Sie können Ihr eigenes Konto nicht löschen.')` statt `console.warn`,
und im `catch` von `handleDeleteConfirm` ebenfalls einen Toast statt der beiden
`console.error`-Zeilen. `sonner` ist im Projekt bereits montiert.

### WR-19: „Heute" wird einmalig beim Montieren berechnet

**Dateien:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:118`,
`desktop/src/components/worktime/WorkTimePeriodList.tsx:61`

**Problem:** `useMemo(() => formatDateLocal(new Date()), [])` friert das Tagesdatum für die
gesamte Lebensdauer der Komponente ein. Die Desktop-App ist eine Tauri-Anwendung, die
üblicherweise über Nacht offen bleibt. Nach Mitternacht bestimmen beide Komponenten die
„aktuell gültige" Periode und die Badges „Aktuell"/„Geplant" gegen den Vortag. Eine Periode,
die heute beginnt, wird bis zum nächsten Neustart als „Geplant" geführt, und der
Wechsel-Dialog belegt die Felder mit der Vorperiode vor.

**Fix:** In beiden Fällen `getTodayDate()` aus `../../utils` verwenden und ohne `useMemo`
bei jedem Render neu bestimmen — die Funktion ist billig, und die Abhängigkeitsliste `[]` ist
hier gerade das Problem, nicht die Lösung.

### WR-20: `reasonError` in `AbsenceRequestForm` ist ein toter Zustand, Pflichtgrund wird nicht geprüft

**Datei:** `desktop/src/components/absences/AbsenceRequestForm.tsx:49`, `:111`, `:190`, `:327`

**Problem:** `reasonError` wird deklariert, zweimal auf `''` zurückgesetzt und an das
`Textarea` durchgereicht — aber an keiner Stelle jemals auf einen Text gesetzt. Zugleich
markiert das Feld sich bei `type === 'sick'` als `required` (Zeile 334), während
`validateForm()` den Grund überhaupt nicht prüft. Der Kommentar in Zeile 149–151 behauptet,
der Grund sei „optional but recommended … just a hint, not blocking" — das widerspricht dem
`required`-Attribut im selben Formular.

Damit hängt die Durchsetzung allein an der Browser-Standardvalidierung, deren Meldung nicht
lokalisiert und nicht an das Fehlerdesign der App angeglichen ist.

**Fix:** Entweder `required` entfernen (wenn der Grund wirklich optional ist) oder in
`validateForm()` nachziehen:

```ts
if (type === 'sick' && !reason.trim()) {
  setReasonError('Grund ist bei einer Krankmeldung erforderlich');
  isValid = false;
}
```

### WR-21: Feiertagsfenster von ±2 Jahren begrenzt die Abwesenheitsvorschau stillschweigend

**Datei:** `desktop/src/components/absences/AbsenceRequestForm.tsx:69-79`
(Quelle: `desktop/src/hooks/useHolidays.ts:41-53`)

**Problem:** `useMultiYearHolidays()` lädt ausschließlich `currentYear − 2 … currentYear + 2`.
Ein Antrag außerhalb dieses Fensters — bei Langzeitplanung oder Nacherfassung durchaus real —
findet keinen einzigen Feiertag im `holidayDateSet`, und die Vorschau zählt sie als
Arbeitstage. Ein Fehlerzustand entsteht nicht: Die Zahl wird ohne Vorbehalt angezeigt und
gemäß Zeile 136 auch zur Blockade herangezogen (vgl. CR-05).

**Fix:** Die benötigten Jahre aus `startDate`/`endDate` ableiten statt aus „heute", oder in
`AbsenceRequestForm` die Vorschau verweigern, wenn der gewählte Zeitraum außerhalb des
geladenen Fensters liegt:

```ts
const coveredYears = new Set((holidays || []).map((h) => h.date.slice(0, 4)));
const rangeCovered = coveredYears.has(startDate.slice(0, 4)) && coveredYears.has(endDate.slice(0, 4));
// rangeCovered === false → previewUnavailable
```

---

## Info

### IN-01: `formatDateLocal` ist dreimal vorhanden, obwohl `getTodayDate()` exportiert ist

**Dateien:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:59-61`,
`desktop/src/components/worktime/WorkTimePeriodList.tsx:30-32`, `desktop/src/utils/timeUtils.ts:75-81`

Beide lokalen Kopien sind zeichengleich zu `getTodayDate()`, das über `src/utils/index.ts:7`
bereits exportiert und von `EditUserModal`/`AbsenceRequestForm` genutzt wird.
**Fix:** Lokale Kopien löschen, `getTodayDate()` importieren.

### IN-02: Das deutsche Datumsformat ist sechsmal einzeln nachgebaut

**Dateien:** `WorkTimePeriodList.tsx:35`, `WorkTimeChangeModal.tsx:65`, `EditUserModal.tsx:273`,
`WorkScheduleDisplay.tsx:94`, `OvertimeTransactions.tsx:220`, `:245`

Überall steht `new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')`. Ebenso dreimal
`hours.toLocaleString('de-DE', { maximumFractionDigits: 2 })`
(`WorkTimePeriodList.tsx:39`, `WorkTimeChangeModal.tsx:77`, `EditUserModal.tsx:274`).
**Fix:** Als `formatIsoDateDE()` und `formatWeeklyHoursDE()` nach `src/utils/timeUtils.ts`
ziehen und von dort importieren.

### IN-03: `bg-opacity-10` ohne Hintergrundfarbe ist wirkungslos

**Datei:** `desktop/src/components/ui/ConfirmDialog.tsx:154`

`className={`p-2 rounded-lg bg-opacity-10 ${iconColors[variant]}`}` — `iconColors` liefert
nur `text-…`-Klassen. `bg-opacity-10` verändert ohne begleitende `bg-…`-Klasse nichts; der
gedachte eingefärbte Iconkasten existiert nicht.
**Fix:** Entweder eine Flächenfarbe je Variante ergänzen (`bg-red-100 dark:bg-red-900/20` …)
oder `bg-opacity-10` streichen.

### IN-04: `ConfirmDialog` schließt nicht per Klick auf den Hintergrund

**Datei:** `desktop/src/components/ui/ConfirmDialog.tsx:138-141`

`Modal` schließt bei Klick auf das Backdrop (`Modal.tsx:122`), `ConfirmDialog` nicht. Für die
Rückwirkungs-Bestätigung ist das vertretbar (destruktiver Schritt), die Inkonsistenz zwischen
zwei Dialogtypen derselben Anwendung sollte aber bewusst dokumentiert statt beiläufig sein.

### IN-05: Zeichenzähler und Validierung messen unterschiedlich

**Datei:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:521-525` vs. `:263-267`

Der Zähler prüft `reason.length < 10`, die Validierung `reason.trim().length < 10`. Zehn
Leerzeichen blenden den Hinweis „Noch {n} Zeichen" aus, scheitern aber beim Absenden.
**Fix:** Beide auf `reason.trim().length` umstellen.

### IN-06: `workSchedule`-State im `EditUserModal` ist nur noch Anzeige, `setWorkSchedule` toter Pfad

**Datei:** `desktop/src/components/users/EditUserModal.tsx:40`, `:320-325`

Der `WorkScheduleEditor` läuft mit `readOnly`, kann also `onChange` gar nicht auslösen; der
Absendepfad nimmt den Wert ohnehin aus `user` (Zeile 146). `setWorkSchedule` wird damit nur
noch von den beiden Sync-Effekten bedient. Das ist konsistent mit D1, aber der `onChange`-
Durchgriff suggeriert Bedienbarkeit.
**Fix:** `onChange={() => {}}` mit Kommentar oder die Prop in `WorkScheduleEditor` bei
`readOnly` optional machen.

### IN-07: Tagesplanspalte bleibt leer, wenn alle Tage 0 h tragen

**Datei:** `desktop/src/components/worktime/WorkTimePeriodList.tsx:42-51`

`formatWorkSchedule()` filtert auf `schedule[day] > 0` und `join(' · ')` liefert bei leerem
Ergebnis `''`. Eine 0-Stunden-Periode („Aushilfe") mit ausdrücklichem Nullplan zeigt eine
leere Zelle statt einer Aussage — und genau dieser Fall ist der im E2E-Test geprüfte.
**Fix:** `return parts.length === 0 ? 'Keine Arbeitstage' : parts.join(' · ');`

### IN-08: Leere Serverantwort auf die Vorschau bleibt folgenlos stehen

**Datei:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx:177-179`

```tsx
onSuccess: (data) => { if (!data) return; … }
```

Antwortet der Server mit `{ success: true, data: undefined }`, passiert nichts: kein
`preview`, keine Fehlermeldung, das Panel bleibt im Platzhalter. Für den Anwender sieht das
aus wie „nichts eingegeben".
**Fix:** Im `!data`-Zweig `setPreviewErrorMessage(...)` mit dem Vertragstext setzen, damit
Zustand 5 samt Wiederholungsbutton erscheint.

---

_Geprüft: 2026-08-22_
_Prüfer: Claude (gsd-code-reviewer)_
_Tiefe: standard_
