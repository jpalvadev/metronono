import VexFlow, {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Beam,
  Tuplet,
  Stem,
  Articulation,
} from 'vexflow';
import { DrumVoice, OrchestratedStroke } from '../domain/dawson/types';
import { DRUM_VOICE_PAS_MAP } from './DrumVoicePAS';
import { calculateFormulaDuration, resolveStrokeOffsets } from '../domain/dawson/SubdivisionFormula';

// Engraving geometry (CODING_STANDARDS § Notation renderers): module-level named
// consts so tests import them to assert real coordinates (docs/adr/0012 Headroom).
export const STAVE_LINE_SPACING_PX = 10;
export const STAVE_LINE_COUNT = 5;
export const STAVE_HEIGHT_PX = (STAVE_LINE_COUNT - 1) * STAVE_LINE_SPACING_PX;
export const STEM_REACH_PX = 30;
export const BEAM_THICKNESS_PX = 5;
export const BEAM_STACK_GAP_PX = 3;
export const TUPLET_CLEARANCE_PX = 15;
export const NOTE_HALF_HEIGHT_PX = 6;
export const ACCENT_CLEARANCE_PX = 9;
export const REST_VOICE_LINE = 2.0; // rests sit on the middle line (c/5)

/** VexFlow beams a sounding note carries: eighth 1, 16th 2, 32nd 3. */
function beamFlagsForVexDuration(duration: string): number {
  if (duration === '32') return 3;
  if (duration === '16') return 2;
  if (duration === '8') return 1;
  return 0;
}

export interface DrumStaffFormulaRenderOptions {
  width?: number;
  height?: number;
  padding?: number;
  timeSignature?: [number, number];
  targetBeats?: number;
}

export interface FormulaStrokeCoordinate {
  strokeIndex: number;
  beatOffset: number;
  durationRatio: number;
  isRest: boolean;
  x: number;
  y: number;
  width: number;
}

export interface DrumStaffFormulaLayout {
  width: number;
  height: number;
  stave: Stave;
  voice1Notes: StaveNote[];
  beams: Beam[];
  tuplets?: Tuplet[];
  strokeCoordinates: FormulaStrokeCoordinate[];
  getDrumVoiceForY(y: number): DrumVoice | null;
  getStepForX(x: number, gridResolution?: number): number;
  getBeatOffsetForX(x: number, totalBeats?: number): number;
  getXForBeatOffset(beatOffset: number, totalBeats?: number): number;
}

/**
 * Converts a stroke duration ratio (in beats) to a standard VexFlow duration string.
 */
export function durationRatioToVexDuration(ratio: number): string {
  if (ratio >= 3.9) return 'w'; // whole note / whole rest (4 beats)
  if (ratio >= 1.9) return 'h'; // half note (2 beats)
  if (ratio >= 0.9) return 'q'; // quarter note (1 beat)
  if (Math.abs(ratio - 2 / 3) < 0.03) return 'q'; // quarter note in swing triplet (2/3 beat)
  if (Math.abs(ratio - 0.5) < 0.05) return '8'; // eighth note
  if (Math.abs(ratio - 1 / 3) < 0.03) return '8'; // triplet eighth (1/3 beat)
  if (Math.abs(ratio - 0.25) < 0.03) return '16'; // sixteenth note
  if (Math.abs(ratio - 1 / 6) < 0.02) return '16'; // triplet sixteenth
  if (Math.abs(ratio - 0.125) < 0.02) return '32'; // thirty-second
  if (ratio < 0.1) return '32';
  return '16';
}

export class DrumStaffFormulaRenderer {
  constructor() {
    try {
      if (typeof VexFlow.setFonts === 'function') {
        VexFlow.setFonts('Bravura');
      }
    } catch {
      // Font fallback
    }
  }

