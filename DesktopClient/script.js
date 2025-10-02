const socket = io();

const season    = document.getElementById('season');
const seasonVal = document.getElementById('seasonVal');
const debug     = document.getElementById('debug');
const me        = document.getElementById('me');
const meHex     = document.getElementById('meHex');

let myId = '—';
let current = {
  time: 'day',
  season: 1,
  vantage: 'outside'
};

function render(payload){ debug.textContent = JSON.stringify(payload, null, 2); }

socket.on('connect', ()=> console.log('Desk conectado'));

socket.on('whoami', ({id}) => { myId = id; me.textContent = id.slice(0,6); });

socket.on('state:init', (s)=>{
  render(s);
});

socket.on('state', payload => render(payload.state || payload));

function emitUpdate(){
  socket.emit('update', current);
}

// listeners
document.querySelectorAll('input[name="time"]').forEach(r=>{
  r.addEventListener('change', ()=>{
    if (r.checked){ current.time = r.value; emitUpdate(); }
  });
});
season.addEventListener('input', ()=>{
  current.season = Number(season.value);
  seasonVal.textContent = String(current.season);
  emitUpdate();
});
document.querySelectorAll('input[name="vantage"]').forEach(r=>{
  r.addEventListener('change', ()=>{
    if (r.checked){ current.vantage = r.value; emitUpdate(); }
  });
});

// mostrar el último color que llegó desde móviles
socket.on('color', msg => { meHex.textContent = msg?.hex || '#ffffff'; });
