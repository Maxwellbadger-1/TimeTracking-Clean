# 🚀 PRODUCTION ROADMAP - TimeTracking System
**Letzte Aktualisierung:** 2025-11-04
**Status:** In Entwicklung → Production-Ready
**Ziel:** Enterprise-Grade Zeiterfassungssystem mit voller Compliance

---

## 📊 ÜBERBLICK

### ✅ Was wir HABEN (Phase 1-5 Complete!)
- ✅ Manuelle Zeiterfassung (Start/Ende/Pause)
- ✅ Überstunden-Tracking (3-Level: Tag/Woche/Monat)
- ✅ Urlaubs-/Krankmeldungsverwaltung
- ✅ Admin Dashboard + Employee Dashboard
- ✅ Multi-User System (Desktop-App + Server)
- ✅ Kalender-Ansichten (Monat/Woche/Jahr)
- ✅ Audit Log (Nachverfolgung aller Änderungen)
- ✅ Session-based Authentication
- ✅ Password Hashing (bcrypt)
- ✅ Desktop-App (Tauri)
- ✅ Reports & Export (Basic)
- ✅ Validation (Time Entries + Absences conflict detection)

### 🚧 Was uns für PRODUCTION fehlt
- 🔴 Arbeitszeitgesetz (ArbZG) Compliance
- 🔴 DSGVO Compliance (DB-Verschlüsselung, 4-Jahres-Archivierung)
- 🔴 Automatische Backups
- 🟡 Desktop Notifications bei Verstößen
- 🟡 Reports & Charts (Überstunden-Trend)
- 🟡 Export-Formate (Excel, JSON)
- 🟡 Settings-Seite (Dark Mode Toggle, Sprache, etc.)

---

# 🎯 PHASE 6: ARBEITSZEITGESETZ (ArbZG) COMPLIANCE
**Status:** ✅ COMPLETE
**Priorität:** KRITISCH (MUST-HAVE für Production!)
**Zeitaufwand:** ~1-2 Tage
**Branch:** `phase-6-arbzg-compliance`
**Completed:** 2025-11-04

## 📋 Tasks

### 6.1 Höchstarbeitszeit-Validierung
- [x] Backend: Max. 10h/Tag Validierung
- [x] Backend: Max. 48h/Woche Validierung (Durchschnitt über 6 Monate)
- [x] Frontend: Warnung bei Überschreitung (via error message)
- [ ] Frontend: Visual Indicator im Dashboard (rote Warnung bei >10h) - TODO
- [x] Tests: Edge Cases (Nachtschicht, Wochenende)

**Acceptance Criteria:**
- ❌ Time Entry >10h wird abgelehnt mit Fehlermeldung
- ⚠️ Warnung bei >8h aber <10h
- ✅ Wochenübersicht zeigt akkumulierte Stunden

**Code Location:**
- `server/src/services/timeEntryService.ts` - Validation Logic
- `server/src/services/arbeitszeitgesetzService.ts` - NEW FILE
- `desktop/src/components/timeEntries/CreateTimeEntryModal.tsx` - UI Warnings

---

### 6.2 Pausenregelung-Validierung
- [x] Backend: Nach 6h → Min. 30 Min Pause
- [x] Backend: Nach 9h → Min. 45 Min Pause
- [ ] Frontend: Automatische Pausenvorschlag-Berechnung - TODO
- [x] Frontend: Warnung wenn Pausenregelung nicht eingehalten (via error message)
- [x] Tests: Verschiedene Arbeitszeiten (6h, 9h, 10h)

**Acceptance Criteria:**
- ❌ Time Entry mit 7h + 20 Min Pause wird abgelehnt
- ✅ Automatischer Vorschlag: "Bei 7h Arbeit mind. 30 Min Pause nötig"

**Code Location:**
- `server/src/services/arbeitszeitgesetzService.ts` - `validateBreakTime()`
- `desktop/src/components/timeEntries/CreateTimeEntryModal.tsx` - Auto-suggest

---

