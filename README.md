# Echo MCP

A lightweight MCP (Model Context Protocol) server that enables Agents to emit structured messages through MCP tool call returns.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-green.svg)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | [中文](README-zh.md)

---

## Table of Contents

- [Background](#background)
- [What is Echo MCP](#what-is-echo-mcp)
- [Key Design Decisions](#key-design-decisions)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Project Structure](#project-structure)

---

## Background

In existing Agent systems, Agents typically communicate intermediate states, stage information, report outlines, and structured results only through natural language text. This creates several challenges:

1. **Clients struggle to extract specific structured data reliably**
2. **Same-type data lacks unified schema and validation**
3. **Business applications must extend SDKs or protocol layers to consume these messages**
4. **Programmatic consumption of Agent outputs is unreliable with just natural language or loose JSON**

**Echo MCP** solves this problem by providing a mechanism to carry structured messages via MCP tool call returns — without modifying the underlying ACP/SDK protocols.

---

## What is Echo MCP

Echo MCP is a **structured message carrier and validation toolkit** that provides three core capabilities:

1. **Built-in Schema Config** — Maintain available schemas through a server-side config file
2. **Schema Discovery** — Query available built-in schemas
3. **Echo/Emit** — Receive payloads, validate against specified schemas, and return unchanged

### What Echo MCP IS NOT

- ❌ A business workflow engine
- ❌ An event bus
- ❌ A rendering layer protocol
- ❌ A permission management system
- ❌ A state management framework

It only provides low-level capabilities without business-layer restrictions.

---

## Key Design Decisions

### 1. MCP Tool Return as Message Carrier

**Echo MCP's output is the MCP tool call return value.**

- No dependency on side-effect stream items
- No additional protocol extensions required for clients
- Clients only need to observe tool returns

### 2. Input Schema = Output Schema

Echo MCP receives valid payloads and returns them unchanged:

- Input schema = Output schema
- No payload transformation, normalization, or field injection
- **"Echo" means exact reproduction**

### 3. Config-Driven Built-ins

- Clients cannot register new schemas at runtime
- Built-in schemas are maintained in `config/builtin-schemas.json`
- The same built-in schema set is available to all sessions

### 4. No Schema Versioning

If a schema changes, use a new schema ID. No explicit version fields or migration mechanisms.

### 5. Built-in Schemaless Mode

A built-in `__schemaless__` schema ID allows unvalidated structured output:

- Useful for quick experiments, debugging, or coarse-grained structured output
- Request envelope is still validated

### 6. Append Semantics (Not Update)

Echo MCP is designed for **appending new structured messages**, not updating previous ones.

If your business needs "updates", include identifiers in the payload (e.g., `entity_id`, `sequence`, `revision`) and let the client fold multiple append messages into the "current state".

### 7. Validation: JSON Schema (External) + Zod (Internal)

- **External schema expression:** JSON Schema (for discovery, exchange, cross-language compatibility)
- **Internal runtime validation:** Zod (for TypeScript/Node.js execution efficiency)

### 8. Structured Error Responses

All errors return machine-readable error codes with detailed field-level information:

```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "Payload does not conform to schema...",
    "schema_id": "zenlix-agent-stage-v1",
    "details": [
      { "path": "/stage", "message": "must be string" }
    ]
  }
}
```

---

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/zenlix/echo-mcp.git
cd echo-mcp

# Install dependencies (requires pnpm)
pnpm install
```

### Development Mode

```bash
pnpm dev
```

The server runs on `http://localhost:3000` by default.

Open [http://localhost:3000/inspector](http://localhost:3000/inspector) in your browser to test the server interactively.

### Build for Production

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Deploy

```bash
pnpm deploy
```

---

## API Reference

Echo MCP exposes 3 MCP tools:

### `list_schemas`

List all built-in schemas (including built-in `__schemaless__`).

**Input:** `{}`

**Output:**
```json
{
  "schemas": [
    { "schema_id": "__schemaless__", "description": "...", "builtin": true },
    { "schema_id": "zenlix-agent-stage-v1", "description": "...", "builtin": true }
  ]
}
```

### `get_schema`

Fetch the full definition of a specific schema.

**Input:** `{"schema_id": "zenlix-agent-stage-v1"}`

**Output:** Schema details including the full JSON Schema definition.

### `echo`

Validate a payload against a schema and return it unchanged.

**Input:**
```json
{
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "authentication",
    "stage_status": "start",
    "next_stage": "authorization",
    "extra": {
      "user_id": "u_123"
    }
  }
}
```

**Output:**
```json
{
  "ok": true,
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "authentication",
    "stage_status": "start",
    "next_stage": "authorization",
    "extra": {
      "user_id": "u_123"
    }
  }
}
```

---

## Examples

### Example 1: Workflow Stage Notifications

`zenlix-agent-stage-v1` is defined in `config/builtin-schemas.json`.

**Emit stage updates:**
```json
{
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "authentication",
    "stage_status": "running",
    "next_stage": "authorization",
    "extra": {
      "user_id": "u_123",
      "user_name": "Alice"
    }
  }
}
```

### Example 2: Minimal Stage Event

```json
{
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "authorization"
  }
}
```

### Example 3: Schemaless Output (Quick Debug)

```json
{
  "schema_id": "__schemaless__",
  "payload": {
    "kind": "debug_snapshot",
    "raw": { "step": "retrieval_done", "hits": 12 }
  }
}
```

---

## Project Structure

```
zenlix-echo-mcp/
├── index.ts              # Process entry point
├── config/
│   └── builtin-schemas.json # Built-in schema configuration
├── src/
│   ├── server.ts         # MCP server assembly and tool registration
│   ├── echo-service.ts   # Built-in schema discovery and echo protocol behavior
│   ├── builtin-schema-config.ts # Built-in schema config loader
│   └── json-schema-zod.ts # JSON Schema to Zod conversion
├── tests/
│   └── echo-service.test.ts  # Protocol and behavior tests
├── docs/
│   └── design-doc.md     # Comprehensive design documentation
├── AGENTS.md             # AI agent navigation guide
└── package.json
```

---

## Documentation

- **[Design Document](docs/design-doc.md)** — Comprehensive product and technical design
- **[AGENTS.md](AGENTS.md)** — AI agent development guide for this repository

---

## License

MIT © [ZenlixAI](https://github.com/ZenlixAI)
