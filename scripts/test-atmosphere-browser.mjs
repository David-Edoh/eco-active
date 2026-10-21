import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
const label = process.argv[2] || "after";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const mobile = label.includes("mobile");
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
await page.goto("http://localhost:3000/?diagnostics=1&room=atmosphere-qa");
await page
  .getByRole("button", { name: "Enter the neighbourhood" })
  .click({ timeout: 90000 });
await page.waitForTimeout(4500);
await page.screenshot({ path: `docs/performance/atmosphere-${label}.png` });
const result = await page.evaluate(() => {
  const a = window.__pcApp;
  const gl = a.graphicsDevice.gl;
  const e = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    telemetry: JSON.parse(document.querySelector("canvas").dataset.telemetry),
    gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unavailable",
    sky: !!a.scene.skybox,
    models: a.assets
      .list()
      .filter((a) => a.type === "container")
      .map((a) => a.name),
  };
});
await fs.writeFile(
  `docs/performance/atmosphere-${label}.json`,
  JSON.stringify(
    {
      hardware: os.cpus()[0]?.model,
      viewport,
      quality: "auto",
      notes:
        "Headless Chrome with SwiftShader software rendering. Mobile is viewport/touch emulation, not a physical phone benchmark.",
      ...result,
      errors,
    },
    null,
    2,
  ),
);
console.log(result, errors);
if (label !== "before") {
  assert.equal(result.sky, true);
  for (const model of ["wagon", "sports"])
    assert(result.models.includes(`/assets/models/${model}.glb`));
  assert.equal(errors.length, 0);
}
await browser.close();
if (errors.length) process.exitCode = 1;
