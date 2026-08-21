---
phase: 09-ein-ma-stab-ein-weg
verified: 2026-08-21T21:57:22Z
status: gaps_found
score: 8/9 must-haves verified
overrides_applied: 0
gaps:
  - truth: "`npm run validate:overtime:detailed` läuft für die drei Prüfnutzer ohne Abweichungsmeldung (ROADMAP-Erfolgskriterium 3)"
    status: failed
    reason: >
      Live gegen server/database/development.db ausgeführt (21.08.2026, Commit 0caf530) für alle drei
      Prüfnutzer aus 09-PRUEFNUTZER.csv. Alle drei melden eine Abweichung:
      userId 2 (Karin Jochem, 2026-07): TRANSACTION MISMATCH -5.00h.
      userId 16 (Benedikt Jochem, 2026-07): TRANSACTION MISMATCH -1.25h.
      userId 17 (Carmen Rothemund, 2026-04): DATABASE MISMATCH +4.00h UND TRANSACTION MISMATCH +0.59h.
      Zwei getrennte Ursachen: (a) validateOvertimeDetailed.ts:492 führt eine eigene, von Plan 09-04
      nicht mit-korrigierte SQL-Abfrage `type IN ('vacation', 'sick', 'overtime_comp')` — dieselbe
      H1-Fehlklassifikation, die in unifiedOvertimeService.ts und overtimeTransactionRebuildService.ts
      behoben wurde, lebt in diesem Diagnosewerkzeug unverändert weiter und verursacht bei Nutzer 17
      die DATABASE MISMATCH. (b) Bei allen drei Nutzern — auch den beiden ohne jeden overtime_comp-Bezug
      — fehlen in overtime_transactions die "Earned"-Buchungen für geleistete Arbeitsstunden
      vollständig (0 txs trotz realer Arbeitszeit), was die TRANSACTION MISMATCH erzeugt. Dieser
      Befund war bereits in 09-VERGLEICH-BEFUND.md (Plan 09-02, vor jeder Codeänderung) dokumentiert,
      wurde aber von keinem der Pläne 09-03/09-04 behoben, obwohl das Erfolgskriterium der ROADMAP
      genau dieses Werkzeug als Abnahmekriterium benennt. D2 verlangt bei einem in Phase 9 nicht
      behebbaren Defekt eine Verankerung als Phase 9.1 in der ROADMAP — das ist nicht geschehen; die
      SUMMARY von Plan 09-04 erklärt REQ-19 stattdessen uneingeschränkt für "abgeschlossen (behoben)".
    artifacts:
      - path: "server/src/scripts/validateOvertimeDetailed.ts"
        issue: "Zeile 492: eigene SQL-Abfrage klassifiziert overtime_comp weiterhin als Saldo-Gutschrift — identische Fehlklassifikation wie die in Plan 09-04 behobene H1-Ursache, hier nicht mitgezogen."
      - path: "server/src/services/overtimeTransactionService.ts"
        issue: "overtime_transactions erhält für reguläre Zeiteinträge keine 'earned'-Buchungen — die Transaktions-Validierung des Werkzeugs kann dadurch für keinen der drei Prüfnutzer bestehen, unabhängig von overtime_comp."
    missing:
      - "validateOvertimeDetailed.ts:492 auf denselben Maßstab ziehen wie unifiedOvertimeService.ts (overtime_comp aus der Credit-Liste entfernen) — oder begründen, warum das Werkzeug bewusst eine andere Fachlogik prüft."
      - "Entscheidung nach D2 für den 'Earned-Transactions-fehlen'-Befund: entweder in Phase 9 beheben oder als Phase 9.1 in ROADMAP.md (Phasenübersicht-Tabelle UND Abdeckungstabelle) verankern, wie es das eigene Entscheidungsschema von Plan 09-04 für unbehobene Fälle vorschreibt."
      - "Erfolgskriterium 3 der ROADMAP entweder durch einen tatsächlich abweichungsfreien Lauf belegen, oder ausdrücklich als bewusst offen dokumentieren (analog zur Behandlung von REQ-19 in D2)."