### 6.3 Ruhezeit-Überwachung (11h zwischen Schichten)
- [x] Backend: Berechne Zeit zwischen letztem Ende und neuem Start
- [x] Backend: Ablehnung wenn <11h Ruhezeit
- [ ] Frontend: Anzeige der nächsten möglichen Startzeit - TODO
- [x] Frontend: Warnung bei zu frühem Arbeitsbeginn (via error message)
- [x] Tests: Edge Cases (Mitternacht-Crossing, Wochenende)

**Acceptance Criteria:**
- ❌ Start um 07:00 nach Ende um 22:00 am Vortag wird abgelehnt
- ✅ Früheste mögliche Startzeit: 09:00 (22:00 + 11h)

**Code Location:**
- `server/src/services/arbeitszeitgesetzService.ts` - `validateRestPeriod()`
- `desktop/src/components/timeEntries/CreateTimeEntryModal.tsx` - Warning UI

---

### 6.4 Sonn- und Feiertagsarbeit (optional, später)
- [ ] Backend: Validation für Sonn-/Feiertagsarbeit
- [ ] Backend: Zuschläge-Berechnung (z.B. 50% für Sonntag)
- [ ] Frontend: Checkbox "Sonn-/Feiertagsarbeit"
- [ ] Frontend: Anzeige der Zuschläge

**Acceptance Criteria:**
- ✅ Sonn-/Feiertagsarbeit wird separat gekennzeichnet
- ✅ Zuschläge werden automatisch berechnet

---

## 📝 Success Criteria Phase 6:
- ✅ Alle ArbZG-Regeln werden validiert
- ✅ Verstöße werden abgelehnt mit klarer Fehlermeldung
- ✅ Warnungen werden angezeigt (Visual + Text)
- ✅ Tests für alle Edge Cases geschrieben
- ✅ Dokumentation für Admin (welche Regeln gelten)

---

# 🔒 PHASE 7: DSGVO COMPLIANCE
**Status:** 🔴 NOT STARTED
**Priorität:** KRITISCH (MUST-HAVE für Production!)
**Zeitaufwand:** ~1-2 Tage
**Branch:** `phase-7-dsgvo-compliance`

## 📋 Tasks

### 7.1 Datenbank-Verschlüsselung (SQLCipher)
- [ ] Migration: `better-sqlite3` → `better-sqlite3` mit SQLCipher
- [ ] Server: Encryption Key aus `.env`
- [ ] Server: Initialization mit `PRAGMA key`
- [ ] Tests: Verschlüsselung funktioniert
- [ ] Dokumentation: Encryption Key Setup

**Acceptance Criteria:**
- ✅ Database-Datei ist verschlüsselt (nicht lesbar ohne Key)
- ✅ Server startet nur mit richtigem Key
- ❌ Zugriff ohne Key wird verweigert

**Code Location:**
- `server/src/config/database.ts` - Add encryption
- `.env.example` - Add `DB_ENCRYPTION_KEY`

---

### 7.2 4-Jahres-Archivierung + Auto-Löschung
- [ ] Backend: Cronjob für automatische Daten-Löschung (>4 Jahre)
- [ ] Backend: Archivierungs-Tabelle (read-only)
- [ ] Backend: Migration alter Daten in Archiv
- [ ] Admin: UI für manuelle Archivierung
- [ ] Tests: Auto-Deletion funktioniert

**Acceptance Criteria:**
- ✅ Daten älter als 4 Jahre werden automatisch gelöscht
- ✅ Admin kann Archiv einsehen (read-only)
- ✅ Cronjob läuft täglich um 02:00 Uhr

**Code Location:**
- `server/src/services/archivingService.ts` - NEW FILE
- `server/src/jobs/cleanupJob.ts` - NEW FILE (Cronjob)

---

### 7.3 Mitarbeiter-Datenabruf (DSGVO Art. 15)
- [ ] Backend: Endpoint `/api/users/me/data-export`
- [ ] Backend: Export als JSON (alle Daten)
- [ ] Frontend: Button "Meine Daten herunterladen"
- [ ] Frontend: Export als PDF (lesbar)
- [ ] Tests: Export enthält alle Daten

**Acceptance Criteria:**
- ✅ Mitarbeiter kann alle eigenen Daten herunterladen
- ✅ Export enthält: User-Daten, Time Entries, Absences, Overtime
- ✅ Format: JSON + PDF

