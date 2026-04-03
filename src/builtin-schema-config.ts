import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BuiltinSchemaConfig, JsonSchema } from "./echo-service.js";

interface RawBuiltinSchemaConfig {
  schema_id?: unknown;
  description?: unknown;
  schema?: unknown;
}

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === "boolean" || (typeof value === "object" && value !== null);
}

export function loadBuiltinSchemasFromConfig(
  configPath = process.env.BUILTIN_SCHEMAS_CONFIG ?? "config/builtin-schemas.json",
): BuiltinSchemaConfig[] {
  const absolutePath = resolve(configPath);
  const fileContent = readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(fileContent) as { schemas?: unknown };

  if (!Array.isArray(parsed.schemas)) {
    throw new Error(`Invalid builtin schema config '${absolutePath}': 'schemas' must be an array.`);
  }

  return parsed.schemas.map((item, index) => {
    const raw = item as RawBuiltinSchemaConfig;
    if (typeof raw.schema_id !== "string" || raw.schema_id.length === 0) {
      throw new Error(
        `Invalid builtin schema config '${absolutePath}': schemas[${index}].schema_id must be a non-empty string.`,
      );
    }
    if (raw.description !== undefined && typeof raw.description !== "string") {
      throw new Error(
        `Invalid builtin schema config '${absolutePath}': schemas[${index}].description must be a string when provided.`,
      );
    }
    if (!isJsonSchema(raw.schema)) {
      throw new Error(
        `Invalid builtin schema config '${absolutePath}': schemas[${index}].schema must be a JSON Schema object or boolean.`,
      );
    }

    return {
      schema_id: raw.schema_id,
      ...(raw.description ? { description: raw.description } : {}),
      schema: raw.schema,
    };
  });
}
