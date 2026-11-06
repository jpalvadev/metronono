import * as Tone from 'tone';
import { MetronomeEngine, BeatEvent, TimeSignature } from '../domain/metronome/MetronomeEngine';
import {
  IAudioClockTransport,
  IClickPlayer,
  IMasterVolumeControl,
  DrawSyncFn,
  ToneSchedulerOptions,
} from './types';

export class ToneMasterVolume implements IMasterVolumeControl {
  private gainNode: Tone.Gain;
  private currentVolume: number = 0.8;

  constructor() {
    this.gainNode = new Tone.Gain(this.currentVolume).toDestination();
  }

  public getNode(): Tone.Gain {
    return this.gainNode;
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.currentVolume = clamped;
    this.gainNode.gain.rampTo(clamped, 0.02);
  }

  public getVolume(): number {
    return this.currentVolume;
  }
}

export class ToneClickPlayer implements IClickPlayer {
  private downbeatSynth: Tone.Synth;
  private regularSynth: Tone.Synth;

  constructor(outputNode: Tone.ToneAudioNode) {
    this.downbeatSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    }).connect(outputNode);

    this.regularSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    }).connect(outputNode);
  }

  public play(isDownbeat: boolean, time: number): void {
    if (isDownbeat) {
      this.downbeatSynth.triggerAttackRelease('A6', '32n', time, 1.0);
    } else {
      this.regularSynth.triggerAttackRelease('E5', '32n', time, 0.7);
    }
  }

  public dispose(): void {
    this.downbeatSynth.dispose();
    this.regularSynth.dispose();
  }
}

export class ToneTransportScheduler {
  private engine: MetronomeEngine;
  private transport?: IAudioClockTransport;
  private clickPlayer?: IClickPlayer;
  private volumeControl?: IMasterVolumeControl;
  private drawSync?: DrawSyncFn;
  private scheduledEventId: number | null = null;
  private beatListeners: Set<(event: BeatEvent) => void> = new Set();
  private playing: boolean = false;

  constructor(options?: ToneSchedulerOptions) {
    this.engine = options?.engine ?? new MetronomeEngine();
    this.transport = options?.transport;
    this.clickPlayer = options?.clickPlayer;
    this.volumeControl = options?.volumeControl;
    this.drawSync = options?.drawSync;
  }

  private async ensureInitialized(): Promise<{
    transport: IAudioClockTransport;
    clickPlayer: IClickPlayer;
    volumeControl: IMasterVolumeControl;
    drawSync: DrawSyncFn;
  }> {
    if (!this.volumeControl) {
      this.volumeControl = new ToneMasterVolume();
    }

    if (!this.clickPlayer) {
      const outputNode = (this.volumeControl as ToneMasterVolume).getNode();
      this.clickPlayer = new ToneClickPlayer(outputNode);
    }

    if (!this.transport) {
      await Tone.start();
      const realTransport = Tone.getTransport();
      realTransport.bpm.value = this.engine.getTempo();
      realTransport.timeSignature = this.engine.getTimeSignature().beats;
      this.transport = realTransport as unknown as IAudioClockTransport;
    }

    if (!this.drawSync) {
      this.drawSync = (fn, time) => {
        Tone.getDraw().schedule(fn, time);
      };
    }

    return {
      transport: this.transport,
      clickPlayer: this.clickPlayer,
      volumeControl: this.volumeControl,
      drawSync: this.drawSync,
    };
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public getTempo(): number {
    return this.engine.getTempo();
  }

  public setTempo(bpm: number): void {
    this.engine.setTempo(bpm);
    const newBpm = this.engine.getTempo();
    if (this.transport) {
      this.transport.bpm.value = newBpm;
    }
  }

  public getTimeSignature(): TimeSignature {
    return this.engine.getTimeSignature();
  }

  public setTimeSignature(ts: TimeSignature | string): void {
    this.engine.setTimeSignature(ts);
    const newTs = this.engine.getTimeSignature();
    if (this.transport) {
      this.transport.timeSignature = newTs.beats;
      if (this.playing) {
        this.reschedule();
      }
    }
  }

  public getVolume(): number {
    if (this.volumeControl) {
      return this.volumeControl.getVolume();
    }
    return 0.8;
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.volumeControl) {
      this.volumeControl.setVolume(clamped);
    }
  }

  public tap(timestampMs?: number): number | null {
    const newBpm = this.engine.tap(timestampMs);
    if (newBpm !== null && this.transport) {
      this.transport.bpm.value = newBpm;
    }
    return newBpm;
  }

  public resetTap(): void {
    this.engine.resetTap();
  }

  public onBeat(listener: (event: BeatEvent) => void): () => void {
    this.beatListeners.add(listener);
    return () => {
      this.beatListeners.delete(listener);
    };
  }

  public async start(): Promise<void> {
    if (this.playing) return;

    const { transport } = await this.ensureInitialized();
    this.engine.reset();
    this.scheduleTicks();
    transport.start();
    this.playing = true;
  }

  public stop(): void {
    if (!this.playing) return;

    if (this.transport) {
      if (this.scheduledEventId !== null) {
        this.transport.clear(this.scheduledEventId);
        this.scheduledEventId = null;
      }
      this.transport.stop();
    }

    this.engine.reset();
    this.playing = false;
  }

  private reschedule(): void {
    if (!this.transport || !this.playing) return;
    if (this.scheduledEventId !== null) {
      this.transport.clear(this.scheduledEventId);
      this.scheduledEventId = null;
    }
    this.scheduleTicks();
  }

  private scheduleTicks(): void {
    if (!this.transport) return;

    const beatInterval = `${this.engine.getTimeSignature().beatUnit}n`;
    this.scheduledEventId = this.transport.scheduleRepeat((time: number) => {
      const beatEvent = this.engine.nextBeat();
      if (this.clickPlayer) {
        this.clickPlayer.play(beatEvent.isDownbeat, time);
      }

      if (this.drawSync) {
        this.drawSync(() => {
          this.beatListeners.forEach((listener) => listener(beatEvent));
        }, time);
      }
    }, beatInterval);
  }
}
