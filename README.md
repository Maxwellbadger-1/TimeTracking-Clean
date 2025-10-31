# TimeTracking System

Modern, intuitive Multi-User Time Tracking System for Windows Desktop.

## Architecture

- **Desktop Client:** Tauri v2 + React 18 + TypeScript + Vite + Tailwind CSS
- **Backend Server:** Node.js 20 + Express + TypeScript + SQLite
- **Real-time:** WebSocket for live updates
- **Database:** SQLite with WAL Mode

## Requirements

- Node.js v20.19.5 (LTS)
- npm 10.8.2+
- Rust 1.90+ (for Tauri)

## Setup

### Install Dependencies

```bash
npm install
```

### Development

Terminal 1 - Backend Server:
```bash
npm run dev:server
```

Terminal 2 - Desktop App:
```bash
npm run dev:desktop
```

### Build

```bash
npm run build
```

This creates:
- Windows: `desktop/src-tauri/target/release/TimeTracking.exe`
- Installer: `desktop/src-tauri/target/release/bundle/msi/TimeTracking_0.1.0_x64_en-US.msi`

## Project Status

- ✅ Phase 0: Setup (In Progress)
- 🔴 Phase 1: Backend Foundation (Not Started)
- 🔴 Phase 2: User Management (Not Started)
- 🔴 Phase 3: Time Tracking (Not Started)
- 🔴 Phase 4: Absence Management (Not Started)
- 🔴 Phase 5: Calendar Views (Not Started)
- 🔴 Phase 6: Dashboard (Not Started)
- 🔴 Phase 7: Reports & Export (Not Started)
- 🔴 Phase 8: UI/UX Polish (Not Started)
- 🔴 Phase 9: Testing (Not Started)
- 🔴 Phase 10: Deployment (Not Started)
- 🔴 Phase 11: Auto-Update (Not Started)

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [Claude AI Guidelines](./.claude/CLAUDE.md)
- [Context for New Chat](./CONTEXT_FOR_NEW_CHAT.md)

## Tech Stack

### Desktop Client
- Tauri 2.2
- React 18.3
- TypeScript 5.7
- Vite 6.0
- TanStack Query v5
- Zustand
- Tailwind CSS 3.4
- Lucide React
- Sonner

### Backend Server
- Node.js 20
- Express 4.18
- TypeScript 5.7
- better-sqlite3
- bcrypt
- express-session
- ws (WebSocket)
- cors

## License

Private Project
