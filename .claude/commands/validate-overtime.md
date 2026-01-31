# Validate Overtime Calculation

Du bist ein Überstunden-Validierungs-Experte. Deine Aufgabe ist es, die Überstunden-Berechnung eines Users detailliert zu validieren und eventuelle Diskrepanzen zu identifizieren.

## Vorgehen

1. **User-ID ermitteln:**
   - Wenn User-ID als Argument übergeben wurde (z.B. `/validate-overtime 3`), nutze diese
   - Ansonsten frage den User nach der User-ID

2. **Zeitraum klären:**
   - Frage ob aktueller Monat oder anderer Zeitraum validiert werden soll
   - Format: `YYYY-MM` (z.B. `2026-01`)

3. **Validation Script ausführen:**
   ```bash
   cd server
   npm run validate:overtime:detailed -- --userId=<ID> --month=<YYYY-MM>
   ```

4. **Output analysieren:**
   - Prüfe ALLE Sections:
     - USER INFORMATION (workSchedule!)
     - CALCULATION PERIOD
     - HOLIDAYS (vor allem Bayern-spezifische!)
     - DAY-BY-DAY BREAKDOWN (Tabelle durchgehen)
     - ABSENCES (Gutschrift-Berechnung korrekt?)
     - TIME ENTRIES
     - CALCULATION (Soll vs. Ist vs. Überstunden)
     - DATABASE COMPARISON (Diskrepanzen?)

5. **Ergebnis zusammenfassen:**
   - Sind die berechneten Überstunden korrekt?
   - Gibt es Diskrepanzen zwischen Expected und DB?
   - Falls Diskrepanz: Welcher Faktor verursacht sie?

## Häufige Fehlerquellen

Prüfe BESONDERS auf diese Issues (aus Production Experience):

### 1. workSchedule wird ignoriert
- **Problem:** weeklyHours wird genutzt obwohl workSchedule existiert
- **Check:** Wenn workSchedule existiert → weeklyHours MUSS ignoriert werden!
- **Beispiel:** Christine hat workSchedule {monday: 4, tuesday: 4} → Nur 2 Tage/Woche arbeitet sie!

### 2. Feiertag wird übersehen
- **Problem:** Bayern-spezifische Feiertage nicht berücksichtigt
- **Check:** Heilige Drei Könige (06.01), Fronleichnam, etc.
- **Beispiel:** 06.01 ist in Bayern Feiertag → Auch wenn es ein workSchedule-Tag ist!

### 3. Feiertag überschreibt workSchedule nicht
- **Problem:** Feiertag wird geprüft, aber workSchedule-Stunden bleiben
- **Check:** Feiertag MUSS workSchedule-Tag auf 0h setzen!
- **Beispiel:** workSchedule.tuesday=4h + 06.01 (Di) = Feiertag → 0h, NICHT 4h!

### 4. Urlaub zählt Feiertag als Urlaubstag
- **Problem:** Feiertage innerhalb Urlaubsperiode werden als Urlaubstage gezählt
- **Check:** Nur ARBEITSTAGE (keine Wochenenden, keine Feiertage) zählen!
- **Beispiel:** Urlaub 01.01-10.01 mit Feiertag 06.01 → Nur Arbeitstage zählen!

### 5. Unbezahlter Urlaub gibt Gutschrift
- **Problem:** `unpaid` Absence wird wie `vacation` behandelt
- **Check:** unpaid REDUZIERT Soll, gibt KEINE Ist-Gutschrift!

### 6. Wochenende in workSchedule nicht beachtet
- **Problem:** Samstag/Sonntag werden als Arbeitstage gezählt
- **Check:** Nur wenn workSchedule.saturday > 0 oder workSchedule.sunday > 0!

## Empfohlene Actions bei Diskrepanz

Falls Database-Werte nicht mit Expected-Werten übereinstimmen:

1. **Root Cause identifizieren:**
   - Durchgehe DAY-BY-DAY Breakdown Zeile für Zeile
   - Vergleiche mit Database overtime_balance
   - Welcher Tag/Faktor verursacht die Differenz?

2. **Recalculation empfehlen:**
   ```bash
   # Backend Service muss overtime_balance neu berechnen
   # (Hinweis für User: Recalculation-Endpoint triggern)
   ```

3. **Test hinzufügen:**
   - Wenn neuer Edge Case gefunden: Test in workingDays.test.ts hinzufügen
   - Verhindert, dass dieser Fehler wieder auftritt

4. **Documentation aktualisieren:**
   - Falls neue Fehlerquelle: In CLAUDE.md dokumentieren
   - Hilft zukünftig bei ähnlichen Problemen

## Output Format

Präsentiere die Ergebnisse strukturiert:

```
🔍 ÜBERSTUNDEN-VALIDIERUNG: [User Name] (ID: [X])

📅 Zeitraum: [YYYY-MM-DD] bis [YYYY-MM-DD]

✅ BERECHNETE WERTE:
- Soll-Stunden: [X]h
- Ist-Stunden: [X]h
- Überstunden: [±X]h

💾 DATABASE-WERTE:
- Target: [X]h
- Actual: [X]h
- Overtime: [±X]h

✅/❌ ERGEBNIS: [Match / Diskrepanz]

[Falls Diskrepanz:]
⚠️ DISKREPANZ GEFUNDEN:
- Differenz: [X]h
- Ursache: [Erklärung]
- Empfehlung: [Action Items]

[Falls Match:]
✅ Alle Werte stimmen überein! Überstunden korrekt berechnet.
```

## Beispiel-Ablauf

```
User: /validate-overtime 3

Claude: Ich validiere die Überstunden für User ID 3.
        Welchen Zeitraum möchtest du prüfen?

User: Aktueller Monat

Claude: [Führt Script aus...]

Claude: 🔍 ÜBERSTUNDEN-VALIDIERUNG: Christine Glas (ID: 3)

📅 Zeitraum: 2026-01-01 bis 2026-01-15

✅ BERECHNETE WERTE:
- Soll-Stunden: 12h (3 Arbeitstage: Mo 05.01, Mo 12.01, Di 13.01)
- Ist-Stunden: 12h (0h gearbeitet + 12h Urlaubs-Gutschrift)
- Überstunden: 0h

💾 DATABASE-WERTE:
- Target: 12h ✅
- Actual: 12h ✅
- Overtime: 0h ✅

✅ ERGEBNIS: Perfect Match!

Alle Werte stimmen überein! Die Überstunden sind korrekt berechnet.

📊 WICHTIGE FAKTOREN:
- Christine arbeitet nur Mo+Di (workSchedule: {monday: 4h, tuesday: 4h})
- 06.01 (Dienstag) ist Heilige Drei Könige (Feiertag in Bayern)
  → 0h statt 4h, obwohl Dienstag ein workSchedule-Tag ist
- Urlaub 01.01-25.01 gibt Gutschrift für 3 Arbeitstage (NICHT 4!)
- Keine Zeit-Einträge im Zeitraum
```

## Checkliste

Vor Abschluss der Validierung ALLE Punkte prüfen:

☐ User-ID korrekt?
☐ Zeitraum klar definiert?
☐ Script erfolgreich ausgeführt?
☐ workSchedule berücksichtigt? (falls vorhanden)
☐ Alle Feiertage identifiziert? (besonders Bayern-spezifische!)
☐ DAY-BY-DAY Breakdown plausibel?
☐ Absences korrekt kategorisiert? (credits vs. reductions)
☐ Database-Vergleich durchgeführt?
☐ Diskrepanzen erklärt? (falls vorhanden)
☐ Empfehlungen gegeben? (falls nötig)
