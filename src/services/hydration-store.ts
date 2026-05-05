/// <reference types="node" />

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { getConfig } from "./config.js";
import { getGoals } from "./goals-store.js";
import { roundNutrient } from "./nutrients.js";
import type { HydrationEntry, HydrationSummary } from "../types.js";

export interface LogWaterInput {
  timestamp?: string;
  amount_ml: number;
  source?: HydrationEntry["source"];
  notes?: string;
}

let mutationQueue: Promise<void> = Promise.resolve();

function hydrationPath(): string {
  return join(getConfig().local_dir, "hydration.jsonl");
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(operation, operation);
  mutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureStoreDir(path: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
}

async function readHydrationEntries(path = hydrationPath()): Promise<HydrationEntry[]> {
  try {
    const raw = await fs.readFile(path, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as HydrationEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeHydrationEntriesAtomically(entries: HydrationEntry[], path = hydrationPath()): Promise<void> {
  await ensureStoreDir(path);
  const tempPath = `${path}.${randomUUID()}.tmp`;
  const data = entries.length === 0 ? "" : `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
  await fs.writeFile(tempPath, data, "utf8");
  await fs.rename(tempPath, path);
}

export async function logWater(input: LogWaterInput): Promise<HydrationEntry> {
  if (!Number.isFinite(input.amount_ml) || input.amount_ml <= 0) {
    throw new Error("amount_ml must be a positive number.");
  }

  return withMutationLock(async () => {
    const path = hydrationPath();
    const entries = await readHydrationEntries(path);
    const timestamp = input.timestamp ?? new Date().toISOString();
    const entryBase: HydrationEntry = {
      id: `water_${randomUUID()}`,
      timestamp,
      date: timestamp.slice(0, 10),
      amount_ml: roundNutrient(input.amount_ml),
      source: input.source ?? "manual",
    };
    const entry: HydrationEntry =
      input.notes === undefined
        ? entryBase
        : {
            ...entryBase,
            notes: input.notes,
          };

    entries.push(entry);
    await writeHydrationEntriesAtomically(entries, path);
    return entry;
  });
}

export async function listWaterEntries(filter: { date?: string } = {}): Promise<HydrationEntry[]> {
  const entries = await readHydrationEntries();
  if (filter.date === undefined) {
    return entries;
  }

  return entries.filter((entry) => entry.date === filter.date);
}

export async function buildHydrationSummary(date = todayDate()): Promise<HydrationSummary> {
  const entries = await listWaterEntries({ date });
  const goals = await getGoals();
  const total = roundNutrient(entries.reduce((sum, entry) => sum + entry.amount_ml, 0));
  const summaryBase: HydrationSummary = {
    date,
    total_ml: total,
    entries,
  };

  if (typeof goals.hydration_ml !== "number" || goals.hydration_ml <= 0) {
    return summaryBase;
  }

  return {
    ...summaryBase,
    goal_ml: goals.hydration_ml,
    progress_percent: roundNutrient((total / goals.hydration_ml) * 100),
  };
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
