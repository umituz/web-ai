
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keysA = Object.keys(aRecord);
  const keysB = Object.keys(bRecord);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (aRecord[key] !== bRecord[key]) return false;
  }

  return true;
}
