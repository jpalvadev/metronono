import { useState, useMemo, useEffect, useRef } from 'react';
import { Metronome } from './components/Metronome';
import { ReadingTrainingSection } from './components/ReadingTrainingSection';
import { DawsonOrchestrationSection } from './components/DawsonOrchestrationSection';
import { MixerPanel } from './components/MixerPanel';
import { ToneTransportScheduler } from './audio/ToneTransportScheduler';
import { StorageManager } from './storage/StorageManager';
import { SampleBankModal } from './components/storage/SampleBankModal';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { FolderArchive, HardDrive, Database } from 'lucide-react';
import { NotationViewMode } from './components/notation/DrumStaffView';

export function App() {
  const storageManager = useMemo(() => new StorageManager(), []);

  // The shell owns the only audio graph: it constructs one scheduler per mounted shell — a
  // StrictMode double render must not build a second one — and releases it when the shell unmounts.
  const schedulerRef = useRef<ToneTransportScheduler | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = new ToneTransportScheduler({ storageManager });
  }
  const scheduler = schedulerRef.current;

  useEffect(() => {
    return () => {
      schedulerRef.current?.dispose();
      schedulerRef.current = null;
    };
  }, []);

  const [isSampleBankOpen, setIsSampleBankOpen] = useState(false);
  const [isLinked, setIsLinked] = useState(() => storageManager.isLinked());
  const [viewMode, setViewMode] = useState<NotationViewMode>('reading');

  useEffect(() => {
    storageManager.init().then(() => {
      scheduler.syncStorageSamples(storageManager);
    });

    const unsub = storageManager.onStorageChange(() => {
      setIsLinked(storageManager.isLinked());
    });
    return unsub;
  }, [storageManager, scheduler]);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 md:p-8 selection:bg-teal-500 selection:text-white">
      <div className="w-full max-w-4xl flex flex-col items-center gap-8">
        {/* Navigation & Storage Quick Access */}
        <header className="w-full flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="text-teal-400">Metronono</span>
            </h1>
            <Badge variant="outline" className="border-teal-500/30 text-teal-400 text-[10px]">
              Core
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSampleBankOpen(true)}
              aria-label="Open Sample Bank and Storage"
              className="text-xs gap-1.5 h-8 border-border/80 hover:border-teal-500/50"
            >
              <FolderArchive className="w-3.5 h-3.5 text-teal-400" />
              <span>Sample Bank & Storage</span>
              {isLinked ? (
                <HardDrive className="w-3 h-3 text-teal-400 ml-0.5" />
              ) : (
                <Database className="w-3 h-3 text-muted-foreground ml-0.5" />
              )}
            </Button>
          </div>
        </header>

        {/* Metronome Engine & Click Controls */}
        <div className="w-full max-w-md">
          <Metronome scheduler={scheduler} />
        </div>

        {/* Mixing Channels & Mixer Panel: channel volumes, mutes and practice presets */}
        <div className="w-full max-w-md">
          <MixerPanel scheduler={scheduler} />
        </div>

        {/* Alan Dawson Orchestration Engine & Drum Monitor */}
        <div className="w-full">
          <DawsonOrchestrationSection scheduler={scheduler} />
        </div>

        {/* Dual-View Notation Section: Reading View (1-line) vs Drum Staff View (5-line) */}
        <div className="w-full">
          <ReadingTrainingSection
            scheduler={scheduler}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        {/* Sample Bank & Storage CRUD Modal */}
        <SampleBankModal
          isOpen={isSampleBankOpen}
          onClose={() => setIsSampleBankOpen(false)}
          storageManager={storageManager}
          scheduler={scheduler}
        />

        <footer className="text-center text-xs text-muted-foreground/80 space-y-1 pt-4 border-t border-border/40 w-full">
          <p>Sample-accurate Web Audio metronome & VexFlow 5 notation powered by Tone.js</p>
          <p className="font-mono text-[10px] text-teal-400/80">Alan Dawson Drum Method & Rhythmic Trainer</p>
        </footer>
      </div>
    </main>
  );
}

export default App;
