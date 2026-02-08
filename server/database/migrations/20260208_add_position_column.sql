-- Migration: Add position column to users table
-- Created: 2026-02-08
-- Purpose: Add position field for employee job title/position tracking

-- Check if column exists first (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
-- This migration will fail if column already exists, which is the desired behavior
-- to ensure database consistency

ALTER TABLE users ADD COLUMN position TEXT DEFAULT NULL;

-- Note: This column stores the job position/title of the employee
-- Examples: "Software Developer", "Project Manager", "HR Manager", etc.