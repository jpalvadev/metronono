import { Metronome } from './components/Metronome';

export function App() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 selection:bg-teal-500 selection:text-white">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <Metronome />
        <footer className="text-center text-xs text-muted-foreground/80 space-y-1">
          <p>Sample-accurate Web Audio metronome powered by Tone.js</p>
          <p className="font-mono text-[10px] text-teal-400/80">Alan Dawson Drum Method & Rhythmic Trainer</p>
        </footer>
      </div>
    </main>
  );
}

export default App;
