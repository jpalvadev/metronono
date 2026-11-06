import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface PlaybackMetadata {
  bpm: number;
  systemName?: string;
}

export interface ISchedulerControllable {
  start(): Promise<void> | void;
  stop(): void;
  isPlaying(): boolean;
  getTempo?(): number;
  onPlayStateChange?(listener: (isPlaying: boolean) => void): () => void;
}

export const NOTIFICATION_ID = 1001;
export const CHANNEL_ID = 'metronono_playback';

export class BackgroundAudioService {
  private wakeLockSentinel: any = null;
  private scheduler?: ISchedulerControllable;
  private unsubscribePlayState?: () => void;
  private channelCreated = false;

  constructor(options?: { scheduler?: ISchedulerControllable }) {
    if (options?.scheduler) {
      this.attach(options.scheduler);
    } else {
      this.initMediaSession();
    }
  }

  public attach(scheduler: ISchedulerControllable): void {
    if (this.unsubscribePlayState) {
      this.unsubscribePlayState();
      this.unsubscribePlayState = undefined;
    }

    this.scheduler = scheduler;
    this.initMediaSession();

    if (scheduler.onPlayStateChange) {
      this.unsubscribePlayState = scheduler.onPlayStateChange(async (isPlaying) => {
        if (isPlaying) {
          const bpm = scheduler.getTempo ? scheduler.getTempo() : 120;
          await this.onPlaybackStart({ bpm });
        } else {
          await this.onPlaybackStop();
        }
      });
    }
  }

  public detach(): void {
    if (this.unsubscribePlayState) {
      this.unsubscribePlayState();
      this.unsubscribePlayState = undefined;
    }
    this.scheduler = undefined;
  }

  public initMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (this.scheduler) {
          this.scheduler.start();
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.scheduler) {
          this.scheduler.stop();
        }
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        if (this.scheduler) {
          this.scheduler.stop();
        }
      });
    } catch {
      // Some browsers don't support all action handlers
    }
  }

  public async onPlaybackStart(meta?: PlaybackMetadata): Promise<void> {
    // 1. Update MediaSession
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'playing';
        if (typeof (globalThis as any).MediaMetadata !== 'undefined') {
          navigator.mediaSession.metadata = new (globalThis as any).MediaMetadata({
            title: 'Metronono',
            artist: 'Alan Dawson Rhythmic Trainer',
            album: meta?.systemName ?? 'Rhythmic Independence Practice',
          });
        }
      } catch {
        // Safe MediaSession fallback
      }
    }

    // 2. Request Screen WakeLock
    await this.acquireWakeLock();

    // 3. Foreground Notification via Capacitor Local Notifications (Android)
    if (Capacitor.isNativePlatform()) {
      await this.showForegroundNotification(meta);
    }
  }

  public async onPlaybackStop(): Promise<void> {
    // 1. Update MediaSession
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'paused';
      } catch {
        // Safe MediaSession fallback
      }
    }

    // 2. Cancel Foreground Notification (Android)
    let notificationPromise: Promise<void> = Promise.resolve();
    if (Capacitor.isNativePlatform()) {
      notificationPromise = this.cancelForegroundNotification();
    }

    // 3. Release Screen WakeLock
    const wakeLockPromise = this.releaseWakeLock();

    await Promise.all([notificationPromise, wakeLockPromise]);
  }

  public isWakeLockActive(): boolean {
    return !!this.wakeLockSentinel && !this.wakeLockSentinel.released;
  }

  private async acquireWakeLock(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    try {
      if (!this.isWakeLockActive()) {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel = sentinel;
        sentinel.addEventListener?.('release', () => {
          if (this.wakeLockSentinel === sentinel) {
            this.wakeLockSentinel = null;
          }
        });
      }
    } catch {
      // WakeLock request can fail if battery saver is on or page is hidden
      this.wakeLockSentinel = null;
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        if (!this.wakeLockSentinel.released) {
          await this.wakeLockSentinel.release();
        }
      } catch {
        // Safe ignore
      } finally {
        this.wakeLockSentinel = null;
      }
    }
  }

  private async showForegroundNotification(meta?: PlaybackMetadata): Promise<void> {
    try {
      if (!this.channelCreated) {
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: 'Metronono Playback',
          description: 'Persistent foreground playback notification',
          importance: 4,
          visibility: 1,
        });
        this.channelCreated = true;
      }

      const bpm = meta?.bpm ?? 120;
      const body = `Tempo: ${bpm} BPM${meta?.systemName ? ` | ${meta.systemName}` : ''}`;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: NOTIFICATION_ID,
            title: 'Metronono is playing',
            body,
            ongoing: true,
            autoCancel: false,
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher',
          },
        ],
      });
    } catch {
      // Local notifications error isolation
    }
  }

  private async cancelForegroundNotification(): Promise<void> {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: NOTIFICATION_ID }],
      });
    } catch {
      // Safe ignore
    }
  }
}
