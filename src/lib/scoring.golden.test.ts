import { describe, expect, it } from "vitest";
import { BASE_SCENARIOS } from "../data/base-scenarios";
import { LOTS } from "../data/tender";
import { simulate, type AssignmentCandidate } from "./scoring";

const summarizeAssignment = (assignment: AssignmentCandidate) => ({
  bidderId: assignment.bidderId,
  kind: assignment.kind,
  lots: assignment.lotIds,
  pairId: assignment.pairId ?? null,
  totalScore: Number(assignment.totalScore.toFixed(4)),
  scoreByLot: Object.fromEntries(
    Object.entries(assignment.scoreByLot).map(([lotId, score]) => [lotId, Number((score ?? 0).toFixed(4))]),
  ),
});

describe("scoring golden fixtures", () => {
  it("mantiene invarianti operative sugli scenari base", () => {
    const lotIds = LOTS.map((lot) => lot.id).sort();

    for (const scenario of BASE_SCENARIOS) {
      const result = simulate(scenario.buildBidders(), scenario.settings, scenario.defaultBidderId);
      const selected = result.selectedScenario;

      expect(selected, scenario.id).toBeDefined();
      expect(result.warnings, scenario.id).toHaveLength(0);
      expect(selected?.totalScore, scenario.id).toBeGreaterThan(0);
      expect(selected?.technicalScore, scenario.id).toBeGreaterThan(0);
      expect(selected?.unassignedLots, scenario.id).toEqual([]);
      expect(selected?.awardLimitDerogationUsed, scenario.id).toBe(false);

      const assignedLots = selected?.assignments.flatMap((assignment) => assignment.lotIds) ?? [];
      expect([...assignedLots].sort(), scenario.id).toEqual(lotIds);
      expect(new Set(assignedLots).size, scenario.id).toBe(assignedLots.length);

      for (const lot of LOTS) {
        const ranking = result.lotRankings[lot.id];
        expect(ranking[0]?.lotIds, `${scenario.id} ${lot.id}`).toContain(lot.id);
        expect(ranking[0]?.scoreByLot[lot.id], `${scenario.id} ${lot.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("mantiene stabili esiti e ranking degli scenari base", () => {
    const fixture = BASE_SCENARIOS.map((scenario) => {
      const result = simulate(scenario.buildBidders(), scenario.settings, scenario.defaultBidderId);
      return {
        scenario: scenario.id,
        selected: {
          totalScore: Number((result.selectedScenario?.totalScore ?? 0).toFixed(4)),
          technicalScore: Number((result.selectedScenario?.technicalScore ?? 0).toFixed(4)),
          drawRequired: result.selectedScenario?.drawRequired ?? false,
          awardLimitDerogationUsed: result.selectedScenario?.awardLimitDerogationUsed ?? false,
          unassignedLots: result.selectedScenario?.unassignedLots ?? [],
          assignments: (result.selectedScenario?.assignments ?? []).map(summarizeAssignment),
        },
        firstByLot: Object.fromEntries(
          Object.entries(result.lotRankings).map(([lotId, ranking]) => [lotId, ranking[0] ? summarizeAssignment(ranking[0]) : null]),
        ),
        warningCount: result.warnings.length,
      };
    });

    expect(fixture).toMatchInlineSnapshot(`
      [
        {
          "firstByLot": {
            "L1": {
              "bidderId": "autoguidovie",
              "kind": "combo",
              "lots": [
                "L1",
                "L4",
              ],
              "pairId": "L1+L4",
              "scoreByLot": {
                "L1": 98.4155,
                "L4": 99.4015,
              },
              "totalScore": 197.817,
            },
            "L2": {
              "bidderId": "arriva",
              "kind": "combo",
              "lots": [
                "L2",
                "L3",
              ],
              "pairId": "L2+L3",
              "scoreByLot": {
                "L2": 99.3528,
                "L3": 93.1578,
              },
              "totalScore": 192.5106,
            },
            "L3": {
              "bidderId": "net-atm",
              "kind": "combo",
              "lots": [
                "L3",
                "L4",
              ],
              "pairId": "L3+L4",
              "scoreByLot": {
                "L3": 95.7711,
                "L4": 96.1033,
              },
              "totalScore": 191.8744,
            },
            "L4": {
              "bidderId": "autoguidovie",
              "kind": "combo",
              "lots": [
                "L1",
                "L4",
              ],
              "pairId": "L1+L4",
              "scoreByLot": {
                "L1": 98.4155,
                "L4": 99.4015,
              },
              "totalScore": 197.817,
            },
          },
          "scenario": "market",
          "selected": {
            "assignments": [
              {
                "bidderId": "autoguidovie",
                "kind": "combo",
                "lots": [
                  "L1",
                  "L4",
                ],
                "pairId": "L1+L4",
                "scoreByLot": {
                  "L1": 98.4155,
                  "L4": 99.4015,
                },
                "totalScore": 197.817,
              },
              {
                "bidderId": "arriva",
                "kind": "combo",
                "lots": [
                  "L2",
                  "L3",
                ],
                "pairId": "L2+L3",
                "scoreByLot": {
                  "L2": 99.3528,
                  "L3": 93.1578,
                },
                "totalScore": 192.5106,
              },
            ],
            "awardLimitDerogationUsed": false,
            "drawRequired": false,
            "technicalScore": 271.9121,
            "totalScore": 390.3276,
            "unassignedLots": [],
          },
          "warningCount": 0,
        },
        {
          "firstByLot": {
            "L1": {
              "bidderId": "autoguidovie",
              "kind": "combo",
              "lots": [
                "L1",
                "L4",
              ],
              "pairId": "L1+L4",
              "scoreByLot": {
                "L1": 98.4155,
                "L4": 97.7424,
              },
              "totalScore": 196.1579,
            },
            "L2": {
              "bidderId": "arriva",
              "kind": "combo",
              "lots": [
                "L2",
                "L3",
              ],
              "pairId": "L2+L3",
              "scoreByLot": {
                "L2": 99.3528,
                "L3": 91.9202,
              },
              "totalScore": 191.273,
            },
            "L3": {
              "bidderId": "net-atm",
              "kind": "combo",
              "lots": [
                "L3",
                "L4",
              ],
              "pairId": "L3+L4",
              "scoreByLot": {
                "L3": 94.0299,
                "L4": 96.2036,
              },
              "totalScore": 190.2335,
            },
            "L4": {
              "bidderId": "autoguidovie",
              "kind": "combo",
              "lots": [
                "L1",
                "L4",
              ],
              "pairId": "L1+L4",
              "scoreByLot": {
                "L1": 98.4155,
                "L4": 97.7424,
              },
              "totalScore": 196.1579,
            },
          },
          "scenario": "tech",
          "selected": {
            "assignments": [
              {
                "bidderId": "autoguidovie",
                "kind": "combo",
                "lots": [
                  "L1",
                  "L4",
                ],
                "pairId": "L1+L4",
                "scoreByLot": {
                  "L1": 98.4155,
                  "L4": 97.7424,
                },
                "totalScore": 196.1579,
              },
              {
                "bidderId": "arriva",
                "kind": "combo",
                "lots": [
                  "L2",
                  "L3",
                ],
                "pairId": "L2+L3",
                "scoreByLot": {
                  "L2": 99.3528,
                  "L3": 91.9202,
                },
                "totalScore": 191.273,
              },
            ],
            "awardLimitDerogationUsed": false,
            "drawRequired": false,
            "technicalScore": 269.0154,
            "totalScore": 387.4309,
            "unassignedLots": [],
          },
          "warningCount": 0,
        },
        {
          "firstByLot": {
            "L1": {
              "bidderId": "autoguidovie",
              "kind": "combo",
              "lots": [
                "L1",
                "L4",
              ],
              "pairId": "L1+L4",
              "scoreByLot": {
                "L1": 94.9074,
                "L4": 99.4015,
              },
              "totalScore": 194.3089,
            },
            "L2": {
              "bidderId": "arriva",
              "kind": "combo",
              "lots": [
                "L2",
                "L3",
              ],
              "pairId": "L2+L3",
              "scoreByLot": {
                "L2": 99.2284,
                "L3": 90.864,
              },
              "totalScore": 190.0924,
            },
            "L3": {
              "bidderId": "net-atm",
              "kind": "combo",
              "lots": [
                "L3",
                "L4",
              ],
              "pairId": "L3+L4",
              "scoreByLot": {
                "L3": 93.2635,
                "L4": 96.1033,
              },
              "totalScore": 189.3668,
            },
            "L4": {
              "bidderId": "autoguidovie",
              "kind": "combo",
              "lots": [
                "L1",
                "L4",
              ],
              "pairId": "L1+L4",
              "scoreByLot": {
                "L1": 94.9074,
                "L4": 99.4015,
              },
              "totalScore": 194.3089,
            },
          },
          "scenario": "discount",
          "selected": {
            "assignments": [
              {
                "bidderId": "autoguidovie",
                "kind": "combo",
                "lots": [
                  "L1",
                  "L4",
                ],
                "pairId": "L1+L4",
                "scoreByLot": {
                  "L1": 94.9074,
                  "L4": 99.4015,
                },
                "totalScore": 194.3089,
              },
              {
                "bidderId": "arriva",
                "kind": "combo",
                "lots": [
                  "L2",
                  "L3",
                ],
                "pairId": "L2+L3",
                "scoreByLot": {
                  "L2": 99.2284,
                  "L3": 90.864,
                },
                "totalScore": 190.0924,
              },
            ],
            "awardLimitDerogationUsed": false,
            "drawRequired": false,
            "technicalScore": 269.4939,
            "totalScore": 384.4013,
            "unassignedLots": [],
          },
          "warningCount": 0,
        },
        {
          "firstByLot": {
            "L1": {
              "bidderId": "autoguidovie",
              "kind": "single",
              "lots": [
                "L1",
              ],
              "pairId": null,
              "scoreByLot": {
                "L1": 95.4049,
              },
              "totalScore": 95.4049,
            },
            "L2": {
              "bidderId": "arriva",
              "kind": "combo",
              "lots": [
                "L2",
                "L3",
              ],
              "pairId": "L2+L3",
              "scoreByLot": {
                "L2": 99.3528,
                "L3": 93.1578,
              },
              "totalScore": 192.5106,
            },
            "L3": {
              "bidderId": "net-atm",
              "kind": "combo",
              "lots": [
                "L3",
                "L4",
              ],
              "pairId": "L3+L4",
              "scoreByLot": {
                "L3": 95.7711,
                "L4": 96.0063,
              },
              "totalScore": 191.7774,
            },
            "L4": {
              "bidderId": "autoguidovie",
              "kind": "single",
              "lots": [
                "L4",
              ],
              "pairId": null,
              "scoreByLot": {
                "L4": 98.1274,
              },
              "totalScore": 98.1274,
            },
          },
          "scenario": "local",
          "selected": {
            "assignments": [
              {
                "bidderId": "autoguidovie",
                "kind": "single",
                "lots": [
                  "L1",
                ],
                "pairId": null,
                "scoreByLot": {
                  "L1": 95.4049,
                },
                "totalScore": 95.4049,
              },
              {
                "bidderId": "arriva",
                "kind": "combo",
                "lots": [
                  "L2",
                  "L3",
                ],
                "pairId": "L2+L3",
                "scoreByLot": {
                  "L2": 99.3528,
                  "L3": 93.1578,
                },
                "totalScore": 192.5106,
              },
              {
                "bidderId": "autoguidovie",
                "kind": "single",
                "lots": [
                  "L4",
                ],
                "pairId": null,
                "scoreByLot": {
                  "L4": 98.1274,
                },
                "totalScore": 98.1274,
              },
            ],
            "awardLimitDerogationUsed": false,
            "drawRequired": false,
            "technicalScore": 271.9121,
            "totalScore": 386.0429,
            "unassignedLots": [],
          },
          "warningCount": 0,
        },
      ]
    `);
  });
});
