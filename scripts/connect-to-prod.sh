#!/bin/bash
# Quick connect to production server

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load SSH config
source "$PROJECT_ROOT/.env.ssh" 2>/dev/null || {
  SSH_KEY_PATH="$PROJECT_ROOT/.ssh/oracle_server.key"
  SSH_USER="ubuntu"
  SSH_HOST="129.159.8.19"
}

# Connect
ssh -i "$SSH_KEY_PATH" "$SSH_USER@$SSH_HOST"
