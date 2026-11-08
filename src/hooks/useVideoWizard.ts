
import { useCallback, useMemo } from 'react';
import type { VideoWizardStep, VideoWizardData } from '../wizard/video.wizard';
import { VIDEO_WIZARD_STEPS, buildVideoRequest } from '../wizard/video.wizard';
import type { VideoGenerationRequest, ImageToVideoRequest, VideoToVideoRequest } from '../content/domain/config/ProviderConfig';
import { useWizardFlow, type UseWizardFlowReturn, type WizardStepDefinition } from './internal/useWizardFlow';

export interface UseVideoWizardOptions {
  initialStep?: VideoWizardStep;
  onStepChange?: (from: VideoWizardStep, to: VideoWizardStep) => void;
  onComplete?: (data: VideoWizardData) => void;
}

export type VideoWizardRequest = VideoGenerationRequest | ImageToVideoRequest | VideoToVideoRequest;

export interface UseVideoWizardReturn
  extends Omit<UseWizardFlowReturn<VideoWizardStep, VideoWizardData>, 'buildRequest'> {
  buildRequest: () => VideoWizardRequest;
}

const toStepDefinitions = (
  steps: ReadonlyArray<typeof VIDEO_WIZARD_STEPS[number]>,
): ReadonlyArray<WizardStepDefinition<VideoWizardStep>> =>
  steps.map((s) => ({ id: s.id, label: s.label, icon: s.icon, description: s.description, optional: s.optional }));

export function useVideoWizard(options: UseVideoWizardOptions = {}): UseVideoWizardReturn {
  const flow = useWizardFlow<VideoWizardStep, VideoWizardData>({
    initialStep: options.initialStep ?? 'select-type',
    steps: useMemo(() => toStepDefinitions(VIDEO_WIZARD_STEPS), []),
    onStepChange: options.onStepChange,
    onComplete: options.onComplete,
  });

  const buildRequest = useCallback(
    () => buildVideoRequest(flow.wizardData),
    [flow.wizardData],
  );

  return { ...flow, buildRequest };
}
