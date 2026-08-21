---
title: Historisierte Arbeitszeitmodelle — Design-Entscheidungen
date: 2026-08-21
context: /gsd:explore Session vor dem Zuschnitt von Milestone 3
status: Entscheidungsgrundlage — noch nicht umgesetzt
---

# Historisierte Arbeitszeitmodelle

## Problem

`users.weeklyHours` (`server/src/database/schema.ts:43`) und `users.workSchedule`
(`schema.ts:79`) sind flache Felder ohne Historie. `getDailyTargetHours(user, datum)`
bekommt das Datum zwar übergeben, löst die Sollstunden aber aus dem *heutigen*
User-Objekt auf.

Folge: Sobald jemand von 40 auf 20 Wochenstunden gestellt wird und irgendein Rebuild
läuft (`overtimeTransactionRebuildService`, `refreshOvertimeBalances`,
`recalculateOvertimeBalances`), wird die komplette Vergangenheit mit den neuen Stunden
nachgerechnet und die Überstunden verschieben sich rückwirkend.

Das passiert heute schon still — es braucht niemanden, der es absichtlich auslöst.

**Anlass:** Ein konkreter Fall steht an (Stand 21.08.2026).

## Entscheidungen

### 1. Periode statt Feld

Neue Tabelle `user_work_periods` mit `validFrom` / `validTo`, darin `weeklyHours` **und**
`workSchedule`. Die beiden müssen zwingend zusammen historisiert werden — sonst entsteht
eine Kombination aus alter Wochenstundenzahl und neuem Tagesplan, die es nie gab.

`getDailyTargetHours(user, datum)` löst über das Datum die passende Periode auf.

Migration trägt den Ist-Zustand als eine Periode ab `hireDate` ein. Tag 1 ändert sich
damit nichts — dasselbe Muster wie Phase 5 (`vacation_transactions`): erst Fundament
ohne Verhaltensänderung, dann Umstellung.

### 2. Der Überstundensaldo bleibt unangetastet

Stunden bleiben Stunden. 10 angesparte Überstunden bleiben 10 Überstunden — sie sind
nach einer Reduzierung auf Teilzeit nur mehr Freizeit wert (vorher 1,25 Arbeitstage,
danach 2,5).

**Warum:** Das ist der übliche und rechtlich unkritische Weg. Vor allem nimmt es dem
Vorhaben die Sprengkraft — es gibt keine Saldo-Umrechnung, nur eine datumsabhängige
Soll-Auflösung. Alternativen (vorher auszahlen, in Tage umrechnen) wurden verworfen.

### 3. Zwei getrennte Aktionen, kein Schalter

Ursprünglich als eine Funktion mit Checkbox "Vergangenheit auch umrechnen?" gedacht.
Dahinter stecken aber zwei fachlich verschiedene Vorgänge:

**Stundenwechsel ab Datum** (Normalfall)
Der Vertrag ändert sich zu einem Stichtag. Das Datum darf in der Vergangenheit liegen —
Vertrag gilt seit 01.07., eingetragen wird im September. Das ist kein Sonderfall, sondern
derselbe Vorgang mit rückwärts liegendem Stichtag. Die entstehende Differenz wird als
Korrekturbuchung im Journal sichtbar.

**Stammdaten korrigieren** (Datenfehler)
Der Mitarbeiter hatte immer 20 Stunden, im System stand fälschlich 40. Hier *sollen* sich
alte Überstunden ändern, weil der bisherige Saldo schlicht falsch war. Mit Warnung und
Pflichtbegründung.

Verschiedene Namen, verschiedene Warnstufen. Ehrlicher als eine Checkbox.

### 4. Rückgängig braucht keinen eigenen Mechanismus

Die Periode *ist* der Undo-Mechanismus: ein Datensatz, der bearbeitet oder gelöscht
werden kann, danach wird ab dessen Start neu gerechnet. Kein Snapshot-Undo.

Abgedeckte Fälle: Eingabefehler (falsches Datum/falsche Stunden), Sicherheitsnetz vor dem
Klick, hinfällig gewordene Umstellung (Mitarbeiter bleibt doch bei 40h).

Die daraus entstandenen Korrekturbuchungen werden **storniert, nicht gelöscht** — dasselbe
Prinzip wie beim Urlaubsstorno aus Milestone 2.

