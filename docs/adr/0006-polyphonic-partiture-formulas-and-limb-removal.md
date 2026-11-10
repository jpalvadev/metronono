# 0006. Polyphonic Partiture Formulas and Limb Removal

Subdivision formulas previously relied on a linear series of isolated strokes edited via cards and dropdown menus, with each stroke carrying an explicit limb assignment (`R`, `L`, `RF`, `LF`). We decided to replace the card/dropdown composer with an interactive 5-line PAS percussion staff (partiture) editor, allow polyphonic unisons (such as Bass Drum and Crash Cymbal sounding simultaneously), support explicit rests, and retire the limb concept across the entire system.

## Considered Options

- **Preserving limb tracking (R, L, RF, LF) alongside notation.** Rejected: limb labels provide no audio value and add unnecessary cognitive overhead during notation composition. The user explicitly chose to drop the concept entirely.
- **Enforcing strictly monophonic / linear formulas.** Rejected: drum phrasing frequently pairs cymbal accents with bass drum hits or multi-surface unisons, which linear formulas cannot represent.
- **Complex backward-compatibility migration for legacy formulas.** Rejected: formula schemas are updated directly, keeping the codebase clean without migration shims.

## Consequences

- The `Limb` type and all limb assignment logic are retired from domain types, the Dawson engine, and UI components.
- `SubdivisionFormula` steps are modeled as chords (`{ durationRatio: number, isRest?: boolean, hits: Array<{ voice: DrumVoice, dynamic: Dynamic }> }`), allowing simultaneous hits and explicit rests.
- Notation rendering automatically maps voices to standard PAS dual-voice notation: Hands (Voice 1, stems up) and Feet (Voice 2, stems down), grouped by metric beats.
- Interactive editing supports drag-and-drop from the toolbar palette onto staff lines, dragging existing notes vertically to change drum voice or horizontally to adjust timing, and single-click stamping.
- Placing or dragging notes provides instant one-shot audio feedback, and formula auditioning sweeps an animated playhead across the staff.

Extends ADR-0003 (Dual Notation Views).
