import { accessSync, constants } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const wranglerBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");

const checks = [];

const check = (label, ok, detail) => {
  checks.push({ label, ok, detail });
};

const hasEnv = (name) => Boolean(process.env[name]);

try {
  accessSync(wranglerBin, constants.X_OK);
  const result = spawnSync(wranglerBin, ["--version"], { encoding: "utf8" });
  check("Wrangler locale", result.status === 0, result.stdout.trim() || result.stderr.trim() || wranglerBin);
} catch {
  check("Wrangler locale", false, "Esegui npm install prima del deploy.");
}

const cloudflareEnvReady = hasEnv("CLOUDFLARE_ACCOUNT_ID") && hasEnv("CLOUDFLARE_API_TOKEN");
const whoami = spawnSync(wranglerBin, ["whoami"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const wranglerLoginReady = whoami.status === 0;

check(
  "Credenziali Cloudflare",
  cloudflareEnvReady || wranglerLoginReady,
  cloudflareEnvReady
    ? "variabili CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN presenti"
    : wranglerLoginReady
      ? "login Wrangler locale valido"
      : "mancano variabili Cloudflare e login Wrangler locale",
);

const accessId = hasEnv("CF_ACCESS_CLIENT_ID") || hasEnv("SMOKE_ACCESS_CLIENT_ID");
const accessSecret = hasEnv("CF_ACCESS_CLIENT_SECRET") || hasEnv("SMOKE_ACCESS_CLIENT_SECRET");
check(
  "Service token Access per smoke preview",
  accessId === accessSecret,
  accessId && accessSecret
    ? "coppia presente"
    : accessId || accessSecret
      ? "coppia incompleta: imposta entrambi i valori"
      : "non configurato, serve solo per preview protette",
);

console.log("Diagnosi deploy Cloudflare Pages");
for (const item of checks) {
  console.log(`${item.ok ? "OK" : "ATTENZIONE"} ${item.label}: ${item.detail}`);
}

const blockers = checks.filter((item) => !item.ok && item.label !== "Service token Access per smoke preview");
if (blockers.length) {
  console.log("\nAmbiente non pronto per pubblicare da questa shell.");
  process.exitCode = 1;
} else {
  console.log("\nAmbiente pronto per i comandi di deploy che richiedono credenziali Cloudflare.");
}
