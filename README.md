# NODRA Developer Tools

Free, local-first developer tools from **NODRA Network** that help developers keep human judgment in AI-assisted development workflows.

## NODRA Human Check

> **Stay in the loop while AI codes with you.**

The first tool in this repository is **NODRA Human Check**, a free Visual Studio Code extension that helps a developer understand local code changes before accepting them.

It does **not** replace or review Copilot, Claude, Gemini, Codex, or any other coding assistant. It works from local Git changes regardless of which tool or person created them.

Core principle:

> Before accepting AI-generated changes, make sure you understand what changed.

### Privacy by design

- Source code stays local.
- No telemetry.
- No account required.
- No NODRA backend connection in V0.1.
- No code, diff, prompt, file content, or workspace data is sent to NODRA or any external service.

See [`extensions/human-check`](./extensions/human-check) for source, tests, packaging instructions, and the V0.1 changelog.

## Repository structure

```text
nodra-developer-tools/
├── docs/
└── extensions/
    └── human-check/
```

## License

MIT. See [LICENSE](./LICENSE).
