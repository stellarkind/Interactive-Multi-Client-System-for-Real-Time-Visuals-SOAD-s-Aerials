**Title:** Interactive Multi-Client System for Real-Time Visuals — Aerials  
**Authors:** Stella Pérez · José Ignacio Trujillo  
**Course:** Interactive Physical Systems 2 — UPB (Aug–Oct 2025)  

### Descripción breve:
Sistema distribuido con múltiples clientes (Mobile, Control, Desktop, Visuals) que envían/reciben datos vía Socket.IO hacia/desde un servidor Node.js. TouchDesigner renderiza visuales en tiempo real usando los datos agregados (colores por antena, parámetros de escena). La pieza explora agencia distribuida del público mediante móviles y una dirección de escena desde Control.

[Playlist Interpretación visual en TouchDesigner Aerials](https://www.youtube.com/playlist?list=PL3luto4uXITXQr0wZogAYSxRoQoYmAHNi)

## Arquitectura (alto nivel):
**Clientes web (Mobile/Control/Desktop/Visuals)** ←→ **Socket.IO** ←→ **Node.js (server.js)** ←→ **TouchDesigner.**  
**Estado compartido:** control (sliders, color maestro) + aerials (mapa de móviles {id, color}).  

## Rutas locales:  
> http://localhost:3000/mobile · …/control · …/desktop · …/visuals (para probar el servidor y la transmisión correcta de mensajes trasladado visualmente)  

## Ejecutar:
``` 
npm i  
npm start  
# Abrir TouchDesigner: TouchDesigner/WaterFall22.toe  
# Conectar SocketIO DAT a http://localhost:3000  
```

### Contrato de eventos (Socket.IO)
| **Origen → Destino**            | **Evento**                 | **Payload (forma)**                                                                              | **Descripción / Uso principal**                                              |
|---------------------------- |----------------------- |----------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **Servidor → Cliente/TD**   | `whoami`               | `{ id: string }`                                                                             | Asigna/retorna el `socket.id` del cliente al conectar.                   |
| **Servidor → Cliente/TD**   | `state:init`           | `{ control: { speed:number, density:number, color:{r,g,b} }, aerials: Array<Aerial> }`       | Estado inicial completo al conectar.                                     |
| **Servidor → Cliente/TD**   | `state`                | `{ state: { control: {...}, aerials: Array<Aerial> } }`                                      | Broadcast de estado actualizado (control y móviles).                     |
| **Servidor → Cliente/TD**   | `color`                | `{ type: "color", x: number /* rojo */ }` <br>_*Opcional:* `{ id, r, g, b }`                 | Evento incremental de color para compatibilidad con TD.                  |
| **Control → Servidor**      | `slider_changed`       | `{ label: "speed" \| "density" \| ..., value: number }`                                      | Cambio de un slider; el servidor lo reenvía a “Visuales room”.           |
| **Control → Servidor**      | `update`               | `{ speed:number, density:number, color:{ r:number, g:number, b:number } }`                   | Envía el **estado completo** del panel de control.                       |
| **Mobile → Servidor**       | `mobile:colorHex`      | `"#rrggbb"`                                                                                  | Cambia color del móvil usando HEX.                                       |
| **Mobile → Servidor**       | `mobile:colorRgb`      | `{ r:number, g:number, b:number }`                                                           | Cambia color del móvil usando RGB.                                       |
| **TD → Servidor**| `messageClienteVisuales` | *(sin payload)*                                                                              | Hace que el socket de TD se una a la sala **"Visuales room"**.           |

> **Tipo `Aerial`**: `{ id: string, color: { r:number, g:number, b:number }, hex: string }`

## Créditos y licencias:
Canción Aerials de System of a Down usada con fines educativos (no comercial). Código utilizado en touchdesigner y servidor bajo MIT.

