
import { useCallback, useRef, useState } from 'react';
import type {
  GenerationStatus,
  GenerationResult,
  GenerationProgress,
  ImageGenerationInput,
  VideoGenerationInput,
  GenerationType,
  ImageQuality,
  VideoQuality,
} from '../content/domain/types/GenerationTypes';
import { runGeneration } from './internal/generationPipeline';

export type UploadFunction = (file: File, userId: string) => Promise<string>;
export type SaveFunction = (result: Omit<GenerationResult, 'id' | 'createdAt'>) => Promise<void>;
export type CreditCheckFunction = (cost: number) => boolean;

export interface UseAIGenerationOptions {
  userId?: string;
  apiKey: string;
  uploadPhoto?: UploadFunction;
  saveResult?: SaveFunction;
  checkCredits?: CreditCheckFunction;
  onSuccess?: (result: GenerationResult) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: GenerationProgress) => void;
}

export interface UseAIGenerationReturn {
  status: GenerationStatus;
  result: GenerationResult | null;
  error: Error | null;
  progress: GenerationProgress | null;

  generateImage: (input: ImageGenerationInput) => Promise<GenerationResult | null>;
  generateVideo: (input: VideoGenerationInput) => Promise<GenerationResult | null>;
  generateFromFiles: (
    files: File[],
    type: GenerationType,
    prompt: string,
    quality?: ImageQuality | VideoQuality,
  ) => Promise<GenerationResult | null>;

  saveResult?: SaveFunction;

  cancel: () => void;
  reset: () => void;
}

export function useAIGeneration(options: UseAIGenerationOptions): UseAIGenerationReturn {
  const {
    userId,
    apiKey,
    uploadPhoto,
    saveResult,
    checkCredits,
    onSuccess,
    onError,
    onProgress,
  } = options;

  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setResult(null);
    setError(null);
    setProgress(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus('cancelled');
  }, []);

  const runWithController = useCallback(
    (input: ImageGenerationInput | VideoGenerationInput) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      return runGeneration(
        input,
        { setStatus, setProgress, setResult, setError },
        { apiKey, signal: controller.signal, onProgress },
        { uploadPhoto, userId, checkCredits, saveResult, onSuccess, onError },
      );
    },
    [apiKey, uploadPhoto, userId, checkCredits, saveResult, onSuccess, onError, onProgress],
  );

  const generateImage = useCallback(
    (input: ImageGenerationInput) => runWithController(input) as Promise<GenerationResult | null>,
    [runWithController],
  );

  const generateVideo = useCallback(
    (input: VideoGenerationInput) => runWithController(input) as Promise<GenerationResult | null>,
    [runWithController],
  );

  const uploadFiles = useCallback(
    async (files: File[]): Promise<string[]> => {
      if (!uploadPhoto || !userId) {
        throw new Error('uploadPhoto and userId are required for file uploads');
      }
      setStatus('uploading');
      setProgress({ stage: 'uploading', progress: 0, message: 'Uploading files...' });

      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadPhoto(files[i], userId);
        urls.push(url);
        setProgress({
          stage: 'uploading',
          progress: ((i + 1) / files.length) * 100,
          message: `Uploaded ${i + 1}/${files.length} files`,
        });
      }
      return urls;
    },
    [uploadPhoto, userId],
  );

  const generateFromFiles = useCallback(
    async (
      files: File[],
      type: GenerationType,
      prompt: string,
      quality?: ImageQuality | VideoQuality,
    ): Promise<GenerationResult | null> => {
      try {
        const urls = await uploadFiles(files);
        const imageUrl = urls[0];

        if (type === 'image-to-image') {
          return await generateImage({ type: 'image-to-image', prompt, image: imageUrl, quality: quality as ImageQuality });
        }
        if (type === 'image-to-video') {
          return await generateVideo({ type: 'image-to-video', prompt, image: imageUrl, quality: quality as VideoQuality });
        }
        if (type === 'text-to-image') {
          return await generateImage({ type: 'text-to-image', prompt, quality: quality as ImageQuality });
        }
        return await generateVideo({ type: 'text-to-video', prompt, quality: quality as VideoQuality });
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStatus('failed');
        onError?.(e);
        return null;
      }
    },
    [uploadFiles, generateImage, generateVideo, onError],
  );

  return {
    status,
    result,
    error,
    progress,
    generateImage,
    generateVideo,
    generateFromFiles,
    saveResult,
    cancel,
    reset,
  };
}