  public render(
    container: HTMLDivElement,
    strokes: OrchestratedStroke[],
    options: DrumStaffFormulaRenderOptions = {}
  ): DrumStaffFormulaLayout {
    // Clear previous SVG contents
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = options.width ?? (container.clientWidth || 500);
    const requestedHeight = options.height ?? 160;
    const padding = options.padding ?? 15;

    // Determine total formula duration
    const formulaDuration = calculateFormulaDuration(strokes);
    const targetBeats = options.targetBeats || (formulaDuration > 0 ? formulaDuration : 1.0);

    // Fallback if no strokes provided
    const effectiveStrokes: OrchestratedStroke[] =
      strokes.length > 0
        ? strokes
        : [{ durationRatio: 1.0, isRest: true, hits: [] }];

    // Build stroke offsets first so we can detect tuplets and group beams by metric
    // windows, before any geometry is drawn.
    const strokeOffsets = resolveStrokeOffsets(effectiveStrokes, 0);

    // Identify tuplet groups across strokes
    interface TupletGroup {
      indices: number[];
      numNotes: number;
      notesOccupied: number;
    }
    const tupletGroups: TupletGroup[] = [];
    const usedTupletIndices = new Set<number>();

    // 1. Detect 6-note sextuplets (16th triplets, 6 notes in 1 beat)
    for (let i = 0; i <= effectiveStrokes.length - 6; i++) {
      if (usedTupletIndices.has(i)) continue;
      const slice = effectiveStrokes.slice(i, i + 6);
      const isSextuplet = slice.every(
        (s) => Math.abs(s.durationRatio - 1 / 6) < 0.02
      );
      if (isSextuplet) {
        const indices = [i, i + 1, i + 2, i + 3, i + 4, i + 5];
        indices.forEach((idx) => usedTupletIndices.add(idx));
        tupletGroups.push({
          indices,
          numNotes: 6,
          notesOccupied: 4,
        });
      }
    }

    // 2. Detect 3-note triplets (either 16th triplets in 0.5 beat or 8th triplets in 1 beat)
    for (let i = 0; i <= effectiveStrokes.length - 3; i++) {
      if (usedTupletIndices.has(i)) continue;
      const slice = effectiveStrokes.slice(i, i + 3);
      const isTriplet16th = slice.every(
        (s) => Math.abs(s.durationRatio - 1 / 6) < 0.02
      );
      const isTriplet8th = slice.every(
        (s) => Math.abs(s.durationRatio - 1 / 3) < 0.03
      );
      if (isTriplet16th || isTriplet8th) {
        const indices = [i, i + 1, i + 2];
        indices.forEach((idx) => usedTupletIndices.add(idx));
        tupletGroups.push({
          indices,
          numNotes: 3,
          notesOccupied: 2,
        });
      }
    }

    // Dynamic Headroom & Footroom (docs/adr/0012): vertical margins earned from the
    // voice lines and engraving clearances actually drawn, never a magic offset and
    // never clipping; the viewport grows to fit content past the requested height.
    let topVoiceLine = REST_VOICE_LINE;
    let bottomVoiceLine = REST_VOICE_LINE;
    effectiveStrokes.forEach((stroke) => {
      stroke.hits.forEach((hit) => {
        const line = DRUM_VOICE_PAS_MAP[hit.voice]?.line;
        if (line === undefined) return;
        if (line < topVoiceLine) topVoiceLine = line;
        if (line > bottomVoiceLine) bottomVoiceLine = line;
      });
    });

    let maxBeamFlags = 0;
    effectiveStrokes.forEach((stroke) => {
      if (stroke.isRest || stroke.hits.length === 0) return;
      const flags = beamFlagsForVexDuration(durationRatioToVexDuration(stroke.durationRatio));
      if (flags > maxBeamFlags) maxBeamFlags = flags;
    });

    const hasAccents = effectiveStrokes.some(
      (stroke) => stroke.hits.some((hit) => hit.dynamic === 'accent')
    );
    const beamStackPx =
      maxBeamFlags > 0
        ? maxBeamFlags * BEAM_THICKNESS_PX + (maxBeamFlags - 1) * BEAM_STACK_GAP_PX
        : 0;
    const tupletPx = tupletGroups.length > 0 ? TUPLET_CLEARANCE_PX : 0;

    const headroomPx = Math.max(
      tupletPx + beamStackPx + STEM_REACH_PX + NOTE_HALF_HEIGHT_PX -
        topVoiceLine * STAVE_LINE_SPACING_PX,
      padding
    );
    const footroomPx = Math.max(
      bottomVoiceLine * STAVE_LINE_SPACING_PX + NOTE_HALF_HEIGHT_PX +
        (hasAccents ? ACCENT_CLEARANCE_PX : 0) -
        (STAVE_LINE_COUNT - 1) * STAVE_LINE_SPACING_PX,
      padding
    );

    const contentHeightPx = headroomPx + STAVE_HEIGHT_PX + footroomPx;
    const height = Math.max(requestedHeight, contentHeightPx);
    // Screen Y of the drawn top stave line: margins above, slack half below.
    const topLineY = headroomPx + Math.floor((height - contentHeightPx) / 2);

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    // Create 5-line percussion stave.
    // VexFlow 5 quirk: the constructor y sits one staff-height above the drawn
    // top line (empirically, stave.getYForLine(0) === y + staff height).
    const staveX = padding;
    const staveWidth = Math.max(100, width - padding * 2);

    const stave = new Stave(staveX, topLineY - STAVE_HEIGHT_PX, staveWidth);
    stave.addClef('percussion');
    stave.setContext(context).draw();

    const voice1Notes: StaveNote[] = [];

    for (let i = 0; i < effectiveStrokes.length; i++) {
      const stroke = effectiveStrokes[i];
      const vexDur = durationRatioToVexDuration(stroke.durationRatio);

      if (stroke.isRest || !stroke.hits || stroke.hits.length === 0) {
        const restV1 = new StaveNote({
          clef: 'percussion',
          keys: ['c/5/r'],
          duration: `${vexDur}r`,
          stemDirection: Stem.UP,
        });
        voice1Notes.push(restV1);
      } else {
        const keys = stroke.hits.map((h) => DRUM_VOICE_PAS_MAP[h.voice]?.key || 'c/5');
        const noteV1 = new StaveNote({
          clef: 'percussion',
          keys,
          duration: vexDur,
          stemDirection: Stem.UP,
        });
        noteV1.setStemDirection(Stem.UP);
        stroke.hits.forEach((hit) => {
          if (hit.dynamic === 'accent') noteV1.addModifier(new Articulation('a>'), 0);
        });
        voice1Notes.push(noteV1);
      }
    }

    // Attach Tuplet instances to Voice 1 BEFORE formatting
    const tupletsToDraw: Tuplet[] = [];
    tupletGroups.forEach((group) => {
      const groupNotes = group.indices.map((idx) => voice1Notes[idx]).filter(Boolean);
      if (groupNotes.length === group.numNotes) {
        const hasRests = groupNotes.some((n) => n.isRest());
        const tuplet = new Tuplet(groupNotes, {
          numNotes: group.numNotes,
          notesOccupied: group.notesOccupied,
          bracketed: hasRests,
          ratioed: false,
        });
        tuplet.setTupletLocation(Tuplet.LOCATION_TOP);
        tuplet.setBracketed(hasRests);
        tuplet.setRatioed(false);
        tupletsToDraw.push(tuplet);
      }
    });

    // Format voices into stave
    const formatter = new Formatter();
    const voicesToFormat: Voice[] = [];

    // Loose formatting (soft format) to accommodate fractional subdivisions
    const v1 = new Voice({ numBeats: Math.max(1, Math.ceil(targetBeats)), beatValue: 4 });
    v1.setMode(Voice.Mode.SOFT);
    v1.addTickables(voice1Notes);
    voicesToFormat.push(v1);

    const availableWidth = stave.getNoteEndX() - stave.getNoteStartX();
    formatter.joinVoices(voicesToFormat).format(voicesToFormat, availableWidth);

    // Generate beams for rapid subdivisions BEFORE drawing voices
    const beams: Beam[] = [];
    try {
      // 1. Beam each tuplet group directly under one continuous beam
      tupletGroups.forEach((group) => {
        const soundingNotes = group.indices
          .map((idx) => voice1Notes[idx])
          .filter((n) => n && !n.isRest());
        if (soundingNotes.length > 1) {
          beams.push(new Beam(soundingNotes));
        }
      });

      // 2. Beam non-tuplet notes by beat bucket
      const nonTupletIndices = effectiveStrokes
        .map((_, i) => i)
        .filter((i) => !usedTupletIndices.has(i));

      const v1BeatGroups = new Map<number, StaveNote[]>();
      nonTupletIndices.forEach((i) => {
        const n = voice1Notes[i];
        if (n && !n.isRest()) {
          const dur = n.getDuration();
          if (dur === '8' || dur === '16' || dur === '32') {
            const offset = strokeOffsets[i]?.offset ?? 0;
            const beatBucket = Math.floor(offset / 1.0);
            if (!v1BeatGroups.has(beatBucket)) v1BeatGroups.set(beatBucket, []);
            v1BeatGroups.get(beatBucket)!.push(n);
          }
        }
      });

      v1BeatGroups.forEach((group) => {
        if (group.length > 1) {
          const v1Beams = Beam.generateBeams(group, {
            stemDirection: Stem.UP,
            beamRests: false,
          });
          beams.push(...v1Beams);
        }
      });
    } catch {
      // Safe fallback if notes can't be auto-beamed
    }

    // Draw voices AFTER beams are attached so no stray flags are drawn under beams
    v1.draw(context, stave);

    // Draw beams onto context
    beams.forEach((b) => {
      b.setContext(context).draw();
    });

    // Draw tuplets onto context
    tupletsToDraw.forEach((t) => {
      try {
        t.setContext(context).draw();
      } catch {
        // Safe fallback
      }
    });

    // Re-enforce explicit stem directions after drawing / beaming
    voice1Notes.forEach((n) => {
      if (!n.isRest()) n.setStemDirection(Stem.UP);
    });

    // Build stroke coordinates
    const strokeCoordinates: FormulaStrokeCoordinate[] = [];

    for (let i = 0; i < effectiveStrokes.length; i++) {
      const stroke = effectiveStrokes[i];
      const offsetInfo = strokeOffsets[i] || { offset: 0 };
      const note = voice1Notes[i];
      const noteX = note ? note.getAbsoluteX() : stave.getNoteStartX();

      strokeCoordinates.push({
        strokeIndex: i,
        beatOffset: offsetInfo.offset,
        durationRatio: stroke.durationRatio,
        isRest: !!stroke.isRest,
        x: noteX,
        y: stave.getYForLine(2.0),
        width: 24,
      });
    }

    // Coordinate translation helpers
    const getDrumVoiceForY = (y: number): DrumVoice | null => {
      let closestVoice: DrumVoice | null = null;
      let minDiff = Infinity;
      const voiceKeys = Object.keys(DRUM_VOICE_PAS_MAP) as DrumVoice[];

      for (const vKey of voiceKeys) {
        const pas = DRUM_VOICE_PAS_MAP[vKey];
        const lineY = stave.getYForLine(pas.line);
        const diff = Math.abs(lineY - y);
        if (diff < minDiff) {
          minDiff = diff;
          closestVoice = vKey;
        }
      }

      return closestVoice;
    };

    // Note-Anchored Interpolation (docs/adr/0012): piecewise-linear inverses through
    // each stroke's real beat offset and notehead x, bracketed by the note area ends.
    interface MetricAnchor {
      beat: number;
      x: number;
    }

    const metricAnchors: MetricAnchor[] = [];
    for (const coord of strokeCoordinates) {
      if (metricAnchors.length > 0 && coord.beatOffset <= metricAnchors[metricAnchors.length - 1].beat) {
        continue;
      }
      metricAnchors.push({ beat: coord.beatOffset, x: coord.x });
    }

    const segmentPoints = (totalBeats: number): MetricAnchor[] => {
      const pts = metricAnchors.filter((a) => a.beat >= 0 && a.beat <= totalBeats);
      const withStart = pts.length > 0 && pts[0].beat === 0
        ? [...pts]
        : [{ beat: 0, x: stave.getNoteStartX() }, ...pts];
      if (withStart[withStart.length - 1].beat < totalBeats) {
        withStart.push({ beat: totalBeats, x: stave.getNoteEndX() });
      }
      return withStart;
    };

    const getStepForX = (x: number, gridResolution: number = 16): number => {
      if (x <= stave.getNoteStartX()) return 0;
      if (x >= stave.getNoteEndX()) return gridResolution - 1;
      const beat = getBeatOffsetForX(x, targetBeats);
      const progress = targetBeats > 0 ? beat / targetBeats : 0;
      return Math.min(gridResolution - 1, Math.max(0, Math.round(progress * (gridResolution - 1))));
    };

    const getBeatOffsetForX = (x: number, totalBeats: number = targetBeats): number => {
      if (x <= stave.getNoteStartX()) return 0;
      if (x >= stave.getNoteEndX()) return totalBeats;
      const pts = segmentPoints(totalBeats);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (x <= b.x) {
          const span = b.x - a.x;
          const offset = span <= 0 ? b.beat : a.beat + ((x - a.x) / span) * (b.beat - a.beat);
          return Math.min(totalBeats, Math.max(0, offset));
        }
      }
      return totalBeats;
    };

    const getXForBeatOffset = (beatOffset: number, totalBeats: number = targetBeats): number => {
      const pts = segmentPoints(totalBeats);
      const clamped = Math.max(0, Math.min(totalBeats, beatOffset));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (clamped <= b.beat) {
          const span = b.beat - a.beat;
          return span <= 0 ? b.x : a.x + ((clamped - a.beat) / span) * (b.x - a.x);
        }
      }
      return pts[pts.length - 1].x;
    };

    return {
      width,
      height,
      stave,
      voice1Notes,
      beams,
      tuplets: tupletsToDraw,
      strokeCoordinates,
      getDrumVoiceForY,
      getStepForX,
      getBeatOffsetForX,
      getXForBeatOffset,
    };
  }
}
