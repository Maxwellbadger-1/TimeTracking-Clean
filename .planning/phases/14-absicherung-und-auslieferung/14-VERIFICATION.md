---
phase: 14-absicherung-und-auslieferung
verified: 2026-08-28T00:00:00Z
verified_at_commit: c0acb59
status: human_needed
score: 9/11 Pläne mit vollständigem Artefaktnachweis, 2 Pläne sachlich erfüllt ohne eigenes Artefakt; 3/4 ROADMAP-Erfolgskriterien voll erfüllt, 1 eingeschränkt (nicht geschönt)
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  note: "Nachträgliche Erstverifikation, angestoßen durch /gsd:audit-milestone am 28.08.2026 — Phase 14 war als einzige Phase des Milestones nie verifiziert worden. Alle Artefakte und Muster wurden am Stand c0acb59 eigenständig gegen das Dateisystem und den Code geprüft, nicht aus den SUMMARY-Dateien übernommen. tsc --noEmit wurde für Server und Desktop am 28.08.2026 neu ausgeführt."
partial:
  - truth: "Alle Salden von Nutzern ohne Modellwechsel sind vor und nach dem Produktionslauf identisch (ROADMAP-Erfolgskriterium 1)"
    status: partial
    reason: >-
      In der wörtlichen Fassung nicht erfüllt. Der maschinelle Vergleich
      (14-VERGLEICH-VOR-NACH.md) meldet 99 Abweichungen bei 8 von 20 Nutzern zwischen dem
      Stand vor dem Deployment vom 23.08.2026 und dem Stand danach. Das Kriterium zielte auf
      die Nullwirkung der Migration — die ist belegt (14-MIGRATIONSSTAND.md: Differenz exakt 0
      in overtime_transactions und overtime_balance, integrity_check ok, foreign_key_check
      leer). Dasselbe Deployment trug aber auch die Rechenkorrekturen der Phasen 9 und 11
      mit, und die sollen Zahlen bewegen. Das Kriterium trennt beides nicht.
    evidence_by_verifier: >-
      14-KUNDENNACHWEIS.md rechnet alle 20 Nutzerkonten unabhängig vom Programm nach:
      141 von 144 Monatszeilen stimmen mit dem neuen Wert exakt überein; die 3 verbleibenden
      betreffen ausschließlich Zeilen, die der Neuberechnungslauf konstruktionsbedingt nicht
      anfasst (Zukunftsmonate, gelöschte Nutzer). Prüfsummenvergleich über neun Tabellen:
      time_entries, absence_requests, overtime_corrections, users, vacation_balance,
      vacation_transactions und overtime_transactions sind Zeichen für Zeichen identisch —
      verändert sind nur overtime_balance (das gerechnete Aggregat) und holidays.
      Es wurden keine Daten geändert, sondern anders gerechnet.
    open_decision: "Kenntnisnahme des Anwenders zu den acht geänderten Konten — erfolgt (Benedikt Jochem über acht Monate selbst gegengerechnet), aber nicht als Abnahmepunkt abgehakt"
    not_a_gap_because: >-
      Die Nullwirkung, die REQ-33 verlangt, ist auf der Generalprobe getrennt und sauber
      belegt (14-VORHER-NACHHER.md: genau EIN Nutzer mit Differenz ungleich null, userId 2,
      +19,6 h — deckungsgleich mit dem angekündigten balanceDelta). Was der Produktionslauf
      darüber hinaus bewegt hat, ist die beabsichtigte Wirkung der Phasen 9 und 11, jede
      einzelne Zahl unabhängig nachgerechnet.
  - truth: "Der reale Umstellungsfall ist eingetragen und ergibt die erwarteten Werte (ROADMAP-Erfolgskriterium 2, Plan 14-09)"
    status: partial
    reason: >-
      Sachlich erfüllt, aber am falschen Ort dokumentiert. Das von Plan 14-09 geforderte
      Artefakt .planning/phases/14-absicherung-und-auslieferung/14-UMSTELLUNGSFALL.md
      existiert nicht; Plan 14-09 hat kein SUMMARY und steht in der ROADMAP auf [ ].
    evidence_by_verifier: >-
      Der Fall ist am 27.08.2026 eingetreten: Nutzer 16 (Benedikt Jochem), 30 → 40 h/Woche
      ab 01.08.2026. Die Vorschau versprach −32:00 h, das Ergebnis lautete −32:00 h. Beleg:
      .planning/debug/wal-abgehaengt-20260827.md — Periode id 21 (ab 01.08.2026, 40 h,
      createdAt 2026-08-27 11:33:54) auf der Platte nachgewiesen, model_change-Buchung
      −28:00 h im Kontoauszug sichtbar, Januar bis Juli unverändert. Die vier
      Muss-Aussagen des Plans sind damit inhaltlich belegt, das Artefakt fehlt.
    open_decision: "14-UMSTELLUNGSFALL.md und 14-09-SUMMARY.md nachziehen, ROADMAP-Checkbox setzen"
    not_a_gap_because: "Keine Umsetzungslücke — der Vorgang ist gelaufen, geprüft und vom Anwender bestätigt. Es fehlt die Buchführung."
  - truth: "Der Journal-Backfill der Phase 9.1 läuft als eigener, gesondert freigegebener Schritt (Plan 14-10)"
    status: partial
    reason: >-
      Sachlich erfüllt, aber am falschen Ort dokumentiert. Das von Plan 14-10 geforderte
      Artefakt 14-BACKFILL-PRODUKTION.md existiert nicht; Plan 14-10 hat kein SUMMARY und
      steht in der ROADMAP auf [ ].
    evidence_by_verifier: >-
      14-AUSLIEFERUNG.md, Abschnitt 5 „Journal-Backfill, Variante Vollaufbau": eigene
      Sicherung production.PRE-BACKFILL-ALLMONTHS_20260826_045220.db vor dem Schreiblauf,
      100 Monate verarbeitet ohne Abbruch, +991 Journalzeilen (overtime_transactions
      2590 → 3581). Danach 15 von 15 aktiven Nutzern deckungsgleich mit dem kanonischen Weg
      (vorher 10 von 15). Die Modellwechsel-Buchungen blieben unberührt, und der Backfill hat
      die zuvor bereinigten Zukunftszeilen nicht wieder angelegt.
    open_decision: "14-BACKFILL-PRODUKTION.md und 14-10-SUMMARY.md nachziehen, ROADMAP-Checkbox setzen"
    not_a_gap_because: "Keine Umsetzungslücke — der Backfill ist gelaufen und verifiziert. Es fehlt die Buchführung."
