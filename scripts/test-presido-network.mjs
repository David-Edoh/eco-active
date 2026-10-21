import WebSocket from "ws";
import assert from "node:assert/strict";
const sockets = [];
try {
  const clients = await Promise.all(
    [0, 1, 2, 3].map(
      (character) =>
        new Promise((resolve, reject) => {
          const socket = new WebSocket(
            "ws://localhost:3101/?room=presido-network-qa",
          );
          sockets.push(socket);
          const timeout = setTimeout(
            () => reject(Error("Welcome timeout")),
            5000,
          );
          socket.on("message", (raw) => {
            const data = JSON.parse(raw);
            if (data.type === "welcome") {
              clearTimeout(timeout);
              socket.send(
                JSON.stringify({
                  type: "move",
                  x: 0,
                  y: 0.16,
                  z: 0,
                  yaw: 0,
                  moving: false,
                  character,
                }),
              );
              resolve({ socket, id: data.id, character });
            }
          });
          socket.on("error", reject);
        }),
    ),
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Replication timeout")),
      5000,
    );
    clients[0].socket.on("message", (raw) => {
      const data = JSON.parse(raw);
      if (data.type === "state" && data.players.length === 4) {
        try {
          for (const c of clients) {
            const player = data.players.find((p) => p.id === c.id);
            assert(player);
            assert.equal(
              player.character,
              undefined,
              "Appearance is fixed to Adebayo by the client, not peer-selected",
            );
          }
          clearTimeout(timeout);
          resolve();
        } catch (e) {
          reject(e);
        }
      }
    });
  });
  clients[0].socket.send(
    JSON.stringify({
      type: "move",
      x: 0,
      y: 0.16,
      z: 0,
      yaw: 0,
      moving: false,
      character: 99,
    }),
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("Validation timeout")), 5000);
    clients[1].socket.on("message", (raw) => {
      const data = JSON.parse(raw);
      if (data.type === "state") {
        try {
          assert.equal(
            data.players.find((p) => p.id === clients[0].id)?.character,
            undefined,
          );
          clearTimeout(timeout);
          resolve();
        } catch (e) {
          reject(e);
        }
      }
    });
  });
  console.log(
    "Passed: four movement clients replicated; client appearance hints are not replicated.",
  );
} finally {
  for (const socket of sockets) socket.close();
}
