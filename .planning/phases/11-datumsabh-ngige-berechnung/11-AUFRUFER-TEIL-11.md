# Teilbeleg Plan 11-11: Nutzeranlage per direktem INSERT INTO users

**Erstellt:** 2026-08-22 (Plan 11-11, Task 3)
**Zweck:** Teilbeleg für die Zusammenführung in `11-AUFRUFER-CHECKLISTE.md` durch Plan 11-09
(sequenziell, Welle 4). Enthält ausschließlich die acht Fundstellen dieses Plans — Skripte,
die Nutzer per direktem `INSERT INTO users` anlegen, an `userService.createUser()` vorbei, und
deshalb ohne Plan 11-11 keine Arbeitszeitperiode gehabt hätten (D4-Risiko). `11-AUFRUFER-CHECKLISTE.md`
selbst wird von diesem Plan NICHT angefasst (T-11-47, verlorenes Update bei paralleler Welle 3).

---

## Fundstellen

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/scripts/seedTestData.ts:33` | `createUser()`-Helper (Skript-intern), aufgerufen für David/Emma/Frank | nein (Testdaten-Skript, `npm run seed-test-data`) | 11-11 | `ensureInitialWorkPeriod()` in der Helper-Funktion ergänzt — greift für alle drei Aufrufstellen. Probelauf bestätigt: 3 Nutzer, 3 Perioden, `checkPeriodChain` ok:true | ✓ |
| `server/src/scripts/seedTestUsers.ts:93` | `upsertUser()`-Helper (Skript-intern, Create-Zweig), aufgerufen für 10 Testnutzer | nein (Testdaten-Skript, `npm run seed:test-users`) | 11-11 | `ensureInitialWorkPeriod()` im Create-Zweig ergänzt; zusätzlich Sicherheitsnetz im Update-Zweig (Alt-Fälle). Nebenbefund: 3 Testnutzer hatten unvollständige `workSchedule`-Objekte (nur Arbeitstage gesetzt) — brach an der neuen Perioden-Validierung ab, mit allen sieben Wochentagsschlüsseln behoben (Rule 1). Probelauf bestätigt: 10 Nutzer, 10 Perioden, `checkPeriodChain` ok:true | ✓ |
| `server/src/scripts/createCompleteTestUser.ts:90` | `createCompleteTestUser()` (`db.transaction()`), ein Nutzer (test.max) | nein (Testdaten-Skript) | 11-11 | `ensureInitialWorkPeriod()` nach dem Transaktions-Commit, Nutzer über `getUserById()` geladen | ✓ |
| `server/src/scripts/createEnhancedTestUser.ts:123` | `createEnhancedTestUser()` (`db.transaction()`), ein Nutzer (test.anna) | nein (Testdaten-Skript) | 11-11 | wie oben | ✓ |
| `server/src/scripts/createNewEmployeeTestUser.ts:88` | `createNewEmployeeTestUser()` (`db.transaction()`), ein Nutzer (test.neuling) | nein (Testdaten-Skript) | 11-11 | wie oben | ✓ |
| `server/src/scripts/createOneTestUser.ts:19` | Skript-Top-Level (kein `db.transaction()`), ein Nutzer (test.max) | nein (Testdaten-Skript) | 11-11 | `ensureInitialWorkPeriod()` direkt nach der Anlage, Nutzer über `getUserById()` geladen | ✓ |
| `server/src/scripts/createSuperTestUser.ts:151` | `createSuperTestUser()` (`db.transaction()`), ein Nutzer (test.super) | nein (Testdaten-Skript) | 11-11 | wie oben | ✓ |
| `server/scripts/create-admin.ts:98` | `createAdmin()`, interaktives CLI, legt den ERSTEN Nutzer eines frischen Systems an | **ja** (Ersteinrichtung eines frischen Systems; außerhalb des `tsc`-Umfangs, `server/tsconfig.json` include: `src/**/*`) | 11-11 | `ensureInitialWorkPeriod()` über die kompilierte `dist/services/userService.js` ergänzt (Muster `fix-overtime.ts`). Nebenbefund (Rule 3, blockierend): Skript ignorierte `DATABASE_PATH` vollständig (`new Database('server/database.db')` fest verdrahtet) — auf die geteilte Verbindung aus `dist/database/connection.js` umgestellt, respektiert jetzt `DATABASE_PATH`. Echter Probelauf gegen `11-werkzeugprobe.db`: 1 Nutzer, 1 Periode (`validFrom` = Anlagedatum, Quelle: hireDate), `checkPeriodChain` ok:true | ✓ |

**Summe:** 8/8 Fundstellen versorgt. Kein Skript legt eine Periode über einen zweiten
Schreibweg an (`grep -rn "INSERT INTO user_work_periods" server/src/scripts server/scripts`
→ keine Zeile).

---

## Probelauf-Nachweis

Alle Probeläufe gegen `server/database/11-werkzeugprobe.db` (Wegwerfkopie, per `VACUUM INTO`
aus `server/database/development.db` gezogen). `server/database/11-nullwirkung.db` blieb
nachweislich unverändert (Dateizeitstempel von `.db` und `.db-wal` vor und nach allen
Probeläufen dieses Plans identisch: 2026-08-22 07:01).

### 1. `create-admin.ts` (Task 2)

Build der `dist/`-Ausgabe vorher (Repo ist wegen Plan 11-04 D3 projektweit erwartungsgemäß
rot — `tsc` ohne `--noEmit`-Fehlerabbruch, `noEmitOnError` ist nicht gesetzt, emittiert
trotzdem):

```
$ cd server && npx tsc
(5 vorbestehende Fehler in Dateien anderer, paralleler Pläne 11-05..08 — nicht Gegenstand
 dieses Plans; dist/services/userService.js enthält ensureInitialWorkPeriod danach)
