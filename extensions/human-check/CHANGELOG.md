# Changelog

All notable changes to NODRA Human Check are documented here.

## 0.1.10 - 2026-08-16

### Added

- NODRA visual identity icon on the `+NODRA Human Signal` Webview tab.

## 0.1.9 - 2026-08-16

### Fixed

- Replaced the invalid packaged extension icon with a valid 128x128 PNG so NODRA branding renders correctly in Visual Studio Code.

## 0.1.8 - 2026-08-16

### Changed

- Introduced NODRA Network visual identity for the extension and Marketplace package.

## 0.1.7 - 2026-08-16

### Improved

- Human Signal history now refreshes immediately when a new Human Signal is recorded while the repository history is already open.

## 0.1.6 - 2026-08-16

### Added

- Repository-scoped Human Signal history.
- Local repository fingerprinting so records from different Git repositories are not mixed.
- `View history for this repository` inside Human Check.
- NODRA Network homepage metadata and documentation link.

### Privacy

- Repository identity remains local and is not sent to NODRA.
- Draft sessions are not silently stored; a Human Signal is stored only after explicit recording.

## 0.1.5 - 2026-08-16

### Changed

- Refined Human Signal guidance to be less corrective and more decision-oriented.
- Updated product signature to: `Built by NODRA Network · Human Signal for the AI Era · Guided by NODRA Protocol`.

## 0.1.4 - 2026-08-16

### Added

- Product-purpose explanation describing Human Check's role in AI-assisted development.
- Result-aware wording: `Points worth noting` / `Additional context` for `UNDERSTOOD` results.
- NODRA Network product signature in the Human Signal panel and Decision Record.

## 0.1.3 - 2026-08-16

### Added

- Dynamic `Review focus for this change` checks generated from locally detected Git-path impact areas.
- Area-specific confirmations for data, API, authentication, dependencies, infrastructure, configuration, tests, and UI when applicable.
- Review-focus evidence in Human Signal results and Decision Records.

### Changed

- Deep checks can return `NEEDS_REVIEW` when detected focus areas have not been explicitly reviewed.

## 0.1.2 - 2026-08-16

### Added

- `Understanding gaps` guidance based on local Git metadata, developer explanation cues, and understanding confirmations.
- Evidence explaining what supports each Human Signal result.
- Understanding notes and supporting evidence in exported Decision Records.

### Privacy

- Guidance remains local and does not perform semantic source-code verification or transmit source code.

## 0.1.1 - 2026-08-16

### Improved

- Adaptive `QUICK` / `DEEP` review recommendation.
- Attention level guidance.
- Focused display of the most relevant changed files in large repositories.
- Optional local NODRA Decision Record export in Markdown.

## 0.1.0 - 2026-08-16

### Added

- `NODRA: Human Check Workspace` command.
- Discreet status-bar entry.
- Local Git change analysis.
- Sensitive-area classification for API, authentication, data, dependencies, infrastructure, configuration, tests, and UI.
- File and line-change summary.
- `+NODRA Human Signal` Webview flow.
- Developer explanation and understanding checklist.
- `UNDERSTOOD`, `NEEDS_REVIEW`, and `REVISIT` outcomes.
- Local Human Signal history.
- Restrictive Webview Content Security Policy.
- Unit tests for local change-analysis logic.
- Explicit local-only privacy guarantees with no telemetry or NODRA backend connection.