Zusätzlich: **Vorschau vor dem Speichern.** "Diese Umstellung ändert die Überstunden von
+57:30 auf +12:00" — bevor bestätigt wird.

### 5. Kein harter Termin

Weil der rückwirkende Stichtag existiert, kann sauber gebaut und der Wechsel danach mit
dem korrekten Datum nachgetragen werden. Die Zahlen kommen richtig heraus, unabhängig
davon, wann eingetragen wird. Das nimmt den Zeitdruck vollständig raus.

## Explizit außerhalb des Scopes

**Urlaubstage** (`vacationDaysPerYear`, `schema.ts:44`) werden **nicht** mit historisiert.
Siehe `.planning/seeds/urlaubsanspruch-teilzeitwechsel.md`.

## Aufrufer-Inventar (Stand 21.08.2026)

Die gute Nachricht: **`getDailyTargetHours()` in `server/src/utils/workingDays.ts:63` ist
der einzige Angelpunkt.** Die Signatur enthält das Datum bereits, und die Funktion macht
schon einen DB-Zugriff (`holidays`, Zeile 67) — ein zweiter Lookup für die Periode ist
architektonisch kein Fremdkörper.

Offene Frage beim Umbau: Perioden ins User-Objekt vorladen oder Lookup innerhalb der
Funktion? Ersteres ist schneller, letzteres sicherer gegen vergessene Aufrufer.

**Server — Services (7):**
- `services/overtimeService.ts` (Zeilen 110, 198, 320, 360, 564, 847, 1323) — Legacy
- `services/unifiedOvertimeService.ts` (115)
- `services/overtimeLiveCalculationService.ts` (181, 250, 301, 395)
- `services/overtimeTransactionRebuildService.ts` (250)
- `services/absenceService.ts` (1194)
- `services/exportService.ts` (98) — DATEV-Export
- `utils/workingDays.ts` (336, in `countWorkingHoursForUser`)

**Server — Skripte (3):**
- `scripts/migrateOvertimeToTransactions.ts` (131)
- `scripts/validateAllTestUsers.ts` (73, 107)
- `scripts/validateOvertimeDetailed.ts` (416, 570, 618) — das Validierungswerkzeug aus
  CLAUDE.md muss periodenbewusst werden, sonst validiert es gegen den falschen Maßstab

**Desktop (13 Dateien lesen `weeklyHours`/`workSchedule`):**
`components/users/EditUserModal.tsx`, `CreateUserModal.tsx`, `WorkScheduleEditor.tsx`,
`components/worktime/WorkScheduleDisplay.tsx`, `components/absences/AbsenceRequestForm.tsx`,
`components/dashboard/AdminDashboard.tsx`, `components/reports/AbsencesBreakdown.tsx`,
`hooks/useUsers.ts`, `hooks/useWorkTimeAccounts.ts`, `pages/UserManagementPage.tsx`,
`types/index.ts`, `utils/timeUtils.ts`, `test/overtimeCalculation.test.ts`

Zusätzlich lesen `services/workTimeAccountService.ts` (Zeilen 60, 110, 401) und diverse
Routen `weeklyHours` direkt aus `users`.

## Vorgeschaltetes Risiko: zwei Berechnungswege

`OVERTIME_ARCHITECTURE.md` steht auf 🔴 und beschreibt zwei parallele Überstundensysteme.
Beide sind noch im Code: `overtimeService.ts` (Legacy, monatliche Aggregation, importiert
inzwischen teilweise den unified Service) und `unifiedOvertimeService.ts`. Die eigene
CLAUDE.md warnt unter "DUAL CALCULATION SYSTEM (CRITICAL!)" davor.

Wird die Historisierung nur in einen der beiden Wege eingebaut, driften die Zahlen wieder
auseinander — diesmal mit Historie und damit schwerer aufzufinden.

**Konsequenz für den Zuschnitt:** Legacy-Pfad stilllegen bzw. Konsolidierung abschließen
gehört als erste Phase in den Milestone, nicht als Todo daneben.

## Offener Randfall

Stichtag mitten im Monat — die Legacy-Tabelle `overtime_balance` aggregiert pro Monat
(`month TEXT (YYYY-MM)`). Ein Wechsel zum 15. eines Monats hat dort keinen sauberen
Platz. Weiteres Argument dafür, den Legacy-Pfad zuerst stillzulegen.

## Nächster Schritt

`/gsd:new-milestone` — Milestone 3. Diese Note ist die Grundlage.
