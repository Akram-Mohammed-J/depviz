import { describe, expect, it } from "vitest";
import { buildGraph } from "../src/graph.js";
import { findPackagesByQuery } from "../src/paths.js";
import type { PackageNode } from "../src/types.js";

describe("findPackagesByQuery", () => {
  const nodes: PackageNode[] = [
    { id: "lodash@4.17.15", name: "lodash", version: "4.17.15" },
    { id: "lodash@4.17.21", name: "lodash", version: "4.17.21" },
    { id: "@scope/pkg@1.0.0", name: "@scope/pkg", version: "1.0.0" },
  ];

  it("matches every installed version for a bare name query", () => {
    const graph = buildGraph(nodes, [], []);
    const matches = findPackagesByQuery(graph, "lodash");
    expect(matches.map((n) => n.id).sort()).toEqual(["lodash@4.17.15", "lodash@4.17.21"]);
  });

  it("matches only the exact version for a name@version query", () => {
    const graph = buildGraph(nodes, [], []);
    const matches = findPackagesByQuery(graph, "lodash@4.17.15");
    expect(matches.map((n) => n.id)).toEqual(["lodash@4.17.15"]);
  });

  it("handles scoped package names correctly", () => {
    const graph = buildGraph(nodes, [], []);
    expect(findPackagesByQuery(graph, "@scope/pkg").map((n) => n.id)).toEqual(["@scope/pkg@1.0.0"]);
    expect(findPackagesByQuery(graph, "@scope/pkg@1.0.0").map((n) => n.id)).toEqual(["@scope/pkg@1.0.0"]);
  });

  it("returns an empty array when nothing matches", () => {
    const graph = buildGraph(nodes, [], []);
    expect(findPackagesByQuery(graph, "not-installed")).toEqual([]);
    expect(findPackagesByQuery(graph, "lodash@9.9.9")).toEqual([]);
  });
});
