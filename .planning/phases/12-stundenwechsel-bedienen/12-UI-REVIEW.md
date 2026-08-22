---
phase: 12-stundenwechsel-bedienen
audited: 2026-08-22
baseline: .planning/phases/12-stundenwechsel-bedienen/12-UI-SPEC.md (Revision 3, `revised-2`)
screenshots: nicht erstellt
scope: desktop
status: advisory
overall: 14/24
---

# Phase 12 — UI-Review (retrospektiver 6-Säulen-Audit)

**Geprüft:** 2026-08-22
**Vertrag:** `12-UI-SPEC.md` (947 Zeilen, vom Anwender abgenommen)
**Screenshots:** **nicht erstellt** — Begründung unten
**Charakter:** beratend, nicht blockierend

---

## Prüfumfang und Prüfbarkeit

**Geprüfte Dateien (am Code, Zeile für Zeile):**

| Datei | Rolle in Phase 12 |
|-------|-------------------|
| `desktop/src/components/worktime/WorkTimeChangeModal.tsx` (870 Z.) | Wechsel-Dialog, Vorschaupanel, Zustände 1, 3–9, 11–15 |
| `desktop/src/components/worktime/WorkTimePeriodList.tsx` (183 Z.) | Periodenliste, Zustände 1, 2, 10 |
| `desktop/src/components/ui/Modal.tsx` (88 Z.) | Portal, `zIndexClass`, `role="dialog"` |
| `desktop/src/components/ui/ConfirmDialog.tsx` (112 Z.) | Bestätigung, Zustand 11 |
| `desktop/src/components/ui/useModalLayer.ts` (132 Z.) | Fokusfalle, Fokusrückgabe, ESC-Stapel |
| `desktop/src/components/ui/modalStack.ts` (44 Z.) | Stapel, Scroll-Lock |
| `desktop/src/components/users/EditUserModal.tsx` (488 Z.) | Einstieg D1, Erfolgsbanner, Zustand 15 |
| `desktop/src/components/users/WorkScheduleEditor.tsx` (218 Z.) | `readOnly`, Tagesplan im Dialog |
| `desktop/src/components/worktime/OvertimeTransactions.tsx` (341 Z.) | `model_change`-Journalzeile |
| `desktop/src/components/worktime/overtimeTransactionFormat.ts` | `documentedDelta`-Formatierung |
| `desktop/src/components/ui/Input.tsx`, `Textarea.tsx`, `Button.tsx`, `Card.tsx` | Primitive im Renderpfad |
| `desktop/src/hooks/useWorkTimeChange.ts` | Datenschicht, Invalidierung |
| `desktop/src/pages/UserManagementPage.tsx` | abgeleitetes `user`-Objekt (B4) |

**Warum keine Screenshots.** Ein Vite-Dev-Server antwortet auf **Port 1420** (HTTP 200,
Tauri-Standard; 3000 liefert 500, 5173/8080 nichts). Screenshots waren trotzdem nicht möglich:

