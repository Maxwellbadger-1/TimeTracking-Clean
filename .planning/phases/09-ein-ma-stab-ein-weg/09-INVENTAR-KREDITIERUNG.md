# Inventar: Abwesenheits-Kreditierungsregel (`overtime_comp`)

**Erstellt:** 2026-08-22 (Plan 09-05, Task 1)
**Zweck:** Vollzähliges, klassifiziertes Inventar aller Stellen im Repository, die entscheiden, ob
eine genehmigte Abwesenheit vom Typ `vacation`/`sick`/`special`/`overtime_comp` den
Überstundensaldo kreditiert. Referenzregel (REQ-19, `09-REQ19-BEFUND.md` Hypothese H1): Ein
genehmigter Überstundenausgleich (`overtime_comp`) wird **aus dem Überstundenkonto selbst**
bezahlt und darf deshalb **keine** zusätzliche Gutschrift auf genau dieses Konto erhalten —
anders als `vacation`/`sick`/`special`, die aus einem anderen Konto bezahlt werden und den Tag
saldoneutral halten müssen.

Jede Aussage unten ist mit `datei:zeile` belegt und wurde durch tatsächliches Lesen der Datei
verifiziert (Zero-Hallucination-Policy). Die Kandidatenliste aus `09-05-PLAN.md`,
`<befunde_der_planung>` Abschnitt A, ist der Ausgangspunkt, nicht das Ergebnis — jede dort
genannte Zeile wurde hier erneut nachgeprüft; Abweichungen sind benannt.

---

## Suchläufe (Rohtreffer)

Ausgeführt gegen `server/src` und `server/scripts`, `node_modules` ausgeschlossen, Testdateien
(`*.test.ts`) für die Klassifikation mitgelesen, aber nicht als eigene Fundstellen gezählt.

| # | Suchlauf | Befehl | Rohtreffer |
|---|----------|--------|------------|
| 1 | `'vacation'` + `'overtime_comp'` im selben `type IN (…)`-Filter | `grep -rn "IN ('vacation'" src/ scripts/ --include=*.ts` | 8 (davon 1 kanonisch ohne `overtime_comp`: `unifiedOvertimeService.ts:351`) |
| 1b | Gesamtvorkommen `overtime_comp` (jeder Kontext: Typdefinitionen, Kommentare, SQL, Switch) | `grep -rn "overtime_comp" src/ scripts/ --include=*.ts \| grep -v .test.ts` | 47 Zeilen in 24 Dateien |
| 2 | Fallunterscheidungen `case 'overtime_comp'` / `type === 'overtime_comp'` | `grep -rn "case 'overtime_comp'\|absence.type === 'overtime_comp'\|type === 'overtime_comp'" src/ scripts/ --include=*.ts \| grep -v .test.ts` | 12 (davon 6 in `absenceService.ts` — Statusübergänge, nicht Kreditierung, siehe unten; 1 in `exportService.ts` — reine Anzeige-Beschriftung) |
| 3 | Kreditierungsfunktionen (Aufruf + Definition): `getAbsenceCredit`, `recordOvertimeCompCredit`, `recordVacationCredit`, `recordSickCredit`, `recordSpecialCredit` | `grep -rn "getAbsenceCredit\|recordOvertimeCompCredit\|recordVacationCredit\|recordSickCredit\|recordSpecialCredit" src/ scripts/ --include=*.ts \| grep -v .test.ts` | 17 (1 Definition + 3 Aufrufe `unifiedOvertimeService.ts`; 4 Definitionen `overtimeTransactionService.ts`; 8 Aufrufe `overtimeService.ts` in zwei Funktionen à 4) |
| 4 | Schreibende Stellen mit Transaktionstyp `overtime_comp_credit` | `grep -rn "overtime_comp_credit" src/ scripts/ --include=*.ts \| grep -v .test.ts` | 24 (Typdefinitionen, Migrationen, 1 INSERT in `overtimeTransactionService.ts:305`, 2 tatsächliche Erzeugungsstellen in `overtimeLiveCalculationService.ts:311` und `overtimeService.ts:362`/`:1331`) |

