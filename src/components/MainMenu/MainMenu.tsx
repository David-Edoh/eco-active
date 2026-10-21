"use client";
import { useGameState } from "@/hooks/useGameState";
import type { Quality } from "@/playcanvas/types";
export function MainMenu() {
  const status = useGameState((s) => s.status),
    progress = useGameState((s) => s.progress),
    message = useGameState((s) => s.loadingMessage),
    error = useGameState((s) => s.error),
    quality = useGameState((s) => s.quality);
  const setStatus = useGameState((s) => s.setStatus),
    setQuality = useGameState((s) => s.setQuality);
  if (status === "playing") return null;
  return (
    <div className="menu-scrim">
      <section className="main-menu" aria-label="Game menu">
        <div className="eyebrow">
          <span className="live-dot" /> A LITTLE PIECE OF LAGOS
        </div>
        <h1>
          Eko for
          <br />
          <em>show.</em>
        </h1>
        <p className="menu-description">
          Find your rhythm in the heart of Lagos Island. Walk the streets. Meet
          your people. Make the city yours.
        </p>
        <div className="district-card">
          <span className="district-number">01</span>
          <div>
            <strong>Tinubu Square</strong>
            <span>BROAD STREET · LAGOS ISLAND</span>
          </div>
          <span className="district-arrow">↗</span>
        </div>
        {status === "loading" ? (
          <div className="loading-state" aria-live="polite">
            <div>
              <span>{message}</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="progress-track">
              <i style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        ) : status === "error" ? (
          <div className="error-state" role="alert">
            <p>{error}</p>
            <button className="enter-button" onClick={() => location.reload()}>
              Try again ↻
            </button>
          </div>
        ) : (
          <button className="enter-button" onClick={() => setStatus("playing")}>
            {status === "paused"
              ? "Back to the streets"
              : "Enter the neighbourhood"}
            <span>→</span>
          </button>
        )}
        <div className="quality-select">
          <span>GRAPHICS</span>
          {(["auto", "high", "low"] as Quality[]).map((q) => (
            <button
              key={q}
              aria-pressed={quality === q}
              onClick={() => setQuality(q)}
            >
              {q === "auto"
                ? "Adaptive"
                : q === "high"
                  ? "High"
                  : "Performance"}
            </button>
          ))}
        </div>
        <div className="menu-controls">
          <span>
            <kbd>W A S D</kbd> Move
          </span>
          <span>
            <kbd>DRAG</kbd> Look
          </span>
          <span>
            <kbd>SHIFT</kbd> Run
          </span>
          <span>
            <kbd>SPACE</kbd> Jump
          </span>
        </div>
      </section>
      <div className="menu-caption">
        <span>6.4538° N &nbsp; 3.3896° E</span>
        <p>
          Ẹ káàbọ̀.
          <br />
          <b>Welcome home.</b>
        </p>
      </div>
    </div>
  );
}
