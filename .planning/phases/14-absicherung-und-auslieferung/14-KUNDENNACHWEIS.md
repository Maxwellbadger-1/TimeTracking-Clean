# Kundennachweis: Überstunden- und Urlaubsstände aller 20 Nutzer

**Vorher / Nachher zum Deployment vom 23. August 2026 — mit unabhängiger Nachrechnung jeder Zahl**

| | |
|---|---|
| Erstellt am | 23.08.2026 |
| Gegenstand | Alle 20 Nutzerkonten der Produktionsdatenbank |
| Zeitraum | Eintritt des jeweiligen Nutzers bis 23.08.2026 |
| Stichtag der Berechnung | 23.08.2026 (der laufende Monat wird nur bis zu diesem Tag gezählt) |

---

## Was dieses Dokument ist

Am 23. August 2026 wurde eine neue Programmversion in Betrieb genommen. Dabei hat das System
die Überstundenkonten aller Mitarbeiterinnen und Mitarbeiter neu durchgerechnet. Bei acht von
zwanzig Konten hat sich der ausgewiesene Stand geändert.

Dieses Dokument beantwortet für **jedes einzelne Konto** drei Fragen:

1. Was stand vorher da, was steht jetzt da?
2. **Ist der neue Wert richtig?** — nicht behauptet, sondern vorgerechnet: aus dem hinterlegten
   Wochenplan, dem Feiertagskalender, den erfassten Arbeitszeiten und den genehmigten
   Abwesenheiten wird der Wert ein zweites Mal, unabhängig vom Programm, ermittelt und
   danebengestellt.
3. Wo etwas offen bleibt: was genau, und warum.

Alle Zahlen in diesem Dokument stammen aus tatsächlich ausgeführten Abfragen auf den beiden
unten genannten Datenbank-Sicherungen. Es wurde nichts geschätzt und nichts aus anderen
Berichten übernommen.

---

## Die drei Größen, um die es geht

