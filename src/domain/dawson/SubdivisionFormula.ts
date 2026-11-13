import {
  SubdivisionFormula,
  DawsonSystem,
  OrchestratedStroke,
  OstinatoPattern,
} from './types';

// ============================================================================
// Math & Timing Calculation Utilities
// ============================================================================

/**
 * Calculates the total metric duration (in beats / quarter notes) of a formula or stroke list.
 */
export function calculateFormulaDuration(
  formulaOrStrokes: SubdivisionFormula | OrchestratedStroke[]
): number {
  const strokes = Array.isArray(formulaOrStrokes)
    ? formulaOrStrokes
    : formulaOrStrokes.strokes;

  if (!strokes || strokes.length === 0) {
    return 0;
  }

  const sum = strokes.reduce((acc, stroke) => acc + (stroke.durationRatio || 0), 0);
  return Math.round(sum * 10000) / 10000;
}

/**
 * Resolves each stroke's absolute or relative start offset relative to a base offset (beat).
 */
export function resolveStrokeOffsets(
  strokes: OrchestratedStroke[],
  baseOffset: number = 0
): Array<{ stroke: OrchestratedStroke; offset: number }> {
  let currentOffset = baseOffset;
  const result: Array<{ stroke: OrchestratedStroke; offset: number }> = [];

  for (const stroke of strokes) {
    result.push({
      stroke,
      offset: Math.round(currentOffset * 1000) / 1000,
    });
    currentOffset += stroke.durationRatio;
  }

  return result;
}

/**
 * Proportionally scales a list of strokes so their cumulative duration matches targetDuration.
 */
export function scaleFormulaStrokes(
  strokes: OrchestratedStroke[],
  targetDuration: number
): OrchestratedStroke[] {
  if (strokes.length === 0 || targetDuration <= 0) return [...strokes];

  const currentDuration = calculateFormulaDuration(strokes);
  if (currentDuration <= 0) return [...strokes];

  const scaleFactor = targetDuration / currentDuration;

  return strokes.map((stroke) => ({
    ...stroke,
    durationRatio: Math.round(stroke.durationRatio * scaleFactor * 10000) / 10000,
  }));
}

// ============================================================================
// Built-in Default Subdivision Formulas
// ============================================================================

export const DEFAULT_SHORT_FORMULAS: Record<string, SubdivisionFormula> = {
  single_snare: {
    id: 'single_snare',
    name: 'Single Stroke (Snare)',
    trigger: 'short',
    description: 'Classic Dawson short note articulated on the snare drum',
    strokes: [
      {
        durationRatio: 0.5,
        hits: [{ voice: 'snare', dynamic: 'normal' }],
      },
    ],
  },
  single_hihat_foot: {
    id: 'single_hihat_foot',
    name: 'Single Stroke (Hi-Hat Foot)',
    trigger: 'short',
    description: 'Alan Dawson short note stepped on the hi-hat pedal',
    strokes: [
      {
        durationRatio: 0.5,
        hits: [{ voice: 'hihat_foot', dynamic: 'accent' }],
      },
    ],
  },
  single_kick: {
    id: 'single_kick_short',
    name: 'Single Stroke (Kick)',
    trigger: 'short',
    description: 'Inverted Dawson short note articulated on the bass drum',
    strokes: [
      {
        durationRatio: 0.5,
        hits: [{ voice: 'kick', dynamic: 'normal' }],
      },
    ],
  },
  flr_triplet: {
    id: 'flr_triplet',
    name: 'F-L-R Triplet (Tony Williams)',
    trigger: 'short',
    description: 'Tony Williams / Vinnie Colaiuta linear triplet: Foot -> Left Hand -> Right Hand',
    strokes: [
      {
        durationRatio: 0.5 / 3, // ~0.1667 beats
        hits: [{ voice: 'kick', dynamic: 'accent' }],
      },
      {
        durationRatio: 0.5 / 3,
        hits: [{ voice: 'snare', dynamic: 'normal' }],
      },
      {
        durationRatio: 0.5 / 3,
        hits: [{ voice: 'tom_high', dynamic: 'normal' }],
      },
    ],
  },
  flam_snare: {
    id: 'flam_snare',
    name: 'Flam (Snare)',
    trigger: 'short',
    description: 'PAS Rudimental Ritual flam on the snare drum',
    strokes: [
      {
        durationRatio: 0.5,
        hits: [{ voice: 'snare', dynamic: 'flam' }],
      },
    ],
  },
  drag_snare: {
    id: 'drag_snare',
    name: 'Drag (Snare)',
    trigger: 'short',
    description: 'PAS Rudimental Ritual double-grace drag on the snare drum',
    strokes: [
      {
        durationRatio: 0.5,
        hits: [{ voice: 'snare', dynamic: 'drag' }],
      },
    ],
  },
};

