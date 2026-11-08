
import type {
  PrunaInput,
  TextToImageInput,
  ImageToImageInput,
  ImageToVideoInput,
  TextToVideoInput,
} from '../entities/types';

export function isTextToImageInput(input: PrunaInput): input is TextToImageInput {
  return input.model === 'p-image';
}

export function isImageToImageInput(input: PrunaInput): input is ImageToImageInput {
  return input.model === 'p-image-edit';
}

export function isImageToVideoInput(input: PrunaInput): input is ImageToVideoInput {
  return input.model === 'p-video';
}

export function isImageGenerationModel(model: PrunaInput['model']): boolean {
  return model === 'p-image' || model === 'p-image-edit';
}

export function isVideoGenerationModel(model: PrunaInput['model']): boolean {
  return model === 'p-video';
}

export function isTextToVideoPipeline(input: unknown): input is TextToVideoInput {
  return typeof input === 'object'
    && input !== null
    && 'prompt' in input
    && !('model' in input);
}
