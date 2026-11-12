/**
 * Recording fake Tone harness (ADR-0005, ticket-01).
 *
 * jsdom has no usable AudioContext: real Tone nodes throw while constructing
 * their AudioParams ("param must be an AudioParam"), so no jsdom suite can host
 * the app's audio graph. Suites that need to inspect the graph register this
 * module as a replacement for `tone` with a per-suite module mock:
 *
 *   vi.mock('tone', async () => {
 *     const fake = await import('../../test/fakeTone')
 *     return { ...fake.fakeToneModule }
 *   })
 *
 * The replacement implements the slice of the Tone surface the audio layer
 * actually calls. Every fake node records the connections made to and from it
 * and every value written to its gain (constructor value, direct `.value`
 * writes, `setValueAtTime` and ramped writes), so a test can assert the shape of
 * the graph and the values a slider or mute wrote, without reimplementing audio
 * behaviour in assertions.
 *
 * This module is never registered in the global test setup: suites that do not
 * opt in keep using real Tone.
 */

export type FakeGainWriteMethod =
  | 'initial'
  | 'value'
  | 'setValueAtTime'
  | 'linearRampToValueAtTime'
  | 'exponentialRampToValueAtTime'
  | 'rampTo'

export interface FakeGainWrite {
  method: FakeGainWriteMethod
  value: number
  time?: number
}

/** Fake `AudioParam`-like value holder that records everything written to it. */
export class FakeGainParam {
  readonly writes: FakeGainWrite[] = []
  /** Node this parameter belongs to, so `connect(param)` can be recorded. */
  owner: FakeToneNode | null = null
  private current: number

  constructor(initial = 1) {
    this.current = initial
    this.writes.push({ method: 'initial', value: initial })
  }

  get value(): number {
    return this.current
  }

  set value(next: number) {
    this.current = next
    this.writes.push({ method: 'value', value: next })
  }

  public setValueAtTime(value: number, time: number): this {
    this.current = value
    this.writes.push({ method: 'setValueAtTime', value, time })
    return this
  }

  public linearRampToValueAtTime(value: number, endTime: number): this {
    this.current = value
    this.writes.push({ method: 'linearRampToValueAtTime', value, time: endTime })
    return this
  }

  public exponentialRampToValueAtTime(value: number, endTime: number): this {
    this.current = value
    this.writes.push({ method: 'exponentialRampToValueAtTime', value, time: endTime })
    return this
  }

  /** Tone's convenience ramp: reaches `value` after `rampTime` seconds. */
  public rampTo(value: number, rampTime = 0.1): this {
    this.current = value
    this.writes.push({ method: 'rampTo', value, time: rampTime })
    return this
  }

  public cancelScheduledValues(): this {
    return this
  }

  public cancelAndHoldAtTime(): this {
    return this
  }

  public get lastWrite(): FakeGainWrite | undefined {
    return this.writes[this.writes.length - 1]
  }
}

/** A node in the recorded fake graph. */
export class FakeToneNode {
  readonly id: string
  readonly kind: string
  outgoing: FakeToneNode[] = []
  incoming: FakeToneNode[] = []
  label?: string
  disposed = false

  constructor(id: string, kind: string) {
    this.id = id
    this.kind = kind
  }

  public connect(destination: FakeToneNode | FakeGainParam | null | undefined): this {
    if (!destination) return this
    const target = destination instanceof FakeGainParam ? destination.owner : destination
    if (!target || target === this) return this
    if (!this.outgoing.includes(target)) {
      this.outgoing.push(target)
      target.incoming.push(this)
    }
    return this
  }

  public disconnect(destination?: FakeToneNode): this {
    if (destination) {
      this.outgoing = this.outgoing.filter((node) => node !== destination)
      destination.incoming = destination.incoming.filter((node) => node !== this)
    } else {
      for (const node of this.outgoing) {
        node.incoming = node.incoming.filter((incoming) => incoming !== this)
      }
      this.outgoing = []
    }
    return this
  }

  public toDestination(): this {
    return this.connect(destinationNode)
  }

  public dispose(): void {
    this.disposed = true
    this.disconnect()
  }
}

/** `Tone.Gain` replacement: a node with a recorded gain parameter. */
export class FakeGainNode extends FakeToneNode {
  readonly gain: FakeGainParam

  constructor(id: string, initial = 1) {
    super(id, 'Gain')
    this.gain = new FakeGainParam(initial)
    this.gain.owner = this
  }
}

