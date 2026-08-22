import { formatHours } from '../../utils/timeUtils';

/**
 * Reine Textbausteine und Ableitungsregeln der Löschbestätigung
 * (`ConfirmDialog variant="danger"`, 13-UI-SPEC.md Abschnitt 4 „Löschbestätigung" und Textbuch
 * „Löschbestätigung"), aus der Komponente gezogen, damit sie ohne Renderer und ohne vitest (im
 * Desktop projektweit nicht lauffähig, fehlendes `@babel/runtime`) maschinell geprüft werden
 * können (`workTimePeriodDeleteRules.check.ts`, `npx tsx` + `node:assert`) — dasselbe Muster wie
 * `workTimePeriodEditRules.ts` (Plan 13-08).
 *
 * DD-38: Diese Datei bestimmt NICHT, ob die Server-Vorschau geladen ist oder fehlgeschlagen —
 * das liefert `useDeleteWorkPeriodPreview()` (Plan 13-07). Sie formt nur die Sätze aus den
 * bereits vorliegenden Werten.
 */

/** Zeitzonen-sichere Anzeige eines ISO-Datums — niemals über die UTC-Split-Methode aus
 *  `.claude/CLAUDE.md` ("Timezone bugs!"). */
function formatGermanDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE');
}

function formatWeeklyHoursDe(hours: number): string {
  return hours.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Vorzeichenbehaftete Stundenanzeige, "± 0:00h" bei der Nulldifferenz — wortgleiches Muster
 *  aus `WorkTimePeriodEditModal.tsx`/`overtimeTransactionFormat.ts`. */
function formatSignedHours(value: number): string {
  if (value === 0) return '± 0:00h';
  return `${value > 0 ? '+' : ''}${formatHours(value)}`;
}

export function deleteConfirmTitle(): string {
  return 'Periode löschen';
}

export interface DeleteConfirmMessageArgs {
  validFrom: string;
  /** null bei der laufenden (offenen) Periode — dieselbe Konvention wie im Korrektur-Dialog
   *  ("offen" statt eines Datums, `WorkTimePeriodEditModal.tsx`). Das Textbuch nennt diesen
   *  Randfall nicht ausdrücklich; ohne Fallback stünde "bis " gefolgt von "Invalid Date". */
  validTo: string | null;
  weeklyHours: number;
  firstName: string;
  lastName: string;
}

/** `message` der Löschbestätigung — welche Periode, welcher Zeitraum, welche Stunden, wessen. */
export function deleteConfirmMessage(args: DeleteConfirmMessageArgs): string {
  const fromDate = formatGermanDate(args.validFrom);
  const toDate = args.validTo ? formatGermanDate(args.validTo) : 'offen';
  const hours = formatWeeklyHoursDe(args.weeklyHours);
  return `Die Periode vom ${fromDate} bis ${toDate} (${hours} h/Woche) für ${args.firstName} ${args.lastName} wird gelöscht.`;
}

export interface DeleteDetailGapClosureArgs {
  previousValidFrom: string;
  previousWeeklyHours: number;
  /** `WorkPeriodDeletionPreview.previousPeriod.newValidTo` — null, wenn die gelöschte Periode
   *  die letzte (offene) war: die Vorperiode wird dann selbst zur offenen Periode. */
  newValidTo: string | null;
}

/** Punkt 1 der `details`-Liste: Lückenschluss durch die Vorperiode (D3). */
export function deleteDetailGapClosure(args: DeleteDetailGapClosureArgs): string {
  const fromDate = formatGermanDate(args.previousValidFrom);
  const hours = formatWeeklyHoursDe(args.previousWeeklyHours);
  if (args.newValidTo === null) {
    return `Die Periode davor (ab ${fromDate}, ${hours} h/Woche) gilt danach unbefristet weiter — es entsteht keine Lücke.`;
  }
  const toDate = formatGermanDate(args.newValidTo);
  return `Die Periode davor (ab ${fromDate}, ${hours} h/Woche) gilt danach bis zum ${toDate} — es entsteht keine Lücke.`;
}

export interface DeleteDetailReversalArgs {
  /** `WorkPeriodDeletionPreview.reversedTransactions` — Abweichung vom Textbuch (das nur den
   *  Einzahlfall "die zugehörige Buchung" kennt): eine Periode kann mehr als eine
   *  `model_change`-Buchung tragen (server/13-02-PLAN.md, Desktop-Vertrag `types/index.ts`
   *  Kommentar „ABWEICHUNG VOM DATENVERTRAG"). Mehr als ein Eintrag löst die Mehrzahlform aus. */
  reversedTransactions: Array<{ hours: number }>;
}

/**
 * Punkt 2 der `details`-Liste: Storno statt Löschung (D2).
 *
 * WR-01 (Code-Review Phase 13) — zwei Fälle, die die frühere Fassung falsch beschrieb:
 *
 * 1. LEERE LISTE. Eine Periode ohne jede `model_change`-Buchung ist der Regelfall (Stichtag
 *    in der Zukunft, Anlegen ohne Saldowirkung). Die frühere Fassung fiel in den
 *    Einzahl-Zweig und behauptete eine Buchung „über ± 0:00h", die es nicht gibt: der
 *    Server iteriert beim Löschen über eine leere Liste, es entsteht keine Gegenbuchung,
 *    und es bleiben keine zwei Zeilen sichtbar.
 * 2. MEHRERE BUCHUNGEN, DIE SICH AUFHEBEN. Bei +5 und −5 lieferte die Summe ebenfalls
 *    „± 0:00h" — eine Summenangabe, die direkt neben dem echten `balanceDelta` aus Punkt 3
 *    steht und dort als Saldoaussage missverstanden wird. In der Mehrzahl werden deshalb
 *    die EINZELBETRÄGE genannt, nicht ihre Summe.
 */
export function deleteDetailReversal(args: DeleteDetailReversalArgs): string {
  if (args.reversedTransactions.length === 0) {
    return 'Zu dieser Periode gibt es keine Buchung im Kontoauszug — es wird nichts storniert.';
  }
  if (args.reversedTransactions.length > 1) {
    const amounts = args.reversedTransactions.map((t) => formatSignedHours(t.hours)).join(', ');
    return `Die zugehörigen Buchungen (${amounts}) werden nicht entfernt. Sie werden durch Gegenbuchungen ausgeglichen. Beide Seiten bleiben im Kontoauszug sichtbar.`;
  }
  const amount = formatSignedHours(args.reversedTransactions[0].hours);
  return `Die zugehörige Buchung über ${amount} wird nicht entfernt. Sie wird durch eine Gegenbuchung ausgeglichen. Beide Zeilen bleiben im Kontoauszug sichtbar.`;
}

export interface DeleteDetailRebuildArgs {
  rebuildFrom: string;
  balanceBefore: number;
  balanceAfter: number;
  balanceDelta: number;
}

export interface DeleteDetailRebuildParts {
  /** Kontextsatz — `text-sm`, neutral. Trägt keinen Zahlenwert und wird nie hervorgehoben. */
  context: string;
  /** Text vor dem hervorgehobenen Betrag. Leer, wenn es keinen Betrag gibt. */
  balancePrefix: string;
  /** Der EINZIGE hervorzuhebende Teil: ein vorzeichenbehafteter Stundenwert — oder `null`,
   *  wenn sich der Saldo nicht ändert und es folglich nichts hervorzuheben gibt. */
  balanceValue: string | null;
  /** Text nach dem Betrag — bzw. der vollständige Satz, wenn es keinen Betrag gibt. */
  balanceSuffix: string;
}

/**
 * Punkt 3 der `details`-Liste — der visuelle Anker der Löschbestätigung (13-UI-SPEC.md
 * Abschnitt „Visueller Anker"): aus der Server-Vorschau, NIE selbst gerechnet (DD-38).
 *
 * M-5 (UI-Review Phase 13): Die Komponente legte die VOLLSTÄNDIGE Rückgabe dieser Funktion in
 * einen `text-lg font-bold`-Span mit Signalfarbe — rund 150 Zeichen, im `max-w-md`-Dialog vier
 * bis fünf Zeilen durchgehend fett gefärbter Fließtext. Der Vertrag reserviert Gewicht 700
 * aber „ausschließlich für vorzeichenbehaftete Stundenwerte", und ein Anker, der fünf Zeilen
 * lang ist, hebt sich von nichts mehr ab: Die eigentliche Zahl ging in der eigenen
 * Hervorhebung unter. Der Nachbardialog aus Phase 12 hebt an derselben Stelle nur ein kurzes
 * Label samt Zahl hervor.
 *
 * Der Wortlaut aus dem Textbuch bleibt dabei UNVERÄNDERT — er wird nur so zerlegt, dass die
 * Komponente den Kontextsatz neutral setzen und allein den Stundenwert hervorheben kann.
 * `deleteDetailRebuild()` setzt die Teile wieder zusammen und hält damit fest, dass sich am
 * Satz selbst nichts geändert hat.
 */
export function deleteDetailRebuildParts(args: DeleteDetailRebuildArgs): DeleteDetailRebuildParts {
  const context = `Neu gerechnet wird vom ${formatGermanDate(args.rebuildFrom)} bis heute.`;
  if (args.balanceDelta === 0) {
    return {
      context,
      balancePrefix: '',
      balanceValue: null,
      balanceSuffix: 'Der Überstundensaldo bleibt dabei unverändert.',
    };
  }
  return {
    context,
    balancePrefix: 'Der Überstundensaldo ändert sich dabei um ',
    balanceValue: formatSignedHours(args.balanceDelta),
    balanceSuffix: ` — von ${formatSignedHours(args.balanceBefore)} auf ${formatSignedHours(
      args.balanceAfter
    )}.`,
  };
}

/** Punkt 3 als durchgehender Satz — die Zusammensetzung der Teile aus
 *  `deleteDetailRebuildParts()`. Dient dem Prüfskript als Beleg, dass der Wortlaut des
 *  Textbuchs durch die Aufteilung (M-5) unangetastet geblieben ist. */
export function deleteDetailRebuild(args: DeleteDetailRebuildArgs): string {
  const parts = deleteDetailRebuildParts(args);
  return `${parts.context} ${parts.balancePrefix}${parts.balanceValue ?? ''}${parts.balanceSuffix}`;
}

export function deleteConfirmText(): string {
  return 'Ja, Periode löschen und stornieren';
}

export function deleteCancelText(): string {
  return 'Abbrechen';
}

/** `aria-label` des Bestätigungsknopfes (Barrierefreiheit, 13-UI-SPEC.md). */
export function deleteConfirmAriaLabel(validFrom: string): string {
  return `Periode vom ${formatGermanDate(validFrom)} löschen und stornieren`;
}

/**
 * DD-38: Der Bestätigungsknopf bleibt gesperrt, solange die Server-Vorschau nicht bereitsteht
 * ODER fehlgeschlagen ist ODER das Löschen bereits läuft — in KEINEM dieser drei Fälle wird
 * ohne servergerechnete Zahl gelöscht.
 */
export function isDeleteConfirmDisabled(args: {
  previewReady: boolean;
  previewFailed: boolean;
  isDeleting: boolean;
}): boolean {
  return !args.previewReady || args.previewFailed || args.isDeleting;
}
