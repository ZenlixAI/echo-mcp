import { MCPServer, object } from "mcp-use/server";
import { z } from "zod";

import { EchoService } from "./echo-service.js";
import { loadBuiltinSchemasFromConfig } from "./builtin-schema-config.js";

const getSchemaInput = z.object({
  schema_id: z.string().min(1).describe("Schema identifier to fetch from the current session"),
});

const echoInput = z.object({
  schema_id: z.string().min(1).describe("Schema identifier to validate against"),
  payload: z.unknown().describe("Structured payload to validate and echo back unchanged"),
});

function getSessionId(ctx: { session?: { sessionId?: string } }): string {
  return ctx.session?.sessionId ?? "local-session";
}

export function createServer(service?: EchoService): MCPServer {
  const resolvedService = service ?? new EchoService({ builtins: loadBuiltinSchemasFromConfig() });
  const server = new MCPServer({
    name: "zenlix-echo-mcp",
    title: "Echo MCP",
    version: "1.0.0",
    description:
      "Config-driven built-in schema discovery and payload echo service for structured MCP tool returns",
    baseUrl: process.env.MCP_URL || "http://localhost:3000",
    favicon: "favicon.ico",
    websiteUrl: "https://github.com/zenlix/echo-mcp",
    icons: [
      {
        src: "icon.svg",
        mimeType: "image/svg+xml",
        sizes: ["512x512"],
      },
    ],
  });

  server.tool(
    {
      name: "list_schemas",
      description: "List schema identifiers available in the current MCP session",
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (_input, ctx) => object(resolvedService.listSchemas(getSessionId(ctx))),
  );

  server.tool(
    {
      name: "get_schema",
      description: "Fetch the full definition for a schema available in the current MCP session",
      schema: getSchemaInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input, ctx) => object(resolvedService.getSchema(getSessionId(ctx), input.schema_id)),
  );

  server.tool(
    {
      name: "echo",
      description:
        "Validate a payload against a session schema and return the payload unchanged in a stable envelope",
      schema: echoInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input, ctx) => object(resolvedService.echo(getSessionId(ctx), input)),
  );

  return server;
}
