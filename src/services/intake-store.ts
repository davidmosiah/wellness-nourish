/// <reference types="node" />

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { getConfig } from "./config.js";
import type { IntakeEntry } from "../types.js";

export type AddIntakeEntryInput = Omit<IntakeEntry, "id" | "timestamp" | "date"> &
  Partial<Pick<IntakeEntry, "timestamp">>;

export type UpdateIntakeEntryPatch = Partial<
  Pick<IntakeEntry, "meal_type" | "quantity" | "unit" | "timestamp" | "notes" | "tags">
>;

let mutationQueue: Promise<void> = Promise.resolve();

function storePath(): string {
  return join(getConfig().local_dir, "intake.jsonl");
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

async function readEntries(path = storePath()): Promise<IntakeEntry[]> {
  try {
    const raw = await fs.readFile(path, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as IntakeEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeEntriesAtomically(entries: IntakeEntry[], path = storePath()): Promise<void> {
  await ensureStoreDir(path);
  const tempPath = `${path}.${randomUUID()}.tmp`;
  const data = entries.length === 0 ? "" : `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
  await fs.writeFile(tempPath, data, "utf8");
  await fs.rename(tempPath, path);
}

export async function addIntakeEntry(input: AddIntakeEntryInput): Promise<IntakeEntry> {
  return withMutationLock(async () => {
    const path = storePath();
    const entries = await readEntries(path);
    const timestamp = input.timestamp ?? new Date().toISOString();
    const entry: IntakeEntry = {
      ...input,
      id: `intake_${randomUUID()}`,
      timestamp,
      date: timestamp.slice(0, 10),
    };

    entries.push(entry);
    await writeEntriesAtomically(entries, path);
    return entry;
  });
}

export async function listIntakeEntries(filter: { date?: string } = {}): Promise<IntakeEntry[]> {
  const entries = await readEntries();
  if (filter.date === undefined) {
    return entries;
  }

  return entries.filter((entry) => entry.date === filter.date);
}

export async function updateIntakeEntry(id: string, patch: UpdateIntakeEntryPatch): Promise<IntakeEntry> {
  return withMutationLock(async () => {
    const path = storePath();
    const entries = await readEntries(path);
    const index = entries.findIndex((entry) => entry.id === id);

    if (index === -1) {
      throw new Error(`Intake entry not found: ${id}`);
    }

    const current = entries[index];
    if (current === undefined) {
      throw new Error(`Intake entry not found: ${id}`);
    }

    const timestamp = patch.timestamp ?? current.timestamp;
    const updated: IntakeEntry = {
      ...current,
      ...patch,
      timestamp,
      date: timestamp.slice(0, 10),
    };

    entries[index] = updated;
    await writeEntriesAtomically(entries, path);
    return updated;
  });
}

export async function deleteIntakeEntry(id: string): Promise<boolean> {
  return withMutationLock(async () => {
    const path = storePath();
    const entries = await readEntries(path);
    const nextEntries = entries.filter((entry) => entry.id !== id);

    if (nextEntries.length === entries.length) {
      return false;
    }

    await writeEntriesAtomically(nextEntries, path);
    return true;
  });
}

export async function exportIntakeData(): Promise<string> {
  try {
    return await fs.readFile(storePath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }

    throw error;
  }
}
