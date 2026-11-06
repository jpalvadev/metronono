# 09: Capacitor Android Packaging & Background Foreground Service

**What to build:** Native Android project configuration and packaging using Capacitor. The entire web application is bundled offline inside an Android application package (`.apk`), allowing full offline execution with zero network dependency. Configures an Android Foreground Service so that the metronome clock and audio playback continue playing smoothly without interruption when the mobile screen is locked or when the user switches to other apps, and connects to the Android local file system for persistent storage.

**Blocked by:** 07 (5-Line Drum Staff View & Percussion Clef Editor), 08 (Dual-Layer Persistence & Sample Bank CRUD)

**Status:** ready-for-agent

- [ ] Capacitor initialized with Android platform configuration (`capacitor.config.ts` and `android/` project tree)
- [ ] Build script generates native debug APK containing all bundled web assets and audio samples
- [ ] Android Foreground Service configured with persistent status bar notification ("Metronono is playing") to prevent OS background sleep
- [ ] Screen-lock test verifies that audio and metronome continue playing uninterrupted when the device screen turns off
- [ ] Android native file system bridge connects to device storage (`/Documents/Metronono/`) for persisting user scores and audio
- [ ] End-to-end verification confirms app operates 100% offline in Airplane mode on Android
