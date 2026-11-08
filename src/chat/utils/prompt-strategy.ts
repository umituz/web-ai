
import type { ChatConfig } from "../entities";

export interface SystemPromptStrategy {
  resolve(config: ChatConfig): string | undefined;
}

export const DEFAULT_PROMPT_STRATEGY: SystemPromptStrategy = {
  resolve: (config) => {
    if (config.systemPrompt && config.systemPrompt.length > 0) {
      return config.systemPrompt;
    }
    return undefined;
  },
};
