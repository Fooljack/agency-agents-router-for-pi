"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildConfig, SERVER_NAME } = require("../scripts/print-config.js");
const script = path.resolve(__dirname, "..", "scripts", "print-config.js");
const server = path.resolve(__dirname, "..", "mcp-server.js");

for (const paths of [
  { nodePath: "C:\\Program Files\\nodejs\\node.exe", serverPath: "D:\\AI Tools\\专家库\\mcp-server.js" },
  { nodePath: "/usr/local/bin/node", serverPath: '/Users/example/AI Tools/专家 "router"/mcp-server.js' },
]) {
  test(`config preserves spaces, Unicode and escaping: ${paths.nodePath}`, () => {
    const toml = buildConfig("codex", paths);
    assert.ok(toml.startsWith(`[mcp_servers.${SERVER_NAME}]\n`));
    // These two fields deliberately use the JSON/TOML common string subset.
    assert.equal(JSON.parse(toml.match(/^command = (.+)$/m)[1]), paths.nodePath);
    assert.deepEqual(JSON.parse(toml.match(/^args = (.+)$/m)[1]), [paths.serverPath]);
    assert.match(toml, /^startup_timeout_sec = 20$/m);
    const json = JSON.parse(buildConfig("claude-code", paths));
    assert.deepEqual(json.mcpServers[SERVER_NAME], {
      type: "stdio", command: paths.nodePath, args: [paths.serverPath],
    });
  });
}

test("config CLI emits parseable JSON and resolves paths relative to itself, not cwd", () => {
  const result = spawnSync(process.execPath, [script, "claude-code"], {
    cwd: path.dirname(process.execPath), encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const config = JSON.parse(result.stdout).mcpServers[SERVER_NAME];
  assert.equal(config.command, process.execPath);
  assert.deepEqual(config.args, [server]);
});

test("unknown clients and extra CLI arguments fail without printing a config", () => {
  assert.throws(() => buildConfig("unknown"), /Usage:/);
  for (const args of [[], ["unknown"], ["codex", "unexpected"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Usage:/);
  }
});
