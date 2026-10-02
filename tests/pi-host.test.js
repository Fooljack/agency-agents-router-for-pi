"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { onLoad, onUnload, TOOLS, TOOL_NAMES } = require("../main.js");
const manifest = require("../manifest.json");
const root = path.resolve(__dirname, "..");

test("PI manifest still describes the same native tools", () => {
  assert.equal(manifest.main, "main.js");
  assert.deepEqual(TOOL_NAMES, manifest.contributes.agentTools.map((tool) => tool.name));
  for (const tool of TOOLS) {
    const declared = manifest.contributes.agentTools.find((item) => item.name === tool.name);
    assert.deepEqual(tool.schema, declared.schema, tool.name);
    assert.equal(tool.risk, "low");
  }
});

test("PI lifecycle registers, executes and unregisters all three tools", async (t) => {
  const previous = global.pi;
  t.after(() => {
    if (previous === undefined) delete global.pi;
    else global.pi = previous;
  });
  const registered = new Map();
  const removed = [];
  global.pi = { agent: {
    async registerTool(tool) { registered.set(tool.name, tool); },
    async unregisterTool(name) {
      removed.push(name);
      if (removed.length === 1) throw new Error("host already removed it");
    },
  } };
  await onLoad();
  assert.deepEqual([...registered.keys()], TOOL_NAMES);
  const search = await registered.get("agency_agents_search").execute({ query: "渗透测试" });
  assert.equal(search.structuredContent.results[0].slug, "penetration-tester");
  assert.equal(search.ok, true);
  const inspect = await registered.get("agency_agents_inspect").execute({ slug: "frontend-developer" });
  assert.equal(inspect.structuredContent.slug, "frontend-developer");
  const load = await registered.get("agency_agents_load").execute({ agent: "frontend-developer", task: "检查页面性能" });
  assert.match(load.text, /检查页面性能/);
  assert.match(load.text, /obey the user's request/);
  const missing = await registered.get("agency_agents_load").execute();
  assert.equal(missing.isError, true);
  await onUnload();
  assert.deepEqual(removed, TOOL_NAMES);
});

test("the minimal PI distribution runs without npm dependencies", (t) => {
  const temp = fs.mkdtempSync(path.join(process.env.PI_SCRATCH_DIR || os.tmpdir(), "agency-pi-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  for (const file of ["main.js", "lib/roster.js", "data/agents.json"]) {
    const dest = path.join(temp, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, file), dest);
  }
  const code = `
    const Module = require('node:module');
    const original = Module._load;
    Module._load = function(id, ...rest) {
      if (id.startsWith('@modelcontextprotocol/')) throw new Error('PI must not load MCP dependencies');
      return original.call(this, id, ...rest);
    };
    const plugin = require(${JSON.stringify(path.join(temp, "main.js"))});
    let count = 0;
    global.pi = { agent: {
      async registerTool(tool) {
        count++;
        const result = await tool.execute(tool.name === 'agency_agents_search' ? {query:'前端'} : {agent:'frontend-developer'});
        if (!result.ok) throw new Error(result.error);
      },
      async unregisterTool() {}
    }};
    plugin.onLoad().then(() => {
      if (count !== 3) throw new Error('Expected 3 PI tools');
      return plugin.onUnload();
    }).catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ["-e", code], {
    cwd: temp, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
});
