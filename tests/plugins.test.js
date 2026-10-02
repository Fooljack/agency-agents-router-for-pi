"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { Client } = require("@modelcontextprotocol/sdk/client");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { generateArtifacts, TARGETS, PLUGIN_ID, MARKETPLACE_ID, digest } = require("../scripts/build-plugins.js");
const { TOOLS, TOOL_NAMES } = require("../main.js");
const { version } = require("../package.json");
const ROOT = path.resolve(__dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function inventory(root, prefix = "") {
  const result = [];
  for (const item of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    assert.ok(!item.isSymbolicLink(), `Plugins must not rely on symlinks: ${relative}`);
    if (item.isDirectory()) result.push(...inventory(root, relative));
    else result.push(relative);
  }
  return result.sort();
}

function assertBundle(root) {
  const manifest = json(path.join(root, "BUNDLE.json"));
  assert.equal(manifest.name, PLUGIN_ID);
  assert.equal(manifest.version, version);
  assert.deepEqual(inventory(root), [...Object.keys(manifest.files), "BUNDLE.json"].sort());
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.ok(!file.split("/").includes(".."));
    assert.equal(digest(fs.readFileSync(path.join(root, file))), hash, file);
  }
}

test("checked-in plugins/catalogs exactly match a fresh deterministic build", { timeout: 30000 }, async () => {
  const generated = await generateArtifacts();
  for (const [file, content] of generated) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `Missing ${file}; run npm run build:plugins`);
    assert.deepEqual(fs.readFileSync(path.join(ROOT, file)), content, `Stale generated file: ${file}`);
  }
});

test("both marketplaces select the correct plugin variant with a stable install id", () => {
  const codex = json(path.join(ROOT, ".agents/plugins/marketplace.json"));
  const claude = json(path.join(ROOT, ".claude-plugin/marketplace.json"));
  assert.equal(codex.name, MARKETPLACE_ID);
  assert.equal(claude.name, MARKETPLACE_ID);
  assert.equal(codex.plugins.length, 1);
  assert.equal(claude.plugins.length, 1);
  assert.equal(codex.plugins[0].name, PLUGIN_ID);
  assert.equal(claude.plugins[0].name, PLUGIN_ID);
  assert.deepEqual(codex.plugins[0].source, { source: "local", path: "./plugins/codex" });
  assert.equal(claude.plugins[0].source, "./plugins/claude-code");
  assert.equal(claude.plugins[0].version, version);
  assert.equal(codex.plugins[0].policy.installation, "AVAILABLE");
});

