# @depviz/cli

Trace which direct npm dependency introduced a vulnerable transitive package.

## Requirements

- Node.js and npm
- An npm project with a `package-lock.json` using lockfile version 2 or 3
- Network access to query known vulnerabilities from [OSV.dev](https://osv.dev) when using `scan` or `graph`

## Install

Run the CLI directly with `npx`:

```sh
npx @depviz/cli scan ./my-project
```

Or install it globally:

```sh
npm install --global @depviz/cli
depviz scan ./my-project
```

## Commands

### Scan for vulnerable dependencies

```sh
depviz scan ./my-project
```

Scans the project's lockfile, looks up known vulnerabilities, and prints the vulnerable package(s) and the direct dependency path(s) that introduced them. `scan` exits with status 1 when it finds vulnerabilities.

### Find why a package is installed

```sh
depviz why ./my-project lodash
depviz why ./my-project lodash@4.17.15
```

Looks up a package by name or by name and version, then prints the path(s) back to the direct dependency or dependencies. This command only reads the lockfile and does not query OSV.dev. It exits with status 1 if no matching installed package is found.

### Export a dependency graph

```sh
depviz graph ./my-project --out graph.json
```

Writes the full dependency graph, with vulnerability annotations, to JSON. The generated file can be loaded by the visualization page in the [Depviz repository](https://github.com/Akram-Mohammed-J/depviz/tree/main/packages/viz).

## Help

```sh
depviz --help
depviz scan --help
depviz graph --help
depviz why --help
```
