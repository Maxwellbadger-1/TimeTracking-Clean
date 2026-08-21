---
phase: 12
slug: stundenwechsel-bedienen
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-21
---

# Phase 12 — UI Design Contract

> Visueller und interaktiver Vertrag für „Stundenwechsel bedienen". Erstellt von `gsd-ui-researcher`,
> zu prüfen durch `gsd-ui-checker`, verbindlich für `gsd-planner` und `gsd-executor`.

**Kein Greenfield.** Die Anwendung läuft seit v1.0 (aktuell v1.8.0) mit einem etablierten
Erscheinungsbild. Dieses Dokument schreibt den Bestand fort. Wo ein Muster existiert, ist es
gesetzt; jede Abweichung ist unten ausdrücklich begründet.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **none** — kein shadcn, eigene Primitive unter `desktop/src/components/ui/` |
| Preset | not applicable |
| Component library | Eigene Primitive: `Modal`, `Card`, `Button`, `Input`, `Select`, `Textarea`, `ConfirmDialog`, `LoadingSpinner` |
| Styling | Tailwind CSS, `darkMode: 'class'`, `theme.extend` leer (nur Tailwind-Defaults) |
| Icon library | `lucide-react` ^0.294.0 (`@heroicons/react` ist ebenfalls installiert, wird in den betroffenen Komponenten aber nicht verwendet — hier ausschließlich lucide) |
| Font | Inter (Fallback Avenir, Helvetica, Arial, sans-serif), Basisgröße 16 px, `line-height: 24px` — aus `desktop/src/App.css` `:root` |
| Toasts | `sonner` ^1.2.0, montiert in `desktop/src/main.tsx` als `<Toaster position="top-right" richColors />` |
| Datums-/Zahlformat | `toLocaleDateString('de-DE')`, Stunden über `formatHours()` aus `desktop/src/utils/timeUtils.ts` (Format `H:MMh`) |

### shadcn-Gate — Entscheidung

`components.json` existiert nicht; der Stack ist React 19 + Vite + Tauri, also greift das Gate
formal. **Entscheidung (vom Orchestrator entschieden): shadcn wird NICHT initialisiert.**
Begründung: Die App hat eine vollständige, konsistente eigene Primitivschicht, die in dieser Phase
lediglich erweitert wird. Ein Designsystemwechsel mitten in einem laufenden Milestone verletzt das
Kernprinzip „NO REGRESSION" aus `.claude/CLAUDE.md` und stünde in keinem Verhältnis zum Umfang von
Phase 12 (ein Dialog, eine Liste, eine Journalzeile). Registry-Sicherheitsgate: **nicht anwendbar**,
da keine Registry genutzt wird.

---

## Spacing Scale

Aus dem Bestand abgeleitet (`Modal` `p-6`, `Card` `px-6 py-4`, Formulare `space-y-6`,
Feldgruppen `gap-4`). Alle Werte sind Vielfache von 4.

| Token | Tailwind | Value | Verwendung in dieser Phase |
|-------|----------|-------|----------------------------|
| xs | `gap-1`, `mt-1` | 4px | Abstand Icon↔Text, Hilfstext unter Feldern, Fehlermeldung unter Feld |
| sm | `gap-2`, `space-x-2` | 8px | Badge-Innenabstand, Zahl↔Trendpfeil, Zellinhalte |
| md | `gap-4`, `p-4`, `space-y-4` | 16px | Standardabstand zwischen Formularfeldern, Panel-Innenabstand (Vorschau, Hinweise) |
| lg | `p-6`, `space-y-6`, `pt-6` | 24px | Modal-Innenabstand, Abstand zwischen Formularblöcken, Abstand Formular↔Vorschau |
| xl | `mb-8` | 32px | Abstand Periodenliste↔restlicher Modalinhalt |
| 2xl | — | 48px | in dieser Phase nicht verwendet (Modale, keine Seitenlayouts) |
| 3xl | — | 64px | in dieser Phase nicht verwendet |

**Ausnahmen (bestandsgeführt, nicht neu erfunden):**
- `py-1.5` (6 px) und `py-2.5` (10 px) in `Button size="sm"` bzw. `Input` — Teil der bestehenden
  Primitive, wird nicht angefasst.
- Tabellenzellen `px-4 py-3` (16/12 px) — Muster aus `OvertimeTransactions.tsx`, die neue
  Journalzeile und die Periodenliste übernehmen es unverändert.
- `Input` hat eine feste Höhe `h-[42px]`. Alle Datums- und Zahlenfelder im neuen Dialog nutzen
  `Input` und erben diese Höhe; keine handgebauten Eingabefelder.

---

## Typography

Es gibt keine `theme.extend.fontSize` — es gelten die Tailwind-Defaults. Für diese Phase sind
**vier** Größen freigegeben, mehr nicht:

| Rolle | Klasse | Size | Weight | Line Height |
|-------|--------|------|--------|-------------|
| Hilfs-/Metatext (Badges, Hinweiszeilen, Fußnote) | `text-xs` | 12px | 400 | 16px (1,33) |
| Body / Label / Tabelleninhalt / Formularfeld | `text-sm` | 14px | 400 (Body) · 500 `font-medium` (Labels, Feldinhalt) | 20px (1,43) |
| Abschnittsüberschrift (`Was diese Umstellung bewirkt`, `Arbeitszeitmodell — Perioden`) | `text-lg` | 18px | 600 `font-semibold` | 28px (1,56) |
| Modaltitel (durch `Modal` gesetzt) | `text-xl` | 20px | 600 `font-semibold` | 28px (1,4) |

