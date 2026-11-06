import * as Tone from 'tone';
import { DrumVoice, ScheduledDrumEvent } from '../domain/dawson/types';
import { IGainNodeLike } from './AudioMixer';

export type SynthTriggerFn = (
  voice: DrumVoice,
  time: number,
  velocity: number,
  source: 'ostinato' | 'orchestration'
) => void;

export interface DrumKitPlayerOptions {
  synthTrigger?: SynthTriggerFn;
  ostinatoNode?: IGainNodeLike;
  orchestrationNode?: IGainNodeLike;
}

export interface IDrumKitPlayer {
  play(event: ScheduledDrumEvent, time: number): void;
  triggerVoice(
    voice: DrumVoice,
    time?: number,
    velocity?: number,
    source?: 'ostinato' | 'orchestration'
  ): void;
  onDrumHit(listener: (event: ScheduledDrumEvent, time: number) => void): () => void;
  initSynths?(ostinatoNode: any, orchestrationNode: any): void;
  loadSampleBuffer?(voice: DrumVoice, buffer: any): void;
  removeSampleBuffer?(voice: DrumVoice): void;
  hasCustomSample?(voice: DrumVoice): boolean;
  clearAllCustomSamples?(): void;
  dispose?(): void;
}

export class DrumKitPlayer implements IDrumKitPlayer {
  private synthTrigger?: SynthTriggerFn;
  private hitListeners: Set<(event: ScheduledDrumEvent, time: number) => void> = new Set();
  private ostinatoNode?: any;
  private orchestrationNode?: any;
  private customSampleBuffers: Map<DrumVoice, any> = new Map();

  // Tone.js synths for real audio output
  private kickSynth?: Tone.MembraneSynth;
  private snareNoiseSynth?: Tone.NoiseSynth;
  private snareMembraneSynth?: Tone.MembraneSynth;
  private tomHighSynth?: Tone.MembraneSynth;
  private tomMidSynth?: Tone.MembraneSynth;
  private tomFloorSynth?: Tone.MembraneSynth;
  private rideSynth?: Tone.MetalSynth;
  private hihatSynth?: Tone.MetalSynth;
  private crashSynth?: Tone.MetalSynth;

  constructor(options?: DrumKitPlayerOptions) {
    if (options?.synthTrigger) {
      this.synthTrigger = options.synthTrigger;
    }

    if (options?.ostinatoNode && options?.orchestrationNode) {
      this.initSynths(options.ostinatoNode, options.orchestrationNode);
    }
  }

