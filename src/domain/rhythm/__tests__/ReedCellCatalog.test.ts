import { describe, it, expect } from 'vitest';
import {
  REED_CELLS,
  ONE_BEAT_CELLS,
  TWO_BEAT_CELLS,
  getCellById,
  getCellsByTier,
} from '../ReedCellCatalog';

describe('ReedCellCatalog', () => {
  it('contains all catalog cells in REED_CELLS', () => {
    expect(REED_CELLS.length).toBe(
      ONE_BEAT_CELLS.length + TWO_BEAT_CELLS.length
    );
  });

  it('contains all fundamental 1-beat cells', () => {
    const ids = ONE_BEAT_CELLS.map((c) => c.id);
    expect(ids).toContain('C1_Q');
    expect(ids).toContain('C1_EE');
    expect(ids).toContain('C1_ER');
    expect(ids).toContain('C1_QR');
    expect(ids).toContain('C1_RE');
  });

  it('contains all fundamental 2-beat cells', () => {
    const ids = TWO_BEAT_CELLS.map((c) => c.id);
    expect(ids).toContain('C2_QQ');
    expect(ids).toContain('C2_QEE');
    expect(ids).toContain('C2_EEQ');
    expect(ids).toContain('C2_EEEE');
    expect(ids).toContain('C2_H');
    expect(ids).toContain('C2_EQE');
    expect(ids).toContain('C2_Q_E');
    expect(ids).toContain('C2_E_Q');
    expect(ids).toContain('C2_REQ');
    expect(ids).toContain('C2_REQRE');
  });

  it('all 1-beat cells have exactly spanBeats === 1.0 and events sum to 1.0', () => {
    for (const cell of ONE_BEAT_CELLS) {
      expect(cell.spanBeats).toBe(1.0);
      const total = cell.events.reduce((sum, e) => sum + e.durationBeats, 0);
      expect(total).toBeCloseTo(1.0, 5);
    }
  });

  it('all 2-beat cells have exactly spanBeats === 2.0 and events sum to 2.0', () => {
    for (const cell of TWO_BEAT_CELLS) {
      expect(cell.spanBeats).toBe(2.0);
      const total = cell.events.reduce((sum, e) => sum + e.durationBeats, 0);
      expect(total).toBeCloseTo(2.0, 5);
    }
  });

  it('correctly categorizes Tier 1 cells (on-beat, no syncopation)', () => {
    const tier1Cells = getCellsByTier(1);
    expect(tier1Cells.length).toBeGreaterThan(0);

    for (const cell of tier1Cells) {
      expect(cell.tier).toBe(1);
      // Tier 1 must not contain off-beat eighth note rests followed by eighth note
      // nor syncopated quarter notes (C2_EQE, C1_RE, etc.)
      expect(cell.id).not.toBe('C1_RE');
      expect(cell.id).not.toBe('C2_EQE');
      expect(cell.id).not.toBe('C2_REQ');
      expect(cell.id).not.toBe('C2_REQRE');
    }
  });

  it('correctly categorizes Tier 2 cells (syncopations and off-beats)', () => {
    const tier2Cells = getCellsByTier(2);
    const tier2Ids = tier2Cells.map((c) => c.id);

    // Cumulative or tier 2 specific check
    expect(tier2Ids).toContain('C1_RE');
    expect(tier2Ids).toContain('C2_EQE');
    expect(tier2Ids).toContain('C2_Q_E');
    expect(tier2Ids).toContain('C2_E_Q');
    expect(tier2Ids).toContain('C2_REQ');
    expect(tier2Ids).toContain('C2_REQRE');
  });

  it('correctly categorizes Tier 3 cells (ties and cross-beat phrases)', () => {
    const tier3Cells = getCellsByTier(3);
    const tier3Ids = tier3Cells.map((c) => c.id);

    expect(tier3Ids).toContain('C1_TE');
    expect(tier3Ids).toContain('C2_TEQE');
    expect(tier3Ids).toContain('C2_TE_Q');

    const tiedCells = tier3Cells.filter(
      (c) =>
        c.events.some((e) => e.hasTieToNext || e.hasTieFromPrev) || c.tier === 3
    );
    expect(tiedCells.length).toBeGreaterThan(0);
  });

  it('getCellById retrieves cell properly or undefined for non-existent', () => {
    expect(getCellById('C1_Q')?.name).toBe('Quarter note');
    expect(getCellById('C2_EQE')?.name).toContain('syncopation');
    expect(getCellById('NON_EXISTENT')).toBeUndefined();
  });
});
