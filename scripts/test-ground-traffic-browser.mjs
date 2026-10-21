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
    "Headless Chrome with software rendering; mobile is emulated, not physical hardware.",
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
    await page.goto(
      "http://localhost:3000/?diagnostics=1&room=ground-traffic-qa",
    );
    await page
      .getByRole("button", { name: "Enter the neighbourhood" })
      .click({ timeout: 90000 });
    await page.waitForTimeout(3000);
    const audit = await page.evaluate(() => {
      const app = window.__pcApp,
        base = app.root.findByName("Sealed district ground");
      const positions = [],
        indices = [];
      const mesh = base.findComponents("render")[0].meshInstances[0].mesh;
      mesh.getPositions(positions);
      mesh.getIndices(indices);
      const triangles = [];
      for (let i = 0; i < indices.length; i += 3)
        triangles.push(
          indices
            .slice(i, i + 3)
            .map((index) => [positions[index * 3], positions[index * 3 + 2]]),
        );
      const cross = (a, b, p) =>
        (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      const contains = (t, p) => {
        const c = t.map((a, i) => cross(a, t[(i + 1) % 3], p));
        return c.every((v) => v <= 1e-8) || c.every((v) => v >= -1e-8);
      };
      let uncovered = 0,
        samples = 0;
      for (let x = -180; x <= 180; x++)
        for (let z = -180; z <= 180; z++) {
          samples++;
          if (!triangles.some((t) => contains(t, [x, z]))) uncovered++;
        }
      const materialAudit = app.root
        .findComponents("render")
        .flatMap((r) => r.meshInstances)
        .filter((mi) =>
          ["road", "ground", "pavement"].includes(mi.material?.name),
        )
        .map((mi) => ({
          name: mi.material.name,
          sky: mi.material.useSkybox,
          metalness: mi.material.metalness,
          specularity: mi.material.specularityFactor,
        }));
      const cars = JSON.parse(document.querySelector("canvas").dataset.traffic);
      const batches = ["sedan", "wagon", "sports"].map((name, batch) => {
        const entity = app.root.findByName(`Instanced traffic ${name}`),
          mi = entity.render.meshInstances[0];
        const data = new Float32Array(mi.instancingData.vertexBuffer.lock());
        const sign = name === "sedan" ? -1 : 1;
        const dots = [];
        for (let i = 0; i < mi.instancingCount; i++) {
          const x = data[i * 16 + 12],
            z = data[i * 16 + 14];
          const car = cars
            .filter((c) => c.id.startsWith(`traffic-${batch}-`))
            .sort(
              (a, b) =>
                Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z),
            )[0];
          if (car?.yaw !== undefined) {
            const yaw = (car.yaw * Math.PI) / 180;
            dots.push(
              sign *
                (data[i * 16 + 8] * Math.sin(yaw) +
                  data[i * 16 + 10] * Math.cos(yaw)),
            );
          }
        }
        return { name, count: mi.instancingCount, dots };
      });
      const gl = app.graphicsDevice.gl,
        e = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        samples,
        uncovered,
        upward: triangles.every((t) => cross(t[0], t[1], t[2]) < 0),
        materialAudit,
        batches,
        carCount: cars.length,
        stats: JSON.parse(document.querySelector("canvas").dataset.telemetry),
        gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unavailable",
      };
    });
    assert.equal(audit.uncovered, 0);
    assert(audit.upward);
    assert.equal(audit.carCount, 24);
    assert(audit.materialAudit.length > 0);
    assert(
      audit.materialAudit.every(
        (m) => !m.sky && m.metalness === 0 && m.specularity === 0,
      ),
    );
    for (const b of audit.batches) {
      assert(
        b.dots.every((d) => d > 0.9),
        `${b.name} faces its direction of travel`,
      );
    }
    await page.screenshot({
      path: `docs/performance/ground-fixes-${mobile ? "mobile" : "desktop"}.png`,
    });
    if (!mobile) {
      await page.evaluate(() => {
        const app = window.__pcApp,
          camera = app.root.findByName("Third-person camera");
        app.scene.fog.type = "none";
        app.on("update", () => {
          camera.setPosition(0, 175, 0);
          camera.setEulerAngles(-90, 0, 0);
        });
      });
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: "docs/performance/ground-fixes-overhead.png",
      });
      // Hide all streamed chunks: the base must still render a fully sealed floor.
      await page.evaluate(() => {
        const a = window.__pcApp;
        for (const e of a.root.children)
          if (e.name.startsWith("chunk-")) e.enabled = false;
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: "docs/performance/ground-fixes-base.png" });
    }
    assert.deepEqual(errors, []);
    report.views.push({ viewport, mobile, ...audit, errors });
    await page.close();
  }
  report.passed = true;
} finally {
  await fs.writeFile(
    "docs/performance/ground-fixes-results.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
