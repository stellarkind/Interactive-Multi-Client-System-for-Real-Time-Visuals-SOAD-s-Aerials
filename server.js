// server.js
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });
const wss = new WebSocketServer({ server, path: "/td" });

// ---------- Estado global ----------
const state = {
  desk:    { time: "day", season: 1, vantage: "outside" },
  control: { speed: 0.5, density: 0.5, color: { r: 255, g: 255, b: 255 } },
  // color por defecto para nuevos móviles (solo valor inicial)
  cel:     { user_color: { r: 255, g: 255, b: 255 } }
};

// Cada móvil = antena propia
const aerials = new Map(); // id -> { id, color:{r,g,b} }

const clamp = (v, a, b) => Math.max(a, Math.min(b, v | 0));
const cleanColor = c => ({
  r: clamp((c?.r ?? 255), 0, 255),
  g: clamp((c?.g ?? 255), 0, 255),
  b: clamp((c?.b ?? 255), 0, 255),
});

function validateAndAssign(part, incoming) {
  if (!incoming || typeof incoming !== "object") return;

  if (part === "desk") {
    const t = incoming.time === "night" ? "night" : "day";
    const s = [1,2,3,4].includes(incoming.season | 0) ? (incoming.season | 0) : state.desk.season;
    const v = (incoming.vantage === "inside" || incoming.vantage === "outside")
      ? incoming.vantage : state.desk.vantage;
    state.desk = { time: t, season: s, vantage: v };
  }

  if (part === "control") {
    const sp = Number(incoming.speed ?? state.control.speed);
    const de = Number(incoming.density ?? state.control.density);
    state.control.speed   = Math.max(0, Math.min(1, isNaN(sp) ? state.control.speed   : sp));
    state.control.density = Math.max(0, Math.min(1, isNaN(de) ? state.control.density : de));
    state.control.color   = cleanColor(incoming.color ?? state.control.color);
  }

  if (part === "cel" && incoming.user_color) {
    // solo actualiza el default para nuevas conexiones
    state.cel.user_color = cleanColor(incoming.user_color);
  }
}

const aerialsArray = () => Array.from(aerials.values());
function fullStateForTD() {
  return { ...state, aerials: { count: aerials.size, devices: aerialsArray() } };
}
function fullStateForWeb() {
  // Enviamos también la lista completa a las UIs
  return { ...state, aerials: { count: aerials.size, devices: aerialsArray() } };
}

function broadcastToTD() {
  const payload = JSON.stringify({ type: "fullState", data: fullStateForTD() });
  wss.clients.forEach(ws => { if (ws.readyState === 1) ws.send(payload); });
}
function broadcastToWeb(part) {
  const payload = { part, state: fullStateForWeb() };
  io.of("/DesktopClient").emit("state", payload);
  io.of("/MobileClient").emit("state",  payload);
  io.of("/Control").emit("state",       payload);
}

// ---------- Namespaces ----------
io.of("/DesktopClient").on("connection", socket => {
  socket.emit("state:init", fullStateForWeb());
  socket.on("update", payload => { validateAndAssign("desk", payload); broadcastToTD(); broadcastToWeb("desk"); });
});

io.of("/MobileClient").on("connection", socket => {
  const id = socket.id.slice(0, 6);

  // Crea su antena con color por defecto
  aerials.set(id, { id, color: { ...state.cel.user_color } });

  // Identidad propia del cliente
  socket.emit("you", { id, color: aerials.get(id).color });

  socket.emit("state:init", fullStateForWeb());
  broadcastToTD(); broadcastToWeb("cel");

  socket.on("update", payload => {
    if (payload?.user_color) {
      const col = cleanColor(payload.user_color);
      const dev = aerials.get(id);
      if (dev) dev.color = col;
      socket.emit("you", { id, color: col }); // eco solo a ese cliente
      broadcastToTD(); broadcastToWeb("cel");
    }
  });

  socket.on("disconnect", () => {
    aerials.delete(id);
    broadcastToTD(); broadcastToWeb("cel");
  });
});

io.of("/Control").on("connection", socket => {
  socket.emit("state:init", fullStateForWeb());
  socket.on("update", payload => { validateAndAssign("control", payload); broadcastToTD(); broadcastToWeb("control"); });
});

// ---------- WebSocket TD ----------
wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "fullState", data: fullStateForTD() }));
  ws.on("message", msg => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed?.part && parsed?.data) {
        validateAndAssign(parsed.part, parsed.data);
        broadcastToTD(); broadcastToWeb(parsed.part);
      }
    } catch (e) { console.error("WS TD parse error:", e); }
  });
});

// ---------- API: lista completa de antenas ----------
app.get("/api/aerials", (_req, res) => {
  res.json({ count: aerials.size, devices: aerialsArray() });
});

// ---------- Estáticos SOLO en tus 3 rutas ----------
app.use("/DesktopClient", express.static("public/DesktopClient"));
app.use("/MobileClient",  express.static("public/MobileClient"));
app.use("/Control",       express.static("public/Control"));
// (por si también las tienes en la raíz del repo)
app.use("/DesktopClient", express.static("DesktopClient"));
app.use("/MobileClient",  express.static("MobileClient"));
app.use("/Control",       express.static("Control"));

app.get("/", (_req, res) => {
  res.type("html").send(`
    <h1>TD Bridge</h1>
    <ul>
      <li><a href="/DesktopClient/">/DesktopClient/</a></li>
      <li><a href="/MobileClient/">/MobileClient/</a></li>
      <li><a href="/Control/">/Control/</a></li>
    </ul>
    <p>WS TD: <code>ws://HOST:3000/td</code></p>
    <p>API antenas: <code>/api/aerials</code></p>
  `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server on http://localhost:${PORT}`));
