// renderer/shell/shellMode.js
// Renderer logic for the Shadow UI shell-mode UI.
//
// Talks to main via window.shadow.shell.* (see preload.js).
// Intentionally defensive: if the shell API is unavailable (e.g. user
// opened this page outside shell mode), all UI is still rendered but
// actions report a friendly error instead of crashing.

(function () {
  'use strict';

  const api = (window.shadow && window.shadow.shell) || null;

  // ------------------------------------------------------------------ Util
  function $(id) { return document.getElementById(id); }

  function setStatus(msg) {
    const el = $('shell-status');
    if (el) el.textContent = String(msg || '');
  }

  function notifyRun(msg, kind) {
    const el = $('run-status');
    if (!el) return;
    el.textContent = String(msg || '');
    el.classList.remove('ok', 'err');
    if (kind === 'ok') el.classList.add('ok');
    else if (kind === 'err') el.classList.add('err');
  }

  function needsApi() {
    if (!api) {
      setStatus('Shell API unavailable (not launched with --shell).');
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ Clock
  function updateClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const text = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const el = $('shell-clock');
    if (el) el.textContent = text;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ------------------------------------------------------------------ Launcher
  const launcherList = $('launcher-list');
  const launcherFilter = $('launcher-filter');
  let launcherCache = [];

  function renderLauncher(items, filter) {
    if (!launcherList) return;
    launcherList.innerHTML = '';
    const f = (filter || '').toLowerCase();
    const filtered = f
      ? items.filter((i) => i.name.toLowerCase().includes(f))
      : items;
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No apps match.';
      launcherList.appendChild(empty);
      return;
    }
    for (const item of filtered.slice(0, 500)) {
      const btn = document.createElement('button');
      btn.className = 'launcher-item';
      btn.type = 'button';
      btn.textContent = item.name;
      btn.title = item.path;
      btn.addEventListener('click', () => launchItem(item));
      launcherList.appendChild(btn);
    }
  }

  async function refreshLauncher() {
    if (needsApi()) return;
    try {
      const items = await api.listStartMenu();
      launcherCache = Array.isArray(items) ? items : [];
      renderLauncher(launcherCache, launcherFilter && launcherFilter.value);
    } catch (err) {
      setStatus(`Launcher load failed: ${err && err.message ? err.message : err}`);
    }
  }

  async function launchItem(item) {
    if (needsApi() || !item) return;
    // .lnk files are best launched via explorer.exe with the .lnk as arg,
    // or by passing through to the OS; Windows resolves them natively if
    // the user invokes them with their canonical path. We delegate to
    // launchApp which uses spawn(); the OS will open the .lnk.
    const res = await api.launchApp({ path: item.path });
    if (res && res.ok) {
      setStatus(`Launched: ${item.name}`);
    } else {
      setStatus(`Launch failed: ${(res && res.error) || 'unknown error'}`);
    }
  }

  if (launcherFilter) {
    launcherFilter.addEventListener('input', () => {
      renderLauncher(launcherCache, launcherFilter.value);
    });
  }

  // ------------------------------------------------------------------ Run box
  const runForm = $('run-form');
  const runInput = $('run-input');
  if (runForm) {
    runForm.addEventListener('submit', async (evt) => {
      evt.preventDefault();
      if (needsApi()) {
        notifyRun('Shell API unavailable', 'err');
        return;
      }
      const raw = runInput ? runInput.value.trim() : '';
      if (!raw) {
        notifyRun('Enter an absolute path.', 'err');
        return;
      }
      notifyRun('Launching…');
      const res = await api.launchApp({ path: raw });
      if (res && res.ok) {
        notifyRun(`Launched (pid ${res.pid}).`, 'ok');
        runInput.value = '';
      } else {
        notifyRun(`Failed: ${(res && res.error) || 'unknown error'}`, 'err');
      }
    });
  }

  // ------------------------------------------------------------------ Windows list
  const windowsList = $('windows-list');

  function renderWindows(items) {
    if (!windowsList) return;
    windowsList.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No top-level windows.';
      windowsList.appendChild(empty);
      return;
    }
    for (const w of items) {
      const btn = document.createElement('button');
      btn.className = 'window-item';
      btn.type = 'button';
      btn.setAttribute('role', 'listitem');
      const title = document.createElement('span');
      title.textContent = w.title || '(untitled)';
      const proc = document.createElement('span');
      proc.className = 'proc';
      proc.textContent = `${w.processName || '?'} (${w.pid})`;
      btn.appendChild(title);
      btn.appendChild(proc);
      btn.addEventListener('click', async () => {
        const res = await api.focusWindow(w.pid);
        setStatus(res && res.ok ? `Focused pid ${w.pid}` : `Focus failed: ${res && res.error}`);
      });
      windowsList.appendChild(btn);
    }
  }

  async function refreshWindows() {
    if (needsApi()) return;
    try {
      const items = await api.listWindows();
      renderWindows(items);
    } catch (err) {
      setStatus(`Window list failed: ${err && err.message ? err.message : err}`);
    }
  }

  const windowsRefresh = $('windows-refresh');
  if (windowsRefresh) {
    windowsRefresh.addEventListener('click', () => {
      setStatus('Refreshing windows…');
      refreshWindows();
    });
  }

  // ------------------------------------------------------------------ Confirm dialog
  const confirmOverlay = $('confirm-overlay');
  const confirmTitle = $('confirm-title');
  const confirmMessage = $('confirm-message');
  const confirmOk = $('confirm-ok');
  const confirmCancel = $('confirm-cancel');
  let confirmResolver = null;

  function confirmAction(title, message) {
    return new Promise((resolve) => {
      confirmResolver = resolve;
      if (confirmTitle) confirmTitle.textContent = title;
      if (confirmMessage) confirmMessage.textContent = message;
      if (confirmOverlay) confirmOverlay.classList.remove('hidden');
    });
  }
  function closeConfirm(result) {
    if (confirmOverlay) confirmOverlay.classList.add('hidden');
    if (confirmResolver) {
      const r = confirmResolver;
      confirmResolver = null;
      r(Boolean(result));
    }
  }
  if (confirmOk) confirmOk.addEventListener('click', () => closeConfirm(true));
  if (confirmCancel) confirmCancel.addEventListener('click', () => closeConfirm(false));
  if (confirmOverlay) {
    confirmOverlay.addEventListener('click', (e) => {
      if (e.target === confirmOverlay) closeConfirm(false);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (confirmOverlay && !confirmOverlay.classList.contains('hidden') && e.key === 'Escape') {
      closeConfirm(false);
    }
  });

  // ------------------------------------------------------------------ Power
  async function handlePower(action) {
    if (needsApi()) return;
    const prompts = {
      lock: ['Lock workstation?', 'This will lock the current session.'],
      logoff: ['Sign out?', 'All unsaved work will be lost.'],
      restart: ['Restart this PC?', 'The computer will restart immediately. Unsaved work will be lost.'],
      shutdown: ['Shut down this PC?', 'The computer will shut down immediately. Unsaved work will be lost.'],
    };
    const p = prompts[action];
    if (!p) return;
    // Lock is the only non-destructive action; skip confirm.
    const ok = action === 'lock' ? true : await confirmAction(p[0], p[1]);
    if (!ok) return;
    setStatus(`Executing: ${action}…`);
    const res = await api.power[action]();
    if (res && res.ok) {
      setStatus(`${action} invoked.`);
    } else {
      setStatus(`${action} failed: ${res && res.error}`);
    }
  }

  document.querySelectorAll('.power-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      handlePower(action);
    });
  });

  // ------------------------------------------------------------------ Quick buttons
  document.querySelectorAll('.quick-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-action');
      if (action === 'launch-explorer') {
        if (needsApi()) return;
        const res = await api.launchExplorer();
        setStatus(res && res.ok ? 'explorer.exe launched' : 'explorer launch failed');
      } else if (action === 'refresh') {
        refreshLauncher();
        refreshWindows();
      }
    });
  });

  // ------------------------------------------------------------------ Init
  async function init() {
    await refreshLauncher();
    await refreshWindows();
    // Auto-refresh windows every 10s so task list stays fresh. We don't
    // auto-refresh the launcher; rely on the Refresh button + cache TTL.
    setInterval(() => {
      if (!document.hidden) refreshWindows();
    }, 10000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
