#!/usr/bin/env node
"use strict";

function reportError(error) {
  // stdout is reserved for MCP JSON-RPC. Never log banners or diagnostics there.
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Agency Agents Router: ${message}`);
  if (error?.code === "MODULE_NOT_FOUND") {
    console.error("Install the MCP dependencies in this checkout: npm ci --ignore-scripts");
  }
  process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log("Usage: node mcp-server.js [--help | --version]\nWithout flags, starts the local stdio MCP server.");
    return;
  }
  if (args.length === 1 && args[0] === "--version") {
    console.log(require("./package.json").version);
    return;
  }
  if (args.length) throw new Error(`Unexpected argument: ${args[0]}. Use --help.`);

  const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
  const { createMcpServer } = require("./lib/mcp.js");
  const server = createMcpServer();
  server.onerror = (error) => console.error(`Agency Agents Router MCP: ${error.message}`);

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    server.close().catch(reportError);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  process.stdin.once("end", close);
  // A client may close its read end before disconnecting its write end.
  process.stdout.on("error", (error) => {
    if (error.code !== "EPIPE") reportError(error);
    close();
  });
  await server.connect(new StdioServerTransport());
}

if (require.main === module) main().catch(reportError);
