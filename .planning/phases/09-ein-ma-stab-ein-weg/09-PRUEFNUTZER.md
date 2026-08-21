# Prüfnutzer für den Wege-Vergleich (D3/D4)

**Erstellt:** 2026-08-21 (Plan 09-02, Task 1)
**Zweck:** Drei reale Nutzer nach den Auswahlkriterien aus `09-CONTEXT.md` (D4), gegen die
`compareOvertimePaths.ts` (Task 2) und `validateOvertimeDetailed` (Task 3) laufen. Keine
E-Mail-Adressen, keine Passwort-Hashes — nur `userId`, Name, Stammdaten und Prüfmonat.

---

## Datengrundlage: keine frische `npm run sync-dev-db`-Kopie gezogen (dokumentierte Abweichung)

Der Plan verlangt in Task 1 `npm run sync-dev-db`. Der lokale Dev-Server lief zum
Ausführungszeitpunkt (Port 3000 durch mehrere `node.exe`-Prozesse belegt, u. a. PID 32280 im
Zustand `HERGESTELLT`) und hält `server/database/development.db` offen. Ein Sync-Lauf hätte
laut `.planning/notes/db-pfad-diskrepanz-20260821.md` (Abschnitt „Nebenbefund") in Schritt 5/6
mit `mv: ... Device or resource busy` fehlschlagen müssen, weil `scripts/sync-dev-db.sh` die
Zieldatei per `mv` ersetzt, während der Server sie offen hält.

Statt den Sync zu erzwingen (und damit ggf. die laufende Dev-Datenbank zu beschädigen), wurde die
Aktualität der bestehenden lokalen Kopie direkt geprüft — das ist laut Plan-Vorgabe (Executor-
Kontext dieses Laufs) der vorgesehene Ausweg bei dieser bekannten Sperre:

```
node -e "... SELECT COUNT(*) FROM users WHERE deletedAt IS NULL; SELECT MAX(date) FROM time_entries; ..."
```

Ergebnis, Prüfzeitpunkt 2026-08-21 21:xx Uhr (lokale Systemzeit), Datei
`server/database/development.db`, zuletzt modifiziert **21.08.2026 21:00**:

| Tabelle | Zeilen |
|---|---|
| `users` (gesamt) | 20 |
| `users` (`deletedAt IS NULL`, aktiv) | 18 |
| `time_entries` | 711 (jüngster Eintrag: `time_entries.date = 2026-08-20`) |
| `absence_requests` | 43 |
| `overtime_balance` | 144 |

Das deckt sich exakt mit dem in `.planning/notes/db-pfad-diskrepanz-20260821.md` dokumentierten
Stand („Stand 21.08.2026 21:00 ... 20 Nutzer ... letzter `time_entries.date` = 2026-08-20") — die
lokale Kopie enthält echte, aktuelle Produktionsdaten und ist keine veraltete oder leere
Datenbank. Die tote `server/database.db` (02.04.2026, 831 KB) wurde nicht angerührt und ist
weiterhin nur eine Altlast im Serverwurzelverzeichnis, nicht die verwendete Datei.

---

## Auswahl

### Nutzer A — Kriterium: `workSchedule` gesetzt, mit einem 0-Stunden-Tag innerhalb Mo–Fr

**Karin Jochem, `userId 2`**

| Feld | Wert |
|---|---|
| `weeklyHours` | 5 |
| `workSchedule` | `{"monday":0,"tuesday":0,"wednesday":0,"thursday":5,"friday":0,"saturday":0,"sunday":0}` |
| `hireDate` | 2026-01-01 |
| `status` | active |
| `deletedAt` | NULL |
| Prüfmonat | **2026-07** |
| Erfülltes Kriterium | `workSchedule IS NOT NULL`, `deletedAt IS NULL`, `status = 'active'`; vier von
  fünf Werktagen (Montag, Dienstag, Mittwoch, Freitag) stehen mit `0` im `workSchedule` — der
  denkbar größte Kontrast zu `weeklyHours / 5 = 1` an jedem Werktag. Ein Rechenweg, der Stufe 2 von
  `getDailyTargetHours()` überspringt, würde für Karin Jochem an vier von fünf Werktagen ein
  falsches Sollstunden-Ergebnis liefern statt `0`. |

**SQL, mit dem der Nutzer gefunden wurde:**
```sql
SELECT id, firstName, lastName, weeklyHours, workSchedule, hireDate, status
FROM users
WHERE workSchedule IS NOT NULL AND deletedAt IS NULL AND status = 'active';
```
Ergebnis: 6 Kandidaten (`userId` 2, 3, 17, 18, 19, 28). Karin Jochem gewählt, weil ihr
`workSchedule` mit vier 0-Stunden-Werktagen den stärksten Kontrast zur Fallback-Formel
`weeklyHours / 5` bietet und sie zugleich eine reale, bereits im Rahmen von Plan 06-07 einzeln
verifizierte Mitarbeiterin ist (kein Testnutzer).

### Nutzer B — Kriterium: kein `workSchedule`, `weeklyHours > 0`

**Benedikt Jochem, `userId 16`**

| Feld | Wert |
|---|---|
| `weeklyHours` | 30 |
| `workSchedule` | NULL |
| `hireDate` | 2026-01-01 |
| `status` | active |
| `deletedAt` | NULL |
| Prüfmonat | **2026-07** |
| Erfülltes Kriterium | `workSchedule IS NULL` und `weeklyHours = 30 > 0` und `deletedAt IS NULL` — für
  diesen Nutzer greift bei `getDailyTargetHours()` ausschließlich die Fallback-Formel
  (`weeklyHours / 5 = 6` an jedem Werktag ohne Feiertag). |

**SQL, mit dem der Nutzer gefunden wurde:**
```sql
SELECT id, firstName, lastName, weeklyHours, workSchedule, hireDate, status
FROM users
WHERE workSchedule IS NULL AND weeklyHours > 0 AND deletedAt IS NULL;
```
Ergebnis: 6 Kandidaten (`userId` 16, 20, 21, 25, 30, 31). `userId` 30 („Test Urlaub") und 31
(„UA T") sind laut `.planning/STATE.md` („Testdaten in Produktion") explizit als Testnutzer
dokumentiert und wurden deshalb ausgeschlossen. Benedikt Jochem gewählt, weil er ebenfalls
bereits als realer, einzeln verifizierter Mitarbeiter aus Plan 06-07 bekannt ist.

### Nutzer C — Kriterium: genehmigter `overtime_comp`-Antrag (Reproduktionsfall für Plan 09-04)

**Carmen Rothemund, `userId 17`**

| Feld | Wert |
|---|---|
| `weeklyHours` | 12 |
| `workSchedule` | `{"monday":4,"tuesday":4,"wednesday":0,"thursday":4,"friday":0,"saturday":0,"sunday":0}` |
| `hireDate` | 2026-01-01 |
| `status` | active |
| `deletedAt` | NULL |
| Prüfmonat | **2026-04** (enthält den genehmigten `overtime_comp`-Zeitraum 2026-04-13) |
| Erfülltes Kriterium | Mindestens ein Eintrag in `absence_requests` mit `type = 'overtime_comp'`
  und `status = 'approved'` (`id = 56`, `startDate = endDate = 2026-04-13`, `approvedBy = 16`,
  `approvedAt = 2026-04-14 06:06:02`). |

**SQL, mit dem der Nutzer gefunden wurde:**
```sql
SELECT ar.id AS reqId, ar.userId, ar.startDate, ar.endDate, ar.status,
       u.firstName, u.lastName, u.weeklyHours, u.workSchedule, u.deletedAt
FROM absence_requests ar
JOIN users u ON u.id = ar.userId
WHERE ar.type = 'overtime_comp' AND ar.status = 'approved';
```
Ergebnis: 3 Kandidaten (`userId` 18/`reqId` 25, `userId` 17/`reqId` 56, `userId` 3/`reqId` 64).
Carmen Rothemund gewählt statt der beiden anderen Kandidaten, weil sie bereits der dokumentierte
reale Fall aus `.planning/debug/carmen-rothemund-overtime-analysis.md` und aus der Abweichung A-1
in `09-INVENTAR-SOLLSTUNDEN.md` ist — derselbe Nutzer erscheint zusätzlich in der Kandidatenliste
für Nutzer A (`workSchedule IS NOT NULL`), wurde dort aber bewusst nicht gewählt, damit alle drei
Prüfnutzer verschiedene `userId` sind (Karin Jochem deckt Kriterium A stattdessen ab).

---

## Zusammenfassung — drei verschiedene `userId`

| Nutzer | `userId` | Kriterium (D4) | Prüfmonat |
|---|---|---|---|
| A | 2 (Karin Jochem) | `workSchedule` mit 0-Stunden-Werktagen | 2026-07 |
| B | 16 (Benedikt Jochem) | kein `workSchedule`, `weeklyHours > 0` | 2026-07 |
| C | 17 (Carmen Rothemund) | genehmigter `overtime_comp`-Antrag | 2026-04 |

Maschinenlesbare Fassung: `.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv`.
