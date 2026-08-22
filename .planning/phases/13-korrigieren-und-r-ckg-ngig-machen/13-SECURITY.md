---
phase: 13-korrigieren-und-r-ckg-ngig-machen
audited: 2026-08-23
scope: 13-01-PLAN.md bis 13-11-PLAN.md, <threat_model>-Blöcke
threats_total: 54
threats_closed: 53
threats_open: 1
findings_blocker: 0
findings_warning: 3
findings_info: 4
status: open_threats
---

# Phase 13 — Retrospektive Sicherheitsprüfung

**Geprüft:** 2026-08-23
**Umfang:** die elf `<threat_model>`-Blöcke der Pläne 13-01 bis 13-11 (53 nummerierte Bedrohungen
plus `T-13-SC` in jedem der elf Pläne), gegen den tatsächlich umgesetzten Code
**Vorlauf:** `13-REVIEW.md` (2 Critical, 13 Warnungen — Status `fixed`) wurde zuerst gelesen;
bereits Behobenes wird hier nicht erneut gemeldet. Die eine Ausnahme ist WR-07, weil der Code
selbst festhält, dass die Ursache **nicht** beseitigt wurde (siehe Befund B-1).

---

## Zusammenfassung

Die fünf Schwerpunkte der Prüfung tragen. Die Rollenprüfung liegt an allen sieben
Perioden-Endpunkten im Server und ist als HTTP-Test mit Mitarbeiter-Sitzung belegt, nicht durch
Hinsehen. Die drei Vorschau-Token sind signiert, an Admin, Aktion und Objekt gebunden, zeitlich
begrenzt und gegenseitig nicht einlösbar — jede dieser vier Eigenschaften hat einen eigenen Test.
Die Pflichtbegründung wird in allen drei Schreibdiensten geprüft, nicht in der Route und nicht nur
im Formular. Das Löschen ist ein Soft-Delete mit Gegenbuchung; kein Lesepfad und kein Rebuild
entfernt die Storno-Geschichte.

Ein Punkt bleibt offen und drei Punkte verdienen eine Notiz:

- **B-1 (hoch, außerhalb des Bedrohungsregisters):** `PUT /api/users/:id` schreibt weiterhin
  Periodenwerte — ohne Vorschau-Token, ohne Pflichtbegründung, ohne Journalzeile, ohne
  `audit_log`. Die Aktion ist admin-beschränkt, aber sie unterläuft REQ-30 vollständig. Der Code
  sagt das selbst; PROJECT_STATUS.md führt es als offenen Restposten.
