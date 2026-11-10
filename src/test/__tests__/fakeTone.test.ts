import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Tone from 'tone'

import { AudioMixer } from '../../audio/AudioMixer'
import {
  asFakeNode,
  fakeAudioBuffer,
  fakeToneRecorder,
  FakeGainNode,
  FakeSynthNode,
} from '../fakeTone'

/**
 * Per-suite registration (ADR-0005): only this suite opts into the fake Tone
 * module, and only for the module ids that need it. `src/test/setup.ts` stays
 * untouched, so every other suite still constructs real Tone.
 */
vi.mock('tone', async () => {
  const fake = await import('../fakeTone')
  return { ...fake.fakeToneModule, default: fake.fakeToneModule }
})

describe('recording fake Tone harness', () => {
  beforeEach(() => {
    fakeToneRecorder.reset()
  })

  it('replaces Tone node constructors with recording fakes', () => {
    const gain = new Tone.Gain(0.8)

    expect(gain).toBeInstanceOf(FakeGainNode)
    expect(fakeToneRecorder.nodes).toHaveLength(1)
  })

  it('records a graph of channel gains feeding a master feeding the destination', () => {
    const master = new Tone.Gain(0.8)
    const click = new Tone.Gain(0.5)
    const ostinato = new Tone.Gain(0.0)
    click.connect(master)
    ostinato.connect(master)
    master.toDestination()

    expect(fakeToneRecorder.connectedTo(click)).toEqual([master])
    expect(fakeToneRecorder.feedsInto(master)).toEqual([click, ostinato])
    expect(fakeToneRecorder.routeToDestination(click)).toEqual([
      asFakeNode(click).id,
      asFakeNode(master).id,
      'destination',
    ])
    expect(fakeToneRecorder.routeToDestination(ostinato)).toContain('destination')
  })

  it('records every value written to a gain, including ramped values', () => {
    const gain = new Tone.Gain(0.8)
    gain.gain.value = 0.4
    gain.gain.setValueAtTime(0.3, 5)
    gain.gain.rampTo(0.0, 0.02)

    expect(fakeToneRecorder.gainWrites(gain).map((write) => write.method)).toEqual([
      'initial',
      'value',
      'setValueAtTime',
      'rampTo',
    ])
    expect(fakeToneRecorder.gainWrites(gain).map((write) => write.value)).toEqual([
      0.8, 0.4, 0.3, 0,
    ])
    expect(fakeToneRecorder.lastGainWrite(gain)).toMatchObject({ method: 'rampTo', value: 0 })
    expect(fakeToneRecorder.gainValue(gain)).toBe(0)
  })

  it('records synth-family voices, their routes and their triggers', () => {
    const channel = new Tone.Gain(1)
    channel.toDestination()

    const kick = new Tone.MembraneSynth({ octaves: 6 })
    const ride = new Tone.MetalSynth({ harmonicity: 5.1 })
    const noise = new Tone.NoiseSynth({ noise: { type: 'white' } })
    const click = new Tone.Synth({ oscillator: { type: 'triangle' } })

    kick.connect(channel)
    ride.connect(channel)
    noise.connect(channel)
    click.connect(channel)

    kick.triggerAttackRelease('C1', '8n', 10.5, 0.8)
    ride.triggerAttackRelease('16n', 10.75, 0.6)

    for (const voice of [kick, ride, noise, click]) {
      expect(voice).toBeInstanceOf(FakeSynthNode)
      expect(fakeToneRecorder.routeToDestination(voice)).toEqual([
        asFakeNode(voice).id,
        asFakeNode(channel).id,
        asFakeNode(channel).outgoing[0].id,
      ])
    }

    expect(fakeToneRecorder.triggers(kick)).toEqual([
      { method: 'triggerAttackRelease', args: ['C1', '8n', 10.5, 0.8] },
    ])
    expect(fakeToneRecorder.triggers(noise)).toEqual([])
    expect(fakeToneRecorder.totalTriggers()).toBe(2)
  })

  it('records custom sample buffer sources with their start times', () => {
    const buffer = fakeAudioBuffer(1, 4410, 44100) as unknown as AudioBuffer
    const channel = new Tone.Gain(0.9)
    channel.toDestination()
    const sampleGain = new Tone.Gain(0.7)
    const source = new Tone.ToneBufferSource(buffer)

    source.connect(sampleGain)
    sampleGain.connect(channel)
    source.start(12.5)
    source.stop(13.5)

    const [recorded] = fakeToneRecorder.bufferSources()
    expect(recorded.startedAt).toBe(12.5)
    expect(recorded.stoppedAt).toBe(13.5)
    expect(fakeToneRecorder.routeToDestination(source)).toContain('destination')
  })

  it('exposes a transport, draw scheduling and a shared clock that tests can advance', async () => {
    const transport = Tone.getTransport()
    const fired: number[] = []
    transport.bpm.value = 120
    transport.scheduleRepeat((time: number) => fired.push(time), '4n')
    transport.start()

    fakeToneRecorder.transport.fireRepeats(3)

    // 4n at 120 BPM is half a second, so three repeats land on 0, 0.5 and 1.
    expect(fired).toEqual([0, 0.5, 1])
    expect(transport.state).toBe('started')
    expect(Tone.now()).toBeCloseTo(1, 5)

    let drawn = false
    Tone.getDraw().schedule(() => {
      drawn = true
    }, Tone.now())
    expect(drawn).toBe(true)

    await Tone.start()
    expect(fakeToneRecorder.startCalls).toBe(1)
  })

  it('reports a flat snapshot of nodes and edges', () => {
    const master = new Tone.Gain(0.8)
    const click = new Tone.Gain(0.5)
    click.connect(master)
    master.toDestination()

    const snapshot = fakeToneRecorder.snapshot()
    const edgeText = snapshot.edges.map((edge) => `${edge.from}->${edge.to}`).sort()

    expect(edgeText).toEqual(
      [
        `${asFakeNode(click).id}->${asFakeNode(master).id}`,
        `${asFakeNode(master).id}->destination`,
      ].sort()
    )
    expect(snapshot.nodes.map((node) => node.kind).sort()).toEqual(
      ['Destination', 'Gain', 'Gain'].sort()
    )
  })

  it('makes the graph a production mixer builds through the fake observable', () => {
    const mixer = new AudioMixer()
    mixer.initToneNodes()

    const master = mixer.getMasterNode()
    const click = mixer.getChannelNode('click')
    const orchestration = mixer.getChannelNode('orchestration')
    if (!master || !click || !orchestration) {
      throw new Error('mixer did not build its node graph through the registered fake')
    }

    expect(fakeToneRecorder.routeToDestination(click)).toEqual([
      asFakeNode(click).id,
      asFakeNode(master).id,
      'destination',
    ])
    // Three mix nodes and three audition nodes all feed the single Master.
    expect(fakeToneRecorder.feedsInto(master)).toHaveLength(6)
    expect(fakeToneRecorder.gainValue(click)).toBe(0.8)

    mixer.setChannelMute('click', true)
    expect(fakeToneRecorder.gainValue(click)).toBe(0)
    expect(fakeToneRecorder.lastGainWrite(click)).toMatchObject({ method: 'rampTo', value: 0 })
    expect(fakeToneRecorder.gainValue(orchestration)).toBe(0.8)

    mixer.setMasterVolume(0.25)
    expect(fakeToneRecorder.gainValue(master)).toBe(0.25)
  })
})
