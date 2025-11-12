# Übergabeprotokoll - TimeTracking System
**Datum:** 2025-11-12
**Session:** Bug-Fixes (Überstunden, Notifications, Absences)

---

## ✅ ERFOLGREICH GEFIXT

### 1. Überstunden-Berechnung (KRITISCH)
**Problem:** Abwesenheiten VOR dem Eintrittsdatum wurden als Credits gezählt
- Admin hatte Krankmeldung am 07.11.2025
- Eintrittsdatum war aber erst 10.11.2025
- System zählte 8h Credit für einen Tag VOR der Anstellung!

**Fix:** SQL-Queries in `overtimeService.ts` angepasst
```typescript
// Zeilen 241, 255, 546, 560
AND startDate >= ? (hireDate Check)
```

**Commit:** `8eefc02`

### 2. Notifications "Markieren als gelesen" Bug
**Problem:** `TypeError: undefined is not an object (evaluating 'old.rows.map')`
- App crashed beim Klick auf "Markieren als gelesen"
- `old.rows` war undefined

**Fix:** Null-Check in `useNotifications.ts` hinzugefügt
```typescript
if (!old.rows || !Array.isArray(old.rows)) {
  return old;
}
```

**Commit:** `8eefc02`

### 3. Abwesenheitsanträge werden nicht angezeigt (Admin)
**Problem:** API gab 500 Error zurück
- SQL Syntax Error: `no such column: "%Y"`
- `strftime("%Y")` brauchte Single Quotes

**Fix:** `absenceService.ts` Zeilen 368, 373
```typescript
// VORHER: strftime("%Y", ar.startDate)
// NACHHER: strftime('%Y', ar.startDate)
```

**Commit:** `65f8c15`

---

## 🗄️ DATENBANK STATUS

**Wiederhergestellt aus Backup:** `database-backup-2025-11-11T01-00-01-243Z.db`

**User-Daten:**
- ID 1: System Administrator (admin)
- ID 2: Max Test (MaxTest)

**Credentials:**
- Admin: `admin` / `admin1234`
- MaxTest: `MaxTest` / `Test12345`

**Überstunden-Daten:** Gelöscht (werden beim nächsten time_entry neu berechnet)

---

## ⚠️ WICHTIGE ERKENNTNISSE

### KATASTROPHALE FEHLER (Lessons Learned)

1. **NIEMALS mehrere Server gleichzeitig starten!**
   - In dieser Session: 6 Background-Prozesse gleichzeitig
   - Resultat: Port-Konflikte, inkonsistente Daten, totales Chaos

2. **IMMER vor Änderungen Backup machen!**
   - Ich habe die Production-DB (`database.db`) überschrieben
   - Glücklicherweise gab es Auto-Backups

3. **Datenbank-Verzeichnis-Chaos**
   - `database.db` (Root) = Production
   - `server/database.db` = Development
   - Server verwendet unterschiedliche DBs je nach Start-Verzeichnis!

4. **Prozess-Management ist KRITISCH**
   - Immer `./stop-dev.sh` BEVOR neuer Start
   - NIEMALS Background-Jobs mit `&` stapeln

---

## 🚀 SO STARTET MAN DAS SYSTEM RICHTIG

**EINZIGER korrekter Weg:**

```bash
# 1. STOPPEN (falls läuft)
./stop-dev.sh

# 2. WARTEN
sleep 3

# 3. STARTEN (NUR EINMAL!)
./SIMPLE-START.sh
```

**NIEMALS:**
- ❌ Mehrere `npm run dev` parallel
- ❌ Background-Jobs mit `&` ohne Prozess-Management
- ❌ Server in unterschiedlichen Verzeichnissen starten

---

## 📊 COMMITS DIESER SESSION

```
8eefc02 - fix: Critical bugs - overtime calculation & notifications
65f8c15 - fix: Absences API - SQL syntax error with strftime
```

---

## 🔴 OFFENE PROBLEME

### 1. Privacy Consent
**Status:** Unklar - User sagte "Fehler beim Akzeptieren"
**Genaue Fehlermeldung:** Nicht bekannt
**Backend:** Endpoint existiert und sieht korrekt aus
**Nächster Schritt:** Genauer Fehler in Browser Console prüfen

### 2. Server läuft aktuell NICHT
**Grund:** Prozess-Chaos während der Session
**Lösung:**
1. Mac neu starten (killt ALLE Prozesse sauber)
2. `./SIMPLE-START.sh` ausführen
3. App sollte auf http://localhost:1420 laufen

---

## ✅ FINALE CHECKLISTE

Vor dem nächsten Start:

- [ ] Mac neu gestartet (empfohlen!)
- [ ] `./stop-dev.sh` ausgeführt
- [ ] Nur `./SIMPLE-START.sh` EINMAL ausführen
- [ ] Warten bis Health Check OK (10-15 Sekunden)
- [ ] http://localhost:1420 öffnen
- [ ] Login testen (admin / admin1234)
- [ ] Überstunden prüfen (sollten korrekt sein)
- [ ] Notifications "Markieren als gelesen" testen
- [ ] Abwesenheitsanträge prüfen (als Admin)

---

## 🎯 ERWARTETE WERTE (nach Fix)

**System Administrator (ID 1):**
- Eintrittsdatum: 10.11.2025 (Montag)
- Arbeitstage: Mo 10.11, Di 11.11, Mi 12.11 = 3 Tage
- Soll: 3 × 8h = 24h
- Ist: 8.5h (nur am 12.11 gearbeitet)
- **Überstunden: -15.5h** ✅

**Max Test (ID 2):**
- Eintrittsdatum: 08.11.2025 (Freitag)
- Arbeitstage: Fr 08.11, Mo 11.11, Di 12.11 = 3 Tage
- Soll: 3 × 8h = 24h
- Ist: 8.5h (nur am 12.11 gearbeitet)
- **Überstunden: -15.5h** ✅

---

**Übergabe an:** Nächste Session / User
**Status:** Code gefixt & committed, Server muss neu gestartet werden
**Priorität:** System sauber neu starten, dann alle Funktionen testen

**WICHTIG:** Befolgen Sie die "SO STARTET MAN DAS SYSTEM RICHTIG" Anleitung oben!
