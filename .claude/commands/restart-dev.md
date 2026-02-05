---
description: Restart development environment (stop and start server + desktop)
tags: [dev, restart, server, desktop]
---

# Restart Development Environment

Stop all running processes and restart the development environment (server + desktop app).

## Step 1: Kill all processes on ports 3000 and 5173

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
echo "Ports freed"
```

## Step 2: Start server in background

```bash
cd server && npm start
```

Run this command in the background using the Bash tool with `run_in_background: true`.

## Step 3: Start desktop app in background

```bash
cd desktop && npm run dev
```

Run this command in the background using the Bash tool with `run_in_background: true`.

## Step 4: Wait and verify

Wait 5 seconds, then check:

```bash
sleep 5
curl -s http://localhost:3000/api/health
echo "Desktop should be running on http://localhost:1420"
```

**Expected output:**
- Server: `{"status":"ok","message":"TimeTracacking Server is running",...}`
- Desktop: Running on http://localhost:1420 (Vite dev server)
