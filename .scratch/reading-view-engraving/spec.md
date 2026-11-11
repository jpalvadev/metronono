# Spec: Reading View engraving pass

Status: resolved

## Problem Statement

The Reading View score (the sight-reading rendering of a Reading Line) looks like broken notation. In the user's capture of a Tier 1 procedural exercise:

- The single stave line slices through note stems instead of passing through the middle of the noteheads — every note (and every rest) hangs visibly below the line.
- Beamed groups show doubled stems (the same stem drawn twice, with slightly different endpoints), so the stems look fat and ragged.
- The dividing barlines are much shorter than the music they divide, so they don't bracket the notes, beams, or flags.
- The very first barline stabs straight through the measure number "1" above the first bar.
- The percussion clef crowds the start barline, and the stave line pokes past the final barline.

Headless SVG probes of the current renderer confirm the geometry: the stave line draws at `y=60.5` while noteheads for key `b/4` center at `y≈80` (≈20 px hang), the measure number "1" sits at `x=12, y=53` while the explicit start barline at `x=16` spans `y 46.5–74.5`, and barlines use a fixed `±14 px` half-height against beamed content that reaches higher and note bottoms that reach lower.

## Solution

Make the Reading View a standard single-line percussion bar: noteheads and rests centered **on** the line, one stem per note pointing always up, barlines tall enough to bracket the whole music block of the system, measure numbers clear of everything, and a clean flush final barline. All fixes are confined to the Reading View renderer; the Reading Line content, audio, and other views are untouched.

## User Stories

1. As a practicing drummer sight-reading a Reading Line, I want every notehead centered on the single stave line, so that the one-line percussion bar reads like standard sheet music instead of notes hanging under a slice-cut stem.
2. As a practicing drummer, I want every rest (eighth, quarter, half) centered on the same stave line as the notes, so that rests are as readable as noteheads.
3. As a practicing drummer, I want exactly one stem drawn per note, so that beamed groups don't show fat, doubled, or ragged stems.
4. As a practicing drummer, I want every stem to point up — beamed or not — so that stem direction never flips and never fights the one-line stave.
5. As a practicing drummer, I want stem tips a standard ~3.5 stave spaces above the notehead, with beam bottoms resting exactly on the stem tips, so that beaming looks conventional.
6. As a practicing drummer, I want lone short notes (a single eighth or sixteenth not adjacent to another short note) to keep their flag, so that isolated figures read with the right duration.
7. As a practicing drummer, I want runs of two or more adjacent short notes to be beamed, so that pairs and clusters of Short Notes group the way Ted Reed charts do.
8. As a practicing drummer, I want the start, dividing, and final barlines to run from ~4 px above the highest beam/flag of the system to ~4 px below the notehead/rest bottoms, so that each measure is visibly bracketed regardless of the tallest figure.
9. As a practicing drummer, I want a thin start barline kept at the left of every system, so that system beginnings look standard.
10. As a practicing drummer, I want the clef, time signature, and first note shifted ~10–12 px right of the start barline, so that the left edge of each system isn't crowded.
11. As a practicing drummer, I want the measure number of each system to sit above the first note of that system (after clef and time signature) and never superpose any barline, so that I can locate the current bar without visual collisions.
12. As a practicing drummer, I want the final barline to be a thin-plus-thick pair with the stave line terminating flush at the thick barline, so that the score ends cleanly with no line tail poking past it.
13. As a practicing drummer using Tier 2 (Syncopated) or Tier 3 (Advanced) lines, I want ties (intra-measure and cross-measure, including across system breaks) to keep following the noteheads after the vertical realignment, so that tied Long Notes stay correctly connected.
14. As a practicing drummer resizing the score, I want the engraving rules (line through notes, one up stem, bracketing barlines, clear measure numbers) to hold at 1, 2, and 4 measures per system and at narrow viewports, so that practice layouts never regress into the old misalignment.
15. As a practicing drummer following the playhead, I want the reported note/stave coordinates (`ScoreLayout` event and measure coordinates, playhead anchors) to stay consistent with what is drawn, so that beat tracking keeps working after the engraving fix.
16. As a practicing drummer regenerating a Procedural Generator exercise, I want the regenerated score to render with the same fixed engraving, so that fixing visuals doesn't depend on the particular Reading Line.

## Implementation Decisions

