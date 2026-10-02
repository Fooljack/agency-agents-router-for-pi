# Codex 原生插件 / stdio MCP 接入

推荐使用 **Agency Agents Router 原生插件 1.2.0**，一次安装获得 MCP 服务和 `route` Skill。
不支持插件的旧客户端仍可使用本文后半部分的 [独立 MCP](#standalone-mcp)。
PI 的 `.piplug` 不能安装到 Codex。

## 安装选择：只选一条路线

| 路线 | 安装步骤 | 还要单独配置 MCP？ | 还要单独安装 Skill？ |
| --- | --- | --- | --- |
| A. 原生插件（推荐） | 按第 2 节安装插件 | 不要，插件已自动注册 | 不要，插件已包含 `route` |
| B. 独立 MCP | 不安装插件，按“独立 MCP”章节配置服务 | 要 | 可选，不装也能调用 MCP 工具 |

**安装插件后，跳过本文“独立 MCP”及其“可选独立 Skill”步骤。**
这不是插件、MCP、Skill 三选一；单独安装 Skill 不会产生工具，不能替代 MCP。
同一个 Codex 环境只保留一套 Router 接入；其他 MCP 和 Skill 不受影响。

## 1. 前置条件

- 使用提供 `codex plugin` 命令的 Codex CLI；本版本使用 **CLI 0.160.0** 验证。
- Node.js **20.19+** 在 Codex 启动环境的 PATH 中，推荐 Node 24 LTS。
- 安装、更新时能访问 GitHub。Router 不要求额外 API Key；宿主模型仍需正常登录或配置。

在同一环境运行 `node --version`。原生插件包含 SDK、npm 运行依赖和 279 位专家的数据，
**不需要运行 `npm ci`、复制 Skill 或另外配置同一个 Router 的 MCP**。
客户端启动本地 stdio 进程，无需另开常驻终端或监听端口。

桌面端、CLI 和 IDE 的插件入口、版本和组织策略可能不同；安装本机插件不会让
Codex 网页版、云端、WSL 或容器自动获得本机运行时。请在实际执行 Codex 的环境中安装。

## 2. 路线 A：从 GitHub 安装原生插件

```sh
codex plugin marketplace add Fooljack/agency-agents-router-for-pi
codex plugin add agency-agents-router@fooljack-agency
```

安装标识由插件名 `agency-agents-router` 和市场名 `fooljack-agency` 组成。
这是本仓库的自定义市场，不是官方市场收录声明。

Codex 读取仓库的 `.agents/plugins/marketplace.json`，安装 `plugins/codex/`。
该目录包含 Agent Plugins 1.0.0 的 `plugin.json` / `mcp.json`，以及旧版 Codex 的
`.codex-plugin/plugin.json` / `.mcp.json` 兼容入口。
服务路径通过 `${PLUGIN_ROOT}` 定位安装目录，不依赖源码 checkout 或固定的用户路径。

## 3. 验证与使用

```sh
codex plugin list --marketplace fooljack-agency --json
```

预期插件版本 `1.2.0`，`installed` 和 `enabled` 都为 `true`。
重开 Codex 会话，在插件/Skill 列表中选择 `agency-agents-router:route`，或直接输入：

```text
请使用 Agency Agents Router 的 route Skill 检索“前端性能优化”，
查看并加载 frontend-developer。先确认工具能够返回结果，不修改项目。
```

在 CLI 会话中可通过 `/mcp` 检查连接，预期有以下三个工具：

- `agency_agents_search`
- `agency_agents_inspect`
- `agency_agents_load`

实际名称可能带插件或服务器前缀，以当前会话展示为准。
`load` 只是返回专家参考提示词，不创建独立子代理，不切换模型，也不扩大工具权限。
用户和更高优先级的宿主指令始终优先于专家文本。

桌面端如提供插件管理入口，可在那里检查启用状态并选用 Skill。
如果没有入口，先核对客户端版本/组织策略；也可使用下文的标准 MCP 配置。
不要把某个 CLI 版本的安装结果当成所有桌面版本均已验证的证明。

## 4. 更新与移除

先刷新 Git 市场快照，再安装该市场的当前版本：

```sh
codex plugin marketplace upgrade fooljack-agency
codex plugin add agency-agents-router@fooljack-agency
```

更新后重开会话。客户端的插件管理界面也可用于更新或停用插件。
CLI 命令可能随版本变化，可用 `codex plugin marketplace --help` 核对。

只移除这个插件：

```sh
codex plugin remove agency-agents-router@fooljack-agency
```

确认不再使用此市场中的任何插件后，才移除市场：

```sh
codex plugin marketplace remove fooljack-agency
```

不要删除整个 `CODEX_HOME`、`config.toml` 或其他插件缓存。

## 5. 从 1.1.0 MCP / 独立 Skill 迁移

避免让旧的独立 Router 和新插件同时注册：

1. 检查 `codex mcp list` 与 `config.toml` 中是否已有自己添加的 `agency-agents`。
2. 确认是旧 Router 后，执行 `codex mcp remove agency-agents`，或只移除
   `[mcp_servers.agency-agents]` 段。保留其他 MCP、模型和供应商配置。
3. 备份并移除此前复制到用户/项目 `.agents/skills/` 的 `agency-agents-router` 目录，
   不动其他 Skill。
4. 安装原生插件并重开会话。插件已经带 `route`，不要再次复制独立 Skill。

<a id="standalone-mcp"></a>
## 备选：独立 MCP 接入

**路线 B 专用：已经安装原生插件，请跳过本节和其中的可选 Skill 步骤。**
不使用原生插件时，标准 stdio MCP 可用于 Codex 桌面端、CLI 和 IDE。
MCP 必需、Skill 可选；这一方式需要保留源码 checkout 并安装 npm 依赖：

```sh
git clone https://github.com/Fooljack/agency-agents-router-for-pi.git
cd agency-agents-router-for-pi
npm ci --omit=dev --ignore-scripts
node mcp-server.js --version
```

### 方法 A：生成完整路径配置

在仓库中执行：

```sh
node scripts/print-config.js codex
```

将输出的整个 `[mcp_servers.agency-agents]` 段合并到以下位置的 `config.toml`：

- Windows：`%USERPROFILE%\.codex\config.toml`
- macOS / Linux：`~/.codex/config.toml`
- 自定义 `CODEX_HOME`：该目录下的 `config.toml`

脚本只打印，不写设置；它会正确转义 Node 和服务绝对路径中的空格、中文和反斜杠。
已有同名段时更新它，不重复添加，也不要覆盖整个配置文件。

示意（使用脚本的实际输出替换路径）：

```toml
[mcp_servers.agency-agents]
command = "C:\\Program Files\\nodejs\\node.exe"
args = ["D:\\AI Tools\\agency-agents-router-for-pi\\mcp-server.js"]
startup_timeout_sec = 20
tool_timeout_sec = 60
```

桌面端如提供 **Settings → MCP servers → Add server**，选择 STDIO 并填入相同命令和参数。
菜单名称可能随版本变化。移动仓库或 Node 后重新生成配置并重启服务。

### 方法 B：CLI 注册

```sh
codex mcp add agency-agents -- node "/absolute/path/agency-agents-router-for-pi/mcp-server.js"
codex mcp list
```

Windows 路径含空格时保留引号。桌面端找不到 PATH 中的 `node` 时使用方法 A 的完整路径。
服务启动命令直接用 `node`，不要把 npm 横幅或 shell 提示混入 stdout。

### 可选独立 Skill

MCP 连接后，将仓库的 `integrations/skills/agency-agents-router/` 整个目录复制到一个位置：

- 用户级 `~/.agents/skills/agency-agents-router/`；或
- 项目级 `<project>/.agents/skills/agency-agents-router/`。

不要覆盖需要保留的同名 Skill。只复制 Skill 不会注册工具，原生插件用户无需此步骤。
更新源码 checkout 时执行 `git pull --ff-only` 后运行 `npm ci --omit=dev --ignore-scripts`。
移除服务用 `codex mcp remove agency-agents`，再单独移除复制的 Skill。

## 常见问题

- **没有 `codex plugin` 命令**：核对版本，升级客户端或使用独立 MCP；不要尝试导入 PI 插件包。
- **找不到 Node / ENOENT**：检查 Codex 实际运行环境的 PATH。安装 Node 后重启桌面应用。
  无法调整 PATH 时使用独立 MCP 的绝对 Node 路径。
- **插件运行文件或 `agents.json` 缺失**：通过插件管理器更新/重装完整插件，不要只复制清单或单个脚本。
  原生插件不依赖仓库的 `node_modules`。
- **独立 MCP 提示 `Cannot find module`**：只在独立服务 checkout 运行 `npm ci --omit=dev --ignore-scripts`。
- **已安装但没有工具或 Skill**：检查插件启用状态、项目信任和组织策略，重开会话。
- **WSL / 容器 / 远程 Codex**：在对应环境安装 Node 和插件或仓库，不混用 Windows 路径。
- **重复 MCP / Skill**：只清理自己添加的旧 Router 条目，保留其他配置。
- **供应商 400/402、额度或上下文错误**：属于宿主模型/账号问题，Router 不能修复。

发布检查使用隔离 `CODEX_HOME`，不改用户正式配置，不全局安装 Codex。
插件包测试覆盖独立目录运行和三个工具；桌面 GUI 与付费模型工作流不在本次自动验证范围内。

官方参考：
- https://developers.openai.com/codex/plugins/
- https://developers.openai.com/codex/plugins/build/
- https://agent-plugins.org/
- https://developers.openai.com/codex/mcp/
- https://developers.openai.com/codex/skills/
