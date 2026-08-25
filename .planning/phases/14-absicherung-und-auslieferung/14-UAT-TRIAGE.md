# Abnahme-Triage — wer kann welchen Punkt prüfen?

**Angelegt:** 2026-08-25
**Zweck:** Die Frage des Anwenders beantworten, ob ein Teil der Abnahme maschinell laufen kann,
und die Sitzung von rund 6,8 Stunden auf ein vertretbares Maß kürzen.
**Quellen:** `14-UAT-SAMMLUNG.md` (Rohliste Phasen 11, 12, 13, 14 und 14.1) und
`14-UAT-SITZUNG.md` (Gruppen A–D mit Zeitansätzen). Beide zusammen ergeben die Gesamtliste.
**Diese Datei ändert nichts** — sie ordnet nur ein. Kein Skript wurde ausgeführt, keine
Quelldatei angefasst.

---

## 1. Die Antwort in vier Sätzen

Von den 128 Punkten der Gesamtliste braucht **weniger als die Hälfte** wirklich einen Menschen.
70 Punkte (bzw. Punktteile) sind vollständig maschinell prüfbar — 33 davon ohne jede
Vorbereitung, 37 weitere mit laufendem Dev-Server und zwei lokal anlegbaren Testkonten.
Was übrig bleibt, sind 58 Sichtprüfungen und 44 fachliche Festlegungen, die niemand außer dem
Anwender treffen kann.
**Ergebnis: aus 6,8 Stunden werden 3,0 Stunden** — und mit funktionierendem Playwright noch
einmal 1,6 Stunden weniger.

---

## 2. Zusammenfassung nach Kategorien

Viele Punkte enthalten zwei Fragen in einem Satz — „erscheint die Meldung?" und „ist sie
verständlich?". Solche Punkte sind hier geteilt (Suffix `a`/`b`). Aus **128 Rohpunkten**
werden dadurch **172 Zeilen**.

| Kategorie | Zeilen | Anteil | Was das heißt |
|---|---:|---:|---|
| **AUTO** | 33 | 19 % | Läuft ohne Menschen und ohne Server — Skript, SQL-Abfrage, Testlauf, Prüfsumme |
| **AUTO-MIT-SERVER** | 37 | 22 % | Läuft ohne Menschen, aber mit `npm run dev` auf Port 3000 und angemeldeter Sitzung |
| **AUGEN** | 58 | 34 % | Braucht einen sehenden Menschen — Farbe, Kontrast, Fokus, Tastatur, Verständlichkeit |
| **ENTSCHEIDUNG** | 44 | 26 % | Eine fachliche Festlegung des Anwenders, keine Prüfung |
| **Summe** | **172** | | aus 128 Rohpunkten (44 geteilte Punkte) |

Verteilung über die Phasen:

| Phase | Rohpunkte | Zeilen | AUTO | AUTO-MIT-SERVER | AUGEN | ENTSCHEIDUNG |
|---|---:|---:|---:|---:|---:|---:|
| 11 | 9 | 12 | 1 | 5 | 3 | 3 |
| 12 | 51 | 61 | 11 | 12 | 30 | 8 |
| 13 | 29 | 37 | 5 | 10 | 12 | 10 |
| 14 | 9 | 14 | 5 | 2 | 4 | 3 |
| 14.1 | 30 | 48 | 11 | 8 | 9 | 20 |
| **Summe** | **128** | **172** | **33** | **37** | **58** | **44** |

### Was das an Zeit spart

Die Zeitansätze stammen aus `14-UAT-SITZUNG.md` (Gruppe A: 3 min/Punkt, B: 12 min, C: 20 min,
D: 3 min). Regel für die Restzeit: ein vollständig maschineller Punkt kostet den Anwender
0 Minuten, ein geteilter Punkt den halben Ansatz, ein reiner AUGEN- oder ENTSCHEIDUNG-Punkt den
vollen. Für einen B-Punkt, von dem nur noch die Festlegung übrig ist, gilt der
Durchsprache-Ansatz von 3 Minuten statt der 12 Minuten für den Skriptlauf.

| Gruppe | Punkte | Bisher | Bleibt für den Anwender | Ersparnis |
|---|---:|---:|---:|---:|
| A — am Dev-Server | 61 | 183 min | **109,5 min** | 73,5 min |
| B — gegen die Produktionskopie | 13 | 156 min | **9 min** | 147 min |
| D — Festlegungen | 23 | 69 min | **63 min** | 6 min |
| **A + B + D (das eine Sitzungsfenster)** | **97** | **408 min ≈ 6,8 Std.** | **181,5 min ≈ 3,0 Std.** | **3,8 Std. (56 %)** |
| C — nach dem Release (eigenes Fenster) | 1 | 20 min | 10 min | 10 min |

**Der große Gewinn liegt in Gruppe B.** Elf der dreizehn Punkte sind Saldenvergleiche,
Migrationsprüfungen und Kettenprüfungen gegen eine Datenbankkopie — genau das, wofür bereits
`snapshotBalances`, `verifyPeriodNullEffect`, `check:period-chains` und
`verifyBalanceVsJournal` im Repo liegen. Von 2,6 Stunden bleiben 9 Minuten Durchsprache übrig:
die vier Werte des realen Umstellungsfalls nennen, die Freigabe erteilen, und im Fall
unzulässiger `referenceType`-Werte einmal Ja sagen.

### Die 30 Punkte der Phase 14.1 kommen noch dazu

`14-UAT-SITZUNG.md` kennt sie noch nicht — sie wurden erst am 25.08.2026 an die Sammlung
angehängt. Mit dem A/D-Ansatz von 3 Minuten je Punkt sind das 90 Minuten Rohaufwand.
Zwei Drittel davon sind Entscheidungen und Kenntnisnahmen, die sich nicht wegautomatisieren
lassen; maschinell abnehmbar ist vor allem das Zahlenwerk darunter.

| | Punkte | Bisher | Bleibt |
|---|---:|---:|---:|
| Phase 14.1 | 30 | 90 min | **73,5 min** |

**Gesamtbild mit Phase 14.1:** 498 Minuten (8,3 Std.) → **255 Minuten (4,25 Std.)**.
Mit funktionierendem Playwright: **rund 160 Minuten (2,7 Std.)**.

---

## 3. Vollständige Tabelle aller Punkte

Legende Kategorie: **A** = AUTO · **AS** = AUTO-MIT-SERVER · **AU** = AUGEN · **E** = ENTSCHEIDUNG.
Bei AUGEN-Punkten steht in Klammern, ob funktionierendes Playwright sie zu AUTO machen würde:
`PW: ja` (vollständig), `PW: teilweise` (der messbare Teil ja, das Urteil nicht), `PW: nein`.

### Phase 11 — Datumsabhängige Berechnung

