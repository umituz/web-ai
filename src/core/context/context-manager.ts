export type ContextRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ContextMessage {
  readonly role: ContextRole;
  readonly content: string;
  readonly toolCalls?: ReadonlyArray<{ id: string; name: string; arguments: string }>;
  readonly toolCallId?: string;
}

export interface ContextBudget {
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
}

const CHARS_PER_TOKEN = 4;
const SAFETY_MARGIN_TOKENS = 256;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(message: ContextMessage): number {
  const toolStructure =
    message.toolCalls && message.toolCalls.length > 0
      ? estimateTokens(JSON.stringify(message.toolCalls))
      : 0;
  return estimateTokens(message.content) + toolStructure + 8;
}

export function buildContext<T extends ContextMessage = ContextMessage>(
  history: ReadonlyArray<T>,
  systemPrompt: string,
  budget: ContextBudget,
): T[] {
  const available = budget.contextWindow - budget.maxOutputTokens - SAFETY_MARGIN_TOKENS;
  let used = estimateTokens(systemPrompt);

  const selected: T[] = [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const message = history[i];
    if (!message) continue;
    const cost = estimateMessageTokens(message);
    if (used + cost > available && selected.length > 0) break;
    used += cost;
    selected.push(message);
  }

  selected.reverse();
  while (selected.length > 1 && (selected[0]?.role === 'assistant' || selected[0]?.role === 'tool')) {
    selected.shift();
  }

  return [{ role: 'system', content: systemPrompt } as unknown as T, ...selected];
}
