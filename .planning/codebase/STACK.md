# Technology Stack

## Languages & Runtime

- **TypeScript 5.7+** - Primary language for both frontend and backend
- **Rust (Edition 2021)** - Tauri native layer
- **Node.js 20+** - Backend runtime (minimum required version)
- **SQL (SQLite)** - Database queries and schema

## Backend Stack

### Core Framework
- **Express 4.18** - HTTP server framework
- **better-sqlite3 12.4** - Synchronous SQLite database driver with WAL mode
- **tsx 4.7** - TypeScript execution for development
- **pkg (yao-pkg 6.10)** - Binary packaging for Tauri bundled server

### Security & Authentication
- **bcrypt 6.0** - Password hashing
- **jsonwebtoken 9.0** - JWT token generation/validation
- **express-session 1.18** - Session management
- **helmet 8.1** - HTTP security headers (XSS, clickjacking protection)
- **cors 2.8** - Cross-origin resource sharing
- **express-rate-limit 8.2** - Rate limiting for API endpoints

### Data & Business Logic
- **date-fns 3.6** - Date manipulation
- **date-fns-tz 3.2** - Timezone handling (CRITICAL for overtime calculations)
- **node-cron 4.2** - Scheduled tasks (backups, year-end rollover)

### Real-time & Communication
- **ws 8.18** - WebSocket server for real-time updates
- **node-fetch 2.7** - HTTP client for external APIs

### Logging & Monitoring
- **pino 10.1** - Structured JSON logging
- **pino-pretty 13.1** - Development log formatting

### Testing
- **vitest 4.0** - Unit testing framework
- **@vitest/ui 4.0** - Test UI dashboard
- **@vitest/coverage-v8** - Code coverage

## Frontend Stack (Desktop App)

### Core Framework
- **React 19.1** - UI framework (latest stable)
- **React Router DOM 6.20** - Client-side routing
- **Vite 7.0** - Build tool and dev server
- **Tauri 2.10** - Desktop app framework (Rust-based)

### State Management
- **Zustand 4.5** - Lightweight state management (authStore, themeStore, uiStore)
- **TanStack Query 5.56** - Server state management, caching, invalidation

### UI & Styling
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **Heroicons 2.2** - Icon library (React components)
- **Lucide React 0.294** - Additional icon library
- **Recharts 3.7** - Chart/graph library for reports
- **Sonner 1.2** - Toast notifications

### Utilities
- **date-fns 3.0** - Date formatting and manipulation
- **react-infinite-scroll-component 6.1** - Infinite scrolling lists
- **jsonwebtoken 9.0** - JWT token handling (client-side)

### Tauri Plugins
- **@tauri-apps/plugin-http 2.5** - HTTP client (CRITICAL: fixes cookie issues with cross-origin)
- **@tauri-apps/plugin-updater 2.9** - Auto-update system
- **@tauri-apps/plugin-notification 2.3** - Native notifications
- **@tauri-apps/plugin-dialog 2.4** - Native dialogs (file pickers, alerts)
- **@tauri-apps/plugin-fs 2.4** - File system access
- **@tauri-apps/plugin-opener 2** - Open URLs/files with system defaults
- **@tauri-apps/plugin-process 2.3** - Process management

### Testing
- **vitest 4.0** - Unit testing
- **@testing-library/react 16.3** - React component testing
- **@testing-library/jest-dom 6.9** - DOM matchers
- **@testing-library/user-event 14.6** - User interaction simulation
- **Playwright 1.57** - End-to-end testing
- **happy-dom 20.0 / jsdom 27.2** - DOM implementation for testing

## Build Tools & Development

### Package Management
- **npm 10+** - Package manager (workspaces enabled)
- **Workspace Structure**: Monorepo with `desktop/` and `server/` workspaces

### Code Quality
- **ESLint 8.56** - Linting (TypeScript, React rules)
- **Prettier 3.1** - Code formatting
- **TypeScript ESLint 6.21** - TypeScript-specific linting

### Build Pipeline
- **tsc (TypeScript Compiler)** - Type checking and compilation
- **Vite** - Frontend bundling and dev server
- **Tauri CLI 2.10** - Desktop app bundling (DMG, EXE, MSI, AppImage, DEB)
- **vite-plugin-remove-console 2.2** - Remove console logs in production builds

