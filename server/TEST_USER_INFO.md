# 🎯 TEST USER - KOMPLETTER ÜBERSTUNDEN-TESTFALL

## 🔐 Login-Daten

```
Username: test.user
Passwort: Test123!
Email: test.user@example.com
User ID: 20
```

---

## 👤 User-Stammdaten

| Feld | Wert |
|------|------|
| **Name** | Test User |
| **Hire Date** | 01.07.2025 |
| **Weekly Hours** | 8h (wird IGNORIERT!) |
| **Work Schedule** | **Nur Mo + Di** (je 4h) |
| **Arbeitstage** | Montag, Dienstag |
| **Freie Tage** | Mi, Do, Fr, Sa, So |

### 📅 Work Schedule Details
```json
{
  "monday": 4,
  "tuesday": 4,
  "wednesday": 0,
  "thursday": 0,
  "friday": 0,
  "saturday": 0,
  "sunday": 0
}
```

---

## 📝 Zeitbuchungen (8 Einträge)

| Datum | Wochentag | Stunden | Beschreibung |
|-------|-----------|---------|--------------|
| 01.07.2025 | Dienstag | 4h | Projekt Setup |
| 21.07.2025 | Montag | 4h | Development |
| 22.07.2025 | Dienstag | 4h | Testing |
| 29.07.2025 | Dienstag | **5h** | Überstunde! (1h extra) |
| 04.08.2025 | Montag | 4h | Meetings |
| 05.08.2025 | Dienstag | 4h | Code Review |
| 18.08.2025 | Montag | 4h | Sprint Planning |
| 19.08.2025 | Dienstag | 4h | Implementation |

**TOTAL WORKED: 33h**

---

## 🏖️ Abwesenheiten (4 Einträge, alle approved)

### 1. Krankheit (Sick Leave)
- **Datum:** 07.07 - 08.07.2025 (Montag + Dienstag)
- **Tage:** 2 Arbeitstage
- **Gutschrift:** +8h (2 × 4h)

### 2. Urlaub (Vacation)
- **Datum:** 14.07 - 15.07.2025 (Montag + Dienstag)
- **Tage:** 2 Arbeitstage
- **Gutschrift:** +8h (2 × 4h)

### 3. Überstundenausgleich (Overtime Comp)
- **Datum:** 28.07.2025 (Montag)
- **Tage:** 1 Arbeitstag
- **Gutschrift:** +4h

### 4. Unbezahlter Urlaub (Unpaid Leave) ⚠️
- **Datum:** 11.08 - 12.08.2025 (Montag + Dienstag)
- **Tage:** 2 Arbeitstage
- **REDUZIERT Soll-Stunden:** -8h
- **Keine Ist-Gutschrift!**

---

## 🧮 ERWARTETE BERECHNUNG (01.07.2025 - 18.01.2026)

### ✅ Soll-Stunden (Target)

| Monat | Arbeitstage | Feiertage | Unpaid | Soll-Stunden |
|-------|-------------|-----------|--------|--------------|
| **Juli 2025** | 9 (Mo+Di) | 0 | 0 | 36h |
| **August 2025** | 8 (Mo+Di) | 0 | -2 | **24h** (6 × 4h) |
| **September 2025** | 8 (Mo+Di) | 0 | 0 | 32h |
| **Oktober 2025** | 9 (Mo+Di) | 0 | 0 | 36h |
| **November 2025** | 8 (Mo+Di) | 0 | 0 | 32h |
| **Dezember 2025** | 9 (Mo+Di) | 0 | 0 | 36h |
| **Januar 2026** | 8 (Mo+Di) | -1 (06.01 = Di) | 0 | **28h** (7 × 4h) |

**GESAMT Soll-Stunden:** 36 + 24 + 32 + 36 + 32 + 36 + 28 = **224h**

> **WICHTIG:** 06.01.2026 (Dienstag) = Heilige Drei Könige (Feiertag in Bayern!)
> → workSchedule.tuesday=4h wird auf 0h gesetzt!

**KORREKTUR:** Base Target = 228h, Unpaid Reduction = 8h
**Adjusted Target = 220h**

---

### ✅ Ist-Stunden (Actual)

| Komponente | Stunden |
|------------|---------|
| Gearbeitete Stunden | 33h |
| + Krankheit | 8h |
| + Urlaub | 8h |
| + Überstundenausgleich | 4h |
| **SUMME** | **53h** |

---

### ✅ Überstunden (Overtime)

```
Ist-Stunden:  53h
Soll-Stunden: 220h
─────────────────
Überstunden:  -167h
```

**Interpretation:** User hat **167 Stunden Minus** (arbeitet deutlich weniger als Soll)

---

## 🎯 ERWARTETE WERTE IM FRONTEND

