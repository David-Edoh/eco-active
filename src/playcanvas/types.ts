export type Quality = "auto" | "high" | "low";
export interface PerformanceSnapshot {
  fps: number;
  frameMs: number;
  drawCalls: number;
  shadowCalls: number;
  forwardCalls: number;
  triangles: number;
  chunks: number;
  entities: number;
  resolution: number;
  players: number;
  network: "connecting" | "online" | "offline";
  x: number;
  z: number;
  heading: number;
}
export interface GameCallbacks {
  onProgress: (message: string, progress: number) => void;
  onReady: () => void;
  onStats: (stats: PerformanceSnapshot) => void;
  onError: (message: string) => void;
}
export interface WorldItem {
  kind:
    | "building"
    | "road"
    | "pavement"
    | "ground"
    | "vegetation"
    | "vendor"
    | "parkedVehicle";
  model: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  sx: number;
  sy: number;
  sz: number;
  profile?: string;
  name?: string;
  heightSource?: string;
  appearanceSource?: string;
  positions?: number[];
  w?: number;
  d?: number;
  height?: number;
  id?: string;
}
export interface District {
  origin: number[];
  bounds: number;
  attribution: string;
  spawn: number[];
  chunks: { id: string; x: number; z: number; url: string }[];
  roads: { name: string; points: number[][]; width: number }[];
  buildings: WorldItem[];
  skyline?: WorldItem[];
  distant?: WorldItem[];
  park: number[][];
  stalls?: WorldItem[];
  parkedVehicles?: WorldItem[];
  vendorAttendants?: { stallId: string; x: number; z: number; yaw: number }[];
}
export interface PlayerSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  moving: boolean;
}
