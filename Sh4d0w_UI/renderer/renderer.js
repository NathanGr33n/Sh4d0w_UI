//By: NathanGr33n

// Enhanced renderer with error handling
let term;
let errorHandler;

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
    
    new ResizeObserver(fit).observe(termEl);
    
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
  
  setInterval(updateClock, 500);
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
        
        if (els.host) els.host.textContent = s.hostname || 'Unknown';
        if (els.os) els.os.textContent = `${s.platform || 'Unknown'} ${s.release || ''}`;
        if (els.cpu) els.cpu.textContent = `${(s.cpu?.avgLoad || 0).toFixed(1)}%`;
        if (els.temp) els.temp.textContent = s.temperature?.main ? `${s.temperature.main.toFixed(0)}°C` : '—';
        if (els.mem) els.mem.textContent = `${bytes(s.mem?.used)} / ${bytes(s.mem?.total)}`;
        
        if (els.net) {
          els.net.innerHTML = (s.net || []).map(n => 
            `<div class="kv"><label>${n.iface || 'Unknown'}</label><span>↓ ${bytes(n.rx_sec)}/s • ↑ ${bytes(n.tx_sec)}/s</span></div>`
          ).join('');
        }
        
        if (els.disk) {
          els.disk.innerHTML = (s.disks || []).map(d => {
            const pct = d.size > 0 ? (d.used / d.size) * 100 : 0;
            return `<div class="disk">
              <div class="row"><span>${d.mount || 'Unknown'}</span><span>${bytes(d.used)} / ${bytes(d.size)}</span></div>
              <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
            </div>`;
          }).join('');
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

// Initialize other components after a short delay
setTimeout(() => {
  if (window.rendererErrorHandler) {
    initializeClock();
    initializeStats();
  }
}, 200);
