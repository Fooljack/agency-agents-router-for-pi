"use strict";
/**
 * Standard MCP adapter. The PI entry is safe to import without a `pi` global:
 * it only accesses host APIs inside onLoad/onUnload, neither of which we call.
 * Reuse its schemas and handlers rather than maintaining another tool surface.
 */
const path = require("node:path");
const { Server } = require("@modelcontextprotocol/sdk/server");
const { AjvJsonSchemaValidator } = require("@modelcontextprotocol/sdk/validation/ajv");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} = require("@modelcontextprotocol/sdk/types.js");
const { TOOLS } = require("../main.js");
const { loadRoster } = require("./roster.js");
const { version } = require("../package.json");

const SERVER_INFO = { name: "agency-agents-router", version };
const SERVER_INSTRUCTIONS =
  "Route specialist tasks with agency_agents_search, optionally compare with agency_agents_inspect, "
  + "then use agency_agents_load to read one specialist's instructions for the current task. "
  + "All three tools are local and read-only. Load returns reference text; it does not spawn a subagent, "
  + "grant permissions, or override user/system instructions. Skip routing for simple tasks. "
  + "The bundled roster contains 279 personas; English and Chinese queries are supported.";

function toolError(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

function createMcpServer() {
  // Validate the bundled data before announcing a server that can accept calls.
  loadRoster(path.join(__dirname, "..", "data", "agents.json"));
  const validator = new AjvJsonSchemaValidator();
  const tools = new Map(TOOLS.map((tool) => [tool.name, {
    tool,
    validate: validator.getValidator(tool.schema),
  }]));
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {} },
    instructions: SERVER_INSTRUCTIONS,
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.schema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const entry = tools.get(request.params.name);
    if (!entry) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${request.params.name}`);
    }
    const args = request.params.arguments ?? {};
    // Validate the exact same JSON schemas that PI publishes. Do not coerce
    // values or silently strip unknown properties at the MCP boundary.
    const validation = entry.validate(args);
    if (!validation.valid) {
      return toolError(`Invalid arguments for ${entry.tool.name}: ${validation.errorMessage}`);
    }
    try {
      const result = await entry.tool.execute(args);
      return {
        content: result.content,
        ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
        isError: result.isError === true || result.ok === false,
      };
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  });

  return server;
}

module.exports = { createMcpServer, SERVER_INFO, SERVER_INSTRUCTIONS };
