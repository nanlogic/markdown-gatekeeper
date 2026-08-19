import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MANAGED_START,
  GLOBAL_MANAGED_START,
  amendEvidence,
  applyAdoption,
  automaticAdoption,
  checkProject,
  codexSkillStatus,
  contextForPath,
  decideAdoption,
  explainTopic,
  initProject,
  initializeAndAdopt,
  installCodexSkill,
  ownerReview,
  proposeDocument,
  publishDocument,
  restoreAdoption,
  resolveTopic,
  reviewAdoption,
  scanProject,
  startAdoption,
  submitSessionReview,
  submitOwnerReview,
  syncProject,
  upsertManagedBlock
} from "../src/mdg.mjs";

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function temporaryProject(name = "test-project") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "markdown-gatekeeper-"));
  await initProject(root, { name });
  return root;
}

test("managed block preserves user content and remains singular", () => {
  const original = "# Personal instructions\n\nKeep this exact sentence.\n";
  const once = upsertManagedBlock(original);
  const twice = upsertManagedBlock(once);
  assert.match(twice, /Keep this exact sentence\./);
  assert.equal(twice.split(MANAGED_START).length - 1, 1);
  assert.match(twice, /Run `mdg status \.`/);
  assert.match(twice, /Keep successful Gatekeeper bootstrap and housekeeping silent/);
  assert.match(twice, /do not run a predictable failing command/);
});

test("proposal publishes one current topic and resolves it", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const proposalDir = path.join(root, "docs", "proposals");
  const proposalPath = path.join(proposalDir, "architecture.md");
  await fs.writeFile(proposalPath, "# Architecture\n\nThe deterministic publisher owns current state.\n", "utf8");
  await proposeDocument(root, "docs/proposals/architecture.md", { topic: "architecture" });
  const published = await publishDocument(root, "docs/proposals/architecture.md", {
    topic: "architecture",
    approve: true,
    owner: "tester"
  });
  assert.equal(published.topicRecord.revision, 1);
  const resolved = await resolveTopic(root, "architecture");
  assert.equal(resolved.matches.length, 1);
  assert.equal(resolved.matches[0].path, "docs/current/architecture.md");
  const check = await checkProject(root);
  assert.equal(check.ok, true, check.errors.join("\n"));
});

test("direct canonical tampering fails integrity check", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "docs", "proposals", "rules.md");
  await fs.writeFile(source, "# Rules\n\nVersion one.\n", "utf8");
  await proposeDocument(root, "docs/proposals/rules.md", { topic: "rules" });
  await publishDocument(root, "docs/proposals/rules.md", { topic: "rules", approve: true });
  await fs.appendFile(path.join(root, "docs", "current", "rules.md"), "Unauthorized edit.\n", "utf8");
  const check = await checkProject(root);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => error.includes("changed outside publisher")));
});

test("stale base revision is rejected", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const first = path.join(root, "docs", "proposals", "first.md");
  await fs.writeFile(first, "# Design\n\nFirst.\n", "utf8");
  await publishDocument(root, "docs/proposals/first.md", { topic: "design", approve: true });
  const second = path.join(root, "docs", "proposals", "second.md");
  await fs.writeFile(second, "# Design\n\nSecond.\n", "utf8");
  await assert.rejects(
    publishDocument(root, "docs/proposals/second.md", { topic: "design", approve: true, baseRevision: 0 }),
    /Stale proposal/
  );
});

test("scan reports duplicate unmanaged topics and false authority claims", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "old-a.md"), "# Combat Rules\n\nThis is the authoritative specification.\n", "utf8");
  await fs.writeFile(path.join(root, "old-b.md"), "# Combat Rules\n\nConflicting values.\n", "utf8");
  const report = await scanProject(root);
  assert.equal(report.counts.duplicateTopics, 1);
  assert.equal(report.counts.unmanaged, 2);
  assert.equal(report.counts.suspiciousAuthorityClaims, 1);
});

