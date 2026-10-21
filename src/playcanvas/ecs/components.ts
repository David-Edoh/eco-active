// Engine-independent data. Add components as their gameplay systems are built.
export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}

export interface GameEntity {
  id: string;
  player?: true;
  vehicle?: true;
  npc?: true;
  traffic?: true;
  position?: Vector3Data;
  velocity?: Vector3Data;
  // Ownership key for future world-streaming unload operations.
  chunkId?: string;
}
