
import type {
  GroqChatRequest,
  GroqGenerationConfig,
  GroqMessage,
  GroqReasoningEffort,
} from "./groq.entities";
import { DEFAULT_GENERATION_CONFIG } from "./groq.constants";

interface MutableRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  n?: number;
  stop?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  reasoning_effort?: GroqReasoningEffort;
  stream?: boolean;
}

export class GroqChatRequestBuilder {
  private readonly model: string;
  private messages: GroqMessage[] = [];
  private generationConfig: GroqGenerationConfig = {};
  private streamEnabled = false;
  private jsonResponse = false;

  constructor(model: string) {
    this.model = model;
  }

  static for(model: string): GroqChatRequestBuilder {
    return new GroqChatRequestBuilder(model);
  }

  withMessages(messages: ReadonlyArray<GroqMessage>): this {
    this.messages = [...messages];
    return this;
  }

  withConfig(config: GroqGenerationConfig | undefined): this {
    this.generationConfig = config ? { ...config } : {};
    return this;
  }

  withStream(stream: boolean): this {
    this.streamEnabled = stream;
    return this;
  }

  withJsonResponse(enabled: boolean): this {
    this.jsonResponse = enabled;
    return this;
  }

  build(): GroqChatRequest {
    const cfg = this.generationConfig;
    const request: MutableRequest = {
      model: this.model,
      messages: this.messages,
      temperature: cfg.temperature ?? DEFAULT_GENERATION_CONFIG.temperature,
      max_tokens: cfg.maxTokens ?? DEFAULT_GENERATION_CONFIG.maxTokens,
      top_p: cfg.topP ?? DEFAULT_GENERATION_CONFIG.topP,
    };

    if (cfg.n !== undefined) request.n = cfg.n;
    if (cfg.stop !== undefined) request.stop = cfg.stop;
    if (cfg.frequencyPenalty !== undefined) request.frequency_penalty = cfg.frequencyPenalty;
    if (cfg.presencePenalty !== undefined) request.presence_penalty = cfg.presencePenalty;
    if (cfg.reasoningEffort !== undefined) request.reasoning_effort = cfg.reasoningEffort;
    if (this.jsonResponse) {
      (request as { response_format?: { type: string } }).response_format = { type: "json_object" };
    }
    if (this.streamEnabled) request.stream = true;

    return request as GroqChatRequest;
  }
}
