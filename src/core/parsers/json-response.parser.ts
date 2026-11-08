
import { AIError } from "../errors/ai-error";
import { AIErrorType } from "../errors/ai-error-types";
import { extractJsonCandidate, repairCommonJsonDefects } from "./json-content-extractor";

export class JsonResponseParser {
  parse<T>(rawContent: string): T {
    const candidate = extractJsonCandidate(rawContent);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      try {
        return JSON.parse(repairCommonJsonDefects(candidate)) as T;
      } catch (error) {
        throw new AIError(
          AIErrorType.UNKNOWN_ERROR,
          "Failed to parse structured response as JSON",
          error instanceof Error ? error : undefined,
          { rawContent },
        );
      }
    }
  }
}
