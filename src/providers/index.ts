export type {
  ProviderCapability,
  CostEstimateRequest,
  IProviderBase,
  ITextProvider,
  IMediaProvider,
  AnyProvider,
  IAIProvider,
} from "./base/provider.types";
export { isTextProvider, isMediaProvider } from "./base/provider.types";
export { BaseProvider, BaseAIProvider, ProviderError } from "./base/base.provider";
export type { BaseProviderConfig } from "./base/base.provider";

export { ProviderFactory, createProviderFactory } from "./factory/provider.factory";
export type { ProviderFactoryConfig } from "./factory/provider.factory";
export { createAI } from "./factory/create-ai";
export type { AIProviderConfig } from "./factory/create-ai";

export { AnthropicProvider } from "./anthropic/anthropic.provider";
export {
  ANTHROPIC_MODELS,
  ANTHROPIC_TIERS,
  ANTHROPIC_API_VERSION,
  ANTHROPIC_DEFAULT_MAX_TOKENS,
} from "./anthropic/anthropic.constants";
export type { AnthropicEffort } from "./anthropic/anthropic.constants";
export { AnthropicRequestBuilder, defaultEffortForModel } from "./anthropic/anthropic-request.builder";
export { consumeAnthropicStream, mapAnthropicStopReason } from "./anthropic/anthropic-stream.parser";
export { AnthropicHttpTransport } from "./anthropic/anthropic-http.transport";
export type {
  AnthropicProviderConfig,
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  AnthropicStreamEvent,
  AnthropicStopReason,
} from "./anthropic/anthropic.entities";

export { GroqProvider, createGroqProvider, toGroqMessages } from "./groq/groq.provider";
export {
  GROQ_MODELS,
  GROQ_TIERS,
  DEFAULT_MODELS,
  DEFAULT_BASE_URL,
  API_ENDPOINTS,
  TIMEOUTS,
  DEFAULT_GENERATION_CONFIG,
} from "./groq/groq.constants";
export { GroqChatRequestBuilder } from "./groq/groq-request.builder";
export { GroqHttpClient } from "./groq/groq-http-client";
export type { GroqHttpClientDeps } from "./groq/groq-http-client";
export { GroqHttpTransport } from "./groq/groq-http-transport";
export { GroqConfigStore } from "./groq/groq-config-store";
export {
  extractContentFromSsePayload,
  consumeGroqStream,
} from "./groq/groq-sse";
export {
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  createMessage,
  promptToMessages,
  extractTextFromMessages,
  formatMessagesForDisplay,
} from "./groq/groq-messages";
export { requestStructuredJson } from "./groq/groq-structured-json";
export type { StructuredJsonRequest } from "./groq/groq-structured-json";
export { TextGenerationService } from "./groq/text-generation.service";
export type {
  TextGenerationOptions,
  StreamingCallbacks,
  StructuredGenerationOptions,
  IGroqChatService,
  IGroqHttpClient,
} from "./groq/groq-interfaces";
export {
  configureProvider,
  getProvider,
  resetProvider,
  bootProvider,
} from "./groq/groq-container";
export type { AppContainer, BootProviderOptions } from "./groq/groq-container";
export type {
  GroqProviderConfig,
  GroqConfig,
  GroqChatRequest,
  GroqChatResponse,
  GroqChatChunk,
  GroqMessage,
  GroqMessageRole,
  GroqReasoningEffort,
  GroqGenerationConfig,
  GroqUsage,
  GroqChoice,
  GroqChunkChoice,
  GroqErrorResponse,
  StreamRequestOptions,
} from "./groq/groq.entities";

export { GeminiProvider, createGeminiProvider, GEMINI_TIERS } from "./gemini/gemini.provider";
export { FalProvider, createFalProvider } from "./fal/fal.provider";
export {
  OpenAiCompatibleProvider,
  createOpenAiCompatibleProvider,
} from "./openai-compatible/openai-compatible.provider";
export type {
  OpenAiCompatibleProviderConfig,
} from "./openai-compatible/openai-compatible.entities";

/* Cloudflare Workers AI — binding-driven text + speech (env.AI, no apiKey). */
export {
  WorkersAIProvider,
  createWorkersAIProvider,
  WORKERS_AI_TIERS,
} from "./workers-ai/workers-ai.provider";
export {
  WorkersAIError,
} from "./workers-ai/workers-ai.entities";
export type {
  WorkersAIBinding,
  WorkersAIEnv,
  WorkersAIMessage,
  WorkersAIProviderConfig,
} from "./workers-ai/workers-ai.entities";
export {
  runWorkersAIText,
  streamWorkersAIText,
  workersAIConfigured,
  WORKERS_AI_LLM_MODEL,
} from "./workers-ai/workers-ai.text";
export type { WorkersAITextOptions } from "./workers-ai/workers-ai.text";
export {
  createWorkersAIChatAdapter,
  WORKERS_AI_CHAT_TIMEOUT_MS,
  WORKERS_AI_CONTEXT_WINDOW,
} from "./adapters/workers-ai.adapter";
export type { WorkersAIChatAdapterOptions } from "./adapters/workers-ai.adapter";
export {
  speakWithWorkersAI,
} from "./workers-ai/workers-ai.speech";
export type {
  WorkersAISpeechEngine,
  WorkersAISpeechResult,
} from "./workers-ai/workers-ai.speech";

