#!/bin/bash
#
# Rollback Script für Phase 2 (Shared Database)
#
# Stellt die ursprünglichen separaten DBs wieder her
# Zeitaufwand: ~10 Minuten
# Risiko: Niedrig (Backups und .OLD Dateien werden verwendet)
#
# WICHTIG: Nur ausführen wenn Phase 2 Probleme verursacht!
#
# Usage:
#   ./scripts/production/rollback-phase2.sh
#

set -e  # Exit on error

echo ""
echo "🔙 Rollback Phase 2: Shared Database → Separate DBs"
echo "===================================================="
echo ""
echo "⚠️  ACHTUNG: Dieses Script macht folgendes:"
echo "   1. GREEN Server stoppen"
echo "   2. Symlinks entfernen"
echo "   3. Alte .OLD DBs wiederherstellen"
echo "   4. GREEN Server neu starten"
echo "   5. Health Check"
echo ""
echo "📍 Ziel Server: 129.159.8.19 (Oracle Cloud)"
echo ""
echo "❓ Warum Rollback?"
echo "   - Shared Database verursacht Probleme"
echo "   - Zurück zum vorherigen Zustand (separate DBs)"
echo ""
read -p "Rollback durchführen? (y/n) " -n 1 -r
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
echo ""

# Schritt 1: Backup der Shared DB (zur Sicherheit)
echo "💾 Schritt 1/6: Backup der Shared DB..."
cd /home/ubuntu
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -f database-shared.db ]; then
    cp database-shared.db database-shared.db.backup.$TIMESTAMP
    echo "   ✅ Shared DB gesichert: database-shared.db.backup.$TIMESTAMP"
else
    echo "   ⚠️  Shared DB nicht gefunden (war vielleicht schon removed)"
fi

echo ""

# Schritt 2: Server stoppen
echo "🛑 Schritt 2/6: Server stoppen..."
pm2 stop timetracking-server || echo "   (bereits gestoppt)"
pm2 stop timetracking-blue 2>/dev/null || echo "   (nicht gefunden)"

echo "   ✅ Server gestoppt"

echo ""

# Schritt 3: Prüfe .OLD Dateien
echo "🔍 Schritt 3/6: Prüfe .OLD Dateien..."

if [ ! -f TimeTracking-Clean/server/database.db.OLD ]; then
    echo "   ❌ ERROR: TimeTracking-Clean/server/database.db.OLD nicht gefunden!"
    echo "   Kann nicht zurückrollen ohne Backup!"
    echo ""
    echo "   Verfügbare Backups:"
    ls -lh TimeTracking-Clean/server/database.db.backup.* 2>/dev/null || echo "   Keine gefunden"
    echo ""
    echo "   Manuell wiederherstellen mit:"
    echo "   cp TimeTracking-Clean/server/database.db.backup.TIMESTAMP database.db"
    exit 1
fi

if [ ! -f TimeTracking-BLUE/server/database.db.OLD ]; then
    echo "   ⚠️  WARNING: TimeTracking-BLUE/server/database.db.OLD nicht gefunden"
    echo "   BLUE DB kann nicht wiederhergestellt werden"
fi

echo "   ✅ .OLD Dateien gefunden"

echo ""

# Schritt 4: Symlinks entfernen
echo "🔗 Schritt 4/6: Symlinks entfernen..."

if [ -L TimeTracking-Clean/server/database.db ]; then
    echo "   Entferne GREEN Symlink..."
    rm TimeTracking-Clean/server/database.db
    echo "   ✅ GREEN Symlink entfernt"
else
    echo "   ⚠️  GREEN database.db ist kein Symlink (überspringen)"
fi

if [ -L TimeTracking-BLUE/server/database.db ]; then
    echo "   Entferne BLUE Symlink..."
    rm TimeTracking-BLUE/server/database.db
    echo "   ✅ BLUE Symlink entfernt"
else
    echo "   ⚠️  BLUE database.db ist kein Symlink (überspringen)"
fi

echo ""

# Schritt 5: .OLD DBs wiederherstellen
echo "🔄 Schritt 5/6: Alte DBs wiederherstellen..."

echo "   Stelle GREEN DB wieder her..."
mv TimeTracking-Clean/server/database.db.OLD \
   TimeTracking-Clean/server/database.db

echo "   ✅ GREEN DB wiederhergestellt"

if [ -f TimeTracking-BLUE/server/database.db.OLD ]; then
    echo "   Stelle BLUE DB wieder her..."
    mv TimeTracking-BLUE/server/database.db.OLD \
       TimeTracking-BLUE/server/database.db
    echo "   ✅ BLUE DB wiederhergestellt"
fi

echo ""

# Schritt 6: GREEN Server neu starten
echo "🚀 Schritt 6/6: GREEN Server neu starten..."
pm2 start /home/ubuntu/TimeTracking-Clean/server/dist/server.js \
  --name timetracking-server \
  --cwd /home/ubuntu/TimeTracking-Clean/server \
  --time \
  --update-env || pm2 restart timetracking-server

pm2 save

echo "   Warte 5 Sekunden bis Server hochgefahren ist..."
sleep 5

echo "   PM2 Status:"
pm2 list

echo ""

# Health Check
echo "🏥 Health Check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Health Check passed (HTTP $HTTP_CODE)"

    echo ""
    echo "   Health Response:"
    curl -s http://localhost:3000/api/health | jq '.' || curl -s http://localhost:3000/api/health
else
    echo "   ❌ Health Check failed (HTTP $HTTP_CODE)"
    echo ""
    echo "   Server Logs:"
    pm2 logs timetracking-server --lines 50 --nostream
    exit 1
fi

echo ""
echo "======================================================"
echo "✅ Rollback erfolgreich abgeschlossen!"
echo "======================================================"
echo ""
echo "🔙 Was wurde gemacht:"
echo "   1. ✅ Shared DB gesichert (backup.$TIMESTAMP)"
echo "   2. ✅ Server gestoppt"
echo "   3. ✅ Symlinks entfernt"
echo "   4. ✅ Alte separate DBs wiederhergestellt"
echo "   5. ✅ GREEN Server neu gestartet"
echo "   6. ✅ Health Check bestanden"
echo ""
echo "📁 Aktueller Status:"
echo "   - GREEN: Nutzt wieder TimeTracking-Clean/server/database.db"
echo "   - BLUE: Nutzt wieder TimeTracking-BLUE/server/database.db"
echo "   - Shared DB: Backup unter database-shared.db.backup.$TIMESTAMP"
echo ""
echo "⚠️  Zurück zum alten Problem:"
echo "   - Zwei separate Datenbanken"
echo "   - Migrations müssen auf BEIDEN ausgeführt werden"
echo "   - Sync-Probleme können wieder auftreten"
echo ""
echo "💡 Empfehlung:"
echo "   1. Prüfe warum Shared DB Probleme hatte"
echo "   2. Fixe die Root Cause"
echo "   3. Versuche Phase 2 nochmal"
echo ""
echo "🧪 Nächste Schritte:"
echo "   1. Teste ob GREEN DB wieder funktioniert"
echo "   2. Analysiere was bei Phase 2 schief lief"
echo "   3. Optional: Versuche Phase 2 nochmal (nach Fix)"
echo ""

ENDSSH

echo ""
echo "✅ Rollback Script erfolgreich abgeschlossen!"
echo ""
echo "🧪 Teste jetzt die Production App:"
echo "   cd desktop && npm run dev"
echo ""
