---
status: resolved
trigger: "Warum stimmt bei Nutzer 3 (Christine Glas) und 17 (Carmen Rothemund) das Aggregat overtime_balance auch nach einem Vollaufbau nicht mit dem kanonischen Rechenweg ueberein? Ziel: 15 von 15 aktiven Nutzern."
created: 2026-08-23
updated: 2026-08-23
---

# Befund: Die beiden Restabweichungen sind KEIN Dual-Calculation-Problem

## Kurzfassung

Die Behauptung aus `14-URTEIL-PHASE-9.1.md`, Abschnitt 7.6 — die zwei verbliebenen
Abweichungen seien darauf zurueckzufuehren, dass `updateOvertimeBalanceForMonth()` und
`unifiedOvertimeService.calculateDailyOvertime()` `overtime_comp` und `unpaid`
unterschiedlich behandelten — **ist widerlegt**. Beide Funktionen behandeln beide Arten
identisch. Nachgewiesen dreifach: Zeile fuer Zeile am Quelltext, Tag fuer Tag auf der
Produktionskopie (Differenz an jedem einzelnen Tag exakt 0,00) und durch neue
Regressionstests, die beide Wege synthetisch gegeneinander stellen.

Die tatsaechliche Ursache: **Das Aggregat des LAUFENDEN Monats war veraltet.** Der
Vollaufbau (`backfillOvertimeJournal --all-months`) baut absichtlich nur *vollstaendig
vergangene* Monate auf und ruehrt den laufenden Monat nicht an. In der statischen
Messkopie trug der August 2026 deshalb noch Werte aus dem Rechenstand VOR Phase 11.

**In der echten Produktionsdatenbank nach der Migration stimmen bereits heute 15 von 15
aktiven Nutzern.** Die 13 von 15 waren ein Messartefakt der Momentaufnahme.

**Es war keine Aenderung an der Berechnungslogik noetig und es wurde keine vorgenommen.**

---

## 1. Reproduktion der Abweichung

Arbeitskopie: eigene Kopie von `server/database/14-backfill-vollprobe.db` im Scratchpad.
Die Beweismittel `14-produktionskopie.db` und `14-generalprobe.db` wurden ausschliesslich
lesend bzw. als Kopiervorlage angefasst. Bezugsdatum: 23.08.2026, laufender Monat 2026-08.

Entscheidend fuer das Verstaendnis ist, dass es **zwei Leser** des Aggregats gibt, die den
Bestand unterschiedlich summieren:

| Leser | Filter | Verwendung |
|---|---|---|
| `getOvertimeBalance()` (`overtimeTransactionService.ts:454`) | `month <= laufender Monat` | **der Weg der Anwendung** — Saldo, den der Mitarbeiter sieht |
| `getCurrentOvertimeBalance()` (`overtimeTransactionRebuildService.ts:637`) | kein Filter | exportiert, aber **von niemandem aufgerufen** (toter Code) |

Beide Summen gegen den kanonischen Weg
(`unifiedOvertimeService.calculatePeriodOvertime(hireDate, heute)`):

| userId | aggApp (gefiltert) | aggAll (ungefiltert) | kanonisch | Rest App | Rest All |
|---|---|---|---|---|---|
| 3 Christine Glas | 2,37 | -17,63 | 4,77 | **-2,40** | -22,40 |
| 17 Carmen Rothemund | 9,14 | -34,86 | -1,26 | **+10,40** | -33,60 |
| die uebrigen 13 | — | — | — | 0,00 | 0,00 |

Die Werte 2,37 und 9,14 sind **exakt** die Zahlen aus dem Urteil (Abschnitt 7.6, Tabelle
nach Vollaufbau). Damit ist belegt, dass das Urteil mit dem gefilterten Weg gemessen hat
und dass die Restabweichung dort 2,40 h bzw. 10,40 h betraegt.

Aufgeschluesselt nach Monat:

