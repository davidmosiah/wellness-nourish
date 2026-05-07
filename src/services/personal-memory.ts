/// <reference types="node" />

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { getConfig } from "./config.js";
import type { MealType } from "../types.js";

export interface RememberedMeal {
  id: string;
  label: string;
  aliases: string[];
  meal_text: string;
  default_meal_type?: MealType;
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PersonalNutritionMemory {
  remembered_meals: RememberedMeal[];
  preferences: {
    prefer: string[];
    avoid: string[];
    notes: string[];
  };
  updated_at?: string;
}

export interface RememberMealInput {
  label: string;
  aliases?: string[] | undefined;
  meal_text: string;
  default_meal_type?: MealType | undefined;
  notes?: string | undefined;
  tags?: string[] | undefined;
}

export interface PersonalMemoryMatch {
  id: string;
  label: string;
  matched_alias: string;
  meal_text: string;
  default_meal_type?: MealType;
}

const EMPTY_MEMORY: PersonalNutritionMemory = {
  remembered_meals: [],
  preferences: {
    prefer: [],
    avoid: [],
    notes: [],
  },
};

function memoryPath(): string {
  return join(getConfig().local_dir, "personal-memory.json");
}

export async function getPersonalNutritionMemory(): Promise<PersonalNutritionMemory> {
  try {
    const raw = await fs.readFile(memoryPath(), "utf8");
    return normalizeMemory(JSON.parse(raw) as Partial<PersonalNutritionMemory>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return cloneMemory(EMPTY_MEMORY);
    }

    throw error;
  }
}

export async function rememberMeal(input: RememberMealInput): Promise<RememberedMeal> {
  const memory = await getPersonalNutritionMemory();
  const now = new Date().toISOString();
  const key = normalizeKey(input.label);
  const aliases = uniqueAliases([...(input.aliases ?? []), input.label]);
  const existingIndex = memory.remembered_meals.findIndex((meal) =>
    uniqueAliases([meal.label, ...meal.aliases]).some((alias) => normalizeKey(alias) === key),
  );
  const existing = existingIndex === -1 ? undefined : memory.remembered_meals[existingIndex];
  const meal: RememberedMeal = {
    id: existing?.id ?? `memory_${randomUUID()}`,
    label: input.label,
    aliases,
    meal_text: input.meal_text,
    tags: input.tags ?? existing?.tags ?? [],
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (input.default_meal_type !== undefined) {
    meal.default_meal_type = input.default_meal_type;
  } else if (existing?.default_meal_type !== undefined) {
    meal.default_meal_type = existing.default_meal_type;
  }
  if (input.notes !== undefined) {
    meal.notes = input.notes;
  } else if (existing?.notes !== undefined) {
    meal.notes = existing.notes;
  }

  if (existingIndex === -1) {
    memory.remembered_meals.push(meal);
  } else {
    memory.remembered_meals[existingIndex] = meal;
  }
  memory.updated_at = now;
  await writeMemory(memory);

  return meal;
}

export async function forgetRememberedMeal(idOrLabel: string): Promise<{ deleted: boolean; id_or_label: string }> {
  const memory = await getPersonalNutritionMemory();
  const normalized = normalizeKey(idOrLabel);
  const nextMeals = memory.remembered_meals.filter((meal) => {
    if (meal.id === idOrLabel) {
      return false;
    }

    return !uniqueAliases([meal.label, ...meal.aliases]).some((alias) => normalizeKey(alias) === normalized);
  });
  const deleted = nextMeals.length !== memory.remembered_meals.length;

  if (deleted) {
    memory.remembered_meals = nextMeals;
    memory.updated_at = new Date().toISOString();
    await writeMemory(memory);
  }

  return {
    deleted,
    id_or_label: idOrLabel,
  };
}

export async function expandMealTextWithMemory(text: string): Promise<{
  text: string;
  matches: PersonalMemoryMatch[];
}> {
  const memory = await getPersonalNutritionMemory();
  const normalized = normalizeKey(text);
  const meal = memory.remembered_meals.find((candidate) =>
    uniqueAliases([candidate.label, ...candidate.aliases]).some((alias) => normalizeKey(alias) === normalized),
  );

  if (meal === undefined) {
    return {
      text,
      matches: [],
    };
  }

  return {
    text: meal.meal_text,
    matches: [
      {
        id: meal.id,
        label: meal.label,
        matched_alias: text,
        meal_text: meal.meal_text,
        ...(meal.default_meal_type === undefined ? {} : { default_meal_type: meal.default_meal_type }),
      },
    ],
  };
}

async function writeMemory(memory: PersonalNutritionMemory): Promise<void> {
  const path = memoryPath();
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
}

function normalizeMemory(raw: Partial<PersonalNutritionMemory>): PersonalNutritionMemory {
  return {
    remembered_meals: Array.isArray(raw.remembered_meals)
      ? raw.remembered_meals.map(normalizeRememberedMeal).filter((meal) => meal !== undefined)
      : [],
    preferences: {
      prefer: Array.isArray(raw.preferences?.prefer) ? raw.preferences.prefer.filter(isString) : [],
      avoid: Array.isArray(raw.preferences?.avoid) ? raw.preferences.avoid.filter(isString) : [],
      notes: Array.isArray(raw.preferences?.notes) ? raw.preferences.notes.filter(isString) : [],
    },
    ...(typeof raw.updated_at === "string" ? { updated_at: raw.updated_at } : {}),
  };
}

function normalizeRememberedMeal(raw: unknown): RememberedMeal | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.label !== "string" ||
    typeof record.meal_text !== "string" ||
    typeof record.created_at !== "string" ||
    typeof record.updated_at !== "string"
  ) {
    return undefined;
  }

  const meal: RememberedMeal = {
    id: record.id,
    label: record.label,
    aliases: Array.isArray(record.aliases) ? record.aliases.filter(isString) : [record.label],
    meal_text: record.meal_text,
    tags: Array.isArray(record.tags) ? record.tags.filter(isString) : [],
    created_at: record.created_at,
    updated_at: record.updated_at,
  };

  if (isMealType(record.default_meal_type)) {
    meal.default_meal_type = record.default_meal_type;
  }
  if (typeof record.notes === "string") {
    meal.notes = record.notes;
  }

  return meal;
}

function cloneMemory(memory: PersonalNutritionMemory): PersonalNutritionMemory {
  return {
    remembered_meals: memory.remembered_meals.map((meal) => ({ ...meal, aliases: [...meal.aliases], tags: [...meal.tags] })),
    preferences: {
      prefer: [...memory.preferences.prefer],
      avoid: [...memory.preferences.avoid],
      notes: [...memory.preferences.notes],
    },
    ...(memory.updated_at === undefined ? {} : { updated_at: memory.updated_at }),
  };
}

function uniqueAliases(values: string[]): string[] {
  const aliases: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeKey(trimmed);
    if (trimmed.length === 0 || seen.has(key)) {
      continue;
    }

    aliases.push(trimmed);
    seen.add(key);
  }

  return aliases;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isMealType(value: unknown): value is MealType {
  return value === "breakfast" || value === "lunch" || value === "dinner" || value === "snack" || value === "other";
}
