//By: NathanGr33n

// Enhanced renderer with error handling
let term;
let errorHandler;
let clockInterval;
let resizeObserver;
let currentTheme = 'shadow';

// Global error handlers for uncaught errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Renderer] Uncaught error:', { message, source, lineno, colno, error });
  if (window.edx?.sendError) {
    window.edx.sendError({
      message: message?.toString() || 'Unknown error',
      stack: error?.stack || '',
      source: 'window.onerror',
    });
  }
  return true; // Prevent default error handling
};

window.onunhandledrejection = (event) => {
  console.error('[Renderer] Unhandled promise rejection:', event.reason);
  if (window.edx?.sendError) {
    window.edx.sendError({
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack || '',
      source: 'unhandledrejection',
    });
  }
  event.preventDefault(); // Prevent default handling
};

// Wait for error handler to be available
function initializeTerminal() {
  errorHandler = window.rendererErrorHandler;
  
  if (!errorHandler) {
    console.warn('[Renderer] Error handler not ready, retrying...');
    setTimeout(initializeTerminal, 100);
    return;
  }

  errorHandler.startTiming('terminal-init');
  
  try {
    term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 14,
      theme: {
        background: '#0a0b0d',
        foreground: '#e8e9eb',
        cursor: '#e8e9eb',
        black: '#0a0b0d',
        brightBlack: '#15181e',
        white: '#e8e9eb',
        brightWhite: '#ffffff'
      }
    });
    
    const termEl = document.getElementById('terminal');
    if (!termEl) {
      throw new Error('Terminal element not found');
    }
    
    term.open(termEl);
    
    // Enhanced fit function with error handling
    function fit() {
      return errorHandler.safe(() => {
        const cols = Math.floor(termEl.clientWidth / 9);
        const rows = Math.floor(termEl.clientHeight / 18);
        if (window.edx?.sendResize) {
          window.edx.sendResize({ cols, rows });
        }
      }, null, 'terminal-fit');
    }
    
    resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(termEl);
    
    // Enhanced terminal data handling
    if (window.edx?.onTermData) {
      window.edx.onTermData((data) => {
        errorHandler.safe(() => {
          term.write(data);
        }, null, 'terminal-write');
      });
      
      window.edx.sendTermInit({ cols: 120, rows: 32 });
      
      term.onData(d => {
        errorHandler.safe(() => {
          window.edx.sendTermData(d);
        }, null, 'terminal-send-data');
      });
    }
    
    errorHandler.endTiming('terminal-init');
    console.log('[Renderer] Terminal initialized successfully');
    
  } catch (error) {
    errorHandler.handleError(error, 'terminal-init');
    console.error('[Renderer] Failed to initialize terminal:', error);
  }
}

// Enhanced clock with error handling
function initializeClock() {
  const clockEl = document.getElementById('clock');
  if (!clockEl) {
    errorHandler.handleError(new Error('Clock element not found'), 'clock-init');
    return;
  }
  
  const updateClock = () => {
    errorHandler.safe(() => {
      clockEl.textContent = new Date().toLocaleString();
    }, null, 'clock-update');
  };
  
  clockInterval = setInterval(updateClock, 500);
  updateClock(); // Initial update
}

