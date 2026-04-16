import { LANES } from "./constants";
import { Lane } from "../core/lcu/types";

export interface StoredConfig {
  __migratedV1?: boolean;
  [key: string]: unknown;
}

export function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return [...value] as unknown as T;
  }
  if (value && typeof value === "object") {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function sanitizeDelaySeconds(value: unknown, fallback: number, max: number): number {
  const num = typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  const clamped = Math.min(Math.max(num, 0), max);
  return Math.round(clamped * 100) / 100;
}

export function sanitizeChampionId(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function sanitizeChampionList(value: unknown, fallback: number[]): number[] {
  const source = Array.isArray(value) ? value : fallback;
  return fallback.map((fallbackChampionId, index) => sanitizeChampionId(source[index], fallbackChampionId));
}

export function sanitizeLaneChampionMap(value: unknown, fallback: Record<Lane, number[]>): Record<Lane, number[]> {
  const source = isRecord(value) ? value : {};
  return LANES.reduce(
    (acc, lane) => {
      acc[lane] = sanitizeChampionList(source[lane], fallback[lane]);
      return acc;
    },
    {} as Record<Lane, number[]>,
  );
}

export function parseDelaySeconds(value: string, max: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(Math.min(parsed, max) * 100) / 100;
}
