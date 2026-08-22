---
phase: 12
slug: stundenwechsel-bedienen
status: revised-2
shadcn_initialized: false
preset: none
created: 2026-08-21
revised: 2026-08-22
revision: 4
---

# Phase 12 — UI Design Contract

> Visueller und interaktiver Vertrag für „Stundenwechsel bedienen". Erstellt von `gsd-ui-researcher`,
> zu prüfen durch `gsd-ui-checker`, verbindlich für `gsd-planner` und `gsd-executor`.

**Kein Greenfield.** Die Anwendung läuft seit v1.0 (aktuell v1.8.0) mit einem etablierten
Erscheinungsbild. Dieses Dokument schreibt den Bestand fort. Wo ein Muster existiert, ist es
gesetzt; jede Abweichung ist unten ausdrücklich begründet.

**Revision 2 (21.08.2026).** Der `gsd-ui-checker` hat fünf blockierende Befunde erhoben (B1–B5).
Sie sind behoben; die Änderungen stehen in den Abschnitten *Verschachtelte Modale und z-Ebenen*,
*Änderungen an Bestandskomponenten*, *Zustände*, *Vorschau/`previewToken`* und *Barrierefreiheit*.

**Revision 3 (21.08.2026, Frontmatter `status: revised-2`).** Durchgang 2 des Checkers hat B1–B5
bestätigt und einen weiteren blockierenden Befund erhoben: **B6 — der verschachtelte Dialog liegt im
`<form>` des `EditUserModal`, und `createPortal` unterbricht die React-Ereigniskette nicht.**
Behoben in *Formulargrenzen im verschachtelten Baum* (Abschnitt 1) und Abschnitt 2. Zusätzlich
eingearbeitet: Index-Guard in `popModal`, Abgrenzung zu `PrivacyPolicyModal`, der betroffene
E2E-Test, korrigierte Zahlwörter bei den `console.log` und der Wertvergleich im Sync-Effekt.

**Revision 4 (22.08.2026) — Vertragsdrift nachgezogen, kein neuer Entwurf.** Der UI-Audit
(`12-UI-REVIEW.md`, Befund C-4) hat festgestellt, dass Abschnitt 5 die Journalzeile noch so
beschreibt, wie sie **vor** dem Server-Code-Review geplant war: „ein echter Stundenwert mit
Vorzeichen, Trendpfeil und `font-bold`, genau wie `earned` und `correction`". Server-CR-01 hat
die Zeile seither bewusst zu einer **Dokumentationszeile ohne Rechenwirkung** gemacht
(`hours: 0` plus ein eigenes Feld `documentedDelta`), weil die Wirkung der Umstellung schon in
den neu gerechneten Tageszeilen steckt — eine mitsummierende Journalzeile hätte den Betrag ein
zweites Mal gezählt, und die Summe der angezeigten Zeilen läge um genau diesen Betrag über dem
daneben stehenden Saldo. Der Vertrag wird deshalb auf den umgesetzten Stand gebracht: betroffen
sind der Abschnitt „Kontoauszug (Überstunden-Journal)" im Textbuch, die Semantik-Palette und
Abschnitt 5. **Es ist keine Neuplanung, sondern die Angleichung des Vertrags an eine bereits
getroffene und begründete fachliche Entscheidung** — Phase 13 plant sonst gegen eine überholte
Zusage.

Alle Zeilenangaben auf Bestandscode wurden am 21.08.2026 an den echten Dateien nachgeprüft
(Zero-Hallucination-Policy, `.claude/CLAUDE.md`). Die Angaben der Revision 4 wurden am
22.08.2026 an `OvertimeTransactions.tsx` und `overtimeTransactionFormat.ts` nachgeprüft.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **none** — kein shadcn, eigene Primitive unter `desktop/src/components/ui/` |
| Preset | not applicable |
| Component library | Eigene Primitive: `Modal`, `Card`, `Button`, `Input`, `Select`, `Textarea`, `ConfirmDialog`, `LoadingSpinner` |
| Styling | Tailwind CSS **3.4.1** (`desktop/package.json` Zeile 65), `darkMode: 'class'`, `theme.extend` leer (nur Tailwind-Defaults) |
| React | 19.1.0 (`desktop/package.json` Zeile 38) — `createPortal` aus `react-dom` verfügbar |
| Icon library | `lucide-react` ^0.294.0 (`@heroicons/react` ist ebenfalls installiert, wird in den betroffenen Komponenten aber nicht verwendet — hier ausschließlich lucide) |
| Font | Inter (Fallback Avenir, Helvetica, Arial, sans-serif), Basisgröße 16 px, `line-height: 24px` — aus `desktop/src/App.css` `:root` |
| Toasts | `sonner` ^1.2.0, montiert in `desktop/src/main.tsx` als `<Toaster position="top-right" richColors />` |
| Datums-/Zahlformat | `toLocaleDateString('de-DE')`, Stunden über `formatHours()` aus `desktop/src/utils/timeUtils.ts` (Format `H:MMh`) |
| Neue Abhängigkeiten | **keine** |

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
Feldgruppen `gap-4`, `WorkScheduleEditor` `gap-3`/`p-3`). Alle Werte sind Vielfache von 4.

| Token | Tailwind | Value | Verwendung in dieser Phase |
|-------|----------|-------|----------------------------|
| xs | `gap-1`, `mt-1` | 4px | Abstand Icon↔Text, Hilfstext unter Feldern, Fehlermeldung unter Feld |
| sm | `gap-2`, `space-x-2` | 8px | Badge-Innenabstand, Zahl↔Trendpfeil, Zellinhalte |
| **sm+** | `gap-3`, `space-y-3`, `p-3`, `px-4 py-3` | **12px** | Tagesplan-Raster im `WorkScheduleEditor`, Tabellenzellen der Periodenliste und des Kontoauszugs, Abstand zwischen den Buttons der Aktionszeile (`flex justify-end gap-3`), Beispiel-/Hinweiskästchen |
| md | `gap-4`, `p-4`, `space-y-4` | 16px | Standardabstand zwischen Formularfeldern, Panel-Innenabstand (Vorschau, Hinweise) |
| lg | `p-6`, `space-y-6`, `pt-6` | 24px | Modal-Innenabstand, Abstand zwischen Formularblöcken, Abstand Formular↔Vorschau |
| xl | `mb-8` | 32px | Abstand Periodenliste↔restlicher Modalinhalt |
| 2xl | — | 48px | in dieser Phase nicht verwendet (Modale, keine Seitenlayouts) |
| 3xl | — | 64px | in dieser Phase nicht verwendet |

**Ausnahmen (bestandsgeführt, nicht neu erfunden) — genau zwei:**
- `py-1.5` (6 px) in `Button size="sm"` und `py-2.5` (10 px) in `Input` (`Input.tsx` Zeile 26) —
  Teil der bestehenden Primitive, wird nicht angefasst.
- `Input` hat eine feste Höhe `h-[42px]` (`Input.tsx` Zeile 26). Alle Datums- und Zahlenfelder im
  neuen Dialog nutzen `Input` und erben diese Höhe; keine handgebauten Eingabefelder.

`px-4 py-3` in Tabellenzellen ist **keine** Ausnahme mehr, sondern der Token `sm+` in Kombination
mit `md` — 12 und 16 sind beide Vielfache von 4.

---

## Typography

Es gibt keine `theme.extend.fontSize` — es gelten die Tailwind-Defaults. Für diese Phase sind
**vier** Größen freigegeben, mehr nicht:

| Rolle | Klasse | Size | Weight | Line Height |
|-------|--------|------|--------|-------------|
| Hilfs-/Metatext (Badges, Hinweiszeilen, Fußnote) | `text-xs` | 12px | 400 | 16px (1,33) |
| Body / Label / Tabelleninhalt / Formularfeld | `text-sm` | 14px | 400 (Body) · 500 `font-medium` (Labels, Feldinhalt) | 20px (1,43) |
| Abschnittsüberschrift (`Was diese Umstellung bewirkt`, `Arbeitszeitmodell — Perioden`) | `text-lg` | 18px | 600 `font-semibold` | 28px (1,56) |
| Modaltitel (durch `Modal` gesetzt, `Modal.tsx` Zeile 65) | `text-xl` | 20px | 600 `font-semibold` | 28px (1,4) |

### Gewichte — ehrliche Fassung

Diese Phase verwendet **vier** Schriftgewichte. Zwei davon sind frei gewählt, zwei sind
bestandsgebunden und ausschließlich an den hier genannten Stellen erlaubt:

| Gewicht | Status | Wo genau |
|---------|--------|----------|
| 400 regulär | frei gewählt, Vertrag | Fließtext, Tabelleninhalte, Hilfstexte, Fußnote |
| 600 `font-semibold` | frei gewählt, Vertrag | Modaltitel, Abschnittsüberschriften |
| 500 `font-medium` | **bestandsgebunden** | kommt fest aus `Input.tsx` (Zeile 29 `text-sm font-medium`), `Input`-Label (Zeile 18), `Select`, `Textarea` und `Button`. Nicht änderbar, ohne jedes Formular der App anzufassen. Kein neuer Einsatzort außerhalb dieser Primitive. |
| 700 `font-bold` | **bestandsgebunden, eng begrenzt** | ausschließlich für vorzeichenbehaftete Stundenwerte: die hervorgehobene Saldoänderung im Vorschaupanel, der Betrag in der neuen Journalzeile, die Summenzahl im `WorkScheduleEditor` (`WorkScheduleEditor.tsx` Zeile 151 `text-lg font-bold`, bestehend). `OvertimeTransactions.tsx` nutzt 700 für jede Betragsspalte; die neue Modellwechsel-Zeile steht direkt zwischen diesen Zeilen und muss gleich aussehen. Für die Vorschau gilt dieselbe Regel, damit die Zahl in der Vorschau optisch identisch mit der Zahl ist, die danach im Kontoauszug steht — das ist der Kern von REQ-27. |

Neue Einsatzorte für 500 oder 700 außerhalb dieser Tabelle sind ein Vertragsbruch.

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
2. Der **Fokusring** auf Eingabefeldern und Buttons (`focus:ring-blue-500`, `Input.tsx` Zeile 13).
3. Der **aktivierte Toggle** „Individueller Wochenplan" im `WorkScheduleEditor`
   (`bg-blue-600`, `WorkScheduleEditor.tsx` Zeile 95).
4. Das **Info-Panel „Keine Rückwirkung"** bei einem Stichtag in der Zukunft
   (`bg-blue-50 dark:bg-blue-900/20`, Rahmen `border-blue-200 dark:border-blue-800`) —
   dasselbe Panel-Muster wie die Summenkarte in `WorkScheduleEditor.tsx` Zeile 146.

