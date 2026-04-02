# System Architecture

## Architecture Pattern

**Pattern**: **Monorepo with Client-Server Architecture + Desktop Wrapper**

### Overview
- **Monorepo**: npm workspaces (`desktop/`, `server/`)
- **Backend**: Express REST API + WebSocket server
- **Frontend**: React SPA with Tauri desktop wrapper
- **Database**: SQLite (embedded, local-first)
- **State Management**: TanStack Query (server state) + Zustand (client state)

### Key Architectural Decisions

1. **Local-First Architecture**
   - Embedded SQLite database (no external database server)
   - Desktop app connects to local or remote Express server
   - No cloud dependencies for core functionality

2. **Desktop-Native App** (Tauri 2.x)
   - Rust-based lightweight wrapper (~15 MB)
   - Native OS integrations (notifications, file system)
   - Auto-update system
   - Better performance than Electron (~10x smaller)

3. **RESTful API** (not GraphQL)
   - Simple, predictable endpoints
   - Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
   - JSON request/response
   - Session-based authentication

4. **Real-Time Updates** (WebSocket)
   - Broadcast notifications, overtime updates, absence approvals
   - Client receives events → invalidates TanStack Query cache → refetch

## System Layers

### Layer 1: Presentation (Desktop App)

**Technology**: React 19 + TypeScript + Tailwind CSS

```
desktop/src/
├── pages/          # Route-level components (12 pages)
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks (24 hooks)
├── store/          # Zustand global state (auth, theme, UI)
├── api/            # API client + TanStack Query hooks
├── utils/          # Frontend utilities
└── lib/            # Tauri HTTP client wrapper
```

**Key Components**:
- `App.tsx` - Root component, routing, global hooks
- `pages/` - Page-level components (Dashboard, TimeEntries, Absences, etc.)
- `components/ui/` - Reusable UI primitives (Button, Input, Modal, etc.)
- `api/client.ts` - API client with `universalFetch` (Tauri HTTP plugin)

**State Management**:
- **Server State**: TanStack Query (caching, invalidation, optimistic updates)
- **Client State**: Zustand stores (authStore, themeStore, uiStore)
- **Form State**: React useState + controlled components

**Data Flow**:
```
User Action → Component → API Client → TanStack Query → Server
                                            ↓
                                         Cache
                                            ↓
                                    Re-render on change
```

### Layer 2: API Layer (Express Routes)

**Location**: `server/src/routes/`

**Endpoints** (17 route files):
- `/api/auth` - Login, logout, session management
- `/api/users` - User CRUD, profile updates
- `/api/time-entries` - Time entry CRUD
- `/api/absences` - Absence requests (vacation, sick, overtime comp)
- `/api/overtime` - Overtime balance, transactions, corrections
- `/api/vacation-balance` - Vacation balance queries
- `/api/reports` - Monthly reports, overtime reports
- `/api/notifications` - Notification CRUD
- `/api/holidays` - Public holidays
- `/api/departments` - Department management
- `/api/projects` - Project management
- `/api/settings` - System settings
- `/api/exports` - CSV/DATEV exports
- `/api/backup` - Database backups
- `/api/performance` - Performance metrics (admin only)
- `/api/worktime-accounts` - Work time account transactions
- `/api/year-end-rollover` - Year-end vacation rollover

**Middleware Stack**:
```
Request → CORS → Helmet (security) → Rate Limiting → Session → Auth → Route Handler → Response
                                                                             ↓
                                                                     Error Handler
```

**Key Middleware**:
- `auth.ts` - Session validation, role-based access control
- `rateLimits.ts` - API (100/15min), Login (5/15min)
- `errorHandler.ts` - Centralized error handling
- `performanceMonitor.ts` - Request duration tracking
- `validation.ts` - Request body validation

### Layer 3: Business Logic (Services)

**Location**: `server/src/services/`

**Core Services** (27 service files):

**Time Tracking**:
- `timeEntryService.ts` - Time entry CRUD, validations
- `overtimeService.ts` - Overtime calculation (3-level: daily, weekly, monthly)
- `overtimeLiveCalculationService.ts` - Real-time overtime balance
- `overtimeTransactionService.ts` - Overtime transaction ledger
- `overtimeCorrectionsService.ts` - Manual overtime adjustments
- `unifiedOvertimeService.ts` - Unified overtime calculation interface
- `workTimeAccountService.ts` - Work time account (flex time) management

**Absence Management**:
- `absenceService.ts` - Absence request CRUD, approval workflow
- `vacationBalanceService.ts` - Vacation day balance tracking
- `holidayService.ts` - German public holidays integration

**User Management**:
- `userService.ts` - User CRUD, authentication
- `authService.ts` - Login, session validation, JWT generation

