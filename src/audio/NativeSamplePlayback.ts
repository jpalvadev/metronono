import { IGainNodeLike } from './AudioMixer';
import { getAudioContext } from './WebAudioContext';

interface ActiveSampleEntry {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Plays individual AudioBuffer strokes through a fresh native
 * `AudioBufferSourceNode -> per-hit GainNode -> targetChannelNode` chain.
 * Self-disconnects in `onended` and tracks active entries for immediate `stopAll()`.
 */
export class SampleStrokePlayer {
  private activeSources: Set<ActiveSampleEntry> = new Set();

  public playBuffer(
    buffer: AudioBuffer,
    time: number,
    velocity: number,
    targetNode: IGainNodeLike,
    label?: string
  ): void {
    const ctx = getAudioContext();
    const audioTime = time > 0 ? time : ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const hitGain = ctx.createGain();
    if (label) {
      (hitGain as unknown as { label?: string }).label = label;
    }
    const clampedVelocity = Math.max(0, velocity);
    hitGain.gain.value = clampedVelocity;
    hitGain.gain.setValueAtTime(clampedVelocity, audioTime);

    source.connect(hitGain);
    hitGain.connect(targetNode as unknown as AudioNode);

    const entry: ActiveSampleEntry = { source, gain: hitGain };
    this.activeSources.add(entry);

    source.onended = () => {
      this.activeSources.delete(entry);
      try {
        source.disconnect();
      } catch {
        // Safe disconnect
      }
      try {
        hitGain.disconnect();
      } catch {
        // Safe disconnect
      }
    };

    source.start(audioTime);
  }

  public stopAll(): void {
    const entries = Array.from(this.activeSources);
    this.activeSources.clear();
    for (const { source, gain } of entries) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // Ignore if already stopped
      }
      try {
        source.disconnect();
      } catch {
        // Safe disconnect
      }
      try {
        gain.disconnect();
      } catch {
        // Safe disconnect
      }
    }
  }
}
