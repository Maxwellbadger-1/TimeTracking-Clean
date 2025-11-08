#!/bin/bash

# ============================================
# Production Build Script
# TimeTracking System
# ============================================

set -e  # Exit on error

echo "🚀 Building TimeTracking System for Production..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================
# Step 1: Pre-Build Checks
# ============================================

echo -e "${BLUE}📋 Step 1: Pre-Build Checks${NC}"

# Check if .env files exist
if [ ! -f "server/.env" ]; then
    echo -e "${RED}❌ ERROR: server/.env nicht gefunden!${NC}"
    echo "Bitte erstelle server/.env aus server/.env.example"
    exit 1
fi

if [ ! -f "desktop/.env.production" ]; then
    echo -e "${RED}❌ WARNING: desktop/.env.production nicht gefunden!${NC}"
    echo "Bitte erstelle desktop/.env.production aus desktop/.env.production.example"
    echo "Verwende Standard-Werte (localhost:3000)..."
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ ERROR: Node.js Version $NODE_VERSION zu alt!${NC}"
    echo "Mindestens Node.js 18 erforderlich"
    exit 1
fi

echo -e "${GREEN}✅ Pre-Build Checks passed${NC}"
echo ""

# ============================================
# Step 2: Build Server
# ============================================

echo -e "${BLUE}🔧 Step 2: Building Server...${NC}"

cd server

# Install dependencies
echo "📦 Installing server dependencies..."
npm install --production=false

# TypeScript Check
echo "🔍 Running TypeScript check..."
npx tsc --noEmit

# Build
echo "🏗️  Building server..."
npm run build

echo -e "${GREEN}✅ Server build complete${NC}"
cd ..
echo ""

# ============================================
# Step 3: Build Desktop App
# ============================================

echo -e "${BLUE}🖥️  Step 3: Building Desktop App...${NC}"

cd desktop

# Install dependencies
echo "📦 Installing desktop dependencies..."
npm install

# TypeScript Check
echo "🔍 Running TypeScript check..."
npx tsc --noEmit

# Build Desktop App (Tauri)
echo "🏗️  Building Tauri Desktop App..."
echo "⏰ Dies kann 5-10 Minuten dauern..."
npm run tauri build

echo -e "${GREEN}✅ Desktop App build complete${NC}"
cd ..
echo ""

# ============================================
# Step 4: Summary
# ============================================

echo ""
echo -e "${GREEN}🎉 BUILD ERFOLGREICH ABGESCHLOSSEN!${NC}"
echo ""
echo "📦 Build-Artifacts:"
echo ""
echo "  🖥️  Desktop-App Installer:"
if [ "$(uname)" == "Darwin" ]; then
    echo "    - macOS: desktop/src-tauri/target/release/bundle/dmg/*.dmg"
    echo "    - macOS: desktop/src-tauri/target/release/bundle/macos/*.app"
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
    echo "    - Linux: desktop/src-tauri/target/release/bundle/appimage/*.AppImage"
    echo "    - Linux: desktop/src-tauri/target/release/bundle/deb/*.deb"
elif [ "$(expr substr $(uname -s) 1 10)" == "MINGW32_NT" ] || [ "$(expr substr $(uname -s) 1 10)" == "MINGW64_NT" ]; then
    echo "    - Windows: desktop/src-tauri/target/release/bundle/msi/*.msi"
    echo "    - Windows: desktop/src-tauri/target/release/bundle/nsis/*.exe"
fi
echo ""
echo "  🔧 Server:"
echo "    - Compiled: server/dist/server.js"
echo ""
echo "📝 Nächste Schritte:"
echo ""
echo "  1. Server deployen:"
echo "     cd server"
echo "     pm2 start ecosystem.config.js"
echo "     pm2 save"
echo ""
echo "  2. Desktop-App Installer verteilen:"
echo "     - Installer an Mitarbeiter senden"
echo "     - Installation durchführen"
echo ""
echo "✅ Fertig!"
