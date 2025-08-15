const term = new Terminal({ cursorBlink: true, fontSize: 14, theme: { background: '#0b0f14', foreground: '#e5edf5', cursor: '#ff3b30' } });
const termEl = document.getElementById('terminal'); term.open(termEl);
function fit(){ const cols = Math.floor(termEl.clientWidth/9); const rows = Math.floor(termEl.clientHeight/18); window.edex.sendResize({cols,rows}); }
new ResizeObserver(fit).observe(termEl);
window.edex.onTermData(data => term.write(data));
window.edex.sendTermInit({ cols: 120, rows: 32 });
term.onData(d => window.edex.sendTermData(d));
setInterval(()=>document.getElementById('clock').textContent=new Date().toLocaleString(),500);
function bytes(n){if(!n&&n!==0)return'-';const u=['B','KB','MB','GB','TB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++;}return n.toFixed(1)+' '+u[i];}
window.edex.onStats((s)=>{
 document.getElementById('host').textContent = s.hostname;
 document.getElementById('os').textContent = `${s.platform} ${s.release}`;
 document.getElementById('cpuload').textContent = `${s.cpu.avgLoad.toFixed(1)}%`;
 document.getElementById('cputemp').textContent = s.temperature?.main ? `${s.temperature.main.toFixed(0)}°C` : '—';
 document.getElementById('mem').textContent = `${bytes(s.mem.used)} / ${bytes(s.mem.total)}`;
 document.getElementById('netlist').innerHTML = s.net.map(n=>`<div class="kv"><label>${n.iface}</label><span>↓ ${bytes(n.rx_sec)}/s • ↑ ${bytes(n.tx_sec)}/s</span></div>`).join('');
 document.getElementById('disklist').innerHTML = s.disks.map(d=>{const pct=(d.used/d.size)*100;return `<div class="disk"><div class="row"><span>${d.mount}</span><span>${bytes(d.used)} / ${bytes(d.size)}</span></div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;}).join('');
});