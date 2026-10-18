import { describe, expect, it, vi } from "vitest";
import { queryBatch } from "../src/osvClient.js";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => body,
  } as unknown as Response;
}

describe("queryBatch", () => {
  it("maps vulnerable packages to their details and omits clean packages", async () => {
    const packages = [
      { id: "lodash@4.17.15", name: "lodash", version: "4.17.15" },
      { id: "pkg-a@1.0.0", name: "pkg-a", version: "1.0.0" },
    ];

    const fetchImpl = vi.fn(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/querybatch")) {
        return jsonResponse({
          results: [{ vulns: [{ id: "GHSA-xxxx-yyyy" }] }, {}],
        });
      }
      if (urlStr.endsWith("/vulns/GHSA-xxxx-yyyy")) {
        return jsonResponse({
          id: "GHSA-xxxx-yyyy",
          summary: "Prototype pollution in lodash",
          severity: [{ type: "CVSS_V3", score: "7.5" }],
          references: [{ url: "https://example.com/advisory" }],
        });
      }
      throw new Error(`unexpected fetch to ${urlStr}`);
    });

    const result = await queryBatch(packages, fetchImpl as unknown as typeof fetch);

    expect(result.has("pkg-a@1.0.0")).toBe(false);
    expect(result.get("lodash@4.17.15")).toEqual([
      {
        id: "GHSA-xxxx-yyyy",
        summary: "Prototype pollution in lodash",
        severity: "7.5",
        references: ["https://example.com/advisory"],
      },
    ]);
  });

  it("throws when the querybatch request fails", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));
    await expect(
      queryBatch([{ id: "a@1.0.0", name: "a", version: "1.0.0" }], fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/OSV querybatch failed/);
  });

  it("returns an empty map for an empty package list without making a request", async () => {
    const fetchImpl = vi.fn();
    const result = await queryBatch([], fetchImpl as unknown as typeof fetch);
    expect(result.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