## Database

### Core
- **SQLite 3** - Embedded relational database
- **WAL Mode** - Write-Ahead Logging for multi-user support
- **Foreign Key Constraints** - Enforced at runtime

### Schema Management
- **Custom Migration System** - SQL migration files in `server/src/database/migrations/`
- **14 Tables**: users, time_entries, absence_requests, vacation_balance, overtime_balance, overtime_transactions, departments, projects, activities, holidays, notifications, audit_log, work_time_accounts, settings

### Database Location
- **Development**: `server/database.db`
- **Production**: Configurable via `DATABASE_PATH` environment variable
- **Staging (Green)**: Separate database (`database.green.db`)

## Infrastructure & Deployment

### Hosting
- **Oracle Cloud (Free Tier)** - Production server
- **Frankfurt, Germany** - Data center location
- **Blue/Green Deployment** - Blue (port 3000 production), Green (port 3001 staging)

### CI/CD
- **GitHub Actions** - Automated workflows
- **Workflows**:
  - `deploy-server.yml` - Auto-deploy server on push to `main`
  - `deploy-staging.yml` - Auto-deploy staging on push to `staging`
  - `release.yml` - Build desktop app binaries for all platforms
  - `test.yml` - Run tests on PR
  - `manual-migration.yml` - Manual database migrations
  - `complete-migration.yml` - Complete migration workflow
  - `migrate-blue-to-green.yml` - Sync databases

### Process Management
- **PM2** - Production process manager (auto-restart, monitoring, logs)
- **Environments**: `timetracking-server` (blue), `timetracking-staging` (green)

### Desktop App Distribution
- **GitHub Releases** - Binary distribution
- **Auto-Update System** - Tauri updater plugin with signature verification
- **Platforms**: macOS (DMG, Intel + ARM), Windows (EXE, MSI), Linux (AppImage, DEB)

## Configuration Files

### Root
- `package.json` - Workspace root configuration
- `.github/workflows/` - CI/CD pipelines

### Server
- `server/package.json` - Backend dependencies and scripts
- `server/tsconfig.json` - TypeScript configuration (type: module)
- `server/.env` - Environment variables (gitignored)

### Desktop
- `desktop/package.json` - Frontend dependencies and scripts
- `desktop/tsconfig.json` - React + Vite TypeScript config
- `desktop/vite.config.ts` - Vite build configuration
- `desktop/tailwind.config.js` - Tailwind CSS customization
- `desktop/src-tauri/Cargo.toml` - Rust dependencies
- `desktop/src-tauri/tauri.conf.json` - Tauri app configuration

## Environment Variables

### Required (Production)
- `NODE_ENV=production` - Enable production mode
- `SESSION_SECRET` - Cookie encryption secret
- `TZ=Europe/Berlin` - Timezone (CRITICAL for overtime calculations)

### Optional
- `PORT` - Server port (default: 3000)
- `DATABASE_PATH` - SQLite database file path
- `ALLOWED_ORIGINS` - Additional CORS origins (comma-separated)

### Desktop App (.env files)
- `.env.development` - `VITE_API_URL=http://localhost:3000`
- `.env.staging` - `VITE_API_URL=http://129.159.8.19:3001`
- `.env.production` - `VITE_API_URL=http://129.159.8.19:3000`

## Version Requirements

- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **TypeScript**: ~5.7-5.8
- **Tauri**: 2.x
- **React**: 19.x

## Key Scripts

### Development
```bash
npm run dev:server           # Start backend dev server
npm run dev:desktop          # Start Tauri desktop app
npm run test                 # Run all tests
npm run lint                 # Lint all workspaces
npm run format               # Format code with Prettier
```

### Production
```bash
npm run build                # Build server + desktop
npm run build:server         # Build server only
npm run build:desktop        # Build desktop app binaries
```

### Database
```bash
npm run migrate --workspace=server              # Run migrations
npm run seed --workspace=server                 # Seed database
npm run validate:overtime --workspace=server    # Validate overtime calculations
```

### Testing
```bash
npm run test:run             # Run tests once (CI mode)
npm run test:coverage        # Run tests with coverage
npm run test:ui              # Open Vitest UI
npm run test:e2e             # Run Playwright E2E tests
```