  public initSynths(ostinatoNode: any, orchestrationNode: any): void {
    this.ostinatoNode = ostinatoNode;
    this.orchestrationNode = orchestrationNode;
    try {
      if (typeof Tone === 'undefined') return;

      // Orchestration synths connected to orchestration channel
      this.kickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.3 },
      });
      if (orchestrationNode) this.kickSynth.connect(orchestrationNode);

      this.snareNoiseSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      });
      if (orchestrationNode) this.snareNoiseSynth.connect(orchestrationNode);

      this.snareMembraneSynth = new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 2,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      });
      if (orchestrationNode) this.snareMembraneSynth.connect(orchestrationNode);

      this.tomHighSynth = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.3 },
      });
      if (orchestrationNode) this.tomHighSynth.connect(orchestrationNode);

      this.tomMidSynth = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.3 },
      });
      if (orchestrationNode) this.tomMidSynth.connect(orchestrationNode);

      this.tomFloorSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.45, sustain: 0.01, release: 0.4 },
      });
      if (orchestrationNode) this.tomFloorSynth.connect(orchestrationNode);

      this.crashSynth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 1.2, release: 0.2 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      });
      if (orchestrationNode) this.crashSynth.connect(orchestrationNode);

      // Ostinato synths connected to ostinato channel
      this.rideSynth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.6, release: 0.15 },
        harmonicity: 4.8,
        modulationIndex: 28,
        resonance: 5000,
        octaves: 1.2,
      });
      if (ostinatoNode) this.rideSynth.connect(ostinatoNode);

      this.hihatSynth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
        harmonicity: 5.2,
        modulationIndex: 36,
        resonance: 6000,
        octaves: 1.5,
      });
      if (ostinatoNode) this.hihatSynth.connect(ostinatoNode);
    } catch {
      // In testing environments without AudioContext, synths are safely skipped
    }
  }

  public play(event: ScheduledDrumEvent, time: number): void {
    const velocity = event.velocity ?? 0.8;
    this.executeVoiceSound(event.voice, time, velocity, event.source);
    this.notifyHit(event, time);
  }

  public triggerVoice(
    voice: DrumVoice,
    time: number = 0,
    velocity: number = 0.8,
    source?: 'ostinato' | 'orchestration'
  ): void {
    const isOstinatoVoice = voice === 'ride' || voice === 'ride_bell' || voice.startsWith('hihat');
    const channelSource: 'ostinato' | 'orchestration' = source ?? (isOstinatoVoice ? 'ostinato' : 'orchestration');

    const event: ScheduledDrumEvent = {
      timeInMeasure: 0,
      voice,
      velocity,
      dynamic: 'normal',
      source: channelSource,
    };

    this.play(event, time);
  }

  public onDrumHit(listener: (event: ScheduledDrumEvent, time: number) => void): () => void {
    this.hitListeners.add(listener);
    return () => {
      this.hitListeners.delete(listener);
    };
  }

  public loadSampleBuffer(voice: DrumVoice, buffer: any): void {
    this.customSampleBuffers.set(voice, buffer);
  }

  public removeSampleBuffer(voice: DrumVoice): void {
    this.customSampleBuffers.delete(voice);
  }

  public hasCustomSample(voice: DrumVoice): boolean {
    return this.customSampleBuffers.has(voice);
  }

  public clearAllCustomSamples(): void {
    this.customSampleBuffers.clear();
  }

  public playCustomSample(
    buffer: any,
    time: number,
    velocity: number,
    source: 'ostinato' | 'orchestration'
  ): void {
    try {
      if (typeof Tone === 'undefined') return;
      const audioTime = time > 0 ? time : Tone.now();
      const targetNode = source === 'ostinato' ? this.ostinatoNode : this.orchestrationNode;
      const bufferSource = new Tone.ToneBufferSource(buffer);
      const gainNode = new Tone.Gain(velocity);
      bufferSource.connect(gainNode);
      if (targetNode) {
        gainNode.connect(targetNode);
      } else {
        gainNode.toDestination();
      }
      bufferSource.start(audioTime);
    } catch {
      // Safe isolation
    }
  }

  public dispose(): void {
    this.hitListeners.clear();
    this.customSampleBuffers.clear();
    const synths = [
      this.kickSynth,
      this.snareNoiseSynth,
      this.snareMembraneSynth,
      this.tomHighSynth,
      this.tomMidSynth,
      this.tomFloorSynth,
      this.rideSynth,
      this.hihatSynth,
      this.crashSynth,
    ];

    synths.forEach((synth) => {
      try {
        synth?.dispose();
      } catch {
        // Safe disposal
      }
    });
  }

  private executeVoiceSound(
    voice: DrumVoice,
    time: number,
    velocity: number,
    source: 'ostinato' | 'orchestration'
  ): void {
    const customBuffer = this.customSampleBuffers.get(voice);
    if (customBuffer) {
      this.playCustomSample(customBuffer, time, velocity, source);
      return;
    }

    // If a custom or mock trigger function is registered, invoke it
    if (this.synthTrigger) {
      this.synthTrigger(voice, time, velocity, source);
      return;
    }

    // Built-in Tone.js synthesis execution
    try {
      const audioTime = time > 0 ? time : Tone.now();

      switch (voice) {
        case 'kick':
          this.kickSynth?.triggerAttackRelease('C1', '8n', audioTime, velocity);
          break;

        case 'snare':
          this.snareMembraneSynth?.triggerAttackRelease('D2', '16n', audioTime, velocity * 0.7);
          this.snareNoiseSynth?.triggerAttackRelease('16n', audioTime, velocity);
          break;

        case 'snare_ghost':
          this.snareNoiseSynth?.triggerAttackRelease('32n', audioTime, velocity * 0.4);
          break;

        case 'tom_high':
          this.tomHighSynth?.triggerAttackRelease('G2', '8n', audioTime, velocity);
          break;

        case 'tom_mid':
          this.tomMidSynth?.triggerAttackRelease('D2', '8n', audioTime, velocity);
          break;

        case 'tom_floor':
          this.tomFloorSynth?.triggerAttackRelease('A1', '8n', audioTime, velocity);
          break;

        case 'ride':
          this.rideSynth?.triggerAttackRelease('16n', audioTime, velocity);
          break;

        case 'ride_bell':
          this.rideSynth?.triggerAttackRelease('32n', audioTime, velocity * 1.1);
          break;

        case 'hihat_closed':
        case 'hihat_foot':
          this.hihatSynth?.triggerAttackRelease('32n', audioTime, velocity);
          break;

        case 'hihat_open':
          this.hihatSynth?.triggerAttackRelease('8n', audioTime, velocity);
          break;

        case 'crash':
          this.crashSynth?.triggerAttackRelease('4n', audioTime, velocity);
          break;

        default:
          break;
      }
    } catch {
      // Graceful error isolation for headless audio
    }
  }

  private notifyHit(event: ScheduledDrumEvent, time: number): void {
    this.hitListeners.forEach((listener) => {
      try {
        listener(event, time);
      } catch {
        // Safe listener dispatch
      }
    });
  }
}
