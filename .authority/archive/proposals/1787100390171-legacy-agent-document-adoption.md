---
authority-topic: legacy-agent-document-adoption
---

# Legacy Agent Document Adoption

Markdown Gatekeeper must be able to adopt an existing project whose Agent-facing Markdown is duplicated, contradictory, stale, or ambiguously scoped. Adoption is local-first and limited by default to Agent instructions, rules, memory, context, plan, and handoff documents. Ordinary product documentation, code documentation, and chat history are excluded unless explicitly included.

Authority is identified by directory scope plus topic. Root authority applies globally, while a deeper current document for the same topic overrides its parent. Topic owners approve their topics; the project owner handles unowned and cross-topic ambiguity. Review can be completed and applied independently per topic.

The system performs deterministic discovery, hashing, Git metadata collection, duplicate detection, and preliminary clustering. After the user explicitly approves sending the disclosed source list, an isolated Codex, Claude, or configured generic reviewer may extract claims, propose scopes, compare conflicts, and draft merged current documents. An LLM never publishes. The deterministic publisher validates structured decisions, stale hashes, paths, ownership, and registry state.

Every successful authority revision has a separate, non-normative Markdown Evidence record. Revision one is a complete baseline; later revisions contain only added, modified, wording-only, removed, superseded, or provenance-changed rule entries and link by hash to the preceding Evidence record. Stable rule identifiers connect current rules to their evidence. Normal `resolve` and `context` operations read current authority only; `explain` traverses Evidence on demand for troubleshooting or audit.

Current documents remain concise. Evidence records capture sources, archived paths and hashes, treatment, reasons, confidence, reviewer and publisher metadata, approval, and the current hash. Recency is only a weak signal and cannot establish authority by itself. Evidence explains why content was selected but does not confer authority; authority comes from the approved registry entry, verified current hash, and deterministic publish event.

Accepted legacy sources are moved, never destroyed, into `.authority/archive/legacy/<run-id>/<original-path>` with a manifest. Unresolved sources remain in place without becoming authority. Native entry files such as `AGENTS.md` and `CLAUDE.md` are archived and regenerated as short adapters after their valid rules are adopted. Restore is permitted only when recorded hashes and the current base remain safe; otherwise restored material becomes a proposal.

Publishing current, Evidence, registry, and audit events is one recoverable transaction. Evidence failure prevents publication. Evidence history is immutable; corrections are amendments. Integrity checks validate scoped resolution, current and Evidence hashes, Evidence-chain continuity, rule coverage, adoption manifests, adapters, and audit events. Existing schema-v1 topics migrate from matching events and archived proposals; incomplete provenance requires owner attestation.

The first release remains CLI- and Markdown-first. MCP, hosted services, vector databases, cryptographic team identity, and voting are deferred.
