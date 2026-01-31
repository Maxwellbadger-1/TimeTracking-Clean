# Expected Overtime Calculation - Test User (ID=20)

## User Info
- **Name:** Test User
- **Work Schedule:** Mo=4h, Tu=4h, rest=0h (8h/week)
- **Hire Date:** 2025-07-01
- **Heute (Referenz):** 2026-01-18

---

## Zeitraum: 2025-07-01 bis 2026-01-18

### 📅 DAY-BY-DAY BREAKDOWN (Juli 2025)

| Datum | Wochentag | workSchedule | Feiertag? | Abwesenheit | Soll-Stunden |
|-------|-----------|--------------|-----------|-------------|--------------|
| 01.07 | Dienstag | 4h | Nein | - | 4h |
| 02.07 | Mittwoch | 0h | Nein | - | 0h |
| 03.07 | Donnerstag | 0h | Nein | - | 0h |
| 04.07 | Freitag | 0h | Nein | - | 0h |
| 05.07 | Samstag | 0h | Nein | - | 0h |
| 06.07 | Sonntag | 0h | Nein | - | 0h |
| 07.07 | Montag | 4h | Nein | **Sick** | 4h |
| 08.07 | Dienstag | 4h | Nein | **Sick** | 4h |
| 09.07 | Mittwoch | 0h | Nein | - | 0h |
| 10.07 | Donnerstag | 0h | Nein | - | 0h |
| 11.07 | Freitag | 0h | Nein | - | 0h |
| 12.07 | Samstag | 0h | Nein | - | 0h |
| 13.07 | Sonntag | 0h | Nein | - | 0h |
| 14.07 | Montag | 4h | Nein | **Vacation** | 4h |
| 15.07 | Dienstag | 4h | Nein | **Vacation** | 4h |
| 16.07 | Mittwoch | 0h | Nein | - | 0h |
| 17.07 | Donnerstag | 0h | Nein | - | 0h |
| 18.07 | Freitag | 0h | Nein | - | 0h |
| 19.07 | Samstag | 0h | Nein | - | 0h |
| 20.07 | Sonntag | 0h | Nein | - | 0h |
| 21.07 | Montag | 4h | Nein | - | 4h |
| 22.07 | Dienstag | 4h | Nein | - | 4h |
| 23.07 | Mittwoch | 0h | Nein | - | 0h |
| 24.07 | Donnerstag | 0h | Nein | - | 0h |
| 25.07 | Freitag | 0h | Nein | - | 0h |
| 26.07 | Samstag | 0h | Nein | - | 0h |
| 27.07 | Sonntag | 0h | Nein | - | 0h |
| 28.07 | Montag | 4h | Nein | **Overtime Comp** | 4h |
| 29.07 | Dienstag | 4h | Nein | - | 4h |
| 30.07 | Mittwoch | 0h | Nein | - | 0h |
| 31.07 | Donnerstag | 0h | Nein | - | 0h |

**Juli 2025 - Soll-Stunden:**
- Arbeitstage laut workSchedule: 9 Montage + 9 Dienstage = **18 Tage** (aber nur bis 31.07)
- Tatsächliche Arbeitstage: 01, 07, 08, 14, 15, 21, 22, 28, 29 = **9 Tage × 4h = 36h**

---

### 📅 DAY-BY-DAY BREAKDOWN (August 2025)

| Datum | Wochentag | workSchedule | Feiertag? | Abwesenheit | Soll-Stunden |
|-------|-----------|--------------|-----------|-------------|--------------|
| 01.08 | Freitag | 0h | Nein | - | 0h |
| 02.08 | Samstag | 0h | Nein | - | 0h |
| 03.08 | Sonntag | 0h | Nein | - | 0h |
| 04.08 | Montag | 4h | Nein | - | 4h |
| 05.08 | Dienstag | 4h | Nein | - | 4h |
| 06.08 | Mittwoch | 0h | Nein | - | 0h |
| 07.08 | Donnerstag | 0h | Nein | - | 0h |
| 08.08 | Freitag | 0h | Nein | - | 0h |
| 09.08 | Samstag | 0h | Nein | - | 0h |
| 10.08 | Sonntag | 0h | Nein | - | 0h |
| 11.08 | Montag | 4h | Nein | **Unpaid** | ~~4h~~ **0h** (reduziert Soll!) |
| 12.08 | Dienstag | 4h | Nein | **Unpaid** | ~~4h~~ **0h** (reduziert Soll!) |
| 13.08 | Mittwoch | 0h | Nein | - | 0h |
| 14.08 | Donnerstag | 0h | Nein | - | 0h |
| 15.08 | Freitag | 0h | **Feiertag** (Mariä Himmelfahrt) | - | 0h |
| 16.08 | Samstag | 0h | Nein | - | 0h |
| 17.08 | Sonntag | 0h | Nein | - | 0h |
| 18.08 | Montag | 4h | Nein | - | 4h |
| 19.08 | Dienstag | 4h | Nein | - | 4h |
| 20.08 | Mittwoch | 0h | Nein | - | 0h |
| ... | ... | ... | ... | ... | ... |

**August 2025 - Soll-Stunden:**
- Arbeitstage: 04, 05, ~~11~~, ~~12~~, 18, 19, 25, 26 = 6 Tage (11+12 UNPAID!)
- **6 × 4h = 24h**

