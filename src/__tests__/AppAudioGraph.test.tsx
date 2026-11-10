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
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  afterEach(() => {
    fakeToneRecorder.reset();
  });

  it('gives the shell one graph whose single Master is the only output', () => {
    render(<App />);

    expect(liveOutputSources()).toEqual(['mixer:master']);

    const master = fakeToneRecorder.destination.incoming[0];
    // Three Mixing Channels and their Audition nodes, from one graph, all feed that Master.
    expect(fakeToneRecorder.feedsInto(master).map((node) => node.label).sort()).toEqual(
      [
        'audition:click',
        'audition:orchestration',
        'audition:ostinato',
        'mixer:click',
        'mixer:orchestration',
        'mixer:ostinato',
      ]
    );
  });

  it('does not leak a second graph when StrictMode mounts the shell twice', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    expect(liveOutputSources()).toEqual(['mixer:master']);
  });

  it('releases the graph it owns when the shell unmounts', () => {
    const { unmount } = render(<App />);
    expect(liveOutputSources()).toEqual(['mixer:master']);

    unmount();

    expect(fakeToneRecorder.destination.incoming).toHaveLength(0);
  });
});
