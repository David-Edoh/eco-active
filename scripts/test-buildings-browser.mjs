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
  quality: "auto",
  notes:
    "Headless Chrome. GPU identity recorded below. Mobile viewport/touch emulation is not a physical phone measurement.",
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
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("http://localhost:3000/?diagnostics=1&room=buildings-qa");
    await page
      .getByRole("button", { name: "Enter the neighbourhood" })
      .click({ timeout: 90000 });
    await page.waitForTimeout(3000);
    const audit = await page.evaluate(() => {
      const app = window.__pcApp,
        camera = app.root.findByName("Third-person camera");
      const materials = [
        ...new Set(
          app.root
            .findComponents("render")
            .flatMap((r) => r.meshInstances.map((mi) => mi.material?.name))
            .filter((n) => n?.startsWith("building:")),
        ),
      ];
      const gl = app.graphicsDevice.gl,
        e = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        models: app.assets
          .list()
          .filter((a) => a.type === "container")
          .map((a) => a.name),
        materials,
        skyline: !!app.root.findByName("chunk-skyline"),
        farClip: camera.camera.farClip,
        stats: JSON.parse(document.querySelector("canvas").dataset.telemetry),
        gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unavailable",
      };
    });
    assert(audit.skyline);
    assert.equal(audit.farClip, 340);
    for (const model of [
      "building-1",
      "building-2",
      "building-3",
      "building-low-1",
      "building-low-2",
      "building-low-3",
      "building-low-4",
      "tinubu-trinity",
      "cbn-lagos",
    ])
      assert(audit.models.includes(`/assets/models/${model}.glb`));
    assert(new Set(audit.materials.map((m) => m.split(":")[1])).size >= 5);
    await page.screenshot({
      path: `docs/performance/buildings-${mobile ? "mobile" : "desktop"}.png`,
    });
    const angles = mobile
      ? [["church-mobile", [2, 8, 22], [17, 10, 65]]]
      : [
          ["church", [2, 8, 22], [17, 10, 65]],
          ["skyline", [20, 15, 0], [-160, 47, 53]],
          ["cbn-close", [-140, 25, 20], [-203, 53, 50]],
          ["market", [-40, 8, -5], [20, 8, -50]],
          ["overhead", [-20, 240, 20], [-20, 0, 20]],
        ];
    for (const [name, position, target] of angles) {
      await page.evaluate(
        ({ position, target }) => {
          const a = window.__pcApp,
            c = a.root.findByName("Third-person camera");
          if (window.__buildingView) a.off("update", window.__buildingView);
          window.__buildingView = () => {
            c.setPosition(...position);
            if (position[0] === target[0] && position[2] === target[2])
              c.setEulerAngles(-90, 0, 0);
            else c.lookAt(...target);
          };
          a.on("update", window.__buildingView);
        },
        { position, target },
      );
      await page.waitForTimeout(600);
      await page.screenshot({ path: `docs/performance/buildings-${name}.png` });
    }
    assert.deepEqual(errors, []);
    report.views.push({ viewport, mobile, ...audit, errors });
    await page.close();
  }
  report.passed = true;
} finally {
  await fs.writeFile(
    "docs/performance/buildings-results.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(
  report.views.map((v) => ({
    viewport: v.viewport,
    frameMs: v.stats.frameMs,
    drawCalls: v.stats.drawCalls,
    errors: v.errors,
  })),
  report.passed,
);