- **B-2 (mittel, T-13-02 teilweise):** Die Nutzungsbedingung des aussetzbaren Kettenriegels
  („ausschließlich innerhalb einer `db.transaction()`-Klammer") steht nur im Kommentar. Es gibt
  keine Laufzeitprüfung und keine Rücksetzung beim Serverstart.
- **B-3 (niedrig, Prozess):** Zehn der elf SUMMARY-Dateien tragen keinen Abschnitt
  `## Threat Flags`. Neue Angriffsfläche wäre über diesen Weg nicht sichtbar geworden — B-1 ist
  genau so durchgerutscht.

**Empfehlung:** Kein Auslieferungshindernis für Phase 13 selbst. B-1 gehört als benannter
Prüfpunkt in Phase 14, bevor ein Produktionslauf stattfindet.

---

## Schwerpunkt 1 — REQ-31 wörtlich: Perioden eines anderen weder sehen noch abrufen

Es gibt genau **einen** Lesepfad, der Periodendaten über HTTP herausgibt. `getWorkPeriodsWithFlags`
wird in `server/src/routes/` an keiner anderen Stelle aufgerufen als in
`server/src/routes/workPeriods.ts:287` — kein zweiter Endpunkt, über den Perioden nebenbei
mitgeliefert würden.

Alle sieben Endpunkte des Routers, mit ihrer Middleware-Kette:

| Endpunkt | Datei:Zeile | Kette | Rollenprüfung |
|----------|-------------|-------|---------------|
| `GET /api/work-periods` | `routes/workPeriods.ts:253-255` | `requireAuth` | Eigentümerprüfung im Handler, `:280-283` |
| `POST /preview` (Phase 12) | `:361-365` | `requireAuth` → Limiter → `requireAdmin` | `requireAdmin` |
| `POST /change` (Phase 12) | `:361-365` | `requireAuth` → Limiter → `requireAdmin` | `requireAdmin` |
| `POST /:id/correct/preview` | `:456-461` | Gastlimiter → `requireAuth` → Limiter → `requireAdmin` | `requireAdmin` |
| `PUT /:id` | `:520-524` | `requireAuth` → Limiter → `requireAdmin` | `requireAdmin` |
| `POST /:id/delete/preview` | `:611-616` | Gastlimiter → `requireAuth` → Limiter → `requireAdmin` | `requireAdmin` |
| `DELETE /:id` | `:660-664` | `requireAuth` → Limiter → `requireAdmin` | `requireAdmin` |

Der Lesepfad ist der einzige ohne `requireAdmin`, und das ist beabsichtigt — ein Mitarbeiter darf
seine eigenen Perioden sehen. Die Abgrenzung steht in `routes/workPeriods.ts:280-283`:

```
if (!isAdmin && requestedUserId !== req.session.user!.id) {
  res.status(403).json({ success: false, error: 'Forbidden' });
```

Kein stiller Rückfall auf das eigene Konto, sondern 403. Der Sonderfall `?userId=1&userId=2`
(Express liefert dann ein Array) wird bei `:265-269` mit 400 abgewiesen, statt über die implizite
Zeichenkettenkonvertierung zu `1` zu werden.

Belegt ist das nicht durch Lesen, sondern durch
`server/src/routes/workPeriods.authorization.test.ts`: Zeile 142 (fremde `userId` → 403), 151
(eigene → 200), 160 (Admin → 200), 170/178/187/193 (die vier neuen Endpunkte mit
Mitarbeiter-Sitzung → 403), 201 (die beiden Phase-12-Endpunkte, Bestandsschutz), 216 (alle sechs
Schreib-/Vorschaupfade ohne Sitzung → 401). Zwei Tests prüfen zusätzlich die **Wirkung** und nicht
nur den Statuscode: nach dem abgelehnten `DELETE` ist `periodB.deletedAt` weiterhin `null`
(`:240-250`), nach dem abgelehnten `PUT` sind die `weeklyHours` unverändert (`:252-264`).

Die Oberfläche verlässt sich nicht auf sich selbst und sagt das auch:
`desktop/src/components/worktime/WorkTimePeriodList.tsx:9-15` und
`desktop/src/components/users/EditUserModal.tsx:113-117` halten beide fest, dass das Ausblenden
Bequemlichkeit ist und die Durchsetzung serverseitig liegt.

**Bewertung:** REQ-31 ist an der API durchgesetzt. T-13-20, T-13-23 geschlossen.

---

## Schwerpunkt 2 — Die Vorschau-Token

`server/src/services/workTimeChangeToken.ts` trägt seit Plan 13-05 drei Bahnen. Die vier Fragen der
Reihe nach:

**Signiert?** Ja. HMAC-SHA256 über die kanonische Zeichenkette, Schlüssel ist `SESSION_SECRET`
(`:120-122`, `:131-137`). `resolveSecret()` (`:94-106`) wirft in Produktion, wenn
`SESSION_SECRET` fehlt — der Entwicklungsersatzwert greift ausschließlich bei
`NODE_ENV !== 'production'`. Das entspricht der Projektregel „`SESSION_SECRET` aus `.env`".
Der Vergleich läuft über `timingSafeEqual` (`:190`), und bei ungleicher Pufferlänge wird
vorher abgebrochen (`:187-189`), ohne die Puffer überhaupt zu vergleichen.

**An Nutzer und Aktion gebunden?** Ja, an beides:

| Bahn | Kanonische Zeichenkette | Datei:Zeile |
|------|------------------------|-------------|
| Stundenwechsel | `v2\|adminId\|userId\|validFrom\|hours\|schedule\|issuedAt` | `:108-118` |
| Korrektur | `v2\|`**`correct`**`\|adminId\|periodId\|validFrom\|hours\|schedule\|issuedAt` | `:246-260` |
| Löschen | `v2\|`**`delete`**`\|adminId\|periodId\|issuedAt` | `:290-301` |

Die `adminId` ist Teil aller drei Zeichenketten. Ein Token von Admin A ist für Admin B nicht
einlösbar — Test 2b in `workTimeChangeToken.test.ts:56`, für die Korrekturbahn Test 3 bei `:284`.

**Kann ein Token eines Nutzers auf einen anderen angewendet werden?** Nein, und zwar über zwei
unabhängige Riegel. Erstens bindet das Token die `periodId`; ein Lösch-Token für Periode A
validiert nicht gegen Periode B (Test 2, `:278`). Zweitens trägt der Eingabevertrag überhaupt
keine `userId` — der betroffene Nutzer wird aus der Periode gelesen
(`workPeriodCorrectionService.ts:259-262`, `workPeriodDeletionService.ts:177-183`), und die
`periodId` kommt aus der Pfadangabe, nie aus dem Anfragekörper
(`routes/workPeriods.ts:161-166`, `:200-205`). Ein mitgeschickter abweichender `userId` bewirkt
nichts, weil er nirgends gelesen wird. Das ist T-13-12, und es ist strukturell gelöst statt durch
eine Prüfung.

**Für eine andere Aktion eintauschbar?** Nein. Das Zweckfeld an zweiter Stelle kann niemals eine
Zahl sein, während die Stundenwechselbahn dort `String(adminId)` führt; zusätzlich unterscheiden
sich die Feldzahlen (7 / 8 / 5). Alle sechs Richtungen sind getestet:
`workTimeChangeToken.test.ts:230` (Korrektur → Stundenwechsel), `:243` (Stundenwechsel →
Korrektur), `:263` (Korrektur ↔ Löschen).

**Zeitlich begrenzt?** 15 Minuten (`:84`, `:199-201`), zuzüglich einer Ablehnung bei mehr als
60 Sekunden Vorlauf gegen Uhrenversatz (`:86`, `:196-198`). Getestet bei `:132`, `:296`, `:308`.
Die Prüfreihenfolge Format → Signatur → Ablauf (`:150-201`) verhindert, dass ein Token mit
falscher Signatur je als `expired` gemeldet wird — es gäbe sonst eine Aussage über einen Inhalt,
der nie verifiziert wurde.

**Kein Orakel im Ablehnungsgrund:** Beide Speicherrouten antworten für `malformed`, `mismatch` und
`expired` mit derselben 409-Meldung; der Grund steht ausschließlich im `logger.warn`
(`routes/workPeriods.ts:540-563` und `:678-700`). Das ist T-13-22 und zugleich T-13-25, denn
derselbe `logger.warn` trägt `reason`, `periodId` und `adminId`.

**Bewertung:** T-13-21, T-13-22, T-13-25 geschlossen. Ein Restpunkt ohne heutige Ausnutzbarkeit
steht als Befund I-2.

---

## Schwerpunkt 3 — Der aussetzbare Kettenriegel

Die Steuertabelle entsteht in Migration 013
(`server/src/database/migrations/013_soft_delete_user_work_periods.ts:73-81`), die vier
aussetzbaren Trigger-Klauseln lesen sie bei `:165`, `:174`, `:191`, `:201`. Der DELETE-Riegel
(`:218-236`) ist bewusst **nicht** aussetzbar. `server/src/database/schema.ts:268-274` und
`:326-390` halten die Parität für Neuinstallationen.

Die drei gestellten Fragen:

**Kann er außerhalb einer Transaktion ausgesetzt bleiben?** Technisch ja — und der Beweis steht in
der eigenen Testdatei. `withSuspendedChainGuard()`
(`server/src/services/workPeriodService.ts:742-749`) enthält keinerlei Prüfung darauf, ob eine
Transaktion läuft; `grep -rn "inTransaction" server/src` liefert **null** Treffer.
`workPeriodService.test.ts:637-663` ruft die Funktion außerhalb jeder `db.transaction()`-Klammer
auf, und sie arbeitet klaglos. Heute hält die Bedingung trotzdem: der einzige Produktivaufrufer ist
`workPeriodCorrectionService.ts:380`, und der steht innerhalb der `db.transaction()`, die bei
`:253` beginnt. Aber die Zusage von T-13-02 lautet „ausschließlich … erlaubt", und dieses
„ausschließlich" ist eine Konvention im Kopfkommentar (`workPeriodService.ts:732-741`), kein
Riegel. Siehe Befund B-2.

**Was passiert bei einem Absturz zwischen Aussetzung und `finally`-Rücksetzung?** Solange die
Bedingung eingehalten wird: nichts Bleibendes. `db.transaction()` von better-sqlite3 setzt ein
`BEGIN` ab; die erste schreibende Anweisung der Klammer ist im Korrekturpfad längst gelaufen, wenn
`withSuspendedChainGuard` das `UPDATE … suspended = 1` absetzt. Ein Prozessabsturz vor dem `COMMIT`
lässt SQLite die gesamte Klammer beim nächsten Öffnen zurückrollen — einschließlich der Aussetzung.
Wird die Bedingung dagegen verletzt, ist das `UPDATE` ein Autocommit, und der Riegel bleibt für
diese Datenbankdatei **dauerhaft und unbemerkt aus**. Es gibt keine Rücksetzung beim Serverstart:
`grep -rn "work_period_chain_guard"` findet außerhalb von Migration, Schema und der einen Funktion
keinen einzigen Schreibzugriff. Das ist der zweite Teil von B-2.

**Ist der ausgesetzte Zustand für nebenläufige Verbindungen sichtbar?** Nein, und das ist hier die
gute Antwort. Der Wert ist global (`id = 1`), nicht sitzungs- oder nutzerbezogen — aber das
`UPDATE … suspended = 1` nimmt die Schreibsperre der Datenbank, sofern sie die Klammer nicht ohnehin
schon hält. Eine zweite Verbindung kann während des Fensters weder schreiben (SQLITE_BUSY) noch den
nicht festgeschriebenen Wert lesen. Innerhalb derselben Verbindung ist better-sqlite3 synchron und
Node einthreadig, es kann sich also nichts dazwischenschieben. Das Fenster umfasst genau drei
Anweisungen (`workPeriodCorrectionService.ts:380-384`).

**Und die Kompensation?** Sie ist da, wo sie hingehört: `checkPeriodChain()` läuft im
Korrekturdienst **unbedingt** nach dem Schreiben, auch im Zweig ohne Aussetzung
(`workPeriodCorrectionService.ts:389-395`), und ein Befund wirft, womit die ganze Klammer
zurückrollt. Der Löschdienst setzt den Riegel gar nicht erst aus und prüft die Kette trotzdem
(`workPeriodDeletionService.ts:299-305`).

**Bewertung:** T-13-07 und T-13-14 geschlossen (die dort zugesagten Bausteine sind vorhanden und
getestet). T-13-02 bleibt teilweise offen, siehe B-2.

---

## Schwerpunkt 4 — Pflichtbegründung (REQ-30): Service oder Formular?

Im Service, in allen drei Schreibwegen, und in keinem davon nur in der Route. Die Prüfung greift
ausschließlich im Speicherpfad (`dryRun === false`), damit die Vorschau vor dem Eintippen berechnet
werden kann — das ist der einzige Sonderfall, und er kann nichts schreiben.

| Dienst | Fundstelle | Umfang |
|--------|-----------|--------|
| `workPeriodChangeService.ts` (Phase 12) | `:302-308` | leer / < 10 Zeichen |
| `workPeriodCorrectionService.ts` | `:226-242` | leer / < 10 / > 500 Zeichen / Steuerzeichen |
| `workPeriodDeletionService.ts` | `:146-162` | leer / < 10 / > 500 Zeichen / Steuerzeichen |

Die Route liest `reason` bewusst permissiv (`routes/workPeriods.ts:190-196`, `:216-225`) und lässt
die Entscheidung dem Dienst — genau die Aufteilung, die `12-CONTEXT.md` verlangt, weil sich mehrere
Schreibpfade dieselbe Prüfung teilen. Ab der Prüfung wird ausschließlich die getrimmte Fassung
weitergereicht (`workPeriodCorrectionService.ts:284`, `workPeriodDeletionService.ts:213`).

Das Formular verdoppelt die Regel, ersetzt sie aber nicht:
`desktop/src/components/worktime/workTimePeriodEditRules.ts:70-76` sperrt den Primärknopf bei
`trimmedReasonLength < 10`. Das erfüllt die Projektregel „Eingabevalidierung auf Server UND
Client".

Und die Begründung überlebt: seit CR-01 schreibt der Korrekturdienst die Journalzeile
**unbedingt**, auch bei `balanceDelta === 0` (`workPeriodCorrectionService.ts:464-491`) — sonst
läge die Pflichtbegründung nur in `audit_log.changes`, das keine Oberfläche darstellt. Der
`audit_log`-Eintrag steht zusätzlich in derselben Transaktionsklammer
(`workPeriodCorrectionService.ts:507-540`, `workPeriodDeletionService.ts:387-410`), also
hinterlässt ein zurückgerollter Vorgang keinen Eintrag.

**Wo REQ-30 nicht greift:** über `PUT /api/users/:id`. Siehe Befund B-1.

**Bewertung:** T-13-10, T-13-11 geschlossen.

---

## Schwerpunkt 5 — Storno statt Löschung: lässt sich die Geschichte doch entfernen?

Der Löschweg selbst hält Wort. `softDeleteWorkPeriod()`
(`server/src/services/workPeriodService.ts:703-724`) setzt `deletedAt`/`deletedBy` per `UPDATE`;
`deletedBy` steht in der Signatur und ist damit nicht auslassbar (T-13-08). Es existiert kein
`DELETE FROM user_work_periods` im gesamten Serverquellcode. Die Gegenbuchungen tragen
`hours = -original.hours` bei journal-neutralem `balanceBefore`/`balanceAfter`
(`workPeriodDeletionService.ts:349-372`) — die tatsächliche Rückabwicklung kommt allein aus dem
Rebuild bei `:307-310`, es gibt also keine Doppelzählung. Liefert `createTransaction()` `null`,
rollt die gesamte Klammer zurück (`:374-385`); eine stillschweigend ausgelassene Gegenbuchung wäre
die von REQ-31 verbotene bereinigte Lücke.

Die eigentliche Frage ist der Umweg. Ich habe alle Schreibzugriffe auf `overtime_transactions`
durchgesehen:

- **Rebuild:** `overtimeTransactionRebuildService.ts:168-174` löscht ausschließlich die elf
  Typen aus `REBUILDABLE_TYPES` (`:155-166`). `model_change` steht **nicht** darin. Original und
  Storno überleben jeden Rebuild — und Rebuilds laufen in dieser Phase reichlich.
- **`deleteEarnedTransactionsForDate()`** (`overtimeTransactionService.ts:573-583`): fest auf
  `type = 'time_entry'` verdrahtet.
- **`deleteTransactionsInRange()`** (`overtimeTransactionManager.ts:193-213`): der Typfilter ist
  **optional**; ohne ihn löscht die Funktion alles im Zeitraum, `model_change` und Gegenbuchungen
  eingeschlossen. Sie hat heute keinen einzigen Aufrufer außerhalb ihrer eigenen Datei. Latente
  Fußangel, siehe Befund I-1.
- **`UPDATE overtime_transactions`:** nur in den Migrationen 005 und 012 sowie in zwei
  Wartungsskripten. Kein Laufzeitpfad verändert eine bestehende Buchungszeile.
- **Skripte:** `cleanTestUsers.ts:56` und `seedTestUsers.ts:160` löschen hart, sind aber
  CLI-Werkzeuge mit Dateisystemzugang und auf `username LIKE 'test.%'` beschränkt
  (`cleanTestUsers.ts:19-23`). Nicht über die API erreichbar.

Die Paarbindung selbst ist von der Datenbank getragen, nicht von der Aufrufreihenfolge: Migration
014 legt einen **UNIQUE**-Teilindex auf `reversalOf` an
(`014_add_reversal_of_to_overtime_transactions.ts:69-72`), Migration 015 holt das auf Datenbanken
nach, auf denen 014 bereits mit dem nicht eindeutigen Index gelaufen ist. Höchstens eine
Gegenbuchung je Original — sonst verdoppelte der Selbst-Join im Lesepfad die Originalzeile.

Der Lesepfad zeigt beide Zeilen und rechnet keine davon doppelt:
`overtimeLiveCalculationService.ts:541-556` ist ein Prepared Statement mit gebundenen Parametern,
ohne jede Zeichenkettenverkettung von Werten (T-13-29), und `:586-589` setzt für **beide**
Paarhälften `hours: 0` mit einem nicht summierten `documentedDelta` (T-13-27).

**Ein Randfall, der auffällt, aber nicht trägt:** Der BEFORE-DELETE-Trigger
(`013_…ts:218-236`) würde ein echtes `DELETE` auf eine bereits weggenommene Zeile nicht abwehren,
denn seine beiden Bedingungen zählen nur Zeilen mit `deletedAt IS NULL`, und die Vorperiode hat die
Lücke inzwischen geschlossen. Praktisch folgenlos, weil kein Codepfad ein solches `DELETE` absetzt
und der Fremdschlüssel `ON DELETE CASCADE` nur beim harten Löschen eines Nutzers zieht — was
außerhalb von `cleanTestUsers.ts` nirgends geschieht. Als Beobachtung notiert (I-3).

**Bewertung:** T-13-15 bis T-13-19, T-13-26, T-13-27, T-13-29 geschlossen.

---

## Bedrohungsregister — Verifikation im Einzelnen

### Plan 13-01 — Migration 013/014

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-01 | Tampering | mitigate | GESCHLOSSEN | Zeilenzahlvergleich `013_….ts:84-86` / `:123-132`, wirft **vor** `DROP TABLE` bei `:134` |
| T-13-02 | Elevation of Privilege | mitigate | **TEILWEISE** | `finally` vorhanden (`workPeriodService.ts:746-748`), Rollback trägt, Test `013_….test.ts:121`. Aber „ausschließlich in einer Transaktion" ist unerzwungen — Befund B-2 |
| T-13-03 | Repudiation | mitigate | GESCHLOSSEN | `deletedBy INTEGER` mit `REFERENCES users(id)`: `013_….ts:103`, `:111`; gefüllt in `workPeriodService.ts:705-710` |
| T-13-04 | Denial of Service | mitigate | GESCHLOSSEN | Selbstverifikation Spalten/Indizes/Trigger `013_….ts:240-272`, jede Prüfung wirft mit „wird NICHT als angewendet markiert" |
| T-13-05 | Information Disclosure | accept | ANGENOMMEN | `013_….ts:278-281` protokolliert `rowsBefore`, `rowsAfter`, Spalten-, Index- und Triggerzahl — keine Nutzdaten. Siehe Register angenommener Risiken |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | `git diff` über die 40 Commits der Phase: nur zwei npm-**Skripte** in `desktop/package.json`, kein `dependencies`-Eintrag |

### Plan 13-02 — Verträge und Soft-Delete-Bausteine

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-06 | Tampering | mitigate | GESCHLOSSEN | Alle `FROM user_work_periods`-Lesepfade mit `WHERE userId = ?` tragen `deletedAt IS NULL`: `workPeriodService.ts:218`, `:235`, `:631`; Skripte `:174`/`:225`/`:133`/`:176`/`:188`. Die `WHERE id = ?`-Rücklesungen nach Schreibvorgängen sind im Code als bewusst filterfrei begründet |
| T-13-07 | Elevation of Privilege | mitigate | GESCHLOSSEN | `finally` `workPeriodService.ts:746-748`, Nutzungsbedingung im Kopf `:732-741`, Ausnahmefall getestet `workPeriodService.test.ts:653-662`, `checkPeriodChain()` in derselben Klammer `workPeriodCorrectionService.ts:389` |
| T-13-08 | Repudiation | mitigate | GESCHLOSSEN | `softDeleteWorkPeriod(periodId, deletedBy)` `workPeriodService.ts:703-710`; Admin-Id aus der Sitzung durchgereicht `routes/workPeriods.ts:701` → `workPeriodDeletionService.ts:290` |
| T-13-09 | Information Disclosure | **transfer** | GESCHLOSSEN | Übernahme belegt: `requireAdmin` an allen vier Schreib-/Vorschaupfaden (`routes/workPeriods.ts:461`, `:524`, `:616`, `:664`) und als Test formuliert (`workPeriods.authorization.test.ts:170-198`) |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-03 — Korrekturdienst

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-10 | Tampering | mitigate | GESCHLOSSEN | `validateCorrectionInput()` `workPeriodCorrectionService.ts:145-243`: Kalenderdatum `:152`, 0–60 h `:158-160`, Tagesplan-Wertebereich `:166-171` und Wochensumme `:172-181` (CR-04-Muster), Eintrittsdatum `:183`, Nachbarschaftsgrenzen `:189`/`:200`, Austrittsdatum `:206` |
| T-13-11 | Repudiation | mitigate | GESCHLOSSEN | `audit_log`-`INSERT` in derselben Klammer `:507-540`, Journalzeile mit Begründung im Klartext `:466-491` |
| T-13-12 | Tampering | mitigate | GESCHLOSSEN | `WorkPeriodCorrectionRequestBody` ohne `userId` `routes/workPeriods.ts:161-166`; `periodId` aus `:id` `:229-236`; Nutzer aus der Periode `workPeriodCorrectionService.ts:259` |
| T-13-13 | Denial of Service | mitigate | GESCHLOSSEN | `rangeStart..heute` `:291-294`; Ratenbegrenzer auf beiden Vorschauen `routes/workPeriods.ts:460`, `:615` |
| T-13-14 | Elevation of Privilege | mitigate | GESCHLOSSEN | `finally` `workPeriodService.ts:746`; `checkPeriodChain()` unbedingt, auch ohne Aussetzung `workPeriodCorrectionService.ts:389-395`; Zustandsprüfung nach Ausnahme `workPeriodCorrectionService.test.ts:495` |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-04 — Löschdienst

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-15 | Repudiation | mitigate | GESCHLOSSEN | Soft-Delete `workPeriodDeletionService.ts:290`, Gegenbuchung `:349-372`, `audit_log` `:387-410`; Zusicherung D in `workPeriodDeletionService.test.ts:180-186` |
| T-13-16 | Tampering | mitigate | GESCHLOSSEN | `hours: -original.hours` `:356`, `balanceBefore === balanceAfter === journalBalance` `:360-362`; Saldotest „auf die Minute genau" `…test.ts:180` |
| T-13-17 | Denial of Service | mitigate | GESCHLOSSEN | `isFirst` wird **unbedingt** abgewiesen, auch im Trockenlauf `:138-143`; Test `…test.ts:328` |
| T-13-18 | Tampering | mitigate | GESCHLOSSEN | Eine `db.transaction()`-Klammer `:174`, `checkPeriodChain()` darin `:299-305`; Trockenlauftest `…test.ts:375` |
| T-13-19 | Information Disclosure | mitigate | GESCHLOSSEN | `logger.info` `:412-422` trägt `periodId`, `userId`, `rebuildFrom`, `balanceDelta`, `reversedCount`, `dryRun` — keine Begründung, keine Namen |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-05 — Endpunkte, Rollenprüfung, Token

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-20 | Elevation of Privilege (BOLA/IDOR) | mitigate | GESCHLOSSEN | siehe Schwerpunkt 1; Wirkungstests `workPeriods.authorization.test.ts:240`, `:252` |
| T-13-21 | Tampering | mitigate | GESCHLOSSEN | siehe Schwerpunkt 2 |
| T-13-22 | Information Disclosure | mitigate | GESCHLOSSEN | einheitliche 409 `routes/workPeriods.ts:558-562` und `:695-699`; Grund nur im `logger.warn` `:540-551`, `:679-687` |
| T-13-23 | Information Disclosure | mitigate | GESCHLOSSEN | `requireAdmin` auf beiden Vorschauen `:461`, `:616` |
| T-13-24 | Denial of Service | mitigate | GESCHLOSSEN (mit Abweichung) | Eigene Limiter-Instanz je Route `:87-92`, eingehängt **vor** `requireAdmin` `:460-461`, `:615-616`. Abweichung durch WR-06: 120/min nutzerbezogen statt 30/min IP-bezogen (`middleware/rateLimits.ts:118-124`), zusätzlich ein 20/min-Gastlimiter mit `skip` für angemeldete Sitzungen (`:97-102`) und erstmals Limiter auf den drei Schreibpfaden (`:142-148`, 30/min) |
| T-13-25 | Repudiation | mitigate | GESCHLOSSEN | `logger.warn` mit `reason`/`periodId`/`adminId` `:540-551`, `:679-687`; `audit_log` in den Diensten |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-06 — Kontoauszug-Lesepfad

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-26 | Repudiation | mitigate | GESCHLOSSEN | `reversalOf` + Selbst-Join `overtimeLiveCalculationService.ts:541-556`; gemeinsame Belegnummer `:594` (`row.reversalOf ?? row.id`) |
| T-13-27 | Tampering | mitigate | GESCHLOSSEN | `hours: 0` für beide Paarhälften `:586`, `documentedDelta` nicht summiert `:589` |
| T-13-28 | Information Disclosure | **transfer** | GESCHLOSSEN | Übernehmende Stelle geprüft: `routes/overtime.ts:475-477` `requireAuth`, Eigentümerprüfung `:499-506` mit 403, Rückfall auf die eigene Id für Nicht-Admins `:483-488` |
| T-13-29 | Injection | mitigate | GESCHLOSSEN | Prepared Statement mit drei gebundenen Parametern `:541-556`, `:562`; keine Verkettung von Werten |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-07 — Desktop-Grundlage

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-30 | Spoofing | **accept** | ANGENOMMEN | Kommentar am Kopf vorhanden: `WorkTimePeriodList.tsx:9-15`, `workTimePeriodActions.tsx:7-18`, `EditUserModal.tsx:113-117`. Siehe Register angenommener Risiken |
| T-13-31 | Information Disclosure | mitigate | GESCHLOSSEN | `useWorkPeriods` wirft `Error('FORBIDDEN')` bei 403 `useWorkTimeChange.ts:40-42`; ausgewertet in `WorkTimePeriodList.tsx:95`, Zustand 3 bei `:111` |
| T-13-32 | Tampering | mitigate | GESCHLOSSEN | Die beiden Vorschau-Hooks haben kein `onSuccess` (`useWorkTimeChange.ts:56-72`, `:110-124`); die Speicher-Hooks invalidieren nur (`:98-101`, `:148-151`) |
| T-13-33 | Denial of Service | mitigate | GESCHLOSSEN | `retry: false` `useWorkTimeChange.ts:48`; Mutationen wiederholen in TanStack Query nicht |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-08 — Korrektur-Dialog

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-34 | Tampering | mitigate | GESCHLOSSEN | `isPrimaryDisabled({hasPreviewToken, …})` `workTimePeriodEditRules.ts:70-76`, verdrahtet `WorkTimePeriodEditModal.tsx:519`, `:788`; jede Feldänderung verwirft Vorschau und Token im selben State-Update `:263-297`; serverseitige 409 `routes/workPeriods.ts:558` |
| T-13-35 | Spoofing | mitigate | GESCHLOSSEN | Pflichtbegründung ab zehn Zeichen `workTimePeriodEditRules.ts:75`; Warnbanner mit konkretem Zeitraum `WorkTimePeriodEditModal.tsx:507`; Bestätigungssatz mit Saldoänderung `:463-466` |
| T-13-36 | Information Disclosure | mitigate | GESCHLOSSEN | 403-Zweig ins Formularbanner `WorkTimePeriodEditModal.tsx:432-433`; Toast-Unterdrückung für `/work-periods*` `api/client.ts:150` |
| T-13-37 | Tampering | mitigate | GESCHLOSSEN | Alle angezeigten Werte kommen aus `preview.*`: `WorkTimePeriodEditModal.tsx:718`, `:737`, `:743`, `:749`, `:770`. Keine clientseitige Berechnung |
| T-13-38 | Elevation of Privilege | mitigate | GESCHLOSSEN | `e.stopPropagation()` `WorkTimePeriodEditModal.tsx:442`; `type="button"` `:703`, `:785`; Rendern außerhalb des äußeren `<form>` (`EditUserModal.tsx:990` schließt, die Dialoge folgen ab `:993`) |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-09 — Liste, Aktionen, Löschbestätigung

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-39 | Spoofing | mitigate | GESCHLOSSEN | Eigener, optisch leiserer Korrekturblock `EditUserModal.tsx:891-900`; Zeilenaktion „Korrigieren" `workTimePeriodActions.tsx` |
| T-13-40 | Tampering | mitigate | GESCHLOSSEN | `isDeleteConfirmDisabled({previewReady, previewFailed, isDeleting})` `workTimePeriodDeleteRules.ts:147-153`, verdrahtet `EditUserModal.tsx:1075-1079`; Zustandsmaschine `:271-273` |
| T-13-41 | Elevation of Privilege | mitigate | GESCHLOSSEN | `renderActions={isAdmin ? … : undefined}` `EditUserModal.tsx:868-883`; Spalte samt `<th>` entfällt `WorkTimePeriodList.tsx:170`, `:231`; Kommentar `EditUserModal.tsx:113-117` |
| T-13-42 | Elevation of Privilege | mitigate | GESCHLOSSEN | Alle drei Dialoge als Geschwister nach `</form>` (`EditUserModal.tsx:990`, Dialoge `:993`, `:1028` ff.) |
| T-13-43 | Information Disclosure | mitigate | GESCHLOSSEN | 403-Zweig ins eigene Fehlerbanner `EditUserModal.tsx:425-426` |
| T-13-44 | Repudiation | mitigate | GESCHLOSSEN | `toast.success('Periode gelöscht — Storno steht im Kontoauszug')` `EditUserModal.tsx:417`, ohne `action:`-Eigenschaft |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-10 — Storno-Anzeige und HTTP-Client

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-45 | Information Disclosure | mitigate | GESCHLOSSEN | `grep -c "console.log" desktop/src/api/client.ts` = **0**. Zwei `console.error` verbleiben (`:108`, `:167`); `debugLog` schreibt nicht in die Konsole, sondern verteilt ein `CustomEvent` an das In-App-Panel (`DebugPanel.tsx:200-208`). Restpunkt I-4 |
| T-13-46 | Information Disclosure | mitigate | GESCHLOSSEN | Keine Erreichbarkeitsprobe mehr in `client.ts` — `grep -i "green\|3001\|reachab"` liefert null Treffer |
| T-13-47 | Repudiation | mitigate | GESCHLOSSEN | Klartextzeile `overtimeTransactionFormat.ts:104-120`, Belegnummer `:123-125`, Sprungmarke `:80-83` |
| T-13-48 | Tampering | mitigate | GESCHLOSSEN | `grep -c "line-through"` über `components/worktime` und `components/users` = **0** |
| T-13-49 | Denial of Service | mitigate | GESCHLOSSEN | `resolveReceiptJumpOutcome()` `overtimeTransactionFormat.ts:139` als geprüfte reine Funktion |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

### Plan 13-11 — Phasenabschluss

| ID | Kategorie | Disposition | Status | Beleg |
|----|-----------|-------------|--------|-------|
| T-13-50 | Tampering | mitigate | GESCHLOSSEN | `14-UAT-SAMMLUNG.md`: 3 Phase-11-Marken, 8 Phase-12-Marken erhalten, 8 Phase-13-Marken ergänzt |
| T-13-51 | Repudiation | mitigate | GESCHLOSSEN | Wörtliche Zusammenfassungszeile `13-11-SUMMARY.md:60-61` („Tests 3 failed \| 478 passed (481)"), namentlicher Abgleich der drei roten Tests gegen `11-AUSGANGSZUSTAND.md` in der Tabelle `:65-71` |
| T-13-52 | Information Disclosure | mitigate | GESCHLOSSEN | `grep -i "klarname\|kontostand"` über `14-UAT-SAMMLUNG.md` = 0 |
| T-13-53 | Denial of Service | **accept** | ANGENOMMEN | Kein Produktionslauf und kein Release in dieser Phase. Siehe Register angenommener Risiken |
| T-13-SC | Tampering | mitigate | GESCHLOSSEN | wie oben |

---

## Register angenommener Risiken

| ID | Risiko | Begründung der Annahme | Verifikation |
|----|--------|------------------------|--------------|
| T-13-05 | Protokollausgaben der Migration könnten Nutzdaten enthalten | Es werden ausschließlich Zeilenzahlen und Strukturangaben protokolliert | `013_….ts:278-281` — geprüft: `rowsBefore`, `rowsAfter`, Spalten-, Index-, Triggerzahl. Keine Feldwerte |
| T-13-30 | Ausgeblendete Bedienelemente als vermeintlicher Schutz | Ausdrücklich deklariert: Durchsetzung serverseitig, Ausblenden ist Bequemlichkeit | Kommentar am Kopf aller drei betroffenen Komponenten vorhanden (`WorkTimePeriodList.tsx:9-15`, `workTimePeriodActions.tsx:14-18`, `EditUserModal.tsx:113-117`); die serverseitige Durchsetzung ist unter T-13-20 belegt |
| T-13-53 | Produktionslauf ohne Freigabe | Phase 13 führt weder Release noch Produktionslauf durch | Kein Deployment-Schritt in den elf Plänen; `13-CONTEXT.md` stellt Release und UAT ausdrücklich in Phase 14 |

---

## Befunde

### B-1 — HOCH — `PUT /api/users/:id` umgeht den Perioden-Schreibweg vollständig

**Art:** nicht registrierte Angriffsfläche (`unregistered_flag`) mit hoher Auswirkung
**Datei:** `server/src/services/userService.ts:588-662`, Route `server/src/routes/users.ts:357-361`

`updateUser()` spiegelt eine geänderte `weeklyHours` oder `workSchedule` weiterhin per
`updateWorkPeriodValues(currentPeriod.id, …)` (`:662`) in die offene Periode. Damit erreicht ein
Aufruf über `PUT /api/users/:id` genau das, was `PUT /api/work-periods/:id` seit dieser Phase unter
Vorschau-Token, Pflichtbegründung, Kettenprüfung, Rebuild, Journalzeile und `audit_log`-Eintrag
stellt — nur ohne jedes dieser sechs Elemente. `grep -n "audit_log" server/src/services/userService.ts`
liefert genau einen Treffer, und der steht in einem Kommentar (`:574`).

Das ist kein neuer Fund: WR-07 des Code-Reviews hat ihn benannt. Der Review-Kopf führt ihn unter
`fixed: warning: 13`, tatsächlich behoben wurde aber nur die Folgewirkung (die veralteten
`overtime_balance`-Zeilen werden jetzt in derselben Transaktion verworfen). Die Ursache steht
weiter, und der Code sagt es selbst bei `:564-583`: „Der Übergangsweg wurde aber NICHT entfernt.
Der Kommentar las sich, als wäre er erledigt; er war es nicht." `PROJECT_STATUS.md:245-274` führt
den Punkt als „🔓 OFFEN".

**Was den Befund begrenzt:** Die Route trägt `requireAuth` + `requireAdmin`
(`routes/users.ts:359-360`). Es ist also keine Rechteausweitung für Mitarbeiter, sondern eine
Nachweislücke gegenüber REQ-30: ein Admin kann Periodenwerte rückwirkend ändern, ohne dass
Begründung, Journalzeile oder Prüfpfad entstehen. Die eigene Oberfläche nutzt den Weg nicht mehr;
über die API ist er erreichbar. Die Spiegelung greift zudem nur bei tatsächlich geänderten Werten
(`:589-594`).

**Warum es hier steht, obwohl es „behoben" gemeldet war:** Der Auftrag verlangt die Prüfung von
REQ-30 („Wird sie serverseitig erzwungen … weil sich mehrere Schreibpfade dieselbe Prüfung
teilen?"). Dies ist der Schreibpfad, der sie nicht teilt. Kein Threat-Register der Phase deckt ihn
ab.

**Empfehlung:** Den Spiegelungszweig entfernen und `weeklyHours`/`workSchedule` in
`UpdateUserInput` mit 400 und Verweis auf `POST /api/work-periods/change` bzw.
`PUT /api/work-periods/:id` verwerfen. Vertragsänderung an `updateUser()`, berührt
`userWorkPeriodProvisioning.test.ts` — gehört als benannter Prüfpunkt nach Phase 14, vor jeden
Produktionslauf.

---

### B-2 — MITTEL — T-13-02 nur teilweise: die Nutzungsbedingung des Kettenriegels ist unerzwungen

**Art:** zugesagte Gegenmaßnahme unvollständig
**Datei:** `server/src/services/workPeriodService.ts:728-749`

T-13-02 sagt zu: „Die Aussetzung ist **ausschließlich** innerhalb einer `db.transaction()`-Klammer
erlaubt." Drei der vier Bausteine sind da — `finally`-Rücksetzung (`:746-748`), Rollback-Wirkung,
Nachweis über Tests. Das „ausschließlich" ist es nicht:

- Keine Laufzeitprüfung. `grep -rn "inTransaction" server/src` liefert **null** Treffer.
- `workPeriodService.test.ts:637-663` ruft `withSuspendedChainGuard()` außerhalb jeder Transaktion
  auf, und die Funktion arbeitet klaglos. Der Test belegt die Rücksetzung — und nebenbei, dass die
  Bedingung nicht durchgesetzt wird.
- Keine defensive Rücksetzung beim Serverstart. Es gibt im gesamten Serverquellcode nur zwei
  schreibende Zugriffe auf `work_period_chain_guard`, beide in dieser einen Funktion.

Heute hält die Bedingung: der einzige Produktivaufrufer
(`workPeriodCorrectionService.ts:380`) liegt in der Klammer ab `:253`. Die Folge einer künftigen
Verletzung wäre allerdings unangenehm still — der Riegel bliebe für diese Datenbankdatei dauerhaft
aus, ohne Fehlermeldung und ohne dass ein Test es bemerkte, weil die Trigger dann einfach nichts
mehr prüfen.

**Empfehlung:** Zwei Zeilen genügen. (1) `if (!db.inTransaction) throw new Error(…)` als erste
Anweisung in `withSuspendedChainGuard()`. (2) Ein `UPDATE work_period_chain_guard SET suspended = 0
WHERE id = 1` beim Initialisieren der Verbindung, mit `logger.warn`, falls dabei tatsächlich eine
Zeile geändert wird — das macht den Ausnahmezustand sichtbar, statt ihn zu verschlucken.

---

### B-3 — NIEDRIG — Zehn von elf SUMMARY-Dateien tragen keinen Abschnitt `## Threat Flags`

**Art:** Prozesslücke

`grep -c "Threat Flags" 13-*-SUMMARY.md` liefert nur für `13-09-SUMMARY.md` eine 1; die übrigen
zehn haben den Abschnitt nicht. Neue Angriffsfläche, die während der Umsetzung entsteht, hätte über
diesen Weg nicht gemeldet werden können. B-1 ist genau so an den `<threat_model>`-Blöcken
vorbeigelaufen — der Befund kam aus dem Code-Review, nicht aus der Phasendokumentation. Für diese
Prüfung wurden die Bedrohungen deshalb direkt am Code verifiziert und nicht gegen die SUMMARYs
abgeglichen.

---

### Beobachtungen ohne Handlungsdruck

**I-1 — `deleteTransactionsInRange()` löscht ohne Typfilter alles.**
`server/src/services/overtimeTransactionManager.ts:193-213`: Der Parameter `types` ist optional;
ohne ihn entfernt die Funktion jede Buchung im Zeitraum, `model_change` und Gegenbuchungen
eingeschlossen — genau die von REQ-31 geschützten Zeilen. Sie hat heute keinen einzigen Aufrufer
außerhalb ihrer eigenen Datei. Entweder entfernen oder `types` verpflichtend machen.

**I-2 — Kanonische Token-Zeichenkette ohne Trennzeichen-Maskierung.**
`workTimeChangeToken.ts:108-118`, `:246-260`, `:290-301` fügen die Felder mit `|` zusammen, ohne
Maskierung oder Längenpräfix. Heute nicht ausnutzbar: `adminId`/`periodId` sind Zahlen, die
Wochenstunden laufen durch `toFixed(2)`, der Tagesplan durch `canonicalizeWorkSchedule()`, und ein
Token wird erst ausgestellt, nachdem `isRealCalendarDate(input.validFrom)`
(`workPeriodCorrectionService.ts:152`) das Datumsformat durchgesetzt hat. Sollte je ein Feld freien
Text aufnehmen, wird die Zeichenkette mehrdeutig. Ein Längenpräfix je Feld wäre die dauerhafte
Antwort.

**I-3 — Der DELETE-Riegel schützt weggenommene Zeilen nicht.**
`013_….ts:218-236`: Beide `RAISE(ABORT)`-Klauseln zählen ausschließlich Zeilen mit
`deletedAt IS NULL`. Für eine bereits soft-gelöschte Periode — deren Lücke die Vorperiode inzwischen
geschlossen hat — greift keine der beiden. Ein echtes `DELETE` auf diese Zeile käme durch. Folgenlos,
weil `grep -rn "DELETE FROM user_work_periods"` null Treffer liefert und ein Nutzer außerhalb von
`cleanTestUsers.ts` nirgends hart gelöscht wird. Als bekannte Grenze notiert, nicht als Auftrag.

**I-4 — 200 Zeichen Antwortkörper im `console.error` bei JSON-Parse-Fehlern.**
`desktop/src/api/client.ts:108-111`: `rawTextPreview: rawText.substring(0, 200)`. Bewusst so
gebaut (DD-44 steht im Kommentar), und der Fall tritt nur ein, wenn die Antwort gar kein JSON war —
also typischerweise eine Proxy-Fehlerseite. Die zugesagte Messgröße von T-13-45
(`grep -c "console.log"` = 0) ist erfüllt.

---

## Projektregeln — Abgleich

| Regel aus `.claude/CLAUDE.md` | Befund |
|-------------------------------|--------|
| Prepared Statements (Pflicht) | Eingehalten. Alle Abfragen der Phase nutzen `db.prepare(...).run/get/all(...)` mit gebundenen Parametern. Die einzige Zeichenkettenverkettung im Serverquellcode steht in `cleanTestUsers.ts:45` und `fixOvertimeTransactionsDuplicates.ts:130`, beide mit intern erzeugten Zahlen-Ids aus einer vorangegangenen Abfrage, beide außerhalb des Phasenumfangs |
| Soft Delete statt Hard Delete | Eingehalten. `softDeleteWorkPeriod()` `workPeriodService.ts:703`; kein `DELETE FROM user_work_periods` im Serverquellcode |
| Keine Klartext-Geheimnisse | Eingehalten. Der einzige eingebettete Zeichenkettenwert ist `'dev-secret-only-for-development'` (`workTimeChangeToken.ts:105`), erreichbar ausschließlich bei `NODE_ENV !== 'production'` — in Produktion wirft `resolveSecret()` bei `:99-104` |
| Eingabevalidierung Server UND Client | Eingehalten. Server: `workPeriodCorrectionService.ts:145-243`, `workPeriodDeletionService.ts:134-162`. Client: `workTimePeriodEditRules.ts:70-76` und die Feldhandler `WorkTimePeriodEditModal.tsx:275-289` |
| `SESSION_SECRET` aus `.env` | Eingehalten. `process.env.SESSION_SECRET` `workTimeChangeToken.ts:95`, gleiches Muster wie der Sitzungscookie in `server.ts` |
| Keine neuen Abhängigkeiten | Eingehalten. `git diff` über die 40 Commits der Phase berührt an `package.json` ausschließlich den `scripts`-Block (`check:rules`, `check:rules:types`) |

---

## Ergebnis

**53 von 54 Bedrohungen geschlossen.** Offen: **T-13-02** (teilweise, Befund B-2).
Angenommene Risiken: T-13-05, T-13-30, T-13-53 — alle drei mit Verifikation im Register oben.
Übertragene Risiken: T-13-09, T-13-28 — bei beiden ist die übernehmende Stelle geprüft und
nicht nur behauptet.

Keine Blocker für die Auslieferung von Phase 13. **B-1 gehört als benannter Prüfpunkt in Phase 14,
vor jeden Produktionslauf** — es ist der einzige Schreibweg auf Arbeitszeitperioden, der die
Pflichtbegründung aus REQ-30 nicht kennt.
