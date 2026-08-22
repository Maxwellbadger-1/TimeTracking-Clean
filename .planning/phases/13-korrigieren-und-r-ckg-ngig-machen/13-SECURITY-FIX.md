---
phase: 13-korrigieren-und-r-ckg-ngig-machen
source_audit: 13-SECURITY.md
finding: B-2
finding_severity: mittel
threat: T-13-02
fixed: 2026-08-23
status: fixed
files_modified:
  - server/src/services/workPeriodService.ts
  - server/src/server.ts
  - server/src/services/workPeriodService.test.ts
  - server/src/services/workPeriodCorrectionService.test.ts
tests_added: 5
gates:
  server_tsc: "Exit 0"
  desktop_tsc: "Exit 0"
  server_vitest: "491 grün / 3 rot (Ausgangszustand 486/3, +5 neue Tests; die 3 roten sind vorbestehend)"
---

# B-2 — Die Aussetzung des Kettenriegels erzwingt jetzt die Transaktionsklammer

**Befund:** `13-SECURITY.md`, B-2 (mittel), T-13-02 teilweise offen
**Behoben:** 2026-08-23
**Status:** geschlossen

---

## Worum es ging

T-13-02 sagt zu: die Aussetzung des Kettenriegels ist „**ausschließlich** innerhalb einer
`db.transaction()`-Klammer" erlaubt. Drei der vier Bausteine standen — `finally`-Rücksetzung,
Rollback-Wirkung, Test. Das „ausschließlich" war eine Konvention im Kopfkommentar von
`withSuspendedChainGuard()`, sonst nichts: `grep -rn "inTransaction" server/src` lieferte null
Treffer, und die eigene Testdatei rief die Funktion außerhalb jeder Transaktion auf, wo sie
klaglos arbeitete.

Der Schaden wäre still. Innerhalb der Klammer ist ein Absturz zwischen Aussetzung und `finally`
folgenlos — SQLite rollt beim nächsten Öffnen zurück, die Aussetzung eingeschlossen. Außerhalb
läuft das `UPDATE … suspended = 1` im Autocommit; ein Absturz danach ließe den Riegel für diese
Datenbankdatei dauerhaft ausgesetzt. Die vier aussetzbaren Trigger-Klauseln aus Migration 013
prüften dann schlicht nichts mehr, ohne Fehlermeldung, ohne Testausschlag — der Riegel wäre genau
dann offen, wenn man ihn braucht.

---

## Was geprüft wurde, bevor etwas geändert wurde

**Geschieht die Aussetzung tatsächlich nur an einer Stelle?** Ja.
`grep -rn "work_period_chain_guard" server/src` außerhalb von Migration und `schema.ts` liefert
genau zwei schreibende Zugriffe im Produktivcode, beide in `withSuspendedChainGuard()`
(`workPeriodService.ts`). Es gibt keinen zweiten Weg, den Riegel auszusetzen.

**Wie viele Aufrufer hat die Funktion?** Vier — einer produktiv, drei in Tests:

| Aufrufer | Datei:Zeile (Stand vor dem Fix) | Innerhalb einer Transaktion? |
|----------|--------------------------------|------------------------------|
| Korrekturdienst (produktiv) | `workPeriodCorrectionService.ts:380` | **Ja** — `db.transaction()` beginnt bei `:253` |
| Testfall Rücksetzung, Normalfall | `workPeriodService.test.ts:641` | **Nein** |
| Testfall Rücksetzung, Wurffall | `workPeriodService.test.ts:654` | **Nein** |
| Fixture „bestehender Kettenschaden" | `workPeriodCorrectionService.test.ts:495` | **Nein** |

Der Prüfauftrag nannte nur `workPeriodService.test.ts:637`. Die dritte Fundstelle in
`workPeriodCorrectionService.test.ts` wäre an der neuen Regel ebenso gescheitert und ist deshalb
mitgezogen worden — sonst hätte der Fix einen bestehenden grünen Test rot gemacht.

**Ist `db.inTransaction` überhaupt verfügbar?** Ja, `@types/better-sqlite3/index.d.ts:57` führt
`inTransaction: boolean` auf `Database`. Kein Cast nötig.

**Welchen Schlüssel serialisiert pino?** `server/src/utils/logger.ts` registriert
`serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err }`. `err` ist der
kanonische Schlüssel (die `error`-Zeile ist das Auffangnetz aus WR-06, Phase 11) — die neue
Logzeile schreibt `{ err }`.

---

## Die Änderung

### 1. Nutzungsbedingung wird erzwungen

`server/src/services/workPeriodService.ts:794` — erste Anweisung in `withSuspendedChainGuard()`:

```ts
if (!db.inTransaction) {
  throw new ChainGuardOutsideTransactionError(
    'withSuspendedChainGuard() wurde außerhalb einer aktiven Transaktion aufgerufen. …'
  );
}
```

