# Abnahme — Sichtprüfungen mit Playwright

**Angelegt:** 2026-08-25
**Umfang:** die 54 Zeilen, die `14-UAT-TRIAGE.md` Abschnitt 5 als „mit Playwright automatisierbar"
markiert (44 vollständig, 10 teilweise), plus die drei bestehenden E2E-Dateien.
**Nicht enthalten:** die Kategorien `AUTO` und `AUTO-MIT-SERVER` — die liegen bereits in
`14-ABNAHME-AUTO.md` und `14-ABNAHME-SERVER.md` ab.

---

## 1. Zusammenfassung vorneweg

| | Zeilen | davon in der 44er-Liste | davon in der 10er-Liste |
|---|---:|---:|---:|
| **BESTANDEN** | 39 | 34 | 5 |
| **NICHT BESTANDEN** | 12 | 7 | 5 |
| **NICHT PRÜFBAR** | 3 | 3 | 0 |
| **Summe** | **54** | **44** | **10** |

**Die drei E2E-Dateien:** `19 grün · 2 rot · 2 übersprungen` (23 Fälle, 2,1 min, ein Worker).
Vor dieser Abnahme standen sie bei 21 rot / 0 grün, weil die Anwendung nicht übersetzte. Das ist
behoben. Die zwei verbliebenen roten Fälle sind **echte Befunde**, nicht veraltete Selektoren —
einer davon deckt einen Anwendungsfehler auf (Reaktivieren, siehe NB-1).

**Die nicht bestandenen Punkte, je ein Satz:**

| ID | Warum nicht bestanden |
|---|---|
| **11-U2b** | Der 409-Fehler des DATEV-Exports erscheint als roher JSON-Körper im Toast (`DATEV Export fehlgeschlagen: {"success":false,"code":…}`) statt als deutscher Satz. |
| **P12-21** | Die hervorgehobene Saldoänderung im Vorschaupanel hat im Hellmodus nur **3,18:1** Kontrast (Grün auf Amber, 18 px/700 — nach WCAG kein Großtext, Soll 4,5:1). |
| **P12-29b** | Teal-Badge, Vorzeichen und zweite Zeile stimmen, der im Punkt geforderte **Trendpfeil fehlt** auf `model_change`-Zeilen (bewusst entfernt, Server-CR-01) — die Abweichung muss der Anwender abnicken. |
| **P12-30b** | Ein nur **deaktivierter** Nutzer lässt sich in der Oberfläche nicht reaktivieren: `POST /api/users/:id/reactivate` antwortet 404 „User not found or not deleted", der Nutzer bleibt gefangen. |
| **P12-39 / P12-48** | Die E2E-Suite `user-edit.spec.ts` läuft, ist aber nicht vollständig grün: 2 von 7 Fällen rot. |
| **P12-47** | Von den drei neuen Kontoauszugselementen fällt die **positive** dokumentierte Differenz im Hellmodus auf **3,3:1** (Grün auf Weiß). |
| **13-U9** | Der Kontrastdurchgang findet in beiden Modi Unterschreitungen: 3,18 / 3,3 (siehe oben), 3,6–3,9 beim Pflichtfeld-Stern, 3,68 und 3,76 auf den Primär- und Gefahrenknöpfen im Dunkelmodus. |
| **13-U10** | Unter 640 px sind die Zeilenaktionen zwar reine Symbole, die Trefferflächen messen aber **40 × 28 px** und **32 × 24 px** statt der vertraglich zugesagten 32 × 32 px. |
| **14-U6** | Die Zeilenmarkierung der Kollision (Zustand 10) wird gesetzt, ist aber **vollständig vom Wechsel-Dialog verdeckt** und wird beim Schließen wieder gelöscht — der Anwender sieht sie nie. |
| **14.1-U2b** | Der Zukunftsmonat ist nicht unauffällig: September 2026 zeigt „Überstunden (Zeitraum) **−130:00h**", obwohl kein Tag stattgefunden hat. |
| **14.1-U6b** | Der einzige Bedienweg für eine genehmigte Abwesenheit ist „Stornieren"; die Erfolgsmeldung lautet danach **„Abwesenheitsantrag abgelehnt"** — sie beschreibt nicht, was geschehen ist. |

**Die drei nicht prüfbaren:** 13-U8 (der Tooltip-Teil — es gibt kein anwendungsgezeichnetes Tooltip
mehr), 14.1-U7b (die Oberfläche kennt keinen Löschweg für Abwesenheiten), P12-38 (die Spec-Dateien
benutzen den fraglichen Selektor gar nicht). Alle drei sind in Abschnitt 6 begründet.

---

## 2. Umgebung und Werkzeug

- **Server:** `http://127.0.0.1:3100`, `GET /api/health` → **200**.
- **Vite:** `http://localhost:1420/` → **200**, Titel „Tauri + React + Typescript".
- **Anmeldung:** `admin` / `admin123` führt ins Admin-Dashboard (Navigation: Dashboard, Kalender,
  Zeiterfassung, Abwesenheiten, Benachrichtigungen, Mitarbeiter, Urlaubskonten, Überstunden,
  Berichte, Backups, Jahreswechsel, Einstellungen, Abmelden). Screenshot:
  `.planning/ui-reviews/14-sicht-00-dashboard-hell.png`.
- **Playwright:** ausschließlich über `node ../node_modules/@playwright/test/cli.js` (Workspace-Root —
  in `desktop/node_modules` liegt `@playwright/test` **nicht**, der erste Versuch dort scheiterte mit
  `Cannot find module`) bzw. `require('playwright-core')` in eigenen Skripten. Chromium
  **143.0.7499.4** startet.
- **Dunkelmodus:** Die Anwendung wertet `prefers-color-scheme` **nicht** aus. `themeStore.ts` setzt die
  Klasse `dark` allein über den Umschalter. `page.emulateMedia({ colorScheme: 'dark' })` genügt also
  nicht; jeder Dunkelmodus-Lauf klickt zusätzlich `button[aria-label="Toggle theme"]` und prüft
  `document.documentElement.classList.contains('dark') === true`.
- **Kontrastmessung:** eigene WCAG-2.1-Berechnung, in die Seite injiziert; sie löst
  `background-color: transparent` über die Elternkette auf und mischt Alpha-Werte aus. Großtextgrenze
  wie in WCAG: ≥ 24 px oder ≥ 18,66 px bei Gewicht ≥ 700.
- **Abgeschnittene Elemente:** durchgehend `document.elementFromPoint()` an vier Randpunkten, nie
  `getBoundingClientRect()` allein.

---

## 3. Die drei E2E-Dateien

**Befehl:** `cd desktop && node ../node_modules/@playwright/test/cli.js test --reporter=list`
(`webServer`-Block bleibt auskommentiert, der Server lief bereits).

```
23 tests using 1 worker
2 failed · 2 skipped · 19 passed (2.1m)
```

| Datei | grün | rot | übersprungen |
|---|---:|---:|---:|
| `edge-cases.spec.ts` | 8 | 0 | 0 |
| `user-creation.spec.ts` | 6 | 0 | 2 (`test.skip` im Quelltext) |
| `user-edit.spec.ts` | 5 | 2 | 0 |

### Fehlschlag 1 — „Deactivate and reactivate employee" (`user-edit.spec.ts:221`)

**Tatsächliche Meldung:**
```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('tr:has-text("Deactivate User")').locator('button:has-text("Bearbeiten")')
```
Bildschirmfoto: `14-sicht-e2e-deactivate-fehlschlag.png` — die Nutzerliste ohne die Zeile
„Deactivate User".

**Ursache, nachgestellt:** Zwei Gründe übereinander.
1. `UserManagementPage.tsx:49` setzt den Statusfilter auf `'active'`; ein deaktivierter Nutzer
   verschwindet damit aus der Standardansicht (gemessen: `filter='active'`, Zeile nicht vorhanden).
2. Auch mit Filter „Alle" trägt die Zeile **keinen** „Bearbeiten"-Knopf, sondern ausschließlich
   „Reaktivieren" (gemessen: `[{"t":"Reaktivieren","a":null}]`).

Damit ist der Test nicht bloß veraltet — der von ihm geprüfte Bedienweg existiert so nicht mehr,
und der Ersatzweg ist defekt (NB-1).

### Fehlschlag 2 — „Change employee role from employee to admin" (`user-edit.spec.ts:308`)

**Tatsächliche Meldung:**
```
TimeoutError: page.selectOption: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('select[name="role"]')
```
Bildschirmfoto: `14-sicht-e2e-rollenwechsel-fehlschlag.png` — der geöffnete Dialog
„Benutzer bearbeiten" mit dem Feld „Rolle".

**Ursache, gemessen:** Das Rollenfeld existiert, trägt aber kein `name`-Attribut. Laufzeitabfrage
`document.querySelectorAll('[role="dialog"] select')` liefert
`[{"name":null,"id":"","val":"employee"}]`. `EditUserModal.tsx:862` reicht an `<Select label="Rolle" …>`
weder `name` noch `id` durch; `Select.tsx` verteilt nur, was es bekommt. Der Selektor
`select[name="role"]` kann also nie treffen.

**Beide Fehlschläge sind echte Befunde.** Keiner ist auf die Übersetzung zurückzuführen.

---

## 4. Punktprotokoll — die 44 vollständig automatisierbaren Zeilen

