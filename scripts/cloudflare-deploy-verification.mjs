const PRODUCTION_URL = "https://gare-lotti-milanesi.pages.dev";

export function cloudflareAccessHeaders(env = process.env) {
  const clientId = env.SMOKE_ACCESS_CLIENT_ID ?? env.CF_ACCESS_CLIENT_ID;
  const clientSecret = env.SMOKE_ACCESS_CLIENT_SECRET ?? env.CF_ACCESS_CLIENT_SECRET;
  return clientId && clientSecret
    ? { "CF-Access-Client-Id": clientId, "CF-Access-Client-Secret": clientSecret }
    : undefined;
}

export async function waitForProductionPromotion(
  expectedCommit,
  {
    attempts = 60,
    fetchImpl = fetch,
    intervalMs = 2_000,
    productionUrl = PRODUCTION_URL,
    requestTimeoutMs = 10_000,
  } = {},
) {
  let lastResult = "nessuna risposta";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const headers = cloudflareAccessHeaders();
      const [appResponse, versionResponse] = await Promise.all([
        fetchImpl(productionUrl, { headers, redirect: "follow", signal: AbortSignal.timeout(requestTimeoutMs) }),
        fetchImpl(new URL("/api/version", productionUrl), {
          headers,
          redirect: "follow",
          signal: AbortSignal.timeout(requestTimeoutMs),
        }),
      ]);
      const version = versionResponse.ok ? await versionResponse.json() : {};
      if (appResponse.ok && versionResponse.ok && version.commit === expectedCommit) return version;
      lastResult = `app=${appResponse.status}, version=${versionResponse.status}, commit=${version.commit ?? "n/d"}`;
    } catch (error) {
      lastResult = error instanceof Error ? error.message : String(error);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Alias produzione non promosso al commit ${expectedCommit}: ${lastResult}`);
}
