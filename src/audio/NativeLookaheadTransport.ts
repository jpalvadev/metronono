import { IAudioClockTransport } from './types';
import { getAudioContext } from './WebAudioContext';

export const LOOKAHEAD_INTERVAL_MS = 25;
export const SCHEDULE_AHEAD_SEC = 0.1;

interface ScheduledRepeat {
  id: number;
  callback: (time: number) => void;
  beatUnit: number;
  nextNoteTime: number;
}

function parseBeatUnit(interval: string): number {
  const parsed = Number.parseInt(interval, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

/**
 * Pure Web Audio `setInterval` + `AudioContext.currentTime` Lookahead Scheduler
 * implementing `IAudioClockTransport` without Tone.js (ADR-0014).
 */
export class NativeLookaheadTransport implements IAudioClockTransport {
  public bpm: { value: number; rampTo?: (val: number, rampTime?: number) => void } = {
    value: 120,
    rampTo: (val: number) => {
      this.bpm.value = val;
    },
  };
  public timeSignature: number | number[] = 4;
  public state: 'started' | 'stopped' | 'paused' = 'stopped';

  private repeats: Map<number, ScheduledRepeat> = new Map();
  private nextId = 1;
  private timerId: ReturnType<typeof setInterval> | null = null;

  public start(time?: number): this {
    if (this.state === 'started') return this;
    this.state = 'started';

    const ctx = getAudioContext();
    const startAt = typeof time === 'number' && Number.isFinite(time) ? time : ctx.currentTime;
    this.repeats.forEach((repeat) => {
      repeat.nextNoteTime = startAt;
    });

    this.tick();
    this.timerId = setInterval(() => this.tick(), LOOKAHEAD_INTERVAL_MS);
    return this;
  }

  public stop(): this {
    this.state = 'stopped';
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    return this;
  }

  public scheduleRepeat(
    callback: (time: number) => void,
    interval: string,
    startTime?: number
  ): number {
    const id = this.nextId++;
    const ctx = getAudioContext();
    const nextNoteTime =
      typeof startTime === 'number' && Number.isFinite(startTime) ? startTime : ctx.currentTime;

    this.repeats.set(id, {
      id,
      callback,
      beatUnit: parseBeatUnit(interval),
      nextNoteTime,
    });
    return id;
  }

  public clear(eventId: number): this {
    this.repeats.delete(eventId);
    return this;
  }

  private tick(): void {
    if (this.state !== 'started') return;
    const ctx = getAudioContext();
    const horizon = ctx.currentTime + SCHEDULE_AHEAD_SEC;

    this.repeats.forEach((repeat) => {
      // If the tab stalled far behind the hardware clock, snap forward to avoid a burst.
      if (ctx.currentTime - repeat.nextNoteTime > 0.5) {
        repeat.nextNoteTime = ctx.currentTime;
      }

      while (this.state === 'started' && repeat.nextNoteTime < horizon) {
        const scheduledTime = repeat.nextNoteTime;
        repeat.callback(scheduledTime);

        const safeBpm = Math.max(1, this.bpm.value || 120);
        const beatDurationSec = (4 / repeat.beatUnit) * (60 / safeBpm);
        repeat.nextNoteTime += beatDurationSec;
      }
    });
  }
}
