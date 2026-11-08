export interface WireToolCallDelta {
  readonly index?: number;
  readonly id?: string;
  readonly function?: { readonly name?: string; readonly arguments?: string };
}

export interface AssistantToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export class ToolCallAccumulator {
  private readonly slots = new Map<number, { id: string; name: string; args: string }>();

  push(delta: WireToolCallDelta): void {
    const index = delta.index ?? 0;
    const slot = this.slots.get(index) ?? { id: '', name: '', args: '' };
    if (delta.id) slot.id = delta.id;
    if (delta.function?.name) slot.name = delta.function.name;
    if (delta.function?.arguments) slot.args += delta.function.arguments;
    this.slots.set(index, slot);
  }

  finish(): AssistantToolCall[] {
    return Array.from(this.slots.entries())
      .sort(([a], [b]) => a - b)
      .map(([, slot]) => ({
        id: slot.id,
        name: slot.name,
        arguments: slot.args,
      }))
      .filter((call) => call.id.length > 0 || call.name.length > 0);
  }
}
