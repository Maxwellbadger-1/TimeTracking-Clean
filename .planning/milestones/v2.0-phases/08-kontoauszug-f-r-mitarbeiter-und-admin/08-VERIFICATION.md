---
phase: 08-kontoauszug-f-r-mitarbeiter-und-admin
verified: 2026-08-20T21:29:54Z
status: passed
score: 19/19 must-haves verified
overrides_applied: 0
---

# Phase 8: Kontoauszug für Mitarbeiter und Admin — Verification Report

**Phase Goal:** Was gebucht wurde, ist auch sichtbar — für beide Rollen. (API-Endpunkt mit
serverseitiger Rollenprüfung, Kontoauszug für Mitarbeiter/Admin, Verlinkung auf den Antrag,
Desktop-Release.)

**Verified:** 2026-08-20T21:29:54Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — Roadmap-Erfolgskriterien

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ein Mitarbeiter kann das Journal eines anderen weder sehen noch über die API abrufen | ✓ VERIFIED | `server/src/routes/vacationTransactions.ts` (403 bei fremder `userId`, kein stiller Fallback) und `server/src/routes/vacationBalance.ts` `:userId`-Route (IDOR-Fix, 403). Live gegen Produktion und lokal getestet: `curl` gegen `/api/vacation-transactions` und `/api/vacation-balances/1` ohne Session → `401`; Testsuite `vacationTransactionRoutes.test.ts` deckt 403 in beide Richtungen ab (11/11 grün). |
| 2 | Carmens Auszug zeigt die Storno-Geschichte nachvollziehbar: genehmigt −6, storniert +6 | ✓ VERIFIED | Produktionsdatenkopie (`server/database/development.db`, userId 17) geprüft: Buchung `id 31, days -6, referenceId 61` ("Urlaub … genehmigt") und `id 35, days +6, referenceId 61` ("Storno des Antrags vom 2026-08-24"). Beide Zeilen tragen dieselbe `absence`-Referenz und werden im Auszug per Hover-Paar-Hervorhebung (`VacationTransactions.tsx`, `hoveredAbsenceId`) gemeinsam kenntlich gemacht. |
| 3 | Der angezeigte Saldo stimmt mit der Urlaubsliste überein | ✓ VERIFIED | `getVacationAccountStatement` berechnet `available` aus `vacation_balance` (identisch zur Urlaubsliste); Invariante durch `syncTakenFromJournal` erzwungen. Gegen die synchronisierte Produktionskopie nachgerechnet: Journal-Saldo userId 17 = 5, `vacation_balance.taken` = 15, `entitlement(20)+carryover(0)-taken(15)=5` — stimmt überein. Oberste Zeile (nach `createdAt DESC, id DESC`) trägt `balanceAfter = 5`, identisch mit dem ausgewiesenen Kontostand. |
| 4 | Release veröffentlicht, `latest.json` enthält alle Plattformen | ✓ VERIFIED | `gh release view v1.8.0`: `isDraft: false`, Assets enthalten `.exe`/`.msi` (Windows), `.dmg` x64+aarch64 (macOS), `.deb`/`.rpm`/`.AppImage` (Linux). `latest.json` per `curl` heruntergeladen und ausgewertet: Felder `darwin-x86_64`, `darwin-aarch64`, `linux-x86_64` (+ Formatvarianten), `windows-x86_64` (+ nsis/msi) — alle vier Zielplattformen vorhanden. |

**Score (Roadmap-SC):** 4/4 verifiziert

### Observable Truths — Plan-Frontmatter Must-Haves (ergänzend, keine Scope-Reduktion)

