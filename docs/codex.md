# Codex 桌面端 / CLI / IDE 接入

使用本仓库的 **stdio MCP 服务**，不是安装 PI 的 `.piplug`。
Codex 桌面端、CLI 和 IDE 扩展共用本地 MCP 配置。网页版或远端执行环境
不会因此自动获得你本机的服务；应在实际运行 Codex 的环境中安装。

## 1. 安装服务依赖

需要 Node.js **20.19 或更高版本**，推荐 Node.js 24 LTS。
在一个长期保留的位置克隆仓库，然后安装锁定的依赖：

```sh
git clone https://github.com/Fooljack/agency-agents-router-for-pi.git
cd agency-agents-router-for-pi
npm ci --ignore-scripts
node mcp-server.js --version
```

更新已有 checkout 时使用 `git pull --ff-only`，再运行 `npm ci --ignore-scripts`。
服务使用本地 `data/agents.json`，不需要 API Key，不调用额外模型，不打开监听端口。
安装依赖需要访问 npm；安装后检索和提示词加载离线运行。

## 2. 配置 Codex

### 方法 A：生成配置（推荐，适合 Windows 和桌面端）

在仓库中执行：

```sh
node scripts/print-config.js codex
```

脚本输出当前 Node 可执行文件和服务文件的**绝对路径**，自动处理空格、中文和反斜杠。
将输出的整个 `[mcp_servers.agency-agents]` 段合并进：

- Windows：`%USERPROFILE%\.codex\config.toml`
- macOS / Linux：`~/.codex/config.toml`
- 如果设置了 `CODEX_HOME`：使用该目录下的 `config.toml`

**不要覆盖整个配置文件**；保留已有的模型、供应商和其他 MCP 配置。
如果已经有同名段，更新它，不要再添加第二个同名段。
脚本只向终端打印配置，不会修改客户端配置文件。

示意（用脚本的实际输出替换路径）：

```toml
[mcp_servers.agency-agents]
command = "C:\\Program Files\\nodejs\\node.exe"
args = ["D:\\AI Tools\\agency-agents-router-for-pi\\mcp-server.js"]
startup_timeout_sec = 20
tool_timeout_sec = 60
```

也可以在桌面端的 **Settings → MCP servers → Add server** 中选择 **STDIO**，
填入相同的命令和参数，保存后重启该 MCP 服务。不同版本的菜单名称可能略有差异。

### 方法 B：使用 Codex CLI 注册

如果 `node` 在 Codex 启动环境的 PATH 中：

```sh
codex mcp add agency-agents -- node "/absolute/path/agency-agents-router-for-pi/mcp-server.js"
codex mcp list
```

Windows 也可以使用类似 `"D:\AI Tools\agency-agents-router-for-pi\mcp-server.js"` 的绝对路径。
桌面端找不到 `node` 时，改用方法 A 的完整 Node 路径。

**启动命令直接使用 `node`，不要使用会往 stdout 打印提示的 npm 脚本或 shell 包装器。**
客户端会自动启动服务，不需要提前手动运行，也不需要 HTTP URL。

## 3. 可选：安装路由 Skill

MCP 配好后，模型可以直接调用工具。Skill 只是帮助模型选择何时使用 Router。
把仓库里的整个目录：

```text
integrations/skills/agency-agents-router/
```

复制到以下位置之一，保持 `agency-agents-router/SKILL.md` 的层级：

- 用户级：`~/.agents/skills/agency-agents-router/`
- 项目级：`<你的项目>/.agents/skills/agency-agents-router/`

不要同时复制到多个位置，也不要覆盖已有同名 Skill，除非确认要更新它。
这是 Codex 的 Agent Skills 路径，不是 PI 的 `agents/skills` 目录。
**只复制 Skill，不配置 MCP，不会产生这三个工具。**

## 4. 验证

重新打开 Codex 会话，或在设置里重启服务。CLI 可用 `/mcp` 查看连接状态。
在会话里发送：

```text
请调用 agency-agents 的搜索工具检索“前端性能优化”，只返回前 3 个专家；
再加载 frontend-developer，用来检查当前项目的页面性能。先不要修改文件。
```

应出现：`agency_agents_search`、`agency_agents_inspect`、`agency_agents_load`。
实际工具名可能带 MCP 服务前缀，以客户端展示为准。
工具会返回专家资料，不会自动创建独立子代理，也不会提高工具权限。

## 常见问题

- **找不到模块**：在同一个 checkout 重新运行 `npm ci --ignore-scripts`。
- **ENOENT / 启动失败**：检查 Node 和 `mcp-server.js` 的绝对路径；移动仓库后重新生成配置。
- **WSL / 容器 / 远程 Codex**：在对应环境安装 Node 和仓库，使用该环境的路径，不混用 Windows 路径。
- **服务已配置但没有工具**：检查启用状态、项目信任和组织 MCP 策略，然后重开会话。
- **供应商报 400/402**：这是模型协议或额度问题，安装 Router 不能修复供应商错误。

移除 CLI 注册：`codex mcp remove agency-agents`。手动配置则只删除对应 MCP 段。
如安装了 Skill，也可单独删除你复制的 Skill 目录。

官方参考：
- https://developers.openai.com/codex/mcp/
- https://developers.openai.com/codex/skills/
