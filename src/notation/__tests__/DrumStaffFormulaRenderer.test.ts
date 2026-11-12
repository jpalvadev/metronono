import { describe, it, expect, beforeEach } from 'vitest';
import { Stem } from 'vexflow';
import { DrumStaffFormulaRenderer } from '../DrumStaffFormulaRenderer';
import {
  STEM_REACH_PX,
  BEAM_THICKNESS_PX,
  BEAM_STACK_GAP_PX,
  TUPLET_CLEARANCE_PX,
  NOTE_HALF_HEIGHT_PX,
  ACCENT_CLEARANCE_PX,
  STAVE_LINE_SPACING_PX,
} from '../DrumStaffFormulaRenderer';
import { OrchestratedStroke } from '../../domain/dawson/types';
import { FACTORY_OSTINATOS } from '../../domain/dawson/SubdivisionFormula';

describe('DrumStaffFormulaRenderer', () => {
  let container: HTMLDivElement;
  let renderer: DrumStaffFormulaRenderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderer = new DrumStaffFormulaRenderer();
  });

  it('renders a 5-line percussion stave with percussion clef into SVG', () => {
    const strokes: OrchestratedStroke[] = [
      {
        durationRatio: 0.5,
        hits: [{ voice: 'snare', dynamic: 'normal' }],
      },
    ];

    const layout = renderer.render(container, strokes, { width: 500 });

    expect(container.querySelector('svg')).toBeTruthy();
    expect(layout.stave).toBeDefined();
    expect(layout.width).toBe(500);
    expect(layout.strokeCoordinates.length).toBeGreaterThan(0);
  });

  it('renders all hits (hands and feet) in Voice 1 unified with Stem.UP', () => {
    const strokes: OrchestratedStroke[] = [
      // Beat 0: Kick + Crash unison (polyphonic chord)
      {
        durationRatio: 0.5,
        hits: [
          { voice: 'kick', dynamic: 'accent' },
          { voice: 'crash', dynamic: 'accent' },
        ],
      },
      // Beat 0.5: Snare single hit
      {
        durationRatio: 0.5,
        hits: [{ voice: 'snare', dynamic: 'normal' }],
      },
    ];

    const layout = renderer.render(container, strokes, { width: 500 });

    // Voice 1 should have all notes with Stem.UP
    expect(layout.voice1Notes.length).toBeGreaterThan(0);
    layout.voice1Notes.forEach((note) => {
      if (!note.isRest()) {
        expect(note.getStemDirection()).toBe(Stem.UP);
      }
    });
  });

  it('renders explicit rests with standard rest notation', () => {
    const strokes: OrchestratedStroke[] = [
      {
        durationRatio: 0.25,
        hits: [{ voice: 'snare', dynamic: 'accent' }],
      },
      {
        durationRatio: 0.25,
        isRest: true,
        hits: [],
      },
      {
        durationRatio: 0.5,
        hits: [{ voice: 'tom_floor', dynamic: 'normal' }],
      },
    ];

    const layout = renderer.render(container, strokes, { width: 500 });
    const restNote = layout.voice1Notes.find((n) => n.isRest());
    expect(restNote).toBeDefined();
    expect(restNote?.getDuration()).toContain('16');
  });

  it('beams rapid subdivisions for Voice 1 and Voice 2', () => {
    // 4 sixteenth notes: kick, snare, tom_high, tom_mid
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.25, hits: [{ voice: 'kick', dynamic: 'normal' }] },
      { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 0.25, hits: [{ voice: 'tom_high', dynamic: 'normal' }] },
      { durationRatio: 0.25, hits: [{ voice: 'tom_mid', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500 });
    expect(layout.beams.length).toBeGreaterThan(0);
  });

  it('accurately maps vertical Y coordinates to drum voices using getDrumVoiceForY', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1.0, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500 });

    // Snare is on space 3 (line 1.5)
    const snareY = layout.stave.getYForLine(1.5);
    expect(layout.getDrumVoiceForY(snareY)).toBe('snare');

    // Kick is on space 1 (line 3.5)
    const kickY = layout.stave.getYForLine(3.5);
    expect(layout.getDrumVoiceForY(kickY)).toBe('kick');

    // Crash is above line 5 (line -1.0)
    const crashY = layout.stave.getYForLine(-1.0);
    expect(layout.getDrumVoiceForY(crashY)).toBe('crash');

    // Floor Tom is on space 2 (line 2.5)
    const floorTomY = layout.stave.getYForLine(2.5);
    expect(layout.getDrumVoiceForY(floorTomY)).toBe('tom_floor');
  });

  it('accurately maps horizontal X coordinates to snapped steps using getStepForX', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1.0, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500 });
    const noteStartX = layout.stave.getNoteStartX();
    const noteEndX = layout.stave.getNoteEndX();

    // At or before startX -> step 0
    expect(layout.getStepForX(noteStartX - 10, 16)).toBe(0);
    expect(layout.getStepForX(noteStartX, 16)).toBe(0);

    // At or past endX -> step 15
    expect(layout.getStepForX(noteEndX + 10, 16)).toBe(15);
    expect(layout.getStepForX(noteEndX, 16)).toBe(15);

    // Midpoint -> approximately step 7 or 8
    const midX = (noteStartX + noteEndX) / 2;
    const midStep = layout.getStepForX(midX, 16);
    expect(midStep).toBeGreaterThanOrEqual(7);
    expect(midStep).toBeLessThanOrEqual(8);
  });

  it('calculates playhead and beat offsets accurately', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.5, hits: [{ voice: 'kick', dynamic: 'normal' }] },
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500 });
    const x0 = layout.getXForBeatOffset(0, 1.0);
    const xHalf = layout.getXForBeatOffset(0.5, 1.0);
    const x1 = layout.getXForBeatOffset(1.0, 1.0);

    expect(xHalf).toBeGreaterThan(x0);
    expect(x1).toBeGreaterThan(xHalf);
  });

  it('renders a full 4/4 ostinato with stacked unison hits without formatting errors', () => {
    const jazzSwingStrokes = FACTORY_OSTINATOS.jazz_swing.strokes;
    expect(jazzSwingStrokes).toBeDefined();

    const layout = renderer.render(container, jazzSwingStrokes, {
      width: 600,
      targetBeats: 4,
    });

    expect(container.querySelector('svg')).toBeTruthy();
    expect(layout.stave).toBeDefined();
    expect(layout.voice1Notes.length).toBeGreaterThan(0);

    // All sounding notes should be Stem.UP
    const nonRestV1 = layout.voice1Notes.filter((n) => !n.isRest());
    expect(nonRestV1.length).toBeGreaterThanOrEqual(6);
    nonRestV1.forEach((n) => {
      expect(n.getStemDirection()).toBe(Stem.UP);
    });
  });

  it('renders a 4/4 measure of rests when empty strokes are passed with targetBeats: 4', () => {
    const layout = renderer.render(container, [], {
      width: 500,
      targetBeats: 4,
    });

    expect(container.querySelector('svg')).toBeTruthy();
    expect(layout.voice1Notes.length).toBeGreaterThanOrEqual(1);
    expect(layout.voice1Notes.every((n) => n.isRest())).toBe(true);
  });

  it('does not expose voice2Notes and renders noteheads in the SVG DOM', () => {
    const jazzSwingStrokes = FACTORY_OSTINATOS.jazz_swing.strokes;
    const layout = renderer.render(container, jazzSwingStrokes, {
      width: 600,
      targetBeats: 4,
    });

    expect('voice2Notes' in layout).toBe(false);
    expect(container.querySelectorAll('svg path, svg g').length).toBeGreaterThan(0);
  });

  // Headroom & Footroom margins (docs/adr/0012): earned from the voice lines and
  // engraving clearances actually drawn, never clipping and never a magic 25.
  it('earns dynamic headroom so a crash triplet bracket never clips at the viewport top', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1 / 3, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1.0, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500, height: 90, targetBeats: 2 });

    // The viewport grows past the requested height because content needs it.
    expect(layout.height).toBeGreaterThan(90);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('height')).toBe(String(layout.height));

    // Line spacing is the named stave geometry the margins are computed with.
    const spacing = layout.stave.getYForLine(1) - layout.stave.getYForLine(0);
    expect(spacing).toBeCloseTo(STAVE_LINE_SPACING_PX, 5);

    // The crash notehead center sits one full line spacing above the top line;
    // from there the whole engraving stack (notehead, stem, beam, tuplet) fits.
    const topLineY = layout.stave.getYForLine(0);
    expect(topLineY).toBeGreaterThan(25); // no more magic staveY = 25
    const crashCenter = layout.stave.getYForLine(-1.0);
    const beamTop = crashCenter - NOTE_HALF_HEIGHT_PX - STEM_REACH_PX - BEAM_THICKNESS_PX;
    const tupletTop = beamTop - TUPLET_CLEARANCE_PX;
    expect(tupletTop).toBeGreaterThanOrEqual(0);
  });

  it('stacks two beams and a tuplet over sextuplets without clipping', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1 / 6, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1 / 6, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1 / 6, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1 / 6, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1 / 6, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1 / 6, hits: [{ voice: 'crash', dynamic: 'normal' }] },
      { durationRatio: 1.0, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500, height: 90, targetBeats: 2 });
    const crashCenter = layout.stave.getYForLine(-1.0);
    // 16th-flag pair stacked (2 beams with a gap) under a tuplet bracket.
    const stackTop =
      crashCenter -
      NOTE_HALF_HEIGHT_PX -
      STEM_REACH_PX -
      (2 * BEAM_THICKNESS_PX + BEAM_STACK_GAP_PX);
    expect(stackTop - TUPLET_CLEARANCE_PX).toBeGreaterThanOrEqual(0);
  });

  it('keeps footroom for low voices so accents under a kick notehead never clip', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1.0, hits: [{ voice: 'kick', dynamic: 'accent' }] },
      { durationRatio: 1.0, hits: [{ voice: 'hihat_foot', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500, height: 140, targetBeats: 2 });
    const bottomLineY = layout.stave.getYForLine(4);
    const footCenter = layout.stave.getYForLine(4.5);
    const accentBottom = footCenter + NOTE_HALF_HEIGHT_PX + ACCENT_CLEARANCE_PX;
    expect(layout.height - accentBottom).toBeGreaterThanOrEqual(0);
    expect(bottomLineY).toBeLessThan(layout.height);
  });

  it('keeps the requested height as a floor, not wasted growth for compact figures', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1.0, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 1.0, hits: [{ voice: 'tom_mid', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500, height: 140, targetBeats: 2 });
    expect(layout.height).toBe(140);
  });

  // Note-Anchored Interpolation (docs/adr/0012): the metric seam follows the
  // render, so the Playhead lands exactly on the noteheads VexFlow drew.
  it('maps every stroke beat offset to that stroke notehead x, inside triplets too', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1 / 3, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 1.0, hits: [{ voice: 'tom_floor', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500, height: 140, targetBeats: 2 });

    for (const coord of layout.strokeCoordinates) {
      expect(layout.getXForBeatOffset(coord.beatOffset, 2)).toBeCloseTo(coord.x, 6);
    }
  });

  it('interpolates piecewise-linear between anchors and inverts exactly', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 0.5, hits: [{ voice: 'tom_high', dynamic: 'normal' }] },
      { durationRatio: 0.5, hits: [{ voice: 'tom_mid', dynamic: 'normal' }] },
    ];

    const layout = renderer.render(container, strokes, { width: 500, height: 140, targetBeats: 2 });
    const coords = layout.strokeCoordinates;
    expect(coords.length).toBe(4);

    // Halfway between the offsets of strokes 1 and 2 maps halfway between their noteheads.
    const midOffset = (coords[1].beatOffset + coords[2].beatOffset) / 2;
    const midX = layout.getXForBeatOffset(midOffset, 2);
    expect(midX).toBeCloseTo((coords[1].x + coords[2].x) / 2, 6);

    // Strictly increasing metric.
    expect(coords.every((c, i) => i === 0 || c.x > coords[i - 1].x)).toBe(true);

    // The inverse mapping round-trips at every anchor.
    for (const coord of coords) {
      expect(layout.getBeatOffsetForX(coord.x, 2)).toBeCloseTo(coord.beatOffset, 6);
    }

    // Endpoints keep their contract: before the note area is beat 0, past it is totalBeats.
    expect(layout.getBeatOffsetForX(layout.stave.getNoteStartX() - 10, 2)).toBe(0);
    expect(layout.getBeatOffsetForX(layout.stave.getNoteEndX() + 10, 2)).toBe(2);
  });
});
