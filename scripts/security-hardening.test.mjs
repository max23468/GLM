import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { cloudflareAccessHeaders, waitForProductionPromotion } from "./cloudflare-deploy-verification.mjs";

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

  it("attende che alias pubblico e API versione espongano il commit atteso", async () => {
    let versionCalls = 0;
    const requestOptions = [];
    const fetchImpl = async (url, options) => {
      requestOptions.push(options);
      if (String(url).endsWith("/api/version")) {
        versionCalls += 1;
        return Response.json({ commit: versionCalls === 1 ? "stale" : "expected" });
      }
      return new Response("ok");
    };

    await expect(waitForProductionPromotion("expected", { attempts: 2, fetchImpl, intervalMs: 0 })).resolves.toMatchObject({
      commit: "expected",
    });
    expect(versionCalls).toBe(2);
    expect(requestOptions.every((options) => options.headers === undefined)).toBe(true);
  });

  it("interrompe ogni richiesta di promozione che non completa", async () => {
    const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });

    await expect(waitForProductionPromotion("expected", {
      attempts: 1,
      fetchImpl,
      requestTimeoutMs: 1,
    })).rejects.toThrow("Alias produzione non promosso");
  });

  it("considera Access disponibile solo con la coppia completa", () => {
    expect(cloudflareAccessHeaders({ SMOKE_ACCESS_CLIENT_ID: "id" })).toBeUndefined();
    expect(cloudflareAccessHeaders({ SMOKE_ACCESS_CLIENT_ID: "id", SMOKE_ACCESS_CLIENT_SECRET: "secret" })).toEqual({
      "CF-Access-Client-Id": "id",
      "CF-Access-Client-Secret": "secret",
    });
  });

  it("usa l'URL immutabile solo con Access e conclude sul target pubblico", () => {
    const deploy = readFileSync("scripts/deploy-cloudflare.mjs", "utf8");

    expect(deploy).toContain("immutableDeploymentUrl && cloudflareAccessHeaders()");
    expect(deploy).toContain("await waitForProductionPromotion(fullCommitSha)");
    expect(deploy).toContain('SMOKE_URL: mode === "production" ? PRODUCTION_URL : verificationUrl');
  });

  it("limita gli header Access all'origine sottoposta a smoke", () => {
    const smoke = readFileSync("scripts/smoke.mjs", "utf8");

    expect(smoke).not.toContain("extraHTTPHeaders");
    expect(smoke).toContain("new URL(request.url()).origin === smokeOrigin");
  });

  it("mantiene LF nei sorgenti VBA legati al package tramite hash", () => {
    const attributes = readFileSync(".gitattributes", "utf8");

    expect(attributes).toContain("excel-vba/src/** text eol=lf");
  });
});
