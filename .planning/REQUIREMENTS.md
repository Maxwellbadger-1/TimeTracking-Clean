# Requirements — Milestone 2: Urlaubskonto Korrektheit & Nachvollziehbarkeit

**Erstellt:** 2026-08-18
**Vorheriger Milestone:** 1 — 2-Tier DB Architecture (abgeschlossen 2026-04-02)

## Warum dieser Milestone

Am 18.08.2026 fiel auf, dass Carmen Rothemund 6 stornierte Urlaubstage nicht zurückerhalten
hatte. Die Untersuchung förderte zehn Befunde zutage — darunter zwei, die 16 Urlaubstage bei
zwei Mitarbeitern und 175,5 falsch ausgewiesene Tage bei sechs weiteren verursacht hatten.

Die Einzelfehler sind behoben (Quick-Task `20260818-urlaubskonto-korrektheit`). Die
**strukturelle Ursache** bleibt: `vacation_balance.taken` ist ein handgepflegter Zähler.
Jede vergessene Gegenbuchung erzeugt eine stille Differenz, die niemand sehen kann — es gibt
keine Historie, keine Protokollierung, keinen Kontoauszug.

Der Fehler blieb drei Monate unentdeckt und fiel nur auf, weil ein Saldo zufällig negativ
wurde. Bei Benedikt Jochem war der Fehler doppelt so groß, blieb aber positiv — und damit
unsichtbar.

Für Überstunden existiert das Gegenstück bereits vollständig (`overtime_transactions` +
`OvertimeTransactions.tsx`). Dieser Milestone überträgt das Prinzip auf den Urlaub.

## Core Value

**Kein Urlaubstag verschwindet mehr unbemerkt.** Jede Bewegung ist eine Buchungszeile, der
Saldo ist ihre Summe — eine Abweichung kann strukturell nicht mehr entstehen, und wenn doch
etwas schiefgeht, ist es am selben Tag sichtbar statt nach drei Monaten.

---

## Requirements

### Journal-Fundament

- **REQ-01** — Tabelle `vacation_transactions` speichert jede Bewegung einzeln: `userId`,
  `year`, `date`, `type`, `days`, `description`, `referenceType`, `referenceId`,
  `balanceBefore`, `balanceAfter`, `createdAt`, `createdBy`

- **REQ-02** — Buchungstypen decken alle Bewegungen ab: `entitlement` (Jahresanspruch),
  `carryover` (Übertrag), `vacation_taken` (Genehmigung), `vacation_reverted` (Storno),
  `correction` (Admin-Korrektur), `expiry` (Verfall)

- **REQ-03** — Migration ist idempotent, rückwärtskompatibel und läuft ohne Ausfallzeit
- **REQ-04** — Jede Buchung trägt den Auslöser (`createdBy`) und eine lesbare Begründung

### Schreibpfade

- **REQ-05** — Genehmigung, Ablehnung und Löschung eines Antrags erzeugen je eine Buchung,
  innerhalb derselben DB-Transaktion wie der Statuswechsel

- **REQ-06** — Admin-Änderungen am Urlaubskonto erzeugen eine `correction`-Buchung mit
  **Pflichtbegründung** statt eines stillen Überschreibens

- **REQ-07** — Anspruch und Übertrag bei Nutzeranlage und Jahreswechsel werden gebucht

### Saldo aus Buchungen

- **REQ-08** — `taken` wird zur abgeleiteten Summe der Buchungen statt eines gepflegten Zählers
- **REQ-09** — Ein Konsistenzprüfer vergleicht Journal, `vacation_balance` und genehmigte
  Anträge und meldet Abweichungen — aufrufbar als Skript und über einen Admin-Endpunkt

- **REQ-10** — Backfill erzeugt die Historie rückwirkend aus `absence_requests` und `audit_log`;
  nicht rekonstruierbare Anteile werden als klar gekennzeichnete Anfangsbuchung eingestellt

### Sichtbarkeit

- **REQ-11** — Mitarbeiter sehen den Auszug ihres eigenen Urlaubskontos mit Datum, Vorgang,
  Tagen und laufendem Saldo

- **REQ-12** — Admins sehen den Auszug jedes Mitarbeiters, gefiltert nach Jahr
- **REQ-13** — Der Auszug verlinkt auf den auslösenden Abwesenheitsantrag
- **REQ-14** — Ein Mitarbeiter sieht ausschließlich sein eigenes Konto (Rollenprüfung
  serverseitig, nicht nur in der Oberfläche)

### Absicherung

- **REQ-15** — Tests decken die Fehler ab, die diesen Milestone ausgelöst haben:
  Storno eines genehmigten Antrags, Wieder-Genehmigung, Anlage mit 0 Urlaubstagen,
  jahresübergreifender Antrag

- **REQ-16** — Der Konsistenzprüfer läuft in CI gegen eine Testdatenbank

---

## Out of Scope

- **Überstunden-Ausgleich erreicht den Saldo nicht** — separater Defekt des Dual Calculation
  Systems, eigener Milestone

- **`pending`-Spalte / Migration 003** — die Migration gilt als angewendet, die Spalte fehlt;
  betrifft nur die Anzeige „X beantragt"

- **Wiederherstellung gelöschter Zeiteinträge** beim Ablehnen einer Abwesenheit
- **Jahresübergreifende Anträge** — der Fehler ist bekannt, aktuell 0 Fälle; wird über REQ-15
  nur getestet, nicht behoben

- **Umstellung des Überstundensystems** auf dieselbe Journal-Logik
- Infrastruktur-Restpunkte aus der DB-Stabilisierung (Staging-Sync, Cron, Symlink) —
  siehe `.planning/debug/db-stabilisierung-20260818.md`

---

## Constraints

- **Produktionsdatenbank ist live** — Migration und Backfill dürfen keinen Datenverlust
  verursachen; Backup vorher ist Pflicht, Rückweg muss existieren

- **Salden dürfen sich durch die Umstellung nicht ändern** — nach dem Backfill müssen exakt
  dieselben Werte herauskommen wie heute (98 Tage Gesamt-Rest 2026)

- **Kein Deployment ohne grünen `tsc --noEmit`** für Server und Desktop
- **Desktop-Änderungen erreichen Anwender nur über ein Release** — `deploy-server.yml`
  deployt ausschließlich `server/**`

- Bestehende Muster nutzen: `overtime_transactions`, `migrationRunner`, `OvertimeTransactions.tsx`
