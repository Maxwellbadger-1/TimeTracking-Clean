# Directory Structure

## Root Structure

```
TimeTracking-Clean/
├── .github/workflows/      # CI/CD pipelines (GitHub Actions)
├── .claude/               # Claude Code configuration
├── desktop/               # Tauri desktop app (React frontend)
├── server/                # Express backend
├── package.json           # Workspace root (monorepo)
├── ARCHITECTURE.md        # Architecture documentation
├── PROJECT_SPEC.md        # Product requirements
├── PROJECT_STATUS.md      # Current project status
├── CHANGELOG.md           # Version history
└── ENV.md                 # Environment configuration
```

## Workspace: desktop/ (Frontend)

```
desktop/
├── src/
│   ├── api/                    # API client + TanStack Query
│   │   ├── client.ts           # API client (universalFetch)
│   │   └── exports.ts          # Export API hooks
│   │
│   ├── assets/                 # Static assets (images, logos)
│   │   └── maxflow-logo.png    # Company logo
│   │
│   ├── components/             # React components
│   │   ├── absences/           # Absence request components
│   │   ├── auth/               # Login, password change
│   │   ├── calendar/           # Calendar view components (14 files)
│   │   ├── corrections/        # Overtime correction UI
│   │   ├── dashboard/          # Employee/Admin dashboards
│   │   ├── layout/             # Sidebar, headers
│   │   ├── notifications/      # Notification bell, list
│   │   ├── privacy/            # Privacy policy modal
│   │   ├── reports/            # Report generation UI (7 files)
│   │   ├── settings/           # Settings management
│   │   ├── timeEntries/        # Time entry forms, lists
│   │   ├── ui/                 # Reusable UI primitives (15 files)
│   │   │   ├── Button.tsx      # Button component
│   │   │   ├── Input.tsx       # Input component
│   │   │   ├── Modal.tsx       # Modal component
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ...
│   │   ├── users/              # User management UI
│   │   ├── vacation/           # Vacation balance UI
│   │   └── worktime/           # Work time account UI (9 files)
│   │
│   ├── hooks/                  # Custom React hooks (24 files)
│   │   ├── useWebSocket.ts     # WebSocket real-time updates
│   │   ├── useAutoUpdater.ts   # Desktop app auto-updater
│   │   ├── useDesktopNotifications.ts  # Native notifications
│   │   ├── useGlobalKeyboardShortcuts.ts  # Keyboard shortcuts
│   │   ├── useAuth.ts          # Authentication hooks
│   │   ├── useTimeEntries.ts   # Time entry CRUD hooks
│   │   ├── useAbsences.ts      # Absence CRUD hooks
│   │   ├── useOvertime.ts      # Overtime queries
│   │   └── ...                 # 16 more hooks
│   │
│   ├── lib/                    # Core libraries
│   │   └── tauriHttpClient.ts  # universalFetch wrapper (CRITICAL!)
│   │
│   ├── pages/                  # Route-level components (12 pages)
│   │   ├── AbsencesPage.tsx           # Absence management
│   │   ├── BackupPage.tsx             # Database backup
│   │   ├── CalendarPage.tsx           # Calendar view
│   │   ├── ForcePasswordChangePage.tsx # Password reset
│   │   ├── NotificationsPage.tsx      # Notification center
│   │   ├── OvertimeManagementPage.tsx # Overtime admin
│   │   ├── ReportsPage.tsx            # Report generation
│   │   ├── SettingsPage.tsx           # System settings
│   │   ├── TimeEntriesPage.tsx        # Time entry list
│   │   ├── UserManagementPage.tsx     # User admin
│   │   ├── VacationBalanceManagementPage.tsx  # Vacation admin
│   │   └── YearEndRolloverPage.tsx    # Year-end rollover
│   │
│   ├── services/               # Frontend services
│   │   └── reportService.ts    # Report generation logic
│   │
│   ├── store/                  # Zustand state stores
│   │   ├── authStore.ts        # Authentication state
│   │   ├── themeStore.ts       # Dark/light theme
│   │   └── uiStore.ts          # UI state (current view)
│   │
│   ├── test/                   # Frontend tests
│   │   ├── setup.ts            # Vitest setup
│   │   └── ...
│   │
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts            # Shared frontend types
│   │
│   ├── utils/                  # Frontend utilities (13 files)
│   │   ├── formatters.ts       # Date/time formatting
│   │   ├── validation.ts       # Form validation
│   │   ├── dateHelpers.ts      # Date manipulation
│   │   └── ...
│   │
│   ├── App.tsx                 # Root component
│   ├── main.tsx                # React entry point
│   ├── styles.css              # Global styles
│   └── vite-env.d.ts           # Vite TypeScript types
│
├── src-tauri/                  # Tauri Rust layer
│   ├── src/
│   │   ├── lib.rs              # Tauri setup
│   │   └── main.rs             # Rust entry point
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri configuration
│   └── icons/                  # App icons (macOS, Windows, Linux)
│
├── package.json                # Desktop dependencies
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build config
├── tailwind.config.js          # Tailwind CSS config
├── postcss.config.js           # PostCSS config
└── playwright.config.ts        # E2E test config
```

