---
title: Urlaubsanspruch bei Teilzeitwechsel historisieren
planted_date: 2026-08-21
trigger_condition: Sobald ein Stundenwechsel die Anzahl der Arbeitstage pro Woche ändert, oder sobald vacationDaysPerYear erstmals angefasst wird
status: bewusst außerhalb des Scopes von Milestone 3
---

# Urlaubsanspruch bei Teilzeitwechsel

## Der Keim

`users.vacationDaysPerYear` (`server/src/database/schema.ts:44`) liegt genauso flach ohne
Historie da wie `weeklyHours` und `workSchedule`. Beim Zuschnitt von Milestone 3
(historisierte Arbeitszeitmodelle) wurde bewusst entschieden, die Urlaubstage **nicht**
mitzunehmen — der anstehende konkrete Fall ändert nur die Stunden, nicht die Wochentage.

Siehe `.planning/notes/arbeitszeitmodelle-historisierung.md`.

## Warum das später wichtig wird

Wer von 5 auf 3 Arbeitstage pro Woche wechselt, hat anteilig weniger Urlaubsanspruch —
gerechnet in *Tagen*. Der Fallstrick: Nach EuGH-Rechtsprechung dürfen **bereits erworbene**
Urlaubsansprüche bei einem Wechsel auf Teilzeit nicht nachträglich gekürzt werden. Nur der
ab dem Wechsel neu entstehende Anspruch richtet sich nach dem neuen Modell.

Eine naive Umrechnung des gesamten Jahresanspruchs beim Wechsel lässt genau das passieren,
was Milestone 2 gerade behoben hat: **Urlaubstage verschwinden unbemerkt.**

Vor der Umsetzung ist die genaue Rechtslage zu prüfen (EuGH zum unterjährigen
Teilzeitwechsel, Übertrag aus dem Vorjahr, Umgang mit bereits genommenen Tagen).

## Vorhandenes Fundament

Anders als bei den Überstunden existiert für den Urlaub seit Milestone 2 bereits ein
Journal: `vacation_transactions` mit Buchungstypen und Kontoauszug. Eine anteilige
Anspruchsanpassung wäre dort eine reguläre Buchung mit Begründung — sichtbar im Auszug,
statt einer stillen Neuberechnung. Das Fundament dafür steht also schon.

## Auslöser für die Umsetzung

- Ein Stundenwechsel ändert die **Anzahl der Arbeitstage** (nicht nur die Stundenzahl pro Tag)
- Oder: Der Jahresanspruch soll erstmals abhängig vom Arbeitszeitmodell berechnet werden
- Oder: Ein Mitarbeiter reklamiert Urlaubstage nach einem Modellwechsel

## Verwandt

- `.planning/notes/arbeitszeitmodelle-historisierung.md` — das Perioden-Modell, an das sich
  eine spätere Historisierung von `vacationDaysPerYear` anhängen würde
- Milestone 2 — `vacation_transactions`, Journal-Muster, Kontoauszug
