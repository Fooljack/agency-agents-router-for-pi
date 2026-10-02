# Claude Code 原生插件 / MCP 接入

推荐安装 **Agency Agents Router 原生插件 1.2.0**：一次安装注册 3 个 MCP 工具和
`route` Skill，不必单独配置服务器或复制技能。PI 的 `.piplug` 不能用于 Claude Code。

## 1. 前置条件

- 使用支持插件的 Claude Code；本版本使用 **Claude Code 2.1.287** 验证。
- Node.js **20.19+** 在 Claude Code 的 PATH 中，推荐 Node 24 LTS。
- Claude Code 自身有正常可用的登录或模型配置。Router 不需要额外 API Key。
- 安装、更新时能访问 GitHub；安装后 Router 的三个操作只读本地专家库。

在启动 Claude Code 的同一环境中运行 `node --version`。Windows 桌面应用可能未继承
新修改的 PATH：安装 Node 后关闭并重新打开应用。插件已打包全部 npm 运行依赖，
**不要在插件缓存中运行 `npm install` / `npm ci`**。

## 2. 从 GitHub 安装插件

```sh
claude plugin marketplace add Fooljack/agency-agents-router-for-pi
claude plugin install agency-agents-router@fooljack-agency --scope user
```

这里 `fooljack-agency` 是本仓库的自定义市场，`agency-agents-router` 是插件名。
`--scope user` 为当前用户启用；仅在一个项目使用时，在目标项目中选择 `--scope local`。
需要团队共享的项目设置时用 `--scope project`，并先检查项目已有配置。

重开会话，或执行 `/reload-plugins`。客户端若提示信任或授权，按实际需要确认；
不要通过跳过所有权限检查来处理插件授权。

也可以在会话的 `/plugin` 界面中添加同一个 GitHub 市场并安装插件。
插件管理器自动管理 MCP 服务进程，不需要另开常驻终端、配置端口或手动启动服务。

## 3. 验证与使用

```sh
claude plugin list
claude plugin details agency-agents-router
claude mcp list
```

预期结果：

- `agency-agents-router@fooljack-agency` 版本为 `1.2.0`，状态为 enabled。
- 组件清单：`Skills (1) route`、`MCP servers (1) agency-agents`，无附带 agents/hooks。
- MCP 列表中的 `plugin:agency-agents-router:agency-agents` 显示 `Connected`。

在新会话中使用：

```text
/agency-agents-router:route 检索“前端性能优化”，查看并加载 frontend-developer，先不要修改项目。
```

也可以直接要求 Claude 调用 Router。会话的 `/mcp` 中应能看到：

- `agency_agents_search`
- `agency_agents_inspect`
- `agency_agents_load`

实际工具名可能附带插件/服务器前缀，以会话展示为准；Skill 不硬编码此前缀。
`load` 返回专家参考提示词，不会创建独立子代理、切换模型或提高宿主权限。
专家文本不能覆盖用户和更高优先级的指令。

## 4. 更新、禁用和移除

```sh
claude plugin marketplace update fooljack-agency
claude plugin update agency-agents-router@fooljack-agency --scope user
```

更新后重开会话或 `/reload-plugins`。临时停用可在 `/plugin` 中禁用该插件。

移除用户级安装：

```sh
claude plugin uninstall agency-agents-router@fooljack-agency --scope user
```

如果安装在 `project` / `local` 作用域，使用对应作用域。
确认不再使用该市场中的其他插件后，才移除市场：

```sh
claude plugin marketplace remove fooljack-agency
```

不必删除全局 Claude 设置或其他插件目录。

## 5. 从 1.1.0 MCP / 独立 Skill 迁移

不要让旧的独立 Router 和新插件同时启用：

1. 用 `claude mcp get agency-agents` 检查自己以前注册的服务及作用域。
2. 如果确实是旧 Router，移除对应条目，例如：
   `claude mcp remove --scope user agency-agents`。
   项目/本地作用域使用对应参数；手动 `.mcp.json` 只删除 `mcpServers.agency-agents`。
3. 备份并移除此前复制的 `agency-agents-router` Skill 目录，不动其他 Skill。
4. 按上文安装插件并重开会话。不要再复制独立 Skill。

<a id="standalone-mcp"></a>
## 备选：独立 MCP 接入

如果不使用原生插件，可继续使用源代码 MCP 服务。仅此方式需要安装 npm 依赖：

```sh
git clone https://github.com/Fooljack/agency-agents-router-for-pi.git
cd agency-agents-router-for-pi
npm ci --omit=dev --ignore-scripts
node mcp-server.js --version
claude mcp add --transport stdio --scope user agency-agents -- node "/absolute/path/agency-agents-router-for-pi/mcp-server.js"
claude mcp get agency-agents
```

Windows PowerShell 可使用 Node 和服务的完整路径，避免桌面 PATH 问题：

```powershell
$node = (Get-Command node -CommandType Application).Source
$server = (Resolve-Path .\mcp-server.js).Path
claude mcp add --transport stdio --scope user agency-agents -- $node $server
```

也可以运行 `node scripts/print-config.js claude-code`，将输出合并到目标项目的 `.mcp.json`。
该脚本只打印配置，正确转义空格、中文和反斜杠，不改客户端设置。
已有文件时只合并 `mcpServers.agency-agents`，不要覆盖其他服务器。
配置包含本机绝对路径，移动仓库或 Node 后需重新生成。

独立方式的可选 Skill：将仓库 `integrations/skills/agency-agents-router/` 复制到：

- 用户级 `~/.claude/skills/agency-agents-router/`；或
- 项目级 `<project>/.claude/skills/agency-agents-router/`。
- 自定义 `CLAUDE_CONFIG_DIR` 时，用户级目录在该配置目录的 `skills/` 下。

只选一个位置，不覆盖需要保留的同名 Skill。只复制 Skill 不会注册 MCP。
更新源代码 checkout 时使用 `git pull --ff-only` 后运行 `npm ci --omit=dev --ignore-scripts`。
移除服务用 `claude mcp remove --scope user agency-agents`（或实际作用域），再单独移除复制的 Skill。

## 常见问题

- **安装后找不到 Node**：在同一运行环境检查 `node --version` 和 PATH，重启客户端。
  无法调整桌面 PATH 时，可使用独立 MCP 的完整 Node 路径。
- **插件文件缺失 / 找不到 `agents.json`**：通过插件管理器更新或重新安装；不要只复制清单或单个运行文件。
  原生插件运行不依赖仓库根目录的 `node_modules`。
- **独立 MCP 提示 `Cannot find module`**：仅在独立服务的 checkout 运行 `npm ci --omit=dev --ignore-scripts`。
- **插件已安装但会话无工具**：检查启用状态、目标作用域、项目信任和组织策略，执行 `/reload-plugins` 或新建会话。
- **重复 Skill / MCP**：按迁移步骤只移除旧 Router 条目，保留新插件和其他配置。
- **stdio 服务启动后没有文字输出**：正常；它等待 MCP 消息，不是聊天式 CLI。
- **JSON-RPC 解析失败**：独立服务直接运行 `node mcp-server.js`，不要让 npm 横幅或 shell 提示进入 stdout。
- **供应商 400/402、额度或上下文错误**：检查宿主配置和账号；Router 不会修复这些问题。

本版本的发布检查在隔离 `CLAUDE_CONFIG_DIR` 中进行，不替用户启用正式配置。
验证覆盖原生清单、市场安装、Skill 发现、MCP 连接及独立运行包；不把这些结果等同于桌面 GUI 或付费模型工作流测试。

官方参考：
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins/marketplaces
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/skills
