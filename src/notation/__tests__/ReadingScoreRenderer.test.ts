import { describe, it, expect, beforeEach } from 'vitest';
import { ReadingScoreRenderer } from '../ReadingScoreRenderer';
import { Measure, ReadingLine, createRhythmicEvent } from '../../domain/rhythm/types';
import { REED_PAGE_37_EXERCISE_ONE } from '../../domain/rhythm/ReedLibrary';

function createTestMeasure(index: number, durations: number[], rests: boolean[] = []): Measure {
  const events = durations.map((d, i) =>
    createRhythmicEvent({
      id: `m${index}-e${i}`,
      durationBeats: d,
      isRest: rests[i] ?? false,
    })
  );
  return {
    index,
    timeSignature: [4, 4],
    events,
    totalBeats: 4.0,
  };
}

describe('ReadingScoreRenderer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders a single 4/4 measure of quarter notes onto a 1-line percussion stave', () => {
    const measure = createTestMeasure(0, [1, 1, 1, 1]);
    const readingLine: ReadingLine = {
      id: 'test-1',
      title: 'Four Quarters',
      tier: 1,
      measures: [measure],
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 500 });

    expect(container.querySelector('svg')).toBeTruthy();
    expect(layout.measures).toHaveLength(1);
    expect(layout.measures[0].eventCoordinates).toHaveLength(4);

    // Verify coordinates are ascending in X
    const coords = layout.measures[0].eventCoordinates;
    expect(coords[0].x).toBeLessThan(coords[1].x);
    expect(coords[1].x).toBeLessThan(coords[2].x);
    expect(coords[2].x).toBeLessThan(coords[3].x);
  });

  it('renders rests on b/4/r properly without breaking layout', () => {
    // Q, Q rest, 8th, 8th rest, Q
    const measure = createTestMeasure(0, [1.0, 1.0, 0.5, 0.5, 1.0], [false, true, false, true, false]);
    const readingLine: ReadingLine = {
      id: 'test-rests',
      title: 'Rests Test',
      tier: 2,
      measures: [measure],
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 500 });

    expect(layout.measures[0].eventCoordinates).toHaveLength(5);
    expect(layout.measures[0].eventCoordinates[1].isRest).toBe(true);
    expect(layout.measures[0].eventCoordinates[3].isRest).toBe(true);
    expect(layout.measures[0].eventCoordinates[0].isRest).toBe(false);
  });

  it('renders beams for consecutive eighth notes', () => {
    // 8 eighth notes in a measure
    const measure = createTestMeasure(0, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const readingLine: ReadingLine = {
      id: 'test-beams',
      title: 'Continuous Eighths',
      tier: 1,
      measures: [measure],
    };

    const renderer = new ReadingScoreRenderer();
    renderer.render(container, readingLine, { width: 600 });

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // Beams generate path or rect elements inside SVG
    const paths = svg?.querySelectorAll('path, rect');
    expect(paths && paths.length).toBeGreaterThan(0);
  });

  // Helper: every note sits on the single stave line, so a stem points up
  // exactly when its whole path stays above that line.
  const stemPathsAboveStaveLine = (svg: Element | null): { tips: number[]; line: number } | null => {
    if (!svg) return null;
    const linePaths = svg!.querySelectorAll('g[class="vf-stave"] > path');
    if (!linePaths.length) return null;
    const lineNums = (linePaths[0].getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g) ?? [];
    const line = parseFloat(lineNums[1] ?? '');
    const tips: number[] = [];
    for (const stem of svg!.querySelectorAll('g[class="vf-stem"] path')) {
      const ys = (stem.getAttribute('d') ?? '')
        .match(/-?\d+(\.\d+)?/g)
        ?.map(Number)
        .filter((_: number, i: number) => i % 2 === 1);
      if (!ys) return null;
      tips.push(Math.min(...ys));
    }
    return { tips, line };
  };

  it('keeps short-note stems pointing up when beamed', () => {
    const measure = createTestMeasure(0, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const readingLine: ReadingLine = {
      id: 'test-stems-up',
      title: 'Beamed Short Notes Point Up',
      tier: 1,
      measures: [measure],
    };

    const renderer = new ReadingScoreRenderer();
    renderer.render(container, readingLine, { width: 600 });

    const svg = container.querySelector('svg');
    const stems = stemPathsAboveStaveLine(svg);
    expect(stems).not.toBeNull();
    expect(stems!.tips.length).toBeGreaterThan(0);
    stems!.tips.forEach((tip) => expect(tip).toBeLessThan(stems!.line - 10));
  });

  it('keeps every short-note stem pointing up across mixed measures', () => {
    // Beamed pairs, a sixteenth beat, and a trailing group flushed at measure end.
    const measures = [
      createTestMeasure(0, [0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 1]),
      createTestMeasure(1, [1, 0.25, 0.25, 0.5, 1, 0.5, 0.5]),
    ];
    const readingLine: ReadingLine = {
      id: 'test-stems-up-mixed',
      title: 'All Short Note Stems Up',
      tier: 2,
      measures,
    };

    const renderer = new ReadingScoreRenderer();
    renderer.render(container, readingLine, { width: 800 });

    const stems = stemPathsAboveStaveLine(container.querySelector('svg'));
    expect(stems).not.toBeNull();
    expect(stems!.tips.length).toBeGreaterThan(0);
    stems!.tips.forEach((tip) => expect(tip).toBeLessThan(stems!.line - 10));
  });

  // Geometry helpers: read what was actually drawn from the SVG DOM.
  const staveLineY = (svg: Element | null): number => {
    if (!svg) return NaN;
    const linePath = svg!.querySelector('g[class="vf-stave"] path');
    const nums = (linePath?.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g) ?? [];
    return parseFloat(nums[1] ?? '');
  };

  // Glyph anchor y of every notehead and rest glyph (SMULF text glyphs).
  const figureGlyphYs = (svg: Element | null): number[] => {
    if (!svg) return [];
    const ys: number[] = [];
    for (const cls of ['vf-notehead', 'vf-rest']) {
      for (const g of svg!.querySelectorAll(`g[class="${cls}"]`)) {
        for (const t of g.querySelectorAll('text')) {
          const y = parseFloat(t.getAttribute('y') ?? '');
          if (!isNaN(y)) ys.push(y);
        }
      }
    }
    return ys;
  };

  it('centers noteheads and rests on the single stave line', () => {
    // 8th, 8th rest, quarter rest, half rest = one 4/4 bar.
    const measure = createTestMeasure(0, [0.5, 0.5, 1.0, 2.0], [false, true, true, true]);
    const readingLine: ReadingLine = {
      id: 'test-figures-on-line',
      title: 'Figures On The Line',
      tier: 1,
      measures: [measure],
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 500 });

    const svg = container.querySelector('svg');
    const line = staveLineY(svg);
    expect(Number.isFinite(line)).toBe(true);

    const ys = figureGlyphYs(svg);
    expect(ys.length).toBe(4); // 1 notehead + 3 rests
    ys.forEach((y) => expect(Math.abs(y - line)).toBeLessThanOrEqual(1.5));

    // Reported coordinates match what is drawn.
    layout.measures[0].eventCoordinates.forEach((coord) => {
      expect(Math.abs(coord.y - line)).toBeLessThanOrEqual(1.5);
    });
  });

  // Every note stem path in the SVG: x anchor and topmost y (the tip).
  const stemPaths = (svg: Element | null): Array<{ x: number; tip: number }> => {
    if (!svg) return [];
    const stems: Array<{ x: number; tip: number }> = [];
    for (const path of svg!.querySelectorAll('g[class="vf-stem"] path')) {
      const nums = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number);
      if (!nums || nums.length < 4) continue;
      const ys = nums.filter((_, i) => i % 2 === 1);
      stems.push({ x: nums[0], tip: Math.min(...ys) });
    }
    return stems;
  };

  // Closed rectangular beam paths: x span and y span.
  const beamRects = (svg: Element | null): Array<{ x0: number; x1: number; top: number; bottom: number }> => {
    if (!svg) return [];
    const rects: Array<{ x0: number; x1: number; top: number; bottom: number }> = [];
    for (const g of svg!.querySelectorAll('g[class="vf-beam"]')) {
      for (const path of g.querySelectorAll('path')) {
        const d = path.getAttribute('d') ?? '';
        if (!d.includes('Z')) continue; // beam lines are closed fill rects
        const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
        if (nums.length < 4) continue;
        rects.push({
          x0: Math.min(...nums.filter((_, i) => i % 2 === 0)),
          x1: Math.max(...nums.filter((_, i) => i % 2 === 0)),
          top: Math.min(...nums.filter((_, i) => i % 2 === 1)),
          bottom: Math.max(...nums.filter((_, i) => i % 2 === 1)),
        });
      }
    }
    return rects;
  };

  it('draws exactly one stem per beamed note, tips up, beam resting on the tips', () => {
    const measure = createTestMeasure(0, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const readingLine: ReadingLine = {
      id: 'test-single-stems',
      title: 'One Stem Per Note',
      tier: 1,
      measures: [measure],
    };

    const renderer = new ReadingScoreRenderer();
    renderer.render(container, readingLine, { width: 600 });

    const svg = container.querySelector('svg');
    const line = staveLineY(svg);
    const stems = stemPaths(svg);

    // Exactly one stem path per note, no doubled paths at the same x.
    expect(stems.length).toBe(8);
    for (let i = 0; i < stems.length; i++) {
      for (let j = i + 1; j < stems.length; j++) {
        expect(Math.abs(stems[i].x - stems[j].x)).toBeGreaterThan(0.1);
      }
    }

    // Tips above the line at the standard ~3.5 stave spaces.
    stems.forEach((s) => {
      expect(s.tip).toBeLessThanOrEqual(line - 30);
      expect(s.tip).toBeGreaterThanOrEqual(line - 40);
    });

    // Beam bottoms rest exactly on the stem tips of the notes they cover.
    const rects = beamRects(svg);
    expect(rects.length).toBe(4);
    rects.forEach((r) => {
      const covered = stems.filter((s) => s.x >= r.x0 - 0.5 && s.x <= r.x1 + 0.5);
      expect(covered.length).toBeGreaterThan(0);
      covered.forEach((s) => expect(Math.abs(s.tip - r.bottom)).toBeLessThanOrEqual(0.5));
    });
  });

  // Anchor x of every flag glyph group.
  const flagXs = (svg: Element | null): number[] => {
    if (!svg) return [];
    const xs: number[] = [];
    for (const g of svg!.querySelectorAll('g[class="vf-flag"]')) {
      const t = g.querySelector('text');
      const x = parseFloat(t?.getAttribute('x') ?? '');
      if (!isNaN(x)) xs.push(x);
    }
    return xs;
  };

  it('keeps flags on lone short notes and never on beamed ones', () => {
    // 8th(lone) q 8th 8th(beam pair) q 8th-rest = one 4/4 bar.
    const measure = createTestMeasure(0, [0.5, 1.0, 0.5, 0.5, 1.0, 0.5], [false, false, false, false, false, true]);
    const readingLine: ReadingLine = {
      id: 'test-flags-lone-only',
      title: 'Flags On Lone Short Notes',
      tier: 2,
      measures: [measure],
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 500 });

    const svg = container.querySelector('svg');
    const xs = flagXs(svg);

    // The isolated eighth keeps its flag...
    const loneEighthX = layout.measures[0].eventCoordinates[0].x;
    expect(xs.some((x) => x >= loneEighthX - 4 && x <= loneEighthX + 20)).toBe(true);

    // ...and no flag sits beside a beamed pair's beam.
    const rects = beamRects(svg);
    expect(rects.length).toBe(1); // the eighth-eighth pair only
    rects.forEach((r) => {
      expect(xs.every((x) => x < r.x0 - 4 || x > r.x1 + 4)).toBe(true);
    });
  });

  // x anchor, y span and stroke width of every explicit barline path.
  const barlineSpans = (svg: Element | null): Array<{ x: number; top: number; bottom: number; width: number }> => {
    if (!svg) return [];
    const spans: Array<{ x: number; top: number; bottom: number; width: number }> = [];
    for (const g of svg!.querySelectorAll('g[class="vf-barline"]')) {
      for (const path of g.querySelectorAll('path')) {
        const nums = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number);
        if (!nums || nums.length < 4) continue;
        spans.push({
          x: nums[0],
          top: Math.min(...nums.filter((_, i) => i % 2 === 1)),
          bottom: Math.max(...nums.filter((_, i) => i % 2 === 1)),
          width: parseFloat(path.getAttribute('stroke-width') ?? '1'),
        });
      }
    }
    return spans;
  };

  // Rightmost end x of the drawn stave line.
  const staveLineEndX = (svg: Element | null): number => {
    if (!svg) return NaN;
    let endX: number | null = null;
    for (const path of svg!.querySelectorAll('g[class="vf-stave"] path')) {
      const nums = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      if (nums.length >= 4) endX = endX === null ? nums[2] : Math.max(endX, nums[2]);
    }
    return endX ?? NaN;
  };

  it('ends the score with a flush thin-plus-thick final barline pair', () => {
    const readingLine: ReadingLine = {
      id: 'test-final-pair-flush',
      title: 'Flush Final Barline Pair',
      tier: 1,
      measures: [0, 1, 2].map((i) => createTestMeasure(i, [1, 1, 1, 1])),
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 800 });

    const svg = container.querySelector('svg');
    const spans = barlineSpans(svg);
    const thick = spans.filter((s) => s.width >= 2);
    const thin = spans.filter((s) => s.width < 2);
    expect(thick.length).toBe(1);
    expect(thin.length).toBe(4); // start + 2 dividers + thin final

    const lineEndX = staveLineEndX(svg);
    // The thick barline sits exactly at the stave line end: no tail, no gap.
    expect(Math.abs(thick[0].x - lineEndX)).toBeLessThanOrEqual(0.6);

    // Final pair spans the same full block height as the dividing barlines.
    const divider = thin[0];
    expect(Math.abs(thick[0].top - divider.top)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(thick[0].bottom - divider.bottom)).toBeLessThanOrEqual(0.6);

    // The pair: thin ~6 px left of the thick bar, and the last measure's
    // music stays clear to the left of it.
    const thinFinal = thin.reduce((a, b) => (a.x > b.x ? a : b), thin[0]);
    expect(thick[0].x - thinFinal.x).toBeGreaterThanOrEqual(5);
    expect(thick[0].x - thinFinal.x).toBeLessThanOrEqual(7);
    const lastMeasure = layout.measures[layout.measures.length - 1];
    const maxEventX = Math.max(...lastMeasure.eventCoordinates.map((c) => c.x));
    expect(maxEventX).toBeLessThan(thinFinal.x - 8);
  });

  it('brackets the whole music block with start and dividing barlines', () => {
    const measure = createTestMeasure(0, [0.5, 0.5, 0.5, 0.5, 1.0, 1.0]);
    const readingLine: ReadingLine = {
      id: 'test-barline-extent',
      title: 'Barlines Bracket The Block',
      tier: 1,
      measures: [measure, createTestMeasure(1, [0.5, 0.5, 0.5, 0.5, 1.0, 1.0])],
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 800 });

    const svg = container.querySelector('svg');
    const rects = beamRects(svg);
    expect(rects.length).toBe(4); // two beam pairs per measure
    const beamTop = Math.min(...rects.map((r) => r.top));

    const spans = barlineSpans(svg);
    expect(spans.length).toBe(4); // start, divider, thin final, thick final
    spans.forEach((s) => {
      // ~4 px of clearance above the highest beam of the system.
      expect(s.top).toBeGreaterThanOrEqual(beamTop - 6);
      expect(s.top).toBeLessThanOrEqual(beamTop - 2);
    });

    const figureCenterY = layout.measures[0].eventCoordinates[0].y;
    spans.forEach((s) => {
      // ~4 px below the notehead bottoms (glyph half-height ≈ 10 px).
      expect(s.bottom).toBeGreaterThanOrEqual(figureCenterY + 10);
      expect(s.bottom).toBeLessThanOrEqual(figureCenterY + 18);
    });
  });

  // System-level number texts: <text> drawn directly on the SVG root.
  const measureNumbers = (svg: Element | null): Array<{ x: number; y: number }> => {
    if (!svg) return [];
    const numbers: Array<{ x: number; y: number }> = [];
    for (const t of svg!.querySelectorAll('text')) {
      const parent = t.parentElement;
      const parentClass = parent ? parent.getAttribute('class') : null;
      const content = (t.textContent ?? '').trim();
      if (!parentClass && /^\d+$/.test(content)) {
        numbers.push({
          x: parseFloat(t.getAttribute('x') ?? ''),
          y: parseFloat(t.getAttribute('y') ?? ''),
        });
      }
    }
    return numbers;
  };

  it('places measure numbers above the first note, clear of every barline', () => {
    const readingLine: ReadingLine = {
      id: 'test-measure-numbers',
      title: 'Measure Numbers Clear Of Barlines',
      tier: 1,
      measures: [0, 1, 2, 3].map((i) => createTestMeasure(i, [0.5, 0.5, 1.0, 1.0, 0.5, 0.5])),
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 500, measuresPerSystem: 2 });

    const svg = container.querySelector('svg');
    const numbers = measureNumbers(svg);
    // Two systems → one number per system, above the first note's column.
    expect(numbers.length).toBe(2);

    const firstEventX = layout.measures[0].eventCoordinates[0].x;
    const secondSystemEventX = layout.measures[2].eventCoordinates[0].x;

    const systemStartXs = [layout.measures[0].x, layout.measures[2].x];
    numbers.forEach((n, idx) => {
      const columnX = idx === 0 ? firstEventX : secondSystemEventX;
      expect(Math.abs(n.x - columnX)).toBeLessThanOrEqual(2);
      // Clear of the system's start barline x-span.
      expect(n.x).toBeGreaterThan(systemStartXs[idx] + 10);
    });
    // Numbers sit above the top of the system's music block.
    const rects = beamRects(svg);
    [0, 2].forEach((measureIdx, sysIdx) => {
      const systemTop = layout.measures[measureIdx].y;
      const sysBeamTop = Math.min(
        ...rects.filter((r) => r.top > systemTop).map((r) => r.top),
      );
      expect(numbers[sysIdx].y).toBeLessThan(sysBeamTop);
    });
  });

  // Left-edge anchor x of each system's percussion clef glyph.
  const clefXs = (svg: Element | null): number[] => {
    if (!svg) return [];
    const xs: number[] = [];
    for (const g of svg!.querySelectorAll('g[class="vf-clef"]')) {
      const t = g.querySelector('text');
      const x = parseFloat(t?.getAttribute('x') ?? '');
      if (!isNaN(x)) xs.push(x);
    }
    return xs;
  };

  it('clears the clef, time signature and first note from the start barline', () => {
    const readingLine: ReadingLine = {
      id: 'test-clef-clearance',
      title: 'Clef Clears The Start Barline',
      tier: 1,
      measures: [0, 1, 2].map((i) => createTestMeasure(i, [1, 1, 1, 1])),
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 800, measuresPerSystem: 2 });

    const svg = container.querySelector('svg');
    const xs = clefXs(svg);
    // One clef per system (3 measures at 2 per system).
    expect(xs.length).toBe(2);

    const systemStartXs = [layout.measures[0].x, layout.measures[2].x];
    xs.forEach((x, idx) => {
      const gap = x - systemStartXs[idx];
      // ~10–12 px between the start barline and the clef's left edge.
      expect(gap).toBeGreaterThanOrEqual(9);
      expect(gap).toBeLessThanOrEqual(13);
    });

    // Layout contract reflects the shift: the header measures' note columns
    // start after the cleared header, so playhead anchors do too.
    [layout.measures[0], layout.measures[2]].forEach((m) => {
      expect(m.noteStartX).toBeGreaterThanOrEqual(m.x + 10);
    });
  });

  it('renders intra-measure and cross-bar ties', () => {
    const m0Events = [
      createRhythmicEvent({ id: 'm0-e0', durationBeats: 1.0 }),
      createRhythmicEvent({ id: 'm0-e1', durationBeats: 1.0 }),
      createRhythmicEvent({ id: 'm0-e2', durationBeats: 1.0 }),
      createRhythmicEvent({ id: 'm0-e3', durationBeats: 1.0, hasTieToNext: true }),
    ];
    const m1Events = [
      createRhythmicEvent({ id: 'm1-e0', durationBeats: 1.0, hasTieFromPrev: true }),
      createRhythmicEvent({ id: 'm1-e1', durationBeats: 1.0, hasTieToNext: true }),
      createRhythmicEvent({ id: 'm1-e2', durationBeats: 1.0, hasTieFromPrev: true }),
      createRhythmicEvent({ id: 'm1-e3', durationBeats: 1.0 }),
    ];

    const readingLine: ReadingLine = {
      id: 'test-ties',
      title: 'Tie Line',
      tier: 3,
      measures: [
        { index: 0, timeSignature: [4, 4], events: m0Events, totalBeats: 4.0 },
        { index: 1, timeSignature: [4, 4], events: m1Events, totalBeats: 4.0 },
      ],
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 800, measuresPerSystem: 2 });

    expect(layout.measures).toHaveLength(2);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('lays out multi-measure scores into systems (rows)', () => {
    const measures = [
      createTestMeasure(0, [1, 1, 1, 1]),
      createTestMeasure(1, [1, 1, 1, 1]),
      createTestMeasure(2, [1, 1, 1, 1]),
      createTestMeasure(3, [1, 1, 1, 1]),
    ];
    const readingLine: ReadingLine = {
      id: 'test-multi',
      title: 'Four Measures Two Systems',
      tier: 1,
      measures,
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, {
      width: 600,
      measuresPerSystem: 2,
      staveSpacing: 110,
    });

    expect(layout.systemCount).toBe(2);
    expect(layout.measures[0].systemIndex).toBe(0);
    expect(layout.measures[1].systemIndex).toBe(0);
    expect(layout.measures[2].systemIndex).toBe(1);
    expect(layout.measures[3].systemIndex).toBe(1);

    // Staves on system 1 have higher Y coordinate than system 0
    expect(layout.measures[2].y).toBeGreaterThan(layout.measures[0].y);
    expect(layout.measures[3].y).toBe(layout.measures[2].y);
  });

  it('calculates playhead positions smoothly across measures and beats', () => {
    const measure = createTestMeasure(0, [1, 1, 1, 1]);
    const readingLine: ReadingLine = {
      id: 'test-playhead',
      title: 'Playhead Timing',
      tier: 1,
      measures: [measure],
    };

    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, readingLine, { width: 500 });

    const pos0 = layout.getPlayheadPosition(0, 0.0);
    const pos1 = layout.getPlayheadPosition(0, 1.0);
    const pos2 = layout.getPlayheadPosition(0, 2.0);
    const pos3 = layout.getPlayheadPosition(0, 3.0);
    const pos4 = layout.getPlayheadPosition(0, 4.0);

    expect(pos0).not.toBeNull();
    expect(pos1).not.toBeNull();
    expect(pos2).not.toBeNull();
    expect(pos3).not.toBeNull();
    expect(pos4).not.toBeNull();

    expect(pos0!.x).toBeLessThan(pos1!.x);
    expect(pos1!.x).toBeLessThan(pos2!.x);
    expect(pos2!.x).toBeLessThan(pos3!.x);
    expect(pos3!.x).toBeLessThan(pos4!.x);

    // Looping measure index wraps around
    const loopPos = layout.getPlayheadPosition(1, 0.0);
    expect(loopPos).not.toBeNull();
    expect(loopPos!.measureIndex).toBe(0);
  });

  it('renders Reed Page 37 Exercise One without errors', () => {
    const renderer = new ReadingScoreRenderer();
    const layout = renderer.render(container, REED_PAGE_37_EXERCISE_ONE, {
      width: 800,
      measuresPerSystem: 4,
    });

    expect(layout.measures).toHaveLength(32);
    expect(layout.systemCount).toBe(8);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('draws dividing barlines between measures on the one-line stave', () => {
    const readingLine: ReadingLine = {
      id: 'test-barlines',
      title: 'Barlines Test',
      tier: 1,
      measures: [0, 1, 2].map((i) => createTestMeasure(i, [1, 1, 1, 1])),
    };

    const renderer = new ReadingScoreRenderer();
    renderer.render(container, readingLine, { width: 800, measuresPerSystem: 3 });

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();

    // Each measure starts with a thin barline (system start + 2 dividers),
    // plus the final barline pair (thin + thick) at the end of the score.
    const barlineGroups = svg!.querySelectorAll('g[class="vf-barline"]');
    expect(barlineGroups).toHaveLength(5);

    // Barlines span a visible height around the single stave line
    const dividerPath = barlineGroups[1].querySelector('path');
    expect(dividerPath).toBeTruthy();
    const yValues = ((dividerPath!.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g) || [])
      .map(Number)
      .filter((_, i) => i % 2 === 1);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThanOrEqual(20);
  });
});
