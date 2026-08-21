# Requirements (ENTWURF) — Milestone 3: Historisierte Arbeitszeitmodelle

**Status:** ENTWURF — noch nicht aktiviert. Milestone 2 läuft noch (Phase 6 Lückenschluss).
**Erstellt:** 2026-08-21
**Grundlage:** `.planning/notes/arbeitszeitmodelle-historisierung.md` (explore-Session)
**Vorheriger Milestone:** 2 — Urlaubskonto: Korrektheit & Nachvollziehbarkeit

> **Aktivierung:** Sobald Phase 6 abgeschlossen ist, wird diese Datei zu `REQUIREMENTS.md`
> und der Roadmapper erzeugt die Phasen ab **Phase 9**. Bis dahin nichts an STATE.md,
> ROADMAP.md oder `.planning/phases/` anfassen — dort arbeitet eine parallele Session.

---

## Warum dieser Milestone

`users.weeklyHours` (`server/src/database/schema.ts:43`) und `users.workSchedule`
(`schema.ts:79`) sind flache Felder ohne Historie. `getDailyTargetHours(user, datum)`
bekommt das Datum übergeben, löst die Sollstunden aber aus dem *heutigen* User-Objekt auf.

Sobald jemand von 40 auf 20 Wochenstunden gestellt wird und ein Rebuild läuft
(`overtimeTransactionRebuildService`, `refreshOvertimeBalances`,
`recalculateOvertimeBalances`), wird die komplette Vergangenheit mit den neuen Stunden
nachgerechnet — die Überstunden verschieben sich rückwirkend. Das passiert still, ohne
dass jemand es auslöst.

Ein konkreter Fall steht an (Stand 21.08.2026).

Milestone 2 hat für den Urlaub bewiesen, dass ein handgepflegter Wert ohne Historie
zwangsläufig auseinanderläuft. Beim Überstundenkonto ist die Historie zwar vorhanden
(`overtime_transactions`), aber der **Maßstab**, gegen den gerechnet wird, ist es nicht.

Milestone 2 hat zwei Punkte ausdrücklich vertagt, die hier fällig werden:
"Überstunden-Ausgleich erreicht den Saldo nicht — separater Defekt des Dual Calculation
Systems, eigener Milestone" und "Umstellung des Überstundensystems".

## Core Value

**Eine Stundenumstellung verschiebt keine Vergangenheit.** Was bis zum Stichtag gerechnet
wurde, bleibt stehen; ab dem Stichtag gilt das neue Modell. Wer wissen will, warum sich ein
Saldo geändert hat, sieht es im Kontoauszug statt es zu erraten.

---

## Requirements

### Fundament: ein Maßstab, ein Weg

- **REQ-17** — Die Sollstunden für einen Tag werden systemweit über **genau einen** Weg
  ermittelt. Kein Aufrufer berechnet Soll-Arbeitszeit an `getDailyTargetHours()` vorbei.

- **REQ-18** — Der Legacy-Pfad (`overtimeService.ts`, monatliche Aggregation über
  `overtime_balance`) ist entweder stillgelegt oder nutzt nachweislich dieselbe
  Sollstunden-Auflösung wie `unifiedOvertimeService.ts`. Dashboard und Berichte zeigen für
  denselben Nutzer denselben Wert.

- **REQ-19** — Der bekannte Defekt "Überstundenausgleich (`overtime_comp`) erreicht den
  Saldo nicht" ist behoben oder als bewusst offen dokumentiert, bevor die Historisierung
  darauf aufsetzt. *(Belege: `.planning/debug/urlaubstage-bei-ablehnung-verloren.md`
  Zeile 92, `.planning/debug/overtime-validation-backend-mismatch.md`)*

### Arbeitszeit-Perioden

- **REQ-20** — Tabelle `user_work_periods` hält je Nutzer Zeiträume mit `validFrom`,
  `validTo`, `weeklyHours` und `workSchedule`. Die beiden Stundenangaben werden immer
  gemeinsam versioniert — eine Kombination aus alter Wochenstundenzahl und neuem Tagesplan
  darf nicht entstehen.

- **REQ-21** — Die Migration überführt den heutigen Stand jedes Nutzers in eine Periode ab
  `hireDate`. Unmittelbar nach der Migration liefert jede Berechnung exakt dieselben Werte
  wie vorher — die Umstellung ist an den Zahlen nicht ablesbar.

- **REQ-22** — Perioden eines Nutzers überlappen sich nicht und lassen keine Lücke; die
  Datenbank verhindert das, nicht nur die Oberfläche.

### Datumsabhängige Berechnung

- **REQ-23** — `getDailyTargetHours(user, datum)` löst die Sollstunden über die zum Datum
  gültige Periode auf statt über den aktuellen Stammdatensatz.

- **REQ-24** — Ein Rebuild der Überstundenhistorie über einen Zeitraum mit Modellwechsel
  liefert für jeden Tag die Sollstunden, die an *diesem Tag* galten. Ein wiederholter
  Rebuild ändert das Ergebnis nicht.