| Begriff | Bedeutung |
|---|---|
| **Sollstunden** | Wie viel jemand in dem Monat hätte arbeiten sollen. Ergibt sich aus dem hinterlegten Wochenplan (z. B. „nur donnerstags 5 Stunden"). Feiertage setzen den Tag auf 0 Stunden, auch wenn der Wochenplan dort Stunden vorsieht. Unbezahlter Urlaub senkt ebenfalls das Soll. |
| **Iststunden** | Was angerechnet wird: erfasste Arbeitszeiten, dazu Gutschriften für Urlaubs- und Krankheitstage (ein Urlaubstag zählt so, als hätte man an dem Tag die Sollstunden gearbeitet), dazu von Hand eingetragene Korrekturen. |
| **Überstunden** | Iststunden minus Sollstunden. Positiv = Guthaben, negativ = Rückstand. |

Zusätzlich führt das System ein **Journal** (`overtime_transactions`) — eine tagegenaue Liste
aller Buchungen. Es ist ein dritter, vom Monatsaggregat unabhängiger Rechenweg und wird in
diesem Dokument als Gegenprobe mitgeführt.

---

## Datengrundlage

| Datei | Bedeutung |
|---|---|
| `server/database/14-produktionskopie.db` | Produktionsdatenbank **vor** dem Deployment |
| `server/database/14-prod-nach-migration.db` | Produktionsdatenbank **nach** Deployment und Datenbank-Migration |

Beide Dateien wurden ausschließlich lesend geöffnet (`readonly`). Sie sind Beweismittel und
wurden nicht verändert.

---

## Vorabprüfung: Wurden Rohdaten verändert?

Bevor irgendein Ergebnis bewertet werden kann, muss feststehen, ob das Deployment an den
zugrunde liegenden Aufzeichnungen etwas geändert hat. Dazu wurde jede Tabelle vollständig
ausgelesen und aus dem Inhalt eine Prüfsumme gebildet. Gleiche Prüfsumme = Inhalt Zeichen für
Zeichen identisch.

| Tabelle | Inhalt | Datensätze vorher | Datensätze nachher | Ergebnis |
|---|---|---:|---:|---|
| `time_entries` | Erfasste Zeiteinträge | 712 | 712 | **identisch** |
| `absence_requests` | Abwesenheitsanträge (Urlaub, Krankheit, Ausgleich, unbezahlt) | 43 | 43 | **identisch** |
| `overtime_corrections` | Manuelle Überstunden-Korrekturen | 4 | 4 | **identisch** |
| `users` | Personalstammdaten | 20 | 20 | **identisch** |
| `holidays` | Feiertage | 70 | 70 | **verändert** |
| `vacation_balance` | Urlaubskonten | 40 | 40 | **identisch** |
| `vacation_transactions` | Urlaubs-Journal | 59 | 59 | **identisch** |
| `overtime_transactions` | Überstunden-Journal | 2671 | 2671 | **identisch** |
| `overtime_balance` | Überstunden-Monatsaggregat | 144 | 144 | **verändert** |

**Befund:** Von neun geprüften Tabellen ist genau eine verändert — das Monats­aggregat
`overtime_balance`, also die Tabelle mit den fertig gerechneten Monatswerten. Kein einziger
Zeiteintrag, kein Urlaubsantrag, keine Krankmeldung, keine Korrektur und keine Journalzeile
wurde angefasst, hinzugefügt oder entfernt.

Das ist der wichtigste einzelne Befund dieses Dokuments: **Es wurden keine Daten geändert,
sondern nur anders gerechnet.**

---

## Zusammenfassung

| Kennzahl | Wert |
|---|---:|
| Nutzer insgesamt | 20 |
| davon aktiv | 15 |
| davon gelöscht (Konto stillgelegt, Daten erhalten) | 5 |
| Überstundenstand **unverändert** | 12 |
| Überstundenstand **geändert** | 8 |
| davon nachgerechnet in **allen** vom Lauf berührten Monaten korrekt | 8 |
| davon in einem berührten Monat noch abweichend | 0 |
| Konten mit einer verbleibenden Abweichung in einer **nicht** berührten Zeile | 3 (Nutzer 3, 17, 30) |
| Urlaubskonten geändert | 0 |

**Geprüfte Monatszeilen insgesamt:** 144. Davon stimmt die unabhängige Nachrechnung mit dem
neuen Wert in **141** Zeilen exakt überein. Die 3 verbleibenden Zeilen betreffen ausschließlich
Monate, die der Neuberechnungslauf konstruktionsbedingt gar nicht anfasst (Zukunftsmonate und
gelöschte Nutzer) — sie sind unten einzeln aufgeführt und begründet.

### Die acht geänderten Konten

| Nutzer | Name | Stand vorher | Stand nachher | Veränderung | Nachrechnung stimmt |
|---:|---|---:|---:|---:|---|
| 2 | Karin Jochem | 6 h | 10 h | +4 h | ja, in jedem berührten Monat |
| 3 | Christine Glas | −46,43 h | −15,23 h | +31,2 h | ja, in jedem berührten Monat |
| 16 | Benedikt Jochem | 104 h | 20 h | −84 h | ja, in jedem berührten Monat |
| 17 | Carmen Rothemund | −46,06 h | −45,26 h | +0,8 h | ja, in jedem berührten Monat |
| 18 | Silvia Lachner | −4,5 h | 11,5 h | +16 h | ja, in jedem berührten Monat |
| 19 | Ute Stock | 10,41 h | 12,41 h | +2 h | ja, in jedem berührten Monat |
| 24 | Kathrin Leeb | 249,5 h | 201,5 h | −48 h | ja, in jedem berührten Monat |
| 29 | Christina Wasensteiner | 85,78 h | 65,28 h | −20,5 h | ja, in jedem berührten Monat |

### Die zwölf unveränderten Konten

| Nutzer | Name | Stand (vorher = nachher) | Status |
|---:|---|---:|---|
| 1 | System Administrator | 0 h | aktiv |
| 15 | Test Test | −83,46 h | gelöscht am 28.02.2026 |
| 20 | Hans Schauer | −15,8 h | aktiv |
| 21 | Maria Schauer | −14 h | aktiv |
| 22 | Beate Walleiter | 47,5 h | aktiv |
| 23 | Sepp Wasensteiner | 0 h | aktiv |
| 25 | Heidemarie Tretter | −236,15 h | aktiv |
| 26 | Test Test | 0 h | gelöscht am 27.02.2026 |
| 27 | Reinhold Merl | 0 h | aktiv |
| 28 | Test Test | −192,5 h | gelöscht am 21.08.2026 |
| 30 | Test Urlaub | −1448 h | gelöscht am 21.08.2026 |
| 31 | UA T | −1272 h | gelöscht am 21.08.2026 |

---

## Warum sich acht Werte geändert haben — die zwei Ursachen

Um die alten Werte überhaupt beurteilen zu können, wurde die alte Rechenweise nachgebaut und
so lange geprüft, bis sie die alten Werte trifft. Ergebnis: Ein Modell aus genau zwei Regeln
reproduziert **134 von 144** alten Monatszeilen exakt (Soll *und* Ist). Die restlichen 10 Zeilen
gehören zu gelöschten Nutzern oder zu Zukunftsmonaten und werden weiter unten gesondert erklärt.
Die alte Rechenweise ist damit nicht vermutet, sondern nachgewiesen.

### Ursache (a): Der hinterlegte Wochenplan wurde beim Soll ignoriert

Für viele Mitarbeiterinnen ist ein individueller Wochenplan hinterlegt — etwa „nur donnerstags
5 Stunden". Das alte Verfahren hat diesen Plan beim Berechnen der Sollstunden **nicht gelesen**.
Es hat stattdessen die Wochenstunden gleichmäßig auf fünf Werktage verteilt: 5 Stunden pro
Woche wurden zu 1 Stunde an jedem Montag, Dienstag, Mittwoch, Donnerstag und Freitag.

Über einen ganzen Monat ergibt das nur zufällig dieselbe Summe. Sobald ein Monat mehr oder
weniger Donnerstage als Fünftel-Werktage hat oder ein Feiertag auf einen Donnerstag fällt,
laufen beide Rechenwege auseinander.

**Durchgerechnetes Beispiel — Karin Jochem (Nutzer 2), März 2026**

Karin Jochem arbeitet laut hinterlegtem Plan ausschließlich donnerstags, 5 Stunden.

| | Rechnung | Ergebnis |
|---|---|---:|
| **Richtig (heute)** | Der März 2026 hat 4 Donnerstage, an denen gearbeitet werden soll: 05.03.2026, 12.03.2026, 19.03.2026, 26.03.2026. 4 × 5 h | **20 h** |
| **Alt (bis 23.08.2026)** | 5 h ÷ 5 = 1 h pro Werktag; der März 2026 hat 22 Werktage (Mo–Fr, ohne Feiertage). 22 × 1 h | **22 h** |
| **Differenz** | | **2 h zu viel** |

Im System stand vorher 22 h, jetzt steht dort 20 h. Die unabhängige Nachrechnung
ergibt 20 h. Der neue Wert ist der richtige.

Dasselbe Muster trifft alle aktiven Nutzer mit hinterlegtem Wochenplan: Nutzer 2, 3, 17, 18, 19.
Die stillgelegten Konten 15 und 28 haben ebenfalls Wochenpläne, wurden aber vom Lauf nicht angefasst.

### Ursache (b): Das Monatsaggregat kannte Buchungen nicht, die längst erfasst waren

Die Monatswerte sind eine Zusammenfassung. Sie werden vom System nachgeführt. Das alte
Verfahren hat dabei zwei Arten von Buchungen nicht berücksichtigt:

**(b1) Von Hand eingetragene Korrekturen wurden gar nicht mitgezählt.**

Es gibt vier solcher Korrekturen in der Datenbank. Zwei davon betreffen aktive Mitarbeiterinnen
und wurden vom alten Monatsaggregat schlicht übergangen:

| Datum | Nutzer | Stunden | Begründung im System | eingetragen von |
|---|---|---:|---|---|
| 01.03.2026 | 29 Christina Wasensteiner | −20,5 h | Anpassung zur besseren Übersicht | Benedikt Jochem |
| 26.03.2026 | 24 Kathrin Leeb | −48 h | Anpassung zur besseren Übersicht | Benedikt Jochem |
| 26.03.2026 | 28 Test Test | −8,5 h | Anpassung der Arbeitszeit | Benedikt Jochem |
| 31.03.2026 | 28 Test Test | 100 h | Test Stunden | System Administrator |

Für Kathrin Leeb (Nutzer 24) und Christina Wasensteiner (Nutzer 29) sind das genau die
−48 h beziehungsweise −20,5 h, um die sich ihr Stand jetzt verringert hat. Diese Korrekturen
hat ein Mensch am 26.03.2026 ausdrücklich eingetragen. Sie waren seitdem in der Datenbank
gespeichert — der Monatswert hat sie nur nie übernommen.

**Durchgerechnetes Beispiel — Kathrin Leeb (Nutzer 24), März 2026**

| Bestandteil | Betrag |
|---|---:|
| Erfasste Arbeitszeiten im März | 41 h |
| Korrektur vom 26.03.2026 | −48 h |
| **Iststunden zusammen** | **−7 h** |
| Sollstunden (0 Wochenstunden hinterlegt) | 0 h |
| **Überstunden März** | **−7 h** |

Alter Wert im System: 41 h (die Korrektur fehlt). Neuer Wert: −7 h.
Journalsumme desselben Monats: −7 h. Alle drei unabhängigen Wege außer dem alten
Aggregat kommen auf −7 h.

**(b2) Urlaub und Krankheit wurden pauschal statt tagegenau gutgeschrieben.**

Das alte Verfahren hat für einen genehmigten Antrag die im Antrag gespeicherte *Anzahl Tage*
genommen und mit „Wochenstunden ÷ 5" multipliziert — unabhängig davon, auf welche Wochentage
die Abwesenheit tatsächlich fiel und ob ein Feiertag dazwischen lag. Reicht ein Antrag über
einen Monatswechsel, wurde der volle Betrag in **beide** Monate gebucht.

**Durchgerechnetes Beispiel — Christine Glas (Nutzer 3), Januar 2026**

Christine Glas arbeitet montags und dienstags je 4 Stunden. Sie hatte vom 01.01. bis
25.01.2026 genehmigten Urlaub; im Antrag sind 5 Tage vermerkt.

| | Rechnung | Gutschrift |
|---|---|---:|
| **Richtig (heute)** | In den Urlaubszeitraum fallen die Arbeitstage 05.01. (Mo), 12.01. (Mo), 19.01. (Mo), 13.01. (Di) und 20.01. (Di) — je 4 h. Der 06.01. (Di) ist Feiertag „Heilige Drei Könige" und zählt 0 h. | **20 h** |
| **Alt** | 5 Tage laut Antrag × (8 h ÷ 5) = 5 × 1,6 h | **8 h** |

| | Ist alt | Ist neu | Ist nachgerechnet |
|---|---:|---:|---:|
| Erfasste Arbeitszeiten Januar | 9,18 h | 9,18 h | 9,18 h |
| Urlaubsgutschrift | 8 h | 20 h | 20 h |
| **Summe** | **17,18 h** | **29,18 h** | **29,18 h** |

Die 8 Stunden zu wenig im alten Wert sind genau der Unterschied zwischen „5 Tage pauschal
à 1,6 h" und „die tatsächlichen fünf Arbeitstage à 4 h abzüglich Feiertag".

### Der größte Einzelfall: Benedikt Jochem (Nutzer 16), −84 h

Hier wirkt Ursache (b2) in ihrer stärksten Form. Herr Jochem hat keinen Wochenplan; sein Soll
beträgt 30 h ÷ 5 = 6 h je Werktag — daran ändert sich nichts, sein Soll ist vorher wie nachher
identisch. Die gesamte Veränderung steckt in den Gutschriften. Das alte Verfahren hat jeden
Antrag mit „Tage laut Antrag × 6 h" bewertet und diesen Betrag in **jeden** Monat gebucht, den
der Antrag berührt:

| Antrag | Zeitraum | Tage laut Antrag | Monat | Gutschrift alt | Gutschrift tagegenau | zu viel |
|---:|---|---:|---|---:|---:|---:|
| Nr. 60 | Krankheit 29.04.2026–10.05.2026 | 7 | April 2026 | 42 h | 12 h | 30 h |
| Nr. 51 | Urlaub 30.05.2026–10.06.2026 | 7 | Mai 2026 | 42 h | 0 h | 42 h |
| Nr. 59 | Urlaub 11.05.2026–14.05.2026 | 3 | Mai 2026 | 18 h | 18 h | 0 h |
| Nr. 60 | Krankheit 29.04.2026–10.05.2026 | 7 | Mai 2026 | 42 h | 30 h | 12 h |

Besonders deutlich: Der Urlaub vom 30.05. bis 10.06.2026 beginnt an einem Samstag. Im Mai
liegt darin kein einziger Arbeitstag — trotzdem wurden dem Mai volle 42 h gutgeschrieben.

| | April 2026 | Mai 2026 |
|---|---:|---:|
| Erfasste Arbeitszeiten | 134,25 h | 39,5 h |
| Krankheitsgutschrift, tagegenau | 12 h | 30 h |
| Urlaubsgutschrift, tagegenau | 0 h | 18 h |
| **Ist nachgerechnet** | **146,25 h** | **87,5 h** |
| Ist alt (im System vorher) | 176,25 h | 141,5 h |
| Ist neu (im System jetzt) | 146,25 h | 87,5 h |
| Zu viel im alten Wert | 30 h | 54 h |

Zusammen 84 h — genau die Veränderung seines Kontostands. Die Krankheits- und
Urlaubsgutschriften wurden **nicht entfernt**; sie stehen tagegenau in der Rechnung — im April
12 h, im Mai 48 h. Entfernt wurde ausschließlich die Überbewertung, die aus der Pauschale
entstanden war. Das Journal desselben Zeitraums bestätigt die neuen Werte:
April 26,25 h, Mai −20,5 h — identisch mit dem neuen Aggregat.

---

## Offene Punkte — was nicht stimmt oder ungeklärt bleibt

Dieser Abschnitt beschönigt nichts.

### 1. Zukunftsmonate im Kontostand (Nutzer 3, 17 und 30)

Der Kontostand ist die Summe **aller** gespeicherten Monatszeilen. Für drei Nutzer existieren
Zeilen für Monate, die noch gar nicht stattgefunden haben. Sie enthalten die vollen Sollstunden
des künftigen Monats und ziehen den Stand entsprechend ins Minus.

| Nutzer | Monat | Soll | Ist | Wirkung auf den Stand |
|---:|---|---:|---:|---:|
| 3 Christine Glas | September 2026 | 36 h | 16 h | −20 h |
| 17 Carmen Rothemund | September 2026 | 52 h | 8 h | −44 h |
| 30 Test Urlaub | Oktober 2026 | 176 h | 0 h | −176 h |

Diese Zeilen sind **vor und nach dem Deployment identisch** — das Deployment hat sie weder
erzeugt noch verändert. Sie entstehen, wenn ein Urlaubsantrag für einen künftigen Monat
genehmigt wird: das System legt dann eine Monatszeile mit dem vollen Monatssoll an. Der
nächtliche Neuberechnungslauf holt sie nie wieder ein, weil er beim laufenden Monat aufhört.

**Konkrete Auswirkung:** Von Carmen Rothemunds ausgewiesenem Rückstand von −45,26 h
stammen −44 h aus dem September, der noch bevorsteht. Rechnet man nur die abgelaufene Zeit
bis zum 23.08.2026, beträgt ihr Stand −1,26 h. Für Christine Glas: ausgewiesen −15,23 h,
davon −20 h aus dem September; bis 23.08.2026 gerechnet 4,77 h.

Die Ist-Stunden dieser Zukunftszeilen sind vorab gebuchte Gutschriften für bereits genehmigte
Abwesenheiten:

- Carmen Rothemund: Urlaub vom 27.08. bis 03.09.2026; davon fallen der 01.09. (Di) und der
  03.09. (Do) in den September — 2 × 4 h = 8 h.
- Christine Glas: Urlaub vom 21. bis 28.09.2026 (Mo 21., Di 22., Mo 28. — 3 × 4 h = 12 h)
  und ein Überstundenausgleich am 29.09.2026 (4 h).

Das **Journal enthält für diese Monate dieselben Zeilen** und kommt auf dieselben Summen
(Christine Glas −20 h, Carmen Rothemund −44 h). Der dritte Rechenweg deckt den Fehler also
nicht auf, sondern wiederholt ihn.

**Das ist eine echte, bisher nicht dokumentierte Fehlerquelle.** Sie ist nicht durch das
Deployment entstanden, sie besteht unverändert fort, und sie verzerrt zwei Kontostände
erheblich. Empfehlung: Monatszeilen für künftige Monate beim Ermitteln des Kontostands
ausklammern oder gar nicht erst anlegen.

### 2. Gelöschte Nutzer werden vom Neuberechnungslauf übersprungen

Fünf Konten sind stillgelegt (Nutzer 15, 26, 28, 30, 31). Der Lauf überspringt sie
ausdrücklich. Ihre Monatswerte stammen deshalb noch aus der Zeit vor der Löschung und folgen
teilweise schon der neuen, teilweise noch der alten Regel. Sie wurden vom Deployment nicht
verändert. Für diese Konten ist eine Nachrechnung über den vollen Zeitraum nicht
aussagekräftig — sie wird im jeweiligen Abschnitt nur nachrichtlich gezeigt.

Alle fünf tragen Namen wie „Test", „Test Test", „Test Urlaub" oder „UAT" und sind erkennbar
Probekonten. Sie tragen zusammen −2995,96 h in die Gesamtsumme aller Konten ein. Wer eine
Gesamtauswertung über alle Nutzer erstellt, sollte sie ausschließen.

### 3. Das Journal ist unvollständig — jede Abweichung ist aber restlos erklärt

Das Journal ist der dritte Rechenweg. Vor dem Deployment stimmte es in **33 von 89**
Monatszeilen mit dem Aggregat überein, nachher in **51 von 89**. Das Aggregat hat sich also
deutlich an das Journal angenähert.

Die verbleibenden 38 abweichenden Zeilen wurden einzeln aufgeklärt. Für **jede einzelne** gilt:

> Aggregat = Journalsumme + die Tage, für die im Journal überhaupt keine Zeile existiert
> + Korrektur für Überstundenausgleichstage

Diese Gleichung geht in **allen 144 geprüften Monatszeilen mit einer Restdifferenz von exakt 0 auf.**
Damit ist belegt: Nicht das Aggregat weicht ab, sondern das Journal ist lückenhaft. Es wird
nicht laufend fortgeschrieben, sondern in Schüben nachgetragen (die größten am 24.07. und am
04.08.2026). Zwischen zwei Nachträgen fehlen die jüngsten Tage. Der letzte im Journal erfasste
Arbeitstag liegt je Nutzer unterschiedlich:

| Nutzer | letzter Tag mit Journalzeile |
|---:|---|
| 1 System Administrator | 26.02.2026 |
| 2 Karin Jochem | 17.08.2026 |
| 3 Christine Glas | 18.08.2026 |
| 15 Test Test | 30.03.2026 |
| 16 Benedikt Jochem | 18.08.2026 |
| 17 Carmen Rothemund | 18.08.2026 |
| 18 Silvia Lachner | 21.08.2026 |
| 19 Ute Stock | 16.08.2026 |
| 20 Hans Schauer | 10.08.2026 |
| 21 Maria Schauer | 30.07.2026 |
| 22 Beate Walleiter | 30.07.2026 |
| 24 Kathrin Leeb | 29.06.2026 |
| 25 Heidemarie Tretter | 04.05.2026 |
| 28 Test Test | 26.07.2026 |
| 29 Christina Wasensteiner | 30.07.2026 |

Alle Tage danach — bis zum Stichtag 23.08.2026 — fehlen im Journal, stehen aber korrekt im
Aggregat. Bei Heidemarie Tretter (Nutzer 25) sind das über drei Monate.

| Nutzer | Monat | Aggregat | Journal | fehlende Journaltage | Ausgleichstag | Restdifferenz |
|---:|---|---:|---:|---:|---:|---:|
| 2 | April 2026 | −3,5 h | 1,5 h | −5 h (1 Tag) | 0 h | 0 h |
| 2 | Mai 2026 | 12,5 h | 17,5 h | −5 h (1 Tag) | 0 h | 0 h |
| 2 | Juli 2026 | −6,5 h | −1,5 h | −5 h (1 Tag) | 0 h | 0 h |
| 2 | August 2026 | −9 h | −4 h | −5 h (1 Tag) | 0 h | 0 h |
| 3 | Juni 2026 | 1,33 h | 1,66 h | −0,33 h (1 Tag) | 0 h | 0 h |
| 15 | Februar 2026 | 0 h | −8,5 h | 8,5 h (1 Tag) | 0 h | 0 h |
| 16 | März 2026 | 3 h | 5,5 h | −2,5 h (1 Tag) | 0 h | 0 h |
| 16 | Juni 2026 | 16 h | 17 h | −1 h (1 Tag) | 0 h | 0 h |
| 16 | Juli 2026 | −29,75 h | −28,5 h | −1,25 h (1 Tag) | 0 h | 0 h |
| 16 | August 2026 | 4,5 h | 16,5 h | −12 h (2 Tage) | 0 h | 0 h |
| 17 | März 2026 | 1,58 h | 3,08 h | −1,5 h (1 Tag) | 0 h | 0 h |
| 17 | April 2026 | −7,83 h | −4,42 h | 0,59 h (1 Tag) | −4 h | 0 h |
| 17 | Juni 2026 | −2,34 h | −1,59 h | −0,75 h (1 Tag) | 0 h | 0 h |
| 17 | August 2026 | −1,25 h | 2,75 h | −4 h (1 Tag) | 0 h | 0 h |
| 18 | April 2026 | −1,25 h | −2,5 h | 1,25 h (1 Tag) | 0 h | 0 h |
| 18 | Juli 2026 | 12,5 h | 8,25 h | 4,25 h (1 Tag) | 0 h | 0 h |
| 19 | Januar 2026 | 0,08 h | −6 h | 6,08 h (1 Tag) | 0 h | 0 h |
| 19 | Februar 2026 | 0 h | −3,25 h | 3,25 h (1 Tag) | 0 h | 0 h |
| 19 | März 2026 | 7,92 h | 7,42 h | 0,5 h (1 Tag) | 0 h | 0 h |
| 19 | April 2026 | −1,5 h | 1 h | −2,5 h (1 Tag) | 0 h | 0 h |
| 19 | Mai 2026 | 7,25 h | 5 h | 2,25 h (1 Tag) | 0 h | 0 h |
| 19 | August 2026 | 1,41 h | 3,91 h | −2,5 h (1 Tag) | 0 h | 0 h |
| 20 | April 2026 | 3,5 h | 4,9 h | −1,4 h (1 Tag) | 0 h | 0 h |
| 20 | Juni 2026 | −4,9 h | −3,5 h | −1,4 h (1 Tag) | 0 h | 0 h |
| 20 | Juli 2026 | −1,2 h | −3,3 h | 2,1 h (1 Tag) | 0 h | 0 h |
| 20 | August 2026 | −21 h | −8,4 h | −12,6 h (9 Tage) | 0 h | 0 h |
| 21 | April 2026 | 1,5 h | 2,5 h | −1 h (1 Tag) | 0 h | 0 h |
| 21 | Juni 2026 | −2,5 h | −1,5 h | −1 h (1 Tag) | 0 h | 0 h |
| 21 | Juli 2026 | −1 h | −2,5 h | 1,5 h (1 Tag) | 0 h | 0 h |
| 22 | Juli 2026 | 19 h | 16 h | 3 h (1 Tag) | 0 h | 0 h |
| 24 | Mai 2026 | 49 h | 44,5 h | 4,5 h (1 Tag) | 0 h | 0 h |
| 25 | März 2026 | −35,2 h | −24 h | −11,2 h (7 Tage) | 0 h | 0 h |
| 25 | April 2026 | −16 h | −18,4 h | 2,4 h (1 Tag) | 0 h | 0 h |
| 25 | Mai 2026 | −26,55 h | 0,65 h | −27,2 h (17 Tage) | 0 h | 0 h |
| 28 | März 2026 | 35,5 h | −24,5 h | 60 h (10 Tage) | 0 h | 0 h |
| 28 | April 2026 | −48 h | −44 h | −4 h (1 Tag) | 0 h | 0 h |
| 28 | Juli 2026 | −52 h | −40 h | −12 h (3 Tage) | 0 h | 0 h |
| 29 | Juli 2026 | 12,82 h | 10,82 h | 2 h (1 Tag) | 0 h | 0 h |

### 4. Überstundenausgleich: zwei Rechenwege, ein methodischer Unterschied

Ein genehmigter **Überstundenausgleich** (ein freier Tag, der aus dem Überstundenkonto bezahlt
wird) wird von den beiden Rechenwegen unterschiedlich gebucht:

- **Aggregat:** Der Tag hat Sollstunden, aber keine Gutschrift. Das Konto sinkt um die
  Sollstunden dieses Tages — der freie Tag wird also aus dem Guthaben bezahlt.
- **Journal:** Der Tag steht mit „minus Soll" und zusätzlich mit einer Gutschrift „plus Soll"
  darin. Unter dem Strich bleibt das Konto unverändert.

Das Aggregat folgt der dokumentierten Fachregel (`.claude/CLAUDE.md`, REQ-19); das Journal tut
es nicht. Betroffen ist in den geprüften Daten nur **eine** Zeile: Carmen Rothemund
(Nutzer 17), 13.04.2026, 4 Stunden. Bei Silvia Lachner (Nutzer 18) gibt es einen weiteren
Ausgleichstag am 02.01.2026, für den das Journal überhaupt keine Zeilen enthält.

**Richtigstellung gegenüber der bisherigen Annahme:** Für **unbezahlten Urlaub** laufen die
beiden Rechenwege *nicht* auseinander. Das Journal bucht dort „minus Soll" und „plus Soll"
gegeneinander, das Aggregat setzt Soll und Ist beide auf 0 — beide Wege ergeben 0. Geprüft an
Carmen Rothemund, 14.04. und 27.04.2026. Die Abweichung im April 2026 kommt zu 4 h aus dem
Ausgleichstag und zu 0,59 h aus einem im Journal fehlenden Tag (30.04.), nicht aus dem
unbezahlten Urlaub.

### 5. Mitarbeitende ohne hinterlegte Arbeitszeit sammeln ihre gesamte Arbeitszeit als Überstunden

Bei vier Konten stehen 0 Wochenstunden und kein Wochenplan im Stammsatz. Damit ist das Soll in
jedem Monat 0 — und **jede erfasste Arbeitsstunde wird zur Überstunde**:

| Nutzer | Name | Bereich | Wochenstunden | Ausgewiesener Überstundenstand |
|---:|---|---|---:|---:|
| 22 | Beate Walleiter | Reinigung Lenggries | 0 h | 47,5 h |
| 23 | Sepp Wasensteiner | Hausmeister Lenggries | 0 h | 0 h |
| 24 | Kathrin Leeb | Reinigung Fall | 0 h | 201,5 h |
| 29 | Christina Wasensteiner | Reinigung Fall | 0 h | 65,28 h |

Rechnerisch ist das korrekt und vom Deployment unberührt — die Regel „0 Wochenstunden = 0
Sollstunden" ist so hinterlegt. Fachlich bedeutet es aber, dass diese Konten kein
Überstundenkonto im üblichen Sinn führen, sondern ein Stundenkonto der geleisteten Arbeit.
Bei Kathrin Leeb (Nutzer 24) sind das 201,5 h. Wer diese Zahl als „Überstunden" liest,
versteht sie falsch. Empfehlung: entweder die tatsächlichen Wochenstunden hinterlegen oder
diese Konten in Auswertungen gesondert ausweisen.

### 6. Kleinere Auffälligkeiten in den Stammdaten

- **4 genehmigte Abwesenheiten ohne Genehmigungszeitpunkt.** Sie stehen auf „genehmigt", tragen
  aber kein Datum der Genehmigung: Nr. 46 (Nutzer 3, sick, 24.02.2026); Nr. 60 (Nutzer 16, sick, 29.04.2026); Nr. 68 (Nutzer 3, sick, 03.08.2026); Nr. 70 (Nutzer 16, sick, 13.08.2026).
  Auf die Berechnung wirkt sich das nicht aus — der Status entscheidet. Für eine lückenlose
  Nachvollziehbarkeit fehlt aber, wer wann genehmigt hat.
- **Eine Korrektur über +100 h mit der Begründung „Test Stunden"** (Nutzer 28, 31.03.2026,
  eingetragen vom Systemkonto). Das Konto ist stillgelegt; die Buchung wirkt nicht mehr auf
  aktive Mitarbeitende, steht aber weiterhin in den Daten.

