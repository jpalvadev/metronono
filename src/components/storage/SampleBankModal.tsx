import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StorageManager } from '../../storage/StorageManager';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import {
  SampleVoiceId,
  SampleMetadata,
  ALL_SAMPLE_VOICES,
  VoiceDefinition,
} from '../../storage/types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  X,
  Volume2,
  Upload,
  RotateCcw,
  FolderArchive,
  Download,
  FolderCheck,
  FolderSync,
  HardDrive,
  Database,
  Music,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SampleBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageManager: StorageManager;
  scheduler?: ToneTransportScheduler;
}

export const SampleBankModal: React.FC<SampleBankModalProps> = ({
  isOpen,
  onClose,
  storageManager,
  scheduler,
}) => {
  const [samplesMap, setSamplesMap] = useState<Map<SampleVoiceId, SampleMetadata>>(new Map());
  const [isLinked, setIsLinked] = useState<boolean>(() => storageManager.isLinked());
  const [linkedDirName, setLinkedDirName] = useState<string | null>(() =>
    storageManager.getLinkedDirectoryName()
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const importInputRef = useRef<HTMLInputElement>(null);

  // Sync sample list and storage status
  const refreshStorageState = useCallback(async () => {
    try {
      const metas = await storageManager.listSamples();
      const map = new Map<SampleVoiceId, SampleMetadata>();
      for (const m of metas) {
        map.set(m.voice, m);
      }
      setSamplesMap(map);
      setIsLinked(storageManager.isLinked());
      setLinkedDirName(storageManager.getLinkedDirectoryName());
    } catch {
      // Safe error isolation
    }
  }, [storageManager]);

  useEffect(() => {
    if (!isOpen) return;

    refreshStorageState();

    const unsubSample = storageManager.onSampleChange(() => {
      refreshStorageState();
    });

    const unsubStorage = storageManager.onStorageChange(() => {
      refreshStorageState();
    });

    return () => {
      unsubSample();
      unsubStorage();
    };
  }, [isOpen, refreshStorageState, storageManager]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAudition = (voiceId: SampleVoiceId) => {
    if (scheduler?.auditionVoice) {
      scheduler.auditionVoice(voiceId);
    }
  };

  const handleFileUpload = async (voiceId: SampleVoiceId, file: File) => {
    try {
      await storageManager.saveSample(voiceId, file, {
        filename: file.name,
        mimeType: file.type || 'audio/wav',
      });
      setNotification({
        type: 'success',
        message: `Saved custom sample for ${voiceId}`,
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to upload sample: ${err?.message || String(err)}`,
      });
    }
  };

  const handleResetSample = async (voiceId: SampleVoiceId) => {
    try {
      await storageManager.deleteSample(voiceId);
      setNotification({
        type: 'success',
        message: `Restored default .wav sound for ${voiceId}`,
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to reset sample: ${err?.message || String(err)}`,
      });
    }
  };

  const handleLinkFolder = async () => {
    const success = await storageManager.linkLocalDirectory();
    if (success) {
      setNotification({
        type: 'success',
        message: `Linked to local folder: ${storageManager.getLinkedDirectoryName()}`,
      });
    } else {
      setNotification({
        type: 'error',
        message: 'Could not link local folder (access cancelled or unsupported).',
      });
    }
    setTimeout(() => setNotification(null), 3500);
  };

  const handleExportLibrary = async () => {
    try {
      setIsExporting(true);
      const blob = await storageManager.exportArchive();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metronono-library-${new Date().toISOString().split('T')[0]}.metronono`;
      document.body.appendChild(a);
      try {
        a.click();
      } catch {
        // Safe JSDOM navigation isolation
      }
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setNotification({
        type: 'success',
        message: 'Library exported successfully (.metronono archive).',
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Export failed: ${err?.message || String(err)}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportLibrary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const result = await storageManager.importArchive(file);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `Restored ${result.scoresLoaded} scores, ${result.systemsLoaded} systems, and ${result.samplesLoaded} audio samples!`,
        });
        if (scheduler?.syncStorageSamples) {
          await scheduler.syncStorageSamples(storageManager);
        }
      } else {
        setNotification({
          type: 'error',
          message: `Import failed: ${result.errors.join(', ')}`,
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Import failed: ${err?.message || String(err)}`,
      });
    } finally {
      setIsImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
      setTimeout(() => setNotification(null), 4000);
    }
  };

  if (!isOpen) return null;

  const drumVoices = ALL_SAMPLE_VOICES.filter((v) => v.category === 'drum');
  const metronomeVoices = ALL_SAMPLE_VOICES.filter((v) => v.category === 'metronome');
  const isFsSupported = storageManager.isFileSystemAccessSupported();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-bank-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 modal-scrim"
    >
      <div className="bg-card border border-border text-card-foreground rounded-none shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <h2 id="sample-bank-title" className="text-base font-semibold tracking-tight text-foreground">
                Sample Bank & Storage
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage custom audio samples, persistent storage, and backups
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-none text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Notifications banner */}
          {notification && (
            <div
              className={cn(
                'flex items-center gap-2 px-3.5 py-2.5 rounded-none text-xs font-medium border animate-in fade-in',
                notification.type === 'success'
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              )}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              )}
              <span>{notification.message}</span>
            </div>
          )}

          {/* Storage Layer Status Card */}
          <div className="bg-muted/30 border border-border/70 rounded-none p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-none bg-background border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5 sm:mt-0">
                {isLinked ? (
                  <HardDrive className="w-4 h-4 text-primary" />
                ) : (
                  <Database className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">Active Storage Layer:</span>
                  {isLinked ? (
                    <Badge variant="default" className="bg-primary/20 text-primary border-primary/30 text-[11px]">
                      <FolderCheck className="w-3 h-3 mr-1" />
                      Local Disk: {linkedDirName}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border/80 text-muted-foreground text-[11px]">
                      <Database className="w-3 h-3 mr-1 text-primary" />
                      Persistent IndexedDB (Guarded)
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  {isLinked
                    ? 'All scores, formulas, and audio files are synchronized directly to your physical folder.'
                    : 'Audio samples and presets are safely cached in IndexedDB with eviction protection.'}
                </p>
              </div>
            </div>

            {isFsSupported && (
              <Button
                variant={isLinked ? 'outline' : 'default'}
                size="sm"
                onClick={handleLinkFolder}
                className="shrink-0 text-xs gap-1.5"
              >
                <FolderSync className="w-3.5 h-3.5" />
                {isLinked ? 'Switch Folder' : 'Link Local Folder'}
              </Button>
            )}
          </div>

          {/* Backup & Restore Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-muted/15 border border-border rounded-none p-3">
            <div className="text-xs font-medium text-foreground">Library Archive (.metronono)</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLibrary}
                disabled={isExporting}
                className="text-xs gap-1.5 h-8 rounded-none"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                {isExporting ? 'Exporting...' : 'Export Library'}
              </Button>

              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
                aria-label="Import Library"
                className="inline-flex items-center justify-center rounded-none text-xs font-medium border border-border bg-transparent text-foreground hover:bg-muted/50 h-8 px-3 gap-1.5 transition-colors disabled:opacity-50 select-none"
              >
                <Upload className="w-3.5 h-3.5 text-primary" />
                {isImporting ? 'Importing...' : 'Import Library'}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".metronono,.zip,application/zip"
                onChange={handleImportLibrary}
                className="hidden"
              />
            </div>
          </div>

          {/* Drum Kit Voices Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground/80 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-primary" />
              Drum Kit Voices
            </h3>
            <div className="border border-border/70 rounded-none divide-y divide-border/50 overflow-hidden bg-card">
              {drumVoices.map((voice) => (
                <VoiceRow
                  key={voice.id}
                  voice={voice}
                  sample={samplesMap.get(voice.id)}
                  onAudition={() => handleAudition(voice.id)}
                  onUpload={(file) => handleFileUpload(voice.id, file)}
                  onReset={() => handleResetSample(voice.id)}
                />
              ))}
            </div>
          </div>

          {/* Metronome Voices Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground/80 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-primary" />
              Metronome Click Sounds
            </h3>
            <div className="border border-border/70 rounded-none divide-y divide-border/50 overflow-hidden bg-card">
              {metronomeVoices.map((voice) => (
                <VoiceRow
                  key={voice.id}
                  voice={voice}
                  sample={samplesMap.get(voice.id)}
                  onAudition={() => handleAudition(voice.id)}
                  onUpload={(file) => handleFileUpload(voice.id, file)}
                  onReset={() => handleResetSample(voice.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex justify-end">
          <Button variant="default" size="sm" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

interface VoiceRowProps {
  voice: VoiceDefinition;
  sample?: SampleMetadata;
  onAudition: () => void;
  onUpload: (file: File) => void;
  onReset: () => void;
}

const VoiceRow: React.FC<VoiceRowProps> = ({
  voice,
  sample,
  onAudition,
  onUpload,
  onReset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{voice.label}</span>
          {sample ? (
            <Badge variant="default" className="bg-primary/20 text-primary border-primary/30 text-[10px]">
              Custom Sample
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] text-muted-foreground bg-muted">
              Default .wav
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {sample ? `${sample.filename} (${formatFileSize(sample.sizeBytes)})` : voice.description}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAudition}
          aria-label={`Audition ${voice.label}`}
          title="Audition sound"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
        >
          <Volume2 className="w-4 h-4" />
        </Button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={`Upload sample for ${voice.label}`}
          title="Upload audio file (WAV/MP3/OGG)"
          className="h-8 w-8 inline-flex items-center justify-center rounded-none text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors select-none"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,audio/wav"
          data-testid={`upload-${voice.id}`}
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={!sample}
          data-testid={`reset-${voice.id}`}
          aria-label={`Reset ${voice.label} to default`}
          title="Reset to default .wav sound"
          className={cn(
            'h-8 w-8 p-0 text-muted-foreground hover:text-destructive',
            !sample && 'opacity-30 cursor-not-allowed'
          )}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
