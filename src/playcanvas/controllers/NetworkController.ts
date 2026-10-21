import type { PlayerSnapshot } from "../types";
export class NetworkController {
  id = "";
  status: "connecting" | "online" | "offline" = "connecting";
  peers: PlayerSnapshot[] = [];
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private elapsed = 0;
  constructor() {
    this.connect();
  }
  private connect() {
    if (this.disposed) return;
    this.status = "connecting";
    const room = new URLSearchParams(location.search).get("room") || "tinubu";
    const configured = process.env.NEXT_PUBLIC_MULTIPLAYER_URL;
    const base =
      configured ||
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:3001`;
    const url = new URL(base);
    url.searchParams.set("room", room);
    try {
      this.socket = new WebSocket(url);
      this.socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "welcome") {
            this.id = data.id;
            this.status = "online";
          }
          if (data.type === "state" && Array.isArray(data.players))
            this.peers = data.players.filter(
              (p: PlayerSnapshot) => p.id !== this.id,
            );
        } catch {
          /* Ignore malformed transport data. */
        }
      };
      this.socket.onclose = () => {
        this.status = "offline";
        this.peers = [];
        if (!this.disposed) this.retry = setTimeout(() => this.connect(), 3000);
      };
      this.socket.onerror = () => this.socket?.close();
    } catch {
      this.status = "offline";
    }
  }
  update(dt: number, player: Omit<PlayerSnapshot, "id">) {
    this.elapsed += dt;
    if (this.elapsed < 0.05) return;
    this.elapsed = 0;
    if (
      this.socket?.readyState === WebSocket.OPEN &&
      this.socket.bufferedAmount < 4096
    )
      this.socket.send(JSON.stringify({ type: "move", ...player }));
  }
  destroy() {
    this.disposed = true;
    clearTimeout(this.retry);
    this.socket?.close();
    this.peers = [];
  }
}
