# Deferred Items — Phase 12

Funde außerhalb des Scopes der jeweiligen Pläne. Nicht behoben, nur dokumentiert.

## Plan 12-08

1. **Vorbestehender Datenbefund in `server/database/development.db`: `userId=15359` hat keine
   offene Arbeitszeitperiode.** Gefunden beim ersten Lauf von `verifyDesktopEffectiveness.ts`
   gegen die Arbeitskopie (Zahl 3 "Nutzer ohne offene Periode" war bereits vor jeder Änderung
   in diesem Plan `1`, nicht `0` wie in `11-DESKTOP-DISPOSITION.md` gemessen — dort lief die
   Messung gegen eine ältere Arbeitskopie `11-nullwirkung.db` mit 20 Nutzern, die lokale
   `development.db` hat inzwischen 32). Nicht durch Plan 12-08 verursacht (die Arbeitskopie
   wurde unverändert aus `database/development.db` gezogen, vor jedem Schreibzugriff dieses
   Plans gemessen) und außerhalb des WR-12-Scopes dieses Plans — betrifft die Datenkonsistenz
   der lokalen Entwicklungsdatenbank, nicht die periodengetreue Desktop-Berechnung. Empfehlung:
   in Phase 13 oder 14 prüfen, ob dieser Nutzer ein Datenfixture-Artefakt ist (Test-/Seed-Nutzer
   ohne vollständige Migration) oder ein echter Datendefekt.

2. **`server/database.db` (Projekt-Root) ist in dieser lokalen Windows-Arbeitsumgebung eine
   veraltete, unmigrierte Datei** (letzte Migration `006_add_time_entry_transaction_type`,
   Februar 2026) — sie hat keine `user_work_periods`-Tabelle und keine der Migrationen 007-011.
   Der im Plan wörtlich vorgegebene Befehl `cp server/database.db
   server/database/12-08-wirksamkeit.db` lief deshalb ins Leere (siehe Deviation unten). Die
   tatsächlich genutzte lokale Arbeitsdatenbank ist `server/database/development.db`
   (`getDatabasePath()` in `server/src/config/database.ts` wählt sie standardmäßig für
   `NODE_ENV=development`). Außerhalb des Scopes dieses Plans, ob `server/database.db` entfernt
   oder aktualisiert werden sollte — vermerkt für Phase 14 (Produktionslauf/Auslieferung).
