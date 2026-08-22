---
phase: 13-korrigieren-und-rueckgaengig-machen
fixed_at: 2026-08-23
review_path: .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-UI-REVIEW.md
iteration: 1
fix_scope: blocker_and_must
findings_in_scope: 5
fixed: 5
skipped: 0
deferred: 8
status: all_fixed
---

# Phase 13 — Bericht zur Behebung des UI-Reviews

**Behoben am:** 23.08.2026
**Grundlage:** `13-UI-REVIEW.md` (15/24 — 1 Blocker, 4 weitere Muss-Punkte, 8 Feinschliff-Punkte)
**Vertrag:** `13-UI-SPEC.md` (Revision 2, abgenommen)
**Durchgang:** 1

**Zusammenfassung:**
- Befunde im Auftrag: 5 (M-1 bis M-5)
- Behoben: 5
- Übersprungen: 0
- Bewusst offen gelassen: 8 (F-1 bis F-8, Feinschliff — nicht im Auftrag)

Ein Commit je Befund, in der Reihenfolge des Reviews. Der Blocker zuerst.

---

## Behobene Befunde

### M-1 (BLOCKER, REQ-30) — „rückwirkend ja/nein" kommt jetzt vom Server

**Commit:** `48c7422`
**Geänderte Dateien:** `desktop/src/components/worktime/workTimePeriodEditRules.ts`,
`desktop/src/components/worktime/WorkTimePeriodEditModal.tsx`,
`desktop/src/components/worktime/workTimePeriodEditRules.check.ts`

Der Dialog rechnete „rückwirkend ja/nein" selbst und sah dabei nur das **neue** `validFrom`. Der
Server bildet den neu zu rechnenden Bereich aus dem **Minimum von altem und neuem** Beginn
(`workPeriodCorrectionService.ts`: `rangeStart = input.validFrom < period.validFrom ? … `). Diese
eine Variable steuerte vier Dinge, darunter die Frage, **ob der Bestätigungsschritt überhaupt
stattfindet**.

Die Aussage stammt jetzt aus der Vorschau. Eingeführt ist dafür eine eigene, prüfbare Funktion
`resolveIsRetroactive()`; die Komponente ruft sie an der Stelle, an der vorher der
Zeichenkettenvergleich stand. Liegt eine Vorschau vor, ist `preview.isRetroactive` die einzige
Wahrheit — dieselbe Auflösung, die der Nachbardialog aus Phase 12 an drei Stellen verwendet.

**Eine Abweichung vom Vorschlag des Reviews, bewusst:** Das Review schlägt vor, ohne Vorschau auf
`isRetroactivePeriod(validFrom, todayStr)` zurückzufallen. Die Vorab-Weiche bildet stattdessen
**dasselbe Minimum wie der Server**. Grund: Jede Eingabe verwirft die Vorschau synchron und startet
sie 400 ms entprellt neu (`handleValidFromChange`). In diesem Wartefenster hätte der einfache
Rückfall genau den beanstandeten Satz „Es wird nichts rückwirkend geändert" kurz aufblitzen lassen —
denselben Fehler, nur kürzer. Der Riegel selbst hängt ohnehin nie am geschätzten Wert: Ohne
Vorschau ist der Primärknopf gesperrt.

**Regressionstest, ohne den Fix rot — nachgewiesen.** `workTimePeriodEditRules.check.ts` enthält
fünf neue Prüffälle, darunter der Fall aus dem Review (Periode ab 01.01.2026, Beginn auf 01.10.2026
verschoben, heute 23.08.2026). Zum Nachweis wurde `resolveIsRetroactive()` vorübergehend auf das
Verhalten vor dem Fix zurückgesetzt (`return isRetroactivePeriod(args.validFrom, args.today);`):

```
AssertionError [ERR_ASSERTION]: Liegt eine Vorschau vor, ist ihr isRetroactive die einzige
Wahrheit — der Bestätigungsschritt hängt daran.

false !== true
    at workTimePeriodEditRules.check.ts:280
```

