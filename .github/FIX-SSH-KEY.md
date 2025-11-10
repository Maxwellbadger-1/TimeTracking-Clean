# 🔑 SSH Key Fix für GitHub Actions

## Problem
```
ssh.ParsePrivateKey: ssh: no key found
ssh: handshake failed: ssh: unable to authenticate
```

Der SSH Key in GitHub Secrets ist **nicht korrekt formatiert**.

---

## ✅ Lösung (5 Minuten)

### Schritt 1: Key korrekt kopieren

**Terminal:**
```bash
cat "/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key" | pbcopy
```

### Schritt 2: GitHub Secret aktualisieren

1. **Öffne:**
   ```
   https://github.com/Maxwellbadger-1/TimeTracking-Clean/settings/secrets/actions
   ```

2. **Finde "ORACLE_SSH_KEY"** und klicke **"Update"**

3. **Lösche alten Inhalt** (SELECT ALL → DELETE)

4. **Füge neuen Key ein:** CMD+V

5. **Verifikation:** Der Key MUSS so aussehen:

```
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAtIv0W3IqGNB6k6tpopHOwZW4fnqWlvTWs2ba7MCG4jC129yW
... (25 Zeilen Base64)
-----END RSA PRIVATE KEY-----
```

**WICHTIG:**
- ✅ Erste Zeile: `-----BEGIN RSA PRIVATE KEY-----`
- ✅ Letzte Zeile: `-----END RSA PRIVATE KEY-----`
- ✅ Keine Leerzeichen vor/nach dem Key
- ✅ Alle 27 Zeilen müssen vorhanden sein
- ✅ Zeilenumbrüche MÜSSEN erhalten bleiben!

6. **Klicke "Update secret"**

### Schritt 3: Deployment testen

**Terminal:**
```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean

# Trigger neues Deployment (Empty Commit)
git commit --allow-empty -m "test: Trigger deployment after SSH key fix"
git push origin main
```

**Dann öffne:**
```
https://github.com/Maxwellbadger-1/TimeTracking-Clean/actions
```

Du solltest sehen:
- 🟡 **CD - Deploy Server** (running...)
- Nach ~2-3 Minuten:
  - ✅ Grüner Haken = Success!
  - ❌ Rotes X = Immer noch Fehler (Logs checken)

---

## 🔍 Debugging: Wenn es immer noch fehlschlägt

### Manuelle SSH-Verbindung testen

```bash
# Test SSH Key lokal
ssh -i "/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key" ubuntu@129.159.8.19
```

**Erwartete Ausgabe:**
```
Welcome to Ubuntu 22.04.x LTS
```

**Wenn es funktioniert:** Key ist korrekt, Problem liegt bei GitHub Secret-Formatierung

**Wenn Permission denied:**
```bash
# Key-Rechte fixen
chmod 600 "/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key"

# Nochmal testen
ssh -i "/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key" ubuntu@129.159.8.19
```

### GitHub Actions Logs checken

Wenn Deployment fehlschlägt, öffne:
```
https://github.com/Maxwellbadger-1/TimeTracking-Clean/actions
```

Klicke auf den fehlgeschlagenen Run → "Deploy to Oracle Cloud via SSH"

**Häufige Fehler:**

1. **"ssh: no key found"** → Key falsch formatiert (Zeilenumbrüche fehlen)
2. **"Permission denied (publickey)"** → Falscher Key oder falscher User
3. **"Connection timeout"** → Falsche IP oder Server offline
4. **"Health check failed"** → Server läuft, aber Application crashed

---

## ✅ Erfolgs-Checklist

- [ ] SSH Key mit `pbcopy` kopiert
- [ ] GitHub Secret "ORACLE_SSH_KEY" aktualisiert
- [ ] Key hat 27 Zeilen (BEGIN → END)
- [ ] Empty Commit + Push getriggert
- [ ] GitHub Actions läuft (gelber Kreis)
- [ ] Deployment erfolgreich (grüner Haken)
- [ ] Oracle Server läuft: `pm2 status` zeigt "online"

---

## 📊 Erwartete GitHub Actions Ausgabe (Success)

```
🚀 Starting deployment...
💾 Creating database backup...
📥 Pulling latest code from GitHub...
🧹 Cleaning up old files...
📦 Installing dependencies...
🔨 Building TypeScript...
🔄 Restarting PM2...
⏳ Waiting for server to start...
🏥 Running health check...
✅ Deployment successful! Server is healthy

┌────────────────────────┬──────┬─────────┐
│ Name                   │ Mode │ Status  │
├────────────────────────┼──────┼─────────┤
│ timetracking-server    │ fork │ online  │
└────────────────────────┴──────┴─────────┘
```

---

## 🆘 Noch Probleme?

SSH direkt auf Server und checke Logs:
```bash
ssh -i "/Users/maximilianfegg/Downloads/ssh-key-2025-11-02 (2).key" ubuntu@129.159.8.19

# Auf dem Server:
cd /home/ubuntu/TimeTracking-Clean
pm2 logs timetracking-server --lines 50
```
