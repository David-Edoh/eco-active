import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const report = {
  hardware: os.cpus()[0]?.model,
  notes:
    "Headless Chrome; mobile is viewport/touch emulation, not a physical-phone benchmark.",
  views: [],
};
try {
  for (const mobile of [false, true]) {
    const viewport = mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 };
    const page = await browser.newPage({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("http://localhost:3000/?diagnostics=1&room=tinubu-qa");
    if (mobile)
      await page
        .getByRole("button", { name: "Performance", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Enter the neighbourhood" })
      .click({ timeout: 90000 });
    await page.waitForTimeout(2500);
    for (const [name, position, target] of mobile
      ? [["mobile", [-24, 5, 17], [-24, 3, -4]]]
      : [
          ["front", [-24, 5, 17], [-24, 3, -4]],
          ["reverse", [-24, 6, -23], [-24, 3, -4]],
          ["overhead", [-24, 40, 12], [-24, 0, -8.6]],
        ]) {
      await page.evaluate(
        ({ position, target }) => {
          const app = window.__pcApp,
            c = app.root.findByName("Third-person camera");
          if (window.__tinubuView) app.off("update", window.__tinubuView);
          window.__tinubuView = () => {
            c.setPosition(...position);
            c.lookAt(...target);
          };
          app.on("update", window.__tinubuView);
        },
        { position, target },
      );
      await page.waitForTimeout(1800);
      const data = await page.evaluate(() => {
        const app = window.__pcApp,
          gl = app.graphicsDevice.gl,
          ext = gl.getExtension("WEBGL_debug_renderer_info");
        const monument = app.root.findByName("Tinubu photo reconstruction");
        return {
          telemetry: JSON.parse(
            document.querySelector("canvas.game-canvas").dataset.telemetry,
          ),
          gpu: ext
            ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
            : "unavailable",
          monument: !!monument,
          meshes: monument
            ?.findComponents("render")
            .reduce((n, r) => n + r.meshInstances.length, 0),
        };
      });
      assert(data.monument, "Local monument must be instantiated");
      assert(data.meshes >= 10);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `docs/performance/tinubu-${name}.png` });
      report.views.push({
        name,
        viewport,
        quality: mobile ? "performance" : "auto",
        ...data,
        errors,
      });
    }
    await page.close();
  }
  report.passed = true;
} finally {
  await fs.writeFile(
    "docs/performance/tinubu-results.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
