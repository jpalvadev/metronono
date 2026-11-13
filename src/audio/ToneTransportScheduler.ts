import {
  MetronomeEngine,
  BeatEvent,
  TimeSignature,
  PulseFeel,
  ClickVoiceConfig,
  SubdivisionVoiceConfig,
  MetronomeClickConfig,
  TempoRampConfig,
  DropoutConfig,
  createDefaultClickConfig,
} from '../domain/metronome/MetronomeEngine';
import {
  IAudioClockTransport,
  IClickPlayer,
  DrawSyncFn,
  ToneSchedulerOptions,
  IAudioMixer,
  IDrumKitPlayer,
} from './types';
import { AudioMixer, IGainNodeLike } from './AudioMixer';
import { DrumKitPlayer } from './DrumKitPlayer';
import { SampleStrokePlayer } from './NativeSamplePlayback';
import { DefaultSampleLoader } from './DefaultSampleLoader';
import { NativeLookaheadTransport } from './NativeLookaheadTransport';
import { getAudioContext, resumeAudioContext } from './WebAudioContext';
import { DawsonEngine } from '../domain/dawson/DawsonEngine';
import { Measure, ReadingLine, createRhythmicEvent } from '../domain/rhythm/types';
import { BackgroundAudioService } from './BackgroundAudioService';
import { ScheduledDrumEvent } from '../domain/dawson/types';

type ClickVoiceKey = 'downbeat' | 'regular' | 'subdivision';

export class ToneClickPlayer implements IClickPlayer {
  private clickConfig: MetronomeClickConfig;
  // The Click Mixing Channel node every scheduled click is heard through, and the Audition
  // node Click shares, which a preview tap is heard through instead.
  private outputNode?: IGainNodeLike;
  private auditionNode?: IGainNodeLike;
  private customBuffers: Map<ClickVoiceKey, AudioBuffer> = new Map();
  private defaultBuffers: Map<ClickVoiceKey, AudioBuffer> = new Map();
  private strokePlayer = new SampleStrokePlayer();

