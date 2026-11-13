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
  StaveModifierPosition,
} from 'vexflow';

// On a 1-line stave VexFlow's built-in barlines collapse to a 1px rect (they
// span first-to-last line), so dividing bars are drawn explicitly instead.
const FINAL_BARLINE_THICKNESS = 3;
// Gap between the thin and thick strokes of the final barline pair.
const FINAL_THIN_OFFSET = 6;

// Explicit barlines run from ~4 px above the system's highest beam/flag down
// to ~4 px below the notehead/rest bottoms instead of a fixed ±14 px stub.
const BARLINE_MARGIN = 4;
const STEM_REACH = 35; // 3.5 stave spaces above the line (stem/flag top)
const FIGURE_HALF_HEIGHT = 10; // ≈ half-height of notehead/rest glyphs

// The Reading View is a one-line percussion bar, but notes, rests, clefs and
// time signatures are placed by VexFlow inside a five-line box (key 'b/4'
// resolves to its middle line). Draw a five-line stave with only the middle
// line visible so the single line passes through the middle of every figure
// instead of the notes hanging ~20 px below it.
const STAVE_LINE_COUNT = 5;
const VISIBLE_LINE_INDEX = 2;

// Beams are drawn as explicit rectangles resting exactly on the stem tips:
// VexFlow's Beam.draw() would re-stroke every beamed note's stem a second
// time at slightly different endpoints (doubled stems in the capture).
const BEAM_THICKNESS = 5; // matches VexFlow's Beam renderOptions.beamWidth
const BEAM_STACK = 7.5;   // secondary beam step, beamWidth * 1.5 like VexFlow

// A flagged stem path is drawn 3 px short of its extents tip (VexFlow
// Stem.adjustHeightForFlag), so the visible beam-bottom/tip pair lines up.
const STEM_FLAG_INSET = 3;

// Top of a beamed system's music block relative to the stave line.
const BEAM_REACH = STEM_REACH + BEAM_THICKNESS - STEM_FLAG_INSET;

// VexFlow anchors the clef ~5 px right of the stave x; shift the header
// (clef, time signature, first note) so the gap to the start barline is
// ~10–12 px instead of a crowded 5 px.
const CLEF_CLEARANCE = 6;
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

