import JSZip from 'jszip';
import { ReadingLine } from '../domain/rhythm/types';
import { DawsonSystem } from '../domain/dawson/types';
import { LibraryArchiveManifest, StoredSample } from './types';

export interface UnpackedArchive {
  manifest: LibraryArchiveManifest;
  scores: ReadingLine[];
  systems: DawsonSystem[];
  samples: StoredSample[];
  success: boolean;
  errors: string[];
}

export class ArchiveService {
  public static readonly APP_NAME = 'metronono';
  public static readonly FORMAT_VERSION = '1.0.0';

  /**
   * Bundles all custom scores, Dawson systems, and uploaded audio samples into a downloadable .metronono zip file.
   */
  public static async exportArchive(
    scores: ReadingLine[],
    systems: DawsonSystem[],
    samples: StoredSample[]
  ): Promise<Blob> {
    const zip = new JSZip();

    const manifest: LibraryArchiveManifest = {
      appName: ArchiveService.APP_NAME,
      version: ArchiveService.FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      counts: {
        scores: scores.length,
        systems: systems.length,
        samples: samples.length,
      },
      samples: samples.map((sample) => ({
        voice: sample.metadata.voice,
        filename: sample.metadata.filename,
        mimeType: sample.metadata.mimeType,
        path: `samples/${sample.metadata.voice}.bin`,
        sizeBytes: sample.metadata.sizeBytes,
        updatedAt: sample.metadata.updatedAt,
      })),
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('scores.json', JSON.stringify(scores, null, 2));
    zip.file('systems.json', JSON.stringify(systems, null, 2));

    const samplesFolder = zip.folder('samples');
    for (const sample of samples) {
      if (samplesFolder) {
        samplesFolder.file(`${sample.metadata.voice}.bin`, sample.data);
      }
    }

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/x-metronono',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  /**
   * Unpacks a .metronono (.zip) archive and restores all scores, systems, and audio samples.
   */
  public static async importArchive(archiveData: Blob | ArrayBuffer): Promise<UnpackedArchive> {
    const errors: string[] = [];

    try {
      const zip = await JSZip.loadAsync(archiveData);

      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        return {
          manifest: {} as LibraryArchiveManifest,
          scores: [],
          systems: [],
          samples: [],
          success: false,
          errors: ['Invalid Metronono archive: missing manifest.json'],
        };
      }

      const manifestRaw = await manifestFile.async('text');
      const manifest: LibraryArchiveManifest = JSON.parse(manifestRaw);

      if (manifest.appName !== ArchiveService.APP_NAME) {
        return {
          manifest,
          scores: [],
          systems: [],
          samples: [],
          success: false,
          errors: [`Incompatible archive: expected appName 'metronono', got '${manifest.appName}'`],
        };
      }

      // Read scores
      let scores: ReadingLine[] = [];
      const scoresFile = zip.file('scores.json');
      if (scoresFile) {
        const scoresRaw = await scoresFile.async('text');
        scores = JSON.parse(scoresRaw);
      }

      // Read systems
      let systems: DawsonSystem[] = [];
      const systemsFile = zip.file('systems.json');
      if (systemsFile) {
        const systemsRaw = await systemsFile.async('text');
        systems = JSON.parse(systemsRaw);
      }

      // Read samples
      const samples: StoredSample[] = [];
      if (Array.isArray(manifest.samples)) {
        for (const meta of manifest.samples) {
          const sampleFile = zip.file(meta.path);
          if (sampleFile) {
            const data = await sampleFile.async('arraybuffer');
            samples.push({
              metadata: {
                voice: meta.voice,
                filename: meta.filename,
                mimeType: meta.mimeType,
                sizeBytes: data.byteLength,
                updatedAt: meta.updatedAt ?? Date.now(),
              },
              data,
            });
          } else {
            errors.push(`Missing sample asset file: ${meta.path}`);
          }
        }
      }

      return {
        manifest,
        scores,
        systems,
        samples,
        success: true,
        errors,
      };
    } catch (err: any) {
      return {
        manifest: {} as LibraryArchiveManifest,
        scores: [],
        systems: [],
        samples: [],
        success: false,
        errors: [`Failed to unpack archive: ${err?.message || String(err)}`],
      };
    }
  }
}
