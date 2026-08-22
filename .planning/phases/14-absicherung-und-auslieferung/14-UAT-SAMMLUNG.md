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

_Wird nach Abschluss der Phase ergänzt (Plan 12-09 liefert die gebündelte Liste)._

---

## Phase 13 — Korrigieren und rückgängig machen

_Wird nach Abschluss der Phase ergänzt._

---

## Phase 14 — Absicherung und Auslieferung

_Eigene Punkte der Phase, insbesondere der reale Umstellungsfall (D6) und die Freigabe
des Produktionslaufs (D2)._