human_verification: []
---

# Phase 9: Ein Maßstab, ein Weg — Verifikationsbericht

**Phase-Ziel:** Vor dem ersten Umbau steht fest, dass alle Überstundenzahlen aus derselben Quelle
kommen. Kein Fundament mit Riss.
**Verifiziert:** 2026-08-21T21:57:22Z
**Status:** gaps_found
**Re-Verifikation:** Nein — Erstverifikation

## Zusammenfassung

Phase 9 hat echte, gut belegte Arbeit geleistet: Ein vollständiges Fundstellen-Inventar (23
Zeilen), ein neues, technisch abgesichertes Vergleichswerkzeug (`validate:overtime:paths`) mit
funktionierendem Produktions-Guard, die Beseitigung eines realen Produktionsfehlers
(`fix-overtime.ts`, Abweichung A-1, live gegen eine reale Nutzerin mit `workSchedule`
nachgewiesen), die Entfernung von fünf Wochenend-Vorfiltern im Legacy-Pfad, und die Behebung des
REQ-19-Kernbefunds (`overtime_comp` neutralisierte bisher den Ausgleichstag statt den Saldo zu
senken) — alles mit Vorher/Nachher-Zahlen statt Behauptungen, alles bei eigener Nachprüfung im
Code bestätigt.

Das dritte ROADMAP-Erfolgskriterium — `npm run validate:overtime:detailed` läuft für die drei
Prüfnutzer ohne Abweichungsmeldung — ist jedoch bei einem eigenständigen Lauf gegen den aktuellen
Codestand für **alle drei** Prüfnutzer fehlgeschlagen. Das war der explizit zu prüfende Punkt
dieses Auftrags, und der Befund bestätigt sich: Der Mismatch, den Plan 09-02 bereits vor jeder
Codeänderung gemeldet hatte, besteht nach Abschluss aller vier Pläne unverändert fort.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Dashboard und Berichte zeigen für denselben Nutzer/Monat denselben Überstundenwert — an ≥3 realen Nutzern geprüft | ✓ VERIFIED | Eigener Lauf `cd server && npm run validate:overtime:paths -- --from=../.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv` (21.08.2026, Commit 0caf530): Exit 0, alle fünf Wege (`unified`, `dashboard`, `report_summary`, `report_daily`, `balance_row`) stimmen für Karin Jochem (2), Benedikt Jochem (16), Carmen Rothemund (17) exakt überein. Zusätzlich dokumentiert in `09-VERGLEICH-BEFUND.md` und `09-ANGLEICHUNG-NACHWEIS.md` mit Vorher/Nachher-Werten. |
| 2 | Ein genehmigter `overtime_comp`-Antrag reduziert den Überstundensaldo, oder die Abweichung ist mit Grund dokumentiert | ✓ VERIFIED | Code gelesen: `unifiedOvertimeService.ts:335-353` (`getAbsenceCredit`) — `overtime_comp` explizit aus der Credit-Liste entfernt, mit Verweis auf REQ-19/09-REQ19-BEFUND.md im Kommentar. Eigener Lauf bestätigt: Carmen Rothemund (17), Monat 2026-04 — Überstundensaldo `-3.83h` (vorher, saldoneutral) → `-7.83h` (jetzt), exakt die 4h Sollstunden des Ausgleichstags. `09-REQ19-BEFUND.md` (276 Zeilen) belegt Reproduktion, drei geprüfte Hypothesen (H1 bestätigt als Ursache, H2/H3 bestätigt als Nebeneffekt) und den Fix in zwei Services mit Begründung, warum beide nötig waren. |
| 3 | `npm run validate:overtime:detailed` läuft für diese Nutzer ohne Abweichungsmeldung | ✗ FAILED | Eigener Lauf für alle drei Prüfnutzer (21.08.2026, Commit 0caf530): userId 2 → `❌ TRANSACTION MISMATCH: -5.00h`; userId 16 → `❌ TRANSACTION MISMATCH: -1.25h`; userId 17 → `❌ DATABASE MISMATCH: +4.00h` UND `❌ TRANSACTION MISMATCH: +0.59h`. Siehe Gap-Eintrag unten für Ursachenanalyse. |

