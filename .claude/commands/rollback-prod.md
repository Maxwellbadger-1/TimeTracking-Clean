# Rollback Production to Previous Version

**Command:** `/rollback-prod`

**Purpose:** Emergency rollback of Production (Blue Server) to last working version when deployment fails or causes critical issues

---

## ⚠️ EMERGENCY USE ONLY

**Use `/rollback-prod` when:**
- Production deployment caused critical bugs
- Server is down or unresponsive after deployment
- Data corruption detected
- Immediate rollback required (can't wait for fix)

**DO NOT use if:**
- Minor bugs that can be hotfixed
- No actual production issues
- You're not authorized for production changes
- Issue is unrelated to latest deployment

---

## What this command does:

1. **Verifies current production state** (Git commit, server health)
2. **Identifies last working commit** (from Git history)
3. **Displays rollback target** (what will be restored)
4. **User confirmation** (CRITICAL - requires explicit approval)
5. **Reverts Git commit** (creates revert commit on main)
6. **Triggers automatic deployment** (GitHub Actions deploys rollback)
7. **Waits for rollback deployment** (monitors progress)
8. **Verifies rollback success** (health check + status)
9. **Optionally restores database backup** (if needed)

---

## Execute the rollback:

```bash
# ═══════════════════════════════════════
# 🔴 EMERGENCY PRODUCTION ROLLBACK
# ═══════════════════════════════════════

cd /Users/maximilianfegg/Desktop/TimeTracking-Clean

echo "═══════════════════════════════════════════════"
echo "🔴 EMERGENCY PRODUCTION ROLLBACK"
echo "═══════════════════════════════════════════════"
echo ""
echo "⚠️  This will revert Production to the previous version!"
echo ""

# ─────────────────────────────────────
# STEP 1: Verify Current State
# ─────────────────────────────────────
echo "🔍 Step 1: Checking current production state..."
echo ""

# Fetch latest from remote
git fetch origin

# Get current main commit
git checkout main
git pull origin main
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_MSG=$(git log -1 --oneline HEAD)

echo "📍 Current production commit:"
echo "   $CURRENT_MSG"
echo ""

# Check production health (might be down)
echo "🏥 Checking production health..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 10 http://129.159.8.19:3000/api/health 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Production is responding (HTTP 200)"
else
  echo "❌ Production is down or unhealthy (HTTP $HTTP_CODE)"
fi
echo ""

# ─────────────────────────────────────
# STEP 2: Identify Rollback Target
# ─────────────────────────────────────
echo "🔍 Step 2: Identifying rollback target..."
echo ""

# Get last 5 commits for context
echo "📜 Recent production commits:"
git log --oneline -5 main
echo ""

# Previous commit (rollback target)
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
PREVIOUS_MSG=$(git log -1 --oneline HEAD~1)

echo "🎯 Rollback target (previous commit):"
echo "   $PREVIOUS_MSG"
echo ""

# ─────────────────────────────────────
# STEP 3: Display Rollback Impact
# ─────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHANGES TO BE REVERTED:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git show --stat HEAD
echo ""

# ─────────────────────────────────────
# STEP 4: User Confirmation
# ─────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔴 PRODUCTION ROLLBACK CONFIRMATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You are about to ROLLBACK Production:"
echo "  • Current: $CURRENT_MSG"
echo "  • Target:  $PREVIOUS_MSG"
echo "  • Server:  Blue Server (129.159.8.19:3000)"
echo "  • Method:  Git revert + Auto-deploy"
echo ""
read -p "🔴 Type 'ROLLBACK' to confirm (case-sensitive): " CONFIRM

if [ "$CONFIRM" != "ROLLBACK" ]; then
  echo ""
  echo "❌ Rollback cancelled by user."
  echo ""
  exit 0
fi
echo ""

# ─────────────────────────────────────
# STEP 5: Revert Git Commit
# ─────────────────────────────────────
echo "🔄 Step 5: Reverting Git commit..."
echo ""

# Create revert commit (Git best practice)
if git revert --no-edit HEAD; then
  echo "✅ Revert commit created successfully"
else
  echo "❌ ERROR: Revert failed!"
  echo ""
  echo "🔧 Manual revert required:"
  echo "   git revert HEAD"
  echo "   # Resolve conflicts if any"
  echo "   git add ."
  echo "   git commit"
  echo ""
  exit 1
fi
echo ""

# ─────────────────────────────────────
# STEP 6: Push Rollback (Triggers Deployment)
# ─────────────────────────────────────
echo "📤 Step 6: Pushing rollback to origin/main..."
echo "   (This triggers automatic deployment)"
echo ""

if git push origin main; then
  echo "✅ Pushed to origin/main"
else
  echo "❌ ERROR: Push failed!"
  echo ""
  echo "🔧 Try again manually:"
  echo "   git push origin main --force-with-lease"
  echo ""
  exit 1
fi
echo ""

# ─────────────────────────────────────
# STEP 7: Wait for Rollback Deployment
# ─────────────────────────────────────
echo "⏳ Step 7: Waiting for GitHub Actions rollback deployment..."
echo ""
echo "Deployment workflow: 'CD - Deploy Server to Oracle Cloud'"
echo ""

# Wait 10 seconds for workflow to start
echo "⏱️  Waiting 10 seconds for workflow to start..."
sleep 10

# Monitor rollback progress
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
      echo "✅ Rollback deployment completed successfully!"
      echo ""
      break
    else
      echo "❌ Rollback deployment failed! Conclusion: $CONCLUSION"
      echo ""
      echo "🔧 Check logs:"
      echo "   gh run view --branch main"
      echo ""
      exit 1
    fi
  fi

  echo "⏳ Rollback deployment in progress... ($ELAPSED/${MAX_WAIT}s elapsed)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "⚠️  WARNING: Rollback deployment timeout after ${MAX_WAIT}s"
  echo ""
  echo "🔧 Check manually:"
  echo "   gh run view --branch main"
  echo ""
fi

# ─────────────────────────────────────
# STEP 8: Verify Rollback Success
# ─────────────────────────────────────
echo "🏥 Step 8: Verifying production health after rollback..."
echo ""

sleep 5  # Wait for PM2 restart to complete

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://129.159.8.19:3000/api/health)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Production server is healthy after rollback!"
  echo "$HEALTH_BODY"
else
  echo "❌ Health check failed! HTTP $HTTP_CODE"
  echo "$HEALTH_BODY"
  echo ""
  echo "⚠️  Rollback deployment completed but server is unhealthy!"
  echo ""
  echo "🔧 Next steps:"
  echo "   1. Check server logs:"
  echo "      ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 logs timetracking-server --lines 50'"
  echo "   2. Restart PM2 if needed:"
  echo "      ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 restart timetracking-server'"
  echo "   3. Consider database rollback (see below)"
  echo ""
  exit 1
fi
echo ""

# ─────────────────────────────────────
# STEP 9: Database Rollback Decision
# ─────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  DATABASE ROLLBACK (Optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Code rollback is complete. Do you need to restore database backup?"
echo ""
echo "⚠️  Only restore database if:"
echo "   • Latest deployment included bad database migration"
echo "   • Data corruption detected"
echo "   • Schema is incompatible with rolled-back code"
echo ""
read -p "Restore database backup? (yes/no): " DB_ROLLBACK

if [ "$DB_ROLLBACK" = "yes" ]; then
  echo ""
  echo "🗄️  Restoring database backup..."
  echo ""

  ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "
    echo '🔍 Finding latest database backup...'
    LATEST_BACKUP=\$(ls -t /home/ubuntu/TimeTracking-Clean/server/database.backup.*.db 2>/dev/null | head -1)

    if [ -z \"\$LATEST_BACKUP\" ]; then
      echo '❌ No backup found!'
      exit 1
    fi

    echo \"✅ Found backup: \$LATEST_BACKUP\"
    echo ''

    echo '💾 Creating safety backup of current database...'
    cp /home/ubuntu/database-shared.db /home/ubuntu/database-shared.db.before-rollback.\$(date +%Y%m%d-%H%M%S)
    echo '✅ Safety backup created'
    echo ''

    echo '🔄 Restoring database backup...'
    cp \"\$LATEST_BACKUP\" /home/ubuntu/database-shared.db
    echo '✅ Database restored'
    echo ''

    echo '🔄 Restarting PM2...'
    pm2 restart timetracking-server
    sleep 3
    echo '✅ PM2 restarted'
    echo ''

    echo '🏥 Health check...'
    HEALTH=\$(curl -s http://localhost:3000/api/health)
    if echo \"\$HEALTH\" | grep -q '\"status\":\"ok\"'; then
      echo '✅ Database rollback successful!'
      echo \"\$HEALTH\"
    else
      echo '❌ Health check failed after database rollback!'
      echo \"\$HEALTH\"
    fi
  "
  echo ""
else
  echo ""
  echo "ℹ️  Database rollback skipped (code rollback only)"
  echo ""
fi

# ─────────────────────────────────────
# STEP 10: Summary
# ─────────────────────────────────────
echo "═══════════════════════════════════════════════"
echo "✅ PRODUCTION ROLLBACK COMPLETED"
echo "═══════════════════════════════════════════════"
echo ""
echo "📊 Rollback Summary:"
echo "  • Reverted from: $CURRENT_MSG"
echo "  • Restored to:   $PREVIOUS_MSG"
echo "  • Method:        Git revert + Auto-deploy"
echo "  • Health check:  Passed ✅"
if [ "$DB_ROLLBACK" = "yes" ]; then
  echo "  • Database:      Restored from backup ✅"
else
  echo "  • Database:      Not changed (code rollback only)"
fi
echo ""
echo "🌐 Production URL: http://129.159.8.19:3000"
echo "📊 Monitor: ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 status'"
echo ""
echo "📝 Next Steps:"
echo "  1. Investigate root cause of failure"
echo "  2. Fix issues on staging branch"
echo "  3. Test thoroughly on Green Server (/green)"
echo "  4. Deploy fixed version via /promote-to-prod"
echo ""
echo "📚 Incident documentation:"
echo "  • Update CHANGELOG.md with rollback entry"
echo "  • Document what went wrong and how it was fixed"
echo "  • Update tests to prevent similar issues"
echo ""
```

---

## What happens during rollback:

### Before Rollback:
```
Production (Blue Server - Port 3000):
├── Current: v1.5.2 (broken deployment)
├── Status: 500 errors / down / data corruption
├── Database: Potentially corrupted by bad migration
```

### After Rollback:
```
Production (Blue Server - Port 3000):
├── Current: v1.5.1 (previous working version)
├── Status: Healthy ✅
├── Database: Optionally restored from backup ✅
├── Git: Revert commit created (history preserved)
```

---

## Verification:

After rollback, verify production is working:

**1. Health Check:**
```bash
curl http://129.159.8.19:3000/api/health
# Expected: {"status":"ok","message":"TimeTracking Server is running"}
```

**2. Functional Tests:**
```bash
# Test critical features via Desktop App:
/dev  # Connect to production temporarily
# Test: Login, time entry creation, reports
```

**3. Monitor Logs:**
```bash
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 logs timetracking-server --lines 50'
# Expected: No errors, normal operation
```

---

## Troubleshooting:

### Issue: Health check still fails after rollback

**Solution:**
```bash
# Check PM2 status:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 status'

# Restart PM2:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 restart timetracking-server'

# Check logs for errors:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'pm2 logs timetracking-server --lines 100'
```

### Issue: Database backup not found

**Solution:**
```bash
# List all backups:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 'ls -lth /home/ubuntu/TimeTracking-Clean/server/database.backup.*.db'

# Manually restore specific backup:
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 '
  cp /home/ubuntu/TimeTracking-Clean/server/database.backup.YYYYMMDD_HHMMSS.db /home/ubuntu/database-shared.db
  pm2 restart timetracking-server
'
```

### Issue: Merge conflicts during revert

**Solution:**
```bash
# Resolve conflicts manually:
git status
# Edit conflicting files
git add .
git commit
git push origin main
```

---

## Safety Features:

✅ **Double confirmation:** Requires typing 'ROLLBACK' (case-sensitive)
✅ **Safety backup:** Creates backup before database rollback
✅ **Health verification:** Confirms production is healthy after rollback
✅ **Git history preserved:** Revert commit keeps full history
✅ **Optional database rollback:** Code and database can be rolled back separately

---

## Post-Rollback Actions:

**1. Document Incident:**
```markdown
## CHANGELOG.md

### [1.5.2] - 2026-02-11 - ROLLED BACK

**Issue:** Critical bug in overtime calculation causing 500 errors

**Rollback performed:**
- Reverted commit: abc1234 (feat: New overtime calculation)
- Restored database backup: database.backup.20260211_100000.db
- Production downtime: 5 minutes

**Root Cause:** Division by zero in overtimeService.ts Line 456

**Fix in progress:** Created issue #123, fixing on staging branch
```

**2. Fix on Staging:**
```bash
git checkout staging
# Fix the issue
git commit -m "fix: Prevent division by zero in overtime calculation"
git push origin staging
# Test on Green Server
/green && npm run dev
```

**3. Re-deploy when ready:**
```bash
# After thorough testing:
/promote-to-prod
```

---

## Alternative: Manual Rollback

If `/rollback-prod` fails, manual rollback:

```bash
# 1. SSH to production
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19

# 2. Navigate to project
cd /home/ubuntu/TimeTracking-Clean

# 3. Checkout previous commit
git fetch origin
git checkout <previous-commit-hash>

# 4. Rebuild
cd server
npm install
npm run build

# 5. Restart PM2
pm2 restart timetracking-server

# 6. Verify
curl http://localhost:3000/api/health
```

---

**Last Updated:** 2026-02-11
**Emergency Use:** Production-only rollback mechanism
**Related Commands:** `/promote-to-prod`, `/sync-green`
