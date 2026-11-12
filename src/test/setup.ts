import '@testing-library/jest-dom';
import { beforeEach, afterEach } from 'vitest';
import { installFakeWebAudio } from './fakeWebAudio';
import { resetAudioContextForTesting } from '../audio/WebAudioContext';

let restoreWebAudio: (() => void) | null = null;

beforeEach(() => {
  resetAudioContextForTesting();
  restoreWebAudio = installFakeWebAudio().restore;
});

afterEach(() => {
  resetAudioContextForTesting();
  restoreWebAudio?.();
  restoreWebAudio = null;
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