| ID | Kurzfassung | Kat. | Prüfweg |
|---|---|---|---|
| 11-U1a | DATEV-Export enthält die Zeilen des soft-gelöschten Nutzers | AS | Als Admin `GET /api/reports/datev?from=…&to=…` abrufen, CSV-Zeilen mit `userId=15` zählen und gegen `SELECT COUNT(*) FROM time_entries WHERE userId=15 AND date BETWEEN …` abgleichen — erwartet: identische Zahl (14 laut Sammlung) |
| 11-U1b | Der DATEV-Importweg nimmt die Datei an; ist das fachlich gewünscht (GoBD)? | AU | Externes System, kein Zugriff — der Anwender importiert die Datei einmal (PW: nein) |
| 11-U2a | Lückenhafte Periodenkette → HTTP 409 | AS | Nutzer mit Kettenlücke per SQL suchen, Export für dessen Zeitraum anstoßen — erwartet: Status 409, Fehlercode im Antwortkörper, keine Datei |
| 11-U2b | Ist die 409-Meldung in der Oberfläche verständlich? | AU | Sichtprüfung am Bildschirm (PW: teilweise — dass eine Meldung erscheint und nicht der Rohcode, ist maschinell prüfbar; ob sie verständlich ist, nicht) |
| 11-U3 | `GET /api/admin/period-chains`: Admin 200, Nicht-Admin 403 | AS | Zwei `curl`-Aufrufe mit den Sitzungscookies zweier Konten — erwartet: Admin 200 mit Befundliste, Mitarbeiter 403. **Konten:** Admin + Mitarbeiter, beide lokal per `npm run seed:test-users` anlegbar |
| 11-U4 | `validate:overtime:detailed`, vierter Vergleichsweg (Frontend-API) | AS | `npm run validate:overtime:detailed -- --userId=<Modellwechsel-Nutzer> --month=2026-08` bei laufendem Server — erwartet: alle vier Wege PASSED, Exit 0. **Konto:** keines nötig (Skript liest direkt), Server muss laufen |
| 11-U5a | Sollstunden vor/nach dem Stichtag entsprechen den serverseitigen Werten | AS | `GET /api/reports/overtime/user/<id>?year&month` für den Monat vor und nach dem Stichtag, Abgleich mit der Ausgabe von `validate:overtime:detailed` — erwartet: identische Sollstunden (8h bzw. 4h) |
| 11-U5b | Die Desktop-Oberfläche zeigt genau diese Zahlen an | AU | Live-Anzeige und Kontoauszug ansehen (PW: ja) |
| 11-U6 | Generalprobe des Rechenwegs auf einer Produktionskopie | A | Zusammengeführt mit 13-U11 — siehe dort |
| 11-F1 | Eintrittsdatum nach hinten: Kette bleibt stehen | E | Durchsprache |
| 11-F2 | Migrationsskript bricht bei Datendefekt ab | E | Durchsprache |
| 11-F3 | DATEV-Export bricht mit 409 ab statt Nutzer wegzulassen | E | Durchsprache |

### Phase 12 — Stundenwechsel bedienen

