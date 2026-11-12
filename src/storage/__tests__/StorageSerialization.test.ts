import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { ArchiveService } from '../ArchiveService';
import { InMemoryStorageAdapter } from '../InMemoryStorageAdapter';
import { IndexedDBAdapter } from '../IndexedDBAdapter';
import { FileSystemAccessAdapter } from '../FileSystemAccessAdapter';
import { StorageManager } from '../StorageManager';
import { ReadingLine, createRhythmicEvent } from '../../domain/rhythm/types';
import { DawsonSystem } from '../../domain/dawson/types';
import { StoredSample } from '../types';
import { DrumKitPlayer } from '../../audio/DrumKitPlayer';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { AudioMixer } from '../../audio/AudioMixer';
import { fakeAudioBuffer, fakeToneRecorder } from '../../test/fakeTone';

vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

// Helper to create dummy audio data
function createDummyAudioBuffer(size: number = 64, fillByte: number = 42): ArrayBuffer {
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  view.fill(fillByte);
  return buffer;
}

// How many times any instrument carrying this label was played.
function triggerCountFor(label: string): number {
  return fakeToneRecorder.nodes
    .filter((created) => created.label === label)
    .reduce((total, node) => total + fakeToneRecorder.triggers(node).length, 0);
}

function nodeByLabel(label: string) {
  const node = fakeToneRecorder.nodes.find((created) => created.label === label);
  if (!node) throw new Error(`no node labelled '${label}' in the recorded graph`);
  return node;
}

// Sample test data
const dummyScores: ReadingLine[] = [
  {
    id: 'score-1',
    title: 'Syncopation Exercise 1',
    tier: 1,
    measures: [
      {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4.0,
        events: [
          createRhythmicEvent({ durationBeats: 1.0, isRest: false }),
          createRhythmicEvent({ durationBeats: 1.0, isRest: false }),
          createRhythmicEvent({ durationBeats: 2.0, isRest: false }),
        ],
      },
    ],
  },
];

const dummySystems: DawsonSystem[] = [
  {
    id: 'dawson-custom-1',
    name: 'Custom Bop Variation',
    shortFormula: {
      id: 'f-short',
      name: 'Snare Accent',
      trigger: 'short',
      strokes: [{ durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'accent' }] }],
    },
    longFormula: {
      id: 'f-long',
      name: 'Kick Punch',
      trigger: 'long',
      strokes: [{ durationRatio: 1.0, hits: [{ voice: 'kick', dynamic: 'accent' }] }],
    },
  },
];

