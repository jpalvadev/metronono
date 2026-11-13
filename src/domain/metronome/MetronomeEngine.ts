export type PulseFeel = 'straight' | 'triplet';

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
  pulseDurationQuarters?: number;
  nominalPulseQuarters?: number;
}

export interface ClickVoiceConfig {
  volume: number;
  muted: boolean;
}

// The subdivision voice also carries the Gap Clicks count: how many equal parts each
// beat is split into. One part means only the beat click, so no gap clicks.
export interface SubdivisionVoiceConfig {
  volume: number;
  muted: boolean;
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
  clickBars: number;
  silentBars: number;
  seed?: number;
}

// The one voice mix a fresh Metronome starts with: a bright downbeat, a softer
// regular beat, and a quiet subdivision voice held undivided until a drummer
// asks for gap clicks. Shared so a click player built without a config agrees.
export function createDefaultClickConfig(): MetronomeClickConfig {
  return {
    downbeat: { volume: 1.0, muted: false },
    regular: { volume: 0.7, muted: false },
    subdivision: { volume: 0.5, muted: false, divisions: 1 },
  };
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

function clampDropoutBars(value: number): number {
  if (!Number.isFinite(value)) {
    return MetronomeEngine.MIN_DROPOUT_BARS;
  }
  return Math.max(
    MetronomeEngine.MIN_DROPOUT_BARS,
    Math.min(MetronomeEngine.MAX_DROPOUT_BARS, Math.round(value))
  );
}

function clampBpmValue(value: number): number {
  if (!Number.isFinite(value)) {
    return MetronomeEngine.DEFAULT_BPM;
  }
  return Math.max(
    MetronomeEngine.MIN_BPM,
    Math.min(MetronomeEngine.MAX_BPM, Math.round(value))
  );
}

function clampRampBars(value: number): number {
  if (!Number.isFinite(value)) {
    return MetronomeEngine.MIN_RAMP_BARS;
  }
  return Math.max(
    MetronomeEngine.MIN_RAMP_BARS,
    Math.min(MetronomeEngine.MAX_RAMP_BARS, Math.round(value))
  );
}

export class MetronomeEngine {
  public static readonly MIN_BPM = 30;
  public static readonly MAX_BPM = 300;
  public static readonly DEFAULT_BPM = 120;
  public static readonly MIN_BEATS = 1;
  public static readonly MAX_BEATS = 32;
  public static readonly VALID_BEAT_UNITS = [2, 4, 8, 16] as const;
  public static readonly TAP_TIMEOUT_MS = 2000;
  public static readonly MAX_TAP_SAMPLES = 8;
  // Gap Clicks: the division count of the subdivision voice. One part is the beat click
  // alone, so no gap clicks; eight is the widest split a beat is ever clicked into.
  public static readonly MIN_BEAT_DIVISIONS = 1;
  public static readonly MAX_BEAT_DIVISIONS = 8;
  public static readonly MIN_DROPOUT_BARS = 0;
  public static readonly MAX_DROPOUT_BARS = 32;
  public static readonly MIN_RAMP_BARS = 1;
  public static readonly MAX_RAMP_BARS = 64;

  private tempo: number = MetronomeEngine.DEFAULT_BPM;
  private timeSignature: TimeSignature = { beats: 4, beatUnit: 4 };
  private pulseFeel: PulseFeel = 'straight';
  private currentBeatIndex: number = -1;
  private currentMeasureIndex: number = -1;
  private tapTimestamps: number[] = [];

  private beatMask: boolean[] = [true, true, true, true];

  private clickConfig: MetronomeClickConfig = createDefaultClickConfig();
  private clickConfigListeners: Set<(config: MetronomeClickConfig) => void> = new Set();

  private rampConfig: TempoRampConfig = {
    enabled: false,
    startBpm: 120,
    targetBpm: 160,
    durationBars: 4,
  };
  private preRampTempo: number | null = null;

  private dropoutConfig: DropoutConfig = {
    enabled: false,
    probability: 0.25,
    clickBars: 0,
    silentBars: 0,
  };

  private measureDropoutMap: Map<number, boolean> = new Map();
  private dropoutCycleAnchorMeasure: number = 0;

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
    let nextBeats: number | null = null;
    let nextUnit: number | null = null;

    if (typeof ts === 'string') {
      const parts = ts.split('/').map(Number);
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        nextBeats = parts[0];
        nextUnit = parts[1];
      }
    } else if (ts && typeof ts.beats === 'number' && typeof ts.beatUnit === 'number') {
      nextBeats = ts.beats;
      nextUnit = ts.beatUnit;
    }

    if (nextBeats !== null && Number.isFinite(nextBeats)) {
      const clampedBeats = Math.max(
        MetronomeEngine.MIN_BEATS,
        Math.min(MetronomeEngine.MAX_BEATS, Math.round(nextBeats))
      );
      const validUnit =
        nextUnit !== null &&
        (MetronomeEngine.VALID_BEAT_UNITS as readonly number[]).includes(nextUnit)
          ? nextUnit
          : this.timeSignature.beatUnit;

      this.timeSignature = { beats: clampedBeats, beatUnit: validUnit };
    }

    this.resizeBeatMask();
  }

  private resizeBeatMask(): void {
    const targetCount = this.getPulsesPerMeasure();
    if (this.beatMask.length !== targetCount) {
      const newMask: boolean[] = [];
      for (let i = 0; i < targetCount; i++) {
        newMask.push(this.beatMask[i] ?? true);
      }
      this.beatMask = newMask;
    }
  }

  public getPulseFeel(): PulseFeel {
    return this.pulseFeel;
  }

  public setPulseFeel(feel: PulseFeel): void {
    this.pulseFeel = feel === 'triplet' ? 'triplet' : 'straight';
    this.resizeBeatMask();
  }

  public getMeasureQuarterNotes(): number {
    return this.timeSignature.beats * (4 / this.timeSignature.beatUnit);
  }

  public getPulseQuarterNotes(): number {
    return this.pulseFeel === 'triplet' ? 1.5 : 1.0;
  }

  public getPulsesPerMeasure(): number {
    const measureQuarters = this.getMeasureQuarterNotes();
    const pulseQuarters = this.getPulseQuarterNotes();
    return Math.max(1, Math.ceil((measureQuarters - 1e-9) / pulseQuarters));
  }

  public getPulseDurationQuarters(pulseIndex: number): number {
    const measureQuarters = this.getMeasureQuarterNotes();
    const nominal = this.getPulseQuarterNotes();
    const remaining = measureQuarters - pulseIndex * nominal;
    return Math.max(0, Math.min(nominal, remaining));
  }

  // Beat Mask / Mute per beat
  public getBeatMask(): boolean[] {
    return [...this.beatMask];
  }

  public setBeatMask(mask: boolean[]): void {
    const targetCount = this.getPulsesPerMeasure();
    this.beatMask = mask.slice(0, targetCount);
    while (this.beatMask.length < targetCount) {
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
  public onClickConfigChange(listener: (config: MetronomeClickConfig) => void): () => void {
    this.clickConfigListeners.add(listener);
    return () => {
      this.clickConfigListeners.delete(listener);
    };
  }

  private notifyClickConfigChange(): void {
    const snapshot = this.getClickConfig();
    this.clickConfigListeners.forEach((listener) => listener(snapshot));
  }

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
    this.notifyClickConfigChange();
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
    this.notifyClickConfigChange();
  }

  // Tempo Ramp
  public getTempoRampConfig(): TempoRampConfig {
    return { ...this.rampConfig };
  }

  public setTempoRampConfig(config: Partial<TempoRampConfig>): void {
    const wasEnabled = this.rampConfig.enabled;
    this.rampConfig = {
      ...this.rampConfig,
      ...config,
      ...(config.startBpm !== undefined ? { startBpm: clampBpmValue(config.startBpm) } : {}),
      ...(config.targetBpm !== undefined ? { targetBpm: clampBpmValue(config.targetBpm) } : {}),
      ...(config.durationBars !== undefined ? { durationBars: clampRampBars(config.durationBars) } : {}),
    };

    if (!wasEnabled && this.rampConfig.enabled) {
      this.preRampTempo = this.tempo;
    } else if (wasEnabled && !this.rampConfig.enabled && this.preRampTempo !== null) {
      this.tempo = this.preRampTempo;
      this.preRampTempo = null;
    }
  }

  public calculateRampBpm(measureIndex: number, beatIndex: number = 0): number {
    if (!this.rampConfig.enabled || measureIndex < 0) {
      return this.tempo;
    }
    const beatsPerBar = this.getPulsesPerMeasure();
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
    const beatsPerBar = this.getPulsesPerMeasure();
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
    const nextClickBars =
      config.clickBars !== undefined
        ? clampDropoutBars(config.clickBars)
        : this.dropoutConfig.clickBars;
    const nextSilentBars =
      config.silentBars !== undefined
        ? clampDropoutBars(config.silentBars)
        : this.dropoutConfig.silentBars;

    if (
      nextClickBars !== this.dropoutConfig.clickBars ||
      nextSilentBars !== this.dropoutConfig.silentBars
    ) {
      this.dropoutCycleAnchorMeasure = Math.max(0, this.currentMeasureIndex);
      if (nextClickBars === 0 && nextSilentBars === 0) {
        this.measureDropoutMap.clear();
      }
    }

    this.dropoutConfig = {
      ...this.dropoutConfig,
      ...config,
      clickBars: nextClickBars,
      silentBars: nextSilentBars,
    };
  }

  public setDropoutSeed(seed: number | undefined): void {
    this.dropoutConfig.seed = seed;
  }

  public shouldMuteMeasure(measureIndex: number, seed?: number): boolean {
    if (!this.dropoutConfig.enabled || measureIndex < 0) {
      return false;
    }
    const { clickBars, silentBars } = this.dropoutConfig;
    if (clickBars > 0 || silentBars > 0) {
      const cycleLength = clickBars + silentBars;
      const offsetMeasure = measureIndex - this.dropoutCycleAnchorMeasure;
      const cyclePosition = ((offsetMeasure % cycleLength) + cycleLength) % cycleLength;
      return cyclePosition >= clickBars;
    }
    if (this.dropoutConfig.probability <= 0) {
      return false;
    }
    if (this.dropoutConfig.probability >= 1) {
      return true;
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
    this.dropoutCycleAnchorMeasure = 0;
  }

  public nextBeat(): BeatEvent {
    const pulsesPerMeasure = this.getPulsesPerMeasure();
    if (this.currentBeatIndex === -1) {
      this.currentMeasureIndex = 0;
      this.currentBeatIndex = 0;
    } else {
      this.currentBeatIndex++;
      if (this.currentBeatIndex >= pulsesPerMeasure) {
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
      beatsPerMeasure: pulsesPerMeasure,
      measureIndex: this.currentMeasureIndex,
      isMuted,
      isDropout,
      bpm: this.tempo,
      pulseDurationQuarters: this.getPulseDurationQuarters(this.currentBeatIndex),
      nominalPulseQuarters: this.getPulseQuarterNotes(),
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
