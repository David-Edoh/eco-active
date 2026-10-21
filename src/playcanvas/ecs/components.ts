import type { Entity } from "playcanvas";
export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}
export interface GameEntity {
  id: string;
  player?: true;
  vehicle?: true;
  vehicleModel?: string;
  parked?: true;
  npc?: true;
  vendor?: { stallId: string };
  traffic?: true;
  navigation?: { waypoint: number; progress: number; speed: number };
  position?: Vector3Data;
  velocity?: Vector3Data;
  chunkId?: string;
  render?: Entity;
  yaw?: number;
  moving?: boolean;
  remote?: true;
}