**Score:** 2/3 ROADMAP-Erfolgskriterien direkt verifiziert; 6 weitere abgeleitete Must-Haves (unten) verifiziert.

### Weitere Must-Haves (REQ-17/18/19, D1–D5, Phasenumfang)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 4 | REQ-17: Kein Produktivpfad berechnet Soll-Arbeitszeit mehr an `getDailyTargetHours()` vorbei | ✓ VERIFIED | `09-INVENTAR-SOLLSTUNDEN.md` (334 Zeilen, 23 klassifizierte Fundstellen). Ursprünglich 1 Abweichung (A-1, `fix-overtime.ts`) plus 1 funktional gleicher Fund in `overtimeLiveCalculationService.ts` — beide in Plan 09-03 behoben. Eigene Prüfung: `grep -n "isWeekend" server/src/services/overtimeService.ts` → leer; `grep "weeklyHours / 5" server/scripts/fix-overtime.ts` → nur im Kommentar (historische Erklärung); `export function getAllWorkingDaysBetween` ruft `getDailyTargetHours(user` auf. Einschränkung: `validateOvertimeDetailed.ts` wurde im Inventar bewusst als "kein Produktivpfad" ausgeschlossen (nicht über Route/Cron erreichbar) — dieselbe Datei ist aber das in Erfolgskriterium 3 namentlich genannte Abnahmewerkzeug und enthält nachweislich noch eine abweichende Logik (siehe Gap). |
| 5 | REQ-18: Legacy-Pfad `overtimeService.ts` angeglichen, nicht stillgelegt (D1) | ✓ VERIFIED | `grep -c "^export" server/src/services/overtimeService.ts` unverändert bei 16 Exporten (Plan-Vorgabe). `updateMonthlyOvertime` delegiert weiter an `unifiedOvertimeService.calculateMonthlyOvertime`. Fünf Wochenend-/Feiertags-Vorfilter entfernt, `getDailyTargetHours()` bleibt einzige Instanz. `09-ANGLEICHUNG-NACHWEIS.md` (156 Zeilen) mit Belegkette und Exit-Codes. |
| 6 | REQ-19: Bekannter Defekt behoben oder bewusst dokumentiert offen — kein dritter Ausgang (D2) | ✓ VERIFIED (Kernbefund) — siehe jedoch Gap zu Kriterium 3 | Zweig A gewählt und umgesetzt: `unifiedOvertimeService.ts` + `overtimeTransactionRebuildService.ts` geändert, TDD-Test in `unifiedOvertimeService.test.ts`, Reproduktionsskript zeigt Exit 1→0. `deferred-items.md` (52 Zeilen) dokumentiert einen pre-existierenden, unabhängigen Nebenbefund (targetHours-Diskrepanz in `overtimeTransactionRebuildService.ts`, per Gegenprobe als nicht selbst verursacht verifiziert). Der in dieser Verifikation neu bestätigte Fortbestand der `validate:overtime:detailed`-Mismatches wurde NICHT als Phase 9.1 verankert, obwohl D2 dafür "kein dritter Ausgang" vorschreibt. |
| 7 | Vier offene Debug-Sessions gesichtet und zugeordnet | ✓ VERIFIED | `09-DEBUG-SICHTUNG.md` (237 Zeilen). Alle vier Sessions (`carmen-rothemund-overtime-analysis`, `overtime-compensation-workschedule-bug`, `overtime-validation-backend-mismatch`, `OVERTIME-FIX-PLAN`) mit Status, Zeilenbeleg und Nachfolgeplan. Zwei zurückgestellte Sessions (`unpaid-leave-logic-issues`, `notifications-position-column-missing`) korrekt als außerhalb des Milestones vermerkt. |
| 8 | D5 — kein Produktionsschreibzugriff, technisch erzwungen | ✓ VERIFIED | Eigener Kanarientest wiederholt: `DATABASE_PATH="$PWD/.tmp-guardcheck2/production.db" npx tsx src/scripts/compareOvertimePaths.ts --userId=1 --month=2026-01` → Exit 2, kein Verzeichnis angelegt (`test -e .tmp-guardcheck2` negativ). Guard sitzt nachweislich vor jedem Import eines schreibenden Service-Moduls. |
| 9 | Inventar als dauerhaftes, wiederverwendbares Artefakt für Phase 11/14 | ✓ VERIFIED | `09-INVENTAR-SOLLSTUNDEN.md` existiert eigenständig im Phasenverzeichnis, nicht nur im SUMMARY. `09-VERGLEICH-BASELINE.json` und `09-ANGLEICHUNG-BASELINE.json` liegen als JSON-Grundlinien vor, mit `--json=<pfad>` reproduzierbar. |

