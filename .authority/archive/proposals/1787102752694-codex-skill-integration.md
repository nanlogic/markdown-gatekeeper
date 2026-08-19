---
authority-topic: codex-skill-integration
---

# Codex Skill Integration

Markdown Gatekeeper should ship a Codex Skill alongside its npm CLI. The CLI remains the deterministic execution and publishing layer; the Skill teaches Codex when and how to invoke it, keeps routine authority discovery automatic, and preserves user approval boundaries.

The npm package includes `skills/markdown-gatekeeper/`. `mdg setup codex` installs or updates that bundled Skill in the current user's Codex skills directory, while `mdg setup status` reports the CLI and Skill installation state. Installation must not initialize unrelated projects or overwrite an unmanaged skill without an explicit force option.

The Skill activates when a project contains `PROJECT_AUTHORITY.md` and `.authority/registry.json`, or when a user explicitly asks to initialize, adopt, resolve, explain, or publish with Markdown Gatekeeper. It runs `mdg status` and scoped `mdg context`, reads only applicable current authority during normal work, treats Evidence as audit-only, and never bypasses proposal, owner, disclosure, or publish approval requirements.

If the global `mdg` command is unavailable but the active repository contains `bin/mdg.mjs`, the Skill may use `node ./bin/mdg.mjs`. A new Codex session discovers the installed Skill automatically; an already-running session may require a new task or explicit `$markdown-gatekeeper` invocation.

The Skill contains no MCP server and receives no direct canonical write authority. MCP remains an optional later interface over the same CLI and publisher rules.
