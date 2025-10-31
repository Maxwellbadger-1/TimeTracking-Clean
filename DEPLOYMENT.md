# TimeTracker - Deployment Guide

**Die einfachste Multi-User Zeiterfassung der Welt!**

> 💡 **Installation in 30 Sekunden:** Download → Doppelklick → Fertig!
> 🚀 **Automatischer Multi-User:** Keine Konfiguration nötig!
> 🌐 **Funktioniert überall:** Büro (LAN) oder Home-Office (kostenlos über Cloudflare)

---

## 🎯 Wie es funktioniert

### Embedded Server Architektur

Jede TimeTracker Installation enthält **ALLES**:
- ✅ Desktop-App (Frontend)
- ✅ Server (Backend, automatisch im Hintergrund)
- ✅ Datenbank (SQLite)
- ✅ Standard Admin-User (vorinstalliert)

**Der erste PC wird automatisch zum "Master-Server".**
**Alle anderen PCs finden ihn automatisch und verbinden sich.**

### Keine Cloud-Kosten!

- 💰 **Büro (LAN):** 100% kostenlos, automatische Server-Erkennung
- 💰 **Home-Office:** 100% kostenlos über Cloudflare Tunnel

---

## 📋 Voraussetzungen

### Für ALLE PCs (Master + Clients)
- **Windows 10/11**, **macOS 10.15+** oder **Linux**
- Mindestens **2 GB RAM** und **500 MB freier Speicher**
- Netzwerkverbindung (LAN/WLAN für Büro, Internet für Home-Office)

### Master-Server PC (der erste PC, der installiert wird)
- Sollte während Arbeitszeiten laufen
- Empfohlen: Dedizierter PC oder Server (kann auch normaler Arbeitsplatz-PC sein)

---

## 🚀 Installation - So einfach geht's!

### Schritt 1: Download von GitHub

