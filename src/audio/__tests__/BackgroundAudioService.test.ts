import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackgroundAudioService } from '../BackgroundAudioService';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    createChannel: vi.fn(async () => {}),
    schedule: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    requestPermissions: vi.fn(async () => ({ display: 'granted' })),
    checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

describe('BackgroundAudioService', () => {
  let service: BackgroundAudioService;
  let mockWakeLockSentinel: {
    released: boolean;
    release: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
  };
  let mockMediaSession: {
    metadata: any;
    playbackState: string;
    setActionHandler: ReturnType<typeof vi.fn>;
    actionHandlers: Map<string, Function>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock WakeLock API
    mockWakeLockSentinel = {
      released: false,
      release: vi.fn(async () => {
        mockWakeLockSentinel.released = true;
      }),
      addEventListener: vi.fn(),
    };

    const mockWakeLock = {
      request: vi.fn(async (_type: string) => mockWakeLockSentinel),
    };

    // Mock MediaSession API
    const actionHandlers = new Map<string, Function>();
    mockMediaSession = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: vi.fn((action: string, handler: Function) => {
        actionHandlers.set(action, handler);
      }),
      actionHandlers,
    };

    // Attach to global navigator
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: mockWakeLock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis.navigator, 'mediaSession', {
      value: mockMediaSession,
      configurable: true,
      writable: true,
    });

    (globalThis as any).MediaMetadata = class {
      public title: string;
      public artist: string;
      public album?: string;
      constructor(init: any) {
        this.title = init.title;
        this.artist = init.artist;
        this.album = init.album;
      }
    };

    service = new BackgroundAudioService();
  });

  afterEach(async () => {
    await service.onPlaybackStop();
  });

  describe('MediaSession Integration', () => {
    it('initializes MediaSession metadata and action handlers', () => {
      service.initMediaSession();

      expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
      expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('stop', expect.any(Function));
    });

    it('sets metadata with title "Metronono" and artist "Alan Dawson Rhythmic Trainer" on start', async () => {
      await service.onPlaybackStart({ bpm: 120, systemName: 'Bop Drumming' });

      expect(mockMediaSession.playbackState).toBe('playing');
      expect(mockMediaSession.metadata).not.toBeNull();
      expect(mockMediaSession.metadata.title).toBe('Metronono');
      expect(mockMediaSession.metadata.artist).toBe('Alan Dawson Rhythmic Trainer');
      expect(mockMediaSession.metadata.album).toBe('Bop Drumming');
    });

    it('updates playbackState to paused on stop', async () => {
      await service.onPlaybackStart({ bpm: 120 });
      expect(mockMediaSession.playbackState).toBe('playing');

      await service.onPlaybackStop();
      expect(mockMediaSession.playbackState).toBe('paused');
    });
  });

  describe('Screen WakeLock API Management', () => {
    it('requests screen WakeLock on start and releases on stop', async () => {
      await service.onPlaybackStart({ bpm: 100 });
      expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
      expect(service.isWakeLockActive()).toBe(true);

      await service.onPlaybackStop();
      expect(mockWakeLockSentinel.release).toHaveBeenCalled();
      expect(service.isWakeLockActive()).toBe(false);
    });

    it('handles WakeLock request rejection gracefully', async () => {
      (navigator.wakeLock.request as any).mockRejectedValueOnce(new Error('WakeLock not allowed'));
      await expect(service.onPlaybackStart({ bpm: 100 })).resolves.not.toThrow();
      expect(service.isWakeLockActive()).toBe(false);
    });
  });

  describe('Capacitor Local Notifications (Native Foreground Notification)', () => {
    it('does not dispatch LocalNotifications on web platform', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      await service.onPlaybackStart({ bpm: 140, systemName: 'Latin Ostinato' });
      expect(LocalNotifications.schedule).not.toHaveBeenCalled();

      await service.onPlaybackStop();
      expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    });

    it('schedules persistent notification on native platform and cancels on stop', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      await service.onPlaybackStart({ bpm: 140, systemName: 'Latin Ostinato' });

      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: [
          expect.objectContaining({
            id: 1001,
            title: 'Metronono is playing',
            body: expect.stringContaining('140 BPM'),
            ongoing: true,
            autoCancel: false,
          }),
        ],
      });

      await service.onPlaybackStop();

      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: 1001 }],
      });
    });
  });

  describe('Integration with ToneTransportScheduler', () => {
    const createMockScheduler = (bgService: BackgroundAudioService) => {
      const mockTransport = {
        bpm: { value: 120 },
        timeSignature: 4,
        start: vi.fn(),
        stop: vi.fn(),
        scheduleRepeat: vi.fn(() => 1),
        clear: vi.fn(),
      };
      const mockVolume = {
        setVolume: vi.fn(),
        getVolume: vi.fn(() => 0.8),
      };
      const mockClickPlayer = {
        play: vi.fn(),
      };

      return new ToneTransportScheduler({
        transport: mockTransport as any,
        volumeControl: mockVolume,
        clickPlayer: mockClickPlayer,
        drawSync: (fn) => fn(),
        backgroundAudioService: bgService,
      });
    };

    it('seamlessly reacts to scheduler start and stop events', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const scheduler = createMockScheduler(service);

      // Start scheduler
      await scheduler.start();
      expect(mockMediaSession.playbackState).toBe('playing');
      expect(service.isWakeLockActive()).toBe(true);
      expect(LocalNotifications.schedule).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [
            expect.objectContaining({
              id: 1001,
              title: 'Metronono is playing',
              body: expect.stringContaining('120 BPM'),
            }),
          ],
        })
      );

      // Stop scheduler
      scheduler.stop();
      await Promise.resolve();
      expect(mockMediaSession.playbackState).toBe('paused');
      expect(service.isWakeLockActive()).toBe(false);
      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: 1001 }],
      });
    });

    it('routes media session play and pause actions to scheduler', async () => {
      const scheduler = createMockScheduler(service);

      service.attach(scheduler);

      const playHandler = mockMediaSession.actionHandlers.get('play');
      const pauseHandler = mockMediaSession.actionHandlers.get('pause');
      const stopHandler = mockMediaSession.actionHandlers.get('stop');

      expect(playHandler).toBeDefined();
      expect(pauseHandler).toBeDefined();
      expect(stopHandler).toBeDefined();

      // Trigger play
      await playHandler!();
      expect(scheduler.isPlaying()).toBe(true);

      // Trigger pause
      pauseHandler!();
      expect(scheduler.isPlaying()).toBe(false);

      // Trigger stop
      stopHandler!();
      expect(scheduler.isPlaying()).toBe(false);
    });
  });
});
