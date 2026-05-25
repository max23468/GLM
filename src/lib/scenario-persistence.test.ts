import { describe, expect, it } from "vitest";
import { CRITERIA, LOTS, PAIRS } from "../data/tender";
import { normalizeScenarioSnapshot, normalizeScenarioSnapshotWithReport, normalizeStoredWorkspace } from "./scenario-persistence";
import { simulate } from "./scoring";

describe("scenario persistence normalization", () => {
  it("repairs partial imported bidders before simulation uses them", () => {
    const snapshot = normalizeScenarioSnapshot({
      id: "legacy",
      name: "Legacy",
      demoScenarioId: "market",
      bidders: [
        {
          id: "a",
          name: "Operatore A",
          lots: {
            L1: {
              enabled: true,
              qValues: { "A.1.1": 10 },
              quantityInputs: { "C.1.2": { numerator: 8, denominator: 10 } },
              phaseDiscounts: [5],
            },
          },
        },
      ],
      settings: { threshold: 999, applyAwardLimitDerogation: "yes" },
      selectedBidderId: "missing",
      selectedLotId: "bad",
      selectedPairId: "bad",
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.schemaVersion).toBe(7);
    expect(snapshot?.baseScenarioId).toBe("market");
    expect(snapshot?.optimization.mode).toBe("technical-economic");
    expect(snapshot?.optimization.scope).toBe("active-lot");
    expect(snapshot?.optimization.levers.L1?.["C.1.2"].unitCost).toBeGreaterThan(0);
    expect(snapshot?.settings.threshold).toBe(37);
    expect(snapshot?.settings.applyAwardLimitDerogation).toBe(false);
    expect(snapshot?.selectedBidderId).toBe("a");
    expect(snapshot?.selectedLotId).toBe("L1");
    expect(snapshot?.selectedPairId).toBe("L1+L4");

    const bidder = snapshot!.bidders[0];
    for (const lot of LOTS) expect(bidder.lots[lot.id]).toBeDefined();
    for (const pair of PAIRS) expect(bidder.combos[pair.id]).toBeDefined();
    for (const criterion of CRITERIA) {
      if (criterion.kind === "Q") expect(bidder.lots.L1.qValues[criterion.id]).toBeDefined();
      if (criterion.kind === "T") expect(bidder.lots.L1.tValues[criterion.id]).toBeDefined();
      if (criterion.kind === "D") expect(bidder.lots.L1.dValues[criterion.id]).toBeDefined();
      expect(bidder.lots.L1.tradeoffs[criterion.id]).toBeDefined();
    }
    expect(bidder.lots.L1.tradeoffs["C.1.2"].unitCost).toBeGreaterThan(0);
  });

  it("accepts the new baseScenarioId field and falls back to scenario defaults", () => {
    const workspace = normalizeStoredWorkspace({
      schemaVersion: 2,
      scenarioName: "",
      baseScenarioId: "local",
      bidders: [],
      settings: { threshold: 38, applyAwardLimitDerogation: true },
      selectedBidderId: "missing",
      selectedLotId: "missing",
      selectedPairId: "missing",
    });

    expect(workspace).toBeDefined();
    expect(workspace?.schemaVersion).toBe(7);
    expect(workspace?.baseScenarioId).toBe("local");
    expect(workspace?.optimization.mode).toBe("technical-economic");
    expect(workspace?.optimization.levers.L4?.["C.2.1"].unitCost).toBeGreaterThan(0);
    expect(workspace?.scenarioName).toBe("Presidio locale");
    expect(workspace?.settings).toEqual({ threshold: 38, applyAwardLimitDerogation: true });
    expect(workspace?.selectedLotId).toBe("L4");
    expect(workspace?.selectedPairId).toBe("L3+L4");
    expect(workspace?.bidders.length).toBeGreaterThan(0);
  });

  it("normalizza gli input di ottimizzazione negli snapshot importati", () => {
    const snapshot = normalizeScenarioSnapshot({
      id: "optimizer",
      baseScenarioId: "market",
      optimization: {
        budgetEnabled: true,
        budget: 500000,
        budgetMode: "technical",
        scope: "active-lots",
        economic: { enabled: false, stepPercent: 0.2, maxDeltaPercent: 1.5 },
        levers: {
          L1: {
            "C.1.2": { enabled: true, stepUnits: 5, maxUnits: 20, unitCost: 1000, denominator: 80 },
          },
        },
      },
      bidders: [{ id: "a", lots: { L1: { enabled: true } } }],
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.optimization.mode).toBe("technical-only");
    expect("budgetEnabled" in snapshot!.optimization).toBe(false);
    expect("budget" in snapshot!.optimization).toBe(false);
    expect("budgetMode" in snapshot!.optimization).toBe(false);
    expect("economic" in snapshot!.optimization).toBe(false);
    expect(snapshot?.optimization.scope).toBe("active-lots");
    expect(snapshot?.optimization.levers.L1?.["C.1.2"]).toEqual({
      enabled: true,
      granularityUnits: 5,
      maxUnits: 20,
      unitCost: 1000,
      denominator: 80,
    });
    expect(snapshot?.optimization.levers.L2?.["C.1.2"]).toBeDefined();
    expect(snapshot?.optimization.levers.L2?.["C.1.2"].unitCost).toBeGreaterThan(0);
    expect(snapshot?.optimization.levers.L1?.["B.5.1"].enabled).toBe(false);
  });

  it("rende simulabili anche snapshot legacy molto parziali", () => {
    const report = normalizeScenarioSnapshotWithReport({
      schemaVersion: 1,
      demoScenarioId: "tech",
      name: "Legacy quasi vuoto",
      bidders: [
        {
          id: "legacy-a",
          name: "Operatore legacy",
          lots: {
            L2: {
              enabled: true,
              qValues: { "A.1.1": 3 },
              phaseDiscounts: [4],
            },
          },
        },
      ],
      settings: { threshold: 38, applyAwardLimitDerogation: false },
      selectedBidderId: "legacy-a",
      selectedLotId: "L2",
      selectedPairId: "L2+L3",
    });

    expect(report.snapshot).toBeDefined();
    expect(report.messages).toContain("Schema aggiornato alla versione corrente.");
    expect(report.messages).toContain("Campo legacy demoScenarioId migrato a baseScenarioId.");
    expect(report.messages).toContain("Offerte incomplete riparate con lotti, combinatorie e campi mancanti.");
    expect(report.messages).toContain("Configurazione Ottimizzazione assente o non valida: usati i valori dello scenario base.");

    const snapshot = report.snapshot!;
    expect(snapshot.baseScenarioId).toBe("tech");
    expect(snapshot.bidders[0].lots.L2.enabled).toBe(true);
    expect(snapshot.bidders[0].lots.L2.qValues["A.1.1"]).toBe(3);
    expect(snapshot.bidders[0].lots.L2.phaseDiscounts).toEqual([4, 0, 0]);
    expect(snapshot.bidders[0].lots.L2.tradeoffs["C.2.1"].unitCost).toBeGreaterThan(0);
    expect(snapshot.bidders[0].combos["L2+L3"]).toBeDefined();
    expect(snapshot.optimization.levers.L2?.["C.2.1"].unitCost).toBeGreaterThan(0);

    const result = simulate(snapshot.bidders, snapshot.settings, snapshot.selectedBidderId);
    expect(result.lotScores["legacy-a"].L2.participates).toBe(true);
    expect(result.scenarios.length).toBeGreaterThan(0);
  });

  it("segnala le riparazioni applicate durante l'import JSON", () => {
    const report = normalizeScenarioSnapshotWithReport({
      schemaVersion: 2,
      demoScenarioId: "market",
      bidders: [
        { id: "a", lots: { L1: { enabled: true } } },
        { id: "a", lots: { L2: { enabled: "true" } } },
      ],
      settings: { threshold: 999, applyAwardLimitDerogation: "yes" },
      selectedBidderId: "missing",
      selectedLotId: "bad",
      selectedPairId: "bad",
    });

    expect(report.snapshot).toBeDefined();
    expect(report.messages).toContain("Schema aggiornato alla versione corrente.");
    expect(report.messages).toContain("Campo legacy demoScenarioId migrato a baseScenarioId.");
    expect(report.messages).toContain("Offerte incomplete riparate con lotti, combinatorie e campi mancanti.");
    expect(report.messages).toContain("Configurazione Ottimizzazione assente o non valida: usati i valori dello scenario base.");
    expect(report.messages).toContain("Parametri scenario non validi riallineati ai valori supportati.");
    expect(report.messages).toContain("ID concorrente duplicati resi univoci per evitare sovrapposizioni nei punteggi.");
    expect(report.messages).toContain("Focus di lavoro non valido riallineato a concorrente, lotto e combinatoria disponibili.");
    expect(report.snapshot?.bidders.map((bidder) => bidder.id)).toEqual(["a", "a-2"]);
    expect(report.snapshot?.bidders[1].lots.L2.enabled).toBe(true);
  });

  it("riconosce export incapsulati e librerie di scenari", () => {
    const wrapped = normalizeScenarioSnapshotWithReport({
      scenarios: [
        {
          schemaVersion: 7,
          baseScenarioId: "market",
          id: "wrapped",
          name: "Scenario incapsulato",
          bidders: [{ id: "a", lots: { L1: { enabled: true } } }],
        },
      ],
    });
    const library = normalizeScenarioSnapshotWithReport([
      {
        schemaVersion: 7,
        baseScenarioId: "local",
        id: "library-first",
        name: "Scenario da libreria",
        bidders: [{ id: "local-a", lots: { L4: { enabled: true } } }],
      },
    ]);

    expect(wrapped.snapshot?.name).toBe("Scenario incapsulato");
    expect(wrapped.messages).toContain("Struttura JSON riconosciuta: importato il primo scenario disponibile.");
    expect(library.snapshot?.baseScenarioId).toBe("local");
    expect(library.messages).toContain("Struttura JSON riconosciuta: importato il primo scenario disponibile.");
  });

  it("importa il formato Excel light conservando tecnico aggregato e ribassi", () => {
    const report = normalizeScenarioSnapshotWithReport({
      format: "glm-excel-light-v1",
      schemaVersion: 1,
      id: "excel-light",
      name: "Scenario Excel",
      baseScenarioId: "market",
      settings: { threshold: 36, applyAwardLimitDerogation: false },
      selectedBidderId: "excel-a",
      selectedLotId: "L1",
      selectedPairId: "L1+L2",
      offers: [
        { bidderId: "excel-a", bidderName: "Operatore Excel", lotId: "L1", enabled: true, technicalRaw: 42.5, discount: 5.5 },
        { bidderId: "excel-a", bidderName: "Operatore Excel", lotId: "L2", enabled: true, technicalRaw: 41, discount: 4.75 },
      ],
      combos: [
        {
          bidderId: "excel-a",
          bidderName: "Operatore Excel",
          pairId: "L1+L2",
          enabled: true,
          discount: 6.25,
          insertedInBothBuste: true,
          pefCoherent: true,
        },
      ],
    });

    expect(report.snapshot).toBeDefined();
    expect(report.messages).toContain("Formato Excel light importato: il tecnico aggregato è conservato come override, i sub-criteri non sono ricostruiti.");

    const snapshot = report.snapshot!;
    const bidder = snapshot.bidders[0];
    expect(bidder.name).toBe("Operatore Excel");
    expect(bidder.lots.L1.technicalOverrideRaw).toBe(42.5);
    expect(bidder.lots.L1.phaseDiscounts).toEqual([5.5, 5.5, 5.5]);
    expect(bidder.combos["L1+L2"].enabled).toBe(true);
    expect(bidder.combos["L1+L2"].phaseDiscounts).toEqual([6.25, 6.25, 6.25]);

    const result = simulate(snapshot.bidders, snapshot.settings, snapshot.selectedBidderId);
    expect(result.lotScores["excel-a"].L1.technical).toBe(42.5);
    expect(result.lotScores["excel-a"].L1.admitted).toBe(true);
  });
});
