# Phase 12: Stundenwechsel bedienen - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Auto-generated (discuss übersprungen, Empfehlungen des Orchestrators gesetzt)

<domain>
## Phase Boundary

Ein Admin kann eine Stundenumstellung eintragen und vorher sehen, was sie bewirkt.

**Im Umfang:**
- API und Oberfläche für „Stundenwechsel ab Datum"; Stichtag in Zukunft oder Vergangenheit
- Vorschau vor dem Speichern: Sollstunden vorher/nachher, resultierende Saldoänderung
- Der bestehende Überstundensaldo wird nicht umgerechnet — Stunden bleiben Stunden
- Entstehende Differenz als eigene Buchung im Überstunden-Journal, mit Bezug auf die Periode
- Einbindung in die Stammdaten-Oberfläche (`EditUserModal.tsx`, `WorkScheduleEditor.tsx`)

**Requirements:** REQ-26, REQ-27, REQ-28, REQ-29

**Nicht im Umfang:**
- Bearbeiten und Löschen von Perioden, Storno, „Stammdaten korrigieren" — das ist Phase 13
- Produktionslauf und Release — das ist Phase 14

</domain>

<decisions>
## Implementation Decisions

### Entschieden (Empfehlung des Orchestrators, vom Anwender pauschal autorisiert)

**D1 — „Stundenwechsel ab Datum" ist eine eigene Aktion, nicht ein Feld im Bestandsformular.**
Im `EditUserModal.tsx` erscheint der Stundenwechsel als klar getrennte Aktion mit eigenem
Dialog (Stichtag, neue Wochenstunden, neuer Tagesplan, Vorschau, Begründung). Die
bestehenden Stammdatenfelder für Stunden werden in dieser Phase schreibgeschützt gezeigt
mit Verweis auf die neue Aktion. Grund: REQ-30 (Phase 13) verlangt ausdrücklich die
Trennung von „Wechsel ab Datum" und „Stammdaten korrigieren" — wer den Wechsel als
stilles Formularfeld baut, muss ihn in Phase 13 wieder auseinandernehmen.

**D2 — Die Vorschau kommt vom Server, nicht aus dem Frontend.**
Ein eigener Endpunkt berechnet die Vorschau mit exakt derselben Codebahn, die danach
auch speichert (Dry-Run-Flag oder gemeinsam genutzte Berechnungsfunktion). Grund:
REQ-27 verlangt, dass die Vorschau denselben Wert zeigt, der danach im Konto steht. Eine
im Frontend nachgebaute Rechnung driftet garantiert auseinander — genau der Fehler, den
`.claude/CLAUDE.md` als „Dual Calculation System" beschreibt.

**D3 — Rückwirkender Stichtag ist erlaubt und löst einen begrenzten Rebuild aus.**
Neu gerechnet wird ab `validFrom` der neuen Periode bis heute, nicht die gesamte
Historie. Der Rebuild nutzt die periodenbewussten Wege aus Phase 11.

**D4 — Der Saldo wird nicht umgerechnet; die Differenz entsteht aus dem Rebuild.**
REQ-28 wörtlich: Stunden bleiben Stunden. Es gibt keine Umrechnung des angesparten
Saldos in „Tage nach neuem Modell". Die Differenz, die durch die neue Sollstunden-Basis
im rückwirkenden Zeitraum entsteht, wird berechnet und als **eine** Buchung im
Überstunden-Journal abgelegt — nicht als stille Neuberechnung und nicht als viele
Tagesbuchungen. Bei einem Stichtag in der Zukunft entsteht keine Differenz und damit
keine Buchung.

**D5 — Buchungsmuster von Milestone v2.0 übernehmen.**
Die Journalbuchung folgt dem Muster aus `overtime_transactions` bzw. dem
Urlaubs-Journal: Betrag, Datum, Typ, Begründung, auslösender Admin, Referenz auf die
Periode. Kein neues Buchungskonzept. Die Begründung ist Pflicht.

**D6 — Serverseitige Rollenprüfung ab dem ersten Endpunkt.**
Auch wenn REQ-31/Phase 13 die Rollenprüfung formal nennt: Die hier neu entstehenden
Endpunkte bekommen sie sofort. Ein Endpunkt, der eine Phase lang ungeschützt live ist,
ist ein echtes Risiko, kein Formfehler.

**D7 — Alles in einer Transaktion.**
Periode anlegen, Rebuild und Journalbuchung laufen in einer `db.transaction()`-Klammer.
Muster aus Phase 6 des Vorgänger-Milestones (Statuswechsel und Buchung müssen atomar
sein). Ein halb eingetragener Wechsel ist schlimmer als ein abgelehnter.

**D8 — Desktop-Änderungen brauchen ein Release, das aber erst in Phase 14 kommt.**
Phase 12 liefert Server und Desktop-Code; das Release wird bewusst gebündelt und in
Phase 14 veröffentlicht. Für die Abnahme reicht der lokale Dev-Server plus
`npm run sync-dev-db`.

### Claude's Discretion
Genaue Endpunktpfade, Komponentenschnitt, Formularvalidierung und Textbausteine liegen
im Ermessen der Planung — Leitplanken sind der Codebestand und die UI-SPEC dieser Phase.

</decisions>

<code_context>
## Existing Code Insights

- `EditUserModal.tsx`, `WorkScheduleEditor.tsx` — die betroffenen Stammdaten-Oberflächen.
- Tauri: Browser-`fetch()` verliert Session-Cookies. Es MUSS `universalFetch` aus
  `../lib/tauriHttpClient` verwendet werden (`.claude/CLAUDE.md`, Critical Rules).
- Muster aus Milestone v2.0: `VacationBalanceEditModal.tsx` ruft für Neuanlage UND
  Bearbeitung immer POST auf — beim Nachbau von Modal-Logik nicht blind PUT annehmen.
- Validierung gehört in den Service, nicht nur in die Route: In Phase 6 wurde die
  Leere-Begründung-Prüfung bewusst in den Service gezogen, weil sich mehrere Schreibpfade
  dieselbe Prüfung teilen. Hier genauso.
- Buchungen sind atomar mit dem auslösenden Vorgang zu klammern (`db.transaction()`).
- Der Kontoauszug aus Phase 8 ist der Ort, an dem die Buchung sichtbar wird — dort ist
  bereits ein Tab in `AbsencesPage` etabliert.
- Sortierung im Kontoauszug: Anzeige nach `createdAt DESC, id DESC`; die fachliche
  Chronologie (`date ASC`) darf davon nicht abhängen — siehe Phase-8-Entscheidung.

</code_context>

<specifics>
## Specific Ideas

- Die Vorschau sollte den Zeitraum explizit benennen („Neu gerechnet wird vom 01.07.2026
  bis heute"), nicht nur eine Zahl zeigen. Der Anwender muss die Tragweite eines
  rückwirkenden Stichtags erkennen, bevor er speichert.
- Der Randfall „Stichtag mitten im Monat" ist der wahrscheinlichste Realfall und gehört
  in die Vorschau-Prüfung, nicht erst in die Testabdeckung von Phase 14.

</specifics>

<deferred>
## Deferred Ideas

- Periode bearbeiten/löschen, Storno, „Stammdaten korrigieren" — Phase 13
- Massenpflege mehrerer Nutzer auf einmal — nicht angefragt
- Human-Verifikation / UAT dieser Phase — auf Anweisung des Anwenders ans Ende des
  Milestones gestellt

</deferred>
