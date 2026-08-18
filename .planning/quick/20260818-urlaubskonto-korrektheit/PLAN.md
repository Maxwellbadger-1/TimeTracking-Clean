---
quick_id: 260818-v3q
slug: urlaubskonto-korrektheit
date: 2026-08-18
status: in-progress
---

# Urlaubskonto: Korrektheit wiederherstellen

Behebt die in `.planning/debug/urlaubstage-bei-ablehnung-verloren.md` diagnostizierten Fehler
und korrigiert die entstandenen Falschbestände in der Produktionsdatenbank.

**Reihenfolge ist zwingend:** Erst Code, dann Daten. Sonst macht `|| 30` beim nächsten
Öffnen eines Kontos die Datenkorrektur sofort wieder zunichte.

---

## Task 1 — Gegenbuchung beim Ablehnen genehmigter Anträge

**Datei:** `server/src/services/absenceService.ts` → `rejectAbsenceRequest()`

Im Zweig `wasApproved === true` fehlt die Rücknahme der Kontobuchung. Nur die
Überstunden werden neu berechnet.

**Fix:** `revertBalancesAfterDeletion(id)` aufrufen, bevor die Überstunden neu berechnet
werden — analog zu `deleteAbsenceRequest()` (Z. 1059), wo es korrekt gemacht wird.

Behebt zugleich die Doppelbuchung bei Wieder-Genehmigung: Nach sauberer Rücknahme ist
`updateBalancesAfterApproval()` beim erneuten Genehmigen wieder korrekt.

**Verifikation:** `pending → approved → rejected` lässt `taken` unverändert;
`pending → approved → rejected → approved` ergibt `taken = days`, nicht `2 × days`.

---

## Task 2 — Die drei `|| 30`-Fallstricke

`0 || 30` ergibt in JavaScript 30. Eine bewusst eingegebene 0 wird dadurch verschluckt.

| Datei | Zeile | Fix |
|---|---|---|
| `server/src/routes/users.ts` | 311 | `data.vacationDaysPerYear ?? 30` |
| `server/src/routes/users.ts` | 326 | `data.vacationDaysPerYear ?? 30` |
| `desktop/src/components/vacation/VacationBalanceEditModal.tsx` | 27, 36, 87 | `balance.entitlement ?? 30` |

`??` greift nur bei `null`/`undefined` und lässt die 0 durch — dieselbe Semantik, die
`userService.ts:99` bereits korrekt verwendet (`!== undefined ? ... : 30`).

**Verifikation:** Neuer Nutzer mit 0 Urlaubstagen → Konto zeigt 0, nicht 30.

---

## Task 3 — Transaktionsklammer um Genehmigen/Ablehnen

**Datei:** `server/src/services/absenceService.ts`

Status-UPDATE und Folgebuchungen laufen ohne gemeinsame DB-Transaktion. Schlägt ein
späterer Schritt fehl, ist der Status bereits festgeschrieben.

**Fix:** Statuswechsel und Kontobuchung in `db.transaction(...)` klammern. Die
Überstunden-Neuberechnung bleibt außerhalb (ruft `await import()` und darf den
Statuswechsel nicht zurückrollen).

---

## Task 4 — `entitlement` nicht mehr rückwirkend überschreiben

**Datei:** `server/src/services/userService.ts` → `updateVacationEntitlementForUser()`

Ändert sich `vacationDaysPerYear`, wird der Anspruch **aller** Jahre überschrieben —
auch abgeschlossener. Belegt: Christine Glas' Anspruch für 2025 wurde nachträglich
von 12 auf 13 gehoben.

**Fix:** Nur laufendes und künftige Jahre anpassen (`WHERE year >= aktuelles Jahr`).
Vorjahre bleiben unangetastet. Pro-rata-Werte des laufenden Jahres nicht durch den
vollen Jahreswert ersetzen.

---

## Task 5 — Überstunden-Ausgleich überlebt den Monats-Rebuild

**Datei:** `server/src/services/overtimeTransactionRebuildService.ts` (Z. 97–102)

Der Rebuild löscht **alle** Transaktionen des Monats ohne Typfilter und erzeugt
`compensation` nicht neu. Folge: Ausgleichstage werden nie vom Überstundenkonto
abgebucht — Live-DB enthält 0 Transaktionen dieses Typs bei 3 genehmigten Anträgen.

**Fix:** `compensation` beim Löschen ausnehmen (analog `overtimeService.ts:264`, das
bereits eine Typliste verwendet).

---

## Task 6 — Qualitätsgates

- `npx tsc --noEmit` in `server/` und `desktop/` — muss fehlerfrei sein
- `npm test` — bestehende Tests dürfen nicht brechen
- CHANGELOG.md unter `[Unreleased] → Fixed` ergänzen

---

## Task 7 — Deployment

Laut `.claude/CLAUDE.md`: **niemals direkt auf dem Produktionsserver arbeiten.**
Lokal entwickeln → `git push origin main` → Auto-Deploy Blue Server.

Nach dem Push (Pflicht laut Deployment Verification Rules):
1. `gh run list --workflow="deploy-server.yml" --limit 1` → completed + success
2. `curl -s http://129.159.8.19:3000/api/health` → status ok
3. Funktionstest

---

## Task 8 — Datenkorrektur Produktion

**Erst nach erfolgreichem Deployment.** Frisches Backup vorab.

| Wer | Feld | Ist | Soll |
|---|---|---|---|
| Carmen Rothemund (17) | `taken` 2026 | 21 | **15** |
| Benedikt Jochem (16) | `taken` 2026 | 23 | **13** |
| Hans Schauer (20) | `entitlement` 2026 + 2027 | 30 / 30 | **0 / 0** |
| Maria Schauer (21) | `entitlement` 2026 + 2027 | 30 / 30 | **0 / 0** |
| Beate Walleiter (22) | `entitlement` 2026 + 2027 | 30 / 30 | **0 / 0** |
| Sepp Wasensteiner (23) | `entitlement` 2026 + 2027 | 30 / 30 | **0 / 0** |
| Christina Wasensteiner (29) | `entitlement` 2026 + 2027 | 30 / 30 | **0 / 0** |
| Reinhold Merl (27) | `entitlement` 2026 + 2027 | 25,5 / 30 | **0 / 0** |

Vom Nutzer fachlich bestätigt (18.08.2026): Die Stammdaten sind maßgeblich.

**Ausführung:** Idempotentes Skript mit Vorher/Nachher-Ausgabe, in einer DB-Transaktion,
mit `integrity_check` danach.

---

## Task 9 — Verifikation

- Urlaubsliste in der Oberfläche gegen die Sollwerte prüfen
- „Gesamt Verbleibend" muss von 257,5 auf **98** Tage fallen
  (273,5 nach Korrektur von Carmen/Benedikt, minus 175,5 der sechs Konten)
- `integrity_check: ok`, Datensatzzahlen unverändert

---

## Nicht in diesem Task

- **Urlaubs-Journal** (`vacation_transactions`) → eigener Milestone
- Jahresübergreifende Anträge (aktuell 0 Fälle)
- `pending`-Spalte / Migration 003
- Wiederherstellung gelöschter Zeiteinträge bei Ablehnung
- Staging-Sync-Reparatur, Cron-Reaktivierung → siehe `db-stabilisierung-20260818.md`
