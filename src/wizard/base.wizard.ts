export interface WizardStep<T extends string = string> {
  id: T;
  label: string;
  icon?: string;
  description?: string;
  optional?: boolean;
  validate?: (data: Record<string, unknown>) => boolean | { valid: boolean; errors: Record<string, string> };
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export type WizardData = Record<string, unknown>;

export interface WizardConfig<T extends string = string> {
  steps: WizardStep<T>[];
  initialStep?: T;
  data?: WizardData;
  onStepChange?: (from: T, to: T) => void;
  onComplete?: (data: WizardData) => void;
}
