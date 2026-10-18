import type { PackageNode, Vulnerability } from "@depviz/core";

const OSV_API_BASE = "https://api.osv.dev/v1";
const BATCH_SIZE = 1000; // OSV's documented querybatch limit

interface OsvQueryBatchVuln {
  id: string;
  modified?: string;
}

interface OsvQueryBatchResponse {
  results: { vulns?: OsvQueryBatchVuln[] }[];
}

interface OsvVulnDetail {
  id: string;
  summary?: string;
  details?: string;
  severity?: { type: string; score: string }[];
  references?: { url: string }[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function toVulnerability(detail: OsvVulnDetail): Vulnerability {
  return {
    id: detail.id,
    summary: detail.summary ?? detail.details ?? "(no summary available)",
    severity: detail.severity?.[0]?.score,
    references: detail.references?.map((r) => r.url),
  };
}

/**
 * Looks up each package against OSV.dev and returns a map of package id
 * (`name@version`) to the vulnerabilities affecting it. Packages with no
 * known vulnerabilities are omitted from the result.
 */
export async function queryBatch(
  packages: Pick<PackageNode, "id" | "name" | "version">[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, Vulnerability[]>> {
  const result = new Map<string, Vulnerability[]>();
  if (packages.length === 0) return result;

  const idToVulnIds = new Map<string, string[]>();
  const allVulnIds = new Set<string>();

  for (const batch of chunk(packages, BATCH_SIZE)) {
    const response = await fetchImpl(`${OSV_API_BASE}/querybatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: batch.map((pkg) => ({
          package: { name: pkg.name, ecosystem: "npm" },
          version: pkg.version,
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`OSV querybatch failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as OsvQueryBatchResponse;

    for (let i = 0; i < batch.length; i++) {
      const vulnIds = (body.results[i]?.vulns ?? []).map((v) => v.id);
      if (vulnIds.length > 0) {
        idToVulnIds.set(batch[i].id, vulnIds);
        for (const vulnId of vulnIds) allVulnIds.add(vulnId);
      }
    }
  }

  const vulnDetails = new Map<string, Vulnerability>();
  await Promise.all(
    [...allVulnIds].map(async (vulnId) => {
      const response = await fetchImpl(`${OSV_API_BASE}/vulns/${vulnId}`);
      if (!response.ok) return;
      const detail = (await response.json()) as OsvVulnDetail;
      vulnDetails.set(vulnId, toVulnerability(detail));
    }),
  );

  for (const [pkgId, vulnIds] of idToVulnIds) {
    const vulns = vulnIds.map((id) => vulnDetails.get(id)).filter((v): v is Vulnerability => v !== undefined);
    if (vulns.length > 0) result.set(pkgId, vulns);
  }

  return result;
}
