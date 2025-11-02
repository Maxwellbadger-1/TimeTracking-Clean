#!/bin/bash
#
# TimeTracking System - Automatic Server Setup Script
#
# This script automatically sets up everything on a fresh Ubuntu 22.04 server
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/TimeTracking-Clean/main/deployment/auto-setup.sh | bash
#
# OR manually:
#   chmod +x auto-setup.sh
#   ./auto-setup.sh
#

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="TimeTracking-Clean"
GITHUB_REPO="Maxwellbadger-1/TimeTracking-Clean"
INSTALL_DIR="$HOME/$PROJECT_NAME"
LOG_DIR="$HOME/logs"
BACKUP_DIR="$HOME/backups"

# Progress tracking
TOTAL_STEPS=10
CURRENT_STEP=0

print_step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}📍 Step $CURRENT_STEP/$TOTAL_STEPS: $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Banner
clear
echo -e "${PURPLE}"
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ████████╗██╗███╗   ███╗███████╗████████╗██████╗  █████╗   ║
║   ╚══██╔══╝██║████╗ ████║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗  ║
║      ██║   ██║██╔████╔██║█████╗     ██║   ██████╔╝███████║  ║
║      ██║   ██║██║╚██╔╝██║██╔══╝     ██║   ██╔══██╗██╔══██║  ║
║      ██║   ██║██║ ╚═╝ ██║███████╗   ██║   ██║  ██║██║  ██║  ║
║      ╚═╝   ╚═╝╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝  ║
║                                                              ║
║            🚀 Automatic Server Setup Script 🚀              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

print_info "This script will automatically set up your TimeTracking server"
print_info "Estimated time: ~10 minutes"
echo ""
read -p "Press ENTER to start setup... " -r
echo ""

# Step 1: System Update
print_step "System Update & Upgrade"
print_info "Updating package lists..."
sudo apt-get update -qq
print_info "Upgrading packages (this may take a few minutes)..."
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
print_success "System updated successfully"

# Step 2: Install Node.js 20.x
print_step "Installing Node.js 20.x"
print_info "Adding NodeSource repository..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
print_info "Installing Node.js..."
sudo apt-get install -y nodejs -qq
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_success "Node.js $NODE_VERSION installed"
print_success "npm $NPM_VERSION installed"

# Step 3: Install Git
print_step "Installing Git"
sudo apt-get install -y git -qq
GIT_VERSION=$(git --version)
print_success "$GIT_VERSION installed"

# Step 4: Install PM2
print_step "Installing PM2 Process Manager"
print_info "Installing PM2 globally..."
sudo npm install -g pm2 --silent
PM2_VERSION=$(pm2 --version)
print_success "PM2 $PM2_VERSION installed"

# Step 5: Configure Firewall
print_step "Configuring UFW Firewall"
print_info "Allowing SSH (port 22)..."
sudo ufw allow 22 > /dev/null 2>&1
print_info "Allowing HTTP (port 80)..."
sudo ufw allow 80 > /dev/null 2>&1
print_info "Allowing HTTPS (port 443)..."
sudo ufw allow 443 > /dev/null 2>&1
print_info "Allowing Node.js API (port 3000)..."
sudo ufw allow 3000 > /dev/null 2>&1
print_info "Enabling firewall..."
sudo ufw --force enable > /dev/null 2>&1
print_success "Firewall configured and enabled"

# Step 6: Clone Repository
print_step "Cloning Project Repository"
if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    print_info "Removing old directory..."
    rm -rf "$INSTALL_DIR"
fi
print_info "Cloning from GitHub..."
git clone --quiet "https://github.com/$GITHUB_REPO.git" "$INSTALL_DIR"
cd "$INSTALL_DIR"
print_success "Repository cloned successfully"

# Step 7: Install Dependencies
print_step "Installing Server Dependencies"
cd "$INSTALL_DIR/server"
print_info "Installing npm packages (this may take a few minutes)..."
npm install --production --silent
print_success "Dependencies installed"

# Step 8: Build Server
print_step "Building Server Application"
print_info "Compiling TypeScript..."
npm run build --silent
print_success "Server built successfully"

# Step 9: Configure Environment
print_step "Configuring Environment Variables"

