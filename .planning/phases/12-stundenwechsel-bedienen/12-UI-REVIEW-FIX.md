---
phase: 12-stundenwechsel-bedienen
fixed_at: 2026-08-22
review_path: .planning/phases/12-stundenwechsel-bedienen/12-UI-REVIEW.md
iteration: 1
scope: blocker_and_priority
findings_in_scope: 6
fixed: 6
skipped: 0
deferred_by_instruction: 5
status: all_fixed
gates:
  desktop_tsc: "exit 0"
  server_vitest: "418 passed / 3 failed (vorbestehend, unveraendert)"
  desktop_runtime_check: "npx tsx + node:assert, 12 Zusicherungen gruen"
---

# Phase 12 — Behebung der UI-Review-Befunde

**Behoben am:** 2026-08-22
**Grundlage:** `12-UI-REVIEW.md` (14/24, beratend)
**Auftragsumfang:** die fünf verbindlich benannten Punkte plus die Vertragsnachführung C-4
**Iteration:** 1

---

## Überblick

| # | Befund | Status | Commit |
|---|--------|--------|--------|
| 1 | **E-1** — `ConfirmDialog` scrollt nicht (BLOCKER) | behoben, im Browser bestätigt | `26d26e2` |
| 2 | **E-3** — Vorschaupanel flackert und sagt Falsches | behoben | `161ff69` |
| 3 | **V-2** — `ring-2` auf `<tr>` unsichtbar | behoben, Ursache im Browser nachgemessen | `224d9c6` |
| 4 | **V-4/E-5/T-3** — Toggle ohne Namen, Hilfstexte nicht angebunden | behoben, per Laufzeittest belegt | `961da54` |
| 5 | **F-1** — Akzentinflation (bis zu 13 blaue Flächen) | behoben | `d8c369b` |
| 6 | **C-4** — Vertragsdrift `12-UI-SPEC.md` ↔ `documentedDelta` | nachgezogen (Revision 4) | `11496c9` |

Sechs Befunde im Auftrag, sechs behoben, keiner übersprungen.

---

## Die Befunde im Einzelnen

### 1. E-1 — Die Bestätigung konnte ihre Knöpfe verlieren (BLOCKER)

**Datei:** `desktop/src/components/ui/ConfirmDialog.tsx`

Das Overlay war `fixed inset-0 … flex items-center justify-center` **ohne** `overflow-y-auto`.
Der Bestätigungstext dieser Phase ist der längste der App; ist das Tauri-Fenster niedriger als
die Karte, ragte der `CardFooter` mit „Ja, rückwirkend umstellen" aus dem Ansichtsbereich, und
es gab keine Scrollmöglichkeit. Der Kernpfad von REQ-26 endete in einer Sackgasse.

Gelöst wörtlich wie in `Modal.tsx`: das äußere `fixed inset-0 ${zIndexClass}` bekommt
`overflow-y-auto`, die Zentrierung übernimmt ein neu eingezogenes inneres
`flex min-h-full items-center justify-center p-4`. Das `p-4` ersetzt das bisherige `mx-4` am
Panel, damit der Seitenabstand nicht auf 32 px verdoppelt wird. Die Backdrop-Optik
(`bg-black/50 backdrop-blur-sm`) wandert auf den Scrollbehälter und bleibt unverändert; ein
Hintergrundklick schließt weiterhin nicht (IN-04 war nicht im Auftrag).

**Nachweis, nicht Vermutung:** Der Fall wurde in headless Edge — derselben Blink-Engine, auf der
Tauri unter Windows über WebView2 läuft — bei einer Fensterhöhe von 240 px nachgestellt. Das
Overlay scrollt, beide Knöpfe sind erreichbar. Der vom Auditor als „im laufenden Fenster zu
bestätigen" markierte Punkt ist damit belegt.

### 2. E-3 — Vorschaupanel: zwei Layoutsprünge und ein falscher Satz je Tastendruck