test("agent hook denies direct protected edits but allows proposals", () => {
  const hook = path.join(repositoryRoot, ".authority", "hooks", "agent-guard.mjs");
  const blocked = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name: "apply_patch", tool_input: { command: "*** Update File: PROJECT_AUTHORITY.md" } }),
    encoding: "utf8"
  });
  const decision = JSON.parse(blocked.stdout);
  assert.equal(decision.hookSpecificOutput.permissionDecision, "deny");

  const allowed = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name: "apply_patch", tool_input: { command: "*** Add File: docs/proposals/new.md" } }),
    encoding: "utf8"
  });
  assert.equal(allowed.stdout, "");

  const readable = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "Get-Content -Raw PROJECT_AUTHORITY.md" } }),
    encoding: "utf8"
  });
  assert.equal(readable.stdout, "");

  const shellWrite = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "Set-Content -LiteralPath PROJECT_AUTHORITY.md -Value bad" } }),
    encoding: "utf8"
  });
  assert.equal(JSON.parse(shellWrite.stdout).hookSpecificOutput.permissionDecision, "deny");
});

test("init installs a Git pre-commit validator without replacing an existing hook", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "markdown-gatekeeper-git-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const initialized = spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  const hookPath = path.join(root, ".git", "hooks", "pre-commit");
  await fs.writeFile(hookPath, "#!/bin/sh\necho existing\n", "utf8");
  await initProject(root, { name: "git-test" });
  const hook = await fs.readFile(hookPath, "utf8");
  assert.match(hook, /echo existing/);
  assert.match(hook, /markdown-gatekeeper:managed:start/);
});

test("publishing creates a baseline then an incremental Evidence chain", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const first = path.join(root, "docs", "proposals", "testing-v1.md");
  await fs.writeFile(first, "# Testing\n\n## Current rules\n\n- Use an isolated database.\n- Run integration tests.\n", "utf8");
  const baseline = await publishDocument(root, "docs/proposals/testing-v1.md", { topic: "testing", owner: "owner@example.com", approve: true });
  assert.match(baseline.evidence, /r0001\.md$/);
  const current = await fs.readFile(path.join(root, baseline.topicRecord.path), "utf8");
  assert.match(current, /R-001 — Use an isolated database\./);
  assert.match(current, /R-002 — Run integration tests\./);

  const second = path.join(root, "docs", "proposals", "testing-v2.md");
  await fs.writeFile(second, "# Testing\n\n## Current rules\n\n- R-001 — Use an isolated database.\n- R-002 — Run the complete integration suite.\n- R-003 — Verify migrations.\n", "utf8");
  const delta = await publishDocument(root, "docs/proposals/testing-v2.md", { topic: "testing", baseRevision: 1, owner: "owner@example.com", approve: true });
  const evidence = JSON.parse(await fs.readFile(path.join(root, delta.topicRecord.evidenceDataPath), "utf8"));
  assert.equal(evidence.mode, "delta");
  assert.deepEqual(evidence.changes.map((item) => item.item), ["R-002", "R-003"]);
  assert.equal(evidence.previousEvidenceDataPath.endsWith("r0001.json"), true);

  const unchanged = await explainTopic(root, "testing", { item: "R-001" });
  assert.equal(unchanged.history[0].revision, 1);
  const changed = await explainTopic(root, "testing", { item: "R-002", history: true });
  assert.deepEqual(changed.history.map((item) => item.revision), [1, 2]);
  assert.equal((await checkProject(root)).ok, true);
});

test("scoped context selects the deepest authority for each topic", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "docs", "proposals", "root.md"), "# Testing\n\nRoot rules.\n", "utf8");
  await publishDocument(root, "docs/proposals/root.md", { topic: "testing", scope: ".", approve: true });
  await fs.writeFile(path.join(root, "docs", "proposals", "api.md"), "# Testing\n\nAPI rules.\n", "utf8");
  await publishDocument(root, "docs/proposals/api.md", { topic: "testing", scope: "services/api", approve: true });
  const rootContext = await contextForPath(root, "services/web");
  assert.equal(rootContext.authorities[0].scope, ".");
  const apiContext = await contextForPath(root, "services/api/routes");
  assert.equal(apiContext.authorities[0].scope, "services/api");
  assert.equal(apiContext.authorities[0].path, "docs/current/services/api/testing.md");
});

