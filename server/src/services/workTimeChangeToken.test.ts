import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  issuePreviewToken,
  verifyPreviewToken,
  type PreviewTokenBinding,
} from './workTimeChangeToken.js';

/**
 * PREVIEW TOKEN TESTS — die acht Verhaltensregeln aus 12-03-PLAN.md, Task 1.
 *
 * Reine Funktionstests ohne Datenbankzugriff — `workTimeChangeToken.ts` ist zustandslos.
 */

const BASE_BINDING: PreviewTokenBinding = {
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

  it('2. Verifiziert erfolgreich, auch wenn sich die Begründung geändert hat (nicht gebunden)', () => {
    // Die Begründung ist gar nicht Teil von PreviewTokenBinding — dieser Test belegt, dass
    // die Prüfung ausschließlich die vier gebundenen Felder heranzieht.
    const token = issuePreviewToken(BASE_BINDING);
    const result = verifyPreviewToken(token, { ...BASE_BINDING });
    expect(result).toEqual({ valid: true });
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
    expect(verifyPreviewToken('v2.123456.signatur', BASE_BINDING)).toEqual({
      valid: false,
      reason: 'malformed',
    });
    expect(verifyPreviewToken('v1.keine-zahl.signatur', BASE_BINDING)).toEqual({
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
