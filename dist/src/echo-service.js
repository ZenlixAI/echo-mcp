import { compileJsonSchema, mapZodIssues } from "./json-schema-zod";
const SCHEMALESS_SCHEMA_ID = "__schemaless__";
const SCHEMALESS_DESCRIPTION = "Built-in schema for unvalidated payload echo";
class EchoService {
  registries = /* @__PURE__ */ new Map();
  registerSchema(sessionId, input) {
    if (!input.schema_id) {
      return this.invalidRequest("schema_id is required.");
    }
    const registry = this.getOrCreateRegistry(sessionId);
    if (registry.has(input.schema_id)) {
      return this.errorResult(
        "SCHEMA_ALREADY_EXISTS",
        `Schema '${input.schema_id}' already exists.`,
        input.schema_id
      );
    }
    const compiled = compileJsonSchema(input.schema);
    if (!compiled.ok) {
      return this.errorResult(
        "INVALID_SCHEMA_DEFINITION",
        `Schema '${input.schema_id}' is not a valid JSON Schema.`,
        input.schema_id
      );
    }
    registry.set(input.schema_id, {
      schemaId: input.schema_id,
      description: input.description,
      builtin: false,
      schema: input.schema,
      validator: compiled.schema,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      ok: true,
      schema_id: input.schema_id,
      ...input.description ? { description: input.description } : {}
    };
  }
  listSchemas(sessionId) {
    const registry = this.getOrCreateRegistry(sessionId);
    return {
      schemas: Array.from(registry.values()).map((entry) => ({
        schema_id: entry.schemaId,
        ...entry.description ? { description: entry.description } : {},
        builtin: entry.builtin
      }))
    };
  }
  getSchema(sessionId, schemaId) {
    const entry = this.getOrCreateRegistry(sessionId).get(schemaId);
    if (!entry) {
      return this.errorResult(
        "SCHEMA_NOT_FOUND",
        `Schema '${schemaId}' was not found.`,
        schemaId
      );
    }
    return {
      schema_id: entry.schemaId,
      ...entry.description ? { description: entry.description } : {},
      builtin: entry.builtin,
      schema: entry.schema
    };
  }
  echo(sessionId, input) {
    if (!input.schema_id) {
      return this.invalidRequest("schema_id is required.");
    }
    const entry = this.getOrCreateRegistry(sessionId).get(input.schema_id);
    if (!entry) {
      return this.errorResult(
        "SCHEMA_NOT_FOUND",
        `Schema '${input.schema_id}' was not found.`,
        input.schema_id
      );
    }
    if (entry.schemaId === SCHEMALESS_SCHEMA_ID) {
      return {
        ok: true,
        schema_id: entry.schemaId,
        payload: input.payload
      };
    }
    if (!entry.validator) {
      return this.errorResult(
        "INTERNAL_ERROR",
        `Schema '${input.schema_id}' has no validator.`,
        input.schema_id
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
          details: mapZodIssues(parsed.error.issues)
        }
      };
    }
    return {
      ok: true,
      schema_id: entry.schemaId,
      payload: input.payload
    };
  }
  getOrCreateRegistry(sessionId) {
    const existing = this.registries.get(sessionId);
    if (existing) {
      return existing;
    }
    const registry = /* @__PURE__ */ new Map();
    registry.set(SCHEMALESS_SCHEMA_ID, {
      schemaId: SCHEMALESS_SCHEMA_ID,
      description: SCHEMALESS_DESCRIPTION,
      builtin: true,
      schema: null,
      validator: null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.registries.set(sessionId, registry);
    return registry;
  }
  invalidRequest(message) {
    return this.errorResult("INVALID_REQUEST", message);
  }
  errorResult(code, message, schemaId) {
    return {
      ok: false,
      error: {
        code,
        message,
        ...schemaId ? { schema_id: schemaId } : {}
      }
    };
  }
}
export {
  EchoService,
  SCHEMALESS_DESCRIPTION,
  SCHEMALESS_SCHEMA_ID
};
//# sourceMappingURL=echo-service.js.map
