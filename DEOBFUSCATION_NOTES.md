# Chrome Extension Deobfuscation Notes

## Overview

This document describes the deobfuscation process applied to the MultiAccount Manager Chrome extension. The extension was originally minified with obfuscated variable names, making it difficult to understand and maintain.

## Files Modified

### 1. **content.js** (Deobfuscated)
**Original Size:** ~5.3 KB (minified, obfuscated)
**New Size:** ~8.2 KB (formatted, readable)

**What it does:**
- Injected as a content script on all web pages
- Captures page state (localStorage and login detection)
- Applies saved page states to restore user sessions
- Handles messages from the background script

**Key Functions:**
- `detectLoginState()` - Determines if user is logged in using configurable rules
- `extractSiteInfo()` - Gets site title and favicon
- `captureLocalStorage()` - Saves all localStorage data
- `applyLocalStorage()` - Restores localStorage data

**Improvements:**
- Clear variable names (e.g., `l` → `defaultRule`)
- Comprehensive JSDoc comments
- Better code organization with sections
- Explicit detection rules that are easy to extend

---

### 2. **background.js** (Deobfuscated)
**Original Size:** ~11.2 KB (minified, obfuscated)
**New Size:** ~17.8 KB (formatted, readable)

**What it does:**
- Runs as a background service worker (Manifest v3)
- Manages cookies and coordinates page state operations
- Handles tab management and content script injection
- Routes all major operations through message passing

**Key Functions:**
- `getAllCookies()` - Retrieves both URL-specific and domain cookies
- `clearCookies()` - Removes all cookies for a URL
- `setCookies()` - Restores cookies with proper domain/path handling
- `ensureContentScript()` - Injects content script if needed
- `capturePageState()` - Gets complete page snapshot (cookies + localStorage)
- `applySnapshot()` - Restores a saved snapshot to a tab

**Improvements:**
- Self-documenting function names (e.g., `k` → `getAllCookies`)
- Clear promise-based error handling
- Logical separation of concerns
- Detailed comments explaining cookie deduplication logic

---

### 3. **popup.js** (Deobfuscated)
**Original Size:** ~48 KB (minified, obfuscated)
**New Size:** ~59 KB (formatted, readable)

**What it does:**
- Main UI for the extension popup
- Manages account list and site list
- Handles account operations (add, edit, export, import, delete)
- Backup/restore functionality with encryption
- Feedback submission
- Ad rendering

**Major Classes:**
- `Modal` - Custom modal dialog for alerts, confirms, prompts
- `FeedbackModal` - Feedback form with character limit
- `AdService` - Manages ad fetching and rendering

**Key Functions:**
- `addAccount()` - Captures current site and user input
- `captureAccountSnapshot()` - Gets cookies + localStorage from tab
- `applyAccountSnapshot()` - Restores account to current tab
- `exportBackup()` - Creates encrypted backup file
- `importBackup()` - Restores from encrypted backup
- `importAccountFromFile()` - Imports individual account share files

**Security Features:**
- AES-GCM encryption for backups and shared accounts
- PBKDF2 key derivation from passwords
- Duplicate account detection
- Proper error handling and user feedback

**Improvements:**
- Clear class and method names
- Comprehensive JSDoc for all functions
- Logical organization into sections
- Better error handling with user-friendly messages

---

### 4. **popup.html** (Already readable)
No significant changes needed - HTML was already well-structured with semantic elements and `data-i18n` attributes for internationalization.

---

### 5. **popup.css** (Already readable)
No significant changes needed - CSS was already well-organized with:
- CSS variables for theming
- Clear class naming conventions
- Component-based structure
- Comments for major sections

---

### 6. **manifest.json** (Already readable)
No changes needed - manifest was already well-formatted with clear structure.

---

## Deobfuscation Techniques Applied

### Variable Naming
| Original | New | Context |
|----------|-----|---------|
| `X`, `pt` | `textEncoder`, `textDecoder` | Crypto utilities |
| `l`, `g`, `f` | `defaultRule`, `exampleRule`, `detectionRules` | Detection logic |
| `S`, `d`, `u` | `extractSiteName`, `extractFaviconUrl`, `extractSiteInfo` | Site info extraction |
| `h`, `m` | `captureLocalStorage`, `applyLocalStorage` | Storage operations |
| `k`, `y`, `S` | `getAllCookies`, `getCookieKey`, `formatCookies` | Cookie operations |
| `o`, `r`, `e` | `resolve`, `reject`, `error` | Promise handlers |

