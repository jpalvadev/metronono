# 0009. Single Reading View and Removal of Drum Staff

The dual-view notation model (ADR-0003) originally provided two rendering targets in the reading training module: a 1-line **Reading View** (mental sight-reading interpretation) and a 5-line **Drum Staff View** (concrete kit notation). In practice, sight-reading training in the Alan Dawson method relies strictly on the abstract single-line melody (Ted Reed style), while kit orchestration is configured in the Dawson Orchestration section through Subdivision Formulas and the Partiture Formula editor. Offering a 5-line drum staff toggle in the reading section added unnecessary visual friction, redundant toggling controls, and substantial dead code. We decided to retire the 5-line Drum Staff View from the reading training section entirely, establishing **Reading View** as the sole, default notation view with zero UI toggles.

## Considered Options

- **Keep Drum Staff View hidden behind a settings flag or secondary button.** Rejected: creates maintenance overhead and preserves dead code for an unused modality.
- **Retain the `Reading View` button label without a counterpart.** Rejected: when only one mode exists, a mode switcher button is meaningless noise in the interface.
- **Delete `DRUM_VOICE_PAS_MAP` alongside `DrumStaffRenderer`.** Rejected: `DRUM_VOICE_PAS_MAP` is required by the Dawson Orchestration formula canvas (`PartitureFormulaCanvas` and `DrumStaffFormulaRenderer`) to map drum voices to stave positions.

## Consequences

- In `ReadingTrainingSection`, the view mode switcher group (`Reading View` vs `Drum Staff (5 Lines)`) is completely removed. Only the exercise mode tabs (`Procedural Generator` vs `Library`) remain in the header.
- `ReadingView` is rendered unconditionally for reading training scores.
- View mode state (`viewMode`, `activeViewMode`, `NotationViewMode`) is removed from `App.tsx` and `ReadingTrainingSection.tsx`.
- `DrumStaffView.tsx` and its test suite `DrumStaffView.test.tsx` are deleted.
- The standalone 5-line score renderer `DrumStaffRenderer` class and its test suite are deleted, while preserving `DRUM_VOICE_PAS_MAP` (and related PAS types) for Dawson formula editing.
- `App.test.tsx` is updated to remove view-switching assertions.
- Supersedes ADR-0003.
