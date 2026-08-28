# 14-UMSTELLUNGSFALL — Der erste reale Arbeitszeitmodellwechsel

**Vorgang:** Nutzer 16, Benedikt Jochem — 30 → 40 Wochenstunden ab 01.08.2026
**Eingetragen:** 27.08.2026, 11:33:54 UTC (13:33 Ortszeit)
**Eingetragen von:** dem Anwender selbst, über die Desktop-App v1.9.0
**Dokument erstellt:** 28.08.2026

---

## ⚠ Was dieses Dokument ist — und was nicht

Dieses Dokument ist **nachträglich rekonstruiert**, nicht während des Vorgangs geführt. Plan
14-09 sah einen Ablauf über das Skript `applyModelChange.ts` vor: Werte erfragen, Trockenlauf
sichten, Freigabe einholen, mit `--apply` schreiben, Vorher/Nachher-Snapshots vergleichen.

**So ist es nicht gelaufen.** Der Anwender hat den Wechsel am 27.08.2026 selbst in der
Desktop-App eingetragen — über genau die Oberfläche, die die Phasen 12 und 13 dafür gebaut
haben. Das ist der bessere Beweis für den Milestone (das Produkt trägt den Fall, nicht ein
Wartungsskript), aber es bedeutet: die Belege dieses Dokuments stammen aus der forensischen
Auswertung des Abends, nicht aus einem geplanten Protokoll.

**Alleinige Belegquelle:** `.planning/debug/wal-abgehaengt-20260827.md`. Jede Zahl unten ist
dort mit ihrer Messstelle nachlesbar. Wo ein Muss-Kriterium des Plans nicht belegt ist, steht
das unter Abschnitt 5 — es wird nicht als erfüllt ausgegeben.

---

## 1. Die vier Werte

| Wert | Inhalt | Herkunft |
|---|---|---|
| Nutzer | 16 — Benedikt Jochem | Anwender |
| Stichtag | 01.08.2026 | Anwender |
| Wochenstunden vorher | 30 | Periode id 5 (01.01.2026 → 01.08.2026) |
| Wochenstunden nachher | 40 | Periode id 21 (ab 01.08.2026) |

Der Stichtag lag beim Eintragen **in der Vergangenheit** — der Fall aus REQ-26
(„rückwirkend geltender Vertrag"), nicht der einfachere Zukunftsfall.

## 2. Der Trockenlauf — die Vorschau der Anwendung

Plan 14-09 verlangte einen gesichteten Trockenlauf vor dem Schreiben. In der App übernimmt
das die Vorschau aus REQ-27 (`POST /api/work-periods/preview`), die der Anwender vor dem
Speichern gesehen und bestätigt hat.

**Die Vorschau versprach einen Saldo von −32:00 h.**

## 3. Das Ergebnis

| Größe | Wert | Beleg |
|---|---|---|
| Saldo **vor** dem Wechsel | −4:00 h | Stand der Hauptdatei ohne die abgehängte WAL, `wal-abgehaengt-20260827.md`, Vergleichstabelle |
| `model_change`-Buchung | **−28:00 h** | Kontoauszug, vom Anwender per Bildschirmfoto belegt |
| Saldo **nach** dem Wechsel | **−32:00 h** | Anwendungsseite, ebenda |

Die Rechnung geht auf: −4:00 h + (−28:00 h) = −32:00 h. **Die Vorschau versprach −32:00 h,
das Ergebnis lautete −32:00 h.**

## 4. Was unangetastet blieb

| Prüfung | Ergebnis |
|---|---|
| Januar bis Juli 2026 | unverändert — die Monate vor dem Stichtag sind nicht nachgerechnet worden |
| Periode id 5 | bleibt bestehen, endet am 01.08.2026 statt offen zu laufen |
| `overtime_transactions` gesamt | 3843 Zeilen, max id 38097 — an allen Messpunkten des Abends unverändert |
| `user_work_periods` | 21 Zeilen, max id 21 |

Damit ist an einem realen Konto belegt, was der Milestone verspricht: **eine Stundenumstellung
verschiebt keine Vergangenheit.** Der Saldo wurde nicht umgerechnet (REQ-28), die Differenz
steht als eigene, sichtbare Buchung im Journal (REQ-29), und die Monate vor dem Stichtag
tragen weiterhin die Sollstunden, die an diesen Tagen galten (REQ-23, REQ-24).

Unabhängige Bestätigung nach dem Serverneustart desselben Abends (20:52 UTC):
`integrity_check: ok`, Periode id 21 (ab 01.08.2026, 40 h) vorhanden,
`overtime_transactions` 3843 Zeilen, max id 38097 — unverändert gegenüber allen
Messpunkten des Abends.

## 5. Was nicht belegt ist

Zwei Muss-Aussagen des Plans 14-09 lassen sich aus den vorhandenen Belegen **nicht**
nachweisen. Sie werden hier benannt statt stillschweigend als erfüllt geführt:

**5.1 — „Nach dem Lauf unterscheidet sich der Saldo genau eines Nutzers."**
Für den 27.08.2026 existiert kein Vorher/Nachher-Snapshot über alle Nutzer, wie ihn
`snapshotBalances.ts` in der Generalprobe erzeugt hat. Geprüft wurde nur Nutzer 16.
Dass sich kein anderer Nutzer bewegt hat, ist **plausibel** (der Codeweg
`workPeriodChangeService.applyWorkTimeChange()` rührt nur die betroffenen Monate des
betroffenen Nutzers an, und die Generalprobe hat genau das gezeigt: genau ein Nutzer mit
Differenz ungleich null), aber für diesen konkreten Vorgang **nicht gemessen**.

*Nachholbar ohne Risiko:* ein Lauf von `snapshot:balances` gegen eine über die
Backup-Funktion der App gezogene Kopie, verglichen mit
`14-AUSLIEFERUNG-NACH-DEPLOY.json` (Stand 26.08.). Erwartung: genau ein Nutzer mit
Differenz ungleich null. **Kein direkter Zugriff auf `production.db`** — siehe
`.claude/CLAUDE.md`, „Database Rules".

**5.2 — „Der Kontoauszug zeigt eine Modellwechsel-Zeile mit Betrag, Vorzeichen und
Begründung."** Betrag (−28:00 h) und Vorzeichen sind über das Bildschirmfoto des Anwenders
belegt. Die **Begründung** ist nicht dokumentiert — sie wurde beim Eintragen erzwungen
(`workPeriodChangeService.ts:302-309`, Mindestlänge 10 Zeichen, serverseitig geprüft), ihr
Wortlaut ist aber nirgends festgehalten.

*Nachholbar:* Kontoauszug des Nutzers 16 in der App öffnen und die Begründungszeile ablesen.

## 6. Einordnung in die Reihenfolge der Phase

Plan 14-10 (Journal-Backfill) hätte laut Plan **nach** diesem Vorgang laufen sollen.
Tatsächlich lief der Backfill am 26.08.2026, also **einen Tag vorher** — siehe
`14-BACKFILL-PRODUKTION.md`, Abschnitt „Abweichung von der geplanten Reihenfolge".
Die Umkehrung hat keinen Schaden angerichtet: Zum Zeitpunkt des Backfills existierte noch
keine einzige `model_change`-Zeile in der Produktion (der Zähler des Werkzeugs meldet 0 vor
und 0 nach dem Lauf), und der Backfill hat den sichtbaren Saldo keines Nutzers bewegt.
