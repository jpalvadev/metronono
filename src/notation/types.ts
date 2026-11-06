export interface ScorePadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface ScoreRenderOptions {
  width?: number;
  measuresPerSystem?: number;
  staveHeight?: number;
  staveSpacing?: number;
  padding?: ScorePadding;
  showMeasureNumbers?: boolean;
}

export interface EventCoordinate {
  eventId: string;
  measureIndex: number;
  eventIndex: number;
  beatOffset: number; // 0.0 to 4.0 in 4/4
  durationBeats: number;
  x: number;
  y: number;
  isRest: boolean;
}

export interface MeasureCoordinate {
  measureIndex: number;
  systemIndex: number;
  measureInSystem: number;
  x: number;
  y: number;
  width: number;
  height: number;
  noteStartX: number;
  noteEndX: number;
  eventCoordinates: readonly EventCoordinate[];
}

export interface PlayheadPosition {
  x: number;
  y: number;
  height: number;
  systemIndex: number;
  measureIndex: number;
  beatOffset: number;
}

export interface ScoreLayout {
  totalWidth: number;
  totalHeight: number;
  systemCount: number;
  measuresPerSystem: number;
  measures: readonly MeasureCoordinate[];
  getPlayheadPosition(measureIndex: number, beatOffset: number): PlayheadPosition | null;
  getMeasureCoordinate(measureIndex: number): MeasureCoordinate | undefined;
}
