import { useMemo } from 'react';
import { Metronome } from './components/Metronome';
import { ReadingTrainingSection } from './components/ReadingTrainingSection';
import { ToneTransportScheduler } from './audio/ToneTransportScheduler';

export function App() {
  const scheduler = useMemo(() => new ToneTransportScheduler(), []);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 md:p-8 selection:bg-teal-500 selection:text-white">
      <div className="w-full max-w-4xl flex flex-col items-center gap-8">
        {/* Metronome Engine & Click Controls */}
        <div className="w-full max-w-md">
          <Metronome scheduler={scheduler} />
        </div>

        {/* Single-Line Reading Training Section with Real-Time Playhead */}
        <div className="w-full">
          <ReadingTrainingSection scheduler={scheduler} />
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
