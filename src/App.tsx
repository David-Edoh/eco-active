"use client";

import { GameHUD } from "@/components/GameHUD/GameHUD";
import { MainMenu } from "@/components/MainMenu/MainMenu";
import { GameProvider } from "@/context/GameContext";

export default function App() {
  return (
    <GameProvider>
      <main className="relative flex min-h-screen items-center justify-center p-8">
        {/* GameBootstrap will attach to this canvas after client mount. */}
        <canvas aria-label="Eco Active game viewport" className="absolute inset-0 h-full w-full" />
        <div className="relative z-10"><MainMenu /><GameHUD /></div>
      </main>
    </GameProvider>
  );
}