| userId | Monat | Aggregat (Soll/Ist) | kanonisch (Soll/Ist) | Differenz |
|---|---|---|---|---|
| 3 | 2026-08 | 24,00 / 22,11 | 24,00 / 24,51 | Ist zu niedrig um **2,40** |
| 3 | 2026-09 | 36,00 / 16,00 | 0,00 / 0,00 | -20,00 (Zukunftsmonat) |
| 17 | 2026-08 | 36,00 / 45,15 | 36,00 / 34,75 | Ist zu hoch um **10,40** |
| 17 | 2026-09 | 52,00 / 8,00 | 0,00 / 0,00 | -44,00 (Zukunftsmonat) |

Das Soll stimmt in beiden Faellen im August ueberein; abweichend ist ausschliesslich das Ist.
---

## 2. Widerlegung der Urteilsbehauptung

### 2.1 Am Quelltext, Zeile fuer Zeile

`updateOvertimeBalanceForMonth()` (`overtimeTransactionRebuildService.ts:574-631`):

- Soll: `if (day.absence.type === unpaid) return sum;` — unbezahlter Urlaub traegt 0 bei.
- Ist: Gutschrift `dayActual += day.targetHours` nur, wenn der Typ gesetzt ist und
  **weder** `unpaid` **noch** `overtime_comp` ist.

`unifiedOvertimeService.calculateDailyOvertime()` (`:120-155`) mit seinen Helfern:

- Soll: `getUnpaidReduction()` (`:421`) fragt `type = unpaid` ab; bei Treffer wird
  `targetHours = 0` gesetzt.
- Ist: `getAbsenceCredit()` (`:385`) fragt `type IN (vacation, sick, special)` ab —
  `unpaid` und `overtime_comp` sind ausgeschlossen, also keine Gutschrift.

Die Mengen sind deckungsgleich: alles ausser `unpaid` und `overtime_comp` (Aggregat) gegen
nur `vacation`/`sick`/`special` (kanonisch). Beide Wege setzen fuer `unpaid` das Soll auf 0
und geben keine Gutschrift; beide lassen fuer `overtime_comp` das Soll stehen und geben
keine Gutschrift. **Kein Unterschied.**

Beide entsprechen damit `.claude/CLAUDE.md`: Krankheit und Urlaub zaehlen als gearbeitet
(Gutschrift), unbezahlter Urlaub reduziert das Soll ohne Ist-Gutschrift, und der
Ueberstundenausgleich zehrt den Saldo ab (REQ-19).

### 2.2 Tag fuer Tag an den echten Daten

Fuer beide Nutzer wurde jeder Kalendertag des August und des September einzeln durch beide
Wege gerechnet. Ergebnis: Die Differenz in Soll und Ist ist an **jedem einzelnen Tag exakt
0,00** — einschliesslich des `sick`-Tages 03.08. (Nutzer 3), der `vacation`-Tage
17./24./27.-31.08. (Nutzer 17) und des `overtime_comp`-Tages 29.09. (Nutzer 3).

### 2.3 Weitere Nutzer waeren nicht betroffen

Der Verdacht, der Defekt sei allgemein und treffe heute nur zufaellig zwei Nutzer, trifft
fuer `overtime_comp`/`unpaid` **nicht** zu: Es gibt hier keinen Defekt, den weitere Nutzer
erben koennten. Zur Absicherung stellen die neuen Tests beide Wege synthetisch fuer
`vacation`, `sick`, `overtime_comp` und `unpaid` gegeneinander — alle deckungsgleich.

Nebenbefund: `special` ist im Code als Abwesenheitsart vorgesehen (`getCreditType()`,
`getAbsenceCredit()`), wird aber von der CHECK-Beschraenkung auf `absence_requests.type`
abgewiesen (zugelassen sind nur `vacation`, `sick`, `unpaid`, `overtime_comp`). Die Art ist
heute nicht erreichbar. Nicht Gegenstand dieses Befundes, aber festgehalten.

---

## 3. Die tatsaechliche Ursache: veraltetes Aggregat des laufenden Monats

