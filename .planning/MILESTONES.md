# Milestones

## v2.0 — Urlaubskonto: Korrektheit & Nachvollziehbarkeit (abgeschlossen 2026-08-21)

**Umfang:** 4 Phasen (5–8), 17 Pläne, 35 Aufgaben
**Zeitraum:** 18.08.2026 – 21.08.2026 (4 Tage, 105 Commits)
**Umfang der Änderungen:** 42 Dateien, +5.534/−189 Zeilen in `server/` und `desktop/`
**Ausgeliefert:** Server in Produktion, Desktop-Release v1.8.0

### Auslöser

Am 18.08.2026 fiel auf, dass sechs stornierte Urlaubstage nicht zurückgebucht worden waren.
Die Untersuchung fand zehn Befunde — 16 verlorene Urlaubstage bei zwei Mitarbeitern,
175,5 falsch ausgewiesene Tage bei sechs weiteren. Der Fehler war drei Monate unentdeckt
geblieben und fiel nur auf, weil ein Saldo zufällig negativ wurde.

### Was erreicht wurde

**Der Saldo ist jetzt die Summe seiner Buchungen.** `vacation_transactions` hält jede
Bewegung einzeln; `taken` ist eine abgeleitete Größe statt eines handgepflegten Zählers.
Eine stille Differenz kann strukturell nicht mehr entstehen.

**Jeder Vorgang bucht.** Genehmigung, Ablehnung und Löschung eines Antrags schreiben ihre
Buchung in derselben Datenbanktransaktion wie den Statuswechsel — die Gegenbuchung kann
nicht mehr vergessen werden. Anspruch und Übertrag bei Nutzeranlage und Jahreswechsel
ebenso.

**Fünf widersprüchliche Übertragsberechnungen wurden zu einer.** `calculateCarryover()`
ersetzt drei auf 5 Tage gedeckelte, eine unbegrenzte und eine unbegrenzte Variante ohne
Untergrenze durch eine einzige Regel — Admin-Vorschau und tatsächliche Jahreswechsel-Buchung
stimmen seither nachweislich überein.

**Die Historie wurde rückwirkend erzeugt.** Der Backfill rekonstruierte 52 Buchungen aus
`absence_requests` und `audit_log`. Die Salden blieben dabei exakt gleich — Gesamt-Rest 2026
vorher wie nachher 98 Tage. Der Konsistenzprüfer meldet null Abweichungen und läuft in CI.

**Zwei reale Datenartefakte aus 2025 wurden korrigiert** — per Gegenbuchung statt Löschung,
gegen die Produktionsdatenbank ausgeführt und unabhängig verifiziert.

**Beide Rollen sehen ihr Konto.** `GET /api/vacation-transactions` liefert Journal und Saldo
mit serverseitiger Rollenprüfung; dabei wurde eine bestehende IDOR-Lücke an
`GET /api/vacation-balances/:userId` geschlossen. Der Kontoauszug zeigt Datum, Vorgang, Tage
und laufenden Saldo und verlinkt auf den auslösenden Antrag. Admin-Korrekturen verlangen eine
Begründung.

**Carmens Konto liest sich jetzt als Geschichte:** 22.05. genehmigt −6 (Saldo 10),
18.08. storniert +6, Endstand 5 — genau der Vorgang, der drei Monate unsichtbar war.

### Abnahme

Alle sieben Abnahmepunkte gegen echte Produktionsdaten vom Anwender freigegeben. Während der
Abnahme wurde ein Saldo-Kettenbruch bei rückdatierten Buchungen gefunden und behoben.

### Zurückgestellte Punkte beim Abschluss

8 offene Debug-Sessions (siehe STATE.md, Abschnitt „Zurückgestellte Punkte"). Vier davon
betreffen die Überstundenberechnung und werden in Milestone 3 aufgegriffen.

---

## v1.0 — DB Setup Refactoring: 2-Tier Architecture (abgeschlossen 2026-04-02)

**Umfang:** 4 Phasen (1–4)

Umbau der 3-Tier-DB-Struktur (Dev→Green→Blue) auf eine 2-Tier-Architektur (Dev→Blue).
Zentrales DB-Verzeichnis auf dem Server, PM2-Ecosystem mit explizitem `DATABASE_PATH`,
`npm run sync-dev-db` für den Weg Produktion→lokal, Deploy-Workflow mit DB-Pfad-Prüfung.

**Core Value erreicht:** Ein `git push main` deployt in unter 10 Minuten.

**Nachtrag 18.08.2026:** Die in Phase 2 eingeführte Symlink-Architektur hat unbeabsichtigt
eine Fehlerquelle geschaffen — ein Cronjob ohne gesetztes `DATABASE_PATH` öffnete dieselbe
Datenbank über den Symlink-Pfad, wodurch zwei Prozesse mit getrennten WAL-Dateien auf eine
Datei zugriffen. Behoben am 18.08.2026, Symlink auf dem Server am 20.08.2026 entfernt.
Siehe `.planning/debug/db-stabilisierung-20260818.md`.

---