/** Recording base class for the synth-family voices the audio layer builds. */
export class FakeSynthNode extends FakeToneNode {
  readonly volume: FakeGainParam
  readonly triggers: { method: string; args: unknown[] }[] = []
  readonly options: unknown

  constructor(id: string, kind: string, options?: unknown) {
    super(id, kind)
    this.options = options
    this.volume = new FakeGainParam(0)
    this.volume.owner = this
  }

  public triggerAttackRelease(...args: unknown[]): this {
    this.triggers.push({ method: 'triggerAttackRelease', args })
    return this
  }

  public triggerAttack(...args: unknown[]): this {
    this.triggers.push({ method: 'triggerAttack', args })
    return this
  }

  public triggerRelease(...args: unknown[]): this {
    this.triggers.push({ method: 'triggerRelease', args })
    return this
  }
}

export class FakeSynth extends FakeSynthNode {
  constructor(id: string, options?: unknown) {
    super(id, 'Synth', options)
  }
}

export class FakeMembraneSynth extends FakeSynthNode {
  constructor(id: string, options?: unknown) {
    super(id, 'MembraneSynth', options)
  }
}

export class FakeMetalSynth extends FakeSynthNode {
  constructor(id: string, options?: unknown) {
    super(id, 'MetalSynth', options)
  }
}

export class FakeNoiseSynth extends FakeSynthNode {
  constructor(id: string, options?: unknown) {
    super(id, 'NoiseSynth', options)
  }
}

/** `Tone.ToneBufferSource` replacement for custom sample playback. */
export class FakeToneBufferSource extends FakeToneNode {
  readonly buffer: unknown
  readonly playbackRate: FakeGainParam
  startedAt: number | null = null
  stoppedAt: number | null = null
  // Tone v15 warns ("Events scheduled inside of scheduled callbacks should use the
  // passed in scheduling time") when a source is stopped without naming its time, so the
  // recorder keeps that misuse observable to suites.
  stoppedWithoutScheduleTime = false

  constructor(id: string, buffer?: unknown) {
    super(id, 'ToneBufferSource')
    this.buffer = buffer
    this.playbackRate = new FakeGainParam(1)
    this.playbackRate.owner = this
  }

  public start(time?: number): this {
    this.startedAt = time ?? fakeClock.time
    return this
  }

  public stop(time?: number): this {
    this.stoppedWithoutScheduleTime = time === undefined
    this.stoppedAt = time ?? fakeClock.time
    return this
  }
}

/** Fake `AudioBuffer` returned by the fake context's decoder. */
export interface FakeAudioBuffer {
  duration: number
  length: number
  numberOfChannels: number
  sampleRate: number
  getChannelData(): Float32Array<ArrayBuffer>
  copyToChannel(source: Float32Array<ArrayBuffer>, channelNumber?: number): void
  copyFromChannel(destination: Float32Array<ArrayBuffer>, channelNumber?: number): void
}

/** Fake `BaseAudioContext` as returned by `Tone.getContext()`. */
export class FakeAudioContext {
  readonly destination = destinationNode
  readonly sampleRate = 44100
  decodedRequests: ArrayBuffer[] = []

  get currentTime(): number {
    return fakeClock.time
  }

  public createGain(): FakeGainNode {
    return createNode('Gain', () => new FakeGainNode(nextNodeId('Gain')))
  }

  public createBuffer(channels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return fakeAudioBuffer(channels, length, sampleRate)
  }

  public async decodeAudioData(data: ArrayBuffer): Promise<FakeAudioBuffer> {
    this.decodedRequests.push(data)
    return fakeAudioBuffer(1, 4410, 44100)
  }

  public listen(): void {
    // Recording context: nothing to hear.
  }

  public add(): void {}
  public remove(): void {}
}

export function fakeAudioBuffer(
  channels = 1,
  length = 4410,
  sampleRate = 44100
): FakeAudioBuffer {
  const data = new Float32Array(length);
  return {
    duration: length / sampleRate,
    length,
    numberOfChannels: channels,
    sampleRate,
    getChannelData: () => data,
    copyToChannel: (source: Float32Array) => data.set(source),
    copyFromChannel: (destination: Float32Array) => destination.set(data),
  }
}

/** Fake `Transport` that can be advanced by tests so scheduled callbacks run. */
export class FakeTransport {
  bpm: FakeGainParam
  timeSignature: number | number[] = 4
  state: 'started' | 'stopped' | 'paused' = 'stopped'
  iterations = 0
  seconds = 0

