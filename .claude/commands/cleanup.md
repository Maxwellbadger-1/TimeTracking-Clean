# /cleanup - Speicherplatz freigeben (Build-Artifacts löschen)

**Zweck:** Entfernt Build-Artifacts (node_modules, target/, etc.) um Speicherplatz freizugeben

**Wann nutzen:**
- ✅ MacBook Speicher ist voll
- ✅ Projekt ist > 2 GB
- ✅ Regelmäßig (monatlich) zur Wartung
- ✅ Vor Wechsel zwischen Mac & Windows (optional)

---

## Was macht dieser Command?

1. **Checkt Git Status** → Warnung falls uncommitted changes
2. **Zeigt Projekt-Größe** → Vorher/Nachher Vergleich
3. **Löscht Build-Artifacts:**
   - `desktop/src-tauri/target/` - Rust Build-Cache (~6-8 GB!)
   - `node_modules/` - Root Dependencies (~500 MB)
   - `desktop/node_modules/` - Desktop Dependencies (~15 MB)
   - `server/node_modules/` - Server Dependencies (~50 MB)
   - `dist/`, `build/` - Build Output (falls vorhanden)
4. **Reinstalliert Dependencies** (optional)

---

## Workflow

```bash
# 1. Check Git Status
git status

# 2. Falls uncommitted changes → Commit zuerst!
git add .
git commit -m "feat: Your changes"
git push origin main

# 3. Zeige Projekt-Größe VOR Cleanup
du -sh .
du -sh ./* | sort -hr | head -10

# 4. Lösche Build-Artifacts (SICHER - ist in .gitignore)
rm -rf desktop/src-tauri/target     # Rust Build-Cache
rm -rf node_modules                  # Root Dependencies
rm -rf desktop/node_modules          # Desktop Dependencies
rm -rf server/node_modules           # Server Dependencies
rm -rf dist/ build/ .next/           # Build Output

# 5. Zeige Projekt-Größe NACH Cleanup
du -sh .

# 6. (Optional) Reinstalliere Dependencies
npm install
cd desktop && npm install
cd ../server && npm install
```

---

## Erwartete Ergebnisse

| Vorher | Nachher (ohne npm install) | Nachher (mit npm install) |
|--------|----------------------------|---------------------------|
| 7.3 GB | 92 MB | 458 MB |
| **-6.8 GB** | **98.7% Ersparnis!** | **93.7% Ersparnis** |

---

## Safety Checks

**✅ SICHER zu löschen (in .gitignore):**
- `desktop/src-tauri/target/` - Wird beim nächsten Build neu erstellt
- `node_modules/` - Wird mit `npm install` neu erstellt
- `dist/`, `build/` - Wird mit `npm run build` neu erstellt

**❌ NIEMALS löschen:**
- `server/database.db` - Lokale Datenbank (mit Daten!)
- `.env*` - Environment Config
- Source Code Ordner (`src/`, `desktop/src/`, `server/src/`)

---

## Häufige Fragen

**Q: Verliere ich Daten?**
A: Nein! Nur Build-Artifacts werden gelöscht, die automatisch neu gebaut werden können.

**Q: Kann ich weiterarbeiten?**
A: Ja, aber du musst Dependencies reinstallieren:
```bash
npm install && cd desktop && npm install && cd ../server && npm install
```

**Q: Wie lange dauert Rebuild?**
A:
- `npm install`: ~1-2 Minuten
- Tauri `target/`: ~5-10 Minuten beim ersten Build

**Q: Muss ich das regelmäßig machen?**
A: Optional, aber empfohlen (monatlich oder bei Speicherplatz-Problemen)

**Q: Funktioniert das auch für andere Projekte?**
A: Ja! Cleanup funktioniert für alle Node.js/Rust/Tauri Projekte.

---

## Alternative: Nur Rust Cache löschen

Falls du nur Rust Cache löschen willst (größter Teil):

```bash
# Nur Rust target/ löschen (~6.8 GB)
rm -rf desktop/src-tauri/target

# Ergebnis: 7.3 GB → 500 MB (ohne node_modules!)
```

---

## Automatisierung (Optional)

**Monatlicher Cleanup via Cron:**

```bash
# Füge zu ~/.zshrc hinzu:
alias cleanup-timetracking="cd ~/Desktop/TimeTracking-Clean && rm -rf desktop/src-tauri/target node_modules desktop/node_modules server/node_modules && echo '✅ Cleanup done!' && du -sh ."

# Nutzung:
cleanup-timetracking
```

---

**Version:** 1.0 (2026-02-11)
**Status:** ✅ Production Ready
**Ersparnis:** ~6.8 GB pro Cleanup
