---
phase: 06-buchungen-bei-jedem-vorgang
plan: 07
subsystem: vacation-balance
tags: [sqlite, better-sqlite3, typescript, vitest, vacation, correction, backfill]

# Dependency graph
requires:
  - phase: 06-buchungen-bei-jedem-vorgang
    provides: "initializeVacationBalance() bucht seit 06-04 pro rata (verhindert erneutes Entstehen desselben Fehlerbilds); vacationBalanceService.updateVacationBalance() als bereits produktiver Korrektur-Mechanismus (Feld-Differenz als correction-Buchung)"
provides:
  - "preHireVacationCorrectionService.ts — buildPreHireCorrectionPlan()/applyPreHireCorrection()/hasExistingPreHireCorrection(), testbare Kernlogik getrennt vom CLI-Skript, analog zu vacationBackfillService.ts"
  - "correctPreHireVacationBalances2025.ts — CLI-Skript, Trockenlauf-Default, --apply-Schalter, gibt aufgelösten Datenbankpfad vor jedem Schreibzugriff aus"
  - "Die beiden realen 2025er-Datenartefakte (Karin Jochem userId 2, Christine Glas userId 3) sind gegen Produktion korrigiert: Journalsaldo 0, entitlement/carryover/taken/remaining je 0, je eine correction-Buchung mit Marker [BACKFILL-06-07]"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Datenkorrektur-Skripte trennen reine Plan-/Anwende-Logik (testbar, synthetische Nutzer) vom CLI-Skript (hartkodierte, freigegebene Kandidatenliste) — analog zu backfillVacationTransactions.ts", "Idempotenz per lesbarem Marker im Beschreibungstext ([BACKFILL-06-07]), nicht per separater Tracking-Tabelle"]

key-files:
  created:
    - server/src/services/preHireVacationCorrectionService.ts
    - server/src/services/preHireVacationCorrectionService.test.ts
    - server/src/scripts/correctPreHireVacationBalances2025.ts
  modified: []

key-decisions:
  - "entitlement wird per Korrektur auf 0 gesetzt, nicht nur der Journalsaldo per correction-Buchung ausgeglichen — der Kontoauszug-Header zeigt sonst irreführend 'Genommen 7/13', obwohl nie Urlaub genommen wurde"
  - "userId 1 (System-Administrator) und userId 15 (Test Test, weichgelöscht) bewusst NICHT in der Korrekturliste — beide passen laut eigener Prüfkette nicht zum behandelten Fehlerbild bzw. sind ungefährdet"
  - "Gegenbuchung statt Löschung — die ursprüngliche Anspruchsbuchung bleibt im Journal sichtbar, die Korrektur wird als zusätzliche Zeile ergänzt"
  - "Ausführung gegen die Produktionsdatenbank erfolgte durch den Orchestrator per SSH im ausdrücklichen Auftrag des Anwenders ('mach du das für mich'), nicht durch den Anwender selbst am Terminal — der im Plan vorgesehene Zwei-Stufen-Ablauf (Trockenlauf, Prüfung, erst dann --apply) blieb dabei vollständig gewahrt"
  - "Vor dem Korrekturlauf musste Phase 6 erst auf den Server deployed werden — das Skript existierte dort noch nicht; für künftige Datenkorrekturpläne ist das Deployment als Vorbedingung mitzuplanen"

requirements-completed: ["REQ-07"]

# Metrics
duration: ~40min (inkl. Deployment-Vorlauf und Produktionslauf)
completed: 2026-08-21
---

# Phase 06 Plan 07: Korrektur der zwei realen Pre-Hire-Vorausbuchungen (Karin Jochem, Christine Glas) Summary

**preHireVacationCorrectionService.ts + CLI-Skript korrigieren per Gegenbuchung (entitlement→0, keine Löschung) die zwei einzigen realen 2025er-Datenartefakte des in 06-04 behobenen Pro-rata-Fehlers — gegen die Produktionsdatenbank ausgeführt und unabhängig verifiziert.**

## Performance

