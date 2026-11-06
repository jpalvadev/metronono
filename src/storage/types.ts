import { DrumVoice, DawsonSystem } from '../domain/dawson/types';
import { ReadingLine } from '../domain/rhythm/types';

export type MetronomeClickVoice = 'click_downbeat' | 'click_regular' | 'click_subdivision';

export type SampleVoiceId = DrumVoice | MetronomeClickVoice;

export interface VoiceDefinition {
  id: SampleVoiceId;
  label: string;
  category: 'drum' | 'metronome';
  description?: string;
}

export const ALL_SAMPLE_VOICES: readonly VoiceDefinition[] = [
  // Drum kit voices
  { id: 'kick', label: 'Kick Drum', category: 'drum', description: 'Bass drum' },
  { id: 'snare', label: 'Snare Drum', category: 'drum', description: 'Primary snare sound' },
  { id: 'snare_ghost', label: 'Ghost Snare', category: 'drum', description: 'Soft ghost stroke' },
  { id: 'tom_high', label: 'High Tom', category: 'drum', description: 'Rack tom 1' },
  { id: 'tom_mid', label: 'Mid Tom', category: 'drum', description: 'Rack tom 2' },
  { id: 'tom_floor', label: 'Floor Tom', category: 'drum', description: 'Low floor tom' },
  { id: 'hihat_closed', label: 'Closed Hi-Hat', category: 'drum', description: 'Stick on closed hat' },
  { id: 'hihat_open', label: 'Open Hi-Hat', category: 'drum', description: 'Stick on open hat' },
  { id: 'hihat_foot', label: 'Foot Hi-Hat', category: 'drum', description: 'Chicked foot stroke' },
  { id: 'ride', label: 'Ride Cymbal', category: 'drum', description: 'Bow ping' },
  { id: 'ride_bell', label: 'Ride Bell', category: 'drum', description: 'Accented ride bell' },
  { id: 'crash', label: 'Crash Cymbal', category: 'drum', description: 'Accent crash cymbal' },

  // Metronome click voices
  { id: 'click_downbeat', label: 'Downbeat Click', category: 'metronome', description: 'Beat 1 accent' },
  { id: 'click_regular', label: 'Upbeat / Regular Click', category: 'metronome', description: 'Regular beat pulse' },
  { id: 'click_subdivision', label: 'Subdivision Click', category: 'metronome', description: 'Subdivision click' },
];

export interface SampleMetadata {
  voice: SampleVoiceId;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: number;
}

export interface StoredSample {
  metadata: SampleMetadata;
  data: ArrayBuffer;
}

export interface LibraryArchiveManifest {
  appName: 'metronono';
  version: string;
  exportedAt: string;
  counts: {
    scores: number;
    systems: number;
    samples: number;
  };
  samples: Array<{
    voice: SampleVoiceId;
    filename: string;
    mimeType: string;
    path: string;
    sizeBytes: number;
    updatedAt: number;
  }>;
}

export interface ImportResult {
  scoresLoaded: number;
  systemsLoaded: number;
  samplesLoaded: number;
  success: boolean;
  errors: string[];
}

export interface StorageAdapter {
  readonly id: string;
  readonly name: string;

  init(): Promise<void>;

  saveScores(scores: ReadingLine[]): Promise<void>;
  loadScores(): Promise<ReadingLine[]>;

  saveSystems(systems: DawsonSystem[]): Promise<void>;
  loadSystems(): Promise<DawsonSystem[]>;

  saveSample(
    voice: SampleVoiceId,
    audioData: Blob | ArrayBuffer,
    metadata?: Partial<SampleMetadata>
  ): Promise<void>;
  loadSample(voice: SampleVoiceId): Promise<StoredSample | null>;
  listSamples(): Promise<SampleMetadata[]>;
  deleteSample(voice: SampleVoiceId): Promise<void>;

  exportArchive(): Promise<Blob>;
  importArchive(file: Blob | ArrayBuffer): Promise<ImportResult>;

  isFileSystemAccessSupported(): boolean;
  linkLocalDirectory?(): Promise<boolean>;
  isLinked?(): boolean;
  getLinkedDirectoryName?(): string | null;
}

export async function blobToArrayBuffer(data: Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (typeof data.arrayBuffer === 'function') {
    return await data.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(data);
  });
}