### 7. Was nicht abschließend geklärt werden konnte

Die alte Rechenweise wurde aus ihrem Ergebnis rekonstruiert, nicht aus dem damals laufenden
Programmcode. Das Modell trifft 134 von 144 alten Monatszeilen exakt — das ist ein starker
Beleg, aber kein Beweis, dass der alte Code intern genau so vorging. Für die Beurteilung der
**neuen** Werte spielt das keine Rolle: diese wurden direkt aus den Rohdaten nachgerechnet.

Ebenfalls offen: Warum die Monatszeilen für künftige Monate (Punkt 1) mit dem *vollen*
Monatssoll angelegt werden, obwohl der laufende Monat sonst am heutigen Tag abgeschnitten
wird, konnte aus den Daten allein nicht beantwortet werden. Der Effekt ist belegt, die
auslösende Stelle im Programm wurde für diesen Nachweis nicht gesucht.

---

## Wie die folgenden Tabellen zu lesen sind

Für jeden Nutzer folgen vier Tabellen:

1. **Sollstunden** — mit ausgeschriebener Herleitung: welche Wochentage, wie viele davon im
   Monat, welche fallen auf Feiertage. Daneben der alte Wert, der neue Wert und ob die
   Nachrechnung den neuen Wert trifft.
2. **Iststunden** — in ihre Bestandteile zerlegt, sodass die Addition sichtbar aufgeht.
3. **Überstunden** — alt, neu, Differenz und die Journalsumme als dritter Vergleichswert.
4. **Urlaub** — Anspruch, Übertrag, genommen, Rest; jeweils vorher und nachher.

In der Spalte „Stimmt?" bedeutet **✓**, dass die unabhängige Nachrechnung den neuen Wert auf
den Cent genau trifft. Ein **✗** wird darunter erklärt.

Der Monat August 2026 wird überall nur bis zum 23.08.2026 gezählt — dem Tag, an dem die
Momentaufnahmen entstanden sind.

---

## Nutzer 1 — System Administrator

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 1 |
| Name | System Administrator |
| Benutzerkennung | `admin` |
| Rolle | Verwaltung (Administrator) |
| Bereich | IT |
| Eintrittsdatum | 13.11.2025 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 0 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 0 h ÷ 5 = 0 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 30 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| November 2025 | gezählt wird nur 13.11.2025 bis 30.11.2025; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Dezember 2025 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Januar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Februar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| März 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| April 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Mai 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juni 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juli 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| November 2025 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Dezember 2025 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| April 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Mai 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| November 2025 | 0 h | 0 h | — | 0 h | 0 h | ✓ |
| Dezember 2025 | 0 h | 0 h | — | 0 h | 0 h | ✓ |
| Januar 2026 | 0 h | 0 h | — | 0 h | 0 h | ✓ |
| Februar 2026 | 0 h | 0 h | — | 0 h | 0 h | ✓ |
| März 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| April 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Mai 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Juni 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Juli 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| August 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| **Summe** | **0 h** | **0 h** | **0 h** | | **0 h** | |

Journalsumme und Aggregat stimmen in allen Monaten überein, für die das Journal Zeilen enthält.

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2025 | 30 | 30 | 0 | 0 | 0 | 0 | 30 | 30 | ✓ |
| 2026 | 30 | 30 | 5 | 5 | 0 | 0 | 35 | 35 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von 0 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 2 — Karin Jochem

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 2 |
| Name | Karin Jochem |
| Benutzerkennung | `KarinJochem` |
| Rolle | Mitarbeiter |
| Bereich | Verwaltung |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 5 h |
| Hinterlegter Wochenplan | Donnerstag 5 h — an allen übrigen Wochentagen 0 h (Summe 5 h pro Woche) |
| Urlaubsanspruch im Stammsatz | 7 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil ein Wochenplan hinterlegt ist, hat dieser Vorrang. Die Angabe „Wochenstunden" im
> Stammsatz wird für die Sollstunden **nicht** verwendet.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Donnerstag: 5 im Zeitraum, davon 1 Feiertag (01.01.2026 Neujahr) → 4 × 5 h = 20 h → **20 h** | 20 h | 20 h | 20 h | ✓ |
| Februar 2026 | Donnerstag: 4 im Zeitraum × 5 h = 20 h → **20 h** | 20 h | 20 h | 20 h | ✓ |
| März 2026 | Donnerstag: 4 im Zeitraum × 5 h = 20 h → **20 h** | 22 h | 20 h | 20 h | ✓ |
| April 2026 | Donnerstag: 5 im Zeitraum × 5 h = 25 h → **25 h** | 20 h | 25 h | 25 h | ✓ |
| Mai 2026 | Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 5 h = 15 h → **15 h** | 18 h | 15 h | 15 h | ✓ |
| Juni 2026 | Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 5 h = 15 h → **15 h** | 21 h | 15 h | 15 h | ✓ |
| Juli 2026 | Donnerstag: 5 im Zeitraum × 5 h = 25 h → **25 h** | 23 h | 25 h | 25 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Donnerstag: 3 im Zeitraum × 5 h = 15 h → **15 h** | 15 h | 15 h | 15 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Februar 2026 | 29 | 0 | 0 | 0 | 0 | **29** | 29 | 29 | ✓ |
| März 2026 | 2,5 | 0 | 0 | 0 | 0 | **2,5** | 2,5 | 2,5 | ✓ |
| April 2026 | 21,5 | 0 | 0 | 0 | 0 | **21,5** | 21,5 | 21,5 | ✓ |
| Mai 2026 | 27,5 | 0 | 0 | 0 | 0 | **27,5** | 27,5 | 27,5 | ✓ |
| Juni 2026 | 60 | 0 | 0 | 0 | 0 | **60** | 60 | 60 | ✓ |
| Juli 2026 | 18,5 | 0 | 0 | 0 | 0 | **18,5** | 18,5 | 18,5 | ✓ |
| August 2026 | 6 | 0 | 0 | 0 | 0 | **6** | 6 | 6 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | −20 h | −20 h | — | – | −20 h | ✓ |
| Februar 2026 | 9 h | 9 h | — | 9 h | 9 h | ✓ |
| März 2026 | −19,5 h | −17,5 h | +2 h | −17,5 h | −17,5 h | ✓ |
| April 2026 | 1,5 h | −3,5 h | −5 h | 1,5 h | −3,5 h | ✓ |
| Mai 2026 | 9,5 h | 12,5 h | +3 h | 17,5 h | 12,5 h | ✓ |
| Juni 2026 | 39 h | 45 h | +6 h | 45 h | 45 h | ✓ |
| Juli 2026 | −4,5 h | −6,5 h | −2 h | −1,5 h | −6,5 h | ✓ |
| August 2026 | −9 h | −9 h | — | −4 h | −9 h | ✓ |
| **Summe** | **6 h** | **10 h** | **+4 h** | | **10 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| April 2026 | −5 h | 1 Tag ohne Journalzeile (30.04.2026): −5 h; ungeklärter Rest: 0 h |
| Mai 2026 | −5 h | 1 Tag ohne Journalzeile (28.05.2026): −5 h; ungeklärter Rest: 0 h |
| Juli 2026 | −5 h | 1 Tag ohne Journalzeile (30.07.2026): −5 h; ungeklärter Rest: 0 h |
| August 2026 | −5 h | 1 Tag ohne Journalzeile (20.08.2026): −5 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2025 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2026 | 7 | 7 | 0 | 0 | 0 | 0 | 7 | 7 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Geändert und nachgerechnet richtig.** Von 6 h auf 10 h (+4 h). Jeder einzelne Monatswert entspricht exakt der unabhängigen Nachrechnung aus Wochenplan, Feiertagen, Zeiteinträgen, Abwesenheiten und Korrekturen.

---

## Nutzer 3 — Christine Glas

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 3 |
| Name | Christine Glas |
| Benutzerkennung | `ChristineGlas` |
| Rolle | Mitarbeiter |
| Bereich | Verwaltung |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 8 h |
| Hinterlegter Wochenplan | Montag 4 h, Dienstag 4 h — an allen übrigen Wochentagen 0 h (Summe 8 h pro Woche) |
| Urlaubsanspruch im Stammsatz | 13 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil ein Wochenplan hinterlegt ist, hat dieser Vorrang. Die Angabe „Wochenstunden" im
> Stammsatz wird für die Sollstunden **nicht** verwendet.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Montag: 4 im Zeitraum × 4 h = 16 h; Dienstag: 4 im Zeitraum, davon 1 Feiertag (06.01.2026 Heilige Drei Könige) → 3 × 4 h = 12 h; Summe 28 h → **28 h** | 32 h | 28 h | 28 h | ✓ |
| Februar 2026 | Montag: 4 im Zeitraum × 4 h = 16 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Summe 32 h → **32 h** | 32 h | 32 h | 32 h | ✓ |
| März 2026 | Montag: 5 im Zeitraum × 4 h = 20 h; Dienstag: 5 im Zeitraum × 4 h = 20 h; Summe 40 h → **40 h** | 35,2 h | 40 h | 40 h | ✓ |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 4 h = 12 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Summe 28 h → **28 h** | 32 h | 28 h | 28 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 4 h = 12 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Summe 28 h → **28 h** | 28,8 h | 28 h | 28 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 4 h = 20 h; Dienstag: 5 im Zeitraum × 4 h = 20 h; Summe 40 h → **40 h** | 33,6 h | 40 h | 40 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 4 h = 16 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Summe 32 h → **32 h** | 36,8 h | 32 h | 32 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 4 h = 12 h; Dienstag: 3 im Zeitraum × 4 h = 12 h; Summe 24 h → **24 h** | 24 h | 24 h | 24 h | ✓ |
| September 2026 | Der Monat hatte am Stichtag 23.08.2026 noch nicht begonnen — bis dahin sind keine Sollstunden entstanden → **0 h** | 36 h | 36 h | 0 h | ✗ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 9,18 | 20 | 0 | 0 | 0 | **29,18** | 17,18 | 29,18 | ✓ |
| Februar 2026 | 25,08 | 4 | 4 | 0 | 0 | **33,08** | 28,28 | 33,08 | ✓ |
| März 2026 | 40,17 | 0 | 0 | 0 | 0 | **40,17** | 40,17 | 40,17 | ✓ |
| April 2026 | 28,59 | 0 | 0 | 0 | 0 | **28,59** | 28,59 | 28,59 | ✓ |
| Mai 2026 | 12,75 | 16 | 0 | 0 | 0 | **28,75** | 19,15 | 28,75 | ✓ |
| Juni 2026 | 41,33 | 0 | 0 | 0 | 0 | **41,33** | 41,33 | 41,33 | ✓ |
| Juli 2026 | 31,16 | 0 | 0 | 0 | 0 | **31,16** | 31,16 | 31,16 | ✓ |
| August 2026 | 20,51 | 0 | 4 | 0 | 0 | **24,51** | 22,11 | 24,51 | ✓ |
| September 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 16 | 16 | ✗ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | −14,82 h | 1,18 h | +16 h | – | 1,18 h | ✓ |
| Februar 2026 | −3,72 h | 1,08 h | +4,8 h | 1,08 h | 1,08 h | ✓ |
| März 2026 | 4,97 h | 0,17 h | −4,8 h | 0,17 h | 0,17 h | ✓ |
| April 2026 | −3,41 h | 0,59 h | +4 h | 0,59 h | 0,59 h | ✓ |
| Mai 2026 | −9,65 h | 0,75 h | +10,4 h | 0,75 h | 0,75 h | ✓ |
| Juni 2026 | 7,73 h | 1,33 h | −6,4 h | 1,66 h | 1,33 h | ✓ |
| Juli 2026 | −5,64 h | −0,84 h | +4,8 h | −0,84 h | −0,84 h | ✓ |
| August 2026 | −1,89 h | 0,51 h | +2,4 h | 0,51 h | 0,51 h | ✓ |
| September 2026 | −20 h | −20 h | — | −20 h | 0 h | ✗ |
| **Summe** | **−46,43 h** | **−15,23 h** | **+31,2 h** | | **4,77 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| Juni 2026 | −0,33 h | 1 Tag ohne Journalzeile (30.06.2026): −0,33 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2025 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2026 | 13 | 13 | 0 | 0 | 13 | 13 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Geändert; die vom Lauf berührten Monate sind nachgerechnet richtig, eine unberührte Zeile bleibt abweichend.** Von −46,43 h auf −15,23 h (+31,2 h). Abweichend: September 2026 — Begründung in der offenen Liste.

---

