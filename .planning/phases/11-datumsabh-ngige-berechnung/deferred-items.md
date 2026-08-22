# Deferred Items — Phase 11

Funde außerhalb des Scopes der jeweiligen Pläne. Nicht behoben, nur dokumentiert.

## Plan 11-08

1. **`server/src/scripts/validateOvertimeCalculation.ts:208`** — `SqliteError: no such
   column: deletedAt` in der `time_entries`-Abfrage des DB-Validierungsmodus (`--userId=`).
   Vorbestehend, unverändert durch Plan 11-08 (`git diff HEAD~1` zeigt an dieser Zeile keine
   Änderung; der Fehler tritt NACH der periodenbasierten Zielstunden-Berechnung auf, die
   nachweislich fehlerfrei durchläuft). Betrifft nur den DB-Modus — der Szenario-Modus
   (`--scenario=`) ist unbetroffen und lief im Probelauf fehlerfrei durch. Ursache vermutlich:
   `time_entries`-Schema hat keine `deletedAt`-Spalte (Soft-Delete-Konvention fehlt für diese
   Tabelle) oder die Spalte wurde umbenannt. Nicht untersucht — außerhalb des REQ-25-Scopes
   dieses Plans.

2. **`server/src/scripts/validateAllTestUsers.ts`** — kein `assertNotProduction()`, öffnet
   `new Database('./database/development.db')` fest verdrahtet (ignoriert `DATABASE_PATH`
   vollständig). `server/src/scripts/productionGuard.ts:17-19` behauptet, dieses Skript
   „behält weiterhin eine eigene Kopie dieser Prüfung" — das trifft nicht zu (per grep
   verifiziert, keine Zeile mit `assertNotProduction` in der Datei). Da der DB-Pfad fest
   verdrahtet ist und `DATABASE_PATH`/`NODE_ENV` gar nicht ausgewertet werden, kann dieses
   Skript strukturell nicht über Umgebungsvariablen auf die Produktionsdatenbank zeigen — ein
   `assertNotProduction()`-Guard, der `getDatabasePath()` prüft, würde den falschen Pfad
   prüfen (Guard-Theater statt echtem Schutz) und wäre ohne eine Umstellung der
   DB-Verbindungsstrategie selbst nicht wirksam. Empfehlung für die vorgesehene
   Konsolidierung (`productionGuard.ts:20-22` nennt Phase 9.1 oder Phase 14): Entweder
   `getDatabasePath()` statt des festen Pfades verwenden UND `assertNotProduction()`
   ergänzen, oder den Kommentar in `productionGuard.ts` korrigieren.

3. **`server/src/scripts/migrateOvertimeToTransactions.ts`** — behoben in Plan 11-08 (Rule 2,
   T-11-27): fehlender Produktionsschutz bei einem schreibenden Migrationsskript wurde
   nachgerüstet, nicht nur dokumentiert. Hier nur der Vollständigkeit halber vermerkt, da der
   Fund während desselben Lesevorgangs wie Punkt 2 gemacht wurde.
