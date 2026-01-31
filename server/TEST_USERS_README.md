# Test User Seeding System

## Overview

Dieses Dokument beschreibt das umfassende Test-User-System für die Development-Datenbank. Es erstellt 10 realistische Test-User mit vollständigen Daten für alle System-Features.

## Quick Start

```bash
# Alle Test-User erstellen (idempotent - kann mehrfach ausgeführt werden)
npm run seed:test-users

# Einzelnen User validieren
npm run validate:overtime:detailed -- --userId=49 --month=2026-01
```

## Test-User Personas

### 1. Max Vollzeit (ID: 48) - **Standard-Vollzeit**
- **Username:** `test.vollzeit` / **Password:** `test123`
- **Arbeitszeitmodell:** 40h/Woche (Mo-Fr 8h)
- **Features:**
  - Normale Zeiteinträge in 2025
  - 2 Tage Urlaub (Juli)
  - 2 Tage Krankheit (August)
  - Positive Überstunden im Dezember (+6h)
  - Überstunden-Ausgleich in 2026

**Test-Zweck:** Baseline für Standard-Vollzeit-Mitarbeiter mit typischen Abwesenheiten

---

### 2. Christine Teilzeit (ID: 49) - **Individueller Wochenplan**
- **Username:** `test.christine` / **Password:** `test123`
- **Arbeitszeitmodell:** workSchedule {monday: 4, tuesday: 4} = **NUR Mo+Di Arbeitstage!**
- **Features:**
  - Urlaub über Feiertag (06.01 = Heilige Drei Könige)
  - Nur Arbeitstage (Mo+Di) werden als Urlaubstage gezählt
  - **KRITISCHER TEST:** Feiertag an Arbeitstag (Di) = kein Urlaubstag!

**Test-Zweck:** workSchedule-Priorität, Feiertag-Logik, Teilzeit-Berechnung

---

### 3. Peter Fleißig (ID: 50) - **Positive Überstunden**
- **Username:** `test.overtime-plus` / **Password:** `test123`
- **Arbeitszeitmodell:** 40h/Woche
- **Features:**
  - Viele Überstunden (Juli: +20h, August: +20h, Dezember: +20h)
  - Gesamt: ~+60h Ende 2025
  - Carryover 2025 → 2026

**Test-Zweck:** Positive Überstunden-Akkumulation, Jahreswechsel-Carryover

---

### 4. Laura Weniger (ID: 51) - **Negative Überstunden**
- **Username:** `test.overtime-minus` / **Password:** `test123`
- **Arbeitszeitmodell:** 40h/Woche
- **Features:**
  - Wenig gearbeitet (Juli: 20h, August: 30h, Dezember: 40h)
  - Gesamt: Stark negative Überstunden Ende 2025
  - Carryover 2025 → 2026

**Test-Zweck:** Negative Überstunden-Akkumulation, Jahreswechsel-Carryover

---

### 5. Sarah Unbezahlt (ID: 52) - **Unbezahlter Urlaub**
- **Username:** `test.unpaid` / **Password:** `test123`
- **Arbeitszeitmodell:** 40h/Woche
- **Features:**
  - 2 Wochen unbezahlter Urlaub (August: 10 Arbeitstage)
  - **KRITISCH:** Reduziert target hours um 80h (10 × 8h)
  - Gibt **KEINE** Ist-Stunden-Gutschrift!

**Test-Zweck:** Unbezahlter Urlaub Logik, Target-Reduktion ohne Ist-Gutschrift

---

### 6. Tom Viertage (ID: 53) - **4-Tage-Woche**
- **Username:** `test.4day-week` / **Password:** `test123`
- **Arbeitszeitmodell:** workSchedule {monday: 10, tuesday: 10, wednesday: 10, thursday: 10}
- **Features:**
  - 4-Tage-Woche Pattern (Mo-Do 10h, Fr-So frei)
  - Urlaub = 10h pro Tag (nicht 8h!)
  - Moderne Arbeitszeit-Modell

**Test-Zweck:** Flexible Arbeitszeitmodelle, 4-Tage-Woche Logik

---

### 7. Julia Komplex (ID: 54) - **Komplexe Historie**
- **Username:** `test.complex` / **Password:** `test123`
- **Arbeitszeitmodell:** 40h/Woche
- **Features:**
  - Mehrere Abwesenheiten pro Monat (Urlaub + Krankheit + Überstunden-Ausgleich)
  - Admin-Korrektur (+5h für "vergessene Zeiterfassung")
  - Verschiedene correctionTypes

**Test-Zweck:** Mehrfache Abwesenheiten, Manuelle Korrekturen, Komplexe Szenarien

---

### 8. Nina Neuling (ID: 55) - **Neu eingestellt 2026**
- **Username:** `test.new2026` / **Password:** `test123`
- **Arbeitszeitmodell:** 40h/Woche
- **Hire Date:** 2026-01-15 (WICHTIG: Eingestellt im Januar 2026!)
- **Features:**
  - Nur 2026 Daten (keine 2025 Daten!)
  - Sollte **KEINEN** Carryover aus 2025 haben
  - Onboarding-Zeiteinträge

**Test-Zweck:** Neuer Mitarbeiter ohne Historie, kein Jahreswechsel

---