## Nutzer 15 — Test Test

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 15 |
| Name | Test Test |
| Benutzerkennung | `Test` |
| Rolle | Mitarbeiter |
| Bereich | nicht gesetzt |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 0 h |
| Hinterlegter Wochenplan | Montag 8 h, Mittwoch 8 h, Freitag 4 h — an allen übrigen Wochentagen 0 h (Summe 20 h pro Woche) |
| Urlaubsanspruch im Stammsatz | 10 Tage/Jahr |
| Konto-Status | inaktiv |
| Gelöscht (Soft-Delete) | **ja**, am 28.02.2026 |

> Weil ein Wochenplan hinterlegt ist, hat dieser Vorrang. Die Angabe „Wochenstunden" im
> Stammsatz wird für die Sollstunden **nicht** verwendet.

> **Hinweis:** Dieses Konto ist stillgelegt. Der Neuberechnungslauf vom 23.08.2026 hat es
> ausdrücklich übersprungen. Die Spalte „nachgerechnet" wird nachrichtlich mitgeführt, ist
> aber kein Maßstab für die gespeicherten Werte.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Freitag: 5 im Zeitraum × 4 h = 20 h; Summe 84 h → **84 h** | 84 h | 84 h | 84 h | ✓ |
| Februar 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 4 h = 16 h; Summe 80 h → **80 h** | 80 h | 80 h | 80 h | ✓ |
| März 2026 | Montag: 5 im Zeitraum × 8 h = 40 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 4 h = 16 h; Summe 88 h → **88 h** | 88 h | 88 h | 88 h | ✓ |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 8 h = 24 h; Mittwoch: 5 im Zeitraum × 8 h = 40 h; Freitag: 4 im Zeitraum, davon 1 Feiertag (03.04.2026 Karfreitag) → 3 × 4 h = 12 h; Summe 76 h → **76 h** | – | – | 76 h | – |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 8 h = 24 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Freitag: 5 im Zeitraum, davon 1 Feiertag (01.05.2026 Erster Mai) → 4 × 4 h = 16 h; Summe 72 h → **72 h** | – | – | 72 h | – |
| Juni 2026 | Montag: 5 im Zeitraum × 8 h = 40 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 4 h = 16 h; Summe 88 h → **88 h** | – | – | 88 h | – |
| Juli 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 5 im Zeitraum × 8 h = 40 h; Freitag: 5 im Zeitraum × 4 h = 20 h; Summe 92 h → **92 h** | – | – | 92 h | – |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 8 h = 24 h; Mittwoch: 3 im Zeitraum × 8 h = 24 h; Freitag: 3 im Zeitraum × 4 h = 12 h; Summe 60 h → **60 h** | – | – | 60 h | – |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 88,54 | 0 | 0 | 0 | 0 | **88,54** | 88,54 | 88,54 | ✓ |
| Februar 2026 | 80 | 0 | 0 | 0 | 0 | **80** | 80 | 80 | ✓ |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| April 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| Mai 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 4,54 h | 4,54 h | — | 4,54 h | 4,54 h | ✓ |
| Februar 2026 | 0 h | 0 h | — | −8,5 h | 0 h | ✓ |
| März 2026 | −88 h | −88 h | — | −88 h | −88 h | ✓ |
| April 2026 | – | – | – | – | −76 h | – |
| Mai 2026 | – | – | – | – | −72 h | – |
| Juni 2026 | – | – | – | – | −88 h | – |
| Juli 2026 | – | – | – | – | −92 h | – |
| August 2026 | – | – | – | – | −60 h | – |
| **Summe** | **−83,46 h** | **−83,46 h** | **0 h** | | **−471,46 h** | |

> Für die Monate nach der Stilllegung ist im System keine Zeile mehr vorhanden (–). Die
> Spalte „nachgerechnet" rechnet dennoch weiter, als bestünde das Arbeitsverhältnis fort —
> deshalb weicht ihre Summe (−471,46 h) vom gespeicherten Stand (−83,46 h) ab. Maßgeblich
> ist der gespeicherte Stand; er ist durch das Deployment nicht verändert worden.

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| Februar 2026 | 8,5 h | 1 Tag ohne Journalzeile (28.02.2026): 8,5 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2025 | 10 | 10 | 0 | 0 | 5 | 5 | 5 | 5 | ✓ |
| 2026 | 10 | 10 | 0 | 0 | 6 | 6 | 4 | 4 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von −83,46 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 16 — Benedikt Jochem

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 16 |
| Name | Benedikt Jochem |
| Benutzerkennung | `BenediktJochem` |
| Rolle | Verwaltung (Administrator) |
| Bereich | Verwaltung |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 30 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 30 h ÷ 5 = 6 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 28 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Montag: 4 im Zeitraum × 6 h = 24 h; Dienstag: 4 im Zeitraum, davon 1 Feiertag (06.01.2026 Heilige Drei Könige) → 3 × 6 h = 18 h; Mittwoch: 4 im Zeitraum × 6 h = 24 h; Donnerstag: 5 im Zeitraum, davon 1 Feiertag (01.01.2026 Neujahr) → 4 × 6 h = 24 h; Freitag: 5 im Zeitraum × 6 h = 30 h; Summe 120 h → **120 h** | 120 h | 120 h | 120 h | ✓ |
| Februar 2026 | Montag: 4 im Zeitraum × 6 h = 24 h; Dienstag: 4 im Zeitraum × 6 h = 24 h; Mittwoch: 4 im Zeitraum × 6 h = 24 h; Donnerstag: 4 im Zeitraum × 6 h = 24 h; Freitag: 4 im Zeitraum × 6 h = 24 h; Summe 120 h → **120 h** | 120 h | 120 h | 120 h | ✓ |
| März 2026 | Montag: 5 im Zeitraum × 6 h = 30 h; Dienstag: 5 im Zeitraum × 6 h = 30 h; Mittwoch: 4 im Zeitraum × 6 h = 24 h; Donnerstag: 4 im Zeitraum × 6 h = 24 h; Freitag: 4 im Zeitraum × 6 h = 24 h; Summe 132 h → **132 h** | 132 h | 132 h | 132 h | ✓ |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 6 h = 18 h; Dienstag: 4 im Zeitraum × 6 h = 24 h; Mittwoch: 5 im Zeitraum × 6 h = 30 h; Donnerstag: 5 im Zeitraum × 6 h = 30 h; Freitag: 4 im Zeitraum, davon 1 Feiertag (03.04.2026 Karfreitag) → 3 × 6 h = 18 h; Summe 120 h → **120 h** | 120 h | 120 h | 120 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 6 h = 18 h; Dienstag: 4 im Zeitraum × 6 h = 24 h; Mittwoch: 4 im Zeitraum × 6 h = 24 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 6 h = 18 h; Freitag: 5 im Zeitraum, davon 1 Feiertag (01.05.2026 Erster Mai) → 4 × 6 h = 24 h; Summe 108 h → **108 h** | 108 h | 108 h | 108 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 6 h = 30 h; Dienstag: 5 im Zeitraum × 6 h = 30 h; Mittwoch: 4 im Zeitraum × 6 h = 24 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 6 h = 18 h; Freitag: 4 im Zeitraum × 6 h = 24 h; Summe 126 h → **126 h** | 126 h | 126 h | 126 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 6 h = 24 h; Dienstag: 4 im Zeitraum × 6 h = 24 h; Mittwoch: 5 im Zeitraum × 6 h = 30 h; Donnerstag: 5 im Zeitraum × 6 h = 30 h; Freitag: 5 im Zeitraum × 6 h = 30 h; Summe 138 h → **138 h** | 138 h | 138 h | 138 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 6 h = 18 h; Dienstag: 3 im Zeitraum × 6 h = 18 h; Mittwoch: 3 im Zeitraum × 6 h = 18 h; Donnerstag: 3 im Zeitraum × 6 h = 18 h; Freitag: 3 im Zeitraum × 6 h = 18 h; Summe 90 h → **90 h** | 90 h | 90 h | 90 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 168,5 | 0 | 0 | 0 | 0 | **168,5** | 168,5 | 168,5 | ✓ |
| Februar 2026 | 74 | 18 | 0 | 0 | 0 | **92** | 92 | 92 | ✓ |
| März 2026 | 135 | 0 | 0 | 0 | 0 | **135** | 135 | 135 | ✓ |
| April 2026 | 134,25 | 0 | 12 | 0 | 0 | **146,25** | 176,25 | 146,25 | ✓ |
| Mai 2026 | 39,5 | 18 | 30 | 0 | 0 | **87,5** | 141,5 | 87,5 | ✓ |
| Juni 2026 | 100 | 42 | 0 | 0 | 0 | **142** | 142 | 142 | ✓ |
| Juli 2026 | 108,25 | 0 | 0 | 0 | 0 | **108,25** | 108,25 | 108,25 | ✓ |
| August 2026 | 64,5 | 0 | 30 | 0 | 0 | **94,5** | 94,5 | 94,5 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 48,5 h | 48,5 h | — | – | 48,5 h | ✓ |
| Februar 2026 | −28 h | −28 h | — | −28 h | −28 h | ✓ |
| März 2026 | 3 h | 3 h | — | 5,5 h | 3 h | ✓ |
| April 2026 | 56,25 h | 26,25 h | −30 h | 26,25 h | 26,25 h | ✓ |
| Mai 2026 | 33,5 h | −20,5 h | −54 h | −20,5 h | −20,5 h | ✓ |
| Juni 2026 | 16 h | 16 h | — | 17 h | 16 h | ✓ |
| Juli 2026 | −29,75 h | −29,75 h | — | −28,5 h | −29,75 h | ✓ |
| August 2026 | 4,5 h | 4,5 h | — | 16,5 h | 4,5 h | ✓ |
| **Summe** | **104 h** | **20 h** | **−84 h** | | **20 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| März 2026 | −2,5 h | 1 Tag ohne Journalzeile (31.03.2026): −2,5 h; ungeklärter Rest: 0 h |
| Juni 2026 | −1 h | 1 Tag ohne Journalzeile (30.06.2026): −1 h; ungeklärter Rest: 0 h |
| Juli 2026 | −1,25 h | 1 Tag ohne Journalzeile (31.07.2026): −1,25 h; ungeklärter Rest: 0 h |
| August 2026 | −12 h | 2 Tage ohne Journalzeile (20.08.2026, 21.08.2026): −12 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2025 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2026 | 28 | 28 | 0 | 0 | 13 | 13 | 15 | 15 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Geändert und nachgerechnet richtig.** Von 104 h auf 20 h (−84 h). Jeder einzelne Monatswert entspricht exakt der unabhängigen Nachrechnung aus Wochenplan, Feiertagen, Zeiteinträgen, Abwesenheiten und Korrekturen.

---

## Nutzer 17 — Carmen Rothemund

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 17 |
| Name | Carmen Rothemund |
| Benutzerkennung | `CarmenRothemund` |
| Rolle | Mitarbeiter |
| Bereich | Verwaltung |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 12 h |
| Hinterlegter Wochenplan | Montag 4 h, Dienstag 4 h, Donnerstag 4 h — an allen übrigen Wochentagen 0 h (Summe 12 h pro Woche) |
| Urlaubsanspruch im Stammsatz | 20 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil ein Wochenplan hinterlegt ist, hat dieser Vorrang. Die Angabe „Wochenstunden" im
> Stammsatz wird für die Sollstunden **nicht** verwendet.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Montag: 4 im Zeitraum × 4 h = 16 h; Dienstag: 4 im Zeitraum, davon 1 Feiertag (06.01.2026 Heilige Drei Könige) → 3 × 4 h = 12 h; Donnerstag: 5 im Zeitraum, davon 1 Feiertag (01.01.2026 Neujahr) → 4 × 4 h = 16 h; Summe 44 h → **44 h** | 48 h | 44 h | 44 h | ✓ |
| Februar 2026 | Montag: 4 im Zeitraum × 4 h = 16 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Donnerstag: 4 im Zeitraum × 4 h = 16 h; Summe 48 h → **48 h** | 48 h | 48 h | 48 h | ✓ |
| März 2026 | Montag: 5 im Zeitraum × 4 h = 20 h; Dienstag: 5 im Zeitraum × 4 h = 20 h; Donnerstag: 4 im Zeitraum × 4 h = 16 h; Summe 56 h → **56 h** | 52,8 h | 56 h | 56 h | ✓ |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 4 h = 12 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Donnerstag: 5 im Zeitraum × 4 h = 20 h; Summe 48 h; abzüglich unbezahlter Urlaub 2 Tage = −8 h → **40 h** | 43,2 h | 40 h | 40 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 4 h = 12 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 4 h = 12 h; Summe 40 h → **40 h** | 43,2 h | 40 h | 40 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 4 h = 20 h; Dienstag: 5 im Zeitraum × 4 h = 20 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 4 h = 12 h; Summe 52 h → **52 h** | 50,4 h | 52 h | 52 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 4 h = 16 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Donnerstag: 5 im Zeitraum × 4 h = 20 h; Summe 52 h → **52 h** | 55,2 h | 52 h | 52 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 4 h = 12 h; Dienstag: 3 im Zeitraum × 4 h = 12 h; Donnerstag: 3 im Zeitraum × 4 h = 12 h; Summe 36 h → **36 h** | 36 h | 36 h | 36 h | ✓ |
| September 2026 | Der Monat hatte am Stichtag 23.08.2026 noch nicht begonnen — bis dahin sind keine Sollstunden entstanden → **0 h** | 52 h | 52 h | 0 h | ✗ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 49,09 | 4 | 0 | 0 | 0 | **53,09** | 51,49 | 53,09 | ✓ |
| Februar 2026 | 42,82 | 4 | 0 | 0 | 0 | **46,82** | 45,22 | 46,82 | ✓ |
| März 2026 | 57,58 | 0 | 0 | 0 | 0 | **57,58** | 57,58 | 57,58 | ✓ |
| April 2026 | 24,17 | 8 | 0 | 0 | 0 | **32,17** | 31,37 | 32,17 | ✓ |
| Mai 2026 | 31,09 | 8 | 0 | 0 | 0 | **39,09** | 40,69 | 39,09 | ✓ |
| Juni 2026 | 41,66 | 8 | 0 | 0 | 0 | **49,66** | 51,26 | 49,66 | ✓ |
| Juli 2026 | 49,58 | 4 | 0 | 0 | 0 | **53,58** | 51,98 | 53,58 | ✓ |
| August 2026 | 30,75 | 4 | 0 | 0 | 0 | **34,75** | 45,15 | 34,75 | ✓ |
| September 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 8 | 8 | ✗ |

Anmerkungen zu den Bestandteilen:

- **Überstundenausgleich** steht mit 0 h in der Ist-Spalte, und das ist beabsichtigt: Ein
  Ausgleichstag wird *aus* dem Überstundenkonto bezahlt. Eine Gutschrift auf dasselbe Konto
  würde den Tag doppelt vergüten. Der Tag senkt das Konto deshalb um seine Sollstunden.
  Betroffene Tage: 13.04.2026 (4 h Soll).
