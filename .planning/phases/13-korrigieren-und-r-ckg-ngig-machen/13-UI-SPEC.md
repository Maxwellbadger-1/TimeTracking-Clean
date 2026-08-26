---
phase: 13
slug: korrigieren-und-rueckgaengig-machen
status: revised
shadcn_initialized: false
preset: none
created: 2026-08-21
revised: 2026-08-26
revision: 3
---

# Phase 13 — UI Design Contract

> Visueller und interaktiver Vertrag für „Korrigieren und rückgängig machen". Erstellt von
> `gsd-ui-researcher`, zu prüfen durch `gsd-ui-checker`, verbindlich für `gsd-planner` und
> `gsd-executor`.

**Fortschreibung V-1 (Phase 14.2, Plan 12, 26.08.2026).** Zwei Abschnitte sind auf den
tatsächlichen Quelltextzustand nachgezogen: „Inhalt der Aktionszelle" und „Barrierefreiheit",
beide zum Chip „Nicht löschbar". Grund: Korrektur **M-2** der Phase 13
(`desktop/src/components/worktime/workTimePeriodActions.tsx`) hat das dort ursprünglich
verlangte anwendungsgezeichnete Tooltip bewusst und mit Messung verworfen — sie ist die
jüngere, gemessene Entscheidung; dieser Vertrag trug noch die ältere Absicht. Zusätzlich sind
zwei Farbwerte nachgezogen (Zeile ~131 Accent dunkel, Zeile ~166 Gutschrift hell), die Plan
14.2-10 (D-1, Kontrastkorrektur) im Quelltext bereits geändert hatte, ohne den Vertrag
mitzuziehen. **Kein Produktionscode wurde in diesem Plan angefasst** — reine
Dokumentänderung, siehe `14.2-12-SUMMARY.md`.

**Fortschreibung von Phase 12, kein Neuanfang.** `12-UI-SPEC.md` ist für dieses Dokument bindend.
Spacing, Typografie, Farbrollen, Semantik-Palette, Modal-Aufbau, Buttonreihenfolge,
Fehlerdarstellung, `WorkTimePeriodList.tsx` und `OvertimeTransactions.tsx` werden **übernommen,
nicht neu erfunden**. Jede Abweichung ist unten ausdrücklich als solche markiert und begründet.
Neue Farben: **keine**. Neue Abstände: **keine**. Zweiter Modal-Stil: **keiner**.

