-- Migration: Add position column to users table
-- Date: 2026-02-08
-- Purpose: Add employee position/job title field for better user profiles

-- Add position column (optional field for job title/position)
ALTER TABLE users ADD COLUMN position TEXT;

-- Create index for position filtering (useful for reports)
CREATE INDEX IF NOT EXISTS idx_users_position ON users(position) WHERE position IS NOT NULL;