  private repeats: { id: number; callback: (time: number) => void; intervalSeconds: number; next: number }[] = []
  private oneShots: { time: number; callback: () => void }[] = []
  private nextId = 1
  private cleared: number[] = []
  startedAt: number | null = null
  stoppedAt: number | null = null

  constructor() {
    this.bpm = new FakeGainParam(120)
  }

  public scheduleRepeat(
    callback: (time: number) => void,
    interval: string | number,
    startTime?: number
  ): number {
    const id = this.nextId++
    this.repeats.push({
      id,
      callback,
      intervalSeconds: this.toSeconds(interval),
      next: startTime ?? this.seconds,
    })
    return id
  }

  public schedule(callback: (time: number) => void, time?: number): number {
    const id = this.nextId++
    this.oneShots.push({ time: time ?? this.seconds, callback: () => callback(time ?? this.seconds) })
    return id
  }

  public once(callback: (time: number) => void, time?: number): number {
    return this.schedule(callback, time)
  }

  public clear(id: number | string): this {
    if (typeof id === 'number') {
      this.repeats = this.repeats.filter((repeat) => repeat.id !== id)
      this.cleared.push(id)
    } else {
      this.repeats = []
      this.oneShots = []
    }
    return this
  }

  public start(time?: number): this {
    this.state = 'started'
    this.startedAt = time ?? fakeClock.time
    return this
  }

  public pause(): this {
    this.state = 'paused'
    return this
  }

  public stop(time?: number): this {
    this.state = 'stopped'
    this.stoppedAt = time ?? fakeClock.time
    return this
  }

  /** Test affordance: run the next `count` scheduled repeats and return their times. */
  public fireRepeats(count = 1): number[] {
    const fired: number[] = []
    for (let index = 0; index < count; index++) {
      const repeat = this.repeats.find(
        (candidate) => candidate.next <= this.seconds + candidate.intervalSeconds
      )
      if (!repeat) break
      const time = Math.max(repeat.next, this.seconds)
      fakeClock.time = time
      this.seconds = time
      this.iterations++
      fired.push(time)
      repeat.callback(time)
      repeat.next = time + repeat.intervalSeconds
    }
    return fired
  }

  /** Test affordance: run one-shot schedules that are due. */
  public flushOneShots(): void {
    const due = this.oneShots.filter((shot) => shot.time <= fakeClock.time)
    this.oneShots = this.oneShots.filter((shot) => shot.time > fakeClock.time)
    due.forEach((shot) => shot.callback())
  }

  public get scheduledRepeatCount(): number {
    return this.repeats.length
  }

  public get clearedIds(): number[] {
    return [...this.cleared]
  }

  /** Test affordance: drop every scheduled callback and reset transport state. */
  public clearAll(): void {
    this.repeats = []
    this.oneShots = []
    this.cleared = []
    this.seconds = 0
    this.iterations = 0
    this.state = 'stopped'
    this.startedAt = null
    this.stoppedAt = null
    this.timeSignature = 4
    this.bpm = new FakeGainParam(120)
  }

  private toSeconds(interval: string | number): number {
    if (typeof interval === 'number') return interval
    const notes: Record<string, number> = {
      '1n': 4,
      '2n': 2,
      '4n': 1,
      '8n': 0.5,
      '16n': 0.25,
      '32n': 0.125,
      '4nT': 2 / 3,
      '8nT': 1 / 3,
      '16nT': 1 / 6,
    }
    return (notes[interval] ?? 1) * (60 / this.bpm.value)
  }
}

/** Shared fake clock so `Tone.now()` and the transport agree on time. */
export const fakeClock = { time: 0 }

const destinationNode = new FakeToneNode('destination', 'Destination')

let nodeCounter = 0
function nextNodeId(kind: string): string {
  nodeCounter += 1
  return `${kind}#${nodeCounter}`
}

const createdNodes: FakeToneNode[] = []

function createNode<T extends FakeToneNode>(kind: string, build: () => T): T {
  const node = build()
  createdNodes.push(node)
  fakeToneRecorder.kinds[kind] = (fakeToneRecorder.kinds[kind] ?? 0) + 1
  return node
}

