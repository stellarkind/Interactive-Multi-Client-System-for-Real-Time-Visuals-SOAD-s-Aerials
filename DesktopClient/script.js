const socket = io("/DesktopClient");

const season = document.getElementById("season");
const seasonVal = document.getElementById("seasonVal");
const debug = document.getElementById("debug");

let current = { time: "day", season: 1, vantage: "outside" };

function renderDebug(payload) {
  debug.textContent = JSON.stringify(payload, null, 2);
}

socket.on("state:init", (s) => {
  current = s.desk;
  // time
  const timeInput = document.querySelector(`input[name="time"][value="${s.desk.time}"]`);
  if (timeInput) timeInput.checked = true;
  // season
  season.value = s.desk.season ?? 1;
  seasonVal.textContent = String(season.value);
  // vantage
  const vInput = document.querySelector(`input[name="vantage"][value="${s.desk.vantage}"]`);
  if (vInput) vInput.checked = true;
  renderDebug(s);
});

socket.on("state", (payload) => renderDebug(payload.state));

// Listeners
document.querySelectorAll('input[name="time"]').forEach(r => {
  r.addEventListener("change", () => {
    current.time = r.value;
    socket.emit("update", current);
  });
});

season.addEventListener("input", () => {
  current.season = Number(season.value);
  seasonVal.textContent = String(current.season);
  socket.emit("update", current);
});

document.querySelectorAll('input[name="vantage"]').forEach(r => {
  r.addEventListener("change", () => {
    current.vantage = r.value;
    socket.emit("update", current);
  });
});
