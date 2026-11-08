
import { useCallback, useMemo } from 'react';
import type { ImageWizardStep, ImageWizardData } from '../wizard/image.wizard';
import { IMAGE_WIZARD_STEPS, buildImageRequest } from '../wizard/image.wizard';
import type { ImageGenerationRequest } from '../content/domain/config/ProviderConfig';
import { useWizardFlow, type UseWizardFlowReturn, type WizardStepDefinition } from './internal/useWizardFlow';

export interface UseImageWizardOptions {
  initialStep?: ImageWizardStep;
  onStepChange?: (from: ImageWizardStep, to: ImageWizardStep) => void;
  onComplete?: (data: ImageWizardData) => void;
}

export interface UseImageWizardReturn
  extends Omit<UseWizardFlowReturn<ImageWizardStep, ImageWizardData>, 'buildRequest'> {
  buildRequest: () => ImageGenerationRequest;
}

const toStepDefinitions = (
  steps: ReadonlyArray<typeof IMAGE_WIZARD_STEPS[number]>,
): ReadonlyArray<WizardStepDefinition<ImageWizardStep>> =>
  steps.map((s) => ({ id: s.id, label: s.label, icon: s.icon, description: s.description, optional: s.optional }));

export function useImageWizard(options: UseImageWizardOptions = {}): UseImageWizardReturn {
  const flow = useWizardFlow<ImageWizardStep, ImageWizardData>({
    initialStep: options.initialStep ?? 'input-prompt',
    steps: useMemo(() => toStepDefinitions(IMAGE_WIZARD_STEPS), []),
    onStepChange: options.onStepChange,
    onComplete: options.onComplete,
  });

  const buildRequest = useCallback(
    () => buildImageRequest(flow.wizardData),
    [flow.wizardData],
  );

  return { ...flow, buildRequest };
}