  constructor(
    outputNode: IGainNodeLike,
    auditionNode: IGainNodeLike,
    initialConfig?: MetronomeClickConfig
  ) {
    this.outputNode = outputNode;
    this.auditionNode = auditionNode;
    this.clickConfig = initialConfig ?? createDefaultClickConfig();
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

  public loadSampleBuffer(voice: ClickVoiceKey, buffer: AudioBuffer): void {
    this.customBuffers.set(voice, buffer);
  }

  public removeSampleBuffer(voice: ClickVoiceKey): void {
    this.customBuffers.delete(voice);
  }

  public hasCustomSample(voice: ClickVoiceKey): boolean {
    return this.customBuffers.has(voice);
  }

  public loadDefaultSampleBuffer(voice: ClickVoiceKey, buffer: AudioBuffer): void {
    this.defaultBuffers.set(voice, buffer);
  }

  /** Stop leaves nothing waiting to sound behind the mixer. */
  public stopPendingSamples(): void {
    this.strokePlayer.stopAll();
  }

  private playVoice(key: ClickVoiceKey, time: number, velocity?: number): void {
    if (this.clickConfig[key].muted) return;
    const buffer = this.customBuffers.get(key) ?? this.defaultBuffers.get(key);
    if (!buffer || !this.outputNode) return;
    const v = velocity ?? this.clickConfig[key].volume;
    if (v <= 0) return;
    this.strokePlayer.playBuffer(buffer, time, v, this.outputNode, `click:mix:${key}`);
  }

  public play(isDownbeat: boolean, time: number, velocity?: number): void {
    this.playVoice(isDownbeat ? 'downbeat' : 'regular', time, velocity);
  }

  public playSubdivision(time: number, velocity?: number): void {
    this.playVoice('subdivision', time, velocity);
  }

  /** A preview tap: heard through the Audition node Click shares, never through its mute. */
  public audition(voice: ClickVoiceKey, time = 0, velocity = 1.0): void {
    const buffer = this.customBuffers.get(voice) ?? this.defaultBuffers.get(voice);
    if (!buffer || !this.auditionNode) return;
    const v = velocity * this.clickConfig[voice].volume;
    this.strokePlayer.playBuffer(buffer, time, v, this.auditionNode, `click:audition:${voice}`);
  }

  public dispose(): void {
    this.customBuffers.clear();
    this.defaultBuffers.clear();
    this.strokePlayer.stopAll();
  }
}

/**
 * ToneTransportScheduler — owns the whole audio graph.
 *
 * The AudioMixer (the three Mixing Channels), the click voice wired onto the Click Mixing Channel
 * node and the Drum Kit Player rigs wired onto the Ostinato and Orchestration Mixing Channel nodes
 * are all built here, eagerly, and connect directly to the audio destination. Loudness is controlled
 * directly on the three Mixing Channels.
 */
export class ToneTransportScheduler {
  private engine: MetronomeEngine;
  private transport?: IAudioClockTransport;
  private clickPlayer?: IClickPlayer;
  private injectedClickPlayer: boolean;
  private drawSync?: DrawSyncFn;
  private audioMixer: IAudioMixer;
  private drumKitPlayer: IDrumKitPlayer;
  private dawsonEngine?: DawsonEngine;
  private readingLine: ReadingLine | null = null;
  // The Measure Plan (docs/adr/0011): one entry per reading-line measure, each holding its
  // resolved Scheduled Drum Events bucketed by whole beat. The audio clock tick only reads
  // a bucket — the domain is never consulted there. Null means "not built yet".
  private measurePlan: ScheduledDrumEvent[][][] | null = null;
  private unsubscribeDawsonChange?: () => void;
  private scheduledEventId: number | null = null;
  private beatListeners: Set<(event: BeatEvent) => void> = new Set();
  private dropoutListeners: Set<(isDropout: boolean) => void> = new Set();
  private playStateListeners: Set<(isPlaying: boolean) => void> = new Set();
  private timeSignatureListeners: Set<(ts: TimeSignature) => void> = new Set();
  private pulseFeelListeners: Set<(feel: PulseFeel) => void> = new Set();
  private lastDropoutState: boolean = false;
  private playing: boolean = false;
  private storageManager?: any;
  private unsubscribeStorage?: () => void;
  private backgroundAudioService?: BackgroundAudioService;

  constructor(options?: ToneSchedulerOptions) {
    this.engine = options?.engine ?? new MetronomeEngine();
    this.transport = options?.transport;
    this.clickPlayer = options?.clickPlayer;
    this.injectedClickPlayer = options?.clickPlayer !== undefined;
    this.drawSync = options?.drawSync;
    this.audioMixer = options?.audioMixer ?? new AudioMixer();
    this.dawsonEngine = options?.dawsonEngine;
    this.readingLine = options?.readingLine ?? null;
    // The Drum Kit Player plays on the Mixing Channel nodes the Mixer owns, so it is built from it.
    this.drumKitPlayer = options?.drumKitPlayer ?? new DrumKitPlayer(this.audioMixer);

    if (this.dawsonEngine) {
      this.attachDawsonEngine(this.dawsonEngine);
    }

    if (options?.backgroundAudioService) {
      this.setBackgroundAudioService(options.backgroundAudioService);
    } else {
      this.setBackgroundAudioService(new BackgroundAudioService());
    }

    // Components read the Mixer and the Drum Kit Player as soon as they mount, so the graph is
    // built at construction instead of on the first play.
    this.buildAudioGraph();

    if (options?.storageManager) {
      this.setStorageManager(options.storageManager);
    }
  }

