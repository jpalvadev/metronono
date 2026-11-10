import VexFlow, {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Beam,
  Stem,
  Articulation,
} from 'vexflow';
import { DrumVoice, OrchestratedStroke, Dynamic } from '../domain/dawson/types';
import { DRUM_VOICE_PAS_MAP } from './DrumStaffRenderer';
import { calculateFormulaDuration, resolveStrokeOffsets } from '../domain/dawson/SubdivisionFormula';

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
  voice2Notes: StaveNote[];
  beams: Beam[];
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
  if (ratio >= 0.9) return 'q'; // quarter note
  if (Math.abs(ratio - 0.5) < 0.05) return '8'; // eighth note
  if (Math.abs(ratio - 1 / 3) < 0.02) return '8'; // triplet eighth
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
    container: HTMLElement | HTMLDivElement,
    strokes: OrchestratedStroke[],
    options: DrumStaffFormulaRenderOptions = {}
  ): DrumStaffFormulaLayout {
    // Clear previous SVG contents
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = options.width ?? (container.clientWidth || 500);
    const height = options.height ?? 160;
    const padding = options.padding ?? 15;

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    // Create 5-line percussion stave
    const staveX = padding;
    const staveY = 25;
    const staveWidth = Math.max(100, width - padding * 2);

    const stave = new Stave(staveX, staveY, staveWidth);
    stave.addClef('percussion');
    stave.setContext(context).draw();

    // Determine total formula duration
    const formulaDuration = calculateFormulaDuration(strokes);
    const targetBeats = options.targetBeats || (formulaDuration > 0 ? formulaDuration : 1.0);

    // Check if feet voices (Voice 2) are present in any stroke
    const hasFeetHits = strokes.some(
      (s) =>
        !s.isRest &&
        s.hits &&
        s.hits.some((h) => DRUM_VOICE_PAS_MAP[h.voice]?.stemVoice === 2)
    );

    const voice1Notes: StaveNote[] = [];
    const voice2Notes: StaveNote[] = [];

    // Fallback if no strokes provided
    const effectiveStrokes: OrchestratedStroke[] =
      strokes.length > 0
        ? strokes
        : [{ durationRatio: 1.0, isRest: true, hits: [] }];

    for (let i = 0; i < effectiveStrokes.length; i++) {
      const stroke = effectiveStrokes[i];
      const vexDur = durationRatioToVexDuration(stroke.durationRatio);

      if (stroke.isRest || !stroke.hits || stroke.hits.length === 0) {
        // Voice 1 Rest
        const restV1 = new StaveNote({
          clef: 'percussion',
          keys: ['c/5/r'],
          duration: `${vexDur}r`,
          stemDirection: Stem.UP,
        });
        voice1Notes.push(restV1);

        // Voice 2 Rest (if feet voice active)
        if (hasFeetHits) {
          const restV2 = new StaveNote({
            clef: 'percussion',
            keys: ['d/4/r'],
            duration: `${vexDur}r`,
            stemDirection: Stem.DOWN,
          });
          voice2Notes.push(restV2);
        }
      } else {
        const v1Hits = stroke.hits.filter(
          (h) => DRUM_VOICE_PAS_MAP[h.voice]?.stemVoice === 1
        );
        const v2Hits = stroke.hits.filter(
          (h) => DRUM_VOICE_PAS_MAP[h.voice]?.stemVoice === 2
        );

        // --- Voice 1 (Hands) ---
        if (v1Hits.length > 0) {
          const keys = v1Hits.map((h) => DRUM_VOICE_PAS_MAP[h.voice]?.key || 'c/5');
          const noteV1 = new StaveNote({
            clef: 'percussion',
            keys,
            duration: vexDur,
            stem_direction: Stem.UP,
          });
          noteV1.setStemDirection(Stem.UP);

          // Dynamic articulations
          v1Hits.forEach((hit) => {
            if (hit.dynamic === 'accent') {
              noteV1.addModifier(new Articulation('a>'), 0);
            }
          });

          voice1Notes.push(noteV1);
        } else {
          // Rest in Voice 1 while Voice 2 sounds
          const restNote = new StaveNote({
            clef: 'percussion',
            keys: ['c/5/r'],
            duration: `${vexDur}r`,
            stem_direction: Stem.UP,
          });
          restNote.setStemDirection(Stem.UP);
          voice1Notes.push(restNote);
        }

        // --- Voice 2 (Feet) ---
        if (hasFeetHits) {
          if (v2Hits.length > 0) {
            const keys = v2Hits.map((h) => DRUM_VOICE_PAS_MAP[h.voice]?.key || 'f/4');
            const noteV2 = new StaveNote({
              clef: 'percussion',
              keys,
              duration: vexDur,
              stem_direction: Stem.DOWN,
            });
            noteV2.setStemDirection(Stem.DOWN);

            v2Hits.forEach((hit) => {
              if (hit.dynamic === 'accent') {
                noteV2.addModifier(new Articulation('a>'), 0);
              }
            });

            voice2Notes.push(noteV2);
          } else {
            // Rest in Voice 2 while Voice 1 sounds
            const restNote = new StaveNote({
              clef: 'percussion',
              keys: ['d/4/r'],
              duration: `${vexDur}r`,
              stem_direction: Stem.DOWN,
            });
            restNote.setStemDirection(Stem.DOWN);
            voice2Notes.push(restNote);
          }
        }
      }
    }

    // Format voices into stave
    const formatter = new Formatter();
    const voicesToFormat: Voice[] = [];

    // Loose formatting (soft format) to accommodate fractional subdivisions
    const v1 = new Voice({ time: { num_beats: Math.max(1, Math.ceil(targetBeats)), beat_value: 4 } });
    v1.setMode(Voice.Mode.SOFT);
    v1.addTickables(voice1Notes);
    voicesToFormat.push(v1);

    if (hasFeetHits && voice2Notes.length > 0) {
      const v2 = new Voice({ time: { num_beats: Math.max(1, Math.ceil(targetBeats)), beat_value: 4 } });
      v2.setMode(Voice.Mode.SOFT);
      v2.addTickables(voice2Notes);
      voicesToFormat.push(v2);
    }

    const availableWidth = stave.getNoteEndX() - stave.getNoteStartX();
    formatter.joinVoices(voicesToFormat).format(voicesToFormat, availableWidth);

    // Draw voices
    v1.draw(context, stave);
    if (hasFeetHits && voice2Notes.length > 0) {
      voicesToFormat[1].draw(context, stave);
    }

    // Generate beams for rapid subdivisions
    const beams: Beam[] = [];
    try {
      const beamableV1 = voice1Notes.filter((n) => !n.isRest());
      if (beamableV1.length > 1) {
        const v1Beams = Beam.generateBeams(beamableV1, {
          stem_direction: Stem.UP,
          stemDirection: Stem.UP,
          beam_rests: false,
        });
        v1Beams.forEach((b) => {
          b.setContext(context).draw();
          beams.push(b);
        });
      }

      if (hasFeetHits) {
        const beamableV2 = voice2Notes.filter((n) => !n.isRest());
        if (beamableV2.length > 1) {
          const v2Beams = Beam.generateBeams(beamableV2, {
            stem_direction: Stem.DOWN,
            stemDirection: Stem.DOWN,
            beam_rests: false,
          });
          v2Beams.forEach((b) => {
            b.setContext(context).draw();
            beams.push(b);
          });
        }
      }
    } catch {
      // Safe fallback if notes can't be auto-beamed
    }

    // Re-enforce explicit stem directions after drawing / beaming
    voice1Notes.forEach((n) => {
      if (!n.isRest()) n.setStemDirection(Stem.UP);
    });
    voice2Notes.forEach((n) => {
      if (!n.isRest()) n.setStemDirection(Stem.DOWN);
    });

    // Build stroke coordinates
    const strokeOffsets = resolveStrokeOffsets(effectiveStrokes, 0);
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

    const getStepForX = (x: number, gridResolution: number = 16): number => {
      const startX = stave.getNoteStartX();
      const endX = stave.getNoteEndX();
      if (x <= startX) return 0;
      if (x >= endX) return gridResolution - 1;

      const progress = (x - startX) / (endX - startX);
      return Math.min(
        gridResolution - 1,
        Math.max(0, Math.round(progress * (gridResolution - 1)))
      );
    };

    const getBeatOffsetForX = (x: number, totalBeats: number = targetBeats): number => {
      const startX = stave.getNoteStartX();
      const endX = stave.getNoteEndX();
      if (x <= startX) return 0;
      if (x >= endX) return totalBeats;

      const progress = (x - startX) / (endX - startX);
      return Math.min(totalBeats, Math.max(0, progress * totalBeats));
    };

    const getXForBeatOffset = (beatOffset: number, totalBeats: number = targetBeats): number => {
      const startX = stave.getNoteStartX();
      const endX = stave.getNoteEndX();
      const progress = Math.max(0, Math.min(1.0, beatOffset / totalBeats));
      return startX + progress * (endX - startX);
    };

    return {
      width,
      height,
      stave,
      voice1Notes,
      voice2Notes,
      beams,
      strokeCoordinates,
      getDrumVoiceForY,
      getStepForX,
      getBeatOffsetForX,
      getXForBeatOffset,
    };
  }
}
