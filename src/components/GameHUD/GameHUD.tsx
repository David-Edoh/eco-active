"use client";

import { useGameState } from "@/hooks/useGameState";

export function GameHUD() {
  const status = useGameState((state) => state.status);
  if (status !== "playing") return null;
  return <aside aria-label="Game HUD">Eco Active</aside>;
}
