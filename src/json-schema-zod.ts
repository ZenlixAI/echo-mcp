import { z, type ZodIssue, type ZodType } from "zod";

import type { ErrorDetail, JsonSchema } from "./echo-service";

interface CompileSuccess {
  ok: true;
  schema: ZodType;
}

interface CompileFailure {
  ok: false;
}

type CompileResult = CompileSuccess | CompileFailure;

interface ObjectSchemaDefinition {
  type: "object";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

interface ArraySchemaDefinition {
  type: "array";
  items?: JsonSchema;
}

interface StringSchemaDefinition {
  type: "string";
  minLength?: number;
  maxLength?: number;
  enum?: string[];
}

interface IntegerSchemaDefinition {
  type: "integer";
  minimum?: number;
  maximum?: number;
}

interface NumberSchemaDefinition {
  type: "number";
  minimum?: number;
  maximum?: number;
}

interface BooleanSchemaDefinition {
  type: "boolean";
}

interface NullSchemaDefinition {
  type: "null";
}

type SupportedSchemaDefinition =
  | ObjectSchemaDefinition
  | ArraySchemaDefinition
  | StringSchemaDefinition
  | IntegerSchemaDefinition
  | NumberSchemaDefinition
  | BooleanSchemaDefinition
  | NullSchemaDefinition;

export function compileJsonSchema(schema: JsonSchema): CompileResult {
  if (typeof schema === "boolean") {
    return {
      ok: true,
      schema: schema ? z.unknown() : z.never(),
    };
  }

  const compiled = compileDefinition(schema);
  return compiled ? { ok: true, schema: compiled } : { ok: false };
}

export function mapZodIssues(issues: ZodIssue[]): ErrorDetail[] {
  return issues.map((issue) => ({
    path: issue.path.length > 0 ? `/${issue.path.join("/")}` : undefined,
    message: issueMessage(issue),
  }));
}

function compileDefinition(definition: Record<string, unknown>): ZodType | null {
  if (Array.isArray(definition.type)) {
    return null;
  }

  const type = definition.type;
  if (typeof type !== "string") {
    return null;
  }

  switch (type) {
    case "object":
      return compileObject(definition as unknown as ObjectSchemaDefinition);
    case "array":
      return compileArray(definition as unknown as ArraySchemaDefinition);
    case "string":
      return compileString(definition as unknown as StringSchemaDefinition);
    case "integer":
      return compileInteger(definition as unknown as IntegerSchemaDefinition);
    case "number":
      return compileNumber(definition as unknown as NumberSchemaDefinition);
    case "boolean":
      return z.boolean();
    case "null":
      return z.null();
    default:
      return null;
  }
}

function compileObject(definition: ObjectSchemaDefinition): ZodType | null {
  const properties = definition.properties ?? {};
  const required = new Set(definition.required ?? []);
  const shape: Record<string, ZodType> = {};

  for (const [key, propertySchema] of Object.entries(properties)) {
    const compiled = compileJsonSchema(propertySchema);
    if (!compiled.ok) {
      return null;
    }

    shape[key] = required.has(key) ? compiled.schema : compiled.schema.optional();
  }

  let objectSchema = z.object(shape);
  if (definition.additionalProperties === false) {
    objectSchema = objectSchema.strict();
  }

  return objectSchema;
}

function compileArray(definition: ArraySchemaDefinition): ZodType | null {
  if (definition.items === undefined) {
    return null;
  }

  const compiled = compileJsonSchema(definition.items);
  if (!compiled.ok) {
    return null;
  }

  return z.array(compiled.schema);
}

function compileString(definition: StringSchemaDefinition): ZodType {
  if (definition.enum) {
    return z.enum(definition.enum as [string, ...string[]]);
  }

  let schema = z.string();
  if (typeof definition.minLength === "number") {
    schema = schema.min(definition.minLength);
  }
  if (typeof definition.maxLength === "number") {
    schema = schema.max(definition.maxLength);
  }
  return schema;
}

function compileInteger(definition: IntegerSchemaDefinition): ZodType {
  let schema = z
    .number({
      error: () => "must be integer",
    })
    .int("must be integer");

  if (typeof definition.minimum === "number") {
    schema = schema.min(definition.minimum);
  }
  if (typeof definition.maximum === "number") {
    schema = schema.max(definition.maximum);
  }

  return schema;
}

function compileNumber(definition: NumberSchemaDefinition): ZodType {
  let schema = z.number();
  if (typeof definition.minimum === "number") {
    schema = schema.min(definition.minimum);
  }
  if (typeof definition.maximum === "number") {
    schema = schema.max(definition.maximum);
  }
  return schema;
}

function issueMessage(issue: ZodIssue): string {
  if (issue.code === "unrecognized_keys") {
    return "Unrecognized key";
  }

  return issue.message;
}