/* fal.ai QUEUE lane — async submit → poll → harvest (long-running models). */
export {
  createFalQueue,
  falQueueConfigured,
} from "./fal/queue/fal-queue.client";
export type { FalQueueClient } from "./fal/queue/fal-queue.client";
export { FalQueueError, FAL_ASPECT_IMAGE_SIZES } from "./fal/queue/fal-queue.entities";
export type {
  FalQueueEnv,
  FalJobStatus,
  FalSubmitResponse,
  FalStatusResponse,
  FalSubmittedJob,
  FalStatusSnapshot,
  FalJobInput,
  FalJobOutput,
  FalVideoModelSpec,
  FalAudioModelSpec,
} from "./fal/queue/fal-queue.entities";
export {
  buildFalImageInput,
  buildFalVideoInput,
  buildFalAudioInput,
  buildFalTagPrompt,
  buildFalAudioLyrics,
  parseFalImageOutput,
  parseFalVideoOutput,
  parseFalAudioOutput,
} from "./fal/queue/fal-wire";

export { PrunaProvider, createPrunaProvider, generateWithPruna } from "./pruna/pruna.provider";
export type { PrunaRequest, PrunaProgressStage } from "./pruna/pruna.provider";

export {
  generate as generatePruna,
  generateImageThenVideo,
  uploadImage,
  submitPrediction,
  pollForResult,
  CancellationError,
  AuthenticationError,
  TimeoutError,
  ValidationError,
  GenerationFailedError,
} from "./pruna/client";
export type {
  PrunaInput,
  PrunaResult,
  PrunaModelId,
  PrunaAspectRatio,
  PrunaResolution,
  GenerationStage,
  TextToImageInput,
  ImageToImageInput,
  ImageToVideoInput,
  TextToVideoInput,
  GenerateOptions,
  PrunaPredictionResponse,
  PrunaOutput,
} from "./pruna/client";

export { createOpenAiEmbeddingsAdapter } from "./embeddings/openai-embeddings";
export type {
  EmbeddingsRequest,
  EmbeddingsResult,
  EmbeddingsAdapter,
  OpenAiCompatibleConfig,
} from "./embeddings/openai-embeddings";

export {
  createOpenAiAudioTranscriptionAdapter,
  createGroqAudioTranscriptionAdapter,
  GROQ_OPENAI_BASE_URL,
  GROQ_WHISPER_MODELS,
} from "./audio/audio-transcription";
export type {
  AudioTranscriptionRequest,
  AudioTranscriptionResult,
  AudioTranscriptionAdapter,
  GroqWhisperModel,
  GroqAudioTranscriptionConfig,
} from "./audio/audio-transcription";

export {
  createOpenAiSpeechAdapter,
  SPEECH_VOICES,
  SPEECH_INPUT_MAX,
} from "./audio/speech-synthesis";
export type {
  SpeechVoice,
  SpeechRequest,
  SpeechResult,
  SpeechAdapter,
} from "./audio/speech-synthesis";

export {
  createOpenAiImageAdapter,
  IMAGE_SIZES,
  IMAGE_QUALITIES,
  IMAGE_B64_LIMIT,
} from "./images/openai-images";
export type {
  ImageRequest,
  ImageResult,
  ImageAdapter,
  ImageSize,
  ImageQuality,
} from "./images/openai-images";

export { createOpenAiCompatibleAdapter } from "./adapters/openai-compatible.adapter";
export { createAnthropicAdapter } from "./adapters/anthropic.adapter";
export type {
  ChatAdapter,
  ProviderEvent,
  AdapterRequest,
  AdapterConfig,
  RequestImage,
  ToolDefinition,
  AdapterChatMessage,
  AdapterChatRole,
} from "./adapters/adapter.types";
export {
  createAdapterResolver,
  chatAdapterFor,
  imageAdapterFor,
  embeddingsAdapterFor,
  audioTranscriptionAdapterFor,
  speechAdapterFor,
  resolveApiKey,
  apiKeyAvailable,
  ADAPTER_TIMEOUT_MS,
  ADAPTER_MEDIA_TIMEOUT_MS,
} from "./adapters/adapter-resolver";
export type {
  AdapterProviderBinding,
  AdapterEnvBinding,
  AdapterResolver,
  AdapterResolverTiming,
} from "./adapters/adapter-resolver";
export { runConversation } from "./execution/run-conversation";
export type {
  ConversationAttempt,
  ConversationAttemptModel,
  ConversationAttemptSettings,
  ConversationEvent,
  ConversationTurnResult,
  RunConversationInput,
} from "./execution/run-conversation";
