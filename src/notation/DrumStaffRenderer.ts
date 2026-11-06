import VexFlow, {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Beam,
  Dot,
  BarlineType,
  Stem,
} from 'vexflow';
import { DrumVoice, ScheduledDrumEvent } from '../domain/dawson/types';
import { DawsonEngine } from '../domain/dawson/DawsonEngine';
import { ReadingLine } from '../domain/rhythm/types';
import {
  ScoreRenderOptions,
  ScoreLayout,
  MeasureCoordinate,
  EventCoordinate,
  PlayheadPosition,
} from './types';

export interface DrumVoicePAS {
  key: string;
  stemVoice: 1 | 2; // 1 = Hands (Stem.UP), 2 = Feet (Stem.DOWN)
  line: number; // Stave line offset: 0 = top line (f/5), 4 = bottom line (e/4)
  label?: string;
}

export const DRUM_VOICE_PAS_MAP: Record<DrumVoice, DrumVoicePAS> = {
  hihat_closed: { key: 'g/5/X2', stemVoice: 1, line: -0.5, label: 'Hi-Hat Closed' },
  hihat_open: { key: 'g/5/X2', stemVoice: 1, line: -0.5, label: 'Hi-Hat Open' },
  ride: { key: 'f/5/X2', stemVoice: 1, line: 0, label: 'Ride Cymbal' },
  ride_bell: { key: 'f/5/X3', stemVoice: 1, line: 0, label: 'Ride Bell' },
  crash: { key: 'a/5/X2', stemVoice: 1, line: -1.0, label: 'Crash Cymbal' },
  snare: { key: 'c/5', stemVoice: 1, line: 1.5, label: 'Snare' },
  snare_ghost: { key: 'c/5', stemVoice: 1, line: 1.5, label: 'Snare Ghost' },
  tom_high: { key: 'e/5', stemVoice: 1, line: 0.5, label: 'High Tom' },
  tom_mid: { key: 'd/5', stemVoice: 1, line: 1.0, label: 'Mid Tom' },
  tom_floor: { key: 'a/4', stemVoice: 1, line: 2.5, label: 'Floor Tom' },
  kick: { key: 'f/4', stemVoice: 2, line: 3.5, label: 'Bass Drum (Kick)' },
  hihat_foot: { key: 'd/4/X2', stemVoice: 2, line: 4.5, label: 'Hi-Hat Foot' },
};

export interface DrumScoreMeasure {
  measureIndex: number;
  timeSignature?: [number, number]; // default [4, 4]
  events: ScheduledDrumEvent[];
}

export interface DrumMeasureCoordinate extends MeasureCoordinate {
  stave: Stave;
  voice1Notes: StaveNote[];
  voice2Notes: StaveNote[];
}

export interface DrumScoreLayout extends ScoreLayout {
  drumMeasures: readonly DrumMeasureCoordinate[];
  getDrumVoiceForY(staveIndex: number, y: number): DrumVoice | null;
  getStepForX(staveIndex: number, x: number, totalSteps?: number): number | null;
}

export class DrumStaffRenderer {
  constructor() {
    try {
      if (typeof VexFlow.setFonts === 'function') {
        VexFlow.setFonts('Bravura');
      }
    } catch {
      // Ignore font fallback
    }
  }