`backfillOvertimeJournal.ts:395-397` begrenzt die Kandidatenliste auf
`lastFullyPastMonth = previousMonth(currentMonth)` — auch mit `--all-months`. Der laufende
Monat wird **nie** aufgebaut. In der Messkopie stand im August deshalb noch, was ein
frueherer Rechenstand hineingeschrieben hatte.

Dass die gespeicherten Werte aus dem Stand VOR Phase 11 stammen, laesst sich beziffern:

| userId | Wochenstunden | `weeklyHours/5` (altes Tagessoll) | heutiges Tagessoll (Arbeitszeitperiode) |
|---|---|---|---|
| 3 | 8 | **1,60** | 4,00 |
| 17 | 12 | **2,40** | 4,00 |

- Nutzer 3, August: Zeiteintraege 20,51 h. Gespeichertes Ist 22,11 h → Ueberschuss
  **1,60 h** = genau eine Krankheitsgutschrift zum alten Tagessatz 8/5. Heute korrekt:
  4,00 h Gutschrift → 24,51 h.
- Nutzer 17, August: Zeiteintraege 30,75 h. Gespeichertes Ist 45,15 h → Ueberschuss
  **14,40 h** = 6 x 2,40 h, also sechs Abwesenheitsgutschriften zum alten Tagessatz 12/5.
  Heute korrekt: eine Gutschrift von 4,00 h fuer den 17.08.; die uebrigen Urlaubstage
  liegen nach dem 23.08. und werden vom kanonischen Weg wie vom Rebuild auf heute
  beschnitten → 34,75 h.

Die Ueberschuesse sind exakte Vielfache von `weeklyHours/5`. Das heutige Modell erzeugt
diesen Tagessatz nirgends mehr. Welche sechs Tage bei Nutzer 17 im Einzelnen gutgeschrieben
wurden, laesst sich nicht mehr rekonstruieren — die alten Journalzeilen hat der Vollaufbau
ueberschrieben.
### Gegenprobe

Auf einer frischen Kopie wurde **mit voellig unveraendertem Code** nur der laufende Monat
neu aufgebaut:

```
user 3  2026-08: Soll 24 -> 24,  Ist 22,11 -> 24,51
user 17 2026-08: Soll 36 -> 36,  Ist 45,15 -> 34,75
```

Danach:

```
aggApp (getOvertimeBalance, month <= 2026-08): 15 von 15 deckungsgleich
```

| userId | aggApp nachher | kanonisch | Rest |
|---|---|---|---|
| 3 | 4,77 | 4,77 | 0,00 |
| 17 | -1,26 | -1,26 | 0,00 |

**Damit ist das Ziel erreicht — ohne eine einzige Zeile Codeaenderung.**

### Warum das in Produktion von selbst heilt

Der laufende Monat braucht den Backfill gar nicht: `updateAllOvertimeLevels()`
(`overtimeService.ts:197`) ruft bei jedem Zeiteintrag `rebuildOvertimeTransactionsForMonth()`
fuer den betroffenen Monat auf; Abwesenheitsgenehmigungen und Korrekturen ebenso. Die Zeile
wird also beim naechsten Schreibzugriff automatisch richtiggestellt.

Messung an der echten Produktionsdatenbank nach der Migration
(`server/database/14-prod-nach-migration.db`, als Kopie, lesend):

```
 3 Christine Glas:    aggApp= 4,77  kanon= 4,77  RestApp=0,00
17 Carmen Rothemund:  aggApp=-1,26  kanon=-1,26  RestApp=0,00
aggApp: 15/15 deckungsgleich
```

**Die Produktion steht bereits auf 15 von 15.** Die 13 von 15 des Urteils waren ein
Artefakt der statischen Messkopie.

---

## 4. Nebenbefund: Zukunftsmonate im Aggregat (offen, Entscheidung des Anwenders)

`rebuildOvertimeTransactionsForMonth()` beschneidet das Periodenende nur im laufenden Monat
auf heute (`overtimeTransactionRebuildService.ts:115-119`):

