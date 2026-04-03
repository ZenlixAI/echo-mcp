import type { ZodType } from "zod";

import { compileJsonSchema, mapZodIssues } from "./json-schema-zod.js";

export const SCHEMALESS_SCHEMA_ID = "__schemaless__";
export const SCHEMALESS_DESCRIPTION =
  "Built-in schema for unvalidated payload echo";

export type JsonSchema = boolean | Record<string, unknown>;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type EchoErrorCode =
  | "INVALID_REQUEST"
  | "SCHEMA_NOT_FOUND"
  | "INVALID_SCHEMA_DEFINITION"
  | "SCHEMA_VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  path?: string;
  message: string;
}

export interface EchoErrorResult {
  [key: string]: unknown;
  ok: false;
  error: {
    code: EchoErrorCode;
    message: string;
    schema_id?: string;
    details?: ErrorDetail[];
  };
}

export interface EchoSuccessResult<T = unknown> {
  [key: string]: unknown;
  ok: true;
  schema_id: string;
  payload: T;
}

export interface SchemaListResult {
  [key: string]: unknown;
  schemas: Array<{
    schema_id: string;
    description?: string;
    builtin: boolean;
  }>;
}

export interface SchemaDetailResult {
  [key: string]: unknown;
  schema_id: string;
  description?: string;
  builtin: boolean;
  schema: JsonSchema | null;
}

export interface BuiltinSchemaConfig {
  schema_id: string;
  description?: string;
  schema: JsonSchema;
}

export interface EchoServiceOptions {
  builtins?: BuiltinSchemaConfig[];
}

export interface EchoInput<T = unknown> {
  schema_id: string;
  payload: T;
}

interface SchemaRegistryEntry {
  schemaId: string;
  description?: string;
  builtin: boolean;
  schema: JsonSchema | null;
  validator: ZodType | null;
}

export class EchoService {
  private readonly schemaRegistry: Map<string, SchemaRegistryEntry>;

  constructor(options: EchoServiceOptions = {}) {
    this.schemaRegistry = this.buildRegistry(options.builtins ?? []);
  }

  listSchemas(_sessionId: string): SchemaListResult {
    return {
      schemas: Array.from(this.schemaRegistry.values()).map((entry) => ({
        schema_id: entry.schemaId,
        ...(entry.description ? { description: entry.description } : {}),
        builtin: entry.builtin,
      })),
    };
  }

  getSchema(_sessionId: string, schemaId: string): SchemaDetailResult | EchoErrorResult {
    const entry = this.schemaRegistry.get(schemaId);

    if (!entry) {
      return this.errorResult(
        "SCHEMA_NOT_FOUND",
        `Schema '${schemaId}' was not found.`,
        schemaId,
      );
    }

    return {
      schema_id: entry.schemaId,
      ...(entry.description ? { description: entry.description } : {}),
      builtin: entry.builtin,
      schema: entry.schema,
    };
  }

  echo<T>(_sessionId: string, input: EchoInput<T>): EchoSuccessResult<T> | EchoErrorResult {
    if (!input.schema_id) {
      return this.invalidRequest("schema_id is required.");
    }

    const normalizedPayload = this.normalizePayload(input.payload);

    const entry = this.schemaRegistry.get(input.schema_id);
    if (!entry) {
      return this.errorResult(
        "SCHEMA_NOT_FOUND",
        `Schema '${input.schema_id}' was not found.`,
        input.schema_id,
      );
    }

    if (entry.schemaId === SCHEMALESS_SCHEMA_ID) {
      return {
        ok: true,
        schema_id: entry.schemaId,
        payload: normalizedPayload as T,
      };
    }

    if (!entry.validator) {
      return this.errorResult(
        "INTERNAL_ERROR",
        `Schema '${input.schema_id}' has no validator.`,
        input.schema_id,
      );
    }

    const parsed = entry.validator.safeParse(normalizedPayload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "SCHEMA_VALIDATION_FAILED",
          message: `Payload does not conform to schema '${input.schema_id}'.`,
          schema_id: input.schema_id,
          details: mapZodIssues(parsed.error.issues),
        },
      };
    }

    return {
      ok: true,
      schema_id: entry.schemaId,
      payload: normalizedPayload as T,
    };
  }

  private normalizePayload(payload: unknown): unknown {
    if (typeof payload !== "string") {
      return payload;
    }

    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }

  private buildRegistry(builtins: BuiltinSchemaConfig[]): Map<string, SchemaRegistryEntry> {
    const registry = new Map<string, SchemaRegistryEntry>();
    registry.set(SCHEMALESS_SCHEMA_ID, {
      schemaId: SCHEMALESS_SCHEMA_ID,
      description: SCHEMALESS_DESCRIPTION,
      builtin: true,
      schema: null,
      validator: null,
    });

    for (const schemaDef of builtins) {
      if (!schemaDef.schema_id) {
        throw new Error("Built-in schema entry is missing schema_id.");
      }
      if (schemaDef.schema_id === SCHEMALESS_SCHEMA_ID) {
        throw new Error(`Schema id '${SCHEMALESS_SCHEMA_ID}' is reserved.`);
      }
      if (registry.has(schemaDef.schema_id)) {
        throw new Error(`Duplicate built-in schema id '${schemaDef.schema_id}'.`);
      }

      const compiled = compileJsonSchema(schemaDef.schema);
      if (!compiled.ok) {
        throw new Error(`Built-in schema '${schemaDef.schema_id}' is not a valid JSON Schema.`);
      }

      registry.set(schemaDef.schema_id, {
        schemaId: schemaDef.schema_id,
        ...(schemaDef.description ? { description: schemaDef.description } : {}),
        builtin: true,
        schema: schemaDef.schema,
        validator: compiled.schema,
      });
    }

    return registry;
  }

  private invalidRequest(message: string): EchoErrorResult {
    return this.errorResult("INVALID_REQUEST", message);
  }

  private errorResult(
    code: EchoErrorCode,
    message: string,
    schemaId?: string,
  ): EchoErrorResult {
    return {
      ok: false,
      error: {
        code,
        message,
        ...(schemaId ? { schema_id: schemaId } : {}),
      },
    };
  }
}
