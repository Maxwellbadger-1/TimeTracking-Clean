import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import db from '../database/connection.js';
import { logAudit } from '../services/auditService.js';
import type { ApiResponse, Project } from '../types/index.js';

const router = Router();

// GET all projects
router.get('/', requireAuth, (_req: Request, res: Response<ApiResponse<Project[]>>) => {
  try {
    const stmt = db.prepare('SELECT * FROM projects ORDER BY name');
    const projects = stmt.all() as Project[];

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('❌ Error getting projects:', error);
    res.status(500).json({ success: false, error: 'Failed to get projects' });
  }
});

// POST create project (Admin only)
router.post('/', requireAuth, requireAdmin, (req: Request, res: Response<ApiResponse<Project>>) => {
  try {
    const { name, active = 1 } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Project name is required' });
      return;
    }

    const stmt = db.prepare('INSERT INTO projects (name, active) VALUES (?, ?)');
    const result = stmt.run(name.trim(), active ? 1 : 0);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid) as Project;

    logAudit(req.session.user!.id, 'create', 'project', project.id, { name: project.name });

    res.status(201).json({ success: true, data: project, message: 'Project created' });
  } catch (error) {
    console.error('❌ Error creating project:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

// PATCH update project active status (Admin only)
router.patch('/:id', requireAuth, requireAdmin, (req: Request, res: Response<ApiResponse<Project>>) => {
  try {
    const id = parseInt(req.params.id);
    const { active } = req.body;

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const stmt = db.prepare('UPDATE projects SET active = ? WHERE id = ?');
    const result = stmt.run(active ? 1 : 0, id);

    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project;

    logAudit(req.session.user!.id, 'update', 'project', id, { active: project.active });

    res.json({ success: true, data: project, message: 'Project updated' });
  } catch (error) {
    console.error('❌ Error updating project:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

// DELETE project (Admin only)
router.delete('/:id', requireAuth, requireAdmin, (req: Request, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    logAudit(req.session.user!.id, 'delete', 'project', id);

    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('❌ Error deleting project:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

export default router;
