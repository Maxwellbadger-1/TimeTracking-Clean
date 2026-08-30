# Quick Task 260830-cg6: CR-01 und CR-03 aus 09.1-REVIEW.md schliessen - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Task Boundary

Zwei kritische Befunde aus `.planning/phases/09.1-journal-backfill-und-betriebs-h-rtung/09.1-REVIEW.md`
schliessen. Beide betreffen ausschliesslich Deployment-Konfiguration im Repository - es wird
**nichts** auf einem laufenden Server ausgefuehrt, kein SSH, kein Zugriff auf `production.db`.

**CR-01** (Review Zeile 75): Der crontab-Bereinigungsblock in
`.github/workflows/deploy-server.yml:133-137` und `.github/workflows/deploy-staging.yml:124-128`
kann den kompletten crontab loeschen. Der Anwender waehlt **nicht** die im Review vorgeschlagene
Haertung, sondern das ersatzlose Streichen des Blocks - er hat seinen Zweck erfuellt und traegt
nur noch Risiko.

**CR-03** (Review Zeile 176): `migrate:prod` und `validate:schema` laufen als eigene
`npx tsx`-Prozesse auf `production.db`, waehrend der Serverprozess sie offen haelt. Beide
Schritte gehoeren hinter `pm2 stop`/`pm2 delete`.

</domain>

<decisions>
## Implementation Decisions

### CR-01: crontab-Block ersatzlos streichen - Prämisse ist belegt
Der Block wird in **beiden** Workflows entfernt (nicht gehaertet). Die Voraussetzung dafuer ist
nachgewiesen, nicht angenommen:
- `09.1-NACHWEIS-PRODUKTION.md:215` - Produktions-crontab hat genau eine Zeile
  (`sync-prod-to-staging.sh`), `grep -c fix-overtime` = **0**
- `09.1-NACHWEIS-STAGING.md:165` - Staging-crontab identisch, `grep -c fix-overtime` = **0**

An die Stelle des Blocks gehoert ein **Kommentar**, der festhaelt, warum hier bewusst nichts mehr
steht (Einmal-Migration D-03, auf beiden Servern belegt erledigt, Verweis auf die beiden
Nachweisdateien). Ohne diesen Kommentar sieht die naechste Person eine Luecke statt einer
Entscheidung.

### CR-03: Reihenfolge aendern, mit Neustart im Fehlerpfad
`migrate:prod` und `validate:schema` wandern **hinter** `pm2 stop`/`pm2 delete` und **vor**
`pm2 start`. Der Backup-Schritt (`cp production.db .../backups/`) bleibt, wo er ist - er liest nur.

**Entscheidung des Anwenders zum Fehlerpfad:** Schlaegt die Migration bei gestopptem Server fehl,
wird der Server **wieder gestartet** und der Workflow bricht danach mit `exit 1` ab. Begruendung:
heute laeuft der alte Server bei einem Migrationsfehler einfach weiter; die neue Reihenfolge darf
diesen Schutz nicht ersatzlos aufgeben und aus einem fehlgeschlagenen Deployment einen Ausfall
machen. Der Neustart erfolgt mit demselben `pm2 start`-Aufruf und denselben Umgebungsvariablen wie
im Erfolgsfall. Die bekannte Einschraenkung wird im Kommentar benannt: gestartet wird auf einem
Code-Stand, dessen Migration nicht durchlief - deshalb `exit 1`, damit das Deployment sichtbar rot
ist und jemand hinsieht.

`validate:schema` laeuft weiterhin nicht-blockierend (`|| true`) und braucht daher keinen
Fehlerpfad.

### Staging symmetrisch mitziehen
`deploy-staging.yml` bekommt dieselbe Reihenfolge (dort: `pm2 stop/delete timetracking-staging`,
`migrate:prod` Zeile ~97, `validate:schema` Zeile ~106). Begruendung: die beiden Workflows sollen
nicht auseinanderlaufen, und Staging ist der Ort, an dem sich die neue Reihenfolge zuerst zeigt.

### WR-16 mit erledigen
`scripts/database/setup-cron.sh` legt genau den Eintrag wieder an, den CR-01 entfernt - auf ein
Ziel, das in Phase 9.1 geloescht wurde (`server/scripts/fix-overtime.ts`). Solange der
Bereinigungsblock im Workflow stand, gab es einen Waechter; mit dem Streichen faellt er weg.
Deshalb im selben Zug:
- `scripts/database/setup-cron.sh` entfernen (`git rm`)
- `scripts/README.md:348-351` und `ENV.md:343` auf den In-Prozess-Scheduler umschreiben
  (`server/src/services/cronService.ts`, `startOvertimeRecalcScheduler()`, taeglich 03:15
  Europe/Berlin), mit dem ausdruecklichen Satz, dass es bewusst KEINEN crontab-Eintrag mehr gibt
  und warum (`.planning/debug/wal-abgehaengt-20260827.md`)

### Vermerk in migrate.ts und validateSchema.ts
Wie im Review verlangt: beide Skripte bekommen im Kopfkommentar den Hinweis, dass sie gegen
`production.db` **nur bei gestopptem Server** laufen duerfen, mit Verweis auf CR-03 und
`.planning/debug/wal-abgehaengt-20260827.md`.

### Claude's Discretion
- Genaue Formulierung der Kommentare (deutsch, Ton wie die umgebenden Kommentare im Workflow)
- Ob die Doku-Anpassung in einem eigenen Commit oder zusammen mit dem `git rm` laeuft

</decisions>

<specifics>
## Specific Ideas

**Ausdruecklich NICHT im Umfang** (die uebrige Reviewliste bleibt unangetastet):
- CR-02 (`db.close()` in `fixOvertime.ts`)
- CR-04 (`sync-db.ts`)
- WR-01 bis WR-15, IN-01 bis IN-08
- Die im Review als "sauberere Alternative" genannte Verlagerung des `.sql`-Migrationslaufs in
  `runMigrations(db)` des Serverprozesses - das ist ein Umbau, hier ist die Mindestmassnahme gewollt

**Kein Zugriff auf laufende Systeme.** Es wird kein `ssh`, kein `gh workflow run`, kein `git push`
ausgefuehrt. Die Aenderungen werden committet und liegen fuer den naechsten reguläeren Deploy
bereit. `.claude/CLAUDE.md` verbietet ausdruecklich, `production.db` aus einem eigenen Prozess zu
oeffnen - einschliesslich readonly.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/phases/09.1-journal-backfill-und-betriebs-h-rtung/09.1-REVIEW.md` - CR-01 (Z. 75),
  CR-03 (Z. 176), WR-16 (Z. 730)
- `.planning/phases/09.1-journal-backfill-und-betriebs-h-rtung/09.1-NACHWEIS-PRODUKTION.md:211-228`
- `.planning/phases/09.1-journal-backfill-und-betriebs-h-rtung/09.1-NACHWEIS-STAGING.md:161-170`
- `.planning/debug/wal-abgehaengt-20260827.md` - der Vorfall, den beide Befunde adressieren
- `.claude/CLAUDE.md` - "Produktionsdatenbank: niemals aus einem eigenen Prozess oeffnen"

</canonical_refs>
