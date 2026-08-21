---
phase: 08-kontoauszug-fuer-mitarbeiter-und-admin
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - desktop/src/components/vacation/VacationBalanceEditModal.tsx
  - desktop/src/components/vacation/VacationTransactions.tsx
  - desktop/src/hooks/index.ts
  - desktop/src/hooks/invalidationHelpers.ts
  - desktop/src/hooks/useVacationBalanceAdmin.ts
  - desktop/src/hooks/useVacationTransactions.ts
  - desktop/src/pages/AbsencesPage.tsx
  - desktop/src/pages/VacationBalanceManagementPage.tsx
  - desktop/src/services/notificationService.ts
  - server/src/routes/vacationBalance.ts
  - server/src/routes/vacationTransactionRoutes.test.ts
  - server/src/routes/vacationTransactions.ts
  - server/src/server.ts
  - server/src/services/vacationTransactionService.test.ts
  - server/src/services/vacationTransactionService.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-08-20
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Geprüft wurde der Urlaubs-Kontoauszug (Server-Endpunkt `GET /api/vacation-transactions`,
Journal-Leseschicht `vacationTransactionService.ts`, Oberfläche für Mitarbeiter und Admin).
Der Stand ist bereits als v1.8.0 in Produktion; die folgenden Befunde sind Nacharbeit, kein
Auslieferungs-Blocker.

**Autorisierung:** Sowohl `GET /api/vacation-transactions` als auch `GET /api/vacation-balance/:userId`
prüfen serverseitig, dass ein Mitarbeiter ausschließlich sein eigenes Konto sieht (403 bei
fremder `userId`, kein stiller Rückfall). Die vormalige IDOR-Lücke in `vacationBalance.ts`
ist geschlossen und durch echte HTTP-Tests (`vacationTransactionRoutes.test.ts`) abgesichert,
die auch prüfen, dass die Fehlerantwort keine fremden Daten im Body enthält
(`expect(JSON.stringify(body)).not.toContain(...)`). Admin-Only-Routen (`/`, `/consistency`,
`/summary`) sind unverändert korrekt mit `requireAdmin` versehen.

**SQL-Injektion:** In `vacationTransactionService.ts` wird die Query zwar mit `query +=`
dynamisch zusammengesetzt, aber ausschließlich um Klauseln (`AND year = ?`, `LIMIT ?`) — jeder
eingesetzte Wert läuft über Platzhalter und das `params`-Array. Kein Wert wird direkt in den
Query-String interpoliert. Kein Injektionsbefund.

**Sortierung/Saldo-Kette:** Die Trennung ist sauber durchgehalten: `getVacationJournalEntries`
(neue Funktion dieses Milestones, für den Kontoauszug) sortiert `createdAt DESC, id DESC` und
ist ausführlich dokumentiert und getestet (inkl. Regressionstest für rückdatierte Buchungen).
`getVacationTransactions` (chronologisch, `date ASC, id ASC`) wird — geprüft per Grep über den
gesamten Server-Code — ausschließlich in Tests aufgerufen, nirgends in Produktionscode zur
Anzeige des Kontoauszugs. Die Kette reißt an keiner bekannten Stelle erneut auf.

Zwei kleinere, nicht blockierende Punkte bleiben: eine zu grobe Regex bei der
Beschreibungs-Formatierung im Frontend (WARNING) und mit ihr verwandte fehlende Längenbegrenzung
der Admin-Begründung, die in dieselbe Anzeige einfließt (INFO). Bekannte, bereits dokumentierte
Punkte aus `.planning/phases/08-kontoauszug-f-r-mitarbeiter-und-admin/deferred-items.md`
(Test-Datenbank-Isolation, hartkodierte Skript-Pfade, zeitabhängige Overtime-Tests) werden hier
nicht erneut gemeldet.

## Warnings

### WR-01: `formatDescription`-Regex verwandelt beliebige `\d{4}-\d{2}-\d{2}`-Ziffernfolgen in Datumsangaben, auch wenn sie keine sind

