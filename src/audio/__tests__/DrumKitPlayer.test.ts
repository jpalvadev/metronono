import { describe, it, expect, beforeEach } from 'vitest';
import { DrumKitPlayer, DrumLane } from '../DrumKitPlayer';
import { AudioMixer } from '../AudioMixer';
import { DrumVoice, ScheduledDrumEvent } from '../../domain/dawson/types';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioBuffer, FakeAudioContext, FakeGainNode } from '../../test/fakeWebAudio';

const ALL_DRUM_VOICES: DrumVoice[] = [
  'kick',
  'snare',
  'snare_ghost',
  'tom_high',
  'tom_mid',
  'tom_floor',
  'crash',
  'ride',
  'ride_bell',
  'hihat_closed',
  'hihat_foot',
  'hihat_open',
];

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

const dummyBuffer = new FakeAudioBuffer(1, 2048, 44100) as unknown as AudioBuffer;

function drumEvent(voice: DrumVoice, source: DrumLane, velocity = 0.9): ScheduledDrumEvent {
  return { timeInMeasure: 0, voice, velocity, dynamic: 'normal', source };
}

describe('DrumKitPlayer (Pure Web Audio)', () => {
  let mixer: AudioMixer;
  let player: DrumKitPlayer;

  beforeEach(() => {
    mixer = new AudioMixer();
    mixer.initToneNodes();
    player = new DrumKitPlayer(mixer);
  });

  describe('Event Playback & Channel Routing', () => {
    it('plays an orchestration drum event through the Orchestration Mixing Channel to destination', () => {
      player.loadSampleBuffer('kick', dummyBuffer);
      player.play(drumEvent('kick', 'orchestration', 0.9), 2.5);

      const ctx = fakeCtx();
      expect(ctx.bufferSources).toHaveLength(1);
      const src = ctx.bufferSources[0];
      expect(src.startedAt).toBe(2.5);
      const hitGain = src.connectedTo[0] as FakeGainNode;
      expect(hitGain.gain.value).toBe(0.9);
      expect(hitGain.connectedTo).toContain(mixer.getChannelNode('orchestration'));
      expect(ctx.routeTo(src, ctx.destination)).not.toBeNull();
    });

    it('plays an ostinato drum event through the Ostinato Mixing Channel', () => {
      player.loadSampleBuffer('ride', dummyBuffer);
      player.play(
        { timeInMeasure: 1.667, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'ostinato' },
        3.125
      );

      const ctx = fakeCtx();
      expect(ctx.bufferSources).toHaveLength(1);
      const hitGain = ctx.bufferSources[0].connectedTo[0] as FakeGainNode;
      expect(hitGain.connectedTo).toContain(mixer.getChannelNode('ostinato'));
    });

    it('plays nothing at all on a muted Mixing Channel', () => {
      player.loadSampleBuffer('kick', dummyBuffer);
      mixer.setChannelMute('orchestration', true);
      player.play(drumEvent('kick', 'orchestration', 0.9), 2.5);

      expect(fakeCtx().bufferSources).toHaveLength(0);
    });

    it('still plays events on the channels that are not muted', () => {
      player.loadSampleBuffer('kick', dummyBuffer);
      player.loadSampleBuffer('ride', dummyBuffer);
      mixer.setChannelMute('ostinato', true);

      player.play(drumEvent('ride', 'ostinato'), 1.0);
      player.play(drumEvent('kick', 'orchestration'), 1.5);

      const ctx = fakeCtx();
      expect(ctx.bufferSources).toHaveLength(1);
      const hitGain = ctx.bufferSources[0].connectedTo[0] as FakeGainNode;
      expect(hitGain.connectedTo).toContain(mixer.getChannelNode('orchestration'));
    });
  });

  describe('Audition Voice Trigger', () => {
    it('auditions through the Audition node the Mixing Channel shares, even while muted', () => {
      player.loadSampleBuffer('snare', dummyBuffer);
      mixer.setChannelMute('orchestration', true);

      player.triggerVoice('snare', 1.0, 0.75, 'orchestration');

      const ctx = fakeCtx();
      expect(ctx.bufferSources).toHaveLength(1);
      const hitGain = ctx.bufferSources[0].connectedTo[0] as FakeGainNode;
      expect(hitGain.connectedTo).toContain(mixer.getAuditionNode('orchestration'));
      expect(hitGain.connectedTo).not.toContain(mixer.getChannelNode('orchestration'));
    });

    it('defaults ostinato voices to the Ostinato Mixing Channel and others to Orchestration', () => {
      player.loadSampleBuffer('ride', dummyBuffer);
      player.loadSampleBuffer('hihat_closed', dummyBuffer);
      player.loadSampleBuffer('snare', dummyBuffer);

      player.triggerVoice('ride', 1.0, 0.8);
      player.triggerVoice('hihat_closed', 1.5, 0.8);
      player.triggerVoice('snare', 2.0, 0.8);

      const ctx = fakeCtx();
      expect(ctx.bufferSources).toHaveLength(3);
      expect((ctx.bufferSources[0].connectedTo[0] as FakeGainNode).connectedTo).toContain(
        mixer.getAuditionNode('ostinato')
      );
      expect((ctx.bufferSources[1].connectedTo[0] as FakeGainNode).connectedTo).toContain(
        mixer.getAuditionNode('ostinato')
      );
      expect((ctx.bufferSources[2].connectedTo[0] as FakeGainNode).connectedTo).toContain(
        mixer.getAuditionNode('orchestration')
      );
    });
  });

  describe('WAV-Only Voice Playback (No Synth Fallback)', () => {
    it('plays every canonical drum voice when a buffer is loaded and stays silent when missing', () => {
      // Missing buffers: silent, zero synth fallback.
      for (const voice of ALL_DRUM_VOICES) {
        player.play(drumEvent(voice, 'orchestration', 0.8), 1.0);
      }
      expect(fakeCtx().bufferSources).toHaveLength(0);

      // Loaded buffers: every voice plays cleanly.
      for (const voice of ALL_DRUM_VOICES) {
        player.loadDefaultSampleBuffer(voice, dummyBuffer);
        player.play(drumEvent(voice, 'orchestration', 0.8), 1.0);
      }
      expect(fakeCtx().bufferSources).toHaveLength(ALL_DRUM_VOICES.length);
    });

    it('prioritizes custom Sample Bank overrides over default buffers and restores default on removal', () => {
      const defaultBuf = new FakeAudioBuffer(1, 1000, 44100) as unknown as AudioBuffer;
      const customBuf = new FakeAudioBuffer(1, 3000, 44100) as unknown as AudioBuffer;

      player.loadDefaultSampleBuffer('kick', defaultBuf);
      player.loadSampleBuffer('kick', customBuf);
      expect(player.hasCustomSample('kick')).toBe(true);

      player.play(drumEvent('kick', 'orchestration'), 1.0);
      expect(fakeCtx().bufferSources[0].buffer).toBe(customBuf);

      player.removeSampleBuffer('kick');
      expect(player.hasCustomSample('kick')).toBe(false);

      player.play(drumEvent('kick', 'orchestration'), 2.0);
      expect(fakeCtx().bufferSources[1].buffer).toBe(defaultBuf);
    });

    it('builds nothing when the Mixer has no graph to build on', () => {
      const uninitializedMixer = new AudioMixer();
      const orphanPlayer = new DrumKitPlayer(uninitializedMixer);
      orphanPlayer.loadSampleBuffer('kick', dummyBuffer);
      orphanPlayer.play(drumEvent('kick', 'orchestration'), 1.0);

      expect(uninitializedMixer.isGraphInitialized()).toBe(false);
      expect(fakeCtx().bufferSources).toHaveLength(0);
    });
  });
});
