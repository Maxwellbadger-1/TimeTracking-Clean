#!/bin/bash
#
# Phase 2: Shared Database Setup
#
# Erstellt eine gemeinsame Datenbank für BLUE und GREEN Environments
# Zeitaufwand: ~30 Minuten
# Risiko: Mittel (Backups werden erstellt, Rollback möglich)
#
# WICHTIG: Phase 1 muss erfolgreich abgeschlossen sein!
#
# Usage:
#   ./scripts/production/fix-green-db-phase2.sh
#

set -e  # Exit on error

echo ""
echo "🔗 Phase 2: Shared Database Setup"
echo "=================================="
echo ""
echo "⚠️  WICHTIG: Dieses Script macht folgendes:"
echo "   1. Backup beider DBs erstellen"
echo "   2. Prüfen welche DB mehr/aktuelle Daten hat"
echo "   3. Shared DB erstellen (aus der vollständigeren DB)"
echo "   4. Beide Server stoppen"
echo "   5. Symlinks zu Shared DB erstellen"
echo "   6. GREEN Server neu starten"
echo "   7. Testen ob alles funktioniert"
echo ""
echo "📍 Ziel Server: 129.159.8.19 (Oracle Cloud)"
echo "📁 Shared DB: /home/ubuntu/database-shared.db"
echo ""
echo "✅ Vorteile:"
echo "   - Nur noch EINE Datenbank zu pflegen"
echo "   - Migrations nur 1x ausführen"
echo "   - Keine Sync-Probleme mehr"
echo "   - Kein Datenverlust beim Environment-Switch"
echo ""
read -p "Phase 1 erfolgreich abgeschlossen? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Bitte erst Phase 1 ausführen!"
    echo "   ./scripts/production/fix-green-db-phase1.sh"
    exit 1
fi

echo ""
read -p "Fortfahren mit Phase 2? (y/n) " -n 1 -r
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

# Schritt 1: Backups erstellen
echo "💾 Schritt 1/8: Backups erstellen..."
cd /home/ubuntu
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "   Backup GREEN DB..."
cp TimeTracking-Clean/server/database.db \
   TimeTracking-Clean/server/database.db.backup.$TIMESTAMP

echo "   Backup BLUE DB..."
cp TimeTracking-BLUE/server/database.db \
   TimeTracking-BLUE/server/database.db.backup.$TIMESTAMP

echo "   ✅ Backups erstellt (Timestamp: $TIMESTAMP)"
echo ""

# Schritt 2: DB-Größen und User vergleichen
echo "📊 Schritt 2/8: Datenbanken analysieren..."

echo "   BLUE DB:"
BLUE_SIZE=$(ls -lh TimeTracking-BLUE/server/database.db | awk '{print $5}')
BLUE_USERS=$(sqlite3 TimeTracking-BLUE/server/database.db \
  "SELECT COUNT(*) FROM users WHERE deletedAt IS NULL;")
echo "     - Größe: $BLUE_SIZE"
echo "     - Aktive Users: $BLUE_USERS"

echo ""
echo "   GREEN DB:"
GREEN_SIZE=$(ls -lh TimeTracking-Clean/server/database.db | awk '{print $5}')
GREEN_USERS=$(sqlite3 TimeTracking-Clean/server/database.db \
  "SELECT COUNT(*) FROM users WHERE deletedAt IS NULL;")
echo "     - Größe: $GREEN_SIZE"
echo "     - Aktive Users: $GREEN_USERS"

echo ""

# Entscheiden welche DB als Basis
if [ "$BLUE_USERS" -gt "$GREEN_USERS" ]; then
    SOURCE_DB="TimeTracking-BLUE/server/database.db"
    SOURCE_NAME="BLUE"
    echo "   ✅ Entscheidung: BLUE DB als Basis (mehr User)"
elif [ "$GREEN_USERS" -gt "$BLUE_USERS" ]; then
    SOURCE_DB="TimeTracking-Clean/server/database.db"
    SOURCE_NAME="GREEN"
    echo "   ✅ Entscheidung: GREEN DB als Basis (mehr User)"
else
    # Gleiche User-Anzahl → Neuere DB nehmen (mtime)
    BLUE_MTIME=$(stat -c %Y TimeTracking-BLUE/server/database.db 2>/dev/null || stat -f %m TimeTracking-BLUE/server/database.db)
    GREEN_MTIME=$(stat -c %Y TimeTracking-Clean/server/database.db 2>/dev/null || stat -f %m TimeTracking-Clean/server/database.db)

    if [ "$GREEN_MTIME" -gt "$BLUE_MTIME" ]; then
        SOURCE_DB="TimeTracking-Clean/server/database.db"
        SOURCE_NAME="GREEN"
        echo "   ✅ Entscheidung: GREEN DB als Basis (neuer)"
    else
        SOURCE_DB="TimeTracking-BLUE/server/database.db"
        SOURCE_NAME="BLUE"
        echo "   ✅ Entscheidung: BLUE DB als Basis (neuer)"
    fi
fi

echo ""

# Schritt 3: Shared DB erstellen
echo "🔗 Schritt 3/8: Shared Database erstellen..."
echo "   Quelle: $SOURCE_NAME DB"
echo "   Ziel: /home/ubuntu/database-shared.db"

cp "$SOURCE_DB" /home/ubuntu/database-shared.db

# Permissions setzen
chmod 644 /home/ubuntu/database-shared.db
chown ubuntu:ubuntu /home/ubuntu/database-shared.db

echo "   ✅ Shared DB erstellt:"
ls -lh /home/ubuntu/database-shared.db

