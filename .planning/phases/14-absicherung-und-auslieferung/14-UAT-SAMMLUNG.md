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

_Wird nach Abschluss der Phase ergänzt._

---

## Phase 14 — Absicherung und Auslieferung

_Eigene Punkte der Phase, insbesondere der reale Umstellungsfall (D6) und die Freigabe
des Produktionslaufs (D2)._
