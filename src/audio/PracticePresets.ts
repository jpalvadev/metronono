import {
  AudioMixerState,
  ChannelState,
  IAudioMixer,
  MIXING_CHANNELS,
  MixerChannelId,
} from './AudioMixer';
import { OstinatoType } from '../domain/dawson/types';

/**
 * A Practice Preset is a name for a combination of Mixing Channel mutes. It is derived from
 * the live mixer state and never stored alongside it, and applying one flips mute flags only:
 * volume values a drummer tuned by ear always survive. See GLOSSARY.md and docs/adr/0005.
 */
export type PracticePreset = 'click-only' | 'drums-only' | 'full-mix' | 'custom';

export const PRACTICE_PRESETS: Exclude<PracticePreset, 'custom'>[] = [
  'click-only',
  'drums-only',
  'full-mix',
];

// Which Mixing Channels the active Dawson System actually composes into. A channel that is
// not composed has nothing behind it, so presets neither touch it nor judge the mix by it.
export interface ComposedChannels {
  click: boolean;
  ostinato: boolean;
  orchestration: boolean;
}

export const ALL_CHANNELS_COMPOSED: ComposedChannels = {
  click: true,
  ostinato: true,
  orchestration: true,
};

export interface DawsonComposition {
  getOstinato(): OstinatoType;
}

/**
 * The Click Channel and the orchestrated line are always composed; only the Ostinato Line is
 * a composition choice, and No Ostinato is that choice, not a mute.
 */
export function composedChannels(engine: DawsonComposition): ComposedChannels {
  return {
    click: true,
    ostinato: engine.getOstinato() !== 'none',
    orchestration: true,
  };
}

const PRESET_MUTES: Record<Exclude<PracticePreset, 'custom'>, Record<MixerChannelId, boolean>> = {
  'click-only': { click: false, ostinato: true, orchestration: true },
  'drums-only': { click: true, ostinato: false, orchestration: false },
  'full-mix': { click: false, ostinato: false, orchestration: false },
};

// Silent means the same thing here as it does everywhere else in the mixer: muted, or dragged
// to zero.
function isChannelSilent(channel: ChannelState): boolean {
  return channel.muted || channel.volume <= 0;
}

export function derivePracticePreset(
  state: AudioMixerState,
  composed: ComposedChannels = ALL_CHANNELS_COMPOSED
): PracticePreset {
  const liveChannels = MIXING_CHANNELS.filter((channel) => composed[channel]);
  const isAudible = (channel: MixerChannelId) => !isChannelSilent(state[channel]);

  for (const preset of PRACTICE_PRESETS) {
    const muteFlags = PRESET_MUTES[preset];
    if (liveChannels.every((channel) => isAudible(channel) === !muteFlags[channel])) {
      return preset;
    }
  }

  return 'custom';
}

/** Flips mute flags on the Mixing Channels that have composed content. Never a volume value. */
export function applyPracticePreset(
  mixer: IAudioMixer,
  preset: PracticePreset,
  composed: ComposedChannels = ALL_CHANNELS_COMPOSED
): void {
  if (preset === 'custom') return;

  const muteFlags = PRESET_MUTES[preset];
  for (const channel of MIXING_CHANNELS) {
    if (!composed[channel]) continue;
    if (mixer.isChannelMuted(channel) !== muteFlags[channel]) {
      mixer.setChannelMute(channel, muteFlags[channel]);
    }
  }
}
