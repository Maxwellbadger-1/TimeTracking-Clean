# Roadmap — TimeTracking System

## Milestones

- ✅ **v1.0 — 2-Tier DB Architecture** — Phasen 1–4 (abgeschlossen 2026-04-02)
- ✅ **v2.0 — Urlaubskonto: Korrektheit & Nachvollziehbarkeit** — Phasen 5–8 (abgeschlossen 2026-08-21)
- 🚧 **v3.0 — Historisierte Arbeitszeitmodelle** — Phasen 9–14 (gestartet 2026-08-21)

---

## Milestone v3.0 — Historisierte Arbeitszeitmodelle

**Ziel:** Eine Änderung der Arbeitsstunden gilt ab einem Stichtag — was davor gerechnet wurde,
bleibt unangetastet.

**Auslöser:** `users.weeklyHours` und `users.workSchedule` sind flache Felder ohne Historie.
`getDailyTargetHours()` löst die Sollstunden aus dem heutigen Stammdatensatz auf, weshalb jeder
Rebuild die gesamte Vergangenheit mit den neuen Stunden nachrechnet. Ein konkreter
Umstellungsfall steht an.

### Phasenübersicht

| Phase | Name | Requirements |
|-------|------|--------------|
| 9 | Ein Maßstab, ein Weg | REQ-17 – REQ-19 |
| 9.1 | Journal-Backfill und Betriebs-Härtung | REQ-19 (Rest) |
| 10 | Perioden-Fundament | REQ-20 – REQ-22 |
| 11 | Datumsabhängige Berechnung | REQ-23 – REQ-25 |
| 12 | Stundenwechsel bedienen | REQ-26 – REQ-29 |
| 13 | Korrigieren und rückgängig machen | REQ-30 – REQ-31 |
| 14 | Absicherung und Auslieferung | REQ-32 – REQ-33 |

---

### Phase 9: Ein Maßstab, ein Weg

**Ziel:** Vor dem ersten Umbau steht fest, dass alle Überstundenzahlen aus derselben Quelle
kommen. Kein Fundament mit Riss.

**Umfang**

- Inventar aller Stellen, die Soll-Arbeitszeit berechnen; jede läuft über
  `getDailyTargetHours()` (`server/src/utils/workingDays.ts:63`)

- Legacy-Pfad `overtimeService.ts` (monatliche Aggregation über `overtime_balance`) entweder
  stilllegen oder nachweislich auf dieselbe Auflösung setzen wie `unifiedOvertimeService.ts`

- Den bekannten Defekt „Überstundenausgleich erreicht den Saldo nicht" verifizieren, beheben
  oder als bewusst offen dokumentieren

- Die vier offenen Überstunden-Debug-Sessions sichten und zuordnen

**Erfolgskriterien**

- Für denselben Nutzer und Monat zeigen Dashboard und Berichte denselben Überstundenwert —
  an mindestens drei realen Nutzern geprüft

- Ein genehmigter `overtime_comp`-Antrag reduziert den Überstundensaldo, oder die Abweichung
  ist mit Grund dokumentiert

- `npm run validate:overtime:detailed` läuft für diese Nutzer ohne Abweichungsmeldung

**Pläne:** 5 Pläne in 5 Wellen

Pläne:

- [x] 09-01-PLAN.md — Inventar der Sollstunden-Ermittlung und Sichtung der vier Debug-Sessions (Welle 1)
- [x] 09-02-PLAN.md — Vergleichswerkzeug `validate:overtime:paths`, Prüfnutzerauswahl, Erstbefund (Welle 2)
- [x] 09-03-PLAN.md — Legacy-Pfad angleichen, Wochenend-Vorfilter beseitigen, Nachweis führen (Welle 3)
- [x] 09-04-PLAN.md — `overtime_comp`-Defekt reproduzieren, Ursache belegen, Fix oder Phase 9.1 (Welle 4)
- [x] 09-05-PLAN.md — Lückenschluss: alle Kopien der `overtime_comp`-Kreditierung zählen und schließen, Monatsend-Fehler im Journal, Kriterium-3-Nachweis, D2-Verankerung (Welle 5)

**Entscheidung aus `09-CONTEXT.md` (D1):** Der Legacy-Pfad wird angeglichen, nicht stillgelegt —
der vollständige Rückbau bleibt out of scope.

**Warum zuerst:** Wird die Historisierung auf zwei driftende Berechnungswege gesetzt,
verdoppelt sie den Fehler und macht ihn schwerer auffindbar.

**Risiko:** Der Umfang ist vor der Sichtung unklar — `OVERTIME_ARCHITECTURE.md` steht auf 🔴.
Sollte sich der Legacy-Rückbau als eigenes Vorhaben erweisen, wird hier neu zugeschnitten.

---

### Phase 9.1: Journal-Backfill und Betriebs-Härtung

**Ziel:** Die bereits gespeicherten `overtime_transactions`-Journalzeilen der
Produktionsdatenbank sind so vollständig wie die Zeilen, die ein Rebuild nach Plan 09-05
heute neu erzeugt — und die Betriebsskripte, die täglich unbeobachtet gegen Produktion
laufen, sind gegen die in `09-REVIEW.md` gefundenen Restrisiken abgesichert.

**Auslöser (D2, kein dritter Ausgang):** Plan 09-05 hat den Monatsend-Off-by-one in
`overtimeTransactionRebuildService.ts` und `overtimeService.ts` behoben
(`new Date(month + '-01')` parste als UTC-Mitternacht statt lokal) und mit einem Nachweis
gegen eine Wegwerfkopie belegt, dass `npm run validate:overtime:detailed` für alle drei
Prüfnutzer (userId 2/2026-07, 16/2026-07, 17/2026-04) danach abweichungsfrei läuft
(`09-ABSCHLUSS-NACHWEIS.md`, Erfolgskriterium 3 der Phase 9 erfüllt). Der Codefix repariert
damit nur **künftige** Rebuilds. Die schon in der Produktionsdatenbank gespeicherten
`overtime_transactions`-Zeilen bleiben unvollständig — jeder vollständig durchlaufene
Monat endet dort am vorletzten Kalendertag (u. a. userId 3/17 auf `2026-09-29`, userId 15
auf `2026-03-30`, userId 21/22/29 auf `2026-07-30`) —, bis für jeden betroffenen Nutzer und
Monat ein Rebuild läuft. Das ist ein Backfill über Bestandsdaten und damit ein
Produktionsschreibzugriff, den D5 in Phase 9 ausdrücklich verbietet.

**Umfang**

- Backfill des `overtime_transactions`-Journals über Bestandsdaten (alle Nutzer, alle
  Monate mit vollständig durchlaufenem Zeitraum), mit Generalprobe auf einer
  Produktionskopie vor jedem Schreibzugriff auf die echte Produktionsdatenbank

- Härtung der Betriebsskripte aus `09-REVIEW.md`, die in Plan 09-05 bewusst nicht
  mitbehoben wurden:

  - **WR-05** — `server/scripts/fix-overtime.ts` hat keine Fehlerisolierung pro Nutzer
    (ein defekter Datensatz bricht den gesamten täglichen Cron-Lauf ab) und ruft
    `db.close()` im Fehlerpfad nicht auf

    > **Nachtrag 28.08.2026 — der Punkt wiegt schwerer als hier beschrieben.**
    > Der Nachtlauf ist die Ursache der wiederkehrenden abgehängten WAL, nicht bloß ein
    > Robustheitsmangel. Gemessen: Der Cron um 03:00 startet das Skript als **eigenen**
    > `npx tsx`-Prozess auf `production.db` und ruft am Ende `db.close()` (Zeile 93).
    > SQLite räumt WAL und SHM beim Schließen auf, sobald der schließende Prozess kurz die
    > exklusive Sperre bekommt — nachts ist der Server idle, also bekommt er sie. Danach
    > schreibt der Serverprozess in eine aus dem Dateisystem gelöste Datei. Am 28.08.2026
    > standen die Dateizeiger 20 und 21 des Servers erneut auf `(deleted)`; die
    > Verzeichnis-mtime von `databases/` trug `03:00`.
    >
    > **Beide Vorfälle (18.08. und 27.08.) hatten damit vermutlich dieselbe Ursache** — es
    > wurde bisher immer ein manueller Fremdzugriff verdächtigt. Der am 28.08. ausgelieferte
    > `SIGTERM`/`SIGINT`-Prüfpunkt (`ad48068`) entschärft die Folgen eines Neustarts, aber
    > **nicht die Ursache**: zwischen 03:00 und dem nächsten Prüfpunkt hängt der Schreibstand
    > weiterhin allein am offenen Dateizeiger.
    >
    > Der Umfang ist damit größer als „try/catch ergänzen": zu entscheiden ist, ob der
    > Nachtlauf überhaupt eine eigene Datenbankverbindung öffnen darf, oder ob er über den
    > laufenden Server gehen muss (ein Prozess, eine Verbindung).

  - **WR-03 (Restpunkt)** — kein `busy_timeout`-Pragma im Projekt (`grep -rn
    "busy_timeout" server/src` liefert keinen Treffer, unabhängig in Plan 09-05 erneut
    bestätigt); ein täglicher Cron-Prozess und der Server-Prozess halten getrennte
    Verbindungen auf dieselbe Datei — ein echter Schreibkonflikt schlägt sofort mit
    `SQLITE_BUSY` fehl statt zu warten. Der Wechsel von `fix-overtime.ts` auf die geteilte
    Verbindung (Plan 09-03) ist dabei laut abschließender Bewertung in Plan 09-05 netto
    eine Verbesserung, kein neues Risiko — siehe `09-ABSCHLUSS-NACHWEIS.md`

  - **WR-04** — `server/scripts/**` ist von `tsconfig.json:26` ausgeschlossen und damit
    ungetypt (`../dist/`-Importe ohne `.d.ts` sind faktisch `any`)

  - **WR-02 (Restumfang)** — weitere Servicefunktionen ohne dedizierte Tests, über die in
    Plan 09-05 hinaus gefundenen Dateien hinaus

  - **WR-07** — `overtimeLiveCalculationService.test.ts:96-112` hängt von einem
    Feiertags-Fixture in `development.db` statt von einem selbst kontrollierten
    Setup/Teardown ab