**Der Andockpunkt aus Phase 12 wird genutzt wie vorgesehen.** `WorkTimePeriodList.tsx` bekommt in
dieser Phase ausschließlich die bereits geschnittene Prop `renderActions` gesetzt; die Tabelle
selbst wird nicht umgebaut. Zwei kleine Ergänzungen an derselben Komponente sind nötig
(Zustand „Kein Zugriff", dauerhafte Fußnote zur ersten Periode) — beide sind additiv und in
Abschnitt „Änderungen an Bestandskomponenten" einzeln aufgeführt.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **none** — kein shadcn, eigene Primitive unter `desktop/src/components/ui/` |
| Preset | not applicable |
| Component library | Eigene Primitive: `Modal`, `Card`, `Button`, `Input`, `Select`, `Textarea`, `ConfirmDialog`, `LoadingSpinner` |
| Styling | Tailwind CSS, `darkMode: 'class'`, `theme.extend` leer (nur Tailwind-Defaults) |
| Icon library | `lucide-react` ^0.294.0 — in dieser Phase: `AlertTriangle`, `AlertCircle`, `Info`, `Lock`, `Trash2`, `Pencil`, `Undo2`, `Link2`, `TrendingUp`, `TrendingDown`, `FileText`, `Receipt` (alle im installierten Paket vorhanden, geprüft am 21.08.2026) |
| Font | Inter (Fallback Avenir, Helvetica, Arial, sans-serif), Basisgröße 16 px, `line-height: 24px` — `desktop/src/App.css` `:root` |
| Toasts | `sonner` ^1.2.0, `<Toaster position="top-right" richColors />` in `desktop/src/main.tsx` |
| Datums-/Zahlformat | `toLocaleDateString('de-DE')`, Stunden über `formatHours()` (`H:MMh`) aus `desktop/src/utils/timeUtils.ts` |
| Neue Abhängigkeiten | **keine** |

### shadcn-Gate — Entscheidung

`components.json` existiert nicht (weder im Repo-Root noch unter `desktop/`); der Stack ist
React 19 + Vite + Tauri, das Gate greift also formal.
**Entscheidung (vom Orchestrator entschieden): shadcn wird NICHT initialisiert.** Begründung: Phase 12
hat dieselbe Entscheidung für dieselbe Oberfläche getroffen. Phase 13 erweitert exakt die
Komponenten, die Phase 12 gebaut hat. Ein Designsystemwechsel zwischen zwei aufeinander aufbauenden
Phasen desselben Milestones erzeugt genau die Inkonsistenz, die dieses Dokument verhindern soll, und
verletzt „NO REGRESSION" aus `.claude/CLAUDE.md`. Registry-Sicherheitsgate: **nicht anwendbar**.

---

## Spacing Scale

Unverändert aus `12-UI-SPEC.md` — einschließlich des dort geführten Tokens **sm+** (12 px).
Alle Werte sind Vielfache von 4.

| Token | Tailwind | Value | Verwendung in dieser Phase |
|-------|----------|-------|----------------------------|
| xs | `gap-1`, `mt-1` | 4px | Icon↔Text in Zeilenaktionen, Feldfehler unter dem Feld, zweite Zeile in der Beschreibungszelle |
| sm | `gap-2`, `space-x-2` | 8px | Badge-Innenabstand, Abstand Typ-Badge↔Zustands-Badge, Zahl↔Trendpfeil |
| **sm+** | `gap-3`, `space-y-3`, `p-3`, `px-4 py-3` | **12px** | Tabellenzellen der Periodenliste und des Kontoauszugs, Abstand zwischen den Aktionsknöpfen einer Zeile (`flex items-center justify-end gap-3`), Aktionszeile des Dialogs, Fußzeile der Bestätigung (`space-x-3` aus `CardFooter`), Abstand der drei `details`-Punkte (`space-y-3`) |
| md | `gap-4`, `p-4`, `space-y-4` | 16px | Formularfelder untereinander, Innenabstand der Panels (Warnung, Vorschau, Kein Zugriff), Kennzahlenraster |
| lg | `p-6`, `space-y-6`, `pt-6` | 24px | Modal-Innenabstand, Abstand zwischen Formularblöcken, Trennung Periodenliste↔Korrekturblock |
| xl | `mb-8` | 32px | Abstand Periodenliste↔restlicher Modalinhalt (aus Phase 12) |
| 2xl | — | 48px | nicht verwendet (Modale, keine Seitenlayouts) |
| 3xl | — | 64px | nicht verwendet |

**Ausnahmen — die zwei aus Phase 12, plus eine neue:**
- `py-1.5` (6 px) in `Button size="sm"` und `py-2.5` (10 px) in `Input` (`Input.tsx` Zeile 26) —
  Teil der bestehenden Primitive, wird nicht angefasst.
- `Input` behält die feste Höhe `h-[42px]` (`Input.tsx` Zeile 26).
- **Neu und nur hier:** Icon-only-Zeilenaktionen unterhalb von 640 px erhalten `p-2` statt
  `px-3 py-1.5`, damit die Trefferfläche 32 × 32 px erreicht (WCAG 2.2 AA, 2.5.8 verlangt 24 × 24 px).
  32 ist ein Vielfaches von 4, die Skala bleibt unverletzt. 44 px wird bewusst **nicht** gefordert:
  Das ist eine Tauri-Desktopanwendung mit Zeigereingabe, 2.5.5 (44 px) ist AAA und hier nicht
  einschlägig.

`px-4 py-3` in Tabellenzellen ist **keine** Ausnahme, sondern der Token `sm+` in Kombination mit
`md` — genau wie Phase 12 es feststellt. Dasselbe gilt für `gap-3` und `space-x-3`: beides ist
`sm+`, nicht skalenfremd.

---

## Typography

Keine `theme.extend.fontSize`; es gelten die Tailwind-Defaults. Freigegeben sind dieselben
**vier** Größen wie in Phase 12, mehr nicht:

| Rolle | Klasse | Size | Weight | Line Height |
|-------|--------|------|--------|-------------|
| Hilfs-/Metatext (Badges, Beleg-Chip, Fußnoten, zweite Beschreibungszeile) | `text-xs` | 12px | 400 | 16px (1,33) |
| Body / Label / Tabelleninhalt / Formularfeld / Dialogtext | `text-sm` | 14px | 400 (Body) · 500 `font-medium` (Labels, Feldinhalt) | 20px (1,43) |
| Abschnittsüberschrift („Arbeitszeitmodell — Perioden", „Sonderfall: Werte waren von jeher falsch") | `text-lg` | 18px | 600 `font-semibold` | 28px (1,56) |
| Modaltitel (durch `Modal` bzw. `CardTitle` gesetzt) | `text-xl` | 20px | 600 `font-semibold` | 28px (1,4) |

### Gewichte — ehrliche Fassung

Diese Phase verwendet **vier** Schriftgewichte. Zwei davon sind frei gewählt, zwei sind
bestandsgebunden und ausschließlich an den hier genannten Stellen erlaubt. Formulierung und
Systematik sind aus `12-UI-SPEC.md` übernommen.

| Gewicht | Status | Wo genau in dieser Phase |
|---------|--------|--------------------------|
| 400 regulär | frei gewählt, Vertrag | Fließtext, Tabelleninhalte, Hilfstexte, Fußnoten, Dialogtexte, `details`-Punkte 1 und 2 |
| 600 `font-semibold` | frei gewählt, Vertrag | Modaltitel, `CardTitle` der Bestätigungen, Abschnittsüberschriften, Überschrift des Warnbanners, Überschrift „Kein Zugriff" |
| 500 `font-medium` | **bestandsgebunden** | kommt fest aus `Input`, `Select`, `Textarea` und `Button`; zusätzlich aus dem Badge-Muster in `OvertimeTransactions.tsx` (`text-xs font-medium`), das die neuen Zustands-Badges unverändert übernehmen. Kein neuer Einsatzort außerhalb dieser Primitive und dieses Badge-Musters. |
| 700 `font-bold` | **bestandsgebunden, eng begrenzt** | ausschließlich für vorzeichenbehaftete Stundenwerte: die hervorgehobene Saldoänderung im Vorschaupanel des Korrektur-Dialogs, die Saldoänderung in Punkt 3 der Löschbestätigung, die Beträge der Journal- und der Storno-Zeile. Die Storno-Zeile steht direkt zwischen den Betragszeilen des Kontoauszugs und muss gleich aussehen; die Zahl in der Löschvorschau muss optisch identisch mit der Zahl sein, die danach im Kontoauszug steht. |

Neue Einsatzorte für 500 oder 700 außerhalb dieser Tabelle sind ein Vertragsbruch.

`text-base` (16 px) wird nicht eingeführt; alle Buttons nutzen unverändert `size="md"` bzw.
`size="sm"` und bringen ihre Größe selbst mit.

---

## Color

Alle Werte hell / dunkel. Dark Mode ist Pflicht (`.claude/CLAUDE.md` → Quality Gates).
Die Tabelle ist **unverändert** aus `12-UI-SPEC.md` übernommen.

| Rolle | Hell | Dunkel | Verwendung |
|-------|------|--------|------------|
| Dominant (60 %) | `#ffffff` (white) | `#1f2937` (gray-800) | Modalfläche, Kartenfläche, Tabellenhintergrund, Eingabefelder |
| Secondary (30 %) | `#f9fafb` / `#f3f4f6` (gray-50/100) · Text `#374151` (gray-700) · Linien `#e5e7eb` (gray-200) | `#111827` / `#374151` (gray-900/700) · Text `#d1d5db` (gray-300) · Linien `#374151` (gray-700) | Panelflächen, Trennlinien, Zeilen-Hover, Sekundärtext, Periodenliste, Korrekturblock, Panel „Kein Zugriff", Zustands-Badges |
| Accent (10 %) | `#2563eb` (blue-600) | `#2563eb` (blue-600) als Knopfgrund des Primärbuttons¹; `#3b82f6` (blue-500) bleibt der Fokusring-Ton | siehe Reservierungsliste |
| Destructive | `#dc2626` (red-600) | `#f87171` (red-400) | siehe Reservierungsliste |

¹ **Nachgezogen (Phase 14.2, Plan 10 → V-1, Plan 12).** Weiß auf `blue-500` maß im Dunkelmodus
**3,68:1** — unter der Grenze 4,5:1 für Fließtext (D-1). Der Grund des Primärbuttons wurde
deshalb im Dunkelmodus auf dieselbe Tonstufe wie hell gehoben (`dark:bg-blue-600`, gemessen
**5,17:1**); `focus:ring-blue-500` blieb unverändert. Die Reservierungsliste unten bleibt
gültig — nur der Knopfgrund ist betroffen. Der Gefahrenknopfgrund im Dunkelmodus ist inzwischen
ebenfalls auf `dark:bg-red-600` gezogen (dieselbe Korrektur); die Zeile „Destructive" oben
bezeichnet den **Text**ton (Pflichtfeld-Stern, negative Werte) und macht dazu keine eigene
Aussage — sie bleibt unverändert gültig.

### Accent ist reserviert für — abschließende Liste (Phase 13)

1. Der **primäre Aktionsbutton** des Korrektur-Dialogs (`Button variant="primary"`) — genau einer je Dialog.
2. Der **Fokusring** auf Eingabefeldern, Buttons und dem Beleg-Chip (`focus:ring-blue-500`).
3. Der **aktivierte Toggle** „Individueller Wochenplan" im `WorkScheduleEditor` innerhalb des
   Korrektur-Dialogs (`bg-blue-600`).
4. Das **Info-Panel „Keine Rückwirkung"**, wenn die korrigierte Periode vollständig in der Zukunft
   liegt (`bg-blue-50 dark:bg-blue-900/20`, `border-blue-200 dark:border-blue-800`) — dasselbe
   Panelmuster wie in Phase 12.

**Accent ist ausdrücklich NICHT** für: die Zeilenaktionen „Korrigieren"/„Löschen", den Beleg-Chip im
Kontoauszug, das Storno- oder das Zustands-Badge, den Einstiegsblock „Stammdaten korrigieren", das
Panel „Kein Zugriff", die Periodenliste, Tabellenkopfzeilen, Zeilen-Hover oder „alle interaktiven
Elemente".

### Destructive (rot) ist reserviert für — abschließende Liste

1. Der **Bestätigungsknopf** der Löschbestätigung (`Button variant="danger"`) — genau einer je Dialog.
   Das ist der einzige gefüllte rote Knopf der Phase. Phase 12 hat `variant="danger"` genau hierfür
   freigehalten.
2. Die **Zeilenaktion „Löschen"** als `Button variant="ghost" size="sm"` mit
   `text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300
   dark:hover:bg-red-900/20` — wortgleiches Muster aus `CorrectionsTable.tsx`.
3. **Fehlerbanner und Feldfehler** (bestehende Semantik).
4. **Negative Stundenwerte** in Vorschau, Bestätigung und Kontoauszug (bestehende Semantik).

Rot ist ausdrücklich **nicht** die Farbe des Zustands „Kein Zugriff" — Begründung siehe dort.

### Semantik-Palette (unverändert aus Phase 12)

| Bedeutung | Hell / Dunkel | Wo genau in dieser Phase |
|-----------|---------------|--------------------------|
| Gutschrift / positiver Saldo | green-700 / green-400 (Hellmodus nachgezogen²) | positive Stundenwerte in Vorschau, Löschbestätigung, Journal- und Storno-Zeile; `TrendingUp` |
| Belastung / negativer Saldo | red-600 / red-400 | negative Stundenwerte; `TrendingDown` |
| Fehler | red-600 / red-400 auf `bg-red-50` / `bg-red-900/20`, Rahmen `border-red-200` / `border-red-800` | Feldfehler, Vorschau-Fehlerbanner, Speicher- und Löschfehlerbanner |
| Warnung / Tragweite | amber-600 / amber-400 auf `bg-amber-50` / `bg-amber-900/20`, Rahmen `border-amber-200` / `border-amber-800` | Warnbanner „Das ändert die Vergangenheit" im Korrektur-Dialog, rückwirkende Vorschau, `ConfirmDialog variant="warning"` inkl. dessen Icon (siehe Angleichung unten) |
| Modellwechsel | teal-100/teal-700 hell, teal-900/30 + teal-300 dunkel | Typ-Badge „Modellwechsel" im Kontoauszug — **auch auf der Storno-Zeile** (siehe unten) |

² **Nachgezogen (Phase 14.2, Plan 10 → V-1, Plan 12).** `green-600` maß auf Weiß **3,30:1** und
auf dem amberfarbenen Vorschau-Panel **3,18:1** — beide unter der Grenze 4,5:1 (D-1). Der
Hellmodus-Ton wurde deshalb auf `text-green-700` gehoben (gemessen **4,84 bis 5,02:1**, neun
Stellen einzeln geprüft); der Dunkelmodus-Ton `green-400` ist **unverändert** (gemessen
**7,92:1**, hielt bereits vorher).

**Angleichung der Warnfarbe im `ConfirmDialog` (vom Orchestrator entschieden).**
`ConfirmDialog.tsx` Zeile 47 führt `warning: 'text-yellow-600 dark:text-yellow-400'` — **gelb**, nicht
amber. Die Korrekturbestätigung bekäme damit ein gelbes Warnsymbol unmittelbar nach einem
amberfarbenen Warnbanner. Deshalb wird `iconColors.warning` auf `text-amber-600 dark:text-amber-400`
angeglichen; die Änderung steht in der Änderungsliste. Das ist risikofrei: **kein Bestandsaufrufer
verwendet `variant="warning"`** (`grep` über `desktop/src`, geprüft am 21.08.2026 — die einzigen
Nutzer sind die Bestätigungen aus Phase 12 und Phase 13). `danger` (red-600/400) und `info`
(blue-600/400) stimmen bereits mit dieser Palette überein und bleiben unangetastet.

**Keine neue Farbe für Storno (vom Orchestrator entschieden).** Die Storno-Zeile behält das
teal Typ-Badge ihres Originals und trägt daneben ein **graues Zustands-Badge** „Storno"
(`bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`). Die stornierte Originalzeile
bekommt spiegelbildlich das graue Zustands-Badge „storniert". Begründung: Gleiche Typfarbe macht die
Zusammengehörigkeit sofort sichtbar; das zusätzliche graue Badge macht den Zustand sichtbar. Eine
eigene Storno-Farbe hätte in `OvertimeTransactions.tsx` die achte Badge-Farbe eingeführt (blue,
amber, orange, purple, gray, teal sind belegt, green/red sind durch Vorzeichen besetzt) und die
Verwandtschaft der beiden Zeilen optisch zerschnitten.

---

### Visueller Anker

Phase 12 legt den Anker ihres Dialogs fest; diese Phase führt das für ihre beiden neuen Oberflächen
fort. Kein zweites Element darf im selben Dialog die Kombination aus `text-lg`, `font-bold` und
semantischer Farbe tragen.

| Oberfläche | Anker | Warum |
|------------|-------|-------|
| Korrektur-Dialog | die **hervorgehobene Saldoänderung im Vorschaupanel** (`text-lg font-bold`, grün/rot, mit `TrendingUp`/`TrendingDown`) | identisch zu Phase 12: alles andere im Dialog ist `text-sm`/`text-xs` in neutralen Tönen. Das amberfarbene Warnbanner steht zwar weiter oben, trägt aber `text-sm` — es rahmt die Entscheidung, es ist nicht die Entscheidungsgrundlage. |
| **Löschbestätigung** | **Punkt 3 der `details`-Liste: die Saldoänderung** (`text-lg font-bold`, grün/rot, mit Trendpfeil) | Ohne Festlegung stünden drei gleichrangige `text-sm`-Punkte in einem grauen Panel, und der gefährlichste Dialog der Phase hätte keinen Blickfang. Punkt 1 (Lückenschluss) und Punkt 2 (Storno) bleiben `text-sm` — sie erklären, Punkt 3 entscheidet. |

Die Reihenfolge der drei `details`-Punkte bleibt davon unberührt: Punkt 3 ist der Anker, steht aber
weiterhin an dritter Stelle. Der Storno-Punkt darf nicht ans Ende rutschen, und die Zahl gehört
ans Ende, weil sie die Folge der beiden Sätze davor ist.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (Korrektur, Periode liegt in der Vergangenheit) | **Korrektur rückwirkend speichern** |
| Primary CTA (Korrektur, Periode liegt vollständig in der Zukunft) | **Korrektur speichern** |
| Einstiegs-Button im Korrekturblock | **Stammdaten rückwirkend korrigieren …** |
| Zeilenaktion 1 | **Korrigieren** |
| Zeilenaktion 2 | **Löschen** |
| Empty state heading (Periodenliste) | **Noch kein Stichtag hinterlegt** (unverändert aus Phase 12) |
| Empty state body (Periodenliste) | unverändert aus Phase 12 |
| No-access heading (neu) | **Kein Zugriff auf die Arbeitszeit-Perioden** |
| No-access body (neu) | Diese Angaben dürfen nur Administratoren einsehen. Wenn Sie glauben, dass Sie sie brauchen, wenden Sie sich an eine Administratorin oder einen Administrator. |
| Error state (Vorschau) | **Die Vorschau konnte nicht berechnet werden.** Ohne Vorschau lässt sich die Korrektur nicht speichern. → Button „Vorschau erneut berechnen" |
| Error state (Speichern) | **Die Korrektur wurde nicht gespeichert.** Es wurde nichts verändert. {Servermeldung} |
| Error state (Löschen) | **Die Periode wurde nicht gelöscht.** Es wurde nichts verändert — weder die Periode noch der Kontoauszug. {Servermeldung} |
| Destructive confirmation 1 | *Periode löschen*: siehe Textbuch „Löschbestätigung" |
| Destructive confirmation 2 | *Stammdaten korrigieren*: siehe Textbuch „Korrekturbestätigung" |

### Vollständiges Textbuch (deutsch, Umlaute korrekt)

**Einstiegsblock in `EditUserModal.tsx` — unterhalb der Periodenliste**

| Ort | Text |
|-----|------|
| Abschnittsüberschrift (`text-lg font-semibold`) | Sonderfall: Die Werte waren von jeher falsch |
| Erklärsatz (`text-sm`, gray-600/400) | Wenn die hinterlegten Stunden nie gestimmt haben, ist das kein Stundenwechsel, sondern eine Korrektur. Sie ändert die bereits gerechnete Vergangenheit und braucht eine Begründung. |
| Abgrenzungssatz (`text-sm`, gray-600/400) | Hat sich die Arbeitszeit **ab einem Datum** geändert, nehmen Sie oben „Stundenwechsel ab Datum …" — dann bleibt die Vergangenheit unberührt. |
| Button | Stammdaten rückwirkend korrigieren … |
| Fußnote unter der Periodenliste (dauerhaft sichtbar, `text-xs`, gray-500/400) | Die erste Periode (ab dem Eintrittsdatum) lässt sich korrigieren, aber nicht löschen — sie hat keine Vorgängerin, die die entstehende Lücke schließen könnte. |

**Korrektur-Dialog**

| Ort | Text |
|-----|------|
| Modaltitel | Periode korrigieren: {Vorname} {Nachname} |
| Periodenkennung unter dem Titel (`text-sm`, gray-600/400) | Periode vom {TT.MM.JJJJ} bis {TT.MM.JJJJ oder „offen"} · derzeit {X,X} h/Woche |
| Warnbanner (amber), Überschrift | Das ändert die Vergangenheit |
| Warnbanner, Satz 1 (rückwirkender Fall) | Für {Vorname} {Nachname} wird der Zeitraum vom **{TT.MM.JJJJ}** bis **{TT.MM.JJJJ}** neu gerechnet — das sind {n} Arbeitstage. |
| Warnbanner, Satz 2 (rückwirkender Fall) | Die für diesen Zeitraum bereits gebuchten Überstunden werden ersetzt. Alles vor dem {TT.MM.JJJJ} bleibt unverändert. |
| Warnbanner, Satz 3 — **Ausweg, in beiden Panelvarianten sichtbar** | Hat sich die Arbeitszeit erst **ab einem Datum** geändert, ist das kein Korrekturfall: Brechen Sie ab und nutzen Sie „Stundenwechsel ab Datum …" — dann bleibt die Vergangenheit unberührt. |
| Warnbanner-Ersatz (Periode liegt vollständig in der Zukunft, blaues Panel) | Diese Periode beginnt erst am {TT.MM.JJJJ}. Es wird nichts rückwirkend geändert. |
| Label „Gültig ab" | Gültig ab |
| Hilfstext „Gültig ab" (normale Periode) | Verschieben Sie den Beginn, verlängert oder verkürzt sich die Periode davor entsprechend — es entsteht keine Lücke. |
| Hilfstext „Gültig ab" (erste Periode, Feld gesperrt) | Die erste Periode beginnt immer am Eintrittsdatum ({TT.MM.JJJJ}) und kann nicht verschoben werden. |
| Label „Gültig bis" (schreibgeschützt) | Gültig bis |
| Hilfstext „Gültig bis" | Ergibt sich aus dem Beginn der nächsten Periode. Für die letzte Periode bleibt das Ende offen. |
| Label Wochenstunden | Wochenstunden |
| Hilfstext Wochenstunden | 0 h = Aushilfe (alle erfassten Stunden zählen als Überstunden) |
| Überschrift Tagesplan | Tagesplan dieser Periode |
| Label Begründung | Begründung (Pflicht) |
| Platzhalter Begründung | Warum war der bisherige Wert falsch? Zum Beispiel: Vertrag von Anfang an mit 30 h geschlossen, bei der Anlage 40 h eingetragen (mindestens 10 Zeichen) |
| Zähler unter der Begründung | {n}/10 Zeichen (Minimum) |
| Sekundärbutton | Abbrechen |

**Vorschaupanel im Korrektur-Dialog** — Aufbau und Texte wie in `12-UI-SPEC.md`, mit folgenden
Abweichungen im Wortlaut:

| Ort | Text |
|-----|------|
| Überschrift | Was diese Korrektur bewirkt |
| Platzhalter (Eingaben unvollständig) | Die Vorschau erscheint, sobald Wochenstunden und Beginn gesetzt sind. |
| Ladezustand | Vorschau wird berechnet … |
| Badge Vergangenheit | Rückwirkend |
| Badge Zukunft | Keine Rückwirkung |
| Zeitraumsatz | Neu gerechnet wird vom {TT.MM.JJJJ} bis {TT.MM.JJJJ} — {n} Arbeitstage. |
| Zusatzsatz bei verschobenem Beginn | Die Periode davor (ab {TT.MM.JJJJ}, {X,X} h/Woche) endet dadurch am {TT.MM.JJJJ}. |
| Zeile Sollstunden | Sollstunden im Zeitraum · bisher {H:MMh} · neu {H:MMh} · Differenz {±H:MMh} |
| Hervorgehobene Zahl | Änderung des Überstundensaldos: {±H:MMh} |
| Fußnote (REQ-28, immer sichtbar) | Der bereits angesparte Saldo wird nicht umgerechnet — Stunden bleiben Stunden. Die Änderung entsteht allein daraus, dass im neu gerechneten Zeitraum ein anderes Tagessoll gilt. |
| Fehlerbanner | Die Vorschau konnte nicht berechnet werden. Ohne Vorschau lässt sich die Korrektur nicht speichern. |
| Button im Fehlerbanner | Vorschau erneut berechnen |

**Korrekturbestätigung (`ConfirmDialog variant="warning"`)**

| Feld | Text |
|------|------|
| `title` | Rückwirkende Korrektur bestätigen |
| `message` | Für {Vorname} {Nachname} wird der Zeitraum vom {TT.MM.JJJJ} bis {TT.MM.JJJJ} neu gerechnet. Der Überstundensaldo ändert sich dabei um {±H:MMh} — von {±H:MMh} auf {±H:MMh}. |
| `message`-Variante bei Differenz = 0 | Für {Vorname} {Nachname} wird der Zeitraum vom {TT.MM.JJJJ} bis {TT.MM.JJJJ} neu gerechnet. Der Überstundensaldo bleibt dabei unverändert. Die Korrektur wird trotzdem als eigener Eintrag festgehalten. |
| `details` (Zusatzzeile, `text-sm`, gray-600/400) | Korrektur und Begründung bleiben im Kontoauszug dauerhaft sichtbar. |
| `confirmText` | Ja, rückwirkend korrigieren |
| `cancelText` | Zurück zum Formular |

**Löschbestätigung (`ConfirmDialog variant="danger"`)**

| Feld | Text |
|------|------|
| `title` | Periode löschen |
| `message` | Die Periode vom {TT.MM.JJJJ} bis {TT.MM.JJJJ} ({X,X} h/Woche) für {Vorname} {Nachname} wird gelöscht. |
| `details`, Punkt 1 (Lückenschluss) | Die Periode davor (ab {TT.MM.JJJJ}, {X,X} h/Woche) gilt danach bis zum {TT.MM.JJJJ} — es entsteht keine Lücke. |
| `details`, Punkt 2 (Storno) | Die zugehörige Buchung über {±H:MMh} wird **nicht entfernt**. Sie wird durch eine Gegenbuchung ausgeglichen. Beide Zeilen bleiben im Kontoauszug sichtbar. |
| `details`, Punkt 3 (Neuberechnung, aus der Server-Vorschau) | Neu gerechnet wird vom {TT.MM.JJJJ} bis heute. Der Überstundensaldo ändert sich dabei um {±H:MMh} — von {±H:MMh} auf {±H:MMh}. |
| `details`, Punkt 3 bei Differenz = 0 | Neu gerechnet wird vom {TT.MM.JJJJ} bis heute. Der Überstundensaldo bleibt dabei unverändert. |
| `details`, Ladezustand | Auswirkung wird berechnet … |
| `details`, Fehlerzustand | Die Auswirkung konnte nicht berechnet werden. Ohne diese Angabe wird nicht gelöscht. → Button „Erneut berechnen" |
| `confirmText` | Ja, Periode löschen und stornieren |
| `cancelText` | Abbrechen |

**Erste Periode — nicht löschbar**

| Ort | Text |
|-----|------|
| Hinweis-Chip in der Aktionsspalte (`text-xs`, gray-500/400, mit `Info`-Icon) | Nicht löschbar |
| Tooltip / `aria-label` des Chips | Dies ist die erste Periode seit dem Eintritt am {TT.MM.JJJJ}. Sie kann nicht gelöscht werden, weil sonst eine Lücke ab dem Eintrittsdatum entstünde. Wenn die Werte von jeher falsch waren, korrigieren Sie sie. |

**Fehlermeldungen (Validierung)**

| Auslöser | Meldung |
|----------|---------|
| Begründung leer | Begründung ist erforderlich |
| Begründung kürzer als 10 Zeichen | Begründung muss mindestens 10 Zeichen lang sein |
| Wochenstunden leer oder keine Zahl | Wochenstunden sind erforderlich |
| Wochenstunden außerhalb 0–60 | Wochenstunden müssen zwischen 0 und 60 liegen |
| Beginn vor dem Eintrittsdatum | Der Beginn darf nicht vor dem Eintrittsdatum ({TT.MM.JJJJ}) liegen. |
| Beginn überlappt die Periode davor | Der Beginn muss nach dem {TT.MM.JJJJ} liegen — dem Beginn der vorherigen Periode. |
| Beginn liegt am oder nach dem Ende der Periode | Der Beginn muss vor dem {TT.MM.JJJJ} liegen — dem Beginn der nächsten Periode. |
| Beginn nach einem hinterlegten Austrittsdatum | Der Beginn liegt nach dem Austrittsdatum ({TT.MM.JJJJ}). |
| Keine Änderung vorgenommen | Es wurde nichts geändert. Ändern Sie einen Wert oder brechen Sie ab. |
| Tagesplansumme weicht ab (Warnung, blockiert nicht) | Summe weicht von den Wochenstunden ({X,X} h) ab! — bestehender Text aus `WorkScheduleEditor.tsx`, unverändert |
| Vorschau veraltet (Server lehnt Token ab) | Die Vorschau ist nicht mehr aktuell. Sie wurde neu berechnet — bitte prüfen Sie die Werte und speichern Sie erneut. |
| Serverseitige Ablehnung wegen Rolle (403) | Ihnen fehlt die Berechtigung für diese Änderung. Es wurde nichts verändert. |
| Löschen der ersten Periode serverseitig abgelehnt | Die erste Periode kann nicht gelöscht werden. Korrigieren Sie sie stattdessen. |

**Erfolgsmeldungen**

| Anlass | Text |
|--------|------|
| Toast nach Korrektur (`toast.success`) | Korrektur gespeichert |
| Toast nach Korrektur mit Saldodifferenz ≠ 0 | Korrektur gespeichert — Saldoänderung {±H:MMh} steht im Kontoauszug |
| Banner im `EditUserModal` nach Korrektur (grün, 8 s) | Periode ab {TT.MM.JJJJ} korrigiert: jetzt {X,X} h/Woche. |
| Toast nach Löschen | Periode gelöscht — Storno steht im Kontoauszug |
| Banner im `EditUserModal` nach Löschen (grün, 8 s) | Periode vom {TT.MM.JJJJ} gelöscht. Die Periode ab {TT.MM.JJJJ} gilt jetzt bis zum {TT.MM.JJJJ}. |

**Kein „Rückgängig" im Erfolgs-Toast (vom Orchestrator entschieden).** `sonner` kann eine
Aktionsschaltfläche im Toast anbieten; sie wird hier **nicht** verwendet. Das Wiederherstellen einer
gelöschten Periode ist laut `13-CONTEXT.md` ausdrücklich zurückgestellt — ein Knopf, der diesen Weg
verspricht, wäre eine Lüge in der Oberfläche.

**Kontoauszug — Storno-Paar**

| Ort | Text |
|-----|------|
| Typ-Badge beider Zeilen | Modellwechsel |
| Zustands-Badge der Originalzeile | storniert |
| Zustands-Badge der Gegenbuchung | Storno |
| Beschreibung Originalzeile (unverändert aus Phase 12) | Stundenwechsel ab {TT.MM.JJJJ}: {X,X} → {Y,Y} h/Woche (Grund: {Begründung}) |
| Zweite Zeile der Originalzeile nach dem Storno | Storniert am {TT.MM.JJJJ} von {Admin-Name} · Beleg #{referenceId} |
| Beschreibung der Gegenbuchung | Storno zur Buchung vom {TT.MM.JJJJ}: Periode ab {TT.MM.JJJJ} gelöscht (Grund: {Begründung}) |
| Zweite Zeile der Gegenbuchung | Gleicht die Buchung vom {TT.MM.JJJJ} aus · Beleg #{referenceId} |
| Beschreibung der Korrekturbuchung | Periode ab {TT.MM.JJJJ} korrigiert: {X,X} → {Y,Y} h/Woche (Grund: {Begründung}) |
| Beleg-Chip (Schaltfläche auf beiden Zeilen) | Beleg #{referenceId} |
| Spaltenwert „Datum" beider Zeilen | {Stichtag der Periode, TT.MM.JJJJ} — Festlegung siehe Abschnitt 5 |
| `aria-label` des Chips (Originalzeile) | Zugehörige Storno-Buchung anzeigen |
| `aria-label` des Chips (Gegenbuchung) | Zugehörige Ursprungsbuchung anzeigen |
| Toast — Partnerzeile nicht geladen (Abschneidegrenze) | Die zugehörige Buchung ist in dieser Ansicht nicht geladen — angezeigt werden nur die letzten {limit} Buchungen. Wählen Sie einen engeren Zeitraum. |
| Toast — Partnerzeile außerhalb des Monatsfilters | Die zugehörige Buchung liegt außerhalb des gewählten Zeitraums ({Monat JJJJ}). |
| Toast — Partnerzeile außerhalb des Jahresfilters | Die zugehörige Buchung liegt außerhalb des gewählten Zeitraums ({JJJJ}). |

Die Begründung ist Freitext eines Menschen und wird **unverändert** durchgereicht — kein Trimmen,
kein Umformatieren von Datumsmustern darin. Regel aus `VacationTransactions.tsx`
(`formatDescription()`), gilt hier genauso.

---

## Die zwei Aktionen — sichtbare Trennung (REQ-30, CONTEXT D1)

Das ist der Kern der Phase. Die Trennung wird über **sechs** voneinander unabhängige Merkmale
hergestellt; Farbe ist nur eines davon.

| Merkmal | „Stundenwechsel ab Datum …" (Phase 12) | „Stammdaten rückwirkend korrigieren …" (Phase 13) |
|---------|----------------------------------------|---------------------------------------------------|
| **Ort** | blaues Info-Panel **über** der Periodenliste | eigener Block **unter** der Periodenliste, getrennt durch `pt-6 border-t border-gray-200 dark:border-gray-700` |
| **Rahmung** | Info-Panel (blau) — harmlos | neutraler Block (`bg-gray-50 dark:bg-gray-800`, `border-gray-200 dark:border-gray-700`) mit eigener `text-lg`-Überschrift „Sonderfall: Die Werte waren von jeher falsch" |
| **Buttonstil** | `variant="secondary" size="sm"`, **ohne Icon** (unverändert aus Phase 12) | `variant="ghost" size="sm"` mit vorangestelltem `AlertTriangle` in amber-600/400 |
| **Wortwahl** | „Stundenwechsel", „ab Datum" | „korrigieren", „rückwirkend", „von jeher falsch" |
| **Dialog** | Titel „Stundenwechsel: …", kein Warnbanner, Vorschau blau **oder** amber je nach Stichtag | Titel „Periode korrigieren: …", **immer** ein Warnbanner ganz oben, das den betroffenen Zeitraum konkret nennt **und den Weg zurück zur harmlosen Aktion weist** (Satz 3) |
| **Bestätigung** | nur bei rückwirkendem Stichtag | immer, wenn die Periode die Vergangenheit berührt; `confirmText` benennt die Rückwirkung ausdrücklich |

**Entscheidungen dazu (vom Orchestrator entschieden):**

1. **Die Korrektur ist optisch leiser, ihr Weg dafür lauter.** Ein Ghost-Button in einem neutralen
   Block statt eines gefüllten amber-Knopfes. Begründung: Ein dauerhaft sichtbares amber-Panel würde
   die Warnfarbe entwerten — in Phase 12 bedeutet amber „das wirkt rückwirkend", also ein Zustand,
   nicht eine Dauerdekoration. Der Schutz vor Verwechslung entsteht durch Trennung, Sprache und den
   Pflichtweg über Warnbanner, Begründung und Bestätigung, nicht durch einen roten Knopf, an den man
   sich nach drei Tagen gewöhnt hat.
2. **Der Phase-12-Button bleibt unverändert (kein Icon).** Die Asymmetrie „ohne Icon / mit
   Warnsymbol" ist selbst ein Unterscheidungsmerkmal, und Phase 12 wird nicht nachträglich
   umgeschrieben.
3. **Kein „Tippen Sie zur Bestätigung den Zeitraum ab".** Ein solches Muster existiert nirgends in
   der Anwendung; es einzuführen hieße, einen zweiten Bestätigungsstil zu etablieren — genau das,
   was die Fortschreibung von Phase 12 untersagt. Der Schutz besteht stattdessen aus: Pflichtbegründung
   (≥ 10 Zeichen), servergerechneter Vorschau, Bestätigungsdialog mit konkretem Zeitraum und
   konkreter Saldoänderung.
4. **„Periode bearbeiten" und „Stammdaten korrigieren" sind dieselbe Aktion mit zwei Türen.**
   Beide öffnen `WorkTimePeriodEditModal.tsx`. Die Zeilenaktion heißt deshalb **„Korrigieren"** und
   nicht „Bearbeiten": Wer eine bestehende Periode ändert, korrigiert die Historie — dieselbe
   Bedeutung, dieselbe Warnung, derselbe Pflichtweg. Der Block-Button ist die Abkürzung; er öffnet
   den Dialog vorbelegt mit der **heute gültigen** Periode (existiert nur eine Periode, ist das die
   erste). Begründung: Zwei Dialoge für dieselbe fachliche Operation wären der zuverlässigste Weg,
   dass die beiden Varianten auseinanderdriften — und ein Admin, der „Bearbeiten" für harmlos hält,
   ist genau der Fehler, den REQ-30 verhindern will.

5. **Der Ausweg steht im Warnbanner, nicht nur im Einstiegsblock (Revision 2).** Der kürzeste Weg in
   den Korrektur-Dialog ist die Zeilenaktion „Korrigieren" — sie liegt in jeder Zeile der
   Periodenliste in Reichweite. Wer von dort kommt, hat den Abgrenzungssatz des Einstiegsblocks
   („Hat sich die Arbeitszeit ab einem Datum geändert, nehmen Sie oben …") **nie gelesen**; der steht
   ausschließlich unter der Liste. Das Warnbanner sagte in Revision 1 nur, *was passiert*, nicht,
   *was man stattdessen tun sollte*. Deshalb trägt es jetzt als Satz 3 den ausdrücklichen Ausweg —
   und zwar in **beiden** Panelvarianten, auch im Zukunftsfall, weil die Verwechslung dort genauso
   möglich ist. Eine Warnung ohne Alternative erzeugt Zögern, keine bessere Entscheidung.

---

## Bildschirme und Komponenten

### 1. `desktop/src/components/users/EditUserModal.tsx` — Einstiegspunkte

Aufbau des Abschnitts „Arbeitszeit & Berechtigungen" nach Phase 13, von oben nach unten:

| Reihenfolge | Inhalt | Herkunft |
|---|---|---|
| 1 | schreibgeschütztes Feld „Wochenstunden" + schreibgeschützter `WorkScheduleEditor` | Phase 12, unverändert |
| 2 | blaues Info-Panel mit Button „Stundenwechsel ab Datum …" | Phase 12, unverändert |
| 3 | Überschrift „Arbeitszeitmodell — Perioden" + `WorkTimePeriodList` **mit** `renderActions` | Phase 12 + Phase 13 |
| 4 | dauerhafte Fußnote zur ersten Periode (`text-xs`) | Phase 13 |
| 5 | Trennlinie `pt-6 border-t` + Block „Sonderfall: Die Werte waren von jeher falsch" mit Ghost-Button | Phase 13 |

Erfolgsbanner (grün, 8 s) erscheint an derselben Stelle wie in Phase 12, mit den Texten aus dem
Textbuch. Der Absende-Pfad des Modals sendet `weeklyHours`/`workSchedule` weiterhin unverändert aus
`user` — Phase 12, unverändert.

**z-Ebenen-Regel (Fortschreibung von Phase 12):**

| Ebene | Klasse | Was |
|-------|--------|-----|
| 1 | `z-50` (Default) | `EditUserModal` |
| 2 | `z-[60]` | `WorkTimeChangeModal`, `WorkTimePeriodEditModal`, **und** die Löschbestätigung, wenn sie direkt aus der Periodenliste geöffnet wird |
| 3 | `z-[70]` | jeder `ConfirmDialog`, der aus einer Ebene-2-Komponente heraus geöffnet wird (Korrekturbestätigung) |

### 2. `desktop/src/components/worktime/WorkTimePeriodEditModal.tsx` (neu)

Ablage unter `worktime/`, wie in Phase 12 festgelegt.

- `<Modal size="lg" zIndexClass="z-[60]" title="Periode korrigieren: {Vorname} {Nachname}">`
  → `max-w-2xl`, identische Breite zu `WorkTimeChangeModal`.
- Innen `<form className="space-y-6">`, Reihenfolge:

| Reihenfolge | Inhalt |
|---|---|
| 1 | Periodenkennung (`text-sm`, gray-600/400): „Periode vom … bis … · derzeit {X,X} h/Woche" |
| 2 | **Warnbanner** — amber, wenn die Periode die Vergangenheit berührt; blau („Keine Rückwirkung"), wenn sie vollständig in der Zukunft liegt. Nennt den Zeitraum immer konkret und enthält in beiden Varianten Satz 3 (Verweis auf „Stundenwechsel ab Datum …"). |
| 3 | Formularfehler-Banner (rot, nur bei `formError`) |
| 4 | `grid grid-cols-1 md:grid-cols-2 gap-6`: links `Input type="date"` **Gültig ab**, rechts `Input type="date"` **Gültig bis** (`readOnly`, `aria-readonly="true"`, gray-Styling wie das schreibgeschützte Stundenfeld aus Phase 12) |
| 5 | `Input type="number" min="0" max="60" step="0.5"` **Wochenstunden** |
| 6 | Überschrift „Tagesplan dieser Periode" + `WorkScheduleEditor` (voll bedienbar, `readOnly={false}`) |
| 7 | `Textarea` **Begründung**, `rows={4}`, `required`, Zeichenzähler |
| 8 | Vorschaupanel (Aufbau exakt wie `12-UI-SPEC.md` Abschnitt 3) |
| 9 | Aktionszeile `flex justify-end gap-3`: `Button variant="secondary"` „Abbrechen", `Button variant="primary"` mit kontextabhängigem Label |

**Feldregeln (vom Orchestrator entschieden):**
- **`validTo` ist nie direkt editierbar.** Es ergibt sich aus dem `validFrom` der Folgeperiode. Ein
  frei editierbares Ende wäre die einfachste Art, gegen REQ-22 (keine Lücke, keine Überlappung) zu
  verstoßen — und die Datenbanktrigger aus Phase 10 würden es ohnehin abweisen. Sichtbar bleibt es
  trotzdem, weil der Zeitraum die wichtigste Information des Dialogs ist.
- **Bei der ersten Periode ist `validFrom` gesperrt** (`readOnly`, Hilfstext aus dem Textbuch). Sie
  beginnt am Eintrittsdatum; ein späterer Beginn erzeugte eine Lücke ab dem Eintritt, ein früherer
  wäre fachlich falsch.
- Wird `validFrom` verschoben, zeigt die Vorschau den Zusatzsatz zur betroffenen Vorperiode. Diese
  Nebenwirkung erscheint **vor** dem Speichern, nicht danach.
- Die Begründung löst keine Neuberechnung der Vorschau aus. Jede Änderung an `validFrom`,
  Wochenstunden oder Tagesplan verwirft die Vorschau sofort und startet sie neu (400 ms entprellt) —
  Muster aus Phase 12.
- Kopplung an das Speichern über `previewToken` — unverändert aus Phase 12: ohne gültige Vorschau
  ist der Primärbutton gesperrt.
- Alle Serveraufrufe über `universalFetch` aus `../../lib/tauriHttpClient`.
- Keine Datumsberechnung über `toISOString().split('T')[0]`; Anzeige über
  `new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')`.

### 3. Aktionen in `WorkTimePeriodList.tsx` — über `renderActions`

Die Komponente wird **nicht umgebaut**. `EditUserModal` übergibt:

```
renderActions={(period) => …}
```

Inhalt der Aktionszelle (`px-4 py-3 text-right`, `flex items-center justify-end gap-2`):

| Fall | Inhalt |
|------|--------|
| Normale Periode | `Button variant="ghost" size="sm"` mit `Pencil` + „Korrigieren" · `Button variant="ghost" size="sm"` mit `Trash2` + „Löschen" in rot (Muster `CorrectionsTable.tsx`) |
| Erste Periode (`isFirst`) | nur „Korrigieren" · daneben ein **fokussierbarer Hinweis-Chip** `Info` + „Nicht löschbar" (`text-xs`, gray-500/400, `tabIndex={0}`, `role="note"`, `aria-label` mit dem vollen Erklärtext). Der Chip trägt zusätzlich `title` mit demselben vollen Erklärtext; ein anwendungsgezeichnetes Tooltip gibt es nicht — siehe Festlegung unten. |
| Löschen läuft für diese Zeile | „Löschen" wird zu `LoadingSpinner size="sm"`, beide Aktionen `disabled` |
| Kein Admin | `renderActions` wird gar nicht übergeben → die Spalte samt `<th>` entfällt (Phase-12-Verhalten) |

**Tooltip-Einblendung — kein eigenes Tooltip (Korrektur M-2, Phase 13).** Die in Phase 13
ursprünglich verlangte Ergänzung des Bestandsmusters aus `OvertimeTransactions.tsx` (eine
zusätzliche Reaktion auf Tastaturfokus neben der bestehenden Reaktion auf `hover`, plus ein
eigener ESC-Ausblendpfad) ist von Korrektur **M-2** desselben UI-Reviews bewusst verworfen
worden — begründet und im Quelltext vollständig dokumentiert
(`desktop/src/components/worktime/workTimePeriodActions.tsx:98-131`):

1. **Was gilt:** Kein anwendungsgezeichnetes Tooltip. Träger der Aussage sind das `aria-label`
   des Chips und die dauerhaft sichtbare Fußnote unter der Liste. Für den sehenden Mausnutzer
   tritt das browsergezeichnete `title` an seine Stelle — dasselbe Paar aus `aria-label` und
   `title` tragen die beiden Schaltflächen derselben Zelle bereits.
2. **Warum das frühere Muster verworfen wurde** (gemessen, nicht angenommen — 23.08.2026 in
   headless Edge, dieselbe Blink/WebView2-Engine wie Tauri unter Windows, Sichtbarkeit über
   `document.elementFromPoint()`): `overflow-x: auto` lässt `overflow-y` rechnerisch zu `auto`
   werden (gemessen: `computed overflow-y === 'auto'`) — der Container beschneidet also auch
   senkrecht. `top-6` ragt bei einer Zeile **54 px** unter den Container, die untere Hälfte ist
   nicht treffbar. `bottom-full mb-1` trägt **nur ab drei Zeilen** und ragt bei einer Zeile
   **56 px** über den Container hinaus — und genau dieser Fall ist der häufigste, weil die erste
   Periode wegen der DESC-Sortierung immer die letzte Zeile ist und ein Nutzer mit nur einer
   Periode genau eine Zeile hat, die zugleich `isFirst` ist.
3. **Was dabei verloren geht — ausdrücklich und ohne Beschönigung:** Chromium öffnet ein
   `title`-Tooltip bei **Tastaturfokus nicht**; ESC schließt es nicht; es liegt außerhalb des
   DOM und ist mit Playwright **nicht** beobachtbar (das ist der Grund, warum 13-U8 im
   Abnahmelauf als **NICHT PRÜFBAR** endete). Sehende Tastaturnutzer sehen die Erklärung damit
   nur über die dauerhaft sichtbare Fußnote, nicht am Chip selbst.
4. **Warum WCAG 2.2, 1.4.13 nicht mehr greift:** Das Kriterium „Content on Hover or Focus" gilt
   ausdrücklich **nicht** für Einblendungen des User Agents. Der frühere ESC-Ausblendpfad samt
   `stopPropagation()` entfällt deshalb ersatzlos.
5. **Gegenentscheidung möglich:** Dass sehende Tastaturnutzer die Erklärung nicht am Chip sehen,
   liegt dem Anwender als UAT-Punkt vor (siehe `14-UAT-SAMMLUNG.md`, Abschnitt „Phase 14.2") —
   der Anwender darf ein eigenes, nicht beschnittenes Tooltip verlangen.

**Keine ausgegraute Löschschaltfläche (vom Orchestrator entschieden).** Ein `disabled`-Button
erklärt nichts, ist mit der Tastatur nicht erreichbar und trägt seinen Tooltip unzuverlässig. Der
Grund steht deshalb zweifach in der Oberfläche: als fokussierbarer Chip in der Zeile und als
dauerhaft sichtbare Fußnote unter der Liste. Die Fußnote ist der Träger — sie ist ohne jede
Interaktion lesbar.

### 4. Löschbestätigung — `ConfirmDialog variant="danger"`, erweitert

Kein neuer Dialogtyp. `ConfirmDialog` bekommt fünf additive, optionale Props (Abschnitt
„Änderungen an Bestandskomponenten"). Aufbau:

| Reihenfolge | Inhalt |
|---|---|
| 1 | `title` „Periode löschen" mit `AlertTriangle` in red-600/400 (bestehendes `variant="danger"`-Verhalten) |
| 2 | `message` — welche Periode, welcher Zeitraum, welche Stunden, wessen |
| 3 | `details`: drei Punkte in einem `bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2`-Panel — Lückenschluss, Storno, Saldoänderung. Der dritte Punkt kommt aus der **Server-Vorschau**. |
| 4 | Fußzeile: `Button variant="ghost"` „Abbrechen" links, `Button variant="danger"` rechts (bestehende Reihenfolge aus `ConfirmDialog`) |

**Die Löschbestätigung lädt eine Server-Vorschau (vom Orchestrator entschieden).** Solange sie
läuft, ist der Bestätigungsknopf `disabled` und `details` zeigt „Auswirkung wird berechnet …".
Begründung: REQ-27 verlangt für den Stundenwechsel, dass die angezeigte Zahl die gebuchte ist. Ein
Löschvorgang mit größerer Tragweite darf nicht die einzige Stelle sein, an der ohne Zahl bestätigt
wird. Scheitert die Vorschau, wird nicht gelöscht — der Fehlertext samt „Erneut berechnen" steht in
`details`, der Bestätigungsknopf bleibt gesperrt.

Die drei Punkte stehen **immer** in dieser Reihenfolge: erst was mit der Kette passiert, dann was
mit der Buchung passiert, dann was mit der Zahl passiert. Der Storno-Punkt darf nicht ans Ende
rutschen — er ist die Aussage, die das Wort „löschen" korrigiert.

### 5. Kontoauszug — `desktop/src/components/worktime/OvertimeTransactions.tsx`

Erweiterung der bestehenden Komponente, kein neues Bauteil. Zusätzlich zu den Phase-12-Änderungen:

- Neues Feld je Transaktion: `reversalOf` (id der stornierten Buchung) bzw. `reversedBy` (id der
  Gegenbuchung), `reversedAt`, `reversedByName`, sowie das gemeinsame `referenceId`.
- **Zustands-Badge** neben dem Typ-Badge: „storniert" auf der Originalzeile, „Storno" auf der
  Gegenbuchung; beide grau (`bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`,
  `text-xs`, `rounded-full px-2 py-1`) — identisches Badge-Muster wie die bestehenden Typ-Badges.
- **Der Stundenwert der Originalzeile bleibt unverändert stehen** — kein Durchstreichen, keine
  Ausgrauung. Begründung: Das Journal ist ein Beleg; der Betrag wurde gebucht und ist gebucht
  geblieben. Neutralisiert hat ihn die Gegenbuchung, und die steht als eigene Zeile mit
  umgekehrtem Vorzeichen da. Ein durchgestrichener Betrag würde suggerieren, die Buchung sei
  zurückgenommen worden — genau die „bereinigte Lücke", die REQ-31 verbietet.
- **Beleg-Chip** in der Beschreibungszelle beider Zeilen, zweite Zeile, `text-xs`:
  `<button>` mit `Link2`-Icon und Text „Beleg #{referenceId}", Stil
  `text-gray-500 dark:text-gray-400 underline decoration-dotted hover:text-gray-700
  dark:hover:text-gray-200 focus:ring-2 focus:ring-blue-500 rounded`.
  Klick/Enter → die Partnerzeile wird per `scrollIntoView({ block: 'center' })` sichtbar gemacht und
  für 2 s mit `ring-2 ring-inset ring-gray-400 dark:ring-gray-500` hervorgehoben; zusätzlich erhält
  sie kurzzeitig den Fokus (`tabIndex={-1}` + `.focus()`), damit ein Screenreader den Sprung mitbekommt.
  Ist die Partnerzeile nicht auffindbar, erscheint stattdessen einer der **drei** Toasts aus dem
  Textbuch, ausgewählt nach der Tabelle weiter unten — kein stiller Klick ins Leere, in keinem der
  drei Fälle.

**Welches Datum die Storno-Zeile trägt (vom Orchestrator entschieden).** Die Spalte „Datum" der
Gegenbuchung trägt **denselben Wert wie das Original** — den Stichtag der gelöschten Periode
(`periodValidFrom`), nicht den Tag des Stornierens. Phase 12 legt das für die Modellwechsel-Buchung
bereits so fest; das Storno erbt es. Begründung: Das Löschen löst laut CONTEXT D4 eine Neuberechnung
ab `validFrom` aus — die Wirkung liegt dort, nicht heute. Der Tag des Stornierens geht dadurch nicht
verloren; er steht im Klartext in der zweiten Beschreibungszeile („Storniert am … von …").

**Folge, auf die sich der Beleg-Chip stützt:** Beide Zeilen tragen dasselbe Datum und fallen damit
**immer in denselben Zeitraumfilter**. Der Monats- oder Jahresfilter kann das Paar nicht
auseinanderreißen — entweder sind beide sichtbar oder keine. Der verbleibende reale Fehlfall ist
deshalb nicht der Filter, sondern die **Abschneidegrenze**: `OvertimeTransactions.tsx` hat
`limit = 50` als Default (Zeile 26), `ReportsPage.tsx` übergibt `limit={100}` (Zeile 350), und die
Fußzeile weist mit „• Maximal {limit} angezeigt" (Zeile 282) darauf hin. Der genutzte Endpunkt `/overtime/transactions/live`
sortiert nach `date DESC` plus Typ-Priorität (`overtimeLiveCalculationService.ts:416-422`) — nicht
nach `createdAt`. Da beide Zeilen dasselbe `date` tragen, stehen sie unmittelbar nebeneinander; der
Abschneidefall verengt sich darauf, dass der Schnitt genau zwischen die beiden fällt.

**Alle drei Fehlfälle sind textlich abgedeckt:**

| Fall | Wie erkannt | Reaktion |
|------|-------------|----------|
| Partnerzeile geladen | `id` in den geladenen Transaktionen gefunden | Sprung + 2 s Ring-Hervorhebung + kurzzeitiger Fokus |
| Partnerzeile nicht geladen, Abschneidegrenze erreicht | `id` nicht gefunden **und** `transactions.length >= limit` | Toast „… nur die letzten {limit} Buchungen …" |
| Partnerzeile außerhalb des Zeitraumfilters | `id` nicht gefunden und Liste **nicht** voll | Toast mit `{Monat JJJJ}`, wenn `month` gesetzt ist, sonst mit `{JJJJ}` |

**Der Jahresfilter ist der Normalfall, nicht der Sonderfall:** `ReportsPage.tsx` Zeile 41 hält
`selectedMonth` als `useState<number | undefined>(undefined)` — beim Öffnen ist also ein Jahr ohne
Monat gewählt. Ein Text mit dem Platzhalter `{Monat JJJJ}` wäre dort nicht befüllbar. Daher die
monatslose Variante.

**Warum drei Mittel für einen Bezug (vom Orchestrator entschieden):** Die angezeigte Liste ist nach
`date DESC` plus Typ-Priorität sortiert (`overtimeLiveCalculationService.ts:416-422`). Beide Zeilen
tragen dasselbe `date` und stehen damit benachbart — die Nachbarschaft allein trägt den Bezug aber
nicht: Sie geht verloren, sobald die Abschneidegrenze dazwischenfällt oder die Zeilen gedruckt bzw.
vorgelesen werden. Deshalb
trägt der Bezug (a) im Klartext („Storno zur Buchung vom …", „Storniert am … von …"), (b) als
gemeinsame Belegnummer auf beiden Zeilen und (c) als Sprungmarke. (a) und (b) funktionieren ohne
Interaktion, im Ausdruck und mit Screenreader; (c) ist die Bequemlichkeit obendrauf.

- **Bekannte, akzeptierte Einschränkung:** Liegt der Stichtag außerhalb des gewählten Zeitraums,
  erscheint **das ganze Paar** nicht — dasselbe Verhalten wie bei jeder anderen Buchung, kein
  Sonderweg für diesen Typ. Unterhalb der Abschneidegrenze kann eine der beiden Zeilen fehlen; dafür
  der erklärende Toast und der Klartextbezug in der sichtbaren Zeile. Der Kartenkopf zeigt
  weiterhin den Gesamtsaldo.

---

## Rollen- und Rechtezustände (CONTEXT D5)

| Nutzer | Sieht | Sieht nicht |
|--------|-------|-------------|
| Admin | Periodenliste mit Aktionsspalte, Korrekturblock, alle Dialoge, Kontoauszug jedes Nutzers inklusive Storno-Paaren | — |
| Mitarbeiter, eigener Kontoauszug | Modellwechsel-, Korrektur- und Storno-Zeilen im eigenen Auszug, lesend, mit Beleg-Chip und Klartextbezug | keine Periodenliste, keine Aktionsspalte, keinen Korrekturblock, keine Dialoge |
| Mitarbeiter, fremde Daten | den Zustand **„Kein Zugriff"** | jede Periodenangabe, jeden fremden Kontoauszug |

**Der Zustand „Kein Zugriff" ist nicht der Leerzustand.** Er hat eigenes Icon (`Lock`), eigene
Überschrift („Kein Zugriff auf die Arbeitszeit-Perioden") und einen Satz, der sagt, warum und was zu
tun ist. Der Leerzustand („Noch kein Stichtag hinterlegt") darf in diesem Fall nicht erscheinen — er
behauptete, es gäbe keine Daten, obwohl es sie gibt.

Darstellung: `bg-gray-50 dark:bg-gray-800`, `border border-gray-200 dark:border-gray-700`,
`rounded-lg p-4`, `Lock` in gray-500/400, Überschrift `text-sm font-semibold`, Body `text-sm`
gray-600/400.

**Eine graue Panelfläche, nicht zwei (vom Orchestrator entschieden).** Alle grauen Panels dieser
Phase — Korrekturblock, `details`-Panel der Löschbestätigung, Panel „Kein Zugriff", Platzhalter- und
Ladezustand der Vorschau — nutzen dasselbe Paar `bg-gray-50 dark:bg-gray-800` mit
`border-gray-200 dark:border-gray-700`. Das ist wortgleich das Phase-12-Panelmuster.
**Deklarierte Folge:** Im Dunkelmodus ist die Modalfläche selbst gray-800; die Panels heben sich dort
allein über den Rahmen ab, nicht über die Füllung. Das ist bewusst so übernommen — eine zweite,
dunklere Fläche (`dark:bg-gray-900/40`) hätte im selben Modal zwei verschiedene Grautöne für
dieselbe Bedeutung erzeugt und kommt im gesamten `desktop/src` nirgends vor.

**Warum grau und nicht rot (vom Orchestrator entschieden):** Rot ist in dieser Anwendung die Farbe
für „etwas ist schiefgegangen". Eine korrekt greifende Zugriffsregel ist kein Fehler und kein
Systemausfall; sie rot zu zeigen, lädt zum Melden eines Defekts ein. Der Unterschied zum Leerzustand
wird durch Schloss-Symbol, Überschrift und Text getragen, nicht durch Farbe. (`UserManagementPage.tsx`
zeigt „Zugriff verweigert" heute rot — dieser Bestand wird nicht angefasst, aber auch nicht kopiert;
die Abweichung ist hiermit deklariert.)

**Doppelmeldung vermeiden:** `desktop/src/api/client.ts` zeigt heute bei jedem Fehler außer 401 —
und außer 403 auf `/users` — einen roten Toast. Für die Perioden-Endpunkte würde das neben dem
Panel „Kein Zugriff" eine zweite, widersprechende Meldung erzeugen. Die Ausnahmeliste ist deshalb um
403 auf den Perioden-Endpunkten zu erweitern (dasselbe Muster wie `is403OnUsers`). Der TanStack-Query
für die Perioden läuft mit `retry: false` und ist für Nicht-Admins `enabled: false` — Muster aus
`useUsers.ts`.

**Die Oberfläche stellt die Regel nicht her, sie zeigt sie nur.** Die Durchsetzung liegt
serverseitig (CONTEXT D5); das Ausblenden von Knöpfen ist Bequemlichkeit, kein Schutz. Kommentar
nach dem Vorbild von `VacationTransactions.tsx` an den Kopf der betroffenen Komponenten.

---

## Zustände — vollständige Liste

Jeder Zustand ist umzusetzen; `.claude/CLAUDE.md` führt Loading/Error-States als Quality Gate.

| # | Zustand | Darstellung |
|---|---------|-------------|
| 1 | Periodenliste lädt | zentrierter `LoadingSpinner`, `py-8`; Aktionsspalte noch nicht sichtbar |
| 2 | Periodenliste Ladefehler | `AlertCircle` + „Perioden konnten nicht geladen werden: {Meldung}" in red-600/400; Korrekturblock bleibt sichtbar, aber sein Button ist `disabled` |
| 3 | **Kein Zugriff (403)** | graues Panel mit `Lock`, Überschrift und Erklärsatz; keine Aktionsspalte, kein Korrekturblock, kein globaler Fehler-Toast |
| 4 | Leerzustand (keine Periode) | Phase-12-Text „Noch kein Stichtag hinterlegt"; nur der Korrekturblock ist ohne Ziel und daher ausgeblendet |
| 5 | Korrektur-Dialog offen, Ausgangszustand | Warnbanner sichtbar, Felder mit den Ist-Werten der Periode vorbelegt, Vorschau leer, Primärbutton `disabled`, Fokus auf „Wochenstunden" (bei gesperrtem `validFrom`) bzw. auf „Gültig ab" |
| 6 | Vorschau lädt | graues Panel, `LoadingSpinner size="sm"` + „Vorschau wird berechnet …", `aria-busy="true"`, Primärbutton `disabled` |
| 7 | Vorschau bereit — rückwirkend | amberfarbenes Panel, Badge „Rückwirkend", Zeitraumsatz, Kennzahlen, hervorgehobene Saldoänderung; Primärbutton aktiv, Label „Korrektur rückwirkend speichern" |
| 8 | Vorschau bereit — Periode vollständig in der Zukunft | blaues Panel, Badge „Keine Rückwirkung", Primärbutton aktiv, Label „Korrektur speichern"; **kein** Bestätigungsschritt |
| 9 | Vorschau Fehler | rotes Panel + „Vorschau erneut berechnen", Primärbutton `disabled` |
| 10 | Vorschau veraltet (Token abgelehnt) | rotes Formularbanner mit dem Textbuch-Satz; Vorschau lädt automatisch neu, Primärbutton bis dahin gesperrt |
| 11 | Validierungsfehler „leere Begründung" | Feldfehler an der `Textarea` (`role="alert"` steckt in `Textarea`); Fokus springt auf das Feld; kein Serveraufruf |
| 12 | Validierungsfehler „Überlappung mit Nachbarperiode" | Feldfehler am Feld „Gültig ab" mit dem konkreten Nachbardatum; **zusätzlich** wird die betroffene Nachbarzeile in der Periodenliste mit `ring-2 ring-red-400` hervorgehoben (Muster aus Phase 12, Zustand 9) |
| 13 | Weitere Validierungsfehler | Feldfehler am jeweiligen Feld, Fokus auf das erste fehlerhafte Feld |
| 14 | Korrekturbestätigung offen | `ConfirmDialog variant="warning"` auf `z-[70]`; der Korrektur-Dialog bleibt sichtbar, aber nicht bedienbar |
| 15 | Korrektur speichern läuft | Primärbutton `disabled` mit `LoadingSpinner size="sm" className="mr-2"` + „Wird gespeichert …"; „Abbrechen" `disabled`; ESC und Backdrop schließen nicht |
| 16 | Korrektur fehlgeschlagen | rotes Banner am Kopf des Formulars: „Die Korrektur wurde nicht gespeichert. Es wurde nichts verändert. {Servermeldung}"; alle Eingaben und die Vorschau bleiben stehen |
| 17 | Korrektur erfolgreich | Dialog schließt; Toast; grünes Banner (8 s) im `EditUserModal`; Periodenliste, Stammdatenanzeige und Kontoauszug per Query-Invalidierung aktualisiert |
| 18 | Löschbestätigung offen, Auswirkung lädt | `ConfirmDialog variant="danger"`; `details` zeigt Punkt 1 und 2 bereits, Punkt 3 als „Auswirkung wird berechnet …"; Bestätigungsknopf `disabled` |
| 19 | Löschbestätigung bereit | alle drei Punkte gefüllt, Saldoänderung mit Vorzeichen, Farbe und Trendpfeil; Bestätigungsknopf aktiv |
| 20 | Löschvorschau fehlgeschlagen | Punkt 3 wird zum roten Fehlertext + Button „Erneut berechnen"; Bestätigungsknopf bleibt `disabled` |
| 21 | Löschen läuft | Bestätigungsknopf über `confirmLoading`: `disabled`, `LoadingSpinner size="sm" className="mr-2"` vor dem `confirmText`, Text „Wird gelöscht …"; „Abbrechen" und der X-Knopf über `cancelDisabled` **sichtbar deaktiviert** (`disabled:opacity-50 disabled:cursor-not-allowed` aus `Button`), ESC und Backdrop wirkungslos; die betroffene Zeile in der Liste zeigt statt der Aktionen einen `LoadingSpinner size="sm"` |
| 22 | Löschen fehlgeschlagen | Bestätigungsdialog bleibt offen; rotes Banner darin: „Die Periode wurde nicht gelöscht. Es wurde nichts verändert — weder die Periode noch der Kontoauszug. {Servermeldung}" |
| 23 | Löschen der ersten Periode serverseitig abgelehnt | wie 22, mit dem Text „Die erste Periode kann nicht gelöscht werden. Korrigieren Sie sie stattdessen." — Fall tritt nur bei umgangener Oberfläche auf, muss aber tragen |
| 24 | Erste Periode — nicht löschbar (Normalfall) | Aktionszelle ohne Löschknopf, mit fokussierbarem Chip „Nicht löschbar"; Fußnote unter der Liste dauerhaft sichtbar |
| 25 | Löschen erfolgreich | Dialog schließt; Toast „Periode gelöscht — Storno steht im Kontoauszug"; grünes Banner (8 s) mit dem neuen Ende der Vorperiode; Liste und Kontoauszug invalidiert; **kein** „Rückgängig"-Knopf |
| 26 | Kontoauszug: Storno-Paar sichtbar | zwei Zeilen, beide mit teal Typ-Badge, je einem grauen Zustands-Badge, gemeinsamem Beleg-Chip und Klartextbezug |
| 27 | Kontoauszug: Partnerzeile nicht geladen (Abschneidegrenze `limit`) | Klick auf den Beleg-Chip erzeugt den Toast „… nur die letzten {limit} Buchungen …"; die sichtbare Zeile bleibt hervorgehoben |
| 28 | Kontoauszug: Partnerzeile außerhalb des Zeitraumfilters | Klick auf den Beleg-Chip erzeugt den Toast mit `{Monat JJJJ}` bzw. — wenn kein Monat gewählt ist — mit `{JJJJ}`; die sichtbare Zeile bleibt hervorgehoben |

Der Abbruch-Weg (ESC, Backdrop, „Abbrechen") setzt den Korrektur-Dialog vollständig zurück —
inklusive Vorschau, Fehlern und `previewToken` — nach dem Muster `handleClose` aus
`OvertimeCorrectionModal.tsx`. Ausnahmen: Zustände 15 und 21, dort ist Abbrechen gesperrt.

---

## Änderungen an Bestandskomponenten

Vollständige Liste. Alles darüber hinaus bleibt unangetastet.

| Datei | Änderung | Art |
|-------|----------|-----|
| `desktop/src/components/ui/ConfirmDialog.tsx` | **fünf** neue optionale Props: `details?: ReactNode` (gerendert unter `message` in `CardContent`, `mt-4`) · `confirmDisabled?: boolean` (auf den Bestätigungsknopf, Zeile 82) · `confirmLoading?: boolean` (setzt zusätzlich `disabled` und rendert `<LoadingSpinner size="sm" className="mr-2" />` **vor** `confirmText`) · `cancelDisabled?: boolean` (auf den „Abbrechen"-Knopf Zeile 78–80 **und** den X-Knopf Zeile 64–69; unterdrückt außerdem ESC und Backdrop) · `closeOnConfirm?: boolean` (Default `true`; bei `false` schließt der Aufrufer selbst, weil der Dialog in den Zuständen 21/22 offen bleiben muss) | additiv, rückwärtskompatibel — alle fünf sind optional, jeder bestehende Aufruf verhält sich unverändert |
| `desktop/src/components/ui/ConfirmDialog.tsx` | `iconColors.warning` (Zeile 47) `text-yellow-600 dark:text-yellow-400` → `text-amber-600 dark:text-amber-400` | rein visuell, ohne Bestandsaufrufer — `variant="warning"` wird heute nirgends verwendet (geprüft 21.08.2026) |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` | `renderActions` wird gesetzt (Prop existiert bereits aus Phase 12) | keine Änderung an der Komponente |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` | neue optionale Props `accessDenied?: boolean` und `footnote?: ReactNode` für Zustand 3 und die Fußnote | additiv |
| `desktop/src/components/worktime/OvertimeTransactions.tsx` | Zustands-Badges, Beleg-Chip, Sprungmarke, zweite Beschreibungszeile für Storno-Paare | additiv |
| `desktop/src/components/users/EditUserModal.tsx` | Korrekturblock unter der Periodenliste, Fußnote, Dialog-/Bestätigungssteuerung, Erfolgsbanner-Texte | additiv |
| `desktop/src/api/client.ts` | **(1)** 403 auf den Perioden-Endpunkten von der globalen Fehler-Toast-Regel ausnehmen — Präzisierung unten. **(2)** Alle **42** `console.log`-Aufrufe entfernen (Zeile 18–50 Startup-Debugblock, 107–115 Request-Dump, 136–150 Response-Dump, 233–244 PUT-Pfad, 256–266 DELETE-Pfad; gezählt am 21.08.2026). Die 8 `console.error` in den Fehlerpfaden bleiben; `console.warn` kommt in der Datei nicht vor. | (1) verhaltensverengend, exakt begrenzt · (2) reines Streichen von Debugausgaben ohne Steuerfluss |

**403-Unterdrückung — Präzisierung.** `api/client.ts` Zeile 182 vergleicht heute **exakt**
(`endpoint === '/users'`), und `shouldShowToast` verengt sich dadurch nur — die bestehende Regel ist
sauber und wird nicht aufgeweicht. Zwei Dinge muss die Erweiterung dennoch beachten:

1. **Ein Gleichheitsvergleich kann die Perioden-Endpunkte nicht treffen.** Sie sind parametrisiert
   (`/users/{id}/work-time-periods` und darunter). Es braucht einen Präfix- oder Regex-Vergleich auf
   den Perioden-Pfad, kein `===`.
2. **Die Unterdrückung gilt auch für die schreibenden Endpunkte** (korrigieren, löschen, Vorschau) —
   sonst erschiene neben dem Formularbanner der Zustände 16 und 22 ein zweiter, roter Toast. Dass die
   Meldung dadurch nicht verlorengeht, ist ausdrücklich Teil der Festlegung: Für den 403-Fall führt
   das Textbuch den Satz „Ihnen fehlt die Berechtigung für diese Änderung. Es wurde nichts
   verändert.", und dieser Satz wird im **Formularbanner** des Korrektur-Dialogs bzw. im Bannerbereich
   der Löschbestätigung gezeigt. Wo kein Formular offen ist (reines Lesen), trägt das Panel
   „Kein Zugriff" die Aussage.

**Debugausgaben — Phase-12-Regel angewandt.** Phase 12 hat festgelegt: In Dateien, die eine Phase
ohnehin verändert, wird **jeder** `console.log` entfernt; `console.error` und `console.warn` in
Fehler- und Guard-Pfaden bleiben stehen. Diese Phase verändert `api/client.ts` und wendet die Regel
dort an — 42 Aufrufe. Das ist kein Aufräumfeldzug, sondern dieselbe Regel am selben Anlass.
Grundlage: `.claude/CLAUDE.md` Zeile 629 („Debug console.logs entfernt" als Pre-Commit-Quality-Gate)
und Zeile 571 („`console.log` in Production → Entfernen vor Commit"). Erschwerend kommt hinzu, dass
die Ausgaben in genau dieser Datei die **vollständigen Nutzdaten jeder Anfrage** in die
Browser-Konsole schreiben: Zeile 110 (`'📦 Body:', options?.body`), Zeile 233–237 und 244 (kompletter
PUT-Körper samt Ergebnis), Zeile 256–259 und 266 (DELETE-Körper samt Ergebnis) sowie Zeile 144
(`RAW RESPONSE TEXT`). In einer Personalverwaltung sind das Namen, E-Mail-Adressen, Abteilungen,
Positionen sowie Eintritts- und Austrittsdaten im Klartext.

**Kein Aufräumfeldzug.** Dateien, die diese Phase nicht ohnehin verändert, bleiben unberührt, auch
wenn sie `console.log` enthalten.

**Abhängigkeiten von Phase 12** — dort geliefert, hier nur gesetzt:

- `Modal` bringt `zIndexClass` mit und nimmt am **Modal-Stack** teil (`desktop/src/components/ui/modalStack.ts`
  mit `pushModal`/`popModal`/`isTopModal`; 12-UI-SPEC, Abschnitt „Modal-Stack"). Der Stack ist die
  Obermenge des in Revision 1 dieses Dokuments genannten Zählers: Er regelt zusätzlich, dass ESC und
  die Fokusfalle nur für die oberste Instanz greifen.
- `ConfirmDialog` bringt `zIndexClass` **ebenfalls aus Phase 12** mit und nimmt am selben Stack teil.
  Phase 13 führt die Prop also nicht ein, sondern setzt sie (`z-[60]` bzw. `z-[70]`) und ergänzt die
  fünf oben gelisteten Props.
- `WorkTimePeriodList` bringt `renderActions` mit.
- `WorkScheduleEditor` bringt `readOnly` mit (im Korrektur-Dialog auf `false`).

**Typerweiterung — ausdrücklich für den Planer.** Der in Phase 12 eingeführte Typ `WorkTimePeriod`
führt `id`, `validFrom`, `validTo`, `weeklyHours` und `workSchedule`. Die Verzweigung der
Aktionsspalte hängt an **`isFirst`**, die Badges „Aktuell"/„Geplant" hängen an **`isCurrent`**. Beide
Felder werden dem Typ in dieser Phase hinzugefügt und vom Server geliefert (siehe Datenvertrag). Sie
im Frontend aus der Liste abzuleiten wäre möglich, aber falsch, sobald die Liste je gefiltert,
begrenzt oder anders sortiert wird — dann wäre „die erste Zeile" nicht mehr „die erste Periode".

**Beobachtete, hier nicht behobene Altlasten** (vermerkt, damit sie nicht als neu eingeführter Mangel
gewertet werden): `OvertimeTransactions.tsx` typisiert die Transaktionen als `any` entgegen der
Strict-Mode-Regel; `EditUserModal.tsx` nutzt in Zeile 197, 216, 238 und 280 starre
`grid-cols-2`/`grid-cols-3` ohne Breakpoint. Beides liegt im Renderpfad bestehender Funktionen und
wird in dieser Phase bewusst nicht angefasst („NO REGRESSION"). Neuer Code dieser Phase führt keines
dieser Muster fort: keine neuen `console.log`, kein `any`, jedes neue Raster mit Breakpoint.

> **Entfallen gegenüber Revision 1:** Der Vermerk zu den beiden `console.log` in `ConfirmDialog.tsx`
> ist gegenstandslos — Phase 12 entfernt sie bereits. Dasselbe gilt für `EditUserModal.tsx` und
> `UserManagementPage.tsx`, deren Debugausgaben Phase 12 ebenfalls entfernt.

---

## Datenvertrag (was die Oberfläche vom Server erwartet)

Beschreibt die Erwartung der UI, nicht die Implementierung.

| Zweck | Erwartete Angaben |
|-------|-------------------|
| Periodenliste | je Periode: `id`, `validFrom`, `validTo\|null`, `weeklyHours`, `workSchedule`, **`isFirst`** (erste Periode ab `hireDate`), **`isCurrent`** (heute gültig). `isFirst` und `isCurrent` erweitern den Phase-12-Typ `WorkTimePeriod`. |
| Korrektur-Vorschau | `rangeFrom`, `rangeTo`, `workingDays`, `targetHoursBefore`, `targetHoursAfter`, `targetHoursDelta`, `balanceBefore`, `balanceAfter`, `balanceDelta`, `previousPeriod` (falls `validFrom` verschoben wird: `validFrom`, `weeklyHours`, `newValidTo`), `previewToken` |
| Lösch-Vorschau | `deletedPeriod`, `previousPeriod` (`validFrom`, `weeklyHours`, `newValidTo`), `reversedTransaction` (`id`, `date`, `hours`), `rebuildFrom`, `balanceBefore`, `balanceAfter`, `balanceDelta`, `previewToken` |
| Kontoauszug | zusätzlich je Transaktion: `id`, `referenceId`, `reversalOf\|null`, `reversedBy\|null`, `reversedAt\|null`, `reversedByName\|null`, `periodValidFrom`, `createdAt`, `createdByName` |
| Kontoauszug — Spalte „Datum" | gespeist aus **`date`**, und `date` trägt bei Modellwechsel-, Korrektur- **und Storno**-Buchungen den Stichtag der Periode (`periodValidFrom`), nicht `createdAt`. `createdAt` und `reversedAt` erscheinen ausschließlich im Klartext der zweiten Beschreibungszeile. |
| Rechte | 403 mit maschinenlesbarem Fehlerfeld für alle Perioden-Endpunkte (lesen, anlegen, korrigieren, löschen, Vorschau) |

---

## Responsive

Tauri-Desktopfenster; die realistische Untergrenze ist ein schmal gezogenes Fenster.
Breakpoints wie im Bestand: `sm` 640, `md` 768, `lg` 1024.

| Bereich | < 640 px | 640–767 px | ≥ 768 px |
|---------|----------|------------|----------|
| Modalbreite | `max-w-2xl` mit `p-4` Außenabstand — füllt die Breite | wie links | 672 px zentriert |
| Gültig ab + Gültig bis | untereinander (`grid-cols-1`) | untereinander | nebeneinander (`md:grid-cols-2`) |
| Tagesplan-Raster | 1 Spalte | 2 Spalten | 2 Spalten |
| Vorschau-Kennzahlen | untereinander (`grid-cols-1`) | 3 Spalten (`sm:grid-cols-3`) | 3 Spalten |
| Periodenliste inkl. Aktionsspalte | horizontal scrollbar (`overflow-x-auto`) | scrollbar | vollständig sichtbar |
| Zeilenaktionen | **nur Icons**, `p-2` (32 × 32 px), mit `aria-label` und `title`; Chip „Nicht löschbar" auf das `Info`-Icon reduziert, Erklärung über `aria-label` | Icon + Text | Icon + Text |
| Korrekturblock | Überschrift, Text und Button untereinander, Button `fullWidth` | Button rechtsbündig | Button rechtsbündig |
| Bestätigungsdialog | `max-w-md` mit `mx-4` (aus `Card`) | wie links | wie links |
| Aktionszeile im Dialog | Buttons nebeneinander, rechtsbündig, `gap-3` | wie links | wie links |

---

## Barrierefreiheit

- Fokus beim Öffnen des Korrektur-Dialogs: „Gültig ab" — bzw. „Wochenstunden", wenn „Gültig ab"
  gesperrt ist (erste Periode). Fokus darf nie auf einem `readOnly`-Feld landen.
- ESC schließt das oberste Modal; in den Zuständen 15 und 21 unterdrückt.
- Warnbanner und Vorschaupanel: `role="status" aria-live="polite" aria-busy={istLädt}`. Der Wechsel
  von „lädt" auf „fertig" wird angesagt, ohne den Fokus zu stehlen.
- Feldfehler über die `error`-Prop von `Input`/`Textarea` und damit mit `role="alert"`.
- Das schreibgeschützte Feld „Gültig bis" erhält `aria-readonly="true"` und bleibt lesbar
  (`readOnly`, nicht `disabled` — Kontrast ≥ 4,5:1 in beiden Modi, Regel aus Phase 12).
- Der Chip „Nicht löschbar" ist mit `tabIndex={0}` erreichbar und trägt seine vollständige Erklärung
  im `aria-label`. Die Einblendung ist browsergezeichnet (`title`, Korrektur M-2, Phase 13 —
  Begründung im Abschnitt „Aktionen in `WorkTimePeriodList.tsx`" oben): Chromium öffnet sie bei
  Tastaturfokus **nicht**, und ESC schließt sie **nicht**. Verbindlicher Träger der Aussage für
  **alle** Nutzergruppen ist deshalb die dauerhaft sichtbare Fußnote unter der Liste, ergänzt um
  das `aria-label` des Chips für Screenreader. Sehende Tastaturnutzer sehen die Erklärung damit
  nicht unmittelbar am Chip — dieser Verlust liegt dem Anwender als UAT-Punkt vor.
- Die Löschbestätigung nennt im `aria-label` des Bestätigungsknopfes die Periode:
  „Periode vom {TT.MM.JJJJ} löschen und stornieren".
- Der Beleg-Chip ist ein echtes `<button>` mit `aria-label`; nach dem Sprung erhält die Zielzeile
  kurzzeitig den Fokus, damit der Sprung angesagt wird.
- Farbe ist nie der alleinige Träger: Storno erkennt man am Badge-**Text** und am Klartextsatz, nicht
  an der Färbung; rückwirkend/nicht rückwirkend an Badge-Text, Icon und Zeitraumsatz; „Kein Zugriff"
  am Schloss-Symbol und an der Überschrift; positive/negative Stunden am Vorzeichen und Trendpfeil.
- Alle Bedienelemente sind in Lesereihenfolge mit der Tabulatortaste erreichbar; die Zeilenaktionen
  stehen im Tab-Fluss unmittelbar hinter der Zeile, auf die sie sich beziehen.
- Trefferflächen mindestens 24 × 24 px (WCAG 2.2 AA, 2.5.8); die Icon-Zeilenaktionen erreichen
  32 × 32 px.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | keine | nicht anwendbar — shadcn ist nicht initialisiert |
| Dritt-Registries | keine | nicht anwendbar — keine deklariert, `npx shadcn view` entfällt |

In dieser Phase kommt kein fremder Komponentencode ins Projekt. Neue Abhängigkeiten: **keine**.
Alle verwendeten Bausteine sind bestehende Projektkomponenten oder bereits installierte Pakete
(`lucide-react`, `sonner`, `@tanstack/react-query`).

---

## Herkunft der Festlegungen

| Quelle | Übernommene Entscheidungen |
|--------|----------------------------|
| `12-UI-SPEC.md` (bindend) | Spacing-Skala und Ausnahmen · vier Schriftgrößen, zwei Gewichte + zwei deklarierte Ausnahmen · Farbtabelle 60/30/10 · Semantik-Palette inkl. Teal für „Modellwechsel" · Modal-Aufbau (`size="lg"`, `space-y-6`, Reihenfolge der Formularblöcke) · Buttonreihenfolge „Abbrechen" links / Primär rechts · Fehlerdarstellung (Feldfehler + Kopfbanner) · `WorkTimePeriodList`-Aufbau und `renderActions`-Andockpunkt · `OvertimeTransactions`-Tabellen-, Badge- und Trendmuster · `previewToken`-Kopplung · Mindestlänge 10 Zeichen für die Begründung · z-Ebenen-Schema · Verbot von `toISOString().split('T')[0]` |
| `13-CONTEXT.md` | D1 zwei getrennte Aktionen mit eigener Warnung und Pflichtbegründung · D2 Soft-Delete plus Storno statt Löschen · D3 Lückenschluss durch die Vorperiode, erste Periode nicht löschbar · D4 Neuberechnung ab `validFrom` der betroffenen Periode · D5 Rollenprüfung serverseitig · D7 Pflichtbegründung · Specifics: Warnung nennt den Zeitraum konkret, Auszug zeigt zwei Zeilen mit erkennbarem Bezug · Deferred: kein Wiederherstellen |
| `REQUIREMENTS.md` | REQ-30 getrennte Korrektur-Aktion mit eigener Warnung und Pflichtbegründung · REQ-31 Periode bearbeitbar und löschbar, Buchungen storniert statt gelöscht, Storno-Geschichte sichtbar |
| `ROADMAP.md` Phase 13 | Erfolgskriterien → Zustände 19/25/26 (Löschen und Storno sichtbar), 11 (Korrektur ohne Begründung abgewiesen), 3 (Mitarbeiter sieht fremde Perioden nicht) |
| `.claude/CLAUDE.md` | Dark Mode Pflicht · responsive Breakpoints · Loading/Error States · `universalFetch` · Soft Delete statt Hard Delete · TypeScript strict, kein `any` |
| Codebestand | `ConfirmDialog`, `Modal`, `Button`, `Input`, `Textarea`, `Card`, `LoadingSpinner` · Zeilen-Löschmuster aus `CorrectionsTable.tsx` · Tooltip-Muster aus `OvertimeTransactions.tsx` · 403-Behandlung aus `useUsers.ts` und `api/client.ts` · Zugriffsregel-Kommentar aus `VacationTransactions.tsx` |
| Vom Orchestrator entschieden (Revision 1) | shadcn nicht initialisieren · ein Dialog für die Korrektur mit zwei Türen, Zeilenaktion heißt „Korrigieren" · Korrekturblock unter der Liste, neutral grau, Amber erst im Dialog · Phase-12-Button bleibt ohne Icon (Asymmetrie als Unterscheidungsmerkmal) · kein Type-to-confirm · `ConfirmDialog` erweitern statt zweiten Bestätigungsstil bauen · Löschbestätigung mit Server-Vorschau, Bestätigung bis dahin gesperrt · `validTo` nie editierbar, `validFrom` der ersten Periode gesperrt · erste Periode: fokussierbarer Chip + dauerhafte Fußnote statt ausgegrautem Knopf · Storno-Bezug über Klartext + gemeinsamen Beleg-Chip + Sprungmarke · Originalbetrag bleibt ungestrichen stehen · Zustands-Badges grau statt neuer Farbe · „Kein Zugriff" grau mit Schloss, nicht rot · 403 auf Perioden-Endpunkten vom globalen Fehler-Toast ausnehmen · kein „Rückgängig" im Erfolgs-Toast · Icon-only-Zeilenaktionen mit `p-2` unter 640 px |
| Vom Orchestrator entschieden (Revision 2) | Storno-Zeile trägt den Stichtag der Periode, nicht den Storno-Tag — dadurch kann der Zeitraumfilter das Paar nicht trennen · drei getrennte Fallback-Texte für den Beleg-Chip (Abschneidegrenze, Monatsfilter, Jahresfilter) · Ausweg-Satz im Warnbanner statt nur im Einstiegsblock · `confirmLoading` und `cancelDisabled` am `ConfirmDialog` statt eines zweiten Dialogstils · `iconColors.warning` von gelb auf amber angeglichen (kein Bestandsaufrufer) · eine einzige graue Panelfläche (`dark:bg-gray-800`), Trennung im Dunkelmodus über den Rahmen · visueller Anker der Löschbestätigung ist Punkt 3 · Token `sm+` (12 px) aus Phase 12 übernommen · vier Schriftgewichte ehrlich benannt · Präfix-/Regex-Vergleich für die 403-Unterdrückung, auch für schreibende Endpunkte · Phase-12-Debugausgaben-Regel auf `api/client.ts` angewandt (42 `console.log`) · Tooltip-Muster um eine Reaktion auf Tastaturfokus und ESC ergänzt (**überholt seit Revision 3**, siehe Abschnitt „Barrierefreiheit" — Korrektur M-2 hat diesen Weg zugunsten von `title` verworfen) · `isFirst`/`isCurrent` als Typerweiterung ausgewiesen |

---

## Abgrenzung

Nicht Teil dieser UI-SPEC:

- **Serverseitige Umsetzung.** Dieses Dokument beschreibt den Vertrag, den die Oberfläche einhält,
  und die Daten, die sie erwartet — nicht deren Berechnung, nicht die Endpunktpfade, nicht die
  Transaktionsklammer, nicht die Form der Gegenbuchung.
- **Wiederherstellen einer gelöschten Periode** („Undo des Undo") — laut `13-CONTEXT.md`
  ausdrücklich zurückgestellt. Die Oberfläche verspricht diesen Weg an keiner Stelle.
- **Testabdeckung, Generalprobe, Release** — Phase 14.
- **Massenpflege mehrerer Nutzer** — nicht angefragt.
- Bestehende Altlasten in `EditUserModal.tsx`, `OvertimeTransactions.tsx` und `ConfirmDialog.tsx`
  über die oben gelisteten additiven Änderungen hinaus.

---

## Revisionsvermerk

**Revision 2 — 21.08.2026.** Überarbeitung nach der Prüfung durch `gsd-ui-checker` (Ergebnis:
BLOCKED, zwei blockierende Befunde plus Empfehlungen). Kein Neuentwurf: Aufbau, Textbuch,
Rollenmatrix, die Auflösung „eine Aktion mit zwei Türen" und alle Entscheidungen aus Revision 1
bleiben unverändert bestehen.

| Befund | Behebung | Wo |
|--------|----------|-----|
| **B1** Beleg-Chip ohne Text für den häufigsten Fehlfall | Drei getrennte Fallback-Texte (Abschneidegrenze `limit`, Monatsfilter, Jahresfilter ohne Monat) samt Erkennungslogik als Tabelle; Zustand 27 in 27 und 28 aufgeteilt. Zusätzlich die fehlende Festlegung nachgeholt: Die Storno-Zeile trägt den **Stichtag der Periode**, nicht den Storno-Tag — dadurch kann der Zeitraumfilter das Paar nicht mehr trennen, und der verbleibende reale Fehlfall ist die Abschneidegrenze. | Textbuch „Kontoauszug", Abschnitt 5, Zustände 27/28, Datenvertrag |
| **B2** Zustand 21 mit der Änderungsliste nicht baubar | `ConfirmDialog` bekommt `confirmLoading?: boolean` (Spinner im Knopf) und `cancelDisabled?: boolean` (Abbrechen, X, ESC, Backdrop) zusätzlich zu `details`, `confirmDisabled` und `closeOnConfirm`. Zustand 21 nennt die Props ausdrücklich. | Änderungsliste, Zustand 21 |
| **Kern-Empfehlung REQ-30** Ausweg nur im Einstiegsblock sichtbar | Satz 3 im Warnbanner, in **beiden** Panelvarianten: abbrechen und „Stundenwechsel ab Datum …" nutzen. Als Begründung 5 aufgenommen, weil die Zeilenaktion der kürzeste Weg in den Dialog ist. | Textbuch „Korrektur-Dialog", Trenn-Tabelle, Begründung 5 |
| **E1** visueller Anker fehlt | Eigener Abschnitt: Anker des Korrektur-Dialogs ist die hervorgehobene Saldoänderung, Anker der Löschbestätigung ist Punkt 3 der `details`-Liste. | Abschnitt „Visueller Anker" |
| **E2** Warnfarbe gelb statt amber | `iconColors.warning` wird angeglichen; kein Bestandsaufrufer nutzt `variant="warning"` (geprüft). | Semantik-Palette, Änderungsliste |
| **E3** zweite graue Panelfläche | Alle grauen Panels nutzen `bg-gray-50 dark:bg-gray-800` (Phase-12-Muster). Die Folge — im Dunkelmodus trennt der Rahmen, nicht die Füllung — ist deklariert. | Rollen- und Rechtezustände, drei Fundstellen |
| **E4** Schriftgewichte beschönigt | Phase-12-Fassung übernommen: **vier** Gewichte, zwei frei gewählt, zwei bestandsgebunden, als Tabelle mit Einsatzorten. | Typography |
| **E5** „Spacing unverändert" trug nicht | Token `sm+` (12 px) aus Phase 12 übernommen; `px-4 py-3`, `gap-3` und `space-x-3` sind damit keine Ausnahmen mehr. Es bleiben die zwei Phase-12-Ausnahmen plus die neue 32-px-Trefferfläche. | Spacing Scale |
| **E6** `client.ts`-Ausnahme unpräzise | Präfix-/Regex-Vergleich statt `===` (die Endpunkte sind parametrisiert); die Unterdrückung gilt ausdrücklich auch für die schreibenden Endpunkte, dort trägt das Formularbanner die 403-Meldung. | Änderungsliste |
| **E7** `console.log` in `client.ts` | Phase-12-Regel angewandt: alle 42 `console.log` entfernt, `console.error` bleibt. Die Datei protokolliert heute vollständige PUT-/DELETE-Nutzdaten. | Änderungsliste |
| **E8** Chip-Tooltip nur hover | Ergänzung um eine Reaktion auf Tastaturfokus und ESC-Ausblendbarkeit (WCAG 2.2, 1.4.13) gefordert, Bestandsmuster ausdrücklich als unzureichend markiert. **Überholt seit Revision 3 (V-1, Phase 14.2, Plan 12, 26.08.2026):** Korrektur M-2 hat diesen Weg zugunsten eines browsergezeichneten `title` verworfen — siehe Abschnitt 3, Barrierefreiheit. | Abschnitt 3, Barrierefreiheit |
| **E9** `renderActions` braucht `isFirst` | Typerweiterung `isFirst`/`isCurrent` am Phase-12-Typ `WorkTimePeriod` ausgewiesen, mit Begründung gegen die Frontend-Ableitung. | Änderungsliste, Datenvertrag |
| **Streichungen** | `zIndexClass` wird von Phase 12 eingeführt und hier nur gesetzt (vereinheitlicht); „Zähler geöffneter Modale" → **Modal-Stack** mit `isTopModal`; der Altlast-Vermerk zu den `console.log` in `ConfirmDialog.tsx` ist entfallen, weil Phase 12 sie entfernt. | Änderungsliste |

Alle vom Prüfer genannten Quellcode-Fundstellen wurden vor der Übernahme selbst nachgeprüft und
trafen sämtlich zu: `ReportsPage.tsx` Zeile 41 und 350, `OvertimeTransactions.tsx` Zeile 26, 159,
227 und 282, `ConfirmDialog.tsx` Zeile 17–18, 47 und 78–83, `api/client.ts` Zeile 110, 182–189,
233–244 und 256–266. `12-UI-SPEC.md` wurde nicht verändert.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Nachträge aus Prüfdurchgang 2 (Orchestrator, 21.08.2026)

Der UI-Checker hat diese Spec in Durchgang 2 **abgenommen** (alle sechs Dimensionen PASS, beide
Blocker mit Quellcodebeleg geschlossen). Drei sachliche Fehler wurden direkt im Text korrigiert:
der abgeschnittene Satz zur ausgegrauten Löschschaltfläche, das Zahlwort „drei" bei den
`ConfirmDialog`-Props (es sind fünf) und die zweimalige Behauptung, die Liste sei nach
`createdAt DESC, id DESC` sortiert — der tatsächlich genutzte Endpunkt
`/overtime/transactions/live` sortiert nach `date DESC` plus Typ-Priorität
(`overtimeLiveCalculationService.ts:416-422`).

Die folgenden vier Punkte sind **beim Planen dieser Phase mitzuziehen**. Sie sind nicht
blockierend, aber jeder von ihnen wäre sonst eine Lücke im Vertrag.

### N-1 — Formulargrenzen aus Phase 12 gelten auch hier

`12-UI-SPEC.md` (Revision 3, Abschnitt „Formulargrenzen im verschachtelten Baum") legt fest: Ein
verschachtelter Dialog wird **außerhalb** des `<form>`-Elements von `EditUserModal` gerendert — als
Geschwister nach `</form>` —, sein `onSubmit` ruft zusätzlich zu `preventDefault()` auch
`stopPropagation()`, und `type="button"` ist für **jeden** Button im verschachtelten Teilbaum
zwingend. Grund: `createPortal` verlagert nur den DOM-Knoten, Ereignisse propagieren weiter entlang
des React-Baums.

Phase 12 erklärt die Regel ausdrücklich für generalisiert („Dasselbe gilt für jeden
`ConfirmDialog`, der aus diesem Baum geöffnet wird") und nennt „spätere Zeilenaktionen der
Periodenliste" beim Namen. Betroffen sind hier: der Ghost-Button „Stammdaten rückwirkend
korrigieren …", alle Zeilenaktionen der Periodenliste, `WorkTimePeriodEditModal` und **beide**
`ConfirmDialog`s dieser Phase. Die Abhängigkeitsliste zu Phase 12 ist entsprechend zu ergänzen.

### N-2 — Der X-Knopf des `ConfirmDialog` ist kein `Button`-Primitiv

`ConfirmDialog.tsx:64-69` rendert ein rohes `<button>`. Die in Zustand 21 zugesagten Klassen
`disabled:opacity-50 disabled:cursor-not-allowed` „aus `Button`" erreichen ihn nicht — er braucht
eigene Disabled-Klassen. Zusätzlich: Die Zusage „Backdrop wirkungslos" beschreibt ein Verhalten,
das `ConfirmDialog` heute gar nicht hat (Zeile 54 trägt keinen `onClick`). Defensiv richtig, aber
als solche zu kennzeichnen statt als Beschreibung des Bestands.

Ebenfalls zu markieren: `cancelDisabled` unterdrückt ESC per Prop, während `12-UI-SPEC.md` Regel 5
ausdrücklich „Kein `disableEscape`-Prop" festlegt. Die Abweichung ist vertretbar — ein stiller
Totknopf wäre schlechter —, aber sie ist eine Abweichung und gehört benannt.

### N-3 — Datenvertrag: `date` der Partnerzeile statt „Stichtag der Periode"

Die Storno-Zeile trägt laut Datenvertrag „den Stichtag der Periode (`periodValidFrom`)". Robuster
ist: **die Storno-Zeile trägt das `date` ihrer Partnerzeile.** Im angenommenen Fall (eine Buchung
je Periode) ist das identisch; falls eine korrigierte Periode je zwei zu stornierende Buchungen mit
verschiedenen Daten trägt, bleibt die Formulierung tragfähig, die andere nicht.

### N-4 — `api/client.ts`: die Green-Server-Probe gehört mit weg

Die Vorgabe „alle 42 `console.log` entfernen, 8 `console.error` bleiben" ist in den Zahlen exakt (am
Quellcode verifiziert), aber unvollständig: `client.ts:31-48` ist eine fest verdrahtete
Erreichbarkeitsprobe gegen `http://129.159.8.19:3001/api/health` (Green/Staging), die bei **jedem
Modulladen** feuert — also bei jedem App-Start jedes Anwenders, auch in Produktion. Ihr einziger
Zweck sind die zu entfernenden `console.log` in Zeile 41-43, plus **zwei der acht**
`console.error` (Zeile 46-47), die damit *nicht* in Fehlerpfaden liegen.

Streicht man nur die `console.log`, bleibt ein `.then(d => {})` mit leerem Rumpf, ein Netzaufruf an
eine Staging-IP bei jedem App-Start und ein rotes „❌ Green Server UNREACHABLE" in der Konsole jedes
Produktionsnutzers.

**Vorgabe:** Zeile 31-48 vollständig entfernen, oder hinter `import.meta.env.DEV` legen. Die
Formulierung „die 8 `console.error` in den Fehlerpfaden" ist auf „6 in Fehlerpfaden, 2 in der zu
entfernenden Green-Server-Probe" zu korrigieren.

Ein `console.debug` hinter einem Dev-Flag ist **nicht** nötig: `client.ts` spiegelt Anfrage, Antwort
und Fehler samt Nutzdaten ohnehin vollständig über `debugLog()` in den DebugPanel (Zeile 96-105,
160-167, 170-177, 201-207). Die Konsolenausgaben sind reine Dopplung. Der einzige diagnostisch
tragende Pfad ist der JSON-Parse-Fehler — der protokolliert über `console.error` (Zeile 152-156) und
bleibt erhalten.