- **Unbezahlter Urlaub** erscheint nicht im Ist, sondern senkt das Soll. Betroffen: April 2026 (8 h).

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 3,49 h | 9,09 h | +5,6 h | 9,09 h | 9,09 h | ✓ |
| Februar 2026 | −2,78 h | −1,18 h | +1,6 h | −1,18 h | −1,18 h | ✓ |
| März 2026 | 4,78 h | 1,58 h | −3,2 h | 3,08 h | 1,58 h | ✓ |
| April 2026 | −11,83 h | −7,83 h | +4 h | −4,42 h | −7,83 h | ✓ |
| Mai 2026 | −2,51 h | −0,91 h | +1,6 h | −0,91 h | −0,91 h | ✓ |
| Juni 2026 | 0,86 h | −2,34 h | −3,2 h | −1,59 h | −2,34 h | ✓ |
| Juli 2026 | −3,22 h | 1,58 h | +4,8 h | 1,58 h | 1,58 h | ✓ |
| August 2026 | 9,15 h | −1,25 h | −10,4 h | 2,75 h | −1,25 h | ✓ |
| September 2026 | −44 h | −44 h | — | −44 h | 0 h | ✗ |
| **Summe** | **−46,06 h** | **−45,26 h** | **+0,8 h** | | **−1,26 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| März 2026 | −1,5 h | 1 Tag ohne Journalzeile (31.03.2026): −1,5 h; ungeklärter Rest: 0 h |
| April 2026 | −3,41 h | 1 Tag ohne Journalzeile (30.04.2026): 0,59 h; Überstundenausgleich am 13.04.2026: −4 h; ungeklärter Rest: 0 h |
| Juni 2026 | −0,75 h | 1 Tag ohne Journalzeile (30.06.2026): −0,75 h; ungeklärter Rest: 0 h |
| August 2026 | −4 h | 1 Tag ohne Journalzeile (20.08.2026): −4 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 20 | 20 | 0 | 0 | 15 | 15 | 5 | 5 | ✓ |
| 2027 | 20 | 20 | 0 | 0 | 0 | 0 | 20 | 20 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Geändert; die vom Lauf berührten Monate sind nachgerechnet richtig, eine unberührte Zeile bleibt abweichend.** Von −46,06 h auf −45,26 h (+0,8 h). Abweichend: September 2026 — Begründung in der offenen Liste.

---

## Nutzer 18 — Silvia Lachner

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 18 |
| Name | Silvia Lachner |
| Benutzerkennung | `SilviaLachner` |
| Rolle | Mitarbeiter |
| Bereich | Verwaltung |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 20 h |
| Hinterlegter Wochenplan | Mittwoch 8 h, Donnerstag 8 h, Freitag 4 h — an allen übrigen Wochentagen 0 h (Summe 20 h pro Woche) |
| Urlaubsanspruch im Stammsatz | 19 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil ein Wochenplan hinterlegt ist, hat dieser Vorrang. Die Angabe „Wochenstunden" im
> Stammsatz wird für die Sollstunden **nicht** verwendet.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 5 im Zeitraum, davon 1 Feiertag (01.01.2026 Neujahr) → 4 × 8 h = 32 h; Freitag: 5 im Zeitraum × 4 h = 20 h; Summe 84 h → **84 h** | 80 h | 84 h | 84 h | ✓ |
| Februar 2026 | Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 4 h = 16 h; Summe 80 h → **80 h** | 80 h | 80 h | 80 h | ✓ |
| März 2026 | Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 4 h = 16 h; Summe 80 h → **80 h** | 88 h | 80 h | 80 h | ✓ |
| April 2026 | Mittwoch: 5 im Zeitraum × 8 h = 40 h; Donnerstag: 5 im Zeitraum × 8 h = 40 h; Freitag: 4 im Zeitraum, davon 1 Feiertag (03.04.2026 Karfreitag) → 3 × 4 h = 12 h; Summe 92 h → **92 h** | 80 h | 92 h | 92 h | ✓ |
| Mai 2026 | Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 8 h = 24 h; Freitag: 5 im Zeitraum, davon 1 Feiertag (01.05.2026 Erster Mai) → 4 × 4 h = 16 h; Summe 72 h → **72 h** | 72 h | 72 h | 72 h | ✓ |
| Juni 2026 | Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 8 h = 24 h; Freitag: 4 im Zeitraum × 4 h = 16 h; Summe 72 h → **72 h** | 84 h | 72 h | 72 h | ✓ |
| Juli 2026 | Mittwoch: 5 im Zeitraum × 8 h = 40 h; Donnerstag: 5 im Zeitraum × 8 h = 40 h; Freitag: 5 im Zeitraum × 4 h = 20 h; Summe 100 h → **100 h** | 92 h | 100 h | 100 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Mittwoch: 3 im Zeitraum × 8 h = 24 h; Donnerstag: 3 im Zeitraum × 8 h = 24 h; Freitag: 3 im Zeitraum × 4 h = 12 h; Summe 60 h → **60 h** | 60 h | 60 h | 60 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 89,75 | 0 | 0 | 0 | 0 | **89,75** | 93,75 | 89,75 | ✓ |
| Februar 2026 | 75 | 0 | 0 | 0 | 0 | **75** | 75 | 75 | ✓ |
| März 2026 | 43,25 | 40 | 0 | 0 | 0 | **83,25** | 67,25 | 83,25 | ✓ |
| April 2026 | 90,75 | 0 | 0 | 0 | 0 | **90,75** | 90,75 | 90,75 | ✓ |
| Mai 2026 | 72,25 | 0 | 0 | 0 | 0 | **72,25** | 72,25 | 72,25 | ✓ |
| Juni 2026 | 52,75 | 20 | 0 | 0 | 0 | **72,75** | 64,75 | 72,75 | ✓ |
| Juli 2026 | 112,5 | 0 | 0 | 0 | 0 | **112,5** | 112,5 | 112,5 | ✓ |
| August 2026 | 55,25 | 0 | 0 | 0 | 0 | **55,25** | 55,25 | 55,25 | ✓ |

Anmerkungen zu den Bestandteilen:

- **Überstundenausgleich** steht mit 0 h in der Ist-Spalte, und das ist beabsichtigt: Ein
  Ausgleichstag wird *aus* dem Überstundenkonto bezahlt. Eine Gutschrift auf dasselbe Konto
  würde den Tag doppelt vergüten. Der Tag senkt das Konto deshalb um seine Sollstunden.
  Betroffene Tage: 02.01.2026 (4 h Soll).

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 13,75 h | 5,75 h | −8 h | – | 5,75 h | ✓ |
| Februar 2026 | −5 h | −5 h | — | −5 h | −5 h | ✓ |
| März 2026 | −20,75 h | 3,25 h | +24 h | 3,25 h | 3,25 h | ✓ |
| April 2026 | 10,75 h | −1,25 h | −12 h | −2,5 h | −1,25 h | ✓ |
| Mai 2026 | 0,25 h | 0,25 h | — | 0,25 h | 0,25 h | ✓ |
| Juni 2026 | −19,25 h | 0,75 h | +20 h | 0,75 h | 0,75 h | ✓ |
| Juli 2026 | 20,5 h | 12,5 h | −8 h | 8,25 h | 12,5 h | ✓ |
| August 2026 | −4,75 h | −4,75 h | — | −4,75 h | −4,75 h | ✓ |
| **Summe** | **−4,5 h** | **11,5 h** | **+16 h** | | **11,5 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| April 2026 | 1,25 h | 1 Tag ohne Journalzeile (30.04.2026): 1,25 h; ungeklärter Rest: 0 h |
| Juli 2026 | 4,25 h | 1 Tag ohne Journalzeile (31.07.2026): 4,25 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 19 | 19 | 0 | 0 | 9 | 9 | 10 | 10 | ✓ |
| 2027 | 19 | 19 | 0 | 0 | 0 | 0 | 19 | 19 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Geändert und nachgerechnet richtig.** Von −4,5 h auf 11,5 h (+16 h). Jeder einzelne Monatswert entspricht exakt der unabhängigen Nachrechnung aus Wochenplan, Feiertagen, Zeiteinträgen, Abwesenheiten und Korrekturen.

---

## Nutzer 19 — Ute Stock

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 19 |
| Name | Ute Stock |
| Benutzerkennung | `UteStock` |
| Rolle | Mitarbeiter |
| Bereich | Buchhaltung |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 2,5 h |
| Hinterlegter Wochenplan | Donnerstag 2,5 h — an allen übrigen Wochentagen 0 h (Summe 2,5 h pro Woche) |
| Urlaubsanspruch im Stammsatz | 6 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil ein Wochenplan hinterlegt ist, hat dieser Vorrang. Die Angabe „Wochenstunden" im
> Stammsatz wird für die Sollstunden **nicht** verwendet.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Donnerstag: 5 im Zeitraum, davon 1 Feiertag (01.01.2026 Neujahr) → 4 × 2,5 h = 10 h → **10 h** | 10 h | 10 h | 10 h | ✓ |
| Februar 2026 | Donnerstag: 4 im Zeitraum × 2,5 h = 10 h → **10 h** | 10 h | 10 h | 10 h | ✓ |
| März 2026 | Donnerstag: 4 im Zeitraum × 2,5 h = 10 h → **10 h** | 11 h | 10 h | 10 h | ✓ |
| April 2026 | Donnerstag: 5 im Zeitraum × 2,5 h = 12,5 h → **12,5 h** | 10 h | 12,5 h | 12,5 h | ✓ |
| Mai 2026 | Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 2,5 h = 7,5 h → **7,5 h** | 9 h | 7,5 h | 7,5 h | ✓ |
| Juni 2026 | Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 2,5 h = 7,5 h → **7,5 h** | 10,5 h | 7,5 h | 7,5 h | ✓ |
| Juli 2026 | Donnerstag: 5 im Zeitraum × 2,5 h = 12,5 h → **12,5 h** | 11,5 h | 12,5 h | 12,5 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Donnerstag: 3 im Zeitraum × 2,5 h = 7,5 h → **7,5 h** | 7,5 h | 7,5 h | 7,5 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 10,08 | 0 | 0 | 0 | 0 | **10,08** | 10,08 | 10,08 | ✓ |
| Februar 2026 | 10 | 0 | 0 | 0 | 0 | **10** | 10 | 10 | ✓ |
| März 2026 | 17,92 | 0 | 0 | 0 | 0 | **17,92** | 17,92 | 17,92 | ✓ |
| April 2026 | 11 | 0 | 0 | 0 | 0 | **11** | 11 | 11 | ✓ |
| Mai 2026 | 14,75 | 0 | 0 | 0 | 0 | **14,75** | 14,75 | 14,75 | ✓ |
| Juni 2026 | 12 | 0 | 0 | 0 | 0 | **12** | 12 | 12 | ✓ |
| Juli 2026 | 5,25 | 0 | 0 | 0 | 0 | **5,25** | 5,25 | 5,25 | ✓ |
| August 2026 | 8,91 | 0 | 0 | 0 | 0 | **8,91** | 8,91 | 8,91 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0,08 h | 0,08 h | — | −6 h | 0,08 h | ✓ |
| Februar 2026 | 0 h | 0 h | — | −3,25 h | 0 h | ✓ |
| März 2026 | 6,92 h | 7,92 h | +1 h | 7,42 h | 7,92 h | ✓ |
| April 2026 | 1 h | −1,5 h | −2,5 h | 1 h | −1,5 h | ✓ |
| Mai 2026 | 5,75 h | 7,25 h | +1,5 h | 5 h | 7,25 h | ✓ |
| Juni 2026 | 1,5 h | 4,5 h | +3 h | 4,5 h | 4,5 h | ✓ |
| Juli 2026 | −6,25 h | −7,25 h | −1 h | −7,25 h | −7,25 h | ✓ |
| August 2026 | 1,41 h | 1,41 h | — | 3,91 h | 1,41 h | ✓ |
| **Summe** | **10,41 h** | **12,41 h** | **+2 h** | | **12,41 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| Januar 2026 | 6,08 h | 1 Tag ohne Journalzeile (31.01.2026): 6,08 h; ungeklärter Rest: 0 h |
| Februar 2026 | 3,25 h | 1 Tag ohne Journalzeile (28.02.2026): 3,25 h; ungeklärter Rest: 0 h |
| März 2026 | 0,5 h | 1 Tag ohne Journalzeile (31.03.2026): 0,5 h; ungeklärter Rest: 0 h |
| April 2026 | −2,5 h | 1 Tag ohne Journalzeile (30.04.2026): −2,5 h; ungeklärter Rest: 0 h |
| Mai 2026 | 2,25 h | 1 Tag ohne Journalzeile (31.05.2026): 2,25 h; ungeklärter Rest: 0 h |
| August 2026 | −2,5 h | 1 Tag ohne Journalzeile (20.08.2026): −2,5 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 6 | 6 | 0 | 0 | 0 | 0 | 6 | 6 | ✓ |
| 2027 | 6 | 6 | 0 | 0 | 0 | 0 | 6 | 6 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Geändert und nachgerechnet richtig.** Von 10,41 h auf 12,41 h (+2 h). Jeder einzelne Monatswert entspricht exakt der unabhängigen Nachrechnung aus Wochenplan, Feiertagen, Zeiteinträgen, Abwesenheiten und Korrekturen.

---

