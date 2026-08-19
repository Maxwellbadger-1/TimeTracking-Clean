# Roadmap

## Milestone 2: Urlaubskonto — Korrektheit & Nachvollziehbarkeit

**Gestartet:** 2026-08-18
**Ziel:** Kein Urlaubstag verschwindet mehr unbemerkt. Jede Bewegung wird gebucht, der Saldo
ist ihre Summe, und jeder Beteiligte kann nachvollziehen, wie sein Konto zustande kommt.

**Auslöser:** Root-Cause-Analyse vom 18.08.2026
(`.planning/debug/urlaubstage-bei-ablehnung-verloren.md`) — 16 verlorene Urlaubstage bei zwei
Mitarbeitern, 175,5 falsch ausgewiesene Tage bei sechs weiteren. Einzelfehler behoben, die
strukturelle Ursache nicht.

---

## Phases

| Phase | Name | Requirements |
|-------|------|--------------|
| 5 | Journal-Fundament | REQ-01 – REQ-04 |
| 6 | Buchungen bei jedem Vorgang | REQ-05 – REQ-07, REQ-15 |
| 7 | Saldo aus Buchungen + Backfill | REQ-08 – REQ-10, REQ-16 |
| 8 | Kontoauszug für Mitarbeiter und Admin | REQ-11 – REQ-14 |

---

## Phase Details

### Phase 5: Journal-Fundament

**Ziel:** Die Buchungstabelle existiert, ist migriert und kann geschrieben werden — ohne dass
sich am Verhalten des Systems etwas ändert.

**Umfang**

- Tabelle `vacation_transactions` nach dem Vorbild von `overtime_transactions`
- Migration über den bestehenden `migrationRunner` — idempotent, ohne Ausfallzeit
- Service-Schicht `vacationTransactionService.ts`: Buchung schreiben, Journal lesen,
  Saldo aus Buchungen berechnen

- Buchungstypen als `CHECK`-Constraint, damit unbekannte Typen gar nicht erst entstehen

**Erfolgskriterien**

- Migration läuft auf einer Kopie der Produktions-DB fehlerfrei durch, `integrity_check: ok`
- Eine Buchung lässt sich schreiben und wieder auslesen, `balanceBefore`/`balanceAfter` stimmen
- Bestehendes Verhalten unverändert — noch schreibt kein Vorgang ins Journal

**Warum zuerst:** Ohne Tabelle keine Buchungen. Bewusst ohne Verhaltensänderung, damit die
Migration isoliert verifizierbar ist.

---

### Phase 6: Buchungen bei jedem Vorgang

**Ziel:** Jede Bewegung auf dem Urlaubskonto erzeugt ab jetzt eine Buchungszeile.

**Umfang**

- `approveAbsenceRequest`, `rejectAbsenceRequest`, `deleteAbsenceRequest` buchen — in derselben
  DB-Transaktion wie der Statuswechsel

- Anspruch und Übertrag bei Nutzeranlage und Jahreswechsel werden gebucht
- Admin-Änderungen am Konto erzeugen `correction` mit Pflichtbegründung
- Regressionstests für genau die Fälle, die diesen Milestone ausgelöst haben

**Erfolgskriterien**

- `pending → approved → rejected` erzeugt zwei Buchungen, Saldo unverändert
- `pending → approved → rejected → approved` erzeugt drei Buchungen, `taken` = Tage (nicht 2×)
- Nutzeranlage mit 0 Urlaubstagen bucht 0, nicht 30
- Admin-Korrektur ohne Begründung wird abgelehnt
- Alle Tests grün (die zwei vorbestehend roten in `unifiedOvertimeService.test.ts` ausgenommen)

**Abhängigkeit:** Phase 5

---

### Phase 7: Saldo aus Buchungen + Backfill

**Ziel:** Der Saldo *ist* die Summe der Buchungen. Die Historie wird rückwirkend erzeugt.

**Umfang**

- Backfill-Skript: Historie aus `absence_requests` und `audit_log` rekonstruieren;
  nicht rekonstruierbare Anteile als gekennzeichnete Anfangsbuchung

- `taken` wird zur abgeleiteten Größe
- Konsistenzprüfer: Journal ↔ `vacation_balance` ↔ genehmigte Anträge; als Skript und
  Admin-Endpunkt

- Prüfer läuft in CI gegen eine Testdatenbank

**Erfolgskriterien**

- Nach dem Backfill ergeben sich **exakt** die heutigen Salden — Gesamt-Rest 2026 = 98 Tage,
  Carmen 5, Benedikt 15, die sechs Konten 0

