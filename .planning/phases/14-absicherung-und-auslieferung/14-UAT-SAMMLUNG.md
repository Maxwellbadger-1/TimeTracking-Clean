# Milestone v3.0 — Gesammelte menschliche Abnahme (UAT)

**Angelegt:** 2026-08-22
**Grund:** Der Anwender hat verfügt, dass die menschliche Abnahme aller Phasen dieses
Milestones nicht phasenweise, sondern gebündelt am Ende stattfindet. Diese Datei wächst
mit jeder abgeschlossenen Phase und ist die Vorlage für die Abnahmesitzung in Phase 14.

**Status:** in Arbeit — wird nach jeder Phase ergänzt.

---

## Vorbedingungen für die Abnahmesitzung

- Laufender Dev-Server (`cd server && npm run dev`) auf `localhost:3000`
- Desktop-App im Dev-Modus (`cd desktop && npm run dev`), API-URL per `/dev` auf localhost
- Frische Produktionskopie lokal: `npm run sync-dev-db`
- Ein Nutzer mit Modellwechsel und ein Nutzer ohne — beide namentlich vor der Sitzung
  festlegen

---

## Phase 11 — Datumsabhängige Berechnung

Quelle: `.planning/phases/11-datumsabh-ngige-berechnung/11-VERIFICATION.md`,
Abschnitt `human_verification`. Die Phase ist technisch mit 10/10 Muss-Kriterien
verifiziert; die folgenden Punkte sind ausschließlich solche, die ein Mensch beurteilen
muss.

| # | Prüfung | Erwartung | Warum ein Mensch |
|---|---|---|---|
| 11-U1 | DATEV-Export mit einem soft-gelöschten Nutzer im Zeitraum erzeugen und in den DATEV-Importweg geben | Die 14 zusätzlichen Zeilen für Nutzer 15 (soft-gelöscht am 28.02.2026) sind fachlich gewünscht und werden vom Importweg angenommen | GoBD-Entscheidung und Verhalten eines externen Systems |
| 11-U2 | DATEV-Export für einen Zeitraum anstoßen, in dem ein Nutzer keine lückenlose Periodenkette hat | HTTP 409 mit verständlicher Meldung in der Oberfläche, statt stillschweigend unvollständiger Datei | Verständlichkeit der Fehlermeldung am laufenden Server |
| 11-U3 | `GET /api/admin/period-chains` als Admin und als Nicht-Admin aufrufen | Admin bekommt die Befundliste, Nicht-Admin bekommt 403 | Braucht laufenden Server und angemeldete Sitzung |
| 11-U4 | `npm run validate:overtime:detailed -- --userId=<Modellwechsel-Nutzer> --month=…` bei **laufendem** Server | Auch der vierte Vergleichsweg (Frontend-API) meldet PASSED | Dieser Zweig wurde in allen bisherigen Läufen übersprungen und ist bis heute ungeprüft |
| 11-U5 | Überstunden-Live-Anzeige und Kontoauszug im Desktop für einen Nutzer mit Modellwechsel ansehen | Sollstunden entsprechen vor und nach dem Stichtag den serverseitig belegten Werten (8h bzw. 4h) | Visuelle Prüfung; betrifft auch die nach Phase 12 verschobene Desktop-Umstellung |
| 11-U6 | Generalprobe des gesamten Rechenwegs auf einer Kopie der Produktionsdatenbank | Keine Saldoänderung bei Nutzern ohne Modellwechsel, Periodenketten lückenlos | Produktionsdaten sind in Phase 11 per Produktionsschutz ausgeschlossen |

### Fachliche Festlegungen aus dem Code-Review, die eine Bestätigung brauchen

Diese drei Punkte wurden im Zuge der 33 Review-Korrekturen entschieden. Sie sind
umgesetzt und belegt, aber es sind fachliche Festlegungen, keine reinen Fehlerbehebungen —
der Anwender soll sie ausdrücklich bestätigen oder widersprechen.

| # | Festlegung | Alternative, die verworfen wurde |
|---|---|---|
| 11-F1 | Wird das Eintrittsdatum **nach hinten** verlegt, bleibt die bestehende Periodenkette stehen | Den Anfang der Kette abschneiden |
| 11-F2 | Das Migrationsskript `migrateOvertimeToTransactions` **bricht bei einem Datendefekt ab**, statt mit Warnung durchzulaufen | Weiterlaufen und den Defekt nur protokollieren |
| 11-F3 | Der DATEV-Export **bricht mit HTTP 409 ab**, wenn ein Nutzer im Zeitraum keine lückenlose Periodenkette hat | Den Nutzer stillschweigend weglassen (war der Zustand vor der Korrektur) oder einen Warnblock in die CSV schreiben |

