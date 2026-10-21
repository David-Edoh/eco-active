import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
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
const report = {
  hardware: os.cpus()[0]?.model,
  platform: os.platform(),
  browser: browser.version(),
  notes:
    "Headless Chrome with software/GPU renderer recorded below; mobile is viewport/touch emulation, not a physical phone benchmark.",
  views: [],
};
const errors = [];
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
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(
      `${process.env.GAME_TEST_URL || "http://127.0.0.1:3100"}/?diagnostics=1&room=vendor-qa`,
    );
    if (mobile)
      await page
        .getByRole("button", { name: "Performance", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Enter the neighbourhood" })
      .click({ timeout: 90000 });
    await page.waitForFunction(
      () =>
        window.__pcApp?.root.find((n) => n.name.includes(":vendor:")).length >
        0,
    );
    for (const [name, position, target] of mobile
      ? [["mobile", [-29, 4.4, 20], [-40, 1, 35]]]
      : [
          ["overview", [-80, 98, -85], [-10, 0, 22]],
          ["church-market", [-38, 5.5, 21], [-36, 1.3, 38]],
          ["east-market", [13, 6, 19], [34, 1, 20]],
          ["quiet-edge", [-84, 5, -18], [-71, 1, -40]],
        ]) {
      await page.evaluate(
        ({ position, target }) => {
          const app = window.__pcApp,
            camera = app.root.findByName("Third-person camera");
          if (window.__vendorView) app.off("update", window.__vendorView);
          window.__vendorView = () => {
            camera.setPosition(...position);
            camera.lookAt(...target);
          };
          app.on("update", window.__vendorView);
        },
        { position, target },
      );
      await page.waitForTimeout(1700);
      const data = await page.evaluate(() => {
        const app = window.__pcApp,
          gl = app.graphicsDevice.gl,
          ext = gl.getExtension("WEBGL_debug_renderer_info");
        const groups = app.root
          .find((n) => n.name.includes(":vendor:"))
          .flatMap(
            (n) =>
              n.render?.meshInstances.map((m) => ({
                name: n.name,
                count: m.instancingCount,
                material: m.material.name,
                texture: !!m.material.diffuseMap,
                halfExtents: m.aabb.halfExtents.toArray(),
              })) || [],
          );
        return {
          telemetry: JSON.parse(
            document.querySelector("canvas.game-canvas").dataset.telemetry,
          ),
          gpu: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
          groups,
        };
      });
      assert(data.groups.length > 0);
      assert(
        data.groups.every(
          (g) =>
            g.count > 0 &&
            g.texture &&
            g.halfExtents.every((v) => Number.isFinite(v) && v > 0),
        ),
        "Valid textured instanced stall bounds",
      );
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `docs/performance/vendors-${name}.png` });
      report.views.push({
        name,
        viewport,
        quality: mobile ? "Performance" : "Auto",
        ...data,
      });
    }
    // Inspect all six actual imported models independently of placement/camera yaw.
    if (!mobile) {
      await page.evaluate(() => {
        const app = window.__pcApp;
        const ids = [
          "pos-umbrella",
          "shop-1",
          "shop-2",
          "shop-3",
          "shop-4",
          "food-vendor",
        ];
        const roots = ids.map((id, i) => {
          const a = app.assets
            .list()
            .find(
              (a) =>
                a.type === "container" &&
                a.file?.url.endsWith(`/vendor-${id}.glb`),
            );
          const root = a.resource.instantiateRenderEntity();
          root.setPosition(i * 5.5, 300, 0);
          root.name = `QA-vendor-${id}`;
          app.root.addChild(root);
          return root;
        });
        app.off("update", window.__vendorView);
        window.__vendorView = () => {
          const c = app.root.findByName("Third-person camera");
          c.setPosition(14, 307, 24);
          c.lookAt(14, 301, 0);
        };
        app.on("update", window.__vendorView);
        window.__vendorGallery = roots;
      });
      await page.waitForTimeout(1300);
      await page.screenshot({ path: "docs/performance/vendors-assets.png" });
    }
    await page.close();
  }
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  process.exitCode = 1;
} finally {
  report.errors = errors;
  await fs.writeFile(
    "docs/performance/vendors-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        ...report,
        views: report.views.map((v) => ({
          name: v.name,
          telemetry: v.telemetry,
          groups: v.groups.length,
        })),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