### 11-U5b — Die Desktop-Oberfläche zeigt genau diese Zahlen an
**Prüfschritt:** Anmeldung als `abnahme.vollstaendig`, Dashboard; parallel die Serverantworten
mitgeschnitten (`page.on('response')`).
**Ergebnis:** Bildschirm: „Soll: 122:00h · Ist: 160:00h · Aktueller Monat (August 2026) +38:00h".
Serverantwort `GET /api/overtime/balance/48717/2026-08`:
`{"summary":{"targetHours":122,"actualHours":160,"overtime":38}}`. Identisch.
**Bild:** `14-sicht-mitarbeiter-dashboard.png` — Mitarbeiterdashboard mit Überstunden-Saldo-Karte.
**Urteil:** **BESTANDEN** (siehe aber NB-2 zur Arbeitszeitmodell-Kachel derselben Seite).

### P12-3a — Backdrop-Klick und ESC schließen das bestehende Modal
**Prüfschritt:** `EditUserModal` öffnen, `page.locator('[role="dialog"]').count()` messen, ESC drücken,
erneut messen; dann erneut öffnen und `div[aria-hidden="true"].fixed.inset-0` bei (5,5) klicken.
**Ergebnis:** offen → `1`; nach ESC → `0`; nach Backdrop-Klick → `0`.
**Bild:** `14-sicht-explore-edituser.png` — der geöffnete Dialog vor dem Schließen.
**Urteil:** **BESTANDEN**

