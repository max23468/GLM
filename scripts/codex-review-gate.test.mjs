import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { classifyCodexReview } from "./codex-review-gate.mjs";

const headSha = "0123456789abcdef0123456789abcdef01234567";
const bot = { login: "chatgpt-codex-connector[bot]" };

test("P0/P1 exact-HEAD bloccano", () => {
  const result = classifyCodexReview({
    headSha,
    reviewComments: [{ user: bot, original_commit_id: headSha, body: "**P1** Bloccante" }],
  });
  assert.equal(result.state, "failure");
});

test("P2/P3 diventano advisory quando la review è conclusa", () => {
  const result = classifyCodexReview({
    headSha,
    reviewComments: [{ user: bot, original_commit_id: headSha, body: "**P2** Advisory" }],
    reviews: [{ user: bot, commit_id: headSha, body: "" }],
  });
  assert.equal(result.state, "success");
  assert.match(result.description, /advisory/);
});

test("un finding advisory non conclude da solo la review", () => {
  const result = classifyCodexReview({
    headSha,
    reviewComments: [{ user: bot, original_commit_id: headSha, body: "**P3** Advisory" }],
  });
  assert.equal(result.state, "pending");
});

test("ignora segnali di un commit precedente", () => {
  const result = classifyCodexReview({
    headSha,
    reviews: [{ user: bot, commit_id: "abcdef0123456789abcdef0123456789abcdef01" }],
  });
  assert.equal(result.state, "pending");
});

test("React Doctor è bloccante e silenzioso sulle scansioni pulite", async () => {
  const [workflow, manifest, config] = await Promise.all([
    readFile(".github/workflows/react-doctor.yml", "utf8"),
    readFile("package.json", "utf8").then(JSON.parse),
    readFile("doctor.config.json", "utf8").then(JSON.parse),
  ]);
  assert.match(workflow, /version:\s*0\.9\.11/);
  assert.match(workflow, /blocking:\s*warning/);
  assert.match(workflow, /comment:\s*"false"/);
  assert.match(workflow, /review-comments:\s*"true"/);
  assert.equal(manifest.scripts["quality:react-doctor"], "react-doctor --scope full --blocking warning .");
  assert.deepEqual(config.ignore.overrides[0], {
    files: [".github/workflows/ci.yml"],
    rules: ["react-doctor/build-pipeline-secret-boundary"],
  });
});
