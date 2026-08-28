/**
 * Bundles the agent (src/index.ts + the shared ISAPI module it requires
 * from ../shared) into a single CommonJS file with esbuild. better-sqlite3
 * is a native addon and can't be bundled — it stays an external `require`
 * resolved from node_modules at runtime, which is why package-exe.js
 * copies that folder alongside the packaged .exe.
 */
const esbuild = require("esbuild");
const path = require("path");

esbuild
  .build({
    entryPoints: [path.join(__dirname, "..", "src", "index.ts")],
    outfile: path.join(__dirname, "..", "dist", "agent.cjs"),
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    external: ["better-sqlite3"],
    logLevel: "info",
  })
  .catch(() => process.exit(1));
