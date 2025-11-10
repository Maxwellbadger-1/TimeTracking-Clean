# GitHub Secrets Setup für CI/CD

## ⚙️ Benötigte Secrets einrichten

Um die automatische Deployment-Pipeline zu aktivieren, musst du folgende Secrets in GitHub einrichten:

### 📍 Wo?
GitHub Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 🔐 Secrets die du brauchst:

#### 1. **ORACLE_HOST**
```
129.159.8.19
```
- Die IP-Adresse deines Oracle Cloud Servers

#### 2. **ORACLE_USER**
```
ubuntu
```
- Der SSH-Username für Oracle Cloud

#### 3. **ORACLE_SSH_KEY**
```
-----BEGIN OPENSSH PRIVATE KEY-----
[Dein kompletter SSH Private Key]
-----END OPENSSH PRIVATE KEY-----
```
- Dein SSH Private Key von: `/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key`
- **WICHTIG:** Den kompletten Inhalt der Datei kopieren!

## 📝 Schritt-für-Schritt Anleitung:

### 1. GitHub Repository öffnen
```
https://github.com/Maxwellbadger-1/TimeTracking-Clean
```

### 2. Zu Settings navigieren
```
Settings (Tab oben) → Secrets and variables (links) → Actions
```

### 3. Secrets hinzufügen
Für jedes Secret:
- Klicke auf **"New repository secret"**
- **Name:** (siehe oben, z.B. `ORACLE_HOST`)
- **Secret:** (siehe oben, z.B. `129.159.8.19`)
- Klicke **"Add secret"**

### 4. SSH Key korrekt kopieren
```bash
# macOS/Linux:
cat "/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key"

# Kompletten Output (inklusive BEGIN/END Zeilen) kopieren
# und als ORACLE_SSH_KEY Secret einfügen
```

## ✅ Secrets Checklist

Nach dem Setup solltest du diese 3 Secrets haben:

- [ ] **ORACLE_HOST** = `129.159.8.19`
- [ ] **ORACLE_USER** = `ubuntu`
- [ ] **ORACLE_SSH_KEY** = `-----BEGIN OPENSSH PRIVATE KEY-----...`

## 🚀 Aktivierung

Sobald alle Secrets eingerichtet sind:

1. **Pushe Code zu GitHub:**
   ```bash
   git push origin main
   ```

2. **GitHub Actions startet automatisch:**
   - **Test Workflow** läuft (prüft TypeScript, Security, etc.)
   - **Deploy Workflow** läuft (deployed zu Oracle Cloud)

3. **Check Status:**
   ```
   https://github.com/Maxwellbadger-1/TimeTracking-Clean/actions
   ```

## 🔍 Troubleshooting

### "Permission denied (publickey)"
→ **ORACLE_SSH_KEY** ist falsch formatiert
→ Stelle sicher dass du den KOMPLETTEN Key kopiert hast (inklusive BEGIN/END)

### "Connection timeout"
→ **ORACLE_HOST** ist falsch
→ Überprüfe die IP: `129.159.8.19`

### "pm2: command not found"
→ PM2 ist nicht auf dem Server installiert
→ SSH zum Server und installiere PM2: `npm install -g pm2`

## 📚 Mehr Info

Siehe: https://docs.github.com/en/actions/security-guides/encrypted-secrets
