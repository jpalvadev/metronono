import '@testing-library/jest-dom';
import { beforeEach, afterEach } from 'vitest';
import { installFakeWebAudio } from './fakeWebAudio';
import { resetAudioContextForTesting } from '../audio/WebAudioContext';

let restoreWebAudio: (() => void) | null = null;
let originalFetch: typeof globalThis.fetch | undefined;

beforeEach(() => {
  resetAudioContextForTesting();
  restoreWebAudio = installFakeWebAudio().restore;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (/\/samples\/[^/]+\.wav$/i.test(url)) {
      const wavBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => wavBytes,
      } as Response;
    }
    if (originalFetch) {
      return originalFetch(input, init);
    }
    return { ok: false, status: 404 } as Response;
  }) as typeof fetch;
});

afterEach(() => {
  resetAudioContextForTesting();
  restoreWebAudio?.();
  restoreWebAudio = null;
  if (originalFetch !== undefined) {
    globalThis.fetch = originalFetch;
    originalFetch = undefined;
  }
});

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => ({
    measureText: (text: string) => ({
      width: (text || '').length * 8,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    fillText: () => {},
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
  })) as any;
}
