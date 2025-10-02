const socket = io();

const speed    = document.getElementById('speed');
const density  = document.getElementById('density');
const picker   = document.getElementById('picker');

const speedVal   = document.getElementById('speedVal');
const densityVal = document.getElementById('densityVal');
const debug = document.getElementById('debug');

let current = { speed: 0.5, density: 0.5, color: { r:255, g:255, b:255 } };

function hexToRgbObject (hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r:255, g:255, b:255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex ({r,g,b}) {
  return '#' + [r,g,b].map(v=>Math.max(0,Math.min(255, v|0)).toString(16).padStart(2,'0')).join('');
}

function render(payload){ debug.textContent = JSON.stringify(payload, null, 2); }

socket.on('connect', ()=> console.log('Control conectado', socket.id));

socket.on('state:init', (s)=>{
  if (s?.control){
    current = s.control;
    speed.value = s.control.speed;
    density.value = s.control.density;
    picker.value = rgbToHex(s.control.color);
    speedVal.textContent   = Number(s.control.speed).toFixed(2);
    densityVal.textContent = Number(s.control.density).toFixed(2);
  }
  render(s);
});

socket.on('state', payload => render(payload.state || payload));

function emitState(){
  socket.emit('update', current); // difunde estado completo
}

function emitSlider(label, value){
  socket.emit('slider_changed', { label, value }); // compat con Visuals
}

speed.addEventListener('input', ()=>{
  current.speed = Number(speed.value);
  speedVal.textContent = current.speed.toFixed(2);
  emitSlider('speed', current.speed);
  emitState();
});

density.addEventListener('input', ()=>{
  current.density = Number(density.value);
  densityVal.textContent = current.density.toFixed(2);
  emitSlider('density', current.density);
  emitState();
});

picker.addEventListener('input', ()=>{
  current.color = hexToRgbObject(picker.value);
  emitState();
});