  /**
   * Builds the Mixing Channel nodes and every voice wired onto them. Idempotent and
   * retry-safe: an audio context that could not build nodes yet can build them on the next call.
   * Returns false when the graph is unavailable, in which case nothing plays.
   */
  private buildAudioGraph(): boolean {
    if (!this.audioMixer.isGraphInitialized?.()) {
      if (!this.audioMixer.initToneNodes()) return false;
    }

    if (!this.injectedClickPlayer && !this.clickPlayer) {
      try {
        this.clickPlayer = new ToneClickPlayer(
          this.audioMixer.getChannelNode('click'),
          this.audioMixer.getAuditionNode('click'),
          this.engine.getClickConfig()
        );
      } catch {
        // Fail closed: without the Click Mixing Channel node the click voice stays silent.
        return false;
      }
    }

    if (this.drumKitPlayer.initSynths) {
      this.drumKitPlayer.initSynths();
    }

    return this.audioMixer.isGraphInitialized?.() ?? false;
  }

  public isAudioGraphReady(): boolean {
    return this.audioMixer.isGraphInitialized?.() ?? false;
  }

  /**
   * Subscribes to the engine's change hook so ostinato, system or formula edits
   * rebuild the Measure Plan at the edit gesture, never inside the audio tick.
   */
  private attachDawsonEngine(engine: DawsonEngine): void {
    if (this.unsubscribeDawsonChange) {
      this.unsubscribeDawsonChange();
      this.unsubscribeDawsonChange = undefined;
    }
    this.unsubscribeDawsonChange = engine.onChange(() => this.buildMeasurePlans());
    this.measurePlan = null;
  }

  /**
   * Builds the Measure Plan: every reading-line measure resolved once and bucketed by whole
   * beat, so the tick reads pre-resolved buckets instead of running resolveMeasure+filter.
   * A composition edit rebuilds it through the setters or the engine's change hook — the
   * tick never does (docs/adr/0011).
   */
  private buildMeasurePlans(): void {
    const { beats, beatUnit } = this.engine.getTimeSignature();
    if (!this.dawsonEngine || beats !== 4 || beatUnit !== 4 || this.engine.getPulseFeel() !== 'straight') {
      this.measurePlan = null;
      return;
    }
    const engine = this.dawsonEngine;

    const defaultMeasure: Measure = {
      index: 0,
      timeSignature: [4, 4],
      totalBeats: 4,
      events: [createRhythmicEvent({ isRest: true, durationBeats: 4.0, durationType: 'whole' })],
    };
    const measures: Measure[] =
      this.readingLine && this.readingLine.measures.length > 0
        ? [...this.readingLine.measures]
        : [defaultMeasure];

    this.measurePlan = measures.map((measure) => {
      const buckets: ScheduledDrumEvent[][] = [];
      for (let beat = 0; beat < beats; beat++) {
        buckets.push([]);
      }
      for (const event of engine.resolveMeasure(measure, measure.index)) {
        if (event.timeInMeasure >= 0 && event.timeInMeasure < beats) {
          buckets[Math.floor(event.timeInMeasure)].push(event);
        }
      }
      return buckets;
    });
  }