Die Prüfung steht **vor** dem `UPDATE … suspended = 1`. Die Ablehnung ist damit vollständig: weder
läuft die übergebene Funktion, noch wird der Riegel angefasst. Ein Fehler nach der Aussetzung wäre
der schlechtere Fall gewesen.

Geworfen wird eine benannte Klasse, `ChainGuardOutsideTransactionError`
(`workPeriodService.ts:115`), kein nacktes `Error`. Sie geht ausdrücklich **nicht** durch
`translateWorkPeriodError()` und wird nicht in eine freundliche 409-Meldung übersetzt: das hier ist
kein Eingabefehler eines Nutzers, sondern ein Programmierfehler im Aufrufpfad, und er soll laut
sein.

### 2. Rücksetzung beim Serverstart

`resetStaleChainGuardSuspension()` (`workPeriodService.ts:833`) zieht den Wert bedingungslos auf 0
und meldet, wenn dabei tatsächlich etwas zu tun war:

```sql
UPDATE work_period_chain_guard SET suspended = 0 WHERE id = 1 AND suspended <> 0
```

Das `AND suspended <> 0` ist kein Zierrat: dadurch ist `result.changes` genau dann 1, wenn ein
hängengebliebener Riegel gefunden wurde. Im Normalfall wird keine Zeile angefasst und es entsteht
keine Logzeile — eine Warnung, die bei jedem Start erscheint, liest nach einer Woche niemand mehr.

Gemeldet wird über `logger.warn({ err: new StaleChainGuardSuspensionError() }, …)`. Der
`StaleChainGuardSuspensionError` (`workPeriodService.ts:131`) wird nie geworfen; er ist Trägerobjekt
für Meldung und Stacktrace, damit im Log steht, **wo** der Vorfall bemerkt wurde und nicht nur,
dass er war. Der Server startet nach der Rücksetzung normal weiter — ein Abbruch würde nur den
bereits behobenen Zustand zementieren.

**Warum die Rücksetzung trotz Punkt 1 nötig bleibt:** Die Erzwingung wirkt nur nach vorn. Sie räumt
keine Datenbankdatei auf, die ein früherer Lauf — oder ein Wartungsskript, das
`work_period_chain_guard` von Hand anfasst — bereits mit `suspended = 1` hinterlassen hat. Genau
dieser Zustand ist der gefährliche.

### 3. Einhängepunkt in der Startsequenz

`server/src/server.ts:229`, unmittelbar nach `await runMigrations(db)` in `startServer()`.

Die Stelle ist nicht beliebig. **Nach** `runMigrations()`, weil die Steuertabelle
`work_period_chain_guard` erst in Migration 013 entsteht — auf einer Bestandsdatenbank, die noch
nicht dort ist, gäbe ein Zugriff davor einen `no such table`-Fehler und der Server startete gar
nicht mehr. **Vor** `app.listen()`, weil kein einziger HTTP-Request in ein Fenster fallen darf, in
dem die Trigger nichts prüfen.

### 4. Die Testaufrufe ohne Transaktion

- `workPeriodService.test.ts:661` — der bestehende Rücksetzungstest läuft jetzt in einer
  `db.transaction()`. Beide Messwerte werden **noch innerhalb** der Klammer gelesen, und der Wurf
  wird innerhalb gefangen, damit die Transaktion committet: läse man danach, bewiese eine 0 nur den
  Rollback bzw. den Commit — nicht das `finally`, um das es in diesem Test geht.
- `workPeriodCorrectionService.test.ts:501` — die Fixture, die einen bestehenden Kettenschaden
  einschleust, klammert die Aussetzung ebenfalls. Inhaltlich unverändert: eingefügt wird derselbe
  Schaden, nur jetzt atomar.

Der Test belegt damit die Regel, statt sie zu umgehen.

---

## Neue Tests

Alle fünf in `server/src/services/workPeriodService.test.ts:767` ff., eigener `describe`-Block. Ein
`afterEach` zieht `suspended` auf 0 zurück — ein ausgesetzter Riegel würde sonst jede nachfolgende
Testdatei desselben Laufs vergiften (geteilte Verbindung gegen `server/database/development.db`).

