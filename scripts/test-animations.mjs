import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const errors = [];
const report = {
  cpu: os.cpus()[0]?.model,
  platform: os.platform(),
  browser: browser.version(),
  viewport: [1440, 900],
  quality: "Auto",
  notes: "Headless desktop Chrome; not a physical phone measurement.",
  states: [],
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${process.env.GAME_TEST_URL || "http://localhost:3000"}/?diagnostics=1&room=animation-qa`,
  );
  await page
    .getByRole("button", { name: "Enter the neighbourhood" })
    .click({ timeout: 90000 });
  await page.waitForFunction(
    () => window.__pcApp?.root.find((n) => n.anim).length > 0,
  );
  // Close front view makes limb/skin problems visible. It is test-only.
  await page.evaluate(() => {
    const app = window.__pcApp;
    const avatar = app.root.find((n) => n.anim)[0];
    const camera = app.root.find((n) => n.camera)[0];
    app.on("framerender", () => {
      const p = avatar.getPosition();
      camera.setPosition(p.x + 0.5, p.y + 1.3, p.z - 3.6);
      camera.lookAt(p.x, p.y + 1, p.z);
    });
  });
  const pose = () =>
    page.evaluate(() => {
      const root = window.__pcApp.root.find((n) => n.anim)[0];
      const layer = root.anim.baseLayer;
      const bones = [
        "Hips",
        "LeftArm",
        "RightArm",
        "LeftUpLeg",
        "RightUpLeg",
        "LeftLeg",
        "RightLeg",
      ].map((name) => {
        const b = root.findByName(name);
        return {
          name,
          rotation: Array.from(b.getLocalRotation().toArray()),
          position: Array.from(b.getPosition().toArray()),
        };
      });
      return {
        state: layer.activeState,
        progress: layer.activeStateCurrentTime,
        bones,
      };
    });
  for (const [state, keys, duration] of [
    ["Idle", [], 1600],
    ["Walk", ["KeyW"], 450],
    ["Run", ["KeyW", "ShiftLeft"], 450],
    ["Jump", ["Space"], 200],
  ]) {
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    const before = await pose();
    assert.equal(before.state, state);
    await page.waitForTimeout(120);
    const after = await pose();
    assert.equal(
      after.state,
      state,
      `${state} must remain stable without unsolicited transitions`,
    );
    assert(
      before.bones.every((b) =>
        [...b.rotation, ...b.position].every(Number.isFinite),
      ),
      "Finite bone transforms",
    );
    assert(
      after.bones.some((b, i) =>
        b.rotation.some(
          (v, j) => Math.abs(v - before.bones[i].rotation[j]) > 0.0001,
        ),
      ),
      `${state} must animate bones`,
    );
    await page.screenshot({
      path: `docs/performance/animation-${state.toLowerCase()}.png`,
    });
    report.states.push({ state, before, after });
    for (const key of keys.toReversed()) await page.keyboard.up(key);
    await page.waitForTimeout(state === "Jump" ? 1000 : 350);
  }
  assert.equal((await pose()).state, "Idle", "Return to idle after landing");
  report.telemetry = JSON.parse(
    await page.locator("canvas.game-canvas").getAttribute("data-telemetry"),
  );
  report.gpu = await page.evaluate(() => {
    const gl = window.__pcApp.graphicsDevice.gl;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  });
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  report.errors = errors;
  await fs.writeFile(
    "docs/performance/animation-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      { ...report, states: report.states.map((s) => s.state) },
      null,
      2,
    ),
  );
  await browser.close();
}
