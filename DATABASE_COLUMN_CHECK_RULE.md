# KRITISCHE REGEL: DATABASE SPALTEN-CHECK

**PFLICHT vor JEDER Datenbank-Änderung!**

## Schritt-für-Schritt Prozess:

### 1. IMMER ZUERST: Alle existierenden Spalten prüfen
```bash
sqlite3 database.db "PRAGMA table_info(table_name);"
```

**Ergebnis genau durchlesen!** Alle Spalten notieren:
- Spalten-Index
- Spalten-Name
- Datentyp
- NOT NULL?
- Default-Wert

### 2. Mit Schema-Definition vergleichen
```bash
# Schema-Datei öffnen und vergleichen
cat server/src/database/schema.ts
```

**Prüfen:**
- Welche Spalten sind im Code definiert?
- Welche Spalten existieren in der DB?
- Was fehlt? Was ist extra?

### 3. Nur bei Unterschied: Migration planen
```sql
-- NUR wenn Spalte wirklich fehlt:
ALTER TABLE table_name ADD COLUMN column_name TYPE DEFAULT value;

-- Bestehende Daten aktualisieren falls nötig:
UPDATE table_name SET column_name = 'default' WHERE column_name IS NULL;
```

### 4. NIEMALS ohne Prüfung:
❌ Neue Spalten hinzufügen ohne PRAGMA check
❌ Datenbank löschen ohne Backup
❌ ALTER TABLE ohne Verifikation
❌ Annehmen dass Spalten fehlen

### 5. Nach Änderung: Verifizieren
```bash
# Erneut prüfen ob alles stimmt
sqlite3 database.db "PRAGMA table_info(table_name);"

# Daten prüfen
sqlite3 database.db "SELECT * FROM table_name LIMIT 1;"
```

## Warum diese Regel?

**Problem:** Ich habe vorschnell `ALTER TABLE users ADD COLUMN hireDate` ausgeführt, obwohl die Spalte bereits im Schema definiert war.

**Fehler:** Nicht gründlich genug geprüft welche Spalten tatsächlich existieren.

**Lösung:** Diese Regel IMMER befolgen!

---

**Erstellt:** 2025-11-07
**Grund:** Vermeidung unnötiger Datenbank-Operationen
**Status:** AKTIV - PFLICHT bei jeder DB-Operation
