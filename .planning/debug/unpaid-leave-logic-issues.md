# Unbezahlter Urlaub - Gefundene Probleme

**Datum:** 2026-04-17
**Status:** Analysiert, noch nicht gefixt

## Problem #1 - MITTEL: updateAbsenceRequest ohne workSchedule

**Datei:** `server/src/services/absenceService.ts:683-686`

Beim Update einer Abwesenheit wird `calculateBusinessDays()` verwendet **ohne workSchedule**.
Der Erstellungspfad (`createAbsenceRequest`) verwendet korrekt `countWorkingDaysForUser(..., workSchedule, ...)`,
aber der Update-Pfad nicht.

**Auswirkung:** Das `days`-Feld in `absence_requests` wird bei Mitarbeitern mit individuellem Stundenplan
(z.B. Mittwoch = 0h) falsch berechnet, wenn eine Abwesenheit *aktualisiert* wird.
Die eigentliche Überstundenberechnung ist nicht betroffen (läuft tageweise über `getDailyTargetHours()`).

---

## Problem #2 - NIEDRIG: Falscher Kommentar zu Holiday-Handling

**Datei:** `server/src/services/absenceService.ts:465-469` + `server/src/utils/workingDays.ts:219`

Kommentar sagt `"INCLUDES holidays (user can be sick on holidays)"` für unpaid/sick,
aber `dbInstance=undefined` führt trotzdem zu Holiday-Lookup via `db`-Fallback in `getPublicHolidays()`.
Kommentar und Verhalten widersprechen sich.

**Auswirkung:** Unbezahlter Urlaub schließt Feiertage doch aus — das `days`-Feld ist kleiner als erwartet.

---

## Problem #3 - NIEDRIG: Toter Code in calculateRunningBalanceAfterAbsence

**Datei:** `server/src/services/overtimeTransactionRebuildService.ts:349`

Ternärer Ausdruck gibt immer dasselbe zurück:
```typescript
const creditChange = (absenceType === 'unpaid') ? targetHours : targetHours;
```

**Auswirkung:** Zufällig korrekt — aber der Code ist irreführend und signalisiert eine Fallunterscheidung
die nicht existiert.

---

## Problem #4 - LATENT: getDayName Timezone-Bug

**Datei:** `server/src/utils/workingDays.ts:33`

```typescript
const d = typeof date === 'string' ? new Date(date) : date;
return DAY_NAMES[d.getDay()];
```

`new Date("2026-01-05")` erstellt UTC-Mitternacht. Bei Sommer-/Winterzeit-Grenze könnte
`getDay()` den falschen Wochentag liefern.

**Auswirkung:** Sporadisch falscher Wochentag bei DST-Umstellung (März/Oktober).
Betrifft workSchedule-Lookup → falsche Soll-Stunden für einen Tag.

---

## Problem #5 - INFO: 'special' Typ nicht im Schema-CHECK

**Datei:** `server/src/database/schema.ts:189`

Schema CHECK-Constraint erlaubt `'special'` nicht, aber Services verarbeiten diesen Typ.

---

## Problem #6 - INFO: Live-Transactions zeigen hours=0

**Datei:** `server/src/services/overtimeLiveCalculationService.ts:339`

`unpaid_deduction`-Transaktionen zeigen immer `hours=0` — fehlende Transparenz in der UI.