### Required Artifacts

| Artifact | Erwartet | Status | Details |
|---|---|---|---|
| `09-INVENTAR-SOLLSTUNDEN.md` | Vollständiges Fundstellen-Inventar | ✓ VERIFIED | 334 Zeilen, 23 Fundstellen, Urteil REQ-17 aktualisiert |
| `09-DEBUG-SICHTUNG.md` | Sichtung der vier Debug-Sessions | ✓ VERIFIED | 237 Zeilen |
| `server/src/scripts/overtimePathComparison.ts` + `.test.ts` | Reine Vergleichslogik + Tests | ✓ VERIFIED | `npx vitest run src/scripts/overtimePathComparison.test.ts` läuft (Teil der 206/209 grünen Gesamtsuite) |
| `server/src/scripts/compareOvertimePaths.ts` | CLI mit Produktions-Guard | ✓ VERIFIED | Guard eigenständig erneut getestet (Exit 2, kein Dateizugriff) |
| `09-PRUEFNUTZER.md`/`.csv` | Drei reale Prüfnutzer nach D4 | ✓ VERIFIED | userId 2/16/17, konsistent über alle vier Pläne verwendet |
| `09-VERGLEICH-BEFUND.md` | Erstbefund vor Codeänderung | ✓ VERIFIED | 155 Zeilen, dokumentiert bereits den TRANSACTION-MISMATCH-Befund |
| `server/scripts/fix-overtime.ts` (A-1-Fix) | Kanonischer Weg statt Bypass | ✓ VERIFIED | Importiert `ensureOvertimeBalanceEntries` aus `overtimeService.ts`, kein `weeklyHours / 5`-Bypass mehr im Code |
| `09-A1-NACHWEIS.md` | Vorher/Nachher-Beleg A-1 | ✓ VERIFIED | 246 Zeilen |
| `server/src/scripts/reproduceOvertimeCompDefect.ts` | Reproduktion REQ-19 | ✓ VERIFIED | Guard-Muster identisch zu `compareOvertimePaths.ts` |
| `09-REQ19-BEFUND.md` | Ursache + D2-Entscheidung | ✓ VERIFIED | 276 Zeilen, H1/H2/H3 geprüft, Zweig A begründet |
| `deferred-items.md` | Zurückgestellte Nebenbefunde | ✓ VERIFIED | 52 Zeilen — enthält jedoch NICHT den hier gefundenen `validate:overtime:detailed`-Mismatch |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `overtimeLiveCalculationService.ts` | `workingDays.ts` | `getDailyTargetHours(user...)` | ✓ WIRED | 5 Aufrufstellen bestätigt |
| `overtimeService.ts` | `unifiedOvertimeService.ts` | `updateMonthlyOvertime` → `calculateMonthlyOvertime` | ✓ WIRED | Bestätigt, unverändert |
| `fix-overtime.ts` | `overtimeService.ts` | `ensureOvertimeBalanceEntries` Import | ✓ WIRED | Bestätigt im Quellcode |
| `compareOvertimePaths.ts` / `reproduceOvertimeCompDefect.ts` | `database.ts`/`connection.ts` | Guard vor dynamischem Import | ✓ WIRED | Kanarientest bestanden |
| `09-REQ19-BEFUND.md` | `ROADMAP.md` (Phase 9.1) | bei Zweig B | N/A | Zweig A gewählt — Phase 9.1 nicht erforderlich für REQ-19 selbst. Für den hier neu bestätigten Kriterium-3-Mismatch fehlt diese Verankerung jedoch (siehe Gap). |

