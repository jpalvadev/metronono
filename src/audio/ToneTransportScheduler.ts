import * as Tone from 'tone';
import {
  MetronomeEngine,
  BeatEvent,
  TimeSignature,
  ClickVoiceConfig,
  MetronomeClickConfig,
  TempoRampConfig,
  DropoutConfig,
} from '../domain/metronome/MetronomeEngine';
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
  private subdivisionSynth: Tone.Synth;
  private clickConfig: MetronomeClickConfig;

  constructor(outputNode: Tone.ToneAudioNode, initialConfig?: MetronomeClickConfig) {
    this.clickConfig = initialConfig ?? {
      downbeat: { pitch: 'A6', volume: 1.0 },
      regular: { pitch: 'E5', volume: 0.7 },
      subdivision: { pitch: 'C5', volume: 0.5 },
    };

    this.downbeatSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    }).connect(outputNode);

    this.regularSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    }).connect(outputNode);

    this.subdivisionSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
    }).connect(outputNode);
  }

  public setClickConfig(config: Partial<MetronomeClickConfig>): void {
    if (config.downbeat) {
      this.clickConfig.downbeat = { ...this.clickConfig.downbeat, ...config.downbeat };
    }
    if (config.regular) {
      this.clickConfig.regular = { ...this.clickConfig.regular, ...config.regular };
    }
    if (config.subdivision) {
      this.clickConfig.subdivision = { ...this.clickConfig.subdivision, ...config.subdivision };
    }
  }

  public play(isDownbeat: boolean, time: number, velocity?: number, pitch?: string): void {
    if (isDownbeat) {
      const p = pitch ?? this.clickConfig.downbeat.pitch;
      const v = velocity ?? this.clickConfig.downbeat.volume;
      this.downbeatSynth.triggerAttackRelease(p, '32n', time, v);
    } else {
      const p = pitch ?? this.clickConfig.regular.pitch;
      const v = velocity ?? this.clickConfig.regular.volume;
      this.regularSynth.triggerAttackRelease(p, '32n', time, v);
    }
  }

  public playSubdivision(time: number, velocity?: number, pitch?: string): void {
    const p = pitch ?? this.clickConfig.subdivision.pitch;
    const v = velocity ?? this.clickConfig.subdivision.volume;
    this.subdivisionSynth.triggerAttackRelease(p, '32n', time, v);
  }

  public dispose(): void {
    this.downbeatSynth.dispose();
    this.regularSynth.dispose();
    this.subdivisionSynth.dispose();
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
  private dropoutListeners: Set<(isDropout: boolean) => void> = new Set();
  private playStateListeners: Set<(isPlaying: boolean) => void> = new Set();
  private lastDropoutState: boolean = false;
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
      this.clickPlayer = new ToneClickPlayer(outputNode, this.engine.getClickConfig());
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

  // Beat Mask / Mute per beat
  public getBeatMask(): boolean[] {
    return this.engine.getBeatMask();
  }

  public setBeatMask(mask: boolean[]): void {
    this.engine.setBeatMask(mask);
  }

  public toggleBeat(beatIndex: number): void {
    this.engine.toggleBeat(beatIndex);
  }

  public isBeatActive(beatIndex: number): boolean {
    return this.engine.isBeatActive(beatIndex);
  }

  // Click Sound & Accent Configuration
  public getClickConfig(): MetronomeClickConfig {
    return this.engine.getClickConfig();
  }

  public setClickConfig(config: Partial<MetronomeClickConfig>): void {
    this.engine.setClickConfig(config);
    if (this.clickPlayer?.setClickConfig) {
      this.clickPlayer.setClickConfig(config);
    }
  }

  public updateVoiceConfig(
    type: 'downbeat' | 'regular' | 'subdivision',
    config: Partial<ClickVoiceConfig>
  ): void {
    this.engine.updateVoiceConfig(type, config);
    if (this.clickPlayer?.setClickConfig) {
      this.clickPlayer.setClickConfig(this.engine.getClickConfig());
    }
  }

  // Tempo Ramp
  public getTempoRampConfig(): TempoRampConfig {
    return this.engine.getTempoRampConfig();
  }

  public setTempoRampConfig(config: Partial<TempoRampConfig>): void {
    this.engine.setTempoRampConfig(config);
  }

  public getRampProgress(measureIndex: number, beatIndex: number = 0) {
    return this.engine.getRampProgress(measureIndex, beatIndex);
  }

  // Stochastic Dropout
  public getDropoutConfig(): DropoutConfig {
    return this.engine.getDropoutConfig();
  }

  public setDropoutConfig(config: Partial<DropoutConfig>): void {
    this.engine.setDropoutConfig(config);
  }

  public onBeat(listener: (event: BeatEvent) => void): () => void {
    this.beatListeners.add(listener);
    return () => {
      this.beatListeners.delete(listener);
    };
  }

  public onDropoutChange(listener: (isDropout: boolean) => void): () => void {
    this.dropoutListeners.add(listener);
    return () => {
      this.dropoutListeners.delete(listener);
    };
  }

  public onPlayStateChange(listener: (isPlaying: boolean) => void): () => void {
    this.playStateListeners.add(listener);
    return () => {
      this.playStateListeners.delete(listener);
    };
  }

  public async start(): Promise<void> {
    if (this.playing) return;

    const { transport } = await this.ensureInitialized();
    this.engine.reset();
    this.lastDropoutState = false;
    this.scheduleTicks();
    transport.start();
    this.playing = true;
    this.playStateListeners.forEach((listener) => listener(true));
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
    this.playStateListeners.forEach((listener) => listener(false));

    if (this.lastDropoutState) {
      this.lastDropoutState = false;
      this.dropoutListeners.forEach((listener) => listener(false));
    }
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

      // Automate dynamic tempo changes to transport bpm during tempo ramp
      if (this.transport && this.transport.bpm.value !== beatEvent.bpm) {
        this.transport.bpm.value = beatEvent.bpm;
      }

      // Audio click gating: silenced if beat is muted by mask or in dropout mode!
      if (this.clickPlayer && !beatEvent.isMuted) {
        const voiceConfig = beatEvent.isDownbeat
          ? this.engine.getClickConfig().downbeat
          : this.engine.getClickConfig().regular;
        this.clickPlayer.play(beatEvent.isDownbeat, time, voiceConfig.volume, voiceConfig.pitch);
      }

      // Visual callbacks and playhead synchronization continue uninterrupted!
      if (this.drawSync) {
        this.drawSync(() => {
          this.beatListeners.forEach((listener) => listener(beatEvent));
          if (this.lastDropoutState !== beatEvent.isDropout) {
            this.lastDropoutState = beatEvent.isDropout;
            this.dropoutListeners.forEach((listener) => listener(beatEvent.isDropout));
          }
        }, time);
      }
    }, beatInterval);
  }
}
