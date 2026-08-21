---
phase: 07-saldo-aus-buchungen-backfill
type: uat
started: 2026-08-20
status: complete
---

# UAT — Phasen 6 & 7: Urlaubs-Journal

Getestet wird das ausgelieferte Verhalten in Produktion. Die Oberfläche zeigt noch keinen
Kontoauszug (Phase 8) — geprüft werden die Salden, das Journal lese ich aus der Datenbank vor.

## Ausgangszustand (2026-08-20)

- Journal: **52 Buchungen**
- Gesamt Verbleibend 2026: **98 Tage**
- Backup: `production.PRE-BACKFILL_20260819.db`

## Testergebnisse

| # | Test | Ergebnis |
|---|------|----------|
| 1 | Mitarbeiter anlegen → Anspruchsbuchung entsteht | **bestanden** — User 30 "TestUrlaub", entitlement +20 für 2026 und 2027, Saldo 0→20 |
| 2 | Urlaub genehmigen → Abzug + Buchung | **bestanden** — `vacation_taken −5`, Saldo 20→15, Antrag 73 |
| 3 | Genehmigten Urlaub ablehnen → Tage kommen zurück | **bestanden** — `vacation_reverted +5`, Saldo 15→20 |
| 4 | Wieder genehmigen → kein Doppelabzug | **n/a** — über die Oberfläche nicht erreichbar |
| 5 | Mitarbeiter mit 0 Tagen → Konto bleibt 0 | **bestanden** — User 31 "UAT", 0 days pro-rata, keine Buchung |
| 6 | Urlaubsliste: Carmen 5, Benedikt 15, Gesamt stimmig | **bestanden** — 118 Tage (98 + 20 Testnutzer), Carmen 5, Benedikt 15 |
| 7 | Admin-Korrektur erzeugt Buchung mit Begründung | **bestanden** — `correction −5`, Saldo 20→15, referenceType manual |
| 8 | Konsistenzprüfung meldet ok | **bestanden** — 32 Konten, 0 Fehler, 0 Abweichungen |

## Notizen

_(wird während der Tests gefüllt)_

### Test 1 — bestanden (2026-08-20)

Mitarbeiter "Test Urlaub" (userId 30) mit 20 Tagen angelegt. Oberfläche zeigt
Anspruch 20 / Genommen 0 / Verbleibend 20. Server-Log bestätigt zwei automatische
Anspruchsbuchungen (2026 und 2027), jeweils `entitlement +20`, Saldo 0 → 20.

**Methodischer Hinweis:** Frische Daten sind per direktem Lesezugriff auf die
Datenbankdatei nicht sichtbar (SQLite WAL-Modus — die Änderungen stehen noch im
Write-Ahead-Log). Verifikation läuft deshalb über `pm2 logs timetracking-server`,
das die Buchungen im Klartext ausgibt.

## Ergebnis

**7 von 7 durchführbaren Tests bestanden.** Test 4 (Wieder-Genehmigung) ist über die
Oberfläche nicht erreichbar — `AbsencesPage.tsx:475` zeigt den Genehmigen-Button nur bei
`status === 'pending'`. Der Fall ist durch einen automatisierten Test abgedeckt.

Belegt in Produktion:
- Anlage eines Mitarbeiters bucht den Jahresanspruch automatisch (User 30: +20 für 2026 und 2027)
- Genehmigung bucht `vacation_taken −5` mit Antragsbezug
- **Ablehnung eines genehmigten Antrags bucht `vacation_reverted +5` zurück** — der Fehler,
  der Carmen sechs Tage gekostet hat, ist behoben
- 0 Urlaubstage erzeugen ein Konto ohne Buchung statt der früheren 30 (User 31)
- Admin-Korrektur wird als `correction`-Buchung festgehalten statt still überschrieben
- Konsistenzprüfer: 32 Konten, 0 Fehler, 0 Abweichungen

### Offene Testdaten in Produktion

| Objekt | Bemerkung |
|---|---|
| User 30 „Test Urlaub" | 20 Tage Anspruch, auf 15 korrigiert; Antrag 73 storniert |
| User 31 „UAT" | 0 Tage |
| Antrag 73 | 05.–09.10.2026, Status abgelehnt |

Löschen ist möglich, aber nicht nötig — die Buchungen bleiben als Historie erhalten und der
Konsistenzprüfer wertet sie korrekt als Hinweis, nicht als Fehler.

### Erkenntnis für Phase 8

Frische Änderungen sind per direktem Lesezugriff auf die Datenbankdatei nicht sichtbar
(SQLite WAL-Modus). Verifikation läuft über `pm2 logs timetracking-server` oder die API.
