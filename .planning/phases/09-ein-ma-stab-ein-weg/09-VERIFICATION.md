---
phase: 09-ein-ma-stab-ein-weg
verified: 2026-08-21T23:17:18Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "`npm run validate:overtime:detailed` läuft für die drei Prüfnutzer ohne Abweichungsmeldung (ROADMAP-Erfolgskriterium 3) — Monatsend-Off-by-one in `overtimeTransactionRebuildService.ts` und `overtimeService.ts` behoben, mit Vorher/Nachher-Beleg gegen eine Wegwerfkopie (`09-ABSCHLUSS-NACHWEIS.md`)"
    - "CR-01 (Code-Review-Blocker): `overtimeLiveCalculationService.ts` kreditierte `overtime_comp` auf dem aktiven Lesepfad `GET /transactions/live` weiterhin wie `vacation`/`sick` — jetzt behoben, mit vier neuen Tests abgesichert"
    - "Bei der Planung neu gefundener aktiver Schreibpfad `overtimeService.ts:1331` (`ensureAbsenceTransactions()`, hinter `GET /transactions/monthly-summary`) schrieb bei einem Lesezugriff eine positive `overtime_comp_credit`-Zeile — jetzt behoben"
    - "D2 korrekt angewendet: Phase 9.1 in ROADMAP.md (Phasenübersicht-Tabelle + eigener Abschnitt) und REQUIREMENTS.md (Abdeckungstabelle, `9 → 9.1`) verankert — kein dritter Ausgang mehr offen"
  gaps_remaining: []
  regressions: []
---

# Phase 9: Ein Maßstab, ein Weg — Re-Verifikationsbericht (nach Lückenschluss 09-05)

**Phase-Ziel:** Vor dem ersten Umbau steht fest, dass alle Überstundenzahlen aus derselben Quelle
kommen. Kein Fundament mit Riss.
**Verifiziert:** 2026-08-21T23:17:18Z
**Status:** passed
**Re-Verifikation:** Ja — nach Lückenschluss Plan 09-05 (Reaktion auf `gaps_found` aus dem ersten
Durchgang)

## Zusammenfassung

