# Erstbefund: Wege-Vergleich vor jeder Codeänderung (D3, Plan 09-02, Task 3)

**Wichtig:** Dieser Lauf fand VOR jeder Codeänderung an `overtimeService.ts` oder verwandten
Dateien statt (Plan 09-03/09-04 sind noch nicht ausgeführt). Er ist der Vorher-Zustand, gegen
den Plan 09-03 seine Wirkung belegen muss.

## Ausgangslage

| Feld | Wert |
|---|---|
| Datum | 2026-08-21 |
| Datenbankpfad | `server/database/development.db` (lokale Kopie, siehe `09-PRUEFNUTZER.md` — kein frischer `sync-dev-db`-Lauf, Aktualität direkt geprüft) |
| Commit-Hash (Ausgangslage) | `820da21` |
| Werkzeug | `npm run validate:overtime:paths -- --from=../.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv --json=../.planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BASELINE.json` |
| Exit-Code des Erstlaufs | **0** — kein Weg weicht für keinen der drei Prüfnutzer über `TOLERANCE_HOURS = 0.01` ab |
| Grundlinie | `.planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BASELINE.json` |

Startprotokoll des Laufs (gegen den Fehlgriff auf die tote `server/database.db`,
`.planning/notes/db-pfad-diskrepanz-20260821.md`):

```
Datenbankpfad: C:\Users\maxfe\...\TimeTracking-Clean\server\database\development.db
Aktive Nutzer: 18
```

18 aktive Nutzer, keine leere oder falsche Datei — der Lauf arbeitet nachweislich gegen die
richtige lokale Kopie.

---

## Werte je Prüfnutzer (fünf Wege)

### Nutzer A — Karin Jochem, `userId 2`, Prüfmonat 2026-07

| Weg | Wert |
|---|---|
| `unified` | -6.50 |
| `dashboard` | -6.50 |
| `report_summary` | -6.50 |
| `report_daily` | -6.50 |
| `balance_row` | -6.50 |

Ergebnis: `Kein Weg weicht ab.`

### Nutzer B — Benedikt Jochem, `userId 16`, Prüfmonat 2026-07

| Weg | Wert |
|---|---|
| `unified` | -29.75 |
| `dashboard` | -29.75 |
| `report_summary` | -29.75 |
| `report_daily` | -29.75 |
| `balance_row` | -29.75 |

Ergebnis: `Kein Weg weicht ab.`

### Nutzer C — Carmen Rothemund, `userId 17`, Prüfmonat 2026-04

| Weg | Wert |
|---|---|
| `unified` | -3.83 |
| `dashboard` | -3.83 |
| `report_summary` | -3.83 |
| `report_daily` | -3.83 |
| `balance_row` | -3.83 |

Ergebnis: `Kein Weg weicht ab.`

---

## Abweichungen

**Keine Paarung über `TOLERANCE_HOURS = 0.01` gefunden — alle drei Prüfnutzer zeigen für alle
fünf Wege (`unified`, `dashboard`, `report_summary`, `report_daily`, `balance_row`) exakt
denselben Wert.**

Das ist konsistent mit dem Urteil aus `09-INVENTAR-SOLLSTUNDEN.md`: Die einzige dort
festgehaltene Abweichung (**A-1**, `server/scripts/fix-overtime.ts:78`, `weeklyHours / 5` statt
`getDailyTargetHours()`) ist ein Deployment-/Cron-Skript, das laut Inventar **ausschließlich auf
der Produktionsdatenbank** läuft (`.github/workflows/deploy-server.yml:118,123-130`, mit
`DATABASE_PATH=/home/ubuntu/databases/production.db`). Dieser Erstlauf fand gegen die lokale
Entwicklungskopie statt — `fix-overtime.ts` hat diese Datei nie beschrieben, A-1 kann sich hier
also gar nicht auswirken. Die fünf verglichenen Wege selbst (`unifiedOvertimeService`,
`getOvertimeSummary`, `getUserOvertimeReport` inkl. Tagesaufstellung, `overtime_balance`) laufen
in `overtimeService.ts` und `reportService.ts` nachweislich alle über
`ensureOvertimeBalanceEntries()` → `unifiedOvertimeService.calculateMonthlyOvertime()` →
`getDailyTargetHours()` — dieselbe Quelle, dasselbe Ergebnis. Für die lokale Prüfung ist D3
damit bereits jetzt technisch erfüllt: Ein Auseinanderlaufen der fünf Lesewege ist mit den
gewählten Prüfnutzern nicht nachweisbar, weil sie strukturell alle denselben Berechnungscode
teilen.

**Wichtige Einschränkung:** Dieses Ergebnis beweist nur, dass die fünf Lesewege UNTEREINANDER
übereinstimmen — nicht, dass der übereinstimmende Wert selbst korrekt ist. Läuft eine
Berechnung fehlerhaft (z. B. der REQ-19-Kernbefund unten), lesen alle fünf Wege denselben
falschen, vorab in `overtime_balance` abgelegten Wert und stimmen trotzdem exakt überein. Die
inhaltliche Korrektheit einzelner Werte ist Gegenstand von Plan 09-04 (REQ-19), nicht dieses
Werkzeugs.