| # | Truth (Plan) | Status | Evidence |
|---|---|---|---|
| 5 | Mitarbeiter erhält eigenen Kontoauszug (Datum, Vorgang, Tage, laufender Saldo) über API | ✓ VERIFIED | `GET /api/vacation-transactions` ohne `userId` → eigenes Konto; Test „liefert Mitarbeiter A ohne Parameter das eigene Journal" grün. |
| 6 | Admin erhält Auszug jedes Mitarbeiters, jahresgefiltert, über API | ✓ VERIFIED | Route erlaubt `userId` für Admins, `year`-Filter in `getVacationAccountStatement`; Test „liefert dem Admin den Auszug von Mitarbeiter B für ein gewähltes Jahr" grün. |
| 7 | Mitarbeiter kann Kontostand eines anderen über API nicht abrufen | ✓ VERIFIED | `vacationBalance.ts` `:userId`-Route: Eigentümerprüfung mit 403 vor jedem DB-Zugriff (IDOR aus Plan 08-01 geschlossen, im Code bestätigt, nicht nur in SUMMARY behauptet). |
| 8 | Buchung mit `referenceType='absence'` trägt Antragsdaten (Id, Typ, Zeitraum, Status, Tage) | ✓ VERIFIED | `LEFT JOIN absence_requests` in `getVacationJournalEntries`; Test „REQ-13: Buchungen mit Antragsbezug tragen die Antragsdaten, andere nicht" grün. |
| 9 | Verfügbarer Saldo entspricht Urlaubsliste | ✓ VERIFIED | Siehe Truth 3; zusätzlich Test „weist einen konsistenten Saldo aus" grün. |
| 10 | Mitarbeiter sieht auf Abwesenheiten-Seite eigenen Auszug (Datum, Vorgang, Tage, Saldo) | ✓ VERIFIED | `AbsencesPage.tsx` Tab „Kontoauszug" bindet `<VacationTransactions showYearSelector />` ohne `userId` ein (eigenes Konto). |
| 11 | Mitarbeiter kann im Auszug das Jahr wechseln | ✓ VERIFIED | `showYearSelector` rendert `<select>` mit `selectedYear`-State in `VacationTransactions.tsx`. |
| 12 | Admin öffnet aus Urlaubskonto-Verwaltung Auszug jedes Mitarbeiters für gewähltes Jahr | ✓ VERIFIED | `VacationBalanceManagementPage.tsx` Zeile 258: `<VacationTransactions userId={statementUser.userId} year={selectedYear} />`. |
| 13 | Buchung aus Abwesenheitsantrag führt per Klick zu Antragsdaten (Zeitraum, Typ, Status, Tage) | ✓ VERIFIED | Button „Antrag #…" → `setSelectedAbsence` → Modal zeigt Typ, Zeitraum, Status, Tage. |
| 14 | Admin kann Urlaubskonto nur mit Begründung speichern | ✓ VERIFIED | `VacationBalanceEditModal.validateForm`: `reason.trim().length < 5` blockiert `handleSubmit`. |
| 15 | Begründung erreicht Server und steht als Beschreibung der `correction`-Buchung im Auszug | ✓ VERIFIED | `useVacationBalanceAdmin` sendet `reason` im Body; `vacationBalanceService.buildCorrectionDescription` schreibt `„Korrektur … (Grund: ${reason})"` als `description` der `correction`-Transaktion. |
| 16 | Nach Admin-Korrektur zeigt Kontoauszug neue Buchung ohne manuelles Neuladen | ✓ VERIFIED | `invalidationHelpers.ts` Gruppe `vacation` invalidiert Query-Key `vacation-transactions`; `useVacationTransactions` nutzt `staleTime: 0`. |
| 17 | `tsc --noEmit` läuft für Server und Desktop fehlerfrei durch | ✓ VERIFIED | Selbst ausgeführt: `server` und `desktop` je Exit-Code 0. |
| 18 | Journal-Endpunkt auf Produktion erreichbar, weist unauthentifizierte Aufrufe mit 401 ab | ✓ VERIFIED | Live `curl` gegen `129.159.8.19:3000` bestätigt (siehe oben). |
| 19 | Health-Check der Produktion meldet `status: ok` | ✓ VERIFIED | Live `curl http://129.159.8.19:3000/api/health` → `{"status":"ok",...}`. |