Der erste Durchgang hatte einen offenen dritten Ausgang gefunden: Erfolgskriterium 3 der ROADMAP
(`npm run validate:overtime:detailed` läuft für die drei Prüfnutzer ohne Abweichungsmeldung)
schlug bei allen drei Prüfnutzern fehl, und dieser Fund war weder behoben noch nach D2 als
eigene Phase verankert. Plan 09-05 hat daraufhin die Kreditierungsregel vollständig gezählt
(zwölf statt der ursprünglich vermuteten vier Fundstellen), die beiden verbleibenden aktiven
Kopien geschlossen (Live-Lesepfad `overtimeLiveCalculationService.ts`, Schreibpfad
`overtimeService.ts:ensureAbsenceTransactions()`), die eigentliche Ursache des
Kriterium-3-Fehlschlags gefunden (ein Zeitzonen-Off-by-one, der den letzten Kalendertag jedes
Monats aus dem Transaktionsjournal ausschloss — nicht die zuvor vermuteten „fehlenden
Earned-Buchungen"), diesen Fehler im Code behoben und D2 korrekt angewendet: Der Codefix ist
abgeschlossen und belegt, der notwendige Backfill der bereits gespeicherten Produktionsdaten ist
als Phase 9.1 in ROADMAP.md und REQUIREMENTS.md verankert (kein dritter Ausgang mehr offen).

Bei eigenständiger Prüfung (Quellcode gelesen, `npx tsc --noEmit` erneut ausgeführt, `npx vitest
run` erneut ausgeführt, D5-Kanarientest erneut ausgeführt) sind alle Behauptungen aus der
09-05-SUMMARY bestätigt. Die einzige verbleibende Einschränkung — die im Folgenden ausführlich
begründet ist — betrifft die Lesart von Erfolgskriterium 3 gegenüber den bereits in einer
Datenbank gespeicherten (nicht neu aufgebauten) Journalzeilen.

## Goal Achievement

### Observable Truths — ROADMAP-Erfolgskriterien

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Dashboard und Berichte zeigen für denselben Nutzer/Monat denselben Überstundenwert — an ≥3 realen Nutzern geprüft | ✓ VERIFIED (unverändert seit Durchgang 1) | Durch Plan 09-05 nicht berührt. `09-ABSCHLUSS-NACHWEIS.md`, Abschnitt „NO REGRESSION" bestätigt erneut alle fünf Wege für alle drei Prüfnutzer nach dem Rebuild identisch (`-6,50h` / `-29,75h` / `-7,83h`). |
| 2 | Ein genehmigter `overtime_comp`-Antrag reduziert den Überstundensaldo, oder die Abweichung ist mit Grund dokumentiert | ✓ VERIFIED (Kernmechanismus, jetzt auf allen zwölf Fundstellen konsistent) | Eigene Quellcode-Prüfung: `unifiedOvertimeService.ts:336-357` (kanonisch, unverändert), `overtimeTransactionRebuildService.ts` (behoben in 09-04), `overtimeLiveCalculationService.ts:154-183,247-351` (CR-01, jetzt: `overtimeCompDates`-Menge, negative `earned`-Buchung statt Gutschrift, `hours = (type==='unpaid'\|\|type==='overtime_comp') ? 0 : targetHours`), `overtimeService.ts` (`ensureAbsenceTransactions()` und `ensureAbsenceTransactionsForMonth()`: `type IN ('vacation','sick','special','unpaid')` — `overtime_comp` aus der WHERE-Klausel entfernt, kein `case 'overtime_comp'` mehr im switch). Alle vier Fundstellen selbst gelesen und bestätigt. |
| 3 | `npm run validate:overtime:detailed` läuft für diese Nutzer ohne Abweichungsmeldung | ✓ VERIFIED — **bedingt: nach einem Rebuild des Transaktionsjournals** | Siehe ausführliche Begründung unten. Eigenständig nachvollzogen: Ursache war ein Zeitzonen-Off-by-one (`new Date(month + '-01')` parst als UTC statt lokal), nicht „fehlende Earned-Buchungen" (Fehldeutung im ersten Durchgang). Fix in `overtimeTransactionRebuildService.ts:66-67` und `overtimeService.ts` gelesen und bestätigt (lokale Datumszerlegung, exakt nach Vorbild `unifiedOvertimeService.ts:156-157`). D5-Kanarientest eigenständig wiederholt (`DATABASE_PATH=/home/ubuntu/databases/production.db npx tsx src/scripts/validateOvertimeDetailed.ts --userId=2 --month=2026-07` → Exit 2, kein Dateizugriff). |

**Score:** 2/3 unbedingt verifiziert, 1/3 mit dokumentierter Bedingung verifiziert — 3/3
Erfolgskriterien insgesamt erfüllt.

#### Begründung zu Truth 3 — die gewählte Lesart und warum

Der Befund selbst ist eindeutig und wurde vom Orchestrator bereits eigenständig gemessen: Auf den
**vorhandenen** Journalzeilen einer Kopie von `development.db` meldet das Werkzeug für userId 2
weiterhin `TRANSACTION MISMATCH -5.00h`; **nach** `npm run fill:transactions` (das transitiv
`ensureDailyOvertimeTransactions()` — die in Task 2 korrigierte Funktion — durchläuft) meldet es
für alle drei Prüfnutzer `✅ Database validation: PASSED` und `✅ Transaction validation: PASSED`.
Beide Aussagen sind wahr; die Frage ist, welche für den Abschluss der Phase zählt.

**Gewählte Lesart: erfüllt, mit Rebuild als dokumentierter Voraussetzung.** Begründung:

1. Die Rechenlogik ist nachweislich korrekt — nicht nur behauptet. Der Fehler war ein
   Zeitzonen-Off-by-one in der Journal-**Erzeugung**, keine falsche Kreditierungsregel. Nach
   jedem Neuaufbau (Rebuild) stimmt das Journal für alle drei Prüfnutzer exakt mit der
   berechneten Überstundensumme überein (`09-ABSCHLUSS-NACHWEIS.md`, Vorher/Nachher-Belege,
   eigenständig nachvollzogen).
2. Ein Nachtrag der bereits gespeicherten, veralteten Journalzeilen in der echten
   Produktionsdatenbank ist ein Schreibzugriff auf Bestandsdaten — genau der Produktionszugriff,
   den D5 in `09-CONTEXT.md` für Phase 9 ausdrücklich verbietet. Die Phase kann diesen Backfill
   nicht durchführen, ohne ihre eigene Leitplanke zu brechen.
3. D2 sieht für genau diesen Fall — ein Befund, der über eine reine Codeänderung hinausgeht —
   die Verankerung als eigene Phase vor, „kein dritter Ausgang". Plan 09-05 hat das getan: Phase
   9.1 steht in `.planning/ROADMAP.md` an der Phasenübersicht-Tabelle (`:26`) **und** als eigener
   Abschnitt (`:84-152`, eigenständig gelesen und bestätigt) sowie in `.planning/REQUIREMENTS.md`
   in der Abdeckungstabelle (`REQ-19 … 9 → 9.1`, `:166`) mit erklärendem Absatz (`:184-189`,
   ebenfalls gelesen). Dieser Absatz benennt den Rebuild-Vorbehalt wörtlich: „Offen bleibt
   ausschließlich der Backfill der bereits gespeicherten, unvollständigen
   `overtime_transactions`-Journalzeilen in der Produktionsdatenbank — der Codefix repariert nur
   künftige Rebuilds, nicht Bestandsdaten."
4. Dies unterscheidet sich fundamental vom Befund des ersten Durchgangs: Dort hatte Plan 09-04
   REQ-19 uneingeschränkt für „abgeschlossen" erklärt, ohne den fortbestehenden Mismatch zu
   erwähnen oder D2 anzuwenden — das war der eigentliche Blocker. Plan 09-05 wendet D2 jetzt
   korrekt an und verschweigt den Vorbehalt nicht, sondern dokumentiert ihn an drei Stellen
   (ROADMAP, REQUIREMENTS, `09-ABSCHLUSS-NACHWEIS.md`) wörtlich und unübersehbar.

**Was das für einen Anwender bedeutet, der das Werkzeug morgen startet:** Ein Lauf von
`npm run validate:overtime:detailed` gegen die **unveränderte** Produktionsdatenbank (oder eine
unveränderte Kopie von `development.db`) zeigt für die drei Prüfnutzer weiterhin eine
Transaktions-Abweichung, bis für den jeweiligen Nutzer/Monat ein Rebuild (`fill:transactions`
oder `rebuildOvertimeTransactionsForMonth()`) gelaufen ist. Das ist kein verstecktes Detail — es
ist der explizite Auftrag von Phase 9.1 („Journal-Backfill und Betriebs-Härtung",
`.planning/ROADMAP.md:84`), deren erstes Erfolgskriterium genau das verlangt: „Nach dem Backfill
zeigt `npm run validate:overtime:detailed` für eine Stichprobe realer Nutzer/Monate … keine
Transaktions-Abweichung mehr — **gegen die echte Produktionsdatenbank**." Phase 9 hat also nicht
weniger geliefert, als sie nach D2/D5 liefern durfte; der Rest ist bewusst, sauber und an der
richtigen Stelle verschoben, nicht verschwiegen.

### Weitere Must-Haves (aus `09-05-PLAN.md` must_haves, Lückenschluss-spezifisch)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 4 | Die Anzahl der Stellen, die `overtime_comp` wie `vacation`/`sick` kreditieren, ist gezählt und einzeln klassifiziert — nicht angenommen | ✓ VERIFIED | `09-INVENTAR-KREDITIERUNG.md` (218 Zeilen), vier dokumentierte Suchläufe mit Rohtrefferzahl, zwölf Fundstellen einzeln klassifiziert (1 kanonisch, 4 behoben 09-04, 5 in diesem Plan korrigiert, 2 bewusst unverändert mit Begründung). Eigenständig gelesen, Begründungen für die zwei unveränderten Stellen (`verifyTestData.ts:121`, toter Code `_calculateAbsenceCreditsForMonth`) nachvollziehbar und belegt (`grep`-Befehle im Dokument selbst nachvollzogen). |
| 5 | `GET /api/overtime/transactions/live` zeigt keine positive Gutschrift mehr für einen Ausgleichstag; Summe widerspricht `currentBalance` nicht | ✓ VERIFIED | Quellcode gelesen: `overtimeLiveCalculationService.ts:154-183` (neue `overtimeCompDates`-Menge), `:247-256` (Schritt 4, Ausnahme für `overtime_comp`), `:325-351` (Schritt 5, `hours = 0` für `overtime_comp`/`unpaid`). Vier neue Tests in `overtimeLiveCalculationService.test.ts:139-240` (`describe('… REQ-19/CR-01 overtime_comp')`) gelesen und bestätigt, dass sie den Fall tatsächlich prüfen (keine -4h `time_entry`-Buchung, keine `overtime_comp_credit`-Buchung ≠ 0). |
| 6 | `GET /api/overtime/transactions/monthly-summary` schreibt keine positive `overtime_comp_credit`-Buchung mehr | ✓ VERIFIED | `overtimeService.ts`, `ensureAbsenceTransactions()` (ab `:1257`) und `ensureAbsenceTransactionsForMonth()` (ab `:224`): beide WHERE-Klauseln `type IN ('vacation','sick','special','unpaid')`, kein `case 'overtime_comp'` mehr, `recordOvertimeCompCredit` bewusst nicht mehr importiert (Kommentarbeleg `:14-20`). Beide Fundstellen vollständig gelesen. |
| 7 | `validate:overtime:detailed` und `validate:overtime` klassifizieren `overtime_comp` genauso wie `unifiedOvertimeService.getAbsenceCredit()` | ✓ VERIFIED | `validateOvertimeDetailed.ts:544-556`: `type IN ('vacation','sick','special')`, `overtime_comp` entfernt, `special` ergänzt. `time_entry`→`earned`-Mapping (`:828`) korrigiert die im ersten Durchgang fehlgedeutete „0 Earned-Buchungen"-Anzeige. |
| 8 | `validate:overtime:detailed` liest `DATABASE_PATH` statt fest verdrahtetem Pfad, verweigert Produktionspfad | ✓ VERIFIED | Eigener Kanarientest wiederholt: `DATABASE_PATH=/home/ubuntu/databases/production.db npx tsx src/scripts/validateOvertimeDetailed.ts --userId=2 --month=2026-07` → Exit 2, Meldung „Produktionsschreibzugriff verweigert (D5, 09-CONTEXT.md)". Guard (`assertNotProduction()`) sitzt vor jedem `await import(...)`, kombinierter Vergleich (Pfadgleichheit + `NODE_ENV` + Substring-Fallback), Begründung für den Substring-Fallback im Kommentar (`getProductionDatabasePath()` löst strukturell nicht den realen Produktionspfad auf). Alle vier Werkzeuge (`validateOvertimeDetailed.ts`, `validateOvertimeCalculation.ts`, `compareOvertimePaths.ts`, `reproduceOvertimeCompDefect.ts`) tragen denselben Guard — per `grep` bestätigt. |
| 9 | `rebuildOvertimeTransactionsForMonth()` erfasst den letzten Kalendertag des Monats | ✓ VERIFIED | `overtimeTransactionRebuildService.ts:66-77`: lokale Zerlegung `split('-').map(Number)` → `new Date(jahr, monat, tag)` statt `new Date(month + '-01')`. Ausführlicher Kommentar erklärt die UTC/lokal-Diskrepanz korrekt. Vier neue Tests in `overtimeTransactionRebuildService.test.ts` (Sommer-/Wintermonat, `targetHours`-Konsistenz, Regression). |
| 10 | Für userId 2/16/17 ist mit Ausgabe belegt, ob `validate:overtime:detailed` abweichungsfrei läuft — und wenn nicht, Rest als Phase 9.1 in der ROADMAP | ✓ VERIFIED | `09-ABSCHLUSS-NACHWEIS.md` enthält für alle drei Nutzer wörtliche Vorher/Nachher-Ausgabe inkl. „VALIDATION STATUS". Phase 9.1 an allen drei vorgeschriebenen Stellen verankert (siehe Truth 3). |
| 11 | Für Nutzer ohne `workSchedule` und ohne `overtime_comp`-Antrag ändert sich keine Zahl | ✓ VERIFIED | `npx vitest run` eigenständig wiederholt: 218/221 bestanden, exakt dieselben drei vorbestehenden Fehlschläge (`unifiedOvertimeService.test.ts` ×2, `vacationBackfillService.test.ts` ×1) wie vor Plan 09-05 — keine Regression. `grep -n "isWeekend" overtimeService.ts overtimeLiveCalculationService.ts` liefert keinen Treffer (kein wiedereingeführter Vorfilter). |

**Score:** 8/8 Lückenschluss-Must-Haves verifiziert.

### Vorher offene Punkte aus dem Code-Review (`09-REVIEW.md`) — Status nach Lückenschluss

| Befund | Status | Beleg |
|---|---|---|
| CR-01 (Blocker): `overtimeLiveCalculationService.ts` kreditiert `overtime_comp` auf aktivem Lesepfad | ✓ Geschlossen | Siehe Truth 5 oben — Quellcode gelesen, vier Tests bestehen. |
| Neu bei der Planung von 09-05 gefunden: Schreibpfad `overtimeService.ts:1331` (`ensureAbsenceTransactions()`) | ✓ Geschlossen | Siehe Truth 6 oben. |
| WR-01: `toISOString()`-Zeitzonenfehler in `reproduceOvertimeCompDefect.ts` | ✓ Geschlossen | `grep -n "toISOString" src/scripts/reproduceOvertimeCompDefect.ts` — kein Treffer mehr; `formatDate(new Date(yy, mm, 0), 'yyyy-MM-dd')` an der Stelle (`:193`) bestätigt. |
| WR-02: Fehlende Tests für `overtimeService.ts`/`overtimeTransactionRebuildService.ts` | ⚠ Teilweise geschlossen, Rest dokumentiert offen | Beide Dateien haben jetzt Testdateien (4 Tests je Datei, eigenständig gezählt und gelesen). „WR-02 Restumfang" (weitere Servicefunktionen ohne Tests) explizit in ROADMAP Phase 9.1 verankert — kein stiller Rest. |
| WR-03: `fix-overtime.ts` löst Schema-Init gegen Produktion aus; kein `busy_timeout` | ✓ Abschließend bewertet, Restpunkt verankert | `09-ABSCHLUSS-NACHWEIS.md`: gemessen (`PRAGMA table_info(users)`, `notnull=0` → Migrationszweig inert), Wechsel auf geteilte Verbindung als Nettoverbesserung bewertet. `busy_timeout`-Lücke (`grep -rn "busy_timeout" server/src` — kein Treffer, eigenständig bestätigt) explizit in ROADMAP Phase 9.1 verankert. |
| WR-04: `server/scripts/**` ungetypt | ⚠ Nicht behoben, in Phase 9.1 verankert | `.planning/ROADMAP.md:84`-Abschnitt „Phase 9.1", Umfangspunkt „WR-04". |
| WR-05: `fix-overtime.ts` ohne Fehlerisolierung pro Nutzer | ⚠ Nicht behoben, in Phase 9.1 verankert | Ebenda, Umfangspunkt „WR-05". |
| WR-06: Heuristischer Produktionsschutz (Substring statt Pfadvergleich) | ✓ Geschlossen | Alle vier Werkzeuge nutzen jetzt `path.resolve(getDatabasePath()) === path.resolve(getProductionDatabasePath())` als primären Vergleich (per `grep` in allen vier Dateien bestätigt), Substring bleibt als zusätzlicher, begründeter Fallback erhalten. |
| WR-07: Fixture-abhängiger Feiertagstest | ⚠ Nicht behoben, in Phase 9.1 verankert | Ebenda, Umfangspunkt „WR-07". |

Kein Befund aus dem Review wurde stillschweigend fallengelassen — jeder ist entweder im
Quellcode geschlossen oder namentlich in der ROADMAP als Phase-9.1-Umfang verankert.

### Required Artifacts (Lückenschluss)

| Artifact | Erwartet | Status | Details |
|---|---|---|---|
| `09-INVENTAR-KREDITIERUNG.md` | Vollzähliges, klassifiziertes Inventar | ✓ VERIFIED | 218 Zeilen, zwölf Fundstellen, Suchläufe mit Rohtreffern, Urteilsabschnitt |
| `09-ABSCHLUSS-NACHWEIS.md` | Kriterium-3-Belege, D2-Entscheidung, WR-03-Bewertung | ✓ VERIFIED | 405 Zeilen, wörtliche Vorher/Nachher-Ausgabe für alle drei Nutzer, Ursachenkorrektur, `deferred-items.md`-Auflösung, G5-Einordnung |
| `server/src/services/overtimeService.test.ts` | Regressionstest Schreibpfad | ✓ VERIFIED | Existiert, 4 Testfälle, Teil der grünen Gesamtsuite |
| `server/src/services/overtimeTransactionRebuildService.test.ts` | Regressionstest Monatsende | ✓ VERIFIED | Existiert, 4 Testfälle, Teil der grünen Gesamtsuite |
| `deferred-items.md` | Auflösung des zurückgestellten 36h-Befunds | ✓ VERIFIED | Abschnitt „AUFLÖSUNG (09-05, Task 4)" — Ursache identifiziert, Verweis auf Phase 9.1 für den Restpunkt |
| `.planning/ROADMAP.md` | Phase 9.1 an drei Stellen | ✓ VERIFIED | Phasenübersicht-Tabelle (`:26`), eigener Abschnitt (`:84-152`) |
| `.planning/REQUIREMENTS.md` | Abdeckungstabelle `9 → 9.1` | ✓ VERIFIED | `:166` (Tabelle), `:184-189` (erklärender Absatz) |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `routes/overtime.ts` (`GET /transactions/live`) | `overtimeLiveCalculationService.ts` | `calculateLiveOvertimeTransactions()` | ✓ WIRED | Fix sitzt direkt in der aufgerufenen Funktion, kein Umweg |
| `routes/overtime.ts` (`GET /transactions/monthly-summary`) | `overtimeService.ts` | `ensureDailyOvertimeTransactions()` → `ensureAbsenceTransactions()` | ✓ WIRED | Aufrufkette per `grep` erneut nachvollzogen (`:610`, `:781`, `:875`) |
| `validateOvertimeDetailed.ts` | `config/database.ts` | `getDatabasePath()`/`getProductionDatabasePath()` | ✓ WIRED | Kanarientest bestanden (Exit 2) |
| `09-05-PLAN.md`/`09-ABSCHLUSS-NACHWEIS.md` | `ROADMAP.md` (Phase 9.1) | D2-Verankerung | ✓ WIRED | Alle drei vorgeschriebenen Stellen bestätigt |

### Behavioral Spot-Checks (eigenständig ausgeführt, unabhängig vom Orchestrator)

| Behavior | Command | Result | Status |
|---|---|---|---|
| D5-Kanarientest gegen realen Produktionspfad | `DATABASE_PATH=/home/ubuntu/databases/production.db npx tsx src/scripts/validateOvertimeDetailed.ts --userId=2 --month=2026-07` | Exit 2, „Produktionsschreibzugriff verweigert" | ✓ PASS |
| Typcheck Server | `cd server && npx tsc --noEmit` | keine Fehler | ✓ PASS |
| Serversuite (Regressionsgrenze) | `cd server && npx vitest run` | 218/221 bestanden, exakt dieselben drei vorbestehenden Fehlschläge (`unifiedOvertimeService.test.ts` ×2, `vacationBackfillService.test.ts` ×1) | ✓ PASS (keine Regression) |
| `toISOString()`-Entfernung | `grep -n "toISOString" src/scripts/reproduceOvertimeCompDefect.ts` | kein Treffer | ✓ PASS |
| `isWeekend`-Vorfilter nicht wiedereingeführt | `grep -n "isWeekend" overtimeService.ts overtimeLiveCalculationService.ts` | kein Treffer | ✓ PASS |
| `overtime_comp`-Kreditfilter in beiden Schreibpfaden entfernt | Quellcode gelesen (`overtimeService.ts:1257-1400`, `:224-390`) | `type IN ('vacation','sick','special','unpaid')`, kein `case 'overtime_comp'` | ✓ PASS |

### Requirements Coverage

| Requirement | Quelle | Beschreibung | Status | Evidence |
|---|---|---|---|---|
| REQ-17 | 09-01, 09-03 | Genau ein Weg zur Sollstundenermittlung | ✓ SATISFIED | Unverändert seit Durchgang 1; kein wiedereingeführter Vorfilter in dieser Runde (Spot-Check oben) |
| REQ-18 | 09-02, 09-03 | Legacy-Pfad angeglichen, übereinstimmende Werte | ✓ SATISFIED | Unverändert seit Durchgang 1, NO-REGRESSION-Nachweis erneut bestätigt |
| REQ-19 | 09-01, 09-04, 09-05 | `overtime_comp`-Defekt behoben oder dokumentiert offen | ✓ SATISFIED (Kernmechanismus vollständig, Rest korrekt nach Phase 9.1 verankert) | Siehe Truth 2, 3, 4-11. `.planning/REQUIREMENTS.md:184-189` bestätigt dieselbe Einordnung. |

Keine verwaisten Requirements gefunden.

### Anti-Patterns Found

Keine TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in den von Plan 09-05 geänderten Dateien
(`overtimeLiveCalculationService.ts`, `overtimeService.ts`, `overtimeTransactionRebuildService.ts`,
`overtimeTransactionService.ts`, `validateOvertimeDetailed.ts`, `validateOvertimeCalculation.ts`,
`reproduceOvertimeCompDefect.ts`, `compareOvertimePaths.ts`). Die Kommentare, die frühere Fixes
referenzieren (`recordOvertimeCompCredit bewusst NICHT importiert`), sind Begründungen, keine
Debt-Marker.

### Human Verification Required

Keine. Diese Phase ist rein serverseitig/analytisch; die Rebuild-Bedingung aus Truth 3 ist
maschinell nachvollzogen (Vorher/Nachher-Ausgabe, D5-Kanarientest) und nicht visuell/subjektiv.
Auf ausdrückliche Anweisung des Anwenders sind UAT-Punkte am Ende des Milestones gebündelt; diese
Phase liefert keinen Punkt, der die Sachlichkeit ohne menschliche Prüfung blockieren würde.

### Gaps Summary

Keine. Der im ersten Durchgang gefundene dritte Ausgang (Erfolgskriterium 3 weder erfüllt noch
nach D2 verankert) ist geschlossen: Die eigentliche Ursache (Zeitzonen-Off-by-one im
Transaktionsjournal) ist gefunden, behoben und mit Vorher/Nachher-Beleg gegen eine Wegwerfkopie
nachgewiesen; der verbleibende Rest — der Backfill bereits gespeicherter Produktionsdaten, den
D5 in Phase 9 verbietet — ist korrekt und an allen vorgeschriebenen Stellen als Phase 9.1
verankert. CR-01 und der bei der Planung neu gefundene Schreibpfad-Blocker sind geschlossen. Das
Inventar weist zwölf statt der ursprünglich vier vermuteten Fundstellen nach, alle klassifiziert,
alle erreichbaren Produktivpfade geschlossen. Keine Regression: `npx tsc --noEmit` fehlerfrei,
`npx vitest run` zeigt unverändert dieselben drei vorbestehenden, dokumentierten Fehlschläge.

---

_Verified: 2026-08-21T23:17:18Z_
_Verifier: Claude (gsd-verifier)_