```ts
const currentMonth = formatDate(today, yyyy-MM);
const endDate = (month === currentMonth)
  ? new Date(Math.min(monthEnd.getTime(), today.getTime()))
  : monthEnd;
```

Fuer einen Monat, der ganz in der Zukunft liegt, greift der Sonst-Zweig: Der Rebuild bucht
den kompletten kuenftigen Monat durch — volles Soll, kein Ist — und schreibt eine
`overtime_balance`-Zeile mit fiktivem Minussaldo. Ausgeloest wird das durch das Genehmigen
einer Abwesenheit, die in einen kuenftigen Monat reicht. Genau deshalb traf es die beiden
Nutzer mit gebuchtem Zukunftsurlaub — nicht die mit `overtime_comp` oder `unpaid`.

Gemessener Bestand:

| userId | Monat | Soll | Ist | fiktiver Saldo |
|---|---|---|---|---|
| 3 | 2026-09 | 36,00 | 12,00 | -24,00 |
| 17 | 2026-09 | 52,00 | 8,00 | -44,00 |
| 30 (soft-geloescht) | 2026-10 | 176,00 | 0,00 | -176,00 |

**Heute ohne Wirkung**, weil `getOvertimeBalance()` — der einzige tatsaechlich benutzte
Leser — auf `month <= currentMonth` filtert. Der ungefilterte Leser
`getCurrentOvertimeBalance()` wird von niemandem aufgerufen.

**Warum hier nichts geaendert wurde.** Ein Beschnitt auf heute fuer alle Monate
(`const endDate = new Date(Math.min(monthEnd.getTime(), today.getTime()));`) wurde gebaut
und gemessen: Er bringt auch `aggAll` auf 15/15 und setzt die Zeilen auf 0/0 zurueck. Er
widerspricht aber einer bereits getroffenen Entscheidung aus Phase 12:
`workPeriodChangeService.test.ts` (WR-02: Ein bereits materialisierter Zukunftsmonat wird
mit dem neuen Sollmodell nachgezogen) setzt materialisierte Zukunftsmonate ausdruecklich
voraus und wird durch die Aenderung rot — das verletzt die Zusicherung, dass die drei
vorbestehenden roten Tests nicht mehr werden duerfen. Die Aenderung wurde daher
**zurueckgenommen**.

Beide Lesarten mit ihren Zahlen:

| Lesart | Zukunftsmonate | Rest bei 3 / 17 (aggAll) | Bewertung |
|---|---|---|---|
| A: heutiger Stand — materialisieren, beim Lesen filtern | bleiben | -20,00 / -44,00 | Phase-12-Entscheidung; folgenlos, solange nur `getOvertimeBalance()` liest |
| B: Beschnitt auf heute fuer alle Monate | werden auf 0/0 gesetzt | 0,00 / 0,00 | naeher an CLAUDE.md Grundregel 1 (Referenz-Datum: IMMER heute); bricht den WR-02-Test |

`.claude/CLAUDE.md` legt Grundregel 1 nahe, entscheidet die Frage aber nicht ausdruecklich
fuer das *gespeicherte Aggregat* — die Regel spricht von der Berechnung. Das ist eine
Entscheidung des Anwenders, nicht des Debuggers.

Unabhaengig davon bleibt festzuhalten: Die beiden Leser derselben Tabelle behandeln
Zukunftsmonate unterschiedlich. Solange `getCurrentOvertimeBalance()` toter Code ist, ist
das folgenlos; wird er je benutzt, liefert er einen anderen Saldo als die Anwendung.
---

## 5. Was geaendert wurde

**Kein Produktionscode.** `git diff` beschraenkt sich auf eine Testdatei:

`server/src/services/overtimeTransactionRebuildService.test.ts` (+126 Zeilen) — neue
Testgruppe Gleichlauf Aggregat/kanonischer Weg bei allen Abwesenheitsarten, 7 Tests:

- je ein parametrisierter Test fuer `vacation`, `sick`, `overtime_comp`, `unpaid`: Aggregat
  und kanonischer Weg muessen in Soll, Ist und Saldo uebereinstimmen