declared_carve_outs:
  - truth: "Die Menge der roten Servertests bleibt bei genau drei, mit unveränderten Titeln (Plan 14-01)"
    carve_out: >-
      Die drei roten Tests sind in server/vitest.config.ts, Zeile 19-20, ausdrücklich als
      bekannt dokumentiert und in .planning/phases/08-.../deferred-items.md begründet.
      Ursache ist die fehlende eigene Testdatenbank pro Lauf (alle Tests arbeiten auf
      database/development.db); fileParallelism ist deshalb abgeschaltet.
    recorded_as: "aufgeschobener Punkt in vitest.config.ts"
  - truth: "Phase 9.1 ist vollständig abgearbeitet"
    carve_out: >-
      Ausdrücklich nicht Gegenstand dieser Phase. 14-URTEIL-PHASE-9.1.md teilt Phase 9.1
      auf: der Backfill-Anteil lief im Produktionsfenster mit (siehe oben), die Code-Härtung
      WR-02 bis WR-05 bleibt in Phase 9.1 und ist unerledigt. WR-07 hat Plan 14-02
      geschlossen.
    recorded_as: "ROADMAP.md, Abschnitt Phase 9.1, „Einordnung nach Plan 14-07\""
human_verification:
  - test: "Kenntnisnahme: acht der zwanzig Überstundenkonten haben sich durch das Deployment vom 23.08.2026 geändert"
    expected: "Der Anwender nimmt die in 14-KUNDENNACHWEIS.md je Konto vorgerechneten neuen Stände zur Kenntnis"
    why_human: "Fachliche Kenntnisnahme mit Wirkung auf Mitarbeiterkonten; die Richtigkeit ist maschinell belegt, die Annahme nicht"
  - test: "Die 14 Prüfzeilen der Phase 14 in 14-UAT-SAMMLUNG.md, Abschnitt „Phase 14\""
    expected: "Siehe 14-UAT-TRIAGE.md, Zeile je Punkt — 5 AUTO, 2 AUTO-MIT-SERVER, 4 AUGEN, 3 ENTSCHEIDUNG"
    why_human: "Sicht- und Entscheidungspunkte, von D-15 bewusst gebündelt statt während der Ausführung gefragt"
  - test: "Auto-Update aus einer installierten v1.8.0 heraus tatsächlich durchlaufen lassen"
    expected: "Der eingebaute Updater bietet v1.9.0 an, lädt und installiert sie"
    why_human: "Die Prüfung reicht bis zur Erreichbarkeit der vier Plattform-URLs (HTTP 200) — ob der Updater sie annimmt, zeigt nur ein echter Lauf auf einem Anwenderrechner"
