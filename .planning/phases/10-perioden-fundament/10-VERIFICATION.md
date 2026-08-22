---
phase: 10-perioden-fundament
verified: 2026-08-22T06:30:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Human-UAT der Phase 10 (Migration/DB-Grundlage) am Milestone-Ende bündeln"
    expected: "Kein sichtbares Verhalten zu prüfen — Phase 10 fügt keine UI/API hinzu, die ein Mensch bedienen könnte. Aufnahme in die gebündelte End-of-Milestone-UAT ist reine Formalität, keine inhaltliche Lücke dieser Phase."
    why_human: "Anwenderanordnung: alle UAT-Punkte gebündelt am Milestone-Ende (10-CONTEXT.md, <deferred>). Programmatisch bereits vollständig durch Nullwirkungs-Nachweis auf einer Datenkopie belegt."
---

# Phase 10: Perioden-Fundament Verification Report

**Phase Goal:** Die Perioden-Tabelle existiert, ist migriert und beschreibbar — ohne dass sich
am Verhalten des Systems etwas ändert.
**Verified:** 2026-08-22T06:30:00Z
**Status:** human_needed (alle automatisierten Prüfungen bestanden; einziger offener Punkt ist
die vom Anwender bewusst ans Milestone-Ende verschobene UAT-Bündelung — keine inhaltliche
Lücke)
**Re-verification:** Nein — Erstprüfung (Fortsetzung eines wegen API-Limit abgebrochenen
Laufs; Kriterium 1 wurde vom Vorlauf bereits reproduziert und hier übernommen)

## Goal Achievement

