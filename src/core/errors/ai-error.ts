
import { AIErrorType } from "./ai-error-types";

export interface AIErrorMetadata {
  readonly status?: number;
  readonly url?: string;
  readonly [key: string]: unknown;
}

export class AIError extends Error {
  public readonly type: AIErrorType;
  public readonly cause?: Error;
  public readonly metadata: AIErrorMetadata;

  constructor(
    type: AIErrorType,
    message: string,
    cause?: Error,
    metadata: AIErrorMetadata = {},
  ) {
    super(message);
    this.name = "AIError";
    this.type = type;
    this.cause = cause;
    this.metadata = metadata;
  }

  override toString(): string {
    const statusPart =
      typeof this.metadata.status === "number" ? ` (HTTP ${this.metadata.status})` : "";
    return `${this.name} [${this.type}]: ${this.message}${statusPart}`;
  }

  toJSON(): {
    name: string;
    type: AIErrorType;
    message: string;
    metadata: AIErrorMetadata;
  } {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      metadata: this.metadata,
    };
  }
}
