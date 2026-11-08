
import type { WizardStep } from './base.wizard';
import type { ImageGenerationRequest } from '../content/domain/config/ProviderConfig';

export type ImageWizardStep =
  | 'input-prompt'
  | 'select-style'
  | 'configure'
  | 'advanced'
  | 'preview'
  | 'generating'
  | 'results';

export interface ImageWizardData {
  prompt?: string;

  style?: 'realistic' | 'cartoon' | 'abstract' | 'minimalist' | 'vintage';

  format?: 'square' | 'landscape' | 'portrait' | 'story' | 'banner';
  quality?: 'standard' | 'high' | 'ultra';
  quantity?: number;

  colorPalette?: string[];
  platform?: 'instagram' | 'youtube' | 'facebook' | 'twitter' | 'general';

  generatedImageUrl?: string;
  generatedId?: string;
}

export const IMAGE_WIZARD_STEPS: ReadonlyArray<WizardStep<ImageWizardStep>> = [
  {
    id: 'input-prompt',
    label: 'Describe Image',
    icon: 'Image',
    description: 'Describe the image you want to create',
    validate: (data) => {
      const prompt = (data as ImageWizardData).prompt;
      return typeof prompt === 'string' && prompt.length > 0;
    },
  },
  {
    id: 'select-style',
    label: 'Style',
    icon: 'Palette',
    description: 'Choose the artistic style',
    validate: (data) => Boolean((data as ImageWizardData).style),
  },
  {
    id: 'configure',
    label: 'Configure',
    icon: 'Settings',
    description: 'Set format, quality, and quantity',
    validate: (data) => {
      const d = data as ImageWizardData;
      return Boolean(d.format && d.quality);
    },
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: 'Sliders',
    description: 'Color palette and platform optimization',
    optional: true,
  },
  { id: 'preview', label: 'Preview', icon: 'Eye', description: 'Review your settings' },
  { id: 'generating', label: 'Generating', icon: 'Sparkles', description: 'AI is creating your image' },
  { id: 'results', label: 'Results', icon: 'Image', description: 'Your generated image is ready' },
];

export function buildImageRequest(data: ImageWizardData): ImageGenerationRequest {
  return {
    type: 'image',
    prompt: data.prompt ?? '',
    style: data.style,
    format: data.format,
    quality: data.quality,
    quantity: data.quantity ?? 1,
  };
}
