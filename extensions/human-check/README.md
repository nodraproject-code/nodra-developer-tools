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

To build a VSIX locally:

```bash
npm run compile
npx vsce package
```

The Marketplace publisher identifier in `package.json` is currently `nodra-network`. Before publishing, the NODRA Network publisher must exist in Visual Studio Marketplace under that exact identifier, or `publisher` must be adjusted to the identifier actually created.

## Independence

NODRA Human Check is a NODRA Network project. It is not affiliated with, endorsed by, or sponsored by Microsoft or by any AI coding-assistant provider.

## License

MIT. See [LICENSE](./LICENSE).
