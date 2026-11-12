/**
 * Single lazily-unlocked native Web Audio `AudioContext` provider.
 * Replaces Tone.js context ownership per ADR-0014.
 */

let sharedContext: AudioContext | null = null;

function resolveAudioContextConstructor(): typeof AudioContext | undefined {
  const g = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

/**
 * Returns the singleton native `AudioContext`, creating it lazily on first access.
 */
export function getAudioContext(): AudioContext {
  if (sharedContext && sharedContext.state !== 'closed') {
    return sharedContext;
  }

  const Ctor = resolveAudioContextConstructor();
  if (!Ctor) {
    throw new Error('Web Audio API is not supported in this environment (AudioContext unavailable).');
  }

  sharedContext = new Ctor();
  return sharedContext;
}

/**
 * Unlocks/resumes the shared `AudioContext` on user gesture if it is suspended.
 */
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

/**
 * Decodes an encoded audio `ArrayBuffer` (e.g. `.wav`) using the native `AudioContext`.
 * Slices the input buffer so standard browsers do not detach the caller's `ArrayBuffer`.
 */
export async function decodeAudioDataWithNativeContext(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  return ctx.decodeAudioData(data.slice(0));
}

/**
 * Clears the cached singleton `AudioContext` for test isolation.
 */
export function resetAudioContextForTesting(): void {
  sharedContext = null;
}