test("routine context does not load Evidence but integrity check detects tampering", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "docs", "proposals", "rules.md"), "# Rules\n\nRules.\n", "utf8");
  const result = await publishDocument(root, "docs/proposals/rules.md", { topic: "rules", approve: true });
  await fs.appendFile(path.join(root, result.topicRecord.evidenceDataPath), "tamper", "utf8");
  assert.equal((await contextForPath(root, ".")).authorities.length, 1);
  const check = await checkProject(root);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => error.includes("Evidence data")));
});

test("no-op authority publication is rejected without creating a revision", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "docs", "proposals", "one.md"), "# One\n\nSame content.\n", "utf8");
  const first = await publishDocument(root, "docs/proposals/one.md", { topic: "one", approve: true });
  await fs.writeFile(path.join(root, "docs", "proposals", "same.md"), await fs.readFile(path.join(root, first.topicRecord.path), "utf8"), "utf8");
  await assert.rejects(publishDocument(root, "docs/proposals/same.md", { topic: "one", approve: true }), /No-op publish/);
  const registry = JSON.parse(await fs.readFile(path.join(root, ".authority", "registry.json"), "utf8"));
  assert.equal(registry.revision, 1);
});

test("adoption requires disclosure approval, applies a reviewed topic, archives and restores source", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const legacyPath = path.join(root, "legacy-instructions.md");
  await fs.writeFile(legacyPath, "# API Testing\n\n## Current rules\n\n- Use an isolated database.\n", "utf8");
  const manifest = await startAdoption(root, { include: ["legacy-instructions.md"], exclude: ["AGENTS.md", "CLAUDE.md"] });
  const source = manifest.sources.find((item) => item.path === "legacy-instructions.md");
  assert.ok(source);
  await assert.rejects(reviewAdoption(root, manifest.runId, { reviewer: "fixture" }), /approve-send/);

  const reviewerScript = path.join(root, "reviewer-fixture.mjs");
  const fixture = {
    topics: [{
      decisionId: "api-testing", topic: "testing", scope: "services/api", title: "API Testing", confidence: "high", requiresOwner: false,
      summary: "The selected source matches the API scope.", sources: [source.id],
      currentMarkdown: "# API Testing\n\n## Current rules\n\n- R-001 — Use an isolated database.\n",
      changes: [{ item: "R-001", change: "selected", sources: [source.id], reason: "Scope match.", confidence: "high" }]
    }]
  };
  await fs.writeFile(reviewerScript, `import fs from "node:fs"; fs.writeFileSync(process.argv[2], ${JSON.stringify(JSON.stringify(fixture))});\n`, "utf8");
  await fs.writeFile(path.join(root, ".authority", "local", "reviewers.json"), JSON.stringify({ fixture: { command: process.execPath, args: [reviewerScript, "{outputFile}"] } }), "utf8");
  await reviewAdoption(root, manifest.runId, { reviewer: "fixture", approveSend: true });
  await decideAdoption(root, manifest.runId, "api-testing", { acceptDraft: true });
  const applied = await applyAdoption(root, manifest.runId);
  assert.equal(applied.applied.length, 1);
  assert.equal(await fs.stat(legacyPath).then(() => true, () => false), false);
  const record = applied.applied[0].topicRecord;
  assert.equal(record.scope, "services/api");
  assert.equal(record.adoptionRun, manifest.runId);
  const restored = await restoreAdoption(root, manifest.runId, "api-testing");
  assert.equal(restored.restored[0].mode, "restored");
  assert.equal(await fs.readFile(legacyPath, "utf8"), "# API Testing\n\n## Current rules\n\n- Use an isolated database.\n");
});

