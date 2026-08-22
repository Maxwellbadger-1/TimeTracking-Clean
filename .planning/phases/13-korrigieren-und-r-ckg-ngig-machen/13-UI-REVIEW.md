---
phase: 13-korrigieren-und-r-ckg-ngig-machen
reviewed: 2026-08-23
baseline: 13-UI-SPEC.md (Revision 2, vom Anwender abgenommen)
screenshots: nicht aufgenommen (desktop/node_modules leer, keine ladbare Playwright-CLI — Nachinstallation nicht autorisiert)
method: Code-Audit gegen den Designvertrag, Zustand für Zustand
status: advisory
score: 15/24
---

# Phase 13 — UI-Review

**Geprüft:** 23.08.2026
**Vertrag:** `13-UI-SPEC.md` (1003 Zeilen, Revision 2, abgenommen)
**Screenshots:** keine — reiner Code-Audit. Alle Befunde tragen Datei- und Zeilenbelege.
**Bereits behandelt und hier nicht wiederholt:** die 2 Critical und 13 Warnungen aus `13-REVIEW.md`
(alle behoben), die vier offenen Info-Punkte IN-01…IN-04 daraus, sowie sämtliche Befunde aus
`12-UI-REVIEW.md` / `12-UI-REVIEW-FIX.md`. Stichprobe ergab: keiner der Phase-12-Punkte ist in
Phase 13 neu gebrochen — `overflow-y-auto` im `ConfirmDialog` steht (`ConfirmDialog.tsx:127`), das
Entprell-Flackern ist mit `min-h-56` abgefangen (`WorkTimePeriodEditModal.tsx:662`), die
Zeilenmarkierung läuft weiterhin über Zellflächen statt `ring` (`WorkTimePeriodList.tsx:200-203`).

---

## Bewertung je Säule

| Säule | Punkte | Kernbefund |
|-------|--------|------------|
| 1. Texte | **2**/4 | Textbuch fast wortgetreu umgesetzt — aber der Zukunftsfall behauptet „Es wird nichts rückwirkend geändert", während der Server die Vergangenheit neu rechnet; zwei vertraglich zugesagte Fehlermeldungen sind unerreichbar |
| 2. Visuelles | **2**/4 | Der Anker der Löschbestätigung ist kein Zahlenwert, sondern ein ganzer Absatz in 18 px fett; das Tooltip „Nicht löschbar" wird vom `overflow-x-auto`-Container beschnitten — genau die Falle, die dieselbe Datei aus Phase 12 dokumentiert |
| 3. Farbe | **3**/4 | Palette exakt eingehalten, keine neue Farbe, Storno grau, Teal-Verwandtschaft gewahrt, Dark Mode durchgängig — zwei kleinere Überdehnungen |
| 4. Typografie | **3**/4 | Nur `text-xs`/`sm`/`lg` und drei Gewichte im Neucode, keine willkürlichen Werte — `font-bold` überschreitet an einer Stelle die vertragliche Begrenzung „ausschließlich vorzeichenbehaftete Stundenwerte" |
| 5. Abstände | **3**/4 | Alles auf der Skala, keine arbiträren Werte — die einzige neu deklarierte Ausnahme (32 × 32 px Trefferfläche unter 640 px) greift wegen Klassenpräzedenz nicht |
| 6. Bedienerlebnis | **2**/4 | 28 Zustände fast vollständig gebaut, Lade-/Fehler-/Leer-/Kein-Zugriff-Pfade sauber — aber die Rückwirkungsweiche rechnet ein zweites Mal am Server vorbei, Zustand 2 ist tot, Zustand 11 unerreichbar |

**Gesamt: 15/24**

---

## Muss behoben werden

### M-1 — BLOCKER (REQ-30): Der Dialog bestimmt „rückwirkend ja/nein" selbst und widerspricht dem Server

**Fundstellen:** `WorkTimePeriodEditModal.tsx:224, 446, 474, 546, 562-570`,
`workTimePeriodEditRules.ts:59-61` gegen `server/src/services/workPeriodCorrectionService.ts:294-296`

Der Server bestimmt den neu zu rechnenden Zeitraum als

```ts
// workPeriodCorrectionService.ts:294-295
const rangeStart = input.validFrom < period.validFrom ? input.validFrom : period.validFrom;
const isRetroactive = rangeStart < today;
```

also aus dem **Minimum von altem und neuem** `validFrom`. Er liefert das Ergebnis als Feld
`isRetroactive` in der Vorschau aus (`workPeriodCorrectionService.ts:413`, im Desktop-Vertrag
gespiegelt: `types/index.ts:281`). Der Dialog liest dieses Feld **nirgends**. Er rechnet stattdessen
selbst:

