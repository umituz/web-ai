const TEXT_MIME_PREFIX = 'text/';
const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/yaml',
  'application/x-yaml',
  'application/javascript',
  'application/typescript',
  'application/x-sh',
  'application/sql',
  'text/csv',
]);

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh', 'sql', 'html', 'css', 'scss', 'env',
]);

export const TEXT_EXTRACT_PER_FILE_LIMIT = 24_000;
export const TEXT_EXTRACT_TOTAL_LIMIT = 48_000;

export function isTextLike(mimeType: string, name: string): boolean {
  if (mimeType.startsWith(TEXT_MIME_PREFIX) || TEXT_MIME_TYPES.has(mimeType)) return true;
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXTENSIONS.has(extension);
}

export function extractText(bytes: Uint8Array): string {
  let out = '';
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const chunkSize = 65_536;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    out += decoder.decode(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)), {
      stream: offset + chunkSize < bytes.length,
    });
  }
  return out.split('\u0000').join('');
}

export function capText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n[truncated]`;
}
