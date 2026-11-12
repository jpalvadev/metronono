import * as Tone from 'tone';
import { OstinatoType } from '../domain/dawson/types';

export type MixerChannelId = 'click' | 'ostinato' | 'orchestration';

// The three Mixing Channels every click and drum hit belongs to.
// See docs/adr/0005 and docs/adr/0008.
export const MIXING_CHANNELS: MixerChannelId[] = ['click', 'ostinato', 'orchestration'];

export interface ChannelState {
  volume: number; // 0.0 to 1.0
  muted: boolean;
}

export interface AudioMixerState {
  click: ChannelState;
  ostinato: ChannelState;
  orchestration: ChannelState;
}

export interface IGainNodeLike {
  gain: {
    value: number;
    rampTo?: (val: number, rampTime?: number) => void;
  };
  connect?(destination: any): any;
  toDestination?(): any;
  disconnect?(): any;
  dispose?(): void;
}

export interface AudioMixerOptions {
  initialState?: Partial<Record<MixerChannelId, Partial<ChannelState>>>;
}

export interface IAudioMixer {
  initToneNodes(): boolean;
  isGraphInitialized(): boolean;
  getChannelVolume(channel: MixerChannelId): number;
  setChannelVolume(channel: MixerChannelId, volume: number): void;
  isChannelMuted(channel: MixerChannelId): boolean;
  setChannelMute(channel: MixerChannelId, muted: boolean): void;
  toggleChannelMute(channel: MixerChannelId): boolean;
  // Volume a scheduled click or drum hit is actually heard at on this channel.
  getEffectiveVolume(channel: MixerChannelId): number;
  // Whether that volume leaves the channel able to be heard at all.
  isChannelAudible(channel: MixerChannelId): boolean;
  getState(): AudioMixerState;
  onStateChange(listener: (state: AudioMixerState) => void): () => void;
  // Throws when the graph has not been built: there is no second route to the destination.
  getChannelNode(channel: MixerChannelId): IGainNodeLike;
  getAuditionNode(channel: MixerChannelId): IGainNodeLike;
  dispose?(): void;
}

// Which Mixing Channels the active Dawson System actually composes into. A channel that is
// not composed has nothing behind it.
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

interface ChannelNodes {
  main: IGainNodeLike;
  audition: IGainNodeLike;
}

function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume));
}

function labelNode<T extends IGainNodeLike>(node: T, label: string): T {
  (node as { label?: string }).label = label;
  return node;
}

/**
 * AudioMixer — owns the audio graph: the three Mixing Channel gain nodes and the Audition
 * node each Mixing Channel feeds it shares, connected directly to the audio destination.
 * Mutes and volumes are written on the node the Mixing Channel itself owns.
 */
export class AudioMixer implements IAudioMixer {
  private channels: Record<MixerChannelId, ChannelState> = {
    click: { volume: 0.8, muted: false },
    ostinato: { volume: 0.8, muted: false },
    orchestration: { volume: 0.8, muted: false },
  };

  private channelNodes: Partial<Record<MixerChannelId, ChannelNodes>> = {};
  private masterGain: IGainNodeLike | null = null;
  private masterLimiter: Tone.Limiter | null = null;
  private listeners: Set<(state: AudioMixerState) => void> = new Set();

  constructor(options?: AudioMixerOptions) {
    if (options?.initialState) {
      for (const channel of MIXING_CHANNELS) {
        const initial = options.initialState[channel];
        if (initial) {
          if (typeof initial.volume === 'number') {
            this.channels[channel].volume = clampVolume(initial.volume);
          }
          if (typeof initial.muted === 'boolean') {
            this.channels[channel].muted = initial.muted;
          }
        }
      }
    }
  }

