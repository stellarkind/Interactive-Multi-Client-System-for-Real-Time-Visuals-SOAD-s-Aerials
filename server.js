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
  cors: { origin: true, methods: ['GET', 'POST'] }
});

// ---------- estado en memoria ----------
/**
 * aerials: Map<socketId, { id, color: {r,g,b}, hex, updatedAt? }>
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

// ---------- helpers ----------
const rgbToHex = ({ r, g, b }) =>
  '#' +
  [r, g, b]
    .map(v =>
      Math.max(0, Math.min(255, Number(v) | 0))
        .toString(16)
        .padStart(2, '0')
    )
    .join('');

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
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
    <p style="opacity:.7">Si ves "Cannot GET /", entra por alguno de los enlaces de arriba.</p>
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

  // Identidad del socket
  socket.emit('whoami', { id: socket.id });

  // Unirse a la room de Visuales (si el cliente lo pide)
  socket.on('messageClienteVisuales', () => {
    socket.join('Visuales room');
    console.log(`Client ${socket.id} joined 'Visuales room'`);
  });

  // ----- CONTROL: sliders -----
  socket.on('slider_changed', (data) => {
    // Persistir algunos sliders si te interesa (ejemplo speed/density)
    if (data && typeof data.label === 'string') {
      if (data.label === 'speed')   control.speed   = Number(data.value);
      if (data.label === 'density') control.density = Number(data.value);
      // Agrega aquí otros si quieres guardarlos: rows, columns, etc.
    }

    // 1) Reenviar solo a Visuales (compat con tu proyecto anterior)
    io.to('Visuales room').emit('slider_changed', data);

    // 2) Y emitir state a todos para debug/TD/UIs
    io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });
  });

  // ----- CONTROL: estado completo (UI que manda todo el objeto) -----
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
    const aerial = { id: socket.id, color: rgb, hex: defaultHex, updatedAt: Date.now() };
    aerials.set(socket.id, aerial);
    console.log(`(MOBILE) Aerial creado: ${socket.id}`);

    // Estado inicial al que llega
    socket.emit('state:init', { control, aerials: Array.from(aerials.values()) });

    // Notificar a todos el estado
    io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });
  }

  // ----- MOBILE: cambio de color por HEX -----
  socket.on('mobile:colorHex', (hex) => {
    const a = aerials.get(socket.id);
    if (!a) return;
    const rgb = hexToRgb(hex);
    a.color = rgb;
    a.hex = rgbToHex(rgb);
    a.updatedAt = Date.now();
    aerials.set(socket.id, a);

    io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });

    // Evento incremental para TD (incluye id y rgb completos)
    io.emit('color', {
      type: 'color',
      id: socket.id,
      r: rgb.r, g: rgb.g, b: rgb.b,
      hex: a.hex,
      updatedAt: a.updatedAt
    });
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
    a.updatedAt = Date.now();
    aerials.set(socket.id, a);

    io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });

    // Evento incremental para TD (incluye id y rgb completos)
    io.emit('color', {
      type: 'color',
      id: socket.id,
      r: safe.r, g: safe.g, b: safe.b,
      hex: a.hex,
      updatedAt: a.updatedAt
    });
  });

  // ----- Mensajes varios (compat con proyecto de tus compas) -----
  socket.on('message_controller', (estado) => {
    io.to('Visuales room').emit('answer_mobile', { from: socket.id, estado });
  });

  // ----- desconexión -----
  socket.on('disconnect', () => {
    if (aerials.has(socket.id)) {
      aerials.delete(socket.id);
      console.log(`(MOBILE) Aerial removido: ${socket.id}`);
      io.emit('state', { state: { control, aerials: Array.from(aerials.values()) } });
    }
  });
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
