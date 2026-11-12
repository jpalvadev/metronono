import { DrumVoice } from '../domain/dawson/types';

export interface DrumVoicePAS {
  key: string;
  stemVoice: 1 | 2; // 1 = Hands (Stem.UP), 2 = Feet (Stem.DOWN)
  line: number; // Stave line offset: 0 = top line (f/5), 4 = bottom line (e/4)
  label?: string;
}

export const DRUM_VOICE_PAS_MAP: Record<DrumVoice, DrumVoicePAS> = {
  hihat_closed: { key: 'g/5/X2', stemVoice: 1, line: -0.5, label: 'Hi-Hat Closed' },
  hihat_open: { key: 'g/5/X2', stemVoice: 1, line: -0.5, label: 'Hi-Hat Open' },
  ride: { key: 'f/5/X2', stemVoice: 1, line: 0, label: 'Ride Cymbal' },
  ride_bell: { key: 'f/5/X3', stemVoice: 1, line: 0, label: 'Ride Bell' },
  crash: { key: 'a/5/X2', stemVoice: 1, line: -1.0, label: 'Crash Cymbal' },
  snare: { key: 'c/5', stemVoice: 1, line: 1.5, label: 'Snare' },
  snare_ghost: { key: 'c/5', stemVoice: 1, line: 1.5, label: 'Snare Ghost' },
  tom_high: { key: 'e/5', stemVoice: 1, line: 0.5, label: 'High Tom' },
  tom_mid: { key: 'd/5', stemVoice: 1, line: 1.0, label: 'Mid Tom' },
  tom_floor: { key: 'a/4', stemVoice: 1, line: 2.5, label: 'Floor Tom' },
  kick: { key: 'f/4', stemVoice: 2, line: 3.5, label: 'Bass Drum (Kick)' },
  hihat_foot: { key: 'd/4/X2', stemVoice: 2, line: 4.0, label: 'Hi-Hat Foot' },
};