test("sync migrates schema v1 topics and bootstraps Evidence", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "docs", "proposals", "legacy.md"), "# Legacy\n\nLegacy authority.\n", "utf8");
  const published = await publishDocument(root, "docs/proposals/legacy.md", { topic: "legacy", approve: true });
  const registryPath = path.join(root, ".authority", "registry.json");
  const current = JSON.parse(await fs.readFile(registryPath, "utf8"));
  const topic = current.topics.legacy;
  const legacy = { schemaVersion: 1, project: current.project, revision: current.revision, updatedAt: current.updatedAt, topics: { legacy: { title: topic.title, status: topic.status, path: topic.path, revision: topic.revision, sha256: topic.sha256, owner: topic.owner, updatedAt: topic.updatedAt, supersedes: null } } };
  await fs.writeFile(registryPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
  await fs.rm(path.join(root, ".authority", "evidence"), { recursive: true, force: true });
  await syncProject(root);
  const migrated = JSON.parse(await fs.readFile(registryPath, "utf8"));
  assert.equal(migrated.schemaVersion, 2);
  assert.ok(migrated.topics.legacy.evidencePath);
  assert.equal((await checkProject(root)).ok, true);
  assert.equal(published.topicRecord.revision, migrated.topics.legacy.revision);
});

test("a source shared with an unresolved topic stays in place", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "shared-context.md"), "# Shared Context\n\nMixed rules.\n", "utf8");
  const manifest = await startAdoption(root, { include: ["shared-context.md"], exclude: ["AGENTS.md", "CLAUDE.md"] });
  const source = manifest.sources.find((item) => item.path === "shared-context.md");
  const topics = ["alpha", "beta"].map((topic) => ({ decisionId: topic, topic, scope: ".", title: topic, confidence: "high", requiresOwner: false, summary: "fixture", sources: [source.id], currentMarkdown: `# ${topic}\n\nAccepted.\n`, changes: [] }));
  const script = path.join(root, "shared-reviewer.mjs");
  await fs.writeFile(script, `import fs from "node:fs"; fs.writeFileSync(process.argv[2], ${JSON.stringify(JSON.stringify({ topics }))});\n`, "utf8");
  await fs.writeFile(path.join(root, ".authority", "local", "reviewers.json"), JSON.stringify({ fixture: { command: process.execPath, args: [script, "{outputFile}"] } }), "utf8");
  await reviewAdoption(root, manifest.runId, { reviewer: "fixture", approveSend: true });
  await decideAdoption(root, manifest.runId, "alpha", { acceptDraft: true });
  await decideAdoption(root, manifest.runId, "beta", { unresolved: true });
  await applyAdoption(root, manifest.runId, { decision: "alpha" });
  assert.equal(await fs.readFile(path.join(root, "shared-context.md"), "utf8"), "# Shared Context\n\nMixed rules.\n");
});

test("Evidence corrections append amendments without changing current authority", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "docs", "proposals", "rules.md"), "# Rules\n\n## Current rules\n\n- Keep sources.\n", "utf8");
  const published = await publishDocument(root, "docs/proposals/rules.md", { topic: "rules", approve: true });
  await assert.rejects(amendEvidence(root, "rules", { item: "R-001", reason: "Correction" }), /--approve/);
  const amendment = await amendEvidence(root, "rules", { item: "R-001", reason: "Corrected provenance.", source: "S-002", approve: true });
  assert.match(amendment.path, /amendments\/a0001\.md$/);
  const explained = await explainTopic(root, "rules", { item: "R-001" });
  assert.equal(explained.history[0].amendment, true);
  const registry = JSON.parse(await fs.readFile(path.join(root, ".authority", "registry.json"), "utf8"));
  assert.equal(registry.revision, 1);
  assert.equal(registry.topics.rules.sha256, published.topicRecord.sha256);
  assert.equal((await checkProject(root)).ok, true);
});

test("adoption discovery marks deterministic near duplicates", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const shared = "Agents must run unit integration security formatting checks before publishing any change.";
  await fs.writeFile(path.join(root, "old-instructions.md"), `# Rules\n\n${shared}\n`, "utf8");
  await fs.writeFile(path.join(root, "new-instructions.md"), `# Rules\n\n${shared} Always report failures.\n`, "utf8");
  const manifest = await startAdoption(root, { include: ["old-instructions.md", "new-instructions.md"], exclude: ["AGENTS.md", "CLAUDE.md"] });
  const near = manifest.sources.find((source) => source.nearDuplicateOf);
  assert.ok(near);
  assert.ok(near.nearDuplicateSimilarity >= 0.8);
});