**Accent ist ausdrücklich NICHT** für: Tabellenkopfzeilen, die Periodenliste, das Badge des
Modellwechsels, Abschnittsüberschriften, Zeilen-Hover, den Sekundärbutton oder „alle interaktiven
Elemente".

### Semantik-Palette (unverändert aus dem Bestand übernommen)

Diese Farben tragen in der App bereits feste fachliche Bedeutung. Sie werden nicht neu erfunden und
zählen nicht gegen die 10-%-Akzentquote, weil sie ausschließlich zustandsgebunden erscheinen.

| Bedeutung | Hell / Dunkel | Wo genau in dieser Phase |
|-----------|---------------|--------------------------|
| Gutschrift / positiver Saldo | green-600 / green-400 | positive Stundenwerte in Vorschau und Journalzeile, `TrendingUp`-Icon (Vorschaupanel und summierende Journalzeilen — **nicht** die `model_change`-Zeile, siehe Abschnitt 5), Erfolgs-Toast |
| Belastung / negativer Saldo | red-600 / red-400 | negative Stundenwerte, `TrendingDown`-Icon (gleiche Einschränkung) |
| Fehler | red-600 / red-400 auf `bg-red-50` / `bg-red-900/20`, Rahmen `border-red-200` / `border-red-800` | Feldfehler (`Input error`-Prop), Vorschau-Fehlerbanner, Speicher-Fehlerbanner |
| Warnung / Tragweite | amber-600 / amber-400 auf `bg-amber-50` / `bg-amber-900/20`, Rahmen `border-amber-200` / `border-amber-800` | Vorschau-Panel bei **rückwirkendem** Stichtag, `ConfirmDialog variant="warning"` |
| Modellwechsel (neu) | teal-100/teal-700 hell, teal-900/30 + teal-300 dunkel | **nur** das Typ-Badge „Modellwechsel" im Überstunden-Kontoauszug |

**Begründung für Teal (vom Orchestrator entschieden):** `OvertimeTransactions.tsx` belegt bereits
blue (`earned`), amber (`feiertag`), orange (`compensation`), purple (`correction`), gray
(`carryover`, Abwesenheitstypen). Grün und Rot sind durch Gutschrift/Belastung besetzt. Teal ist der
einzige verbleibende Ton, der neben Purple in derselben Tabelle noch sicher unterscheidbar ist —
Indigo wäre von Purple und Blue nicht zuverlässig zu trennen.

### Visueller Anker

**Visueller Anker des Dialogs ist die hervorgehobene Saldoänderung im Vorschaupanel.** Sie ist das
einzige Element in `text-lg font-bold` mit semantischer Farbe (grün/rot) und Trendpfeil; alles
andere im Dialog ist `text-sm`/`text-xs` in neutralen Tönen. Der Blick landet dort zuerst, und genau
diese Zahl ist die Entscheidungsgrundlage des Admins. Kein zweites Element im Dialog darf diese
Kombination aus Größe, Gewicht und Farbe tragen.

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
| Error state (Periodenliste) | **Perioden konnten nicht geladen werden: {Meldung}** → Button „Perioden erneut laden" |
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
| Zähler unter der Begründung, solange < 10 Zeichen | Noch {n} Zeichen |
| Zähler ab 10 Zeichen | **wird ausgeblendet** — kein „35/10", keine Erfolgsmeldung, kein Häkchen |
| Sekundärbutton | Abbrechen |
| Fallback im Infopanel, wenn die Perioden nicht geladen werden konnten | Das aktuell gültige Modell konnte nicht geladen werden. Die Felder sind mit den Stammdatenwerten vorbelegt — bitte prüfen. |

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
| **Panel „nichts zu tun"** (neu, grau) | Die eingegebenen Werte entsprechen der aktuell gültigen Periode ab {TT.MM.JJJJ}. Es gibt nichts umzustellen — ändern Sie die Wochenstunden oder den Tagesplan. |

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
| Neue Werte identisch mit der gültigen Periode | → **kein Feldfehler**, sondern das graue Panel „nichts zu tun" (Zustand 8). Rot wäre falsch: der Anwender hat nichts falsch gemacht, er hat nur noch nichts geändert. |
| Tagesplansumme weicht von Wochenstunden ab (**Warnung, blockiert nicht**) | `⚠️ Summe weicht von Wochenstunden ({weeklyHours}h) ab!` — wortgleicher Bestandstext aus `WorkScheduleEditor.tsx` Zeile 161, unverändert |
| Vorschau veraltet (Server lehnt Token ab) | Die Vorschau ist nicht mehr aktuell. Sie wird gerade neu berechnet — bitte prüfen Sie danach die Werte und speichern Sie erneut. |
| Vorschau zum zweiten Mal in Folge als veraltet abgelehnt | Die Vorschau konnte nicht in einen speicherbaren Zustand gebracht werden. Bitte berechnen Sie sie erneut. → Rückfall in Zustand 5 |

**Zugängliche Namen (barrierefrei, keine sichtbaren Texte)**

| Ort | Wert |
|-----|------|
| `Modal.tsx` Zeile 73, X-Button | `aria-label="Dialog schließen"` — heute `"Close modal"`, einziger englischer Text in einer sonst durchgehend deutschen Oberfläche |
| `ConfirmDialog.tsx` Zeile 64–69, X-Button | `aria-label="Abbrechen"` — heute **gar kein** zugänglicher Name; ein Screenreader liest nur „Schaltfläche" |

**Kontoauszug (Überstunden-Journal)**

| Ort | Text |
|-----|------|
| Typ-Badge | Modellwechsel |
| Typ-Tooltip (`getTypeDescription`) | Saldodifferenz aus einer rückwirkenden Umstellung des Arbeitszeitmodells |
| Beschreibung | Stundenwechsel ab {TT.MM.JJJJ}: {X,X} → {Y,Y} h/Woche (Grund: {Begründung}) |
| Zweite Zeile unter der Beschreibung (`text-xs`, gray-500/400) | Periode ab {TT.MM.JJJJ} · eingetragen am {TT.MM.JJJJ} von {Admin-Name} |
| Beschriftung über dem Betrag der `model_change`-Zeile (`text-xs`, gray-500/400) — **Revision 4** | dokumentierte Differenz |
| Betrag der `model_change`-Zeile — **Revision 4** | {±H:MMh}, bei Nulldifferenz **± 0:00h** |
| Fußnote unter der Tabelle, nur wenn mindestens eine `model_change`-Zeile sichtbar ist (`text-xs`, gray-500/400) — **Revision 4** | Zeilen vom Typ „Modellwechsel" dokumentieren die Differenz, die eine Umstellung des Arbeitszeitmodells bewirkt hat. Der Betrag zählt **nicht** zusätzlich zum Saldo — er steckt bereits in den neu gerechneten Tageszeilen ab dem Stichtag. |

Die Begründung ist Freitext eines Menschen und wird **unverändert** durchgereicht — kein Trimmen,
kein Umformatieren von Datumsmustern darin. Das ist die Regel, die `VacationTransactions.tsx` in
`formatDescription()` ausdrücklich begründet; sie gilt hier genauso.

---

## Bildschirme und Komponenten

### 1. Einstiegspunkt — `desktop/src/components/users/EditUserModal.tsx`

Umsetzung von CONTEXT **D1**. Im Abschnitt „Arbeitszeit & Berechtigungen" ändert sich Folgendes:

- Das Feld **Wochenstunden** (`EditUserModal.tsx` Zeile 249–260) wird schreibgeschützt:
  `readOnly`, `aria-readonly="true"`, zusätzlich
  `className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 cursor-not-allowed hover:!border-gray-300 dark:hover:!border-gray-600 hover:!shadow-sm"`.

  **Entschieden (vom Orchestrator): `readOnly`, nicht `disabled`.** Begründung: `Input.tsx`
  Zeile 34 setzt bei `disabled` `opacity-50`; der Wert wäre kaum noch lesbar, obwohl er die
  wichtigste Information des Blocks ist. `readOnly` hält den Wert lesbar und den Kontrast über
  4,5:1. `Input.tsx` Zeile 41 reicht alle unbekannten Props per `{...props}` an das `<input>`
  durch — `readOnly` und `aria-readonly` kommen also ohne Änderung an der Primitive an.

  **Die Ausrufezeichen sind zwingend (Revision 2).** `Input.tsx` Zeile 36–37 setzt
  `hover:border-gray-400 dark:hover:border-gray-500` und `hover:shadow-md`. Die per `className`
  übergebenen Klassen (Zeile 39) haben **dieselbe Spezifität**; welche gewinnt, entscheidet dann
  die Reihenfolge in der generierten Tailwind-Datei, nicht die Reihenfolge im Klassenstring. Ohne
  `!` reagiert das schreibgeschützte Feld beim Überfahren wie ein bedienbares. `hover:!border-…`
  und `hover:!shadow-…` erzeugen `!important` und gewinnen zuverlässig.

  **Entschieden (vom Orchestrator): kein `readOnly`-Zweig in `Input.tsx`.** Der sauberere Weg wäre
  ein eigener Zweig in der Primitive; er würde `Input.tsx` aber zum fünften Eingriffsort machen —
  eine Komponente, die in jedem Formular der App steckt. Die Overrides beim einen betroffenen
  Aufrufer sind das kleinere Risiko. Wenn Phase 13 weitere schreibgeschützte Felder braucht, ist
  der Zweig in `Input.tsx` dort nachzuholen.

  **`tabIndex={-1}` entfällt (Revision 2).** Es widersprach der eigenen Begründung: Wer ein Feld
  lesbar halten will, nimmt es nicht aus dem Tabulatorfluss — ein Screenreader-Nutzer erreicht den
  Wert dann gar nicht mehr. `readOnly` + `aria-readonly="true"` genügen; der Wert bleibt
  fokussierbar und markierbar, aber nicht änderbar.

- Der `WorkScheduleEditor` bekommt eine neue optionale Prop `readOnly?: boolean` (Default `false`).
  Bei `true`:
  - Toggle (`WorkScheduleEditor.tsx` Zeile 90–104): `disabled`, zusätzlich
    `disabled:cursor-not-allowed`. Die Akzentfarbe `bg-blue-600` im eingeschalteten Zustand bleibt
    — sie ist hier Zustandsanzeige, nicht Bedienangebot.
  - Tagesfelder (`WorkScheduleEditor.tsx` Zeile 127–138): `disabled`, zusätzlich
    `disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed`.
    **Kein `opacity`.** Begründung: Das sind rohe `<input>`-Elemente ohne Projektklassen; ohne
    ausdrückliche Vorgabe greift die Browser-Standardabblendung und erzeugt genau das
    Lesbarkeitsproblem, wegen dem beim Wochenstundenfeld `readOnly` statt `disabled` gewählt wurde.
  - Summenkarte und Fallback-Info bleiben unverändert sichtbar.

  **Die Sorge um `<select>` und Checkbox trifft nicht zu (am Code geprüft, 21.08.2026):**
  `WorkScheduleEditor.tsx` enthält weder ein `<select>` noch eine Checkbox. Der Toggle ist ein
  `<button type="button">` (Zeile 90–91), die Tagesfelder sind `<input type="number">` (Zeile 127).
  Für beide Elementtypen wirkt `disabled` vollständig.

  Sichtbarer Schnitt für Phase 13: dieselbe Prop steuert später auch die Ansicht in
  „Stammdaten korrigieren".