  private defaultSampleLoader = new DefaultSampleLoader();
  private defaultSamplesLoaded = false;
  private pendingDrawTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  // Lazy acquisition of the native Lookahead transport and audio clock (retryable)
  private async ensureInitialized(): Promise<{
    transport: IAudioClockTransport;
    clickPlayer?: IClickPlayer;
    drawSync: DrawSyncFn;
  }> {
    // An audio context that was not ready at construction may be ready now.
    this.buildAudioGraph();
    if (!this.defaultSamplesLoaded) {
      this.defaultSamplesLoaded = true;
      void this.loadDefaultSamples();
    }

    if (!this.transport) {
      await resumeAudioContext().catch(() => {});
      const nativeTransport = new NativeLookaheadTransport();
      nativeTransport.bpm.value = this.engine.getTempo();
      nativeTransport.timeSignature = this.engine.getPulsesPerMeasure();
      this.transport = nativeTransport;
    }

    if (!this.drawSync) {
      this.drawSync = (fn, time) => {
        const ctx = getAudioContext();
        const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
        const timer = setTimeout(() => {
          this.pendingDrawTimers.delete(timer);
          if (!this.playing) return;
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              if (this.playing) fn();
            });
          } else {
            fn();
          }
        }, delayMs);
        this.pendingDrawTimers.add(timer);
      };
    }

    return {
      transport: this.transport,
      clickPlayer: this.clickPlayer,
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

  private syncTransportAndPlans(): void {
    this.buildMeasurePlans();
    if (this.transport) {
      this.transport.timeSignature = this.engine.getPulsesPerMeasure();
      if (this.playing) {
        this.reschedule();
      }
    }
  }

  public setTimeSignature(ts: TimeSignature | string): void {
    this.engine.setTimeSignature(ts);
    const newTs = this.engine.getTimeSignature();
    this.syncTransportAndPlans();
    this.timeSignatureListeners.forEach((listener) => listener(newTs));
  }

  public getPulseFeel(): PulseFeel {
    return this.engine.getPulseFeel();
  }

  public setPulseFeel(feel: PulseFeel): void {
    this.engine.setPulseFeel(feel);
    const nextFeel = this.engine.getPulseFeel();
    this.syncTransportAndPlans();
    this.pulseFeelListeners.forEach((listener) => listener(nextFeel));
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
  public onClickConfigChange(listener: (config: MetronomeClickConfig) => void): () => void {
    return this.engine.onClickConfigChange(listener);
  }

  public getClickConfig(): MetronomeClickConfig {
    return this.engine.getClickConfig();
  }

  public setClickConfig(config: {
    downbeat?: Partial<ClickVoiceConfig>;
    regular?: Partial<ClickVoiceConfig>;
    subdivision?: Partial<SubdivisionVoiceConfig>;
  }): void {
    this.engine.setClickConfig(config);
    if (this.clickPlayer?.setClickConfig) {
      this.clickPlayer.setClickConfig(config);
    }
  }

  public updateVoiceConfig(
    type: 'downbeat' | 'regular' | 'subdivision',
    config: Partial<ClickVoiceConfig & SubdivisionVoiceConfig>
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
    const prev = this.engine.getTempoRampConfig();
    this.engine.setTempoRampConfig(config);
    const next = this.engine.getTempoRampConfig();

    const paramsChanged =
      next.startBpm !== prev.startBpm ||
      next.targetBpm !== prev.targetBpm ||
      next.durationBars !== prev.durationBars ||
      next.oscillate !== prev.oscillate;

    if (prev.enabled && !next.enabled && this.transport) {
      this.transport.bpm.value = this.engine.getTempo();
    } else if (next.enabled && (!prev.enabled || paramsChanged)) {
      if (this.transport) {
        this.transport.bpm.value = this.engine.getTempo();
      }
      if (this.playing && this.lastDropoutState) {
        this.lastDropoutState = false;
        this.dropoutListeners.forEach((listener) => listener(false));
      }
    }
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
    return this.audioMixer;
  }

  public getClickPlayer(): IClickPlayer | null {
    return this.clickPlayer ?? null;
  }

  public setAudioMixer(mixer: IAudioMixer): void {
    this.audioMixer = mixer;
    this.buildAudioGraph();
  }

  // Drum Kit Player Access
  public getDrumKitPlayer(): IDrumKitPlayer {
    return this.drumKitPlayer;
  }

  public setDrumKitPlayer(player: IDrumKitPlayer): void {
    this.drumKitPlayer = player;
    if (player.initSynths) {
      player.initSynths();
    }
  }

  // Dawson Engine Access
  public getDawsonEngine(): DawsonEngine {
    if (!this.dawsonEngine) {
      this.dawsonEngine = new DawsonEngine();
      this.attachDawsonEngine(this.dawsonEngine);
    }
    return this.dawsonEngine;
  }

  public setDawsonEngine(engine: DawsonEngine): void {
    this.dawsonEngine = engine;
    this.attachDawsonEngine(engine);
  }

  // Background Audio Service Access
  public getBackgroundAudioService(): BackgroundAudioService | undefined {
    return this.backgroundAudioService;
  }

  public setBackgroundAudioService(service: BackgroundAudioService): void {
    this.backgroundAudioService = service;
    service.attach(this);
  }

  // Reading Line for Orchestration Playback
  public getReadingLine(): ReadingLine | null {
    return this.readingLine;
  }

  public setReadingLine(line: ReadingLine | null): void {
    this.readingLine = line;
    this.buildMeasurePlans();
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

  /**
   * Preview one voice on its own Mixing Channel: a tap on a muted or silent Channel is still
   * heard, at the volume that Channel's slider holds, because it is played through the Audition
   * node the Channel shares instead of through the Channel node itself.
   */
  public auditionVoice(voice: string): void {
    if (voice === 'click_downbeat') {
      this.auditionClickVoice('downbeat');
    } else if (voice === 'click_regular') {
      this.auditionClickVoice('regular');
    } else if (voice === 'click_subdivision') {
      this.auditionClickVoice('subdivision');
    } else {
      this.drumKitPlayer?.triggerVoice(voice as any, 0, 1.0);
    }
  }

  private auditionClickVoice(key: 'downbeat' | 'regular' | 'subdivision'): void {
    const player = this.clickPlayer;
    if (!player) return;

    if (player.audition) {
      player.audition(key);
      return;
    }

    // A click player without an Audition path previews on the audible line it already has.
    if (key === 'subdivision') {
      player.playSubdivision?.(0, 1.0);
    } else {
      player.play(key === 'downbeat', 0, 1.0);
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

  public onTimeSignatureChange(listener: (ts: TimeSignature) => void): () => void {
    this.timeSignatureListeners.add(listener);
    return () => {
      this.timeSignatureListeners.delete(listener);
    };
  }

  public onPulseFeelChange(listener: (feel: PulseFeel) => void): () => void {
    this.pulseFeelListeners.add(listener);
    return () => {
      this.pulseFeelListeners.delete(listener);
    };
  }

  public async loadDefaultSamples(): Promise<void> {
    const buffers = await this.defaultSampleLoader.loadAll();
    buffers.forEach((buffer, voiceId) => {
      if (voiceId === 'click_downbeat') {
        this.clickPlayer?.loadDefaultSampleBuffer?.('downbeat', buffer);
      } else if (voiceId === 'click_regular') {
        this.clickPlayer?.loadDefaultSampleBuffer?.('regular', buffer);
      } else if (voiceId === 'click_subdivision') {
        this.clickPlayer?.loadDefaultSampleBuffer?.('subdivision', buffer);
      } else {
        this.drumKitPlayer?.loadDefaultSampleBuffer?.(voiceId, buffer);
      }
    });
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

    const activeSystem = this.dawsonEngine?.getSystem?.();
    await this.backgroundAudioService?.onPlaybackStart({
      bpm: this.getTempo(),
      systemName: activeSystem?.name,
    });
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
    this.pendingDrawTimers.forEach((timer) => clearTimeout(timer));
    this.pendingDrawTimers.clear();
    this.playStateListeners.forEach((listener) => listener(false));
    this.backgroundAudioService?.onPlaybackStop?.();
    this.drumKitPlayer?.stopPendingSamples?.();
    this.clickPlayer?.stopPendingSamples?.();

    if (this.lastDropoutState) {
      this.lastDropoutState = false;
      this.dropoutListeners.forEach((listener) => listener(false));
    }
  }

  public dispose(): void {
    this.stop();

    if (this.unsubscribeStorage) {
      this.unsubscribeStorage();
      this.unsubscribeStorage = undefined;
    }

    if (this.unsubscribeDawsonChange) {
      this.unsubscribeDawsonChange();
      this.unsubscribeDawsonChange = undefined;
    }
    this.measurePlan = null;

    (this.clickPlayer as { dispose?: () => void })?.dispose?.();
    // The click voice this scheduler built is gone with the graph: a shell that unmounts and
    // mounts again re-acquires a live one rather than triggering a disposed synth.
    if (!this.injectedClickPlayer) {
      this.clickPlayer = undefined;
    }
    this.drumKitPlayer?.dispose?.();
    this.audioMixer?.dispose?.();

    this.beatListeners.clear();
    this.dropoutListeners.clear();
    this.playStateListeners.clear();
    this.timeSignatureListeners.clear();
    this.pulseFeelListeners.clear();
  }

  private reschedule(): void {
    if (!this.transport || !this.playing) return;
    if (this.scheduledEventId !== null) {
      this.transport.clear(this.scheduledEventId);
      this.scheduledEventId = null;
    }
    // A time signature change reshapes the plan buckets.
    this.measurePlan = null;
    this.scheduleTicks();
  }

  private scheduleTicks(): void {
    if (!this.transport) return;

    // Build the Measure Plan at scheduling gestures only (start, reschedule).
    if (!this.measurePlan) {
      this.buildMeasurePlans();
    }

    const beatInterval = '4n';
    this.scheduledEventId = this.transport.scheduleRepeat((time: number) => {
      const beatEvent = this.engine.nextBeat();

      // Automate dynamic tempo changes to transport bpm during tempo ramp
      if (this.transport && this.transport.bpm.value !== beatEvent.bpm) {
        this.transport.bpm.value = beatEvent.bpm;
      }

      // Nominal pulse length (for Gap Clicks and 4/4 drum events) and actual pulse
      // length (truncated on fractional-remainder final pulses so bars wrap cleanly).
      const secondsPerQuarter = 60 / beatEvent.bpm;
      const nominalDuration = (beatEvent.nominalPulseQuarters ?? 1) * secondsPerQuarter;
      const actualDuration = (beatEvent.pulseDurationQuarters ?? 1) * secondsPerQuarter;

      // Audio click gating: silenced if beat is muted by mask or in dropout mode!
      if (this.clickPlayer && !beatEvent.isMuted) {
        const clickConfig = this.engine.getClickConfig();
        const voiceConfig = beatEvent.isDownbeat
          ? clickConfig.downbeat
          : clickConfig.regular;
        if (!voiceConfig.muted && voiceConfig.volume > 0) {
          this.clickPlayer.play(beatEvent.isDownbeat, time, voiceConfig.volume);
        }

        // Gap clicks: the subdivision voice heard at the even fractions of the nominal
        // pulse, clipped if an offset falls on or past a truncated measure boundary.
        const divisions = Math.max(1, Math.floor(clickConfig.subdivision.divisions ?? 1));
        if (
          this.clickPlayer.playSubdivision &&
          divisions > 1 &&
          !clickConfig.subdivision.muted &&
          clickConfig.subdivision.volume > 0
        ) {
          for (let gap = 1; gap < divisions; gap++) {
            const gapOffset = (gap / divisions) * nominalDuration;
            if (gapOffset < actualDuration - 1e-9) {
              this.clickPlayer.playSubdivision(
                time + gapOffset,
                clickConfig.subdivision.volume
              );
            }
          }
        }
      }

      // Dawson Drum Kit Orchestration & Ostinato Playback: the tick reads the
      // Measure Plan bucket for the beat that arrived. Zero domain math here (docs/adr/0011).
      if (this.dawsonEngine && this.drumKitPlayer) {
        const plan = this.measurePlan ?? [];
        if (plan.length > 0) {
          const beatBuckets = plan[beatEvent.measureIndex % plan.length];
          const b = beatEvent.beatIndex;
          const beatEvents = beatBuckets[b] ?? [];

          for (const drumEvent of beatEvents) {
            const subOffset = drumEvent.timeInMeasure - b;
            const eventTime = time + subOffset * nominalDuration;

            this.drumKitPlayer.play(drumEvent, eventTime);
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

      return actualDuration;
    }, beatInterval);
  }
}
