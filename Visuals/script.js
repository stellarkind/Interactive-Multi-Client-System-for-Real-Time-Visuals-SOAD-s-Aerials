const socket = io();

// UI
const statusEl = document.getElementById('status');
const countEl  = document.getElementById('count');
const spdEl    = document.getElementById('spd');
const dnsEl    = document.getElementById('dns');
const debugEl  = document.getElementById('debug');

// Canvas
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let WIDTH = 0, HEIGHT = 0;
function resize(){
  WIDTH = canvas.width  = window.innerWidth;
  HEIGHT = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// estado local
let state = {
  control: { speed: 0.5, density: 0.5 },
  aerials: []
};

function renderDebug(payload){ debugEl.textContent = JSON.stringify(payload, null, 2); }
function rgb({r,g,b}){ return `rgb(${r},${g},${b})`; }

socket.on('connect', ()=>{
  statusEl.textContent = 'Conectado';
  socket.emit('messageClienteVisuales'); // ¡únete a la room!
});

socket.on('state:init', (s)=>{
  state.control = s.control || state.control;
  state.aerials = s.aerials || [];
  spdEl.textContent = Number(state.control.speed).toFixed(2);
  dnsEl.textContent = Number(state.control.density).toFixed(2);
  countEl.textContent = String(state.aerials.length);
  renderDebug(s);
});

socket.on('state', ({state: s})=>{
  if (s?.control) state.control = s.control;
  if (s?.aerials) state.aerials = s.aerials;
  spdEl.textContent = Number(state.control.speed).toFixed(2);
  dnsEl.textContent = Number(state.control.density).toFixed(2);
  countEl.textContent = String(state.aerials.length);
  renderDebug(s);
});

socket.on('slider_changed', d=>{
  // Solo para mostrar
  if (d?.label === 'speed')   { state.control.speed   = Number(d.value); spdEl.textContent = Number(d.value).toFixed(2); }
  if (d?.label === 'density') { state.control.density = Number(d.value); dnsEl.textContent = Number(d.value).toFixed(2); }
});

socket.on('color', msg=>{
  // Mensaje incremental (ya impacta en state por el broadcast de 'state'),
  // pero lo dejamos por si quieres animar eventos momentáneos.
  // console.log('color', msg);
});

// loop de dibujo simple: distribuye antenas en círculo
function draw(){
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  const n = state.aerials.length || 1;
  const radius = Math.min(WIDTH, HEIGHT) * 0.35;
  const cx = WIDTH/2, cy = HEIGHT/2;

  state.aerials.forEach((a, i)=>{
    const t = (i / n) * Math.PI * 2 + performance.now() * 0.0003 * state.control.speed;
    const x = cx + Math.cos(t) * radius;
    const y = cy + Math.sin(t) * radius;
    ctx.beginPath();
    ctx.arc(x, y, 18 + 10*state.control.density, 0, Math.PI*2);
    ctx.fillStyle = a?.hex || rgb(a?.color || {r:255,g:255,b:255});
    ctx.fill();
    ctx.closePath();
  });

  requestAnimationFrame(draw);
}
draw();
