const PROJECT_NAME = "gare-lotti-milanesi";
const APP_NAME = "Simulatore gara TPL lotti 1-4";
const PRODUCTION_BRANCH = "main";
const PRODUCTION_URL = "https://gare-lotti-milanesi.pages.dev";

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function responseBody(env, request) {
  const branch = env.CF_PAGES_BRANCH || null;
  const commit = env.CF_PAGES_COMMIT_SHA || null;
  const runtimeUrl = env.CF_PAGES_URL || new URL(request.url).origin;

  return {
    app: APP_NAME,
    project: PROJECT_NAME,
    environment: branch === PRODUCTION_BRANCH ? "production" : "preview",
    branch,
    commit,
    url: branch === PRODUCTION_BRANCH ? PRODUCTION_URL : runtimeUrl,
    generatedAt: new Date().toISOString(),
  };
}

export function onRequestGet({ env, request }) {
  return new Response(JSON.stringify(responseBody(env, request), null, 2), {
    headers: securityHeaders,
  });
}

export function onRequestHead() {
  return new Response(null, {
    headers: securityHeaders,
  });
}
