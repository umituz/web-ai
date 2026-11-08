
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface WizardStepDefinition<T extends string> {
  id: T;
  label: string;
  icon?: string;
  description?: string;
  optional?: boolean;
}

export interface UseWizardFlowOptions<T extends string, D> {
  initialStep: T;
  steps: ReadonlyArray<WizardStepDefinition<T>>;
  onStepChange?: (from: T, to: T) => void;
  onComplete?: (data: D) => void;
}

export interface UseWizardFlowReturn<T extends string, D> {
  currentStep: T;
  steps: ReadonlyArray<WizardStepDefinition<T>>;
  wizardData: D;
  isProcessing: boolean;
  progress: number;

  next: () => void;
  back: () => void;
  skip: () => void;
  goTo: (step: T) => void;

  updateData: (updates: Partial<D>) => void;
  setData: (data: D) => void;
  setIsProcessing: (processing: boolean) => void;

  canGoNext: () => boolean;
  canGoBack: () => boolean;
  canSkip: () => boolean;
  isComplete: () => boolean;
  reset: () => void;
}

export function useWizardFlow<T extends string, D extends object>(
  options: UseWizardFlowOptions<T, D>,
): UseWizardFlowReturn<T, D> {
  const { initialStep, steps, onStepChange, onComplete } = options;

  const [currentStep, setCurrentStep] = useState<T>(initialStep);
  const [wizardData, setWizardData] = useState<D>({} as D);
  const [isProcessing, setIsProcessing] = useState(false);

  const optionsRef = useRef({ onStepChange, onComplete, initialStep });
  useEffect(() => {
    optionsRef.current = { onStepChange, onComplete, initialStep };
  }, [onStepChange, onComplete, initialStep]);

  const currentIndex = useMemo(
    () => steps.findIndex((s) => s.id === currentStep),
    [currentStep, steps],
  );

  const progress = useMemo(() => {
    if (steps.length <= 1) return 0;
    return Math.round((currentIndex / (steps.length - 1)) * 100);
  }, [currentIndex, steps.length]);

  const navigateTo = useCallback((to: T) => {
    setCurrentStep((prev) => {
      if (prev === to) return prev;
      optionsRef.current.onStepChange?.(prev, to);
      return to;
    });
  }, []);

  const next = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= steps.length - 1) return;
    const nextStep = steps[currentIndex + 1];
    if (nextStep) navigateTo(nextStep.id);
  }, [currentIndex, steps, navigateTo]);

  const back = useCallback(() => {
    if (currentIndex <= 0) return;
    const prevStep = steps[currentIndex - 1];
    if (prevStep) navigateTo(prevStep.id);
  }, [currentIndex, steps, navigateTo]);

  const skip = useCallback(() => {
    const step = steps[currentIndex];
    if (!step?.optional) return;
    next();
  }, [currentIndex, steps, next]);

  const goTo = useCallback(
    (step: T) => navigateTo(step),
    [navigateTo],
  );

  const updateData = useCallback((updates: Partial<D>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  }, []);

  const setData = useCallback((data: D) => setWizardData(data), []);

  const canGoNext = useCallback(
    () => currentIndex >= 0 && currentIndex < steps.length - 1,
    [currentIndex, steps.length],
  );
  const canGoBack = useCallback(() => currentIndex > 0, [currentIndex]);
  const canSkip = useCallback(
    () => Boolean(steps[currentIndex]?.optional),
    [currentIndex, steps],
  );
  const isComplete = useCallback(
    () => currentIndex === steps.length - 1,
    [currentIndex, steps.length],
  );

  const reset = useCallback(() => {
    setCurrentStep(optionsRef.current.initialStep);
    setWizardData({} as D);
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    if (currentIndex === steps.length - 1 && steps.length > 0) {
      optionsRef.current.onComplete?.(wizardData);
    }
  }, [currentIndex, steps.length, wizardData]);

  return {
    currentStep,
    steps,
    wizardData,
    isProcessing,
    progress,
    next,
    back,
    skip,
    goTo,
    updateData,
    setData,
    setIsProcessing,
    canGoNext,
    canGoBack,
    canSkip,
    isComplete,
    reset,
  };
}
