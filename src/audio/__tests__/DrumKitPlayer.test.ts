import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { ScheduledDrumEvent } from '../../domain/dawson/types';

describe('DrumKitPlayer', () => {
  let player: DrumKitPlayer;
  let mockTriggerSynth: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTriggerSynth = vi.fn();
    player = new DrumKitPlayer({
      synthTrigger: mockTriggerSynth,
    });
  });

  describe('Event Playback & Channel Routing', () => {
    it('plays an orchestration drum event and routes to orchestration channel', () => {
      const event: ScheduledDrumEvent = {
        timeInMeasure: 0,
        voice: 'kick',
        velocity: 0.9,
        dynamic: 'normal',
        source: 'orchestration',
      };

      const hitListener = vi.fn();
      player.onDrumHit(hitListener);

      player.play(event, 2.5);

      expect(mockTriggerSynth).toHaveBeenCalledWith(
        'kick',
        2.5,
        0.9,
        'orchestration'
      );
      expect(hitListener).toHaveBeenCalledWith(event, 2.5);
    });

    it('plays an ostinato drum event and routes to ostinato channel', () => {
      const event: ScheduledDrumEvent = {
        timeInMeasure: 1.667,
        voice: 'ride',
        velocity: 0.8,
        dynamic: 'normal',
        source: 'ostinato',
      };

      const hitListener = vi.fn();
      player.onDrumHit(hitListener);

      player.play(event, 3.125);

      expect(mockTriggerSynth).toHaveBeenCalledWith(
        'ride',
        3.125,
        0.8,
        'ostinato'
      );
      expect(hitListener).toHaveBeenCalledWith(event, 3.125);
    });
  });

  describe('Audition Voice Trigger', () => {
    it('triggers a drum voice directly for manual UI pad auditioning', () => {
      const hitListener = vi.fn();
      player.onDrumHit(hitListener);

      player.triggerVoice('snare', 1.0, 0.85);

      expect(mockTriggerSynth).toHaveBeenCalledWith('snare', 1.0, 0.85, 'orchestration');
      expect(hitListener).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: 'snare',
          velocity: 0.85,
          source: 'orchestration',
        }),
        1.0
      );
    });

    it('defaults ostinato voices to ostinato source when triggering directly', () => {
      player.triggerVoice('ride', 1.0);
      expect(mockTriggerSynth).toHaveBeenCalledWith('ride', 1.0, 0.8, 'ostinato');

      player.triggerVoice('hihat_foot', 1.0);
      expect(mockTriggerSynth).toHaveBeenCalledWith('hihat_foot', 1.0, 0.8, 'ostinato');
    });
  });

  describe('Hit Listeners Subscription', () => {
    it('subscribes and unsubscribes listeners cleanly', () => {
      const listener = vi.fn();
      const unsub = player.onDrumHit(listener);

      player.triggerVoice('kick', 0);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      player.triggerVoice('kick', 0);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
