# Test Users - Expected Values (Exakte Ergebnisse)

**Berechnungsdatum:** 2026-01-18 (HEUTE)
**Validierungszeitraum:** 2026-01 (01.01 - 18.01.2026)

---

## User 48: Max Vollzeit

**Username:** `test.vollzeit` | **Password:** `test123`

### User-Daten
- Hire Date: 2024-01-01
- Weekly Hours: 40h
- workSchedule: KEINE (nutzt weeklyHours)
- Status: active

### Januar 2026 (01.01 - 18.01)

**Arbeitstage:**
- Do 01.01: 8h (aber Feiertag → 0h)
- Fr 02.01: 8h (aber Überstunden-Ausgleich → Gutschrift)
- Sa/So 03-04.01: 0h (Weekend)
- Mo 05.01: 8h
- Di 06.01: 8h (aber Feiertag → 0h)
- Mi 07.01: 8h
- Do 08.01: 8h
- Fr 09.01: 8h
- Sa/So 10-11.01: 0h (Weekend)
- Mo 12.01: 8h
- Di 13.01: 8h
- Mi 14.01: 8h
- Do 15.01: 8h
- Fr 16.01: 8h
- Sa/So 17-18.01: 0h (Weekend)

**Berechnung:**
```
Soll-Stunden (Target): 10 Arbeitstage × 8h = 80h
  (Mo-Fr ohne Feiertage: 05., 07., 08., 09., 12., 13., 14., 15., 16. = 9 + 1 vom 02.01 = 10)

Gearbeitete Stunden: 8h (nur 03.01 - Samstag gearbeitet!)

Abwesenheiten:
  - Überstunden-Ausgleich: 02.01 (Fr) → +8h Gutschrift

Ist-Stunden (Actual): 8h + 8h = 16h

Überstunden: 16h - 80h = -64h
```

**✅ EXPECTED VALUES:**
- Target: **80h**
- Actual: **16h**
- Overtime: **-64h**
- Carryover from 2025: **Variable** (hängt von 2025-Daten ab)

---

## User 49: Christine Teilzeit ⭐ KRITISCHER TEST

**Username:** `test.christine` | **Password:** `test123`

### User-Daten
- Hire Date: 2025-01-01
- Weekly Hours: 8h (WIRD IGNORIERT!)
- **workSchedule: {monday: 4, tuesday: 4}** ← NUR Mo+Di Arbeitstage!
- Status: active

### Januar 2026 (01.01 - 18.01)

**Arbeitstage (NUR Mo+Di zählen!):**
- Do 01.01: 0h (kein Arbeitstag + Feiertag)
- Fr 02.01: 0h (kein Arbeitstag)
- Sa/So 03-04.01: 0h (Weekend)
- **Mo 05.01: 4h** ← Arbeitstag!
- **Di 06.01: 4h** ← Arbeitstag, ABER Feiertag → 0h!
- Mi-Fr 07-09.01: 0h (keine Arbeitstage)
- Sa/So 10-11.01: 0h (Weekend)
- **Mo 12.01: 4h** ← Arbeitstag!
- **Di 13.01: 4h** ← Arbeitstag!
- Mi-Fr 14-16.01: 0h (keine Arbeitstage)
- Sa/So 17-18.01: 0h (Weekend)

**Berechnung:**
```
Soll-Stunden (Target): 4 Arbeitstage × 4h = 16h
  (05.01 Mo, 06.01 Di, 12.01 Mo, 13.01 Di)

Gearbeitete Stunden: 0h (keine Time Entries)

Abwesenheiten:
  - Urlaub: 01.01 - 25.01 (approved)
  - WICHTIG: Nur Arbeitstage (Mo+Di) zählen!
  - WICHTIG: 06.01 = Feiertag → zählt NICHT als Urlaubstag!

  Urlaubs-Gutschrift:
    05.01 Mo: 4h ✅
    06.01 Di: 0h ❌ (Feiertag!)
    12.01 Mo: 4h ✅
    13.01 Di: 4h ✅
  Total: 3 Arbeitstage × 4h = 12h

Ist-Stunden (Actual): 0h + 12h = 12h

Überstunden: 12h - 16h = -4h
```

