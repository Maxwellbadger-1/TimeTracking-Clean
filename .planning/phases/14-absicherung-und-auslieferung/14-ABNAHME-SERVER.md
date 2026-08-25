# Abnahmeprotokoll — AUTO-MIT-SERVER und Playwright-Sichtprüfungen

**Durchgeführt:** 2026-08-25, 16:09–18:50 Uhr (Europe/Berlin)
**Umfang:** die 37 `AUTO-MIT-SERVER`-Zeilen aus `14-UAT-TRIAGE.md` Abschnitt 3, danach die
Playwright-Sichtprüfungen (`desktop/tests/`, Abschnitt 5 der Triage).
**Nicht Gegenstand dieses Laufs:** die 33 reinen `AUTO`-Punkte (paralleler Lauf).

**Aufbau, gegen den geprüft wurde**
- Server: `npx tsx src/server.ts` aus `server/`, `DATABASE_PATH` explizit auf
  `server/database/development.db`, `NODE_ENV=development`, `PORT=3000`, `TZ=Europe/Berlin`,
  `SESSION_SECRET=dev-secret-local-only-not-for-production`.
- Konten: `npm run seed:test-users` (admin/admin123, test.*/test123) und
  `npm run seed:model-change` (Nutzer 48714).
- **Alle API-Aufrufe gehen an `http://127.0.0.1:3000`, nicht an `http://localhost:3000`** —
  Begründung siehe Neuer Befund B-1.

---

## 1. Zusammenfassung

