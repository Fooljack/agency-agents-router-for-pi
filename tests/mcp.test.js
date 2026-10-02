"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const { createInterface } = require("node:readline");
const { Client } = require("@modelcontextprotocol/sdk/client");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { ErrorCode } = require("@modelcontextprotocol/sdk/types.js");
const { TOOLS, TOOL_NAMES } = require("../main.js");
const { loadRoster, MAX_PROMPT_CHARS } = require("../lib/roster.js");
const { version } = require("../package.json");
const root = path.resolve(__dirname, "..");
const entry = path.join(root, "mcp-server.js");
const text = (result) => result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");

test("real MCP stdio client: initialize, discover and call the shared tools", { timeout: 45000 }, async (t) => {
  // Deliberately not the checkout; spaces and Unicode also exercise Windows cwd handling.
  const cwd = fs.mkdtempSync(path.join(process.env.PI_SCRATCH_DIR || os.tmpdir(), "agency MCP 中文-"));
  const transport = new StdioClientTransport({
    command: process.execPath, args: [entry], cwd, stderr: "pipe",
  });
  let stderr = "";
  transport.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const client = new Client({ name: "agency-router-test", version: "1.0.0" }, { capabilities: {} });
  t.after(async () => {
    await client.close();
    fs.rmSync(cwd, { recursive: true, force: true });
    assert.equal(stderr, "", "normal MCP operations must not log diagnostics");
  });
  await client.connect(transport);
  const call = (name, args) => client.callTool({ name, ...(args === undefined ? {} : { arguments: args }) });

  await t.test("handshake and tools/list expose the three PI schemas with read-only annotations", async () => {
    assert.equal(client.getServerVersion().name, "agency-agents-router");
    assert.equal(client.getServerVersion().version, version);
    assert.match(client.getInstructions(), /does not spawn a subagent/);
    assert.deepEqual(await client.ping(), {});
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), TOOL_NAMES);
    for (const tool of listed.tools) {
      const shared = TOOLS.find((item) => item.name === tool.name);
      assert.deepEqual(tool.inputSchema, shared.schema);
      assert.equal(tool.description, shared.description);
      assert.deepEqual(tool.annotations, {
        readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
      });
    }
  });

  await t.test("Chinese routing and division aliases work over the wire", async () => {
    const result = await call("agency_agents_search", { query: "渗透测试", limit: 3 });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.results[0].slug, "penetration-tester");
    const filtered = await call("agency_agents_search", { query: "ppc", division: "投放", limit: 3 });
    assert.equal(filtered.structuredContent.division, "paid-media");
    assert.ok(filtered.structuredContent.results.every((item) => item.division === "paid-media"));
    assert.equal((await call("agency_agents_search")).structuredContent.returned, 8);
    assert.equal((await call("agency_agents_search", { query: "zzzzqqqq" })).structuredContent.count, 0);
  });

  await t.test("all handlers preserve PI text and structured results exactly", async () => {
    const inputs = [
      ["agency_agents_search", { query: "前端性能优化", limit: 2 }],
      ["agency_agents_inspect", { slug: "frontend-developer", include_body: true }],
      ["agency_agents_load", { agent: "frontend-developer", task: "检查页面性能" }],
    ];
    for (const [name, args] of inputs) {
      const expected = await TOOLS.find((tool) => tool.name === name).execute(args);
      const actual = await call(name, args);
      assert.deepEqual(actual.content, expected.content, name);
      assert.deepEqual(actual.structuredContent, expected.structuredContent, name);
      assert.equal(actual.isError, false);
    }
  });

  await t.test("inspect is metadata-only by default and reports truncation when requested", async () => {
    const metadata = await call("agency_agents_inspect", { agent: "frontend-developer" });
    assert.equal(metadata.structuredContent.include_body, false);
    assert.ok(!text(metadata).includes("## Instructions"));
    const roster = loadRoster(path.join(root, "data", "agents.json"));
    const large = roster.agents.find((agent) => agent.body.length > 20000);
    assert.ok(large);
    const full = await call("agency_agents_inspect", { agent: large.slug, include_body: true });
    assert.equal(full.structuredContent.body_truncated, true);
    assert.match(text(full), /Truncated at 20000 chars/);
  });

  await t.test("load is bounded, includes the safety preamble, and does not retain a previous task", async () => {
    const first = await call("agency_agents_load", { agent: "frontend-developer", task: "unique-task-marker" });
    assert.match(text(first), /obey the user's request/);
    assert.match(text(first), /unique-task-marker/);
    const second = await call("agency_agents_load", { slug: "frontend-developer" });
    assert.equal(second.structuredContent.task, null);
    assert.ok(!text(second).includes("unique-task-marker"));
    const long = await call("agency_agents_load", { agent: "frontend-developer", task: "x".repeat(40000) });
    assert.ok(text(long).length <= MAX_PROMPT_CHARS);
    assert.equal(long.structuredContent.truncated, true);
  });

  await t.test("schema errors are reported as tool errors without coercion or silent field removal", async () => {
    const invalid = [
      ["agency_agents_search", { limit: 0 }],
      ["agency_agents_search", { limit: 26 }],
      ["agency_agents_search", { limit: 1.5 }],
      ["agency_agents_search", { limit: "3" }],
      ["agency_agents_search", { query: 123 }],
      ["agency_agents_search", { division: {} }],
      ["agency_agents_search", { unexpected: true }],
      ["agency_agents_inspect", { agent: 3 }],
      ["agency_agents_inspect", { agent: "frontend-developer", include_body: "true" }],
      ["agency_agents_load", { agent: "frontend-developer", task: [] }],
    ];
    for (const [name, args] of invalid) {
      const result = await call(name, args);
      assert.equal(result.isError, true, JSON.stringify(args));
      assert.match(text(result), /Invalid arguments/);
    }
    assert.equal((await call("agency_agents_search", { limit: 1 })).isError, false);
  });

  await t.test("missing or unknown specialists return actionable tool errors", async () => {
    const missing = await call("agency_agents_load");
    assert.equal(missing.isError, true);
    assert.match(text(missing), /Pass either/);
    const unknown = await call("agency_agents_inspect", { agent: "not-a-real-agent" });
    assert.equal(unknown.isError, true);
    assert.match(text(unknown), /Unknown agent/);
    assert.match(text(unknown), /agency_agents_search/);
  });

  await t.test("unknown tools return a protocol error and do not stop the server", async () => {
    await assert.rejects(call("does_not_exist", {}), (error) => {
      assert.equal(error.code, ErrorCode.InvalidParams);
      assert.match(error.message, /Unknown tool/);
      return true;
    });
    assert.equal((await client.listTools()).tools.length, 3);
  });

  await t.test("concurrent requests do not mix their results", async () => {
    const agents = ["frontend-developer", "penetration-tester", "level-designer"];
    const results = await Promise.all(agents.map((agent) => call("agency_agents_load", { agent, task: agent })));
    assert.deepEqual(results.map((result) => result.structuredContent.slug), agents);
    assert.deepEqual(results.map((result) => result.structuredContent.task), agents);
  });
});

