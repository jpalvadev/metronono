# Remove Real-Time Drum Monitor Spec

Status: resolved

## Problem Statement

The Real-Time Drum Monitor in the Alan Dawson section is an unneeded visual gimmick that adds clutter and distraction to the drummer's practice screen. It provides no instructional value beyond what the notation views already display. In addition, supporting the monitor requires an active pub/sub event dispatch pipeline (`onDrumHit`, `drumHitListeners`, `hitListeners`) and main-thread `drawSync` scheduling within the audio lookahead loop, introducing unnecessary runtime overhead for a purely cosmetic animation. Its secondary feature—clicking pads to audition drum voices—is redundant with existing Audition buttons on Subdivision Formulas and sample auditioning in the Sample Bank.

## Solution

Completely remove the Real-Time Drum Monitor from the user interface and purge all associated drum-hit event plumbing from the audio scheduling engine and drum player:

1. Remove the 4-pad visual display (RH Ride Cymbal, LH Snare Drum, RF Bass Drum, LF Hi-Hat Pedal) and its header from the Alan Dawson Orchestration card.
2. Rename the section header from "Alan Dawson Orchestration & Drum Monitor" to "Alan Dawson Orchestration".
3. Retire pad auditioning entirely without relocating or adding replacement buttons.
4. Remove `onDrumHit`, `drumHitListeners`, `hitListeners`, and the drum-hit `drawSync` dispatch loop from the audio scheduler and drum kit player.
5. Align domain documentation and tests with the removal.

## User Stories

1. As a drummer, I want the Alan Dawson section to focus strictly on interpretation systems, ostinatos, and subdivision formulas, so that my practice interface remains clean and distraction-free.
2. As a drummer, I want the four flashing pad boxes (Ride, Snare, Kick, Hi-Hat) removed, so that there are no blinking elements competing with the rhythmic notation.
3. As a drummer, I want the section header to read "Alan Dawson Orchestration", so that the title accurately describes the tool without referencing an obsolete monitor.
4. As a drummer, I want the practice dashboard to occupy less vertical space, so that the notation views and metronome controls fit comfortably on my screen.
5. As a drummer practicing sight reading, I want the audio scheduler to run without cosmetic main-thread synchronization hooks, so that lookahead timing remains lean and robust.
6. As a drummer, I want to audition subdivision formulas using the existing formula Audition buttons, so that I can preview drum patterns in musical context without needing individual pad buttons.
7. As a drummer, I want to audition kit samples through the Sample Bank, so that I can evaluate sounds directly in their configuration panel.
8. As a developer maintaining the codebase, I want all dead pub/sub event machinery (`onDrumHit`, `drumHitListeners`, `hitListeners`) removed from the scheduler and player, so that unused abstractions do not create maintenance burden.
9. As a developer maintaining the domain model, I want the Mixing Channel glossary definition to describe audibility without obsolete references to drum pad illumination, so that domain vocabulary stays synchronised with application behavior.

## Implementation Decisions

- **UI Component Cleanup**:
  - The Alan Dawson Orchestration component removes the drum monitor container and all pad child elements (`RH Ride Cymbal`, `LH Snare Drum`, `RF Bass Drum`, `LF Hi-Hat Pedal`).
  - Active pad states, animation timeouts, and pad tap audition handlers are removed from the component.
  - The section heading is renamed from `"Alan Dawson Orchestration & Drum Monitor"` to `"Alan Dawson Orchestration"`.
  - The application shell updates comments and surrounding structure to match the renamed section.

- **Audio Engine Cleanup**:
  - The audio scheduler removes its drum hit listener registry, subscription method (`onDrumHit`), cleanup in disposal/stop routines, and the drum-hit event dispatch within the bar scheduling loop.
  - The drum kit player removes its hit listener registry, subscription method (`onDrumHit`), and voice notification trigger method.
  - Public interface contracts (`IDrumKitPlayer` and scheduler interfaces) remove `onDrumHit`.

- **Retirement of Pad Audition**:
  - Pad auditioning is completely retired alongside the pads; no replacement tap buttons will be added to the Alan Dawson section. Formula audition and Sample Bank previewing remain the designated audition surfaces.

- **Domain Model Documentation**:
  - The domain definition of **Mixing Channel** in `GLOSSARY.md` is updated to describe channel audibility without reference to pad illumination.

## Testing Decisions

- **Testing Principles**:
  - Tests must verify observable behavior at the highest practical seam rather than internal animation flags.
  - Assertions should focus on the presence of core orchestration controls, the absence of obsolete monitor elements, and the correct operation of audio scheduling.

- **Modules Tested**:
  - **Component UI**: Assert that the Alan Dawson Orchestration card renders with the heading `"Alan Dawson Orchestration"`, renders ostinatos, systems, and formulas, and does NOT render drum monitor pads or audition text.
  - **Application Shell**: Assert that the app mounts cleanly and displays the updated section heading.
  - **Audio Scheduler & Player**: Assert that scheduling bars with ostinatos and formulas plays smoothly, channel muting functions as specified, and engine lifecycle methods complete without error.

- **Prior Art**:
  - Component tests in `src/components/__tests__/DawsonOrchestrationSection.test.tsx` and `src/__tests__/App.test.tsx`.
  - Audio tests in `src/audio/__tests__/ToneTransportScheduler.test.ts`, `src/audio/__tests__/DrumKitPlayer.test.ts`, and `src/audio/__tests__/ChannelAudibility.test.ts`.

## Out of Scope

- Relocating drum audition pads to another panel.
- Adding visual hit indicators or strike animations to notation views.
- Creating implementation tickets in `issues/` or implementing code changes (per explicit user instruction: "only to-spec, dont create tickets or implement anything").

## Further Notes

- The inline glossary edit to remove `"and no drum-pad illumination"` from `GLOSSARY.md` has already been applied in the domain modeling step.