| Test | Was er belegt |
|------|---------------|
| „weist eine Aussetzung außerhalb einer aktiven Transaktion ab und fasst den Riegel dabei nicht an" | Der geforderte Nachweis 1. Prüft zusätzlich, dass `fn` **nicht** lief und `suspended` danach 0 ist |
| „nennt in der Fehlermeldung die verletzte Bedingung" | Klasse, `name` und Meldungstext — kein stiller oder nichtssagender Abbruch |
| „lässt die Aussetzung innerhalb einer Transaktionsklammer weiterhin zu" | Regressionsschutz: die neue Regel sperrt den legitimen Weg nicht |
| „setzt einen hängengebliebenen Riegel beim Serverstart zurück und protokolliert den Vorfall" | Der geforderte Nachweis 2. Prüft `true`/`false`-Rückgabe, den Wert danach, **und** dass `logger.warn` genau einmal mit dem Fehlerobjekt unter dem Schlüssel `err` gerufen wurde. Zweiter Aufruf auf sauberer Datenbank: keine zweite Logzeile |
| „macht den Riegel durch die Rücksetzung tatsächlich wieder scharf" | Wirkung statt Zählerstand: bei `suspended = 1` rutscht ein überlappender `INSERT` durch (`changes === 1`), nach der Rücksetzung wirft derselbe Versuch mit `user_work_periods: …` |

### Nachweis, dass die Tests ohne den Fix fehlschlagen

Die Korrektur wurde vorübergehend zurückgenommen — die `db.inTransaction`-Prüfung entfernt, der
Rumpf von `resetStaleChainGuardSuspension()` auf `return false;` gesetzt (der Zustand vor dem Fix:
es gab die Funktion nicht). Ergebnis:

```
× weist eine Aussetzung außerhalb einer aktiven Transaktion ab und fasst den Riegel dabei nicht an
  AssertionError: expected function to throw an error, but it didn't
  ❯ src/services/workPeriodService.test.ts:788:7

× nennt in der Fehlermeldung die verletzte Bedingung, statt nur „ungültig" zu sagen
  AssertionError: expected undefined to be an instance of ChainGuardOutsideTransactionError
  ❯ src/services/workPeriodService.test.ts:804:20

× setzt einen aus einem früheren Lauf hängengebliebenen ausgesetzten Riegel beim Serverstart
  zurück und protokolliert den Vorfall
  AssertionError: expected false to be true // Object.is equality
  ❯ src/services/workPeriodService.test.ts:831:48

× macht den Riegel durch die Rücksetzung tatsächlich wieder scharf — nicht nur den Zählerstand
  AssertionError: expected false to be true // Object.is equality
  ❯ src/services/workPeriodService.test.ts:888:50

Tests  4 failed | 1 passed | 46 skipped (51)
```

Der eine grüne ist „lässt die Aussetzung innerhalb einer Transaktionsklammer weiterhin zu" — als
Regressionsschutz gedacht, er muss vor und nach dem Fix grün sein.

Bemerkenswert am vierten Fehlschlag: die Zeile davor, `expect(durchgerutscht.changes).toBe(1)`,
ging durch. Der überlappende `INSERT` rutscht bei ausgesetztem Riegel tatsächlich durch — der
Befund beschreibt keinen theoretischen Zustand.

Danach wurde der Fix aus einer Sicherungskopie wiederhergestellt; `npx tsc --noEmit` und der volle
Testlauf liefen gegen die wiederhergestellte Fassung.

---

## Gates

| Gate | Ergebnis |
|------|----------|
| `cd server && npx tsc --noEmit` | **Exit 0** |
| `cd desktop && npx tsc --noEmit` | **Exit 0** |
| `cd server && npx vitest run` | **491 grün / 3 rot** (34 von 36 Dateien grün) |

Der Ausgangszustand war 486 grün / 3 rot; 486 + 5 neue Tests = 491. Die drei roten sind namentlich
die vorbestehenden und nicht mehr geworden:

- `unifiedOvertimeService.test.ts:285` — `expected 40 to be 10`
- `unifiedOvertimeService.test.ts:340` — `expected 40 to be 10`
- `vacationBackfillService.test.ts:138` — `expected true to be false`

Gearbeitet wurde im Haupt-Arbeitsbaum (npm-Workspaces hoisten in den Repo-Root; in einem frischen
Worktree wären die Gates nicht lauffähig). Die Arbeitsdatenbank war
`server/database/development.db`; `work_period_chain_guard.suspended` steht dort nach dem Lauf
nachgeprüft auf 0.

---

## Bewertung

**T-13-02 ist geschlossen.** Alle vier zugesagten Bausteine stehen jetzt: `finally`-Rücksetzung,
Rollback-Wirkung, Test — und das „ausschließlich" ist ein Riegel statt einer Konvention. Der Fall,
den B-2 beschreibt (Riegel dauerhaft und still ausgesetzt), kann über den Anwendungscode nicht mehr
entstehen und wird, falls er aus einem Altbestand mitgebracht wird, beim nächsten Start behoben und
gemeldet.

**Nicht berührt:** B-1 (`PUT /api/users/:id` umgeht den Perioden-Schreibweg) bleibt offen und
gehört unverändert als benannter Prüfpunkt in Phase 14, vor jeden Produktionslauf. B-3
(fehlende `## Threat Flags`-Abschnitte) und die vier Beobachtungen I-1 bis I-4 waren nicht Teil
dieses Auftrags.