**✅ EXPECTED VALUES:**
- Target: **16h** (4 Arbeitstage)
- Actual: **12h** (nur 3 Urlaubstage gezählt!)
- Overtime: **-4h**
- Carryover from 2025: **Variable**

**🎯 KEY INSIGHTS:**
1. workSchedule überschreibt weeklyHours (8h wird IGNORIERT)
2. Nur Mo+Di sind Arbeitstage (Mi-So = 0h)
3. Feiertag (06.01) zählt NICHT als Urlaubstag
4. Urlaubsgutschrift = nur 3 Tage × 4h = 12h (NICHT 4 Tage!)

---

## User 50: Peter Fleißig (Positive Überstunden)

**Username:** `test.overtime-plus` | **Password:** `test123`

### User-Daten
- Hire Date: 2024-01-01
- Weekly Hours: 40h
- workSchedule: KEINE
- Status: active

### 2025 Daten
- Juli 2025: Viele Überstunden (~20h)
- August 2025: Viele Überstunden (~20h)
- Dezember 2025: Viele Überstunden (~20h)
- **TOTAL 2025: ~+60h Überstunden**

### Januar 2026
- Nur wenige Time Entries (2-3 Tage)

**✅ EXPECTED VALUES:**
- 2026-01 Target: **80h**
- 2026-01 Actual: **16h** (2 Tage × 8h)
- 2026-01 Overtime: **-64h**
- **Carryover from 2025: ~+60h** ← WICHTIG!
- **TOTAL Balance Ende Januar 2026: ~-4h** (60h - 64h)

---

## User 51: Laura Weniger (Negative Überstunden)

**Username:** `test.overtime-minus` | **Password:** `test123`

### User-Daten
- Hire Date: 2024-01-01
- Weekly Hours: 40h
- workSchedule: KEINE
- Status: active

### 2025 Daten
- Juli 2025: Nur 20h gearbeitet (Soll: ~160h) → -140h
- August 2025: Nur 30h gearbeitet (Soll: ~176h) → -146h
- Dezember 2025: Nur 40h gearbeitet (Soll: ~168h) → -128h
- **TOTAL 2025: ~-400h Überstunden** (stark negativ!)

### Januar 2026
- Nur wenige Time Entries

**✅ EXPECTED VALUES:**
- 2026-01 Target: **80h**
- 2026-01 Actual: **16h**
- 2026-01 Overtime: **-64h**
- **Carryover from 2025: ~-400h** ← WICHTIG!
- **TOTAL Balance Ende Januar 2026: ~-464h** (-400h - 64h)

---

## User 52: Sarah Unbezahlt (Unbezahlter Urlaub) ⭐ KRITISCHER TEST

**Username:** `test.unpaid` | **Password:** `test123`

### User-Daten
- Hire Date: 2024-01-01
- Weekly Hours: 40h
- workSchedule: KEINE
- Status: active

### **WICHTIG: Validierung für August 2025 (nicht Januar 2026!)**

### August 2025 (Unbezahlter Urlaub-Monat)

**Abwesenheiten:**
- Unbezahlter Urlaub: 11.08 - 22.08 (2 Wochen = 10 Arbeitstage)

**Berechnung:**
```
Normales Soll August 2025: ~176h (22 Arbeitstage × 8h)

Unbezahlter Urlaub:
  - 10 Arbeitstage × 8h = 80h
  - REDUZIERT Soll-Stunden (user muss nicht arbeiten)
  - Gibt KEINE Ist-Gutschrift!

Angepasstes Soll: 176h - 80h = 96h

Gearbeitete Stunden: ~40h (vor und nach unbezahltem Urlaub)

Abwesenheits-Gutschriften: 0h (unbezahlt = keine Gutschrift!)

Ist-Stunden: 40h + 0h = 40h

Überstunden: 40h - 96h = -56h
```

