import type { TextTier } from "../types";

/**
 * Per-provider default model per tier. Config can override any slot; an
 * explicit `model` on a request overrides everything. This table is the knob
 * that turns "switch from Claude to Groq" into a config edit.
 */
export type TierModelMap = Readonly<Partial<Record<TextTier, string>>>;

export const TEXT_TIERS: ReadonlyArray<TextTier> = ["fast", "balanced", "powerful"];

export function isTextTier(value: unknown): value is TextTier {
  return typeof value === "string" && (TEXT_TIERS as readonly string[]).includes(value);
}

export function resolveModel(
  tiers: TierModelMap,
  tier: TextTier,
  providerId: string,
): string {
  const model = tiers[tier] ?? tiers.balanced;
  if (!model) {
    throw new Error(
      `${providerId} has no model configured for tier "${tier}" — pass an explicit model or configure the tier map`,
    );
  }
  return model;
}

export function mergeTierOverrides(
  defaults: TierModelMap,
  overrides?: TierModelMap,
): TierModelMap {
  if (!overrides) return defaults;
  return { ...defaults, ...overrides };
}
