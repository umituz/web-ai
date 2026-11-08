import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GroqGenerationConfig } from "../providers/groq/groq.entities";
import type { StreamingCallbacks } from "../providers/groq/groq-interfaces";
import type { TextGenerationService } from "../providers/groq/text-generation.service";
import { resolveUserFriendlyMessage } from "../core/errors/error-resolver";
import { getProvider } from "../providers/groq/groq-container";

export interface UseGroqOptions {
  readonly model?: string;
  readonly generationConfig?: GroqGenerationConfig;
  readonly onStart?: () => void;
  readonly onSuccess?: (result: string) => void;
  readonly onError?: (error: string) => void;
}

export interface UseGroqReturn {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly result: string | null;
  generate: (prompt: string, options?: GroqGenerationConfig) => Promise<string | null>;
  generateJSON: <T = Record<string, unknown>>(
    prompt: string,
    options?: GroqGenerationConfig & { schema?: Record<string, unknown> },
  ) => Promise<T | null>;
  stream: (
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: GroqGenerationConfig,
  ) => Promise<string | null>;
  cancel: () => void;
  reset: () => void;
  clearError: () => void;
}

export interface UseGroqDeps {
  readonly textGeneration?: TextGenerationService;
}

export function useGroq(
  options: UseGroqOptions = {},
  deps?: UseGroqDeps,
): UseGroqReturn {
  const textGeneration = deps?.textGeneration ?? getProvider()?.textGeneration;

  if (!textGeneration) {
    throw new Error(
      "useGroq requires a TextGenerationService dependency. " +
        "Provide it via the second argument or wire it through configureProvider().",
    );
  }

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const abortControllerRef = useRef<AbortController | null>(null);

  const getOrCreateAbortController = useCallback((): AbortController => {
    if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
      abortControllerRef.current = new AbortController();
    }
    return abortControllerRef.current;
  }, []);

  const stableConfig = useMemo(
    () => ({
      model: options.model,
      generationConfig: options.generationConfig,
    }),
    [
      options.model,
      options.generationConfig?.temperature,
      options.generationConfig?.maxTokens,
      options.generationConfig?.topP,
    ],
  );

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const runWithState = useCallback(
    async <T>(task: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
      const controller = getOrCreateAbortController();
      const { signal } = controller;
      if (signal.aborted) return null;

      setIsLoading(true);
      setError(null);
      setResult(null);
      const currentOptions = optionsRef.current;
      currentOptions.onStart?.();
      try {
        const value = await task(signal);
        return value;
      } catch (err) {
        if (signal.aborted) {
          return null;
        }
        const message = resolveUserFriendlyMessage(err);
        setError(message);
        currentOptions.onError?.(message);
        throw err;
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [getOrCreateAbortController],
  );

  const generate = useCallback(
    (prompt: string, config?: GroqGenerationConfig) =>
      runWithState(async () => {
        const response = await textGeneration.generateCompletion(prompt, {
          model: stableConfig.model,
          generationConfig: {
            ...stableConfig.generationConfig,
            ...config,
          },
        });
        setResult(response);
        optionsRef.current.onSuccess?.(response);
        return response;
      }),
    [runWithState, textGeneration, stableConfig],
  );

  const generateJSON = useCallback(
    <T = Record<string, unknown>>(
      prompt: string,
      config?: GroqGenerationConfig & { schema?: Record<string, unknown> },
    ) =>
      runWithState(async () => {
        const response = await textGeneration.generateStructured<T>(prompt, {
          model: stableConfig.model,
          generationConfig: {
            ...stableConfig.generationConfig,
            ...config,
          },
          ...(config?.schema !== undefined ? { schema: config.schema } : {}),
        });
        const json = JSON.stringify(response, null, 2);
        setResult(json);
        optionsRef.current.onSuccess?.(json);
        return response;
      }),
    [runWithState, textGeneration, stableConfig],
  );

  const stream = useCallback(
    (
      prompt: string,
      onChunk: (chunk: string) => void,
      config?: GroqGenerationConfig,
    ) =>
      runWithState(async () => {
        const callbacks: StreamingCallbacks = {
          onChunk,
          onComplete: (text) => {
            setResult(text);
            optionsRef.current.onSuccess?.(text);
          },
        };
        return textGeneration.streamCompletion(
          prompt,
          callbacks,
          {
            model: stableConfig.model,
            generationConfig: {
              ...stableConfig.generationConfig,
              ...config,
            },
          },
        );
      }),
    [runWithState, textGeneration, stableConfig],
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
    }
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setError(null);
    setResult(null);
  }, [cancel]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    result,
    generate,
    generateJSON,
    stream,
    cancel,
    reset,
    clearError,
  };
}
