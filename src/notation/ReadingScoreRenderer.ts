import VexFlow, {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Beam,
  StaveTie,
  Dot,
  Stem,
} from 'vexflow';

// On a 1-line stave VexFlow's built-in barlines collapse to a 1px rect (they
// span first-to-last line), so dividing bars are drawn explicitly instead.
const BARLINE_HALF_HEIGHT = 14;
const FINAL_BARLINE_THICKNESS = 3;
import { Measure, ReadingLine, RhythmicEvent } from '../domain/rhythm/types';
import {
  ScoreRenderOptions,
  ScoreLayout,
  MeasureCoordinate,
  EventCoordinate,
  PlayheadPosition,
} from './types';

function getVexFlowDuration(event: RhythmicEvent): { durationKey: string; isDotted: boolean } {
  switch (event.durationType) {
    case '16th':
      return { durationKey: '16', isDotted: false };
    case '8th':
      return { durationKey: '8', isDotted: false };
    case 'quarter':
      return { durationKey: 'q', isDotted: false };
    case 'dotted-quarter':
      return { durationKey: 'qd', isDotted: true };
    case 'half':
      return { durationKey: 'h', isDotted: false };
    case 'dotted-half':
      return { durationKey: 'hd', isDotted: true };
    case 'whole':
      return { durationKey: 'w', isDotted: false };
    default:
      return { durationKey: 'q', isDotted: false };
  }
}

export class ReadingScoreRenderer {
  constructor() {
    // Ensure Bravura font is default if supported
    try {
      if (typeof VexFlow.setFonts === 'function') {
        VexFlow.setFonts('Bravura');
      }
    } catch {
      // Ignore font switch error in test/headless environments
    }
  }

