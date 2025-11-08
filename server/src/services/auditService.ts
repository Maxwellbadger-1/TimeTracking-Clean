import db from '../database/connection.js';

/**
 * Audit Log Service - Track all important changes
 */

export function logAudit(
  userId: number | null,
  action: 'create' | 'update' | 'delete' | 'export',
  entity: string,
  entityId: number | null,
  changes?: Record<string, unknown>
): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_log (userId, action, entity, entityId, changes)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      action,
      entity,
      entityId,
      changes ? JSON.stringify(changes) : null
    );

    console.log(`📝 Audit log: ${action} ${entity} ${entityId || ''}`);
  } catch (error) {
    console.error('❌ Error logging audit:', error);
    // Don't throw - audit logging shouldn't break the main operation
  }
}
