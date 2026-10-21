"use client";
import { useGameState } from "@/hooks/useGameState";
export function PerformancePanel() {
  const stats = useGameState((s) => s.stats),
    show = useGameState((s) => s.showPerformance);
  if (!show || !stats) return null;
  return (
    <aside className="performance-panel" aria-label="Live performance">
      <strong>LIVE TELEMETRY</strong>
      {[
        ["Frame time", `${stats.frameMs} ms`],
        ["Draw calls", stats.drawCalls],
        ["Primitives", stats.triangles.toLocaleString()],
        ["Active chunks", stats.chunks],
        ["ECS entities", stats.entities],
        ["Resolution", `${Math.round(stats.resolution * 100)}%`],
      ].map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </aside>
  );
}
