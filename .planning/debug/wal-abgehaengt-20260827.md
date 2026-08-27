# DRINGEND — Abgehängte WAL-Datei der Produktionsdatenbank

**Angelegt:** 27.08.2026, ca. 22:40 Ortszeit (20:40 UTC)
**Status:** OFFEN — Daten sind in Gefahr, solange nicht gehandelt wird
**Nächster Schritt:** `/gsd:debug` mit diesem Dokument als Einstieg

---

## ⛔ Das Wichtigste zuerst

**Der Serverprozess `timetracking-server` darf NICHT beendet oder neu gestartet werden.**

Kein `pm2 restart`, kein `pm2 stop`, kein `git push` auf `main` (löst Deployment mit
PM2-Neustart aus), kein Reboot.

Bei einem Neustart gehen **alle Änderungen seit dem 27.08.2026, 11:26 UTC** verloren —
darunter der erste reale Arbeitszeitmodellwechsel (Nutzer 16, Benedikt Jochem, 30 → 40 h ab
01.08.2026), den der Anwender am selben Abend eingetragen hat.

---

## Der Befund

Der Serverprozess (PID zum Zeitpunkt der Aufnahme: 3701715) hält folgende Dateizeiger:

```
fd 19 → /home/ubuntu/databases/production.db
fd 20 → /home/ubuntu/databases/production.db-wal  (deleted)
fd 21 → /home/ubuntu/databases/production.db-shm  (deleted)
```

Die Schreibprotokoll-Datei (WAL), in die der Server schreibt, ist **aus dem Dateisystem
gelöscht**. Der Prozess hält sie über einen offenen Dateizeiger weiter und kann sie lesen und
beschreiben — kein anderer Prozess kann das.

Dateizustände auf der Platte (Stand 20:22 UTC):

```
production.db       1740800 B   27. Aug 03:00   ← Stand des Nachtlaufs
production.db-shm     32768 B   27. Aug 20:21   ← neu, von Fremdverbindungen
production.db-wal         0 B   27. Aug 11:26   ← neu und leer
```

Die Hauptdatei trägt den Stand von **03:00 Uhr** (dem nächtlichen `fix-overtime.ts`-Lauf).
Seither hat sie keinen Prüfpunkt mehr gesehen — ihr Änderungszeitpunkt bewegt sich nicht.

### Nachweis, dass die Daten wirklich auseinanderlaufen

| | Anwendung (Serverprozess) | Datei auf Platte |
|---|---|---|
| Perioden Nutzer 16 | zwei (ab 01.01. mit 30 h, ab 01.08. mit 40 h) | **eine** (ab 01.01., 30 h) |
| `model_change`-Buchungen | eine, −28:00 h, sichtbar im Kontoauszug | **null** |
| August 2026 | Soll 152, Ist 104,5, OT −47:30 | Soll 114, Ist 94,5, OT −19:30 |
| Saldo Nutzer 16 | **−32:00 h** | **−4:00 h** |

Beides ist mehrfach gegengeprüft: die Anwendungsseite über Bildschirmfotos des Anwenders
(Monatliche Entwicklung, Überstunden-Kontoauszug mit der Modellwechsel-Buchung), die
Dateiseite über `VACUUM INTO` in eine Wegwerfkopie.

---

## Ursache

Wiederholte **Lesezugriffe von außen** auf `/home/ubuntu/databases/production.db` — im Zuge
der Zahlenprüfungen für den Anwender wurden mehrfach `VACUUM INTO`-Kopien aus einem eigenen
`npx tsx`-Prozess gezogen. SQLite räumt WAL und SHM auf, wenn sich eine Verbindung für die
letzte hält; der laufende Serverprozess wurde dabei nicht berücksichtigt. Danach legten neue
Verbindungen frische, leere WAL/SHM-Dateien an, während der Server weiter in die abgehängte
schreibt.

**Das ist derselbe Mechanismus wie im Vorfall vom 18.08.2026**
(`.planning/debug/db-stabilisierung-20260818.md`). Die Regel dagegen steht in
`.claude/CLAUDE.md` unter „Database Rules": frische Daten nicht per direktem Dateizugriff
prüfen, sondern über die API oder `pm2 logs`. Die Regel wurde zitiert und dann gebrochen.

---

## Zweiter, unabhängiger Befund: Die Backup-Funktion erzeugt defekte Dateien

Alle drei geprüften Sicherungen aus der App sind **nicht wiederherstellbar**:

| Datei | Größe | Rest zu 4096 | Öffnen |
|---|---:|---:|---|
| `database-backup-2026-08-20T00-00-00-022Z.db` | 1.528.180 | 372 | `database disk image is malformed` |
| `database-backup-2026-08-21T16-40-08-001Z.db` | 1.541.808 | 1.712 | `database disk image is malformed` |
| `database-backup-2026-08-27T20-27-22-251Z.db` | 1.910.123 | 1.387 | `unsupported file format` |

Alle liegen im Download-Ordner des Anwenders. Eine gültige SQLite-Datei hat eine Größe, die
ein Vielfaches der Seitengröße (hier 4096 B) ist — keine der drei erfüllt das.