**Gewichte:** 400 (regulär) und 600 (`font-semibold`) sind der Vertrag.

**Deklarierte Ausnahmen** — bewusst, weil der Bestand sie führt und Abweichen hier eine Inkonsistenz
mitten in einer bestehenden Tabelle erzeugen würde:
1. `font-medium` (500) für Formularlabels und Eingabewerte — kommt fest aus `Input`, `Select`,
   `Textarea` und `Button`. Nicht änderbar, ohne alle Formulare der App anzufassen.
2. `font-bold` (700) **ausschließlich** für vorzeichenbehaftete Stundenwerte in Journal- und
   Vorschautabellen. `OvertimeTransactions.tsx` nutzt das für jede Betragsspalte; die neue
   Modellwechsel-Zeile steht direkt zwischen diesen Zeilen und muss gleich aussehen.
   Für die Vorschau gilt dieselbe Regel, damit die Zahl in der Vorschau optisch identisch mit der
   Zahl ist, die danach im Kontoauszug steht — das ist der Kern von REQ-27.

`text-base` (16px) wird in dieser Phase **nicht** verwendet. `Button size="md"` bringt es mit;
deshalb nutzen alle Buttons im neuen Dialog `size="md"` unverändert, aber es wird kein zusätzlicher
16-px-Fließtext eingeführt.

---

## Color

Alle Werte hell / dunkel. Dark Mode ist Pflicht (`.claude/CLAUDE.md` → Quality Gates).

| Rolle | Hell | Dunkel | Verwendung |
|-------|------|--------|------------|
| Dominant (60 %) | `#ffffff` (white) | `#1f2937` (gray-800) | Modalfläche, Kartenfläche, Tabellenhintergrund, Eingabefelder |
| Secondary (30 %) | `#f9fafb` / `#f3f4f6` (gray-50/100) · Text `#374151` (gray-700) · Linien `#e5e7eb` (gray-200) | `#111827` / `#374151` (gray-900/700) · Text `#d1d5db` (gray-300) · Linien `#374151` (gray-700) | Panel-Flächen, Trennlinien, Zeilen-Hover, Sekundärtext, schreibgeschützte Felder, Periodenliste |
| Accent (10 %) | `#2563eb` (blue-600) | `#3b82f6` (blue-500) | siehe Reservierungsliste |
| Destructive | `#dc2626` (red-600) | `#f87171` (red-400) | siehe Semantikliste |

### Accent ist reserviert für — abschließende Liste

1. Der **primäre Aktionsbutton** des Wechsel-Dialogs (`Button variant="primary"`) — genau einer je Dialog.
2. Der **Fokusring** auf Eingabefeldern und Buttons (`focus:ring-blue-500`).
3. Der **aktivierte Toggle** „Individueller Wochenplan" im `WorkScheduleEditor` (`bg-blue-600`).
4. Das **Info-Panel „Keine Rückwirkung"** bei einem Stichtag in der Zukunft
   (`bg-blue-50 dark:bg-blue-900/20`, Rahmen `border-blue-200 dark:border-blue-800`) —
   dasselbe Panel-Muster wie der Benutzername-Hinweis in `EditUserModal.tsx`.

**Accent ist ausdrücklich NICHT** für: Tabellenkopfzeilen, die Periodenliste, das Badge des
Modellwechsels, Abschnittsüberschriften, Zeilen-Hover, den Sekundärbutton oder „alle interaktiven
Elemente".

### Semantik-Palette (unverändert aus dem Bestand übernommen)

Diese Farben tragen in der App bereits feste fachliche Bedeutung. Sie werden nicht neu erfunden und
zählen nicht gegen die 10-%-Akzentquote, weil sie ausschließlich zustandsgebunden erscheinen.

| Bedeutung | Hell / Dunkel | Wo genau in dieser Phase |
|-----------|---------------|--------------------------|
| Gutschrift / positiver Saldo | green-600 / green-400 | positive Stundenwerte in Vorschau und Journalzeile, `TrendingUp`-Icon, Erfolgs-Toast |
| Belastung / negativer Saldo | red-600 / red-400 | negative Stundenwerte, `TrendingDown`-Icon |
| Fehler | red-600 / red-400 auf `bg-red-50` / `bg-red-900/20`, Rahmen `border-red-200` / `border-red-800` | Feldfehler (`Input error`-Prop), Vorschau-Fehlerbanner, Speicher-Fehlerbanner |
| Warnung / Tragweite | amber-600 / amber-400 auf `bg-amber-50` / `bg-amber-900/20`, Rahmen `border-amber-200` / `border-amber-800` | Vorschau-Panel bei **rückwirkendem** Stichtag, `ConfirmDialog variant="warning"` |
| Modellwechsel (neu) | teal-100/teal-700 hell, teal-900/30 + teal-300 dunkel | **nur** das Typ-Badge „Modellwechsel" im Überstunden-Kontoauszug |

