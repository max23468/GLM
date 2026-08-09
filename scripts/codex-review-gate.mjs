import { readFile } from "node:fs/promises";

const BOT = "chatgpt-codex-connector[bot]";
const priority = (body = "") => body.match(/\bP([0-3])\b/)?.[1];
const reviewedCommit = (body = "") =>
  body.match(/\*\*Reviewed commit:\*\*\s*`([0-9a-f]{10,40})`/i)?.[1];
const matchesHead = (candidate, headSha) =>
  Boolean(candidate && headSha.startsWith(candidate));
export const latestCodexInvocation = (comments, headCommittedAt) =>
  comments
    .filter(
      (comment) =>
        comment.user?.login !== BOT &&
        /@codex\s+review\b/i.test(comment.body) &&
        new Date(comment.created_at).getTime() >= new Date(headCommittedAt).getTime(),
    )
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0];

export function classifyCodexReview({
  headSha,
  comments = [],
  reviews = [],
  reviewComments = [],
  invocationReactions = [],
}) {
  const exactInline = reviewComments.filter(
    (comment) =>
      comment.user?.login === BOT &&
      (comment.original_commit_id ?? comment.commit_id) === headSha,
  );
  const exactTopLevel = comments.filter(
    (comment) =>
      comment.user?.login === BOT && matchesHead(reviewedCommit(comment.body), headSha),
  );
  const exactReviews = reviews.filter(
    (review) => review.user?.login === BOT && matchesHead(review.commit_id, headSha),
  );
  const blocking = [...exactInline, ...exactTopLevel, ...exactReviews].some((signal) =>
    ["0", "1"].includes(priority(signal.body)),
  );
  if (blocking) {
    return { state: "failure", description: "Codex ha trovato problemi P0/P1" };
  }

  if (exactReviews.length) {
    const advisory = [...exactInline, ...exactTopLevel, ...exactReviews].some((signal) =>
      ["2", "3"].includes(priority(signal.body)),
    );
    return {
      state: "success",
      description: advisory ? "Review conclusa con soli P2/P3 advisory" : "Review Codex conclusa",
    };
  }

  if (
    exactTopLevel.some((comment) =>
      /^Codex Review: Didn't find any major issues\./m.test(comment.body),
    ) ||
    invocationReactions.some(
      (reaction) => reaction.user?.login === BOT && reaction.content === "+1",
    )
  ) {
    return { state: "success", description: "Review Codex conclusa" };
  }

  return { state: "pending", description: "In attesa della review Codex" };
}

async function request(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path}: ${response.status}`);
  return response.json();
}

async function all(path) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await request(`${path}${separator}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

async function setStatus(repository, sha, state, description) {
  await request(`/repos/${repository}/statuses/${sha}`, {
    method: "POST",
    body: JSON.stringify({
      state,
      context: "codex-review",
      description,
      target_url: `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    }),
  });
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const repository = process.env.GITHUB_REPOSITORY;
  const number = String(event.pull_request?.number ?? process.env.PULL_REQUEST_NUMBER);
  if (!/^\d+$/.test(number)) throw new Error("Numero PR non valido");
  const pullRequest = await request(`/repos/${repository}/pulls/${number}`);
  const headSha = pullRequest.head.sha;
  const headCommit = await request(`/repos/${repository}/commits/${headSha}`);
  const headCommittedAt = headCommit.commit.committer.date;
  await setStatus(repository, headSha, "pending", "In attesa della review Codex");
  if (pullRequest.draft) return;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [comments, reviews, reviewComments] = await Promise.all([
      all(`/repos/${repository}/issues/${number}/comments`),
      all(`/repos/${repository}/pulls/${number}/reviews`),
      all(`/repos/${repository}/pulls/${number}/comments`),
    ]);
    const invocation = latestCodexInvocation(comments, headCommittedAt);
    const invocationReactions = invocation
      ? await all(`/repos/${repository}/issues/comments/${invocation.id}/reactions`)
      : [];
    const result = classifyCodexReview({
      headSha,
      comments,
      reviews,
      reviewComments,
      invocationReactions,
    });
    if (result.state !== "pending") {
      await setStatus(repository, headSha, result.state, result.description);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 180_000));
  }
  await setStatus(repository, headSha, "error", "Review Codex non conclusa entro cinque ore");
}

if (import.meta.main) {
  await main().catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
