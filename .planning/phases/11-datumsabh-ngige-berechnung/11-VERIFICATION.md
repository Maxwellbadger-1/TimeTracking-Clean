---
phase: 11-datumsabh-ngige-berechnung
verified: 2026-08-22T12:42:54Z
verified_at_commit: ef971ba64669580630eaba870e5201c8ca42e445
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  note: "Erstverifikation. Alle Nachweise wurden am Stand ef971ba (nach beiden Code-Review-Durchläufen, 33 Korrekturen) eigenständig neu gemessen, nicht aus den -NACHWEIS.md-Dateien übernommen."
gaps: []
deferred:
  - truth: "Die Desktop-Anzeigen rechnen periodengetreu (WR-12)"
    addressed_in: "Phase 12"
    evidence: "ROADMAP.md Phase 12, Umfang: 'Desktop-Nachzug der periodengetreuen Sollstunden-Berechnung (bewusst aus Phase 11 ausgelassen, s. 11-DESKTOP-DISPOSITION.md)' sowie Plan 12-08 'WR-12-Nachzug: Desktop rechnet periodengetreu, Wirksamkeitsfenster erneut gemessen'"
  - truth: "Generalprobe der periodengetreuen Berechnung auf einer Kopie des Produktionsbestands"
    addressed_in: "Phase 14"
    evidence: "11-WIRKUNGSNACHWEIS.md, Abschnitt 'Was dieser Nachweis insgesamt NICHT zeigt': 'Ob ein echter Produktionsnutzer einen Modellwechsel korrekt durchläuft, ist Gegenstand der Generalprobe in Phase 14.'"
  - truth: "countWorkingDaysBetween()/countWorkingDaysForUser() bilden die Bereichsgrenzen zeitzonenfest"
    addressed_in: "nächster Review-Durchlauf / Phase 14"
    evidence: "11-REVIEW-FIX.md, 'Weiterhin offen' Punkt 1 — begründet zurückgestellt, laut Auftrag nicht als Lücke dieser Phase zu werten"
human_verification:
  - test: "DATEV-Export mit einem soft-gelöschten Nutzer im Zeitraum erzeugen und die Datei in den DATEV-Importweg geben"
    expected: "Die 14 zusätzlichen Zeilen für Nutzer 15 (soft-gelöscht am 28.02.2026) sind fachlich gewünscht und werden vom Importweg angenommen"
    why_human: "Fachliche/GoBD-Entscheidung und Verhalten eines externen Systems — technisch nur messbar, nicht bewertbar"
  - test: "DATEV-Export für einen Zeitraum anstoßen, in dem ein Nutzer keine lückenlose Periodenkette hat"
    expected: "HTTP 409 mit verständlicher Meldung in der Oberfläche statt stillschweigend unvollständiger Datei"
    why_human: "Fehlermeldungs-Verständlichkeit und Oberflächenverhalten am laufenden Server"
  - test: "GET /api/admin/period-chains am laufenden Server als Admin und als Nicht-Admin aufrufen"
    expected: "Admin bekommt die Befundliste, Nicht-Admin bekommt 403"
    why_human: "Benötigt laufenden Server und angemeldete Sitzung; Rollenprüfung ist nicht statisch belegbar"
  - test: "npm run validate:overtime:detailed -- --userId=<Modellwechsel-Nutzer> --month=... bei LAUFENDEM Server"
    expected: "Auch der vierte Vergleichsweg (Frontend-API) meldet PASSED"
    why_human: "Der Zweig wurde in allen bisherigen Läufen übersprungen ('Could not fetch from Frontend API') — er ist bis heute ungeprüft"
  - test: "Überstunden-Live-Anzeige und Kontoauszug im Desktop für einen Nutzer mit Modellwechsel ansehen"
    expected: "Die angezeigten Sollstunden entsprechen vor und nach dem Stichtag den serverseitig belegten Werten (8h bzw. 4h)"
    why_human: "Visuelle Prüfung; zusätzlich betroffen von der nach Phase 12 verschobenen Desktop-Umstellung (WR-12)"
  - test: "Generalprobe des gesamten Rechenwegs auf einer Kopie der Produktionsdatenbank"
    expected: "Keine Saldoänderung bei Nutzern ohne Modellwechsel; Periodenketten lückenlos"
    why_human: "Produktionsdaten sind in dieser Phase per Produktionsschutz ausgeschlossen; ausdrücklich Phase 14"
---

# Phase 11: Datumsabhängige Berechnung — Verifikationsbericht

**Phasenziel:** Die Sollstunden eines Tages kommen aus der Periode, die an diesem Tag galt.
**Geprüft am:** 2026-08-22T12:42:54Z
**Geprüfter Stand:** `ef971ba` (main, sauberer Arbeitsbaum bis auf eine phasenfremde,
unversionierte Datei aus Phase 10)
**Status:** human_needed — **keine Lücke gefunden**; offen sind ausschließlich Punkte, die
einen Menschen brauchen und laut Anweisung des Anwenders gebündelt in Phase 14 abgenommen
werden.
**Re-Verifikation:** Nein — Erstverifikation.

