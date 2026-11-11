import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { AudioMixer, MixerChannelId } from '../AudioMixer';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { ScheduledDrumEvent } from '../../domain/dawson/types';
import { createRhythmicEvent, ReadingLine } from '../../domain/rhythm/types';
import { fakeAudioBuffer, fakeToneRecorder, FakeToneNode } from '../../test/fakeTone';

// "Silent" is one thing in the whole app: a Mixing Channel is silent when the volume its
// slider sets is zero, whether or not it is also muted. Everything a silent Channel drives
// goes quiet with it: its voices and its uploaded samples. The Reading Line, the beat pulses
// and the playhead keep running, and the Audition node the Channel shares keeps sounding
// a tapped voice at the Channel volume.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

function nodesByLabel(label: string): FakeToneNode[] {
  return fakeToneRecorder.nodes.filter((created) => created.label === label);
}

function nodeByLabel(label: string): FakeToneNode {
  const node = nodesByLabel(label)[0];
  if (!node) throw new Error(`no node labelled '${label}' in the recorded graph`);
  return node;
}

function triggerCountFor(label: string): number {
  return nodesByLabel(label).reduce(
    (total, node) => total + fakeToneRecorder.triggers(node).length,
    0
  );
}

/** How many times the built-in voices of one Mixing Channel line were played. */
function rigTriggers(lane: string, mode: 'mix' | 'audition' = 'mix'): number {
  return fakeToneRecorder.nodes
    .filter((node) => (node.label ?? '').startsWith(`rig:${lane}:${mode}:`))
    .reduce((total, node) => total + fakeToneRecorder.triggers(node).length, 0);
}

/** Labels along the route a node's sound takes to the audio output. */
function routeLabels(node: FakeToneNode): string[] {
  const route = fakeToneRecorder.routeTo(node, fakeToneRecorder.destination);
  return route ? route.map((step) => step.label ?? step.id) : [];
}

/** Every voice node that actually made a sound, with the route that sound took. */
function soundedRoutes(): string[][] {
  return fakeToneRecorder.nodes
    .filter((node) => fakeToneRecorder.triggers(node).length > 0)
    .map((node) => routeLabels(node));
}

function soundsThrough(label: string): boolean {
  return soundedRoutes().some((route) => route.includes(label));
}

/**
 * Whether a sound a voice made can reach the output: a route carrying a Mixing Channel node,
 * an Audition node or the Master held at zero is a route that reaches nothing.
 */
function routeIsAudible(node: FakeToneNode): boolean {
  const route = fakeToneRecorder.routeTo(node, fakeToneRecorder.destination);
  if (!route) return false;
  return route.every((step) => {
    if (step.kind === 'Gain') return fakeToneRecorder.gainValue(step) > 0;
    return true;
  });
}

const quarterNoteLine: ReadingLine = {
  id: 'audibility-line',
  title: 'Audibility Line',
  tier: 1,
  measures: [
    {
      index: 0,
      timeSignature: [4, 4],
      totalBeats: 4.0,
      events: [1, 2, 3, 4].map(() =>
        createRhythmicEvent({ isRest: false, durationBeats: 1.0, durationType: 'quarter' })
      ),
    },
  ],
};

/** Scheduler wired to a real Dawson system: an Ostinato plus one Orchestrated Stroke per beat. */
async function startScheduler(
  options: { drumKitPlayer?: any } = {}
): Promise<ToneTransportScheduler> {
  const engine = new DawsonEngine();
  engine.setMode('straight_rock');
  engine.setOstinato('straight_rock');

  const scheduler = new ToneTransportScheduler({
    dawsonEngine: engine,
    readingLine: quarterNoteLine,
    ...options,
  });
  await scheduler.start();
  return scheduler;
}

