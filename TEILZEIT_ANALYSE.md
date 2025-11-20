# Umfassende Analyse: Teilzeitmitarbeiter-Features im TimeTracking System

**Analysedatum:** 2025-11-20
**Version:** 1.0
**Vergleichsbasis:** Personio, DATEV, SAP SuccessFactors

---

## Executive Summary

Unser TimeTracking-System verfügt bereits über eine **solide Grundlage** für Teilzeitmitarbeiter durch flexible `weeklyHours`-Konfiguration und professionelle Überstundenberechnung. Allerdings fehlen einige **Best-Practice-Features** aus professionellen HR-Systemen, insbesondere:

- **Arbeitszeitkonten** (Zeitguthaben/Zeitschuld)
- **Mehrarbeit vs. Überstunden** (Unterscheidung für Teilzeit)
- **Flexible Arbeitszeitmodelle** (Gleitzeit, Vertrauensarbeitszeit)
- **Stundenkonten-Historie** und Saldovortrag
- **Teilzeit-spezifische Berichte** und Auswertungen

**Gap-Severity:** 🟡 Mittel (System funktioniert, aber nicht optimal für komplexe Teilzeit-Szenarien)

---

## 1. Professionelle HR-Software - Best Practices

### 1.1 Personio - Arbeitszeitkonto-Features

#### Kernfeatures:
1. **Arbeitszeitkonto (Work Time Account)**
   - Mitarbeiter können temporär mehr oder weniger arbeiten als vertraglich vereinbart
   - Monatliches Gehalt bleibt gleich (Soll-Stunden)
   - Überstunden werden später ausgeglichen (Freizeitausgleich oder Auszahlung)

2. **Flexibilität für Teilzeit**
   - Puffer bis zu **50% der Wochenstunden** möglich
   - Beispiel: 20h/Woche Teilzeit → Puffer bis zu 10h
   - Ausgleichszeitraum: 3-6 Monate üblich

3. **Mehrarbeit bei Teilzeit**
   - Bis zur Vollzeit-Grenze (38-40h) → Normaler Lohn
   - Erst **darüber** → Überstundenzuschlag
   - Wird im Zeitkonto verbucht

4. **Minusstunden-Regelung**
   - Maximal erlaubtes Minus (z.B. -10h)
   - Automatische Warnung bei Unterschreitung
   - Ausgleichspflicht binnen X Monaten

5. **Plusstunden-Regelung**
   - Maximal erlaubtes Plus (z.B. +50h)
   - Automatische Warnung bei Überschreitung
   - Abbau durch Zeitausgleich priorisiert

#### Rechtliche Vorgaben:
- **Arbeitszeitgesetz (ArbZG)**: Max. 10h/Tag, max. 48h/Woche
- **Mindestlohngesetz (MiLoG)**: 12,82€/h ab 2025-01
- **Dokumentationspflicht**: 2 Jahre Aufbewahrung
- **Betriebsrat**: Mitbestimmung bei Arbeitszeitmodellen (§ 87 BetrVG)

---

### 1.2 DATEV - Stundenkonten-Features

#### Kernfeatures:
1. **Differenzierte Zeitkonten**
   - Überstundenkonto
   - Gleitzeitkonto
   - Mehrarbeitskonto (Teilzeit)
   - Urlaubskonto

2. **Flexible Arbeitszeit-Erfassung**
   - Tages-Soll individuell konfigurierbar
   - Wochen-Soll kann variieren (z.B. 4-Tage-Woche)
   - Berücksichtigung von Feiertagen auf Stundenebene

3. **Monatsabschluss mit Kontobuchungen**
   - Automatische Verbuchung auf Zeitkonten
   - Überstunden → Überstundenkonto
   - Minusstunden → Zeitschuld
   - Krankheit/Urlaub → Gutschrift auf Ist-Stunden

4. **DATEV-Integration**
   - Nahtlose Übertragung zu DATEV Lohn & Gehalt
   - Alle Zuschläge und Zeitkonten werden übermittelt
   - Monatliche Abrechnung automatisiert

5. **Mitarbeiter-Self-Service**
   - Zeitkonto-Einsicht jederzeit
   - Historie und Entwicklung sichtbar
   - Transparenz über Überstunden/Minusstunden

---

### 1.3 SAP SuccessFactors - Teilzeit & Mehrarbeit

#### Kernfeatures:
1. **Mehrarbeit vs. Überstunden (Teilzeit)**
   - **Mehrarbeit:** Bis zur Vollzeit-Grenze → Normaler Lohn
   - **Überstunden:** Ab Vollzeit-Grenze → Zuschlag (25% oder 50%)
   - Beispiel: Teilzeit 35h/Woche, Vollzeit 38h/Woche
     - Stunden 36-38: Mehrarbeit, kein Zuschlag
     - Stunden 39-40: Überstunden mit 25% Zuschlag
     - Ab 41h: Überstunden mit 50% Zuschlag

2. **Time Valuation Framework**
   - Automatische Erkennung: Vollzeit vs. Teilzeit
   - Regelbasierte Berechnung (konfigurierbar)
   - Compliance mit deutschem Arbeitsrecht

3. **Feiertags-Regelung**
   - Feiertag innerhalb Schichtzeit → Feiertags-Zuschlag
   - Feiertag außerhalb Schichtzeit → Basis + Feiertags-Zuschlag
   - Wichtig für Schichtarbeiter und Teilzeit

4. **Komplexe Arbeitszeitmodelle**
   - Variable Schichten
   - Wechselnde Arbeitstage (nicht immer Mo-Fr)
   - Individuelle Work Schedules pro Mitarbeiter

---

### 1.4 Deutsche Gesetzeslage 2025

#### Arbeitszeitkonto-Richtlinien:
1. **Gesetzliche Basis**
   - Arbeitszeitgesetz (ArbZG): Maximalzeiten
   - Mindestlohngesetz (MiLoG): Dokumentationspflicht
   - Betriebsverfassungsgesetz (BetrVG): Mitbestimmung

2. **Zeiterfassungspflicht ab 2025**
   - Elektronische Zeiterfassung wird Pflicht
   - Übergangsregelungen für KMU geplant
   - Unbürokratische Umsetzung angestrebt

3. **Arbeitszeitkonto bei Teilzeit**
   - Obergrenze proportional zur Wochenarbeitszeit
   - Teilzeit < 35h/Woche
   - Maximal-Saldo: Verhandlungssache (oft 50% der Wochenstunden)

