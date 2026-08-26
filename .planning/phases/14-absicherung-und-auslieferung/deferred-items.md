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

---

## Aus Plan 14.1-03 (25.08.2026) — BL-05

### 1. `work_time_accounts` wird beim Anlegen einer Krankmeldung nicht fortgeschrieben

**Gefunden:** Plan 14.1-03, Task 2, bei der Messung zu Abschnitt 4 des Nachweisdokuments.
**Nicht repariert** (D-05, D-07, D-09) — bewusst außerhalb des Auftrags.

**Gemessen** (Testnutzer 43660, Krankmeldung 10055, ein Krankheitstag am 2026-07-01,
Kontozeile vorher über `updateAllOvertimeLevels()` hergestellt):

| Messgröße | vor dem Anlegen | nach dem Anlegen |
|---|---:|---:|
| `work_time_accounts.currentBalance` | −184,00 h | **−184,00 h** (unverändert) |
| `overtime_transactions`, `type = 'sick_credit'` | 0 Zeilen | **1 Zeile, +8,00 h** |
| `overtime_balance`: `targetHours` / `actualHours` | 184 / 0 | 184 / **8** |

Journal und `overtime_balance` ziehen unmittelbar nach — der Kontostand-Cache bleibt um genau
ein Tagessoll (8,00 h) zurück, bis ihn der nächste Anlass fortschreibt.

