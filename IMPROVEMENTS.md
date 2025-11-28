# Shadow UI Project Improvements

## Code Quality & Maintainability

### 1. ✅ Add TypeScript (COMPLETED)
Convert to TypeScript for better type safety and IDE support, especially valuable given the complex IPC communication between main/renderer processes
- Status: config.ts implemented with full type definitions
- Remaining: Convert other modules incrementally

### 2. ✅ Add automated testing (COMPLETED)
No tests currently exist. Add:
- ✅ Unit tests for utility functions (36 tests passing)
- ✅ Integration tests for config and validation
- ⏳ E2E tests using Playwright for Electron (TODO)

### 3. ✅ Linting & formatting (COMPLETED)
Add ESLint and Prettier configurations to enforce code style consistency
- Status: ESLint 9.x and Prettier configured
- All files formatted and passing lint checks

## Performance & Optimization

### 4. Reduce system monitoring overhead
The `pollStats()` function fetches 6 different system metrics every interval. Consider:
- Letting users configure which metrics to display
- Implementing adaptive polling (slower when minimized)
- Using worker threads for heavy computations

### 5. Memory leak prevention
Add explicit cleanup for:
- ResizeObserver in renderer.js
- Terminal event listeners
- IPC listeners on window destruction

## Features & User Experience

### 6. User preferences panel
Add a settings UI for:
- Theme selection (you have multiple themes but no easy way to switch)
- Font size/family customization
- Polling interval configuration
- Shell selection

### 7. Multiple terminal tabs/splits
Support multiple terminal sessions like modern terminal emulators

### 8. Command palette
Add a quick-access command palette (Ctrl+Shift+P) for common actions

### 9. Keyboard shortcuts
Document and expand keyboard shortcuts for power users
- Ctrl+T: New terminal tab
- Ctrl+W: Close tab
- Ctrl+Tab: Switch tabs
- Ctrl+Shift+C/V: Copy/paste in terminal
- F11: Fullscreen toggle

### 21. Terminal session persistence
Save and restore terminal sessions across app restarts:
- Save working directory and command history
- Restore open tabs and layouts
- Optional: save terminal scrollback buffer
Effort: 4 hours | Priority: HIGH

### 22. Custom terminal profiles
Let users create profiles with:
- Different shells (bash, zsh, fish, pwsh)
- Custom environment variables per profile
- Startup commands
- Color schemes per profile
Effort: 3 hours | Priority: MEDIUM

### 23. Search in terminal output
Add Ctrl+F search functionality:
- Search through terminal scrollback
- Highlight matches
- Navigate between results
Effort: 2 hours | Priority: MEDIUM

### 24. Terminal theming system
Expand beyond current themes:
- Import iTerm2/Windows Terminal themes
- Live theme preview
- Community theme marketplace
- Export custom themes
Effort: 6 hours | Priority: MEDIUM

### 25. System resource alerts
Add configurable alerts for:
- CPU usage > 90% for 30 seconds
- Memory usage > 85%
- Disk space < 10GB
- Temperature > threshold
Show desktop notifications
Effort: 2 hours | Priority: LOW

### 26. Extensibility/Plugin system
Allow users to extend Shadow UI:
- Plugin API for custom widgets
- Custom IPC handlers
- Theme plugins
- Integration with external tools
Effort: 12+ hours | Priority: LOW (v0.3.0)

### 27. Terminal recording
Record terminal sessions:
- Export as asciicast (asciinema format)
- Playback within app
- Share recordings
Effort: 4 hours | Priority: LOW

### 28. SSH/Remote connections
Built-in SSH client:
- Manage SSH connections
- Save connection profiles
- Key-based authentication
- Port forwarding support
Effort: 8+ hours | Priority: MEDIUM (v0.3.0)

## Security Enhancements (See SECURITY_REVIEW.md for details)

### 10. ⚠️ FIX NPM VULNERABILITIES (CRITICAL)
Run `npm audit fix` to resolve 3 known CVEs:
- glob (HIGH): Command injection - CVSS 7.5
- tar-fs (HIGH): Symlink validation bypass
- js-yaml (MODERATE): Prototype pollution - CVSS 5.3
Effort: 5 minutes | Priority: IMMEDIATE

