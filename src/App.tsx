import { useState, useMemo } from 'react';
import { Metronome } from './components/Metronome';
import { ReadingTrainingSection } from './components/ReadingTrainingSection';
import { DawsonOrchestrationSection } from './components/DawsonOrchestrationSection';
import { ToneTransportScheduler } from './audio/ToneTransportScheduler';
import { NotationViewMode } from './components/notation/DrumStaffView';

export function App() {
  const scheduler = useMemo(() => new ToneTransportScheduler(), []);
  const [viewMode, setViewMode] = useState<NotationViewMode>('reading');

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 md:p-8 selection:bg-teal-500 selection:text-white">
      <div className="w-full max-w-4xl flex flex-col items-center gap-8">
        {/* Metronome Engine & Click Controls */}
        <div className="w-full max-w-md">
          <Metronome scheduler={scheduler} />
        </div>

        {/* Alan Dawson Orchestration Engine, 3-Channel Mixer & Drum Monitor */}
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

        <footer className="text-center text-xs text-muted-foreground/80 space-y-1 pt-4 border-t border-border/40 w-full">
          <p>Sample-accurate Web Audio metronome & VexFlow 5 notation powered by Tone.js</p>
          <p className="font-mono text-[10px] text-teal-400/80">Alan Dawson Drum Method & Rhythmic Trainer</p>
        </footer>
      </div>
    </main>
  );
}

export default App;
