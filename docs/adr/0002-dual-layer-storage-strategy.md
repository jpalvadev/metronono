# 0002. Dual-Layer Storage Strategy for User Patterns and Audio Assets

We decided on a dual-layer storage strategy combining IndexedDB (with `navigator.storage.persist()`) for instant zero-config caching, and direct file system export/synchronization (File System Access API on desktop, native file system via Capacitor on mobile) with `.metronono` JSON/ZIP bundles. This prevents catastrophic data loss from browser cache clearing, gives users full ownership over their custom sample banks and scores, and provides an identical persistence interface across web and native mobile environments.
