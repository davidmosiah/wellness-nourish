/// <reference types="node" />

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

/**
 * Single-process mutation lock + atomic write helpers.
 *
 * Each store keeps its own mutex (a `Promise<void>` chain). Concurrent
 * `withLock(key, fn)` calls for the same key serialize automatically. This
 * fixes A2 from the QA follow-up audit: `goals-store` and `personal-memory`
 * had atomic writes (rename trick) but no mutation lock, so two parallel
 * `updateGoals` calls would both read the same baseline JSON and the second
 * write would clobber the first (lost update).
 *
 * Cross-process safety is NOT provided here. If two `wellness-nourish`
 * processes run against the same `local_dir` simultaneously, they can still
 * race on the rename. That is a separate problem (would need a lock-file or
 * O_EXCL); acceptable for personal single-user MCP use.
 */

const LOCKS = new Map<string, Promise<void>>();

/**
 * Run `operation` exclusively for the given store key. Subsequent calls with
 * the same key wait until the in-flight operation settles (regardless of
 * success or failure).
 */
export function withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = LOCKS.get(key) ?? Promise.resolve();
  const run = previous.then(operation, operation);
  // Capture both fulfillment and rejection so an error in one operation
  // doesn't permanently poison the chain.
  const next = run.then(
    () => undefined,
    () => undefined,
  );
  LOCKS.set(key, next);
  return run;
}

/**
 * Write `data` to `path` atomically:
 *   1. Ensure the parent directory exists
 *   2. Write to a temp file with a random suffix
 *   3. Rename onto the final path (single syscall, atomic on POSIX)
 *
 * Renames are inherently atomic at the FS level, so a partial write or a
 * crash between writeFile and rename never leaves the destination in a
 * corrupt state — it's either the old contents or the fully-new contents.
 */
export async function writeAtomically(path: string, data: string | Buffer): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, data, "utf8");
  await fs.rename(tempPath, path);
}
