
import type { WizardStep } from './base.wizard';
import type { VideoGenerationRequest, ImageToVideoRequest, VideoToVideoRequest } from '../content/domain/config/ProviderConfig';

export type VideoGenerationType = 'text-to-video' | 'image-to-video' | 'video-to-video';

export type VideoWizardStep =
  | 'select-type'
  | 'input-source'
  | 'configure'
  | 'advanced'
  | 'preview'
  | 'generating'
  | 'results';

export interface VideoWizardData {
  generationType?: VideoGenerationType;

  prompt?: string;
  imageUrl?: string;
  sourceVideoUrl?: string;

  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  style?: 'realistic' | 'animated' | 'cinematic' | 'documentary';
  quality?: 'standard' | 'high' | 'ultra';

  motion?: 'slow' | 'medium' | 'fast';
  camera?: 'static' | 'pan' | 'zoom' | 'tracking';
  styleTransfer?: 'cinematic' | 'anime' | 'cartoon' | 'vintage';
  enhanceQuality?: boolean;

  generatedVideoUrl?: string;
  generatedId?: string;
}

const validateSource = (data: Record<string, unknown>): boolean => {
  const d = data as VideoWizardData;
  if (d.generationType === 'text-to-video') {
    return typeof d.prompt === 'string' && d.prompt.length > 0;
  }
  if (d.generationType === 'image-to-video') {
    return typeof d.imageUrl === 'string' && d.imageUrl.length > 0;
  }
  if (d.generationType === 'video-to-video') {
    return typeof d.sourceVideoUrl === 'string' && d.sourceVideoUrl.length > 0
      && typeof d.prompt === 'string' && d.prompt.length > 0;
  }
  return false;
};

export const VIDEO_WIZARD_STEPS: ReadonlyArray<WizardStep<VideoWizardStep>> = [
  {
    id: 'select-type',
    label: 'Select Type',
    icon: 'Video',
    description: 'Choose video generation type',
    validate: (data) => Boolean((data as VideoWizardData).generationType),
  },
  {
    id: 'input-source',
    label: 'Source',
    icon: 'FileInput',
    description: 'Provide your source (prompt, image, or video)',
    validate: validateSource,
  },
  {
    id: 'configure',
    label: 'Configure',
    icon: 'Settings',
    description: 'Set duration, aspect ratio, and style',
    validate: (data) => {
      const d = data as VideoWizardData;
      return Boolean(d.duration && d.aspectRatio);
    },
  },
  { id: 'advanced', label: 'Advanced', icon: 'Sliders', description: 'Additional video options', optional: true },
  { id: 'preview', label: 'Preview', icon: 'Eye', description: 'Review your settings' },
  { id: 'generating', label: 'Generating', icon: 'Sparkles', description: 'AI is creating your video' },
  { id: 'results', label: 'Results', icon: 'Video', description: 'Your generated video is ready' },
];

export function buildVideoRequest(
  data: VideoWizardData,
): VideoGenerationRequest | ImageToVideoRequest | VideoToVideoRequest {
  switch (data.generationType) {
    case 'text-to-video':
      return {
        type: 'video',
        prompt: data.prompt ?? '',
        duration: data.duration ?? 5,
        aspectRatio: data.aspectRatio ?? '16:9',
        style: data.style,
        quality: data.quality,
      } as VideoGenerationRequest;
    case 'image-to-video':
      return {
        type: 'video',
        imageUrl: data.imageUrl ?? '',
        prompt: data.prompt,
        duration: data.duration ?? 5,
        motion: data.motion ?? 'medium',
        camera: data.camera ?? 'static',
      } as ImageToVideoRequest;
    case 'video-to-video':
      return {
        type: 'video',
        sourceVideoUrl: data.sourceVideoUrl ?? '',
        prompt: data.prompt ?? '',
        styleTransfer: data.styleTransfer,
        enhanceQuality: data.enhanceQuality,
      } as VideoToVideoRequest;
    default:
      throw new Error(`Unsupported generation type: ${data.generationType}`);
  }
}
