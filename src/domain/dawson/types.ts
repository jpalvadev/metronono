import { Measure, ReadingLine, RhythmicEvent } from '../rhythm/types';

export type Limb = 'R' | 'L' | 'RF' | 'LF';

export type DrumVoice =
  | 'kick'
  | 'snare'
  | 'snare_ghost'
  | 'tom_high'
  | 'tom_mid'
  | 'tom_floor'
  | 'hihat_closed'
  | 'hihat_open'
  | 'hihat_foot'
  | 'ride'
  | 'ride_bell'
  | 'crash';

export type Dynamic = 'accent' | 'normal' | 'ghost' | 'flam' | 'drag';

export type ChannelSource = 'ostinato' | 'orchestration' | 'click';

export type OstinatoType = 'jazz_swing' | 'straight_rock' | 'none';

export type DawsonMode = 'classic_bop' | 'inverted_bop' | 'straight_rock';

export interface OrchestratedStroke {
  durationRatio: number; // Duration in quarter note fraction (e.g. 0.333 for triplet eighth, 0.5 for eighth)
  voice: DrumVoice;
  limb?: Limb;
  dynamic: Dynamic;
}

export interface SubdivisionFormula {
  id: string;
  name: string;
  trigger: 'short' | 'long';
  strokes: OrchestratedStroke[];
}

export interface DawsonSystem {
  id: string;
  name: string;
  shortFormula: SubdivisionFormula;
  longFormula: SubdivisionFormula;
  ostinatoId: OstinatoType;
}

export interface ScheduledDrumEvent {
  timeInMeasure: number; // 0.0 to 4.0 in 4/4 time
  voice: DrumVoice;
  velocity: number; // 0.0 to 1.0
  dynamic: Dynamic;
  source: 'ostinato' | 'orchestration';
  measureIndex?: number;
  durationBeats?: number;
}

export interface DawsonEngineOptions {
  mode?: DawsonMode;
  ostinato?: OstinatoType;
}

export type { Measure, ReadingLine, RhythmicEvent };
