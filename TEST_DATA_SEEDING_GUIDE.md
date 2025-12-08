# 🧪 Test Data Seeding - Critical Guidelines

**Purpose:** Document critical rules for creating accurate test data for manual frontend verification

**Created:** 2025-12-08
**Last Updated:** 2025-12-08
**Status:** ✅ ACTIVE

---

## 🎯 KRITISCHE REGEL #1: Soll-Stunden berechnen bis HEUTE

### DIE WICHTIGSTE ERKENNTNIS

```
Soll-Stunden = (Arbeitstage from hireDate TO today INCLUSIVE) × Stunden pro Tag
```

**NICHT:** Bis zum letzten Arbeitstag
**NICHT:** Nur bis gestern
**SONDERN:** **Bis HEUTE (inclusive), auch wenn der User HEUTE noch nicht gearbeitet hat!**

### Warum ist das so?

Das System berechnet Überstunden als:
```
Überstunden = Ist-Stunden - Soll-Stunden
```

Wenn HEUTE ein Arbeitstag ist und der User noch nicht gearbeitet hat, entsteht ein **korrektes Minus**, bis der User seine Stunden für heute erfasst.

### Beispiel: David Late

**Szenario:**
- Eingestellt: Mi 03.12.2025
- Heute: Mo 08.12.2025
- Gearbeitet: Mi 03.12, Do 04.12, Fr 05.12 (3 Tage = 24h)
- **HEUTE (Mo 08.12) noch NICHT gearbeitet!**

**Berechnung:**
```
Arbeitstage: Mi 03.12, Do 04.12, Fr 05.12, Mo 08.12 = 4 Tage
Soll: 4 × 8h = 32h
Ist: 24h (HEUTE fehlt noch!)
Überstunden: 24h - 32h = -8h ✅ KORREKT!
```

**FEHLER (wenn man heute vergisst):**
```
Arbeitstage: Mi, Do, Fr = 3 Tage
Soll: 3 × 8h = 24h
Ist: 24h
Überstunden: 0h ❌ FALSCH! User hat heute noch nicht gearbeitet!
```

---

## 🗓️ KRITISCHE REGEL #2: Deutscher Kalender

### Woche startet MONTAG (nicht Sonntag!)

**Dezember 2025:**
```
Mo 01.12  Di 02.12  Mi 03.12  Do 04.12  Fr 05.12
Sa 06.12  So 07.12
Mo 08.12  Di 09.12  Mi 10.12  Do 11.12  Fr 12.12
...
```

### Häufiger Fehler

```javascript
// ❌ FALSCH - US-Kalender (Woche startet Sonntag)
const weekStart = date.getDay(); // 0 = Sonntag!

// ✅ RICHTIG - DE-Kalender (Woche startet Montag)
const dayOfWeek = (date.getDay() + 6) % 7; // 0 = Montag
```

---

## 📋 KRITISCHE REGEL #3: Test-Daten für aktuellen Monat

### Warum aktueller Monat?

Wenn du Test-Daten für **Januar 2025** erstellst, aber heute ist **08.12.2025**, dann berechnet das System:

```
Soll-Stunden = Arbeitstage von Januar bis HEUTE (8. Dezember!)
             = 11 Monate Arbeitstage
             = ~240 Tage × 8h
             = ~1920h Soll

Ist-Stunden = 80h (nur Januar gearbeitet)

Überstunden = 80h - 1920h = -1840h ❌ UNREALISTISCH!
```

**LÖSUNG:** Test-Daten IMMER für den **aktuellen Monat** erstellen!

```
Heute: 08.12.2025
Test-Zeitraum: 01.12.2025 - 08.12.2025 ✅
```

---

## 🏖️ ABWESENHEITS-TYPEN: Auswirkungen auf Soll & Ist

### 1. Urlaub (vacation) - Volle Gutschrift

```
Soll: NICHT reduziert (bleibt normal)
Ist: +8h pro Tag (volle Gutschrift)
Urlaubskonto: -1 Tag pro Tag
```

**Beispiel:**
```
Woche: 5 Arbeitstage (Mo-Fr)
Gearbeitet: Mo-Mi (24h)
Urlaub: Do-Fr (2 Tage)

Soll: 5 × 8h = 40h
Ist: 24h + (2 × 8h) = 40h
Überstunden: 0h ✅
Urlaubskonto: -2 Tage
```

### 2. Krankheit (sick) - Volle Gutschrift, kein Urlaub

```
Soll: NICHT reduziert (bleibt normal)
Ist: +8h pro Tag (volle Gutschrift)
Urlaubskonto: NICHT betroffen (0 Tage)
```

