# Promote Staging to Production (Code Deployment)

**Command:** `/promote-to-prod`

**Purpose:** Safely promote tested code from Staging (Green Server) to Production (Blue Server) via Git merge and automatic deployment

---

## ⚠️ IMPORTANT: When to use this

**Use `/promote-to-prod` when:**
- Features have been tested on Green Server (Port 3001)
- All tests passing on `staging` branch
- Ready to deploy to Production (Blue Server, Port 3000)
- Database migrations are backward-compatible

**DO NOT use if:**
- Tests are failing on staging branch
- Breaking changes without migration plan
- Production has critical bugs (fix those first)
- You're not authorized to deploy to production

---

## What this command does:

1. **Checks current Git status** (uncommitted changes block deployment)
2. **Verifies staging branch is ahead of main** (has new commits)
3. **Checks GitHub Actions status** (staging tests must pass)
4. **Displays changes to be promoted** (commits & file diff)
5. **User confirmation** (manual approval before production deploy)
6. **Merges staging → main** (via GitHub CLI)
7. **Waits for GitHub Actions deployment** (monitors progress)
8. **Health check after deployment** (verifies production is healthy)
9. **Displays deployment summary** (what was deployed, when, status)

---

## Execute the promotion:

```bash
# ═══════════════════════════════════════
# 🚀 PROMOTE STAGING → PRODUCTION
# ═══════════════════════════════════════

cd /Users/maximilianfegg/Desktop/TimeTracking-Clean

echo "═══════════════════════════════════════════════"
echo "🚀 PROMOTE TO PRODUCTION - Code Deployment"
echo "═══════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────
# STEP 1: Pre-Flight Checks
# ─────────────────────────────────────
echo "🔍 Step 1: Running pre-flight checks..."
echo ""

# Check 1.1: Git status clean
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ ERROR: You have uncommitted changes!"
  echo ""
  git status --short
  echo ""
  echo "🔧 FIX: Commit or stash your changes first:"
  echo "   git add . && git commit -m 'your message'"
  echo "   # OR"
  echo "   git stash"
  echo ""
  exit 1
fi
echo "✅ Git status clean"

# Check 1.2: Fetch latest from remote
git fetch origin
echo "✅ Fetched latest from origin"

# Check 1.3: staging branch exists
if ! git show-ref --verify --quiet refs/heads/staging; then
  echo "❌ ERROR: staging branch doesn't exist locally!"
  echo ""
  echo "🔧 FIX: Create and push staging branch first:"
  echo "   git checkout -b staging"
  echo "   git push -u origin staging"
  echo ""
  exit 1
fi
echo "✅ Staging branch exists"

# Check 1.4: staging branch has commits ahead of main
git checkout staging
COMMITS_AHEAD=$(git rev-list --count origin/main..staging)
if [ "$COMMITS_AHEAD" -eq 0 ]; then
  echo "⚠️  WARNING: staging branch has NO new commits ahead of main!"
  echo ""
  echo "Nothing to promote. staging and main are in sync."
  echo ""
  exit 0
fi
echo "✅ Staging has $COMMITS_AHEAD new commit(s) ahead of main"
echo ""

# ─────────────────────────────────────
# STEP 2: Check GitHub Actions Status
# ─────────────────────────────────────
echo "🔍 Step 2: Checking GitHub Actions status..."
echo ""

# Get latest workflow run for staging branch
WORKFLOW_STATUS=$(gh run list --branch staging --limit 1 --json status,conclusion,workflowName,createdAt --jq '.[0]')
CONCLUSION=$(echo "$WORKFLOW_STATUS" | jq -r '.conclusion')
WORKFLOW_NAME=$(echo "$WORKFLOW_STATUS" | jq -r '.workflowName')
CREATED_AT=$(echo "$WORKFLOW_STATUS" | jq -r '.createdAt')

if [ "$CONCLUSION" != "success" ]; then
  echo "❌ ERROR: Latest staging workflow did not succeed!"
  echo ""
  echo "Workflow: $WORKFLOW_NAME"
  echo "Created: $CREATED_AT"
  echo "Status: $CONCLUSION"
  echo ""
  echo "🔧 FIX: Check GitHub Actions and fix failing tests:"
  echo "   gh run view --branch staging"
  echo "   # OR"
  echo "   open https://github.com/Maxwellbadger-1/TimeTracking-Clean/actions"
  echo ""
  exit 1
fi
echo "✅ Latest staging workflow: $WORKFLOW_NAME ($CONCLUSION)"
echo "   Created: $CREATED_AT"
echo ""

# ─────────────────────────────────────
# STEP 3: Display Changes to Promote
# ─────────────────────────────────────
echo "📋 Step 3: Changes to be promoted to production:"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 COMMITS (staging → main):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git log --oneline --no-merges origin/main..staging
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 FILES CHANGED:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git diff --stat origin/main...staging
echo ""

# ─────────────────────────────────────
# STEP 4: User Confirmation
# ─────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  PRODUCTION DEPLOYMENT CONFIRMATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You are about to deploy $COMMITS_AHEAD commit(s) to PRODUCTION:"
echo "  • Target Server: Blue Server (129.159.8.19:3000)"
echo "  • Database: /home/ubuntu/database-shared.db"
echo "  • Deployment: Automatic via GitHub Actions"
echo "  • Downtime: ~30 seconds (PM2 restart)"
echo ""
read -p "🔴 Are you sure? Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo ""
  echo "❌ Deployment cancelled by user."
  echo ""
  exit 0
fi
echo ""

# ─────────────────────────────────────
# STEP 5: Merge staging → main
# ─────────────────────────────────────
echo "🔀 Step 5: Merging staging → main..."
echo ""

# Checkout main and pull latest
git checkout main
git pull origin main

# Merge staging (no fast-forward for merge commit)
if git merge staging --no-ff -m "feat: Promote staging to production ($COMMITS_AHEAD commits)

Promoted commits:
$(git log --oneline --no-merges origin/main..staging)

Deployed via /promote-to-prod command"; then
  echo "✅ Merge successful: staging → main"
else
  echo "❌ ERROR: Merge failed! Resolve conflicts manually."
  echo ""
  echo "🔧 FIX:"
  echo "   git status"
  echo "   # Resolve conflicts"
  echo "   git add ."
  echo "   git commit"
  echo "   git push origin main"
  echo ""
  exit 1
fi

# Push to origin/main (triggers GitHub Actions deployment)
echo ""
echo "📤 Pushing to origin/main (triggers deployment)..."
if git push origin main; then
  echo "✅ Pushed to origin/main"
else
  echo "❌ ERROR: Push failed!"
  exit 1
fi
echo ""

# ─────────────────────────────────────
# STEP 6: Wait for Deployment
# ─────────────────────────────────────
echo "⏳ Step 6: Waiting for GitHub Actions deployment..."
echo ""
echo "Deployment workflow: 'CD - Deploy Server to Oracle Cloud'"
echo ""

# Wait 10 seconds for workflow to start
echo "⏱️  Waiting 10 seconds for workflow to start..."
sleep 10

# Monitor deployment progress
MAX_WAIT=600  # 10 minutes
ELAPSED=0
INTERVAL=15

while [ $ELAPSED -lt $MAX_WAIT ]; do
  # Get latest workflow run for main branch
  RUN_STATUS=$(gh run list --branch main --limit 1 --json status,conclusion,workflowName,createdAt --jq '.[0]')
  STATUS=$(echo "$RUN_STATUS" | jq -r '.status')
  CONCLUSION=$(echo "$RUN_STATUS" | jq -r '.conclusion')

  if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
      echo "✅ Deployment completed successfully!"
      echo ""
      break
    else
      echo "❌ Deployment failed! Conclusion: $CONCLUSION"
      echo ""
      echo "🔧 Check logs:"
      echo "   gh run view --branch main"
      echo ""
      exit 1
    fi
  fi

  echo "⏳ Deployment in progress... ($ELAPSED/${MAX_WAIT}s elapsed)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "⚠️  WARNING: Deployment timeout after ${MAX_WAIT}s"
  echo ""
  echo "🔧 Check manually:"
  echo "   gh run view --branch main"
  echo ""
fi

# ─────────────────────────────────────
# STEP 7: Health Check
# ─────────────────────────────────────
echo "🏥 Step 7: Running production health check..."
echo ""

sleep 5  # Wait for PM2 restart to complete

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://129.159.8.19:3000/api/health)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Production server is healthy!"
  echo "$HEALTH_BODY"
else
  echo "❌ Health check failed! HTTP $HTTP_CODE"
  echo "$HEALTH_BODY"
  echo ""
  echo "🔧 Check server status:"
  echo "   ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 status'"
  echo "   ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 logs timetracking-server --lines 50'"
  echo ""
  exit 1
fi
echo ""

# ─────────────────────────────────────
# STEP 8: Summary
# ─────────────────────────────────────
echo "═══════════════════════════════════════════════"
echo "✅ PRODUCTION DEPLOYMENT SUCCESSFUL"
echo "═══════════════════════════════════════════════"
echo ""
echo "📊 Deployment Summary:"
echo "  • Commits promoted: $COMMITS_AHEAD"
echo "  • Target: Blue Server (129.159.8.19:3000)"
echo "  • Deployment method: GitHub Actions (main branch)"
echo "  • Health check: Passed ✅"
echo "  • Database: /home/ubuntu/database-shared.db"
echo ""
echo "📝 Changes deployed:"
git log --oneline --no-merges -$COMMITS_AHEAD main
echo ""
echo "🌐 Production URL: http://129.159.8.19:3000"
echo "📊 Monitor: ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 status'"
echo ""
echo "🔄 Rollback (if needed): Use /rollback-prod command"
echo ""
```

