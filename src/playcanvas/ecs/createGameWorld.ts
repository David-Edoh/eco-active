import { World } from "miniplex";
import type { GameEntity } from "./components";

// GameBootstrap will own one world per game session. No module-level singleton.
export function createGameWorld() {
  return new World<GameEntity>();
}
