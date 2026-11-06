import { describe, it, expect, beforeEach } from 'vitest';
import { DawsonEngine } from '../DawsonEngine';
import {
  SubdivisionFormula,
  DawsonSystem,
  OrchestratedStroke,
} from '../types';
import {
  calculateFormulaDuration,
  scaleFormulaStrokes,
  resolveStrokeOffsets,
  DEFAULT_SHORT_FORMULAS,
  DEFAULT_LONG_FORMULAS,
  DEFAULT_DAWSON_SYSTEMS,
  DawsonPresetManager,
} from '../SubdivisionFormula';
import { createRhythmicEvent, Measure } from '../../rhythm/types';

describe('SubdivisionFormula Math & Utilities', () => {
  it('calculates formula duration accurately from strokes', () => {
    const singleStroke: SubdivisionFormula = {
      id: 'test_single',
      name: 'Single',
      trigger: 'short',
      strokes: [
        { durationRatio: 0.5, voice: 'snare', limb: 'L', dynamic: 'normal' },
      ],
    };
    expect(calculateFormulaDuration(singleStroke)).toBe(0.5);

    const tripletFormula: SubdivisionFormula = {
      id: 'test_triplet',
      name: 'Triplet',
      trigger: 'short',
      strokes: [
        { durationRatio: 0.5 / 3, voice: 'kick', limb: 'RF', dynamic: 'accent' },
        { durationRatio: 0.5 / 3, voice: 'snare', limb: 'L', dynamic: 'normal' },
        { durationRatio: 0.5 / 3, voice: 'tom_high', limb: 'R', dynamic: 'normal' },
      ],
    };
    expect(calculateFormulaDuration(tripletFormula)).toBeCloseTo(0.5, 4);

    const emptyFormula: SubdivisionFormula = {
      id: 'test_empty',
      name: 'Empty',
      trigger: 'short',
      strokes: [],
    };
    expect(calculateFormulaDuration(emptyFormula)).toBe(0);
  });

  it('resolves sequential stroke offsets relative to note onset', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.25, voice: 'kick', limb: 'RF', dynamic: 'accent' },
      { durationRatio: 0.25, voice: 'snare', limb: 'L', dynamic: 'normal' },
      { durationRatio: 0.5, voice: 'tom_floor', limb: 'R', dynamic: 'normal' },
    ];

    const resolved = resolveStrokeOffsets(strokes, 1.0);
    expect(resolved).toHaveLength(3);
    expect(resolved[0].offset).toBeCloseTo(1.0);
    expect(resolved[1].offset).toBeCloseTo(1.25);
    expect(resolved[2].offset).toBeCloseTo(1.5);
  });

  it('scales stroke durations proportionally to target duration', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.25, voice: 'kick', dynamic: 'accent' },
      { durationRatio: 0.25, voice: 'snare', dynamic: 'normal' },
    ]; // total = 0.5

    const scaled = scaleFormulaStrokes(strokes, 1.0);
    expect(scaled).toHaveLength(2);
    expect(scaled[0].durationRatio).toBeCloseTo(0.5);
    expect(scaled[1].durationRatio).toBeCloseTo(0.5);
  });
});

