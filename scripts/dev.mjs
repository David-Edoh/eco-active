import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["src/server/multiplayer.mjs"], { stdio: "inherit" }),
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      process.argv.includes("--production") ? "start" : "dev",
      "--hostname",
      "0.0.0.0",
    ],
    { stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((c) => c.kill("SIGTERM"));
  setTimeout(() => process.exit(code), 300).unref();
}
children.forEach((c) => {
  c.on("exit", (code) => stop(code ?? 0));
  c.on("error", () => stop(1));
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
