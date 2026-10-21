import { createStore } from "zustand/vanilla";
import type { PerformanceSnapshot, Quality } from "@/playcanvas/types";
export type GameStatus = "loading" | "menu" | "playing" | "paused" | "error";
export interface UIState {
  status: GameStatus;
  progress: number;
  loadingMessage: string;
  error: string;
  stats: PerformanceSnapshot | null;
  quality: Quality;
  showPerformance: boolean;
}
export interface UIActions {
  setStatus: (status: GameStatus) => void;
  setProgress: (loadingMessage: string, progress: number) => void;
  setError: (error: string) => void;
  setStats: (stats: PerformanceSnapshot) => void;
  setQuality: (quality: Quality) => void;
  togglePerformance: () => void;
}
export type UIStore = UIState & UIActions;
export function createUIStore() {
  return createStore<UIStore>()((set) => ({
    status: "loading",
    progress: 0,
    loadingMessage: "Preparing your visit",
    error: "",
    stats: null,
    quality: "auto",
    showPerformance: false,
    setStatus: (status) => set({ status }),
    setProgress: (loadingMessage, progress) =>
      set({ loadingMessage, progress }),
    setError: (error) => set({ error, status: "error" }),
    setStats: (stats) => set({ stats }),
    setQuality: (quality) => set({ quality }),
    togglePerformance: () =>
      set((s) => ({ showPerformance: !s.showPerformance })),
  }));
}
