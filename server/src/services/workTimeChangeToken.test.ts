import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  issuePreviewToken,
  verifyPreviewToken,
  issueCorrectionPreviewToken,
  verifyCorrectionPreviewToken,
  issueDeletionPreviewToken,
  verifyDeletionPreviewToken,
  type PreviewTokenBinding,
  type CorrectionPreviewTokenBinding,
  type DeletionPreviewTokenBinding,
} from './workTimeChangeToken.js';

/**
 * PREVIEW TOKEN TESTS — die acht Verhaltensregeln aus 12-03-PLAN.md, Task 1.
 *
 * Reine Funktionstests ohne Datenbankzugriff — `workTimeChangeToken.ts` ist zustandslos.
 */

const BASE_BINDING: PreviewTokenBinding = {
  adminId: 7,
  userId: 42,
  validFrom: '2026-09-01',
  weeklyHours: 30,
  workSchedule: { monday: 8, tuesday: 8, wednesday: 8, thursday: 6, friday: 0, saturday: 0, sunday: 0 },
};

describe('workTimeChangeToken', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Ein frisch ausgestelltes Token verifiziert gegen dieselben vier Felder erfolgreich', () => {
    const token = issuePreviewToken(BASE_BINDING);
    const result = verifyPreviewToken(token, BASE_BINDING);
    expect(result).toEqual({ valid: true });
  });

  it('2. Verifiziert erfolgreich, auch wenn sich die Begründung zwischen Ausstellung und Prüfung geändert hat', () => {
    // WR-14 (Code-Review Phase 12): Die vorherige Fassung rief
    // verifyPreviewToken(token, { ...BASE_BINDING }) auf — also mit einer identischen
    // Kopie. Es wurde nichts geändert und folglich nichts belegt; der Test konnte gar
    // nicht fehlschlagen. Jetzt trägt das übergebene Objekt tatsächlich eine ANDERE
    // Begründung, und das Token bleibt trotzdem gültig — genau die Zusicherung aus
    // 12-UI-SPEC.md ("das Tippen der Pflichtbegründung entwertet die Vorschau nicht").
    const bindingWithReason = (reason: string): PreviewTokenBinding => {
      const carrier = { ...BASE_BINDING, reason };
      return carrier;
    };

    const token = issuePreviewToken(bindingWithReason('Ursprüngliche Begründung im Dialog'));
    const result = verifyPreviewToken(token, bindingWithReason('Vollständig andere Begründung'));
    expect(result).toEqual({ valid: true });
  });

  it('2b. WR-09: Ein von Admin A ausgestelltes Token ist für Admin B nicht einlösbar', () => {
    const tokenFromAdminA = issuePreviewToken({ ...BASE_BINDING, adminId: 7 });

    expect(verifyPreviewToken(tokenFromAdminA, { ...BASE_BINDING, adminId: 8 })).toEqual({
      valid: false,
      reason: 'mismatch',
    });
    // Gegenprobe: für denselben Admin gilt es weiterhin.
    expect(verifyPreviewToken(tokenFromAdminA, { ...BASE_BINDING, adminId: 7 })).toEqual({
      valid: true,
    });
  });

  it('3a. Geänderte weeklyHours liefert mismatch', () => {
    const token = issuePreviewToken(BASE_BINDING);
    const result = verifyPreviewToken(token, { ...BASE_BINDING, weeklyHours: 35 });
    expect(result).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('3b. Geändertes validFrom liefert mismatch', () => {
    const token = issuePreviewToken(BASE_BINDING);
    const result = verifyPreviewToken(token, { ...BASE_BINDING, validFrom: '2026-10-01' });
    expect(result).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('3c. Geänderte userId liefert mismatch', () => {
    const token = issuePreviewToken(BASE_BINDING);
    const result = verifyPreviewToken(token, { ...BASE_BINDING, userId: 99 });
    expect(result).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('3d. Ein einzelner geänderter Tageswert in workSchedule liefert mismatch', () => {
    const token = issuePreviewToken(BASE_BINDING);
    const changed = { ...BASE_BINDING.workSchedule!, friday: 2 };
    const result = verifyPreviewToken(token, { ...BASE_BINDING, workSchedule: changed });
    expect(result).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('4. workSchedule: null und ein Tagesplan mit lauter Nullen sind unterschiedliche Bindungen', () => {
    const nullBinding: PreviewTokenBinding = { ...BASE_BINDING, workSchedule: null };
    const zeroBinding: PreviewTokenBinding = {
      ...BASE_BINDING,
      workSchedule: { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
    };

    const tokenFromNull = issuePreviewToken(nullBinding);
    expect(verifyPreviewToken(tokenFromNull, zeroBinding)).toEqual({ valid: false, reason: 'mismatch' });

    const tokenFromZero = issuePreviewToken(zeroBinding);
    expect(verifyPreviewToken(tokenFromZero, nullBinding)).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('5. Zwei workSchedule-Objekte mit gleichen Werten in anderer Schlüsselreihenfolge liefern dieselbe Signatur', () => {
    const orderedA: PreviewTokenBinding = {
      ...BASE_BINDING,
      workSchedule: { monday: 8, tuesday: 8, wednesday: 8, thursday: 6, friday: 0, saturday: 0, sunday: 0 },
    };
    // Gleiche Werte, andere Objekt-Schlüsselreihenfolge (JS behält Insertion-Order bei JSON.stringify).
    const orderedB: PreviewTokenBinding = {
      ...BASE_BINDING,
      workSchedule: {
        sunday: 0,
        saturday: 0,
        friday: 0,
        thursday: 6,
        wednesday: 8,
        tuesday: 8,
        monday: 8,
      },
    };

    const token = issuePreviewToken(orderedA);
    const result = verifyPreviewToken(token, orderedB);
    expect(result).toEqual({ valid: true });
  });

  it('6. Ein Token älter als 15 Minuten liefert expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T10:00:00Z'));

    const token = issuePreviewToken(BASE_BINDING);

    vi.setSystemTime(new Date('2026-08-22T10:15:01Z')); // 15:01 später

    const result = verifyPreviewToken(token, BASE_BINDING);
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('7a. Ein Token mit manipulierter Signatur liefert nie valid: true', () => {
    const token = issuePreviewToken(BASE_BINDING);
    const [version, issuedAtMs, signature] = token.split('.');
    const tampered = signature.length > 0
      ? `${version}.${issuedAtMs}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`
      : `${version}.${issuedAtMs}.tampered`;

    const result = verifyPreviewToken(tampered, BASE_BINDING);
    expect(result.valid).toBe(false);
    expect((result as { reason: string }).reason).not.toBe('expired');
  });

  it('7b. Ein Token mit manipuliertem Zeitstempel liefert nie valid: true', () => {
    const token = issuePreviewToken(BASE_BINDING);
    const [version, issuedAtMs, signature] = token.split('.');
    const tamperedTimestamp = `${version}.${Number(issuedAtMs) + 1000}.${signature}`;

    const result = verifyPreviewToken(tamperedTimestamp, BASE_BINDING);
    expect(result.valid).toBe(false);
  });

  it('7c. Ein Token mit falschem Format liefert malformed', () => {
    expect(verifyPreviewToken('nicht-einmal-drei-teile', BASE_BINDING)).toEqual({
      valid: false,
      reason: 'malformed',
    });
    expect(verifyPreviewToken('v1.123456.signatur', BASE_BINDING)).toEqual({
      valid: false,
      reason: 'malformed',
    });
    expect(verifyPreviewToken('v2.keine-zahl.signatur', BASE_BINDING)).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });

  it('8. Ein Token mit Ausstellungszeitstempel mehr als 60 Sekunden in der Zukunft wird abgelehnt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T10:00:00Z'));

    const futureIssuedAtMs = Date.now() + 61 * 1000;
    // Handgebautes Token mit korrekt signiertem, aber zukünftigem Zeitstempel: über die
    // exportierte issuePreviewToken lässt sich kein beliebiger issuedAtMs erzwingen, daher
    // wird die Systemzeit selbst vorgestellt, das Token ausgestellt und die Prüfzeit wieder
    // zurückgesetzt.
    vi.setSystemTime(new Date(futureIssuedAtMs));
    const token = issuePreviewToken(BASE_BINDING);
    vi.setSystemTime(new Date('2026-08-22T10:00:00Z'));

    const result = verifyPreviewToken(token, BASE_BINDING);
    expect(result.valid).toBe(false);
  });
});

/**
 * PLAN 13-05, TASK 1 — die drei Token-Arten (Stundenwechsel, Korrektur, Löschung) sind
 * gegenseitig NICHT einlösbar (DD-20).
 */
describe('workTimeChangeToken — Korrektur-/Lösch-Vorschau (DD-20)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const CORRECTION_BINDING: CorrectionPreviewTokenBinding = {
    adminId: 7,
    periodId: 101,
    validFrom: '2026-09-01',
    weeklyHours: 30,
    workSchedule: { monday: 8, tuesday: 8, wednesday: 8, thursday: 6, friday: 0, saturday: 0, sunday: 0 },
  };

  const DELETION_BINDING: DeletionPreviewTokenBinding = {
    adminId: 7,
    periodId: 101,
  };

  it('1a. Ein Korrektur-Token verifiziert erfolgreich gegen dieselbe Bindung', () => {
    const token = issueCorrectionPreviewToken(CORRECTION_BINDING);
    expect(verifyCorrectionPreviewToken(token, CORRECTION_BINDING)).toEqual({ valid: true });
  });

  it('1b. Ein Lösch-Token verifiziert erfolgreich gegen dieselbe Bindung', () => {
    const token = issueDeletionPreviewToken(DELETION_BINDING);
    expect(verifyDeletionPreviewToken(token, DELETION_BINDING)).toEqual({ valid: true });
  });

  it('1c. Ein Korrektur-Token wird von verifyPreviewToken (Stundenwechsel) abgelehnt', () => {
    const token = issueCorrectionPreviewToken(CORRECTION_BINDING);
    const asStundenwechselBinding: PreviewTokenBinding = {
      adminId: CORRECTION_BINDING.adminId,
      userId: CORRECTION_BINDING.periodId,
      validFrom: CORRECTION_BINDING.validFrom,
      weeklyHours: CORRECTION_BINDING.weeklyHours,
      workSchedule: CORRECTION_BINDING.workSchedule,
    };
    const result = verifyPreviewToken(token, asStundenwechselBinding);
    expect(result.valid).toBe(false);
  });

  it('1d. Ein Stundenwechsel-Token wird von verifyCorrectionPreviewToken abgelehnt', () => {
    const stundenwechselBinding: PreviewTokenBinding = {
      adminId: 7,
      userId: 101,
      validFrom: '2026-09-01',
      weeklyHours: 30,
      workSchedule: CORRECTION_BINDING.workSchedule,
    };
    const token = issuePreviewToken(stundenwechselBinding);
    const asCorrectionBinding: CorrectionPreviewTokenBinding = {
      adminId: stundenwechselBinding.adminId,
      periodId: stundenwechselBinding.userId,
      validFrom: stundenwechselBinding.validFrom,
      weeklyHours: stundenwechselBinding.weeklyHours,
      workSchedule: stundenwechselBinding.workSchedule,
    };
    const result = verifyCorrectionPreviewToken(token, asCorrectionBinding);
    expect(result.valid).toBe(false);
  });

  it('1e. Ein Korrektur-Token wird von verifyDeletionPreviewToken abgelehnt, und umgekehrt', () => {
    const correctionToken = issueCorrectionPreviewToken(CORRECTION_BINDING);
    expect(
      verifyDeletionPreviewToken(correctionToken, {
        adminId: CORRECTION_BINDING.adminId,
        periodId: CORRECTION_BINDING.periodId,
      }).valid
    ).toBe(false);

    const deletionToken = issueDeletionPreviewToken(DELETION_BINDING);
    expect(
      verifyCorrectionPreviewToken(deletionToken, CORRECTION_BINDING).valid
    ).toBe(false);
  });

  it('2. Ein Lösch-Token für Periode A validiert nicht gegen Periode B (mismatch)', () => {
    const token = issueDeletionPreviewToken({ adminId: 7, periodId: 101 });
    const result = verifyDeletionPreviewToken(token, { adminId: 7, periodId: 202 });
    expect(result).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('3. Ein Korrektur-Token für einen anderen adminId validiert nicht (mismatch)', () => {
    const token = issueCorrectionPreviewToken(CORRECTION_BINDING);
    const result = verifyCorrectionPreviewToken(token, { ...CORRECTION_BINDING, adminId: 8 });
    expect(result).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('4. Ein Korrektur-Token, dessen weeklyHours sich geändert hat, validiert nicht (mismatch)', () => {
    const token = issueCorrectionPreviewToken(CORRECTION_BINDING);
    const result = verifyCorrectionPreviewToken(token, { ...CORRECTION_BINDING, weeklyHours: 35 });
    expect(result).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('5a. Ein Korrektur-Token älter als 15 Minuten liefert expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T10:00:00Z'));

    const token = issueCorrectionPreviewToken(CORRECTION_BINDING);

    vi.setSystemTime(new Date('2026-08-22T10:15:01Z'));

    const result = verifyCorrectionPreviewToken(token, CORRECTION_BINDING);
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('5b. Ein Lösch-Token älter als 15 Minuten liefert expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T10:00:00Z'));

    const token = issueDeletionPreviewToken(DELETION_BINDING);

    vi.setSystemTime(new Date('2026-08-22T10:15:01Z'));

    const result = verifyDeletionPreviewToken(token, DELETION_BINDING);
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });
});