### P12-4b — ESC schließt den `ConfirmDialog`
**Prüfschritt:** Drei Ebenen aufgebaut (EditUserModal → Wechsel-Dialog → „Rückwirkende Umstellung
bestätigen"), dann ESC.
**Ergebnis:** `Dialoge=2`, oberster Titel danach `"Stundenwechsel: Christine Glas"`. Die Knöpfe des
`ConfirmDialog` heißen unverändert „Zurück zur Vorschau" und „Ja, rückwirkend umstellen"; in der
Löschbestätigung „Abbrechen" und „Ja, Periode löschen und stornieren".
**Bild:** `14-sicht-P12-31-drei-dialoge-light.png`
**Urteil:** **BESTANDEN**

### P12-5 (+31) — Zwei gestapelte Dialoge: ESC schließt nur den obersten, Eingaben bleiben, z-Index stimmt
**Prüfschritt:** Vorname im `EditUserModal` auf `MerkeMich` gesetzt, Wechsel-Dialog geöffnet und
vollständig ausgefüllt (Stichtag 01.07.2026, 20 h, Begründung), ESC.
**Ergebnis:**
- nach ESC: `Dialoge=1`, Titel `"Benutzer bearbeiten: Christine Glas"`, Feld Vorname `"MerkeMich"`.
- Auf der Ebene darunter geprüft: nach ESC auf dem `ConfirmDialog` trägt der Wechsel-Dialog
  unverändert `{"datum":"2026-07-01","std":"20","grund":"Abnahmepruefung Phase 14 Sichtpruefung"}`.
- z-Index-Kette: `EditUserModal = 50`, `Wechsel-Dialog = 60`, `ConfirmDialog = 70`.
- `document.elementFromPoint()` in der Mitte des obersten Dialogs trifft ein Element **innerhalb**
  des obersten Dialogs (`inTopDialog: true`).
**Bilder:** `14-sicht-P12-05-zwei-dialoge-hell.png`, `14-sicht-P12-05-nach-esc-hell.png`,
`14-sicht-P12-31-drei-dialoge-light.png`
**Urteil:** **BESTANDEN**

### P12-6 — Fokus landet nach dem Schließen auf dem auslösenden Element
**Prüfschritt:** `button[aria-label="Bearbeiten: Christine Glas"]` fokussiert, mit Enter geöffnet,
zweimal ESC, `document.activeElement` gelesen.
**Ergebnis:** `{"tag":"BUTTON","aria":"Bearbeiten: Christine Glas"}`.
**Urteil:** **BESTANDEN**

### P12-7 — X-Button beider Dialogtypen trägt einen zugänglichen Namen
**Prüfschritt:** `getByRole('button', { name: 'Dialog schließen' }).count()` und Auslesen aller
ikonischen (textlosen) Knöpfe in allen offenen Dialogen.
**Ergebnis:** Treffer für „Dialog schließen": `1` je `Modal`. Über drei Ebenen:
`[{aria:"Dialog schließen"},{aria:null,role:"switch"},{aria:"Dialog schließen"},{aria:null,role:"switch"},{aria:"Abbrechen"}]`.
Der `ConfirmDialog`-X trägt „Abbrechen". Die zwei namenlosen Knöpfe sind die Umschalter
„Individueller Wochenplan" — sie tragen `role="switch"`, `aria-checked` und `aria-labelledby`,
werden also nicht als „Schaltfläche" angesagt.
**Urteil:** **BESTANDEN**

### P12-8 — Fokusfalle: Tab springt vom letzten zum ersten Element zurück
**Prüfschritt:** Alle sichtbaren fokussierbaren Elemente des Panels ermittelt (18), das letzte
fokussiert, Tab; dann das erste fokussiert, Shift+Tab.
**Ergebnis:**
- letztes Element `"Änderungen speichern"` → nach Tab: `aria="Dialog schließen"`, `isFirst: true`,
  `inDialog: true`.
- erstes Element → nach Shift+Tab: `"Änderungen speichern"`, `isLast: true`, `inDialog: true`.
**Urteil:** **BESTANDEN**

### P12-14 — Periodenliste unter 640 px horizontal scrollbar, nichts abgeschnitten
**Prüfschritt:** Viewport 600 × 900. Container gemessen und jede Zelle mit
`document.elementFromPoint()` an vier Randpunkten abgetastet; danach `scrollLeft = scrollWidth`
gesetzt und die Kopfzellen erneut abgetastet.
**Ergebnis:** `overflow-x: auto`, `scrollWidth 559 > clientWidth 520` → Bildlaufleiste vorhanden.
Vor dem Scrollen ragt allein die Spalte „Aktionen" (rechts 599) über den Container (rechts 560) und
ist an ihrem rechten Randpunkt nicht treffbar. Nach `scrollLeft = 39` (Maximum) sind **alle fünf**
Kopfzellen treffbar und vollständig im Container (`Aktionen: l=448 r=560`).
**Bild:** `14-sicht-P12-14-periodenliste-schmal-600.png` — die Periodenliste bei 600 px Fensterbreite.
**Urteil:** **BESTANDEN**

### P12-15b — Die Badges stehen sichtbar an der richtigen Zeile
**Prüfschritt:** Periodenliste von `Abnahme Vollstaendig` (drei Perioden) ausgelesen; je Zeile
Badge-Text, Kontrast und Bounding-Box.
**Ergebnis:** `11.11.2026 → "Geplant"`, `17.8.2026 → "Aktuell"`, `1.8.2026 → kein Badge`. Der Server
meldet für 22956 (`validFrom 2026-08-17`) `isCurrent: true` — die Zuordnung stimmt. Badge-Box
54 × 24 px, Kontrast 9,37:1 hell.
**Bild:** `14-sicht-P12-13-periodenliste-light.png`
**Urteil:** **BESTANDEN**

### P12-16 — Fehlertext und „Perioden erneut laden" bei gestopptem Server
**Prüfschritt:** `page.route('**/api/work-periods**', r => r.abort('failed'))`, dann `EditUserModal`
öffnen.
**Ergebnis:** Sichtbarer Text `"Perioden konnten nicht geladen werden: Failed to fetch"`, darunter der
Knopf „Perioden erneut laden" (`knopf: true`, `knopfSichtbar: true`, Höhe > 0).
**Bild:** `14-sicht-P12-16-periodenfehler.png`
**Urteil:** **BESTANDEN**

### P12-20 — `PREVIEW_STALE` im Wechsel-Dialog als deutscher Satz
**Prüfschritt:** `POST /api/work-periods/change` per Route auf `409` mit
`{"success":false,"error":"PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell."}` gelegt; danach ein
`MutationObserver` **plus** `requestAnimationFrame`-Schleife über 6 s, die jedes Vorkommen von
„nicht mehr aktuell" und von „PREVIEW_STALE" mit Zeitstempel festhält.
**Ergebnis:** Zeichenfolge `PREVIEW_STALE` **nie** an der Oberfläche (0 Treffer). Der deutsche Satz
„Die Vorschau ist nicht mehr aktuell. Sie wird gerade neu berechnet …" erscheint bei ms 60, 66, 82, 98
— danach nicht mehr. Beim zweiten Fehlschlag steht der deutsche Satz „Die Vorschau konnte nicht in
einen speicherbaren Zustand gebracht werden. Bitte berechnen Sie sie erneut." dauerhaft im Panel.
**Bilder:** `14-sicht-P12-20-stale-erster-fehlschlag.png`, `14-sicht-P12-25b-stale-zweiter-fehlschlag.png`
**Urteil:** **BESTANDEN** — der Rohcode erscheint nicht, deutscher Text steht da. Die Standzeit des
ersten Banners von rund 40 ms ist als **NB-4** aufgenommen.

### P12-22 (+6, +8) — Ein Durchgang ausschließlich mit der Tastatur
**Prüfschritt:** Enter auf dem Bearbeiten-Knopf; Anfangsfokus, Tab-Reihenfolge, Wickeln in beide
Richtungen, ESC, Fokusrückgabe.
**Ergebnis:** Anfangsfokus
`{"tag":"BUTTON","aria":"Dialog schließen","inDialog":true}` — der Fokus wird beim Öffnen in das Panel
gezogen (CR-02 wirkt). Tab-Ring wickelt in beide Richtungen (siehe P12-8). ESC schließt oberste Ebene
zuerst. Fokusrückgabe an `aria-label="Bearbeiten: Christine Glas"`.
**Urteil:** **BESTANDEN**

### P12-23b — „± 0:00h"-Anzeige und Nulldifferenz-Textvariante
**Prüfschritt:** (a) Wechsel für Christine Glas (Tagesplan Mo 4 · Di 4) auf 20 h — die Sollstunden
bleiben gleich; (b) für `Abnahme Vollstaendig` Stichtag 20.08.2026 bei unveränderten 30 h und
unverändertem Tagesplan.
**Ergebnis:** (a) Panel zeigt `Differenz ± 0:00h` und `Änderung des Überstundensaldos: ± 0:00h`, ohne
Trendpfeil (gemessen: kein `svg` in der Zeile, Farbe `rgb(75,85,99)` = grau). (b) Nulldifferenz-Text:
„Die eingegebenen Werte entsprechen der aktuell gültigen Periode ab 17.8.2026. Es gibt nichts
umzustellen — ändern Sie die Wochenstunden oder den Tagesplan.", Speichern-Knopf `disabled: true`.
**Bild:** `14-sicht-P12-23b-nulldifferenz.png`
**Urteil:** **BESTANDEN**

### P12-24 — Unter 640 px stehen Stichtag/Wochenstunden und Kennzahlen untereinander
**Prüfschritt:** Viewport 600 × 900, Vorschau erzeugt, Bounding-Boxen verglichen.
**Ergebnis:** `gridTemplateColumns: "486px"` — eine Spalte. Kennzahlen: `bisher (top 990)`,
`neu (top 1046)`, `Differenz (top 1102)`, alle `left 57`, alle Breite 486 → untereinander.
Stichtag `top 267 / bottom 309`, Wochenstunden `top 401` → `untereinander: true`.
**Bild:** `14-sicht-P12-24-wechseldialog-schmal-600.png`
**Urteil:** **BESTANDEN**

### P12-25b — Automatische Neuberechnung beim ersten Fehlschlag, sauberer Fehlerzustand beim zweiten
**Prüfschritt:** wie P12-20, zweimal hintereinander gespeichert.
**Ergebnis:** Nach dem ersten Fehlschlag ist die Vorschau ohne Zutun wieder gefüllt (Panel zeigt
erneut Sollstunden und Saldo — die automatische Neuberechnung hat stattgefunden). Nach dem zweiten:
Panel rot (`rgb(254,242,242)`), Text „Die Vorschau konnte nicht in einen speicherbaren Zustand
gebracht werden. Bitte berechnen Sie sie erneut.", Knopf „Vorschau erneut berechnen" vorhanden,
`"Stundenwechsel speichern"` → `disabled: true`. Zwei Aufrufe an `/change`, also keine dritte
Neuberechnung.
**Bild:** `14-sicht-P12-25b-stale-zweiter-fehlschlag.png`
**Urteil:** **BESTANDEN**

### P12-26b — Infopanel zeigt „Aktuell gültig seit {Eintrittsdatum}"
**Prüfschritt:** Konstruierter Fall — in `development.db` hat **kein** aktiver Nutzer eine leere
Periodenliste (SQL-Abfrage: 0 Treffer). Deshalb `GET /api/work-periods?…` per Route auf
`{"success":true,"data":[]}` gelegt.
**Ergebnis:** Periodenliste: „Noch kein Stichtag hinterlegt … Es gelten die Stammdatenwerte seit dem
Eintrittsdatum." Infopanel des Wechsel-Dialogs: `Eintrittsdatum: 1.8.2026` und
`Aktuell gültig seit 1.8.2026: 40 h/Woche` — also das Eintrittsdatum.
**Bild:** `14-sicht-P12-26b-infopanel-ohne-periode.png`
**Urteil:** **BESTANDEN**

### P12-28 — Vollständiger Bedienfluss Bearbeiten → Wechsel-Dialog → Vorschau → Speichern → Banner
**Prüfschritt:** Wegwerfnutzer `sicht.p1228` („Sichtpruefung Wechselfall", Eintritt 01.01.2026, 40 h)
über die Oberfläche angelegt, dann Stichtag 01.07.2026 / 20 h / Begründung, Vorschau abgewartet,
gespeichert, bestätigt.
**Ergebnis:**
- Vorschau: „Rückwirkend · Neu gerechnet wird vom 1.7.2026 bis heute (25.8.2026) — 40 Arbeitstage …
  bisher 320:00h · neu 160:00h · Differenz −160:00h · Änderung des Überstundensaldos: +160:00h".
- Bestätigungsschritt: „Rückwirkende Umstellung bestätigen … Der Überstundensaldo ändert sich dabei um
  +160:00h — von −320:00h auf −160:00h."
- Nach dem Speichern: grünes Banner **„Stundenwechsel gespeichert: ab 1.7.2026 gelten 20 h/Woche."**,
  Periodenliste jetzt zweizeilig (`1.7.2026 Aktuell … 20 h` / `1.1.2026 … 1.7.2026 … 40 h`).
**Bild:** `14-sicht-P12-28-banner-nach-speichern.png`
**Urteil:** **BESTANDEN**

### P12-29b — Teal-Badge, Vorzeichen, Trendpfeil und zweite Zeile
**Prüfschritt:** Kontoauszug (Berichte → `Abnahme Vollstaendig` → August 2026), jede Zeile mit
Badge-Farbe, Stundenspalte, Icon-Vorhandensein und zweiter Beschreibungszeile ausgelesen.
**Ergebnis:**
- Badge „Modellwechsel": `bg rgb(204,251,241)` (teal-100), `fg rgb(15,118,110)` (teal-700) → teal. ✔
- Vorzeichen: `+48:00h`, `−14:00h`, `± 0:00h` — vorhanden und richtig. ✔
- Zweite Zeile: „Periode ab 17.8.2026 · eingetragen am 25.8.2026 von System Administrator". ✔
- **Trendpfeil: nicht vorhanden** (`trendIcon: false` auf allen `model_change`-Zeilen).
`OvertimeTransactions.tsx` begründet das ausdrücklich („Kein Trendpfeil — der ist den summierenden
Zeilen vorbehalten", Server-CR-01).
**Bild:** `14-sicht-P12-47-kontoauszug-light.png`
**Urteil:** **NICHT BESTANDEN** gegenüber dem Wortlaut des Punktes — drei von vier Merkmalen stimmen,
das vierte ist bewusst entfallen. Die Abweichung ist dokumentiert und braucht eine Festlegung des
Anwenders, keine Reparatur.

### P12-30b — Die Bedienwege der Nutzerverwaltung verhalten sich wie in v1.8.0
**Prüfschritt:** Über die Oberfläche: Anlegen, Deaktivieren (Haken „Benutzer ist aktiv"), Filter auf
„Alle", Reaktivieren; Netzverkehr auf `/api/users` mitgeschnitten.
**Ergebnis:**
- Anlegen: Zeile erscheint. ✔
- Deaktivieren: Zeile verschwindet aus der Standardansicht (Filter `active`); mit Filter „Alle":
  `Sichtpruefung Wechselfall | @sicht.p1228 | Mitarbeiter | 01.01.2026 | Inaktiv | 40h | Reaktivieren`.
- **Reaktivieren:** `POST /api/users/48737/reactivate → 404 {"success":false,"error":"User not found
  or not deleted"}`. Toast: `"User not found or not deletedDie Anfrage konnte nicht verarbeitet
  werden."`. Die Zeile bleibt „Inaktiv"; ein „Bearbeiten"-Knopf wird für inaktive Nutzer nicht
  angeboten.
- Passwort-Reset und Löschen sind über die Zeile eines inaktiven Nutzers **nicht erreichbar** (die
  Zeile trägt nur den einen Knopf).
**Bild:** `14-sicht-P12-30b-reaktivieren-fehler.png` — die Liste mit dem roten Toast.
**Urteil:** **NICHT BESTANDEN** (NB-1)

### P12-31 — z-Index-Stapelung
Siehe P12-5. Gemessen `50 < 60 < 70`. **BESTANDEN**

### P12-34 — Server nicht erreichbar: kein Zahlenanspruch, Hinweistext, Antrag bleibt absendbar
**Prüfschritt:** `page.route('**/api/holidays**', r => r.abort('failed'))`, Abwesenheiten → „+ Neuer
Antrag", Zeitraum 07.09.–11.09.2026.
**Ergebnis:** Hinweis „Vorschau kann gerade nicht berechnet werden. Der Antrag kann trotzdem gestellt
werden."; Suche nach Zahlen mit Einheit im Dialog: `[]` — **keine** Zahl behauptet; Knopf
„Urlaub beantragen" `disabled: false`.
**Bild:** `14-sicht-P12-34-vorschau-nicht-verfuegbar.png`
**Urteil:** **BESTANDEN**

### P12-35b — Die Zeile „Aktuell gültiges Modell seit …" zeigt genau dieses Datum
**Prüfschritt:** Als `abnahme.vollstaendig` angemeldet, „Details anzeigen" geöffnet; parallel
`GET /api/work-periods?userId=48717` mitgeschnitten.
**Ergebnis:** Zeile: **„Aktuell gültiges Modell seit 17.8.2026"**. Serverantwort: Periode 22956,
`validFrom 2026-08-17`, `isCurrent: true` — die größte `validFrom ≤ heute`. Datum stimmt.
**Bild:** `14-sicht-P12-35b-arbeitszeitmodell-detail.png`
**Urteil:** **BESTANDEN** — das Datum stimmt. Die Zahlen daneben stimmen nicht (NB-2).

### P12-37 / P12-38 / P12-39 / P12-48 — die E2E-Suite
- **P12-37** „Change employee to 0 hours": im Lauf **grün** (5,5 s). → **BESTANDEN**
- **P12-38** die sieben `button[aria-label="Bearbeiten"]`-Selektoren: die Tests benutzen durchgehend
  `button:has-text("Bearbeiten")`, nicht den `aria-label`-Selektor; sechs von sieben Fällen finden den
  Knopf und laufen durch. Der einzige Fall, in dem er nicht gefunden wird, scheitert daran, dass die
  **Zeile** fehlt (Fehlschlag 1). Ein eigener Nachweis für die Fassung mit `aria-label` liegt damit
  nicht vor. → **NICHT PRÜFBAR** in dieser Form (der Sache nach unauffällig).
- **P12-39 / P12-48** vollständiger Lauf `user-edit.spec.ts`: **5 grün, 2 rot** (7 Fälle). →
  **NICHT BESTANDEN** (Meldungen in Abschnitt 3)

### 13-U2b — Blaues Panel „Keine Rückwirkung" statt des Warnbanners
**Prüfschritt:** Stichtag auf 01.12.2026 (Zukunft) gesetzt, Panel gemessen — hell und dunkel.
**Ergebnis:** hell `bg rgb(239,246,255)` (blue-50), Rahmen `rgb(191,219,254)`, Badge
**„Keine Rückwirkung"** auf `rgb(219,234,254)`, Icon `rgb(37,99,235)`; Text „Wirksam ab 1.12.2026.
Bis dahin ändert sich keine Minute."; `Rückwirkend`-Badge **abwesend**.
Dunkel: `rgba(30,58,138,0.2)`, Rahmen `rgb(30,64,175)`, Icon `rgb(96,165,250)`.
**Bilder:** `14-sicht-13-U2b-keine-rueckwirkung-light.png`, `…-dark.png`
**Urteil:** **BESTANDEN**

### 13-U3b — Reihenfolge Lückenschluss / Storno / Saldoänderung
**Prüfschritt:** Löschbestätigung für die Periode ab 11.11.2026 geöffnet, die Kinder des
`details`-Panels der Reihe nach gelesen.
**Ergebnis:**
1. „Die Periode davor (ab 17.8.2026, 30 h/Woche) gilt danach unbefristet weiter — es entsteht keine Lücke."
2. „Zu dieser Periode gibt es keine Buchung im Kontoauszug — es wird nichts storniert."
3. „Neu gerechnet wird vom 11.11.2026 bis heute." / „Der Überstundensaldo bleibt dabei unverändert."
4. „Begründung (Pflicht)* 0/10 Zeichen (Minimum)"
Beim zweiten Fall (Periode ab 17.8.2026) lautet Punkt 2 „Die zugehörigen Buchungen (−14:00h, ± 0:00h,
± 0:00h) werden nicht entfernt. Sie werden durch Gegenbuchungen ausgeglichen." und Punkt 3
„Der Überstundensaldo ändert sich dabei um −14:00h — von +38:00h auf +24:00h."
**Bild:** `14-sicht-13-U3b-loeschbestaetigung.png`
**Urteil:** **BESTANDEN**

### 13-U4b — Punkt 3 wird zum Fehlertext, der Bestätigungsknopf bleibt gesperrt
**Prüfschritt:** `**/api/work-periods/*/delete/preview` per Route auf `500` gelegt, Löschdialog geöffnet.
**Ergebnis:** Punkt 1 (Lückenschluss) bleibt stehen; an Stelle von Punkt 2/3 steht
„Die Auswirkung konnte nicht berechnet werden. Ohne diese Angabe wird nicht gelöscht." mit dem Knopf
„Erneut berechnen". `"Ja, Periode löschen und stornieren"` → `disabled: true`.
**Bild:** `14-sicht-13-U4b-loeschvorschau-fehler.png`
**Urteil:** **BESTANDEN**

### 13-U5b — Beide teal, graue Zustands-Badges, Beleg-Chip springt und hebt 2 s hervor
**Prüfschritt:** Kontoauszug 48717/August; beide Zeilen des Storno-Paars ausgelesen, dann den ersten
Beleg-Chip geklickt und den Zeilenzustand nach 0,3 s und nach 2,5 s gemessen.
**Ergebnis:**
- Beide Zeilen tragen das teal Badge „Modellwechsel" (`rgb(204,251,241)` / `rgb(15,118,110)`).
- Zustands-Badges grau (`rgb(243,244,246)` / `rgb(55,65,81)`): `"storniert"` auf der Ursprungszeile,
  `"Storno"` auf der Gegenbuchung.
- Beide tragen denselben Chip `"Beleg #582627"`, mit unterschiedlichem `aria-label`
  („Zugehörige Storno-Buchung anzeigen" / „Zugehörige Ursprungsbuchung anzeigen").
- Nach dem Klick: genau **eine** Zeile hervorgehoben, Klasse `ring-2 ring-inset ring-gray-400`,
  `document.elementFromPoint()` in ihrer Mitte trifft die Zeile, Fokus liegt auf dem `TR`.
  Nach 2,5 s: keine hervorgehobene Zeile mehr.
**Bild:** `14-sicht-13-U5b-beleg-sprung.png`
**Urteil:** **BESTANDEN**

### 13-U6 — Beleg-Chip zeigt Erklärtext statt stillem Klick
**Prüfschritt:** Konstruierter Randfall — `GET /api/overtime/transactions/live…` abgefangen und die
Gegenbuchung (`reversalOf != null`) aus der Antwort entfernt (2 Antworten verändert), sodass die
Ursprungszeile ihren Partner nicht mehr findet.
**Ergebnis:** Klick auf den verbliebenen Chip erzeugt einen Toast:
**„Die zugehörige Buchung liegt außerhalb des gewählten Zeitraums (August 2026)."** Kein stiller Klick.
**Bild:** `14-sicht-13-U6-beleg-erklaertext.png`
**Urteil:** **BESTANDEN**

### 13-U7b — Graues Panel „Kein Zugriff" mit Schloss statt rotem Fehler-Toast
**Prüfschritt:** `**/api/work-periods**` per Route auf `403` gelegt, `EditUserModal` geöffnet.
**Ergebnis:** Panel „Kein Zugriff auf die Arbeitszeit-Perioden — Diese Angaben dürfen nur
Administratoren einsehen. …", Schloss-Icon vorhanden, keine Toasts auf der Seite.
**Bild:** `14-sicht-13-U7b-kein-zugriff.png`
**Urteil:** **BESTANDEN**

### 13-U8 — Chip „Nicht löschbar": Tab, Tooltip, ESC
Siehe Abschnitt 6 — **NICHT PRÜFBAR** (Teil erfüllt).

### 13-U10 — Unter 640 px: Symbole, Trefferfläche ≥ 32 × 32 px, Knopf über volle Breite
**Prüfschritt:** Viewport 600 × 900; Aktionszelle der Periodenzeile ausgelesen (`display` der
Beschriftungs-`span`s, Bounding-Boxen), außerdem die Knopfbreiten gegen die Panelbreite gestellt.
**Ergebnis:**
- Beschriftungen `display: none`, Breite 0 → **nur Symbole**. ✔
- „Korrigieren": **40 × 28 px**. Chip „Nicht löschbar": **32 × 24 px**.
- Der Designvertrag (`13-UI-SPEC.md`, Abschnitt Responsive und Barrierefreiheit) fordert an beiden
  Stellen ausdrücklich `p-2` und **32 × 32 px**. Ursache: `className="p-2 sm:px-3 sm:py-1.5"` wird von
  den Größenklassen `px-3 py-1.5` der `Button`-Primitive überschrieben (Tailwind entscheidet nach
  Quelltextreihenfolge der erzeugten Regeln, nicht nach Reihenfolge im `class`-Attribut).
- WCAG 2.2 AA (2.5.8, 24 × 24 px) ist eingehalten — der Chip liegt mit 24 px exakt auf der Grenze.
- „Knopf über volle Breite": „Stammdaten rückwirkend korrigieren …" misst 486 px = volle Inhaltsbreite
  (Panel 568 px abzüglich `p-6` beidseitig). ✔
**Bild:** `14-sicht-P12-14-periodenliste-schmal-600.png`
**Urteil:** **NICHT BESTANDEN** (Trefferfläche)

### 13-U12b — Keine Konsolen-Fehlermeldung ersetzt den entfernten Code
**Prüfschritt:** Konsole und `pageerror` über einen vollständigen Durchgang mitgeschnitten
(Anmeldung → Mitarbeiter → EditUserModal → Wechsel-Dialog → zweimal ESC → Berichte).
**Ergebnis:** `pageerror`: **0**. `console.error`: **2**, beide wörtlich
`"Failed to load resource: the server responded with a status of 401 (Unauthorized)"`. Sie entstehen
auf der Anmeldeseite durch die Sitzungsprüfung `GET /api/auth/me`, bevor eine Sitzung besteht — kein
Anwendungscode, keine Meldung aus `client.ts`. `console.warning`: **0**.
**Urteil:** **BESTANDEN**

### 13-U18b — An der Oberfläche steht ein lesbarer deutscher Satz, nicht der Code
Siehe P12-20. Die Zeichenfolge `PREVIEW_STALE` wurde über 6 s mit `MutationObserver` + rAF nie
angezeigt. **BESTANDEN** (mit NB-4).

### 14-U5b — Tooltip, Feldfehler mit Fokus, gesperrter Korrekturblock, fette Zahl
**Prüfschritt:** vier Teilmessungen.
**Ergebnis:**
- **Tooltip (M-2):** Der Chip trägt `title` und `aria-label` mit dem vollständigen Satz „Dies ist die
  erste Periode seit dem Eintritt am 1.8.2026 …"; ein eigenes, absolut positioniertes Tooltip-Element
  existiert nicht mehr — genau die im Quelltext dokumentierte Variante 2, die das Beschneiden durch
  `overflow-x-auto` ausschließt. ✔
- **Feldfehler mit Fokus (M-3):** „Ja, Periode löschen und stornieren" ohne Begründung geklickt →
  `[role="alert"]` mit `"Begründung ist erforderlich"`, `document.activeElement.tagName = "TEXTAREA"`,
  Dialog bleibt offen. ✔
- **Gesperrter Korrekturblock:** Bei laufender bzw. gescheiterter Löschvorschau ist der
  Bestätigungsknopf `disabled` (siehe 13-U4b), die Begründung sperrt ihn bewusst nicht mehr. ✔
- **Fette Zahl (M-5):** In der Löschbestätigung mit Saldowirkung ist **genau ein** Textknoten fett:
  `{"t":"-14:00h","fs":"18px","fw":"700","col":"rgb(220,38,38)"}` — der Kontextsatz nicht. Bei
  Saldoänderung 0 gibt es gar keinen fetten Knoten, wie vorgesehen. ✔
**Bilder:** `14-sicht-14-U5b-m5-fette-zahl.png`, `14-sicht-14-U5b-pflichtbegruendung.png`
**Urteil:** **BESTANDEN**

### 14-U9b — Der Admin wird in der Oberfläche zum Wechsel-Dialog geleitet
**Prüfschritt:** Feld „Wochenstunden" im `EditUserModal` ausgelesen.
**Ergebnis:** `readOnly: true`, `disabled: false`, Wert lesbar (Kontrast 17,74:1 hell / 6,99:1 dunkel,
`opacity: 1`). Direkt darunter der Hilfetext „Wird über „Stundenwechsel ab Datum …" geändert, damit
vergangene Monate unberührt bleiben." und der gleichnamige Knopf. Zusätzlich der Absatz „Eine
rückwirkende oder künftige Umstellung des Arbeitszeitmodells läuft über eine eigene Aktion mit
Vorschau."
**Bild:** `14-sicht-explore-edituser.png`
**Urteil:** **BESTANDEN**

### 14.1-U1b — Beide Zahlen stehen so auch auf dem Bildschirm nebeneinander
**Prüfschritt:** Für die Nutzer 18, 20, 21, 25 (August 2026) den angezeigten „Zeitkonto-Saldo"
neben der Transaktionstabelle gegen die aus den Tabellenzeilen aufsummierten Stunden gestellt.
**Ergebnis:**

| Nutzer | Zeitkonto-Saldo (Bildschirm) | Summe der Zeilen (aus der Tabelle gerechnet) | Zeilen |
|---:|---|---:|---:|
| 18 | −9:00h | −9,00 | 8 |
| 20 | −23:48h | −23,80 | 17 |
| 21 | −17:00h | −17,00 | 17 |
| 25 | −27:12h | −27,20 | 17 |

Alle vier stimmen überein.
**Bild:** `14-sicht-14.1-U1b-saldo-und-buchungen.png`
**Urteil:** **BESTANDEN**

### 14.1-U2b — Die Darstellung des Zukunftsmonats ist unauffällig
**Prüfschritt:** Berichte → `Abnahme Vollstaendig` → September 2026 (vollständig in der Zukunft).
**Ergebnis:** „Soll-Stunden **130:00h** · Ist-Stunden **0:00h** · 0 % vom Soll · Überstunden (Zeitraum)
**−130:00h**", Transaktionsliste „Keine Transaktionen verfügbar", „Monatliche Entwicklung — Keine
Daten verfügbar". Es gibt also erwartungsgemäß **keine** Buchung mit Datum > heute (das ist 14.1-U2a),
aber die Kennzahlenkarten behaupten für einen Monat, der noch nicht begonnen hat, ein Minus von
130 Stunden.
**Bild:** `14-sicht-14.1-U2b-zukunftsmonat.png`
**Urteil:** **NICHT BESTANDEN**

### 14.1-U6b — Die Oberfläche zeigt das ohne Umweg, und die Erfolgsmeldung stimmt
**Prüfschritt:** Abwesenheitenliste als Admin; alle Aktionsknöpfe erhoben; anschließend den Vorgang an
einem genehmigten Urlaub ausgeführt.
**Ergebnis:** Die Liste bietet für genehmigte Anträge **ausschließlich** „Stornieren" — einen
Löschweg gibt es in der Oberfläche nicht (erhobene Aktionsknöpfe: nur „Stornieren"). Der Stornodialog
verlangt einen Grund und heißt „Urlaub stornieren". Nach der Bestätigung erscheint der Toast
**„Abwesenheitsantrag abgelehnt"**. Datenbankzustand danach: `absence_requests.id=11308`
`status='rejected'`, `adminNote='Abnahme 14.1-U7b Sichtpruefung Storno'` — eine Stornierung wird als
Ablehnung gespeichert und ist von einer echten Ablehnung nicht unterscheidbar.
**Bilder:** `14-sicht-14.1-U7b-stornodialog.png`, `14-sicht-14.1-U7b-nach-storno.png`
**Urteil:** **NICHT BESTANDEN** (Erfolgsmeldung beschreibt nicht den Vorgang; siehe NB-6, und die
Wechselwirkung mit 14.1-U12a)

### 14.1-U7b — Die Bewegung ist am Mitarbeiterbildschirm sichtbar
Siehe Abschnitt 6 — **NICHT PRÜFBAR** (es gibt keinen Löschweg in der Oberfläche).

### 14.1-U9b — Die Gutschrift steht ohne Zwischenschritt im Kontoauszug
**Prüfschritt:** Krankmeldung für den 21.08.2026 (vergangener Werktag ohne Zeiterfassung) über
„+ Neuer Antrag" angelegt, danach unmittelbar den Kontoauszug August 2026 geladen.
**Ergebnis:** Toast **„Krankmeldung wurde automatisch genehmigt"**, kein weiterer Schritt nötig.
Kontoauszug vorher `Zeitkonto-Saldo +38:00h · Ist 160:00h · keine Krankheitszeile`; nachher
`Zeitkonto-Saldo +44:00h · Ist 166:00h` und die Zeile
`21.8.2026 | Krankheit | Krankheit (genehmigt #11316) | —`. Die Bewegung von +6:00h (= Tagessoll)
ist sofort da.
**Hinweis:** Die Stundenspalte der Krankheitszeile zeigt `—`, nicht `+6:00h`. Genau darüber ist unter
**14.1-U3** noch zu entscheiden (Gegenbuchung oder `hours: 0`); es ist kein zusätzlicher Befund.
**Bilder:** `14-sicht-14.1-U9b-krankmeldung-liste.png`, `14-sicht-14.1-U9b-gutschrift.png`
**Urteil:** **BESTANDEN**

### 14.1-U17b — Die Oberfläche zeigt beide Male denselben Wert
**Prüfschritt:** Berichte → 48717 → August 2026 geladen, Werte gelesen, Seite neu geladen, erneut
denselben Bericht geladen und gelesen. Der Nutzer trägt sechs `compensation`-Buchungen.
**Ergebnis:**
```
Durchgang 1: Zeitkonto-Saldo +38:00h · Aktueller Saldo +38:00h · Soll 122:00h · Ist 160:00h
Durchgang 2: Zeitkonto-Saldo +38:00h · Aktueller Saldo +38:00h · Soll 122:00h · Ist 160:00h
```
Kein Sprung.
**Bild:** `14-sicht-14.1-U17b-zweimal-derselbe-wert.png`
**Urteil:** **BESTANDEN**

---

## 5. Punktprotokoll — die 10 teilweise automatisierbaren Zeilen

### 11-U2b — Ist die 409-Meldung in der Oberfläche verständlich?
**Messbarer Teil:** erscheint eine Meldung, und ist es nicht der Rohcode?
**Prüfschritt:** `**/api/exports/datev**` per Route auf den **echten** Antwortkörper des Servers gelegt
(`server/src/routes/exports.ts:124` liefert bei `IncompleteExportError` HTTP 409 mit
`{success:false, error:…, skippedUserIds:[…]}`), dann „DATEV Export" geklickt.
**Ergebnis:** Toast, wörtlich:
```
DATEV Export fehlgeschlagen: {"success":false,"code":"PERIOD_CHAIN_GAP","error":"Für 1 Mitarbeiter ist die Periodenkette lückenhaft. Der Export wurde abgebrochen."}
```
Der Grund steht in `desktop/src/api/exports.ts:34-36`: `const error = await response.text();` und
`throw new Error(...)` — der **rohe JSON-Körper** wandert ungeparst in die Meldung. Das gilt auch ohne
Abfangen, weil der Server genau diesen Körper sendet.
**Bild:** `14-sicht-11-U2b-409-meldung.png`
**Urteil:** **NICHT BESTANDEN** (messbarer Teil). Ob der darin enthaltene deutsche Satz verständlich
ist, bleibt menschlich — er ist derzeit gar nicht als Satz zu lesen.

### P12-13 — Kontrast Periodenliste (Badges, Tabellentexte) hell/dunkel
**Prüfschritt:** Vollständiger Kontrastdurchlauf über alle Blattknoten des `EditUserModal` samt
Periodenliste, hell und dunkel.
**Ergebnis:** Tabellenköpfe und Zellen 17,74:1 (hell) und im Dunkelmodus über der Grenze; Badge
„Aktuell" 9,37:1 (hell). Einzige Unterschreitung im ganzen Dialog ist der Pflichtfeld-Stern `*`
(`rgb(239,68,68)`): **3,76:1** hell, **3,90:1** dunkel.
**Bilder:** `14-sicht-P12-13-periodenliste-light.png`, `…-dark.png`
**Urteil:** **BESTANDEN** für Badges und Tabellentexte; der Stern ist unter 13-U9 mitgeführt.

### P12-21 — Hervorgehobene Saldoänderung ist das dominante Element
**Messbarer Teil:** Kontrast und Schriftgewicht.
**Prüfschritt:** Rückwirkende Vorschau (40 → 20 h ab 01.07.2026), das Element
„Änderung des Überstundensaldos: +160:00h" gemessen, dazu alle Schriftgrößen des Panels.
**Ergebnis:**
- hell: `fg rgb(22,163,74)` auf `bg rgb(255,251,235)` → **3,18:1**, 18 px, Gewicht 700.
  18 px < 18,66 px → nach WCAG **kein** Großtext, Soll 4,5:1. **Unterschritten.**
- dunkel: `rgb(74,222,128)` auf `rgb(49,43,47)` → **7,92:1**. In Ordnung.
- Schriftgrößen im Panel: der Saldosatz ist mit 18 px/700 der schwerste Textknoten; die Überschrift
  „Was diese Umstellung bewirkt" ist ebenfalls 18 px, aber Gewicht 600. Alle übrigen Knoten 12–14 px.
**Bilder:** `14-sicht-P12-21-saldoaenderung-light.png`, `…-dark.png`
**Urteil:** **NICHT BESTANDEN** (messbarer Teil, Hellmodus). Das Dominanzurteil bleibt menschlich.

### P12-27 — Kontrast des schreibgeschützten Wochenstundenfelds ≥ 4,5:1, kein `opacity`
**Prüfschritt:** `input[name="weeklyHours"]` im `EditUserModal`; Kontrast, `readOnly`, `disabled`,
`opacity` des Feldes **und aller Vorfahren**.
**Ergebnis:** `readOnly: true`, `disabled: false`, `opacity: 1`, keine Vorfahren mit `opacity ≠ 1`.
Kontrast **17,74:1** hell (`rgb(17,24,39)` auf Weiß), **6,99:1** dunkel (`rgb(156,163,175)` auf
`rgb(17,24,39)`).
**Urteil:** **BESTANDEN**

### P12-47 — Kontrast der drei neuen Kontoauszugselemente ≥ 4,5:1
**Prüfschritt:** Kontoauszug 48717/August, jedes neue Element einzeln gemessen, hell und dunkel.
**Ergebnis:**

| Element | hell | dunkel |
|---|---:|---:|
| Badge „Modellwechsel" (teal) | 4,86 | 8,83 |
| Beschriftung „dokumentierte Differenz" | 4,83 | 5,78 |
| Wert, **negativ** (`−14:00h`, rot) | 4,83 | 5,31 |
| Wert, **positiv** (`+48:00h`, grün) | **3,30** | 5,31 |
| Zustands-Badge „storniert"/„Storno" (grau) | 9,37 | 9,96 |
| Beleg-Chip „Beleg #582627" | 4,83 | 5,78 |
| Notizzeile „Storniert am … · Beleg #…" | 4,83 | 5,78 |
| Fußnote „Zeilen vom Typ „Modellwechsel" …" | 4,83 | 5,78 |

**Bilder:** `14-sicht-P12-47-kontoauszug-light.png`, `…-dark.png`
**Urteil:** **NICHT BESTANDEN** — alle Elemente halten die Grenze, außer dem **positiven** Wert der
dokumentierten Differenz im Hellmodus (3,30:1). Dasselbe Grün trifft im Hellmodus auch alle positiven
Tagesbeträge der Zeiterfassungszeilen (`+4:00h`, `+8:00h` → ebenfalls 3,30:1).

### 13-U1b — Amberfarbenes Banner, Ausweg-Satz 3, Saldoänderung als Blickfang
**Prüfschritt:** Rückwirkende Vorschau erzeugt und Panel, Badge, Icon und Textbausteine gemessen.
**Ergebnis:** Panel `bg rgb(255,251,235)` (amber-50), Rahmen `rgb(253,230,138)` (amber-200), Icon
`rgb(217,119,6)` (amber-600), Badge **„Rückwirkend"** `fg rgb(180,83,9)` auf `bg rgb(254,243,199)`
(Kontrast 4,51:1). Textbausteine vollständig: „Neu gerechnet wird vom 1.7.2026 bis heute (25.8.2026)
— 40 Arbeitstage. Alles vor dem 1.7.2026 bleibt unverändert." · „Sollstunden im Zeitraum: bisher
320:00h / neu 160:00h / Differenz −160:00h" · „Überstundensaldo heute … → nach der Umstellung …" ·
„Änderung des Überstundensaldos: +160:00h".
**Bild:** `14-sicht-P12-21-saldoaenderung-light.png`
**Urteil:** **BESTANDEN** für Farbe und Textbausteine. Das Blickfang-Urteil bleibt menschlich — und
ist wegen des unter P12-21 gemessenen Kontrasts von 3,18:1 mit Vorbehalt zu fällen.

### 13-U9 (+P12-13, 21, 27, 47) — Ein Durchgang Dunkelmodus und Kontrast über alle neuen Flächen
**Prüfschritt:** Vollständiger Kontrastdurchlauf (jeder sichtbare Blattknoten mit Text, Alpha und
Elternhintergründe aufgelöst) über: Periodenliste, Wechsel-Dialog samt Vorschaupanel in den Zuständen
„rückwirkend", „Zukunft", „Fehler", Löschbestätigung, Kontoauszug — jeweils hell **und** dunkel
(Umschalter geklickt, `classList.contains('dark') === true` bestätigt).
**Ergebnis — alle Unterschreitungen, vollständig:**

| Fläche | Element | Modus | gemessen | Soll |
|---|---|---|---:|---:|
| Vorschaupanel | „Änderung des Überstundensaldos: +160:00h" | hell | **3,18** | 4,5 |
| Kontoauszug | positive Stundenwerte (grün) | hell | **3,30** | 4,5 |
| EditUserModal / Löschbestätigung | Pflichtfeld-Stern `*` | hell | **3,60–3,76** | 4,5 |
| EditUserModal / Löschbestätigung | Pflichtfeld-Stern `*` | dunkel | **3,90** | 4,5 |
| Alle Dialoge | Primärknopf, Weiß auf `blue-500` („Änderungen speichern", „Rückwirkend speichern") | dunkel | **3,68** | 4,5 |
| Löschbestätigung | Gefahrenknopf, Weiß auf `red-500` („Ja, Periode löschen und stornieren") | dunkel | **3,76** | 4,5 |

Alles andere liegt in beiden Modi über 4,5:1 (Bandbreite 4,51 bis 17,74).
**Bilder:** `14-sicht-P12-13-periodenliste-{light,dark}.png`,
`14-sicht-P12-21-saldoaenderung-{light,dark}.png`, `14-sicht-13-U2b-keine-rueckwirkung-{light,dark}.png`,
`14-sicht-13-U9-loeschbestaetigung-{light,dark}.png`, `14-sicht-P12-47-kontoauszug-{light,dark}.png`
**Urteil:** **NICHT BESTANDEN** (messbarer Teil — sechs Unterschreitungen). Das Urteil „mindestens so
gut wie Phase 12" bleibt menschlich.

### 14-U6 — Die sechs Phase-12-UI-Korrekturen
**Prüfschritte und Ergebnisse einzeln:**

1. **Scrollen (BLOCKER E-1).** Fenster auf 900 × **400** px, Löschbestätigung geöffnet. Overlay
   `overflow-y: auto`, `scrollHeight 633 > clientHeight 400`. Vor dem Scrollen liegt
   „Ja, Periode löschen und stornieren" bei `top 536` — außerhalb. Nach `scrollTop = scrollHeight`:
   `top 303`, im Blick, `document.elementFromPoint()` trifft den Knopf.
   → **in Ordnung.** Bild: `14-sicht-14-U6-confirmdialog-scrollen.png`
2. **Platzhalter.** Begründungsfeld des Wechsel-Dialogs trägt
   „Warum wird umgestellt? Zum Beispiel: Neuer Arbeitsvertrag vom 12.06.2026, Reduzierung auf Teilzeit
   (mindestens 10 Zeichen)". → **in Ordnung.**
3. **Zeilenmarkierung (V-2).** Kollidierender Stichtag 17.08.2026 eingetragen. Feldfehler erscheint
   („Zum 17.08.2026 existiert bereits eine Periode. Wählen Sie ein anderes Datum."), Speichern gesperrt.
   Die betroffene Zeile erhält **Zellhintergrund** `rgb(254,242,242)` und **4 px linken Rand**
   `rgb(239,68,68)` — also die Flächenmarkierung statt des beschnittenen `ring`. Die Umsetzung des
   V-2-Fixes ist damit belegt. **Aber:** `document.elementFromPoint()` auf der markierten Zelle trifft
   `DIV.rounded-lg border p-4 space-y-3 …` — das Vorschaupanel des Wechsel-Dialogs; die Zeile liegt
   vollständig darunter. Nach dem Schließen des Wechsel-Dialogs ist die Markierung wieder weg
   (`bg rgba(0,0,0,0)`, `borderLeft 0px`), weil `handleClose → resetForm → onConflict(null)` sie
   zurücknimmt. → **nicht in Ordnung** (NB-3).
   Bilder: `14-sicht-14-U6-kollision-dialog-offen.png`, `14-sicht-14-U6-kollision-nach-schliessen.png`
4. **Toggle-Rolle.** Der Umschalter „Individueller Wochenplan" trägt `role="switch"`,
   `aria-checked="true"`, `aria-labelledby` und `aria-describedby`. → **in Ordnung.**
5. **Farbflächen („höchstens vier blaue Flächen").** Zählung nach Augenmaß — nicht automatisierbar,
   bleibt menschlich.
6. **Feldfehler mit Fokus.** Bei Kollision springt der Fokus auf das Stichtagsfeld
   (`validFromRef.current?.focus()` in `validateForm()`); im Löschdialog auf die Textarea (siehe 14-U5b).
   → **in Ordnung.**
**Urteil:** **NICHT BESTANDEN** — fünf von sechs Korrekturen tragen, die Zeilenmarkierung erreicht den
Anwender nicht.

### 14.1-U12b — Der Bedienweg führt zur richtigen Funktion
**Prüfschritt:** Berichte → alle Exportknöpfe erhoben, geklickt, Netzverkehr und Downloads mitgeschnitten.
**Ergebnis:** Zwei Knöpfe, „CSV Export" und „DATEV Export".
```
CSV Export   → GET /api/exports/historical/csv?startDate=2026-01-01&endDate=2026-12-31
               Download: Zeiterfassung_Alle_2026.csv
DATEV Export → GET /api/exports/datev?startDate=2026-01-01&endDate=2026-12-31
               Download: DATEV_Export_2026.csv
```
Der Historien-Export liegt hinter „CSV Export" und ruft die unter 14.1-U12a geprüfte Route auf.
**Bild:** `14-sicht-14.1-U12b-exportweg.png`
**Urteil:** **BESTANDEN** (Bedienweg). Ob die Datei so beim Empfänger ankommt, bleibt menschlich.

### 14.1-U25b — Die Oberfläche zeigt das auch so
**Prüfschritt:** Berichte → Nutzer 3, 17, 30 → „Ganzes Jahr" 2026; jede Zeile mit Datum > heute gezählt.
**Ergebnis:**
```
Nutzer  3:  66 Zeilen, davon mit Datum > heute: 0
Nutzer 17:  97 Zeilen, davon mit Datum > heute: 0
Nutzer 30: 100 Zeilen, davon mit Datum > heute: 0
```
**Wichtige Einordnung:** In `server/database/development.db` stehen die Zukunftsbuchungen **noch**:
`SELECT userId, COUNT(*) … WHERE userId IN (3,17,30) AND date > date('now')` → `3: 38 · 17: 33 · 30: 30`
— exakt die „Vorher"-Zahlen aus 14.1-U25a. Die Bereinigung ist gegen eine Arbeitskopie der Produktion
gelaufen, nicht gegen diese Datenbank. Dass die Oberfläche trotzdem keine einzige Zukunftszeile zeigt,
liegt an der Deckelung der Tagesberechnung auf heute im Live-Endpunkt.
**Folgerung:** Der Listeninhalt entspricht dem Sollzustand nach der Bereinigung — und zwar schon
**vorher**. Ein „Verschwinden" ist an der Oberfläche gar nicht wahrnehmbar.
**Bilder:** `14-sicht-14.1-U25b-nutzer-3.png`, `…-17.png`, `…-30.png`
**Urteil:** **BESTANDEN** (Listeninhalt: null Zukunftszeilen). Das Urteil über die Wirkung auf den
Mitarbeiter bleibt menschlich — nach dieser Messung ist keine Wirkung zu erwarten.

---

## 6. Die nicht prüfbaren Punkte, mit Grund

### 13-U8 — Chip „Nicht löschbar" per Tab erreichbar, Tooltip bei Fokus, ESC schließt nur den Tooltip
**Was geprüft werden konnte:**
- `tabIndex = 0`, `document.activeElement === chip` nach `focus()` → erreichbar. ✔
- Tab von der Schaltfläche „Korrigieren" **derselben Zeile** landet auf dem Chip
  (`{"tag":"SPAN","role":"note","aria":"Dies ist die erste Periode seit dem Eintritt am 1.8.2026. …"}`)
  → in Lesereihenfolge unmittelbar hinter der Zeile. ✔
- Fokusring vorhanden (`box-shadow … rgb(59,130,246)`). ✔

**Was nicht geprüft werden konnte:** Ein anwendungsgezeichnetes Tooltip existiert nicht mehr.
`workTimePeriodActions.tsx` dokumentiert die Entscheidung M-2 ausführlich: das frühere
`absolute right-0 top-6`-Tooltip wurde vom `overflow-x-auto`-Container beschnitten und ist ersatzlos
durch das Browser-`title` ersetzt. Ein `title`-Tooltip wird vom Browser gezeichnet, liegt außerhalb
des DOM und ist mit Playwright **nicht** beobachtbar; außerdem öffnet Chromium es bei Tastaturfokus
gar nicht. ESC schließt folglich kein Tooltip, sondern (gemessen) das oberste Modal: `Dialoge=0` nach
ESC auf dem fokussierten Chip.
**Achtung, Widerspruch:** `13-UI-SPEC.md` verlangt unter „Barrierefreiheit" weiterhin ausdrücklich,
die Tooltip-Einblendung müsse „auf `hover` **und** `focus-within`" reagieren und mit ESC ausblendbar
sein. Der Quelltext hat sich bewusst dagegen entschieden. Einer der beiden Texte ist veraltet.
**Bild:** `14-sicht-13-U8-chip-fokus.png`
**Urteil:** **NICHT PRÜFBAR** für den Tooltip-Teil; Erreichbarkeit und zugänglicher Name sind belegt.

### 14.1-U7b — Die Bewegung ist am Mitarbeiterbildschirm sichtbar
Der Punkt setzt das **Löschen** einer Krankmeldung voraus (14.1-U7a: `DELETE` über die API). Die
Oberfläche kennt für Abwesenheiten keinen Löschweg — die Liste bietet ausschließlich „Stornieren"
(gemessen, siehe 14.1-U6b). Die Saldobewegung in der Gegenrichtung ist belegt: das **Anlegen** einer
Krankmeldung bewegt den Saldo sofort und sichtbar von +38:00h auf +44:00h (14.1-U9b). Für die
Löschrichtung fehlt der Bedienweg.
**Urteil:** **NICHT PRÜFBAR** über die Oberfläche.

### P12-38 — Die übrigen sieben `button[aria-label="Bearbeiten"]`-Selektoren
Die Spec-Dateien benutzen durchgehend `button:has-text("Bearbeiten")`, nicht den `aria-label`-Selektor.
Der Lauf belegt damit, dass der Bedienweg funktioniert (7 Fälle, davon 6 mit erfolgreichem Treffer), aber nicht
die Fassung des Selektors, um die es dem Punkt geht. In meinen eigenen Skripten habe ich durchgehend
`button[aria-label="Bearbeiten: {Vorname Nachname}"]` benutzt — dieser Selektor trifft in allen Läufen
zuverlässig. **NICHT PRÜFBAR** in der Formulierung des Punktes; der Sache nach unauffällig.

### 14.1-U25b — der Urteilsteil
Siehe oben: der messbare Teil ist bestanden, das Urteil „fällt nicht negativ auf" bleibt menschlich.

---

## 7. Neue Befunde

### NB-1 — Ein deaktivierter Nutzer lässt sich in der Oberfläche nicht reaktivieren (schwer)
`UserManagementPage.tsx` zeigt für jeden Nutzer mit `!isActive` **nur** den Knopf „Reaktivieren".
Dieser ruft `POST /api/users/:id/reactivate`; der Endpunkt stellt aber ausschließlich **soft-gelöschte**
Nutzer wieder her und antwortet für einen bloß deaktivierten mit
`404 {"success":false,"error":"User not found or not deleted"}`. Damit gibt es für einen deaktivierten
Nutzer **keinen** Weg zurück: „Bearbeiten", „Passwort zurücksetzen" und „Löschen" werden für ihn nicht
angeboten. Der Zustand ist über die Oberfläche eine Sackgasse.
Das ist zugleich die Ursache für E2E-Fehlschlag 1.
**Beleg:** `14-sicht-P12-30b-reaktivieren-fehler.png`, `14-sicht-P12-30b-deaktiviert.png`

### NB-2 — Arbeitszeitmodell-Kachel zeigt Stammdaten statt der gültigen Periode (schwer)
Auf dem Mitarbeiterdashboard von `Abnahme Vollstaendig` steht „Arbeitszeitmodell **40h/Woche** ·
Standard 5-Tage-Woche · Mo-Fr: 8.0h/Tag", in der Detailansicht „Gesamt **40h**" — und direkt darunter
„Aktuell gültiges Modell seit 17.8.2026". Die seit dem 17.8.2026 gültige Periode trägt aber
**30 h/Woche** (Server: `id 22956, weeklyHours 30, isCurrent true`), und die Sollstundenrechnung des
Monats folgt der Periode (122:00h). `WorkScheduleDisplay.tsx` zieht Stunden und Tagesplan aus
`user.weeklyHours` / `user.workSchedule` (Zeilen 62/76/81) und nur das **Datum** aus der Periode.
Der Mitarbeiter liest damit ein Modell, nach dem nicht gerechnet wird.
Derselbe Fehler steht in der Nutzerliste: nach dem Wechsel auf 20 h zeigt die Spalte „Wochenstunden"
weiterhin `40h`.
**Beleg:** `14-sicht-mitarbeiter-dashboard.png`, `14-sicht-P12-35b-arbeitszeitmodell-detail.png`

### NB-3 — Zustand 10: die Zeilenmarkierung erreicht den Anwender nie (mittel)
Siehe 14-U6, Punkt 3. Die Markierung wird korrekt gesetzt (Zellhintergrund + linker Rand, also der
V-2-Fix), liegt aber vollständig unter dem geöffneten Wechsel-Dialog (`elementFromPoint` trifft das
Vorschaupanel) und wird beim Schließen desselben Dialogs wieder gelöscht. Der Pfad ist damit
weiterhin faktisch tot — nur an einer anderen Stelle als vor WR-11.

### NB-4 — Das Stale-Banner des ersten Fehlschlags steht rund 40 ms (mittel)
`performSave()` setzt bei `PREVIEW_STALE` erst `setFormError('Die Vorschau ist nicht mehr aktuell. Sie
wird gerade neu berechnet …')` und ruft unmittelbar danach `requestPreview()`. Deren `onSuccess` ruft
`setFormError('')`. Gegen einen lokalen Server ist die Vorschau nach ~40 ms zurück; gemessen wurde das
Banner bei ms 60 bis 98, danach nie wieder. Der Satz erklärt also nichts, weil ihn niemand liest.

### NB-5 — Rohe Serverkörper und englische Rohtexte in Toasts (mittel)
Drei unabhängige Stellen zeigen ungefilterten Servertext:
1. DATEV-/CSV-Export: `DATEV Export fehlgeschlagen: {"success":false,"code":"PERIOD_CHAIN_GAP",…}`
   (`desktop/src/api/exports.ts:34-36`, `response.text()` statt Auswertung des Feldes `error`).
2. Reaktivieren: `User not found or not deletedDie Anfrage konnte nicht verarbeitet werden.` —
   englischer Rohtext, ohne Trennzeichen an einen deutschen Satz geklebt.
3. Krankmeldung auf einen Tag mit Zeiterfassung: `In diesem Zeitraum existieren bereits Zeiterfassungen
   (8h an folgenden Tagen: 24.08.2026). Bitte zuerst die Zeiterfassungen löschen.Die Anfrage konnte
   nicht verarbeitet werden.` — dasselbe Muster ohne Trennzeichen.

### NB-6 — Stornieren wird als Ablehnung gespeichert (mittel, mit Nebenwirkung auf 14.1-U12a)
Das Stornieren eines **genehmigten** Antrags setzt `absence_requests.status = 'rejected'` und meldet
„Abwesenheitsantrag abgelehnt". Es gibt keinen eigenen Zustand „storniert". Folge: Ein stornierter
Urlaub ist von einem abgelehnten nicht unterscheidbar — und wird deshalb vom unter **14.1-U12a**
geprüften Filter „abgelehnte Anträge nicht mehr im Historien-Export" **mit ausgeschlossen**. Ob das
gewollt ist, ist eine Festlegung, keine Messung.

### NB-7 — `Select` reicht `name`/`id` nicht durch (leicht)
`EditUserModal.tsx:862` rendert das Rollenfeld ohne `name`; `Select.tsx` verteilt nur, was es bekommt.
Die Laufzeitabfrage liefert `{"name":null,"id":""}`. Neben dem E2E-Fehlschlag 2 bedeutet das: das Feld
ist über keinen stabilen Selektor ansprechbar, und ein `<label>`-`for`/`id`-Paar entsteht nicht (die
`Select`-Primitive setzt das Label ohne `htmlFor`).

### NB-8 — `ThemeToggle` trägt einen englischen zugänglichen Namen (leicht)
`aria-label="Toggle theme"` in einer sonst durchgängig deutschen Oberfläche. Fiel bei der Suche nach
zugänglichen Namen (P12-7) auf.

---

## 8. Von mir verursachte Änderungen an `development.db`

Ich habe geprüft, nicht repariert — die folgenden Datenänderungen sind aber beim Prüfen entstanden und
gehören ins Protokoll:

| Was | Warum | Zustand |
|---|---|---|
| `users.privacyConsentAt` für `abnahme.vollstaendig` gesetzt | Das DSGVO-Tor blockiert jede Mitarbeiteransicht; ohne Zustimmung sind 11-U5b, P12-35b und die 14.1-Punkte nicht erreichbar. Kein Testkonto hatte zugestimmt. | beabsichtigt |
| Nutzer `sicht.p1228` („Sichtpruefung Wechselfall") angelegt, Wechsel auf 20 h ab 01.07.2026 gespeichert, danach deaktiviert | P12-28 und P12-30b verlangen den vollständigen Bedienfluss samt Speichern. | beabsichtigt; der Nutzer ist wegen NB-1 **inaktiv und nicht reaktivierbar** |
| Krankmeldung `absence_requests.id = 11316` (48717, 21.08.2026) angelegt | 14.1-U9b | beabsichtigt, nicht zurückgenommen |
| **`absence_requests.id = 11308` storniert** (48717, Urlaub 09.11.–13.11.2026, `reason` „Abnahme P12-32 Stichtag im Zeitraum") — jetzt `status='rejected'`, `adminNote='Abnahme 14.1-U7b Sichtpruefung Storno'` | **Versehen.** Mein Skript hat beim Suchen der Stornieren-Schaltfläche zur Krankmeldung zu weit im DOM nach oben gegriffen und die Karte des Novemberurlaubs getroffen. | **unbeabsichtigt — bitte prüfen, ob dieser Beleg für P12-32 wiederhergestellt werden muss** |
| Die E2E-Suite hat ihre üblichen Testnutzer angelegt (`RoleChange User`, `EndDate User`, `Deactivate User`, …) | Nebenwirkung des angeforderten Laufs | erwartet |

Nicht angefasst: `14-produktionskopie.db`, `14-prod-nach-migration.db`, `14-generalprobe.db`,
`/home/ubuntu/databases/production.db`, `server/database.db`. Kein Produktionscode geändert, kein
Commit, kein Push, kein Deployment. `desktop/.env.development.local` unverändert.

---

## 9. Was auch mit Playwright zwingend menschlich bleibt

1. **Alle Verständlichkeitsfragen.** 11-U2b (ist der Satz verständlich?), 13-U18b (ist der Satz gut?),
   14.1-U16b (sind zwei Belegzeilen am Ausgleichstag verständlich?). Playwright kann belegen, dass
   *ein* deutscher Satz erscheint und *kein* Rohcode — nicht, ob der Satz trägt.
2. **Alle Dominanz- und Vergleichsurteile.** P12-21 („ist das das dominante Element?"), 13-U1b
   („einziger Blickfang"), 13-U9 („mindestens so gut wie Phase 12"), 14-U6 („höchstens vier blaue
   Flächen"). Kontrast, Schriftgewicht und Größe sind Zahlen; Dominanz ist ein Urteil.
3. **Zeitverhalten des Auges.** P12-3b (Flackern beim Portal-Rendering) — mit `MutationObserver` lässt
   sich zeigen, *dass* neu gezeichnet wird, nicht, ob es flackert.
4. **Alles außerhalb des Browsers.** 11-U1b (der DATEV-Importweg im fremden System), 14-U3b (der
   Tauri-Updater einer echten Installation), 14.1-U12b zweite Hälfte (kommt die Datei beim Empfänger
   so an?).
5. **Browser-gezeichnete Einblendungen.** Das `title`-Tooltip aus 13-U8 liegt außerhalb des DOM.
6. **Wirkungsurteile.** 14.1-U25b („fällt das Verschwinden negativ auf?"), 14.1-U2b hätte ohne die
   Zahl −130:00h ebenfalls ein Urteil gebraucht.
7. **Jede Festlegung.** Die 44 `ENTSCHEIDUNG`-Zeilen der Triage sind keine Prüfungen; kein Werkzeug
   der Welt nimmt sie ab.

---

## 10. Nachweisdateien

Alle Bildschirmfotos liegen in `.planning/ui-reviews/` mit dem Präfix `14-sicht-`. Die Prüfskripte
liefen aus dem Ablagenverzeichnis der Sitzung und sind nicht Teil des Repos; jeder Prüfschritt ist
oben mit Selektor, Aktion und Messung so beschrieben, dass er ohne sie nachstellbar ist.

**Der Server auf Port 3100 und Vite auf Port 1420 laufen weiter.**