  /**
   * Converts 16-step grid of keys into StaveNotes for one voice (Voice 1 Hands or Voice 2 Feet).
   */
  private buildVoiceNotes(
    stepKeys: string[][],
    voiceNumber: 1 | 2
  ): StaveNote[] {
    const stemDirection = voiceNumber === 1 ? Stem.UP : Stem.DOWN;
    const restKey = voiceNumber === 1 ? 'c/5/r' : 'd/4/r';

    // If entire measure is completely empty for this voice
    const isEntireMeasureEmpty = stepKeys.every((keys) => keys.length === 0);
    if (isEntireMeasureEmpty) {
      return [
        new StaveNote({
          clef: 'percussion',
          keys: [restKey],
          duration: 'wr',
          stemDirection,
        }),
      ];
    }

    const notes: StaveNote[] = [];

    // Process beat by beat (4 beats, 4 steps each)
    for (let beat = 0; beat < 4; beat++) {
      const b0 = stepKeys[beat * 4 + 0] || [];
      const b1 = stepKeys[beat * 4 + 1] || [];
      const b2 = stepKeys[beat * 4 + 2] || [];
      const b3 = stepKeys[beat * 4 + 3] || [];

      const hasHits = b0.length > 0 || b1.length > 0 || b2.length > 0 || b3.length > 0;

      if (!hasHits) {
        // Quarter rest
        notes.push(
          new StaveNote({
            clef: 'percussion',
            keys: [restKey],
            duration: 'qr',
            stemDirection,
          })
        );
        continue;
      }

      // Pattern: Only step 0 has hits -> quarter note
      if (b0.length > 0 && b1.length === 0 && b2.length === 0 && b3.length === 0) {
        notes.push(
          new StaveNote({
            clef: 'percussion',
            keys: b0,
            duration: 'q',
            stemDirection,
          })
        );
        continue;
      }

      // Pattern: Steps 0 and 2 have hits -> two eighth notes
      if (b0.length > 0 && b1.length === 0 && b2.length > 0 && b3.length === 0) {
        notes.push(
          new StaveNote({
            clef: 'percussion',
            keys: b0,
            duration: '8',
            stemDirection,
          }),
          new StaveNote({
            clef: 'percussion',
            keys: b2,
            duration: '8',
            stemDirection,
          })
        );
        continue;
      }

      // Pattern: Steps 0 and 3 have hits -> dotted eighth + sixteenth (swung ride)
      if (b0.length > 0 && b1.length === 0 && b2.length === 0 && b3.length > 0) {
        const dotNote = new StaveNote({
          clef: 'percussion',
          keys: b0,
          duration: '8d',
          stemDirection,
        });
        Dot.buildAndAttach([dotNote]);
        const sNote = new StaveNote({
          clef: 'percussion',
          keys: b3,
          duration: '16',
          stemDirection,
        });
        notes.push(dotNote, sNote);
        continue;
      }

      // Pattern: Step 0 empty, step 2 has hit -> eighth rest + eighth note
      if (b0.length === 0 && b1.length === 0 && b2.length > 0 && b3.length === 0) {
        notes.push(
          new StaveNote({
            clef: 'percussion',
            keys: [restKey],
            duration: '8r',
            stemDirection,
          }),
          new StaveNote({
            clef: 'percussion',
            keys: b2,
            duration: '8',
            stemDirection,
          })
        );
        continue;
      }

      // Pattern: All 4 sixteenths have hits
      if (b0.length > 0 && b1.length > 0 && b2.length > 0 && b3.length > 0) {
        notes.push(
          new StaveNote({ clef: 'percussion', keys: b0, duration: '16', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: b1, duration: '16', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: b2, duration: '16', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: b3, duration: '16', stemDirection })
        );
        continue;
      }

      // Pattern: Steps 0, 1, 2 have hits, step 3 empty -> two 16ths + 8th
      if (b0.length > 0 && b1.length > 0 && b2.length > 0 && b3.length === 0) {
        notes.push(
          new StaveNote({ clef: 'percussion', keys: b0, duration: '16', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: b1, duration: '16', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: b2, duration: '8', stemDirection })
        );
        continue;
      }

      // Pattern: Step 0 has hit, step 1 empty, steps 2, 3 have hits -> 8th + two 16ths
      if (b0.length > 0 && b1.length === 0 && b2.length > 0 && b3.length > 0) {
        notes.push(
          new StaveNote({ clef: 'percussion', keys: b0, duration: '8', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: b2, duration: '16', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: b3, duration: '16', stemDirection })
        );
        continue;
      }

      // Pattern: Steps 0 and 1 have hits, steps 2 and 3 empty -> two 16ths + 8th rest
      if (b0.length > 0 && b1.length > 0 && b2.length === 0 && b3.length === 0) {
        notes.push(
          new StaveNote({ clef: 'percussion', keys: b0, duration: '16', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: b1, duration: '16', stemDirection }),
          new StaveNote({ clef: 'percussion', keys: [restKey], duration: '8r', stemDirection })
        );
        continue;
      }

      // General fallback: emit 16th note or 16th rest for each of the 4 steps
      const steps = [b0, b1, b2, b3];
      for (const stKeys of steps) {
        if (stKeys.length > 0) {
          notes.push(
            new StaveNote({
              clef: 'percussion',
              keys: stKeys,
              duration: '16',
              stemDirection,
            })
          );
        } else {
          notes.push(
            new StaveNote({
              clef: 'percussion',
              keys: [restKey],
              duration: '16r',
              stemDirection,
            })
          );
        }
      }
    }

    return notes;
  }

