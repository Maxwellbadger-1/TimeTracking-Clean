# ⚡ Schnelle GitHub Secrets Einrichtung (5 Minuten)

## Option 1: Automatisches Script (wenn GitHub CLI fertig ist)

```bash
./setup-github-secrets.sh
```

**Dann sofort löschen:**
```bash
rm setup-github-secrets.sh
rm GITHUB-SECRETS-VALUES.md
```

---

## Option 2: Manuell (SCHNELLER!)

### 1️⃣ Öffne GitHub Secrets Seite

```
https://github.com/Maxwellbadger-1/TimeTracking-Clean/settings/secrets/actions
```

### 2️⃣ Erstelle 3 Secrets

Klicke auf **"New repository secret"** für jedes:

#### Secret 1: ORACLE_HOST
- **Name:** `ORACLE_HOST`
- **Secret:** `129.159.8.19`

#### Secret 2: ORACLE_USER
- **Name:** `ORACLE_USER`
- **Secret:** `ubuntu`

#### Secret 3: ORACLE_SSH_KEY
- **Name:** `ORACLE_SSH_KEY`
- **Secret:** Kompletten Inhalt von `/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key`

**So kopierst du den SSH Key:**
```bash
cat "/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key" | pbcopy
```
Dann CMD+V in GitHub einfügen.

---

## 3️⃣ Test ob es funktioniert

```bash
git push origin main
```

Dann öffne:
```
https://github.com/Maxwellbadger-1/TimeTracking-Clean/actions
```

Du solltest sehen:
- ✅ **CI - Automated Tests** (läuft)
- ✅ **CD - Deploy Server** (läuft)

---

## ⚠️ WICHTIG: Aufräumen

**SOFORT nach dem Setup:**

```bash
# Löschen der Credentials-Dateien
rm setup-github-secrets.sh
rm GITHUB-SECRETS-VALUES.md
rm /tmp/create-secrets.mjs

# GitHub Token widerrufen
# Gehe zu: https://github.com/settings/tokens
# Lösche den Token der für das Setup verwendet wurde
```

**Warum?**
- Diese Dateien enthalten Credentials im Klartext
- Jeder mit Zugriff kann dein Repo/Server kontrollieren
- **NIEMALS** sollten Secrets in Dateien gespeichert werden

---

## ✅ Erfolgs-Checklist

- [ ] 3 Secrets in GitHub erstellt
- [ ] `git push` triggered CI/CD Workflows
- [ ] Tests laufen durch (grüner Haken)
- [ ] Deployment zu Oracle Cloud erfolgreich
- [ ] Server Health Check OK
- [ ] Credentials-Dateien gelöscht
- [ ] GitHub Token widerrufen

---

## 🔍 Troubleshooting

### "Permission denied (publickey)"
→ SSH Key falsch kopiert. Stelle sicher du hast ALLES kopiert (inkl. `-----BEGIN` und `-----END`)

### "Connection timeout"
→ Oracle Host IP falsch. Überprüfe: `129.159.8.19`

### Workflow wird nicht getriggert
→ Push zu `main` branch notwendig. Checke: `git status`
→ Server code muss geändert sein (oder workflow_dispatch nutzen)

---

## 🎯 Was passiert nach dem Push?

1. **GitHub Actions startet automatisch**
2. **Test Workflow:**
   - TypeScript Type Check
   - Security Audit
   - Hardcoded URL Check
   - Environment File Check
3. **Deploy Workflow:**
   - SSH zu Oracle Cloud
   - Database Backup erstellen
   - Git Pull latest code
   - npm install + build
   - PM2 restart
   - Health Check

**Dauer:** ~3-5 Minuten

**Logs:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/actions
