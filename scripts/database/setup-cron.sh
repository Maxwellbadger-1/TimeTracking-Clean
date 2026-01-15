#!/bin/bash
# Setup Cron Job for Overtime Recalculation
# Run this ONCE on the production server to enable automatic daily overtime calculation

echo "🔧 Setting up automatic overtime recalculation cron job..."

# Cron job that runs daily at 3 AM (when no users are active)
CRON_COMMAND="0 3 * * * cd /home/ubuntu/TimeTracking-Clean/server && npx tsx scripts/fix-overtime.ts >> /home/ubuntu/logs/overtime-fix.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "fix-overtime.ts"; then
  echo "⚠️  Cron job already exists!"
  echo "Current crontab:"
  crontab -l | grep "fix-overtime.ts"
else
  # Add cron job to crontab
  (crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -
  echo "✅ Cron job added successfully!"
  echo ""
  echo "📋 Cron job details:"
  echo "  - Runs daily at 3:00 AM (server time)"
  echo "  - Recalculates overtime for all users"
  echo "  - Logs to: /home/ubuntu/logs/overtime-fix.log"
  echo ""
  echo "🔍 Verify with: crontab -l"
  echo "📊 Check logs with: tail -f /home/ubuntu/logs/overtime-fix.log"
fi

# Create log directory if it doesn't exist
mkdir -p /home/ubuntu/logs

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify cron job: crontab -l"
echo "2. Test manually: cd /home/ubuntu/TimeTracking-Clean/server && npx tsx scripts/fix-overtime.ts"
echo "3. Wait for tomorrow 3 AM or trigger manually"
