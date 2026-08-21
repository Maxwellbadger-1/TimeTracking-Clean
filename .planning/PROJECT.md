# TimeTracking System — Zeiterfassung für die Stiftung

## What This Is

Zeiterfassungssystem für die Stiftung: Node.js-Server auf Oracle Cloud, Tauri-Desktop-App für
die Mitarbeiter. Erfasst Arbeitszeiten, berechnet Überstunden nach deutschem Arbeitsrecht und
verwaltet Abwesenheiten (Urlaub, Krankheit, unbezahlt, Überstundenausgleich).

## Aktueller Milestone: v3.0 — Historisierte Arbeitszeitmodelle

**Core Value:** Eine Stundenumstellung verschiebt keine Vergangenheit. Was bis zum Stichtag
gerechnet wurde, bleibt stehen; ab dem Stichtag gilt das neue Modell. Wer wissen will, warum
sich ein Saldo geändert hat, sieht es im Kontoauszug statt es zu erraten.

**Auslöser:** `users.weeklyHours` und `users.workSchedule` sind flache Felder ohne Historie.
`getDailyTargetHours()` löst die Sollstunden aus dem heutigen Stammdatensatz auf, weshalb jeder
Rebuild die gesamte Vergangenheit mit den neuen Stunden nachrechnet — still, ohne dass es
jemand auslöst. Ein konkreter Umstellungsfall steht an (Stand 21.08.2026).

**Zielfunktionen**

- Arbeitszeit-Perioden (`user_work_periods`) mit Gültigkeitszeitraum statt flacher Felder
- Datumsabhängige Sollstunden-Auflösung in allen Berechnungswegen und im Validierungswerkzeug
- Stundenwechsel ab Stichtag — auch rückwirkend — mit Vorschau und sichtbarer Korrekturbuchung
- Stammdaten-Korrektur als getrennte Aktion mit Pflichtbegründung
- Perioden bearbeiten und löschen; Storno statt Löschung
- Vorgeschaltet: einen gemeinsamen Maßstab für alle Überstundenzahlen herstellen

**Bewusst außen vor:** Urlaubstage (`vacationDaysPerYear`) — siehe
`.planning/seeds/urlaubsanspruch-teilzeitwechsel.md`

Details: `.planning/REQUIREMENTS.md` (REQ-17 bis REQ-33), `.planning/ROADMAP.md` (Phasen 9–14),
Entscheidungsgrundlage: `.planning/notes/arbeitszeitmodelle-historisierung.md`

**Zuletzt ausgeliefert:** Milestone v2.0 am 21.08.2026 — Server in Produktion, Desktop-Release
v1.8.0. Das Urlaubskonto führt seither ein Journal.

---

<details>
<summary>Milestone v2.0 (abgeschlossen 2026-08-21): Urlaubskonto — Korrektheit & Nachvollziehbarkeit</summary>

**Core Value (erreicht):** Kein Urlaubstag verschwindet mehr unbemerkt. Jede Bewegung wird als
Buchung festgehalten, der Saldo ist ihre Summe — Abweichungen können strukturell nicht mehr
entstehen, und wenn doch etwas schiefgeht, ist es am selben Tag sichtbar statt nach drei
Monaten.

**Auslöser:** Am 18.08.2026 fiel auf, dass sechs stornierte Urlaubstage nicht zurückgebucht
worden waren. Die Untersuchung fand zehn Befunde — 16 verlorene Urlaubstage bei zwei
Mitarbeitern, 175,5 falsch ausgewiesene Tage bei sechs weiteren. Die Einzelfehler wurden
sofort behoben; der Milestone beseitigte die strukturelle Ursache: `vacation_balance.taken`
war ein handgepflegter Zähler ohne Historie.

### Requirements v2.0 — alle validiert

