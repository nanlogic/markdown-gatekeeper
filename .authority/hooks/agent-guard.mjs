#!/usr/bin/env node

import process from "node:process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input = {};
try {
  input = raw.trim() ? JSON.parse(raw) : {};
} catch {
  process.exit(0);
}

const toolName = String(input.tool_name || "");
const toolInput = input.tool_input || {};
const serialized = JSON.stringify(toolInput).replace(/\\\\/g, "/").toLowerCase();
const protectedPatterns = [
  "project_authority.md",
  ".authority/registry.json",
  "docs/current/"
];

const touchesProtected = protectedPatterns.some((pattern) => serialized.includes(pattern));
const invokesPublisher = /(?:^|[\\/\s])(?:node\s+[^\s]*mdg\.mjs|mdg)(?:\s+)(?:publish|sync|init)(?:\s|$)/i.test(
  String(toolInput.command || "")
);

if (touchesProtected && !invokesPublisher) {
  const reason = "Markdown Gatekeeper blocked a direct authority edit. Write a proposal and use mdg publish/sync.";
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  }));
}
