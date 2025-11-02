# 🚀 Oracle Cloud Free Tier Setup - TimeTracking System

**Ziel:** Kostenlosen Remote Server in Frankfurt (Deutschland) einrichten für Multi-User TimeTracking

**Zeitaufwand:** ~30 Minuten
**Kosten:** €0 (Forever Free!)
**Standort:** Frankfurt, Germany (GDPR-konform)

---

## 📋 PHASE 1: Oracle Cloud Account erstellen (5 Minuten)

### Schritt 1.1: Account registrieren

1. **Gehe zu:** https://signup.cloud.oracle.com/
2. **Klick:** "Start for free"
3. **Ausfüllen:**
   - Land: Germany
   - Vorname/Nachname
   - E-Mail Adresse
   - Passwort (min. 8 Zeichen, Groß/Klein/Zahl)
4. **Wichtig:**
   - ✅ "Home Region": **Germany Central (Frankfurt)**
   - ✅ Kein Kreditkarten-Pflicht in DE!
5. **E-Mail bestätigen** (Check Posteingang)
6. **Cloud Console öffnen:** https://cloud.oracle.com/

**✅ Account fertig!**

---

### Schritt 1.2: Compute Instance erstellen (Ubuntu Server)

1. **In Cloud Console:**
   - Hamburger Menu (☰) → **Compute** → **Instances**
   - Klick: **"Create Instance"**

2. **Instance konfigurieren:**

   **Name:**
   ```
   timetracking-server
   ```

   **Placement:**
   - Availability Domain: `Germany Central (Frankfurt) - AD1`

   **Image and Shape:**
   - **Image:** `Canonical Ubuntu 22.04` (Latest)
   - **Shape:** Klick "Change Shape"
     - **AMD VM.Standard.E2.1.Micro** (Always Free!)
     - 1 OCPU, 1GB RAM ✅

   **Networking:**
   - VCN: `Default VCN` (automatisch erstellt)
   - Subnet: `Public Subnet` (wichtig!)
   - ✅ Assign a public IPv4 address

   **SSH Keys:**
   - ✅ Generate SSH Key Pair
   - **Wichtig:** Klick "Save Private Key" → Speicher als `timetracking-key.pem`
   - **Wichtig:** Klick "Save Public Key" → Speicher als `timetracking-key.pub`

3. **Klick:** "Create"

4. **Warten:** ~2 Minuten (Status: PROVISIONING → RUNNING)

5. **Public IP notieren:**
   - Instance Details → **Public IP Address**
   - Beispiel: `130.61.42.123`
   - **Notiere diese IP!** Du brauchst sie später!

**✅ Server erstellt!**

---

### Schritt 1.3: Firewall öffnen (Port 3000 + 80 + 443)

**Oracle Cloud Security List:**

1. **In Cloud Console:**
   - Hamburger Menu → **Networking** → **Virtual Cloud Networks**
   - Klick: `Default VCN`
   - Klick: `Public Subnet`
   - Under "Security Lists" → Klick: `Default Security List`

2. **Klick:** "Add Ingress Rules"

3. **Regel 1: HTTP (Port 80)**
   ```
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port Range: 80
   Description: HTTP for Let's Encrypt
   ```
   Klick: "Add Ingress Rule"

4. **Regel 2: HTTPS (Port 443)**
   ```
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port Range: 443
   Description: HTTPS
   ```
   Klick: "Add Ingress Rule"

5. **Regel 3: Node.js API (Port 3000)**
   ```
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port Range: 3000
   Description: TimeTracking API
   ```
   Klick: "Add Ingress Rule"

**✅ Firewall konfiguriert!**

---

### Schritt 1.4: SSH Verbindung testen

**Auf deinem Mac Terminal:**

```bash
# 1. Private Key Berechtigung setzen
chmod 400 ~/Downloads/timetracking-key.pem

# 2. Mit Server verbinden (ersetze IP mit deiner!)
ssh -i ~/Downloads/timetracking-key.pem ubuntu@130.61.42.123

# Erste Verbindung: "Are you sure?" → yes

# Du siehst jetzt:
# ubuntu@timetracking-server:~$
```

**✅ SSH funktioniert!**

---

## 📋 PHASE 2: Server Setup (10 Minuten)

**Alle Befehle auf dem Server ausführen (via SSH):**

### Schritt 2.1: System updaten

```bash
sudo apt update && sudo apt upgrade -y
```

---

### Schritt 2.2: Node.js 20 installieren

```bash
# Node.js 20.x Repository hinzufügen
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js installieren
sudo apt install -y nodejs

# Prüfen
node --version  # Should show: v20.x.x
npm --version   # Should show: 10.x.x
```

---

### Schritt 2.3: Git installieren

```bash
sudo apt install -y git
```

---

