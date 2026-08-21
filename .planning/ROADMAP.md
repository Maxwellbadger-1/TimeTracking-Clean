# Roadmap — TimeTracking System

## Milestones

- ✅ **v1.0 — 2-Tier DB Architecture** — Phasen 1–4 (abgeschlossen 2026-04-02)
- ✅ **v2.0 — Urlaubskonto: Korrektheit & Nachvollziehbarkeit** — Phasen 5–8 (abgeschlossen 2026-08-21)
- 📋 **v3.0 — Historisierte Arbeitszeitmodelle** — ab Phase 9 (in Planung)

---

## Phasen

<details>
<summary>✅ v1.0 — 2-Tier DB Architecture (Phasen 1–4) — abgeschlossen 2026-04-02</summary>

- [x] Phase 1: Server DB Consolidation (5/5 Pläne)
- [x] Phase 2: Symlink + PM2 Ecosystem (2/2 Pläne)
- [x] Phase 3: Local Dev Sync Script (2/2 Pläne)
- [x] Phase 4: Deploy Workflow + Documentation (3/3 Pläne)

Details: `.planning/MILESTONES.md`

</details>

<details>
<summary>✅ v2.0 — Urlaubskonto: Korrektheit & Nachvollziehbarkeit (Phasen 5–8) — abgeschlossen 2026-08-21</summary>

- [x] Phase 5: Journal-Fundament (2/2 Pläne) — 2026-08-19
- [x] Phase 6: Buchungen bei jedem Vorgang (7/7 Pläne) — 2026-08-21, Verifikation 14/14
- [x] Phase 7: Saldo aus Buchungen + Backfill (3/3 Pläne) — 2026-08-19
- [x] Phase 8: Kontoauszug für Mitarbeiter und Admin (5/5 Pläne) — 2026-08-20, Release v1.8.0

Vollständige Phasenbeschreibungen: `.planning/milestones/v2.0-ROADMAP.md`
Requirements mit Ergebnis: `.planning/milestones/v2.0-REQUIREMENTS.md`

</details>

### 📋 v3.0 — Historisierte Arbeitszeitmodelle (ab Phase 9)

Noch nicht zugeschnitten. Requirements liegen als Entwurf vor:
`.planning/REQUIREMENTS-v3-draft.md` (REQ-17 bis REQ-33).
Entscheidungsgrundlage: `.planning/notes/arbeitszeitmodelle-historisierung.md`

**Ziel:** Eine Änderung der Arbeitsstunden gilt ab einem Stichtag — was davor gerechnet
wurde, bleibt unangetastet.

---

## Fortschritt

| Phase | Milestone | Pläne | Status | Abgeschlossen |
|-------|-----------|-------|--------|---------------|
| 1. Server DB Consolidation | v1.0 | 5/5 | Complete | 2026-04-02 |
| 2. Symlink + PM2 Ecosystem | v1.0 | 2/2 | Complete | 2026-04-02 |
| 3. Local Dev Sync Script | v1.0 | 2/2 | Complete | 2026-04-02 |
| 4. Deploy Workflow + Documentation | v1.0 | 3/3 | Complete | 2026-04-02 |
| 5. Journal-Fundament | v2.0 | 2/2 | Complete | 2026-08-19 |
| 6. Buchungen bei jedem Vorgang | v2.0 | 7/7 | Complete | 2026-08-21 |
| 7. Saldo aus Buchungen + Backfill | v2.0 | 3/3 | Complete | 2026-08-19 |
| 8. Kontoauszug für Mitarbeiter und Admin | v2.0 | 5/5 | Complete | 2026-08-20 |

---

## Offene Nebenpunkte

Nicht einem Milestone zugeordnet, siehe STATE.md „Zurückgestellte Punkte":

- Symlink-Restpunkt aus der DB-Stabilisierung: Cron mit `DATABASE_PATH` reaktivieren
- `position`-Spalte fehlt in der lokalen Entwicklungsdatenbank
- Logik für unbezahlten Urlaub — offene Analyse
