import viteConfig from "./vite.config";
import { defineConfig, mergeConfig } from "vitest/config";

const CORE_COVERAGE_INCLUDE = [
  "src/lib/scoring.ts",
  "src/lib/optimization.ts",
  "src/lib/scenario-persistence.ts",
  "src/data/tender.ts",
  "src/data/base-scenarios.ts",
];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: {
        provider: "v8",
        include: CORE_COVERAGE_INCLUDE,
        reporter: ["text", "json-summary", "html"],
        thresholds: {
          lines: 85,
          branches: 75,
        },
      },
    },
  }),
);
