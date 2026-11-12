import { DrumVoice } from '../domain/dawson/types';
import { ALL_SAMPLE_VOICES, SampleVoiceId } from '../storage/types';
import { decodeAudioDataWithNativeContext } from './WebAudioContext';

export function isValidDefaultSampleUrl(url: string): boolean {
  return /\.wav$/i.test(url);
}

export function defaultSampleUrl(voiceId: SampleVoiceId): string {
  const metaEnv = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = metaEnv?.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}samples/${voiceId}.wav`;
}

/**
 * Loads and decodes default `.wav` assets once per voice from `public/samples/<voiceId>.wav`.
 * Rejects `.mp3` default paths, logs a single warning per missing/unreadable `.wav`, and
 * leaves missing voices silent with zero synthesized fallback (ADR-0014).
 */
export class DefaultSampleLoader {
  private cache: Map<SampleVoiceId, AudioBuffer> = new Map();
  private inFlight: Map<SampleVoiceId, Promise<AudioBuffer | null>> = new Map();
  private warnedVoices: Set<SampleVoiceId> = new Set();

  public getCachedBuffer(voiceId: SampleVoiceId): AudioBuffer | null {
    return this.cache.get(voiceId) ?? null;
  }

  public clearCache(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.warnedVoices.clear();
  }

  private warnOnce(voiceId: SampleVoiceId, reason: string): void {
    if (this.warnedVoices.has(voiceId)) return;
    this.warnedVoices.add(voiceId);
    console.warn(`[Audio] Default sample missing or unreadable for '${voiceId}': ${reason}`);
  }

  public async loadVoice(
    voiceId: SampleVoiceId,
    fetchFn: typeof fetch | undefined = globalThis.fetch
  ): Promise<AudioBuffer | null> {
    const cached = this.cache.get(voiceId);
    if (cached) return cached;

    const pending = this.inFlight.get(voiceId);
    if (pending) return pending;

    const url = defaultSampleUrl(voiceId);
    if (!isValidDefaultSampleUrl(url)) {
      this.warnOnce(voiceId, `Invalid default sample URL '${url}' (only .wav is supported).`);
      return null;
    }

    if (typeof fetchFn !== 'function') {
      this.warnOnce(voiceId, 'fetch API unavailable.');
      return null;
    }

    const promise = (async (): Promise<AudioBuffer | null> => {
      try {
        const response = await fetchFn(url);
        if (!response.ok) {
          this.warnOnce(voiceId, `HTTP ${response.status} for ${url}`);
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await decodeAudioDataWithNativeContext(arrayBuffer);
        this.cache.set(voiceId, decoded);
        return decoded;
      } catch (err) {
        this.warnOnce(voiceId, err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        this.inFlight.delete(voiceId);
      }
    })();

    this.inFlight.set(voiceId, promise);
    return promise;
  }

  public async loadAll(
    fetchFn: typeof fetch | undefined = globalThis.fetch
  ): Promise<Map<SampleVoiceId, AudioBuffer>> {
    await Promise.all(
      ALL_SAMPLE_VOICES.map(async (voice) => {
        await this.loadVoice(voice.id, fetchFn);
      })
    );
    return new Map(this.cache);
  }
}

export function isClickVoiceId(voice: SampleVoiceId): voice is 'click_downbeat' | 'click_regular' | 'click_subdivision' {
  return voice === 'click_downbeat' || voice === 'click_regular' || voice === 'click_subdivision';
}

export function isDrumVoiceId(voice: SampleVoiceId): voice is DrumVoice {
  return !isClickVoiceId(voice);
}
