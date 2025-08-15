// renderer.js
// UI layout + terminal + stats rendering
const term = new Terminal({
  cursorBlink: true,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontSize: 14,
  theme: {
    background: '#0b0f14',
    foreground: '#e5edf5',
    cursor: '#ff3b30',
    black: '#0b0f14'
  }
});

const termEl = document.getElementById('terminal');
term.open(termEl);

// Fit terminal to container size roughly
function fit() {
  const cols = Math.floor(termEl.clientWidth / 9); // rough char width
  const rows = Math.floor(termEl.clientHeight / 18);
  window.edex.sendResize({ cols, rows });
}
new ResizeObserver(fit).observe(termEl);

window.edex.onTermData((data) => term.write(data));
window.edex.sendTermInit({ cols: 120, rows: 32 });

// Keyboard -> PTY
term.onData(d => window.edex.sendTermData(d));

// Clock
const clockEl = document.getElementById('clock');
setInterval(() => {
  const d = new Date();
  clockEl.textContent = d.toLocaleString();
}, 500);

// Stats rendering
const hostEl = document.getElementById('host');
const osEl = document.getElementById('os');
const cpuEl = document.getElementById('cpuload');
const tempEl = document.getElementById('cputemp');
const memEl = document.getElementById('mem');
const netList = document.getElementById('netlist');
const diskList = document.getElementById('disklist');

function bytes(n){ if(!n&&n!==0) return '-'; const u=['B','KB','MB','GB','TB']; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return n.toFixed(1)+' '+u[i]; }

window.edex.onStats((s) => {
  hostEl.textContent = s.hostname;
  osEl.textContent = `${s.platform} ${s.release}`;
  cpuEl.textContent = `${s.cpu.avgLoad.toFixed(1)}%`;
  tempEl.textContent = s.temperature?.main ? `${s.temperature.main.toFixed(0)}°C` : '—';
  memEl.textContent = `${bytes(s.mem.used)} / ${bytes(s.mem.total)}`;

  netList.innerHTML = s.net.map(n => `<div class="kv"><label>${n.iface}</label><span>↓ ${bytes(n.rx_sec)}/s • ↑ ${bytes(n.tx_sec)}/s</span></div>`).join('');
  diskList.innerHTML = s.disks.map(d => {
    const pct = (d.used / d.size) * 100;
    return `<div class="disk">
      <div class="row">
        <span>${d.mount}</span><span>${bytes(d.used)} / ${bytes(d.size)}</span>
      </div>
      <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    </div>`;
  }).join('');
});
