# Claude Code 接入

本仓库提供标准 **stdio MCP 服务**，可在 Claude Code 中使用。
它不是 PI `.piplug` 的直接安装，也不要求额外申请 Anthropic API Key。
Claude Code 自己仍需具备正常可用的登录或模型配置。

## 1. 安装服务依赖

需要 Node.js **20.19 或更高版本**，推荐 Node.js 24 LTS：

```sh
git clone https://github.com/Fooljack/agency-agents-router-for-pi.git
cd agency-agents-router-for-pi
npm ci --ignore-scripts
node mcp-server.js --version
```

已有 checkout 更新后重新运行 `npm ci --ignore-scripts`。
MCP 服务只读本地专家库；运行时不联网、不写文件、不执行用户命令。
依赖安装阶段需要网络。Claude Code 会自动管理服务进程，无需单独启动终端常驻。

## 2. 注册 MCP

### 方法 A：Claude Code CLI（推荐）

`node` 在 PATH 中时，注册为当前用户的所有项目可用：

```sh
claude mcp add --transport stdio --scope user agency-agents -- node "/absolute/path/agency-agents-router-for-pi/mcp-server.js"
claude mcp get agency-agents
```

Windows PowerShell 可在仓库根目录执行以下命令，自动使用 Node 和服务的完整路径：

```powershell
$node = (Get-Command node -CommandType Application).Source
$server = (Resolve-Path .\mcp-server.js).Path
claude mcp add --transport stdio --scope user agency-agents -- $node $server
claude mcp get agency-agents
```

参数中的 `--` 是分隔符：左侧属于 Claude Code，右侧属于 MCP 服务。
只在特定项目启用时，在**目标项目目录**运行并改用 `--scope local`。
需要项目共享时用 `--scope project`，但提交前应把本机绝对路径改成团队可复用的配置。
如果已经注册过同名服务，先检查现有配置；确认要替换时，移除对应作用域的旧条目后再注册。

### 方法 B：生成项目 `.mcp.json`

在仓库中执行：

```sh
node scripts/print-config.js claude-code
```

把输出合并到**目标项目根目录**的 `.mcp.json`；不存在时可以新建。
脚本只打印 JSON，不会更改任何现有配置。它会为本机填好 Node 和服务的绝对路径。

示意（实际使用脚本的输出）：

```json
{
  "mcpServers": {
    "agency-agents": {
      "type": "stdio",
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["D:\\AI Tools\\agency-agents-router-for-pi\\mcp-server.js"]
    }
  }
}
```

已有 `.mcp.json` 时，**只合并 `mcpServers.agency-agents`，不要覆盖其他服务器**。
这是本机配置，绝对路径不能原样分享给其他电脑。
项目 MCP 可能显示 `Pending approval`：在目标项目里启动 Claude Code，按提示确认信任和授权。
不要通过放宽所有工具权限来解决未授权的项目配置。

## 3. 可选：安装 Skill

将仓库目录：

```text
integrations/skills/agency-agents-router/
```

复制到以下位置之一，保持 `agency-agents-router/SKILL.md` 的层级：

- 用户级：`~/.claude/skills/agency-agents-router/`
- 项目级：`<你的项目>/.claude/skills/agency-agents-router/`
- 自定义 `CLAUDE_CONFIG_DIR`：用户级 Skill 放在该配置目录的 `skills/` 下

不要同时复制多份，更新前先确认不存在需要保留的同名 Skill。
Skill 依赖上一步注册的 MCP，不是独立执行引擎，也不包含自动放行工具的权限规则。

## 4. 验证

执行 `claude mcp get agency-agents`，应显示连接成功。进入 Claude Code 后用 `/mcp`
检查这三个工具；必要时重开会话，让工具和 Skill 重新加载。

```text
请使用 agency-agents 检索“前端性能优化”，查看 frontend-developer，
再加载这位专家用于当前任务。先只确认工具能够正常返回，不修改项目。
```

客户端通常会显示类似 `mcp__agency-agents__agency_agents_search` 的名称。
以实际工具列表为准，Skill 不硬编码客户端的工具前缀。
`load` 只返回专家提示词，不等于 Claude Code 的原生 Agent 子代理。

## 常见问题 / 移除

- **Cannot find module**：在服务所在的 checkout 执行 `npm ci --ignore-scripts`。
- **找不到 Node / ENOENT**：使用完整 Node 路径；移动文件夹后重新注册或生成配置。
- **Pending approval**：在项目会话里批准该 MCP，不要反复重新安装依赖。
- **服务启动后无终端输出**：正常；stdio 服务等待客户端的 MCP 消息，不是聊天式 CLI。
- **JSON-RPC 解析失败**：直接运行 `node mcp-server.js`，不要让 npm 横幅或 shell 提示混入 stdout。
- **已连接但模型报错**：检查 Claude Code 的模型、账号、额度或组织策略；Router 不会修复这些配置。

用户级移除：

```sh
claude mcp remove --scope user agency-agents
```

手动添加的项目配置则只删除 `.mcp.json` 内对应条目。Skill 可单独删除复制的目录。

官方参考：
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/skills
