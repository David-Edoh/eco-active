import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const errors = [];
const outputPrefix = process.argv.includes("--hide-and-seek")
  ? "hide-and-seek"
  : "presido";
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  // Isolate QA networking from the owner's existing development room service.
  await context.addInitScript(() => {
    const Original = window.WebSocket;
    window.WebSocket = class extends Original {
      constructor(url, protocols) {
        const target = new URL(url);
        target.port = "3101";
        super(target.toString(), protocols);
      }
    };
  });
  const pages = await Promise.all(
    [0, 1].map(async () => {
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `${process.env.GAME_TEST_URL || "http://localhost:3000"}/?diagnostics=1&room=presido-browser-qa`,
      );
      await page
        .getByRole("button", { name: "Enter the neighbourhood" })
        .click({ timeout: 90000 });
      return page;
    }),
  );
  for (const page of pages)
    await page.waitForFunction(
      () =>
        JSON.parse(
          document.querySelector("canvas.game-canvas").dataset.peers || "[]",
        ).length === 1,
      {},
      { timeout: 30000 },
    );
  const appearances = await Promise.all(
    pages.map((page) =>
      page.evaluate(() =>
        window.__pcApp.root
          .find((n) => n.anim)
          .filter((n) => {
            const p = n.getPosition();
            return Math.abs(p.x + 18) < 0.2 && Math.abs(p.z - 24) < 0.2;
          })
          .map(
            (n) =>
              n.find((node) => node.name.startsWith("character-"))[0]?.name,
          )
          .sort(),
      ),
    ),
  );
  assert.equal(appearances[0].length, 2);
  assert.deepEqual(appearances[0], appearances[1]);
  assert.deepEqual(appearances[0], ["character-adebayo", "character-adebayo"]);
  await pages[0].screenshot({
    path: `docs/performance/${outputPrefix}-multiplayer.png`,
  });
  const telemetry = await Promise.all(
    pages.map((page) =>
      page
        .locator("canvas.game-canvas")
        .getAttribute("data-telemetry")
        .then(JSON.parse),
    ),
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    `docs/performance/${outputPrefix}-multiplayer-results.json`,
    JSON.stringify(
      {
        passed: true,
        appearances,
        telemetry,
        errors,
        viewport: [1280, 800],
        note: "Two headless Chrome clients on the same host; networking redirected to the isolated updated QA service.",
      },
      null,
      2,
    ),
  );
  console.log(
    "Passed: both browsers see matching local/remote character appearances.",
    appearances,
  );
} finally {
  await browser.close();
}