**Begründung für Teal (vom Orchestrator entschieden):** `OvertimeTransactions.tsx` belegt bereits
blue (`earned`), amber (`feiertag`), orange (`compensation`), purple (`correction`), gray
(`carryover`, Abwesenheitstypen). Grün und Rot sind durch Gutschrift/Belastung besetzt. Teal ist der
einzige verbleibende Ton, der neben Purple in derselben Tabelle noch sicher unterscheidbar ist —
Indigo wäre von Purple und Blue nicht zuverlässig zu trennen.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (Stichtag in der Zukunft) | **Stundenwechsel speichern** |
| Primary CTA (Stichtag in der Vergangenheit) | **Rückwirkend speichern** |
| Einstiegs-Button in `EditUserModal` | **Stundenwechsel ab Datum …** |
| Empty state heading (Periodenliste) | **Noch kein Stichtag hinterlegt** |
| Empty state body (Periodenliste) | Für diesen Mitarbeiter gibt es bisher keine Periode mit Stichtag. Es gelten die Stammdatenwerte seit dem Eintrittsdatum. Über „Stundenwechsel ab Datum …" tragen Sie die erste Umstellung ein. |
| Error state (Vorschau) | **Die Vorschau konnte nicht berechnet werden.** Ohne Vorschau lässt sich der Wechsel nicht speichern. → Button „Vorschau erneut berechnen" |
| Error state (Speichern) | **Der Stundenwechsel wurde nicht gespeichert.** Es wurde nichts verändert. {Servermeldung} |
| Destructive confirmation | *Rückwirkend speichern*: siehe `ConfirmDialog`-Text unten. Löschaktionen gibt es in Phase 12 nicht — `Button variant="danger"` bleibt für Phase 13 reserviert. |

### Vollständiges Textbuch (deutsch, Umlaute korrekt)

**Einstieg in `EditUserModal.tsx`**

