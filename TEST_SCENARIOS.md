# TimeTracking System - Test Szenarien & Erwartete Ergebnisse

## Übersicht

Dieses Dokument beschreibt konkrete Test-Szenarien für das TimeTracking System mit **exakten erwarteten Ergebnissen**, die du im Programm nachvollziehen kannst.

---

## 📅 Test-Zeitraum: Januar 2025

**Referenz-Datum:** 31. Januar 2025 (Freitag)
**Arbeitstage im Januar 2025:** 23 Tage (Mo-Fr, ohne Feiertage)
- Feiertag: 1. Januar (Neujahr) = Mittwoch
- Feiertag: 6. Januar (Heilige Drei Könige) = Montag

**Kalendertage:** 31
**Wochenendtage:** 8 (4 Samstage + 4 Sonntage)
**Feiertage (Werktags):** 2
**Netto Arbeitstage:** 31 - 8 - 2 = **21 Arbeitstage**

---

## 👤 Test-Mitarbeiter 1: Alice Developer (Normaler Fall)

### Stammdaten
- **Name:** Alice Developer
- **Username:** alice_test
- **Eintrittsdatum:** 01.01.2025
- **Wochenstunden:** 40h
- **Urlaubstage/Jahr:** 30

### Arbeitszeit im Januar 2025
- **Gearbeitete Tage:** 14 Tage (02.-03., 07.-10., 13.-17., 20.-22. Januar)
- **Arbeitszeit pro Tag:** 09:00-17:30 (8h mit 30min Pause)
- **Kranktage:** 2 Tage (23.-24. Januar, Do-Fr)
- **Urlaubstage:** 0

### 📊 Erwartete Ergebnisse (Stand: 31.01.2025)

#### Zeitkonto
- **Soll-Stunden:** 21 Tage × 8h = **168h**
- **Ist-Stunden:**
  - Gearbeitet: 14 Tage × 8h = 112h
  - Kranken-Gutschrift: 2 Tage × 8h = 16h
  - **Summe: 128h**
- **Überstunden:** 128h - 168h = **-40h** (Minusstunden)

#### Urlaubskonto
- **Anspruch 2025:** 30 Tage
- **Verbraucht:** 0 Tage
- **Übertrag:** 0 Tage
- **Verfügbar:** **30 Tage**

---

## 👤 Test-Mitarbeiter 2: Bob Senior (Überstunden-Fall)

### Stammdaten
- **Name:** Bob Senior
- **Username:** bob_test
- **Eintrittsdatum:** 01.01.2025
- **Wochenstunden:** 40h
- **Urlaubstage/Jahr:** 30

### Arbeitszeit im Januar 2025
- **Gearbeitete Tage:** 21 Tage (alle Arbeitstage)
- **Arbeitszeit:**
  - **Woche 1 (02.-03.01):** 2 Tage × 10h (09:00-19:30, 30min Pause) = 20h
  - **Woche 2 (07.-10.01):** 4 Tage × 10h = 40h
  - **Woche 3 (13.-17.01):** 5 Tage × 8h = 40h
  - **Woche 4 (20.-24.01):** 5 Tage × 8h = 40h
  - **Woche 5 (27.-31.01):** 5 Tage × 8h = 40h
- **Kranktage:** 0
- **Urlaubstage:** 0

### 📊 Erwartete Ergebnisse (Stand: 31.01.2025)

#### Zeitkonto
- **Soll-Stunden:** 21 Tage × 8h = **168h**
- **Ist-Stunden:** 20h + 40h + 40h + 40h + 40h = **180h**
- **Überstunden:** 180h - 168h = **+12h** (Plus)

#### Urlaubskonto
- **Anspruch 2025:** 30 Tage
- **Verbraucht:** 0 Tage
- **Verfügbar:** **30 Tage**

---

## 👤 Test-Mitarbeiter 3: Charlie Manager (Gemischter Fall)

### Stammdaten
- **Name:** Charlie Manager
- **Username:** charlie_test
- **Eintrittsdatum:** 01.01.2025
- **Wochenstunden:** 40h
- **Urlaubstage/Jahr:** 30

### Arbeitszeit im Januar 2025
- **Gearbeitete Tage:** 11 Tage (02.-03., 07.-10., 13.-17. Januar)
- **Arbeitszeit:** 11 Tage × 8h = 88h
- **Urlaubstage:** 5 Tage (20.-24. Januar, Mo-Fr)
- **Kranktage:** 2 Tage (27.-28. Januar, Mo-Di)

### 📊 Erwartete Ergebnisse (Stand: 31.01.2025)

#### Zeitkonto
- **Soll-Stunden:** 21 Tage × 8h = **168h**
- **Ist-Stunden:**
  - Gearbeitet: 11 Tage × 8h = 88h
  - Urlaubs-Gutschrift: 5 Tage × 8h = 40h
  - Kranken-Gutschrift: 2 Tage × 8h = 16h
  - **Summe: 144h**
- **Überstunden:** 144h - 168h = **-24h** (Minusstunden)

#### Urlaubskonto
- **Anspruch 2025:** 30 Tage
- **Verbraucht:** 5 Tage
- **Verfügbar:** **25 Tage**

---

## 🧪 Verifikation

### Manuelle Überprüfung im Programm

1. **Login** als Admin
2. **Dashboard öffnen**
3. **Mitarbeiter auswählen** (Alice, Bob, oder Charlie)
4. **Überprüfen:**
   - Soll-Stunden
   - Ist-Stunden
   - Überstunden
   - Urlaubstage verfügbar

### Automatische Verifikation

```bash
cd server
npm run verify-test-data
```

Dieses Script:
- Liest die Daten aus der DB
- Berechnet die erwarteten Werte
- Vergleicht mit tatsächlichen Werten
- Zeigt Abweichungen an

---

## 📝 Hinweise

### ArbZG-Regeln (werden korrekt validiert)
- Max. 10h pro Tag
- Min. 30min Pause bei >6h Arbeit
- Min. 11h Ruhezeit zwischen Schichten

### Abwesenheits-Gutschriften
- ✅ **Urlaub:** Volle Gutschrift (8h/Tag)
- ✅ **Krankheit:** Volle Gutschrift (8h/Tag)
- ❌ **Unbezahlter Urlaub:** Keine Gutschrift + reduziertes Soll

### Feiertage
- Feiertage sind **bereits im Soll berücksichtigt**
- Feiertage reduzieren die Arbeitstage
- Keine manuelle Anpassung nötig

---

**Erstellt:** 06. Dezember 2025
**Letzte Aktualisierung:** 06. Dezember 2025
