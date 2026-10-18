import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scanProject, whyVulnerable } from "../src/scan.js";

const fixtureDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "vulnerable-project",
);

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scanProject", () => {
  it("identifies the root dependency that introduced a transitively vulnerable package", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/querybatch")) {
        return jsonResponse({
          results: [{}, { vulns: [{ id: "GHSA-fake-0001" }] }],
        });
      }
      if (urlStr.endsWith("/vulns/GHSA-fake-0001")) {
        return jsonResponse({
          id: "GHSA-fake-0001",
          summary: "Prototype pollution in lodash",
          severity: [{ score: "7.5" }],
        });
      }
      throw new Error(`unexpected fetch to ${urlStr}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { findings } = await scanProject(fixtureDir);

    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding.name).toBe("lodash");
    expect(finding.vulnerabilities[0].id).toBe("GHSA-fake-0001");
    expect(finding.introducingPaths).toEqual([["pkg-a@1.0.0", "lodash@4.17.15"]]);
  });
});

describe("whyVulnerable", () => {
  it("finds the introducing path by package name alone, with no network call", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const matches = whyVulnerable(fixtureDir, "lodash");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      name: "lodash",
      version: "4.17.15",
      introducingPaths: [["pkg-a@1.0.0", "lodash@4.17.15"]],
    });
  });

  it("finds the introducing path by exact name@version", () => {
    const matches = whyVulnerable(fixtureDir, "lodash@4.17.15");
    expect(matches).toHaveLength(1);
    expect(matches[0].introducingPaths).toEqual([["pkg-a@1.0.0", "lodash@4.17.15"]]);
  });

  it("returns an empty array for a package not present in the lockfile", () => {
    expect(whyVulnerable(fixtureDir, "not-installed")).toEqual([]);
  });
});
