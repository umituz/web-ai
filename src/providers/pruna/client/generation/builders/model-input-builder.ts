
import type {
  PrunaInput,
  GenerateOptions,
} from '../../core/entities/types';
import { isCancellationError } from '../../core/errors/cancellation-error';

export interface ModelInputBuildContext {
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: GenerateOptions['onProgress'];
}

export interface ModelInputBuilder<T extends PrunaInput = PrunaInput> {
  readonly model: T['model'];
  build(input: T, context: ModelInputBuildContext): Promise<Record<string, unknown>>;
}

export class ModelInputBuilderRegistry {
  private readonly builders = new Map<PrunaInput['model'], ModelInputBuilder>();

  register(builder: ModelInputBuilder): this {
    this.builders.set(builder.model, builder);
    return this;
  }

  resolve(model: PrunaInput['model']): ModelInputBuilder {
    const builder = this.builders.get(model);
    if (!builder) {
      throw new Error(`No input builder registered for model: ${model}`);
    }
    return builder;
  }
}

export { isCancellationError };