- Unmittelbar darunter ein Hinweispanel im bestehenden Blau-Muster
  (`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4`)
  mit dem Hilfstext aus dem Textbuch und rechtsbündig dem Button
  `<Button type="button" variant="secondary" size="sm">Stundenwechsel ab Datum …</Button>`.
  `type="button"` ist zwingend, sonst löst er den Submit des umgebenden Formulars aus.
  Dieser Button trägt eine `ref` — sie wird für die Fokusrückgabe gebraucht (siehe
  Barrierefreiheit).
- Darunter die **Periodenliste** (Abschnitt 4), getrennt durch
  `pt-6 border-t border-gray-200 dark:border-gray-700` — dasselbe Trennmuster, das
  `EditUserModal.tsx` bereits zwischen seinen Blöcken verwendet.
#### Formulargrenzen im verschachtelten Baum — neu in Revision 3

**Der Befund.** `EditUserModal.tsx` Zeile 168 öffnet `<form onSubmit={handleSubmit} className="space-y-6">`
und schließt es erst in Zeile 336. Dieses eine Formular umschließt den **gesamten** Modalinhalt —
also auch den Abschnitt „Arbeitszeit & Berechtigungen", in den diese Spec Hinweispanel,
Einstiegs-Button und Periodenliste legt. `Button.tsx` setzt **kein** Default-`type` (Zeile 31:
`<button ref={ref} className={classes} {...props}>`); ein `<button>` ohne `type` ist innerhalb eines
Formulars per HTML-Standard `type="submit"`.

**`createPortal` hilft hier nicht.** Ein Portal verlagert nur den DOM-Knoten. Ereignisse
propagieren weiterhin entlang des **React-Baums**, nicht des DOM-Baums. Würde
`<WorkTimeChangeModal>` neben seinem auslösenden Button — also innerhalb des äußeren `<form>` —
gerendert, erreichten `submit` und `click` aus dem portalierten Dialog trotzdem
`EditUserModal.handleSubmit`. Enter im Feld „Stichtag" oder ein Klick auf „Stundenwechsel speichern"
würde `updateUser.mutateAsync(...)` auslösen und über `onClose()` (`EditUserModal.tsx` Zeile 126–132)
das äußere Modal samt darin hängendem Wechsel-Dialog schließen — exakt der Verlust des offenen
Formulars, mit dem diese Spec die Verschachtelung überhaupt begründet.

**Drei Festlegungen, alle verbindlich:**

1. **Renderort.** `<WorkTimeChangeModal>` wird **außerhalb** des `<form>`-Elements gerendert: als
   Geschwister **nach** `</form>` (Zeile 336), weiterhin innerhalb der Kinder von `Modal`. Damit
   liegt der Dialog auch im React-Baum außerhalb des Formulars, und die Ereigniskette kann
   `handleSubmit` gar nicht erst erreichen. **Dasselbe gilt für jeden `ConfirmDialog`, der aus
   diesem Baum geöffnet wird.** Der Renderort ist Teil des Vertrags, nicht Ermessen der Umsetzung.
2. **Doppelte Absicherung im Dialog.** Der `onSubmit`-Handler des Wechsel-Dialogs ruft zusätzlich
   zu `e.preventDefault()` auch `e.stopPropagation()`. Festlegung 1 macht das im Normalfall
   überflüssig; die Zeile kostet nichts und fängt eine spätere Umstellung des Renderorts ab.
3. **`type` ist überall ausdrücklich zu setzen.** Die Regel „`type="button"` ist zwingend" gilt für
   **jeden** Button im verschachtelten Teilbaum — Einstiegs-Button, „Perioden erneut laden",
   „Vorschau erneut berechnen", „Abbrechen", spätere Zeilenaktionen der Periodenliste und der Toggle
   im `WorkScheduleEditor` (der ihn in Zeile 91 bereits trägt). Einzige Ausnahme: der Primärbutton
   des Wechsel-Dialogs ist `type="submit"` — für **sein eigenes** Formular, das nach Festlegung 1
   nicht mehr im äußeren steckt.

`Button.tsx` bekommt **keinen** Default-`type`. Das wäre eine Änderung an einer Primitive, die in
jedem Formular der App steckt, und würde bestehende Submit-Buttons stillschweigend entschärfen —
eine Regression mit großer Reichweite für ein Problem, das an drei genau benannten Stellen lokal
gelöst ist.

- Der Absende-Pfad des Modals (`EditUserModal.tsx` Zeile 113–114) sendet `weeklyHours` und
  `workSchedule` weiterhin mit, aber unverändert aus `user` — nicht aus dem Formularzustand. So
  kann „Änderungen speichern" das Arbeitszeitmodell nicht mehr still überschreiben.

#### Verschachtelte Modale und z-Ebenen — vollständig neu in Revision 2

**Der Befund.** `Modal.tsx` Zeile 55–60 setzt auf dem Modal-Panel die Klasse `transform`
(Zeile 59: `transform transition-all`). Tailwind 3.4.1 erzeugt dafür einen echten Transform-Wert
(`translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(…) skew(…) scale(…)`), **nicht**
`none`. Ein Element mit einem Transform-Wert ist der **Containing Block für alle
`position: fixed`-Nachfahren**. Ein Wechsel-Dialog, der im Inhalt von `EditUserModal` gerendert
wird, bezieht sein `fixed inset-0` damit nicht auf das Fenster, sondern auf die Fläche des äußeren
Modal-Panels: Backdrop und Dialog sitzen eingesperrt in der äußeren Modalbox. Eine `zIndexClass`
ändert daran nichts — das Problem liegt **vor** der Stapelreihenfolge.

Im gesamten `desktop/src` gibt es **kein** `createPortal` (geprüft am 21.08.2026) — es existiert
kein Bestandsmuster für ein Modal im Modal.

**Festlegung (vom Orchestrator entschieden): Portal, und zusätzlich `transform` entfernen.**

1. **`Modal` rendert sein Overlay über `createPortal(…, document.body)`.** Additiv für alle
   Bestandsaufrufer: das Overlay ist ohnehin `fixed inset-0` (Zeile 44), seine Darstellung hängt
   nicht am DOM-Ort, und es gibt keine CSS-Regel im Projekt, die es über seine Position im Baum
   selektiert. Das ist der tragende Fix — er löst das Problem an der Wurzel und bleibt auch dann
   richtig, wenn später jemand eine Animation auf das Panel legt.
2. **`ConfirmDialog` bekommt denselben Portal-Weg** (`ConfirmDialog.tsx` Zeile 53–86). Ohne das
   säße die Bestätigung, die aus dem Wechsel-Dialog heraus geöffnet wird, wieder im Panel des
   Wechsel-Dialogs fest — dasselbe Problem eine Ebene höher.
3. **Zusätzlich entfällt `transform` aus `Modal.tsx` Zeile 59.** Kein Aufrufer legt eine
   Translate-, Scale-, Rotate- oder Skew-Utility auf das Panel; der erzeugte Wert ist heute die
   Identität, das Entfernen ist visuell folgenlos. `transition-all` bleibt stehen und wirkt
   weiter. Das ist die zweite Verteidigungslinie: Sie schützt auch künftige `fixed`-Nachfahren
   (Tooltips, Dropdowns), die kein Portal benutzen.

**z-Ebenen-Regel** (Phase 13 schreibt sie unverändert fort):

| Ebene | Klasse | Was |
|-------|--------|-----|
| 1 | `z-50` (Default) | `EditUserModal` |
| 2 | `z-[60]` | `WorkTimeChangeModal` |
| 3 | `z-[70]` | `ConfirmDialog`, der aus einer Ebene-2-Komponente heraus geöffnet wird |

`Modal` **und** `ConfirmDialog` bekommen dafür dieselbe Prop-Signatur:
`zIndexClass?: string` mit Default `'z-50'`, gesetzt auf dem äußersten `fixed inset-0`-Element
(`Modal.tsx` Zeile 44, `ConfirmDialog.tsx` Zeile 54). **`ConfirmDialog` baut nicht auf `Modal` auf**
— er nutzt `Card` (`ConfirmDialog.tsx` Zeile 9, 55) und erbt deshalb nichts. Ohne die eigene Prop
läge die Rückwirkungs-Bestätigung **hinter** dem Wechsel-Dialog, und der rückwirkende Speicherpfad —
das Kernszenario von REQ-26 — wäre unbedienbar.

> **Abstimmung mit Phase 13.** `13-UI-SPEC.md` hat denselben Befund unabhängig erhoben und führt
> `zIndexClass?: string` (Default `'z-50'`) für `ConfirmDialog` als Abhängigkeit von Phase 12.
> **Phase 12 führt die Prop mit exakt dieser Signatur ein; Phase 13 setzt sie nur noch.** Phase 13
> ergänzt darauf aufbauend drei weitere additive Props (`details`, `confirmDisabled`,
> `closeOnConfirm`) — die sind **nicht** Teil von Phase 12 und werden hier auch nicht
> vorweggenommen.

**Begründung für die Verschachtelung (vom Orchestrator entschieden):** Die Alternative — das
`EditUserModal` zu schließen und den Dialog von `UserManagementPage` aus zu öffnen — verwirft die
übrigen, nicht gespeicherten Stammdatenänderungen des Admins. Ein verlorenes Formular ist der
schlechtere Handel als zwei überlagerte Ebenen.

#### Modal-Stack: ESC, Scroll-Lock, Fokus — vollständig neu in Revision 2

**Der Befund.** `Modal.tsx` Zeile 15–32 registriert den Escape-Handler **pro Instanz auf
`document`**. Bei zwei offenen Modalen feuern beide Handler auf denselben Tastendruck: ESC im
Wechsel-Dialog schließt zusätzlich das `EditUserModal` — und verwirft damit genau die ungespeicherten
Stammdatenänderungen, um deren Erhalt willen die Verschachtelung überhaupt gewählt wurde.
`ConfirmDialog` hat **gar keine** ESC-Behandlung. Die Aussage der Vorfassung, ESC sei „durch `Modal`
bzw. `ConfirmDialog` bereits abgedeckt", war gegen den Quellcode falsch und ist gestrichen.

