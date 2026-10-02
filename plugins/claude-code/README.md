# Agency Agents Router — Claude Code

Version: 1.2.0. Generated from the shared repository; do not hand-edit this directory.

Requires Node.js 20.19+ on the client's PATH (Node 24 LTS recommended). All npm runtime
dependencies and the 279-persona roster are already included. No npm install,
postinstall hook, extra API key, network port or background terminal is needed.

Installing/enabling the plugin registers three read-only MCP tools and the route Skill.
Do not separately register the router MCP server or copy the standalone Skill.
After installing this plugin, skip all standalone MCP/Skill setup steps.
Use `/agency-agents-router:route` followed by your task, or ask Claude to use Agency Agents Router.
The model searches, optionally inspects, then loads one expert's reference instructions.
It still uses the host's own permissions and execution tools; no independent subagent is created.

Full installation, update and troubleshooting guide: https://github.com/Fooljack/agency-agents-router-for-pi/blob/main/docs/claude-code.md

## Choose one setup per client

| Route | Required setup | Skill |
| --- | --- | --- |
| A. Native plugin (recommended) | Install only this plugin; MCP is registered automatically | route is already included |
| B. Standalone MCP | Do not enable this plugin; register the standalone MCP server | Optional; MCP tools work without it |

A Skill alone is not a runnable integration and cannot replace the MCP server.
Do not enable both router routes in the same client. Review and remove only the
older router entries if migrating; leave other servers and skills alone.

BUNDLE.json lists SHA-256 hashes for the generated files (integrity checks, not a signing certificate).
LICENSE and THIRD_PARTY_NOTICES.md cover the router and roster.
runtime/THIRD_PARTY_LICENSES.txt contains the licenses for the bundled JavaScript dependencies.
