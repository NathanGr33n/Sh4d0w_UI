//By: NathanGr33n
const term = new Terminal({
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
term.open(termEl);

function fit() {
  const cols = Math.floor(termEl.clientWidth / 9);
  const rows = Math.floor(termEl.clientHeight / 18);
  if (window.edex?.sendResize) window.edex.sendResize({ cols, rows });
}
new ResizeObserver(fit).observe(termEl);

if (window.edex?.onTermData) {
  window.edex.onTermData((data) => term.write(data));
  window.edex.sendTermInit({ cols: 120, rows: 32 });
  term.onData(d => window.edex.sendTermData(d));
}

// Clock
const clockEl = document.getElementById('clock');
setInterval(() => { clockEl.textContent = new Date().toLocaleString(); }, 500);

// Stats rendering (same as before)
const els = {
  host: document.getElementById('host'),
  os: document.getElementById('os'),
  cpu: document.getElementById('cpuload'),
  temp: document.getElementById('cputemp'),
  mem: document.getElementById('mem'),
  net: document.getElementById('netlist'),
  disk: document.getElementById('disklist')
};
function bytes(n){ if(!n&&n!==0) return '-'; const u=['B','KB','MB','GB','TB']; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return n.toFixed(1)+' '+u[i]; }
if (window.edex?.onStats) {
  window.edex.onStats((s) => {
    els.host.textContent = s.hostname;
    els.os.textContent = `${s.platform} ${s.release}`;
    els.cpu.textContent = `${s.cpu.avgLoad.toFixed(1)}%`;
    els.temp.textContent = s.temperature?.main ? `${s.temperature.main.toFixed(0)}°C` : '—';
    els.mem.textContent = `${bytes(s.mem.used)} / ${bytes(s.mem.total)}`;
    els.net.innerHTML = s.net.map(n => `<div class="kv"><label>${n.iface}</label><span>↓ ${bytes(n.rx_sec)}/s • ↑ ${bytes(n.tx_sec)}/s</span></div>`).join('');
    els.disk.innerHTML = s.disks.map(d => {
      const pct = (d.used / d.size) * 100;
      return `<div class="disk">
        <div class="row"><span>${d.mount}</span><span>${bytes(d.used)} / ${bytes(d.size)}</span></div>
        <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
      </div>`;
    }).join('');
  });
}
