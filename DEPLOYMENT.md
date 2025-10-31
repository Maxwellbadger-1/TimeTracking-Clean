# TimeTracker - Deployment Guide

Komplette Anleitung zur Installation des TimeTracker Systems für den Produktivbetrieb.

---

## 📋 Voraussetzungen

### Server-Computer
- **Windows Server**, **Linux Server** oder **Windows/macOS PC** der 24/7 läuft
- **Node.js 20+** installiert
- **Netzwerkzugang** für alle Mitarbeiter-PCs (LAN/WLAN)
- Mindestens **2 GB RAM** und **10 GB freier Speicher**

### Mitarbeiter-PCs
- **Windows 10/11**, **macOS 10.15+** oder **Linux**
- Netzwerkverbindung zum Server
- Keine besonderen Anforderungen (Desktop-App ist nur ~10 MB)

---

## 🚀 Setup-Prozess

### Phase 1: Server installieren (EINMALIG)

#### Schritt 1: Repository auf Server kopieren

```bash
# Windows Server
cd C:\
mkdir TimeTracker
# Dateien vom Repository kopieren

# Linux Server
cd /opt
sudo mkdir timetracker
sudo chown $USER:$USER timetracker
cd timetracker
# Dateien vom Repository kopieren
```

#### Schritt 2: Dependencies installieren

```bash
cd server
npm install --production
```

#### Schritt 3: Environment Variables konfigurieren

Erstelle Datei `server/.env`:

```env
# Session Secret (WICHTIG: Ändere diesen Wert!)
SESSION_SECRET=IHR_SUPER_GEHEIMES_PASSWORT_HIER_MINDESTENS_32_ZEICHEN

# Node Environment
NODE_ENV=production

# Server Port
PORT=3000

# Database Path (optional, default: server/database.db)
DATABASE_PATH=./database.db
```

**⚠️ WICHTIG:** Generiere ein sicheres `SESSION_SECRET`:

```bash
# Auf dem Server ausführen
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Schritt 4: Datenbank initialisieren

```bash
# Die Datenbank wird automatisch beim ersten Start erstellt
npm run build
npm start
```

Du solltest sehen:
```
✅ Database connected
🚀 Server running on http://localhost:3000
```

**Teste:** Öffne Browser auf dem Server → `http://localhost:3000/api/health`

Du solltest sehen: `{"status":"ok"}`

#### Schritt 5: Server-IP-Adresse notieren

```bash
# Windows
ipconfig

# Linux/macOS
ifconfig
# oder
ip addr show
```

Notiere die **lokale IP-Adresse** (z.B. `192.168.1.100`)

#### Schritt 6: Firewall konfigurieren

```bash
# Windows Firewall
# Eingehende Regel hinzufügen für Port 3000

# Linux (Ubuntu/Debian)
sudo ufw allow 3000
sudo ufw status

# macOS
# System Preferences → Security & Privacy → Firewall → Firewall Options
# Port 3000 freigeben
```

#### Schritt 7: Server dauerhaft laufen lassen (PM2)

```bash
# PM2 global installieren
npm install -g pm2

# Server mit PM2 starten
pm2 start dist/index.js --name timetracker

# Auto-Start bei Server-Neustart
pm2 save
pm2 startup
# Folge den Anweisungen!

# Status prüfen
pm2 status
pm2 logs timetracker
```

**Server läuft jetzt 24/7!** ✅

---

### Phase 2: Admin-User erstellen (EINMALIG)

```bash
cd server

# Admin-Setup-Script ausführen
npx tsx scripts/create-admin.ts
```

**Folge den Anweisungen:**

```
=================================
TimeTracker - Admin User Setup
=================================

Admin Username: admin
Admin Email: admin@firma.de
Admin Password (min. 8 Zeichen): ********
Vorname: Max
Nachname: Mustermann

✅ Admin-User erfolgreich erstellt!

📋 Login-Daten:
   Username: admin
   Email:    admin@firma.de
   Passwort: ********

⚠️  Bitte Passwort sicher aufbewahren!
```

---

### Phase 3: Desktop-App bauen (EINMALIG)

#### Schritt 1: Server-URL konfigurieren

**Datei:** `desktop/src/lib/apiClient.ts`