| Ort | Text |
|-----|------|
| Abschnittsüberschrift (bestehend) | Arbeitszeit & Berechtigungen |
| Hilfstext unter dem schreibgeschützten Feld „Wochenstunden" | Wird über „Stundenwechsel ab Datum …" geändert, damit vergangene Monate unberührt bleiben. |
| Hilfstext über dem schreibgeschützten `WorkScheduleEditor` | Der Tagesplan gehört zum Arbeitszeitmodell und wird zusammen mit dem Stichtag geändert. |
| Überschrift Periodenblock | Arbeitszeitmodell — Perioden |
| Erfolgsbanner nach dem Speichern (grün, 8 s, im Abschnitt „Arbeitszeit") | Stundenwechsel gespeichert: ab {TT.MM.JJJJ} gelten {X,X} h/Woche. |
| Erfolgs-Toast (sonner, `toast.success`) | Stundenwechsel gespeichert |
| Erfolgs-Toast bei Saldodifferenz ≠ 0 | Stundenwechsel gespeichert — Saldoänderung {±H:MMh} steht im Kontoauszug |

**Wechsel-Dialog**

| Ort | Text |
|-----|------|
| Modaltitel | Stundenwechsel: {Vorname} {Nachname} |
| Label Stichtag | Stichtag |
| Hilfstext Stichtag | Ab diesem Tag gilt das neue Modell. Ein Datum in der Vergangenheit ist erlaubt — dann wird ab dort neu gerechnet. |
| Label Wochenstunden | Neue Wochenstunden |
| Hilfstext Wochenstunden | 0 h = Aushilfe (alle erfassten Stunden zählen als Überstunden) |
| Überschrift Tagesplan | Neuer Tagesplan |
| Label Begründung | Begründung |
| Platzhalter Begründung | Warum wird umgestellt? Zum Beispiel: Neuer Arbeitsvertrag vom 12.06.2026, Reduzierung auf Teilzeit (mindestens 10 Zeichen) |
| Zähler unter der Begründung | {n}/10 Zeichen (Minimum) |
| Sekundärbutton | Abbrechen |

**Vorschaupanel**

| Ort | Text |
|-----|------|
| Überschrift | Was diese Umstellung bewirkt |
| Platzhalter (Eingaben unvollständig) | Die Vorschau erscheint, sobald Stichtag und neue Wochenstunden gesetzt sind. |
| Ladezustand | Vorschau wird berechnet … |
| Badge Zukunft | Keine Rückwirkung |
| Zeitraumsatz Zukunft | Wirksam ab {TT.MM.JJJJ}. Bis dahin ändert sich keine Minute. |
| Badge Vergangenheit | Rückwirkend |
| Zeitraumsatz Vergangenheit | Neu gerechnet wird vom {TT.MM.JJJJ} bis heute ({TT.MM.JJJJ}) — {n} Arbeitstage. Alles vor dem {TT.MM.JJJJ} bleibt unverändert. |
| Zeile Sollstunden | Sollstunden im Zeitraum · bisher {H:MMh} · neu {H:MMh} · Differenz {±H:MMh} |
| Zeile Saldo | Überstundensaldo heute {±H:MMh} → nach der Umstellung {±H:MMh} |
| Hervorgehobene Zahl | Änderung des Überstundensaldos: {±H:MMh} |
| Fußnote (REQ-28, immer sichtbar) | Der bereits angesparte Saldo wird nicht umgerechnet — Stunden bleiben Stunden. Die Änderung entsteht allein daraus, dass im neu gerechneten Zeitraum ein anderes Tagessoll gilt. |
| Hinweis bei Stichtag mitten im Monat | Der Stichtag liegt innerhalb des Monats {Monat JJJJ}. Für {TT.MM.} bis Monatsende gilt bereits das neue Modell, davor das alte. |
| Fehlerbanner | Die Vorschau konnte nicht berechnet werden. Ohne Vorschau lässt sich der Wechsel nicht speichern. |
| Button im Fehlerbanner | Vorschau erneut berechnen |

**Bestätigung bei rückwirkendem Stichtag (`ConfirmDialog variant="warning"`)**

| Feld | Text |
|------|------|
| `title` | Rückwirkende Umstellung bestätigen |
| `message` | Für {Vorname} {Nachname} wird der Zeitraum vom {TT.MM.JJJJ} bis heute neu gerechnet. Der Überstundensaldo ändert sich dabei um {±H:MMh} — von {±H:MMh} auf {±H:MMh}. Buchung und Begründung bleiben im Kontoauszug dauerhaft sichtbar. |
| `message`-Variante bei Differenz = 0 | Für {Vorname} {Nachname} wird der Zeitraum vom {TT.MM.JJJJ} bis heute neu gerechnet. Der Überstundensaldo bleibt dabei unverändert. Die Periode wird trotzdem als eigener Eintrag festgehalten. |
| `confirmText` | Ja, rückwirkend umstellen |
| `cancelText` | Zurück zur Vorschau |

**Fehlermeldungen (Validierung)**

| Auslöser | Meldung |
|----------|---------|
| Stichtag leer | Stichtag ist erforderlich |
| Stichtag vor Eintrittsdatum | Der Stichtag darf nicht vor dem Eintrittsdatum ({TT.MM.JJJJ}) liegen. |
| Stichtag gleich einer bestehenden Periode | Zum {TT.MM.JJJJ} existiert bereits eine Periode. Wählen Sie ein anderes Datum. |
| Stichtag nach einem hinterlegten Austrittsdatum | Der Stichtag liegt nach dem Austrittsdatum ({TT.MM.JJJJ}). |
| Wochenstunden leer oder keine Zahl | Wochenstunden sind erforderlich |
| Wochenstunden außerhalb 0–60 | Wochenstunden müssen zwischen 0 und 60 liegen |
| Begründung leer | Begründung ist erforderlich |
| Begründung kürzer als 10 Zeichen | Begründung muss mindestens 10 Zeichen lang sein |
| Neue Werte identisch mit der gültigen Periode | Die neuen Werte entsprechen der aktuell gültigen Periode. Es gibt nichts umzustellen. |
| Tagesplansumme weicht von Wochenstunden ab (**Warnung, blockiert nicht**) | Summe weicht von den Wochenstunden ({X,X} h) ab! — bestehender Text aus `WorkScheduleEditor.tsx`, unverändert |
| Vorschau veraltet (Server lehnt Token ab) | Die Vorschau ist nicht mehr aktuell. Sie wurde neu berechnet — bitte prüfen Sie die Werte und speichern Sie erneut. |

**Kontoauszug (Überstunden-Journal)**

| Ort | Text |
|-----|------|
| Typ-Badge | Modellwechsel |
| Typ-Tooltip (`getTypeDescription`) | Saldodifferenz aus einer rückwirkenden Umstellung des Arbeitszeitmodells |
| Beschreibung | Stundenwechsel ab {TT.MM.JJJJ}: {X,X} → {Y,Y} h/Woche (Grund: {Begründung}) |
| Zweite Zeile unter der Beschreibung (`text-xs`, gray-500/400) | Periode ab {TT.MM.JJJJ} · eingetragen am {TT.MM.JJJJ} von {Admin-Name} |

Die Begründung ist Freitext eines Menschen und wird **unverändert** durchgereicht — kein Trimmen,
kein Umformatieren von Datumsmustern darin. Das ist die Regel, die `VacationTransactions.tsx` in
`formatDescription()` ausdrücklich begründet; sie gilt hier genauso.

---

## Bildschirme und Komponenten

### 1. Einstiegspunkt — `desktop/src/components/users/EditUserModal.tsx`

Umsetzung von CONTEXT **D1**. Im Abschnitt „Arbeitszeit & Berechtigungen" ändert sich Folgendes:

- Das Feld **Wochenstunden** wird schreibgeschützt: `readOnly`, `tabIndex={-1}`, zusätzlich
  `className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 cursor-not-allowed
  hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"`.
  **Entschieden (vom Orchestrator): `readOnly`, nicht `disabled`.** Begründung: `Input` setzt bei
  `disabled` `opacity-50`; der Wert wäre kaum noch lesbar, obwohl er die wichtigste Information des
  Blocks ist. `readOnly` hält den Wert lesbar und den Kontrast über 4,5:1.
- Der `WorkScheduleEditor` bekommt eine neue optionale Prop `readOnly?: boolean`. Bei `true` sind
  Toggle und alle Tagesfelder nicht bedienbar (`disabled`, `cursor-not-allowed`), die Summenkarte
  bleibt sichtbar. Sichtbarer Schnitt für Phase 13: dieselbe Prop steuert später auch die Ansicht
  in „Stammdaten korrigieren".
- Unmittelbar darunter ein Hinweispanel im bestehenden Blau-Muster
  (`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4`)
  mit dem Hilfstext aus dem Textbuch und rechtsbündig dem Button
  `<Button type="button" variant="secondary" size="sm">Stundenwechsel ab Datum …</Button>`.
  `type="button"` ist zwingend, sonst löst er den Submit des umgebenden Formulars aus.
- Darunter die **Periodenliste** (Abschnitt 4), getrennt durch
  `pt-6 border-t border-gray-200 dark:border-gray-700` — dasselbe Trennmuster, das
  `EditUserModal.tsx` bereits zwischen seinen Blöcken verwendet.
- Der Absende-Pfad des Modals sendet `weeklyHours` und `workSchedule` weiterhin mit, aber
  unverändert aus `user` — nicht aus dem Formularzustand. So kann „Änderungen speichern" das
  Arbeitszeitmodell nicht mehr still überschreiben.

**Verschachtelung der Modale.** Der Wechsel-Dialog öffnet sich **über** dem `EditUserModal`, das
geöffnet bleibt. Damit das trägt, sind zwei kleine Änderungen an `desktop/src/components/ui/Modal.tsx`
Teil dieser Phase:
1. Optionale Prop `zIndexClass?: string` (Default `'z-50'`); der Wechsel-Dialog nutzt `'z-[60]'`,
   der `ConfirmDialog` darüber `z-[70]`.
2. Ein modulweiter Zähler geöffneter Modale: `document.body.style.overflow` wird erst
   zurückgesetzt, wenn das letzte Modal schließt. Ohne das gibt das innere Modal beim Schließen den
   Seitenscroll frei, während das äußere noch offen ist.

**Begründung für die Verschachtelung (vom Orchestrator entschieden):** Die Alternative — das
`EditUserModal` zu schließen und den Dialog von `UserManagementPage` aus zu öffnen — verwirft die
übrigen, nicht gespeicherten Stammdatenänderungen des Admins. Ein verlorenes Formular ist der
schlechtere Handel als zwei überlagerte Ebenen.

### 2. Der Wechsel-Dialog — `desktop/src/components/worktime/WorkTimeChangeModal.tsx` (neu)

**Ablageort entschieden (vom Orchestrator):** `worktime/`, nicht `users/`. Die Fachdomäne ist das
Arbeitszeitmodell, und Phase 13 legt Bearbeiten/Löschen/Storno daneben. `users/` bliebe sonst der
Ort für Perioden-UI, obwohl dort nur Stammdaten wohnen.

- `<Modal size="lg" zIndexClass="z-[60]" title="Stundenwechsel: {Vorname} {Nachname}">`
  → `max-w-2xl`, gleiche Breite wie `EditUserModal` und `OvertimeCorrectionModal`.
- Innen ein `<form className="space-y-6">`, Struktur exakt nach dem Vorbild
  `OvertimeCorrectionModal.tsx`:

| Reihenfolge | Inhalt |
|---|---|
| 1 | Mitarbeiter-Infopanel (blau) mit Name, Eintrittsdatum und dem aktuell gültigen Modell: „Aktuell gültig seit {TT.MM.JJJJ}: {X,X} h/Woche" |
| 2 | Formularfehler-Banner (rot, nur bei `formError`) |
| 3 | `grid grid-cols-1 md:grid-cols-2 gap-6`: links `Input type="date"` **Stichtag**, rechts `Input type="number" min="0" max="60" step="0.5"` **Neue Wochenstunden** |
| 4 | Überschrift „Neuer Tagesplan" (`text-lg font-semibold`) + `WorkScheduleEditor` (voll bedienbar) |
| 5 | `Textarea` **Begründung**, `rows={4}`, `required`, mit Zeichenzähler |
| 6 | **Vorschaupanel** (Abschnitt 3) |
| 7 | Aktionszeile `flex justify-end gap-3`: `Button variant="secondary"` „Abbrechen", `Button variant="primary"` mit kontextabhängigem Label |

- Beim Öffnen wird der Tagesplan mit dem aktuell gültigen Plan des Nutzers vorbelegt und die
  Wochenstunden mit dem aktuell gültigen Wert. Der Stichtag ist **leer** — kein Vorbelegen mit
  „heute". Begründung: Ein vorbelegter Stichtag wird versehentlich stehen gelassen; ein leeres
  Pflichtfeld erzwingt eine bewusste Entscheidung, und der Stichtag ist die folgenreichste Eingabe
  des Dialogs.
- Alle Serveraufrufe laufen über `universalFetch` aus `../../lib/tauriHttpClient`
  (`.claude/CLAUDE.md`, Critical Rules — Browser-`fetch()` verliert in Tauri die Session-Cookies).
- Datumsberechnungen im Frontend **niemals** über `toISOString().split('T')[0]`. Für die Anzeige
  gilt das Muster `new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')` aus
  `OvertimeTransactions.tsx`/`VacationTransactions.tsx`.

### 3. Die Vorschau (REQ-27)

Die Werte kommen ausschließlich vom Server (CONTEXT **D2**). Es wird nichts im Frontend gerechnet —
auch keine Zwischensumme, auch keine „Differenz = neu − alt" auf Anzeigeebene. Die Vorschau
rendert, was der Server liefert.

**Auslösung:** automatisch, 400 ms entprellt, sobald Stichtag und Wochenstunden gültig sind; jede
Änderung an Stichtag, Wochenstunden oder Tagesplan verwirft die vorhandene Vorschau sofort und
startet neu. Die Begründung löst **keine** Neuberechnung aus.

**Kopplung an das Speichern (Kern von REQ-27):** Der primäre Button ist deaktiviert, solange keine
erfolgreiche Vorschau zu genau den aktuellen Eingaben vorliegt. Der Server gibt zur Vorschau ein
`previewToken` zurück; das Speichern schickt es mit. Weist der Server es als veraltet zurück, wird
nicht gespeichert, die Vorschau neu geladen und die Meldung „Die Vorschau ist nicht mehr aktuell …"
gezeigt. Damit kann die angezeigte Zahl konstruktionsbedingt nicht von der gebuchten abweichen.

**Panelvarianten:**

| Fall | Fläche | Icon | Badge |
|------|--------|------|-------|
| Stichtag heute oder in der Zukunft | `bg-blue-50 dark:bg-blue-900/20`, `border-blue-200 dark:border-blue-800` | `Info` (blue-600/400) | „Keine Rückwirkung" (blue) |
| Stichtag in der Vergangenheit | `bg-amber-50 dark:bg-amber-900/20`, `border-amber-200 dark:border-amber-800` | `AlertTriangle` (amber-600/400) | „Rückwirkend" (amber) |
| Fehler | `bg-red-50 dark:bg-red-900/20`, `border-red-200 dark:border-red-800` | `AlertCircle` (red-600/400) | — |
| Platzhalter / Ladezustand | `bg-gray-50 dark:bg-gray-800`, `border-gray-200 dark:border-gray-700` | `LoadingSpinner size="sm"` im Ladezustand | — |

Die beiden Fälle „Zukunft" und „Vergangenheit" **müssen sich unterschiedlich anfühlen**: andere
Flächenfarbe, anderes Icon, anderes Badge, anderer Zeitraumsatz, anderes Buttonlabel, und beim
rückwirkenden Fall zusätzlich der Bestätigungsschritt. Gleiche Darstellung für beide Fälle ist ein
Vertragsbruch, nicht eine Geschmacksfrage.

**Aufbau des Panels (immer in dieser Reihenfolge):**
1. Überschrift + Badge
2. Zeitraumsatz — nennt den Zeitraum ausdrücklich, nie nur eine Zahl
3. Sollstunden bisher / neu / Differenz als `grid grid-cols-1 sm:grid-cols-3 gap-4`
4. Saldo heute → Saldo nachher
5. Die hervorgehobene Saldoänderung: `text-lg font-bold`, grün bei ≥ 0, rot bei < 0, mit
   `TrendingUp`/`TrendingDown` — identisch zur Darstellung im Kontoauszug
6. Monatsmittiger Stichtag: Zusatzhinweis, falls zutreffend
7. Fußnote zu REQ-28

**Barrierefreiheit:** Das Panel ist `role="status" aria-live="polite" aria-busy={istLädt}`. Der
Wechsel von „lädt" auf „fertig" wird damit angesagt, ohne den Fokus zu stehlen.

**Randfall Differenz = 0 bei rückwirkendem Stichtag:** Der Zeitraumsatz erscheint trotzdem, die
Saldozeile zeigt „± 0:00h" in gray-600/400, und der Bestätigungsschritt läuft mit der
Nulldifferenz-Variante des Textes. Kein stilles Überspringen — der Anwender soll sehen, dass
rückwirkend gerechnet wurde.

### 4. Die Periodenliste — `desktop/src/components/worktime/WorkTimePeriodList.tsx` (neu)

Kompakte Tabelle, **keine** `Card` — sie steht im Modal, eine Karte im Modal doppelt den Rahmen.

| Spalte | Ausrichtung | Inhalt |
|--------|-------------|--------|
| Gültig ab | links | `TT.MM.JJJJ` |
| Gültig bis | links | `TT.MM.JJJJ` oder „—" (offen) |
| Wochenstunden | rechts | `{X,X} h` |
| Tagesplan | links | „Standard (5 Tage)" oder kompakt „Mo 8 · Di 8 · Mi 8 · Do 8 · Fr 2" (Tage mit 0 h entfallen) |
| *(Aktionen)* | rechts | **In Phase 12 nicht vorhanden** |

**Schnitt für Phase 13 (vom Orchestrator entschieden):** Die Komponente nimmt eine optionale Prop
`renderActions?: (period: WorkTimePeriod) => ReactNode`. Ist sie nicht gesetzt, wird die
Aktionsspalte samt `<th>` **gar nicht gerendert** — keine leere Spalte, kein Platzhalter. Phase 13
reicht die Prop nach und ändert sonst nichts an der Tabelle.

- Zeilenstil: `divide-y divide-gray-200 dark:divide-gray-700`, Hover
  `hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`, Zellen `px-4 py-3 text-sm` —
  alles wortgleich aus `OvertimeTransactions.tsx`.
- Badges in der Spalte „Gültig ab": „Aktuell" für die heute gültige Periode, „Geplant" für Perioden
  mit Beginn in der Zukunft. Sonst kein Badge. **Beide** Badges nutzen dieselbe neutrale Färbung
  `bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300` und unterscheiden sich allein
  durch den Text — die Periodenliste gehört ausdrücklich nicht zu den vier freigegebenen
  Accent-Einsätzen.
- Sortierung: `validFrom` **absteigend** — die jüngste Umstellung steht oben, das ist die, um die es
  beim Öffnen geht.
- Zustände: Ladezustand `LoadingSpinner` zentriert mit `py-8`; Fehlerzustand
  `AlertCircle` + „Perioden konnten nicht geladen werden: {Meldung}" in red-600/400;
  Leerzustand mit dem Textbuch-Eintrag oben.
- Umbruch: `<div className="overflow-x-auto">` um die Tabelle, wie im Bestand.

### 5. Sichtbarkeit im Kontoauszug (REQ-29) — `desktop/src/components/worktime/OvertimeTransactions.tsx`

Erweiterung der bestehenden Komponente, kein neues Bauteil:

- Neuer Typ `model_change` in `getTypeLabel` → „Modellwechsel", in `getTypeDescription` →
  „Saldodifferenz aus einer rückwirkenden Umstellung des Arbeitszeitmodells", in
  `getTypeBadgeColor` → `bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300`.
- `isAbsenceType` bleibt unberührt — die Zeile zeigt einen echten Stundenwert mit Vorzeichen,
  Trendpfeil und `font-bold`, genau wie `earned` und `correction`.
- Die Spalte **Datum** trägt den **Stichtag** der Periode, nicht den Eintragungstag. Die Liste ist
  nach `createdAt DESC, id DESC` sortiert (Phase-8-Entscheidung); deshalb bekommt die
  Beschreibungszelle eine zweite Zeile in `text-xs text-gray-500 dark:text-gray-400` mit
  „Periode ab {TT.MM.JJJJ} · eingetragen am {TT.MM.JJJJ} von {Admin}". Ohne diese Zeile wirkt eine
  rückdatierte Buchung an ihrer Listenposition unerklärlich.
- **Bekannte, akzeptierte Einschränkung:** Wird im Bericht ein Monat/Jahr gefiltert, in dem der
  Stichtag nicht liegt, erscheint die Zeile nicht — dasselbe Verhalten wie bei jeder anderen
  Buchung. Der Saldo im Kopf der Karte bleibt der Gesamtsaldo. Kein Sonderweg für diesen Typ.

---

## Zustände — vollständige Liste

Jeder Zustand ist umzusetzen; `.claude/CLAUDE.md` führt Loading/Error-States als Quality Gate.

| # | Zustand | Darstellung |
|---|---------|-------------|
| 1 | Dialog öffnet, Stammdaten laden | Modal öffnet sofort, Infopanel und Periodenliste zeigen je einen zentrierten `LoadingSpinner` (`py-8`); Formularfelder sind bedienbar, Primärbutton deaktiviert |
| 2 | Periodenliste Fehler | `AlertCircle` + „Perioden konnten nicht geladen werden: {Meldung}" in red-600/400; Dialog bleibt bedienbar, Speichern bleibt gesperrt |
| 3 | Vorschau noch nicht möglich | Graues Platzhalterpanel, Text „Die Vorschau erscheint, sobald Stichtag und neue Wochenstunden gesetzt sind.", Primärbutton deaktiviert |
| 4 | Vorschau lädt | Graues Panel, `LoadingSpinner size="sm"` + „Vorschau wird berechnet …", `aria-busy="true"`, Primärbutton deaktiviert |
| 5 | Vorschau Fehler | Rotes Panel + Button „Vorschau erneut berechnen", Primärbutton deaktiviert |
| 6 | Vorschau bereit — Stichtag Zukunft | Blaues Panel, Badge „Keine Rückwirkung", Primärbutton aktiv, Label „Stundenwechsel speichern" |
| 7 | Vorschau bereit — Stichtag Vergangenheit | Bernsteinfarbenes Panel, Badge „Rückwirkend", Primärbutton aktiv, Label „Rückwirkend speichern" |
| 8 | Validierungsfehler | Fehler am jeweiligen Feld über die `error`-Prop (`role="alert"` steckt bereits in `Input`/`Textarea`); Fokus springt auf das erste fehlerhafte Feld; kein Serveraufruf |
| 9 | Stichtag überlappt bestehende Periode | Feldfehler am Stichtag; die betroffene Zeile in der Periodenliste wird mit `ring-2 ring-red-400` hervorgehoben, damit klar ist, welche Periode gemeint ist |
| 10 | Bestätigung offen (nur rückwirkend) | `ConfirmDialog variant="warning"` über dem Dialog (`z-[70]`); der Wechsel-Dialog bleibt sichtbar, aber nicht bedienbar |
| 11 | Speichern läuft | Primärbutton `disabled` mit `LoadingSpinner size="sm" className="mr-2"` + „Wird gespeichert …"; Abbrechen ebenfalls `disabled`; Modal lässt sich nicht per ESC oder Backdrop schließen |
| 12 | Speichern fehlgeschlagen | Rotes Banner am Kopf des Formulars: „Der Stundenwechsel wurde nicht gespeichert. Es wurde nichts verändert. {Servermeldung}"; alle Eingaben bleiben erhalten; Vorschau bleibt stehen |
| 13 | Vorschau veraltet (Token abgelehnt) | Wie 12, Text „Die Vorschau ist nicht mehr aktuell. Sie wurde neu berechnet — bitte prüfen Sie die Werte und speichern Sie erneut."; Vorschau lädt automatisch neu, Primärbutton bis dahin gesperrt |
| 14 | Erfolg | Dialog schließt; `toast.success(...)`; im `EditUserModal` erscheint 8 s lang ein grünes Banner; Periodenliste und Stammdatenanzeige sind über TanStack-Query-Invalidierung aktualisiert |

Der Abbruch-Weg (ESC, Backdrop, „Abbrechen") setzt das Formular vollständig zurück — inklusive
Vorschau, Fehlern und `previewToken` — nach dem Muster von `handleClose` in
`OvertimeCorrectionModal.tsx`. Ausnahme: Zustand 11, dort ist Abbrechen gesperrt.

---

## Responsive

Die App läuft als Tauri-Desktopfenster; die realistische Untergrenze ist ein schmal gezogenes
Fenster, nicht ein Telefon. Breakpoints wie im Bestand: `sm` 640, `md` 768, `lg` 1024.

| Bereich | < 640 px | 640–767 px | ≥ 768 px |
|---------|----------|------------|----------|
| Modalbreite | `max-w-2xl` mit `p-4` Außenabstand (aus `Modal`) — füllt die Breite | wie links | 672 px zentriert |
| Stichtag + Wochenstunden | untereinander (`grid-cols-1`) | untereinander | nebeneinander (`md:grid-cols-2`) |
| Tagesplan-Raster | 1 Spalte | 2 Spalten | 2 Spalten |
| Vorschau Sollstunden-Kennzahlen | untereinander (`grid-cols-1`) | 3 Spalten (`sm:grid-cols-3`) | 3 Spalten |
| Periodenliste | horizontal scrollbar (`overflow-x-auto`) | scrollbar | vollständig sichtbar |
| Aktionszeile | Buttons nebeneinander, rechtsbündig, `gap-3` | wie links | wie links |

**Eine Änderung am Bestand:** `WorkScheduleEditor.tsx` nutzt heute ein festes `grid-cols-2`; das
wird zu `grid-cols-1 sm:grid-cols-2`. Verbessert beide Einsatzorte, ändert oberhalb von 640 px
nichts und ist damit regressionsfrei.

**Beobachtete, hier nicht behobene Altlast:** `EditUserModal.tsx` verwendet an mehreren Stellen
starre `grid-cols-2` und `grid-cols-3` ohne Breakpoint. Das ist außerhalb des Umfangs dieser Phase
und bleibt unangetastet — vermerkt, damit es nicht als neu eingeführter Mangel gewertet wird.

---

## Barrierefreiheit

- Beim Öffnen des Wechsel-Dialogs erhält das Feld **Stichtag** den Fokus.
- ESC schließt das oberste Modal — durch `Modal` bzw. `ConfirmDialog` bereits abgedeckt; in
  Zustand 11 unterdrückt.
- Vorschaupanel: `role="status" aria-live="polite" aria-busy`.
- Fehlermeldungen an Feldern kommen über die `error`-Prop und tragen dadurch `role="alert"`.
- Das schreibgeschützte Wochenstundenfeld bekommt `aria-readonly="true"` und behält seinen
  sichtbaren Wert (Kontrast ≥ 4,5:1 in beiden Modi — deshalb `readOnly` statt `disabled`).
- Farbe ist nie der alleinige Träger: Zukunft/Vergangenheit unterscheiden sich zusätzlich durch
  Badge-Text, Icon und Zeitraumsatz; positive/negative Stunden zusätzlich durch Vorzeichen und
  Trendpfeil.
- Alle Bedienelemente im Dialog sind über die Tabulatortaste in Lesereihenfolge erreichbar; der
  Einstiegs-Button in `EditUserModal` steht im Tab-Fluss unmittelbar nach dem schreibgeschützten
  Feld, auf das er sich bezieht.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | keine | nicht anwendbar — shadcn ist nicht initialisiert |
| Dritt-Registries | keine | nicht anwendbar |

In dieser Phase kommt kein fremder Komponentencode ins Projekt. Neue Abhängigkeiten: **keine**.
Alle verwendeten Bausteine sind bestehende Projektkomponenten oder bereits installierte Pakete
(`lucide-react`, `sonner`, `@tanstack/react-query`).

---

## Herkunft der Festlegungen

| Quelle | Übernommene Entscheidungen |
|--------|----------------------------|
| `12-CONTEXT.md` | D1 getrennte Aktion + schreibgeschützte Stundenfelder · D2 Vorschau vom Server · D3 begrenzter Rebuild-Zeitraum in der Vorschausprache · D4 keine Umrechnung, eine Buchung · D5 Buchungsmuster und Pflichtbegründung · D8 kein Release in dieser Phase · `universalFetch`-Pflicht · Kontoauszug als Ort der Sichtbarkeit · Zeitraum ausdrücklich benennen · Randfall Stichtag mitten im Monat |
| `REQUIREMENTS.md` | REQ-26 Stichtag auch rückwirkend · REQ-27 Vorschau vor dem Speichern mit deckungsgleichem Wert · REQ-28 kein Umrechnen des Saldos (Fußnote im Panel) · REQ-29 eigene Journalzeile mit Begründung und Periodenbezug |
| `ROADMAP.md` Phase 12 | Erfolgskriterien → Zustände 6/7, Zeitraumsatz, Journalzeile |
| `.claude/CLAUDE.md` | Dark Mode Pflicht · responsive Breakpoints · Loading/Error States · `universalFetch` · Verbot von `toISOString().split('T')[0]` · TypeScript strict, kein `any` |
| Codebestand | `Modal`, `Card`, `Button`, `Input`, `Select`, `Textarea`, `ConfirmDialog`, `LoadingSpinner` · Formularaufbau aus `OvertimeCorrectionModal.tsx` · Tabellen-, Badge- und Trendmuster aus `OvertimeTransactions.tsx` · Freitext-Behandlung aus `VacationTransactions.tsx` · Panelfarben aus `EditUserModal.tsx` · Toast-Konvention aus `useAbsenceRequests.ts` |
| Vom Orchestrator entschieden | shadcn nicht initialisieren · `readOnly` statt `disabled` · verschachtelte Modale mit `zIndexClass` und Scroll-Zähler · Ablage der neuen Komponenten unter `worktime/` · Teal für das Modellwechsel-Badge · Stichtag ohne Vorbelegung · automatische, entprellte Vorschau + `previewToken`-Kopplung · Mindestlänge 10 Zeichen für die Begründung · `renderActions`-Schnitt der Periodenliste für Phase 13 · Sortierung der Periodenliste absteigend · `grid-cols-1 sm:grid-cols-2` im `WorkScheduleEditor` |

---

## Abgrenzung

Nicht Teil dieser UI-SPEC (Phase 13 bekommt eine eigene):
Bearbeiten und Löschen von Perioden, Storno-Darstellung im Kontoauszug, die Aktion
„Stammdaten korrigieren" samt eigener Warnung. Vorbereitet ist ausschließlich der Schnitt:
`renderActions` in der Periodenliste, `readOnly` im `WorkScheduleEditor`, `zIndexClass` im `Modal`
und die freie `danger`-Buttonvariante.

Ebenfalls nicht Teil: Serverseitige Umsetzung. Dieses Dokument beschreibt den Vertrag, den die
Oberfläche einhält, und die Daten, die sie vom Server erwartet — nicht deren Berechnung.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
