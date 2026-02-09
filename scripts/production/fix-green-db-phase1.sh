#!/bin/bash
#
# Phase 1: Sofort-Fix für GREEN Database
#
# Führt Migration auf GREEN Production DB aus
# Zeitaufwand: ~15 Minuten
# Risiko: Niedrig (Backups werden erstellt)
#
# Usage:
#   ./scripts/production/fix-green-db-phase1.sh
#

set -e  # Exit on error

echo ""
echo "🔄 Phase 1: GREEN Database Sofort-Fix"
echo "======================================"
echo ""
echo "⚠️  Dieses Script führt folgende Aktionen aus:"
echo "   1. Backup von GREEN und BLUE DBs erstellen"
echo "   2. Migration auf GREEN DB ausführen"
echo "   3. Schema validieren"
echo "   4. Server neu starten"
echo "   5. Health Check"
echo ""
echo "📍 Ziel Server: 129.159.8.19 (Oracle Cloud)"
echo "📁 GREEN DB: /home/ubuntu/TimeTracking-Clean/server/database.db"
echo ""
read -p "Fortfahren? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Abgebrochen."
    exit 1
fi

echo ""
echo "🔐 Verbinde mit Production Server..."

# SSH und alle Befehle ausführen
ssh ubuntu@129.159.8.19 'bash -s' << 'ENDSSH'
set -e

echo ""
echo "📍 Auf Server: $(hostname)"
echo "👤 User: $(whoami)"
echo "📂 Working Dir: $(pwd)"
echo ""

# Schritt 1: Backups erstellen
echo "💾 Schritt 1/5: Backups erstellen..."
cd /home/ubuntu
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "   Backup GREEN DB..."
cp TimeTracking-Clean/server/database.db \
   TimeTracking-Clean/server/database.db.backup.$TIMESTAMP

echo "   Backup BLUE DB (zur Sicherheit)..."
cp TimeTracking-BLUE/server/database.db \
   TimeTracking-BLUE/server/database.db.backup.$TIMESTAMP

echo "   ✅ Backups erstellt:"
ls -lh TimeTracking-Clean/server/database.db.backup.$TIMESTAMP
ls -lh TimeTracking-BLUE/server/database.db.backup.$TIMESTAMP
echo ""

# Schritt 2: Migration ausführen
echo "🔄 Schritt 2/5: Migration ausführen..."
cd /home/ubuntu/TimeTracking-Clean/server

echo "   Führe Migrations aus..."
NODE_ENV=production npm run migrate:prod

echo ""

# Schritt 3: Schema validieren
echo "🔍 Schritt 3/5: Schema validieren..."
NODE_ENV=production npm run validate:schema

echo ""

# Schritt 4: Server neu starten
echo "🔄 Schritt 4/5: Server neu starten..."
pm2 restart timetracking-server

echo "   Warte 5 Sekunden bis Server hochgefahren ist..."
sleep 5

echo "   PM2 Status:"
pm2 list

echo ""

# Schritt 5: Health Check
echo "🏥 Schritt 5/5: Health Check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Health Check passed (HTTP $HTTP_CODE)"

    # Zeige Health Response
    echo ""
    echo "   Health Response:"
    curl -s http://localhost:3000/api/health | jq '.' || curl -s http://localhost:3000/api/health
else
    echo "   ❌ Health Check failed (HTTP $HTTP_CODE)"
    echo ""
    echo "   Server Logs (letzte 30 Zeilen):"
    pm2 logs timetracking-server --lines 30 --nostream
    exit 1
fi

echo ""
echo "=================================================="
echo "✅ Phase 1 erfolgreich abgeschlossen!"
echo "=================================================="
echo ""
echo "📋 Was wurde gemacht:"
echo "   1. ✅ Backups erstellt (Timestamp: $TIMESTAMP)"
echo "   2. ✅ Migration 20260208_add_position_column.sql ausgeführt"
echo "   3. ✅ Schema validiert (position column existiert)"
echo "   4. ✅ Server neu gestartet"
echo "   5. ✅ Health Check bestanden"
echo ""
echo "💾 Backup Location:"
echo "   GREEN: /home/ubuntu/TimeTracking-Clean/server/database.db.backup.$TIMESTAMP"
echo "   BLUE:  /home/ubuntu/TimeTracking-BLUE/server/database.db.backup.$TIMESTAMP"
echo ""
echo "🎯 Nächste Schritte:"
echo "   1. Teste Production App (localhost:1420)"
echo "   2. Login mit echtem User"
echo "   3. Prüfe ob /api/auth/me funktioniert (kein 500 Error)"
echo "   4. Wenn alles OK → Phase 2 planen (Shared Database Setup)"
echo ""
echo "📚 Dokumentation:"
echo "   - Vollständiger Plan: BLUE_GREEN_FIX_PLAN.md"
echo "   - Next Steps: Phase 2 ausführen (30 Min, optional)"
echo ""

ENDSSH

echo ""
echo "✅ Script erfolgreich abgeschlossen!"
echo ""
echo "🧪 Jetzt testen:"
echo "   cd desktop && npm run dev"
echo "   Login → Zeiterfassung → Überstunden prüfen"
echo ""
