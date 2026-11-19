export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .slice(0, max);
}

export function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}

export function asTrimmedOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function clampScore(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function oneOfCatalog<T extends readonly string[]>(
  catalog: T,
  value: unknown,
): T[number] | null {
  return catalog.includes(value as T[number]) ? (value as T[number]) : null;
}

export function asBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return defaultValue;
}

export function asNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return defaultValue;
}

export function asInteger(value: unknown, defaultValue = 0): number {
  const num = asNumber(value, defaultValue);
  return Math.trunc(num);
}

export function asNonEmptyString(value: unknown, defaultValue = ""): string {
  if (typeof value !== "string") return defaultValue;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : defaultValue;
}

export function coerceArray<T>(
  value: unknown,
  itemCoercer: (item: unknown) => T | null | undefined,
  max?: number,
): T[] {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const item of value) {
    if (typeof max === "number" && result.length >= max) break;
    const coerced = itemCoercer(item);
    if (coerced !== null && coerced !== undefined) {
      result.push(coerced);
    }
  }
  return result;
}

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  defaultValue = min,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultValue;
  return Math.max(min, Math.min(max, value));
}

export function safeParseJson<T = unknown>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "object") return raw as T;
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