### Schritt 2.4: PM2 installieren (Process Manager)

```bash
# PM2 global installieren
sudo npm install -g pm2

# PM2 Auto-Start einrichten
pm2 startup systemd
# Kopiere den ausgegebenen Befehl und führe ihn aus!
# Beispiel: sudo env PATH=... pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

### Schritt 2.5: Firewall auf Server konfigurieren

```bash
# UFW (Uncomplicated Firewall) konfigurieren
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS
sudo ufw allow 3000   # Node.js API

# Firewall aktivieren
sudo ufw --force enable

# Status prüfen
sudo ufw status
```

**Output sollte sein:**
```
Status: active

To                         Action      From
--                         ------      ----
22                         ALLOW       Anywhere
80                         ALLOW       Anywhere
443                        ALLOW       Anywhere
3000                       ALLOW       Anywhere
```

**✅ Server-Setup fertig!**

---

## 📋 PHASE 3: Code deployen (5 Minuten)

### Schritt 3.1: GitHub Repository erstellen (Optional aber empfohlen!)

**Auf deinem Mac:**

```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean

# Git initialisieren (falls noch nicht)
git init

# .gitignore erstellen
cat > .gitignore << 'EOF'
node_modules/
dist/
*.db
*.log
.env
.DS_Store
EOF

# Commit
git add .
git commit -m "Initial commit - TimeTracking System"

# GitHub Repo erstellen auf github.com
# Dann:
git remote add origin https://github.com/DEIN-USERNAME/TimeTracking-Clean.git
git branch -M main
git push -u origin main
```

---

### Schritt 3.2: Code auf Server hochladen

**Option A: Via Git (empfohlen)**

Auf Server (SSH):
```bash
cd ~
git clone https://github.com/DEIN-USERNAME/TimeTracking-Clean.git
cd TimeTracking-Clean/server
```

**Option B: Via SCP (ohne Git)**

Auf deinem Mac:
```bash
# Code komprimieren
cd /Users/maximilianfegg/Desktop
tar -czf timetracking.tar.gz TimeTracking-Clean/

# Auf Server hochladen
scp -i ~/Downloads/timetracking-key.pem timetracking.tar.gz ubuntu@130.61.42.123:~/

# Auf Server entpacken (via SSH)
ssh -i ~/Downloads/timetracking-key.pem ubuntu@130.61.42.123
cd ~
tar -xzf timetracking.tar.gz
cd TimeTracking-Clean/server
```

---

### Schritt 3.3: Dependencies installieren

**Auf Server (im server/ Ordner):**

```bash
cd ~/TimeTracking-Clean/server

# Production Dependencies installieren
npm install --production

# TypeScript kompilieren (falls dist/ fehlt)
npm run build
```

---

### Schritt 3.4: Environment Variables setzen

```bash
# .env Datei erstellen
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=ÄNDERE-MICH-ZU-EINEM-SICHEREN-RANDOM-STRING-MIN-32-ZEICHEN
DATABASE_PATH=./database.db
EOF

# Sicheren Session Secret generieren
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output kopieren und in .env einfügen!
```

**Beispiel .env:**
```
NODE_ENV=production
PORT=3000
SESSION_SECRET=a7f8e9d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8
DATABASE_PATH=./database.db
```

---

### Schritt 3.5: Server mit PM2 starten

```bash
cd ~/TimeTracking-Clean/server

# PM2 starten
pm2 start dist/server.js --name timetracking-api

# Status prüfen
pm2 status

# Logs anschauen
pm2 logs timetracking-api

# PM2 Config speichern (für Auto-Restart)
pm2 save
```

**Du solltest sehen:**
```
✅ TimeTracking Server started
📡 Listening on http://localhost:3000
```

---

### Schritt 3.6: Testen

**Von deinem Mac Terminal:**

```bash
# Ersetze IP mit deiner Server-IP!
curl http://130.61.42.123:3000/api/health
```

**Expected Output:**
```json
{"status":"ok","message":"TimeTracking Server is running","version":"0.1.0","timestamp":"..."}
```

**✅ Server läuft!**

---

## 📋 PHASE 4: Code anpassen für Remote Server (2 Minuten)

**Auf deinem Mac - im Projekt:**

### Datei 1: Frontend API URL

**Datei:** `desktop/src/api/client.ts`

```typescript
// VORHER:
const API_BASE_URL = 'http://localhost:3000/api';

// NACHHER (ersetze IP mit deiner!):
const API_BASE_URL = 'http://130.61.42.123:3000/api';
```

---

### Datei 2: Backend CORS

**Datei:** `server/src/server.ts`

```typescript
// VORHER:
app.use(cors({
  origin: [
    'tauri://localhost',
    'https://tauri.localhost',
    'http://localhost:5173',
    'http://localhost:1420',
    'http://127.0.0.1:1420',
  ],
  credentials: true,
  // ...
}));

