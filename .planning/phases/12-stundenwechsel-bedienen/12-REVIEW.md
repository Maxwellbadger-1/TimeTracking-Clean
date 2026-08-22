---
phase: 12-stundenwechsel-bedienen
reviewed: 2026-08-22
depth: standard
files_reviewed: 32
sub_reports:
  - 12-REVIEW-SERVER.md
  - 12-REVIEW-DESKTOP.md
findings:
  critical: 11
  warning: 31
  info: 14
  total: 56
status: issues_found
---

# Phase 12: Code-Review — Sammelübersicht

Der Prüfumfang (32 Quelldateien aus den `key_files`-Angaben der neun Plan-Summaries) wurde auf
zwei Reviewer aufgeteilt, weil ein einzelner Durchlauf über 32 Dateien bei `standard`-Tiefe
zwangsläufig oberflächlich bleibt. Die vollständigen Befunde mit Datei, Zeile, Begründung und
Korrekturvorschlag stehen in den beiden Teilberichten.

| Teilbericht | Dateien | Critical | Warning | Info | Summe |
|---|---:|---:|---:|---:|---:|
| [`12-REVIEW-SERVER.md`](12-REVIEW-SERVER.md) | 13 | 6 | 14 | 6 | 26 |
| [`12-REVIEW-DESKTOP.md`](12-REVIEW-DESKTOP.md) | 19 | 5 | 17 | 8 | 30 |
| **Gesamt** | **32** | **11** | **31** | **14** | **56** |

## Die elf Blocker in einer Zeile

### Server (`12-REVIEW-SERVER.md`)

| ID | Befund |
|---|---|
| CR-01 | Die `model_change`-Buchung doppelt den Differenzbetrag in allen transaktionssummierenden Lesepfaden — der Rebuild hat die Saldoänderung bereits bewirkt (Dual Calculation System) |
| CR-02 | `model_change` vergiftet die `balanceBefore`/`balanceAfter`-Laufsaldokette jedes späteren Rebuilds (Audit-Trail für DATEV) |
| CR-03 | Ungültige Kalenderdaten (`2026-13-45`) passieren die Regex-Validierung und landen dauerhaft in `user_work_periods.validFrom` |
| CR-04 | Der Tagesplan wird serverseitig auf keinen Wertebereich geprüft — die 0-bis-60-Grenze für Wochenstunden ist damit umgehbar |
| CR-05 | Der `referenceType`-CHECK aus Migration 011 ist wirkungslos: `NULL` in der `IN`-Liste hebt die Prüfung durch SQL-Dreiwertlogik für jeden Wert auf |
| CR-06 | `createTransaction()` kann `null` liefern, ohne dass der Aufrufer das bemerkt — die von D4 versprochene „genau eine Buchung" bleibt dann still aus |

### Desktop (`12-REVIEW-DESKTOP.md`)

| ID | Befund |
|---|---|
| CR-01 | Rules-of-Hooks-Verletzung in `UserManagementPage.tsx`: drei `useMemo` stehen hinter einer frühen Rückgabe — bei Rollen-/Sessionwechsel rendert derselbe Knoten 8 statt 11 Hooks, React bricht ab |
| CR-02 | Die Fokusfalle greift nie — weder `Modal` noch `ConfirmDialog` setzen einen Anfangsfokus; der Inhalt hinter dem Dialog bleibt per Tab voll bedienbar |
| CR-03 | Tagesstunden im Tagesplan werden weder im Frontend noch im Backend geprüft (Gegenstück zu Server-CR-04) |
| CR-04 | „eingetragen am" im Kontoauszug zeigt über `createdAt.slice(0, 10)` das UTC-Datum statt des lokalen — dieselbe Fehlerklasse wie das verbotene `toISOString().split('T')[0]` |
| CR-05 | Fehlgeschlagene Feiertagsabfrage bleibt unbemerkt: `response.success` wird nicht geprüft, die Abwesenheitsvorschau rechnet falsch und blockiert korrekte Anträge |

## Was ausdrücklich in Ordnung ist

Beide Reviewer haben die tragenden Zusagen der Phase gegengeprüft, nicht angenommen:

- **D2 eingehalten** — weder `useWorkTimeChange.ts` noch `WorkTimeChangeModal.tsx` rechnen etwas
  nach; Vorschau und Speichern laufen serverseitig durch dieselbe Funktion.
- **D6 eingehalten** — `requireAuth` + `requireAdmin` auf beiden POST-Routen.
- **D7 eingehalten** — eine einzige Transaktionsklammer, per Trigger-Test belegt.
- **D1 umgesetzt** — Stundenfelder schreibgeschützt, eigener Dialog, `weeklyHours` aus dem
  Nutzerdatensatz statt aus dem Formularzustand.
- Prepared Statements durchgehend, kein `toISOString().split('T')[0]` im Produktivcode,
  Produktionsschutz im Prüfskript, HMAC-Token mit `timingSafeEqual` und Längenvorprüfung,
  alle Desktop-Aufrufe über `apiClient` → `universalFetch`.
