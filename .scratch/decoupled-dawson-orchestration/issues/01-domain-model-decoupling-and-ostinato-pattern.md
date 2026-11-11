# 01: Domain Model Decoupling, OstinatoPattern Entity & Engine Silence States

**What to build:**
Enable full orthogonal separation between the background Ostinato and the reading line Interpretation System. A drummer can choose any ostinato independently of any interpretation system, or silence either layer by choosing "Ninguno". The domain model introduces `OstinatoPattern` as a first-class 4/4 measure entity, decouples `DawsonSystem` by removing `ostinatoId`, defines the minimal 2 factory ostinatos (*Jazz Swing* and *Corcheas en Hi-Hat*) and 2 factory systems (*Snare & Kick* and *Hi-Hat Foot & Kick* with `hihat_foot`), and equips `DawsonPresetManager` with persistent CRUD for ostinatos while protecting factory presets from deletion or overwrite.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `OstinatoPattern` interface is defined in `src/domain/dawson/types.ts` representing a 4/4 pattern of `OrchestratedStroke[]` with `id`, `name`, `timeSignature: [4, 4]`, and `isCustom` flag.
- [ ] `DawsonSystem` interface removes `ostinatoId`, focusing strictly on mapping short and long formulas to reading line notes.
- [ ] Factory ostinatos are defined: `jazz_swing` (Ride cymbal pattern with hi-hat foot on 2 and 4) and `straight_8ths_hihat` (Hi-hat closed straight eighth notes).
- [ ] Factory interpretation systems are defined: `snare_and_kick` (Short: snare, Long: kick) and `hihat_foot_and_kick` (Short: hi-hat foot / pedal, Long: kick).
- [ ] `DawsonPresetManager` implements full CRUD for ostinatos (`getAllOstinatos`, `getOstinato`, `saveOstinato`, `deleteOstinato`) with localStorage persistence under key `metronono_dawson_ostinatos`.
- [ ] Factory ostinatos and systems cannot be deleted via `DawsonPresetManager.deleteOstinato` or `deleteSystem`.
- [ ] `DawsonEngine` maintains independent ostinato and system states; setting an ostinato does not modify the active system, and setting a system does not modify the active ostinato.
- [ ] Setting ostinato to `'none'` causes `getOstinatoEvents()` to return an empty array without throwing.
- [ ] Setting interpretation system to `'none'` causes reading line orchestration to generate no audio events without stopping the metronome or ostinato.
- [ ] Unit tests in `DawsonEngine.test.ts` and `SubdivisionFormula.test.ts` verify decoupling, ostinato CRUD, factory immutability, and silence behavior.
