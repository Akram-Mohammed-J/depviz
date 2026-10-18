import { describe, expect, it } from "vitest";
import { buildGraph } from "../src/graph.js";
import { findIntroducingPaths } from "../src/paths.js";
import type { PackageNode } from "../src/types.js";

describe("findIntroducingPaths", () => {
  it("returns all paths for a diamond dependency onto a shared vulnerable leaf", () => {
    // root-a -> mid-a -> leaf
    // root-b -> leaf
    const nodes: PackageNode[] = [
      { id: "root-a", name: "root-a", version: "1.0.0" },
      { id: "root-b", name: "root-b", version: "1.0.0" },
      { id: "mid-a", name: "mid-a", version: "1.0.0" },
      { id: "leaf", name: "leaf", version: "1.0.0" },
    ];
    const edges = [
      { from: "root-a", to: "mid-a" },
      { from: "mid-a", to: "leaf" },
      { from: "root-b", to: "leaf" },
    ];
    const graph = buildGraph(nodes, edges, ["root-a", "root-b"]);

    const paths = findIntroducingPaths(graph, "leaf");

    expect(paths).toHaveLength(2);
    expect(paths).toContainEqual(["root-a", "mid-a", "leaf"]);
    expect(paths).toContainEqual(["root-b", "leaf"]);
  });

  it("returns the single path for a non-shared transitive dependency", () => {
    const nodes: PackageNode[] = [
      { id: "root-a", name: "root-a", version: "1.0.0" },
      { id: "mid-a", name: "mid-a", version: "1.0.0" },
      { id: "leaf", name: "leaf", version: "1.0.0" },
    ];
    const edges = [
      { from: "root-a", to: "mid-a" },
      { from: "mid-a", to: "leaf" },
    ];
    const graph = buildGraph(nodes, edges, ["root-a"]);

    expect(findIntroducingPaths(graph, "leaf")).toEqual([["root-a", "mid-a", "leaf"]]);
  });

  it("returns an empty array for an id not present in the graph", () => {
    const graph = buildGraph([], [], []);
    expect(findIntroducingPaths(graph, "ghost")).toEqual([]);
  });

  it("treats a root package itself as its own trivial path", () => {
    const nodes: PackageNode[] = [{ id: "root-a", name: "root-a", version: "1.0.0" }];
    const graph = buildGraph(nodes, [], ["root-a"]);
    expect(findIntroducingPaths(graph, "root-a")).toEqual([["root-a"]]);
  });
});
