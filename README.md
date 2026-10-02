# Agency Agents Router — PI-Desktop · Codex · Claude Code

Route work to one of **279 specialist personas across 18 divisions**. One offline
[agency-agents](https://github.com/msitarzewski/agency-agents) roster, one shared
search/inspect/load implementation. Ported from the Hermes `agency-agents-router` plugin.

| Client / 客户端 | Recommended integration / 推荐接入方式 | Guide |
| --- | --- | --- |
| PI-Desktop, including Codex/Claude models inside PI | Native `.piplug` | [PI install](#pi-desktop-install) |
| Codex with plugin support | Native plugin: bundled MCP runtime + `route` Skill | [Codex 安装](docs/codex.md) |
| Claude Code | Native plugin: bundled MCP runtime + `route` Skill | [Claude Code 安装](docs/claude-code.md) |
| Older Codex clients / other MCP clients | Standalone stdio MCP, optional Skill | [MCP 直连](#standalone-mcp--独立接入) |

Codex / Claude Code 原生插件与 MCP 版本为 **1.2.0**。
已有 PI 插件及 `.piplug` 保持 **1.0.0**，PI 运行逻辑和专家库不变。

## Codex / Claude Code 快速安装

需要 Node.js **20.19+** 在客户端的 PATH 中，推荐 Node 24 LTS。
插件已经包含 npm 运行依赖和专家库，**安装后无需 `npm install` / `npm ci`，也无需手动复制 Skill**。
下载和更新插件需要网络；Router 的检索、查看和加载操作离线运行，不需要额外 API Key。

### Codex

在支持 `codex plugin` 的版本中执行（已验证 CLI 0.160.0）：

```sh
codex plugin marketplace add Fooljack/agency-agents-router-for-pi
codex plugin add agency-agents-router@fooljack-agency
```

新建会话，选择插件的 `route` Skill，或直接要求 Codex 使用 Agency Agents Router。
旧版本没有插件入口时，升级客户端或使用 [MCP 直连](docs/codex.md#standalone-mcp)。
桌面端的插件入口与组织策略可能不同，详见 [Codex 指南](docs/codex.md)。

### Claude Code

```sh
claude plugin marketplace add Fooljack/agency-agents-router-for-pi
claude plugin install agency-agents-router@fooljack-agency --scope user
```

新建会话，使用：

```text
/agency-agents-router:route 为当前项目选择一位前端专家，先检查性能问题，不修改文件。
```

完整验证、更新和移除步骤见 [Claude Code 指南](docs/claude-code.md)。

这两个入口分别读取仓库的 `.agents/plugins/marketplace.json` 和 `.claude-plugin/marketplace.json`。
它们是本仓库提供的自定义市场，不代表被收录到客户端的官方市场。
**PI 的 `.piplug` 不能直接安装到 Codex 或 Claude Code。**

### 从旧 MCP / Skill 接入迁移

先检查当前配置，避免新插件与旧 Router 同时注册。只移除自己曾添加的
`agency-agents` MCP 条目和 `agency-agents-router` 独立 Skill，再安装插件。
不要删除其他 MCP、Skill、模型或供应商配置。两端指南保留了按作用域移除的方法。

## Standalone MCP / 独立接入

不使用插件时，仍可从源代码注册标准 stdio MCP 服务：

```sh
git clone https://github.com/Fooljack/agency-agents-router-for-pi.git
cd agency-agents-router-for-pi
npm ci --omit=dev --ignore-scripts
node mcp-server.js --version

# 只打印当前机器的配置，不写入任何客户端设置
node scripts/print-config.js codex
node scripts/print-config.js claude-code
```

将输出的 TOML / JSON 合并到客户端配置，保留其他条目；移动仓库或 Node 后重新生成。
服务由客户端启动，不需要另开后台终端或 HTTP 端口。

可选独立 Skill：[`integrations/skills/agency-agents-router/SKILL.md`](integrations/skills/agency-agents-router/SKILL.md)。
将整个目录复制到 Codex 的 `~/.agents/skills/` 或 Claude Code 的 `~/.claude/skills/`。
**只复制 Skill 不会注册 MCP；原生插件用户不要重复复制。**
详细步骤：[Codex MCP](docs/codex.md#standalone-mcp) · [Claude Code MCP](docs/claude-code.md#standalone-mcp)。

## PI-Desktop install

1. Download [`dist/com.fooljack.agency-agents-router-1.0.0.piplug`](dist/com.fooljack.agency-agents-router-1.0.0.piplug).
2. In PI-Desktop, open **插件 / Plugins → ⋯ → 安装插件包 / Install package** and select the file.
3. The native tools become available to the selected model. **Do not run `npm ci` for the PI package.**

From source, use **Plugins → Load development plugin**. PI packaging must use
PI-Desktop's `PluginCheck` and `PluginPack`, never a hand-made ZIP. Do not bundle
`node_modules` or the other clients' generated `plugins/` directories into a PI package.
Existing PI installations keep working unchanged.

## Tools

| Tool | Arguments | Returns |
| --- | --- | --- |
| `agency_agents_search` | `query?`, `division?`, `limit?` (integer 1–25; default 8) | Ranked slug/name/division/description plus keyword expansions |
| `agency_agents_inspect` | `agent` or `slug`; `include_body?` (default false) | Metadata; optional body preview capped at 20,000 characters |
| `agency_agents_load` | `agent` or `slug`; `task?` | Specialist instructions with an adoption preamble, capped at 32,000 characters |

Clients may prefix tool names with the plugin/server name. Use the names shown
in that client's tool list. Missing/unknown specialists return actionable errors;
MCP arguments are validated against the same JSON schemas the PI tools publish.

```text
agency_agents_search { "query": "前端性能优化", "limit": 3 }
agency_agents_inspect { "agent": "frontend-developer" }
agency_agents_load { "agent": "frontend-developer", "task": "检查当前项目页面性能" }
```

Search is lexical and offline: no embeddings or model API calls. Ranking keeps
the Hermes weights (`+5` substring, `+3` name hit, `+1.5` description hit,
`+1` per shared token, `+1/√tokens` to prefer focused bodies).

Chinese queries use a keyword bridge, e.g. `抖音投放 → paid / campaign / ads / advertising`.
`division` accepts keys (`paid-media`), labels (`Paid Media`), subdivisions
(`unity`, `godot`, `unreal-engine`, `blender`, `roblox-studio`), and Chinese aliases
such as `工程`, `设计`, `投放`, `财务`, `游戏`, `安全`.
Unknown divisions are reported explicitly.

## Boundaries / 能力边界

- `load` returns **third-party reference text**, not a system instruction or an
  executable agent. User and higher-priority host instructions take precedence.
- No `agency_agents_delegate`: this distribution does not spawn subagents or
  switch models. Host-native delegation remains the host's responsibility.
- The router does not install Office/PDF engines or bypass client permissions.
- The three tools do not write files, execute shell commands, make network
  requests, or need credentials. They read the bundled ~3.9 MB roster locally.
- Native plugins contain no install hooks, automatic dependency downloads or
  extra background services. The host manages the local stdio process.
- The host's model calls can still consume its normal quota; the router makes
  no additional model calls and cannot fix provider, account or context errors.
- PI permissions remain `agent.tool.register` and `agent.prompt.inject`.
  MCP tools advertise `readOnlyHint`, `idempotentHint` and closed-world behaviour.

## Development and tests

```sh
# Explicitly include build tools, even when NODE_ENV=production
npm ci --include=dev --ignore-scripts
npm run build:plugins
npm run check:plugins
npm test

# PI-only tests do not need npm dependencies
npm run test:pi

# Rebuild the roster only when intentionally updating upstream
node build-roster.js /path/to/agency-agents
```

`scripts/build-plugins.js` generates both plugin directories and their marketplace
catalogs from the shared code, roster and Skill. Commit the generated files so
client installs work without a build step. Do not hand-edit generated plugins.

Tests cover real MCP subprocesses, older protocol negotiation, Chinese routing,
PI/MCP parity, invalid arguments, truncation, concurrency, JSON-only stdout,
EOF shutdown, config escaping and PI-only deployment. Plugin tests additionally
check reproducible builds, manifests, licenses, hashes and copied installations
in Unicode/space-containing directories with external npm imports blocked.
CI is configured for Windows, macOS and Linux with Node 20 and 24.

```text
main.js                         PI registration + shared tool handlers
manifest.json                   PI native manifest (1.0.0)
lib/roster.js                   shared ranking, lookup and prompt composition
lib/mcp.js                      MCP adapter + schema validation
mcp-server.js                   source MCP stdio entry
scripts/build-plugins.js        reproducible native plugin builder
scripts/print-config.js         absolute-path TOML / JSON generator, no writes
plugins/codex/                  self-contained Codex plugin (1.2.0)
plugins/claude-code/            self-contained Claude Code plugin (1.2.0)
.agents/plugins/marketplace.json  Codex marketplace
.claude-plugin/marketplace.json   Claude Code marketplace
data/agents.json                shared 279-persona roster
skills/agency-agents-router.md  unchanged PI-hosted Skill
integrations/skills/            shared standalone/plugin Skill source
docs/                          installation, migration and troubleshooting
```

The MCP adapter uses the official
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk),
pinned in `package-lock.json`. esbuild bundles its runtime dependencies into each
native plugin's `runtime/mcp-server.cjs`; only Node built-ins stay external.
`BUNDLE.json` records package versions and SHA-256 hashes, not a signing certificate.
Full dependency licenses ship in each plugin's `runtime/THIRD_PARTY_LICENSES.txt`.
See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

Plugin and adapter code: MIT © 2026 Fooljack. Bundled roster: MIT © 2025 AgentLand
Contributors. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