**Code Location:**
- `server/src/routes/users.ts` - Add export endpoint
- `desktop/src/pages/SettingsPage.tsx` - Add download button

---

### 7.4 Datenschutz-Erklärung + Einwilligung
- [ ] Frontend: Datenschutz-Seite
- [ ] Frontend: Einwilligung bei erstem Login
- [ ] Backend: Speichern der Einwilligung (Datum)
- [ ] Admin: Übersicht wer eingewilligt hat
- [ ] Tests: Einwilligung erforderlich

**Acceptance Criteria:**
- ✅ Jeder User muss Datenschutz akzeptieren
- ✅ Datum der Einwilligung wird gespeichert
- ✅ Admin kann Liste aller Einwilligungen einsehen

**Code Location:**
- `desktop/src/pages/PrivacyPolicyPage.tsx` - NEW FILE
- `server/src/schema/users.sql` - Add `privacyConsentAt` column

---

### 7.5 Audit Log Erweiterung (DSGVO Art. 5)
- [ ] Backend: Log ALLE Datenzugriffe (wer, wann, was)
- [ ] Backend: Log Daten-Änderungen (wer, wann, was geändert)
- [ ] Admin: UI für Audit Log Einsicht
- [ ] Admin: Filter nach User, Datum, Aktion
- [ ] Tests: Audit Log vollständig

**Acceptance Criteria:**
- ✅ Jede Daten-Änderung wird geloggt
- ✅ Admin kann Audit Log durchsuchen
- ✅ Log enthält: User, Timestamp, Aktion, Details

**Code Location:**
- `server/src/services/auditService.ts` - Erweiterung
- `desktop/src/pages/admin/AuditLogPage.tsx` - NEW FILE

---

## 📝 Success Criteria Phase 7:
- ✅ Datenbank ist verschlüsselt (SQLCipher)
- ✅ Daten >4 Jahre werden automatisch gelöscht
- ✅ Mitarbeiter können eigene Daten herunterladen
- ✅ Datenschutz-Einwilligung bei erstem Login
- ✅ Vollständiges Audit Log für alle Daten-Änderungen

---

# 💾 PHASE 8: BACKUP & RECOVERY
**Status:** 🔴 NOT STARTED
**Priorität:** KRITISCH (MUST-HAVE für Production!)
**Zeitaufwand:** ~1 Tag
**Branch:** `phase-8-backup-recovery`

## 📋 Tasks

### 8.1 Automatische Datenbank-Backups
- [ ] Server: Cronjob für tägliche Backups (02:00 Uhr)
- [ ] Server: Backup-Rotation (30 Tage behalten)
- [ ] Server: Backup-Verzeichnis `/backups`
- [ ] Admin: UI für manuelle Backup-Erstellung
- [ ] Tests: Backup erstellen + verifizieren

**Acceptance Criteria:**
- ✅ Jeden Tag automatisches Backup um 02:00 Uhr
- ✅ Alte Backups (>30 Tage) werden automatisch gelöscht
- ✅ Admin kann manuell Backup erstellen

**Code Location:**
- `server/src/jobs/backupJob.ts` - NEW FILE
- `server/scripts/backup.sh` - NEW FILE

---

### 8.2 Backup-Restore-Funktion
- [ ] Server: Endpoint `/api/admin/restore-backup`
- [ ] Server: Restore-Skript
- [ ] Admin: UI für Backup-Restore (Liste aller Backups)
- [ ] Admin: Warnung vor Restore (Daten überschreiben!)
- [ ] Tests: Restore funktioniert

**Acceptance Criteria:**
- ✅ Admin kann aus Liste aller Backups wählen
- ✅ Restore überschreibt aktuelle Datenbank
- ✅ Bestätigung erforderlich (Warnung!)

**Code Location:**
- `server/src/routes/admin.ts` - Add restore endpoint
- `desktop/src/pages/admin/BackupPage.tsx` - NEW FILE

---