  /**
   * Builds the Mixing Channel and Audition nodes connected directly to destination.
   * Eagerly called by the scheduler, idempotent, and retry-safe: a browser that refuses
   * to build nodes before its audio context is unlocked can simply call again. Returns false
   * when the audio context is unavailable, in which case nothing reaches the destination.
   */
  public initToneNodes(): boolean {
    if (this.isGraphInitialized()) return true;

    let masterLimiter: Tone.Limiter | null = null;
    let masterGain: IGainNodeLike | null = null;
    const nodes: Partial<Record<MixerChannelId, ChannelNodes>> = {};

    try {
      // Master bus with headroom (-8 dB) and a limiter (-3 dBFS) so summing simultaneous
      // click, ostinato, and orchestration transients never clips digital output.
      masterLimiter = labelNode(new Tone.Limiter(-3) as unknown as IGainNodeLike, 'mixer:master:limiter') as unknown as Tone.Limiter;
      masterLimiter.toDestination();

      masterGain = labelNode(new Tone.Gain(0.4) as unknown as IGainNodeLike, 'mixer:master:gain');
      masterGain.connect?.(masterLimiter);

      for (const channel of MIXING_CHANNELS) {
        const mainGain = new Tone.Gain(this.getEffectiveVolume(channel));
        mainGain.connect(masterGain as any);

        // The Audition node is never silenced: it holds the channel volume so a tap on a
        // muted channel is still heard at that channel's volume.
        const auditionGain = new Tone.Gain(this.channels[channel].volume);
        auditionGain.connect(masterGain as any);

        nodes[channel] = {
          main: labelNode(mainGain as unknown as IGainNodeLike, `mixer:${channel}`),
          audition: labelNode(auditionGain as unknown as IGainNodeLike, `audition:${channel}`),
        };
      }
      this.masterLimiter = masterLimiter;
      this.masterGain = masterGain;
      this.channelNodes = nodes;
      return true;
    } catch {
      // Fail closed: a half built graph is torn down so no sound can reach the destination.
      for (const channel of MIXING_CHANNELS) {
        const built = nodes[channel];
        if (built) {
          built.main.disconnect?.();
          built.audition.disconnect?.();
        }
      }
      masterGain?.disconnect?.();
      masterLimiter?.disconnect?.();
      this.masterGain = null;
      this.masterLimiter = null;
      this.channelNodes = {};
      return false;
    }
  }

  public isGraphInitialized(): boolean {
    return MIXING_CHANNELS.every((channel) => this.channelNodes[channel] !== undefined);
  }

  public getChannelVolume(channel: MixerChannelId): number {
    return this.channels[channel].volume;
  }

  public setChannelVolume(channel: MixerChannelId, volume: number): void {
    this.channels[channel].volume = clampVolume(volume);
    this.updateChannelNodes(channel);
    this.notifyState();
  }

  public isChannelMuted(channel: MixerChannelId): boolean {
    return this.channels[channel].muted;
  }

  public setChannelMute(channel: MixerChannelId, muted: boolean): void {
    this.channels[channel].muted = muted;
    this.updateChannelNodes(channel);
    this.notifyState();
  }

  public toggleChannelMute(channel: MixerChannelId): boolean {
    const nextState = !this.channels[channel].muted;
    this.setChannelMute(channel, nextState);
    return nextState;
  }

  public getEffectiveVolume(channel: MixerChannelId): number {
    return this.channels[channel].muted ? 0.0 : this.channels[channel].volume;
  }

  /**
   * A Mixing Channel can be heard when the volume its slider holds is not zero, muted or not:
   * turning a Channel all the way down silences it exactly as its mute does.
   */
  public isChannelAudible(channel: MixerChannelId): boolean {
    return this.getEffectiveVolume(channel) > 0;
  }

  public getState(): AudioMixerState {
    return {
      click: { ...this.channels.click },
      ostinato: { ...this.channels.ostinato },
      orchestration: { ...this.channels.orchestration },
    };
  }

  public onStateChange(listener: (state: AudioMixerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getChannelNode(channel: MixerChannelId): IGainNodeLike {
    const nodes = this.channelNodes[channel];
    if (!nodes) {
      throw new Error(
        `AudioMixer: Mixing Channel '${channel}' has no node. Call initToneNodes() first.`
      );
    }
    return nodes.main;
  }

  public getAuditionNode(channel: MixerChannelId): IGainNodeLike {
    const nodes = this.channelNodes[channel];
    if (!nodes) {
      throw new Error(
        `AudioMixer: Audition node for '${channel}' is unavailable. Call initToneNodes() first.`
      );
    }
    return nodes.audition;
  }

  public dispose(): void {
    this.listeners.clear();
    for (const channel of MIXING_CHANNELS) {
      const nodes = this.channelNodes[channel];
      if (nodes) {
        nodes.main.dispose?.();
        nodes.audition.dispose?.();
      }
    }
    this.masterGain?.dispose?.();
    this.masterLimiter?.dispose?.();
    this.masterGain = null;
    this.masterLimiter = null;
    this.channelNodes = {};
  }

  private updateChannelNodes(channel: MixerChannelId): void {
    const nodes = this.channelNodes[channel];
    if (!nodes) return;

    // Silence is written on the channel's own node, never shared with the Audition node.
    applyGain(nodes.main.gain, this.getEffectiveVolume(channel));
    // The line volume the slider sets is held even while the channel is muted.
    applyGain(nodes.audition.gain, this.channels[channel].volume);
  }

  private notifyState(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

function applyGain(gain: IGainNodeLike['gain'], value: number): void {
  if (gain.rampTo) {
    gain.rampTo(value, 0.02);
  } else {
    gain.value = value;
  }
}