human_verification_source: ".planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md, Abschnitt „Phase 14"; Einordnung in 14-UAT-TRIAGE.md"
gaps: []
---

# Verifikation Phase 14 — Absicherung und Auslieferung

**Phasenziel laut ROADMAP:** Der Umbau ist belegt, generalprobt und bei den Anwendern.

Diese Verifikation wurde am 28.08.2026 nachträglich erstellt. Die Phase war produktiv
abgeschlossen (Release v1.9.0 veröffentlicht, Produktionslauf durchgeführt), aber nie
verifiziert worden — das Milestone-Audit hat die Lücke aufgedeckt. Alle Aussagen unten sind
am Stand `c0acb59` eigenständig gegen Dateisystem und Code nachgemessen; wo eine Zahl aus
einem Nachweisdokument stammt, steht das dabei.

**Dieses Dokument beschönigt nichts.** Ein Erfolgskriterium ist in seiner wörtlichen Fassung
nicht erfüllt, und zwei Pläne haben ihr Artefakt nie bekommen. Beides steht unten mit der
Zahl da, die es belegt.

---

## 1. Die vier ROADMAP-Erfolgskriterien

| # | Kriterium | Urteil |
|---|-----------|--------|
| 1 | Alle Salden von Nutzern ohne Modellwechsel sind vor und nach dem Produktionslauf identisch | ⚠ **eingeschränkt** |
| 2 | Der reale Umstellungsfall ist eingetragen und ergibt die erwarteten Werte | ✅ erfüllt, Artefakt fehlt |
| 3 | Release veröffentlicht, `latest.json` enthält alle Plattformen | ✅ erfüllt |
| 4 | `tsc --noEmit` grün für Server und Desktop | ✅ erfüllt |

### Kriterium 1 — was tatsächlich passiert ist

Der maschinelle Vergleich `14-VERGLEICH-VOR-NACH.md` meldet **99 Abweichungen** zwischen dem
Produktionsstand vor dem Deployment (`production.PRE-14-08_20260823_111541.db`, 11:15:41) und
dem Stand danach (11:56:27). Betroffen sind 8 von 20 Nutzern. In der wörtlichen Lesart ist
das Kriterium damit **nicht erfüllt**.

Die Trennung, die das Kriterium nicht macht, machen die Nachweise:

| Wirkung | Beleg | Ergebnis |
|---|---|---|
| **Migration 008–015 allein** | `14-MIGRATIONSSTAND.md`, Task 3 auf der Produktionskopie | `overtime_transactions` COUNT und SUM(hours): **Differenz exakt 0**. `overtime_balance` COUNT und alle Summenspalten: **Differenz exakt 0**. `integrity_check: ok`, `foreign_key_check` leer. Keine der acht Migrationen enthält ein `INSERT`, `UPDATE` oder `DELETE` auf Fachdaten. |
| **Modellwechsel allein (Generalprobe)** | `14-VORHER-NACHHER.md` | **Genau ein Nutzer mit Differenz ungleich null:** userId 2 (Karin Jochem), +19,6 h — identisch mit dem vorab angekündigten `balanceDelta: 19.6 h`. Alle übrigen Nutzerdatensätze byteidentisch zwischen den beiden Snapshots. |
| **Rechenkorrekturen der Phasen 9 und 11** | `14-KUNDENNACHWEIS.md` | 8 Konten geändert — **beabsichtigt**. Jede Zahl unabhängig vom Programm nachgerechnet: 141 von 144 Monatszeilen exakt deckungsgleich. |

