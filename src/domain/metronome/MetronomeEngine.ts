export interface TimeSignature {
  beats: number;
  beatUnit: number;
}

export interface BeatEvent {
  beatIndex: number;
  isDownbeat: boolean;
  beatsPerMeasure: number;
  measureIndex: number;
  isMuted: boolean;
  isDropout: boolean;
  bpm: number;
}

export interface ClickVoiceConfig {
  pitch: string;
  volume: number;
}

// The subdivision voice also carries the Gap Clicks count: how many equal parts each
// beat is split into. One part means only the beat click, so no gap clicks.
export interface SubdivisionVoiceConfig {
  pitch: string;
  volume: number;
  divisions: number;
}

export interface MetronomeClickConfig {
  downbeat: ClickVoiceConfig;
  regular: ClickVoiceConfig;
  subdivision: SubdivisionVoiceConfig;
}

export interface TempoRampConfig {
  enabled: boolean;
  startBpm: number;
  targetBpm: number;
  durationBars: number;
}

export interface DropoutConfig {
  enabled: boolean;
  probability: number;
  seed?: number;
}

// A whole-number division count within the supported range; anything unusable
// falls back to one part, which means no gap clicks.
function clampBeatDivisions(value: number): number {
  if (!Number.isFinite(value)) {
    return MetronomeEngine.MIN_BEAT_DIVISIONS;
  }
  return Math.max(
    MetronomeEngine.MIN_BEAT_DIVISIONS,
    Math.min(MetronomeEngine.MAX_BEAT_DIVISIONS, Math.round(value))
  );
}

export class MetronomeEngine {
  public static readonly MIN_BPM = 30;
  public static readonly MAX_BPM = 300;
  public static readonly DEFAULT_BPM = 120;
  public static readonly TAP_TIMEOUT_MS = 2000;
  public static readonly MAX_TAP_SAMPLES = 8;
  // Gap Clicks: the division count of the subdivision voice. One part is the beat click
  // alone, so no gap clicks; eight is the widest split a beat is ever clicked into.
  public static readonly MIN_BEAT_DIVISIONS = 1;
  public static readonly MAX_BEAT_DIVISIONS = 8;

  private tempo: number = MetronomeEngine.DEFAULT_BPM;
  private timeSignature: TimeSignature = { beats: 4, beatUnit: 4 };
  private currentBeatIndex: number = -1;
  private currentMeasureIndex: number = -1;
  private tapTimestamps: number[] = [];

  private beatMask: boolean[] = [true, true, true, true];

  private clickConfig: MetronomeClickConfig = {
    downbeat: { pitch: 'A6', volume: 1.0 },
    regular: { pitch: 'E5', volume: 0.7 },
    subdivision: { pitch: 'C5', volume: 0.5, divisions: MetronomeEngine.MIN_BEAT_DIVISIONS },
  };

  private rampConfig: TempoRampConfig = {
    enabled: false,
    startBpm: 120,
    targetBpm: 160,
    durationBars: 4,
  };

  private dropoutConfig: DropoutConfig = {
    enabled: false,
    probability: 0.25,
  };

  private measureDropoutMap: Map<number, boolean> = new Map();

  constructor(
    initialTempo: number = MetronomeEngine.DEFAULT_BPM,
    initialTimeSignature: TimeSignature | string = { beats: 4, beatUnit: 4 }
  ) {
    this.setTempo(initialTempo);
    this.setTimeSignature(initialTimeSignature);
  }

  public getTempo(): number {
    return this.tempo;
  }

  public setTempo(bpm: number): void {
    const rounded = Math.round(bpm);
    this.tempo = Math.max(MetronomeEngine.MIN_BPM, Math.min(MetronomeEngine.MAX_BPM, rounded));
  }

  public getTimeSignature(): TimeSignature {
    return { ...this.timeSignature };
  }

  public setTimeSignature(ts: TimeSignature | string): void {
    if (typeof ts === 'string') {
      const parts = ts.split('/').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
        this.timeSignature = { beats: parts[0], beatUnit: parts[1] };
      }
    } else if (ts && typeof ts.beats === 'number' && typeof ts.beatUnit === 'number') {
      this.timeSignature = { ...ts };
    }

