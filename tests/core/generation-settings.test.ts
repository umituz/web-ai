import { describe, expect, it } from 'vitest';
import {
  normalizeGenerationSettings,
  DEFAULT_GENERATION,
} from '../../src/core/settings/generation-settings';

describe('normalizeGenerationSettings', () => {
  it('applies defaults when settings are empty', () => {
    const settings = normalizeGenerationSettings(undefined);
    expect(settings).toEqual(DEFAULT_GENERATION);
  });

  it('clamps maxOutputTokens to model capacity if requested exceeds it', () => {
    const settings = normalizeGenerationSettings({ maxOutputTokens: 10000 }, 2048);
    expect(settings.maxOutputTokens).toBe(2048);
  });

  it('rejects invalid temperature bounds', () => {
    expect(() => normalizeGenerationSettings({ temperature: -0.1 })).toThrow('temperature must be between');
    expect(() => normalizeGenerationSettings({ temperature: 2.5 })).toThrow('temperature must be between');
  });

  it('rejects invalid topP bounds', () => {
    expect(() => normalizeGenerationSettings({ topP: -0.1 })).toThrow('topP must be between');
    expect(() => normalizeGenerationSettings({ topP: 1.5 })).toThrow('topP must be between');
  });

  it('rejects non-integer maxOutputTokens', () => {
    expect(() => normalizeGenerationSettings({ maxOutputTokens: 0 })).toThrow('positive integer');
    expect(() => normalizeGenerationSettings({ maxOutputTokens: 12.5 })).toThrow('positive integer');
  });
});
