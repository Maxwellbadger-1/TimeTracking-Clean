---
status: investigating
trigger: "CR-01 aus 14.1-REVIEW.md schliessen: Genehmigter Ueberstundenausgleich mit Zukunftsdatum bindet das Guthaben nicht, gegen das hasSufficientOvertimeBalance() prueft. Dasselbe Guthaben ist mehrfach vergebbar."
created: 2026-08-25T00:00:00Z
updated: 2026-08-25T00:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: >
    hasSufficientOvertimeBalance() und die Anlegepruefung in createAbsenceRequest fussen beide
    allein auf getOvertimeBalance(). Diese Funktion summiert overtime_balance mit
    'month <= currentMonth'. Ein Ausgleichstag wirkt sich auf overtime_balance aber erst aus,
    wenn er im Rechenfenster liegt - und das Rechenfenster endet bei HEUTE. Ein genehmigter
    Ausgleich mit Datum > heute ist daher fuer beide Pruefungen unsichtbar; dasselbe Guthaben
    ist beliebig oft vergebbar.
  confirming_evidence:
    - 'Gemessen: Nutzer 2 (Guthaben 10,00 h, Limit -20 h => 30,00 h zulaessig) bekam in sechs Runden 55,00 h Ausgleich genehmigt; Saldo davor und danach unveraendert 10,00 h, jede Runde Veraenderung 0,00 h.'
    - 'Gemessen: Ausgleich am 2026-08-27 (Zukunft, LAUFENDER Monat) und am 2026-09-03 ff. (kuenftiger Monat) bewegen den Saldo beide um 0,00 h - beide vom Review benannten Wege bestaetigt.'
    - 'Gemessen: Ausgleich am 2026-08-06/13/20 (VERGANGENHEIT) bewegt den Saldo ebenfalls um 0,00 h - weil der Fehlbetrag des unbearbeiteten Tages bereits in overtime_balance steht. Daraus folgt die Trennlinie: in overtime_balance beruecksichtigt <=> Tag <= heute.'
    - 'Gemessen: In der Arbeits-DB gibt es 0 Journalzeilen type=compensation gegen 5 genehmigte Ausgleiche (darunter der Zukunftsfall Antrag #64, Nutzer 3, 2026-09-29).'
  falsification_test: >
    Wuerde ein Ausgleich mit Datum > heute den Wert von getOvertimeBalance() sofort senken,
    waere die Hypothese widerlegt. Gemessen: Veraenderung 0,00 h in allen sechs Runden.
  fix_rationale: >
    Die Pruefung - nicht die angezeigte Zahl - zieht die bereits genehmigten, noch nicht in
    overtime_balance beruecksichtigten Ausgleichsstunden (Tage > heute) vom verfuegbaren
    Guthaben ab. Quelle ist absence_requests (geschuetzte Tabelle, immer vorhanden), NICHT das
    Journal: dort stehen 0 Zeilen. Die Trennlinie 'Tag > heute' deckt sich exakt mit dem
    Rechenfenster von getOvertimeBalance(), daher keine Doppelzaehlung.
  blind_spots: >
    (a) Ein Zeitraum, der HEUTE ueberspannt (Start <= heute < Ende), wird tagegenau
    aufgeteilt - im Bestand gibt es nur eintaegige Ausgleiche, der Fall ist konstruiert zu
    pruefen. (b) MissingWorkPeriodError kann aus der Tagesrechnung hochschlagen; derselbe
    Fehler kann aus dem unmittelbar davor stehenden Aufruf schon heute kommen.
    (c) work_time_accounts.currentBalance bleibt unberuehrt (WR-01-Gebiet, Sperrvermerk).

hypothesis: bestaetigt - siehe reasoning_checkpoint
test: Reproduktion auf 14.1-cr01-reproduktion.db, sechs Genehmigungsrunden
expecting: erledigt
next_action: Fix umsetzen (workingDays.ts Parametertyp weiten, getCommittedFutureCompensationHours + getAvailableOvertimeBalance in overtimeTransactionService, beide Pruefungen umstellen)

## Symptoms

expected: Nach Genehmigung eines Ausgleichs ueber X h ist das Guthaben um X h reduziert; ein zweiter Antrag ueber X h wird abgelehnt.
actual: Der Saldo bleibt unveraendert; der zweite Antrag geht durch.
errors: (keine Exception - stille Fehlbuchung)
reproduction: Ausgleich mit Datum in der Zukunft genehmigen, dann erneut denselben Umfang beantragen.
started: Plan 14.1 / BL-04 (Entfernung von deductOvertimeHours) in Verbindung mit dem `month <= currentMonth`-Filter aus 14.1-01.

## Eliminated

## Evidence

- timestamp: 2026-08-25
  checked: overtimeTransactionService.ts getOvertimeBalance() + hasSufficientOvertimeBalance()
  found: getOvertimeBalance summiert overtime_balance mit `WHERE userId = ? AND month <= ?` (currentMonth aus formatDate(getCurrentDate(),'yyyy-MM')). hasSufficientOvertimeBalance() nutzt ausschliesslich diesen Wert.
  implication: Alles, was nur in einem Zukunftsmonat gebucht wird, ist fuer die Pruefung unsichtbar.

## Resolution

root_cause:
fix:
verification:
files_changed: []
