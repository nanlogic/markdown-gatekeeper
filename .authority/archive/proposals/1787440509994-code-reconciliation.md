---
authority-topic: code-reconciliation
authority-scope: .
authority-owner: Wayne
---

# Code Reconciliation

## Applies to

Managed projects in which implementation, tests, schemas, configuration, or scenes may be newer than Agent-facing Markdown.

## Current rules

- R-001 — Current authority represents declared intent; code reconciliation represents observed implementation. Neither may silently replace the other.
- R-002 — `mdg reconcile [path]` must create a non-normative implementation snapshot containing the Git commit, dirty state, applicable Current topics, and relevant code, test, schema, configuration, and scene files.
- R-003 — The first reconciliation for a scope must establish a baseline; later reconciliations should inspect committed and working-tree changes since the previous snapshot while retaining a link to the baseline report.
- R-004 — Reconciliation classifications are `aligned`, `code-ahead`, `doc-ahead`, `conflict`, and `unverifiable`. The deterministic CLI may report candidates but must not claim semantic alignment without reviewer evidence.
- R-005 — Code, tests, schemas, configuration, and scenes may be cited as Evidence with commit SHA, dirty state, path, hash, and reviewer confidence, but do not become normative Current merely because they are newer.
- R-006 — Tests, executable schemas, and effective configuration are stronger implementation signals than code comments or Markdown dates; dates alone never determine intent.
- R-007 — When a task depends on implemented behavior, the Codex Skill must run reconciliation and inspect the relevant implementation before planning or changing code.
- R-008 — High-confidence descriptive drift may produce a proposal automatically. Normative product conflicts, ambiguous intent, and deletions remain owner decisions.
- R-009 — Successful reconciliation is silent. The Agent surfaces only a material conflict, an implementation gap that affects the task, an integrity failure, or an explicit status request.

## Constraints

- R-010 — Reconciliation reports and caches are non-normative derived data under ignored `.authority/reports/` and `.authority/cache/`; normal runtime context must not load them unless the task depends on implementation behavior.
- R-011 — Reconciliation must exclude authority internals, dependencies, generated build output, binary assets, and unrelated Markdown.
- R-012 — Candidate collection must be bounded and report truncation rather than flooding the Agent context.

## Required checks

- R-013 — Tests must cover baseline and incremental snapshots, dirty and committed changes, scoped filtering, ignored files, bounded output, non-Git fallback, and proof that reconciliation never publishes Current.
- R-014 — Cross-platform integrity checks must treat LF and CRLF as equivalent for Gatekeeper-generated text and Agent-facing Markdown evidence while continuing to detect substantive changes.
