# NODRA Human Check V0.1

## Product intent

NODRA Human Check keeps the developer cognitively inside an AI-assisted coding process. It analyzes only local Git metadata and asks the developer to explain and acknowledge the impact of the changes before recording a local Human Signal.

It is intentionally **not an AI code reviewer**.

## Flow

```text
AI / developer modifies code
        ↓
NODRA reads local Git changes
        ↓
Impact summary + sensitive areas
        ↓
Developer explains what changed
        ↓
Understanding checklist
        ↓
Local Human Signal
(UNDERSTOOD / NEEDS_REVIEW / REVISIT)
```

## Sensitive areas detected

Path-based rules classify changes into:

- API
- authentication
- data
- dependencies
- infrastructure
- configuration
- tests
- UI

The classifier does not inspect or transmit source contents.

## Privacy model

V0.1 has no network client, telemetry library, cloud SDK, backend integration, analytics endpoint, login, or remote resource in its Webview. Git is invoked locally. Human Signal history is stored through VS Code's local extension storage.
