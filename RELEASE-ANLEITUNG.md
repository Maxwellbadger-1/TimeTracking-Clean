# 🚀 GitHub Auto-Update System - Release Anleitung

**Projekt:** Stiftung der DPolG TimeTracker
**Erstellt:** 2025-11-08
**Status:** ✅ Vollständig konfiguriert

---

## 📋 1. Einmalige GitHub Secrets Setup

**Gehe zu deinem GitHub Repository:**
1. Öffne https://github.com/YOUR_USERNAME/YOUR_REPO
2. Klicke auf **Settings** (Repository Settings, nicht dein Profil!)
3. Im linken Menü: **Secrets and variables** → **Actions**
4. Klicke auf **New repository secret**

**Erstelle diese 2 Secrets:**

### Secret #1: TAURI_SIGNING_PRIVATE_KEY
- **Name:** `TAURI_SIGNING_PRIVATE_KEY`
- **Value:** (kopiere den kompletten Key - siehe unten)

```
dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5ClJXUlRZMEl5SzN0NkJHbG5xdWcwdGEvT2pqcEMxRjFOWm9VU2dERkM5TzRla3RhUm1RWUFBQkFBQUFBQUFBQUFBQUlBQUFBQVlKaERPMVJnckFlc1JSanJCNFYwWDZYdndhWEp0aE54a2lSNlMrY0g5cU5zQWpoQzZqek1pelFmRndwT1U0SHlHY3hVVTdRTWVsdVNTVy91MWI5NEtDV3IyYkpTcE5PbVVDL1dpeDk5ZHJVZWI3VzFjZXJmSG44YkVjYTJSTlR1Z1pxUE94WDF2SlE9Cg==
```

### Secret #2: TAURI_SIGNING_PRIVATE_KEY_PASSWORD
- **Name:** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- **Value:** (leer lassen - einfach Secret mit leerem Wert erstellen)

**WICHTIG:** Diese Secrets dürfen NIEMALS öffentlich sein! Nur in GitHub Secrets speichern!

---

## 📝 2. GitHub Repository Settings anpassen

### Workflow Permissions aktivieren
1. Gehe zu **Settings** → **Actions** → **General**
2. Scrolle nach unten zu **Workflow permissions**
3. Wähle **Read and write permissions**
4. Aktiviere **Allow GitHub Actions to create and approve pull requests**
5. Klicke **Save**

**Warum?** GitHub Actions braucht diese Rechte um Releases zu erstellen.

---

## 🎯 3. GitHub Repository URL in Config aktualisieren

**WICHTIG:** Du musst noch die GitHub URL in der Config anpassen!

Öffne: `desktop/src-tauri/tauri.conf.json`

Suche diese Zeile (ca. Zeile 57):
```json
"endpoints": [
  "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/latest.json"
]
```

Ersetze `YOUR_USERNAME/YOUR_REPO` mit deinen echten GitHub-Daten, z.B.:
```json
"endpoints": [
  "https://github.com/maxfegg/TimeTracking-Clean/releases/latest/download/latest.json"
]
```

---

## 🔢 4. Version hochzählen (vor jedem Release)

**Du musst die Version in 3 Dateien synchron halten:**

### Datei 1: `desktop/package.json`
```json
{
  "version": "1.0.0"  // ← Hier ändern
}
```

### Datei 2: `desktop/src-tauri/Cargo.toml`
```toml
[package]
version = "1.0.0"  # ← Hier ändern
```

### Datei 3: `desktop/src-tauri/tauri.conf.json`
```json
{
  "version": "1.0.0"  // ← Hier ändern
}
```

**Semantic Versioning:**
- **MAJOR.MINOR.PATCH** (z.B. `1.2.3`)
- **MAJOR** (1.x.x): Breaking Changes
- **MINOR** (x.1.x): Neue Features (backwards compatible)
- **PATCH** (x.x.1): Bug Fixes

**Beispiel:**
- `1.0.0` → `1.0.1`: Bug Fix
- `1.0.1` → `1.1.0`: Neues Feature
- `1.1.0` → `2.0.0`: Breaking Change

---

## 🚀 5. Release erstellen (Automatisch via GitHub Actions)

### Variante A: Tag pushen (empfohlen)

```bash
# 1. Alle Änderungen committen
git add .
git commit -m "chore: Bump version to 1.0.1"

# 2. Tag erstellen (WICHTIG: mit 'v' Prefix!)
git tag v1.0.1

# 3. Tag pushen (triggert automatisch den Build!)
git push origin v1.0.1
```

### Variante B: Manueller Trigger (über GitHub UI)

1. Gehe zu deinem Repository auf GitHub
2. Klicke auf **Actions**
3. Wähle **Release Desktop App** Workflow
4. Klicke **Run workflow**
5. Branch auswählen (meist `main`)
6. Klicke **Run workflow**

**Was passiert dann?**
- GitHub Actions startet automatisch
- Baut die App für Windows, macOS (Intel + M1/M2), Linux
- Erstellt einen **Draft Release** mit allen Binaries
- Generiert `latest.json` für Auto-Update

---

## 📦 6. Release veröffentlichen

Nach dem Build (ca. 10-20 Minuten):

1. Gehe zu **Releases** (rechte Sidebar auf GitHub)
2. Du siehst einen **Draft** Release
3. Klicke **Edit**
4. Überprüfe:
   - ✅ Version korrekt?
   - ✅ Alle Dateien vorhanden? (.exe, .msi, .dmg, .AppImage, .deb, signatures)
   - ✅ Release Notes OK?