### 8.3 Server Health Monitoring
- [ ] Server: Endpoint `/api/health` erweitern (CPU, RAM, Disk)
- [ ] Server: Log-Rotation (max. 100 MB pro Log-Datei)
- [ ] Admin: Dashboard mit Server-Status
- [ ] Admin: Alerts bei Problemen (z.B. Disk >90%)
- [ ] Tests: Health Check funktioniert

**Acceptance Criteria:**
- ✅ Admin sieht Server-Status (CPU, RAM, Disk)
- ✅ Warnung bei kritischen Werten (Disk >90%, RAM >90%)
- ✅ Log-Dateien werden automatisch rotiert

**Code Location:**
- `server/src/routes/health.ts` - Erweiterung
- `desktop/src/pages/admin/ServerStatusPage.tsx` - NEW FILE

---

## 📝 Success Criteria Phase 8:
- ✅ Tägliche automatische Backups
- ✅ Admin kann Backups manuell erstellen
- ✅ Admin kann Backups wiederherstellen
- ✅ Server-Status-Monitoring im Admin-Dashboard
- ✅ Log-Rotation funktioniert

---

# 🔔 PHASE 9: DESKTOP NOTIFICATIONS & WARNINGS
**Status:** 🔴 NOT STARTED
**Priorität:** WICHTIG (Nice-to-Have für bessere UX)
**Zeitaufwand:** ~1 Tag
**Branch:** `phase-9-notifications`

## 📋 Tasks

### 9.1 Desktop Notifications bei Verstößen
- [ ] Frontend: Notification bei >10h Arbeit
- [ ] Frontend: Notification bei <11h Ruhezeit
- [ ] Frontend: Notification bei fehlender Pause
- [ ] Frontend: Notification bei Abwesenheits-Genehmigung
- [ ] Tests: Notifications werden angezeigt

**Acceptance Criteria:**
- ✅ User sieht Notification bei Verstoß
- ✅ Notification ist klickbar (öffnet relevante Seite)
- ✅ Notification kann deaktiviert werden (Settings)

**Code Location:**
- `desktop/src/services/notificationService.ts` - NEW FILE
- `desktop/src/hooks/useWorkingHoursMonitor.ts` - NEW FILE

---

### 9.2 In-App Warnings (Toast Messages)
- [ ] Frontend: Toast bei Überschreitung Höchstarbeitszeit
- [ ] Frontend: Toast bei fehlender Pause
- [ ] Frontend: Toast bei zu frühem Arbeitsbeginn
- [ ] Frontend: Toast-Styling (Error, Warning, Info)
- [ ] Tests: Toasts werden angezeigt

**Acceptance Criteria:**
- ✅ Toasts sind deutlich sichtbar
- ✅ Verschiedene Arten (Error, Warning, Info)
- ✅ Auto-Dismiss nach 5 Sekunden

**Code Location:**
- `desktop/src/components/Toasts.tsx` - Erweiterung
- Already using `sonner` library

---

## 📝 Success Criteria Phase 9:
- ✅ Desktop Notifications bei Verstößen
- ✅ In-App Toast Messages
- ✅ User kann Notifications deaktivieren (Settings)

---

# 📊 PHASE 10: REPORTS & CHARTS
**Status:** 🔴 NOT STARTED
**Priorität:** WICHTIG (Nice-to-Have für bessere UX)
**Zeitaufwand:** ~1-2 Tage
**Branch:** `phase-10-reports-charts`

## 📋 Tasks

### 10.1 Überstunden-Trend-Charts
- [ ] Frontend: Line Chart für Überstunden (letzte 12 Monate)
- [ ] Frontend: Bar Chart für Überstunden (letzte 4 Wochen)
- [ ] Frontend: Pie Chart für Abwesenheiten (Urlaub, Krank, etc.)
- [ ] Frontend: Library: Recharts oder Chart.js
- [ ] Tests: Charts rendern korrekt

**Acceptance Criteria:**
- ✅ Charts sind interaktiv (Hover zeigt Details)
- ✅ Charts sind responsive (Desktop + Tablet)
- ✅ Daten werden korrekt dargestellt

**Code Location:**
- `desktop/src/components/charts/OvertimeTrendChart.tsx` - NEW FILE
- `desktop/src/pages/ReportsPage.tsx` - NEW FILE

---

