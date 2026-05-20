import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const localPort = process.env.SMOKE_PORT ?? "4173";
const externalUrl = process.env.SMOKE_URL;
const baseUrl = externalUrl ?? `http://127.0.0.1:${localPort}`;
const accessClientId = process.env.SMOKE_ACCESS_CLIENT_ID ?? process.env.CF_ACCESS_CLIENT_ID;
const accessClientSecret = process.env.SMOKE_ACCESS_CLIENT_SECRET ?? process.env.CF_ACCESS_CLIENT_SECRET;
const accessHeaders =
  accessClientId && accessClientSecret
    ? {
        "CF-Access-Client-Id": accessClientId,
        "CF-Access-Client-Secret": accessClientSecret,
      }
    : undefined;
const forbiddenTexts = [
  "Leva economica",
  "Step %",
  "Max %",
  "includi ribasso",
  "p.p.",
  "punti percentuali",
  "Budget massimo",
  "budget esterno",
  "Residuo budget",
  "L'eccedenza",
  "non viene riutilizzata",
];

const waitForServer = async (url, timeoutMs = 20000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { headers: accessHeaders });
      if (response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Preview non raggiungibile su ${url}`);
};

const startPreview = async () => {
  if (externalUrl) return undefined;
  const child = spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", localPort, "--strictPort"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.once("exit", (code) => {
    if (code && code !== 0) {
      console.error(output);
    }
  });
  await waitForServer(baseUrl);
  return child;
};

const clickWorkspaceTab = async (page, name) => {
  const tab = page.locator("button.workspace-tab").filter({ hasText: name });
  const count = await tab.count();
  if (count !== 1) throw new Error(`Tab ${name}: attesi 1, trovati ${count}`);
  await tab.click();
};

const verifyPublicRoutes = async (page, suffix) => {
  await page.goto(new URL("/istruzioni/", baseUrl).toString(), { waitUntil: "networkidle" });
  const instructionsText = await page.locator("body").innerText();
  if (!instructionsText.includes("Istruzioni di compilazione")) {
    throw new Error(`${suffix}: rotta /istruzioni/ non caricata`);
  }
};

const verifyImportExportAndComparison = async (page, suffix) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta scenario JSON" }).click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().endsWith(".json")) {
    throw new Error(`${suffix}: nome export JSON inatteso ${download.suggestedFilename()}`);
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "glm-smoke-"));
  try {
    const importName = `Smoke import ${suffix}`;
    const importPath = path.join(tempDir, `${importName.replace(/\s+/g, "-").toLowerCase()}.json`);
    const payload = await page.evaluate((name) => {
      const savedScenarios = JSON.parse(localStorage.getItem("tpl-lotti-1-4-scenarios") || "[]");
      const snapshot = structuredClone(savedScenarios[0]);
      delete snapshot.baseScenarioId;
      delete snapshot.optimization;
      snapshot.id = `smoke-import-${Date.now()}`;
      snapshot.name = name;
      snapshot.schemaVersion = 6;
      snapshot.demoScenarioId = "market";
      snapshot.settings = { threshold: "soglia non valida", applyAwardLimitDerogation: "non valido" };
      delete snapshot.bidders?.[0]?.lots?.L1?.quantityInputs;
      return snapshot;
    }, importName);

    await writeFile(importPath, JSON.stringify(payload, null, 2));
    await page.locator('input[type="file"]').setInputFiles(importPath);
    await page.waitForFunction(
      (name) => document.body.innerText.includes(`Importato: ${name}`),
      importName,
    );

    const noticeText = await page.locator(".scenario-notice").innerText();
    for (const expected of ["Schema aggiornato", "demoScenarioId", "Configurazione Ottimizzazione"]) {
      if (!noticeText.includes(expected)) throw new Error(`${suffix}: import senza dettaglio riparazione ${expected}`);
    }

    await page.locator(".comparison-panel select").selectOption({ label: importName });
    const comparisonText = await page.locator(".comparison-panel").innerText();
    if (!comparisonText.includes(importName) || !comparisonText.includes("Delta per lotto")) {
      throw new Error(`${suffix}: confronto scenari non aggiornato dopo import`);
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
};

const verifyOptimization = async (page, suffix, theme) => {
  await verifyPublicRoutes(page, suffix);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate((themeValue) => {
    localStorage.clear();
    localStorage.setItem("tpl-lotti-1-4-theme", themeValue);
  }, theme);
  await page.reload({ waitUntil: "networkidle" });

  for (const tab of ["Tecnica", "Economica", "Ottimizzazione", "Combinatorie", "Risultati"]) {
    if ((await page.locator("button.workspace-tab").filter({ hasText: tab }).count()) !== 1) {
      throw new Error(`${suffix}: tab ${tab} non trovata`);
    }
  }

  const releasePanelText = await page.locator(".release-panel").innerText();
  if (!releasePanelText.includes("Versione e changelog") || !releasePanelText.includes("Versione app")) {
    throw new Error(`${suffix}: pannello versione non disponibile`);
  }

  await clickWorkspaceTab(page, "Ottimizzazione");
  const text = await page.locator("body").innerText();
  const lowerText = text.toLocaleLowerCase("it-IT");
  const foundForbidden = forbiddenTexts.filter((item) => text.includes(item));
  if (foundForbidden.length) throw new Error(`${suffix}: testi vietati: ${foundForbidden.join(", ")}`);

  for (const expected of [
    "dashboard dove investire",
    "mappa impatto per ambito",
    "tecnica + ribasso",
    "solo tecnica",
    "quantità max",
    "non previsto",
  ]) {
    if (!lowerText.includes(expected)) throw new Error(`${suffix}: manca ${expected}`);
  }

  const impactRows = await page.locator(".impact-row").evaluateAll((rows) => rows.map((row) => ({
    label: row.querySelector("strong")?.textContent?.trim(),
    values: Array.from(row.querySelectorAll("dd")).map((cell) => cell.textContent?.trim() ?? ""),
    detail: row.querySelector("small")?.textContent?.trim() ?? "",
  })));
  if (!impactRows.length) throw new Error(`${suffix}: mappa impatto vuota`);
  const emptyImpactRows = impactRows.filter((row) =>
    row.values.every((value) => value.replace(/[+\s]/g, "") === "0,00")
    || row.detail.toLocaleLowerCase("it-IT").includes("nessuna mossa"));
  if (emptyImpactRows.length) {
    throw new Error(`${suffix}: righe impatto senza effetto visibile: ${JSON.stringify(emptyImpactRows)}`);
  }

  const planText = await page.locator(".optimization-card").filter({ hasText: "Piano consigliato" }).innerText();
  if (planText.includes(" e ne usa ")) throw new Error(`${suffix}: frase di riallocazione ripetitiva nel piano consigliato`);
  const spacingIssues = [/€\S/g, /\.Delta/g, /,\+/g].flatMap((pattern) => planText.match(pattern) ?? []);
  if (spacingIssues.length) throw new Error(`${suffix}: spaziatura sospetta ${spacingIssues.join(", ")}`);

  const baseRows = await page.locator(".lever-table tbody tr").evaluateAll((rows) => rows.map((row) => {
    const cells = Array.from(row.querySelectorAll("td"));
    const id = cells[0]?.querySelector("strong")?.textContent?.trim();
    const baseCell = cells[4];
    return { id, text: baseCell?.textContent?.trim(), inputCount: baseCell?.querySelectorAll("input").length ?? 0 };
  }));
  const nonBase = baseRows.find((row) => row.id === "C.2.2");
  const ratioBase = baseRows.find((row) => row.id === "C.1.2");
  if (!nonBase || nonBase.text !== "non previsto" || nonBase.inputCount !== 0) {
    throw new Error(`${suffix}: cella base non prevista inattesa ${JSON.stringify(nonBase)}`);
  }
  if (!ratioBase || ratioBase.inputCount !== 1) {
    throw new Error(`${suffix}: cella base prevista inattesa ${JSON.stringify(ratioBase)}`);
  }

  const oldWorkspaceEntry = await page.getByRole("button", { name: "Gestisci workspace" }).count();
  if (oldWorkspaceEntry !== 0) throw new Error(`${suffix}: il vecchio passaggio Gestisci workspace è ancora visibile`);

  await page.getByRole("button", { name: "Cambia" }).click();
  const deleteBaseButton = page.getByRole("button", { name: "Elimina scenario base Mercato realistico" });
  if ((await deleteBaseButton.count()) !== 0) throw new Error(`${suffix}: eliminazione scenario base visibile senza Gestisci`);
  await page.getByRole("button", { name: "Gestisci" }).click();
  if ((await deleteBaseButton.count()) !== 1) throw new Error(`${suffix}: eliminazione scenario base non disponibile`);
  await deleteBaseButton.click();
  const hiddenBaseScenarios = await page.evaluate(() => JSON.parse(localStorage.getItem("tpl-lotti-1-4-hidden-base-scenarios") || "[]"));
  if (!Array.isArray(hiddenBaseScenarios) || !hiddenBaseScenarios.includes("market")) {
    throw new Error(`${suffix}: scenario base eliminato non salvato ${JSON.stringify(hiddenBaseScenarios)}`);
  }
  await page.getByRole("button", { name: "Ripristina scenari base" }).click();
  const restoredBaseScenarios = await page.evaluate(() => JSON.parse(localStorage.getItem("tpl-lotti-1-4-hidden-base-scenarios") || "[]"));
  if (!Array.isArray(restoredBaseScenarios) || restoredBaseScenarios.length !== 0) {
    throw new Error(`${suffix}: ripristino scenari base non riuscito ${JSON.stringify(restoredBaseScenarios)}`);
  }

  await page.getByRole("button", { name: "Salva scenario in libreria" }).click();
  const saved = await page.evaluate(() => {
    const scenarios = JSON.parse(localStorage.getItem("tpl-lotti-1-4-scenarios") || "[]");
    const optimization = scenarios[0]?.optimization;
    const lever = optimization?.levers?.L1?.["C.1.2"];
    return {
      count: scenarios.length,
      version: scenarios[0]?.schemaVersion,
      hasEconomic: Boolean(optimization && "economic" in optimization),
      hasStepUnits: Boolean(lever && "stepUnits" in lever),
      hasGranularityUnits: Boolean(lever && "granularityUnits" in lever),
    };
  });
  if (saved.count < 1 || saved.version !== 7 || saved.hasEconomic || saved.hasStepUnits || !saved.hasGranularityUnits) {
    throw new Error(`${suffix}: snapshot inatteso ${JSON.stringify(saved)}`);
  }

  await verifyImportExportAndComparison(page, suffix);

  const activeTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (activeTheme !== theme) throw new Error(`${suffix}: tema atteso ${theme}, trovato ${activeTheme}`);
};

const main = async () => {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  try {
    const checks = [
      { suffix: "desktop-light", viewport: { width: 1440, height: 1000 }, theme: "light" },
      { suffix: "mobile-dark", viewport: { width: 390, height: 844 }, theme: "dark" },
    ];
    for (const check of checks) {
      const page = await browser.newPage({ extraHTTPHeaders: accessHeaders, viewport: check.viewport });
      const messages = [];
      page.on("console", (msg) => {
        if (["error", "warning"].includes(msg.type())) messages.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
      await verifyOptimization(page, check.suffix, check.theme);
      await page.close();
      if (messages.length) throw new Error(`${check.suffix}: console non pulita: ${messages.join(" | ")}`);
      console.log(`smoke ok: ${check.suffix}`);
    }
  } finally {
    await browser.close();
    if (preview) {
      preview.kill("SIGTERM");
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
