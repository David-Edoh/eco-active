import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const report = {
  hardware: os.cpus()[0]?.model,
  notes:
    "Headless Chrome; record software GPU below. Mobile is emulation, not physical phone performance.",
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
    await page.goto("http://localhost:3000/?diagnostics=1&room=edges-qa");
    if (mobile)
      await page
        .getByRole("button", { name: "Performance", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Enter the neighbourhood" })
      .click({ timeout: 90000 });
    const expectedCells = await page.evaluate(async () => {
      const d = await (await fetch("/assets/world/district.json")).json();
      const ids = new Set(
        d.distant.map((i) => `${Math.floor(i.x / 64)}_${Math.floor(i.z / 64)}`),
      );
      return [...ids].filter((id) => {
        const [x, z] = id.split("_").map(Number);
        return (
          Math.hypot(x * 64 + 32 + 18, z * 64 + 32 - 24) < 386 &&
          !window.__pcApp.root.findByName(`chunk-${id}`)
        );
      }).length;
    });
    await page.waitForFunction(
      (expected) =>
        window.__pcApp.root.children.filter((e) =>
          e.name.startsWith("chunk-distant-"),
        ).length >= expected,
      expectedCells,
      { timeout: 90000 },
    );
    const audit = await page.evaluate(async () => {
      const app = window.__pcApp,
        d = await (await fetch("/assets/world/district.json")).json();
      const missing = [];
      for (const item of d.buildings) {
        if (d.skyline.some((s) => s.id === item.id)) continue;
        const id = `${Math.floor(item.x / 64)}_${Math.floor(item.z / 64)}`;
        const near = app.root.findByName(`chunk-${id}`),
          far = app.root.findByName(`chunk-distant-${id}`);
        if (!near?.enabled && !far?.enabled) missing.push(item.id);
      }
      const gl = app.graphicsDevice.gl,
        e = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        missing,
        gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unavailable",
        distantCells: app.root.children.filter((e) =>
          e.name.startsWith("chunk-distant-"),
        ).length,
        backdrop: d.distant.filter((i) => i.id.startsWith("scenic-")).length,
      };
    });
    assert.deepEqual(
      audit.missing,
      [],
      "Every mapped building needs detail or distant coverage",
    );
    assert(audit.backdrop > 100);
    const angles = mobile
      ? [["mobile-south", [0, 4, 160], [0, 8, 280]]]
      : [
          ["square-north", [-18, 4, 24], [-18, 8, -180]],
          ["north", [0, 4, -160], [0, 10, -280]],
          ["east", [160, 4, 0], [280, 10, 0]],
          ["south", [0, 4, 160], [0, 10, 280]],
          ["west", [-160, 4, 0], [-280, 10, 0]],
        ];
    for (const [name, position, target] of angles) {
      await page.evaluate(
        ({ position, target }) => {
          const a = window.__pcApp,
            c = a.root.findByName("Third-person camera");
          if (window.__edgeView) a.off("update", window.__edgeView);
          window.__edgeView = () => {
            c.setPosition(...position);
            c.lookAt(...target);
          };
          a.on("update", window.__edgeView);
        },
        { position, target },
      );
      await page.waitForTimeout(1200);
      const telemetry = await page
        .locator("canvas.game-canvas")
        .getAttribute("data-telemetry");
      assert(
        JSON.parse(telemetry).forwardCalls > 2,
        `${name}: building draws must survive frustum culling`,
      );
      await page.screenshot({ path: `docs/performance/edges-${name}.png` });
      report.views.push({
        name,
        viewport,
        quality: mobile ? "performance" : "auto",
        ...audit,
        telemetry: JSON.parse(telemetry),
        errors,
      });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  report.passed = true;
} finally {
  await fs.writeFile(
    "docs/performance/edges-results.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
