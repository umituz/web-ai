
export type PrunaModelId = 'p-image' | 'p-image-edit' | 'p-video';

export type PrunaAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3';

export type PrunaResolution = '720p' | '1080p';

export type GenerationStage = 'uploading' | 'predicting' | 'polling';

export type PrunaJobStatus = 'succeeded' | 'completed' | 'failed' | 'processing' | 'starting';

export interface GenerateOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (stage: GenerationStage, attempt?: number) => void;
  readonly useCache?: boolean;
}


export interface TextToImageInput {
  readonly model: 'p-image';
  readonly prompt: string;
  readonly aspect_ratio?: PrunaAspectRatio;
  readonly seed?: number;
}

export interface ImageToImageInput {
  readonly model: 'p-image-edit';
  readonly prompt: string;
  readonly image: string;
  readonly aspect_ratio?: PrunaAspectRatio;
  readonly seed?: number;
}

export interface ImageToVideoInput {
  readonly model: 'p-video';
  readonly prompt: string;
  readonly image: string;
  readonly duration?: number;
  readonly resolution?: PrunaResolution;
  readonly aspect_ratio?: PrunaAspectRatio;
  readonly draft?: boolean;
}

export type PrunaInput = TextToImageInput | ImageToImageInput | ImageToVideoInput;


export interface TextToVideoInput {
  readonly prompt: string;
  readonly duration?: number;
  readonly resolution?: PrunaResolution;
  readonly aspect_ratio?: PrunaAspectRatio;
  readonly draft?: boolean;
}


export interface PrunaResult {
  readonly url: string;
  readonly model: PrunaModelId;
}


export interface PrunaUrlOutput {
  readonly url: string;
}

export type PrunaOutput = string | PrunaUrlOutput | readonly string[];

export interface PrunaPredictionResponse {
  readonly generation_url?: string;
  readonly output?: PrunaOutput;
  readonly data?: string;
  readonly video_url?: string;
  readonly get_url?: string;
  readonly status_url?: string;
  readonly status?: PrunaJobStatus;
  readonly error?: string;
}

export interface PrunaFileUploadResponse {
  readonly id?: string;
  readonly urls?: { readonly get: string };
}
