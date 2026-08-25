# Zurückgestellte Befunde aus Phase 14

Befunde, die während der Ausführung aufgefallen sind, aber außerhalb des Auftrags des
jeweiligen Plans liegen. Nicht repariert, nur festgehalten.

---

## Aus Plan 14-08 (23.08.2026)

### 1. `scripts/validateSchema.ts` erwartet ein Schema, das es nicht mehr gibt

**Gefunden:** Im Deployment-Log des Laufs 32632007657, Schritt „Validating database schema".

**Befund:** `npm run validate:schema` endet mit Exitcode 1 und meldet
`❌ VALIDATION FAILED: Database schema has missing required columns!`. Die vermissten Spalten
sind Namen, die dieses Projekt seit Langem nicht mehr verwendet — etwa `totalDays`,
`usedDays`, `pendingDays`, `remainingDays` in `vacation_balance` (dort heißen sie
`entitlement`, `carryover`, `taken`), `approverId` in `absence_requests` (dort `approvedBy`)
oder `isHomeOffice` in `time_entries` (dort `location`). Umgekehrt meldet das Skript für acht
tatsächlich vorhandene Tabellen `⚠️ No schema definition`.

**Einordnung:** Der Fehler liegt in der Schema-Erwartung des Prüfskripts, nicht in der
Produktionsdatenbank. Der Workflow fängt ihn mit `|| true` ab, das Deployment läuft weiter.

**Vorbestehend:** ja. Der Zustand ist nicht durch Plan 14-08 entstanden.

**Wirkung:** Das Prüfskript ist wirkungslos — es meldet bei jedem Deployment einen Fehlschlag
und wird deshalb ignoriert. Ein echter Schemadefekt fiele darin nicht auf.

**Vorschlag:** Schema-Erwartung an das tatsächliche Schema angleichen oder das Skript
entfernen. Ein Prüfschritt, dessen Fehlschlag als normal gilt, ist schlechter als keiner.

---

### 2. `.claude/CLAUDE.md` erwartet ein `database`-Feld im Health-Check, das es nicht gibt

**Gefunden:** Bei der Deployment-Verifikation nach Plan 14-08.

**Befund:** `.claude/CLAUDE.md`, Abschnitt „Deployment Verification Rules", nennt als
Erwartung `{"status":"ok","database":"connected","timestamp":"..."}`. Der Endpunkt
`server/src/server.ts:159` liefert dieses Feld nicht — weder im Stand `41c9c09` noch im Stand
`0f2a03e` davor (beide Fassungen byteidentisch geprüft).

**Vorbestehend:** ja.

**Wirkung:** Ein grüner Health-Check belegt keine Datenbankverbindung. Wer sich auf die
Erwartung aus `.claude/CLAUDE.md` verlässt, hält ein Deployment für verifiziert, bei dem der
Server ohne Datenbank läuft.

**Vorschlag:** Entweder die Erwartung in `.claude/CLAUDE.md` korrigieren oder — besser — den
Endpunkt um eine echte Leseprobe gegen die Datenbank erweitern, damit die Aussage stimmt.

---

### 3. `fix-overtime.ts` schreibt bei jedem Deployment und täglich um 3 Uhr ungeprüft in `overtime_balance`

**Gefunden:** Bei der Nullwirkungsmessung nach Plan 14-08 (siehe `14-PRODUKTIONSLAUF.md`,
Task 3 Schritt D).

**Befund:** Der Schritt „Fix overtime calculations" im Deploy-Workflow und der Cron-Eintrag
`0 3 * * *` fahren `scripts/fix-overtime.ts`, das `overtime_balance` per UPSERT neu schreibt.
Es gibt keinen Trockenlauf, keine Erwartungsprüfung und keine Protokollierung dessen, was sich
dabei ändert. Beim Lauf am 23.08.2026 bewegte der Schritt 99 Werte bei 8 Nutzern.

**Vorbestehend:** ja, dem Grunde nach — die konkrete Wirkung entstand erst durch den Wechsel
des Rechenwerks in Phase 11.

