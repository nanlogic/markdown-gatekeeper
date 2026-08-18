import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const MANAGED_START = "<!-- markdown-gatekeeper:managed:start -->";
export const MANAGED_END = "<!-- markdown-gatekeeper:managed:end -->";
export const REGISTRY_RELATIVE = path.join(".authority", "registry.json");
export const INDEX_RELATIVE = "PROJECT_AUTHORITY.md";

const IGNORED_DIRS = new Set([".git", "node_modules", ".svn", ".hg", "dist", "build"]);
const ENTRYPOINT_FILES = new Set(["AGENTS.md", "CLAUDE.md", "PROJECT_AUTHORITY.md", "README.md"]);

function normalizeSlashes(value) {
  return value.split(path.sep).join("/");
}

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

export function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readText(target, fallback = "") {
  try {
    return await fs.readFile(target, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readJson(target, fallback) {
  const raw = await readText(target, "");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${target}: ${error.message}`);
  }
}

async function writeTextAtomic(target, content) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, target);
}

async function writeJsonAtomic(target, value) {
  await writeTextAtomic(target, `${JSON.stringify(value, null, 2)}\n`);
}

export async function findProjectRoot(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    if (await exists(path.join(current, REGISTRY_RELATIVE))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

export function parseFrontmatter(content) {
  const result = {};
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return result;
  const normalized = content.replace(/\r\n/g, "\n");
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return result;
  for (const line of normalized.slice(4, end).split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (match) result[match[1].toLowerCase()] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return result;
}

export function firstHeading(content, fallback = "Untitled") {
  const match = content.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : fallback;
}

export function managedBlock() {
  return `${MANAGED_START}\n## Markdown Gatekeeper protocol\n\n` +
    `This project dogfoods Markdown Gatekeeper. Before planning or implementation:\n\n` +
    `1. Read \`PROJECT_AUTHORITY.md\` and the current sources it names.\n` +
    `2. Run \`node ./bin/mdg.mjs status .\` when this repository contains the CLI; otherwise run \`mdg status .\`.\n` +
    `3. Treat unregistered Markdown as a proposal, never as current authority.\n` +
    `4. Put competing designs in \`docs/proposals/\`; do not create a second canonical source.\n` +
    `5. Never edit \`PROJECT_AUTHORITY.md\`, \`.authority/registry.json\`, or \`docs/current/**\` directly. Use the publisher command.\n` +
    `6. Run \`node ./bin/mdg.mjs check .\` before declaring authority-related work complete.\n\n` +
    `The LLM is a reviewer. The deterministic publisher controls current authority. Low-confidence product conflicts require the human owner.\n` +
    `${MANAGED_END}`;
}

export function upsertManagedBlock(existing, block = managedBlock()) {
  const start = existing.indexOf(MANAGED_START);
  const end = existing.indexOf(MANAGED_END);
  if (start >= 0 && end >= start) {
    const after = end + MANAGED_END.length;
    return `${existing.slice(0, start)}${block}${existing.slice(after)}`.replace(/\s+$/, "") + "\n";
  }
  const prefix = existing.trimEnd();
  return `${prefix ? `${prefix}\n\n` : ""}${block}\n`;
}

export function defaultRegistry(projectName) {
  return {
    schemaVersion: 1,
    project: {
      name: projectName,
      owner: "human-owner"
    },
    revision: 0,
    topics: {},
    updatedAt: new Date(0).toISOString()
  };
}

export function validateRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== "object") return ["Registry must be an object."];
  if (registry.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (!registry.project?.name) errors.push("project.name is required.");
  if (!Number.isInteger(registry.revision) || registry.revision < 0) errors.push("revision must be a non-negative integer.");
  if (!registry.topics || typeof registry.topics !== "object" || Array.isArray(registry.topics)) errors.push("topics must be an object.");
  for (const [topicId, topic] of Object.entries(registry.topics ?? {})) {
    if (slugify(topicId) !== topicId) errors.push(`Topic id is not normalized: ${topicId}`);
    if (topic.status !== "current") errors.push(`Topic ${topicId} must have status=current in the current registry.`);
    if (!topic.path) errors.push(`Topic ${topicId} is missing path.`);
    if (!topic.sha256) errors.push(`Topic ${topicId} is missing sha256.`);
    if (!Number.isInteger(topic.revision) || topic.revision < 1) errors.push(`Topic ${topicId} has invalid revision.`);
  }
  return errors;
}

export function buildAuthorityIndex(registry) {
  const lines = [
    "# Project Authority",
    "",
    "<!-- Generated by Markdown Gatekeeper. Do not edit directly. -->",
    "",
    `- Project: ${registry.project.name}`,
    `- Registry revision: ${registry.revision}`,
    `- Human owner: ${registry.project.owner || "human-owner"}`,
    "",
    "Only the entries under **Current authority** are normative. Unregistered Markdown is a proposal.",
    "",
    "## Current authority",
    ""
  ];
  const entries = Object.entries(registry.topics).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) {
    lines.push("No current topics have been published yet.", "");
  } else {
    lines.push("| Topic | Title | Current source | Topic revision |", "|---|---|---|---:|");
    for (const [topicId, topic] of entries) {
      const link = normalizeSlashes(topic.path);
      lines.push(`| \`${topicId}\` | ${topic.title} | [${link}](${link}) | ${topic.revision} |`);
    }
    lines.push("");
  }
  lines.push(
    "## Required workflow",
    "",
    "1. Resolve the topic here before reading historical or proposal documents.",
    "2. Create competing work under `docs/proposals/`.",
    "3. Use Markdown Gatekeeper to publish; never overwrite current authority directly.",
    "4. Escalate ambiguous product intent to the human owner.",
    ""
  );
  return `${lines.join("\n")}\n`;
}

async function walkMarkdown(root, current = root, result = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    const relative = normalizeSlashes(path.relative(root, absolute));
    if (entry.isDirectory()) {
      if (relative.startsWith(".authority/cache") || relative.startsWith(".authority/local")) continue;
      await walkMarkdown(root, absolute, result);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      result.push({ absolute, relative });
    }
  }
  return result;
}

