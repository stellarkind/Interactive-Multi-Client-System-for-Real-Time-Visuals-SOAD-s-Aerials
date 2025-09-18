const socket = io("/Control");

const speed = document.getElementById("speed");
const speedVal = document.getElementById("speedVal");
const density = document.getElementById("density");
const densityVal = document.getElementById("densityVal");
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

let current = {
  speed: 0.5,
  density: 0.5,
  color: { r: 255, g: 255, b: 255 }
};

function renderDebug(payload) {
  debug.textContent = JSON.stringify(payload, null, 2);
}

socket.on("state:init", (s) => {
  current = s.control;

  // sliders
  speed.value = s.control.speed;
  speedVal.textContent = Number(s.control.speed).toFixed(2);
  density.value = s.control.density;
  densityVal.textContent = Number(s.control.density).toFixed(2);

  // color
  picker.value = rgbToHex(s.control.color);

  renderDebug(s);
});

socket.on("state", (payload) => renderDebug(payload.state));

function emit() { socket.emit("update", current); }

speed.addEventListener("input", () => {
  current.speed = Number(speed.value);
  speedVal.textContent = current.speed.toFixed(2);
  emit();
});

density.addEventListener("input", () => {
  current.density = Number(density.value);
  densityVal.textContent = current.density.toFixed(2);
  emit();
});

picker.addEventListener("input", () => {
  current.color = hexToRgbObject(picker.value);
  emit();
});