**✅ EXPECTED VALUES (August 2025):**
- Target: **96h** (12 Arbeitstage statt 22)
- Actual: **40h** (nur gearbeitete Stunden)
- Overtime: **-56h**
- **KEIN Urlaubs-Gutschrift** ← KEY TEST!

---

## User 53: Tom Viertage (4-Tage-Woche)

**Username:** `test.4day-week` | **Password:** `test123`

### User-Daten
- Hire Date: 2025-01-01
- Weekly Hours: 40h (WIRD IGNORIERT!)
- **workSchedule: {monday: 10, tuesday: 10, wednesday: 10, thursday: 10}**
- Status: active

### Januar 2026

**Arbeitstage (Mo-Do):**
- Mo 05.01: 10h
- Di 06.01: 10h (aber Feiertag → 0h)
- Mi 07.01: 10h
- Do 08.01: 10h
- Mo 12.01: 10h
- Di 13.01: 10h
- Mi 14.01: 10h
- Do 15.01: 10h

**Berechnung:**
```
Soll-Stunden: 7 Arbeitstage × 10h = 70h
  (ohne 06.01 Feiertag)

Gearbeitete Stunden: 0h (keine Einträge im Seeding für Jan 2026)

Ist-Stunden: 0h

Überstunden: 0h - 70h = -70h
```

**✅ EXPECTED VALUES:**
- Target: **70h** (7 Arbeitstage Mo-Do)
- Actual: **0h**
- Overtime: **-70h**

---

## User 54: Julia Komplex (Komplexe Historie)

**Username:** `test.complex` | **Password:** `test123`

### User-Daten
- Hire Date: 2024-01-01
- Weekly Hours: 40h
- workSchedule: KEINE
- Status: active

### Januar 2026
- Keine spezifischen Einträge im Seeding

**✅ EXPECTED VALUES:**
- Target: **80h**
- Actual: **0h**
- Overtime: **-80h**

---

## User 55: Nina Neuling (Neu 2026) ⭐ KRITISCHER TEST

**Username:** `test.new2026` | **Password:** `test123`

### User-Daten
- **Hire Date: 2026-01-15** ← WICHTIG!
- Weekly Hours: 40h
- workSchedule: KEINE
- Status: active

### Januar 2026 (ABER: Erst ab 15.01!)

**Arbeitstage (NUR ab Hire Date!):**
- Mi 15.01: 8h
- Do 16.01: 8h
- Fr 17.01: 8h (Weekend follows)

**Berechnung:**
```
Soll-Stunden: 3 Arbeitstage × 8h = 24h
  (NICHT ab 01.01, sondern ab 15.01!)

Gearbeitete Stunden: 16h
  (15.01: 8h, 16.01: 8h)

Ist-Stunden: 16h

Überstunden: 16h - 24h = -8h
```

**✅ EXPECTED VALUES:**
- Target: **24h** (nur 3 Tage: 15., 16., 17. Jan)
- Actual: **16h** (2 Tage gearbeitet)
- Overtime: **-8h**
- **Carryover from 2025: 0h** ← WICHTIG! Neu eingestellt!

**🎯 KEY INSIGHT:** Berechnung startet NICHT am 01.01, sondern am Hire Date (15.01)!

---

## User 56: Klaus Ausgeschieden (Gekündigt)

**Username:** `test.terminated` | **Password:** `test123`

### User-Daten
- Hire Date: 2024-01-01
- **End Date: 2025-12-31** ← WICHTIG!
- Weekly Hours: 40h
- workSchedule: KEINE
- **Status: inactive**

### **WICHTIG: Validierung für Dezember 2025 (letzter Monat)**

### Dezember 2025

**Arbeitstage bis 23.12 (letzter Arbeitstag):**
```
Soll-Stunden Dezember: Bis 23.12 (nicht bis 31.12!)

Gearbeitete Stunden: ~24h (3 Tage: 01., 02., 23. Dez)

Überstunden: Variable (hängt von genauen Tagen ab)
```

**✅ EXPECTED VALUES (Dezember 2025):**
- Target: **~136h** (bis 23.12)
- Actual: **24h**
- Overtime: **~-112h**

