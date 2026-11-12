import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import App from '../App';
import { fakeToneRecorder } from '../test/fakeTone';

// The shell owns the audio scheduler, so it owns the graph it builds. Observed through the
// recording fake Tone (ADR-0005): exactly one graph reaches the audio destination, it reaches
// it only through the single Master, and nothing survives an unmount.
vi.mock('tone', async () => {
  const fake = await import('../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

/** The nodes that are actually connected to the audio destination right now. */
function liveOutputSources() {
  return fakeToneRecorder.destination.incoming.map((node) => node.label ?? node.kind);
}

describe('App audio graph lifecycle', () => {
  const EXPECTED_OUTPUTS = ['mixer:master:limiter'];

  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  afterEach(() => {
    fakeToneRecorder.reset();
  });

  it('gives the shell one graph whose mixing channel and audition nodes feed destination through the master limiter bus', () => {
    render(<App />);

    expect(liveOutputSources().sort()).toEqual(EXPECTED_OUTPUTS);
    const masterGain = fakeToneRecorder.nodes.find((n) => n.label === 'mixer:master:gain');
    expect(masterGain?.incoming.map((n) => n.label).sort()).toEqual([
      'audition:click',
      'audition:orchestration',
      'audition:ostinato',
      'mixer:click',
      'mixer:orchestration',
      'mixer:ostinato',
    ]);
  });

  it('does not leak a second graph when StrictMode mounts the shell twice', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    expect(liveOutputSources().sort()).toEqual(EXPECTED_OUTPUTS);
  });

  it('releases the graph it owns when the shell unmounts', () => {
    const { unmount } = render(<App />);
    expect(liveOutputSources().sort()).toEqual(EXPECTED_OUTPUTS);

    unmount();

    expect(fakeToneRecorder.destination.incoming).toHaveLength(0);
  });
});