export function getAutoMeasuresPerSystem(width: number): number {
  if (width >= 960) return 4;
  if (width >= 720) return 3;
  if (width >= 460) return 2;
  return 1;
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

    const availableWidth = Math.max(1, width - (paddingLeft + paddingRight));
    const totalMeasures = readingLine.measures.length;

    let measuresPerSystem = options.measuresPerSystem;
    if (!measuresPerSystem || measuresPerSystem <= 0) {
      measuresPerSystem = getAutoMeasuresPerSystem(width);
    }

    const cols = Math.max(1, Math.min(measuresPerSystem, totalMeasures || 1));
    const measureWidth = Math.floor(availableWidth / cols);
    const systemCount = Math.max(1, Math.ceil(totalMeasures / cols));
    const totalHeight = paddingTop + systemCount * staveSpacing + paddingBottom;

    const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(width, totalHeight);
    const context = renderer.getContext();

    const drawBarlineAt = (x: number, topY: number, bottomY: number, lineWidth: number): void => {
      context.openGroup('barline');
      context.setLineWidth(lineWidth);
      context.beginPath();
      context.moveTo(x, topY);
      context.lineTo(x, bottomY);
      context.stroke();
      context.closeGroup();
    };

    // Draw one stem path per beamed note, then the beam rectangles resting
    // exactly on those tips. VexFlow's Beam.draw() is deliberately never
    // called: it re-strokes every beamed note's stem a second time.
    const drawBeamRects = (beam: Beam): void => {
      const notes = beam.getNotes();
      if (notes.length === 0) {
        return;
      }
      // voice.draw skips stems of notes that carry a beam, so draw the single
      // stem here — flagged-stem inset keeps the path tip at topY + 3.
      for (const note of notes) {
        const stem = note.getStem();
        if (!stem) {
          continue;
        }
        const stemX = note.getStemX();
        stem.setNoteHeadXBounds(stemX, stemX);
        stem.adjustHeightForFlag();
        stem.setContext(context).drawWithStyle();
      }
      const tipY = notes[0].getStemExtents().topY + STEM_FLAG_INSET;
      let level = 0;
      for (const duration of ['4', '8']) {
        const lines = beam.getBeamLines(duration);
        if (lines.length > 0) {
          const bottom = tipY + level * BEAM_STACK;
          const top = bottom - BEAM_THICKNESS;
          context.openGroup('beam');
          for (const line of lines) {
            const x0 = line.start;
            const x1 = (line.end ?? line.start) + 1;
            context.beginPath();
            context.moveTo(x0, top);
            context.lineTo(x0, bottom);
            context.lineTo(x1, bottom);
            context.lineTo(x1, top);
            context.closePath();
            context.fill();
          }
          context.closeGroup();
        }
        level += 1;
      }
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

    interface SystemInfo {
      lineY: number;
      barlineXs: number[];
      rightX: number;
      anyBeam: boolean;
      anyShort: boolean;
    }
    const systemInfos: SystemInfo[] = [];
    for (let s = 0; s < systemCount; s++) {
      systemInfos.push({ lineY: 0, barlineXs: [], rightX: 0, anyBeam: false, anyShort: false });
    }

    // Pass 1: Render staves, notes, beams, and collect coordinates
    for (let i = 0; i < totalMeasures; i++) {
      const measure = readingLine.measures[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isFirstInSystem = col === 0;

      const staveX = paddingLeft + col * measureWidth;
      const staveY = paddingTop + row * staveSpacing;

      const stave = new Stave(
        staveX,
        staveY,
        measureWidth,
        { numLines: STAVE_LINE_COUNT, leftBar: false, rightBar: false }
      );
      stave.setConfigForLines(
        [0, 1, 2, 3, 4].map((line) => ({ visible: line === VISIBLE_LINE_INDEX }))
      );

      if (isFirstInSystem) {
        stave.addClef('percussion');
        if (i === 0) {
          stave.addTimeSignature('4/4');
        }
        // Format first so the header modifiers have their natural x, then
        // shift clef/time signature right and push the note area with them.
        stave.format();
        stave.getModifiers(StaveModifierPosition.BEGIN).forEach((modifier) => {
          modifier.setX(modifier.getX() + CLEF_CLEARANCE);
        });
        stave.setNoteStartX(stave.getNoteStartX() + CLEF_CLEARANCE);
      }

      // Measure numbers are drawn after the pass (not via stave.setMeasure,
      // which pins them to the system's left edge where they collide with
      // the start barline); see Pass 1.5 below.
      stave.setContext(context).draw();

      // Barlines are drawn at the end of the pass so their extent can
      // bracket the whole music block of the system; here we just record
      // their x positions and the system's line.
      const staveLineY = stave.getYForLine(VISIBLE_LINE_INDEX);
      const system = systemInfos[row];
      system.lineY = staveLineY;
      system.barlineXs.push(staveX);
      system.rightX = staveX + measureWidth;

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

      // Generate beams before the voice is drawn so each beamed note carries
      // note.beam before StaveNote.draw(): shouldDrawFlag() skips the flag on
      // beamed notes, and isolated short notes keep their flag.
      const beams: Beam[] = [];
      let currentBeamGroup: StaveNote[] = [];
      let anyShortNote = false;
      for (const { note, event } of staveNotes) {
        if (!event.isRest && (event.durationType === '8th' || event.durationType === '16th')) {
          currentBeamGroup.push(note);
          anyShortNote = true;
        } else {
          if (currentBeamGroup.length > 1) {
            // Force stems up: VexFlow's auto direction reads b/4 as below-center
            // on a one-line stave and flips beamed groups to stem-down.
            beams.push(...Beam.generateBeams(currentBeamGroup, { stemDirection: Stem.UP }));
          }
          currentBeamGroup = [];
        }
      }
      if (currentBeamGroup.length > 1) {
        beams.push(...Beam.generateBeams(currentBeamGroup, { stemDirection: Stem.UP }));
      }

      // Format notes into stave
      const notes = staveNotes.map((sn) => sn.note);
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);

      const availableNoteWidth = Math.max(50, stave.getNoteEndX() - stave.getNoteStartX() - 8);
      new Formatter().joinVoices([voice]).format([voice], availableNoteWidth);
      voice.draw(context, stave);

      // Draw the beam rects after the voice laid the notes out, resting them
      // on the drawn stem tips (one stem path per note, drawn by voice.draw).
      for (const beam of beams) {
        drawBeamRects(beam);
      }

      system.anyBeam = system.anyBeam || beams.length > 0;
      system.anyShort = system.anyShort || anyShortNote;

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
          y: staveLineY,
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

    // Pass 1.5: draw the explicit barlines so they bracket each system's
    // music block: ~4 px above the highest beam/flag down to ~4 px below
    // the notehead/rest bottoms.
    const systemBarlineSpan = (system: SystemInfo): { topY: number; bottomY: number } => {
      const reach = system.anyBeam ? BEAM_REACH : system.anyShort ? STEM_REACH : FIGURE_HALF_HEIGHT;
      return {
        topY: system.lineY - reach - BARLINE_MARGIN,
        bottomY: system.lineY + FIGURE_HALF_HEIGHT + BARLINE_MARGIN,
      };
    };

    for (let row = 0; row < systemCount; row++) {
      const system = systemInfos[row];
      if (system.barlineXs.length === 0) {
        continue;
      }
      const span = systemBarlineSpan(system);
      system.barlineXs.forEach((x) => drawBarlineAt(x, span.topY, span.bottomY, 1));

      // Measure number above the first note column of the system, clear of
      // the start barline and of the music block's top edge.
      if (options.showMeasureNumbers !== false) {
        const firstMeasureCoord = measureCoordsMap.get(row * cols);
        if (firstMeasureCoord) {
          const anchorX = firstMeasureCoord.eventCoordinates.length > 0
            ? firstMeasureCoord.eventCoordinates[0].x
            : firstMeasureCoord.noteStartX;
          context.fillText(String(row * cols + 1), anchorX, span.topY - 4);
        }
      }
    }

    if (totalMeasures > 0) {
      const lastSystem = systemInfos[Math.floor((totalMeasures - 1) / cols)];
      const finalSpan = systemBarlineSpan(lastSystem);
      // Thick bar exactly at the stave line end (flush, no tail), thin one
      // a fixed offset to its left; both span the system's block height.
      drawBarlineAt(lastSystem.rightX - FINAL_THIN_OFFSET, finalSpan.topY, finalSpan.bottomY, 1);
      drawBarlineAt(lastSystem.rightX, finalSpan.topY, finalSpan.bottomY, FINAL_BARLINE_THICKNESS);
    }

    // Pass 1.6: Draw Swing indicator if swing reading feel is active
    if (options.readingFeel === 'swing' && totalMeasures > 0) {
      const firstSystem = systemInfos[0];
      const span = systemBarlineSpan(firstSystem);
      const group = context.openGroup('reading-swing-indicator');
      if (group && typeof (group as any).setAttribute === 'function') {
        const currentClass = (group as any).getAttribute('class') || '';
        (group as any).setAttribute('class', (currentClass + ' reading-swing-indicator').trim());
      }
      context.setFont('sans-serif', 11, 'bold');
      const indicatorY = Math.max(12, span.topY - 4);
      context.fillText('Swing (♫ = ♩♪)', paddingLeft, indicatorY);
      context.closeGroup();
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
