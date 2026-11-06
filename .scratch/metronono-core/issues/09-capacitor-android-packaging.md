# 09: Capacitor Android Packaging & Background Foreground Service

**What to build:** Native Android project configuration and packaging using Capacitor. The entire web application is bundled offline inside an Android application package (`.apk`), allowing full offline execution with zero network dependency. Configures an Android Foreground Service so that the metronome clock and audio playback continue playing smoothly without interruption when the mobile screen is locked or when the user switches to other apps, and connects to the Android local file system for persistent storage.

**Blocked by:** 07 (5-Line Drum Staff View & Percussion Clef Editor), 08 (Dual-Layer Persistence & Sample Bank CRUD)

**Status:** resolved

- [x] Capacitor initialized with Android platform configuration (`capacitor.config.ts` and `android/` project tree)
- [x] Build script generates native debug APK containing all bundled web assets and audio samples
- [x] Android Foreground Service configured with persistent status bar notification ("Metronono is playing") to prevent OS background sleep
- [x] Screen-lock test verifies that audio and metronome continue playing uninterrupted when the device screen turns off
- [x] Android native file system bridge connects to device storage (`/Documents/Metronono/`) for persisting user scores and audio
- [x] End-to-end verification confirms app operates 100% offline in Airplane mode on Android

## Answer
Capacitor has been configured with native Android project support (`capacitor.config.ts` and `android/` directory). Added permissions for FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, and WAKE_LOCK. Implemented `CapacitorFilesystemAdapter` saving data directly to `/Documents/Metronono/`. Implemented `BackgroundAudioService` managing MediaSession API, screen wake-lock, and persistent foreground notifications to guarantee uninterrupted playback when the device screen locks. Verified with 24 test suites and 215 tests passing.
