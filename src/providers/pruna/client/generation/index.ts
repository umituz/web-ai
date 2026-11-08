
export { generate, generateImageThenVideo } from './services/generation.service';

export { createDefaultBuilderRegistry } from './builders/builder-factory';
export { ModelInputBuilderRegistry } from './builders/model-input-builder';
export type { ModelInputBuilder, ModelInputBuildContext } from './builders/model-input-builder';

export type {
  PrunaInput,
  PrunaResult,
  TextToVideoInput,
  GenerateOptions,
} from '../core/entities/types';