Exit-Code 1. Danach wurde der Fix wiederhergestellt; das Skript läuft grün durch (25 Prüffälle).

---

### M-2 — Tooltip „Nicht löschbar": Ursache nachgemessen, Variante 2 umgesetzt

**Commit:** `8038c55`
**Geänderte Datei:** `desktop/src/components/worktime/workTimePeriodActions.tsx`

**Ursachenprüfung statt Vermutung.** Am 23.08.2026 in headless Edge (dieselbe Blink/WebView2-Engine
wie Tauri unter Windows) mit nachgestelltem Markup gemessen. Sichtbarkeit über
`document.elementFromPoint()` — beschnittene Flächen sind nicht treffbar, während
`getBoundingClientRect()` vom Clipping unberührt bleibt und deshalb nichts beweisen würde:

| Aufbau | Messergebnis |
|---|---|
| Container `overflow-x: auto` | computed `overflow-y` === `auto` — der Container beschneidet auch senkrecht |
| Tooltip `top-6`, 1 Zeile | ragt 54 px unter den Container, untere Hälfte nicht treffbar |
| Tooltip `top-6`, 3 Zeilen | ragt 54 px unter den Container, untere Hälfte nicht treffbar |
| Tooltip `bottom-full mb-1`, 3 Zeilen | vollständig sichtbar |
| Tooltip `bottom-full mb-1`, **1 Zeile** | ragt **56 px über** den Container, obere Hälfte nicht treffbar |

