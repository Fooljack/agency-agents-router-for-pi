#!/usr/bin/env node
"use strict";
/**
 * Regenerate data/agents.json from an agency-agents checkout.
 *
 *   node build-roster.js <path-to-agency-agents>
 *
 * The roster is flattened into one JSON file so the plugin ships as a single
 * data artifact: metadata for ranking plus the verbatim body returned by the
 * `load` tool. Run this again after updating the upstream checkout.
 */
const fs = require("node:fs");
const path = require("node:path");

const repo = process.argv[2];
if (!repo || !fs.existsSync(path.join(repo, "divisions.json"))) {
  console.error("usage: node build-roster.js <path-to-agency-agents>");
  console.error("       (the directory must contain divisions.json)");
  process.exit(2);
}

const divisions = JSON.parse(fs.readFileSync(path.join(repo, "divisions.json"), "utf8")).divisions;

function parseAgent(file) {
  const text = fs.readFileSync(file, "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) return null;
  const fm = m[1];
  const scalar = (key) => {
    const hit = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(fm);
    return hit ? hit[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  const name = scalar("name");
  if (!name) return null;
  let description = "";
  const block = /^description:\s*([\s\S]*?)(?=\n[a-zA-Z][a-zA-Z_-]*:\s|\s*$)/m.exec(fm);
  if (block) description = block[1].trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
  return {
    name,
    description,
    color: scalar("color"),
    emoji: scalar("emoji"),
    vibe: scalar("vibe"),
    body: m[2].replace(/^\r?\n/, ""),
  };
}

// Divisions may nest tool-specific subdirectories (game-development/{unity,...}).
function collect(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collect(full));
    else if (entry.name.toLowerCase().endsWith(".md")) found.push(full);
  }
  return found;
}

const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const agents = [];
const skipped = [];
for (const division of Object.keys(divisions).sort()) {
  const dir = path.join(repo, division);
  if (!fs.existsSync(dir)) continue;
  for (const file of collect(dir)) {
    const parsed = parseAgent(file);
    const rel = path.relative(dir, file).replace(/\\/g, "/");
    if (!parsed) {
      skipped.push(`${division}/${rel}: no agent frontmatter`);
      continue;
    }
    const slug = slugify(parsed.name);
    if (agents.some((a) => a.slug === slug)) {
      skipped.push(`${division}/${rel}: duplicate slug ${slug}`);
      continue;
    }
    agents.push({
      slug,
      name: parsed.name,
      division,
      ...(rel.includes("/") ? { subdivision: rel.split("/").slice(0, -1).join("/") } : {}),
      description: parsed.description,
      ...(parsed.vibe ? { vibe: parsed.vibe } : {}),
      ...(parsed.color ? { color: parsed.color } : {}),
      ...(parsed.emoji ? { emoji: parsed.emoji } : {}),
      source_path: `${division}/${rel}`,
      bytes: Buffer.byteLength(parsed.body, "utf8"),
      body: parsed.body,
    });
  }
}
agents.sort((a, b) => a.division.localeCompare(b.division) || a.slug.localeCompare(b.slug));

const counts = {};
for (const a of agents) counts[a.division] = (counts[a.division] || 0) + 1;

const git = (args) => {
  try {
    return require("node:child_process").execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
  } catch { return "unknown"; }
};

const payload = {
  schema: 1,
  source: {
    repository: "https://github.com/msitarzewski/agency-agents",
    license: "MIT",
    commit: git(["rev-parse", "HEAD"]),
    commit_date: git(["log", "-1", "--format=%ci"]),
    generated_at: new Date().toISOString().slice(0, 10),
  },
  agentCount: agents.length,
  divisions: Object.keys(divisions).sort()
    .filter((key) => counts[key])
    .map((key) => ({ key, label: divisions[key].label, count: counts[key] })),
  agents,
};

const outDir = path.join(__dirname, "data");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "agents.json");
fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 1)}\n`, "utf8");

const bytes = fs.statSync(outFile).size;
console.log(`agents : ${agents.length}`);
console.log(`divisions: ${payload.divisions.length}`);
console.log(`wrote  : ${path.relative(process.cwd(), outFile)} (${(bytes / 1048576).toFixed(2)} MB)`);
console.log(`upstream commit: ${payload.source.commit} (${payload.source.commit_date})`);
if (skipped.length) {
  console.log("");
  console.log(`skipped ${skipped.length}:`);
  for (const line of skipped.slice(0, 10)) console.log(`  ${line}`);
}
