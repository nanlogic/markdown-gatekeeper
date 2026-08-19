---
authority-topic: codex-skill-integration
---

# Codex Skill Integration

## Applies to

Codex tasks on a computer where Markdown Gatekeeper is installed.

## Current rules

- R-001 — The npm package must ship the `mdg` CLI and the matching `markdown-gatekeeper` Codex Skill; the CLI remains the deterministic execution and publishing layer.
- R-002 — `mdg setup codex` must install or update both the bundled Skill and a managed Markdown Gatekeeper bootstrap block in the user's Codex `AGENTS.md`.
- R-003 — At the start of every new Codex task, the bootstrap must search upward from the working directory for both `PROJECT_AUTHORITY.md` and `.authority/registry.json`; when found, it must invoke the Skill and load status plus applicable scoped current authority before planning or implementation.
- R-004 — A managed project must activate automatically without asking whether to use Gatekeeper. An unmanaged project must not be initialized, modified, or repeatedly prompted unless the user explicitly asks to use Gatekeeper.
- R-005 — Updating the bootstrap must preserve all unrelated user instructions and replace only the Markdown Gatekeeper managed block. An older unmarked Markdown Gatekeeper auto-detection section may be migrated into the managed block.
- R-006 — The Skill must use global `mdg` when available and may fall back to `node ./bin/mdg.mjs` inside the CLI repository. Missing execution support must be reported instead of bypassing authority.
- R-007 — The Skill may guide proposal, adoption, explanation, and publication workflows but cannot grant approval, send documents without explicit disclosure approval, or write canonical authority directly.
- R-008 — New Codex tasks discover the installed bootstrap and Skill automatically. Already-running tasks may require a new task or explicit `$markdown-gatekeeper` invocation.

## Constraints

- R-009 — Installation must refuse to overwrite an unmanaged Skill unless `--force` is explicit.
- R-010 — MCP remains optional and is not required for automatic Codex session behavior.

## Required checks

- R-011 — `mdg setup status` must report CLI version, Skill version, Skill path, global `AGENTS.md` path, and whether the global bootstrap is installed.
- R-012 — Tests must prove that installation is idempotent, preserves unrelated global instructions, migrates the prior unmarked block, and leaves unmanaged projects untouched.
