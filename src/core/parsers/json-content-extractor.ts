
import {
  JSON_ARRAY_PATTERN,
  JSON_CODE_BLOCK_PATTERN,
  JSON_OBJECT_PATTERN,
} from "../constants/protocol.constants";

export function extractJsonFromCodeFence(content: string): string | null {
  const match = content.match(JSON_CODE_BLOCK_PATTERN);
  if (match && match[1]) return match[1].trim();
  return null;
}

export function extractJsonObject(content: string): string | null {
  const match = content.match(JSON_OBJECT_PATTERN);
  if (match && match[0]) return match[0];
  return null;
}

export function extractJsonArray(content: string): string | null {
  const match = content.match(JSON_ARRAY_PATTERN);
  if (match && match[0]) return match[0];
  return null;
}

export function repairCommonJsonDefects(text: string): string {
  return text
    .replace(/(:\s*-?\d+(?:\.\d+)?)\s*"/g, "$1")
    .replace(/(:\s*"[^"]*")"/g, "$1");
}

export function extractJsonCandidate(content: string): string {
  const fromFence = extractJsonFromCodeFence(content);
  if (fromFence) return fromFence;

  const objectIndex = content.indexOf("{");
  const arrayIndex = content.indexOf("[");

  if (objectIndex !== -1 && (arrayIndex === -1 || objectIndex < arrayIndex)) {
    const obj = extractJsonObject(content);
    if (obj) return obj;
  } else if (arrayIndex !== -1) {
    const arr = extractJsonArray(content);
    if (arr) return arr;
  }

  return content.trim();
}
