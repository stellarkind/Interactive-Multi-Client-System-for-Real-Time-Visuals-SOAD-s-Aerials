// MobileClient/script.js
(function () {
  let socket;
  let picker, meIdEl, meHexEl, debugEl;

  function renderDebug(payload) {
    if (debugEl) debugEl.textContent = JSON.stringify(payload, null, 2);
  }

  function emitMyColor() {
    if (!socket || !picker) return;
    const hex = picker.value || '#ffffff';
    if (meHexEl) meHexEl.textContent = hex;
    socket.emit('mobile:colorHex', hex);
  }

  window.addEventListener('DOMContentLoaded', () => {
    // Referencias del DOM
    picker  = document.getElementById('picker');
    meIdEl  = document.getElementById('meId');
    meHexEl = document.getElementById('meHex');
    debugEl = document.getElementById('debug');

    // Conexión Socket.IO (mismo host/puerto del server)
    socket = io();

    // Te dice tu id de socket (para mostrarlo y para que el server te identifique)
    socket.on('whoami', ({ id }) => {
      if (meIdEl) meIdEl.textContent = id;
    });

    // Estado inicial que envía el server al conectar
    socket.on('state:init', (state) => {
      renderDebug(state);
      // Al conectar o reconectar, envía tu color actual para crear/actualizar tu antena
      emitMyColor();
    });

    // Estado incremental (para debug en el móvil)
    socket.on('state', ({ state }) => renderDebug(state));

    // Si el usuario cambia el color, lo mandamos al server
    if (picker) {
      picker.addEventListener('input', emitMyColor);
    }

    // Si la pestaña vuelve a estar visible, reenvía tu color por si hubo reconexión
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') emitMyColor();
    });

    // Logs útiles
    socket.on('connect', () => console.log('Mobile conectado'));
    socket.on('disconnect', () => console.log('Mobile desconectado'));
    socket.on('connect_error', (e) => console.error('Socket.IO error:', e));
  });
})();
