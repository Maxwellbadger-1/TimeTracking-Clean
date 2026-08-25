# Abnahmeprotokoll — die 33 AUTO-Punkte

**Ausgeführt:** 2026-08-25
**Grundlage:** `14-UAT-TRIAGE.md`, Abschnitt 3 (Kategorie `AUTO`) und Abschnitt 4
**Umfang:** ausschließlich Kategorie `AUTO`. Die 37 Punkte `AUTO-MIT-SERVER` sind **nicht**
Gegenstand dieses Laufs — sie liefen parallel in einem zweiten Lauf.
**Nichts geändert:** kein Produktionscode, kein Commit, kein Push, kein Deployment, kein
Zugriff auf `/home/ubuntu/databases/production.db`. `git status` weist am Ende dieses Laufs
keine von diesem Lauf angefasste Quelldatei aus.

---

## 1. Zusammenfassung

| Urteil | Anzahl |
|---|---:|
| **BESTANDEN** | **29** |
| **NICHT BESTANDEN** | **2** |
| **NICHT PRÜFBAR** | **2** |
| **Summe** | **33** |

### Die nicht bestandenen Punkte, je ein Satz

| ID | Warum nicht bestanden |
|---|---|
| **13-U11** | Die Abbruchregel 1 hält (zwischen Snapshot 1 und 2 ändert sich ausschließlich der betroffene Nutzer 2), aber die Zusatzzusicherung „Snapshot 3 ist bei diesem Nutzer identisch mit Snapshot 1" trifft **nicht** wörtlich zu: der kanonisch berechnete Saldo ist identisch (155/165/+10 h), zwei Monatszeilen des abgeleiteten Aggregats `overtime_balance` kehren jedoch nicht auf ihren alten Wert zurück — sie stehen danach **richtiger** als vorher (Summe 155 h = kanonischer Wert statt vorher 159 h). |
| **14.1-U30a** | Erwartet waren **fünf** Treffer für den Zukunftsausschluss; gemessen sind es **drei** — `overtimeFutureCapping.test.ts` und `historicalExportFiltering.test.ts` arbeiten bewusst **mit** einem Zukunftsdatum bzw. einer Zukunftszeile, der Querschnittsbefund des Prüfers gilt daher nur für drei der fünf Dateien. |

### Die nicht prüfbaren Punkte

| ID | Warum nicht prüfbar |
|---|---|
| **14-U1b** | Setzt 14-U1a voraus (Kategorie `ENTSCHEIDUNG`): Nutzer-Id, Stichtag, alte und neue Wochenstunden des realen Umstellungsfalls. Diese vier Werte liegen nicht vor. Ohne sie gibt es keine Erwartung, gegen die geprüft werden könnte. Der Rechenweg selbst ist unter 13-U11, P12-12 und P12-44 auf derselben Arbeitskopie belegt. |
| **14-U3a** | Der Punkt lautet „nach dem Release". Das jüngste Release ist **v1.8.0 vom 20.08.2026** und liegt damit **vor** den Phasen 14 und 14.1 — das abzunehmende Release existiert noch nicht. Als Ersatznachweis wurde `latest.json` von v1.8.0 geprüft (alle vier Plattformschlüssel mit `url` und `signature` vorhanden); das belegt den Mechanismus, nicht das abzunehmende Artefakt. |

### Alle 33 Punkte im Überblick

| # | ID | Kurzfassung | Urteil | Abschnitt |
|---:|---|---|---|---|
| 1 | 11-U6 | Generalprobe des Rechenwegs auf einer Produktionskopie | BESTANDEN | 6 |
| 2 | P12-1 | Migration 011: Zeilenzahl identisch, `integrity_check` = ok | BESTANDEN | 5 |
| 3 | P12-4a | `ConfirmDialog`: X-Button trägt einen zugänglichen Namen | BESTANDEN | 3 |
| 4 | P12-9 | `applyWorkTimeChange()` unter 10 Sekunden | BESTANDEN | 6 |
| 5 | P12-10 | Abgebrochener Speichervorgang hinterlässt nichts | BESTANDEN | 6 |
| 6 | P12-12 | Kein Rundungsfehler über Monatsgrenzen | BESTANDEN | 6 |
| 7 | P12-18 | Kein Saldo-Seiteneffekt auf unbeteiligte Nutzer | BESTANDEN | 6 |
| 8 | P12-19 | `checkAllPeriodChains()` nach dem Wechsel: kein Befund | BESTANDEN | 6 |
| 9 | P12-23a | Nulldifferenz rechnet auf 0 | BESTANDEN | 6 |
| 10 | P12-40a | Bestandsdaten `referenceType` vor Migration 012 | BESTANDEN | 5 |
| 11 | P12-44 | Rückwirkender Wechsel zieht Zukunftsmonate mit | BESTANDEN | 6 |
| 12 | P12-49 | Typ-Spalte zeigt Rohwerte (Befund bestätigt sich) | BESTANDEN | 3 |
| 13 | 13-U3a | Sperrregeln der Löschbestätigung | BESTANDEN | 3 |
| 14 | 13-U11 | Generalprobe: drei Snapshots vergleichen | **NICHT BESTANDEN** | 6 |
| 15 | 13-U13 | `aria-label` nennt die Periode konkret | BESTANDEN | 3 |
| 16 | 13-U14 | Migration 015: Index, `integrity_check`, `foreign_key_check` | BESTANDEN | 5 |
| 17 | 13-U15 | Ehemals tödlicher Ablauf 40→32→40→löschen | BESTANDEN | 6 |
| 18 | 14-U1b | Der reale Umstellungsfall | **NICHT PRÜFBAR** | 6 |
| 19 | 14-U2a | Freigabeunterlagen | BESTANDEN | 7 |
| 20 | 14-U3a | `latest.json` mit allen vier Plattformschlüsseln | **NICHT PRÜFBAR** | 7 |
| 21 | 14-U7 | B-2-Sicherheitsfix durch neue Tests belegt | BESTANDEN | 3 |
| 22 | 14-U8 | REQ-32: fünf Wechselfälle einzeln | BESTANDEN | 3 |
| 23 | 14.1-U1a | Saldo = Summe der Buchungen (18, 20, 21, 25) | BESTANDEN | 4 |
| 24 | 14.1-U14a | `totalOvertime` im Historien-Export | BESTANDEN | 4 |
| 25 | 14.1-U15a | Alt-Abzug bei den Anträgen 25, 56, 64 | BESTANDEN | 4 |
| 26 | 14.1-U16a | `compensation`-Belegzeile überlebt eine Neuberechnung | BESTANDEN | 4 |
| 27 | 14.1-U20a | Wie viele fiktive Journalbuchungen wirklich? | BESTANDEN | 4 |
| 28 | 14.1-U21a | Testnutzer 15015: 30 Zeilen, 1 Monatszeile, −88 h | BESTANDEN | 4 |
| 29 | 14.1-U25a | Keine Zukunftsbuchung mehr bei 3, 17, 30 | BESTANDEN | 4 |
| 30 | 14.1-U27a | Trockenlauf schreibt DDL, aber keine Daten | BESTANDEN | 4 |
| 31 | 14.1-U28a | `carryoverFromPreviousYear` der drei gelöschten Zeilen | BESTANDEN | 4 |
| 32 | 14.1-U29a | CR-04, CR-05, CR-06 einzeln nachgemessen | BESTANDEN | 4 |
| 33 | 14.1-U30a | Alle fünf Testdateien schließen Zukunftsdaten aus | **NICHT BESTANDEN** | 3 |

### Was die Messung zu 14.1-U15a für U15b und U23 bedeutet — in einem Absatz

Die in Plan 14.1-06 ausgelassene Messung ist jetzt geführt (Abschnitt 4, ID 14.1-U15a).
Von den drei genehmigten Ausgleichen steht heute noch **genau bei einem** ein Rest aus dem
entfernten FIFO-Weg in `overtime_balance`: bei **Nutzer 18, Monat 2026-01** (Antrag 25),
in Höhe von **exakt einem Tagessoll = 4,00 h**. Das Vorzeichen ist dabei **umgekehrt zur
Erwartung**: die gespeicherte Monatszeile trägt 4,00 h **zu viel**, nicht zu wenig — der
Alt-Abzug ist nicht mehr da, die zugehörige Alt-Gutschrift schon. Nutzer 17 / 2026-04
(Antrag 56) ist **sauber** (0,00 h Bewegung). Nutzer 3 / 2026-09 (Antrag 64) hat **gar
keine Monatszeile mehr** — sie wurde von der Bereinigung aus Plan 14.1-06 als Zukunftszeile
entfernt, dort ist nichts zu bereinigen. Damit ist der Umfang eines etwaigen
Bereinigungsvorgangs (**14.1-U15b**, **14.1-U23**) auf **eine einzige Monatszeile eines
einzigen Nutzers** eingegrenzt, und ihr Betrag ist auf die Stunde genau bekannt.

---

## 2. Wie in diesem Lauf mit Datenbanken umgegangen wurde

Ein zweiter Lauf arbeitete zeitgleich mit einem Dev-Server gegen
`server/database/development.db`. Das Projekt setzt **kein `busy_timeout`**; gleichzeitige
Schreibzugriffe scheitern sofort. Deshalb:

- **Eigene Arbeitskopien.** Jede schreibende Messung lief gegen eine per `VACUUM INTO`
  gezogene Kopie, nie gegen `development.db`. Angelegte Kopien:
  `14-abnahme-auto.db` (aus `development.db`), `14-abnahme-pre14106.db` (aus der Sicherung),
  `14-abnahme-prodkopie-arbeit.db` und `14-abnahme-master-migriert.db` (aus
  `14-produktionskopie.db`), `14-abnahme-prodprobe.db` (aus `14.1-bereinigung-probe.db`),
  `14-abnahme-restore-probe.db` (aus der Sicherung), sowie je eine Wegwerfkopie pro Messung
  (`14-abnahme-p12-9.db`, `-p12-10.db`, `-p12-12.db`, `-p12-23a.db`, `-p12-23b.db`,
  `-p12-44.db`, `-13-u15.db`, `-u15a.db`, `-u16a.db`, `-u25a-jetzt.db`).