Ursache vermutlich: Die Backup-Funktion kopiert die Datei (`copyfile`, belegt durch
`❌ Backup creation failed: Error: ENOENT ... copyfile` im Fehlerprotokoll vom 20.08.),
während in die Datenbank geschrieben wird. Bei WAL-Betrieb entsteht dabei ein zerrissener
Zwischenstand. Richtig wäre `VACUUM INTO` oder die SQLite-Backup-API.

**Folge:** Die Sicherung, die der Anwender heute Abend zur Rettung angelegt hat, ist
wertlos. Sie enthält den Umstellungsfall nicht und ließe sich ohnehin nicht einspielen.

---

## Was intakt ist

Diese Sicherungen sind mit `VACUUM INTO` gezogen, geprüft (`integrity_check: ok`) und
brauchbar — sie enthalten allerdings **nicht** die heutige Umstellung:

| Datei | Stand |
|---|---|
| `~/Downloads/TimeTracking-Sicherung-20260826_063302/production.VOR-RELEASE_20260826_063302.db` | 26.08. vor der Auslieferung |
| `~/Downloads/TimeTracking-Sicherung-20260825_033810/production.AKTUELL_20260825_033810.db` | 25.08. |
| `~/Downloads/TimeTracking-Sicherung-20260825_033810/production.VOR-DEPLOYMENT_20260823_111541.db` | 23.08. vor dem Deployment |
| auf dem Server: `/home/ubuntu/databases/backups/production.PRE-RELEASE_20260826_063302.db` | 26.08. |

---

## Aufgabe für die Untersuchung

**Ziel:** Den Stand aus der abgehängten WAL-Datei in die Hauptdatei überführen, ohne den
Prozess zu beenden — oder, falls das nicht geht, den Informationsgehalt so sichern, dass er
danach wiederhergestellt werden kann.

**Denkbare Wege, alle noch zu bewerten:**

1. **Prüfpunkt aus dem laufenden Prozess heraus erzwingen.** Der Server müsste
   `PRAGMA wal_checkpoint(TRUNCATE)` auf seiner eigenen Verbindung ausführen. Zu klären: Gibt
   es einen Endpunkt, der das auslöst oder auslösen kann? Reicht ein Schreibvorgang über die
   API, damit der automatische Prüfpunkt greift (Standardschwelle 1000 Seiten)? Der
   Änderungszeitpunkt der Hauptdatei zeigt, ob es gewirkt hat.

2. **Datenexport über die API.** Alles, was der Server sieht, über seine eigenen Endpunkte
   auslesen und als Datei sichern. Rettet den Informationsgehalt, nicht die Datei.

3. **Die WAL-Datei über den Dateizeiger des Prozesses lesen.** `/proc/3701715/fd/20` ist
   lesbar, solange der Prozess läuft. Ob sich daraus zusammen mit der Hauptdatei ein
   konsistenter Stand herstellen lässt, ist zu prüfen — die Reihenfolge (erst Hauptdatei
   kopieren, dann WAL) ist dabei entscheidend.

4. **Kontrollierter Neustart mit sauberem Schließen.** Nur wenn belegt ist, dass die
   Anwendung beim Beenden `db.close()` aufruft und SQLite dabei den Prüfpunkt setzt. **Ohne
   diesen Beleg ist das Datenverlust.** Zu prüfen: `server/src/server.ts`, Signalbehandlung.

**Reihenfolge:** Erst Weg 2 oder 3 (sichern), dann Weg 1 (reparieren), Weg 4 nur als letztes
und nur mit Nachweis.

---

## Was die Untersuchung NICHT tun darf

- **Keine weiteren Verbindungen von außen** auf `/home/ubuntu/databases/production.db` —
  weder lesend noch mit `VACUUM INTO`. Genau das hat den Schaden verursacht. Prüfungen
  ausschließlich über die API oder `pm2 logs`.
- Kein `pm2 restart` / `stop` / `reload`, kein `git push` auf `main`, kein Deployment.
- Keine Wiederherstellung aus einer der drei defekten App-Sicherungen.

---

## Zustand des Milestones, unabhängig von diesem Vorfall

Milestone v3.0 ist inhaltlich abgeschlossen: Phasen 9 bis 14.2 fertig, Produktion läuft auf
`eaf5f5c`, Desktop-Release **v1.9.0** ist veröffentlicht und beim Anwender installiert. Der
Anwender hat die ausgelieferten Zahlen selbst gegengeprüft und bestätigt (Benedikt Jochem,
acht Monate auf die Minute). Der erste reale Umstellungsfall wurde erfolgreich eingetragen —
die Vorschau versprach −32:00 h, das Ergebnis lautete −32:00 h.

**Offen nach diesem Vorfall:**

- die Rettung des Standes (dieses Dokument)
- die defekte Backup-Funktion (eigener Befund, gehört in einen Folge-Milestone)
- Plan 14-09 formal abschließen, sobald der Stand gesichert ist
- 89 Abnahme-Entscheidungen, 10 Warnungen aus `14-WEITERE-BEFUNDE.md`, AB-01 und AB-02 aus
  `.planning/phases/14-absicherung-und-auslieferung/deferred-items.md`
- Milestone-Abschluss: `/gsd:audit-milestone` → `/gsd:complete-milestone` → `/gsd:cleanup`