### Nachrichtlich: bekannte Warnungen ohne Handlungsbedarf

Aus dem Verifikationsbericht, nicht abnahmepflichtig, aber der Vollständigkeit halber:

- Der Idempotenznachweis (REQ-24) stützt sich auf ein Wegwerf-Skript, das gelöscht wurde.
  Der Verifizierer hat es nachgebaut und das Ergebnis reproduziert — ein dauerhaftes
  Regressionswerkzeug fehlt aber im Repo.
- Das Stichtagsdatum der Testfixture (14.05.2026) ist ein Feiertag; der Stichtag selbst
  wird dadurch nie unvermischt getestet. Phase 14 deckt den Fall „Stichtag mitten im
  Monat" ohnehin gesondert ab.
- Drei tote Helfer in `workingDays.ts` tragen weiterhin die Regel von vor der
  Historisierung. Kein Produktivaufrufer — in der Aufrufer-Checkliste namentlich geführt.

---

## Phase 12 — Stundenwechsel bedienen

Quelle: `.planning/phases/12-stundenwechsel-bedienen/12-09-SUMMARY.md`, Abschnitt
„UAT-Punkte für Phase 14" — dort aus den Plänen 12-01 bis 12-08 gebündelt und durchnummeriert.
Die Phase ist technisch abgeschlossen (9/9 Pläne, `tsc` grün für Server und Desktop,
Server-Testsuite 403/406 mit exakt den drei vorbestehenden Fehlschlägen). Die folgenden
39 Punkte sind ausschließlich solche, die ein Mensch oder eine Produktionskopie braucht.

Format je Punkt: was zu prüfen ist / wo / erwartetes Ergebnis — (Herkunftsplan).

