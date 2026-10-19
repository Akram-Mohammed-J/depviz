# dependency-graph-visualizer

Traces which direct (root) npm dependency introduced a vulnerable transitive package, instead of just reporting that the vulnerability exists.

## Why

`npm audit` tells you a package is vulnerable. It doesn't efficiently tell you which of your `package.json` dependencies dragged it in — especially when it's buried several levels deep, or pulled in by more than one root dependency. This builds the full dependency graph from `package-lock.json`, keeps a reverse adjacency map (child → parents), and walks it from any vulnerable package back up to every root that depends on it.

## Packages

- `packages/core` — ecosystem-agnostic graph types, graph builder, and path-finding (`findIntroducingPaths`)
- `packages/parser-npm` — parses npm lockfile v2/v3 (`package-lock.json`) into nodes/edges/roots
- `packages/vuln-osv` — batched vulnerability lookups against the [OSV.dev](https://osv.dev) API
- `packages/cli` — `depviz scan <dir>` and `depviz graph <dir> -o graph.json`
- `packages/viz` — static HTML page (vis-network) that loads `graph.json`, highlights vulnerable nodes, and shows the introducing path(s) on click

## Use from npm

Depviz reads an npm project's `package-lock.json` (lockfile version 2 or 3). Make sure the lockfile is present before running a command.

Run it without a global install using `npx`:

```sh
npx @depviz/cli scan ./my-project
```

Or install the CLI globally and use the `depviz` command:

```sh
npm install --global @depviz/cli
depviz scan ./my-project
```

### Commands

Scan the lockfile for known vulnerabilities. Depviz queries the OSV.dev API, then prints each affected package and the direct dependency path(s) that introduced it:

```sh
depviz scan ./my-project
```

Look up the dependency path for a package reported by another security tool. This reads the lockfile locally and does not run a vulnerability scan:

```sh
depviz why ./my-project lodash
depviz why ./my-project lodash@4.17.15
```

Export the full dependency graph, including vulnerability annotations, as JSON:

```sh
depviz graph ./my-project --out graph.json
```

`scan` exits with status 1 when it finds known vulnerabilities; `why` exits with status 1 when the package is not installed. A successful scan with no known vulnerabilities exits normally.

To use the packages as libraries instead of the CLI:

```sh
npm install @depviz/core @depviz/parser-npm @depviz/vuln-osv
```

## Development

```sh
npm install
npm run build

node packages/cli/dist/index.js scan ./my-project
node packages/cli/dist/index.js graph ./my-project -o packages/viz/graph.json
# then open packages/viz/index.html in a browser
```

## Testing

```sh
npm test
```

## Releasing

Versioning and publishing to npm are driven by [Changesets](https://github.com/changesets/changesets):

1. After making a change, run `npx changeset` and describe it — this writes a `.changeset/*.md` file. Commit it alongside your change.
2. On merge to `main`, the `release.yml` GitHub Actions workflow opens/updates a "Version Packages" PR that bumps versions and changelogs for every package with a pending changeset.
3. Merging that PR triggers the same workflow to build and `npm publish` each changed package under the `@depviz` scope.

Requires an `NPM_TOKEN` (npm automation token for an account/org that owns the `@depviz` scope) set as a repo secret in Settings → Secrets → Actions.

## Scope

v1 targets npm only. The `core` package has no npm-specific logic, so support for other ecosystems (pip, cargo, etc.) can be added as new `parser-*` packages without touching the graph or path-finding code.
