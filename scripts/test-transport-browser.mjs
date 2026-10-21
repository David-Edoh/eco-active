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
    "Headless Chrome; exact renderer recorded per view. Mobile is viewport/touch emulation, not a physical phone benchmark.",
  views: [],
};
const errors = [];
const outputPrefix = process.argv.includes("--black-windows")
  ? "transport-black-windows"
  : "transport";
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
      `${process.env.GAME_TEST_URL || "http://127.0.0.1:3100"}/?diagnostics=1&room=transport-qa`,
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
        JSON.parse(
          document.querySelector("canvas.game-canvas").dataset.parked || "[]",
        ).length === 12,
    );
    const sample = () =>
      page.locator("canvas.game-canvas").evaluate((c) => ({
        moving: JSON.parse(c.dataset.traffic),
        parked: JSON.parse(c.dataset.parked),
        telemetry: JSON.parse(c.dataset.telemetry),
      }));
    const before = await sample();
    await page.waitForTimeout(5000);
    const after = await sample();
    assert.equal(after.moving.length, 24);
    assert.deepEqual(
      after.parked,
      before.parked,
      "Parked clusters must remain stationary",
    );
    for (const model of ["bus", "keke"]) {
      const vehicles = after.moving.filter((c) => c.model === model);
      assert.equal(vehicles.length, 4);
      assert(
        vehicles.some((c) => {
          const previous = before.moving.find((p) => p.id === c.id);
          return Math.hypot(c.x - previous.x, c.z - previous.z) > 0.1;
        }),
        `${model} must travel along the roads`,
      );
    }
    const resources = await page.evaluate(() => {
      const app = window.__pcApp;
      return ["bus", "keke"].map((model) => {
        const traffic = app.root.findByName(`Instanced traffic ${model}`).render
          .meshInstances[0];
        const parked = app.root
          .find((n) => n.name.startsWith(`${model}:parkedVehicle:`))
          .flatMap((n) => n.render.meshInstances);
        return {
          model,
          trafficCount: traffic.instancingCount,
          sharedGeometry: parked.every((m) => m.mesh === traffic.mesh),
          parkedCount: parked.reduce((n, m) => n + m.instancingCount, 0),
          bounds: traffic.aabb.halfExtents.toArray(),
        };
      });
    });
    assert(
      resources.every(
        (r) =>
          r.sharedGeometry &&
          r.trafficCount > 0 &&
          r.parkedCount > 0 &&
          r.bounds.every((n) => Number.isFinite(n) && n > 0),
      ),
    );
    for (const [name, position, target, follow] of mobile
      ? [["mobile", [-22, 9, 30], [-37, 1, 47], null]]
      : [
          ["parking", [-16, 15, 25], [-38, 0, 46], null],
          ["bus-rank", [-27, 5, 30], [-38, 1, 44], null],
          ["keke-rank", [-40, 6, 62], [-38, 1, 49], null],
          ["moving-bus", null, null, "bus"],
          ["moving-keke", null, null, "keke"],
        ]) {
      await page.evaluate(
        ({ position, target, follow }) => {
          const app = window.__pcApp,
            camera = app.root.findByName("Third-person camera");
          if (window.__transportView) app.off("update", window.__transportView);
          window.__transportView = () => {
            if (follow) {
              const cars = JSON.parse(
                  document.querySelector("canvas.game-canvas").dataset
                    .traffic || "[]",
                ),
                car = cars.find(
                  (c) =>
                    c.model === follow && Math.hypot(c.x + 18, c.z - 24) < 80,
                );
              if (car) {
                const a = (car.yaw * Math.PI) / 180;
                camera.setPosition(
                  car.x + Math.sin(a) * 9 + Math.cos(a) * 3,
                  4,
                  car.z + Math.cos(a) * 9 - Math.sin(a) * 3,
                );
                camera.lookAt(car.x, 1, car.z);
              }
            } else {
              camera.setPosition(...position);
              camera.lookAt(...target);
            }
          };
          app.on("update", window.__transportView);
        },
        { position, target, follow },
      );
      await page.waitForTimeout(1700);
      const data = await sample();
      const gpu = await page.evaluate(() => {
        const gl = window.__pcApp.graphicsDevice.gl,
          ext = gl.getExtension("WEBGL_debug_renderer_info");
        return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
      });
      await page.screenshot({
        path: `docs/performance/${outputPrefix}-${name}.png`,
      });
      report.views.push({
        name,
        viewport,
        quality: mobile ? "Performance" : "Auto",
        gpu,
        resources,
        ...data,
      });
    }
    assert.deepEqual(errors, []);
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
    `docs/performance/${outputPrefix}-results.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        ...report,
        views: report.views.map((v) => ({
          name: v.name,
          telemetry: v.telemetry,
          moving: v.moving.length,
          parked: v.parked.length,
        })),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
