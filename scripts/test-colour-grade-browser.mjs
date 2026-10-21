import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
const label = process.argv[2] || "after";
const mobile = label.includes("mobile");
const viewport = mobile
  ? { width: 390, height: 844 }
  : { width: 1440, height: 900 };
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${process.env.GAME_TEST_URL || "http://localhost:3000"}/?diagnostics=1&room=grade-qa`,
  );
  if (mobile)
    await page
      .getByRole("button", { name: "Performance", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Enter the neighbourhood" })
    .click({ timeout: 90000 });
  await page.evaluate(() => {
    const a = window.__pcApp,
      c = a.root.findByName("Third-person camera");
    a.on("update", () => {
      c.setPosition(-3, 7, 30);
      c.lookAt(-7, 1.6, 14.6);
    });
  });
  await page.waitForTimeout(3500);
  const result = await page.evaluate(() => {
    const a = window.__pcApp;
    return {
      composePasses: a.root.findByName("Third-person camera").camera.framePasses
        .length,
      telemetry: JSON.parse(
        document.querySelector("canvas.game-canvas").dataset.telemetry,
      ),
      gpu: a.graphicsDevice.gl.getParameter(
        a.graphicsDevice.gl.getExtension("WEBGL_debug_renderer_info")
          .UNMASKED_RENDERER_WEBGL,
      ),
    };
  });
  assert.equal(result.composePasses, 1);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `docs/performance/colour-grade-${label}.png` });
  await fs.writeFile(
    `docs/performance/colour-grade-${label}.json`,
    JSON.stringify(
      {
        hardware: os.cpus()[0]?.model,
        platform: os.platform(),
        viewport,
        quality: mobile ? "performance" : "auto",
        browser: browser.version(),
        notes:
          "Headless Chrome; single scene observation, not a sustained benchmark. Mobile is viewport/touch emulation, not a physical phone.",
        ...result,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(result);
} finally {
  await browser.close();
}
