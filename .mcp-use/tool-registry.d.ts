// Auto-generated tool registry types - DO NOT EDIT MANUALLY
// This file is regenerated whenever tools are added, removed, or updated during development
// Generated at: 2026-03-30T05:12:39.628Z

declare module "mcp-use/react" {
  interface ToolRegistry {
    "echo": {
      input: { "schema_id": string; "payload": unknown };
      output: Record<string, unknown>;
    };
    "get_schema": {
      input: { "schema_id": string };
      output: Record<string, unknown>;
    };
    "list_schemas": {
      input: Record<string, never>;
      output: Record<string, unknown>;
    };
    "register_schema": {
      input: { "schema_id": string; "description"?: string | undefined; "schema": boolean | Record<string, unknown> };
      output: Record<string, unknown>;
    };
  }
}

export {};
