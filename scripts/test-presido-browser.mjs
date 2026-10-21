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
const hideAndSeek = process.argv.includes("--hide-and-seek");
const outputPrefix = hideAndSeek ? "hide-and-seek" : "presido";
const report = {
  cpu: os.cpus()[0]?.model,
  platform: os.platform(),
  browser: browser.version(),
  quality: "Auto",
  viewport: [1440, 900],
  notes:
    "Headless desktop rendering; mobile is viewport/touch emulation, not physical phone data.",
  states: [],
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(
    `${process.env.GAME_TEST_URL || "http://127.0.0.1:3100"}/?diagnostics=1&room=presido-qa`,
  );
  await page
    .getByRole("button", { name: "Enter the neighbourhood" })
    .click({ timeout: 90000 });
  await page.waitForFunction(
    () => window.__pcApp?.root.find((n) => n.anim).length > 1,
  );
  report.roster = await page.evaluate(() =>
    window.__pcApp.root
      .find((n) => n.anim)
      .map(
        (root) => root.find((n) => n.name.startsWith("character-"))[0]?.name,
      ),
  );
  assert.equal(
    report.roster[0],
    "character-adebayo",
    "Local player must be Adebayo",
  );
  assert(
    report.roster.slice(1).every((name) => name !== "character-adebayo"),
    "Adebayo must never spawn as an NPC",
  );
  assert(
    report.roster.includes("character-jarvis"),
    "Jarvis must appear in the NPC roster",
  );
  await page.evaluate((hideAndSeek) => {
    const app = window.__pcApp;

    const player = app.root.find((n) => n.anim)[0];
    const p = player.getPosition().clone();
    const ids = hideAndSeek
      ? ["jarvis", "adebayo"]
      : ["ratel", "peter-obi", "indaboski", "bola-tinubu"];
    const models = ids.map((id, i) => {
      const asset = app.assets
        .list()
        .find(
          (a) =>
            a.type === "container" &&
            a.file?.url.endsWith(`/character-${id}.glb`),
        );
      if (!asset) throw Error(`Missing ${id}`);
      const model = asset.resource.instantiateRenderEntity();
      model.name = `QA-${id}`;
      app.root.addChild(model);
      model.setPosition(p.x + (i - (ids.length - 1) / 2) * 1.35, p.y, p.z);
      model.setEulerAngles(0, 0, 0);
      model.addComponent("anim", { activate: true });
      for (const a of asset.resource.animations)
        model.anim.addAnimationState(
          a.resource.name,
          a.resource,
          1,
          a.resource.name !== "Jump",
        );
      model.anim.baseLayer.transition("Idle", 0);
      return model;
    });
    const camera = app.root.find((n) => n.camera)[0];
    app.on("update", () => {
      player.enabled = false;
      camera.setPosition(
        p.x,
        p.y + 1.4,
        p.z +
          (app.graphicsDevice.width / app.graphicsDevice.height < 1 ? 14 : 6.8),
      );
      camera.lookAt(p.x, p.y + 1, p.z);
    });
    window.__presidoModels = models;
  }, hideAndSeek);
  for (const state of ["Idle", "Walk", "Run", "Jump"]) {
    await page.evaluate((state) => {
      for (const m of window.__presidoModels)
        m.anim.baseLayer.transition(state, 0);
    }, state);
    await page.waitForTimeout(350);
    const pose = () =>
      page.evaluate(() =>
        window.__presidoModels.map((m) => ({
          name: m.name,
          state: m.anim.baseLayer.activeState,
          bones: m
            .find(
              (n) =>
                n.name === "LeftArm" ||
                n.name === "RightLeg" ||
                n.name.startsWith("Hips"),
            )
            .map((n) => [
              ...n.getLocalRotation().toArray(),
              ...n.getLocalPosition().toArray(),
            ]),
        })),
      );
    if (state === "Jump") {
      await page.evaluate(() => {
        for (const m of window.__presidoModels) {
          m.anim.baseLayer.playing = false;
          m.anim.baseLayer.activeStateCurrentTime = 0.6;
        }
      });
    }
    const before = await pose();
    await page.waitForTimeout(120);
    if (state === "Jump") {
      await page.evaluate(() => {
        for (const m of window.__presidoModels)
          m.anim.baseLayer.activeStateCurrentTime = 1.2;
      });
    }
    const after = await pose();
    for (let i = 0; i < before.length; i++) {
      assert.equal(before[i].state, state);
      assert(after[i].bones.flat().every(Number.isFinite));
      assert.notDeepEqual(
        before[i].bones,
        after[i].bones,
        `${state} must animate ${before[i].name}`,
      );
    }
    await page.screenshot({
      path: `docs/performance/${outputPrefix}-${state.toLowerCase()}.png`,
    });
    report.states.push(state);
  }
  report.telemetry = JSON.parse(
    await page.locator("canvas.game-canvas").getAttribute("data-telemetry"),
  );
  report.gpu = await page.evaluate(() => {
    const gl = window.__pcApp.graphicsDevice.gl;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(
    `${process.env.GAME_TEST_URL || "http://127.0.0.1:3100"}/?diagnostics=1&room=presido-mobile-qa`,
  );
  await mobile
    .getByRole("button", { name: "Enter the neighbourhood" })
    .click({ timeout: 90000 });
  await mobile.waitForTimeout(1500);
  await mobile.screenshot({
    path: `docs/performance/${outputPrefix}-mobile.png`,
  });
  report.mobileTelemetry = JSON.parse(
    await mobile.locator("canvas.game-canvas").getAttribute("data-telemetry"),
  );
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  process.exitCode = 1;
} finally {
  report.errors = errors;
  await fs.writeFile(
    `docs/performance/${outputPrefix}-results.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(report);
  await browser.close();
}
