
import { useCallback, useState } from 'react';
import type { BlogGenerationRequest, GeneratedBlog } from '../content/domain/entities/ContentGeneration';
import type { ProviderConfig } from '../content/domain/config/ProviderConfig';
import { useAIContentContext, type ContentServiceConfig } from './internal/useAIContentContext';

export interface UseBlogGeneratorOptions {
  config?: ContentServiceConfig;
  apiKey?: string;
  model?: string;
  providers?: ProviderConfig;
}

export interface UseBlogGeneratorReturn {
  isGenerating: boolean;
  generatedBlog: GeneratedBlog | null;
  error: string | null;
  generateBlog: (request: BlogGenerationRequest) => Promise<void>;
  reset: () => void;
}

export function useBlogGenerator(options: UseBlogGeneratorOptions): UseBlogGeneratorReturn {
  const { service, ctx } = useAIContentContext({
    config: options.config,
    apiKey: options.apiKey,
    model: options.model,
    providers: options.providers,
  });
  const [generatedBlog, setGeneratedBlog] = useState<GeneratedBlog | null>(null);

  const generateBlog = useCallback(
    async (request: BlogGenerationRequest) => {
      const result = await ctx.execute(
        () => service.generateBlogPost(request),
        'Failed to generate blog post',
      );
      if (result) setGeneratedBlog(result);
    },
    [ctx, service],
  );

  const reset = useCallback(() => {
    setGeneratedBlog(null);
    ctx.setError(null);
  }, [ctx]);

  return {
    isGenerating: ctx.isLoading,
    generatedBlog,
    error: ctx.error,
    generateBlog,
    reset,
  };
}