5. Klicke **Publish release**

**Jetzt ist das Update live!** 🎉

---

## 💻 7. Update testen

### In der Desktop-App (als Admin):
1. Öffne die TimeTracker App
2. Gehe zu **Einstellungen**
3. Klicke auf den **"Updates"** Tab (nur für Admins sichtbar!)
4. Klicke **"Auf Updates prüfen"**
5. Wenn Update verfügbar → **"Jetzt installieren"** klicken
6. App lädt Update herunter und startet neu

**WICHTIG:** Nur Admins sehen den Updates-Tab!

---

## 📁 8. Dateistruktur (was wurde erstellt)

```
TimeTracking-Clean/
├── .github/
│   └── workflows/
│       └── release.yml              ← GitHub Actions Workflow
├── desktop/
│   ├── src/
│   │   └── components/
│   │       └── settings/
│   │           └── UpdateChecker.tsx ← Update-UI Komponente
│   ├── src-tauri/
│   │   ├── Cargo.toml               ← Rust Dependencies (updater plugin)
│   │   ├── tauri.conf.json          ← Updater Config + Public Key
│   │   ├── capabilities/
│   │   │   └── default.json         ← Updater Permissions
│   │   └── src/
│   │       └── lib.rs               ← Updater Plugin initialisiert
│   └── package.json                 ← updater + process plugins
└── ~/.tauri/
    ├── timetracking.key             ← Private Key (GEHEIM!)
    └── timetracking.key.pub         ← Public Key (in Config)
```

---

## 🔒 9. Sicherheit

### Private Key schützen:
- ✅ **NUR** in GitHub Secrets gespeichert
- ✅ **NIEMALS** im Git Repository committen
- ✅ Liegt lokal in `~/.tauri/timetracking.key` (für lokale Builds)

### Wenn Private Key verloren geht:
- ❌ Du kannst KEINE Updates mehr signieren!
- ❌ Bestehende Apps können KEINE Updates mehr installieren!
- ⚠️ Du müsstest neue Keys generieren und neue App-Version ohne Update-Funktion verteilen

**→ BACKUP DES PRIVATE KEYS ERSTELLEN!**

```bash
# Private Key sichern
cp ~/.tauri/timetracking.key ~/Desktop/timetracking-key-BACKUP.txt

# An sicherem Ort speichern (z.B. Passwort-Manager, verschlüsselter USB-Stick)
```

---

## 🐛 10. Troubleshooting

### Problem: "Resource not accessible by integration"
**Lösung:** Workflow permissions aktivieren (siehe Punkt 2)

### Problem: Build schlägt fehl
**Lösung:**
- Prüfe ob alle 3 Version-Dateien synchron sind
- Prüfe ob Secrets korrekt gesetzt sind
- Logs in GitHub Actions anschauen

### Problem: Update wird nicht gefunden
**Lösung:**
- Prüfe ob Release **published** ist (nicht Draft!)
- Prüfe ob `latest.json` im Release vorhanden ist
- Prüfe GitHub URL in `tauri.conf.json`

### Problem: "Signature verification failed"
**Lösung:**
- Public Key in `tauri.conf.json` prüfen
- Private Key in GitHub Secrets prüfen
- Stelle sicher dass derselbe Key verwendet wird!

---

## ✅ 11. Checkliste für jeden Release

- [ ] Version in 3 Dateien hochgezählt (package.json, Cargo.toml, tauri.conf.json)
- [ ] Änderungen committet
- [ ] Tag erstellt und gepusht (`git tag v1.0.x && git push origin v1.0.x`)
- [ ] GitHub Actions Build erfolgreich (grüner Haken)
- [ ] Draft Release überprüft
- [ ] Release veröffentlicht
- [ ] Update in App getestet (als Admin)
- [ ] CHANGELOG.md aktualisiert (optional, aber empfohlen)

---

## 📊 12. Release Notes Template

Beim Veröffentlichen des Release kannst du die Release Notes anpassen:

```markdown
## TimeTracking System v1.0.1

### 🎉 Neue Features
- Auto-Update System implementiert
- Admin kann jetzt Updates in den Einstellungen prüfen

### 🐛 Bug Fixes
- Zeitberechnung korrigiert (Soll-Stunden jetzt korrekt)
- Überstunden vor Einstellungsdatum werden nicht mehr berechnet

### 🔧 Verbesserungen
- Performance-Optimierungen
- UI-Verbesserungen im Dark Mode

### 📥 Installation
- **Windows:** Lade die `.exe` oder `.msi` Datei herunter
- **macOS:** Lade die `.dmg` Datei herunter (Universal Binary)
- **Linux:** Lade die `.AppImage` oder `.deb` Datei herunter

### 🔄 Update
Wenn du bereits Version 1.0.0 installiert hast:
1. Öffne die App
2. Gehe zu Einstellungen → Updates (als Admin)
3. Klicke "Auf Updates prüfen"
4. Installiere das Update

---
🤖 Automatisch erstellt mit [Tauri GitHub Action](https://github.com/tauri-apps/tauri-action)
```

---

## 🎓 13. Weitere Infos

- **Tauri Updater Docs:** https://v2.tauri.app/plugin/updater/
- **GitHub Actions Docs:** https://v2.tauri.app/distribute/pipelines/github/
- **Semantic Versioning:** https://semver.org/

---

**Viel Erfolg mit deinem Auto-Update System! 🚀**

Bei Fragen oder Problemen: Prüfe zuerst die Troubleshooting-Sektion oben.
