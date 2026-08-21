# Phase 10: Perioden-Fundament - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Auto-generated (discuss übersprungen, Empfehlungen des Orchestrators gesetzt)

<domain>
## Phase Boundary

Die Perioden-Tabelle existiert, ist migriert und beschreibbar — ohne dass sich am Verhalten
des Systems etwas ändert.

**Im Umfang:**
- Tabelle `user_work_periods` mit `validFrom`, `validTo`, `weeklyHours`, `workSchedule`
- Migration über den bestehenden `migrationRunner` — idempotent, ohne Ausfallzeit
- Bestandsüberführung: heutiger Stand jedes Nutzers wird eine Periode ab `hireDate`
- Datenbankseitige Absicherung gegen Überlappungen und Lücken
- Service-Schicht: Periode lesen, schreiben, zum Datum auflösen

**Requirements:** REQ-20, REQ-21, REQ-22

**Nicht im Umfang:**
- Keine Berechnung liest aus den Perioden — das ist Phase 11
- Keine API-Endpunkte, keine Oberfläche — das ist Phase 12/13
- Kein Produktionslauf der Migration — die Generalprobe ist Phase 14

</domain>

<decisions>
## Implementation Decisions

### Entschieden (Empfehlung des Orchestrators, vom Anwender pauschal autorisiert)

**D1 — `validTo` ist exklusiv und nullable.**
`validFrom` inklusiv, `validTo` exklusiv (Halboffenes Intervall `[validFrom, validTo)`).
Die laufende Periode hat `validTo = NULL`. Grund: Halboffene Intervalle machen
Lückenlosigkeit trivial prüfbar (`periode[n].validTo === periode[n+1].validFrom`) und
vermeiden die klassische Ein-Tages-Lücke am Monatswechsel. Datumsformat wie im
Bestand: `TEXT` im Format `YYYY-MM-DD`, timezone-frei.

**D2 — `weeklyHours` und `workSchedule` werden gemeinsam versioniert.**
Beide Spalten liegen in derselben Zeile von `user_work_periods` und sind gemeinsam
Pflicht (`weeklyHours NOT NULL`, `workSchedule` nullable wie in `users`, aber immer
zusammen mit dem passenden `weeklyHours` geschrieben). Das ist REQ-20 wörtlich: eine
Kombination aus alter Wochenstundenzahl und neuem Tagesplan darf nicht entstehen.

**D3 — Überlappungs- und Lückenschutz per DB-Constraint plus Trigger.**
SQLite kann keine Range-Exclusion-Constraints wie Postgres. Umsetzung:
`UNIQUE(userId, validFrom)` als Constraint plus ein `BEFORE INSERT`/`BEFORE UPDATE`
Trigger, der bei Überlappung mit `RAISE(ABORT, ...)` abbricht. REQ-22 verlangt
ausdrücklich, dass die Datenbank das verhindert, nicht die Oberfläche — ein
Service-seitiger Check allein erfüllt das Requirement nicht. Der Service-Check darf
zusätzlich existieren (bessere Fehlermeldung), ersetzt den Trigger aber nicht.

**D4 — `users.weeklyHours` und `users.workSchedule` bleiben in Phase 10 unangetastet.**
Kein Drop, kein Rename, kein Deprecation-Kommentar der etwas kaputt macht. Die Felder
bleiben bis Phase 11 die gelesene Quelle; die Perioden laufen daneben her. So bleibt
REQ-21 („an den Zahlen nicht ablesbar") mechanisch garantiert statt nur behauptet.

**D5 — Bestandsüberführung: `validFrom = hireDate`, Fallback dokumentiert.**
Jeder aktive Nutzer bekommt genau eine Periode ab seinem `hireDate` mit den heutigen
Werten und `validTo = NULL`. Nutzer ohne `hireDate` bekommen ein explizit gewähltes,
im SUMMARY dokumentiertes Ersatzdatum (frühestes `time_entries.date` des Nutzers, sonst
Projektstart) — nicht stillschweigend `1970-01-01`. Nutzer mit `endDate` in der
Vergangenheit bekommen ebenfalls eine Periode (die Historie muss auflösbar bleiben),
`validTo` bleibt trotzdem `NULL`, weil das Beschäftigungsende über `users.endDate`
abgebildet ist und nicht über die Arbeitszeitperiode.

**D6 — Verifikation der Nullwirkung ist Teil der Phase, nicht der nächsten.**
Vor und nach der Migration wird auf einer Kopie der Produktionsdatenbank ein
Salden-Snapshot aller Nutzer gezogen und verglichen. Identisch heißt identisch, nicht
„im Rahmen". Das Snapshot-Werkzeug wird so gebaut, dass Phase 11 und Phase 14 es
wiederverwenden können — dort ist derselbe Nachweis erneut gefordert.

**D7 — Migration idempotent über den bestehenden `migrationRunner`.**
Kein neues Migrationsframework. Zweimaliges Ausführen darf keine doppelten Perioden
erzeugen; die Bestandsüberführung prüft auf bereits vorhandene Perioden je Nutzer.

### Claude's Discretion
Genaue Spaltentypen, Indexnamen, Dateiaufteilung des Services und die Form des
Snapshot-Werkzeugs liegen im Ermessen der Planung — Leitplanken sind der Codebestand
(`server/src/database/schema.ts`, `migrationRunner`) und `.claude/CLAUDE.md`.

</decisions>

<code_context>
## Existing Code Insights

- `server/src/database/schema.ts:43` — `users.weeklyHours`, `:79` — `users.workSchedule`.
  Flache Felder ohne Historie; genau das, was hier neben-, aber noch nicht ersetzt wird.
- `migrationRunner` — bestehendes Migrationsmuster, laut REQUIREMENTS.md Constraints
  ausdrücklich zu nutzen statt etwas Neues zu erfinden.
- Muster aus Milestone v2.0 Phase 5 („Journal-Fundament"): Fundament ohne
  Verhaltensänderung, damit die Migration isoliert verifizierbar bleibt. Dieselbe Form
  hier anwenden.
- SQLite läuft im WAL-Modus. Frische Daten sind per direktem Dateizugriff nicht
  sichtbar — Verifikation über die API oder `pm2 logs`.
- Jedes Skript gegen die Produktionsdatenbank MUSS `DATABASE_PATH` explizit setzen; der
  Symlink `server/database.db` existiert auf dem Server seit 20.08.2026 nicht mehr.
- `npm run sync-dev-db` zieht eine frische Kopie der Produktionsdatenbank nach lokal.

</code_context>

<specifics>
## Specific Ideas

- Der Auflösungs-Service (`Periode zum Datum`) wird hier schon gebaut und getestet,
  auch wenn ihn in Phase 10 noch niemand aufruft. Phase 11 hängt sich dann nur noch
  daran — das hält den riskanten Eingriff ins Rechenwerk klein.
- Das Salden-Snapshot-Werkzeug aus D6 so schneiden, dass es einen Nutzer, eine Liste
  oder alle Nutzer abdecken kann; Phase 14 braucht die Alle-Variante.

</specifics>

<deferred>
## Deferred Ideas

- `users.weeklyHours`/`users.workSchedule` entfernen — frühestens nach Phase 11, eher
  ein eigener Aufräum-Schritt
- Urlaubsanspruch bei Teilzeitwechsel — ausdrücklich out of scope
  (`.planning/seeds/urlaubsanspruch-teilzeitwechsel.md`)
- Human-Verifikation / UAT dieser Phase — auf Anweisung des Anwenders ans Ende des
  Milestones gestellt

</deferred>
