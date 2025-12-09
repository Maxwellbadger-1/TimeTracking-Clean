#!/bin/bash
# One-time SSH Setup for Oracle Server
# This script sets up SSH access to 129.159.8.19

echo "🔐 Setting up SSH access to Oracle Server..."
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "📥 Installing GitHub CLI..."
    brew install gh
fi

# Login to GitHub (if not already logged in)
if ! gh auth status &> /dev/null; then
    echo "🔑 Please login to GitHub:"
    gh auth login
fi

# Get the SSH key from GitHub Secrets
echo "📥 Fetching SSH key from GitHub Secrets..."
gh secret list -R Maxwellbadger-1/TimeTracking-Clean

echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "The SSH key is stored in GitHub Secrets as ORACLE_SSH_KEY."
echo "I cannot automatically extract it (GitHub doesn't allow that)."
echo ""
echo "Please do ONE of the following:"
echo ""
echo "Option A: Copy the SSH key manually"
echo "  1. Go to: https://github.com/Maxwellbadger-1/TimeTracking-Clean/settings/secrets/actions"
echo "  2. Open ORACLE_SSH_KEY secret"
echo "  3. Copy the entire key (including -----BEGIN ... and -----END ...)"
echo "  4. Run: nano ~/.ssh/oracle_key"
echo "  5. Paste the key, save (Ctrl+O, Enter, Ctrl+X)"
echo "  6. Run: chmod 600 ~/.ssh/oracle_key"
echo ""
echo "Option B: Generate a new SSH key and add it to Oracle Server"
echo "  1. ssh-keygen -t ed25519 -f ~/.ssh/oracle_key -N ''"
echo "  2. Contact your Oracle admin to add ~/.ssh/oracle_key.pub to the server"
echo ""
echo "After completing either option, run:"
echo "  ssh -i ~/.ssh/oracle_key ubuntu@129.159.8.19 'echo Success!'"
echo ""
echo "Then I can run all diagnostics for you automatically!"