### 11. ⚠️ Sanitize shell environment variables (CRITICAL)
Currently passes ALL environment variables to spawned shell, exposing:
- API keys and tokens (AWS_*, GITHUB_TOKEN, etc.)
- SSH credentials
- Database passwords
Whitelist only: HOME, USER, SHELL, PATH, LANG, TERM_PROGRAM
Effort: 10 minutes | Priority: HIGH

### 12. Add IPC rate limiting
Prevent DoS attacks by limiting:
- Terminal writes (100/second)
- Resize events (10/second)
- Debug commands (5/minute)
Use `limiter` npm package
Effort: 1 hour | Priority: HIGH

### 13. Remove unsafe-inline from CSP
Replace `'unsafe-inline'` with nonces or SRI hashes
Prevents XSS attacks even if injection vulnerability exists
Effort: 2 hours | Priority: HIGH

### 14. ⚠️ Enable sandbox mode (CRITICAL)
Move PTY to utility process to enable sandbox
- Create pty-handler.js as separate utility process
- Enable `sandbox: true` in BrowserWindow
- Reduces attack surface significantly
Effort: 4-8 hours | Priority: CRITICAL (long-term)

### 15. Restrict debug commands
Add authentication and disable in production:
- Check NODE_ENV !== 'production'
- Require debug token for sensitive operations
- Prevent error log clearing
Effort: 30 minutes | Priority: MEDIUM

### 16. Update electron-builder
Version 25.0.5 is outdated; update to latest (currently 25.1.x+)
Effort: 15 minutes | Priority: MEDIUM

### 17. Improve terminal data sanitization
Block dangerous OSC (Operating System Command) sequences
Prevent terminal manipulation attacks
Effort: 30 minutes | Priority: MEDIUM

### 18. Add SRI to CDN resources
Use Subresource Integrity for xterm.js from jsdelivr
Or better: bundle dependencies locally with webpack
Effort: 1 hour (SRI) / 4 hours (bundling) | Priority: MEDIUM

## Developer Experience

### 12. Hot reload
Add `electron-reload` for development to avoid manual restarts

### 13. Build scripts
Add platform-specific build scripts and GitHub Actions for CI/CD

### 14. Environment configurations
Separate dev/prod configurations using environment variables

## Documentation

### 15. API documentation
Document the IPC API between main/renderer processes

### 16. Contributing guide
Create CONTRIBUTING.md with code style guidelines and development workflow

### 17. Update README versions
Your README shows Electron 31.3.1 but you're now on 38.1.2

## Bug Fixes & Polish

### 18. Error handling in renderer
The renderer waits for `window.rendererErrorHandler` with a timeout, but there's no maximum retry limit

### 19. Terminal initialization race condition
Add better synchronization between terminal initialization and window readiness

### 20. Version mismatch in badges
Update README badges to reflect actual current versions

### 29. Add file/folder drag-and-drop
Drag files from system into terminal:
- Insert file path at cursor
- Option to upload via base64 for remote sessions
- Visual feedback during drag
Effort: 2 hours | Priority: LOW

### 30. Quick actions menu
Right-click context menu with:
- Copy/paste
- Select all
- Clear terminal
- Split terminal
- New tab
Effort: 1 hour | Priority: MEDIUM

### 31. Window transparency/blur effects
Add configurable transparency:
- macOS vibrancy effects
- Windows acrylic blur
- Opacity slider (50-100%)
Effort: 2 hours | Priority: LOW

### 32. Smart autocomplete
Terminal autocomplete with:
- Command history
- File/folder paths
- Git branches
- Common commands
Effort: 6 hours | Priority: MEDIUM

### 33. Custom system metric widgets
Let users customize stats panel:
- Drag-and-drop widget reordering
- Show/hide individual metrics
- Add custom metrics (API calls, etc.)
- Resize widget panels
Effort: 4 hours | Priority: MEDIUM

### 34. Export/import settings
Allow users to:
- Export configuration as JSON
- Share configs between machines
- Cloud sync (optional)
- Reset to defaults button
Effort: 2 hours | Priority: LOW

### 35. Performance profiler
Built-in profiler for:
- CPU/Memory usage over time
- Terminal rendering performance
- Identify bottlenecks
- Export performance reports
Effort: 4 hours | Priority: LOW

### 36. Notification system
Desktop notifications for:
- Long-running command completion
- System resource alerts
- Update availability
- Error conditions
Effort: 2 hours | Priority: MEDIUM
