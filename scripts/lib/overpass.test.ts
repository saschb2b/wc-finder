import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchOverpass } from "./overpass";

const complete = { elements: [{ id: 1 }], osm3s: { timestamp_osm_base: "2026-09-06T01:51:26Z" } };
const endpoints = ["https://primary.example/api", "https://fallback.example/api"];

for (const failure of [new Response("Unavailable", { status: 503 }),
  Response.json({ ...complete, remark: "runtime error: Query timed out" }),
  Response.json({ ...complete, elements: [] }), Response.json({ elements: [{ id: 1 }] }),
  new Response("not JSON")]) {
  test(`falls back after ${failure.status} ${failure.headers.get("content-type")}`, async () => {
    const calls: string[] = [];
    const result = await fetchOverpass("[out:json];node(1);out;", {
      endpoints, retryDelayMs: 0,
      fetchImpl: async (url, init) => {
        calls.push(String(url));
        assert.equal(init?.method, "POST");
        assert(init?.signal);
        return calls.length === 1 ? failure : Response.json(complete);
      },
    });
    assert.deepEqual(calls, endpoints);
    assert.deepEqual(result.elements, complete.elements);
    assert.equal(result.endpoint, endpoints[1]);
  });
}

test("network failures exit with an error instead of returning partial data", async () => {
  await assert.rejects(fetchOverpass("query", { endpoints, retryDelayMs: 0,
    fetchImpl: async () => { throw new Error("network down"); },
  }), /No complete Overpass response.*primary.example.*fallback.example/);
});

test("bounded empty regions are accepted only when explicitly enabled", async () => {
  const data = await fetchOverpass("query", { endpoints: [endpoints[0]], allowEmpty: true,
    fetchImpl: async () => Response.json({ ...complete, elements: [] }) });
  assert.deepEqual(data.elements, []);
});

test("rate-limited servers are backed off before fallback", async () => {
  let calls = 0;
  const result = await fetchOverpass("query", { endpoints, retryDelayMs: 0,
    fetchImpl: async () => ++calls === 1 ? new Response("Rate limited", { status: 429 }) : Response.json(complete) });
  assert.equal(calls, 2);
  assert.equal(result.elements.length, 1);
});

test("a hanging request is aborted before trying the fallback", async () => {
  let calls = 0;
  // Keep the event loop alive while the unreferenced AbortSignal timer runs.
  const timer = setInterval(() => {}, 1000);
  try {
    const result = await fetchOverpass("query", { endpoints, timeoutMs: 10, retryDelayMs: 0,
      fetchImpl: async (_url, init) => {
        if (++calls === 2) return Response.json(complete);
        return new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
        });
      },
    });
    assert.equal(result.elements.length, 1);
    assert.equal(calls, 2);
  } finally { clearInterval(timer); }
});