### Key Frontend Locations

**Entry Point**: `desktop/src/main.tsx`
**Root Component**: `desktop/src/App.tsx`
**API Client**: `desktop/src/api/client.ts`
**Routing**: Single-page app (no React Router, view state in `uiStore`)
**Styles**: Tailwind CSS (utility-first), `desktop/src/styles.css`

## Workspace: server/ (Backend)

```
server/
├── src/
│   ├── config/                 # Configuration
│   │   └── database.ts         # Database config
│   │
│   ├── database/               # Database layer
│   │   ├── migrations/         # SQL migration files (6 migrations)
│   │   │   ├── 001_backfill_overtime_transactions.ts
│   │   │   ├── 002_extend_transaction_types.ts
│   │   │   ├── 003_add_pending_to_vacation_balance.ts
│   │   │   ├── 004_drop_overtime_unique_index.ts
│   │   │   ├── 005_add_balance_tracking_columns.ts
│   │   │   └── 006_add_time_entry_transaction_type.ts
│   │   ├── connection.ts       # Database singleton
│   │   ├── schema.ts           # Table definitions (14 tables)
│   │   ├── indexes.ts          # Performance indexes (15+ indexes)
│   │   ├── seed.ts             # Initial data seeding
│   │   ├── migrationRunner.ts  # Migration system
│   │   └── test-indexes.ts     # Index validation tests
│   │
│   ├── middleware/             # Express middleware
│   │   ├── auth.ts             # Authentication, RBAC
│   │   ├── errorHandler.ts     # Centralized error handling
│   │   ├── performanceMonitor.ts  # Request duration tracking
│   │   ├── rateLimits.ts       # Rate limiting (API, login)
│   │   └── validation.ts       # Request validation
│   │
│   ├── routes/                 # API route handlers (17 files)
│   │   ├── absences.ts         # /api/absences
│   │   ├── auth.ts             # /api/auth
│   │   ├── backup.ts           # /api/backup
│   │   ├── departments.ts      # /api/departments
│   │   ├── exports.ts          # /api/exports
│   │   ├── holidays.ts         # /api/holidays
│   │   ├── notifications.ts    # /api/notifications
│   │   ├── overtime.ts         # /api/overtime
│   │   ├── performance.ts      # /api/performance
│   │   ├── projects.ts         # /api/projects
│   │   ├── reports.ts          # /api/reports
│   │   ├── settings.ts         # /api/settings
│   │   ├── timeEntries.ts      # /api/time-entries
│   │   ├── users.ts            # /api/users
│   │   ├── vacationBalance.ts  # /api/vacation-balance
│   │   ├── workTimeAccounts.ts # /api/worktime-accounts
│   │   └── yearEndRollover.ts  # /api/year-end-rollover
│   │
│   ├── services/               # Business logic layer (27 files)
│   │   ├── __tests__/          # Service tests
│   │   │
│   │   ├── absenceService.ts   # Absence CRUD, approval workflow
│   │   ├── arbeitszeitgesetzService.ts  # German labor law compliance
│   │   ├── auditService.ts     # Audit logging
│   │   ├── authService.ts      # Authentication, JWT
│   │   ├── backupService.ts    # Database backup/restore
│   │   ├── cronService.ts      # Scheduled tasks (backups, rollover)
│   │   ├── exportService.ts    # CSV/DATEV exports
│   │   ├── holidayService.ts   # German public holidays
│   │   ├── notificationService.ts  # Notification CRUD
│   │   │
│   │   ├── overtimeService.ts  # Overtime calculation (CRITICAL, 1500 LOC)
│   │   ├── overtimeLiveCalculationService.ts  # Real-time balance
│   │   ├── overtimeTransactionService.ts  # Transaction ledger
│   │   ├── overtimeTransactionRebuildService.ts  # Rebuild transactions
│   │   ├── overtimeTransactionManager.ts  # Transaction orchestration
│   │   ├── overtimeCorrectionsService.ts  # Manual corrections
│   │   ├── unifiedOvertimeService.ts  # Unified interface
│   │   │
│   │   ├── reportService.ts    # Monthly reports, summaries
│   │   ├── settingsService.ts  # System configuration
│   │   ├── timeEntryService.ts # Time entry CRUD, validation
│   │   ├── userService.ts      # User CRUD, authentication
│   │   ├── vacationBalanceService.ts  # Vacation tracking
│   │   ├── workTimeAccountService.ts  # Flex time accounts
│   │   ├── yearEndRolloverService.ts  # Year-end vacation rollover
│   │   │
│   │   ├── balanceTracking.test.ts  # Balance tracking tests
│   │   ├── overtimeTransactionCentralization.test.ts
│   │   └── unifiedOvertimeService.test.ts
│   │
│   ├── scripts/                # Utility scripts (26 files)
│   │   ├── migrate.ts          # Run migrations
│   │   ├── seed.ts             # Seed database
│   │   ├── resetDatabase.ts    # Reset DB to clean state
│   │   ├── sync-db.ts          # Sync production → staging
│   │   │
│   │   ├── validateOvertimeCalculation.ts  # Overtime validation
│   │   ├── validateOvertimeDetailed.ts     # Detailed validation (CRITICAL!)
│   │   ├── validateAllTestUsers.ts         # Validate all test users
│   │   ├── recalculateOvertimeBalances.ts  # Rebuild all overtime
│   │   │
│   │   ├── seedTestUsers.ts    # Create test users
│   │   ├── createEnhancedTestUser.ts
│   │   ├── createSuperTestUser.ts
│   │   ├── createNewEmployeeTestUser.ts
│   │   ├── cleanTestUsers.ts
│   │   │
│   │   ├── add2026TimeEntries.ts  # Seed 2026 data
│   │   ├── addHistoricalTimeEntries.ts  # Seed historical data
│   │   │
│   │   └── ... (16 more scripts)
│   │
│   ├── test/                   # Backend tests
│   │   └── generateTestData.ts # Test data generation
│   │
│   ├── types/                  # TypeScript types
│   │   └── index.ts            # Shared backend types
│   │
│   ├── utils/                  # Backend utilities (8 files)
│   │   ├── jwt.ts              # JWT token generation/validation
│   │   ├── logger.ts           # Pino logger configuration
│   │   ├── timezone.ts         # Timezone utilities (CRITICAL!)
│   │   ├── validation.ts       # Input validation
│   │   ├── workingDays.ts      # Working days calculation (CRITICAL!)
│   │   └── workingDays.test.ts # Working days tests
│   │
│   ├── websocket/              # WebSocket server
│   │   └── server.ts           # WebSocket event handling
│   │
│   └── server.ts               # Express server entry point
│
├── database.db                 # SQLite database (development)
├── package.json                # Backend dependencies
├── tsconfig.json               # TypeScript configuration
└── vitest.config.ts            # Vitest test config
```

