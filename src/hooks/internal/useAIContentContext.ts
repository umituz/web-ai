
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AIContentService } from '../../content/application/services/AIContentService';
import { AIError, type AIErrorCode } from '../../content/domain/errors/AIErrors';
import type { ProviderConfig } from '../../content/domain/config/ProviderConfig';
import type { AIProviderConfig } from '../../providers/factory/create-ai';
import type { ITextGenerator } from '../../content/domain/interfaces/ITextGenerator';

export interface AsyncContext {
  isLoading: boolean;
  progress: number;
  error: string | null;
  errorCode: AIErrorCode | null;
  setError: (msg: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setProgress: (progress: number) => void;
  reportProgress: (value: number) => void;
  reportError: (error: unknown, fallbackMessage: string) => AIError;
  execute: <T>(
    operation: () => Promise<T>,
    fallbackMessage: string,
    options?: { reportProgress?: boolean },
  ) => Promise<T | null>;
}

export interface AIOptionCallbacks {
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

/** Provider config for the underlying AIContentService — new AIProviderConfig,
 *  legacy ProviderConfig, or a custom ITextGenerator. */
export type ContentServiceConfig = AIProviderConfig | ProviderConfig | ITextGenerator;

export interface UseAIContentContextOptions {
  config?: ContentServiceConfig;
  callbacks?: AIOptionCallbacks;
}

export interface UseAIContentContextReturn {
  service: AIContentService;
  ctx: AsyncContext;
}

export function useAIContentContext(options: UseAIContentContextOptions): UseAIContentContextReturn {
  const { config, callbacks } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AIErrorCode | null>(null);

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const activeRunsRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    const mounted = mountedRef;
    return () => {
      mounted.current = false;
    };
  }, []);

  const service = useMemo(() => {
    if (config) {
      return new AIContentService(config);
    }
    throw new Error('A provider config (or custom ITextGenerator) must be provided to useAIContent');
  }, [config]);

  const reportProgress = useCallback((value: number) => {
    if (mountedRef.current) setProgress(value);
    callbacksRef.current?.onProgress?.(value);
  }, []);

  const reportError = useCallback((err: unknown, fallbackMessage: string): AIError => {
    const aiError = AIError.from(err, 'UNKNOWN');
    const finalError = aiError.message ? aiError : new AIError(fallbackMessage, 'UNKNOWN', err);
    if (mountedRef.current) {
      setError(finalError.message);
      setErrorCode(finalError.code);
    }
    callbacksRef.current?.onError?.(finalError);
    return finalError;
  }, []);

  const execute = useCallback(
    async <T>(
      operation: () => Promise<T>,
      fallbackMessage: string,
      execOptions?: { reportProgress?: boolean },
    ): Promise<T | null> => {
      activeRunsRef.current += 1;
      if (mountedRef.current) {
        setIsLoading(true);
        setError(null);
        setErrorCode(null);
      }
      if (execOptions?.reportProgress) {
        reportProgress(0);
      }
      try {
        const result = await operation();
        if (execOptions?.reportProgress) {
          reportProgress(100);
        }
        return result;
      } catch (err) {
        const aiError = AIError.from(err, 'UNKNOWN');
        if (aiError.message) {
          reportError(aiError, fallbackMessage);
        } else {
          reportError(new Error(fallbackMessage), fallbackMessage);
        }
        return null;
      } finally {
        activeRunsRef.current -= 1;
        if (activeRunsRef.current === 0 && mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [reportError, reportProgress],
  );

  const ctx: AsyncContext = useMemo(() => ({
    isLoading,
    progress,
    error,
    errorCode,
    setError: (msg: string | null) => {
      setError(msg);
      setErrorCode(msg ? 'UNKNOWN' : null);
    },
    setIsLoading,
    setProgress,
    reportProgress,
    reportError,
    execute,
  }), [isLoading, progress, error, errorCode, reportProgress, reportError, execute]);

  return { service, ctx };
}