### JSON Response Format
```json
{
  "userId": 20,
  "period": "2025-07-01 bis 2026-01-18",
  "targetHours": 220,
  "actualHours": 53,
  "overtime": -167,
  "breakdown": {
    "workedHours": 33,
    "sickCredit": 8,
    "vacationCredit": 8,
    "overtimeCompCredit": 4,
    "unpaidReduction": 8
  }
}
```

---

## 🔍 KRITISCHE FAKTOREN (Checkliste für Validation)

### ✅ 1. workSchedule hat HÖCHSTE PRIORITÄT
- `weeklyHours=8` wird **IGNORIERT**
- Nur `workSchedule.monday` und `workSchedule.tuesday` zählen!

### ✅ 2. Feiertage überschreiben workSchedule
- **06.01.2026** (Dienstag) = Heilige Drei Könige
- workSchedule.tuesday=4h → **0h** (Feiertag-Override!)

### ✅ 3. Unbezahlter Urlaub reduziert Soll
- **11.08 + 12.08** = 2 Tage × 4h = **-8h Soll**
- **KEINE** Ist-Gutschrift!

### ✅ 4. Abwesenheits-Gutschriften korrekt
- Krankheit: 2 Tage × 4h = **8h** ✅
- Urlaub: 2 Tage × 4h = **8h** ✅
- Überstundenausgleich: 1 Tag × 4h = **4h** ✅

### ✅ 5. Referenz-Datum = Heute (18.01.2026)
- Berechnung läuft **BIS** 18.01.2026, **NICHT** Monatsende!

### ✅ 6. Wochenenden = KEINE Arbeitstage
- workSchedule.wednesday-sunday = **0h**
- Nur Mo+Di sind Arbeitstage!

---

## 🖥️ Frontend-Prüfung

### 1. Login
```
http://localhost:1420 (Tauri Desktop)
oder
http://localhost:3000 (Server)

Username: test.user
Passwort: Test123!
```

### 2. Erwartete Anzeige im Dashboard

#### Überstunden-Widget
```
┌─────────────────────────────────┐
│ ÜBERSTUNDEN                     │
├─────────────────────────────────┤
│ -167h                           │
│ ▼ 167 Stunden im Minus          │
└─────────────────────────────────┘
```

#### Monatsübersicht (Januar 2026)
```
Target: 28h (7 Arbeitstage, NICHT 8!)
Actual: 0h (keine Buchungen in Jan 2026)
Overtime: -28h
```

#### Breakdown
```
Gearbeitet: 33h
+ Krankheit: 8h
+ Urlaub: 8h
+ ÜA: 4h
─────────────
Ist: 53h

Soll: 220h
─────────────
Überstunden: -167h
```

---

## 🐛 Häufige Fehlerquellen

### ❌ FALSCH: weeklyHours verwenden
- Wenn `weeklyHours=8` genommen wird → **FALSCH**!
- Nur `workSchedule` beachten!

### ❌ FALSCH: Feiertag ignorieren
- 06.01.2026 (Dienstag) MUSS als Feiertag erkannt werden
- Bayern-spezifischer Feiertag!

### ❌ FALSCH: Unbezahlter Urlaub gibt Gutschrift
- Unpaid leave darf **KEINE** Ist-Gutschrift geben
- Nur Soll reduzieren!

### ❌ FALSCH: Bis Monatsende rechnen
- Berechnung MUSS bis **HEUTE** (18.01.2026) laufen
- NICHT bis 31.01.2026!

---

## 📊 SQL Queries zum Nachprüfen

### User abrufen
```sql
SELECT id, username, firstName, lastName, workSchedule, hireDate
FROM users
WHERE id = 20;
```

### Zeiteinträge
```sql
SELECT date, hours, activity, notes
FROM time_entries
WHERE userId = 20
ORDER BY date;
```

### Abwesenheiten
```sql
SELECT type, startDate, endDate, days, status
FROM absence_requests
WHERE userId = 20
ORDER BY startDate;
```

### Feiertage prüfen
```sql
SELECT date, name, federal
FROM holidays
WHERE date BETWEEN '2025-07-01' AND '2026-01-18'
  AND (federal = 1 OR federal = 0)
ORDER BY date;
```

---

## ✅ Test Checklist

- [ ] User kann sich einloggen (test.user / Test123!)
- [ ] Dashboard zeigt **-167h** Überstunden
- [ ] Monatsansicht Januar 2026 zeigt **28h Soll** (NICHT 32h!)
- [ ] Breakdown zeigt alle 4 Abwesenheitstypen korrekt
- [ ] Unbezahlter Urlaub reduziert Soll (nicht Ist!)
- [ ] Feiertag 06.01.2026 wird erkannt
- [ ] workSchedule wird verwendet (NICHT weeklyHours!)
- [ ] Referenz-Datum ist 18.01.2026 (heute)

---

**Erstellt:** 2026-01-18
**User ID:** 20
**Datenbank:** database.db
**Status:** ✅ Bereit für Testing