1. Migration 011 auf der Produktionskopie: Zeilenzahl `overtime_transactions` vor/nach identisch, `PRAGMA integrity_check` = `ok`. Lokal bereits verifiziert; Produktionslauf ist Teil von Phase 14 (D8). — (12-01)
2. `GET /api/work-periods` mit echter Mitarbeiter-Session gegen fremde `userId`: HTTP 403, keine Perioden im Antwortkörper. Lokal bereits verifiziert; Produktionsnachweis mit echten Passwörtern ist Sache der Phase-14-Abnahme. — (12-01)
3. Bestehendes Modal (z. B. Zeiteintrag/Benutzer bearbeiten) im hellen und dunklen Modus: Erscheinungsbild, Backdrop-Klick, ESC unverändert zu v1.8.0, kein Flackern durch Portal-Rendering. — (12-02)
4. `ConfirmDialog` öffnen (z. B. „Benutzer löschen"): X-Button hat zugänglichen Namen, ESC schließt (bisher nicht), „Löschen"/„Abbrechen" sonst unverändert. — (12-02)
5. Zwei übereinanderliegende Dialoge (Wechsel-Dialog über `EditUserModal`, `ConfirmDialog` über dem Wechsel-Dialog) mit ESC: nur der oberste schließt, darunterliegende Formulare bleiben mit allen Eingaben offen. Jetzt im realen Einbettungskontext prüfbar (seit 12-07). — (12-02, 12-07)
6. Nach Schließen eines Dialogs per Tab weiterspringen: Fokus steht auf dem auslösenden Element. — (12-02)
7. Screenreader/Accessibility-Panel am X-Button beider Dialogtypen: „Dialog schließen"/„Abbrechen" angesagt, nicht „Schaltfläche". — (12-02)
8. Innerhalb eines offenen Dialogs mehrfach Tab drücken: Fokusfalle springt vom letzten zum ersten Element zurück, nicht aus dem Dialog heraus. — (12-02)
9. Rückwirkender Wechsel auf einer Kopie der Produktionsdatenbank für einen Nutzer mit vielen Zeiteinträgen: Laufzeit von `applyWorkTimeChange()` unter 10 Sekunden, Server bleibt antwortfähig. — (12-03)
10. Abgebrochener Speichervorgang (Server während des Laufs beendet): weder neue Periode noch `model_change`-Buchung darf danach vorhanden sein (Transaktionsklammer). — (12-03)
11. `previewToken` über einen echten Serverneustart hinweg: ein vor dem Neustart ausgestelltes, noch gültiges Token bleibt gültig (Zustandslosigkeit). — (12-03)
12. Rundungsverhalten bei `balanceDelta`/`targetHoursDelta` über mehrere Monate bei sehr langen rückwirkenden Zeiträumen — Abgleich mit `npm run validate:overtime:detailed`. — (12-03)
13. Periodenliste im hellen/dunklen Modus: Kontrast der Badges („Aktuell"/„Geplant") und Tabellentexte mindestens so gut wie im bestehenden Kontoauszug. — (12-04)
14. Fenster unter 640 px: Periodenliste horizontal scrollbar, kein abgeschnittener Inhalt. — (12-04)
15. Nutzer mit mehreren Perioden: jüngste Umstellung oben, heute gültige trägt „Aktuell", künftige „Geplant" — visuell mit echten Mehrperioden-Daten zu bestätigen. — (12-04)
16. Fehler-/Wiederholzustand der Periodenliste bei gestopptem Server: Fehlertext erscheint, „Perioden erneut laden" lädt nach Serverneustart erfolgreich nach. — (12-04)
17. Vollständiger Vorschau→Speichern-Zyklus auf einer Kopie der Produktionsdatenbank für einen realen Nutzer: derselbe im Kontoauszug angezeigte Saldo wie in der Vorschau notiert. — (12-05)
18. Für alle Nutzer OHNE Modellwechsel: `getOvertimeBalance()` vor/nach einem Testlauf identisch — kein Seiteneffekt auf unbeteiligte Nutzer, gegen vollständigen Produktionsbestand zu messen. — (12-05)
19. `checkAllPeriodChains()` gegen die Produktionskopie nach einem realen Wechsel: kein Befund. — (12-05)
20. `PREVIEW_STALE` in der Desktop-Oberfläche: Dialog länger als 15 Minuten offen lassen, dann speichern — verständliche deutsche Fehlermeldung. — (12-05)
21. Visuelle Abnahme des Wechsel-Dialogs im hellen/dunklen Modus: hervorgehobene Saldoänderung (fett, farbig, Trendpfeil) ist das dominante Element, kein Konkurrenzelement. — (12-06)
22. Bedienung ausschließlich mit der Tastatur: Tab-Reihenfolge, Fokus beim Öffnen auf „Stichtag", ESC schließt nur obersten Dialog, Fokusrückgabe nach Schließen auf den Einstiegs-Button. — (12-06)
23. Rückwirkender Wechsel mit Differenz 0: Zeitraumsatz, „± 0:00h"-Anzeige, `ConfirmDialog` mit Nulldifferenz-Textvariante. — (12-06)
24. Fenster auf unter 640 px ziehen: Stichtag/Wochenstunden und Sollstunden-Kennzahlen stehen untereinander, nichts abgeschnitten. — (12-06)
25. Vorschau abrufen, 15 Minuten warten, dann speichern: automatische Neuberechnung beim ersten Fehlschlag, Rückfall in den Fehlerzustand beim zweiten. — (12-06)
26. Nutzer ohne jede vorherige Periode (frisch angelegt): Infopanel zeigt „Aktuell gültig seit {Eintrittsdatum}" als Fallback. — (12-06)
27. Kontrast des schreibgeschützten Wochenstundenfelds im hellen/dunklen Modus: mindestens 4,5:1, klar lesbar (kein `opacity`). — (12-07)
28. Vollständiger Bedienfluss im Desktop: Bearbeiten → „Stundenwechsel ab Datum …" → Dialog über Stammdatendialog → Eingaben → Vorschau → Speichern → Erfolgsbanner (8s)+Toast → Periodenliste und Wochenstundenfeld zeigen sofort den neuen Wert. — (12-07)
29. Kontoauszug desselben Nutzers: Zeile „Modellwechsel" (Teal-Badge) mit Betrag, Vorzeichen, Trendpfeil, Begründung, zweiter Zeile „Periode ab … · eingetragen am … von {Admin}" mit echtem Admin-Namen. — (12-07)
30. Bestehende Bedienwege der Nutzerverwaltung (Anlegen, Löschen, Deaktivieren, Passwort-Reset) verhalten sich unverändert zu v1.8.0. — (12-07)
31. Verschachtelter Dialog bei rückwirkendem Stichtag: `ConfirmDialog` (z-[70]) sichtbar über dem Wechsel-Dialog (z-[60]), der über dem `EditUserModal` (z-50) liegt — erstmals im realen Einbettungskontext sichtbar. — (12-07)
32. Abwesenheitsantrag über einen Stichtag hinweg im Desktop stellen: angezeigte Stundenzahl entspricht der nach Genehmigung tatsächlich gebuchten. — (12-08)
33. Abwesenheitsantrag über einen Feiertag: der Feiertag wird in der Vorschau nicht als Arbeitstag gezählt. — (12-08)
34. Server während des Ausfüllens nicht erreichbar: kein Zahlenanspruch, Hinweistext erscheint, Antrag bleibt absendbar. — (12-08)
35. `WorkScheduleDisplay` bei einem Nutzer mit mehreren Perioden: Zeile „Aktuell gültiges Modell seit …" nennt das `validFrom` der heute gültigen Periode. — (12-08)
36. Kompakter Modus von `WorkScheduleDisplay` (Dashboard-Widget) zeigt bewusst keine Stichtag-Zeile — zu klären, ob Phase 13/14 sie dort ergänzen soll. — (12-08)
37. Der E2E-Test „Change employee to 0 hours" (dieser Plan) ist auf den neuen Wechsel-Dialog umgestellt — vor einem Release in Phase 14 gegen eine funktionierende lokale Umgebung (Backend tatsächlich auf Port 3000, keine kollidierende Fremd-Session) auszuführen, da er in dieser Ausführungsumgebung nur bis zum Login-Fixture lief (siehe „E2E-Ausführung"). — (12-07, 12-09)
38. Die übrigen sieben `button[aria-label="Bearbeiten"]`-Selektoren in `user-edit.spec.ts` (sechs andere Testfälle) sind vorbestehend kaputt und laufen aktuell gegen denselben Fehler wie der hier reparierte — vor einem verlässlichen vollständigen E2E-Lauf in Phase 14 zu beheben (kein Aufräumfeldzug in diesem Plan). — (12-09)
39. Vollständiger Playwright-Lauf der gesamten `user-edit.spec.ts`-Datei gegen eine sauber konfigurierte lokale Umgebung (eigener Port 3000, kein Fremdprozess) — in dieser Ausführungsumgebung nicht möglich gewesen (siehe „E2E-Ausführung"). — (12-09)

### Zusätzlich aus dem Code-Review und seinen Korrekturen (Punkte 40-51)

Nach Abschluss der neun Pläne lief ein zweiteiliger Code-Review (32 Quelldateien). Er fand
**11 Critical und 31 Warning**; alle wurden behoben (Server 15, Desktop 16 atomare Commits),
die 14 Info-Befunde blieben bewusst offen. Die folgenden Punkte stammen aus den beiden
Fix-Berichten `12-REVIEW-FIXES-SERVER.md` und `12-REVIEW-FIXES-DESKTOP.md` und brauchen
einen Menschen oder eine Produktionskopie.

40. **Bestandsdaten vor Migration 012 prüfen.** Der alte `referenceType`-CHECK war durch
    `NULL` in der `IN`-Liste wirkungslos, die Produktion *kann* daher unzulässige Werte
    enthalten. Migration 012 setzt solche auf NULL und protokolliert sie. Vor dem
    Produktionslauf einmal
    `SELECT referenceType, COUNT(*) FROM overtime_transactions GROUP BY referenceType;`
    ausführen — steht dort etwas außerhalb der fünf erlaubten Werte, gehört die Entscheidung
    „auf NULL setzen" ausdrücklich bestätigt. Lokal ist die Menge leer. — (Server CR-05)
41. **Rückwirkungsgrenze „Beginn des Vorjahres" bestätigen.** Der Wert wurde gesetzt, weil das
    Review eine Obergrenze verlangte. Ob die Stiftung nie weiter zurück umstellen muss, ist
    eine fachliche Frage. — (Server WR-03)
42. **Rate-Limit 30/min für `/preview` im Realbetrieb gegenprüfen.** Es zählt pro IP; sitzen
    mehrere Admins hinter derselben Adresse, ist der Wert einmal zu messen. — (Server WR-03)
43. **Einmalverbrauch des `previewToken`.** Die Sitzungsbindung ist umgesetzt; ein echter
    Einmalverbrauch verlangt Serverzustand und widerspricht der entschiedenen
    Zustandslosigkeit. Architekturentscheidung für Phase 13/14. — (Server WR-09)
44. **Zukunftsmonate auf einer Produktionskopie.** Ein rückwirkender Wechsel für einen Nutzer
    mit bereits genehmigtem Urlaub im nächsten Quartal — die Entscheidung „vorhandene
    `overtime_balance`-Zeilen jenseits von heute mitziehen" ist lokal getestet, aber nicht
    gegen echten Bestand. — (Server WR-02)
45. **Begründung wird getrimmt gespeichert.** `12-UI-SPEC.md` Zeile 285 sagt „kein Trimmen";
    der Fixer hat das als Regel für den Anzeigepfad gelesen, nicht für den Schreibweg. Wenn
    das anders gemeint war, ist es eine Zeile. — (Server WR-04)
46. **Fokusverhalten aller 13 `Modal`-Aufrufer.** Der Anfangsfokus liegt jetzt auf dem
    Schließen-Knopf (erstes fokussierbares Element). Für `EditUserModal`, `TimeEntryForm`
    und `AbsenceRequestForm` ist zu entscheiden, ob dort besser das erste Eingabefeld den
    Fokus bekommt — jeder Aufrufer kann das selbst setzen, wie es der Wechsel-Dialog für
    „Stichtag" tut. — (Desktop CR-02)
47. **Kontrast der neuen Elemente messen (≥ 4,5:1, beide Modi):** die zweizeilige
    Stundenspalte der Modellwechsel-Zeile („dokumentierte Differenz" über dem Betrag), die
    neutrale Saldozeile und die Fußnote unter der Tabelle. — (Desktop WR-02)
48. **E2E-Suite `user-edit.spec.ts` einmal wirklich laufen lassen.** Playwright ist in diesem
    Arbeitsbaum nicht installiert; geprüft wurde per Syntaxparse und `grep`. Sieben Tests
    wurden repariert, darunter der auf den Wechsel-Dialog umgeschriebene 0-Stunden-Test.
    (Ersetzt und präzisiert die Punkte 37-39.) — (Desktop WR-12/13/14)
49. **Typ-Spalte des Kontoauszugs für gewöhnliche Tageszeilen ansehen.** Die Typ-Union in
    `useWorkTimeAccounts.ts` deckt `time_entry` und `unpaid_deduction` nicht ab; nach
    Lage des Codes steht dort vermutlich der Rohwert statt einer deutschen Bezeichnung.
    Eigener Befund, in diesem Lauf nicht behoben. — (Desktop, Nebenbefund)
50. **Text bei verweigerter Abwesenheitsvorschau außerhalb des Feiertagsfensters.** Aktuell
    erscheint der Bestandstext für einen Ladefehler. Für „Zeitraum liegt mehr als zwei Jahre
    entfernt" wäre eine eigene Formulierung besser; `12-UI-SPEC.md` kennt dafür keinen
    Baustein. — (Desktop WR-21)
51. **Der Grund bei einer Krankmeldung ist jetzt ausdrücklich optional.** Das folgt Label,
    Codekommentar und Serververhalten. Will die Stiftung fachlich einen Pflichtgrund, ist das
    eine Neufestlegung für Frontend **und** Server. — (Desktop WR-20)

### Nachrichtlich: Umgebungsbefunde ohne Handlungsbedarf in Phase 12

- `vitest` ist im Verzeichnis `desktop/` projektweit nicht lauffähig (fehlendes
  `@babel/runtime`); das betrifft auch den unveränderten Bestandstest `timeUtils.test.ts`.
  Vorbestehend, nicht durch Phase 12 verursacht. Die in dieser Phase angelegten
  Desktop-Tests wurden ersatzweise als `npx tsx`-Skripte mit `node:assert` ausgeführt
  (alle grün). Vor Phase 14 zu reparieren, damit die Desktop-Tests im regulären
  Testlauf mitlaufen.
- Port 3000 war während der gesamten Ausführung durch ein unabhängiges Next.js-Projekt
  belegt; Server-Live-Prüfungen liefen ersatzweise auf Port 3099. Für die Abnahme muss
  Port 3000 frei sein (Punkte 37 und 39).
- `server/database.db` ist in dieser lokalen Arbeitsumgebung eine veraltete, unmigrierte
  Datei ohne `user_work_periods`. Die tatsächlich benutzte lokale Arbeitsdatenbank ist
  `server/database/development.db`. Vor der Abnahme klären, ob die veraltete Datei
  entfernt werden soll, damit kein Skript versehentlich dagegen läuft.

---

## Phase 13 — Korrigieren und rückgängig machen

Quelle: die zehn SUMMARY-Dateien `13-01-SUMMARY.md` bis `13-10-SUMMARY.md` sowie der
Gate-/Entscheidungsabgleich aus `13-11-SUMMARY.md`. Die Phase ist technisch verifiziert
(`tsc` grün für Server und Desktop, Server-Testsuite 478/481 mit exakt den drei
vorbestehenden Fehlschlägen, alle vier `npx tsx`-Prüfskripte des Desktops grün, der
nicht verhandelbare Doppelzählungs-Nachweis besteht). Die folgenden Punkte sind
ausschließlich solche, die ein Mensch, ein laufender Server oder eine Produktionskopie
braucht.

| # | Prüfung | Erwartung | Warum ein Mensch |
|---|---|---|---|
| 13-U1 | Korrektur-Dialog (`WorkTimePeriodEditModal`) am laufenden Dev-Server öffnen, für eine Periode, die die Vergangenheit berührt | Amberfarbenes Warnbanner mit konkretem Zeitraum, Ausweg-Satz 3 ("Für zukünftige Änderungen nutzen Sie stattdessen …") sichtbar, die hervorgehobene Saldoänderung im Vorschaupanel ist der einzige Blickfang | Laufender Server plus angemeldete Admin-Sitzung, visuelle Beurteilung von Farbe/Hierarchie |
| 13-U2 | Korrektur an einer Periode, die vollständig in der Zukunft liegt | Blaues Panel „Keine Rückwirkung" statt des amberfarbenen Warnbanners, **kein** Bestätigungsschritt beim Speichern | Visuelle Beurteilung der Panel-Variante, echte zukünftige Testperiode nötig |
| 13-U3 | Löschbestätigung öffnen: die drei `details`-Punkte prüfen (Lückenschluss, Storno-Betrag, Saldoänderung) und die Pflichtbegründung (≥10 Zeichen, im `details`-Panel ergänzt, 13-09 Rule 2) | Punkte erscheinen in der Reihenfolge Lückenschluss/Storno/Saldoänderung; der Bestätigungsknopf bleibt gesperrt, solange die Vorschau lädt UND solange die Begründung kürzer als 10 Zeichen ist | Laufender Server, visuelle und Bedien-Prüfung des Sperrzustands |
| 13-U4 | Löschvorschau scheitern lassen (Server während der Vorschau anhalten) | Punkt 3 (Saldoänderung) wird zum Fehlertext, der Bestätigungsknopf bleibt gesperrt, es wird nichts gelöscht | Erfordert gezieltes Abschalten des Servers während einer laufenden Anfrage |
| 13-U5 | Kontoauszug nach einem echten Löschvorgang ansehen | Zwei Zeilen (Original + Storno), beide teal, je ein graues Zustands-Badge (`storniert`/`Storno`), gemeinsame Belegnummer (Id der Ursprungsbuchung); Klick auf den Beleg-Chip springt zur Partnerzeile und hebt sie 2s hervor | Visuelle Prüfung, echter Löschvorgang gegen laufenden Server nötig |
| 13-U6 | Beleg-Chip im Fehlfall: Zeitraum so wählen, dass die Partnerzeile jenseits der Abschneidegrenze der Liste liegt, dann auf den Chip klicken | Ein Erklärtext (`toast.info`, einer von drei Textbuch-Sätzen je nach Fall: Liste voll / anderer Monat / anderes Jahr) erscheint statt eines stillen Klicks ins Leere | Visuelle Prüfung eines gezielt konstruierten Randfalls |
| 13-U7 | Mitarbeiter-Sitzung auf einen fremden Nutzer (Periodenliste in `EditUserModal`) | Das graue Panel „Kein Zugriff auf die Arbeitszeit-Perioden" mit Schloss-Symbol erscheint, **kein** roter Fehler-Toast daneben | Braucht laufenden Server und eine echte Mitarbeiter-Sitzung (kein Admin) |
| 13-U8 | Tastaturbedienung des Hinweis-Chips „Nicht löschbar" auf der ersten Periode eines Nutzers | Mit Tab erreichbar (`tabIndex={0}`), Einblendung des Tooltips bei Fokus (`group-focus-within`), mit ESC ausblendbar, ohne dass das umgebende `EditUserModal` schließt | Bedienung ausschließlich mit der Tastatur, keine automatisierte Prüfung dafür in diesem Plan |
| 13-U9 | Dunkelmodus aller neuen Flächen: Korrekturblock unter der Periodenliste, Panel „Kein Zugriff", `details`-Panel der Löschbestätigung (inkl. Begründungsfeld), Zustands-Badges im Kontoauszug | Kontrast und Lesbarkeit mindestens so gut wie die bestehenden Flächen aus Phase 12, keine `opacity`-Krücken | Visuelle Beurteilung, pro Fläche im hellen und dunklen Modus |
| 13-U10 | Fenster unter 640 px ziehen: Periodenzeilen-Aktionen, Korrekturblock-Knopf | Zeilenaktionen erscheinen nur als Symbole (kein Text), Trefferfläche mindestens 32 × 32 px (`p-2`), der Korrekturblock-Knopf läuft über die volle Breite | Visuelle Prüfung bei einer konkreten Fensterbreite |
| 13-U11 | Generalprobe auf einer Kopie der Produktionsdatenbank: eine echte Umstellung eintragen, danach löschen, Salden aller Nutzer vor und nach dem Vorgang vergleichen | Kein Nutzer außer dem betroffenen zeigt eine Saldoänderung; der betroffene Nutzer landet exakt auf dem Stand vor der Umstellung (derselbe Nachweis wie der lokale „Zusicherung A/B/C/D"-Test, jetzt gegen echte Daten) | Produktionsdaten sind lokal ausgeschlossen (Produktionsschutz), Phase 13 hat nur mit `development.db` gearbeitet |
| 13-U12 | Anmeldung und Laden der Perioden-/Kontoauszugsliste gegen einen echten, nicht portkollidierten Dev-Server nach der `api/client.ts`-Bereinigung (Plan 13-10: 42 `console.log` entfernt, Green-Server-Probe entfernt) | Login funktioniert, Perioden- und Kontoauszugsliste laden unverändert wie vor der Bereinigung, keine Konsolen-Fehlermeldung ersetzt den entfernten Code stillschweigend | In dieser Ausführungsumgebung nicht möglich — Port 3000 war durchgehend durch ein fremdes Next.js-Projekt belegt, ein manueller Login-Test konnte nicht durchgeführt werden (13-10-SUMMARY.md, „Issues Encountered") |
| 13-U13 | `aria-label` des Löschbestätigungsknopfs (`confirmAriaLabel`, 13-09) mit einem Screenreader abhören | Der angesagte Name nennt die Periode konkret („Periode vom {Datum} löschen und stornieren"), nicht nur „Bestätigen" | Screenreader-Prüfung ist keine automatisierte Prüfung dieses Plans |

### Fachliche Festlegungen, die eine Bestätigung brauchen

| # | Festlegung | Alternative, die verworfen wurde |
|---|---|---|
| 13-F1 | Die erste Periode eines Nutzers lässt sich korrigieren, aber nicht löschen | Auch die erste Periode löschbar machen (hätte keine Vorperiode zum Lückenschluss) |
| 13-F2 | Eine gelöschte Periode lässt sich nicht wiederherstellen; der Weg führt über eine neue Eintragung | Ein „Undo des Undo"-Mechanismus |
| 13-F3 | Die Belegnummer beider Zeilen eines Storno-Paares ist die Id der **Ursprungsbuchung**, nicht die der Periode — bei mehreren Paaren an derselben Periode bleiben die Nummern dadurch unterscheidbar | Die Periode selbst als Belegnummer verwenden |
| 13-F4 | Punkt 2 der Löschbestätigung wechselt in die Mehrzahlform, wenn eine Periode mehr als eine Buchung trägt (Abweichung vom Textbuch, das nur den Einzahlfall kennt) | Immer die Einzahlform zeigen, auch bei mehreren Buchungen |
| 13-F5 | Der Kettenriegel der Datenbank wird beim Verschieben von „Gültig ab" innerhalb der Transaktion kurzzeitig ausgesetzt und danach über `checkPeriodChain()` geprüft | Den Riegel während der gesamten Korrektur aktiv lassen (hätte den Zwischenzustand blockiert) |
| 13-F6 | `deletedBy` wird zusätzlich zu `deletedAt` gespeichert | Nur `deletedAt` ohne Angabe, wer gelöscht hat |
| 13-F7 | Die Warnfarbe des Bestätigungsdialogs wurde von Gelb auf Amber angeglichen | Gelb beibehalten |
| 13-F8 | Eine Pflichtbegründung (≥10 Zeichen) wurde der Löschbestätigung als Textfeld hinzugefügt, obwohl `13-UI-SPEC.md` dafür keinen Eingabeschritt vorsah — der Server verlangt sie zwingend im Speicherpfad, ohne das Feld wäre jeder echte Löschversuch am Server gescheitert (13-09, Rule 2) | Kein Eingabefeld, Löschung serverseitig immer mit 400 ablehnen lassen |
| 13-F9 | `checkPeriodChain()` läuft nach jedem Schreiben in Korrektur und Löschung unbedingt, nicht nur im Zweig mit ausgesetztem Kettenriegel — ein zusätzliches Sicherheitsnetz gegen bereits bestehende Kettenschäden im Bestand (13-03) | `checkPeriodChain()` nur dort aufrufen, wo der Riegel tatsächlich ausgesetzt wurde |
| 13-F10 | `reversedAt` (Zeitstempel der Gegenbuchung) wird über `formatCreatedAtDe()` formatiert statt über das im Plantext genannte `T12:00:00`-Datumsmuster — `reversedAt` ist ein UTC-Zeitstempel, kein reines Datumsfeld; das Datumsmuster hätte den bereits einmal behobenen Timezone-Bug reproduziert (13-10, Rule 1) | Dem Plantext wörtlich folgen und beide Zeitangaben über dasselbe Muster formatieren |

### Nachrichtlich: Umgebungsbefunde ohne Handlungsbedarf in Phase 13

- `vitest` ist im Verzeichnis `desktop/` weiterhin nicht lauffähig (fehlendes
  `@babel/runtime`, vorbestehend seit Phase 12). Die in dieser Phase angelegten
  Desktop-Prüfungen (`confirmDialogProps.check.ts`, `workTimePeriodEditRules.check.ts`,
  `workTimePeriodDeleteRules.check.ts`, `overtimeTransactionFormat.check.ts`) laufen
  ersatzweise als `npx tsx`-Skripte mit `node:assert` (alle 50 Einzeltests grün). Vor
  Phase 14 zu reparieren, damit sie im regulären Testlauf mitlaufen.
- Die tatsächlich benutzte lokale Arbeitsdatenbank ist `server/database/development.db`;
  `server/database.db` ist eine veraltete, unmigrierte Altdatei ohne `user_work_periods`
  (unverändert seit Phase 11/12).
- Port 3000 war während der gesamten Ausführung von Phase 13 durch ein fremdes
  Next.js-Projekt belegt (dieselbe Einschränkung wie in Phase 12, `12-09-SUMMARY.md`).
  Anders als in Phase 12 wurde in Phase 13 kein Ersatzport (z. B. 3099) genutzt — jeder
  Versuch einer echten Anmeldung/Live-Prüfung blieb ganz aus (siehe 13-U1 bis 13-U13
  oben, `13-10-SUMMARY.md`, „Issues Encountered"). Für die Abnahme muss Port 3000 frei
  sein.
- Plan 13-03 fand einen veralteten `INSERT_GUARD_TRIGGER_SQL`-Textbaustein in zwei
  bestehenden Testdateien (`workPeriodService.test.ts`, `workPeriodChangeService.test.ts`),
  der bei jedem Testlauf den durch Migration 013 korrekt migrierten Trigger auf der
  geteilten `development.db` durch eine veraltete Fassung überschrieb. Der Trigger wurde
  repariert und die Testkonstanten korrigiert (Commit `f403ae2`). Der reparierte Trigger
  sollte bei jedem künftigen `npm run sync-dev-db` erneut aus der Produktionsdatenbank
  überschrieben werden — dort lief Migration 013 laut `13-01-SUMMARY.md` ebenfalls bereits,
  kein bekannter Blocker, aber ein Punkt für die nächste Verifikation gegen eine frisch
  synchronisierte `development.db`.

---

## Phase 14 — Absicherung und Auslieferung

_Eigene Punkte der Phase, insbesondere der reale Umstellungsfall (D6) und die Freigabe
des Produktionslaufs (D2)._