**Januar 2026:**
- **KEINE DATEN** (nicht mehr aktiv!)
- Target: **0h**
- Actual: **0h**
- Overtime: **0h**

---

## User 57: Emma Wochenende (Weekend-Worker)

**Username:** `test.weekend` | **Password:** `test123`

### User-Daten
- Hire Date: 2025-01-01
- Weekly Hours: 16h (WIRD IGNORIERT!)
- **workSchedule: {saturday: 8, sunday: 8}** ← NUR Sa+So Arbeitstage!
- Status: active

### Januar 2026

**Arbeitstage (NUR Sa+So!):**
- Sa 04.01: 8h
- So 05.01: 8h
- Sa 11.01: 8h
- So 12.01: 8h
- Sa 18.01: 8h

**Berechnung:**
```
Soll-Stunden: 5 Arbeitstage × 8h = 40h
  (2 vollständige Wochenenden + Samstag)

Gearbeitete Stunden: 0h (keine Einträge im Seeding für Jan 2026)

Ist-Stunden: 0h

Überstunden: 0h - 40h = -40h
```

**✅ EXPECTED VALUES:**
- Target: **40h** (5 Wochenend-Tage)
- Actual: **0h**
- Overtime: **-40h**
- **Carryover from 2025: +72h** ← Positive Überstunden aus 2025!
- **TOTAL Balance: +32h** (72h - 40h)

---

## 📊 Quick Reference Table

| User | Username | Month | Target | Actual | Overtime | Carryover | Key Feature |
|------|----------|-------|--------|--------|----------|-----------|-------------|
| 48 | test.vollzeit | 2026-01 | 80h | 16h | -64h | Variable | Überstunden-Ausgleich |
| 49 | test.christine | 2026-01 | **16h** | **12h** | **-4h** | Variable | **workSchedule + Feiertag!** |
| 50 | test.overtime-plus | 2026-01 | 80h | 16h | -64h | **+60h** | Positive Carryover |
| 51 | test.overtime-minus | 2026-01 | 80h | 16h | -64h | **-400h** | Negative Carryover |
| 52 | test.unpaid | **2025-08** | **96h** | **40h** | **-56h** | N/A | **Unbezahlt reduziert Soll!** |
| 53 | test.4day-week | 2026-01 | 70h | 0h | -70h | Variable | Mo-Do 10h |
| 54 | test.complex | 2026-01 | 80h | 0h | -80h | Variable | Mix Abwesenheiten |
| 55 | test.new2026 | 2026-01 | **24h** | **16h** | **-8h** | **0h** | **Hire Date 15.01!** |
| 56 | test.terminated | **2025-12** | 136h | 24h | -112h | N/A | **End Date 31.12!** |
| 57 | test.weekend | 2026-01 | **40h** | 0h | -40h | **+72h** | Sa+So Pattern |

---

## 🎯 Validation Commands

```bash
# Standard-Tests (Januar 2026)
npm run validate:overtime:detailed -- --userId=48 --month=2026-01  # Max
npm run validate:overtime:detailed -- --userId=49 --month=2026-01  # Christine ⭐
npm run validate:overtime:detailed -- --userId=50 --month=2026-01  # Peter
npm run validate:overtime:detailed -- --userId=51 --month=2026-01  # Laura
npm run validate:overtime:detailed -- --userId=53 --month=2026-01  # Tom
npm run validate:overtime:detailed -- --userId=54 --month=2026-01  # Julia
npm run validate:overtime:detailed -- --userId=55 --month=2026-01  # Nina ⭐
npm run validate:overtime:detailed -- --userId=57 --month=2026-01  # Emma

# Spezial-Tests (andere Monate)
npm run validate:overtime:detailed -- --userId=52 --month=2025-08  # Sarah ⭐
npm run validate:overtime:detailed -- --userId=56 --month=2025-12  # Klaus ⭐
```

---

**⭐ = Kritischer Test** (besondere Logik erforderlich)
**Erstellt:** 2026-01-18
**Berechnungsbasis:** Heute = 2026-01-18
