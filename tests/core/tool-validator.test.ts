import { describe, expect, it } from 'vitest';
import {
  validateToolArgs,
  type ToolSchema,
} from '../../src/core/tools/tool-validator';

describe('tool-validator', () => {
  const schemas: Record<string, ToolSchema> = {
    save_memory: (args) => {
      if (typeof args.content !== 'string' || args.content.length === 0) {
        return { ok: false, error: 'content is required' };
      }
      return { ok: true };
    },
    zod_like: {
      safeParse: (args: unknown) => {
        const obj = args as { query?: string };
        if (typeof obj?.query === 'string' && obj.query.length > 0) {
          return { success: true, data: obj };
        }
        return {
          success: false,
          error: { issues: [{ path: ['query'], message: 'Must be non-empty' }] },
        };
      },
    },
  };

  it('validates with function schemas', () => {
    expect(validateToolArgs('save_memory', { content: 'test' }, schemas)).toEqual({ ok: true });
    expect(validateToolArgs('save_memory', {}, schemas)).toEqual({
      ok: false,
      error: 'content is required',
    });
  });

  it('validates with zod-like schema objects', () => {
    expect(validateToolArgs('zod_like', { query: 'neon' }, schemas)).toEqual({ ok: true });
    expect(validateToolArgs('zod_like', {}, schemas)).toEqual({
      ok: false,
      error: 'Invalid arguments: query: Must be non-empty',
    });
  });

  it('returns unknown tool error when tool is not registered', () => {
    expect(validateToolArgs('non_existent', {}, schemas)).toEqual({
      ok: false,
      error: 'Unknown tool: non_existent',
    });
  });
});
