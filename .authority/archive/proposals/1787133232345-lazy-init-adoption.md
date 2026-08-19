---
authority-topic: legacy-agent-document-adoption
authority-scope: .
authority-owner: Wayne
---

# Legacy Agent Document Adoption

## Current rules

- R-001 — `mdg init [project]` is the primary onboarding path: it initializes Gatekeeper, discovers legacy Agent-facing Markdown, asks at most one yes/no confirmation, then automatically reviews and applies safe high-confidence results.
- R-002 — `mdg init [project] --yes` provides the same end-to-end path without an interactive prompt for agents and automation; `--setup-only` preserves an initialization-only escape hatch.
- R-003 — The single confirmation must disclose the number of candidate files, the selected reviewer, and that accepted high-confidence sources may be archived and replaced by generated authority adapters.
- R-004 — Deterministic discovery must exclude obvious archives, generated Gatekeeper adapters, audit repair notes, current authority, proposals, ordinary README files, and repository-external or cross-project material by default.
- R-005 — Discovery must follow explicit local Markdown references from Agent entrypoints and process-rule documents so named authority sources are not omitted merely because their filenames lack Agent keywords.
- R-006 — The isolated reviewer classifies topics, scopes, sources, conflicts, and confidence. Reviewer output is untrusted structured input and never receives canonical write authority.
- R-007 — The deterministic autopublisher may accept only high-confidence drafts that are not marked as requiring owner judgment. Medium-confidence, low-confidence, conflicting, or malformed results remain unresolved and are never silently published.
- R-008 — One unresolved topic must not prevent independent safe topics from publishing. Unresolved source files remain in place and are summarized in the final adoption report.
- R-009 — If no supported reviewer is available, initialization still succeeds and reports one actionable blocker instead of requiring the user to learn the multi-command adoption workflow.
- R-010 — Re-running `mdg init` is idempotent for already managed projects: it must not create needless authority revisions or resend unchanged material.

## Evidence and recovery

- R-011 — Every automatically published authority revision uses the same immutable baseline/delta Evidence chain, source hashes, archive manifest, registry validation, and recoverable publisher transaction as an explicitly driven adoption.
- R-012 — Accepted legacy sources are moved, never destroyed, into `.authority/archive/legacy/<run-id>/<original-path>`. Sources shared with unresolved topics remain in place.
- R-013 — Native `AGENTS.md` and `CLAUDE.md` content is preserved until its accepted rules have been published, after which the original is archived and the entrypoint becomes a minimal generated adapter.
- R-014 — Normal Agent sessions read current authority only. Evidence remains audit-only and is traversed through `mdg explain` when needed.

## Scope and product boundaries

- R-015 — Authority is resolved by directory scope plus topic; deeper authority overrides a parent for the same topic.
- R-016 — Dates and apparent recency are supporting signals only and cannot establish authority by themselves.
- R-017 — The first release remains CLI- and Markdown-first. MCP, hosted services, vector databases, cryptographic team identity, and voting remain optional or deferred.