**Beispiel:**
```
Woche: 5 Arbeitstage
Gearbeitet: Mo-Di (16h)
Krank: Mi-Fr (3 Tage)

Soll: 5 × 8h = 40h
Ist: 16h + (3 × 8h) = 40h
Überstunden: 0h ✅
Urlaubskonto: unverändert
```

### 3. Unbezahlter Urlaub (unpaid) - Reduziert Soll, KEINE Gutschrift

```
Soll: -8h pro Tag (REDUZIERT!)
Ist: +0h (KEINE Gutschrift!)
Urlaubskonto: NICHT betroffen (0 Tage)
```

**Beispiel: Emma Unpaid**
```
Zeitraum: Mo 01.12 - Mo 08.12 (6 Arbeitstage)
Gearbeitet: Mo, Di, Mi, Do, Mo (5 Tage = 40h)
Unbezahlter Urlaub: Fr 05.12 (1 Tag)

Soll: (6 - 1) × 8h = 40h  ← Unbezahlt REDUZIERT Soll!
Ist: 40h                  ← KEINE Gutschrift für unbezahlt!
Überstunden: 0h ✅
Urlaubskonto: unverändert (unbezahlt ≠ Urlaub!)
```

### 4. Überstunden-Ausgleich (overtime_comp) - Volle Gutschrift, kein Urlaub

```
Soll: NICHT reduziert (bleibt normal)
Ist: +8h pro Tag (volle Gutschrift)
Urlaubskonto: NICHT betroffen (0 Tage)
```

**Beispiel: Frank Overtime**
```
Zeitraum: Mo 01.12 - Mo 08.12 (6 Arbeitstage)
Gearbeitet: Mo-Mi (3×10h = 30h), heute Mo (8h)
Überstunden-Ausgleich: Do-Fr (2 Tage)

Soll: 6 × 8h = 48h           ← NICHT reduziert!
Ist: 30h + (2 × 8h) + 8h = 54h  ← Gutschrift wie Urlaub!
Überstunden: +6h ✅
Urlaubskonto: unverändert (Ausgleich ≠ neuer Urlaub!)
```

---

## 📊 TEST-SZENARIEN: Edge Cases

### Edge Case 1: Mid-Week Start (David Late)

**Warum testen?** Einstellung nicht am Montag

```typescript
// Einstellungsdatum: Mi 03.12.2025
hireDate: '2025-12-03'

// Arbeitstage bis heute (Mo 08.12):
const workDays = [
  '2025-12-03', // Mi - Arbeitstag 1
  '2025-12-04', // Do - Arbeitstag 2
  '2025-12-05', // Fr - Arbeitstag 3
  // Sa 06.12, So 07.12 → WOCHENENDE (nicht zählen!)
  '2025-12-08', // Mo - Arbeitstag 4 (HEUTE!)
];

// ⚠️ KRITISCH: HEUTE mit einschließen für Testdaten!
// Sonst sieht User -8h obwohl korrekt
```

**Erwartete Werte:**
```
Soll: 32h (4 Arbeitstage)
Ist: 32h (4 Tage gearbeitet)
Überstunden: 0h
```

### Edge Case 2: Unbezahlter Urlaub (Emma Unpaid)

**Warum testen?** Sonderregel: Reduziert Soll UND keine Gutschrift

```typescript
// Arbeitet Mo-Do, Mo (5 Tage)
const workDays = [
  '2025-12-01', '2025-12-02', '2025-12-03', '2025-12-04',
  '2025-12-08', // HEUTE!
];

// Unbezahlter Urlaub: Fr 05.12
createAbsence(userId, 'unpaid', '2025-12-05', '2025-12-05', 1);
```

**Erwartete Werte:**
```
Arbeitstage insgesamt: 6 (Mo-Fr, Mo)
Unbezahlt: 1 Tag

Soll: (6 - 1) × 8h = 40h  ← REDUZIERT!
Ist: 5 × 8h = 40h         ← Keine Gutschrift!
Überstunden: 0h
Urlaubskonto: 30 Tage (unverändert)
```

### Edge Case 3: Überstunden + Ausgleich (Frank Overtime)

**Warum testen?** Überstunden erarbeiten, dann abfeiern

```typescript
// Mo-Mi: Überstunden (3×10h = 30h)
['2025-12-01', '2025-12-02', '2025-12-03'].forEach(date => {
  createTimeEntry(userId, date, '08:00', '18:30', 30); // 10h
});

// Do-Fr: Überstunden-Ausgleich (2 Tage)
createAbsence(userId, 'overtime_comp', '2025-12-04', '2025-12-05', 2);

// Mo: Normal gearbeitet (8h)
createTimeEntry(userId, '2025-12-08', '09:00', '17:30', 30); // 8h
```

