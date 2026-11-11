import VexFlow, {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Beam,
  Tuplet,
  Dot,
  BarlineType,
  Stem,
} from 'vexflow';
import { DrumVoice, ScheduledDrumEvent } from '../../domain/dawson/types';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { ReadingLine } from '../../domain/rhythm/types';
import {
  ScoreRenderOptions,
  ScoreLayout,
  MeasureCoordinate,
  EventCoordinate,
  PlayheadPosition,
} from '../../notation/types';
import { DRUM_VOICE_PAS_MAP } from '../../notation/DrumStaffRenderer';

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
   * Converts 4 steps of keys for a single beat into StaveNotes.
   */
  private buildSingleBeatNotes(
    steps: string[][],
    stemDirection: number,
    restKey: string
  ): StaveNote[] {
    const b0 = steps[0] || [];
    const b1 = steps[1] || [];
    const b2 = steps[2] || [];
    const b3 = steps[3] || [];

    const hasHits = b0.length > 0 || b1.length > 0 || b2.length > 0 || b3.length > 0;

    if (!hasHits) {
      return [
        new StaveNote({
          clef: 'percussion',
          keys: [restKey],
          duration: 'qr',
          stemDirection,
        }),
      ];
    }

    // Pattern: Only step 0 has hits -> quarter note
    if (b0.length > 0 && b1.length === 0 && b2.length === 0 && b3.length === 0) {
      return [
        new StaveNote({
          clef: 'percussion',
          keys: b0,
          duration: 'q',
          stemDirection,
        }),
      ];
    }

    // Pattern: Steps 0 and 2 have hits -> two eighth notes
    if (b0.length > 0 && b1.length === 0 && b2.length > 0 && b3.length === 0) {
      return [
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
        }),
      ];
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
      return [dotNote, sNote];
    }

    // Pattern: Step 0 empty, step 2 has hit -> eighth rest + eighth note
    if (b0.length === 0 && b1.length === 0 && b2.length > 0 && b3.length === 0) {
      return [
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
        }),
      ];
    }

    // Pattern: All 4 sixteenths have hits
    if (b0.length > 0 && b1.length > 0 && b2.length > 0 && b3.length > 0) {
      return [
        new StaveNote({ clef: 'percussion', keys: b0, duration: '16', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: b1, duration: '16', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: b2, duration: '16', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: b3, duration: '16', stemDirection }),
      ];
    }

    // Pattern: Steps 0, 1, 2 have hits, step 3 empty -> two 16ths + 8th
    if (b0.length > 0 && b1.length > 0 && b2.length > 0 && b3.length === 0) {
      return [
        new StaveNote({ clef: 'percussion', keys: b0, duration: '16', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: b1, duration: '16', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: b2, duration: '8', stemDirection }),
      ];
    }

    // Pattern: Step 0 has hit, step 1 empty, steps 2, 3 have hits -> 8th + two 16ths
    if (b0.length > 0 && b1.length === 0 && b2.length > 0 && b3.length > 0) {
      return [
        new StaveNote({ clef: 'percussion', keys: b0, duration: '8', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: b2, duration: '16', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: b3, duration: '16', stemDirection }),
      ];
    }

    // Pattern: Steps 0 and 1 have hits, steps 2 and 3 empty -> two 16ths + 8th rest
    if (b0.length > 0 && b1.length > 0 && b2.length === 0 && b3.length === 0) {
      return [
        new StaveNote({ clef: 'percussion', keys: b0, duration: '16', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: b1, duration: '16', stemDirection }),
        new StaveNote({ clef: 'percussion', keys: [restKey], duration: '8r', stemDirection }),
      ];
    }

    // General fallback: emit 16th note or 16th rest for each of the 4 steps
    const notes: StaveNote[] = [];
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
    return notes;
  }

  /**
   * Converts 16-step grid of keys into StaveNotes for one voice (Voice 1 Hands or Voice 2 Feet).
   */
  public buildVoiceNotes(
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
      const beatSteps = [
        stepKeys[beat * 4 + 0] || [],
        stepKeys[beat * 4 + 1] || [],
        stepKeys[beat * 4 + 2] || [],
        stepKeys[beat * 4 + 3] || [],
      ];
      notes.push(...this.buildSingleBeatNotes(beatSteps, stemDirection, restKey));
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

      // Check if Voice 2 has ANY hits anywhere in this entire measure
      const measureHasV2Hits = dMeasure.events.some((evt) => {
        const pas = DRUM_VOICE_PAS_MAP[evt.voice];
        return pas && pas.stemVoice === 2;
      });

      const voice1Notes: StaveNote[] = [];
      const voice2Notes: StaveNote[] = [];
      const tuplets: Tuplet[] = [];
      const v1Beams: Beam[] = [];
      const v2Beams: Beam[] = [];
      const v1NoteDurations: number[] = [];

      for (let beat = 0; beat < 4; beat++) {
        const beatEvents = dMeasure.events.filter(
          (e) => e.timeInMeasure >= beat - 0.001 && e.timeInMeasure < beat + 1.0 - 0.001
        );

        const has16thTripletDuration = beatEvents.some(
          (e) => e.durationBeats && Math.abs(e.durationBeats - 1 / 6) < 0.02
        );
        const hasSextupletUniqueOffset = beatEvents.some((e) => {
          const frac = e.timeInMeasure - beat;
          return (
            Math.abs(frac - 1 / 6) < 0.025 ||
            Math.abs(frac - 5 / 6) < 0.025 ||
            (beatEvents.length >= 5 && Math.abs(frac - 0.5) < 0.025)
          );
        });
        const isSextuplet =
          has16thTripletDuration || hasSextupletUniqueOffset || beatEvents.length >= 6;

        const isTriplet =
          !isSextuplet &&
          beatEvents.some(
            (e) =>
              (e.durationBeats && Math.abs(e.durationBeats - 1 / 3) < 0.03) ||
              [1 / 3, 2 / 3].some((r) => Math.abs(e.timeInMeasure - beat - r) < 0.03)
          );

        if (isSextuplet) {
          const v1Slots: string[][] = Array.from({ length: 6 }, () => []);
          const v2Slots: string[][] = Array.from({ length: 6 }, () => []);

          for (const evt of beatEvents) {
            const pas = DRUM_VOICE_PAS_MAP[evt.voice];
            if (!pas) continue;
            const slot = Math.min(5, Math.max(0, Math.round((evt.timeInMeasure - beat) * 6)));
            if (pas.stemVoice === 1) {
              if (!v1Slots[slot].includes(pas.key)) v1Slots[slot].push(pas.key);
            } else {
              if (!v2Slots[slot].includes(pas.key)) v2Slots[slot].push(pas.key);
            }
          }

          const hasSimultaneous = v1Slots.some(
            (v1, s) => v1.length > 0 && v2Slots[s].length > 0
          );

          if (!hasSimultaneous) {
            // Linear phrase in Voice 1
            const beatV1: StaveNote[] = [];
            for (let s = 0; s < 6; s++) {
              const keys = [...v1Slots[s], ...v2Slots[s]].sort();
              if (keys.length > 0) {
                beatV1.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys,
                    duration: '16',
                    stemDirection: Stem.UP,
                  })
                );
              } else {
                beatV1.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: ['c/5/r'],
                    duration: '16r',
                    stemDirection: Stem.UP,
                  })
                );
              }
              v1NoteDurations.push(1 / 6);
            }

            const tuplet = new Tuplet(beatV1, {
              numNotes: 6,
              notesOccupied: 4,
              bracketed: false,
              ratioed: false,
            });
            tuplet.setTupletLocation(Tuplet.LOCATION_TOP);
            tuplets.push(tuplet);

            const sounding = beatV1.filter((n) => !n.isRest());
            if (sounding.length > 1) {
              v1Beams.push(new Beam(sounding));
            }

            voice1Notes.push(...beatV1);

            if (measureHasV2Hits) {
              voice2Notes.push(
                new StaveNote({
                  clef: 'percussion',
                  keys: ['d/4/r'],
                  duration: 'qr',
                  stemDirection: Stem.DOWN,
                })
              );
            }
          } else {
            // Polyphonic unison: hands stem UP, feet stem DOWN
            const beatV1: StaveNote[] = [];
            const beatV2: StaveNote[] = [];

            for (let s = 0; s < 6; s++) {
              const v1Keys = v1Slots[s].sort();
              if (v1Keys.length > 0) {
                beatV1.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: v1Keys,
                    duration: '16',
                    stemDirection: Stem.UP,
                  })
                );
              } else {
                beatV1.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: ['c/5/r'],
                    duration: '16r',
                    stemDirection: Stem.UP,
                  })
                );
              }

              const v2Keys = v2Slots[s].sort();
              if (v2Keys.length > 0) {
                beatV2.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: v2Keys,
                    duration: '16',
                    stemDirection: Stem.DOWN,
                  })
                );
              } else {
                beatV2.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: ['d/4/r'],
                    duration: '16r',
                    stemDirection: Stem.DOWN,
                  })
                );
              }
              v1NoteDurations.push(1 / 6);
            }

            const tuplet1 = new Tuplet(beatV1, {
              numNotes: 6,
              notesOccupied: 4,
              bracketed: false,
              ratioed: false,
            });
            tuplet1.setTupletLocation(Tuplet.LOCATION_TOP);
            tuplets.push(tuplet1);

            const soundingV1 = beatV1.filter((n) => !n.isRest());
            if (soundingV1.length > 1) {
              v1Beams.push(new Beam(soundingV1));
            }

            if (measureHasV2Hits) {
              const tuplet2 = new Tuplet(beatV2, {
                numNotes: 6,
                notesOccupied: 4,
                bracketed: false,
                ratioed: false,
              });
              tuplet2.setTupletLocation(Tuplet.LOCATION_BOTTOM);
              tuplets.push(tuplet2);

              const soundingV2 = beatV2.filter((n) => !n.isRest());
              if (soundingV2.length > 1) {
                v2Beams.push(new Beam(soundingV2));
              }
              voice2Notes.push(...beatV2);
            }

            voice1Notes.push(...beatV1);
          }
        } else if (isTriplet) {
          const v1Slots: string[][] = Array.from({ length: 3 }, () => []);
          const v2Slots: string[][] = Array.from({ length: 3 }, () => []);

          for (const evt of beatEvents) {
            const pas = DRUM_VOICE_PAS_MAP[evt.voice];
            if (!pas) continue;
            const slot = Math.min(2, Math.max(0, Math.round((evt.timeInMeasure - beat) * 3)));
            if (pas.stemVoice === 1) {
              if (!v1Slots[slot].includes(pas.key)) v1Slots[slot].push(pas.key);
            } else {
              if (!v2Slots[slot].includes(pas.key)) v2Slots[slot].push(pas.key);
            }
          }

          const hasSimultaneous = v1Slots.some(
            (v1, s) => v1.length > 0 && v2Slots[s].length > 0
          );

          if (!hasSimultaneous) {
            const beatV1: StaveNote[] = [];
            for (let s = 0; s < 3; s++) {
              const keys = [...v1Slots[s], ...v2Slots[s]].sort();
              if (keys.length > 0) {
                beatV1.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys,
                    duration: '8',
                    stemDirection: Stem.UP,
                  })
                );
              } else {
                beatV1.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: ['c/5/r'],
                    duration: '8r',
                    stemDirection: Stem.UP,
                  })
                );
              }
              v1NoteDurations.push(1 / 3);
            }

            const tuplet = new Tuplet(beatV1, {
              numNotes: 3,
              notesOccupied: 2,
              bracketed: false,
              ratioed: false,
            });
            tuplet.setTupletLocation(Tuplet.LOCATION_TOP);
            tuplets.push(tuplet);

            const sounding = beatV1.filter((n) => !n.isRest());
            if (sounding.length > 1) {
              v1Beams.push(new Beam(sounding));
            }

            voice1Notes.push(...beatV1);

            if (measureHasV2Hits) {
              voice2Notes.push(
                new StaveNote({
                  clef: 'percussion',
                  keys: ['d/4/r'],
                  duration: 'qr',
                  stemDirection: Stem.DOWN,
                })
              );
            }
          } else {
            const beatV1: StaveNote[] = [];
            const beatV2: StaveNote[] = [];

            for (let s = 0; s < 3; s++) {
              const v1Keys = v1Slots[s].sort();
              if (v1Keys.length > 0) {
                beatV1.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: v1Keys,
                    duration: '8',
                    stemDirection: Stem.UP,
                  })
                );
              } else {
                beatV1.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: ['c/5/r'],
                    duration: '8r',
                    stemDirection: Stem.UP,
                  })
                );
              }

              const v2Keys = v2Slots[s].sort();
              if (v2Keys.length > 0) {
                beatV2.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: v2Keys,
                    duration: '8',
                    stemDirection: Stem.DOWN,
                  })
                );
              } else {
                beatV2.push(
                  new StaveNote({
                    clef: 'percussion',
                    keys: ['d/4/r'],
                    duration: '8r',
                    stemDirection: Stem.DOWN,
                  })
                );
              }
              v1NoteDurations.push(1 / 3);
            }

            const tuplet1 = new Tuplet(beatV1, {
              numNotes: 3,
              notesOccupied: 2,
              bracketed: false,
              ratioed: false,
            });
            tuplet1.setTupletLocation(Tuplet.LOCATION_TOP);
            tuplets.push(tuplet1);

            const soundingV1 = beatV1.filter((n) => !n.isRest());
            if (soundingV1.length > 1) {
              v1Beams.push(new Beam(soundingV1));
            }

            if (measureHasV2Hits) {
              const tuplet2 = new Tuplet(beatV2, {
                numNotes: 3,
                notesOccupied: 2,
                bracketed: false,
                ratioed: false,
              });
              tuplet2.setTupletLocation(Tuplet.LOCATION_BOTTOM);
              tuplets.push(tuplet2);

              const soundingV2 = beatV2.filter((n) => !n.isRest());
              if (soundingV2.length > 1) {
                v2Beams.push(new Beam(soundingV2));
              }
              voice2Notes.push(...beatV2);
            }

            voice1Notes.push(...beatV1);
          }
        } else {
          // Straight 16th-note beat (4 steps)
          const v1Steps: string[][] = [[], [], [], []];
          const v2Steps: string[][] = [[], [], [], []];

          for (const evt of beatEvents) {
            const pas = DRUM_VOICE_PAS_MAP[evt.voice];
            if (!pas) continue;
            const step = Math.min(3, Math.max(0, Math.round((evt.timeInMeasure - beat) * 4)));
            if (pas.stemVoice === 1) {
              if (!v1Steps[step].includes(pas.key)) v1Steps[step].push(pas.key);
            } else {
              if (!v2Steps[step].includes(pas.key)) v2Steps[step].push(pas.key);
            }
          }

          v1Steps.forEach((s) => s.sort());
          v2Steps.forEach((s) => s.sort());

          const beatV1 = this.buildSingleBeatNotes(v1Steps, Stem.UP, 'c/5/r');
          voice1Notes.push(...beatV1);

          for (const n of beatV1) {
            const dur =
              n.getDuration() === 'q'
                ? 1.0
                : n.getDuration() === '8'
                ? 0.5
                : n.getDuration() === '8d'
                ? 0.75
                : 0.25;
            v1NoteDurations.push(dur);
          }

          // Generate beams for straight 16th/8th notes in this beat
          const soundingV1 = beatV1.filter(
            (n) =>
              !n.isRest() &&
              (n.getDuration() === '16' || n.getDuration() === '8' || n.getDuration() === '8d')
          );
          if (soundingV1.length > 1) {
            v1Beams.push(new Beam(soundingV1));
          }

          if (measureHasV2Hits) {
            const beatV2 = this.buildSingleBeatNotes(v2Steps, Stem.DOWN, 'd/4/r');
            voice2Notes.push(...beatV2);

            const soundingV2 = beatV2.filter(
              (n) => !n.isRest() && (n.getDuration() === '16' || n.getDuration() === '8')
            );
            if (soundingV2.length > 1) {
              v2Beams.push(new Beam(soundingV2));
            }
          }
        }
      }

      // If entire measure has no V2 hits, add single whole rest
      if (!measureHasV2Hits) {
        voice2Notes.push(
          new StaveNote({
            clef: 'percussion',
            keys: ['d/4/r'],
            duration: 'wr',
            stemDirection: Stem.DOWN,
          })
        );
      }

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

      try {
        v1Beams.forEach((b) => b.setContext(context).draw());
      } catch {
        // Ignore beam draw errors
      }

      try {
        v2Beams.forEach((b) => b.setContext(context).draw());
      } catch {
        // Ignore beam draw errors
      }

      try {
        tuplets.forEach((t) => t.setContext(context).draw());
      } catch {
        // Ignore tuplet draw errors
      }

      // Build EventCoordinates for playhead tracking
      const eventCoords: EventCoordinate[] = [];
      let beatOffsetV1 = 0;

      for (let nIdx = 0; nIdx < voice1Notes.length; nIdx++) {
        const n = voice1Notes[nIdx];
        const durBeats =
          v1NoteDurations[nIdx] ??
          (n.getDuration() === 'q'
            ? 1.0
            : n.getDuration() === '8'
            ? 0.5
            : n.getDuration() === '8d'
            ? 0.75
            : n.getDuration() === '16'
            ? 0.25
            : n.getDuration() === 'w'
            ? 4.0
            : 1.0);

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