4. **Betriebsvereinbarung erforderlich**
   - Definition von Max. Plus-/Minusstunden
   - Ausgleichszeitraum festlegen
   - Insolvenzschutz regeln
   - Auszahlungs-/Abbau-Modalitäten

5. **Dokumentationspflicht**
   - Alle Kontobewegungen vollständig dokumentieren
   - 2 Jahre aufbewahren
   - Bei Prüfung vorlegbar

---

## 2. Unser aktuelles System - Status Quo

### 2.1 ✅ Was wir bereits haben

#### **Flexible Teilzeit-Unterstützung:**
```typescript
// User Model (database/schema.ts)
weeklyHours: REAL NOT NULL DEFAULT 40  // Frei konfigurierbar!
```
- ✅ Teilzeit wird durch `weeklyHours` abgebildet
- ✅ Beispiele: 40h (Vollzeit), 30h (75%), 20h (50%)
- ✅ Tägliche Soll-Berechnung: `weeklyHours / 5`

#### **Professionelle Überstunden-Berechnung:**
```typescript
// Formel (Best Practice konform)
Überstunden = Ist-Stunden - Soll-Stunden

// Soll-Berechnung:
Arbeitstage = countWorkingDaysBetween(hireDate, today)
Soll = (weeklyHours / 5) × Arbeitstage

// Ist-Berechnung:
Ist = Σ TimeEntries + Abwesenheits-Gutschriften
```
- ✅ Korrekte Berechnung für Teilzeit
- ✅ Berücksichtigung von Wochenenden & Feiertagen
- ✅ Abwesenheits-Gutschriften ("Krank/Urlaub = Gearbeitet")

#### **3-Ebenen Overtime-Tracking:**
```sql
-- Tabellen:
overtime_daily    -- Täglich
overtime_weekly   -- Wöchentlich
overtime_balance  -- Monatlich
```
- ✅ Granulare Auswertungen möglich
- ✅ Historische Daten vorhanden
- ✅ Aggregationen für Reports

#### **Abwesenheits-Management:**
```typescript
// Types:
'vacation' | 'sick' | 'unpaid' | 'overtime_comp'
```
- ✅ Überstunden-Abbau durch Freizeitausgleich möglich
- ✅ Unpaid Leave reduziert Soll-Stunden (korrekt!)
- ✅ Sick/Vacation = Gutschrift auf Ist-Stunden

#### **User-spezifische Konfiguration:**
```typescript
interface User {
  weeklyHours: number;          // Individuell
  vacationDaysPerYear: number;  // Individuell
  hireDate: string;             // Für Soll-Berechnung
  endDate: string | null;       // Optional
}
```
- ✅ Jeder Mitarbeiter hat eigene Arbeitszeit-Vereinbarung
- ✅ Teilzeit 20h, 30h, 35h problemlos möglich

---

### 2.2 ❌ Was uns fehlt (Gaps)

#### **1. Arbeitszeitkonto-Konzept**
**Status:** ❌ Nicht vorhanden

**Was fehlt:**
- Keine explizite "Zeitkonto"-Tabelle
- Keine Plus-/Minus-Grenzen definiert
- Keine Saldovortrag-Funktion
- Keine Ausgleichszeitraum-Logik

**Aktuell:**
```typescript
// Wir haben nur "Überstunden"
overtime = actualHours - targetHours
```

**Best Practice (Personio/DATEV):**
```typescript
interface WorkTimeAccount {
  userId: number;
  currentBalance: number;      // Aktueller Saldo
  maxPlusHours: number;        // Max. Guthaben (z.B. +50h)
  maxMinusHours: number;       // Max. Schuld (z.B. -20h)
  balanceWarningThreshold: number; // Warnung bei Überschreitung
  compensationPeriodMonths: number; // Ausgleichszeitraum (3-6 Monate)
}
```

---

#### **2. Mehrarbeit vs. Überstunden (Teilzeit-spezifisch)**
**Status:** ❌ Nicht implementiert

**Problem:**
- Unser System kennt nur "Überstunden"
- Keine Unterscheidung zwischen Mehrarbeit (bis Vollzeit) und echten Überstunden (über Vollzeit)

**Best Practice (SAP SuccessFactors):**
```typescript
interface OvertimeCalculation {
  userId: number;
  weeklyHours: number;          // Vertraglich (z.B. 30h Teilzeit)
  fullTimeHours: number;        // Vollzeit-Referenz (z.B. 40h)
  workedHours: number;          // Tatsächlich gearbeitet (z.B. 38h)

  // Differenzierung:
  regularHours: number;         // 30h (vertraglich)
  additionalWork: number;       // 8h (Mehrarbeit, kein Zuschlag)
  overtimeWithPremium: number;  // 0h (keine echten Überstunden)
}
```

**Beispiel Teilzeit 30h/Woche:**
- Gearbeitet: 38h
- Mehrarbeit: 8h (30h → 38h, Normallohn)
- Überstunden: 0h (erst ab 40h Zuschlag)

**Aktuelles System:**
- Gearbeitet: 38h
- Überstunden: +8h (alles als Überstunden gezählt) ⚠️

---

#### **3. Flexible Arbeitszeitmodelle**
**Status:** ❌ Nicht vorhanden

**Was fehlt:**
- Keine Gleitzeit-Unterstützung
- Keine Kernzeit-Definition
- Keine Vertrauensarbeitszeit
- Keine 4-Tage-Woche-Modelle

**Best Practice (DATEV):**
```typescript
interface WorkSchedule {
  userId: number;
  model: 'fixed' | 'flextime' | 'trust_based';

  // Gleitzeit:
  coreTimeStart?: string;       // z.B. "09:00"
  coreTimeEnd?: string;         // z.B. "15:00"
  earliestStart?: string;       // z.B. "06:00"
  latestEnd?: string;           // z.B. "20:00"

  // Flexible Modelle:
  workDaysPerWeek?: number;     // z.B. 4 (4-Tage-Woche)
  hoursPerDay?: number[];       // [8, 8, 8, 8, 0] (Mo-Do)
}
```

---

#### **4. Zeitkonto-Historie & Saldovortrag**
**Status:** ⚠️ Teilweise vorhanden (aber nicht optimal)

**Was wir haben:**
- Monatliche `overtime_balance` Tabelle
- Historische Daten vorhanden

**Was fehlt:**
- Kein expliziter "Saldovortrag" zwischen Monaten/Jahren
- Keine Jahres-Übersicht mit Verlauf
- Keine automatische Warnung bei Grenzüberschreitung