test("lazy discovery excludes obvious noise and follows explicit authority references", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "docs", "design"), { recursive: true });
  await fs.mkdir(path.join(root, "docs", "archive"), { recursive: true });
  await fs.mkdir(path.join(root, "docs", "asset_audits", "cup"), { recursive: true });
  await fs.writeFile(path.join(root, "docs", "PROCESS_RULES.md"), "# Process Rules\n\nUse `docs/design/GAME_AUTHORITY.md`.\n", "utf8");
  await fs.writeFile(path.join(root, "docs", "design", "GAME_AUTHORITY.md"), "# Game Authority\n\nCanonical gameplay requirements.\n", "utf8");
  await fs.writeFile(path.join(root, "docs", "archive", "OLD_HANDOFF.md"), "# Old Handoff\n\nHistorical only.\n", "utf8");
  await fs.writeFile(path.join(root, "docs", "asset_audits", "cup", "repair_plan_if_failed.md"), "# Repair Plan\n\nRetry export.\n", "utf8");
  await fs.writeFile(path.join(root, "MEMORY.md"), "# Memory\n\nNotes from several projects.\n", "utf8");
  const manifest = await startAdoption(root);
  const paths = manifest.sources.map((source) => source.path);
  assert.ok(paths.includes("docs/PROCESS_RULES.md"));
  assert.ok(paths.includes("docs/design/GAME_AUTHORITY.md"));
  assert.ok(!paths.includes("docs/archive/OLD_HANDOFF.md"));
  assert.ok(!paths.includes("docs/asset_audits/cup/repair_plan_if_failed.md"));
  assert.ok(!paths.includes("MEMORY.md"));
  assert.ok(!paths.includes("CLAUDE.md"));
  assert.equal(manifest.sources.find((source) => source.path === "docs/PROCESS_RULES.md").classification, "authority-candidate");
  assert.equal(manifest.sources.find((source) => source.path === "docs/design/GAME_AUTHORITY.md").classification, "authority-candidate");
  assert.equal(manifest.discovery.find((item) => item.path === "docs/archive/OLD_HANDOFF.md").classification, "historical-archive");
  assert.equal(manifest.discovery.find((item) => item.path === "MEMORY.md").classification, "ordinary-document");
});

test("manual confirmation mode previews once, publishes safe topics, and leaves uncertain sources", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "high-rules.md"), "# Build Rules\n\nRun tests.\n", "utf8");
  await fs.writeFile(path.join(root, "uncertain-handoff.md"), "# Product Direction\n\nMaybe change the game.\n", "utf8");
  const waiting = await initializeAndAdopt(root, { reviewer: "fixture", confirmed: false });
  assert.equal(waiting.status, "confirmation-required");
  assert.equal(waiting.sourceCount, 2);
  assert.equal(waiting.confirmation.reviewBundle.length, 2);
  assert.equal(waiting.confirmation.archiveRiskPreview.length, 2);

  const manifest = JSON.parse(await fs.readFile(path.join(root, ".authority", "adoptions", waiting.runId, "manifest.json"), "utf8"));
  const high = manifest.sources.find((source) => source.path === "high-rules.md");
  const uncertain = manifest.sources.find((source) => source.path === "uncertain-handoff.md");
  const fixture = { topics: [
    { decisionId: "build-rules", topic: "build", scope: ".", title: "Build Rules", confidence: "high", requiresOwner: false, summary: "Clear project rule.", sources: [high.id], currentMarkdown: "# Build Rules\n\n## Current rules\n\n- R-001 — Run tests.\n", changes: [{ item: "R-001", change: "selected", sources: [high.id], reason: "Explicit rule.", confidence: "high" }] },
    { decisionId: "product-direction", topic: "product-direction", scope: ".", title: "Product Direction", confidence: "low", requiresOwner: true, summary: "Ambiguous product intent.", sources: [uncertain.id], currentMarkdown: "# Product Direction\n\nUnresolved.\n", changes: [] }
  ] };
  const reviewerScript = path.join(root, "lazy-reviewer.mjs");
  await fs.writeFile(reviewerScript, `import fs from "node:fs"; fs.writeFileSync(process.argv[2], ${JSON.stringify(JSON.stringify(fixture))});\n`, "utf8");
  await fs.writeFile(path.join(root, ".authority", "local", "reviewers.json"), JSON.stringify({ fixture: { command: process.execPath, args: [reviewerScript, "{outputFile}"] } }), "utf8");

  const completed = await initializeAndAdopt(root, { runId: waiting.runId, reviewer: "fixture", confirmed: true, confirmationMode: "single-confirmation" });
  assert.equal(completed.status, "complete-with-unresolved");
  assert.deepEqual(completed.accepted, ["build-rules"]);
  assert.deepEqual(completed.unresolved, ["product-direction"]);
  assert.equal(await fs.stat(path.join(root, "high-rules.md")).then(() => true, () => false), false);
  assert.equal(await fs.readFile(path.join(root, "uncertain-handoff.md"), "utf8"), "# Product Direction\n\nMaybe change the game.\n");
  assert.equal(completed.check.ok, true, completed.check.errors.join("\n"));
  const archivePlan = JSON.parse(await fs.readFile(path.join(root, ".authority", "adoptions", waiting.runId, "archive-plan.json"), "utf8"));
  assert.deepEqual(archivePlan.paths, ["high-rules.md"]);
});

