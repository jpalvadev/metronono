import { describe, it, expect, beforeEach } from 'vitest';
import { Stem } from 'vexflow';
import {
  DrumStaffRenderer,
  DRUM_VOICE_PAS_MAP,
  DrumScoreMeasure,
} from '../DrumStaffRenderer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { createRhythmicEvent, ReadingLine } from '../../domain/rhythm/types';

describe('DrumStaffRenderer', () => {
  let container: HTMLDivElement;
  let renderer: DrumStaffRenderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderer = new DrumStaffRenderer();
  });

  describe('PAS Standard Mapping', () => {
    it('maps all standard drum voices to correct PAS pitch heights, noteheads, and voices', () => {
      // Voice 1 (Hands, Stem.UP)
      expect(DRUM_VOICE_PAS_MAP.hihat_closed).toMatchObject({
        key: 'g/5/X2',
        stemVoice: 1,
        line: -0.5,
      });
      expect(DRUM_VOICE_PAS_MAP.ride).toMatchObject({
        key: 'f/5/X2',
        stemVoice: 1,
        line: 0,
      });
      expect(DRUM_VOICE_PAS_MAP.crash).toMatchObject({
        key: 'a/5/X2',
        stemVoice: 1,
        line: -1.0,
      });
      expect(DRUM_VOICE_PAS_MAP.snare).toMatchObject({
        key: 'c/5',
        stemVoice: 1,
        line: 1.5,
      });
      expect(DRUM_VOICE_PAS_MAP.tom_high).toMatchObject({
        key: 'e/5',
        stemVoice: 1,
        line: 0.5,
      });
      expect(DRUM_VOICE_PAS_MAP.tom_mid).toMatchObject({
        key: 'd/5',
        stemVoice: 1,
        line: 1.0,
      });
      expect(DRUM_VOICE_PAS_MAP.tom_floor).toMatchObject({
        key: 'a/4',
        stemVoice: 1,
        line: 2.5,
      });

      // Voice 2 (Feet, Stem.DOWN)
      expect(DRUM_VOICE_PAS_MAP.kick).toMatchObject({
        key: 'f/4',
        stemVoice: 2,
        line: 3.5,
      });
      expect(DRUM_VOICE_PAS_MAP.hihat_foot).toMatchObject({
        key: 'd/4/X2',
        stemVoice: 2,
        line: 4.5,
      });
    });
  });

  describe('Rendering 5-Line Percussion Score', () => {
    it('renders a 5-line percussion stave with percussion clef into SVG', () => {
      const measure: DrumScoreMeasure = {
        measureIndex: 0,
        events: [
          { timeInMeasure: 0.0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'ostinato' },
          { timeInMeasure: 1.0, voice: 'snare', velocity: 0.9, dynamic: 'accent', source: 'orchestration' },
          { timeInMeasure: 0.0, voice: 'kick', velocity: 0.9, dynamic: 'normal', source: 'orchestration' },
        ],
      };

      const layout = renderer.render(container, [measure], { width: 500 });

      expect(container.querySelector('svg')).toBeTruthy();
      expect(layout.measures).toHaveLength(1);
      expect(layout.measures[0].width).toBeGreaterThan(100);
    });

    it('separates Voice 1 (hands stem UP) and Voice 2 (feet stem DOWN)', () => {
      const measure: DrumScoreMeasure = {
        measureIndex: 0,
        events: [
          // Voice 1 (Hands)
          { timeInMeasure: 0.0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'ostinato' },
          { timeInMeasure: 1.0, voice: 'snare', velocity: 0.85, dynamic: 'normal', source: 'orchestration' },
          // Voice 2 (Feet)
          { timeInMeasure: 0.0, voice: 'kick', velocity: 0.9, dynamic: 'normal', source: 'orchestration' },
          { timeInMeasure: 1.0, voice: 'hihat_foot', velocity: 0.85, dynamic: 'normal', source: 'ostinato' },
        ],
      };

      const layout = renderer.render(container, [measure], { width: 500 });
      expect(layout.measures[0].eventCoordinates.length).toBeGreaterThan(0);

      // Verify that Voice 1 and Voice 2 were created
      const drumMeasure = layout.drumMeasures[0];
      expect(drumMeasure).toBeDefined();

      const v1Notes = drumMeasure.voice1Notes;
      const v2Notes = drumMeasure.voice2Notes;

      expect(v1Notes.length).toBeGreaterThan(0);
      expect(v2Notes.length).toBeGreaterThan(0);

      // Hands: Stem.UP
      v1Notes.forEach((note) => {
        if (!note.isRest()) {
          expect(note.getStemDirection()).toBe(Stem.UP);
        }
      });

      // Feet: Stem.DOWN
      v2Notes.forEach((note) => {
        if (!note.isRest()) {
          expect(note.getStemDirection()).toBe(Stem.DOWN);
        }
      });
    });

    it('combines simultaneous hits in the same voice into a single chord note', () => {
      const measure: DrumScoreMeasure = {
        measureIndex: 0,
        events: [
          // Simultaneous Ride + Snare on beat 1.0
          { timeInMeasure: 1.0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'ostinato' },
          { timeInMeasure: 1.0, voice: 'snare', velocity: 0.9, dynamic: 'normal', source: 'orchestration' },
          // Simultaneous Kick + Hi-Hat Foot on beat 0.0
          { timeInMeasure: 0.0, voice: 'kick', velocity: 0.9, dynamic: 'normal', source: 'orchestration' },
          { timeInMeasure: 0.0, voice: 'hihat_foot', velocity: 0.8, dynamic: 'normal', source: 'ostinato' },
        ],
      };

      const layout = renderer.render(container, [measure], { width: 500 });
      const drumMeasure = layout.drumMeasures[0];

      // Find the chord in Voice 1 at beat 1.0
      const chordV1 = drumMeasure.voice1Notes.find(
        (n) => !n.isRest() && n.getKeys().includes('f/5/X2') && n.getKeys().includes('c/5')
      );
      expect(chordV1).toBeDefined();

      // Find the chord in Voice 2 at beat 0.0
      const chordV2 = drumMeasure.voice2Notes.find(
        (n) => !n.isRest() && n.getKeys().includes('f/4') && n.getKeys().includes('d/4/X2')
      );
      expect(chordV2).toBeDefined();
    });

    it('calculates playhead position across measures and beats', () => {
      const measure: DrumScoreMeasure = {
        measureIndex: 0,
        events: [
          { timeInMeasure: 0.0, voice: 'kick', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
          { timeInMeasure: 1.0, voice: 'snare', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
          { timeInMeasure: 2.0, voice: 'kick', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
          { timeInMeasure: 3.0, voice: 'snare', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
        ],
      };

      const layout = renderer.render(container, [measure], { width: 600 });
      const pos0 = layout.getPlayheadPosition(0, 0.0);
      const pos1 = layout.getPlayheadPosition(0, 1.0);
      const pos2 = layout.getPlayheadPosition(0, 2.0);
      const pos3 = layout.getPlayheadPosition(0, 3.0);

      expect(pos0).not.toBeNull();
      expect(pos1).not.toBeNull();
      expect(pos2).not.toBeNull();
      expect(pos3).not.toBeNull();

      expect(pos0!.x).toBeLessThan(pos1!.x);
      expect(pos1!.x).toBeLessThan(pos2!.x);
      expect(pos2!.x).toBeLessThan(pos3!.x);
    });

    it('renders reading line via DawsonEngine resolution', () => {
      const dawsonEngine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });
      const readingLine: ReadingLine = {
        id: 'test-dawson-score',
        title: 'Dawson Test Score',
        tier: 1,
        measures: [
          {
            index: 0,
            timeSignature: [4, 4],
            totalBeats: 4,
            events: [
              createRhythmicEvent({ id: 'e0', durationBeats: 1.0 }),
              createRhythmicEvent({ id: 'e1', durationBeats: 1.0 }),
              createRhythmicEvent({ id: 'e2', durationBeats: 1.0 }),
              createRhythmicEvent({ id: 'e3', durationBeats: 1.0 }),
            ],
          },
        ],
      };

      const layout = renderer.renderReadingLineWithDawson(container, readingLine, dawsonEngine, {
        width: 600,
      });

      expect(container.querySelector('svg')).toBeTruthy();
      expect(layout.measures).toHaveLength(1);
      expect(layout.drumMeasures[0].voice1Notes.length).toBeGreaterThan(0);
      expect(layout.drumMeasures[0].voice2Notes.length).toBeGreaterThan(0);
    });

    it('determines the closest drum voice for a given Y pixel offset', () => {
      const measure: DrumScoreMeasure = {
        measureIndex: 0,
        events: [],
      };
      const layout = renderer.render(container, [measure], { width: 500 });
      const mCoord = layout.drumMeasures[0];

      // Voice lookup based on Y:
      // Line -0.5 -> hihat_closed
      // Line 1.5 -> snare
      // Line 3.5 -> kick
      const snareY = mCoord.stave.getYForLine(1.5);
      const voiceAtSnare = layout.getDrumVoiceForY(0, snareY);
      expect(voiceAtSnare).toBe('snare');

      const kickY = mCoord.stave.getYForLine(3.5);
      const voiceAtKick = layout.getDrumVoiceForY(0, kickY);
      expect(voiceAtKick).toBe('kick');
    });

    it('determines the step index (0..15) for a given X pixel offset', () => {
      const measure: DrumScoreMeasure = {
        measureIndex: 0,
        events: [],
      };
      const layout = renderer.render(container, [measure], { width: 500 });
      const mCoord = layout.drumMeasures[0];

      const startX = mCoord.noteStartX;
      const endX = mCoord.noteEndX;

      expect(layout.getStepForX(0, startX)).toBe(0);
      expect(layout.getStepForX(0, endX)).toBe(15);
      const midX = startX + (endX - startX) / 2;
      expect(layout.getStepForX(0, midX)).toBe(8);
    });

    it('renders a sextuplet formula as a 6-tuplet with continuous beam on the drum stave', () => {
      // 6 sixteenth-note strokes spanning 1 beat (offsets 0, 1/6, 2/6, 3/6, 4/6, 5/6)
      const sextupletEvents = [
        { timeInMeasure: 0.0, voice: 'kick' as const, velocity: 0.9, dynamic: 'accent' as const, source: 'orchestration' as const, durationBeats: 1 / 6 },
        { timeInMeasure: 1 / 6, voice: 'snare' as const, velocity: 0.8, dynamic: 'normal' as const, source: 'orchestration' as const, durationBeats: 1 / 6 },
        { timeInMeasure: 2 / 6, voice: 'tom_high' as const, velocity: 0.8, dynamic: 'normal' as const, source: 'orchestration' as const, durationBeats: 1 / 6 },
        { timeInMeasure: 3 / 6, voice: 'snare' as const, velocity: 0.8, dynamic: 'normal' as const, source: 'orchestration' as const, durationBeats: 1 / 6 },
        { timeInMeasure: 4 / 6, voice: 'tom_floor' as const, velocity: 0.8, dynamic: 'normal' as const, source: 'orchestration' as const, durationBeats: 1 / 6 },
        { timeInMeasure: 5 / 6, voice: 'tom_floor' as const, velocity: 0.8, dynamic: 'normal' as const, source: 'orchestration' as const, durationBeats: 1 / 6 },
      ];

      const measure: DrumScoreMeasure = {
        measureIndex: 0,
        events: sextupletEvents,
      };

      const layout = renderer.render(container, [measure], { width: 500 });
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();

      // SVG should contain the tuplet number '6'
      expect(container.innerHTML).toContain('6');

      // Voice 1 should have 6 sixteenth notes for Beat 0 plus quarter rests for beats 1, 2, 3
      const drumMeasure = layout.drumMeasures[0];
      const v1Notes = drumMeasure.voice1Notes;
      expect(v1Notes.length).toBe(9); // 6 tuplet notes + 3 quarter rests
      expect(v1Notes.slice(0, 6).every((n) => n.getDuration() === '16')).toBe(true);
    });

    it('renders an 8th-note triplet formula with tuplet 3 on the drum stave', () => {
      // 3 eighth-note triplet strokes spanning 1 beat (offsets 0, 1/3, 2/3)
      const tripletEvents = [
        { timeInMeasure: 0.0, voice: 'kick' as const, velocity: 0.9, dynamic: 'normal' as const, source: 'orchestration' as const, durationBeats: 1 / 3 },
        { timeInMeasure: 1 / 3, voice: 'snare' as const, velocity: 0.8, dynamic: 'normal' as const, source: 'orchestration' as const, durationBeats: 1 / 3 },
        { timeInMeasure: 2 / 3, voice: 'ride' as const, velocity: 0.8, dynamic: 'normal' as const, source: 'orchestration' as const, durationBeats: 1 / 3 },
      ];

      const measure: DrumScoreMeasure = {
        measureIndex: 0,
        events: tripletEvents,
      };

      const layout = renderer.render(container, [measure], { width: 500 });
      expect(container.innerHTML).toContain('3');

      const drumMeasure = layout.drumMeasures[0];
      const v1Notes = drumMeasure.voice1Notes;
      expect(v1Notes.length).toBe(6); // 3 tuplet notes + 3 quarter rests
      expect(v1Notes.slice(0, 3).every((n) => n.getDuration() === '8')).toBe(true);
    });
  });
});