# Generate secure session secret
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Create .env file
cat > .env << EOF
# Production Environment Variables
NODE_ENV=production
PORT=3000

# Session Secret (auto-generated)
SESSION_SECRET=$SESSION_SECRET

# Database
DATABASE_PATH=./database.db
EOF

print_success "Environment variables configured"
print_info "Session secret generated: ${SESSION_SECRET:0:16}..."

# Step 10: Create directories
print_info "Creating log and backup directories..."
mkdir -p "$LOG_DIR"
mkdir -p "$BACKUP_DIR"

# Step 11: Setup PM2
print_step "Starting Server with PM2"
print_info "Starting TimeTracking API..."
pm2 delete timetracking-api > /dev/null 2>&1 || true
pm2 start dist/server.js --name timetracking-api
print_info "Saving PM2 configuration..."
pm2 save > /dev/null 2>&1
print_info "Configuring PM2 startup..."
PM2_STARTUP=$(pm2 startup systemd -u $USER --hp $HOME | grep "sudo")
eval $PM2_STARTUP > /dev/null 2>&1
print_success "Server started and configured for auto-restart"

# Step 12: Setup Backup Cron Job
print_step "Configuring Automatic Backups"
print_info "Creating backup script..."
cat > "$HOME/backup-timetracking.sh" << 'BACKUP_EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups"
DB_PATH="$HOME/TimeTracking-Clean/server/database.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/database_$DATE.db"
find "$BACKUP_DIR" -name "database_*.db" -mtime +30 -delete
echo "Backup completed: database_$DATE.db"
BACKUP_EOF

chmod +x "$HOME/backup-timetracking.sh"

print_info "Adding backup to crontab..."
(crontab -l 2>/dev/null | grep -v backup-timetracking; echo "0 2 * * * $HOME/backup-timetracking.sh >> $LOG_DIR/backup.log 2>&1") | crontab -
print_success "Daily backups configured (runs at 2:00 AM)"

# Health Check
print_step "Running Health Check"
print_info "Waiting for server to start..."
sleep 3

HEALTH_CHECK=$(curl -s http://localhost:3000/api/health || echo "failed")
if echo "$HEALTH_CHECK" | grep -q "ok"; then
    print_success "Health check passed!"
else
    print_error "Health check failed!"
    print_warning "Checking PM2 logs..."
    pm2 logs timetracking-api --lines 20 --nostream
fi

# Final Summary
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 INSTALLATION COMPLETE! 🎉${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}📊 Server Information:${NC}"
echo -e "  ${BLUE}•${NC} Server URL: http://$(curl -s ifconfig.me):3000"
echo -e "  ${BLUE}•${NC} Health Check: http://$(curl -s ifconfig.me):3000/api/health"
echo -e "  ${BLUE}•${NC} Install Directory: $INSTALL_DIR"
echo -e "  ${BLUE}•${NC} Logs Directory: $LOG_DIR"
echo -e "  ${BLUE}•${NC} Backups Directory: $BACKUP_DIR"
echo ""
echo -e "${CYAN}🔧 Useful Commands:${NC}"
echo -e "  ${BLUE}•${NC} Check status:   ${YELLOW}pm2 status${NC}"
echo -e "  ${BLUE}•${NC} View logs:      ${YELLOW}pm2 logs timetracking-api${NC}"
echo -e "  ${BLUE}•${NC} Restart server: ${YELLOW}pm2 restart timetracking-api${NC}"
echo -e "  ${BLUE}•${NC} Stop server:    ${YELLOW}pm2 stop timetracking-api${NC}"
echo -e "  ${BLUE}•${NC} Manual backup:  ${YELLOW}$HOME/backup-timetracking.sh${NC}"
echo ""
echo -e "${CYAN}📱 Next Steps:${NC}"
echo -e "  ${BLUE}1.${NC} Update your Desktop app's ${YELLOW}.env.production${NC} file:"
echo -e "     ${YELLOW}VITE_API_URL=http://$(curl -s ifconfig.me):3000/api${NC}"
echo ""
echo -e "  ${BLUE}2.${NC} Rebuild and restart your Desktop app"
echo ""
echo -e "  ${BLUE}3.${NC} Test login with your admin credentials"
echo ""
echo -e "${GREEN}✅ Your TimeTracking server is now running!${NC}"
echo ""