export const DEFAULT_LONG_FORMULAS: Record<string, SubdivisionFormula> = {
  single_kick: {
    id: 'single_kick',
    name: 'Single Stroke (Kick)',
    trigger: 'long',
    description: 'Classic Dawson long note punched on the bass drum',
    strokes: [
      {
        durationRatio: 1.0,
        hits: [{ voice: 'kick', dynamic: 'normal' }],
      },
    ],
  },
  single_snare: {
    id: 'single_snare_long',
    name: 'Single Stroke (Snare)',
    trigger: 'long',
    description: 'Inverted Dawson long note anchored on the snare drum',
    strokes: [
      {
        durationRatio: 1.0,
        hits: [{ voice: 'snare', dynamic: 'normal' }],
      },
    ],
  },
  linear_diddle: {
    id: 'linear_diddle',
    name: 'Linear Diddle (F-L-R-L-RR)',
    trigger: 'long',
    description: '6-stroke linear phrasing: Kick -> Snare -> High Tom -> Snare -> Double Floor Tom',
    strokes: [
      {
        durationRatio: 1.0 / 6,
        hits: [{ voice: 'kick', dynamic: 'accent' }],
      },
      {
        durationRatio: 1.0 / 6,
        hits: [{ voice: 'snare', dynamic: 'accent' }],
      },
      {
        durationRatio: 1.0 / 6,
        hits: [{ voice: 'tom_high', dynamic: 'ghost' }],
      },
      {
        durationRatio: 1.0 / 6,
        hits: [{ voice: 'snare', dynamic: 'ghost' }],
      },
      {
        durationRatio: 1.0 / 6,
        hits: [{ voice: 'tom_floor', dynamic: 'ghost' }],
      },
      {
        durationRatio: 1.0 / 6,
        hits: [{ voice: 'tom_floor', dynamic: 'ghost' }],
      },
    ],
  },
  linear_paradiddle: {
    id: 'linear_paradiddle',
    name: 'Linear Paradiddle (F-L-R-R)',
    trigger: 'long',
    description: 'Four 16th-note linear paradiddle: Foot -> Left Hand -> Right Hand -> Right Hand',
    strokes: [
      {
        durationRatio: 0.25,
        hits: [{ voice: 'kick', dynamic: 'accent' }],
      },
      {
        durationRatio: 0.25,
        hits: [{ voice: 'snare', dynamic: 'normal' }],
      },
      {
        durationRatio: 0.25,
        hits: [{ voice: 'tom_high', dynamic: 'normal' }],
      },
      {
        durationRatio: 0.25,
        hits: [{ voice: 'tom_high', dynamic: 'ghost' }],
      },
    ],
  },
  five_stroke_roll: {
    id: 'five_stroke_roll',
    name: '5-Stroke Roll (RRLL R)',
    trigger: 'long',
    description: 'PAS 5-stroke roll (4 ghosted double taps terminating on an accented downbeat)',
    strokes: [
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'accent' }] },
    ],
  },
  seven_stroke_roll: {
    id: 'seven_stroke_roll',
    name: '7-Stroke Roll',
    trigger: 'long',
    description: 'PAS 7-stroke roll (6 ghosted taps terminating on an accented attack)',
    strokes: [
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.125, hits: [{ voice: 'snare', dynamic: 'ghost' }] },
      { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'accent' }] },
    ],
  },
};

// ============================================================================
// Built-in Factory Ostinatos
// ============================================================================

