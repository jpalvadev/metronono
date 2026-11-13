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
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8 selection:bg-accent selection:text-accent-foreground">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
        {/* Navigation & Storage Quick Access */}
        <header className="w-full flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-foreground uppercase flex items-center gap-2">
              <span className="text-primary">METRONONO</span>
            </h1>
            <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
              Core
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSampleBankOpen(true)}
              aria-label="Open Sample Bank and Storage"
              className="text-xs gap-1.5 h-8 border-border"
            >
              <FolderArchive className="w-3.5 h-3.5 text-primary" />
              <span>Sample Bank & Storage</span>
              {isLinked ? (
                <HardDrive className="w-3 h-3 text-primary ml-0.5" />
              ) : (
                <Database className="w-3 h-3 text-muted-foreground ml-0.5" />
              )}
            </Button>
          </div>
        </header>

        {/* Dashboard Top Grid: Metronome & Mixer Panel as side-by-side modules */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex">
            <Metronome scheduler={scheduler} />
          </div>
          <div className="lg:col-span-5 flex">
            <MixerPanel scheduler={scheduler} />
          </div>
        </div>

        {/* Alan Dawson Orchestration Engine */}
        <div className="w-full">
          <DawsonOrchestrationSection scheduler={scheduler} />
        </div>

        {/* Single-Line Reading Training Section */}
        <div className="w-full">
          <ReadingTrainingSection scheduler={scheduler} />
        </div>

        {/* Sample Bank & Storage CRUD Modal */}
        <SampleBankModal
          isOpen={isSampleBankOpen}
          onClose={() => setIsSampleBankOpen(false)}
          storageManager={storageManager}
          scheduler={scheduler}
        />

        <footer className="text-center text-xs text-muted-foreground/80 space-y-1 pt-4 border-t border-border w-full">
          <p>Sample-accurate Web Audio metronome & VexFlow 5 notation powered by Tone.js</p>
          <p className="font-mono text-[10px] text-muted-foreground">Alan Dawson Drum Method & Rhythmic Trainer</p>
        </footer>
      </div>
    </main>
  );
}

export default App;
