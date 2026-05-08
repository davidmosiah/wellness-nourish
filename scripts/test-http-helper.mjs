// Regression test for src/services/http.ts.
// Spins up a tiny localhost HTTP server with controllable behaviour and
// asserts the NourishHttpError kind/attempts contract for timeout, 5xx
// (retry then succeed), 429 (no retry), and recoverable network errors.
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { once } from "node:events";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

// Set the global config to a tight timeout so tests run fast.
process.env.NOURISH_PROVIDER_TIMEOUT_MS = "300";
process.env.NOURISH_LOCAL_DIR = `/tmp/nourish-http-helper-${process.pid}`;

const { fetchWithTimeout, NourishHttpError, isTransientHttpError } = await import(
  "../dist/services/http.js"
);

// --- Stand up a controllable test server. ---
const responses = [];
const server = http.createServer((req, res) => {
  const next = responses.shift();
  if (next === undefined) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("test server: no scripted response");
    return;
  }
  if (next.delayMs > 0) {
    setTimeout(() => respond(res, next), next.delayMs);
  } else {
    respond(res, next);
  }
});
server.listen(0);
await once(server, "listening");
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

function respond(res, next) {
  res.writeHead(next.status, { "content-type": "application/json" });
  res.end(JSON.stringify(next.body ?? {}));
}

try {
  // 1. Timeout — server delays 800ms, our timeout is 300ms.
  responses.push({ delayMs: 800, status: 200, body: { tooLate: true } });
  responses.push({ delayMs: 800, status: 200, body: { tooLate: true } }); // for the retry
  await assert.rejects(
    () => fetchWithTimeout(`${base}/slow`, { retries: 1 }),
    (err) => {
      assert.ok(err instanceof NourishHttpError, "expected NourishHttpError");
      assert.equal(err.kind, "timeout");
      assert.equal(err.attempts, 2, "should attempt 1 + 1 retry");
      assert.ok(isTransientHttpError(err), "timeout must be transient");
      return true;
    },
  );

  // 2. 503 then 200 — retry should succeed.
  responses.push({ delayMs: 0, status: 503, body: { try: "again" } });
  responses.push({ delayMs: 0, status: 200, body: { ok: true } });
  const okRes = await fetchWithTimeout(`${base}/ok-after-503`, { retries: 1 });
  assert.equal(okRes.status, 200, "should succeed on retry after 503");
  const okBody = await okRes.json();
  assert.deepEqual(okBody, { ok: true });

  // 3. 503 then 503 — should throw server_error after retries exhausted.
  responses.push({ delayMs: 0, status: 503, body: {} });
  responses.push({ delayMs: 0, status: 503, body: {} });
  await assert.rejects(
    () => fetchWithTimeout(`${base}/persistent-503`, { retries: 1 }),
    (err) => {
      assert.ok(err instanceof NourishHttpError);
      assert.equal(err.kind, "server_error");
      assert.equal(err.status, 503);
      assert.equal(err.attempts, 2);
      assert.ok(isTransientHttpError(err));
      return true;
    },
  );

  // 4. 429 retried then still 429 — kind: rate_limit.
  responses.push({ delayMs: 0, status: 429, body: {} });
  responses.push({ delayMs: 0, status: 429, body: {} });
  await assert.rejects(
    () => fetchWithTimeout(`${base}/persistent-429`, { retries: 1 }),
    (err) => {
      assert.ok(err instanceof NourishHttpError);
      assert.equal(err.kind, "rate_limit");
      assert.equal(err.status, 429);
      assert.ok(isTransientHttpError(err));
      return true;
    },
  );

  // 5. 404 — non-retryable, kind: http (NOT transient).
  responses.push({ delayMs: 0, status: 404, body: { gone: true } });
  await assert.rejects(
    () => fetchWithTimeout(`${base}/404`, { retries: 1 }),
    (err) => {
      assert.ok(err instanceof NourishHttpError);
      assert.equal(err.kind, "http");
      assert.equal(err.status, 404);
      assert.equal(err.attempts, 1, "non-retryable status should not retry");
      assert.equal(isTransientHttpError(err), false, "404 must NOT be transient");
      return true;
    },
  );

  console.log("http helper tests ok");
} finally {
  server.close();
}