test("Codex portable and compatibility declarations are consistent", () => {
  const root = path.join(ROOT, "plugins/codex");
  const portable = json(path.join(root, "plugin.json"));
  const compat = json(path.join(root, ".codex-plugin/plugin.json"));
  for (const key of ["name", "version", "description", "author", "homepage", "repository", "license", "keywords"]) {
    assert.deepEqual(portable[key], compat[key], key);
  }
  assert.equal(portable.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.deepEqual(portable.extensions["com.openai"].interface, compat.interface);
  assert.equal(compat.skills, "./skills/");
  assert.equal(compat.mcpServers, "./.mcp.json");
  const currentMcp = json(path.join(root, "mcp.json"));
  assert.equal(currentMcp.$schema, "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
  assert.deepEqual(currentMcp.mcpServers, json(path.join(root, ".mcp.json")).mcpServers);
});

for (const target of TARGETS) {
  test(`${target}: inventory, version, licenses, skill and relocatable paths`, () => {
    const root = path.join(ROOT, "plugins", target);
    assertBundle(root);
    assert.equal(json(path.join(root, "BUNDLE.json")).target, target);
    const manifest = json(path.join(root, target === "codex" ? "plugin.json" : ".claude-plugin/plugin.json"));
    assert.equal(manifest.name, PLUGIN_ID);
    assert.equal(manifest.version, version);
    assert.equal(manifest.hooks, undefined, "Installing a router must not add command hooks");
    const server = json(path.join(root, ".mcp.json")).mcpServers["agency-agents"];
    assert.deepEqual(Object.keys(server).sort(), ["args", "command", "type"]);
    assert.equal(server.command, "node");
    assert.equal(server.type, "stdio");
    assert.deepEqual(server.args, [`${target === "codex" ? "${PLUGIN_ROOT}" : "${CLAUDE_PLUGIN_ROOT}"}/runtime/mcp-server.cjs`]);
    assert.ok(fs.readFileSync(path.join(root, "runtime/data/agents.json")).equals(fs.readFileSync(path.join(ROOT, "data/agents.json"))));
    assert.equal(json(path.join(root, "runtime/data/agents.json")).agentCount, 279);
    const skill = fs.readFileSync(path.join(root, "skills/route/SKILL.md"), "utf8");
    const source = fs.readFileSync(path.join(ROOT, "integrations/skills/agency-agents-router/SKILL.md"), "utf8");
    assert.equal(skill, source.replace(/^name: agency-agents-router$/m, "name: route"));
    assert.match(skill, /higher-priority host instructions/);
    const licenses = fs.readFileSync(path.join(root, "runtime/THIRD_PARTY_LICENSES.txt"), "utf8");
    assert.match(licenses, /@modelcontextprotocol\/sdk@1\.31\.0/);
    assert.match(licenses, /Permission is hereby granted/);
    assert.ok(!inventory(root).some((name) => name.includes("node_modules/")));
  });

  test(`${target}: copied plugin works without the checkout or external npm modules`, { timeout: 30000 }, async (t) => {
    const temp = fs.mkdtempSync(path.join(process.env.PI_SCRATCH_DIR || os.tmpdir(), "agency-plugin-"));
    let client;
    let stderr = "";
    t.after(async () => {
      try { await client?.close(); }
      finally { fs.rmSync(temp, { recursive: true, force: true }); }
      assert.equal(stderr, "");
    });
    const installed = path.join(temp, "插件 cache with spaces", target);
    const cwd = path.join(temp, "unrelated project");
    fs.mkdirSync(cwd, { recursive: true });
    const source = path.join(ROOT, "plugins", target);
    // Some Node/Windows recursive-copy versions mis-encode Unicode destinations.
    // Copy bytes explicitly so the fixture still tests real Unicode install paths.
    for (const file of inventory(source)) {
      const dest = path.join(installed, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, fs.readFileSync(path.join(source, file)));
    }
    fs.writeFileSync(path.join(temp, "package.json"), '{"type":"module"}\n');
    const config = json(path.join(installed, ".mcp.json")).mcpServers["agency-agents"];
    const variable = target === "codex" ? "${PLUGIN_ROOT}" : "${CLAUDE_PLUGIN_ROOT}";
    const serverFile = path.resolve(config.args[0].replace(variable, installed));
    const guardFile = path.join(temp, "block-external-modules.cjs");
    fs.writeFileSync(guardFile, `
      const Module = require('node:module');
      const path = require('node:path');
      const original = Module._load;
      const entry = ${JSON.stringify(serverFile)};
      Module._load = function(name, ...args) {
        if (!Module.isBuiltin(name) && path.resolve(name) !== entry) {
          throw new Error('Unexpected external runtime dependency: ' + name);
        }
        return original.call(this, name, ...args);
      };
    `);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--require", guardFile, serverFile],
      cwd,
      stderr: "pipe",
    });
    transport.stderr.on("data", (chunk) => { stderr += chunk; });
    client = new Client({ name: "installed-plugin-test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    assert.equal(client.getServerVersion().version, version);
    assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name), TOOL_NAMES);
    for (const [name, args] of [
      ["agency_agents_search", { query: "前端性能优化", limit: 3 }],
      ["agency_agents_inspect", { agent: "frontend-developer", include_body: true }],
      ["agency_agents_load", { agent: "frontend-developer", task: "检查页面性能" }],
    ]) {
      const actual = await client.callTool({ name, arguments: args });
      const expected = await TOOLS.find((tool) => tool.name === name).execute(args);
      assert.equal(actual.isError, false);
      assert.deepEqual(actual.content, expected.content);
      assert.deepEqual(actual.structuredContent, expected.structuredContent);
    }
    const invalid = await client.callTool({ name: "agency_agents_search", arguments: { limit: 0 } });
    assert.equal(invalid.isError, true);
    assertBundle(installed); // No cache or other state may be written inside the plugin.
  });

  test(`${target}: missing bundled data fails before advertising a usable server`, () => {
    const temp = fs.mkdtempSync(path.join(process.env.PI_SCRATCH_DIR || os.tmpdir(), "agency-missing-data-"));
    try {
      fs.copyFileSync(path.join(ROOT, "plugins", target, "runtime/mcp-server.cjs"), path.join(temp, "server.cjs"));
      const result = spawnSync(process.execPath, [path.join(temp, "server.cjs")], {
        cwd: temp, encoding: "utf8", timeout: 10000,
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /agents\.json/);
      assert.match(result.stderr, /ENOENT/);
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
}

test("both clients ship identical MCP runtime and expert data", () => {
  for (const file of ["runtime/mcp-server.cjs", "runtime/data/agents.json", "runtime/THIRD_PARTY_LICENSES.txt", "skills/route/SKILL.md"]) {
    assert.ok(fs.readFileSync(path.join(ROOT, "plugins/codex", file)).equals(fs.readFileSync(path.join(ROOT, "plugins/claude-code", file))), file);
  }
});
