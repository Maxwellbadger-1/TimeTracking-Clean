/**
 * Preview Token — zustandsloses, signiertes Token für den Stundenwechsel-Trockenlauf
 *
 * WARUM (D2, REQ-27): Vorschau und Speichern laufen über dieselbe Codebahn
 * (`applyWorkTimeChange`, Plan 12-03 Task 2). Damit der Speichern-Aufruf nachweislich
 * dieselbe geprüfte Berechnung bestätigt, die der Anwender in der Vorschau gesehen hat,
 * bindet dieses Token genau die vier Eingabefelder, aus denen die Berechnung hervorgeht:
 * `userId`, `validFrom`, `weeklyHours`, `workSchedule`. Die Begründung ist AUSDRÜCKLICH
 * NICHT gebunden (12-UI-SPEC.md, Abschnitt "previewToken") — sonst würde das Tippen der
 * Pflichtbegründung nach der Vorschau das Token entwerten.
 *
 * ZUSTANDSLOS: kein Serverspeicher, keine Tabelle, kein Neustartproblem. Das Token trägt
 * seinen Ausstellungszeitstempel selbst und wird bei jeder Prüfung neu gegen die aktuell
 * eingegebenen vier Felder verifiziert — es gibt keine Map, keine Tabelle, kein modulweites
 * Gedächtnis in dieser Datei.
 *
 * FORMAT: `v1.<issuedAtMs>.<signaturBase64Url>`. Die Signatur ist ein HMAC-SHA256 über die
 * kanonische Zeichenkette `v1|<userId>|<validFrom>|<weeklyHours mit toFixed(2)>|
 * <kanonisierter workSchedule>|<issuedAtMs>`, mit `SESSION_SECRET` als Schlüssel — dasselbe
 * Muster, das `server.ts` bereits für den Session-Cookie verwendet (Ersatzwert
 * `'dev-secret-only-for-development'` NUR außerhalb von `NODE_ENV=production`).
 *
 * GÜLTIGKEIT: 15 Minuten ab Ausstellung. Ein Vorlauf von mehr als 60 Sekunden in die Zukunft
 * (Uhrenversatz zwischen Prozessen) wird ebenfalls abgelehnt.
 *
 * PRÜFREIHENFOLGE: Format → Signatur → Ablauf. Ein Token mit falscher Signatur wird NIE als
 * `expired` gemeldet — das wäre eine Aussage über einen Inhalt, der gar nicht verifiziert
 * werden konnte. Der Signaturvergleich läuft ausschließlich über `crypto.timingSafeEqual`
 * über gleich lange Puffer; bei unterschiedlicher Länge wird sofort `malformed` gemeldet,
 * ohne die Puffer überhaupt zu vergleichen (kein Timing-Seitenkanal über die Länge hinaus).
 *
 * Kontext: .planning/phases/12-stundenwechsel-bedienen/12-UI-SPEC.md ("previewToken —
 * vollständig spezifiziert"), .planning/phases/12-stundenwechsel-bedienen/12-03-PLAN.md.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WorkSchedule } from '../types/index.js';

/** Ausschließlich diese vier Felder sind gebunden — die Begründung bewusst NICHT. */
export interface PreviewTokenBinding {
  userId: number;
  validFrom: string;
  weeklyHours: number;
  workSchedule: WorkSchedule | null;
}

export type PreviewTokenVerification =
  | { valid: true }
  | { valid: false; reason: 'malformed' | 'mismatch' | 'expired' };

const TOKEN_VERSION = 'v1';
const PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Vorlauf, den ein Uhrenversatz zwischen Prozessen maximal erklären darf. */
const FUTURE_ISSUE_TOLERANCE_MS = 60 * 1000;

const WEEKDAY_KEYS: readonly (keyof WorkSchedule)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/**
 * Liefert den Signaturschlüssel. In Produktion OHNE gesetztes `SESSION_SECRET` wirft die
 * Ausstellung/Prüfung mit sprechender Meldung statt still einen vorhersehbaren
 * Entwicklungsschlüssel zu verwenden (T-12-11). Der Ersatzwert greift ausschließlich bei
 * `NODE_ENV !== 'production'` — wortgleiches Muster zu `server.ts`.
 */
function resolveSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET muss in Produktion gesetzt sein, bevor ein previewToken ausgestellt ' +
      'oder geprüft werden kann.'
    );
  }
  return 'dev-secret-only-for-development';
}

/**
 * Kanonisiert den Tagesplan: `null` wird zur Zeichenkette `'null'`, ein Objekt wird mit
 * sortierten Schlüsseln und über `Number(...)` normalisierten Werten neu aufgebaut, bevor
 * `JSON.stringify` läuft. Zwei Objekte mit denselben Werten in unterschiedlicher
 * Schlüsselreihenfolge liefern damit dieselbe kanonische Zeichenkette und dieselbe Signatur.
 */
function canonicalizeWorkSchedule(workSchedule: WorkSchedule | null): string {
  if (workSchedule === null) {
    return 'null';
  }

  const canonical: Record<string, number> = {};
  const sortedKeys = [...WEEKDAY_KEYS].sort();
  for (const key of sortedKeys) {
    canonical[key] = Number(workSchedule[key]);
  }
  return JSON.stringify(canonical);
}

function buildCanonicalString(binding: PreviewTokenBinding, issuedAtMs: number): string {
  return [
    TOKEN_VERSION,
    String(binding.userId),
    binding.validFrom,
    binding.weeklyHours.toFixed(2),
    canonicalizeWorkSchedule(binding.workSchedule),
    String(issuedAtMs),
  ].join('|');
}

function sign(canonical: string, secret: string): string {
  return createHmac('sha256', secret).update(canonical).digest('base64url');
}

/**
 * Stellt ein neues Token für genau diese vier Felder aus. Zustandslos — der Aufrufer muss
 * nichts speichern außer dem zurückgegebenen String.
 */
export function issuePreviewToken(binding: PreviewTokenBinding): string {
  const secret = resolveSecret();
  const issuedAtMs = Date.now();
  const canonical = buildCanonicalString(binding, issuedAtMs);
  const signature = sign(canonical, secret);
  return `${TOKEN_VERSION}.${issuedAtMs}.${signature}`;
}

/**
 * Prüft ein Token gegen die aktuell eingegebenen vier Felder. Reihenfolge: Format → Signatur
 * → Ablauf (siehe Kopfkommentar). Liefert niemals `valid: true` für ein manipuliertes,
 * abgelaufenes oder falsch formatiertes Token.
 */
export function verifyPreviewToken(
  token: string,
  binding: PreviewTokenBinding
): PreviewTokenVerification {
  // --- Format ---
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'malformed' };
  }

  const [version, issuedAtRaw, signature] = parts;
  if (version !== TOKEN_VERSION) {
    return { valid: false, reason: 'malformed' };
  }
  if (!/^\d+$/.test(issuedAtRaw)) {
    return { valid: false, reason: 'malformed' };
  }
  const issuedAtMs = Number(issuedAtRaw);
  if (!Number.isSafeInteger(issuedAtMs)) {
    return { valid: false, reason: 'malformed' };
  }
  if (signature.length === 0) {
    return { valid: false, reason: 'malformed' };
  }

  let secret: string;
  try {
    secret = resolveSecret();
  } catch {
    // Kein SESSION_SECRET in Produktion — ein zur Prüfung vorgelegtes Token kann dann
    // grundsätzlich nicht verifiziert werden. Das ist ein Formatproblem der Umgebung, keine
    // Aussage über den Inhalt des Tokens.
    return { valid: false, reason: 'malformed' };
  }

  // --- Signatur ---
  const canonical = buildCanonicalString(binding, issuedAtMs);
  const expectedSignature = sign(canonical, secret);

  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (actualBuf.length !== expectedBuf.length) {
    return { valid: false, reason: 'malformed' };
  }
  if (!timingSafeEqual(actualBuf, expectedBuf)) {
    return { valid: false, reason: 'mismatch' };
  }

  // --- Ablauf ---
  const now = Date.now();
  if (issuedAtMs > now + FUTURE_ISSUE_TOLERANCE_MS) {
    return { valid: false, reason: 'expired' };
  }
  if (now - issuedAtMs > PREVIEW_TOKEN_TTL_MS) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true };
}