- **Eine Ausnahme, offengelegt:** **14-U7** (`npx vitest run`) lief **ohne** gesetztes
  `DATABASE_PATH` und damit gegen `development.db` — so, wie der Prüfweg der Triage ihn
  vorschreibt und wie `vitest.config.ts` es ausdrücklich dokumentiert („alle Tests arbeiten
  auf derselben `database/development.db`"). Alle **weiteren** `vitest`-Läufe (14-U8) wurden
  mit `DATABASE_PATH` auf `14-abnahme-auto.db` umgelenkt.
- **`sqlite3`-CLI ist auf diesem Rechner nicht vorhanden** (`which sqlite3` → nicht
  gefunden). Alle SQL-Abfragen liefen über ein schreibgeschütztes `better-sqlite3`-Helferlein
  (`readonly: true, fileMustExist: true`). Der Prüfweg ist derselbe, nur das Werkzeug ist ein
  anderes.

### Die drei Beweisdatenbanken sind unverändert

Gemessen **vor** und **nach** dem gesamten Lauf, Größe, Änderungszeitpunkt und SHA-256:

| Datei | Bytes | Änderungszeitpunkt | SHA-256 (vorher = nachher) |
|---|---:|---|---|
| `14-produktionskopie.db` | 1.286.144 | 23.08.2026 02:11:35 | `50D5E61A0621836A73A885CE1DB60315C221E943F0DB22C43139D013ADCB8A9B` |
| `14-prod-nach-migration.db` | 1.323.008 | 23.08.2026 11:58:36 | `DC233EA14D825852F15050DBB86FEC61833BC6EA89E53ACFAFE9D673A04C982E` |
| `14-generalprobe.db` | 1.331.200 | 23.08.2026 02:41:29 | `82DD315FAD11F8BAB86C7F6366EE825E229F68C68BB8F1CAEA3EACA8A5731158` |

Alle drei Werte stimmen mit der Messung vom Beginn des Laufs überein. **Keine der drei
Dateien wurde bewegt.**

---

## 3. Block 0 — ohne Server, ohne Datenbankkopie

### 14-U7 — B-2-Sicherheitsfix ist durch neue Tests belegt · **BESTANDEN**

Prüfung: der vollständige Server-Testlauf; die Menge der roten Tests muss unverändert sein.

```
cd server && npx vitest run
```

Ausgabe (Schluss, wörtlich):

```
 FAIL  src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > ... > should respect hire date and not include pre-employment months
AssertionError: expected 40 to be 10 // Object.is equality
 ❯ src/services/unifiedOvertimeService.test.ts:285:39

 FAIL  src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > REGRESSION: User hired on 1st of month should calculate correctly
AssertionError: expected 40 to be 10 // Object.is equality
 ❯ src/services/unifiedOvertimeService.test.ts:340:39

 FAIL  src/services/vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill
AssertionError: expected true to be false // Object.is equality
 ❯ src/services/vacationBackfillService.test.ts:138:35

 Test Files  2 failed | 42 passed (44)
      Tests  3 failed | 562 passed (565)
```

Urteil: **BESTANDEN.** Die drei roten Titel sind **wörtlich** dieselben drei, die
`14-REQ32-NACHWEIS.md` (Gate 3) und `11-AUSGANGSZUSTAND.md` als vorbestehend führen — kein
vierter roter Test, keine Titeländerung.

**Abweichung zur Erwartung der Triage, benannt statt verrechnet:** Die Triage erwartet
„491 grün / 3 rot". Gemessen sind **562 grün / 3 rot** bei 44 statt 36 Testdateien. Die grüne
Zahl ist gewachsen, weil die Phasen 14 und 14.1 Testdateien hinzugefügt haben
(`overtimeFutureCapping`, `absenceDeletionRecalc`, `sickLeaveRecalc`,
`historicalExportFiltering`, `overtimeCompSingleTrace`, `overtimeCompFutureCommitment`).
Das Abnahmekriterium ist die **unveränderte rote Menge**, und die ist erfüllt.

### 14-U8 — REQ-32: fünf Wechselfälle einzeln nachgewiesen · **BESTANDEN**

Prüfung: jeden der fünf Fälle aus `14-REQ32-NACHWEIS.md` einzeln benannt laufen lassen.

```
cd server && DATABASE_PATH=<…>/server/database/14-abnahme-auto.db npx vitest run -t "<Titel>"
```

Ausgabe je Fall (wörtlich, die beiden Ergebniszeilen):

| Fall | `-t "<Titel>"` | Ausgabe |
|---|---|---|
| 1 Reduzierung, Stichtag Zukunft | `REQ-28: Ein Stichtag in der Zukunft laesst jede Buchung davor unveraendert und erzeugt keine model_change-Buchung` | `Test Files  1 passed \| 43 skipped (44)` / `Tests  1 passed \| 564 skipped (565)` |
| 2 Erhöhung, rückwirkend | `REQ-32: Eine Erhoehung der Wochenstunden mit rueckwirkendem Stichtag senkt den Saldo und laesst jede Buchung vor dem Stichtag unveraendert` | `Test Files  1 passed \| 43 skipped (44)` / `Tests  1 passed \| 564 skipped (565)` |
| 3 Stichtag mitten im Monat | `Stichtag mitten im Monat: midMonthEffective ist true, ein Tag davor traegt das alte, ein Tag ab dem Stichtag das neue Tagessoll` | `Test Files  1 passed \| 43 skipped (44)` / `Tests  1 passed \| 564 skipped (565)` |
| 4 Jahreswechsel | `Wechsel ueber einen Jahreswechsel: affectedMonths deckt zwei Kalenderjahre ab, der Lauf endet ohne Fehler` | `Test Files  1 passed \| 43 skipped (44)` / `Tests  1 passed \| 564 skipped (565)` |
| 5 Löschen und neu rechnen | `Zusicherung A/B/C/D` | `Test Files  1 passed \| 43 skipped (44)` / `Tests  1 passed \| 564 skipped (565)` |

Urteil: **BESTANDEN.** Fünf Einzelläufe, je genau **1 passed**, kein Fehlschlag.

### P12-4a — `ConfirmDialog`: X-Button trägt einen zugänglichen Namen · **BESTANDEN**

```
cd desktop && npx tsx src/components/ui/confirmDialogProps.check.ts
```

```
PASS: Rueckwaertskompatibilitaet: bisherige Pflichtfelder allein ergeben gueltige ConfirmDialogProps (Compiler-Beweis)
PASS: isConfirmButtonDisabled: vier Wertekombinationen
PASS: shouldCloseAfterConfirm: zwei Wertekombinationen plus Default

3 Tests bestanden.
```

Urteil: **BESTANDEN** (Exit 0, keine `FAIL:`-Zeile).

### 13-U3a — Sperrregeln der Löschbestätigung · **BESTANDEN**

```
cd desktop && npx tsx src/components/worktime/workTimePeriodDeleteRules.check.ts
```

Ausgabe (gekürzt auf die beiden für 13-U3a tragenden Zusicherungen und das Ergebnis):

```
PASS: deleteDetailRebuild: Saldoänderung ungleich null
PASS: deleteDetailRebuild: Saldoänderung gleich null
PASS: isDeleteConfirmDisabled deckt alle acht Kombinationen korrekt ab

19 Tests bestanden.
```

Urteil: **BESTANDEN.** `isDeleteConfirmDisabled` belegt den Sperrzustand über **alle acht**
Wertekombinationen — darin enthalten „Vorschau lädt" und „Begründung < 10 Zeichen".

### 13-U13 — `aria-label` des Löschbestätigungsknopfs nennt die Periode konkret · **BESTANDEN**

Derselbe Lauf wie 13-U3a; die tragende Zeile:

```
PASS: deleteConfirmAriaLabel liefert den vollständigen Satz mit Datum
```

Urteil: **BESTANDEN.** Der gebildete Name trägt das Periodendatum, nicht nur „Bestätigen".

### Zusatz (Regelteil von 14-U5a, in der Tabelle als `AS` geführt) · beide grün

```
cd desktop && npx tsx src/components/worktime/workTimePeriodEditRules.check.ts   → 25 Tests bestanden.
cd desktop && npx tsx src/components/worktime/overtimeTransactionFormat.check.ts → 17 Tests bestanden.
```

Darin wörtlich enthalten die M-1- und M-3-Zusicherungen aus 14-U5a:

```
PASS: M-3: eine zu kurze Begründung sperrt den Primärknopf nicht mehr stumm
PASS: M-1: die frühere Clientrechnung allein hält den Zukunftsfall für harmlos
PASS: M-1: Beginn einer vergangenen Periode in die Zukunft verschoben → rückwirkend (Vorschau)
PASS: M-1: eine Vorschau mit isRetroactive=false wird nicht clientseitig überstimmt
```

Der Punkt selbst bleibt `AUTO-MIT-SERVER`, weil M-1 zusätzlich die Server-Vorschau gegen den
Dialogzustand stellen soll; sein **Regelteil** ist hiermit belegt.

### Zusatz (Beleg zu 14.1-U10, Kategorie `ENTSCHEIDUNG`) · grün

```
cd server && npx vitest run sickLeaveRecalc
```

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Enthalten sind die drei in 14.1-U10 genannten Tests 2 bis 4:
`Test 2: Die Auto-Genehmigung bleibt unveraendert — approved, ohne Genehmiger und ohne Zeitstempel`,
`Test 3: Das Anlegen einer Krankmeldung erzeugt keinen Protokolleintrag`,
`Test 4: Ein Urlaubsantrag bleibt pending und erzeugt beim Anlegen keine Journalzeilen`.

### 14.1-U30a — Alle fünf neuen Testdateien schließen Zukunftsdaten aus · **NICHT BESTANDEN**

Prüfung: die fünf in Phase 14.1 neu angelegten Testdateien nach dem gleichlautenden
Zukunftsausschluss durchsuchen. Erwartet: **fünf** Treffer.

Zuerst die fünf Dateien bestimmt (nicht aus der Prosa übernommen):

```
git log --oneline --since="2026-08-24" --name-status --diff-filter=A -- "server/src/**/*.test.ts"
A	server/src/services/absenceDeletionRecalc.test.ts
A	server/src/services/historicalExportFiltering.test.ts
A	server/src/services/overtimeCompFutureCommitment.test.ts
A	server/src/services/overtimeCompSingleTrace.test.ts
A	server/src/services/overtimeFutureCapping.test.ts
A	server/src/services/sickLeaveRecalc.test.ts
```

Sechs Dateien; `overtimeCompFutureCommitment.test.ts` gehört laut 14.1-U36 zum späteren
CR-01-Nachtrag und ist ausdrücklich **die erste** mit einem Zukunftstag — die fünf gemeinten
sind die übrigen.

```
grep -n -i -E "zukunft|future|< TODAY|Vergangenheit" <je Datei>
```

| Datei | Zukunftsausschluss vorhanden? | Beleg |
|---|---|---|
| `absenceDeletionRecalc.test.ts` | **ja** | `214: expect(day < TODAY).toBe(true)`, `249: expect(day < TODAY).toBe(true)`, Kommentar Z. 66-67 |
| `sickLeaveRecalc.test.ts` | **ja** | `226: expect(day < TODAY).toBe(true)`, `227: expect(PREV_MONTH_END < TODAY).toBe(true)` |
| `overtimeCompSingleTrace.test.ts` | **ja** | `276: expect(compDay < TODAY).toBe(true)`, Kommentar Z. 65-66 |
| `overtimeFutureCapping.test.ts` | **nein** | `159: const FUTURE_END = MONTH_END > TODAY ? …` und `167: expect(FUTURE_END > TODAY).toBe(true)`; drei der vier Tests rufen bewusst **mit** `FUTURE_END` auf (Test 1 „…fuer ein Monatsende in der Zukunft…", Test 2, Test 4) |
| `historicalExportFiltering.test.ts` | **nein** | `209-210: FUTURE_END / FUTURE_MONTH`; Test 4 legt mit `insertOvertimeBalance(aktivId, FUTURE_MONTH, 20, 0)` eine **echte Zukunftszeile** an und sichert deren Ausschluss zu |

Urteil: **NICHT BESTANDEN.** Gemessen sind **3 von 5** Treffern, nicht fünf. Der
Querschnittsbefund des Prüfers trifft für drei Dateien zu. Für die beiden anderen trifft er
nicht zu: Sie enthalten den Zukunftsfall ausdrücklich — allerdings **nur als
Zeitraumgrenze bzw. als Monatsaggregatzeile**, nicht als Ausgleichstag oder Antrag in der
Zukunft. Die Aussage von 14.1-U36 („für CR-06 und die übrigen Zukunftsfälle besteht die
Lücke unverändert fort") bleibt davon unberührt und ist die genauere Formulierung.

### P12-49 — Typ-Spalte des Kontoauszugs zeigt Rohwerte · **BESTANDEN** (Befund bestätigt sich)

Der Prüfweg der Triage (`SELECT DISTINCT referenceType`) trägt hier **nicht**: `referenceType`
ist die Bezugsspalte, die Typ-Spalte des Kontoauszugs heißt `type`, und der Kontoauszug wird
zudem live gerechnet statt aus der Tabelle gelesen. Deshalb zwei Messungen — die Tabelle
**und** die Quelle, aus der die Oberfläche tatsächlich speist.

```
SELECT type, COUNT(*) c FROM overtime_transactions GROUP BY type ORDER BY 1;   -- 14-abnahme-auto.db
{"type":"overtime_comp_credit","c":1}
{"type":"sick_credit","c":19}
{"type":"time_entry","c":2552}
{"type":"unpaid_deduction","c":2}
{"type":"vacation_credit","c":47}
```

```
server/src/services/overtimeLiveCalculationService.ts:114
  type: 'time_entry' | 'feiertag' | 'vacation_credit' | 'sick_credit' | 'overtime_comp_credit'
      | 'special_credit' | 'unpaid_deduction' | 'correction' | 'model_change';
```

```
desktop/src/hooks/useWorkTimeAccounts.ts:231-241 (OvertimeTransactionRow.type)
  'earned' | 'feiertag' | 'compensation' | 'correction' | 'carryover' | 'vacation_credit'
| 'sick_credit' | 'overtime_comp_credit' | 'special_credit' | 'unpaid_adjustment' | 'model_change'
```

```
desktop/src/components/worktime/OvertimeTransactions.tsx:137-152 (getTypeLabel)
      case 'earned': return 'Überstunden';
      … (elf Fälle) …
      case 'model_change': return 'Modellwechsel';
      default: return type;
```

Urteil: **BESTANDEN.** Der Server liefert `time_entry` und `unpaid_deduction`; beide fehlen
sowohl in der Typ-Union des Desktops als auch in `getTypeLabel`. Der `default`-Zweig gibt
dann den Rohwert zurück. Im Bestand tragen **2.552** Journalzeilen `time_entry` und **2**
`unpaid_deduction` — der Befund bestätigt sich, und zwar am Quelltext, nicht nur an den Daten.

---

## 4. Block 1 — gegen `development.db` und die vorhandenen Sicherungen

### 14.1-U1a — Zeitkonto-Saldo = Summe der Buchungen · **BESTANDEN**

```
cd server && DATABASE_PATH=<…>/14-abnahme-auto.db npx tsx src/scripts/verifyBalanceVsJournal.ts
```

```
### NUR LESEND — dieses Werkzeug schreibt nichts ###
Heute (Berlin):            2026-08-25
Zeitraum von/bis:          2026-08-01 bis 2026-08-31
Zukunftsfenster:           2026-08-31 liegt hinter heute — BL-01 ist in diesem Lauf messbar.

  userId   SummeJournal   SaldoMonat   SaldoHeute   Zukunftsdiff   JournalDiff
      18          -9.00        -9.00        -9.00           0.00          0.00
      20         -23.80       -23.80       -23.80           0.00          0.00
      21         -17.00       -17.00       -17.00           0.00          0.00
      25         -27.20       -27.20       -27.20           0.00          0.00

Nutzer mit Zukunftsdiff ungleich 0,00 h (BL-01):        0
Nutzer mit JournalDiff  ungleich 0,00 h (Gutschriften): 3
ERGEBNIS: BL-01 GESCHLOSSEN — fuer jeden aktiven Nutzer ist die Zukunftsdiff 0,00 h.
```

Urteil: **BESTANDEN.** Für die vier genannten Nutzer 18, 20, 21 und 25 ist die Differenz
**0,00 h** — vor dem Fix waren es bei 18 20,00 h und bei 25 6,40 h.

Nebenbefund im selben Lauf, der die Zahl aus 14.1-U4 bestätigt: genau **3** Nutzer tragen
noch eine `JournalDiff` ≠ 0 — Nutzer 3 (4,00 h), 16 (30,00 h), 17 (8,00 h). Das ist die unter
14.1-U3 beschriebene zweite Ursache (fehlende Soll-Gegenbuchung zu Abwesenheits-Gutschriften),
nicht BL-01.

### 14.1-U21a — Testnutzer 15015 · **BESTANDEN**

```
SELECT date('now');                                                          -- 14-abnahme-auto.db
{"heute":"2026-08-25"}
SELECT COUNT(*), ROUND(SUM(hours),2) FROM overtime_transactions WHERE userId=15015 AND date > date('now');
{"journalzeilen_15015":30,"summe":-88}
SELECT COUNT(*) FROM overtime_balance WHERE userId=15015 AND month > strftime('%Y-%m', date('now'));
{"monatszeilen_15015":1}
SELECT COUNT(*) FROM overtime_balance WHERE userId=15015;
{"monatszeilen_15015_gesamt":2}
```

Urteil: **BESTANDEN.** 30 Journalzeilen mit Zukunftsdatum, `SUM(hours) = −88`, **eine**
Monatszeile in der Zukunft (2026-09), zwei insgesamt — exakt die Erwartung.

### 14.1-U25a — Keine Zukunftsbuchung mehr bei 3, 17, 30 · **BESTANDEN**

Teil 1 — Zählung:

```
SELECT userId, COUNT(*) FROM overtime_transactions WHERE userId IN (3,17,30) AND date > date('now') GROUP BY userId;
(0 Zeilen)
SELECT userId, COUNT(*) FROM overtime_transactions WHERE date > date('now') GROUP BY userId;
{"userId":15015,"c":30}
```

Vorher waren es 38, 32 und 30 Buchungen. Im gesamten Bestand trägt heute **nur noch** der
ausgenommene Testnutzer 15015 Zukunftszeilen.

Teil 2 — Saldenvergleich gegen die Sicherung:

```
cd server
DATABASE_PATH=<…>/14-abnahme-restore-probe.db npx tsx src/scripts/snapshotBalances.ts --all --asOf=2026-08-25 --json=<…>/u25a_sicherung.json
DATABASE_PATH=<…>/14-abnahme-u25a-jetzt.db    npx tsx src/scripts/snapshotBalances.ts --all --asOf=2026-08-25 --json=<…>/u25a_jetzt.json
```

```
Nutzer in der Sicherung: 30 | im heutigen Bestand: 34
Zusaetzliche Nutzer heute: [48714,48715,48716,48717]
Nutzer mit Saldendifferenz != 0,00 h: 0 von 30 (fehlend: 0)
```

Urteil: **BESTANDEN.** **0 von 30** Nutzern haben zwischen der Sicherung vor der Bereinigung
und dem heutigen Bestand eine Saldendifferenz ≠ 0,00 h. Die vier zusätzlichen Nutzer
48714–48717 stammen aus dem parallel laufenden Test-/Serverlauf und gehören nicht zur
Vergleichspopulation.

### 14.1-U20a — Wie viele fiktive Journalbuchungen gibt es wirklich? · **BESTANDEN**

Der Trockenlauf muss gegen einen Bestand **vor** der Bereinigung laufen; `development.db` ist
bereits bereinigt. Arbeitskopie deshalb aus der Sicherung gezogen:

```
node q.mjs server/database/backups/development.PRE-14.1-06_20260825_070544.db \
  "VACUUM INTO '<…>/server/database/14-abnahme-pre14106.db'"
cd server && DATABASE_PATH=<…>/14-abnahme-pre14106.db npx tsx src/scripts/purgeFutureOvertimeRows.ts
```

```
### TROCKENLAUF — es wird nichts geschrieben ###

=== Fundliste overtime_transactions (je Nutzer und Monat) ===
  userId=    3 2026-09  Zeilen=  38  davon hours!=0:   13  SUM(hours)=-20
  userId=   17 2026-09  Zeilen=  32  davon hours!=0:   15  SUM(hours)=-44
  userId=   30 2026-10  Zeilen=  30  davon hours!=0:   22  SUM(hours)=-176
  Summe: 100 Zeilen, davon 50 mit hours != 0, SUM(hours)=-240

=== Fundliste overtime_balance ===
  Summe: 3 Monatszeilen.

=== Abweichung zur Zahl 59 ===
  Der Roadmap-Befund nennt 59 fiktive Journalbuchungen.
  Unter dem oben festgelegten Praedikat gefunden: 100 Zeilen, davon 50 mit hours != 0.
  Die Zahl 59 ist mit keiner der beiden Abgrenzungen deckungsgleich (59 != 100 und 59 != 50).

=== Ausnahmeliste — Zeilen mit Zukunftsdatum, die bleiben ===
  (a) durch den Nutzerausschluss (userId IN 15015):
      userId=15015 2026-09 time_entry  Zeilen=  30 … SUM(hours)= -88
      Summe ausgenommen: 30 Journalzeilen, 1 Monatszeilen.
  (b) durch den Typfilter (book-once-Typen, insbesondere model_change):
      keine
```

Urteil: **BESTANDEN.** **100** Journalzeilen, davon **50** mit Wert ≠ 0, plus **30**
ausgenommene Zeilen des Testnutzers 15015 = **130** einschließlich. Genau die drei erwarteten
Zahlen.

### 14.1-U27a — Der Trockenlauf schreibt Schema-DDL, aber keine Daten · **BESTANDEN**

Prüfsummen und Zeilenzahlen der fünf nach D-08 geschützten Tabellen, unabhängig gemessen
(gleiches Verfahren: `SELECT * … ORDER BY id`, SHA-256 über die JSON-Darstellung), **vor**
und **nach** genau dem Trockenlauf aus 14.1-U20a — zusätzlich der SHA-256 der Datei selbst.

```
Datei-SHA256 vorher:  cefdcd9a06ae983bbe1b7a1e004977e71469e22b04abe703f5ad4327ec11a012

=== D-08 VORHER (eigene Messung) ===
  time_entries           Zeilen=  853  sha256=92c49946f92a49ab8b1c6f77cd62d29a5bcded010cfcf224abf4cbb2b9afcda0
  absence_requests       Zeilen=   55  sha256=4f4cb172ee225a83517b4a6b120e340c75fb414fd2d74695ba900fd28694ba7a
  overtime_corrections   Zeilen=    5  sha256=cbd2fb1c22c80eabb29b1d240ccecef0c4766ca4f05ae96cf4c10d0bdd793a78
  vacation_balance       Zeilen=   59  sha256=07af11e6f2225f58843f1f66143cff5bc243513454917f5049ff044262bb21c3
  vacation_transactions  Zeilen=   70  sha256=2d3b14965437d3aee15c0f171fd0c244e38720002b014c307a6b18e9e143a811

=== D-08 NACHHER (eigene Messung) ===
  time_entries           Zeilen=  853  sha256=92c49946f92a49ab8b1c6f77cd62d29a5bcded010cfcf224abf4cbb2b9afcda0
  absence_requests       Zeilen=   55  sha256=4f4cb172ee225a83517b4a6b120e340c75fb414fd2d74695ba900fd28694ba7a
  overtime_corrections   Zeilen=    5  sha256=cbd2fb1c22c80eabb29b1d240ccecef0c4766ca4f05ae96cf4c10d0bdd793a78
  vacation_balance       Zeilen=   59  sha256=07af11e6f2225f58843f1f66143cff5bc243513454917f5049ff044262bb21c3
  vacation_transactions  Zeilen=   70  sha256=2d3b14965437d3aee15c0f171fd0c244e38720002b014c307a6b18e9e143a811

Datei-SHA256 nachher: 45883e68337efb19e614a38c3851b78b6eb684ed7ca4fffa12dbaf55fd7acd73
```

Ergänzend geprüft, ob die DDL neue Schemaobjekte anlegt:

```
diff <(sqlite_master der Sicherung) <(sqlite_master der Kopie nach dem Lauf)
SCHEMA-OBJEKTE IDENTISCH
```

Urteil: **BESTANDEN.** Beide Hälften des Befunds sind belegt: **die Daten der fünf
geschützten Tabellen sind unverändert** (Zeilenzahl und Prüfsumme in allen fünf Fällen
identisch), **die Datei ist es nicht** — ihr SHA-256 ändert sich durch den „Trockenlauf".
Die Zusage „es wird nichts geschrieben" trifft also für Daten zu und für die Datei nicht.

### 14.1-U28a — Die drei gelöschten Zeilen trugen `carryoverFromPreviousYear = 0` · **BESTANDEN**

```
SELECT id, userId, month, carryoverFromPreviousYear, targetHours, actualHours, overtime
  FROM overtime_balance WHERE id IN (61245, 31769, 34406);
  -- gegen server/database/backups/development.PRE-14.1-06_20260825_070544.db, readonly
```

```
{"id":31769,"userId":17,"month":"2026-09","carryoverFromPreviousYear":0,"targetHours":52,"actualHours":8,"overtime":-44}
{"id":34406,"userId":3,"month":"2026-09","carryoverFromPreviousYear":0,"targetHours":36,"actualHours":16,"overtime":-20}
{"id":61245,"userId":30,"month":"2026-10","carryoverFromPreviousYear":0,"targetHours":176,"actualHours":0,"overtime":-176}
```

Urteil: **BESTANDEN.** Alle drei Zeilen tragen den Wert **0** — durch das Löschen ist kein
Übertrag verloren gegangen.

### 14.1-U15a — Steht bei den Anträgen 25, 56, 64 heute noch ein Alt-Abzug? · **BESTANDEN**

**Das ist die Messung, die Plan 14.1-06 ausdrücklich ausgelassen hat.** Sie wurde in drei
voneinander unabhängigen Schritten geführt.

**Schritt 1 — die drei Anträge und ihre Monate feststellen** (nicht aus der Prosa übernommen):

```
SELECT id, userId, type, startDate, endDate, days, status, approvedBy, approvedAt
  FROM absence_requests WHERE id IN (25,56,64);
```

```
{"id":25,"userId":18,"type":"overtime_comp","startDate":"2026-01-02","endDate":"2026-01-02","days":1,"status":"approved","approvedBy":16,"approvedAt":"2026-01-14 11:27:51"}
{"id":56,"userId":17,"type":"overtime_comp","startDate":"2026-04-13","endDate":"2026-04-13","days":1,"status":"approved","approvedBy":16,"approvedAt":"2026-04-14 06:06:02"}
{"id":64,"userId":3,"type":"overtime_comp","startDate":"2026-09-29","endDate":"2026-09-29","days":1,"status":"approved","approvedBy":16,"approvedAt":"2026-06-12 09:28:15"}
```

```
SELECT id, firstName, lastName, weeklyHours, hireDate, deletedAt FROM users WHERE id IN (18,17,3);
{"id":3,"firstName":"Christine","lastName":"Glas","weeklyHours":8,"hireDate":"2026-01-01","deletedAt":null}
{"id":17,"firstName":"Carmen","lastName":"Rothemund","weeklyHours":12,"hireDate":"2026-01-01","deletedAt":null}
{"id":18,"firstName":"Silvia","lastName":"Lachner","weeklyHours":20,"hireDate":"2026-01-01","deletedAt":null}
```

**Begründete Abweichung vom Prüfweg der Triage:** Die Triage sagt „die Monatszeilen der drei
Ausgleichstage lesen". Der entfernte Weg schrieb aber nach dem **FIFO**-Prinzip in den
**ältesten Monat mit positivem Saldo** — nicht in den Monat des Ausgleichstags. Der Nachweis
am Quelltext des entfernten Codes (`git show 24bfb75 -- server/src/services/absenceService.ts`):

```
-function deductOvertimeHours(userId: number, hours: number): void {
-  const query = `
-    SELECT * FROM overtime_balance
-    WHERE userId = ? AND overtime > 0
-    ORDER BY month ASC
-  `;
-  // Deduct from oldest months first (FIFO)
-      SET actualHours = actualHours - ?
```

Eine Messung, die nur den Ausgleichsmonat betrachtet, könnte den Rest deshalb übersehen.
Gemessen wurden daher **alle acht Monatszeilen jedes der drei Nutzer**.

**Schritt 2 — kanonischer Rechenweg gegen die gespeicherte Monatszeile** (24 Einzelläufe):

```
cd server && DATABASE_PATH=<…>/14-abnahme-auto.db \
  npx tsx src/scripts/validateOvertimeDetailed.ts --userId=<18|17|3> --month=<2026-01 … 2026-09>
```

Alle 24 Vergleiche, nur die Zeilen mit Abweichung (Spalten: Calculated | Database):

```
u=18 m=2026-01
| Actual Hours (Ist)     |      89.75h  |      93.75h  | ❌     |
u=17 m=2026-08
| Target Hours (Soll)    |      44.00h  |      36.00h  | ❌     |
| Actual Hours (Ist)     |      38.75h  |      34.75h  | ❌     |
u=3  m=2026-08
| Target Hours (Soll)    |      32.00h  |      24.00h  | ❌     |
u=18/17/3 m=2026-09
| Target Hours (Soll)    |      …       |        N/Ah  | ❌     |   (keine Zeile vorhanden)
```

Alle **übrigen 19** Monatszeilen stimmen auf den Cent mit dem kanonischen Wert überein.

**Schritt 3 — Gegenprobe durch Neuberechnung** (auf einer Wegwerfkopie
`14-abnahme-u15a.db`; die vorgesehenen Werkzeuge `recalculate:overtime` und
`refresh:overtime` tragen hier nicht — das erste greift nur Nutzer mit `username LIKE
'test.%'`, das zweite nur Nutzer mit Korrekturen; deshalb der kanonische Schreibweg
`updateMonthlyOvertime()` direkt, für jeden der drei Nutzer und jeden Monat 2026-01 … 2026-08):

```
userId  month     targetVorher targetNachher   istVorher  istNachher   DIFF(ist)  DIFF(soll)
     3  2026-08            24            32       24.51       24.51           0           8   <== BEWEGT
    17  2026-08            36            44       34.75       38.75           4           8   <== BEWEGT
    18  2026-01            84            84       93.75       89.75          -4           0   <== BEWEGT
   (alle 21 uebrigen Zeilen: DIFF(ist)=0  DIFF(soll)=0)

Zeilen vorher: 24, nachher: 24, davon bewegt: 3
```

Zweiter Lauf desselben Skripts unmittelbar danach:

```
Zeilen vorher: 24, nachher: 24, davon bewegt: 0
```

Die Neuberechnung ist damit **idempotent** — die drei Bewegungen des ersten Laufs sind echte
Altstände, kein Hin- und Herschwingen.

**Urteil: BESTANDEN — die Messung ist geführt. Das Ergebnis im Einzelnen:**

| Antrag | Nutzer | Ausgleichstag | Monatszeile | Bewegung bei Neuberechnung | Befund |
|---|---|---|---|---|---|
| 25 | 18 (Lachner, 20 h/Woche → **4,00 h Tagessoll**) | 2026-01-02 | 2026-01 vorhanden | `actualHours` **93,75 → 89,75 h**, also **−4,00 h** | **Rest vorhanden**, Betrag **exakt ein Tagessoll**, Vorzeichen **umgekehrt**: die Zeile steht 4,00 h **zu hoch** |
| 56 | 17 (Rothemund) | 2026-04-13 | 2026-04 vorhanden | **0,00 h** | **kein Rest** |
| 64 | 3 (Glas) | 2026-09-29 | 2026-09 **nicht vorhanden** | — | **nichts zu bereinigen** — die Monatszeile wurde von der Bereinigung aus Plan 14.1-06 als Zukunftszeile entfernt (id 34406, siehe 14.1-U28a) |

**Was das für 14.1-U15b bedeutet:** Ein Bereinigungsvorgang wäre nötig für **genau eine
Monatszeile** — Nutzer 18, Monat 2026-01, `actualHours` von 93,75 h auf 89,75 h. Der Umfang
ist damit kleiner als bei der Formulierung der Frage vermutet („drei Nutzer/Monate"), und die
Wirkung ist auf 4,00 h beziffert. Ein Eingriff wäre auch **ohne eigenes Löschwerkzeug**
möglich: ein einzelner `updateMonthlyOvertime(18, '2026-01')`-Aufruf stellt die Zeile
nachweislich richtig, ohne eine andere Zeile zu bewegen (21 von 24 Zeilen blieben im obigen
Lauf unangetastet). Die volle D-06-Ordnung (Sicherung → Trockenlauf → Prüfung → `--apply` →
Wiederherstellungsnachweis) bleibt davon unberührt.

**Was das für 14.1-U23 bedeutet:** Die Wiedervorlage kann entschieden werden. Der Rest ist
**nicht saldowirksam auf dem kanonischen Weg** — `validateOvertimeDetailed` und
`unifiedOvertimeService` rechnen den richtigen Wert (89,75 h); falsch ist nur das
**abgeleitete Aggregat** `overtime_balance`, aus dem der Kontoauszug seinen fetten
Saldo und der Historien-Export seine Kennzahl zieht. Der Rest heilt sich bei der nächsten
Neuberechnung dieses Monats von selbst — der nächtliche Lauf ist allerdings seit dem
23.08.2026 angehalten, weshalb er heute noch steht. Ein eigener Vorgang ist also eine
**Termin-, keine Datenintegritätsfrage**.

**Neuer Befund im selben Lauf** (siehe Abschnitt 7, NB-A): Die 2026-08-Zeilen der Nutzer 3
und 17 stehen ebenfalls falsch (Soll je 8,00 h zu niedrig, bei Nutzer 17 zusätzlich Ist
4,00 h zu niedrig). Das ist **nicht** der Alt-Abzug — die Bewegung liegt nicht am
Ausgleichstag und betrifft den laufenden Monat.

### 14.1-U14a — `totalOvertime` im Historien-Export ist jetzt richtig · **BESTANDEN**

Gegen die Produktionsarbeitskopie (Wegwerfkopie aus `14.1-bereinigung-probe.db`), weil die
Erwartung „+105,75 h" auf dem Produktionsbestand erhoben wurde:

```
cd server && DATABASE_PATH=<…>/14-abnahme-prodprobe.db npx tsx <export.ts> 2025-01-01 2026-12-31
```

```
=== 14.1-U14a — totalOvertime im Historien-Export ===
Zeitraum: 2025-01-01 .. 2026-12-31
Nutzer im Export: 15
statistics.totalOvertime = 105.74999999999997
Gegenrechnung SQL (aktive Nutzer, Monat <= 2026-08): Summe=105.75 aus 115 Zeilen
DIFFERENZ Export - SQL: 0
Zum Vergleich OHNE beide Filter (Altstand): Summe=-2714.21 aus 141 Zeilen
```

Urteil: **BESTANDEN.** Die Kennzahl steht auf **+105,75 h** und stimmt mit einer unabhängigen
SQL-Gegenrechnung (aktive Nutzer, kein Zukunftsmonat) auf 0,00 h überein.

Die dokumentierte Altzahl **−2.954,21 h** lässt sich aus dieser Messung herleiten und ist
damit ebenfalls bestätigt: −2.714,21 h (ohne beide Filter, nach der Bereinigung) minus die
drei von der Bereinigung entfernten Zukunftsmonatszeilen (−20 −44 −176 = −240 h) ergibt
genau −2.954,21 h.

Zur Einordnung dieselbe Messung gegen `development.db` (Arbeitskopie): dort
`totalOvertime = −2631` bei ebenfalls **0,00 h** Differenz zur SQL-Gegenrechnung. Die andere
Zahl kommt allein von den lokalen Testnutzern 15015–15024, nicht von der Kennzahl.

### 14.1-U16a — `compensation`-Belegzeile überlebt eine Neuberechnung · **BESTANDEN**

Im Bestand gibt es heute **keine** `compensation`-Zeile (14.1-U19: die drei alten wurden vor
dem Rebuild-Fix gelöscht und werden nach D-04 nicht rückwirkend erzeugt). Die Messung legt
deshalb auf einer Wegwerfkopie einen neuen Ausgleich an und misst an ihm:

```
cd server && DATABASE_PATH=<…>/14-abnahme-u16a.db npx tsx <u16a.ts> 16 1 2026-08-12
```

```
Bestand VOR dem Versuch: compensation-Zeilen im ganzen Journal = 0
userId=16 Ausgleichstag=2026-08-12 (Monat 2026-08)
Saldo vor der Genehmigung: 20
Antrag 11183 angelegt und genehmigt.
NACH GENEHMIGUNG: compensation-Zeilen=1 [{"id":573755,"date":"2026-08-12","type":"compensation","hours":-6,"description":"Überstunden-Ausgleich 2026-08-12 - 2026-08-12"}]
NACH GENEHMIGUNG: Saldo=8
--- erzwungene Neuberechnung updateMonthlyOvertime(16, '2026-08')
NACH NEUBERECHNUNG: compensation-Zeilen=1 [{"id":573755,"date":"2026-08-12","type":"compensation","hours":-6,"description":"Überstunden-Ausgleich 2026-08-12 - 2026-08-12"}]
NACH NEUBERECHNUNG: Saldo=8
Zeilen vorher/nachher: 1 / 1
Saldodifferenz durch die Neuberechnung: 0 h
```

Urteil: **BESTANDEN.** **1 Zeile vor und 1 Zeile nach** der Neuberechnung, dieselbe `id`,
Saldodifferenz **0,00 h** — genau die Erwartung.

### 14.1-U29a — CR-04, CR-05, CR-06 einzeln nachmessen · **BESTANDEN** (alle drei bestätigen sich)

**CR-04 — der Historien-Export filtert die Sammelvariante nicht nach Nutzer.**
Gemessen als Abgleich jeder Ergebnisliste gegen die Nutzerliste desselben Exports:

Gegen die Produktionsarbeitskopie:

```
timeEntries:     712 Zeilen, davon zu NICHT gelisteten Nutzern: 102 (userIds [15])
absences:         28 Zeilen, davon zu NICHT gelisteten Nutzern:   1 (userIds [15])
vacationBalance:  25 Zeilen, davon zu NICHT gelisteten Nutzern:   6 (userIds [15,31,30,28,26])
overtimeBalance: 115 Zeilen, davon zu NICHT gelisteten Nutzern:   0 (userIds [])
```

Gegen `development.db` (Arbeitskopie):

```
timeEntries:     853 Zeilen, davon zu NICHT gelisteten Nutzern: 102 (userIds [15])
absences:         40 Zeilen, davon zu NICHT gelisteten Nutzern:   1 (userIds [15])
vacationBalance:  44 Zeilen, davon zu NICHT gelisteten Nutzern:   3 (userIds [15,26])
overtimeBalance: 150 Zeilen, davon zu NICHT gelisteten Nutzern:   0 (userIds [])
```

**CR-04 bestätigt sich.** `overtime_balance` trägt den Nutzerfilter (0 Fremdzeilen),
`timeEntries`, `absences` und `vacationBalance` tragen ihn nicht. Die Zahl **102
Zeiteinträge und 1 Antrag** aus 14.1-U11 reproduziert sich exakt; **neu gemessen** ist
zusätzlich `vacation_balance` mit 6 bzw. 3 Fremdzeilen — der Punkt 14.1-U11 nennt diese
Tabelle in seiner Zahl noch nicht.

**CR-05 — die D-08-Prüfsummen werden gedruckt, nicht verglichen, und erst nach dem Commit.**
Am Quelltext nachgeprüft (`server/src/scripts/purgeFutureOvertimeRows.ts`):

```
503:  printProtectedTables('vor dem Lauf', measureProtectedTables(db));
529:  const runPurge = db.transaction(() => { … });
533:  runPurge();                                   ← hier wird festgeschrieben
598:  printProtectedTables('nach dem Lauf', measureProtectedTables(db));
604:  if (restJournal.c !== 0 || restBalance.c !== 0) { … process.exit(1); }
```

`measureProtectedTables()` wird an **genau zwei** Stellen aufgerufen, beide Male direkt als
Argument von `printProtectedTables()`. Kein Rückgabewert wird in einer Variablen gehalten,
und die einzige Abbruchbedingung (`process.exit(1)`) prüft die **Restzeilenzahl**, nicht die
Prüfsummen. **CR-05 bestätigt sich in beiden Teilen:** kein Vergleich, und die zweite Messung
liegt hinter dem Commit.

**CR-06 — die Deckelung vergleicht UTC-Mitternacht mit Berliner Wanduhrzeit.**
Die beiden Zeilen aus `server/src/services/unifiedOvertimeService.ts:279 / 288-289`:

```ts
const requestedEnd = new Date(endDate);                  // ISO-Datumsstring -> UTC-Mitternacht
const today = getCurrentDate();                          // toZonedTime(new Date(), 'Europe/Berlin')
const effectiveEndDate = requestedEnd > today ? today : requestedEnd;
```

Nachgerechnet mit `TZ=Europe/Berlin` (so läuft der Produktionsserver), `endDate = '2026-08-25'`:

```
new Date(endDate).toISOString()  : 2026-08-25T00:00:00.000Z

Probe                        | today (getCurrentDate)   | today > requestedEnd? | effectiveEndDate
00:30 Berliner Wanduhrzeit   | 2026-08-24T22:30:00.000Z | true                  | 2026-08-24T22:30:00.000Z
01:30 Berliner Wanduhrzeit   | 2026-08-24T23:30:00.000Z | true                  | 2026-08-24T23:30:00.000Z
02:30 Berliner Wanduhrzeit   | 2026-08-25T00:30:00.000Z | false                 | 2026-08-25T00:00:00.000Z
12:00 Berliner Wanduhrzeit   | 2026-08-25T10:00:00.000Z | false                 | 2026-08-25T00:00:00.000Z
```

**CR-06 bestätigt sich.** Zwischen 00:00 und 02:00 Berliner Zeit liegt `effectiveEndDate`
**vor** dem 25.08.2026; die Tagesschleife
(`for (let d = …; d <= effectiveEndDate; d.setDate(d.getDate()+1))`) erreicht den heutigen
Tag dann nicht mehr — er fällt aus dem Saldo. Die Fensterbreite ist der
Sommerzeit-Versatz von **2 Stunden** (CEST = UTC+2); in der Winterzeit (CET = UTC+1) wäre es
**1 Stunde**. Das ist der von der Triage erwartete „ein bis zwei Stunden Versatz".

Urteil: **BESTANDEN** — alle drei Befunde einzeln nachgemessen und bestätigt.

---

## 5. Block 2 — Migrationen auf einer Arbeitskopie der Produktionskopie

Arbeitskopie, ohne das Original anzufassen:

```
node q.mjs server/database/14-produktionskopie.db \
  "VACUUM INTO '<…>/server/database/14-abnahme-prodkopie-arbeit.db'"      (readonly-Verbindung)
```

Ausgangszustand der Kopie (Migrationen nur bis `007_create_vacation_transactions`, Tabelle
`user_work_periods` existiert noch nicht):

```
SELECT (SELECT COUNT(*) FROM overtime_transactions) ot, (SELECT COUNT(*) FROM overtime_balance) ob,
       (SELECT COUNT(*) FROM time_entries) te, (SELECT COUNT(*) FROM absence_requests) ar,
       (SELECT COUNT(*) FROM users) u;
{"ot":2671,"ob":144,"te":712,"ar":43,"u":20}
PRAGMA integrity_check;  →  {"integrity_check":"ok"}
SELECT name FROM sqlite_master WHERE type='table' AND name='user_work_periods';  →  (0 Zeilen)
```

### P12-40a — Bestandsdaten `referenceType` vor Migration 012 · **BESTANDEN**

```
SELECT referenceType, COUNT(*) AS anzahl FROM overtime_transactions GROUP BY referenceType ORDER BY 1;
```

```
{"referenceType":null,"anzahl":2509}
{"referenceType":"absence","anzahl":162}
```

Urteil: **BESTANDEN.** Nur `NULL` und `absence` — beide innerhalb der fünf erlaubten Werte
(`time_entry`, `absence`, `manual`, `system`, `work_period`) plus `NULL`. **Kein unzulässiger
Wert.** Damit wird **P12-40b nicht ausgelöst** — der Anwender muss dazu nichts entscheiden.

### P12-1 — Migration 011: Zeilenzahl identisch, `integrity_check` = ok · **BESTANDEN**

```
cd server && npx tsx src/scripts/applyMigrationsToCopy.ts --db=<…>/14-abnahme-prodkopie-arbeit.db
```

Ausgabe zu Migration 011 (wörtlich):

```
⏳ Running migration: 011_add_model_change_transaction_type
📊 Current transactions: 2671
📦 Copying existing transactions...
✅ Copied 2671 transactions successfully
✅ MIGRATION 011 COMPLETED
Total transactions migrated: 2671
✅ Migration completed: 011_add_model_change_transaction_type
```

Zeilenzahlen nach dem Lauf:

```
{"ot":2671,"ob":144,"te":712,"ar":43,"u":20,"uwp":20}
PRAGMA integrity_check;  →  {"integrity_check":"ok"}
```

Urteil: **BESTANDEN.** `overtime_transactions` **2671 vor und 2671 nach** der Migration,
`integrity_check` = `ok`, keine andere Tabelle bewegt.

### 13-U14 — Migration 015: eindeutiger Index, Integritätsprüfungen · **BESTANDEN** (Abbruchregeln 2 und 3)

Aus demselben Lauf:

```
⏳ Running migration: 015_unique_reversal_of_index
🚀 Migration 015: idx_overtime_transactions_reversal_of eindeutig machen (WR-11)...
✅ Migration 015 verified: idx_overtime_transactions_reversal_of ist eindeutig
✅ All migrations completed successfully
```

Die vier verlangten Prüfungen danach:

```
PRAGMA integrity_check;
{"integrity_check":"ok"}

PRAGMA foreign_key_check;
(0 Zeilen)

PRAGMA index_list(overtime_transactions);
{"seq":0,"name":"idx_overtime_transactions_reversal_of","unique":1,"origin":"c","partial":1}
{"seq":1,"name":"idx_overtime_transactions_type","unique":0,"origin":"c","partial":0}
{"seq":2,"name":"idx_overtime_transactions_date","unique":0,"origin":"c","partial":0}
{"seq":3,"name":"idx_overtime_transactions_userId","unique":0,"origin":"c","partial":0}

SELECT name, sql FROM sqlite_master WHERE type='index' AND name LIKE '%reversal%';
{"name":"idx_overtime_transactions_reversal_of","sql":"CREATE UNIQUE INDEX idx_overtime_transactions_reversal_of\n      ON overtime_transactions(reversalOf) WHERE reversalOf IS NOT NULL\n    "}

Zeilenzahlen: {"ot":2671,"ob":144,"te":712,"ar":43,"u":20,"uwp":20}
```

Urteil: **BESTANDEN.** `integrity_check` = `ok` (Abbruchregel 2 gehalten),
`foreign_key_check` liefert **keine Zeile** (Abbruchregel 3 gehalten), der Index auf
`reversalOf` ist mit `unique = 1` geführt (als Teilindex, `WHERE reversalOf IS NOT NULL`),
und alle Zeilenzahlen sind unverändert.

---

## 6. Block 3 — Salden und Rechenwerk

### 13-U11 (+11-U6, +P12-18) — Generalprobe · **NICHT BESTANDEN** (Abbruchregel 1 **gehalten**)

Fall wie in `14-VORHER-NACHHER.md`: Nutzer 2 (Karin Jochem), 5 → 3 Wochenstunden ab
2026-06-01, rückwirkend.

**Snapshot 1:**

```
cd server && DATABASE_PATH=<…>/14-abnahme-prodkopie-arbeit.db \
  npx tsx src/scripts/snapshotBalances.ts --all --asOf=2026-08-25 --json=<…>/gp1.json
Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
ERGEBNIS: Snapshot erhoben (Exit 0).
```

**Umstellung:**

```
cd server && DATABASE_PATH=<…>/14-abnahme-prodkopie-arbeit.db npx tsx src/scripts/applyModelChange.ts \
  --userId=2 --expectUser=Jochem --expectCurrentWeeklyHours=5 --validFrom=2026-06-01 \
  --weeklyHours=3 --reason="Abnahme 14-AUTO Generalprobe - kein realer Umstellungsfall" --createdBy=1 --apply
```

```
### MODUS: SCHREIBEN ###
Nutzer: Karin Jochem (userId 2), Eintrittsdatum: 2026-01-01
Vorhandene Perioden:
  validFrom=2026-01-01 validTo=(laufend) weeklyHours=5
Saldo vor dem Lauf: 6 h

=== Vorschau ===
balanceDelta:      18.4 h
targetHoursDelta:  -18.4 h
midMonthEffective: false
affectedMonths:    2026-06, 2026-07, 2026-08

Saldo nach dem Lauf: 28.4 h
integrity_check: [{"integrity_check":"ok"}]
```

**Snapshot 2 und der Diff, auf dem Abbruchregel 1 hängt:**

```
Nutzer im Snapshot: A=20 B=20
Geaenderte Nutzer (1): 2
```

**Löschen der Periode:**

```
Perioden vorher: [{"id":2,…,"validFrom":"2026-01-01","validTo":"2026-06-01","weeklyHours":5,"deletedAt":null},
                  {"id":21,…,"validFrom":"2026-06-01","validTo":null,"weeklyHours":3,"deletedAt":null}]
Zu loeschen: id=21 validFrom=2026-06-01
reversalTransactionIds: [33803]
Perioden nachher: [{"id":2,"validFrom":"2026-01-01","validTo":null,"weeklyHours":5,"deletedAt":null},
                   {"id":21,"validFrom":"2026-06-01","validTo":null,"weeklyHours":3,"deletedAt":"2026-08-25 16:21:43"}]
integrity_check: [{"integrity_check":"ok"}]
```

**Snapshot 3 gegen Snapshot 1:**

```
diff gp1.users.json gp3.users.json
183c183
<         "targetHours": 21,
---
>         "targetHours": 15,
190c190
<         "targetHours": 23,
---
>         "targetHours": 25,

Nutzer im Snapshot: A=20 B=20
Geaenderte Nutzer (1): 2
```

Der kanonisch berechnete Saldo des Nutzers 2 (`overtimePeriod`) ist in Snapshot 1 und
Snapshot 3 **identisch**:

```
gp1: "targetHours": 155, "actualHours": 165, "overtime": 10
gp3: "targetHours": 155, "actualHours": 165, "overtime": 10
```

Abweichend sind ausschließlich zwei Monatszeilen des abgeleiteten Aggregats:

```
Monat   | S1 soll/ist/ot        | S2 soll/ist/ot        | S3 soll/ist/ot
2026-06 |    21/    60/     39 |  12.6/    60/   47.4 |    15/    60/     45  <== S1!=S3
2026-07 |    23/  18.5/   -4.5 |  13.8/  18.5/    4.7 |    25/  18.5/   -6.5  <== S1!=S3
2026-08 |    15/     6/     -9 |  10.2/     6/   -4.2 |    15/     6/     -9
```

Zur Einordnung wurde zusätzlich geprüft, welcher der beiden Stände der richtigere ist —
Summe der Monatszeilen gegen den kanonischen Wert:

```
Snapshot 1, Nutzer 2: Summe Monatszeilen = 159, kanonisch = 155, Differenz = 4
Snapshot 3, Nutzer 2: 20+20+22+20+18+15+25+15 = 155 = kanonisch, Differenz = 0
```

Und dass diese Unstimmigkeit kein Einzelfall des Nutzers 2 ist, sondern schon in der
unangetasteten Produktionskopie steckt:

```
Snapshot 1: Summe der Monatszeilen vs. kanonischer Wert je Nutzer
  userId=2  Differenz=4      userId=3  Differenz=30.4   userId=16 Differenz=-12
  userId=17 Differenz=52.8   userId=18 Differenz=-4     userId=19 Differenz=2
  userId=20 Differenz=-2.8   userId=21 Differenz=-2     userId=25 Differenz=-3.2
Nutzer mit Abweichung: 9 von 20
```

Ergänzend, wie von der Triage verlangt:

```
cd server && DATABASE_PATH=<…>/14-abnahme-prodkopie-arbeit.db \
  npx tsx src/scripts/verifyPeriodNullEffect.ts --asOf=2026-08-25
```

```
=== Zusammenfassung ===
Nutzer geprüft (ungefiltert): 20
Nutzer mit Abweichung: 0 — userIds: []
Tage verglichen: 4437 — davon abweichend: 0
Gesamturteil (nur bei beurteilbarer Phase A): ja — Datei unverändert
ERGEBNIS: Erwartung erfüllt (Exit 0).
```

**Urteil: NICHT BESTANDEN — mit dieser Einschränkung:**

- **Abbruchregel 1 ist gehalten.** Zwischen Snapshot 1 und Snapshot 2 ändert sich
  **ausschließlich** der betroffene Nutzer 2. Kein zusätzlicher Name im Diff, kein Blocker.
- **Die Zusatzzusicherung „Snapshot 3 ist bei diesem Nutzer identisch mit Snapshot 1"
  trifft nicht wörtlich zu.** Der kanonische Saldo ist identisch (155 / 165 / +10 h); zwei
  Monatszeilen des Aggregats kehren nicht auf ihren alten Wert zurück.
- **Die Abweichung geht in die richtige Richtung.** Snapshot 3 stimmt bei Nutzer 2 mit dem
  kanonischen Wert überein (155 h), Snapshot 1 tat das nicht (159 h). Das Löschen hat eine
  bereits vorhandene Unstimmigkeit geheilt, nicht eine erzeugt. Neun der zwanzig Nutzer der
  Produktionskopie tragen dieselbe Art von Unstimmigkeit auch ohne jeden Eingriff.

Die beiden hier mitgeführten Punkte werden **einzeln** beurteilt, weil sie je eine eigene,
engere Zusicherung tragen:

- **11-U6 — Generalprobe des Rechenwegs auf einer Produktionskopie: BESTANDEN.** Der Rechenweg
  selbst ist der Prüfgegenstand, nicht das abgeleitete Aggregat. `verifyPeriodNullEffect`
  vergleicht **4437 Tage** über alle 20 Nutzer und findet **0 Abweichungen**; der kanonische
  Zeitraumwert des bewegten Nutzers ist vor und nach dem ganzen Ablauf identisch
  (155 / 165 / +10 h); `integrity_check` nach Umstellung und nach Löschung je `ok`.
- **P12-18 — kein Saldo-Seiteneffekt auf unbeteiligte Nutzer: BESTANDEN.** **19 der 20**
  Nutzer sind in allen drei Snapshots byte-identisch; der Diff nennt in beiden Vergleichen
  ausschließlich `userId = 2`.

### P12-19 — `checkAllPeriodChains()` nach dem Wechsel · **BESTANDEN** (Abbruchregel 4)

```
cd server && DATABASE_PATH=<…>/14-abnahme-prodkopie-arbeit.db npx tsx src/scripts/checkPeriodChains.ts
```

```
==============================================================================
BESTANDS-CHECK ARBEITSZEITPERIODEN (checkAllPeriodChains)
==============================================================================
✅ Keine Befunde — jeder nicht gelöschte Nutzer hat eine lückenlose
   Periodenkette ab seinem Eintrittsdatum.

EXIT=0
```

Urteil: **BESTANDEN.** Befundliste leer, Exit 0 — und zwar **nach** Umstellung und Löschung.

### P12-10 — Abgebrochener Speichervorgang hinterlässt nichts · **BESTANDEN**

`applyWorkTimeChange()` wurde innerhalb einer äußeren Transaktion aufgerufen, die
unmittelbar danach gezielt scheitert. Gemessen wurden alle drei Größen, die der Punkt nennt,
und zwar **auch innerhalb** der Transaktion — sonst bewiese ein „unverändert" nur, dass
überhaupt nichts geschrieben wurde.

```
cd server && DATABASE_PATH=<…>/14-abnahme-p12-10.db npx tsx <block3.ts> p12-10 16
```

```
VORHER:  {"perioden":20,"mcRef":0,"mcTyp":0}
INNEN:   {"perioden":21,"mcRef":1,"mcTyp":1}
Abbruch: kuenstlicher Abbruch nach dem Schreiben (P12-10)
NACHHER: {"perioden":20,"mcRef":0,"mcTyp":0}
URTEIL: unveraendert
integrity_check: [{"integrity_check":"ok"}]
```

Urteil: **BESTANDEN.** Innerhalb der Transaktion stehen Periode und `model_change`-Buchung
nachweislich da (21 / 1 / 1) — nach dem Abbruch ist beides weg (20 / 0 / 0), `integrity_check`
= `ok`. Die Transaktionsklammer trägt.

### 13-U15 — Der ehemals tödliche Ablauf · **BESTANDEN**

```
cd server && DATABASE_PATH=<…>/14-abnahme-13-u15.db npx tsx <block3.ts> 13-u15 16
```

```
userId=16 weeklyHours(users)=30
Perioden am Start: [{"id":5,"validFrom":"2026-01-01","validTo":null,"weeklyHours":30,"deletedAt":null}]
--- Schritt 0 (Vorbereitung): Ausgangsmodell 40 ab 2026-01-02
  balanceDelta=-272
--- Schritt 1: 40 -> 32 ab 2026-03-02
  balanceDelta=158.4 targetHoursDelta=-193.6
--- Schritt 2: Korrektur zurueck auf 40 ab 2026-05-04
  balanceDelta=-94.4 targetHoursDelta=126.4
  Perioden jetzt: [{"id":5,…,"weeklyHours":30},{"id":21,…"validFrom":"2026-01-02","validTo":"2026-03-02","weeklyHours":40},
                   {"id":22,"validFrom":"2026-03-02","validTo":"2026-05-04","weeklyHours":32},
                   {"id":23,"validFrom":"2026-05-04","validTo":null,"weeklyHours":40}]
--- Schritt 3: juengste Periode loeschen
  geloescht id=23 reversalTransactionIds=[35041]
  Perioden danach: […,{"id":22,"validFrom":"2026-03-02","validTo":null,"weeklyHours":32,"deletedAt":null},
                     {"id":23,…,"deletedAt":"2026-08-25 16:27:40"}]
integrity_check: [{"integrity_check":"ok"}]
URTEIL: alle drei Schritte ohne Fehler durchgelaufen
EXIT=0
```

**Begründete Abweichung:** Kein aktiver Nutzer der Produktionskopie hat 40 Wochenstunden
(die beiden mit 40 sind soft-gelöscht). Deshalb ein vorgeschalteter Schritt 0, der das
Ausgangsmodell auf 40 setzt; danach exakt die drei Schritte des Befunds.

Urteil: **BESTANDEN.** Kein 500, kein Fehler. Das Löschen gelingt, die Kette schließt sich
(Periode 22 erhält `validTo = null`), `integrity_check` = `ok`, Exit 0.

### P12-9 — `applyWorkTimeChange()` unter 10 Sekunden · **BESTANDEN**

Nutzer mit den meisten Zeiteinträgen per SQL bestimmt, dann rückwirkend umgestellt und die
Dauer gemessen:

```
cd server && DATABASE_PATH=<…>/14-abnahme-p12-9.db npx tsx <block3.ts> p12-9
```

```
Nutzer mit den meisten time_entries: [{"userId":16,"c":134},{"userId":18,"c":88},{"userId":17,"c":87}]
Gewaehlt: userId=16 time_entries=134 weeklyHours=30 hireDate=2026-01-01
DAUER_MS=119
URTEIL: unter 10000 ms
```

Gegenprobe, dass der Lauf tatsächlich gearbeitet hat (sonst wäre die Zeit wertlos):

```
SELECT id,userId,validFrom,validTo,weeklyHours FROM user_work_periods WHERE userId=16;
{"id":5,"validFrom":"2026-01-01","validTo":"2026-01-15","weeklyHours":30}
{"id":21,"validFrom":"2026-01-15","validTo":null,"weeklyHours":25}
SELECT id,type,date,hours,referenceType,description FROM overtime_transactions WHERE type='model_change';
{"id":34012,"type":"model_change","date":"2026-01-15","hours":128,"referenceType":"work_period",
 "description":"Stundenwechsel ab 15.01.2026: 30,0 → 25,0 h/Woche (Grund: …)"}
SELECT COUNT(*) FROM overtime_transactions WHERE userId=16;  →  278
```

Urteil: **BESTANDEN.** **119 ms** gegen eine Grenze von 10.000 ms — Faktor 84 Reserve. Die
Periode wurde geteilt, die `model_change`-Buchung geschrieben, 278 Journalzeilen stehen für
den Nutzer.

### P12-44 — Rückwirkender Wechsel zieht Zukunftsmonate mit · **BESTANDEN**

```
cd server && DATABASE_PATH=<…>/14-abnahme-p12-44.db npx tsx <block3.ts> p12-44
```

```
Zukunftsmonatszeilen im Bestand: [{"userId":3,"month":"2026-09","targetHours":36,"actualHours":16},
                                  {"userId":17,"month":"2026-09","targetHours":52,"actualHours":8}]
Gewaehlt userId=3 weeklyHours=8 genehmigte Zukunftsantraege=[
  {"id":64,"type":"overtime_comp","status":"approved","startDate":"2026-09-29","endDate":"2026-09-29"},
  {"id":63,"type":"vacation","status":"approved","startDate":"2026-09-21","endDate":"2026-09-28"}]
Zukunftszeilen VORHER:  [{"month":"2026-09","targetHours":36,"actualHours":16}]
affectedMonths=["2026-05","2026-06","2026-07","2026-08"] balanceDelta=-320
Zukunftszeilen NACHHER: [{"month":"2026-09","targetHours":132,"actualHours":36}]
URTEIL: Zukunftszeilen NACHGEZOGEN
```

Urteil: **BESTANDEN.** Der Nutzer hat genehmigten Urlaub im nächsten Quartal (Antrag 63,
21.–28.09.2026). Die Monatszeile 2026-09 liegt **außerhalb** von `affectedMonths`
(2026-05 … 2026-08) und wird trotzdem auf das neue Modell nachgezogen: Sollstunden **36 →
132 h**, Iststunden **16 → 36 h**. Genau das verlangt der Punkt.

### P12-12 — Kein Rundungsfehler über Monatsgrenzen · **BESTANDEN**

Damit die Messung nicht von einer bereits vorhandenen Aggregat-Unstimmigkeit verfälscht wird,
ein Nutzer **ohne** solche Abweichung (Nutzer 24, siehe die Liste unter 13-U11) und ein
Zielwert mit nicht ganzzahligem Tagessoll: **37 h/Woche = 7,4 h/Tag**, Stichtag mitten im
Monat, sieben betroffene Monate.

```
cd server && DATABASE_PATH=<…>/14-abnahme-p12-12.db npx tsx <block3.ts> p12-12 24
```

```
VORSCHAU affectedMonths=["2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"]
  targetHoursBefore=0  targetHoursAfter=991.6
  targetHoursDelta=991.6  balanceDelta=-991.6
Monat     SollVorher   SollNachher     Delta
  2026-02           0          96.2      96.2
  2026-03           0         162.8     162.8
  2026-04           0           148       148
  2026-05           0         133.2     133.2
  2026-06           0         155.4     155.4
  2026-07           0         170.2     170.2
  2026-08           0         125.8     125.8
Summe der Monatsdeltas (Soll): 991.6
targetHoursDelta der Vorschau: 991.6
DIFFERENZ: 0
```

Urteil: **BESTANDEN.** Die Summe der sieben Monatsdeltas trifft den Vorschauwert auf
**0,00 h** — bei sieben Monatsgrenzen und einem Tagessoll mit Nachkommastelle.

### P12-23a — Rückwirkender Wechsel mit Differenz 0 rechnet auf 0 · **BESTANDEN**

Der Schreibweg weist gleiche Werte mit einer Meldung ab (`isNoOp && !dryRun` →
`WorkTimeChangeValidationError`, `workPeriodChangeService.ts:453`); die **Vorschau** lässt sie
zu und ist genau das, was der Punkt prüft.

Erster Lauf (Nutzer 24, 0 h/Woche):

```
Perioden: [{"id":13,"validFrom":"2026-01-01","validTo":null,"weeklyHours":0,"workSchedule":null}]
isNoOp=true  isRetroactive=true
targetHoursBefore=0  targetHoursAfter=0
targetHoursDelta=0  balanceDelta=0
```

Gegenprobe mit nicht trivialer Grundmenge (Nutzer 16, 30 h/Woche) — sonst verglichen die
Erwartungen zwei Nullen:

```
Perioden: [{"id":5,"validFrom":"2026-01-01","validTo":null,"weeklyHours":30,"workSchedule":null}]
Eingabe (identisch zur gueltigen Periode): weeklyHours=30 workSchedule=null
isNoOp=true  isRetroactive=true
targetHoursBefore=546  targetHoursAfter=546
targetHoursDelta=0  balanceDelta=0
```

Urteil: **BESTANDEN.** `targetHoursDelta = 0` und `balanceDelta = 0` — auch dann, wenn die
zugrunde liegende Sollstundenmenge mit 546 h deutlich von null verschieden ist.

### 14-U1b — Der reale Umstellungsfall · **NICHT PRÜFBAR**

Der Punkt setzt 14-U1a voraus: Nutzer-Id/Name, Stichtag, alte und neue Wochenstunden. Diese
vier Werte sind eine Angabe des Anwenders (Kategorie `ENTSCHEIDUNG`) und liegen nicht vor.
Ohne sie gibt es keine Erwartung, gegen die geprüft werden könnte — ein Lauf mit
selbstgewählten Werten wäre eine zweite Generalprobe, kein Nachweis des realen Falls.

Was für den Tag des realen Laufs bereits belegt ist: der Rechenweg selbst (13-U11, P12-12,
P12-44 auf derselben Produktionsarbeitskopie), das Werkzeug samt seiner Schutzvorkehrungen
(`--expectUser`, `--expectCurrentWeeklyHours`, Trockenlauf vor `--apply`) und die
Wiederherstellbarkeit (14-U2a).

Urteil: **NICHT PRÜFBAR** — Voraussetzung 14-U1a fehlt.

---

## 7. Block 4 — Freigabeunterlagen

### 14-U2a — Sicherung, Deployment, Health-Check, Trockenlauf · **BESTANDEN**

**(a) Sicherung vorhanden, unversehrt und rückspielbar**

```
node q.mjs server/database/backups/development.PRE-14.1-06_20260825_070544.db "PRAGMA integrity_check;; …"
--- PRAGMA integrity_check      →  {"integrity_check":"ok"}
--- PRAGMA foreign_key_check    →  (0 Zeilen)
--- SELECT COUNT(*) FROM users              →  {"users":30}
--- SELECT COUNT(*) FROM overtime_transactions  →  {"journal":2721}
```

Rückspielen in eine Wegwerfkopie (`VACUUM INTO`, wie `14-ROLLBACK-RUNBOOK.md` Abschnitt 1
vorschreibt — nicht `cp`):

```
--- PRAGMA integrity_check      →  {"integrity_check":"ok"}
--- SELECT COUNT(*) FROM users                  →  {"users":30}
--- SELECT COUNT(*) FROM overtime_transactions  →  {"journal":2721}
--- SELECT COUNT(*) FROM user_work_periods      →  {"perioden":30}
```

Die zurückgespielte Kopie ist in allen geprüften Zählungen deckungsgleich mit der Sicherung.
Der in der Triage erwähnte Restore-Nachweis `14.1-restore-probe.db` liegt zusätzlich vor.

**(b) Deployment grün**

```
gh run list --workflow="deploy-server.yml" --limit 3
completed	success	fix(14-08): fix-overtime laeuft erst nach dem PM2-Start, wenn die Mig…	CD - Deploy Server to Oracle Cloud	main	push	32632007657	6m2s	2026-08-23T09:48:09Z
completed	success	feat(06-07): CLI-Skript correctPreHireVacationBalances2025.ts	…	2026-08-21T18:32:03Z
completed	success	fix(desktop): Notification-Plugin nur in der Tauri-Hülle aufrufen	…	2026-08-20T20:47:33Z
```

Der jüngste Lauf ist `completed` / `success`.

**(c) Health-Check**

```
curl -s http://129.159.8.19:3000/api/health
{"status":"ok","message":"TimeTracking Server is running","version":"0.1.0","timestamp":"2026-08-25T16:31:30.038Z"}
```

**(d) Trockenlauf**

Ausgeführt und vollständig protokolliert unter **14.1-U20a** (Abschnitt 4).

Urteil: **BESTANDEN.** Alle vier Unterlagen liegen vor: Sicherung unversehrt und rückspielbar,
Deployment grün, Health-Check antwortet `status: ok`, Trockenlaufausgabe gesichert.

**Abweichung, ausdrücklich benannt (siehe auch Abschnitt 8, NB-B):** Die Triage und
`.claude/CLAUDE.md` erwarten die Antwort `{"status":"ok","database":"connected"}`. Das Feld
`database` **existiert nicht**. `server/src/server.ts:160-168` gibt aus:

```ts
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'TimeTracking Server is running',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});
```

Der Health-Check belegt damit, dass der Prozess antwortet — **nicht**, dass die Datenbank
verbunden ist. Für die Freigabe ist das eine Lücke in der Aussagekraft der Unterlage, kein
Fehlverhalten des Servers.

### 14-U3a — `latest.json` trägt alle vier Plattformschlüssel · **NICHT PRÜFBAR**

```
gh release list --limit 5
TimeTracking System v1.8.0	Latest	v1.8.0	2026-08-20T21:10:10Z
TimeTracking System v1.7.3		v1.7.3	2026-08-18T21:04:05Z
…
```

Das jüngste Release ist **v1.8.0 vom 20.08.2026** und liegt damit **vor** den Phasen 14 und
14.1. Das abzunehmende Release existiert noch nicht.

Als Ersatznachweis derselbe Prüfweg gegen v1.8.0:

```
gh release view v1.8.0 --json assets --jq '.assets[].name'
latest.json
Stiftung.der.DPolG.TimeTracker_1.8.0_x64-setup.exe (+ .sig)
Stiftung.der.DPolG.TimeTracker_1.8.0_x64_en-US.msi (+ .sig)
Stiftung.der.DPolG.TimeTracker_1.8.0_aarch64.dmg
Stiftung.der.DPolG.TimeTracker_1.8.0_x64.dmg
Stiftung.der.DPolG.TimeTracker_1.8.0_amd64.AppImage (+ .sig)
Stiftung.der.DPolG.TimeTracker_1.8.0_amd64.deb (+ .sig)
Stiftung.der.DPolG.TimeTracker_1.8.0-1.x86_64.rpm (+ .sig)
Stiftung.der.DPolG.TimeTracker_aarch64.app.tar.gz (+ .sig)
Stiftung.der.DPolG.TimeTracker_x64.app.tar.gz (+ .sig)
```

```
version: 1.8.0
Plattformschluessel: ["darwin-x86_64","darwin-x86_64-app","darwin-aarch64","darwin-aarch64-app",
                      "linux-x86_64","linux-x86_64-appimage","linux-x86_64-deb","linux-x86_64-rpm",
                      "windows-x86_64","windows-x86_64-nsis","windows-x86_64-msi"]
  darwin-aarch64   vorhanden=true  url=gesetzt  signature=gesetzt(436 Zeichen)
  darwin-x86_64    vorhanden=true  url=gesetzt  signature=gesetzt(436 Zeichen)
  linux-x86_64     vorhanden=true  url=gesetzt  signature=gesetzt(448 Zeichen)
  windows-x86_64   vorhanden=true  url=gesetzt  signature=gesetzt(448 Zeichen)
Alle vier vollstaendig: true
```

Urteil: **NICHT PRÜFBAR** für das abzunehmende Release — es gibt es noch nicht. Der
Mechanismus arbeitet nachweislich korrekt: beim letzten Release trugen **alle vier**
verlangten Plattformschlüssel sowohl `url` als auch `signature`. Der Punkt ist unmittelbar
nach dem Release mit demselben Befehl abzuschließen.

---

## 8. Neue Befunde

Diese Punkte sind bei den Messungen aufgefallen, gehören zu **keinem** der 33 AUTO-Punkte und
wurden **nicht** behoben — Beheben ist Sache einer späteren Entscheidung.

### NB-A — Die 2026-08-Monatszeilen der Nutzer 3 und 17 stehen falsch

Gefunden bei 14.1-U15a, Schritt 3. Eine Neuberechnung bewegt sie:

```
userId  month     targetVorher targetNachher   istVorher  istNachher   DIFF(ist)  DIFF(soll)
     3  2026-08            24            32       24.51       24.51           0           8
    17  2026-08            36            44       34.75       38.75           4           8
```

Der laufende Monat trägt bei beiden Nutzern **8,00 h zu wenig Sollstunden**, bei Nutzer 17
zusätzlich **4,00 h zu wenig Iststunden**. Nutzer 18 ist im selben Monat sauber. Die Nutzer 3
und 17 sind zugleich zwei der drei Nutzer mit einer `JournalDiff` ≠ 0 aus 14.1-U1a — ein
Zusammenhang mit der unter **14.1-U3** beschriebenen fehlenden Soll-Gegenbuchung zu
Abwesenheits-Gutschriften liegt nahe, wurde in diesem Lauf aber **nicht** nachgewiesen und
wird hier deshalb nicht behauptet.

### NB-B — Der Health-Check belegt die Datenbankverbindung nicht

`GET /api/health` (`server/src/server.ts:160-168`) gibt `status`, `message`, `version` und
`timestamp` zurück und **berührt die Datenbank nicht**. Die in `.claude/CLAUDE.md`
(„Deployment Verification Rules") und in der Triage (14-U2a) dokumentierte Erwartung
`{"status":"ok","database":"connected"}` beschreibt einen Zustand, den dieser Endpunkt nicht
prüfen kann. Ein Server mit kaputter Datenbankverbindung antwortet auf diesem Weg heute
weiterhin mit `status: ok`. Betrifft jede Freigabeprüfung, die sich auf diesen Endpunkt
stützt.

### NB-C — Das abgeleitete Aggregat `overtime_balance` weicht bei 9 von 20 Nutzern vom kanonischen Wert ab

Gefunden bei 13-U11, gemessen auf der **unangetasteten** Produktionskopie (Snapshot 1, vor
jedem Eingriff): Summe der Monatszeilen gegen den kanonisch berechneten Zeitraumwert.

```
  userId=2  Differenz=4      userId=3  Differenz=30.4   userId=16 Differenz=-12
  userId=17 Differenz=52.8   userId=18 Differenz=-4     userId=19 Differenz=2
  userId=20 Differenz=-2.8   userId=21 Differenz=-2     userId=25 Differenz=-3.2
Nutzer mit Abweichung: 9 von 20
```

Das ist die Ebene, aus der der Kontoauszug seinen fetten Saldo und der Historien-Export
seine Kennzahl zieht. Der kanonische Rechenweg selbst ist davon **nicht** betroffen
(`verifyPeriodNullEffect`: 4437 Tage verglichen, 0 abweichend). Der unter 14.1-U15a
gemessene Rest bei Nutzer 18 ist ein Einzelfall derselben Klasse.

### NB-D — CR-04 betrifft auch `vacation_balance`, nicht nur `timeEntries` und `absences`

Gemessen unter 14.1-U29a: im Sammel-Export der Produktionsarbeitskopie verweisen **6**
`vacation_balance`-Zeilen auf Nutzer (15, 31, 30, 28, 26), die die Nutzerliste desselben
Exports nicht enthält. Der Punkt **14.1-U11** nennt in seiner Zahl nur „102 Zeiteinträge und
1 genehmigten Antrag" — die `vacation_balance`-Zeilen fehlen dort. Wer 14.1-U11 nach Weg 1
entscheidet („denselben Nutzerfilter mitziehen"), sollte diese Tabelle mitnennen.

### NB-E — Die Testsuite schreibt in die Arbeitsdatenbank, ohne Produktionsschutz je Datei

`vitest.config.ts` dokumentiert das ausdrücklich („alle Tests arbeiten deshalb auf derselben
`database/development.db` wie die lokale Entwicklung"), und `vitest.setup.ts` fängt das mit
`assertNotProduction()` einmal pro Testdatei ab. **Bemerkbar wurde es hier praktisch:** Nach
dem Lauf standen vier zusätzliche Nutzer (48714–48717) in `development.db`, die vorher nicht
da waren (gemessen unter 14.1-U25a). Bei paralleler Arbeit gegen dieselbe Datei — genau die
Lage dieses Abnahmelaufs — ist das eine Quelle für schwer zuzuordnende Zustände. Der Punkt
ist im Kern schon als **WR-18** in `14.1-REVIEW.md` erfasst; hier steht nur der gemessene
Beleg dafür, dass er im Alltag wirkt.

---

## 9. Angelegte Dateien

Alle unter `server/database/` (nicht eingecheckt, `.gitignore`). Sie sind der Beleg zu den
oben protokollierten Messungen und können nach Kenntnisnahme gelöscht werden — dieselbe
Frage, die **14.1-U22** für die drei Dateien der Phase 14.1 stellt.

| Datei | Herkunft | Wofür |
|---|---|---|
| `14-abnahme-auto.db` | `development.db` | Allgemeine Arbeitskopie; 14-U8, 14.1-U1a, U15a, U21a, U25a, U14a |
| `14-abnahme-pre14106.db` | Sicherung `development.PRE-14.1-06_…` | 14.1-U20a, U27a |
| `14-abnahme-restore-probe.db` | dieselbe Sicherung | 14-U2a (Rückspielnachweis), 14.1-U25a |
| `14-abnahme-u25a-jetzt.db` | `development.db` | 14.1-U25a (Vergleichsstand) |
| `14-abnahme-prodkopie-arbeit.db` | `14-produktionskopie.db` | P12-40a, P12-1, 13-U14, 13-U11, P12-19 |
| `14-abnahme-master-migriert.db` | dieselbe, nach den Migrationen | Vorlage für die Wegwerfkopien des Blocks 3 |
| `14-abnahme-prodprobe.db` | `14.1-bereinigung-probe.db` | 14.1-U14a, CR-04 |
| `14-abnahme-u15a.db` | `14-abnahme-auto.db` | 14.1-U15a, Schritt 3 |
| `14-abnahme-u16a.db` | `14-abnahme-auto.db` | 14.1-U16a |
| `14-abnahme-p12-9.db`, `-p12-10.db`, `-p12-12.db`, `-p12-23a.db`, `-p12-23b.db`, `-p12-44.db`, `-13-u15.db` | `14-abnahme-master-migriert.db` | je eine Messung des Blocks 3 |

Die Hilfsskripte dieses Laufs (`q.mjs`, `pt.mjs`, `diffusers.mjs`, `u15a.ts`, `block3.ts`,
`u16a.ts`, `export.ts`, `cr06.ts`) liegen im Sitzungs-Scratchpad **außerhalb** des Projekts.
Im Projektbaum wurde keine Datei angelegt oder geändert.