---

## What happens during promotion:

### Before Promotion:
```
Staging (Green Server - Port 3001):
├── staging branch: 3 new commits
├── Tests: Passing ✅
├── Features tested: ✅
├── Ready for production: ✅

Production (Blue Server - Port 3000):
├── main branch: Running v1.5.1
├── No new commits
```

### After Promotion:
```
Staging (Green Server - Port 3001):
├── staging branch: In sync with main
├── Can continue testing new features

Production (Blue Server - Port 3000):
├── main branch: Running v1.5.2 (promoted!)
├── 3 new commits deployed ✅
├── Health check: Passed ✅
├── Database migrations: Applied ✅
```

---

## Verification:

After running `/promote-to-prod`, verify:

**1. Production Health:**
```bash
curl http://129.159.8.19:3000/api/health
# Expected: {"status":"ok","message":"TimeTracking Server is running"}
```

**2. GitHub Actions:**
```bash
gh run list --branch main --limit 1
# Expected: Status = "completed", Conclusion = "success"
```

**3. Server Logs:**
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 logs timetracking-server --lines 20'
# Expected: No errors, successful startup messages
```

---

## Rollback (if deployment fails):

Use the `/rollback-prod` command to restore previous version:

```bash
/rollback-prod
```

**Or manually:**
```bash
git checkout main
git revert HEAD~1  # Revert merge commit
git push origin main
# GitHub Actions will auto-deploy the rollback
```

---

## Troubleshooting:

### Issue: Merge conflicts

**Solution:**
```bash
git checkout main
git pull origin main
git merge staging
# Resolve conflicts in editor
git add .
git commit -m "Resolve merge conflicts"
git push origin main
```

### Issue: Deployment timeout

**Solution:**
```bash
# Check deployment status manually:
gh run view --branch main

