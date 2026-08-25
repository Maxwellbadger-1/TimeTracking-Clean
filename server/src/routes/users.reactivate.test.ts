import { describe, it, expect, afterEach } from 'vitest';
import express, { Request, Response as ExpressResponse, NextFunction } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { db } from '../database/connection.js';
import type { SessionUser } from '../types/index.js';
import usersRouter from './users.js';
import { updateUserStatus, deleteUser } from '../services/userService.js';

/**
 * HTTP-ROUTE-REGRESSIONSTEST für F-1 — Plan 14.2-02, Task 2.
 *
 * Nachweis, dass `POST /api/users/:id/reactivate` beide Wiederherstellungszustände abdeckt
 * (bloß deaktiviert UND soft-gelöscht), einen bereits aktiven Nutzer weiterhin mit 404 und
 * deutschem Satz abweist, admin-only bleibt, und dass der Deaktivierungsweg
 * (`PATCH /:id/status`) keinen soft-gelöschten Nutzer wiederbeleben kann (T-14.2-02-02).
 *
 * Muster: `workPeriods.authorization.test.ts` — echtes HTTP (`app.listen(0)` + eingebautem
 * `fetch`), Sitzung per eigener Middleware injiziert, kein `supertest` (existiert nicht im
 * Projekt).
 */

const USERNAME_PREFIX = 'test-142-02-';

let server: Server | undefined;

function startTestServer(sessionUser: SessionUser | null): Promise<string> {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: ExpressResponse, next: NextFunction) => {
    req.session = (sessionUser ? { user: sessionUser } : {}) as unknown as Request['session'];
    next();
  });

  app.use('/api/users', usersRouter);

  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function closeTestServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => {
    server!.close(() => resolve());
  });
  server = undefined;
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

/** Legt einen Testnutzer mit eindeutigem Namen an (Präfix `test-142-02-`), aktiv, ohne
 *  Perioden-Anspruch auf Vollständigkeit — nur `reactivateUser`/`updateUserStatus` werden
 *  geprüft, keine Arbeitszeitperioden-Logik. */
