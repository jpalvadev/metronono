import { describe, it, expect } from 'vitest';
import { DRUM_VOICE_PAS_MAP } from '../DrumStaffRenderer';

describe('DRUM_VOICE_PAS_MAP', () => {
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