# If still running, wait or cancel:
gh run cancel <run-id>
```

### Issue: Health check fails after deployment

**Solution:**
```bash
# Check server logs:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 logs timetracking-server --lines 50'

# Check PM2 status:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 status'

# Restart if needed:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 restart timetracking-server'
```

---

## Safety Features:

✅ **Pre-flight checks:** Git status, branch verification, commits validation
✅ **Test verification:** GitHub Actions must pass before promotion
✅ **User confirmation:** Manual approval before production deploy
✅ **Automatic backup:** Database backup happens via GitHub Actions deployment
✅ **Health check:** Verifies production is healthy after deployment
✅ **Rollback capability:** Git history preserved for easy rollback

---

## Best Practices:

**1. Test on Staging First:**
```bash
# Always test on Green Server before promoting:
/green && npm run dev  # Desktop App → Green Server
# Test features manually
# Run automated tests: npm test
```

**2. Check Database Migrations:**
```bash
# If migrations are included, verify they're backward-compatible:
cd server/database/migrations
ls -la  # Check latest migration files
```

**3. Monitor Production After Deployment:**
```bash
# Keep an eye on logs for 5-10 minutes:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 logs timetracking-server --lines 0 --follow'
```

**4. Update CHANGELOG.md:**
```bash
# After successful deployment, update CHANGELOG.md:
# - Move [Unreleased] changes to new version section
# - Commit and push to both staging and main
```

---

## Integration with Development Workflow:

**Complete Workflow:**
```
1. Develop locally (localhost:3000)
2. Commit to staging branch
3. GitHub Actions deploys to Green Server (Port 3001)
4. Test on Green Server via Desktop App (/green command)
5. Run /promote-to-prod when ready
6. GitHub Actions deploys to Blue Server (Port 3000)
7. Production is updated ✅
```

---

**Last Updated:** 2026-02-11
**Deployment Strategy:** Git-based Code Deployment (Industry Best Practice)
**Related Commands:** `/dev`, `/green`, `/sync-green`, `/rollback-prod`