// Enhanced stats rendering with error handling
function initializeStats() {
  const els = {
    host: document.getElementById('host'),
    os: document.getElementById('os'),
    cpu: document.getElementById('cpuload'),
    temp: document.getElementById('cputemp'),
    mem: document.getElementById('mem'),
    net: document.getElementById('netlist'),
    disk: document.getElementById('disklist')
  };
  
  // Check for missing elements
  Object.entries(els).forEach(([key, el]) => {
    if (!el) {
      errorHandler.handleError(new Error(`Stats element missing: ${key}`), 'stats-init');
    }
  });
  
  function bytes(n) {
    if (!n && n !== 0) return '-';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) {
      n /= 1024;
      i++;
    }
    return n.toFixed(1) + ' ' + u[i];
  }
  
  if (window.edx?.onStats) {
    window.edx.onStats((s) => {
      errorHandler.safe(() => {
        errorHandler.startTiming('stats-update');
        
        // Guard against null/undefined stats with fallbacks
        try {
          if (els.host) els.host.textContent = s?.hostname || 'Unknown';
          if (els.os) els.os.textContent = `${s?.platform || 'Unknown'} ${s?.release || ''}`;
          if (els.cpu) els.cpu.textContent = `${(s?.cpu?.avgLoad || 0).toFixed(1)}%`;
          if (els.temp) els.temp.textContent = s?.temperature?.main ? `${s.temperature.main.toFixed(0)}°C` : '—';
          if (els.mem) els.mem.textContent = `${bytes(s?.mem?.used)} / ${bytes(s?.mem?.total)}`;
        
          if (els.net && Array.isArray(s?.net)) {
            els.net.innerHTML = s.net.map(n => 
              `<div class="kv"><label>${n?.iface || 'Unknown'}</label><span>↓ ${bytes(n?.rx_sec)}/s • ↑ ${bytes(n?.tx_sec)}/s</span></div>`
            ).join('');
          }
          
          if (els.disk && Array.isArray(s?.disks)) {
            els.disk.innerHTML = s.disks.map(d => {
              const pct = d?.size > 0 ? ((d.used || 0) / d.size) * 100 : 0;
              return `<div class="disk">
                <div class="row"><span>${d?.mount || 'Unknown'}</span><span>${bytes(d?.used)} / ${bytes(d?.size)}</span></div>
                <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
              </div>`;
            }).join('');
          }
        } catch (statsError) {
          console.error('[Renderer] Error updating stats:', statsError);
          // Stats update failed but continue - don't crash the app
        }
        
        errorHandler.endTiming('stats-update');
      }, null, 'stats-render');
    });
  }
}

// Main initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTerminal);
} else {
  initializeTerminal();
}

// Theme Management
function initializeTheme() {
  // Load and apply saved theme
  if (window.edx?.getTheme) {
    window.edx.getTheme().then(themeName => {
      applyTheme(themeName || 'shadow');
    }).catch(err => {
      console.error('Failed to load theme:', err);
      applyTheme('shadow');
    });
  }
}

function applyTheme(themeName) {
  if (!window.themes || !window.themes[themeName]) {
    console.warn('Theme not found:', themeName);
    return;
  }
  
  currentTheme = themeName;
  const theme = window.themes[themeName];
  const root = document.documentElement;
  
  // Apply CSS variables
  root.style.setProperty('--bg-0', theme.colors.bg0);
  root.style.setProperty('--bg-1', theme.colors.bg1);
  root.style.setProperty('--bg-2', theme.colors.bg2);
  root.style.setProperty('--fg', theme.colors.fg);
  root.style.setProperty('--muted', theme.colors.muted);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--accent-2', theme.colors.accent2);
  root.style.setProperty('--aubergine', theme.colors.special);
  root.style.setProperty('--grid', theme.colors.grid);
  
  // Apply terminal colors if terminal exists
  if (term) {
    term.options.theme = {
      background: theme.terminal.background,
      foreground: theme.terminal.foreground,
      cursor: theme.terminal.cursor,
      black: theme.terminal.black,
      brightBlack: theme.terminal.brightBlack,
      white: theme.terminal.white,
      brightWhite: theme.terminal.brightWhite,
    };
  }
  
  console.log('Theme applied:', themeName);
}

// Initialize other components after a short delay
setTimeout(() => {
  if (window.rendererErrorHandler) {
    initializeTheme();
    initializeClock();
    initializeStats();
    initializePreferences();
    initializeContextMenu();
    initializeZoomControls();
    initializeCommandHistory();
  }
}, 200);