```typescript
import axios from 'axios';

export const apiClient = axios.create({
  // ⚠️ WICHTIG: Server-IP hier eintragen!
  baseURL: 'http://192.168.1.100:3000/api',  // ← Deine Server-IP!

  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

#### Schritt 2: App-Version setzen

**Datei:** `desktop/package.json` UND `desktop/src-tauri/Cargo.toml`

```json
// desktop/package.json
{
  "version": "1.0.0"  // ← Gleiche Version wie Cargo.toml!
}
```

```toml
# desktop/src-tauri/Cargo.toml
[package]
version = "1.0.0"  # ← Gleiche Version wie package.json!
```

#### Schritt 3: Desktop-App bauen

```bash
cd desktop

# Dependencies installieren
npm install

# Production Build
npm run tauri build
```

**⏱ Build-Zeit:** 5-10 Minuten

**Output:**

**Windows:**
```
✅ Build erfolgreich!
📦 Installer: desktop/src-tauri/target/release/bundle/nsis/TimeTracker_1.0.0_x64-setup.exe
```

**macOS:**
```
✅ Build erfolgreich!
📦 Installer: desktop/src-tauri/target/release/bundle/dmg/TimeTracker_1.0.0_x64.dmg
```

**Linux:**
```
✅ Build erfolgreich!
📦 Installer: desktop/src-tauri/target/release/bundle/appimage/TimeTracker_1.0.0_amd64.AppImage
```

---

### Phase 4: Desktop-App verteilen

#### Option A: USB-Stick

1. Kopiere `TimeTracker_1.0.0_x64-setup.exe` auf USB-Stick
2. Gehe zu jedem Mitarbeiter-PC
3. Installiere die App

#### Option B: Netzwerk-Freigabe

1. Erstelle Freigabe auf Server: `\\SERVER\TimeTracker\`
2. Kopiere `.exe` in die Freigabe
3. Mitarbeiter laden von dort herunter

#### Option C: E-Mail (NICHT empfohlen für große Dateien)

- Verschicke `.exe` per E-Mail
- ⚠️ Manche E-Mail-Provider blockieren `.exe`-Dateien!

---

### Phase 5: Mitarbeiter-Installation (Pro PC)

#### Schritt 1: Installer ausführen

1. Doppelklick auf `TimeTracker_1.0.0_x64-setup.exe`
2. "Installieren" klicken
3. Warten (~30 Sekunden)
4. "Fertig" klicken

**Installation abgeschlossen!** App ist jetzt in:
- `C:\Program Files\TimeTracker\TimeTracker.exe` (Windows)
- `/Applications/TimeTracker.app` (macOS)
- `~/Applications/TimeTracker.AppImage` (Linux)

Desktop-Shortcut wird automatisch erstellt.

#### Schritt 2: App starten

1. Desktop-Icon doppelklicken **ODER** System Tray Icon klicken
2. Login-Bildschirm erscheint

#### Schritt 3: Erster Login (Admin)

**Als Admin:**
1. Username: `admin` (oder was du beim Setup eingegeben hast)
2. Passwort: (dein Admin-Passwort)
3. "Anmelden" klicken

**✅ Du bist eingeloggt!**

---

### Phase 6: Mitarbeiter anlegen (Admin)

#### Im Admin-Dashboard:

1. Sidebar → "Mitarbeiter" (oder Ctrl/Cmd+6)
2. "Neuer Mitarbeiter" klicken
3. Formular ausfüllen:

```
Benutzername: max.mustermann
E-Mail: max.mustermann@firma.de
Vorname: Max
Nachname: Mustermann
Passwort: Erstpasswort123
Abteilung: IT
Position: Entwickler
Wochenstunden: 40
Urlaubstage/Jahr: 30
Rolle: Mitarbeiter
Status: Aktiv
```

4. "Erstellen" klicken

**✅ Mitarbeiter angelegt!**

#### Mitarbeiter informieren:

Gib jedem Mitarbeiter seine Login-Daten:
- Username: `max.mustermann`
- Passwort: `Erstpasswort123`
- Server-URL: `http://192.168.1.100:3000` (zur Sicherheit)

**⚠️ Empfehlung:** Mitarbeiter soll beim ersten Login Passwort ändern!

---

### Phase 7: Mitarbeiter-Login (Erstmaliger Login)

#### Als Mitarbeiter:

1. Desktop-App starten
2. Username: `max.mustermann`
3. Passwort: `Erstpasswort123`
4. "Anmelden" klicken

**✅ Mitarbeiter kann sofort loslegen!**

---

## 🎯 Zusammenfassung: Was muss gemacht werden?

### Einmalig (Admin):
1. ✅ Server installieren (~30 Min)
2. ✅ Admin-User erstellen (~2 Min)
3. ✅ Desktop-App bauen (~10 Min)
4. ✅ Desktop-App verteilen (~variiert)

