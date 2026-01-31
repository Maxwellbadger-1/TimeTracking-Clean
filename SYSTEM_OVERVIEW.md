# TimeTracking System - Visual Overview

**Document Version:** 1.0.0
**Last Updated:** 2026-01-24
**Purpose:** Professional system visualization using C4 Model and Mermaid diagrams
**Audience:** Developers, Architects, Stakeholders

---

## Table of Contents

1. [System Context (C4 Level 1)](#1-system-context-c4-level-1)
2. [Feature Mind Map](#2-feature-mind-map)
3. [Technology Stack](#3-technology-stack)
4. [Data Model](#4-data-model)
5. [API Architecture](#5-api-architecture)
6. [User Journeys](#6-user-journeys)
7. [Deployment Pipeline](#7-deployment-pipeline)
8. [Quick Stats](#8-quick-stats)

---

## 1. System Context (C4 Level 1)

**Purpose:** Show the system boundary and external actors/systems.

```mermaid
graph TB
    subgraph External Actors
        A1[HR Manager]
        A2[Employees]
        A3[System Admin]
    end

    subgraph TimeTracking System
        B[Desktop App<br/>Windows/macOS/Linux]
        C[API Server<br/>Node.js + Express]
        D[Database<br/>SQLite]
    end

    subgraph External Systems
        E[Payroll System<br/>DATEV/SAP]
        F[Email Service<br/>Future]
    end

    A1 -->|Manage Users<br/>Approve Absences| B
    A2 -->|Track Time<br/>Request Vacation| B
    A3 -->|Configure System<br/>Monitor Health| B

    B <-->|REST API + WebSocket<br/>HTTPS| C
    C <-->|SQL Queries| D
    C -->|CSV Export| E
    C -.->|Email Notifications<br/>Future| F

    style B fill:#90EE90
    style C fill:#87CEEB
    style D fill:#FFD700
```

**Key Interfaces:**
- **Desktop App ↔ API Server**: HTTPS REST API (port 3000) + WebSocket
- **API Server ↔ Database**: SQLite embedded (local file I/O)
- **API Server → Payroll**: CSV export (manual import)

---

## 2. Feature Mind Map

**Purpose:** Hierarchical overview of all system features.

```mermaid
mindmap
  root((TimeTracking<br/>System))
    🔐 Authentication
      Login/Logout
      Session Management
      Password Security bcrypt
      HttpOnly Cookies
      Role-Based Access
    ⏱️ Time Tracking
      Manual Time Entry
        Start/End Time
        Break Duration
        Work Location
        Project/Activity
      Validation
        Overlap Detection
        Future Date Prevention
        Absence Conflict Check
      Bulk Operations
        Copy Previous Week
        Template Entry
      Export
        CSV Export
        DATEV Format
    🏖️ Absence Management
      Request Types
        Vacation
        Sick Leave
        Overtime Compensation
        Special Leave
        Unpaid Leave
      Approval Workflow
        Manager Approval
        Auto-Approve Rules
        Email Notifications
      Balance Tracking
        Vacation Days
        Sick Days
        Carryover Logic
      Validation
        No Overlap
        Sufficient Balance
        Blackout Dates
    📊 Overtime
      Calculation Engine
        Target Hours
        Worked Hours
        Absence Credits
        Unpaid Leave Reduction
      Corrections
        Manual Adjustments
        Admin Override
        Audit Trail
      Year-End Processing
        Carryover
        Payout Option
        Balance Reset
      Reports
        Monthly Balance
        Daily Breakdown
        Transaction History
    👥 Administration
      User Management
        Create/Edit Users
        Deactivate Users
        Role Assignment
        Weekly Hours Config
      Department Setup
        Create Departments
        Assign Users
        Department Hierarchy
      Holiday Configuration
        Federal Holidays
        State-Specific
        Custom Holidays
      Projects & Activities
        Project Management
        Activity Types
        Categorization
      Audit Logs
        Change Tracking
        User Actions
        Data Integrity
    📈 Reporting
      Individual Reports
        Overtime Summary
        Time Entry History
        Absence Calendar
      Team Reports
        Team Overtime
        Department Stats
        Absence Overview
      Calendar Views
        Month View
        Week View
        Year View
        Team Calendar
      Export Options
        CSV Export
        PDF Reports Future
        Excel Format Future
    🔔 Notifications
      Real-Time Sync
        WebSocket Updates
        Instant Refresh
        Multi-Device Sync
      Desktop Notifications
        Absence Approval
        Overtime Alerts
        System Messages
```

---

## 3. Technology Stack

**Purpose:** Visualize the complete technology stack in layers.

```mermaid
graph TB
    subgraph Client Layer
        A1[Windows App<br/>Tauri 2.x]
        A2[macOS App<br/>Intel + M1/M2]
        A3[Linux App<br/>AppImage + deb]
    end

    subgraph Frontend Framework
        B1[React 18]
        B2[TypeScript 5.3]
        B3[Vite 5.x]
    end

    subgraph State Management
        C1[TanStack Query 5<br/>Server State]
        C2[Zustand 4<br/>UI State]
    end

    subgraph UI Layer
        D1[Tailwind CSS 3.4]
        D2[Headless UI]
        D3[Lucide Icons]
        D4[Recharts Charts]
    end

    subgraph API Layer
        E1[Express 4.x]
        E2[REST Endpoints 24+]
        E3[WebSocket Server]
        E4[Session Middleware]
    end

    subgraph Business Logic
        F1[Services Layer]
        F2[timeEntryService]
        F3[overtimeService]
        F4[absenceService]
        F5[userService]
    end

    subgraph Data Layer
        G1[better-sqlite3 9.x]
        G2[SQLite WAL Mode]
        G3[Prepared Statements]
        G4[Transactions]
    end

    subgraph Infrastructure
        H1[Oracle Cloud Free Tier]
        H2[Ubuntu 22.04 LTS]
        H3[Node.js 20 LTS]
        H4[PM2 Process Manager]
    end

    subgraph CI/CD
        I1[GitHub Actions]
        I2[TypeScript Check]
        I3[Security Audit]
        I4[Auto-Deploy]
        I5[Release Builder]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    B1 --> B2
    B2 --> B3
    B1 --> C1
    B1 --> C2
    B1 --> D1
    D1 --> D2
    C1 --> E1
    E1 --> E2
    E1 --> E3
    E2 --> F1
    F1 --> F2
    F1 --> F3
    F1 --> F4
    F1 --> F5
    F2 --> G1
    G1 --> G2
    E1 --> H1
    H1 --> H2
    H2 --> H3
    H3 --> H4
    I1 --> I4
    I1 --> I5

    style A1 fill:#90EE90
    style A2 fill:#90EE90
    style A3 fill:#90EE90
    style E1 fill:#87CEEB
    style G2 fill:#FFD700
    style H1 fill:#FFA07A
```

**Technology Highlights:**
- **App Size**: 15 MB (Tauri) vs. 100+ MB (Electron)
- **Database**: SQLite with WAL mode (concurrent writes)
- **Deployment**: Zero-downtime with PM2 cluster mode
- **Build Time**: 8-12 minutes (parallel builds for 4 platforms)

---

## 4. Data Model

**Purpose:** Entity-Relationship diagram of all database tables.

```mermaid
erDiagram
    users ||--o{ time_entries : creates
    users ||--o{ absence_requests : submits
    users ||--o{ vacation_balance : has
    users ||--o{ overtime_balance : has
    users ||--o{ overtime_transactions : has
    users ||--o{ notifications : receives
    users }o--|| departments : belongs_to

    time_entries }o--o| projects : assigned_to
    time_entries }o--o| activities : categorized_as

    absence_requests }o--|| users : approved_by

    users {
        int id PK
        string username UK
        string password_hash
        string email
        string firstName
        string lastName
        string role
        int weeklyHours
        json workSchedule
        date hireDate
        date endDate
        int departmentId FK
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    time_entries {
        int id PK
        int userId FK
        date date
        time startTime
        time endTime
        int breakMinutes
        decimal hours
        string workLocation
        int projectId FK
        int activityId FK
        text notes
        datetime createdAt
        datetime updatedAt
    }

    absence_requests {
        int id PK
        int userId FK
        string type
        date startDate
        date endDate
        decimal days
        string status
        text reason
        int approvedBy FK
        datetime approvedAt
        datetime createdAt
        datetime updatedAt
    }

    overtime_balance {
        int id PK
        int userId FK
        string month
        decimal targetHours
        decimal actualHours
        decimal overtime
        datetime lastUpdated
    }

    overtime_transactions {
        int id PK
        int userId FK
        date date
        string type
        decimal hours
        text description
        int relatedId
        datetime createdAt
    }

    vacation_balance {
        int id PK
        int userId FK
        int year
        decimal totalDays
        decimal usedDays
        decimal carryoverDays
        datetime lastUpdated
    }

    departments {
        int id PK
        string name
        string code
        int managerId FK
        datetime createdAt
    }

    projects {
        int id PK
        string name
        string code
        string status
        datetime createdAt
    }

    activities {
        int id PK
        string name
        string code
        datetime createdAt
    }

    holidays {
        int id PK
        date date
        string name
        int federal
        string state
    }

    notifications {
        int id PK
        int userId FK
        string type
        string title
        text message
        int isRead
        datetime createdAt
    }
```

**Database Stats:**
- **Tables**: 11
- **Size**: 48 MB (production)
- **Entries**: 23,450 time entries (42 active users)
- **Backup**: GFS rotation (daily, weekly, monthly)

---

## 5. API Architecture

**Purpose:** Overview of all REST API endpoints grouped by module.

```mermaid
graph LR
    subgraph Authentication
        A1[POST /api/auth/login]
        A2[POST /api/auth/logout]
        A3[GET /api/auth/me]
    end

    subgraph Users
        B1[GET /api/users]
        B2[GET /api/users/:id]
        B3[POST /api/users]
        B4[PUT /api/users/:id]
        B5[DELETE /api/users/:id]
    end

    subgraph Time Entries
        C1[GET /api/time-entries]
        C2[GET /api/time-entries/:id]
        C3[POST /api/time-entries]
        C4[PUT /api/time-entries/:id]
        C5[DELETE /api/time-entries/:id]
        C6[GET /api/time-entries/month/:month]
    end

    subgraph Absences
        D1[GET /api/absence-requests]
        D2[POST /api/absence-requests]
        D3[PUT /api/absence-requests/:id]
        D4[POST /api/absence-requests/:id/approve]
        D5[POST /api/absence-requests/:id/reject]
    end

    subgraph Overtime
        E1[GET /api/overtime/balance]
        E2[GET /api/overtime/month/:userId/:month]
        E3[POST /api/overtime/corrections]
        E4[GET /api/overtime/transactions/:userId]
        E5[GET /api/reports/overtime/user/:userId]
    end

    subgraph Reports
        F1[GET /api/reports/overtime/history/:userId]
        F2[GET /api/reports/overtime/year-breakdown/:userId]
        F3[GET /api/reports/team-overtime]
        F4[GET /api/reports/time-entries/export]
    end

    subgraph Holidays
        G1[GET /api/holidays]
        G2[GET /api/holidays/year/:year]
        G3[POST /api/holidays]
    end

    subgraph System
        H1[GET /api/health]
        H2[WebSocket /ws]
    end

    style A1 fill:#FFB6C1
    style C3 fill:#90EE90
    style D4 fill:#FFD700
    style E5 fill:#87CEEB
```

**API Statistics:**
- **Total Endpoints**: 24+ REST endpoints
- **WebSocket**: Real-time sync channel
- **Average Response Time**: 187ms
- **Rate Limiting**: 100 req/min per user

---

## 6. User Journeys

**Purpose:** Key user workflows through the system.

### 6.1 Journey: Employee Creates Time Entry

```mermaid
sequenceDiagram
    actor Employee
    participant App as Desktop App
    participant API as API Server
    participant DB as Database

    Employee->>App: Click "Add Time Entry"
    App->>App: Show form (date, start, end, break)
    Employee->>App: Fill form & click "Save"
    App->>App: Client-side validation
    App->>API: POST /api/time-entries
    API->>API: Validate (no overlap, no absence conflict)
    API->>API: Calculate hours
    API->>DB: INSERT INTO time_entries
    DB-->>API: Entry created (ID: 123)
    API->>API: Update overtime_balance
    API-->>App: 201 Created + entry data
    App->>App: TanStack Query: Invalidate cache
    App->>App: Refetch time-entries
    App-->>Employee: Toast "Time entry created"
    App->>App: Update calendar view
```

### 6.2 Journey: Manager Approves Vacation Request

```mermaid
sequenceDiagram
    actor Manager
    participant App as Desktop App
    participant API as API Server
    participant WS as WebSocket
    participant DB as Database
    actor Employee

    Manager->>App: Navigate to Absence Requests
    App->>API: GET /api/absence-requests
    API->>DB: SELECT * WHERE status='pending'
    DB-->>API: Pending requests
    API-->>App: List of requests
    App-->>Manager: Show table with pending requests
    Manager->>App: Click "Approve" on request
    App->>API: POST /api/absence-requests/:id/approve
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE absence_requests SET status='approved'
    API->>DB: UPDATE vacation_balance SET usedDays++
    API->>DB: INSERT INTO notifications
    API->>DB: COMMIT TRANSACTION
    API-->>App: 200 OK
    API->>WS: Broadcast notification
    WS-->>Employee: Desktop notification: "Vacation approved"
    App-->>Manager: Toast "Request approved"
```

### 6.3 Journey: Overtime Calculation (Monthly)

```mermaid
flowchart TD
    A[User creates/updates time_entry] --> B{timeEntryService}
    B --> C[updateAllOvertimeLevels]
    C --> D[updateOvertimeTransactions]
    C --> E[updateMonthlyOvertime]

    E --> F[Get user data<br/>weeklyHours, workSchedule]
    F --> G[calculateTargetHoursForPeriod<br/>Start: hireDate, End: today]

    G --> H{For each day}
    H --> I{Is weekend?}
    I -->|Yes| J[Target = 0h]
    I -->|No| K{Is holiday?}
    K -->|Yes| J
    K -->|No| L{Has workSchedule?}
    L -->|Yes| M[Target = workSchedule.dayName]
    L -->|No| N[Target = weeklyHours / 5]

    H --> O[Sum all daily targets<br/>= totalTargetHours]

    O --> P[Get time_entries<br/>SUM hours = workedHours]
    P --> Q[Get absence credits<br/>vacation + sick + overtime_comp]
    Q --> R[Get overtime corrections<br/>manual adjustments]
    R --> S[Get unpaid leave<br/>reduces target]

    S --> T[actualHours = workedHours<br/>+ absenceCredits<br/>+ corrections]
    T --> U[adjustedTarget = targetHours<br/>- unpaidLeaveReduction]
    U --> V[overtime = actualHours<br/>- adjustedTarget]

    V --> W[UPSERT overtime_balance]
    W --> X[Broadcast WebSocket update]

    style A fill:#90EE90
    style V fill:#FFD700
    style W fill:#87CEEB
```

---

## 7. Deployment Pipeline

**Purpose:** CI/CD workflow for automated deployments.

```mermaid
graph TB
    subgraph Development
        A1[Developer]
        A2[Local Testing]
        A3[Git Commit]
    end

    subgraph GitHub
        B1[GitHub Repository]
        B2[GitHub Actions]
        B3[Release Tag]
    end

    subgraph CI/CD Checks
        C1[TypeScript Check<br/>npx tsc --noEmit]
        C2[Security Audit<br/>npm audit]
        C3[Unit Tests<br/>npm test]
    end

    subgraph Server Deployment
        D1[SSH to Oracle Cloud]
        D2[Database Backup]
        D3[npm ci & build]
        D4[PM2 Reload<br/>Zero-downtime]
        D5[Health Check]
    end

    subgraph Desktop Release
        E1[Build Windows<br/>.msi]
        E2[Build macOS<br/>.dmg Intel + ARM]
        E3[Build Linux<br/>.AppImage + .deb]
        E4[Sign Binaries<br/>Ed25519]
        E5[Upload to GitHub Release]
        E6[Generate latest.json<br/>Auto-Update Manifest]
    end

    subgraph Production
        F1[Oracle Cloud Server<br/>129.159.8.19]
        F2[GitHub Releases<br/>Desktop Downloads]
    end

    A1 --> A2
    A2 --> A3
    A3 --> B1
    B1 -->|Push to main| B2
    B1 -->|Tag v*.*.* | B3

    B2 --> C1
    C1 --> C2
    C2 --> C3

    C3 -->|server/**| D1
    D1 --> D2
    D2 --> D3
    D3 --> D4
    D4 --> D5
    D5 --> F1

    B3 --> E1
    B3 --> E2
    B3 --> E3
    E1 --> E4
    E2 --> E4
    E3 --> E4
    E4 --> E5
    E5 --> E6
    E6 --> F2

    style C1 fill:#87CEEB
    style C2 fill:#87CEEB
    style C3 fill:#87CEEB
    style D4 fill:#90EE90
    style E6 fill:#FFD700
    style F1 fill:#FFA07A
    style F2 fill:#FFA07A
```

**Deployment Statistics:**
- **Server Deploy Time**: 2-3 minutes
- **Desktop Build Time**: 8-12 minutes (parallel)
- **Deployment Success Rate**: 100% (12/12 last 30 days)
- **Zero-Downtime**: PM2 cluster mode reload

---

## 8. Quick Stats

**Purpose:** Key metrics at a glance.

```mermaid
graph LR
    subgraph Production Metrics
        A[42 Active Users]
        B[23,450 Time Entries]
        C[48 MB Database]
        D[99.7% Uptime]
    end

    subgraph Performance
        E[187ms Avg Response]
        F[1.2s App Startup]
        G[34ms WebSocket Latency]
    end

    subgraph Codebase
        H[73% Test Coverage]
        I[0 Security Issues]
        J[15 MB App Size]
    end

    subgraph Infrastructure
        K[Oracle Cloud Frankfurt]
        L[Node.js 20 LTS]
        M[SQLite WAL Mode]
    end

    style A fill:#90EE90
    style D fill:#90EE90
    style E fill:#90EE90
    style I fill:#90EE90
```

**Key Highlights:**
- **Cost**: €0 infrastructure (Oracle Free Tier)
- **Security**: DSGVO compliant (data in Frankfurt)
- **Compliance**: German labor law (ArbZG, BUrlG)
- **Platforms**: Windows, macOS (Intel + M1/M2), Linux

---

## Document References

**Core Documentation:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed architecture (arc42, 850 lines)
- [PROJECT_SPEC.md](PROJECT_SPEC.md) - Requirements & API spec (1500 lines)
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Current status & metrics (400 lines)
- [CHANGELOG.md](CHANGELOG.md) - Version history (300 lines)
- [CLAUDE.md](.claude/CLAUDE.md) - AI development guidelines (840 lines)

**This Document:**
- **Type**: Visual Overview (Companion to ARCHITECTURE.md)
- **Format**: Mermaid Diagrams (GitHub-compatible)
- **Version Control**: ✅ Yes (Markdown, not PNG/PDF)
- **Maintenance**: Update when architecture changes

---

**Last Updated:** 2026-01-24
**Maintained by:** Development Team
**Review Frequency:** Quarterly or on major architecture changes

---

**End of Visual Overview**

*Professional diagrams using C4 Model, Mermaid, and Industry Best Practices (2026)*
