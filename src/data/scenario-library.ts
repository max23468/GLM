import type { BaseScenarioId } from "./base-scenarios";

export type ScenarioLibraryItem = {
  id: string;
  title: string;
  description: string;
  baseScenarioId: BaseScenarioId;
  path: string;
  updatedAt: string;
};

export const SCENARIO_LIBRARY_ITEMS: ScenarioLibraryItem[] = [
  {
    id: "github-market",
    title: "Mercato realistico",
    description: "Base equilibrata per confrontare operatori noti, combinatorie plausibili e soglia ordinaria.",
    baseScenarioId: "market",
    path: "/scenarios/mercato-realistico.json",
    updatedAt: "2026-05-20",
  },
  {
    id: "github-tech",
    title: "Tecnologia e flotta",
    description: "Scenario versionato per stressare dotazioni di bordo, informazione dinamica e performance ambientali.",
    baseScenarioId: "tech",
    path: "/scenarios/tecnologia-flotta.json",
    updatedAt: "2026-05-20",
  },
  {
    id: "github-discount",
    title: "Ribasso aggressivo",
    description: "Stress test su convenienza economica, tenuta della soglia Q/T e rischio di offerte tecniche deboli.",
    baseScenarioId: "discount",
    path: "/scenarios/ribasso-aggressivo.json",
    updatedAt: "2026-05-20",
  },
  {
    id: "github-local",
    title: "Presidio locale",
    description: "Base di lavoro sul lotto 4 e sulle leve territoriali, utile per analisi di presidio operativo.",
    baseScenarioId: "local",
    path: "/scenarios/presidio-locale.json",
    updatedAt: "2026-05-20",
  },
];
