---
name: echo
description: Use this skill whenever a user asks you to emit machine-readable structured messages through Echo MCP, validate payloads with schema IDs, inspect available schemas, or integrate agent progress/state events with MCP tool returns. Apply it for coding-agent workflows that need reliable JSON-like outputs instead of free-form text.
---

# Echo Skill

Use this skill to operate the Echo MCP server correctly from an agent perspective.

## What Echo MCP does

Echo MCP provides a narrow protocol surface:
- Discover built-in schemas.
- Inspect a schema definition.
- Validate a payload against a schema.
- Return valid payloads unchanged in a stable envelope.

Echo MCP is not a workflow engine and does not execute business actions.

## What to assume in this repository

Treat these as current behavioral facts:
- Tool set is `list_schemas`, `get_schema`, `echo`.
- Schemas are config-driven built-ins loaded from `config/builtin-schemas.json`.
- Runtime schema registration is not available.
- `__schemaless__` is always available for unvalidated payload echo.
- Echo returns payload unchanged on success.
- Errors are protocol errors with machine-readable `error.code`.

Do not invent capabilities like `register_schema` unless the implementation actually adds them.

## Tool reference

### 1. `list_schemas`
Input:
```json
{}
```

Output shape:
```json
{
  "schemas": [
    {
      "schema_id": "__schemaless__",
      "description": "Built-in schema for unvalidated payload echo",
      "builtin": true
    }
  ]
}
```

### 2. `get_schema`
Input:
```json
{
  "schema_id": "zenlix-agent-stage-v1"
}
```

Output shape:
```json
{
  "schema_id": "zenlix-agent-stage-v1",
  "description": "Agent stage status event",
  "builtin": true,
  "schema": {
    "type": "object"
  }
}
```

If missing:
```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_NOT_FOUND",
    "message": "Schema '...' was not found.",
    "schema_id": "..."
  }
}
```

### 3. `echo`
Input:
```json
{
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "analysis",
    "stage_status": "running",
    "next_stage": "implementation",
    "extra": {
      "task_id": "T-123"
    }
  }
}
```

Success output:
```json
{
  "ok": true,
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "analysis",
    "stage_status": "running",
    "next_stage": "implementation",
    "extra": {
      "task_id": "T-123"
    }
  }
}
```

Validation failure output:
```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "Payload does not conform to schema 'zenlix-agent-stage-v1'.",
    "schema_id": "zenlix-agent-stage-v1",
    "details": [
      {
        "path": "/stage_status",
        "message": "Invalid option: expected one of \"start\"|\"running\"|\"success\"|\"failed\""
      }
    ]
  }
}
```

## Standard operating flow for agents

Use this sequence unless the schema is already known and stable:
1. Call `list_schemas` to discover available schema IDs.
2. Choose a schema ID, then call `get_schema` to confirm exact constraints.
3. Build payload to match the schema.
4. Call `echo`.
5. If `ok: false`, repair payload based on `error.code` and `error.details`, then retry.

## When to use `__schemaless__`

Use `__schemaless__` when:
- You need temporary structured output quickly.
- No suitable built-in schema exists.
- The payload is exploratory/debug-oriented.

Avoid using `__schemaless__` for stable integrations that need strict validation.

Example:
```json
{
  "schema_id": "__schemaless__",
  "payload": {
    "event": "debug_snapshot",
    "step": "retrieval_done",
    "hits": 12
  }
}
```

## Error handling playbook

- `SCHEMA_NOT_FOUND`:
  - Re-run `list_schemas`.
  - Fix typos or switch to an existing schema.
  - Use `__schemaless__` only if strict validation is not required.

- `SCHEMA_VALIDATION_FAILED`:
  - Read `error.details` paths.
  - Repair types/required fields/enums/additional properties.
  - Retry `echo` with corrected payload.

- `INVALID_REQUEST`:
  - Ensure required input fields are present and non-empty.

- `INTERNAL_ERROR`:
  - Treat as server-side issue; report clearly and stop retry loops.

## Practical guidance for coding agents

- Keep payload semantics in your own task logic; Echo MCP only validates and echoes.
- Do not expect Echo MCP to transform or enrich payload fields.
- Prefer explicit, stable schema IDs in prompts and tool calls.
- If the user wants strict machine consumption, avoid free-form prose and rely on Echo tool return payload.

## Output discipline

When reporting results to users after tool calls:
- State the schema ID used.
- State whether validation passed.
- Include the echoed payload (or key fields) for downstream programmatic use.
- If failed, include `error.code` and concise remediation.

## Quick checklist before finishing

- Schema exists (`list_schemas` / `get_schema`).
- Payload matches schema requirements.
- `echo` returns `ok: true`.
- Returned payload matches expected structure exactly.