export async function loadRegistry(root) {
  const target = path.join(root, REGISTRY_RELATIVE);
  const registry = await readJson(target, null);
  if (!registry) throw new Error(`Not initialized: ${target} does not exist. Run mdg init.`);
  const errors = validateRegistry(registry);
  if (errors.length) throw new Error(`Registry validation failed:\n- ${errors.join("\n- ")}`);
  return registry;
}

async function mergeHookConfig(target, event, matcher, command, commandWindows = command) {
  const config = await readJson(target, {});
  config.hooks ??= {};
  config.hooks[event] ??= [];
  const description = "Markdown Gatekeeper authority guard";
  const alreadyPresent = config.hooks[event].some((group) =>
    JSON.stringify(group).includes("agent-guard.mjs")
  );
  if (!alreadyPresent) {
    config.hooks[event].push({
      matcher,
      hooks: [{ type: "command", command, command_windows: commandWindows, timeout: 10, statusMessage: description }]
    });
  }
  await writeJsonAtomic(target, config);
}

async function installGitPreCommit(root) {
  const gitDir = path.join(root, ".git");
  if (!(await exists(gitDir))) return false;
  const target = path.join(gitDir, "hooks", "pre-commit");
  const start = "# markdown-gatekeeper:managed:start";
  const end = "# markdown-gatekeeper:managed:end";
  const block = `${start}\nnode \".authority/hooks/pre-commit.mjs\" || exit $?\n${end}`;
  let existing = await readText(target, "#!/bin/sh\n");
  if (existing.includes(start) && existing.includes(end)) {
    const before = existing.slice(0, existing.indexOf(start));
    const after = existing.slice(existing.indexOf(end) + end.length);
    existing = `${before}${block}${after}`;
  } else {
    existing = `${existing.trimEnd()}\n\n${block}\n`;
  }
  await writeTextAtomic(target, existing);
  await fs.chmod(target, 0o755);
  return true;
}

