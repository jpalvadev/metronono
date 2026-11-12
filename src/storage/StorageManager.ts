import { Capacitor } from '@capacitor/core';
import { decodeAudioDataWithNativeContext } from '../audio/WebAudioContext';
import { ReadingLine } from '../domain/rhythm/types';
import { DawsonSystem } from '../domain/dawson/types';
import {
  StorageAdapter,
  SampleVoiceId,
  SampleMetadata,
  StoredSample,
  ImportResult,
} from './types';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import { FileSystemAccessAdapter } from './FileSystemAccessAdapter';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter';
import { CapacitorFilesystemAdapter } from './CapacitorFilesystemAdapter';

export interface StorageManagerOptions {
  defaultAdapter?: StorageAdapter;
}

export type SampleChangeListener = (voice: SampleVoiceId, sample: StoredSample | null) => void;
export type StorageChangeListener = () => void;

export class StorageManager {
  private activeAdapter: StorageAdapter;
  private fileSystemAdapter: FileSystemAccessAdapter;
  private capacitorAdapter: CapacitorFilesystemAdapter;
  private indexedDBAdapter: IndexedDBAdapter;
  private memoryAdapter: InMemoryStorageAdapter;

  private sampleChangeListeners: Set<SampleChangeListener> = new Set();
  private storageChangeListeners: Set<StorageChangeListener> = new Set();

  private audioBufferCache: Map<SampleVoiceId, AudioBuffer> = new Map();

  constructor(options?: StorageManagerOptions) {
    this.fileSystemAdapter = new FileSystemAccessAdapter();
    this.capacitorAdapter = new CapacitorFilesystemAdapter();
    this.indexedDBAdapter = new IndexedDBAdapter();
    this.memoryAdapter = new InMemoryStorageAdapter();

    if (options?.defaultAdapter) {
      this.activeAdapter = options.defaultAdapter;
    } else if (Capacitor.isNativePlatform()) {
      this.activeAdapter = this.capacitorAdapter;
    } else if (typeof indexedDB !== 'undefined') {
      this.activeAdapter = this.indexedDBAdapter;
    } else {
      this.activeAdapter = this.memoryAdapter;
    }
  }

  public async init(): Promise<void> {
    await this.activeAdapter.init();
    await this.preloadAllSamples();
  }

  public getActiveAdapter(): StorageAdapter {
    return this.activeAdapter;
  }

  public getAdapterType(): 'capacitor' | 'filesystem' | 'indexeddb' | 'memory' {
    if (this.activeAdapter.id === 'capacitor') return 'capacitor';
    if (this.activeAdapter.id === 'filesystem') return 'filesystem';
    if (this.activeAdapter.id === 'indexeddb') return 'indexeddb';
    return 'memory';
  }

  public isFileSystemAccessSupported(): boolean {
    return this.fileSystemAdapter.isFileSystemAccessSupported();
  }

  public isLinked(): boolean {
    return this.fileSystemAdapter.isLinked() && this.activeAdapter.id === 'filesystem';
  }

  public getLinkedDirectoryName(): string | null {
    return this.fileSystemAdapter.getLinkedDirectoryName();
  }

  public async linkLocalDirectory(): Promise<boolean> {
    const success = await this.fileSystemAdapter.linkLocalDirectory();
    if (success) {
      this.activeAdapter = this.fileSystemAdapter;
      await this.preloadAllSamples();
      this.notifyStorageChange();
      return true;
    }
    return false;
  }

  public async unlinkLocalDirectory(): Promise<void> {
    this.fileSystemAdapter.setDirectoryHandle(null);
    if (Capacitor.isNativePlatform()) {
      this.activeAdapter = this.capacitorAdapter;
    } else if (typeof indexedDB !== 'undefined') {
      this.activeAdapter = this.indexedDBAdapter;
    } else {
      this.activeAdapter = this.memoryAdapter;
    }
    await this.preloadAllSamples();
    this.notifyStorageChange();
  }

  public async saveScores(scores: ReadingLine[]): Promise<void> {
    await this.activeAdapter.saveScores(scores);
  }

  public async loadScores(): Promise<ReadingLine[]> {
    return await this.activeAdapter.loadScores();
  }

  public async saveSystems(systems: DawsonSystem[]): Promise<void> {
    await this.activeAdapter.saveSystems(systems);
  }

  public async loadSystems(): Promise<DawsonSystem[]> {
    return await this.activeAdapter.loadSystems();
  }

  public async saveSample(
    voice: SampleVoiceId,
    audioData: Blob | ArrayBuffer,
    metadata?: Partial<SampleMetadata>
  ): Promise<void> {
    await this.activeAdapter.saveSample(voice, audioData, metadata);
    const stored = await this.activeAdapter.loadSample(voice);

    if (stored) {
      const decoded = await this.decodeAudioData(stored.data);
      if (decoded) {
        this.audioBufferCache.set(voice, decoded);
      }
    }

    this.notifySampleChange(voice, stored);
  }

  public async loadSample(voice: SampleVoiceId): Promise<StoredSample | null> {
    return await this.activeAdapter.loadSample(voice);
  }

  public async listSamples(): Promise<SampleMetadata[]> {
    return await this.activeAdapter.listSamples();
  }

  public async deleteSample(voice: SampleVoiceId): Promise<void> {
    await this.activeAdapter.deleteSample(voice);
    this.audioBufferCache.delete(voice);
    this.notifySampleChange(voice, null);
  }

  public async exportArchive(): Promise<Blob> {
    return await this.activeAdapter.exportArchive();
  }

  public async importArchive(file: Blob | ArrayBuffer): Promise<ImportResult> {
    const result = await this.activeAdapter.importArchive(file);
    if (result.success) {
      await this.preloadAllSamples();
      // Notify all current samples
      const samples = await this.activeAdapter.listSamples();
      for (const meta of samples) {
        const stored = await this.activeAdapter.loadSample(meta.voice);
        this.notifySampleChange(meta.voice, stored);
      }
      this.notifyStorageChange();
    }
    return result;
  }

  public onSampleChange(listener: SampleChangeListener): () => void {
    this.sampleChangeListeners.add(listener);
    return () => {
      this.sampleChangeListeners.delete(listener);
    };
  }

  public onStorageChange(listener: StorageChangeListener): () => void {
    this.storageChangeListeners.add(listener);
    return () => {
      this.storageChangeListeners.delete(listener);
    };
  }

  public getAudioBuffer(voice: SampleVoiceId): AudioBuffer | null {
    return this.audioBufferCache.get(voice) ?? null;
  }

  public async decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer | null> {
    try {
      return await decodeAudioDataWithNativeContext(data);
    } catch {
      return null;
    }
  }

  public async preloadAllSamples(): Promise<Map<SampleVoiceId, AudioBuffer>> {
    this.audioBufferCache.clear();
    try {
      const metas = await this.activeAdapter.listSamples();
      for (const meta of metas) {
        const stored = await this.activeAdapter.loadSample(meta.voice);
        if (stored) {
          const decoded = await this.decodeAudioData(stored.data);
          if (decoded) {
            this.audioBufferCache.set(meta.voice, decoded);
          }
        }
      }
    } catch {
      // Safe error isolation
    }
    return this.audioBufferCache;
  }

  private notifySampleChange(voice: SampleVoiceId, sample: StoredSample | null): void {
    this.sampleChangeListeners.forEach((listener) => {
      try {
        listener(voice, sample);
      } catch {
        // Safe listener error isolation
      }
    });
  }

  private notifyStorageChange(): void {
    this.storageChangeListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Safe listener error isolation
      }
    });
  }
}
