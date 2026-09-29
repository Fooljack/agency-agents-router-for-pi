"use strict";
/**
 * Roster routing tests. Pure Node — run with:
 *
 *   node --test tests/roster.test.js
 *
 * These cover the ported ranking/lookup logic and the integrity of the
 * generated data/agents.json, not the PI host.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const rosterLib = require("../lib/roster.js");
const { search, lookup, resolveDivision, expandQuery, scoreAgent, composePrompt, MAX_PROMPT_CHARS } = rosterLib;

const roster = rosterLib.loadRoster(path.join(__dirname, "..", "data", "agents.json"));

test("roster integrity", () => {
  assert.ok(roster.agentCount > 250, `expected the full roster, got ${roster.agentCount}`);
  assert.equal(roster.agentCount, roster.agents.length);
  assert.equal(roster.divisions.length, 18);
  assert.match(roster.source.commit, /^[0-9a-f]{40}$/);
  assert.match(roster.source.generated_at, /^\d{4}-\d{2}-\d{2}$/);

  const slugs = new Set();
  for (const agent of roster.agents) {
    assert.ok(agent.slug && agent.name, `agent without slug/name: ${JSON.stringify(agent).slice(0, 80)}`);
    assert.ok(!slugs.has(agent.slug), `duplicate slug ${agent.slug}`);
    slugs.add(agent.slug);
    assert.ok(agent.body && agent.body.length > 200, `${agent.slug} has an unusably short body`);
    assert.ok(agent.source_path.endsWith(".md"), `${agent.slug} has a bad source_path`);
    assert.equal(agent.bytes, Buffer.byteLength(agent.body, "utf8"));
    assert.ok(agent.division, `${agent.slug} has no division`);
  }

  const counts = roster.divisions.reduce((total, item) => total + item.count, 0);
  assert.equal(counts, roster.agentCount, "division counts must add up to the roster size");
  for (const division of roster.divisions) {
    assert.equal(roster.agents.filter((agent) => agent.division === division.key).length, division.count);
  }
});

test("Chinese queries are bridged to roster keywords", () => {
  const bridged = expandQuery("抖音投放");
  assert.ok(bridged.expansions.includes("paid"));
  assert.ok(bridged.expansions.includes("advertising"));

  const plain = expandQuery("penetration testing");
  assert.deepEqual(plain.expansions, []);
  assert.ok(plain.tokens.has("penetration"));

  // Unmapped Chinese still produces a usable (empty-ASCII) query object.
  const unmapped = expandQuery("今天天气怎么样");
  assert.equal(unmapped.expansions.length, 0);
  assert.equal(unmapped.text, "");
});

test("ranking finds the obvious specialist", () => {
  assert.equal(search(roster, { query: "渗透测试" }).results[0].slug, "penetration-tester");
  assert.equal(search(roster, { query: "前端性能优化" }).results[0].slug, "frontend-developer");
  assert.equal(search(roster, { query: "抖音投放" }).results[0].division, "paid-media");
  assert.equal(search(roster, { query: "level design", division: "game-development" }).results[0].slug, "level-designer");
});

test("search filters, limits and empty results", () => {
  const filtered = search(roster, { query: "ppc", division: "投放", limit: 3 });
  assert.equal(filtered.division, "paid-media");
  assert.ok(filtered.count >= 1);
  assert.ok(filtered.count <= 3);
  assert.ok(filtered.results.length <= 3);

  const browse = search(roster, { division: "游戏" });
  assert.equal(browse.query, "");
  assert.equal(browse.division, "game-development");
  assert.equal(browse.count, roster.agents.filter((agent) => agent.division === "game-development").length);
  assert.ok(browse.results.every((item) => item.division === "game-development"));

  const whole = search(roster);
  assert.equal(whole.division, null);
  assert.equal(whole.count, roster.agentCount);
  assert.equal(whole.returned, rosterLib.DEFAULT_LIMIT);

  assert.equal(search(roster, { query: "zzzzqqqq" }).count, 0);
  assert.equal(search(roster, { query: "zzzzqqqq" }).results.length, 0);

  // limit is clamped rather than trusted.
  assert.equal(search(roster, { query: "security", limit: 0 }).returned, 1);
  assert.equal(search(roster, { query: "security", limit: 999 }).returned, rosterLib.MAX_LIMIT);
  assert.equal(search(roster, { query: "security", limit: "abc" }).returned, rosterLib.DEFAULT_LIMIT);
});

test("an unknown division is reported instead of silently ignored", () => {
  const result = search(roster, { query: "security", division: "not-a-division" });
  assert.equal(result.division, null);
  assert.equal(result.divisionRequested, "not-a-division");
  assert.equal(result.divisionInvalid, true);
  assert.ok(result.count > 0, "results still come back, just unfiltered");

  const good = search(roster, { query: "security", division: "Security" });
  assert.equal(good.division, "security");
  assert.equal(good.divisionInvalid, false);
});

test("resolveDivision accepts keys, labels, subdivisions and Chinese labels", () => {
  assert.equal(resolveDivision(roster, "engineering"), "engineering");
  assert.equal(resolveDivision(roster, "Engineering"), "engineering");
  assert.equal(resolveDivision(roster, "工程"), "engineering");
  assert.equal(resolveDivision(roster, "Game Development"), "game-development");
  assert.equal(resolveDivision(roster, "unity"), "unity", "nested subdivision acts as a filter");
  assert.equal(resolveDivision(roster, "nope"), "");
  assert.equal(resolveDivision(roster, ""), null);
});

test("a subdivision filter only returns that subdivision", () => {
  const result = search(roster, { division: "unity", limit: rosterLib.MAX_LIMIT });
  assert.ok(result.count > 0);
  assert.ok(result.results.every((item) => item.subdivision === "unity"));
});

test("lookup accepts slug, exact name and a unique partial slug", () => {
  const sample = roster.agents[0];
  assert.equal(lookup(roster, sample.slug).slug, sample.slug);
  assert.equal(lookup(roster, sample.name).slug, sample.slug);
  assert.equal(lookup(roster, sample.slug.toUpperCase()).slug, sample.slug, "identifier is case-insensitive");
  assert.equal(lookup(roster, "penetration").slug, "penetration-tester");
  assert.equal(lookup(roster, "not-a-real-agent"), null);
  assert.equal(lookup(roster, ""), null);
});

test("scoring is lexical: no overlap means no match", () => {
  const agent = roster.agents[0];
  assert.equal(scoreAgent(agent, expandQuery("zzzzqqqq").tokens, ""), 0);
  const hit = scoreAgent(agent, expandQuery(agent.name).tokens, String(agent.name).toLowerCase());
  assert.ok(hit > 0, "a name query must score above zero");
});

test("composePrompt frames the specialist as reference material", () => {
  const agent = lookup(roster, "frontend-developer");
  const plain = composePrompt(agent);
  assert.ok(plain.includes("# Frontend Developer (frontend-developer)"));
  assert.ok(plain.includes("Division: engineering"));
  assert.ok(plain.includes(agent.source_path));
  assert.ok(plain.includes("obey the user's request"));
  assert.ok(!plain.includes("## Current task"));

  const tasked = composePrompt(agent, " 审阅登录页性能 ");
  assert.ok(tasked.includes("## Current task\n审阅登录页性能"));
  assert.ok(tasked.includes("## Specialist instructions"));

  const huge = composePrompt({ ...agent, body: "x".repeat(MAX_PROMPT_CHARS * 2) }, "task");
  assert.equal(huge.length, MAX_PROMPT_CHARS);
  assert.ok(huge.endsWith("truncated to fit the router limit.]"));
});
