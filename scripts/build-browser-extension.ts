import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";

const outputRoot = path.resolve("dist/browser-extension");
const zipPath = path.resolve("dist/sunday-games-espn-connector.zip");
const staticFiles = [
  "manifest.json",
  "src/popup.css",
  "src/popup.html",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
];
const emittedFiles = [
  "src/contentScript.js",
  "src/cookieSession.js",
  "src/popup.js",
  "src/serviceWorker.js",
  "src/serviceWorkerPolicy.js",
];

rmSync(outputRoot, { force: true, recursive: true });
rmSync(zipPath, { force: true });
const typeScript = path.resolve("node_modules/typescript/bin/tsc");
const compilation = spawnSync(process.execPath, [typeScript, "-p", "browser-extension/tsconfig.json"], {
  stdio: "inherit",
});
if (compilation.status !== 0) throw new Error("Browser extension TypeScript compilation failed.");

for (const relativePath of staticFiles) {
  const source = path.resolve("browser-extension", relativePath);
  const destination = path.join(outputRoot, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, readFileSync(source));
}

const packageFiles = [...staticFiles, ...emittedFiles];
const zippedFiles: Record<string, Uint8Array> = {};
for (const relativePath of packageFiles) {
  zippedFiles[relativePath] = readFileSync(path.join(outputRoot, relativePath));
}
writeFileSync(zipPath, zipSync(zippedFiles, { level: 9 }));

console.log("Built unpacked extension at " + outputRoot);
console.log("Built Chrome Web Store package at " + zipPath);