**Erfolgskriterien**

- Nach dem Backfill zeigt `npm run validate:overtime:detailed` für eine Stichprobe realer
  Nutzer/Monate (mindestens die drei Prüfnutzer aus `09-PRUEFNUTZER.csv`, gegen die echte
  Produktionsdatenbank nach dem Backfill) keine Transaktions-Abweichung mehr

- `fix-overtime.ts` verarbeitet einen einzelnen defekten Datensatz mit Fehlerprotokoll,
  ohne die übrige Belegschaft in diesem Lauf zu blockieren

- Ein `PRAGMA busy_timeout` ist gesetzt und mit einem echten Nebenläufigkeitstest belegt
- `server/scripts/**` läuft unter `tsc --noEmit`

**Abhängigkeit:** Phase 9

> **⚠ Ausführungsfenster — nicht überlesen.** Diese Phase hat noch keine Pläne. Werkzeuge,
> die den Fortschritt aus der Zahl offener Pläne ableiten, melden sie deshalb fälschlich als
> „complete" (0 von 0 offen). Sie ist **nicht** erledigt.
>
> **Festgelegt am 22.08.2026:** Der Backfill schreibt in die Produktionsdatenbank und wird
> deshalb **gemeinsam mit dem Produktionslauf der Phase 14** ausgeführt — ein Wartungsfenster,
> ein Backup, eine Verifikation. Die reinen Codeanteile (WR-02 bis WR-05, WR-07) können
> vorher laufen. Der Produktionsschreibzugriff bedarf der ausdrücklichen Freigabe des
> Anwenders (siehe Phase 14, Entscheidung D2).

**Einordnung nach Plan 14-07:** Diese Phase ist **aufgeteilt**. Der Journal-Backfill läuft im
Produktionsfenster der Phase 14 mit, und zwar als zweiter, eigens freigegebener Schritt NACH
der Verifikation aus Plan 14-09 — er bewegt sowohl `overtime_transactions` als auch
`overtime_balance` und damit genau die Größen, über die diese Verifikation urteilt. Die
Code-Härtung WR-02 bis WR-05 bleibt in Phase 9.1; WR-07 hat Plan 14-02 bereits geschlossen.
Begründung mit Codebelegen und Probelaufprotokoll:
[`14-URTEIL-PHASE-9.1.md`](phases/14-absicherung-und-auslieferung/14-URTEIL-PHASE-9.1.md).

**Warum als eigene Phase statt in Phase 9:** D2 (`09-CONTEXT.md`) weist einen Backfill über
Bestandsdaten ausdrücklich einer eigenen Phase zu, sobald er über eine reine Codeänderung
hinausgeht — genau der hier vorliegende Fall. D5 verbietet den nötigen
Produktionsschreibzugriff in Phase 9.

**Plans:** 8 Pläne, 6 Wellen (geplant 2026-08-29; Umfang nach `09.1-CONTEXT.md`: nur die
Code-Härtung WR-02 bis WR-05 — der Backfill ist am 26.08.2026 im Fenster der Phase 14 gelaufen,
WR-07 hat Plan 14-02 geschlossen)

Plans:

- [x] 09.1-01-PLAN.md — WR-03: `busy_timeout` zentral setzen, echter Nebenläufigkeitstest mit Gegenprobe (Welle 1)
- [x] 09.1-02-PLAN.md — WR-02: `overtime_comp` isoliert gegen den Rebuild-Weg, `ensureOvertimeBalanceEntries()` abdecken (Welle 2, nach 09.1-01)
- [x] 09.1-03-PLAN.md — WR-04: `server/scripts/` auflösen, 13 Legacy-Skripte entfernen, Aufrufpfade nachziehen (Welle 2, nach 09.1-01)
- [x] 09.1-04-PLAN.md — WR-05: Nachtlauf in den Serverprozess (03:15 Europe/Berlin), Fehlerisolierung je Nutzer (Welle 2, nach 09.1-01)
- [ ] 09.1-05-PLAN.md — WR-05: Werkzeug härten und verschieben, beide crontab-Einträge und Post-Deploy-Läufe entfernen (Welle 3)
- [ ] 09.1-06-PLAN.md — Auslieferung Staging (Green, Port 3001) mit Wirkungsnachweis (Welle 4)
- [ ] 09.1-07-PLAN.md — Auslieferung Produktion (Blue, Port 3000) nach Freigabe, Kerndokumentation nachziehen (Welle 5)
- [ ] 09.1-08-PLAN.md — Beobachtungsnachweis über mindestens zwei Nächte, Phasenabschluss (Welle 6)

---

### Phase 10: Perioden-Fundament

**Ziel:** Die Perioden-Tabelle existiert, ist migriert und beschreibbar — ohne dass sich am
Verhalten des Systems etwas ändert.

**Umfang**

- Tabelle `user_work_periods` mit `validFrom`, `validTo`, `weeklyHours`, `workSchedule`
- Migration über den bestehenden `migrationRunner` — idempotent, ohne Ausfallzeit
- Bestandsüberführung: heutiger Stand jedes Nutzers wird eine Periode ab `hireDate`
- Datenbankseitige Absicherung gegen Überlappungen und Lücken
- Service-Schicht: Periode lesen, schreiben, zum Datum auflösen

**Erfolgskriterien**

- Migration läuft auf einer Kopie der Produktionsdatenbank fehlerfrei durch,
  `integrity_check: ok`

- Jeder aktive Nutzer hat genau eine Periode, deren Werte den heutigen Stammdaten entsprechen
- Ein Überlappungsversuch wird von der Datenbank abgewiesen, nicht erst von der Oberfläche
- Bestehendes Verhalten unverändert — noch liest keine Berechnung aus den Perioden

**Warum hier:** Dasselbe Muster wie Phase 5 im Urlaubs-Milestone — Fundament ohne
Verhaltensänderung, damit die Migration isoliert verifizierbar bleibt.

**Abhängigkeit:** Phase 9

**Plans:** 6 plans in 4 Wellen (Welle 1: 10-01 · Welle 2: 10-02, 10-03, 10-04 · Welle 3: 10-05 · Welle 4: 10-06)

Plans:

- [x] 10-01-PLAN.md — Migration 008: Tabelle `user_work_periods`, Constraints, Trigger; Spiegel in `schema.ts`, Typ `UserWorkPeriod`
- [x] 10-02-PLAN.md — Verhaltensmatrix der Datenbankriegel; CLI `migrate:copy` und Migrationslauf gegen eine Kopie
- [x] 10-03-PLAN.md — Migration 009: Bestandsüberführung ab `hireDate`, idempotent, mit Selbstverifikation
- [x] 10-04-PLAN.md — `workPeriodService`: Periode lesen, schreiben, zum Datum auflösen (noch ohne Aufrufer)
- [x] 10-05-PLAN.md — Salden-Snapshot-Werkzeug und Nullwirkungs-Nachweis auf einer Produktionskopie
- [x] 10-06-PLAN.md — Lückenschluss nach Code-Review: Migrationsläufer verbucht Fehlschläge nicht mehr als Erfolg (CR-01), DELETE-Riegel gegen leere Periodenkette (WR-01), `any` entfernt (WR-02), Produktionsschutz getestet (WR-03)

---

### Phase 11: Datumsabhängige Berechnung

**Ziel:** Die Sollstunden eines Tages kommen aus der Periode, die an diesem Tag galt.

**Umfang**

- `getDailyTargetHours(user, datum)` löst über die Periode auf statt über den aktuellen
  Stammdatensatz