// Preferences Panel Management
function initializePreferences() {
  const overlay = document.getElementById('preferences-overlay');
  const closeBtn = document.querySelector('.prefs-close');
  const saveBtn = document.querySelector('.prefs-save');
  const resetBtn = document.querySelector('.prefs-reset');
  const cancelBtn = document.querySelector('.prefs-cancel');

  if (!overlay) return;

  // Open preferences with Ctrl+, or F10
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === ',') || e.key === 'F10') {
      e.preventDefault();
      openPreferences();
    }
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      closePreferences();
    }
  });

  // Close handlers
  closeBtn?.addEventListener('click', closePreferences);
  cancelBtn?.addEventListener('click', closePreferences);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closePreferences();
  });

  // Save handler
  saveBtn?.addEventListener('click', savePreferences);

  // Reset handler
  resetBtn?.addEventListener('click', async () => {
    if (confirm('Reset all settings to defaults?')) {
      const success = await window.edex.resetConfig();
      if (success) {
        alert('Settings reset to defaults!');
        await loadPreferences();
      } else {
        alert('Failed to reset settings');
      }
    }
  });

  async function openPreferences() {
    await loadPreferences();
    overlay.classList.remove('hidden');
  }

  function closePreferences() {
    overlay.classList.add('hidden');
  }

  async function loadPreferences() {
    try {
      const monitoring = await window.edex.getConfig('monitoring');
      const terminal = await window.edx.getConfig('terminal');
      const security = await window.edx.getConfig('security');
      const theme = await window.edx.getTheme();

      // Theme
      document.getElementById('pref-theme').value = theme || 'shadow';

      // Monitoring metrics
      document.getElementById('pref-metric-cpu').checked = monitoring?.enabledMetrics?.cpu ?? true;
      document.getElementById('pref-metric-memory').checked = monitoring?.enabledMetrics?.memory ?? true;
      document.getElementById('pref-metric-network').checked = monitoring?.enabledMetrics?.network ?? true;
      document.getElementById('pref-metric-disk').checked = monitoring?.enabledMetrics?.disk ?? true;
      document.getElementById('pref-metric-battery').checked = monitoring?.enabledMetrics?.battery ?? true;
      document.getElementById('pref-metric-temperature').checked = monitoring?.enabledMetrics?.temperature ?? true;

      // Monitoring settings
      document.getElementById('pref-adaptive-polling').checked = monitoring?.adaptivePolling ?? true;
      document.getElementById('pref-slow-when-minimized').checked = monitoring?.slowPollWhenMinimized ?? true;
      document.getElementById('pref-poll-interval').value = monitoring?.pollInterval ?? 1000;
      document.getElementById('pref-minimized-interval').value = monitoring?.minimizedPollInterval ?? 5000;

      // Terminal
      document.getElementById('pref-font-size').value = terminal?.fontSize ?? 14;

      // Security
      document.getElementById('pref-enable-logging').checked = security?.enableLogging ?? true;
      document.getElementById('pref-log-level').value = security?.logLevel ?? 'info';
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }

  async function savePreferences() {
    try {
      // Save theme and apply immediately
      const selectedTheme = document.getElementById('pref-theme').value;
      await window.edx.setTheme(selectedTheme);
      applyTheme(selectedTheme);

      // Save monitoring metrics
      await window.edex.setConfig('monitoring.enabledMetrics.cpu', document.getElementById('pref-metric-cpu').checked);
      await window.edex.setConfig('monitoring.enabledMetrics.memory', document.getElementById('pref-metric-memory').checked);
      await window.edex.setConfig('monitoring.enabledMetrics.network', document.getElementById('pref-metric-network').checked);
      await window.edex.setConfig('monitoring.enabledMetrics.disk', document.getElementById('pref-metric-disk').checked);
      await window.edex.setConfig('monitoring.enabledMetrics.battery', document.getElementById('pref-metric-battery').checked);
      await window.edex.setConfig('monitoring.enabledMetrics.temperature', document.getElementById('pref-metric-temperature').checked);

      // Save monitoring settings
      await window.edex.setConfig('monitoring.adaptivePolling', document.getElementById('pref-adaptive-polling').checked);
      await window.edex.setConfig('monitoring.slowPollWhenMinimized', document.getElementById('pref-slow-when-minimized').checked);
      await window.edex.setConfig('monitoring.pollInterval', parseInt(document.getElementById('pref-poll-interval').value, 10));
      await window.edex.setConfig('monitoring.minimizedPollInterval', parseInt(document.getElementById('pref-minimized-interval').value, 10));

      // Save terminal settings
      await window.edex.setConfig('terminal.fontSize', parseInt(document.getElementById('pref-font-size').value, 10));

      // Save security settings
      await window.edex.setConfig('security.enableLogging', document.getElementById('pref-enable-logging').checked);
      await window.edex.setConfig('security.logLevel', document.getElementById('pref-log-level').value);

      alert('Settings saved! Theme applied immediately.');
      closePreferences();
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save settings');
    }
  }
}