**Best Practice (Personio):**
```typescript
interface TimeAccountHistory {
  userId: number;
  month: string;
  openingBalance: number;       // Anfangssaldo (Vortrag)
  workedHours: number;          // Gearbeitete Stunden
  targetHours: number;          // Soll-Stunden
  monthlyDelta: number;         // Differenz
  closingBalance: number;       // Endsaldo (= openingBalance + monthlyDelta)
  maxAllowedPlus: number;       // Obergrenze
  maxAllowedMinus: number;      // Untergrenze
  warningTriggered: boolean;    // Grenze überschritten?
}
```

---

#### **5. Stundenkonten-Arten (Differenzierung)**
**Status:** ❌ Nicht vorhanden

**Aktuell:**
- Nur ein "Überstunden-Konto"

**Best Practice (DATEV):**
```typescript
interface TimeAccounts {
  userId: number;

  // Verschiedene Konten:
  overtimeAccount: number;      // Überstunden (mit Zuschlag)
  flexTimeAccount: number;      // Gleitzeit (ohne Zuschlag)
  additionalWorkAccount: number; // Mehrarbeit Teilzeit (ohne Zuschlag)
  compensationAccount: number;  // Freizeitausgleich geplant
}
```

**Warum wichtig:**
- Steuerlich unterschiedlich behandelt
- Auszahlungs-Regeln unterschiedlich
- Verfallsfristen unterschiedlich

---

#### **6. Teilzeit-spezifische Reports & Analytics**
**Status:** ⚠️ Grundlagen vorhanden, aber nicht optimal

**Was fehlt:**
- Keine Mehrarbeit-Auswertung
- Kein "Zeitkonto-Entwicklung"-Chart
- Keine Warnung bei kritischen Salden
- Keine Prognose ("Bei aktuellem Trend: +80h in 3 Monaten")

**Best Practice (Personio/DATEV):**
```typescript
interface TimeAccountReport {
  userId: number;
  reportPeriod: string;

  // KPIs:
  currentBalance: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  projectedBalance3Months: number;
  averageWeeklyDelta: number;

  // Warnungen:
  warnings: Array<{
    type: 'max_plus' | 'max_minus' | 'compensation_overdue';
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }>;

  // Empfehlungen:
  recommendations: Array<{
    action: 'take_time_off' | 'work_more' | 'none';
    reason: string;
  }>;
}
```

---

#### **7. Automatische Zeitkonto-Verwaltung**
**Status:** ❌ Nicht vorhanden

**Was fehlt:**
- Keine automatische Warnung bei Grenzüberschreitung
- Keine automatische Erinnerung zum Abbau
- Keine automatische Verfalls-Logik
- Keine Benachrichtigungen

**Best Practice:**
```typescript
// Automatismen:
- Warnung bei +50h: "Bitte Überstunden abbauen"
- Warnung bei -20h: "Zeitschuld ausgleichen"
- Monatliche E-Mail: "Zeitkonto-Stand: +35h"
- Jahresende: "5h verfallen am 31.03. (gesetzliche Regelung)"
```

---

#### **8. Betriebsvereinbarungs-Compliance**
**Status:** ❌ Nicht vorhanden

**Was fehlt:**
- Keine Möglichkeit, Betriebsvereinbarungen zu hinterlegen
- Keine unternehmens-spezifischen Regeln
- Keine Abteilungs-spezifischen Zeitmodelle

**Best Practice:**
```typescript
interface CompanyTimeRules {
  companyId: number;

  // Unternehmensweite Regeln:
  maxOvertimeCarryover: number;     // Max. Überstunden-Vortrag ins neue Jahr
  overtimeExpiryDate: string;       // Verfallsdatum (z.B. "03-31")
  maxDailyHours: number;            // Max. Arbeitsstunden/Tag (ArbZG)
  minRestTime: number;              // Min. Ruhezeit (11h)

  // Abteilungs-Regeln:
  departmentRules: Array<{
    department: string;
    maxPlusHours: number;
    maxMinusHours: number;
    flexTimeAllowed: boolean;
  }>;
}
```

---

#### **9. Lohnarten-Integration**
**Status:** ❌ Nicht vorhanden

**Was fehlt:**
- Keine Lohnarten-Zuordnung (für DATEV-Export)
- Keine Zuschläge-Berechnung (Nacht, Feiertag, Sonntag)
- Keine Differenzierung nach Bezahlung

**Best Practice (DATEV):**
```typescript
interface PayrollIntegration {
  timeEntryId: number;

  // Lohnarten:
  payrollType:
    | 'regular'          // Normalstunden (Lohnart 1000)
    | 'overtime_25'      // Überstunden 25% (Lohnart 2000)
    | 'overtime_50'      // Überstunden 50% (Lohnart 2001)
    | 'night_shift'      // Nachtzuschlag (Lohnart 3000)
    | 'sunday'           // Sonntagszuschlag (Lohnart 3100)
    | 'holiday'          // Feiertagszuschlag (Lohnart 3200);

  hours: number;
  rate: number;          // Zuschlag in %
}
```

---

## 3. Gap-Analyse & Priorisierung

### 3.1 Feature-Vergleich Matrix

| Feature | Personio | DATEV | SAP | Unser System | Gap Severity |
|---------|----------|-------|-----|--------------|--------------|
| **Basis-Features** |
| Flexible weeklyHours | ✅ | ✅ | ✅ | ✅ | ✅ Vorhanden |
| Überstunden-Berechnung | ✅ | ✅ | ✅ | ✅ | ✅ Vorhanden |
| Abwesenheits-Management | ✅ | ✅ | ✅ | ✅ | ✅ Vorhanden |
| Feiertags-Berücksichtigung | ✅ | ✅ | ✅ | ✅ | ✅ Vorhanden |
| **Zeitkonto-Features** |
| Arbeitszeitkonto | ✅ | ✅ | ✅ | ❌ | 🔴 Hoch |
| Plus-/Minus-Grenzen | ✅ | ✅ | ✅ | ❌ | 🟡 Mittel |
| Saldovortrag | ✅ | ✅ | ✅ | ⚠️ | 🟡 Mittel |
| Zeitkonto-Historie | ✅ | ✅ | ✅ | ⚠️ | 🟡 Mittel |
| **Teilzeit-spezifisch** |
| Mehrarbeit vs. Überstunden | ⚠️ | ✅ | ✅ | ❌ | 🔴 Hoch |
| Teilzeit-Reports | ✅ | ✅ | ✅ | ⚠️ | 🟡 Mittel |
| **Flexible Modelle** |
| Gleitzeit | ✅ | ✅ | ✅ | ❌ | 🟠 Niedrig |
| Kernzeit-Definition | ✅ | ✅ | ✅ | ❌ | 🟠 Niedrig |
| Vertrauensarbeitszeit | ✅ | ⚠️ | ✅ | ❌ | 🟠 Niedrig |
| 4-Tage-Woche | ✅ | ✅ | ✅ | ⚠️ | 🟠 Niedrig |
| **Automatisierung** |
| Warnungen bei Grenzwerten | ✅ | ✅ | ✅ | ❌ | 🟡 Mittel |
| Automatische Benachrichtigungen | ✅ | ✅ | ✅ | ⚠️ | 🟡 Mittel |
| Abbau-Erinnerungen | ✅ | ✅ | ✅ | ❌ | 🟡 Mittel |
| **Compliance** |
| Betriebsvereinbarung-Regeln | ✅ | ✅ | ✅ | ❌ | 🟡 Mittel |
| 2-Jahres-Dokumentation | ✅ | ✅ | ✅ | ✅ | ✅ Vorhanden |
| **Lohn-Integration** |
| Lohnarten-Zuordnung | ✅ | ✅ | ✅ | ❌ | 🟠 Niedrig |
| Zuschläge-Berechnung | ✅ | ✅ | ✅ | ❌ | 🟠 Niedrig |

