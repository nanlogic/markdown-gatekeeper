---
authority-topic: codex-skill-integration
authority-scope: .
authority-owner: Wayne
authority-revision: 3
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
- R-006 — The Skill must use global `mdg` directly. It may fall back to `node ./bin/mdg.mjs` only after the global command is unavailable and the local file is verified to exist; it must never generate a predictable failed command merely to probe availability.
- R-007 — The Skill may guide proposal, adoption, explanation, and publication workflows but cannot grant approval, send documents without the authorization established by the active workflow, or write canonical authority directly.
- R-008 — New Codex tasks discover the installed bootstrap and Skill automatically. Already-running tasks may retain their startup snapshot and require a new task before updated bootstrap behavior appears.
- R-013 — Successful bootstrap, status, context loading, reviewer selection, and zero-touch adoption are silent housekeeping. The Agent must not narrate Skill activation, internal commands, run IDs, fallback mechanics, or authority loading in routine commentary.
- R-014 — When tool-use policy requires an initial progress update, the Agent must combine bootstrap with the actual user task in one short outcome-oriented sentence, such as checking project rules and the relevant implementation; it must not emit separate Gatekeeper progress messages.
- R-015 — Gatekeeper becomes user-visible only when it blocks the requested task, needs owner judgment, detects integrity failure, or the user explicitly asks about Gatekeeper status.

## Constraints

- R-009 — Installation must refuse to overwrite an unmanaged Skill unless `--force` is explicit.
- R-010 — MCP remains optional and is not required for automatic Codex session behavior.

## Required checks

- R-011 — `mdg setup status` must report CLI version, Skill version, Skill path, global `AGENTS.md` path, and whether the global bootstrap is installed.
- R-012 — Tests must prove that installation is idempotent, preserves unrelated global instructions, migrates the prior unmarked block, leaves unmanaged projects untouched, and installs quiet zero-touch bootstrap instructions.
