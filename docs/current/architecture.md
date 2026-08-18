---
authority-topic: architecture
---

# Architecture

The system has four roles:

1. Worker agents and humans create ordinary Markdown proposals.
2. An isolated LLM reviewer classifies topics, duplication, support, conflicts, and supersession.
3. A deterministic policy and publisher controls revisions and the current pointer.
4. The human owner decides ambiguous product intent.

`PROJECT_AUTHORITY.md` is the generated human entry point. `.authority/registry.json` is the machine-verifiable current map. `docs/current/` holds canonical Markdown, while `docs/proposals/` holds competing work.

Claude and Codex retain their native `CLAUDE.md` and `AGENTS.md` files. Each contains a small managed protocol block pointing to the same authority entry point.

Project-local PreToolUse hooks block accidental direct edits to protected authority files. A Git pre-commit hook validates hashes and generated state. These are guardrails; a separately privileged publisher identity is required for a hard multi-user security boundary.

MCP is deferred. The CLI is the core interface; an MCP server may later expose `resolve`, `propose`, `conflicts`, and `publish_request` without receiving direct canonical write authority.
