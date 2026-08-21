---
phase: 13
slug: korrigieren-und-rueckgaengig-machen
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-21
---

# Phase 13 — UI Design Contract

> Visueller und interaktiver Vertrag für „Korrigieren und rückgängig machen". Erstellt von
> `gsd-ui-researcher`, zu prüfen durch `gsd-ui-checker`, verbindlich für `gsd-planner` und
> `gsd-executor`.

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

Unverändert aus `12-UI-SPEC.md`. Alle Werte sind Vielfache von 4.

| Token | Tailwind | Value | Verwendung in dieser Phase |
|-------|----------|-------|----------------------------|
| xs | `gap-1`, `mt-1` | 4px | Icon↔Text in Zeilenaktionen, Feldfehler unter dem Feld, zweite Zeile in der Beschreibungszelle |
| sm | `gap-2`, `space-x-2` | 8px | Badge-Innenabstand, Abstand Typ-Badge↔Zustands-Badge, Zahl↔Trendpfeil |
| md | `gap-4`, `p-4`, `space-y-4` | 16px | Formularfelder untereinander, Innenabstand der Panels (Warnung, Vorschau, Kein Zugriff), Kennzahlenraster |
| lg | `p-6`, `space-y-6`, `pt-6` | 24px | Modal-Innenabstand, Abstand zwischen Formularblöcken, Trennung Periodenliste↔Korrekturblock |
| xl | `mb-8` | 32px | Abstand Periodenliste↔restlicher Modalinhalt (aus Phase 12) |
| 2xl | — | 48px | nicht verwendet (Modale, keine Seitenlayouts) |
| 3xl | — | 64px | nicht verwendet |

**Ausnahmen — identisch zu Phase 12, keine neuen:**
- `py-1.5` (6 px) in `Button size="sm"` und `py-2.5` (10 px) in `Input` — Teil der bestehenden
  Primitive, wird nicht angefasst.
- Tabellenzellen `px-4 py-3` (16/12 px) — Muster aus `OvertimeTransactions.tsx`; die neue
  Aktionsspalte und die Storno-Zeilen übernehmen es unverändert.
- `Input` behält die feste Höhe `h-[42px]`.
- **Neu und nur hier:** Icon-only-Zeilenaktionen unterhalb von 640 px erhalten `p-2` statt
  `px-3 py-1.5`, damit die Trefferfläche 32 × 32 px erreicht (WCAG 2.2 AA, 2.5.8 verlangt 24 × 24 px).
  32 ist ein Vielfaches von 4, die Skala bleibt unverletzt. 44 px wird bewusst **nicht** gefordert:
  Das ist eine Tauri-Desktopanwendung mit Zeigereingabe, 2.5.5 (44 px) ist AAA und hier nicht
  einschlägig.

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

**Gewichte:** 400 (regulär) und 600 (`font-semibold`) sind der Vertrag.

**Deklarierte Ausnahmen — wortgleich aus Phase 12 übernommen, keine neuen:**
1. `font-medium` (500) für Formularlabels, Eingabewerte und `Button` — kommt fest aus den
   Primitiven, nicht änderbar ohne alle Formulare der App anzufassen.
2. `font-bold` (700) ausschließlich für vorzeichenbehaftete Stundenwerte in Journal-, Vorschau- und
   Bestätigungstabellen. Die Storno-Zeile steht direkt zwischen diesen Zeilen und muss gleich
   aussehen; die Zahl in der Löschvorschau muss optisch identisch mit der Zahl sein, die danach im
   Kontoauszug steht.

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
| Accent (10 %) | `#2563eb` (blue-600) | `#3b82f6` (blue-500) | siehe Reservierungsliste |
| Destructive | `#dc2626` (red-600) | `#f87171` (red-400) | siehe Reservierungsliste |

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
| Gutschrift / positiver Saldo | green-600 / green-400 | positive Stundenwerte in Vorschau, Löschbestätigung, Journal- und Storno-Zeile; `TrendingUp` |
| Belastung / negativer Saldo | red-600 / red-400 | negative Stundenwerte; `TrendingDown` |
| Fehler | red-600 / red-400 auf `bg-red-50` / `bg-red-900/20`, Rahmen `border-red-200` / `border-red-800` | Feldfehler, Vorschau-Fehlerbanner, Speicher- und Löschfehlerbanner |
| Warnung / Tragweite | amber-600 / amber-400 auf `bg-amber-50` / `bg-amber-900/20`, Rahmen `border-amber-200` / `border-amber-800` | Warnbanner „Das ändert die Vergangenheit" im Korrektur-Dialog, rückwirkende Vorschau, `ConfirmDialog variant="warning"` |
| Modellwechsel | teal-100/teal-700 hell, teal-900/30 + teal-300 dunkel | Typ-Badge „Modellwechsel" im Kontoauszug — **auch auf der Storno-Zeile** (siehe unten) |

