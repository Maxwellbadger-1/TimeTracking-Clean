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