1. Besuche: **[github.com/username/timetracker/releases/latest](https://github.com/username/timetracker/releases/latest)**
2. Wähle deine Plattform:
   - **Windows:** `TimeTracker_1.0.0_x64-setup.exe`
   - **macOS:** `TimeTracker_1.0.0_x64.dmg`
   - **Linux:** `TimeTracker_1.0.0_amd64.AppImage`
3. Download starten (~15 MB)

---

### Schritt 2: Installation (Master-Server PC)

**Der erste PC wird automatisch zum Master-Server!**

#### Windows:
1. Doppelklick auf `TimeTracker_1.0.0_x64-setup.exe`
2. Klick "Installieren"
3. Warten (~30 Sekunden)
4. "Fertig" klicken

#### macOS:
1. Doppelklick auf `TimeTracker_1.0.0_x64.dmg`
2. TimeTracker.app nach Programme ziehen
3. Programme → TimeTracker doppelklicken

#### Linux:
1. Rechtsklick auf `.AppImage` → Eigenschaften → Ausführbar machen
2. Doppelklick zum Starten

**✅ Installation abgeschlossen!**

---

### Schritt 3: Erster Start (Master-Server Setup)

**Die App startet automatisch...**

```
┌─────────────────────────────────────────────┐
│  🔍 Suche nach Server im Netzwerk...       │
│  ⏳ Bitte warten...                        │
└─────────────────────────────────────────────┘
```

**...nach 3 Sekunden:**

```
┌─────────────────────────────────────────────┐
│  📡 Kein Server gefunden                    │
│                                             │
│  Möchten Sie Master-Server werden?          │
│                                             │
│  ℹ️  Als Master-Server können andere PCs   │
│     im Netzwerk automatisch verbinden.      │
│                                             │
│  [ Ja, Master werden ]  [ Abbrechen ]       │
└─────────────────────────────────────────────┘
```

**Klick "Ja, Master werden"**

**Die App richtet sich automatisch ein:**
```
✅ Server wird gestartet...
✅ Datenbank wird initialisiert...
✅ Admin-User wird erstellt...
✅ Netzwerk-Discovery aktiviert...
✅ Fertig!
```

---

### Schritt 4: Admin-Login (Erster Login)

```
┌─────────────────────────────────────────────┐
│  🎉 Willkommen zu TimeTracker!              │
│                                             │
│  Sie sind der Master-Server!                │
│                                             │
│  Standard-Zugangsdaten:                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━                  │
│  Username: admin                            │
│  Passwort: admin123                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━                  │
│                                             │
│  [ Anmelden ]                               │
└─────────────────────────────────────────────┘
```

**Login mit:**
- Username: `admin`
- Passwort: `admin123`

---

### Schritt 5: Passwort ändern (Zwingend!)

```
┌─────────────────────────────────────────────┐
│  ⚠️  Passwort ändern erforderlich           │
│                                             │
│  Aus Sicherheitsgründen müssen Sie          │
│  Ihr Passwort ändern.                       │
│                                             │
│  Neues Passwort:                            │
│  [ ••••••••••••••••               ]         │
│                                             │
│  Bestätigen:                                │
│  [ ••••••••••••••••               ]         │
│                                             │
│  [ Passwort ändern ]                        │
└─────────────────────────────────────────────┘
```

**✅ Master-Server ist bereit!**

```
┌─────────────────────────────────────────────┐
│  ✅ Master-Server läuft!                    │
│                                             │
│  📡 Im Netzwerk sichtbar als:               │
│     "TimeTracker Master"                    │
│                                             │
│  🌐 Server-URL:                             │
│     http://192.168.1.100:3000               │
│                                             │
│  👥 Andere PCs können jetzt automatisch     │
│     verbinden!                              │
│                                             │
│  [ OK ]                                     │
└─────────────────────────────────────────────┘
```

---

### Schritt 6: Mitarbeiter-Accounts erstellen

**Im Admin-Dashboard:**

1. Sidebar → **"Mitarbeiter"** (oder `Ctrl/Cmd+6`)
2. Klick **"Neuer Mitarbeiter"**
3. Formular ausfüllen:
   ```
   Username:       max.mustermann
   E-Mail:         max.mustermann@firma.de
   Vorname:        Max
   Nachname:       Mustermann
   Passwort:       Erstpasswort123
   Abteilung:      IT
   Position:       Entwickler
   Wochenstunden:  40
   Urlaubstage:    30
   Rolle:          Mitarbeiter
   Status:         Aktiv
   ```
4. Klick **"Erstellen"**

**✅ Mitarbeiter angelegt!**

**Login-Daten notieren und an Mitarbeiter übergeben:**
- Username: `max.mustermann`
- Passwort: `Erstpasswort123`

---

### Schritt 7: Weitere PCs installieren (Mitarbeiter)

**Jeder Mitarbeiter installiert die gleiche `.exe` auf seinem PC:**

#### Installation:
1. Download `TimeTracker_1.0.0_x64-setup.exe` (gleiche Datei!)
2. Doppelklick → Installieren
3. App öffnen

#### Automatische Server-Erkennung:

```
┌─────────────────────────────────────────────┐
│  🔍 Suche nach Server im Netzwerk...       │
│  ⏳ Bitte warten...                        │
└─────────────────────────────────────────────┘
```

**...nach 2-3 Sekunden:**

```
┌─────────────────────────────────────────────┐
│  ✅ Master-Server gefunden!                 │
│                                             │
│  Server:                                    │
│  📡 DESKTOP-PC-01 (192.168.1.100)          │
│                                             │
│  [ Verbinden ]  [ Ignorieren ]              │
└─────────────────────────────────────────────┘
```

**Klick "Verbinden"**

#### Login:

```
┌─────────────────────────────────────────────┐
│  Anmeldung                                  │
│                                             │
│  Verbunden mit: DESKTOP-PC-01               │
│                                             │
│  Benutzername:                              │
│  [ max.mustermann             ]             │
│                                             │
│  Passwort:                                  │
│  [ ••••••••••••••             ]             │
│                                             │
│  [ Anmelden ]                               │
└─────────────────────────────────────────────┘
```

**Login mit:**
- Username: `max.mustermann`
- Passwort: `Erstpasswort123`

**✅ FERTIG! Mitarbeiter kann arbeiten!**

---

## 🏢 Multi-User Modi

### Modus 1: Büro (LAN) - Standard ⭐

**Wie es funktioniert:**
- Automatische Server-Erkennung über **mDNS** (wie AirDrop, Chromecast)
- Keine Konfiguration nötig
- Sehr schnell (lokales Netzwerk)
- Kein Internet nötig

**Anforderungen:**
- Alle PCs im gleichen Netzwerk (LAN/WLAN)
- Router erlaubt mDNS (Standard bei den meisten Routern)

**Setup:** KEINE! Funktioniert automatisch.

---

### Modus 2: Home-Office (Cloudflare Tunnel) - Optional

**Für Mitarbeiter im Home-Office oder Remote-Arbeit**

#### Admin aktiviert Remote-Zugriff:

1. Master-Server PC → **Einstellungen** → **Netzwerk**
2. Klick **"Remote-Zugriff aktivieren"**

```
┌─────────────────────────────────────────────┐
│  Remote-Zugriff aktivieren                  │
│                                             │
│  Cloudflare Tunnel wird eingerichtet...     │
│  ⏳ Bitte warten...                        │
└─────────────────────────────────────────────┘
```

**...nach 10-20 Sekunden:**

```
┌─────────────────────────────────────────────┐
│  ✅ Remote-Zugriff aktiviert!               │
│                                             │
│  🌐 Server-URL (öffentlich):                │
│  ┌─────────────────────────────────┐        │
│  │ https://tt-firma-abc123.cf.com │        │
│  └─────────────────────────────────┘        │
│                                             │
│  [ URL kopieren ]  [ QR-Code zeigen ]       │
│                                             │
│  ℹ️  Diese URL an Home-Office Mitarbeiter  │
│     schicken!                               │
│                                             │
│  [ Schließen ]                              │
└─────────────────────────────────────────────┘
```

#### Home-Office Mitarbeiter verbindet:

1. App installieren (gleiche `.exe`)
2. App startet

```
┌─────────────────────────────────────────────┐
│  🔍 Kein lokaler Server gefunden            │
│                                             │
│  Remote-Server URL:                         │
│  ┌─────────────────────────────────┐        │
│  │ https://tt-firma-abc123.cf.com │        │
│  └─────────────────────────────────┘        │
│                                             │
│  [ Verbinden ]                              │
└─────────────────────────────────────────────┘
```

3. URL einfügen (von Admin erhalten)
4. Klick "Verbinden"
5. Login mit Zugangsdaten
6. ✅ Fertig!

**Kosten:** 💰 **0,00 € - Cloudflare Tunnel ist 100% kostenlos!**

---

## 📊 Zusammenfassung: Was muss gemacht werden?

| Schritt | Wer? | Dauer | Komplexität |
|---------|------|-------|-------------|
| 1. App downloaden | Admin | 30 Sek | ⭐ Sehr einfach |
| 2. App installieren | Admin | 30 Sek | ⭐ Sehr einfach |
| 3. Master-Server Setup | Admin | 1 Min | ⭐ Sehr einfach |
| 4. Mitarbeiter anlegen | Admin | 1 Min pro Person | ⭐ Sehr einfach |
| 5. App auf weiteren PCs | Mitarbeiter | 1 Min | ⭐ Sehr einfach |
| 6. Remote aktivieren (optional) | Admin | 2 Min | ⭐⭐ Einfach |

**Gesamt-Aufwand für 10 Mitarbeiter:** ~20 Minuten

---

## ❓ Häufige Fragen (FAQ)

### Q: Brauche ich einen separaten Server?
**A:** Nein! Der erste PC der installiert wird, ist automatisch der Server.

### Q: Muss ich Ports freigeben oder Router konfigurieren?
**A:** Nein! Im LAN funktioniert alles automatisch. Für Home-Office nutzt du Cloudflare (auch keine Router-Konfiguration nötig).

### Q: Was kostet Cloudflare Tunnel?
**A:** 0,00 € - Komplett kostenlos! Auch für kommerzielle Nutzung.

### Q: Was wenn der Master-Server PC neu startet?
**A:** Die App startet automatisch mit Windows/macOS. Server läuft nach ~10 Sekunden wieder.

### Q: Kann ich den Master-Server später wechseln?
**A:** Ja! Datenbank-Backup kopieren, auf neuem PC installieren, Backup wiederherstellen, als Master starten.

### Q: Wie viele Mitarbeiter kann das System handhaben?
**A:** Problemlos 50-100 Benutzer auf einem normalen PC. Für mehr: Bessere Hardware für Master-Server.

### Q: Was wenn Mitarbeiter die App zu Hause UND im Büro nutzen will?
**A:** Kein Problem! Gleicher Login funktioniert überall. Im Büro verbindet die App automatisch zum LAN-Server, zu Hause zur Cloudflare-URL.

### Q: Brauchen Mitarbeiter Admin-Rechte auf ihrem PC?
**A:** Nein! Normale Benutzer-Rechte reichen.

### Q: Funktioniert es ohne Internet?
**A:** Ja! Im LAN (Büro) brauchst du kein Internet. Nur für Home-Office über Cloudflare.

---

## 🔒 Sicherheit

### Automatische Sicherheits-Features:

✅ **Passwörter:** Bcrypt-Hashing (nicht im Klartext)
✅ **Sessions:** HttpOnly Cookies (XSS-Schutz)
✅ **HTTPS:** Automatisch über Cloudflare Tunnel
✅ **Firewall:** Nur lokales Netzwerk (LAN-Modus)
✅ **Updates:** Automatisch über GitHub Releases

### Best Practices:

1. ⚠️ **Master-Server PC:** Sollte physisch gesichert sein
2. ⚠️ **Admin-Passwort:** Stark und einzigartig
3. ⚠️ **Backups:** Täglich automatisch (siehe unten)
4. ⚠️ **Updates:** Immer installieren

---

## 💾 Automatische Backups

### Datenbank-Backup (Täglich, automatisch)

Die App erstellt automatisch Backups:

**Speicherort:**
```
Windows: C:\Users\USERNAME\AppData\Roaming\TimeTracker\backups\
macOS:   ~/Library/Application Support/TimeTracker/backups/
Linux:   ~/.local/share/TimeTracker/backups/
```

**Backup-Strategie:**
- Täglich: Letzte 7 Tage behalten
- Wöchentlich: Letzte 4 Wochen behalten
- Monatlich: Letzte 12 Monate behalten

**Manuelles Backup:**
1. Einstellungen → Datenbank
2. "Backup jetzt erstellen"
3. Backup-Datei speichern

---

## 🔄 Updates

### Automatische Updates (Standard)

```
Neue Version verfügbar!
┌─────────────────────────────────────────────┐
│  🎉 Update verfügbar!                       │
│                                             │
│  Aktuelle Version: 1.0.0                    │
│  Neue Version:     1.1.0                    │
│                                             │
│  Änderungen:                                │
│  • Neue Reports                             │
│  • Bug-Fixes                                │
│  • Performance-Verbesserungen               │
│                                             │
│  [ Jetzt aktualisieren ]  [ Später ]        │
└─────────────────────────────────────────────┘
```

**Klick "Jetzt aktualisieren":**
1. Download läuft im Hintergrund
2. "Update bereit - App neu starten?"
3. Klick "Ja"
4. App startet neu mit neuer Version
5. ✅ Fertig!

---

## 🛠️ Troubleshooting

### Problem: "Kein Server gefunden" (Mitarbeiter-PC)

**Lösung 1:** Manuelle Verbindung
1. Login-Screen → "Erweiterte Einstellungen"
2. Server-URL manuell eingeben: `http://192.168.1.100:3000`
3. Verbinden

**Lösung 2:** mDNS/Bonjour aktivieren
- Windows: Bonjour-Service installieren (Apple Bonjour Print Services)
- macOS: Sollte standardmäßig funktionieren
- Linux: Avahi installieren (`sudo apt install avahi-daemon`)

### Problem: Master-Server nicht erreichbar

**Checkliste:**
- ✅ Ist Master-Server PC eingeschaltet?
- ✅ Ist TimeTracker App auf Master-Server gestartet?
- ✅ Sind beide PCs im gleichen Netzwerk?
- ✅ Firewall blockiert Port 3000? (Windows Firewall Regel erstellen)

### Problem: Cloudflare Tunnel startet nicht

**Lösung:**
1. Einstellungen → Netzwerk
2. "Remote-Zugriff deaktivieren"
3. Warten 10 Sekunden
4. "Remote-Zugriff aktivieren"
5. Neuer Tunnel wird erstellt

---

## 📞 Support & Hilfe

**Bei Problemen:**

1. **App-Logs prüfen:**
   - Hilfe → Logs anzeigen
   - Oder: `%APPDATA%\TimeTracker\logs\`

2. **GitHub Issues:**
   - [github.com/username/timetracker/issues](https://github.com/username/timetracker/issues)
   - Neues Issue erstellen mit:
     - Beschreibung des Problems
     - Screenshots
     - Log-Dateien

3. **Datenbank wiederherstellen:**
   - Einstellungen → Datenbank → Backup wiederherstellen
   - Backup-Datei auswählen
   - App neu starten

---

## 🎉 Fertig!

**Du hast jetzt ein vollständiges Multi-User Zeiterfassungssystem:**

✅ Automatische Installation
✅ Automatische Server-Erkennung
✅ Automatische Backups
✅ Automatische Updates
✅ Multi-User (LAN + Home-Office)
✅ 100% kostenlos
✅ Datenschutz (Deine Daten bleiben bei dir!)

**Viel Erfolg mit TimeTracker!** 🚀

---

### Alte Installation (Manuelle Server-Setup)

<details>
<summary>Nur für fortgeschrittene Benutzer - Klicken um alte Anleitung anzuzeigen</summary>

### Phase 1: Server installieren (EINMALIG - NUR WENN EMBEDDED SERVER NICHT FUNKTIONIERT)

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
