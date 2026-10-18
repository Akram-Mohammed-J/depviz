import type { DependencyEdge, PackageId, PackageNode, ParsedLockfile } from "@depviz/core";

interface LockfilePackageMeta {
  version?: string;
  name?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dev?: boolean;
  link?: boolean;
}

interface LockfileV2V3 {
  lockfileVersion: number;
  packages?: Record<string, LockfilePackageMeta>;
}

/**
 * Splits an npm lockfile v2/v3 package path into its chain of ancestor
 * package names, e.g. "node_modules/mid/node_modules/@scope/leaf" ->
 * ["mid", "@scope/leaf"]. The root package has path "" -> [].
 */
function pathToChain(path: string): string[] {
  if (path === "") return [];
  const withoutLeading = path.startsWith("node_modules/") ? path.slice("node_modules/".length) : path;
  return withoutLeading.split("/node_modules/");
}

function chainToPath(chain: string[], leaf?: string): string {
  const full = leaf === undefined ? chain : [...chain, leaf];
  return full.length === 0 ? "" : `node_modules/${full.join("/node_modules/")}`;
}

/**
 * Resolves `depName` as seen from `fromPath`, following npm's node_modules
 * resolution: check the dependent's own nested node_modules first, then
 * walk up through each ancestor's node_modules, finally the top-level one.
 */
function resolveDependencyPath(
  packages: Record<string, LockfilePackageMeta>,
  fromPath: string,
  depName: string,
): string | undefined {
  const chain = pathToChain(fromPath);
  for (let i = chain.length; i >= 0; i--) {
    const candidate = chainToPath(chain.slice(0, i), depName);
    if (packages[candidate]) return candidate;
  }
  return undefined;
}

function nameFromPath(path: string): string {
  const chain = pathToChain(path);
  return chain[chain.length - 1] ?? "";
}

function idFor(path: string, meta: LockfilePackageMeta): PackageId {
  const name = meta.name ?? nameFromPath(path);
  return `${name}@${meta.version ?? "0.0.0"}`;
}

function depNamesOf(meta: LockfilePackageMeta): string[] {
  return [...Object.keys(meta.dependencies ?? {}), ...Object.keys(meta.optionalDependencies ?? {})];
}

export function parseLockfile(lockfileJson: string): ParsedLockfile {
  const lockfile = JSON.parse(lockfileJson) as LockfileV2V3;
  if (lockfile.lockfileVersion < 2) {
    throw new Error(
      `Unsupported lockfile version ${lockfile.lockfileVersion}; parser-npm requires lockfileVersion 2 or 3 (npm 7+)`,
    );
  }

  const packages = lockfile.packages ?? {};
  const rootMeta = packages[""] ?? {};

  const nodesById = new Map<PackageId, PackageNode>();
  const idByPath = new Map<string, PackageId>();

  for (const [path, meta] of Object.entries(packages)) {
    if (path === "") continue;
    if (meta.link) continue; // workspace symlinks aren't real installed packages
    const name = meta.name ?? nameFromPath(path);
    const id = idFor(path, meta);
    idByPath.set(path, id);
    if (!nodesById.has(id)) {
      nodesById.set(id, { id, name, version: meta.version ?? "0.0.0" });
    }
  }

  const edges: DependencyEdge[] = [];
  const roots: PackageId[] = [];

  const rootDepNames = [
    ...Object.keys(rootMeta.dependencies ?? {}),
    ...Object.keys(rootMeta.devDependencies ?? {}),
    ...Object.keys(rootMeta.optionalDependencies ?? {}),
  ];
  for (const depName of rootDepNames) {
    const resolvedPath = resolveDependencyPath(packages, "", depName);
    if (!resolvedPath) continue; // declared but not installed, e.g. unmet optional peer
    const resolvedId = idByPath.get(resolvedPath);
    if (resolvedId) roots.push(resolvedId);
  }

  for (const [path, meta] of Object.entries(packages)) {
    if (path === "") continue;
    const fromId = idByPath.get(path);
    if (!fromId) continue;
    for (const depName of depNamesOf(meta)) {
      const resolvedPath = resolveDependencyPath(packages, path, depName);
      if (!resolvedPath) continue;
      const toId = idByPath.get(resolvedPath);
      if (toId) edges.push({ from: fromId, to: toId });
    }
  }

  return { nodes: [...nodesById.values()], edges, roots };
}