### Behavioral Spot-Checks (eigenständig ausgeführt)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Fünf-Wege-Vergleich für 3 reale Nutzer | `cd server && npm run validate:overtime:paths -- --from=...09-PRUEFNUTZER.csv` | Exit 0, alle Werte identisch | ✓ PASS |
| Detailvalidierung Nutzer 2 | `cd server && npm run validate:overtime:detailed -- --userId=2 --month=2026-07` | `❌ TRANSACTION MISMATCH: -5.00h` | ✗ FAIL |
| Detailvalidierung Nutzer 16 | `cd server && npm run validate:overtime:detailed -- --userId=16 --month=2026-07` | `❌ TRANSACTION MISMATCH: -1.25h` | ✗ FAIL |
| Detailvalidierung Nutzer 17 | `cd server && npm run validate:overtime:detailed -- --userId=17 --month=2026-04` | `❌ DATABASE MISMATCH: +4.00h`, `❌ TRANSACTION MISMATCH: +0.59h` | ✗ FAIL |
| Produktions-Guard (Kanarienpfad) | `DATABASE_PATH=.../production.db npx tsx compareOvertimePaths.ts` | Exit 2, kein Dateizugriff | ✓ PASS |
| Typcheck Server | `cd server && npx tsc --noEmit` | keine Fehler | ✓ PASS |
| Serversuite (Regressionsgrenze) | `cd server && npx vitest run` | 206/209 bestanden, dieselben 3 vorbestehenden Fehlschläge wie vor Phase 9 (unabhängig verifiziert, siehe `known_context` des Auftrags) | ✓ PASS (keine Regression) |

**Hinweis zur Methodik:** Die Läufe gegen `validate:overtime:paths` und `validate:overtime:detailed`
erfolgten direkt gegen `server/database/development.db` (nicht gegen eine Kopie), weil
`validate:overtime:detailed` rein lesend ist und `validate:overtime:paths` — wie in den Plänen 09-02/
09-04 selbst so vorgesehen und praktiziert — über `ensureOvertimeBalanceEntries()` lediglich
`overtime_balance`-Zeilen auf den bereits im Code hinterlegten korrekten Stand bringt (Selbstheilung,
kein experimenteller Zustand). Es wurden keine Migrationen, Löschungen oder sonstigen destruktiven
Operationen ausgeführt.

### Requirements Coverage

| Requirement | Quelle | Beschreibung | Status | Evidence |
|---|---|---|---|---|
| REQ-17 | 09-01, 09-03 | Genau ein Weg zur Sollstundenermittlung | ✓ SATISFIED | Inventar + Angleichung, siehe Truth 4 |
| REQ-18 | 09-02, 09-03 | Legacy-Pfad angeglichen, übereinstimmende Werte | ✓ SATISFIED | Siehe Truth 1, 5 |
| REQ-19 | 09-01, 09-04 | `overtime_comp`-Defekt behoben oder dokumentiert offen | ✓ SATISFIED (Kernmechanismus) | Siehe Truth 2, 6 — Erfolgskriterium 3 der ROADMAP bleibt trotzdem offen (siehe Gap) |

