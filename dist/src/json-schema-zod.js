import { z } from "zod";
function compileJsonSchema(schema) {
  if (typeof schema === "boolean") {
    return {
      ok: true,
      schema: schema ? z.unknown() : z.never()
    };
  }
  const compiled = compileDefinition(schema);
  return compiled ? { ok: true, schema: compiled } : { ok: false };
}
function mapZodIssues(issues) {
  return issues.map((issue) => ({
    path: issue.path.length > 0 ? `/${issue.path.join("/")}` : void 0,
    message: issueMessage(issue)
  }));
}
function compileDefinition(definition) {
  if (Array.isArray(definition.type)) {
    return null;
  }
  const type = definition.type;
  if (typeof type !== "string") {
    return null;
  }
  switch (type) {
    case "object":
      return compileObject(definition);
    case "array":
      return compileArray(definition);
    case "string":
      return compileString(definition);
    case "integer":
      return compileInteger(definition);
    case "number":
      return compileNumber(definition);
    case "boolean":
      return z.boolean();
    case "null":
      return z.null();
    default:
      return null;
  }
}
function compileObject(definition) {
  const properties = definition.properties ?? {};
  const required = new Set(definition.required ?? []);
  const shape = {};
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
function compileArray(definition) {
  if (definition.items === void 0) {
    return null;
  }
  const compiled = compileJsonSchema(definition.items);
  if (!compiled.ok) {
    return null;
  }
  return z.array(compiled.schema);
}
function compileString(definition) {
  if (definition.enum) {
    return z.enum(definition.enum);
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
function compileInteger(definition) {
  let schema = z.number({
    error: () => "must be integer"
  }).int("must be integer");
  if (typeof definition.minimum === "number") {
    schema = schema.min(definition.minimum);
  }
  if (typeof definition.maximum === "number") {
    schema = schema.max(definition.maximum);
  }
  return schema;
}
function compileNumber(definition) {
  let schema = z.number();
  if (typeof definition.minimum === "number") {
    schema = schema.min(definition.minimum);
  }
  if (typeof definition.maximum === "number") {
    schema = schema.max(definition.maximum);
  }
  return schema;
}
function issueMessage(issue) {
  if (issue.code === "unrecognized_keys") {
    return "Unrecognized key";
  }
  return issue.message;
}
export {
  compileJsonSchema,
  mapZodIssues
};
//# sourceMappingURL=json-schema-zod.js.map