describe('ArchiveService (.metronono zip format)', () => {
  it('exports scores, systems, and samples into a valid .metronono archive and imports them back losslessly', async () => {
    const kickData = createDummyAudioBuffer(128, 99);
    const snareData = createDummyAudioBuffer(256, 77);

    const samples: StoredSample[] = [
      {
        metadata: {
          voice: 'kick',
          filename: 'custom_kick.wav',
          mimeType: 'audio/wav',
          sizeBytes: 128,
          updatedAt: 1700000000000,
        },
        data: kickData,
      },
      {
        metadata: {
          voice: 'snare',
          filename: 'vintage_snare.mp3',
          mimeType: 'audio/mpeg',
          sizeBytes: 256,
          updatedAt: 1700000001000,
        },
        data: snareData,
      },
    ];

    const zipBlob = await ArchiveService.exportArchive(dummyScores, dummySystems, samples);
    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.size).toBeGreaterThan(0);

    // Import back from the zip Blob
    const imported = await ArchiveService.importArchive(zipBlob);

    expect(imported.manifest.appName).toBe('metronono');
    expect(imported.manifest.counts.scores).toBe(1);
    expect(imported.manifest.counts.systems).toBe(1);
    expect(imported.manifest.counts.samples).toBe(2);

    // Verify scores match
    expect(imported.scores).toHaveLength(1);
    expect(imported.scores[0].id).toBe('score-1');
    expect(imported.scores[0].title).toBe('Syncopation Exercise 1');

    // Verify systems match
    expect(imported.systems).toHaveLength(1);
    expect(imported.systems[0].name).toBe('Custom Bop Variation');

    // Verify samples and binary data match exactly
    expect(imported.samples).toHaveLength(2);
    const importedKick = imported.samples.find((s) => s.metadata.voice === 'kick');
    expect(importedKick).toBeDefined();
    expect(importedKick?.metadata.filename).toBe('custom_kick.wav');
    expect(new Uint8Array(importedKick!.data)).toEqual(new Uint8Array(kickData));

    const importedSnare = imported.samples.find((s) => s.metadata.voice === 'snare');
    expect(importedSnare).toBeDefined();
    expect(importedSnare?.metadata.filename).toBe('vintage_snare.mp3');
    expect(new Uint8Array(importedSnare!.data)).toEqual(new Uint8Array(snareData));
  });

  it('handles invalid or corrupted archives gracefully', async () => {
    const invalidBuffer = new ArrayBuffer(20);
    const result = await ArchiveService.importArchive(invalidBuffer);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('InMemoryStorageAdapter (Seam 3)', () => {
  let adapter: InMemoryStorageAdapter;

  beforeEach(async () => {
    adapter = new InMemoryStorageAdapter();
    await adapter.init();
  });

  it('performs CRUD operations for scores, systems, and samples', async () => {
    await adapter.saveScores(dummyScores);
    const loadedScores = await adapter.loadScores();
    expect(loadedScores).toEqual(dummyScores);

    await adapter.saveSystems(dummySystems);
    const loadedSystems = await adapter.loadSystems();
    expect(loadedSystems).toEqual(dummySystems);

    const kickAudio = createDummyAudioBuffer(32, 1);
    await adapter.saveSample('kick', kickAudio, { filename: 'kick.wav', mimeType: 'audio/wav' });

    const sampleList = await adapter.listSamples();
    expect(sampleList).toHaveLength(1);
    expect(sampleList[0].voice).toBe('kick');

    const loadedSample = await adapter.loadSample('kick');
    expect(loadedSample).not.toBeNull();
    expect(loadedSample!.metadata.filename).toBe('kick.wav');
    expect(new Uint8Array(loadedSample!.data)).toEqual(new Uint8Array(kickAudio));

    // Delete sample
    await adapter.deleteSample('kick');
    const afterDelete = await adapter.loadSample('kick');
    expect(afterDelete).toBeNull();
    expect(await adapter.listSamples()).toHaveLength(0);
  });

  it('supports archive export and import', async () => {
    await adapter.saveScores(dummyScores);
    await adapter.saveSystems(dummySystems);
    const bellAudio = createDummyAudioBuffer(16, 88);
    await adapter.saveSample('ride_bell', bellAudio, { filename: 'bell.wav' });

    const archive = await adapter.exportArchive();
    expect(archive.size).toBeGreaterThan(0);

    // Create a new adapter and import
    const newAdapter = new InMemoryStorageAdapter();
    await newAdapter.init();
    const importResult = await newAdapter.importArchive(archive);
    expect(importResult.success).toBe(true);
    expect(importResult.scoresLoaded).toBe(1);
    expect(importResult.systemsLoaded).toBe(1);
    expect(importResult.samplesLoaded).toBe(1);

    const loadedBell = await newAdapter.loadSample('ride_bell');
    expect(loadedBell).not.toBeNull();
    expect(new Uint8Array(loadedBell!.data)).toEqual(new Uint8Array(bellAudio));
  });
});

describe('IndexedDBAdapter', () => {
  let adapter: IndexedDBAdapter;

  beforeEach(async () => {
    adapter = new IndexedDBAdapter('metronono_test_db_' + Math.random().toString(36).substring(2));
    await adapter.init();
  });

  it('persists and retrieves scores, systems, and custom sample blobs', async () => {
    await adapter.saveScores(dummyScores);
    const loadedScores = await adapter.loadScores();
    expect(loadedScores).toHaveLength(1);
    expect(loadedScores[0].id).toBe('score-1');

    await adapter.saveSystems(dummySystems);
    const loadedSystems = await adapter.loadSystems();
    expect(loadedSystems).toHaveLength(1);
    expect(loadedSystems[0].id).toBe('dawson-custom-1');

    const clickAudio = createDummyAudioBuffer(40, 12);
    await adapter.saveSample('click_downbeat', clickAudio, {
      filename: 'woodblock.wav',
      mimeType: 'audio/wav',
    });

    const samples = await adapter.listSamples();
    expect(samples).toHaveLength(1);
    expect(samples[0].voice).toBe('click_downbeat');

    const loadedClick = await adapter.loadSample('click_downbeat');
    expect(loadedClick).not.toBeNull();
    expect(loadedClick!.metadata.filename).toBe('woodblock.wav');
    expect(new Uint8Array(loadedClick!.data)).toEqual(new Uint8Array(clickAudio));

    // Delete
    await adapter.deleteSample('click_downbeat');
    expect(await adapter.loadSample('click_downbeat')).toBeNull();
  });

  it('requests navigator.storage.persist if available', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    (globalThis as any).navigator = {
      storage: {
        persist: persistMock,
      },
    };

    const idbAdapter = new IndexedDBAdapter('metronono_persist_test');
    await idbAdapter.init();

    expect(persistMock).toHaveBeenCalled();
  });
});

describe('FileSystemAccessAdapter', () => {
  it('correctly reports whether showDirectoryPicker is supported in current environment', () => {
    const adapter = new FileSystemAccessAdapter();
    expect(adapter.isFileSystemAccessSupported()).toBe(typeof window !== 'undefined' && 'showDirectoryPicker' in window);
  });

  it('persists and loads data through mocked FileSystemDirectoryHandle', async () => {
    // Build a mock FileSystemDirectoryHandle
    const fileStore = new Map<string, any>();

    const createMockFileHandle = (name: string) => ({
      name,
      getFile: async () => ({
        name,
        text: async () => fileStore.get(name) || '',
        arrayBuffer: async () => fileStore.get(name) || new ArrayBuffer(0),
      }),
      createWritable: async () => ({
        write: async (content: any) => {
          if (content instanceof Blob) {
            fileStore.set(name, await content.arrayBuffer());
          } else {
            fileStore.set(name, content);
          }
        },
        close: async () => {},
      }),
    });

    const mockSamplesDir = {
      getFileHandle: vi.fn(async (name: string, _opts?: { create?: boolean }) => {
        return createMockFileHandle(`samples/${name}`);
      }),
      removeEntry: vi.fn(async (name: string) => {
        fileStore.delete(`samples/${name}`);
      }),
    };

    const mockRootHandle = {
      name: 'MetrononoLibrary',
      getFileHandle: vi.fn(async (name: string, _opts?: { create?: boolean }) => {
        return createMockFileHandle(name);
      }),
      getDirectoryHandle: vi.fn(async (name: string, _opts?: { create?: boolean }) => {
        if (name === 'samples') return mockSamplesDir;
        throw new Error('Not found');
      }),
    };

    const adapter = new FileSystemAccessAdapter();
    adapter.setDirectoryHandle(mockRootHandle as any);

    expect(adapter.isLinked()).toBe(true);
    expect(adapter.getLinkedDirectoryName()).toBe('MetrononoLibrary');

    // Save and load scores
    await adapter.saveScores(dummyScores);
    const loadedScores = await adapter.loadScores();
    expect(loadedScores).toEqual(dummyScores);

    // Save and load systems
    await adapter.saveSystems(dummySystems);
    const loadedSystems = await adapter.loadSystems();
    expect(loadedSystems).toEqual(dummySystems);

    // Save sample
    const sampleBuffer = createDummyAudioBuffer(48, 55);
    await adapter.saveSample('kick', sampleBuffer, { filename: 'punchy_kick.wav' });

    const samples = await adapter.listSamples();
    expect(samples).toHaveLength(1);
    expect(samples[0].voice).toBe('kick');

    const loadedSample = await adapter.loadSample('kick');
    expect(loadedSample).not.toBeNull();
    expect(new Uint8Array(loadedSample!.data)).toEqual(new Uint8Array(sampleBuffer));

    // Delete sample
    await adapter.deleteSample('kick');
    expect(mockSamplesDir.removeEntry).toHaveBeenCalledWith('kick.bin');
    expect(await adapter.listSamples()).toHaveLength(0);
  });
});

describe('StorageManager & Fallback Behavior', () => {
  it('falls back seamlessly to in-memory adapter if file system access is unavailable or denied', async () => {
    const memoryAdapter = new InMemoryStorageAdapter();
    const manager = new StorageManager({ defaultAdapter: memoryAdapter });
    await manager.init();

    expect(manager.getAdapterType()).toBe('memory');

    // Dispatch sample change listener
    const sampleListener = vi.fn();
    manager.onSampleChange(sampleListener);

    const dummyAudio = createDummyAudioBuffer(64, 33);
    await manager.saveSample('snare', dummyAudio, { filename: 'snare.wav' });

    expect(sampleListener).toHaveBeenCalledWith('snare', expect.objectContaining({
      metadata: expect.objectContaining({ voice: 'snare', filename: 'snare.wav' }),
    }));

    const sampleList = await manager.listSamples();
    expect(sampleList).toHaveLength(1);

    await manager.deleteSample('snare');
    expect(sampleListener).toHaveBeenCalledWith('snare', null);
  });
});

describe('DrumKitPlayer & ToneTransportScheduler Custom Sample Playback', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('allows loading and clearing custom sample buffers in DrumKitPlayer', () => {
    const mixer = new AudioMixer();
    mixer.initToneNodes();
    const player = new DrumKitPlayer(mixer);
    expect(player.hasCustomSample('kick')).toBe(false);

    player.loadSampleBuffer('kick', fakeAudioBuffer());
    expect(player.hasCustomSample('kick')).toBe(true);

    player.removeSampleBuffer('kick');
    expect(player.hasCustomSample('kick')).toBe(false);
  });

  it('triggers custom sample playback when available and falls back to synth otherwise', () => {
    const mixer = new AudioMixer();
    mixer.initToneNodes();
    const player = new DrumKitPlayer(mixer);

    player.loadSampleBuffer('snare', fakeAudioBuffer());

    // Snare has a custom buffer: the sample plays instead of the built-in instrument.
    player.triggerVoice('snare', 1.0, 0.9);
    const sampleGain = nodeByLabel('sample:orchestration:audition');
    expect(fakeToneRecorder.connectedTo(sampleGain)).toContain(nodeByLabel('audition:orchestration'));
    expect(fakeToneRecorder.bufferSources()).toHaveLength(1);
    expect(fakeToneRecorder.bufferSources()[0].startedAt).toBe(1.0);
    expect(triggerCountFor('rig:orchestration:audition:snare')).toBe(0);

    // Kick has no custom buffer, so it falls back to the built-in instrument.
    player.triggerVoice('kick', 2.0, 0.9);
    expect(triggerCountFor('rig:orchestration:audition:kick')).toBeGreaterThan(0);
    // The stored sample never leaves its Mixing Channel.
    expect(fakeToneRecorder.destination.incoming).toHaveLength(6);
  });

  it('synchronizes custom samples between StorageManager and ToneTransportScheduler', async () => {
    const memoryAdapter = new InMemoryStorageAdapter();
    const manager = new StorageManager({ defaultAdapter: memoryAdapter });
    await manager.init();

    const scheduler = new ToneTransportScheduler({ storageManager: manager });

    // Spy on scheduler or drum kit player
    const player = scheduler.getDrumKitPlayer() as DrumKitPlayer;
    const loadSpy = vi.spyOn(player, 'loadSampleBuffer');
    const removeSpy = vi.spyOn(player, 'removeSampleBuffer');

    // Mock audio decoder in manager
    vi.spyOn(manager, 'decodeAudioData').mockResolvedValue(fakeAudioBuffer());

    const dummyAudio = createDummyAudioBuffer(32, 10);
    await manager.saveSample('kick', dummyAudio, { filename: 'kick.wav' });

    expect(loadSpy).toHaveBeenCalledWith('kick', expect.anything());

    // The uploaded sample plays through the Orchestration Mixing Channel.
    player.play({ timeInMeasure: 0, voice: 'kick', velocity: 0.7, dynamic: 'normal', source: 'orchestration' }, 3.0);
    const sampleGain = fakeToneRecorder.nodes.find(
      (created) => created.label === 'sample:orchestration:mix'
    );
    expect(sampleGain).toBeDefined();
    expect(fakeToneRecorder.gainValue(sampleGain)).toBe(0.7);

    await manager.deleteSample('kick');
    expect(removeSpy).toHaveBeenCalledWith('kick');
  });
});
