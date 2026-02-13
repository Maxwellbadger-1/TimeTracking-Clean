---
description: Clean shell environment variables (VITE_*)
tags: [env, debug, utility]
---

# Clean Environment Variables

Utility command to inspect and clean shell environment variables that may interfere with Vite development.

## What this command does:

1. **Shows current VITE_* variables** (diagnostic)
2. **Clears problematic variables** (VITE_API_URL)
3. **Verifies cleanup** (final status)

---

## Execute cleanup:

```bash
echo "════════════════════════════════════════════"
echo "🔍 VITE Environment Variable Cleanup"
echo "════════════════════════════════════════════"
echo ""

# Step 1: Show current state
echo "📋 Current VITE environment variables:"
VITE_VARS=$(printenv | grep VITE || true)
if [ -z "$VITE_VARS" ]; then
  echo "   ✅ None found (environment is clean)"
else
  echo "$VITE_VARS" | sed 's/^/   /'
fi

echo ""

# Step 2: Clear problematic variables
if [ ! -z "$VITE_API_URL" ]; then
  echo "🧹 Clearing VITE_API_URL..."
  echo "   Old value: $VITE_API_URL"
  unset VITE_API_URL
  echo "   ✅ Cleared!"
else
  echo "ℹ️  VITE_API_URL is not set (OK)"
fi

echo ""

# Step 3: Verify cleanup
echo "✅ Final status:"
FINAL_VARS=$(printenv | grep VITE || true)
if [ -z "$FINAL_VARS" ]; then
  echo "   ✅ All clean! No VITE variables in shell."
else
  echo "   Remaining VITE variables (safe):"
  echo "$FINAL_VARS" | sed 's/^/   /'
fi

echo ""
echo "════════════════════════════════════════════"
```

---

## Details:

**Purpose:** Diagnostic & cleanup utility for environment variable conflicts

**Use Cases:**
- Debug environment configuration issues
- Clean up after manual `export VITE_API_URL=...` commands
- Verify environment before running `/dev` or `/restart-dev`

**Safe Variables:**
- `VITE_API_URL_PRODUCTION` - OK (different name, won't interfere)
- Other `VITE_*` variables - Usually safe

**Problematic Variables:**
- `VITE_API_URL` - Overrides ALL .env files! Must be cleared.

---

## When to use:

```bash
# Scenario 1: Desktop app connects to wrong server
# → Run /clean-env, then /dev

# Scenario 2: Want to verify environment is clean
# → Run /clean-env (diagnostic)

# Scenario 3: After manual export commands
export VITE_API_URL=http://test:3000/api  # ❌ Bad practice
# → Run /clean-env to undo
```

---

## Related Commands:

- `/dev` - Now includes automatic cleanup
- `/restart-dev` - Now includes automatic cleanup
- `/green` - Staging environment (also checks variables)

**Note:** You usually don't need this command anymore, since `/dev` and `/restart-dev` now auto-clean! But it's useful for debugging.

---

**Last Updated:** 2026-02-13
**Auto-Clean:** ✅ Automatic in /dev and /restart-dev
**Safe to run:** ✅ Read-only diagnostic + cleanup only
