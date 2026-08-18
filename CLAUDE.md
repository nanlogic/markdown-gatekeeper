# Claude Instructions

<!-- markdown-gatekeeper:managed:start -->
## Markdown Gatekeeper protocol

This project dogfoods Markdown Gatekeeper. Before planning or implementation:

1. Read `PROJECT_AUTHORITY.md` and the current sources it names.
2. Run `node ./bin/mdg.mjs status .` when this repository contains the CLI; otherwise run `mdg status .`.
3. Treat unregistered Markdown as a proposal, never as current authority.
4. Put competing designs in `docs/proposals/`; do not create a second canonical source.
5. Never edit `PROJECT_AUTHORITY.md`, `.authority/registry.json`, or `docs/current/**` directly. Use the publisher command.
6. Run `node ./bin/mdg.mjs check .` before declaring authority-related work complete.

The LLM is a reviewer. The deterministic publisher controls current authority. Low-confidence product conflicts require the human owner.
<!-- markdown-gatekeeper:managed:end -->