  public render(
    container: HTMLDivElement | HTMLElement,
    drumMeasures: DrumScoreMeasure[],
    options: ScoreRenderOptions = {}
  ): DrumScoreLayout {
    container.innerHTML = '';

    const width = options.width ?? 800;
    const paddingLeft = options.padding?.left ?? 16;
    const paddingRight = options.padding?.right ?? 16;
    const paddingTop = options.padding?.top ?? 20;
    const paddingBottom = options.padding?.bottom ?? 20;
    const staveHeight = options.staveHeight ?? 110;
    const staveSpacing = options.staveSpacing ?? 140;

    const availableWidth = Math.max(200, width - (paddingLeft + paddingRight));
    const totalMeasures = drumMeasures.length || 1;

    let measuresPerSystem = options.measuresPerSystem;
    if (!measuresPerSystem || measuresPerSystem <= 0) {
      if (width < 500) {
        measuresPerSystem = 1;
      } else if (width < 768) {
        measuresPerSystem = 2;
      } else {
        measuresPerSystem = 4;
      }
    }

    const cols = Math.max(1, Math.min(measuresPerSystem, totalMeasures));
    const measureWidth = Math.floor(availableWidth / cols);
    const systemCount = Math.max(1, Math.ceil(totalMeasures / cols));
    const totalHeight = paddingTop + systemCount * staveSpacing + paddingBottom;

    const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(width, totalHeight);
    const context = renderer.getContext();

    const measureCoordinates: MeasureCoordinate[] = [];
    const drumMeasureCoordinates: DrumMeasureCoordinate[] = [];
    const measureCoordsMap = new Map<number, DrumMeasureCoordinate>();

    for (let i = 0; i < drumMeasures.length; i++) {
      const dMeasure = drumMeasures[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isFirstInSystem = col === 0;
      const isLastOverall = i === totalMeasures - 1;

      const staveX = paddingLeft + col * measureWidth;
      const staveY = paddingTop + row * staveSpacing;

      // 5-line percussion stave
      const stave = new Stave(staveX, staveY, measureWidth, { numLines: 5 });

      if (isFirstInSystem) {
        stave.addClef('percussion');
        if (i === 0) {
          stave.addTimeSignature('4/4');
        }
      }

      if (options.showMeasureNumbers !== false && isFirstInSystem) {
        stave.setMeasure(i + 1);
      }

      if (isLastOverall) {
        stave.setEndBarType(BarlineType.END);
      }

      stave.setContext(context).draw();

      // Partition events into 16 steps for Voice 1 (Hands) and Voice 2 (Feet)
      const v1StepKeys: string[][] = Array.from({ length: 16 }, () => []);
      const v2StepKeys: string[][] = Array.from({ length: 16 }, () => []);

      for (const evt of dMeasure.events) {
        const pas = DRUM_VOICE_PAS_MAP[evt.voice];
        if (!pas) continue;

        // Quantize timeInMeasure (0.0 to 4.0) to step (0 to 15)
        const step = Math.min(15, Math.max(0, Math.round(evt.timeInMeasure * 4)));

        if (pas.stemVoice === 1) {
          if (!v1StepKeys[step].includes(pas.key)) {
            v1StepKeys[step].push(pas.key);
          }
        } else {
          if (!v2StepKeys[step].includes(pas.key)) {
            v2StepKeys[step].push(pas.key);
          }
        }
      }

      // Sort chord keys so lower pitches come first (standard VexFlow requirement)
      for (let s = 0; s < 16; s++) {
        v1StepKeys[s].sort();
        v2StepKeys[s].sort();
      }

      const voice1Notes = this.buildVoiceNotes(v1StepKeys, 1);
      const voice2Notes = this.buildVoiceNotes(v2StepKeys, 2);

      const voice1 = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT);
      const voice2 = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT);

      voice1.addTickables(voice1Notes);
      voice2.addTickables(voice2Notes);

      const availableNoteWidth = Math.max(60, stave.getNoteEndX() - stave.getNoteStartX() - 10);
      const formatter = new Formatter();
      formatter.joinVoices([voice1, voice2]);
      formatter.format([voice1, voice2], availableNoteWidth);

      voice1.draw(context, stave);
      voice2.draw(context, stave);

      // Generate Beams for Voice 1 (Hands)
      try {
        const v1Beams: Beam[] = [];
        let currentV1Group: StaveNote[] = [];
        for (const n of voice1Notes) {
          if (!n.isRest() && (n.getDuration() === '8' || n.getDuration() === '16' || n.getDuration() === '8d')) {
            currentV1Group.push(n);
          } else {
            if (currentV1Group.length > 1) {
              v1Beams.push(...Beam.generateBeams(currentV1Group, { stemDirection: Stem.UP }));
            }
            currentV1Group = [];
          }
        }
        if (currentV1Group.length > 1) {
          v1Beams.push(...Beam.generateBeams(currentV1Group, { stemDirection: Stem.UP }));
        }
        v1Beams.forEach((b) => b.setContext(context).draw());
      } catch {
        // Ignore beam draw errors
      }

      // Generate Beams for Voice 2 (Feet)
      try {
        const v2Beams: Beam[] = [];
        let currentV2Group: StaveNote[] = [];
        for (const n of voice2Notes) {
          if (!n.isRest() && (n.getDuration() === '8' || n.getDuration() === '16')) {
            currentV2Group.push(n);
          } else {
            if (currentV2Group.length > 1) {
              v2Beams.push(...Beam.generateBeams(currentV2Group, { stemDirection: Stem.DOWN }));
            }
            currentV2Group = [];
          }
        }
        if (currentV2Group.length > 1) {
          v2Beams.push(...Beam.generateBeams(currentV2Group, { stemDirection: Stem.DOWN }));
        }
        v2Beams.forEach((b) => b.setContext(context).draw());
      } catch {
        // Ignore beam draw errors
      }

      // Build EventCoordinates for playhead tracking
      const eventCoords: EventCoordinate[] = [];
      let beatOffsetV1 = 0;

      for (let nIdx = 0; nIdx < voice1Notes.length; nIdx++) {
        const n = voice1Notes[nIdx];
        const durBeats = n.getDuration() === 'q' ? 1.0
          : n.getDuration() === '8' ? 0.5
          : n.getDuration() === '8d' ? 0.75
          : n.getDuration() === '16' ? 0.25
          : n.getDuration() === 'w' ? 4.0
          : 1.0;

        eventCoords.push({
          eventId: `m${dMeasure.measureIndex}-v1-n${nIdx}`,
          measureIndex: dMeasure.measureIndex,
          eventIndex: nIdx,
          beatOffset: beatOffsetV1,
          durationBeats: durBeats,
          x: n.getAbsoluteX(),
          y: stave.getYForLine(1.5),
          isRest: n.isRest(),
        });
        beatOffsetV1 += durBeats;
      }

      const drumMeasureCoord: DrumMeasureCoordinate = {
        measureIndex: dMeasure.measureIndex,
        systemIndex: row,
        measureInSystem: col,
        x: stave.getX(),
        y: stave.getY(),
        width: stave.getWidth(),
        height: staveHeight,
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        eventCoordinates: eventCoords,
        stave,
        voice1Notes,
        voice2Notes,
      };

      measureCoordinates.push(drumMeasureCoord);
      drumMeasureCoordinates.push(drumMeasureCoord);
      measureCoordsMap.set(dMeasure.measureIndex, drumMeasureCoord);
    }

