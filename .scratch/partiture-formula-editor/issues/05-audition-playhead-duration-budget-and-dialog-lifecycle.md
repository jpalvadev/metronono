# 05: Audition playhead, duration budget, and dialog lifecycle

**What to build:** The complete, production-ready formula editor dialog replacing the legacy card-based composer. The dialog features a real-time duration budget bar showing filled metric beats versus the trigger duration budget (with clear warnings when under or over budget), an "Audition Formula" control that sweeps an animated visual playhead across the staff in sync with audio playback, and full save/delete persistence wired into the preset manager and the Alan Dawson orchestration panel.

**Blocked by:** 04 (Drag-and-drop placement and note transposition)

**Status:** resolved

- [x] A duration budget indicator at the top of the canvas displays total entered duration versus the target trigger duration (e.g. 0.5 beats for Short Note trigger, 1.0 beat for Long Note trigger), displaying amber cues when under-budget and warning alerts when over-budget.
- [x] An "Audition Formula" button schedules and plays the entire formula at the configured tempo through the audio player.
- [x] During audition playback, a vertical playhead scrubs smoothly across the SVG stave in real time, matching the note coordinates of each sounding stroke.
- [x] Formula metadata controls allow editing the formula name, trigger assignment ('short' or 'long'), and optional description.
- [x] Saving the formula validates that strokes exist and persists the custom formula via the preset manager, updating the active short/long formula in the Dawson orchestration section.
- [x] Custom formulas can be deleted from the dialog, returning the engine to default system formulas.
- [x] The dialog opens in an expanded, wide modal on both desktop and mobile viewports, providing ample space for the 5-line staff and toolbar controls.
- [x] Automated end-to-end component tests verify duration budget calculation, audition playhead animation, saving custom formulas, and dialog dismissal.

## Answer

Completed production-ready `FormulaEditorDialog` integrating the 5-line PAS Partiture Editor:
1. Duration budget indicator displays real-time comparison of total beats vs target budget (0.5 for Short, 1.0 for Long), with visual progress bar and balanced/remaining/overflow status badges.
2. Audition Formula schedules audio playback across all chord hits, triggering unisons synchronously at exact beat offsets.
3. Animated audition playhead sweeps smoothly across the stave in real time matching sounding stroke coordinates.
4. Formula metadata editing (name, short/long trigger, description) with full save and delete lifecycle.
5. Wide modal dialog (`max-w-4xl`) providing ample space for staff engraving and toolbar controls on both desktop and mobile viewports.
6. Comprehensive test suite in `FormulaEditorDialog.test.tsx` passes.