### Code Organization
- Grouped related functions into logical sections
- Added section headers with clear boundaries
- Improved indentation and spacing for readability
- Separated concerns (crypto, storage, UI, etc.)

### Comments and Documentation
- Added JSDoc comments to all functions
- Explained complex logic (e.g., cookie deduplication)
- Clarified intent for non-obvious code patterns
- Added inline comments for critical sections

### Function Decomposition
- Extracted inline logic into named functions
- Reduced function complexity
- Improved testability and reusability

---

## Key Extension Features

### Account Management
The extension manages multiple accounts per website by storing:
- **Cookies** - Browser authentication tokens
- **localStorage** - Site-specific data
- **Login Info** - Detected login state
- **Metadata** - Label, username, avatar color, timestamps

### Encryption
- **Algorithm:** AES-GCM
- **Key Derivation:** PBKDF2 with SHA-256
- **Salt:** 16 bytes random
- **Iterations:** 100,000
- **Used for:** Backup export/import and account sharing

### Security Features
- Duplicate account detection by comparing fingerprints
- Proper cookie domain/path handling
- Error handling for special URLs (chrome://, about:, etc.)
- User confirmation dialogs for destructive operations
- Timezone-aware timestamps (+08:00)

### Internationalization
- All UI strings use `data-i18n` attributes
- Strings loaded from Chrome's i18n system
- Support for multiple languages via `_locales/` folder
- Fallback handling for missing translations

---

## Message Types

### Content Script ↔ Background
- `PING` - Check if content script is active
- `CAPTURE_PAGE_STATE` - Get localStorage, cookies, and login info
- `APPLY_PAGE_STATE` - Restore localStorage to page

### Popup ↔ Background
- `CAPTURE_ACCOUNT_SNAPSHOT` - Capture cookies + page state from tab
- `APPLY_ACCOUNT_SNAPSHOT` - Apply snapshot to current tab
- `OPEN_AND_APPLY_ACCOUNT_SNAPSHOT` - Open new tab and apply snapshot
- `CLEAR_SITE_DATA` - Clear all cookies for a site
- `DEBUG_LOG` - Forward logging messages

---

## Testing Recommendations

1. **Account Operations**
   - Add accounts on different websites
   - Edit account labels and usernames
   - Verify duplicate detection
   - Test apply/restore on different sites

2. **Backup/Restore**
   - Export backup with password
   - Import backup on fresh install
   - Verify password protection
   - Test with corrupted files

3. **Sharing**
   - Export encrypted account share
   - Share unencrypted account
   - Import shared accounts
   - Verify fingerprints prevent duplicates

4. **Edge Cases**
   - Special URLs (chrome://, about:, etc.)
   - Pages without localStorage
   - Cookie domain/path edge cases
   - Large account collections
   - Storage quota exceeded

---

## Development Notes

### Adding New Features
1. Keep variable names descriptive
2. Add JSDoc comments
3. Use the message passing pattern
4. Add error handling and user feedback
5. Update i18n strings in `_locales/`

### Debugging
- Check browser console for logs prefixed with `[MultiAccount]`
- Use Chrome DevTools to inspect extension popup
- Check background service worker logs
- Test content script with console.log

### Building
- No build step needed - all files are ready to use
- Load unpacked extension from project directory
- Use `chrome://extensions/` to manage

---

## File Structure
```
account-tool/
├── manifest.json          # Extension configuration
├── content.js            # Content script (deobfuscated)
├── background.js         # Background worker (deobfuscated)
├── popup.html            # Popup UI
├── popup.js              # Popup logic (deobfuscated)
├── popup.css             # Popup styles
├── icons/                # Extension icons
├── _locales/             # Internationalization strings
├── package.json          # NPM configuration
└── DEOBFUSCATION_NOTES.md # This file
```

---

## Migration from Original

If you need to refer to the original obfuscated code, it's been preserved as `popup_old.js` for reference. However, the new deobfuscated version is fully compatible and recommended for all future work.

### Compatibility
✅ All functionality preserved
✅ No API changes
✅ Same extension behavior
✅ Same message formats
✅ Same data storage structure

---

## Next Steps

The extension is now in excellent shape for:
- ✅ Maintenance and debugging
- ✅ Adding new features
- ✅ Community contribution
- ✅ Security audits
- ✅ Performance optimization
- ✅ Code documentation updates

---

Last Updated: 2026-05-20
