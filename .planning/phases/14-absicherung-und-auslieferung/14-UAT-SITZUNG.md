# Abnahmesitzung Milestone v3.0 — Ablaufplan

**Angelegt:** 2026-08-23 (Plan 14-03)
**Zweck:** Die menschliche Abnahme des gesamten Milestones (Phasen 9 bis 14) in einer
durchführbaren Reihenfolge, statt einer 86 Punkte langen Rohliste.
**Quelle aller Kennungen:** `.planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md`
— jeder Punkt dieser Sitzung trägt eine dort vorhandene Kennung. Keine Punktnummer ist erfunden.

**Kontrollsumme:** 86 Bestandspunkte aus Phase 11/12/13 (siehe `14-UAT-SAMMLUNG.md`,
Abschnitt „Prüfweg-Zuordnung aller 86 Punkte") **plus** 3 zusätzliche Festlegungen 11-F1 bis
11-F3 (laut `<bestand>` nicht in der 86 mitgezählt, aber ebenfalls Prüfweg D zugeordnet)
**plus** 9 eigene Punkte der Phase 14 (`14-U1` bis `14-U9`) = **98 Punkte gesamt**, gruppiert
in vier Prüfwege (A/B/C/D) und zusammengeführten Dubletten (14 Punkte laufen unter einem
Leitpunkt, siehe Kontrollzeile der Sammlung).

**Playwright-Einschränkung (bindend für diese Sitzung):** Playwright ist in dieser
Arbeitsumgebung nicht installiert und darf nicht installiert werden (Versions-Skew,
keine Installation autorisiert). Punkt 48 (E2E-Suite `user-edit.spec.ts`, ersetzt/präzisiert
37–39) läuft deshalb **nicht** als automatisierter Playwright-Lauf, sondern als manueller
Nachvollzug desselben Bedienpfads (0-Stunden-Wechsel über den Wechsel-Dialog) — siehe Gruppe A,
Block „Wechsel-Dialog".

---

## Harte Vorbedingungen vor Sitzungsbeginn

Checkliste, jede Zeile mit einem prüfbaren Befehl. Ohne alle Häkchen wird die Sitzung nicht
begonnen.

| # | Vorbedingung | Prüfbefehl | ✓ |
|---|---|---|---|
| V1 | Port 3000 ist frei (in Phase 12/13 durchgehend durch ein fremdes Next.js-Projekt belegt — deshalb sind fast alle Live-Prüfungen ausgefallen) | `netstat -ano \| findstr :3000` (Git Bash: `netstat -an \| grep ':3000.*LISTEN'`) → **kein** Treffer vor dem Start des eigenen Dev-Servers | ☐ |
| V2 | Dev-Server läuft | `cd server && npm run dev`, danach `curl -s http://localhost:3000/api/health` → `{"status":"ok","database":"connected",...}` | ☐ |
| V3 | Desktop im Dev-Modus | `cd desktop && npm run dev` (oder `/dev`), API-URL zeigt per `/dev` auf `localhost:3000` — sichtbar im Login-Bildschirm/den Netzwerk-Requests | ☐ |
| V4 | Für Gruppe B: Produktionskopie liegt vor | Pfad `server/database/14-produktionskopie.db` — Herkunft: Plan 14-04 zieht die Kopie ausdrücklich für die Generalprobe (siehe `14-CONTEXT.md`, Vorbedingung D1). `ls -la server/database/14-produktionskopie.db` → Datei vorhanden, Zeitstempel jünger als der letzte Produktionslauf | ☐ |
| V5 | Zwei namentlich festgelegte Prüfnutzer | **`<vom Anwender vor der Sitzung zu benennen: Nutzer A — mit Modellwechsel>`** und **`<vom Anwender vor der Sitzung zu benennen: Nutzer B — ohne Modellwechsel>`** — keine erfundenen Namen, siehe `14-UAT-SAMMLUNG.md` Kopf „Vorbedingungen für die Abnahmesitzung" | ☐ |
| V6 | `npm run sync-dev-db` frisch gezogen (falls Gruppe A gegen realistische Datenmengen laufen soll) | `npm run sync-dev-db` erfolgreich beendet, kein Fehler | ☐ |

---

## Gruppe A — am laufenden Dev-Server

Reihenfolge vermeidet Kontextwechsel: zuerst Admin-Werkzeuge ohne Dialogkontext, dann der
Wechsel-Dialog vollständig, dann der Korrektur-/Löschdialog vollständig, dann der Kontoauszug,
dann die Nutzerverwaltung, dann die Abwesenheitsanträge, dann ein einziger Durchgang
„Dunkelmodus und Kontrast" über alle neuen Flächen, zuletzt ein einziger Durchgang
„ausschließlich Tastatur".

### A0 — Admin-Werkzeuge, DATEV-Export, Regressionscheck (kein Dialogkontext)

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| 11-U1 | DATEV-Export für einen Zeitraum erzeugen, der einen soft-gelöschten Nutzer enthält (Austrittsdatum im Zeitraum), Export in den DATEV-Importweg geben | Die zusätzlichen Zeilen des soft-gelöschten Nutzers sind enthalten und werden vom Importweg angenommen | ☐ |
| 11-U2 | DATEV-Export für einen Zeitraum anstoßen, in dem ein Nutzer keine lückenlose Periodenkette hat | HTTP 409 mit verständlicher Meldung in der Oberfläche | ☐ |
| 11-U3 | `GET /api/admin/period-chains` als Admin, danach als Nicht-Admin aufrufen | Admin bekommt die Befundliste, Nicht-Admin bekommt 403 | ☐ |
| 11-U4 | `npm run validate:overtime:detailed -- --userId=<Nutzer A> --month=<aktueller Monat>` bei laufendem Server | Alle vier Vergleichswege melden PASSED, einschließlich des Frontend-API-Wegs | ☐ |
| P12-3 | Bestehendes Modal (z. B. Zeiteintrag/Benutzer bearbeiten) im hellen und dunklen Modus öffnen | Erscheinungsbild, Backdrop-Klick, ESC unverändert zu v1.8.0, kein Flackern | ☐ |

### A1 — Wechsel-Dialog

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| 14-U6 | Regressionscheck der sechs Phase-12-UI-Korrekturen: `ConfirmDialog` bei niedrigem Fenster öffnen, Vorschaupanel beim Tippen beobachten, Zeilenmarkierung (Zustand 10) ansehen, Toggle „Individueller Wochenplan" mit Screenreader/Tab prüfen, Farbflächen im Dialog zählen | `ConfirmDialog` scrollt (keine verlorenen Knöpfe), kein falscher Platzhaltersatz während des Ladens, Zeile ist als Fläche markiert (nicht nur zwei Striche), Toggle hat Rolle/Namen, höchstens die vier vertraglich reservierten blauen Flächen sichtbar | ☐ |
| P12-5 (+31) | Wechsel-Dialog öffnen, darüber `ConfirmDialog` öffnen (rückwirkender Stichtag), ESC drücken | Nur der oberste Dialog schließt, der Wechsel-Dialog bleibt mit allen Eingaben offen; z-Index-Stapelung sichtbar (`ConfirmDialog` über Wechsel-Dialog über `EditUserModal`) | ☐ |
| P12-10 | Rückwirkenden Wechsel starten, Server während `applyWorkTimeChange()` beenden | Weder neue Periode noch `model_change`-Buchung ist danach vorhanden | ☐ |
| P12-11 | Vorschau abrufen (`previewToken` ausstellen), Server neu starten, danach mit dem alten Token speichern | Token bleibt gültig, Speichern gelingt | ☐ |
| P12-12 | Sehr langen rückwirkenden Zeitraum wählen (über mehrere Monate), `balanceDelta`/`targetHoursDelta` mit `npm run validate:overtime:detailed` abgleichen | Werte stimmen überein, kein Rundungsfehler über die Monatsgrenzen | ☐ |
| P12-14 | Periodenliste bei Fenster <640 px ansehen | Horizontal scrollbar, kein abgeschnittener Inhalt | ☐ |
| P12-15 | Nutzer mit mehreren Perioden öffnen | Jüngste Umstellung oben, heute gültige trägt „Aktuell", künftige „Geplant" | ☐ |
| P12-16 | Server stoppen während die Periodenliste lädt, danach neu starten und „Perioden erneut laden" klicken | Fehlertext erscheint, Nachladen gelingt nach Neustart | ☐ |
| P12-23 | Rückwirkenden Wechsel mit Differenz 0 eintragen | Zeitraumsatz und „± 0:00h"-Anzeige, `ConfirmDialog` mit Nulldifferenz-Textvariante | ☐ |
| P12-24 | Fenster auf unter 640 px ziehen (Wechsel-Dialog offen) | Stichtag/Wochenstunden und Sollstunden-Kennzahlen stehen untereinander, nichts abgeschnitten | ☐ |
| P12-25 | Vorschau abrufen, 15 Minuten warten, dann speichern | Automatische Neuberechnung beim ersten Fehlschlag, sauberer Fehlerzustand beim zweiten | ☐ |
| P12-26 | Frisch angelegten Nutzer ohne vorherige Periode öffnen | Infopanel zeigt „Aktuell gültig seit {Eintrittsdatum}" | ☐ |
| P12-28 | Vollständiger Bedienfluss: Bearbeiten → „Stundenwechsel ab Datum …" → Dialog → Eingaben → Vorschau → Speichern → Erfolgsbanner+Toast → Periodenliste/Wochenstundenfeld aktualisieren sofort | Kompletter Fluss ohne Bruch | ☐ |
| P12-35 | `WorkScheduleDisplay` bei Nutzer mit mehreren Perioden ansehen | Zeile „Aktuell gültiges Modell seit …" nennt `validFrom` der heute gültigen Periode | ☐ |
| P12-48 (+37, +38, +39) | **Manueller Ersatz für den E2E-Test** (Playwright nicht installierbar, siehe Kopf dieser Datei): Bedienpfad „Change employee to 0 hours" von Hand nachvollziehen — Nutzer mit 0 Wochenstunden über den Wechsel-Dialog anlegen, alle sieben zuvor kaputten `button[aria-label="Bearbeiten"]`-Stellen aus `user-edit.spec.ts` einzeln im Klickpfad nachstellen | Der 0-Stunden-Wechsel gelingt über den Wechsel-Dialog, alle sieben Bearbeiten-Buttons im nachgestellten Pfad funktionieren wie erwartet | ☐ |

### A2 — Korrektur-/Löschdialog

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| 14-U5 | Regressionscheck der fünf Phase-13-UI-Korrekturen: rückwirkende Korrektur ohne Vorschau anstoßen, Chip „Nicht löschbar" ansehen, Pflichtbegründung leer lassen und absenden, Korrekturblock bei simuliertem Ladefehler ansehen, Löschbestätigung öffnen | „Rückwirkend ja/nein" stimmt mit der Server-Vorschau überein (nicht mit einer Client-Schätzung), Chip zeigt Tooltip via `title`/`aria-label` statt eigenem Overlay, Absenden mit leerer Begründung setzt Feldfehler + Fokus statt stummer Sperre, Korrekturblock bleibt bei Ladefehler sichtbar und gesperrt, Löschpunkt 3 zeigt eine fett hervorgehobene Zahl (kein Absatz) | ☐ |
| P12-4 | `ConfirmDialog` öffnen (z. B. „Benutzer löschen") | X-Button hat zugänglichen Namen, ESC schließt, „Löschen"/„Abbrechen" unverändert | ☐ |
| P12-7 | Screenreader/Accessibility-Panel am X-Button beider Dialogtypen prüfen | „Dialog schließen"/„Abbrechen" wird angesagt, nicht „Schaltfläche" | ☐ |
| 13-U1 | Korrektur-Dialog für eine Periode öffnen, die die Vergangenheit berührt | Amberfarbenes Warnbanner mit konkretem Zeitraum, Ausweg-Satz 3 sichtbar, hervorgehobene Saldoänderung ist der einzige Blickfang | ☐ |
| 13-U2 | Korrektur an einer vollständig zukünftigen Periode | Blaues Panel „Keine Rückwirkung", kein Bestätigungsschritt beim Speichern | ☐ |
| 13-U3 | Löschbestätigung öffnen, die drei `details`-Punkte und die Pflichtbegründung (≥10 Zeichen) prüfen | Reihenfolge Lückenschluss/Storno/Saldoänderung, Bestätigungsknopf gesperrt solange Vorschau lädt ODER Begründung <10 Zeichen | ☐ |
| 13-U4 | Löschvorschau scheitern lassen (Server während der Vorschau anhalten) | Punkt 3 wird zum Fehlertext, Bestätigungsknopf bleibt gesperrt, nichts wird gelöscht | ☐ |
| 13-U8 | Tastaturbedienung des Chips „Nicht löschbar" auf der ersten Periode | Mit Tab erreichbar, Tooltip bei Fokus, mit ESC ausblendbar ohne dass `EditUserModal` schließt | ☐ |
| 13-U10 | Fenster unter 640 px: Periodenzeilen-Aktionen, Korrekturblock-Knopf | Zeilenaktionen nur als Symbole, Trefferfläche mind. 32×32 px, Korrekturblock-Knopf über volle Breite | ☐ |
| 13-U12 | Login und Laden der Perioden-/Kontoauszugsliste nach der `api/client.ts`-Bereinigung | Login funktioniert, Listen laden unverändert, keine Konsolen-Fehlermeldung ersetzt den entfernten Code | ☐ |
| 13-U13 | `aria-label` des Löschbestätigungsknopfs mit Screenreader abhören | Angesagter Name nennt die Periode konkret („Periode vom {Datum} löschen und stornieren") | ☐ |
| 13-U15 | Ehemals tödlichen Ablauf nachstellen: Stundenwechsel 40→32, per Korrektur zurück auf 40 (ohne `validFrom` zu verschieben), Periode löschen | Löschen gelingt (vor Fix `03ac2af` endete dieser Ablauf deterministisch in 500 und dauerhaft unlöschbar) | ☐ |
| 13-U16 | Korrektur ohne Saldowirkung speichern (Tagesplan umverteilen bei gleicher Wochensumme), Kontoauszug ansehen | Journalzeile mit Begründung erscheint, obwohl sich der Saldo nicht ändert | ☐ |
| 13-U17 (+P12-42) | Im Korrektur-Dialog zügig mehrere Felder des 7-Feld-Tagesplans ändern (normales Tipptempo) | Kein `429` bei normalem Bedientempo (Eimer sind seit `74a8be6` je Route und Nutzer, nicht mehr geteilter IP-Eimer) | ☐ |
| 13-U18 (+P12-20) | `PREVIEW_STALE` in **beiden** Dialogen auslösen: Wechsel-Dialog länger als 15 Minuten offen lassen und speichern, danach dieselbe Wartezeit in der Löschbestätigung | In beiden Dialogen ein lesbarer deutscher Satz, nicht der interne Code `PREVIEW_STALE` | ☐ |
| 13-U19 | Storno-Paar mit Zukunftsdatum anlegen, Kontoauszug ansehen | Beide Zeilen sind sichtbar (vor Fix `d3015e1` fiel ein zukunftsdatiertes Paar aus der Liste) | ☐ |

### A3 — Kontoauszug

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| 11-U5 | Überstunden-Live-Anzeige und Kontoauszug für Nutzer A (Modellwechsel) ansehen | Sollstunden entsprechen vor/nach dem Stichtag den serverseitig belegten Werten | ☐ |
| P12-29 | Kontoauszug nach einem Wechsel ansehen | Zeile „Modellwechsel" (Teal-Badge) mit Betrag, Vorzeichen, Trendpfeil, Begründung, zweite Zeile „Periode ab … · eingetragen am … von {Admin}" mit echtem Admin-Namen | ☐ |
| P12-49 | Typ-Spalte des Kontoauszugs für gewöhnliche Tageszeilen ansehen | Bekannter Nebenbefund: prüfen, ob dort der Rohwert statt einer deutschen Bezeichnung steht | ☐ |
| 13-U5 | Kontoauszug nach echtem Löschvorgang ansehen | Zwei Zeilen (Original + Storno), beide teal, je ein graues Zustands-Badge, gemeinsame Belegnummer; Klick auf Beleg-Chip springt zur Partnerzeile und hebt sie 2s hervor | ☐ |
| 13-U6 | Zeitraum so wählen, dass die Partnerzeile jenseits der Abschneidegrenze liegt, auf den Beleg-Chip klicken | Erklärtext (`toast.info`) statt stillem Klick ins Leere | ☐ |

### A4 — Nutzerverwaltung

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| 14-U9 | Admin öffnet `EditUserModal`, speichert unveränderte Stammdaten; danach ändert er `weeklyHours` direkt im Formular und speichert | Unveränderte Stammdaten speichern gelingt weiterhin (kein 400); eine tatsächliche Wochenstunden-/Wochenplan-Änderung wird mit HTTP 400 abgewiesen, Admin wird auf den Weg über „Stundenwechsel ab Datum …" verwiesen | ☐ |
| P12-30 | Bestehende Bedienwege der Nutzerverwaltung (Anlegen, Löschen, Deaktivieren, Passwort-Reset) durchgehen | Verhalten unverändert zu v1.8.0 | ☐ |
| 13-U7 | Mitarbeiter-Sitzung auf einen fremden Nutzer (Periodenliste in `EditUserModal`) | Graues Panel „Kein Zugriff auf die Arbeitszeit-Perioden" mit Schloss-Symbol, **kein** roter Fehler-Toast | ☐ |

### A5 — Abwesenheitsanträge

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| P12-32 | Abwesenheitsantrag über einen Stichtag hinweg stellen | Angezeigte Stundenzahl entspricht der nach Genehmigung tatsächlich gebuchten | ☐ |
| P12-33 | Abwesenheitsantrag über einen Feiertag stellen | Feiertag wird in der Vorschau nicht als Arbeitstag gezählt | ☐ |
| P12-34 | Server während des Ausfüllens nicht erreichbar machen | Kein Zahlenanspruch, Hinweistext erscheint, Antrag bleibt absendbar | ☐ |

### A6 — Ein Durchgang: Dunkelmodus und Kontrast (über alle neuen Flächen)

Ein einziger zusammenhängender Durchgang durch alle Flächen unten, je einmal hell und einmal
dunkel. Deckt sechs Einzelpunkte in einer Sichtprüfung ab.

| Kennung (Leitpunkt 13-U9, zusammengeführt: P12-13, P12-21, P12-27, P12-47) | Fläche | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| 13-U9 / P12-13 | Periodenliste (Badges „Aktuell"/„Geplant", Tabellentexte) | Kontrast mindestens so gut wie der bestehende Kontoauszug | ☐ |
| 13-U9 / P12-21 | Wechsel-Dialog (hervorgehobene Saldoänderung) | Fett/farbig/Trendpfeil ist das dominante Element, kein Konkurrenzelement | ☐ |
| 13-U9 / P12-27 | Schreibgeschütztes Wochenstundenfeld | Kontrast mindestens 4,5:1, kein `opacity`-Trick | ☐ |
| 13-U9 / P12-47 | Kontoauszug: zweizeilige Stundenspalte der Modellwechsel-Zeile, neutrale Saldozeile, Fußnote | Kontrast ≥4,5:1 an allen drei Stellen | ☐ |
| 13-U9 | Phase-13-Flächen: Korrekturblock unter Periodenliste, Panel „Kein Zugriff", `details`-Panel der Löschbestätigung (inkl. Begründungsfeld), Zustands-Badges im Kontoauszug | Kontrast/Lesbarkeit mindestens so gut wie die bestehenden Flächen aus Phase 12 | ☐ |

### A7 — Ein Durchgang: ausschließlich Tastatur

| Kennung (Leitpunkt 22, zusammengeführt: P12-6, P12-8) | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| P12-22 (+6, +8) | Wechsel-Dialog ausschließlich mit der Tastatur bedienen: öffnen (Fokus muss auf „Stichtag" stehen), Tab-Reihenfolge komplett durchlaufen (mehrfach, bis zum Wickeln vom letzten zum ersten Element), ESC drücken bei zwei gestapelten Dialogen, danach erneut Tab | Anfangsfokus auf „Stichtag"; Tab-Reihenfolge sinnvoll; Fokusfalle springt vom letzten zum ersten Element zurück statt aus dem Dialog zu springen; ESC schließt nur den obersten Dialog; nach dem Schließen landet der Fokus auf dem auslösenden Element (Einstiegs-Button) | ☐ |

---

## Gruppe B — gegen die Produktionskopie

Reihenfolge nach D1 (`14-CONTEXT.md`): Migrationsstand und Bestandsdatenprüfungen zuerst, dann
der Vorher/Nachher-Saldenvergleich, dann die Laufzeit-/Lastpunkte.

### B1 — Migrationsstand und Bestandsdatenprüfungen

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| P12-1 | Migration 011 auf der Produktionskopie: Zeilenzahl `overtime_transactions` vor/nach vergleichen, `PRAGMA integrity_check` | Zeilenzahl identisch, `integrity_check` = `ok` | ☐ |
| 13-U14 | Migration 015 (eindeutiger Index auf `reversalOf`) beim nächsten Serverstart gegen die Kopie anwenden, danach `PRAGMA integrity_check` und `foreign_key_check` | Migration läuft fehlerfrei, Index eindeutig, keine Datensatzverluste | ☐ |
| P12-40 | `SELECT referenceType, COUNT(*) FROM overtime_transactions GROUP BY referenceType;` vor Migration 012 auf der Kopie | Steht dort ein Wert außerhalb der fünf erlaubten — Entscheidung „auf NULL setzen" ausdrücklich bestätigen | ☐ |
| P12-2 | `GET /api/work-periods` mit echter Mitarbeiter-Session (echtes Passwort) gegen fremde `userId` auf der Kopie | HTTP 403, keine Perioden im Antwortkörper | ☐ |

### B2 — Vorher/Nachher-Saldenvergleich

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| 13-U11 (+11-U6, +P12-18) | Generalprobe: `snapshotBalances.ts` vor der Umstellung, eine echte Umstellung eintragen, `snapshotBalances.ts` danach, `diff` beider `*.users.json`, danach dieselbe Periode löschen und ein drittes Mal snapshotten | Kein Nutzer außer dem betroffenen zeigt eine Saldoänderung zwischen Snapshot 1 und 2; nach dem Löschen (Snapshot 3) ist der betroffene Nutzer exakt auf dem Stand von Snapshot 1; Periodenketten bleiben lückenlos | ☐ |
| P12-19 | `checkAllPeriodChains()` gegen die Produktionskopie nach dem realen Wechsel aus B2 | Kein Befund | ☐ |
| P12-44 | Rückwirkenden Wechsel für einen Nutzer mit bereits genehmigtem Urlaub im nächsten Quartal | Vorhandene `overtime_balance`-Zeilen jenseits von heute werden korrekt mitgezogen | ☐ |
| P12-17 | Vollständiger Vorschau→Speichern-Zyklus für Nutzer A (realer Nutzer, echte Daten) | Derselbe im Kontoauszug angezeigte Saldo wie in der Vorschau notiert | ☐ |
| 14-U1 | Der reale Umstellungsfall (D6): Nutzer-ID/Name, Stichtag, alte Wochenstunden, neue Wochenstunden — **`<vom Anwender vor der Sitzung zu benennen>`** — eintragen und gegen die genannte Erwartung prüfen | Ergebnis entspricht exakt den vier vorab genannten Werten | ☐ |
| 14-U2 | Freigabe des Produktionslaufs (D2): Backup vorhanden und rückspielbar, Deployment verifiziert (`gh run list --workflow="deploy-server.yml"`, Health-Check), Trockenlauf gesichtet | Alle vier Bedingungen erfüllt, erst dann `--apply` freigeben | ☐ |

### B3 — Laufzeit-/Lastpunkte

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| P12-9 | Rückwirkenden Wechsel für einen Nutzer mit vielen Zeiteinträgen auf der Kopie ausführen, Laufzeit messen | `applyWorkTimeChange()` unter 10 Sekunden, Server bleibt antwortfähig | ☐ |

---

## Gruppe C — nach dem Release

> ### ✅ Ab jetzt prüfbar — Version **v1.9.0**, veröffentlicht am **26.08.2026**
>
> Das Release ist durch. Lauf `33005681228`, alle vier Matrixjobs `success`, Release nicht als
> Entwurf, 17 Artefakte. **`latest.json` trägt alle vier Plattformschlüssel** — jeder mit
> gesetzter `url` **und** `signature`, jede der vier URLs mit HTTP 200 gegengeprüft
> (`14-RELEASE.md`, Abschnitt 6).
>
> Die Voraussetzung dieser Gruppe — eine ausgelieferte Desktop-App — ist damit erfüllt. Was
> maschinell prüfbar war, ist geprüft; **offen bleibt allein der Teil, den nur ein echtes Gerät
> zeigen kann**: dass eine installierte Vorversion das Update tatsächlich zieht.
>
> Release: https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/tag/v1.9.0

**Hinweis:** Diese Gruppe liegt zeitlich **nach** Plan 14-11 (Release) und braucht ein zweites,
kurzes Fenster in der Sitzung — nicht am selben Tag wie A/B/D lösbar, da sie eine bereits
ausgelieferte Desktop-App voraussetzt.

| Kennung | Was zu tun ist | Erwartetes Ergebnis | ✓ |
|---|---|---|---|
| 14-U3 | **Erste Hälfte in Plan 14-11 bereits maschinell erledigt** (siehe Kasten oben) — zu tun bleibt: eine installierte Vorversion (v1.8.0) starten und beobachten, ob sie v1.9.0 anbietet und einspielt | `latest.json` enthält alle vier Plattformschlüssel (`darwin-aarch64`, `darwin-x86_64`, `linux-x86_64`, `windows-x86_64`) mit gesetzter `url` + `signature` — **am 26.08.2026 für alle vier belegt, je Schlüssel einzeln, plus HTTP 200 auf jede URL ✅**; die Alt-Version zieht das Update automatisch — **offen, nur am echten Gerät prüfbar** ☐ | ☐ |

---

## Gruppe D — Festlegungen (Durchsprache, kein Server, keine Daten)

### D1 — Bereits umgesetzte Festlegungen (bestätigen oder widersprechen)

| Kennung | Festlegung | Verworfene Alternative | Bestätigt | Widersprochen | Anmerkung |
|---|---|---|---|---|---|
| 11-F1 | Eintrittsdatum nach hinten verlegt: bestehende Periodenkette bleibt stehen | Kettenanfang abschneiden | ☐ | ☐ | |
| 11-F2 | `migrateOvertimeToTransactions` bricht bei Datendefekt ab | Weiterlaufen, nur protokollieren | ☐ | ☐ | |
| 11-F3 | DATEV-Export bricht mit HTTP 409 ab bei lückenhafter Kette | Nutzer stillschweigend weglassen oder Warnblock in CSV | ☐ | ☐ | |
| 13-F1 | Erste Periode korrigierbar, nicht löschbar | Auch erste Periode löschbar machen | ☐ | ☐ | |
| 13-F2 | Gelöschte Periode nicht wiederherstellbar, Weg über Neueintragung | „Undo des Undo"-Mechanismus | ☐ | ☐ | |
| 13-F3 | Belegnummer = Id der Ursprungsbuchung | Periode selbst als Belegnummer | ☐ | ☐ | |
| 13-F4 | Punkt 2 der Löschbestätigung wechselt zur Mehrzahlform bei mehreren Buchungen | Immer Einzahlform | ☐ | ☐ | |
| 13-F5 | Kettenriegel kurzzeitig ausgesetzt, danach `checkPeriodChain()` | Riegel während gesamter Korrektur aktiv | ☐ | ☐ | |
| 13-F6 | `deletedBy` zusätzlich zu `deletedAt` gespeichert | Nur `deletedAt` | ☐ | ☐ | |
| 13-F7 | Warnfarbe Gelb → Amber | Gelb beibehalten | ☐ | ☐ | |
| 13-F8 | Pflichtbegründung (≥10 Zeichen) bei Löschbestätigung ergänzt | Kein Eingabefeld, Server lehnt immer mit 400 ab | ☐ | ☐ | |
| 13-F9 | `checkPeriodChain()` läuft unbedingt nach jedem Schreiben | Nur im Zweig mit ausgesetztem Riegel | ☐ | ☐ | |
| 13-F10 | `reversedAt` über `formatCreatedAtDe()` formatiert | Dem `T12:00:00`-Muster folgen | ☐ | ☐ | |

### D2 — Offene Entscheidungsfragen (noch nicht festgelegt)

| Kennung | Frage | Entscheidung | Anmerkung |
|---|---|---|---|
| P12-36 | Soll der kompakte Modus von `WorkScheduleDisplay` eine Stichtag-Zeile ergänzen? | ☐ ja ☐ nein | |
| P12-41 | Ist „Beginn des Vorjahres" die richtige Rückwirkungsgrenze für die Stiftung? | ☐ ja ☐ nein | |
| P12-43 | Braucht `previewToken` einen echten Einmalverbrauch (Serverzustand) statt Zustandslosigkeit? | ☐ ja ☐ nein | Architekturentscheidung |
| P12-45 | Soll die Begründung auch im Schreibweg getrimmt werden (nicht nur im Anzeigepfad)? | ☐ ja ☐ nein | |
| P12-46 | Soll der Anfangsfokus bei `EditUserModal`/`TimeEntryForm`/`AbsenceRequestForm` auf dem ersten Eingabefeld statt dem Schließen-Knopf liegen? | ☐ ja ☐ nein | Betrifft 3 von 13 Modal-Aufrufern |
| P12-50 | Braucht der Text bei verweigerter Abwesenheitsvorschau (außerhalb des Feiertagsfensters) eine eigene Formulierung? | ☐ ja ☐ nein | |
| P12-51 | Soll der Grund bei einer Krankmeldung wieder ein Pflichtfeld werden? | ☐ ja ☐ nein | Betrifft Frontend UND Server |

### D3 — Nur zur Kenntnis (bereits entschieden bzw. automatisiert verifiziert)

| Kennung | Inhalt | Warum kein manueller Test nötig |
|---|---|---|
| 14-U4 | WR-07 (B-1): `PUT /api/users/:id` umgeht den Perioden-Schreibweg nicht mehr | Entschieden und umgesetzt in Plan 14-02, siehe `14-WR07-ENTSCHEIDUNG.md`; die Verhaltensprüfung selbst läuft manuell unter `14-U9` (Gruppe A) |
| 14-U7 | B-2-Sicherheitsfix: Kettenriegel-Aussetzung erzwingt Transaktionsklammer | Bereits committet (`2c1c2ce`) und durch 5 neue automatisierte Tests belegt (`13-SECURITY-FIX.md`), 491 grün / 3 rot (vorbestehend) |
| 14-U8 | REQ-32-Nachweis: fünf Wechselfälle einzeln maschinell nachgewiesen | `14-REQ32-NACHWEIS.md` — jeder Fall per `npx vitest run -t "<Titel>"` einzeln belegt, kein Sammellauf, kein manueller Retest nötig |

---

## Zeitschätzung je Gruppe

Herleitung: Punktzahl der Gruppe × Minutenansatz pro Punkt (ein Ansatz je Gruppe, damit die
Schätzung nachrechenbar ist). Sichtprüfungen sind schneller als konstruierte Randfälle mit
Server-Neustart/Wartezeit — das spiegelt sich in unterschiedlichen Ansätzen je Gruppe.

| Gruppe | Punktzahl | Minutenansatz/Punkt | Ergebnis | Herleitung des Ansatzes |
|---|---|---|---|---|
| A | 61 (58 aus den 86 + 14-U5 + 14-U6 + 14-U9) | 3 min | **183 min (~3,05 Std.)** | Mischung aus reiner Sichtprüfung (~30 s bis 2 min, z. B. Kontrast, Layout) und Bedienfällen mit echter Interaktion (~5 min, z. B. Server stoppen, 15 min warten, vollständiger Klickpfad); 14-U5/14-U6 zählen als je ein Punkt, decken aber intern 5 bzw. 6 Einzelbefunde ab — 3 min ist der Mittelwert über alle Fälle |
| B | 13 (11 aus den 86 + 14-U1 + 14-U2) | 12 min | **156 min (~2,6 Std.)** | Jede Prüfung braucht eine eigene Abfrage/einen Skriptlauf/einen Snapshot-Vergleich gegen die vorbereitete Kopie — kein Aufbau der Kopie selbst (das ist Vorbedingung V4), aber Diff-Auswertung und Dokumentation je Punkt |
| C | 1 (14-U3) | 20 min | **20 min** | Download der Release-Assets, Signaturprüfung aller vier Plattformschlüssel, Wartezeit auf den Auto-Update-Zyklus einer installierten Alt-Version |
| D | 23 (11-F×3 + 13-F×10 + P12-D×7 + 14-U×3) | 3 min | **69 min (~1,2 Std.)** | Reine Durchsprache ohne Server/Daten — Vorlesen der Festlegung, ggf. kurze Diskussion |

**Gesamt A+B+D (ein Sitzungsfenster):** 183 + 156 + 69 = **408 Minuten ≈ 6,8 Stunden** —
realistischerweise auf mindestens zwei Blöcke am selben oder an zwei aufeinanderfolgenden Tagen
zu verteilen (z. B. A+D an einem Termin, B an einem eigenen Termin mit vorbereiteter Kopie).
**Gruppe C** läuft in einem separaten, kurzen Fenster nach dem Release (Plan 14-11) — 20 Minuten.

**Kontrollsumme der Zeitschätzung:** 61 (A) + 13 (B) + 1 (C) + 23 (D) = **98 Punkte**,
identisch mit der Kontrollsumme im Kopf dieser Datei (86 + 3 + 9).

---

## Abbruchregeln

**Sofortiger Abbruch der Sitzung** (nicht nur notieren — die Umstellung/der betroffene Lauf wird
gestoppt, bevor weitergeprüft wird):

1. **Jeder Punkt, der eine Saldoänderung bei einem Nutzer OHNE Modellwechsel zeigt** (Gruppe B,
   insbesondere 13-U11/B2). Das ist der nicht verhandelbare Kernnachweis des gesamten
   Milestones (D5, `14-CONTEXT.md`) — jeder weitere Name in der Diff-Ausgabe ist ein Blocker,
   kein Hinweis.
2. `PRAGMA integrity_check` liefert nicht `ok` nach einer Migration auf der Produktionskopie
   (B1) — die Migration wird nicht gegen die echte Produktionsdatenbank wiederholt, bis die
   Ursache gefunden ist.
3. `foreign_key_check` liefert eine oder mehrere Zeilen nach einer Migration (B1).
4. `checkAllPeriodChains()` meldet einen Befund bei einem Nutzer, der **nicht** Teil des realen
   Umstellungsfalls (14-U1) ist (B2).
5. Ein Punkt aus Gruppe A zeigt, dass Vergangenheit tatsächlich neu berechnet wurde (z. B.
   13-U1/13-U15: eine Korrektur verändert Buchungen vor dem betroffenen Zeitraum) — das ist der
   Kernwert des Milestones („Eine Stundenumstellung verschiebt keine Vergangenheit").

**Nur notiert, kein Abbruch:**

- Feinschliff-Befunde ohne Funktionswirkung (z. B. die in `12-UI-REVIEW-FIX.md` und
  `13-UI-REVIEW-FIX.md` bewusst offen gelassenen `F-*`/`T-*`/`S-*`-Punkte — nicht Teil dieser
  Sitzung, da bereits als „bewusst offen gelassen" dokumentiert).
- Bekannte, bereits dokumentierte Umgebungsbefunde aus den „Nachrichtlich"-Blöcken in
  `14-UAT-SAMMLUNG.md` (z. B. `vitest` im Desktop nicht lauffähig, `server/database.db` als
  veralteter Altbestand).
- Offene Entscheidungsfragen aus Gruppe D2 — diese werden besprochen und protokolliert, sind
  aber kein technischer Fehlschlag.

---

## Ergebnisprotokoll (nach der Sitzung auszufüllen)

| Gruppe | Punkte gesamt | Bestätigt (✓) | Auffällig / Abbruch | Nicht durchgeführt |
|---|---|---|---|---|
| A | 61 | | | |
| B | 13 | | | |
| C | 1 | | | |
| D | 23 | | | |
| **Gesamt** | **98** *(61+13+1+23 = 86 Bestandspunkte + 3 zusätzliche Festlegungen 11-F1–F3 + 9 Phase-14-Punkte, siehe Kontrollsumme im Kopf dieser Datei)* | | | |