- Entscheidung und Umsetzung: Perioden vorladen oder je Aufruf nachschlagen (Tagesschleifen
  über ein Jahr sind der kritische Fall)

- Alle Aufrufer nachziehen: 7 Services, 3 Validierungsskripte, Desktop-Anzeigen
- `scripts/validateOvertimeDetailed.ts` prüft gegen den periodengültigen Maßstab
- Rebuild-Wege (`overtimeTransactionRebuildService`, `refreshOvertimeBalances`)
  periodenbewusst machen

**Erfolgskriterien**

- Ein Testnutzer mit Modellwechsel bekommt für jeden Tag die Sollstunden, die an diesem Tag
  galten — vor und nach dem Stichtag geprüft

- Ein zweifach ausgeführter Rebuild liefert identische Ergebnisse
- Für Nutzer ohne Modellwechsel sind alle Salden vor und nach dem Umbau unverändert
- Das Validierungswerkzeug meldet bei einem Nutzer mit Modellwechsel keine Abweichung

**Abhängigkeit:** Phase 10 — ohne Perioden nichts aufzulösen

**Risiko:** Der eigentliche Eingriff ins Rechenwerk. Läuft zuerst vollständig auf einer Kopie
der Produktionsdatenbank.

**Plans:** 11 plans in 5 Wellen (Welle 1: 11-01, 11-02, 11-03 · Welle 2: 11-04 · Welle 3: 11-05,
11-06, 11-07, 11-08, 11-11 · Welle 4: 11-09 · Welle 5: 11-10)

Plans:

- [x] 11-01-PLAN.md — Ausgangszustand messen: Arbeitskopie, Salden-Snapshot vorher, Aufrufer-Checkliste
- [x] 11-02-PLAN.md — `workPeriodContext`: Perioden je Lauf vorladen, durchreichen statt global halten (D1, D2)
- [x] 11-03-PLAN.md — Lückenlose Periodenkette im Betrieb: Startperiode bei der Nutzeranlage, Spiegelung bei Änderung
- [x] 11-04-PLAN.md — Der Eingriff: `getDailyTargetHours` löst über die Periode auf, Pflichtparameter ohne Vorgabewert (D3, D4)
- [x] 11-05-PLAN.md — Kanonischer Überstundenweg und Rebuild periodenbewusst
- [x] 11-06-PLAN.md — Legacy-Pfad und Live-Anzeige, D7-Nachweis
- [x] 11-07-PLAN.md — Abwesenheiten, Überstundenausgleich und DATEV-Export
- [x] 11-08-PLAN.md — Validierungs- und Migrationswerkzeuge periodenbewusst (REQ-25)
- [x] 11-11-PLAN.md — Nutzeranlegende Skripte legen die Startperiode mit an; `create-admin.ts` gesondert geprüft
- [x] 11-09-PLAN.md — Vollständigkeits- und Idempotenz-Nachweis, Desktop-Disposition, Gesamtgrün (REQ-23, REQ-24)
- [x] 11-10-PLAN.md — Nullwirkungs- und Wirkungsnachweis auf echten Daten (D5, D6, REQ-25)

---

### Phase 12: Stundenwechsel bedienen

**Ziel:** Ein Admin kann eine Stundenumstellung eintragen und vorher sehen, was sie bewirkt.

**Umfang**

- API und Oberfläche für „Stundenwechsel ab Datum"; Stichtag in Zukunft oder Vergangenheit
- Vorschau vor dem Speichern: Sollstunden vorher/nachher, resultierende Saldoänderung
- Der bestehende Überstundensaldo wird nicht umgerechnet — Stunden bleiben Stunden
- Entstehende Differenz als eigene Buchung im Überstunden-Journal, mit Bezug auf die Periode
- Einbindung in die Stammdaten-Oberfläche (`EditUserModal.tsx`, `WorkScheduleEditor.tsx`)
- Desktop-Nachzug der periodengetreuen Sollstunden-Berechnung (bewusst aus Phase 11
  ausgelassen, s. `.planning/phases/11-datumsabh-ngige-berechnung/11-DESKTOP-DISPOSITION.md`):
  `desktop/src/utils/timeUtils.ts`, `desktop/src/components/absences/AbsenceRequestForm.tsx`,
  `desktop/src/components/worktime/WorkScheduleDisplay.tsx`

**Erfolgskriterien**

- Eine Umstellung 40→20 zum 01.10. verändert die Überstunden vor dem 01.10. um keine Minute
- Ein rückwirkender Stichtag (Vertrag gilt seit 01.07., eingetragen im September) rechnet ab
  dem 01.07. neu und lässt davor alles stehen

- Die Vorschau zeigt vor dem Speichern denselben Wert, der danach tatsächlich im Konto steht
- Die Saldodifferenz ist im Kontoauszug als eigene Zeile mit Begründung sichtbar

**Abhängigkeit:** Phase 11

**Plans:** 9/9 Pläne abgeschlossen — 9 Pläne in 5 Wellen (Welle 1: 12-01, 12-02 · Welle 2: 12-03, 12-04 · Welle 3: 12-05, 12-06, 12-08 · Welle 4: 12-07 · Welle 5: 12-09)

Plans:

**Wave 1**

- [x] 12-01-PLAN.md — Migration 011 (`model_change`), Vertragstypen, Perioden-Lese-API `GET /api/work-periods` (D5, D6)
- [x] 12-02-PLAN.md — Modal-Infrastruktur: `modalStack.ts`, Portal, `zIndexClass`, ESC-Stapel, Fokusfalle

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-03-PLAN.md — Wechsel-Service mit echtem Trockenlauf und signiertem `previewToken` (D2, D3, D4, D7)
- [x] 12-04-PLAN.md — Desktop-Datenschicht: Hooks und Periodenliste

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 12-05-PLAN.md — Endpunkte `POST /preview` und `POST /change` plus Nachweis der vier Erfolgskriterien (D6)
- [x] 12-06-PLAN.md — Der Wechsel-Dialog mit Vorschaupanel, Bestätigung und allen 15 Zuständen (REQ-26, REQ-27)
- [x] 12-08-PLAN.md — WR-12-Nachzug: Desktop rechnet periodengetreu, Wirksamkeitsfenster erneut gemessen

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 12-07-PLAN.md — Einbindung in die Stammdaten-Oberfläche und Sichtbarkeit im Kontoauszug (D1, REQ-29)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 12-09-PLAN.md — E2E-Test umgeschrieben, Pflicht-Gates, gebündelte UAT-Liste für Phase 14 (D8)

---

### Phase 13: Korrigieren und rückgängig machen

**Ziel:** Ein Fehler beim Eintragen ist heilbar, und die Heilung ist nachvollziehbar.

**Umfang**

- „Stammdaten korrigieren" als getrennte Aktion mit eigener Warnung und Pflichtbegründung —
  für den Fall, dass die hinterlegten Stunden von jeher falsch waren

- Periode bearbeiten und löschen; Neuberechnung ab ihrem Beginn
- Korrekturbuchungen werden storniert statt gelöscht, die Storno-Geschichte bleibt sichtbar
- Serverseitige Rollenprüfung für alle Perioden-Endpunkte

**Erfolgskriterien**

- Eine versehentlich eingetragene Umstellung lässt sich löschen; danach entsprechen die
  Überstunden exakt dem Stand davor

- Nach dem Löschen zeigt der Auszug Buchung und Storno — nicht eine bereinigte Lücke
- Die Korrektur-Aktion ohne Begründung wird abgewiesen
- Ein Mitarbeiter kann die Perioden eines anderen weder sehen noch über die API abrufen

**Abhängigkeit:** Phase 12

**Plans:** 11/11 plans complete

Plans:

**Wave 1**

