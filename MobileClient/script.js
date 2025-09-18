const socket = io("/MobileClient");

const picker = document.getElementById("picker");
const debug = document.getElementById("debug");

function hexToRgbObject(hex) {
  const v = hex.replace("#", "");
  const bigint = parseInt(v, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function rgbToHex({ r, g, b }) {
  return (
    "#" +
    [r, g, b]
      .map(n => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, "0"))
      .join("")
  );
}

let current = { user_color: { r: 255, g: 255, b: 255 } };

function renderDebug(payload) {
  debug.textContent = JSON.stringify(payload, null, 2);
}

socket.on("state:init", (s) => {
  current = s.cel;
  picker.value = rgbToHex(s.cel.user_color);
  renderDebug(s);
});

socket.on("state", (payload) => renderDebug(payload.state));

picker.addEventListener("input", () => {
  current.user_color = hexToRgbObject(picker.value);
  socket.emit("update", current);
});
