#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { Command } from "commander";
import { buildGraph } from "@depviz/core";
import { parseLockfile } from "@depviz/parser-npm";
import { queryBatch } from "@depviz/vuln-osv";
import { graphToJson, scanProject, whyVulnerable } from "./scan.js";

const program = new Command();

program.name("depviz").description("Dependency graph vulnerability visualizer").version("0.1.0");

program
  .command("scan")
  .description("Scan an npm project's lockfile for vulnerable dependencies and show which direct dependency introduced each one")
  .argument("<projectDir>", "path to the project directory containing package-lock.json")
  .action(async (projectDir: string) => {
    const { findings } = await scanProject(projectDir);

    if (findings.length === 0) {
      console.log("No known vulnerabilities found.");
      return;
    }

    for (const finding of findings) {
      console.log(`\n${finding.name}@${finding.version}`);
      for (const vuln of finding.vulnerabilities) {
        console.log(`  ${vuln.id}${vuln.severity ? ` (severity ${vuln.severity})` : ""}: ${vuln.summary}`);
      }
      console.log("  Introduced via:");
      for (const introPath of finding.introducingPaths) {
        console.log(`    ${introPath.join(" -> ")}`);
      }
    }

    console.log(`\n${findings.length} vulnerable package(s) found.`);
    process.exitCode = 1;
  });

program
  .command("graph")
  .description("Emit the full dependency graph (with vulnerability annotations) as JSON for visualization")
  .argument("<projectDir>", "path to the project directory containing package-lock.json")
  .requiredOption("-o, --out <file>", "output JSON file path")
  .action(async (projectDir: string, options: { out: string }) => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const lockfileJson = readFileSync(path.join(projectDir, "package-lock.json"), "utf8");
    const parsed = parseLockfile(lockfileJson);
    const graph = buildGraph(parsed.nodes, parsed.edges, parsed.roots);
    const vulnsByPkg = await queryBatch(parsed.nodes);

    writeFileSync(options.out, JSON.stringify(graphToJson(graph, vulnsByPkg), null, 2));
    console.log(`Wrote graph to ${options.out}`);
  });

program
  .command("why")
  .description(
    "Look up which root dependency(ies) introduced a package named by a security tool, by name or name@version",
  )
  .argument("<projectDir>", "path to the project directory containing package-lock.json")
  .argument("<package>", 'package name or name@version, e.g. "lodash" or "lodash@4.17.15"')
  .action((projectDir: string, pkgQuery: string) => {
    const matches = whyVulnerable(projectDir, pkgQuery);

    if (matches.length === 0) {
      console.log(`No installed package matching "${pkgQuery}" found.`);
      process.exitCode = 1;
      return;
    }

    for (const match of matches) {
      console.log(`\n${match.name}@${match.version}`);
      console.log("  Introduced via:");
      for (const introPath of match.introducingPaths) {
        console.log(`    ${introPath.join(" -> ")}`);
      }
    }
  });

program.parse();