```ts
// WorkTimePeriodEditModal.tsx:224
const isRetroactive = isRetroactivePeriod(validFrom, todayStr);   // nur das NEUE validFrom
```

Diese eine Variable steuert vier Dinge: die Panelfarbe (`:474`), das Warnbanner amber-oder-blau
(`:546`), die Knopfbeschriftung (`:518`) und **ob der Bestätigungsschritt überhaupt stattfindet**
(`:446`).

**Der Fall, in dem beide auseinanderlaufen** (nicht konstruiert — das Verschieben des Beginns ist
laut Vertrag ausdrücklich vorgesehen, Hilfstext `:601`):

Periode ab 01.01.2026, offenes Ende, 40 h/Woche. Heute 23.08.2026. Der Admin stellt fest, dass die
Umstellung in Wahrheit erst im Oktober galt, und setzt „Gültig ab" auf 01.10.2026.

| | Anzeige | Wirklichkeit |
|---|---|---|
| Panel | blau | Server rechnet ab 01.01.2026 neu |
| Banner | „Diese Periode beginnt erst am 01.10.2026. **Es wird nichts rückwirkend geändert.**" | acht Monate Vergangenheit werden ersetzt |
| Badge | „Keine Rückwirkung" | `isRetroactive === true` |
| Knopf | „Korrektur speichern" | schreibt Historie um |
| Bestätigung | **entfällt** | — |

Im selben blauen Panel steht dabei aus derselben Vorschau der Satz „Neu gerechnet wird vom
**01.01.2026** bis 23.08.2026" (`:717-719`) — die Oberfläche widerspricht sich in einem Kasten.

Das ist der Kern von REQ-30: Genau hier hält der Admin die Aktion für einen harmlosen
„Stundenwechsel" (er verschiebt ja ein Datum nach vorn), und genau hier entfällt der einzige
Schutz, der ihn eines Besseren belehren würde. Zusätzlich verletzt es die Regel „Dual Calculation
System" aus `.claude/CLAUDE.md`: zwei Wahrheiten für dieselbe Aussage. Der Nachbardialog aus Phase 12
macht es richtig — `WorkTimeChangeModal.tsx:527, 558, 592` liest durchgängig `preview.isRetroactive`.

**Behebung:** `isRetroactive` aus der Vorschau beziehen, sobald sie vorliegt, und nur bis dahin auf
den Zeichenkettenvergleich zurückfallen:

```ts
const isRetroactive = preview ? preview.isRetroactive : isRetroactivePeriod(validFrom, todayStr);
```

`isRetroactivePeriod()` bleibt als Vorab-Weiche für den Zustand „noch keine Vorschau" bestehen; der
Primärknopf ist ohne Vorschau ohnehin gesperrt (`:519-523`), der Bestätigungsschritt kann also nie
mit dem geschätzten Wert entscheiden. `workTimePeriodEditRules.check.ts:37-46` bleibt gültig.

---

### M-2 — Das Tooltip „Nicht löschbar" wird beschnitten und verdeckt die Fußnote

**Fundstellen:** `workTimePeriodActions.tsx:113-120` in `WorkTimePeriodList.tsx:154` (`overflow-x-auto`)

