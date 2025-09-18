import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { WebSocketServer } from "ws";

// ---------------------------
// App & servers
// ---------------------------
const app = express();
const server = http.createServer(app);

// Socket.IO (para navegadores)
const io = new SocketIOServer(server, {
  cors: { origin: "*" }
});

// WebSocket crudo (para TouchDesigner)
const wss = new WebSocketServer({ server, path: "/td" });

// ---------------------------
// Estado global
// ---------------------------
const state = {
  desk:    { time: "day", season: 1, vantage: "outside" }, // "day"|"night", 1..4, "inside"|"outside"
  cel:     { user_color: { r: 255, g: 255, b: 255 } },
  control: { speed: 0.5, density: 0.5, color: { r: 255, g: 255, b: 255 } }
};

// Dispositivos conectados (aerials)
const aerials = new Map(); // id -> { id, color }

// ---------------------------
// Helpers
// ---------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v | 0));

function validateAndAssign(part, incoming) {
  if (!incoming || typeof incoming !== "object") return;

  if (part === "desk") {
    const t = incoming.time === "night" ? "night" : "day";
    const s = [1, 2, 3, 4].includes(incoming.season | 0)
      ? (incoming.season | 0)
      : state.desk.season;
    const v =
      incoming.vantage === "inside" || incoming.vantage === "outside"
        ? incoming.vantage
        : state.desk.vantage;
    state.desk = { time: t, season: s, vantage: v };
  }

  if (part === "cel") {
    const c = incoming.user_color || {};
    state.cel.user_color = {
      r: clamp(c.r ?? state.cel.user_color.r, 0, 255),
      g: clamp(c.g ?? state.cel.user_color.g, 0, 255),
      b: clamp(c.b ?? state.cel.user_color.b, 0, 255)
    };
  }

  if (part === "control") {
    const sp = Number(incoming.speed ?? state.control.speed);
    const de = Number(incoming.density ?? state.control.density);
    state.control.speed = Math.max(0, Math.min(1, isNaN(sp) ? state.control.speed : sp));
    state.control.density = Math.max(0, Math.min(1, isNaN(de) ? state.control.density : de));
    const c = incoming.color || {};
    state.control.color = {
      r: clamp(c.r ?? state.control.color.r, 0, 255),
      g: clamp(c.g ?? state.control.color.g, 0, 255),
      b: clamp(c.b ?? state.control.color.b, 0, 255)
    };
  }
}

function fullStateForTD() {
  return {
    ...state,
    aerials: {
      count: aerials.size,
      devices: Array.from(aerials.values())
    }
  };
}

function fullStateForWeb() {
  return {
    ...state,
    aerials: { count: aerials.size }
  };
}

function broadcastToTD() {
  const payload = JSON.stringify({ type: "fullState", data: fullStateForTD() });
  wss.clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

function broadcastToWeb(part) {
  io.emit("state", { part, state: fullStateForWeb() });
}

// ---------------------------
// Namespaces Socket.IO
// ---------------------------
const nsDesk = io.of("/desk");
const nsCel = io.of("/cel");
const nsControl = io.of("/control");

// /desk
nsDesk.on("connection", socket => {
  socket.emit("state:init", fullStateForWeb());

  socket.on("update", payload => {
    validateAndAssign("desk", payload);
    broadcastToTD();
    broadcastToWeb("desk");
  });
});

// /cel
nsCel.on("connection", socket => {
  const id = socket.id.slice(0, 6);
  aerials.set(id, { id, color: state.cel.user_color });
  socket.emit("state:init", fullStateForWeb());
  broadcastToTD();
  broadcastToWeb("cel");

  socket.on("update", payload => {
    validateAndAssign("cel", payload);
    const dev = aerials.get(id);
    if (dev) dev.color = state.cel.user_color;
    broadcastToTD();
    broadcastToWeb("cel");
  });

  socket.on("disconnect", () => {
    aerials.delete(id);
    broadcastToTD();
    broadcastToWeb("cel");
  });
});

// /control
nsControl.on("connection", socket => {
  socket.emit("state:init", fullStateForWeb());

  socket.on("update", payload => {
    validateAndAssign("control", payload);
    broadcastToTD();
    broadcastToWeb("control");
  });
});

// ---------------------------
// WebSocket TD
// ---------------------------
wss.on("connection", ws => {
  // Estado actual al conectar
  ws.send(JSON.stringify({ type: "fullState", data: fullStateForTD() }));

  ws.on("message", msg => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed && parsed.part && parsed.data) {
        validateAndAssign(parsed.part, parsed.data);
        broadcastToTD();
        broadcastToWeb(parsed.part);
      }
    } catch (e) {
      console.error("WS TD parse error:", e);
    }
  });
});

// ---------------------------
// Static & rutas
// ---------------------------
app.use(express.static("public"));

app.get("/", (_, res) => {
  res.type("html").send(`
    <h1>TD Multi-UI Bridge</h1>
    <ul>
      <li><a href="/DesktopClient/">/DesktopClient</a> — escena (time/season/vantage)</li>
      <li><a href="/MobileClient/">/MobileClient</a> — móviles (color por usuario)</li>
      <li><a href="/Control/">/Control</a> — speed/density/color maestro</li>
    </ul>
    <p>TD WebSocket: <code>ws://HOST:3000/td</code></p>
  `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});