### Observable Truths (ROADMAP-Erfolgskriterien)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration läuft auf einer Kopie der Produktionsdatenbank fehlerfrei durch, `integrity_check: ok` | VERIFIED | Vom Vorlauf dieser Prüfung selbst reproduziert: `migrate:copy` gegen `10-nullwirkung.db` → Exit 0, `integrity_check: ok`, `foreign_key_check` leer, `user_work_periods: 20 Zeilen`. Wörtlich dokumentiert in `10-NULLWIRKUNG-NACHWEIS.md` Schritt 4, mit vollständiger Konsolen-Ausgabe (nicht nur Behauptung). |
| 2 | Jeder aktive Nutzer hat genau eine Periode, deren Werte den heutigen Stammdaten entsprechen | VERIFIED | `10-NULLWIRKUNG-NACHWEIS.md` Schritt 7: „Nutzer ohne Periode: 0", „Nutzer mit mehr als einer Periode: 0", JOIN-Abweichungsprüfung (`weeklyHours`, `workSchedule` per `IS`-Vergleich, `validTo IS NOT NULL`) liefert 0 abweichende Zeilen bei 20/20 Nutzern. Feinheit erfüllt: 20 von 20 (inkl. der 2 soft-gelöschten, D5 verlangt das ausdrücklich zusätzlich zu „aktiv") — Migrationsprotokoll `note`-Spalte bestätigt 20× `[MIGRATION-009] Bestandsüberführung, Quelle: hireDate`. |
| 3 | Ein Überlappungsversuch wird von der Datenbank abgewiesen, nicht erst von der Oberfläche | VERIFIED | `10-NULLWIRKUNG-NACHWEIS.md` Schritt 7: direkter `INSERT` gegen `userId=1` (echter Nutzer, bestehende offene Periode ab 2025-11-13) wird mit der Trigger-Meldung `user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers` abgewiesen — der Riegel sitzt im `BEFORE INSERT`-Trigger der Migration (`server/src/database/migrations/008_create_user_work_periods.ts`), nicht in einer Service- oder UI-Schicht. Zusätzlich 19 automatisierte Verhaltensmatrix-Testfälle in `userWorkPeriods.constraints.test.ts` (Teil der 81 grün gelaufenen Tests, siehe unten). |
| 4 | Bestehendes Verhalten unverändert — noch liest keine Berechnung aus den Perioden | VERIFIED | Byte-für-Byte-Vergleich `10-SNAPSHOT-VORHER.users.json` vs. `10-SNAPSHOT-NACHHER.users.json` (`cmp` → IDENTISCH, je 44785 Bytes, 20 Nutzer) belegt die Zahlengleichheit. Zusätzlich per grep bestätigt: `workPeriodService`/`resolveWorkPeriodAt`/`user_work_periods`/`UserWorkPeriod` tauchen in `server/src` ausschließlich in den Phase-10-eigenen Dateien auf (Migrationen, Service, Tests, Schema-Spiegel, Typen, die beiden Standalone-CLI-Werkzeuge `snapshotBalances.ts`/`applyMigrationsToCopy.ts`) — kein Controller, keine Route, kein `overtimeService`/`unifiedOvertimeService` importiert oder liest davon. `desktop/src`: 0 Treffer. `users.weeklyHours`/`users.workSchedule` werden von Migration 008/009 nachweislich nicht verändert (kein `ALTER TABLE users`, kein `UPDATE users` — grep negativ, Migrationsquelltext liest `users` nur lesend). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/database/migrations/008_create_user_work_periods.ts` | Tabelle, Indizes, 3 Trigger, Selbstverifikation | VERIFIED | 9 Spalten, 2 benannte + 1 impliziter Index, 3 Trigger, wirft bei fehlender Selbstverifikation statt still zu buchen. Reines `CREATE ... IF NOT EXISTS`, kein Eingriff auf `users`. |
| `server/src/database/migrations/009_backfill_user_work_periods.ts` | Bestandsüberführung ab `hireDate`, idempotent, Selbstverifikation | VERIFIED | `resolveValidFrom`-Kette (hireDate → frühester time_entry → `FALLBACK_PROJECT_START`), JOIN-Selbstverifikation gegen `users`, Idempotenz-Vorabprüfung je Nutzer. Liest `users`, schreibt nicht hinein (grep-bestätigt). |
| `server/src/database/schema.ts` (Spiegel) | DDL identisch zur Migration 008 | VERIFIED | Block ab Zeile 258 enthält wortgleiche `CREATE TABLE`/Trigger-Statements; zusätzlich maschinell abgesichert durch `schemaMigrationParity.test.ts` (grün). |
| `server/src/services/workPeriodService.ts` | Periode lesen/schreiben/zum Datum auflösen | VERIFIED | 358 Zeilen, `resolveWorkPeriodAt`, `getWorkPeriods`, `getCurrentWorkPeriod`, `createWorkPeriod`, `closeWorkPeriod`, `checkPeriodChain`, `WorkPeriodConflictError`. Kein Platzhalter, kein Stub-Return. Von niemandem außerhalb der eigenen Tests importiert (grep-bestätigt) — planmäßig „noch ohne Aufrufer". |
| `server/src/scripts/snapshotBalances.ts` | Salden-Snapshot-Werkzeug (Nutzer/Liste/alle) | VERIFIED | 450 Zeilen, `--user`/`--users`/`--all`, mit realer Ausgabe in `10-NULLWIRKUNG-NACHWEIS.md` belegt, nicht nur behauptet. |
| `server/src/scripts/applyMigrationsToCopy.ts` + `npm run migrate:copy` | Migrationslauf gegen Kopie, mit Guard | VERIFIED | 221 Zeilen; `productionGuard.ts` (62 Zeilen, `assertNotProduction`) wird synchron vor jedem Import eines schreibenden Moduls aufgerufen. |
| `server/src/database/userWorkPeriods.constraints.test.ts` | Verhaltensmatrix der DB-Riegel | VERIFIED | 19 Testfälle, Teil der grün gelaufenen Suite. |

### Data-Flow Trace (Level 4)

Nicht anwendbar im klassischen Sinn (keine UI/API rendert hier Daten) — die relevante
Level-4-Frage für diese Phase ist umgekehrt: **fließt NICHTS in bestehende Berechnungen.**
Das wurde oben unter Truth 4 per grep über `server/src` und `desktop/src` verifiziert:
`user_work_periods`/`workPeriodService` werden von keinem Lesepfad außerhalb der Phase-10-
eigenen Dateien referenziert.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REQ-20 | 10-01, 10-02, 10-03, 10-04, 10-05 | Tabelle `user_work_periods`, `weeklyHours`/`workSchedule` gemeinsam versioniert | SATISFIED | Migration 008 (Spalten, gemeinsames Schreiben in 009), Service-Schicht schreibt beide Felder nur gemeinsam. |
| REQ-21 | 10-03, 10-05 | Migration ohne Verhaltensänderung, Zahlen unverändert | SATISFIED | Byte-identischer Snapshot-Vergleich (Schritt 6, Nullwirkungs-Nachweis); D4 mechanisch erzwungen (kein Schreibzugriff auf `users`). |
| REQ-22 | 10-01, 10-02, 10-04 | Keine Überlappung, keine Lücke, DB-seitig erzwungen | SATISFIED | 3 Trigger + partieller UNIQUE-Index in Migration 008; 19 Verhaltensmatrix-Tests; direkter INSERT-Abweisungsbeleg auf echten Daten. |

Keine verwaisten Requirements — REQUIREMENTS.md ordnet REQ-20/21/22 ausschließlich Phase 10
zu, alle drei sind in mindestens einem Plan deklariert.

### Anti-Patterns Found

Keine Blocker. Grep über alle Phase-10-Kerndateien (`workPeriodService.ts`, Migrationen 008/009,
`snapshotBalances.ts`, `applyMigrationsToCopy.ts`, `productionGuard.ts`) nach
`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon`: **0 Treffer.**
Kein unreferenzierter Debt-Marker.

### Testsuite

Gezielter Lauf der 5 Phase-10-Testdateien (`008_create_user_work_periods.test.ts`,
`009_backfill_user_work_periods.test.ts`, `userWorkPeriods.constraints.test.ts`,
`schemaMigrationParity.test.ts`, `workPeriodService.test.ts`): **5 Dateien, 81 Tests, alle
grün**, inklusive der D7-Idempotenz-Testfälle (`zweiter Lauf (idempotent, D7)`,
`Idempotenz bei bereits vorhandener, manuell eingefügter Periode (D7)`).

Gesamttestsuite: laut Auftrag bereits als 299/302 verifiziert, die 3 Fehlschläge
(`unifiedOvertimeService.test.ts` ×2, `vacationBackfillService.test.ts` ×1) unabhängig als
vorbestehend bestätigt — hier nicht erneut ausgeführt, da explizit als bereits gemessen
übergeben.

### Behavioral Spot-Checks / Probe Execution

Nicht zutreffend als eigener Schritt — der Nullwirkungs-Nachweis (`10-NULLWIRKUNG-NACHWEIS.md`)
IST der Probe-Lauf dieser Phase: reale Befehle (`migrate:copy`, `snapshot:balances`, direkter
`INSERT`-Abweisungsversuch) gegen eine echte Kopie der Produktionsdaten, mit wörtlicher
Ausgabe. Kriterium 1 wurde zusätzlich vom vorherigen Verifikationslauf selbst (nicht aus dem
Dokument übernommen) reproduziert.

### Bewertung des Nachweisdokuments

`10-NULLWIRKUNG-NACHWEIS.md` ist ein echter Nachweis, keine Behauptung: jeder Schritt zeigt
den ausgeführten Befehl und die wörtliche Konsolenausgabe (Dateigrößen, Zeilenzahlen,
`cmp`-Ergebnis, Trigger-Fehlermeldung im Original-Wortlaut). Es benennt außerdem selbst
transparent, was es NICHT abdeckt (Abschnitt „Was dieser Nachweis NICHT zeigt") — das ist ein
Qualitätsmerkmal, keine Lücke: Datenstand 20.08.2026, keine Ersetzung der Phase-14-
Generalprobe, keine Aussage über künftig angelegte Nutzer.

### Zu beachtender Befund für Phase 11/14 (kein Gap dieser Phase)

Der kanonische Überstunden-Lesepfad (`unifiedOvertimeService`, `getUser()` mit
`WHERE deletedAt IS NULL`) wirft für die 2 soft-gelöschten Nutzer (`userId` 15, 26)
`"User <id> not found"`. `snapshotBalances.ts` fängt das pro Nutzer ab und schreibt es als
`overtimeError` in den Snapshot, statt den Lauf abzubrechen — dokumentiert und transparent.

**Bewertung für die Tragfähigkeit als Abnahmegrundlage in Phase 11/14:** Ein Snapshot, in dem
2 von 20 Nutzern nur einen Fehlertext statt eines Saldos tragen, ist als Nullwirkungs-Nachweis
für **genau diese 2 Nutzer** nicht tragfähig — „byte-identisch" ist für sie trivial erfüllt,
weil auf beiden Seiten derselbe Fehlertext steht, nicht weil ein Saldo verglichen wurde. Für
die übrigen 18 Nutzer bleibt der Vergleich aussagekräftig. Das ist kein Fehler dieser Phase
(der Lesepfad-Filter existierte bereits vor Phase 10), aber Phase 11/14 sollten das nicht
stillschweigend als „getestet" für alle 20 Nutzer verbuchen. Empfehlung: In Phase 11/14 vor
der Nullwirkungs-Prüfung explizit klären, ob soft-gelöschte Nutzer aus der geforderten
Grundgesamtheit ausgenommen sind, oder den Lesepfad-Filter für die Prüfzwecke gezielt umgehen.
Dieser Punkt ist bereits im Nachweisdokument selbst offen benannt (Abschnitt „Was dieser
Nachweis NICHT zeigt") — hier bewusst erneut hervorgehoben, weil er Konsequenzen für zwei
spätere Phasen hat, nicht nur für Phase 10 selbst.

### Human Verification Required

### 1. Human-UAT der Phase 10 bündeln

**Test:** Keine gesonderte Prüfung für Phase 10 selbst nötig — Phase 10 hat keine UI und
keine API-Oberfläche; das einzige Artefakt mit Außenwirkung ist die (noch unbenutzte)
Datenbanktabelle.
**Expected:** Aufnahme in die vom Anwender angeordnete gebündelte UAT am Milestone-Ende.
**Why human:** Ausdrückliche Anwenderanordnung (10-CONTEXT.md, `<deferred>`: „Human-
Verifikation / UAT dieser Phase — auf Anweisung des Anwenders ans Ende des Milestones
gestellt"). Inhaltlich ist die Phase durch den Nullwirkungs-Nachweis bereits vollständig
belegt; dieser Punkt ist rein organisatorisch und blockiert den Fortschritt zu Phase 11 nicht.

### Gaps Summary

Keine Gaps. Alle vier ROADMAP-Erfolgskriterien sind mit wörtlicher Kommandozeilen-Evidenz
belegt (Kriterium 1 vom Vorlauf dieser Prüfung selbst reproduziert, Kriterien 2–4 aus
`10-NULLWIRKUNG-NACHWEIS.md` sowie eigenen grep-/Testläufen). REQ-20/21/22 sind vollständig
abgedeckt, keine Debt-Marker, keine Stub-Implementierungen, 81/81 phasen-eigene Tests grün.
Der Status ist `human_needed` ausschließlich wegen der vom Anwender bewusst gebündelten
End-of-Milestone-UAT — nicht wegen einer inhaltlichen Unsicherheit. Der einzige inhaltliche
Hinweis (Snapshot-Tragfähigkeit für 2 soft-gelöschte Nutzer in Phase 11/14) ist kein Gap
dieser Phase, sondern eine Weitergabe an die Planung der nächsten Phasen.

---

_Verified: 2026-08-22T06:30:00Z_
_Verifier: Claude (gsd-verifier)_
