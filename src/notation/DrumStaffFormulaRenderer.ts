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
    container: HTMLDivElement,
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

    // Check if there are true polyphonic unisons between hands and feet on the SAME stroke
    const hasSimultaneousUnisons = strokes.some(
      (s) =>
        !s.isRest &&
        s.hits &&
        s.hits.length > 1 &&
        s.hits.some((h) => DRUM_VOICE_PAS_MAP[h.voice]?.stemVoice === 1) &&
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

        if (hasSimultaneousUnisons) {
          const restV2 = new StaveNote({
            clef: 'percussion',
            keys: ['d/4/r'],
            duration: `${vexDur}r`,
            stemDirection: Stem.DOWN,
          });
          restV2.setStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' });
          voice2Notes.push(restV2);
        }
      } else {
        const v1Hits = stroke.hits.filter(
          (h) => DRUM_VOICE_PAS_MAP[h.voice]?.stemVoice === 1
        );
        const v2Hits = stroke.hits.filter(
          (h) => DRUM_VOICE_PAS_MAP[h.voice]?.stemVoice === 2
        );

        if (v1Hits.length > 0 && v2Hits.length > 0) {
          // True Polyphonic Unison: Hands Stem.UP in Voice 1, Feet Stem.DOWN in Voice 2
          const keysV1 = v1Hits.map((h) => DRUM_VOICE_PAS_MAP[h.voice]?.key || 'c/5');
          const noteV1 = new StaveNote({
            clef: 'percussion',
            keys: keysV1,
            duration: vexDur,
            stemDirection: Stem.UP,
          });
          noteV1.setStemDirection(Stem.UP);
          v1Hits.forEach((hit) => {
            if (hit.dynamic === 'accent') noteV1.addModifier(new Articulation('a>'), 0);
          });
          voice1Notes.push(noteV1);

          const keysV2 = v2Hits.map((h) => DRUM_VOICE_PAS_MAP[h.voice]?.key || 'f/4');
          const noteV2 = new StaveNote({
            clef: 'percussion',
            keys: keysV2,
            duration: vexDur,
            stemDirection: Stem.DOWN,
          });
          noteV2.setStemDirection(Stem.DOWN);
          v2Hits.forEach((hit) => {
            if (hit.dynamic === 'accent') noteV2.addModifier(new Articulation('a>'), 0);
          });
          voice2Notes.push(noteV2);
        } else {
          // Linear Stroke: All hits share Stem.UP in Voice 1 so linear phrases beam continuously
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

          if (hasSimultaneousUnisons) {
            const restV2 = new StaveNote({
              clef: 'percussion',
              keys: ['d/4/r'],
              duration: `${vexDur}r`,
              stemDirection: Stem.DOWN,
            });
            restV2.setStemDirection(Stem.DOWN);
            restV2.setStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' });
            voice2Notes.push(restV2);
          }
        }
      }
    }

    // Build stroke offsets first so we can detect tuplets and group beams by metric windows
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

    if (hasSimultaneousUnisons && voice2Notes.length > 0) {
      const v2 = new Voice({ numBeats: Math.max(1, Math.ceil(targetBeats)), beatValue: 4 });
      v2.setMode(Voice.Mode.SOFT);
      v2.addTickables(voice2Notes);
      voicesToFormat.push(v2);
    }

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

      // Voice 2 beams (if any unisons exist)
      if (hasSimultaneousUnisons && voice2Notes.length > 0) {
        const v2BeatGroups = new Map<number, StaveNote[]>();
        for (let i = 0; i < voice2Notes.length; i++) {
          const n = voice2Notes[i];
          if (n && !n.isRest()) {
            const dur = n.getDuration();
            if (dur === '8' || dur === '16' || dur === '32') {
              const offset = strokeOffsets[i]?.offset ?? 0;
              const beatBucket = Math.floor(offset / 1.0);
              if (!v2BeatGroups.has(beatBucket)) v2BeatGroups.set(beatBucket, []);
              v2BeatGroups.get(beatBucket)!.push(n);
            }
          }
        }
        v2BeatGroups.forEach((group) => {
          if (group.length > 1) {
            const v2Beams = Beam.generateBeams(group, {
              stemDirection: Stem.DOWN,
              beamRests: false,
            });
            beams.push(...v2Beams);
          }
        });
      }
    } catch {
      // Safe fallback if notes can't be auto-beamed
    }

    // Draw voices AFTER beams are attached so no stray flags are drawn under beams
    v1.draw(context, stave);
    if (hasSimultaneousUnisons && voice2Notes.length > 0) {
      voicesToFormat[1].draw(context, stave);
    }

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
    voice2Notes.forEach((n) => {
      if (!n.isRest()) n.setStemDirection(Stem.DOWN);
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
      tuplets: tupletsToDraw,
      strokeCoordinates,
      getDrumVoiceForY,
      getStepForX,
      getBeatOffsetForX,
      getXForBeatOffset,
    };
  }
}
