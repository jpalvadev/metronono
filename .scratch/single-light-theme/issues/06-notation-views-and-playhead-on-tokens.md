# 06: Notation views and notation Playhead on tokens

**What to build:** The Reading View, Drum Staff View, and Playhead Overlay render the one style: the notation Playhead becomes Accent with the shared glow utility (was teal + rgba glow, now token-derived), difficulty tier chips borrow Success/Warning/Destructive by hue, hover danger affordances in the staff view go Destructive. The notation Playhead Overlay suite's marker assertions keep passing against the new classes and gain token-role assertions.

**Blocked by:** 01 (Theme foundation).

**Status:** ready-for-agent

- [ ] Playhead Overlay uses Accent + shared glow utility; zero `teal-*` classes and `rgba(` glows
- [ ] Tier chips in both notation views use Success/Warning/Destructive token roles
- [ ] Zero raw palette classes remain in the three notation components
- [ ] Suites assert token role classes present and raw palette classes absent; existing positional assertions still green
- [ ] `npm run check` green

## Comments