**Erwartete Werte:**
```
Arbeitstage: 6 (Mo-Fr, Mo)

Soll: 6 × 8h = 48h                  ← NICHT reduziert!
Ist: 30h + (2 × 8h) + 8h = 54h     ← Gutschrift!
Überstunden: +6h
Urlaubskonto: 30 Tage (unverändert)
```

---

## ✅ CHECKLISTE: Test-Daten erstellen

### Vor dem Seeden:

- [ ] **Heute-Datum berücksichtigt?**
  - Test-Daten für aktuellen Monat?
  - Arbeitstage BIS HEUTE (inclusive)?
  - HEUTE als Arbeitstag in workDays Array?

- [ ] **Deutscher Kalender korrekt?**
  - Woche startet Montag?
  - Wochenenden ausgeschlossen (Sa, So)?
  - Feiertage berücksichtigt?

- [ ] **Abwesenheits-Typen korrekt?**
  - Urlaub: Gutschrift + Urlaubskonto -1
  - Krank: Gutschrift + Urlaubskonto 0
  - Unbezahlt: KEIN Soll + KEINE Gutschrift
  - Überstunden-Ausgleich: Gutschrift + Urlaubskonto 0

- [ ] **Edge Cases abgedeckt?**
  - Mid-week start (nicht Montag)
  - Unbezahlter Urlaub
  - Überstunden-Ausgleich
  - Teilzeit (weeklyHours ≠ 40)

### Nach dem Seeden:

- [ ] **Verification-Script ausführen:**
  ```bash
  cd server
  npm run seed-test-data
  npm run verify-test-data
  ```

- [ ] **Frontend manuell prüfen:**
  - Dashboard öffnen
  - Zeitkonto: Soll, Ist, Überstunden
  - Urlaubskonto: Anspruch, Genommen, Verfügbar
  - Kalender: Einträge sichtbar?

- [ ] **Erwartete Werte dokumentiert:**
  - Im Seed-Script Kommentare mit Expected Values
  - Im Verification-Script `EXPECTED_RESULTS` Object
  - Falls abweichend: Analyse & Fix!

---

## 🔍 VERIFICATION FORMELN

### Target Hours (Soll-Stunden)

```typescript
function calculateTargetHours(
  hireDate: Date,
  today: Date,
  weeklyHours: number
): number {
  // 1. Arbeitstage zählen (Mo-Fr, ohne Feiertage)
  const workingDays = countWorkingDaysBetween(hireDate, today);

  // 2. Stunden pro Tag berechnen
  const hoursPerDay = weeklyHours / 5; // 40h / 5 = 8h

  // 3. Soll berechnen
  const targetHours = workingDays * hoursPerDay;

  return targetHours;
}
```

### Actual Hours (Ist-Stunden)

```typescript
function calculateActualHours(
  timeEntries: TimeEntry[],
  absences: Absence[],
  hoursPerDay: number
): number {
  // 1. Gearbeitete Stunden summieren
  const workedHours = timeEntries.reduce((sum, entry) => {
    return sum + entry.hours;
  }, 0);

  // 2. Abwesenheits-Gutschriften berechnen
  const absenceCredits = absences
    .filter(a => a.status === 'approved')
    .reduce((sum, absence) => {
      // Volle Gutschrift: vacation, sick, overtime_comp
      if (['vacation', 'sick', 'overtime_comp'].includes(absence.type)) {
        return sum + (absence.days * hoursPerDay);
      }
      // KEINE Gutschrift: unpaid
      return sum;
    }, 0);

  // 3. Ist = Gearbeitet + Gutschriften
  return workedHours + absenceCredits;
}
```

### Overtime (Überstunden)

```typescript
function calculateOvertime(
  actualHours: number,
  targetHours: number
): number {
  // Einfache Differenz
  return actualHours - targetHours;
}
```

**Interpretation:**
- **Positiv (+5h):** User hat mehr gearbeitet als Soll
- **Null (0h):** User hat genau Soll erfüllt
- **Negativ (-5h):** User hat weniger gearbeitet als Soll (Debt)

---

## 🚨 HÄUFIGE FEHLER & LÖSUNGEN

### Fehler 1: "Alle haben massiv Minusstunden"

**Symptom:**
```
David: -1840h
Emma: -1840h
Frank: -1840h
```

**Ursache:** Test-Daten in falschem Monat (z.B. Januar, aber heute ist Dezember)

**Lösung:**
```typescript
// ❌ FALSCH
const workDays = ['2025-01-15', '2025-01-16', ...]; // Januar!

// ✅ RICHTIG
const workDays = ['2025-12-01', '2025-12-02', ...]; // Aktueller Monat!
```

### Fehler 2: "Überstunden stimmen nicht, obwohl Daten korrekt"

**Symptom:**
```
Erwartet: 0h
Tatsächlich: -8h
```

**Ursache:** HEUTE nicht in Test-Daten eingeschlossen