**Reporting & Exports**:
- `reportService.ts` - Monthly reports, overtime summaries
- `exportService.ts` - CSV/DATEV export generation

**System Services**:
- `notificationService.ts` - Notification creation, delivery
- `backupService.ts` - Database backup/restore
- `settingsService.ts` - System configuration
- `cronService.ts` - Scheduled tasks (backups, year-end rollover)
- `yearEndRolloverService.ts` - Automatic vacation rollover
- `arbeitszeitgesetzService.ts` - German labor law compliance checks
- `auditService.ts` - Audit logging

**Service Layer Pattern**:
```typescript
// Typical service structure
export class ExampleService {
  // CRUD operations
  getAll() → db.prepare(SELECT...).all()
  getById(id) → db.prepare(SELECT...).get(id)
  create(data) → db.prepare(INSERT...).run(data)
  update(id, data) → db.prepare(UPDATE...).run(id, data)
  delete(id) → db.prepare(DELETE...).run(id)

  // Business logic
  calculateSomething() → complex calculations
  validateSomething() → business rule validation
}
```

### Layer 4: Data Access (Database)

**Technology**: SQLite + better-sqlite3 (synchronous)

**Location**: `server/src/database/`

**Schema** (14 tables):

**Core Entities**:
1. `users` - User accounts, authentication, work schedules
2. `time_entries` - Daily time tracking records
3. `absence_requests` - Vacation, sick leave, overtime comp requests
4. `vacation_balance` - Vacation day tracking (current, pending, used)
5. `overtime_balance` - Monthly overtime balance (SOURCE OF TRUTH)
6. `overtime_transactions` - Overtime transaction ledger (earned, used, corrections)

**Supporting Entities**:
7. `departments` - Organizational units
8. `projects` - Time entry categorization
9. `activities` - Time entry activity types
10. `holidays` - German public holidays (federal + state)
11. `notifications` - User notifications
12. `audit_log` - System audit trail
13. `work_time_accounts` - Flex time account transactions
14. `settings` - System configuration

**Database Configuration**:
- **WAL Mode**: Multi-user concurrent access
- **Foreign Keys**: Enforced (verified on startup)
- **Transactions**: Used for multi-statement operations
- **Prepared Statements**: SQL injection protection

**Migration System**:
- Custom migration runner (`migrationRunner.ts`)
- SQL migration files in `migrations/` directory
- Migration tracking table (`migrations`)

**Key Database Files**:
- `connection.ts` - Database initialization, connection singleton
- `schema.ts` - Table creation, indexes
- `seed.ts` - Initial data seeding
- `indexes.ts` - Performance indexes

### Layer 5: WebSocket Server

**Location**: `server/src/websocket/server.ts`

**Purpose**: Real-time push notifications

**Events**:
- `notification` - New notification created
- `overtime_updated` - Overtime balance changed
- `time_entry_updated` - Time entry created/updated/deleted
- `absence_status_changed` - Absence request approved/rejected

**Client Integration**:
- Frontend hook: `desktop/src/hooks/useWebSocket.ts`
- Auto-invalidates TanStack Query cache on events
- Reconnect on disconnect

**Authentication**: Session-based (validated on WebSocket upgrade)

## Data Flow Patterns

### 1. Time Entry Creation Flow

```
User fills form → Submit → API Client (POST /api/time-entries)
                                ↓
                         Express Route Handler
                                ↓
                         timeEntryService.create()
                                ↓
                    Validations (date, hours, project)
                                ↓
                    INSERT INTO time_entries
                                ↓
                    Recalculate overtime (overtimeService)
                                ↓
                    UPDATE overtime_balance
                                ↓
                    WebSocket broadcast (time_entry_updated)
                                ↓
                    TanStack Query cache invalidation
                                ↓
                    UI re-renders with new data
```

### 2. Overtime Calculation Flow (3-Level System)

**CRITICAL**: Dual calculation system (Backend + Frontend)

**Backend (Source of Truth)**:
```
overtimeService.calculateOvertimeForMonth(userId, month)
    ↓
1. Get user data (workSchedule, weeklyHours, hireDate, endDate)
    ↓
2. Calculate Soll-Stunden (target hours)
   - For each day: getDailyTargetHours(date, user)
   - Respects: workSchedule > feiertage > weeklyHours
    ↓
3. Calculate Ist-Stunden (actual hours)
   - Time entries
   - Absence credits (vacation/sick/overtime_comp)
   - Corrections
    ↓
4. Overtime = Ist - Soll
    ↓
5. Save to overtime_balance table
```

**Frontend (Display)**:
```
reportService API call
    ↓
Frontend calculates overtime independently
    ↓
RISK: Can diverge from backend!
    ↓
SOLUTION: Validation scripts in server/src/scripts/validateOvertimeDetailed.ts
```

