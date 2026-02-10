# Switch Desktop App to Development Environment

**Command:** `/dev`

**Purpose:** Switches the Desktop App (localhost:1420) to connect to the local development server

---

## What this command does:

1. Copies `.env.development` to `.env` in the `desktop/` directory
2. Displays the current configuration
3. Reminds you to restart the Desktop App

---

## Execute the switch:

```bash
cd desktop
cp .env.development .env
echo "✅ Desktop App → Development (localhost:3000)"
echo ""
echo "Current configuration:"
cat .env
echo ""
echo "🔄 Restart Desktop App with: npm run dev"
```

---

## Details:

**Target Server:** localhost:3000
**Database:** development.db (small test dataset)
**Use Case:** Fast local development and testing

**Environment Variables:**
- `VITE_API_URL=http://localhost:3000/api`
- `VITE_PORT=1420`
- `VITE_ENV=development`

---

## Next Steps:

After running this command:
1. Stop the Desktop App if running (Ctrl+C)
2. Start it again: `npm run dev`
3. The app will now connect to your local development server
