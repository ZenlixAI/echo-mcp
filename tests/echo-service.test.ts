import { describe, expect, it } from "vitest";

import {
  EchoService,
  SCHEMALESS_SCHEMA_ID,
  type BuiltinSchemaConfig,
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
  const builtins: BuiltinSchemaConfig[] = [
    {
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      schema: reportOutlineSchema,
    },
    {
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
    },
    {
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
    },
  ];

  it("lists only built-in schemas from configuration plus schemaless", () => {
    const service = new EchoService({ builtins });

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
          builtin: true,
        },
        {
          schema_id: "travel_plan_v1",
          description: "Nested travel plan schema",
          builtin: true,
        },
        {
          schema_id: "workflow_stage_v1",
          description: "Workflow stage notification",
          builtin: true,
        },
      ],
    });
  });

  it("returns schema details for configured builtins and schemaless", () => {
    const service = new EchoService({ builtins });

    expect(service.getSchema("session-a", "report_outline_v1")).toEqual({
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      builtin: true,
      schema: reportOutlineSchema,
    });

    expect(service.getSchema("session-a", SCHEMALESS_SCHEMA_ID)).toEqual({
      schema_id: SCHEMALESS_SCHEMA_ID,
      description: "Built-in schema for unvalidated payload echo",
      builtin: true,
      schema: null,
    });
  });

  it("echoes payload unchanged when it matches a builtin schema", () => {
    const service = new EchoService({ builtins });

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

  it("parses string payload as JSON when possible before validation", () => {
    const service = new EchoService({ builtins });

    expect(
      service.echo("session-a", {
        schema_id: "report_outline_v1",
        payload: JSON.stringify({
          title: "Q2 Review",
          items: [
            { index: 1, heading: "Executive Summary" },
            { index: 2, heading: "Financial Highlights" },
          ],
        }),
      }),
    ).toEqual({
      ok: true,
      schema_id: "report_outline_v1",
      payload: {
        title: "Q2 Review",
        items: [
          { index: 1, heading: "Executive Summary" },
          { index: 2, heading: "Financial Highlights" },
        ],
      },
    });
  });

  it("keeps payload as string when string payload is not valid JSON", () => {
    const service = new EchoService({
      builtins: [
        {
          schema_id: "plain_text_v1",
          description: "Plain text payload",
          schema: { type: "string" },
        },
      ],
    });

    expect(
      service.echo("session-a", {
        schema_id: "plain_text_v1",
        payload: "not-a-json",
      }),
    ).toEqual({
      ok: true,
      schema_id: "plain_text_v1",
      payload: "not-a-json",
    });
  });

  it("returns stable validation errors for invalid payloads", () => {
    const service = new EchoService({ builtins });

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
    const service = new EchoService({ builtins });
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

  it("validates nested arrays and objects with builtin schemas", () => {
    const service = new EchoService({ builtins });

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

  it("keeps behavior identical across sessions because schemas are built-in", () => {
    const service = new EchoService({ builtins });

    expect(service.getSchema("session-a", "report_outline_v1")).toEqual({
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      builtin: true,
      schema: reportOutlineSchema,
    });
    expect(service.getSchema("session-b", "report_outline_v1")).toEqual({
      schema_id: "report_outline_v1",
      description: "Ordered report outline",
      builtin: true,
      schema: reportOutlineSchema,
    });
  });

  it("fails fast when builtin config contains invalid schema definition", () => {
    expect(
      () =>
        new EchoService({
          builtins: [
            {
              schema_id: "broken_schema",
              description: "Broken",
              schema: {
                type: "object",
                properties: {
                  title: { type: "not-a-real-json-schema-type" },
                },
              },
            },
          ],
        }),
    ).toThrow("Built-in schema 'broken_schema' is not a valid JSON Schema.");
  });

  it("fails fast when builtin config tries to redefine schemaless", () => {
    expect(
      () =>
        new EchoService({
          builtins: [
            {
              schema_id: SCHEMALESS_SCHEMA_ID,
              description: "override",
              schema: reportOutlineSchema,
            },
          ],
        }),
    ).toThrow(`Schema id '${SCHEMALESS_SCHEMA_ID}' is reserved.`);
  });
});
