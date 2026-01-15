# Changelog

All notable changes to **TimeTracking System** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- ARCHITECTURE.md - Complete software architecture documentation
- PROJECT_STATUS.md - Living status dashboard for project health tracking
- CHANGELOG.md - Comprehensive version history (this file)
- Documentation structure improvements for AI development context

### Changed
- Refactored PROJECT_SPEC.md - Separated architecture into dedicated document
- Improved documentation navigation and cross-references

---

## [1.5.1] - 2026-01-15

### Fixed
- Email deletion functionality not working correctly
- Notifications loading issues resolved
- Database query optimization for notification retrieval

### Changed
- Version bump to v1.5.1 for patch release

---

## [1.5.0] - 2026-01-14

### Added
- **Strict Absence Validation** - Prevents time entry creation during pending or approved absences
- Error messages for time entry conflicts with absence periods
- Data integrity checks to prevent payroll conflicts

### Security
- Prevents data conflicts between time entries and absences
- Improved validation logic for absence periods

### Fixed
- Issue where users could create time entries while on approved vacation
- Data inconsistencies between time tracking and absence management

---

## [1.4.0] - 2026-01-10

### Added
- Missing `position` column added to database schema
- Support for employee position/title tracking

### Changed
- Database schema version 1.4.0
- Migration script for existing databases

---

## [1.3.0] - 2025-12-20

### Fixed
- **Critical Bug:** Weekend bug in overtime calculations (Benedikt Jochem case)
- Weekends were incorrectly counted as workdays for standard employees
- `getDailyTargetHours()` function in `workingDays.ts` corrected

### Changed
- Overtime calculation now correctly excludes weekends
- Working days calculation improved for accuracy

### Example
- **Before Bug Fix:** Benedikt showed +13:30h overtime (wrong - weekends counted)
- **After Bug Fix:** Benedikt shows +37:30h overtime (correct - weekends excluded)

---

## [1.2.0] - 2025-12-16

### Added
- Comprehensive input validation utilities (`src/utils/validation.ts`)
- Rate limiting on absence creation endpoint (DoS protection)
- Overnight shift overlap detection (22:00-02:00 shifts now detected correctly)
- Vacation carryover validation (max 5 days from previous year)
- Weekly hours validation (1-80 hours range)

### Fixed
- Issue #6: SQL injection prevention via date string validation
- Issue #7: Hire date validation order (fail fast optimization)
- Issue #8: Rate limiting on absence creation (30 requests/hour)
- Issue #9: Overnight shift overlap detection
- Issue #10: Vacation carryover validation against previous year
- Issue #11: Simplified absence overlap logic (standard interval formula)
- Issue #13: Weekly hours validation (prevent extreme values)

### Security
- Input sanitization for all date/time strings
- XSS prevention via `sanitizeString()` utility
- DoS protection via rate limiting

### Performance
- Validation optimization - cheap checks before expensive operations

### Changed
- Absence overlap detection simplified using standard interval formula
- Validation moved to centralized utilities

### Verified
- Issue #12: DST handling already correct (no changes needed)

### Documentation
- HIGH_PRIORITY_FIXES.md created with comprehensive issue tracking
- All fixes documented with commit hashes and impact analysis

---

## [1.1.0] - 2025-12-01

### Added
- **Auto-Update System** - Cryptographically signed updates via minisign
- Desktop notifications for absence status changes
- **Dark Mode** support with auto-detection and manual toggle
- **Keyboard Shortcuts** for power users (Ctrl+N, Ctrl+K, etc.)
- System tray integration for desktop apps

### Changed
- Improved UI/UX across all pages
- Enhanced calendar views with better visual indicators

### Security
- Ed25519 signature verification for auto-updates
- Public key embedded in app binary for security

---

## [1.0.0] - 2025-11-15

### Added
- Initial production release
- Multi-user time tracking system
- Desktop applications for Windows, macOS, and Linux (Tauri 2.x)
- Cloud-based backend (Oracle Cloud Frankfurt)
- User authentication & authorization (Admin/Employee roles)
- Time entry management (manual tracking with start/end/break times)
- Absence management system (vacation, sick leave, overtime compensation)
- Overtime calculation engine (German labor law compliant)
- Vacation balance tracking with carryover logic
- Calendar views (Month, Week, Year, Team)
- German public holidays support
- CSV export for payroll systems (DATEV format)
- Real-time synchronization via WebSocket
- SQLite database with WAL mode (multi-user support)
- Automated backup system (GFS rotation)
- DSGVO compliance (data stored in Frankfurt, Germany)
- GitHub Actions CI/CD pipeline
- Zero-downtime deployments via PM2

### Technology Stack
- **Frontend:** Tauri 2.x, React 18, TypeScript, TanStack Query, Zustand, Tailwind CSS
- **Backend:** Node.js 20, Express, SQLite, bcrypt, WebSocket
- **DevOps:** GitHub Actions, PM2, Oracle Cloud Free Tier

### Security
- bcrypt password hashing (cost factor 10)
- HttpOnly session cookies (24h expiry)
- HTTPS communication (Let's Encrypt)
- SQL injection prevention (prepared statements)
- XSS prevention (React auto-escaping)
- CSRF protection (SameSite=Strict cookies)
- Audit log for all critical operations

### Compliance
- DSGVO (German GDPR) compliant
- Arbeitszeitgesetz (ArbZG) - German Working Hours Act
- Bundesurlaubsgesetz (BUrlG) - German Federal Vacation Act

---

## Categories

This changelog uses the following categories:

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security fixes and improvements
- **Performance** - Performance improvements
- **Documentation** - Documentation updates

---

## Version Numbering

**Semantic Versioning:** `MAJOR.MINOR.PATCH`

- **MAJOR** version: Incompatible API changes or major feature overhaul
- **MINOR** version: New features (backward compatible)
- **PATCH** version: Bug fixes (backward compatible)

**Examples:**
- `1.5.1` → `1.5.2` = Bug fixes only
- `1.5.0` → `1.6.0` = New features added
- `1.0.0` → `2.0.0` = Breaking changes

---

## Links

- **GitHub Repository:** https://github.com/Maxwellbadger-1/TimeTracking-Clean
- **Latest Release:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/releases/latest
- **Issue Tracker:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/issues
- **Project Specification:** [PROJECT_SPEC.md](PROJECT_SPEC.md)
- **Architecture Documentation:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Project Status:** [PROJECT_STATUS.md](PROJECT_STATUS.md)

---

## Changelog History

| Version | Date | Type | Highlights |
|---------|------|------|-----------|
| [1.5.1](#151---2026-01-15) | 2026-01-15 | Patch | Email & notification fixes |
| [1.5.0](#150---2026-01-14) | 2026-01-14 | Minor | Strict absence validation |
| [1.4.0](#140---2026-01-10) | 2026-01-10 | Minor | Position column added |
| [1.3.0](#130---2025-12-20) | 2025-12-20 | Minor | Weekend bug fix (critical) |
| [1.2.0](#120---2025-12-16) | 2025-12-16 | Minor | Security & validation updates |
| [1.1.0](#110---2025-12-01) | 2025-12-01 | Minor | Auto-update, dark mode |
| [1.0.0](#100---2025-11-15) | 2025-11-15 | Major | Initial production release |

---

**Last Updated:** 2026-01-15
**Format:** Keep a Changelog v1.1.0
**Versioning:** Semantic Versioning 2.0.0
