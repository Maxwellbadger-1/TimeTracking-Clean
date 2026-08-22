import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Request, Response as ExpressResponse, NextFunction } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { db } from '../database/connection.js';
import type { SessionUser } from '../types/index.js';
import workPeriodsRouter from './workPeriods.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { getWorkPeriodById } from '../services/workPeriodService.js';
import { issueDeletionPreviewToken } from '../services/workTimeChangeToken.js';

/**
 * HTTP-AUTORISIERUNGSTEST für die Perioden-Endpunkte — Plan 13-05, Task 3.
 *
 * Nachweis für D5 (13-CONTEXT.md) und das vierte Erfolgskriterium der ROADMAP: „Ein
 * Mitarbeiter kann die Perioden eines anderen weder sehen noch über die API abrufen." Diese
 * Tests rufen die Routen über ECHTES HTTP auf (`app.listen(0)` + `fetch`), nicht über direkten
 * Funktionsaufruf — nur so ist belegt, dass die Rollenprüfung serverseitig IN DER ROUTE sitzt
 * (Middleware-Kette `requireAuth`/`requireAdmin`), nicht nur in einer aufrufenden
 * Service-Funktion, die ein Test versehentlich umgehen könnte. Muster:
 * `vacationTransactionRoutes.test.ts`.
 *
 * Zusätzlich prüft der dritte Block, dass die Tokenkopplung (DD-20/T-13-21) auch über HTTP
 * wirkt — nicht nur auf Funktionsebene (dort bereits durch `workTimeChangeToken.test.ts`
 * belegt).
 */

let server: Server | undefined;

function startTestServer(sessionUser: SessionUser | null): Promise<string> {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: ExpressResponse, next: NextFunction) => {
    req.session = (sessionUser ? { user: sessionUser } : {}) as unknown as Request['session'];
    next();
  });

  app.use('/api/work-periods', workPeriodsRouter);

  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function toSessionUser(row: {
  id: number; username: string; email: string; firstName: string; lastName: string;
  role: 'admin' | 'employee'; weeklyHours: number; vacationDaysPerYear: number; hireDate: string;
}): SessionUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    weeklyHours: row.weeklyHours,
    vacationDaysPerYear: row.vacationDaysPerYear,
    hireDate: row.hireDate,
  };
}