Jeder Treffer aus allen vier Suchläufen wurde gelesen. Suchlauf 2 enthält sechs Treffer in
`absenceService.ts` (Zeilen 461, 549, 695, 773, 858, 1241, 1294 — sieben, nicht sechs, siehe unten),
die beim ersten Lesen wie Kreditierungslogik aussehen, tatsächlich aber Status- und
Validierungsverzweigungen beim Genehmigen/Ablehnen/Stornieren eines Antrags sind (z. B. ob ein
stornierter `overtime_comp`-Antrag den Urlaubsanspruch zurückbucht) — sie schreiben **keine**
`overtime_transactions`-Zeile und gehören nicht zur Kreditierungsregel. Aufgenommen unten als
„geprüft, kein Fund" mit Beleg.

---

## Fundstellen-Tabelle

Spalten: laufende Nummer, `datei:zeile`, umschließende Funktion, Pfadart, Aufrufweg bis zur Route
oder zum npm-Skript, Stand, Zuordnung.

| # | `datei:zeile` | Funktion | Pfadart | Aufrufweg | Stand | Zuordnung |
|---|---|---|---|---|---|---|
| 1 | `unifiedOvertimeService.ts:336-357` (`getAbsenceCredit`) | `getAbsenceCredit()` | aktiver Lesepfad | `calculateDailyOvertime()` → `reportService.ts`, `overtimeService.ts` (`updateMonthlyOvertime`), `overtimeLiveCalculationService.ts` (`calculateCurrentOvertimeBalance`) | kanonisch, Referenzimplementierung | keine Änderung nötig — Referenz für alle übrigen |
| 2 | `overtimeTransactionRebuildService.ts:341` (`if (day.absence.type !== 'unpaid' && day.absence.type !== 'overtime_comp')`) | `handleAbsenceDay()` | aktiver Schreibpfad | `rebuildOvertimeTransactionsForMonth()` ← `overtimeService.ts:478,512` (`updateMonthlyOvertime`) ← `GET /api/overtime/:userId`; auch `overtimeCorrectionsService.ts:90,394` | behoben 09-04 | keine Änderung nötig |
| 3 | `overtimeTransactionRebuildService.ts:404` (`const creditChange = absenceType === 'overtime_comp' ? 0 : targetHours;`) | `calculateRunningBalanceAfterAbsence()` | aktiver Schreibpfad | wie #2 | behoben 09-04 | keine Änderung nötig |
| 4 | `overtimeTransactionRebuildService.ts:416` (`'overtime_comp': 'overtime_comp_credit'` in `getCreditType()`) | `getCreditType()` | **nicht erreichbar mit `overtime_comp`** | `getCreditType()` wird nur innerhalb des `if`-Zweigs von #2 aufgerufen (`:342`), der `overtime_comp` bereits ausschließt — die Mapping-Zeile für `overtime_comp` ist toter, nie erreichter Code | behoben 09-04 (defensiv, unerreichbar) | keine Änderung nötig, weil der vorgelagerte Guard (#2) `overtime_comp` nie bis hierher durchlässt — bei Planung neu geprüft, nicht in `09-05-PLAN.md` Abschnitt A benannt |
| 5 | `overtimeTransactionRebuildService.ts:498` (`if (day.absence.type && day.absence.type !== 'unpaid' && day.absence.type !== 'overtime_comp')`) | `updateOvertimeBalanceForMonth()` | aktiver Schreibpfad | wie #2 | behoben 09-04 | keine Änderung nötig |
| 6 | `overtimeLiveCalculationService.ts:154-175` (Aufbau `absenceDates`, kein Typfilter), `:233-237` (Schritt 4, Überspringen), `:301-337` (Schritt 5, Switch + `:328` Gutschrifthöhe) | `calculateLiveOvertimeTransactions()` | **aktiver Lesepfad** | `GET /api/overtime/transactions/live` (`routes/overtime.ts:499-509`, `requireAuth`) | offen (CR-01) | **Task 2** |
| 7 | `overtimeService.ts:1236-1345`, konkret `:1277` (`type IN (…, 'overtime_comp', …)`), `:1307-1310` (Typableitung `${absence.type}_credit`), `:1330-1331` (`case 'overtime_comp': recordOvertimeCompCredit(...)`) | `ensureAbsenceTransactions()` | **aktiver Schreibpfad** | `GET /api/overtime/transactions/monthly-summary` (`routes/overtime.ts:556`) → `ensureDailyOvertimeTransactions()` (`:781`, aufgerufen `:610`) → `:854` | offen — bei der Planung neu gefunden, in Task 1 am Quellcode bestätigt | **Task 2** |
| 8 | `overtimeService.ts:221-380`, konkret `:269` (`type IN (…, 'overtime_comp', …)`), `:361-364` (`case 'overtime_comp': recordOvertimeCompCredit(...)`) | `ensureAbsenceTransactionsForMonth()` | **nicht erreichbar** — kein Aufrufer im Produktivcode (siehe „Erreichbarkeit" unten) | keiner | offen, aber unerreichbar | **Task 2** (Plan-Vorgabe: unabhängig von Erreichbarkeit mitziehen) |
| 9 | `validateOvertimeDetailed.ts:492` (`AND type IN ('vacation', 'sick', 'overtime_comp')`) | Kreditblock des Abnahmewerkzeugs | Abnahmewerkzeug, kein Produktivpfad | `npm run validate:overtime:detailed` — namentlich in ROADMAP-Erfolgskriterium 3 genannt | offen | **Task 3** |
| 10 | `validateOvertimeCalculation.ts:200` (`absence.type === 'vacation' \|\| absence.type === 'sick' \|\| absence.type === 'overtime_comp'`) | Kreditblock | Abnahmewerkzeug, kein Produktivpfad | `npm run validate:overtime` | offen | **Task 3** |
| 11 | `verifyTestData.ts:121` (`AND type IN ('vacation', 'sick', 'overtime_comp')`) | `calculateActualHours()` | Testdaten-Prüfung, kein Produktivpfad | `npm run verify-test-data` (manuell, nicht in CI) | offen, aber siehe Einstufung unten | **keine Änderung nötig** — begründet unten |
| 12 | `overtimeService.ts:46-100` (`_calculateAbsenceCreditsForMonth`, `:69` `type IN ('sick', 'vacation', 'overtime_comp')`) | `_calculateAbsenceCreditsForMonth()` | **nicht erreichbar** — kein Aufrufer im gesamten Repository (Unterstrich-Präfix, tote private Funktion) | keiner | offen, aber toter Code | **keine Änderung nötig** — begründet unten |

**Korrekturen gegenüber `09-05-PLAN.md` Abschnitt A:** Zeile 4 (`overtimeTransactionRebuildService.ts:416`,
`getCreditType()`) stand nicht in der Kandidatenliste des Plans und wurde bei diesem Inventar neu
gefunden — sie ist jedoch tot (siehe Begründung), keine Korrektur an einer bestehenden
Zeilenangabe nötig. Zeile 12 (`overtimeService.ts:46-100`, `_calculateAbsenceCreditsForMonth`)
stand ebenfalls nicht im Plan und wurde hier neu gefunden — ebenfalls toter Code. Alle übrigen
Zeilenangaben aus Abschnitt A (`unifiedOvertimeService.ts:335-357`,
`overtimeTransactionRebuildService.ts:341,404,498`, `overtimeLiveCalculationService.ts:235,:328`,
`overtimeService.ts:1331`, `overtimeService.ts:362`, `validateOvertimeDetailed.ts:492`,
`validateOvertimeCalculation.ts:200`, `verifyTestData.ts:121`) wurden am Quellcode bestätigt;
zwei Kleinabweichungen: Die im Review als `:228-236`/`:300-331` bezeichneten Blöcke in
`overtimeLiveCalculationService.ts` beginnen exakt bei `:233` (Skip-Bedingung) bzw. `:301`
(Switch) — die im Review genannten Zeilen `:235`/`:328`/`:310-312` liegen jeweils **innerhalb**
dieser Blöcke und sind punktgenau korrekt.

---

## Erreichbarkeit von `ensureAbsenceTransactionsForMonth()` (`overtimeService.ts:221`)

```
grep -rn "ensureAbsenceTransactionsForMonth" server/src server/scripts --include=*.ts
```

Treffer: die Definition selbst (`overtimeService.ts:221-222`, letztere nur der `console.log`-Text),
ein Kommentar in `overtimeTransactionManager.ts:16` ("legacy, duplication-prone"), ein Kommentar in
`overtimeTransactionRebuildService.ts:15` ("REPLACES: … ensureAbsenceTransactionsForMonth()
(duplication-prone)"), und ein Kommentar in `fixOvertimeTransactionsSchema.ts:142`
("This will trigger ensureAbsenceTransactionsForMonth() for each month" — der tatsächliche Aufruf
in dieser Datei geht jedoch über `updateMonthlyOvertime()`, siehe Fundstelle 13 unten, nicht direkt
auf diese Funktion). Kein einziger echter Aufruf. Einstufung: **nicht erreichbar.**

Trotzdem in Task 2 mitgezogen (Plan-Vorgabe): Eine unerreichbare Kopie derselben Regel führt die
nächste Untersuchung (Phase 11/14) genauso in die Irre wie eine erreichbare, wenn sie unkorrigiert
bleibt.

---

## Einstufung Fundstelle 11 — `verifyTestData.ts:121`

**Kontext gelesen:** `verifyTestData.ts:1-131`. Das Skript vergleicht die Datenbank gegen fest
verdrahtete `EXPECTED_RESULTS` für drei Testnutzer (`david_test`, `emma_test`, `frank_test`) mit
einem fixen Referenzdatum `2025-12-08` (`:67`). Der Kommentar bei `frank_test` (`:45`) lautet
`54h (30h (3×10h) + 16h (2 Tage Gutschrift) + 8h (heute))` — die erwarteten `54h` setzen
ausdrücklich voraus, dass zwei `overtime_comp`-Tage **je 8h Gutschrift** erhalten. Dieses Skript
bildet damit nicht versehentlich die alte Regel ab, sondern hat sie als Testerwartung
einprogrammiert, bevor REQ-19 existierte.

**Erreichbarkeit:** `npm run verify-test-data` (`package.json:23`) — manueller Aufruf, kein
Bestandteil von `npx vitest run` (das Skript ist kein Vitest-Test, sondern ein eigenständiges
`tsx`-Skript mit `console.log`-Ausgabe) und kein Bestandteil eines CI-Workflows
(`grep -rn "verify-test-data" .github/workflows/` liefert keinen Treffer). Kein Produktivpfad.

**Zuordnung: keine Änderung nötig.** Begründung: Eine Korrektur der Query auf
`'vacation', 'sick', 'special'` würde den Datensatz von `frank_test` mit den fest verdrahteten
Erwartungswerten (`54h`) inkonsistent machen, ohne dass dieses Skript irgendeinen Produktivpfad
oder eine automatisierte Prüfung beeinflusst — die Testnutzer `david_test`/`emma_test`/`frank_test`
existieren zudem nicht nachweislich in `server/database/development.db` (nicht Teil der
09-PRUEFNUTZER-Auswahl, nicht geprüft). Eine Korrektur wäre eigenständige Arbeit (neue
Erwartungswerte berechnen, ggf. Testnutzer neu seeden) ohne Bezug zu den beiden aktiven API-Pfaden
oder zu Erfolgskriterium 3 — außerhalb des Lückenschluss-Umfangs. Vermerk statt Fix.

---

## Einstufung Fundstelle 12 — `overtimeService.ts:46-100` (`_calculateAbsenceCreditsForMonth`)

**Kontext gelesen:** `overtimeService.ts:31-45` (JSDoc), `:46-100` (Funktionskörper). Unterstrich-
Präfix (Namenskonvention für „intern/unbenutzt" in dieser Codebasis), kein `export`-Schlüsselwort.

```
grep -n "_calculateAbsenceCreditsForMonth" server/src/services/overtimeService.ts
```

Einziger Treffer: die Definition selbst (`:46`). Kein Aufrufer im gesamten Repository.
**Zuordnung: keine Änderung nötig**, weil die Funktion nie ausgeführt wird — eine neunte Kopie der
Regel (`:69`, `type IN ('sick', 'vacation', 'overtime_comp')`), aber folgenlos. Aufgenommen als
Kandidat für die Bestandsaufnahme von Phase 9.1/11 (toter Code, der bei einem künftigen Refactoring
versehentlich reaktiviert werden könnte), hier jedoch aus SCOPE BOUNDARY nicht angefasst.

---

## Fundstelle 13 — `fixOvertimeTransactionsSchema.ts` und Delegatoren (kein eigener Fund)

**Geprüft:** `fixOvertimeTransactionsSchema.ts:1-200`, `fillAllOvertimeTransactions.ts:1-40`,
`migrations/001_backfill_overtime_transactions.ts:1-40`.

- `fixOvertimeTransactionsSchema.ts:125,135` (`type IN ('vacation', 'sick', 'overtime_comp', 'special', 'unpaid')`)
  wählt nur aus, **welche** Nutzer/Monate verarbeitet werden (Steuerungs-Query), und delegiert die
  eigentliche Kreditentscheidung an `updateMonthlyOvertime()` (`:144,152`) →
  `ensureAbsenceTransactionsForMonth()` (Fundstelle 8, in Task 2 korrigiert). Das Skript öffnet
  zudem `new Database(path.join(__dirname, '../../database.db'))` (`:28,33`) — das ist die tote
  `server/database.db`, nicht `server/database/development.db` oder Produktion. **Einstufung:
  Einmalskript, keine eigene Kopie der Regel, referenziert die tote Legacy-Datenbank — keine
  Änderung nötig.** Ein erneuter Lauf (unwahrscheinlich, da CHECK-Constraint-Migration bereits
  historisch) würde über die Delegation ohnehin den Task-2-Fix erben.
- `fillAllOvertimeTransactions.ts` und `migrations/001_backfill_overtime_transactions.ts`
  importieren beide ausschließlich `ensureDailyOvertimeTransactions` (Fundstelle 7) und enthalten
  selbst keine `type IN (…)`-Abfrage auf `absence_requests` — nur beschreibende Kommentare
  („Absence credit transactions (vacation, sick, overtime_comp, special)"). **Einstufung: keine
  eigene Kopie, Fix pflanzt sich transitiv fort.** `001_backfill_overtime_transactions.ts` ist
  zudem eine bereits gelaufene, idempotente Migration (`SAFE: Idempotent (skips existing
  transactions)`, `:14`) — eine bereits gelaufene Migration wird nicht rückwirkend geändert.

---

## Geprüft, kein Fund — `absenceService.ts` (Suchlauf 2)

`absenceService.ts:461,549,695,773,858,1241,1294` — sieben Treffer für
`type === 'overtime_comp'`/`request.type === 'overtime_comp'`. Alle sieben gelesen:

- `:461`, `:695` — Validierung beim Erstellen/Bearbeiten eines Antrags (z. B. ob ein Feld wie
  `compensationHours` Pflicht ist für diesen Typ).
- `:549` — Sonderfeld-Validierung beim Erstellen.
- `:773`, `:858` — Verzweigung beim Genehmigen/Ablehnen, ob eine `overtime_comp`-spezifische
  Nebenwirkung (z. B. Verknüpfung zu einem Ausgleichstag-Datensatz) ausgelöst wird.
- `:1241`, `:1294` — Verzweigung beim Stornieren/Löschen, ob eine `overtime_comp`-spezifische
  Rückabwicklung nötig ist.

Keine dieser sieben Stellen schreibt eine `overtime_transactions`-Zeile oder entscheidet über eine
Gutschrift auf das Überstundenkonto — sie gehören zur Antragslogik (`absence_requests`), nicht zur
Kreditierungsregel. Kein Fund.

---

## Urteil

**Gesamtzahl der Fundstellen, die tatsächlich über eine Kreditierung entscheiden (nicht nur
delegieren oder Antragsstatus verwalten): 12**, davon:

- **1 kanonisch** (`unifiedOvertimeService.ts:336-357`).
- **4 behoben in 09-04** (`overtimeTransactionRebuildService.ts:341,404,416*,498` — `*` = defensiv,
  unerreichbar).
- **3 offen und in diesem Plan korrigiert (Task 2, Task 3):**
  `overtimeLiveCalculationService.ts` (CR-01), `overtimeService.ts:1236-1345`
  (`ensureAbsenceTransactions`), `overtimeService.ts:221-380` (`ensureAbsenceTransactionsForMonth`,
  unerreichbar, aber mitgezogen).
- **2 offen und in Task 3 korrigiert (Abnahmewerkzeuge):** `validateOvertimeDetailed.ts:492`,
  `validateOvertimeCalculation.ts:200`.
- **2 offen, aber bewusst unverändert gelassen:** `verifyTestData.ts:121` (Testdaten mit eigener,
  veralteter Erwartungshaltung, kein Produktivpfad, keine CI-Bindung), `overtimeService.ts:46-100`
  (`_calculateAbsenceCreditsForMonth`, toter Code, kein Aufrufer).

Die Antwort auf „gibt es eine fünfte Kopie" aus `09-04-PLAN.md` lautet damit: **ja, insgesamt zwölf
Fundstellen mit einer Kreditentscheidung**, davon acht mit tatsächlicher Auswirkung (kanonisch,
behoben oder noch zu beheben) und vier ohne Auswirkung (unerreichbar/tot/kein Produktivpfad).

**Warum `09-04-PLAN.md:9`/`:123` falsch waren:** Der Plan behauptete „keine Überschneidung"
zwischen `overtimeLiveCalculationService.ts` und der REQ-19-Untersuchung, weil die drei geprüften
Hypothesen H1–H3 (`09-REQ19-BEFUND.md:79-104`) ausschließlich in `unifiedOvertimeService.ts`,
`overtimeTransactionService.ts` und `absenceService.ts` verortet wurden. Diese Behauptung war eine
**Reichweitenannahme über die Aufrufkette**, keine Reichweitenprüfung: Es wurde nie systematisch
gesucht, welche *anderen* Stellen ebenfalls `absence_requests.type` gegen `overtime_comp` prüfen
und eine Gutschrift erzeugen — die Suche blieb auf die drei Dateien beschränkt, die die drei
Hypothesen bereits nannten. Die Prämisse dieses Plans (09-05) — „erst zählen, dann reparieren" —
existiert genau deshalb: Eine Annahme über Vollständigkeit ohne Suchlauf-Beleg wiederholt exakt den
Fehler, den sie beheben soll. Diese Lehre ist die Übergabe an Phase 11/14: Jede künftige Änderung
an der Kreditierungsregel (z. B. bei der Perioden-Umstellung) muss gegen **alle zwölf** hier
gelisteten Fundstellen geprüft werden, nicht nur gegen die drei ursprünglich vermuteten.
