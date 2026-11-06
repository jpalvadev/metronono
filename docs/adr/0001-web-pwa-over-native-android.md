# 0001. Web PWA with Web Audio API over Native Android

We decided to build Metronono as a Progressive Web Application (PWA) using TypeScript and the Web Audio API rather than a native Android app (Kotlin/Compose). This allows cross-platform execution (desktop and mobile) with instant installation, access to rich sheet music rendering libraries (VexFlow/Canvas), and sub-millisecond audio scheduling via the Web Audio API clock, while maintaining a clean upgrade path to native packaging (Capacitor) if low-level hardware or Google Play distribution is required later.
