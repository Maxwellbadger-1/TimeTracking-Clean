# Quick Reference: 3-Tier Development Workflow

**One-Page Cheat Sheet for TimeTracking Development**

**Last Updated:** 2026-02-11

---

## 🚀 Daily Development (6 Steps)

```bash
# 1. Pull & Branch
git checkout staging && git pull origin staging
git checkout -b feature/my-feature

# 2. Develop Locally
cd server && npm run dev                 # localhost:3000
cd desktop && /dev && npm run dev        # Desktop App

# 3. Commit
git add . && git commit -m "feat: ..."

# 4. Push to Staging
git checkout staging && git merge feature/my-feature
git push origin staging                  # Auto-deploy Green Server

# 5. Test on Staging
cd desktop && /green && npm run dev      # Test with real data

# 6. Deploy to Production
git checkout main && git merge staging
git push origin main                     # Auto-deploy Blue Server
```

---

## 🗄️ Code vs. Data Flow

```
CODE:  Development → Staging → Production  (git push)
DATA:  Production → Staging → Development  (database sync)
```

**⚠️ NEVER mix them!**
- Code deploys: Only schema changes, NO data
- Data syncs: Only for testing, NO production override

---

## 💾 Database Sync

```bash
/sync-green     # Production → Staging (with backup)
/sync-dev       # Staging → Development (planned, use scp for now)
```

---

## 🖥️ Environment Switching

```bash
/dev            # localhost:3000 (Test data)
/green          # Green Server:3001 (Prod snapshot)
```

---

## 🔧 Troubleshooting

```bash
# Desktop connects to wrong server?
printenv | grep VITE_API_URL  # If output: Shell override!
unset VITE_API_URL && /dev    # Fix & restart

# "no such column" error?
/sync-green                   # Update Green Server DB
/sync-dev                     # Update Development DB

# Health checks
curl http://129.159.8.19:3001/api/health  # Green
curl http://129.159.8.19:3000/api/health  # Blue
```

---

## ✅ Best Practices

- ✅ ALWAYS test on Green Server before Production
- ✅ ALWAYS use `/dev` and `/green` commands
- ❌ NEVER `export VITE_API_URL=...`
- ❌ NEVER push directly to `main`
- ❌ NEVER skip Staging deployment

---

## 📚 Full Documentation

- **DEVELOPMENT_WORKFLOW.md** - Complete workflow guide
- **ENV.md** - Environment configuration
- **CLAUDE.md** - AI development guidelines
- **PROJECT_STATUS.md** - Current status

---

**Need help?** Check DEVELOPMENT_WORKFLOW.md for detailed instructions.