export async function initProject(root, options = {}) {
  root = path.resolve(root);
  await fs.mkdir(root, { recursive: true });
  const authorityDir = path.join(root, ".authority");
  for (const directory of [
    authorityDir,
    path.join(authorityDir, "hooks"),
    path.join(authorityDir, "reports"),
    path.join(authorityDir, "events"),
    path.join(root, "docs", "current"),
    path.join(root, "docs", "proposals")
  ]) {
    await fs.mkdir(directory, { recursive: true });
  }

  const registryPath = path.join(root, REGISTRY_RELATIVE);
  if (!(await exists(registryPath))) {
    await writeJsonAtomic(registryPath, defaultRegistry(options.name || path.basename(root)));
  }
  const registry = await loadRegistry(root);
  await writeTextAtomic(path.join(root, INDEX_RELATIVE), buildAuthorityIndex(registry));

  for (const filename of ["AGENTS.md", "CLAUDE.md"]) {
    const target = path.join(root, filename);
    const existing = await readText(target, `# ${filename === "AGENTS.md" ? "Agent Instructions" : "Claude Instructions"}\n`);
    await writeTextAtomic(target, upsertManagedBlock(existing));
  }

  const guardSource = fileURLToPath(new URL("../.authority/hooks/agent-guard.mjs", import.meta.url));
  const guardTarget = path.join(authorityDir, "hooks", "agent-guard.mjs");
  if (await exists(guardSource) && path.resolve(guardSource) !== path.resolve(guardTarget)) {
    await fs.copyFile(guardSource, guardTarget);
  }
  const preCommitSource = fileURLToPath(new URL("../.authority/hooks/pre-commit.mjs", import.meta.url));
  const preCommitTarget = path.join(authorityDir, "hooks", "pre-commit.mjs");
  if (await exists(preCommitSource) && path.resolve(preCommitSource) !== path.resolve(preCommitTarget)) {
    await fs.copyFile(preCommitSource, preCommitTarget);
  }

  await mergeHookConfig(
    path.join(root, ".codex", "hooks.json"),
    "PreToolUse",
    "Bash|apply_patch|Edit|Write",
    "node .authority/hooks/agent-guard.mjs",
    "node .authority\\hooks\\agent-guard.mjs"
  );
  await mergeHookConfig(
    path.join(root, ".claude", "settings.json"),
    "PreToolUse",
    "Bash|Edit|Write",
    'node "$CLAUDE_PROJECT_DIR"/.authority/hooks/agent-guard.mjs'
  );
  await installGitPreCommit(root);

  return { root, registry };
}

export async function syncProject(root) {
  root = await findProjectRoot(root);
  const registry = await loadRegistry(root);
  await writeTextAtomic(path.join(root, INDEX_RELATIVE), buildAuthorityIndex(registry));
  for (const filename of ["AGENTS.md", "CLAUDE.md"]) {
    const target = path.join(root, filename);
    await writeTextAtomic(target, upsertManagedBlock(await readText(target, `# ${filename}\n`)));
  }
  return registry;
}

export async function scanProject(root) {
  root = await findProjectRoot(root);
  const registry = await loadRegistry(root);
  const canonical = new Set(Object.values(registry.topics).map((topic) => normalizeSlashes(topic.path)));
  const proposalRecords = await readJson(path.join(root, ".authority", "proposals.json"), []);
  const proposals = new Set(proposalRecords.map((item) => normalizeSlashes(item.path)));
  const files = await walkMarkdown(root);
  const documents = [];

  for (const file of files) {
    const content = await readText(file.absolute);
    const metadata = parseFrontmatter(content);
    const title = firstHeading(content, path.basename(file.relative, ".md"));
    const topic = slugify(metadata["authority-topic"] || title);
    const selfClaimsAuthority = /\b(authoritative|canonical|source of truth)\b|权威文档|唯一(?:真相|来源)/iu.test(content);
    let classification = "unmanaged";
    if (canonical.has(file.relative)) classification = "current";
    else if (proposals.has(file.relative) || file.relative.startsWith("docs/proposals/")) classification = "proposal";
    else if (ENTRYPOINT_FILES.has(file.relative)) classification = "entrypoint";
    else if (file.relative.startsWith(".authority/")) classification = "internal";
    documents.push({ path: file.relative, title, topic, classification, selfClaimsAuthority, sha256: sha256(content) });
  }

  const groups = new Map();
  for (const document of documents.filter((item) => !["entrypoint", "internal"].includes(item.classification))) {
    if (!groups.has(document.topic)) groups.set(document.topic, []);
    groups.get(document.topic).push(document);
  }
  const duplicates = [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([topic, items]) => ({ topic, paths: items.map((item) => item.path), classifications: items.map((item) => item.classification) }));
  const unmanaged = documents.filter((item) => item.classification === "unmanaged");
  const suspiciousAuthorityClaims = documents.filter((item) =>
    item.selfClaimsAuthority && ["unmanaged", "proposal"].includes(item.classification)
  );
  const report = {
    generatedAt: new Date().toISOString(),
    project: registry.project.name,
    registryRevision: registry.revision,
    counts: {
      markdown: documents.length,
      current: documents.filter((item) => item.classification === "current").length,
      proposals: documents.filter((item) => item.classification === "proposal").length,
      unmanaged: unmanaged.length,
      duplicateTopics: duplicates.length,
      suspiciousAuthorityClaims: suspiciousAuthorityClaims.length
    },
    documents,
    duplicates,
    unmanaged,
    suspiciousAuthorityClaims
  };

  const reportDir = path.join(root, ".authority", "reports");
  await fs.mkdir(reportDir, { recursive: true });
  await writeJsonAtomic(path.join(reportDir, "LATEST.json"), report);
  await writeTextAtomic(path.join(reportDir, "LATEST.md"), renderScanReport(report));
  return report;
}

