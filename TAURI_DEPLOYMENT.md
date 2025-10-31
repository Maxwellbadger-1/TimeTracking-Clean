# 🚀 Tauri Deployment Guide - Stiftung der DPolG TimeTracker

**Version:** 1.0.0
**Last Updated:** 2025-10-31
**Tauri Version:** 2.x

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Development Setup](#development-setup)
4. [Building for Production](#building-for-production)
5. [Tauri-Specific Configurations](#tauri-specific-configurations)
6. [Known Issues & Solutions](#known-issues--solutions)
7. [Distribution](#distribution)
8. [Auto-Update Setup](#auto-update-setup)

---

## 🎯 Overview

This project is a **Tauri 2.x desktop application** with a separate Node.js backend server.

### Architecture

```
┌──────────────────────────────────────────┐
│  Desktop App (Tauri + React)             │
│  - Windows (.exe + .msi)                 │
│  - macOS (.app + .dmg)                   │
│  - Linux (.AppImage + .deb)              │
└──────────────────────────────────────────┘
                    ↓ HTTP + WebSocket
┌──────────────────────────────────────────┐
│  Backend Server (Node.js + Express)      │
│  - REST API (Port 3000)                  │
│  - SQLite Database (WAL mode)            │
│  - WebSocket (Real-time)                 │
└──────────────────────────────────────────┘
```

### Key Differences from Web Apps

❌ **Don't use:**
- Browser `fetch()` for HTTP requests → Use Tauri HTTP Plugin
- Browser notifications → Use Tauri Notification Plugin
- `localStorage` for sensitive data → Use Tauri Store Plugin (future)
- `window.location` → Use Tauri Router

✅ **Do use:**
- `@tauri-apps/plugin-http` for all API calls
- `@tauri-apps/plugin-notification` for native notifications
- System Tray integration
- Native file dialogs
- Keyboard shortcuts

---

## 🔧 Prerequisites

### Development Machine

**Required:**
- **Node.js:** v20.x (LTS) - [Download](https://nodejs.org/)
- **Rust:** 1.75+ - Install via [rustup](https://rustup.rs/)
- **npm:** v11.x (comes with Node.js)

**Platform-Specific:**

**macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
rustc --version
node --version
npm --version
```

**Windows:**
```powershell
# Install Visual Studio Build Tools 2019/2022
# Download from: https://visualstudio.microsoft.com/downloads/

# Install Rust
# Download from: https://rustup.rs/

# Verify installation
rustc --version
node --version
npm --version
```

**Linux (Ubuntu/Debian):**
```bash
# Install dependencies
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verify installation
rustc --version
node --version
npm --version
```

---

## 🏗️ Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd TimeTracking-Clean
```

### 2. Install Dependencies

```bash
# Root dependencies
npm install --legacy-peer-deps

# Desktop dependencies
cd desktop
npm install --legacy-peer-deps

# Go back to root
cd ..
```

**Why `--legacy-peer-deps`?**
React 19 has peer dependency conflicts with some libraries (lucide-react). This flag resolves them.

### 3. Start Backend Server

```bash
# Terminal 1
npm run dev:server
```

**Output:**
```
✅ TimeTracking Server started
📡 Listening on http://localhost:3000
🏥 Health check: http://localhost:3000/api/health
🔐 Auth endpoints: http://localhost:3000/api/auth
```

### 4. Start Desktop App

```bash
# Terminal 2
cd desktop
npm run tauri dev
```

**First Run:**
Rust will compile ~450 packages (takes 3-5 minutes). Subsequent runs are fast (~5 seconds).

**Output:**
```
VITE v7.1.12  ready in 384 ms
➜  Local:   http://localhost:1420/

Compiling desktop v0.1.0
   Finished `dev` profile in 25.70s
    Running `target/debug/desktop`
```

### 5. Login

Open the app and login with:
- **Username:** `admin`
- **Password:** `admin123`

---

## 🏭 Building for Production

### Build Desktop App

```bash
cd desktop
npm run tauri build
```

**Build Artifacts Location:**

**macOS:**
```
desktop/src-tauri/target/release/bundle/
├── dmg/                    # .dmg installer
├── macos/                  # .app bundle
└── updater/               # Update files
```

**Windows:**
```
desktop\src-tauri\target\release\bundle\
├── msi\                   # .msi installer
├── nsis\                  # .exe installer
└── updater\              # Update files
```

**Linux:**
```
desktop/src-tauri/target/release/bundle/
├── appimage/              # .AppImage
├── deb/                   # .deb package
└── updater/              # Update files
```

### Build Times

- **First Build:** 5-10 minutes (Rust compilation)
- **Incremental Build:** 1-2 minutes

### Build Size

- **macOS (.app):** ~10-15 MB
- **Windows (.msi):** ~8-12 MB
- **Linux (.AppImage):** ~15-20 MB

Compare to Electron: ~100-200 MB!

---

## ⚙️ Tauri-Specific Configurations

### 1. HTTP Plugin Configuration

**File:** `desktop/src-tauri/capabilities/default.json`

```json
{
  "permissions": [
    "http:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "http://localhost:3000/*" },
        { "url": "http://127.0.0.1:3000/*" }
      ]
    }
  ]
}
```

**Why?**
Tauri requires explicit permission for HTTP requests. Without this, all API calls will fail with "Network Error".

### 2. Notification Permission

```json
{
  "permissions": [
    "notification:default"
  ]
}
```

### 3. System Tray

**Rust Code:** `desktop/src-tauri/src/lib.rs`

```rust
use tauri::{Manager, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent}};

.setup(|app| {
    let show = MenuItem::with_id(app, "show", "Anzeigen", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => { /* Show window */ },
                "quit" => { app.exit(0); },
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
})
```

### 4. Production Configuration

**File:** `desktop/src-tauri/tauri.conf.json`

```json
{
  "productName": "Stiftung der DPolG TimeTracker",
  "version": "1.0.0",
  "identifier": "com.dpolg-stiftung.timetracker",
  "bundle": {
    "publisher": "Stiftung der Deutschen Polizeigewerkschaft",
    "copyright": "Copyright © 2025 Stiftung der DPolG",
    "category": "Productivity"
  }
}
```

---

## 🐛 Known Issues & Solutions

### Issue 1: Session Cookies Don't Work

**Problem:**
Browser `fetch()` with `credentials: 'include'` doesn't persist HttpOnly cookies in Tauri.

**Solution:**
Use Tauri HTTP Plugin instead:

```typescript
// ❌ DON'T
fetch('http://localhost:3000/api/login', { credentials: 'include' })

// ✅ DO
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
tauriFetch('http://localhost:3000/api/login')
```

**Implementation:**
We created `desktop/src/lib/tauriHttpClient.ts` that wraps Tauri HTTP plugin.

### Issue 2: CORS Errors

**Problem:**
`Access-Control-Allow-Origin` errors when connecting to localhost:3000.

**Solution:**
Add `tauri://localhost` to CORS origins:

```typescript
// server/src/server.ts
app.use(cors({
  origin: ['tauri://localhost', 'https://tauri.localhost', 'http://localhost:5173'],
  credentials: true,
}));
```

### Issue 3: Cookies Not Secure

**Problem:**
`secure: true` in session cookies doesn't work with `http://localhost`.

**Solution:**
Set `secure: false` for development:

```typescript
session({
  cookie: {
    httpOnly: true,
    secure: false, // Must be false for localhost
    sameSite: 'lax',
  }
})
```

### Issue 4: API Response Format Mismatch

**Problem:**
Backend sends `{ data: user }`, frontend expects `{ data: { user } }`.

**Solution:**
Sync response types between frontend and backend:

```typescript
// Backend
res.json({
  success: true,
  data: { user: result.user }  // ← Wrapped
});

// Frontend
const response = await apiClient.post<{ user: User }>('/auth/login');
```

### Issue 5: Windows Production Cookies Reset

**Problem:**
On Windows, production builds use `http://tauri.localhost` which resets cookies/localStorage.

**Solution (if needed):**
Enable HTTPS scheme:

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "useHttpsScheme": true
    }
  }
}
```

---

## 📦 Distribution

### macOS

**Code Signing (Required for distribution):**

```bash
# 1. Generate Developer ID certificate in Apple Developer Account
# 2. Add to Keychain
# 3. Configure in tauri.conf.json

{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
    }
  }
}
```

**Notarization:**

```bash
# After signing
xcrun notarytool submit "Stiftung der DPolG TimeTracker.dmg" \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID"
```

**Distribution:**
- DMG for manual installation
- App Store (requires additional setup)

### Windows

**Code Signing (Optional but recommended):**

```bash
# Purchase Code Signing Certificate
# Configure in tauri.conf.json

{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT"
    }
  }
}
```

**Distribution:**
- MSI installer (recommended)
- EXE installer (NSIS)
- Microsoft Store (requires additional setup)

### Linux

**Distribution:**
- AppImage (universal, no dependencies)
- .deb (Debian/Ubuntu)
- Snap / Flatpak (future)

---

## 🔄 Auto-Update Setup

### 1. GitHub Releases

**Create GitHub Release:**

```bash
# Tag version
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will auto-build and create release
```

**Required:** `.github/workflows/release.yml`

### 2. Tauri Updater Configuration

**File:** `desktop/src-tauri/tauri.conf.json`

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/your-org/your-repo/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

**Generate Signature Keys:**

```bash
cd desktop
npm run tauri signer generate

# Output:
# Private Key: SAVE_IN_GITHUB_SECRETS
# Public Key: ADD_TO_tauri.conf.json
```

### 3. Frontend Update Check

```typescript
import { checkUpdate, installUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/api/process';

async function checkForUpdates() {
  const { shouldUpdate, manifest } = await checkUpdate();

  if (shouldUpdate) {
    // Download + Install
    await installUpdate();

    // Restart app
    await relaunch();
  }
}
```

---

## 📝 Deployment Checklist

**Before Production:**

- [ ] Remove Debug Panel (`desktop/src/components/DebugPanel.tsx`)
- [ ] Remove `console.log()` statements
- [ ] Set `NODE_ENV=production`
- [ ] Configure SSL/TLS for server
- [ ] Set strong `SESSION_SECRET`
- [ ] Enable HTTPS scheme (if needed)
- [ ] Code signing certificates
- [ ] Test on all target platforms
- [ ] Backup database
- [ ] Document server deployment
- [ ] Setup monitoring/logging
- [ ] Configure auto-updates
- [ ] Create user documentation

---

## 🆘 Troubleshooting

### Build Fails on macOS

**Error:** `xcrun: error: unable to find utility "notarytool"`

**Solution:**
```bash
xcode-select --install
sudo xcode-select --reset
```

### Build Fails on Windows

**Error:** `link.exe` not found

**Solution:**
Install Visual Studio Build Tools with "Desktop development with C++" workload.

### Rust Compilation Errors

**Error:** `cargo build` fails

**Solution:**
```bash
# Update Rust
rustup update

# Clean build
cd desktop/src-tauri
cargo clean
cargo build
```

### App Won't Start

**Check:**
1. Backend server running on port 3000
2. No firewall blocking localhost:3000
3. HTTP permissions configured
4. Check console for errors

---

## 📚 Resources

- **Tauri Docs:** https://v2.tauri.app/
- **Tauri HTTP Plugin:** https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/http
- **Tauri Notification Plugin:** https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/notification
- **Code Signing:** https://v2.tauri.app/distribute/sign/
- **GitHub Releases:** https://v2.tauri.app/distribute/github-releases/

---

**Last Updated:** 2025-10-31
**Maintained by:** Maxflow Software
**For:** Stiftung der Deutschen Polizeigewerkschaft
