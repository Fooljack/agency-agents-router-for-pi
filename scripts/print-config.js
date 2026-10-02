#!/usr/bin/env node
"use strict";
/** Print only: never overwrite a client's existing settings or credentials. */
const path = require("node:path");
const SERVER_NAME = "agency-agents";

function buildConfig(client, {
  nodePath = process.execPath,
  serverPath = path.resolve(__dirname, "..", "mcp-server.js"),
} = {}) {
  if (client === "codex") {
    // JSON-escaped strings are valid TOML basic strings for native file paths.
    return [
      `[mcp_servers.${SERVER_NAME}]`,
      `command = ${JSON.stringify(nodePath)}`,
      `args = ${JSON.stringify([serverPath])}`,
      "startup_timeout_sec = 20",
      "tool_timeout_sec = 60",
      "",
    ].join("\n");
  }
  if (client === "claude-code") {
    return JSON.stringify({
      mcpServers: {
        [SERVER_NAME]: { type: "stdio", command: nodePath, args: [serverPath] },
      },
    }, null, 2) + "\n";
  }
  throw new Error("Usage: node scripts/print-config.js <codex|claude-code>");
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/print-config.js <codex|claude-code>");
    process.stdout.write(buildConfig(process.argv[2]));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildConfig, SERVER_NAME };
