import { describe, expect, it } from "vitest";

import {
  EchoService,
  SCHEMALESS_SCHEMA_ID,
  type JsonSchema,
} from "../src/echo-service";

const reportOutlineSchema: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          heading: { type: "string" },
        },
        required: ["index", "heading"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "items"],
  additionalProperties: false,
};

describe("EchoService", () => {
  it("registers a valid schema and lists builtin plus custom schemas", () => {
    const service = new EchoService();

    const registerResult = service.registerSchema("session-a", {
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      schema: reportOutlineSchema,
    });

    expect(registerResult).toEqual({
      ok: true,
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
    });

    expect(service.listSchemas("session-a")).toEqual({
      schemas: [
        {
          schema_id: SCHEMALESS_SCHEMA_ID,
          description: "Built-in schema for unvalidated payload echo",
          builtin: true,
        },
        {
          schema_id: "report_outline_v1",
          description: "Ordered report outline",
          builtin: false,
        },
      ],
    });
  });

  it("rejects duplicate schema ids in the same session", () => {
    const service = new EchoService();

    service.registerSchema("session-a", {
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      schema: reportOutlineSchema,
    });

    expect(
      service.registerSchema("session-a", {
        schema_id: "report_outline_v1",
        description: "Duplicate",
        schema: reportOutlineSchema,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "SCHEMA_ALREADY_EXISTS",
        message: "Schema 'report_outline_v1' already exists.",
        schema_id: "report_outline_v1",
      },
    });
  });

  it("returns schema details for custom and builtin schemas", () => {
    const service = new EchoService();

    service.registerSchema("session-a", {
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      schema: reportOutlineSchema,
    });

    expect(service.getSchema("session-a", "report_outline_v1")).toEqual({
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      builtin: false,
      schema: reportOutlineSchema,
    });

    expect(service.getSchema("session-a", SCHEMALESS_SCHEMA_ID)).toEqual({
      schema_id: SCHEMALESS_SCHEMA_ID,
      description: "Built-in schema for unvalidated payload echo",
      builtin: true,
      schema: null,
    });
  });

  it("echoes payload unchanged when it matches the registered schema", () => {
    const service = new EchoService();

    service.registerSchema("session-a", {
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      schema: reportOutlineSchema,
    });

    const payload = {
      title: "Q2 Review",
      items: [
        { index: 1, heading: "Executive Summary" },
        { index: 2, heading: "Financial Highlights" },
      ],
    };

    expect(
      service.echo("session-a", {
        schema_id: "report_outline_v1",
        payload,
      }),
    ).toEqual({
      ok: true,
      schema_id: "report_outline_v1",
      payload,
    });
  });

  it("returns stable validation errors for invalid payloads", () => {
    const service = new EchoService();

    service.registerSchema("session-a", {
      schema_id: "workflow_stage_v1",
      description: "Workflow stage notification",
      schema: {
        type: "object",
        properties: {
          event_type: { type: "string" },
          stage: { type: "string" },
          sequence: { type: "integer" },
        },
        required: ["event_type", "stage", "sequence"],
        additionalProperties: false,
      },
    });

    expect(
      service.echo("session-a", {
        schema_id: "workflow_stage_v1",
        payload: {
          event_type: "analysis_started",
          stage: "analysis",
          sequence: "1",
        },
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: "Payload does not conform to schema 'workflow_stage_v1'.",
        schema_id: "workflow_stage_v1",
        details: [
          {
            path: "/sequence",
            message: "must be integer",
          },
        ],
      },
    });
  });

  it("supports explicit schemaless echo", () => {
    const service = new EchoService();
    const payload = {
      kind: "debug_snapshot",
      raw: {
        step: "retrieval_done",
        hits: 12,
      },
    };

    expect(
      service.echo("session-a", {
        schema_id: SCHEMALESS_SCHEMA_ID,
        payload,
      }),
    ).toEqual({
      ok: true,
      schema_id: SCHEMALESS_SCHEMA_ID,
      payload,
    });
  });

  it("validates nested arrays and objects with the registered schema", () => {
    const service = new EchoService();

    service.registerSchema("session-a", {
      schema_id: "travel_plan_v1",
      description: "Nested travel plan schema",
      schema: {
        type: "object",
        properties: {
          traveler: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
            additionalProperties: false,
          },
          stops: {
            type: "array",
            items: {
              type: "object",
              properties: {
                city: { type: "string" },
                days: { type: "integer" },
              },
              required: ["city", "days"],
              additionalProperties: false,
            },
          },
        },
        required: ["traveler", "stops"],
        additionalProperties: false,
      },
    });

    expect(
      service.echo("session-a", {
        schema_id: "travel_plan_v1",
        payload: {
          traveler: { name: "Tao" },
          stops: [
            { city: "Tokyo", days: 3 },
            { city: "Osaka", days: 2 },
          ],
        },
      }),
    ).toEqual({
      ok: true,
      schema_id: "travel_plan_v1",
      payload: {
        traveler: { name: "Tao" },
        stops: [
          { city: "Tokyo", days: 3 },
          { city: "Osaka", days: 2 },
        ],
      },
    });
  });

  it("isolates schemas per session and protects the builtin schema id", () => {
    const service = new EchoService();

    service.registerSchema("session-a", {
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      schema: reportOutlineSchema,
    });

    expect(service.getSchema("session-b", "report_outline_v1")).toEqual({
      ok: false,
      error: {
        code: "SCHEMA_NOT_FOUND",
        message: "Schema 'report_outline_v1' was not found.",
        schema_id: "report_outline_v1",
      },
    });

    expect(
      service.registerSchema("session-a", {
        schema_id: SCHEMALESS_SCHEMA_ID,
        description: "override",
        schema: reportOutlineSchema,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "SCHEMA_ALREADY_EXISTS",
        message: `Schema '${SCHEMALESS_SCHEMA_ID}' already exists.`,
        schema_id: SCHEMALESS_SCHEMA_ID,
      },
    });
  });

  it("rejects invalid schema definitions", () => {
    const service = new EchoService();

    expect(
      service.registerSchema("session-a", {
        schema_id: "broken_schema",
        description: "Broken",
        schema: {
          type: "object",
          properties: {
            title: { type: "not-a-real-json-schema-type" },
          },
        },
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_SCHEMA_DEFINITION",
        message: "Schema 'broken_schema' is not a valid JSON Schema.",
        schema_id: "broken_schema",
      },
    });
  });
});