**Score (gesamt, inkl. Plan-Ergänzungen):** 19/19 verifiziert

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/routes/vacationTransactions.ts` | `GET /api/vacation-transactions` mit Rollenprüfung | ✓ VERIFIED | `requireAuth`, 403-Logik, `getVacationAccountStatement`-Aufruf, 74 Zeilen |
| `server/src/routes/vacationTransactionRoutes.test.ts` | HTTP-Autorisierungstests inkl. 403-Fall | ✓ VERIFIED | 246 Zeilen, 11 Tests, alle grün (403/401/200-Matrix vollständig) |
| `server/src/services/vacationTransactionService.ts` | `getVacationJournalEntries` + `getVacationAccountStatement` | ✓ VERIFIED | Beide Funktionen exportiert und implementiert, inkl. `createdAt DESC, id DESC`-Sortierung mit dokumentierter Begründung |
| `desktop/src/hooks/useVacationTransactions.ts` | TanStack-Query-Hook auf `GET /api/vacation-transactions` | ✓ VERIFIED | 94 Zeilen, exportiert `useVacationTransactions`, `VacationJournalEntry`, `VacationAccountStatement` |
| `desktop/src/components/vacation/VacationTransactions.tsx` | Kontoauszug-Tabelle mit Jahreswahl und Antragsverlinkung | ✓ VERIFIED | 373 Zeilen, enthält `balanceAfter`-Spalte, Jahreswahl, Antragslink+Modal |
| `desktop/src/components/vacation/VacationBalanceEditModal.tsx` | Pflichtfeld Begründung | ✓ VERIFIED | `reason`-State + Validierung (min. 5 Zeichen) |
| `desktop/src/hooks/useVacationBalanceAdmin.ts` | `reason` im Body von `POST /api/vacation-balances` | ✓ VERIFIED | `mutateAsync({..., reason: reason.trim()})` |
| `CHANGELOG.md` | Eintrag zum Urlaubs-Kontoauszug | ✓ VERIFIED | Abschnitt „Urlaubs-Kontoauszug für Mitarbeiter und Admin" unter `[1.8.0] - 2026-08-20` |
| `desktop/package.json`, `Cargo.toml`, `tauri.conf.json` | Version 1.8.0 | ✓ VERIFIED | Alle drei Dateien exakt `1.8.0` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `server/src/server.ts` | `vacationTransactions.ts` | `app.use('/api/vacation-transactions', ...)` | ✓ WIRED | Zeile 189 bestätigt |
| `vacationTransactions.ts` | `vacationTransactionService.ts` | `getVacationAccountStatement` | ✓ WIRED | Import + Aufruf bestätigt |
| `vacationTransactionService.ts` | `absence_requests` | `LEFT JOIN` | ✓ WIRED | Query bestätigt, Test REQ-13 grün |
| `VacationTransactions.tsx` | `useVacationTransactions.ts` | Hook-Aufruf | ✓ WIRED | `useVacationTransactions(userId, effectiveYear, limit)` |
| `useVacationTransactions.ts` | `/api/vacation-transactions` | `apiClient.get` | ✓ WIRED | Query-String-Aufbau + Aufruf bestätigt |
| `AbsencesPage.tsx` | `VacationTransactions.tsx` | Tab „Kontoauszug", ohne `userId` | ✓ WIRED | Zeile 380 |
| `VacationBalanceManagementPage.tsx` | `VacationTransactions.tsx` | mit `userId`+`year` | ✓ WIRED | Zeile 258 |
| `VacationBalanceEditModal.tsx` | `useVacationBalanceAdmin.ts` | `upsert.mutateAsync` mit `reason` | ✓ WIRED | Bestätigt |
| `invalidationHelpers.ts` | Query-Key `vacation-transactions` | `invalidateVacationAffectedQueries` | ✓ WIRED | Gruppe `vacation` enthält `'vacation-transactions'` |
| `git tag v1.8.0` | `.github/workflows/release.yml` | Tag-Trigger | ✓ WIRED | Release v1.8.0 existiert, nicht Draft, alle Assets vorhanden |
| `release.yml` | `latest.json` | `includeUpdaterJson` | ✓ WIRED | `latest.json` heruntergeladen, 11 Plattform-Einträge (4 Zielplattformen abgedeckt) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `VacationTransactions.tsx` | `data.transactions`, `data.available` | `useVacationTransactions` → `GET /api/vacation-transactions` → `getVacationAccountStatement` → SQLite (`vacation_transactions`, `vacation_balance`) | Ja | ✓ FLOWING (gegen echte, synchronisierte Produktionsdaten für userId 17 mit 12 Zeilen bestätigt) |
| `VacationBalanceEditModal.tsx` | `reason` | Formularfeld → `useUpsertVacationBalance` → `POST /api/vacation-balances` → `upsertVacationBalance` → `recordVacationTransaction` (description) | Ja | ✓ FLOWING |

**Besonders geprüft (laut Orchestrator-Kontext):**

1. **Laufender Saldo, Sortierung `createdAt DESC, id DESC`:** Gegen die lokale Kopie der Produktionsdaten (userId 17, 12 Buchungen) Zeile für Zeile nachgerechnet — die `balanceBefore`/`balanceAfter`-Kette ist in Einfüge-Reihenfolge (aufsteigende `id`) lückenlos konsistent (0→20→19→…→10→9→5). Die Anzeige-Sortierung `createdAt DESC, id DESC` bringt die zuletzt erzeugte Zeile (höchste `id`, `balanceAfter = 5`) an die erste Position — identisch mit dem im Kopf ausgewiesenen `available = 5`. Dieser Mechanismus war in der ursprünglichen Fassung (`date ASC, id ASC`) fehlerhaft, wurde während der Abnahme (Plan 08-04, Task 3) gefunden und mit Regressionstest behoben (Commit `8af5e3f`) — im Code nachvollzogen, nicht nur der SUMMARY-Behauptung geglaubt.
2. **IDOR-Lücke `GET /api/vacation-balances/:userId`:** Im aktuellen Code von `server/src/routes/vacationBalance.ts` (Zeilen ~108–116) tatsächlich geschlossen — `isAdmin`-Prüfung vor jedem Datenzugriff, 403 bei fremder `userId` für Nicht-Admins. Nicht nur behauptet, sondern gelesen und durch Testfälle „verweigert Mitarbeiter A den Zugriff auf den Kontostand von Mitarbeiter B (403)" / „erlaubt Mitarbeiter A den Zugriff auf den eigenen Kontostand" bestätigt (beide grün).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Journal-Endpunkt ohne Auth → 401 (Produktion) | `curl -o /dev/null -w '%{http_code}' http://129.159.8.19:3000/api/vacation-transactions` | `401` | ✓ PASS |
| Kontostand-Endpunkt ohne Auth → 401 (Produktion) | `curl -o /dev/null -w '%{http_code}' http://129.159.8.19:3000/api/vacation-balances/1` | `401` | ✓ PASS |
| Health-Check (Produktion) | `curl http://129.159.8.19:3000/api/health` | `{"status":"ok",...}` | ✓ PASS |
| Journal-/Route-Tests | `npx vitest run vacationTransactionService.test.ts vacationTransactionRoutes.test.ts` | 37/37 grün | ✓ PASS |
| Phase 5–7 Regressionstests | `npx vitest run vacationConsistencyService/absenceVacationBooking/vacationCorrectionBooking` | 30/30 grün | ✓ PASS |
| `tsc --noEmit` Server | `npx tsc --noEmit` (server/) | Exit 0 | ✓ PASS |
| `tsc --noEmit` Desktop | `npx tsc --noEmit` (desktop/) | Exit 0 | ✓ PASS |
| Release v1.8.0 vollständig | `gh release view v1.8.0` | `isDraft: false`, alle Plattform-Assets vorhanden | ✓ PASS |
| `latest.json` Plattformabdeckung | `curl .../latest.json` | 4 Zielplattformen (Windows, macOS x64+aarch64, Linux) vorhanden | ✓ PASS |