- **REQ-25** — Das Validierungswerkzeug (`npm run validate:overtime:detailed`,
  `scripts/validateOvertimeDetailed.ts`) prüft gegen den periodengültigen Maßstab und
  meldet für Nutzer mit Modellwechsel keine Abweichung, wo keine ist.

### Stundenwechsel bedienen

- **REQ-26** — Ein Admin trägt einen Stundenwechsel mit Stichtag ein. Der Stichtag darf in
  der Zukunft **oder in der Vergangenheit** liegen (rückwirkend geltender Vertrag).

- **REQ-27** — Vor dem Speichern zeigt das System, was die Umstellung bewirkt: Sollstunden
  vorher/nachher und die resultierende Änderung des Überstundensaldos.

- **REQ-28** — Der bereits angesparte Überstundensaldo wird durch einen Stundenwechsel
  **nicht umgerechnet**. Stunden bleiben Stunden.

- **REQ-29** — Eine durch den Wechsel entstehende Saldodifferenz wird als eigene Buchung im
  Überstunden-Journal sichtbar, mit Bezug auf die auslösende Periode — nicht als stille
  Neuberechnung.

### Korrigieren und rückgängig machen

- **REQ-30** — "Stammdaten korrigieren" ist eine von "Stundenwechsel ab Datum" getrennte
  Aktion mit eigener Warnung und Pflichtbegründung. Sie ist für den Fall gedacht, dass die
  hinterlegten Stunden von jeher falsch waren, und darf die Historie ändern.

- **REQ-31** — Eine Periode kann bearbeitet und gelöscht werden; danach wird ab ihrem
  Beginn neu gerechnet. Die zugehörigen Korrekturbuchungen werden **storniert, nicht
  gelöscht** — die Storno-Geschichte bleibt im Auszug sichtbar.

### Absicherung

- **REQ-32** — Tests decken ab: Reduzierung (40→20) mit Stichtag in der Zukunft, Erhöhung
  mit rückwirkendem Stichtag, Stichtag mitten im Monat, Wechsel über einen Jahreswechsel
  hinweg, Periode löschen und danach neu rechnen.

- **REQ-33** — Der Umbau ist auf einer Kopie der Produktionsdatenbank vollständig
  durchgespielt, bevor er die Produktion erreicht. Die Salden aller Nutzer ohne
  Modellwechsel sind vorher und nachher identisch.

---

## Out of Scope

- **Urlaubstage (`vacationDaysPerYear`) historisieren** — bewusst ausgeklammert; der
  anstehende Fall ändert nur die Stunden, nicht die Wochentage. Rechtlicher Fallstrick und
  Auslösebedingungen: `.planning/seeds/urlaubsanspruch-teilzeitwechsel.md`

- **Umrechnung des Überstundensaldos in Tage** — verworfen, siehe REQ-28

- **Vollständiger Rückbau des Legacy-Überstundensystems** — REQ-17/18 verlangen einen
  gemeinsamen Maßstab und übereinstimmende Zahlen, nicht das Entfernen aller Altstrukturen.
  Ein vollständiger Rückbau ist ein eigener Milestone.

- **Rückwirkende Änderung bereits abgerechneter Lohnperioden** — das System bildet ab, es
  rechnet nicht ab. Eine Freigabe-/Sperrlogik für abgeschlossene Monate ist nicht Teil
  dieses Milestones.

- **Restpunkte aus der DB-Stabilisierung** (Staging-Sync, Cron, Symlink) — siehe
  `.planning/debug/db-stabilisierung-20260818.md`

---

## Constraints

- **Produktionsdatenbank ist live** — Backup vor Migration Pflicht, Rückweg erprobt
  (`DATABASE_PATH` bei jedem Skript explizit setzen, kein Symlink mehr auf dem Server)

- **Salden dürfen sich durch die Umstellung allein nicht ändern** — nur ein tatsächlich
  eingetragener Modellwechsel darf Zahlen bewegen

- **Kein Deployment ohne grünen `tsc --noEmit`** für Server und Desktop

- **Desktop-Änderungen erreichen Anwender nur über ein Release** — `deploy-server.yml`
  deployt ausschließlich `server/**`

- Bestehende Muster nutzen statt neue erfinden: `migrationRunner`, `overtime_transactions`,
  das Storno-Prinzip und den Kontoauszug aus Milestone 2

---

## Vor der Aktivierung zu klären

1. **Phase 6 abgeschlossen?** Erst danach STATE.md, ROADMAP.md und `.planning/phases/`
   anfassen — dort arbeitet parallel eine andere Session.

2. **Perioden vorladen oder nachschlagen?** `getDailyTargetHours()` macht bereits einen
   DB-Zugriff (`holidays`, `workingDays.ts:67`) — ein zweiter Lookup wäre architektonisch
   konsistent, in Tagesschleifen über ein ganzes Jahr aber teuer. Entscheidung gehört in
   `/gsd:discuss-phase`.

3. **Umfang von REQ-19** — ist der `overtime_comp`-Defekt ein Einzeiler oder eine eigene
   Phase? Vor dem Zuschnitt kurz verifizieren, sonst kippt die Phasenaufteilung.