**Legende:**
- ✅ = Vollständig vorhanden
- ⚠️ = Teilweise vorhanden
- ❌ = Nicht vorhanden
- 🔴 Hoch = Kritische Lücke
- 🟡 Mittel = Wichtige Verbesserung
- 🟠 Niedrig = Nice-to-have

---

### 3.2 Priorisierte Gap-Liste

#### **🔴 Priorität 1: Kritische Features (Must-Have)**

**1. Arbeitszeitkonto-Konzept implementieren**
- **Problem:** Kein explizites Zeitkonto mit Salden
- **Impact:** Teilzeit-Mitarbeiter können Überstunden nicht korrekt verwalten
- **Complexity:** 🔴 Hoch
- **Empfehlung:** Neue Tabelle + UI + Logik

**2. Mehrarbeit vs. Überstunden (Teilzeit)**
- **Problem:** Alles wird als "Überstunden" gezählt, auch Mehrarbeit
- **Impact:** Rechtlich/steuerlich problematisch bei Teilzeit
- **Complexity:** 🟡 Mittel
- **Empfehlung:** Logik erweitern, neue Berechnung

---

#### **🟡 Priorität 2: Wichtige Verbesserungen (Should-Have)**

**3. Plus-/Minus-Grenzen & Warnungen**
- **Problem:** Keine automatische Warnung bei Grenzüberschreitung
- **Impact:** Mitarbeiter und Admins haben keine Kontrolle
- **Complexity:** 🟢 Niedrig
- **Empfehlung:** Settings + Notification-System

**4. Zeitkonto-Historie & Visualisierung**
- **Problem:** Keine übersichtliche Entwicklung über Zeit
- **Impact:** Intransparenz für Mitarbeiter
- **Complexity:** 🟡 Mittel
- **Empfehlung:** Chart + Tabelle mit Verlauf

**5. Saldovortrag zwischen Perioden**
- **Problem:** Kein expliziter Vortrag sichtbar
- **Impact:** Verwirrung bei Monatswechsel
- **Complexity:** 🟡 Mittel
- **Empfehlung:** "Anfangssaldo" + "Endsaldo" in UI

**6. Betriebsvereinbarungs-Settings**
- **Problem:** Keine unternehmens-spezifischen Regeln
- **Impact:** Nicht anpassbar für verschiedene Firmen
- **Complexity:** 🟡 Mittel
- **Empfehlung:** Admin-Settings für Zeitkonto-Regeln

---

#### **🟠 Priorität 3: Nice-to-Have Features**

**7. Gleitzeit-Modell**
- **Problem:** Nur feste Arbeitszeiten
- **Impact:** Weniger Flexibilität
- **Complexity:** 🔴 Hoch
- **Empfehlung:** Work Schedule + Kernzeit

**8. Differenzierte Zeitkonten**
- **Problem:** Nur ein "Überstunden-Konto"
- **Impact:** Keine Trennung Überstunden/Gleitzeit/Mehrarbeit
- **Complexity:** 🔴 Hoch
- **Empfehlung:** Mehrere Account-Typen

**9. Lohnarten-Integration**
- **Problem:** Keine Lohnarten für DATEV-Export
- **Impact:** Manuelle Nacharbeit nötig
- **Complexity:** 🟡 Mittel
- **Empfehlung:** Payroll-Modul

---

## 4. Implementierungs-Empfehlungen

### 4.1 🔴 Priorität 1: Arbeitszeitkonto (Must-Have)

#### **Datenbankschema:**
```sql
-- Neue Tabelle: work_time_accounts
CREATE TABLE IF NOT EXISTS work_time_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,

  -- Aktueller Saldo (kumuliert)
  currentBalance REAL NOT NULL DEFAULT 0,

  -- Regeln (pro User oder Firmenweite Defaults)
  maxPlusHours REAL NOT NULL DEFAULT 50,    -- Max. Guthaben
  maxMinusHours REAL NOT NULL DEFAULT 20,   -- Max. Schuld
  balanceWarningThreshold REAL DEFAULT 40,  -- Warnung ab +40h

  -- Ausgleichszeitraum
  compensationPeriodMonths INTEGER DEFAULT 6,

  -- Automatische Benachrichtigungen
  notifyOnWarning INTEGER DEFAULT 1,
  notifyOnExceeded INTEGER DEFAULT 1,

  -- Zeitstempel
  lastRecalculated TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(userId)
);

-- Neue Tabelle: work_time_account_history (Saldoverlauf)
CREATE TABLE IF NOT EXISTS work_time_account_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  accountId INTEGER NOT NULL,
  month TEXT NOT NULL,  -- YYYY-MM

  -- Salden
  openingBalance REAL NOT NULL,   -- Anfangssaldo (Vortrag)
  targetHours REAL NOT NULL,      -- Soll-Stunden Monat
  actualHours REAL NOT NULL,      -- Ist-Stunden Monat
  monthlyDelta REAL NOT NULL,     -- Differenz Monat
  closingBalance REAL NOT NULL,   -- Endsaldo (= opening + delta)

  -- Warnungen
  warningTriggered INTEGER DEFAULT 0,
  warningType TEXT,  -- 'max_plus' | 'max_minus' | null

  createdAt TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (accountId) REFERENCES work_time_accounts(id) ON DELETE CASCADE,
  UNIQUE(accountId, month)
);
```

