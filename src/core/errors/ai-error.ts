
import { AIErrorType } from "./ai-error-types";

export interface AIErrorMetadata {
  readonly status?: number;
  readonly url?: string;
  readonly [key: string]: unknown;
}

const KNOWN_ERROR_TYPES = new Set<string>(Object.values(AIErrorType));

function mapCodeToType(code: string): AIErrorType {
  switch (code) {
    case "VALIDATION_ERROR":
    case "CLIENT_ERROR":
      return AIErrorType.CLIENT_ERROR;
    case "INVALID_API_KEY":
      return AIErrorType.INVALID_API_KEY;
    case "MISSING_CONFIG":
    case "PROVIDER_UNAVAILABLE":
      return AIErrorType.MISSING_CONFIG;
    case "PROVIDER_QUOTA_EXHAUSTED":
    case "RATE_LIMIT_ERROR":
      return AIErrorType.RATE_LIMIT_ERROR;
    case "NETWORK_ERROR":
    case "TIMEOUT":
      return AIErrorType.NETWORK_ERROR;
    case "ABORT_ERROR":
    case "ABORTED":
      return AIErrorType.ABORT_ERROR;
    case "SERVER_ERROR":
    case "PROVIDER_ERROR":
    case "NO_RESULT":
      return AIErrorType.SERVER_ERROR;
    default:
      return AIErrorType.UNKNOWN_ERROR;
  }
}

function mapMessageToCode(message: string, fallback: string = "UNKNOWN"): string {
  const lower = message.toLowerCase();
  if (lower.includes("validation")) return "VALIDATION_ERROR";
  if (lower.includes("quota")) return "PROVIDER_QUOTA_EXHAUSTED";
  if (lower.includes("unavailable")) return "PROVIDER_UNAVAILABLE";
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return lower.includes("aborted") ? "ABORTED" : "TIMEOUT";
  }
  if (lower.includes("parse") || lower.includes("json")) return "PARSE_ERROR";
  if (lower.includes("no result")) return "NO_RESULT";
  if (lower.includes("network") || lower.includes("fetch")) return "NETWORK_ERROR";
  return fallback;
}

export class AIError extends Error {
  public readonly type: AIErrorType;
  public readonly code: string;
  public readonly cause?: unknown;
  public readonly metadata: AIErrorMetadata;

  constructor(
    typeOrMessage: AIErrorType | string,
    messageOrCode?: string,
    cause?: unknown,
    metadata: AIErrorMetadata = {},
  ) {
    let effectiveType: AIErrorType;
    let effectiveMessage: string;
    let effectiveCode: string;

    if (KNOWN_ERROR_TYPES.has(typeOrMessage)) {
      effectiveType = typeOrMessage as AIErrorType;
      effectiveMessage = messageOrCode ?? "";
      effectiveCode = effectiveType;
    } else {
      effectiveMessage = typeOrMessage;
      effectiveCode = messageOrCode ?? "UNKNOWN";
      effectiveType = mapCodeToType(effectiveCode);
    }

    super(effectiveMessage);
    this.name = "AIError";
    this.type = effectiveType;
    this.code = effectiveCode;
    this.cause = cause;
    this.metadata = metadata;
  }

  static from(error: unknown, fallbackCode: string = "UNKNOWN"): AIError {
    if (error instanceof AIError) return error;
    if (error instanceof Error) {
      const code = mapMessageToCode(error.message, fallbackCode);
      return new AIError(error.message, code, error);
    }
    return new AIError(String(error), fallbackCode, error);
  }

  override toString(): string {
    const statusPart =
      typeof this.metadata.status === "number" ? ` (HTTP ${this.metadata.status})` : "";
    return `${this.name} [${this.type}]: ${this.message}${statusPart}`;
  }

  toJSON(): {
    name: string;
    type: AIErrorType;
    code: string;
    message: string;
    metadata: AIErrorMetadata;
  } {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      metadata: this.metadata,
    };
  }
}
