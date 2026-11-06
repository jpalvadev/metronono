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

export class FileSystemAccessAdapter implements StorageAdapter {
  public readonly id = 'filesystem';
  public readonly name = 'Local File System';

  private dirHandle: FileSystemDirectoryHandle | null = null;

  constructor(dirHandle?: FileSystemDirectoryHandle) {
    if (dirHandle) {
      this.dirHandle = dirHandle;
    }
  }

  public async init(): Promise<void> {
    // No-op until user triggers directory picker
  }

  public isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  public isLinked(): boolean {
    return this.dirHandle !== null;
  }

  public getLinkedDirectoryName(): string | null {
    return this.dirHandle ? (this.dirHandle as any).name ?? 'Local Folder' : null;
  }

  public setDirectoryHandle(dirHandle: FileSystemDirectoryHandle | null): void {
    this.dirHandle = dirHandle;
  }

  public async linkLocalDirectory(): Promise<boolean> {
    if (!this.isFileSystemAccessSupported()) {
      return false;
    }

    try {
      this.dirHandle = await (window as any).showDirectoryPicker({
        id: 'metronono-library',
        mode: 'readwrite',
      });
      return true;
    } catch {
      return false;
    }
  }

  private ensureDirectory(): FileSystemDirectoryHandle {
    if (!this.dirHandle) {
      throw new Error('No local folder is linked. Call linkLocalDirectory() first.');
    }
    return this.dirHandle;
  }

  private async getSamplesDir(create: boolean = true): Promise<FileSystemDirectoryHandle | null> {
    const root = this.ensureDirectory();
    try {
      return await root.getDirectoryHandle('samples', { create });
    } catch {
      return null;
    }
  }

  private async readJsonFile<T>(filename: string): Promise<T | null> {
    const root = this.ensureDirectory();
    try {
      const fileHandle = await root.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  private async writeJsonFile(filename: string, data: any): Promise<void> {
    const root = this.ensureDirectory();
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  }

  public async saveScores(scores: ReadingLine[]): Promise<void> {
    await this.writeJsonFile('scores.json', scores);
  }

  public async loadScores(): Promise<ReadingLine[]> {
    const data = await this.readJsonFile<ReadingLine[]>('scores.json');
    return data ?? [];
  }

  public async saveSystems(systems: DawsonSystem[]): Promise<void> {
    await this.writeJsonFile('systems.json', systems);
  }

  public async loadSystems(): Promise<DawsonSystem[]> {
    const data = await this.readJsonFile<DawsonSystem[]>('systems.json');
    return data ?? [];
  }

  private async getSamplesManifest(): Promise<Record<string, SampleMetadata>> {
    const samplesDir = await this.getSamplesDir(true);
    if (!samplesDir) return {};
    try {
      const fileHandle = await samplesDir.getFileHandle('samples-manifest.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  private async saveSamplesManifest(manifest: Record<string, SampleMetadata>): Promise<void> {
    const samplesDir = await this.getSamplesDir(true);
    if (!samplesDir) return;
    const fileHandle = await samplesDir.getFileHandle('samples-manifest.json', { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(JSON.stringify(manifest, null, 2));
    await writable.close();
  }

  public async saveSample(
    voice: SampleVoiceId,
    audioData: Blob | ArrayBuffer,
    metadata?: Partial<SampleMetadata>
  ): Promise<void> {
    const samplesDir = await this.getSamplesDir(true);
    if (!samplesDir) throw new Error('Could not access samples directory');

    const data = await blobToArrayBuffer(audioData);

    const sampleMeta: SampleMetadata = {
      voice,
      filename: metadata?.filename ?? `${voice}.wav`,
      mimeType: metadata?.mimeType ?? 'audio/wav',
      sizeBytes: data.byteLength,
      updatedAt: metadata?.updatedAt ?? Date.now(),
    };

    // Save binary file
    const fileHandle = await samplesDir.getFileHandle(`${voice}.bin`, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(data);
    await writable.close();

    // Update manifest
    const manifest = await this.getSamplesManifest();
    manifest[voice] = sampleMeta;
    await this.saveSamplesManifest(manifest);
  }

  public async loadSample(voice: SampleVoiceId): Promise<StoredSample | null> {
    const samplesDir = await this.getSamplesDir(false);
    if (!samplesDir) return null;

    const manifest = await this.getSamplesManifest();
    const meta = manifest[voice];
    if (!meta) return null;

    try {
      const fileHandle = await samplesDir.getFileHandle(`${voice}.bin`);
      const file = await fileHandle.getFile();
      const data = await file.arrayBuffer();
      return {
        metadata: meta,
        data,
      };
    } catch {
      return null;
    }
  }

  public async listSamples(): Promise<SampleMetadata[]> {
    const manifest = await this.getSamplesManifest();
    return Object.values(manifest);
  }

  public async deleteSample(voice: SampleVoiceId): Promise<void> {
    const samplesDir = await this.getSamplesDir(false);
    if (!samplesDir) return;

    try {
      await (samplesDir as any).removeEntry(`${voice}.bin`);
    } catch {
      // Safe ignore
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
