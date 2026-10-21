"use client";

import { useContext } from "react";
import { useStore } from "zustand";
import { GameContext } from "@/context/GameContext";
import type { UIStore } from "@/stores/uiStore";

// Select only the UI fields needed by the caller to avoid broad subscriptions.
export function useGameState<T>(selector: (state: UIStore) => T): T {
  const store = useContext(GameContext);
  if (store === undefined) {
    throw new Error("useGameState must be used within GameProvider");
  }
  return useStore(store, selector);
}