### 9. Klaus Ausgeschieden (ID: 56) - **Gekündigter Mitarbeiter**
- **Username:** `test.terminated` / **Password:** `test123`
- **Arbeitszeitmodell:** 40h/Woche
- **End Date:** 2025-12-31 (WICHTIG: Gekündigt Ende 2025!)
- **Status:** inactive
- **Features:**
  - Letzter Arbeitstag: 2025-12-23
  - Jahreswechsel durchgeführt (Carryover existiert)
  - Kein 2026 vacation_balance Eintrag

**Test-Zweck:** Beendete Mitarbeiter, endDate Logik, Status inactive

---

### 10. Emma Wochenende (ID: 57) - **Weekend-Worker**
- **Username:** `test.weekend` / **Password:** `test123`
- **Arbeitszeitmodell:** workSchedule {saturday: 8, sunday: 8}
- **Features:**
  - Nur Sa+So Arbeitstage!
  - Urlaub am Wochenende = Urlaubstag
  - Mo-Fr = keine Arbeitstage

**Test-Zweck:** Weekend-Worker Logik, Wochenend-Abwesenheiten

---

## Validierung

### Einzelner User

```bash
# Christine (workSchedule + Feiertag-Test)
npm run validate:overtime:detailed -- --userId=49 --month=2026-01

# Peter (Positive Überstunden)
npm run validate:overtime:detailed -- --userId=50 --month=2025-12

# Sarah (Unbezahlter Urlaub)
npm run validate:overtime:detailed -- --userId=52 --month=2025-08

# Weekend-Worker
npm run validate:overtime:detailed -- --userId=57 --month=2025-07
```

### Alle Test-User

```bash
# Liste alle Test-User
sqlite3 database/development.db "SELECT id, username, firstName, lastName FROM users WHERE username LIKE 'test.%'"
```

## Wichtige Features getestet

### ✅ Arbeitszeitmodelle
- [x] Standard 40h/Woche (User 48, 51, 52, 54, 55, 56)
- [x] Teilzeit mit workSchedule (User 49: Mo+Di 4h)
- [x] 4-Tage-Woche (User 53: Mo-Do 10h)
- [x] Weekend-Worker (User 57: Sa+So 8h)

### ✅ Abwesenheiten
- [x] Urlaub (vacation) - alle User
- [x] Krankheit (sick) - User 48, 54
- [x] Unbezahlter Urlaub (unpaid) - User 52
- [x] Überstunden-Ausgleich (overtime_comp) - User 48, 54

### ✅ Überstunden-Szenarien
- [x] Positive Überstunden - User 50 (+60h)
- [x] Negative Überstunden - User 51 (-150h)
- [x] Null Überstunden - User 49, 55

### ✅ Jahreswechsel (2025 → 2026)
- [x] Carryover positiv - User 50
- [x] Carryover negativ - User 51
- [x] Kein Carryover (neu 2026) - User 55
- [x] Gekündigt (keine 2026 Daten) - User 56

### ✅ Edge Cases
- [x] Feiertag an Arbeitstag (User 49: 06.01 Di = Feiertag!)
- [x] Feiertag überschreibt workSchedule (Target = 0h)
- [x] Urlaub über Feiertag (Feiertag zählt NICHT als Urlaubstag)
- [x] workSchedule-Priorität über weeklyHours
- [x] Unbezahlter Urlaub reduziert Target (keine Ist-Gutschrift)
- [x] Manuelle Korrekturen (User 54: +5h)
- [x] Mehrfache Abwesenheiten pro Monat (User 54)

### ✅ Database-Features
- [x] vacation_balance (Urlaubssaldo pro Jahr)
- [x] overtime_balance (Monatliche Überstunden)
- [x] overtime_transactions (Transaktions-Historie)
- [x] overtime_corrections (Manuelle Korrekturen)
- [x] Year-end rollover (Jahreswechsel)

## Script-Eigenschaften

### Idempotent
- Script kann **mehrfach** ausgeführt werden
- Bestehende Test-User werden aktualisiert (UPDATE), nicht dupliziert
- Alte Daten werden gelöscht (clean re-seeding)

### Automatische Features
- Admin-User wird erstellt falls nicht vorhanden
- Überstunden-Balance wird automatisch berechnet
- Jahreswechsel 2025 → 2026 wird automatisch durchgeführt
- Vacation Balance wird initialisiert

### Logging
- Umfassendes JSON-Logging (pino)
- Jeder Schritt wird protokolliert
- Fehler werden mit Details geloggt

## Troubleshooting

### "No such column: email"
→ Datenbank-Schema veraltet. Lösung:
```bash
rm database/development.db
npm run seed:test-users
```

### "SQLITE_CONSTRAINT_CHECK" Error
→ Ungültiger Abwesenheitstyp. Erlaubt sind nur:
- `vacation`
- `sick`
- `unpaid`
- `overtime_comp`

### Überstunden-Diskrepanz
→ Normal nach Seeding. Validierung zeigt korrekte Logik.
Lösung: Overtime neu berechnen
```bash
npm run validate:overtime:detailed -- --userId=<id> --month=<YYYY-MM>
```

## Next Steps

Nach Seeding:
1. Desktop App starten
2. Als Test-User einloggen (z.B. `test.christine` / `test123`)
3. Überstunden-Verwaltung öffnen
4. Monatliche Entwicklung prüfen
5. Jahreswechsel-Preview testen (2026 → 2027)

---

**Version:** 1.0
**Created:** 2026-01-18
**Last Updated:** 2026-01-18