**Festlegung: ein modulweiter Stack, kein bloßer Zähler.** Neue Datei
`desktop/src/components/ui/modalStack.ts` (neuer Code, kein Eingriff in Bestand):

- `pushModal(id: symbol)` — hängt die Instanz oben an und setzt `document.body.style.overflow = 'hidden'`.
- `popModal(id: symbol)` — entfernt genau diese Instanz (`lastIndexOf` + `splice`, nicht `pop`) und
  setzt `document.body.style.overflow = 'unset'` **nur**, wenn der Stack danach leer ist.
  **Index-Guard ist Pflicht:** `const i = stack.lastIndexOf(id); if (i === -1) return;` — bei einer
  unbekannten `id` liefert `lastIndexOf` `-1`, und `splice(-1, 1)` entfernt in JavaScript den
  **letzten** Eintrag, also den eines fremden Modals. Der Stack bliebe dann dauerhaft nicht leer und
  `document.body.style.overflow` bis zum Neustart auf `'hidden'` stehen. Heute ist dieser Fehler
  unmöglich, weil `Modal.tsx` Zeile 30 bedingungslos auf `'unset'` zurücksetzt — der Stack führt
  die Möglichkeit also neu ein und muss sie selbst schließen.
- `isTopModal(id: symbol): boolean` — wahr, wenn die Instanz das oberste Element ist.

**Die Instanz-`id` ist stabil.** Sie wird als `const idRef = useRef(Symbol('modal'))` gehalten und
nie neu erzeugt. Zwingend, weil `isTopModal(id)` im Render-Scope ausgewertet wird (Fokusfalle,
Fokusring) und eine bei jedem Render neue `id` weder wiedergefunden noch abgemeldet werden könnte.

**Fremder Schreiber auf demselben Global — bewusst nicht eingebunden.**
`desktop/src/components/privacy/PrivacyPolicyModal.tsx` setzt `document.body.style.overflow` in
Zeile 27 und 31 unabhängig vom Stack und ist in `App.tsx` Zeile 190 montiert. Er **nimmt nicht am
Stack teil**: Das Datenschutz-Gate läuft vor jeder Bedienung der Anwendung, eine Überlappung mit
einem Stack-Modal ist ausgeschlossen. Schlösse er dennoch, während ein Stack-Modal offen ist, käme
das Scrollen hinter dem Modal zurück — ein rein kosmetischer Effekt in einem Zustand, den es nicht
gibt. Die Datei wird von dieser Phase nicht angefasst.

`Modal` **und** `ConfirmDialog` nehmen am selben Stack teil. Verbindliche Regeln für beide:

1. **An `isOpen` gebunden.** Der Registrier-Effekt beginnt mit `if (!isOpen) return;`. Die heutige
   Cleanup-Funktion (`Modal.tsx` Zeile 28–31) läuft **auch bei `isOpen === false`**; ein
   unbedingtes Abmelden im Cleanup ließe den Stack in einen inkonsistenten Zustand laufen und den
   Scroll-Lock zu früh fallen.
2. **Effekt-Abhängigkeit ist ausschließlich `[isOpen]`.** Heute steht dort `[isOpen, onClose]`
   (Zeile 32). `onClose` ist bei **allen** Aufrufern eine Inline-Funktion (belegt in
   `UserManagementPage.tsx` Zeile 526, `onClose={() => setEditingUser(null)}`) und damit bei jedem
   Render neu — der Effekt liefe bei jedem Render neu an. `onClose` wird stattdessen über eine
   `useRef` gehalten, die bei jedem Render aktualisiert wird, und im Handler als
   `onCloseRef.current()` aufgerufen.
3. **ESC wirkt nur für die oberste Instanz.** Der Handler prüft `isTopModal(id)` und ruft
   `e.stopPropagation()`, bevor er schließt. Ein Tastendruck schließt genau ein Modal.
4. **Reihenfolge der Hooks.** `ConfirmDialog.tsx` Zeile 32 hat heute `if (!isOpen) return null;`
   **vor** allem anderen. Die neuen Hooks müssen **oberhalb** dieser Zeile stehen, sonst verletzt
   die Komponente die Rules of Hooks. Die frühe Rückgabe bleibt, sie wandert nur hinter die Hooks.
