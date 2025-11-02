# 🚀 SUPER-EINFACHES SERVER SETUP (3 Schritte!)

**Zeitaufwand:** 15 Minuten
**Kosten:** €0 (Forever Free!)
**Schwierigkeit:** ⭐☆☆☆☆ (Sehr einfach!)

---

## ✅ **DU MACHST NUR 3 DINGE:**

### 📝 **SCHRITT 1: Oracle Cloud Account** (5 Min)

1. Gehe zu: **https://signup.cloud.oracle.com/**
2. Klick: **"Start for free"**
3. Ausfüllen:
   - Land: **Germany** 🇩🇪
   - Home Region: **Germany Central (Frankfurt)**
   - E-Mail, Name, Passwort
4. E-Mail bestätigen
5. Fertig! ✅

---

### 🖥️ **SCHRITT 2: Server erstellen** (5 Min)

1. **Login:** https://cloud.oracle.com/
2. **Menu (☰)** → **Compute** → **Instances**
3. **Klick:** "Create Instance"

**Konfiguration:**
```
Name: timetracking-server
Image: Ubuntu 22.04
Shape: VM.Standard.E2.1.Micro (Always Free!) ✅
```

4. **SSH Key:**
   - Klick: "Generate SSH Key Pair"
   - **Download:** "Save Private Key" → speichern als `key.pem`

5. **Klick:** "Create"

6. **Warte 2 Minuten** bis Status = RUNNING

7. **Kopiere die Public IP** (z.B. `130.61.42.123`)

---

### 🔥 **Firewall öffnen** (2 Min)

1. **In Oracle Cloud:**
   - Menu → **Networking** → **Virtual Cloud Networks**
   - **Default VCN** → **Public Subnet** → **Default Security List**

2. **Klick:** "Add Ingress Rules"

3. **3x Regel hinzufügen:**

**Regel 1:**
```
Source CIDR: 0.0.0.0/0
Port: 80
Description: HTTP
```

**Regel 2:**
```
Source CIDR: 0.0.0.0/0
Port: 443
Description: HTTPS
```

**Regel 3:**
```
Source CIDR: 0.0.0.0/0
Port: 3000
Description: API
```

---

### 🎯 **SCHRITT 3: EIN BEFEHL - ALLES FERTIG!** (5 Min)

**Auf deinem Mac Terminal:**

```bash
# 1. Mit Server verbinden (ersetze IP!)
chmod 400 ~/Downloads/key.pem
ssh -i ~/Downloads/key.pem ubuntu@YOUR_SERVER_IP

# Du bist jetzt auf dem Server! ✅

# 2. EINEN BEFEHL ausführen - alles wird automatisch installiert:
curl -fsSL https://raw.githubusercontent.com/YOUR-GITHUB-USERNAME/TimeTracking-Clean/main/deployment/auto-setup.sh | bash

# Das war's! Das Script macht ALLES automatisch! 🎉
```

**Was das Script automatisch macht:**
- ✅ System Update
- ✅ Node.js 20 installieren
- ✅ Git installieren
- ✅ PM2 installieren
- ✅ Firewall konfigurieren
- ✅ Code von GitHub clonen
- ✅ Dependencies installieren
- ✅ Server builden
- ✅ Environment konfigurieren
- ✅ Server starten
- ✅ Auto-Restart einrichten
- ✅ Automatische Backups einrichten

**Dauer:** ~5 Minuten (vollautomatisch!)

---

## 🎉 **FERTIG!**

Nach dem Script siehst du:

```
🎉 INSTALLATION COMPLETE! 🎉

📊 Server Information:
  • Server URL: http://130.61.42.123:3000
  • Health Check: http://130.61.42.123:3000/api/health

📱 Next Steps:
  1. Update your Desktop app's .env.production file:
     VITE_API_URL=http://130.61.42.123:3000/api

  2. Rebuild and restart your Desktop app

  3. Test login with your admin credentials

✅ Your TimeTracking server is now running!
```

---

## 🖥️ **DESKTOP APP ANPASSEN** (2 Min)

**Auf deinem Mac - im Projekt:**

**Datei:** `.env.production`

```bash
# Ersetze IP mit deiner Server-IP!
VITE_API_URL=http://130.61.42.123:3000/api
```

**Speichern & App neu starten:**

```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean
./stop-dev.sh
./start-dev.sh
```

**✅ Fertig! Die App verbindet sich jetzt mit dem Remote Server!**

---

## ✅ **TESTEN**

**Login mit:**
```
Benutzername: admin
Passwort: admin123
```

**Multi-User funktioniert jetzt echt!** 🎉

---

## 🔧 **NÜTZLICHE BEFEHLE**

**Via SSH auf Server:**

```bash
# Status prüfen
pm2 status

# Logs anschauen
pm2 logs timetracking-api

# Server neustarten
pm2 restart timetracking-api

# Backup manuell
~/backup-timetracking.sh
```

---

## 🆘 **PROBLEME?**

### Connection Refused?

```bash
# Auf Server (via SSH):
pm2 status  # Prüfen ob Server läuft
pm2 logs timetracking-api  # Logs checken
sudo ufw status  # Firewall prüfen
```

### Server nicht erreichbar?

1. **Oracle Cloud Firewall** nochmal prüfen (Port 3000 offen?)
2. **Server Firewall:** `sudo ufw status` → Port 3000 allowed?
3. **PM2 Status:** `pm2 status` → timetracking-api running?

---

## 📚 **WEITERFÜHREND**

**Optional - HTTPS mit Domain:**
Siehe `ORACLE_CLOUD_SETUP.md` Phase 5

**Vollständige Dokumentation:**
- `ORACLE_CLOUD_SETUP.md` - Detaillierte Anleitung
- `REMOTE_SERVER_QUICKSTART.md` - Manuelle Schritte

---

## 🎯 **ZUSAMMENFASSUNG**

**Was du gemacht hast:**
1. ✅ Oracle Cloud Account erstellt
2. ✅ Server erstellt
3. ✅ **EINEN Befehl** ausgeführt → FERTIG!

**Was du jetzt hast:**
- ✅ Kostenloser Server in Frankfurt 🇩🇪
- ✅ Multi-User funktioniert
- ✅ Zentrale Database
- ✅ Auto-Restart
- ✅ Automatische Backups

**Dauer gesamt:** ~15 Minuten

---

**Viel Erfolg! 🚀**