    return {
      totalWidth: width,
      totalHeight,
      systemCount,
      measuresPerSystem: cols,
      measures: measureCoordinates,
      drumMeasures: drumMeasureCoordinates,

      getPlayheadPosition(measureIndex: number, beatOffset: number): PlayheadPosition | null {
        if (measureCoordinates.length === 0) return null;
        const normalizedIndex =
          ((measureIndex % measureCoordinates.length) + measureCoordinates.length) %
          measureCoordinates.length;
        const mCoord = measureCoordsMap.get(normalizedIndex);
        if (!mCoord) return null;

        const clampedBeat = Math.max(0, Math.min(4.0, beatOffset));
        const events = mCoord.eventCoordinates;

        let x = mCoord.noteStartX;
        if (events.length > 0) {
          if (clampedBeat <= events[0].beatOffset) {
            const span = events[0].beatOffset || 0.25;
            const progress = Math.max(0, clampedBeat) / span;
            x = mCoord.noteStartX + progress * (events[0].x - mCoord.noteStartX);
          } else {
            let found = false;
            for (let i = 0; i < events.length; i++) {
              const ev = events[i];
              const nextX = i + 1 < events.length ? events[i + 1].x : mCoord.noteEndX;
              const evEndBeat = ev.beatOffset + ev.durationBeats;

              if (clampedBeat >= ev.beatOffset && clampedBeat <= evEndBeat) {
                const beatProgress =
                  ev.durationBeats > 0 ? (clampedBeat - ev.beatOffset) / ev.durationBeats : 0;
                x = ev.x + beatProgress * (nextX - ev.x);
                found = true;
                break;
              }
            }
            if (!found) {
              const lastEv = events[events.length - 1];
              const lastEvEnd = lastEv.beatOffset + lastEv.durationBeats;
              const excess = Math.max(0, clampedBeat - lastEvEnd);
              x = Math.min(
                mCoord.noteEndX,
                lastEv.x + (excess / Math.max(0.1, 4.0 - lastEvEnd)) * (mCoord.noteEndX - lastEv.x)
              );
            }
          }
        } else {
          x = mCoord.noteStartX + (clampedBeat / 4.0) * (mCoord.noteEndX - mCoord.noteStartX);
        }

        return {
          x,
          y: mCoord.y,
          height: mCoord.height,
          systemIndex: mCoord.systemIndex,
          measureIndex: normalizedIndex,
          beatOffset: clampedBeat,
        };
      },

      getMeasureCoordinate(measureIndex: number): MeasureCoordinate | undefined {
        const normalized =
          ((measureIndex % measureCoordinates.length) + measureCoordinates.length) %
          measureCoordinates.length;
        return measureCoordsMap.get(normalized);
      },

      getDrumVoiceForY(staveIndex: number, y: number): DrumVoice | null {
        const normalized =
          ((staveIndex % drumMeasureCoordinates.length) + drumMeasureCoordinates.length) %
          drumMeasureCoordinates.length;
        const mCoord = drumMeasureCoordinates[normalized];
        if (!mCoord) return null;

        let closestVoice: DrumVoice | null = null;
        let minDiff = Infinity;

        // Iterate through all PAS drum voices and find the closest stave line
        const voiceKeys = Object.keys(DRUM_VOICE_PAS_MAP) as DrumVoice[];
        for (const vKey of voiceKeys) {
          const pas = DRUM_VOICE_PAS_MAP[vKey];
          const lineY = mCoord.stave.getYForLine(pas.line);
          const diff = Math.abs(lineY - y);
          if (diff < minDiff) {
            minDiff = diff;
            closestVoice = vKey;
          }
        }

        return closestVoice;
      },

      getStepForX(staveIndex: number, x: number, totalSteps = 16): number | null {
        const normalized =
          ((staveIndex % drumMeasureCoordinates.length) + drumMeasureCoordinates.length) %
          drumMeasureCoordinates.length;
        const mCoord = drumMeasureCoordinates[normalized];
        if (!mCoord) return null;

        const startX = mCoord.noteStartX;
        const endX = mCoord.noteEndX;
        if (x <= startX) return 0;
        if (x >= endX) return totalSteps - 1;

        const progress = (x - startX) / (endX - startX);
        return Math.min(totalSteps - 1, Math.max(0, Math.round(progress * (totalSteps - 1))));
      },
    };
  }

  /**
   * Helper to resolve a ReadingLine with DawsonEngine and render directly as a 5-line drum score.
   */
  public renderReadingLineWithDawson(
    container: HTMLDivElement | HTMLElement,
    readingLine: ReadingLine,
    dawsonEngine: DawsonEngine,
    options: ScoreRenderOptions = {}
  ): DrumScoreLayout {
    const drumMeasures: DrumScoreMeasure[] = readingLine.measures.map((measure) => {
      const events = dawsonEngine.resolveMeasure(measure, measure.index);
      return {
        measureIndex: measure.index,
        timeSignature: measure.timeSignature,
        events,
      };
    });

    return this.render(container, drumMeasures, options);
  }
}
