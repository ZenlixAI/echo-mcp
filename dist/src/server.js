import { MCPServer, object } from "mcp-use/server";
import { z } from "zod";
import { EchoService } from "./echo-service";
const jsonSchemaInput = z.union([
  z.boolean(),
  z.record(z.string(), z.unknown())
]);
const registerSchemaInput = z.object({
  schema_id: z.string().min(1).describe("Unique schema identifier within the current session"),
  description: z.string().optional().describe("Optional human-readable description for discovery"),
  schema: jsonSchemaInput.describe("JSON Schema definition used to validate payloads")
});
const getSchemaInput = z.object({
  schema_id: z.string().min(1).describe("Schema identifier to fetch from the current session")
});
const echoInput = z.object({
  schema_id: z.string().min(1).describe("Schema identifier to validate against"),
  payload: z.unknown().describe("Structured payload to validate and echo back unchanged")
});
function getSessionId(ctx) {
  return ctx.session?.sessionId ?? "local-session";
}
function createServer(service = new EchoService()) {
  const server = new MCPServer({
    name: "zenlix-echo-mcp",
    title: "Echo MCP",
    version: "1.0.0",
    description: "Session-scoped schema registry and payload echo service for structured MCP tool returns",
    baseUrl: process.env.MCP_URL || "http://localhost:3000",
    favicon: "favicon.ico",
    websiteUrl: "https://github.com/zenlix/echo-mcp",
    icons: [
      {
        src: "icon.svg",
        mimeType: "image/svg+xml",
        sizes: ["512x512"]
      }
    ]
  });
  server.tool(
    {
      name: "register_schema",
      description: "Register a JSON Schema in the current MCP session for later echo validation",
      schema: registerSchemaInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (input, ctx) => object(service.registerSchema(getSessionId(ctx), input))
  );
  server.tool(
    {
      name: "list_schemas",
      description: "List schema identifiers available in the current MCP session",
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (_input, ctx) => object(service.listSchemas(getSessionId(ctx)))
  );
  server.tool(
    {
      name: "get_schema",
      description: "Fetch the full definition for a schema available in the current MCP session",
      schema: getSchemaInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (input, ctx) => object(service.getSchema(getSessionId(ctx), input.schema_id))
  );
  server.tool(
    {
      name: "echo",
      description: "Validate a payload against a session schema and return the payload unchanged in a stable envelope",
      schema: echoInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (input, ctx) => object(service.echo(getSessionId(ctx), input))
  );
  return server;
}
export {
  createServer
};
//# sourceMappingURL=server.js.map