export const FACTORY_OSTINATOS: Record<string, OstinatoPattern> = {
  jazz_swing: {
    id: 'jazz_swing',
    name: 'Jazz Swing',
    description: 'Ride cymbal pattern with hi-hat foot on 2 and 4',
    timeSignature: [4, 4],
    strokes: [
      // Beat 1: 1, trip, let (Ride on 1)
      { durationRatio: 1 / 3, hits: [{ voice: 'ride', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, isRest: true, hits: [] },
      { durationRatio: 1 / 3, isRest: true, hits: [] },

      // Beat 2: 2, trip, let (Ride + Hi-hat foot on 2, Ride on let)
      {
        durationRatio: 1 / 3,
        hits: [
          { voice: 'ride', dynamic: 'normal' },
          { voice: 'hihat_foot', dynamic: 'normal' },
        ],
      },
      { durationRatio: 1 / 3, isRest: true, hits: [] },
      { durationRatio: 1 / 3, hits: [{ voice: 'ride', dynamic: 'normal' }] },

      // Beat 3: 3, trip, let (Ride on 3)
      { durationRatio: 1 / 3, hits: [{ voice: 'ride', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, isRest: true, hits: [] },
      { durationRatio: 1 / 3, isRest: true, hits: [] },

      // Beat 4: 4, trip, let (Ride + Hi-hat foot on 4, Ride on let)
      {
        durationRatio: 1 / 3,
        hits: [
          { voice: 'ride', dynamic: 'normal' },
          { voice: 'hihat_foot', dynamic: 'normal' },
        ],
      },
      { durationRatio: 1 / 3, isRest: true, hits: [] },
      { durationRatio: 1 / 3, hits: [{ voice: 'ride', dynamic: 'normal' }] },
    ],
  },
  straight_8ths_hihat: {
    id: 'straight_8ths_hihat',
    name: 'Corcheas en Hi-Hat',
    description: 'Straight eighth notes on closed hi-hat',
    timeSignature: [4, 4],
    strokes: [
      { durationRatio: 0.5, hits: [{ voice: 'hihat_closed', dynamic: 'accent' }] },
      { durationRatio: 0.5, hits: [{ voice: 'hihat_closed', dynamic: 'normal' }] },
      { durationRatio: 0.5, hits: [{ voice: 'hihat_closed', dynamic: 'accent' }] },
      { durationRatio: 0.5, hits: [{ voice: 'hihat_closed', dynamic: 'normal' }] },
      { durationRatio: 0.5, hits: [{ voice: 'hihat_closed', dynamic: 'accent' }] },
      { durationRatio: 0.5, hits: [{ voice: 'hihat_closed', dynamic: 'normal' }] },
      { durationRatio: 0.5, hits: [{ voice: 'hihat_closed', dynamic: 'accent' }] },
      { durationRatio: 0.5, hits: [{ voice: 'hihat_closed', dynamic: 'normal' }] },
    ],
  },
};

// ============================================================================
// Built-in Factory & Default Dawson Systems
// ============================================================================

export const FACTORY_DAWSON_SYSTEMS: Record<string, DawsonSystem> = {
  snare_and_kick: {
    id: 'snare_and_kick',
    name: 'Snare & Kick',
    shortFormula: DEFAULT_SHORT_FORMULAS.single_snare,
    longFormula: DEFAULT_LONG_FORMULAS.single_kick,
    description: 'Classic Dawson: short notes on snare, long notes on bass drum',
  },
  hihat_foot_and_kick: {
    id: 'hihat_foot_and_kick',
    name: 'Hi-Hat Foot & Kick',
    shortFormula: DEFAULT_SHORT_FORMULAS.single_hihat_foot,
    longFormula: DEFAULT_LONG_FORMULAS.single_kick,
    description: 'Short notes on hi-hat pedal, long notes on bass drum',
  },
};

export const DEFAULT_DAWSON_SYSTEMS: Record<string, DawsonSystem> = {
  ...FACTORY_DAWSON_SYSTEMS,
  classic_bop: {
    id: 'classic_bop',
    name: 'Classic Bop',
    shortFormula: DEFAULT_SHORT_FORMULAS.single_snare,
    longFormula: DEFAULT_LONG_FORMULAS.single_kick,
    description: 'Traditional Dawson swing: short notes on snare, long notes on bass drum',
  },
  inverted_bop: {
    id: 'inverted_bop',
    name: 'Inverted Bop',
    shortFormula: DEFAULT_SHORT_FORMULAS.single_kick,
    longFormula: DEFAULT_LONG_FORMULAS.single_snare,
    description: 'Inverted orchestration: short notes on bass drum, long notes on snare',
  },
  tony_williams_flr: {
    id: 'tony_williams_flr',
    name: 'Tony Williams F-L-R Triplet',
    shortFormula: DEFAULT_SHORT_FORMULAS.flr_triplet,
    longFormula: DEFAULT_LONG_FORMULAS.single_kick,
    description: 'Explosive Foot-Left-Right triplet substitution on short notes with jazz swing',
  },
  linear_diddle_fusion: {
    id: 'linear_diddle_fusion',
    name: 'Linear Diddle Fusion',
    shortFormula: DEFAULT_SHORT_FORMULAS.single_snare,
    longFormula: DEFAULT_LONG_FORMULAS.linear_diddle,
    description: 'Linear diddle 6-stroke phrasing on long notes over straight 8th groove',
  },
};

// ============================================================================
// Dawson Preset Manager (Storage & CRUD)
// ============================================================================

export interface PresetManagerOptions {
  storagePrefix?: string;
}

export class DawsonPresetManager {
  private storagePrefix: string;
  private customFormulas: Map<string, SubdivisionFormula> = new Map();
  private customSystems: Map<string, DawsonSystem> = new Map();
  private customOstinatos: Map<string, OstinatoPattern> = new Map();

  constructor(options?: PresetManagerOptions) {
    this.storagePrefix = options?.storagePrefix ?? 'metronono_dawson_';
    this.loadFromStorage();
  }

  // --- Ostinatos CRUD ---

  public getAllOstinatos(): OstinatoPattern[] {
    const builtIn = Object.values(FACTORY_OSTINATOS);
    const custom = Array.from(this.customOstinatos.values());
    return [...builtIn, ...custom];
  }

  public getOstinato(id: string): OstinatoPattern | undefined {
    if (id === 'straight_rock') {
      return FACTORY_OSTINATOS.straight_8ths_hihat;
    }
    return (
      FACTORY_OSTINATOS[id] ||
      this.customOstinatos.get(id) ||
      this.getAllOstinatos().find((o) => o.id === id)
    );
  }

  public saveOstinato(ostinato: OstinatoPattern): void {
    const updated: OstinatoPattern = {
      ...ostinato,
      isCustom: true,
    };
    this.customOstinatos.set(ostinato.id, updated);
    this.saveToStorage();
  }

  public deleteOstinato(id: string): boolean {
    if (FACTORY_OSTINATOS[id] || id === 'straight_rock') {
      // Cannot delete built-in ostinatos
      return false;
    }
    const existed = this.customOstinatos.delete(id);
    if (existed) {
      this.saveToStorage();
    }
    return existed;
  }

  // --- Formulas CRUD ---

  public getAllFormulas(): SubdivisionFormula[] {
    const builtIn = [
      ...Object.values(DEFAULT_SHORT_FORMULAS),
      ...Object.values(DEFAULT_LONG_FORMULAS),
    ];
    const custom = Array.from(this.customFormulas.values());
    return [...builtIn, ...custom];
  }

  public getFormulasByTrigger(trigger: 'short' | 'long'): SubdivisionFormula[] {
    return this.getAllFormulas().filter((f) => f.trigger === trigger);
  }

  public getFormula(id: string): SubdivisionFormula | undefined {
    return (
      DEFAULT_SHORT_FORMULAS[id] ||
      DEFAULT_LONG_FORMULAS[id] ||
      this.customFormulas.get(id) ||
      this.getAllFormulas().find((f) => f.id === id)
    );
  }

  public saveFormula(formula: SubdivisionFormula): void {
    const updated: SubdivisionFormula = {
      ...formula,
      isCustom: true,
    };
    this.customFormulas.set(formula.id, updated);
    this.saveToStorage();
  }

  public deleteFormula(id: string): boolean {
    if (DEFAULT_SHORT_FORMULAS[id] || DEFAULT_LONG_FORMULAS[id]) {
      // Cannot delete built-in formulas
      return false;
    }
    const existed = this.customFormulas.delete(id);
    if (existed) {
      this.saveToStorage();
    }
    return existed;
  }

  // --- Systems CRUD ---

  public getAllSystems(): DawsonSystem[] {
    const builtIn = Object.values(DEFAULT_DAWSON_SYSTEMS);
    const custom = Array.from(this.customSystems.values());
    return [...builtIn, ...custom];
  }

  public getSystem(id: string): DawsonSystem | undefined {
    return (
      DEFAULT_DAWSON_SYSTEMS[id] ||
      this.customSystems.get(id) ||
      this.getAllSystems().find((s) => s.id === id)
    );
  }

  public saveSystem(system: DawsonSystem): void {
    const updated: DawsonSystem = {
      ...system,
      isCustom: true,
    };
    this.customSystems.set(system.id, updated);
    this.saveToStorage();
  }

  public deleteSystem(id: string): boolean {
    if (FACTORY_DAWSON_SYSTEMS[id] || DEFAULT_DAWSON_SYSTEMS[id]) {
      // Cannot delete built-in systems
      return false;
    }
    const existed = this.customSystems.delete(id);
    if (existed) {
      this.saveToStorage();
    }
    return existed;
  }

  public clearCustomData(): void {
    this.customFormulas.clear();
    this.customSystems.clear();
    this.customOstinatos.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`${this.storagePrefix}formulas`);
        window.localStorage.removeItem(`${this.storagePrefix}systems`);
        window.localStorage.removeItem(`${this.storagePrefix}ostinatos`);
      }
    } catch {
      // Safe storage access
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const formulasArr = Array.from(this.customFormulas.values());
        const systemsArr = Array.from(this.customSystems.values());
        const ostinatosArr = Array.from(this.customOstinatos.values());
        window.localStorage.setItem(
          `${this.storagePrefix}formulas`,
          JSON.stringify(formulasArr)
        );
        window.localStorage.setItem(
          `${this.storagePrefix}systems`,
          JSON.stringify(systemsArr)
        );
        window.localStorage.setItem(
          `${this.storagePrefix}ostinatos`,
          JSON.stringify(ostinatosArr)
        );
      }
    } catch {
      // Storage might be unavailable in some test or restricted environments
    }
  }

  private normalizeStrokes(strokes: OrchestratedStroke[] | undefined): OrchestratedStroke[] {
    if (!Array.isArray(strokes)) return [];
    return strokes.map((stroke) => {
      const hits = Array.isArray(stroke.hits) ? stroke.hits : [];
      return {
        ...stroke,
        hits,
        isRest: stroke.isRest || hits.length === 0 ? true : undefined,
      };
    });
  }

  private normalizeFormula(formula: SubdivisionFormula): SubdivisionFormula {
    return {
      ...formula,
      strokes: this.normalizeStrokes(formula.strokes),
    };
  }

  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedFormulas = window.localStorage.getItem(`${this.storagePrefix}formulas`);
        if (storedFormulas) {
          const parsed = JSON.parse(storedFormulas) as SubdivisionFormula[];
          parsed.forEach((f) => this.customFormulas.set(f.id, this.normalizeFormula(f)));
        }

        const storedSystems = window.localStorage.getItem(`${this.storagePrefix}systems`);
        if (storedSystems) {
          const parsed = JSON.parse(storedSystems) as DawsonSystem[];
          parsed.forEach((s) =>
            this.customSystems.set(s.id, {
              ...s,
              shortFormula: this.normalizeFormula(s.shortFormula),
              longFormula: this.normalizeFormula(s.longFormula),
            })
          );
        }

        const storedOstinatos = window.localStorage.getItem(`${this.storagePrefix}ostinatos`);
        if (storedOstinatos) {
          const parsed = JSON.parse(storedOstinatos) as OstinatoPattern[];
          parsed.forEach((o) =>
            this.customOstinatos.set(o.id, {
              ...o,
              strokes: this.normalizeStrokes(o.strokes),
            })
          );
        }
      }
    } catch {
      // Safe fallback
    }
  }
}
