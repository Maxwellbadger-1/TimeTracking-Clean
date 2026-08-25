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

### Nachtrag: Punkte aus dem Code-Review von Phase 13 und seinen 15 Korrekturen

Das Code-Review (`13-REVIEW.md`) lief nach Plan 13-11 und fand 2 kritische und 13
Warnungs-Befunde; alle 15 wurden in eigenen `fix(13-review)`-Commits behoben. Die
Zahlenangaben im Abschnitt oben („Server-Testsuite 478/481") stammen von vor diesen
Korrekturen; der Stand nach den Korrekturen ist **486 grün / 3 rot** bei unveränderter
roter Menge, `tsc` weiterhin Exit 0 für Server und Desktop. Die folgenden Punkte kommen
durch die Korrekturen neu hinzu.

| # | Prüfung | Erwartung | Warum ein Mensch |
|---|---|---|---|
| 13-U14 | Migration 015 (eindeutiger Index auf `reversalOf`) beim nächsten Serverstart anwenden lassen und danach `PRAGMA integrity_check` sowie `foreign_key_check` laufen lassen | Migration läuft ohne Fehler durch, Index ist eindeutig, keine Datensatzverluste; auf einer Kopie der Produktionsdatenbank zuerst | Migration 015 wurde bewusst **nicht** auf `development.db` angewendet — `runMigrations()` holt das beim nächsten Serverstart nach. Gegen Produktionsdaten ist das ein Mensch-Schritt. |
| 13-U15 | Den ehemals tödlichen Ablauf von Hand nachstellen: Stundenwechsel 40→32 eintragen, per Korrektur auf 40 zurück (ohne `validFrom` zu verschieben), danach die Periode löschen | Das Löschen gelingt. Vor dem Fix `03ac2af` endete genau diese Folge deterministisch in einem 500er und die Periode war dauerhaft unlöschbar. | Regressionstests decken es ab, aber der Ablauf ist der wahrscheinlichste echte Bedienweg und verdient eine Bestätigung an der echten Oberfläche. |
| 13-U16 | Eine Korrektur ohne Saldowirkung speichern (z. B. Tagesplan umverteilen bei gleicher Wochensumme) und danach den Kontoauszug ansehen | Es erscheint eine Journalzeile mit Begründung, obwohl sich der Saldo nicht ändert. Vor dem Fix `049c1b3` versprach der Dialog dauerhafte Sichtbarkeit, schrieb aber nichts. | Prüft ein Versprechen der Oberfläche gegen das, was der Kontoauszug wirklich zeigt. |
| 13-U17 | Die Drosselung der drei Vorschau-Routen unter realer Bedienung prüfen: im Korrektur-Dialog zügig mehrere Felder des 7-Feld-Tagesplans ändern | Kein `429` bei normalem Bedientempo. Die Eimer sind seit `74a8be6` je Route und je Nutzer statt einem gemeinsamen IP-Eimer; auch die Speicherpfade sind jetzt gedrosselt. | Ob die gewählten Grenzen für echtes Tipptempo passen, lässt sich nur bedienend beurteilen. |
| 13-U18 | Fehlerfall `PREVIEW_STALE` in der Löschbestätigung auslösen (Vorschau veralten lassen, dann bestätigen) | Ein lesbarer deutscher Satz erscheint, nicht der interne Code `PREVIEW_STALE` (Fix `8f12eb4`). | Sichtprüfung des Fehlertexts an der Oberfläche. |
| 13-U19 | Ein Storno-Paar mit einem Datum in der Zukunft anlegen und den Kontoauszug ansehen | Beide Zeilen sind sichtbar. Vor dem Fix `d3015e1` fiel ein zukunftsdatiertes Paar aus der Liste. | Erfordert eine gezielt konstruierte Zukunftsperiode am laufenden Server. |

### Offener Restposten aus dem Code-Review (WR-07)

`PUT /api/users/:id` spiegelt `weeklyHours` weiterhin ohne Token, ohne Pflichtbegründung,
ohne Rebuild und ohne Journalzeile in die offene Periode. Behoben wurde in `b23d41d` nur
der sachlich falsche Kommentar in `userService.ts` sowie der handfeste Teil: die
`overtime_balance`-Zeilen blieben nach der Spiegelung auf den alten Sollstunden stehen und
werden jetzt in derselben Transaktion verworfen und beim nächsten Lesen neu berechnet.
Der verbleibende Umbau berührt `updateUser()` und die Testdatei einer anderen Phase
(`userWorkPeriodProvisioning.test.ts`, 17 Tests) und ist als „Offene Restposten" in
`PROJECT_STATUS.md` festgehalten. **Für die Abnahme:** entscheiden, ob dieser zweite
Schreibweg vor der Auslieferung geschlossen werden muss oder ob er als bekannter
Restposten mitgeht.

---

## Phase 14 — Absicherung und Auslieferung

Eigene Punkte der Phase. Die ersten vier sind laut Planauftrag von Plan 14-03 vorgegeben; die
Punkte 14-U5 bis 14-U9 kommen aus dem Ausführungsauftrag hinzu — nach Erstellung von
14-UAT-SAMMLUNG.md sind weitere anwendersichtbare bzw. betrieblich relevante Änderungen
gelandet (fünf UI-Korrekturen Phase 13, sechs UI-Korrekturen Phase 12, der B-2-Sicherheitsfix,
der REQ-32-Nachweis und die konkrete WR-07-Oberflächenwirkung), die sonst aus der Sitzung
fielen.

- `14-U1` — Der reale Umstellungsfall (D6): die vier Werte (Nutzer-ID und Name, Stichtag, alte
  Wochenstunden, neue Wochenstunden) werden vom Anwender genannt und nach dem Lauf gegen die
  Erwartung geprüft. Prüfweg B.
- `14-U2` — Freigabe des Produktionslaufs (D2): Backup vorhanden und rückspielbar, Deployment
  verifiziert, Trockenlauf gesichtet, dann erst `--apply`. Prüfweg B.
- `14-U3` — Nach dem Release: `latest.json` enthält alle vier Plattformschlüssel mit Signatur,
  eine installierte Alt-Version zieht das Update. Prüfweg C.
- `14-U4` — WR-07: entschieden durch Plan 14-02, nur zur Kenntnis. Prüfweg D.
- `14-U5` — Fünf UI-Korrekturen aus Phase 13 (`13-UI-REVIEW-FIX.md`, M-1 bis M-5, alle fünf
  behoben): rückwirkend-ja/nein kommt vom Server (M-1, Blocker), Tooltip „Nicht löschbar" durch
  `title`+`aria-label` ersetzt (M-2), Pflichtbegründung meldet sich im Absendepfad statt stumm
  zu sperren (M-3), Korrekturblock bleibt bei Ladefehler sichtbar und gesperrt (M-4), der Anker
  von Löschbestätigungspunkt 3 ist wieder eine Zahl statt eines Absatzes (M-5). Anwendersichtbar
  am Korrektur- und Löschdialog. Prüfweg A.
- `14-U6` — Sechs UI-Korrekturen aus Phase 12 (`12-UI-REVIEW-FIX.md`, alle sechs behoben):
  `ConfirmDialog` scrollt bei niedrigem Fenster statt Knöpfe zu verlieren (E-1, Blocker),
  Vorschaupanel zeigt keinen falschen Platzhaltersatz mehr während des Ladens (E-3),
  Zeilenmarkierung (Zustand 10) jetzt als Zellfläche statt unsichtbarem `box-shadow` (V-2),
  Toggle „Individueller Wochenplan" und Dialog-Hilfstexte barrierefrei angebunden (V-4/E-5/T-3),
  Akzentfarbe auf die vier vertraglich reservierten Stellen zurückgenommen (F-1), Vertragstext
  zur Journalzeile `model_change` nachgezogen (C-4, keine Codeänderung). Anwendersichtbar am
  Wechsel-Dialog und der Periodenliste. Prüfweg A.
- `14-U7` — B-2-Sicherheitsfix (`13-SECURITY-FIX.md`, bereits committet `2c1c2ce`):
  `withSuspendedChainGuard()` verweigert die Aussetzung des Kettenriegels jetzt außerhalb einer
  aktiven `db.transaction()`-Klammer und setzt einen aus einem früheren Lauf hängengebliebenen
  Riegel beim Serverstart zurück (mit Logzeile). Nicht anwendersichtbar, rein serverseitig und
  bereits durch 5 neue automatisierte Tests belegt (491 grün / 3 rot, die drei vorbestehend).
  Prüfweg D — zur Kenntnis, kein manueller Retest nötig.
- `14-U8` — REQ-32-Nachweis (`14-REQ32-NACHWEIS.md`, Plan 14-01): die fünf laut REQUIREMENTS.md
  geforderten Wechselfälle (Reduzierung mit künftigem Stichtag, Erhöhung mit rückwirkendem
  Stichtag, Stichtag mitten im Monat, Wechsel über einen Jahreswechsel, Periode löschen und neu
  rechnen) sind einzeln benannt und einzeln per `npx vitest run -t "<Titel>"` maschinell
  nachgewiesen. Sie brauchen deshalb **keinen** manuellen Retest in der Abnahmesitzung — die
  Nachweisdatei dokumentiert Fundstelle und wörtliche Testausgabe je Fall. Prüfweg D — zur
  Kenntnis.
- `14-U9` — WR-07-Verhalten in der Oberfläche (Plan 14-02, `PUT /api/users/:id` weist eine
  tatsächliche `weeklyHours`/`workSchedule`-Änderung jetzt mit HTTP 400 ab): am laufenden
  Dev-Server prüfen, dass ein Admin im `EditUserModal` unveränderte Stammdaten weiterhin
  speichern kann (kein 400 bei bloßer Feldanwesenheit ohne Wertänderung) und dass eine
  tatsächliche Wochenstunden-/Wochenplan-Änderung über dieses Formular abgewiesen wird und der
  Admin stattdessen zum Stundenwechsel-Dialog („Stundenwechsel ab Datum …") geleitet werden
  muss, um die Änderung mit Vorschau, Pflichtbegründung und Journalzeile einzutragen. Prüfweg A.

Diese neun Punkte (`14-U1` bis `14-U9`) zählen **nicht** in die Kontrollsumme 86 der
Bestandspunkte aus den Phasen 11 bis 13 — sie kommen ausdrücklich hinzu.

---

## Prüfweg-Zuordnung aller 86 Punkte (Plan 14-03)

Diese Tabelle ordnet jeden der 86 Bestandspunkte aus den Phasen 11, 12 und 13 (siehe
Kontrollsumme oben, `6 + 51 + 29 = 86`) genau einem von vier Prüfwegen zu und belegt jeden der
acht vorgeprüften Dublettenkandidaten am Wortlaut. Kein bestehender Abschnitt oberhalb dieser
Zeile wurde verändert — dies ist ein reiner Anhang.

**Vier Prüfwege:**
- **A** — am laufenden Dev-Server prüfbar (`cd server && npm run dev` auf Port 3000, Desktop im
  Dev-Modus, angemeldete Sitzung, keine echten Produktionsdaten nötig).
- **B** — braucht eine Produktionskopie (echter Datenbestand: Salden aller Nutzer, Laufzeiten
  bei vielen Zeiteinträgen, Bestandsdaten vor einer Migration, `checkAllPeriodChains()` gegen
  echte Daten).
- **C** — erst nach dem Release prüfbar (ausgelieferte Desktop-App und/oder deployter Server:
  Auto-Update, `latest.json`, Verhalten bei Anwendern).
- **D** — Festlegung bestätigen oder widersprechen (Zustimmungsfrage, kein Prüfweg — läuft als
  Durchsprache ohne Server/Daten).

### Phase 11 — Datumsabhängige Berechnung (6 Punkte)

| Punkt | Kurztitel | Prüfweg | Dublette von | Begründung |
|---|---|---|---|---|
| 11-U1 | DATEV-Export mit soft-gelöschtem Nutzer | A | — | Laufender Dev-Server + Admin-Sitzung genügt, keine echten Produktionsdaten nötig |
| 11-U2 | DATEV-Export bei lückenhafter Periodenkette (409) | A | — | HTTP-Verhalten am laufenden Server, kein Produktionsbestand nötig |
| 11-U3 | `GET /api/admin/period-chains` Admin/Nicht-Admin | A | — | Rollenprüfung am laufenden Server mit Testnutzern |
| 11-U4 | `validate:overtime:detailed` vierter Vergleichsweg | A | — | Läuft gegen laufenden Dev-Server, kein Produktionsbestand vorausgesetzt |
| 11-U5 | Live-Anzeige/Kontoauszug Desktop bei Modellwechsel | A | — | Desktop im Dev-Modus, Testnutzer mit Modellwechsel genügt |
| 11-U6 | Generalprobe Rechenweg auf Produktionskopie | B | 13-U11 | Dublettenkandidat 1 bestätigt — 13-U11 ist der vollständigere Nachweis (Umstellung UND Löschen, alle Salden) |

**Fachliche Festlegungen 11-F1 bis 11-F3** (laut `<bestand>` nicht Teil der Kontrollsumme 6 — die
Sammlung selbst zählt für Phase 11 nur die U-Tabelle; hier trotzdem Prüfweg zugeordnet, da die
Planvorgabe „Führe sie in einer eigenen vierten Gruppe D" allgemein für Festlegungen gilt):

| Punkt | Kurztitel | Prüfweg | Dublette von | Begründung |
|---|---|---|---|---|
| 11-F1 | Eintrittsdatum nach hinten: Kette bleibt stehen | D | — | Zustimmungsfrage zu einer bereits umgesetzten Festlegung |
| 11-F2 | Migrationsskript bricht bei Datendefekt ab | D | — | Zustimmungsfrage zu einer bereits umgesetzten Festlegung |
| 11-F3 | DATEV-Export bricht mit 409 ab statt Nutzer wegzulassen | D | — | Zustimmungsfrage zu einer bereits umgesetzten Festlegung |

### Phase 12 — Stundenwechsel bedienen (51 Punkte)

| Punkt | Kurztitel | Prüfweg | Dublette von | Begründung |
|---|---|---|---|---|
| 1 | Migration 011 auf Produktionskopie | B | — | Explizite Produktionskopie, Zeilenzahl-/Integritätsvergleich |
| 2 | `GET /api/work-periods` fremde `userId` → 403 | B | — | Text fordert ausdrücklich Produktionsnachweis mit echten Passwörtern |
| 3 | Bestehendes Modal hell/dunkel unverändert | A | — | Regressionscheck bestehender Komponente, Dev-Server genügt |
| 4 | `ConfirmDialog` X-Button/ESC | A | — | UI-Verhalten am Dev-Server |
| 5 | Verschachtelte Dialoge ESC/Formularerhalt | A | (Leitpunkt) | Dublettenkandidat 3 bestätigt — Leitpunkt, deckt ESC-Verhalten und Formularerhalt ab |
| 6 | Fokus nach Dialogschluss auf Auslöser | A | 22 | Im Tastaturdurchgang von Punkt 22 mitgeprüft (gleicher Testablauf) |
| 7 | Screenreader-Name X-Button | A | — | Accessibility-Panel am Dev-Server |
| 8 | Fokusfalle Tab-Zyklus im Dialog | A | 22 | Im Tastaturdurchgang von Punkt 22 mitgeprüft (gleicher Testablauf) |
| 9 | Rückwirkender Wechsel auf Kopie, Laufzeit <10s | B | — | Explizit „Kopie der Produktionsdatenbank", Performance bei echtem Datenvolumen |
| 10 | Abgebrochener Speichervorgang | A | — | Serverabbruch mitten im Lauf, Dev-Server genügt |
| 11 | `previewToken` über Serverneustart | A | — | Zustandslosigkeit, Dev-Server genügt |
| 12 | Rundung `balanceDelta`/`targetHoursDelta` lange Zeiträume | A | — | Abgleich mit `validate:overtime:detailed` am Dev-Server, keine Produktionsdaten zwingend nötig |
| 13 | Kontrast Periodenliste hell/dunkel | A | 13-U9 | Dublettenkandidat 4 (Teilmenge) — im einen Kontrastdurchgang über alle neuen Flächen mitgeprüft |
| 14 | Fenster <640px Periodenliste scrollbar | A | — | Responsive-Check, Dev-Server |
| 15 | Mehrperioden-Reihenfolge/Badges | A | — | Visuelle Prüfung mit Testdaten am Dev-Server |
| 16 | Fehler-/Wiederholzustand Periodenliste | A | — | Serverstopp/-neustart am Dev-Server |
| 17 | Vollständiger Vorschau→Speichern-Zyklus, realer Nutzer | B | — | Vergleich mit echtem Kontoauszugssaldo, Produktionskopie |
| 18 | Saldo unbeteiligter Nutzer vor/nach Testlauf | B | 13-U11 | Dublettenkandidat 1 (Teilmenge) — Teil der Generalprobe, deckt „kein Nutzer außer dem betroffenen" ab |
| 19 | `checkAllPeriodChains()` gegen Produktionskopie | B | — | Explizit Produktionskopie nach realem Wechsel |
| 20 | `PREVIEW_STALE` im Wechsel-Dialog | A | 13-U18 | Dublettenkandidat 7 bestätigt — gleiches Textmuster, im gemeinsamen `PREVIEW_STALE`-Durchgang mitgeprüft |
| 21 | Visuelle Abnahme Wechsel-Dialog hell/dunkel | A | 13-U9 | Dublettenkandidat 4 (Teilmenge) — im einen Kontrastdurchgang mitgeprüft |
| 22 | Tastaturbedienung vollständig | A | (Leitpunkt) | Dublettenkandidat 8 (Teilmenge) bestätigt — Leitpunkt, subsumiert Punkt 6 und 8 |
| 23 | Differenz 0: Textvariante „± 0:00h" | A | — | UI-Text, Dev-Server |
| 24 | Fenster <640px Stichtag/Sollstunden-Layout | A | — | Dublettenkandidat 4 geprüft und **verworfen für diesen Punkt** — Punkt 24 beschreibt Responsive-Layout, nicht Kontrast/Dunkelmodus; geprüft, keine Dublette — anderer Prüfinhalt (Fensterbreite statt Farbkontrast) |
| 25 | Vorschau 15min warten, Neuberechnung | A | — | Zeitgesteuerter Zustand, Dev-Server |
| 26 | Fallback „Aktuell gültig seit Eintrittsdatum" | A | — | Neuer Nutzer ohne Periode, Dev-Server |
| 27 | Kontrast Wochenstundenfeld ≥4,5:1 | A | 13-U9 | Dublettenkandidat 4 (Teilmenge) — im einen Kontrastdurchgang mitgeprüft |
| 28 | Vollständiger Bedienfluss Desktop | A | — | Kompletter Klickpfad, Dev-Server |
| 29 | Kontoauszug Modellwechsel-Zeile | A | — | Anzeige nach echtem Wechsel am Dev-Server |
| 30 | Bestehende Nutzerverwaltungswege unverändert | A | — | Regressionscheck, Dev-Server |
| 31 | z-Index Wechsel-/Bestätigungsdialog | A | 5 | Dublettenkandidat 3 (Teilmenge) — reale Einbettung bereits in Punkt 5 mitgeprüft |
| 32 | Abwesenheitsantrag über Stichtag | A | — | Dev-Server, Vorschauwert vs. gebuchter Wert |
| 33 | Abwesenheitsantrag über Feiertag | A | — | Dev-Server |
| 34 | Server nicht erreichbar beim Ausfüllen | A | — | Fehlerzustand am Dev-Server |
| 35 | `WorkScheduleDisplay` „gültig seit" | A | — | Anzeigeprüfung, Dev-Server |
| 36 | Kompakter Modus zeigt keine Stichtag-Zeile | D | — | Ausdrücklich „zu klären, ob Phase 13/14 sie dort ergänzen soll" — Festlegungsfrage, kein Verhaltenstest |
| 37 | E2E-Test 0-Stunden-Fall | A | 48 | Dublettenkandidat 2 bestätigt — von Punkt 48 „ersetzt und präzisiert" |
| 38 | Übrige sieben kaputte Selektoren | A | 48 | Dublettenkandidat 2 (erweitert) — laut Punkt 48 bereits repariert („sieben Tests wurden repariert, darunter der 0-Stunden-Test") |
| 39 | Vollständiger Playwright-Lauf `user-edit.spec.ts` | A | 48 | Dublettenkandidat 2 bestätigt — von Punkt 48 „ersetzt und präzisiert" |
| 40 | Bestandsdaten `referenceType` vor Migration 012 | B | — | `SELECT ... GROUP BY referenceType` gegen echten Datenbestand |
| 41 | Rückwirkungsgrenze „Beginn des Vorjahres" bestätigen | D | — | Fachliche Frage, keine Prüfhandlung |
| 42 | Rate-Limit 30/min real gegenprüfen | A | 13-U17 | Dublettenkandidat 6 bestätigt — der beschriebene IP-Eimer ist seit Commit `74a8be6` überholt (jetzt Route+Nutzer-Eimer, siehe 13-U17), gleicher Prüfweg |
| 43 | Einmalverbrauch `previewToken` | D | — | Architekturentscheidung, kein Test |
| 44 | Zukunftsmonate auf Produktionskopie | B | — | Explizit Produktionskopie |
| 45 | Begründung getrimmt gespeichert — Zeilenklärung | D | — | Klärungsfrage „wenn das anders gemeint war, ist es eine Zeile" — Entscheidung |
| 46 | Fokus 13 Modal-Aufrufer — Entscheidung | D | — | Dublettenkandidat 8 geprüft und **verworfen für diesen Punkt** — Punkt 46 sagt ausdrücklich „ist zu entscheiden", ist keine Verhaltensprüfung wie 6/8/22, sondern eine offene Gestaltungsfrage |
| 47 | Kontrast neuer Elemente Kontoauszug ≥4,5:1 | A | 13-U9 | Dublettenkandidat 4 (Teilmenge) — im einen Kontrastdurchgang mitgeprüft |
| 48 | E2E-Suite `user-edit.spec.ts` einmal laufen lassen | A | (Leitpunkt) | Dublettenkandidat 2 bestätigt — Leitpunkt, ersetzt/präzisiert 37 und 39, subsumiert 38 |
| 49 | Typ-Spalte gewöhnliche Tageszeilen | A | — | Visuelle Sichtprüfung, Dev-Server |
| 50 | Text bei verweigerter Vorschau — Klärungsfrage | D | — | „wäre eine eigene Formulierung besser" — Entscheidung, `12-UI-SPEC.md` kennt keinen Baustein |
| 51 | Pflichtgrund bei Krankmeldung | D | — | Ausdrücklich „eine Neufestlegung für Frontend und Server" |

### Phase 13 — Korrigieren und rückgängig machen (29 Punkte)

| Punkt | Kurztitel | Prüfweg | Dublette von | Begründung |
|---|---|---|---|---|
| 13-U1 | Warnbanner bei rückwirkender Periode | A | — | Visuelle/Bedienprüfung am Dev-Server |
| 13-U2 | Panel „Keine Rückwirkung" bei künftiger Periode | A | — | Visuelle Prüfung, keine Produktionsdaten nötig |
| 13-U3 | Löschbestätigung: Pflichtbegründung/Sperrzustand | A | — | Bedienprüfung am Dev-Server |
| 13-U4 | Löschvorschau scheitert (Server gestoppt) | A | — | Gezieltes Abschalten am Dev-Server |
| 13-U5 | Kontoauszug nach echtem Löschvorgang | A | — | Zwei-Zeilen-Darstellung am Dev-Server |
| 13-U6 | Beleg-Chip Fehlfall (Partnerzeile außerhalb Liste) | A | — | Konstruierter Randfall am Dev-Server |
| 13-U7 | Mitarbeitersitzung auf fremden Nutzer | A | — | Echte Mitarbeiter-Sitzung, kein Produktionsbestand nötig |
| 13-U8 | Tastatur „Nicht löschbar"-Chip | A | — | Tastaturbedienung am Dev-Server |
| 13-U9 | Dunkelmodus aller neuen Flächen (Phase 13) | A | (Leitpunkt) | Dublettenkandidat 4 (Teilmenge) bestätigt — Leitpunkt des Kontrastdurchgangs, subsumiert P12-13/21/27/47 |
| 13-U10 | Fenster <640px Zeilenaktionen/Korrekturblock-Knopf | A | — | Dublettenkandidat 4 geprüft und **verworfen für diesen Punkt** — Responsive-Layout (Trefferfläche, Zeilenumbruch), nicht Kontrast; geprüft, keine Dublette |
| 13-U11 | Generalprobe: Umstellung eintragen und löschen, alle Salden | B | (Leitpunkt) | Dublettenkandidat 1 bestätigt — Leitpunkt (11-U6, P12-18), vollständigster Nachweis |
| 13-U12 | Login/Laden nach `api/client.ts`-Bereinigung | A | — | Manueller Login-Test am Dev-Server |
| 13-U13 | `aria-label` Löschbestätigungsknopf | A | — | Screenreader-Prüfung am Dev-Server |
| 13-F1 | Erste Periode korrigierbar, nicht löschbar | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F2 | Keine Wiederherstellung gelöschter Perioden | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F3 | Belegnummer = Id der Ursprungsbuchung | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F4 | Mehrzahlform bei mehreren Buchungen | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F5 | Kettenriegel kurzzeitig ausgesetzt, dann geprüft | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F6 | `deletedBy` zusätzlich zu `deletedAt` | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F7 | Warnfarbe Gelb → Amber | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F8 | Pflichtbegründung Löschbestätigung ergänzt | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F9 | `checkPeriodChain()` unbedingt nach jedem Schreiben | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-F10 | `reversedAt` über `formatCreatedAtDe()` formatiert | D | — | Zustimmungsfrage zu bereits umgesetzter Festlegung |
| 13-U14 | Migration 015 auf Produktionskopie, integrity/foreign_key_check | B | — | Dublettenkandidat 5 geprüft und **verworfen** — andere Migration als P12-1 (015 statt 011), eigenständige Integritätsprüfung; beide Migrationen müssen unabhängig verifiziert werden, auch wenn der Prüfweg (B) identisch ist |
| 13-U15 | Ehemals tödlichen Ablauf nachstellen (40→32→40→löschen) | A | — | Manuelle Nachstellung am Dev-Server |
| 13-U16 | Korrektur ohne Saldowirkung, Journalzeile sichtbar | A | — | Kontoauszug-Prüfung am Dev-Server |
| 13-U17 | Drosselung dreier Vorschau-Routen real | A | (Leitpunkt) | Dublettenkandidat 6 bestätigt — Leitpunkt, absorbiert P12-42 (dessen IP-Eimer-Beschreibung überholt ist); Prüfung des Bedientempos braucht keine Produktionsdaten |
| 13-U18 | `PREVIEW_STALE` in Löschbestätigung | A | (Leitpunkt) | Dublettenkandidat 7 bestätigt — Leitpunkt, absorbiert P12-20 (gleiches Textmuster, anderer Dialog) |
| 13-U19 | Storno-Paar mit Zukunftsdatum im Kontoauszug | A | — | Konstruierte Zukunftsperiode am Dev-Server |

*(Der „Offene Restposten aus dem Code-Review (WR-07)" oberhalb dieser Zuordnung ist wie in
`<abgeschlossene_punkte>` festgelegt kein eigener Zählpunkt der 29 — er ist durch Plan 14-02
entschieden und erscheint als `14-U4` im Abschnitt „Phase 14" oben.)*

### Ergebnis der acht vorgeprüften Dublettenkandidaten

| # | Kandidat | Ergebnis |
|---|---|---|
| 1 | Generalprobe auf Produktionskopie (11-U6, P12-18, 13-U11) | **Bestätigt**, Leitpunkt 13-U11 |
| 2 | Vollständiger Playwright-Lauf (P12-37/38/39/48) | **Bestätigt**, Leitpunkt 48 (Wortlaut: „Ersetzt und präzisiert die Punkte 37-39") |
| 3 | Verschachtelte Dialoge, ESC, z-Index (P12-5, P12-31) | **Bestätigt**, Leitpunkt 5 (P12-5 trägt bereits den Satz „Jetzt im realen Einbettungskontext prüfbar (seit 12-07)") |
| 4 | Kontrast/Dunkelmodus neuer Flächen (P12-13/21/24/27/47, 13-U9/13-U10) | **Teilweise bestätigt** — Kontrastteilmenge (P12-13/21/27/47, 13-U9) zusammengeführt auf Leitpunkt 13-U9; P12-24 und 13-U10 **verworfen** (beide beschreiben Responsive-Layout <640px, keine Kontrastfrage, wörtlich nachgeprüft) |
| 5 | Migration auf Produktionskopie (P12-1, 13-U14) | **Verworfen** — zwei verschiedene Migrationen (011 und 015), unterschiedlicher Prüfinhalt trotz identischem Prüfweg |
| 6 | Drosselung im Realbetrieb (P12-42, 13-U17) | **Bestätigt**, Leitpunkt 13-U17 (P12-42 beschreibt den seit Commit `74a8be6` überholten IP-Eimer) |
| 7 | `PREVIEW_STALE`-Fehlertext (P12-20, 13-U18) | **Bestätigt**, Leitpunkt 13-U18 (gleiches Textmuster, zwei Dialoge) |
| 8 | Fokusverhalten beim Öffnen von Dialogen (P12-6/8/22/46) | **Teilweise bestätigt** — Verhaltensteilmenge (P12-6/8) zusammengeführt auf Leitpunkt 22; P12-46 **verworfen** (ausdrücklich eine offene Entscheidung, keine Verhaltensprüfung) |

**Zusätzliche Suche nach nicht im Kontextblock genannten Dubletten:** geprüft und verworfen —
11-U3 („GET /api/admin/period-chains" Rollenprüfung) gegen P12-19 (`checkAllPeriodChains()`
gegen Produktionskopie): unterschiedliche Prüfziele (Autorisierung vs. Datenintegrität nach
echtem Wechsel). P12-9 (Laufzeit `applyWorkTimeChange()` <10s) gegen P12-17 (voller
Vorschau→Speichern-Zyklus, Saldoabgleich): unterschiedliche Zusicherung (Performance vs.
Korrektheit). 13-U1 (Warnbanner rückwirkend) gegen P12-3 (bestehendes Modal unverändert):
unterschiedliche Komponenten. Keine weitere Dublette bestätigt.

### Kontrollzeile

| Gruppe | Anzahl |
|---|---|
| A — Dev-Server | 58 |
| B — Produktionskopie | 11 |
| C — nach dem Release | 0 |
| D — Festlegung | 17 |
| **Summe** | **86** |

Davon auf einen Leitpunkt zusammengeführt (bereits in der Summe 86 enthalten, hier zur
Transparenz separat gezählt): 14 Punkte — 11-U6, P12-18 (→13-U11); P12-37, P12-38, P12-39
(→48); P12-31 (→5); P12-13, P12-21, P12-27, P12-47 (→13-U9); P12-42 (→13-U17); P12-20
(→13-U18); P12-6, P12-8 (→22).

**6 (Phase 11) + 51 (Phase 12) + 29 (Phase 13) = 86 — Kontrollsumme bestätigt.**

---

## Phase 14.1 — Rechenwerk-Blocker aus dem Produktionslauf schließen

Quelle: `.planning/phases/14.1-rechenwerk-blocker-aus-dem-produktionslauf-schliessen/`.
Angefügt am 25.08.2026 nach Plan 14.1-01 (BL-01). Nur Punkte, die ein Mensch beurteilen oder
entscheiden muss — alles maschinell Prüfbare ist in `14.1-NACHWEIS-BL01.md` mit Zahlen belegt.

| # | Prüfung | Erwartung | Warum ein Mensch |
|---|---|---|---|
| 14.1-U1 | Kontoauszug eines Nutzers **ohne** Abwesenheit im laufenden Monat öffnen (z. B. Nutzer 18, 20, 21 oder 25), Monat = laufender Monat, an einem Tag, der **nicht** der Monatsletzte ist | Der fette „Zeitkonto-Saldo" über der Tabelle ist identisch mit der Summe der Buchungen darunter. Vor dem Fix lag er bei Nutzer 18 um 20,00 h, bei Nutzer 25 um 6,40 h zu niedrig | Die Zahl steht auf dem Bildschirm eines Mitarbeiters; nur ein Mensch sieht, ob die beiden Zahlen dort tatsächlich nebeneinander stimmen |
| 14.1-U2 | Denselben Kontoauszug für einen **künftigen** Monat öffnen | Der Saldo zeigt keine erfundenen Minusstunden für Tage, die noch nicht stattgefunden haben | Beurteilung der Darstellung, nicht des Rechenwegs |
| 14.1-U3 | **Entscheidung:** Wie sollen Urlaubs- und Krankheitstage im Kontoauszug erscheinen? Heute erzeugt ein solcher Tag **nur** die Gutschriftszeile (+ Tagessoll) und **keine** Soll-Gegenbuchung; die Liste summiert sich dadurch höher als der Saldo (Nutzer 16: 30,00 h, Nutzer 17: 8,00 h, Nutzer 3: 4,00 h — gemessen am 25.08.2026). Weg 1: Gegenbuchung sichtbar machen (−4,00 h neben +4,00 h). Weg 2: Gutschriftszeile auf `hours: 0` setzen, wie es die `model_change`-Zeilen bereits tun | Eine der beiden Darstellungen wird festgelegt und danach umgesetzt | Reine Darstellungsentscheidung mit Wirkung auf jeden Mitarbeiterbildschirm. Vollständig beschrieben in `deferred-items.md`, Abschnitt „Aus Plan 14.1-01 (25.08.2026)", Eintrag 1, und in `14.1-NACHWEIS-BL01.md`, Abschnitt 5 |
| 14.1-U4 | **Kenntnisnahme:** Das erste Erfolgskriterium der Phase 14.1 („Saldo = Summe der Buchungen, für jeden Nutzer") ist nach Plan 14.1-01 für die BL-01-Ursache erreicht (8 betroffene Nutzer vorher → 0 nachher), für die unter 14.1-U3 beschriebene zweite Ursache **noch nicht** (9 → 3 Nutzer) | Der Anwender nimmt zur Kenntnis, dass das Kriterium erst mit der Entscheidung aus 14.1-U3 vollständig erfüllt ist | Bewertung eines Erfolgskriteriums, keine technische Prüfung |
| 14.1-U5 | **Entscheidung:** Nach dem Löschen einer genehmigten Krankmeldung bleibt der Zeitkonto-Saldo in `work_time_accounts` auf einem Zwischenstand stehen — gemessen −176,00 h, während Journal und `overtime_balance` bei −184,00 h enden (Differenz genau ein Tagessoll). Ursache: Die Neuberechnung läuft innerhalb der Löschtransaktion, solange die Zeile in `absence_requests` noch steht. Weg 1: nach dem Löschen einmal nachsynchronisieren (kleinster Eingriff). Weg 2: die Neuberechnung hinter das `DELETE FROM absence_requests` ziehen (sauberer, verlangt eigenen Regressionstest) | Einer der beiden Wege wird festgelegt und danach umgesetzt | Der Eingriff berührt eine ausdrücklich als Atomaritätsklammer angelegte Transaktion; die Abwägung Risiko gegen Sauberkeit gehört dem Anwender. Vollständig beschrieben in `deferred-items.md`, Abschnitt „Aus Plan 14.1-02 (25.08.2026)", Eintrag 1, und in `14.1-NACHWEIS-BL02.md`, Abschnitt 7 |
| 14.1-U6 | In der Oberfläche einen **genehmigten Urlaub** eines Mitarbeiters löschen (Zeitraum in der Vergangenheit), danach **ohne Umweg über einen anderen Bildschirm** dessen Kontoauszug öffnen | Die Urlaubszeilen des gelöschten Antrags stehen nicht mehr im Kontoauszug. Vor dem Fix blieben sie stehen, und die Löschung meldete trotzdem Erfolg | Der Nachweis in Zahlen ist geführt (`14.1-NACHWEIS-BL02.md`, Abschnitt 1: 2 → 0 Journalzeilen). Ob die Oberfläche das auch so zeigt und ob die Erfolgsmeldung jetzt der Wahrheit entspricht, sieht nur ein Mensch am Bildschirm |
| 14.1-U7 | Dasselbe mit einer **genehmigten Krankmeldung** eines Mitarbeiters | Der Zeitkonto-Saldo des Mitarbeiters bewegt sich unmittelbar nach der Löschung. Vor dem Fix bewegte er sich gar nicht | Sichtprüfung am Mitarbeiterbildschirm. **Achtung:** Der Wert kann nach 14.1-U5 noch um ein Tagessoll vom Journal abweichen — das ist der dort beschriebene, bewusst offen gelassene Nebenbefund, kein neuer Fehler |
| 14.1-U8 | **Entscheidung:** Beim **Anlegen** einer Krankmeldung wird der Zeitkonto-Saldo in `work_time_accounts` nicht fortgeschrieben — gemessen −184,00 h vorher wie nachher, während im selben Moment die `sick_credit`-Gutschrift von +8,00 h im Journal steht und `overtime_balance` von 0 auf 8 Iststunden zieht (Testnutzer 43660, 25.08.2026). Ursache: D-05 benennt genau einen fehlenden Block; der `work_time_accounts`-Block des regulären Genehmigungsweges wurde bewusst nicht mitkopiert. Weg 1: nach dem Anlegen einmal nachsynchronisieren (kleinster Eingriff, dasselbe Muster wie Weg 1 unter 14.1-U5). Weg 2: den Cache aus der Fortschreibung nehmen und bei jeder Abfrage aus dem Journal ableiten (beseitigt 14.1-U5 und diesen Punkt in einem Zug, verlangt aber eigene Regressionstests) | Einer der beiden Wege wird festgelegt und danach umgesetzt | Dieselbe Abwägung wie unter 14.1-U5 und sinnvollerweise dieselbe Entscheidung — Risiko gegen Sauberkeit an einer Tabelle, die an mehreren Stellen gelesen wird. Vollständig beschrieben in `deferred-items.md`, Abschnitt „Aus Plan 14.1-03 (25.08.2026) — BL-05", Eintrag 1, und in `14.1-NACHWEIS-BL05.md`, Abschnitt 4 |
| 14.1-U9 | In der Oberfläche für einen Mitarbeiter eine **Krankmeldung für einen Tag in der Vergangenheit** eintragen, danach **ohne Umweg über einen anderen Bildschirm** dessen Kontoauszug öffnen | Die Krankheits-Gutschrift (+ Tagessoll) steht sofort im Kontoauszug. Vor dem Fix stand dort nichts, bis der nächtliche Lauf um 03:00 Uhr sie nachtrug — und der ist seit dem 23.08.2026 angehalten | Der Nachweis in Zahlen ist geführt (`14.1-NACHWEIS-BL05.md`, Abschnitt 1: 0 → 1 Journalzeile, +8,00 h). Ob die Oberfläche das ohne Zwischenschritt auch so zeigt, sieht nur ein Mensch am Bildschirm. **Achtung:** Der fette Zeitkonto-Saldo kann nach 14.1-U8 noch um ein Tagessoll abweichen — das ist der dort beschriebene, bewusst offen gelassene Punkt, kein neuer Fehler |
| 14.1-U10 | **Kenntnisnahme:** Die Krankmeldung bleibt **auto-genehmigt** — sie ist sofort wirksam, ohne dass jemand sie genehmigt; Genehmiger-Feld und Genehmigungszeitstempel bleiben leer, es entsteht kein Protokolleintrag, und die vier Bestandsanträge 46, 60, 68, 70 wurden nicht angefasst. Das war die Festlegung des Anwenders vom 25.08.2026 und ist jetzt durch drei Regressionstests festgeschrieben (`sickLeaveRecalc.test.ts`, Test 2 bis Test 4) | Der Anwender nimmt zur Kenntnis, dass BL-05 ausschließlich die fehlende Neuberechnung behoben hat und am Genehmigungsverhalten nichts geändert wurde | Bestätigung einer fachlichen Festlegung, keine technische Prüfung. Belegt in `14.1-NACHWEIS-BL05.md`, Abschnitte 1 und 7 |
| 14.1-U11 | **Entscheidung:** Der Historien-Export nennt stillgelegte Konten nicht mehr in seiner Nutzerliste (5 → 0), trägt aber weiterhin **102 Zeiteinträge und 1 genehmigten Antrag**, die über die Spalte `userId` auf genau diese Konten verweisen (gemessen auf der Produktionsarbeitskopie, Zeitraum 2025-01-01 bis 2026-12-31). Ursache: Die Listen `timeEntries` und `absences` der Sammelvariante sind nur nach Zeitraum eingegrenzt, nicht nach Nutzern — vor dem Fix genauso. Weg 1: denselben Nutzerfilter mitziehen, den `overtime_balance` jetzt trägt (kleiner Eingriff; die Datei wird in sich schlüssig, verliert aber 103 Zeilen). Weg 2: die Zeilen bewusst behalten und im Quelltext begründen — dann sollte die Nutzerliste die Konten wieder enthalten, sonst verweist die Datei ins Leere | Einer der beiden Wege wird festgelegt und danach umgesetzt | Der Export ist ein Aufbewahrungsdokument („ArbZG 2 Jahre, Steuerrecht 6 Jahre"). Ob ein Historien-Export nach dem Ausscheiden eines Mitarbeiters dessen Datenzeilen noch enthalten darf, ist eine fachliche Festlegung — dieselbe Zweckfrage, die den Unterschied zum DATEV-Export begründet — und keine Fehlerkorrektur. Vollständig beschrieben in `deferred-items.md`, Abschnitt „Aus Plan 14.1-04 (25.08.2026) — BL-03", Eintrag 1, und in `14.1-NACHWEIS-BL03.md`, Abschnitt 7 |
| 14.1-U12 | In der Oberfläche einen **Historien-Export** über einen Zeitraum anstoßen, der einen abgelehnten Urlaubs- oder Krankheitsantrag enthält, und die erzeugte Datei ansehen | Der abgelehnte Antrag steht nicht darin; nur genehmigte Abwesenheiten erscheinen. Vor dem Fix standen im Bestand 15 abgelehnte Anträge in der Datei — darunter 2 Krankmeldungen —, ohne dass ein Empfänger sie von genehmigten hätte unterscheiden können | Der Nachweis in Zahlen ist geführt (`14.1-NACHWEIS-BL03.md`, Abschnitt 3: 15 → 0). Ob der Bedienweg in der Oberfläche zur richtigen Funktion führt und die Datei beim Empfänger so ankommt, sieht nur ein Mensch |
| 14.1-U13 | **Kenntnisnahme:** Der **DATEV-Export** verhält sich bewusst **anders** als der Historien-Export — er nimmt soft-gelöschte Nutzer weiterhin mit („including deleted for historical accuracy", WR-11 aus Phase 11), weil er eine Lohnbuchhaltung beliefert, die auch für ausgeschiedene Mitarbeiter vollständig sein muss. Beide Entscheidungen stehen jetzt begründet im Quelltext derselben Datei und sind durch Test 5 in `historicalExportFiltering.test.ts` festgeschrieben | Der Anwender nimmt zur Kenntnis, dass die beiden Exporte verschieden entscheiden und das kein Widerspruch, sondern Absicht ist | Bestätigung einer fachlichen Festlegung. Wer die beiden Dateien nebeneinanderlegt, sieht einen Unterschied und könnte ihn für einen Fehler halten — deshalb hier ausdrücklich vermerkt |
| 14.1-U14 | **Kenntnisnahme:** Die Kennzahl `totalOvertime` im Historien-Export war im Bestand um **3.059,96 h** falsch (−2.954,21 h statt +105,75 h), weil sie die Monatszeilen von 5 stillgelegten Konten und 3 Zukunftsmonaten einzog. Falls eine früher erzeugte Exportdatei bereits an einen Empfänger (Steuerberater, Betriebsprüfung) gegangen ist, trägt sie diese Zahl | Der Anwender entscheidet, ob eine bereits herausgegebene Exportdatei ersetzt werden muss | Nur der Anwender weiß, ob und an wen ein Historien-Export tatsächlich herausgegeben wurde; das System führt darüber kein Protokoll |
| 14.1-U15 | **Entscheidung:** Der bis Plan 14.1-05 wirkende handgeschriebene Abzug schrieb bei jeder Genehmigung eines Überstundenausgleichs das Tagessoll aus dem **ältesten** Monat mit positivem Saldo heraus — nicht aus dem Monat des Ausgleichstags —, und sein Rückgabezweig war wirkungslos. Im Bestand gibt es drei genehmigte Ausgleiche (Anträge 25, 56, 64; Nutzer 18, 17, 3). Ob deren Alt-Abzug heute noch in einer Monatszeile von `overtime_balance` steht, wurde **nicht** gemessen: `overtime_balance` ist abgeleitet und heilt sich bei der nächsten Berichtsabfrage des Monats selbst — aber der nächtliche Lauf ist seit dem 23.08.2026 angehalten | Der Anwender entscheidet, ob die Datenbereinigung (Plan 14.1-06) diese drei Nutzer/Monate zusätzlich nachmisst und richtigstellt | Eine Nachmessung würde Daten anfassen und verlangt nach D-06 Sicherung und Trockenlauf — sie gehört nicht in einen Code-Fix. Vollständig beschrieben in `deferred-items.md`, Abschnitt „Aus Plan 14.1-05 (25.08.2026) — BL-04", Eintrag 1 |
| 14.1-U16 | **Kenntnisnahme:** Die `compensation`-Journalzeile **bleibt** (Entscheidung vom 25.08.2026, Option A). Ein Ausgleichstag trägt danach **zwei** Journalzeilen: eine rechnende (`time_entry`, −Tagessoll, aus dem Rebuild) und eine belegende (`compensation`, −Tagessoll, ohne Saldowirkung). Gemessen: Die Belegzeile überlebt eine Neuberechnung (1 Zeile davor, 1 danach) und ändert den Saldo um 0,00 h | Der Anwender nimmt zur Kenntnis, dass „genau eine Spur, nicht drei" als genau eine **saldowirksame** Spur umgesetzt wurde — und dass im Kontoauszug am Ausgleichstag zwei Zeilen stehen können | Die Zeile steht auf dem Bildschirm eines Mitarbeiters. Ob eine zusätzliche Belegzeile dort verständlich ist oder verwirrt, sieht nur ein Mensch. Begründung in `14.1-NACHWEIS-BL04.md`, Abschnitt 5 |
| 14.1-U17 | In der Oberfläche einen **Überstundenausgleich** eines Mitarbeiters für einen Tag in der Vergangenheit genehmigen, danach **ohne Umweg über einen anderen Bildschirm** dessen Kontoauszug öffnen — und ihn kurz darauf ein zweites Mal öffnen | Der Zeitkonto-Saldo ist beide Male derselbe. Vor dem Fix sprang er: unmittelbar nach der Genehmigung 8,00 h niedriger, beim nächsten Aufruf wieder auf dem alten Wert | Der Nachweis in Zahlen ist geführt (`14.1-NACHWEIS-BL04.md`, Abschnitt 1: Sprung −8,00 h → 0,00 h). Ob die Oberfläche das auch so zeigt, sieht nur ein Mensch am Bildschirm |
| 14.1-U18 | Denselben genehmigten Überstundenausgleich anschließend **ablehnen** — und in einem zweiten Durchgang **löschen** | Die Stunden kommen beide Male vollständig zurück; der Saldo steht danach exakt auf dem Wert von vor der Genehmigung. Vor dem Fix fehlten je 8,00 h, weil der damalige Rückgabezweig nie etwas zurückbuchte | Der Nachweis in Zahlen ist geführt (`14.1-NACHWEIS-BL04.md`, Abschnitt 1, Messungen 3 und 4: je −8,00 h → 0,00 h). Ob der Bedienweg in der Oberfläche zu denselben Funktionen führt, sieht nur ein Mensch |
| 14.1-U19 | **Kenntnisnahme:** Für die drei bereits genehmigten Ausgleiche (Anträge 25, 56, 64) gibt es **dauerhaft keinen** Prüfnachweis — die `compensation`-Zeilen wurden vor dem Rebuild-Fix vom 18.08.2026 von einer späteren Neuberechnung gelöscht (`SELECT COUNT(*) … WHERE type = 'compensation'` = 0). Sie werden nach D-04 **nicht** rückwirkend erzeugt; erst künftige Ausgleiche bekommen einen | Der Anwender nimmt zur Kenntnis, dass diese drei Tage im Journal ohne Beleg bleiben | Wenn eine Betriebsprüfung nach dem Beleg für diese drei Tage fragt, muss der Anwender die Lücke erklären können. Nur er weiß, ob das ein Problem ist |
| 14.1-U20 | **Entscheidung:** Die Zahl **59** aus dem Roadmap-Befund („59 fiktive Journalbuchungen") ist **falsch**. Der Trockenlauf vom 25.08.2026 findet unter dem festgelegten Prädikat **100** Journalzeilen, davon **50** mit einem Wert ungleich null; einschließlich des ausgenommenen Testnutzers 15015 sind es **130**. Die Zahl 59 ist mit keiner dieser Abgrenzungen deckungsgleich und auch nicht als Summe oder Differenz darstellbar. Es wurde **nicht** versucht, ein Prädikat zu konstruieren, das die 59 trifft — ein Prädikat, das an eine vorgegebene Zahl angepasst wird, hätte keinen Beweiswert | Der Anwender entscheidet, ob der Roadmap-Text auf die gemessene Zahl richtiggestellt wird | Der Trockenlauf ist die maßgebliche Zählung, nicht die Roadmap-Zahl — das Werkzeug druckt diesen Satz bei jedem Lauf selbst. Die Herkunft der 59 ließ sich am heutigen Bestand nicht rekonstruieren. Vollständig in `14.1-NACHWEIS-BEREINIGUNG.md`, Abschnitt „Abweichung zur Zahl 59", und in `deferred-items.md`, Abschnitt „Aus Plan 14.1-06 (25.08.2026)", Eintrag 3 |
| 14.1-U21 | **Kenntnisnahme:** Der Testnutzer **15015** (`test.vollzeit`) trägt in `development.db` weiterhin **30** Journalzeilen mit Zukunftsdatum (2026-09-01 bis 2026-09-30, `SUM(hours) = −88`) und **eine** Monatszeile 2026-09. Er ist nach D-06 ausdrücklich vom Löschprädikat ausgenommen; der Trockenlauf weist ihn als ausgenommen aus, und seine Zeilenzahlen sind vor und nach dem Lauf identisch (30 bzw. 2) | Der Anwender nimmt zur Kenntnis, dass das Erfolgskriterium „kein Datum in der Zukunft" **mit dem Zusatz „Testnutzer 15015 ausgenommen"** gilt | Wer künftig ohne Nutzerfilter prüft, findet 30 Treffer und hält den Befund für offen. Die Einschränkung gehört zu jeder Formulierung des Kriteriums dazu. In der Produktionskopie existiert 15015 nicht — es ist keine Kundenzahl betroffen |
| 14.1-U22 | **Entscheidung:** Nach der Bereinigung liegen drei zusätzliche, **nicht eingecheckte** Datenbankdateien unter `server/database/`: die Sicherung `backups/development.PRE-14.1-06_20260825_070544.db` (1.355.776 Bytes), die zurückgespielte Kopie `14.1-restore-probe.db` und die Produktionsarbeitskopie `14.1-bereinigung-probe.db`. Die Sicherung ist der **einzige** Rückweg für die Datenänderung dieses Plans | Der Anwender entscheidet, wie lange die drei Dateien aufbewahrt werden und wann sie gelöscht werden dürfen | Die beiden Probekopien sind reine Nachweise und können jederzeit weg. Die Sicherung sollte so lange liegen bleiben, wie ein Rückweg denkbar ist — nur der Anwender weiß, wann das nicht mehr der Fall ist |
| 14.1-U23 | **Entscheidung (Wiedervorlage von 14.1-U15):** Ob die drei genehmigten Überstundenausgleiche (Anträge 25, 56, 64; Nutzer 18, 17, 3) heute noch einen **Alt-Abzug** aus dem in Plan 14.1-05 entfernten FIFO-Weg in einer Monatszeile von `overtime_balance` stehen haben, wurde in Plan 14.1-06 **nicht** nachgemessen und **nicht** repariert | Der Anwender entscheidet, ob dafür ein eigener Bereinigungsvorgang aufgesetzt wird | Grund für das Auslassen: Ein zweites, sachlich unabhängiges Löschprädikat im selben Lauf wäre ein **zweiter Befund in demselben Vorgang** gewesen und hätte D-07 verletzt; der Nachweis wäre unlesbar und der Rückweg vermischt geworden. Ein eigener Vorgang bräuchte wieder die volle Ordnung aus D-06: Sicherung → Trockenlauf → Prüfung → `--apply` → Wiederherstellungsnachweis |
| 14.1-U24 | **Entscheidung:** Die Bereinigung wirkte **nur lokal**. Die Produktionsarbeitskopie trägt exakt dieselben **100** Journalzeilen und **3** Monatszeilen mit Zukunftsdatum; die echte Produktionsdatenbank mit hoher Wahrscheinlichkeit ebenfalls. D-13 verbietet den Produktionszugriff in dieser Phase vollständig — es fand kein Push, kein Deployment und kein Zugriff statt | Der Anwender entscheidet, ob und wann die Bereinigung gegen die Produktion gefahren wird | Der vollständige Probelauf gegen die Produktionsarbeitskopie liegt vor und ist unauffällig: 100 + 3 Zeilen entfernt, danach 0 verblieben, `integrity_check` = ok, und **0 von 20 Nutzern** mit einer Saldendifferenz ungleich 0,00 h — weder im kanonischen Rechenweg noch im angezeigten Monatsaggregat. Das Werkzeug trägt die vorgeschriebene Produktionsaufrufform im Kopfkommentar; ohne `--apply` bleibt es auch mit `--allow-production` ein Trockenlauf. Vor dem Lauf gehört die Sicherung nach `14-ROLLBACK-RUNBOOK.md` Abschnitt 1 |
| 14.1-U25 | Nach der Bereinigung in der Oberfläche den **Kontoauszug** der Mitarbeiter mit den Nutzer-Ids **3, 17 und 30** öffnen und bis ans Ende blättern | Es steht keine Buchung mehr mit einem Datum nach heute darin, und der fette Zeitkonto-Saldo ist derselbe wie vor der Bereinigung. Vorher standen dort 38, 32 bzw. 30 Buchungen für Tage, die noch nicht stattgefunden haben | Der Nachweis in Zahlen ist geführt (`14.1-NACHWEIS-BEREINIGUNG.md`, Stufe 5: 100 → 0 Zeilen; Saldendifferenz 0,00 h bei allen 30 Nutzern). Ob die Oberfläche das auch so zeigt und ob dem Mitarbeiter das Verschwinden der Zeilen auffällt, sieht nur ein Mensch am Bildschirm |

**Nicht Gegenstand dieser Punkte:** WR-01 bis WR-10 (eigener Milestone nach der Auslieferung,
D-09) sowie Push, Deployment und Zugriff auf die Produktionsdatenbank (D-13 — die Auslieferung
entscheidet der Anwender gesondert).
