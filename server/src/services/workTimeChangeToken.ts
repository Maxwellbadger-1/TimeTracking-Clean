/**
 * Preview Token — zustandsloses, signiertes Token für den Stundenwechsel-Trockenlauf
 *
 * WARUM (D2, REQ-27): Vorschau und Speichern laufen über dieselbe Codebahn
 * (`applyWorkTimeChange`, Plan 12-03 Task 2). Damit der Speichern-Aufruf nachweislich
 * dieselbe geprüfte Berechnung bestätigt, die der Anwender in der Vorschau gesehen hat,
 * bindet dieses Token die vier Eingabefelder, aus denen die Berechnung hervorgeht
 * (`userId`, `validFrom`, `weeklyHours`, `workSchedule`) — UND seit WR-09 die `adminId` des
 * ausstellenden Admins. Die Begründung ist AUSDRÜCKLICH NICHT gebunden (12-UI-SPEC.md,
 * Abschnitt "previewToken") — sonst würde das Tippen der Pflichtbegründung nach der Vorschau
 * das Token entwerten.
 *
 * ZUSTANDSLOS: kein Serverspeicher, keine Tabelle, kein Neustartproblem. Das Token trägt
 * seinen Ausstellungszeitstempel selbst und wird bei jeder Prüfung neu gegen die aktuell
 * eingegebenen vier Felder verifiziert — es gibt keine Map, keine Tabelle, kein modulweites
 * Gedächtnis in dieser Datei.
 *
 * FORMAT: `v2.<issuedAtMs>.<signaturBase64Url>`. Die Signatur ist ein HMAC-SHA256 über die
 * kanonische Zeichenkette `v2|<adminId>|<userId>|<validFrom>|<weeklyHours mit toFixed(2)>|
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
 *
 * ERWEITERUNG PLAN 13-05 (DD-20): Zwei weitere, gegenseitig NICHT einlösbare Token-Arten für
 * „Stammdaten korrigieren" (`CorrectionPreviewTokenBinding`/`issueCorrectionPreviewToken`/
 * `verifyCorrectionPreviewToken`) und „Periode löschen"
 * (`DeletionPreviewTokenBinding`/`issueDeletionPreviewToken`/`verifyDeletionPreviewToken`). Die
 * kanonische Zeichenkette der Stundenwechsel-Bahn oben bleibt WORTGLEICH unverändert. Beide
 * neuen Bahnen tragen an zweiter Stelle ein Zweckfeld (`'correct'`/`'delete'`), das niemals eine
 * Zahl sein kann — deshalb ist keine der drei Zeichenketten in eine andere umdeutbar. Die
 * gemeinsame Signatur-/Prüf-Mechanik steckt in den beiden privaten Hilfsfunktionen
 * `signCanonical()`/`verifyCanonical()`, die alle drei Bahnen aufrufen.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WorkSchedule } from '../types/index.js';
// WR-11/IN-01: EINE Kanonisierung fuer Token-Signatur und Pruefskript.
import { canonicalizeWorkSchedule } from '../utils/workSchedule.js';

/**
 * Gebunden sind der ausstellende Admin und die vier Berechnungsfelder — die Begründung
 * bewusst NICHT.
 *
 * WR-09 (Code-Review Phase 12): `adminId` ist neu. Vorher band das Token ausschließlich
 * `userId`, `validFrom`, `weeklyHours` und `workSchedule`. Ein von Admin A ausgestelltes
 * Token konnte Admin B 14 Minuten später einlösen; die `createdBy`-Spalte der Periode wies
 * dann B aus, obwohl nur A die geprüfte Vorschau tatsächlich gesehen hat. Mit `adminId` in
 * der kanonischen Zeichenkette bestätigt der Speichern-Aufruf nachweislich die Vorschau
 * DESSELBEN Admins.
 */
export interface PreviewTokenBinding {
  /** Der Admin, der die Vorschau abgerufen hat — und der sie einlösen darf. */
  adminId: number;
  userId: number;
  validFrom: string;
  weeklyHours: number;
  workSchedule: WorkSchedule | null;
}

export type PreviewTokenVerification =
  | { valid: true }
  | { valid: false; reason: 'malformed' | 'mismatch' | 'expired' };

/**
 * WR-09: von `'v1'` auf `'v2'` angehoben, weil sich die kanonische Zeichenkette geändert hat
 * (`adminId` ist hinzugekommen). Ein noch nicht abgelaufenes `v1`-Token wird dadurch als
 * `malformed` abgewiesen statt still gegen eine andere Feldreihenfolge geprüft zu werden —
 * die Oberfläche berechnet die Vorschau dann neu (T-12-24). Das Zeitfenster dafür ist
 * höchstens 15 Minuten nach dem Rollout.
 */
const TOKEN_VERSION = 'v2';
const PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Vorlauf, den ein Uhrenversatz zwischen Prozessen maximal erklären darf. */
const FUTURE_ISSUE_TOLERANCE_MS = 60 * 1000;

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

