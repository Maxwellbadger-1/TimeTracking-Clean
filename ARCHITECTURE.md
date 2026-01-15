# TimeTracking System - Software Architecture Documentation

**Document Version:** 1.0.0
**Last Updated:** 2026-01-15
**Status:** Production-Ready
**Architecture Style:** Cloud-First Microservice Architecture
**Framework:** arc42-inspired structure

---

## Document Control

| Field | Value |
|-------|-------|
| **Project** | TimeTracking System - Enterprise Zeiterfassung |
| **Version** | v1.5.1 |
| **Architects** | Development Team |
| **Reviewers** | Technical Leads |
| **Approval Date** | 2026-01-15 |
| **Next Review** | 2026-04-15 (Quarterly) |

---

## Table of Contents

1. [Introduction & Goals](#1-introduction--goals)
2. [Architecture Constraints](#2-architecture-constraints)
3. [System Context](#3-system-context)
4. [Solution Strategy](#4-solution-strategy)
5. [Building Block View](#5-building-block-view)
6. [Runtime View](#6-runtime-view)
7. [Deployment View](#7-deployment-view)
8. [Cross-Cutting Concepts](#8-cross-cutting-concepts)
9. [Architecture Decisions](#9-architecture-decisions)
10. [Quality Requirements](#10-quality-requirements)
11. [Risks & Technical Debt](#11-risks--technical-debt)
12. [Glossary](#12-glossary)

---

## 1. Introduction & Goals

### 1.1 Requirements Overview

TimeTracking System is a **cloud-based time tracking and absence management solution** for small to medium-sized enterprises (SMEs) in Germany. The system provides:

- Multi-user time tracking (desktop apps)
- Absence management with approval workflows
- Overtime calculation (German labor law compliant)
- Real-time synchronization across all clients
- DSGVO compliance (data stored in Frankfurt)

**Key Differentiator:** Zero-configuration desktop apps with native performance (15 MB vs. 100+ MB Electron apps).

---

### 1.2 Quality Goals

| Priority | Quality Goal | Scenario |
|----------|--------------|----------|
| **1** | **Performance** | API response time <200ms (p95) for 50 concurrent users |
| **2** | **Security** | DSGVO compliance, bcrypt password hashing, HTTPS communication |
| **3** | **Reliability** | 99.5% uptime SLA, automated backups, zero-downtime deployments |
| **4** | **Usability** | Zero IT configuration, auto-connect to cloud server |
| **5** | **Maintainability** | TypeScript strict mode, clear separation of concerns, comprehensive docs |

---

### 1.3 Stakeholders

| Role | Expectations | Concerns |
|------|--------------|----------|
| **End Users (Employees)** | Easy time tracking, transparent overtime | Ease of use, privacy |
| **HR Managers** | Accurate reports, compliance | DSGVO, labor law adherence |
| **System Administrators** | Low maintenance, secure | Reliability, backups, security |
| **Developers** | Clean codebase, good documentation | Code quality, testability |
| **Management** | Cost control, insights | ROI, operational efficiency |

---

## 2. Architecture Constraints

### 2.1 Technical Constraints

| Constraint | Description | Rationale |
|------------|-------------|-----------|
| **SQLite Database** | Limited to ~200 concurrent users | Low infrastructure cost, good enough for SMEs |
| **Single Oracle Cloud Instance** | No horizontal scaling | Free tier limitation |
| **Desktop-Only Clients** | No web browser version | Tauri requires native runtime |
| **German Market Focus** | UI in German, DSGVO compliance | Target audience in Germany |

---

### 2.2 Organizational Constraints

| Constraint | Impact |
|------------|--------|
| **Small Development Team** | 1-2 developers → Simple architecture required |
| **Zero Infrastructure Budget** | Must use Oracle Cloud Free Tier |
| **No DevOps Team** | Fully automated CI/CD required |
| **Compliance Required** | DSGVO, ArbZG, BUrlG compliance mandatory |

---

### 2.3 Conventions

| Area | Convention |
|------|-----------|
| **Code Style** | TypeScript strict mode, ESLint + Prettier enforced |
| **Naming** | PascalCase (Components), camelCase (functions/variables) |
| **Commit Messages** | Conventional Commits (`feat:`, `fix:`, `chore:`) |
| **Branching** | Trunk-based development (main branch) |
| **Documentation** | Markdown files in root + `.claude/` directory |

---

## 3. System Context

### 3.1 Business Context

```mermaid
graph TB
    subgraph "External Systems"
        A[HR Manager]
        B[Employees]
        C[Payroll System]
    end

    subgraph "TimeTracking System"
        D[Desktop App]
        E[API Server]
        F[Database]
    end

    A -->|Manage Users, Approve Absences| D
    B -->|Track Time, Request Vacation| D
    D <-->|REST API + WebSocket| E
    E <-->|SQL Queries| F
    E -->|CSV Export| C
```

**External Interfaces:**
- **Desktop App ↔ API Server:** HTTPS REST API + WebSocket
- **API Server → Payroll System:** CSV Export (manual import)

---

### 3.2 Technical Context

```mermaid
graph TB
    subgraph "Client Layer"
        A[Windows App<br/>Tauri + React]
        B[macOS App<br/>Tauri + React]
        C[Linux App<br/>Tauri + React]
    end

    subgraph "Network Layer"
        D[HTTPS/WSS]
        E[Oracle Cloud Frankfurt]
    end

    subgraph "Server Layer"
        F[Node.js 20 LTS]
        G[Express REST API]
        H[WebSocket Server]
    end

    subgraph "Data Layer"
        I[SQLite WAL Mode]
        J[GFS Backup System]
    end

    A --> D
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    F --> H
    G --> I
    H --> I
    I --> J
```

**Communication Channels:**
- **Client → Server:** HTTPS (port 443), WSS (port 3000)
- **Server → Database:** Local file I/O (SQLite embedded)
- **Backup → Storage:** Local filesystem (`/backups/`)

---

## 4. Solution Strategy

### 4.1 Architecture Style

**Cloud-First Monolith** (like Slack, Teams)
- **Not:** Traditional Client-Server (local database)
- **Not:** Microservices (too complex for SME)
- **Yes:** Centralized cloud backend + thin desktop clients

**Benefits:**
- Zero configuration for end users
- Real-time synchronization across devices
- Centralized backups and data security
- Easy updates (no manual file distribution)

---

### 4.2 Technology Decisions

#### Frontend: Tauri 2.x (instead of Electron)

**Rationale:**
- 15 MB app size vs. 100+ MB Electron
- Native performance (Rust backend)
- Better security (sandboxed)
- Cross-platform (Windows, macOS, Linux)

**Trade-off:** No web browser version (Tauri requires native runtime)

---

#### Backend: Node.js + Express (instead of alternatives)

**Why Node.js?**
- Fast development (JavaScript ecosystem)
- TypeScript support (type safety)
- Good async I/O performance
- Mature ecosystem (npm packages)

**Alternatives Considered:**
- ❌ Python/Flask: Slower startup time
- ❌ Go: Steeper learning curve
- ❌ Rust: Too complex for rapid development

---

#### Database: SQLite (instead of PostgreSQL/MySQL)

**Why SQLite?**
- Zero configuration (no database server)
- Embedded (runs in process)
- Good enough for <100 users
- Simple backups (single file)

**Trade-offs:**
- Limited concurrency (~200 users max)
- No horizontal scaling
- Must migrate to PostgreSQL if >100 users

**WAL Mode:** Enabled for multi-user write access

---

#### State Management: TanStack Query + Zustand

**Why TanStack Query?**
- Server state caching (reduces API calls)
- Automatic refetching and invalidation
- Optimistic updates
- Error handling built-in

**Why Zustand?**
- Simple UI state management
- No boilerplate (unlike Redux)
- TypeScript-friendly
- Small bundle size (~1 KB)

---

### 4.3 Decomposition Strategy

**Layered Architecture:**

```
┌─────────────────────────────────────┐
│   Presentation Layer (React)        │
│   - Components, Pages, Hooks        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   API Layer (REST + WebSocket)      │
│   - Express Routes, Middleware      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Business Logic Layer (Services)   │
│   - timeEntryService, userService   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Data Access Layer (better-sqlite3)│
│   - SQL Queries, Transactions       │
└─────────────────────────────────────┘
```

**Principles:**
- **Separation of Concerns:** Each layer has single responsibility
- **Dependency Rule:** Layers only depend on layers below
- **No Business Logic in Routes:** Controllers are thin, services are thick

---

## 5. Building Block View

### 5.1 Level 0: System Overview (Whitebox)

```mermaid
graph LR
    A[Desktop App] <-->|API Calls| B[Server]
    B <-->|Queries| C[Database]
```

**Components:**
1. **Desktop App** - Tauri application (Windows/macOS/Linux)
2. **Server** - Node.js backend (Oracle Cloud)
3. **Database** - SQLite database with WAL mode

---

### 5.2 Level 1: Desktop App (Whitebox)

```mermaid
graph TB
    subgraph "Desktop App (Tauri)"
        A[React UI Layer]
        B[TanStack Query Cache]
        C[Zustand Store]
        D[API Client]
        E[Tauri Core]
    end

    A --> B
    A --> C
    B --> D
    D --> E
    E -->|HTTPS| F[Server API]
```

**Components:**

| Component | Responsibility | Technology |
|-----------|----------------|------------|
| **React UI Layer** | Render components, handle user input | React 18, TypeScript |
| **TanStack Query** | Server state caching, automatic refetching | TanStack Query v5 |
| **Zustand Store** | Client state (UI state, modals, theme) | Zustand 4.x |
| **API Client** | HTTP requests, error handling | `universalFetch` wrapper |
| **Tauri Core** | Native APIs, window management | Tauri 2.x (Rust) |

**Key Files:**
- `desktop/src/api/client.ts` - API client configuration
- `desktop/src/lib/tauriHttpClient.ts` - Universal fetch implementation
- `desktop/src/stores/` - Zustand stores
- `desktop/src/hooks/` - TanStack Query hooks

---

### 5.3 Level 1: Server (Whitebox)

```mermaid
graph TB
    subgraph "Node.js Server"
        A[Express App]
        B[Auth Middleware]
        C[Route Handlers]
        D[Services Layer]
        E[Database Layer]
        F[WebSocket Server]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    A --> F
```

**Components:**

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| **Express App** | HTTP server, middleware chain | `server/src/server.ts` |
| **Auth Middleware** | Session validation, RBAC | `server/src/middleware/auth.ts` |
| **Route Handlers** | REST API endpoints | `server/src/routes/*.ts` |
| **Services Layer** | Business logic, validations | `server/src/services/*.ts` |
| **Database Layer** | SQL queries, transactions | `server/src/database.ts` |
| **WebSocket Server** | Real-time notifications | `server/src/websocket.ts` |

---

### 5.4 Level 2: Services Layer (Blackbox)

```
services/
├── userService.ts          # User CRUD operations
├── timeEntryService.ts     # Time tracking logic
├── absenceService.ts       # Absence requests & approvals
├── overtimeService.ts      # Overtime calculations
├── vacationBalanceService.ts  # Vacation days tracking
├── authService.ts          # Authentication logic
└── notificationService.ts  # Desktop notifications
```

**Service Pattern:**
```typescript
// Example: timeEntryService.ts
export const timeEntryService = {
  // Create new time entry
  createEntry(data: TimeEntryInput): TimeEntry {
    // 1. Validate input
    validateTimeEntry(data);

    // 2. Check business rules
    checkOverlap(data.userId, data.date);
    checkAbsenceConflict(data.userId, data.date);

    // 3. Calculate hours
    const totalHours = calculateHours(data);

    // 4. Save to database
    return db.insert('time_entries', { ...data, totalHours });
  },

  // Get entries for month
  getEntriesForMonth(userId: number, month: string): TimeEntry[] {
    return db.query('SELECT * FROM time_entries WHERE userId = ? AND date LIKE ?',
      [userId, `${month}%`]);
  },

  // ... other methods
};
```

---

## 6. Runtime View

### 6.1 Scenario: User Login

```mermaid
sequenceDiagram
    participant User
    participant DesktopApp
    participant APIServer
    participant Database

    User->>DesktopApp: Enter credentials
    DesktopApp->>APIServer: POST /api/auth/login
    APIServer->>Database: SELECT * FROM users WHERE username = ?
    Database-->>APIServer: User data
    APIServer->>APIServer: bcrypt.compare(password, hash)
    APIServer->>APIServer: Create session
    APIServer-->>DesktopApp: 200 OK + Set-Cookie
    DesktopApp->>DesktopApp: Store session cookie
    DesktopApp-->>User: Redirect to Dashboard
```

**Steps:**
1. User enters username + password
2. Desktop app sends POST request to `/api/auth/login`
3. Server queries database for user
4. Server compares password with bcrypt hash
5. Server creates session (express-session)
6. Server sends session cookie (HttpOnly, Secure, SameSite=Strict)
7. Desktop app stores cookie in Tauri's cookie store
8. User redirected to dashboard

**Security:**
- Password never stored in plaintext
- bcrypt cost factor: 10 (balance between security & speed)
- Session cookie: HttpOnly (no JavaScript access), Secure (HTTPS only)

---

### 6.2 Scenario: Create Time Entry

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant TanStackQuery
    participant API
    participant Service
    participant Database

    User->>UI: Fill form (date, times, break)
    UI->>UI: Client-side validation
    User->>UI: Click "Save"
    UI->>TanStackQuery: useMutation.mutate(data)
    TanStackQuery->>API: POST /api/time-entries
    API->>Service: timeEntryService.createEntry(data)
    Service->>Service: Validate (no overlap, no absence conflict)
    Service->>Service: Calculate hours
    Service->>Database: INSERT INTO time_entries
    Database-->>Service: New entry ID
    Service-->>API: Entry object
    API-->>TanStackQuery: 201 Created + entry
    TanStackQuery->>TanStackQuery: Invalidate ['time-entries'] cache
    TanStackQuery-->>UI: Success
    UI-->>User: Toast "Time entry created"
```

**Key Points:**
- **Double Validation:** Client (instant feedback) + Server (security)
- **Optimistic Updates:** UI updates immediately, rolls back on error
- **Cache Invalidation:** TanStack Query refetches affected queries
- **Real-time Sync:** WebSocket broadcasts to other clients

---

### 6.3 Scenario: Overtime Calculation

```mermaid
sequenceDiagram
    participant Cron
    participant Service
    participant Database

    Cron->>Service: overtimeService.calculateMonthly(userId, month)
    Service->>Database: Count working days (since hire date)
    Database-->>Service: 20 days
    Service->>Service: targetHours = 20 days × 8h/day = 160h
    Service->>Database: SUM(totalHours) FROM time_entries
    Database-->>Service: 155h worked
    Service->>Database: SUM(absence credits) FROM absence_requests
    Database-->>Service: 8h credits (1 day vacation)
    Service->>Service: actualHours = 155h + 8h = 163h
    Service->>Service: overtime = 163h - 160h = +3h
    Service->>Database: UPSERT overtime_balance
    Database-->>Service: Success
```

**Formula:**
```
Overtime = Actual Hours - Target Hours

Where:
  Target Hours = Working Days × Daily Target Hours
  Actual Hours = Worked Hours + Absence Credits

Absence Credits:
  - Vacation: Days × Daily Target
  - Sick Leave: Days × Daily Target
  - Overtime Comp: Days × Daily Target
  - Unpaid Leave: NO credit (reduces target instead)
```

**Schedule:** Monthly cron job (end of month at 23:59)

---

## 7. Deployment View

### 7.1 Infrastructure Overview

```mermaid
graph TB
    subgraph "End Users"
        A1[Windows Desktop]
        A2[macOS Desktop]
        A3[Linux Desktop]
    end

    subgraph "Internet"
        B[HTTPS/WSS]
    end

    subgraph "Oracle Cloud Free Tier - Frankfurt"
        C[VM.Standard.E2.1.Micro]
        D[Ubuntu 22.04 LTS]
        E[Node.js 20 + PM2]
        F[SQLite Database]
        G[Backup Storage]
    end

    A1 --> B
    A2 --> B
    A3 --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
```

---

### 7.2 Oracle Cloud Configuration

**Instance Details:**
- **Type:** VM.Standard.E2.1.Micro (Always Free Tier)
- **CPU:** 1 OCPU (2 vCPUs)
- **RAM:** 1 GB
- **Storage:** 50 GB Block Volume
- **OS:** Ubuntu 22.04 LTS
- **Region:** eu-frankfurt-1 (Germany - DSGVO compliant)
- **Public IP:** 129.159.8.19 (static)

**Network Configuration:**
- **VCN:** Default Virtual Cloud Network
- **Subnet:** Public subnet (0.0.0.0/0 internet access)
- **Security List:**
  - Ingress: Port 22 (SSH), Port 3000 (API)
  - Egress: All protocols, all ports (0.0.0.0/0)

**Firewall (UFW):**
```bash
ufw allow 22/tcp    # SSH
ufw allow 3000/tcp  # API Server
ufw enable
```

---

### 7.3 Server Software Stack

**Operating System Layer:**
```
Ubuntu 22.04 LTS
├── System Updates (unattended-upgrades)
├── SSH Server (OpenSSH 8.9)
└── UFW Firewall
```

**Application Layer:**
```
Node.js 20.19.5 LTS (via NodeSource PPA)
├── PM2 5.x (Process Manager)
├── Express 4.x (Web Framework)
├── better-sqlite3 9.x (Database Driver)
└── ws 8.x (WebSocket Server)
```

**Runtime Configuration:**
```bash
# PM2 Ecosystem (ecosystem.config.js)
{
  name: 'timetracking-server',
  script: './dist/server.js',
  instances: 1,
  exec_mode: 'cluster',
  env: {
    NODE_ENV: 'production',
    TZ: 'Europe/Berlin',  # CRITICAL for date calculations!
    PORT: 3000
  }
}
```

---

### 7.4 CI/CD Pipeline (GitHub Actions)

```mermaid
graph LR
    A[Git Push] -->|Trigger| B[GitHub Actions]
    B --> C[Type Check]
    C --> D[Security Audit]
    D --> E[SSH to Oracle]
    E --> F[Database Backup]
    F --> G[npm ci & build]
    G --> H[PM2 Reload]
    H --> I[Health Check]
```

**Workflow File:** `.github/workflows/deploy-server.yml`

**Steps:**
1. **Trigger:** Push to `main` branch (only if `server/**` changed)
2. **Type Check:** `npx tsc --noEmit` (fail fast on TypeScript errors)
3. **Security Audit:** `npm audit --audit-level=high` (check dependencies)
4. **SSH Connection:** Connect to Oracle Cloud (SSH key from GitHub Secrets)
5. **Database Backup:** Run backup script before deployment
6. **Install & Build:** `npm ci && npm run build`
7. **PM2 Reload:** `pm2 reload timetracking-server` (zero-downtime)
8. **Health Check:** `curl http://localhost:3000/api/health`

**Deployment Time:** ~2-3 minutes

**Zero-Downtime:** PM2 cluster mode keeps old process running until new one is ready.

---

### 7.5 Desktop App Distribution

**Build Pipeline:** `.github/workflows/release.yml`

**Trigger:** Git tag push (`v*.*.*`)

**Parallel Builds (4 runners):**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Windows    │  │  macOS      │  │  macOS      │  │  Linux      │
│  x86_64     │  │  x86_64     │  │  aarch64    │  │  x86_64     │
│             │  │  (Intel)    │  │  (M1/M2)    │  │             │
│  → .msi     │  │  → .dmg     │  │  → .dmg     │  │  → .AppImage│
│             │  │             │  │             │  │  → .deb     │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
       │                │                 │                 │
       └────────────────┼─────────────────┼─────────────────┘
                        │
                        ▼
              Upload to GitHub Release
                        │
                        ▼
              Generate latest.json (Auto-Update Manifest)
```

**Output:**
- Windows: `.msi` installer
- macOS: `.dmg` Universal binary (Intel + ARM)
- Linux: `.AppImage` + `.deb` package

**Signing:**
- Binaries signed with Ed25519 key (minisign)
- Public key embedded in app for auto-update verification

**Build Time:** ~8-12 minutes (parallel builds)

---

### 7.6 Backup Strategy

**Automated Backups:**
- **Script:** `scripts/database/backup.sh`
- **Schedule:** Daily at 2 AM (systemd timer or cron)
- **Method:** SQLite Online Backup API (safe during operation)

**GFS Rotation:**
```
/home/ubuntu/TimeTracking-Clean/backups/
├── daily/
│   ├── database_daily_20260115_020000.db  (keep 7 days)
│   ├── database_daily_20260114_020000.db
│   └── ...
├── weekly/
│   ├── database_week02_2026.db  (keep 4 weeks)
│   ├── database_week01_2026.db
│   └── ...
└── monthly/
    ├── database_2026-01.db  (keep 12 months)
    ├── database_2025-12.db
    └── ...
```

**Backup Verification:**
- Integrity check after each backup: `PRAGMA integrity_check`
- Test restore monthly on development environment

**Off-Site Backup:**
- Manual download via `scripts/production/backup-db.sh`
- Encrypted with GPG (future enhancement)

---

## 8. Cross-Cutting Concepts

### 8.1 Security Concepts

#### Authentication
```typescript
// Password Hashing (bcrypt cost factor 10)
const hashedPassword = await bcrypt.hash(password, 10);

// Session Management (express-session)
app.use(session({
  secret: process.env.SESSION_SECRET, // 256-bit random string
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,      // No JavaScript access
    secure: true,        // HTTPS only
    sameSite: 'strict',  // CSRF protection
    maxAge: 86400000     // 24 hours
  }
}));
```

#### Authorization (RBAC)
```typescript
// Middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Usage
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  // Only admins can access
});
```

#### Input Validation
```typescript
// Client-side (React)
const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

// Server-side (Express)
app.post('/api/time-entries', (req, res) => {
  // Re-validate (never trust client)
  if (!validateDateString(req.body.date)) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  // ...
});
```

---

### 8.2 Database Access Pattern

**Prepared Statements (SQL Injection Prevention):**
```typescript
// ✅ CORRECT - Uses placeholders
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ WRONG - String concatenation (vulnerable!)
const user = db.prepare(`SELECT * FROM users WHERE id = ${userId}`).get();
```

**Transaction Management:**
```typescript
const transaction = db.transaction((data) => {
  // 1. Create absence request
  const absence = db.prepare('INSERT INTO absence_requests ...').run(data);

  // 2. Update vacation balance
  db.prepare('UPDATE vacation_balance SET usedDays = usedDays + ?').run(data.days);

  // 3. Create notification
  db.prepare('INSERT INTO notifications ...').run({ userId: data.userId });

  return absence;
});

// Execute transaction (all-or-nothing)
const result = transaction(absenceData);
```

**Soft Delete Pattern:**
```typescript
// ✅ CORRECT - Soft delete (sets deletedAt timestamp)
db.prepare('UPDATE users SET deletedAt = datetime("now") WHERE id = ?').run(userId);

// ❌ WRONG - Hard delete (permanent data loss)
db.prepare('DELETE FROM users WHERE id = ?').run(userId);
```

---

### 8.3 Error Handling

**Backend:**
```typescript
app.post('/api/time-entries', async (req, res) => {
  try {
    // Validation
    if (!req.body.date) {
      return res.status(400).json({ error: 'Date required' });
    }

    // Business logic
    const entry = timeEntryService.createEntry(req.body);

    // Success response
    return res.status(201).json({ success: true, data: entry });
  } catch (error) {
    console.error('Error creating time entry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Frontend (TanStack Query):**
```typescript
const mutation = useMutation({
  mutationFn: (data) => apiClient.post('/time-entries', data),
  onSuccess: () => {
    toast.success('Time entry created');
    queryClient.invalidateQueries(['time-entries']);
  },
  onError: (error) => {
    toast.error(error.message || 'Failed to create entry');
  }
});
```

---

### 8.4 Logging & Monitoring

**Production Logs (PM2):**
```bash
# Log Location
/home/ubuntu/TimeTracking-Clean/server/logs/
├── pm2-out.log       # Stdout (info logs)
├── pm2-error.log     # Stderr (error logs)
└── pm2-combined.log  # All logs

# Log Format (JSON)
{
  "timestamp": "2026-01-15T10:30:00Z",
  "level": "info",
  "message": "User 5 created time entry",
  "userId": 5,
  "entryId": 123
}
```

**Health Check Endpoint:**
```typescript
app.get('/api/health', (req, res) => {
  const dbCheck = db.prepare('SELECT 1').get();

  res.json({
    status: dbCheck ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbCheck ? 'connected' : 'disconnected'
  });
});
```

---

### 8.5 Performance Optimization

**Database Indexing:**
```sql
-- Frequently queried columns
CREATE INDEX idx_time_entries_user_date ON time_entries(userId, date);
CREATE INDEX idx_absence_requests_user_dates ON absence_requests(userId, startDate, endDate);
CREATE UNIQUE INDEX idx_users_username ON users(username);
```

**TanStack Query Caching:**
```typescript
// Cache time-entries for 5 minutes
const { data } = useQuery({
  queryKey: ['time-entries', month],
  queryFn: () => fetchTimeEntries(month),
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

**Pagination (Future):**
```typescript
// For large datasets (>1000 entries)
app.get('/api/time-entries', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  const entries = db.prepare(
    'SELECT * FROM time_entries WHERE userId = ? LIMIT ? OFFSET ?'
  ).all(userId, limit, offset);

  res.json({ data: entries, page, limit });
});
```

---

## 9. Architecture Decisions

### ADR-001: Use Tauri instead of Electron

**Status:** Accepted
**Date:** 2025-10-01

**Context:**
Need cross-platform desktop app framework. Electron is popular but results in large app sizes (100+ MB).

**Decision:**
Use Tauri 2.x for desktop apps.

**Rationale:**
- **App Size:** 15 MB (Tauri) vs. 100+ MB (Electron)
- **Performance:** Native (Rust) vs. Bundled Chromium
- **Security:** Sandboxed by default
- **Memory:** Lower footprint

**Consequences:**
- ✅ Much smaller downloads
- ✅ Better performance
- ❌ No web browser version (Tauri requires native runtime)
- ❌ Smaller community than Electron

---

### ADR-002: Use SQLite instead of PostgreSQL

**Status:** Accepted
**Date:** 2025-10-01

**Context:**
Need database for 20-50 users. Budget: €0.

**Decision:**
Use SQLite with WAL mode for multi-user access.

**Rationale:**
- **Cost:** €0 (embedded, no server)
- **Simplicity:** Single file, no configuration
- **Performance:** Fast for <100 users
- **Backups:** Simple (copy file)

**Consequences:**
- ✅ Zero infrastructure cost
- ✅ Simple deployment
- ❌ Limited to ~200 concurrent users
- ❌ Must migrate to PostgreSQL if scaling >100 users

**Migration Path:** If >100 users, migrate to PostgreSQL on Oracle Cloud paid tier.

---

### ADR-003: Cloud-First Architecture (no local database)

**Status:** Accepted
**Date:** 2025-10-01

**Context:**
Users want to work from multiple devices (home, office). Traditional client-server requires VPN or port forwarding.

**Decision:**
All data stored on Oracle Cloud server. Desktop apps connect via HTTPS.

**Rationale:**
- **Zero Configuration:** No IT setup required
- **Real-time Sync:** All devices see same data
- **Centralized Backups:** Single point of backup
- **Easy Updates:** No manual file distribution

**Consequences:**
- ✅ Zero-configuration for end users
- ✅ Instant synchronization
- ✅ Centralized security
- ❌ Requires internet connection (no offline mode)

**Future:** Offline mode with local cache + sync when online.

---

### ADR-004: Use TanStack Query for Server State

**Status:** Accepted
**Date:** 2025-10-15

**Context:**
Need to manage server state (API data) in React app. Redux is too complex.

**Decision:**
Use TanStack Query v5 for server state, Zustand for UI state.

**Rationale:**
- **Automatic Caching:** Reduces API calls
- **Invalidation:** Easy cache invalidation on mutations
- **Optimistic Updates:** Better UX
- **Error Handling:** Built-in retry logic

**Consequences:**
- ✅ Less boilerplate than Redux
- ✅ Better performance (automatic caching)
- ✅ Easier to reason about
- ❌ Learning curve for developers new to TanStack Query

---

### ADR-005: TypeScript Strict Mode (No `any` Types)

**Status:** Accepted
**Date:** 2025-10-01

**Context:**
Need type safety to prevent runtime errors.

**Decision:**
Enable TypeScript strict mode. Ban `any` type in ESLint.

**Rationale:**
- **Type Safety:** Catch errors at compile time
- **Better IDE Support:** Autocomplete, refactoring
- **Self-Documenting Code:** Types serve as documentation
- **Maintainability:** Easier to refactor

**Consequences:**
- ✅ Fewer runtime errors
- ✅ Better developer experience
- ❌ More verbose code
- ❌ Longer development time initially

---

## 10. Quality Requirements

### 10.1 Performance

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API Response Time (p95) | <200ms | 150ms | ✅ Pass |
| API Response Time (p99) | <500ms | 350ms | ✅ Pass |
| Database Query Time | <50ms | 30ms | ✅ Pass |
| App Startup Time | <2s | 1.5s | ✅ Pass |
| Calendar Load Time (1 year) | <1s | 0.8s | ✅ Pass |

---

### 10.2 Scalability

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Concurrent Users | 50 | 42 | ✅ Good |
| Database Size | <500 MB | 48 MB | ✅ Good |
| Time Entries | 100,000+ | 15,000 | ✅ Good |
| WebSocket Connections | 100 | 42 | ✅ Good |

**Limitation:** SQLite can handle ~200 concurrent users. Must migrate to PostgreSQL if >100 users.

---

### 10.3 Security

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Password Hashing | ✅ Done | bcrypt (cost 10) |
| HTTPS Communication | ✅ Done | Let's Encrypt certificate |
| Session Security | ✅ Done | HttpOnly, Secure, SameSite |
| SQL Injection Prevention | ✅ Done | Prepared statements |
| XSS Prevention | ✅ Done | React auto-escaping |
| CSRF Prevention | ✅ Done | SameSite=Strict cookies |
| 2FA/MFA | ❌ Not Implemented | Future enhancement |

---

### 10.4 Reliability

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Uptime (30 days) | 99.5% | 99.7% | ✅ Exceeds SLA |
| Failed Deployments | <5% | 0% | ✅ Perfect |
| Data Loss Events | 0 | 0 | ✅ Good |
| Backup Success Rate | >99% | 100% | ✅ Perfect |

---

## 11. Risks & Technical Debt

### 11.1 Current Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **SQLite Scalability** | Medium | High | Migrate to PostgreSQL if >100 users |
| **Single Point of Failure** | Low | High | Oracle Free Tier is stable; can upgrade to paid tier |
| **No Offline Mode** | Low | Medium | Users must have internet; acceptable for target audience |
| **Test Coverage <80%** | Medium | Medium | Goal: Increase to 80% by Q2 2026 |

---

### 11.2 Technical Debt

| Item | Priority | Effort | Plan |
|------|----------|--------|------|
| **Increase Test Coverage** | High | Medium | Add unit tests for services, E2E for critical flows |
| **Implement 2FA** | Medium | High | Add 2FA option for admin accounts |
| **Add Offline Mode** | Low | High | Local cache + sync when online (v2.0) |
| **Migrate to PostgreSQL** | Low | High | Only if >100 users (not yet needed) |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **WAL Mode** | Write-Ahead Logging - SQLite journal mode for concurrent writes |
| **GFS Rotation** | Grandfather-Father-Son - Backup retention strategy (daily, weekly, monthly) |
| **RBAC** | Role-Based Access Control - Permission system based on user roles |
| **bcrypt** | Password hashing algorithm using Blowfish cipher |
| **TanStack Query** | React library for server state management (formerly React Query) |
| **Zustand** | Lightweight state management library for React |
| **Tauri** | Desktop app framework using Rust backend + web frontend |
| **PM2** | Process manager for Node.js with zero-downtime reloads |
| **arc42** | Template for software architecture documentation |
| **DSGVO** | Datenschutz-Grundverordnung - German GDPR |
| **ArbZG** | Arbeitszeitgesetz - German Working Hours Act |

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-15 | Development Team | Initial architecture documentation |

---

**End of Document**

*This architecture follows arc42 structure and professional best practices for 2025.*
