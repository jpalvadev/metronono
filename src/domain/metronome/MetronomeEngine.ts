export interface TimeSignature {
  beats: number;
  beatUnit: number;
}

export interface BeatEvent {
  beatIndex: number;
  isDownbeat: boolean;
  beatsPerMeasure: number;
}

export class MetronomeEngine {
  public static readonly MIN_BPM = 30;
  public static readonly MAX_BPM = 300;
  public static readonly DEFAULT_BPM = 120;
  public static readonly TAP_TIMEOUT_MS = 2000;
  public static readonly MAX_TAP_SAMPLES = 8;

  private tempo: number = MetronomeEngine.DEFAULT_BPM;
  private timeSignature: TimeSignature = { beats: 4, beatUnit: 4 };
  private currentBeatIndex: number = -1;
  private tapTimestamps: number[] = [];

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
  }

  public reset(): void {
    this.currentBeatIndex = -1;
  }

  public nextBeat(): BeatEvent {
    this.currentBeatIndex = (this.currentBeatIndex + 1) % this.timeSignature.beats;
    return {
      beatIndex: this.currentBeatIndex,
      isDownbeat: this.currentBeatIndex === 0,
      beatsPerMeasure: this.timeSignature.beats,
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