export function renderScanReport(report) {
  const lines = [
    "# Markdown Gatekeeper Scan",
    "",
    `- Project: ${report.project}`,
    `- Registry revision: ${report.registryRevision}`,
    `- Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Markdown files: ${report.counts.markdown}`,
    `- Current authority files: ${report.counts.current}`,
    `- Proposals: ${report.counts.proposals}`,
    `- Unmanaged files: ${report.counts.unmanaged}`,
    `- Duplicate topic groups: ${report.counts.duplicateTopics}`,
    `- Non-current authority claims: ${report.counts.suspiciousAuthorityClaims}`,
    "",
    "## Duplicate topics",
    ""
  ];
  if (!report.duplicates.length) lines.push("None.", "");
  for (const group of report.duplicates) {
    lines.push(`### ${group.topic}`, "");
    group.paths.forEach((item, index) => lines.push(`- ${item} (${group.classifications[index]})`));
    lines.push("");
  }
  lines.push("## Unmanaged Markdown", "");
  if (!report.unmanaged.length) lines.push("None.", "");
  else report.unmanaged.forEach((item) => lines.push(`- ${item} — ${item.title}`));
  lines.push("", "## Authority claims outside current registry", "");
  if (!report.suspiciousAuthorityClaims.length) lines.push("None.", "");
  else report.suspiciousAuthorityClaims.forEach((item) => lines.push(`- ${item.path} — ${item.title}`));
  lines.push("", "## Reviewer instruction", "", "Classify each duplicate or unmanaged document as supporting, proposal, conflicting, superseded, or a genuinely new topic. Do not publish low-confidence product intent without the human owner.", "");
  return `${lines.join("\n")}\n`;
}

export async function proposeDocument(root, sourcePath, options = {}) {
  root = await findProjectRoot(root);
  const absolute = path.resolve(root, sourcePath);
  if (!(await exists(absolute))) throw new Error(`Proposal file does not exist: ${absolute}`);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error("Proposal must be inside the project.");
  const relative = normalizeSlashes(path.relative(root, absolute));
  const content = await readText(absolute);
  const proposalsPath = path.join(root, ".authority", "proposals.json");
  const proposals = await readJson(proposalsPath, []);
  const record = {
    id: options.id || `${Date.now()}-${slugify(firstHeading(content, path.basename(relative, ".md")))}`,
    path: relative,
    title: options.title || firstHeading(content, path.basename(relative, ".md")),
    topic: slugify(options.topic || parseFrontmatter(content)["authority-topic"] || firstHeading(content, "untitled")),
    baseRevision: Number.isInteger(options.baseRevision) ? options.baseRevision : null,
    status: "pending",
    sha256: sha256(content),
    createdAt: new Date().toISOString()
  };
  const filtered = proposals.filter((item) => item.path !== relative || item.status !== "pending");
  filtered.push(record);
  await writeJsonAtomic(proposalsPath, filtered);
  return record;
}

