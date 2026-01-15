#!/bin/bash
# Query production database (usage: ./query-prod-db.sh "SELECT * FROM users")

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load SSH config
source "$PROJECT_ROOT/.env.ssh" 2>/dev/null || {
  SSH_KEY_PATH="$PROJECT_ROOT/.ssh/oracle_server.key"
  SSH_USER="ubuntu"
  SSH_HOST="129.159.8.19"
  PROD_DB_PATH="/home/ubuntu/TimeTracking-Clean/server/database.db"
}

QUERY="${1:-SELECT 'No query provided'}"

# Run query on production database
ssh -i "$SSH_KEY_PATH" "$SSH_USER@$SSH_HOST" \
  "cd /home/ubuntu/TimeTracking-Clean/server && sqlite3 -header -column database.db \"$QUERY\""
