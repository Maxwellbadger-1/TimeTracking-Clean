# Error Location Summary

## Fehlerverteilung nach Dateien:

### 1. `/server/src/scripts/validateOvertimeDetailed.ts` ❌
**Fehler:** Feiertage überschreiben Target nicht
**Zeile:** ~150-180 (Day-by-day calculation loop)
**Fix:** `if (holiday) { targetHours = 0; }` VOR den anderen Checks

### 2. `/server/src/scripts/seedTestUsers.ts` ❌
**Fehler 1:** Year-End Rollover erstellt keine Transactions
**Zeile:** ~620-650 (performYearEndRollover Funktion)
**Fix:** Tatsächlich reportService.performYearEndRollover() aufrufen

**Fehler 2:** Zu wenig 2026 Time Entries
**Zeile:** ~400-600 (User Data Section)
**Fix:** Mehr 2026 Einträge hinzufügen

### 3. `/server/src/services/reportService.ts` ❌
**Fehler:** endDate wird ignoriert
**Funktion:** `ensureOvertimeBalanceEntries()`
**Fix:** endDate check vor Loop

### 4. Desktop App (Frontend) ❌
**Fehler:** Unbekannte Berechnungslogik
**Dateien zu prüfen:**
- `/desktop/src/components/worktime/WorkTimeAccountHistory.tsx`
- `/desktop/src/hooks/useWorkTimeAccounts.ts`

---

## Welche Fehler sind KRITISCH für Test-User?

### KRITISCH für Test-User Validierung:
1. ✅ **Validation Script** - MUSS gefixt werden, sonst falsche Erwartungswerte!
2. ✅ **Seeding Script (Rollover)** - MUSS gefixt werden, sonst fehlt Carryover!

### WICHTIG aber nicht sofort kritisch:
3. ⚠️ **reportService (endDate)** - Klaus sollte keine 2026 Daten haben
4. ⚠️ **Seeding (2026 Entries)** - Mehr Daten für realistisches Testing

### UNKLAR (braucht Investigation):
5. ❓ **Frontend** - Verstehen was angezeigt wird

---

## Fix-Reihenfolge:

1. **ZUERST:** Validation Script fixen
   - Sonst zeigt das Script falsche "Expected" Werte!
   - Christine Test zeigt: DB ist richtig, Validation falsch

2. **DANN:** Seeding Script fixen
   - Year-End Rollover implementieren
   - 2026 Time Entries hinzufügen
   - Database neu seeden

3. **DANN:** Production Code fixen
   - endDate in reportService berücksichtigen

4. **DANN:** Frontend untersuchen
   - Verstehen was die Werte bedeuten
