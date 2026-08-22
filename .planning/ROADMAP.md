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

**Warum als eigene Phase statt in Phase 9:** D2 (`09-CONTEXT.md`) weist einen Backfill über
Bestandsdaten ausdrücklich einer eigenen Phase zu, sobald er über eine reine Codeänderung
hinausgeht — genau der hier vorliegende Fall. D5 verbietet den nötigen
Produktionsschreibzugriff in Phase 9.

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

**Plans:** 11 Pläne in 8 Wellen (Welle 1: 13-01 · Welle 2: 13-02, 13-06 · Welle 3: 13-03, 13-04 · Welle 4: 13-05 · Welle 5: 13-07 · Welle 6: 13-08, 13-10 · Welle 7: 13-09 · Welle 8: 13-11)

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
- [ ] 13-10-PLAN.md — Storno-Paar im Kontoauszug: Zustands-Badges, Beleg-Chip, Sprungmarke; Debugausgaben aus `api/client.ts` entfernt (D2)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 13-09-PLAN.md — `EditUserModal`: Korrekturblock, Zeilenaktionen, Löschbestätigung mit Server-Vorschau, Erfolgsbanner (D1, D2, D3)

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 13-11-PLAN.md — Pflicht-Gates, Entscheidungsabgleich D1 bis D7, gebündelte UAT-Liste für Phase 14

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
| 9.1 Journal-Backfill und Betriebs-Härtung | v3.0 | 0/? | **Nicht begonnen — Ausführung im Produktionsfenster der Phase 14** | — |
| 10. Perioden-Fundament | v3.0 | 0/? | Nicht begonnen | — |
| 11. Datumsabhängige Berechnung | v3.0 | 0/? | Nicht begonnen | — |
| 12. Stundenwechsel bedienen | v3.0 | 9/9 | Complete — verifiziert 20/20, menschliche Abnahme gebündelt in Phase 14 | 2026-08-22 |
| 13. Korrigieren und rückgängig machen | v3.0 | 0/11 | Geplant — 11 Pläne in 8 Wellen | — |
| 14. Absicherung und Auslieferung | v3.0 | 0/? | Nicht begonnen | — |

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
