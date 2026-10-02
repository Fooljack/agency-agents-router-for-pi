# Changelog

## Native Codex / Claude Code plugins 1.2.0

- Add installable Codex and Claude Code plugin directories, each with an automatically registered stdio MCP server and a `route` Skill.
- Publish separate marketplace catalogs under `.agents/plugins/` and `.claude-plugin/`, sharing the `agency-agents-router@fooljack-agency` install id.
- Include the SDK, runtime dependencies and 279-persona roster in each plugin. End users need Node.js 20.19+ on PATH, but no npm install, build step, extra API key or manual Skill copy.
- Use `${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}` so installed cache directories do not depend on the source checkout. Include Codex Agent Plugins 1.0.0 manifests and compatibility declarations.
- Generate plugins reproducibly with pinned esbuild; include complete dependency licenses and SHA-256 inventories. No installation hooks or runtime downloads.
- Preflight the MCP roster through the shared handler, avoiding a second asset-path assumption when bundled.
- Add tests for both copied plugin distributions, blocked external npm imports, Unicode/space-containing paths, inventory hashes and build reproducibility. Make CI explicitly install development build tools.
- Document marketplace installation, verification, update, removal and migration from standalone MCP/Skill setup. Keep standalone MCP available.

The PI adapter, PI manifest, original PI Skill, shared ranking/data and `1.0.0.piplug` remain unchanged.
Native plugin packaging does not create independent agents or expand host permissions.

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
