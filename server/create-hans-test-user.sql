-- Test User: Hans Müller mit individuellem Wochenplan
-- Eintrittsdatum: 01.01.2025
-- Wochenstunden: 20h (Mo 10h, Mi 6h, Fr 4h)

-- 1. User anlegen
INSERT INTO users (
  username, 
  password, 
  email, 
  firstName, 
  lastName, 
  role, 
  weeklyHours, 
  workSchedule,
  vacationDaysPerYear,
  hireDate,
  status,
  isActive
) VALUES (
  'hans.mueller',
  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- password: test123
  'hans.mueller@test.de',
  'Hans',
  'Müller',
  'employee',
  20,
  '{"monday":10,"tuesday":0,"wednesday":6,"thursday":0,"friday":4,"saturday":0,"sunday":0}',
  30,
  '2025-01-01',
  'active',
  1
);

-- Get user ID
SELECT id FROM users WHERE username = 'hans.mueller';