test("current Codex Session can review when an isolated CLI is unavailable", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "session-rules.md"), "# Session Rules\n\nRun checks.\n", "utf8");
  const waiting = await initializeAndAdopt(root, { reviewer: "current-session", confirmed: false });
  assert.equal(waiting.status, "confirmation-required");
  assert.equal(waiting.confirmation.reviewer, "current-session");

  const requested = await initializeAndAdopt(root, { runId: waiting.runId, reviewer: "current-session", hostSession: "codex", confirmed: true, confirmationMode: "single-confirmation" });
  assert.equal(requested.status, "session-review-required");
  assert.ok(requested.prompt.endsWith("session-review-request.md"));
  const manifest = JSON.parse(await fs.readFile(path.join(root, ".authority", "adoptions", waiting.runId, "manifest.json"), "utf8"));
  const source = manifest.sources.find((item) => item.path === "session-rules.md");
  const result = { topics: [{
    decisionId: "session-rules", topic: "session-rules", scope: ".", title: "Session Rules", confidence: "high", requiresOwner: false,
    summary: "Clear rule reviewed by the current session.", sources: [source.id], currentMarkdown: "# Session Rules\n\n## Current rules\n\n- R-001 — Run checks.\n",
    changes: [{ item: "R-001", change: "selected", sources: [source.id], reason: "Explicit rule.", confidence: "high" }]
  }] };
  await fs.writeFile(path.join(root, requested.result), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await submitSessionReview(root, waiting.runId, requested.result);
  const completed = await automaticAdoption(root, waiting.runId, { hostSession: "codex", confirmed: true });
  assert.equal(completed.status, "complete");
  assert.equal(completed.reviewer, "current-session");
  assert.deepEqual(completed.accepted, ["session-rules"]);
  assert.equal(completed.check.ok, true, completed.check.errors.join("\n"));
});

test("default initialization is zero-touch and does not consume owner interaction budget", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "zero-touch-rules.md"), "# Zero Touch Rules\n\nContinue automatically.\n", "utf8");
  const result = await initializeAndAdopt(root, { reviewer: "current-session", hostSession: "codex" });
  assert.equal(result.status, "session-review-required");
  const manifest = JSON.parse(await fs.readFile(path.join(root, ".authority", "adoptions", result.runId, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.interactionBudget, { limit: 10, used: 0 });
  assert.equal(manifest.confirmationMode, "automatic-init");
});

test("reviewer timeout releases the run lock", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "timeout-rules.md"), "# Timeout Rules\n\nRun promptly.\n", "utf8");
  const manifest = await startAdoption(root, { include: ["timeout-rules.md"] });
  const script = path.join(root, "slow-reviewer.mjs");
  await fs.writeFile(script, "setTimeout(() => {}, 5000);\n", "utf8");
  await fs.writeFile(path.join(root, ".authority", "local", "reviewers.json"), JSON.stringify({ slow: { command: process.execPath, args: [script] } }), "utf8");
  await assert.rejects(reviewAdoption(root, manifest.runId, { reviewer: "slow", approveSend: true, timeoutMs: 50 }));
  assert.equal(await fs.stat(path.join(root, ".authority", "adoptions", manifest.runId, "run.lock.json")).then(() => true, () => false), false);
  const after = JSON.parse(await fs.readFile(path.join(root, ".authority", "adoptions", manifest.runId, "manifest.json"), "utf8"));
  assert.equal(after.reviewAttempts.length, 1);
  assert.equal(after.reviewAttempts[0].timedOut, true);
});