### Probe Execution

Keine formalen `scripts/*/tests/probe-*.sh` für diese Phase deklariert oder konventionell vorhanden. Übersprungen — stattdessen Behavioral Spot-Checks (siehe oben) gegen Produktion und lokale Testsuite ausgeführt.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REQ-11 | 08-01, 08-02, 08-04, 08-05 | Mitarbeiter sehen Auszug des eigenen Kontos mit Datum, Vorgang, Tagen, laufendem Saldo | ✓ SATISFIED | API-Route + Desktop-Komponente + Tests, siehe Truths 1, 5, 10 |
| REQ-12 | 08-01, 08-02, 08-03, 08-04, 08-05 | Admins sehen Auszug jedes Mitarbeiters, jahresgefiltert | ✓ SATISFIED | API-Route (`userId`+`year`) + Admin-UI + Korrektur-Pflichtfeld, siehe Truths 6, 12, 14, 15 |
| REQ-13 | 08-01, 08-02, 08-04, 08-05 | Auszug verlinkt auf auslösenden Abwesenheitsantrag | ✓ SATISFIED | `LEFT JOIN absence_requests` + UI-Modal, siehe Truths 8, 13 |
| REQ-14 | 08-01, 08-04 | Mitarbeiter sieht ausschließlich eigenes Konto (serverseitige Rollenprüfung) | ✓ SATISFIED | 403-Logik in beiden Routen, live und testseitig verifiziert, siehe Truths 1, 7 |