- ✓ `vacation_transactions` als Journal mit `balanceBefore`/`balanceAfter` — v2.0 (Phase 5)
- ✓ Buchungstypen als CHECK-Constraint, Auslöser und Begründung je Buchung — v2.0 (Phase 5)
- ✓ Genehmigung/Ablehnung/Löschung buchen in derselben DB-Transaktion — v2.0 (Phase 6)
- ✓ Admin-Korrektur mit Pflichtbegründung statt stillem Überschreiben — v2.0 (Phase 6)
- ✓ Anspruch und Übertrag bei Nutzeranlage und Jahreswechsel gebucht — v2.0 (Phase 6)
- ✓ `taken` als abgeleitete Summe der Buchungen — v2.0 (Phase 7)
- ✓ Konsistenzprüfer als Skript und Admin-Endpunkt, in CI — v2.0 (Phase 7)
- ✓ Backfill der Historie, Salden unverändert (98 Tage) — v2.0 (Phase 7)
- ✓ Kontoauszug für Mitarbeiter und Admin, verlinkt auf den Antrag — v2.0 (Phase 8)
- ✓ Serverseitige Rollenprüfung, IDOR-Lücke geschlossen — v2.0 (Phase 8)

Vollständige Historie: `.planning/MILESTONES.md`,
Archiv: `.planning/milestones/v2.0-ROADMAP.md` und `v2.0-REQUIREMENTS.md`

</details>

---

## Milestone 1 (abgeschlossen 2026-04-02): DB Setup Refactoring — 2-Tier Architecture

Umbau der chaotischen 3-Tier DB-Struktur (Dev→Green→Blue) zu einer sauberen 2-Tier-Architektur (Dev→Blue Production). Der Fokus liegt auf verlässlichen, schnellen Deployments ohne manuelle SSH-Debugging-Sessions. Die Production DB läuft bereits live auf Oracle Cloud und darf zu keinem Zeitpunkt verändert oder gelöscht werden.

**Core Value (erreicht):** Ein `git push main` deployt in unter 10 Minuten — ohne manuelle Eingriffe, ohne Überraschungen.

### Requirements Milestone 1

### Validated

- ✓ Production Server (Blue) läuft auf Oracle Cloud 129.159.8.19:3000 — existing
- ✓ GitHub Actions Auto-Deploy via `deploy-server.yml` bei Push auf `main` — existing
- ✓ SSH-Zugang zum Server mit `.ssh/oracle_server.key` — existing
- ✓ PM2 managed Node.js Server mit `timetracking-server` — existing
- ✓ SQLite WAL Mode für Multi-User-Betrieb — existing
- ✓ Green Server (Staging) auf Port 3001 — existing (broken, on-demand only)
- ✓ Zentralisiertes DB-Verzeichnis `/home/ubuntu/databases/` auf dem Server — Validated in Phase 1
- ✓ Production DB als Master: `/home/ubuntu/databases/production.db` (COPY, nie Move!) — Validated in Phase 1
- ✓ Blue Server zeigt via Symlink auf zentrales production.db — Validated in Phase 1
- ✓ PM2 Ecosystem File mit explizitem `DATABASE_PATH` ENV — Validated in Phase 1
- ✓ `npm run sync-dev-db` Script — zieht Schema+Daten von Prod lokal (Windows-kompatibel) — Validated in Phase 3
- ✓ Lokale Dev DB heißt `server/database.db` (konfigurierbar über DATABASE_PATH) — Validated in Phase 1
- ✓ `deploy-server.yml` prüft DB-Pfad nach Deployment — Validated in Phase 4
- ✓ Green Server on-demand: startet/stoppt manuell für kritische Änderungen — Validated in Phase 2

### Active

_(alle requirements wurden in Phasen 1-4 validiert)_

### Out of Scope

- Staging DB als permanente dritte Ebene — Hauptproblem war der Sync-Aufwand, nicht das Fehlen von Staging
- Datenmigration oder Schema-Änderungen — das ist ein separates Projekt
- Neue DB-Engine (PostgreSQL etc.) — SQLite reicht für diese Nutzerzahl
- Anonymisierung der Dev-Daten — kein Compliance-Requirement vorhanden

## Context

**Ausgangsproblem:**
- 2h Debugging pro Deployment wegen PORT-Konflikten, fehlenden DBs, xattr-Korruption
- Green Server crashed permanent (PM2 lud .env nicht → PORT-Variable ignoriert)
- Unklar welche DB die echten Produktionsdaten enthält (`database-shared.db` vs `database-production.db`)
- Mehrere lokale DB-Kopien auf macOS durch Extended Attributes korrupt

