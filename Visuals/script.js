// Visuals/script.js
let socket;
let current = { control: { speed: 0.5, density: 0.5 }, aerials: [] };
let connected = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textFont('system-ui, sans-serif');

  socket = io();

  socket.on('connect', () => { connected = true; });
  socket.on('disconnect', () => { connected = false; });

  socket.on('state:init', (payload) => {
    current.control = payload.control ?? current.control;
    current.aerials = payload.aerials ?? [];
  });

  socket.on('state', ({ state }) => {
    if (!state) return;
    if (state.control) current.control = state.control;
    if (state.aerials) current.aerials = state.aerials;
  });

  // compat con tu server anterior: ver cambios de sliders
  socket.on('slider_changed', (d) => {
    // si quieres, refleja sliders en pantalla:
    // console.log('slider_changed', d);
  });
}

function draw() {
  background(20);

  // header
  fill(200);
  textSize(14);
  const msg = connected ? 'Conectado' : 'Conectando...';
  text(`${msg}   ·   ${current.aerials.length} antenas`, 10, 18);

  // dibujar antenas en una malla responsive
  const n = current.aerials.length;
  if (n === 0) return;

  const cols = ceil(sqrt(n));
  const rows = ceil(n / cols);
  const padding = 24;
  const cellW = (width - padding * 2) / cols;
  const cellH = (height - padding * 2) / rows;
  const r = min(cellW, cellH) * 0.35; // radio del círculo

  current.aerials.forEach((a, idx) => {
    const c = a.color || { r: 255, g: 255, b: 255 };
    const col = idx % cols;
    const row = floor(idx / cols);
    const cx = padding + col * cellW + cellW / 2;
    const cy = padding + row * cellH + cellH / 2;

    fill(c.r, c.g, c.b);
    circle(cx, cy, r * 2);

    // id (pequeño) bajo el círculo
    fill(220);
    textAlign(CENTER);
    textSize(12);
    text(a.id?.slice(0, 5) ?? '?', cx, cy + r + 14);
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
