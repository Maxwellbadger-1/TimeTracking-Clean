# Switch Desktop App to Green Server (Staging)

**Command:** `/green`

**Purpose:** Switches the Desktop App (localhost:1420) to connect to the Green Server (Staging) with real production data

---

## What this command does:

1. Copies `.env.staging` to `.env` in the `desktop/` directory
2. Displays the current configuration
3. Reminds you to restart the Desktop App
4. Tests connectivity to Green Server

---

## Execute the switch:

```bash
cd desktop
cp .env.staging .env
echo "✅ Desktop App → Green Server (Staging)"
echo ""
echo "Current configuration:"
cat .env
echo ""
echo "🔍 Testing Green Server connectivity..."
curl -s http://129.159.8.19:3001/api/health || echo "⚠️ Green Server not reachable!"
echo ""
echo "🔄 Restart Desktop App with: npm run dev"
```

---

## Details:

**Target Server:** http://129.159.8.19:3001
**Port:** 3001 (Green Server)
**Database:** staging.db (Production snapshot with REAL data)
**PM2 Process:** timetracking-staging
**Use Case:** Pre-production testing with realistic data

**Environment Variables:**
- `VITE_API_URL=http://129.159.8.19:3001/api`
- `VITE_PORT=1420`
- `VITE_ENV=staging`

---

## Key Features:

- **Real Production Data:** staging.db is a 1:1 copy of production.db
- **Weekly Sync:** Automatic sync every Sunday at 2:00 AM
- **No Anonymization:** Full data visibility for comprehensive testing
- **Isolated Environment:** Separate from Blue Server (production)

---

## When to use Green Server:

1. **Bug Reproduction:** Test bugs with real production data
2. **Migration Testing:** Verify database migrations before production
3. **Feature Testing:** Validate features with realistic datasets
4. **Pre-Production QA:** Final testing before deploying to Blue (production)

---

## Next Steps:

After running this command:
1. Stop the Desktop App if running (Ctrl+C)
2. Start it again: `npm run dev`
3. The app will now connect to Green Server (Port 3001)
4. Login with your production credentials
5. Test features with real production data

---

## Important Notes:

- Green Server has separate PM2 process from production
- Changes to staging.db do NOT affect production.db
- Green Server restarts automatically on `staging` branch push
- Database sync logs: `/home/ubuntu/logs/db-sync.log`

---

## Health Check:

Verify Green Server is running:
```bash
curl http://129.159.8.19:3001/api/health
# Expected: {"status":"ok","message":"TimeTracking Server is running"}
```

View server logs:
```bash
ssh ubuntu@129.159.8.19
pm2 logs timetracking-staging
```