**Technische Umgebung:**
- Entwicklung jetzt auf **Windows** (C:\Users\maxfe\Maxflow Software\Projekte\Stiftung TimeTracker\TimeTracking-Clean)
- Production: Oracle Cloud Frankfurt, Ubuntu, PM2, Node.js 20
- SSH Key: `.ssh/oracle_server.key` im Projekt-Root
- Repo: https://github.com/Maxwellbadger-1/TimeTracking-Clean

**Kritische Regel:**
Production DB (`/home/ubuntu/database-shared.db` oder aktueller Pfad) darf NICHT verändert, verschoben oder gelöscht werden. Nur kopieren.

## Constraints

- **Safety**: Production DB ist live — kein direktes Modifizieren, kein Bewegen, keine Ausfallzeit außer beim PM2-Restart (~30s)
- **Windows-Kompatibel**: Sync-Script muss auf Windows (Git Bash / WSL) laufen, nicht nur macOS
- **No New Dependencies**: Keine neuen npm-Pakete für das Sync-Script — nur bash + sqlite3 + scp
- **Rollback Ready**: Jede Phase muss einen dokumentierten Rollback-Weg haben

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 2-Tier statt 3-Tier | Green Server war der Hauptverursacher der 2h-Debugging-Sessions | ✓ Validated in Phase 1-4 |
| Green Server bleibt optional (nicht abschalten) | Emergency-Fallback für riskante DB-Migrationen | ✓ Validated in Phase 2 |
| Symlink statt DATABASE_PATH-Änderung als primäre Lösung | Symlinks funktionieren transparent für Node.js ohne Config-Änderungen | ✓ Validated in Phase 1 |
| Copy, never Move | Production DB muss jederzeit rollback-fähig bleiben | ✓ Festgelegt |
| `server/database.db` als lokaler Dev-Name | Konsistent mit bestehender .gitignore-Konfiguration | ✓ Validated in Phase 3 |
| Journal statt Zähler beim Urlaubskonto | Ein handgepflegter Wert ohne Historie läuft zwangsläufig auseinander; die Abweichung ist erst sichtbar, wenn sie zufällig auffällt | ✓ Validated in Phase 5–7 |
| Buchung und Statuswechsel in einer DB-Transaktion | Eine vergessene Gegenbuchung war die Ursache des Auslösers — Atomarität schließt sie strukturell aus | ✓ Validated in Phase 6 |
| Storno statt Löschung bei Korrekturen | Der Auszug muss die Geschichte zeigen, nicht ein bereinigtes Ergebnis | ✓ Validated in Phase 6–8 |
| Übertrag unbegrenzt, kein Verfall | Fünf widersprüchliche Berechnungen (drei gedeckelt, zwei unbegrenzt) mussten auf eine Regel zusammengeführt werden | ✓ Validated in Phase 6 |
| Backfill mit Abbruchbedingung statt Best-Effort | Ein Backfill, der bei Abweichung weiterläuft, erzeugt genau die stillen Differenzen, die der Milestone beseitigen sollte | ✓ Validated in Phase 7 |
| Symlink auf dem Server entfernt (20.08.) | SQLite legt die WAL-Datei neben dem geöffneten Pfad an — zwei Prozesse mit getrennten Sperrbereichen auf eine Datei | ✓ Korrigiert die Entscheidung aus Phase 2 |

## Evolution

Dieses Dokument entwickelt sich bei Phase-Übergängen und Milestone-Abschlüssen.

**Nach jeder Phase** (via `/gsd:transition`):
1. Requirements invalidiert? → Out of Scope mit Grund
2. Requirements validiert? → Validated mit Phase-Referenz
3. Neue Requirements entstanden? → Active
4. Entscheidungen zu loggen? → Key Decisions

---
*Last updated: 2026-08-21 — nach Abschluss von Milestone v2.0 (Urlaubskonto: Korrektheit & Nachvollziehbarkeit)*