- **Duration:** ~40 min (inkl. notwendigem Zwischen-Deployment von Phase 6)
- **Completed:** 2026-08-21
- **Tasks:** 3/3 abgeschlossen (2 auto, 1 checkpoint:human-action)
- **Files created:** 3

## Accomplishments

- `preHireVacationCorrectionService.ts` stellt `buildPreHireCorrectionPlan()` (reine Leselogik mit vierstufiger Eignungsprüfung: Konto vorhanden, Pro-rata-Anspruch erwartungsgemäß 0, keine eigenen Bewegungen, Journal deckt sich mit gebuchtem Anspruch, noch nicht korrigiert), `applyPreHireCorrection()` (bucht `entitlement: 0` über den bereits produktiven `updateVacationBalance()`-Pfad) und `hasExistingPreHireCorrection()` (Marker-Prüfung `[BACKFILL-06-07]`) bereit — vollständig gegen synthetische Testnutzer getestet, keine echten userIds in der Kernlogik.
- `correctPreHireVacationBalances2025.ts` — CLI-Skript mit hartkodierter, freigegebener Kandidatenliste (`userId 2`, `userId 3`, Jahr 2025), Trockenlauf-Default, `--apply`-Schalter, gibt den aufgelösten Datenbankpfad als allererste Zeile aus (Lehre aus zwei gescheiterten Phase-8-Deployments).
- **Produktionslauf durchgeführt und unabhängig verifiziert** (Details siehe unten): Karin Jochems und Christine Glas' Journalsaldo 2025 ist jetzt 0, `vacation_balance` (entitlement/carryover/taken/remaining) ist für beide 0, je genau eine `correction`-Buchung mit Marker `[BACKFILL-06-07]` steht zusätzlich im Journal. Die 2026er-Konten und der Administrator-Account (userId 1) blieben unangetastet.

## Task Commits

Jeder Task wurde atomar committet:

1. **Task 1: preHireVacationCorrectionService.ts — testbare Plan-/Korrektur-/Idempotenz-Logik (TDD)** - `812be77` (test, RED) → `4659bc5` (feat, GREEN)
2. **Task 2: CLI-Skript correctPreHireVacationBalances2025.ts (Trockenlauf-Default, --apply-Schalter)** - `701e3de` (feat)
3. **Task 3: checkpoint:human-action — manueller Lauf gegen die Produktionsdatenbank** - kein Code-Commit (Datenkorrektur, kein Dateiinhalt geändert); ausgeführt und unabhängig verifiziert, siehe unten

## Files Created

- `server/src/services/preHireVacationCorrectionService.ts` - `buildPreHireCorrectionPlan()`, `applyPreHireCorrection()`, `hasExistingPreHireCorrection()`, exportierte Konstante `PRE_HIRE_CORRECTION_MARKER = '[BACKFILL-06-07]'`
- `server/src/services/preHireVacationCorrectionService.test.ts` - Regressionstests gegen synthetische Testnutzer (Korrektur eines passenden Kontos, Idempotenz, nicht passendes Konto, Kandidat ohne Konto)
- `server/src/scripts/correctPreHireVacationBalances2025.ts` - CLI-Skript, Trockenlauf-Default, `--apply`-Schalter, hartkodierte Kandidatenliste mit Begründung, warum userId 1/15 bewusst ausgeschlossen sind

## Decisions Made

- `entitlement` wird per Korrektur auf 0 gesetzt statt nur den Journalsaldo per `correction`-Buchung auszugleichen (Begründung siehe `<objective>` in `06-07-PLAN.md`: der Kontoauszug-Header würde sonst irreführend "Genommen 7/13" anzeigen).
- userId 1 (System-Administrator) und userId 15 (Test Test, weichgelöscht) bleiben unangetastet — ausdrückliche Anwenderentscheidung, beide passen nicht zum hier behandelten Fehlerbild bzw. sind ungefährdet.
- Gegenbuchung statt Löschung — bestehende Journaleinträge bleiben unverändert stehen, die Korrektur wird als zusätzliche, klar markierte Zeile ergänzt.

