
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageQuality = 'standard' | 'hd' | '4k';
export type VideoQuality = '720p' | '1080p' | '4k';
export type MotionStrength = 'slow' | 'medium' | 'fast';
export type ImageStyle = 'realistic' | 'artistic' | 'anime' | 'cinematic' | 'vintage' | 'fantasy' | 'minimalist' | 'abstract';

export interface AspectRatioOption {
  value: AspectRatio;
  label: string;
  width: number;
  height: number;
}

export interface ImageQualityOption {
  value: ImageQuality;
  label: string;
  description: string;
  resolution: string;
}

export interface VideoQualityOption {
  value: VideoQuality;
  label: string;
  resolution: string;
}

export interface MotionOption {
  value: MotionStrength;
  label: string;
  description: string;
}

export interface StylePreset {
  value: ImageStyle;
  label: string;
  promptFragment: string;
}

export const ASPECT_RATIO_OPTIONS: ReadonlyArray<AspectRatioOption> = [
  { value: '1:1', label: 'Square', width: 1024, height: 1024 },
  { value: '16:9', label: 'Landscape', width: 1920, height: 1080 },
  { value: '9:16', label: 'Portrait', width: 1080, height: 1920 },
  { value: '4:3', label: 'Standard', width: 1440, height: 1080 },
  { value: '3:4', label: 'Tall', width: 1080, height: 1440 },
] as const;

export const IMAGE_QUALITY_OPTIONS: ReadonlyArray<ImageQualityOption> = [
  { value: 'standard', label: 'Standard', description: '1024x1024, good quality', resolution: '1024x1024' },
  { value: 'hd', label: 'HD', description: '1920x1080, high quality', resolution: '1920x1080' },
  { value: '4k', label: '4K', description: '3840x2160, ultra quality', resolution: '3840x2160' },
] as const;

export const VIDEO_QUALITY_OPTIONS: ReadonlyArray<VideoQualityOption> = [
  { value: '720p', label: '720p HD', resolution: '1280x720' },
  { value: '1080p', label: '1080p Full HD', resolution: '1920x1080' },
  { value: '4k', label: '4K Ultra HD', resolution: '3840x2160' },
] as const;

export const VIDEO_DURATION_OPTIONS_SECONDS: ReadonlyArray<number> = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const MOTION_OPTIONS: ReadonlyArray<MotionOption> = [
  { value: 'slow', label: 'Slow', description: 'Gentle movement' },
  { value: 'medium', label: 'Medium', description: 'Balanced motion' },
  { value: 'fast', label: 'Fast', description: 'Dynamic movement' },
] as const;

export const STYLE_PRESETS: ReadonlyArray<StylePreset> = [
  { value: 'realistic', label: 'Realistic', promptFragment: 'realistic, photograph, detailed' },
  { value: 'artistic', label: 'Artistic', promptFragment: 'artistic, painting, creative' },
  { value: 'anime', label: 'Anime', promptFragment: 'anime style, manga, vibrant colors' },
  { value: 'cinematic', label: 'Cinematic', promptFragment: 'cinematic, movie scene, dramatic lighting' },
  { value: 'vintage', label: 'Vintage', promptFragment: 'vintage, retro, film grain' },
  { value: 'fantasy', label: 'Fantasy', promptFragment: 'fantasy, magical, ethereal' },
  { value: 'minimalist', label: 'Minimalist', promptFragment: 'minimalist, clean, simple' },
  { value: 'abstract', label: 'Abstract', promptFragment: 'abstract, geometric, artistic' },
] as const;