Keine verwaisten Requirements gefunden (`grep "Phase 9" REQUIREMENTS.md` liefert nur Fließtext-Erwähnungen, keine zusätzlichen REQ-IDs).

### Anti-Patterns Found

Keine TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in den von Phase 9 geänderten Dateien
(`overtimeLiveCalculationService.ts`, `overtimeService.ts`, `fix-overtime.ts`,
`unifiedOvertimeService.ts`, `overtimeTransactionRebuildService.ts`, `compareOvertimePaths.ts`,
`reproduceOvertimeCompDefect.ts`, `overtimePathComparison.ts`).

Ein Befund außerhalb des Anti-Pattern-Scans, aber im Kern dieser Verifikation: Die von Plan 09-04
korrigierte Fachlogik (H1: `overtime_comp` ist keine Saldo-Gutschrift) existiert unverändert ein
drittes Mal in `server/src/scripts/validateOvertimeDetailed.ts:492` — nicht als Debt-Marker
gekennzeichnet, sondern als stille, unkorrigierte Dublette. Das ist der eigentliche Grund, warum
Erfolgskriterium 3 fehlschlägt.

### Human Verification Required

Keine. Auf ausdrückliche Anweisung sind UAT-/Sichtprüfungspunkte am Ende des Milestones gebündelt.
Diese Phase ist rein serverseitig/analytisch; es gibt keine primär visuelle oder Echtzeit-Prüfung,
die die Sachlichkeit dieser Phase blockieren würde. Der einzige Blocker ist maschinell verifizierbar
und oben als Gap dokumentiert.

### Gaps Summary

Die Phase hat drei von vier inhaltlichen Aufgaben aus dem ROADMAP-Umfang vollständig und mit
Nachweis erledigt (Inventar, Angleichung, REQ-19-Kernmechanismus). Das dritte ROADMAP-
Erfolgskriterium — der abweichungsfreie Lauf von `npm run validate:overtime:detailed` für die drei
Prüfnutzer — ist bei eigener Prüfung nicht erfüllt. Der Befund war Plan 09-02 bereits vor jeder
Codeänderung bekannt und wurde in `09-VERGLEICH-BEFUND.md` korrekt als "kein Fixversuch — Gegenstand
von Plan 09-04" vermerkt. Plan 09-04 hat jedoch nur den Teil des Defekts behoben, der die
Saldo-Neutralisierung des Ausgleichstags selbst betrifft (H1), nicht den davon unabhängigen, bei
allen drei Nutzern auftretenden Mismatch der Transaktions-Validierung (fehlende „Earned"-Buchungen)
und nicht die im Diagnosewerkzeug selbst verbliebene Dublette der H1-Logik. Der eigene
Entscheidungsrahmen der Phase (D2: „Entweder behoben und Nachweis geführt, oder Phase 9.1 in der
ROADMAP — kein dritter Ausgang") wurde für diesen konkreten, noch offenen Teilbefund nicht
angewendet — die SUMMARY von Plan 09-04 erklärt REQ-19 uneingeschränkt für abgeschlossen, ohne den
fortbestehenden Mismatch im namentlich genannten Abnahmewerkzeug zu benennen.

Dies ist kein Einwand gegen die Qualität der geleisteten Arbeit — die Angleichung (REQ-17/18) und
der REQ-19-Kernfix sind sauber belegt und bei eigener Nachprüfung bestätigt. Es ist ein konkretes,
noch offenes drittes Erfolgskriterium, das vor dem Abschluss der Phase entweder behoben oder nach
dem eigenen D2-Verfahren als Phase 9.1 verankert werden muss.

---

_Verified: 2026-08-21T21:57:22Z_
_Verifier: Claude (gsd-verifier)_
