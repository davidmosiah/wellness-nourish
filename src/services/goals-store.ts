/// <reference types="node" />

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { getConfig } from "./config.js";
import { withLock } from "./locked-store.js";
import type { NourishGoals, NutrientMap } from "../types.js";

export interface UpdateGoalsInput {
  daily?: NutrientMap;
  hydration_ml?: number;
}

function goalsPath(): string {
  return join(getConfig().local_dir, "goals.json");
}

async function ensureStoreDir(path: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
}

export async function getGoals(path = goalsPath()): Promise<NourishGoals> {
  try {
    const raw = await fs.readFile(path, "utf8");
    return normalizeGoals(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { daily: {} };
    }

    throw error;
  }
}

export async function updateGoals(input: UpdateGoalsInput): Promise<NourishGoals> {
  const path = goalsPath();
  // A2 fix: serialize concurrent updateGoals calls. Without this, two parallel
  // calls both read the same baseline and the second write clobbers the
  // first (lost-update bug).
  return withLock(`goals:${path}`, async () => {
    const current = await getGoals(path);
    const next: NourishGoals = {
      daily: {
        ...current.daily,
        ...cleanNutrients(input.daily),
      },
      updated_at: new Date().toISOString(),
    };

    const hydration = input.hydration_ml ?? current.hydration_ml;
    if (typeof hydration === "number" && Number.isFinite(hydration) && hydration > 0) {
      next.hydration_ml = hydration;
    }

    await writeGoalsAtomically(next, path);
    return next;
  });
}

async function writeGoalsAtomically(goals: NourishGoals, path: string): Promise<void> {
  await ensureStoreDir(path);
  const tempPath = `${path}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(goals, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, path);
}

function normalizeGoals(value: unknown): NourishGoals {
  if (!isRecord(value)) {
    return { daily: {} };
  }

  const goals: NourishGoals = {
    daily: cleanNutrients(isRecord(value.daily) ? value.daily : undefined),
  };

  if (typeof value.hydration_ml === "number" && Number.isFinite(value.hydration_ml) && value.hydration_ml > 0) {
    goals.hydration_ml = value.hydration_ml;
  }
  if (typeof value.updated_at === "string" && value.updated_at.length > 0) {
    goals.updated_at = value.updated_at;
  }

  return goals;
}

function cleanNutrients(value: unknown): NutrientMap {
  const clean: NutrientMap = {};

  if (!isRecord(value)) {
    return clean;
  }

  for (const key of [
    "calories_kcal",
    "protein_g",
    "carbohydrates_g",
    "fat_g",
    "fiber_g",
    "sugar_g",
    "saturated_fat_g",
    "sodium_mg",
  ] as const) {
    const amount = value[key];
    if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) {
      clean[key] = amount;
    }
  }

  return clean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