---

## Vorbemerkung zur Beweisführung

Die Phase liefert vier `-NACHWEIS.md`-Dateien mit wörtlichen Ausgaben. Diese Nachweise
stammen von **vor** den 33 Code-Review-Korrekturen aus zwei Durchläufen
(`470edf3..6174c42` und `b97fcb4..09518fb`). Sie wurden deshalb **nicht übernommen**.
Jede tragende Messung ist am Stand `ef971ba` eigenständig wiederholt worden — mit eigenen
Kopien der Arbeitsdatenbanken, damit die Beweisdateien der Phase unberührt bleiben. Wo die
Phase ein Wegwerf-Skript benutzt und gelöscht hat (Idempotenznachweis), habe ich das Skript
nach der im Nachweis abgedruckten Quelle nachgebaut und selbst laufen lassen.

Zusätzlich habe ich zwei frühere Codestände in einem eigenen Git-Worktree ausgecheckt
(`c2cebce` = Ende der Phase vor allen Korrekturen, `802a089` = Ende Durchlauf 1) und die
fachliche Ausgabe gegen **denselben** Datenbestand A/B-verglichen, um die Behauptung des
Fix-Berichts zu prüfen statt sie zu glauben. Der Worktree wurde nach der Messung entfernt.

---

## Zielerreichung

### Beobachtbare Wahrheiten

| # | Wahrheit | Status | Nachweis (eigene Messung) |
|---|---|---|---|
| 1 | **EK1** — Ein Testnutzer mit Modellwechsel bekommt für jeden Tag die Sollstunden, die an diesem Tag galten (vor und nach dem Stichtag) | ✓ VERIFIZIERT | `verifyPeriodNullEffect --asOf=2026-06-30 --erwarte-abweichung=12291` gegen eine Kopie von `11-modellwechsel.db`: `userId=12291: geprüfte Tage=546, abweichende Tage=31`, jede Abweichung `ALT=8 NEU=4` ab `2026-05-15`. Zusätzlich Tagestabelle aus `validate:overtime:detailed --userId=12291`: `2026-05-13 | Mi | 8h`, `2026-05-15 | Fr | 4h`, ab dort durchgehend 4h bis `2026-08-21` |
| 2 | **EK2** — Ein zweifach ausgeführter Rebuild liefert identische Ergebnisse | ✓ VERIFIZIERT | Eigener Nachbau des Vergleichsskripts, zwei Läufe `rebuildOvertimeTransactionsForMonth(12291, m)` je Monat: `2026-04: identisch=true, Laenge Lauf1=4229, Laenge Lauf2=4229`; `2026-05: identisch=true, 4349/4349`; `2026-06: identisch=true, 4229/4229`. Längen deckungsgleich mit `11-IDEMPOTENZ-NACHWEIS.md` Schritt 5 |
| 3 | **EK3** — Für Nutzer ohne Modellwechsel sind alle Salden vor und nach dem Umbau unverändert | ✓ VERIFIZIERT | `snapshotBalances --all --asOf=2026-08-20` am Stand `ef971ba` gegen eine Kopie von `11-nullwirkung.db` neu erhoben: SHA-256 des `users`-Arrays `f7e08c56a753b7088b0991d0481abaa6362bee4b10fc840353654de7de33320a` — **zeichengleich** mit `11-SNAPSHOT-VORHER.users.json` (erhoben in `d6ffe9a`, nachweislich Vorfahr des Eingriffscommits `c3c1fa8`). Zusätzlich `verifyPeriodNullEffect --asOf=2026-08-22`: `Tage verglichen: 4377 — davon abweichend: 0`, 20 von 20 Nutzern ohne Abweichung |
| 4 | **EK4** — Das Validierungswerkzeug meldet bei einem Nutzer mit Modellwechsel keine Abweichung | ✓ VERIFIZIERT | `validate:overtime:detailed --userId=12291 --month=` für `2026-04`, `2026-05`, `2026-06`: je `✅ Database validation: PASSED` und `✅ Transaction validation: PASSED`; Dreiwegevergleich in allen drei Monaten `✅✅` (Soll 160/104/84h) |
| 5 | **REQ-23** — `getDailyTargetHours(user, datum, periods)` löst über die zum Datum gültige Periode auf, mit Pflichtparameter ohne Vorgabewert; fehlende Periode bricht hart ab, Datum vor `hireDate` liefert 0 | ✓ VERIFIZIERT | `server/src/utils/workingDays.ts:157-204`: liest ausschließlich `period.workSchedule`/`period.weeklyHours`, kein Zugriff auf `user.weeklyHours`/`user.workSchedule`; `resolvePeriodForDate()` (Z. 39-63) wirft `MissingWorkPeriodError` und macht nur für `dateStr < user.hireDate` eine Ausnahme; Reihenfolge Feiertag → Periode → Wochenplan → weeklyHours-Fallback → Wochenende unverändert |
| 6 | **D1/D2** — Es gibt genau eine Auflösungsstelle; der Perioden-Cache lebt nur für einen Lauf, kein Modulzustand überlebt einen Request | ✓ VERIFIZIERT | `workPeriodContext.ts`: `createWorkPeriodContext()` hält die `Map` in der Closure (Z. 60-71), kein Modul-`Map`/Singleton im Modul; beide Wege (`resolve` im Cache, `directWorkPeriodLookup`) delegieren an `resolveWorkPeriodIn`/`resolveWorkPeriodAt` aus `workPeriodService.ts` |
| 7 | **D3/D7** — Jede Fundstelle der Sollstunden-Regel ist nachgezogen oder trägt eine begründete Disposition | ✓ VERIFIZIERT | `npx tsc --noEmit` → 0 Fehler (Pflichtparameter erzwingt jede Umstellung im `src/**`-Umfang). Eigene Gegensuche `grep -rn "weeklyHours / 5"` über `server/src`, `server/scripts`: die drei verbliebenen flachen Helfer (`calculateDailyTargetHours`, `calculateMonthlyTargetHours`, `calculateTargetHoursUntilToday`) haben **keinen** Produktivaufrufer — nur `workingDays.test.ts`; alle drei plus `verifyTestData.ts` und `fix-overtime.ts` sind in `11-AUFRUFER-CHECKLISTE.md` Z. 174/187-191 namentlich mit Begründung geführt. Kontextdurchreichung belegt in `absenceService`, `exportService`, `overtimeService`, `overtimeLiveCalculationService`, `unifiedOvertimeService`, `overtimeTransactionRebuildService` |
| 8 | Jedes nutzeranlegende Skript legt die Startperiode mit an; es gibt keinen zweiten Schreibweg für Perioden | ✓ VERIFIZIERT | `ensureInitialWorkPeriod` in allen sieben Anlage-Skripten vorhanden; `server/scripts/create-admin.ts` (außerhalb `tsconfig.include: src/**/*`) legt Nutzer und Periode in **einer** Transaktion an (Z. 163-184). `grep "INSERT/UPDATE/DELETE … user_work_periods"` findet ausschließlich `workPeriodService.ts` und Migration 009 |
| 9 | **REQ-25** — Werkzeuge und Migrationsskripte prüfen gegen den periodengültigen Maßstab, ohne zweite Sollstundenlogik, mit greifendem Produktionsschutz | ✓ VERIFIZIERT | `validateOvertimeDetailed.ts` importiert `getDailyTargetHours`/`createWorkPeriodContext` dynamisch nach dem Guard und gibt „GÜLTIGE PERIODEN (REQ-25 — periodengültiger Maßstab)" aus. Kanarienproben eigenständig gelaufen: `DATABASE_PATH=/home/ubuntu/databases/production.db` → `checkPeriodChains.ts` Exit 2, `verifyPeriodNullEffect.ts` Exit 2, jeweils vor jedem DB-Zugriff |
| 10 | Gesamtgrün — `tsc` fehlerfrei, kein neuer roter Test gegenüber `11-AUSGANGSZUSTAND.md` | ✓ VERIFIZIERT | `npx tsc --noEmit` → Exit 0, keine Ausgabe. `npx vitest run` → `Test Files 2 failed | 25 passed (27)`, `Tests 3 failed | 376 passed (379)`. Die drei roten sind titelgleich die drei in `11-AUSGANGSZUSTAND.md` als verbindlicher Ausgangszustand festgehaltenen (2× `unifiedOvertimeService.test.ts` Hire-Date-Regression, 1× `vacationBackfillService.test.ts`). Suite ist von 320 auf 379 Tests gewachsen |

