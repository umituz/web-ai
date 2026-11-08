import { describe, expect, it } from 'vitest';
import { ToolCallAccumulator } from '../../src/core/sse/tool-call-accumulator';

describe('ToolCallAccumulator', () => {
  it('stitches together chunks from multiple indices', () => {
    const acc = new ToolCallAccumulator();
    acc.push({ index: 0, id: 'call_1', function: { name: 'weather', arguments: '{"cit' } });
    acc.push({ index: 1, id: 'call_2', function: { name: 'stock', arguments: '{"sym' } });
    acc.push({ index: 0, function: { arguments: 'y":"Istanbul"}' } });
    acc.push({ index: 1, function: { arguments: 'bol":"AAPL"}' } });

    const calls = acc.finish();
    expect(calls).toEqual([
      { id: 'call_1', name: 'weather', arguments: '{"city":"Istanbul"}' },
      { id: 'call_2', name: 'stock', arguments: '{"symbol":"AAPL"}' },
    ]);
  });

  it('handles empty push and returns empty array when empty', () => {
    const acc = new ToolCallAccumulator();
    expect(acc.finish()).toEqual([]);
  });
});