## Nutzer 20 — Hans Schauer

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 20 |
| Name | Hans Schauer |
| Benutzerkennung | `HansSchauer` |
| Rolle | Mitarbeiter |
| Bereich | Hausmeister Fall |
| Eintrittsdatum | 01.04.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 7 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 7 h ÷ 5 = 1,4 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Der Monat liegt vollständig vor dem Eintritt → **0 h** | – | – | 0 h | – |
| Februar 2026 | Der Monat liegt vollständig vor dem Eintritt → **0 h** | – | – | 0 h | – |
| März 2026 | Der Monat liegt vollständig vor dem Eintritt → **0 h** | – | – | 0 h | – |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 1,4 h = 4,2 h; Dienstag: 4 im Zeitraum × 1,4 h = 5,6 h; Mittwoch: 5 im Zeitraum × 1,4 h = 7 h; Donnerstag: 5 im Zeitraum × 1,4 h = 7 h; Freitag: 4 im Zeitraum, davon 1 Feiertag (03.04.2026 Karfreitag) → 3 × 1,4 h = 4,2 h; Summe 28 h → **28 h** | 28 h | 28 h | 28 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 1,4 h = 4,2 h; Dienstag: 4 im Zeitraum × 1,4 h = 5,6 h; Mittwoch: 4 im Zeitraum × 1,4 h = 5,6 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 1,4 h = 4,2 h; Freitag: 5 im Zeitraum, davon 1 Feiertag (01.05.2026 Erster Mai) → 4 × 1,4 h = 5,6 h; Summe 25,2 h → **25,2 h** | 25,2 h | 25,2 h | 25,2 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 1,4 h = 7 h; Dienstag: 5 im Zeitraum × 1,4 h = 7 h; Mittwoch: 4 im Zeitraum × 1,4 h = 5,6 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 1,4 h = 4,2 h; Freitag: 4 im Zeitraum × 1,4 h = 5,6 h; Summe 29,4 h → **29,4 h** | 29,4 h | 29,4 h | 29,4 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 1,4 h = 5,6 h; Dienstag: 4 im Zeitraum × 1,4 h = 5,6 h; Mittwoch: 5 im Zeitraum × 1,4 h = 7 h; Donnerstag: 5 im Zeitraum × 1,4 h = 7 h; Freitag: 5 im Zeitraum × 1,4 h = 7 h; Summe 32,2 h → **32,2 h** | 32,2 h | 32,2 h | 32,2 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 1,4 h = 4,2 h; Dienstag: 3 im Zeitraum × 1,4 h = 4,2 h; Mittwoch: 3 im Zeitraum × 1,4 h = 4,2 h; Donnerstag: 3 im Zeitraum × 1,4 h = 4,2 h; Freitag: 3 im Zeitraum × 1,4 h = 4,2 h; Summe 21 h → **21 h** | 21 h | 21 h | 21 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| April 2026 | 31,5 | 0 | 0 | 0 | 0 | **31,5** | 31,5 | 31,5 | ✓ |
| Mai 2026 | 33 | 0 | 0 | 0 | 0 | **33** | 33 | 33 | ✓ |
| Juni 2026 | 24,5 | 0 | 0 | 0 | 0 | **24,5** | 24,5 | 24,5 | ✓ |
| Juli 2026 | 31 | 0 | 0 | 0 | 0 | **31** | 31 | 31 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | – | – | – | −28 h | 0 h | – |
| Februar 2026 | – | – | – | −28 h | 0 h | – |
| März 2026 | – | – | – | −29,4 h | 0 h | – |
| April 2026 | 3,5 h | 3,5 h | — | 4,9 h | 3,5 h | ✓ |
| Mai 2026 | 7,8 h | 7,8 h | — | 7,8 h | 7,8 h | ✓ |
| Juni 2026 | −4,9 h | −4,9 h | — | −3,5 h | −4,9 h | ✓ |
| Juli 2026 | −1,2 h | −1,2 h | — | −3,3 h | −1,2 h | ✓ |
| August 2026 | −21 h | −21 h | — | −8,4 h | −21 h | ✓ |
| **Summe** | **−15,8 h** | **−15,8 h** | **0 h** | | **−15,8 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| April 2026 | −1,4 h | 1 Tag ohne Journalzeile (30.04.2026): −1,4 h; ungeklärter Rest: 0 h |
| Juni 2026 | −1,4 h | 1 Tag ohne Journalzeile (30.06.2026): −1,4 h; ungeklärter Rest: 0 h |
| Juli 2026 | 2,1 h | 1 Tag ohne Journalzeile (31.07.2026): 2,1 h; ungeklärter Rest: 0 h |
| August 2026 | −12,6 h | 9 Tage ohne Journalzeile (11.08.2026, 12.08.2026, 13.08.2026, 14.08.2026, 17.08.2026, 18.08.2026, 19.08.2026, 20.08.2026, 21.08.2026): −12,6 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von −15,8 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 21 — Maria Schauer

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 21 |
| Name | Maria Schauer |
| Benutzerkennung | `MariaSchauer` |
| Rolle | Mitarbeiter |
| Bereich | Verwaltung Fall |
| Eintrittsdatum | 01.04.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 5 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 5 h ÷ 5 = 1 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Der Monat liegt vollständig vor dem Eintritt → **0 h** | – | – | 0 h | – |
| Februar 2026 | Der Monat liegt vollständig vor dem Eintritt → **0 h** | – | – | 0 h | – |
| März 2026 | Der Monat liegt vollständig vor dem Eintritt → **0 h** | – | – | 0 h | – |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 1 h = 3 h; Dienstag: 4 im Zeitraum × 1 h = 4 h; Mittwoch: 5 im Zeitraum × 1 h = 5 h; Donnerstag: 5 im Zeitraum × 1 h = 5 h; Freitag: 4 im Zeitraum, davon 1 Feiertag (03.04.2026 Karfreitag) → 3 × 1 h = 3 h; Summe 20 h → **20 h** | 20 h | 20 h | 20 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 1 h = 3 h; Dienstag: 4 im Zeitraum × 1 h = 4 h; Mittwoch: 4 im Zeitraum × 1 h = 4 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 1 h = 3 h; Freitag: 5 im Zeitraum, davon 1 Feiertag (01.05.2026 Erster Mai) → 4 × 1 h = 4 h; Summe 18 h → **18 h** | 18 h | 18 h | 18 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 1 h = 5 h; Dienstag: 5 im Zeitraum × 1 h = 5 h; Mittwoch: 4 im Zeitraum × 1 h = 4 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 1 h = 3 h; Freitag: 4 im Zeitraum × 1 h = 4 h; Summe 21 h → **21 h** | 21 h | 21 h | 21 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 1 h = 4 h; Dienstag: 4 im Zeitraum × 1 h = 4 h; Mittwoch: 5 im Zeitraum × 1 h = 5 h; Donnerstag: 5 im Zeitraum × 1 h = 5 h; Freitag: 5 im Zeitraum × 1 h = 5 h; Summe 23 h → **23 h** | 23 h | 23 h | 23 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 1 h = 3 h; Dienstag: 3 im Zeitraum × 1 h = 3 h; Mittwoch: 3 im Zeitraum × 1 h = 3 h; Donnerstag: 3 im Zeitraum × 1 h = 3 h; Freitag: 3 im Zeitraum × 1 h = 3 h; Summe 15 h → **15 h** | 15 h | 15 h | 15 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| April 2026 | 21,5 | 0 | 0 | 0 | 0 | **21,5** | 21,5 | 21,5 | ✓ |
| Mai 2026 | 21 | 0 | 0 | 0 | 0 | **21** | 21 | 21 | ✓ |
| Juni 2026 | 18,5 | 0 | 0 | 0 | 0 | **18,5** | 18,5 | 18,5 | ✓ |
| Juli 2026 | 22 | 0 | 0 | 0 | 0 | **22** | 22 | 22 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | – | – | – | −20 h | 0 h | – |
| Februar 2026 | – | – | – | −20 h | 0 h | – |
| März 2026 | – | – | – | −21 h | 0 h | – |
| April 2026 | 1,5 h | 1,5 h | — | 2,5 h | 1,5 h | ✓ |
| Mai 2026 | 3 h | 3 h | — | 3 h | 3 h | ✓ |
| Juni 2026 | −2,5 h | −2,5 h | — | −1,5 h | −2,5 h | ✓ |
| Juli 2026 | −1 h | −1 h | — | −2,5 h | −1 h | ✓ |
| August 2026 | −15 h | −15 h | — | – | −15 h | ✓ |
| **Summe** | **−14 h** | **−14 h** | **0 h** | | **−14 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| April 2026 | −1 h | 1 Tag ohne Journalzeile (30.04.2026): −1 h; ungeklärter Rest: 0 h |
| Juni 2026 | −1 h | 1 Tag ohne Journalzeile (30.06.2026): −1 h; ungeklärter Rest: 0 h |
| Juli 2026 | 1,5 h | 1 Tag ohne Journalzeile (31.07.2026): 1,5 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von −14 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 22 — Beate Walleiter

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 22 |
| Name | Beate Walleiter |
| Benutzerkennung | `BeateWalleitner` |
| Rolle | Mitarbeiter |
| Bereich | Reinigung Lenggries |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 0 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 0 h ÷ 5 = 0 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Februar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| März 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| April 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Mai 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juni 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juli 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| März 2026 | 8 | 0 | 0 | 0 | 0 | **8** | 8 | 8 | ✓ |
| April 2026 | 11,25 | 0 | 0 | 0 | 0 | **11,25** | 11,25 | 11,25 | ✓ |
| Mai 2026 | 9,25 | 0 | 0 | 0 | 0 | **9,25** | 9,25 | 9,25 | ✓ |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juli 2026 | 19 | 0 | 0 | 0 | 0 | **19** | 19 | 19 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Februar 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| März 2026 | 8 h | 8 h | — | 8 h | 8 h | ✓ |
| April 2026 | 11,25 h | 11,25 h | — | 11,25 h | 11,25 h | ✓ |
| Mai 2026 | 9,25 h | 9,25 h | — | 9,25 h | 9,25 h | ✓ |
| Juni 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Juli 2026 | 19 h | 19 h | — | 16 h | 19 h | ✓ |
| August 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| **Summe** | **47,5 h** | **47,5 h** | **0 h** | | **47,5 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| Juli 2026 | 3 h | 1 Tag ohne Journalzeile (31.07.2026): 3 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von 47,5 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 23 — Sepp Wasensteiner

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 23 |
| Name | Sepp Wasensteiner |
| Benutzerkennung | `SeppWasensteiner` |
| Rolle | Mitarbeiter |
| Bereich | Hausmeister Lenggries |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 0 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 0 h ÷ 5 = 0 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Februar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| März 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| April 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Mai 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juni 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juli 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| April 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Mai 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Februar 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| März 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| April 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Mai 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Juni 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Juli 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| August 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| **Summe** | **0 h** | **0 h** | **0 h** | | **0 h** | |

Journalsumme und Aggregat stimmen in allen Monaten überein, für die das Journal Zeilen enthält.

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von 0 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 24 — Kathrin Leeb

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 24 |
| Name | Kathrin Leeb |
| Benutzerkennung | `KathrinLeeb` |
| Rolle | Mitarbeiter |
| Bereich | Reinigung Fall |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 0 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 0 h ÷ 5 = 0 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 8 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Februar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| März 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| April 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Mai 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juni 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juli 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 30,5 | 0 | 0 | 0 | 0 | **30,5** | 30,5 | 30,5 | ✓ |
| Februar 2026 | 17,5 | 0 | 0 | 0 | 0 | **17,5** | 17,5 | 17,5 | ✓ |
| März 2026 | 41 | 0 | 0 | 0 | −48 | **−7** | 41 | −7 | ✓ |
| April 2026 | 39 | 0 | 0 | 0 | 0 | **39** | 39 | 39 | ✓ |
| Mai 2026 | 49 | 0 | 0 | 0 | 0 | **49** | 49 | 49 | ✓ |
| Juni 2026 | 72,5 | 0 | 0 | 0 | 0 | **72,5** | 72,5 | 72,5 | ✓ |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

Eingetragene Korrekturen:

| Datum | Stunden | Begründung |
|---|---:|---|
| 26.03.2026 | −48 h | Anpassung zur besseren Übersicht |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 30,5 h | 30,5 h | — | 30,5 h | 30,5 h | ✓ |
| Februar 2026 | 17,5 h | 17,5 h | — | 17,5 h | 17,5 h | ✓ |
| März 2026 | 41 h | −7 h | −48 h | −7 h | −7 h | ✓ |
| April 2026 | 39 h | 39 h | — | 39 h | 39 h | ✓ |
| Mai 2026 | 49 h | 49 h | — | 44,5 h | 49 h | ✓ |
| Juni 2026 | 72,5 h | 72,5 h | — | 72,5 h | 72,5 h | ✓ |
| Juli 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| August 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| **Summe** | **249,5 h** | **201,5 h** | **−48 h** | | **201,5 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| Mai 2026 | 4,5 h | 1 Tag ohne Journalzeile (31.05.2026): 4,5 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 8 | 8 | 0 | 0 | 0 | 0 | 8 | 8 | ✓ |
| 2027 | 8 | 8 | 0 | 0 | 0 | 0 | 8 | 8 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Geändert und nachgerechnet richtig.** Von 249,5 h auf 201,5 h (−48 h). Jeder einzelne Monatswert entspricht exakt der unabhängigen Nachrechnung aus Wochenplan, Feiertagen, Zeiteinträgen, Abwesenheiten und Korrekturen.

---

## Nutzer 25 — Heidemarie Tretter

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 25 |
| Name | Heidemarie Tretter |
| Benutzerkennung | `HeidiTretter` |
| Rolle | Mitarbeiter |
| Bereich | Verwaltung Fall |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 8 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 8 h ÷ 5 = 1,6 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 12 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Montag: 4 im Zeitraum × 1,6 h = 6,4 h; Dienstag: 4 im Zeitraum, davon 1 Feiertag (06.01.2026 Heilige Drei Könige) → 3 × 1,6 h = 4,8 h; Mittwoch: 4 im Zeitraum × 1,6 h = 6,4 h; Donnerstag: 5 im Zeitraum, davon 1 Feiertag (01.01.2026 Neujahr) → 4 × 1,6 h = 6,4 h; Freitag: 5 im Zeitraum × 1,6 h = 8 h; Summe 32 h → **32 h** | 32 h | 32 h | 32 h | ✓ |
| Februar 2026 | Montag: 4 im Zeitraum × 1,6 h = 6,4 h; Dienstag: 4 im Zeitraum × 1,6 h = 6,4 h; Mittwoch: 4 im Zeitraum × 1,6 h = 6,4 h; Donnerstag: 4 im Zeitraum × 1,6 h = 6,4 h; Freitag: 4 im Zeitraum × 1,6 h = 6,4 h; Summe 32 h → **32 h** | 32 h | 32 h | 32 h | ✓ |
| März 2026 | Montag: 5 im Zeitraum × 1,6 h = 8 h; Dienstag: 5 im Zeitraum × 1,6 h = 8 h; Mittwoch: 4 im Zeitraum × 1,6 h = 6,4 h; Donnerstag: 4 im Zeitraum × 1,6 h = 6,4 h; Freitag: 4 im Zeitraum × 1,6 h = 6,4 h; Summe 35,2 h → **35,2 h** | 35,2 h | 35,2 h | 35,2 h | ✓ |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 1,6 h = 4,8 h; Dienstag: 4 im Zeitraum × 1,6 h = 6,4 h; Mittwoch: 5 im Zeitraum × 1,6 h = 8 h; Donnerstag: 5 im Zeitraum × 1,6 h = 8 h; Freitag: 4 im Zeitraum, davon 1 Feiertag (03.04.2026 Karfreitag) → 3 × 1,6 h = 4,8 h; Summe 32 h → **32 h** | 32 h | 32 h | 32 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 1,6 h = 4,8 h; Dienstag: 4 im Zeitraum × 1,6 h = 6,4 h; Mittwoch: 4 im Zeitraum × 1,6 h = 6,4 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 1,6 h = 4,8 h; Freitag: 5 im Zeitraum, davon 1 Feiertag (01.05.2026 Erster Mai) → 4 × 1,6 h = 6,4 h; Summe 28,8 h → **28,8 h** | 28,8 h | 28,8 h | 28,8 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 1,6 h = 8 h; Dienstag: 5 im Zeitraum × 1,6 h = 8 h; Mittwoch: 4 im Zeitraum × 1,6 h = 6,4 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 1,6 h = 4,8 h; Freitag: 4 im Zeitraum × 1,6 h = 6,4 h; Summe 33,6 h → **33,6 h** | 33,6 h | 33,6 h | 33,6 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 1,6 h = 6,4 h; Dienstag: 4 im Zeitraum × 1,6 h = 6,4 h; Mittwoch: 5 im Zeitraum × 1,6 h = 8 h; Donnerstag: 5 im Zeitraum × 1,6 h = 8 h; Freitag: 5 im Zeitraum × 1,6 h = 8 h; Summe 36,8 h → **36,8 h** | 36,8 h | 36,8 h | 36,8 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 1,6 h = 4,8 h; Dienstag: 3 im Zeitraum × 1,6 h = 4,8 h; Mittwoch: 3 im Zeitraum × 1,6 h = 4,8 h; Donnerstag: 3 im Zeitraum × 1,6 h = 4,8 h; Freitag: 3 im Zeitraum × 1,6 h = 4,8 h; Summe 24 h → **24 h** | 24 h | 24 h | 24 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| April 2026 | 16 | 0 | 0 | 0 | 0 | **16** | 16 | 16 | ✓ |
| Mai 2026 | 2,25 | 0 | 0 | 0 | 0 | **2,25** | 2,25 | 2,25 | ✓ |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | −32 h | −32 h | — | −32 h | −32 h | ✓ |
| Februar 2026 | −32 h | −32 h | — | −32 h | −32 h | ✓ |
| März 2026 | −35,2 h | −35,2 h | — | −24 h | −35,2 h | ✓ |
| April 2026 | −16 h | −16 h | — | −18,4 h | −16 h | ✓ |
| Mai 2026 | −26,55 h | −26,55 h | — | 0,65 h | −26,55 h | ✓ |
| Juni 2026 | −33,6 h | −33,6 h | — | – | −33,6 h | ✓ |
| Juli 2026 | −36,8 h | −36,8 h | — | – | −36,8 h | ✓ |
| August 2026 | −24 h | −24 h | — | – | −24 h | ✓ |
| **Summe** | **−236,15 h** | **−236,15 h** | **0 h** | | **−236,15 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| März 2026 | −11,2 h | 7 Tage ohne Journalzeile (23.03.2026, 24.03.2026, 25.03.2026, 26.03.2026, 27.03.2026, 30.03.2026, 31.03.2026): −11,2 h; ungeklärter Rest: 0 h |
| April 2026 | 2,4 h | 1 Tag ohne Journalzeile (30.04.2026): 2,4 h; ungeklärter Rest: 0 h |
| Mai 2026 | −27,2 h | 17 Tage ohne Journalzeile (05.05.2026, 06.05.2026, 07.05.2026, 08.05.2026, 11.05.2026, 12.05.2026, 13.05.2026, 15.05.2026, 18.05.2026, 19.05.2026, 20.05.2026, 21.05.2026, 22.05.2026, 26.05.2026, 27.05.2026, 28.05.2026, 29.05.2026): −27,2 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 12 | 12 | 0 | 0 | 0 | 0 | 12 | 12 | ✓ |
| 2027 | 12 | 12 | 0 | 0 | 0 | 0 | 12 | 12 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von −236,15 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 26 — Test Test

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 26 |
| Name | Test Test |
| Benutzerkennung | `TestTest` |
| Rolle | Mitarbeiter |
| Bereich | nicht gesetzt |
| Eintrittsdatum | 26.02.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 0 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 0 h ÷ 5 = 0 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | inaktiv |
| Gelöscht (Soft-Delete) | **ja**, am 27.02.2026 |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

