#!/bin/bash
#
# Database Schema Monitoring Script
#
# Prüft regelmäßig ob das DB-Schema korrekt ist
# Kann via Cron täglich laufen
# Sendet Alert bei Diskrepanzen
#
# Usage:
#   ./scripts/production/monitor-db-schema.sh          # Manual run
#   ./scripts/production/monitor-db-schema.sh --cron   # Cron mode (silent unless error)
#

CRON_MODE=false
if [[ "$1" == "--cron" ]]; then
    CRON_MODE=true
fi

# Nur Header ausgeben wenn nicht Cron Mode
if [ "$CRON_MODE" = false ]; then
    echo ""
    echo "📊 Database Schema Monitor"
    echo "=========================="
    echo ""
fi

# SSH zum Server und Schema prüfen
RESULT=$(ssh ubuntu@129.159.8.19 'bash -s' << 'ENDSSH'
cd /home/ubuntu/TimeTracking-Clean/server

# Run schema validation
OUTPUT=$(NODE_ENV=production npm run validate:schema 2>&1)
EXIT_CODE=$?

# Output both
echo "$OUTPUT"
exit $EXIT_CODE
ENDSSH
)

VALIDATION_EXIT_CODE=$?

# Wenn Cron Mode: Nur ausgeben bei Fehler
if [ "$CRON_MODE" = true ]; then
    if [ $VALIDATION_EXIT_CODE -ne 0 ]; then
        echo "❌ [$(date)] Database Schema Validation FAILED on Production!"
        echo ""
        echo "$RESULT"
        echo ""
        echo "🚨 ACTION REQUIRED:"
        echo "   1. SSH to server: ssh ubuntu@129.159.8.19"
        echo "   2. Check schema: cd /home/ubuntu/TimeTracking-Clean/server && npm run validate:schema"
        echo "   3. Run migrations if needed: NODE_ENV=production npm run migrate:prod"
        echo ""

        # Wenn Email konfiguriert, sende Alert
        # mail -s "ALERT: Production DB Schema Invalid" admin@example.com <<< "$RESULT"
    fi
    exit $VALIDATION_EXIT_CODE
fi

# Interactive Mode: Immer ausgeben
echo "$RESULT"
echo ""

if [ $VALIDATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Schema Validation: PASSED"
    echo ""
    echo "📊 Database Status: Healthy"
    echo "🕒 Checked at: $(date)"
else
    echo "❌ Schema Validation: FAILED"
    echo ""
    echo "🚨 ACTION REQUIRED:"
    echo "   1. Check output above for missing columns"
    echo "   2. SSH to server: ssh ubuntu@129.159.8.19"
    echo "   3. Run migrations: cd ~/TimeTracking-Clean/server && NODE_ENV=production npm run migrate:prod"
    echo ""
fi

exit $VALIDATION_EXIT_CODE
