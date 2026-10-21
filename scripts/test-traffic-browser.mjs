import { chromium, devices } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const report = {
  cpu: os.cpus()[0]?.model,
  platform: os.platform(),
  browser: browser.version(),
  notes:
    "Headless Chrome; mobile is viewport/touch emulation, not physical hardware.",
};
try {
  for (const [name, options] of [
    ["desktop", { viewport: { width: 1440, height: 900 } }],
    [
      "mobile",
      { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } },
    ],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:3000/?diagnostics=1&room=traffic-qa");
    await page
      .getByRole("button", { name: "Enter the neighbourhood" })
      .click({ timeout: 90000 });
    await page.waitForTimeout(3000);
    const button = page.getByRole("button", {
      name: "Toggle performance metrics",
    });
    await button.waitFor();
    assert.match(await button.innerText(), /FPS[\s\S]*DRAW CALLS[\s\S]*MS/);
    const box = await button.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= options.viewport.width);
    const sample = () =>
      page.locator("canvas").evaluate((c) => ({
        stats: JSON.parse(c.dataset.telemetry),
        cars: JSON.parse(c.dataset.traffic),
      }));
    const before = await sample();
    await page.waitForTimeout(6000);
    const after = await sample();
    assert.equal(after.cars.length, 24);
    assert.deepEqual(
      before.cars.map((c) => c.id),
      after.cars.map((c) => c.id),
    );
    assert(
      after.cars.some(
        (c, i) =>
          Math.hypot(c.x - before.cars[i].x, c.z - before.cars[i].z) > 1,
      ),
    );
    assert(after.stats.frameMs > 0 && after.stats.drawCalls > 0);
    await page.screenshot({ path: `docs/performance/traffic-${name}.png` });
    report[name] = {
      viewport: options.viewport,
      quality: "auto",
      gpu: await page.evaluate(() => {
        const gl = document.querySelector("canvas").getContext("webgl2");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : gl?.getParameter(gl.RENDERER);
      }),
      ...after.stats,
      trafficCount: after.cars.length,
      errors,
    };
    assert.equal(errors.length, 0);
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
  await fs.writeFile(
    "docs/performance/traffic-results.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