export async function publishDocument(root, sourcePath, options = {}) {
  root = await findProjectRoot(root);
  if (!options.approve) throw new Error("Publishing requires explicit --approve.");
  const source = path.resolve(root, sourcePath);
  if (!(await exists(source))) throw new Error(`Source does not exist: ${source}`);
  if (!source.startsWith(`${root}${path.sep}`)) throw new Error("Source must be inside the project.");
  const content = await readText(source);
  const sourceRelative = normalizeSlashes(path.relative(root, source));
  const topicId = slugify(options.topic || parseFrontmatter(content)["authority-topic"] || firstHeading(content));
  const registryPath = path.join(root, REGISTRY_RELATIVE);
  const registry = await loadRegistry(root);
  const existing = registry.topics[topicId];
  if (options.baseRevision !== undefined && existing && Number(options.baseRevision) !== existing.revision) {
    throw new Error(`Stale proposal: topic ${topicId} is at revision ${existing.revision}, not ${options.baseRevision}.`);
  }
  const targetRelative = normalizeSlashes(options.target || `docs/current/${topicId}.md`);
  const target = path.resolve(root, targetRelative);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Publish target must be inside the project.");
  await writeTextAtomic(target, content.endsWith("\n") ? content : `${content}\n`);
  const storedContent = await readText(target);
  registry.revision += 1;
  registry.updatedAt = new Date().toISOString();
  registry.topics[topicId] = {
    title: options.title || firstHeading(storedContent, topicId),
    status: "current",
    path: targetRelative,
    revision: (existing?.revision || 0) + 1,
    sha256: sha256(storedContent),
    owner: options.owner || existing?.owner || registry.project.owner || "human-owner",
    updatedAt: registry.updatedAt,
    supersedes: existing ? { path: existing.path, revision: existing.revision, sha256: existing.sha256 } : null
  };
  await writeJsonAtomic(registryPath, registry);
  await writeTextAtomic(path.join(root, INDEX_RELATIVE), buildAuthorityIndex(registry));
  const proposalsPath = path.join(root, ".authority", "proposals.json");
  const proposals = await readJson(proposalsPath, []);
  let archiveRelative = null;
  if (sourceRelative.startsWith("docs/proposals/") && path.resolve(source) !== path.resolve(target)) {
    archiveRelative = normalizeSlashes(path.join(
      ".authority",
      "archive",
      "proposals",
      `${Date.now()}-${path.basename(source)}`
    ));
    const archiveTarget = path.join(root, archiveRelative);
    await fs.mkdir(path.dirname(archiveTarget), { recursive: true });
    await fs.rename(source, archiveTarget);
  }
  for (const proposal of proposals) {
    if (normalizeSlashes(proposal.path) === sourceRelative) {
      proposal.status = "published";
      proposal.publishedAt = registry.updatedAt;
      proposal.publishedRevision = registry.topics[topicId].revision;
      if (archiveRelative) proposal.archivePath = archiveRelative;
    }
  }
  await writeJsonAtomic(proposalsPath, proposals);
  const eventPath = path.join(root, ".authority", "events", "events.jsonl");
  await fs.mkdir(path.dirname(eventPath), { recursive: true });
  await fs.appendFile(eventPath, `${JSON.stringify({
    type: "published",
    at: registry.updatedAt,
    topic: topicId,
    topicRevision: registry.topics[topicId].revision,
    registryRevision: registry.revision,
    source: sourceRelative,
    archive: archiveRelative,
    target: targetRelative,
    owner: registry.topics[topicId].owner,
    sha256: registry.topics[topicId].sha256
  })}\n`, "utf8");
  return { topic: topicId, topicRecord: registry.topics[topicId], registryRevision: registry.revision };
}

export async function resolveTopic(root, query) {
  root = await findProjectRoot(root);
  const registry = await loadRegistry(root);
  const normalized = slugify(query);
  const matches = Object.entries(registry.topics)
    .filter(([id, topic]) => id.includes(normalized) || normalized.includes(id) || topic.title.toLowerCase().includes(String(query).toLowerCase()))
    .map(([id, topic]) => ({ id, ...topic }));
  return { root, query, matches };
}

