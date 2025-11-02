# 🚀 Remote Server Setup - Schnellstart

**Ziel:** In 30 Minuten von lokal zu kostenlosem Cloud-Server!

---

## ✅ Was du brauchst

- [ ] Oracle Cloud Account (kostenlos)
- [ ] 30 Minuten Zeit
- [ ] Terminal/SSH Zugang

---

## 📝 **SCHRITT 1: Oracle Cloud Account** (5 Min)

1. Gehe zu: https://signup.cloud.oracle.com/
2. Registrieren mit:
   - Land: Germany
   - Region: **Germany Central (Frankfurt)**
3. E-Mail bestätigen
4. Fertig! ✅

---

## 🖥️ **SCHRITT 2: Server erstellen** (5 Min)

1. In Oracle Cloud Console:
   - Menu → **Compute** → **Instances**
   - **Create Instance**

2. Konfiguration:
   ```
   Name: timetracking-server
   Image: Ubuntu 22.04
   Shape: VM.Standard.E2.1.Micro (Always Free!)
   Network: Public IP ✅
   ```

3. SSH Key:
   - **Generate SSH Key Pair**
   - Download & speichern: `timetracking-key.pem`

4. **Public IP notieren!** (z.B. `130.61.42.123`)

---

## 🔥 **SCHRITT 3: Firewall öffnen** (2 Min)

In Oracle Cloud:
1. Menu → **Networking** → **Virtual Cloud Networks**
2. **Default VCN** → **Public Subnet** → **Default Security List**
3. **Add Ingress Rules:**

```
Port 80   (HTTP)
Port 443  (HTTPS)
Port 3000 (Node.js API)
```

---

## 🔌 **SCHRITT 4: Mit Server verbinden** (1 Min)

Terminal auf deinem Mac:

```bash
chmod 400 ~/Downloads/timetracking-key.pem
ssh -i ~/Downloads/timetracking-key.pem ubuntu@YOUR_SERVER_IP
```

**Du bist jetzt auf dem Server!** ✅

---

## 📦 **SCHRITT 5: Server Setup** (10 Min)

**Alle Befehle auf dem Server:**

```bash
# System update
sudo apt update && sudo apt upgrade -y

# Node.js 20 installieren
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# PM2 installieren
sudo npm install -g pm2

# Firewall konfigurieren
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw allow 3000
sudo ufw --force enable
```

---

## 🚀 **SCHRITT 6: Code deployen** (5 Min)

**Option A: Via Git (empfohlen)**

```bash
# Auf Server:
cd ~
git clone https://github.com/DEIN-USERNAME/TimeTracking-Clean.git
cd TimeTracking-Clean/server
npm install --production
npm run build
```

**Option B: Via SCP (ohne Git)**

```bash
# Auf deinem Mac:
cd /Users/maximilianfegg/Desktop
tar -czf timetracking.tar.gz TimeTracking-Clean/
scp -i ~/Downloads/timetracking-key.pem timetracking.tar.gz ubuntu@YOUR_SERVER_IP:~/

# Auf Server:
tar -xzf timetracking.tar.gz
cd TimeTracking-Clean/server
npm install --production
npm run build
```

---

## ⚙️ **SCHRITT 7: Environment konfigurieren** (2 Min)

**Auf Server:**

```bash
cd ~/TimeTracking-Clean/server

# .env erstellen
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=GENERIERE_HIER_EINEN_RANDOM_STRING
DATABASE_PATH=./database.db
EOF

# Sicheren Session Secret generieren
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output kopieren und in .env als SESSION_SECRET einfügen!
```

---

## 🏃 **SCHRITT 8: Server starten** (2 Min)

```bash
cd ~/TimeTracking-Clean/server

# PM2 starten
pm2 start dist/server.js --name timetracking-api
pm2 save
pm2 startup
# Den ausgegebenen Befehl kopieren und ausführen!

# Status prüfen
pm2 status
```

---

## ✅ **SCHRITT 9: Testen** (1 Min)

**Von deinem Mac Terminal:**

```bash
curl http://YOUR_SERVER_IP:3000/api/health
```

**Expected:**
```json
{"status":"ok","message":"TimeTracking Server is running",...}
```

**✅ Server läuft!**

---

## 🖥️ **SCHRITT 10: Desktop-App anpassen** (2 Min)

**Auf deinem Mac - im Projekt:**

**Datei:** `.env.production`

```bash
VITE_API_URL=http://YOUR_SERVER_IP:3000/api
```

**Datei speichern & App neu starten:**

```bash
./stop-dev.sh
./start-dev.sh
```

**✅ Desktop-App verbindet sich jetzt mit Remote Server!**

---

## 🎉 FERTIG!

### Was du jetzt hast:

- ✅ Kostenloser Server in Frankfurt (GDPR)
- ✅ Multi-User funktioniert
- ✅ Zentrale Database
- ✅ Auto-Restart mit PM2

---

## 🔧 Nützliche Befehle

```bash
# Server Status
pm2 status

# Server Logs
pm2 logs timetracking-api

# Server neustarten
pm2 restart timetracking-api

# Server stoppen
pm2 stop timetracking-api
```

---

## 🆘 Probleme?

**"Connection refused"**
```bash
# Firewall prüfen
sudo ufw status

# PM2 Status
pm2 status

# Logs checken
pm2 logs timetracking-api
```

**"Database error"**
```bash
ls -la ~/TimeTracking-Clean/server/database.db
chmod 664 ~/TimeTracking-Clean/server/database.db
```

---

## 📚 Weiterführend

- **Vollständige Anleitung:** `ORACLE_CLOUD_SETUP.md`
- **HTTPS Setup:** Siehe ORACLE_CLOUD_SETUP.md Phase 5
- **Backups:** Siehe ORACLE_CLOUD_SETUP.md Phase 6

---

**Viel Erfolg! 🚀**

Bei Fragen: Siehe vollständige Dokumentation in `ORACLE_CLOUD_SETUP.md`
