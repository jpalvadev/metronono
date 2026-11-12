import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import App from '../App';
import { getAudioContext } from '../audio/WebAudioContext';
import { FakeAudioContext, FakeAudioNode } from '../test/fakeWebAudio';

// The shell owns the audio scheduler, so it owns the graph it builds. Observed through the
// recording FakeAudioContext (ADR-0014): exactly one graph reaches the audio destination, it
// reaches it only through the single Master limiter bus, and nothing survives an unmount.

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

function liveOutputSources(): string[] {
  return fakeCtx().destination.incoming.map((node: FakeAudioNode) => node.label ?? 'unknown');
}

describe('App audio graph lifecycle', () => {
  const EXPECTED_OUTPUTS = ['mixer:master:limiter'];

  it('gives the shell one graph whose mixing channel and audition nodes feed destination through the master limiter bus', () => {
    render(<App />);

    expect(liveOutputSources().sort()).toEqual(EXPECTED_OUTPUTS);
    const masterGain = fakeCtx().gains.find((n) => n.label === 'mixer:master:gain');
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

    expect(fakeCtx().destination.incoming).toHaveLength(0);
  });
});
