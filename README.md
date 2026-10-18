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

## Install

```sh
npm install -g @depviz/cli
depviz scan ./my-project
depviz why ./my-project lodash
```

Or install just the parts you need as a library: `npm install @depviz/core @depviz/parser-npm @depviz/vuln-osv`.

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