// Cleanup function to prevent memory leaks
function cleanupRenderer() {
  // Disconnect resize observer
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // Clear clock interval
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  // Dispose terminal
  if (term) {
    term.dispose();
    term = null;
  }

  console.log('[Renderer] Cleanup completed');
}

// Register cleanup on page unload
window.addEventListener('beforeunload', cleanupRenderer);

// Context Menu Management
function initializeContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  const terminalEl = document.getElementById('terminal');
  
  if (!contextMenu || !terminalEl) return;

  // Prevent default context menu on terminal
  terminalEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  });

  // Close context menu on click outside
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Handle menu item clicks
  contextMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.context-menu-item');
    if (!item) return;

    const action = item.dataset.action;
    handleContextAction(action);
    hideContextMenu();
  });

  function showContextMenu(x, y) {
    // Position menu near cursor, but keep it on screen
    const menuWidth = 180;
    const menuHeight = 200; // approximate
    
    let left = x;
    let top = y;

    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }

    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 10;
    }

    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';
    contextMenu.classList.remove('hidden');
  }

  function hideContextMenu() {
    contextMenu.classList.add('hidden');
  }

  function handleContextAction(action) {
    if (!term) {
      console.warn('Terminal not initialized');
      return;
    }

    switch (action) {
      case 'copy':
        // Copy selected text from terminal
        if (term.hasSelection()) {
          const selection = term.getSelection();
          navigator.clipboard.writeText(selection).catch(err => {
            console.error('Failed to copy:', err);
          });
        }
        break;

      case 'paste':
        // Paste from clipboard
        navigator.clipboard.readText().then(text => {
          if (window.edx?.sendTermData) {
            window.edx.sendTermData(text);
          }
        }).catch(err => {
          console.error('Failed to paste:', err);
        });
        break;

      case 'selectall':
        // Select all terminal content
        term.selectAll();
        break;

      case 'clear':
        // Clear terminal
        term.clear();
        break;

      case 'preferences':
        // Open preferences
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'F10',
          bubbles: true
        }));
        break;

      default:
        console.warn('Unknown action:', action);
    }
  }
}

// Zoom Controls Management
function initializeZoomControls() {
  let currentZoom = 1.0;
  let zoomIndicatorTimeout = null;

  // Load current zoom level
  if (window.edex?.getZoom) {
    window.edex.getZoom().then(level => {
      currentZoom = level || 1.0;
    }).catch(err => {
      console.error('Failed to load zoom level:', err);
    });
  }

  // Keyboard shortcuts for zoom
  document.addEventListener('keydown', async (e) => {
    // Ctrl++ or Ctrl+= to zoom in
    if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      await adjustZoom(0.1);
    }
    // Ctrl+- to zoom out
    else if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      await adjustZoom(-0.1);
    }
    // Ctrl+0 to reset zoom
    else if (e.ctrlKey && e.key === '0') {
      e.preventDefault();
      await resetZoom();
    }
  });

  // Mouse wheel zoom with Ctrl
  document.addEventListener('wheel', async (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      await adjustZoom(delta);
    }
  }, { passive: false });

  async function adjustZoom(delta) {
    try {
      const newZoom = Math.max(0.5, Math.min(2.0, currentZoom + delta));
      const success = await window.edex.setZoom(newZoom);
      if (success) {
        currentZoom = newZoom;
        showZoomIndicator(Math.round(currentZoom * 100) + '%');
      }
    } catch (error) {
      console.error('Failed to adjust zoom:', error);
    }
  }

  async function resetZoom() {
    try {
      const success = await window.edex.resetZoom();
      if (success) {
        currentZoom = 1.0;
        showZoomIndicator('100% (Reset)');
      }
    } catch (error) {
      console.error('Failed to reset zoom:', error);
    }
  }

  function showZoomIndicator(text) {
    // Create or get zoom indicator element
    let indicator = document.getElementById('zoom-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'zoom-indicator';
      indicator.className = 'zoom-indicator';
      document.body.appendChild(indicator);
    }

    // Update and show
    indicator.textContent = text;
    indicator.classList.add('visible');

    // Clear previous timeout
    if (zoomIndicatorTimeout) {
      clearTimeout(zoomIndicatorTimeout);
    }

    // Hide after 1.5 seconds
    zoomIndicatorTimeout = setTimeout(() => {
      indicator.classList.remove('visible');
    }, 1500);
  }
}