const fakeContext = new FakeAudioContext()
const fakeTransport = new FakeTransport()
const fakeDraw = {
  /** Tone's draw scheduling runs the callback; tests can defer it with `deferDraw`. */
  schedule(callback: () => void, _time?: number): void {
    if (fakeToneRecorder.deferredDraw) {
      fakeToneRecorder.drawQueue.push(callback)
      return
    }
    callback()
  },
  clear(): void {
    fakeToneRecorder.drawQueue = []
  },
}

export interface FakeNodeReport {
  id: string
  kind: string
  label?: string
  gain: number | null
  volume: number | null
  connectsTo: string[]
  fedBy: string[]
  writes: FakeGainWrite[]
  triggerCount: number
}

export interface FakeGraphSnapshot {
  nodes: FakeNodeReport[]
  edges: { from: string; to: string }[]
}

/** Everything a suite can observe about the graph the module under test built. */
export const fakeToneRecorder = {
  kinds: {} as Record<string, number>,
  deferredDraw: false,
  drawQueue: [] as (() => void)[],
  startCalls: 0,

  /** Nodes created by the code under test, in creation order (destination excluded). */
  get nodes(): FakeToneNode[] {
    return [...createdNodes]
  },

  nodesOfKind(kind: string): FakeToneNode[] {
    return createdNodes.filter((node) => node.kind === kind)
  },

  get destination(): FakeToneNode {
    return destinationNode
  },

  get context(): FakeAudioContext {
    return fakeContext
  },

  get transport(): FakeTransport {
    return fakeTransport
  },

  /** Run any draw callbacks queued while `deferredDraw` was on. */
  flushDraw(): void {
    const queue = fakeToneRecorder.drawQueue
    fakeToneRecorder.drawQueue = []
    queue.forEach((callback) => callback())
  },

  report(node: unknown): FakeNodeReport {
    const target = asFakeNode(node)
    return {
      id: target.id,
      kind: target.kind,
      label: target.label,
      gain: target instanceof FakeGainNode ? target.gain.value : null,
      volume: target instanceof FakeSynthNode ? target.volume.value : null,
      connectsTo: target.outgoing.map((node) => node.id),
      fedBy: target.incoming.map((node) => node.id),
      writes: target instanceof FakeGainNode ? [...target.gain.writes] : [],
      triggerCount: target instanceof FakeSynthNode ? target.triggers.length : 0,
    }
  },

  /** Nodes the given node feeds, following connections. */
  connectedTo(node: unknown): FakeToneNode[] {
    return asFakeNode(node).outgoing
  },

  /** Nodes that feed the given node. */
  feedsInto(node: unknown): FakeToneNode[] {
    return asFakeNode(node).incoming
  },

  /** Written values for a gain node, oldest first. */
  gainWrites(node: unknown): FakeGainWrite[] {
    const target = asFakeNode(node)
    return target instanceof FakeGainNode ? [...target.gain.writes] : []
  },

  /** Current value held by a gain node. */
  gainValue(node: unknown): number {
    const target = asFakeNode(node)
    if (target instanceof FakeGainNode) return target.gain.value
    if (target instanceof FakeSynthNode) return target.volume.value
    throw new Error(`fake Tone: node ${target.id} has no gain`)
  },

  lastGainWrite(node: unknown): FakeGainWrite | undefined {
    const writes = fakeToneRecorder.gainWrites(node)
    return writes[writes.length - 1]
  },

  /** Trigger calls recorded on an instrument node. */
  triggers(node: unknown): { method: string; args: unknown[] }[] {
    const target = asFakeNode(node)
    return target instanceof FakeSynthNode ? [...target.triggers] : []
  },

  totalTriggers(): number {
    return createdNodes.reduce(
      (total, node) => total + (node instanceof FakeSynthNode ? node.triggers.length : 0),
      0
    )
  },

  bufferSources(): FakeToneBufferSource[] {
    return createdNodes.filter(
      (node): node is FakeToneBufferSource => node instanceof FakeToneBufferSource
    )
  },

  /** Ids along the first connection route from a node to the destination. */
  routeToDestination(node: unknown): string[] {
    const route = fakeToneRecorder.routeTo(node, destinationNode)
    return route ? route.map((step) => step.id) : []
  },

  routeTo(from: unknown, to: unknown): FakeToneNode[] | null {
    const start = asFakeNode(from)
    const target = asFakeNode(to)
    const queue: FakeToneNode[][] = [[start]]
    const seen = new Set<FakeToneNode>([start])
    while (queue.length > 0) {
      const path = queue.shift() as FakeToneNode[]
      const last = path[path.length - 1]
      if (last === target) return path
      for (const next of last.outgoing) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push([...path, next])
        }
      }
    }
    return null
  },

  /** Flat snapshot of every recorded node and edge, for assertions and debugging. */
  snapshot(): FakeGraphSnapshot {
    const nodes = [...createdNodes, destinationNode].map((node) => fakeToneRecorder.report(node))
    const edges: { from: string; to: string }[] = []
    for (const node of [...createdNodes, destinationNode]) {
      for (const target of node.outgoing) {
        edges.push({ from: node.id, to: target.id })
      }
    }
    return { nodes, edges }
  },

  /** Wipe recorded state and every node created so far; call from `beforeEach`. */
  reset(): void {
    createdNodes.length = 0
    for (const node of destinationNode.incoming) {
      node.outgoing = node.outgoing.filter((outgoing) => outgoing !== node)
    }
    destinationNode.incoming = []
    fakeToneRecorder.kinds = {}
    fakeToneRecorder.deferredDraw = false
    fakeToneRecorder.drawQueue = []
    fakeToneRecorder.startCalls = 0
    fakeContext.decodedRequests = []
    nodeCounter = 0
    fakeClock.time = 0
    fakeTransport.clearAll()
  },
}