// NACHHER:
app.use(cors({
  origin: true, // Erlaubt ALLE Origins (für Desktop-Apps OK!)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));
```

**Speichern & Commit:**

```bash
git add .
git commit -m "feat: Remote server configuration"
git push
```

**Auf Server updaten:**

```bash
ssh -i ~/Downloads/timetracking-key.pem ubuntu@130.61.42.123

cd ~/TimeTracking-Clean
git pull

cd server
npm install --production
npm run build

pm2 restart timetracking-api
```

**✅ Code angepasst!**

---

## 📋 PHASE 5: SSL/HTTPS mit Let's Encrypt (Optional - 5 Minuten)

**Benötigt:** Domain (z.B. `timetracking.deine-domain.de`)

### Schritt 5.1: nginx als Reverse Proxy installieren

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

### Schritt 5.2: nginx konfigurieren

```bash
sudo nano /etc/nginx/sites-available/timetracking
```

**Inhalt:**
```nginx
server {
    listen 80;
    server_name timetracking.deine-domain.de;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Aktivieren:**
```bash
sudo ln -s /etc/nginx/sites-available/timetracking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Schritt 5.3: SSL Zertifikat mit Let's Encrypt

```bash
sudo certbot --nginx -d timetracking.deine-domain.de
```

**Fragen beantworten:**
- E-Mail: deine@email.de
- Agree to Terms: Y
- Redirect HTTP to HTTPS: Y

**✅ HTTPS aktiviert!**

**Frontend API URL anpassen:**
```typescript
const API_BASE_URL = 'https://timetracking.deine-domain.de/api';
```

---

## 📋 PHASE 6: Automatische Backups (5 Minuten)

### Backup Script erstellen

```bash
sudo nano /usr/local/bin/backup-timetracking.sh
```

**Inhalt:**
```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DB_PATH="/home/ubuntu/TimeTracking-Clean/server/database.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
cp $DB_PATH $BACKUP_DIR/database_$DATE.db

# Alte Backups löschen (älter als 30 Tage)
find $BACKUP_DIR -name "database_*.db" -mtime +30 -delete

echo "Backup completed: database_$DATE.db"
```

**Ausführbar machen:**
```bash
sudo chmod +x /usr/local/bin/backup-timetracking.sh
```

---

### Cronjob für tägliches Backup

```bash
crontab -e
```

**Hinzufügen:**
```
# Tägliches Backup um 2:00 Uhr nachts
0 2 * * * /usr/local/bin/backup-timetracking.sh >> /home/ubuntu/backup.log 2>&1
```

**Testen:**
```bash
/usr/local/bin/backup-timetracking.sh
ls -lh ~/backups/
```

**✅ Backups konfiguriert!**

---

## 🎉 FERTIG!

### ✅ Was du jetzt hast:

- ✅ Kostenloser Server in Frankfurt (GDPR)
- ✅ Node.js API läuft mit PM2 (Auto-Restart)
- ✅ Multi-User funktionsfähig
- ✅ Zentrale Database
- ✅ (Optional) HTTPS mit Let's Encrypt
- ✅ Automatische tägliche Backups

---

## 🔧 Nützliche Befehle

**PM2 Commands:**
```bash
pm2 status                    # Status aller Prozesse
pm2 logs timetracking-api     # Logs anschauen
pm2 restart timetracking-api  # Server neustarten
pm2 stop timetracking-api     # Server stoppen
pm2 delete timetracking-api   # Prozess löschen
```

**Server Monitoring:**
```bash
htop                 # System-Ressourcen
pm2 monit            # PM2 Monitoring
tail -f ~/backup.log # Backup Logs
```

**Updates deployen:**
```bash
ssh ubuntu@SERVER-IP
cd ~/TimeTracking-Clean
git pull
cd server
npm install --production
npm run build
pm2 restart timetracking-api
```

---

## 🆘 Troubleshooting

### Problem: Server antwortet nicht

```bash
# Firewall prüfen
sudo ufw status

# PM2 Status
pm2 status

# Logs checken
pm2 logs timetracking-api --lines 100

# Server neustarten
pm2 restart timetracking-api
```

### Problem: Database Error

```bash
# Permissions prüfen
ls -la ~/TimeTracking-Clean/server/database.db

# Falls nötig:
chmod 664 ~/TimeTracking-Clean/server/database.db
```

### Problem: Out of Memory

```bash
# Swap aktivieren (für 1GB RAM VMs wichtig!)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 📚 Weiterführend

- **Oracle Cloud Docs:** https://docs.oracle.com/
- **PM2 Docs:** https://pm2.keymetrics.io/
- **Let's Encrypt:** https://letsencrypt.org/

---

**Viel Erfolg! 🚀**