  public render(
    container: HTMLDivElement | HTMLElement,
    readingLine: ReadingLine,
    options: ScoreRenderOptions = {}
  ): ScoreLayout {
    container.innerHTML = '';

    const width = options.width ?? 800;
    const paddingLeft = options.padding?.left ?? 16;
    const paddingRight = options.padding?.right ?? 16;
    const paddingTop = options.padding?.top ?? 20;
    const paddingBottom = options.padding?.bottom ?? 20;
    const staveHeight = options.staveHeight ?? 80;
    const staveSpacing = options.staveSpacing ?? 100;

    const availableWidth = Math.max(200, width - (paddingLeft + paddingRight));
    const totalMeasures = readingLine.measures.length;

    let measuresPerSystem = options.measuresPerSystem;
    if (!measuresPerSystem || measuresPerSystem <= 0) {
      if (width < 460) {
        measuresPerSystem = 1;
      } else if (width < 720) {
        measuresPerSystem = 2;
      } else {
        measuresPerSystem = 4;
      }
    }

    const cols = Math.max(1, Math.min(measuresPerSystem, totalMeasures || 1));
    const measureWidth = Math.floor(availableWidth / cols);
    const systemCount = Math.max(1, Math.ceil(totalMeasures / cols));
    const totalHeight = paddingTop + systemCount * staveSpacing + paddingBottom;

    const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(width, totalHeight);
    const context = renderer.getContext();

    const drawBarlineAt = (x: number, centerY: number, lineWidth: number): void => {
      context.openGroup('barline');
      context.setLineWidth(lineWidth);
      context.beginPath();
      context.moveTo(x, centerY - BARLINE_HALF_HEIGHT);
      context.lineTo(x, centerY + BARLINE_HALF_HEIGHT);
      context.stroke();
      context.closeGroup();
    };

    const measureCoordinates: MeasureCoordinate[] = [];
    const measureCoordsMap = new Map<number, MeasureCoordinate>();

    // Store per-measure references to connect cross-measure ties
    const measureDataList: Array<{
      measure: Measure;
      stave: Stave;
      staveNotes: Array<{ note: StaveNote; event: RhythmicEvent; beatOffset: number }>;
      systemIndex: number;
    }> = [];

    // Pass 1: Render staves, notes, beams, and collect coordinates
    for (let i = 0; i < totalMeasures; i++) {
      const measure = readingLine.measures[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isFirstInSystem = col === 0;
      const isLastOverall = i === totalMeasures - 1;

      const staveX = paddingLeft + col * measureWidth;
      const staveY = paddingTop + row * staveSpacing;

      const stave = new Stave(staveX, staveY, measureWidth, { numLines: 1, leftBar: false, rightBar: false });

      if (isFirstInSystem) {
        stave.addClef('percussion');
        if (i === 0) {
          stave.addTimeSignature('4/4');
        }
      }

      if (options.showMeasureNumbers !== false && isFirstInSystem) {
        stave.setMeasure(i + 1);
      }

      stave.setContext(context).draw();

      // Dividing bar at the start of every measure (system start or bar line)
      const staveLineY = stave.getYForLine(0);
      drawBarlineAt(staveX, staveLineY, 1);

      if (isLastOverall) {
        // Final barline: thin line followed by a thick one at the score end
        const staveRightX = staveX + measureWidth;
        drawBarlineAt(staveRightX - 5, staveLineY, 1);
        drawBarlineAt(staveRightX - 1, staveLineY, FINAL_BARLINE_THICKNESS);
      }

      // Convert measure events to StaveNotes
      const staveNotes: Array<{ note: StaveNote; event: RhythmicEvent; beatOffset: number }> = [];
      let beatOffset = 0;

      for (let evtIdx = 0; evtIdx < measure.events.length; evtIdx++) {
        const evt = measure.events[evtIdx];
        const { durationKey, isDotted } = getVexFlowDuration(evt);
        const noteDuration = evt.isRest ? `${durationKey}r` : durationKey;

        const staveNote = new StaveNote({
          clef: 'percussion',
          keys: [evt.isRest ? 'b/4/r' : 'b/4'],
          duration: noteDuration,
          stemDirection: Stem.UP,
        });

        if (isDotted) {
          Dot.buildAndAttach([staveNote]);
        }

        staveNotes.push({ note: staveNote, event: evt, beatOffset });
        beatOffset += evt.durationBeats;
      }

      // Format notes into stave
      const notes = staveNotes.map((sn) => sn.note);
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);

      const availableNoteWidth = Math.max(50, stave.getNoteEndX() - stave.getNoteStartX() - 8);
      new Formatter().joinVoices([voice]).format([voice], availableNoteWidth);
      voice.draw(context, stave);

      // Generate beams for consecutive 8th and 16th notes
      const beams: Beam[] = [];
      let currentBeamGroup: StaveNote[] = [];
      for (const { note, event } of staveNotes) {
        if (!event.isRest && (event.durationType === '8th' || event.durationType === '16th')) {
          currentBeamGroup.push(note);
        } else {
          if (currentBeamGroup.length > 1) {
            beams.push(...Beam.generateBeams(currentBeamGroup));
          }
          currentBeamGroup = [];
        }
      }
      if (currentBeamGroup.length > 1) {
        beams.push(...Beam.generateBeams(currentBeamGroup));
      }
      beams.forEach((beam) => beam.setContext(context).draw());

      measureDataList.push({
        measure,
        stave,
        staveNotes,
        systemIndex: row,
      });

      // Collect EventCoordinates
      const eventCoords: EventCoordinate[] = staveNotes.map(({ note, event, beatOffset: bOffset }, idx) => {
        return {
          eventId: event.id,
          measureIndex: measure.index,
          eventIndex: idx,
          beatOffset: bOffset,
          durationBeats: event.durationBeats,
          x: note.getAbsoluteX(),
          y: stave.getYForLine(0),
          isRest: event.isRest,
        };
      });

      const measureCoord: MeasureCoordinate = {
        measureIndex: measure.index,
        systemIndex: row,
        measureInSystem: col,
        x: stave.getX(),
        y: stave.getY(),
        width: stave.getWidth(),
        height: staveHeight,
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        eventCoordinates: eventCoords,
      };

      measureCoordinates.push(measureCoord);
      measureCoordsMap.set(measure.index, measureCoord);
    }

    // Pass 2: Connect Ties (intra-measure and cross-measure)
    for (let mIdx = 0; mIdx < measureDataList.length; mIdx++) {
      const { staveNotes, systemIndex } = measureDataList[mIdx];

      // Intra-measure ties
      for (let nIdx = 0; nIdx < staveNotes.length; nIdx++) {
        const { note, event } = staveNotes[nIdx];
        if (event.hasTieToNext && !event.isRest) {
          if (nIdx + 1 < staveNotes.length) {
            const nextNote = staveNotes[nIdx + 1].note;
            const tie = new StaveTie({
              firstNote: note,
              lastNote: nextNote,
              firstIndexes: [0],
              lastIndexes: [0],
            });
            tie.setContext(context).draw();
          }
        }
      }

      // Cross-measure ties
      const lastNoteItem = staveNotes[staveNotes.length - 1];
      if (
        lastNoteItem &&
        lastNoteItem.event.hasTieToNext &&
        !lastNoteItem.event.isRest &&
        mIdx + 1 < measureDataList.length
      ) {
        const nextMeasureData = measureDataList[mIdx + 1];
        const firstNoteItem = nextMeasureData.staveNotes[0];
        if (firstNoteItem && !firstNoteItem.event.isRest) {
          if (systemIndex === nextMeasureData.systemIndex) {
            // Same line/system
            const tie = new StaveTie({
              firstNote: lastNoteItem.note,
              lastNote: firstNoteItem.note,
              firstIndexes: [0],
              lastIndexes: [0],
            });
            tie.setContext(context).draw();
          } else {
            // System break: partial tie out and partial tie in
            const tieOut = new StaveTie({
              firstNote: lastNoteItem.note,
              lastNote: null,
              firstIndexes: [0],
              lastIndexes: [0],
            });
            tieOut.setContext(context).draw();

            const tieIn = new StaveTie({
              firstNote: null,
              lastNote: firstNoteItem.note,
              firstIndexes: [0],
              lastIndexes: [0],
            });
            tieIn.setContext(context).draw();
          }
        }
      }
    }

    return {
      totalWidth: width,
      totalHeight,
      systemCount,
      measuresPerSystem: cols,
      measures: measureCoordinates,
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
    };
  }
}
