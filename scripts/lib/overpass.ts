import assert from "node:assert/strict";

let lastWorkingEndpoint: string | undefined;

export interface OverpassResponse<T> {
  elements: T[];
  osm3s: { timestamp_osm_base: string };
  endpoint?: string;
}

/** Reject HTTP-200 timeout/partial responses before any source file is replaced. */
export async function fetchOverpass<T>(query: string, options: {
  fetchImpl?: typeof fetch;
  endpoints?: string[];
  timeoutMs?: number;
  retryDelayMs?: number;
  allowEmpty?: boolean;
} = {}): Promise<OverpassResponse<T>> {
  const endpoints = options.endpoints || [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ].sort((a, b) => Number(b === lastWorkingEndpoint) - Number(a === lastWorkingEndpoint));
  const failures: string[] = [];
  for (const [index, endpoint] of endpoints.entries()) {
    try {
      const response = await (options.fetchImpl || fetch)(endpoint, {
        method: "POST", headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "WC-Finder data refresh (+https://github.com/saschb2b/wc-finder)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(options.timeoutMs ?? 100000),
      });
      if ([429, 406].includes(response.status)) {
        await new Promise(resolve => setTimeout(resolve, options.retryDelayMs ?? 30000));
      }
      assert(response.ok, `HTTP ${response.status}`);
      const data = await response.json();
      assert(!data.remark, `Incomplete Overpass response: ${data.remark}`);
      assert(Array.isArray(data.elements) && (options.allowEmpty || data.elements.length > 0), "Empty or invalid Overpass response");
      assert(Number.isFinite(Date.parse(data.osm3s?.timestamp_osm_base)), "Missing OSM source timestamp");
      if (!options.endpoints) lastWorkingEndpoint = endpoint;
      return { ...data, endpoint };
    } catch (error) {
      failures.push(`${new URL(endpoint).host}: ${error instanceof Error ? error.message : String(error)}`);
      if (index < endpoints.length - 1) {
        console.warn(`${failures[failures.length - 1]}; trying fallback`);
        await new Promise(resolve => setTimeout(resolve, options.retryDelayMs ?? 2000));
      }
    }
  }
  throw new Error(`No complete Overpass response. ${failures.join("; ")}`);
}
