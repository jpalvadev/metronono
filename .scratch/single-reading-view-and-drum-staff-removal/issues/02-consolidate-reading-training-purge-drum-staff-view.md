# 02: Consolidate reading training, purge DrumStaffView, and clean up application shell

**What to build:**
Consolidate the Single-Line Reading Training section to use `ReadingView` as its sole, default score rendering view. Remove the view mode switcher group (`Reading View` and `Drum Staff (5 Lines)`) from the section header so that only the exercise mode switcher tabs (`Procedural Generator` and `Library`) are visible. Remove `viewMode` state, handlers, and types from `App.tsx` and `ReadingTrainingSection.tsx`, delete the `DrumStaffView.tsx` component and its test file, and update `App.test.tsx` to verify that `ReadingView` is rendered unconditionally without any view mode buttons.

**Blocked by:** 01: Decouple notation constants and retire DrumStaffRenderer

**Status:** ready-for-agent

- [ ] In `ReadingTrainingSection.tsx`, the view mode toggle container and the buttons for `Reading View` and `Drum Staff (5 Lines)` are removed.
- [ ] In `ReadingTrainingSection.tsx`, only the exercise mode switcher tabs (`Procedural Generator` and `Library`) remain in the header controls area.
- [ ] `ReadingTrainingSection.tsx` renders `<ReadingView readingLine={activeLine} scheduler={scheduler} />` unconditionally, removing `activeViewMode` and conditional rendering branches.
- [ ] In `App.tsx`, the `viewMode` state, `setViewMode`, and the `NotationViewMode` import are removed, and `ReadingTrainingSection` is called without view mode props.
- [ ] `src/components/notation/DrumStaffView.tsx` and `src/components/notation/__tests__/DrumStaffView.test.tsx` are deleted from the repository.
- [ ] In `src/__tests__/App.test.tsx`, tests asserting toggle interactions between Reading View and Drum Staff are replaced with assertions verifying that `ReadingView` is always rendered and that no view mode buttons matching `/drum staff/i` or `/reading view/i` are present in the DOM.
- [ ] The full test suite (`npm test`) passes with 0 failures, and style/token checks (`npm run check`) exit with code 0.