5. **Kein `disableEscape`-Prop.** In Zustand 12 („Speichern läuft") übergibt der Aufrufer
   `onClose={isSaving ? () => {} : handleClose}`. Damit sind ESC **und** Backdrop-Klick
   (`Modal.tsx` Zeile 48) in einem Zug wirkungslos, ohne dass die Primitive eine weitere Prop
   bekommt.

**Fokus.** `Modal` hat heute weder `role="dialog"` noch `aria-modal`, keine Fokusfalle und keine
Fokusrückgabe. Verbindlich für `Modal` und `ConfirmDialog`:

- Das Panel trägt `role="dialog" aria-modal="true"` und ist über `aria-labelledby` mit dem
  Titel-`<h2>` verknüpft (`Modal.tsx` Zeile 65).
- **Fokus-Containment auf der obersten Instanz.** Ein `keydown`-Handler auf dem Panel fängt `Tab`
  ab, ermittelt die fokussierbaren Elemente innerhalb des Panels und schließt den Ring
  (vorwärts vom letzten auf das erste, mit `Shift` rückwärts). Der Handler ist inaktiv, solange
  `isTopModal(id)` falsch ist — sonst kämpfen zwei Fallen um denselben Tastendruck.
- **Fokusrückgabe.** Beim Öffnen merkt sich die Instanz `document.activeElement`; beim Schließen
  gibt sie den Fokus dorthin zurück, sofern das Element noch im Dokument hängt. Konkret für diese
  Phase:
  - Schließen des Wechsel-Dialogs (ESC, Backdrop, „Abbrechen", Erfolg) → Fokus zurück auf den
    Button **„Stundenwechsel ab Datum …"** im `EditUserModal`.
  - Schließen des `ConfirmDialog` (ESC, X, „Zurück zur Vorschau") → Fokus zurück auf den
    **Primärbutton des Wechsel-Dialogs**.
  - Schließen des `EditUserModal` → Fokus zurück auf die auslösende Zeilenaktion in
    `UserManagementPage.tsx` (Zeile 464).

### 2. Der Wechsel-Dialog — `desktop/src/components/worktime/WorkTimeChangeModal.tsx` (neu)

**Ablageort entschieden (vom Orchestrator):** `worktime/`, nicht `users/`. Die Fachdomäne ist das
Arbeitszeitmodell, und Phase 13 legt Bearbeiten/Löschen/Storno daneben. `users/` bliebe sonst der
Ort für Perioden-UI, obwohl dort nur Stammdaten wohnen.

- `<Modal size="lg" zIndexClass="z-[60]" title="Stundenwechsel: {Vorname} {Nachname}">`
  → `max-w-2xl` (`Modal.tsx` Zeile 39), gleiche Breite wie `EditUserModal` und
  `OvertimeCorrectionModal`.
- Der Dialog wird **außerhalb** des `<form>` von `EditUserModal` gerendert (Abschnitt 1,
  *Formulargrenzen im verschachtelten Baum*). Sein eigener `onSubmit`-Handler ruft
  `e.preventDefault()` **und** `e.stopPropagation()`. Jeder Button außer dem Primärbutton trägt
  ausdrücklich `type="button"`.
- Innen ein `<form className="space-y-6">`, Struktur exakt nach dem Vorbild
  `OvertimeCorrectionModal.tsx`:

| Reihenfolge | Inhalt |
|---|---|
| 1 | Mitarbeiter-Infopanel (blau) mit Name, Eintrittsdatum und dem aktuell gültigen Modell: „Aktuell gültig seit {TT.MM.JJJJ}: {X,X} h/Woche" — bei Ladefehler der Perioden der Fallbacktext aus dem Textbuch |
| 2 | Formularfehler-Banner (rot, nur bei `formError`) |
| 3 | `grid grid-cols-1 md:grid-cols-2 gap-6`: links `Input type="date"` **Stichtag**, rechts `Input type="number" min="0" max="60" step="0.5"` **Neue Wochenstunden** |
| 4 | Überschrift „Neuer Tagesplan" (`text-lg font-semibold`) + `WorkScheduleEditor` (voll bedienbar, `readOnly` nicht gesetzt) |
| 5 | `Textarea` **Begründung**, `rows={4}`, `required`, mit Zeichenzähler |
| 6 | **Vorschaupanel** (Abschnitt 3) |
| 7 | Aktionszeile `flex justify-end gap-3`: `Button variant="secondary"` „Abbrechen", `Button variant="primary"` mit kontextabhängigem Label |

- Beim Öffnen wird der Tagesplan mit dem aktuell gültigen Plan des Nutzers vorbelegt und die
  Wochenstunden mit dem aktuell gültigen Wert. Konnten die Perioden nicht geladen werden, wird mit
  den Stammdatenwerten aus `user` vorbelegt und der Fallbacktext im Infopanel gezeigt — der Dialog
  bleibt in jedem Fall benutzbar. Der Stichtag ist **leer** — kein Vorbelegen mit „heute".
  Begründung: Ein vorbelegter Stichtag wird versehentlich stehen gelassen; ein leeres Pflichtfeld
  erzwingt eine bewusste Entscheidung, und der Stichtag ist die folgenreichste Eingabe des Dialogs.
- Alle Serveraufrufe laufen über `universalFetch` aus `../../lib/tauriHttpClient`
  (`.claude/CLAUDE.md`, Critical Rules — Browser-`fetch()` verliert in Tauri die Session-Cookies).
- Datumsberechnungen im Frontend **niemals** über `toISOString().split('T')[0]`. Für die Anzeige
  gilt das Muster `new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')` aus
  `OvertimeTransactions.tsx`/`VacationTransactions.tsx`.

### 3. Die Vorschau (REQ-27)

Die Werte kommen ausschließlich vom Server (CONTEXT **D2**). Es wird nichts im Frontend gerechnet —
auch keine Zwischensumme, auch keine „Differenz = neu − alt" auf Anzeigeebene. Die Vorschau
rendert, was der Server liefert.

**Auslösung:** automatisch, 400 ms entprellt, sobald Stichtag und Wochenstunden gültig sind. Die
Begründung löst **keine** Neuberechnung aus.

#### `previewToken` — vollständig spezifiziert (Revision 2)

**Gebundene Felder.** Das Token bindet genau `{ userId, validFrom, weeklyHours, workSchedule }` —
und **ausdrücklich nicht die Begründung**. Andernfalls würde das Tippen der Pflichtbegründung nach
der Vorschau das Token entwerten und bei jedem Speicherversuch Zustand 14 auslösen; der Dialog wäre
in der üblichen Bedienreihenfolge (erst Werte, dann Vorschau lesen, dann begründen) nie speicherbar.

**Form und Lebensdauer.** Zustandslos: ein Hash über die vier gebundenen Felder plus einen
Ausstellungszeitstempel, serverseitig signiert. Kein Serverspeicher, keine Tabelle, kein
Neustartproblem — nach einem Serverneustart bleiben ausgestellte Token gültig. **Gültigkeitsdauer:
15 Minuten.** Danach lehnt der Server ab wie bei einem veralteten Token, und der Dialog geht in
Zustand 14.

**Verwerfen erfolgt synchron.** Jede Änderung an Stichtag, Wochenstunden oder Tagesplan verwirft
Vorschau und Token **im selben State-Update wie die Feldänderung**, nicht im entprellten Callback.
Im entprellten Callback zu verwerfen ließe ein Fenster von 400 ms offen, in dem der Primärbutton
noch aktiv ist und ein veraltetes Token verschickt werden kann — genau die Abweichung zwischen
angezeigter und gebuchter Zahl, die REQ-27 ausschließt.

**Kopplung an das Speichern (Kern von REQ-27):** Der primäre Button ist deaktiviert, solange kein
Token zu genau den aktuellen Eingaben vorliegt. Das Speichern schickt es mit. Weist der Server es
zurück, wird nicht gespeichert.

**Ausgang bei wiederholtem Fehlschlag.** Der erste abgelehnte Speicherversuch führt in Zustand 14:
Meldung, automatische Neuberechnung, Primärbutton bis dahin gesperrt. Wird der **zweite** Versuch
in Folge ebenfalls abgelehnt, gibt es **keine** dritte automatische Neuberechnung. Der Dialog fällt
in Zustand 5 zurück (rotes Panel, Button „Vorschau erneut berechnen") mit dem Text „Die Vorschau
konnte nicht in einen speicherbaren Zustand gebracht werden. Bitte berechnen Sie sie erneut." Damit
kann keine Schleife aus automatischer Neuberechnung und automatischer Ablehnung entstehen.

**Panelvarianten:**

| Fall | Fläche | Icon | Badge |
|------|--------|------|-------|
| Stichtag heute oder in der Zukunft | `bg-blue-50 dark:bg-blue-900/20`, `border-blue-200 dark:border-blue-800` | `Info` (blue-600/400) | „Keine Rückwirkung" (blue) |
| Stichtag in der Vergangenheit | `bg-amber-50 dark:bg-amber-900/20`, `border-amber-200 dark:border-amber-800` | `AlertTriangle` (amber-600/400) | „Rückwirkend" (amber) |
| Fehler | `bg-red-50 dark:bg-red-900/20`, `border-red-200 dark:border-red-800` | `AlertCircle` (red-600/400) | — |
| Werte identisch mit der gültigen Periode | `bg-gray-50 dark:bg-gray-800`, `border-gray-200 dark:border-gray-700` | `Info` (gray-500/400) | — |
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
   `TrendingUp`/`TrendingDown` — identisch zur Darstellung im Kontoauszug. **Das ist der visuelle
   Anker des Dialogs.**
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

**Die Liste ist reine Anzeige (Revision 2).** Sie ist **keine** Voraussetzung für das Speichern.
Die Überlappungsprüfung liegt serverseitig (CONTEXT **D6**, **D7**) und läuft in derselben
Transaktion wie das Anlegen. Das Frontend blockiert deshalb nie deshalb, weil die Liste nicht
geladen werden konnte — siehe Zustand 2.

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
- Zustände: Ladezustand `LoadingSpinner` zentriert mit `py-8`; Fehlerzustand `AlertCircle` +
  „Perioden konnten nicht geladen werden: {Meldung}" in red-600/400 **plus**
  `<Button variant="secondary" size="sm">Perioden erneut laden</Button>`; Leerzustand mit dem
  Textbuch-Eintrag oben.
- Umbruch: `<div className="overflow-x-auto">` um die Tabelle, wie im Bestand.

### 5. Sichtbarkeit im Kontoauszug (REQ-29) — `desktop/src/components/worktime/OvertimeTransactions.tsx`

Erweiterung der bestehenden Komponente, kein neues Bauteil:

- Neuer Typ `model_change` in `getTypeLabel` → „Modellwechsel", in `getTypeDescription` →
  „Saldodifferenz aus einer rückwirkenden Umstellung des Arbeitszeitmodells", in
  `getTypeBadgeColor` → `bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300`.
- `isAbsenceType` bleibt unberührt.
- **Die Zeile ist eine Dokumentationszeile ohne Rechenwirkung (Revision 4, nachgezogen aus
  Server-CR-01).** Sie kommt mit `hours: 0` und trägt ihren Betrag in einem eigenen Feld
  `documentedDelta`. Begründung: Die Wirkung der Umstellung steckt bereits in den neu
  gerechneten Tageszeilen ab dem Stichtag. Ein zusätzlich summierender Journalbetrag würde
  denselben Betrag ein zweites Mal zählen — die Summe der angezeigten Zeilen läge dann um
  genau diesen Betrag über dem daneben angezeigten Saldo.
- Daraus folgt für die Darstellung der Stundenspalte dieser Zeile — verbindlich:
  - **Kein Trendpfeil.** `TrendingUp`/`TrendingDown` bleiben den summierenden Zeilen
    vorbehalten. Richtung und Bedeutung tragen Vorzeichen und Farbe; die Farbe ist damit nie
    alleiniger Träger.
  - **Eigene Beschriftung** `dokumentierte Differenz` in `text-xs text-gray-500
    dark:text-gray-400` unmittelbar über dem Betrag. „0,0 h" wäre für den Leser falsch — die
    Umstellung **hat** einen Betrag bewirkt, er steht nur nicht in dieser Zeile.
  - **Betrag** in `font-bold` (700 bleibt also am vorzeichenbehafteten Stundenwert, wie in der
    Gewichtetabelle zugesagt), dreiwegig gefärbt über `documentedDeltaToneClass()`:
    green-600/400 bei > 0, red-600/400 bei < 0, gray-600/400 bei 0. Nulldifferenz wird als
    **± 0:00h** ausgegeben (`formatDocumentedDelta()`) — dasselbe Muster wie im Vorschaupanel
    des Wechsel-Dialogs.
  - **Fußnote unter der Tabelle**, sichtbar nur, wenn mindestens eine `model_change`-Zeile in
    der Liste steht (Wortlaut im Textbuch, Abschnitt „Kontoauszug").
  - Beide Formatierfunktionen liegen in `desktop/src/components/worktime/overtimeTransactionFormat.ts`
    und sind dort ohne Vite mit `npx tsx` + `node:assert` prüfbar.
- **Verhältnis zu REQ-27** („die Zahl in der Vorschau ist dieselbe, die danach im Kontoauszug
  steht"): unverändert erfüllt. Die Vorschau zeigt die Saldoänderung, die Journalzeile zeigt
  denselben Wert als `documentedDelta` — gleiche Zahl, gleiches Format, gleiche Farbe. Nur der
  Trendpfeil entfällt, und die Zeile sagt ausdrücklich dazu, dass sie nicht mitsummiert.
- Die Spalte **Datum** trägt den **Stichtag** der Periode, nicht den Eintragungstag. Die Liste ist
  nach `createdAt DESC, id DESC` sortiert (Phase-8-Entscheidung); deshalb bekommt die
  Beschreibungszelle eine zweite Zeile in `text-xs text-gray-500 dark:text-gray-400` mit
  „Periode ab {TT.MM.JJJJ} · eingetragen am {TT.MM.JJJJ} von {Admin}". Ohne diese Zeile wirkt eine
  rückdatierte Buchung an ihrer Listenposition unerklärlich.
- **Bekannte, akzeptierte Einschränkung:** Wird im Bericht ein Monat/Jahr gefiltert, in dem der
  Stichtag nicht liegt, erscheint die Zeile nicht — dasselbe Verhalten wie bei jeder anderen
  Buchung. Der Saldo im Kopf der Karte bleibt der Gesamtsaldo. Kein Sonderweg für diesen Typ.

---

## Änderungen an Bestandskomponenten

Vollständige Liste. Alles darüber hinaus bleibt unangetastet.

### A. Infrastruktur — vier Dateien

| Datei | Änderung | Warum additiv |
|-------|----------|---------------|
| `desktop/src/components/ui/Modal.tsx` | **(1)** Overlay über `createPortal(…, document.body)` rendern. **(2)** `transform` aus Zeile 59 entfernen (`transition-all` bleibt). **(3)** Neue optionale Prop `zIndexClass?: string`, Default `'z-50'`, auf Zeile 44. **(4)** Teilnahme am Modal-Stack: `pushModal`/`popModal`/`isTopModal`; Registrierung an `isOpen` gebunden, Effekt-Abhängigkeit nur `[isOpen]`, `onClose` über `useRef`. **(5)** ESC schließt nur, wenn die Instanz oberste ist. **(6)** `role="dialog" aria-modal="true" aria-labelledby`, Fokusfalle, Fokusrückgabe auf das zuvor fokussierte Element. **(7)** `aria-label="Close modal"` (Zeile 73) → `"Dialog schließen"`. | Kein bestehender Aufrufer übergibt `zIndexClass` → alle bleiben auf `z-50`. Das Overlay ist bereits `fixed inset-0`, sein Aussehen hängt nicht am DOM-Ort; keine CSS-Regel im Projekt selektiert es über seine Baumposition. `transform` erzeugt heute die Identitätstransformation, das Entfernen ist visuell folgenlos. Der Stack ersetzt das unbedingte `overflow = 'unset'` durch ein bedingtes — bei nur einem offenen Modal (dem heutigen Normalfall) ist das Verhalten identisch. ESC-Verhalten bei einem einzelnen Modal unverändert. Fokusfalle und Rollen sind reine Ergänzungen. Der `aria-label`-Text ist unsichtbar und war zuvor als einziger Text der Komponente englisch. |
| `desktop/src/components/ui/ConfirmDialog.tsx` | **(1)** Overlay über `createPortal(…, document.body)` (Zeile 53–86). **(2)** Neue optionale Prop `zIndexClass?: string`, Default `'z-50'`, auf Zeile 54. **(3)** Teilnahme am selben Modal-Stack, inkl. ESC = Abbrechen für die oberste Instanz — die Komponente hat heute **gar keine** ESC-Behandlung. Die Hooks stehen **oberhalb** von `if (!isOpen) return null;` (Zeile 32). **(4)** `role="dialog" aria-modal="true"`, Fokusfalle, Fokusrückgabe. **(5)** X-Button (Zeile 64–69) bekommt `aria-label="Abbrechen"` — er hat heute keinen zugänglichen Namen. **(6)** Die beiden `console.log`-Aufrufe in Zeile 35 und 41 werden entfernt. | Kein bestehender Aufrufer übergibt `zIndexClass` → alle bleiben auf `z-50`. Portal ändert die Darstellung nicht (`fixed inset-0`). ESC ist neu und schließt nur die oberste Instanz — kein Bestandsverhalten geht verloren, weil es keines gab. `aria-label` ist unsichtbar. Die `console.log`-Zeilen verstoßen gegen die Pre-Commit-Regel in `.claude/CLAUDE.md` („Debug console.logs entfernt"); die Datei wird ohnehin angefasst. Die Prop-Signatur ist mit `13-UI-SPEC.md` abgestimmt. |
| `desktop/src/pages/UserManagementPage.tsx` | Der lokale State hält nur noch die **ID**: `const [editingUserId, setEditingUserId] = useState<number \| null>(null)` (heute Zeile 38: `useState<User \| null>`). Das Objekt wird bei jedem Render aus der bestehenden Nutzerquery abgeleitet: `const editingUser = users?.find(u => u.id === editingUserId) ?? null;`. Zeile 464 `setEditingUser(user)` → `setEditingUserId(user.id)`. Zeile 523–527 bleiben in ihrer Form (`{editingUser && <EditUserModal … user={editingUser} />}`). **Zusätzlich:** die neun `console.log`-Aufrufe im Löschpfad (Zeile 128–131, 139, 147, 148, 152, 153) werden entfernt. | Rein lokale Zustandsführung derselben Seite, keine Prop- oder Signaturänderung nach außen. `EditUserModal` bekommt weiterhin ein vollständiges `User`-Objekt. Verschwindet der Nutzer aus der Liste (Löschung), liefert `find` `undefined`, das Modal schließt und `editingUserId` wird zurückgesetzt — das ist in genau diesem Fall auch das richtige Verhalten. Die `console.log`-Entfernung ist reines Streichen von Debugausgaben ohne Steuerfluss; `.claude/CLAUDE.md` führt „Debug console.logs entfernt" als Pre-Commit-Quality-Gate (Zeile 629) und „`console.log` in Production → Entfernen vor Commit" als Verbot (Zeile 571). Die Ausgaben schreiben Nutzer-ID, Nutzername und die ID des angemeldeten Admins in die Browser-Konsole — in einer Personalverwaltung ist das nicht nur unsauber. **`console.error` in Zeile 155–156 und `console.warn` in Zeile 134 bleiben stehen:** das sind Fehler- bzw. Guard-Pfade, keine Debugausgaben. |
| `desktop/src/components/users/WorkScheduleEditor.tsx` | **(1)** Neue optionale Prop `readOnly?: boolean` (Default `false`): setzt `disabled` auf den Toggle (Zeile 90) und auf alle Tagesfelder (Zeile 127) und ergänzt dort die Kontrastklassen `disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed` — **kein `opacity`**. **(2)** `grid grid-cols-2 gap-3` (Zeile 110) → `grid grid-cols-1 sm:grid-cols-2 gap-3`. | `readOnly` ist optional mit Default `false`; jeder bestehende Aufruf (`EditUserModal.tsx` Zeile 274–277) verhält sich unverändert. Die `disabled:`-Klassen wirken ausschließlich im neuen Zustand. Der Breakpoint verbessert die Darstellung unterhalb 640 px und ändert oberhalb davon nichts. |

### B. Fachlich erweiterte Bestandskomponenten (in Abschnitt 1 und 5 beschrieben)

| Datei | Änderung | Warum additiv |
|-------|----------|---------------|
| `desktop/src/components/users/EditUserModal.tsx` | Wochenstundenfeld schreibgeschützt, `WorkScheduleEditor` mit `readOnly`, Hinweispanel mit Einstiegs-Button, Periodenliste, Dialogsteuerung, Erfolgsbanner. Zusätzlich: der Reset-Effekt (Zeile 41–54) bekommt als Abhängigkeit **`[user.id]` statt `[user]`**, und ein zweiter, schmaler Effekt synchronisiert **nur** `weeklyHours` und `workSchedule`, wenn sich diese beiden Werte in `user` ändern. Der Sync-Effekt vergleicht **Werte, nicht Objektidentitäten**: Abhängigkeit ist `user.weeklyHours` zusammen mit einer stabilen Serialisierung von `user.workSchedule`, nicht das Objekt selbst. **Zusätzlich:** die fünf `console.log`-Aufrufe im Absende-Pfad (Zeile 103–106 und 123) werden entfernt. | Sonst wäre der B4-Fix ein Rückschritt: `user` ist nach der Umstellung auf die abgeleitete Query bei jedem Refetch ein **neues Objekt**; ein Effekt mit `[user]` würde dann alle Formularfelder — auch die vom Admin gerade getippten Namen und E-Mail-Adressen — zurücksetzen. `[user.id]` behält das heutige Verhalten (Reset nur beim Nutzerwechsel). Der schmale Sync-Effekt betrifft ausschließlich die beiden Felder, die in dieser Phase schreibgeschützt sind — dort kann er keine Eingabe zerstören. Der Wertvergleich ist trotzdem Pflicht: `user.workSchedule` ist ein Objekt und wechselt bei jedem Refetch die Identität, der Effekt liefe also bei jedem Refetch mit. In Phase 12 wäre das folgenlos, in Phase 13 — dort ist der Editor wieder bedienbar — nicht mehr. Der Vertrag soll nicht darauf bauen, dass die Folgephase daran denkt. Die `console.log`-Entfernung ändert keinen Steuerfluss und verletzt kein Verhalten; sie erfüllt das Pre-Commit-Quality-Gate „Debug console.logs entfernt" (`.claude/CLAUDE.md` Zeile 629) und das Verbot in Zeile 571. Der Block gibt heute Nutzer-ID, Eintritts- und Austrittsdatum sowie das vollständige `updateData`-Objekt — inklusive E-Mail, Abteilung und Position — in die Browser-Konsole aus. **`console.error` in Zeile 134 bleibt stehen:** das ist Fehlerbehandlung, keine Debugausgabe. |
| `desktop/src/components/worktime/OvertimeTransactions.tsx` | Typ `model_change` in `getTypeLabel`, `getTypeDescription`, `getTypeBadgeColor`; zweite Beschreibungszeile mit Periodenbezug. | Nur neue Zweige in bestehenden Zuordnungsfunktionen; kein bestehender Typ ändert sein Aussehen. |

### C. Neue Dateien

| Datei | Zweck |
|-------|-------|
| `desktop/src/components/ui/modalStack.ts` | Modulweiter Stack offener Modale: `pushModal`, `popModal`, `isTopModal`. Kein Bestandseingriff. |
| `desktop/src/components/worktime/WorkTimeChangeModal.tsx` | Der Wechsel-Dialog (Abschnitt 2) |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` | Die Periodenliste (Abschnitt 4) |

### D. Testbestand — eine Datei

Der Schreibschutz auf dem Feld „Wochenstunden" bricht genau **eine** Zusicherung im E2E-Bestand.
Die Datei gehört damit in diese Liste; „additiv" ohne geprüften Testbestand wäre eine unbelegte
Behauptung.

| Datei | Änderung | Art |
|-------|----------|-----|
| `desktop/tests/user-edit.spec.ts` | Der Test **„Change employee to 0 hours (critical bug fix test)"** (Zeile 85–115) füllt in Zeile 104 `[name="weeklyHours"]` mit `'0'`, **innerhalb** des Bearbeiten-Dialogs (Zeile 102 wartet auf `text=Benutzer bearbeiten:`). Gegen ein `readOnly`-Feld schlägt `page.fill()` hart fehl. Der Test wird so umgeschrieben, dass die Umstellung auf 0 h über den neuen Wechsel-Dialog läuft — fachlich ist genau dorthin die Aktion gewandert. In **demselben** Test wird zusätzlich der Selektor `button[aria-label="Bearbeiten"]` (Zeile 101) durch `button:has-text("Bearbeiten")` ersetzt, weil er sonst schon vorher scheitert. | verhaltensgleich in der Absicht, neuer Bedienweg |

**Geprüfter Umfang (21.08.2026), damit die Abgrenzung belegt ist:**

- In `user-edit.spec.ts` füllen sieben weitere Stellen `[name="weeklyHours"]` (Zeile 32, 64, 94,
  125, 172, 211, 243). Alle liegen **vor** `page.click('button:has-text("Benutzer erstellen")')`,
  also im `CreateUserModal`. Dort bleibt das Feld bedienbar — `readOnly` gilt ausschließlich im
  `EditUserModal`. Kein Anpassungsbedarf.
- `edge-cases.spec.ts` und `user-creation.spec.ts` füllen `weeklyHours` ausnahmslos im
  Anlege-Dialog. Kein Anpassungsbedarf.
- Der Test „Switch from individual workSchedule to normal hours" greift in Zeile 146–153 im
  Bearbeiten-Dialog auf `input[type="checkbox"]` zu. Ein solches Element existiert im
  `WorkScheduleEditor` nicht (der Toggle ist ein `<button>`, Zeile 90); der Zugriff steht hinter
  `if (await checkbox.count() > 0)` und ist ein toter Zweig. Die neue `readOnly`-Prop bricht ihn
  daher nicht.

**Vorbestehender Mangel, ausdrücklich nicht Gegenstand dieser Phase:** `user-edit.spec.ts` greift an
**acht** Stellen auf `button[aria-label="Bearbeiten"]` zu. Dieses Attribut existiert nicht —
`UserManagementPage.tsx` Zeile 461–467 rendert `<Button size="sm" variant="ghost">Bearbeiten</Button>`
ohne `aria-label`. Die Datei ist also bereits vor Zeile 104 rot, unabhängig von dieser Phase.
Repariert wird der Selektor nur in dem einen Test, der ohnehin umgeschrieben wird; die übrigen
sieben Vorkommen bleiben stehen und sind als eigener Defekt zu führen. **Kein Aufräumfeldzug.**

**Debugausgaben — abschließende Regelung.** In den Dateien, die diese Phase ohnehin verändert, wird
**jeder** `console.log` entfernt: `ConfirmDialog.tsx` Zeile 35 und 41 (2), `EditUserModal.tsx`
Zeile 103–106 und 123 (5), `UserManagementPage.tsx` Zeile 128–131, 139, 147, 148, 152 und 153 (9)
— zusammen **16 Aufrufe**. `Modal.tsx`, `WorkScheduleEditor.tsx` und `OvertimeTransactions.tsx`
enthalten keine (geprüft am 21.08.2026). `console.error` (`EditUserModal.tsx` Zeile 134,
`UserManagementPage.tsx` Zeile 155–156) und `console.warn` (`UserManagementPage.tsx` Zeile 134)
bleiben unangetastet — Fehler- und Guard-Pfade sind keine Debugausgaben.

Grundlage: `.claude/CLAUDE.md` Zeile 629 („Debug console.logs entfernt" als Pre-Commit-Quality-Gate)
und Zeile 571 („`console.log` in Production → Entfernen vor Commit"). Erschwerend kommt hinzu, dass
die betroffenen Ausgaben Personendaten in die Browser-Konsole schreiben — Nutzer-ID, Name,
Eintritts- und Austrittsdatum, E-Mail, Abteilung, Position.

**Kein Aufräumfeldzug.** Dateien, die diese Phase nicht ohnehin verändert, bleiben unberührt, auch
wenn sie `console.log` enthalten.

**Beobachtete, hier nicht behobene Altlasten** (vermerkt, damit sie nicht als neu eingeführter
Mangel gewertet werden): `EditUserModal.tsx` nutzt in Zeile 197, 216, 238 und 280 starre
`grid-cols-2`/`grid-cols-3` ohne Breakpoint; `OvertimeTransactions.tsx` typisiert Transaktionen als
`any`. Beides liegt im Renderpfad bestehender Funktionen und wird in dieser Phase bewusst nicht
angefasst („NO REGRESSION"). Neuer Code dieser Phase führt keines dieser Muster fort: keine neuen
`console.log`, kein `any`, jedes neue Raster mit Breakpoint.

> **Hinweis für Phase 13:** `13-UI-SPEC.md` führt die beiden `console.log` in `ConfirmDialog.tsx`
> noch als offene Altlast. Phase 12 entfernt sie bereits; der Vermerk in Phase 13 ist damit
> gegenstandslos, nicht widersprüchlich. Sinngemäß gilt das auch für `EditUserModal.tsx` und
> `UserManagementPage.tsx`: Phase 13 nennt deren `console.log` nicht, findet sie aber ebenfalls
> bereits entfernt vor. Der Phase-13-Vermerk zu `EditUserModal.tsx` betrifft ausschließlich die
> starren `grid-cols` und bleibt gültig.

---

## Zustände — vollständige Liste

Jeder Zustand ist umzusetzen; `.claude/CLAUDE.md` führt Loading/Error-States als Quality Gate.

| # | Zustand | Darstellung |
|---|---------|-------------|
| 1 | Dialog öffnet, Perioden laden | Modal öffnet sofort, Infopanel und Periodenliste zeigen je einen zentrierten `LoadingSpinner` (`py-8`); Formularfelder sind bedienbar, Primärbutton deaktiviert (es liegt noch keine Vorschau vor) |
| 2 | **Periodenliste Fehler** | `AlertCircle` + „Perioden konnten nicht geladen werden: {Meldung}" in red-600/400, darunter `Button variant="secondary" size="sm"` **„Perioden erneut laden"**. Das Infopanel zeigt den Fallbacktext, die Felder sind mit den Stammdatenwerten vorbelegt. **Der Primärbutton wird dadurch NICHT gesperrt** — die Liste ist reine Anzeige, die Überlappungsprüfung liegt serverseitig (D6/D7). Einzige Folge: Zustand 10 kann keine Zeile hervorheben. |
| 3 | Vorschau noch nicht möglich | Graues Platzhalterpanel, Text „Die Vorschau erscheint, sobald Stichtag und neue Wochenstunden gesetzt sind.", Primärbutton deaktiviert |
| 4 | Vorschau lädt | Graues Panel, `LoadingSpinner size="sm"` + „Vorschau wird berechnet …", `aria-busy="true"`, Primärbutton deaktiviert |
| 5 | Vorschau Fehler | Rotes Panel + Button „Vorschau erneut berechnen", Primärbutton deaktiviert |
| 6 | Vorschau bereit — Stichtag Zukunft | Blaues Panel, Badge „Keine Rückwirkung", Primärbutton aktiv, Label „Stundenwechsel speichern" |
| 7 | Vorschau bereit — Stichtag Vergangenheit | Bernsteinfarbenes Panel, Badge „Rückwirkend", Primärbutton aktiv, Label „Rückwirkend speichern" |
| 8 | **Eingaben entsprechen der aktuell gültigen Periode** | **Graues** Panel (nicht rot — der Anwender hat nichts falsch gemacht), `Info`-Icon in gray-500/400, Text „Die eingegebenen Werte entsprechen der aktuell gültigen Periode ab {TT.MM.JJJJ}. Es gibt nichts umzustellen — ändern Sie die Wochenstunden oder den Tagesplan." Primärbutton deaktiviert, **kein** Feldfehler. Dieser Zustand ist der Regelfall unmittelbar nach Eingabe des Stichtags, weil der Dialog mit genau diesen Werten vorbelegt öffnet. |
| 9 | Validierungsfehler | Fehler am jeweiligen Feld über die `error`-Prop (`role="alert"` steckt bereits in `Input.tsx` Zeile 44); Fokus springt auf das erste fehlerhafte Feld; kein Serveraufruf |
| 10 | Stichtag überlappt bestehende Periode | Feldfehler am Stichtag. **Zusätzlich, sofern die Periodenliste geladen ist:** die betroffene Zeile wird mit `ring-2 ring-red-400` hervorgehoben. Ist die Liste in Zustand 2, trägt der Feldfehler die Information allein — er nennt das Datum im Klartext. |
| 11 | Bestätigung offen (nur rückwirkend) | `ConfirmDialog variant="warning" zIndexClass="z-[70]"` über dem Dialog; der Wechsel-Dialog bleibt sichtbar, aber nicht bedienbar (Fokusfalle liegt auf der Bestätigung); ESC schließt **nur** die Bestätigung |
| 12 | Speichern läuft | Primärbutton `disabled` mit `LoadingSpinner size="sm" className="mr-2"` + „Wird gespeichert …"; Abbrechen ebenfalls `disabled`; der Aufrufer übergibt `onClose={() => {}}`, wodurch ESC und Backdrop wirkungslos sind |
| 13 | Speichern fehlgeschlagen | Rotes Banner am Kopf des Formulars: „Der Stundenwechsel wurde nicht gespeichert. Es wurde nichts verändert. {Servermeldung}"; alle Eingaben bleiben erhalten; Vorschau bleibt stehen |
| 14 | Vorschau veraltet (Token abgelehnt) | Wie 13, Text „Die Vorschau ist nicht mehr aktuell. Sie wird gerade neu berechnet — bitte prüfen Sie danach die Werte und speichern Sie erneut."; Vorschau lädt automatisch neu, Primärbutton bis dahin gesperrt. **Beim zweiten Fehlschlag in Folge keine weitere automatische Neuberechnung**, sondern Rückfall in Zustand 5 mit dem Text „Die Vorschau konnte nicht in einen speicherbaren Zustand gebracht werden. Bitte berechnen Sie sie erneut." |
| 15 | Erfolg | Dialog schließt, Fokus kehrt auf „Stundenwechsel ab Datum …" zurück; `toast.success(...)`; im `EditUserModal` erscheint 8 s lang ein grünes Banner. Periodenliste **und** die schreibgeschützten Felder „Wochenstunden"/Tagesplan zeigen den neuen Wert — möglich, weil `UserManagementPage` nur noch die ID hält und das `user`-Objekt aus der invalidierten Query ableitet (siehe Änderungstabelle A). Ein Erfolgsbanner, das „ab {Datum} gelten {X,X} h/Woche" behauptet, während das Feld daneben den alten Wert zeigt, wäre ein Widerspruch in einem geschäftskritischen Feld. |

Der Abbruch-Weg (ESC, Backdrop, „Abbrechen") setzt das Formular vollständig zurück — inklusive
Vorschau, Fehlern und `previewToken` — nach dem Muster von `handleClose` in
`OvertimeCorrectionModal.tsx` und `EditUserModal.tsx` Zeile 138–159. Ausnahme: Zustand 12, dort ist
Abbrechen gesperrt.

---

## Responsive

Die App läuft als Tauri-Desktopfenster; die realistische Untergrenze ist ein schmal gezogenes
Fenster, nicht ein Telefon. Breakpoints wie im Bestand: `sm` 640, `md` 768, `lg` 1024.

| Bereich | < 640 px | 640–767 px | ≥ 768 px |
|---------|----------|------------|----------|
| Modalbreite | `max-w-2xl` mit `p-4` Außenabstand (`Modal.tsx` Zeile 53) — füllt die Breite | wie links | 672 px zentriert |
| Stichtag + Wochenstunden | untereinander (`grid-cols-1`) | untereinander | nebeneinander (`md:grid-cols-2`) |
| Tagesplan-Raster | 1 Spalte | 2 Spalten | 2 Spalten |
| Vorschau Sollstunden-Kennzahlen | untereinander (`grid-cols-1`) | 3 Spalten (`sm:grid-cols-3`) | 3 Spalten |
| Periodenliste | horizontal scrollbar (`overflow-x-auto`) | scrollbar | vollständig sichtbar |
| Aktionszeile | Buttons nebeneinander, rechtsbündig, `gap-3` | wie links | wie links |

**Eine Änderung am Bestand:** `WorkScheduleEditor.tsx` Zeile 110 nutzt heute ein festes
`grid grid-cols-2 gap-3`; das wird zu `grid grid-cols-1 sm:grid-cols-2 gap-3`. Verbessert beide
Einsatzorte, ändert oberhalb von 640 px nichts und ist damit regressionsfrei.

**Beobachtete, hier nicht behobene Altlast:** `EditUserModal.tsx` verwendet in Zeile 197, 216, 238
und 280 starre `grid-cols-2`/`grid-cols-3` ohne Breakpoint. Das ist außerhalb des Umfangs dieser
Phase und bleibt unangetastet — vermerkt, damit es nicht als neu eingeführter Mangel gewertet wird.

---

## Barrierefreiheit

- Beim Öffnen des Wechsel-Dialogs erhält das Feld **Stichtag** den Fokus.
- **ESC schließt genau ein Modal — das oberste.** Das ist neuer Code, kein Bestand: `Modal.tsx`
  registriert seinen Escape-Handler heute pro Instanz auf `document` (Zeile 15–32), sodass bei zwei
  offenen Modalen beide Handler feuern; `ConfirmDialog` hat heute überhaupt keine ESC-Behandlung.
  Der Modal-Stack (Abschnitt 1) stellt sicher, dass nur die oberste Instanz reagiert. In Zustand 12
  ist ESC über einen leeren `onClose` unterdrückt.
- **Fokusrückgabe beim Schließen** ist verbindlich: Wechsel-Dialog → Button
  „Stundenwechsel ab Datum …"; `ConfirmDialog` → Primärbutton des Wechsel-Dialogs;
  `EditUserModal` → auslösende Zeilenaktion.
- **`role="dialog" aria-modal="true"`** auf beiden Dialogtypen, verknüpft über `aria-labelledby`
  mit dem Titel. Fokus-Containment (Tab-Ring) auf der jeweils obersten Instanz.
- Vorschaupanel: `role="status" aria-live="polite" aria-busy`.
- Fehlermeldungen an Feldern kommen über die `error`-Prop und tragen dadurch `role="alert"`
  (`Input.tsx` Zeile 44).
- Das schreibgeschützte Wochenstundenfeld bekommt `aria-readonly="true"`, behält seinen sichtbaren
  Wert (Kontrast ≥ 4,5:1 in beiden Modi — deshalb `readOnly` statt `disabled`) und **bleibt im
  Tabulatorfluss**. Kein `tabIndex={-1}`.
- Die per `disabled` gesperrten Tagesfelder im `WorkScheduleEditor` tragen ausdrückliche
  Kontrastklassen statt der Browser-Standardabblendung (siehe Abschnitt 1), damit auch dort
  ≥ 4,5:1 erreicht wird.
- Zugängliche Namen ohne sichtbaren Text: `Modal` X-Button → „Dialog schließen" (heute englisch),
  `ConfirmDialog` X-Button → „Abbrechen" (heute ohne Namen).
- Farbe ist nie der alleinige Träger: Zukunft/Vergangenheit unterscheiden sich zusätzlich durch
  Badge-Text, Icon und Zeitraumsatz; positive/negative Stunden zusätzlich durch Vorzeichen und
  Trendpfeil; der Zustand „nichts zu tun" durch eigenen Text und eigenes Icon. In der
  `model_change`-Zeile des Kontoauszugs tritt an die Stelle des Trendpfeils das Vorzeichen
  zusammen mit der Beschriftung „dokumentierte Differenz" (Revision 4, Abschnitt 5) — auch dort
  trägt die Farbe die Bedeutung nicht allein.
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
(`react-dom` für `createPortal`, `lucide-react`, `sonner`, `@tanstack/react-query`).

---

## Herkunft der Festlegungen

| Quelle | Übernommene Entscheidungen |
|--------|----------------------------|
| `12-CONTEXT.md` | D1 getrennte Aktion + schreibgeschützte Stundenfelder · D2 Vorschau vom Server · D3 begrenzter Rebuild-Zeitraum in der Vorschausprache · D4 keine Umrechnung, eine Buchung · D5 Buchungsmuster und Pflichtbegründung · D6/D7 serverseitige Prüfung und Transaktion → Speichern nicht an die Periodenliste gekoppelt · D8 kein Release in dieser Phase · `universalFetch`-Pflicht · Kontoauszug als Ort der Sichtbarkeit · Zeitraum ausdrücklich benennen · Randfall Stichtag mitten im Monat |
| `REQUIREMENTS.md` | REQ-26 Stichtag auch rückwirkend · REQ-27 Vorschau vor dem Speichern mit deckungsgleichem Wert · REQ-28 kein Umrechnen des Saldos (Fußnote im Panel) · REQ-29 eigene Journalzeile mit Begründung und Periodenbezug |
| `ROADMAP.md` Phase 12 | Erfolgskriterien → Zustände 6/7, Zeitraumsatz, Journalzeile |
| `13-UI-SPEC.md` (nur gelesen) | Abgestimmte Prop-Signatur `zIndexClass?: string` (Default `'z-50'`) für `Modal` **und** `ConfirmDialog` · z-Ebenen-Regel 50/60/70 |
| `.claude/CLAUDE.md` | Dark Mode Pflicht · responsive Breakpoints · Loading/Error States · `universalFetch` · Verbot von `toISOString().split('T')[0]` · TypeScript strict, kein `any` · keine `console.log` in Produktion · Zero-Hallucination-Policy für die Zeilenangaben |
| Codebestand (verifiziert 21.08.2026) | `Modal.tsx` Zeile 15–32/44/48/53/59/65/73 · `ConfirmDialog.tsx` Zeile 9/32/35/41/54/64–69 · `Input.tsx` Zeile 13/18/26/29/34/36–37/41/44 · `WorkScheduleEditor.tsx` Zeile 90/95/110/127/146/151/161 · `EditUserModal.tsx` Zeile 26/41–54/103–106/113–114/123/138–159/197/216/238/249/274–277/280 · `UserManagementPage.tsx` Zeile 38/128–131/134/139/147–148/152–153/155–156/464/523–527 · `Button.tsx` Zeile 31 (kein Default-`type`) · `EditUserModal.tsx` Zeile 168/336 (`<form>`-Grenzen) · `PrivacyPolicyModal.tsx` Zeile 27/31, `App.tsx` Zeile 190 · `desktop/tests/user-edit.spec.ts` Zeile 32/64/85–115/94/101/102/104/125/146–153/172/211/243 · kein `createPortal` in `desktop/src` · `desktop/package.json` Zeile 38 (react 19.1.0), Zeile 65 (tailwindcss 3.4.1) |
| Vom Orchestrator entschieden | shadcn nicht initialisieren · `readOnly` statt `disabled`, ohne `tabIndex={-1}`, mit `!`-Hover-Overrides beim Aufrufer statt Zweig in `Input.tsx` · verschachtelte Modale über `createPortal` **plus** Entfernen von `transform` · `zIndexClass` in `Modal` **und** `ConfirmDialog` · Modal-Stack statt Zähler, an `isOpen` gebunden · Fokusrückgabe und Fokusfalle · `UserManagementPage` hält nur die ID, `EditUserModal`-Reset auf `[user.id]` · Speichern nicht an die Periodenliste gekoppelt, dazu Button „Perioden erneut laden" · eigener grauer Zustand 8 „nichts zu tun" · `previewToken` bindet vier Felder ohne Begründung, zustandslos, 15 Minuten, synchrones Verwerfen, Ausgang nach dem zweiten Fehlschlag · Zeichenzähler als „Noch {n} Zeichen" · Ablage der neuen Komponenten unter `worktime/` · Teal für das Modellwechsel-Badge · Stichtag ohne Vorbelegung · Mindestlänge 10 Zeichen für die Begründung · `renderActions`-Schnitt der Periodenliste für Phase 13 · Sortierung der Periodenliste absteigend · `grid-cols-1 sm:grid-cols-2` im `WorkScheduleEditor` · Wechsel-Dialog und `ConfirmDialog` außerhalb des `<form>` von `EditUserModal` rendern, `stopPropagation()` als zweite Sicherung, `type` an jedem Button ausdrücklich, **kein** Default-`type` in `Button.tsx` · Index-Guard in `popModal`, stabile Instanz-`id` über `useRef` · `PrivacyPolicyModal` nimmt nicht am Stack teil · genau ein E2E-Test wird umgeschrieben, der kaputte `aria-label`-Selektor nur dort repariert · alle 16 `console.log` in den ohnehin veränderten Dateien entfernen (`ConfirmDialog.tsx`, `EditUserModal.tsx`, `UserManagementPage.tsx`), `console.error`/`console.warn` behalten, keine weiteren Dateien anfassen |

---

## Abgrenzung

Nicht Teil dieser UI-SPEC (Phase 13 bekommt eine eigene):
Bearbeiten und Löschen von Perioden, Storno-Darstellung im Kontoauszug, die Aktion
„Stammdaten korrigieren" samt eigener Warnung, sowie die drei weiteren `ConfirmDialog`-Props
`details`, `confirmDisabled` und `closeOnConfirm`. Vorbereitet ist ausschließlich der Schnitt:
`renderActions` in der Periodenliste, `readOnly` im `WorkScheduleEditor`, `zIndexClass` in `Modal`
und `ConfirmDialog`, der Modal-Stack und die freie `danger`-Buttonvariante.

Ebenfalls nicht Teil: ein Default-`type` in `Button.tsx`, die Reparatur der sieben verbleibenden
`button[aria-label="Bearbeiten"]`-Selektoren in `user-edit.spec.ts` und das Einbinden von
`PrivacyPolicyModal.tsx` in den Modal-Stack. Alle drei sind oben mit Begründung abgegrenzt.

Ebenfalls nicht Teil: Serverseitige Umsetzung. Dieses Dokument beschreibt den Vertrag, den die
Oberfläche einhält, und die Daten, die sie vom Server erwartet — nicht deren Berechnung. Das gilt
auch für das `previewToken`: Bindung, Lebensdauer und Zustandslosigkeit sind hier als Anforderung
an den Server festgehalten, die konkrete Signaturmethode ist Sache der Planung.

---

## Behebung der Checker-Befunde (Revision 2)

| Befund | Behoben in |
|--------|------------|
| B1 — verschachtelte Modale nicht umsetzbar (`transform` als Containing Block) | Abschnitt 1 → *Verschachtelte Modale und z-Ebenen*; Änderungstabelle A, `Modal.tsx` Punkte (1)–(3) |
| B2 — `ConfirmDialog` kann `z-[70]` nicht erreichen | Abschnitt 1 → z-Ebenen-Regel; Änderungstabelle A, `ConfirmDialog.tsx` Punkte (1)–(2); Signatur mit Phase 13 abgestimmt |
| B3 — ESC schließt beide Modale, Fokusrückgabe fehlt | Abschnitt 1 → *Modal-Stack*; Abschnitt Barrierefreiheit; Änderungstabelle A, `Modal.tsx` (4)–(6) und `ConfirmDialog.tsx` (3)–(4) |
| B4 — Zustand „Erfolg" nicht erreichbar (`editingUser` als Momentaufnahme) | Änderungstabelle A, `UserManagementPage.tsx`; Änderungstabelle B, `EditUserModal.tsx`; Zustand 15 |
| B5 — Sackgasse bei Fehler der Periodenliste | Abschnitt 4; Zustand 2 und Zustand 10; Textbuch „Perioden erneut laden" |
| B6 — verschachtelter Dialog im `<form>`, `createPortal` stoppt die React-Ereigniskette nicht | Abschnitt 1 → *Formulargrenzen im verschachtelten Baum* (Renderort außerhalb `</form>`, `stopPropagation()`, `type` überall ausdrücklich); Abschnitt 2, erster Aufzählungspunkt |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending (Revision 3 / `revised-2` — erneute Prüfung erforderlich)
