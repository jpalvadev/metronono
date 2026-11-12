import { DrumVoice, ScheduledDrumEvent } from '../domain/dawson/types';
import { IAudioMixer, MixerChannelId } from './AudioMixer';
import { SampleStrokePlayer } from './NativeSamplePlayback';

// The lane a drum sound belongs to. A Mixing Channel is only ever 'click' for metronome
// clicks; drum voices play on the Ostinato or Orchestration channel.
export type DrumLane = Extract<MixerChannelId, 'ostinato' | 'orchestration'>;

export type RigMode = 'mix' | 'audition';

export interface IDrumKitPlayer {
  initSynths?(): boolean;
  play(event: ScheduledDrumEvent, time: number): void;
  triggerVoice(
    voice: DrumVoice,
    time?: number,
    velocity?: number,
    source?: DrumLane
  ): void;
  loadSampleBuffer?(voice: DrumVoice, buffer: any): void;
  loadDefaultSampleBuffer?(voice: DrumVoice, buffer: any): void;
  removeSampleBuffer?(voice: DrumVoice): void;
  hasCustomSample?(voice: DrumVoice): boolean;
  clearAllCustomSamples?(): void;
  // Retire every still-pending sample source when the transport stops, so stopping
  // leaves nothing waiting to sound behind the mixer.
  stopPendingSamples?(): void;
  playCustomSample?(
    buffer: any,
    time: number,
    velocity: number,
    lane: DrumLane,
    mode?: RigMode
  ): void;
  dispose?(): void;
}

/**
 * DrumKitPlayer — Pure Web Audio `.wav` sample player for the Drum Kit.
 *
 * Every stroke plays through a fresh `AudioBufferSourceNode -> per-hit GainNode`
 * into the target Mixing Channel (or Audition node) with natural polyphony and
 * automatic `onended` disconnection. Zero live synths (ADR-0014).
 */
export class DrumKitPlayer implements IDrumKitPlayer {
  private mixer: IAudioMixer;
  private customSampleBuffers: Map<DrumVoice, AudioBuffer> = new Map();
  private defaultSampleBuffers: Map<DrumVoice, AudioBuffer> = new Map();
  private strokePlayer = new SampleStrokePlayer();

  constructor(mixer: IAudioMixer) {
    this.mixer = mixer;
  }

  public initSynths(): boolean {
    return this.mixer.isGraphInitialized();
  }

  public play(event: ScheduledDrumEvent, time: number): void {
    const lane = event.source;
    // A silent Mixing Channel, muted or turned all the way down, produces no sound at all.
    if (!this.mixer.isChannelAudible(lane)) return;

    const velocity = event.velocity ?? 0.8;
    this.executeVoiceSound(event.voice, time, velocity, lane, 'mix');
  }

  public triggerVoice(
    voice: DrumVoice,
    time: number = 0,
    velocity: number = 0.8,
    source?: DrumLane
  ): void {
    const isOstinatoVoice = voice === 'ride' || voice === 'ride_bell' || voice.startsWith('hihat');
    const lane: DrumLane = source ?? (isOstinatoVoice ? 'ostinato' : 'orchestration');

    // A manual tap is an Audition tap: it plays through the Audition node of its channel,
    // which is never silenced.
    this.executeVoiceSound(voice, time, velocity, lane, 'audition');
  }

  public loadSampleBuffer(voice: DrumVoice, buffer: AudioBuffer): void {
    this.customSampleBuffers.set(voice, buffer);
  }

  public removeSampleBuffer(voice: DrumVoice): void {
    this.customSampleBuffers.delete(voice);
  }

  public hasCustomSample(voice: DrumVoice): boolean {
    return this.customSampleBuffers.has(voice);
  }

  public clearAllCustomSamples(): void {
    this.customSampleBuffers.clear();
  }

  public loadDefaultSampleBuffer(voice: DrumVoice, buffer: AudioBuffer): void {
    this.defaultSampleBuffers.set(voice, buffer);
  }

  public playCustomSample(
    buffer: AudioBuffer,
    time: number,
    velocity: number,
    lane: DrumLane,
    mode: RigMode = 'mix'
  ): void {
    if (!this.mixer.isGraphInitialized()) return;
    try {
      const targetNode =
        mode === 'audition' ? this.mixer.getAuditionNode(lane) : this.mixer.getChannelNode(lane);
      this.strokePlayer.playBuffer(buffer, time, velocity, targetNode, `sample:${lane}:${mode}`);
    } catch {
      // Safe isolation
    }
  }

  /** Stop leaves nothing waiting to sound behind the mixer. */
  public stopPendingSamples(): void {
    this.strokePlayer.stopAll();
  }

  public dispose(): void {
    this.customSampleBuffers.clear();
    this.defaultSampleBuffers.clear();
    this.strokePlayer.stopAll();
  }

  private executeVoiceSound(
    voice: DrumVoice,
    time: number,
    velocity: number,
    lane: DrumLane,
    mode: RigMode
  ): void {
    const buffer = this.customSampleBuffers.get(voice) ?? this.defaultSampleBuffers.get(voice);
    if (!buffer) return;
    this.playCustomSample(buffer, time, velocity, lane, mode);
  }
}
