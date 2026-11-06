import { describe, it, expect } from 'vitest';
import {
  getAllReedExercises,
  getReedExercise,
  getReedExerciseById,
  REED_PAGE_33_EXERCISES,
  REED_PAGE_34_EXERCISES,
  REED_PAGE_35_EXERCISES,
  REED_PAGE_36_EXERCISES,
  REED_PAGE_37_EXERCISE_ONE,
  REED_PAGE_38_EXERCISE_TWO,
} from '../ReedLibrary';
import { isMeasureValid } from '../types';

describe('ReedLibrary', () => {
  it('loads all standard exercises without errors', () => {
    expect(REED_PAGE_33_EXERCISES).toHaveLength(12);
    expect(REED_PAGE_34_EXERCISES).toHaveLength(12);
    expect(REED_PAGE_35_EXERCISES).toHaveLength(12);
    expect(REED_PAGE_36_EXERCISES).toHaveLength(12);

    const exercises = getAllReedExercises();
    expect(exercises.length).toBeGreaterThanOrEqual(50); // 12 + 12 + 12 + 12 + 2 = 50

    for (const ex of exercises) {
      expect(ex.id).toBeTruthy();
      expect(ex.title).toBeTruthy();
      expect(ex.measures.length).toBeGreaterThan(0);

      for (const m of ex.measures) {
        expect(isMeasureValid(m)).toBe(true);
        expect(m.totalBeats).toBe(4.0);
      }
    }
  });

  it('can retrieve exercises by ID', () => {
    const ex37 = getReedExerciseById('reed-p37-exercise-one');
    expect(ex37).toBeDefined();
    expect(ex37?.title).toContain('Exercise One');

    const ex38 = getReedExerciseById('reed-p38-exercise-two');
    expect(ex38).toBeDefined();
    expect(ex38?.title).toContain('Exercise Two');

    const ex1 = getReedExerciseById('reed-p33-ex01');
    expect(ex1).toBeDefined();
  });

  it('can retrieve exercises by page and exercise number', () => {
    const p33ex1 = getReedExercise(33, 1);
    expect(p33ex1).toBeDefined();
    expect(p33ex1?.id).toBe('reed-p33-ex01');

    const p34ex13 = getReedExercise(34, 13);
    expect(p34ex13).toBeDefined();

    const p37 = getReedExercise(37);
    expect(p37?.id).toBe('reed-p37-exercise-one');

    const p38 = getReedExercise(38);
    expect(p38?.id).toBe('reed-p38-exercise-two');

    expect(getReedExercise(99)).toBeUndefined();
  });

  describe('Page 37 ("Exercise One")', () => {
    it('has exactly 32 measures', () => {
      expect(REED_PAGE_37_EXERCISE_ONE.measures).toHaveLength(32);
    });

    it('all measures sum to exactly 4.0 beats', () => {
      for (const m of REED_PAGE_37_EXERCISE_ONE.measures) {
        expect(isMeasureValid(m)).toBe(true);
      }
    });

    it('has no two consecutive identical measures', () => {
      const measures = REED_PAGE_37_EXERCISE_ONE.measures;
      for (let i = 1; i < measures.length; i++) {
        const prev = measures[i - 1];
        const curr = measures[i];

        const prevSig = prev.events
          .map((e) => `${e.isRest ? 'r' : 'n'}:${e.durationBeats}`)
          .join('|');
        const currSig = curr.events
          .map((e) => `${e.isRest ? 'r' : 'n'}:${e.durationBeats}`)
          .join('|');

        expect(currSig).not.toBe(prevSig);
      }
    });

    it('matches the benchmark canonical opening measures', () => {
      const m1 = REED_PAGE_37_EXERCISE_ONE.measures[0];
      // M1: Q, Q, E, Q, E
      expect(m1.events.map((e) => e.durationBeats)).toEqual([
        1.0, 1.0, 0.5, 1.0, 0.5,
      ]);
      expect(m1.events.map((e) => e.isRest)).toEqual([
        false,
        false,
        false,
        false,
        false,
      ]);

      const m2 = REED_PAGE_37_EXERCISE_ONE.measures[1];
      // M2: E, Q, E, Q, Q
      expect(m2.events.map((e) => e.durationBeats)).toEqual([
        0.5, 1.0, 0.5, 1.0, 1.0,
      ]);

      const m3 = REED_PAGE_37_EXERCISE_ONE.measures[2];
      // M3: Q, E, E, E, Q, E
      expect(m3.events.map((e) => e.durationBeats)).toEqual([
        1.0, 0.5, 0.5, 0.5, 1.0, 0.5,
      ]);

      const m4 = REED_PAGE_37_EXERCISE_ONE.measures[3];
      // M4: E, Q, E, E, E, Q
      expect(m4.events.map((e) => e.durationBeats)).toEqual([
        0.5, 1.0, 0.5, 0.5, 0.5, 1.0,
      ]);
    });
  });

  describe('Page 38 ("Exercise Two")', () => {
    it('has exactly 32 measures', () => {
      expect(REED_PAGE_38_EXERCISE_TWO.measures).toHaveLength(32);
    });

    it('all measures sum to exactly 4.0 beats', () => {
      for (const m of REED_PAGE_38_EXERCISE_TWO.measures) {
        expect(isMeasureValid(m)).toBe(true);
      }
    });

    it('contains cross-bar ties with paired flags across consecutive measures', () => {
      const measures = REED_PAGE_38_EXERCISE_TWO.measures;
      let crossBarTiesFound = 0;

      for (let i = 0; i < measures.length - 1; i++) {
        const lastEvt = measures[i].events[measures[i].events.length - 1];
        const firstEvtNext = measures[i + 1].events[0];

        if (lastEvt.hasTieToNext) {
          crossBarTiesFound++;
          expect(firstEvtNext.hasTieFromPrev).toBe(true);
        }
      }

      expect(crossBarTiesFound).toBeGreaterThan(0);
    });
  });
});
