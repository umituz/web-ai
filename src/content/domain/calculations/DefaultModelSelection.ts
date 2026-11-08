
import type { GenerationType } from '../types/GenerationTypes';
import { ModelDefaults } from '../limits/ModelDefaults';

export function resolveDefaultPrunaModel(generationType: GenerationType): string {
  switch (generationType) {
    case 'image-to-image':
      return ModelDefaults.PRUNA_IMAGE_EDIT;
    case 'image-to-video':
      return ModelDefaults.PRUNA_VIDEO;
    case 'text-to-image':
      return ModelDefaults.PRUNA_IMAGE;
    case 'text-to-video':
      return ModelDefaults.PRUNA_VIDEO;
  }
}