- Der Prüfer meldet null Abweichungen
- Ein künstlich eingebauter Fehler wird vom Prüfer erkannt
- Backup vor dem Backfill, Rückweg dokumentiert und erprobt

**Abhängigkeit:** Phase 6 — sonst fehlen dem Backfill die laufenden Buchungen

**Risiko:** Der heikelste Schritt des Milestones. Läuft zuerst vollständig auf einer Kopie
der Produktionsdatenbank.

---

### Phase 8: Kontoauszug für Mitarbeiter und Admin

**Ziel:** Was gebucht wurde, ist auch sichtbar — für beide Rollen.

**Umfang**

- API-Endpunkte für das Journal, mit serverseitiger Rollenprüfung
- Mitarbeiter: Auszug des eigenen Kontos mit Datum, Vorgang, Tagen, laufendem Saldo
- Admin: Auszug jedes Mitarbeiters, nach Jahr filterbar, mit Korrekturbuchung
- Verlinkung auf den auslösenden Abwesenheitsantrag
- Desktop-Release, damit die Änderungen die Anwender erreichen

**Erfolgskriterien**

- Ein Mitarbeiter kann das Journal eines anderen weder sehen noch über die API abrufen
- Carmens Auszug zeigt die Storno-Geschichte nachvollziehbar: genehmigt −6, storniert +6
- Der angezeigte Saldo stimmt mit der Urlaubsliste überein
- Release veröffentlicht, `latest.json` enthält alle Plattformen

**Abhängigkeit:** Phase 7

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Journal-Fundament | 2/2 | Complete | 2026-08-19 |
| 6. Buchungen bei jedem Vorgang | 3/3 | Gaps Found | — |
| 7. Saldo aus Buchungen + Backfill | 0/? | Not started | — |
| 8. Kontoauszug | 0/? | Not started | — |

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 Tabelle `vacation_transactions` | 5 | Complete |
| REQ-02 Buchungstypen | 5 | Complete |
| REQ-03 Migration idempotent | 5 | Complete |
| REQ-04 Auslöser + Begründung | 5 | Complete |
| REQ-05 Buchung bei Antragsvorgängen | 6 | Pending |
| REQ-06 Admin-Korrektur mit Pflichtbegründung | 6 | Pending |
| REQ-07 Anspruch/Übertrag buchen | 6 | Pending |
| REQ-08 `taken` abgeleitet | 7 | Pending |
| REQ-09 Konsistenzprüfer | 7 | Pending |
| REQ-10 Backfill | 7 | Pending |
| REQ-11 Auszug Mitarbeiter | 8 | Pending |
| REQ-12 Auszug Admin | 8 | Pending |
| REQ-13 Verlinkung Antrag | 8 | Pending |
| REQ-14 Rollenprüfung serverseitig | 8 | Pending |
| REQ-15 Regressionstests | 6 | Pending |
| REQ-16 Prüfer in CI | 7 | Pending |

**Coverage:** 16/16 Requirements zugeordnet (100%)

---

## Key Constraints (Non-Negotiable)

- **Produktions-DB ist live** — Backup vor Migration und Backfill, Rückweg erprobt
- **Salden dürfen sich durch die Umstellung nicht ändern** — Gesamt-Rest 2026 bleibt 98 Tage
- **Kein Deployment ohne grünen `tsc --noEmit`** für Server und Desktop
- **Desktop-Änderungen brauchen ein Release** — `deploy-server.yml` deployt nur `server/**`
- Bestehende Muster nutzen statt neue erfinden: `overtime_transactions`, `migrationRunner`

---

## Archiv

### Milestone 1: 2-Tier DB Architecture — abgeschlossen 2026-04-02

| Phase | Status |
|-------|--------|
| 1. Server DB Consolidation | Complete (5/5) |
| 2. Symlink + PM2 Ecosystem | Complete (5/5) |
| 3. Local Dev Sync Script | Complete (2/2) |
| 4. Deploy Workflow + Documentation | Complete (3/3) |

**Core Value erreicht:** `git push main` deployt in unter 10 Minuten.

**Nachtrag 2026-08-18:** Die in Phase 2 eingeführte Symlink-Architektur hat unbeabsichtigt
eine Fehlerquelle geschaffen — ein Cronjob ohne gesetztes `DATABASE_PATH` öffnete dieselbe
Datenbank über den Symlink-Pfad, wodurch zwei Prozesse mit getrennten WAL-Dateien auf eine
Datei zugriffen. Behoben am 18.08.2026, siehe `.planning/debug/db-stabilisierung-20260818.md`.
Offener Restpunkt: Symlink auflösen, Cron mit `DATABASE_PATH` reaktivieren.
