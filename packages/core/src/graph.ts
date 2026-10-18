import type { DependencyEdge, DependencyGraph, PackageId, PackageNode } from "./types.js";

export function buildGraph(
  nodes: PackageNode[],
  edges: DependencyEdge[],
  roots: PackageId[],
): DependencyGraph {
  const nodeMap = new Map<PackageId, PackageNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  const forward = new Map<PackageId, PackageId[]>();
  const reverse = new Map<PackageId, PackageId[]>();

  for (const node of nodes) {
    forward.set(node.id, []);
    reverse.set(node.id, []);
  }

  for (const edge of edges) {
    forward.get(edge.from)?.push(edge.to);
    reverse.get(edge.to)?.push(edge.from);
  }

  return { nodes: nodeMap, forward, reverse, roots: new Set(roots) };
}