describe('Silent Mixing Channels', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('treats a Mixing Channel turned down to zero volume as silent', async () => {
    const scheduler = await startScheduler();
    scheduler.getAudioMixer().setChannelVolume('orchestration', 0);

    fakeToneRecorder.transport.fireRepeats(4);

    expect(rigTriggers('orchestration')).toBe(0);
    expect(rigTriggers('ostinato')).toBeGreaterThan(0);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0);
    // A silent Channel is silent: nothing that starts on it reaches the output.
    expect(routeIsAudible(nodeByLabel('rig:orchestration:mix:kick'))).toBe(false);
    expect(routeIsAudible(nodeByLabel('rig:ostinato:mix:ride'))).toBe(true);
  });

  it('plays no stroke on a muted Mixing Channel', async () => {
    const scheduler = await startScheduler();
    scheduler.getAudioMixer().setChannelMute('orchestration', true);

    fakeToneRecorder.transport.fireRepeats(4);

    expect(rigTriggers('orchestration')).toBe(0);
    expect(rigTriggers('ostinato')).toBeGreaterThan(0);
  });

  it('plays no stroke on a Mixing Channel turned down to zero volume', async () => {
    const scheduler = await startScheduler();
    scheduler.getAudioMixer().setChannelVolume('orchestration', 0);

    fakeToneRecorder.transport.fireRepeats(4);

    expect(rigTriggers('orchestration')).toBe(0);
    expect(rigTriggers('ostinato')).toBeGreaterThan(0);
  });

  it('still schedules a silent Channel\u2019s events and keeps every beat and playhead pulse', async () => {
    const played: ScheduledDrumEvent[] = [];
    const mockDrumPlayer = {
      initSynths: vi.fn(() => true),
      play: vi.fn((event: ScheduledDrumEvent) => played.push(event)),
      triggerVoice: vi.fn(),
      loadSampleBuffer: vi.fn(),
      removeSampleBuffer: vi.fn(),
      hasCustomSample: vi.fn(() => false),
      clearAllCustomSamples: vi.fn(),
      dispose: vi.fn(),
    };

    const scheduler = await startScheduler({ drumKitPlayer: mockDrumPlayer });
    scheduler.getAudioMixer().setChannelMute('orchestration', true);

    const beats: number[] = [];
    scheduler.onBeat((beat) => beats.push(beat.beatIndex));

    const fired = fakeToneRecorder.transport.fireRepeats(4);

    // The composed strokes are still scheduled: the silent Channel is not cut out of the music.
    expect(played.some((event) => event.source === 'orchestration')).toBe(true);
    expect(played.some((event) => event.source === 'ostinato')).toBe(true);
    // Every beat still pulses, in order, one per tick.
    expect(beats).toEqual(fired.map((_, index) => index % 4));
    expect(scheduler.isPlaying()).toBe(true);
  });

  it('leaves the other Channels sounding while one is silent', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelVolume('ostinato', 0);

    fakeToneRecorder.transport.fireRepeats(4);

    expect(rigTriggers('ostinato')).toBe(0);
    expect(rigTriggers('orchestration')).toBeGreaterThan(0);
  });

  it('plays again when a muted Channel is unmuted', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelMute('orchestration', true);

    fakeToneRecorder.transport.fireRepeats(2);
    expect(rigTriggers('orchestration')).toBe(0);

    mixer.setChannelMute('orchestration', false);
    fakeToneRecorder.transport.fireRepeats(2);

    expect(rigTriggers('orchestration')).toBeGreaterThan(0);
  });

  it('plays again when a silent Channel\u2019s volume is turned back up', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelVolume('orchestration', 0);

    fakeToneRecorder.transport.fireRepeats(2);
    expect(rigTriggers('orchestration')).toBe(0);

    mixer.setChannelVolume('orchestration', 0.6);
    fakeToneRecorder.transport.fireRepeats(2);

    expect(rigTriggers('orchestration')).toBeGreaterThan(0);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0.6);
  });

  it('plays no uploaded sample on a Mixing Channel turned down to zero volume', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();

    for (const composed of scheduler.getDawsonEngine().resolveReadingLine(quarterNoteLine)) {
      scheduler.applyCustomSampleBuffer(composed.voice, fakeAudioBuffer());
    }
    mixer.setChannelVolume('orchestration', 0);

    fakeToneRecorder.transport.fireRepeats(4);

    expect(nodesByLabel('sample:orchestration:mix')).toHaveLength(0);
    expect(nodesByLabel('sample:ostinato:mix').length).toBeGreaterThan(0);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0);
  });
});

