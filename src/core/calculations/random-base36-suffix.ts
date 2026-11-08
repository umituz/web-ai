
const BASE_36_RADIX = 36;
const DECIMAL_OFFSET = 2;

export function generateRandomBase36Suffix(
  length: number,
  random: () => number = Math.random,
): string {
  if (length <= 0) return "";
  const raw = random().toString(BASE_36_RADIX).slice(DECIMAL_OFFSET);
  if (raw.length >= length) return raw.slice(0, length);

  let result = raw;
  while (result.length < length) {
    result += random().toString(BASE_36_RADIX).slice(DECIMAL_OFFSET);
  }
  return result.slice(0, length);
}
