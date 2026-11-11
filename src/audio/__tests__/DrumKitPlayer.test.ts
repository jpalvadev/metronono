import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrumKitPlayer, DrumLane } from '../DrumKitPlayer';
import { AudioMixer } from '../AudioMixer';
import { DrumVoice, ScheduledDrumEvent } from '../../domain/dawson/types';
import { fakeAudioBuffer, fakeToneRecorder } from '../../test/fakeTone';

vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

function nodeByLabel(label: string) {
  const node = fakeToneRecorder.nodes.find((created) => created.label === label);
  if (!node) throw new Error(`no node labelled '${label}' in the recorded graph`);
  return node;
}

function rigNodes(lane: DrumLane, mode: 'mix' | 'audition', voice: string) {
  return fakeToneRecorder.nodes.filter((created) => created.label === `rig:${lane}:${mode}:${voice}`);
}

function rigNode(lane: DrumLane, mode: 'mix' | 'audition', voice: string) {
  const [node] = rigNodes(lane, mode, voice);
  if (!node) throw new Error(`no instrument built for ${voice} on ${lane}/${mode}`);
  return node;
}

function triggerCount(lane: DrumLane, mode: 'mix' | 'audition', voice: string): number {
  return rigNodes(lane, mode, voice).reduce(
    (total, node) => total + fakeToneRecorder.triggers(node).length,
    0
  );
}

function drumEvent(voice: DrumVoice, source: DrumLane, velocity = 0.9): ScheduledDrumEvent {
  return { timeInMeasure: 0, voice, velocity, dynamic: 'normal', source };
}