#### **Backend Service:**
```typescript
// server/src/services/workTimeAccountService.ts

interface WorkTimeAccount {
  id: number;
  userId: number;
  currentBalance: number;
  maxPlusHours: number;
  maxMinusHours: number;
  balanceWarningThreshold: number;
  compensationPeriodMonths: number;
  notifyOnWarning: boolean;
  notifyOnExceeded: boolean;
  lastRecalculated: string;
}

interface WorkTimeAccountHistory {
  id: number;
  accountId: number;
  month: string;
  openingBalance: number;
  targetHours: number;
  actualHours: number;
  monthlyDelta: number;
  closingBalance: number;
  warningTriggered: boolean;
  warningType: 'max_plus' | 'max_minus' | null;
  createdAt: string;
}

/**
 * Get or create work time account for user
 */
export function getWorkTimeAccount(userId: number): WorkTimeAccount {
  // Check if account exists
  let account = db
    .prepare('SELECT * FROM work_time_accounts WHERE userId = ?')
    .get(userId) as WorkTimeAccount | undefined;

  if (!account) {
    // Create default account
    db.prepare(
      `INSERT INTO work_time_accounts (userId, currentBalance)
       VALUES (?, 0)`
    ).run(userId);

    account = db
      .prepare('SELECT * FROM work_time_accounts WHERE userId = ?')
      .get(userId) as WorkTimeAccount;
  }

  return account;
}

/**
 * Update work time account balance
 * Called after overtime_balance is updated
 */
export function updateWorkTimeAccountBalance(userId: number, month: string): void {
  const account = getWorkTimeAccount(userId);

  // Get monthly overtime data
  const monthlyData = db
    .prepare(
      `SELECT targetHours, actualHours, overtime
       FROM overtime_balance
       WHERE userId = ? AND month = ?`
    )
    .get(userId, month) as {
      targetHours: number;
      actualHours: number;
      overtime: number;
    };

  if (!monthlyData) return;

  // Get previous month's closing balance (or 0 if first month)
  const prevMonth = getPreviousMonth(month);
  const prevHistory = db
    .prepare(
      `SELECT closingBalance FROM work_time_account_history
       WHERE accountId = ? AND month = ?`
    )
    .get(account.id, prevMonth) as { closingBalance: number } | undefined;

  const openingBalance = prevHistory?.closingBalance || 0;
  const monthlyDelta = monthlyData.overtime;
  const closingBalance = openingBalance + monthlyDelta;

  // Check warnings
  let warningTriggered = false;
  let warningType: 'max_plus' | 'max_minus' | null = null;

  if (closingBalance > account.maxPlusHours) {
    warningTriggered = true;
    warningType = 'max_plus';

    if (account.notifyOnExceeded) {
      // Send notification
      notificationService.create({
        userId,
        type: 'time_account_exceeded',
        title: 'Zeitkonto-Obergrenze überschritten',
        message: `Ihr Zeitkonto-Guthaben (${closingBalance.toFixed(1)}h) überschreitet die Obergrenze (${account.maxPlusHours}h). Bitte bauen Sie Überstunden ab.`,
      });
    }
  } else if (closingBalance < -account.maxMinusHours) {
    warningTriggered = true;
    warningType = 'max_minus';

    if (account.notifyOnExceeded) {
      // Send notification
      notificationService.create({
        userId,
        type: 'time_account_exceeded',
        title: 'Zeitkonto-Untergrenze unterschritten',
        message: `Ihr Zeitkonto-Schuld (${closingBalance.toFixed(1)}h) überschreitet die Untergrenze (-${account.maxMinusHours}h). Bitte gleichen Sie die Zeitschuld aus.`,
      });
    }
  } else if (Math.abs(closingBalance) > account.balanceWarningThreshold) {
    // Warning threshold reached
    if (account.notifyOnWarning) {
      notificationService.create({
        userId,
        type: 'time_account_warning',
        title: 'Zeitkonto-Warnung',
        message: `Ihr Zeitkonto-Saldo (${closingBalance > 0 ? '+' : ''}${closingBalance.toFixed(1)}h) nähert sich der Grenze. Bitte gleichen Sie aus.`,
      });
    }
  }

  // Upsert history entry
  db.prepare(
    `INSERT INTO work_time_account_history
     (accountId, month, openingBalance, targetHours, actualHours, monthlyDelta, closingBalance, warningTriggered, warningType)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(accountId, month)
     DO UPDATE SET
       openingBalance = ?,
       targetHours = ?,
       actualHours = ?,
       monthlyDelta = ?,
       closingBalance = ?,
       warningTriggered = ?,
       warningType = ?`
  ).run(
    account.id, month, openingBalance, monthlyData.targetHours, monthlyData.actualHours,
    monthlyDelta, closingBalance, warningTriggered ? 1 : 0, warningType,
    // UPDATE values
    openingBalance, monthlyData.targetHours, monthlyData.actualHours,
    monthlyDelta, closingBalance, warningTriggered ? 1 : 0, warningType
  );

  // Update account's current balance
  db.prepare(
    `UPDATE work_time_accounts
     SET currentBalance = ?, lastRecalculated = datetime('now')
     WHERE id = ?`
  ).run(closingBalance, account.id);
}

/**
 * Get work time account history (for charts/reports)
 */
export function getWorkTimeAccountHistory(
  userId: number,
  fromMonth: string,
  toMonth: string
): WorkTimeAccountHistory[] {
  const account = getWorkTimeAccount(userId);

  return db
    .prepare(
      `SELECT * FROM work_time_account_history
       WHERE accountId = ? AND month >= ? AND month <= ?
       ORDER BY month ASC`
    )
    .all(account.id, fromMonth, toMonth) as WorkTimeAccountHistory[];
}

// Helper
function getPreviousMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year, mon - 1, 1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
```