// Command History Panel Management
function initializeCommandHistory() {
  const overlay = document.getElementById('history-overlay');
  const closeBtn = document.querySelector('.history-close');
  const cancelBtn = document.querySelector('.history-cancel');
  const clearBtn = document.querySelector('.history-clear');
  const searchInput = document.getElementById('history-search-input');
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');
  
  let currentCommand = '';
  
  if (!overlay) return;

  // Open history with Ctrl+H
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      openHistory();
    }
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      closeHistory();
    }
  });

  // Track terminal input for commands
  if (term) {
    term.onData((data) => {
      // Track keystrokes to build current command
      if (data === '\r') {
        // Enter pressed - save command
        if (currentCommand.trim().length > 0 && window.edx?.addCommand) {
          window.edx.addCommand(currentCommand.trim());
        }
        currentCommand = '';
      } else if (data === '\x7F' || data === '\b') {
        // Backspace
        currentCommand = currentCommand.slice(0, -1);
      } else if (data === '\x03') {
        // Ctrl+C
        currentCommand = '';
      } else if (data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127) {
        // Printable character
        currentCommand += data;
      }
    });
  }

  // Close handlers
  closeBtn?.addEventListener('click', closeHistory);
  cancelBtn?.addEventListener('click', closeHistory);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeHistory();
  });

  // Search handler
  searchInput?.addEventListener('input', async (e) => {
    const query = e.target.value;
    await loadHistory(query);
  });

  // Clear handler
  clearBtn?.addEventListener('click', async () => {
    if (confirm('Clear all command history?')) {
      const success = await window.edx.clearHistory();
      if (success) {
        await loadHistory();
      }
    }
  });

  async function openHistory() {
    await loadHistory();
    overlay.classList.remove('hidden');
    searchInput?.focus();
  }

  function closeHistory() {
    overlay.classList.add('hidden');
    if (searchInput) searchInput.value = '';
  }

  async function loadHistory(query = '') {
    try {
      let history;
      if (query && query.trim().length > 0) {
        history = await window.edx.searchHistory(query);
      } else {
        history = await window.edx.getHistory(100); // Get last 100 commands
      }

      const stats = await window.edx.getHistoryStats();
      
      // Update count
      if (historyCount) {
        const displayCount = query ? history.length : stats.totalCommands;
        historyCount.textContent = `${displayCount} command${displayCount !== 1 ? 's' : ''}`;
      }

      // Render history list
      if (historyList) {
        if (history.length === 0) {
          historyList.innerHTML = '<div class="history-empty">No commands found</div>';
        } else {
          historyList.innerHTML = history.reverse().map(entry => {
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleTimeString();
            const dateStr = date.toLocaleDateString();
            
            return `
              <div class="history-item" data-command="${escapeHtml(entry.command)}">
                <div class="history-item-command">${escapeHtml(entry.command)}</div>
                <div class="history-item-meta">
                  <span>📁 ${escapeHtml(entry.cwd)}</span>
                  <span>🕒 ${timeStr} ${dateStr}</span>
                </div>
              </div>
            `;
          }).join('');

          // Add click handlers to re-execute commands
          historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
              const command = item.dataset.command;
              if (command && window.edx?.sendTermData) {
                closeHistory();
                // Send command to terminal
                window.edx.sendTermData(command + '\r');
              }
            });
          });
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      if (historyList) {
        historyList.innerHTML = '<div class="history-empty">Failed to load history</div>';
      }
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
