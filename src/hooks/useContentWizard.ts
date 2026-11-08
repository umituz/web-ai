
import { useCallback, useMemo } from 'react';
import type { ContentWizardStep, ContentWizardData } from '../wizard/content.wizard';
import { CONTENT_WIZARD_STEPS, buildContentRequest } from '../wizard/content.wizard';
import type { BlogGenerationRequest, SocialContentRequest, VideoScriptRequest } from '../content/domain/entities/ContentGeneration';
import { useWizardFlow, type UseWizardFlowReturn, type WizardStepDefinition } from './internal/useWizardFlow';

export interface UseContentWizardOptions {
  initialStep?: ContentWizardStep;
  onStepChange?: (from: ContentWizardStep, to: ContentWizardStep) => void;
  onComplete?: (data: ContentWizardData) => void;
}

export type ContentWizardRequest = BlogGenerationRequest | SocialContentRequest | VideoScriptRequest;

export interface UseContentWizardReturn
  extends Omit<UseWizardFlowReturn<ContentWizardStep, ContentWizardData>, 'buildRequest'> {
  buildRequest: () => ContentWizardRequest;
}

const toStepDefinitions = (
  steps: ReadonlyArray<typeof CONTENT_WIZARD_STEPS[number]>,
): ReadonlyArray<WizardStepDefinition<ContentWizardStep>> =>
  steps.map((s) => ({ id: s.id, label: s.label, icon: s.icon, description: s.description, optional: s.optional }));

export function useContentWizard(options: UseContentWizardOptions = {}): UseContentWizardReturn {
  const flow = useWizardFlow<ContentWizardStep, ContentWizardData>({
    initialStep: options.initialStep ?? 'select-type',
    steps: useMemo(() => toStepDefinitions(CONTENT_WIZARD_STEPS), []),
    onStepChange: options.onStepChange,
    onComplete: options.onComplete,
  });

  const buildRequest = useCallback(
    () => buildContentRequest(flow.wizardData),
    [flow.wizardData],
  );

  return { ...flow, buildRequest };
}