#### **Frontend UI (React):**
```typescript
// desktop/src/components/dashboard/TimeAccountCard.tsx

import { Card } from '../ui/Card';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface TimeAccountCardProps {
  userId: number;
}

export function TimeAccountCard({ userId }: TimeAccountCardProps) {
  const { data: account, isLoading } = useQuery({
    queryKey: ['work-time-account', userId],
    queryFn: async () => {
      const res = await apiClient.get(`/work-time-account/${userId}`);
      return res.data as WorkTimeAccount;
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!account) return null;

  const balance = account.currentBalance;
  const isPositive = balance >= 0;
  const isWarning = Math.abs(balance) > account.balanceWarningThreshold;
  const isExceeded = balance > account.maxPlusHours || balance < -account.maxMinusHours;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Arbeitszeitkonto
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Aktueller Saldo
          </p>
        </div>

        {isPositive ? (
          <TrendingUp className="w-8 h-8 text-green-600" />
        ) : (
          <TrendingDown className="w-8 h-8 text-red-600" />
        )}
      </div>

      <div className="mt-4">
        <div className={`text-3xl font-bold ${
          isExceeded ? 'text-red-600' :
          isWarning ? 'text-yellow-600' :
          isPositive ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'
        }`}>
          {isPositive ? '+' : ''}{balance.toFixed(1)}h
        </div>

        {isExceeded && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span>Grenze überschritten!</span>
          </div>
        )}

        {isWarning && !isExceeded && (
          <div className="mt-2 flex items-center gap-2 text-sm text-yellow-600">
            <AlertTriangle className="w-4 h-4" />
            <span>Warnschwelle erreicht</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <div>
          <span>Obergrenze: </span>
          <span className="font-medium">+{account.maxPlusHours}h</span>
        </div>
        <div>
          <span>Untergrenze: </span>
          <span className="font-medium">-{account.maxMinusHours}h</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              isExceeded ? 'bg-red-600' :
              isWarning ? 'bg-yellow-500' :
              'bg-green-600'
            }`}
            style={{
              width: `${Math.min(100, (Math.abs(balance) / account.maxPlusHours) * 100)}%`,
              marginLeft: isPositive ? '50%' : 'auto',
              marginRight: isPositive ? 'auto' : '50%',
            }}
          />
        </div>
      </div>
    </Card>
  );
}
```

#### **Integration in bestehenden Code:**
```typescript
// server/src/services/overtimeService.ts

// NACH updateMonthlyOvertime():
export function updateMonthlyOvertime(userId: number, month: string): void {
  // ... bestehende Logik ...

  // NEU: Update work time account
  workTimeAccountService.updateWorkTimeAccountBalance(userId, month);
}
```

#### **Complexity:** 🔴 Hoch
- Neue Tabellen
- Neue Service-Logik
- UI-Komponenten
- Integration in bestehendes System

#### **Estimated Effort:** ~3-5 Tage

---

### 4.2 🔴 Priorität 1: Mehrarbeit vs. Überstunden

#### **Problem:**
Aktuell zählen wir ALLE Stunden über Soll als "Überstunden". Bei Teilzeit ist das nicht korrekt:
- Teilzeit 30h/Woche → Arbeit bis 40h = **Mehrarbeit** (kein Zuschlag)
- Erst ab 40h = **Überstunden** (mit Zuschlag)

#### **Lösung: Neue Berechnung**

```typescript
// server/src/services/overtimeService.ts

interface OvertimeBreakdown {
  regularHours: number;        // Vertragsstunden
  additionalWork: number;      // Mehrarbeit (bis Vollzeit)
  overtimeHours: number;       // Überstunden (ab Vollzeit)
  totalWorkedHours: number;    // Gesamt gearbeitet
  overtimePremium25: number;   // Überstunden mit 25% Zuschlag
  overtimePremium50: number;   // Überstunden mit 50% Zuschlag
}

/**
 * Calculate overtime breakdown for part-time employees
 * Differentiates between "Mehrarbeit" and "Überstunden"
 */
export function calculateOvertimeBreakdown(
  userId: number,
  month: string
): OvertimeBreakdown {
  // Get user data
  const user = db
    .prepare('SELECT weeklyHours FROM users WHERE id = ?')
    .get(userId) as { weeklyHours: number };

  // Get company full-time hours (default: 40h)
  const fullTimeHours = getCompanyFullTimeHours(); // z.B. 40

  // Get monthly overtime data
  const monthlyData = getMonthlyOvertime(userId, month);
  if (!monthlyData) {
    return {
      regularHours: 0,
      additionalWork: 0,
      overtimeHours: 0,
      totalWorkedHours: 0,
      overtimePremium25: 0,
      overtimePremium50: 0,
    };
  }

  const totalWorkedHours = monthlyData.actualHours;
  const contractHours = monthlyData.targetHours;

  // Calculate breakdown
  const regularHours = Math.min(totalWorkedHours, contractHours);

  let additionalWork = 0;
  let overtimeHours = 0;

  if (totalWorkedHours > contractHours) {
    // Hours beyond contract
    const excessHours = totalWorkedHours - contractHours;

    // If part-time: differentiate Mehrarbeit vs. Überstunden
    if (user.weeklyHours < fullTimeHours) {
      // Calculate how many hours until full-time
      const hoursToFullTime = (fullTimeHours - user.weeklyHours) / user.weeklyHours * contractHours;

      // Mehrarbeit: from contract to full-time equivalent
      additionalWork = Math.min(excessHours, hoursToFullTime);

      // Überstunden: beyond full-time equivalent
      overtimeHours = Math.max(0, excessHours - hoursToFullTime);
    } else {
      // Full-time employee: all excess = overtime
      overtimeHours = excessHours;
    }
  }

  // Calculate premium hours (25% for first 2h/day, 50% beyond)
  // Simplified: all overtime with 25% for now
  const overtimePremium25 = overtimeHours;
  const overtimePremium50 = 0; // TODO: Calculate based on daily breakdown

  return {
    regularHours,
    additionalWork,
    overtimeHours,
    totalWorkedHours,
    overtimePremium25,
    overtimePremium50,
  };
}

/**
 * Get company's full-time hours reference
 * Can be configured in settings
 */
function getCompanyFullTimeHours(): number {
  // TODO: Make configurable in settings
  return 40;
}
```

#### **UI-Darstellung:**
```typescript
// desktop/src/components/overtime/OvertimeBreakdownCard.tsx

