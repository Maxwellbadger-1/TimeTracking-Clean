# Deferred Items — Phase 08

Gefunden während Plan 08-04 (Deployment-Qualitätstor), außerhalb des Scopes von Task 2
(betrifft keinen Schritt in `deploy-server.yml`), daher nicht mitgefixt:

- `server/src/scripts/fixOvertimeTransactionsSchema.ts` — hartkodierter Pfad
  `path.join(__dirname, '../../database.db')`, respektiert `DATABASE_PATH` nicht. Wird von
  keinem Deploy-Schritt aufgerufen (nur manuelles One-off-Script).
- `server/src/scripts/validateOvertimeCalculation.ts` — gleiches Muster, ebenfalls nicht Teil
  der Deploy-Pipeline.

Beide könnten beim nächsten manuellen Aufruf denselben Fehler reproduzieren, der in Task 2
dieses Plans `server/scripts/migrate.ts` und `server/scripts/validateSchema.ts` betraf (leere
`server/database.db` statt Produktionsdatenbank, seit Entfernung des Symlinks am 20.08.2026).
Sollte ein künftiger Plan diese Skripte gegen Produktion einsetzen, zuerst `DATABASE_PATH`
respektieren wie in `server/src/config/database.ts` → `getDatabasePath()`.

---

Gefunden während der Abnahme von Plan 08-04 (Task 3), nachdem `npm run sync-dev-db` echte
Produktionsdaten in die lokale Datenbank geholt hat:

- **Server-Tests laufen gegen `server/database/development.db`.** `getDatabasePath()` kennt nur
  `production` und „alles andere" — für `NODE_ENV=test` gibt es keinen eigenen Pfad. Die Tests
  schreiben ihre Fixtures also in die Arbeitsdatenbank und lesen echte Daten mit. Zwei
  Fehlschläge gehen direkt darauf zurück:
  - `vacationBackfillService.test.ts` → „erkennt einen bereits gelaufenen Backfill":
    `hasExistingBackfill()` prüft **global**, ohne Nutzerbezug. In einer Datenbank mit dem
    echten Phase-7-Backfill ist die Vorbedingung `toBe(false)` unerfüllbar. Schlägt auch
    isoliert fehl.
  - `vacationTransactionService.test.ts` → „macht eine fehlende Gegenbuchung am Antrag
    sichtbar": hatte `referenceId: 61` hartkodiert und traf damit Carmen Rothemunds echten
    Antrag #61 (2 echte Journalzeilen + 2 Testzeilen = 4 statt 2). **In diesem Zuge behoben**
    — alle Vorkommen nutzen jetzt die `absenceId`-Fixture aus `beforeEach`.
  - `vacationEntitlementBooking.test.ts` → schlägt nur in der Gesamtsuite fehl, isoliert grün.
    Bekannte Vorbelastung aus Phase 7 (geteilte Test-Datenbank über Dateigrenzen).

  Saubere Lösung wäre ein eigener Pfad für `NODE_ENV=test` (z. B.
  `server/database/test.db`, pro Lauf frisch migriert) plus nutzerbezogene Abfragen statt
  globaler Zählungen. Beides außerhalb des Scopes von Phase 8.

- **`unifiedOvertimeService.test.ts`, zwei Regressionstests** („should respect hire date…",
  „REGRESSION: User hired on 1st of month…") erwarten `targetHours = 10` und nehmen fest an,
  heute sei der 06.02.2026 — der Tag, an dem sie geschrieben wurden. Seit Februar liefern sie
  40 (voller Monat). Zeitabhängige Tests ohne fixierte Uhr; unabhängig von Phase 8.
