import { SSE_DONE_MARKER, SSE_PREFIX } from "../constants/protocol.constants";

export function isSseDataLine(line: string): boolean {
  return line.startsWith(SSE_PREFIX);
}

export function extractSseDataPayload(line: string): string {
  return line.slice(SSE_PREFIX.length);
}

export function isSseDoneMarker(payload: string): boolean {
  return payload === SSE_DONE_MARKER;
}

export function splitSseLines(rawChunk: string): ReadonlyArray<string> {
  return rawChunk.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

export interface NormalizedSseChunk {
  readonly payload: string;
  readonly isDone: boolean;
}

export function normalizeSseChunk(rawChunk: string): ReadonlyArray<NormalizedSseChunk> {
  const lines = splitSseLines(rawChunk);
  const result: NormalizedSseChunk[] = [];
  for (const line of lines) {
    if (!isSseDataLine(line)) continue;
    const payload = extractSseDataPayload(line);
    result.push({ payload, isDone: isSseDoneMarker(payload) });
  }
  return result;
}
