# Markdown Gatekeeper

Markdown Gatekeeper is a local-first authority layer for projects where humans, Claude, Codex, and other agents create overlapping Markdown documents.

It keeps ordinary Markdown and local Git. It adds one rule: a document does not become current authority merely because an agent calls it authoritative.

## Status

This repository is the first dogfood implementation. It intentionally has no cloud service and no MCP dependency.

## Quick start

```powershell
node .\bin\mdg.mjs status .
node .\bin\mdg.mjs scan .
node .\bin\mdg.mjs resolve architecture
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
- `docs/current/` contains published canonical Markdown.
- `docs/proposals/` contains competing work until review.
- Local Git records history and enables rollback.
- Claude and Codex project hooks block accidental direct edits to protected authority files.

The LLM acts as a semantic reviewer. The publisher, not the LLM, owns the state transition.

## Commands

| Command | Purpose |
|---|---|
| `mdg init` | Add the protocol and project-local hooks |
| `mdg status` | Validate the authority state |
| `mdg scan` | Inventory Markdown and surface duplicates or unmanaged claims |
| `mdg resolve` | Return the current source for a topic |
| `mdg propose` | Register a Markdown document as pending work |
| `mdg publish` | Publish an explicitly approved proposal |
| `mdg sync` | Regenerate adapters and authority index |
| `mdg check` | Detect direct edits and registry drift |

## Non-goals for V1

- Replacing Markdown or Git
- Automatically deciding ambiguous product intent
- Treating vector search as authority
- Requiring GitHub or any remote service
- Claiming hooks are an unbreakable security boundary

## License

Apache-2.0.