describe('Auditioning a silent Mixing Channel', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('auditions a muted Channel voice through the Audition node that Channel shares', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelMute('orchestration', true);

    scheduler.auditionVoice('kick');

    expect(triggerCountFor('rig:orchestration:audition:kick')).toBe(1);
    expect(routeLabels(nodeByLabel('rig:orchestration:audition:kick'))).toEqual([
      'rig:orchestration:audition:kick',
      'audition:orchestration',
      'destination',
    ]);
    // Heard at the volume the muted Channel\u2019s slider holds.
    expect(fakeToneRecorder.gainValue(nodeByLabel('audition:orchestration'))).toBe(0.8);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0);
  });

  it('auditions a muted Click voice through the Audition node the Click Channel shares', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelMute('click', true);
    mixer.setChannelVolume('click', 0.25);

    scheduler.auditionVoice('click_regular');

    expect(fakeToneRecorder.nodes.some((node) => fakeToneRecorder.triggers(node).length > 0)).toBe(
      true
    );
    // The tap is heard through the Audition node, not through the muted Mixing Channel node.
    expect(soundsThrough('audition:click')).toBe(true);
    expect(soundsThrough('mixer:click')).toBe(false);
    expect(fakeToneRecorder.gainValue(nodeByLabel('audition:click'))).toBe(0.25);
  });

  it('auditions an uploaded Click sample through the Audition node too', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    scheduler.applyCustomSampleBuffer('click_subdivision', fakeAudioBuffer());
    mixer.setChannelMute('click', true);

    scheduler.auditionVoice('click_subdivision');

    const sampleNodes = fakeToneRecorder
      .bufferSources()
      .filter((source) => source.startedAt !== null);
    expect(sampleNodes.length).toBe(1);
    expect(fakeToneRecorder.routeTo(sampleNodes[0], nodeByLabel('audition:click'))).not.toBeNull();
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:click'))).toBe(0);
  });

  it('leaves the Channel muted and silent after auditioning it', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelMute('click', true);
    mixer.setChannelMute('orchestration', true);

    scheduler.auditionVoice('click_downbeat');
    scheduler.auditionVoice('kick');

    const state = mixer.getState();
    expect(state.click.muted).toBe(true);
    expect(state.orchestration.muted).toBe(true);
    expect(mixer.isChannelMuted('click')).toBe(true);
    expect(mixer.isChannelAudible('click')).toBe(false);
    expect(mixer.isChannelAudible('orchestration')).toBe(false);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:click'))).toBe(0);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0);
  });

  it('silences audition when the Channel volume is turned down to zero', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelVolume('ostinato', 0);

    scheduler.auditionVoice('ride');

    expect(fakeToneRecorder.gainValue(nodeByLabel('audition:ostinato'))).toBe(0);
    expect(routeIsAudible(nodeByLabel('rig:ostinato:audition:ride'))).toBe(false);

    // Only the Channel the slider silenced goes quiet.
    scheduler.auditionVoice('kick');
    expect(routeIsAudible(nodeByLabel('rig:orchestration:audition:kick'))).toBe(true);
  });

  it('auditions each Channel at the volume its own slider sets', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    const volumes: Record<MixerChannelId, number> = {
      click: 0.25,
      ostinato: 0.6,
      orchestration: 0.35,
    };
    for (const channel of ['click', 'ostinato', 'orchestration'] as MixerChannelId[]) {
      mixer.setChannelVolume(channel, volumes[channel]);
    }

    scheduler.auditionVoice('click_downbeat');
    scheduler.auditionVoice('ride');
    scheduler.auditionVoice('kick');

    expect(fakeToneRecorder.gainValue(nodeByLabel('audition:click'))).toBe(0.25);
    expect(fakeToneRecorder.gainValue(nodeByLabel('audition:ostinato'))).toBe(0.6);
    expect(fakeToneRecorder.gainValue(nodeByLabel('audition:orchestration'))).toBe(0.35);
    expect(soundsThrough('audition:click')).toBe(true);
    expect(soundsThrough('audition:ostinato')).toBe(true);
    expect(soundsThrough('audition:orchestration')).toBe(true);
  });

  it('reports a Mixing Channel as audible only while it can be heard at all', () => {
    const mixer = new AudioMixer();
    mixer.initToneNodes();
    const player = new DrumKitPlayer(mixer);

    expect(mixer.isChannelAudible('ostinato')).toBe(true);

    mixer.setChannelMute('ostinato', true);
    expect(mixer.isChannelAudible('ostinato')).toBe(false);
    expect(mixer.getChannelVolume('ostinato')).toBe(0.8);

    mixer.setChannelMute('ostinato', false);
    mixer.setChannelVolume('ostinato', 0);
    expect(mixer.isChannelAudible('ostinato')).toBe(false);
    expect(mixer.getEffectiveVolume('ostinato')).toBe(0);

    // Silent by volume: a scheduled stroke makes no sound and announces no hit.
    player.play(
      { timeInMeasure: 0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'ostinato' },
      1.0
    );
    expect(rigTriggers('ostinato')).toBe(0);
  });
});
