/**
 * Packages dist/agent.cjs into a standalone GymDeviceAgent.exe using pkg,
 * then copies better-sqlite3's native module folder next to it — pkg
 * can't embed native .node addons in its snapshot, so that folder must
 * ship alongside the exe (same folder-copy deployment model the spec
 * already assumes: copy the whole agent folder to the gym PC, not a
 * single bare file).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "release");
fs.mkdirSync(outDir, { recursive: true });

console.log("Packaging with pkg (target: node18-win-x64)...");
const exeOut = path.join(outDir, "GymDeviceAgent.exe");
execSync(`npx @yao-pkg/pkg dist/agent.cjs --targets node18-win-x64 --output "${exeOut}"`, {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

console.log("Copying better-sqlite3 native module alongside the exe...");
const src = path.join(root, "node_modules", "better-sqlite3");
const dest = path.join(outDir, "node_modules", "better-sqlite3");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });

console.log("Copying batch launchers...");
for (const file of ["Start-Gym-Agent.bat", "install-agent.bat"]) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}

console.log(`\nDone. Deploy the whole "${outDir}" folder to the gym PC.`);
