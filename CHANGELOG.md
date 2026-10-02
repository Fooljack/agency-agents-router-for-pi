# Changelog

## MCP integration 1.1.0

- Add a local stdio MCP server for Codex desktop/CLI/IDE, Claude Code and other MCP clients.
- Reuse all three PI tool schemas and handlers; keep the 279-persona roster and ranking unchanged.
- Validate MCP arguments and return standard text/structured results, actionable errors and read-only annotations.
- Add an absolute-path Codex TOML / Claude Code JSON generator that never writes client settings.
- Add a shared optional Agent Skill and Chinese setup/troubleshooting guides for both clients.
- Test real MCP subprocesses, older protocol negotiation, errors, Unicode/space-containing paths and PI compatibility.
- Add Windows/macOS/Linux CI with Node 20 and 24.

The existing PI adapter, `manifest.json` and `1.0.0.piplug` remain unchanged.
MCP npm dependencies are optional and are not required by native PI installations.

## PI plugin 1.0.0

- Port the Hermes router's search, inspect and load tools to PI-Desktop.
- Bundle 279 specialists across 18 divisions in one JSON roster.
- Add Chinese keyword expansion and division aliases.
- Preserve specialist prompts as reference material, not host instructions.