echo ""

# Schritt 4: Prüfe PM2 Status
echo "📊 Schritt 4/8: PM2 Status prüfen..."
pm2 list

echo ""

# Schritt 5: Server stoppen
echo "🛑 Schritt 5/8: Server stoppen..."
echo "   Stoppe GREEN Server (timetracking-server)..."
pm2 stop timetracking-server || echo "   (bereits gestoppt)"

echo "   Stoppe BLUE Server (falls läuft)..."
pm2 stop timetracking-blue 2>/dev/null || echo "   (nicht gefunden oder bereits gestoppt)"

echo "   ✅ Server gestoppt"
pm2 list

echo ""

# Schritt 6: Symlinks erstellen
echo "🔗 Schritt 6/8: Symlinks erstellen..."

# Alte DBs umbenennen (NICHT löschen!)
echo "   Benenne alte DBs um..."
mv TimeTracking-BLUE/server/database.db \
   TimeTracking-BLUE/server/database.db.OLD || true

mv TimeTracking-Clean/server/database.db \
   TimeTracking-Clean/server/database.db.OLD || true

# Symlinks erstellen
echo "   Erstelle Symlinks..."
ln -s /home/ubuntu/database-shared.db \
      /home/ubuntu/TimeTracking-BLUE/server/database.db

ln -s /home/ubuntu/database-shared.db \
      /home/ubuntu/TimeTracking-Clean/server/database.db

echo "   ✅ Symlinks erstellt:"
ls -lh TimeTracking-BLUE/server/database.db
ls -lh TimeTracking-Clean/server/database.db

echo ""

# Schritt 7: GREEN Server neu starten
echo "🚀 Schritt 7/8: GREEN Server neu starten..."
pm2 start /home/ubuntu/TimeTracking-Clean/server/dist/server.js \
  --name timetracking-server \
  --cwd /home/ubuntu/TimeTracking-Clean/server \
  --time \
  --update-env

pm2 save

echo "   Warte 5 Sekunden bis Server hochgefahren ist..."
sleep 5

echo "   PM2 Status:"
pm2 list

echo ""

# Schritt 8: Health Check
echo "🏥 Schritt 8/8: Health Check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Health Check passed (HTTP $HTTP_CODE)"

    echo ""
    echo "   Health Response:"
    curl -s http://localhost:3000/api/health | jq '.' || curl -s http://localhost:3000/api/health
else
    echo "   ❌ Health Check failed (HTTP $HTTP_CODE)"
    echo ""
    echo "   ⚠️  ROLLBACK ERFORDERLICH!"
    echo "   Führe aus: ./scripts/production/rollback-phase2.sh"
    exit 1
fi

echo ""
echo "======================================================"
echo "✅ Phase 2 erfolgreich abgeschlossen!"
echo "======================================================"
echo ""
echo "🎉 Was wurde erreicht:"
echo "   1. ✅ Shared Database erstellt (aus $SOURCE_NAME DB)"
echo "   2. ✅ Symlinks von BLUE und GREEN zu Shared DB"
echo "   3. ✅ GREEN Server läuft mit Shared DB"
echo "   4. ✅ Health Check bestanden"
echo ""
echo "💾 Backup Location:"
echo "   - /home/ubuntu/TimeTracking-Clean/server/database.db.backup.$TIMESTAMP"
echo "   - /home/ubuntu/TimeTracking-BLUE/server/database.db.backup.$TIMESTAMP"
echo ""
echo "📁 Alte DBs (für Rollback):"
echo "   - /home/ubuntu/TimeTracking-Clean/server/database.db.OLD"
echo "   - /home/ubuntu/TimeTracking-BLUE/server/database.db.OLD"
echo ""
echo "🔗 Shared Database:"
echo "   - Location: /home/ubuntu/database-shared.db"
echo "   - Users: $BLUE_USERS (oder $GREEN_USERS, je nachdem)"
echo "   - Symlink BLUE: TimeTracking-BLUE/server/database.db -> shared"
echo "   - Symlink GREEN: TimeTracking-Clean/server/database.db -> shared"
echo ""
echo "🎯 Vorteile ab jetzt:"
echo "   ✅ Nur noch EINE Datenbank zu pflegen"
echo "   ✅ Migrations nur 1x ausführen (statt 2x)"
echo "   ✅ Keine Sync-Probleme mehr zwischen BLUE/GREEN"
echo "   ✅ Kein Datenverlust beim Environment-Switch"
echo "   ✅ Einfacheres Deployment"
echo ""
echo "🧪 Nächste Schritte:"
echo "   1. Teste Production App ausführlich:"
echo "      - Login"
echo "      - Zeiterfassung"
echo "      - Überstunden prüfen"
echo "      - User anlegen/bearbeiten"
echo "   2. Wenn alles OK → Alte .OLD DBs können gelöscht werden"
echo "   3. Wenn Probleme → Rollback mit rollback-phase2.sh"
echo ""
echo "📚 Dokumentation aktualisieren:"
echo "   - PROJECT_STATUS.md → Phase 2 complete"
echo "   - ARCHITECTURE.md → Deployment View (Shared DB)"
echo ""

ENDSSH

echo ""
echo "✅ Phase 2 Script erfolgreich abgeschlossen!"
echo ""
echo "🧪 WICHTIG: Jetzt ausführlich testen!"
echo "   cd desktop && npm run dev"
echo "   Login → Alle Funktionen durchgehen"
echo ""
echo "📋 Bei Problemen:"
echo "   ./scripts/production/rollback-phase2.sh"
echo ""
