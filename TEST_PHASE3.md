# Phase 3: Time Tracking - Test Guide

## Vorbereitung

1. **Server starten:**
   ```bash
   cd server
   npm run dev
   ```

2. **Neues Terminal öffnen** für Tests

---

## Test 1: Login als Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  -c cookies.txt
```

**Expected:** `{"success":true,"data":{...},"message":"Login successful"}`

---

## Test 2: Zeiterfassung erstellen (Eigener User)

```bash
curl -X POST http://localhost:3000/api/time-entries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "date": "2025-10-30",
    "startTime": "08:00",
    "endTime": "17:00",
    "breakMinutes": 60,
    "location": "office",
    "activity": "Development",
    "project": "TimeTracking System",
    "notes": "Backend Phase 3 implementation"
  }'
```

**Expected:**
- `201 Created`
- `"hours": 8.0` (9 Stunden - 1 Stunde Pause)
- `"message": "Time entry created successfully"`

---

## Test 3: Alle Zeiteinträge abrufen

```bash
curl -X GET http://localhost:3000/api/time-entries \
  -b cookies.txt
```

**Expected:** Array mit allen Zeiteinträgen des Users

---

## Test 4: Zeiterfassung mit Überschneidung (sollte fehlschlagen)

```bash
curl -X POST http://localhost:3000/api/time-entries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "date": "2025-10-30",
    "startTime": "16:00",
    "endTime": "18:00",
    "breakMinutes": 0,
    "location": "office"
  }'
```

**Expected:**
- `400 Bad Request`
- `"error": "Time entry overlaps with existing entry on this date"`

---

## Test 5: Zeiterfassung ohne Pause bei >6h (sollte fehlschlagen)

```bash
curl -X POST http://localhost:3000/api/time-entries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "date": "2025-10-29",
    "startTime": "08:00",
    "endTime": "15:00",
    "breakMinutes": 0,
    "location": "homeoffice"
  }'
```

**Expected:**
- `400 Bad Request`
- `"error": "Working time over 6 hours requires at least 30 minutes break"`

---

## Test 6: Zeiterfassung mit korrekter Pause

```bash
curl -X POST http://localhost:3000/api/time-entries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "date": "2025-10-29",
    "startTime": "08:00",
    "endTime": "15:00",
    "breakMinutes": 30,
    "location": "homeoffice",
    "notes": "Remote work day"
  }'
```

**Expected:**
- `201 Created`
- `"hours": 6.5` (7 Stunden - 0.5 Stunden Pause)

---

## Test 7: Zeiterfassung in Zukunft (sollte fehlschlagen)

```bash
curl -X POST http://localhost:3000/api/time-entries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "date": "2025-11-15",
    "startTime": "08:00",
    "endTime": "17:00",
    "breakMinutes": 60,
    "location": "office"
  }'
```

**Expected:**
- `400 Bad Request`
- `"error": "Cannot create time entries for future dates"`

---

## Test 8: Zeiterfassung aktualisieren

Ersetze `{id}` mit der ID aus Test 2:

```bash
curl -X PUT http://localhost:3000/api/time-entries/{id} \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "endTime": "18:00",
    "notes": "Updated end time - worked longer"
  }'
```

**Expected:**
- `200 OK`
- `"hours": 9.0` (10 Stunden - 1 Stunde Pause)
- `"message": "Time entry updated successfully"`

---

## Test 9: Overtime Balance abrufen

```bash
curl -X GET "http://localhost:3000/api/time-entries/stats/overtime?month=2025-10" \
  -b cookies.txt
```

**Expected:**
```json
{
  "success": true,
  "data": {
    "targetHours": 186.28,
    "actualHours": 15.5,
    "overtime": -170.78
  }
}
```

**Erklärung:**
- `targetHours`: Admin hat 40h/Woche = 5.71h/Tag × 31 Tage Oktober ≈ 177h
- `actualHours`: 8 + 6.5 + 9 = 23.5 Stunden erfasst
- `overtime`: Negativ, da noch viele Stunden fehlen

---

## Test 10: Einzelnen Eintrag abrufen

Ersetze `{id}` mit einer ID:

```bash
curl -X GET http://localhost:3000/api/time-entries/{id} \
  -b cookies.txt
```

**Expected:**
- `200 OK`
- Einzelner Zeiteintrag mit allen Details

---

## Test 11: Zeiterfassung löschen

Ersetze `{id}` mit einer ID:

```bash
curl -X DELETE http://localhost:3000/api/time-entries/{id} \
  -b cookies.txt
```

**Expected:**
- `200 OK`
- `"message": "Time entry deleted successfully"`

---

## Test 12: Zeiterfassung mit ungültigem Format

```bash
curl -X POST http://localhost:3000/api/time-entries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "date": "30.10.2025",
    "startTime": "8:00",
    "endTime": "17:00",
    "location": "office"
  }'
```

**Expected:**
- `400 Bad Request`
- `"error": "Invalid date format (use YYYY-MM-DD)"`

---

## Test 13: Zeiterfassung ohne Auth (sollte fehlschlagen)

```bash
curl -X POST http://localhost:3000/api/time-entries \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-10-30",
    "startTime": "08:00",
    "endTime": "17:00",
    "location": "office"
  }'
```

**Expected:**
- `401 Unauthorized`
- `"error": "Not authenticated"`

---

## Test 14: Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

---

## Success Criteria ✅

- [x] Zeiterfassung erstellen funktioniert
- [x] Pausen werden korrekt berechnet
- [x] Überschneidungen werden verhindert
- [x] Pausen-Regel (>6h = min. 30 Min) wird erzwungen
- [x] Zukunfts-Datum wird abgelehnt
- [x] Zeiterfassung aktualisieren funktioniert
- [x] Zeiterfassung löschen funktioniert
- [x] Overtime Balance wird berechnet
- [x] Validation funktioniert (Format, Pflichtfelder)
- [x] Auth/Authorization funktioniert

---

## Database Check

```bash
# SQLite direkt öffnen
sqlite3 server/database.db

# Zeiteinträge anzeigen
SELECT * FROM time_entries;

# Overtime Balance anzeigen
SELECT * FROM overtime_balance;

# Audit Log anzeigen
SELECT * FROM audit_log WHERE entity = 'time_entry';

# Exit SQLite
.quit
```

---

## Expected Behavior

### 1. Überstunden-Berechnung
- Admin hat `weeklyHours = 40`
- Oktober 2025 hat 31 Tage
- Target: (40 / 7) × 31 = ~177 Stunden
- Actual: Summe aller erfassten Stunden
- Overtime: Actual - Target

### 2. Überschneidungs-Check
- Gleicher Tag + Gleicher User
- Zeiträume überlappen sich
- Wird beim CREATE und UPDATE geprüft

### 3. Pausen-Regel
- Brutto-Zeit > 6 Stunden → min. 30 Min Pause pflicht
- Netto-Zeit = Brutto - Pause

### 4. Berechtigungen
- Employee: Nur eigene Einträge sehen/bearbeiten
- Admin: Alle Einträge sehen/bearbeiten

---

## Cleanup nach Tests

```bash
# Cookies löschen
rm cookies.txt

# Server stoppen
# Ctrl+C im Server-Terminal
```