**File:** `desktop/src/components/vacation/VacationTransactions.tsx:108-114`
**Issue:**
```ts
function formatDescription(description: string | null): string {
  if (!description) return '—';
  return description
    .replace(/\s*\(rückwirkend erzeugt\)/g, '')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3.$2.$1')
    .trim();
}
```
Die Beschreibung einer Korrekturbuchung wird serverseitig aus admin-eingegebener Freitext-Begründung
gebaut (`server/src/services/vacationBalanceService.ts:28-30`:
`` `Korrektur ${label} ${oldValue} → ${newValue} (Grund: ${reason})` ``). `reason` ist ein
ungefiltertes Textfeld (`VacationBalanceEditModal.tsx`, min. 5 Zeichen, keine Obergrenze, kein
Format). Trägt die Begründung eine Ziffernfolge, die zufällig dem Muster `\d{4}-\d{2}-\d{2}`
entspricht — z. B. eine Vertrags-, Beleg- oder Vorgangsnummer wie „Fehlbuchung 2024-13-99
storniert" — wird sie kommentarlos zu „99.13.2024" umgeschrieben, obwohl 13 kein gültiger Monat
und 99 kein gültiger Tag ist. Der Regex prüft nicht, ob die Ziffernfolge ein plausibles Datum
darstellt, sondern verlässt sich rein auf die Zeichenform. Der Mitarbeiter sieht dann im eigenen
Kontoauszug eine falsch aussehende „Datumsangabe", die aus einer Referenznummer entstanden ist —
das untergräbt gerade die Nachvollziehbarkeit, die dieser Milestone herstellen soll.
**Fix:** Nur tatsächlich valide Kalenderdaten ersetzen, z. B. mit einer Prüffunktion statt
reinem Zeichenmuster:
```ts
.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (match, y, m, d) => {
  const mm = Number(m), dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return match;
  return `${d}.${m}.${y}`;
})
```
Alternativ: Die Ersetzung nur auf Beschreibungen anwenden, die der Server selbst generiert hat
(z. B. über ein eigenes Metadatenfeld statt Text-Heuristik), statt auf Freitext zu raten.

### WR-02: Admin-Begründung ohne Obergrenze fließt ungekürzt in den Kontoauszug ein

**File:** `desktop/src/components/vacation/VacationBalanceEditModal.tsx:83-86`
**Issue:** `validateForm()` prüft nur eine Mindestlänge (`reason.trim().length < 5`), keine
Maximallänge. Die Begründung landet unverändert in `vacation_transactions.description`
(`buildCorrectionDescription`) und wird im Kontoauszug jedes betroffenen Mitarbeiters angezeigt
(`VacationTransactions.tsx`, Spalte „Beschreibung", `flex-wrap`). Ein sehr langer Text (mehrere
hundert Zeichen, z. B. versehentlich eingefügter Absatz) sprengt die Tabellenzeile optisch, ohne
dass es einen harten Fehler gibt — kein Crash, aber eine für andere Admin-Ansichten (Tabelle mit
vielen Zeilen) unangenehme Layoutverschiebung.
**Fix:** Client- und serverseitige Obergrenze ergänzen, z. B. 500 Zeichen, mit Fehlermeldung
analog zur Mindestlängen-Prüfung:
```ts
if (reason.trim().length > 500) {
  setReasonError('Begründung darf maximal 500 Zeichen lang sein');
  isValid = false;
}
```

## Info

### IN-01: `formatBookedAt`/`formatDescription` verlassen sich auf Textform statt auf strukturierte Serverdaten

**File:** `desktop/src/components/vacation/VacationTransactions.tsx:79-114`
**Issue:** Sowohl der „(rückwirkend erzeugt)"-Vermerk als auch das eingebettete ISO-Datum werden
per Text-Heuristik aus `description` entfernt bzw. umformatiert, statt dass der Server strukturierte
Felder liefert (z. B. `isBackfilled: boolean`, `businessDateInDescription: boolean`). Funktioniert
aktuell korrekt für die bekannten Backfill-Texte, ist aber fragil gegenüber künftigen
Beschreibungs-Formulierungen im Backend — eine Änderung an `buildCorrectionDescription` oder am
Backfill-Skript kann diese Anzeige unbemerkt wieder brechen, ohne dass ein Typfehler das anzeigt.
**Fix:** Mittelfristig erwägen, die betroffenen Buchungsarten strukturiert zu kennzeichnen statt
über Text-Matching in der Oberfläche zu raten. Keine Änderung notwendig für den aktuellen Stand.

### IN-02: Debug-`console.log`-Block direkt neben dem neuen Tab-Umschalter in `AbsencesPage.tsx` — vorbestehend, nicht Teil von Phase 8

**File:** `desktop/src/pages/AbsencesPage.tsx:454-461, 551-567`
**Issue:** Innerhalb der von Phase 8 neu eingerahmten `{activeTab === 'requests' && (...)}`-Sektion
befinden sich zwei Debug-`console.log`-Blöcke pro gerenderter Antragszeile
(`console.log('🔍 Rendering request ...')` und der mit „🔥🔥🔥 MASSIV DEBUG FÜR EMPLOYEE
LÖSCHEN-BUTTON 🔥🔥🔥" kommentierte Block). Beide waren bereits vor Phase 8 vorhanden (nicht Teil
des Diffs `e465f2e..HEAD`), verstoßen aber gegen die Projektregel „Keine Debug-`console.log` in
Produktionscode" (`.claude/CLAUDE.md`) und fallen jetzt zusätzlich ins Auge, weil Phase 8 genau
diesen Abschnitt umgebaut hat. Kein Phase-8-Befund im engeren Sinn, aber naheliegende
Gelegenheits-Aufräumarbeit.
**Fix:** Bei nächster Gelegenheit entfernen oder hinter einen Debug-Flag legen:
```ts
if (import.meta.env.DEV) {
  console.log(`🔍 Rendering request ${request.id}:`, { ... });
}
```

---

_Reviewed: 2026-08-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
