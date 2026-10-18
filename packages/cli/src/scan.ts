import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildGraph,
  findIntroducingPaths,
  findPackagesByQuery,
  type DependencyGraph,
  type Vulnerability,
} from "@depviz/core";
import { parseLockfile } from "@depviz/parser-npm";
import { queryBatch } from "@depviz/vuln-osv";

export interface ScanFinding {
  packageId: string;
  name: string;
  version: string;
  vulnerabilities: Vulnerability[];
  introducingPaths: string[][];
}

export interface ScanResult {
  graph: DependencyGraph;
  findings: ScanFinding[];
}

export interface WhyMatch {
  packageId: string;
  name: string;
  version: string;
  introducingPaths: string[][];
}

function loadGraph(projectDir: string): DependencyGraph {
  const lockfilePath = path.join(projectDir, "package-lock.json");
  const lockfileJson = readFileSync(lockfilePath, "utf8");
  const parsed = parseLockfile(lockfileJson);
  return buildGraph(parsed.nodes, parsed.edges, parsed.roots);
}

export async function scanProject(projectDir: string): Promise<ScanResult> {
  const graph = loadGraph(projectDir);
  const vulnsByPkg = await queryBatch([...graph.nodes.values()]);

  const findings: ScanFinding[] = [];
  for (const [packageId, vulnerabilities] of vulnsByPkg) {
    const node = graph.nodes.get(packageId);
    if (!node) continue;
    findings.push({
      packageId,
      name: node.name,
      version: node.version,
      vulnerabilities,
      introducingPaths: findIntroducingPaths(graph, packageId),
    });
  }

  return { graph, findings };
}

/**
 * Looks up which root dependency(ies) introduced a package named by a
 * security tool, by name or name@version, without running a vulnerability
 * scan — a pure graph lookup against the lockfile already on disk.
 */
export function whyVulnerable(projectDir: string, query: string): WhyMatch[] {
  const graph = loadGraph(projectDir);
  return findPackagesByQuery(graph, query).map((node) => ({
    packageId: node.id,
    name: node.name,
    version: node.version,
    introducingPaths: findIntroducingPaths(graph, node.id),
  }));
}

export function graphToJson(graph: DependencyGraph, vulnsByPkg: Map<string, Vulnerability[]>) {
  return {
    nodes: [...graph.nodes.values()].map((node) => ({
      ...node,
      isRoot: graph.roots.has(node.id),
      vulnerabilities: vulnsByPkg.get(node.id) ?? [],
    })),
    edges: [...graph.forward.entries()].flatMap(([from, tos]) => tos.map((to) => ({ from, to }))),
  };
}
