import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
const port = Number(process.env.MULTIPLAYER_PORT || 3001);
const server = new WebSocketServer({ port, maxPayload: 2048 });
const clients = new Map();
server.on("connection", (socket, request) => {
  const room =
    new URL(request.url, "http://local").searchParams.get("room") || "tinubu";
  if (
    !/^[a-zA-Z0-9_-]{1,32}$/.test(room) ||
    [...clients.values()].filter((c) => c.room === room).length >= 16
  ) {
    socket.close(1008, "Room unavailable");
    return;
  }
  const id = randomUUID().slice(0, 8),
    now = Date.now();
  const client = {
    id,
    room,
    socket,
    x: -18,
    y: 0.16,
    z: 24,
    yaw: 0,
    moving: false,
    last: now,
    alive: true,
    window: now,
    messages: 0,
    hasPose: false,
  };
  clients.set(id, client);
  socket.send(JSON.stringify({ type: "welcome", id }));
  socket.on("pong", () => (client.alive = true));
  socket.on("message", (buffer) => {
    const now = Date.now();
    if (now - client.window > 1000) {
      client.window = now;
      client.messages = 0;
    }
    if (++client.messages > 60) {
      socket.close(1008, "Rate limit");
      return;
    }
    let data;
    try {
      data = JSON.parse(buffer.toString());
    } catch {
      return;
    }
    if (
      data.type !== "move" ||
      ![data.x, data.y, data.z, data.yaw].every(Number.isFinite)
    )
      return;
    const delta = Math.min(0.5, (now - client.last) / 1000);
    const distance = Math.hypot(data.x - client.x, data.z - client.z);
    if (
      Math.abs(data.x) > 180 ||
      Math.abs(data.z) > 180 ||
      data.y < 0 ||
      data.y > 4 ||
      (client.hasPose && distance > 9 * delta + 0.8)
    )
      return;
    Object.assign(client, {
      hasPose: true,
      x: data.x,
      y: data.y,
      z: data.z,
      yaw: ((data.yaw % 360) + 360) % 360,
      moving: !!data.moving,
      last: now,
    });
  });
  socket.on("close", () => clients.delete(id));
  socket.on("error", () => socket.close());
});
const broadcast = setInterval(() => {
  const rooms = new Map();
  for (const c of clients.values()) {
    if (!c.hasPose) continue;
    if (!rooms.has(c.room)) rooms.set(c.room, []);
    rooms.get(c.room).push({
      id: c.id,
      x: c.x,
      y: c.y,
      z: c.z,
      yaw: c.yaw,
      moving: c.moving,
    });
  }
  for (const c of clients.values())
    if (
      c.socket.readyState === WebSocket.OPEN &&
      c.socket.bufferedAmount < 32768
    )
      c.socket.send(
        JSON.stringify({ type: "state", players: rooms.get(c.room) }),
      );
}, 50);
const heartbeat = setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) {
      c.socket.terminate();
      continue;
    }
    c.alive = false;
    c.socket.ping();
  }
}, 15000);
function shutdown() {
  clearInterval(broadcast);
  clearInterval(heartbeat);
  for (const c of clients.values()) c.socket.close();
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
console.log(`Eco Active multiplayer listening on :${port}`);
