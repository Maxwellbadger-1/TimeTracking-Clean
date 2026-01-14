-- Create test user "Silvia Lachner"
INSERT INTO users (username, email, password, firstName, lastName, role, weeklyHours, hireDate, workSchedule)
VALUES ('silvia.test', 'silvia@test.de', '$2b$10$test', 'Silvia', 'Test', 'employee', 18.0, '2026-01-01', 
  '{"monday":0,"tuesday":0,"wednesday":8,"thursday":8,"friday":2,"saturday":0,"sunday":0}');

-- Get user ID (should be 47 in dev db)
SELECT 'User ID: ' || id FROM users WHERE firstName = 'Silvia' AND lastName = 'Test';

-- Add time entries matching the screenshot:
-- 01.01.2026 (Mi): 10.5h worked (Holiday! Neujahr → 0h Soll → +10.5h overtime)
INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
VALUES (
  (SELECT id FROM users WHERE firstName = 'Silvia' AND lastName = 'Test'),
  '2026-01-01', '08:00', '18:30', 0, 10.5, 'office'
);

-- 02.01.2026 (Do): No time entry, Überstunden-Ausgleich (4h Urlaub) → Soll 8h, Ist 0h = -8h, BUT +4h credit from absence
INSERT INTO absence_requests (userId, type, startDate, endDate, days, status, approvedBy, approvedAt)
VALUES (
  (SELECT id FROM users WHERE firstName = 'Silvia' AND lastName = 'Test'),
  'overtime_comp', '2026-01-02', '2026-01-02', 0.5, 'approved', 1, datetime('now')
);

-- 03.01.2026 (Fr): No time entry → Soll 2h, Ist 0h = -2h

-- 06.01.2026 (Mo): No workday (0h Soll)

-- 07.01.2026 (Di): No workday (0h Soll)

-- 08.01.2026 (Mi): 9h worked → Soll 8h, Ist 9h = +1h
INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
VALUES (
  (SELECT id FROM users WHERE firstName = 'Silvia' AND lastName = 'Test'),
  '2026-01-08', '08:00', '17:00', 0, 9.0, 'office'
);

-- 09.01.2026 (Do): 9.5h worked → Soll 8h, Ist 9.5h = +1.5h
INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
VALUES (
  (SELECT id FROM users WHERE firstName = 'Silvia' AND lastName = 'Test'),
  '2026-01-09', '08:00', '17:30', 0, 9.5, 'office'
);

-- 10.01.2026 (Fr): No time entry → Soll 2h, Ist 0h = -2h (wait, screenshot shows no entry for Friday yet)

-- 13.01.2026 (Mo): No workday (0h Soll)

-- 14.01.2026 (Di/heute): No entry yet → Soll 0h, Ist 0h = 0h

SELECT 'Inserted time entries for dates: 2026-01-01, 2026-01-08, 2026-01-09';