/** Narrow a value handed back by production code typed as a Tone node. */
export function asFakeNode(node: unknown): FakeToneNode {
  if (!(node instanceof FakeToneNode)) {
    throw new Error('fake Tone: value is not a fake node (is the suite missing vi.mock("tone")?)')
  }
  return node
}

/** Convenience: give a node a readable name for snapshot output. */
export function labelNode(node: unknown, label: string): FakeToneNode {
  const target = asFakeNode(node)
  target.label = label
  return target
}

/**
 * The replacement for the `tone` module. Spread into a `vi.mock` factory.
 * Only the members the audio layer actually calls are implemented.
 */
export const fakeToneModule = {
  Gain: class FakeGainCtor extends FakeGainNode {
    constructor(initial?: number) {
      super(nextNodeId('Gain'), initial ?? 1)
      createdNodes.push(this)
      fakeToneRecorder.kinds.Gain = (fakeToneRecorder.kinds.Gain ?? 0) + 1
    }
  },
  Synth: class FakeSynthCtor extends FakeSynth {
    constructor(options?: unknown) {
      super(nextNodeId('Synth'), options)
      createdNodes.push(this)
      fakeToneRecorder.kinds.Synth = (fakeToneRecorder.kinds.Synth ?? 0) + 1
    }
  },
  MembraneSynth: class FakeMembraneSynthCtor extends FakeMembraneSynth {
    constructor(options?: unknown) {
      super(nextNodeId('MembraneSynth'), options)
      createdNodes.push(this)
      fakeToneRecorder.kinds.MembraneSynth = (fakeToneRecorder.kinds.MembraneSynth ?? 0) + 1
    }
  },
  MetalSynth: class FakeMetalSynthCtor extends FakeMetalSynth {
    constructor(options?: unknown) {
      super(nextNodeId('MetalSynth'), options)
      createdNodes.push(this)
      fakeToneRecorder.kinds.MetalSynth = (fakeToneRecorder.kinds.MetalSynth ?? 0) + 1
    }
  },
  NoiseSynth: class FakeNoiseSynthCtor extends FakeNoiseSynth {
    constructor(options?: unknown) {
      super(nextNodeId('NoiseSynth'), options)
      createdNodes.push(this)
      fakeToneRecorder.kinds.NoiseSynth = (fakeToneRecorder.kinds.NoiseSynth ?? 0) + 1
    }
  },
  ToneBufferSource: class FakeBufferSourceCtor extends FakeToneBufferSource {
    constructor(buffer?: unknown) {
      super(nextNodeId('ToneBufferSource'), buffer)
      createdNodes.push(this)
      fakeToneRecorder.kinds.ToneBufferSource =
        (fakeToneRecorder.kinds.ToneBufferSource ?? 0) + 1
    }
  },
  getContext: () => fakeContext,
  getTransport: () => fakeTransport,
  getDraw: () => fakeDraw,
  now: () => fakeClock.time,
  context: fakeContext,
  Transport: fakeTransport,
  Draw: fakeDraw,
  destination: destinationNode,
  start: async () => {
    fakeToneRecorder.startCalls += 1
  },
}

export default fakeToneModule
