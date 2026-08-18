---
status: awaiting_human_verify
trigger: "GET /api/notifications returns 500 with 'no such column: position'"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED — `position` column missing from users table in development.db
test: Applied ALTER TABLE directly to development.db
expecting: userService.ts SELECT query including `position` will succeed; notifications route unblocked
next_action: Apply ALTER TABLE to development.db, verify

## Symptoms

expected: GET /api/notifications returns 200 with notification list
actual: 500 Internal Server Error on every notifications request
errors: {"success":false,"error":"no such column: position"}
reproduction: Open app at http://localhost:1420, any page that loads notifications triggers it automatically via polling
started: Happening now on local dev (Windows). Production unknown.

## Eliminated

- hypothesis: The notifications table itself has a missing column
  evidence: notifications table schema confirmed correct (id, userId, type, title, message, read, createdAt). notificationService.ts queries never reference `position`.
  timestamp: 2026-04-02T00:01:00Z

- hypothesis: The error originates in notificationService.ts
  evidence: notificationService.ts has no query referencing `position`. Error actually comes from requireAuth middleware calling getUserById(), which runs a SELECT query on `users` that explicitly lists `position`.
  timestamp: 2026-04-02T00:01:00Z

## Evidence

- timestamp: 2026-04-02T00:01:00Z
  checked: server/database/development.db users table schema
  found: Column list = [id, username, email, password, firstName, lastName, role, department, weeklyHours, vacationDaysPerYear, hireDate, endDate, status, privacyConsentAt, forcePasswordChange, workSchedule, createdAt, deletedAt] — NO `position` column
  implication: Any query explicitly naming `position` against this DB will fail with "no such column: position"

- timestamp: 2026-04-02T00:01:00Z
  checked: server/database.db users table schema  
  found: Column list includes `position` — production/root DB has the column correctly
  implication: The migration ran against server/database.db but NOT against server/database/development.db

- timestamp: 2026-04-02T00:01:00Z
  checked: server/src/config/database.ts getDatabasePath()
  found: When NODE_ENV != 'production' and DATABASE_PATH not set, returns `server/database/development.db`
  implication: Local dev server uses development.db, which is missing `position`

- timestamp: 2026-04-02T00:01:00Z
  checked: server/src/services/userService.ts getUserById() and getAllUsers()
  found: Both queries explicitly SELECT `position` from users table (line 20, 45)
  implication: Every auth-gated endpoint fails because requireAuth calls getUserById() on each JWT-authenticated request

- timestamp: 2026-04-02T00:01:00Z
  checked: server/src/middleware/auth.ts requireAuth()
  found: When JWT token present, calls getUserById(payload.userId) which runs the SELECT with `position`
  implication: ANY authenticated request triggers the error, not just notification-specific code. Notifications appear as the symptom because the frontend polls that endpoint frequently.

- timestamp: 2026-04-02T00:01:00Z
  checked: server/database/migrations/20260208_add_position_column.sql vs server/src/database/migrationRunner.ts
  found: The SQL migration file adds `position` to users. But migrationRunner.ts only loads .ts/.js files from server/src/database/migrations/. The SQL file is in server/database/migrations/ — a DIFFERENT directory — and is never loaded or executed.
  implication: The migration system never ran this SQL against development.db. The schema.ts comment "moved to SQL migration file... will be handled by the migration system" is incorrect — the SQL migration is invisible to the TypeScript migration runner.

## Resolution

root_cause: server/database/development.db is missing the `position` column on the `users` table. The SQL migration `20260208_add_position_column.sql` was placed in `server/database/migrations/` but the TypeScript migration runner only scans `server/src/database/migrations/` for `.ts/.js` files, so it was never executed. Every JWT-authenticated request calls `getUserById()` which SELECTs `position` explicitly, causing a SQLite error before any route handler runs.
fix: Apply ALTER TABLE users ADD COLUMN position TEXT to development.db directly (mirrors what the SQL migration does). Also add an inline migration in schema.ts (matching the pattern used for other columns) so future fresh development.db instances get the column automatically.
verification: getUserById() query with explicit `position` column now executes successfully against development.db (node -e test confirmed "QUERY SUCCESS, position=null"). The column was absent before the fix.
files_changed: [server/src/database/schema.ts]
