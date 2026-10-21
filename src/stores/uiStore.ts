import { createStore } from "zustand/vanilla";

export type GameStatus = "menu" | "loading" | "playing" | "paused" | "error";

export interface UIState {
  status: GameStatus;
  inventoryOpen: boolean;
  settingsOpen: boolean;
}

export interface UIActions {
  setStatus: (status: GameStatus) => void;
  setInventoryOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

export type UIStore = UIState & UIActions;

// One instance per provider; never share mutable state between server requests.
export function createUIStore() {
  return createStore<UIStore>()((set) => ({
    status: "menu",
    inventoryOpen: false,
    settingsOpen: false,
    setStatus: (status) => set({ status }),
    setInventoryOpen: (inventoryOpen) => set({ inventoryOpen }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  }));
}
