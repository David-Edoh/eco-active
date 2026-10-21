import { chromium, devices } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import os from "node:os";
const base = process.env.GAME_TEST_URL || "http://localhost:3000";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const errors = [],
  failedRequests = [];
const reports = {
  testedAt: new Date().toISOString(),
  browser: browser.version(),
  platform: os.platform(),
  cpu: os.cpus()[0]?.model,
  notes:
    "Headless Chrome on this host. Mobile viewport/touch emulation is not a physical-phone benchmark.",
};
await fs.mkdir("docs/performance", { recursive: true });
function observe(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon"))
      failedRequests.push(`${r.status()} ${r.url()}`);
  });
}
async function stats(page) {
  return JSON.parse(
    await page.locator("canvas.game-canvas").getAttribute("data-telemetry"),
  );
}
async function open(context, room = "qa") {
  const page = await context.newPage();
  observe(page);
  await page.goto(`${base}/?diagnostics=1&room=${room}`);
  await page
    .getByRole("button", { name: "Enter the neighbourhood" })
    .waitFor({ timeout: 90000 });
  return page;
}
async function sample(page, label) {
  await page.waitForTimeout(3000);
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let previous = performance.now();
        function tick(now) {
          times.push(now - previous);
          previous = now;
          if (times.length < 300) requestAnimationFrame(tick);
          else resolve(times.slice(5));
        }
        requestAnimationFrame(tick);
      }),
  );
  const ordered = [...frames].sort((a, b) => a - b);
  return {
    label,
    ...(await stats(page)),
    rafMeanMs: frames.reduce((a, b) => a + b, 0) / frames.length,
    rafP95Ms: ordered[Math.floor(ordered.length * 0.95)],
    loadedChunks: JSON.parse(
      await page.locator("canvas.game-canvas").getAttribute("data-chunks"),
    ),
  };
}
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await open(desktop);
  await page.screenshot({ path: "docs/performance/desktop-menu.png" });
  await page.getByRole("button", { name: "Enter the neighbourhood" }).click();
  reports.desktop = await sample(page, "1440 × 900 adaptive");
  await page.screenshot({ path: "docs/performance/desktop-game.png" });
  reports.gpu = await page.evaluate(() => {
    const gl = document
      .querySelector("canvas.game-canvas")
      .getContext("webgl2");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
  });
  const before = await stats(page);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(650);
  const after = await stats(page);
  assert(
    Math.hypot(after.x - before.x, after.z - before.z) > 1,
    "WASD should move the player",
  );
  reports.movement = {
    before: [before.x, before.z],
    after: [after.x, after.z],
  };
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Back to the streets" }).waitFor();
  const paused = await stats(page);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  const pausedAfter = await stats(page);
  assert(
    Math.hypot(pausedAfter.x - paused.x, pausedAfter.z - paused.z) < 0.05,
    "Pause freezes local movement",
  );
  await page.getByRole("button", { name: "Back to the streets" }).click();
  const context2 = await browser.newContext({
    viewport: { width: 1000, height: 700 },
  });
  const peer = await open(context2);
  await peer.getByRole("button", { name: "Enter the neighbourhood" }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector("canvas.game-canvas").dataset.telemetry)
        .players === 2,
    { timeout: 15000 },
  );
  await peer.waitForFunction(
    () =>
      JSON.parse(document.querySelector("canvas.game-canvas").dataset.telemetry)
        .players === 2,
  );
  await peer.keyboard.down("KeyD");
  await peer.waitForTimeout(1500);
  await peer.keyboard.up("KeyD");
  await peer.waitForTimeout(700);
  const peerPosition = await stats(peer);
  const renderedPeers = JSON.parse(
    await page.locator("canvas.game-canvas").getAttribute("data-peers"),
  );
  assert(renderedPeers.length === 1);
  assert(
    Math.hypot(
      renderedPeers[0].x - peerPosition.x,
      renderedPeers[0].z - peerPosition.z,
    ) < 1,
    "Remote avatar must track the other browser",
  );
  reports.multiplayer = {
    players: 2,
    peerPosition: [peerPosition.x, peerPosition.z],
    renderedRemote: [renderedPeers[0].x, renderedPeers[0].z],
  };
  await page.screenshot({ path: "docs/performance/multiplayer.png" });
  await context2.close();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector("canvas.game-canvas").dataset.telemetry)
        .players === 1,
  );
  reports.multiplayer.disconnectPassed = true;
  await desktop.close();
  const mobile = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 412, height: 915 },
  });
  const phone = await open(mobile, "mobile-qa");
  await phone.getByRole("button", { name: "Performance", exact: true }).click();
  await phone.getByRole("button", { name: "Enter the neighbourhood" }).click();
  reports.mobile = await sample(
    phone,
    "412 × 915 mobile emulation / performance",
  );
  await phone.screenshot({ path: "docs/performance/mobile-game.png" });
  const mobileBefore = await stats(phone);
  await phone
    .locator(".touch-stick")
    .dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 85,
      clientY: 795,
      bubbles: true,
    });
  // Use actual touch events through CDP so pointer capture and joystick movement are exercised.
  const cdp = await mobile.newCDPSession(phone);
  const box = await phone.locator(".touch-stick").boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 35, y }],
  });
  await phone.waitForTimeout(1500);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.waitForTimeout(700);
  const mobileAfter = await stats(phone);
  assert(
    Math.hypot(mobileAfter.x - mobileBefore.x, mobileAfter.z - mobileBefore.z) >
      1,
    "Touch joystick should move",
  );
  reports.touch = {
    passed: true,
    before: [mobileBefore.x, mobileBefore.z],
    after: [mobileAfter.x, mobileAfter.z],
  };
  await mobile.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(failedRequests.length, 0, failedRequests.join("\n"));
  reports.passed = true;
} catch (error) {
  reports.passed = false;
  reports.failure = error.stack;
  process.exitCode = 1;
} finally {
  reports.errors = errors;
  reports.failedRequests = failedRequests;
  await fs.writeFile(
    "docs/performance/results.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports, null, 2));
  await browser.close();
}