function createEmployee(suffix: string, role: 'admin' | 'employee' = 'employee'): SessionUser {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const insertUser = db.prepare(`
    INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insertUser.run(username, `${username}@test.local`, 'Test142', suffix, 'hash', role, 40, '2026-01-01');
  const id = result.lastInsertRowid as number;
  return toSessionUser({
    id, username, email: `${username}@test.local`, firstName: 'Test142', lastName: suffix,
    role, weeklyHours: 40, vacationDaysPerYear: 20, hireDate: '2026-01-01',
  });
}

/** `audit_log.userId` verweist per FOREIGN KEY auf `users(id)` OHNE `ON DELETE CASCADE`
 *  (Muster aus `workPeriodChangeService.test.ts`) — muss VOR `users` geräumt werden. Danach
 *  erst `users`: CASCADE räumt `user_work_periods`, `overtime_transactions` und
 *  `overtime_balance` automatisch ab und umgeht damit den Löschguard-Trigger auf
 *  `user_work_periods` (deferred-items.md, Plan 14.1-03, Punkt 2), der beim Löschen der
 *  abhängigen Zeilen VOR dem Nutzer auslösen würde. */
function cleanupEmployee(userId: number): void {
  db.prepare('DELETE FROM audit_log WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM user_work_periods WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
}

function readUserState(id: number): { status: string; deletedAt: string | null } | undefined {
  return db.prepare('SELECT status, deletedAt FROM users WHERE id = ?').get(id) as
    | { status: string; deletedAt: string | null }
    | undefined;
}

async function reactivateHttp(baseUrl: string, id: number): Promise<Response> {
  return fetch(`${baseUrl}/api/users/${id}/reactivate`, { method: 'POST' });
}

async function patchStatusHttp(baseUrl: string, id: number, status: 'active' | 'inactive'): Promise<Response> {
  return fetch(`${baseUrl}/api/users/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

describe('POST /api/users/:id/reactivate (F-1, HTTP-Regressionstest)', () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    await closeTestServer();
    while (createdIds.length > 0) {
      const id = createdIds.pop()!;
      cleanupEmployee(id);
    }
  });

  it('reaktiviert einen bloß deaktivierten Nutzer (status=inactive, deletedAt IS NULL) mit HTTP 200', async () => {
    const admin = createEmployee('deact-admin', 'admin');
    createdIds.push(admin.id);
    const employee = createEmployee('deact-target');
    createdIds.push(employee.id);

    updateUserStatus(employee.id, 'inactive');
    const before = readUserState(employee.id);
    expect(before?.status).toBe('inactive');
    expect(before?.deletedAt).toBeNull();

    const baseUrl = await startTestServer(admin);
    const response = await reactivateHttp(baseUrl, employee.id);
    const body = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const after = readUserState(employee.id);
    expect(after?.status).toBe('active');
    expect(after?.deletedAt).toBeNull();
  });

  it('reaktiviert einen soft-gelöschten Nutzer (deletedAt IS NOT NULL) weiterhin mit HTTP 200 (keine Regression)', async () => {
    const admin = createEmployee('soft-admin', 'admin');
    createdIds.push(admin.id);
    const employee = createEmployee('soft-target');
    createdIds.push(employee.id);

    deleteUser(employee.id);
    const before = readUserState(employee.id);
    expect(before?.deletedAt).not.toBeNull();

    const baseUrl = await startTestServer(admin);
    const response = await reactivateHttp(baseUrl, employee.id);
    const body = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const after = readUserState(employee.id);
    expect(after?.status).toBe('active');
    expect(after?.deletedAt).toBeNull();
  });

  it('weist einen bereits aktiven Nutzer mit HTTP 404 und dem deutschen Satz ab', async () => {
    const admin = createEmployee('active-admin', 'admin');
    createdIds.push(admin.id);
    const employee = createEmployee('active-target');
    createdIds.push(employee.id);

    const before = readUserState(employee.id);
    expect(before?.status).toBe('active');
    expect(before?.deletedAt).toBeNull();

    const baseUrl = await startTestServer(admin);
    const response = await reactivateHttp(baseUrl, employee.id);
    const body = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Benutzer nicht gefunden oder bereits aktiv.');
    expect(body.error).not.toContain('not deleted');
  });

  it('bleibt admin-only: Mitarbeitersitzung → 403, keine Sitzung → 401, kein Zustandswechsel', async () => {
    const employeeSession = createEmployee('authz-employee');
    createdIds.push(employeeSession.id);
    const target = createEmployee('authz-target');
    createdIds.push(target.id);
    updateUserStatus(target.id, 'inactive');

    // Mitarbeitersitzung -> 403
    let baseUrl = await startTestServer(employeeSession);
    let response = await reactivateHttp(baseUrl, target.id);
    expect(response.status).toBe(403);
    let state = readUserState(target.id);
    expect(state?.status).toBe('inactive');
    expect(state?.deletedAt).toBeNull();
    await closeTestServer();

    // Keine Sitzung -> 401
    baseUrl = await startTestServer(null);
    response = await reactivateHttp(baseUrl, target.id);
    expect(response.status).toBe(401);
    state = readUserState(target.id);
    expect(state?.status).toBe('inactive');
    expect(state?.deletedAt).toBeNull();
  });

  it('T-14.2-02-02: PATCH /:id/status belebt keinen soft-gelöschten Nutzer (Trennung der beiden Wege)', async () => {
    const admin = createEmployee('sep-admin', 'admin');
    createdIds.push(admin.id);
    const target = createEmployee('sep-target');
    createdIds.push(target.id);

    deleteUser(target.id);
    const before = readUserState(target.id);
    expect(before?.deletedAt).not.toBeNull();

    const baseUrl = await startTestServer(admin);
    const response = await patchStatusHttp(baseUrl, target.id, 'active');

    expect(response.status).toBe(404);
    const after = readUserState(target.id);
    expect(after?.deletedAt).toBe(before?.deletedAt);
    expect(after?.status).toBe('inactive');
  });
});