**Ursache, am Quelltext abgelesen:** D-05 benennt genau **einen** fehlenden Block — den
`CRITICAL`-Block, der `updateMonthlyOvertime` je betroffenem Monat ruft. Der
`work_time_accounts`-Block des regulären Genehmigungsweges (`updateWorkTimeAccountBalance`,
`absenceService.ts` im Anschluss an den `CRITICAL`-Block) wurde bewusst **nicht** mitkopiert;
alles darüber hinaus wäre Scope-Ausweitung gewesen. `updateMonthlyOvertime` selbst berührt
`work_time_accounts` nicht („REMOVED: Old Work Time Account sync").

**Vorbestehend:** ja. Vor dem BL-05-Fix bewegte sich weder das Journal noch der Cache. Der Fix
bringt das Journal auf Stand und macht den Rückstand des Caches damit erst sichtbar — er
erzeugt ihn nicht.

**Verwandt mit, aber nicht identisch zu 14.1-U5** (aus Plan 14.1-02): Dort bleibt derselbe
Cache nach dem **Löschen** einer Krankmeldung um 8,00 h zurück, dort ist die Ursache aber die
Reihenfolge innerhalb der Löschtransaktion. Beide gehören sinnvollerweise in **eine**
Entscheidung.

**Vorschlag (zwei Wege, Entscheidung des Anwenders):**
1. **Nachsynchronisieren:** Im Auto-Genehmigungszweig von `createAbsenceRequest` nach dem neuen
   `updateMonthlyOvertime`-Block einmal `updateWorkTimeAccountBalance(userId,
   getOvertimeBalance(userId))` aufrufen — dasselbe Muster wie Weg 1 unter 14.1-U5. Kleinster
   Eingriff, kostet eine zusätzliche Abfrage je angelegter Krankmeldung.
2. **Den Cache aus der Fortschreibung nehmen:** `work_time_accounts.currentBalance` bei jeder
   Abfrage aus dem Journal ableiten statt fortzuschreiben. Sauberer und beseitigt 14.1-U5 und
   diesen Punkt in einem Zug, aber ein Eingriff in eine Tabelle, die an mehreren Stellen
   gelesen wird — verlangt eigene Regressionstests.

Weg 1 ist der risikoärmere und passt zu der Entscheidung, die für 14.1-U5 ohnehin ansteht.
Als Entscheidungspunkt **14.1-U8** in `14-UAT-SAMMLUNG.md` eingetragen; vollständige Herleitung
in `14.1-NACHWEIS-BL05.md`, Abschnitt 4.

### 2. Aufräumreihenfolge bei Testnutzern — Trigger auf `user_work_periods`

**Gefunden:** Plan 14.1-03, Task 2, beim Abräumen der einmaligen Messsonde.
**Kein Produktivbefund**, nur eine Falle für künftige Testskripte — hier festgehalten, damit
sie nicht ein zweites Mal zuschnappt.

Auf `user_work_periods` liegt ein Trigger, der das Löschen der **letzten** Periode eines noch
bestehenden Nutzers verhindert: `SqliteError: user_work_periods: Löschen würde den Nutzer ohne
jede Periode zurücklassen` (`SQLITE_CONSTRAINT_TRIGGER`). Ein Aufräumpfad, der erst die
abhängigen Tabellen und danach `users` löscht, scheitert deshalb still an dieser Stelle und
lässt den Testnutzer stehen.

**Richtige Reihenfolge — erst `users`, dann die abhängigen Zeilen.** So macht es
`cleanupEmployee()` in `absenceDeletionRecalc.test.ts` und in `sickLeaveRecalc.test.ts`; beide
Testdateien sind davon nicht betroffen. Aufgefallen ist es nur, weil die D-08-Nachmessung die
Testnutzerreste mitzählt — genau dafür ist die Kennzahl da.

### 3. D-09: Keine WR-Warnung berührt

Plan 14.1-03 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehört. Der Fix beschränkt sich
auf `server/src/services/absenceService.ts`; keine der in den Warnungen genannten Dateien steht
in einem seiner beiden Commits. Eintrag 1 oben ist eine **neue** Beobachtung, keine WR-Warnung —
er wird trotzdem nach demselben Verfahren hier abgelegt.

---

## Aus Plan 14.1-04 (25.08.2026) — BL-03

### 1. Der Historien-Export trägt weiterhin Datenzeilen stillgelegter Konten

**Gefunden:** Plan 14.1-04, Task 2, bei der Bestandsmessung auf der Produktionsarbeitskopie.
**Nicht repariert** — bewusst, siehe Begründung unten. Als Entscheidungspunkt **14.1-U11** in
`14-UAT-SAMMLUNG.md` vorgelegt.

**Befund, gemessen** auf `server/database/14.1-bl03-arbeitskopie.db` (aus
`14-prod-nach-migration.db` per `VACUUM INTO`), Zeitraum 2025-01-01 bis 2026-12-31, mit dem
Fix aus Commit `ceb97d5`:

| Messgröße | Wert |
|---|---:|
| Zeiteinträge im Export gesamt | 712 |
| davon von stillgelegten Konten | **102** |
| genehmigte Anträge im Export gesamt | 28 |
| davon von stillgelegten Konten | **1** |
| stillgelegte Konten in der **Nutzerliste** des Exports | **0** (vorher 5) |

Der Fix nimmt die stillgelegten Konten aus der Nutzerliste und aus `overtime_balance` heraus.
Die Listen `timeEntries` und `absences` der Sammelvariante sind dagegen — wie vor dem Fix —
**nicht** nach Nutzern gefiltert; sie sind ausschließlich nach Zeitraum eingegrenzt
(`exportService.ts`, `timeEntriesQuery` und `absencesQuery` in der Variante ohne `userId`).
Die Ausgabedatei nennt die Konten also nicht mehr, trägt aber 103 Datenzeilen, die über die
Spalte `userId` auf sie verweisen.

**Warum nicht nebenbei repariert:**

1. D-03 benennt genau drei Fundstellen (`:353`, `:356`, `:370-371`) plus `totalOvertime`
   (`:425`). Die Zeiteintrags-Abfrage ist keine davon.
2. Das Bedrohungsregister des Plans (T-14.1-04-01) legt die Gegenmaßnahme ausdrücklich auf
   `deletedAt IS NULL` **in den beiden Nutzerabfragen** fest.
3. Der Export ist ein Aufbewahrungsdokument („According to ArbZG (2 years), Tax Law
   (6 years)"). 103 Datenzeilen daraus zu entfernen, ist keine Fehlerkorrektur, sondern eine
   fachliche Festlegung darüber, was ein Historien-Export nach dem Ausscheiden eines
   Mitarbeiters noch enthalten darf — mit derselben Zweckfrage, die den Unterschied zum
   DATEV-Export begründet. Die Abwägung gehört dem Anwender.

**Zwei Wege, falls entschieden wird zu filtern:**

- **Weg 1 — mitziehen:** `timeEntriesQuery` und `absencesQuery` der Sammelvariante bekommen
  denselben `userId IN (<Platzhalter>)`-Filter, der bereits über der `overtimeQuery` steht.
  Kleiner, sofort testbarer Eingriff; die Nutzerliste ist ohnehin schon berechnet. Wirkung:
  Der Export verliert 103 Zeilen und wird in sich schlüssig (jede Datenzeile verweist auf
  einen Nutzer, der in der Datei steht).
- **Weg 2 — bewusst behalten und begründen:** Die Zeilen bleiben, und über beide Abfragen
  kommt ein Kommentar nach dem Muster der DATEV-Stelle, der festhält, warum die Aufbewahrungs-
  pflicht schwerer wiegt als die Stilllegung. Dann sollte allerdings die Nutzerliste die
  betroffenen Konten wieder enthalten — sonst enthält die Datei Verweise ins Leere.

Weg 1 passt zum Wortlaut des Erfolgskriteriums der Phase; Weg 2 passt zum Aufbewahrungszweck.
Vollständige Herleitung in `14.1-NACHWEIS-BL03.md`, Abschnitt 7.

### 2. D-09: Keine WR-Warnung berührt

Plan 14.1-04 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehört. Der Fix beschränkt
sich auf `server/src/services/exportService.ts`; `workTimeAccountService.ts` und
`overtimeTransactionRebuildService.ts` (WR-01) stehen in keinem seiner Commits.

**Zur Abgrenzung ausdrücklich:** Der in diesem Plan eingeführte Monatsdeckel in
`exportService.ts` ist **nicht** WR-01. D-03 zählt die Kennzahl `totalOvertime`
(`exportService.ts:425`) ausdrücklich zu BL-03 („Zum selben Befund gehört die Kennzahl
`totalOvertime` in `exportService.ts:425`"). Die Abgrenzung steht auch als Kommentar im
Quelltext über dem Deckel, damit sie beim nächsten Lesen nicht neu erschlossen werden muss.

Zwei vorhandene WR-Vermerke derselben Funktion (WR-09 zum Ergebnistyp, WR-10 zu den
`yearPlaceholders`) wurden **gelesen und als Muster benutzt**, aber nicht verändert: Der neue
Nutzerfilter folgt dem `yearPlaceholders`-Muster, der WR-09-Kommentar steht unverändert über
derselben Zuweisung.

---

## Aus Plan 14.1-05 (25.08.2026) — BL-04

### 1. Alt-Abzüge in `overtime_balance` aus der Zeit vor dem Fix — nicht gesucht, nicht repariert

**Gefunden:** Plan 14.1-05, Task 1, beim Vermessen des entfernten FIFO-Abzugs.
**Nicht repariert** — bewusst, Begründung unten.

Der entfernte Weg A schrieb bei jeder Genehmigung eines Überstundenausgleichs 8,00 h (bzw. das
jeweilige Tagessoll) von Hand aus `overtime_balance` heraus — und zwar aus dem **ältesten**
Monat mit positivem Saldo, nicht aus dem Monat des Ausgleichstags. Sein Rückgabezweig war
wirkungslos (die Schleife brach bei negativem Argument sofort ab). Im Bestand gibt es drei
genehmigte Ausgleiche (Anträge 25, 56, 64, Nutzer 18, 17, 3). Ob deren Abzug heute noch in
einer Monatszeile steht, wurde in diesem Plan **nicht** gemessen.

**Warum das vertretbar ist:** `overtime_balance` ist eine abgeleitete Tabelle. Jede
Berichtsabfrage eines Monats ruft `updateMonthlyOvertime` und überschreibt die Zeile aus
Zeiterfassung, Abwesenheiten und Korrekturen — der Alt-Abzug löst sich dabei auf. Genau diese
Selbstheilung ist der Grund, warum der Befund überhaupt so lange unbemerkt blieb. Nach dem Fix
kommt kein neuer Abzug hinzu.

**Warum es trotzdem hier steht:** Der nächtliche Lauf ist seit dem 23.08.2026 angehalten
(D-11). Solange er steht und niemand den betroffenen Monat abruft, kann eine alte Zeile
stehenbleiben. Eine Nachmessung gehört sachlich zur Datenbereinigung (Plan 14.1-06, D-06) und
nicht in den Code-Fix von BL-04 — sie würde Daten anfassen, und D-06 verlangt dafür Sicherung
und Trockenlauf.

Als Punkt **14.1-U15** in `14-UAT-SAMMLUNG.md` eingetragen.

### 2. D-09: Keine WR-Warnung berührt

Plan 14.1-05 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehört. Der Fix beschränkt
sich auf `server/src/services/absenceService.ts`. `overtimeTransactionRebuildService.ts`
(WR-01) wurde **gelesen und zitiert** — `REBUILDABLE_TYPES` (`:153-166`) und `handleAbsenceDay`
(`:383-451`) tragen die Belege für die Entscheidung zu Weg B —, aber in keinem Commit
verändert.

---

## Aus Plan 14.1-06 (25.08.2026) — Datenbereinigung der Zukunftsmonate

### 1. Die Produktionsdatenbank ist weiterhin unbereinigt

**Gefunden:** Plan 14.1-06, Stufe 1, beim Probelauf auf der Produktionsarbeitskopie.
**Nicht repariert** — D-13 verbietet den Produktionszugriff in dieser Phase vollständig.

Die Produktionsarbeitskopie `14-prod-nach-migration.db` trägt exakt dieselben **100**
Journalzeilen mit Zukunftsdatum (Nutzer 3 und 17 für 2026-09, Nutzer 30 für 2026-10) und
dieselben **3** Monatszeilen in `overtime_balance` wie die Arbeitsdatenbank. Die echte
`production.db` trägt sie mit hoher Wahrscheinlichkeit ebenfalls — die Kopie stammt vom Stand
nach der Migration vom 23.08.2026.

**Was schon vorliegt:** Der vollständige Probelauf gegen die Produktionsarbeitskopie ist
gefahren und belegt: 100 + 3 Zeilen entfernt, danach 0 verblieben, `integrity_check` = ok,
`foreign_key_check` leer, und **0 von 20 Nutzern** mit einer Saldendifferenz ungleich 0,00 h —
weder im kanonischen Rechenweg noch im angezeigten Monatsaggregat. Das Werkzeug trägt für den
Produktionsfall bereits die vorgeschriebene Aufrufform im Kopfkommentar
(`--allow-production`, das ohne `--apply` weiterhin nur einen Trockenlauf fährt).

**Was fehlt:** Die Entscheidung des Anwenders, ob und wann gegen die Produktion gefahren wird,
und die dortige Sicherung nach dem Muster von `14-ROLLBACK-RUNBOOK.md` Abschnitt 1.

Als Punkt **14.1-U24** in `14-UAT-SAMMLUNG.md` eingetragen.

### 2. Der Testnutzer 15015 trägt weiterhin Zukunftszeilen

**Gefunden:** Plan 14.1-06, Stufe 3, in der Ausnahmeliste des Trockenlaufs.
**Nicht repariert** — bewusst: D-06 nimmt den Testnutzer ausdrücklich von der Bereinigung aus.

In `development.db` stehen weiterhin **30** Journalzeilen mit Zukunftsdatum
(userId 15015, 2026-09-01 bis 2026-09-30, Typ `time_entry`, `SUM(hours) = -88`) und **eine**
`overtime_balance`-Zeile (2026-09, targetHours 88, actualHours 0). Das Prädikat schließt sie
über `userId NOT IN (?)` aus, und der Trockenlauf weist sie als ausgenommen aus.

**Warum das vertretbar ist:** 15015 (`test.vollzeit`) ist ein reiner Testnutzer der
Entwicklungsdatenbank. Er existiert in der Produktionskopie nicht. Seine Zeilen verfälschen
keine Kundenzahl.

**Warum es trotzdem hier steht:** Wer künftig „kein Datum in der Zukunft" per Abfrage ohne
Nutzerfilter prüft, findet 30 Treffer und hält den Befund für offen. Die Einschränkung
„Testnutzer 15015 ausgenommen" gehört zu jeder Formulierung des Erfolgskriteriums dazu.

Als Punkt **14.1-U21** in `14-UAT-SAMMLUNG.md` eingetragen.

### 3. Die Roadmap-Zahl 59 ist nach wie vor unerklärt

**Gefunden:** Plan 14.1-06, Trockenlauf gegen beide Datenbanken.
**Nicht repariert** — eine Zahl in einem Befundtext ist kein Code.

Der Roadmap-Befund nennt **59** fiktive Journalbuchungen. Gemessen sind es unter dem
festgelegten Prädikat **100** Zeilen, davon **50** mit `hours != 0`; einschließlich des
ausgenommenen Testnutzers **130**. Die Zahl 59 ist mit keiner dieser Abgrenzungen
deckungsgleich und auch nicht als Summe oder Differenz darstellbar. Es wurde **nicht**
versucht, ein Prädikat zu konstruieren, das die Zahl 59 trifft.

Die Abweichung ist in `14.1-NACHWEIS-BEREINIGUNG.md`, Abschnitt „Abweichung zur Zahl 59",
benannt. Ob der Roadmap-Text korrigiert wird, entscheidet der Anwender —
Punkt **14.1-U20**.

### 4. 14.1-U15 (Alt-Abzüge in `overtime_balance`) wurde nicht mitbereinigt

**Gefunden:** übernommen aus Plan 14.1-05.
**Nicht repariert** — bewusst.

Plan 14.1-05 hatte die Frage offen gelassen, ob die drei genehmigten Ausgleiche (Anträge 25,
56, 64; Nutzer 18, 17, 3) heute noch einen Alt-Abzug aus dem entfernten FIFO-Weg in einer
Monatszeile von `overtime_balance` stehen haben, und sie in die Datenbereinigung verwiesen.

Plan 14.1-06 hat sie **nicht** aufgegriffen. Grund: Das wäre ein **zweiter Befund in demselben
Löschvorgang** gewesen und hätte D-07 verletzt („niemals zwei Befunde in einem Commit"). Die
Bereinigung der Zukunftszeilen ist ein Vorgang mit eigenem Prädikat, eigener Sicherung und
eigenem Wiederherstellungsnachweis; ein zweites, sachlich unabhängiges Prädikat im selben Lauf
hätte den Nachweis unlesbar gemacht und den Rückweg vermischt.

Der Punkt bleibt offen und wird als **14.1-U23** erneut vorgelegt.

### 5. D-09: Keine WR-Warnung behoben — und eine bewusst als Begründung benutzt

Plan 14.1-06 hat keine Stelle verändert, die zu WR-01 bis WR-10 gehört. Die einzige Berührung
ist **WR-10** (`model_change`-Zeilen dürfen ein Datum in der Zukunft tragen — die Korrektur
oder der Storno einer geplanten Arbeitszeitperiode, Phase 13). Diese Warnung wurde **nicht
behoben**, sondern als **Begründung für den Typfilter** des Löschprädikats verwendet: Der
Filter schließt `model_change` und die übrigen book-once-Typen aus, damit die Warnung nicht
durch eine Datenbereinigung „nebenbei" entschieden wird. Im heutigen Bestand gibt es keine
solche Zeile in der Zukunft — der Filter ist ein Sicherheitsnetz, kein Füllwerk.

Die phasenweite WR-Zusammenfassung (alle sechs Pläne) steht in
`14.1-NACHWEIS-BEREINIGUNG.md`, Abschnitt „D-09 — WR-Zusammenfassung über die gesamte
Phase 14.1".

### 6. Sicherungen und Probekopien liegen im Arbeitsverzeichnis

Nach diesem Plan liegen drei zusätzliche, **nicht eingecheckte** Datenbankdateien unter
`server/database/`:

| Datei | Zweck | Größe |
|---|---|---:|
| `backups/development.PRE-14.1-06_20260825_070544.db` | die Sicherung vor dem Löschlauf (D-07) | 1.355.776 B |
| `14.1-restore-probe.db` | die zurückgespielte Kopie aus dem Wiederherstellungsnachweis | 1.355.776 B |
| `14.1-bereinigung-probe.db` | die Produktionsarbeitskopie aus Stufe 1 | 1.323.008 B |

Sie bleiben liegen. Wann sie gelöscht werden dürfen, entscheidet der Anwender — die Sicherung
ist der einzige Rückweg für die Datenänderung dieses Plans. Punkt **14.1-U22**.

---

## Aus der Code-Review der Phase 14.1 (25.08.2026)

Vollständiger Bericht: `.planning/phases/14.1-rechenwerk-blocker-aus-dem-produktionslauf-schliessen/14.1-REVIEW.md`
— 32 Befunde (6 BLOCKER, 20 WARNING, 6 INFO). **Keiner davon wurde in Phase 14.1 repariert**:
Sie liegen sämtlich außerhalb des Scope Fence (nur BL-01 bis BL-05 plus Datenbereinigung), und
D-07 verbietet, einen zweiten Befund in denselben Commit-Satz zu nehmen. Sie werden hier
vermerkt und liegen gelassen — so, wie D-09 es für alles vorschreibt, was nebenbei auffällt.

Drei der sechs Blocker habe ich als Orchestrator am Quelltext nachgeprüft, statt sie zu
übernehmen:

### CR-01 — bestätigt, wiegt am schwersten

Ein genehmigter Überstundenausgleich mit **Zukunftsdatum** bewegt den Saldo nicht mehr, den
`hasSufficientOvertimeBalance()` liest. Nachgeprüft:

- Der entfernte Weg A (`deductOvertimeHours`, `absenceService.ts` vor `24bfb75`, Zeile 1694 ff.)
  zog FIFO aus **vergangenen** Monaten mit `overtime > 0` ab — die zählt
  `getOvertimeBalance()` mit (`overtimeTransactionService.ts:471-477`, `AND month <= ?`).
- Weg C bucht den Abzug in den Monat des Ausgleichstags. Bei einem künftigen Ausgleich ist
  das ein Zukunftsmonat, den `getOvertimeBalance()` **absichtlich** ausblendet — der
  Kommentar bei `:460-462` nennt den Grund („Future months may have negative balances …
  which must NOT count against current balance").
- Folge: Zwei künftige Ausgleiche können nacheinander gegen dasselbe Guthaben genehmigt werden.

**Einordnung, die der Bericht nicht macht:** Weg A war als Schutz ohnehin unzuverlässig. Er
schrieb in `overtime_balance` — eine abgeleitete Tabelle, die die nächste Neuberechnung
überschreibt (genau die Feststellung, auf der D-04 fußt). Der Schutz hielt also nur bis zum
nächsten Rebuild. Durch das Entfernen wird er für künftige Ausgleiche dauerhaft statt
zeitweise wirkungslos. Das ist eine echte Verschlechterung, aber kein Wegfall eines
verlässlichen Schutzes.

**Nicht in dieser Phase zu lösen:** Die Behebung berührt den Zukunftsmonatsfilter in
`getOvertimeBalance()` — dieselbe Fehlerfamilie wie WR-01, die nach D-09 in den eigenen
Milestone nach der Auslieferung gehört. Sie verlangt außerdem eine Festlegung: Soll ein
genehmigter künftiger Ausgleich das verfügbare Guthaben sofort binden?

### CR-02 — bestätigt

„Trockenlauf — es wird nichts geschrieben" trifft nicht zu. `purgeFutureOvertimeRows.ts:299`
holt `../database/connection.js`, und dessen Modulebene führt bei `connection.ts:50`
(`dbWrapper.instance = initializeConnection()`) sofort `initializeDatabase()` und
`createIndexes()` auf der **Zieldatenbank** aus. Das ist Schema-DDL, keine Datenänderung —
die D-08-Prüfsummen über die fünf geschützten Tabellen blieben nachweislich gleich, und die
Zeilenzahlen ebenso. Für ein Werkzeug, das mit `--allow-production` auf die Produktion gerichtet
werden kann, ist die Zusage trotzdem zu korrigieren, bevor es dort läuft.

### CR-03 — bestätigt als Risiko, **kein tatsächlicher Verlust**

`purge --apply` löscht die Monatszeile samt `carryoverFromPreviousYear`, und der Trockenlauf
zeigt die Spalte nicht an. In diesem Lauf ist nichts verloren gegangen: Alle drei gelöschten
Zeilen trugen `carryoverFromPreviousYear = 0` (aus der Sicherung nachgemessen, ids 61245,
31769, 34406) — und sie sind aus der Sicherung ohnehin vollständig wiederherstellbar, was
Stufe 6 Zeile für Zeile vorgeführt hat. Vor einem Lauf gegen die Produktion gehört die Spalte
in die Trockenlauf-Ausgabe.

### CR-04, CR-05, CR-06 — übernommen, nicht einzeln nachgeprüft

CR-04 (Historien-Export filtert `absence_requests` und `vacation_balance` in der
Sammelvariante nicht nach Nutzer), CR-05 (das Löschwerkzeug druckt die D-08-Prüfsummen, ohne
sie zu vergleichen, und erst nach dem Commit), CR-06 (die neue Deckelung vergleicht
UTC-Mitternacht mit Berliner Wanduhrzeit — Zeitzonenfamilie, also WR-Gebiet nach D-09).

### Die 20 Warnungen und 6 Hinweise

Stehen im Bericht. Querschnittsbefund des Prüfers: Alle fünf neuen Testdateien schließen
Zukunftsdaten mit gleichlautender Begründung aus; CR-01 und CR-06 sind Folgen dieser Lücke.

---

## Aus Plan 14.2-02 (25.08.2026) — F-1

### 1. Fehlende Trennung zwischen Servermeldung und generischem Zusatztext im Toast

**Gefunden:** Plan 14.2-02, Task 1, beim Lesen von `14.2-PLAN.md` (Scope Fence zu F-1) und
`14.2-CONTEXT.md` D-08.

**Befund:** `desktop/src/api/client.ts:152-155` zeigt bei jedem serverseitigen Fehler, der
keinen eigenen Darstellungsweg hat, einen Toast mit zwei Teilen — Titel `data.error` (der
deutsche Servertext) und `description: 'Die Anfrage konnte nicht verarbeitet werden.'`. Beide
Teile werden vom Toast-System **ohne Trennzeichen aneinandergereiht** dargestellt, laut NB-5
(`14-ABNAHME-SICHT.md` § 7, Fall 2 und Fall 3): z. B.
`User not found or not deletedDie Anfrage konnte nicht verarbeitet werden.` (F-1, jetzt durch
den deutschen Servertext ersetzt — die Zusammenklebung selbst bleibt) oder eine Krankmeldung
auf einen Tag mit Zeiterfassung. NB-5 nennt **drei** betroffene Stellen; F-1 ist nur eine davon,
die beiden anderen liegen außerhalb dieser Phase.

**Vorbestehend:** ja. Der Fix aus Task 1 (deutscher Servertext statt englischem Rohtext)
beseitigt den F-1-eigenen Teil des Symptoms — die Wörter, die zusammenkleben, sind jetzt beide
deutsch statt einer davon englisch — aber **nicht** die fehlende Trennung selbst.

**Wirkung:** Ein Bediener liest zwei zusammengeklebte Sätze als einen, ohne erkennbaren
Anfang des zweiten. Kein Datenverlust, keine Sicherheitswirkung — reine Lesbarkeit.

**Vorschlag:** `client.ts:152-155` auf ein zweizeiliges Toast-Layout ziehen (z. B. Titel/
Description mit Zeilenumbruch statt Aneinanderreihung) oder den generischen Zusatztext bei
vorhandenem `data.error` ganz weglassen. Betrifft alle Aufrufer von `apiClient`, nicht nur
F-1 — Wirksamkeitsprüfung sollte gegen alle drei in NB-5 genannten Fälle laufen. Als UAT-Punkt
in `14-UAT-SAMMLUNG.md`, Abschnitt „Phase 14.2" vorgemerkt (siehe SUMMARY dieses Plans).

### 2. D-09: Keine WR-Warnung berührt

Plan 14.2-02 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehört. Der Fix beschränkt
sich auf `server/src/services/userService.ts` und `server/src/routes/users.ts`; keine der in
den Warnungen genannten Dateien steht in einem seiner Commits.
Zukunftsdaten mit gleichlautender Begründung aus; CR-01 und CR-06 sind Folgen dieser Lücke.

---

## Aus Plan 14.2-03 (26.08.2026) — F-4

### 1. Zwei zusaetzliche rote Server-Tests, datumsabhaengig, ohne Codebezug zu F-4

**Gefunden:** Plan 14.2-03, Task 3, beim Abschlussgate (`cd server && npx vitest run`).

**Befund:** Gegenueber dem in `14.2-CONTEXT.md`/`14.2-NACHWEIS-D01.md` festgehaltenen
Ausgangsstand (562 gruen / 3 rot vor Plan 14.2-02, 567 gruen / 3 rot nach Plan 14.2-02) zeigt
der Testlauf am Ende von Plan 14.2-03 **565 gruen / 5 rot** (570 Faelle insgesamt, Zahl
unveraendert). Die drei vorbestehenden roten Faelle (`unifiedOvertimeService.test.ts:285`,
`:340`, `vacationBackfillService.test.ts:138`) sind weiterhin rot. **Zwei zusaetzliche** sind
neu rot:

- `overtimeFutureCapping.test.ts` — „Test 2: Der Saldo stimmt mit der Summe der darunter
  gezeigten Buchungen ueberein" — `expected 1 to be +0`
- `workPeriodChangeService.test.ts` — „CR-01: Die model_change-Zeile wird in KEINEM
  transaktionssummierenden Lesepfad mitgezaehlt" — `expected 4 to be less than 0.011`

**Ursache (belegt, nicht vermutet):** Beide Testdateien legen „heute" bei Modul-Ladezeit in
einer Konstante fest (`const TODAY = getTodayString();` bzw. `const today = ...`) und
vergleichen damit spaeter zwei Aufrufe derselben Berechnungskette
(`calculateLiveOvertimeTransactions` vs. `calculateCurrentOvertimeBalance`), die intern
selbst je einmal frisch „heute" ermitteln (`unifiedOvertimeService.ts:183-186`,
`overtimeLiveCalculationService.ts:210-227`, beides 14.1-BL-01-Deckelungscode). Die
Abweichungsgroesse (1 h bzw. 4 h) entspricht in beiden Faellen genau dem Tagessoll eines
einzelnen Werktags — dem Muster eines Datumsgrenzfalls zwischen dem eingefrorenen
Modul-Zeitpunkt und der intern neu ermittelten Zeit, nicht einem Rechenfehler in der Logik
selbst.

**Kein Codebezug zu diesem Plan:** `git diff <Plan-02-Endcommit>..HEAD --stat` zeigt fuer die
Commits dieses Plans ausschliesslich `desktop/src/pages/UserManagementPage.tsx` und
`desktop/tests/messungen/f4-aktionsspalte.mjs` — keine Datei aus `server/src/services/`.
`overtimeFutureCapping.test.ts` und `workPeriodChangeService.test.ts` gehoeren zu Phase 14.1
(BL-01/CR-01) und liegen ausserhalb des Aenderungsumfangs jedes Commits dieses Plans. Ein
Domain-Bezug (Desktop-UI-Seite der Nutzerverwaltung vs. serverseitiges Ueberstunden-Rechenwerk)
besteht nicht — kein Importpfad verbindet beide Seiten.

**Nicht behoben (Scope Fence, D-02):** Diese zwei Dateien liegen ausserhalb von F-4 und wurden
bewusst **nicht** angefasst — ein Fix haette einen zweiten Befund in denselben Commit-Satz
gemischt. Kein erneuter Testlauf zur Bestaetigung „hoffentlich verschwindet es wieder"
(Scope-Boundary-Regel); die Reproduktion war bei zwei unabhaengigen frischen
`npx vitest run`-Prozessen identisch.

**Wirkung:** Kein Datenverlust, keine Sicherheitswirkung. Reine Testinfrastruktur-Fragilitaet
bei Tests, die „heute" einmalig einfrieren, statt durchgehend eine einzige Quelle zu nutzen.

**Vorschlag:** Beide Tests auf eine einzige, injizierbare Zeitquelle umstellen (z. B. ueber
denselben Mechanismus, den `getCurrentDate()`/`getTodayString()` projektweit kapseln), statt
„heute" bei Modul-Ladezeit einzufrieren und an anderer Stelle erneut live zu ermitteln. Als
UAT-Punkt in `14-UAT-SAMMLUNG.md`, Abschnitt „Phase 14.2" vorgemerkt (siehe SUMMARY dieses
Plans).

### 2. Passwort-Zuruecksetzen und Loeschen fuer deaktivierte (nicht archivierte) Konten

**Gefunden:** Plan 14.2-03, Task 2, beim Bau der drei Aktionsspalten-Zweige.

**Befund:** Der mittlere Zweig (bloss deaktiviert, `deletedAt IS NULL`) traegt bewusst nur
„Bearbeiten" und „Reaktivieren" — kein Passwort-Zuruecksetzen, kein Loeschen. F-4 verlangt
„auffindbar und bearbeitbar", nicht vollen Funktionsumfang. Ob ein deaktiviertes Konto auch
direkt (ohne Reaktivierung) sein Passwort zuruecksetzen oder geloescht werden koennen soll,
ist eine fachliche Entscheidung, keine dieser Phase zugeordnete Korrektur.

**Vorschlag:** Als UAT-Punkt in `14-UAT-SAMMLUNG.md`, Abschnitt „Phase 14.2" vorgemerkt (siehe
SUMMARY dieses Plans).

## Aus Plan 14.2-04 (26.08.2026) — F-3

### 1. Weitere `<Select>`-Aufrufstellen ohne `name`

**Gefunden:** Plan 14.2-04, Task 2, projektweite Suche (`grep -rn "<Select" desktop/src`).
**Nicht repariert** — bewusst. F-3 verlangt nur das Rollenfeld in `EditUserModal.tsx`; jede
weitere Stelle waere ein zweiter Befund (D-02).

Seit Task 1 erzeugt `Select.tsx` fuer **jeden** Aufrufer selbststaendig ein `htmlFor`/`id`-Paar
(`useId()`-Fallback) — das Barrierefreiheits-Symptom von F-3 (Label ohne `htmlFor`) ist damit an
allen Stellen unten bereits behoben. Was fehlt, ist ausschliesslich ein **stabiler,
selbstgewaehlter** `name` (statt der generierten React-`id`) — relevant nur, falls ein
E2E-Selektor oder ein natives `<form>`-Submit ihn braucht.

Vollstaendige Liste (18 Fundstellen, `grep -rn "<Select" desktop/src` abzueglich des jetzt
gefixten Rollenfelds), mit Label-Text soweit vorhanden:

| Datei:Zeile | `label`-Prop |
|---|---|
| `desktop/src/components/absences/AbsenceRequestForm.tsx:267` | „Mitarbeiter" |
| `desktop/src/components/absences/AbsenceRequestForm.tsx:284` | „Art der Abwesenheit" |
| `desktop/src/components/corrections/OvertimeCorrectionModal.tsx:189` | „Korrekturtyp" |
| `desktop/src/components/timeEntries/EditTimeEntryModal.tsx:204` | „Arbeitsort" |
| `desktop/src/components/timeEntries/TimeEntryForm.tsx:144` | „Mitarbeiter" |
| `desktop/src/components/timeEntries/TimeEntryForm.tsx:204` | „Arbeitsort" |
| `desktop/src/components/users/CreateUserModal.tsx:272` | „Rolle" (Anlage-Dialog, nicht F-3 — F-3 ist ausdrücklich nur `EditUserModal.tsx:862`) |
| `desktop/src/pages/AbsencesPage.tsx:392` | (kein `label`, Filterzeile) |
| `desktop/src/pages/AbsencesPage.tsx:404` | (kein `label`, Filterzeile) |
| `desktop/src/pages/AbsencesPage.tsx:418` | (kein `label`, Filterzeile) |
| `desktop/src/pages/ReportsPage.tsx:249` | (kein `label`, Filterzeile) |
| `desktop/src/pages/ReportsPage.tsx:270` | (kein `label`, Filterzeile) |
| `desktop/src/pages/TimeEntriesPage.tsx:440` | „Zeitraum" |
| `desktop/src/pages/TimeEntriesPage.tsx:476` | „Mitarbeiter" |
| `desktop/src/pages/TimeEntriesPage.tsx:491` | „Arbeitsort" |
| `desktop/src/pages/UserManagementPage.tsx:341` | (kein `label`, Filterzeile) |
| `desktop/src/pages/UserManagementPage.tsx:356` | (kein `label`, Filterzeile) |
| `desktop/src/pages/UserManagementPage.tsx:367` | (kein `label`, Filterzeile) |

**Wirkung:** Kein Datenverlust, keine Sicherheitswirkung. Ein automatisierter Test, der eines
dieser Felder ueber `select[name="…"]` ansprechen wollte, faende derzeit keinen Treffer — er
muesste ueber den Labeltext oder eine Position gehen.

**Vorschlag:** Falls ein kuenftiger E2E-Test eines dieser Felder braucht, `name` an der
jeweiligen Aufrufstelle ergaenzen, analog zu `EditUserModal.tsx:862` (dieser Plan). Kein
Sammel-Commit noetig — jede Stelle einzeln, wenn der Bedarf entsteht.

### 2. D-09: Keine WR-Warnung berührt

Plan 14.2-04 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehoert. Die Fixes beschraenken
sich auf `desktop/src/components/ui/Select.tsx` und
`desktop/src/components/users/EditUserModal.tsx`; keine der in den Warnungen genannten Dateien
steht in einem seiner Commits.

---

## Aus Phase 14.2, Orchestrator-Nachmessung (26.08.2026)

### Zwei Server-Tests sind datumsabhängig und wurden allein durch den Kalendertagwechsel rot

Beim Übergang vom 25.08. auf den 26.08.2026 — mitten im Lauf der Phase, zwischen Plan 02 und
Plan 03 — ist die rote Testmenge des Servers **von 3 auf 5** gewachsen, ohne dass eine
Serverdatei geändert wurde. Neu rot:

- `src/services/workPeriodChangeService.test.ts` — „CR-01: Die model_change-Zeile wird in
  KEINEM transaktionssummierenden Lesepfad mitgezählt" (`expected 4 to be less than 0.011`)
- `src/services/overtimeFutureCapping.test.ts` — „Test 2: Der Saldo stimmt mit der Summe der
  darunter gezeigten Buchungen überein"

**Der Nachweis ist geführt, nicht behauptet.** Der Orchestrator hat `server/src/routes/users.ts`
und `server/src/services/userService.ts` — die einzigen beiden Serverquellen, die diese Phase
bis dahin geändert hatte — per `git checkout c396aaa --` auf den Stand **vor** der Phase
zurückgesetzt und beide Testdateien erneut laufen lassen: **dieselben zwei Fehlschläge**
(2 failed / 27 passed). Danach wurden die Dateien wiederhergestellt; `git diff HEAD` ist leer.
Plan 14.2-03 hat ausserdem nachweislich **keine** Serverdatei angefasst
(`git diff --stat` über seine Commits: nur `desktop/src/pages/UserManagementPage.tsx`).

**Folge für das Gate dieser Phase:** Die vorbestehende rote Menge ist ab dem 26.08.2026
**fünf**, nicht drei. Die Auflage „die rote Menge darf nicht wachsen" gilt gegen diese fünf.

**Warum das ein eigener Befund ist:** Beide Tests prüfen dieselbe Zusicherung — der angezeigte
Saldo stimmt mit der Summe der darunter gezeigten Buchungen überein. Dass sie an einem
beliebigen Kalendertag umkippen, heisst: die Zusicherung ist nur an bestimmten Tagen belegt.
Die Differenz von 4,00 h entspricht genau einem Tagessoll bei 20 h/Woche. Das gehört nicht in
diese Phase (Scope Fence — keiner der elf Befunde), aber es gehört gesehen: es ist dieselbe
Familie wie die Zukunftsdeckelung aus Plan 14.1-01 und Befund F-5.

---

## Aus Plan 14.2-05 (26.08.2026) — F-5

### 1. WR-01/CR-01-Familie: `getOvertimeBalance()` blendet Zukunftsmonate aus, statt sie zu verhindern

**Gefunden:** Plan 14.2-05, beim Lesen des Rechenwerks für F-5.
**Nicht repariert** (Scope Fence — WR-01/CR-01-Gebiet, ausdrücklich außerhalb dieser Phase).

`server/src/services/overtimeTransactionService.ts:478-484`:

```typescript
const currentMonth = formatDate(getCurrentDate(), 'yyyy-MM');
const result = db.prepare(`
  SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
  FROM overtime_balance
  WHERE userId = ?
    AND month <= ?
`).get(userId, currentMonth);
```

Der Filter `month <= currentMonth` ist der Grund, warum B-4 im Abnahmelauf als **Nebenbefund
ohne Anzeigewirkung** eingestuft wurde: Die falschen Zukunftszeilen erreichten den Saldo nicht.
Er ist damit eine **kompensierende Maßnahme, die den Fehler verdeckt hat**, statt ihn zu
verhindern — vier Monate lang stand in der abgeleiteten Tabelle ein falscher Wert, ohne dass
irgendetwas Alarm schlug.

Nach dem F-5-Fix sind die Zukunftszeilen 0/0; der Filter ist für diesen Zweck nicht mehr nötig,
aber er bleibt eine stille Fehlerabsorption für jeden künftigen Schreibweg, der erneut eine
Zukunftszeile anlegt.

**Vorschlag (nicht entschieden):** Statt zu filtern, in `updateMonthlyOvertime()` eine
Zusicherung ziehen — eine `overtime_balance`-Zeile für einen Monat nach dem laufenden darf nur
mit `targetHours = 0` und `actualHours = 0` geschrieben werden; jeder andere Wert wird
protokolliert. Dann fällt derselbe Fehler beim nächsten Mal sofort auf, statt vier Monate zu
überdauern. Berührt WR-01-Gebiet und braucht eigene Regressionstests.

### 2. Ein Nutzer mit künftigem Einstellungsdatum behält seine alten Journalzeilen mit Zukunftsdatum

**Gefunden:** Plan 14.2-05, Task 2, bei der Nachher-Messung (`14.2-NACHWEIS-F5.md`,
Abschnitt 4).
**Nicht repariert** — die betroffene Wache lässt der Plan ausdrücklich unverändert.

Nach dem F-5-Fix stehen in `development.db` noch **6** wiederaufbaubare Journalzeilen mit
Zukunftsdatum; alle gehören Nutzer **48719 (`future-hire`, `hireDate = 2026-09-25`)**.

**Ursache, am Quelltext abgelesen:** In `overtimeTransactionRebuildService.ts` steht die Wache
`if (hireDate > endDate) return;` (`:144`) **vor** dem `DELETE` in STEP 3. Für einen Nutzer,
dessen Einstellungsdatum in der Zukunft liegt, gilt nach dem Fix `endDate = heute < hireDate` —
der Rebuild kehrt zurück, bevor er aufräumen kann. Die Zeilen stammen aus einem Lauf mit dem
alten, ungedeckelten Stand.

**Wirkung auf die Anzeige: keine** (gemessen, `14.2-NACHWEIS-F5.md`, Abschnitt 4):
`overtime_balance` trägt für den Monat 0/0, und der Kontoauszug deckelt seit WR-10 selbst auf
heute — `Saldo=0.00 Buchungen=0` für den Zukunftsmonat.

**Vorschlag (nicht entschieden):** Das `DELETE` aus STEP 3 **vor** die `hireDate`-Wache ziehen,
damit ein Rebuild auch für einen noch nicht eingestellten Nutzer aufräumt. Das ist eine
Umstellung genau der Reihenfolge, die dieser Plan bewusst nicht anfassen darf; sie gehört in
einen eigenen Commit-Satz mit eigenem Regressionstest.

### 3. NB-C ist nach diesem Plan neu zu messen

**Gefunden:** Plan 14.2-05, als Folge der eigenen Datenwirkung.
**Kein Fix** (NB-C ist keiner der elf Befunde, `14.2-CONTEXT.md` stuft ihn als UAT-Punkt ein).

`14-ABNAHME-AUTO.md`, NB-C: „Das abgeleitete Aggregat `overtime_balance` weicht bei 9 von 20
Nutzern vom kanonischen Wert ab" (gemessen auf der unangetasteten Produktionskopie:
`userId=2 Differenz=4`, `3 → 30.4`, `16 → −12`, `17 → 52.8`, `18 → −4`, `19 → 2`, `20 → −2.8`,
`21 → −2`, `25 → −3.2`).

**Warum das hierher gehört:** Der `--rebuild`-Lauf dieses Plans hat **50 Nutzer-Monat-Paare bei
48 von 62 aktiven Nutzern** über `updateMonthlyOvertime()` neu gerechnet — genau die Ebene, auf
der NB-C misst. Ein Teil der dort gemeldeten Differenzen kann dadurch verschwunden sein, ein
anderer nicht. Die NB-C-Zahlen von `14-ABNAHME-AUTO.md` sind ab dem 26.08.2026 **nicht mehr die
aktuelle Lage**; wer NB-C entscheidet, muss vorher neu messen.

### 4. D-09: Keine WR-Warnung berührt

Plan 14.2-05 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehört. Die Codeänderung
beschränkt sich auf **eine** Zuweisung in
`server/src/services/overtimeTransactionRebuildService.ts` (Berechnungsende);
`unifiedOvertimeService.ts`, `overtimeLiveCalculationService.ts`,
`desktop/src/hooks/useWorkTimeAccounts.ts` und `workTimeAccountService.ts` stehen in keinem
seiner Commits. Die Punkte 1 bis 3 oben sind **neue Beobachtungen**, keine WR-Warnungen — sie
werden trotzdem nach demselben Verfahren hier abgelegt.

---

## Aus Plan 14.2-06 (26.08.2026) — F-6

### 1. NB-5, Fall 3: Zusammengeklebter Satz in `client.ts:153-155` (UAT-Kandidat)

**Gefunden:** `14.2-06-PLAN.md`, `<objective>` und Abschnitt „Ausdrücklich nicht anfassen"
(D-08-Festlegung, bereits im CONTEXT als nicht Teil von F-6 benannt).
**Nicht repariert** — ausdrücklicher Scope Fence dieses Plans.

`desktop/src/api/client.ts:153-155` zeigt bei einem Fehler, den ein Aufrufer nicht selbst
darstellt, einen Toast mit zwei aneinandergeklebten Sätzen **ohne Trennzeichen**:

```typescript
toast.error(data.error || `Server-Fehler: ${response.status}`, {
  description: 'Die Anfrage konnte nicht verarbeitet werden.',
});
```

Der dritte NB-5-Fall (Krankmeldung auf einen Tag mit bereits erfasster Zeit) trifft genau diese
Stelle: der servergelieferte deutsche Satz (`data.error`) erscheint als Toast-Titel, direkt
darunter — ohne Punkt, Doppelpunkt oder Absatz — der feste Untertitel „Die Anfrage konnte nicht
verarbeitet werden.". Das ist **kein Rohtext** (anders als F-6) und betrifft laut NB-5 **drei**
Stellen, von denen zwei außerhalb dieser Phase liegen — ein eigener Befund, keiner der elf.

**Wirkung:** Kein Datenverlust. Zwei vollständige, für sich lesbare deutsche Sätze, aber ohne
visuelle/semantische Trennung — abhängig vom jeweiligen Serversatz kann das wie ein einziger,
grammatisch unsauberer Satz wirken.

**Für die UAT-Sammlung:** ob der zusammengeklebte Satz **verständlich** ist, kann nur ein
Mensch beurteilen — als `14.2-U…` in `14-UAT-SAMMLUNG.md`, Abschnitt „Phase 14.2" vorzumerken
(Plan 14.2-13 sammelt).

### 2. D-09: Keine WR-Warnung berührt

Plan 14.2-06 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehört. Die Fixes beschränken
sich auf `desktop/src/api/exports.ts`; `desktop/src/api/client.ts`,
`server/src/routes/exports.ts` und `server/src/services/exportService.ts` stehen in keinem
seiner Commits (Scope Fence, D-08-Festlegung im Plan).

---

## Aus Plan 14.2-07 (26.08.2026) — F-7

### 1. Weg B (eigener Datenbankzustand `cancelled`) — UAT-Kandidat (D-09)

**Gefunden:** `14.2-CONTEXT.md`, Abschnitt D-09 — bereits vor Planbeginn als offene fachliche
Entscheidung benannt, hier zur Sammlung übernommen.
**Nicht umgesetzt** — ausdrücklicher Scope Fence dieses Plans (Weg A ist festgelegt).

Der Stornoweg der Abwesenheiten läuft weiterhin über dieselbe Mutation wie der Ablehnweg
(`POST /absences/:id/reject`) und speichert `status='rejected'` — Task 1 hat ausschließlich
die **Client-Meldung** angeglichen (`sourceStatus:'approved'` → Toast „Abwesenheitsantrag
storniert"). Ein eigener Datenbankzustand `cancelled` (Weg B) würde `absence_requests`
schemaseitig ändern und damit D-01 verletzen; außerdem hängt daran der unter 14.1-U12a
geprüfte Filter „abgelehnte Anträge nicht mehr im Historien-Export" (NB-6) — ein Antrag, der
künftig als `cancelled` statt `rejected` markiert wäre, führe an diesem Filter vorbei, sofern
er nicht mitgezogen wird.

**Wirkung:** Das sechste Erfolgskriterium der Phase („Ein Vorgang trägt in Schaltfläche,
Meldung und Datenbank denselben Namen") ist für **Schaltfläche und Meldung** erfüllt, für die
**Datenbank** nicht — sie speichert weiterhin `rejected`, nicht `storniert`/`cancelled`.

**Für die UAT-Sammlung:** ob ein eigener Datenbankzustand `cancelled` eingeführt werden soll
(mit den Folgen für den Historien-Export-Filter aus 14.1-U12a) ist eine fachliche Entscheidung
des Anwenders — als `14.2-U…` in `14-UAT-SAMMLUNG.md`, Abschnitt „Phase 14.2" vorzumerken
(Plan 14.2-13 sammelt).

### 2. Vier Testanträge bleiben in `absence_requests` stehen — über die Oberfläche nicht entfernbar

**Gefunden:** Plan 14.2-07, Task 2/3, beim D-01-Nachweis nach der Messung.
**Nicht per DELETE geglättet** — ausdrücklich verboten (D-01, hard constraint des Plans).

Die Messung in Task 2 legt für den Testnutzer `test.vollzeit` (id 15015) zwei Anträge an: einen
`sick`-Antrag (automatisch genehmigt) und einen `vacation`-Antrag (offen). Beide werden danach
über den jeweiligen Bedienweg storniert bzw. abgelehnt und enden mit `status='rejected'`. Ein
erster Skriptlauf scheiterte an einem Fehler **im Messskript selbst** (Sonner-Toast-Überlagerung
— derselbe Fallstrick wie in Plan 14.2-06 bereits einmal aufgetreten, siehe dortiges
`f6-exportfehler.mjs`; behoben durch ein Warten auf `[data-sonner-toast]`-Anzahl `0` vor der
nächsten Aktion). Die dabei bereits vollständig durchgeführten Server-Operationen (Anlegen,
Stornieren/Ablehnen) waren korrekt — nur die Toast-Text-Prüfung im Skript schlug fehl. Der
zweite, korrigierte Lauf legte zwei **weitere** Anträge desselben Musters an. In Summe stehen
vier Zeilen:

| id | type | Ausgangszustand | Vorgang | Endzustand |
|---:|---|---|---|---|
| 12397 | sick | approved (auto) | Stornieren | rejected |
| 12398 | vacation | pending | Ablehnen | rejected |
| 12399 | sick | approved (auto) | Stornieren | rejected |
| 12400 | vacation | pending | Ablehnen | rejected |

**Warum nicht entfernbar:** `AbsencesPage.tsx` zeigt für `status==='approved'` ausschließlich
„Stornieren" und für `status==='pending'` „Genehmigen"/„Ablehnen" — für `status==='rejected'`
zeigt die Admin-Ansicht **keine** Aktionsschaltfläche mehr. Der `DELETE /api/absences/:id`-
Endpunkt erlaubt einem Admin serverseitig zwar das Löschen jedes Status (`server/src/routes/
absences.ts:614-618`), aber kein UI-Element dieser Seite ruft ihn für einen nicht-`pending`-
Antrag auf; der `Löschen`-Knopf ist ausdrücklich auf `isEmployee && isPending` beschränkt
(`AbsencesPage.tsx:558-560`). „Über die Oberfläche wieder entfernen" (Task-2-Auftrag) ist für
beide Test-Endzustände deshalb nicht möglich — die Zeilen bleiben stehen, wie der Plan es für
genau diesen Fall vorsieht.

**Gemessene Wirkung auf D-01 (Plan 14.2-07-SUMMARY.md, Abschnitt „D-01"):** `absence_requests`
62 → 66 Zeilen (+4), SHA-256 verschieden. Die vier übrigen geschützten Tabellen
(`time_entries`, `overtime_corrections`, `vacation_balance`, `vacation_transactions`) sind
nachweislich unverändert (Zeilenzahl und SHA-256 identisch) — am Quelltext verifiziert, dass
weder die Anlage einer Krankmeldung noch ihr Storno, weder die Anlage eines offenen
Urlaubsantrags noch seine Ablehnung eine dieser vier Tabellen berühren (`incrementVacation-
Pending`/`decrementVacationPending` sind No-ops, sick leave erzeugt seit der Best-Practice-
Umstellung keine `time_entries` mehr).

**Für die UAT-Sammlung:** ob die vier Testzeilen gelöscht werden dürfen (und ob dafür ein
UI-Löschweg für Admin auch bei `rejected`/`approved` ergänzt werden soll), ist eine
Entscheidung des Anwenders — als `14.2-U…` in `14-UAT-SAMMLUNG.md`, Abschnitt „Phase 14.2"
vorzumerken (Plan 14.2-13 sammelt).

### 3. D-09: Keine WR-Warnung berührt

Plan 14.2-07 hat keine Stelle angefasst, die zu WR-01 bis WR-10 gehört. Der Fix beschränkt sich
auf `desktop/src/hooks/useAbsenceRequests.ts` und `desktop/src/pages/AbsencesPage.tsx`; keine
der in den Warnungen genannten Dateien steht in einem seiner Commits.

### Nachtrag zu Plan 14.2-07 — die vier Messzeilen sind entfernt, D-01 ist wiederhergestellt

Plan 14.2-07 hat beim Messen des Storno-Bedienwegs **vier echte Anträge** in
`absence_requests` erzeugt (ids 12397–12400, Nutzer 15015) und sie nicht zurückgenommen —
die Oberfläche bietet für `status='rejected'` keine Aktionsschaltfläche mehr. Damit stand die
Tabelle bei **66 statt 62** Zeilen und verletzte die erste Zusage des Anwenders.

**Der Orchestrator hat das über den Produktweg bereinigt, nicht per SQL:** Sicherung per
`VACUUM INTO` nach `server/database/backups/development.PRE-14.2-BEREINIGUNG-F7.db`
(1.613.824 Bytes), danach `DELETE /api/absences/{id}` als `admin` gegen `127.0.0.1:3100` für
jede der vier ids — alle vier mit HTTP **200**. Der Löschweg ist derselbe, den 14.1-U7a
geprüft hat; er rechnet dabei ordnungsgemäss neu.

**Nachmessung gegen die Ausgangswerte aus `14.2-NACHWEIS-D01.md` — alle fünf identisch:**

| Tabelle | Zeilen | SHA-256 gleich |
|---|---:|---|
| `time_entries` | 895 | ja |
| `absence_requests` | 62 | ja |
| `overtime_corrections` | 5 | ja |
| `vacation_balance` | 105 | ja |
| `vacation_transactions` | 120 | ja |

**Was daraus zu lernen ist, und was offen bleibt:** Ein stornierter oder abgelehnter Antrag ist
über die Oberfläche nicht mehr erreichbar — weder korrigierbar noch entfernbar. Für einen
Messlauf ist das lästig; für einen Anwender, der versehentlich storniert hat, ist es eine
Sackgasse derselben Art wie F-1 vor dieser Phase. Das ist **keiner der elf Befunde** und
gehört deshalb nicht in diese Phase — aber es gehört gesehen und ist als UAT-Punkt vorzulegen.

---

## Aus Plan 14.2-08 (26.08.2026) — F-2

### 1. `AbsenceRequestForm.tsx:331` — Hinweistext folgt den Stammdaten, die Zahlen daneben der Periode

**Gefunden:** Plan 14.2-08, Task 2, bei der von D-05 verlangten systematischen Suche.
**Kategorie (b) — Anzeigekontext.** **Nicht behoben. Begründung:**

`{selectedUser?.workSchedule && ( … ⚠️ Tage mit 0h zählen nicht als Arbeitstage … )}` steuert
ausschließlich, ob ein Hinweissatz erscheint — die Zeile trägt **keine Zahl**. Die tatsächliche
Berechnung von `requiredDays`/`requiredHours` läuft nachweislich periodenbasiert über
`useWorkPeriods(selectedUserId)` (Zeile 66-70). Es ist damit kein numerischer Fehler und keiner
der gemessenen vier Anzeigestellen von NB-2.

**Was trotzdem offen bleibt:** Hat die heute gültige Periode einen Tagesplan, die Stammdaten
aber nicht (oder umgekehrt), erscheint bzw. fehlt der Hinweissatz falsch. Eine Korrektur würde
`AbsenceRequestForm.tsx` anfassen — eine Datei, die zu **keinem** der elf Befunde dieser Phase
gehört und deren Antragsweg eine eigene Prüfung verlangte. Scope Fence (D-02, 14.2-CONTEXT.md).

### 2. `AbsencesBreakdown.tsx:89 / :305` — geprüft, **kein Fund**

**Gefunden:** Plan 14.2-08, Task 2, ausdrücklich am Quelltext nachgeprüft (D-05).
Zeile 89 ist ein Kommentar; die Zeilen 92-98 verwenden `absence.calculatedHours`, den vom Server
gerechneten Wert. Zeile 305 ist ein reiner Infotext im Hinweiskasten. **Beide lesen keine
Stammdaten.** Kein Handlungsbedarf — und niemand muss sie ein zweites Mal suchen.

### 3. Testbestand aus dem Messlauf: `user_work_periods.id 26738`

Fall B der Messung (`desktop/tests/messungen/f2-wochenstunden.mjs`) hat über die Oberfläche
einen Stundenwechsel mit künftigem Stichtag angelegt:

| Tabelle | id | Nutzer | validFrom | validTo | weeklyHours | Herkunft |
|---|---:|---:|---|---|---:|---|
| `user_work_periods` | **26738** | 48714 (`t1109-modellwechsel-2026-05-14`) | 2026-09-25 | NULL | 12 | Messung F-2, Fall B |

Die Vorgängerperiode 22950 wurde dabei planmäßig auf `validTo = 2026-09-25` geschlossen (vorher
offen). `user_work_periods` steht **nicht** unter D-01 (14.2-CONTEXT.md). Die Periode bleibt
stehen, damit der Zukunftsfall reproduzierbar bleibt; sie ist hier verzeichnet, damit sie
auffindbar ist und nicht später als unerklärter Bestand auftaucht.

Ebenfalls verändert und ebenfalls nicht D-01-geschützt: `users.privacyConsentAt` für Nutzer
48714 — der DSGVO-Zustimmungsdialog des Mitarbeiterkontos musste über den Produktweg beantwortet
werden, um an dessen Dashboard zu gelangen.

### 4. Ein Stundenwechsel legt fehlende Urlaubskonten-Zeilen still nach — **D-01 wiederhergestellt**

Der Wechsel aus Punkt 3 hat für Nutzer 48714 eine bis dahin fehlende Urlaubskontozeile für 2026
**nachgelegt**: `vacation_balance.id 39415` (`entitlement 30`) und `vacation_transactions.id
39497` (`type='entitlement'`, `days=30`, `createdAt 2026-08-26 00:31:40`). Beide Tabellen stehen
unter D-01.

**Wiederhergestellt:** Sicherung nach
`server/database/backups/development.PRE-14.2-08-D01-WIEDERHERSTELLUNG.db`, danach genau diese
beiden Zeilen entfernt. Nachmessung: alle fünf Zeilenzahlen **und** alle fünf SHA-256 identisch
zum Ausgangswert (895 / 62 / 5 / 105 / 120) — siehe `14.2-NACHWEIS-F2.md`, Abschnitt 7.

**Was offen bleibt (UAT-Kandidat):** Dass eine Arbeitszeitänderung als Nebenwirkung in zwei
besonders geschützte Tabellen schreibt, ist fachlich vermutlich richtig, aber nicht
offensichtlich und nicht protokolliert. Ein Mensch sollte entscheiden, ob das so gewollt ist.

### 5. E2E-Testdaten-Verschmutzung — zum zweiten Mal gemessen, weiterhin ungelöst

Der Abschlusslauf ergab **12 passed / 9 failed / 2 skipped** — dieselbe Menge und dieselben neun
Fälle wie der Ausgangsstand in `14.2-NACHWEIS-D01.md`, Abschnitt 2. Ursache gemessen: alle neun
fest verdrahteten Benutzernamen stehen bereits in `development.db` (Tabelle in
`14.2-NACHWEIS-F2.md`, Abschnitt 9); der Anlage-Dialog bleibt nach der `UNIQUE`-Kollision offen
und fängt jeden weiteren Klick ab.

**Bemerkenswert:** Plan 14.2-03 hatte `user-edit.spec.ts:221` bereits grün — **derselbe Lauf hat
den kollidierenden Nutzer neu erzeugt** (`deactivate-user` id 52117 und `role-change-user`
id 52118, beide 25.08.2026 23:04). Die Bereinigung hält also nur bis zum nächsten Lauf.

**Nicht behoben, mit Begründung:** Eine Bereinigung erzeugt bei jedem erfolgreichen Lauf erneut
je zwei Zeilen in `vacation_balance`/`vacation_transactions` (Plan 14.2-03 hat das gemessen) —
also **D-01 wiederholt zu verletzen, um ein Gate zu erfüllen**. Das ist die falsche Reihenfolge
der Zusagen. Der tragfähige Weg (Zufallsnamen oder `afterEach`-Aufräumen in den drei
Spec-Dateien) ist eine Entscheidung des Anwenders und gehört in die UAT-Sammlung.

---

## Aus Plan 14.2-09 (F-8)

### 1. `WorkTimePeriodEditModal.tsx` trägt dasselbe Rücknahmemuster — **geprüft, nicht mitrepariert**

Der Korrektur-Dialog meldet über dieselbe Schnittstelle wie der Wechsel-Dialog
(`EditUserModal.tsx:1119`, `onConflict={setConflictPeriodId}`). Am Quelltext nachgeprüft
(`desktop/src/components/worktime/WorkTimePeriodEditModal.tsx`, Stand 26.08.2026):

| Zeile | Stelle | Befund |
|---|---|---|
| `:391` | letzte Zeile von `resetForm()` | `onConflict?.(null);` — und `handleClose()` (`:394-397`) ruft `resetForm()`. **Exakt das Muster von F-8, Teilproblem (b).** |
| `:281` | `handleValidFromChange` | `onConflict?.(null);` bei **jedem Tastendruck** im Stichtagsfeld — dort sogar strenger als im Wechsel-Dialog, der die Rücknahme nur an den Vorschauerfolg hängt |
| `:359` | Ende von `validateForm()` | `onConflict?.(result.conflictPeriodId ?? null);` — setzt die Markierung |
| `:419` | Erfolgspfad von `performSave` | `resetForm()`, danach `onSaved(outcome)` |

**Teilproblem (a) trifft ihn ebenfalls:** Der Korrektur-Dialog liegt genauso über der
Periodenliste im `EditUserModal`; eine dort gesetzte Markierung kann den Anwender bei offenem
Dialog nicht erreichen. Ein Kollisionspanel wie das aus Plan 14.2-09 fehlt ihm.

**Nicht behoben, mit Begründung (D-02):** F-8 ist der Befund am **Wechsel-Dialog** — das
Abnahmeprotokoll (`14-U6` Punkt 3) hat genau diesen Bedienweg gemessen. Der Korrektur-Dialog ist
ein **eigener Befund** mit eigenem Bedienweg, eigener Messung und eigenem Commit-Satz. Ihn in
denselben Commit-Satz zu ziehen, würde die Zuordnung „ein Befund, ein Commit-Satz" auflösen und
eine unbelegte Behauptung mit einem belegten Fix vermischen. Er ist hier verzeichnet, damit er
nicht verlorengeht.

**Anmerkung zur Endstelle:** Die in Plan 14.2-09 in `EditUserModal.handleClose` eingefügte
Rücknahme (`setConflictPeriodId(null)`) wirkt auch für den Korrektur-Dialog — eine von dort
gesetzte Markierung bleibt also ebenfalls nicht über die Sitzung hängen. Das ist eine
Nebenwirkung, kein Fix des obigen Befundes.

### 2. `formatGermanDate` im Wechsel-Dialog und die Servermeldung schreiben das Datum unterschiedlich

Gemessen in Zustand 1 (`14.2-NACHWEIS-F8.md`, Abschnitt 3.2/3.3):

- Das neue Kollisionspanel schreibt **`17.8.2026`** — `formatGermanDate` ist
  `toLocaleDateString('de-DE')` ohne Formatangaben (`WorkTimeChangeModal.tsx:145-147`), also
  ohne führende Null. Dieselbe Schreibweise benutzt die Periodenliste.
- Der Feldfehler daneben schreibt **`17.08.2026`** — dieser Text kommt bei der
  Vorschau-Fehlerantwort **vom Server** und wird unverändert übernommen
  (`requestPreview → onError → setFieldErrors`).

Zwei Schreibweisen desselben Datums in einem Dialog. **Nicht angefasst**, weil (a) D-10 den
Feldfehlertext ausdrücklich unverändert lässt und (b) `formatGermanDate` die im Projekt
etablierte Hilfsfunktion ist, deren Änderung jede Datumsanzeige des Dialogs beträfe — das ist
kein Teil von F-8. Kandidat für die UAT-Sammlung.

### 3. Der Vorschaudienst meldet bei den vorbelegten Werten `isNoOp` statt `future`

Am laufenden Server nachgemessen: `POST /api/work-periods/preview` mit
`{userId: 48717, validFrom: '2026-09-15', weeklyHours: 30, workSchedule: <Tagesplan der aktuellen Periode>}`
liefert `isNoOp: true`. Der Dialog zeigt dann „Es gibt nichts umzustellen", obwohl der Stichtag
ein anderer ist als der der aktuellen Periode. Fachlich vertretbar (die *Werte* ändern sich
nicht), für den Bedienenden aber überraschend, weil er einen neuen Stichtag eingetragen hat.
**Nicht angefasst** — gehört nicht zu F-8. Im Messskript ist der Fall umgangen, indem die
Wochenstunden mitgeändert werden (dokumentiert in `14.2-NACHWEIS-F8.md`, Abschnitt 5).
