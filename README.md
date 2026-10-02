# Agency Agents Router — PI-Desktop · Codex · Claude Code

Route work to one of **279 specialist personas across 18 divisions**. One offline
[agency-agents](https://github.com/msitarzewski/agency-agents) roster, one shared
search/inspect/load implementation, two host adapters: PI-Desktop and standard MCP.
Ported from the Hermes `agency-agents-router` plugin.

| Client / 客户端 | Integration / 接入方式 | Guide |
| --- | --- | --- |
| PI-Desktop, including Codex/Claude models inside PI | Native `.piplug`, no npm dependencies | [PI install](#pi-desktop-install) |
| Codex desktop / CLI / IDE extension | Local stdio MCP server + optional Skill | [Codex 接入](docs/codex.md) |
| Claude Code | Local stdio MCP server + optional Skill | [Claude Code 接入](docs/claude-code.md) |
| Other MCP clients | Standard `initialize`, `tools/list`, `tools/call` over stdio | Use `node /absolute/path/mcp-server.js` |

The existing PI plugin/package remains **1.0.0**; the new optional MCP integration
is **1.1.0**. The PI runtime and bundled expert data have not been replaced.

## Codex / Claude Code 快速开始

**不能把 PI 的 `.piplug` 直接装进 Codex 或 Claude Code。** 使用这里新增的 MCP 入口。
需要 Node.js **20.19+**（推荐 24 LTS），不需要额外 API Key：

```sh
git clone https://github.com/Fooljack/agency-agents-router-for-pi.git
cd agency-agents-router-for-pi
npm ci --ignore-scripts
node mcp-server.js --version
```

生成当前机器的配置，自动填入 Node 和服务的绝对路径：

```sh
# Codex: merge the printed TOML section into ~/.codex/config.toml
node scripts/print-config.js codex

# Claude Code: merge the printed JSON into the target project's .mcp.json
node scripts/print-config.js claude-code
```

配置脚本**只打印，不写客户端配置**。不要覆盖原配置中的模型、供应商或其他 MCP；
已有同名条目时更新它，不要重复添加。移动仓库或 Node 后需要重新生成路径。

也可以用客户端 CLI 注册（替换成实际绝对路径；Windows 路径有空格时保留引号）：

```sh
codex mcp add agency-agents -- node "/absolute/path/agency-agents-router-for-pi/mcp-server.js"
claude mcp add --transport stdio --scope user agency-agents -- node "/absolute/path/agency-agents-router-for-pi/mcp-server.js"
```

在客户端重启服务或新建会话后，要求模型搜索“前端性能优化”，再加载 `frontend-developer`。
桌面端找不到 PATH 里的 `node` 时，使用配置脚本生成的 Node 完整路径。
stdio 服务由客户端自动启动；不要预先启动一个后台 HTTP 服务，也不要把 npm 的终端横幅混入 stdout。

详细的桌面端步骤、PowerShell 命令、验证和移除方法：
**[Codex](docs/codex.md)** · **[Claude Code](docs/claude-code.md)**。

### 可选 Skill / Optional Skill

共用 Skill 位于 [`integrations/skills/agency-agents-router/SKILL.md`](integrations/skills/agency-agents-router/SKILL.md)。
把整个 `agency-agents-router` 文件夹复制到其中一个客户端 Skill 目录：

- Codex：`~/.agents/skills/`，或目标项目的 `.agents/skills/`。
- Claude Code：`~/.claude/skills/`，或目标项目的 `.claude/skills/`。

只安装 Skill 不会注册 MCP 工具。先连接 MCP，再安装 Skill；不要覆盖需要保留的同名技能。
PI 自带的 `skills/agency-agents-router.md` 继续由 PI 插件加载，不需要替换。

## PI-Desktop install

1. Download [`dist/com.fooljack.agency-agents-router-1.0.0.piplug`](dist/com.fooljack.agency-agents-router-1.0.0.piplug).
2. In PI-Desktop, open **插件 / Plugins → ⋯ → 安装插件包 / Install package** and select the file.
3. The native tools become available to the selected model. **Do not run `npm ci` for the PI package.**

From source, use **Plugins → Load development plugin**. Native plugin packaging
must use PI-Desktop's `PluginCheck` and `PluginPack`, never a hand-made ZIP.
The MCP dependencies are not needed by the PI entry point; do not bundle
`node_modules` into a PI package. Existing PI installations keep working unchanged.

## Tools

| Tool | Arguments | Returns |
| --- | --- | --- |
| `agency_agents_search` | `query?`, `division?`, `limit?` (integer 1–25; default 8) | Ranked slug/name/division/description plus keyword expansions |
| `agency_agents_inspect` | `agent` or `slug`; `include_body?` (default false) | Metadata; optional body preview capped at 20,000 characters |
| `agency_agents_load` | `agent` or `slug`; `task?` | Specialist instructions with an adoption preamble, capped at 32,000 characters |

MCP clients may prefix tool names with the server name. Use the names shown in
that client's tool list. Missing/unknown specialists return actionable tool errors;
MCP arguments are validated against the same JSON schemas the PI tools publish.

```text
agency_agents_search { "query": "前端性能优化", "limit": 3 }
agency_agents_inspect { "agent": "frontend-developer" }
agency_agents_load { "agent": "frontend-developer", "task": "检查当前项目页面性能" }
```

Search is lexical and offline: no embeddings and no model API calls. Ranking
keeps the Hermes weights (`+5` substring, `+3` name hit, `+1.5` description hit,
`+1` per shared token, `+1/√tokens` to prefer focused bodies).

Chinese queries use a keyword bridge, e.g. `抖音投放 → paid / campaign / ads / advertising`.
`division` accepts keys (`paid-media`), labels (`Paid Media`), subdivisions
(`unity`, `godot`, `unreal-engine`, `blender`, `roblox-studio`), and Chinese aliases
such as `工程`, `设计`, `投放`, `财务`, `游戏`, `安全`.
Unknown divisions are reported explicitly rather than silently treated as a valid filter.

## Boundaries / 能力边界

- `load` returns **third-party reference text**, not a system instruction or an
  executable agent. User and higher-priority host instructions take precedence.
- No `agency_agents_delegate`: this distribution does not spawn subagents or
  switch models. Host-native delegation remains the host's responsibility.
- The router does not install Office/PDF engines or bypass client permissions.
- The three tools do not write files, execute shell commands, make network
  requests, or need credentials. They read the bundled ~3.9 MB roster locally.
- Dependency installation needs npm access. The host's model calls can still
  consume its normal API quota; the router does not make extra model calls.
- PI permissions remain `agent.tool.register` and `agent.prompt.inject`.
  MCP tools advertise `readOnlyHint`, `idempotentHint` and closed-world behaviour.

## Development and tests

```sh
npm ci --ignore-scripts
npm test

# Original roster tests and PI lifecycle tests do not need MCP dependencies:
node --test tests/roster.test.js tests/pi-host.test.js

# Rebuild the bundled data only when intentionally updating upstream:
node build-roster.js /path/to/agency-agents
```

Tests include a real stdio MCP client, legacy protocol negotiation, Chinese
routing, identical PI/MCP results, invalid arguments, truncation, independent
concurrent calls, JSON-only stdout, clean EOF shutdown, portable configuration,
and a PI-only deployment with no SDK dependency.
CI runs the suite on Windows, macOS and Linux with Node 20 and 24.

```text
main.js                         existing PI registration + shared tool handlers
manifest.json                   existing PI native manifest
lib/roster.js                   shared ranking, lookup and prompt composition
lib/mcp.js                      MCP adapter + schema validation
mcp-server.js                   MCP stdio entry (diagnostics go to stderr)
scripts/print-config.js         absolute-path TOML / JSON generator, no writes
data/agents.json                279 bundled personas, unchanged
skills/agency-agents-router.md  PI-hosted skill, unchanged
integrations/skills/            portable Codex / Claude Code Skill
docs/                          client-specific setup and troubleshooting
tests/                         roster, PI, MCP and configuration tests
```

The MCP adapter uses the official
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)
(MIT), pinned in `package-lock.json`; it is installed through npm, not vendored
into the native PI plugin.
See [CHANGELOG.md](CHANGELOG.md) for integration changes.

## License

Plugin and adapter code: MIT © 2026 Fooljack. Bundled roster: MIT © 2025 AgentLand
Contributors. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
