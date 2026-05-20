export function installCloudflareWebAnalytics(): void {
  const token = import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN?.trim();
  if (!token || typeof document === "undefined") return;

  const existingBeacon = document.querySelector("script[data-cf-beacon]");
  if (existingBeacon) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(script);
}
