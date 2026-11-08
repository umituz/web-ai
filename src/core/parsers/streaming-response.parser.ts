import { AIError } from "../errors/ai-error";
import { AIErrorType } from "../errors/ai-error-types";
import {
  isSseDataLine,
  extractSseDataPayload,
  isSseDoneMarker,
} from "./sse-lines";

/**
 * Extracts the text delta from a single SSE `data:` payload, or null when the
 * payload carries no displayable text. Provider-specific: each provider passes
 * its own extractor so the line-buffering machinery below stays generic.
 */
export type SseDeltaExtractor = (payload: string) => string | null;

export interface StreamingParserCallbacks {
  readonly onChunk: (content: string) => void;
}

export class StreamingResponseParser {
  private readonly decoder = new TextDecoder();

  constructor(
    private readonly callbacks: StreamingParserCallbacks,
    private readonly extractDelta: SseDeltaExtractor,
  ) {}

  async parse(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const contentChunks: string[] = [];
    let buffer = "";

    const consumeLine = (rawLine: string): void => {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      const trimmed = line.trim();
      if (trimmed.length === 0 || !isSseDataLine(trimmed)) return;
      const payload = extractSseDataPayload(trimmed);
      if (isSseDoneMarker(payload)) return;
      const content = this.extractDelta(payload);
      if (content !== null) {
        contentChunks.push(content);
        this.callbacks.onChunk(content);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += this.decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) consumeLine(line);
      }

      buffer += this.decoder.decode();
      if (buffer.length > 0) consumeLine(buffer);
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(
        AIErrorType.NETWORK_ERROR,
        "Stream was interrupted",
        error instanceof Error ? error : undefined,
      );
    } finally {
      reader.releaseLock();
    }

    return contentChunks.join("");
  }
}
