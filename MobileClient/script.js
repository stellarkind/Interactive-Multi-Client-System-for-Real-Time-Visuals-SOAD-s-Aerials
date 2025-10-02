const socket = io();

const picker = document.getElementById('picker');
const me     = document.getElementById('me');
const hexEl  = document.getElementById('hex');
const debug  = document.getElementById('debug');

let myId = '—';

function render(payload){ debug.textContent = JSON.stringify(payload, null, 2); }

socket.on('connect', ()=> console.log('Mobile conectado'));

socket.on('whoami', ({id}) => { myId = id; me.textContent = id.slice(0,6); });

socket.on('state:init', (s)=> render(s));
socket.on('state', payload => render(payload.state || payload));

picker.addEventListener('input', ()=>{
  const hex = picker.value;
  hexEl.textContent = hex;
  socket.emit('mobile:colorHex', hex);
});
