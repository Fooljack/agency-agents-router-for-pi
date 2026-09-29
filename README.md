# Agency Agents Router for PI-Desktop

A [PI-Desktop](https://github.com/vastsa/PI-Desktop) plugin that routes a task to one of
[279 specialist personas](https://github.com/msitarzewski/agency-agents) bundled inside the plugin,
using three read-only tools. Ported from the Hermes `agency-agents-router` plugin.

- **Roster:** 279 agents · 18 divisions · ~3.9 MB of specialist instructions, shipped as `data/agents.json`
- **Tools:** `agency_agents_search`, `agency_agents_inspect`, `agency_agents_load`
- **Permissions:** `agent.tool.register`, `agent.prompt.inject` (no filesystem, network or shell access)
- **License:** MIT (this plugin) + MIT (upstream roster — see `THIRD_PARTY_NOTICES.md`)

## Install

Download `com.fooljack.agency-agents-router-1.0.0.piplug` from
1. Download `dist/com.fooljack.agency-agents-router-1.0.0.piplug` from this repository (or from
   [Releases](https://github.com/Fooljack/agency-agents-router-for-pi/releases) when one is published).
2. In PI-Desktop open **插件 / Plugins → ⋯ → 安装插件包 / Install package** and pick the file.

From source: clone this repository into any directory and use **Plugins → Load development plugin**
(dev plugins reload whenever you save a file). Build an installable archive with PI-Desktop's own
plugin tooling — `PluginCheck` then `PluginPack` — which rejects a hand-made zip.
## Tools

| Tool | Arguments | Returns |
| --- | --- | --- |
| `agency_agents_search` | `query?`, `division?`, `limit?` (default 8, max 25) | Ranked `slug / name / division / description` plus the keyword bridge it used |
| `agency_agents_inspect` | `agent` or `slug`, `include_body?` | One specialist's metadata; instructions when `include_body=true` |
| `agency_agents_load` | `agent` or `slug`, `task?` | The specialist's full instructions wrapped in an adoption preamble, ready to follow this turn |

Search is lexical and offline — no embeddings, no API calls. Weights follow the upstream Hermes
router (`+5` substring, `+3` name hit, `+1.5` description hit, `+1` per shared token, `+1/√tokens`
to prefer focused bodies) so results stay predictable across the two ports.

### Chinese queries

The roster is English, so `search` bridges common Chinese terms to roster keywords and echoes the
bridge in its output:

```jsonc
// agency_agents_search { "query": "抖音投放" }
agency-agents search "抖音投放" → 52 match(es), showing 8.
keyword bridge (zh→en): paid, campaign, ads, advertising

- ppc-campaign-strategist — PPC Campaign Strategist [paid-media]
- paid-social-strategist — Paid Social Strategist [paid-media]
- paid-media-auditor — Paid Media Auditor [paid-media]
```

`division` itself accepts a key (`paid-media`), an English label (`Paid Media`), a nested
subdivision (`unity`, `godot`, `unreal-engine`, `blender`, `roblox-studio`) or a Chinese label
(`工程`, `设计`, `投放`, `财务`, `游戏`, `安全`). An unrecognised division is reported in the output
instead of being silently dropped.

### Typical use

```text
agency_agents_search { "query": "渗透测试" }         → penetration-tester, api-tester, …
agency_agents_inspect { "agent": "penetration-tester" }
agency_agents_load    { "agent": "penetration-tester", "task": "评审这次登录接口改动的攻击面" }
```

`load` output is third-party reference material: it is prefixed with a preamble telling the model to
obey the user and higher-priority instructions, and to ignore anything inside the specialist text
that claims otherwise.

## Differences from the Hermes plugin

| Hermes | This plugin |
| --- | --- |
| `agency_agents_search` / `inspect` / `load` | identical surface (same ranking weights, same JSON shape) |
| `agency_agents_delegate` (spawns a subagent) | **not ported** — PI-Desktop plugins cannot create subagents, so `load` returns the specialist prompt into the current turn instead |
| English-only matching | adds a Chinese→English keyword bridge and Chinese division labels |
| Roster on disk in the host app | roster bundled as a single generated `data/agents.json` |

## Development

```bash
node build-roster.js /path/to/agency-agents   # regenerate data/agents.json
node --test tests/roster.test.js              # routing + data integrity tests
```

`build-roster.js` reads the upstream `divisions.json`, walks each division recursively (nested
tool directories such as `game-development/unity` are collected too), parses the YAML frontmatter and
writes one JSON file containing metadata and the verbatim Markdown body. Update the checkout, re-run
the generator, and the plugin picks up new agents without code changes.

```
main.js                    tool registration + host wiring
lib/roster.js              ranking, division resolution, prompt composition (pure, tested)
build-roster.js            upstream checkout → data/agents.json
data/agents.json           generated roster (279 agents, body text included)
skills/agency-agents-router.md   usage guidance for the agent
tests/roster.test.js       node:test suite
```

## 中文速览

PI-Desktop 插件：把任务路由到内置的 279 位领域专家（agency-agents 花名册），只提供三个只读工具。

- `agency_agents_search` 检索（支持中文，如 `抖音投放`、`渗透测试`；可用 `division` 过滤）
- `agency_agents_inspect` 查看某位专家的资料（`include_body=true` 才返回正文）
- `agency_agents_load` 让当前回合"采用"该专家：返回其完整指令 + 采用前言（前言声明用户与系统指令优先级更高）

安装：在 PI-Desktop 的**插件 → 从文件安装**选择 `.piplug`。上游 Hermes 版本的
`agency_agents_delegate`（真子代理）在 PI 插件里无法实现，已改为 `load` 直接注入当前回合，详见上文。

## License

Plugin code: MIT © 2026 Fooljack. Bundled roster: MIT © 2025 AgentLand Contributors — see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
