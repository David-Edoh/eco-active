"use client";
import { useEffect, useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import type { District } from "@/playcanvas/types";
export function MiniMap() {
  const [map, setMap] = useState<District | null>(null);
  const stats = useGameState((s) => s.stats);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/assets/world/district.json", { signal: abort.signal })
      .then((r) => r.json())
      .then(setMap)
      .catch(() => {});
    return () => abort.abort();
  }, []);
  const x = stats?.x ?? -18,
    z = stats?.z ?? 24;
  return (
    <div className="minimap">
      <div className="map-north">N ↑</div>
      <svg
        viewBox={`${x - 80} ${z - 80} 160 160`}
        aria-label="Local street map"
        role="img"
      >
        <rect x={x - 80} y={z - 80} width="160" height="160" fill="#20362f" />
        {map?.buildings.map((b, i) => (
          <rect
            key={i}
            x={b.x - (b.w ?? 0) / 2}
            y={b.z - (b.d ?? 0) / 2}
            width={b.w}
            height={b.d}
            fill="#3c4c40"
            transform={`rotate(${-b.yaw} ${b.x} ${b.z})`}
          />
        ))}
        {map?.roads.map((r, i) => (
          <path
            key={i}
            d={`M${r.points[0].join(",")}L${r.points[1].join(",")}`}
            stroke="#aaad93"
            strokeWidth={r.width * 0.55}
          />
        ))}
        <polygon
          points={map?.park.map((p) => p.join(",")).join(" ")}
          fill="#6f8d5b"
        />
        <circle cx="-24" cy="-4" r="3" fill="#e8cc77" />
        <circle cx={x} cy={z} r="7" fill="#c4e7c4" opacity=".15" />
        <path
          d={`M${x},${z - 4}l-3,7 3,-1 3,1z`}
          fill="#eff4d6"
          transform={`rotate(${(-(stats?.heading ?? 0) * 180) / Math.PI} ${x} ${z})`}
        />
      </svg>
      <div className="map-label">
        <span className="live-dot" /> LAGOS ISLAND
      </div>
    </div>
  );
}
