import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MANAGED_START,
  checkProject,
  initProject,
  proposeDocument,
  publishDocument,
  resolveTopic,
  scanProject,
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