---

### 📅 ZUSAMMENFASSUNG ALLE MONATE (Juli 2025 - Januar 2026)

**WICHTIG:** Ich berechne nur bis **HEUTE (18.01.2026)**!

| Monat | Arbeitstage (Mo+Di) | Feiertage | Unpaid Days | Soll-Stunden |
|-------|---------------------|-----------|-------------|--------------|
| **Juli 2025** | 9 Tage | 0 | 0 | **36h** |
| **August 2025** | 8 Tage | 1 (15.08 = Fr) | 2 (11+12) | **(8-2) × 4h = 24h** |
| **September 2025** | 8 Tage | 0 | 0 | **32h** |
| **Oktober 2025** | 9 Tage | 1 (03.10 = Do, kein Arbeitstag) | 0 | **36h** |
| **November 2025** | 8 Tage | 1 (01.11 = Sa, kein Arbeitstag) | 0 | **32h** |
| **Dezember 2025** | 9 Tage | 2 (25+26.12 = Mi+Do, kein Arbeitstag) | 0 | **36h** |
| **Januar 2026** | 3 Tage (bis 18.01) | 1 (06.01 = Di, **FEIERTAG!**) | 0 | **(4-1) × 4h = 12h** |

**GESAMT Soll-Stunden:** 36 + 24 + 32 + 36 + 32 + 36 + 12 = **208h**

---

## 🧮 IST-STUNDEN BERECHNUNG

### 1. Gearbeitete Stunden (time_entries)
```
01.07: 4h
21.07: 4h
22.07: 4h
29.07: 5h (1h Überstunde!)
04.08: 4h
05.08: 4h
18.08: 4h
19.08: 4h
---
TOTAL: 33h
```

### 2. Abwesenheits-Gutschriften

#### Sick Leave (07.07-08.07)
- Montag (07.07): 4h (workSchedule.monday)
- Dienstag (08.07): 4h (workSchedule.tuesday)
- **Summe:** 8h

#### Vacation (14.07-15.07)
- Montag (14.07): 4h
- Dienstag (15.07): 4h
- **Summe:** 8h

#### Overtime Comp (28.07)
- Montag (28.07): 4h
- **Summe:** 4h

#### Unpaid Leave (11.08-12.08)
- **KEINE Gutschrift!** (Reduziert nur Soll!)

**TOTAL Absence Credits:** 8h + 8h + 4h = **20h**

### 3. Manuelle Korrekturen (overtime_corrections)
- Keine vorhanden
- **Summe:** 0h

---

## ✅ FINALE BERECHNUNG

```
Ist-Stunden = Gearbeitete Stunden + Absence Credits + Corrections
            = 33h + 20h + 0h
            = 53h

Soll-Stunden = 208h (siehe oben)

Überstunden = Ist-Stunden - Soll-Stunden
            = 53h - 208h
            = -155h
```

---

## 🎯 ERWARTETE WERTE IM FRONTEND

### Overtime Dashboard
```json
{
  "userId": 20,
  "period": "2025-07-01 bis 2026-01-18",
  "targetHours": 208,
  "actualHours": 53,
  "overtime": -155,
  "breakdown": {
    "workedHours": 33,
    "sickCredit": 8,
    "vacationCredit": 8,
    "overtimeCompCredit": 4,
    "corrections": 0
  }
}
```

### Monats-Ansicht (Januar 2026)
```json
{
  "month": "2026-01",
  "targetHours": 12,
  "actualHours": 0,
  "overtime": -12,
  "notes": [
    "06.01 (Di) = Heilige Drei Könige (Feiertag!)",
    "Nur 3 Arbeitstage: Mo 13.01, Mo 20.01 = 2 Tage",
    "ABER: 06.01 ist Feiertag → nur 3 Tage"
  ]
}
```

---

## 🔍 KRITISCHE CHECKS

### ✅ Check 1: workSchedule wird verwendet (NICHT weeklyHours!)
- User hat `workSchedule: {monday: 4, tuesday: 4, rest: 0}`
- weeklyHours=8 wird **IGNORIERT**!

### ✅ Check 2: Feiertag überschreibt workSchedule
- 06.01.2026 (Dienstag) = Heilige Drei Könige
- workSchedule.tuesday=4h **WIRD ZU 0h** wegen Feiertag!

### ✅ Check 3: Unbezahlter Urlaub reduziert Soll
- 11.08 + 12.08 = 8h weniger Soll
- **KEINE** Ist-Gutschrift!

### ✅ Check 4: Abwesenheits-Gutschriften korrekt
- Sick: 8h ✅
- Vacation: 8h ✅
- Overtime Comp: 4h ✅
- Unpaid: 0h ✅

### ✅ Check 5: Heute = 18.01.2026 (Referenz-Datum)
- Berechnung läuft **BIS** 18.01.2026, nicht Monatsende!

---

## 🚀 RUN VALIDATION

```bash
cd server
npm run validate:overtime:detailed -- --userId=20 --month=2026-01
npm run validate:overtime -- --userId=20
```

**Expected Output:**
- Target: **208h**
- Actual: **53h**
- Overtime: **-155h**
