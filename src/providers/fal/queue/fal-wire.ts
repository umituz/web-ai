
import {
  FAL_ASPECT_IMAGE_SIZES,
  type FalAudioModelSpec,
  type FalJobInput,
  type FalJobOutput,
  type FalVideoModelSpec,
} from './fal-queue.entities';

/**
 * Model-family wire mappers for the fal queue lane — snake_case input
 * whitelists and shape-tolerant output readers. Production-verified model
 * by model (storyora's verified-or-planned rule): an unknown family is
 * unreachable when the app's catalog only marks a model `available` once a
 * mapper here handles it.
 */

/* ── Image lane ────────────────────────────────────────────────────────── */

type FalImageEntry = { url?: unknown; width?: unknown; height?: unknown };

/** Image input mapper — flux family takes image_size off the aspect ratio;
 *  fast-sdxl takes prompt + num_images only (kept minimal until its full
 *  schema is verified against fal). */
export function buildFalImageInput(model: string, input: FalJobInput): Record<string, unknown> {
  const base: Record<string, unknown> = { prompt: input.prompt, num_images: input.numImages };
  if (model.includes('flux')) {
    const imageSize = input.aspectRatio ? FAL_ASPECT_IMAGE_SIZES[input.aspectRatio] : undefined;
    if (imageSize) base.image_size = imageSize;
  }
  return base;
}

/** Normalize image output — flux family `{images:[{url,w,h}]}`, single-image
 *  models `{image:{url}}`, plus the seed some models echo back. */
export function parseFalImageOutput(raw: unknown): FalJobOutput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const entries: FalImageEntry[] = Array.isArray(obj.images)
    ? (obj.images as FalImageEntry[])
    : obj.image && typeof obj.image === 'object'
      ? [obj.image as FalImageEntry]
      : [];
  const imageUrls = entries
    .map((e) => (typeof e.url === 'string' ? e.url : ''))
    .filter((url): url is string => url.length > 0);
  const first = entries.find((e) => typeof e.width === 'number' || typeof e.height === 'number');
  return {
    imageUrls,
    ...(typeof obj.seed === 'number' ? { seed: obj.seed } : {}),
    ...(typeof first?.width === 'number' ? { width: first.width } : {}),
    ...(typeof first?.height === 'number' ? { height: first.height } : {}),
  };
}

/* ── Video lane ────────────────────────────────────────────────────────── */

/** Video input mapper — entirely spec-driven. The caller has already
 *  validated the request against the model's spec, so this only serializes:
 *  duration format per family (kling "5", veo "8s", wan none), aspect/
 *  resolution only when the model takes them, image_url for i2v.
 *  Unsupported params are never silently dropped onto the wire. */
export function buildFalVideoInput(spec: FalVideoModelSpec, input: FalJobInput): Record<string, unknown> {
  const base: Record<string, unknown> = { prompt: input.prompt };
  if (spec.durationFormat !== 'none' && typeof input.durationSeconds === 'number') {
    base.duration = spec.durationFormat === 's-suffix' ? `${input.durationSeconds}s` : String(input.durationSeconds);
  }
  if (spec.aspectRatios && input.aspectRatio) base.aspect_ratio = input.aspectRatio;
  if (spec.resolutions && input.resolution) base.resolution = input.resolution;
  if (input.imageUrl) base.image_url = input.imageUrl;
  if (spec.supportsNegativePrompt && input.negativePrompt) base.negative_prompt = input.negativePrompt;
  if (spec.generateAudio) base.generate_audio = true;
  return base;
}

type FalVideoPayload = { url?: unknown; content_type?: unknown; file_size?: unknown };

/** Every verified fal video model returns `{video: {url, content_type?,
 *  file_size?}}`. Returns null when there's no usable video — the caller
 *  fails the job ("provider completed without a video") rather than
 *  persisting an empty output. */
export function parseFalVideoOutput(raw: unknown): FalJobOutput | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const video = obj.video && typeof obj.video === 'object' ? (obj.video as FalVideoPayload) : undefined;
  if (!video || typeof video.url !== 'string' || video.url.length === 0) return null;
  return {
    videoUrl: video.url,
    ...(typeof video.content_type === 'string' ? { contentType: video.content_type } : {}),
    ...(typeof video.file_size === 'number' ? { fileSize: video.file_size } : {}),
  };
}

/* ── Audio (music) lane ────────────────────────────────────────────────── */

/** ACE-Step reads tag-style prompts ("lofi, hiphop, chill"): lowercase,
 *  words over three characters, five keywords max, comma-joined. A
 *  comma-separated brief passes through nearly untouched; prose collapses
 *  to its strongest words. */
export function buildFalTagPrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((word) => word.length > 3)
    .slice(0, 5)
    .join(', ');
}

/** Lyrics normalization: instrumental renders get the [inst] marker; bare
 *  lyrics are wrapped in a [verse] block so the model reads structure even
 *  when the writer used no tags. Lyrics that already carry structural tags
 *  pass through verbatim. */
export function buildFalAudioLyrics(input: { lyrics?: string; instrumental?: boolean }): string | undefined {
  if (input.instrumental) return '[inst]';
  const lyrics = input.lyrics?.trim();
  if (!lyrics) return undefined;
  if (lyrics.includes('[verse]') || lyrics.includes('[chorus]')) return lyrics;
  return `[verse]\n${lyrics}\n[/verse]`;
}

/** Audio input mapper — spec-driven like the video lane. CassetteAI's
 *  verified contract is the lean one (tags + duration); ACE-Step takes the
 *  tag prompt, normalized lyrics, duration and the instrumental flag. */
export function buildFalAudioInput(spec: FalAudioModelSpec, input: FalJobInput): Record<string, unknown> {
  const tags = buildFalTagPrompt(input.prompt);
  const base: Record<string, unknown> = { prompt: tags, duration: input.durationSeconds };
  if (spec.supportsLyrics) {
    const lyrics = buildFalAudioLyrics(input);
    if (lyrics) base.lyrics = lyrics;
  }
  if (spec.supportsInstrumental && input.instrumental !== undefined) {
    base.instrumental = input.instrumental;
  }
  return base;
}

type FalAudioPayload = { url?: unknown };

/** The verified fal music models answer in different shapes — ace-step
 *  `{audio_url: {url}}`, CassetteAI `{audio_file: {url}}`, plus the
 *  `audio.url` and flat-string variants. Returns null when there's no
 *  usable audio — the caller fails the job rather than persisting emptiness. */
export function parseFalAudioOutput(raw: unknown): FalJobOutput | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const nested = (key: string): string | undefined => {
    const value = obj[key];
    if (!value || typeof value !== 'object') return undefined;
    const url = (value as FalAudioPayload).url;
    return typeof url === 'string' && url.length > 0 ? url : undefined;
  };
  const flat = (key: string): string | undefined => {
    const value = obj[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  };
  const audioUrl = nested('audio_url') ?? nested('audio_file') ?? nested('audio') ?? flat('audio_url') ?? flat('audio');
  if (!audioUrl) return null;
  return { audioUrl };
}
