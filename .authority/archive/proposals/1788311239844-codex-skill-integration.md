# Agent Host Skill Integration

## Applies to

Codex and Claude Code tasks on a computer where Markdown Gatekeeper is installed. Each supported host has an id (`codex`, `claude`), a home directory (`~/.codex`, `~/.claude`), and a global instruction file (`AGENTS.md`, `CLAUDE.md`).

## Current rules

- R-001 — The npm package must ship the `mdg` CLI and the matching `markdown-gatekeeper` Skill; the CLI remains the deterministic execution and publishing layer. One bundled Skill serves every supported host and must not contain host-specific commands that are wrong in another host.
- R-002 — `mdg setup <host>` must install or update the bundled Skill, a managed Markdown Gatekeeper bootstrap block in that host's global instruction file, and a stable launcher under that host's home directory. `mdg setup codex` and `mdg setup claude` differ only by host, never by capability.
- R-003 — At the start of every new task, the bootstrap must search upward from the working directory for both `PROJECT_AUTHORITY.md` and `.authority/registry.json`; when found, it must invoke the Skill and load status plus applicable scoped current authority before planning or implementation.
- R-004 — A managed project must activate automatically without asking whether to use Gatekeeper. An unmanaged project must not be initialized, modified, or repeatedly prompted unless the user explicitly asks to use Gatekeeper.
- R-005 — Updating the bootstrap must preserve all unrelated user instructions and replace only the Markdown Gatekeeper managed block. An older unmarked Markdown Gatekeeper auto-detection section may be migrated into the managed block.
- R-006 — The Skill must try global `mdg` first. If it is unavailable, it must use the managed launcher under the current host's home directory before considering a verified repository-local `node ./bin/mdg.mjs`; it must never generate a predictable failed command merely to probe availability.
- R-007 — The Skill may guide proposal, adoption, explanation, and publication workflows but cannot grant approval, send documents without the authorization established by the active workflow, or write canonical authority directly.
- R-008 — New tasks discover the installed bootstrap and Skill automatically. Already-running tasks may retain their startup snapshot and require a new task before updated bootstrap behavior appears.
- R-013 — Successful bootstrap, status, context loading, reviewer selection, and zero-touch adoption are silent housekeeping. The Agent must not narrate Skill activation, internal commands, run IDs, fallback mechanics, or authority loading in routine commentary.
- R-014 — When tool-use policy requires an initial progress update, the Agent must combine bootstrap with the actual user task in one short outcome-oriented sentence, such as checking project rules and the relevant implementation; it must not emit separate Gatekeeper progress messages.
- R-015 — Gatekeeper becomes user-visible only when it blocks the requested task, needs owner judgment, detects integrity failure, or the user explicitly asks about Gatekeeper status.
- R-016 — The managed launcher must use absolute package and Node paths so GUI sessions work even when macOS does not expose npm's global executable directory through `PATH`.
- R-017 — Project installation writes a project hook for every supported host, and each generated project entrypoint carries the bootstrap block written for its own host.

## Constraints

- R-009 — Installation must refuse to overwrite an unmanaged Skill or launcher unless `--force` is explicit.
- R-010 — MCP remains optional and is not required for automatic session behavior in any host.
- R-018 — Installing one host must not create, modify, or claim another host's home directory, global instruction file, or launcher.

## Required checks

- R-011 — `mdg setup status` must report CLI version, Skill version, Skill path, stable launcher path, global instruction file path, and whether the global bootstrap and launcher are installed, for every supported host.
- R-012 — Tests must prove, for each supported host, that installation is idempotent, preserves unrelated global instructions, migrates the prior unmarked block, leaves unmanaged projects untouched, installs quiet zero-touch bootstrap instructions, and creates a working stable launcher without relying on the caller's `PATH`.
