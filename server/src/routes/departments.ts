import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import db from '../database/connection.js';
import { logAudit } from '../services/auditService.js';
import type { ApiResponse, Department } from '../types/index.js';

const router = Router();

// GET all departments
router.get('/', requireAuth, (_req: Request, res: Response<ApiResponse<Department[]>>) => {
  try {
    const stmt = db.prepare('SELECT * FROM departments ORDER BY name');
    const departments = stmt.all() as Department[];

    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('❌ Error getting departments:', error);
    res.status(500).json({ success: false, error: 'Failed to get departments' });
  }
});

// POST create department (Admin only)
router.post('/', requireAuth, requireAdmin, (req: Request, res: Response<ApiResponse<Department>>) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Department name is required' });
      return;
    }

    const stmt = db.prepare('INSERT INTO departments (name) VALUES (?)');
    const result = stmt.run(name.trim());

    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid) as Department;

    logAudit(req.session.user!.id, 'create', 'department', dept.id, { name: dept.name });

    res.status(201).json({ success: true, data: dept, message: 'Department created' });
  } catch (error) {
    console.error('❌ Error creating department:', error);
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
});

// DELETE department (Admin only)
router.delete('/:id', requireAuth, requireAdmin, (req: Request, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const stmt = db.prepare('DELETE FROM departments WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Department not found' });
      return;
    }

    logAudit(req.session.user!.id, 'delete', 'department', id);

    res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    console.error('❌ Error deleting department:', error);
    res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
});

export default router;