**Score: 10/10 Wahrheiten verifiziert. Keine Lücke.**

### Zurückgestellte Punkte

| # | Punkt | Adressiert in | Beleg |
|---|---|---|---|
| 1 | Desktop rechnet periodengetreu (WR-12) | Phase 12 | `ROADMAP.md` Phase 12 Umfang + Plan 12-08 („WR-12-Nachzug"); `11-DESKTOP-DISPOSITION.md` mit Abhängigkeitsbegründung und gemessenem Wirksamkeitsfenster |
| 2 | Generalprobe auf Produktionskopie | Phase 14 | `11-WIRKUNGSNACHWEIS.md`, „Was dieser Nachweis insgesamt NICHT zeigt" |
| 3 | `countWorkingDaysBetween()` Bereichsgrenzen zeitzonenfest | nächster Review-Durchlauf | `11-REVIEW-FIX.md`, „Weiterhin offen" Punkt 1 (laut Auftrag keine Lücke dieser Phase) |

---

## Geforderte Artefakte

| Artefakt | Erwartet | Status | Details |
|---|---|---|---|
| `server/src/utils/workingDays.ts` | Periodenbewusste Auflösung mit Pflichtparameter, `MissingWorkPeriodError` | ✓ VERIFIZIERT | 704 Zeilen; `MissingWorkPeriodError` Z. 22; Pflichtparameter Z. 157-160; keine Lesestelle für `user.weeklyHours` in `getDailyTargetHours` |
| `server/src/services/workPeriodContext.ts` | Kontext-Schnittstelle, laufgebundener Cache, Direktnachschlag | ✓ VERIFIZIERT | 84 Zeilen; `WorkPeriodContext`, `createWorkPeriodContext`, `directWorkPeriodLookup` exportiert; Cache in der Closure |
| `server/src/services/workPeriodService.ts` | `resolveWorkPeriodIn` als reine Auflösung; einziger Schreibweg; `checkAllPeriodChains` | ✓ VERIFIZIERT | 536 Zeilen; einzige Datei mit Schreibzugriff auf `user_work_periods` |
| `server/src/services/userService.ts` | Startperiode bei Anlage, Spiegelung bei Änderung, `ensureInitialWorkPeriod` exportiert | ✓ VERIFIZIERT | `ensureInitialWorkPeriod` Z. 112; Spiegelung über `updateWorkPeriodValues` Z. 246/641; `hireDate`-Änderung zieht die Startperiode mit (Z. 186) |
| `server/src/scripts/verifyPeriodNullEffect.ts` | Unabhängige Tag-für-Tag-Gegenrechnung | ✓ VERIFIZIERT | Gegenrechnung `altDailyTargetHours()` liest ausschließlich die flachen `users`-Spalten; eigenständig gelaufen, Ergebnis oben |
| `server/src/scripts/checkPeriodChains.ts` (WR-02) | CLI-Alarm für defekte Periodenketten | ✓ VERIFIZIERT | Eigenständig gegen drei Datenbankkopien gelaufen, jeweils Exit 0 „Keine Befunde"; Kanarie Exit 2 |
| `server/src/routes/admin.ts` (WR-02) | `GET /api/admin/period-chains` | ✓ VERIFIZIERT (Verdrahtung) | `server.ts:31/199` registriert `adminRoutes` unter `/api/admin`; Laufzeitverhalten → menschliche Abnahme |
| `.planning/…/11-AUFRUFER-CHECKLISTE.md` | Vollständig abgehakte Aufrufer-Liste | ✓ VERIFIZIERT | Stichprobenartig gegen eigene Greps geprüft: die vier von mir unabhängig gefundenen Restfundstellen sind alle namentlich mit Begründung geführt |
| `.planning/…/11-SNAPSHOT-VORHER.json` / `-NACHHER.json` | Saldenstand vor/nach dem Umbau | ✓ VERIFIZIERT | `.users.json` beider Snapshots SHA-gleich; die Vollfassungen unterscheiden sich nur in `generatedAt`; mein Neulauf am Stand `ef971ba` reproduziert denselben SHA |
| `.planning/…/11-IDEMPOTENZ-NACHWEIS.md` | REQ-24 auf echten Daten | ⚠️ VERIFIZIERT MIT VORBEHALT | Inhaltlich reproduziert (identische Längen 4229/4349/4229). Der Nachweis beruht aber auf einem **gelöschten** Wegwerf-Skript; aus den committeten Artefakten allein ist er nicht wiederholbar (siehe Warnung W3) |
| `.planning/…/11-WIRKUNGSNACHWEIS.md` | Urteilstabelle über die vier Erfolgskriterien | ✓ VERIFIZIERT | Alle vier Urteile durch eigene Messung bestätigt; der Abschnitt „Was dieser Nachweis NICHT zeigt" ist vorhanden und benennt die Grenzen zutreffend |
| `.planning/…/11-DESKTOP-DISPOSITION.md` | Begründete Phasenzuordnung | ✓ VERIFIZIERT | Zuordnung an Phase 12 ist in `ROADMAP.md` Phase 12 (Umfang + Plan 12-08) tatsächlich angekommen — keine einseitige Behauptung |

---

## Prüfung der Schlüsselverbindungen

| Von | Nach | Über | Status | Details |
|---|---|---|---|---|
| `workingDays.ts` | `workPeriodContext.ts` | Pflichtparameter `periods: WorkPeriodContext` | WIRED | Erzwungen durch den Compiler, `tsc` grün |
| `workPeriodContext.ts` | `workPeriodService.ts` | `getWorkPeriods` + `resolveWorkPeriodIn` | WIRED | Z. 63-69 |
| `unifiedOvertimeService.ts` | `workPeriodContext.ts` | ein Kontext je Lauf | WIRED | 5× `createWorkPeriodContext`, 3× `directWorkPeriodLookup` |
| `overtimeService.ts` | `workPeriodContext.ts` | Kontext je Sicherstellungs-/Monatslauf | WIRED | 5× `createWorkPeriodContext` |
| `overtimeTransactionRebuildService.ts` | `workPeriodContext.ts` | Kontext je Rebuild | WIRED | Z. 183, an `collectDailyCalculations` durchgereicht |
| `overtimeLiveCalculationService.ts` | `workingDays.ts` | `getDailyTargetHours(user, date, periods)` | WIRED | 5 Aufrufstellen, alle dreiargumentig |
| `absenceService.ts` | `workingDays.ts` | `calculateAbsenceHoursWithWorkSchedule` mit Kontext | WIRED | 4× `createWorkPeriodContext`, 1× `directWorkPeriodLookup` |
| `exportService.ts` | `workingDays.ts` | `getDailyTargetHours` je Zeiteintrag | WIRED | Z. 199 mit `periods` |
| `refreshOvertimeBalances.ts` | `overtimeService.ensureOvertimeBalanceEntries` | „zieht mit" | WIRED | Kein eigener Sollstunden-Code im Skript; Kontext entsteht im Service |
| `seedTestUsers.ts` u. 6 weitere | `userService.ensureInitialWorkPeriod` | Startperiode nach jeder Anlage | WIRED | In allen sieben Skripten vorhanden |
| `create-admin.ts` | `userService.ensureInitialWorkPeriod` | Transaktion Nutzer + Periode | WIRED | Z. 163-184; einzige Anlagestelle außerhalb des `tsc`-Umfangs, von Hand geprüft |
| `checkPeriodChains.ts` / `routes/admin.ts` | `workPeriodService.checkAllPeriodChains` | zwei echte Aufrufer (WR-02) | WIRED | CLI Exit 0/1/2 belegt; Route in `server.ts` registriert |

---

## Datenflussprüfung (Stufe 4)

| Artefakt | Datenquelle | Liefert echte Daten | Status |
|---|---|---|---|
| `getDailyTargetHours` | `WorkPeriodContext.resolve` → `getWorkPeriods()` (SQL auf `user_work_periods`) | ja — belegt durch 8h/4h-Umschlag am Stichtag und durch 3863 bzw. 4377 verglichene Tage | ✓ FLIESSEND |
| `validateOvertimeDetailed` | geteilte Verbindung + `createWorkPeriodContext` | ja — Tagestabelle über 600 Tage, 91 Transaktionen, Dreiwegevergleich | ✓ FLIESSEND |
| `snapshotBalances` | `unifiedOvertimeService` je Nutzer | ja — 20 Nutzer, Werte ungleich null, Zeilenzahlprüfung gegen `users` | ✓ FLIESSEND |
| `checkAllPeriodChains` | `getWorkPeriods()` je nicht gelöschtem Nutzer | ja — Kette wird gegen `hireDate` geprüft, Exit-Code trägt das Ergebnis | ✓ FLIESSEND |
| `generateDATEVExport` | Zeiteinträge + `getDailyTargetHours` mit Kontext | ja — 602 Zeilen, 39 380 Zeichen aus echten Zeiteinträgen | ✓ FLIESSEND |

---

## Ausgeführte Prüfungen

| Prüfung | Befehl | Ergebnis | Status |
|---|---|---|---|
| Compiler | `cd server && npx tsc --noEmit` | Exit 0, keine Ausgabe | ✓ PASS |
| Testsuite | `cd server && npx vitest run` | `Test Files 2 failed | 25 passed (27)`, `Tests 3 failed | 376 passed (379)` — genau die drei dokumentierten Altfehler | ✓ PASS |
| Periodenketten (Modellwechsel-Kopie) | `DATABASE_PATH=<kopie 11-modellwechsel.db> tsx src/scripts/checkPeriodChains.ts` | „✅ Keine Befunde", Exit 0 | ✓ PASS |
| Periodenketten (Nullwirkungs-Kopie) | dito gegen Kopie `11-nullwirkung.db` | „✅ Keine Befunde", Exit 0 | ✓ PASS |
| Periodenketten (Entwicklungs-DB-Kopie) | dito gegen `VACUUM INTO`-Kopie von `development.db` | „✅ Keine Befunde", Exit 0 | ✓ PASS |
| Nullwirkung Modellwechsel | `tsx src/scripts/verifyPeriodNullEffect.ts --asOf=2026-06-30 --erwarte-abweichung=12291` | „Übereinstimmung: ja", 21 Nutzer, 3863 Tage, 31 abweichend (nur 12291), „Datei unverändert", Exit 0 | ✓ PASS |
| Nullwirkung Bestand | `tsx src/scripts/verifyPeriodNullEffect.ts --asOf=2026-08-22` | 20 Nutzer, 4377 Tage, 0 abweichend, Exit 0 | ✓ PASS |
| Saldensnapshot neu | `tsx src/scripts/snapshotBalances.ts --all --asOf=2026-08-20 --json=…` | `users`-Array zeichengleich mit `11-SNAPSHOT-VORHER.users.json` | ✓ PASS |
| Doppelter Rebuild | Nachbau des Vergleichsskripts, 2× `rebuildOvertimeTransactionsForMonth` je Monat | `identisch=true` für 2026-04/05/06 | ✓ PASS |
| Validierungswerkzeug (Modellwechsel) | `tsx src/scripts/validateOvertimeDetailed.ts --userId=12291 --month=2026-0{4,5,6}` | 3× „Database validation: PASSED" + „Transaction validation: PASSED" | ✓ PASS |
| Validierungswerkzeug (Gegenprobe) | dito `--userId=18 --month=2026-03` | beide PASSED | ✓ PASS |
| Produktionsschutz-Kanarie | `DATABASE_PATH=/home/ubuntu/databases/production.db` auf `checkPeriodChains.ts` und `verifyPeriodNullEffect.ts` | beide „Produktionsschreibzugriff verweigert", Exit 2 | ✓ PASS |
| A/B-Vergleich `802a089` → `ef971ba` (Iteration 2) | Eigene Messsonde gegen denselben Datenbestand, zwei Git-Worktrees | DATEV-CSV **zeichengleich** (`5bfe0f91…`, 602 Zeilen, 39 380 Zeichen); Nutzer-Summen und Aggregat zahlengleich | ✓ PASS (mit Einschränkung, s. W2) |
| A/B-Vergleich `c2cebce` → `ef971ba` (beide Durchläufe) | dito | DATEV-CSV **nicht** zeichengleich: 588 → 602 Zeilen; Differenz sind ausschließlich 14 **hinzugefügte** Zeilen für Nutzer 15 (soft-gelöscht) — keine bestehende Zeile verändert | ⚠️ siehe W1 |
| Nutzer-16-Abweichung eingeordnet | `validateOvertimeDetailed --userId=16 --month=2026-03` am Stand `ab7043d` (vor dem Eingriff) und am Stand `ef971ba` | beide Male `❌ TRANSACTION MISMATCH … -2.50h` | ✓ vorbestehend, keine Wirkung dieser Phase |

*Nicht ausgeführt:* Der Frontend-API-Zweig von `validate:overtime:detailed` (Server lief nicht)
und die Desktop-Oberfläche — beides in `human_verification` verzeichnet.

---

## Abdeckung der Anforderungen

| Anforderung | Quellplan | Beschreibung | Status | Beleg |
|---|---|---|---|---|
| REQ-23 | 11-02, 11-03, 11-04, 11-05, 11-06, 11-07, 11-08, 11-09, 11-11 | `getDailyTargetHours(user, datum)` löst über die zum Datum gültige Periode auf statt über den aktuellen Stammdatensatz | ✓ ERFÜLLT | Wahrheiten 5, 6, 7, 8; `tsc` grün; Gegensuche ohne undisponierte Fundstelle |
| REQ-24 | 11-01, 11-05, 11-09, 11-10 | Rebuild liefert je Tag die damals gültigen Sollstunden; ein wiederholter Rebuild ändert nichts | ✓ ERFÜLLT | Wahrheiten 1 und 2; eigener Doppel-Rebuild `identisch=true` in allen drei Monaten |
| REQ-25 | 11-08, 11-10 | Validierungswerkzeug prüft gegen den periodengültigen Maßstab und meldet bei Modellwechsel keine Abweichung, wo keine ist | ✓ ERFÜLLT | Wahrheiten 4 und 9; drei Monatsläufe PASSED, Gegenprobe an Bestandsnutzern PASSED |

Keine verwaisten Anforderungen: `REQUIREMENTS.md` ordnet Phase 11 genau REQ-23, REQ-24 und
REQ-25 zu; alle drei sind in Plan-Frontmatter beansprucht.

---

## Gefundene Auffälligkeiten

| Datei | Zeile | Muster | Schwere | Wirkung |
|---|---|---|---|---|
| `server/src/utils/workingDays.test.ts` | 622 | `// TODO: Add actual test implementation` + `expect(true).toBe(true); // Placeholder` | ⚠️ Warnung | Vorbestehend seit `df71496` (Phase 5), **nicht** von Phase 11 eingeführt; ein Test der „Holiday Edge Cases" ist damit nur nominell vorhanden |
| — | — | `TBD` / `FIXME` / `XXX` in den 47 von der Phase geänderten Dateien | — | **Keine.** Die Schuldenmarker-Sperre greift nicht |

### W1 — DATEV-Export ist gegenüber dem Phasenabschluss nicht mehr zeichengleich

Zwischen `c2cebce` (Ende der Phasenarbeit, Stand der SUMMARYs) und `ef971ba` wächst die
DATEV-Datei für `2026-01-01 … 2026-08-01` von 588 auf 602 Zeilen. Der vollständige Diff
besteht aus **14 hinzugefügten Zeilen** für Nutzer 15 („Test", soft-gelöscht am 28.02.2026);
keine bestehende Zeile und keine Zahl ändert sich. Ursache ist WR-11 aus Durchlauf 1
(„DATEV-Export berücksichtigt soft-gelöschte Nutzer"). Das ist eine gewollte
Vollständigkeitskorrektur und keine Verletzung der Nullwirkung im Sinne von EK3 (das
Erfolgskriterium betrifft **Salden**, und die sind zeichengleich). Die fachliche Abnahme,
ob soft-gelöschte Nutzer in den GoBD-Export gehören, gehört zu einem Menschen — sie steht
in `human_verification`.

### W2 — Die Formulierung „zeichengleich" im Fix-Bericht Iteration 2 ist für zwei Funktionen zu stark

`11-REVIEW-FIX.md` schreibt: „Die Ausgabe ist vor und nach allen zwölf Korrekturen
zeichengleich." Mein A/B-Lauf `802a089` → `ef971ba` bestätigt das für die DATEV-Datei
**wörtlich** — ich messe exakt den im Bericht genannten Hash
`5bfe0f91b89acf705e1a7a229fb6e536a0959104360b23855f4d36a6419b5cd2`, 602 Zeilen, und exakt
das genannte Aggregat `{"totalTargetHours":781.2,"totalActualHours":418.08,"totalOvertime":-363.12,"userCount":16}`.

Für `getAllUsersOvertimeSummary()` und `getAggregatedOvertimeStats()` gilt es jedoch nur
für die **Zahlen**, nicht für die Rückgabeform: WR-03 hat die Rückgabe von
`Array` auf `{ users, dataQuality }` bzw. von den vier Kennzahlen auf `{ stats, dataQuality }`
umgestellt. Geprüft und unkritisch: `server/src/routes/overtime.ts:72-75` und `:122-129`
legen `data` unverändert auf `….users` bzw. `….stats` und hängen `dataQuality` nur additiv
an — die **HTTP-Antwort für bestehende Clients ist unverändert**, `dataQuality` ist `null`,
solange kein Nutzer übersprungen wird. Es ist eine Ungenauigkeit im Bericht, kein Defekt.

### W3 — Der Idempotenznachweis ist aus den committeten Artefakten nicht wiederholbar

`11-IDEMPOTENZ-NACHWEIS.md` Schritt 5 beruht auf `src/scripts/tmp-11-09-idempotenz.ts`, das
nach dem Lauf gelöscht wurde. Der Quelltext ist im Dokument abgedruckt, weshalb ich ihn
nachbauen und das Ergebnis reproduzieren konnte (identische Vergleichslängen). Für künftige
Regressionsprüfungen von REQ-24 gibt es dennoch kein Werkzeug im Repository — anders als bei
EK1/EK3, wo `verifyPeriodNullEffect.ts` und `snapshotBalances.ts` dauerhaft vorliegen.
Empfehlung für Phase 14: den Doppel-Rebuild-Vergleich als festes Skript oder als Test
verankern.

### W4 — `deferred-items.md` Punkt 2 ist überholt

Dort steht, `validateAllTestUsers.ts` habe keinen `assertNotProduction()`. Am Stand `ef971ba`
hat es ihn (Z. 13 Import, Z. 38 Aufruf) — behoben durch CR-03 aus Durchlauf 1. Reine
Dokumentenpflege.

### W5 — Drei tote Helfer tragen die Regel von vor dem Umbau weiter

`calculateDailyTargetHours`, `calculateMonthlyTargetHours` und `calculateTargetHoursUntilToday`
in `workingDays.ts` rechnen weiterhin flach aus einem `weeklyHours`-Argument. Ich habe
eigenständig bestätigt, was `11-AUFRUFER-CHECKLISTE.md` Z. 187-189 behauptet: **kein
Produktivaufrufer**, nur `workingDays.test.ts`. Damit ist REQ-23 nicht verletzt. Das Risiko
bleibt, dass ein künftiger Aufrufer am periodengetreuen Weg vorbeirechnet, ohne dass der
Compiler etwas sagt. Die Checkliste merkt sie für Phase 14 zum Aufräumen vor.

### W6 — Der Stichtag selbst ist in der Fixture ein Feiertag

Der Modellwechsel-Nutzer 12291 hat den Stichtag `2026-05-14` — Christi Himmelfahrt. Die
Feiertagsprüfung läuft (korrekt) vor der Periodenauflösung, der Stichtag liefert deshalb 0h.
Der Wechsel ist über `2026-05-13` (8h) und `2026-05-15` (4h) unzweideutig belegt, der
**Stichtag selbst** wird durch diese Fixture jedoch nicht unvermischt geprüft. Der Nachweis
benennt das offen. Für Phase 12, wo Stichtage bedienbar werden, empfiehlt sich eine zweite
Fixture mit einem Werktag als Stichtag.

---

## Bekannt offen, nicht als Lücke dieser Phase gewertet

Laut Auftrag des Anwenders ausdrücklich ausgenommen und hier nur der Vollständigkeit halber:

1. **WR-12 Desktop-Vorschau** — `11-DESKTOP-DISPOSITION.md`, zugeordnet an Phase 12,
   dort als Plan 12-08 verplant. Zuordnung im ROADMAP nachgeprüft und vorhanden.
2. **Die drei in `11-REVIEW-FIX.md` unter „Weiterhin offen" begründeten Befunde**
   (`countWorkingDaysBetween()`-Bereichsgrenzen, CLI-Einstieg unter Windows in drei weiteren
   Skripten, `deleteTimeEntry()` als Hard Delete) sowie die sechs Info-Befunde IN-01…IN-06.
3. **Vorbestehende Testfehlschläge.** Gemessen im Hauptrepositorium: **drei**, titelgleich mit
   `11-AUSGANGSZUSTAND.md`. Die im Auftrag genannten zehn stammen aus der Worktree-Messung
   des Fix-Berichts; die zusätzlichen sieben (`balanceTracking.test.ts`) gehen auf einen
   Nutzer `testuser_balance` ohne Periode in jener Arbeitskopie zurück, der im
   Hauptrepositorium nicht existiert. Der Fix-Bericht erklärt diese Differenz zutreffend;
   meine Messung bestätigt seine Kontrollmessung („376 bestanden, 3 fehlgeschlagen") exakt.

---

## Menschliche Abnahme erforderlich

Die folgenden Punkte **blockieren Phase 11 nicht** und werden laut Anweisung des Anwenders
gebündelt in Phase 14 abgenommen. Sie sind der einzige Grund, warum der Status
`human_needed` und nicht `passed` lautet.

### 1. DATEV-Export mit soft-gelöschtem Nutzer

**Test:** Export `2026-01-01 … 2026-08-01` ziehen und in den DATEV-Importweg geben.
**Erwartet:** Die 14 Zeilen für den am 28.02.2026 soft-gelöschten Nutzer 15 sind fachlich
gewollt und werden angenommen.
**Warum ein Mensch:** GoBD-/fachliche Entscheidung und Verhalten eines externen Systems.

### 2. Abbruchverhalten des DATEV-Exports

**Test:** Export für einen Zeitraum anstoßen, in dem ein Nutzer keine lückenlose
Periodenkette hat.
**Erwartet:** HTTP 409 mit verständlicher Meldung in der Oberfläche statt stillschweigend
unvollständiger Datei.
**Warum ein Mensch:** Verständlichkeit der Meldung und Oberflächenverhalten.

### 3. `GET /api/admin/period-chains`

**Test:** Als Admin und als Nicht-Admin am laufenden Server aufrufen.
**Erwartet:** Admin bekommt die Befundliste, Nicht-Admin 403.
**Warum ein Mensch:** Braucht laufenden Server und angemeldete Sitzung.

### 4. Vierter Vergleichsweg des Validierungswerkzeugs

**Test:** `validate:overtime:detailed` für den Modellwechsel-Nutzer bei **laufendem** Server.
**Erwartet:** Auch die Frontend-API-Prüfung meldet PASSED.
**Warum ein Mensch:** Dieser Zweig wurde in allen bisherigen Läufen übersprungen
(„Could not fetch from Frontend API") und ist bis heute ungeprüft.

### 5. Desktop-Anzeige bei Modellwechsel

**Test:** Live-Anzeige und Kontoauszug für den Modellwechsel-Nutzer ansehen.
**Erwartet:** Angezeigte Sollstunden entsprechen vor und nach dem Stichtag 8h bzw. 4h.
**Warum ein Mensch:** Visuelle Prüfung; zusätzlich von WR-12 (Phase 12) betroffen.

### 6. Generalprobe auf Produktionskopie

**Test:** Gesamten Rechenweg auf einer Kopie des Produktionsbestands laufen lassen.
**Erwartet:** Keine Saldoänderung bei Nutzern ohne Modellwechsel, Periodenketten lückenlos.
**Warum ein Mensch:** Produktionsdaten sind in dieser Phase per Produktionsschutz
ausgeschlossen — ausdrücklich Phase 14.

---

## Zusammenfassung

Das Phasenziel ist erreicht und im Quelltext belegbar, nicht nur behauptet. Die Sollstunden
eines Tages kommen aus der Periode, die an diesem Tag galt: `getDailyTargetHours()` liest
`period.workSchedule`/`period.weeklyHours` und rührt den heutigen Stammdatensatz nicht mehr
an, der Perioden-Kontext ist Pflichtparameter ohne Vorgabewert, und der Compiler hat damit
jede Aufrufstelle benannt.

Alle vier Erfolgskriterien der ROADMAP habe ich am Stand **nach** den 33
Code-Review-Korrekturen eigenständig nachgemessen, nicht aus den Nachweisdateien übernommen.
Der entscheidende Einzelbeleg für die Frage des Auftrags — ob die Korrekturen die gemessene
Nullwirkung berühren — ist der frisch erhobene Saldensnapshot: er ist **zeichengleich** mit
dem Snapshot, der vor dem Eingriff ins Rechenwerk gezogen wurde. Die Tag-für-Tag-Gegenrechnung
über 4377 Tage bei 20 Nutzern findet null Abweichungen, und der Nutzer mit Modellwechsel
weicht an genau den 31 Tagen ab, an denen er abweichen soll.

Die Behauptung des Fix-Berichts der Iteration 2 zur DATEV-Datei trifft **wörtlich** zu — ich
messe denselben Hash. Sie ist für zwei Auswertungsfunktionen zu stark formuliert (die Zahlen
sind gleich, die Rückgabehülle hat sich geändert), was die HTTP-Antwort jedoch nicht berührt.
Gegenüber dem Stand vor **beiden** Korrekturdurchläufen ist die DATEV-Datei um 14 Zeilen
gewachsen — ausschließlich Zeilen eines soft-gelöschten Nutzers, keine geänderte Zahl. Das
ist eine gewollte Vollständigkeitskorrektur, braucht aber eine fachliche Abnahme.

Keine Lücke. Sechs Warnungen ohne Blockadewirkung, sechs Punkte für die gebündelte Abnahme in
Phase 14.

---

_Geprüft: 2026-08-22T12:42:54Z_
_Prüfer: Claude (gsd-verifier)_
