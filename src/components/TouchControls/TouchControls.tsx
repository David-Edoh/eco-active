"use client";
import { useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import type { InputController } from "@/playcanvas/controllers/InputController";
export function TouchControls({
  getInput,
}: {
  getInput: () => InputController | undefined;
}) {
  const status = useGameState((s) => s.status);
  const stick = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });
  const lastLook = useRef({ x: 0, y: 0 });
  if (status !== "playing") return null;
  function release() {
    const input = getInput();
    if (input) {
      input.moveX = 0;
      input.moveY = 0;
    }
    if (stick.current) stick.current.style.transform = "translate(0,0)";
  }
  return (
    <div className="touch-controls">
      <div
        className="touch-look"
        aria-label="Drag to look around"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          lastLook.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const i = getInput();
          if (i) {
            i.lookX += (e.clientX - lastLook.current.x) * 1.4;
            i.lookY += (e.clientY - lastLook.current.y) * 1.4;
          }
          lastLook.current = { x: e.clientX, y: e.clientY };
        }}
      />
      <div
        className="touch-stick"
        role="application"
        aria-label="Movement joystick"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          origin.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const dx = e.clientX - origin.current.x,
            dy = e.clientY - origin.current.y,
            len = Math.max(38, Math.hypot(dx, dy));
          const i = getInput();
          if (i) {
            i.moveX = dx / len;
            i.moveY = -dy / len;
          }
          if (stick.current)
            stick.current.style.transform = `translate(${(dx / len) * 38}px,${(dy / len) * 38}px)`;
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <div ref={stick} />
      </div>
      <button
        className="touch-run"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const i = getInput();
          if (i) i.sprint = true;
        }}
        onPointerUp={() => {
          const i = getInput();
          if (i) i.sprint = false;
        }}
        onPointerCancel={() => {
          const i = getInput();
          if (i) i.sprint = false;
        }}
      >
        RUN
      </button>
      <button
        className="touch-jump"
        onPointerDown={() => {
          const i = getInput();
          if (i) i.jump = true;
        }}
      >
        ↑<small>JUMP</small>
      </button>
    </div>
  );
}
