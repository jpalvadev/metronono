import { Measure, ReadingLine, RhythmicEvent } from '../rhythm/types';

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

export interface DrumHit {
  voice: DrumVoice;
  dynamic: Dynamic;
}

export interface OrchestratedStroke {
  durationRatio: number; // Duration in quarter note fraction (e.g. 0.1667 for 1/16 triplet, 0.25 for 1/16th, 0.3333 for 1/8 triplet, 0.5 for 1/8th, 1.0 for quarter)
  isRest?: boolean;
  hits: DrumHit[];
}

export interface SubdivisionFormula {
  id: string;
  name: string;
  trigger: 'short' | 'long';
  strokes: OrchestratedStroke[];
  description?: string;
  isCustom?: boolean;
}

export interface DawsonSystem {
  id: string;
  name: string;
  shortFormula: SubdivisionFormula;
  longFormula: SubdivisionFormula;
  ostinatoId: OstinatoType;
  description?: string;
  isCustom?: boolean;
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
  system?: DawsonSystem;
  shortFormula?: SubdivisionFormula;
  longFormula?: SubdivisionFormula;
}

export type { Measure, ReadingLine, RhythmicEvent };