- **Module modified**: the Reading View score renderer (the VexFlow-backed renderer behind the Reading View component) only. No domain, audio, storage, or component-interface changes; the `ScoreLayout` return contract keeps its shape, only y-geometry values change to match what is drawn.
- **Notehead/rest placement**: noteheads and rests must be vertically centered on the single stave line. Root cause known from probing: the key position used for notes on the one-line stave resolves ≈2 stave spaces below the drawn line; the renderer must choose key positions (or stave placement) so notes sit on the line. Both noteheads and rests (the rest variant of the same key) move together.
- **Stems**: one visible stem per note, always stem-up (this extends the already-pinned "stems always up" rule from PENDING ticket 6). VexFlow currently doubles the stem for beamed groups (a note stem plus a beam-group stem drawn at slightly different tips); the fix must leave exactly one stem path per note, tips at standard length, with beams resting on the tips.
- **Barline extent**: replace the fixed half-height constant with a per-system derived extent: top = highest beam/flag top in the system − ~4 px; bottom = notehead/rest bottom + ~4 px. Applies to explicit start, dividing, and final barlines. (The VexFlow built-in stave barlines remain suppressed: on a one-line stave they collapse to invisible stubs — decision already recorded as PENDING ticket 2 root cause.)
- **Measure numbers**: keep them, but place above the first note of each system, right of the clef/time signature, clear of the start barline; never at the system's left edge. Alternative considered and rejected: dropping numbers entirely (the header already shows `Bar: n / N`) — the user chose to keep them.
- **Clef clearance**: shift clef, time signature, and first note right by ~10–12 px after the start barline.
- **Final barline**: thin + thick pair retained; the stave line must terminate flush at the thick barline with no overhang.
- **Terminology**: no glossary churn (settled in grilling Q1 — the user's naming is loose, "partiture" just means the visible score); the Reading View entry in the glossary already covers this surface.
- **Playhead overlay**: out of scope now; the style discrepancy between overlay geometry and the new music-block extent is parked as PENDING ticket 11.

## Testing Decisions

- **What makes a good test**: per the repo's Coding Standards for notation renderers — assert against the rendered SVG DOM for behaviour the user sees, and pin geometry (coordinates and relationships like a stem tip's y against the stave line), never node existence or counts alone.
- **Seam**: the existing single seam — the renderer's public `render(container, ReadingLine, options)` entry, driven in the existing renderer test file (jsdom vitest environment, SVG DOM queried from the container). No new seams; the component-level view tests stay as they are.
- **Assertions to add (extending the existing geometry-helper style already used for the stems-up guard test)**:
  - notehead glyph centerlines (and rest glyphs) align with the stave line y within tolerance;
  - every stem path lies above the stave line with standard tip distance, and no beamed note has two stem paths at the same x;
  - barline path endpoints bracket the system's music block with the agreed margins (compare against beam tops / notehead bottoms in the same system);
  - measure-number text x/y clear the start barline's x-span (the collision the user reported);
  - stave line end x equals the final thick barline x (flush end).
- **Prior art**: the existing stems-up guard test in the renderer's test file (helper extracting stem path tips vs. the stave line), and the 5-line `DrumStaffRenderer` tests for DOM-assertion patterns.

## Out of Scope

- Playhead cursor, locator diamond, and measure-highlight box sizing (PENDING ticket 11).
- Drum Staff View (5-line PAS score) and the Partiture formula editor canvas — their geometry is already fine (confirmed in grilling, PENDING ticket 2 root-cause note).
- Domain content (Reading Line generation, tiers, Reed library), audio, metronome, mixer, storage, dark-mode invert filter CSS.
- Repeating the time signature on later systems (standard notation permits omission; current behavior kept).
- Ties: no new tie decisions — they inherit the corrected notehead placement automatically; tie-path sanity is covered only insofar as existing tests keep passing.

## Further Notes

- Grilling session settled every decision inline (Q1–Q13); the probe dump is throwaway and must not ship — delete the scratch test file before committing.
- Probe facts worth keeping as diagnosis: one-line stave line at `y=60.5` vs noteheads centered `y≈80`; measure number at `x=12` vs start barline at `x=16`; fixed barline half-height 14 px vs content reaching ~9 px above and ~30 px below the line.
- The ADR "Dual-View Notation Architecture" (0003) frames this fix: this is the Reading View (1-line) side; the Drum Staff View side must not change.