## Ablauf des Produktionslaufs (Task 3)

Der Anwender hat den Orchestrator ausdrücklich beauftragt, den freigegebenen, im Plan vorgeschriebenen Zwei-Stufen-Ablauf (Trockenlauf → Prüfung → `--apply`) per SSH gegen die Produktionsdatenbank auszuführen, statt ihn selbst am Terminal einzutippen.

1. **Deployment als notwendige Vorbedingung, im Plan nicht vorgesehen.** Das Skript existierte bis dahin nur lokal; Phase 6 war noch nicht auf den Server deployed. `git push origin main` (27 Commits), Deploy-Lauf `32513835044` completed/success, Health-Check ok, beide Endpunkte lieferten 401 (erwartet, unauthenticated). Erst danach war das Skript auf dem Server verfügbar.
2. **Frisches Backup vor dem Schreiben.** `/home/ubuntu/databases/backups/production.PRE-06-07_20260821_184143.db`, erstellt per `VACUUM INTO` — bewusst kein einfaches `cp`, da die WAL-Datei zu diesem Zeitpunkt 1,1 MB groß war und ein Datei-Kopiervorgang die jüngsten, noch nicht in die Haupt-DB geschriebenen Transaktionen verloren hätte. `integrity_check: ok`, 20 Nutzer, 57 Journalzeilen zum Zeitpunkt des Backups. Das zuvor jüngste Backup war zwei Tage alt.
3. **Trockenlauf gegen Produktion.** Korrekter Datenbankpfad als erste Ausgabezeile, genau zwei Kandidaten gemeldet, beide `eligible: true` (Karin Jochem 7 → 0, Christine Glas 13 → 0), kein dritter Kandidat.
4. **`--apply`-Lauf.** Journalsaldo Karin 7 → 0, Christine 13 → 0. Der im Skript integrierte Konsistenzprüfer meldete je 0 Fehler / 0 Warnungen / 0 Hinweise; `integrity_check: ok`.
5. **Unabhängige Kontrolle direkt gegen die Produktionsdatenbank** (nicht nur die Skriptausgabe geglaubt):
   - Journalsaldo 2025 für beide Nutzer: 0
   - `vacation_balance` 2025: `entitlement`, `carryover`, `taken`, `remaining` je 0 bei beiden
   - Je genau eine `correction`-Buchung mit Marker `[BACKFILL-06-07]` und lesbarer Begründung im Beschreibungstext
   - **2026er-Konten unangetastet:** Karin Anspruch 7 / verbleibend 7, Christine 13 / genommen 13 / verbleibend 0
   - **Administrator (userId 1) 2025 unangetastet:** 30 Tage — ausdrückliche Anwenderentscheidung
   - Journalzeilen 57 → 59, exakt zwei dazugekommen; Nutzerzahl unverändert bei 20

## Rückgängig-Machbarkeit

Der Anwender hat ausdrücklich danach gefragt, daher hier festgehalten:

- **Vollständig, per Backup:** `/home/ubuntu/databases/backups/production.PRE-06-07_20260821_184143.db` enthält den exakten Stand unmittelbar vor dem Korrekturlauf.
- **Gezielt, per Gegenbuchung:** `updateVacationBalance()` für beide Konten mit `entitlement` zurück auf den ursprünglichen Wert (Karin 7, Christine 13) aufrufen. Das erzeugt eine weitere, sichtbare Journalzeile statt die Korrekturbuchung zu löschen — die Kontohistorie bleibt lückenlos nachvollziehbar, statt getilgt zu werden.

## Deviations from Plan

### Auto-fixed Issues

Keine — Task 1 und Task 2 wurden wie geplant umgesetzt (TDD RED/GREEN, Skript-Trockenlauf gegen die Entwicklungsdatenbank exakt wie in den `acceptance_criteria` beschrieben).

### Sonstige Abweichungen (kein Rule-1/2/3-Autofix, dokumentationspflichtig)