1. `desktop/node_modules` ist **leer** — Playwright ist im Arbeitsbaum nicht installiert
   (deckt sich mit `12-REVIEW-FIXES-DESKTOP.md`, Abschnitt „Zur Prüfbarkeit").
2. Zwei Versuche über `npx playwright@1.49.0` und `npx playwright@latest` scheiterten an der
   Browserbindung: der lokale Cache `~/AppData/Local/ms-playwright` enthält die Builds
   `chromium-1200/1217/1228`, keine davon passt zu einer der beiden CLI-Fassungen
   (`Executable doesn't exist at … chromium_headless_shell-1148`). Ein
   `npx playwright install` hätte einen mehrere hundert MB großen Download auf den Rechner
   des Anwenders gelegt — ohne Auftrag nicht vertretbar.
3. Selbst mit Browser wäre die geprüfte Fläche nicht erreichbar gewesen: sie liegt hinter der
   Anmeldung, in der Benutzerverwaltung, hinter zwei Modalebenen. Die CLI `playwright
   screenshot` kann nur eine URL aufrufen, keinen Anmelde- und Klickpfad abspielen.

`.planning/ui-reviews/.gitignore` wurde angelegt (Gate erfüllt), das leere Aufnahmeverzeichnis
wieder entfernt.

**Folge für die Bewertung:** Alle Befunde sind aus dem Quelltext hergeleitet und mit
Datei:Zeile belegt. Zwei Befunde (V-2, E-1) beruhen zusätzlich auf Browserverhalten und sind
als **im laufenden Fenster zu bestätigen** gekennzeichnet — sie sind hergeleitet, nicht gesehen.

**Bereits behoben, hier nicht erneut gemeldet.** `12-REVIEW-DESKTOP.md` (5 Critical, 21
Warning, 8 Info) und `12-REVIEW-FIXES-DESKTOP.md` (26/26 behoben) wurden vollständig gelesen.
Alle 26 Fixes sind im Code nachgeprüft und werden nicht wiederholt. Die acht **Info**-Befunde
(IN-01 … IN-08) waren ausdrücklich außerhalb des Fix-Auftrags und stehen bis heute offen; sie
sind unten in einem eigenen Abschnitt nur benannt, nicht neu bewertet.

---

## Bewertung je Säule

| Säule | Bewertung | Kernbefund |
|-------|-----------|------------|
| 1. Copywriting | **3/4** | Textbuch fast wörtlich umgesetzt; `{X,X}`-Format an drei Stellen ohne Nachkommastelle, eine erfundene Panelzeile, englische Dezimalpunkte aus dem Tagesplan-Editor |
| 2. Visuals | **2/4** | Der vertraglich einzigartige visuelle Anker hat im selben Dialog einen Konkurrenten (`text-lg font-bold` grün in der Summenkarte); Vorschaupanel springt bei jedem Tastendruck durch drei Höhen |
| 3. Color | **2/4** | Blau erscheint im geöffneten Dialog an bis zu 13 Stellen statt an den vier reservierten; „Warnung" wird in drei Farbtönen erzählt (amber / orange / yellow) |
| 4. Typography | **2/4** | `font-medium` an sieben neuen Orten außerhalb der Primitive — vom Vertrag selbst als Bruch benannt; `ConfirmDialog` bringt 16-px-Fließtext und einen 18-px-Dialogtitel |
| 5. Spacing | **3/4** | Skala sauber eingehalten, eine undeklarierte dritte Ausnahme (`mt-0.5`), der Token `xl`/`mb-8` bleibt an der Stelle ungenutzt, für die ihn der Vertrag vorsieht |
| 6. Experience Design | **2/4** | Alle 15 Zustände sind verdrahtet — das ist stark; aber die Bestätigung kann im niedrigen Fenster ihre Knöpfe verlieren, Zustand 10 malt vermutlich nichts, und der Tagesplan-Toggle hat keinen zugänglichen Namen |

**Gesamt: 14/24**

Die Bewertung ist bewusst nicht nach oben gemittelt. Zwei Dinge gehören der Fairness halber
ausdrücklich festgehalten: **die Zustandsabdeckung 1–15 ist im Code vollständig vorhanden**
(einschließlich Wiederholknöpfen, Nichts-zu-tun-Panel, Token-Rückfall und Fokusrückgabe), und
**Dark Mode ist lückenlos** — 46 `dark:`-Varianten im Dialog, 16 in der Periodenliste, keine
einzige Farbklasse ohne Gegenstück. Die Abzüge entstehen dort, wo der Vertrag über die reine
Existenz hinaus etwas Bestimmtes zusichert.

---

## Die drei vorrangigen Korrekturen

1. **`ConfirmDialog` scrollt nicht — die rückwirkende Bestätigung kann unbedienbar werden.**
   `ConfirmDialog.tsx:64-66` rendert `fixed inset-0 flex items-center justify-center` **ohne**
   `overflow-y-auto`; `Modal.tsx:39` hat es (`fixed inset-0 … overflow-y-auto`). Der
   Bestätigungstext dieser Phase ist mit Abstand der längste der App (drei Sätze mit fünf
   eingesetzten Werten, `WorkTimeChangeModal.tsx:528-536`). Ist das Tauri-Fenster niedriger als
   die Karte hoch, ragen `CardFooter` und damit „Ja, rückwirkend umstellen" aus dem Ansichtsbereich,
   und es gibt keine Scrollmöglichkeit — der Kernpfad von REQ-26 endet in einer Sackgasse.
   ESC/„Zurück zur Vorschau" ist dann der einzige Ausweg. → **Fix:** `overflow-y-auto` und einen
   Innenabstand auf das Overlay legen, wörtlich wie in `Modal.tsx:39/48`:
   `fixed inset-0 ${zIndexClass} overflow-y-auto` plus innerem
   `flex min-h-full items-center justify-center p-4`.

2. **Blau ist im Dialog kein Akzent mehr, sondern die Grundfarbe — und entwertet damit den
   Zustand „Keine Rückwirkung".** Der Vertrag nennt vier abschließende Akzenteinsätze. Im
   geöffneten Dialog mit individuellem Wochenplan zählt der Quelltext: Mitarbeiter-Infopanel
   (`WorkTimeChangeModal.tsx:586`), bis zu **sieben** Tageskacheln mit `bg-blue-50 border-blue-300`
   (`WorkScheduleEditor.tsx:142`), die Summenkarte (`WorkScheduleEditor.tsx:171`), das
   Vorschaupanel im Zukunftsfall (`:553`), das Badge „Keine Rückwirkung" (`:707`), der Toggle
   (`WorkScheduleEditor.tsx:121`) und der Primärbutton — **bis zu 13 blaue Flächen**. Das Signal,
   das der Vertrag dem Zukunftsfall zugedacht hat („Info-Panel Keine Rückwirkung" als einer von
   vier Akzenten), ist damit von drei weiteren blauen Panels nicht mehr zu unterscheiden. Die
   geforderte Unterscheidbarkeit „Zukunft fühlt sich anders an als Vergangenheit" trägt am Ende
   allein der bernsteinfarbene Fall. → **Fix:** Die Tageskacheln im Dialog neutral führen
   (`border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800`, wie die Nullstundenkachel
   in `WorkScheduleEditor.tsx:143`) und das Mitarbeiter-Infopanel auf die Sekundärfläche
   (`bg-gray-50 dark:bg-gray-800`) umstellen. Dann bleiben Vorschaupanel, Toggle, Fokusring und
   Primärbutton — genau die vier des Vertrags.

3. **Das Vorschaupanel springt bei jedem Tastendruck durch drei Zustände und behauptet dabei
   400 ms lang etwas Falsches.** `handleWeeklyHoursChange`/`handleWorkScheduleChange`
   (`:341-368`) setzen `setPreview(null)` synchron — richtig und vertragskonform. Die Folge im
   Panel ist aber: `getPreviewPanelState()` (`:538-546`) liefert dann `placeholder`, weil
   `previewM.isPending` erst nach Ablauf der 400 ms wahr wird. Der Anwender sieht bei jeder
   getippten Ziffer im Feld „Neue Wochenstunden": vollständige Vorschau (ca. 220 px hoch) →
   einzeiliger Satz „Die Vorschau erscheint, sobald Stichtag und neue Wochenstunden gesetzt
   sind." (`:720`) → „Vorschau wird berechnet …" → wieder vollständige Vorschau. Zwei
   Layoutsprünge und ein Satz, der nachweislich nicht zutrifft (beides **ist** gesetzt) — genau
   der Fehlertyp, den WR-04 für den Wertebereich schon behoben hat, hier nur zeitlich statt
   wertebezogen. Bei `role="status" aria-live="polite"` wird dieser Satz zusätzlich vorgelesen.
   → **Fix:** Einen vierten Panelzustand `stale` einführen, der greift, sobald `validFrom` und
   `weeklyHoursNum` gültig sind, aber noch keine Antwort vorliegt — mit dem Ladetext und
   `aria-busy`, in der Höhe der bisherigen Vorschau (`min-h`), damit der Kasten stehen bleibt.

---

## Detaillierte Befunde

### Säule 1 — Copywriting (3/4)

Das Textbuch ist mit ungewöhnlicher Treue umgesetzt: Modaltitel, beide Buttonbeschriftungen,
Platzhalter, Zeitraumsätze für Zukunft und Vergangenheit, Fußnote zu REQ-28, alle zehn
Validierungsmeldungen wörtlich, beide `ConfirmDialog`-Varianten (mit und ohne Nulldifferenz),
Leerzustand und Fehlerzustand der Periodenliste, die zweite Journalzeile mit Periodenbezug.
Umlaute korrekt, typografische Anführungszeichen und das echte Auslassungszeichen „…" im
Buttontext. Das ist die stärkste Säule dieser Phase.

**WARNING C-1 — `{X,X}` wird als `{X}` ausgegeben.** Der Vertrag schreibt an drei Stellen
`{X,X} h` bzw. `{X,X} h/Woche`. Die Umsetzung nutzt überall
`toLocaleString('de-DE', { maximumFractionDigits: 2 })`, das die Nachkommastelle bei ganzen
Zahlen **weglässt**:
- `WorkTimePeriodList.tsx:33-35`, Spalte Wochenstunden → „40 h" statt „40,0 h"
- `WorkTimeChangeModal.tsx:147` (Formatierer), verwendet `:609` — Infopanel „Aktuell gültig seit …" → „40 h/Woche"
- `EditUserModal.tsx:308`, Erfolgsbanner → „gelten 40 h/Woche."
Fachlich harmlos, aber es ist eine Abweichung vom abgenommenen Textbuch und erzeugt in der
Periodenliste eine unruhige Spalte („40 h" neben „32,5 h").
**Fix:** `minimumFractionDigits: 1` ergänzen — an einer Stelle, wenn die Funktion nach
`timeUtils.ts` wandert (siehe IN-02, offen).

**WARNING C-2 — der Einstiegssatz steht nicht im Textbuch.** `EditUserModal.tsx:363-366`:
„Eine rückwirkende oder künftige Umstellung des Arbeitszeitmodells läuft über eine eigene
Aktion mit Vorschau." Der Vertrag sieht für dieses Panel „den Hilfstext aus dem Textbuch" vor;
die beiden dort geführten Hilfstexte sind bereits am Wochenstundenfeld (`:336`) und über dem
Tagesplan (`:352`) verbaut. Der Satz ist neu erfunden — er ist gut, aber er ist nicht
abgenommen und dupliziert inhaltlich den Hilfstext direkt darüber.

**WARNING C-3 — englische Dezimalpunkte mitten im deutschen Dialog.** Der Tagesplan-Editor
steht im neuen Dialog voll bedienbar und schreibt `totalHours.toFixed(1)`
(`WorkScheduleEditor.tsx:181`) → „40.0h", sowie im Fallback `(weeklyHours / 5).toFixed(2)`
(`:211`) → „8.00h/Tag". Direkt daneben rendert der Dialog „40,0 h/Woche" und „+2:30h". Die
Design-System-Tabelle des Vertrags legt `formatHours()` und `de-DE` fest. Bestand, aber jetzt
im Blickfeld des neuen Vertrags.

**INFO C-4 — die Journalzeile hat neue Copy, der Vertrag kennt sie nicht.**
`OvertimeTransactions.tsx:281-286` zeigt „dokumentierte Differenz" über dem Betrag, `:331-336`
eine Fußnote („Der Betrag zählt **nicht** zusätzlich zum Saldo …"). Beides ist die richtige
Konsequenz aus Server-CR-01 (`hours: 0` + `documentedDelta`) und sachlich gut formuliert — aber
`12-UI-SPEC.md` beschreibt in Abschnitt 5 weiterhin „einen echten Stundenwert mit Vorzeichen,
Trendpfeil und `font-bold`, genau wie `earned` und `correction`". **Der Vertrag ist dem Code
nachzuziehen**, sonst prüft Phase 13 gegen eine überholte Zusage.

*Offen aus dem Code-Review (Info, nicht neu bewertet):* IN-05 — der Zeichenzähler misst
`reason.length`, die Prüfung `reason.trim().length` (`WorkTimeChangeModal.tsx:689` gegen
`:416-419`); IN-07 — leerer Tagesplan erzeugt eine leere Zelle.

### Säule 2 — Visuals (2/4)

**WARNING V-1 — der visuelle Anker hat im selben Dialog einen Konkurrenten, und der steht
weiter oben.** Der Vertrag ist an dieser Stelle ungewöhnlich scharf: „Kein zweites Element im
Dialog darf diese Kombination aus Größe, Gewicht und Farbe tragen." Die Kombination ist
`text-lg font-bold` + semantische Farbe. Sie erscheint zweimal:
- `WorkTimeChangeModal.tsx:810` — die Saldoänderung (der gewollte Anker), und
- `WorkScheduleEditor.tsx:176-181` — die Summe „40.0h" in grün-600 bzw. orange-600.
Die Summenkarte steht im Dialog **oberhalb** der Vorschau (Reihenfolge 4 vor 6), ist ebenfalls
grün und ebenfalls fett. Der Blick landet zuerst dort. Der Vertrag widerspricht sich hier
selbst — die Typografietabelle erlaubt `font-bold` für „die Summenzahl im `WorkScheduleEditor`"
ausdrücklich —, aber das gerenderte Ergebnis bleibt: zwei konkurrierende grüne Fettzahlen, von
denen nur die untere die Entscheidungsgrundlage ist.
**Fix:** Im Dialog die Summenzahl auf `text-sm font-semibold` neutralisieren (per bestehender
`readOnly`-artiger Prop oder einer neuen `compact`-Prop) — die Abweichungswarnung darunter
trägt die Information ohnehin.

**WARNING V-2 (im laufenden Fenster zu bestätigen) — die Hervorhebung aus Zustand 10 wird
vermutlich gar nicht gemalt.** `WorkTimePeriodList.tsx:148-150` setzt `ring-2 ring-red-400`
auf ein `<tr>`. Tailwind bildet `ring-*` als `box-shadow` ab. Tailwinds Preflight ist aktiv
(`desktop/tailwind.config.js` ohne `corePlugins`-Ausnahme, keine `border-collapse`-Regel in
`App.css`), setzt also `table { border-collapse: collapse }`. Bei kollabierten Rahmen malen
Chromium und WebKit `box-shadow` auf Zeilenelementen nicht — und Tauri rendert unter Windows
auf WebView2 (Chromium). Der Feldfehler am Stichtag trägt die Information zwar allein (so
sieht es der Vertrag für Zustand 2 vor), die zugesagte Zeilenmarkierung fehlte dann aber
ersatzlos — nachdem WR-11 sie eigens verdrahtet hat.
**Fix:** Statt `ring` auf der Zeile eine Flächen- und Randmarkierung auf den Zellen:
`[&>td]:bg-red-50 dark:[&>td]:bg-red-900/20 [&>td:first-child]:border-l-4
[&>td:first-child]:border-red-400` — oder `border-collapse: separate` mit
`border-spacing: 0` auf der Tabelle.

**WARNING V-3 — der Dialog ist sehr lang, Anker und Primäraktion liegen unter der Falz.**
Der Dialog trägt sieben Blöcke; der Tagesplan-Editor bringt davon allein Toggle (`p-4`),
sieben Kacheln in zwei Spalten (`p-3` je Kachel), Summenkarte (`p-4`) und den
Beispielkasten „💡 Beispiele" mit drei Listenpunkten (`WorkScheduleEditor.tsx:191-201`) mit.
Grob überschlagen liegt der Inhalt bei rund 1300–1500 px, das Zielfenster bei 900 px. Vorschau
(Reihenfolge 6) und Aktionszeile (7) sind damit nur nach dem Scrollen sichtbar, obwohl die
Vorschau die Entscheidungsgrundlage ist und der Primärbutton sein Label aus ihr bezieht
(„Rückwirkend speichern"). Der Beispielkasten ist ein Lernhilfsmittel aus dem Anlegeformular
und im Wechseldialog Ballast.
**Fix:** Den Beispielkasten hinter dieselbe Prop legen, die ihn im `readOnly`-Fall ohnehin
nicht braucht, oder die Vorschau als klebenden Fuß (`sticky bottom-0`) unter der Aktionszeile
führen.

**WARNING V-4 — der Toggle „Individueller Wochenplan" hat keinen zugänglichen Namen und keine
Rolle.** `WorkScheduleEditor.tsx:115-130`: ein `<button type="button">` mit einem leeren
`<span>` als Knauf, ohne `aria-label`, ohne `role="switch"`, ohne `aria-checked`; das `<label>`
darüber (`:108-110`) hat kein `htmlFor` und umschließt nichts. Ein Screenreader liest
„Schaltfläche" — exakt der Mangel, den diese Phase für den X-Knopf des `ConfirmDialog` eigens
behoben hat. Im neuen Dialog ist dieses Element **voll bedienbar** und entscheidet darüber, ob
überhaupt ein Tagesplan mitgeschickt wird.
**Fix:** `role="switch" aria-checked={useIndividualSchedule} aria-label="Individueller
Wochenplan"` — drei Attribute, keine Verhaltensänderung.

**INFO V-5 — der Primärbutton ist im Öffnungszustand ausgegraut.** `primaryButtonDisabled`
(`:573`) ist in den Zuständen 1, 3, 4, 5, 8, 12 wahr — Zustand 8 ist laut Vertrag „der
Regelfall unmittelbar nach Eingabe des Stichtags". `Button.tsx:11` setzt `disabled:opacity-50`;
Weiß auf 50 % blue-600 über weißem Grund liegt bei etwa 2:1. WCAG nimmt deaktivierte
Bedienelemente davon aus, es ist also kein Verstoß — aber der Dialog begrüßt den Anwender mit
einem kaum lesbaren Hauptknopf. Ein `aria-disabled` mit sichtbarem, aber gesperrtem Knopf und
einem Hinweistext wäre freundlicher.

### Säule 3 — Color (2/4)

Sauber: Dark Mode vollständig (kein Farbwert ohne `dark:`-Gegenstück in allen sieben geprüften
Dateien), keine hartcodierten Hexwerte oder `rgb()` in der ganzen Phase, das Teal-Badge des
Modellwechsels exakt wie vereinbart (`OvertimeTransactions.tsx:149`), Grün/Rot/Grau der
Saldogrößen dreiwegig und mit Vorzeichen plus Trendpfeil doppelt kodiert
(`WorkTimeChangeModal.tsx:800-820`, `overtimeTransactionFormat.ts:57-61`), die Periodenliste
bewusst neutral gebadgt (`WorkTimePeriodList.tsx:156`).

**BLOCKER-nah (WARNING) F-1 — Akzentinflation, siehe vorrangige Korrektur 2.** Vier
reservierte Einsätze laut Vertrag, bis zu 13 blaue Flächen im geöffneten Dialog. Belegstellen:
`WorkTimeChangeModal.tsx:553`, `:586`, `:707`; `WorkScheduleEditor.tsx:121`, `:142`, `:171`;
`Button.tsx:14`.

**WARNING F-2 — „Warnung" erscheint in drei verschiedenen Farbtönen, teils gleichzeitig.**
Der rückwirkende Pfad zeigt nacheinander:
- `WorkTimeChangeModal.tsx:554/562/712` → **amber**-50/200/600 (Panel, `AlertTriangle`, Badge) — vertragskonform;
- `WorkScheduleEditor.tsx:179/185` → **orange**-600 für die Abweichung Tagesplan ↔ Wochenstunden, im selben Dialog, oft gleichzeitig sichtbar;
- `ConfirmDialog.tsx:57` → **yellow**-600/400 für das Warnsymbol der Bestätigung, die genau aus diesem Panel heraus geöffnet wird.
Die Semantikliste des Vertrags kennt für Warnung nur amber und nennt
`ConfirmDialog variant="warning"` ausdrücklich als amber-Einsatzort. Drei Gelbtöne für einen
Sachverhalt sind nicht als Bedeutungsunterschied lesbar, sondern als Unsauberkeit.
**Fix:** `ConfirmDialog.tsx:57` auf `text-amber-600 dark:text-amber-400` und
`WorkScheduleEditor.tsx:179/185` auf `text-amber-600 dark:text-amber-400`; beide sind
zustandsgebundene Semantikfarben und zählen nicht gegen die Akzentquote.

**INFO F-3 — `bg-opacity-10` ohne Fläche (IN-03, offen).** `ConfirmDialog.tsx:79`: Der
Symbolkasten hat keine Hintergrundfarbe, `bg-opacity-10` läuft ins Leere. Bekannt, unbehoben,
hier nur der Vollständigkeit halber.

### Säule 4 — Typography (2/4)

Erhoben über die sieben Dateien: **vier** Schriftgrößen im Einsatz (`text-xs` 22×,
`text-sm` 46×, `text-lg` 11×, `text-xl` 1×) — kein `text-base`, keine `2xl`+, keine
`text-[…px]`-Sonderwerte, keine willkürlichen Zeilenhöhen. Die Größendisziplin des Vertrags ist
gehalten. Die Abzüge betreffen Gewichte und zwei geerbte Größen.

**WARNING T-1 — `font-medium` an sieben neuen Orten außerhalb der Primitive.** Der Vertrag:
„Kein neuer Einsatzort außerhalb dieser Primitive. … Neue Einsatzorte für 500 oder 700
außerhalb dieser Tabelle sind ein Vertragsbruch."
| Ort | Was |
|-----|-----|
| `WorkTimeChangeModal.tsx:707` | Badge „Keine Rückwirkung" |
| `WorkTimeChangeModal.tsx:712` | Badge „Rückwirkend" |
| `WorkTimeChangeModal.tsx:775` | Sollstunden „bisher" |
| `WorkTimeChangeModal.tsx:781` | Sollstunden „neu" |
| `WorkTimeChangeModal.tsx:787` | Sollstunden „Differenz" |
| `WorkTimePeriodList.tsx:103` | Überschrift des Leerzustands |
| `WorkTimePeriodList.tsx:156` | Badge „Aktuell"/„Geplant" |
Drei davon (die Badges) übernehmen wortgleich das Bestandsmuster aus
`OvertimeTransactions.tsx:235` — vertretbar, aber vom Vertrag nicht gedeckt. Die drei
Sollstundenwerte und die Leerzustandsüberschrift sind frei erfunden.
**Fix:** Entweder die vier freien Vorkommen auf 400 zurücknehmen (die Kennzahlen unterscheiden
sich schon durch `text-gray-900` gegen `text-gray-600` der Beschriftung), oder die
Typografietabelle um „Badge" und „Kennzahl" ergänzen. Beides ist billig; unentschieden bleiben
ist die schlechteste Variante.

**WARNING T-2 — der `ConfirmDialog` bringt die einzige 16-px-Fließschrift der Phase und einen
zu kleinen Dialogtitel.** `ConfirmDialog.tsx:96` rendert die Nachricht ohne Größenklasse — sie
erbt die 16 px aus `:root` (`App.css`). Der Vertrag: „`text-base` (16px) wird in dieser Phase
**nicht** verwendet." Zugleich rendert `CardTitle` (`Card.tsx:46-52`) mit `text-lg
font-semibold`: der Titel „Rückwirkende Umstellung bestätigen" ist damit 18 px, während der
Titel des darunterliegenden Dialogs 20 px hat (`Modal.tsx:65`). Der obenauf liegende, dringlichere
Dialog hat also die kleinere Überschrift und den größeren Fließtext — genau verkehrt herum.
**Fix:** `ConfirmDialog.tsx:96` auf `text-sm`, `:82` auf `className="text-xl"`.

**WARNING T-3 — Hilfstexte unter Feldern in zwei Größen, und im Dialog ohne Anbindung.**
`Input.tsx:74-78` rendert `helperText` als `text-sm` und verknüpft ihn über
`aria-describedby` — so genutzt in `EditUserModal.tsx:336`. Im Wechsel-Dialog sind dieselben
Hilfstexte dagegen von Hand als `<p className="mt-1 text-xs …">` gebaut
(`WorkTimeChangeModal.tsx:633-637` und `:651-654`) und damit (a) 12 px statt 14 px und (b)
**nicht** mit ihrem Eingabefeld verknüpft. Dasselbe gilt für den Zeichenzähler (`:688-691`).
Der Vertrag ordnet „Hilfs-/Metatext" `text-xs` zu — dann ist die Primitive falsch; in jedem
Fall ist es beides zugleich. Die fehlende Anbindung ist der Rückfall hinter WR-16, das genau
diese Verknüpfung eingeführt hat.
**Fix:** `helperText` der Primitive nutzen und deren Klasse auf `text-xs` ziehen; den
Zeichenzähler über `aria-describedby` an das `Textarea` hängen.

**INFO T-4 — `text-sm font-semibold` in den Tabellenköpfen** (`WorkTimePeriodList.tsx:120-136`)
ist eine Kombination, die die Typografietabelle nicht führt (600 ist dort an `text-lg`/`text-xl`
gebunden). Sie ist wortgleich aus `OvertimeTransactions.tsx:207-219` übernommen und daher
konsistent zum Bestand — als Befund nur benannt, nicht gewichtet.

### Säule 5 — Spacing (3/4)

Die Skala ist eingehalten. Verteilung in den beiden neuen Dateien: `px-4`/`py-3` (10×, Token
`sm+`/`md` für Tabellenzellen — wie zugesagt), `gap-2` (5×), `space-y-3` (4×), `mt-1` (4×),
`p-4` (3×), `py-8` (2× für die zentrierten Ladeanzeigen — vertragsgemäß), `gap-3` (2×,
Aktionszeile), `space-y-6`, `gap-6`, `gap-4`. Keine willkürlichen Pixel- oder rem-Werte in der
gesamten Phase (`grep` auf `[…px]`/`[…rem]`: null Treffer). Der Modal-Innenabstand `p-6` und die
Formularblöcke `space-y-6` stehen wie vereinbart.

**WARNING S-1 — eine dritte, undeklarierte Ausnahme.** `WorkTimeChangeModal.tsx:617`:
`mt-0.5` (2 px) auf dem `AlertCircle` des Fehlerbanners. Der Vertrag lässt „genau zwei"
Ausnahmen vom 4er-Raster zu (`py-1.5` im Button, `py-2.5`/`h-[42px]` im Input), beide in
Primitiven. Optische Feinausrichtung eines Symbols ist ein legitimer Grund — dann gehört sie in
die Ausnahmeliste. **Fix:** entweder `items-center` statt `items-start` am Container (`:616`)
und `mt-0.5` streichen, oder die Ausnahme im Vertrag nachtragen.

**WARNING S-2 — der Token `xl` (`mb-8`) bleibt genau dort ungenutzt, wofür er definiert ist.**
Die Skala führt `xl` = 32 px mit der Verwendung „Abstand Periodenliste ↔ restlicher
Modalinhalt". `EditUserModal.tsx:379-387` trennt den Periodenblock oben korrekt mit
`pt-6 border-t`, hat nach unten aber nur die 16 px aus dem umgebenden `space-y-4` (`:297`).
Die Periodentabelle stößt damit fast an das darunter folgende Feldpaar
Eintritts-/Austrittsdatum, das fachlich nichts mit ihr zu tun hat. **Fix:** `mb-8` (oder
`pb-8`) auf den Block in `:379`.

**INFO S-3 — starre Raster im Einstiegsblock.** `EditUserModal.tsx:313` (`grid-cols-3` für
Rolle / Wochenstunden / Urlaubstage) und `:261`, `:280`, `:389` (`grid-cols-2`) haben keinen
Breakpoint. Der Vertrag hat sie ausdrücklich als Altlast außerhalb des Umfangs vermerkt — hier
nur der Hinweis, dass das schreibgeschützte Wochenstundenfeld dieser Phase in genau einem davon
sitzt und unter 640 px auf ein Drittel der Fensterbreite zusammengedrückt wird.

### Säule 6 — Experience Design (2/4)

**Die Zustandsabdeckung ist vollständig.** Einzeln gegen den Code geprüft, nicht als
Sammelposten:

| # | Zustand | Fundstelle | Urteil |
|---|---------|-----------|--------|
| 1 | Öffnen, Perioden laden | `WorkTimeChangeModal.tsx:593-596` (Spinner im Infopanel), `WorkTimePeriodList.tsx:76-82` (Spinner `py-8`) | erfüllt |
| 2 | Periodenliste Fehler | `WorkTimePeriodList.tsx:84-98` (`AlertCircle`, Meldung, „Perioden erneut laden"), Fallbacktext `WorkTimeChangeModal.tsx:597-601`; Primärbutton hängt nicht an der Liste (`:573`) | erfüllt |
| 3 | Vorschau nicht möglich | `:538-546` → `placeholder`, Text `:718-722` | erfüllt, aber siehe E-3 |
| 4 | Vorschau lädt | `:539` (`previewM.isPending`), `:724-732`, `aria-busy` `:698` | erfüllt |
| 5 | Vorschau Fehler | `:733-747`, Wiederholknopf `:736-746` | erfüllt |
| 6 | Zukunft | `:553` blau, Badge `:707`, Label `:574` | erfüllt |
| 7 | Vergangenheit | `:554` amber, Badge `:712`, Label `:574`, Bestätigungsschritt `:516-519` | erfüllt |
| 8 | Nichts zu tun | `:544` aus `preview.isNoOp`, graues Panel `:552`, Text `:748-752`, Button gesperrt `:573` | erfüllt, vorbildlich (kein Feldfehler) |
| 9 | Validierungsfehler | `:381-441`, Fokussprung `:424-437` | erfüllt bis auf den Tagesplanfehler, der kein Fokusziel hat (`:430-432`) |
| 10 | Stichtag kollidiert | Feldfehler `:399`, `onConflict` → `EditUserModal.tsx:386` → `WorkTimePeriodList.tsx:143-150` | **verdrahtet, aber vermutlich unsichtbar — V-2** |
| 11 | Bestätigung offen | `:857-868`, `zIndexClass="z-[70]"`, `variant="warning"`, ESC nur oben (`useModalLayer.ts:61-66`) | erfüllt, aber **E-1** |
| 12 | Speichern läuft | `:840-854` (beide Knöpfe gesperrt, Spinner + „Wird gespeichert …"), `onClose={() => {}}` `:579` | erfüllt, aber **E-2** |
| 13 | Speichern fehlgeschlagen | Zweig im `catch` von `performSave` (`:481-508`), Banner `:614-620`, Eingaben und Vorschau bleiben | erfüllt |
| 14 | Vorschau veraltet | `:484-503`, Zähler `staleFailureCount`, zweiter Fehlschlag → Rückfall in Zustand 5 mit Vertragstext | erfüllt, sorgfältig |
| 15 | Erfolg | `:477-482` → `EditUserModal.tsx:464-487` (Banner 8 s mit aufgeräumtem Timer, Toast in beiden Varianten, Fokusrückgabe), Invalidierung `useWorkTimeChange.ts:73-77` | erfüllt |

Ebenfalls erfüllt: Portal in beiden Primitiven (`Modal.tsx:38`, `ConfirmDialog.tsx:63`),
`transform` aus dem Panel entfernt (`Modal.tsx:55-60`), z-Ebenen 50/60/70, Stack mit
Index-Guard (`modalStack.ts:31-40`), stabile Instanz-`id` (`useModalLayer.ts:37`),
Effekt-Abhängigkeit nur `[isOpen]`, `onClose` über Ref, `role="dialog" aria-modal
aria-labelledby` auf beiden Dialogtypen, Renderort des Wechsel-Dialogs außerhalb `</form>`
(`EditUserModal.tsx:449-455`, nach `</form>`), `stopPropagation()` im `onSubmit` (`WorkTimeChangeModal.tsx:512`), `type="button"` an
jedem Knopf des Teilbaums, `universalFetch` durchgehend über `apiClient`
(`api/client.ts:2/130`), kein `console.log` in den vier betroffenen Dateien, kein `any` im
neuen Code, kein `toISOString().split('T')[0]`.

Die Abzüge:

**BLOCKER E-1 — die Bestätigung kann ihre Knöpfe verlieren.** Siehe vorrangige Korrektur 1
(`ConfirmDialog.tsx:64-66` ohne `overflow-y-auto`). Betrifft Zustand 11 und damit den
rückwirkenden Speicherpfad, das Kernszenario von REQ-26. **Im laufenden Fenster zu bestätigen**
— der Effekt tritt erst unterhalb einer bestimmten Fensterhöhe auf.

**WARNING E-2 — in Zustand 12 bleibt der X-Knopf sichtbar aktiv, tut aber nichts.**
`Modal.tsx:68-76` ruft `onClose`, das während des Speicherns `() => {}` ist (`:579`). ESC und
Backdrop sind damit sauber stillgelegt — der X-Knopf sieht aber unverändert bedienbar aus und
schluckt den Klick wortlos. Ein toter, aber normal aussehender Knopf ist schlechter als ein
sichtbar gesperrter. **Fix:** `disabled` an den X-Knopf durchreichen (eine optionale Prop
`closeDisabled?: boolean` an `Modal`), oder in Zustand 12 den Kopfknopf ausblenden.

**WARNING E-3 — Flackern und falscher Satz im Entprellfenster.** Siehe vorrangige Korrektur 3.
Betrifft die Zustände 3 und 4 und tritt bei **jedem** Tastendruck in „Neue Wochenstunden" und in
jedem Tagesfeld auf.

**WARNING E-4 — Reihenfolge im Tabulatorfluss weicht von der Zusage ab.** Der
Barrierefreiheitsabschnitt des Vertrags: „der Einstiegs-Button in `EditUserModal` steht im
Tab-Fluss unmittelbar nach dem schreibgeschützten Feld, auf das er sich bezieht." Tatsächlich
liegt zwischen `weeklyHours` (`EditUserModal.tsx:324-337`) und dem Knopf (`:367-375`) das Feld
„Urlaubstage/Jahr" (`:338-347`) sowie — sobald ein individueller Plan aktiv ist und der Editor
**nicht** `readOnly` wäre — der Tagesplan. Im `readOnly`-Fall sind dessen Felder `disabled` und
fallen aus dem Fluss, „Urlaubstage/Jahr" aber nicht. **Fix:** Das Hinweispanel samt Knopf
unmittelbar unter das Dreierraster ziehen, oder Wochenstunden und Knopf in eine gemeinsame
Zeile setzen.

**WARNING E-5 — Toggle ohne zugänglichen Namen.** Siehe V-4; zählt hier als Bedienbarkeits-,
dort als Wahrnehmungsbefund. Er wird in dieser Säule nicht doppelt gewichtet.

**INFO E-6 — das Erfolgsbanner wird nicht angesagt.** `EditUserModal.tsx:303-311` erscheint
ohne `role="status"`/`aria-live`. Der Toast (`sonner`, `richColors`) übernimmt die Ansage
faktisch, das Banner mit der konkreten Zahl aber nicht. Ein `role="status"` kostet nichts.

**INFO E-7 — der darunterliegende Dialog wird für Screenreader nicht stillgelegt.** Die
Fokusfalle greift (nach CR-02) korrekt, und der `ConfirmDialog`-Backdrop fängt Mausklicks ab.
Der Inhalt des Wechsel-Dialogs bleibt aber im Zugänglichkeitsbaum lesbar (kein `aria-hidden`,
kein `inert` auf der unteren Ebene). Für zwei Ebenen tolerierbar, für Phase 13 mit drei Ebenen
vormerken.

---

## Registry Safety

`components.json` existiert nicht; shadcn ist bewusst nicht initialisiert
(`12-UI-SPEC.md`, „shadcn-Gate"). Die Registry-Safety-Tabelle des Vertrags führt weder
offizielle noch Dritt-Registries. Es wurde geprüft: **kein neues Paket** in dieser Phase, aller
neuer Komponentencode stammt aus dem Projekt selbst. Registry-Audit: **nicht anwendbar, keine
Flags.**

---

## Noch offene Info-Befunde aus dem Code-Review (nur benannt)

Diese acht waren im Fix-Auftrag ausdrücklich ausgenommen und sind unverändert offen. Sie fließen
**nicht** in die Bewertung oben ein: IN-01 (dritte Kopie von `formatDateLocal`), IN-02
(deutsches Datumsformat sechsmal nachgebaut — hängt mit C-1 zusammen), IN-03
(`bg-opacity-10`), IN-04 (`ConfirmDialog` schließt nicht per Hintergrundklick), IN-05
(Zeichenzähler misst ungetrimmt), IN-06 (`setWorkSchedule` im `EditUserModal` toter Pfad),
IN-07 (leere Tagesplanspalte bei 0-h-Plan), IN-08 (leere Vorschauantwort bleibt folgenlos).

---

## Empfohlene Reihenfolge

| Rang | Befund | Aufwand | Wirkung |
|------|--------|---------|---------|
| 1 | **E-1** `ConfirmDialog` scrollen lassen | 1 Zeile | REQ-26-Pfad kann nicht mehr blockieren |
| 2 | **F-1** Akzentinflation zurücknehmen | 2 Klassenstrings | „Keine Rückwirkung" wird wieder ein Signal |
| 3 | **E-3** vierter Panelzustand gegen das Flackern | ~15 Zeilen | ruhiges Panel, kein falscher Satz, keine falsche Ansage |
| 4 | **V-1** konkurrierende Fettzahl entschärfen | 1 Prop | der Anker ist wieder eindeutig |
| 5 | **V-2** Zeilenhervorhebung ohne `ring` auf `<tr>` | 1 Klassenstring | Zustand 10 wird sichtbar |
| 6 | **F-2** drei Warntöne auf amber vereinheitlichen | 3 Klassen | eine Bedeutung, eine Farbe |
| 7 | **V-4 / E-5** `role="switch"` am Toggle | 3 Attribute | der Tagesplan wird bedienbar angesagt |
| 8 | **T-1 … T-3, C-1, C-2, S-1, S-2, E-2, E-4** | je klein | Vertragstreue |

---

## Anmerkungen für den Orchestrator

- Zwei Befunde (**V-2**, **E-1**) beruhen auf Browserverhalten und sind aus dem Quelltext
  hergeleitet. Sie gehören in einen UAT-Punkt: Fenster schmal und niedrig ziehen, rückwirkenden
  Stichtag eingeben, Bestätigung öffnen; getrennt davon eine Stichtagskollision provozieren und
  prüfen, ob die Zeile in der Periodenliste markiert erscheint.
- **C-4** ist kein Codefehler, sondern eine Vertragsdrift: `12-UI-SPEC.md`, Abschnitt 5,
  beschreibt die Journalzeile noch vor der Server-CR-01-Änderung. Der Vertrag sollte nachgezogen
  werden, bevor Phase 13 gegen ihn plant.
- Der Checker-Sign-Off im Kopf von `12-UI-SPEC.md` steht weiterhin auf
  `Approval: pending (Revision 3)`, obwohl der Vertrag als abgenommen geführt wird. Das ist
  formal zu bereinigen.