export async function checkProject(root) {
  root = await findProjectRoot(root);
  const errors = [];
  const warnings = [];
  let registry;
  try {
    registry = await loadRegistry(root);
  } catch (error) {
    return { root, ok: false, errors: [error.message], warnings };
  }
  for (const [topicId, topic] of Object.entries(registry.topics)) {
    const target = path.join(root, topic.path);
    if (!(await exists(target))) {
      errors.push(`Missing current source for ${topicId}: ${topic.path}`);
      continue;
    }
    const content = await readText(target);
    if (sha256(content) !== topic.sha256) errors.push(`Current source changed outside publisher: ${topic.path}`);
  }
  const eventsRaw = await readText(path.join(root, ".authority", "events", "events.jsonl"), "");
  const events = [];
  for (const [index, line] of eventsRaw.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      errors.push(`Invalid event JSON on line ${index + 1}: ${error.message}`);
    }
  }
  const publishedEvents = events.filter((event) => event.type === "published");
  if (publishedEvents.length !== registry.revision) {
    errors.push(`Registry revision ${registry.revision} does not match ${publishedEvents.length} publish events.`);
  }
  for (const [topicId, topic] of Object.entries(registry.topics)) {
    const latest = publishedEvents.filter((event) => event.topic === topicId).at(-1);
    if (!latest) {
      errors.push(`No publish event exists for current topic ${topicId}.`);
      continue;
    }
    if (latest.topicRevision !== topic.revision || latest.target !== normalizeSlashes(topic.path)) {
      errors.push(`Latest publish event does not match current topic ${topicId}.`);
    }
    if (latest.sha256 && latest.sha256 !== topic.sha256) {
      errors.push(`Latest publish event hash does not match current topic ${topicId}.`);
    }
  }
  const expectedIndex = buildAuthorityIndex(registry);
  const actualIndex = await readText(path.join(root, INDEX_RELATIVE), "");
  if (actualIndex !== expectedIndex) errors.push(`${INDEX_RELATIVE} is out of sync with the registry.`);
  for (const filename of ["AGENTS.md", "CLAUDE.md"]) {
    const content = await readText(path.join(root, filename), "");
    if (!content.includes(MANAGED_START) || !content.includes(MANAGED_END)) errors.push(`${filename} is missing the managed protocol block.`);
  }
  if (!(await exists(path.join(root, ".codex", "hooks.json")))) warnings.push("Codex project hook is not installed.");
  if (!(await exists(path.join(root, ".claude", "settings.json")))) warnings.push("Claude project hook is not installed.");
  return { root, ok: errors.length === 0, errors, warnings, registryRevision: registry.revision, topicCount: Object.keys(registry.topics).length };
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const [rawKey, inline] = value.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (inline !== undefined) options[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) options[key] = argv[++index];
    else options[key] = true;
  }
  return { positional, options };
}

function printHelp() {
  console.log(`Markdown Gatekeeper (mdg)\n\n` +
    `Commands:\n` +
    `  mdg init [project] [--name NAME]\n` +
    `  mdg status [project]\n` +
    `  mdg scan [project]\n` +
    `  mdg resolve <topic> [--project PATH]\n` +
    `  mdg propose <file> [--topic ID] [--base-revision N] [--project PATH]\n` +
    `  mdg publish <file> --topic ID --approve [--base-revision N] [--project PATH]\n` +
    `  mdg sync [project]\n` +
    `  mdg check [project]\n`);
}

export async function runCli(argv) {
  const command = argv[0] || "help";
  const { positional, options } = parseArgs(argv.slice(1));
  if (["help", "--help", "-h"].includes(command)) return printHelp();
  if (command === "init") {
    const result = await initProject(positional[0] || process.cwd(), { name: options.name });
    console.log(`Initialized Markdown Gatekeeper at ${result.root}`);
    return;
  }
  const rootArg = options.project || (command === "resolve" || command === "propose" || command === "publish" ? process.cwd() : positional[0] || process.cwd());
  if (command === "sync") {
    const registry = await syncProject(rootArg);
    console.log(`Synchronized registry revision ${registry.revision}.`);
    return;
  }
  if (command === "scan") {
    const report = await scanProject(rootArg);
    console.log(JSON.stringify(report.counts, null, 2));
    console.log(`Report: ${path.join(await findProjectRoot(rootArg), ".authority", "reports", "LATEST.md")}`);
    return;
  }
  if (command === "propose") {
    if (!positional[0]) throw new Error("propose requires a Markdown file path.");
    const record = await proposeDocument(rootArg, positional[0], {
      topic: options.topic,
      title: options.title,
      baseRevision: options.baseRevision === undefined ? null : Number(options.baseRevision)
    });
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  if (command === "publish") {
    if (!positional[0]) throw new Error("publish requires a Markdown file path.");
    const result = await publishDocument(rootArg, positional[0], {
      topic: options.topic,
      title: options.title,
      target: options.target,
      owner: options.owner,
      baseRevision: options.baseRevision,
      approve: options.approve === true || options.approve === "true"
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === "resolve") {
    if (!positional[0]) throw new Error("resolve requires a topic query.");
    const result = await resolveTopic(rootArg, positional[0]);
    if (!result.matches.length) {
      console.log(`No current authority found for: ${positional[0]}`);
      process.exitCode = 2;
    } else {
      console.log(JSON.stringify(result.matches, null, 2));
    }
    return;
  }
  if (command === "check" || command === "status") {
    const result = await checkProject(rootArg);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}
