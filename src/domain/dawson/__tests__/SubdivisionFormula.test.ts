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
  FACTORY_DAWSON_SYSTEMS,
  FACTORY_OSTINATOS,
  DawsonPresetManager,
} from '../SubdivisionFormula';
import { createRhythmicEvent, Measure } from '../../rhythm/types';

describe('SubdivisionFormula Math & Utilities', () => {
  it('calculates formula duration accurately from strokes including chords and rests', () => {
    const singleStroke: SubdivisionFormula = {
      id: 'test_single',
      name: 'Single',
      trigger: 'short',
      strokes: [
        { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      ],
    };
    expect(calculateFormulaDuration(singleStroke)).toBe(0.5);

    const chordAndRestFormula: SubdivisionFormula = {
      id: 'test_chord_rest',
      name: 'Chord and Rest',
      trigger: 'long',
      strokes: [
        // Beat 1: Chord of Kick + Crash
        {
          durationRatio: 0.25,
          hits: [
            { voice: 'kick', dynamic: 'accent' },
            { voice: 'crash', dynamic: 'accent' },
          ],
        },
        // Beat 1.25: Rest
        {
          durationRatio: 0.25,
          isRest: true,
          hits: [],
        },
        // Beat 1.5: Snare
        {
          durationRatio: 0.5,
          hits: [{ voice: 'snare', dynamic: 'normal' }],
        },
      ],
    };
    expect(calculateFormulaDuration(chordAndRestFormula)).toBe(1.0);

    const tripletFormula: SubdivisionFormula = {
      id: 'test_triplet',
      name: 'Triplet',
      trigger: 'short',
      strokes: [
        { durationRatio: 0.5 / 3, hits: [{ voice: 'kick', dynamic: 'accent' }] },
        { durationRatio: 0.5 / 3, hits: [{ voice: 'snare', dynamic: 'normal' }] },
        { durationRatio: 0.5 / 3, hits: [{ voice: 'tom_high', dynamic: 'normal' }] },
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

  it('resolves sequential stroke offsets relative to note onset for chords and rests', () => {
    const strokes: OrchestratedStroke[] = [
      {
        durationRatio: 0.25,
        hits: [
          { voice: 'kick', dynamic: 'accent' },
          { voice: 'crash', dynamic: 'accent' },
        ],
      },
      { durationRatio: 0.25, isRest: true, hits: [] },
      { durationRatio: 0.5, hits: [{ voice: 'tom_floor', dynamic: 'normal' }] },
    ];

    const resolved = resolveStrokeOffsets(strokes, 1.0);
    expect(resolved).toHaveLength(3);
    expect(resolved[0].offset).toBeCloseTo(1.0);
    expect(resolved[0].stroke.hits).toHaveLength(2);
    expect(resolved[1].offset).toBeCloseTo(1.25);
    expect(resolved[1].stroke.isRest).toBe(true);
    expect(resolved[2].offset).toBeCloseTo(1.5);
    expect(resolved[2].stroke.hits[0].voice).toBe('tom_floor');
  });

  it('scales stroke durations proportionally to target duration', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.25, hits: [{ voice: 'kick', dynamic: 'accent' }] },
      { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ]; // total = 0.5

    const scaled = scaleFormulaStrokes(strokes, 1.0);
    expect(scaled).toHaveLength(2);
    expect(scaled[0].durationRatio).toBeCloseTo(0.5);
    expect(scaled[1].durationRatio).toBeCloseTo(0.5);
  });
});

describe('Default Built-in Formula Library', () => {
  it('contains classic short formulas without limbs', () => {
    expect(DEFAULT_SHORT_FORMULAS.single_snare).toBeDefined();
    expect(DEFAULT_SHORT_FORMULAS.single_snare.trigger).toBe('short');
    expect(DEFAULT_SHORT_FORMULAS.single_snare.strokes[0].hits[0].voice).toBe('snare');

    expect(DEFAULT_SHORT_FORMULAS.flr_triplet).toBeDefined();
    expect(DEFAULT_SHORT_FORMULAS.flr_triplet.strokes).toHaveLength(3);
    expect(DEFAULT_SHORT_FORMULAS.flr_triplet.strokes.map((s) => s.hits[0].voice)).toEqual([
      'kick',
      'snare',
      'tom_high',
    ]);

    expect(DEFAULT_SHORT_FORMULAS.flam_snare).toBeDefined();
    expect(DEFAULT_SHORT_FORMULAS.flam_snare.strokes[0].hits[0].dynamic).toBe('flam');

    expect(DEFAULT_SHORT_FORMULAS.drag_snare).toBeDefined();
    expect(DEFAULT_SHORT_FORMULAS.drag_snare.strokes[0].hits[0].dynamic).toBe('drag');
  });

  it('contains classic long formulas without limbs', () => {
    expect(DEFAULT_LONG_FORMULAS.single_kick).toBeDefined();
    expect(DEFAULT_LONG_FORMULAS.single_kick.trigger).toBe('long');

    expect(DEFAULT_LONG_FORMULAS.linear_diddle).toBeDefined();
    expect(DEFAULT_LONG_FORMULAS.linear_diddle.strokes).toHaveLength(6);
    expect(DEFAULT_LONG_FORMULAS.linear_diddle.strokes[0].hits[0].voice).toBe('kick');
    expect(DEFAULT_LONG_FORMULAS.linear_diddle.strokes[1].hits[0].voice).toBe('snare');

    expect(DEFAULT_LONG_FORMULAS.linear_paradiddle).toBeDefined();
    expect(DEFAULT_LONG_FORMULAS.linear_paradiddle.strokes).toHaveLength(4);
    expect(DEFAULT_LONG_FORMULAS.linear_paradiddle.strokes.map((s) => s.hits[0].voice)).toEqual([
      'kick',
      'snare',
      'tom_high',
      'tom_high',
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
    expect(DEFAULT_DAWSON_SYSTEMS.tony_williams_flr.longFormula.id).toBe('single_kick');

    expect(DEFAULT_DAWSON_SYSTEMS.linear_diddle_fusion.longFormula.id).toBe('linear_diddle');
  });
});

describe('DawsonEngine Polyphonic Orchestration with Formulas', () => {
  let engine: DawsonEngine;

  beforeEach(() => {
    engine = new DawsonEngine({ ostinato: 'none' });
  });

  it('orchestrates short notes using Tony Williams F-L-R triplet formula', () => {
    engine.setShortFormula(DEFAULT_SHORT_FORMULAS.flr_triplet);
    engine.setLongFormula(DEFAULT_LONG_FORMULAS.single_kick);

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
    expect(events).toHaveLength(5);

    expect(events[0].voice).toBe('kick');
    expect(events[0].timeInMeasure).toBe(0);

    expect(events[1].voice).toBe('snare');
    expect(events[1].timeInMeasure).toBeCloseTo(0.167, 2);

    expect(events[2].voice).toBe('tom_high');
    expect(events[2].timeInMeasure).toBeCloseTo(0.333, 2);

    expect(events[3].voice).toBe('kick');
    expect(events[3].timeInMeasure).toBe(1.0);

    expect(events[4].voice).toBe('kick');
    expect(events[4].timeInMeasure).toBe(2.0);

    // Verify limb field is not present on scheduled events
    events.forEach((evt) => {
      expect((evt as unknown as Record<string, unknown>).limb).toBeUndefined();
    });
  });

  it('schedules simultaneous unisons (chords) at the exact same metric timestamp', () => {
    const chordFormula: SubdivisionFormula = {
      id: 'kick_crash_unison',
      name: 'Kick Crash Unison',
      trigger: 'long',
      strokes: [
        {
          durationRatio: 0.5,
          hits: [
            { voice: 'kick', dynamic: 'accent' },
            { voice: 'crash', dynamic: 'accent' },
          ],
        },
        {
          durationRatio: 0.5,
          hits: [{ voice: 'snare', dynamic: 'normal' }],
        },
      ],
    };

    engine.setLongFormula(chordFormula);

    const measure: Measure = {
      index: 0,
      timeSignature: [4, 4],
      totalBeats: 4,
      events: [
        createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
      ],
    };

    const events = engine.resolveOrchestrationEvents(measure);
    expect(events).toHaveLength(3);

    // Two simultaneous events at time 0
    const downbeatEvents = events.filter((e) => e.timeInMeasure === 0);
    expect(downbeatEvents).toHaveLength(2);
    expect(downbeatEvents.map((e) => e.voice).sort()).toEqual(['crash', 'kick']);
    expect(downbeatEvents[0].dynamic).toBe('accent');
    expect(downbeatEvents[1].dynamic).toBe('accent');

    // Snare at time 0.5
    expect(events[2]).toMatchObject({
      timeInMeasure: 0.5,
      voice: 'snare',
      dynamic: 'normal',
    });
  });

  it('skips rests and advances metric clock without creating audible events', () => {
    const formulaWithRest: SubdivisionFormula = {
      id: 'syncopated_rest',
      name: 'Syncopated Rest Formula',
      trigger: 'short',
      strokes: [
        { durationRatio: 0.25, isRest: true, hits: [] },
        { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'accent' }] },
      ],
    };

    engine.setShortFormula(formulaWithRest);

    const measure: Measure = {
      index: 0,
      timeSignature: [4, 4],
      totalBeats: 4,
      events: [
        createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
      ],
    };

    const events = engine.resolveOrchestrationEvents(measure);
    // Only 1 sounding event, at offset 0.25 (since offset 0 is a rest)
    expect(events).toHaveLength(1);
    expect(events[0].voice).toBe('snare');
    expect(events[0].timeInMeasure).toBe(0.25);
    expect(events[0].dynamic).toBe('accent');
  });

  it('applies a complete DawsonSystem preset via setSystem without changing ostinato', () => {
    engine.setOstinato('straight_8ths_hihat');
    const system = FACTORY_DAWSON_SYSTEMS.snare_and_kick || DEFAULT_DAWSON_SYSTEMS.classic_bop;
    engine.setSystem(system);

    expect(engine.getSystem()?.id).toBe(system.id);
    expect(engine.getShortFormula().id).toBe('single_snare');
    expect(engine.getLongFormula().id).toBe('single_kick');
    // Crucial decoupling requirement: setting a system does not change ostinato!
    expect(engine.getOstinato()).toBe('straight_8ths_hihat');
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

  it('allows saving, retrieving, updating, and deleting custom polyphonic formulas', () => {
    const customFormula: SubdivisionFormula = {
      id: 'custom_quad',
      name: 'Custom Quad Fill',
      trigger: 'short',
      strokes: [
        { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'accent' }] },
        { durationRatio: 0.125, hits: [{ voice: 'tom_high', dynamic: 'normal' }] },
        { durationRatio: 0.125, isRest: true, hits: [] },
        {
          durationRatio: 0.125,
          hits: [
            { voice: 'tom_floor', dynamic: 'accent' },
            { voice: 'kick', dynamic: 'accent' },
          ],
        },
      ],
    };

    manager.saveFormula(customFormula);
    expect(manager.getFormula('custom_quad')).toBeDefined();
    expect(manager.getFormula('custom_quad')?.name).toBe('Custom Quad Fill');
    expect(manager.getFormula('custom_quad')?.strokes[3].hits).toHaveLength(2);

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

  it('allows saving and deleting custom systems without ostinatoId', () => {
    const customSystem: DawsonSystem = {
      id: 'custom_bop_fusion',
      name: 'Custom Bop Fusion',
      shortFormula: DEFAULT_SHORT_FORMULAS.flr_triplet,
      longFormula: DEFAULT_LONG_FORMULAS.linear_diddle,
    };

    manager.saveSystem(customSystem);
    expect(manager.getSystem('custom_bop_fusion')).toBeDefined();

    const deleted = manager.deleteSystem('custom_bop_fusion');
    expect(deleted).toBe(true);
    expect(manager.getSystem('custom_bop_fusion')).toBeUndefined();
  });

  describe('Factory Ostinatos & Systems Immutability and Decoupled CRUD', () => {
    it('provides FACTORY_OSTINATOS and FACTORY_DAWSON_SYSTEMS with accurate definitions', () => {
      expect(FACTORY_OSTINATOS.jazz_swing).toBeDefined();
      expect(FACTORY_OSTINATOS.jazz_swing.timeSignature).toEqual([4, 4]);
      expect(calculateFormulaDuration(FACTORY_OSTINATOS.jazz_swing.strokes)).toBe(4.0);

      expect(FACTORY_OSTINATOS.straight_8ths_hihat).toBeDefined();
      expect(FACTORY_OSTINATOS.straight_8ths_hihat.timeSignature).toEqual([4, 4]);
      expect(calculateFormulaDuration(FACTORY_OSTINATOS.straight_8ths_hihat.strokes)).toBe(4.0);

      expect(FACTORY_DAWSON_SYSTEMS.snare_and_kick).toBeDefined();
      expect(FACTORY_DAWSON_SYSTEMS.snare_and_kick.shortFormula.id).toBe('single_snare');
      expect(FACTORY_DAWSON_SYSTEMS.snare_and_kick.longFormula.id).toBe('single_kick');

      expect(FACTORY_DAWSON_SYSTEMS.hihat_foot_and_kick).toBeDefined();
      expect(FACTORY_DAWSON_SYSTEMS.hihat_foot_and_kick.shortFormula.id).toBe('single_hihat_foot');
      expect(FACTORY_DAWSON_SYSTEMS.hihat_foot_and_kick.longFormula.id).toBe('single_kick');
    });

    it('manages full CRUD for OstinatoPattern entities with persistence', () => {
      const allOstinatos = manager.getAllOstinatos();
      expect(allOstinatos.length).toBeGreaterThanOrEqual(2);
      expect(allOstinatos.some((o) => o.id === 'jazz_swing')).toBe(true);
      expect(allOstinatos.some((o) => o.id === 'straight_8ths_hihat')).toBe(true);

      const customOstinato = {
        id: 'baiao_feet',
        name: 'Baiao Ostinato',
        timeSignature: [4, 4] as [number, number],
        strokes: [
          { durationRatio: 1.0, hits: [{ voice: 'hihat_foot' as const, dynamic: 'normal' as const }] },
          { durationRatio: 1.0, hits: [{ voice: 'hihat_foot' as const, dynamic: 'accent' as const }] },
          { durationRatio: 1.0, hits: [{ voice: 'hihat_foot' as const, dynamic: 'normal' as const }] },
          { durationRatio: 1.0, hits: [{ voice: 'hihat_foot' as const, dynamic: 'accent' as const }] },
        ],
      };

      manager.saveOstinato(customOstinato);
      const retrieved = manager.getOstinato('baiao_feet');
      expect(retrieved).toBeDefined();
      expect(retrieved?.isCustom).toBe(true);
      expect(retrieved?.strokes).toHaveLength(4);

      // Verify deletion of custom ostinato
      expect(manager.deleteOstinato('baiao_feet')).toBe(true);
      expect(manager.getOstinato('baiao_feet')).toBeUndefined();
    });

    it('prevents deletion of factory ostinatos and factory systems', () => {
      expect(manager.deleteOstinato('jazz_swing')).toBe(false);
      expect(manager.deleteOstinato('straight_8ths_hihat')).toBe(false);
      expect(manager.deleteSystem('snare_and_kick')).toBe(false);
      expect(manager.deleteSystem('hihat_foot_and_kick')).toBe(false);
    });

    it('normalizes strokes with missing hits when loading formulas and ostinatos from storage', () => {
      const prefix = 'test_normalize_';
      window.localStorage.setItem(
        `${prefix}formulas`,
        JSON.stringify([
          {
            id: 'legacy_formula',
            name: 'Legacy Formula',
            trigger: 'long',
            isCustom: true,
            strokes: [
              { durationRatio: 0.5 },
              { durationRatio: 0.5, hits: [{ voice: 'kick', dynamic: 'normal' }] },
            ],
          },
        ])
      );
      window.localStorage.setItem(
        `${prefix}ostinatos`,
        JSON.stringify([
          {
            id: 'legacy_ostinato',
            name: 'Legacy Ostinato',
            timeSignature: [4, 4],
            isCustom: true,
            strokes: [{ durationRatio: 4.0 }],
          },
        ])
      );

      const reloaded = new DawsonPresetManager({ storagePrefix: prefix });
      const formula = reloaded.getFormula('legacy_formula');
      expect(formula?.strokes[0].hits).toEqual([]);
      expect(formula?.strokes[0].isRest).toBe(true);
      expect(formula?.strokes[1].hits).toHaveLength(1);

      const ostinato = reloaded.getOstinato('legacy_ostinato');
      expect(ostinato?.strokes[0].hits).toEqual([]);
      expect(ostinato?.strokes[0].isRest).toBe(true);

      reloaded.clearCustomData();
    });
  });
});