- alle Arten gleichzeitig im selben Monat
- unbezahlter Urlaub senkt das Soll um genau einen Arbeitstag und gibt keine Ist-Gutschrift
- Ueberstundenausgleich laesst das Soll stehen und gibt keine Ist-Gutschrift (REQ-19)

### Nachweis, dass die Tests den behaupteten Defekt fangen

Da kein Fix noetig war, wurde umgekehrt der vom Urteil *behauptete* Defekt kuenstlich
eingebaut und geprueft, dass die Tests ihn melden.

**a) `overtime_comp` bekaeme im Aggregat eine Gutschrift** (Bedingung `!== overtime_comp`
aus `updateOvertimeBalanceForMonth()` entfernt):

```
FAIL  ... > Aggregat und kanonischer Weg stimmen bei Abwesenheitsart overtime_comp ueberein
AssertionError: expected 5 to be close to +0, received difference is 5, but expected 0.005
FAIL  ... > alle Abwesenheitsarten gleichzeitig im selben Monat: beide Wege bleiben deckungsgleich
AssertionError: expected 15 to be close to 10, received difference is 5, but expected 0.005
FAIL  ... > Ueberstundenausgleich laesst das Soll stehen und gibt keine Ist-Gutschrift (REQ-19)
AssertionError: expected 5 to be close to +0, received difference is 5, but expected 0.005
Tests  3 failed | 12 passed (15)
```

**b) `unpaid` senkte das Soll nicht mehr** (Fruehausstieg fuer `unpaid` in der
Soll-Summierung entfernt):

```
FAIL  ... > Aggregat und kanonischer Weg stimmen bei Abwesenheitsart unpaid ueberein
AssertionError: expected 105 to be close to 100, received difference is 5, but expected 0.005
FAIL  ... > alle Abwesenheitsarten gleichzeitig im selben Monat: beide Wege bleiben deckungsgleich
AssertionError: expected 105 to be close to 100, received difference is 5, but expected 0.005
FAIL  ... > unbezahlter Urlaub senkt das Soll um genau einen Arbeitstag und gibt keine Ist-Gutschrift (CLAUDE.md)
AssertionError: expected +0 to be close to 5, received difference is 5, but expected 0.005
Tests  3 failed | 12 passed (15)
```

Beide kuenstlichen Aenderungen wurden zurueckgenommen.

---

## 6. Gates

| Gate | Ergebnis |
|---|---|
| `cd server && npx tsc --noEmit` | Exit 0 |
| `cd desktop && npx tsc --noEmit` | Exit 0 |
| `cd server && npx vitest run` | **534 gruen / 3 rot** (vorher 527/3) |

Die drei roten sind unveraendert die vorbestehenden: `unifiedOvertimeService.test.ts`
(should respect hire date and not include pre-employment months; REGRESSION: User hired on
1st of month should calculate correctly) und `vacationBackfillService.test.ts` (erkennt
einen bereits gelaufenen Backfill). Es ist keiner hinzugekommen.

---

## 7. Empfehlung

1. **Nichts an der Berechnungslogik aendern.** Die beiden Rechenwege stimmen ueberein; das
   Urteil hat die Restabweichung falsch zugeordnet.
2. **Abschnitt 7.6 des Urteils und den Kommentarblock in `backfillOvertimeJournal.ts:85-111`
   korrigieren** — beide schreiben die Restabweichung dem Dual-Calculation-Problem zu.
3. **Kein Handlungsbedarf in Produktion**: dort stimmen bereits 15 von 15. Sollte eine
   Momentaufnahme erneut abweichen, genuegt ein Rebuild des laufenden Monats.
4. **Offen zur Entscheidung**: Zukunftsmonate im Aggregat (Abschnitt 4). Wenn Lesart B
   gewuenscht ist, gehoert der WR-02-Test aus Phase 12 mit angepasst — das ist eine
   Planaenderung, keine Fehlerbehebung.