**1. Ausführungsweg des Checkpoints**
- **Was:** Der Plan sah vor, dass ein Mensch den `checkpoint:human-action` (Task 3) selbst am Terminal ausführt. Tatsächlich hat der Anwender den Orchestrator beauftragt, dies per SSH in seinem Auftrag zu tun.
- **Warum unkritisch:** Der im Plan vorgeschriebene Zwei-Stufen-Gedanke (Trockenlauf, Prüfung gegen die Erwartung, erst danach `--apply`) und die Aufrufform mit explizitem `DATABASE_PATH` wurden unverändert eingehalten. Der `<success_criteria>`-Punkt "Die tatsächliche Ausführung gegen die Produktionsdatenbank erfolgte manuell durch einen Menschen, nicht automatisiert durch einen Ausführungsagenten" ist damit nicht wörtlich erfüllt — die Ausführung war menschlich beauftragt, aber vom Orchestrator maschinell ausgeführt. Der Anwender war über den gesamten Ablauf informiert und hat ihn angefordert.

**2. Deployment als ungeplante Vorbedingung**
- **Was:** Das Skript existierte nur lokal; Phase 6 war nicht auf dem Server deployed. Ein `git push origin main` (27 Commits) war vor dem Produktionslauf nötig.
- **Warum unkritisch:** Reines Vorziehen eines ohnehin nötigen, bereits etablierten Deployment-Workflows (nicht Teil dieses Plans, keine Code-Änderung an den Dateien dieses Plans). Für künftige Datenkorrekturpläne sollte das Deployment als explizite Vorbedingung im Plan mitgeführt werden.

**3. Nebenbeobachtung, kein Fehler**
- Das Laden des Datenbankmoduls stößt beim Skriptstart die Schema-Initialisierung an (Konsolenausgabe "All 14 tables created"). Idempotent und folgenlos, überdeckt aber die eigentliche Skriptausgabe — ein `grep -v` war zur Lesbarkeit nötig. Erwähnenswert für künftige Skripte, kein Fix nötig.

---

**Total deviations:** 0 Autofixes; 2 dokumentationspflichtige Abweichungen im Ausführungsweg (siehe oben), 1 Nebenbeobachtung.
**Impact on plan:** Kein Scope Creep, keine Codeänderung außerhalb des Geplanten. Die Datenkorrektur selbst entspricht exakt der geplanten und freigegebenen Vorgehensweise.

## Issues Encountered

None über die oben dokumentierten Abweichungen hinaus.

## User Setup Required

None mehr offen — der einzige `user_setup`-Punkt aus der Plan-Frontmatter (manueller Produktionslauf) ist mit Task 3 erledigt.

## Next Phase Readiness

- Beide realen 2025er-Datenartefakte sind korrigiert; kein bekanntes fehlerhaftes Bestandskonto mehr offen, das auf den in 06-04 behobenen Pro-rata-Fehler zurückgeht.
- Phase 06 hat jetzt 7 Pläne (06-01 bis 06-03 aus dem ersten Durchlauf, 06-04 bis 06-07 als Lückenschluss). Der Phasenstatus bleibt bewusst auf "Gaps Found, Lückenschluss ausgeführt" — die abschließende Verifikation (erneuter Abgleich gegen `06-VERIFICATION.md`) steht noch aus und entscheidet über "Complete".
- Die offene Frage zu userId 1s 2025er-Anspruch (voller Wert statt pro rata, da Eintritt tatsächlich in 2025 liegt) bleibt eine separate, unbeantwortete Anwenderentscheidung — nicht Teil dieses Plans.

---
*Phase: 06-buchungen-bei-jedem-vorgang*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: server/src/services/preHireVacationCorrectionService.ts
- FOUND: server/src/services/preHireVacationCorrectionService.test.ts
- FOUND: server/src/scripts/correctPreHireVacationBalances2025.ts
- FOUND: commit 812be77 (Task 1, RED)
- FOUND: commit 4659bc5 (Task 1, GREEN)
- FOUND: commit 701e3de (Task 2)
