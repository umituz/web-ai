
/**
 * Entities for the fal.ai QUEUE client — the async lane (submit → poll →
 * harvest) that long-running image/video/audio models ride, as opposed to
 * the sync FalProvider in ./fal.provider.ts. Apps persist jobs in their own
 * storage; this module only speaks the queue wire.
 */

/** Any env carrying the fal key as an optional secret (app envs satisfy it). */
export interface FalQueueEnv {
  FAL_KEY?: string;
}

/** Error carrying the provider status when one exists (route → HTTP code). */
export class FalQueueError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FalQueueError';
    this.status = status;
  }
}

/** Queue lifecycle as fal reports it. */
export type FalJobStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/** POST /{model} response — the ABSOLUTE URLs apps store on their job rows. */
export type FalSubmitResponse = {
  status: string;
  request_id: string;
  response_url: string;
  status_url: string;
};

export type FalStatusResponse = {
  status: FalJobStatus;
  queue_position?: number;
  logs?: Array<{ message?: string; level?: string }>;
};

/** What submit() hands back — stored verbatim, never reconstructed. */
export interface FalSubmittedJob {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

/** One checkStatus() result — logs are flattened to message strings. */
export interface FalStatusSnapshot {
  status: FalJobStatus;
  queuePosition?: number;
  logs?: string[];
}

/**
 * Capability-neutral job input — every lane's request folded into one
 * shape. Wire builders pick the fields the picked model takes; anything a
 * model does not take is rejected by the app's spec gate, never silently
 * dropped onto the wire.
 */
export interface FalJobInput {
  prompt: string;
  /** Image lane: how many images were requested. */
  numImages?: number;
  aspectRatio?: string;
  /** Video lane (i2v): source image — https URL or data URI. */
  imageUrl?: string;
  /** Video/audio lane: selected length in seconds (spec-driven). */
  durationSeconds?: number;
  /** Video lane: provider negative prompt, when the model supports one. */
  negativePrompt?: string;
  /** Video lane: e.g. "720p", when the model offers resolutions. */
  resolution?: string;
  /** Audio lane: lyrics with structural [verse]/[chorus] tags. */
  lyrics?: string;
  /** Audio lane: vocals off — instrumental render. */
  instrumental?: boolean;
}

/**
 * Parsed provider output — fal-hosted URLs, persisted verbatim by the app.
 * fal.media URLs are temporary (~7 days); apps harvest into durable storage.
 * Parsers return null/empty when nothing usable came back — that is a
 * failed job, never an empty success.
 */
export interface FalJobOutput {
  /** Image lane: one URL per requested image. */
  imageUrls?: string[];
  videoUrl?: string;
  audioUrl?: string;
  seed?: number;
  width?: number;
  height?: number;
  contentType?: string;
  fileSize?: number;
}

/**
 * Per-model input contract for the video lane. Every entry is read off the
 * live model schema — a model without a verified spec entry stays locked in
 * the app's catalog (the registry IS the availability contract).
 */
export interface FalVideoModelSpec {
  /** Selectable durations in seconds — what the studio's chips offer. */
  durations: number[];
  /** How the provider serializes duration: kling "5", veo "8s", wan none. */
  durationFormat: 'plain' | 's-suffix' | 'none';
  /** Absent = no aspect is sent; i2v video follows the input image. */
  aspectRatios?: string[];
  resolutions?: string[];
  supportsNegativePrompt: boolean;
  /** Model can generate an audio track (veo family) — sent as true. */
  generateAudio?: boolean;
}

/** Per-model input contract for the audio (music) lane. */
export interface FalAudioModelSpec {
  /** Selectable durations in seconds. */
  durations: number[];
  /** Model separates lyrics from the tag prompt ([verse]/[chorus] tags). */
  supportsLyrics: boolean;
  /** Model takes an instrumental flag (vocals off). */
  supportsInstrumental: boolean;
}

/** The fal image_size values each picker ratio maps onto (flux family). */
export const FAL_ASPECT_IMAGE_SIZES: Record<string, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
};