| ID | Kurzfassung | Kat. | Prüfweg |
|---|---|---|---|
| P12-1 | Migration 011: Zeilenzahl `overtime_transactions` identisch, `integrity_check` = ok | A | Arbeitskopie von `14-produktionskopie.db` ziehen (Original bleibt readonly), `SELECT COUNT(*)` vor dem Lauf notieren, `npm run migrate:copy` gegen die Kopie, danach Zeilenzahl erneut und `PRAGMA integrity_check` — erwartet: gleiche Zahl, `ok` |
| P12-2 | `GET /api/work-periods` gegen fremde `userId` → 403, leerer Körper | AS | Mitarbeiter anmelden, mit dessen Cookie die `userId` eines anderen Nutzers abfragen — erwartet: 403, keine Perioden im Körper. **Konten:** Mitarbeiter (lokal anlegbar); echte Produktionspasswörter sind für die Rollenprüfung nicht nötig, der Server gegen die Kopie gestartet genügt |
| P12-3a | Backdrop-Klick und ESC schließen das bestehende Modal wie in v1.8.0 | AU | Bedienprüfung (PW: ja) |
| P12-3b | Erscheinungsbild hell/dunkel unverändert, kein Flackern beim Portal-Rendering | AU | Sichtprüfung — Flackern ist ein Zeitverhalten des Auges (PW: nein) |
| P12-4a | `ConfirmDialog`: X-Button trägt einen zugänglichen Namen | A | `npx tsx desktop/src/components/ui/confirmDialogProps.check.ts` — das Prüfskript der Phase 13 belegt die Props; erwartet: alle Zusicherungen grün |
| P12-4b | ESC schließt den `ConfirmDialog`, „Löschen"/„Abbrechen" unverändert | AU | Bedienprüfung (PW: ja) |
| P12-5 (+31) | Zwei gestapelte Dialoge: ESC schließt nur den obersten, Eingaben bleiben, z-Index stimmt | AU | Bedienprüfung (PW: ja — Sichtbarkeit, Feldinhalte und `z-index` sind maschinell auslesbar) |
| P12-6 | Fokus landet nach dem Schließen auf dem auslösenden Element | AU | Läuft im Tastaturdurchgang P12-22 mit (PW: ja — `document.activeElement`) |
| P12-7 | X-Button beider Dialogtypen wird als „Dialog schließen"/„Abbrechen" angesagt | AU | Screenreader (PW: ja — der zugängliche Name ist über die Rollenabfrage prüfbar; die Ansage selbst ist dann redundant) |
| P12-8 | Fokusfalle: Tab springt vom letzten zum ersten Element zurück | AU | Läuft im Tastaturdurchgang P12-22 mit (PW: ja) |
| P12-9 | `applyWorkTimeChange()` unter 10 Sekunden bei vielen Zeiteinträgen | A | `npx tsx`-Skript gegen die Arbeitskopie: Nutzer mit den meisten `time_entries` per SQL bestimmen, `applyWorkTimeChange()` rückwirkend aufrufen, Dauer messen — erwartet: < 10 000 ms |
| P12-10 | Abgebrochener Speichervorgang hinterlässt weder Periode noch `model_change`-Buchung | A | `npx tsx`-Skript gegen die Arbeitskopie: `applyWorkTimeChange()` innerhalb der Transaktion gezielt scheitern lassen, danach `SELECT COUNT(*) FROM user_work_periods` und `… FROM overtime_transactions WHERE referenceType='model_change'` — erwartet: beide unverändert |
| P12-11 | `previewToken` überlebt einen Serverneustart | AS | Vorschau abrufen, Token merken, Server neu starten, mit demselben Token speichern — erwartet: 200, keine `PREVIEW_STALE`-Antwort. **Konto:** Admin |
| P12-12 | Kein Rundungsfehler bei `balanceDelta`/`targetHoursDelta` über Monatsgrenzen | A | Vorschau für einen mehrmonatigen rückwirkenden Zeitraum erzeugen, `balanceDelta` gegen die Summe der Monatsdeltas aus `validate:overtime:detailed` je betroffenem Monat stellen — erwartet: Differenz 0,00 h |
| P12-13 | Kontrast Periodenliste (Badges, Tabellentexte) hell/dunkel | AU | Sichtprüfung im Kontrastdurchgang 13-U9 (PW: teilweise — Kontrastwerte messbar, „mindestens so gut wie" nicht) |
| P12-14 | Periodenliste unter 640 px horizontal scrollbar, nichts abgeschnitten | AU | Sichtprüfung (PW: ja — Viewport setzen, `scrollWidth`/`clientWidth` vergleichen) |
| P12-15a | Reihenfolge und Zuordnung „Aktuell"/„Geplant" stimmen in den Daten | AS | `GET /api/work-periods?userId=…` für einen Nutzer mit mehreren Perioden — erwartet: absteigend nach `validFrom`, genau eine Periode mit heutiger Gültigkeit, künftige als geplant markiert |
| P12-15b | Die Badges stehen sichtbar an der richtigen Zeile | AU | Sichtprüfung (PW: ja) |
| P12-16 | Fehlertext und „Perioden erneut laden" bei gestopptem Server | AU | Bedienprüfung (PW: ja — Netzwerkantwort abfangen) |
| P12-17 | Vorschau→Speichern: Kontoauszugssaldo = notierter Vorschauwert | AS | Server gegen die Arbeitskopie starten, Vorschau abrufen und Wert notieren, speichern, `GET /api/work-time-accounts/<id>` — erwartet: identischer Saldo. **Konto:** Admin |
| P12-18 | Kein Saldo-Seiteneffekt auf unbeteiligte Nutzer | A | Zusammengeführt mit 13-U11 — siehe dort |
| P12-19 | `checkAllPeriodChains()` gegen die Kopie: kein Befund | A | `DATABASE_PATH=<Arbeitskopie> npm run check:period-chains` nach dem Wechsel aus 13-U11 — erwartet: Befundliste leer, Exit 0 |
| P12-20 | `PREVIEW_STALE` im Wechsel-Dialog als deutscher Satz | AU | Zusammengeführt mit 13-U18 (PW: ja) |
| P12-21 | Hervorgehobene Saldoänderung ist das dominante Element | AU | Sichtprüfung im Kontrastdurchgang (PW: teilweise — Kontrast/Schriftgewicht messbar, Dominanzurteil nicht) |
| P12-22 (+6, +8) | Ein Durchgang ausschließlich mit der Tastatur | AU | Bedienprüfung (PW: ja — Anfangsfokus, Tab-Reihenfolge, Wickeln, ESC, Fokusrückgabe sind alle maschinell prüfbar) |
| P12-23a | Rückwirkender Wechsel mit Differenz 0 rechnet auf 0 | A | Vorschau mit gleichen alten und neuen Wochenstunden erzeugen — erwartet: `balanceDelta = 0`, `targetHoursDelta = 0` |
| P12-23b | „± 0:00h"-Anzeige und Nulldifferenz-Textvariante erscheinen | AU | Sichtprüfung (PW: ja — Textvergleich) |
| P12-24 | Unter 640 px stehen Stichtag/Wochenstunden und Kennzahlen untereinander | AU | Sichtprüfung (PW: ja — Bounding-Boxen vergleichen) |
| P12-25a | Nach 15 Minuten läuft das Token ab und der Server antwortet mit `PREVIEW_STALE` | AS | Vorschau abrufen, warten (oder Token mit abgelaufenem Zeitstempel senden), speichern — erwartet: Fehlercode `PREVIEW_STALE`. **Konto:** Admin |
| P12-25b | Automatische Neuberechnung beim ersten Fehlschlag, sauberer Fehlerzustand beim zweiten | AU | Bedienprüfung (PW: ja) |
| P12-26a | Nutzer ohne Periode: die API liefert kein Periodenobjekt | AS | Frisch angelegten Nutzer abfragen — erwartet: leere Periodenliste, `hireDate` gesetzt |
| P12-26b | Infopanel zeigt „Aktuell gültig seit {Eintrittsdatum}" | AU | Sichtprüfung (PW: ja) |
| P12-27 | Kontrast des schreibgeschützten Wochenstundenfelds ≥ 4,5:1, kein `opacity` | AU | Sichtprüfung im Kontrastdurchgang (PW: teilweise — Kontrastwert und `opacity` messbar) |
| P12-28 | Vollständiger Bedienfluss Bearbeiten → Wechsel-Dialog → Vorschau → Speichern → Banner | AU | Bedienprüfung (PW: ja — das ist ein E2E-Fall wie er im Buch steht) |
| P12-29a | Kontoauszug führt die `model_change`-Zeile mit Betrag, Begründung und echtem Admin-Namen | AS | `GET /api/work-time-accounts/<id>` nach dem Wechsel — erwartet: eine Zeile `referenceType='model_change'` mit `hours ≠ 0`, `reason` gesetzt, `createdBy` = Name des anmeldenden Admins |
| P12-29b | Teal-Badge, Vorzeichen, Trendpfeil und zweite Zeile sehen richtig aus | AU | Sichtprüfung (PW: ja) |
| P12-30a | Nutzerverwaltung: Anlegen, Löschen, Deaktivieren, Passwort-Reset antworten unverändert | AS | Vier API-Aufrufe als Admin gegen einen Wegwerf-Nutzer, danach Zustand per SQL prüfen — erwartet: 200/201, `deletedAt` gesetzt statt Zeile weg, `status` geändert, neuer Passworthash. **Konto:** Admin |
| P12-30b | Die Bedienwege in der Oberfläche verhalten sich wie in v1.8.0 | AU | Bedienprüfung (PW: ja) |
| P12-31 | z-Index-Stapelung `ConfirmDialog` > Wechsel-Dialog > `EditUserModal` | AU | Zusammengeführt mit P12-5 (PW: ja) |
| P12-32 | Abwesenheitsantrag über einen Stichtag: Vorschauwert = gebuchter Wert | AS | Vorschau abrufen, Antrag anlegen und genehmigen, Journalzeilen des Zeitraums summieren — erwartet: identische Stundenzahl. Rechnerischer Randfall Stichtag mitten im Zeitraum. **Konten:** Mitarbeiter (Antrag) + Admin (Genehmigung) |
| P12-33 | Abwesenheitsantrag über einen Feiertag zählt diesen nicht als Arbeitstag | AS | Vorschau für einen Zeitraum mit Feiertag abrufen, gegen `SELECT` auf `holidays` und die Arbeitstage rechnen — erwartet: Feiertag trägt 0 h bei |
| P12-34 | Server nicht erreichbar: kein Zahlenanspruch, Hinweistext, Antrag bleibt absendbar | AU | Bedienprüfung (PW: ja — Netzwerkantwort abfangen) |
| P12-35a | `WorkScheduleDisplay` bekommt das `validFrom` der heute gültigen Periode geliefert | AS | Periodenabfrage für einen Mehrperioden-Nutzer — erwartet: die als aktuell gemeldete Periode ist die mit dem größten `validFrom` ≤ heute |
| P12-35b | Die Zeile „Aktuell gültiges Modell seit …" zeigt genau dieses Datum | AU | Sichtprüfung (PW: ja) |
| P12-36 | Soll der kompakte Modus eine Stichtag-Zeile bekommen? | E | Durchsprache |
| P12-37 | E2E-Test „Change employee to 0 hours" | AU | Ersetzt durch P12-48 (PW: ja) |
| P12-38 | Die übrigen sieben `button[aria-label="Bearbeiten"]`-Selektoren | AU | Ersetzt durch P12-48 (PW: ja) |
| P12-39 | Vollständiger Playwright-Lauf `user-edit.spec.ts` | AU | Ersetzt durch P12-48 (PW: ja) |
| P12-40a | Bestandsdaten `referenceType` vor Migration 012 erheben | A | `sqlite3 <Arbeitskopie> "SELECT referenceType, COUNT(*) FROM overtime_transactions GROUP BY referenceType;"` — erwartet: nur die fünf erlaubten Werte plus `NULL`; jeder andere Wert ist ein Befund für 40b |
| P12-40b | Falls unzulässige Werte auftauchen: „auf NULL setzen" bestätigen | E | Durchsprache — nur nötig, wenn 40a etwas findet |
| P12-41 | Ist „Beginn des Vorjahres" die richtige Rückwirkungsgrenze? | E | Durchsprache |
| P12-42 | Rate-Limit `/preview` im Realbetrieb | AS | Zusammengeführt mit 13-U17 — siehe dort |
| P12-43 | Braucht `previewToken` echten Einmalverbrauch? | E | Durchsprache (Architekturentscheidung) |
| P12-44 | Rückwirkender Wechsel zieht `overtime_balance`-Zeilen jenseits von heute mit | A | Gegen die Arbeitskopie: Nutzer mit genehmigtem Urlaub im nächsten Quartal per SQL suchen, dessen `overtime_balance`-Zeilen für Zukunftsmonate vor und nach `applyWorkTimeChange()` vergleichen — erwartet: Sollstunden dieser Zeilen auf das neue Modell nachgezogen |
| P12-45 | Soll die Begründung auch im Schreibweg getrimmt werden? | E | Durchsprache |
| P12-46 | Anfangsfokus bei `EditUserModal`/`TimeEntryForm`/`AbsenceRequestForm` | E | Durchsprache |
| P12-47 | Kontrast der drei neuen Kontoauszugselemente ≥ 4,5:1 | AU | Sichtprüfung im Kontrastdurchgang (PW: teilweise) |
| P12-48 (+37, +38, +39) | E2E-Suite `user-edit.spec.ts` einmal wirklich laufen lassen | AU | Heute nur als manueller Nachvollzug des Bedienpfads möglich (PW: **ja** — `npx playwright test tests/user-edit.spec.ts` gegen `localhost:1420`; dieser eine Punkt ist der Hauptgrund, Playwright überhaupt zu reparieren) |
| P12-49 | Typ-Spalte des Kontoauszugs zeigt Rohwerte statt deutscher Bezeichnungen | A | `sqlite3 … "SELECT DISTINCT referenceType FROM overtime_transactions;"` gegen die Typ-Union in `desktop/src/hooks/useWorkTimeAccounts.ts` stellen — erwartet (Befund bestätigt sich): `time_entry` und `unpaid_deduction` fehlen dort und erscheinen unübersetzt |
| P12-50 | Eigene Formulierung für die verweigerte Abwesenheitsvorschau? | E | Durchsprache |
| P12-51 | Soll der Grund bei einer Krankmeldung Pflichtfeld werden? | E | Durchsprache |

### Phase 13 — Korrigieren und rückgängig machen

| ID | Kurzfassung | Kat. | Prüfweg |
|---|---|---|---|
| 13-U1a | Die Vorschau meldet Rückwirkung mit konkretem Zeitraum | AS | Korrektur-Vorschau für eine Periode abrufen, die die Vergangenheit berührt — erwartet: Rückwirkungskennzeichen gesetzt, Zeitraum und Saldoänderung als Zahlen im Antwortkörper. **Konto:** Admin |
| 13-U1b | Amberfarbenes Banner, Ausweg-Satz 3, Saldoänderung als einziger Blickfang | AU | Sichtprüfung (PW: teilweise — Farbe und Textbausteine messbar, Blickfang-Urteil nicht) |
| 13-U2a | Vollständig zukünftige Periode: keine Rückwirkung, Speichern ohne Bestätigungsschritt | AS | Vorschau für eine Zukunftsperiode abrufen und direkt speichern — erwartet: Rückwirkungskennzeichen `false`, Speichern gelingt ohne zusätzlichen Bestätigungsschritt |
| 13-U2b | Blaues Panel „Keine Rückwirkung" erscheint statt des Warnbanners | AU | Sichtprüfung (PW: ja) |
| 13-U3a | Sperrregeln der Löschbestätigung (Vorschau lädt / Begründung < 10 Zeichen) | A | `npx tsx desktop/src/components/worktime/workTimePeriodDeleteRules.check.ts` — erwartet: alle Zusicherungen grün, Sperrzustand für beide Bedingungen belegt |
| 13-U3b | Die drei `details`-Punkte erscheinen in der Reihenfolge Lückenschluss/Storno/Saldoänderung | AU | Sichtprüfung (PW: ja — Reihenfolge der Listenelemente auslesbar) |
| 13-U4a | Nach gescheiterter Löschvorschau ist nichts gelöscht | AS | Vorschau während des Laufs abbrechen, danach `SELECT deletedAt FROM user_work_periods WHERE id=…` — erwartet: `NULL`, Zeile unverändert |
| 13-U4b | Punkt 3 wird zum Fehlertext, der Bestätigungsknopf bleibt gesperrt | AU | Sichtprüfung (PW: ja) |
| 13-U5a | Storno-Paar in den Daten: zwei Zeilen, gemeinsame Belegnummer, spiegelbildliche Beträge | AS | Nach dem Löschvorgang `GET /api/work-time-accounts/<id>` — erwartet: Ursprungsbuchung und Gegenbuchung, gleiche Belegnummer (`reversalOf` = Id der Ursprungsbuchung), Summe der beiden = 0,00 h |
| 13-U5b | Beide teal, graue Zustands-Badges, Klick auf den Beleg-Chip springt und hebt 2 s hervor | AU | Sichtprüfung (PW: ja) |
| 13-U6 | Beleg-Chip zeigt Erklärtext statt stillem Klick, wenn die Partnerzeile abgeschnitten ist | AU | Sichtprüfung eines konstruierten Randfalls (PW: ja) |
| 13-U7a | Mitarbeiter bekommt für einen fremden Nutzer 403 auf die Periodenliste | AS | Deckt sich mit P12-2 — Mitarbeiter-Cookie gegen fremde `userId`, erwartet 403 |
| 13-U7b | Graues Panel „Kein Zugriff" mit Schloss statt rotem Fehler-Toast | AU | Sichtprüfung (PW: ja — Panel vorhanden, Toast abwesend) |
| 13-U8 | Chip „Nicht löschbar" per Tab erreichbar, Tooltip bei Fokus, ESC schließt nur den Tooltip | AU | Tastaturbedienung (PW: ja) |
| 13-U9 (+P12-13, 21, 27, 47) | Ein Durchgang Dunkelmodus und Kontrast über alle neuen Flächen | AU | Sichtprüfung, hell und dunkel (PW: teilweise — die Kontrastwerte aller Flächen sind mit einem Prüflauf messbar, das Urteil „mindestens so gut wie Phase 12" bleibt menschlich) |
| 13-U10 | Unter 640 px: Zeilenaktionen nur als Symbole, Trefferfläche ≥ 32 × 32 px, Knopf über volle Breite | AU | Sichtprüfung (PW: ja — Bounding-Boxen sind exakt messbar) |
| 13-U11 (+11-U6, +P12-18) | Generalprobe: Umstellung eintragen, löschen, alle Salden dreimal vergleichen | A | Gegen eine Arbeitskopie von `14-produktionskopie.db`: `npm run snapshot:balances` (Snapshot 1) → Umstellung per `npm run apply:model-change` → Snapshot 2 → Periode löschen → Snapshot 3; `diff` der `*.users.json` — erwartet: zwischen 1 und 2 ändert sich **ausschließlich** der betroffene Nutzer, Snapshot 3 ist bei diesem Nutzer identisch mit Snapshot 1. Ergänzend `npm run verify:period-nulleffect`. **Abbruchregel 1 der Sitzung hängt an diesem Diff** |
| 13-U12a | Login und Laden der Perioden-/Kontoauszugsliste funktionieren nach der `client.ts`-Bereinigung | AS | `POST /api/auth/login` → 200 mit Sitzungscookie, danach `GET /api/work-periods` und `GET /api/work-time-accounts` → je 200 mit gefüllter Liste |
| 13-U12b | Keine Konsolen-Fehlermeldung ersetzt den entfernten Code | AU | Entwicklerkonsole ansehen (PW: ja — Konsolenausgaben lassen sich mitschneiden und auf Leere prüfen) |
| 13-U13 | `aria-label` des Löschbestätigungsknopfs nennt die Periode konkret | A | `npx tsx desktop/src/components/worktime/workTimePeriodDeleteRules.check.ts` bzw. `confirmDialogProps.check.ts` — erwartet: der gebildete Name enthält das Periodendatum, nicht nur „Bestätigen" |
| 13-U14 | Migration 015: eindeutiger Index auf `reversalOf`, `integrity_check`, `foreign_key_check` | A | Arbeitskopie ziehen, Zeilenzahlen der betroffenen Tabellen notieren, `npm run migrate:copy` (bzw. Serverstart mit `DATABASE_PATH` auf die Kopie), danach `PRAGMA integrity_check` → `ok`, `PRAGMA foreign_key_check` → **keine Zeile**, `PRAGMA index_list(overtime_transactions)` → der Index auf `reversalOf` ist als `unique` geführt, Zeilenzahlen unverändert. **Abbruchregeln 2 und 3 hängen hier** |
| 13-U15 | Ehemals tödlicher Ablauf: 40→32, Korrektur zurück auf 40, Periode löschen | A | `npx tsx`-Skript gegen die Arbeitskopie: die drei Aufrufe nacheinander — erwartet: kein 500, Löschen gelingt, Exit 0. Alternativ dieselben drei Schritte über die API (dann AUTO-MIT-SERVER) |
| 13-U16 | Korrektur ohne Saldowirkung erzeugt trotzdem eine Journalzeile mit Begründung | AS | Tagesplan bei gleicher Wochensumme umverteilen und speichern, danach Kontoauszugsabfrage — erwartet: neue Journalzeile mit `reason`, Saldodifferenz 0,00 h. **Konto:** Admin |
| 13-U17 (+P12-42) | Kein `429` bei normalem Bedientempo im 7-Feld-Tagesplan | AS | Sieben `POST` auf die Vorschau-Route im Abstand von ~1 s mit derselben Admin-Sitzung — erwartet: alle 200; zur Belegung der Grenze zusätzlich 31 Aufrufe in einer Minute → der 31. antwortet 429. **Konto:** Admin |
| 13-U18a (+P12-20) | Der Server meldet `PREVIEW_STALE` in beiden Dialogwegen | AS | Vorschau in Wechsel-Dialog und Löschbestätigung veralten lassen, dann speichern — erwartet: beide Male derselbe Fehlercode |
| 13-U18b | An der Oberfläche steht ein lesbarer deutscher Satz, nicht der Code | AU | Sichtprüfung (PW: ja — die Prüfung „der angezeigte Text enthält nicht die Zeichenfolge `PREVIEW_STALE`" ist maschinell; ob der Satz gut ist, bleibt menschlich) |
| 13-U19 | Storno-Paar mit Zukunftsdatum bleibt im Kontoauszug sichtbar | AS | Paar mit Datum in der Zukunft anlegen, Kontoauszugsabfrage — erwartet: beide Zeilen in der Antwort enthalten |
| 13-F1 … 13-F10 | Zehn fachliche Festlegungen aus Phase 13 | E | Durchsprache (je eine Zeile: erste Periode nicht löschbar; keine Wiederherstellung; Belegnummer = Ursprungsbuchung; Mehrzahlform; Kettenriegel kurz ausgesetzt; `deletedBy`; Amber statt Gelb; Pflichtbegründung; `checkPeriodChain()` unbedingt; `reversedAt`-Formatierung) |

### Phase 14 — Absicherung und Auslieferung

| ID | Kurzfassung | Kat. | Prüfweg |
|---|---|---|---|
| 14-U1a | Die vier Werte des realen Umstellungsfalls benennen | E | Der Anwender nennt Nutzer-Id/Name, Stichtag, alte und neue Wochenstunden |
| 14-U1b | Den benannten Fall eintragen und gegen die Erwartung prüfen | A | Sobald 14-U1a vorliegt: gegen die Arbeitskopie `npm run apply:model-change -- --userId=… --validFrom=… --weeklyHours=…`, davor und danach `npm run snapshot:balances`, Abgleich mit `validate:overtime:detailed` — erwartet: exakt die vier vorab genannten Werte |
| 14-U2a | Freigabeunterlagen: Sicherung vorhanden und rückspielbar, Deployment grün, Trockenlauf gesichtet | A | Sicherung per `PRAGMA integrity_check` prüfen und in eine Wegwerfkopie zurückspielen (der Restore-Nachweis liegt mit `14.1-restore-probe.db` bereits vor); `gh run list --workflow="deploy-server.yml" --limit 1` → `completed`/`success`; `curl -s http://129.159.8.19:3000/api/health` → `{"status":"ok","database":"connected"}`; Trockenlauf ohne `--apply` ausführen und Ausgabe sichern |
| 14-U2b | Freigabe für `--apply` erteilen | E | Der Anwender gibt frei — kein Produktionslauf ohne dieses Ja |
| 14-U3a | `latest.json` trägt alle vier Plattformschlüssel mit `url` und `signature` | A | Nach dem Release `gh release view v1.X.Y --json assets`, `latest.json` herunterladen und als JSON prüfen — erwartet: `darwin-aarch64`, `darwin-x86_64`, `linux-x86_64`, `windows-x86_64`, jeweils mit gesetzter `url` und `signature` |
| 14-U3b | Eine installierte Alt-Version zieht das Update selbsttätig | AU | Echte Installation starten und warten (PW: nein — der Tauri-Updater lebt außerhalb des Browsers) |
| 14-U4 | WR-07 als bekannter Restposten mitnehmen oder vorher schließen | E | Durchsprache — die Verhaltensprüfung selbst läuft unter 14-U9 |
| 14-U5a | Die fünf Phase-13-UI-Korrekturen, soweit als Regel prüfbar | AS | M-1: prüfen, dass „rückwirkend ja/nein" aus der Server-Vorschau stammt (Vorschauantwort gegen den Dialogzustand stellen); M-3/M-5 über `npx tsx desktop/src/components/worktime/workTimePeriodEditRules.check.ts` und `…DeleteRules.check.ts` — erwartet: alle Zusicherungen grün |
| 14-U5b | Tooltip, Feldfehler mit Fokus, gesperrter Korrekturblock, fette Zahl — sichtbar richtig | AU | Sichtprüfung (PW: ja) |
| 14-U6 | Die sechs Phase-12-UI-Korrekturen (Scrollen, Platzhalter, Zeilenmarkierung, Toggle, Farbflächen) | AU | Sichtprüfung (PW: teilweise — Scrollverhalten, Platzhaltertext und Toggle-Rolle sind maschinell prüfbar; „höchstens vier blaue Flächen" ist eine Zählung nach Augenmaß) |
| 14-U7 | B-2-Sicherheitsfix ist durch fünf neue Tests belegt | A | `cd server && npx vitest run` — erwartet: 491 grün / 3 rot mit unveränderter roter Menge |
| 14-U8 | REQ-32: fünf Wechselfälle einzeln nachgewiesen | A | `cd server && npx vitest run -t "<Titel>"` je Fall laut `14-REQ32-NACHWEIS.md` — erwartet: je 1 passed. Deckt die rechnerischen Randfälle Stichtag mitten im Monat und Wechsel über den Jahreswechsel ab |
| 14-U9a | `PUT /api/users/:id`: unveränderte Stammdaten 200, echte Stundenänderung 400 | AS | Zwei Aufrufe als Admin — einmal mit unverändertem `weeklyHours`, einmal mit geändertem — erwartet: 200 bzw. 400 mit Verweis auf den Wechsel-Weg. **Konto:** Admin |
| 14-U9b | Der Admin wird in der Oberfläche zum Wechsel-Dialog geleitet | AU | Sichtprüfung (PW: ja) |

### Phase 14.1 — Rechenwerk-Blocker aus dem Produktionslauf

| ID | Kurzfassung | Kat. | Prüfweg |
|---|---|---|---|
| 14.1-U1a | Zeitkonto-Saldo = Summe der Buchungen (Nutzer ohne Abwesenheit) | A | `npm run verify:balance-vs-journal` für die Nutzer 18, 20, 21, 25 im laufenden Monat — erwartet: Differenz 0,00 h bei allen vier (vor dem Fix 20,00 h bzw. 6,40 h) |
| 14.1-U1b | Beide Zahlen stehen so auch auf dem Bildschirm nebeneinander | AU | Sichtprüfung (PW: ja) |
| 14.1-U2a | Künftiger Monat erzeugt keine Minusstunden für noch nicht stattgefundene Tage | AS | Kontoauszugsabfrage für den Folgemonat — erwartet: keine Buchung mit Datum > heute, Saldo unverändert gegenüber dem laufenden Monat |
| 14.1-U2b | Die Darstellung des Zukunftsmonats ist unauffällig | AU | Sichtprüfung (PW: ja) |
| 14.1-U3 | Wie sollen Urlaubs-/Krankheitstage im Kontoauszug erscheinen (Gegenbuchung oder `hours: 0`)? | E | Durchsprache — Weg 1 oder Weg 2 |
| 14.1-U4 | Kenntnisnahme: erstes Erfolgskriterium erst mit 14.1-U3 vollständig erfüllt | E | Durchsprache; der Zahlenbeleg (9 → 3 Nutzer) läuft unter 14.1-U1a mit |
| 14.1-U5 | Nachsynchronisieren oder Neuberechnung hinter das `DELETE` ziehen? | E | Durchsprache — Weg 1 oder Weg 2 |
| 14.1-U6a | Gelöschter Urlaub verschwindet aus dem Journal | AS | Genehmigten Urlaub per API löschen, danach Kontoauszugsabfrage — erwartet: 200 und **null** Journalzeilen dieses Antrags (vorher 2) |
| 14.1-U6b | Die Oberfläche zeigt das ohne Umweg, und die Erfolgsmeldung stimmt | AU | Sichtprüfung (PW: ja) |
| 14.1-U7a | Nach dem Löschen einer Krankmeldung bewegt sich der Saldo sofort | AS | Saldo aus `work_time_accounts` vor und nach dem `DELETE` lesen — erwartet: Differenz ≠ 0 (mit dem unter 14.1-U5 beschriebenen Rest von einem Tagessoll) |
| 14.1-U7b | Die Bewegung ist am Mitarbeiterbildschirm sichtbar | AU | Sichtprüfung (PW: ja) |
| 14.1-U8 | Nachsynchronisieren oder Cache aus der Fortschreibung nehmen? | E | Durchsprache — sinnvollerweise dieselbe Entscheidung wie 14.1-U5 |
| 14.1-U9a | Neu angelegte Krankmeldung erzeugt sofort die Gutschriftszeile | AS | Krankmeldung für einen vergangenen Tag anlegen, danach Kontoauszugsabfrage — erwartet: eine `sick_credit`-Zeile über das Tagessoll (0 → 1 Zeile, +8,00 h) |
| 14.1-U9b | Die Gutschrift steht ohne Zwischenschritt im Kontoauszug | AU | Sichtprüfung (PW: ja) |
| 14.1-U10 | Kenntnisnahme: Krankmeldung bleibt auto-genehmigt | E | Durchsprache; Beleg maschinell: `npx vitest run sickLeaveRecalc` (Tests 2–4) |
| 14.1-U11 | Historien-Export: 102 Zeiteinträge stillgelegter Konten behalten oder filtern? | E | Durchsprache — Weg 1 oder Weg 2 |
| 14.1-U12a | Abgelehnte Anträge stehen nicht mehr im Historien-Export | AS | Export über einen Zeitraum mit abgelehnten Anträgen anstoßen, die erzeugte Datei gegen `SELECT id FROM absence_requests WHERE status='rejected' AND …` prüfen — erwartet: 0 Treffer (vorher 15) |
| 14.1-U12b | Der Bedienweg führt zur richtigen Funktion und die Datei kommt so beim Empfänger an | AU | Sichtprüfung (PW: teilweise — der Bedienweg ja, die Datei beim Empfänger nicht) |
| 14.1-U13 | Kenntnisnahme: DATEV-Export nimmt soft-gelöschte Nutzer bewusst mit | E | Durchsprache |
| 14.1-U14a | `totalOvertime` im Historien-Export ist jetzt richtig | A | Export erzeugen und die Kennzahl gegen die Summe aus `overtime_balance` (ohne stillgelegte Konten, ohne Zukunftsmonate) rechnen — erwartet: +105,75 h statt −2.954,21 h |
| 14.1-U14b | Muss eine bereits herausgegebene Exportdatei ersetzt werden? | E | Durchsprache — nur der Anwender weiß, ob und an wen exportiert wurde |
| 14.1-U15a | Steht bei den Anträgen 25, 56, 64 heute noch ein Alt-Abzug in `overtime_balance`? | A | Für die Nutzer 18, 17, 3 die Monatszeilen der drei Ausgleichstage lesen und gegen einen frisch gerechneten Wert stellen (`npm run validate:overtime:detailed -- --userId=… --month=…`) — erwartet: Differenz 0,00 h; jede Abweichung ist der gesuchte Alt-Abzug. **Diese Messung fehlt bisher und nimmt 14.1-U15b/U23 die Unsicherheit** |
| 14.1-U15b | Wird für einen etwaigen Alt-Abzug ein eigener Bereinigungsvorgang aufgesetzt? | E | Durchsprache — entscheidbar erst nach 14.1-U15a |
| 14.1-U16a | Die `compensation`-Belegzeile überlebt eine Neuberechnung und ändert den Saldo nicht | A | Neuberechnung ausführen, Zeile vorher/nachher zählen und Saldodifferenz messen — erwartet: 1 Zeile vor und nach, 0,00 h Wirkung |
| 14.1-U16b | Sind zwei Zeilen am Ausgleichstag für einen Mitarbeiter verständlich? | AU | Sichtprüfung und Urteil (PW: nein — reine Verständlichkeitsfrage) |
| 14.1-U17a | Saldo nach Genehmigung eines Ausgleichs springt nicht mehr | AS | Ausgleich genehmigen, danach die Kontoauszugsabfrage zweimal hintereinander — erwartet: beide Male derselbe Saldo (vorher Sprung von −8,00 h) |
| 14.1-U17b | Die Oberfläche zeigt beide Male denselben Wert | AU | Sichtprüfung (PW: ja) |
| 14.1-U18 | Ablehnen und Löschen geben die Stunden vollständig zurück | AS | Saldo vor der Genehmigung merken, dann einmal ablehnen und in einem zweiten Durchgang löschen — erwartet: beide Male exakt der Ausgangswert (vorher je 8,00 h zu wenig) |
| 14.1-U19 | Kenntnisnahme: für die drei Alt-Ausgleiche gibt es dauerhaft keinen Beleg | E | Durchsprache |
| 14.1-U20a | Wie viele fiktive Journalbuchungen gibt es wirklich? | A | `npm run purge:future-overtime` **ohne** `--apply` — erwartet: 100 Journalzeilen unter dem festgelegten Prädikat, davon 50 mit Wert ≠ 0, 130 einschließlich Testnutzer 15015 |
| 14.1-U20b | Wird der Roadmap-Text von 59 auf die gemessene Zahl richtiggestellt? | E | Durchsprache |
| 14.1-U21a | Testnutzer 15015 trägt weiterhin 30 Zukunftszeilen und 1 Monatszeile | A | `SELECT COUNT(*) FROM overtime_transactions WHERE userId=15015 AND date > date('now')` und dieselbe Zählung auf `overtime_balance` — erwartet: 30 bzw. 1, `SUM(hours) = −88` |
| 14.1-U21b | Kenntnisnahme: das Erfolgskriterium gilt mit dem Zusatz „15015 ausgenommen" | E | Durchsprache |
| 14.1-U22 | Wie lange bleiben Sicherung und die zwei Probekopien liegen? | E | Durchsprache |
| 14.1-U23 | Wiedervorlage: eigener Bereinigungsvorgang für die drei Alt-Ausgleiche? | E | Durchsprache — siehe 14.1-U15a |
| 14.1-U24 | Wird die Bereinigung gegen die Produktion gefahren, und wann? | E | Durchsprache — der Probelauf gegen die Produktionsarbeitskopie liegt unauffällig vor |
| 14.1-U25a | Nach der Bereinigung keine Zukunftsbuchung mehr bei den Nutzern 3, 17, 30 | A | `SELECT COUNT(*) FROM overtime_transactions WHERE userId IN (3,17,30) AND date > date('now')` — erwartet: 0 (vorher 38, 32, 30); zusätzlich Saldenvergleich gegen die Sicherung: Differenz 0,00 h bei allen 30 Nutzern |
| 14.1-U25b | Die Oberfläche zeigt das auch so, und das Verschwinden fällt nicht negativ auf | AU | Sichtprüfung (PW: teilweise — Listeninhalt ja, das Urteil über die Wirkung auf den Mitarbeiter nein) |
| 14.1-U26a | Zwei künftige Ausgleiche gehen gegen dasselbe Guthaben durch (CR-01) | AS | Für einen Nutzer mit knappem Guthaben zwei Ausgleiche mit Zukunftsdatum nacheinander genehmigen — erwartet (Befund bestätigt sich): beide werden angenommen, obwohl das Guthaben nur für einen reicht |
| 14.1-U26b | Soll ein genehmigter künftiger Ausgleich das Guthaben sofort binden — und vor oder nach der Auslieferung? | E | Durchsprache — **der dringendste Punkt vor der Auslieferung** |
| 14.1-U27a | Der Trockenlauf schreibt Schema-DDL, aber keine Daten | A | Prüfsummen und Zeilenzahlen der fünf geschützten Tabellen vor und nach einem Trockenlauf vergleichen — erwartet: unverändert; die DDL-Ausführung beim Modul-Import ist der bestätigte Befund |
| 14.1-U27b | Kenntnisnahme: das ist vor jedem `--allow-production`-Lauf zu korrigieren | E | Durchsprache |
| 14.1-U28a | Die drei gelöschten Zeilen trugen `carryoverFromPreviousYear = 0` | A | Aus `backups/development.PRE-14.1-06_20260825_070544.db` die ids 61245, 31769, 34406 lesen — erwartet: Wert 0, damit kein Verlust |
| 14.1-U28b | Kenntnisnahme: die Spalte gehört vor einem Produktionslauf in die Trockenlauf-Ausgabe | E | Durchsprache |
| 14.1-U29a | CR-04, CR-05, CR-06 einzeln nachmessen | A | CR-04: im Sammel-Export die Zeilen aus `absence_requests`/`vacation_balance` gegen die Nutzerliste stellen — erwartet: Zeilen zu nicht gelisteten Nutzern. CR-05: Trockenlaufausgabe daraufhin lesen, ob die D-08-Prüfsummen verglichen oder nur gedruckt werden. CR-06: Deckelungsgrenze mit `TZ=Europe/Berlin` gegen UTC-Mitternacht rechnen — erwartet: ein bis zwei Stunden Versatz |
| 14.1-U29b | Welche der drei Blocker werden vor der Auslieferung behoben? | E | Durchsprache — Priorisierung gegen den Termin |
| 14.1-U30a | Alle fünf neuen Testdateien schließen Zukunftsdaten aus | A | Die fünf Dateien nach dem gleichlautenden Ausschluss durchsuchen — erwartet: fünf Treffer, damit ist der Querschnittsbefund belegt |
| 14.1-U30b | Kenntnisnahme: die Regressionstests decken den Zukunftsfall nicht ab | E | Durchsprache |

---

## 4. Was ich sofort abnehmen kann

Die 33 AUTO-Punkte in einer Reihenfolge, die jede Vorbereitung nur einmal aufbaut. Es gibt keine
Voraussetzung außer den bereits vorhandenen Dateien. **Die drei Beweisdatenbanken
`14-produktionskopie.db`, `14-prod-nach-migration.db` und `14-generalprobe.db` werden nicht
angefasst** — jeder schreibende Schritt läuft gegen eine frisch gezogene Arbeitskopie.

**Block 0 — ohne Server, ohne Datenbankkopie (rund 15 Minuten)**

1. **14-U7** — `cd server && npx vitest run` → 491 grün / 3 rot, rote Menge unverändert
2. **14-U8** — `npx vitest run -t "<Titel>"` für die fünf REQ-32-Fälle einzeln
3. **14.1-U10 (Beleg)** — `npx vitest run sickLeaveRecalc` → Tests 2 bis 4 grün
4. **P12-4a / 13-U3a / 13-U13 / 14-U5a (Regelteil)** — die vier `npx tsx …check.ts`-Skripte des Desktops
   (`confirmDialogProps`, `workTimePeriodEditRules`, `workTimePeriodDeleteRules`,
   `overtimeTransactionFormat`) — `vitest` ist im `desktop/` nach wie vor nicht lauffähig,
   `npx tsx` + `node:assert` ist der Weg
5. **14.1-U30a** — die fünf neuen Testdateien nach dem Zukunftsausschluss durchsuchen
6. **P12-49** — `SELECT DISTINCT referenceType` gegen die Typ-Union in `useWorkTimeAccounts.ts`

**Block 1 — gegen `development.db` und die vorhandenen Sicherungen (rund 25 Minuten)**

7. **14.1-U1a** — `npm run verify:balance-vs-journal` für 18, 20, 21, 25
8. **14.1-U21a** — Zählung für Testnutzer 15015
9. **14.1-U25a** — Zählung Zukunftsbuchungen für 3, 17, 30 plus Saldenvergleich gegen die Sicherung
10. **14.1-U20a** — `npm run purge:future-overtime` als Trockenlauf, Zahlen 100 / 50 / 130 festhalten
11. **14.1-U27a** — Prüfsummen der fünf geschützten Tabellen vor und nach genau diesem Trockenlauf
12. **14.1-U28a** — `carryoverFromPreviousYear` der ids 61245, 31769, 34406 aus der Sicherung
13. **14.1-U15a** — Alt-Abzug bei den Nutzern 18, 17, 3 nachmessen (**neue Messung, schließt eine
    offene Frage der Phase 14.1**)
14. **14.1-U14a** — `totalOvertime` im Historien-Export nachrechnen
15. **14.1-U16a** — `compensation`-Belegzeile vor/nach einer Neuberechnung
16. **14.1-U29a** — CR-04, CR-05, CR-06 je einmal nachmessen

**Block 2 — Migrationen auf einer Arbeitskopie der Produktionskopie (rund 20 Minuten)**

17. **P12-40a** — `SELECT referenceType, COUNT(*) … GROUP BY referenceType`
    *(findet das etwas außerhalb der fünf erlaubten Werte, wird P12-40b zur Entscheidungsfrage)*
18. **P12-1** — Migration 011: Zeilenzahl vor/nach, `PRAGMA integrity_check`
19. **13-U14** — Migration 015: `integrity_check`, `foreign_key_check`, Index-Eindeutigkeit
    *(Abbruchregeln 2 und 3)*

**Block 3 — Salden und Rechenwerk auf derselben Arbeitskopie (rund 35 Minuten)**

20. **13-U11 (+11-U6, +P12-18)** — `snapshot:balances` dreimal, `diff` der `*.users.json`
    *(Abbruchregel 1 — jeder zusätzliche Name im Diff ist ein Blocker)*
21. **P12-19** — `check:period-chains` nach dem Wechsel *(Abbruchregel 4)*
22. **P12-10** — Transaktionsklammer: gezielt scheitern lassen, nichts bleibt stehen
23. **13-U15** — 40 → 32 → Korrektur zurück auf 40 → löschen
24. **P12-9** — Laufzeitmessung `applyWorkTimeChange()` < 10 s
25. **P12-44** — Zukunftsmonate werden mitgezogen
26. **P12-12** — Rundung über Monatsgrenzen
27. **P12-23a** — Nulldifferenz rechnet auf 0
28. **14-U1b** — der reale Umstellungsfall, sobald der Anwender die vier Werte genannt hat

**Block 4 — Freigabeunterlagen (rund 10 Minuten)**

29. **14-U2a** — Sicherung rückspielbar, `gh run list`, Health-Check, Trockenlaufausgabe
30. **14-U3a** — nach dem Release: `latest.json` mit allen vier Plattformschlüsseln

Danach bleibt der Block **AUTO-MIT-SERVER** (37 Zeilen). Er braucht genau zwei Dinge, die beide
lokal herstellbar sind:

- **Port 3000 frei** — in den Phasen 12 und 13 war er durchgehend durch ein fremdes
  Next.js-Projekt belegt, deshalb sind fast alle Live-Prüfungen ausgefallen. Das ist die einzige
  echte Vorbedingung.
- **Zwei Konten:** ein Admin und ein Mitarbeiter. Beide legt `npm run seed:test-users` lokal an
  (das Skript erzeugt einen Admin und mehrere Mitarbeiter); einen Nutzer mit Modellwechsel legt
  `seedModelChangeUser.ts` mit bekanntem Passwort an. **Echte Produktionspasswörter werden
  nirgends gebraucht** — auch P12-2 und 11-U3 sind reine Rollenprüfungen (403 gegen 200) und
  funktionieren mit Testkonten gegen einen Server, der auf die Arbeitskopie zeigt.

---

## 5. Lohnt sich Playwright?

**Ja, deutlich.** Von den 58 AUGEN-Zeilen würden mit funktionierenden Playwright-Browsern
**44 vollständig zu AUTO**, weitere **10 teilweise**; nur **4 bleiben in jedem Fall menschlich**.

| | Zeilen | Beispiele |
|---|---:|---|
| Würden vollständig zu AUTO | **44** | Tastaturdurchgang und Fokusfalle (P12-6/8/22), gestapelte Dialoge und z-Index (P12-5/31), Responsive-Messungen (P12-14/24, 13-U10), Fehler- und Wiederholzustände (P12-16/34, 13-U4b), die komplette E2E-Suite (P12-48 mit 37/38/39), zehn Sichtpunkte der Phase 13, sechs der Phase 14.1 |
| Würden teilweise zu AUTO | **10** | Kontrastdurchgang 13-U9 mit P12-13/21/27/47 (Kontrastwerte messbar, „mindestens so gut wie" nicht), 11-U2b, 13-U1b, 14-U6, 14.1-U12b, 14.1-U25b |
| Bleiben AUGEN | **4** | 11-U1b (externer DATEV-Importweg), P12-3b (Flackern beim Portal-Rendering), 14-U3b (Auto-Update einer echten Installation), 14.1-U16b (ist eine zweite Belegzeile verständlich?) |

**Was das an Zeit spart:** die 44 vollständig automatisierbaren Zeilen tragen zusammen
**rund 95 Minuten** der verbleibenden Anwenderzeit; die 10 teilweisen noch einmal grob
10 bis 15 Minuten. Aus den 4,25 Stunden nach dieser Triage würden damit **etwa 2,7 Stunden**.

**Der stärkste Einzelgrund ist P12-48.** Die E2E-Suite `user-edit.spec.ts` ist der einzige
Punkt, dessen Ersatz die Sitzung wirklich verzerrt: `14-UAT-SITZUNG.md` weicht dafür auf einen
manuellen Nachvollzug aus, bei dem sieben reparierte Selektoren einzeln von Hand nachgestellt
werden — vier Punkte (37, 38, 39, 48) und derselbe Klickpfad siebenmal. Mit Playwright ist das
ein Befehl:

```
cd desktop && npx playwright test tests/user-edit.spec.ts
```

Die Konfiguration liegt bereits vollständig vor (`desktop/playwright.config.ts`, `testDir: ./tests`,
`baseURL: http://localhost:1420`, drei Spec-Dateien). Es fehlt ausschließlich die passende
Browser-Fassung — der Versionsversatz zu jeder per `npx` ladbaren CLI-Fassung ist der einzige
Blocker, und ein Nachinstallieren ist bisher nicht autorisiert.

**Empfehlung:** Das Nachinstallieren lohnt sich. Der Aufwand ist ein einmaliges
`npx playwright install` in passender Version; der Gewinn sind 44 abgenommene Prüfpunkte,
rund anderthalb Stunden Anwenderzeit und — wichtiger als die Zeit — ein wiederholbarer
Regressionsnachweis für alle drei Spec-Dateien statt eines einmaligen Nachvollzugs von Hand.

---

## 6. Was der Anwender am Ende noch tun muss

| Block | Umfang | Zeit |
|---|---|---:|
| **Ein Durchgang Dunkelmodus und Kontrast** über alle neuen Flächen (13-U9 mit P12-13/21/27/47) | 1 zusammenhängender Durchgang, hell und dunkel | ~15 min |
| **Ein Durchgang ausschließlich Tastatur** (P12-22 mit P12-6/8, dazu 13-U8) | 1 Durchgang durch den Wechsel-Dialog | ~10 min |
| **Sichtprüfungen der Dialoge und des Kontoauszugs** (Phase 12 und 13) | rund 30 kurze Blicke, je 1–3 min | ~70 min |
| **Sichtprüfungen der Phase 14.1** am Mitarbeiterbildschirm | 9 halbe Punkte | ~14 min |
| **Festlegungen bestätigen oder widersprechen** (11-F, 13-F, P12-Entscheidungen, 14-U4) | 21 Zeilen Durchsprache | ~63 min |
| **Festlegungen der Phase 14.1** — darunter der dringendste Punkt 14.1-U26b | 20 Zeilen Durchsprache | ~60 min |
| **Freigaben und Werte** (14-U1a Nutzerdaten, 14-U2b Freigabe, P12-40b falls nötig) | 3 kurze Zusagen | ~9 min |
| **Nach dem Release** (14-U3b Auto-Update, eigenes Fenster) | 1 Punkt | ~10 min |
| **Summe** | | **~4,2 Std.** |
| davon mit funktionierendem Playwright | | **~2,7 Std.** |

Zum Vergleich: die Sitzungsfassung ohne diese Triage und ohne die Phase 14.1 stand bei
6,8 Stunden; mit der Phase 14.1 wären es 8,3 Stunden gewesen.

---

## 7. Randbedingungen, die für diese Einordnung galten

- **Playwright** ist lokal nicht lauffähig (Versionsversatz zu jeder per `npx` ladbaren
  CLI-Fassung), ein Nachinstallieren ist nicht autorisiert. Jeder AUGEN-Punkt trägt oben den
  Vermerk, ob er mit funktionierendem Playwright zu AUTO würde.
- **`vitest` läuft im `desktop/` projektweit nicht** (fehlendes `@babel/runtime`). Alle
  Desktop-Prüfungen dieser Triage laufen deshalb über `npx tsx` + `node:assert` — die vier
  `*.check.ts`-Skripte sind genau dafür angelegt. Im `server/` läuft `vitest` normal.
- **Arbeitsdatenbank ist `server/database/development.db`.** `server/database.db` ist ein
  unmigrierter Altbestand ohne `user_work_periods` — kein Skript darf dagegen laufen.
- **Die Beweisdatenbanken** `14-produktionskopie.db`, `14-prod-nach-migration.db` und
  `14-generalprobe.db` werden nur gelesen. Jeder schreibende Prüflauf zieht vorher eine
  Arbeitskopie.
- **Kein Zugriff auf die Produktionsdatenbank, kein Push, kein Deployment.** Die einzige
  Berührung mit der Produktion in der AUTO-Liste ist der lesende Health-Check und
  `gh run list` unter 14-U2a — beides reine Statusabfragen ohne Datenbankzugriff.
- **Nichts ausgeführt, nichts geändert.** Diese Datei ist reine Einordnung; ein anderer Lauf
  arbeitet gerade am Code (CR-01).
