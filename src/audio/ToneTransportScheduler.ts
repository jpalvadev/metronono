import * as Tone from 'tone';
import {
  MetronomeEngine,
  BeatEvent,
  TimeSignature,
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
import { AudioMixer } from './AudioMixer';
import { DrumKitPlayer } from './DrumKitPlayer';
import { DawsonEngine } from '../domain/dawson/DawsonEngine';
import { Measure, ReadingLine, createRhythmicEvent } from '../domain/rhythm/types';
import { BackgroundAudioService } from './BackgroundAudioService';
import { ScheduledDrumEvent } from '../domain/dawson/types';

// Names every node of the audio graph carries, so a test can follow a sound from the voice
// that made it to the audio destination through its Mixing Channel.
function labelNode<T>(node: T, label: string): T {
  (node as { label?: string }).label = label;
  return node;
}

type ClickVoiceKey = 'downbeat' | 'regular' | 'subdivision';

export class ToneClickPlayer implements IClickPlayer {
  private mixVoices: Record<ClickVoiceKey, Tone.Synth>;
  private auditionVoices: Record<ClickVoiceKey, Tone.Synth>;
  private clickConfig: MetronomeClickConfig;
  // The Click Mixing Channel node every scheduled click is heard through, and the Audition
  // node Click shares, which a preview tap is heard through instead.
  private outputNode?: Tone.ToneAudioNode;
  private auditionNode?: Tone.ToneAudioNode;
  private customBuffers: Map<ClickVoiceKey, any> = new Map();
  // One pooled Gain per sample voice and mode instead of a fresh Gain per stroke,
  // and pending BufferSources retired once their playback window elapsed.
  private sampleGains: Map<string, Tone.Gain> = new Map();
  private pendingSampleSources: { source: Tone.ToneBufferSource; endsAt: number }[] = [];

  constructor(
    outputNode: Tone.ToneAudioNode,
    auditionNode: Tone.ToneAudioNode,
    initialConfig?: MetronomeClickConfig
  ) {
    this.outputNode = outputNode;
    this.auditionNode = auditionNode;
    this.clickConfig = initialConfig ?? createDefaultClickConfig();

    this.mixVoices = {
      downbeat: this.buildVoice('downbeat', outputNode, 'click:downbeat'),
      regular: this.buildVoice('regular', outputNode, 'click:regular'),
      subdivision: this.buildVoice('subdivision', outputNode, 'click:subdivision'),
    };

    // A second, identical set wired onto the Audition node: previewing a voice on a muted
    // Click Channel is still heard, at the volume the Click slider holds.
    this.auditionVoices = {
      downbeat: this.buildVoice('downbeat', auditionNode, 'click:audition:downbeat'),
      regular: this.buildVoice('regular', auditionNode, 'click:audition:regular'),
      subdivision: this.buildVoice('subdivision', auditionNode, 'click:audition:subdivision'),
    };
  }

  private buildVoice(
    key: ClickVoiceKey,
    destination: Tone.ToneAudioNode,
    label: string
  ): Tone.Synth {
    const voice = labelNode(
      new Tone.Synth({
        oscillator: { type: key === 'regular' ? 'sine' : 'triangle' },
        envelope: {
          attack: 0.001,
          decay: key === 'downbeat' ? 0.04 : key === 'regular' ? 0.03 : 0.02,
          sustain: 0,
          release: key === 'downbeat' ? 0.02 : key === 'regular' ? 0.02 : 0.01,
        },
      }),
      label
    );
    voice.connect(destination);
    return voice as unknown as Tone.Synth;
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

  public loadSampleBuffer(voice: ClickVoiceKey, buffer: any): void {
    this.disposeClickSampleGains(voice);
    this.customBuffers.set(voice, buffer);
  }

  public removeSampleBuffer(voice: ClickVoiceKey): void {
    this.customBuffers.delete(voice);
    this.disposeClickSampleGains(voice);
  }

  private disposeClickSampleGains(voice: ClickVoiceKey): void {
    for (const mode of ['mix', 'audition'] as ('mix' | 'audition')[]) {
      const gain = this.sampleGains.get(`${voice}:${mode}`);
      if (!gain) continue;
      try {
        gain.dispose();
      } catch {
        // Safe disposal
      }
      this.sampleGains.delete(`${voice}:${mode}`);
    }
  }

  public hasCustomSample(voice: ClickVoiceKey): boolean {
    return this.customBuffers.has(voice);
  }

  private playCustomSample(
    voice: ClickVoiceKey,
    buffer: any,
    time: number,
    velocity: number,
    mode: 'mix' | 'audition'
  ): void {
    try {
      const audioTime = time > 0 ? time : Tone.now();
      // Only retire sources whose playback window has actually elapsed on the hardware clock
      // (context.currentTime), never at Tone.now() or the future lookahead audioTime (both
      // include lookAhead), or dispose() will disconnect still-playing .wav samples.
      const hardwareNow = Tone.getContext?.()?.currentTime ?? Tone.now();
      this.retirePendingSamples(Math.min(audioTime, hardwareNow));

      const poolKey = `${voice}:${mode}`;
      let gain = this.sampleGains.get(poolKey);
      if (!gain) {
        gain = labelNode(
          new Tone.Gain(),
          mode === 'audition' ? 'click-sample-audition-gain' : 'click-sample-gain'
        );
        const destination = mode === 'audition' ? this.auditionNode : this.outputNode;
        if (destination) {
          gain.connect(destination);
        }
        this.sampleGains.set(poolKey, gain);
      }
      // Per-stroke dynamics live as a timed write on the pooled gain.
      gain.gain.setValueAtTime(velocity, audioTime);

      const bufferSource = new Tone.ToneBufferSource(buffer);
      bufferSource.connect(gain as unknown as Tone.ToneAudioNode);
      bufferSource.start(audioTime);
      const duration = (buffer as { duration?: number }).duration ?? 1;
      this.pendingSampleSources.push({ source: bufferSource, endsAt: audioTime + duration });
    } catch {
      // Safe isolation
    }
  }

  private retirePendingSamples(now: number): void {
    this.pendingSampleSources = this.pendingSampleSources.filter(
      (pending) => {
        if (pending.endsAt > now) return true;
        try {
          // Tone's accurate-timing contract: a source retired from inside a scheduled
          // callback stops at the scheduling time it was heard at, never at Tone.now().
          if (Number.isFinite(now)) pending.source.stop(now);
          else pending.source.stop();
          pending.source.dispose();
        } catch {
          // Safe disposal
        }
        return false;
      }
    );
  }

  /** Stop leaves nothing waiting to sound behind the mixer. */
  public stopPendingSamples(): void {
    this.retirePendingSamples(Number.POSITIVE_INFINITY);
  }

  private playVoice(key: ClickVoiceKey, time: number, velocity?: number, pitch?: string): void {
    const custom = this.customBuffers.get(key);
    if (custom) {
      const v = velocity ?? this.clickConfig[key].volume;
      this.playCustomSample(key, custom, time, v, 'mix');
      return;
    }

    const voice = this.mixVoices[key];
    voice.triggerAttackRelease(
      pitch ?? this.clickConfig[key].pitch,
      '32n',
      time,
      velocity ?? this.clickConfig[key].volume
    );
  }

  public play(isDownbeat: boolean, time: number, velocity?: number, pitch?: string): void {
    this.playVoice(isDownbeat ? 'downbeat' : 'regular', time, velocity, pitch);
  }

  public playSubdivision(time: number, velocity?: number, pitch?: string): void {
    this.playVoice('subdivision', time, velocity, pitch);
  }

  /** A preview tap: heard through the Audition node Click shares, never through its mute. */
  public audition(voice: ClickVoiceKey, time = 0, velocity = 1.0): void {
    const custom = this.customBuffers.get(voice);
    if (custom) {
      this.playCustomSample(voice, custom, time, velocity, 'audition');
      return;
    }

    const auditionVoice = this.auditionVoices[voice];
    auditionVoice.triggerAttackRelease(
      this.clickConfig[voice].pitch,
      '32n',
      time,
      velocity * this.clickConfig[voice].volume
    );
  }

  public dispose(): void {
    this.customBuffers.clear();
    this.retirePendingSamples(Number.POSITIVE_INFINITY);
    this.sampleGains.forEach((gain) => {
      try {
        gain.dispose();
      } catch {
        // Safe disposal
      }
    });
    this.sampleGains.clear();
    for (const voice of Object.values(this.mixVoices)) {
      voice.dispose();
    }
    for (const voice of Object.values(this.auditionVoices)) {
      voice.dispose();
    }
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
          this.audioMixer.getChannelNode('click') as unknown as Tone.ToneAudioNode,
          this.audioMixer.getAuditionNode('click') as unknown as Tone.ToneAudioNode,
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
    if (!this.dawsonEngine) {
      this.measurePlan = null;
      return;
    }
    const engine = this.dawsonEngine;

    const beats = Math.max(1, Math.floor(this.engine.getTimeSignature().beats));
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

  // Lazy acquisition of the Tone transport and audio clock (retryable)
  private async ensureInitialized(): Promise<{
    transport: IAudioClockTransport;
    clickPlayer?: IClickPlayer;
    drawSync: DrawSyncFn;
  }> {
    // An audio context that was not ready at construction may be ready now.
    this.buildAudioGraph();

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
    return this.audioMixer;
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

    const beatInterval = `${this.engine.getTimeSignature().beatUnit}n`;
    this.scheduledEventId = this.transport.scheduleRepeat((time: number) => {
      const beatEvent = this.engine.nextBeat();

      // Automate dynamic tempo changes to transport bpm during tempo ramp
      if (this.transport && this.transport.bpm.value !== beatEvent.bpm) {
        this.transport.bpm.value = beatEvent.bpm;
      }

      // A beat's length at the tempo this beat arrived at, shared by the gap clicks
      // and the drum events so both land on the same audio-clock instant.
      const beatDuration = 60 / beatEvent.bpm;

      // Audio click gating: silenced if beat is muted by mask or in dropout mode!
      if (this.clickPlayer && !beatEvent.isMuted) {
        const clickConfig = this.engine.getClickConfig();
        const voiceConfig = beatEvent.isDownbeat
          ? clickConfig.downbeat
          : clickConfig.regular;
        this.clickPlayer.play(beatEvent.isDownbeat, time, voiceConfig.volume, voiceConfig.pitch);

        // Gap clicks: the subdivision voice heard at the even fractions of the beat,
        // splitting it into parts. One part means the beat click alone.
        const divisions = Math.max(1, Math.floor(clickConfig.subdivision.divisions ?? 1));
        if (this.clickPlayer.playSubdivision && divisions > 1) {
          for (let gap = 1; gap < divisions; gap++) {
            this.clickPlayer.playSubdivision(
              time + (gap / divisions) * beatDuration,
              clickConfig.subdivision.volume,
              clickConfig.subdivision.pitch
            );
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
            const eventTime = time + subOffset * beatDuration;

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
    }, beatInterval);
  }
}
