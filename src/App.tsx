"use client";
import { useContext, useEffect, useRef } from "react";
import { GameProvider, GameContext } from "@/context/GameContext";
import { MainMenu } from "@/components/MainMenu/MainMenu";
import { GameHUD } from "@/components/GameHUD/GameHUD";
import { TouchControls } from "@/components/TouchControls/TouchControls";
import type { GameBootstrap } from "@/playcanvas/GameBootstrap";
function Game() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<GameBootstrap | null>(null);
  const store = useContext(GameContext)!;
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void import("@/playcanvas/GameBootstrap")
      .then(async ({ GameBootstrap }) => {
        if (cancelled || !canvas.current) return;
        try {
          const game = new GameBootstrap(
            canvas.current,
            {
              onProgress: (m, p) => store.getState().setProgress(m, p),
              onReady: () => { engine.current?.setQuality(store.getState().quality); store.getState().setStatus("menu"); },
              onStats: (s) => store.getState().setStats(s),
              onError: (e) => store.getState().setError(e),
            },
            () => {
              const s = store.getState();
              if (s.status === "playing") s.setStatus("paused");
              else if (s.status === "paused") s.setStatus("playing");
            },
          );
          engine.current = game;
          unsubscribe = store.subscribe((s, previous) => {
            if (s.status !== previous.status)
              game.setActive(s.status === "playing");
            if (s.quality !== previous.quality) game.setQuality(s.quality);
          });
          await game.init();
        } catch (e) {
          if (!cancelled)
            store
              .getState()
              .setError(
                e instanceof Error ? e.message : "WebGL could not initialize",
              );
        }
      })
      .catch((e) => {
        if (!cancelled) store.getState().setError(String(e));
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
      engine.current?.destroy();
      engine.current = null;
    };
  }, [store]);
  return (
    <main className="game-shell">
      <canvas
        ref={canvas}
        aria-label="Eco Active third-person game"
        className="game-canvas"
      />
      <GameHUD />
      <MainMenu />
      <TouchControls getInput={() => engine.current?.input} />
    </main>
  );
}
export default function App() {
  return (
    <GameProvider>
      <Game />
    </GameProvider>
  );
}
