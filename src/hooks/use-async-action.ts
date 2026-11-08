
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CancellationError, isCancellationError } from '../providers/pruna/client/core/errors/cancellation-error';

export interface AsyncActionState<TResult> {
  result: TResult | null;
  isLoading: boolean;
  error: Error | null;
}

export interface AsyncActionApi<TResult, TInput> extends AsyncActionState<TResult> {
  run: (input: TInput) => Promise<TResult | null>;
  cancel: () => void;
  reset: () => void;
}

export interface UseAsyncActionOptions<TResult> {
  onSuccess?: (result: TResult) => void;
  onError?: (error: Error) => void;
  onCancelled?: () => void;
}

export type AsyncActionExecutor<TResult, TInput> = (
  input: TInput,
  signal: AbortSignal,
) => Promise<TResult>;

function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  if (err instanceof DOMException && err.code === DOMException.ABORT_ERR) return true;
  return isCancellationError(err);
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function useAsyncAction<TResult, TInput>(
  executor: AsyncActionExecutor<TResult, TInput>,
  options: UseAsyncActionOptions<TResult> = {},
): AsyncActionApi<TResult, TInput> {
  const [result, setResult] = useState<TResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const executorRef = useRef(executor);
  const optionsRef = useRef(options);
  const mountedRef = useRef(true);

  useEffect(() => {
    executorRef.current = executor;
    optionsRef.current = options;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const run = useCallback(
    async (input: TInput): Promise<TResult | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const value = await executorRef.current(input, controller.signal);
        if (!mountedRef.current) return null;
        setResult(value);
        optionsRef.current.onSuccess?.(value);
        return value;
      } catch (err) {
        if (isAbortError(err)) {
          if (mountedRef.current) {
            optionsRef.current.onCancelled?.();
          }
          return null;
        }
        if (!mountedRef.current) return null;
        const normalized = toError(err);
        setError(normalized);
        optionsRef.current.onError?.(normalized);
        return null;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const cancel = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return useMemo<AsyncActionApi<TResult, TInput>>(
    () => ({ result, isLoading, error, run, cancel, reset }),
    [result, isLoading, error, run, cancel, reset],
  );
}

export { CancellationError };
