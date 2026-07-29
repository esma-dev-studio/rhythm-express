import { cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const stagingDir = join(tmpdir(), "rhythm-express-pages-build");
const outputDir = join(projectRoot, "dist-pages");
const viteBin = join(projectRoot, "node_modules", "vite", "bin", "vite.js");

rmSync(stagingDir, { recursive: true, force: true });

const buildResult = spawnSync(
  process.execPath,
  [viteBin, "build", "--config", join(projectRoot, "vite.pages.config.ts"), "--outDir", stagingDir, "--emptyOutDir"],
  { cwd: projectRoot, stdio: "inherit" },
);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (process.platform === "win32") {
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `if (Test-Path -LiteralPath ${quote(outputDir)}) { Remove-Item -LiteralPath ${quote(outputDir)} -Recurse -Force }`,
    `New-Item -ItemType Directory -Path ${quote(outputDir)} -Force | Out-Null`,
    `Get-ChildItem -LiteralPath ${quote(stagingDir)} -Force | Copy-Item -Destination ${quote(outputDir)} -Recurse -Force`,
  ].join("; ");
  const copyResult = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { stdio: "inherit" });
  if (copyResult.status !== 0) process.exit(copyResult.status ?? 1);
} else {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  cpSync(stagingDir, outputDir, { recursive: true });
}

rmSync(stagingDir, { recursive: true, force: true });
console.log(`GitHub Pages bundle copied to ${outputDir}`);