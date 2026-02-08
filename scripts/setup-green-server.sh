#!/bin/bash

# Setup script for GREEN server (129.159.8.19)
# This script initializes the TimeTracking application on a fresh Oracle Cloud server

set -e  # Exit on error

echo "======================================"
echo "🚀 TimeTracking GREEN Server Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    print_error "This script should be run as the ubuntu user"
    exit 1
fi

# Step 1: Install required system packages
echo ""
echo "📦 Installing system dependencies..."

# Update package list
sudo apt-get update -y

# Install Node.js 20.x if not present
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    print_status "Node.js already installed: $(node -v)"
fi

# Install Git if not present
if ! command -v git &> /dev/null; then
    print_status "Installing Git..."
    sudo apt-get install -y git
else
    print_status "Git already installed"
fi

# Install SQLite if not present
if ! command -v sqlite3 &> /dev/null; then
    print_status "Installing SQLite..."
    sudo apt-get install -y sqlite3
else
    print_status "SQLite already installed"
fi

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    sudo npm install -g pm2
    pm2 startup systemd -u ubuntu --hp /home/ubuntu
else
    print_status "PM2 already installed"
fi

# Step 2: Clone or update the repository
echo ""
echo "📥 Setting up project repository..."

cd /home/ubuntu

if [ ! -d "TimeTracking-Clean" ]; then
    print_status "Cloning repository..."
    git clone https://github.com/Maxwellbadger-1/TimeTracking-Clean.git
    cd TimeTracking-Clean
else
    print_status "Repository exists, updating..."
    cd TimeTracking-Clean
    git fetch origin main
    git reset --hard origin/main
fi

# Step 3: Setup server application
echo ""
echo "🔨 Building server application..."

cd server

# Install dependencies
print_status "Installing npm dependencies..."
npm install

# Create .env file with secure defaults
if [ ! -f ".env" ]; then
    print_status "Creating .env configuration..."
    SESSION_SECRET=$(openssl rand -hex 32)
    cat > .env << EOF
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
TZ=Europe/Berlin
PORT=3000
EOF
    print_status ".env file created with secure session secret"
else
    print_warning ".env file already exists, keeping existing configuration"
fi

# Build TypeScript
print_status "Building TypeScript..."
npm run build

if [ ! -f "dist/server.js" ]; then
    print_error "Build failed! dist/server.js not found"
    exit 1
fi

# Step 4: Setup database
echo ""
echo "🗄️  Setting up database..."

# Backup existing database if it exists
if [ -f "database.db" ]; then
    BACKUP_NAME="database.backup.$(date +%Y%m%d_%H%M%S).db"
    print_warning "Backing up existing database to $BACKUP_NAME"
    cp database.db $BACKUP_NAME
    rm database.db
fi

print_status "Database will be created fresh on first server start"

# Step 5: Configure and start PM2
echo ""
echo "🚀 Starting server with PM2..."

# Stop and delete existing PM2 process if it exists
pm2 stop timetracking-server 2>/dev/null || true
pm2 delete timetracking-server 2>/dev/null || true

# Load environment variables
source .env

# Start the server with PM2
pm2 start dist/server.js \
  --name "timetracking-server" \
  --cwd /home/ubuntu/TimeTracking-Clean/server \
  --time \
  --env NODE_ENV=production \
  --env TZ=Europe/Berlin \
  --env SESSION_SECRET=$SESSION_SECRET \
  --env 'ALLOWED_ORIGINS=tauri://localhost,https://tauri.localhost,http://tauri.localhost,http://localhost:1420'

# Save PM2 configuration
pm2 save

# Step 6: Setup firewall rules
echo ""
echo "🔒 Configuring firewall..."

# Open port 3000 for the application
sudo ufw allow 3000/tcp 2>/dev/null || print_warning "UFW not configured, skipping firewall rules"

# Step 7: Health check
echo ""
echo "🏥 Running health check..."

sleep 5  # Give server time to start

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ "$HTTP_CODE" = "200" ]; then
    print_status "Health check passed!"
else
    print_error "Health check failed with HTTP $HTTP_CODE"
    echo "Checking PM2 logs..."
    pm2 logs timetracking-server --lines 50
    exit 1
fi

# Step 8: Create initial admin user
echo ""
echo "👤 Creating admin user..."

# Create admin user via direct database insertion
sqlite3 /home/ubuntu/TimeTracking-Clean/server/database.db << 'SQL'
INSERT OR REPLACE INTO users (
    id, username, email, password, firstName, lastName,
    role, weeklyHours, vacationDaysPerYear, isActive,
    hireDate, privacyConsentAt
) VALUES (
    1,
    'admin',
    'admin@timetracking.local',
    '$2b$10$K7L1OJ0TfgLKkimdBGOH7O.RjaatJP3Q96Bh3JeOcH2v4sEumYXei',  -- password: admin
    'System',
    'Administrator',
    'admin',
    40,
    30,
    1,
    date('now'),
    datetime('now')
);
SQL

print_status "Admin user created (username: admin, password: admin)"

# Final status
echo ""
echo "======================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "======================================"
echo ""
echo "Server Information:"
echo "  - URL: http://129.159.8.19:3000"
echo "  - Admin Login: admin / admin"
echo ""
echo "PM2 Commands:"
echo "  - Status: pm2 status"
echo "  - Logs: pm2 logs timetracking-server"
echo "  - Restart: pm2 restart timetracking-server"
echo ""
echo "Next Steps:"
echo "  1. Test login at http://129.159.8.19:3000"
echo "  2. Change admin password after first login"
echo "  3. Configure GitHub Secrets for automated deployment"
echo ""

pm2 status