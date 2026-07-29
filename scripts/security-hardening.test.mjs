import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("security hardening operativo", () => {
  it("non esegue codice delle pull request con credenziali Cloudflare", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(workflow).not.toContain("deploy-preview:");
    for (const file of readdirSync(".github/workflows").filter((name) => name.endsWith(".yml"))) {
      const uses = readFileSync(`.github/workflows/${file}`, "utf8").match(/^\s*uses:\s+.+$/gm) ?? [];
      expect(uses.every((line) => /@[0-9a-f]{40}(?:\s+#.*)?$/.test(line))).toBe(true);
    }
  });

  it("blocca una preview che normalizza sulla branch di produzione", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/deploy-cloudflare.mjs", "preview", "--branch", "main", "--allow-dirty", "--skip-build", "--skip-smoke"],
      { encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("la branch preview non può coincidere con main");
  });

  it("verifica il deploy sull'URL immutabile restituito da Cloudflare", () => {
    const deploy = readFileSync("scripts/deploy-cloudflare.mjs", "utf8");

    expect(deploy).toContain('pagesUrls[0] ?? (mode === "production" ? PRODUCTION_URL');
  });

  it("limita gli header Access all'origine sottoposta a smoke", () => {
    const smoke = readFileSync("scripts/smoke.mjs", "utf8");

    expect(smoke).not.toContain("extraHTTPHeaders");
    expect(smoke).toContain("new URL(request.url()).origin === smokeOrigin");
  });
});
