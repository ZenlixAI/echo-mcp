import type { ZodType } from "zod";

import { compileJsonSchema, mapZodIssues } from "./json-schema-zod";

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
  | "SCHEMA_ALREADY_EXISTS"
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

export interface RegisterSchemaSuccessResult {
  [key: string]: unknown;
  ok: true;
  schema_id: string;
  description?: string;
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

export interface RegisterSchemaInput {
  schema_id: string;
  description?: string;
  schema: JsonSchema;
}

export interface GetSchemaInput {
  schema_id: string;
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
  createdAt: string;
}

export class EchoService {
  private readonly registries = new Map<string, Map<string, SchemaRegistryEntry>>();

  registerSchema(
    sessionId: string,
    input: RegisterSchemaInput,
  ): RegisterSchemaSuccessResult | EchoErrorResult {
    if (!input.schema_id) {
      return this.invalidRequest("schema_id is required.");
    }

    const registry = this.getOrCreateRegistry(sessionId);
    if (registry.has(input.schema_id)) {
      return this.errorResult(
        "SCHEMA_ALREADY_EXISTS",
        `Schema '${input.schema_id}' already exists.`,
        input.schema_id,
      );
    }

    const compiled = compileJsonSchema(input.schema);
    if (!compiled.ok) {
      return this.errorResult(
        "INVALID_SCHEMA_DEFINITION",
        `Schema '${input.schema_id}' is not a valid JSON Schema.`,
        input.schema_id,
      );
    }

    registry.set(input.schema_id, {
      schemaId: input.schema_id,
      description: input.description,
      builtin: false,
      schema: input.schema,
      validator: compiled.schema,
      createdAt: new Date().toISOString(),
    });

    return {
      ok: true,
      schema_id: input.schema_id,
      ...(input.description ? { description: input.description } : {}),
    };
  }

  listSchemas(sessionId: string): SchemaListResult {
    const registry = this.getOrCreateRegistry(sessionId);

    return {
      schemas: Array.from(registry.values()).map((entry) => ({
        schema_id: entry.schemaId,
        ...(entry.description ? { description: entry.description } : {}),
        builtin: entry.builtin,
      })),
    };
  }

  getSchema(sessionId: string, schemaId: string): SchemaDetailResult | EchoErrorResult {
    const entry = this.getOrCreateRegistry(sessionId).get(schemaId);

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

  echo<T>(sessionId: string, input: EchoInput<T>): EchoSuccessResult<T> | EchoErrorResult {
    if (!input.schema_id) {
      return this.invalidRequest("schema_id is required.");
    }

    const entry = this.getOrCreateRegistry(sessionId).get(input.schema_id);
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
        payload: input.payload,
      };
    }

    if (!entry.validator) {
      return this.errorResult(
        "INTERNAL_ERROR",
        `Schema '${input.schema_id}' has no validator.`,
        input.schema_id,
      );
    }

    const parsed = entry.validator.safeParse(input.payload);
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
      payload: input.payload,
    };
  }

  private getOrCreateRegistry(sessionId: string): Map<string, SchemaRegistryEntry> {
    const existing = this.registries.get(sessionId);
    if (existing) {
      return existing;
    }

    const registry = new Map<string, SchemaRegistryEntry>();
    registry.set(SCHEMALESS_SCHEMA_ID, {
      schemaId: SCHEMALESS_SCHEMA_ID,
      description: SCHEMALESS_DESCRIPTION,
      builtin: true,
      schema: null,
      validator: null,
      createdAt: new Date().toISOString(),
    });
    this.registries.set(sessionId, registry);
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
