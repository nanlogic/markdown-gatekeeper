---
authority-topic: dogfood-policy
---

# Dogfood Policy

Markdown Gatekeeper must use its own authority workflow from the first usable version.

Claude and Codex must begin work by reading `PROJECT_AUTHORITY.md` and running `mdg status`. New architectural or product conclusions go through a proposal. Neither agent may directly edit the registry, generated authority index, or current documents.

The repository must remain local-first and must not require a remote Git host. Tests must prove that direct canonical tampering is detected and that both Claude and Codex receive the same current source map.

Dogfood success requires useful conflict detection without creating constant review overhead. Low-confidence semantic conflicts are reported to Wayne rather than silently merged.
