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

interface StoredSampleRecord {
  voice: SampleVoiceId;
  metadata: SampleMetadata;
  data: ArrayBuffer;
}

export class IndexedDBAdapter implements StorageAdapter {
  public readonly id = 'indexeddb';
  public readonly name = 'Persistent IndexedDB Storage';

  private dbName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'metronono_db') {
    this.dbName = dbName;
  }

  public async init(): Promise<void> {
    // Request persistent storage if supported by browser
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      try {
        await navigator.storage.persist();
      } catch {
        // Safe ignore
      }
    }

    if (typeof indexedDB === 'undefined') {
      return;
    }

    this.db = await this.openDatabase();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('scores')) {
          db.createObjectStore('scores', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('systems')) {
          db.createObjectStore('systems', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('samples')) {
          db.createObjectStore('samples', { keyPath: 'voice' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('IndexedDB is not available in this environment');
    }
    return this.db;
  }

  public async saveScores(scores: ReadingLine[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('scores', 'readwrite');
    const store = tx.objectStore('scores');

    await this.promisifyRequest(store.clear());
    for (const score of scores) {
      await this.promisifyRequest(store.put(score));
    }
    await this.promisifyTx(tx);
  }

  public async loadScores(): Promise<ReadingLine[]> {
    const db = await this.getDB();
    const tx = db.transaction('scores', 'readonly');
    const store = tx.objectStore('scores');
    const results = await this.promisifyRequest<ReadingLine[]>(store.getAll());
    return results ?? [];
  }

  public async saveSystems(systems: DawsonSystem[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('systems', 'readwrite');
    const store = tx.objectStore('systems');

    await this.promisifyRequest(store.clear());
    for (const sys of systems) {
      await this.promisifyRequest(store.put(sys));
    }
    await this.promisifyTx(tx);
  }

  public async loadSystems(): Promise<DawsonSystem[]> {
    const db = await this.getDB();
    const tx = db.transaction('systems', 'readonly');
    const store = tx.objectStore('systems');
    const results = await this.promisifyRequest<DawsonSystem[]>(store.getAll());
    return results ?? [];
  }

  public async saveSample(
    voice: SampleVoiceId,
    audioData: Blob | ArrayBuffer,
    metadata?: Partial<SampleMetadata>
  ): Promise<void> {
    const db = await this.getDB();
    const data = await blobToArrayBuffer(audioData);

    const sampleMeta: SampleMetadata = {
      voice,
      filename: metadata?.filename ?? `${voice}.wav`,
      mimeType: metadata?.mimeType ?? 'audio/wav',
      sizeBytes: data.byteLength,
      updatedAt: metadata?.updatedAt ?? Date.now(),
    };

    const record: StoredSampleRecord = {
      voice,
      metadata: sampleMeta,
      data,
    };

    const tx = db.transaction('samples', 'readwrite');
    const store = tx.objectStore('samples');
    await this.promisifyRequest(store.put(record));
    await this.promisifyTx(tx);
  }

  public async loadSample(voice: SampleVoiceId): Promise<StoredSample | null> {
    const db = await this.getDB();
    const tx = db.transaction('samples', 'readonly');
    const store = tx.objectStore('samples');
    const record = await this.promisifyRequest<StoredSampleRecord | undefined>(store.get(voice));

    if (!record) return null;
    return {
      metadata: record.metadata,
      data: record.data,
    };
  }

  public async listSamples(): Promise<SampleMetadata[]> {
    const db = await this.getDB();
    const tx = db.transaction('samples', 'readonly');
    const store = tx.objectStore('samples');
    const records = await this.promisifyRequest<StoredSampleRecord[]>(store.getAll());
    return (records ?? []).map((r) => r.metadata);
  }

  public async deleteSample(voice: SampleVoiceId): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('samples', 'readwrite');
    const store = tx.objectStore('samples');
    await this.promisifyRequest(store.delete(voice));
    await this.promisifyTx(tx);
  }

  public async exportArchive(): Promise<Blob> {
    const scores = await this.loadScores();
    const systems = await this.loadSystems();
    const sampleMetas = await this.listSamples();
    const samples: StoredSample[] = [];

    for (const meta of sampleMetas) {
      const s = await this.loadSample(meta.voice);
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

    // Clear and restore samples
    const db = await this.getDB();
    const tx = db.transaction('samples', 'readwrite');
    const store = tx.objectStore('samples');
    await this.promisifyRequest(store.clear());

    for (const sample of unpacked.samples) {
      const record: StoredSampleRecord = {
        voice: sample.metadata.voice,
        metadata: sample.metadata,
        data: sample.data,
      };
      await this.promisifyRequest(store.put(record));
    }
    await this.promisifyTx(tx);

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

  private promisifyRequest<T = any>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private promisifyTx(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}