    const newBeats = this.timeSignature.beats;
    if (this.beatMask.length !== newBeats) {
      const newMask: boolean[] = [];
      for (let i = 0; i < newBeats; i++) {
        newMask.push(this.beatMask[i] ?? true);
      }
      this.beatMask = newMask;
    }
  }

  // Beat Mask / Mute per beat
  public getBeatMask(): boolean[] {
    return [...this.beatMask];
  }

  public setBeatMask(mask: boolean[]): void {
    this.beatMask = mask.slice(0, this.timeSignature.beats);
    while (this.beatMask.length < this.timeSignature.beats) {
      this.beatMask.push(true);
    }
  }

  public toggleBeat(beatIndex: number): void {
    if (beatIndex >= 0 && beatIndex < this.beatMask.length) {
      this.beatMask[beatIndex] = !this.beatMask[beatIndex];
    }
  }

  public isBeatActive(beatIndex: number): boolean {
    return this.beatMask[beatIndex] ?? true;
  }

  // Click Sound & Accent Configuration
  public getClickConfig(): MetronomeClickConfig {
    return {
      downbeat: { ...this.clickConfig.downbeat },
      regular: { ...this.clickConfig.regular },
      subdivision: { ...this.clickConfig.subdivision },
    };
  }

  public setClickConfig(config: {
    downbeat?: Partial<ClickVoiceConfig>;
    regular?: Partial<ClickVoiceConfig>;
    subdivision?: Partial<SubdivisionVoiceConfig>;
  }): void {
    if (config.downbeat) {
      this.clickConfig.downbeat = { ...this.clickConfig.downbeat, ...config.downbeat };
    }
    if (config.regular) {
      this.clickConfig.regular = { ...this.clickConfig.regular, ...config.regular };
    }
    if (config.subdivision) {
      const subdivision = { ...this.clickConfig.subdivision, ...config.subdivision };
      subdivision.divisions = clampBeatDivisions(subdivision.divisions);
      this.clickConfig.subdivision = subdivision;
    }
  }

  public updateVoiceConfig(
    type: 'downbeat' | 'regular' | 'subdivision',
    config: Partial<ClickVoiceConfig & SubdivisionVoiceConfig>
  ): void {
    if (type === 'subdivision') {
      const subdivision = { ...this.clickConfig.subdivision, ...config };
      subdivision.divisions = clampBeatDivisions(subdivision.divisions);
      this.clickConfig.subdivision = subdivision;
    } else {
      this.clickConfig[type] = { ...this.clickConfig[type], ...config };
    }
  }

  // Tempo Ramp
  public getTempoRampConfig(): TempoRampConfig {
    return { ...this.rampConfig };
  }

  public setTempoRampConfig(config: Partial<TempoRampConfig>): void {
    this.rampConfig = {
      ...this.rampConfig,
      ...config,
    };
  }

  public calculateRampBpm(measureIndex: number, beatIndex: number = 0): number {
    if (!this.rampConfig.enabled || measureIndex < 0) {
      return this.tempo;
    }
    const beatsPerBar = this.timeSignature.beats;
    const totalBeats = this.rampConfig.durationBars * beatsPerBar;
    if (totalBeats <= 0) {
      return this.rampConfig.targetBpm;
    }
    const currentBeat = measureIndex * beatsPerBar + beatIndex;
    if (currentBeat >= totalBeats) {
      return this.rampConfig.targetBpm;
    }
    const progress = currentBeat / totalBeats;
    const interpolated = this.rampConfig.startBpm + (this.rampConfig.targetBpm - this.rampConfig.startBpm) * progress;
    return Math.round(Math.max(MetronomeEngine.MIN_BPM, Math.min(MetronomeEngine.MAX_BPM, interpolated)));
  }

  public getRampProgress(measureIndex: number, beatIndex: number = 0): {
    progress: number;
    currentBpm: number;
    isComplete: boolean;
  } {
    const beatsPerBar = this.timeSignature.beats;
    const totalBeats = Math.max(1, this.rampConfig.durationBars * beatsPerBar);
    const currentBeat = Math.max(0, measureIndex * beatsPerBar + beatIndex);
    const progress = Math.min(1, currentBeat / totalBeats);
    const currentBpm = this.calculateRampBpm(measureIndex, beatIndex);
    return {
      progress,
      currentBpm,
      isComplete: currentBeat >= totalBeats,
    };
  }

  // Stochastic Dropout
  public getDropoutConfig(): DropoutConfig {
    return { ...this.dropoutConfig };
  }

  public setDropoutConfig(config: Partial<DropoutConfig>): void {
    this.dropoutConfig = {
      ...this.dropoutConfig,
      ...config,
    };
  }

  public setDropoutSeed(seed: number | undefined): void {
    this.dropoutConfig.seed = seed;
  }

  public shouldMuteMeasure(measureIndex: number, seed?: number): boolean {
    if (!this.dropoutConfig.enabled || this.dropoutConfig.probability <= 0) {
      return false;
    }
    if (this.dropoutConfig.probability >= 1) {
      return true;
    }
    if (measureIndex < 0) {
      return false;
    }
    const effectiveSeed = seed !== undefined ? seed : this.dropoutConfig.seed;
    if (effectiveSeed !== undefined) {
      let h = ((measureIndex + 1) * 0x45d9f3b ^ (effectiveSeed + 1) * 0x119de1f3) >>> 0;
      h = ((h >>> 16) ^ h) * 0x45d9f3b;
      h = ((h >>> 16) ^ h) * 0x45d9f3b;
      h = (h >>> 16) ^ h;
      const rand = (h >>> 0) / 4294967296;
      return rand < this.dropoutConfig.probability;
    }
    if (this.measureDropoutMap.has(measureIndex)) {
      return this.measureDropoutMap.get(measureIndex)!;
    }
    const muted = Math.random() < this.dropoutConfig.probability;
    this.measureDropoutMap.set(measureIndex, muted);
    return muted;
  }

  public reset(): void {
    this.currentBeatIndex = -1;
    this.currentMeasureIndex = -1;
    this.measureDropoutMap.clear();
  }

  public nextBeat(): BeatEvent {
    if (this.currentBeatIndex === -1) {
      this.currentMeasureIndex = 0;
      this.currentBeatIndex = 0;
    } else {
      this.currentBeatIndex++;
      if (this.currentBeatIndex >= this.timeSignature.beats) {
        this.currentBeatIndex = 0;
        this.currentMeasureIndex++;
      }
    }

    if (this.rampConfig.enabled) {
      const rampBpm = this.calculateRampBpm(this.currentMeasureIndex, this.currentBeatIndex);
      this.tempo = rampBpm;
    }

    const isDropout = this.shouldMuteMeasure(this.currentMeasureIndex);
    const isBeatActive = this.beatMask[this.currentBeatIndex] ?? true;
    const isMuted = !isBeatActive || isDropout;

    return {
      beatIndex: this.currentBeatIndex,
      isDownbeat: this.currentBeatIndex === 0,
      beatsPerMeasure: this.timeSignature.beats,
      measureIndex: this.currentMeasureIndex,
      isMuted,
      isDropout,
      bpm: this.tempo,
    };
  }

  public resetTap(): void {
    this.tapTimestamps = [];
  }

  public tap(timestampMs: number = Date.now()): number | null {
    if (this.tapTimestamps.length > 0) {
      const lastTap = this.tapTimestamps[this.tapTimestamps.length - 1];
      const interval = timestampMs - lastTap;
      if (interval > MetronomeEngine.TAP_TIMEOUT_MS) {
        this.tapTimestamps = [];
      }
    }

    this.tapTimestamps.push(timestampMs);

    if (this.tapTimestamps.length > MetronomeEngine.MAX_TAP_SAMPLES) {
      this.tapTimestamps.shift();
    }

    if (this.tapTimestamps.length < 2) {
      return null;
    }

    const intervals: number[] = [];
    for (let i = 1; i < this.tapTimestamps.length; i++) {
      intervals.push(this.tapTimestamps[i] - this.tapTimestamps[i - 1]);
    }

    const averageInterval = intervals.reduce((sum, curr) => sum + curr, 0) / intervals.length;
    if (averageInterval <= 0) {
      return null;
    }

    const rawBpm = 60000 / averageInterval;
    this.setTempo(rawBpm);
    return this.tempo;
  }
}
