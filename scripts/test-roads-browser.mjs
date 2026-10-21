import { chromium, devices } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const report = {
  cpu: os.cpus()[0]?.model,
  platform: os.platform(),
  browser: browser.version(),
  notes:
    "Headless Chrome; mobile emulation is not a physical phone measurement.",
};
try {
  for (const [name, options] of [
    ["desktop", { viewport: { width: 1440, height: 900 } }],
    [
      "mobile",
      { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } },
    ],
  ]) {
    const context = await browser.newContext(options),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("http://localhost:3000/?diagnostics=1&room=roads-qa");
    await page
      .getByRole("button", { name: "Enter the neighbourhood" })
      .click({ timeout: 90000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `docs/performance/roads-${name}.png` });
    const stats = JSON.parse(
      await page.locator("canvas.game-canvas").getAttribute("data-telemetry"),
    );
    report[name] = {
      viewport: options.viewport,
      quality: "auto",
      stats,
      errors,
    };
    assert(stats.drawCalls > 0 && stats.frameMs > 0);
    assert.deepEqual(errors, []);
    if (name === "desktop") {
      await page.evaluate(() => {
        const app = window.__pcApp,
          camera = app.root.findByName("Third-person camera");
        app.scene.fog.type = "none";
        app.on("update", () => {
          camera.setPosition(-20, 155, 25);
          camera.setEulerAngles(-90, 0, 0);
        });
      });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "docs/performance/roads-overhead.png" });
    }
    await context.close();
  }
  report.passed = true;
} finally {
  await fs.writeFile(
    "docs/performance/roads-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
  await browser.close();
}
