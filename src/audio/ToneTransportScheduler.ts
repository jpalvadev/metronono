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
  IAudioMixer,
  IDrumKitPlayer,
  ScheduledDrumEvent,
} from './types';
import { AudioMixer } from './AudioMixer';
import { DrumKitPlayer } from './DrumKitPlayer';
import { DawsonEngine } from '../domain/dawson/DawsonEngine';
import { Measure, ReadingLine, createRhythmicEvent } from '../domain/rhythm/types';

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
  private outputNode?: Tone.ToneAudioNode;
  private customBuffers: Map<'downbeat' | 'regular' | 'subdivision', any> = new Map();

  constructor(outputNode: Tone.ToneAudioNode, initialConfig?: MetronomeClickConfig) {
    this.outputNode = outputNode;
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

  public loadSampleBuffer(voice: 'downbeat' | 'regular' | 'subdivision', buffer: any): void {
    this.customBuffers.set(voice, buffer);
  }

  public removeSampleBuffer(voice: 'downbeat' | 'regular' | 'subdivision'): void {
    this.customBuffers.delete(voice);
  }

  public hasCustomSample(voice: 'downbeat' | 'regular' | 'subdivision'): boolean {
    return this.customBuffers.has(voice);
  }

  private playCustomSample(buffer: any, time: number, velocity: number): void {
    try {
      const audioTime = time > 0 ? time : Tone.now();
      const bufferSource = new Tone.ToneBufferSource(buffer);
      const gainNode = new Tone.Gain(velocity);
      bufferSource.connect(gainNode);
      if (this.outputNode) {
        gainNode.connect(this.outputNode);
      } else {
        gainNode.toDestination();
      }
      bufferSource.start(audioTime);
    } catch {
      // Safe isolation
    }
  }

  public play(isDownbeat: boolean, time: number, velocity?: number, pitch?: string): void {
    const key = isDownbeat ? 'downbeat' : 'regular';
    const custom = this.customBuffers.get(key);
    if (custom) {
      const v = velocity ?? (isDownbeat ? this.clickConfig.downbeat.volume : this.clickConfig.regular.volume);
      this.playCustomSample(custom, time, v);
      return;
    }

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
    const custom = this.customBuffers.get('subdivision');
    if (custom) {
      const v = velocity ?? this.clickConfig.subdivision.volume;
      this.playCustomSample(custom, time, v);
      return;
    }

    const p = pitch ?? this.clickConfig.subdivision.pitch;
    const v = velocity ?? this.clickConfig.subdivision.volume;
    this.subdivisionSynth.triggerAttackRelease(p, '32n', time, v);
  }

  public dispose(): void {
    this.customBuffers.clear();
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
  private audioMixer?: IAudioMixer;
  private drumKitPlayer?: IDrumKitPlayer;
  private dawsonEngine?: DawsonEngine;
  private readingLine: ReadingLine | null = null;
  private scheduledEventId: number | null = null;
  private beatListeners: Set<(event: BeatEvent) => void> = new Set();
  private dropoutListeners: Set<(isDropout: boolean) => void> = new Set();
  private playStateListeners: Set<(isPlaying: boolean) => void> = new Set();
  private drumHitListeners: Set<(event: ScheduledDrumEvent) => void> = new Set();
  private lastDropoutState: boolean = false;
  private playing: boolean = false;
  private storageManager?: any;
  private unsubscribeStorage?: () => void;

  constructor(options?: ToneSchedulerOptions) {
    this.engine = options?.engine ?? new MetronomeEngine();
    this.transport = options?.transport;
    this.clickPlayer = options?.clickPlayer;
    this.volumeControl = options?.volumeControl;
    this.drawSync = options?.drawSync;
    this.audioMixer = options?.audioMixer;
    this.drumKitPlayer = options?.drumKitPlayer;
    this.dawsonEngine = options?.dawsonEngine;
    this.readingLine = options?.readingLine ?? null;

    if (options?.storageManager) {
      this.setStorageManager(options.storageManager);
    }
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

    if (!this.audioMixer) {
      this.audioMixer = new AudioMixer();
      try {
        const outputNode = (this.volumeControl as ToneMasterVolume).getNode();
        (this.audioMixer as AudioMixer).initToneNodes(outputNode);
      } catch {
        // Safe initialization without Web Audio
      }
    }

    if (!this.clickPlayer) {
      const clickNode =
        this.audioMixer?.getChannelNode?.('click') ??
        (this.volumeControl as ToneMasterVolume).getNode();
      this.clickPlayer = new ToneClickPlayer(clickNode as any, this.engine.getClickConfig());
    }

    if (!this.drumKitPlayer) {
      this.drumKitPlayer = new DrumKitPlayer();
      try {
        const ostNode = this.audioMixer?.getChannelNode?.('ostinato');
        const orchNode = this.audioMixer?.getChannelNode?.('orchestration');
        (this.drumKitPlayer as DrumKitPlayer).initSynths(ostNode, orchNode);
      } catch {
        // Safe initialization
      }
    }

    if (!this.dawsonEngine) {
      this.dawsonEngine = new DawsonEngine();
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
    if (this.audioMixer) {
      return this.audioMixer.getMasterVolume();
    }
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
    if (this.audioMixer) {
      this.audioMixer.setMasterVolume(clamped);
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

  // Audio Mixer Access
  public getAudioMixer(): IAudioMixer {
    if (!this.audioMixer) {
      this.audioMixer = new AudioMixer();
    }
    return this.audioMixer;
  }

  public setAudioMixer(mixer: IAudioMixer): void {
    this.audioMixer = mixer;
  }

  // Drum Kit Player Access
  public getDrumKitPlayer(): IDrumKitPlayer {
    if (!this.drumKitPlayer) {
      this.drumKitPlayer = new DrumKitPlayer();
    }
    return this.drumKitPlayer;
  }

  public setDrumKitPlayer(player: IDrumKitPlayer): void {
    this.drumKitPlayer = player;
  }

  // Dawson Engine Access
  public getDawsonEngine(): DawsonEngine {
    if (!this.dawsonEngine) {
      this.dawsonEngine = new DawsonEngine();
    }
    return this.dawsonEngine;
  }

  public setDawsonEngine(engine: DawsonEngine): void {
    this.dawsonEngine = engine;
  }

  // Reading Line for Orchestration Playback
  public getReadingLine(): ReadingLine | null {
    return this.readingLine;
  }

  public setReadingLine(line: ReadingLine | null): void {
    this.readingLine = line;
  }

  // Storage Manager & Custom Audio Sample Integration
  public getStorageManager(): any {
    return this.storageManager;
  }

  public setStorageManager(manager: any): void {
    if (this.unsubscribeStorage) {
      this.unsubscribeStorage();
      this.unsubscribeStorage = undefined;
    }

    this.storageManager = manager;
    if (!manager) return;

    this.syncStorageSamples(manager);

    if (manager.onSampleChange) {
      this.unsubscribeStorage = manager.onSampleChange(
        (voice: any, stored: any) => {
          if (stored) {
            manager.decodeAudioData?.(stored.data)?.then((decoded: any) => {
              if (decoded) {
                this.applyCustomSampleBuffer(voice, decoded);
              }
            });
          } else {
            this.clearCustomSampleBuffer(voice);
          }
        }
      );
    }
  }

  public async syncStorageSamples(manager?: any): Promise<void> {
    const mgr = manager ?? this.storageManager;
    if (!mgr) return;

    try {
      const metas = await mgr.listSamples?.();
      if (!Array.isArray(metas)) return;

      for (const meta of metas) {
        const stored = await mgr.loadSample?.(meta.voice);
        if (stored) {
          const decoded = await mgr.decodeAudioData?.(stored.data);
          if (decoded) {
            this.applyCustomSampleBuffer(meta.voice, decoded);
          }
        }
      }
    } catch {
      // Safe error isolation
    }
  }

  public applyCustomSampleBuffer(voice: string, buffer: any): void {
    if (voice === 'click_downbeat') {
      this.clickPlayer?.loadSampleBuffer?.('downbeat', buffer);
    } else if (voice === 'click_regular') {
      this.clickPlayer?.loadSampleBuffer?.('regular', buffer);
    } else if (voice === 'click_subdivision') {
      this.clickPlayer?.loadSampleBuffer?.('subdivision', buffer);
    } else {
      this.drumKitPlayer?.loadSampleBuffer?.(voice as any, buffer);
    }
  }

  public clearCustomSampleBuffer(voice: string): void {
    if (voice === 'click_downbeat') {
      this.clickPlayer?.removeSampleBuffer?.('downbeat');
    } else if (voice === 'click_regular') {
      this.clickPlayer?.removeSampleBuffer?.('regular');
    } else if (voice === 'click_subdivision') {
      this.clickPlayer?.removeSampleBuffer?.('subdivision');
    } else {
      this.drumKitPlayer?.removeSampleBuffer?.(voice as any);
    }
  }

  public auditionVoice(voice: string): void {
    if (voice === 'click_downbeat') {
      this.clickPlayer?.play(true, 0, 1.0);
    } else if (voice === 'click_regular') {
      this.clickPlayer?.play(false, 0, 1.0);
    } else if (voice === 'click_subdivision') {
      this.clickPlayer?.playSubdivision?.(0, 1.0);
    } else {
      this.drumKitPlayer?.triggerVoice(voice as any, 0, 1.0);
    }
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

  public onDrumHit(listener: (event: ScheduledDrumEvent) => void): () => void {
    this.drumHitListeners.add(listener);
    return () => {
      this.drumHitListeners.delete(listener);
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

  private getMeasureForIndex(measureIndex: number): Measure | null {
    if (this.readingLine && this.readingLine.measures.length > 0) {
      return this.readingLine.measures[measureIndex % this.readingLine.measures.length];
    }

    // Default 4/4 measure with whole rest so ostinato patterns still sound!
    return {
      index: measureIndex,
      timeSignature: [4, 4],
      totalBeats: 4,
      events: [createRhythmicEvent({ isRest: true, durationBeats: 4.0, durationType: 'whole' })],
    };
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

      // Dawson Drum Kit Orchestration & Ostinato Playback
      if (this.dawsonEngine && this.drumKitPlayer) {
        const measure = this.getMeasureForIndex(beatEvent.measureIndex);
        if (measure) {
          const measureEvents = this.dawsonEngine.resolveMeasure(measure, beatEvent.measureIndex);
          const b = beatEvent.beatIndex;
          const beatEvents = measureEvents.filter(
            (e) => e.timeInMeasure >= b && e.timeInMeasure < b + 1.0
          );
          const beatDuration = 60 / beatEvent.bpm;

          for (const drumEvent of beatEvents) {
            const subOffset = drumEvent.timeInMeasure - b;
            const eventTime = time + subOffset * beatDuration;

            this.drumKitPlayer.play(drumEvent, eventTime);

            if (this.drawSync) {
              this.drawSync(() => {
                this.drumHitListeners.forEach((listener) => listener(drumEvent));
              }, eventTime);
            }
          }
        }
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
