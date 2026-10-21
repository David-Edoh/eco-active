import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 700 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${process.env.GAME_TEST_URL || "http://localhost:3000"}/?diagnostics=1&room=turns-qa`,
  );
  await page.getByRole("button", { name: "Performance", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter the neighbourhood" })
    .click({ timeout: 90000 });
  const turns = await page.evaluate(() => {
    const app = window.__pcApp;
    const batches = app.root.find((n) =>
      n.name.startsWith("Instanced traffic "),
    );
    const previous = new Map();
    let comparisons = 0,
      turningFrames = 0,
      maxStep = 0,
      maxPositionStep = 0;
    // Deterministic simulation steps exercise the actual GPU instance transforms;
    // this is not a real-time frame-rate benchmark.
    for (let step = 0; step < 2400; step++) {
      app.fire("update", 1 / 60);
      for (const batch of batches) {
        const mi = batch.render.meshInstances[0];
        const storage = mi.instancingData.vertexBuffer.storage;
        const data = ArrayBuffer.isView(storage)
          ? new Float32Array(
              storage.buffer,
              storage.byteOffset,
              storage.byteLength / 4,
            )
          : new Float32Array(storage);
        for (let i = 0; i < mi.instancingCount; i++) {
          const offset = i * 16;
          const pose = {
            x: data[offset + 12],
            z: data[offset + 14],
            yaw:
              (Math.atan2(data[offset + 8], data[offset + 10]) * 180) / Math.PI,
          };
          const key = `${batch.name}:${i}`,
            last = previous.get(key);
          if (last) {
            const moved = Math.hypot(pose.x - last.x, pose.z - last.z);
            // Skip slots repacked when a different car enters/leaves the render radius.
            if (moved < 0.2) {
              const delta = Math.abs(((pose.yaw - last.yaw + 540) % 360) - 180);
              maxStep = Math.max(maxStep, delta);
              maxPositionStep = Math.max(maxPositionStep, moved);
              comparisons++;
              if (delta > 0.05) turningFrames++;
            }
          }
          previous.set(key, pose);
        }
      }
    }
    const gl = app.graphicsDevice.gl,
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    const camera = app.root.findByName("Third-person camera");
    const visibleBatch = batches.find(
      (batch) => batch.render.meshInstances[0].instancingCount > 0,
    );
    app.on("update", () => {
      const buffer =
        visibleBatch.render.meshInstances[0].instancingData.vertexBuffer
          .storage;
      const matrices = ArrayBuffer.isView(buffer)
        ? new Float32Array(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength / 4,
          )
        : new Float32Array(buffer);
      const x = matrices[12],
        z = matrices[14];
      camera.setPosition(x + 7, 5, z + 9);
      camera.lookAt(x, 0.8, z);
    });
    return {
      comparisons,
      turningFrames,
      maxStep,
      maxPositionStep,
      gpu: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    };
  });
  assert(turns.turningFrames > 100, "Must exercise actual vehicle turns");
  assert(turns.maxStep < 15, "Rendered car heading must not snap at waypoints");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "docs/performance/traffic-turns.png" });
  const telemetry = JSON.parse(
    await page.locator("canvas.game-canvas").getAttribute("data-telemetry"),
  );
  assert.deepEqual(errors, []);
  const result = {
    hardware: os.cpus()[0]?.model,
    viewport: { width: 1000, height: 700 },
    quality: "performance",
    browser: browser.version(),
    notes:
      "Headless Chrome. 2400 deterministic 1/60-second simulation updates exercise instance transforms; telemetry is a separate software-rendered observation, not a native GPU benchmark.",
    ...turns,
    telemetry,
    errors,
  };
  await fs.writeFile(
    "docs/performance/traffic-turns-results.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(result);
} finally {
  await browser.close();
}