### Key Backend Locations

**Entry Point**: `server/src/server.ts`
**Database**: `server/database.db` (development), `DATABASE_PATH` env var (production)
**Migrations**: `server/src/database/migrations/`
**Services**: `server/src/services/` (business logic)
**Routes**: `server/src/routes/` (API endpoints)
**Scripts**: `server/src/scripts/` (CLI tools, validation)

## CI/CD Workflows (.github/workflows/)

```
.github/workflows/
├── deploy-server.yml          # Deploy server to production (blue)
├── deploy-staging.yml         # Deploy server to staging (green)
├── release.yml                # Build desktop app binaries
├── test.yml                   # Run tests on PR
├── manual-migration.yml       # Manual database migration
├── complete-migration.yml     # Complete migration workflow
└── migrate-blue-to-green.yml  # Sync databases
```

### Workflow Triggers

- `deploy-server.yml`: Push to `main` branch (server changes)
- `deploy-staging.yml`: Push to `staging` branch
- `release.yml`: Git tag `v*` (e.g., `v1.7.0`)
- `test.yml`: Pull request opened

## Database Structure (SQLite)

**Location**: `server/database.db` (development)

### Core Tables (6)

1. **users** - User accounts, authentication
   - Columns: id, username, email, password, firstName, lastName, role, department, weeklyHours, vacationDaysPerYear, hireDate, endDate, status, workSchedule, privacyConsentAt
   - Indexes: username (unique), email (unique)