export function OvertimeBreakdownCard({ userId, month }: Props) {
  const { data } = useQuery({
    queryKey: ['overtime-breakdown', userId, month],
    queryFn: async () => {
      const res = await apiClient.get(`/overtime/breakdown/${userId}/${month}`);
      return res.data as OvertimeBreakdown;
    },
  });

  if (!data) return null;

  return (
    <Card>
      <h3>Stunden-Aufschlüsselung</h3>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Vertragsstunden:</span>
          <span className="font-semibold">{data.regularHours.toFixed(1)}h</span>
        </div>

        {data.additionalWork > 0 && (
          <div className="flex justify-between text-blue-600">
            <span>Mehrarbeit (ohne Zuschlag):</span>
            <span className="font-semibold">+{data.additionalWork.toFixed(1)}h</span>
          </div>
        )}

        {data.overtimeHours > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Überstunden (mit Zuschlag):</span>
            <span className="font-semibold">+{data.overtimeHours.toFixed(1)}h</span>
          </div>
        )}

        <hr />

        <div className="flex justify-between font-bold">
          <span>Gesamt gearbeitet:</span>
          <span>{data.totalWorkedHours.toFixed(1)}h</span>
        </div>
      </div>
    </Card>
  );
}
```

#### **Complexity:** 🟡 Mittel
- Neue Berechnungslogik
- Neue API-Endpoints
- UI-Anpassungen

#### **Estimated Effort:** ~2-3 Tage

---

### 4.3 🟡 Priorität 2: Plus-/Minus-Grenzen & Warnungen

**Bereits in 4.1 (Arbeitszeitkonto) enthalten!**

Die `work_time_accounts` Tabelle enthält:
- `maxPlusHours`
- `maxMinusHours`
- `balanceWarningThreshold`
- Automatische Benachrichtigungen

**Zusätzlich: Admin-UI für Settings**

```typescript
// desktop/src/pages/TimeAccountSettingsPage.tsx

