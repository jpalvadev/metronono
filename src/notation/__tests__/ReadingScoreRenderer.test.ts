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