Das Tooltip ist `absolute right-0 top-6 w-72` innerhalb der Aktionszelle. Der umgebende Container
ist `overflow-x-auto`. Nach CSS-Regel wird die zweite Achse dadurch rechnerisch ebenfalls zum
Scrollbereich (`overflow-y: visible` → `auto`), der Inhalt wird an der Padding-Box beschnitten.
**Diese exakte Falle ist im selben Bauteil bereits dokumentiert** — `WorkTimePeriodList.tsx:185-199`
beschreibt sie für den Phase-12-Befund V-2 („der umgebende `overflow-x-auto`-Container beschneidet
ihn") und löste sie dort durch Verzicht auf ein überstehendes Element.

Erschwerend: Der Chip erscheint nur bei `period.isFirst`, und die Liste ist absteigend nach
`validFrom` sortiert (`WorkTimePeriodList.tsx:75`). Die erste Periode ist damit **immer die letzte
Zeile**. Das 288 px breite, rund 85 px hohe Tooltip öffnet sich also stets an der Unterkante des
Containers, wo unmittelbar darunter nur noch die Fußnote steht (`:241`) — es wird teilweise
abgeschnitten und legt sich über genau den Text, den der Vertrag zum „Träger der Information"
erklärt.

Der Vertrag hält fest, das Tooltip sei „rein visuelle Wiederholung", ein Ausfall koste keine
Aussage. Das stimmt für Screenreader (das `aria-label` auf dem Chip trägt, `:105`) und für die
Fußnote. Es stimmt nicht für den sehenden Maus- oder Tastaturnutzer, dem stattdessen ein
angeschnittener dunkler Kasten über der Fußnote erscheint. Ausgeliefert wird damit eine Zusage
(Prüfer-Befund E8: `focus-within` plus ESC-Ausblendbarkeit), die im Bild nicht ankommt.

**Behebung, in dieser Reihenfolge zu erwägen:**
1. Tooltip nach **oben** öffnen (`bottom-full mb-1` statt `top-6`) — die Zeile hat oberhalb Platz,
   weil der Chip in der letzten Zeile steht. Behebt den Regelfall ohne Umbau.
2. Oder das Tooltip ersatzlos streichen und allein auf `aria-label` + Fußnote setzen. Der Vertrag
   deckt das ausdrücklich ab („Fällt das Tooltip aus, fehlt keine Aussage") und es ist die einzige
   Variante, die in einem `overflow`-Container garantiert nicht bricht.
3. Nur falls das Tooltip zwingend erhalten bleiben soll: Portal in `document.body` mit
   berechneter Position — deutlich teurer als der Nutzen.

---

### M-3 — Die Pflichtbegründung sperrt still; die vertraglich zugesagten Fehlermeldungen sind unerreichbar

**Fundstellen:** `EditUserModal.tsx:534-544, 1079-1085`, `WorkTimePeriodEditModal.tsx:645-655, 519-523`,
`workTimePeriodEditRules.ts:164-169`, `Textarea.tsx:21`

Beide Schreibwege gehen denselben Weg: Der Bestätigungs- bzw. Primärknopf ist gesperrt, solange die
getrimmte Begründung kürzer als zehn Zeichen ist, und es erscheint **nie** eine Fehlermeldung.

- **Löschen** (`EditUserModal.tsx:1079-1085`):
  `confirmDisabled = isDeleteConfirmDisabled(...) || deletionReason.trim().length < 10`.
  Die `Textarea` bekommt keine `error`-Prop (`:534-543`). Der Admin sieht einen grauen Knopf und
  muss selbst schließen, dass die Sperre an der Begründung liegt — obwohl derselbe Knopf auch
  gesperrt ist, solange die Server-Vorschau lädt oder gescheitert ist. Drei Ursachen, ein stummer
  Knopf.
- **Korrigieren** (`isPrimaryDisabled`, `workTimePeriodEditRules.ts:70-76`): dasselbe Muster. Der
  Absendepfad ruft zwar `validateCorrectionForm()` mit den Meldungen „Begründung ist erforderlich"
  und „Begründung muss mindestens 10 Zeichen lang sein" (`:164-169`) — aber `handleSubmit`
  (`WorkTimePeriodEditModal.tsx:440-451`) kann bei gesperrtem Knopf gar nicht feuern. **Zustand 11
  des Vertrags** („Feldfehler an der `Textarea`; Fokus springt auf das Feld") ist damit im
  laufenden Betrieb nicht erreichbar, und zwei Zeilen des Textbuchs sind toter Code.

Verschärft durch zwei Kleinigkeiten, die zusammen eine echte Sackgasse ergeben:
- Der Zähler zählt **ungetrimmt** (`WorkTimePeriodEditModal.tsx:651` und `EditUserModal.tsx:540`:
  `${reason.length}/10`), die Sperre prüft **getrimmt**. Zehn Leerzeichen zeigen „10/10 Zeichen
  (Minimum)" bei weiterhin gesperrtem Knopf, ohne jeden Hinweis.
- `Textarea.tsx:21` blendet den Hilfstext aus, sobald ein Fehler gesetzt ist (`showHelper =
  !!helperText && !error`) — sobald also je ein Fehler erschiene, verschwände der Zähler.

**Behebung:** Zähler auf `reason.trim().length` umstellen (eine Zeile je Dialog) und die Sperre
durch eine sichtbare Begründung ergänzen — entweder Feldfehler ab dem ersten Verlassen des Feldes
(`onBlur`), oder Knopf entsperren und die Meldung im Absendepfad zeigen. Letzteres macht Zustand 11
wieder erreichbar und deckt sich mit dem Vertrag.

---

### M-4 — Zustand 2 ist nicht gebaut: bei Ladefehler verschwindet der Korrekturblock ganz

**Fundstellen:** `EditUserModal.tsx:180-185, 892, 924`

Der Vertrag, Zustand 2: „Periodenliste Ladefehler → … **Korrekturblock bleibt sichtbar, aber sein
Button ist `disabled`**."

Gebaut ist das Gegenteil. Der Block hängt an

```tsx
{isAdmin && blockTargetPeriod && ( … )}        // :892
```

und `blockTargetPeriod` wird aus `periodsAscending` abgeleitet (`:181-185`), das bei einem
Ladefehler leer ist (`periods` bleibt `undefined`). Bei jedem Ladefehler entfällt der gesamte Block
— Überschrift, Erklärsatz und Abgrenzungssatz eingeschlossen. Damit verschwindet ausgerechnet der
Text, der „Stundenwechsel" von „Korrektur" abgrenzt, während die Liste einen roten Fehler zeigt.
Das explizit dafür vorgesehene `disabled={!!periodsLoadError}` (`:924`) ist toter Code: Es kann nie
zugleich `periodsLoadError` und `blockTargetPeriod` geben.

**Behebung:** Die Sichtbarkeit des Blocks von `blockTargetPeriod` entkoppeln —
`{isAdmin && (blockTargetPeriod || periodsLoadError) && …}` — und den Knopf über
`disabled={!!periodsLoadError || !blockTargetPeriod}` sperren. Zustand 4 (kein Stichtag vorhanden,
Block ausgeblendet) bleibt davon unberührt, weil dort weder `blockTargetPeriod` noch ein Fehler
vorliegt.

---

### M-5 — Punkt 3 der Löschbestätigung ist als ganzer Absatz 18 px fett und farbig gesetzt

**Fundstellen:** `EditUserModal.tsx:494-511`, `workTimePeriodDeleteRules.ts:119-127`

Der `<span>` mit `text-lg font-bold` plus grün/rot umschließt die vollständige Rückgabe von
`deleteDetailRebuild()` — zwei Sätze, im Regelfall:

> „Neu gerechnet wird vom 01.03.2026 bis heute. Der Überstundensaldo ändert sich dabei um +12:30h —
> von −4:00h auf +8:30h."

Das sind rund 150 Zeichen in 18 px Fett und Signalfarbe in einem `max-w-md`-Dialog (≈ 380 px
Textbreite): vier bis fünf Zeilen durchgehend fett gefärbter Fließtext. Der Vertrag sagt zweierlei
ausdrücklich anderes:

- Typografie, Gewicht 700: „**ausschließlich für vorzeichenbehaftete Stundenwerte** … die
  Saldoänderung in Punkt 3 der Löschbestätigung".
- Visueller Anker: „**die Saldoänderung** (`text-lg font-bold`, grün/rot, mit Trendpfeil)".

Ein Anker, der fünf Zeilen lang ist, ist kein Anker mehr; er hebt sich von nichts ab, und die
eigentliche Zahl geht in der eigenen Hervorhebung unter. Der Nachbardialog aus Phase 12 macht es
richtig: dort trägt `text-lg font-bold` nur das kurze Label plus Zahl
(`WorkTimeChangeModal.tsx:826-834`, ≈ 50 Zeichen). Die Abweichung ist neu in Phase 13, nicht geerbt.

**Behebung:** `deleteDetailRebuild()` in zwei Rückgaben teilen (Kontextsatz und Betragssatz) oder
in der Komponente den Kontextsatz als eigenen `<p className="text-sm text-gray-700
dark:text-gray-300">` rendern und nur den Betragsteil in den `text-lg font-bold`-Span legen. Die
Prüfskripte in `workTimePeriodDeleteRules.check.ts` sind entsprechend zu ergänzen.

---

## Feinschliff

### F-1 — Das Wort „rückwirkend" trennt die beiden Aktionen nicht, es verbindet sie

`EditUserModal.tsx:838-840` (Phase-12-Text) gegen `:923`:

> Blaues Panel „Stundenwechsel": „Eine **rückwirkende** oder künftige Umstellung des
> Arbeitszeitmodells läuft über eine eigene Aktion mit Vorschau."
> Grauer Block: „Stammdaten **rückwirkend** korrigieren …"

Der Vertrag führt „rückwirkend" in der Trenn-Tabelle als Unterscheidungsmerkmal **der Korrektur**
(Zeile „Wortwahl"). Steht dasselbe Wort 60 px darüber im Panel der harmlosen Aktion, trägt es nicht
mehr. Die übrigen fünf Merkmale (Ort, Rahmung, Buttonstil, Dialog, Bestätigung) sind sauber gebaut
und tragen die Trennung auch ohne dieses eine — deshalb Feinschliff und nicht Blocker.
Vorschlag: im Phase-12-Panel „rückwirkende oder künftige Umstellung" durch „Umstellung **ab einem
Stichtag**" ersetzen. Additive Textänderung in einer Datei, die diese Phase ohnehin anfasst.

### F-2 — Die deklarierte 32 × 32-px-Trefferfläche unter 640 px greift nicht

`workTimePeriodActions.tsx:95, 133`: `className="p-2 sm:px-3 sm:py-1.5"` auf einem
`Button size="sm"`. `Button.tsx:21` liefert für `sm` unbedingt `px-3 py-1.5`, und `Button.tsx:28`
verkettet die Klassen ohne Merge-Helfer. Über die Wirkung entscheidet nicht die Reihenfolge im
Attribut, sondern die Reihenfolge im erzeugten Stylesheet — dort steht `.p-2` **vor** `.px-3` und
`.py-1.5` (Tailwind 3.4 gibt die Padding-Utilities in der Folge `p`, `px`, `py`, … aus). Die
Größenklasse des Buttons gewinnt also auf allen Breiten; `p-2` und die `sm:`-Rückstellung sind ohne
Wirkung.

Ergebnis: 16 px Icon + 24 px waagerecht, + 12 px senkrecht → rund **40 × 28 px** statt der
vertraglich zugesagten 32 × 32. WCAG 2.2 AA (2.5.8, 24 × 24) ist weiterhin erfüllt, deshalb kein
Muss — aber die Ausnahme, die eigens in die Spacing-Skala aufgenommen wurde, ist faktisch nicht
gebaut. Behebung: `!p-2 sm:!px-3 sm:!py-1.5` (das `!`-Muster ist im Projekt etabliert, siehe
`READONLY_INPUT_CLASS` in `WorkTimePeriodEditModal.tsx:150`) oder auf `size="sm"` verzichten.

### F-3 — Dark Mode: Das Pflicht-Begründungsfeld der Löschbestätigung ist gray-800 auf gray-800 auf gray-800

`EditUserModal.tsx:531-543` rendert die `Textarea` (`dark:bg-gray-800`, `Textarea.tsx:45`) in das
`details`-Panel (`dark:bg-gray-800`, `ConfirmDialog.tsx:161`) innerhalb der `Card`
(`dark:bg-gray-800`, `Card.tsx:11`). Drei identische Flächen; das Eingabefeld hebt sich allein
über `dark:border-gray-600` ab.

Die Panel-auf-Panel-Gleichheit ist im Vertrag ausdrücklich erklärt und akzeptiert („Deklarierte
Folge: … die Panels heben sich dort allein über den Rahmen ab"). Das Formularfeld ist es nicht —
es kommt im Vertrag gar nicht vor (bewusste Ergänzung des Ausführenden, in `13-09-SUMMARY.md`
vermerkt). Für ein Pflichtfeld, das die zerstörerische Aktion freischaltet, ist eine reine
1-px-Randabgrenzung im Dunkelmodus knapp. Vorschlag: `dark:bg-gray-900` auf genau diesem Feld —
derselbe Ton, den `READONLY_INPUT_CLASS` bereits verwendet.

### F-4 — Der Ghost-Knopf färbt seine ganze Beschriftung amber, nicht nur das Warnsymbol

`EditUserModal.tsx:920` setzt `text-amber-600 dark:text-amber-400` auf den Button; der Vertrag
verlangt `variant="ghost" size="sm"` „mit vorangestelltem `AlertTriangle` **in amber-600/400**".
Die Amber-Fläche ist dadurch dauerhaft größer als vorgesehen — das berührt die Begründung 1 des
Vertrags („ein dauerhaft sichtbares amber-Panel würde die Warnfarbe entwerten"). Da Textfarbe
kein Panel ist und die Wirkung die Trennung nach REQ-30 eher stärkt als schwächt: bewusst
entscheiden und im Vertrag nachziehen, oder auf das Icon zurücknehmen.

### F-5 — Das `details`-Panel der Löschbestätigung hat keine Live-Region

`ConfirmDialog.tsx:160-164` rendert `details` ohne `role="status"` / `aria-live` / `aria-busy`. Der
Inhalt wechselt asynchron von „Auswirkung wird berechnet …" auf die fertige Saldoänderung und
entsperrt dabei den Bestätigungsknopf (`EditUserModal.tsx:499-511, 1079`). Der Korrektur-Dialog
macht es an der funktionsgleichen Stelle richtig (`WorkTimePeriodEditModal.tsx:658-662`). Ein
Screenreader-Nutzer erfährt den Zustandswechsel im Löschdialog nicht. Vorschlag: `role="status"
aria-live="polite"` am `details`-Wrapper, `aria-busy` über eine optionale Prop.

### F-6 — Zustand 21 zeigt keinen Fortschrittstext

Der Vertrag verlangt für „Löschen läuft": Spinner **und** Text „Wird gelöscht …". Gebaut ist
Spinner plus unveränderter `confirmText` („Ja, Periode löschen und stornieren",
`ConfirmDialog.tsx:178-179`). Der Vertragstext ist an dieser Stelle selbst widersprüchlich (er
verlangt den Spinner „vor dem `confirmText`" und zugleich einen anderen Text). Funktional
ausreichend — bei Bedarf über eine optionale `confirmLoadingText`-Prop nachziehen.

### F-7 — Zwei Schreibweisen derselben Wochenstundenzahl

`workTimePeriodEditRules.ts:118-120` formatiert mit `toFixed(1)` („30,0 h", wortgleich zur
Servermeldung), `WorkTimePeriodEditModal.tsx:127-129`, `workTimePeriodDeleteRules.ts:22-24` und
`WorkTimePeriodList.tsx:49-51` mit `toLocaleString(..., { maximumFractionDigits: 2 })` („30 h").
Dieselbe Zahl steht im selben Dialog in zwei Schreibweisen. Kosmetisch, aber vermeidbar; passt zum
bereits offenen IN-04 aus `13-REVIEW.md` (fünf Kopien von `formatGermanDate`).

### F-8 — Zwei Stellen, an denen der Vertrag sich selbst widerspricht (kein Umsetzungsfehler)

Zur Kenntnis, damit sie nicht bei der nächsten Prüfung erneut auffallen:
- Abstand der Zeilenaktionen: Spacing-Tabelle nennt `gap-3`, Abschnitt 3 nennt `gap-2`. Gebaut:
  `gap-2` (`workTimePeriodActions.tsx:85`).
- Abstand der `details`-Punkte: Spacing-Tabelle nennt `space-y-3`, Abschnitt 4 nennt `space-y-2`.
  Gebaut: `space-y-2` (`ConfirmDialog.tsx:161`).

Beide Male folgt die Umsetzung dem spezifischeren Abschnitt. Das ist die richtige Auflösung; die
Spacing-Tabelle sollte bei Gelegenheit angeglichen werden.

---

## Was der Vertrag verlangt und was tatsächlich steht

### REQ-30 — Trennung von „Stundenwechsel" und „Korrektur"

Die sechs Merkmale der Trenn-Tabelle, einzeln geprüft:

| Merkmal | Zusage | Befund |
|---------|--------|--------|
| Ort | blaues Panel über der Liste / eigener Block unter der Liste, `pt-6 border-t` | **erfüllt** — `EditUserModal.tsx:836-850` bzw. `:893-897` |
| Rahmung | neutraler grauer Block mit eigener `text-lg`-Überschrift | **erfüllt** — `:894, 898-901`, Überschrift wortgleich |
| Buttonstil | `ghost`/`sm`, vorangestelltes `AlertTriangle` amber | **erfüllt**, Beschriftung zusätzlich amber → F-4 |
| Wortwahl | „korrigieren", „rückwirkend", „von jeher falsch" gegen „Stundenwechsel", „ab Datum" | **teilweise** — „rückwirkend" steht in beiden Blöcken → F-1 |
| Dialog | Titel „Periode korrigieren: …", **immer** ein Warnbanner, das den Zeitraum konkret nennt und den Ausweg weist | **erfüllt in Form, verfehlt in der Aussage** — Banner ist immer da (`WorkTimePeriodEditModal.tsx:542-576`), Ausweg-Satz 3 steht in beiden Panelvarianten (`:571-575`), aber der Zukunftsfall behauptet Falsches → **M-1** |
| Bestätigung | immer, wenn die Periode die Vergangenheit berührt | **verfehlt** — Weiche hängt am falschen Wert → **M-1** |

Weitere REQ-30-Schutzschichten: Pflichtbegründung ≥ 10 Zeichen serverseitig **und** im Formular
(erfüllt, aber stumm → M-3), servergerechnete Vorschau mit `previewToken`-Bindung (erfüllt,
`:391-438`), Bestätigungsdialog mit konkretem Zeitraum und konkreter Saldoänderung (erfüllt für den
Fall, in dem er ausgelöst wird, `:458-467`).

**Kann ein Admin unter Zeitdruck die beiden Aktionen verwechseln?** Der Weg über den Block-Knopf:
nein — Überschrift, zwei Erklärsätze, Warnsymbol und Warnbanner stehen ihm dreifach im Weg. Der
Weg über die Zeilenaktion „Korrigieren" (Bleistift-Icon, das konventionellste „diese Zeile
bearbeiten"-Element überhaupt, wenige Pixel unter dem blauen Wechsel-Panel): im Regelfall ebenfalls
nein, weil das amberfarbene Warnbanner mit konkretem Zeitraum und Ausweg-Satz sofort erscheint und
die Bestätigung folgt. **Aber genau in dem Fall, in dem der Admin ein Datum verschiebt — also
gefühlt „einen Wechsel eintippt" — schaltet die Oberfläche auf blau, sagt „Es wird nichts
rückwirkend geändert" und lässt die Bestätigung weg.** Das ist keine Geschmacksfrage; das ist der
Kernauftrag der Phase, und er ist an dieser einen Stelle nicht erfüllt.

### REQ-31 — Buchung und Storno bleiben als Paar sichtbar

| Zusage | Befund |
|--------|--------|
| Beide Zeilen tragen das Typ-Badge „Modellwechsel" (teal) | **erfüllt** — `OvertimeTransactions.tsx:200-206`, kein `case` für Storno hinzugefügt |
| Zustands-Badge „storniert" / „Storno", grau | **erfüllt** — `:307-311`, `overtimeTransactionFormat.ts:70-77` |
| Originalbetrag bleibt ungestrichen und ungegraut stehen | **erfüllt** — `:355-378`, `documentedDelta` mit Vorzeichen und Farbe, keine `line-through` |
| Klartextbezug in der zweiten Beschreibungszeile | **erfüllt** — `:340-342`, `overtimeTransactionFormat.ts:104-121` („Storniert am … von … · Beleg #…" bzw. „Gleicht die Buchung vom … aus · Beleg #…") |
| Gemeinsame Belegnummer auf beiden Zeilen | **erfüllt** — Server setzt `referenceId: row.reversalOf ?? row.id` (`overtimeLiveCalculationService.ts:597`), beide Zeilen tragen denselben Wert; der Chip erscheint nur bei vorhandenem Partner (`:343`), „Beleg #undefined" kann nicht auftreten |
| Sprungmarke mit 2 s Hervorhebung und kurzzeitigem Fokus | **erfüllt** — `:57-84, 285-296`, `scrollIntoView({ block: 'center' })`, `ring-2 ring-inset`, `tabIndex={-1}` + `.focus()`, Timer wird beim Unmount aufgeräumt (`:49-56`) |
| Drei getrennte Fehlfall-Toasts | **erfüllt** — `overtimeTransactionFormat.ts:140-172`, Prüfreihenfolge Abschneidegrenze vor Zeitraumfilter, monatslose Variante vorhanden |
| Beide Zeilen tragen dasselbe Datum, der Filter kann das Paar nicht trennen | **erfüllt** serverseitig; Sortierung `date DESC` + Typpriorität 4 für `model_change` (`overtimeLiveCalculationService.ts:642-670`) stellt die Zeilen benachbart |
| „Bereinigte Lücke" ausgeschlossen | **erfüllt** — kein Pfad entfernt eine Zeile aus dem Auszug |

**Ist das Paar als Paar erkennbar?** Ja, und zwar auf vier voneinander unabhängigen Wegen (gleiche
Typfarbe, gegensätzliche Zustands-Badges, Klartextsatz, gemeinsame Belegnummer), von denen drei
ohne jede Interaktion, im Ausdruck und mit Screenreader funktionieren. Das ist der am saubersten
umgesetzte Teil dieser Phase. Einziger offener Punkt ist der bereits als IN-03 in `13-REVIEW.md`
verzeichnete doppelte Leerraum in „Storniert am  von X" bei fehlendem `reversedAt` — hier nicht
erneut gezählt.

### Projektvorgaben aus `.claude/CLAUDE.md`

| Vorgabe | Befund |
|---------|--------|
| Dark Mode Pflicht | **erfüllt** — jede neue Farbklasse trägt eine `dark:`-Entsprechung; Stichprobe über alle sechs neuen/geänderten Dateien fand keine Ausnahme. Ein Grenzfall → F-3 |
| Responsive Breakpoints | **erfüllt** bis auf F-2 — `grid-cols-1 md:grid-cols-2` (`:587`), `grid-cols-1 sm:grid-cols-3` (`:733`), `hidden sm:inline` an beiden Zeilenaktionen, `fullWidth sm:w-auto` am Blockknopf, `overflow-x-auto` an der Liste |
| Loading States | **erfüllt** — Liste (`WorkTimePeriodList.tsx:97-103`), Vorschau inkl. `stale`-Zwischenzustand gegen Flackern (`:469-478`), Speichern (`:789-793`), Löschen (`ConfirmDialog.tsx:178`) und die betroffene Zeile (`workTimePeriodActions.tsx:123`) |
| Error States | **erfüllt** — Ladefehler mit Wiederholknopf, Vorschaufehler mit „Vorschau erneut berechnen", Formularbanner, Löschfehlerbanner, 403-Sondertext, `PREVIEW_STALE` wird nie im Klartext gezeigt |
| `universalFetch` statt `fetch` | **erfüllt** — alle sechs Aufrufe laufen über `apiClient` (`useWorkTimeChange.ts:38, 63, 90, 114, 140`), kein direktes `fetch` im Neucode |
| Kein `console.log`, keine Debugausgaben | **erfüllt** — `api/client.ts` enthält 0 `console.log` und 2 `console.error`, die Green-Server-Probe gegen `129.159.8.19` ist entfernt |
| 403-Doppelmeldung vermeiden | **erfüllt und leicht weiter gefasst als der Vertrag** — `api/client.ts:149` unterdrückt den globalen Toast für **alle** Fehler auf `/work-periods*`, nicht nur 403. Alle Verbraucher stellen ihre Fehler selbst dar (geprüft: Liste, Korrektur-Dialog, Löschdialog); die Verbreiterung ist damit gedeckt, aber sie ist eine |
| Kein `any` im Neucode | **erfüllt** in allen fünf neuen Dateien |

### Zustandsabgleich (28 Zustände)

Gebaut und belegt: 1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
25, 26, 27, 28.
Nicht gebaut: **2** (Korrekturblock verschwindet statt zu bleiben → M-4), **11** (Feldfehler
unerreichbar, weil der Knopf vorher sperrt → M-3).
Falsch verzweigt: **7 / 8 / 14** (Zuordnung „rückwirkend / Zukunft" folgt dem falschen Wert → M-1).

---

## Registry Safety

`components.json` existiert weder im Repo-Root noch unter `desktop/`; `13-UI-SPEC.md` deklariert
unter „Registry Safety" ausdrücklich keine Dritt-Registries und keine neuen Abhängigkeiten. Prüfung
entfällt, kein `npx shadcn view` erforderlich. Stichprobe bestätigt: `desktop/package.json` hat in
dieser Phase keine neue Abhängigkeit erhalten; verwendet werden ausschließlich `lucide-react`,
`sonner` und `@tanstack/react-query` aus dem Bestand.

---

## Geprüfte Dateien

**Neu in Phase 13**
- `desktop/src/components/worktime/WorkTimePeriodEditModal.tsx` (815 Zeilen)
- `desktop/src/components/worktime/workTimePeriodEditRules.ts` (183)
- `desktop/src/components/worktime/workTimePeriodActions.tsx` (141)
- `desktop/src/components/worktime/workTimePeriodDeleteRules.ts` (153)

**Geändert in Phase 13**
- `desktop/src/components/users/EditUserModal.tsx` (1088)
- `desktop/src/components/ui/ConfirmDialog.tsx` (188)
- `desktop/src/components/worktime/WorkTimePeriodList.tsx` (244)
- `desktop/src/components/worktime/OvertimeTransactions.tsx` (435)
- `desktop/src/components/worktime/overtimeTransactionFormat.ts` (172)
- `desktop/src/hooks/useWorkTimeChange.ts`
- `desktop/src/api/client.ts`
- `desktop/src/types/index.ts`

**Zum Abgleich mitgelesen**
- `desktop/src/components/ui/Button.tsx`, `Textarea.tsx`, `Modal.tsx`, `Card.tsx`, `useModalLayer.ts`
- `desktop/src/components/worktime/WorkTimeChangeModal.tsx` (Phase-12-Referenz)
- `desktop/src/hooks/useWorkTimeAccounts.ts`, `desktop/tailwind.config.js`
- `server/src/services/workPeriodCorrectionService.ts`, `workPeriodDeletionService.ts`,
  `overtimeLiveCalculationService.ts`

---

## Zusammenfassung für die Planung

Drei Kennzahlen: **1 Blocker**, **4 weitere Muss-Punkte**, **8 Feinschliff-Punkte**.

Der Aufwand ist klein gemessen an der Wirkung. M-1 ist eine Zeile plus Regression-Test. M-4 ist eine
Bedingung. M-2 ist eine Positionierungsklasse oder ein Streichen. M-3 sind zwei Zeilen `trim()` plus
eine Entscheidung, wie die Sperre begründet wird. M-5 ist ein Aufteilen einer Textfunktion.

Was gut ist und erhalten bleiben sollte: die Zustandsabdeckung (26 von 28 tatsächlich gebaut,
einschließlich der unbequemen — `PREVIEW_STALE` mit Abbruchzähler, 403 ohne Doppelmeldung,
Fokusrückgabe je Zeile), die konsequente Auslagerung der reinen Regeln in prüfbare Module, und der
Kontoauszug: Das Storno-Paar trägt seinen Bezug vierfach und hält REQ-31 sauber ein.
