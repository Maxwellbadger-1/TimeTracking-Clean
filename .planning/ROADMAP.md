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

**Warum zuerst:** Wird die Historisierung auf zwei driftende Berechnungswege gesetzt,
verdoppelt sie den Fehler und macht ihn schwerer auffindbar.

**Risiko:** Der Umfang ist vor der Sichtung unklar — `OVERTIME_ARCHITECTURE.md` steht auf 🔴.
Sollte sich der Legacy-Rückbau als eigenes Vorhaben erweisen, wird hier neu zugeschnitten.

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

---

### Phase 12: Stundenwechsel bedienen

**Ziel:** Ein Admin kann eine Stundenumstellung eintragen und vorher sehen, was sie bewirkt.

**Umfang**

- API und Oberfläche für „Stundenwechsel ab Datum"; Stichtag in Zukunft oder Vergangenheit
- Vorschau vor dem Speichern: Sollstunden vorher/nachher, resultierende Saldoänderung
- Der bestehende Überstundensaldo wird nicht umgerechnet — Stunden bleiben Stunden
- Entstehende Differenz als eigene Buchung im Überstunden-Journal, mit Bezug auf die Periode
- Einbindung in die Stammdaten-Oberfläche (`EditUserModal.tsx`, `WorkScheduleEditor.tsx`)

**Erfolgskriterien**

- Eine Umstellung 40→20 zum 01.10. verändert die Überstunden vor dem 01.10. um keine Minute
- Ein rückwirkender Stichtag (Vertrag gilt seit 01.07., eingetragen im September) rechnet ab
  dem 01.07. neu und lässt davor alles stehen
- Die Vorschau zeigt vor dem Speichern denselben Wert, der danach tatsächlich im Konto steht
- Die Saldodifferenz ist im Kontoauszug als eigene Zeile mit Begründung sichtbar

**Abhängigkeit:** Phase 11

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
| 9. Ein Maßstab, ein Weg | v3.0 | 0/? | Nicht begonnen | — |
| 10. Perioden-Fundament | v3.0 | 0/? | Nicht begonnen | — |
| 11. Datumsabhängige Berechnung | v3.0 | 0/? | Nicht begonnen | — |
| 12. Stundenwechsel bedienen | v3.0 | 0/? | Nicht begonnen | — |
| 13. Korrigieren und rückgängig machen | v3.0 | 0/? | Nicht begonnen | — |
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