```

Probelauf (interaktiv, Antworten zeitversetzt zugeführt):

```
$ DATABASE_PATH=./database/11-werkzeugprobe.db npx tsx scripts/create-admin.ts
Admin Username: werkzeugprobe-admin
Admin Email: werkzeugprobe-admin@test.local
Admin Password (min. 8 Zeichen): test12345
Vorname: Probe
Nachname: Admin
⚠️  Es existiert bereits ein Admin-User. Überschreiben? (ja/nein): ja
✅ Admin-User erfolgreich erstellt!
```

Nachprüfung (lesend, gegen `11-werkzeugprobe.db`):
- Nutzer `werkzeugprobe-admin` (id 12291), `hireDate: "2026-08-22"`
- genau eine Periode: `{"id":2164,"userId":12291,"validFrom":"2026-08-22","validTo":null,"note":"[ANLAGE-11-03] Startperiode, Quelle: hireDate"}`
- `checkPeriodChain(12291)` → `{"ok":true,"findings":[]}`

### 2. `seed:test-users` (Task 3)

```
$ DATABASE_PATH=./database/11-werkzeugprobe.db npm run seed:test-users
🎉 Test user seeding completed successfully!
```

(Erster Lauf brach mit `workSchedule ist kein gültiger Wochenplan` ab — Rule-1-Fund, siehe
Fundstellen-Tabelle oben und Commit `5194982`. Nach dem Fix erfolgreich.)

Nachprüfung: 10 Nutzer mit Benutzername `test.%`, jeder mit genau einer Periode (Summe
Nutzer = Summe Perioden = 10), `checkPeriodChain` für alle zehn `ok: true`.

### 3. `seed-test-data` (Task 3)

```
$ DATABASE_PATH=./database/11-werkzeugprobe.db npm run seed-test-data
✅ Test Data seeded successfully!
```

Nachprüfung: 3 Nutzer (`david_test`, `emma_test`, `frank_test`), jeder mit genau einer
Periode (Summe Nutzer = Summe Perioden = 3), `checkPeriodChain` für alle drei `ok: true`.

---

## tsc-Scope-Hinweis

`server/scripts/create-admin.ts` liegt außerhalb von `server/tsconfig.json` (`include:
["src/**/*"]`) — der Compiler prüft diese Datei nicht. Von Hand geprüft (vollständig
gelesen) und mit dem echten Probelauf oben belegt, wie in Task 2 gefordert.

Die sieben Dateien unter `server/src/scripts/` liegen im `tsc`-Umfang:
`npx tsc --noEmit 2>&1 | grep "src/scripts/(seedTestData|seedTestUsers|createCompleteTestUser|createEnhancedTestUser|createNewEmployeeTestUser|createOneTestUser|createSuperTestUser)"`
→ keine Zeile.