describe('Default Built-in Formula Library', () => {
  it('contains classic short formulas', () => {
    expect(DEFAULT_SHORT_FORMULAS.single_snare).toBeDefined();
    expect(DEFAULT_SHORT_FORMULAS.single_snare.trigger).toBe('short');
    expect(DEFAULT_SHORT_FORMULAS.single_snare.strokes[0].voice).toBe('snare');

    expect(DEFAULT_SHORT_FORMULAS.flr_triplet).toBeDefined();
    expect(DEFAULT_SHORT_FORMULAS.flr_triplet.strokes).toHaveLength(3);
    expect(DEFAULT_SHORT_FORMULAS.flr_triplet.strokes.map((s) => s.limb)).toEqual([
      'RF',
      'L',
      'R',
    ]);
    expect(DEFAULT_SHORT_FORMULAS.flr_triplet.strokes.map((s) => s.voice)).toEqual([
      'kick',
      'snare',
      'tom_high',
    ]);

    expect(DEFAULT_SHORT_FORMULAS.flam_snare).toBeDefined();
    expect(DEFAULT_SHORT_FORMULAS.flam_snare.strokes[0].dynamic).toBe('flam');

    expect(DEFAULT_SHORT_FORMULAS.drag_snare).toBeDefined();
    expect(DEFAULT_SHORT_FORMULAS.drag_snare.strokes[0].dynamic).toBe('drag');
  });

  it('contains classic long formulas', () => {
    expect(DEFAULT_LONG_FORMULAS.single_kick).toBeDefined();
    expect(DEFAULT_LONG_FORMULAS.single_kick.trigger).toBe('long');

    expect(DEFAULT_LONG_FORMULAS.linear_diddle).toBeDefined();
    expect(DEFAULT_LONG_FORMULAS.linear_diddle.strokes).toHaveLength(6);
    expect(DEFAULT_LONG_FORMULAS.linear_diddle.strokes[0].voice).toBe('kick');
    expect(DEFAULT_LONG_FORMULAS.linear_diddle.strokes[1].voice).toBe('snare');

    expect(DEFAULT_LONG_FORMULAS.linear_paradiddle).toBeDefined();
    expect(DEFAULT_LONG_FORMULAS.linear_paradiddle.strokes).toHaveLength(4);
    expect(DEFAULT_LONG_FORMULAS.linear_paradiddle.strokes.map((s) => s.limb)).toEqual([
      'RF',
      'L',
      'R',
      'R',
    ]);

    expect(DEFAULT_LONG_FORMULAS.five_stroke_roll).toBeDefined();
    expect(DEFAULT_LONG_FORMULAS.five_stroke_roll.strokes).toHaveLength(5);

    expect(DEFAULT_LONG_FORMULAS.seven_stroke_roll).toBeDefined();
    expect(DEFAULT_LONG_FORMULAS.seven_stroke_roll.strokes).toHaveLength(7);
  });

  it('contains default Alan Dawson Systems', () => {
    expect(DEFAULT_DAWSON_SYSTEMS.classic_bop).toBeDefined();
    expect(DEFAULT_DAWSON_SYSTEMS.inverted_bop).toBeDefined();
    expect(DEFAULT_DAWSON_SYSTEMS.tony_williams_flr).toBeDefined();
    expect(DEFAULT_DAWSON_SYSTEMS.linear_diddle_fusion).toBeDefined();

    expect(DEFAULT_DAWSON_SYSTEMS.tony_williams_flr.shortFormula.id).toBe('flr_triplet');
    expect(DEFAULT_DAWSON_SYSTEMS.tony_williams_flr.ostinatoId).toBe('jazz_swing');

    expect(DEFAULT_DAWSON_SYSTEMS.linear_diddle_fusion.longFormula.id).toBe('linear_diddle');
  });
});

describe('DawsonEngine Multi-Limb Orchestration with Formulas', () => {
  let engine: DawsonEngine;

  beforeEach(() => {
    engine = new DawsonEngine({ ostinato: 'none' });
  });

  it('orchestrates short notes using Tony Williams F-L-R triplet formula', () => {
    engine.setShortFormula(DEFAULT_SHORT_FORMULAS.flr_triplet);
    engine.setLongFormula(DEFAULT_LONG_FORMULAS.single_kick);

    // Measure: Eighth note (short) on beat 0, Quarter note (long) on beat 1.0, Half note on beat 2.0
    const measure: Measure = {
      index: 0,
      timeSignature: [4, 4],
      totalBeats: 4,
      events: [
        createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
        createRhythmicEvent({ isRest: true, durationBeats: 0.5 }),
        createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
        createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),
      ],
    };

    const events = engine.resolveOrchestrationEvents(measure);

    // Short note at 0 expands to 3 triplet strokes:
    // Stroke 1: kick, RF, time = 0
    // Stroke 2: snare, L, time ≈ 0.167
    // Stroke 3: tom_high, R, time ≈ 0.333
    // Long notes at 1.0 and 2.0 each have 1 kick stroke (RF)
    expect(events).toHaveLength(5);

    expect(events[0].voice).toBe('kick');
    expect(events[0].limb).toBe('RF');
    expect(events[0].timeInMeasure).toBe(0);

    expect(events[1].voice).toBe('snare');
    expect(events[1].limb).toBe('L');
    expect(events[1].timeInMeasure).toBeCloseTo(0.167, 2);

    expect(events[2].voice).toBe('tom_high');
    expect(events[2].limb).toBe('R');
    expect(events[2].timeInMeasure).toBeCloseTo(0.333, 2);

    expect(events[3].voice).toBe('kick');
    expect(events[3].limb).toBe('RF');
    expect(events[3].timeInMeasure).toBe(1.0);

    expect(events[4].voice).toBe('kick');
    expect(events[4].limb).toBe('RF');
    expect(events[4].timeInMeasure).toBe(2.0);
  });

  it('orchestrates long notes using Linear Paradiddle formula', () => {
    engine.setShortFormula(DEFAULT_SHORT_FORMULAS.single_snare);
    engine.setLongFormula(DEFAULT_LONG_FORMULAS.linear_paradiddle);

    // Measure: Quarter note on beat 0
    const measure: Measure = {
      index: 0,
      timeSignature: [4, 4],
      totalBeats: 4,
      events: [
        createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
        createRhythmicEvent({ isRest: true, durationBeats: 3.0 }),
      ],
    };

    const events = engine.resolveOrchestrationEvents(measure);
    expect(events).toHaveLength(4);

    // 4 16th strokes: RF, L, R, R
    expect(events[0]).toMatchObject({
      timeInMeasure: 0,
      voice: 'kick',
      limb: 'RF',
      dynamic: 'accent',
    });
    expect(events[1]).toMatchObject({
      timeInMeasure: 0.25,
      voice: 'snare',
      limb: 'L',
    });
    expect(events[2]).toMatchObject({
      timeInMeasure: 0.5,
      voice: 'tom_high',
      limb: 'R',
    });
    expect(events[3]).toMatchObject({
      timeInMeasure: 0.75,
      voice: 'tom_high',
      limb: 'R',
      dynamic: 'ghost',
    });
  });

  it('applies a complete DawsonSystem preset via setSystem', () => {
    const system = DEFAULT_DAWSON_SYSTEMS.tony_williams_flr;
    engine.setSystem(system);

    expect(engine.getSystem()?.id).toBe('tony_williams_flr');
    expect(engine.getShortFormula().id).toBe('flr_triplet');
    expect(engine.getLongFormula().id).toBe('single_kick');
    expect(engine.getOstinato()).toBe('jazz_swing');
  });
});

