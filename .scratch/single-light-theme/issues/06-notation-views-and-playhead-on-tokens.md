# 06: Notation views and notation Playhead on tokens

**What to build:** The Reading View, Drum Staff View, and Playhead Overlay render the one style: the notation Playhead becomes Accent with the shared glow utility (was teal + rgba glow, now token-derived), difficulty tier chips borrow Success/Warning/Destructive by hue, hover danger affordances in the staff view go Destructive. The notation Playhead Overlay suite's marker assertions keep passing against the new classes and gain token-role assertions.

**Blocked by:** 01 (Theme foundation).

**Status:** resolved

- [x] Playhead Overlay uses Accent + shared glow utility; zero `teal-*` classes and `rgba(` glows
- [x] Tier chips in both notation views use Success/Warning/Destructive token roles
- [x] Zero raw palette classes remain in the three notation components
- [x] Suites assert token role classes present and raw palette classes absent; existing positional assertions still green
- [x] `npm run check` green

## Answer

PlayheadOverlay.tsx: cursor `bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.9)] rounded-full` -> `bg-primary playhead-glow rounded-none`; locator diamond `bg-teal-300 rounded-[1px]` -> `bg-primary rounded-none`; measure highlight teal -> `bg-primary/10 border-primary/30 rounded-none`. ReadingView.tsx tier chips borrow the Status Colors by hue: `border-success/40 text-success bg-success/20`, Warning, Destructive. DrumStaffView.tsx's Clear Bar affordance moves to `hover:text-destructive hover:bg-destructive/20`. The overlay suite's existing positional assertions stay green and add `bg-primary`/`playhead-glow` role assertions. Done in commit "style(notation-views): Accent Playhead with shared glow, tier chips on Status Colors (ticket 06)" (4554279).

## Comments
