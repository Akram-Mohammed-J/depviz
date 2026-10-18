/** Unique id for a resolved package, e.g. "lodash@4.17.15". */
export type PackageId = string;

export interface PackageNode {
  id: PackageId;
  name: string;
  version: string;
}

/** Directed edge meaning `from` depends directly on `to`. */
export interface DependencyEdge {
  from: PackageId;
  to: PackageId;
}

export interface ParsedLockfile {
  nodes: PackageNode[];
  edges: DependencyEdge[];
  /** ids of direct dependencies declared in the project's manifest (package.json). */
  roots: PackageId[];
}

export interface Vulnerability {
  id: string;
  summary: string;
  severity?: string;
  references?: string[];
}

export interface DependencyGraph {
  nodes: Map<PackageId, PackageNode>;
  /** id -> ids it directly depends on */
  forward: Map<PackageId, PackageId[]>;
  /** id -> ids that directly depend on it */
  reverse: Map<PackageId, PackageId[]>;
  roots: Set<PackageId>;
}
