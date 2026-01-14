#!/bin/bash
# Query production database using Node.js (usage: ./query-prod-db-node.sh "SELECT * FROM users")

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load SSH config
source "$PROJECT_ROOT/.env.ssh" 2>/dev/null || {
  SSH_KEY_PATH="$PROJECT_ROOT/.ssh/oracle_server.key"
  SSH_USER="ubuntu"
  SSH_HOST="129.159.8.19"
}

QUERY="${1:-SELECT id, firstName, lastName, email FROM users WHERE deletedAt IS NULL LIMIT 10}"

# Execute query on remote server using Node.js
ssh -i "$SSH_KEY_PATH" "$SSH_USER@$SSH_HOST" bash << EOF
cd /home/ubuntu/TimeTracking-Clean/server
node -e "
const Database = require('better-sqlite3');
const db = new Database('/home/ubuntu/TimeTracking-Clean/server/database.db', { readonly: true });
try {
  const rows = db.prepare(\\\`${QUERY}\\\`).all();
  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
"
EOF
