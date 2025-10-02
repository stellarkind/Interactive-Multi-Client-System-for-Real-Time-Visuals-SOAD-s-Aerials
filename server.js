// server.js (ESM)
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// --- util para __dirname en ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- app/http/io ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // CORS abierto local; ajusta si montas detrás de proxy/dominio
  cors: { origin: true, methods: ['GET', 'POST'] }
});

// ---------- estado en memoria ----------
/**
 * aerials: Map<socketId, { id, color: {r,g,b}, hex }>
 * Se crea una entrada por **cada cliente móvil** conectado.
 */
const aerials = new Map();

/**
 * control: estado de sliders / visual params (para /control y /visuals)
 */
const control = {
  speed: 0.5,
  density: 0.5,
  color: { r: 255, g: 255, b: 255 }
};

// helpers
const rgbToHex = ({ r, g, b }) =>
  '#' +
  [r, g, b]
    .map(v => Math.max(0, Math.min(255, Number(v) | 0))
      .toString(16)
      .padStart(2, '0'))
    .join('');

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
};

// ---------- static (clientes) ----------
app.use('/mobile',  express.static(path.join(__dirname, 'MobileClient')));
app.use('/desktop', express.static(path.join(__dirname, 'DesktopClient')));
app.use('/control', express.static(path.join(__dirname, 'Control')));
app.use('/visuals', express.static(path.join(__dirname, 'Visuals')));

// ---------- landing raíz ----------
app.get('/', (_req, res) => {
  res.send(`
    <h1>Clientes</h1>
    <ul>
      <li><a href="/mobile/">Mobile</a></li>
      <li><a href="/desktop/">Desktop</a></li>
      <li><a href="/control/">Control</a></li>
      <li><a href="/visuals/">Visuals</a></li>
      <li><a href="/api/aerials">API · Aerials</a></li>
    </ul>
    <p style="opacity:.7">Tip: si ves "Cannot GET /", entra por alguno de los enlaces arriba.</p>
  `);
});

// ---------- API ----------
app.get('/api/aerials', (_req, res) => {
  res.json({
    count: aerials.size,
    aerials: Array.from(aerials.values())
  });
});

// ---------- SOCKET.IO ----------
io.on('connection', (socket) => {
  const referer = (socket.handshake.headers.referer || '').toLowerCase();

  // id para el cliente
  socket.emit('whoami', { id: socket.id });

  // ----- agrégate a "Visuales room" si lo pide (compat con tu código previo) -----
  socket.on('messageClienteVisuales', () => {
    socket.join('Visuales room');
    console.log(`Client ${socket.id} joined 'Visuales room'`);
  });

  // ----- CONTROL: sliders (compat con tu evento) -----
  socket.on('slider_changed', (data) => {
    // data: { label, value }
    if (data && typeof data.label === 'string') {
      if (data.label === 'speed')   control.speed   = Number(data.value);
      if (data.label === 'density') control.density = Number(data.value);
      // otros sliders personalizados:
      // distance_near, distance_far, width_near, width_far, rows, columns, etc.
    }
    // reenvía SOLO a Visuales (como tu server anterior)
    io.to('Visuales room').emit('slider_changed', data);
  });

  // ----- CONTROL: estado completo (si usas "update" desde un UI control) -----
  socket.on('update', (newControl) => {
    if (newControl && typeof newControl === 'object') {
      Object.assign(control, newControl);
      io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });
    }
  });

  // ----- MOBILE: detectar por referer y crear AERIAL al conectar -----
  const isMobileClient = referer.includes('/mobile');
  if (isMobileClient) {
    const defaultHex = '#ffffff';
    const rgb = hexToRgb(defaultHex);
    const aerial = { id: socket.id, color: rgb, hex: defaultHex };
    aerials.set(socket.id, aerial);
    console.log(`(MOBILE) Aerial creado: ${socket.id}`);

    // enviar estado inicial al recién llegado (patrón "state:init")
    socket.emit('state:init', { control, aerials: Array.from(aerials.values()) });

    // notificar a todos el nuevo estado
    io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });
  }

  // ----- MOBILE: cambio de color por HEX -----
  socket.on('mobile:colorHex', (hex) => {
    const a = aerials.get(socket.id);
    if (!a) return; // ignora si no es un cliente móvil registrado
    const rgb = hexToRgb(String(hex || '#ffffff'));
    a.color = rgb;
    a.hex = rgbToHex(rgb);
    aerials.set(socket.id, a);

    // 1) broadcast de estado (para UIs)
    io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });

    // 2) evento "color" para TouchDesigner (compat con tu callback que lee message['x'])
    //    Enviamos el rojo como 'x' (puedes extender con y,z si quieres g,b)
    io.emit('color', { type: 'color', x: rgb.r });
  });

  // ----- MOBILE: cambio de color por RGB -----
  socket.on('mobile:colorRgb', (rgb) => {
    const a = aerials.get(socket.id);
    if (!a) return;
    const safe = {
      r: Math.max(0, Math.min(255, Number(rgb?.r) || 0)),
      g: Math.max(0, Math.min(255, Number(rgb?.g) || 0)),
      b: Math.max(0, Math.min(255, Number(rgb?.b) || 0)),
    };
    a.color = safe;
    a.hex = rgbToHex(safe);
    aerials.set(socket.id, a);

    io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });
    io.emit('color', { type: 'color', x: safe.r });
  });

  // ----- ejemplo de respuesta a mobile (compat "answer_mobile"/"message_controller") -----
  // si ya usas estos eventos en tus clientes, puedes re-emitirlos
  socket.on('message_controller', (estado) => {
    // solo re-envía a Visuales; ajusta según tu lógica
    io.to('Visuales room').emit('answer_mobile', { from: socket.id, estado });
  });

  socket.on('disconnect', () => {
    // si era un móvil, elimina su aerial
    if (aerials.has(socket.id)) {
      aerials.delete(socket.id);
      console.log(`(MOBILE) Aerial removido: ${socket.id}`);
      io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });
    }
  });
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Listening on http://localhost:${PORT}`)
);