Damit ist die vom Review zuerst vorgeschlagene Variante 1 („nach oben öffnen") **widerlegt**: Sie
trägt erst ab drei Zeilen. Der Chip erscheint nur bei `period.isFirst`, und ein Nutzer mit genau
einer Periode hat genau eine Zeile, die zugleich die erste ist — der häufigste Fall überhaupt.

Umgesetzt ist deshalb **Variante 2**: kein eigenes Tooltip mehr. Träger der Aussage bleiben, wie im
Vertrag festgelegt, das `aria-label` des Chips und die dauerhaft sichtbare Fußnote unter der Liste
(„Fällt das Tooltip aus, fehlt keine Aussage"). Für den sehenden Mausnutzer tritt `title` an seine
Stelle: Das Browser-Tooltip zeichnet der User Agent, kein `overflow`-Container kann es beschneiden.
Dasselbe Paar aus `aria-label` und `title` tragen die beiden Schaltflächen derselben Datei bereits.

WCAG 2.2, 1.4.13 greift damit nicht mehr — das Kriterium gilt ausdrücklich nicht für Einblendungen
des User Agents. Der ESC-Ausblendpfad samt `stopPropagation()` und lokalem Zustand entfällt
ersatzlos.

---

### M-3 — Die Pflichtbegründung meldet sich, statt stumm zu sperren

**Commit:** `68d45b1`
**Geänderte Dateien:** `desktop/src/components/worktime/workTimePeriodEditRules.ts`,
`desktop/src/components/worktime/WorkTimePeriodEditModal.tsx`,
`desktop/src/components/users/EditUserModal.tsx`,
`desktop/src/components/worktime/workTimePeriodEditRules.check.ts`

Zwei Änderungen je Schreibweg:

1. **Beide Seiten zählen getrimmt.** Die Zeichenzähler unter beiden Begründungsfeldern zählen jetzt
   `reason.trim().length` — dieselbe Zählweise, die über das Speichern entscheidet und die auch der
   Server anwendet. Zehn Leerzeichen zeigen damit „0/10 Zeichen (Minimum)" statt „10/10".
2. **Die Sperre wandert vom Knopf in den Absendepfad.** Das Review lässt die Wahl zwischen
   `onBlur`-Feldfehler und entsperrtem Knopf mit Meldung im Absendepfad. Gewählt ist das zweite,
   weil es Zustand 11 des Vertrags („Feldfehler an der `Textarea`; Fokus springt auf das Feld")
   wieder erreichbar macht und weil der Nachbardialog aus Phase 12 es an derselben Stelle genauso
   hält (`WorkTimeChangeModal.handleSubmit()` → `validateForm()`).
   - Korrektur-Dialog: `isPrimaryDisabled()` kennt `trimmedReasonLength` nicht mehr;
     `validateCorrectionForm()` liefert die beiden Sätze aus dem Textbuch, `handleSubmit` setzt den
     Feldfehler und holt den Fokus ins Feld. Kein Serveraufruf.
   - Löschbestätigung: `confirmDisabled` prüft die Begründung nicht mehr; `handleConfirmDeletion()`
     prüft sie als Erstes und setzt einen Feldfehler an der `Textarea` (neu: `error`-Prop, Ref für
     den Fokus, Fehler wird bei jeder Eingabe gelöscht).

Die verbliebenen Sperrgründe erklären sich in der Oberfläche selbst: „Vorschau wird berechnet …"
bzw. „Auswirkung wird berechnet …" im Panel, der Fehlertext samt „Erneut berechnen", der Spinner im
Knopf. Der wortlose graue Knopf mit drei möglichen Ursachen ist damit weg.

---

### M-4 — Zustand 2 ist gebaut

**Commit:** `bda13ad`
**Geänderte Datei:** `desktop/src/components/users/EditUserModal.tsx`

Sichtbarkeit des Korrekturblocks und Sperre seines Knopfes sind entkoppelt:
`{isAdmin && (blockTargetPeriod || periodsLoadFailed) && …}` mit
`disabled={periodsLoadFailed || !blockTargetPeriod}`. Bei einem Ladefehler bleiben Überschrift,
Erklärsatz und der Abgrenzungssatz „Stundenwechsel vs. Korrektur" stehen, der Knopf ist gesperrt —
genau wie der Vertrag es verlangt. Das bisher tote `disabled={!!periodsLoadError}` ist damit
wirksam.

**Ergänzung gegenüber dem Vorschlag des Reviews:** Der 403-Fall ist **ausgenommen**. `useWorkPeriods()`
meldet ihn als `Error('FORBIDDEN')` (DD-31), und für Zustand 3 („Kein Zugriff") schreibt der Vertrag
ausdrücklich „kein Korrekturblock" vor. Die im Review vorgeschlagene Bedingung
`(blockTargetPeriod || periodsLoadError)` hätte den Block dort erscheinen lassen und Zustand 3
gebrochen. Unterschieden wird deshalb zwischen `periodsAccessDenied` und `periodsLoadFailed`.
Zustand 4 (kein Stichtag vorhanden) bleibt unberührt.

---

### M-5 — Der Anker ist wieder eine Zahl, kein Absatz

**Commit:** `4541600`
**Geänderte Dateien:** `desktop/src/components/worktime/workTimePeriodDeleteRules.ts`,
`desktop/src/components/users/EditUserModal.tsx`,
`desktop/src/components/worktime/workTimePeriodDeleteRules.check.ts`

`deleteDetailRebuildParts()` zerlegt Punkt 3 in vier Teile: Kontextsatz, Betragsvorspann,
Stundenwert, Nachsatz. Die Komponente setzt Kontextsatz und Nachsatz in `text-sm` neutral und legt
allein den **vorzeichenbehafteten Stundenwert** in den `text-lg font-bold`-Span mit Signalfarbe —
das ist genau die Reichweite, die der Vertrag für Gewicht 700 vorsieht, und dieselbe Größenordnung
wie der Anker des Nachbardialogs aus Phase 12. Bei einer Differenz von 0 gibt es keinen
Stundenwert, folglich auch keine Hervorhebung und keinen Trendpfeil.

Der **Wortlaut des Textbuchs bleibt unangetastet**: `deleteDetailRebuild()` setzt die Teile wieder
zusammen, die bestehenden zwei Prüffälle auf die vollständige Zeichenkette laufen unverändert, und
ein neuer Prüffall belegt die Gleichheit von Zusammensetzung und Einzelsatz für beide Varianten.

---

## Bewusst offen gelassen (Feinschliff, nicht im Auftrag)

Diese acht Punkte aus `13-UI-REVIEW.md` sind **nicht** behoben und bleiben offen:

| Punkt | Kurzfassung | Bemerkung |
|-------|-------------|-----------|
| **F-1** | Das Wort „rückwirkend" steht auch im Phase-12-Panel und trennt die beiden Aktionen dadurch nicht | Textänderung in `EditUserModal.tsx:838-840`; die übrigen fünf Trennmerkmale tragen |
| **F-2** | Die deklarierte 32 × 32-px-Trefferfläche unter 640 px greift wegen Klassenpräzedenz nicht | WCAG 2.2 AA (24 × 24) bleibt erfüllt |
| **F-3** | Dark Mode: Begründungsfeld der Löschbestätigung ist gray-800 auf gray-800 auf gray-800 | Abgrenzung allein über den Rahmen |
| **F-4** | Der Ghost-Knopf färbt seine ganze Beschriftung amber, nicht nur das Warnsymbol | Vertrag nachziehen oder zurücknehmen — Entscheidung offen |
| **F-5** | Das `details`-Panel der Löschbestätigung hat keine Live-Region | Betrifft `ConfirmDialog.tsx`, Bestandskomponente mit weiteren Aufrufern |
| **F-6** | Zustand 21 zeigt keinen Fortschrittstext „Wird gelöscht …" | Vertragstext an dieser Stelle selbst widersprüchlich |
| **F-7** | Zwei Schreibweisen derselben Wochenstundenzahl (`toFixed(1)` gegen `toLocaleString`) | Kosmetisch, verwandt mit dem offenen IN-04 |
| **F-8** | Zwei Stellen, an denen der Vertrag sich selbst widerspricht (`gap-3`/`gap-2`, `space-y-3`/`space-y-2`) | Kein Umsetzungsfehler — die Spacing-Tabelle der SPEC ist anzugleichen |

**Ebenfalls offen, innerhalb von M-3 genannt:** `Textarea.tsx:21` blendet den Hilfstext aus, sobald
ein Fehler gesetzt ist (`showHelper = !!helperText && !error`) — der Zeichenzähler verschwindet also,
solange der Feldfehler steht. Bewusst nicht geändert: `Textarea` ist eine Bestandskomponente mit
weiteren Aufrufern („NO REGRESSION"), und die Fehlermeldung sagt mehr aus als der Zähler. Sobald der
Anwender tippt, wird der Fehler gelöscht und der Zähler steht wieder da.

---

## Prüfungen nach den Änderungen

| Gate | Erwartung | Ergebnis |
|------|-----------|----------|
| `cd desktop && npx tsc --noEmit` | Exit 0 | **Exit 0** |
| `cd server && npx tsc --noEmit` | Exit 0 | **Exit 0** |
| `cd server && npx vitest run` | 486 grün / 3 rot (vorbestehend) | **486 grün / 3 rot**, dieselben drei: 2× `unifiedOvertimeService.test.ts` (Regression Hire Date), 1× `vacationBackfillService.test.ts` — vor den Änderungen als Basislinie gemessen und unverändert |
| `cd desktop && npm run check:rules` | grün | **grün**, 64 Prüffälle über vier Skripte (vorher 56); Typprüfung über `tsconfig.check.json` inbegriffen |

Die Basislinie wurde **vor** der ersten Änderung erhoben, damit die drei roten Servertests
nachweislich vorbestehend sind und nicht mehr werden.

**Projektregeln:** Kein `any` im geänderten Code, kein direktes `fetch` (alle Aufrufe laufen
unverändert über `apiClient`), jede neue Farbklasse trägt ihre `dark:`-Entsprechung, keine
`console.log`-Ausgaben ergänzt, keine Datumsberechnung über `toISOString().split('T')[0]`.

---

_Behoben: 23.08.2026_
_Bearbeiter: Claude (gsd-code-fixer)_
_Durchgang: 1_
