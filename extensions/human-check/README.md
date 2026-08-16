# NODRA Human Check

**Stay in the loop while AI codes with you.**

NODRA Human Check is a free Visual Studio Code extension that helps you understand local code changes before accepting them.

It does not replace Copilot, Claude, Gemini, Codex, or any other coding assistant, and it is not an AI code reviewer. It works independently of how the changes were produced.

> **Before accepting AI-generated changes, make sure you understand what changed.**

## What it does

Run **`NODRA: Human Check Workspace`** from the Command Palette or click the discreet `+NODRA Human Check` item in the status bar.

Human Check then:

1. Reads your local Git working-tree changes.
2. Summarizes changed files and added/removed lines.
3. Flags path-based impact areas: API, authentication, data, dependencies, infrastructure, configuration, tests, and UI.
4. Opens the **+NODRA Human Signal** panel.
5. Asks you to explain what changed and complete an understanding checklist.
6. Records one of three results locally: `UNDERSTOOD`, `NEEDS_REVIEW`, or `REVISIT`.

## Human Signal questions

The workflow is designed around questions such as:

- What changed?
- Which parts of the architecture were affected?
- Were authentication, APIs, data, dependencies, or infrastructure changed?
- Can you explain why the change is needed?
- Do you understand the impact before accepting it?

## Privacy

**Your source code stays local.**

V0.1 intentionally includes:

- **No telemetry**
- **No account requirement**
- **No NODRA backend connection**
- **No cloud service**
- **No external HTTP requests**
- **No upload of source code, diffs, file contents, prompts, or workspace information**

Git is executed locally. The Webview loads no remote content and uses a restrictive Content Security Policy. Human Signal history is stored with VS Code's local extension storage.

## Requirements

- Visual Studio Code 1.100 or later
- Git available on the local system
- An open Git workspace

## Local development

```bash
npm install
npm run check
```

## Package a local VSIX

Use the official Visual Studio Code extension packaging tool:

```bash
npm install
npm run check
npx @vscode/vsce package
```

This produces `nodra-human-check-0.1.0.vsix` in this directory. Install that VSIX in Visual Studio Code and validate the command, status-bar entry, local Git summary, Human Signal flow, and local-only privacy behavior before publishing.

The Visual Studio Marketplace publisher **NODRA Network** is registered with the publisher identifier `nodra-network`, matching the `publisher` field in `package.json`.

## Independence

NODRA Human Check is a NODRA Network project. It is not affiliated with, endorsed by, or sponsored by Microsoft or by any AI coding-assistant provider.

## License

MIT. See [LICENSE](./LICENSE).
