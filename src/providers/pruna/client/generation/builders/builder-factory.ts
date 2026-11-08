
import type { PrunaInput } from '../../core/entities/types';
import { TextToImageInputBuilder } from './text-to-image.builder';
import { ImageToImageInputBuilder } from './image-to-image.builder';
import { ImageToVideoInputBuilder } from './image-to-video.builder';
import { ModelInputBuilderRegistry } from './model-input-builder';

export function createDefaultBuilderRegistry(): ModelInputBuilderRegistry {
  return new ModelInputBuilderRegistry()
    .register(new TextToImageInputBuilder())
    .register(new ImageToImageInputBuilder())
    .register(new ImageToVideoInputBuilder());
}

export type AnyModelInputBuilder =
  | TextToImageInputBuilder
  | ImageToImageInputBuilder
  | ImageToVideoInputBuilder;

export type { PrunaInput };