> **Hinweis:** Dieses Konto ist stillgelegt. Der Neuberechnungslauf vom 23.08.2026 hat es
> ausdrücklich übersprungen. Die Spalte „nachgerechnet" wird nachrichtlich mitgeführt, ist
> aber kein Maßstab für die gespeicherten Werte.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Februar 2026 | gezählt wird nur 26.02.2026 bis 28.02.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| März 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | – | – | 0 h | – |
| April 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | – | – | 0 h | – |
| Mai 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | – | – | 0 h | – |
| Juni 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | – | – | 0 h | – |
| Juli 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | – | – | 0 h | – |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | – | – | 0 h | – |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| April 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| Mai 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | – | – | – |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Februar 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| März 2026 | – | – | – | – | 0 h | – |
| April 2026 | – | – | – | – | 0 h | – |
| Mai 2026 | – | – | – | – | 0 h | – |
| Juni 2026 | – | – | – | – | 0 h | – |
| Juli 2026 | – | – | – | – | 0 h | – |
| August 2026 | – | – | – | – | 0 h | – |
| **Summe** | **0 h** | **0 h** | **0 h** | | **0 h** | |

> Für die Monate nach der Stilllegung ist im System keine Zeile mehr vorhanden (–). Die
> Spalte „nachgerechnet" rechnet dennoch weiter, als bestünde das Arbeitsverhältnis fort —
> deshalb weicht ihre Summe (0 h) vom gespeicherten Stand (0 h) ab. Maßgeblich
> ist der gespeicherte Stand; er ist durch das Deployment nicht verändert worden.

Journalsumme und Aggregat stimmen in allen Monaten überein, für die das Journal Zeilen enthält.

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 25,5 | 25,5 | 0 | 0 | 0 | 0 | 25,5 | 25,5 | ✓ |
| 2027 | 30 | 30 | 0 | 0 | 0 | 0 | 30 | 30 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von 0 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 27 — Reinhold Merl

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 27 |
| Name | Reinhold Merl |
| Benutzerkennung | `ReinholdMerl` |
| Rolle | Verwaltung (Administrator) |
| Bereich | Vorstand |
| Eintrittsdatum | 27.02.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 0 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 0 h ÷ 5 = 0 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Februar 2026 | gezählt wird nur 27.02.2026 bis 28.02.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| März 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| April 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Mai 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juni 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juli 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| April 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Mai 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Februar 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| März 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| April 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Mai 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Juni 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| Juli 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| August 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| **Summe** | **0 h** | **0 h** | **0 h** | | **0 h** | |

Journalsumme und Aggregat stimmen in allen Monaten überein, für die das Journal Zeilen enthält.

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von 0 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 28 — Test Test

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 28 |
| Name | Test Test |
| Benutzerkennung | `Test2` |
| Rolle | Mitarbeiter |
| Bereich | nicht gesetzt |
| Eintrittsdatum | 01.03.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 12 h |
| Hinterlegter Wochenplan | Montag 4 h, Dienstag 4 h, Donnerstag 4 h — an allen übrigen Wochentagen 0 h (Summe 12 h pro Woche) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | inaktiv |
| Gelöscht (Soft-Delete) | **ja**, am 21.08.2026 |

> Weil ein Wochenplan hinterlegt ist, hat dieser Vorrang. Die Angabe „Wochenstunden" im
> Stammsatz wird für die Sollstunden **nicht** verwendet.

> **Hinweis:** Dieses Konto ist stillgelegt. Der Neuberechnungslauf vom 23.08.2026 hat es
> ausdrücklich übersprungen. Die Spalte „nachgerechnet" wird nachrichtlich mitgeführt, ist
> aber kein Maßstab für die gespeicherten Werte.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| März 2026 | Montag: 5 im Zeitraum × 4 h = 20 h; Dienstag: 5 im Zeitraum × 4 h = 20 h; Donnerstag: 4 im Zeitraum × 4 h = 16 h; Summe 56 h → **56 h** | 56 h | 56 h | 56 h | ✓ |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 4 h = 12 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Donnerstag: 5 im Zeitraum × 4 h = 20 h; Summe 48 h → **48 h** | 48 h | 48 h | 48 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 4 h = 12 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 4 h = 12 h; Summe 40 h → **40 h** | 40 h | 40 h | 40 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 4 h = 20 h; Dienstag: 5 im Zeitraum × 4 h = 20 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 4 h = 12 h; Summe 52 h → **52 h** | 52 h | 52 h | 52 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 4 h = 16 h; Dienstag: 4 im Zeitraum × 4 h = 16 h; Donnerstag: 5 im Zeitraum × 4 h = 20 h; Summe 52 h → **52 h** | 52 h | 52 h | 52 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 4 h = 12 h; Dienstag: 3 im Zeitraum × 4 h = 12 h; Donnerstag: 3 im Zeitraum × 4 h = 12 h; Summe 36 h → **36 h** | 36 h | 36 h | 36 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| März 2026 | 0 | 0 | 0 | 0 | 91,5 | **91,5** | 91,5 | 91,5 | ✓ |
| April 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Mai 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

Eingetragene Korrekturen:

| Datum | Stunden | Begründung |
|---|---:|---|
| 26.03.2026 | −8,5 h | Anpassung der Arbeitszeit |
| 31.03.2026 | 100 h | Test Stunden |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| März 2026 | 35,5 h | 35,5 h | — | −24,5 h | 35,5 h | ✓ |
| April 2026 | −48 h | −48 h | — | −44 h | −48 h | ✓ |
| Mai 2026 | −40 h | −40 h | — | −40 h | −40 h | ✓ |
| Juni 2026 | −52 h | −52 h | — | – | −52 h | ✓ |
| Juli 2026 | −52 h | −52 h | — | −40 h | −52 h | ✓ |
| August 2026 | −36 h | −36 h | — | – | −36 h | ✓ |
| **Summe** | **−192,5 h** | **−192,5 h** | **0 h** | | **−192,5 h** | |

> Für die Monate nach der Stilllegung ist im System keine Zeile mehr vorhanden (–). Die
> Spalte „nachgerechnet" rechnet dennoch weiter, als bestünde das Arbeitsverhältnis fort —
> deshalb weicht ihre Summe (−192,5 h) vom gespeicherten Stand (−192,5 h) ab. Maßgeblich
> ist der gespeicherte Stand; er ist durch das Deployment nicht verändert worden.

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| März 2026 | 60 h | 10 Tage ohne Journalzeile (02.03.2026, 03.03.2026, 05.03.2026, 09.03.2026, 10.03.2026, 12.03.2026, 16.03.2026, 17.03.2026, 19.03.2026, 31.03.2026): 60 h; ungeklärter Rest: 0 h |
| April 2026 | −4 h | 1 Tag ohne Journalzeile (30.04.2026): −4 h; ungeklärter Rest: 0 h |
| Juli 2026 | −12 h | 3 Tage ohne Journalzeile (27.07.2026, 28.07.2026, 30.07.2026): −12 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von −192,5 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Nutzer 29 — Christina Wasensteiner

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 29 |
| Name | Christina Wasensteiner |
| Benutzerkennung | `ChristinaWasensteiner` |
| Rolle | Mitarbeiter |
| Bereich | Reinigung Fall |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 0 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 0 h ÷ 5 = 0 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | aktiv |
| Gelöscht (Soft-Delete) | nein |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Februar 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| März 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| April 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Mai 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juni 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| Juli 2026 | an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; an keinem Wochentag sind Sollstunden hinterlegt → **0 h** | 0 h | 0 h | 0 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 8 | 0 | 0 | 0 | 0 | **8** | 8 | 8 | ✓ |
| Februar 2026 | 10 | 0 | 0 | 0 | 0 | **10** | 10 | 10 | ✓ |
| März 2026 | 9,66 | 0 | 0 | 0 | −20,5 | **−10,84** | 9,66 | −10,84 | ✓ |
| April 2026 | 16,2 | 0 | 0 | 0 | 0 | **16,2** | 16,2 | 16,2 | ✓ |
| Mai 2026 | 13,6 | 0 | 0 | 0 | 0 | **13,6** | 13,6 | 13,6 | ✓ |
| Juni 2026 | 15,5 | 0 | 0 | 0 | 0 | **15,5** | 15,5 | 15,5 | ✓ |
| Juli 2026 | 12,82 | 0 | 0 | 0 | 0 | **12,82** | 12,82 | 12,82 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

Eingetragene Korrekturen:

| Datum | Stunden | Begründung |
|---|---:|---|
| 01.03.2026 | −20,5 h | Anpassung zur besseren Übersicht |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 8 h | 8 h | — | 8 h | 8 h | ✓ |
| Februar 2026 | 10 h | 10 h | — | 10 h | 10 h | ✓ |
| März 2026 | 9,66 h | −10,84 h | −20,5 h | −10,84 h | −10,84 h | ✓ |
| April 2026 | 16,2 h | 16,2 h | — | 16,2 h | 16,2 h | ✓ |
| Mai 2026 | 13,6 h | 13,6 h | — | 13,6 h | 13,6 h | ✓ |
| Juni 2026 | 15,5 h | 15,5 h | — | 15,5 h | 15,5 h | ✓ |
| Juli 2026 | 12,82 h | 12,82 h | — | 10,82 h | 12,82 h | ✓ |
| August 2026 | 0 h | 0 h | — | – | 0 h | ✓ |
| **Summe** | **85,78 h** | **65,28 h** | **−20,5 h** | | **65,28 h** | |

Wo Journalsumme und Aggregat auseinandergehen, ist die Ursache jeweils benannt:

| Monat | Differenz Aggregat − Journal | erklärt durch |
|---|---:|---|
| Juli 2026 | 2 h | 1 Tag ohne Journalzeile (31.07.2026): 2 h; ungeklärter Rest: 0 h |

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Geändert und nachgerechnet richtig.** Von 85,78 h auf 65,28 h (−20,5 h). Jeder einzelne Monatswert entspricht exakt der unabhängigen Nachrechnung aus Wochenplan, Feiertagen, Zeiteinträgen, Abwesenheiten und Korrekturen.

---

## Nutzer 30 — Test Urlaub

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 30 |
| Name | Test Urlaub |
| Benutzerkennung | `TestUrlaub` |
| Rolle | Mitarbeiter |
| Bereich | nicht gesetzt |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 40 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 40 h ÷ 5 = 8 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 20 Tage/Jahr |
| Konto-Status | inaktiv |
| Gelöscht (Soft-Delete) | **ja**, am 21.08.2026 |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

> **Hinweis:** Dieses Konto ist stillgelegt. Der Neuberechnungslauf vom 23.08.2026 hat es
> ausdrücklich übersprungen. Die Spalte „nachgerechnet" wird nachrichtlich mitgeführt, ist
> aber kein Maßstab für die gespeicherten Werte.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Dienstag: 4 im Zeitraum, davon 1 Feiertag (06.01.2026 Heilige Drei Könige) → 3 × 8 h = 24 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 5 im Zeitraum, davon 1 Feiertag (01.01.2026 Neujahr) → 4 × 8 h = 32 h; Freitag: 5 im Zeitraum × 8 h = 40 h; Summe 160 h → **160 h** | 160 h | 160 h | 160 h | ✓ |
| Februar 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Dienstag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 8 h = 32 h; Summe 160 h → **160 h** | 160 h | 160 h | 160 h | ✓ |
| März 2026 | Montag: 5 im Zeitraum × 8 h = 40 h; Dienstag: 5 im Zeitraum × 8 h = 40 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 8 h = 32 h; Summe 176 h → **176 h** | 176 h | 176 h | 176 h | ✓ |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 8 h = 24 h; Dienstag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 5 im Zeitraum × 8 h = 40 h; Donnerstag: 5 im Zeitraum × 8 h = 40 h; Freitag: 4 im Zeitraum, davon 1 Feiertag (03.04.2026 Karfreitag) → 3 × 8 h = 24 h; Summe 160 h → **160 h** | 160 h | 160 h | 160 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 8 h = 24 h; Dienstag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 8 h = 24 h; Freitag: 5 im Zeitraum, davon 1 Feiertag (01.05.2026 Erster Mai) → 4 × 8 h = 32 h; Summe 144 h → **144 h** | 144 h | 144 h | 144 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 8 h = 40 h; Dienstag: 5 im Zeitraum × 8 h = 40 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 8 h = 24 h; Freitag: 4 im Zeitraum × 8 h = 32 h; Summe 168 h → **168 h** | 168 h | 168 h | 168 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Dienstag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 5 im Zeitraum × 8 h = 40 h; Donnerstag: 5 im Zeitraum × 8 h = 40 h; Freitag: 5 im Zeitraum × 8 h = 40 h; Summe 184 h → **184 h** | 184 h | 184 h | 184 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 8 h = 24 h; Dienstag: 3 im Zeitraum × 8 h = 24 h; Mittwoch: 3 im Zeitraum × 8 h = 24 h; Donnerstag: 3 im Zeitraum × 8 h = 24 h; Freitag: 3 im Zeitraum × 8 h = 24 h; Summe 120 h → **120 h** | 120 h | 120 h | 120 h | ✓ |
| Oktober 2026 | Der Monat hatte am Stichtag 23.08.2026 noch nicht begonnen — bis dahin sind keine Sollstunden entstanden → **0 h** | 176 h | 176 h | 0 h | ✗ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| April 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Mai 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Oktober 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | −160 h | −160 h | — | – | −160 h | ✓ |
| Februar 2026 | −160 h | −160 h | — | – | −160 h | ✓ |
| März 2026 | −176 h | −176 h | — | – | −176 h | ✓ |
| April 2026 | −160 h | −160 h | — | – | −160 h | ✓ |
| Mai 2026 | −144 h | −144 h | — | – | −144 h | ✓ |
| Juni 2026 | −168 h | −168 h | — | – | −168 h | ✓ |
| Juli 2026 | −184 h | −184 h | — | – | −184 h | ✓ |
| August 2026 | −120 h | −120 h | — | – | −120 h | ✓ |
| Oktober 2026 | −176 h | −176 h | — | −176 h | 0 h | ✗ |
| **Summe** | **−1448 h** | **−1448 h** | **0 h** | | **−1272 h** | |