- [x] 13-01-PLAN.md — Migration 013 (Soft-Delete auf `user_work_periods`, deletedAt-bewusste Riegel) und Migration 014 (`reversalOf`), Parität in `schema.ts` (D2, D3)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-02-PLAN.md — Lesepfade filtern, Soft-Delete- und Lückenschluss-Schreibweg, Verträge, Freigabe der Phase-12-Rechenbausteine (D2, D3)
- [x] 13-06-PLAN.md — Kontoauszug-Lesepfad: Storno-Felder, gemeinsame Belegnummer, nicht summierende Gegenbuchung (D2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-03-PLAN.md — `correctWorkPeriod()`: rückwirkende Korrektur einer bestehenden Periode, eine Rechenbahn für Vorschau und Speichern (D1, D4, D6, D7 — REQ-30)
- [x] 13-04-PLAN.md — `deleteWorkPeriod()`: Soft-Delete, Lückenschluss, Rebuild und Gegenbuchung, plus der Doppelzählungs-Nachweis (D2, D3, D4, D6, D7 — REQ-31)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 13-05-PLAN.md — Vier Endpunkte, getrennte Vorschau-Token, HTTP-Autorisierungstest mit 403 für fremde Perioden (D1, D5, D6, D7)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 13-07-PLAN.md — Desktop-Datenschicht: gespiegelte Verträge, vier Hooks, fünf additive Eigenschaften am `ConfirmDialog` (D5, D7)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 13-08-PLAN.md — Korrektur-Dialog `WorkTimePeriodEditModal`, Zustand „Kein Zugriff" und Fußnote in der Periodenliste (D1, D3, D7)
- [x] 13-10-PLAN.md — Storno-Paar im Kontoauszug: Zustands-Badges, Beleg-Chip, Sprungmarke; Debugausgaben aus `api/client.ts` entfernt (D2)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 13-09-PLAN.md — `EditUserModal`: Korrekturblock, Zeilenaktionen, Löschbestätigung mit Server-Vorschau, Erfolgsbanner (D1, D2, D3)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 13-11-PLAN.md — Pflicht-Gates, Entscheidungsabgleich D1 bis D7, gebündelte UAT-Liste für Phase 14

---

### Phase 14: Absicherung und Auslieferung

**Ziel:** Der Umbau ist belegt, generalprobt und bei den Anwendern.

**Umfang**

- Testabdeckung: Reduzierung mit künftigem Stichtag, Erhöhung mit rückwirkendem Stichtag,
  Stichtag mitten im Monat, Wechsel über einen Jahreswechsel, Periode löschen und neu rechnen

- Vollständiger Durchlauf auf einer Kopie der Produktionsdatenbank mit Vorher/Nachher-Vergleich
  aller Salden

- Backup vor dem Produktionslauf, Rückweg dokumentiert und erprobt
- Der konkret anstehende Umstellungsfall wird eingetragen und verifiziert
- Desktop-Release, damit die Änderungen die Anwender erreichen

**Erfolgskriterien**

- Alle Salden von Nutzern ohne Modellwechsel sind vor und nach dem Produktionslauf identisch
- Der reale Umstellungsfall ist eingetragen und ergibt die erwarteten Werte
- Release veröffentlicht, `latest.json` enthält alle Plattformen
- `tsc --noEmit` grün für Server und Desktop

**Abhängigkeit:** Phase 13

**Plans:** 11 Pläne (8 Wellen)

Plans:

**Welle 1**

- [x] 14-01-PLAN.md — REQ-32: die fünf Wechselfälle einzeln nachweisen, den einen fehlenden Fall (Erhöhung mit rückwirkendem Stichtag) schließen
- [x] 14-02-PLAN.md — WR-07 schließen: `PUT /api/users/:id` ändert Wochenstunden nicht mehr an der Perioden-Historie vorbei (Entscheidung: vor dem Produktionslauf)
- [x] 14-03-PLAN.md — Abnahmesitzung vorbereiten: die 86 gesammelten Punkte nach Prüfweg gruppieren, Dubletten zusammenführen, Ablauf mit Zeitschätzung

**Welle 2** *(blocked on Welle 1)*

- [x] 14-04-PLAN.md — Produktionskopie ziehen, Migrationsstand der Produktion messen, Migrationsfolge auf der Kopie fahren und ihre Nullwirkung belegen

**Welle 3** *(blocked on Welle 2)*

- [x] 14-05-PLAN.md — Generalprobe: Zwei-Stufen-Umstellungsskript und der maschinelle Vorher/Nachher-Saldenvergleich (D3, D5 — REQ-33)

**Welle 4** *(blocked on Welle 3)*

- [x] 14-06-PLAN.md — Rückweg erproben und als Runbook festschreiben (D8)
- [x] 14-07-PLAN.md — Urteil zu Phase 9.1, Backfill-Werkzeug bauen und auf einer Produktionskopie proben

**Welle 5** *(Produktionsfenster, Freigabe erteilt — gelaufen am 23.08.2026)*

- [x] 14-08-PLAN.md — Freigabe, Sicherung, Auslieferung, Migrationsverifikation auf der Produktion (D1, D2)

**Welle 6** *(gelaufen am 27.08.2026)*

- [x] 14-09-PLAN.md — Der reale Umstellungsfall (D6): Werte erfragen, Trockenlauf, Schreiblauf, Verifikation
  *(Abweichung: vom Anwender in der Desktop-App eingetragen statt über `applyModelChange.ts`; Beleg `14-UMSTELLUNGSFALL.md`, SUMMARY am 28.08.2026 nachgetragen)*

**Welle 7** *(gelaufen am 26.08.2026 — vor Welle 6, siehe Abweichung)*

- [x] 14-10-PLAN.md — Journal-Backfill der Phase 9.1 als zweiter gated Schritt im selben Fenster
  *(Abweichung: lief einen Tag vor Welle 6; unschädlich und mit Zahlen belegt in `14-BACKFILL-PRODUKTION.md`, Abschnitt 6. SUMMARY am 28.08.2026 nachgetragen)*

**Welle 8** *(gelaufen am 26.08.2026)*

- [x] 14-11-PLAN.md — Release v1.9.0, `latest.json` plattformweise prüfen, Dokumentation nachziehen (D7)

---

### Phase 14.1: Rechenwerk-Blocker aus dem Produktionslauf schließen (INSERTED — DRINGEND)

**Ziel:** Die fünf Blocker, die die breite Fehlersuche nach dem Produktionslauf zutage
gefördert hat, sind geschlossen — bevor das Release ausgeliefert wird.

**Herkunft:** `.planning/phases/14-absicherung-und-auslieferung/14-WEITERE-BEFUNDE.md`
(15 Befunde, 5 Blocker, 10 Warnungen). Die zehn Warnungen gehen bewusst **nicht** in diese
Phase — sie berühren Zeitzonen und Rundung im Kern des Rechenwerks und gehören in einen
eigenen Milestone nach der Auslieferung.

**Reihenfolge:** Diese Phase läuft **vor Plan 14-11** (Release v1.9.0). Die Blocker sollen
mit demselben Release ausgeliefert werden, nicht in einem Nachzügler.

**Umfang**

- **BL-01 — Der Saldo über dem Kontoauszug rechnet in die Zukunft, die Liste darunter nicht.**
  `overtimeLiveCalculationService.ts:712` deckelt nicht auf heute, die Schwesterfunktion
  `:226-228` schon; der Desktop hat seine eigene Deckelung im Zuge von WR-10 abgegeben.
  Wirkt heute: Nutzer 17 wird 8,00 h zu niedrig angezeigt.

- **BL-02 — `require()` in einem ES-Modul.** `absenceService.ts:1198` und `:1421`, beide in
  `try/catch` — die Neuberechnung nach dem Löschen einer genehmigten Abwesenheit läuft nie.

- **BL-03 — Historien-Export filtert weder `status` noch `deletedAt`.**
  `exportService.ts:353-371`. 15 abgelehnte Anträge und 5 stillgelegte Konten landen im
  Export. Die DATEV-Schwesterfunktion derselben Datei macht beides richtig und begründet.

- **BL-04 — Überstundenausgleich auf drei Wegen.** `absenceService.ts:1597-1631` schreibt von
  Hand in `overtime_balance` vergangener Monate; die `compensation`-Journalzeile liest
  niemand. Im Bestand: 0 solche Zeilen gegen 3 genehmigte Ausgleiche.

- **BL-05 — Eine Krankmeldung löst keine Neuberechnung aus.**
  **Die Auto-Genehmigung ist Absicht und bleibt** — Krankmeldungen sollen ausdrücklich
  nicht genehmigt werden müssen (`absenceService.ts:573`, Anweisung des Anwenders vom
  25.08.2026). Der Fehler liegt daneben: Der reguläre Genehmigungsweg (`:890-908`) führt
  einen Block aus, der wörtlich als `CRITICAL: Update overtime calculations for all
  affected months` markiert ist und die `sick_credit`-Buchungen erzeugt. Dem
  Krankmeldungs-Weg (`:598-604`) fehlt genau dieser Block; `updateBalancesAfterApproval`
  behandelt `sick` als „nichts zu tun" (`:1317`).
  Bisher verdeckt durch den nächtlichen Lauf um 03:00 Uhr, der es nachholte. Der ist seit
  dem 23.08. angehalten — **eine heute eingetragene Krankmeldung wird derzeit nicht
  gutgeschrieben.**
  **Nicht im Umfang:** `approvedBy` und `approvedAt` bleiben bei auto-genehmigten
  Krankmeldungen leer. Ein Zeitstempel wurde erwogen und vom Anwender am 25.08.2026
  ausdrücklich verworfen — der Anlegezeitpunkt steht ohnehin in `createdAt`. Kein
  Eingriff an den vier Bestandsanträgen 46, 60, 68, 70.

- **Datenbereinigung:** 59 fiktive Journalbuchungen für Tage, die noch nicht stattgefunden
  haben (Nutzer 3 und 17 September 2026, Nutzer 30 Oktober 2026) sowie die drei zugehörigen
  Zeilen in `overtime_balance`. Nur nach Sicherung und wiederherstellbar.

**Erfolgskriterien**

- Der Saldo über dem Kontoauszug und die Summe der darunter gezeigten Buchungen stimmen für
  jeden Nutzer überein — an einem Tag, der nicht der Monatsletzte ist

- Kein Journaleintrag und keine Monatszeile trägt ein Datum in der Zukunft
- Eine neu angelegte Krankmeldung wird weiterhin **ohne Genehmigung** wirksam, löst aber
  sofort dieselbe Neuberechnung aus wie jede andere genehmigte Abwesenheit — die
  `sick_credit`-Buchungen stehen unmittelbar nach dem Anlegen im Journal, nicht erst nach
  dem nächsten nächtlichen Lauf. Nachweis bei **angehaltenem** Nachtlauf, sonst beweist
  der Test nichts.

- Die Auto-Genehmigung von Krankmeldungen bleibt unverändert bestehen; `approvedBy` und
  `approvedAt` bleiben leer, und die vier Bestandsanträge werden nicht angefasst

- Der Historien-Export enthält weder abgelehnte Anträge noch stillgelegte Konten
- Das Löschen einer genehmigten Abwesenheit rechnet nachweislich neu
- Ein genehmigter Überstundenausgleich hinterlässt genau eine Spur, nicht drei
- Jeder Fix hat einen eigenen Commit und ist einzeln rückgängig machbar
- Keine Zeile in `time_entries`, `absence_requests`, `overtime_corrections`,
  `vacation_balance` und `vacation_transactions` wird angefasst

**Abhängigkeit:** Phase 14 (Deployment ist erfolgt, die Befunde stammen daraus)

**Risiko:** BL-01 und die Datenbereinigung ändern für Mitarbeiter sichtbare Zahlen. Beides
zuerst vollständig auf einer Produktionskopie, mit Vorher/Nachher-Vergleich aller Salden.

**Plans:** 6 Pläne, 6 Wellen (durchgehend seriell — ein Plan je Befund nach D-07, und alle
Tests laufen laut `server/vitest.config.ts` mit `fileParallelism: false` gegen dieselbe
`database/development.db`, zwei parallele Pläne würden sich gegenseitig stören)

Plans:

**Welle 1**

- [x] 14.1-01-PLAN.md — BL-01: Saldo über dem Kontoauszug auf heute deckeln, `deletedAt` filtern; dazu die bewusste Änderung des Phase-12-Tests (D-10)
      *Abgeschlossen 2026-08-25 — 4 Commits, Gates gruen (539 gruen / 3 rot, rote Menge unveraendert). Nachgemessen an allen 15 aktiven Nutzern: 8 mit Zukunftsdifferenz vorher, 0 nachher. Nachweis: `14.1-NACHWEIS-BL01.md`, Zusammenfassung: `14.1-01-SUMMARY.md`. **Offen geblieben:** Das erste Erfolgskriterium der Phase ist nur fuer die BL-01-Ursache erreicht — ein zweiter, neu entdeckter Befund (Abwesenheits-Gutschriften ohne Gegenbuchung) laesst fuer 3 Nutzer eine Restdifferenz stehen; vermerkt in `deferred-items.md` und als 14.1-U3 zur Entscheidung vorgelegt.*

**Welle 2** *(blocked on Welle 1)*

- [x] 14.1-02-PLAN.md — BL-02: `require()` durch ESM-Import ersetzen, Löschpfad rechnet nachweislich neu; legt den Importstil für 14.1-03 fest
      *Abgeschlossen 2026-08-25 — 2 Commits, Gates gruen (542 gruen / 3 rot, rote Menge unveraendert). In Zahlen belegt: overtime_transactions mit der referenceId des Antrags 2 → 0, work_time_accounts.currentBalance −168,00 h → −176,00 h, beides unmittelbar nach der Loeschung bei angehaltenem Nachtlauf (D-11). Gegenversuch protokolliert (ohne den Fix 2 von 3 Tests rot). **Importstil fuer 14.1-03 festgeschrieben:** statischer Top-Level-Import, Begruendung und Laufzeit-Ladeprobe in `14.1-NACHWEIS-BL02.md`, Abschnitt 4. Zusammenfassung: `14.1-02-SUMMARY.md`. **Neu aufgekommen:** work_time_accounts bleibt nach dem Loeschen auf einem Zwischenstand (8,00 h Restdifferenz) — vermerkt in `deferred-items.md` und als 14.1-U5 zur Entscheidung vorgelegt, NICHT mitrepariert.*

**Welle 3** *(blocked on Welle 2 — gleiche Datei `absenceService.ts`, gleicher Importstil)*

- [x] 14.1-03-PLAN.md — BL-05: Krankmeldung löst sofort dieselbe Neuberechnung aus; Auto-Genehmigung bleibt unverändert
      *Abgeschlossen 2026-08-25 — 2 Commits, Gates gruen (547 gruen / 3 rot, rote Menge unveraendert; die gruene Menge ist um genau die 5 neuen Tests gewachsen). In Zahlen belegt: `overtime_transactions` mit `type = 'sick_credit'` 0 → 1 Zeile, Summe +8,00 h (genau ein Tagessoll), gemessen in der Anweisung unmittelbar nach `createAbsenceRequest` — bei angehaltenem Nachtlauf und ohne zwischengeschaltete Berichtsabfrage (D-11). Der Block steht in `createAbsenceRequest` und nicht in `updateBalancesAfterApproval`, weil diese Funktion zwei Aufrufer hat und der regulaere Weg ihn ohnehin direkt danach ausfuehrt. Derselbe Importstil wie 14.1-02 (statischer Top-Level-Import), kein Signaturwechsel. **Auto-Genehmigung unveraendert und jetzt festgeschrieben:** `approved`, `approvedBy`/`approvedAt` NULL, kein `audit_log`, Abgrenzung zum pending-Urlaubsantrag — drei Regressionstests. Die Bestandsantraege 46, 60, 68, 70 sind vor und nach dem Plan identisch, die fuenf nach D-08 geschuetzten Tabellen Zeile fuer Zeile unveraendert. Gegenversuch protokolliert (ohne den Fix Test 1 rot: `expected 0 to be greater than 0`). Zusammenfassung: `14.1-03-SUMMARY.md`, Nachweis: `14.1-NACHWEIS-BL05.md`. **Neu aufgekommen:** `work_time_accounts` wird beim Anlegen einer Krankmeldung nicht fortgeschrieben (Kontostand bleibt um ein Tagessoll zurueck) — vermerkt in `deferred-items.md` und als 14.1-U8 zur Entscheidung vorgelegt, NICHT mitrepariert; gehoert sachlich zu 14.1-U5.*

**Welle 4** *(blocked on Welle 3)*

- [x] 14.1-04-PLAN.md — BL-03: Historien-Export filtert `status` und `deletedAt`, `totalOvertime` begrenzt

**Welle 5** *(blocked on Welle 4 und 14.1-02 — gleiche Datei, und Weg C ist im Löschpfad erst nach BL-02 erreichbar)*

- [x] 14.1-05-PLAN.md — BL-04: Nachmessung, Entscheidung zu Weg B, Weg A samt beiden Aufrufern entfernen
      *Abgeschlossen 2026-08-25 — 3 Commits, Gates gruen (557 gruen / 3 rot, rote Menge unveraendert). Die von D-04 verlangte Nachmessung an Testdaten wurde VOR dem Entfernen gefuehrt und hat zwei Dinge zutage gefoerdert, die der Befund nicht kannte: Weg A hatte ZWEI Aufrufer (CONTEXT.md nennt nur einen), und der zweite war seit jeher wirkungslos (negatives Argument, Schleife bricht sofort ab) — genau deshalb fehlten nach Ablehnung und Loeschung je 8,00 h. In Zahlen belegt: Sprung zwischen Saldo nach Genehmigung und Saldo nach der naechsten Neuberechnung −8,00 h → 0,00 h; actualHours des fremden, laengst abgeschlossenen Vormonats nach der Genehmigung 244,00 h → 252,00 h; Rueckgabe bei Ablehnung und bei Loeschung je −8,00 h → 0,00 h. Ein Probelauf mit auskommentierten Aufrufern belegte VOR dem Entfernen, dass Weg C beide Rueckgabewege allein traegt. **Entscheidung zu Weg B (Anwender, 25.08.2026): option-a — die compensation-Journalzeile bleibt als Pruefnachweis.** Sie ruht auf zwei Messwerten, nicht auf einer Formulierung: Die Zeile ueberlebt das erzwungene updateMonthlyOvertime (1 Zeile davor, 1 danach) und bewegt keinen Saldo (76,00 h mit wie ohne sie). „Genau eine Spur, nicht drei" ist damit im Sinne von genau einer SALDOWIRKSAMEN Spur erfuellt. Weg C unveraendert, der sick-Zweig aus BL-02 erreichbar geblieben. Gegenversuch protokolliert (ohne den Fix 3 von 4 Tests rot, darunter die Kernzusicherung). Zusammenfassung: `14.1-05-SUMMARY.md`, Nachweis: `14.1-NACHWEIS-BL04.md`. **Neu aufgekommen, NICHT mitrepariert:** Ob die drei Bestandsausgleiche (Antraege 25, 56, 64) heute noch einen Alt-Abzug in `overtime_balance` stehen haben, wurde nicht gemessen — das waere ein Datenzugriff und gehoert nach D-06 in die Datenbereinigung; vermerkt in `deferred-items.md` und als 14.1-U15 zur Entscheidung vorgelegt.*

**Welle 6** *(entsperrt — Welle 5 abgeschlossen; die Bereinigung läuft zuletzt und nach dem BL-01-Fix)*

- [x] 14.1-06-PLAN.md — Datenbereinigung: Sicherung → Trockenlauf → Prüfung → `--apply` → Wiederherstellungsnachweis
      *Abgeschlossen 2026-08-25 — 3 Commits, Gates gruen (557 gruen / 3 rot, rote Menge unveraendert; der Lauf ging gegen die BEREINIGTE Datenbank, kein Test stuetzte sich auf eine Zukunftszeile). **Der einzige Schritt der Phase, der Daten loescht.** Entfernt: **100 Journalzeilen** mit einem Datum nach heute (Nutzer 3 und 17 fuer 2026-09, Nutzer 30 fuer 2026-10) und die **3 zugehoerigen Monatszeilen** in `overtime_balance`; danach liefern beide Pruefabfragen **0**. Der Ablauf aus D-06 lief vollstaendig und in dieser Reihenfolge, **keine Stufe uebersprungen**: (1) Probelauf auf einer Produktionsarbeitskopie — `14-prod-nach-migration.db` nur readonly geoeffnet, Hash vorher = nachher, Saldenvergleich ueber alle Nutzer **0 von 20** mit Differenz ungleich 0,00 h, in zwei Messungen (kanonischer Rechenweg und angezeigter Monatssaldo); (2) Sicherung per `VACUUM INTO` (nicht `cp` — 4,1 MB WAL) nach `server/database/backups/development.PRE-14.1-06_20260825_070544.db`, 1.355.776 Bytes, **gegen die Sicherungsdatei geprueft**: `integrity_check` ok, `foreign_key_check` leer, **20 Kennzahlen mit Differenz 0**; (3) Trockenlauf gegen `development.db` mit **identischem Hash vorher/nachher**; (4) Pruefung der Fundliste vor dem Schreiben — genau Nutzer 3, 17, 30, Testnutzer 15015 in der Ausnahmeliste, **keine book-once-Zeile** in der Fundliste; (5) `--apply` mit beiden Loeschanweisungen in **einer** Transaktion. **Der Wiederherstellungsnachweis ist tatsaechlich gefuehrt, nicht behauptet:** Sicherung readonly geoeffnet, per `VACUUM INTO` in die **neue** Datei `14.1-restore-probe.db` zurueckgespielt, dann **Zeile fuer Zeile UND Feld fuer Feld** verglichen — 100/100 Journalzeilen, 3/3 Monatszeilen, **0 fehlend, 0 ungleich**, Differenzspalte durchgehend 0; dazu die Gegenprobe, dass **keine** dieser 100 ids mehr in `development.db` steht. **Abweichung zur Zahl 59 benannt statt verrechnet:** Der Roadmap-Befund nennt 59 fiktive Journalbuchungen — gemessen sind es **100** Zeilen, davon **50** mit einem Wert ungleich null (130 einschliesslich des ausgenommenen Testnutzers). Die 59 ist mit keiner Abgrenzung deckungsgleich; es wurde **nicht** versucht, ein Praedikat zu konstruieren, das sie trifft. Das Werkzeug `purgeFutureOvertimeRows.ts` druckt die Gegenueberstellung und den Satz „der Trockenlauf ist die massgebliche Zaehlung" bei jedem Lauf selbst. Praedikat festgelegt und begruendet: bewegliches Datum > heute (kein fest verdrahteter Stichtag), elf rebuildbare Typen (der Filter schuetzt book-once-Zeilen, insbesondere `model_change`, die ein Zukunftsdatum tragen DUERFEN — WR-10), Testnutzer 15015 ausgenommen; alle Werte als Prepared-Statement-Parameter. D-08: alle fuenf geschuetzten Tabellen mit Zeilenzahl **und** SHA-256 vorher = nachher. Zusammenfassung: `14.1-06-SUMMARY.md`, Nachweis: `14.1-NACHWEIS-BEREINIGUNG.md`. **Neu aufgekommen, NICHT mitrepariert:** 14.1-U20 (die Roadmap-Zahl 59 ist falsch), 14.1-U21 (Testnutzer 15015 traegt weiterhin 30 Zukunftszeilen), 14.1-U22 (Aufbewahrung von Sicherung und Probekopien), 14.1-U23 (Wiedervorlage von 14.1-U15 — Alt-Abzuege wurden bewusst NICHT mitbereinigt, das waere ein zweiter Befund im selben Vorgang und haette D-07 verletzt), **14.1-U24 (die Produktionsdatenbank ist unbereinigt — sie traegt dieselben 100 + 3 Zeilen; D-13 verbot den Zugriff in dieser Phase)**, 14.1-U25 (Sichtpruefung des Kontoauszugs).*

---

### Phase 14.2: Restbefunde der Abnahme schließen (INSERTED)

**Ziel:** Die Befunde, die die maschinelle Abnahme zutage gefördert hat, sind geschlossen —
soweit sie Fehler sind und nicht Entscheidungen.

**Herkunft:** `14-ABNAHME-AUTO.md`, `14-ABNAHME-SERVER.md` und `14-ABNAHME-SICHT.md`
(124 Prüfzeilen, 104 bestanden). Die 44 ENTSCHEIDUNG-Zeilen der Abnahmeliste gehören
**nicht** hierher — sie sind Ihre Sache, nicht die des Codes. Ebenso wenig die zehn
Warnungen aus `14-WEITERE-BEFUNDE.md`, die in den Folge-Milestone gehen.

**Umfang — funktionale Sackgassen zuerst**

- **F-1 — Ein deaktivierter Nutzer lässt sich nicht reaktivieren.**
  `POST /api/users/:id/reactivate` antwortet 404 „User not found or not deleted".
  Wer jemanden deaktiviert, kommt nicht mehr zurück. (P12-30b, NB-1)

- **F-2 — Der Desktop zeigt Stammdaten, rechnet aber mit der Periode.**
  `WorkScheduleDisplay` zeigt `user.weeklyHours` (40 h/Woche), während die seit dem
  17.08.2026 gültige Periode 30 h trägt und die Sollrechnung der Periode folgt. Das Datum
  kommt aus der Periode, die Zahl aus den Stammdaten. Rest des Desktop-Nachzugs, den
  Phase 11 zurückgestellt und Plan 12-08 unvollständig erledigt hat. (NB-2)

- **F-3 — Das Rollen-Auswahlfeld trägt keinen Namen.**
  `EditUserModal.tsx:862` reicht kein `name` an `<Select label="Rolle">` durch; die
  Laufzeitabfrage liefert `{"name":null,"id":""}`. Ein E2E-Test scheitert daran, und das
  Feld ist für Hilfsmittel nicht adressierbar. (E2E „Change role to admin")

- **F-4 — Deaktivierte Nutzer sind unerreichbar.**
  Vom Standardfilter ausgeblendet und ohne „Bearbeiten"-Schaltfläche. Hängt mit F-1
  zusammen und ist gemeinsam mit ihm zu lösen. (E2E „Deactivate and reactivate")

- **F-5 — Ein Zukunftsmonat zeigt Überstunden.**
  September 2026 weist „Überstunden (Zeitraum) −130:00h" aus, obwohl der Monat noch nicht
  begonnen hat. Die Deckelung aus Plan 14.1-01 greift an dieser Stelle nicht. (14.1-U2b)

- **F-6 — Der DATEV-Fehler erscheint als roher JSON-Text.**
  `desktop/src/api/exports.ts:34-36` nutzt `response.text()`; der 409 landet unverarbeitet
  im Hinweisfenster. Die Meldung erscheint — lesbar ist sie nicht. (11-U2b)

- **F-7 — „Stornieren" sagt „abgelehnt".**
  Der einzige Weg heißt „Stornieren", die Erfolgsmeldung danach lautet
  „Abwesenheitsantrag abgelehnt", die Datenbank speichert `status='rejected'`. Drei
  verschiedene Wörter für einen Vorgang. (14.1-U6b)

- **F-8 — Die Kollisionsmarkierung liegt unter dem Dialog.**
  Sie wird vollständig vom Wechsel-Dialog verdeckt (`elementFromPoint` trifft das
  Vorschaupanel) und beim Schließen gelöscht — sichtbar wird sie nie. (14-U6)

**Umfang — Darstellung, ausdrücklich zugesagt**

- **D-1 — Sechs Kontrastunterschreitungen** über beide Modi (3,18 / 3,30 / 3,60–3,90 /
  3,68 / 3,76). Die schwerste sitzt auf der Saldoänderung im Vorschaupanel — der Zahl, auf
  die es beim Stundenwechsel ankommt. (P12-21, P12-47, 13-U9)

- **D-2 — Trefferflächen 40×28 px und 32×24 px** statt der zugesagten 32×32 px. Ursache:
  `p-2` wird von `px-3 py-1.5` der Button-Grundkomponente überschrieben. (13-U10)

**Umfang — Vertragsklärung, kein Codefix**

- **V-1 —** `13-UI-SPEC.md` fordert weiterhin ein anwendungsgezeichnetes Tooltip, das
  Korrektur M-2 der Phase 13 bewusst durch ein browsergezeichnetes `title` ersetzt hat.
  Einer der beiden Texte ist veraltet. Zu klären, welcher — und den anderen nachziehen.
  (13-U8)

**Nicht im Umfang**

- Der fehlende Trendpfeil auf `model_change`-Zeilen (P12-29b) — er fehlt **bewusst** seit
  Server-CR-01; das ist eine Entscheidung des Anwenders, kein Fehler.

- Die 44 ENTSCHEIDUNG-Zeilen der Abnahmeliste.
- Die zehn Warnungen WR-01 bis WR-10 aus `14-WEITERE-BEFUNDE.md`.
- `work_time_accounts.currentBalance` wird nach einem Stundenwechsel nicht fortgeschrieben
  (B-3 der Serverabnahme) — der Kontoauszug ist nicht betroffen, weil er einen anderen Weg
  liest. Gehört in den Folge-Milestone.

**Erfolgskriterien**

- Ein deaktivierter Nutzer lässt sich in der Oberfläche wiederfinden und reaktivieren
- Der Desktop zeigt für einen Nutzer mit Modellwechsel dieselben Wochenstunden, mit denen
  er rechnet — vor und nach dem Stichtag geprüft

- Die drei E2E-Dateien laufen ohne roten Fall
- Kein Zeitraum in der Zukunft weist Überstunden aus
- Der DATEV-Fehler erscheint als lesbarer Satz, nicht als JSON
- Ein Vorgang trägt in Schaltfläche, Meldung und Datenbank denselben Namen
- Alle geprüften Kontraste erreichen mindestens 4,5:1 für Fließtext bzw. 3:1 für Großtext,
  in hell **und** dunkel

- Alle Trefferflächen messen mindestens 32×32 px
- Jeder Fix hat einen eigenen Commit und ist einzeln rückgängig machbar
- Keine Zeile in `time_entries`, `absence_requests`, `overtime_corrections`,
  `vacation_balance` und `vacation_transactions` wird angefasst

**Abhängigkeit:** Phase 14.1 (die Abnahme, aus der die Befunde stammen)

**Risiko:** Gering. Keiner der Befunde berührt das Rechenwerk; F-5 berührt die Deckelung aus
14.1-01 und ist deshalb mit demselben Nachweis abzusichern.

**Plans:** 13 Pläne in 13 Wellen — **durchgehend seriell**, ein Plan je Welle. Grund:
`server/vitest.config.ts` setzt `fileParallelism: false`, weil alle Testdateien auf derselben
`database/development.db` arbeiten; jeder Plan fährt `npx vitest run` als Gate, und die messenden
Pläne brauchen zusätzlich **einen** Server auf 3100 und **eine** Vite-Instanz auf 1420 gegen
dieselbe Datenbank. Damit ist die Auflage „keine zwei Pläne derselben Welle fassen dieselbe Datei
an" konstruktiv erfüllt. Alle Pläne tragen `autonomous: true` (D-15) — es gibt keine Checkpoints;
was ein Mensch entscheiden muss, wird gesammelt und in Plan 13 an `14-UAT-SAMMLUNG.md` angefügt.

Plans:

- [x] 14.2-01-PLAN.md — Prüfsummen-Werkzeug (D-01), Prüfumgebung, B-1-Produktspur auf 127.0.0.1
- [x] 14.2-02-PLAN.md — **F-1**: Reaktivierung deckt deaktivierte *und* soft-gelöschte Nutzer ab, deutsche Meldung
- [x] 14.2-03-PLAN.md — **F-4**: deaktivierte Nutzer auffindbar und bearbeitbar (schließt E2E `user-edit.spec.ts:221`)
- [x] 14.2-04-PLAN.md — **F-3**: `Select` trägt `name`/`id` und `htmlFor` (schließt E2E `user-edit.spec.ts:308`)
- [x] 14.2-05-PLAN.md — **F-5**: unbedingte Deckelung in `overtimeTransactionRebuildService` + Nachweis über alle aktiven Nutzer (schließt B-4)
- [x] 14.2-06-PLAN.md — **F-6**: Exportfehler als deutscher Satz statt JSON, beide Exportwege
- [x] 14.2-07-PLAN.md — **F-7**: „Stornieren" meldet „storniert" (Weg A, D-09)
- [x] 14.2-08-PLAN.md — **F-2**: Desktop zeigt die Wochenstunden der gültigen Periode, vor *und* nach dem Stichtag gemessen
- [x] 14.2-09-PLAN.md — **F-8**: Kollisionsmarkierung erreicht den Anwender (`elementFromPoint`)
- [x] 14.2-10-PLAN.md — **D-1**: sechs Kontrastunterschreitungen, hell und dunkel, mit Gegenmessung
- [x] 14.2-11-PLAN.md — **D-2**: Trefferflächen ab 32 × 32 px, Spezifitätskollision aufgelöst
- [x] 14.2-12-PLAN.md — **V-1**: `13-UI-SPEC.md` auf den `title`-Weg nachziehen (kein Produktionscode)
- [x] 14.2-13-PLAN.md — E2E-Gesamtlauf, UAT-Sammlung „Phase 14.2" (ab 14.2-U1), Umgebung abräumen, D-01-Endnachweis
      *Abgeschlossen 2026-08-26 — 3 Commits (`92cd303`, `73593ab`, `6ecff5a`), alle vier Gates grün (`tsc` beidseitig Exit 0, `check:rules` Exit 0 mit fünf Gruppen und 69 Tests, `vitest run` **578 grün / 3 rot** — zeichengleich die drei vorbestehenden; Zuwachs 562 → 578 = **+16**, zugeordnet auf Plan 02 (5), Plan 05 (5), Plan 08 (6)). **E2E-Gate: 21 grün / 0 rot / 2 übersprungen, Exitcode 0** — und der Vorher-Lauf **12 / 9 / 2** steht als Beleg daneben. Die Ursache der neun roten Fälle ist gemessen: alle 19 fest verdrahteten Spec-Benutzernamen standen bereits in `development.db`; **keiner der neun ist einer der elf Befunde**. Der vorgeschriebene Produktweg zum Entfernen kann das nicht lösen — `DELETE /api/users/:id` ist ein Soft Delete und `usernameExists()` prüft einschließlich gelöschter Nutzer; ein physisches Löschen hätte über `ON DELETE CASCADE` **34 von 105** `vacation_balance`- und **32 von 120** `vacation_transactions`-Zeilen mitgenommen und D-01 zerstört. Deshalb über `PUT /api/users/:id` **umbenannt statt gelöscht** (19 × HTTP 200) und nach dem Lauf **zurückbenannt** (19 × HTTP 200). Der Lauf selbst legte 19 Nutzer an (57348–57366) und schrieb 38 + 36 Kaskadenzeilen (105→143, 120→156) — **exakt zurückgenommen**, `foreign_key_check` leer. Sicherung: `development.PRE-14.2-13-E2E.db`, 1.626.112 Bytes, sha256 `6712c70a…`. **D-01 über die GANZE Phase: fünf von fünf Tabellen mit identischer Zeilenzahl und SHA-256** (895 / 62 / 5 / 105 / 120); die drei Zwischenzustände (14.2-07, 14.2-08, 14.2-13) sind einzeln mit ihrer Rücknahme belegt. **`14-UAT-SAMMLUNG.md` nur ANGEFÜGT:** 89 Einfügungen, **0 gelöschte Zeilen**, Abschnitte der Phasen 11 bis 14.1 zeichengleich; **45 Punkte 14.2-U1 bis 14.2-U45**, lückenlos und dublettenfrei. `14.2-ABSCHLUSS.md` trägt die Bewertung der zehn Erfolgskriterien: **acht erfüllt, zwei eingeschränkt erfüllt** — das E2E-Kriterium (die Zahl stimmt, die Reproduzierbarkeit nicht; zwei Fälle tragen weiterhin `test.skip`) und „ein Vorgang, ein Name" (Schaltfläche und Meldung sagen „storniert", die Datenbank speichert weiterhin `rejected`, Weg A nach D-09). Abgeräumt und belegt: `.env.development.local` entfernt, Port 3100 und 1420 frei (`curl` je Exit 7), **Port 3000 (fremdes Next.js, PID 39860) nicht angefasst**, `git status --porcelain` leer. Zusammenfassung: `14.2-13-SUMMARY.md`, Endnachweis: `14.2-ABSCHLUSS.md`. Kein Push.*

**Cross-cutting constraints:**

- D-01: Keine Zeile in den fuenf geschuetzten Tabellen wurde angefasst (Zeilenzahl und SHA-256 vorher = nachher)

---

## Phasen (abgeschlossen)

<details>
<summary>✅ v1.0 — 2-Tier DB Architecture (Phasen 1–4) — abgeschlossen 2026-04-02</summary>

- [x] Phase 1: Server DB Consolidation (5/5 Pläne)
- [x] Phase 2: Symlink + PM2 Ecosystem (2/2 Pläne)
- [x] Phase 3: Local Dev Sync Script (2/2 Pläne)
- [x] Phase 4: Deploy Workflow + Documentation (3/3 Pläne)

Archiv: `.planning/milestones/v1.0-phases/`

</details>

<details>
<summary>✅ v2.0 — Urlaubskonto: Korrektheit & Nachvollziehbarkeit (Phasen 5–8) — abgeschlossen 2026-08-21</summary>

- [x] Phase 5: Journal-Fundament (2/2 Pläne) — 2026-08-19
- [x] Phase 6: Buchungen bei jedem Vorgang (7/7 Pläne) — 2026-08-21, Verifikation 14/14
- [x] Phase 7: Saldo aus Buchungen + Backfill (3/3 Pläne) — 2026-08-19
- [x] Phase 8: Kontoauszug für Mitarbeiter und Admin (5/5 Pläne) — 2026-08-20, Release v1.8.0

Archiv: `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-phases/`

</details>

---

## Fortschritt

| Phase | Milestone | Pläne | Status | Abgeschlossen |
|-------|-----------|-------|--------|---------------|
| 1.–4. (2-Tier DB) | v1.0 | 12/12 | Complete | 2026-04-02 |
| 5. Journal-Fundament | v2.0 | 2/2 | Complete | 2026-08-19 |
| 6. Buchungen bei jedem Vorgang | v2.0 | 7/7 | Complete | 2026-08-21 |
| 7. Saldo aus Buchungen + Backfill | v2.0 | 3/3 | Complete | 2026-08-19 |
| 8. Kontoauszug | v2.0 | 5/5 | Complete | 2026-08-20 |
| 9. Ein Maßstab, ein Weg | v3.0 | 5/5 | Complete | 2026-08-22 |
| 9.1 Journal-Backfill und Betriebs-Härtung | v3.0 | 0/8 | **Aufgeteilt (Plan 14-07): Backfill in Plan 14-10 erledigt (26.08.2026), WR-07 durch Plan 14-02 geschlossen. Code-Härtung WR-02–WR-05 geplant am 29.08.2026 — 8 Pläne in 6 Wellen, noch nicht ausgeführt** | — |
| 10. Perioden-Fundament | v3.0 | 6/6 | Complete — verifiziert 4/4, REQ-20 bis REQ-22 | 2026-08-22 |
| 11. Datumsabhängige Berechnung | v3.0 | 11/11 | Complete — Review 2 Iterationen / 33 Fixes, verifiziert 10/10, REQ-23 bis REQ-25 | 2026-08-22 |
| 12. Stundenwechsel bedienen | v3.0 | 9/9 | Complete — verifiziert 20/20, menschliche Abnahme gebündelt in Phase 14 | 2026-08-22 |
| 13. Korrigieren und rückgängig machen | v3.0 | 11/11 | Complete — verifiziert 4/4, Code-Review 2 kritisch + 13 Warnungen behoben, menschliche Abnahme gebündelt in Phase 14 | 2026-08-22 |
| 14. Absicherung und Auslieferung | v3.0 | 9/11 | **Ausgeliefert — ein Plan offen.** 14-01 bis 14-08 und 14-11 (Release v1.9.0) abgeschlossen. 14-10 (Journal-Backfill) ist **sachlich** erledigt, aber nicht als Plan gefahren: der Vollaufbau `--all-months` lief am 26.08. im Rahmen der Auslieferung gegen die Produktion (+991 Journalzeilen, 0 Bewegung im angezeigten Saldo, danach 15 von 15 Nutzern deckungsgleich mit dem kanonischen Rechenweg — `14-AUSLIEFERUNG.md`, Abschnitt 5). **Offen: 14-09** — der reale Umstellungsfall ist auf der Produktion noch nicht eingetragen, `14-UMSTELLUNGSFALL.md` existiert nicht | 2026-08-26 |
| 14.1 Rechenwerk-Blocker aus dem Produktionslauf schließen | v3.0 | 6/6 | **Umsetzung fertig — Abnahme offen** — BL-01 bis BL-05 geschlossen, Datenbereinigung gefahren (100 + 3 Zukunftszeilen entfernt, Wiederherstellungsnachweis Zeile für Zeile geführt); Gates 557 grün / 3 rot, kein Push (D-13). Verifikation `human_needed`: 21/22 Muss-Aussagen belegt, keine Lücke. Offen: 30 Abnahmepunkte (14.1-U1 bis U30) und 6 Code-Review-Blocker, die nach D-09 bewusst nicht behoben wurden — dringendster Punkt 14.1-U26 | 2026-08-25 |
| 14.2 Restbefunde der Abnahme schließen | v3.0 | 13/13 | **Umsetzung fertig — Abnahme offen** — alle elf Befunde geschlossen (F-7 eingeschränkt: Schaltfläche und Meldung stimmen, die Datenbank speichert weiterhin `rejected`). Verifikation `human_needed`: 8/10 Erfolgskriterien voll erfüllt, 2/10 nachweislich eingeschränkt. Offen: 45 Abnahmepunkte (14.2-U1 bis U45) | 2026-08-26 |

---

## Abdeckung Milestone v3.0

| Requirement | Phase |
|-------------|-------|
| REQ-17 Genau ein Weg zur Sollstundenermittlung | 9 |
| REQ-18 Legacy-Pfad angeglichen oder stillgelegt | 9 |
| REQ-19 `overtime_comp`-Defekt geklärt | 9 |
| REQ-20 Tabelle `user_work_periods` | 10 |
| REQ-21 Migration ohne Verhaltensänderung | 10 |
| REQ-22 Keine Überlappung, keine Lücke | 10 |
| REQ-23 Auflösung über die gültige Periode | 11 |
| REQ-24 Rebuild periodengetreu und wiederholbar | 11 |
| REQ-25 Validierungswerkzeug periodenbewusst | 11 |
| REQ-26 Stichtag auch rückwirkend | 12 |
| REQ-27 Vorschau vor dem Speichern | 12 |
| REQ-28 Saldo wird nicht umgerechnet | 12 |
| REQ-29 Differenz als sichtbare Buchung | 12 |
| REQ-30 Getrennte Korrektur-Aktion | 13 |
| REQ-31 Periode bearbeitbar, Storno statt Löschung | 13 |
| REQ-32 Testabdeckung der Wechselfälle | 14 |
| REQ-33 Generalprobe auf Produktionskopie | 14 |

**Abdeckung:** 17/17 Requirements zugeordnet (100 %)

---

## Nicht-verhandelbare Randbedingungen

- **Produktionsdatenbank ist live** — Backup vor Migration, Rückweg erprobt, `DATABASE_PATH`
  bei jedem Skript explizit setzen (kein Symlink mehr auf dem Server)

- **Salden dürfen sich durch die Umstellung allein nicht ändern** — nur ein tatsächlich
  eingetragener Modellwechsel darf Zahlen bewegen

- **Kein Deployment ohne grünen `tsc --noEmit`** für Server und Desktop
- **Desktop-Änderungen brauchen ein Release** — `deploy-server.yml` deployt nur `server/**`
- Bestehende Muster nutzen statt neue erfinden: `migrationRunner`, `overtime_transactions`,
  Storno-Prinzip und Kontoauszug aus Milestone v2.0

---

## Offene Nebenpunkte

Nicht einem Milestone zugeordnet, siehe STATE.md „Zurückgestellte Punkte":

- Symlink-Restpunkt aus der DB-Stabilisierung: Cron mit `DATABASE_PATH` reaktivieren
- `position`-Spalte fehlt in der lokalen Entwicklungsdatenbank
- Logik für unbezahlten Urlaub — offene Analyse
- Urlaubsanspruch bei Teilzeitwechsel — Seed, siehe
  `.planning/seeds/urlaubsanspruch-teilzeitwechsel.md`
