import { ReadingLine } from '../domain/rhythm/types';
import { DawsonSystem } from '../domain/dawson/types';
import {
  StorageAdapter,
  SampleVoiceId,
  SampleMetadata,
  StoredSample,
  ImportResult,
  blobToArrayBuffer,
} from './types';
import { ArchiveService } from './ArchiveService';

export class InMemoryStorageAdapter implements StorageAdapter {
  public readonly id = 'memory';
  public readonly name = 'In-Memory Storage';

  private scoresMap: Map<string, ReadingLine> = new Map();
  private systemsMap: Map<string, DawsonSystem> = new Map();
  private samplesMap: Map<SampleVoiceId, StoredSample> = new Map();

  public async init(): Promise<void> {
    // No-op for in-memory
  }

  public async saveScores(scores: ReadingLine[]): Promise<void> {
    this.scoresMap.clear();
    for (const score of scores) {
      this.scoresMap.set(score.id, score);
    }
  }

  public async loadScores(): Promise<ReadingLine[]> {
    return Array.from(this.scoresMap.values());
  }

  public async saveSystems(systems: DawsonSystem[]): Promise<void> {
    this.systemsMap.clear();
    for (const sys of systems) {
      this.systemsMap.set(sys.id, sys);
    }
  }

  public async loadSystems(): Promise<DawsonSystem[]> {
    return Array.from(this.systemsMap.values());
  }

  public async saveSample(
    voice: SampleVoiceId,
    audioData: Blob | ArrayBuffer,
    metadata?: Partial<SampleMetadata>
  ): Promise<void> {
    const data = await blobToArrayBuffer(audioData);

    const sampleMeta: SampleMetadata = {
      voice,
      filename: metadata?.filename ?? `${voice}.wav`,
      mimeType: metadata?.mimeType ?? 'audio/wav',
      sizeBytes: data.byteLength,
      updatedAt: metadata?.updatedAt ?? Date.now(),
    };

    this.samplesMap.set(voice, {
      metadata: sampleMeta,
      data,
    });
  }

  public async loadSample(voice: SampleVoiceId): Promise<StoredSample | null> {
    return this.samplesMap.get(voice) ?? null;
  }

  public async listSamples(): Promise<SampleMetadata[]> {
    return Array.from(this.samplesMap.values()).map((s) => s.metadata);
  }

  public async deleteSample(voice: SampleVoiceId): Promise<void> {
    this.samplesMap.delete(voice);
  }

  public async exportArchive(): Promise<Blob> {
    const scores = await this.loadScores();
    const systems = await this.loadSystems();
    const samples = Array.from(this.samplesMap.values());
    return ArchiveService.exportArchive(scores, systems, samples);
  }

  public async importArchive(file: Blob | ArrayBuffer): Promise<ImportResult> {
    const unpacked = await ArchiveService.importArchive(file);
    if (!unpacked.success) {
      return {
        scoresLoaded: 0,
        systemsLoaded: 0,
        samplesLoaded: 0,
        success: false,
        errors: unpacked.errors,
      };
    }

    await this.saveScores(unpacked.scores);
    await this.saveSystems(unpacked.systems);

    this.samplesMap.clear();
    for (const sample of unpacked.samples) {
      this.samplesMap.set(sample.metadata.voice, sample);
    }

    return {
      scoresLoaded: unpacked.scores.length,
      systemsLoaded: unpacked.systems.length,
      samplesLoaded: unpacked.samples.length,
      success: true,
      errors: unpacked.errors,
    };
  }

  public isFileSystemAccessSupported(): boolean {
    return false;
  }
}