test("raw stdio negotiates an older MCP version, keeps stdout JSON-only and exits on EOF", { timeout: 20000 }, async (t) => {
  const child = spawn(process.execPath, [entry], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
  const exited = once(child, "exit");
  const lines = createInterface({ input: child.stdout });
  let stderr = "";
  let lineCount = 0;
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  lines.on("line", () => { lineCount += 1; });
  t.after(() => {
    lines.close();
    if (child.exitCode === null) child.kill();
  });
  let id = 0;
  const request = async (method, params) => {
    const current = ++id;
    const response = once(lines, "line");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: current, method, ...(params ? { params } : {}) }) + "\n");
    const [line] = await response;
    const message = JSON.parse(line);
    assert.equal(message.jsonrpc, "2.0");
    assert.equal(message.id, current);
    assert.equal(message.error, undefined, line);
    return message.result;
  };
  const init = await request("initialize", {
    protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "legacy-test", version: "1.0.0" },
  });
  assert.equal(init.protocolVersion, "2024-11-05");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  assert.equal((await request("tools/list", {})).tools.length, 3);
  const called = await request("tools/call", { name: "agency_agents_search", arguments: { query: "前端" } });
  assert.equal(called.structuredContent.results[0].slug, "frontend-developer");
  child.stdin.end();
  const [code] = await exited;
  assert.equal(code, 0, stderr);
  assert.equal(lineCount, 3);
  assert.equal(stderr, "");
});

test("server CLI help/version work and invalid arguments fail clearly", () => {
  for (const arg of ["--help", "--version"]) {
    const result = spawnSync(process.execPath, [entry, arg], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    if (arg === "--version") assert.equal(result.stdout.trim(), version);
    else assert.match(result.stdout, /stdio MCP server/);
  }
  const invalid = spawnSync(process.execPath, [entry, "--unknown"], { encoding: "utf8", timeout: 10000 });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /Unexpected argument/);
});
