import type { DependencyGraph, PackageId, PackageNode } from "./types.js";

/**
 * Walks the reverse adjacency map from `targetId` up to every root it is
 * reachable from, returning each path as [root, ..., targetId].
 *
 * Guards against cycles (rare but possible with peer dependencies in real
 * lockfiles) by refusing to revisit a node already on the current path.
 */
export function findIntroducingPaths(graph: DependencyGraph, targetId: PackageId): PackageId[][] {
  if (!graph.nodes.has(targetId)) return [];

  const paths: PackageId[][] = [];

  function walk(nodeId: PackageId, pathSoFar: PackageId[], visited: Set<PackageId>): void {
    if (graph.roots.has(nodeId)) {
      paths.push([nodeId, ...pathSoFar]);
      return;
    }

    const parents = graph.reverse.get(nodeId) ?? [];
    if (parents.length === 0) {
      // Unreachable from any declared root (shouldn't normally happen for a
      // valid lockfile, but surface it rather than silently dropping it).
      paths.push([nodeId, ...pathSoFar]);
      return;
    }

    for (const parent of parents) {
      if (visited.has(parent)) continue;
      walk(parent, [nodeId, ...pathSoFar], new Set(visited).add(parent));
    }
  }

  walk(targetId, [], new Set([targetId]));
  return paths;
}

/**
 * Resolves a user-supplied query ("lodash" or "lodash@4.17.15") against the
 * graph's installed packages. A bare name matches every installed version;
 * a name@version matches exactly. Scoped names (e.g. "@scope/pkg") are
 * handled by only splitting on an "@" that isn't the first character.
 */
export function findPackagesByQuery(graph: DependencyGraph, query: string): PackageNode[] {
  const separatorIndex = query.indexOf("@", 1);
  const nodes = [...graph.nodes.values()];

  if (separatorIndex === -1) {
    return nodes.filter((node) => node.name === query);
  }

  const name = query.slice(0, separatorIndex);
  const version = query.slice(separatorIndex + 1);
  return nodes.filter((node) => node.name === name && node.version === version);
}