---

## Ergebnis `validate:overtime:detailed`

Zusätzlich zum Wege-Vergleich wurde für dieselben drei Prüfnutzer
`npm run validate:overtime:detailed -- --userId=<ID> --month=<YYYY-MM>` ausgeführt (drittes
Erfolgskriterium der ROADMAP). Das Skript selbst beendet sich laut `09-02-PLAN.md` →
`<interfaces>` nur bei einem Fatal Error mit Exit-Code ungleich 0 — eine erkannte Abweichung
erzeugt keinen Exit-Code 1 (bekannte Lücke, nicht Gegenstand dieses Plans). Alle drei Läufe
endeten mit Exit-Code 0; die Bewertung „bestanden/nicht bestanden" unten stützt sich deshalb auf
den im Bericht selbst ausgegebenen `🎯 VALIDATION STATUS`-Abschnitt, nicht auf den Exit-Code.

| Nutzer | Datenbank-Validierung | Transaktions-Validierung | Gesamt |
|---|---|---|---|
| Karin Jochem (2), 2026-07 | ✅ PASSED | ❌ MISMATCH: -5.00h difference | **nicht bestanden** |
| Benedikt Jochem (16), 2026-07 | ✅ PASSED | ❌ MISMATCH: -1.25h difference | **nicht bestanden** |
| Carmen Rothemund (17), 2026-04 | ✅ PASSED | ❌ MISMATCH: +0.59h difference | **nicht bestanden** |

Wörtliche Meldung je Nutzer (aus dem jeweiligen `📊 TRANSACTION BREAKDOWN`-Abschnitt):

- **Karin Jochem (2):** `TRANSACTION BALANCE: -1.5h`, `CALCULATED OVERTIME: -6.5h`,
  `❌ MISMATCH: -5.00h difference`. `Earned (Time Entries): +0h (0 txs)` trotz `18.5h`
  tatsächlich gearbeiteter Stunden im Monat.
- **Benedikt Jochem (16):** `TRANSACTION BALANCE: -28.5h`, `CALCULATED OVERTIME: -29.75h`,
  `❌ MISMATCH: -1.25h difference`.
- **Carmen Rothemund (17):** `TRANSACTION BALANCE: -4.42h`,
  `CALCULATED OVERTIME: -3.8299999999999983h`, `❌ MISMATCH: +0.59h difference`.

**Einordnung — kein neuer REQ-17/18-Fund:** Bei allen drei Nutzern stimmt `Calculated` exakt mit
`Database` überein (`✅` in der `🔀 THREE-WAY COMPARISON`-Tabelle für „Target Hours" und „Actual
Hours"), nur die dritte Spalte „Transactions" (Summe aus `overtime_transactions`) weicht ab. Das
ist dieselbe Beobachtung wie oben: Der Sollstunden-/Ist-Weg ist konsistent; die Abweichung liegt
in der Vollständigkeit des `overtime_transactions`-Journals (`0 txs` bei „Earned" trotz
gearbeiteter Stunden), nicht in der Sollstunden-Auflösung. Das deckt sich mit dem bereits in
`09-01-SUMMARY.md` festgehaltenen REQ-19-Kernbefund (`overtime_comp`-Debit erreicht den Saldo
nicht, weil `ensureOvertimeBalanceEntries()` und `updateOvertimeBalanceForMonth()` `actualHours`
ohne Kenntnis von `type='compensation'`-Buchungen überschreiben) und ist als bekannter,
zurückgestellter Punkt für Plan 09-04 zu behandeln, nicht für Plan 09-03. Kein Eintrag `A-n`
aus `09-INVENTAR-SOLLSTUNDEN.md` deckt diesen Befund ab, weil das Inventar ausdrücklich nur
Sollstunden-Ermittlung (nicht die `overtime_transactions`-Journalführung) erfasst.

---

## Ausgangswert für 09-03

- **Exit-Code des Erstlaufs (`validate:overtime:paths`):** 0
- **Gefundene Abweichungen (5-Wege-Vergleich):** 0 von 3 Prüfnutzern
- **Grundlinie für Vorher/Nachher-Vergleich:** `.planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BASELINE.json`
  (enthält alle Rohwerte je Weg und Nutzer, wiederverwendbar in Phase 11 laut 09-CONTEXT.md
  „Specific Ideas")

Plan 09-03 kann diesen Lauf nicht als Nachweis nutzen, dass A-1 bereits behoben ist — A-1
betrifft ausschließlich die Produktionsdatenbank und wurde hier nicht getestet. Plan 09-03
sollte stattdessen erneut gegen eine frische `sync-dev-db`-Kopie prüfen, NACHDEM
`fix-overtime.ts` angepasst wurde, oder — falls möglich — direkt gegen die
Deployment-Konfiguration argumentieren. Für die lokale Konsistenz der fünf Lesewege selbst gibt
es nach diesem Erstbefund nichts zu reparieren; Plan 09-03 sollte sich auf A-1 konzentrieren.
