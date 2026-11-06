import * as Tone from 'tone';

export type MixerChannelId = 'click' | 'ostinato' | 'orchestration';

export interface ChannelState {
  volume: number; // 0.0 to 1.0
  muted: boolean;
}

export interface AudioMixerState {
  click: ChannelState;
  ostinato: ChannelState;
  orchestration: ChannelState;
  master: ChannelState;
}

export interface IGainNodeLike {
  gain: {
    value: number;
    rampTo?: (val: number, rampTime?: number) => void;
  };
  connect?(destination: any): any;
  toDestination?(): any;
  dispose?(): void;
}

export interface AudioMixerOptions {
  channelNodes?: Partial<Record<MixerChannelId, IGainNodeLike>>;
  masterNode?: IGainNodeLike;
  initialState?: Partial<Record<MixerChannelId, Partial<ChannelState>>>;
}

export interface IAudioMixer {
  getChannelVolume(channel: MixerChannelId): number;
  setChannelVolume(channel: MixerChannelId, volume: number): void;
  isChannelMuted(channel: MixerChannelId): boolean;
  setChannelMute(channel: MixerChannelId, muted: boolean): void;
  toggleChannelMute(channel: MixerChannelId): boolean;
  getEffectiveVolume(channel: MixerChannelId): number;
  getMasterVolume(): number;
  setMasterVolume(volume: number): void;
  getState(): AudioMixerState;
  onStateChange(listener: (state: AudioMixerState) => void): () => void;
  getChannelNode?(channel: MixerChannelId): IGainNodeLike | undefined;
  getMasterNode?(): IGainNodeLike | undefined;
  dispose?(): void;
}

export class AudioMixer implements IAudioMixer {
  private channels: Record<MixerChannelId, ChannelState> = {
    click: { volume: 0.8, muted: false },
    ostinato: { volume: 0.8, muted: false },
    orchestration: { volume: 0.8, muted: false },
  };

  private master: ChannelState = {
    volume: 0.8,
    muted: false,
  };

  private channelNodes: Partial<Record<MixerChannelId, IGainNodeLike>> = {};
  private masterNode?: IGainNodeLike;
  private listeners: Set<(state: AudioMixerState) => void> = new Set();

  constructor(options?: AudioMixerOptions) {
    if (options?.initialState) {
      for (const key of Object.keys(options.initialState) as MixerChannelId[]) {
        const item = options.initialState[key];
        if (item) {
          if (typeof item.volume === 'number') {
            this.channels[key].volume = Math.max(0, Math.min(1, item.volume));
          }
          if (typeof item.muted === 'boolean') {
            this.channels[key].muted = item.muted;
          }
        }
      }
    }

    if (options?.channelNodes) {
      this.channelNodes = { ...options.channelNodes };
    }

    if (options?.masterNode) {
      this.masterNode = options.masterNode;
    }
  }

  public initToneNodes(masterDestinationNode?: any): void {
    try {
      if (!this.masterNode && typeof Tone !== 'undefined' && Tone.Gain) {
        const masterGain = new Tone.Gain(this.master.volume);
        if (masterDestinationNode) {
          masterGain.connect(masterDestinationNode);
        } else {
          masterGain.toDestination();
        }
        this.masterNode = masterGain as unknown as IGainNodeLike;
      }

      const channelKeys: MixerChannelId[] = ['click', 'ostinato', 'orchestration'];
      for (const ch of channelKeys) {
        if (!this.channelNodes[ch] && typeof Tone !== 'undefined' && Tone.Gain) {
          const effectiveVol = this.channels[ch].muted ? 0 : this.channels[ch].volume;
          const gain = new Tone.Gain(effectiveVol);
          if (this.masterNode && (gain as any).connect) {
            (gain as any).connect(this.masterNode);
          }
          this.channelNodes[ch] = gain as unknown as IGainNodeLike;
        }
      }
    } catch {
      // In environments without Web Audio API, nodes remain uninitialized
    }
  }

  public getChannelVolume(channel: MixerChannelId): number {
    return this.channels[channel].volume;
  }

  public setChannelVolume(channel: MixerChannelId, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.channels[channel].volume = clamped;
    this.updateChannelNode(channel);
    this.notifyState();
  }

  public isChannelMuted(channel: MixerChannelId): boolean {
    return this.channels[channel].muted;
  }

  public setChannelMute(channel: MixerChannelId, muted: boolean): void {
    this.channels[channel].muted = muted;
    this.updateChannelNode(channel);
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

  public getMasterVolume(): number {
    return this.master.volume;
  }

  public setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.master.volume = clamped;
    if (this.masterNode?.gain) {
      if (this.masterNode.gain.rampTo) {
        this.masterNode.gain.rampTo(clamped, 0.02);
      } else {
        this.masterNode.gain.value = clamped;
      }
    }
    this.notifyState();
  }

  public getState(): AudioMixerState {
    return {
      click: { ...this.channels.click },
      ostinato: { ...this.channels.ostinato },
      orchestration: { ...this.channels.orchestration },
      master: { ...this.master },
    };
  }

  public onStateChange(listener: (state: AudioMixerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getChannelNode(channel: MixerChannelId): IGainNodeLike | undefined {
    return this.channelNodes[channel];
  }

  public getMasterNode(): IGainNodeLike | undefined {
    return this.masterNode;
  }

  public dispose(): void {
    this.listeners.clear();
    for (const key of Object.keys(this.channelNodes) as MixerChannelId[]) {
      const node = this.channelNodes[key];
      if (node && typeof node.dispose === 'function') {
        node.dispose();
      }
    }
    if (this.masterNode && typeof this.masterNode.dispose === 'function') {
      this.masterNode.dispose();
    }
  }

  private updateChannelNode(channel: MixerChannelId): void {
    const node = this.channelNodes[channel];
    if (!node || !node.gain) return;

    const targetGain = this.channels[channel].muted ? 0.0 : this.channels[channel].volume;
    if (node.gain.rampTo) {
      node.gain.rampTo(targetGain, 0.02);
    } else {
      node.gain.value = targetGain;
    }
  }

  private notifyState(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}
