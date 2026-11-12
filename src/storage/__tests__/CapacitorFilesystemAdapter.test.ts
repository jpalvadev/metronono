import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CapacitorFilesystemAdapter,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../CapacitorFilesystemAdapter';
import { ReadingLine } from '../../domain/rhythm/types';
import { DawsonSystem } from '../../domain/dawson/types';

// In-memory mock filesystem storage: path -> string
const mockStorage = new Map<string, string>();

vi.mock('@capacitor/filesystem', () => ({
  Directory: {
    Documents: 'DOCUMENTS',
    Data: 'DATA',
    Cache: 'CACHE',
  },
  Encoding: {
    UTF8: 'utf8',
    ASCII: 'ascii',
  },
  Filesystem: {
    mkdir: vi.fn(async () => {
      // Mock mkdir success
      return {};
    }),
    readFile: vi.fn(async ({ path, directory }) => {
      const key = `${directory}:${path}`;
      if (!mockStorage.has(key)) {
        const err = new Error(`File does not exist: ${path}`);
        throw err;
      }
      return { data: mockStorage.get(key)! };
    }),
    writeFile: vi.fn(async ({ path, data, directory }) => {
      const key = `${directory}:${path}`;
      mockStorage.set(key, typeof data === 'string' ? data : '');
      return {};
    }),
    deleteFile: vi.fn(async ({ path, directory }) => {
      const key = `${directory}:${path}`;
      if (!mockStorage.has(key)) {
        const err = new Error(`File does not exist: ${path}`);
        throw err;
      }
      mockStorage.delete(key);
      return {};
    }),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}));

describe('Base64 <-> ArrayBuffer Utilities', () => {
  it('converts ArrayBuffer to Base64 and back accurately', () => {
    const originalBytes = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16]);
    const base64 = arrayBufferToBase64(originalBytes.buffer);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);

    const recoveredBuffer = base64ToArrayBuffer(base64);
    const recoveredBytes = new Uint8Array(recoveredBuffer);
    expect(recoveredBytes).toEqual(originalBytes);
  });
});

describe('CapacitorFilesystemAdapter', () => {
  let adapter: CapacitorFilesystemAdapter;

  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    adapter = new CapacitorFilesystemAdapter();
  });

  it('has correct id and name and reports linked status', async () => {
    expect(adapter.id).toBe('capacitor');
    expect(adapter.name).toContain('Capacitor');
    expect(adapter.isLinked()).toBe(true);
    expect(adapter.getLinkedDirectoryName()).toBe('Documents/Metronono');
    expect(adapter.isFileSystemAccessSupported()).toBe(true);
  });

  it('saves and loads scores to/from Metronono/scores.json in Documents', async () => {
    await adapter.init();

    // Initially loads empty array when file does not exist
    const initialScores = await adapter.loadScores();
    expect(initialScores).toEqual([]);

    const sampleScores: ReadingLine[] = [
      {
        id: 'score-1',
        title: 'Lesson 1',
        tier: 1,
        measures: [],
      },
    ];

    await adapter.saveScores(sampleScores);

    // Verify stored under DOCUMENTS:Metronono/scores.json
    expect(mockStorage.has('DOCUMENTS:Metronono/scores.json')).toBe(true);
    const rawContent = mockStorage.get('DOCUMENTS:Metronono/scores.json');
    expect(rawContent).toContain('Lesson 1');

    const loadedScores = await adapter.loadScores();
    expect(loadedScores).toEqual(sampleScores);
  });

  it('saves and loads systems to/from Metronono/systems.json in Documents', async () => {
    await adapter.init();

    const initialSystems = await adapter.loadSystems();
    expect(initialSystems).toEqual([]);

    const sampleSystems: DawsonSystem[] = [
      {
        id: 'sys-1',
        name: 'Bop Drumming',
        shortFormula: {
          id: 'sf-1',
          name: 'Snare eighth',
          trigger: 'short',
          strokes: [{ durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] }],
        },
        longFormula: {
          id: 'lf-1',
          name: 'Bass quarter',
          trigger: 'long',
          strokes: [{ durationRatio: 1, hits: [{ voice: 'kick', dynamic: 'accent' }] }],
        },
      },
    ];

    await adapter.saveSystems(sampleSystems);
    expect(mockStorage.has('DOCUMENTS:Metronono/systems.json')).toBe(true);

    const loadedSystems = await adapter.loadSystems();
    expect(loadedSystems).toEqual(sampleSystems);
  });

  it('saves, loads, lists, and deletes sample audio files', async () => {
    await adapter.init();

    expect(await adapter.listSamples()).toEqual([]);
    expect(await adapter.loadSample('kick')).toBeNull();

    const audioBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]); // Mock WAV header bytes
    await adapter.saveSample('kick', audioBytes.buffer, {
      filename: 'custom_kick.wav',
      mimeType: 'audio/wav',
    });

    const samplesList = await adapter.listSamples();
    expect(samplesList).toHaveLength(1);
    expect(samplesList[0].voice).toBe('kick');
    expect(samplesList[0].filename).toBe('custom_kick.wav');
    expect(samplesList[0].sizeBytes).toBe(audioBytes.byteLength);

    const loaded = await adapter.loadSample('kick');
    expect(loaded).not.toBeNull();
    expect(loaded!.metadata.voice).toBe('kick');
    expect(new Uint8Array(loaded!.data)).toEqual(audioBytes);

    // Deleting sample removes it from storage and manifest
    await adapter.deleteSample('kick');
    expect(await adapter.loadSample('kick')).toBeNull();
    expect(await adapter.listSamples()).toHaveLength(0);
  });

  it('handles archive export and import', async () => {
    await adapter.init();

    const sampleScores: ReadingLine[] = [
      {
        id: 'archive-score',
        title: 'Archive Test',
        tier: 1,
        measures: [],
      },
    ];
    await adapter.saveScores(sampleScores);

    const archiveBlob = await adapter.exportArchive();
    expect(archiveBlob).toBeInstanceOf(Blob);

    // Create a new adapter instance and import
    mockStorage.clear();
    const newAdapter = new CapacitorFilesystemAdapter();
    await newAdapter.init();

    const importResult = await newAdapter.importArchive(archiveBlob);
    expect(importResult.success).toBe(true);
    expect(importResult.scoresLoaded).toBe(1);

    const restoredScores = await newAdapter.loadScores();
    expect(restoredScores).toHaveLength(1);
    expect(restoredScores[0].title).toBe('Archive Test');
  });

  it('StorageManager automatically detects native mobile and uses CapacitorFilesystemAdapter', async () => {
    const { StorageManager } = await import('../StorageManager');
    const manager = new StorageManager();
    expect(manager.getAdapterType()).toBe('capacitor');
    expect(manager.getActiveAdapter().id).toBe('capacitor');
  });
});
