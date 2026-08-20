import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { db } from '../database/connection.js';
import { recordVacationTransaction } from '../services/vacationTransactionService.js';
import type { SessionUser } from '../types/index.js';
import vacationTransactionsRouter from './vacationTransactions.js';
import vacationBalanceRouter from './vacationBalance.js';

/**
 * HTTP-Autorisierungstests für den Kontoauszug und den Kontostand.
 *
 * Diese Tests rufen die Routen über echtes HTTP auf (nicht über direkten Funktionsaufruf),
 * weil nur so belegt ist, dass die Rollenprüfung serverseitig in der Route sitzt (REQ-14) —
 * ein Test, der die Service-Funktion direkt aufruft, würde eine Prüfung in der Route
 * überhaupt nicht erfassen.
 */

let server: Server | undefined;

function startTestServer(sessionUser: SessionUser | null): Promise<string> {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.session = (sessionUser ? { user: sessionUser } : {}) as unknown as Request['session'];
    next();
  });

  app.use('/api/vacation-transactions', vacationTransactionsRouter);
  app.use('/api/vacation-balances', vacationBalanceRouter);

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

describe('vacationTransactionRoutes (HTTP-Autorisierung)', () => {
  const testYear = 2026;
  const emptyYear = 2031;

  let employeeA: SessionUser;
  let employeeB: SessionUser;
  let admin: SessionUser;
  let absenceBId: number;

  beforeEach(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const a = insertUser.run('testuser_vac_route_a', 'vac-route-a@test.local', 'Employee', 'A', 'hash', 'employee', 40, '2026-01-01');
    employeeA = toSessionUser({
      id: a.lastInsertRowid as number, username: 'testuser_vac_route_a', email: 'vac-route-a@test.local',
      firstName: 'Employee', lastName: 'A', role: 'employee', weeklyHours: 40, vacationDaysPerYear: 20, hireDate: '2026-01-01',
    });

    const b = insertUser.run('testuser_vac_route_b', 'vac-route-b@test.local', 'Employee', 'B', 'hash', 'employee', 40, '2026-01-01');
    employeeB = toSessionUser({
      id: b.lastInsertRowid as number, username: 'testuser_vac_route_b', email: 'vac-route-b@test.local',
      firstName: 'Employee', lastName: 'B', role: 'employee', weeklyHours: 40, vacationDaysPerYear: 25, hireDate: '2026-01-01',
    });

    const adm = insertUser.run('testadmin_vac_route', 'vac-route-admin@test.local', 'Admin', 'User', 'hash', 'admin', 40, '2026-01-01');
    admin = toSessionUser({
      id: adm.lastInsertRowid as number, username: 'testadmin_vac_route', email: 'vac-route-admin@test.local',
      firstName: 'Admin', lastName: 'User', role: 'admin', weeklyHours: 40, vacationDaysPerYear: 20, hireDate: '2026-01-01',
    });

    // employeeA: Konto + zwei Buchungen (kein Antragsbezug)
    db.prepare(`
      INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
      VALUES (?, ?, ?, ?, ?)
    `).run(employeeA.id, testYear, 20, 0, 0);
    recordVacationTransaction({
      userId: employeeA.id, year: testYear, date: `${testYear}-01-01`, type: 'entitlement',
      days: 20, description: 'Jahresanspruch', referenceType: 'system',
    });
    recordVacationTransaction({
      userId: employeeA.id, year: testYear, date: `${testYear}-03-01`, type: 'vacation_taken',
      days: -5, description: 'Urlaub März',
    });

    // employeeB: Konto + Antrag + zwei Buchungen (eine davon mit Antragsbezug)
    db.prepare(`
      INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
      VALUES (?, ?, ?, ?, ?)
    `).run(employeeB.id, testYear, 25, 0, 0);
    const absenceB = db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, days, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(employeeB.id, 'vacation', `${testYear}-06-10`, `${testYear}-06-14`, 5, 'approved');
    absenceBId = absenceB.lastInsertRowid as number;
    recordVacationTransaction({
      userId: employeeB.id, year: testYear, date: `${testYear}-01-01`, type: 'entitlement',
      days: 25, description: 'Jahresanspruch', referenceType: 'system',
    });
    recordVacationTransaction({
      userId: employeeB.id, year: testYear, date: `${testYear}-06-10`, type: 'vacation_taken',
      days: -5, description: 'Urlaub genehmigt', referenceType: 'absence', referenceId: absenceBId,
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }

    const ids = [employeeA.id, employeeB.id, admin.id];
    db.prepare(`DELETE FROM vacation_transactions WHERE userId IN (${ids.map(() => '?').join(',')})`).run(...ids);
    db.prepare(`DELETE FROM vacation_balance WHERE userId IN (${ids.map(() => '?').join(',')})`).run(...ids);
    db.prepare(`DELETE FROM absence_requests WHERE userId IN (${ids.map(() => '?').join(',')})`).run(...ids);
    db.prepare(`DELETE FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  });

  it('verweigert Mitarbeiter A den Zugriff auf das Journal von Mitarbeiter B (403, keine Daten)', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await fetch(`${baseUrl}/api/vacation-transactions?userId=${employeeB.id}`);
    expect(res.status).toBe(403);

    const body = await res.json() as Record<string, unknown>;
    expect(body.data).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Urlaub genehmigt');
  });

  it('liefert Mitarbeiter A ohne Parameter das eigene Journal', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await fetch(`${baseUrl}/api/vacation-transactions`);
    expect(res.status).toBe(200);

    const body = await res.json() as { data: { userId: number; transactions: unknown[] } };
    expect(body.data.userId).toBe(employeeA.id);
    expect(body.data.transactions.length).toBeGreaterThanOrEqual(2);
  });

  it('erlaubt Mitarbeiter A den expliziten Zugriff auf das eigene Konto', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await fetch(`${baseUrl}/api/vacation-transactions?userId=${employeeA.id}`);
    expect(res.status).toBe(200);
  });

  it('liefert dem Admin den Auszug von Mitarbeiter B für ein gewähltes Jahr', async () => {
    const baseUrl = await startTestServer(admin);
    const res = await fetch(`${baseUrl}/api/vacation-transactions?userId=${employeeB.id}&year=${testYear}`);
    expect(res.status).toBe(200);

    const body = await res.json() as { data: { userId: number; transactions: { year: number }[] } };
    expect(body.data.userId).toBe(employeeB.id);
    expect(body.data.transactions.every(t => t.year === testYear)).toBe(true);
  });

  it('liefert für ein Jahr ohne Buchungen einen leeren Auszug', async () => {
    const baseUrl = await startTestServer(admin);
    const res = await fetch(`${baseUrl}/api/vacation-transactions?userId=${employeeB.id}&year=${emptyYear}`);
    expect(res.status).toBe(200);

    const body = await res.json() as { data: { transactions: unknown[]; journalBalance: number } };
    expect(body.data.transactions.length).toBe(0);
    expect(body.data.journalBalance).toBe(0);
  });

  it('REQ-13: Buchungen mit Antragsbezug tragen die Antragsdaten, andere nicht', async () => {
    const baseUrl = await startTestServer(admin);
    const res = await fetch(`${baseUrl}/api/vacation-transactions?userId=${employeeB.id}&year=${testYear}`);
    expect(res.status).toBe(200);

    const body = await res.json() as {
      data: {
        transactions: {
          referenceType: string | null;
          absence: { id: number; startDate: string; endDate: string; status: string } | null;
        }[];
      };
    };

    const absenceEntry = body.data.transactions.find(t => t.referenceType === 'absence');
    expect(absenceEntry?.absence).toMatchObject({
      id: absenceBId,
      startDate: `${testYear}-06-10`,
      endDate: `${testYear}-06-14`,
      status: 'approved',
    });

    const systemEntry = body.data.transactions.find(t => t.referenceType === 'system');
    expect(systemEntry?.absence).toBeNull();
  });

  it('weist einen konsistenten Saldo aus (available === journalBalance === entitlement + carryover - taken)', async () => {
    const baseUrl = await startTestServer(admin);
    const res = await fetch(`${baseUrl}/api/vacation-transactions?userId=${employeeB.id}&year=${testYear}`);
    expect(res.status).toBe(200);

    const body = await res.json() as {
      data: { available: number; journalBalance: number; entitlement: number; carryover: number; taken: number };
    };
    expect(body.data.available).toBe(body.data.journalBalance);
    expect(body.data.available).toBe(body.data.entitlement + body.data.carryover - body.data.taken);
  });

  it('weist einen nicht angemeldeten Zugriff ab (401)', async () => {
    const baseUrl = await startTestServer(null);
    const res = await fetch(`${baseUrl}/api/vacation-transactions`);
    expect(res.status).toBe(401);
  });

  it('weist eine ungültige userId ab (400)', async () => {
    const baseUrl = await startTestServer(admin);
    const res = await fetch(`${baseUrl}/api/vacation-transactions?userId=abc`);
    expect(res.status).toBe(400);
  });

  it('verweigert Mitarbeiter A den Zugriff auf den Kontostand von Mitarbeiter B (403)', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await fetch(`${baseUrl}/api/vacation-balances/${employeeB.id}`);
    expect(res.status).toBe(403);
  });

  it('erlaubt Mitarbeiter A den Zugriff auf den eigenen Kontostand', async () => {
    const baseUrl = await startTestServer(employeeA);
    const res = await fetch(`${baseUrl}/api/vacation-balances/${employeeA.id}`);
    expect(res.status).toBe(200);
  });
});