### Pro Mitarbeiter (1-2 Minuten):
1. ✅ Desktop-App installieren (~1 Min)
2. ✅ Mitarbeiter-Account anlegen (Admin, ~1 Min)
3. ✅ Login-Daten übergeben (~1 Min)

### Danach:
**✅ FERTIG! Alle Mitarbeiter können parallel arbeiten!**

---

## 📊 Täglicher Betrieb

### Mitarbeiter:

**Morgens:**
1. App starten (falls nicht schon gestartet)
2. Zeit erfassen: "Zeit erfassen" Button
3. Start-Zeit, End-Zeit, Pause eingeben
4. Speichern

**Bei Bedarf:**
- Urlaub beantragen
- Überstunden ansehen
- Berichte ansehen (wenn Admin)

### Admin:

**Täglich/Wöchentlich:**
- Urlaubsanträge genehmigen/ablehnen
- Mitarbeiter-Zeiteinträge kontrollieren
- Berichte erstellen

---

## 🔧 Wartung & Backups

### Backup der Datenbank (WICHTIG!)

```bash
# Täglich (Cron Job / Windows Task Scheduler)
cd /opt/timetracker/server  # oder C:\TimeTracker\server
cp database.db backups/database_$(date +%Y%m%d).db

# Oder mit Zeitstempel
cp database.db backups/database_$(date +%Y%m%d_%H%M%S).db
```

**Backup-Strategie:**
- Täglich: Letzte 7 Tage behalten
- Wöchentlich: Letzte 4 Wochen behalten
- Monatlich: Letzte 12 Monate behalten

### Server-Updates

```bash
# Server stoppen
pm2 stop timetracker

# Code aktualisieren
git pull origin main
# ODER: Neue Dateien kopieren

# Dependencies aktualisieren
npm install --production

# Neu bauen
npm run build

# Server starten
pm2 start timetracker
pm2 save
```

### Desktop-App Updates

**Auto-Update aktiviert:**
- Apps prüfen automatisch auf Updates
- User bekommt Benachrichtigung
- Klick auf "Update installieren"
- App lädt runter, installiert, startet neu

**Manuell:**
- Neue `.exe` bauen
- An Mitarbeiter verteilen
- Installieren (überschreibt alte Version)

---

## ❓ Häufige Fragen (FAQ)

### Q: Müssen alle Mitarbeiter gleichzeitig installieren?
**A:** Nein! Jeder kann installieren wann er will.

### Q: Kann ein Mitarbeiter die App auf mehreren PCs installieren?
**A:** Ja! Gleicher Login funktioniert auf allen PCs.

### Q: Was passiert wenn der Server neu startet?
**A:** PM2 startet den Server automatisch neu. Keine Daten gehen verloren.

### Q: Was wenn Mitarbeiter Passwort vergisst?
**A:** Admin kann in der Datenbank neues Passwort setzen oder "Passwort zurücksetzen"-Feature nutzen (kommt in späteren Versionen).

### Q: Wie viele Mitarbeiter kann das System handhaben?
**A:** Problemlos 50-100 Mitarbeiter. Für mehr: Server-Hardware upgraden.

### Q: Braucht jeder Mitarbeiter Administrator-Rechte?
**A:** Nein! Normale Windows-User-Rechte reichen.

### Q: Was wenn Internet ausfällt?
**A:** Solange **lokales Netzwerk** funktioniert, funktioniert die App. Kein Internet nötig!

### Q: Kann ich von Zuhause aus zugreifen?
**A:** Nur wenn du VPN zum Firmen-Netzwerk hast ODER den Server über öffentliche IP erreichbar machst (nicht empfohlen ohne HTTPS + Sicherheitsmaßnahmen).

---

## 🔒 Sicherheits-Tipps

1. ✅ **SESSION_SECRET** niemals teilen oder committen
2. ✅ Starke Passwörter für Admin-Accounts
3. ✅ Regelmäßige Backups der Datenbank
4. ✅ Firewall nur Port 3000 im lokalen Netzwerk öffnen
5. ✅ Für Internet-Zugriff: HTTPS + Reverse Proxy (nginx/Caddy)
6. ✅ Mitarbeiter sollen Passwörter beim ersten Login ändern

---

## 📞 Support

Bei Problemen:
1. Server-Logs prüfen: `pm2 logs timetracker`
2. Desktop-App Console öffnen (Entwickler-Tools)
3. Datenbank-Backup wiederherstellen (falls Fehler)

---

**Version:** 1.0
**Letzte Aktualisierung:** 2025-10-31
**Status:** ✅ Production-Ready