2. **time_entries** - Daily time tracking
   - Columns: id, userId, date, projectId, activityId, hours, description, status, deletedAt
   - Indexes: userId, date, projectId

3. **absence_requests** - Vacation, sick leave, overtime comp
   - Columns: id, userId, type, startDate, endDate, days, reason, status, adminNotes, deletedAt
   - Indexes: userId, startDate, status

4. **vacation_balance** - Vacation day tracking
   - Columns: id, userId, year, entitled, carried, pending, used, remaining
   - Indexes: userId + year (unique)

5. **overtime_balance** - Monthly overtime snapshot (SOURCE OF TRUTH)
   - Columns: id, userId, month, balance, targetHours, actualHours, calculatedAt
   - Indexes: userId + month (unique)

6. **overtime_transactions** - Overtime transaction ledger
   - Columns: id, userId, date, type, hours, description, relatedId, relatedType, createdAt
   - Indexes: userId, date, type

### Supporting Tables (8)

7. **departments** - Organizational units
8. **projects** - Time entry projects
9. **activities** - Time entry activities
10. **holidays** - German public holidays (federal + state)
11. **notifications** - User notifications
12. **audit_log** - System audit trail
13. **work_time_accounts** - Flex time transactions
14. **settings** - System configuration

### Migration Tracking

**migrations** table (auto-created):
- Columns: id, name, executedAt
- Tracks applied migrations

## Environment Configuration Files

### Development
- `desktop/.env.development` - Frontend dev config
  - `VITE_API_URL=http://localhost:3000`
- `server/.env` (gitignored) - Backend dev config

### Staging
- `desktop/.env.staging` - Frontend staging config
  - `VITE_API_URL=http://129.159.8.19:3001`

### Production
- `desktop/.env.production` - Frontend production config
  - `VITE_API_URL=http://129.159.8.19:3000`
- `server/.env` (on Oracle Cloud) - Backend production config
  - `NODE_ENV=production`
  - `SESSION_SECRET=...`
  - `TZ=Europe/Berlin`
  - `PORT=3000`
  - `DATABASE_PATH=/path/to/database.db`

## Naming Conventions

