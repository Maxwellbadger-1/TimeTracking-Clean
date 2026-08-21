# Phase 13: Korrigieren und rückgängig machen - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Auto-generated (discuss übersprungen, Empfehlungen des Orchestrators gesetzt)

<domain>
## Phase Boundary

Ein Fehler beim Eintragen ist heilbar, und die Heilung ist nachvollziehbar.

**Im Umfang:**
- „Stammdaten korrigieren" als getrennte Aktion mit eigener Warnung und Pflichtbegründung —
  für den Fall, dass die hinterlegten Stunden von jeher falsch waren
- Periode bearbeiten und löschen; Neuberechnung ab ihrem Beginn
- Korrekturbuchungen werden storniert statt gelöscht, die Storno-Geschichte bleibt sichtbar
- Serverseitige Rollenprüfung für alle Perioden-Endpunkte

**Requirements:** REQ-30, REQ-31

**Nicht im Umfang:**
- Testabdeckung der Wechselfälle und Generalprobe — das ist Phase 14
- Release — das ist Phase 14

</domain>

<decisions>
## Implementation Decisions

### Entschieden (Empfehlung des Orchestrators, vom Anwender pauschal autorisiert)

**D1 — Zwei klar getrennte Aktionen mit unterschiedlicher Bedeutung.**
- „Stundenwechsel ab Datum" (Phase 12): legt eine neue Periode an, die Vergangenheit
  bleibt stehen.
- „Stammdaten korrigieren" (hier): ändert eine bestehende Periode rückwirkend, weil die
  Werte von jeher falsch waren. Eigene Warnung („Das ändert die Vergangenheit"), eigene
  Pflichtbegründung, eigener Endpunkt. Kein gemeinsamer Endpunkt mit Modus-Flag — die
  Trennung muss auch serverseitig sichtbar sein, sonst wird sie irgendwann umgangen.

**D2 — Löschen ist ein Soft-Delete plus Storno, kein `DELETE`.**
Die Periode wird über `deletedAt` weggenommen (Projektregel: kein Hard Delete). Die zur
Periode gehörenden Korrekturbuchungen werden durch **Gegenbuchungen** ausgeglichen, die
im Auszug sichtbar bleiben. REQ-31 wörtlich: „storniert, nicht gelöscht — die
Storno-Geschichte bleibt im Auszug sichtbar". Eine bereinigte Lücke wäre eine
Regelverletzung, kein Schönheitsfehler.

**D3 — Nach dem Löschen schließt die Vorperiode die Lücke.**
Wird eine Periode gelöscht, verlängert sich die davorliegende Periode auf das `validTo`
der gelöschten. Grund: REQ-22 verlangt Lückenlosigkeit; ein Loch in der Kette würde nach
Phase 11 D4 zu einem harten Fehler bei jeder Berechnung in diesem Zeitraum führen.
Sonderfall: Die **erste** Periode eines Nutzers (ab `hireDate`) kann nicht gelöscht,
nur korrigiert werden — sie hat keine Vorgängerin, die die Lücke schließen könnte.

**D4 — Neuberechnung ab Beginn der betroffenen Periode, nicht ab Kontobeginn.**
Nach Bearbeiten oder Löschen wird ab dem `validFrom` der betroffenen Periode bis heute
neu gerechnet. Die Differenz wird wie in Phase 12 als eine Journalbuchung sichtbar
gemacht.

**D5 — Rollenprüfung serverseitig, nicht nur in der Oberfläche.**
Alle Perioden-Endpunkte (lesen, anlegen, bearbeiten, löschen, Vorschau) prüfen die Rolle
im Server. Erfolgskriterium der ROADMAP: Ein Mitarbeiter kann die Perioden eines anderen
weder sehen noch über die API abrufen. Das wird als Test formuliert, der mit einer
Mitarbeiter-Session gegen einen fremden Nutzer läuft und 403 erwartet — nicht durch
Hinsehen geprüft.

**D6 — Bearbeiten und Löschen laufen in einer Transaktion.**
Wie in Phase 12: Periodenänderung, Lückenschluss, Rebuild und Storno-/Gegenbuchung in
einer `db.transaction()`-Klammer.

**D7 — Begründung ist Pflicht, und zwar im Service.**
Leere Begründung wird im Service abgewiesen, nicht nur in der Route und nicht nur im
Formular. Muster aus Phase 6 des Vorgänger-Milestones, wo genau dieser Fehler einmal
gemacht und dann behoben wurde.

### Claude's Discretion
Genaue Endpunktpfade, Komponentenschnitt, Wortlaut der Warnungen und die Form der
Gegenbuchung liegen im Ermessen der Planung — Leitplanken sind der Codebestand, die
UI-SPEC dieser Phase und das Storno-Muster aus Milestone v2.0.

</decisions>

<code_context>
## Existing Code Insights

- Soft Delete ist Projektregel: `UPDATE ... SET deletedAt = ...` statt `DELETE`.
- Storno-Prinzip und Kontoauszug aus Milestone v2.0 sind laut REQUIREMENTS.md
  ausdrücklich wiederzuverwenden statt neu zu erfinden.
- Phase 6 des Vorgänger-Milestones hat gezeigt: Gegenbuchung statt Korrektur des
  Saldos — bei der Pre-Hire-Korrektur wurde `entitlement` per Gegenbuchung auf 0
  gesetzt, damit der Auszug nicht irreführend wird. Dasselbe Prinzip hier.
- `revertBalancesAfterDeletion` (Phase 6) bekam einen `reason`-Parameter für eine
  anlassgerechte Journal-Beschreibung — vergleichbares Muster hier vorsehen.
- Tauri: `universalFetch` statt `fetch` (Session-Cookies).
- Perioden-Constraints und Trigger stammen aus Phase 10 — Lückenschluss und
  Überlappungsschutz müssen mit ihnen zusammenspielen, nicht gegen sie.

</code_context>

<specifics>
## Specific Ideas

- Der Auszug sollte Buchung und Storno als zwei Zeilen mit erkennbarem Bezug zeigen
  (gleiche Referenz auf die Periode), damit nachvollziehbar bleibt, was rückgängig
  gemacht wurde.
- Die Warnung bei „Stammdaten korrigieren" sollte den betroffenen Zeitraum konkret
  benennen, nicht nur allgemein warnen.

</specifics>

<deferred>
## Deferred Ideas

- Wiederherstellen einer gelöschten Periode („Undo des Undo") — nicht angefragt, der
  Weg über eine neue Korrektur reicht
- Human-Verifikation / UAT dieser Phase — auf Anweisung des Anwenders ans Ende des
  Milestones gestellt

</deferred>