function buildCanonicalString(binding: PreviewTokenBinding, issuedAtMs: number): string {
  return [
    TOKEN_VERSION,
    String(binding.adminId),
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
 * DD-20 (Plan 13-05): gemeinsame Ausstellungs-Mechanik für alle drei Token-Arten. Signiert die
 * vom Aufrufer gelieferte kanonische Zeichenkette (die den frisch gezogenen `issuedAtMs`
 * einschließt) und verpackt sie im bestehenden Format `${TOKEN_VERSION}.${issuedAtMs}.
 * ${signature}`. `resolveSecret()` läuft ungefangen — ein fehlendes `SESSION_SECRET` in
 * Produktion soll die Ausstellung wie bisher mit einer sprechenden Meldung abbrechen.
 */
function signCanonical(buildCanonical: (issuedAtMs: number) => string): string {
  const secret = resolveSecret();
  const issuedAtMs = Date.now();
  const canonical = buildCanonical(issuedAtMs);
  const signature = sign(canonical, secret);
  return `${TOKEN_VERSION}.${issuedAtMs}.${signature}`;
}

/**
 * DD-20 (Plan 13-05): gemeinsame Prüf-Mechanik für alle drei Token-Arten. Reihenfolge: Format →
 * Signatur → Ablauf (siehe Kopfkommentar). `buildCanonical` bekommt den aus dem Token gelesenen
 * `issuedAtMs` und liefert die für die jeweilige Token-Art zuständige kanonische Zeichenkette —
 * die drei Zeichenketten selbst bleiben durch das Zweckfeld (`'correct'`/`'delete'`) bzw. die
 * Feldreihenfolge der Stundenwechsel-Bahn gegenseitig nicht ineinander umdeutbar.
 */
function verifyCanonical(
  token: string,
  buildCanonical: (issuedAtMs: number) => string
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
  const canonical = buildCanonical(issuedAtMs);
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

/**
 * Stellt ein neues Token für genau diese vier Felder aus. Zustandslos — der Aufrufer muss
 * nichts speichern außer dem zurückgegebenen String.
 */
export function issuePreviewToken(binding: PreviewTokenBinding): string {
  return signCanonical((issuedAtMs) => buildCanonicalString(binding, issuedAtMs));
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
  return verifyCanonical(token, (issuedAtMs) => buildCanonicalString(binding, issuedAtMs));
}

/**
 * DD-20 (Plan 13-05): Bindungstyp für die Korrektur-Vorschau — dieselben vier Rechenfelder wie
 * der Stundenwechsel (`validFrom`, `weeklyHours`, `workSchedule`), aber `periodId` statt
 * `userId`, weil „Stammdaten korrigieren" eine BESTEHENDE Periode ändert (kein neuer Nutzer-
 * bezogener Split).
 */
export interface CorrectionPreviewTokenBinding {
  /** Der Admin, der die Vorschau abgerufen hat — und der sie einlösen darf. */
  adminId: number;
  periodId: number;
  validFrom: string;
  weeklyHours: number;
  workSchedule: WorkSchedule | null;
}

/**
 * DD-20: kanonische Zeichenkette der Korrektur-Vorschau mit dem Zweckfeld `'correct'` an
 * zweiter Stelle — dadurch niemals als Stundenwechsel- oder Lösch-Token misszudeuten (beide
 * verwenden dort eine Zahl bzw. `'delete'`).
 */
function buildCorrectionCanonicalString(
  binding: CorrectionPreviewTokenBinding,
  issuedAtMs: number
): string {
  return [
    TOKEN_VERSION,
    'correct',
    String(binding.adminId),
    String(binding.periodId),
    binding.validFrom,
    binding.weeklyHours.toFixed(2),
    canonicalizeWorkSchedule(binding.workSchedule),
    String(issuedAtMs),
  ].join('|');
}

/** Stellt ein neues Korrektur-Vorschau-Token aus (DD-20). */
export function issueCorrectionPreviewToken(binding: CorrectionPreviewTokenBinding): string {
  return signCanonical((issuedAtMs) => buildCorrectionCanonicalString(binding, issuedAtMs));
}

/** Prüft ein Korrektur-Vorschau-Token gegen die aktuell eingegebenen Felder (DD-20). */
export function verifyCorrectionPreviewToken(
  token: string,
  binding: CorrectionPreviewTokenBinding
): PreviewTokenVerification {
  return verifyCanonical(token, (issuedAtMs) => buildCorrectionCanonicalString(binding, issuedAtMs));
}

/**
 * DD-20 (Plan 13-05): reiner Bindungstyp für die Lösch-Vorschau — `adminId` und `periodId`,
 * keine weiteren Felder. Beim Löschen gibt es keine Eingabewerte, die zu binden wären;
 * ungenutzte Pflichtfelder wären eine Einladung, sie irgendwann mit Platzhaltern zu füllen.
 */
export interface DeletionPreviewTokenBinding {
  /** Der Admin, der die Vorschau abgerufen hat — und der sie einlösen darf. */
  adminId: number;
  periodId: number;
}

/**
 * DD-20: kanonische Zeichenkette der Lösch-Vorschau mit dem Zweckfeld `'delete'` an zweiter
 * Stelle.
 */
function buildDeletionCanonicalString(
  binding: DeletionPreviewTokenBinding,
  issuedAtMs: number
): string {
  return [
    TOKEN_VERSION,
    'delete',
    String(binding.adminId),
    String(binding.periodId),
    String(issuedAtMs),
  ].join('|');
}

/** Stellt ein neues Lösch-Vorschau-Token aus (DD-20). */
export function issueDeletionPreviewToken(binding: DeletionPreviewTokenBinding): string {
  return signCanonical((issuedAtMs) => buildDeletionCanonicalString(binding, issuedAtMs));
}

/** Prüft ein Lösch-Vorschau-Token gegen die aktuell eingegebenen Felder (DD-20). */
export function verifyDeletionPreviewToken(
  token: string,
  binding: DeletionPreviewTokenBinding
): PreviewTokenVerification {
  return verifyCanonical(token, (issuedAtMs) => buildDeletionCanonicalString(binding, issuedAtMs));
}
