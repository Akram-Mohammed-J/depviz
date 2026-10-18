import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseLockfile } from "../src/parseLockfile.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "package-lock.json",
);

describe("parseLockfile", () => {
  it("parses nodes, edges, and roots from a v3 lockfile with a shared transitive dependency", () => {
    const lockfileJson = readFileSync(fixturePath, "utf8");
    const result = parseLockfile(lockfileJson);

    const ids = result.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["lodash@4.17.15", "pkg-a@1.0.0"]);

    expect(result.roots.sort()).toEqual(["lodash@4.17.15", "pkg-a@1.0.0"]);

    expect(result.edges).toContainEqual({ from: "pkg-a@1.0.0", to: "lodash@4.17.15" });
  });

  it("rejects lockfile version 1", () => {
    const legacy = JSON.stringify({ lockfileVersion: 1, packages: {} });
    expect(() => parseLockfile(legacy)).toThrow(/Unsupported lockfile version/);
  });
});
