"use client";

import { createContext, useState, type ReactNode } from "react";
import { createUIStore } from "@/stores/uiStore";

// Context injects the store instance only. Zustand owns all reactive UI state.
export const GameContext = createContext<ReturnType<typeof createUIStore> | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createUIStore);
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>;
}