**19 Calculation Factors**:
- User: workSchedule, weeklyHours, hireDate, endDate
- Time: Feiertage, weekends, "today" reference
- Absences: vacation/sick/special (WITH credit), unpaid (WITHOUT credit)
- Corrections: Manual adjustments

### 3. Absence Approval Flow

```
Employee submits absence request
    ↓
INSERT INTO absence_requests (status='pending')
    ↓
WebSocket → Admin dashboard
    ↓
Admin approves
    ↓
UPDATE absence_requests SET status='approved'
    ↓
overtimeService.recordVacationCredit(userId, days)
    ↓
INSERT INTO overtime_transactions (type='vacation_credit')
    ↓
Recalculate overtime_balance
    ↓
WebSocket → Employee (absence_status_changed)
    ↓
Desktop notification
```

## Critical Architecture Components

### 1. Tauri HTTP Client (`universalFetch`)

**Problem**: Browser `fetch()` doesn't send cookies in Tauri cross-origin requests

**Solution**: Wrapper that detects Tauri runtime and uses `@tauri-apps/plugin-http`

**Implementation**: `desktop/src/lib/tauriHttpClient.ts`

```typescript
export async function universalFetch(url: string, options?: RequestInit) {
  if (window.__TAURI__) {
    // Use Tauri HTTP client (sends cookies correctly)
    return fetch(url, { client: { type: 'Fetch' }, ...options });
  } else {
    // Use browser fetch (development/web)
    return fetch(url, options);
  }
}
```

### 2. TanStack Query Integration

**Purpose**: Server state caching, optimistic updates, automatic refetching

**Query Keys Pattern**:
```typescript
['users']                    // All users
['users', userId]            // Single user
['time-entries', { month }]  // Time entries for month
['overtime', userId, year]   // Overtime balance
```

**Invalidation Strategy**:
- Mutation success → invalidate related queries
- WebSocket event → invalidate queries
- Manual refetch on focus

**Example**:
```typescript
// Query
const { data: timeEntries } = useQuery({
  queryKey: ['time-entries', { userId, month }],
  queryFn: () => api.getTimeEntries(userId, month),
});

// Mutation
const mutation = useMutation({
  mutationFn: api.createTimeEntry,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    queryClient.invalidateQueries({ queryKey: ['overtime'] });
  },
});
```

### 3. Session Management (Dual Auth)

**Primary**: Session cookies (Express Session)
**Secondary**: JWT tokens (Desktop app persistence)

**Why both?**
- Sessions: Secure, server-managed, automatic expiry
- JWT: Desktop app persistence across restarts

**Flow**:
```
Login → Server validates credentials
    ↓
Create session (express-session)
    ↓
Generate JWT token
    ↓
Response: { success, user, token }
    ↓
Desktop app: Store JWT in localStorage
Desktop app: Cookie stored automatically
    ↓
Subsequent requests: Send both (cookie + Authorization header)
    ↓
Server validates session (preferred) OR JWT (fallback)
```

### 4. Timezone Handling (CRITICAL!)

**Problem**: Date operations in JavaScript default to local timezone

**Solution**: Custom timezone utilities

**File**: `server/src/utils/timezone.ts`

**Key Functions**:
```typescript
getCurrentDate() → Date in Europe/Berlin timezone
formatDate(date, 'yyyy-MM-dd') → Timezone-safe formatting
toZonedTime(date, timezone) → Convert to timezone
```

**CRITICAL RULE**: NEVER use `date.toISOString().split('T')[0]` → UTC shift!

**Environment Variable**: `TZ=Europe/Berlin` (MUST be set in production)

## Deployment Architecture

### Development (Local)

```
Desktop App (Vite dev server :1420)
    ↓ HTTP
Server (Express :3000)
    ↓ SQLite
database.db (local file)
```

### Production (3-Tier: Blue/Green)

**Blue Server** (Production):
```
Port: 3000
Database: database.db
PM2 process: timetracking-server
Branch: main
```

**Green Server** (Staging):
```
Port: 3001
Database: database.green.db
PM2 process: timetracking-staging
Branch: staging
```

**Desktop App**:
```
macOS: DMG (Intel + ARM)
Windows: EXE, MSI
Linux: AppImage, DEB
    ↓ HTTP
Production Server (129.159.8.19:3000)
```

**Data Sync**:
```
/sync-green command: Copy database.db → database.green.db (ONE-WAY!)
NEVER: Green → Blue (data loss risk)
```

### CI/CD Pipeline

**Triggers**:
1. Push to `main` → `deploy-server.yml` → Blue server deployment
2. Push to `staging` → `deploy-staging.yml` → Green server deployment
3. Git tag `v*` → `release.yml` → Desktop app binaries