async function sendJson(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: unknown = {}
): Promise<Response> {
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('workPeriods routes (HTTP-Autorisierung, D5)', () => {
  let employeeA: SessionUser;
  let employeeB: SessionUser;
  let admin: SessionUser;
  let periodB: { id: number; validFrom: string; validTo: string | null; weeklyHours: number };

  beforeEach(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const a = insertUser.run(
      'test-13-05-employee-a', 'test-13-05-a@test.local', 'Employee', 'A', 'hash', 'employee', 40, '2026-01-01'
    );
    employeeA = toSessionUser({
      id: a.lastInsertRowid as number, username: 'test-13-05-employee-a', email: 'test-13-05-a@test.local',
      firstName: 'Employee', lastName: 'A', role: 'employee', weeklyHours: 40, vacationDaysPerYear: 20, hireDate: '2026-01-01',
    });

    const b = insertUser.run(
      'test-13-05-employee-b', 'test-13-05-b@test.local', 'Employee', 'B', 'hash', 'employee', 40, '2026-01-01'
    );
    employeeB = toSessionUser({
      id: b.lastInsertRowid as number, username: 'test-13-05-employee-b', email: 'test-13-05-b@test.local',
      firstName: 'Employee', lastName: 'B', role: 'employee', weeklyHours: 40, vacationDaysPerYear: 25, hireDate: '2026-01-01',
    });

    const adm = insertUser.run(
      'test-13-05-admin', 'test-13-05-admin@test.local', 'Admin', 'User', 'hash', 'admin', 40, '2026-01-01'
    );
    admin = toSessionUser({
      id: adm.lastInsertRowid as number, username: 'test-13-05-admin', email: 'test-13-05-admin@test.local',
      firstName: 'Admin', lastName: 'User', role: 'admin', weeklyHours: 40, vacationDaysPerYear: 20, hireDate: '2026-01-01',
    });

    // employeeB bekommt ZWEI Perioden — die zweite (periodB) ist damit nicht die erste Periode
    // der Kette (DD-17 sperrt das Löschen der ersten Periode serverseitig). Für die hier zu
    // belegende Autorisierung/Tokenkopplung ist das nicht zwingend nötig (403/409 entstehen in
    // Middleware bzw. Tokenprüfung, bevor der Service überhaupt die Kette liest), macht die
    // Fixture aber realistischer.
    insertTestWorkPeriod(employeeB.id, { validFrom: '2026-01-01', validTo: '2026-06-01', weeklyHours: 40 });
    periodB = insertTestWorkPeriod(employeeB.id, { validFrom: '2026-06-01', weeklyHours: 30 });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }

    const ids = [employeeA.id, employeeB.id, admin.id];
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM audit_log WHERE userId IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM overtime_transactions WHERE userId IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM overtime_balance WHERE userId IN (${placeholders})`).run(...ids);
    // user_work_periods räumt über ON DELETE CASCADE beim Löschen des Nutzers auf
    // (13-06-SUMMARY.md) — der BEFORE-DELETE-Kettenriegel würde ein echtes DELETE der letzten
    // verbliebenen Periode sonst verweigern.
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...ids);
  });

  // --- D5: jede Zeile der Tabelle aus 13-05-PLAN.md, Task 3, als eigener Testfall ---

  it('GET /api/work-periods?userId=<fremd> mit Mitarbeiter-Sitzung: 403, kein data im Antwortkörper', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await fetch(`${baseUrl}/api/work-periods?userId=${employeeB.id}`);
    expect(res.status).toBe(403);

    const body = await res.json() as Record<string, unknown>;
    expect(body.data).toBeUndefined();
  });

  it('GET /api/work-periods?userId=<eigene> mit Mitarbeiter-Sitzung: 200, die eigene Liste', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await fetch(`${baseUrl}/api/work-periods?userId=${employeeA.id}`);
    expect(res.status).toBe(200);

    const body = await res.json() as { data: Array<{ userId: number }> };
    expect(body.data.every((p) => p.userId === employeeA.id)).toBe(true);
  });

  it('GET /api/work-periods?userId=<fremd> mit Admin-Sitzung: 200', async () => {
    const baseUrl = await startTestServer(admin);
    const res = await fetch(`${baseUrl}/api/work-periods?userId=${employeeB.id}`);
    expect(res.status).toBe(200);

    const body = await res.json() as { data: Array<{ userId: number }> };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.data.every((p) => p.userId === employeeB.id)).toBe(true);
  });

  it('POST /api/work-periods/<fremde Periode>/correct/preview mit Mitarbeiter-Sitzung: 403', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}/correct/preview`, 'POST', {
      validFrom: periodB.validFrom, weeklyHours: 35, workSchedule: null,
    });
    expect(res.status).toBe(403);
  });

  it('PUT /api/work-periods/<fremde Periode> mit Mitarbeiter-Sitzung: 403', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}`, 'PUT', {
      validFrom: periodB.validFrom, weeklyHours: 35, workSchedule: null,
      reason: 'Testweise verändert', previewToken: 'v2.1.fake',
    });
    expect(res.status).toBe(403);
  });

  it('POST /api/work-periods/<fremde Periode>/delete/preview mit Mitarbeiter-Sitzung: 403', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}/delete/preview`, 'POST');
    expect(res.status).toBe(403);
  });

  it('DELETE /api/work-periods/<fremde Periode> mit Mitarbeiter-Sitzung: 403', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}`, 'DELETE', {
      reason: 'Testweise gelöscht', previewToken: 'v2.1.fake',
    });
    expect(res.status).toBe(403);
  });

  it('POST /api/work-periods/preview und POST /api/work-periods/change (Phase 12) mit Mitarbeiter-Sitzung: 403 — der Bestandsschutz bleibt belegt', async () => {
    const baseUrl = await startTestServer(employeeA);

    const previewRes = await sendJson(`${baseUrl}/api/work-periods/preview`, 'POST', {
      userId: employeeB.id, validFrom: '2026-09-01', weeklyHours: 35, workSchedule: null,
    });
    expect(previewRes.status).toBe(403);

    const changeRes = await sendJson(`${baseUrl}/api/work-periods/change`, 'POST', {
      userId: employeeB.id, validFrom: '2026-09-01', weeklyHours: 35, workSchedule: null,
      reason: 'Testweise verändert', previewToken: 'v2.1.fake',
    });
    expect(changeRes.status).toBe(403);
  });

  it('alle sechs Schreib-/Vorschauaufrufe ohne Sitzung: 401', async () => {
    const baseUrl = await startTestServer(null);

    const correctPreview = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}/correct/preview`, 'POST');
    expect(correctPreview.status).toBe(401);

    const put = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}`, 'PUT');
    expect(put.status).toBe(401);

    const deletePreview = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}/delete/preview`, 'POST');
    expect(deletePreview.status).toBe(401);

    const del = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}`, 'DELETE');
    expect(del.status).toBe(401);

    const legacyPreview = await sendJson(`${baseUrl}/api/work-periods/preview`, 'POST');
    expect(legacyPreview.status).toBe(401);

    const legacyChange = await sendJson(`${baseUrl}/api/work-periods/change`, 'POST');
    expect(legacyChange.status).toBe(401);
  });

  // --- Wirkungstests: die Ablehnung ist nicht nur ein Statuscode ---

  it('Wirkung: nach dem abgelehnten DELETE durch employeeA ist periodB.deletedAt weiterhin null', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}`, 'DELETE', {
      reason: 'Testweise gelöscht', previewToken: 'v2.1.fake',
    });
    expect(res.status).toBe(403);

    const stillThere = getWorkPeriodById(periodB.id);
    expect(stillThere).not.toBeNull();
    expect(stillThere!.deletedAt).toBeNull();
  });

  it('Wirkung: nach dem abgelehnten PUT durch employeeA sind weeklyHours von periodB unverändert', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}`, 'PUT', {
      validFrom: periodB.validFrom, weeklyHours: 12, workSchedule: null,
      reason: 'Testweise verändert', previewToken: 'v2.1.fake',
    });
    expect(res.status).toBe(403);

    const unchanged = getWorkPeriodById(periodB.id);
    expect(unchanged!.weeklyHours).toBe(30);
  });

  // --- Tokenkopplung über HTTP (nicht nur auf Funktionsebene) ---

  it('PUT /api/work-periods/:id als Admin OHNE previewToken: 409, Antworttext beginnt mit PREVIEW_STALE', async () => {
    const baseUrl = await startTestServer(admin);
    const res = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}`, 'PUT', {
      validFrom: periodB.validFrom, weeklyHours: 35, workSchedule: null,
      reason: 'Testweise korrigiert ohne Vorschau',
    });
    expect(res.status).toBe(409);

    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error.startsWith('PREVIEW_STALE')).toBe(true);

    const unchanged = getWorkPeriodById(periodB.id);
    expect(unchanged!.weeklyHours).toBe(30);
  });

  it('DELETE /api/work-periods/:id als Admin mit einem Token für eine ANDERE Periode: 409, Periode danach unverändert', async () => {
    const baseUrl = await startTestServer(admin);

    // Token bewusst für eine andere periodId ausgestellt — die Bindung an DIESE Periode muss
    // fehlschlagen, bevor der Löschdienst überhaupt aufgerufen wird.
    const tokenForOtherPeriod = issueDeletionPreviewToken({
      adminId: admin.id,
      periodId: periodB.id + 999,
    });

    const res = await sendJson(`${baseUrl}/api/work-periods/${periodB.id}`, 'DELETE', {
      reason: 'Testweise gelöscht mit falschem Token',
      previewToken: tokenForOtherPeriod,
    });
    expect(res.status).toBe(409);

    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error.startsWith('PREVIEW_STALE')).toBe(true);

    const unchanged = getWorkPeriodById(periodB.id);
    expect(unchanged).not.toBeNull();
    expect(unchanged!.deletedAt).toBeNull();
  });
});