> Für die Monate nach der Stilllegung ist im System keine Zeile mehr vorhanden (–). Die
> Spalte „nachgerechnet" rechnet dennoch weiter, als bestünde das Arbeitsverhältnis fort —
> deshalb weicht ihre Summe (−1272 h) vom gespeicherten Stand (−1448 h) ab. Maßgeblich
> ist der gespeicherte Stand; er ist durch das Deployment nicht verändert worden.

Journalsumme und Aggregat stimmen in allen Monaten überein, für die das Journal Zeilen enthält.

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 15 | 15 | 0 | 0 | 0 | 0 | 15 | 15 | ✓ |
| 2027 | 20 | 20 | 0 | 0 | 0 | 0 | 20 | 20 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Stand von −1448 h wurde nicht angefasst. Das Konto ist seit der Löschung am 21.08.2026 eingefroren; der Neuberechnungslauf überspringt gelöschte Nutzer ausdrücklich. Eine Nachrechnung über den vollen Zeitraum ist deshalb nicht aussagekräftig und wird unten nur nachrichtlich gezeigt.

---

## Nutzer 31 — UA T

### Stammdaten

| Feld | Wert |
|---|---|
| Nutzer-Nummer | 31 |
| Name | UA T |
| Benutzerkennung | `UAT` |
| Rolle | Mitarbeiter |
| Bereich | nicht gesetzt |
| Eintrittsdatum | 01.01.2026 |
| Austrittsdatum | kein Austritt hinterlegt |
| Wochenstunden im Stammsatz | 40 h |
| Hinterlegter Wochenplan | kein Wochenplan hinterlegt — es gilt die Ersatzregel: 40 h ÷ 5 = 8 h an jedem Werktag (Montag bis Freitag) |
| Urlaubsanspruch im Stammsatz | 0 Tage/Jahr |
| Konto-Status | inaktiv |
| Gelöscht (Soft-Delete) | **ja**, am 21.08.2026 |

> Weil kein Wochenplan hinterlegt ist, gilt die Ersatzregel: Wochenstunden geteilt durch 5,
> angesetzt an jedem Werktag von Montag bis Freitag. Feiertage zählen 0 h.

> **Hinweis:** Dieses Konto ist stillgelegt. Der Neuberechnungslauf vom 23.08.2026 hat es
> ausdrücklich übersprungen. Die Spalte „nachgerechnet" wird nachrichtlich mitgeführt, ist
> aber kein Maßstab für die gespeicherten Werte.

### 1. Sollstunden je Monat

| Monat | Herleitung (unabhängig gerechnet) | Soll alt | Soll neu | Soll nachgerechnet | Stimmt? |
|---|---|---:|---:|---:|:--:|
| Januar 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Dienstag: 4 im Zeitraum, davon 1 Feiertag (06.01.2026 Heilige Drei Könige) → 3 × 8 h = 24 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 5 im Zeitraum, davon 1 Feiertag (01.01.2026 Neujahr) → 4 × 8 h = 32 h; Freitag: 5 im Zeitraum × 8 h = 40 h; Summe 160 h → **160 h** | 160 h | 160 h | 160 h | ✓ |
| Februar 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Dienstag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 8 h = 32 h; Summe 160 h → **160 h** | 160 h | 160 h | 160 h | ✓ |
| März 2026 | Montag: 5 im Zeitraum × 8 h = 40 h; Dienstag: 5 im Zeitraum × 8 h = 40 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum × 8 h = 32 h; Freitag: 4 im Zeitraum × 8 h = 32 h; Summe 176 h → **176 h** | 176 h | 176 h | 176 h | ✓ |
| April 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (06.04.2026 Ostermontag) → 3 × 8 h = 24 h; Dienstag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 5 im Zeitraum × 8 h = 40 h; Donnerstag: 5 im Zeitraum × 8 h = 40 h; Freitag: 4 im Zeitraum, davon 1 Feiertag (03.04.2026 Karfreitag) → 3 × 8 h = 24 h; Summe 160 h → **160 h** | 160 h | 160 h | 160 h | ✓ |
| Mai 2026 | Montag: 4 im Zeitraum, davon 1 Feiertag (25.05.2026 Pfingstmontag) → 3 × 8 h = 24 h; Dienstag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (14.05.2026 Christi Himmelfahrt) → 3 × 8 h = 24 h; Freitag: 5 im Zeitraum, davon 1 Feiertag (01.05.2026 Erster Mai) → 4 × 8 h = 32 h; Summe 144 h → **144 h** | 144 h | 144 h | 144 h | ✓ |
| Juni 2026 | Montag: 5 im Zeitraum × 8 h = 40 h; Dienstag: 5 im Zeitraum × 8 h = 40 h; Mittwoch: 4 im Zeitraum × 8 h = 32 h; Donnerstag: 4 im Zeitraum, davon 1 Feiertag (04.06.2026 Fronleichnam) → 3 × 8 h = 24 h; Freitag: 4 im Zeitraum × 8 h = 32 h; Summe 168 h → **168 h** | 168 h | 168 h | 168 h | ✓ |
| Juli 2026 | Montag: 4 im Zeitraum × 8 h = 32 h; Dienstag: 4 im Zeitraum × 8 h = 32 h; Mittwoch: 5 im Zeitraum × 8 h = 40 h; Donnerstag: 5 im Zeitraum × 8 h = 40 h; Freitag: 5 im Zeitraum × 8 h = 40 h; Summe 184 h → **184 h** | 184 h | 184 h | 184 h | ✓ |
| August 2026 | gezählt wird nur 01.08.2026 bis 23.08.2026; Montag: 3 im Zeitraum × 8 h = 24 h; Dienstag: 3 im Zeitraum × 8 h = 24 h; Mittwoch: 3 im Zeitraum × 8 h = 24 h; Donnerstag: 3 im Zeitraum × 8 h = 24 h; Freitag: 3 im Zeitraum × 8 h = 24 h; Summe 120 h → **120 h** | 120 h | 120 h | 120 h | ✓ |

### 2. Iststunden je Monat, aufgeschlüsselt

| Monat | Zeiteinträge | Urlaubs­gutschrift | Krankheits­gutschrift | Überstunden­ausgleich | Korrekturen | = Ist nachgerechnet | Ist alt | Ist neu | Stimmt? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Februar 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| März 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| April 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Mai 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juni 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| Juli 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |
| August 2026 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 | ✓ |

### 3. Überstunden je Monat

| Monat | alt | neu | Differenz | Journalsumme | nachgerechnet | Stimmt? |
|---|---:|---:|---:|---:|---:|:--:|
| Januar 2026 | −160 h | −160 h | — | – | −160 h | ✓ |
| Februar 2026 | −160 h | −160 h | — | – | −160 h | ✓ |
| März 2026 | −176 h | −176 h | — | – | −176 h | ✓ |
| April 2026 | −160 h | −160 h | — | – | −160 h | ✓ |
| Mai 2026 | −144 h | −144 h | — | – | −144 h | ✓ |
| Juni 2026 | −168 h | −168 h | — | – | −168 h | ✓ |
| Juli 2026 | −184 h | −184 h | — | – | −184 h | ✓ |
| August 2026 | −120 h | −120 h | — | – | −120 h | ✓ |
| **Summe** | **−1272 h** | **−1272 h** | **0 h** | | **−1272 h** | |

> Für die Monate nach der Stilllegung ist im System keine Zeile mehr vorhanden (–). Die
> Spalte „nachgerechnet" rechnet dennoch weiter, als bestünde das Arbeitsverhältnis fort —
> deshalb weicht ihre Summe (−1272 h) vom gespeicherten Stand (−1272 h) ab. Maßgeblich
> ist der gespeicherte Stand; er ist durch das Deployment nicht verändert worden.

Journalsumme und Aggregat stimmen in allen Monaten überein, für die das Journal Zeilen enthält.

### 4. Urlaub je Jahr

| Jahr | Anspruch vor | Anspruch nach | Übertrag vor | Übertrag nach | Genommen vor | Genommen nach | Rest vor | Rest nach | unverändert? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |

Rest = Anspruch + Übertrag − Genommen. Die Werte sind vor und nach dem Deployment
zeichengleich; die Prüfsumme der gesamten Tabelle `vacation_balance` ist unverändert
(siehe Vorabprüfung).

### Urteil

**Unverändert.** Der Überstundenstand von −1272 h ist vor und nach dem Deployment identisch und stimmt mit der unabhängigen Nachrechnung überein.

---

## Anhang A — Die angewandten Rechenregeln im Wortlaut

So wurde in diesem Dokument jeder Wert unabhängig nachgerechnet. Die Regeln entsprechen der
heute im System hinterlegten Fachlogik.

**Sollstunden eines Tages**

1. Ist der Tag ein Feiertag laut Feiertagstabelle → 0 Stunden. Diese Regel gilt vor allen
   anderen und überschreibt auch einen Wochenplan.
2. Liegt der Tag vor dem Eintrittsdatum → 0 Stunden.
3. Ist ein Wochenplan hinterlegt → die dort für diesen Wochentag eingetragenen Stunden.
4. Sonst: Sind die Wochenstunden 0 → 0 Stunden. Ist der Tag Samstag oder Sonntag → 0 Stunden.
   Andernfalls Wochenstunden ÷ 5.
5. Liegt für den Tag ein genehmigter **unbezahlter** Urlaub vor → das Soll wird auf 0 gesetzt.

**Iststunden eines Tages**

- Summe der erfassten Zeiteinträge dieses Tages
- **plus** Gutschrift bei genehmigtem Urlaub, Krankheit oder Sonderurlaub: in Höhe der
  Sollstunden dieses Tages (vor Abzug für unbezahlten Urlaub). Ein Tag mit 0 Sollstunden
  bekommt keine Gutschrift.
- **plus** alle manuellen Korrekturen mit diesem Datum (positiv wie negativ)
- **kein** Zuschlag für Überstundenausgleich (dieser wird aus dem Konto bezahlt)
- **kein** Zuschlag für unbezahlten Urlaub

**Monat**

- Gerechnet wird vom ersten Tag des Monats (frühestens ab Eintritt) bis zum letzten Tag des
  Monats, höchstens jedoch bis zum 23.08.2026.
- Überstunden des Monats = Iststunden − Sollstunden.
- Kontostand = Summe der Überstunden aller gespeicherten Monatszeilen.

---

## Anhang B — Prüfprotokoll

| Prüfung | Umfang | Ergebnis |
|---|---|---|
| Rohdaten unverändert | 9 Tabellen, vollständig ausgelesen und geprüfsummt | 8 identisch, nur `overtime_balance` verändert |
| Nachrechnung gegen den neuen Stand | 144 Monatszeilen | 141 exakt gleich, 3 Ausnahmen (Zukunftsmonate, gelöschte Konten) |
| Rekonstruktion der alten Rechenweise | 144 Monatszeilen | 134 exakt getroffen (Soll und Ist), 10 Ausnahmen |
| Journal gegen Aggregat, vorher | 89 Monatszeilen | 33 gleich |
| Journal gegen Aggregat, nachher | 89 Monatszeilen | 51 gleich |
| Journal-Abstimmung mit Lückenausgleich | 144 Monatszeilen | 144 gehen mit Restdifferenz 0 auf |
| Urlaubskonten | 40 Zeilen | unverändert |

**Ausnahmen der Nachrechnung im Einzelnen**

| Nutzer | Monat | nachgerechnet | gespeichert | Grund |
|---:|---|---:|---:|---|
| 3 | September 2026 | 0 h | −20 h | Zukunftsmonat — vom Neuberechnungslauf nicht angefasst |
| 17 | September 2026 | 0 h | −44 h | Zukunftsmonat — vom Neuberechnungslauf nicht angefasst |
| 30 | Oktober 2026 | 0 h | −176 h | Konto am 21.08.2026 gelöscht — vom Neuberechnungslauf übersprungen |

**Ausnahmen der Rekonstruktion der alten Rechenweise**

| Nutzer | Monat | Modell Soll/Ist | gespeichert Soll/Ist | Grund |
|---:|---|---|---|---|
| 3 | September 2026 | 0 / 6,4 | 36 / 16 | Zukunftsmonat: Zeile wurde beim Genehmigen eines Antrags mit vollem Monatssoll angelegt |
| 15 | Januar 2026 | 0 / 88,54 | 84 / 88,54 | gelöschtes Konto: Werte stammen noch aus der App, nicht aus dem nächtlichen Lauf |
| 15 | Februar 2026 | 0 / 80 | 80 / 80 | gelöschtes Konto: Werte stammen noch aus der App, nicht aus dem nächtlichen Lauf |
| 15 | März 2026 | 0 / 0 | 88 / 0 | gelöschtes Konto: Werte stammen noch aus der App, nicht aus dem nächtlichen Lauf |
| 17 | September 2026 | 0 / 9,6 | 52 / 8 | Zukunftsmonat: Zeile wurde beim Genehmigen eines Antrags mit vollem Monatssoll angelegt |
| 28 | März 2026 | 52,8 / 0 | 56 / 91,5 | gelöschtes Konto: Werte stammen noch aus der App, nicht aus dem nächtlichen Lauf |
| 28 | Mai 2026 | 43,2 / 0 | 40 / 0 | gelöschtes Konto: Werte stammen noch aus der App, nicht aus dem nächtlichen Lauf |
| 28 | Juni 2026 | 50,4 / 0 | 52 / 0 | gelöschtes Konto: Werte stammen noch aus der App, nicht aus dem nächtlichen Lauf |
| 28 | Juli 2026 | 55,2 / 0 | 52 / 0 | gelöschtes Konto: Werte stammen noch aus der App, nicht aus dem nächtlichen Lauf |
| 30 | Oktober 2026 | 0 / 0 | 176 / 0 | gelöschtes Konto: Werte stammen noch aus der App, nicht aus dem nächtlichen Lauf |

---

*Ende des Nachweises.*