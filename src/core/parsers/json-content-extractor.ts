
import { JSON_CODE_BLOCK_PATTERN, JSON_OBJECT_PATTERN } from "../constants/protocol.constants";

export function extractJsonFromCodeFence(content: string): string | null {
  const match = content.match(JSON_CODE_BLOCK_PATTERN);
  if (match && match[1]) return match[1];
  return null;
}

export function extractJsonObject(content: string): string | null {
  const match = content.match(JSON_OBJECT_PATTERN);
  if (match && match[0]) return match[0];
  return null;
}

export function extractJsonCandidate(content: string): string {
  return (
    extractJsonFromCodeFence(content) ??
    extractJsonObject(content) ??
    content
  );
}