test("concurrent reviewer attempts are rejected by the adoption run lock", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "locked-rules.md"), "# Locked Rules\n\nOne reviewer.\n", "utf8");
  const manifest = await startAdoption(root, { include: ["locked-rules.md"] });
  const source = manifest.sources.find((item) => item.path === "locked-rules.md");
  const fixture = { topics: [{ decisionId: "locked", topic: "locked", scope: ".", title: "Locked", confidence: "high", requiresOwner: false, summary: "fixture", sources: [source.id], currentMarkdown: "# Locked\n\n## Current rules\n\n- R-001 — One reviewer.\n", changes: [] }] };
  const script = path.join(root, "locked-reviewer.mjs");
  await fs.writeFile(script, `import fs from "node:fs"; setTimeout(() => fs.writeFileSync(process.argv[2], ${JSON.stringify(JSON.stringify(fixture))}), 250);\n`, "utf8");
  await fs.writeFile(path.join(root, ".authority", "local", "reviewers.json"), JSON.stringify({ locked: { command: process.execPath, args: [script, "{outputFile}"] } }), "utf8");
  const first = reviewAdoption(root, manifest.runId, { reviewer: "locked", approveSend: true, timeoutMs: 2000 });
  await new Promise((resolve) => setTimeout(resolve, 30));
  await assert.rejects(reviewAdoption(root, manifest.runId, { reviewer: "locked", approveSend: true, timeoutMs: 2000 }), /is locked by review/);
  await first;
});

test("a dead stale adoption lock is recovered deterministically", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "stale-rules.md"), "# Stale Rules\n\nRecover locks.\n", "utf8");
  const manifest = await startAdoption(root, { include: ["stale-rules.md"] });
  const lockPath = path.join(root, ".authority", "adoptions", manifest.runId, "run.lock.json");
  await fs.writeFile(lockPath, `${JSON.stringify({ token: "old", pid: 2147483647, operation: "review", startedAt: "2000-01-01T00:00:00.000Z" })}\n`, "utf8");
  const result = await automaticAdoption(root, manifest.runId, { reviewer: "current-session" });
  assert.equal(result.status, "confirmation-required");
  assert.equal(await fs.stat(lockPath).then(() => true, () => false), false);
});

test("incompatible adoption protocol cannot continue", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "protocol-rules.md"), "# Protocol Rules\n\nPin versions.\n", "utf8");
  const manifest = await startAdoption(root, { include: ["protocol-rules.md"] });
  const manifestPath = path.join(root, ".authority", "adoptions", manifest.runId, "manifest.json");
  const incompatible = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  incompatible.adoptionProtocolVersion = 1;
  await fs.writeFile(manifestPath, `${JSON.stringify(incompatible, null, 2)}\n`, "utf8");
  await assert.rejects(automaticAdoption(root, manifest.runId, { confirmed: true }), /incompatible protocol/);
});