**Datei:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx`

`setPreview(null)` läuft synchron beim Tastendruck, `previewM.isPending` wird erst nach den
400 ms Entprellzeit wahr. In diesem Fenster fiel `getPreviewPanelState()` auf `placeholder`
zurück und behauptete „Die Vorschau erscheint, sobald Stichtag und neue Wochenstunden gesetzt
sind." — obwohl beides gesetzt ist. Wegen `role="status" aria-live="polite"` wurde dieser Satz
zusätzlich vorgelesen.

Eingeführt ist der vierte Wartezustand **`stale`**: Eingaben vollständig, Antwort noch nicht da.

- Der Platzhaltersatz gehört jetzt ausschließlich dem Fall, in dem Stichtag oder Wochenstunden
  **tatsächlich fehlen** (`if (!validFrom || weeklyHoursNum === null) return 'placeholder';`).
- `stale` und `loading` zeigen denselben Ladetext — der Satz wechselt zwischen den beiden
  Zuständen also gar nicht mehr, und die Ansage bleibt ruhig.
- `aria-busy` hängt jetzt an beiden Wartezuständen, nicht mehr allein an `previewM.isPending`.
- Der Kasten hält seine Höhe über `min-h-56` (224 px). Bewusst kein `min-h-[220px]`: 224 ist ein
  Vielfaches von 4 und steht auf der Tailwind-Standardskala — der Vertrag verbietet willkürliche
  Pixelwerte, und in der ganzen Phase gibt es bisher keinen einzigen.

Eine Restbewegung bleibt: Die vollständige Vorschau ist je nach Randfall (Monatshinweis,
Umbruch des Dreierrasters) etwas höher oder niedriger als 224 px. Der Sprung von rund 220 px auf
eine einzige Textzeile und zurück ist damit weg, eine pixelgenaue Ruhe ist ohne Messung der
tatsächlichen Panelhöhe nicht zu haben und wäre den Aufwand nicht wert.

### 3. V-2 — Zustand 10: die Zeilenmarkierung kam nicht an

**Datei:** `desktop/src/components/worktime/WorkTimePeriodList.tsx`

Der Auftrag lautete ausdrücklich: nachprüfen, nicht raten. Das ist geschehen — mit dem echten
Markup, der echten Tailwind-Fassung und headless Edge (Blink/WebView2):

1. **Die Preflight-Vermutung stimmt in der Prämisse:** `@tailwind base` ist aktiv, und die
   ausgelieferte CSS enthält tatsächlich `table{text-indent:0;border-color:inherit;border-collapse:collapse}`.
2. **Die daraus gezogene Schlussfolgerung stimmt aber nicht:** Aktuelles Blink malt den
   `box-shadow` auf einer Tabellenzeile auch bei `border-collapse: collapse`. Im Test war der
   rote Ring sichtbar.
3. **Unsichtbar wurde er aus einem anderen Grund:** Der umgebende `overflow-x-auto`-Container
   beschneidet ihn. `overflow-x: auto` macht die y-Achse rechnerisch ebenfalls zum Scrollbereich,
   und die Tabelle ist mit `w-full` exakt so breit wie ihr Behälter. Übrig blieben zwei rote
   Querstriche über und unter der Zeile — bei der ersten oder letzten Zeile sogar nur einer. Das
   liest sich als Trennlinie, nicht als Markierung. Der Befund des Auditors trifft also zu, seine
   Begründung nicht; das Ergebnis für den Anwender ist dasselbe.

Ersatz: Flächen- und Randmarkierung auf den **Zellen** — `bg-red-50 dark:bg-red-900/20` auf allen
Zellen der Zeile, `border-l-4 border-red-500 dark:border-red-400` auf der ersten. Zellhintergründe
liegen innerhalb der Zeilenbox und können vom Scrollbehälter nicht beschnitten werden. In hell und
dunkel nachgerendert und geprüft. Die Alternative `border-collapse: separate` wurde verworfen: sie
hätte die Rahmenführung der Tabelle geändert und damit mehr angefasst als nötig.

### 4. V-4 / E-5 / T-3 — Zugänglichkeit

**Dateien:** `desktop/src/components/users/WorkScheduleEditor.tsx`,
`desktop/src/components/worktime/WorkTimeChangeModal.tsx`

**Toggle „Individueller Wochenplan".** War ein nacktes `<button>` mit leerem `<span>` als Knauf:
keine Rolle, kein Zustand, kein Name — ein Screenreader las „Schaltfläche". Im Wechsel-Dialog ist
dieses Element voll bedienbar und entscheidet darüber, ob überhaupt ein Tagesplan mitgeschickt
wird. Jetzt `role="switch"` mit `aria-checked`, benannt über `aria-labelledby` (die sichtbare
Beschriftung) und beschrieben über `aria-describedby` (der Hilfstext darunter). Das `<label>`
ohne `htmlFor`, das nichts umschloss, ist ein `<span>` geworden — ein Label kann einen `<button>`
nicht benennen, die Verknüpfung läuft über die Id. Kein Verhaltens-, kein Layoutunterschied
(beide Elemente sind inline).

**Hilfstexte im Dialog.** Stichtag, Neue Wochenstunden und der Zeichenzähler der Begründung waren
als eigene `<p>` neben dem Feld gebaut und damit **nicht** per `aria-describedby` angebunden — ein
Rückfall hinter WR-16, das genau diese Verknüpfung eingeführt hatte. Sie laufen jetzt über die
`helperText`-Prop von `Input`/`Textarea`. Die Primitive stellt die Verknüpfung her und blendet den
Hilfstext aus, sobald eine Fehlermeldung die Beschreibung übernimmt — das ist auch inhaltlich
richtiger als beides gleichzeitig. Der Zeichenzähler verschwindet weiterhin ab zehn Zeichen
(Textbuch: kein „35/10", kein Häkchen).

**Bewusste Nebenwirkung:** Die Hilfstexte sind damit `text-sm` statt `text-xs`, weil die Primitive
diese Größe setzt. Das ist die Größenfrage aus T-3, die der Vertrag selbst widersprüchlich
regelt. Sie hier zu vereinheitlichen hätte einen Eingriff in `Input`/`Textarea` bedeutet — zwei
Komponenten, die in jedem Formular der App stecken. Der Auftrag lautete „Anbindung nachziehen",
nicht „Primitive umbauen"; die Größenfrage bleibt offen und ist unten vermerkt.

**Beleg:** Ein Laufzeittest (`npx tsx` + `node:assert`, `renderToStaticMarkup`) prüfte am
gerenderten Markup zwölf Zusicherungen — Rolle, `aria-checked` in beiden Stellungen, dass
`aria-labelledby` wirklich auf die sichtbare Beschriftung zeigt, dass `aria-describedby` nicht ins
Leere läuft und dass kein `<label>` ohne `for` übrig ist. Alle grün. Der Prüfling war temporär und
wurde nach dem Lauf entfernt (vitest ist im `desktop/` projektweit nicht lauffähig, `@babel/runtime`
fehlt).

### 5. F-1 — Akzentinflation

**Dateien:** `desktop/src/components/worktime/WorkTimeChangeModal.tsx`,
`desktop/src/components/users/WorkScheduleEditor.tsx`

Der Vertrag reserviert Blau für genau vier Träger: Primärbutton, Fokusring, aktivierter Toggle
und das Info-Panel „Keine Rückwirkung". Gezählt wurden bis zu 13 blaue Flächen. Neutralisiert
sind — ausschließlich Farbklassen, keine Struktur:

| Ort | vorher | nachher |
|-----|--------|---------|
| Mitarbeiter-Infopanel im Dialog | `bg-blue-50 / border-blue-200` + `text-blue-900` | Sekundärfläche `bg-gray-50 dark:bg-gray-800`, Text gray-900/gray-700 |
| bis zu sieben Tageskacheln | `border-blue-300 bg-blue-50` | `border-gray-300 bg-gray-100 dark:bg-gray-800` (belegt) bzw. `border-gray-200 bg-gray-50 dark:bg-gray-900` (leer) |
| Summenkarte | `bg-blue-50 / border-blue-200` | Sekundärfläche `bg-gray-50 dark:bg-gray-800` |

Übrig bleiben im geöffneten Dialog genau die vier vertraglich reservierten Stellen. Der
Unterschied zwischen belegtem und leerem Tag geht nicht verloren, er wird nur ohne Akzentfarbe
erzählt; die Summenzahl trägt ihre Bedeutung ohnehin über grün/orange.

**Reichweite, die man wissen muss:** Der `WorkScheduleEditor` steckt auch im Anlege- und im
Bearbeitenformular. Die Farbänderung wirkt dort mit. Sie ist rein visuell, in beiden Farbmodi
vollständig (jede geänderte Klasse hat ihr `dark:`-Gegenstück) und macht die Kacheln dort
konsistent zu ihrer eigenen Nullstundenvariante, die schon immer grau war.

### 6. C-4 — Vertragsdrift nachgezogen (`12-UI-SPEC.md`, Revision 4)

`12-UI-SPEC.md` beschrieb die Journalzeile in Abschnitt 5 noch so, wie sie **vor** dem
Server-Code-Review geplant war: „ein echter Stundenwert mit Vorzeichen, Trendpfeil und
`font-bold`, genau wie `earned` und `correction`". Der Code liefert seit Server-CR-01 bewusst
etwas anderes.

**Die Begründung, die jetzt im Vertrag steht:** `model_change` ist eine Journalzeile **ohne
Rechenwirkung**. Ihr `hours` ist 0, ihr Betrag steht in einem eigenen Feld `documentedDelta`. Die
Wirkung der Umstellung steckt bereits in den neu gerechneten Tageszeilen ab dem Stichtag; eine
mitsummierende Journalzeile hätte denselben Betrag ein zweites Mal gezählt, und die Summe der
angezeigten Zeilen läge um genau diesen Betrag über dem daneben stehenden Saldo. „0,0 h" wäre für
den Leser trotzdem falsch — die Umstellung *hat* einen Betrag bewirkt, er steht nur nicht in dieser
Zeile. Deshalb: eigene Beschriftung „dokumentierte Differenz", kein Trendpfeil (der bleibt den
summierenden Zeilen), Vorzeichen und dreiwegige Farbe als Träger, Fußnote unter der Tabelle.

Nachgezogen wurden: Revisionsnotiz im Kopf, Frontmatter `revision: 3 → 4`, das Textbuch
„Kontoauszug" (Beschriftung, Betragsformat inklusive `± 0:00h`, Fußnotentext), die
Semantik-Palette (Trendpfeil-Zusage auf die summierenden Zeilen begrenzt), Abschnitt 5 mit der
vollständigen Darstellungsregel, und der Barrierefreiheitsabschnitt. Ausdrücklich festgehalten ist
außerdem, dass **REQ-27 unverändert erfüllt** bleibt: Vorschau und Journalzeile zeigen dieselbe
Zahl im selben Format und derselben Farbe, nur ohne Pfeil.

Alle Angaben wurden am 22.08.2026 an `OvertimeTransactions.tsx` und
`overtimeTransactionFormat.ts` nachgeprüft. Kein Codeeingriff.

---

## Bewusst nicht behoben

Auf Anweisung offen gelassen, weil es Feinschliff ohne Funktionswirkung ist und die geänderte
Fläche unnötig vergrößert hätte:

| Befund | Was offen bleibt |
|--------|------------------|
| **T-1** | `font-medium` an sieben Orten außerhalb der Primitive (drei Badges, drei Sollstundenwerte, Leerzustandsüberschrift). Entweder die vier freien Vorkommen auf 400 zurücknehmen oder die Typografietabelle um „Badge" und „Kennzahl" ergänzen — unentschieden bleiben ist die schlechteste Variante, aber es ist eine Entscheidung des Vertragsgebers, nicht des Behebenden. |
| **T-2** | `ConfirmDialog`: 16-px-Fließtext (`:96` ohne Größenklasse) und 18-px-Dialogtitel über einem 20-px-Titel darunter. |
| **T-3 (Rest)** | Die Größenfrage der Hilfstexte: die Primitive rendert `text-sm`, der Vertrag ordnet Hilfstext `text-xs` zu. Die **Anbindung** ist behoben, die **Größe** nicht — sie zu vereinheitlichen hieße, `Input` und `Textarea` anzufassen. |
| **S-1** | `mt-0.5` am `AlertCircle` des Fehlerbanners — dritte, undeklarierte Rasterausnahme. |
| **S-2** | `mb-8` (Token `xl`) bleibt ungenutzt an der Stelle, für die der Vertrag ihn vorsieht (Abstand Periodenliste ↔ darunterliegendes Feldpaar). |
| **F-2** | Drei Warnfarbtöne: amber (Vorschaupanel), orange (`WorkScheduleEditor`-Abweichung), yellow (`ConfirmDialog`-Symbol). |

Ebenfalls unberührt und weiterhin offen, weil außerhalb des Auftrags: C-1 (`{X,X}` ohne
Nachkommastelle), C-2 (nicht abgenommener Einstiegssatz), C-3 (englische Dezimalpunkte im
Tagesplan), V-1 (konkurrierende grüne Fettzahl), V-3 (Dialoglänge, Beispielkasten), V-5
(ausgegrauter Primärbutton), E-2 (toter X-Knopf in Zustand 12), E-4 (Tabulatorreihenfolge), E-6/E-7
sowie die acht `IN-*` aus dem Code-Review.

---

## Gates

| Gate | Erwartung | Ergebnis |
|------|-----------|----------|
| `cd desktop && npx tsc --noEmit` | Exit 0 | **Exit 0** (nach jedem einzelnen Fix geprüft, nicht nur am Ende) |
| `cd server && npx vitest run` | 418 grün / 3 rot (vorbestehend) | **418 grün / 3 rot** — dieselben drei: zwei Regressionstests in `unifiedOvertimeService.test.ts` (Eintrittsdatum/Korrekturen) und „erkennt einen bereits gelaufenen Backfill" in `vacationBackfillService.test.ts`; keine neue rote Zeile |
| Desktop-Laufzeitprüfung | `npx tsx` + `node:assert` | **12 Zusicherungen grün** (Toggle-Rolle und -Name, Akzentrücknahme, Dark-Mode-Vollständigkeit) |
| Browserverhalten | Blink/WebView2 | `ConfirmDialog` scrollt bei 240 px Fensterhöhe; Zeilenmarkierung in hell und dunkel sichtbar |

Dark Mode ist in allen geänderten Zeilen vollständig: keine neue Farbklasse ohne `dark:`-Gegenstück.
Kein `any`, kein `fetch`, kein `console.log`, kein neues Paket, keine neue Datei.

---

## Anmerkungen für den Orchestrator

- **Kein isoliertes Worktree.** Der Fixer arbeitet üblicherweise in einem eigenen
  `git worktree` unter `/tmp`. Das war hier nicht möglich: Das Projekt nutzt npm-Workspaces,
  sämtliche Abhängigkeiten liegen gehoistet im Repo-Root, und `desktop/node_modules` wie
  `server/node_modules` sind leer. In einem frischen Worktree hätte weder `npx tsc --noEmit` noch
  `npx vitest run` laufen können — die geforderten Gates wären unprüfbar gewesen. Gearbeitet wurde
  deshalb im Haupt-Arbeitsbaum, mit ausdrücklicher Dateiliste bei jedem Commit; parallel angelegte
  Dateien der Vordergrundsitzung (Phase-13-Pläne) sind dadurch in keinen Commit geraten.
- **Zwei UAT-Punkte des Auditors sind erledigt**, nicht offen: E-1 und V-2 wurden im Browser
  nachgestellt statt nur hergeleitet. Ein Klicktest in der laufenden Anwendung bleibt sinnvoll,
  ist aber keine Bedingung mehr.
- **Zur Bewertung:** Die Fixes adressieren die Säulen 3 (Color), 6 (Experience Design) und Teile
  von 2 (Visuals). Die Abzüge in Säule 4 (Typography) bleiben bestehen — das war so entschieden.
- `12-UI-SPEC.md` steht im Kopf weiterhin auf `Approval: pending (Revision 3)`, obwohl der Vertrag
  als abgenommen geführt wird und jetzt Revision 4 trägt. Das ist eine formale Bereinigung, die
  dem Vertragsgeber zusteht, und wurde hier nicht angefasst.

---

_Behoben: 2026-08-22_
_Iteration: 1_
_Sechs Befunde im Auftrag · sechs behoben · keiner übersprungen_