**Wirkung:** Ein Schritt, der Mitarbeiterstundenkonten überschreibt, läuft unbeaufsichtigt und
ohne Nachweis. Der Befund WR-05 der Phase 9 (keine Fehlerisolierung je Nutzer) kommt hinzu.

**Vorschlag:** `fix-overtime.ts` dieselbe Trockenlauf- und Erwartungsprüfungslogik geben, die
die Werkzeuge der Phase 14 haben (`--apply`, `--expectUser`, Vorher/Nachher-Protokoll), und
den Cron-Lauf erst danach wieder scharf schalten. Gehört nach Phase 9.1.

---

## Aus Plan 14.1-01 (25.08.2026)

### 1. Abwesenheits-Gutschriften im Kontoauszug haben keine Gegenbuchung — die Journalsumme ist um sie zu hoch

**Gefunden:** Beim Vorher/Nachher-Nachweis zu BL-01
(`.planning/phases/14.1-rechenwerk-blocker-aus-dem-produktionslauf-schliessen/14.1-NACHWEIS-BL01.md`,
Abschnitt 5). Nach dem BL-01-Fix blieb für drei von fünfzehn aktiven Nutzern eine Differenz
zwischen dem Saldo über dem Kontoauszug und der Summe der Buchungen darunter stehen.

