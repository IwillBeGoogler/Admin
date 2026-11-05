// Generates src/shared/api/openapi.d.ts from an OpenAPI spec: `bun run gen:api path/to/openapi.json` (or OPENAPI_SPEC=...).
// The spec is the API's contract, not part of this project.
// Guard: openapi-typescript rejects schemas that mix `type: object` with a string
// `enum` (older specs had one); we sanitise a copy (the spec itself is untouched).
// openapi-typescript needs the TypeScript 5 JS API (TS 7 is native-only), so it runs
// from tools/openapi, an isolated package that pins typescript@5 for the generator only.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const specPath = process.argv[2] ?? process.env.OPENAPI_SPEC;
if (!specPath) {
  console.error("usage: bun run gen:api path/to/openapi.json (or set OPENAPI_SPEC)");
  process.exit(1);
}
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const fix = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(fix);
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.type === "object" && Array.isArray(o.enum)) delete o.enum;
    for (const k of ["oneOf", "anyOf", "allOf"]) {
      if (Array.isArray(o[k])) o[k] = (o[k] as unknown[]).filter((x) => x && typeof x === "object");
    }
    for (const k of Object.keys(o)) o[k] = fix(o[k]);
  }
  return node;
};

const dir = join(tmpdir(), "admin-openapi");
mkdirSync(dir, { recursive: true });
const input = join(dir, "openapi.json");
writeFileSync(input, JSON.stringify(fix(spec)));
const out = fileURLToPath(new URL("../src/shared/api/openapi.d.ts", import.meta.url));
const tool = fileURLToPath(new URL("../tools/openapi/", import.meta.url));
Bun.spawnSync([process.execPath, "install", "--frozen-lockfile"], { cwd: tool, stdout: "inherit", stderr: "inherit" });
const p = Bun.spawnSync(
  [process.execPath, join(tool, "node_modules/openapi-typescript/bin/cli.js"), input, "-o", out],
  {
    stdout: "inherit",
    stderr: "inherit",
  },
);
process.exit(p.exitCode ?? 1);
