
export function buildCacheKey(params: Readonly<Record<string, unknown>>): string {
  const sortedKeys = Object.keys(params).sort();
  const sortedParams: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedParams[key] = params[key];
  }
  return JSON.stringify(sortedParams);
}