Der Prüfsummenvergleich über neun Tabellen ist dabei der tragende Befund: `time_entries`
(712), `absence_requests` (43), `overtime_corrections` (4), `users` (20), `vacation_balance`
(40), `vacation_transactions` (59) und `overtime_transactions` (2671) sind vor und nach dem
Deployment **Zeichen für Zeichen identisch**. Verändert haben sich nur `overtime_balance` —
die Tabelle mit den fertig gerechneten Monatswerten — und `holidays`.

> **Es wurden keine Daten geändert, sondern nur anders gerechnet.**

Die drei verbleibenden Monatszeilen ohne Deckung betreffen ausschließlich Zeilen, die der
Neuberechnungslauf konstruktionsbedingt nicht anfasst (Zukunftsmonate, gelöschte Nutzer:
Nutzer 3, 17, 30) — sie sind in `14-KUNDENNACHWEIS.md` einzeln aufgeführt und begründet und
gehören sachlich zu Phase 14.1.

**Bewertung:** REQ-33 („Salden aller Nutzer ohne Modellwechsel vorher und nachher identisch")
ist erfüllt — nachgewiesen auf der Generalprobe, wo genau diese Trennung möglich war. Das
ROADMAP-Kriterium ist zu grob formuliert, um auf den Produktionslauf zu passen, in dem
Migration und Rechenfixes gemeinsam ankamen. Der Befund wird benannt, nicht verrechnet.

### Kriterium 4 — heute neu gemessen

Nicht aus einem Protokoll übernommen, sondern am 28.08.2026 ausgeführt:

```
cd server  && npx tsc --noEmit   → Exit 0
cd desktop && npx tsc --noEmit   → Exit 0
```

---

## 2. Muss-Aussagen je Plan

| Plan | Muss-Aussagen | Artefakte | Urteil |
|------|---------------|-----------|--------|
| 14-01 | 3/3 | `14-REQ32-NACHWEIS.md` (101 Z.), Erhöhungstest | ✅ |
| 14-02 | 3/3 | `userService.ts`, `userWorkPeriodProvisioning.test.ts`, `14-WR07-ENTSCHEIDUNG.md` | ✅ |
| 14-03 | 4/4 | `14-UAT-SITZUNG.md` (310 Z.), `14-UAT-SAMMLUNG.md` (696 Z.) | ✅ |
| 14-04 | 5/5 | `14-MIGRATIONSSTAND.md` (504 Z.), beide DB-Kopien vorhanden | ✅ |
| 14-05 | 4/4 | `applyModelChange.ts` + Test, `14-VORHER-NACHHER.md` (483 Z.) | ✅ |
| 14-06 | 3/3 | `14-ROLLBACK-RUNBOOK.md` (660 Z.) | ✅ |
| 14-07 | 3/3 | `14-URTEIL-PHASE-9.1.md` (558 Z.), `backfillOvertimeJournal.ts` + Test | ✅ |
| 14-08 | 4/4 | `14-PRODUKTIONSLAUF.md` (1334 Z.) | ✅ |
| 14-09 | 4/4 sachlich | **`14-UMSTELLUNGSFALL.md` fehlt** | ⚠ partial |
| 14-10 | 4/4 sachlich | **`14-BACKFILL-PRODUKTION.md` fehlt** | ⚠ partial |
| 14-11 | 4/4 | `14-RELEASE.md` (440 Z.), `CHANGELOG.md` | ✅ |

### Eigenständig nachgeprüfte Schlüsselverbindungen

| Verbindung | Prüfung | Ergebnis |
|---|---|---|
| REQ-32 Fall 2 hat einen eigenen Test | `grep -n "REQ-32: Eine Erhoehung"` | `workPeriodChangeService.test.ts:284` ✅ |
| `WorkPeriodBypassError` → HTTP 400 | `grep -n` in `routes/users.ts` | Import Zeile 20, `instanceof`-Zweig Zeile 446 ✅ |
| `applyModelChange.ts` ruft `applyWorkTimeChange` statt eigener Schreiblogik | `grep -c` | 9 Treffer ✅ |
| `backfillOvertimeJournal.ts` ruft `rebuildOvertimeTransactionsForMonth` | `grep -c` | 8 Treffer ✅ |
| Beide Skripte sind zweistufig (`--apply`) | `grep -c -- "--apply"` | 7 bzw. 6 Treffer ✅ |
| Version 1.9.0 in allen drei Dateien | `desktop/package.json:4`, `tauri.conf.json:4`, `Cargo.toml:3` | dreimal `1.9.0` ✅ |
| Tag `v1.9.0` existiert | `git tag -l` | vorhanden ✅ |

### Plan 14-08 — die Sicherung ist echt

`14-PRODUKTIONSLAUF.md` belegt die Sicherung vor dem ersten Schreibzugriff nicht durch eine
Behauptung, sondern durch einen SHA-256-Abgleich zwischen Server und Arbeitsrechner:

```
082ff7434ec8c75560f06c6469093c088c921f70a9cc35162f4bf9b21222ee7d
  /home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db
082ff7434ec8c75560f06c6469093c088c921f70a9cc35162f4bf9b21222ee7d
  server/database/backups/production.PRE-14-08_20260823_111541.db
```

Die lokale Kopie ist vorhanden (`server/database/backups/`, nachgeprüft). Der Rückweg ist in
`14-ROLLBACK-RUNBOOK.md` nicht nur beschrieben, sondern lokal erprobt (Sicherung ziehen,
Schaden setzen, zurückspielen — 15 ms / 13 ms, je 1.331.200 Bytes) und nutzt `VACUUM INTO`
statt `cp`, weil ein Dateikopiervorgang bei aktivem WAL einen zerrissenen Zwischenstand
erzeugt. Diese Begründung hat sich am 27.08.2026 unabhängig bestätigt.

### Plan 14-11 — `latest.json` plattformweise

Nicht die Existenz der Datei wurde geprüft, sondern ihr Inhalt: 11 Plattformschlüssel,
davon die vier tragenden (`darwin-aarch64`, `darwin-x86_64`, `linux-x86_64`,
`windows-x86_64`) jeweils mit gesetzter `url` **und** gesetzter `signature` (436–448 Zeichen,
echte minisign-Signaturen). Alle vier URLs mit `curl -sIL` geprüft: **HTTP 200**. Der
Anwender bekommt v1.9.0 über den eingebauten Updater seiner v1.8.0 angeboten.

---

## 3. Requirements dieser Phase

| Requirement | Status | Beleg |
|-------------|--------|-------|
| **REQ-32** — Tests decken die fünf Wechselfälle ab | ✅ erfüllt | `14-REQ32-NACHWEIS.md`: jeder der fünf Fälle namentlich einem einzelnen `it(...)` zugeordnet, mit Datei, Zeilennummer und der wörtlichen `vitest`-Ausgabe eines Einzellaufs (`-t "<Titel>"`). Kein Sammelposten „Tests grün". |
| **REQ-33** — Generalprobe auf Produktionskopie, Salden ohne Modellwechsel identisch | ✅ erfüllt | `14-VORHER-NACHHER.md`: genau ein Nutzer mit Differenz ungleich null (userId 2, +19,6 h = angekündigtes `balanceDelta`), alle übrigen Datensätze byteidentisch. `14-MIGRATIONSSTAND.md`: Migrationsfolge auf der Kopie mit Differenz exakt 0. |

---

## 4. Was offen bleibt

**Buchführung (kein Codeaufwand):**

1. `14-UMSTELLUNGSFALL.md` und `14-09-SUMMARY.md` aus `.planning/debug/wal-abgehaengt-20260827.md` nachziehen
2. `14-BACKFILL-PRODUKTION.md` und `14-10-SUMMARY.md` aus `14-AUSLIEFERUNG.md`, Abschnitt 5, nachziehen
3. ROADMAP-Checkboxen 14-08, 14-09, 14-10 und 14-11 setzen — alle vier stehen auf `[ ]`, obwohl 14-08 und 14-11 ihr SUMMARY haben

**Sachlich offen, außerhalb dieser Phase:**

4. Phase 9.1, Code-Härtung WR-02 bis WR-05 (`14-URTEIL-PHASE-9.1.md`, Teil 3)
5. Die drei Restdifferenzen bei Nutzer 3, 17 und 30 — gehören zu Phase 14.1, warten auf die
   Darstellungsentscheidung 14.1-U3/U4
6. Die drei Commits vom 27.08.2026 (`ded14d3`, `ad48068`, `c0acb59`) sind nicht ausgeliefert;
   `origin/main` steht auf `c8b65bf`