### Files
- **Components**: PascalCase (`UserManagementPage.tsx`, `Button.tsx`)
- **Utilities**: camelCase (`formatters.ts`, `validation.ts`)
- **Services**: camelCase + Service suffix (`overtimeService.ts`)
- **Routes**: camelCase (`timeEntries.ts`, `absences.ts`)
- **Scripts**: camelCase (`validateOvertimeDetailed.ts`)

### Directories
- **Lowercase**: `server/src/routes/`, `desktop/src/hooks/`
- **kebab-case**: `server/src/database/migrations/`

### Code
- **Variables**: camelCase (`userId`, `overtimeBalance`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `SESSION_SECRET`)
- **Types/Interfaces**: PascalCase (`User`, `TimeEntry`, `ApiResponse`)
- **Functions**: camelCase (`calculateOvertime`, `getTimeEntries`)

## Important Locations

### Documentation
- `ARCHITECTURE.md` - System architecture
- `PROJECT_SPEC.md` - Product requirements (~1500 lines)
- `PROJECT_STATUS.md` - Current project status (~400 lines)
- `CHANGELOG.md` - Version history (~300 lines)
- `ENV.md` - Environment configuration (~429 lines)
- `.claude/CLAUDE.md` - AI development guidelines (~750 lines)

### Configuration
- `.github/workflows/` - CI/CD pipelines
- `.claude/` - Claude Code configuration
- `.claude/commands/` - Custom slash commands
- `.claude/commands/gsd/` - Get Shit Done workflow commands

### Testing
- `server/src/**/*.test.ts` - Backend unit tests
- `desktop/src/test/` - Frontend tests
- `server/src/scripts/validate*.ts` - Validation scripts (CRITICAL for overtime!)

### Scripts & Tools
- `server/src/scripts/` - CLI tools (26 scripts)
  - **Validation**: `validateOvertimeDetailed.ts`, `validateAllTestUsers.ts`
  - **Data**: `seedTestUsers.ts`, `add2026TimeEntries.ts`
  - **Migrations**: `migrate.ts`, `migrateToNewTransactionSystem.ts`
  - **Maintenance**: `recalculateOvertimeBalances.ts`, `refreshOvertimeBalances.ts`

## Build Output Locations

### Desktop App
- `desktop/dist/` - Vite build output
- `desktop/src-tauri/target/` - Tauri build output (~6-8 GB, gitignored)
- `desktop/src-tauri/target/release/bundle/` - Desktop app binaries (DMG, EXE, MSI, AppImage, DEB)

### Server
- `server/dist/` - TypeScript compilation output
- `server/node_modules/.cache/` - Build cache

### Artifacts (Gitignored)
- `node_modules/` (root, desktop, server)
- `*.db` (development databases)
- `*.log` (PM2 logs)
- `.env*` (environment variables)
- `desktop/src-tauri/target/` (Rust build cache)

## Key Entry Points

### Development
1. **Start Backend**: `cd server && npm run dev` → http://localhost:3000
2. **Start Desktop**: `cd desktop && npm run tauri:dev` → http://localhost:1420
3. **View Logs**: Terminal output (both processes)

### Production Deployment
1. **SSH**: `ssh ubuntu@129.159.8.19`
2. **Logs**: `pm2 logs timetracking-server`
3. **Status**: `pm2 status`
4. **Database**: `/home/ubuntu/timetracking/server/database.db`

### Desktop App Build
1. **Build Command**: `cd desktop && npm run tauri:build`
2. **Output**: `desktop/src-tauri/target/release/bundle/`
3. **Artifacts**: DMG (macOS), EXE/MSI (Windows), AppImage/DEB (Linux)

### Release Process
1. **Tag**: `git tag v1.X.Y && git push origin v1.X.Y`
2. **GitHub Actions**: Builds desktop app for all platforms
3. **Release**: GitHub Releases page with binaries
4. **Auto-Update**: Desktop app checks for updates on startup
