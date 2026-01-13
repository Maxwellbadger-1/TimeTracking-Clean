---
description: Restart development environment (stop and start server + desktop)
tags: [dev, restart, server, desktop]
---

# Restart Development Environment

Stop all running processes and restart the development environment (server + desktop app).

Execute the following command:

```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean && bash shortcuts/stop-dev.sh && sleep 3 && bash shortcuts/SIMPLE-START.sh
```

Wait for the processes to start up and confirm that:
1. Server is running on http://localhost:3000
2. Desktop app is running on http://localhost:5173

Check the status with:
```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:5173
```