| | Anzahl |
|---|---:|
| **BESTANDEN** | **36** von 37 |
| **NICHT BESTANDEN** | **0** |
| **NICHT PRÜFBAR** | **1** (11-U4, nur der Teilanspruch „alle vier Wege"; der Punktkern ist bestanden) |
| Playwright-Sichtprüfungen | **NICHT PRÜFBAR** — die Oberfläche lässt sich nicht ausliefern (B-2) |

Es ist **kein** AUTO-MIT-SERVER-Punkt durchgefallen. Ein Punkt (11-U4) trägt eine
Teileinschränkung; sechs weitere Punkte sind bestanden, weichen aber im Wortlaut von der
Erwartung der Triage ab. Diese Abweichungen sind je Punkt benannt.

**Der eine eingeschränkte Punkt in einem Satz:**
- **11-U4** — der geprüfte vierte Vergleichsweg (Frontend-API) meldet PASSED und der Lauf endet
  mit Exit 0, aber der Transaktionsweg meldet für den Modellwechsel-Fixturnutzer 48714 eine
  Abweichung, weil `seedModelChangeUser.ts` Zeiteinträge direkt per SQL einfügt und dabei keine
  Journalzeilen erzeugt; gegen einen echten Nutzer (18, Monat 2026-02) sind alle vier Wege grün.

**Die Playwright-Sichtprüfungen in einem Satz:** Playwright selbst ist lauffähig (Chromium
143.0.7499.4 startet, Bildschirmfotos, Video und Trace entstehen), aber der Vite-Entwicklungsserver
kann `desktop/src/main.tsx` nicht übersetzen, weil `@babel/core` im Projekt fehlt — die Anwendung
liefert eine leere Seite mit Fehlerüberlagerung, und alle 21 nicht übersprungenen Tests scheitern
an derselben Stelle.

---

## 2. Phase 11

### 11-U1a — DATEV-Export enthält die Zeilen des soft-gelöschten Nutzers

**Aufruf**
```
curl -s -b admin.jar "http://127.0.0.1:3000/api/exports/datev?startDate=2026-02-01&endDate=2026-02-28" -o datev.csv -w "HTTP %{http_code}"
grep -c "^15;" datev.csv
sqlite: SELECT COUNT(*) FROM time_entries WHERE userId=15 AND date BETWEEN '2026-02-01' AND '2026-02-28'
```
**Antwort**
```
HTTP 200  bytes=5050
CSV-Zeilen mit Personalnummer 15: 9
SQL: {"c":9}
```
Zweiter Durchgang über den vollen Bestandszeitraum:
```
curl ... "?startDate=2025-07-01&endDate=2026-02-28"   -> HTTP 200 bytes=24504
CSV-Zeilen mit Personalnummer 15: 103
SQL: {"c":102}
```
Die Differenz von einer Zeile ist die Abwesenheitszeile
`15;Test;Test;15.12.2025 - 21.12.2025;0,00;0,00;0,00;0;Urlaub;;;` — sie stammt aus
`absence_requests`, nicht aus `time_entries`. Die Zeiteintragszeilen sind 102 = 102.
Nutzer 15 ist am 2026-02-28 soft-gelöscht (`deletedAt = '2026-02-28 14:01:48'`).

**Urteil: BESTANDEN**

---

### 11-U2a — Lückenhafte Periodenkette → HTTP 409

Es gab im Bestand keinen Nutzer mit Kettenlücke (`/api/admin/period-chains` meldete
`ok:true, userCount:0`). Die Lücke wurde deshalb gezielt hergestellt: Wegwerf-Nutzer 48716
(`hireDate 2026-01-01`) mit einem Zeiteintrag am 2026-01-15, danach
`UPDATE user_work_periods SET validFrom='2026-02-01' WHERE userId=48716`. **Nach der Prüfung
wurde `validFrom` wieder auf `2026-01-01` gesetzt**; `/api/admin/period-chains` meldet seither
erneut `ok:true, userCount:0`.

**Aufruf**
```
curl -s -b admin.jar "http://127.0.0.1:3000/api/exports/datev?startDate=2026-01-01&endDate=2026-01-31" -D headers.txt -o out.txt -w "HTTP %{http_code}"
```
**Antwort**
```
HTTP 409
{"success":false,"error":"DATEV-Export abgebrochen: 1 Nutzer haben keine lückenlose Arbeitszeitperiode (Datendefekt D4) — Nutzer-IDs: 48716. Eine Datei ohne deren Zeiteinträge und Abwesenheiten würde vollständig aussehen, wäre es aber nicht. Perioden prüfen mit `npm run check:period-chains`, danach den Export wiederholen.","skippedUserIds":[48716]}
Content-Type: application/json; charset=utf-8      (kein Content-Disposition, keine CSV-Datei)
```
**Urteil: BESTANDEN** — 409, Fehlercode und betroffene Nutzer-Id im Körper, keine Datei.

---

### 11-U3 — `GET /api/admin/period-chains`: Admin 200, Nicht-Admin 403

**Aufrufe**
```
curl -s -b admin.jar "http://127.0.0.1:3000/api/admin/period-chains" -w "HTTP %{http_code}"
curl -s -b emp.jar   "http://127.0.0.1:3000/api/admin/period-chains" -w "HTTP %{http_code}"
```
**Antworten**
```
Admin:        HTTP 200  {"success":true,"data":{"ok":true,"userCount":0,"findingCount":0,"issues":[]}}
Mitarbeiter:  HTTP 403  {"success":false,"error":"Forbidden - Admin access required"}
```
Zusätzlich mit echtem Befund (während der Kettenlücke aus 11-U2a):
```
Admin: HTTP 200  {"success":true,"data":{"ok":false,"userCount":1,"findingCount":1,"issues":[{"userId":48716,"findings":["Kette beginnt erst am 2026-02-01, das Eintrittsdatum ist aber 2026-01-01 (userId 48716) — die Tage dazwischen haben keine Periode."]}]}}
```
**Urteil: BESTANDEN** — Admin bekommt die Befundliste (leer wie gefüllt) mit 200,
der Mitarbeiter 403.

---

### 11-U4 — `validate:overtime:detailed`, vierter Vergleichsweg (Frontend-API)

**Aufruf**
```
cd server && DATABASE_PATH=<...>/development.db NODE_ENV=development LOG_LEVEL=warn TZ=Europe/Berlin \
NODE_OPTIONS="--dns-result-order=ipv4first" \
npx tsx src/scripts/validateOvertimeDetailed.ts --userId=48714 --month=2026-08
```
`NODE_OPTIONS="--dns-result-order=ipv4first"` ist nötig, weil das Skript fest auf
`http://localhost:3000/api` zeigt und `localhost` auf diesem Rechner zuerst auf `::1` auflöst —
dort horcht ein fremdes Next.js-Projekt (Befund B-1). **Ohne diese Einstellung meldet der Lauf
wörtlich:** `⚠️  Could not fetch from Frontend API (server not running or auth failed)`.

**Antwort (mit der Einstellung)**
```
EXITCODE=0
✅ API authentication successful
┌────────────────────────┬──────────────┬──────────────┬────────┐
│ Component              │ Calculated   │ Frontend API │ Match  │
│ Target Hours (Soll)    │      68.00h  │      68.00h  │ ✅     │
│ Actual Hours (Ist)     │       0.00h  │       0.00h  │ ✅     │
│ Overtime Balance       │    -68.00h  │    -68.00h  │ ✅     │
└────────────────────────┴──────────────┴──────────────┴────────┘
✅ FRONTEND API VALIDATION: PASSED
  ✅ Database validation: PASSED
  ❌ TRANSACTION MISMATCH DETECTED!   → Difference: -68.00h
```
Gegenprobe mit einem echten Nutzer:
```
npx tsx src/scripts/validateOvertimeDetailed.ts --userId=18 --month=2026-02   -> EXIT=0
  ✅ Database validation: PASSED
  ✅ Transaction validation: PASSED
  ✅ FRONTEND API VALIDATION: PASSED
```
Ursache der Abweichung bei 48714: `SELECT COUNT(*) FROM overtime_transactions WHERE userId=48714`
liefert **0**. `seedModelChangeUser.ts` schreibt die 21 Zeiteinträge mit direktem
`INSERT INTO time_entries` und legt keine Journalzeilen an — der Transaktionsweg hat für diesen
Nutzer nichts zu vergleichen. Das ist eine Grenze der Testvorrichtung, kein Rechenfehler.

**Urteil: BESTANDEN für den geprüften vierten Weg (Frontend-API PASSED, Exit 0).
NICHT PRÜFBAR für den Zusatzanspruch „alle vier Wege PASSED" am Modellwechsel-Nutzer** — der
Transaktionsweg ist dort mangels Journalzeilen nicht aussagefähig; am echten Nutzer 18 sind alle
vier Wege grün.

---

### 11-U5a — Sollstunden vor/nach dem Stichtag

Nutzer 48714, Stichtag 2026-05-14, Perioden `2025-01-01…2026-05-14` mit 40 h/Woche und
`2026-05-14…offen` mit 20 h/Woche.

**Aufrufe und Antworten**
```
GET /api/reports/overtime/user/48714?year=2026&month=4   -> HTTP 200
  summary: {"targetHours":160,"actualHours":0,"overtime":-160}
  daily (Auszug): 2026-04-01 target 8 · 2026-04-02 target 8 · … · 2026-04-30 target 8

GET /api/reports/overtime/user/48714?year=2026&month=6   -> HTTP 200
  summary: {"targetHours":84,"actualHours":0,"overtime":-84}
  daily (Auszug): 2026-06-01 target 4 · 2026-06-02 target 4 · 2026-06-04 target 0 (Fronleichnam) · …
```
Abgleich mit `validate:overtime:detailed`:
```
2026-04:  Target Hours (Soll)  Calculated 160.00h | Database 160.00h  ✅
2026-06:  Target Hours (Soll)  Calculated  84.00h | Database  84.00h  ✅
```
160 h = 20 Arbeitstage × **8 h**, 84 h = 21 Arbeitstage × **4 h**.

**Urteil: BESTANDEN** — 8 h vor, 4 h nach dem Stichtag, in API und Rechenskript identisch.

---

## 3. Phase 12

### P12-2 (= 13-U7a) — `GET /api/work-periods` gegen fremde `userId` → 403

**Aufrufe und Antworten**
```
Mitarbeiter test.vollzeit (id 15015) fragt fremde userId=18:
curl -b emp.jar "http://127.0.0.1:3000/api/work-periods?userId=18"
-> HTTP 403   {"success":false,"error":"Forbidden"}

Gegenprobe, derselbe Mitarbeiter fragt sich selbst:
curl -b emp.jar "http://127.0.0.1:3000/api/work-periods?userId=15015"
-> HTTP 200   {"success":true,"data":[{"id":3684,"userId":15015,"validFrom":"2024-01-01",…}]}
```
**Urteil: BESTANDEN** — 403, im Körper steht ausschließlich `Forbidden`, keine Periodendaten.

---

### P12-11 — `previewToken` überlebt einen Serverneustart

**Ablauf**
```
1) 16:23:21  POST /api/work-periods/preview {"userId":48717,"validFrom":"2026-08-17","weeklyHours":30,"workSchedule":null}
   -> HTTP 200, previewToken = v2.1787675001952.Dn2GqyaaNogTxr63vpzgVd8qSn0sSYSTn1M7HUbUFtE
2) Serverprozess beendet (Stop-Process -Id 34448 -Force), Port 3000 danach ohne IPv4-Listener
3) 16:24:51  Server neu gestartet, /api/health -> {"status":"ok",…}
4) Alte Sitzung: GET /api/work-periods?userId=48717 -> HTTP 401 {"success":false,"error":"Unauthorized - Please login"}
   (erwartet: MemoryStore-Sitzungen überleben den Neustart nicht)
5) Neu angemeldet -> HTTP 200
6) POST /api/work-periods/change mit dem Token aus Schritt 1
```
**Antwort auf Schritt 6**
```
HTTP 200
{"success":true,"data":{"preview":{…"balanceDelta":-14…},"period":{"id":22956,"userId":48717,"validFrom":"2026-08-17","weeklyHours":30,"createdBy":1,…},"transactionId":582678}}
```
Kein `PREVIEW_STALE`. **Urteil: BESTANDEN**

---

### P12-15a — Reihenfolge und Zuordnung „Aktuell"/„Geplant" in den Daten

**Aufruf**
```
curl -s -b admin.jar "http://127.0.0.1:3000/api/work-periods?userId=48717"
```
**Antwort (HTTP 200, gekürzt auf die entscheidenden Felder)**
```
[{"id":22954,"validFrom":"2026-08-01","validTo":"2026-08-10","weeklyHours":40,"isFirst":true, "isCurrent":false},
 {"id":22955,"validFrom":"2026-08-10","validTo":"2026-08-17","weeklyHours":20,"isFirst":false,"isCurrent":false},
 {"id":22956,"validFrom":"2026-08-17","validTo":"2026-12-01","weeklyHours":30,"isFirst":false,"isCurrent":true},
 {"id":22957,"validFrom":"2026-12-01","validTo":null,       "weeklyHours":10,"isFirst":false,"isCurrent":false}]
```
- Genau **eine** Periode mit heutiger Gültigkeit: `isCurrent:true` bei 22956
  (`validFrom 2026-08-17 ≤ 2026-08-25 < validTo 2026-12-01`).
- Die künftige Periode 22957 (`validFrom 2026-12-01 > heute`) ist über `validFrom` und
  `isCurrent:false` eindeutig als geplant erkennbar.

**Abweichung von der Triage-Erwartung:** Die Antwort ist **aufsteigend** nach `validFrom`
sortiert, nicht absteigend. Das ist der dokumentierte Serververtrag
(`workPeriods.ts`: „Liefert die Arbeitszeitperioden eines Nutzers, aufsteigend nach validFrom");
die absteigende Anzeige entsteht im Desktop
(`WorkTimePeriodList.tsx` Zeile 73–76, `sort((a,b)=> a.validFrom<b.validFrom ? 1 : -1)`), ebenso
das Badge „Geplant" (`isCurrent ? 'Aktuell' : 'Geplant'`, Zeile 217).

**Urteil: BESTANDEN**

---

### P12-17 — Vorschau→Speichern: Kontoauszugssaldo = notierter Vorschauwert

Geprüft an Nutzer 48717 mit lückenlosen Zeiteinträgen für alle Augustarbeitstage
(17 Einträge à 8 h), damit die Salden eindeutig definiert sind.

**Aufrufe und Antworten**
```
Saldo VOR (alle drei Wege einig):
  GET /api/overtime/transactions/live?userId=48717  -> "currentBalance":0
  GET /api/overtime/transactions?userId=48717       -> "currentBalance":0
  GET /api/work-time-accounts?userId=48717          -> "currentBalance":0

POST /api/work-periods/preview {"userId":48717,"validFrom":"2026-08-10","weeklyHours":20,"workSchedule":null}
  -> HTTP 200
     "targetHoursBefore":96,"targetHoursAfter":48,"targetHoursDelta":-48,
     "balanceBefore":0,"balanceAfter":48,"balanceDelta":48,"midMonthEffective":true

POST /api/work-periods/change (mit diesem previewToken)
  -> HTTP 200, "period":{"id":22955,…}, "transactionId":582627

Saldo NACH:
  GET /api/overtime/transactions/live?userId=48717  -> "currentBalance":48
  GET /api/overtime/transactions?userId=48717       -> "currentBalance":48
  GET /api/work-time-accounts?userId=48717          -> "currentBalance":0, "lastUpdated":"2026-08-25 16:21:59"
```
Notierter Vorschauwert **48**, Kontoauszug **48**. Der Kontoauszug der Oberfläche liest
`/overtime/transactions/live` (`useWorkTimeAccounts.ts` Zeile 325).

**Urteil: BESTANDEN** — mit dem Nebenbefund B-3: `GET /api/work-time-accounts` blieb bei 0 und
`lastUpdated` unverändert; dieser Wert wird durch einen Modellwechsel nicht fortgeschrieben.

---

### P12-25a — Abgelaufenes Vorschau-Token → `PREVIEW_STALE`

Statt 15 Minuten zu warten wurde ein **gültig signiertes, aber 16 Minuten altes** Token gebaut
(Format `v2.<issuedAtMs>.<HMAC-SHA256 base64url>` über
`v2|adminId|userId|validFrom|weeklyHours.toFixed(2)|canonicalizeWorkSchedule|issuedAtMs`,
Schlüssel = `SESSION_SECRET`; Quelle: `server/src/services/workTimeChangeToken.ts`).

**Aufruf**
```
Token: v2.1787674014283.tjKu_BCB5X_41bcb8wLQe-23GrPtcG2UnXC_QuSMyR8
curl -s -b admin.jar -X POST http://127.0.0.1:3000/api/work-periods/change \
  -d '{"userId":48717,"validFrom":"2026-08-17","weeklyHours":30,"workSchedule":null,"reason":"…","previewToken":"<Token>"}'
```
**Antwort**
```
HTTP 409
{"success":false,"error":"PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell."}
```
Gegenprobe, dass nichts geschrieben wurde:
```
SELECT id,validFrom,validTo,weeklyHours FROM user_work_periods WHERE userId=48717 AND deletedAt IS NULL
-> [{"id":22954,"validFrom":"2026-08-01","validTo":"2026-08-10","weeklyHours":40},
    {"id":22955,"validFrom":"2026-08-10","validTo":null,"weeklyHours":20}]   (unverändert)
```
**Urteil: BESTANDEN**

---

### P12-26a — Frisch angelegter Nutzer: Periodenauskunft und `hireDate`

**Aufrufe und Antworten**
```
GET /api/work-periods?userId=48716  -> HTTP 200
[{"id":22952,"userId":48716,"validFrom":"2026-01-01","validTo":null,"weeklyHours":40,
  "note":"[ANLAGE-11-03] Startperiode, Quelle: hireDate","isFirst":true,"isCurrent":true}]

GET /api/users/48716  -> HTTP 200
{"id":48716,…,"hireDate":"2026-01-01",…}
```
**Abweichung von der Triage-Erwartung:** Die Erwartung lautete „leere Periodenliste". Der Server
liefert stattdessen **genau eine** automatisch angelegte Startperiode mit
`validFrom = hireDate = 2026-01-01` (`createUser()` → `ensureInitialWorkPeriod()`,
Vermerk `[ANLAGE-11-03]`). Der fachliche Anspruch des Punktes — das Infopanel zeigt
„Aktuell gültig seit {Eintrittsdatum}" — ist damit erfüllt, weil `validFrom` und `hireDate`
identisch sind. Eine leere Periodenliste kann seit Migration 009 gar nicht mehr entstehen.

**Urteil: BESTANDEN** (Erwartungstext der Triage ist zu korrigieren)

---

### P12-29a — Kontoauszug führt die Modellwechsel-Zeile

**Aufruf**
```
curl -s -b admin.jar "http://127.0.0.1:3000/api/overtime/transactions/live?userId=48716&limit=500"
```
**Antwort (die Modellwechsel-Zeile, HTTP 200)**
```
{"date":"2026-06-01","type":"model_change","hours":0,"documentedDelta":244,
 "description":"Stundenwechsel ab 01.06.2026: 40,0 → 20,0 h/Woche (Grund: Abnahme P12-17: Vorschau-Speichern-Zyklus)",
 "source":"work_period","referenceId":582151,"createdAt":"2026-08-25 16:19:12",
 "adminName":"System Administrator","id":582151,"reversalOf":null,"reversedBy":null,
 "reversedAt":null,"reversedByName":null}
```
Gespeicherte Zeile:
```
SELECT * FROM overtime_transactions WHERE id=582151
{"id":582151,"userId":48716,"date":"2026-06-01","type":"model_change","hours":244,
 "description":"Stundenwechsel ab 01.06.2026: 40,0 → 20,0 h/Woche (Grund: Abnahme P12-17: …)",
 "referenceType":"work_period","referenceId":22953,"createdBy":1}
```
- Betrag: `hours = 244` in der Datenbank, `documentedDelta = 244` in der Live-Antwort — ≠ 0.
- Begründung: im `description` als „(Grund: …)" enthalten; eine eigene `reason`-Spalte gibt es
  nicht.
- **Echter Admin-Name:** `adminName: "System Administrator"` — der angemeldete Admin
  (`createdBy = 1`). Die Oberfläche liest genau dieses Feld
  (`OvertimeTransactions.tsx` Zeile 335).

**Zwei Abweichungen von der Triage-Erwartung, beide unschädlich:**
1. Der Referenztyp ist `work_period`, der **Buchungstyp** ist `model_change` — die Triage nannte
   `referenceType='model_change'`.
2. Die ältere Route `GET /api/overtime/transactions` (die die Oberfläche **nicht** verwendet)
   liefert die Zeile weder mit `adminName` noch innerhalb der Standardgrenze `limit=50`; erst
   `limit=500` fördert sie zutage. Der Kontoauszug der Anwendung liest `/transactions/live`.

**Urteil: BESTANDEN**

---

### P12-30a — Nutzerverwaltung: Anlegen, Deaktivieren, Passwort-Reset, Löschen

Alle vier Aufrufe als Admin gegen den Wegwerf-Nutzer `abnahme.wegwerf1` (id 48715).

**Aufrufe und Antworten**
```
1) POST /api/users {"username":"abnahme.wegwerf1",…,"weeklyHours":40,"hireDate":"2026-01-01"}
   -> HTTP 201  {"success":true,"data":{"id":48715,…,"status":"active"},"message":"User created successfully"}

2) PATCH /api/users/48715/status {"status":"inactive"}
   -> HTTP 200  {"success":true,"data":{…,"status":"inactive","isActive":0},"message":"User status updated successfully"}

3) PATCH /api/users/48715/password {"newPassword":"NeuesPasswort999!","forceChange":false}
   -> HTTP 200  {"success":true,"message":"Password reset successfully"}
   Hash vorher:  $2b$10$VB3vw4xssyAla9rjsQf1JOQ/nmXvI8r56t6bYJJb84sXEyghBsFL6
   Hash nachher: $2b$10$VUVI9hmLl7SKxZ/rd61OleytVatoHrLH2zF1ZVI8iOi1anshSwrz6

4) DELETE /api/users/48715
   -> HTTP 200  {"success":true,"message":"User deleted successfully"}
   SELECT COUNT(*) FROM users WHERE id=48715 -> 1
   SELECT id,status,deletedAt … -> {"id":48715,"status":"inactive","deletedAt":"2026-08-25 16:14:33"}
```
**Urteil: BESTANDEN** — 201/200/200/200, `deletedAt` gesetzt statt Zeile entfernt, Status
geändert, neuer Passworthash.

---

### P12-32 — Abwesenheitsantrag über einen Stichtag

Vorbereitung: Stundenwechsel für 48717 mit `validFrom 2026-11-11` (Mittwoch) auf 20 h/Woche;
davor gilt Periode 22956 mit dem Tagesplan Mo 8 / Di 4 / Mi 6 / Do 6 / Fr 6.

**Vorschau (dieselbe Rechnung wie im Formular, `calculateAbsenceHoursWithWorkSchedule()` mit den
Perioden und Feiertagen aus `GET /api/work-periods` und `GET /api/holidays`)**
```
Zeitraum: 2026-11-09 bis 2026-11-13
Stunden (Vorschau): 24
Arbeitstage (Vorschau): 5
```
**Antrag und Genehmigung**
```
POST /api/absences {"type":"vacation","startDate":"2026-11-09","endDate":"2026-11-13",…}   (Mitarbeiter 48717)
-> HTTP 201 {"id":11308,…,"days":5,"status":"pending"}
POST /api/absences/11308/approve                                                            (Admin)
-> HTTP 200 {"id":11308,…,"status":"approved","approvedBy":1}
```
**Gebuchte Journalzeilen 2026-11-09 … 2026-11-13**
```
2026-11-09  time_entry -8 | vacation_credit +8
2026-11-10  time_entry -4 | vacation_credit +4
2026-11-11  time_entry -4 | vacation_credit +4
2026-11-12  time_entry -4 | vacation_credit +4
2026-11-13  time_entry -4 | vacation_credit +4
Summe vacation_credit: 24
```
Der Stichtag wirkt tagesgenau: 8 + 4 vor dem 11.11., danach 4 + 4 + 4.
Vorschauwert **24 h** = gebuchter Wert **24 h**.

**Urteil: BESTANDEN**

---

### P12-33 — Abwesenheitsantrag über einen Feiertag

Zeitraum 2026-12-21 (Mo) bis 2026-12-25 (Fr); der 25.12. ist „1. Weihnachtstag"
(`SELECT date,name FROM holidays WHERE date='2026-12-25'`).

**Vorschau**
```
Zeitraum: 2026-12-21 bis 2026-12-25
Stunden (Vorschau): 24
Arbeitstage (Vorschau): 4      (ohne Feiertag wären es 30 h / 5 Tage)
```
**Antrag, Genehmigung, Buchung**
```
POST /api/absences -> HTTP 201 {"id":11307,…,"days":4}
POST /api/absences/11307/approve -> HTTP 200 {"status":"approved"}

2026-12-21  time_entry -8 | vacation_credit +8
2026-12-22  time_entry -4 | vacation_credit +4
2026-12-23  time_entry -6 | vacation_credit +6
2026-12-24  time_entry -6 | vacation_credit +6
2026-12-25  time_entry  0 | vacation_credit  0     <- Feiertag
```
**Urteil: BESTANDEN** — der Feiertag trägt 0 h bei, in Vorschau wie in der Buchung.

---

### P12-35a — Die als aktuell gemeldete Periode ist die mit dem größten `validFrom ≤ heute`

Aus derselben Antwort wie P12-15a: Perioden mit `validFrom` 2026-08-01, 2026-08-10, 2026-08-17,
2026-12-01; heute ist 2026-08-25. Größtes `validFrom ≤ heute` = **2026-08-17** (id 22956) —
und genau diese Zeile trägt `isCurrent:true`.
Der Server berechnet das Flag selbst (`getWorkPeriodsWithFlags()` → `resolveWorkPeriodIn()`); der
Desktop rechnet seit DD-35 nicht mehr nach (`WorkTimePeriodList.tsx` Zeile 84–90).

**Urteil: BESTANDEN**

---

### P12-42 — Rate-Limit `/preview` im Realbetrieb

Zusammengeführt mit 13-U17, siehe dort. **Urteil: BESTANDEN**

---

## 4. Phase 13

### 13-U1a — Die Korrektur-Vorschau meldet Rückwirkung mit konkretem Zeitraum

**Aufruf**
```
curl -s -b admin.jar -X POST http://127.0.0.1:3000/api/work-periods/22955/correct/preview \
  -d '{"validFrom":"2026-08-12","weeklyHours":20,"workSchedule":null}'
```
**Antwort**
```
HTTP 200
{"periodId":22955,"userId":48717,"isRetroactive":true,
 "rangeFrom":"2026-08-10","rangeTo":"2026-08-25","workingDays":12,
 "targetHoursBefore":62,"targetHoursAfter":70,"targetHoursDelta":8,
 "balanceBefore":34,"balanceAfter":26,"balanceDelta":-8,
 "previousPeriod":{"validFrom":"2026-08-01","weeklyHours":40,"newValidTo":"2026-08-12"},
 "affectedMonths":["2026-08"],"previewToken":"v2.1787675142648.…"}
```
Rückwirkungskennzeichen gesetzt, Zeitraum als zwei Datumsangaben, Saldoänderung als Zahl.
**Urteil: BESTANDEN**

---

### 13-U2a — Vollständig zukünftige Periode: keine Rückwirkung, Speichern ohne Bestätigungsschritt

**Aufrufe und Antworten**
```
POST /api/work-periods/preview {"userId":48717,"validFrom":"2026-12-01","weeklyHours":10,"workSchedule":null}
-> HTTP 200
   "isRetroactive":false,"rangeStart":"2026-12-01","rangeEnd":"2026-12-01",
   "balanceBefore":34,"balanceAfter":34,"balanceDelta":0,"affectedMonths":["2026-12"]

POST /api/work-periods/change (mit demselben previewToken, kein weiterer Schritt dazwischen)
-> HTTP 200
   "period":{"id":22957,"validFrom":"2026-12-01","validTo":null,"weeklyHours":10,…},
   "transactionId":null
```
`transactionId: null` — für einen rein zukünftigen Wechsel entsteht keine Ausgleichsbuchung.
**Urteil: BESTANDEN**

---

### 13-U4a — Nach gescheiterter Löschvorschau ist nichts gelöscht

Statt eines Abbruchs mitten im Lauf wurde die Vorschau am Riegel „erste Periode" zum Scheitern
gebracht — derselbe Ausgang, aber reproduzierbar.

**Aufruf**
```
curl -s -b admin.jar -X POST http://127.0.0.1:3000/api/work-periods/22954/delete/preview -d '{}'
```
**Antwort**
```
HTTP 400
{"success":false,"error":"Die erste Periode kann nicht gelöscht werden. Korrigieren Sie sie stattdessen."}
```
**Gegenprobe**
```
SELECT id,validFrom,validTo,weeklyHours,deletedAt,deletedBy FROM user_work_periods WHERE id=22954
{"id":22954,"validFrom":"2026-08-01","validTo":"2026-08-10","weeklyHours":40,"deletedAt":null,"deletedBy":null}
```
`deletedAt` ist `NULL`, die Zeile unverändert. **Urteil: BESTANDEN**

---

### 13-U5a — Storno-Paar in den Daten

**Aufrufe**
```
POST /api/work-periods/22955/delete/preview -> HTTP 200
  "deletedPeriod":{"validFrom":"2026-08-10","validTo":"2026-08-17","weeklyHours":20},
  "reversedTransactions":[{"id":582627,"date":"2026-08-10","hours":48}],
  "balanceBefore":34,"balanceAfter":14,"balanceDelta":-20

DELETE /api/work-periods/22955 {"reason":"Abnahme 13-U5a: Storno-Paar nachweisen","previewToken":"…"}
-> HTTP 200   "reversalTransactionIds":[582831]
```
**Die beiden Zeilen**
```
id     userId  date        type          hours  referenceType  referenceId  reversalOf
582627 48717   2026-08-10  model_change    48    work_period    22955        null
582831 48717   2026-08-10  model_change   -48    work_period    22955        582627
SELECT ROUND(SUM(hours),2) WHERE id IN (582627,582831) -> 0
```
Live-Antwort ergänzt die Verkettung: die Ursprungszeile trägt
`"reversedBy":582831,"reversedAt":"2026-08-25 16:29:21","reversedByName":"System Administrator"`,
die Gegenbuchung `"reversalOf":582627`.

Zwei Zeilen, gemeinsame Belegnummer, spiegelbildliche Beträge, Summe 0,00 h.
**Urteil: BESTANDEN**

---

### 13-U7a — Mitarbeiter bekommt für einen fremden Nutzer 403

Deckungsgleich mit P12-2, siehe dort. **Urteil: BESTANDEN**

---

### 13-U12a — Login und Laden der Perioden-/Kontoauszugsliste nach der `client.ts`-Bereinigung

**Aufrufe und Antworten**
```
POST /api/auth/login {"username":"admin","password":"admin123"}
-> HTTP/1.1 200 OK
   Set-Cookie: connect.sid=s%3Ay92liyKlVigN50XIk4ozo_XKUWcfburs.…; Path=/; Expires=Wed, 26 Aug 2026 16:27:46 GMT; HttpOnly; SameSite=None

GET /api/work-periods?userId=48717
-> HTTP 200  {"success":true,"data":[{"id":22954,…},{"id":22955,…},{"id":22956,…},{"id":22957,…}]}   (4 Einträge)

GET /api/work-time-accounts?userId=48717
-> HTTP 200  {"success":true,"data":{"id":393,"userId":48717,"currentBalance":0,"maxPlusHours":50,
              "maxMinusHours":-20,"lastUpdated":"2026-08-25 16:21:59","user":{…}}}
```
**Urteil: BESTANDEN** — 200 mit Sitzungscookie, danach beide Listen mit 200 und gefülltem Inhalt.

---

### 13-U16 — Korrektur ohne Saldowirkung erzeugt trotzdem eine Journalzeile mit Begründung

Der Tagesplan der Periode 22956 wurde bei **gleicher Wochensumme** umverteilt:
Mo 6 / Di 6 / Mi 6 / Do 6 / Fr 6 → **Mo 8 / Di 4** / Mi 6 / Do 6 / Fr 6 (beide 30 h/Woche).
Die Umverteilung ist so gewählt, dass sie über die sieben Arbeitstage des Wirkungszeitraums
(17.–25.08., zwei Montage, zwei Dienstage) auf dieselbe Summe führt.

**Aufrufe und Antworten**
```
Saldo VOR (Kontoauszug live): 34

POST /api/work-periods/22956/correct/preview mit dem neuen Tagesplan
-> HTTP 200  "rangeFrom":"2026-08-17","rangeTo":"2026-08-25","workingDays":7,
             "targetHoursBefore":42,"targetHoursAfter":42,"targetHoursDelta":0,
             "balanceBefore":34,"balanceAfter":34,"balanceDelta":0,"isNoOp":false

PUT /api/work-periods/22956 {…,"reason":"Abnahme 13-U16: Tagesplan umverteilt, Wochensumme unveraendert 30h",…}
-> HTTP 200  "transactionId":582780

Saldo NACH (Kontoauszug live): 34
```
**Die erzeugte Journalzeile**
```
{"id":582780,"userId":48717,"date":"2026-08-17","type":"model_change","hours":0,
 "description":"Periode ab 17.08.2026 korrigiert: 30,0 → 30,0 h/Woche (Grund: Abnahme 13-U16: Tagesplan umverteilt, Wochensumme unveraendert 30h)",
 "referenceType":"work_period","referenceId":22956,"createdBy":1}
```
Saldodifferenz 34 − 34 = **0,00 h**, Zeile mit Begründung vorhanden.
**Urteil: BESTANDEN**

---

### 13-U17 (+P12-42) — Kein `429` bei normalem Bedientempo; Grenze belegt

**Teil A — sieben Vorschauaufrufe im Abstand von ~1 s (7-Feld-Tagesplan), Dev-Server Port 3000**
```
for i in 1..7: POST /api/work-periods/22956/correct/preview mit variiertem Tagesplan; sleep 1
Aufruf 1 -> HTTP 200
Aufruf 2 -> HTTP 200
Aufruf 3 -> HTTP 200
Aufruf 4 -> HTTP 200
Aufruf 5 -> HTTP 200
Aufruf 6 -> HTTP 200
Aufruf 7 -> HTTP 200
```

**Teil B — die Grenze selbst.** Im Entwicklungsmodus stehen alle Eimer auf 10 000/Minute
(`server/src/middleware/rateLimits.ts`: `max: isDevelopment ? 10000 : 30` bzw. `: 120`), die
Grenze ist dort nicht auslösbar. Dafür wurde ein **zweiter Server im Produktionsmodus** auf
Port 3001 gegen eine **Arbeitskopie** (`server/database/14-abnahme-ratelimit.db`) gestartet;
Anmeldung über den JWT-Weg, weil der Sitzungscookie in Produktion `secure` ist.
```
for i in 1..31: POST http://127.0.0.1:3001/api/work-periods/change  (mit unbrauchbarem Token, der Eimer zählt vor dem Handler)
Aufruf  1 -> HTTP 409  {"success":false,"error":"PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell."}
…
Aufruf 30 -> HTTP 409  {"success":false,"error":"PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell."}
Aufruf 31 -> HTTP 429  {"success":false,"error":"Zu viele Speichervorgänge. Bitte warten Sie einen Moment.","retryAfter":60,"limit":30,"window":"1 minute"}
```
Der Server auf 3001 wurde danach beendet.

**Urteil: BESTANDEN** — sieben Aufrufe in Bediengeschwindigkeit alle 200; der 31. Schreibaufruf
innerhalb einer Minute antwortet 429 mit `limit: 30`.

---

### 13-U18a (+P12-20) — `PREVIEW_STALE` in beiden Dialogwegen

**Weg 1 — Wechsel-Dialog** (`POST /api/work-periods/change`, Token 16 Minuten alt, korrekt signiert)
```
HTTP 409  {"success":false,"error":"PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell."}
```
**Weg 2 — Löschbestätigung** (`DELETE /api/work-periods/22955`, Lösch-Token 16 Minuten alt,
kanonische Zeichenkette `v2|delete|1|22955|<issuedAtMs>`)
```
Token: v2.1787674033879.lhmYkjpL52UN1wERpQ0NwssswC_imxn-_UtYDAEc8vc
HTTP 409  {"success":false,"error":"PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell."}
SELECT id,validFrom,weeklyHours,deletedAt FROM user_work_periods WHERE id=22955
-> {"id":22955,"validFrom":"2026-08-10","weeklyHours":20,"deletedAt":null}
```
Beide Male derselbe Fehlercode, beide Male ohne Schreibwirkung.
**Urteil: BESTANDEN**

---

### 13-U19 — Storno-Paar mit Zukunftsdatum bleibt im Kontoauszug sichtbar

Konstruktion: Korrektur der **Zukunftsperiode** 22957 (`validFrom 2026-12-01`) erzeugt eine
Buchung mit Zukunftsdatum; danach wird die Periode gelöscht.

**Aufrufe**
```
PUT /api/work-periods/22957 {"validFrom":"2026-12-01","weeklyHours":12,…}   -> HTTP 200, transactionId 582832
DELETE /api/work-periods/22957 {"reason":"Abnahme 13-U19: Storno-Paar mit Zukunftsdatum",…}
   -> HTTP 200, "reversedTransactions":[{"id":582832,"date":"2026-12-01","hours":0}], "reversalTransactionIds":[582833]

GET /api/overtime/transactions/live?userId=48717&fromDate=2026-12-01&toDate=2026-12-31&limit=500
```
**Antwort (HTTP 200)**
```
[{"date":"2026-12-01","type":"model_change","hours":0,"documentedDelta":0,
  "description":"Periode ab 01.12.2026 korrigiert: 10,0 → 12,0 h/Woche (Grund: Abnahme 13-U19: Buchung mit Zukunftsdatum erzeugen)",
  "id":582832,"reversalOf":null,"reversedBy":582833,"reversedAt":"2026-08-25 16:30:15","reversedByName":"System Administrator"},
 {"date":"2026-12-01","type":"model_change","hours":0,"documentedDelta":0,
  "description":"Storno zur Buchung vom 01.12.2026: Periode ab 01.12.2026 gelöscht (Grund: Abnahme 13-U19: Storno-Paar mit Zukunftsdatum)",
  "id":582833,"reversalOf":582832,"reversedBy":null}]
```
Beide Zeilen sind sichtbar. Der Zeitraum wurde so abgefragt, wie die Oberfläche es tut
(`useOvertimeTransactions()` setzt `fromDate`/`toDate` auf Monatsgrenzen und deckelt `toDate`
seit WR-10 nicht mehr auf heute).
**Urteil: BESTANDEN**

---

## 5. Phase 14

### 14-U5a — Die Phase-13-UI-Korrekturen, soweit als Regel prüfbar (Teil M-1)

Prüffrage: stammt „rückwirkend ja/nein" aus der Server-Vorschau?

**Servervorschau (aus 13-U1a und 13-U2a, wörtlich)**
```
Korrektur mit neuem Beginn 2026-08-12 (vor heute):     "isRetroactive":true
Wechsel mit Beginn 2026-12-01 (nach heute):            "isRetroactive":false
```
**Verwendung im Desktop**
- `WorkTimeChangeModal.tsx` Zeile 527/558/592: `preview.isRetroactive` unmittelbar.
- `WorkTimePeriodEditModal.tsx` Zeile 228: `resolveIsRetroactive({ previewIsRetroactive: preview ? preview.isRetroactive : null, … })`.
- `workTimePeriodEditRules.ts` Zeile 106–114:
  `if (args.previewIsRetroactive !== null) return args.previewIsRetroactive;` — der clientseitige
  Zeichenkettenvergleich greift **nur**, solange keine Vorschau vorliegt.

**Urteil: BESTANDEN** für M-1. Die Teile M-3/M-5 laufen über die `*.check.ts`-Skripte und
gehören zum AUTO-Block des parallelen Laufs; sie wurden hier nicht angefasst.

---

### 14-U9a — `PUT /api/users/:id`: unveränderte Stammdaten 200, echte Stundenänderung 400

**Aufruf 1 — `weeklyHours` unverändert (40)**
```
curl -s -b admin.jar -X PUT http://127.0.0.1:3000/api/users/48716 \
 -d '{"firstName":"Abnahme","lastName":"Kettenluecke","email":"abnahme.kettenluecke@test.local","role":"employee","weeklyHours":40,"vacationDaysPerYear":30,"hireDate":"2026-01-01","status":"active"}'
-> HTTP 200
{"success":true,"data":{"id":48716,…,"weeklyHours":40,…},"message":"User updated successfully"}
```
**Aufruf 2 — `weeklyHours` geändert (40 → 25)**
```
… -d '{…,"weeklyHours":25,…}'
-> HTTP 400
{"success":false,"error":"Wochenstunden und Tagesplan werden nicht mehr ueber PUT /api/users/:id geaendert. Nutzen Sie POST /api/work-periods/change (Stundenwechsel ab Stichtag) oder PUT /api/work-periods/:id (Stammdaten korrigieren)."}
```
**Urteil: BESTANDEN** — 200 bzw. 400 mit ausdrücklichem Verweis auf den Wechsel-Weg.

---

## 6. Phase 14.1

### 14.1-U2a — Künftiger Monat erzeugt keine Minusstunden für noch nicht stattgefundene Tage

**Aufrufe (Folgemonat September 2026, so wie die Oberfläche abfragt)**
```
GET /api/overtime/transactions/live?userId=<U>&fromDate=2026-09-01&toDate=2026-09-30&limit=500
```
**Antworten**
```
Nutzer 48717:  Zeilen 0  | Saldo im Zeitraum 0 | Zeilen mit Datum > 2026-08-25: 0
Nutzer 24:     Zeilen 0  | Saldo im Zeitraum 0 | Zeilen mit Datum > 2026-08-25: 0
Nutzer 16:     Zeilen 0  | Saldo im Zeitraum 0 | Zeilen mit Datum > 2026-08-25: 0
Nutzer 29:     Zeilen 0  | Saldo im Zeitraum 0 | Zeilen mit Datum > 2026-08-25: 0
Nutzer 15015:  Zeilen 0  | Saldo im Zeitraum 0
```
Zum Vergleich der laufende Monat:
```
Nutzer 16, 2026-08-01…2026-08-31: 18 Zeilen, größtes Datum 2026-08-25, Zeilen mit Datum > heute: 0
```
Gesamtsalden bleiben unberührt: `GET /api/work-time-accounts` liefert für 16 `32`, für 29 `63.28`.

**Urteil: BESTANDEN** — im Kontoauszug erscheint für den Folgemonat keine einzige Buchung, und
keine Buchung trägt ein Datum nach heute.

**Zu benennender Nebenbefund (B-4):** Die abgeleitete Tabelle `overtime_balance` trägt für den
im Lauf angelegten Nutzer 48717 sehr wohl Zukunftsmonatszeilen mit negativem Saldo
(`2026-09: −130`, `2026-11: −74`, `2026-12: −88`). Sie erreichen weder den Kontoauszug noch
`work_time_accounts.currentBalance` (dort steht 38, also nur der laufende Monat) — der
Zukunftsmonatsfilter in `getOvertimeBalance()` hält sie zurück. Das ist dieselbe Familie wie
WR-01 und 14.1-U26.

---

### 14.1-U6a — Gelöschter Urlaub verschwindet aus dem Journal

**Aufrufe und Antworten**
```
VOR:  SELECT COUNT(*) FROM overtime_transactions WHERE referenceType='absence' AND referenceId=11307  -> 10
DELETE /api/absences/11307   -> HTTP 200  {"success":true,"message":"Absence request deleted successfully"}
NACH: SELECT COUNT(*) … referenceId=11307  -> 0
      SELECT id,status FROM absence_requests WHERE id=11307 -> (keine Zeile)
```
Der Antrag umfasste fünf Tage, daher 10 statt der in der Triage genannten 2 Zeilen (ein Tag).
**Urteil: BESTANDEN** — 200 und **null** Journalzeilen dieses Antrags.

---

### 14.1-U7a — Nach dem Löschen einer Krankmeldung bewegt sich der Saldo sofort

**Aufrufe und Antworten**
```
VOR dem DELETE (Krankmeldung 11309, 2026-08-18, Nutzer 48716):
  GET /api/work-time-accounts?userId=48716          -> "currentBalance":-152   lastUpdated 2026-08-25 16:14:58
  GET /api/overtime/transactions/live?userId=48716  -> "currentBalance":-1032
  SELECT ROUND(SUM(overtime),2) FROM overtime_balance WHERE userId=48716 -> -392

DELETE /api/absences/11309 -> HTTP 200 {"success":true,"message":"Absence request deleted successfully"}

NACH dem DELETE:
  GET /api/work-time-accounts?userId=48716          -> "currentBalance":-392   lastUpdated 2026-08-25 16:33:29
  GET /api/overtime/transactions/live?userId=48716  -> "currentBalance":-1036
  SELECT ROUND(SUM(overtime),2) FROM overtime_balance WHERE userId=48716 -> -396
  SELECT COUNT(*) … referenceId=11309 -> 0
```
Differenz im Kontoauszug: −1032 → −1036, also **−4,00 h** = genau ein Tagessoll des Nutzers
(20 h/Woche → 4 h/Tag) — der unter 14.1-U5 beschriebene Rest.
**Urteil: BESTANDEN** — Differenz ≠ 0, unmittelbar nach dem `DELETE`, ohne Zwischenschritt.

---

### 14.1-U9a — Neu angelegte Krankmeldung erzeugt sofort die Gutschriftszeile

**Aufrufe und Antworten**
```
VOR:  SELECT COUNT(*) FROM overtime_transactions WHERE userId=48716 AND date='2026-08-18' AND type='sick_credit' -> 0

POST /api/absences {"type":"sick","startDate":"2026-08-18","endDate":"2026-08-18","reason":"Abnahme 14.1-U9a"}
-> HTTP 201 {"id":11309,"userId":48716,"type":"sick","days":1,"status":"approved",…}   (auto-genehmigt)

NACH, GET /api/overtime/transactions?userId=48716&limit=500, Zeilen zum 2026-08-18:
{"id":583025,"date":"2026-08-18","type":"time_entry","hours":-4,"description":"Abwesenheit (sick): Soll/Ist-Differenz","referenceType":"absence","referenceId":11309}
{"id":583026,"date":"2026-08-18","type":"sick_credit","hours":4,"description":"Krankheits-Gutschrift 2026-08-18","referenceType":"absence","referenceId":11309}
```
0 → 1 `sick_credit`-Zeile über **+4,00 h** = das Tagessoll des Nutzers (20 h/Woche). Die Triage
nennt +8,00 h, das gilt für einen 40-h-Nutzer.
**Urteil: BESTANDEN**

---

### 14.1-U12a — Abgelehnte Anträge stehen nicht mehr im Historien-Export

**Aufruf**
```
curl -s -b admin.jar "http://127.0.0.1:3000/api/exports/historical?startDate=2025-12-01&endDate=2026-10-31" -o hist.json
```
**Antwort**
```
HTTP 200  bytes=206023
Abwesenheiten im Export: 33
Status-Verteilung: {"approved":33}
Treffer abgelehnter Antrags-IDs im Export: 0   []
```
Die 15 abgelehnten Anträge im Zeitraum stammen aus
`SELECT id FROM absence_requests WHERE status='rejected'`:
ids 14, 20, 29, 18, 42, 32, 41, 45, 53, 57, 27, 44, 67, 61, 73.
**Urteil: BESTANDEN** — 0 Treffer (vorher 15).

---

### 14.1-U17a — Saldo nach Genehmigung eines Ausgleichs springt nicht mehr

**Aufrufe und Antworten**
```
Saldo VOR dem Antrag (Kontoauszug live, Nutzer 48717): 14
POST /api/absences {"type":"overtime_comp","startDate":"2026-09-01","endDate":"2026-09-01",…}
-> HTTP 201 {"id":11310,…,"status":"pending"}
Saldo nach dem Stellen: 14
POST /api/absences/11310/approve -> HTTP 200 {"status":"approved","approvedBy":1}

Kontoauszugsabfrage 1: 14
Kontoauszugsabfrage 2: 14
Kontoauszugsabfrage 3: 14
```
**Urteil: BESTANDEN** — drei aufeinanderfolgende Abfragen liefern denselben Wert, kein Sprung
(vorher −8,00 h). Anzumerken ist, dass der Ausgleichstag in der Zukunft liegt; die
Nicht-Bindung künftiger Ausgleiche ist Gegenstand von 14.1-U26a.

---

### 14.1-U18 — Ablehnen und Löschen geben die Stunden vollständig zurück

Vorbereitung: der Zeiteintrag des 2026-08-21 wurde entfernt, damit der Ausgleichstag frei ist;
zusätzliche Zeiteinträge an vier Tagen bauten das nötige Guthaben auf.

**Durchgang 1 — Ablehnen**
```
Ausgangssaldo: 38
POST /api/absences {"type":"overtime_comp","startDate":"2026-08-21","endDate":"2026-08-21",…} -> HTTP 201 {"id":11311}
Saldo nach dem Stellen: 38
POST /api/absences/11311/approve -> HTTP 200 ; Saldo: 38
POST /api/absences/11311/reject  -> HTTP 200 ; Saldo: 38     (Ausgangswert 38)
```
**Durchgang 2 — Löschen**
```
Ausgangssaldo: 38
POST /api/absences … -> HTTP 201 {"id":11312}
POST /api/absences/11312/approve -> HTTP 200 ; Saldo: 38
DELETE /api/absences/11312       -> HTTP 200 ; Saldo: 38     (Ausgangswert 38)
```
**Urteil: BESTANDEN** — beide Male exakt der Ausgangswert (vorher je 8,00 h zu wenig).

**Neuer Befund B-5, hier entstanden:** In beiden Durchgängen bleibt die `compensation`-Zeile im
Journal stehen:
```
id     userId  date        type          hours  referenceId  Status des Antrags
583266 48717   2026-08-21  compensation   -6    11311        rejected
583317 48717   2026-08-21  compensation   -6    11312        (Antrag gelöscht)
```
Die Live-Anzeige stützt sich nicht auf diese Zeilen (der Kontoauszug für den 2026-08-21 zeigt
nur `{"type":"time_entry","hours":-6,"description":"Keine Zeiterfassung (Soll: 6h)"}`), der
Saldo bleibt korrekt — es sind Karteileichen im gespeicherten Journal. Bei Urlaub und Krankheit
werden die Zeilen dagegen sauber entfernt (14.1-U6a, 14.1-U7a).

---

### 14.1-U26a — Zwei künftige Ausgleiche gehen gegen dasselbe Guthaben durch (CR-01)

**Erster Anlauf** (beide Anträge nacheinander stellen **und** genehmigen) wird bereits beim
Anlegen abgefangen:
```
Guthaben: 38 h, bereits genehmigt: 11310 (4 h, 2026-09-01) und 11313 (30 h, 2026-09-07…11)
POST /api/absences {"type":"overtime_comp","startDate":"2026-09-14","endDate":"2026-09-18",…}
-> HTTP 400  {"success":false,"error":"Insufficient overtime hours (need 30h, have 4h)"}
```
Die Prüfung beim **Anlegen** zieht genehmigte künftige Ausgleiche also ab.

**Zweiter Anlauf — der eigentliche CR-01-Fall:** zwei Anträge zuerst **offen** stellen, dann
nacheinander genehmigen. Verfügbar waren laut derselben Prüfung noch **4 h**.
```
POST /api/absences {"type":"overtime_comp","startDate":"2026-09-22","endDate":"2026-09-22",…}
-> HTTP 201 {"id":11314,"days":1,"status":"pending"}       (Dienstag, Soll 4 h)
POST /api/absences {"type":"overtime_comp","startDate":"2026-09-29","endDate":"2026-09-29",…}
-> HTTP 201 {"id":11315,"days":1,"status":"pending"}       (Dienstag, Soll 4 h)

POST /api/absences/11314/approve -> HTTP 200 {"id":11314,…,"status":"approved"}
POST /api/absences/11315/approve -> HTTP 200 {"id":11315,…,"status":"approved"}

Guthaben danach: GET /api/work-time-accounts?userId=48717 -> "currentBalance":38
```
Beide Ausgleiche über zusammen 8 h wurden gegen ein verfügbares Guthaben von 4 h genehmigt.
Der Genehmigungsweg prüft das Guthaben überhaupt nicht; die Prüfung sitzt allein im Anlegeweg und
zählt nur bereits **genehmigte** Anträge, nicht die offenen. Der Kontostand bleibt bei 38 h —
künftige Ausgleiche binden nichts.

**Urteil: BESTANDEN — der Befund bestätigt sich.** Präzisierung gegenüber der Triage: Nicht
„zwei künftige Ausgleiche nacheinander genehmigen" führt hindurch (das blockiert der Anlegeweg),
sondern **zwei gleichzeitig offene Anträge nacheinander genehmigen**.

---

## 7. Playwright-Sichtprüfungen

### Aufbau

```
node node_modules/@playwright/test/cli.js --version      -> Version 1.57.0
Chromium-Fassung (browser.version())                      -> 143.0.7499.4
Konfiguration: desktop/playwright.config.ts (nur Projekt chromium, baseURL http://localhost:1420)
Oberflächenserver: cd desktop && VITE_API_URL="http://127.0.0.1:3000/api" npx vite --host 127.0.0.1 --port 1420 --strictPort
```
Das Setzen von `VITE_API_URL` auf `127.0.0.1` war nötig, weil `desktop/.env` auf
`http://localhost:3000/api` zeigt und der Browser `localhost` zuerst über `::1` auflöst — dort
horcht ein fremdes Projekt (Befund B-1). Die Übersteuerung galt nur für diesen einen Prozess;
keine Datei wurde geändert.

### Befund: die Oberfläche lässt sich nicht ausliefern

**Aufruf**
```
node uiprobe.mjs ../.planning/ui-reviews/14-pw-01-startseite-hell.png light
```
**Antwort**
```
HTTP-Status: 200
document.title: Tauri + React + Typescript
URL: http://localhost:1420/
#root innerHTML (erste 400 Zeichen): ""
sichtbarer Text (erste 400 Zeichen): ""
--- Konsolen-/Seitenfehler ---
[console.error] Failed to load resource: the server responded with a status of 500 (Internal Server Error)
[console.debug] [vite] connecting...
[console.debug] [vite] connected.
```
Und im Protokoll des Vite-Servers wörtlich:
```
18:39:15 [vite] (client) Pre-transform error: Cannot find package '@babel/core' imported from
  C:\…\TimeTracking-Clean\node_modules\@vitejs\plugin-react\dist\index.js
  Plugin: vite:react-babel
  File:   C:/…/TimeTracking-Clean/desktop/src/main.tsx
```
Nachgeprüft: `ls node_modules/@babel/` liefert `generator`, `helper-string-parser`,
`helper-validator-identifier`, `parser`, `types` — **`core` fehlt**. `desktop/node_modules` ist
leer (0 Einträge). Es ist derselbe Installationsrest, der laut Triage-Abschnitt 7 schon `vitest`
im `desktop/` lahmlegt.

### Bildschirmfotos

| Datei | Was darauf zu sehen ist |
|---|---|
| `.planning/ui-reviews/14-pw-01-startseite-hell.png` | Hellmodus (`colorScheme: 'light'`), 1440 × 900. Die Seite ist bis auf die dunkle Vite-Fehlerüberlagerung leer. Die Überlagerung nennt in rot `[plugin:vite:react-babel] Cannot find package '@babel/core' imported from …\node_modules\@vitejs\plugin-react\dist\index.js`, darunter die betroffene Datei `…/desktop/src/main.tsx` und den Auflösungs-Stapel bis `onImport.tracePromise`. Kein einziges Element der Anwendung — keine Anmeldemaske, keine Navigation. |
| `.planning/ui-reviews/14-pw-02-startseite-dunkel.png` | Dunkelmodus (`colorScheme: 'dark'`), sonst identisch — bytegleich zum Hellmodus-Bild (66 204 Byte beide). Das ist der Beleg, dass die Anwendung gar nicht so weit kommt, ein Farbschema anzuwenden. |
| `.planning/ui-reviews/14-pw-03-user-edit-spec-fehlschlag.png` | Automatisches Fehlschlagbild aus `tests/user-edit.spec.ts` („Edit employee without email"), aufgenommen im Augenblick des Zeitablaufs. Dieselbe Fehlerüberlagerung; die von der Vorrichtung gesuchte Anmeldemaske `[name="username"]` ist nicht vorhanden. |

### P12-48 (+P12-37, P12-38, P12-39) — vollständiger Lauf der drei Spec-Dateien

**Aufruf**
```
cd desktop && node ../node_modules/@playwright/test/cli.js test --project=chromium --reporter=list
```
**Antwort**
```
Running 23 tests using 1 worker
  ✘ 1  [chromium] › tests\edge-cases.spec.ts:22:3  › Create employee with maximum allowed values (60h, 50 vacation)  (10.9s)
  ✘ 2  … Create employee with future hire date (10.9s)
  ✘ 3  … Create employee with very long names (10.8s)
  ✘ 4  … Create employee with special characters in names (10.8s)
  ✘ 5  … Create employee with decimal hours (part-time) (10.9s)
  ✘ 6  … Validation: Password too short should fail (10.8s)
  ✘ 7  … Validation: Username too short should fail (10.8s)
  ✘ 8  … Validation: Password mismatch should fail (10.9s)
  ✘ 9–13, 16  [chromium] › tests\user-creation.spec.ts …
  ✘ 17–23     [chromium] › tests\user-edit.spec.ts …
  (14 und 15 sind mit test.skip markiert: user-creation.spec.ts:160:8 und :177:8)

  Alle Fehlschläge mit demselben Wortlaut:
    TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
    Call log:
      - waiting for locator('[name="username"]') to be visible
    at fixtures\auth.ts:15  (loginAsAdmin)
```
Ergebnis: **21 rot, 2 übersprungen, 0 grün.** Alle 21 scheitern an derselben Stelle — die
Anmeldemaske erscheint nicht, weil die Anwendung nicht übersetzt werden kann. Der von Playwright
erzeugte Seiten-Abzug (`error-context.md`) enthält wörtlich denselben `@babel/core`-Satz.

**Urteil für sämtliche Playwright-Sichtprüfungen: NICHT PRÜFBAR.**
Grund: Playwright und Chromium 143.0.7499.4 laufen einwandfrei — Browser startet, Bildschirmfoto,
Video und Trace entstehen. Prüfbar ist trotzdem nichts, weil der Vite-Entwicklungsserver
`desktop/src/main.tsx` nicht übersetzen kann: **`@babel/core` ist im Projekt nicht installiert**
(`@vitejs/plugin-react` verlangt es). Die Anwendung liefert eine leere Seite.
Das betrifft alle in Abschnitt 5 der Triage als „PW: ja"/„PW: teilweise" geführten Zeilen,
namentlich P12-48 mit P12-37/38/39.

**Was es aufheben würde:** eine einzige Installation von `@babel/core` im Projektstamm. Sie
wurde bewusst **nicht** vorgenommen — der Auftrag verbietet Änderungen, und `npm install` gleicht
den gesamten Abhängigkeitsbaum ab, was den parallel laufenden AUTO-Durchgang stören könnte. Die
Entscheidung liegt beim Orchestrator.

---

## 8. Neue Befunde

**B-1 — Port 3000 ist auf IPv6 durch ein fremdes Projekt belegt; `localhost` trifft den falschen Server.**
Die Vorgabe „Port 3000 ist lokal frei" trifft nur für IPv4 zu.
```
Get-NetTCPConnection -State Listen | ? LocalPort -in 3000,1420
LocalAddress  LocalPort  OwningProcess
0.0.0.0            3000  34448     <- dieser Abnahmelauf (TimeTracking)
::                 3000  39860     <- "C:\…\Stiftung DPolG Website\stiftung-dpolg\node_modules\next\dist\server\lib\start-server.js"
::1                1420  26124     <- Vite (TimeTracking), vor diesem Lauf bereits gestartet
```
`curl http://localhost:3000/api/health` liefert deshalb eine Next.js-Fehlerseite
(`"Cannot find module './1682.js'"`), `curl http://127.0.0.1:3000/api/health` liefert
`{"status":"ok","message":"TimeTracking Server is running",…}`.
**Folgen im Betrieb:** (a) `validateOvertimeDetailed.ts` zeigt fest auf
`http://localhost:3000/api` und meldet ohne Gegenmaßnahme
„Could not fetch from Frontend API"; (b) `desktop/.env` zeigt auf
`http://localhost:3000/api`, ein Browser auf diesem Rechner erreicht damit den falschen Server.
Beides ist eine Eigenschaft dieses Arbeitsplatzes, nicht des Produkts — aber jede Prüfung, die
`localhost` verwendet, ist hier ohne Gegenmaßnahme wertlos.

**B-2 — `@babel/core` fehlt; die Desktop-Oberfläche kann lokal nicht ausgeliefert werden.**
Siehe Abschnitt 7. Blockiert sämtliche Playwright-Sichtprüfungen und (laut Triage) `vitest` im
`desktop/`.

**B-3 — `work_time_accounts.currentBalance` wird durch einen Stundenwechsel nicht fortgeschrieben.**
Zweimal beobachtet:
```
Nutzer 48716: Vorschau balanceAfter -396 | /overtime/transactions -396 | /work-time-accounts -152 (lastUpdated 16:14:58, Wechsel um 16:19:12)
Nutzer 48717: Vorschau balanceAfter   48 | /overtime/transactions   48 | /work-time-accounts    0 (lastUpdated 16:21:59, Wechsel um 16:22:17)
```
Der Wert holt erst bei der nächsten anderen Buchung auf (bei 48716 sprang er beim Löschen der
Krankmeldung von −152 auf −392). Der Kontoauszug der Oberfläche ist nicht betroffen, weil er
`/overtime/transactions/live` liest; jede Anzeige, die `GET /api/work-time-accounts` verwendet,
zeigt nach einem Modellwechsel einen veralteten Saldo.

**B-4 — `overtime_balance` trägt Zukunftsmonate mit negativem Saldo.**
Für den im Lauf angelegten Nutzer 48717: `2026-09: −130`, `2026-11: −74`, `2026-12: −88`. Sie
erreichen die Anzeige nicht (Zukunftsmonatsfilter), stehen aber in der abgeleiteten Tabelle.
Familie WR-01 / 14.1-U26.

**B-5 — Verwaiste `compensation`-Zeilen nach Ablehnen und Löschen eines Ausgleichs.**
Siehe 14.1-U18. Zwei Zeilen mit −6 h bleiben zu einem `rejected`- und einem gelöschten Antrag
stehen. Ohne Wirkung auf die Anzeige, aber Journalmüll.

**B-6 — Der Name des eintragenden Admins hängt am Live-Weg.**
`GET /api/overtime/transactions` liefert `createdBy: 1` und **kein** `adminName`;
nur `GET /api/overtime/transactions/live` liefert `adminName: "System Administrator"`. Die
Oberfläche liest den Live-Weg, deshalb ist P12-29a bestanden — aber wer die ältere Route
auswertet (etwa für einen Beleg), bekommt den Namen nicht.

---

## 9. Wirkung dieses Laufs auf den parallelen AUTO-Durchgang

Der Auftrag verlangte ausdrücklich `npm run seed:test-users` und `seedModelChangeUser.ts` gegen
`server/database/development.db`. Beide Skripte schreiben umfangreich. Drei Punkte des parallelen
AUTO-Blocks sind dadurch in `development.db` **nicht mehr wie erwartet messbar**:

1. **14.1-U21a** (Testnutzer 15015 trägt 30 Zukunftszeilen und 1 Monatszeile, `SUM(hours) = −88`).
   Gemessen nach dem Seeding:
   ```
   SELECT COUNT(*) FROM overtime_transactions WHERE userId=15015                        -> 0
   SELECT COUNT(*) FROM overtime_transactions WHERE userId=15015 AND date > date('now') -> 0
   SELECT month FROM overtime_balance WHERE userId=15015                                -> ["2026-01"]
   ```
   `npm run seed:test-users` hat den Nutzer neu aufgebaut; die 30 Zukunftszeilen existieren nicht
   mehr.
2. **14.1-U20a** (100 Journalzeilen unter dem Löschprädikat, 130 einschließlich 15015).
   Aktueller Stand:
   ```
   SELECT COUNT(*) FROM overtime_transactions WHERE date > date('now')  -> 68
   SELECT userId, COUNT(*) … GROUP BY userId                            -> [{"userId":48717,"c":68}]
   ```
   Die 68 Zeilen stammen sämtlich aus den Abwesenheitsprüfungen dieses Laufs (Nutzer 48717).
3. **14.1-U14a** (`totalOvertime` im Historien-Export). Der Export vom 2026-08-25 liefert
   `totalOvertime: -4021`. Ohne die vier in diesem Lauf angelegten Nutzer 48714–48717 wären es
   **−2635**; auf diese vier entfallen **−1386** (48714: −1004, 48716: −396, 48717: +14).
   Zusätzlich stehen alle Nutzer 15015–15024 nach dem Seeding auf 0.

Für 14.1-U20a, 14.1-U21a und 14.1-U14a ist `development.db` damit kein gültiger Messgegenstand
mehr. Wer sie belegen will, braucht eine Sicherung von vor 16:11 Uhr des 2026-08-25 —
`server/database/backups/` und `backups/development.PRE-14.1-06_20260825_070544.db` kommen dafür
in Frage.

---

## 10. Zustand nach dem Lauf

**Server:** beendet. Kein Listener mehr auf 0.0.0.0:3000 und 127.0.0.1:1420 aus diesem Lauf; der
Server im Produktionsmodus auf 3001 wurde nach 13-U17 beendet. Der fremde Next.js-Prozess auf
`[::]:3000` (PID 39860) lief vor diesem Lauf und wurde **nicht** angefasst. Der vor dem Lauf
bereits laufende Vite-Prozess auf `[::1]:1420` (PID 26124) wurde beendet, um die
Oberflächenprüfung durchführen zu können — er lässt sich mit `cd desktop && npm run dev`
jederzeit wieder starten.

**`server/database/development.db`** bleibt **verändert** zurück:
- Testkonten aus `npm run seed:test-users`: `admin` (Kennwort `admin123`) und
  `test.vollzeit`, `test.christine`, `test.overtime-plus`, `test.overtime-minus`, `test.unpaid`,
  `test.4day-week`, `test.complex`, `test.new2026`, `test.terminated`, `test.weekend`
  (alle Kennwort `test123`, ids 15015–15024).
- Modellwechsel-Nutzer aus `npm run seed:model-change`:
  `t1109-modellwechsel-2026-05-14`, **id 48714**, Kennwort `ModellwechselTest12345!`,
  Perioden 2025-01-01…2026-05-14 mit 40 h und ab 2026-05-14 mit 20 h.
- **Drei in diesem Lauf angelegte Abnahme-Konten — nicht gelöscht, sie werden für die
  Abnahmesitzung gebraucht:**

  | id | Benutzername | Kennwort | Zustand |
  |---|---|---|---|
  | 48715 | `abnahme.wegwerf1` | `NeuesPasswort999!` (nach dem Reset aus P12-30a) | soft-gelöscht (`deletedAt 2026-08-25 16:14:33`), `status inactive` — Beleg für P12-30a |
  | 48716 | `abnahme.kettenluecke` | `Abnahme12345!` | aktiv, Periodenkette wiederhergestellt (`validFrom 2026-01-01`), ein Zeiteintrag am 2026-01-15, Modellwechsel ab 2026-06-01 auf 20 h |
  | 48717 | `abnahme.vollstaendig` | `Abnahme12345!` | aktiv, 20 Zeiteinträge im August 2026, drei Perioden (40 h ab 01.08., 30 h mit Tagesplan Mo 8/Di 4/Mi 6/Do 6/Fr 6 ab 17.08., 20 h ab 11.11.), genehmigter Urlaub 09.–13.11.2026 und drei genehmigte Überstundenausgleiche (11310, 11314, 11315) |

- Weitere Spuren: die Storno-Paare 582627/582831 und 582832/582833, die
  Modellwechsel-Buchungen 582151, 582678, 582729, 582780, sowie die zwei verwaisten
  `compensation`-Zeilen 583266 und 583317 aus Befund B-5.
- `/api/admin/period-chains` meldet zum Abschluss wieder `ok:true, userCount:0`.

**Zusätzlich angelegte Datei:** `server/database/14-abnahme-ratelimit.db` — Arbeitskopie für den
Produktionsmodus-Nachweis unter 13-U17. Sie kann gelöscht werden.

**Nicht angefasst:** `14-produktionskopie.db`, `14-prod-nach-migration.db`, `14-generalprobe.db`
(kein Zugriff dieses Laufs), `/home/ubuntu/databases/production.db`, jede Form von Push,
Deployment oder Quelltextänderung. `git status` zeigt außer der bereits vorher vorhandenen,
fremden Datei `.planning/phases/10-perioden-fundament/10-REVIEW.md` keine unbeabsichtigten
Änderungen; die drei Bildschirmfotos unter `.planning/ui-reviews/` sind durch die dortige
`.gitignore` von der Versionierung ausgenommen.

**Migrationsstand:** Der erste Startversuch um 16:09 Uhr brach mit
`Migration 015_unique_reversal_of_index failed: SqliteError: database is locked (SQLITE_BUSY)`
ab — die Datenbank war zu diesem Zeitpunkt von einem anderen Prozess schreibgesperrt. Nach
kurzem Warten lief der zweite Versuch um 16:10 Uhr durch; Migration 015 ist seither angewendet.