**Deployment Steps**:
```
1. Type check (npx tsc --noEmit)
2. Security audit (npm audit)
3. SSH to Oracle Cloud
4. Backup database
5. Pull latest code
6. npm install
7. npm run build
8. PM2 restart
9. Health check (curl /api/health)
```

## Security Architecture

### Authentication
- **Password Hashing**: bcrypt (cost factor 10)
- **Session Secret**: Environment variable (REQUIRED in production)
- **JWT Secret**: Environment variable
- **Session Timeout**: Configurable (default: 24h)

### Authorization
- **Role-Based**: admin, employee
- **Middleware**: `server/src/middleware/auth.ts`
- **Route Protection**: `requireAuth`, `requireAdmin`

### Input Validation
- **Backend**: Express validator + custom validation
- **Frontend**: HTML5 validation + TypeScript types
- **SQL Injection**: Prepared statements (ALWAYS)

### Security Headers
- **Helmet**: XSS, clickjacking, MIME sniffing protection
- **CORS**: Strict origin whitelist
- **CSP**: Content Security Policy

### Rate Limiting
- **API**: 100 requests / 15 minutes
- **Login**: 5 requests / 15 minutes
- **Protection**: Brute-force prevention

## Testing Architecture

### Backend Tests
- **Framework**: Vitest
- **Location**: `server/src/**/*.test.ts`
- **Key Tests**:
  - `workingDays.test.ts` - Working days calculation (CRITICAL!)
  - `balanceTracking.test.ts` - Overtime balance tracking
  - `unifiedOvertimeService.test.ts` - Overtime calculation accuracy

### Frontend Tests
- **Framework**: Vitest + Testing Library + Playwright
- **Unit Tests**: Component logic
- **Integration Tests**: TanStack Query hooks
- **E2E Tests**: Playwright (user workflows)

### Validation Scripts
- `validateOvertimeDetailed.ts` - Compare backend vs frontend overtime calculations
- `validateSchema.ts` - Database schema validation
- `verifyTestData.ts` - Test data integrity

**Run Tests**:
```bash
npm run test           # Watch mode
npm run test:run       # CI mode
npm run test:coverage  # Coverage report
npm run test:e2e       # Playwright E2E
```

## Performance Optimizations

### Database
- **Indexes**: 15+ indexes on foreign keys, date columns
- **WAL Mode**: Concurrent reads/writes
- **Prepared Statements**: Reusable queries (performance + security)

### Frontend
- **Code Splitting**: React.lazy for routes
- **TanStack Query**: Automatic caching, deduplication
- **Infinite Scroll**: Pagination for large lists
- **Tailwind CSS**: Purged unused styles

### Backend
- **Performance Monitor**: Track slow queries
- **Pino Logger**: Structured logging (faster than console.log)

## Error Handling Strategy

### Backend
```typescript
try {
  // Business logic
} catch (error) {
  logger.error('Error message', { error, context });
  throw new Error('User-friendly message');
}
```

**Error Middleware**: `server/src/middleware/errorHandler.ts`
- Logs error with Pino
- Returns JSON error response
- Sanitizes error messages (no stack traces in production)

### Frontend
```typescript
const mutation = useMutation({
  onError: (error) => {
    toast.error(`Failed: ${error.message}`);
    logger.log('Error', error);
  },
});
```

**Toast Notifications**: User-facing error messages (Sonner library)

## Logging Strategy

### Backend (Pino)
```typescript
logger.info('User logged in', { userId });
logger.warn('Rate limit exceeded', { ip });
logger.error('Database error', { error });
```

**Log Levels**: trace, debug, info, warn, error, fatal
**Production**: JSON logs → PM2 → log files
**Development**: Pretty-print to console

### Frontend (Console + Debug Panel)
```typescript
debugLog('API Request', { method, url, data });
```

**Debug Panel**: In-app debug console (F12 equivalent)

## Critical Business Logic

### Overtime Calculation (BUSINESS-CRITICAL!)

**Formula**: `Überstunden = Ist-Stunden - Soll-Stunden`

**Reference Date**: ALWAYS today (not end of month!)

**Soll-Stunden Priority**:
1. **workSchedule** (if exists) → Use daily hours
2. **Feiertag** (overrides workSchedule!) → 0 hours
3. **weeklyHours** (fallback) → weeklyHours / 5

**Ist-Stunden Components**:
- Time entries (actual work hours)
- Absence credits: vacation/sick/overtime_comp/special → FULL credit
- Unpaid absence → REDUCES Soll (no Ist credit!)
- Corrections → Manual adjustments

**Transaction Ledger**:
- All overtime changes recorded in `overtime_transactions`
- Types: earned, used, correction, vacation_credit, sick_credit, etc.
- Audit trail for every overtime change

**Source of Truth**: `overtime_balance` table (monthly snapshot)

**Validation**: `npm run validate:overtime:detailed -- --userId=X --month=YYYY-MM`