**Befund:** `server/src/services/overtimeLiveCalculationService.ts`, Schritt 4 („Calculate
'earned' transactions for ALL working days") überspringt jeden Tag mit genehmigter
Abwesenheit (`if (absenceDates.has(date) && !overtimeCompDates.has(date)) continue;`).
Schritt 5 hängt danach die Gutschriftszeile an (`vacation_credit`/`sick_credit`, Betrag
**+ Tagessoll**). Die zugehörige negative Tageszeile entsteht damit nie. Der Saldo
(`calculateCurrentOvertimeBalance` → `calculatePeriodOvertime` → `calculateDailyOvertime`)
rechnet denselben Tag korrekt auf 0 (Soll = Ist = Gutschrift). Die Liste weist ihn als vollen
Gewinn aus.

Die Restdifferenz ist **restlos** die Summe der Gutschriften im Zeitraum, gemessen am
2026-08-25 gegen eine Arbeitskopie von `14-prod-nach-migration.db` für August 2026:

| userId | Gutschriften | Rechnung | Restdifferenz |
|---:|---|---|---:|
| 3 | 1 × `sick_credit` à 4 h (Antrag #68) | 1 × 4,00 | 4,00 h |
| 16 | 5 × `sick_credit` à 6 h (Antrag #70) | 5 × 6,00 | 30,00 h |
| 17 | 2 × `vacation_credit` à 4 h (#69, #71) | 2 × 4,00 | 8,00 h |

Die übrigen zwölf Nutzer haben im gemessenen Fenster keine genehmigte Abwesenheit und stehen
nach dem BL-01-Fix ausnahmslos bei 0,00 h.

**Vorbestehend:** ja. Der Zustand ist nicht durch Plan 14.1-01 entstanden — der Vorher-Lauf
weist dieselben drei Nutzer mit denselben Beträgen aus (nur überlagert von der zusätzlichen
BL-01-Wirkung).

**Wirkung:** Das **erste Erfolgskriterium der Phase 14.1** („Der Saldo über dem Kontoauszug
stimmt mit der Summe der darunter gezeigten Buchungen überein, für jeden Nutzer") ist mit dem
BL-01-Fix allein **nicht erreicht**. Ein Mitarbeiter mit Urlaub oder Krankheit im gewählten
Monat sieht weiterhin zwei Zahlen nebeneinander, die nicht zusammenpassen — im Fall von
Nutzer 16 um 30,00 Stunden. Anders als bei BL-01 ist dabei der **Saldo** richtig und die
**Liste** falsch.

**Warum nicht in Plan 14.1-01 mitrepariert:** Eigener Befund mit eigener Ursache. D-07 (ein
unvermischter Commit-Satz je Befund) und D-09 (neue Funde werden vermerkt, nicht nebenbei
repariert) verbieten die Mitnahme. Zudem ist die Reparatur keine Einzeilenkorrektur, sondern
eine Entscheidung über die sichtbare Darstellung.

**Vorschlag (zwei Wege, Entscheidung des Anwenders):**
1. **Gegenbuchung sichtbar machen:** Der Abwesenheitstag bekommt zusätzlich seine negative
   Tageszeile („Keine Zeiterfassung (Soll: 4h)", −4,00 h) neben der Gutschrift (+4,00 h). Der
   Auszug zeigt dann beide Seiten und summiert sich auf den Saldo. Verständlicher, aber die
   Liste wird länger und die `limit`-Kürzung in `routes/overtime.ts:521-523` greift früher.
2. **Gutschriftszeilen auf `hours: 0` setzen**, wie es die `model_change`-Zeilen bereits tun
   (siehe die ausführliche Begründung an `LiveOvertimeTransaction.documentedDelta`,
   `overtimeLiveCalculationService.ts:123-137` — dort steht die Regel wörtlich: eine Zeile,
   deren Wirkung schon in den Tageszeilen steckt, darf ihren Betrag nicht ein zweites Mal in
   `hours` tragen). Der Betrag würde wie dort in ein eigenes Feld wandern. Kürzerer Eingriff,
   bereits erprobtes Hausmuster.

Weg 2 folgt dem Muster, das dieselbe Datei für denselben Fehlertyp bereits enthält. Ein
Regressionstest gehört in beiden Fällen dazu; das Nachweiswerkzeug
`server/src/scripts/verifyBalanceVsJournal.ts` misst die Kennzahl bereits (`JournalDiff`) und
sollte danach so verschärft werden, dass sie den Exitcode mitbestimmt.

---

### 2. WR-01 berührt und liegen gelassen (D-09-Vermerk)

**Gefunden:** Beim Lesen für Task 1 des Plans 14.1-01.

**Befund:** WR-01 aus `14-WEITERE-BEFUNDE.md` („Der Zeitkonto-Saldo im `/live`-Endpunkt kennt
den Zukunftsfilter seines Zwillings nicht") betrifft `workTimeAccountService.ts:421-428` und
`overtimeTransactionRebuildService.ts:637-644` — beide summieren `overtime_balance` ohne
Monatsdeckel und ziehen damit Zukunftsmonate ein. Das ist dieselbe Fehlerfamilie wie BL-01.

**Vorbestehend:** ja.

**Wirkung:** unverändert die in WR-01 nachgemessene (Nutzer 3 / 2026-09 = −20 h, Nutzer 17 /
2026-09 = −44 h, Nutzer 30 / 2026-10 = −176 h über `GET /api/work-time-accounts/live`).

**Vorschlag:** Bleibt beim Milestone für WR-01 bis WR-10 nach der Auslieferung, wie in D-09
festgelegt. **Nicht** in Phase 14.1 mitnehmen. Beide Dateien stehen in keinem Commit dieses
Plans — nachprüfbar über `git log --name-only` der drei Commits von 14.1-01.

---

## Aus Plan 14.1-02 (25.08.2026)

### 1. Nach dem Löschen einer Krankmeldung bleibt `work_time_accounts` auf einem Zwischenstand stehen

**Gefunden:** Beim Führen des BL-02-Nachweises (Plan 14.1-02, Test 2 in
`server/src/services/absenceDeletionRecalc.test.ts`).

**Befund, in Zahlen gemessen:** Nach dem vollständigen Löschen einer genehmigten Krankmeldung
(ein Krankheitstag, Tagessoll 8 h) endet `work_time_accounts.currentBalance` bei **−176,00 h**,
während Journal und `overtime_balance` desselben Nutzers bei **−184,00 h** enden. Restdifferenz:
**8,00 h**, genau ein Tagessoll.

**Ursache, am Quelltext abgelesen:** `deleteAbsenceRequest()` ruft innerhalb der
Löschtransaktion `revertBalancesAfterDeletion()` → `deleteSickLeaveTimeEntries()` auf, und dort
`updateAllOvertimeLevels()` — das ist die einzige Funktion, die `work_time_accounts` schreibt
(`overtimeService.ts`, Aufruf von `updateWorkTimeAccountBalance`). Zu diesem Zeitpunkt sind die
Zeiteinträge zwar gelöscht, die Zeile in `absence_requests` steht aber noch (das
`DELETE FROM absence_requests` folgt erst danach in derselben Transaktion). Der anschließende
Aufruf von `updateMonthlyOvertime()` läuft nach dem `DELETE` und rechnet richtig, berührt
`work_time_accounts` aber nicht (Kommentar am Ende von `updateMonthlyOvertime`: „REMOVED: Old
Work Time Account sync").

**Vorbestehend:** ja — die Reihenfolge innerhalb der Transaktion ist unverändert. Vor dem
BL-02-Fix war der Befund unsichtbar, weil `work_time_accounts` sich nach einer Löschung
überhaupt nicht bewegte (der Aufruf warf und wurde weggeloggt). Der Fix macht ihn erst
messbar — er erzeugt ihn nicht.

**Wirkung:** Der im Zeitkonto angezeigte Kontostand kann nach dem Löschen einer Krankmeldung
um das Tagessoll der gelöschten Tage vom Journal abweichen, bis irgendetwas anderes
`updateAllOvertimeLevels()` für diesen Nutzer auslöst (z. B. eine Zeiterfassung oder — sobald
er wieder läuft — der Nachtlauf).

**Warum nicht in Plan 14.1-02 mitrepariert:** Eigener Befund mit eigener Ursache (Reihenfolge
innerhalb der Transaktion, nicht der Importstil). D-07 (ein unvermischter Commit-Satz je
Befund) und D-09 (neue Funde werden vermerkt, nicht nebenbei repariert) verbieten die Mitnahme.
Der Eingriff ist auch kein Einzeiler: Er berührt eine Klammer, die ausdrücklich als
Atomaritätsklammer angelegt ist („ATOMICITY: Gegenbuchung und Löschung des Antrags müssen
gemeinsam gelingen oder gemeinsam scheitern").

**Vorschlag (zwei Wege, Entscheidung des Anwenders):**
1. **Nachsynchronisieren:** In `deleteAbsenceRequest()` nach dem bereits vorhandenen
   `updateMonthlyOvertime`-Block einmal `updateWorkTimeAccountBalance(userId,
   getOvertimeBalance(userId))` aufrufen. Kleinster Eingriff, lässt die Transaktionsklammer
   unberührt, kostet eine zusätzliche Abfrage je Löschung.
2. **Neuberechnung aus der Transaktion herausziehen:** `deleteSickLeaveTimeEntries()` löscht
   innerhalb der Transaktion nur die Zeiteinträge; die Neuberechnung wandert hinter das
   `DELETE FROM absence_requests`, dorthin, wo der bestehende `updateMonthlyOvertime`-Block
   schon steht. Sauberer, aber ein Eingriff in die Reihenfolge, der einen eigenen
   Regressionstest verlangt.

Weg 1 ist der risikoärmere. In beiden Fällen gehört ein Regressionstest dazu;
`absenceDeletionRecalc.test.ts` misst den Kontostand bereits und lässt sich um die
Gleichheitsprüfung gegen `overtime_balance` erweitern, sobald der Befund geschlossen ist.

Als Entscheidungspunkt **14.1-U5** in `14-UAT-SAMMLUNG.md` eingetragen; vollständige Herleitung
in `14.1-NACHWEIS-BL02.md`, Abschnitt 7.

### 2. D-09: Keine WR-Warnung berührt

Plan 14.1-02 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehört. Der Fix beschränkt sich
auf `server/src/services/absenceService.ts`; keine der in den Warnungen genannten Dateien steht
in einem seiner beiden Commits. Der Eintrag oben ist eine **neue** Beobachtung, keine
WR-Warnung — er wird trotzdem nach demselben Verfahren hier abgelegt.
