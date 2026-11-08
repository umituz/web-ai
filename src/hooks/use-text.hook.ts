
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TextRequest, TextTier, GenerationResult } from "../core/types";
import { resolveUserFriendlyMessage } from "../core/errors";
import type { ITextProvider } from "../providers/base/provider.types";
import { ProviderFactory } from "../providers/factory/provider.factory";

/** Sampling/sizing knobs the hook forwards on every call. */
export interface UseTextConfig {
  readonly model?: string;
  readonly tier?: TextTier;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly topP?: number;
}

export interface UseTextOptions {
  readonly model?: string;
  readonly tier?: TextTier;
  readonly config?: UseTextConfig;
  readonly onStart?: () => void;
  readonly onSuccess?: (result: string) => void;
  readonly onError?: (error: string) => void;
}

export interface UseTextReturn {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly result: string | null;
  generate: (prompt: string, config?: UseTextConfig) => Promise<string | null>;
  generateJSON: <T = Record<string, unknown>>(
    prompt: string,
    config?: UseTextConfig & { schema?: Record<string, unknown> },
  ) => Promise<T | null>;
  stream: (
    prompt: string,
    onChunk: (chunk: string) => void,
    config?: UseTextConfig,
  ) => Promise<string | null>;
  cancel: () => void;
  reset: () => void;
  clearError: () => void;
}

export interface UseTextDeps {
  /** A single provider or a whole factory (tier defaults + fallback). */
  readonly engine: ITextProvider | ProviderFactory;
}

/**
 * Single-prompt text hook over the neutral surface — successor of useGroq,
 * provider-agnostic: pass any ITextProvider or a createAI() factory.
 */
export function useText(
  options: UseTextOptions = {},
  deps: UseTextDeps,
): UseTextReturn {
  const engine = deps?.engine;

  if (!engine) {
    throw new Error(
      "useText requires an engine dependency (ITextProvider or ProviderFactory). " +
        "Provide it via the second argument or wire it through the app container.",
    );
  }

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const abortControllerRef = useRef<AbortController | null>(null);

  const stableConfig = useMemo(
    () => ({
      model: options.model,
      tier: options.tier,
      ...options.config,
    }),
    [
      options.model,
      options.tier,
      options.config?.model,
      options.config?.tier,
      options.config?.maxTokens,
      options.config?.temperature,
      options.config?.topP,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return () => {
      controller.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const runWithState = useCallback(
    async <T>(task: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
      const controller = abortControllerRef.current;
      if (!controller) {
        return null;
      }
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
    [],
  );

  const buildRequest = (
    prompt: string,
    config: UseTextConfig | undefined,
    signal: AbortSignal | undefined,
  ): TextRequest => ({
    messages: [{ role: "user", content: prompt }],
    model: config?.model ?? stableConfig.model,
    tier: config?.tier ?? stableConfig.tier,
    maxTokens: config?.maxTokens ?? stableConfig.maxTokens,
    temperature: config?.temperature ?? stableConfig.temperature,
    topP: config?.topP ?? stableConfig.topP,
    ...(signal !== undefined ? { signal } : {}),
  });

  const run = useCallback(
    (request: TextRequest): Promise<GenerationResult> =>
      engine instanceof ProviderFactory
        ? engine.chat(request)
        : engine.generate(request),
    [engine],
  );

  const runStream = useCallback(
    (
      request: TextRequest,
      onChunk: (chunk: string) => void,
    ): Promise<GenerationResult> =>
      engine instanceof ProviderFactory
        ? engine.chatStream(request, { onChunk })
        : engine.stream(request, { onChunk }),
    [engine],
  );

  const generate = useCallback(
    (prompt: string, config?: UseTextConfig) =>
      runWithState(async (signal) => {
        const response = await run(buildRequest(prompt, config, signal));
        setResult(response.text);
        optionsRef.current.onSuccess?.(response.text);
        return response.text;
      }),
    [runWithState, run, stableConfig],
  );

  const generateJSON = useCallback(
    <T = Record<string, unknown>,>(
      prompt: string,
      config?: UseTextConfig & { schema?: Record<string, unknown> },
    ) =>
      runWithState(async (signal) => {
        const request = buildRequest(prompt, config, signal);
        const schema = config?.schema;
        let value: T;
        if (schema) {
          value =
            engine instanceof ProviderFactory
              ? (await engine.generateJson<T>({ ...request, schema })).value
              : (await engine.generateStructured<T>({ ...request, schema })).value;
        } else {
          const text =
            engine instanceof ProviderFactory
              ? await engine.generateText(prompt, {
                  model: request.model,
                  maxTokens: request.maxTokens,
                  temperature: request.temperature,
                  topP: request.topP,
                })
              : (await engine.generate(request)).text;
          value = JSON.parse(text) as T;
        }
        const json = JSON.stringify(value, null, 2);
        setResult(json);
        optionsRef.current.onSuccess?.(json);
        return value;
      }),
    [runWithState, engine, stableConfig],
  );

  const stream = useCallback(
    (prompt: string, onChunk: (chunk: string) => void, config?: UseTextConfig) =>
      runWithState(async (signal) => {
        const outcome = await runStream(buildRequest(prompt, config, signal), onChunk);
        setResult(outcome.text);
        optionsRef.current.onSuccess?.(outcome.text);
        return outcome.text;
      }),
    [runWithState, runStream, stableConfig],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
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
