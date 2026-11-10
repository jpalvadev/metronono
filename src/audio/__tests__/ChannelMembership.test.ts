import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { AudioMixer, MIXING_CHANNELS } from '../AudioMixer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { ScheduledDrumEvent } from '../../domain/dawson/types';
import { createRhythmicEvent, ReadingLine } from '../../domain/rhythm/types';
import { fakeAudioBuffer, fakeToneRecorder } from '../../test/fakeTone';

// Which Mixing Channel a stroke is heard on comes from the source its scheduled event carries,
// never from guessing at the voice name. Observed through the recording fake Tone harness.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

function nodesByLabel(label: string) {
  return fakeToneRecorder.nodes.filter((created) => created.label === label);
}

function nodeByLabel(label: string) {
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

/** A 4/4 line of quarter notes: every beat carries an Orchestrated Stroke. */
const quarterNoteLine: ReadingLine = {
  id: 'membership-line',
  title: 'Membership Line',
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

function event(overrides: Partial<ScheduledDrumEvent> = {}): ScheduledDrumEvent {
  return {
    timeInMeasure: 0,
    voice: 'kick',
    velocity: 0.9,
    dynamic: 'normal',
    source: 'orchestration',
    ...overrides,
  };
}

/** Scheduler wired to a real Dawson system: an Ostinato plus one Orchestrated Stroke per beat. */
async function schedulerWithComposition(): Promise<ToneTransportScheduler> {
  const engine = new DawsonEngine();
  engine.setMode('straight_rock');
  engine.setOstinato('straight_rock');

  const scheduler = new ToneTransportScheduler();
  scheduler.setDawsonEngine(engine);
  scheduler.setReadingLine(quarterNoteLine);
  await scheduler.start();
  return scheduler;
}

describe('Mixing Channel membership', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('plays each composed stroke on the Mixing Channel its event source names', async () => {
    await schedulerWithComposition();

    fakeToneRecorder.transport.fireRepeats(4);

    expect(rigTriggers('ostinato')).toBeGreaterThan(0);
    expect(rigTriggers('orchestration')).toBeGreaterThan(0);

    // A composed stroke never plays through the Audition node of its channel.
    expect(rigTriggers('ostinato', 'audition')).toBe(0);
    expect(rigTriggers('orchestration', 'audition')).toBe(0);

    // Every signal the scheduler produced reaches the output through the Master alone.
    expect(fakeToneRecorder.destination.incoming).toEqual([nodeByLabel('mixer:master')]);
  });

  it('follows the source, not the voice name: an orchestrated ride is heard on Orchestration', async () => {
    const scheduler = new ToneTransportScheduler();
    const mixer = scheduler.getAudioMixer();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    mixer.setChannelVolume('orchestration', 0.3);
    mixer.setChannelVolume('ostinato', 0.9);

    player.play(event({ voice: 'ride', source: 'orchestration' }), 1.0);

    expect(triggerCountFor('rig:orchestration:mix:ride')).toBe(1);
    expect(triggerCountFor('rig:ostinato:mix:ride')).toBe(0);
    // The stroke is loudness-shaped by the slider of the channel it was composed into.
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0.3);
    expect(fakeToneRecorder.connectedTo(nodeByLabel('rig:orchestration:mix:ride'))).toContain(
      nodeByLabel('mixer:orchestration')
    );
  });

  it('mutes Orchestration without touching the Ostinato, and the other way around', async () => {
    const scheduler = await schedulerWithComposition();
    const mixer = scheduler.getAudioMixer();

    fakeToneRecorder.transport.fireRepeats(2);
    const ostinatoBefore = rigTriggers('ostinato');
    const orchestrationBefore = rigTriggers('orchestration');
    expect(ostinatoBefore).toBeGreaterThan(0);
    expect(orchestrationBefore).toBeGreaterThan(0);

    mixer.setChannelMute('orchestration', true);
    fakeToneRecorder.transport.fireRepeats(2);

    expect(rigTriggers('orchestration')).toBe(orchestrationBefore);
    expect(rigTriggers('ostinato')).toBeGreaterThan(ostinatoBefore);

    mixer.setChannelMute('orchestration', false);
    mixer.setChannelMute('ostinato', true);
    const orchestrationUnmuted = rigTriggers('orchestration');
    const ostinatoMuted = rigTriggers('ostinato');
    fakeToneRecorder.transport.fireRepeats(2);

    expect(rigTriggers('ostinato')).toBe(ostinatoMuted);
    expect(rigTriggers('orchestration')).toBeGreaterThan(orchestrationUnmuted);
  });

  it('plays uploaded samples on the Mixing Channel of the lane they were composed into', async () => {
    const scheduler = await schedulerWithComposition();

    // The user's own kit, loaded for every voice the composition plays.
    for (const composed of scheduler.getDawsonEngine().resolveReadingLine(quarterNoteLine)) {
      scheduler.applyCustomSampleBuffer(composed.voice, fakeAudioBuffer());
    }

    fakeToneRecorder.transport.fireRepeats(4);

    const sampleLanes = new Set(
      fakeToneRecorder.nodes
        .filter((node) => (node.label ?? '').startsWith('sample:'))
        .map((node) => node.label as string)
    );
    expect(sampleLanes.has('sample:ostinato:mix')).toBe(true);
    expect(sampleLanes.has('sample:orchestration:mix')).toBe(true);

    for (const lane of ['ostinato', 'orchestration'] as const) {
      const sampleNodes = nodesByLabel(`sample:${lane}:mix`);
      expect(sampleNodes.length).toBeGreaterThan(0);
      for (const sampleNode of sampleNodes) {
        // A sample is heard on its own channel, and then only through the Master.
        expect(fakeToneRecorder.connectedTo(sampleNode)).toContain(nodeByLabel(`mixer:${lane}`));
        const route = fakeToneRecorder.routeTo(sampleNode, fakeToneRecorder.destination);
        expect(route?.map((node) => node.id)).toContain(nodeByLabel('mixer:master').id);
      }
    }

    // Nothing but the Master reaches the output: no sample bypasses a Mixing Channel.
    expect(fakeToneRecorder.destination.incoming).toEqual([nodeByLabel('mixer:master')]);
  });

  it('keeps uploaded samples silent on a muted Mixing Channel', async () => {
    const scheduler = await schedulerWithComposition();
    const mixer = scheduler.getAudioMixer();

    for (const composed of scheduler.getDawsonEngine().resolveReadingLine(quarterNoteLine)) {
      scheduler.applyCustomSampleBuffer(composed.voice, fakeAudioBuffer());
    }

    mixer.setChannelMute('orchestration', true);
    fakeToneRecorder.transport.fireRepeats(4);

    expect(nodesByLabel('sample:orchestration:mix')).toHaveLength(0);
    expect(nodesByLabel('sample:ostinato:mix').length).toBeGreaterThan(0);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0);
  });

  it('routes an uploaded click sample through the Click Mixing Channel and obeys its mute', async () => {
    const scheduler = new ToneTransportScheduler();
    const mixer = scheduler.getAudioMixer();
    await scheduler.start();

    scheduler.applyCustomSampleBuffer('click_regular', fakeAudioBuffer());
    fakeToneRecorder.transport.fireRepeats(2);

    const clickSamples = nodesByLabel('click-sample-gain');
    expect(clickSamples.length).toBeGreaterThan(0);
    for (const sampleNode of clickSamples) {
      expect(fakeToneRecorder.connectedTo(sampleNode)).toContain(nodeByLabel('mixer:click'));
      const route = fakeToneRecorder.routeTo(sampleNode, fakeToneRecorder.destination);
      expect(route?.map((node) => node.id)).toEqual([
        sampleNode.id,
        nodeByLabel('mixer:click').id,
        nodeByLabel('mixer:master').id,
        fakeToneRecorder.destination.id,
      ]);
    }

    // The sample obeys the channel it is heard on: muting Click silences it.
    mixer.setChannelMute('click', true);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:click'))).toBe(0);
    fakeToneRecorder.transport.fireRepeats(2);
    expect(fakeToneRecorder.destination.incoming).toEqual([nodeByLabel('mixer:master')]);

    mixer.setChannelMute('click', false);
    mixer.setChannelVolume('click', 0.25);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:click'))).toBe(0.25);
  });

  it('keeps voice-name inference only for a bare Audition call with no composed context', () => {
    const mixer = new AudioMixer();
    mixer.initToneNodes();
    const player = new DrumKitPlayer(mixer);

    // No channel named: the voice decides the line it is auditioned on.
    player.triggerVoice('ride', 0, 0.9);
    player.triggerVoice('kick', 0, 0.9);
    expect(triggerCountFor('rig:ostinato:audition:ride')).toBe(1);
    expect(triggerCountFor('rig:orchestration:audition:kick')).toBe(1);

    // A named channel wins over the voice name, and the inference never moves a composed stroke.
    player.triggerVoice('ride', 0, 0.9, 'orchestration');
    expect(triggerCountFor('rig:orchestration:audition:ride')).toBe(1);
    expect(triggerCountFor('rig:ostinato:audition:ride')).toBe(1);

    player.play(event({ voice: 'ride', source: 'orchestration' }), 1.0);
    expect(triggerCountFor('rig:orchestration:mix:ride')).toBe(1);
    expect(triggerCountFor('rig:ostinato:mix:ride')).toBe(0);
  });

  it('names a channel for every scheduled stroke a listener is handed', async () => {
    const scheduler = await schedulerWithComposition();

    const sources: Array<ScheduledDrumEvent['source']> = [];
    scheduler.onDrumHit((hit) => sources.push(hit.source));

    fakeToneRecorder.transport.fireRepeats(4);

    expect(sources.length).toBeGreaterThan(0);
    expect(new Set(sources)).toEqual(new Set(['ostinato', 'orchestration']));
    expect(sources.every((source) => MIXING_CHANNELS.includes(source))).toBe(true);
  });
});