**Keine neue Farbe für Storno (vom Orchestrator entschieden).** Die Storno-Zeile behält das
teal Typ-Badge ihres Originals und trägt daneben ein **graues Zustands-Badge** „Storno"
(`bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`). Die stornierte Originalzeile
bekommt spiegelbildlich das graue Zustands-Badge „storniert". Begründung: Gleiche Typfarbe macht die
Zusammengehörigkeit sofort sichtbar; das zusätzliche graue Badge macht den Zustand sichtbar. Eine
eigene Storno-Farbe hätte in `OvertimeTransactions.tsx` die achte Badge-Farbe eingeführt (blue,
amber, orange, purple, gray, teal sind belegt, green/red sind durch Vorzeichen besetzt) und die
Verwandtschaft der beiden Zeilen optisch zerschnitten.

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
| `aria-label` des Chips (Originalzeile) | Zugehörige Storno-Buchung anzeigen |
| `aria-label` des Chips (Gegenbuchung) | Zugehörige Ursprungsbuchung anzeigen |
| Toast, wenn der Partner außerhalb des Filters liegt | Die zugehörige Buchung liegt außerhalb des gewählten Zeitraums ({Monat JJJJ}). |

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
| **Rahmung** | Info-Panel (blau) — harmlos | neutraler Block (`bg-gray-50 dark:bg-gray-900/40`, `border-gray-200 dark:border-gray-700`) mit eigener `text-lg`-Überschrift „Sonderfall: Die Werte waren von jeher falsch" |
| **Buttonstil** | `variant="secondary" size="sm"`, **ohne Icon** (unverändert aus Phase 12) | `variant="ghost" size="sm"` mit vorangestelltem `AlertTriangle` in amber-600/400 |
| **Wortwahl** | „Stundenwechsel", „ab Datum" | „korrigieren", „rückwirkend", „von jeher falsch" |
| **Dialog** | Titel „Stundenwechsel: …", kein Warnbanner, Vorschau blau **oder** amber je nach Stichtag | Titel „Periode korrigieren: …", **immer** ein Warnbanner ganz oben, das den betroffenen Zeitraum konkret nennt |
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
| 2 | **Warnbanner** — amber, wenn die Periode die Vergangenheit berührt; blau („Keine Rückwirkung"), wenn sie vollständig in der Zukunft liegt. Nennt den Zeitraum immer konkret. |
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
| Erste Periode (`isFirst`) | nur „Korrigieren" · daneben ein **fokussierbarer Hinweis-Chip** `Info` + „Nicht löschbar" (`text-xs`, gray-500/400, `tabIndex={0}`, `role="note"`, `aria-label` mit dem vollen Erklärtext, Tooltip nach dem Muster aus `OvertimeTransactions.tsx`) |
| Löschen läuft für diese Zeile | „Löschen" wird zu `LoadingSpinner size="sm"`, beide Aktionen `disabled` |
| Kein Admin | `renderActions` wird gar nicht übergeben → die Spalte samt `<th>` entfällt (Phase-12-Verhalten) |

**Keine ausgegraute Löschschaltfläche (vom Orchestrator entschieden).** Ein `disabled`-Button
erklärt nichts, ist mit der Tastatur nicht erreichbar und trägt seinen Tooltip unzuverlässig. Der
Grund steht deshalb zweifach in der Oberfläche: als fokussierbarer Chip in der Zeile und als
dauerhaft sichtbare Fußnote unter der Liste. Die Fußnote ist der Träger — sie ist ohne jede
Interaktion lesbar.

### 4. Löschbestätigung — `ConfirmDialog variant="danger"`, erweitert

Kein neuer Dialogtyp. `ConfirmDialog` bekommt drei additive, optionale Props (Abschnitt
„Änderungen an Bestandskomponenten"). Aufbau:

| Reihenfolge | Inhalt |
|---|---|
| 1 | `title` „Periode löschen" mit `AlertTriangle` in red-600/400 (bestehendes `variant="danger"`-Verhalten) |
| 2 | `message` — welche Periode, welcher Zeitraum, welche Stunden, wessen |
| 3 | `details`: drei Punkte in einem `bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 space-y-2`-Panel — Lückenschluss, Storno, Saldoänderung. Der dritte Punkt kommt aus der **Server-Vorschau**. |
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
  Ist die Partnerzeile im aktuellen Zeitraumfilter nicht enthalten, erscheint stattdessen der Toast
  aus dem Textbuch — kein stiller Klick ins Leere.

**Warum drei Mittel für einen Bezug (vom Orchestrator entschieden):** Die Liste ist nach
`createdAt DESC, id DESC` sortiert (Phase-8-Entscheidung, nicht verhandelbar), das Storno steht also
oben und das Original irgendwo weiter unten — bei Monatsfilterung womöglich gar nicht. Deshalb
trägt der Bezug (a) im Klartext („Storno zur Buchung vom …", „Storniert am … von …"), (b) als
gemeinsame Belegnummer auf beiden Zeilen und (c) als Sprungmarke. (a) und (b) funktionieren ohne
Interaktion, im Ausdruck und mit Screenreader; (c) ist die Bequemlichkeit obendrauf.

- **Bekannte, akzeptierte Einschränkung:** Bei Monats-/Jahresfilterung kann eine der beiden Zeilen
  außerhalb des Filters liegen. Kein Sonderweg für diesen Typ — dafür der erklärende Toast und der
  Klartextbezug in der sichtbaren Zeile.

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

Darstellung: `bg-gray-50 dark:bg-gray-900/40`, `border border-gray-200 dark:border-gray-700`,
`rounded-lg p-4`, `Lock` in gray-500/400, Überschrift `text-sm font-semibold`, Body `text-sm`
gray-600/400.

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
| 21 | Löschen läuft | Bestätigungsknopf `disabled` mit `LoadingSpinner size="sm"` + „Wird gelöscht …"; „Abbrechen" `disabled`; die betroffene Zeile in der Liste zeigt statt der Aktionen einen `LoadingSpinner size="sm"` |
| 22 | Löschen fehlgeschlagen | Bestätigungsdialog bleibt offen; rotes Banner darin: „Die Periode wurde nicht gelöscht. Es wurde nichts verändert — weder die Periode noch der Kontoauszug. {Servermeldung}" |
| 23 | Löschen der ersten Periode serverseitig abgelehnt | wie 22, mit dem Text „Die erste Periode kann nicht gelöscht werden. Korrigieren Sie sie stattdessen." — Fall tritt nur bei umgangener Oberfläche auf, muss aber tragen |
| 24 | Erste Periode — nicht löschbar (Normalfall) | Aktionszelle ohne Löschknopf, mit fokussierbarem Chip „Nicht löschbar"; Fußnote unter der Liste dauerhaft sichtbar |
| 25 | Löschen erfolgreich | Dialog schließt; Toast „Periode gelöscht — Storno steht im Kontoauszug"; grünes Banner (8 s) mit dem neuen Ende der Vorperiode; Liste und Kontoauszug invalidiert; **kein** „Rückgängig"-Knopf |
| 26 | Kontoauszug: Storno-Paar sichtbar | zwei Zeilen, beide mit teal Typ-Badge, je einem grauen Zustands-Badge, gemeinsamem Beleg-Chip und Klartextbezug |
| 27 | Kontoauszug: Partnerzeile außerhalb des Filters | Klick auf den Beleg-Chip erzeugt den erklärenden Toast; die sichtbare Zeile bleibt hervorgehoben |

Der Abbruch-Weg (ESC, Backdrop, „Abbrechen") setzt den Korrektur-Dialog vollständig zurück —
inklusive Vorschau, Fehlern und `previewToken` — nach dem Muster `handleClose` aus
`OvertimeCorrectionModal.tsx`. Ausnahmen: Zustände 15 und 21, dort ist Abbrechen gesperrt.

---

## Änderungen an Bestandskomponenten

Vollständige Liste. Alles darüber hinaus bleibt unangetastet.

| Datei | Änderung | Art |
|-------|----------|-----|
| `desktop/src/components/ui/ConfirmDialog.tsx` | drei optionale Props: `details?: ReactNode` (gerendert unter `message` in `CardContent`, `mt-4`), `confirmDisabled?: boolean` (auf den Bestätigungsknopf), `zIndexClass?: string` (Default `'z-50'`) | additiv, rückwärtskompatibel |
| `desktop/src/components/ui/ConfirmDialog.tsx` | `handleConfirm` schließt heute den Dialog **sofort** nach `onConfirm()`. Für den Löschvorgang muss der Dialog offen bleiben (Zustände 21/22). Dafür eine optionale Prop `closeOnConfirm?: boolean` (Default `true`); bei `false` schließt der Aufrufer selbst | additiv, rückwärtskompatibel |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` | `renderActions` wird gesetzt (Prop existiert bereits aus Phase 12) | keine Änderung an der Komponente |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` | neue optionale Props `accessDenied?: boolean` und `footnote?: ReactNode` für Zustand 3 und die Fußnote | additiv |
| `desktop/src/components/worktime/OvertimeTransactions.tsx` | Zustands-Badges, Beleg-Chip, Sprungmarke, zweite Beschreibungszeile für Storno-Paare | additiv |
| `desktop/src/components/users/EditUserModal.tsx` | Korrekturblock unter der Periodenliste, Fußnote, Dialog-/Bestätigungssteuerung, Erfolgsbanner-Texte | additiv |
| `desktop/src/api/client.ts` | 403 auf den Perioden-Endpunkten von der globalen Fehler-Toast-Regel ausnehmen (analog `is403OnUsers`) | eine Zeile, verhaltensverengend |

**Abhängigkeit von Phase 12:** `Modal` muss die Prop `zIndexClass` und den Zähler geöffneter Modale
bereits mitbringen (12-UI-SPEC, Abschnitt 1). `ConfirmDialog` ist heute auf `z-50` festgenagelt und
baut **nicht** auf `Modal` auf — die `zIndexClass`-Prop dort ist deshalb in dieser Phase mitzuliefern,
falls Phase 12 nur `Modal` angefasst hat. Ohne sie liegt jede Bestätigung unter dem Dialog, aus dem
sie stammt.

**Beobachtete, hier nicht behobene Altlasten** (vermerkt, damit sie nicht als neu eingeführter Mangel
gewertet werden): `ConfirmDialog.tsx` enthält zwei `console.log`-Aufrufe entgegen der Pre-Commit-Regel;
`OvertimeTransactions.tsx` typisiert die Transaktionen als `any` entgegen der Strict-Mode-Regel;
`EditUserModal.tsx` nutzt an mehreren Stellen starre `grid-cols-2`/`grid-cols-3` ohne Breakpoint.
Neuer Code dieser Phase führt keines dieser Muster fort — die neuen Transaktionsfelder werden
typisiert, es gibt keine neuen `console.log`, und jedes neue Raster hat einen Breakpoint.

---

## Datenvertrag (was die Oberfläche vom Server erwartet)

Beschreibt die Erwartung der UI, nicht die Implementierung.

| Zweck | Erwartete Angaben |
|-------|-------------------|
| Periodenliste | je Periode: `id`, `validFrom`, `validTo\|null`, `weeklyHours`, `workSchedule`, `isFirst` (erste Periode ab `hireDate`), `isCurrent` |
| Korrektur-Vorschau | `rangeFrom`, `rangeTo`, `workingDays`, `targetHoursBefore`, `targetHoursAfter`, `targetHoursDelta`, `balanceBefore`, `balanceAfter`, `balanceDelta`, `previousPeriod` (falls `validFrom` verschoben wird: `validFrom`, `weeklyHours`, `newValidTo`), `previewToken` |
| Lösch-Vorschau | `deletedPeriod`, `previousPeriod` (`validFrom`, `weeklyHours`, `newValidTo`), `reversedTransaction` (`id`, `date`, `hours`), `rebuildFrom`, `balanceBefore`, `balanceAfter`, `balanceDelta`, `previewToken` |
| Kontoauszug | zusätzlich je Transaktion: `id`, `referenceId`, `reversalOf\|null`, `reversedBy\|null`, `reversedAt\|null`, `reversedByName\|null`, `periodValidFrom`, `createdAt`, `createdByName` |
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
  im `aria-label`; die Tooltip-Einblendung reagiert auf `hover` **und** `focus-visible`.
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
| Vom Orchestrator entschieden | shadcn nicht initialisieren · ein Dialog für die Korrektur mit zwei Türen, Zeilenaktion heißt „Korrigieren" · Korrekturblock unter der Liste, neutral grau, Amber erst im Dialog · Phase-12-Button bleibt ohne Icon (Asymmetrie als Unterscheidungsmerkmal) · kein Type-to-confirm · `ConfirmDialog` erweitern statt zweiten Bestätigungsstil bauen · Löschbestätigung mit Server-Vorschau, Bestätigung bis dahin gesperrt · `validTo` nie editierbar, `validFrom` der ersten Periode gesperrt · erste Periode: fokussierbarer Chip + dauerhafte Fußnote statt ausgegrautem Knopf · Storno-Bezug über Klartext + gemeinsamen Beleg-Chip + Sprungmarke · Originalbetrag bleibt ungestrichen stehen · Zustands-Badges grau statt neuer Farbe · „Kein Zugriff" grau mit Schloss, nicht rot · 403 auf Perioden-Endpunkten vom globalen Fehler-Toast ausnehmen · kein „Rückgängig" im Erfolgs-Toast · Icon-only-Zeilenaktionen mit `p-2` unter 640 px |

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

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
