# Echo MCP Agent Map

This file is a map for AI coding agents working in this repository. It is not the full product spec, and it is not a rigid workflow document. Use it to orient yourself quickly, identify the source of truth, and avoid making changes in the wrong layer.

## Purpose

This repository implements Echo MCP: an MCP server for session-scoped schema registration, schema discovery, and payload echo with validation.

The server's job is narrow:
- register schemas for the current session
- list and inspect schemas
- validate payloads against a selected schema
- return valid payloads unchanged inside a stable envelope

It is not a business workflow engine, not a renderer, and not a state machine framework.

## Source Of Truth

The primary source of truth for product and protocol behavior is [docs/design-doc.md](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/docs/design-doc.md).

Treat that document as authoritative for:
- tool surface area
- protocol envelope shape
- error semantics
- session scoping rules
- schemaless behavior
- non-goals and design boundaries

Critical rule:
- If a requested change conflicts with `docs/design-doc.md`, do not directly change code to satisfy it.
- First confirm the change with the user.
- Only after explicit user confirmation should `docs/design-doc.md` be updated.
- After the design doc is updated, align implementation and tests with the new design.

If code and `docs/design-doc.md` diverge, assume the design doc is correct unless the user explicitly approves changing it.

## Project Map

Core implementation files:
- [index.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/index.ts): process entrypoint, creates the server and starts listening
- [src/server.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/src/server.ts): MCP server assembly and tool registration
- [src/echo-service.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/src/echo-service.ts): session-scoped registry and protocol-level behavior
- [src/json-schema-zod.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/src/json-schema-zod.ts): JSON Schema subset to Zod conversion and validation error mapping
- [tests/echo-service.test.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/tests/echo-service.test.ts): protocol and behavior regression tests

Supporting files:
- [package.json](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/package.json): scripts, runtime dependencies, package manager declaration
- [pnpm-lock.yaml](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/pnpm-lock.yaml): lockfile for dependency resolution
- [README.md](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/README.md): lightweight project usage notes
- `.mcp-use/`: generated metadata for the `mcp-use` toolchain
- `dist/`: generated build output
- `public/`: static assets used by the server metadata

## How To Navigate Changes

If you need to change protocol semantics:
- read [docs/design-doc.md](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/docs/design-doc.md) first
- then inspect [src/echo-service.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/src/echo-service.ts)
- then update [tests/echo-service.test.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/tests/echo-service.test.ts)

If you need to change MCP tool definitions:
- start in [src/server.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/src/server.ts)
- preserve stable tool names unless the design doc changes
- keep Zod input schemas descriptive with `.describe()`

If you need to change validation behavior:
- start in [src/json-schema-zod.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/src/json-schema-zod.ts)
- keep externally visible error envelopes stable
- do not silently broaden accepted schema features without checking whether the design doc should reflect it

If you need to change startup or runtime wiring:
- start in [index.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/index.ts) and [src/server.ts](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/src/server.ts)

## Current Behavioral Invariants

Unless the user explicitly approves a design-doc change, preserve these invariants:
- Echo MCP returns structured data via MCP tool return values
- `echo` returns payloads unchanged on success
- schema IDs are unique within a session
- schemas are session-scoped, not global
- `__schemaless__` remains an explicit builtin concept
- validation failures are protocol errors, not business errors
- success and error envelopes remain stable and machine-readable
- discovery via schema listing and schema lookup remains available

## Change Boundaries

Safe implementation changes usually include:
- refactoring internals without changing observable behavior
- improving code structure
- improving tests
- tightening validation only when it already matches the design doc

Changes that should trigger extra scrutiny:
- changing tool names
- changing result envelope shape
- changing error codes
- changing session scoping rules
- changing schemaless behavior
- changing what subset of schema features is officially supported
- changing whether payloads are returned exactly as sent

If any of those changes are requested and they conflict with the design doc, stop and get user confirmation before editing the design doc.

## Testing And Verification

Use `pnpm`, not `npm`.

Primary commands:
- `pnpm test`
- `pnpm build`

When changing protocol behavior, update tests first or at minimum in the same change.

Do not claim behavior is fixed or complete unless the relevant verification commands have been run successfully.

## Working Norms For Agents

When working in this repository:
- prefer reading the design doc before making behavioral changes
- prefer changing tests alongside implementation
- keep `AGENTS.md` as a map, not a procedural checklist
- avoid embedding business semantics into Echo MCP internals
- avoid introducing hidden fallback behavior for protocol decisions
- avoid changing generated files unless they are a natural result of an intentional source change and verification run

## If You Are Unsure

When uncertain, follow this order:
1. read [docs/design-doc.md](/var/folders/g4/bhx1x1vn0wld0v_hx35m109w0000gn/T/vibe-kanban/worktrees/be1a-docs-design-doc/zenlix-echo-mcp/docs/design-doc.md)
2. inspect the relevant implementation file
3. inspect the tests
4. ask whether the request implies a design change

If the answer is yes, get user confirmation before changing the design doc.
