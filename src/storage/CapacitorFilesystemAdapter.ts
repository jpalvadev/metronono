import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
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

const BASE_DIR = Directory.Documents;
const METRONONO_DIR = 'Metronono';
const SAMPLES_DIR = 'Metronono/samples';
const SCORES_FILE = 'Metronono/scores.json';
const SYSTEMS_FILE = 'Metronono/systems.json';
const SAMPLES_MANIFEST_FILE = 'Metronono/samples/samples-manifest.json';

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class CapacitorFilesystemAdapter implements StorageAdapter {
  public readonly id = 'capacitor';
  public readonly name = 'Capacitor Android File System';

  public async init(): Promise<void> {
    await this.ensureDirectories();
  }

  public isFileSystemAccessSupported(): boolean {
    return Capacitor.isNativePlatform() || typeof Filesystem !== 'undefined';
  }

  public isLinked(): boolean {
    return true;
  }

  public getLinkedDirectoryName(): string | null {
    return `Documents/${METRONONO_DIR}`;
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: SAMPLES_DIR,
        directory: BASE_DIR,
        recursive: true,
      });
    } catch {
      // Ignore if directory already exists
    }
  }

  private async readJsonFile<T>(path: string): Promise<T | null> {
    try {
      const result = await Filesystem.readFile({
        path,
        directory: BASE_DIR,
        encoding: Encoding.UTF8,
      });
      if (typeof result.data === 'string') {
        return JSON.parse(result.data) as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async writeJsonFile(path: string, data: any): Promise<void> {
    await this.ensureDirectories();
    await Filesystem.writeFile({
      path,
      data: JSON.stringify(data, null, 2),
      directory: BASE_DIR,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }

  public async saveScores(scores: ReadingLine[]): Promise<void> {
    await this.writeJsonFile(SCORES_FILE, scores);
  }

  public async loadScores(): Promise<ReadingLine[]> {
    const scores = await this.readJsonFile<ReadingLine[]>(SCORES_FILE);
    return scores ?? [];
  }

  public async saveSystems(systems: DawsonSystem[]): Promise<void> {
    await this.writeJsonFile(SYSTEMS_FILE, systems);
  }

  public async loadSystems(): Promise<DawsonSystem[]> {
    const systems = await this.readJsonFile<DawsonSystem[]>(SYSTEMS_FILE);
    return systems ?? [];
  }

  private async getSamplesManifest(): Promise<Record<string, SampleMetadata>> {
    const manifest = await this.readJsonFile<Record<string, SampleMetadata>>(SAMPLES_MANIFEST_FILE);
    return manifest ?? {};
  }

  private async saveSamplesManifest(manifest: Record<string, SampleMetadata>): Promise<void> {
    await this.writeJsonFile(SAMPLES_MANIFEST_FILE, manifest);
  }

  public async saveSample(
    voice: SampleVoiceId,
    audioData: Blob | ArrayBuffer,
    metadata?: Partial<SampleMetadata>
  ): Promise<void> {
    await this.ensureDirectories();

    const data = await blobToArrayBuffer(audioData);
    const base64Data = arrayBufferToBase64(data);

    const sampleMeta: SampleMetadata = {
      voice,
      filename: metadata?.filename ?? `${voice}.wav`,
      mimeType: metadata?.mimeType ?? 'audio/wav',
      sizeBytes: data.byteLength,
      updatedAt: metadata?.updatedAt ?? Date.now(),
    };

    const filePath = `${SAMPLES_DIR}/${voice}.bin`;
    await Filesystem.writeFile({
      path: filePath,
      data: base64Data,
      directory: BASE_DIR,
      recursive: true,
    });

    const manifest = await this.getSamplesManifest();
    manifest[voice] = sampleMeta;
    await this.saveSamplesManifest(manifest);
  }

  public async loadSample(voice: SampleVoiceId): Promise<StoredSample | null> {
    const manifest = await this.getSamplesManifest();
    const meta = manifest[voice];
    if (!meta) return null;

    try {
      const filePath = `${SAMPLES_DIR}/${voice}.bin`;
      const result = await Filesystem.readFile({
        path: filePath,
        directory: BASE_DIR,
      });

      if (typeof result.data === 'string') {
        const buffer = base64ToArrayBuffer(result.data);
        return {
          metadata: meta,
          data: buffer,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  public async listSamples(): Promise<SampleMetadata[]> {
    const manifest = await this.getSamplesManifest();
    return Object.values(manifest);
  }

  public async deleteSample(voice: SampleVoiceId): Promise<void> {
    try {
      const filePath = `${SAMPLES_DIR}/${voice}.bin`;
      await Filesystem.deleteFile({
        path: filePath,
        directory: BASE_DIR,
      });
    } catch {
      // File may not exist
    }

    const manifest = await this.getSamplesManifest();
    if (manifest[voice]) {
      delete manifest[voice];
      await this.saveSamplesManifest(manifest);
    }
  }

  public async exportArchive(): Promise<Blob> {
    const scores = await this.loadScores();
    const systems = await this.loadSystems();
    const metas = await this.listSamples();
    const samples: StoredSample[] = [];

    for (const m of metas) {
      const s = await this.loadSample(m.voice);
      if (s) samples.push(s);
    }

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

    for (const s of unpacked.samples) {
      await this.saveSample(s.metadata.voice, s.data, s.metadata);
    }

    return {
      scoresLoaded: unpacked.scores.length,
      systemsLoaded: unpacked.systems.length,
      samplesLoaded: unpacked.samples.length,
      success: true,
      errors: unpacked.errors,
    };
  }
}
