import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DefaultSampleLoader, isValidDefaultSampleUrl } from '../DefaultSampleLoader';
import { ALL_SAMPLE_VOICES } from '../../storage/types';
import { AudioMixer } from '../AudioMixer';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioBuffer, FakeAudioContext } from '../../test/fakeWebAudio';
import { SampleBankModal } from '../../components/storage/SampleBankModal';
import { StorageManager } from '../../storage/StorageManager';
import { InMemoryStorageAdapter } from '../../storage/InMemoryStorageAdapter';

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

describe('DefaultSampleLoader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and decodes all 15 canonical voices once from /samples/<voiceId>.wav', async () => {
    const wavBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => wavBytes,
    })) as unknown as typeof fetch;

    const loader = new DefaultSampleLoader();
    const loaded = await loader.loadAll(fetchMock);

    expect(ALL_SAMPLE_VOICES).toHaveLength(15);
    expect(loaded.size).toBe(15);
    expect(fetchMock).toHaveBeenCalledTimes(15);

    for (const voice of ALL_SAMPLE_VOICES) {
      expect(fetchMock).toHaveBeenCalledWith(`/samples/${voice.id}.wav`);
      expect(loader.getCachedBuffer(voice.id)).not.toBeNull();
    }

    // Calling loadAll a second time uses the cache without re-fetching.
    await loader.loadAll(fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(15);
  });

  it('rejects .mp3 default paths and logs a single warning on missing .wav without throwing', async () => {
    expect(isValidDefaultSampleUrl('/samples/kick.wav')).toBe(true);
    expect(isValidDefaultSampleUrl('/samples/kick.mp3')).toBe(false);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
    })) as unknown as typeof fetch;

    const loader = new DefaultSampleLoader();
    const first = await loader.loadVoice('kick', fetchMock);
    const second = await loader.loadVoice('kick', fetchMock);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('prioritizes Sample Bank custom .wav overrides and restores default .wav on reset', () => {
    const mixer = new AudioMixer();
    mixer.initToneNodes();
    const player = new DrumKitPlayer(mixer);

    const defaultBuf = new FakeAudioBuffer(1, 1024, 44100) as unknown as AudioBuffer;
    const customBuf = new FakeAudioBuffer(1, 4096, 44100) as unknown as AudioBuffer;

    player.loadDefaultSampleBuffer('snare', defaultBuf);
    player.play(
      { timeInMeasure: 0, voice: 'snare', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
      1.0
    );
    expect(fakeCtx().bufferSources[0].buffer).toBe(defaultBuf);

    // Custom override takes precedence.
    player.loadSampleBuffer('snare', customBuf);
    player.play(
      { timeInMeasure: 0, voice: 'snare', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
      2.0
    );
    expect(fakeCtx().bufferSources[1].buffer).toBe(customBuf);

    // Removing the custom override restores the default .wav buffer.
    player.removeSampleBuffer('snare');
    player.play(
      { timeInMeasure: 0, voice: 'snare', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
      3.0
    );
    expect(fakeCtx().bufferSources[2].buffer).toBe(defaultBuf);
  });

  it('restricts SampleBankModal upload picker to .wav files', async () => {
    const storageManager = new StorageManager({ defaultAdapter: new InMemoryStorageAdapter() });
    await storageManager.init();

    render(
      <SampleBankModal
        isOpen={true}
        onClose={() => {}}
        storageManager={storageManager}
      />
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const sampleUploadInput = Array.from(fileInputs).find(
      (input) => input.getAttribute('accept') !== '.metronono,.zip,application/zip'
    );
    expect(sampleUploadInput).toBeDefined();
    expect(sampleUploadInput?.getAttribute('accept')).toBe('.wav,audio/wav');
    expect(screen.getByText(/Sample Bank/i)).toBeInTheDocument();
  });
});
