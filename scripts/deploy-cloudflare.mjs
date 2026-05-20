#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const PROJECT_NAME = "gare-lotti-milanesi";
const OUTPUT_DIR = "dist";
const PRODUCTION_BRANCH = "main";
const PRODUCTION_URL = "https://gare-lotti-milanesi.pages.dev";

const mode = process.argv[2];
const args = process.argv.slice(3);

const options = {
  allowDirty: false,
  allowNonMain: false,
  branch: null,
  skipBuild: false,
  skipSmoke: false,
};

function fail(message) {
  console.error(`Errore deploy Cloudflare: ${message}`);
  process.exit(1);
}

function printUsage() {
  console.log(`Uso:
  node scripts/deploy-cloudflare.mjs production [--skip-build] [--skip-smoke]
  node scripts/deploy-cloudflare.mjs preview [--branch nome-branch] [--skip-build] [--skip-smoke]

Opzioni:
  --allow-dirty      permette il deploy da worktree non pulito
  --allow-non-main   permette il deploy production fuori da main
  --branch <nome>    branch Pages da usare per una preview
  --skip-build       non esegue npm run build prima del deploy
  --skip-smoke       non esegue npm run smoke sull'URL pubblicato`);
}

for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === "--allow-dirty") {
    options.allowDirty = true;
    continue;
  }
  if (arg === "--allow-non-main") {
    options.allowNonMain = true;
    continue;
  }
  if (arg === "--skip-build") {
    options.skipBuild = true;
    continue;
  }
  if (arg === "--skip-smoke") {
    options.skipSmoke = true;
    continue;
  }
  if (arg === "--branch") {
    options.branch = args[++index];
    continue;
  }
  if (arg.startsWith("--branch=")) {
    options.branch = arg.slice("--branch=".length);
    continue;
  }
  if (arg === "--help" || arg === "-h") {
    printUsage();
    process.exit(0);
  }
  fail(`opzione non riconosciuta: ${arg}`);
}

if (!["production", "preview"].includes(mode)) {
  printUsage();
  fail("specifica production oppure preview.");
}

function run(command, commandArgs, { capture = false, env = process.env } = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) fail(`${command} non eseguibile: ${result.error.message}`);
  if (result.status !== 0) {
    if (capture) {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }
    fail(`${command} ${commandArgs.join(" ")} è terminato con codice ${result.status}.`);
  }

  return capture ? `${result.stdout ?? ""}${result.stderr ?? ""}` : "";
}

function git(commandArgs, fallback = "") {
  const result = spawnSync("git", commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return fallback;
  return result.stdout.trim();
}

function normalizePreviewBranch(value) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63) || "preview";
}

function extractPagesUrls(output) {
  const matches = output.match(/https:\/\/[^\s)]+\.pages\.dev[^\s)]*/g) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;]+$/, "")))];
}

const gitBranch = git(["rev-parse", "--abbrev-ref", "HEAD"], "");
const envBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || process.env.CF_PAGES_BRANCH || "";
const currentBranch = gitBranch && gitBranch !== "HEAD" ? gitBranch : envBranch;
const commitSha = (process.env.GITHUB_SHA || git(["rev-parse", "HEAD"], "")).slice(0, 12) || "n/d";
const status = git(["status", "--short"], "");

if (status && !options.allowDirty) {
  fail("worktree non pulito. Committa o isola le modifiche prima del deploy, oppure usa --allow-dirty consapevolmente.");
}

if (mode === "production" && currentBranch !== PRODUCTION_BRANCH && !options.allowNonMain) {
  fail(`deploy production consentito solo da ${PRODUCTION_BRANCH}. Branch corrente: ${currentBranch || "n/d"}.`);
}

const branch =
  mode === "production"
    ? PRODUCTION_BRANCH
    : normalizePreviewBranch(options.branch || currentBranch || `preview-${commitSha}`);

if (!options.skipBuild) run("npm", ["run", "build"]);

if (!existsSync(OUTPUT_DIR)) fail(`cartella ${OUTPUT_DIR} non trovata. Esegui prima npm run build.`);

const wranglerBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);
if (!existsSync(wranglerBin)) fail("wrangler locale non trovato. Esegui npm install o npm ci.");

const deployOutput = run(
  wranglerBin,
  ["pages", "deploy", OUTPUT_DIR, "--project-name", PROJECT_NAME, "--branch", branch],
  { capture: true },
);
process.stdout.write(deployOutput);

const pagesUrls = extractPagesUrls(deployOutput);
const verificationUrl =
  mode === "production"
    ? PRODUCTION_URL
    : pagesUrls[0] ?? `https://${branch}.${PROJECT_NAME}.pages.dev`;

if (!options.skipSmoke) {
  run("npm", ["run", "smoke"], {
    env: {
      ...process.env,
      SMOKE_URL: verificationUrl,
    },
  });
}

console.log(`\nDeploy Cloudflare Pages completato
Modalità: ${mode === "production" ? "produzione" : "preview"}
Progetto: ${PROJECT_NAME}
Branch Pages: ${branch}
Commit: ${commitSha}
URL verifica: ${verificationUrl}
URL rilevati: ${pagesUrls.length ? pagesUrls.join(", ") : "n/d"}
Smoke: ${options.skipSmoke ? "saltato" : "eseguito"}`);
