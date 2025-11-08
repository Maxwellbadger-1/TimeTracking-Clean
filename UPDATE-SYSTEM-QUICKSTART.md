# ⚡ Quick Start: Erster Release

**Schnellanleitung um dein erstes Update-fähiges Release zu veröffentlichen**

---

## 🎯 Schritt 1: GitHub Secrets hinzufügen (NUR EINMAL!)

Gehe zu: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions

**Erstelle 2 Secrets:**

### Secret 1: TAURI_SIGNING_PRIVATE_KEY
Kopiere den Inhalt aus: `TAURI_PRIVATE_KEY_BACKUP.txt` (liegt im Projekt-Root)

### Secret 2: TAURI_SIGNING_PRIVATE_KEY_PASSWORD
Wert: (leer lassen - einfach leer speichern)

---

## 🔧 Schritt 2: Workflow Permissions aktivieren (NUR EINMAL!)

Gehe zu: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/actions

Wähle: **Read and write permissions**
Klicke: **Save**

---

## 📝 Schritt 3: GitHub URL in Config eintragen (NUR EINMAL!)

Öffne: `desktop/src-tauri/tauri.conf.json`

Zeile 57 ändern:
```json
"endpoints": [
  "https://github.com/DEIN_USERNAME/DEIN_REPO/releases/latest/download/latest.json"
]
```

Beispiel:
```json
"endpoints": [
  "https://github.com/maxfegg/TimeTracking-Clean/releases/latest/download/latest.json"
]
```

---

## 🚀 Schritt 4: Ersten Release erstellen

```bash
# 1. Version prüfen (sollte 1.0.0 sein)
cat desktop/package.json | grep version
cat desktop/src-tauri/Cargo.toml | grep version
cat desktop/src-tauri/tauri.conf.json | grep version

# 2. Alle Änderungen committen
git add .
git commit -m "feat: Auto-Update System implementiert"

# 3. Tag erstellen und pushen
git tag v1.0.0
git push origin v1.0.0
```

**Das war's!** GitHub Actions baut jetzt automatisch alle Versionen (Windows, macOS, Linux).

---

## ⏱️ Schritt 5: Warten & Veröffentlichen

1. Gehe zu: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
2. Warte ca. 10-20 Minuten bis Build fertig ist ✅
3. Gehe zu: https://github.com/YOUR_USERNAME/YOUR_REPO/releases
4. Klicke auf den **Draft** Release
5. Klicke **Publish release**

**Fertig! 🎉**

---

## 🔄 Nächstes Update (z.B. v1.0.1)

```bash
# 1. Version in 3 Dateien auf 1.0.1 ändern
#    - desktop/package.json
#    - desktop/src-tauri/Cargo.toml
#    - desktop/src-tauri/tauri.conf.json

# 2. Änderungen committen
git add .
git commit -m "chore: Bump version to 1.0.1"

# 3. Neuen Tag pushen
git tag v1.0.1
git push origin v1.0.1

# 4. Warten, Draft Release veröffentlichen
```

---

## 💡 Wichtige Dateien

- **RELEASE-ANLEITUNG.md** - Vollständige Dokumentation
- **TAURI_PRIVATE_KEY_BACKUP.txt** - Private Key Backup (SICHER AUFBEWAHREN!)
- **.github/workflows/release.yml** - GitHub Actions Workflow
- **desktop/src/components/settings/UpdateChecker.tsx** - Update UI

---

## ❓ Probleme?

Siehe **RELEASE-ANLEITUNG.md** → Abschnitt "Troubleshooting"

---

**Das war's! Viel Erfolg! 🚀**