Keine verwaisten Requirements — REQ-11 bis REQ-14 sind alle in mindestens einem Plan-Frontmatter deklariert und decken sich mit dem Coverage-Eintrag in ROADMAP.md/REQUIREMENTS.md.

### Anti-Patterns Found

Keine. Alle zwölf für diese Phase geänderten Kern-Dateien (Server-Routen, Service, Desktop-Hooks, Desktop-Komponenten) wurden auf `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` sowie auf leere Stub-Implementierungen geprüft — keine Treffer (ein einziger Fund war die Tailwind-Klasse `placeholder-gray-400`, kein Debt-Marker).

### Bekannte, außerhalb des Scopes dokumentierte Punkte (keine Gaps)

Aus `deferred-items.md`, zur Vollständigkeit erwähnt, nicht als Mangel dieser Phase gewertet:

- Gesamtsuite `172/176` — vier umgebungsbedingte Fehlschläge (zwei zeitabhängige `unifiedOvertimeService`-Tests, ein Test mit geteilter Test-DB-Vorbelastung aus Phase 7, ein global statt nutzerbezogen prüfender Backfill-Test). Alle phasenrelevanten Tests (Journal 37/37, Regression 30/30, Desktop 50/50) sind grün.
- Struktureller Befund: Server-Tests laufen mangels `NODE_ENV=test`-Pfad gegen `server/database/development.db` statt einer eigenen Testdatenbank.
- Zwei unbenutzte One-off-Skripte (`fixOvertimeTransactionsSchema.ts`, `validateOvertimeCalculation.ts`) respektieren `DATABASE_PATH` nicht — nicht Teil der Deploy-Pipeline.

Keiner dieser Punkte berührt eine der 19 verifizierten Wahrheiten dieser Phase.

### Human Verification Required

Keine offenen Punkte. Die visuellen/UX-Aspekte (Tab-Layout, Storno-Paar-Hervorhebung, Lesbarkeit) wurden bereits während Plan 08-04 Task 3 vom Anwender gegen echte, synchronisierte Produktionsdaten geprüft und mit „freigegeben" bestätigt (7/7 Prüfpunkte, dokumentiert im SUMMARY). Die beiden vom Orchestrator als besonders kritisch markierten Punkte (Saldo-Kette, IDOR-Fix) wurden in dieser Verifikation zusätzlich eigenständig im Code und an echten Daten nachvollzogen, nicht nur aus der SUMMARY übernommen.

### Gaps Summary

Keine Gaps. Alle 4 Roadmap-Erfolgskriterien und alle 15 ergänzenden Plan-Must-Haves sind im Code verifiziert, nicht nur in den SUMMARY-Dateien behauptet. Produktions-Deployment und Release sind live bestätigt (Health-Check, 401-Antworten, `latest.json`-Plattformabdeckung). Die beiden vom Orchestrator hervorgehobenen Risikopunkte (Saldo-Kette, IDOR-Schließung) halten der Prüfung stand.

---

*Verified: 2026-08-20T21:29:54Z*
*Verifier: Claude (gsd-verifier)*