**Lösung:**
```typescript
// ❌ FALSCH - Heute fehlt
const workDays = [
  '2025-12-03', // Mi
  '2025-12-04', // Do
  '2025-12-05', // Fr
  // Mo 08.12 fehlt! ← FEHLER
];

// ✅ RICHTIG - Heute dabei
const workDays = [
  '2025-12-03', // Mi
  '2025-12-04', // Do
  '2025-12-05', // Fr
  '2025-12-08', // Mo (HEUTE!) ✅
];
```

### Fehler 3: "Wochenende wird als Arbeitstag gezählt"

**Symptom:**
```
Erwartet: Soll 40h (5 Tage)
Tatsächlich: Soll 56h (7 Tage)
```

**Ursache:** Samstag/Sonntag nicht ausgeschlossen

**Lösung:**
```typescript
// ✅ RICHTIG - Nur Mo-Fr
function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // So=0, Sa=6
    if (!isWeekend) count++;
  }
  return count;
}
```

### Fehler 4: "Emma hat -8h obwohl unbezahlter Urlaub"

**Symptom:**
```
Emma: 40h Ist, 48h Soll, -8h Overtime
```

**Ursache:** Unbezahlter Urlaub reduziert Soll NICHT korrekt

**Lösung:**
```typescript
// Soll muss unbezahlte Tage ABZIEHEN
const unpaidDays = absences
  .filter(a => a.type === 'unpaid' && a.status === 'approved')
  .reduce((sum, a) => sum + a.days, 0);

const adjustedTarget = targetHours - (unpaidDays * hoursPerDay);
```

### Fehler 5: "Frank hat +14h statt +6h"

**Symptom:**
```
Frank: 62h Ist (statt 54h)
```

**Ursache:** Überstunden-Ausgleich zählt doppelt (als Gutschrift UND als gearbeitete Stunden)

**Lösung:**
```typescript
// ✅ RICHTIG - Ausgleichstage NICHT als TimeEntry erfassen!
// ENTWEDER TimeEntry ODER Absence, NICHT BEIDES!

createAbsence(frankId, 'overtime_comp', '2025-12-04', '2025-12-05', 2);
// → Gibt 2 × 8h = 16h Gutschrift

// ❌ FALSCH - Nicht zusätzlich Time Entries für diese Tage!
// createTimeEntry(frankId, '2025-12-04', ...); // NICHT!
```

---

## 📝 SCRIPTS ÜBERSICHT

### 1. Seed Script (`seedTestData.ts`)

**Zweck:** Test-Daten in DB schreiben

**Run:**
```bash
cd server
npm run seed-test-data
```

**Was macht es:**
- Löscht alte Test-User (`username LIKE '%_test'`)
- Erstellt 3 Test-User mit Edge Cases
- Erstellt Time Entries
- Erstellt Absences
- Initialisiert Vacation Balances

**Wichtig:**
- Heute-Datum berücksichtigen!
- Deutsche Wochentage!
- Erwartete Werte als Kommentare dokumentieren!

### 2. Verify Script (`verifyTestData.ts`)

**Zweck:** Automatische Verifikation der Berechnungen

**Run:**
```bash
cd server
npm run verify-test-data
```

**Was macht es:**
- Liest Test-User aus DB
- Berechnet Soll/Ist/Overtime
- Vergleicht mit erwarteten Werten (`EXPECTED_RESULTS`)
- Zeigt Abweichungen an

**Output:**
```
👤 David Late (@david_test)
────────────────────────────────────────────────────────
Soll-Stunden:      ✅ Erwartet: 32.0h, Tatsächlich: 32.0h
Ist-Stunden:       ✅ Erwartet: 32.0h, Tatsächlich: 32.0h
Überstunden:       ✅ Erwartet: 0.0h, Tatsächlich: 0.0h
Urlaubstage:       ✅ Erwartet: 30 Tage, Tatsächlich: 30 Tage

✅ Alle Tests bestanden!
```

---

## 🎯 ZUSAMMENFASSUNG: Die 3 goldenen Regeln

### 1. **Soll-Stunden bis HEUTE**
Arbeitstage **from hireDate TO today (inclusive)** × 8h

### 2. **Deutscher Kalender**
Woche startet **Montag**, Wochenende = Sa + So

### 3. **Abwesenheits-Effekte**
- **Urlaub/Krank/Überstunden-Ausgleich:** Volle Gutschrift (8h/Tag)
- **Unbezahlter Urlaub:** Reduziert Soll + KEINE Gutschrift

---

**Version:** 1.0
**Letzte Aktualisierung:** 2025-12-08
**Autor:** Claude (basierend auf User-Feedback)

**Bei Fragen:** Diese Datei lesen! Alle kritischen Erkenntnisse sind hier dokumentiert.
