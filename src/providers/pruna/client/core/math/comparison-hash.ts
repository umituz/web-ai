
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(record[key]);
        return acc;
      }, {});
  }
  return value;
}

export function hashValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return String(value);
  }

  try {
    return JSON.stringify(sortKeysDeep(value));
  } catch {
    return String(value);
  }
}

export function compositeHash(...values: unknown[]): string {
  return values.map(hashValue).join('|');
}
