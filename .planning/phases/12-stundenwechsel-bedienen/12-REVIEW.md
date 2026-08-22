---
phase: 12-stundenwechsel-bedienen
reviewed: 2026-08-22
depth: standard
files_reviewed: 32
sub_reports:
  - 12-REVIEW-SERVER.md
  - 12-REVIEW-DESKTOP.md
fix_reports:
  - 12-REVIEW-FIXES-SERVER.md
  - 12-REVIEW-FIXES-DESKTOP.md
resolved:
  critical: 11
  warning: 31
  info: 0
  note: "Info-Befunde bewusst ausserhalb des Korrekturumfangs belassen"
findings:
  critical: 11
  warning: 31
  info: 14
  total: 56
status: resolved
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

---

## Stand nach den Korrekturen

Alle **11 Critical** und alle **31 Warning** wurden behoben — Server in 15, Desktop in 16
atomaren Commits. Die 14 Info-Befunde blieben bewusst ausserhalb des Korrekturumfangs.

| Gate | Vor den Korrekturen | Nach den Korrekturen |
|---|---|---|
| `server && npx tsc --noEmit` | Exit 0 | Exit 0 |
| `desktop && npx tsc --noEmit` | Exit 0 | Exit 0 |
| `server && npx vitest run` | 403 gruen / 3 rot | **418 gruen / 3 rot** |

Die drei roten sind unveraendert die drei vorbestehenden aus
`11-AUSGANGSZUSTAND.md` (2x `unifiedOvertimeService.test.ts`,
1x `vacationBackfillService.test.ts`). Keine neue Regression.

**Die Schaerfe der neuen Tests wurde gemessen, nicht behauptet.** Beide Fixer haben
gezielte Ruecknahmen ihrer eigenen Korrektur vorgenommen und belegt, dass die jeweils neue
Zusicherung daraufhin rot wird — u. a. `hours: 0` in der Journalzeile
(`expected 152 to be +0`), der Filter in `getAggregatedOvertimeStats()`
(`totalUsers: 18` statt `17`), der deaktivierte Anfangsfokus
(`... liegt aber auf trigger`) und die fehlende Tagesstundenbegrenzung (`war 88`).
Alle Verfaelschungen wurden anschliessend zurueckgenommen.

### Die zwei tragenden Korrekturen

**Server CR-01/CR-02** — `model_change` ist jetzt konsequent eine *Journalzeile ohne eigene
Rechenwirkung*. Die Buchung bleibt (D4), faellt aber aus allen sechs
`SUM(hours)`-/Laufsaldo-Pfaden heraus und wird mit `hours: 0` plus dem neuen, nicht
summierten Feld `documentedDelta` ausgeliefert. Damit gilt die geforderte Invariante
wieder: die Summe der angezeigten Zeilen entspricht dem angezeigten Saldo. Die
REQ-29-Abdeckung wurde auf alle betroffenen Lesepfade ausgedehnt.

**Desktop CR-01** — die drei `useMemo` in `UserManagementPage.tsx` standen hinter einer
fruehen Rueckgabe. Bei einem Rollen- oder Sessionwechsel haette derselbe Knoten 8 statt 11
Hooks gerendert und React waere abgebrochen.

### Folgeaenderung im Desktop

Die `model_change`-Zeile im Kontoauszug zeigt nicht mehr `0,0 h`, sondern die beschriftete
Angabe „dokumentierte Differenz +2:30h" (bzw. „± 0:00h" bei Nulldifferenz), ohne Trendpfeil
und mit einer Fussnote, die klarstellt, dass der Betrag nicht zusaetzlich in den Saldo
zaehlt.

### Bewusste Abweichungen von den Korrekturvorschlaegen

Beide Fixer sind an einzelnen Stellen begruendet vom Vorschlag des Reviews abgewichen; die
Begruendungen stehen in den beiden Fix-Berichten. Nennenswert:

- **Desktop WR-12** — der vorgeschlagene `aria-label={`Bearbeiten: ${…}`}` haette die Tests
  nicht repariert (exakter Attributvergleich). Umgesetzt wurde beides: Textselektor in den
  Tests plus aria-label fuer die Barrierefreiheit. Es waren **sieben** Fundstellen, nicht
  sechs.
- **Desktop WR-21** — das Review leitete die abgedeckten Jahre aus den gelieferten Daten ab
  und verwechselte damit „Jahr ohne Feiertagstreffer" mit „Jahr nicht geladen". Geprueft
  wird jetzt gegen das Fenster selbst.
- **Desktop WR-09** — nur als Zwischenloesung behoben (benannte Konstanten mit
  Quellenzeiger). Ein maschinenlesbarer Fehlercode verlangt eine Vertragsaenderung ueber
  `ApiResponse`, `apiClient.request()`, die Hooks und den Server; das gehoert in eine
  eigene, geplante Aenderung.

### Neuer Nebenbefund, nicht behoben

Die Typ-Union in `desktop/src/hooks/useWorkTimeAccounts.ts` stimmt nicht mit dem ueberein,
was der Server liefert: deklariert sind `earned | compensation | carryover |
unpaid_adjustment`, geliefert werden auch `time_entry` und `unpaid_deduction`. Die
Spalte „Typ" zeigt fuer gewoehnliche Tageszeilen vermutlich den Rohwert statt einer deutschen
Bezeichnung. Als UAT-Punkt fuer Phase 14 aufgenommen.
