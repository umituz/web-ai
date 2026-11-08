
import { AIErrorType } from "./ai-error-types";

export interface AIErrorBody {
  readonly error?: { readonly message?: string };
  readonly message?: string;
}

export function extractErrorMessageFromJsonBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as AIErrorBody;
  const message = candidate.error?.message ?? candidate.message;
  if (typeof message === "string" && message.length > 0) return message;
  return null;
}

export function buildHttpStatusFallback(status: number, statusText: string): string {
  const trimmedStatusText = statusText.trim();
  if (trimmedStatusText.length > 0) {
    return `HTTP ${status}: ${trimmedStatusText}`;
  }
  return `HTTP ${status}`;
}

export async function extractErrorMessageFromResponse(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const fromBody = extractErrorMessageFromJsonBody(body);
  if (fromBody) return fromBody;
  return buildHttpStatusFallback(response.status, response.statusText);
}

export function describeAIErrorType(type: AIErrorType): string {
  return `AIError[${type}]`;
}
