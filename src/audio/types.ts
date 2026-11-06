import { BeatEvent, TimeSignature } from '../domain/metronome/MetronomeEngine';

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
  play(isDownbeat: boolean, time: number): void;
  dispose?(): void;
}

export interface IMasterVolumeControl {
  setVolume(volume: number): void;
  getVolume(): number;
}

export type DrawSyncFn = (callback: () => void, time: number) => void;

export interface ToneSchedulerOptions {
  engine?: import('../domain/metronome/MetronomeEngine').MetronomeEngine;
  transport?: IAudioClockTransport;
  clickPlayer?: IClickPlayer;
  volumeControl?: IMasterVolumeControl;
  drawSync?: DrawSyncFn;
}

export type { BeatEvent, TimeSignature };
