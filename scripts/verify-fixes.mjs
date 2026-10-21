import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("http://localhost:3000/?diagnostics=1&room=verify");
  await page.getByRole("button", { name: "Enter the neighbourhood" }).waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "Enter the neighbourhood" }).click();

  // Wait 3s for district and assets to initialize
  await page.waitForTimeout(3000);

  // 1. Verify animations loaded and active
  const animTest = await page.evaluate(async () => {
    const app = window.__pcApp;
    if (!app) return { error: "No __pcApp found on window" };

    const models = app.root.find((node) => node.anim !== undefined);
    if (!models || models.length === 0) return { error: "No entities with anim component found" };

    const animComp = models[0].anim;
    const baseLayer = animComp.baseLayer;
    const initialClip = baseLayer?.activeState;

    return {
      found: true,
      activeState: initialClip,
      layerCount: animComp.layers.length,
      playing: baseLayer?.playing,
    };
  });

  console.log("Animation Test Initial:", JSON.stringify(animTest, null, 2));
  assert.equal(animTest.activeState, "Idle", "Initial state must be Idle");
  assert.equal(animTest.playing, true, "Animation must be actively playing");

  // Press KeyW and verify Walk state
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(600);
  const walkState = await page.evaluate(() => {
    const app = window.__pcApp;
    const models = app.root.find((node) => node.anim !== undefined);
    return models[0].anim.baseLayer.activeState;
  });
  console.log("Animation Test Walking:", walkState);
  assert.equal(walkState, "Walk", "State while walking must be Walk");

  // Press Shift + KeyW and verify Run state
  await page.keyboard.down("ShiftLeft");
  await page.waitForTimeout(600);
  const runState = await page.evaluate(() => {
    const app = window.__pcApp;
    const models = app.root.find((node) => node.anim !== undefined);
    return models[0].anim.baseLayer.activeState;
  });
  console.log("Animation Test Running:", runState);
  assert.equal(runState, "Run", "State while sprinting must be Run");

  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(600);

  // Press Space and verify Jump state
  await page.keyboard.down("Space");
  await page.waitForTimeout(300);
  const jumpState = await page.evaluate(() => {
    const app = window.__pcApp;
    const models = app.root.find((node) => node.anim !== undefined);
    return models[0].anim.baseLayer.activeState;
  });
  console.log("Animation Test Jumping:", jumpState);
  assert.equal(jumpState, "Jump", "State while jumping must be Jump");
  await page.keyboard.up("Space");
  await page.waitForTimeout(1000);

  // 2. Verify mesh visibility during 360 camera rotation
  console.log("Testing 360-degree rotation mesh rendering...");
  for (let angle = 0; angle < 360; angle += 45) {
    await page.mouse.move(720, 450);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(720 + 80, 450);
    await page.mouse.up({ button: "right" });
    await page.waitForTimeout(300);

    const renderStats = JSON.parse(
      await page.locator("canvas.game-canvas").getAttribute("data-telemetry")
    );
    const loadedChunks = JSON.parse(
      await page.locator("canvas.game-canvas").getAttribute("data-chunks")
    );

    assert(renderStats.drawCalls > 50, `Draw calls (${renderStats.drawCalls}) dropped too low at angle ${angle}`);
    assert(renderStats.forwardCalls > 30, `Forward calls (${renderStats.forwardCalls}) dropped too low at angle ${angle}`);
    assert(loadedChunks.length >= 8, `Loaded chunks dropped to ${loadedChunks.length} at angle ${angle}`);
  }
  console.log("Rotation mesh rendering test PASSED! All chunks and meshes rendered continuously.");

  // 3. Verify traffic car motion direction
  console.log("Testing traffic car driving direction...");
  const sampleCarTransforms = () =>
    page.evaluate(() => {
      const app = window.__pcApp;
      const trafficNode = app.root.findByName("Instanced traffic");
      if (!trafficNode || !trafficNode.render) return [];
      const mi = trafficNode.render.meshInstances[0];
      const count = mi.instancingCount;
      const vb = mi.instancingData.vertexBuffer;
      // Read floats from vertex buffer
      const data = new Float32Array(vb.storage);
      const cars = [];
      for (let i = 0; i < count; i++) {
        const offset = i * 16;
        // Mat4 in PlayCanvas is column-major:
        // Position is col 3: [offset+12, offset+13, offset+14]
        // Forward vector (-Z transformed) is -col 2: [-offset+8, -offset+9, -offset+10]
        const px = data[offset + 12];
        const py = data[offset + 13];
        const pz = data[offset + 14];
        const fwdX = -data[offset + 8];
        const fwdZ = -data[offset + 10];
        cars.push({ px, py, pz, fwdX, fwdZ });
      }
      return cars;
    });

  const carT0 = await sampleCarTransforms();
  console.log("Sampled initial cars count:", carT0.length);
  assert(carT0.length > 0, "Traffic cars should be instantiated and visible");

  await page.waitForTimeout(1500);

  const carT1 = await sampleCarTransforms();
  let movingCarsTested = 0;

  for (let i = 0; i < Math.min(carT0.length, carT1.length); i++) {
    const c0 = carT0[i];
    const c1 = carT1[i];
    const dx = c1.px - c0.px;
    const dz = c1.pz - c0.pz;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.1 && dist < 15) {
      movingCarsTested++;
      // Check dot product between movement vector and vehicle's forward vector
      const dot = dx * c0.fwdX + dz * c0.fwdZ;
      console.log(`Car ${i}: moved dist=${dist.toFixed(2)}, dotWithForward=${dot.toFixed(2)}, fwd=[${c0.fwdX.toFixed(2)}, ${c0.fwdZ.toFixed(2)}], move=[${dx.toFixed(2)}, ${dz.toFixed(2)}]`);
      assert(dot > 0, `Car ${i} is driving in reverse! dot=${dot}`);
    }
  }

  assert(movingCarsTested > 0, "At least one traffic car should have moved during sample window");
  console.log(`Traffic test PASSED! ${movingCarsTested} cars verified driving forward.`);

  await page.screenshot({ path: "docs/performance/verify-passed.png" });
  assert.equal(errors.length, 0, `Page errors occurred: ${errors.join(", ")}`);
  console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
} catch (err) {
  console.error("Verification failed:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
