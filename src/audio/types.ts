import {
  BeatEvent,
  TimeSignature,
  ClickVoiceConfig,
  MetronomeClickConfig,
  TempoRampConfig,
  DropoutConfig,
} from '../domain/metronome/MetronomeEngine';
import { IAudioMixer } from './AudioMixer';
import { IDrumKitPlayer } from './DrumKitPlayer';
import { DawsonEngine } from '../domain/dawson/DawsonEngine';
import { ReadingLine } from '../domain/rhythm/types';
import { ScheduledDrumEvent } from '../domain/dawson/types';
import type { BackgroundAudioService } from './BackgroundAudioService';

export interface IAudioClockTransport {
  bpm: { value: number; rampTo?: (val: number, rampTime?: number) => void };
  timeSignature: number | number[];
  state: 'started' | 'stopped' | 'paused';
  start(time?: number): this;
  stop(time?: number): this;
  scheduleRepeat(callback: (time: number) => void, interval: string, startTime?: number): number;
  clear(eventId: number): this;
}

export interface IClickPlayer {
  play(isDownbeat: boolean, time: number, velocity?: number, pitch?: string): void;
  playSubdivision?(time: number, velocity?: number, pitch?: string): void;
  // Preview one click voice through the Audition node the Click Channel shares.
  audition?(voice: 'downbeat' | 'regular' | 'subdivision', time?: number, velocity?: number): void;
  setClickConfig?(config: Partial<MetronomeClickConfig>): void;
  loadSampleBuffer?(voice: 'downbeat' | 'regular' | 'subdivision', buffer: any): void;
  removeSampleBuffer?(voice: 'downbeat' | 'regular' | 'subdivision'): void;
  hasCustomSample?(voice: 'downbeat' | 'regular' | 'subdivision'): boolean;
  dispose?(): void;
}

export type DrawSyncFn = (callback: () => void, time: number) => void;

export interface ToneSchedulerOptions {
  engine?: import('../domain/metronome/MetronomeEngine').MetronomeEngine;
  transport?: IAudioClockTransport;
  clickPlayer?: IClickPlayer;
  drawSync?: DrawSyncFn;
  audioMixer?: IAudioMixer;
  drumKitPlayer?: IDrumKitPlayer;
  dawsonEngine?: DawsonEngine;
  readingLine?: ReadingLine;
  storageManager?: any;
  backgroundAudioService?: BackgroundAudioService;
}

export type {
  BeatEvent,
  TimeSignature,
  ClickVoiceConfig,
  MetronomeClickConfig,
  TempoRampConfig,
  DropoutConfig,
  IAudioMixer,
  IDrumKitPlayer,
  ScheduledDrumEvent,
};
