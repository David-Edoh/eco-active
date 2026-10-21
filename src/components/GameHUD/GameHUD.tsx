"use client";
import { useState } from "react";
import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import { MiniMap } from "@/components/MiniMap/MiniMap";
import { PerformancePanel } from "@/components/PerformancePanel/PerformancePanel";
export function GameHUD() {
  const status = useGameState((s) => s.status),
    stats = useGameState((s) => s.stats),
    setStatus = useGameState((s) => s.setStatus),
    toggle = useGameState((s) => s.togglePerformance);
  const [copied, setCopied] = useState(false);
  const playing = status === "playing";
  return (
    <>
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="Eco Active home">
          eco<span>active</span>
          <i />
        </Link>
        <div className="topbar-right">
          <span
            className={`network-state ${stats?.network === "online" ? "online" : ""}`}
          >
            <i />
            {stats?.network === "online"
              ? `${stats.players} in the neighbourhood`
              : stats?.network === "offline"
                ? "Offline exploration"
                : "Connecting"}
          </span>
          <button
            className="fps-pill"
            onClick={toggle}
            aria-label="Toggle performance metrics"
          >
            <span className="metric">
              {stats?.fps ?? "—"}
              <small>FPS</small>
            </span>
            <span className="metric">
              {stats?.drawCalls ?? "—"}
              <small>DRAW CALLS</small>
            </span>
            <span className="metric">
              {stats?.frameMs.toFixed(1) ?? "—"}
              <small>MS</small>
            </span>
          </button>
          {playing && (
            <button
              className="icon-button"
              aria-label="Pause game"
              onClick={() => setStatus("paused")}
            >
              Ⅱ
            </button>
          )}
        </div>
      </header>
      {playing && (
        <>
          <div className="location-chip">
            <span>YOU ARE IN</span>
            <h2>
              Tinubu Square <i>↗</i>
            </h2>
            <p>Broad Street, Lagos Island</p>
          </div>
          <div className="bottom-left">
            <MiniMap />
            <div className="player-strip">
              <span className="player-avatar">E</span>
              <div>
                <strong>Neighbour</strong>
                <div className="health-bar">
                  <i />
                </div>
              </div>
              <span>100</span>
            </div>
          </div>
          <div className="explore-note">
            <span className="note-icon">↗</span>
            <div>
              <small>THE CITY IS YOURS</small>
              <p>Take a walk around the square.</p>
            </div>
          </div>
          <div className="bottom-controls">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Link copied ✓" : "Invite a friend ↗"}
            </button>
            <span>
              <kbd>ESC</kbd> Menu
            </span>
          </div>
        </>
      )}
      <PerformancePanel />
      <footer className="attribution">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
        <span>·</span>
        <a href="/assets/licenses/credits.txt" target="_blank">
          Asset credits
        </a>
      </footer>
    </>
  );
}
