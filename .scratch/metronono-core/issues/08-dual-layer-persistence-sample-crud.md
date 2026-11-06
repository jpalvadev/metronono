# 08: Dual-Layer Persistence & Sample Bank CRUD

**What to build:** Comprehensive data persistence and custom audio asset management. Users can upload their own WAV or MP3 audio files for each drum kit voice and metronome click sound, audition them, and assign them to the active sample bank. On desktop browsers, users can link the app to a physical hard drive folder via the File System Access API so scores, presets, and audio are saved directly to disk. Includes 1-click Export/Import of complete `.metronono` backup archives and robust IndexedDB caching to safeguard against browser cache clearing.

**Blocked by:** 05 (Alan Dawson Orchestration Engine & Drum Sample Playback)

**Status:** ready-for-agent

- [ ] Sample Bank CRUD modal lists all drum kit voices and metronome sounds with file upload (WAV/MP3) and audition playback
- [ ] Uploaded custom samples are decoded and cached in browser IndexedDB via persistent storage
- [ ] Desktop File System Access API integration provides a "Link Local Folder" button, saving library files to physical disk
- [ ] Export Library button bundles all custom scores, Dawson systems, formulas, and user audio into a downloadable `.metronono` (.zip) archive
- [ ] Import Library button reads a `.metronono` file and restores all assets and presets completely
- [ ] Automated tests verify storage serialization, zip compression round-trips, and fallback when File System Access API is unavailable