export function TimeAccountSettingsPage() {
  const { data: settings } = useQuery({
    queryKey: ['time-account-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/time-accounts');
      return res.data as TimeAccountSettings;
    },
  });

  return (
    <div>
      <h1>Arbeitszeitkonto-Einstellungen</h1>

      <Card>
        <h2>Unternehmensweite Standardwerte</h2>

        <Input
          label="Maximales Zeitguthaben (Stunden)"
          type="number"
          value={settings?.defaultMaxPlusHours || 50}
          onChange={...}
        />

        <Input
          label="Maximale Zeitschuld (Stunden)"
          type="number"
          value={settings?.defaultMaxMinusHours || 20}
          onChange={...}
        />

        <Input
          label="Warnschwelle (Stunden)"
          type="number"
          value={settings?.defaultWarningThreshold || 40}
          onChange={...}
        />

        <Input
          label="Ausgleichszeitraum (Monate)"
          type="number"
          value={settings?.defaultCompensationPeriod || 6}
          onChange={...}
        />

        <Checkbox
          label="Benachrichtigungen bei Warnung"
          checked={settings?.notifyOnWarning}
          onChange={...}
        />

        <Checkbox
          label="Benachrichtigungen bei Grenzüberschreitung"
          checked={settings?.notifyOnExceeded}
          onChange={...}
        />

        <Button onClick={saveSettings}>Speichern</Button>
      </Card>
    </div>
  );
}
```

#### **Complexity:** 🟢 Niedrig (UI-Layer über bestehende Daten)
#### **Estimated Effort:** ~1 Tag

---

### 4.4 🟡 Priorität 2: Zeitkonto-Historie & Visualisierung

```typescript
// desktop/src/components/charts/TimeAccountHistoryChart.tsx

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export function TimeAccountHistoryChart({ userId, year }: Props) {
  const { data } = useQuery({
    queryKey: ['time-account-history', userId, year],
    queryFn: async () => {
      const res = await apiClient.get(`/work-time-account/${userId}/history?year=${year}`);
      return res.data as WorkTimeAccountHistory[];
    },
  });

  if (!data) return <LoadingSpinner />;

  // Transform data for chart
  const chartData = data.map(entry => ({
    month: entry.month,
    saldo: entry.closingBalance,
    target: 0, // Zero line
    maxPlus: entry.account.maxPlusHours,
    maxMinus: -entry.account.maxMinusHours,
  }));

  return (
    <Card>
      <h3>Zeitkonto-Entwicklung {year}</h3>

      <LineChart width={800} height={400} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis label={{ value: 'Stunden', angle: -90 }} />
        <Tooltip />
        <Legend />

        {/* Zero line */}
        <Line
          type="monotone"
          dataKey="target"
          stroke="#gray"
          strokeDasharray="5 5"
          dot={false}
        />

        {/* Max lines */}
        <Line
          type="monotone"
          dataKey="maxPlus"
          stroke="#ef4444"
          strokeDasharray="3 3"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="maxMinus"
          stroke="#ef4444"
          strokeDasharray="3 3"
          dot={false}
        />

        {/* Actual balance */}
        <Line
          type="monotone"
          dataKey="saldo"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={{ fill: '#3b82f6', r: 4 }}
        />
      </LineChart>

      <div className="mt-4">
        <h4>Monatliche Übersicht</h4>
        <table className="w-full">
          <thead>
            <tr>
              <th>Monat</th>
              <th>Anfangssaldo</th>
              <th>Soll</th>
              <th>Ist</th>
              <th>Differenz</th>
              <th>Endsaldo</th>
            </tr>
          </thead>
          <tbody>
            {data.map(entry => (
              <tr key={entry.month}>
                <td>{entry.month}</td>
                <td>{entry.openingBalance.toFixed(1)}h</td>
                <td>{entry.targetHours.toFixed(1)}h</td>
                <td>{entry.actualHours.toFixed(1)}h</td>
                <td className={entry.monthlyDelta >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {entry.monthlyDelta >= 0 ? '+' : ''}{entry.monthlyDelta.toFixed(1)}h
                </td>
                <td className="font-bold">
                  {entry.closingBalance >= 0 ? '+' : ''}{entry.closingBalance.toFixed(1)}h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
```

#### **Complexity:** 🟡 Mittel (Chart-Integration)
#### **Estimated Effort:** ~2 Tage

---

### 4.5 🟠 Priorität 3: Gleitzeit-Modell (Optional)

**Nur implementieren, wenn Bedarf besteht!**

```sql
-- Neue Tabelle: work_schedules
CREATE TABLE IF NOT EXISTS work_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,

  -- Modell-Typ
  model TEXT NOT NULL CHECK(model IN ('fixed', 'flextime', 'trust_based')),

  -- Gleitzeit-Optionen
  coreTimeStart TEXT,      -- z.B. "09:00"
  coreTimeEnd TEXT,        -- z.B. "15:00"
  earliestStart TEXT,      -- z.B. "06:00"
  latestEnd TEXT,          -- z.B. "20:00"

  -- Flexible Modelle
  workDaysPerWeek INTEGER DEFAULT 5,

  -- Aktiv ab
  validFrom TEXT NOT NULL,
  validTo TEXT,

  createdAt TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

**UI:**
- Gleitzeit-Einstellung pro User
- Validierung: TimeEntries innerhalb Gleitzeit-Fenster
- Warnung bei Kernzeit-Verletzung

#### **Complexity:** 🔴 Hoch (neue Validierungslogik)
#### **Estimated Effort:** ~5-7 Tage

---

## 5. Zusammenfassung & Roadmap

### 5.1 Was wir gut machen ✅

1. **Flexible Teilzeit-Unterstützung**
   - `weeklyHours` individuell konfigurierbar
   - Korrekte Soll-Berechnung für jede Wochenstundenzahl

2. **Professionelle Überstunden-Berechnung**
   - Best-Practice-Formel: `Überstunden = Ist - Soll`
   - Berücksichtigung von Feiertagen & Wochenenden
   - Abwesenheits-Gutschriften korrekt umgesetzt

3. **Granulares Tracking**
   - Täglich, wöchentlich, monatlich
   - Historische Daten für Analysen

4. **DSGVO-konform**
   - Privacy Consent
   - Datenexport-Funktion
   - Soft Delete

### 5.2 Prioritäre Verbesserungen (Roadmap)

#### **Phase 1: Arbeitszeitkonto (Q1 2025)**
- ✅ Implementierung `work_time_accounts` Tabelle
- ✅ Plus-/Minus-Grenzen & Warnungen
- ✅ Automatische Benachrichtigungen
- ✅ Zeitkonto-Historie & Visualisierung
- **Aufwand:** ~5-7 Tage
- **Impact:** 🔴 Hoch

#### **Phase 2: Teilzeit-Features (Q2 2025)**
- ✅ Mehrarbeit vs. Überstunden Differenzierung
- ✅ Teilzeit-spezifische Reports
- ✅ Verbesserte Dashboards
- **Aufwand:** ~3-4 Tage
- **Impact:** 🔴 Hoch

#### **Phase 3: Compliance & Settings (Q2 2025)**
- ✅ Betriebsvereinbarungs-Einstellungen
- ✅ Admin-UI für Zeitkonto-Regeln
- ✅ Abteilungs-spezifische Konfiguration
- **Aufwand:** ~2-3 Tage
- **Impact:** 🟡 Mittel

#### **Phase 4: Optional Features (Q3 2025+)**
- ⚠️ Gleitzeit-Modell (nur bei Bedarf)
- ⚠️ Differenzierte Zeitkonten
- ⚠️ Lohnarten-Integration
- **Aufwand:** ~10-15 Tage
- **Impact:** 🟠 Niedrig (Nice-to-have)

### 5.3 Geschätzter Gesamt-Aufwand

| Phase | Features | Aufwand | Priorität |
|-------|----------|---------|-----------|
| Phase 1 | Arbeitszeitkonto | 5-7 Tage | 🔴 Must-Have |
| Phase 2 | Teilzeit-Features | 3-4 Tage | 🔴 Must-Have |
| Phase 3 | Compliance & Settings | 2-3 Tage | 🟡 Should-Have |
| **Gesamt (MVP)** | | **10-14 Tage** | |
| Phase 4 | Optional | 10-15 Tage | 🟠 Nice-to-Have |

---

## 6. Fazit & Empfehlung

### 6.1 Kernaussagen

1. **Solide Basis vorhanden**
   - Unser System unterstützt Teilzeit bereits gut durch flexible `weeklyHours`
   - Überstunden-Berechnung ist professionell und Best-Practice-konform
   - Keine kritischen Fehler oder Compliance-Probleme

2. **Wichtigste Lücke: Arbeitszeitkonto**
   - Professionelle HR-Software nutzt Zeitkonten mit Salden
   - Wir haben nur "Überstunden" ohne explizites Konto-Konzept
   - Fehlende Plus-/Minus-Grenzen und Warnungen

3. **Teilzeit-spezifische Features fehlen**
   - Keine Unterscheidung Mehrarbeit vs. Überstunden
   - Wichtig für Rechtssicherheit und Transparenz bei Teilzeit

### 6.2 Empfohlenes Vorgehen

**Sofort starten (Must-Have):**
1. ✅ **Arbeitszeitkonto implementieren** (Phase 1)
   - Neue Tabellen `work_time_accounts` + `work_time_account_history`
   - Automatische Benachrichtigungen
   - Zeitkonto-Historie & Chart

2. ✅ **Mehrarbeit vs. Überstunden** (Phase 2)
   - Neue Berechnungslogik
   - Teilzeit-spezifische Auswertungen

**Kurzfristig (Should-Have):**
3. ✅ **Settings & Compliance** (Phase 3)
   - Admin-UI für Zeitkonto-Regeln
   - Betriebsvereinbarungs-Einstellungen

**Langfristig (Nice-to-Have):**
4. ⚠️ **Gleitzeit & Advanced Features** (Phase 4)
   - Nur bei konkretem Kunden-Bedarf

### 6.3 ROI-Bewertung

**Investment:** ~10-14 Tage Entwicklung (Phase 1-3)

**Benefits:**
- ✅ Wettbewerbsfähig mit Personio/DATEV
- ✅ Rechtssicherheit bei Teilzeit
- ✅ Mitarbeiter-Transparenz (Self-Service)
- ✅ Automatisierung (weniger Admin-Aufwand)
- ✅ Zukunftssicher (2025 Zeiterfassungspflicht)

**Recommendation:** ⭐⭐⭐⭐⭐ (5/5)
- Hoher Business Value
- Überschaubarer Aufwand
- Klare Priorisierung möglich

---

## Anhang: Kontakt & Ressourcen

### Externe Dokumentation
- [Personio Arbeitszeitkonto Guide](https://www.personio.de/hr-lexikon/arbeitszeitkonto/)
- [DATEV Zeiterfassung](https://www.datev.de/web/de/marktplatz/timecard-zeiterfassung)
- [SAP SuccessFactors Time Management](https://learning.sap.com/learning-journeys/configuring-sap-successfactors-time-management)
- [Haufe Arbeitsrecht Arbeitszeitkonto](https://www.haufe.de/personal/arbeitsrecht/arbeitszeitkonto-rechtliche-vorgaben-fuer-arbeitgeber_76_445170.html)

### Rechtliche Grundlagen
- [Arbeitszeitgesetz (ArbZG)](https://www.gesetze-im-internet.de/arbzg/)
- [Mindestlohngesetz (MiLoG)](https://www.gesetze-im-internet.de/milog/)
- [Betriebsverfassungsgesetz (BetrVG) § 87](https://www.gesetze-im-internet.de/betrvg/__87.html)

---

**Ende der Analyse**

*Erstellt am: 2025-11-20*
*Autor: TimeTracking System Development Team*
*Version: 1.0*
