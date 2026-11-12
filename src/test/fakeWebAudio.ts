/**
 * Lightweight recording fake `AudioContext` for testing the pure Web Audio engine.
 * Records node creation, graph routing, `GainNode` writes, `AudioBufferSourceNode`
 * start/stop/onended lifecycles, and `decodeAudioData` calls without Tone.js.
 */

export interface FakeAudioParamWrite {
  method: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime' | 'setTargetAtTime';
  value: number;
  time: number;
}

export interface FakeAudioParam {
  value: number;
  writes: FakeAudioParamWrite[];
  setValueAtTime: (value: number, startTime: number) => void;
  linearRampToValueAtTime: (value: number, endTime: number) => void;
  exponentialRampToValueAtTime: (value: number, endTime: number) => void;
  setTargetAtTime: (target: number, startTime: number, timeConstant: number) => void;
  cancelScheduledValues: (cancelTime: number) => void;
}

function createFakeAudioParam(initialValue: number): FakeAudioParam {
  const param: FakeAudioParam = {
    value: initialValue,
    writes: [],
    setValueAtTime: (v: number, t: number) => {
      param.value = v;
      param.writes.push({ method: 'setValueAtTime', value: v, time: t });
    },
    linearRampToValueAtTime: (v: number, t: number) => {
      param.value = v;
      param.writes.push({ method: 'linearRampToValueAtTime', value: v, time: t });
    },
    exponentialRampToValueAtTime: (v: number, t: number) => {
      param.value = v;
      param.writes.push({ method: 'exponentialRampToValueAtTime', value: v, time: t });
    },
    setTargetAtTime: (v: number, t: number) => {
      param.value = v;
      param.writes.push({ method: 'setTargetAtTime', value: v, time: t });
    },
    cancelScheduledValues: () => {},
  };
  return param;
}

export class FakeAudioNode {
  public label?: string;
  public connectedTo: FakeAudioNode[] = [];
  public incoming: FakeAudioNode[] = [];
  public disconnected = false;

  public connect(destination: FakeAudioNode): FakeAudioNode {
    this.disconnected = false;
    if (!this.connectedTo.includes(destination)) {
      this.connectedTo.push(destination);
    }
    if (!destination.incoming.includes(this)) {
      destination.incoming.push(this);
    }
    return destination;
  }

  public disconnect(destination?: FakeAudioNode): void {
    if (destination) {
      this.connectedTo = this.connectedTo.filter((n) => n !== destination);
      destination.incoming = destination.incoming.filter((n) => n !== this);
      if (this.connectedTo.length === 0) {
        this.disconnected = true;
      }
    } else {
      for (const dest of this.connectedTo) {
        dest.incoming = dest.incoming.filter((n) => n !== this);
      }
      this.connectedTo = [];
      this.disconnected = true;
    }
  }
}

export class FakeAudioDestinationNode extends FakeAudioNode {
  constructor() {
    super();
    this.label = 'destination';
  }
}

export class FakeGainNode extends FakeAudioNode {
  public gain: FakeAudioParam;

  constructor(initialGain = 1) {
    super();
    this.gain = createFakeAudioParam(initialGain);
  }
}

export class FakeDynamicsCompressorNode extends FakeAudioNode {
  public threshold = createFakeAudioParam(-24);
  public knee = createFakeAudioParam(30);
  public ratio = createFakeAudioParam(12);
  public attack = createFakeAudioParam(0.003);
  public release = createFakeAudioParam(0.25);
}

export class FakeAudioBuffer {
  public readonly numberOfChannels: number;
  public readonly length: number;
  public readonly sampleRate: number;
  public readonly duration: number;

  constructor(numberOfChannels = 1, length = 4410, sampleRate = 44100) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
  }

  public getChannelData(): Float32Array {
    return new Float32Array(this.length);
  }
}

export class FakeAudioBufferSourceNode extends FakeAudioNode {
  public buffer: FakeAudioBuffer | null = null;
  public playbackRate = createFakeAudioParam(1);
  public loop = false;
  public onended: (() => void) | null = null;
  public startedAt: number | null = null;
  public stoppedAt: number | null = null;
  public ended = false;

  public start(when = 0): void {
    this.startedAt = when;
  }

  public stop(when = 0): void {
    this.stoppedAt = when;
  }

  /**
   * Simulates the browser firing `onended` once playback completes.
   */
  public triggerEnded(): void {
    if (this.ended) return;
    this.ended = true;
    this.onended?.();
  }
}

export class FakeAudioContext {
  public currentTime = 0;
  public state: AudioContextState = 'suspended';
  public sampleRate = 44100;
  public destination = new FakeAudioDestinationNode();

  public gains: FakeGainNode[] = [];
  public compressors: FakeDynamicsCompressorNode[] = [];
  public bufferSources: FakeAudioBufferSourceNode[] = [];
  public decodeCalls: ArrayBuffer[] = [];
  public resumeCount = 0;
  public closeCount = 0;
  public decodeError: Error | null = null;

  public createGain(): FakeGainNode {
    const node = new FakeGainNode(1);
    this.gains.push(node);
    return node;
  }

  public createDynamicsCompressor(): FakeDynamicsCompressorNode {
    const node = new FakeDynamicsCompressorNode();
    this.compressors.push(node);
    return node;
  }

  public createBufferSource(): FakeAudioBufferSourceNode {
    const node = new FakeAudioBufferSourceNode();
    this.bufferSources.push(node);
    return node;
  }

  public createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  public async decodeAudioData(data: ArrayBuffer): Promise<FakeAudioBuffer> {
    this.decodeCalls.push(data);
    if (this.decodeError) {
      throw this.decodeError;
    }
    return new FakeAudioBuffer(1, Math.max(1, data.byteLength), this.sampleRate);
  }

  public async resume(): Promise<void> {
    this.resumeCount += 1;
    this.state = 'running';
  }

  public async close(): Promise<void> {
    this.closeCount += 1;
    this.state = 'closed';
  }

  public advanceTime(seconds: number): void {
    this.currentTime += seconds;
  }

  public routeTo(from: FakeAudioNode, to: FakeAudioNode): FakeAudioNode[] | null {
    const visited = new Set<FakeAudioNode>();
    const dfs = (current: FakeAudioNode): FakeAudioNode[] | null => {
      if (current === to) return [current];
      if (visited.has(current)) return null;
      visited.add(current);
      for (const next of current.connectedTo) {
        const sub = dfs(next);
        if (sub) return [current, ...sub];
      }
      return null;
    };
    return dfs(from);
  }
}

/**
 * Installs a `FakeAudioContext` on `globalThis.AudioContext` and `webkitAudioContext`.
 * Returns the single fake instance that will be constructed and a `restore` callback.
 */
export function installFakeWebAudio(): {
  context: FakeAudioContext;
  restore: () => void;
} {
  const context = new FakeAudioContext();
  const g = globalThis as unknown as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  const prevAudioContext = g.AudioContext;
  const prevWebkitAudioContext = g.webkitAudioContext;

  const FakeCtor = function FakeAudioContextCtor() {
    return context;
  };

  g.AudioContext = FakeCtor;
  g.webkitAudioContext = FakeCtor;

  return {
    context,
    restore: () => {
      g.AudioContext = prevAudioContext;
      g.webkitAudioContext = prevWebkitAudioContext;
    },
  };
}
