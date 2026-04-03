import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("startup regression guards", () => {
  it("builds before start in package scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(projectRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.prestart).toBe("pnpm build");
    expect(packageJson.scripts?.start).toBe("mcp-use start");
  });

  it("uses explicit .js extensions for runtime ESM imports", () => {
    const runtimeFiles = [
      "index.ts",
      "src/builtin-schema-config.ts",
      "src/echo-service.ts",
      "src/json-schema-zod.ts",
      "src/server.ts",
    ];

    for (const relativePath of runtimeFiles) {
      const source = readFileSync(resolve(projectRoot, relativePath), "utf8");
      const imports = [...source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)];

      for (const [, specifier] of imports) {
        expect(specifier, `${relativePath} import ${specifier}`).toMatch(/\.js$/);
      }
    }
  });
});