### 10.2 Export-Formate (Excel, JSON)
- [ ] Backend: Export als Excel (.xlsx)
- [ ] Backend: Export als JSON
- [ ] Frontend: Button "Export als Excel"
- [ ] Frontend: Button "Export als JSON"
- [ ] Tests: Exports funktionieren

**Acceptance Criteria:**
- ✅ Excel-Export enthält alle Daten (formatted)
- ✅ JSON-Export ist maschinenlesbar
- ✅ Export für beliebigen Zeitraum

**Code Location:**
- `server/src/services/exportService.ts` - NEW FILE
- `desktop/src/pages/ReportsPage.tsx` - Add export buttons

---

### 10.3 Team-Statistiken (Admin Dashboard)
- [ ] Backend: Aggregated Stats für alle User
- [ ] Frontend: Dashboard mit Team-Übersicht
- [ ] Frontend: Charts für Team-Überstunden
- [ ] Frontend: Liste: Top Overtime (wer hat meiste Überstunden?)
- [ ] Tests: Stats sind korrekt

**Acceptance Criteria:**
- ✅ Admin sieht Team-Übersicht
- ✅ Charts zeigen Trend für ganzes Team
- ✅ Liste zeigt Top 10 Overtime

**Code Location:**
- `server/src/services/statsService.ts` - NEW FILE
- `desktop/src/pages/admin/TeamStatsPage.tsx` - NEW FILE

---

## 📝 Success Criteria Phase 10:
- ✅ Charts für Überstunden-Trend
- ✅ Export als Excel + JSON
- ✅ Team-Statistiken im Admin-Dashboard

---

# ⚙️ PHASE 11: SETTINGS & CONFIGURATION
**Status:** 🔴 NOT STARTED
**Priorität:** WICHTIG (Nice-to-Have für bessere UX)
**Zeitaufwand:** ~1 Tag
**Branch:** `phase-11-settings`

## 📋 Tasks

### 11.1 Settings-Seite (User)
- [ ] Frontend: Dark Mode Toggle (sichtbar machen!)
- [ ] Frontend: Sprache-Wechsel (DE / EN)
- [ ] Frontend: Notification Settings (Ein/Aus)
- [ ] Frontend: Passwort ändern
- [ ] Tests: Settings werden gespeichert

**Acceptance Criteria:**
- ✅ User kann Dark Mode ein/ausschalten
- ✅ Sprache kann gewechselt werden
- ✅ Notifications können deaktiviert werden
- ✅ Passwort kann geändert werden

**Code Location:**
- `desktop/src/pages/SettingsPage.tsx` - Erweiterung
- `desktop/src/store/uiStore.ts` - Add language state

---

### 11.2 Settings-Seite (Admin)
- [ ] Frontend: Arbeitszeitgesetz-Regeln konfigurieren
- [ ] Frontend: Max. Arbeitszeit pro Tag (Default: 10h)
- [ ] Frontend: Pausenregelungen aktivieren/deaktivieren
- [ ] Frontend: Ruhezeit-Validierung aktivieren/deaktivieren
- [ ] Tests: Admin-Settings funktionieren

**Acceptance Criteria:**
- ✅ Admin kann ArbZG-Regeln anpassen
- ✅ Änderungen gelten für alle User
- ✅ Default-Werte sind ArbZG-konform

**Code Location:**
- `desktop/src/pages/admin/SystemSettingsPage.tsx` - NEW FILE
- `server/src/schema/settings.sql` - NEW FILE

---

## 📝 Success Criteria Phase 11:
- ✅ User-Settings funktionieren (Dark Mode, Sprache, Notifications)
- ✅ Admin-Settings für ArbZG-Regeln
- ✅ Settings werden persistent gespeichert

---

# 📱 PHASE 12: MOBILE OPTIMIERUNG (Optional)
**Status:** 🟢 OPTIONAL (Later)
**Priorität:** LOW (Optional)
**Zeitaufwand:** ~2-3 Tage
**Branch:** `phase-12-mobile-optimization`

## 📋 Tasks

