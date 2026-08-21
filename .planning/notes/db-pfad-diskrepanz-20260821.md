# Befund: Dokumentierter lokaler DATABASE_PATH stimmt nicht

**Gefunden:** 2026-08-21, während der Vorbereitung von Milestone v3.0 Phase 9
**Schwere:** mittel — kann still gegen die falsche Datenbank arbeiten

## Sachverhalt

| Quelle | Angabe |
|--------|--------|
| `.claude/CLAUDE.md` → Database Rules, Punkt 1 | `Local: DATABASE_PATH=./database.db` (server/.env.development) |
| `server/.env.development` (tatsächlich) | `DATABASE_PATH=./database/development.db` |
| `scripts/sync-dev-db.sh:40` | `LOCAL_DB="$PROJECT_ROOT/server/database/development.db"` |

Die aktive Entwicklungsdatenbank ist `server/database/development.db`
(Stand 21.08.2026 21:00, enthält aktuelle Produktionsdaten, letzter `time_entries.date`
= 2026-08-20, 20 Nutzer).

Daneben existiert eine verwaiste `server/database.db` vom 02.04.2026 (831 KB), die von
nichts mehr benutzt wird, aber genau dem in `.claude/CLAUDE.md` dokumentierten Pfad
entspricht.

## Warum das zählt

Ein Skript oder ein Entwickler, der der Dokumentation folgt, öffnet die April-Datei und
arbeitet gegen viereinhalb Monate alte Daten — ohne dass etwas fehlschlägt. Das ist
dieselbe Fehlerklasse wie der Vorfall vom 18.08.2026
(`.planning/debug/db-stabilisierung-20260818.md`), bei dem ein Skript ohne gesetzten
`DATABASE_PATH` die Produktionsdatenbank über einen Symlink öffnete.

Für Milestone v3.0 ist das unmittelbar relevant: Phase 9 verifiziert an realen Nutzern,
Phase 11 vergleicht Salden vor/nach dem Umbau, Phase 14 fährt die Generalprobe auf einer
Produktionskopie. Alle drei sind wertlos, wenn sie gegen die falsche Datei laufen.

## Empfehlung

1. `.claude/CLAUDE.md` → Database Rules auf `./database/development.db` korrigieren.
2. Die verwaiste `server/database.db` entfernen oder eindeutig als tot markieren, damit
   sie nicht versehentlich wieder eingebunden wird.
3. Jedes in Milestone v3.0 neu entstehende Skript setzt `DATABASE_PATH` explizit und
   gibt den geöffneten Pfad plus Nutzerzahl beim Start aus, damit ein Fehlgriff sofort
   sichtbar ist statt still zu bleiben.

Punkt 1 und 2 gehören in Phase 14 (D4 verlangt dort ohnehin die Prüfung, ob
`DATABASE_PATH` überall nachgezogen ist). Punkt 3 gilt ab Phase 9.

## Nebenbefund

`bash ./scripts/sync-dev-db.sh` schlägt in Schritt 5/6 mit
`mv: cannot move ... Device or resource busy` fehl, solange der lokale Dev-Server läuft
und die Datei offen hält. Das Skript sichert vorher bereits eine Kopie und lädt den
Snapshot herunter, hinterlässt also einen halbfertigen Zustand. Ein Vorab-Check auf
"Dev-Server läuft" mit klarer Meldung wäre freundlicher als der `mv`-Fehler.