describe('DawsonPresetManager CRUD & Persistence', () => {
  let manager: DawsonPresetManager;

  beforeEach(() => {
    manager = new DawsonPresetManager({ storagePrefix: 'test_metronono_' });
    manager.clearCustomData();
  });

  it('provides all default systems and formulas', () => {
    const systems = manager.getAllSystems();
    expect(systems.length).toBeGreaterThanOrEqual(4);
    expect(systems.some((s) => s.id === 'classic_bop')).toBe(true);
    expect(systems.some((s) => s.id === 'tony_williams_flr')).toBe(true);

    const shortFormulas = manager.getFormulasByTrigger('short');
    expect(shortFormulas.some((f) => f.id === 'flr_triplet')).toBe(true);

    const longFormulas = manager.getFormulasByTrigger('long');
    expect(longFormulas.some((f) => f.id === 'linear_paradiddle')).toBe(true);
  });

  it('allows saving, retrieving, updating, and deleting custom formulas', () => {
    const customFormula: SubdivisionFormula = {
      id: 'custom_quad',
      name: 'Custom Quad Fill',
      trigger: 'short',
      strokes: [
        { durationRatio: 0.125, voice: 'snare', limb: 'L', dynamic: 'accent' },
        { durationRatio: 0.125, voice: 'tom_high', limb: 'R', dynamic: 'normal' },
        { durationRatio: 0.125, voice: 'tom_mid', limb: 'L', dynamic: 'normal' },
        { durationRatio: 0.125, voice: 'tom_floor', limb: 'R', dynamic: 'accent' },
      ],
    };

    manager.saveFormula(customFormula);
    expect(manager.getFormula('custom_quad')).toBeDefined();
    expect(manager.getFormula('custom_quad')?.name).toBe('Custom Quad Fill');

    // Update
    manager.saveFormula({
      ...customFormula,
      name: 'Custom Quad Fill V2',
    });
    expect(manager.getFormula('custom_quad')?.name).toBe('Custom Quad Fill V2');

    // Delete
    const deleted = manager.deleteFormula('custom_quad');
    expect(deleted).toBe(true);
    expect(manager.getFormula('custom_quad')).toBeUndefined();
  });

  it('prevents deleting built-in formulas or systems', () => {
    expect(manager.deleteFormula('single_snare')).toBe(false);
    expect(manager.deleteSystem('classic_bop')).toBe(false);
  });

  it('allows saving and deleting custom systems', () => {
    const customSystem: DawsonSystem = {
      id: 'custom_bop_fusion',
      name: 'Custom Bop Fusion',
      shortFormula: DEFAULT_SHORT_FORMULAS.flr_triplet,
      longFormula: DEFAULT_LONG_FORMULAS.linear_diddle,
      ostinatoId: 'jazz_swing',
    };

    manager.saveSystem(customSystem);
    expect(manager.getSystem('custom_bop_fusion')).toBeDefined();

    const deleted = manager.deleteSystem('custom_bop_fusion');
    expect(deleted).toBe(true);
    expect(manager.getSystem('custom_bop_fusion')).toBeUndefined();
  });
});