test("owner review batches unresolved topics and publishes an accepted recommendation", async (t) => {
  const root = await temporaryProject();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "owner-handoff.md"), "# Owner Choice\n\nPossible direction.\n", "utf8");
  const waiting = await initializeAndAdopt(root, { reviewer: "current-session", confirmed: false });
  const requested = await initializeAndAdopt(root, { runId: waiting.runId, reviewer: "current-session", hostSession: "codex", confirmed: true, confirmationMode: "single-confirmation" });
  const manifest = JSON.parse(await fs.readFile(path.join(root, ".authority", "adoptions", waiting.runId, "manifest.json"), "utf8"));
  const source = manifest.sources.find((item) => item.path === "owner-handoff.md");
  const result = { topics: [{ decisionId: "owner-choice", topic: "owner-choice", scope: ".", title: "Owner Choice", confidence: "low", requiresOwner: true, summary: "Owner must confirm.", sources: [source.id], currentMarkdown: "# Owner Choice\n\n## Current rules\n\n- R-001 — Use the proposed direction.\n", changes: [{ item: "R-001", change: "selected", sources: [source.id], reason: "Owner confirmation required.", confidence: "low" }] }] };
  await fs.writeFile(path.join(root, requested.result), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await submitSessionReview(root, waiting.runId, requested.result);
  const auto = await automaticAdoption(root, waiting.runId, { hostSession: "codex", confirmed: true });
  assert.equal(auto.status, "complete-with-unresolved");
  const cards = await ownerReview(root, waiting.runId);
  assert.equal(cards.cards.length, 1);
  assert.equal(cards.cards[0].choices.length, 3);
  assert.deepEqual(cards.interactionBudget, { limit: 10, used: 1 });
  const ownerResult = path.join(root, cards.result);
  await fs.writeFile(ownerResult, `${JSON.stringify({ selections: [{ decisionId: "owner-choice", action: "accept-draft" }] }, null, 2)}\n`, "utf8");
  const applied = await submitOwnerReview(root, waiting.runId, cards.result);
  assert.equal(applied.status, "owner-review-complete");
  assert.deepEqual(applied.accepted, ["owner-choice"]);
  const afterOwner = JSON.parse(await fs.readFile(path.join(root, ".authority", "adoptions", waiting.runId, "manifest.json"), "utf8"));
  assert.deepEqual(afterOwner.interactionBudget, { limit: 10, used: 2 });
  assert.equal((await checkProject(root)).ok, true);
});

test("init preserves pre-existing native Agent files until adoption", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "markdown-gatekeeper-legacy-init-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const original = "# Existing Agent Rules\n\nDo not rewrite this during installation.\n";
  await fs.writeFile(path.join(root, "AGENTS.md"), original, "utf8");
  await initProject(root, { name: "legacy-init" });
  assert.equal(await fs.readFile(path.join(root, "AGENTS.md"), "utf8"), original);
  const pending = JSON.parse(await fs.readFile(path.join(root, ".authority", "pending-entrypoints.json"), "utf8"));
  assert.deepEqual(pending, ["AGENTS.md"]);
  const check = await checkProject(root);
  assert.equal(check.ok, true);
  assert.ok(check.warnings.some((warning) => warning.includes("pending legacy adoption")));
});

test("Codex Skill installs from the CLI bundle and protects unmanaged skills", async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "markdown-gatekeeper-codex-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  await fs.writeFile(path.join(home, "AGENTS.md"), "# Global Agent Instructions\n\nKeep this personal instruction.\n\n## Markdown Gatekeeper auto-detection\n\nOld unmanaged bootstrap.\n", "utf8");
  const installed = await installCodexSkill({ codexHome: home });
  assert.equal(installed.installed, true);
  assert.equal(installed.managed, true);
  assert.equal(installed.installedVersion, "0.6.2");
  assert.equal(installed.globalBootstrapInstalled, true);
  const skill = await fs.readFile(path.join(home, "skills", "markdown-gatekeeper", "SKILL.md"), "utf8");
  assert.match(skill, /mdg context/);
  assert.match(skill, /Do not send separate commentary/);
  assert.equal((await codexSkillStatus({ codexHome: home })).cliVersion, "0.6.2");
  const globalInstructions = await fs.readFile(path.join(home, "AGENTS.md"), "utf8");
  assert.match(globalInstructions, /Keep this personal instruction\./);
  assert.equal(globalInstructions.split(GLOBAL_MANAGED_START).length - 1, 1);
  assert.doesNotMatch(globalInstructions, /Old unmanaged bootstrap/);
  assert.match(globalInstructions, /Successful bootstrap and housekeeping are silent/);
  assert.match(globalInstructions, /never run a predictable failing command/);
  await installCodexSkill({ codexHome: home });
  assert.equal(await fs.readFile(path.join(home, "AGENTS.md"), "utf8"), globalInstructions);

  await fs.rm(path.join(home, "skills", "markdown-gatekeeper", ".mdg-managed.json"));
  await assert.rejects(installCodexSkill({ codexHome: home }), /Refusing to overwrite unmanaged/);
  assert.equal((await installCodexSkill({ codexHome: home, force: true })).managed, true);
});