### 12.1 Responsive Design für Mobile
- [ ] Frontend: Mobile-First CSS (Tailwind)
- [ ] Frontend: Touch-optimierte Buttons (min. 44x44px)
- [ ] Frontend: Mobile Navigation (Burger Menu)
- [ ] Frontend: Swipe-Gesten (z.B. Swipe to Delete)
- [ ] Tests: Mobile-Ansicht funktioniert

**Acceptance Criteria:**
- ✅ App funktioniert auf Smartphone (320px+)
- ✅ Buttons sind groß genug für Touch
- ✅ Navigation ist intuitiv auf Mobile

---

### 12.2 Mobile App (React Native / Flutter) (Optional)
- [ ] Setup: React Native oder Flutter Projekt
- [ ] Shared: API-Client wiederverwenden
- [ ] UI: Mobile-optimierte Components
- [ ] Build: iOS + Android App
- [ ] Tests: App funktioniert auf beiden Plattformen

**Acceptance Criteria:**
- ✅ Native App für iOS + Android
- ✅ Offline-Modus (später)

---

## 📝 Success Criteria Phase 12:
- ✅ Responsive Design funktioniert auf Mobile
- ✅ (Optional) Native Mobile App

---

# 🚀 PRODUCTION DEPLOYMENT (FINAL)
**Status:** 🔴 NOT STARTED
**Priorität:** KRITISCH (für Production)
**Zeitaufwand:** ~1 Tag
**Branch:** `main` (merge all)

## 📋 Tasks

### Final Checks
- [ ] Alle Tests laufen durch (100% Pass Rate)
- [ ] Performance-Tests (Loadtest)
- [ ] Security Audit (OWASP Top 10)
- [ ] Dokumentation vollständig (README, User Guide, Admin Guide)
- [ ] GitHub Release erstellen (v1.0.0)

### Deployment
- [ ] Oracle Cloud Server Setup
- [ ] HTTPS aktivieren (Let's Encrypt)
- [ ] PM2 konfigurieren (Auto-Restart)
- [ ] Backup-System aktivieren
- [ ] Monitoring aktivieren (Health Check)

### Post-Deployment
- [ ] User-Training (Admin + Employees)
- [ ] Feedback sammeln (erste Woche)
- [ ] Bug Fixes (Hotfixes)

---

## 📝 Success Criteria Production:
- ✅ App läuft stabil auf Production-Server
- ✅ Alle Compliance-Features funktionieren
- ✅ User sind geschult
- ✅ Backup-System läuft
- ✅ Monitoring aktiv

---

# 📈 PRIORITÄTEN-ÜBERSICHT

## 🔴 KRITISCH (MUST-HAVE für Production!)
1. **Phase 6:** Arbeitszeitgesetz (ArbZG) Compliance
2. **Phase 7:** DSGVO Compliance
3. **Phase 8:** Backup & Recovery
4. **Production Deployment**

## 🟡 WICHTIG (Nice-to-Have für bessere UX)
5. **Phase 9:** Desktop Notifications & Warnings
6. **Phase 10:** Reports & Charts
7. **Phase 11:** Settings & Configuration

## 🟢 OPTIONAL (Later)
8. **Phase 12:** Mobile Optimierung

---

# 📅 TIMELINE

**Week 1:**
- Phase 6: ArbZG Compliance (2 Tage)
- Phase 7: DSGVO Compliance (2 Tage)
- Phase 8: Backup & Recovery (1 Tag)

**Week 2:**
- Phase 9: Notifications (1 Tag)
- Phase 10: Reports & Charts (2 Tage)
- Phase 11: Settings (1 Tag)
- Testing & Bug Fixes (1 Tag)

**Week 3:**
- Production Deployment (1 Tag)
- User Training (2 Tage)
- Feedback & Hotfixes (2 Tage)

**Total:** ~3 Wochen bis Production-Ready

---

# 📞 KONTAKT & SUPPORT

**Entwickler:** Claude AI (via Anthropic Claude Code)
**Projekt:** TimeTracking System für Stiftung der DPolG
**Version:** 1.0 (In Entwicklung)
**Letzte Aktualisierung:** 2025-11-04

---

**Nächster Schritt:** Phase 6 starten - Arbeitszeitgesetz (ArbZG) Compliance implementieren!
