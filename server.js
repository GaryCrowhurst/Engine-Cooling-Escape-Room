// Minimal WebSocket relay for Cooling System Escape rooms
// Run: node server.js (requires Node 18+)

const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// room -> Set of sockets
const rooms = new Map();

const joinRoom = (ws, room) => {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  ws._room = room;
};

const leaveRoom = (ws) => {
  const room = ws._room;
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
  }
  ws._room = null;
};

const roomBroadcast = (room, data, except) => {
  const set = rooms.get(room);
  if (!set) return;
  for (const client of set) {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
};

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'join' && m.room) {
        joinRoom(ws, m.room);
        // Notify others
        roomBroadcast(m.room, JSON.stringify({ type:'join', room: m.room, name: m.name || 'Player' }), ws);
        return;
      }
      // Relay progress and any generic payload to room peers
      if (ws._room) {
        roomBroadcast(ws._room, raw.toString(), ws);
      }
    } catch {}
  });
  ws.on('close', () => leaveRoom(ws));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('WebSocket relay running on ws://localhost:' + PORT);
});
