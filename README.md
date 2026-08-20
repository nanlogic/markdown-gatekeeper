# Markdown Gatekeeper

Markdown Gatekeeper is a local-first authority layer for projects where humans, Claude, Codex, and other agents create overlapping Markdown documents.

It keeps ordinary Markdown and local Git. It adds one rule: a document does not become current authority merely because an agent calls it authoritative.

## Status

This repository is the first dogfood implementation. It intentionally has no cloud service and no MCP dependency.

## Quick start

Install the CLI and its paired Codex Skill:

```powershell
npm install -g markdown-gatekeeper
mdg setup codex
mdg setup status
```

During local development, use `npm link` in this repository instead of installing from the registry. `mdg setup codex` copies the bundled Skill into `$CODEX_HOME/skills/markdown-gatekeeper` (or `~/.codex/skills/markdown-gatekeeper`), installs a stable launcher under `$CODEX_HOME/bin`, and maintains a bounded bootstrap block in `$CODEX_HOME/AGENTS.md`. The launcher uses absolute Node and package paths, so Codex GUI sessions on macOS do not depend on npm's global executable directory being present in `PATH`. Every new Codex task then detects managed projects and invokes the Skill automatically, while unrelated global instructions and unmanaged projects are left alone.

Initialize and organize an existing project with one command:

```powershell
mdg init .
```

`mdg init .` is zero-touch: it completes discovery, review, safe high-confidence publication, archiving, Evidence, and integrity checks without another confirmation. It prefers an isolated Codex CLI, enforces a three-minute reviewer timeout, and falls back to the current Codex Session when that CLI cannot run; cross-vendor reviewers are later fallbacks. `--preview` performs classification and archive-risk reporting without review or publication, while `--setup-only` installs only the protocol.

After installation, routine Codex Sessions use Gatekeeper silently. If a managed project still has registry revision zero or pending legacy entrypoints, Session bootstrap automatically resumes adoption. Successful housekeeping is not shown to the user; owner buttons appear only when the current task actually depends on unresolved product intent. Bootstrap calls the installed global `mdg` command directly and only uses a verified repository-local fallback, so normal Sessions do not display avoidable failed-command detours.

```powershell
node .\bin\mdg.mjs status .
node .\bin\mdg.mjs scan .
node .\bin\mdg.mjs context services\api
node .\bin\mdg.mjs resolve architecture --path services\api
```

Create and publish a proposal:

```powershell
node .\bin\mdg.mjs propose docs\proposals\my-change.md --topic architecture
node .\bin\mdg.mjs publish docs\proposals\my-change.md --topic architecture --base-revision 1 --approve
node .\bin\mdg.mjs check .
```

`--approve` is an explicit workflow acknowledgement, not a security credential. Strong multi-user enforcement will require a separately privileged publisher identity.

## Authority model

- `PROJECT_AUTHORITY.md` is the generated human-readable entry point.
- `.authority/registry.json` is the deterministic current pointer map.
- `.authority/evidence/` contains immutable, non-normative audit records. Revision one is a baseline; later records contain only changed rules.
- `docs/current/` contains published canonical Markdown.
- `docs/proposals/` contains competing work until review.
- Local Git records history and enables rollback.
- Claude and Codex project hooks block accidental direct edits to protected authority files.

The LLM acts as a semantic reviewer. The publisher, not the LLM, owns the state transition.

## Commands

| Command | Purpose |
|---|---|
| `mdg init` | Initialize and automatically adopt safe legacy authority |
| `mdg status` | Validate the authority state |
| `mdg scan` | Inventory Markdown and surface duplicates or unmanaged claims |
| `mdg resolve` | Return the current source for a topic |
| `mdg context` | Return the deepest applicable authority for every topic at a path |
| `mdg explain` | Trace a rule through its on-demand Evidence chain |
| `mdg evidence amend` | Append a non-destructive correction to Evidence |
| `mdg propose` | Register a Markdown document as pending work |
| `mdg publish` | Publish an explicitly approved proposal |
| `mdg adopt` | Discover, review, decide, apply, and restore legacy Agent documents |
| `mdg owner set` | Assign a per-scope topic owner with Git identity audit |
| `mdg doctor reviewers` | Check Codex, Claude, and configured reviewer adapters |
| `mdg setup codex` | Install or update the CLI-matched Codex Skill |
| `mdg setup status` | Report CLI and Codex Skill versions and paths |
| `mdg sync` | Regenerate adapters and authority index |
| `mdg check` | Detect direct edits and registry drift |

## Adopt an existing project

The default path is `mdg init .`. It discovers likely Agent-facing documents, follows their explicit Markdown authority references, excludes obvious archives and audit noise, then asks one yes/no question before review. High-confidence topics publish automatically; ambiguous topics remain unresolved and their files stay in place.

The lower-level workflow remains available for debugging and expert control:

```powershell
mdg adopt start .
mdg adopt report adopt-RUN-ID
```

When `mdg init` finds an existing unmanaged `AGENTS.md` or `CLAUDE.md`, it leaves the file byte-for-byte unchanged and marks it pending adoption. The managed adapter is installed only after the relevant legacy decisions are resolved and applied.

The report lists every candidate source. A manually driven review still requires explicit disclosure approval:

```powershell
mdg adopt review adopt-RUN-ID --reviewer codex --approve-send
mdg adopt report adopt-RUN-ID
mdg adopt decide adopt-RUN-ID DECISION-ID --accept-draft
mdg adopt apply adopt-RUN-ID --decision DECISION-ID
```

Use `--select S-001` to keep a single source or `--unresolved` to defer a topic. Applied legacy files move to `.authority/archive/legacy/`; `mdg adopt restore` verifies their hashes before restoring them. `AGENTS.md` and `CLAUDE.md` are replaced by short authority adapters only after all rules using that source are resolved.

Isolated Codex and Claude adapters run without repository write tools or persistent reviewer sessions. The current-Session fallback receives an explicitly delimited untrusted-source bundle and can only submit schema-validated review data; the deterministic publisher retains canonical write control. A generic command can be configured locally in `.authority/local/reviewers.json`; repository content cannot define a command that Gatekeeper executes.

Each adoption run pins its CLI, Skill protocol, adoption protocol, and reviewer schema versions and permits only one mutating operation at a time. External reviewers time out after three minutes by default. Unresolved topics are returned by `mdg adopt owner-review` in batches of up to three button questions; `mdg adopt owner-apply` validates and publishes the owner's selections without requiring typed IDs.

## Evidence

Every publish atomically creates current authority and an Evidence revision. Current rules use stable `R-001` identifiers. Unchanged rules are not copied into later Evidence deltas:

```powershell
mdg explain testing --path services\api --item R-001
mdg explain testing --path services\api --item R-001 --history
mdg evidence amend testing --path services\api --item R-001 --reason "Corrected source mapping" --approve
```

Routine `context` and `resolve` operations do not read Evidence. Evidence explains provenance and approval but does not confer authority; registry selection, current hashes, and deterministic publish events do.

## Non-goals for V1

- Replacing Markdown or Git
- Automatically deciding ambiguous product intent
- Treating vector search as authority
- Requiring GitHub or any remote service
- Claiming hooks are an unbreakable security boundary

## License

Apache-2.0.