describe('DrumKitPlayer', () => {
  let mixer: AudioMixer;
  let player: DrumKitPlayer;

  beforeEach(() => {
    fakeToneRecorder.reset();
    mixer = new AudioMixer();
    mixer.initToneNodes();
    player = new DrumKitPlayer(mixer);
  });

  describe('Event Playback & Channel Routing', () => {
    it('plays an orchestration drum event on the Orchestration channel instrument', () => {
      const event = drumEvent('kick', 'orchestration', 0.9);

      player.play(event, 2.5);

      const kick = rigNode('orchestration', 'mix', 'kick');
      expect(fakeToneRecorder.triggers(kick)).toEqual([
        { method: 'triggerAttackRelease', args: ['C1', '8n', 2.5, 0.9] },
      ]);
    });

    it('reaches the audio destination through the Orchestration Mixing Channel', () => {
      player.play(drumEvent('kick', 'orchestration'), 2.5);

      const channel = nodeByLabel('mixer:orchestration');
      const master = nodeByLabel('mixer:master');
      const route = fakeToneRecorder.routeTo(rigNode('orchestration', 'mix', 'kick'), channel);
      expect(route).not.toBeNull();
      expect(fakeToneRecorder.connectedTo(channel)).toContain(master);
      expect(fakeToneRecorder.routeTo(channel, fakeToneRecorder.destination)).not.toBeNull();
    });

    it('plays an ostinato drum event on the Ostinato channel instrument', () => {
      const event: ScheduledDrumEvent = {
        timeInMeasure: 1.667,
        voice: 'ride',
        velocity: 0.8,
        dynamic: 'normal',
        source: 'ostinato',
      };

      player.play(event, 3.125);

      const ride = rigNode('ostinato', 'mix', 'ride');
      expect(fakeToneRecorder.triggers(ride)).toEqual([
        { method: 'triggerAttackRelease', args: ['16n', 3.125, 0.8] },
      ]);
      // The Orchestration line stayed silent: an event only plays on its own channel.
      expect(triggerCount('orchestration', 'mix', 'ride')).toBe(0);
    });

    it('plays nothing at all on a muted Mixing Channel', () => {
      mixer.setChannelMute('orchestration', true);

      player.play(drumEvent('kick', 'orchestration'), 2.5);

      expect(triggerCount('orchestration', 'mix', 'kick')).toBe(0);
      expect(fakeToneRecorder.totalTriggers()).toBe(0);
    });

    it('still plays events on the channels that are not muted', () => {
      mixer.setChannelMute('orchestration', true);

      player.play(drumEvent('ride', 'ostinato', 0.8), 4.0);

      expect(triggerCount('ostinato', 'mix', 'ride')).toBe(1);
      expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:ostinato'))).toBe(0.8);
      expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0);
    });
  });

  describe('Audition Voice Trigger', () => {
    it('triggers a drum voice directly for audition taps', () => {
      player.triggerVoice('snare', 1.0, 0.85);

      expect(triggerCount('orchestration', 'audition', 'snare')).toBe(2);
      expect(triggerCount('orchestration', 'mix', 'snare')).toBe(0);
    });

    it('auditions through the Audition node the Mixing Channel shares, at the channel volume', () => {
      mixer.setChannelVolume('orchestration', 0.45);
      player.triggerVoice('kick', 1.0, 0.85);

      const audition = nodeByLabel('audition:orchestration');
      const route = fakeToneRecorder.routeTo(rigNode('orchestration', 'audition', 'kick'), audition);
      expect(route).not.toBeNull();
      expect(fakeToneRecorder.gainValue(audition)).toBe(0.45);
    });

    it('keeps auditioning a voice while its Mixing Channel is muted', () => {
      mixer.setChannelVolume('orchestration', 0.45);
      mixer.setChannelMute('orchestration', true);

      player.triggerVoice('kick', 1.0, 0.85);

      expect(triggerCount('orchestration', 'audition', 'kick')).toBe(1);
      expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0);
      expect(fakeToneRecorder.gainValue(nodeByLabel('audition:orchestration'))).toBe(0.45);
    });

    it('defaults ostinato voices to the Ostinato Mixing Channel', () => {
      player.triggerVoice('ride', 1.0);
      expect(triggerCount('ostinato', 'audition', 'ride')).toBe(1);
      expect(triggerCount('orchestration', 'audition', 'ride')).toBe(0);

      player.triggerVoice('hihat_foot', 1.0);
      expect(triggerCount('ostinato', 'audition', 'hihat')).toBe(1);
    });

    it('uses the channel the caller names', () => {
      player.triggerVoice('kick', 1.0, 0.9, 'ostinato');
      expect(triggerCount('ostinato', 'audition', 'kick')).toBe(1);
      expect(triggerCount('orchestration', 'audition', 'kick')).toBe(0);
    });
  });

  describe('Built-in Kit Synthesis', () => {
    const voices: { voice: DrumVoice; lane: DrumLane; rigVoice: string }[] = [
      { voice: 'kick', lane: 'orchestration', rigVoice: 'kick' },
      { voice: 'snare', lane: 'orchestration', rigVoice: 'snare' },
      { voice: 'snare_ghost', lane: 'orchestration', rigVoice: 'snare' },
      { voice: 'tom_high', lane: 'orchestration', rigVoice: 'tom_high' },
      { voice: 'tom_mid', lane: 'orchestration', rigVoice: 'tom_mid' },
      { voice: 'tom_floor', lane: 'orchestration', rigVoice: 'tom_floor' },
      { voice: 'crash', lane: 'orchestration', rigVoice: 'crash' },
      { voice: 'ride', lane: 'ostinato', rigVoice: 'ride' },
      { voice: 'ride_bell', lane: 'ostinato', rigVoice: 'ride' },
      { voice: 'hihat_closed', lane: 'ostinato', rigVoice: 'hihat' },
      { voice: 'hihat_foot', lane: 'ostinato', rigVoice: 'hihat' },
      { voice: 'hihat_open', lane: 'ostinato', rigVoice: 'hihat' },
    ];

    it.each(voices)('synthesizes $voice on the $lane channel rig', ({ voice, lane, rigVoice }) => {
      player.play(drumEvent(voice, lane, 0.8), 5.0);
      expect(triggerCount(lane, 'mix', rigVoice)).toBeGreaterThan(0);
      expect(
        fakeToneRecorder.routeTo(rigNode(lane, 'mix', rigVoice), nodeByLabel(`mixer:${lane}`))
      ).not.toBeNull();
    });

    it('gives each Mixing Channel line its own instruments', () => {
      const orchestrationKick = rigNode('orchestration', 'mix', 'kick');
      const ostinatoKick = rigNode('ostinato', 'mix', 'kick');

      expect(orchestrationKick.id).not.toBe(ostinatoKick.id);
      expect(fakeToneRecorder.connectedTo(orchestrationKick)).toEqual([
        nodeByLabel('mixer:orchestration'),
      ]);
      expect(fakeToneRecorder.connectedTo(ostinatoKick)).toEqual([nodeByLabel('mixer:ostinato')]);
    });

    it('builds nothing when the Mixer has no graph to build on', () => {
      // Cleared of the graph the beforeEach built, so the destination is truly untouched.
      fakeToneRecorder.reset();
      const bareMixer = new AudioMixer();
      const silentPlayer = new DrumKitPlayer(bareMixer);

      expect(silentPlayer.initSynths()).toBe(false);
      silentPlayer.play(drumEvent('kick', 'orchestration'), 1.0);
      // No graph, no route to the destination: silence rather than a bypass.
      expect(fakeToneRecorder.totalTriggers()).toBe(0);
      expect(fakeToneRecorder.destination.incoming).toHaveLength(0);
    });
  });

  describe('Custom Sample Playback', () => {
    it('plays a stored sample through the channel node instead of the built-in instrument', () => {
      player.loadSampleBuffer('kick', fakeAudioBuffer());

      player.play(drumEvent('kick', 'orchestration', 0.6), 3.0);

      expect(triggerCount('orchestration', 'mix', 'kick')).toBe(0);
      const [sampleGain] = fakeToneRecorder.nodes.filter(
        (created) => created.label === 'sample:orchestration:mix'
      );
      expect(sampleGain).toBeDefined();
      expect(fakeToneRecorder.gainValue(sampleGain)).toBe(0.6);
      expect(fakeToneRecorder.connectedTo(sampleGain)).toContain(nodeByLabel('mixer:orchestration'));
      expect(fakeToneRecorder.bufferSources()).toHaveLength(1);
    });

    it('auditions a stored sample through the Audition node of its channel', () => {
      player.loadSampleBuffer('ride', fakeAudioBuffer());
      mixer.setChannelMute('ostinato', true);

      player.triggerVoice('ride', 2.0, 0.7);

      const audition = nodeByLabel('audition:ostinato');
      const sampleGain = fakeToneRecorder.nodes.find(
        (created) => created.label === 'sample:ostinato:audition'
      );
      expect(sampleGain).toBeDefined();
      expect(fakeToneRecorder.connectedTo(sampleGain)).toContain(audition);
      expect(fakeToneRecorder.bufferSources()[0].startedAt).toBe(2.0);
    });

    it('goes back to the built-in instrument when the sample is removed', () => {
      player.loadSampleBuffer('kick', fakeAudioBuffer());
      player.removeSampleBuffer('kick');

      expect(player.hasCustomSample('kick')).toBe(false);
      player.play(drumEvent('kick', 'orchestration'), 3.0);
      expect(triggerCount('orchestration', 'mix', 'kick')).toBe(1);
    });
  });
});
