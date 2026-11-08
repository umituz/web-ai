
const UTF8_MAX_BYTES_PER_CHAR = 4;
const BASE64_GROUP_CHARS = 4;
const BASE64_GROUP_BYTES = 3;

export function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return text.length * UTF8_MAX_BYTES_PER_CHAR;
}

export function base64ByteLength(base64: string): number {
  const stripped = base64.indexOf(',') !== -1
    ? base64.slice(base64.indexOf(',') + 1)
    : base64;
  const rawByteLength = Math.floor((stripped.length * BASE64_GROUP_BYTES) / BASE64_GROUP_CHARS);
  const padding = stripped.endsWith('==') ? 2 : stripped.endsWith('=') ? 1 : 0;
  return Math.max(0, rawByteLength - padding);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
