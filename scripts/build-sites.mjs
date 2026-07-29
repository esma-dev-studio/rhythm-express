import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const stagingDir = join(
  tmpdir(),
  "rhythm-express-sites-build-" + process.pid,
);
const outputDir = join(projectRoot, "dist");
const stagedOutputDir = join(stagingDir, "dist");
const nodeModulesLink = join(stagingDir, "node_modules");
const vinextBin = join(
  nodeModulesLink,
  "vinext",
  "dist",
  "cli.js",
);

const sourceEntries = [
  ".openai",
  "app",
  "build",
  "drizzle",
  "public",
  "src",
  "worker",
  "next.config.ts",
  "package.json",
  "postcss.config.mjs",
  "tsconfig.json",
  "vite.config.ts",
];

function copySources() {
  if (process.platform === "win32") {
    const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
    const commands = ["$ErrorActionPreference = 'Stop'"];

    for (const entry of sourceEntries) {
      const source = join(projectRoot, entry);
      const destination = join(stagingDir, basename(entry));
      commands.push(
        "if (Test-Path -LiteralPath " +
          quote(source) +
          ") { Copy-Item -LiteralPath " +
          quote(source) +
          " -Destination " +
          quote(destination) +
          " -Recurse -Force }",
      );
    }

    return spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", commands.join("; ")],
      { stdio: "inherit" },
    );
  }

  for (const entry of sourceEntries) {
    const source = join(projectRoot, entry);
    if (!existsSync(source)) continue;
    cpSync(source, join(stagingDir, basename(entry)), { recursive: true });
  }
  return { status: 0 };
}

function cleanupStaging() {
  if (existsSync(nodeModulesLink)) {
    try {
      unlinkSync(nodeModulesLink);
    } catch {
      rmSync(nodeModulesLink, { recursive: true, force: true });
    }
  }
  rmSync(stagingDir, { recursive: true, force: true });
}

function copyBuildOutput() {
  if (process.platform === "win32") {
    const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
    const command = [
      "$ErrorActionPreference = 'Stop'",
      "if (Test-Path -LiteralPath " +
        quote(outputDir) +
        ") { Remove-Item -LiteralPath " +
        quote(outputDir) +
        " -Recurse -Force }",
      "New-Item -ItemType Directory -Path " +
        quote(outputDir) +
        " -Force | Out-Null",
      "Get-ChildItem -LiteralPath " +
        quote(stagedOutputDir) +
        " -Force | Copy-Item -Destination " +
        quote(outputDir) +
        " -Recurse -Force",
    ].join("; ");
    return spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", command],
      { stdio: "inherit" },
    );
  }

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  cpSync(stagedOutputDir, outputDir, { recursive: true });
  return { status: 0 };
}

cleanupStaging();
mkdirSync(stagingDir, { recursive: true });

const sourceCopyResult = copySources();
if (sourceCopyResult.error || sourceCopyResult.status !== 0) {
  cleanupStaging();
  console.error("Could not copy source files to the ASCII staging path.");
  if (sourceCopyResult.error) console.error(sourceCopyResult.error);
  process.exit(sourceCopyResult.status ?? 1);
}

symlinkSync(
  join(projectRoot, "node_modules"),
  nodeModulesLink,
  process.platform === "win32" ? "junction" : "dir",
);

const buildResult = spawnSync(process.execPath, [vinextBin, "build"], {
  cwd: stagingDir,
  env: process.env,
  stdio: "inherit",
});

if (buildResult.error || buildResult.status !== 0) {
  cleanupStaging();
  console.error(
    "Vinext build failed (status: " +
      String(buildResult.status) +
      ", signal: " +
      String(buildResult.signal) +
      ").",
  );
  if (buildResult.error) console.error(buildResult.error);
  process.exit(buildResult.status ?? 1);
}

if (!existsSync(stagedOutputDir)) {
  cleanupStaging();
  throw new Error("Sites build completed without creating dist.");
}

const copyResult = copyBuildOutput();
cleanupStaging();

if (copyResult.error || copyResult.status !== 0) {
  if (copyResult.error) console.error(copyResult.error);
  process.exit(copyResult.status ?? 1);
}

console.log("Sites bundle copied to " + outputDir);
