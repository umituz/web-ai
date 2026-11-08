
interface BufferLike {
  from: (data: string, encoding: string) => {
    buffer: ArrayBuffer;
    byteOffset: number;
    byteLength: number;
  };
}

interface GlobalWithBuffer {
  Buffer?: BufferLike;
}

const globalScope = globalThis as unknown as GlobalWithBuffer;
const hasBuffer = typeof globalScope.Buffer?.from === 'function';

export function base64ToBytes(raw: string): Uint8Array {
  if (hasBuffer) {
    const bufferFactory = globalScope.Buffer;
    if (!bufferFactory) {
      throw new Error('Buffer unavailable despite detection flag');
    }
    const buf = bufferFactory.from(raw, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  const decoded = atob(raw);
  return Uint8Array.from(decoded, char => char.charCodeAt(0));
}
