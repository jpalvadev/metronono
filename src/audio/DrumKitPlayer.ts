import * as Tone from 'tone';
import { DrumVoice, ScheduledDrumEvent } from '../domain/dawson/types';
import { IAudioMixer, IGainNodeLike, MixerChannelId } from './AudioMixer';

// The lane a drum sound belongs to. A Mixing Channel is only ever 'click' for metronome
// clicks; drum voices play on the Ostinato or Orchestration channel.
export type DrumLane = Extract<MixerChannelId, 'ostinato' | 'orchestration'>;

// Every Mixing Channel line owns a rig of the drum voices: one rig for the channel's
// audible line and one for the Audition node it shares. An instrument belongs to exactly
// one line, so a voice can never be played on two lines at once.
export type RigMode = 'mix' | 'audition';
type RigKey = `${DrumLane}:${RigMode}`;

interface DrumRig {
  kick: Tone.MembraneSynth;
  snareNoise: Tone.NoiseSynth;
  snareMembrane: Tone.MembraneSynth;
  tomHigh: Tone.MembraneSynth;
  tomMid: Tone.MembraneSynth;
  tomFloor: Tone.MembraneSynth;
  crash: Tone.MetalSynth;
  ride: Tone.MetalSynth;
  hihat: Tone.MetalSynth;
}

export interface IDrumKitPlayer {
  initSynths?(): boolean;
  play(event: ScheduledDrumEvent, time: number): void;
  triggerVoice(
    voice: DrumVoice,
    time?: number,
    velocity?: number,
    source?: DrumLane
  ): void;
  onDrumHit(listener: (event: ScheduledDrumEvent, time: number) => void): () => void;
  loadSampleBuffer?(voice: DrumVoice, buffer: any): void;
  removeSampleBuffer?(voice: DrumVoice): void;
  hasCustomSample?(voice: DrumVoice): boolean;
  clearAllCustomSamples?(): void;
  playCustomSample?(
    buffer: any,
    time: number,
    velocity: number,
    lane: DrumLane,
    mode?: RigMode
  ): void;
  dispose?(): void;
}

function labelNode<T>(node: T, label: string): T {
  (node as { label?: string }).label = label;
  return node;
}

function buildRig(lane: DrumLane, mode: RigMode, lineNode: IGainNodeLike): DrumRig {
  const named = (voice: string) => `rig:${lane}:${mode}:${voice}`;

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.3 },
  });
  kick.connect(lineNode as any);

  const snareNoise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  });
  snareNoise.connect(lineNode as any);

  const snareMembrane = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 2,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
  });
  snareMembrane.connect(lineNode as any);

  const tomHigh = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.3 },
  });
  tomHigh.connect(lineNode as any);

  const tomMid = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.3 },
  });
  tomMid.connect(lineNode as any);

  const tomFloor = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.45, sustain: 0.01, release: 0.4 },
  });
  tomFloor.connect(lineNode as any);

  const crash = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.2, release: 0.2 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });
  crash.connect(lineNode as any);

  const ride = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.6, release: 0.15 },
    harmonicity: 4.8,
    modulationIndex: 28,
    resonance: 5000,
    octaves: 1.2,
  });
  ride.connect(lineNode as any);

  const hihat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
    harmonicity: 5.2,
    modulationIndex: 36,
    resonance: 6000,
    octaves: 1.5,
  });
  hihat.connect(lineNode as any);

  labelNode(kick, named('kick'));
  labelNode(snareNoise, named('snare'));
  labelNode(snareMembrane, named('snare'));
  labelNode(tomHigh, named('tom_high'));
  labelNode(tomMid, named('tom_mid'));
  labelNode(tomFloor, named('tom_floor'));
  labelNode(crash, named('crash'));
  labelNode(ride, named('ride'));
  labelNode(hihat, named('hihat'));

  return { kick, snareNoise, snareMembrane, tomHigh, tomMid, tomFloor, crash, ride, hihat };
}

/**
 * DrumKitPlayer — the Drum Kit and Sample Manager.
 *
 * Owns a rig per Mixing Channel line (one audible, one Audition) plus the stored custom
 * sample buffers. Scheduled composed events play through the audible line of the channel
 * their source names; a tap on a voice plays through that channel's Audition node, which
 * is never silenced. A silent Mixing Channel, muted or turned all the way down, plays nothing
 * at all: its rig is not even triggered, and no Drum Hit is announced for it.
 */
export class DrumKitPlayer implements IDrumKitPlayer {
  private mixer: IAudioMixer;
  private rigs: Map<RigKey, DrumRig> = new Map();
  private customSampleBuffers: Map<DrumVoice, any> = new Map();
  private hitListeners: Set<(event: ScheduledDrumEvent, time: number) => void> = new Set();

  constructor(mixer: IAudioMixer) {
    this.mixer = mixer;
    // Components read the player right after construction, so the rigs are built eagerly
    // whenever the Mixer Channel graph is ready.
    this.initSynths();
  }

  /**
   * Builds the channel rigs from the Mixing Channel nodes the AudioMixer owns. Idempotent
   * and retry-safe: call again after the audio context is unlocked.
   */
  public initSynths(): boolean {
    if (this.rigs.size > 0) return true;
    if (!this.mixer.isGraphInitialized()) return false;

    try {
      const rigs = new Map<RigKey, DrumRig>();
      for (const lane of ['ostinato', 'orchestration'] as DrumLane[]) {
        for (const mode of ['mix', 'audition'] as RigMode[]) {
          const lineNode =
            mode === 'audition' ? this.mixer.getAuditionNode(lane) : this.mixer.getChannelNode(lane);
          rigs.set(`${lane}:${mode}`, buildRig(lane, mode, lineNode));
        }
      }
      this.rigs = rigs;
      return true;
    } catch {
      // Fail closed: a half built kit is disposed so no sound can reach the destination.
      this.disposeRigs();
      return false;
    }
  }

  public play(event: ScheduledDrumEvent, time: number): void {
    const lane = event.source;
    // A silent Mixing Channel, muted or turned all the way down, produces no sound at all.
    if (!this.mixer.isChannelAudible(lane)) return;

    const velocity = event.velocity ?? 0.8;
    this.executeVoiceSound(event.voice, time, velocity, lane, 'mix');
    this.notifyHit(event, time);
  }

  public triggerVoice(
    voice: DrumVoice,
    time: number = 0,
    velocity: number = 0.8,
    source?: DrumLane
  ): void {
    const isOstinatoVoice = voice === 'ride' || voice === 'ride_bell' || voice.startsWith('hihat');
    const lane: DrumLane = source ?? (isOstinatoVoice ? 'ostinato' : 'orchestration');

    const event: ScheduledDrumEvent = {
      timeInMeasure: 0,
      voice,
      velocity,
      dynamic: 'normal',
      source: lane,
    };

    // A manual tap is an Audition tap: it plays through the Audition node of its channel,
    // which is never silenced.
    this.executeVoiceSound(voice, time, velocity, lane, 'audition');
    this.notifyHit(event, time);
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
    lane: DrumLane,
    mode: RigMode = 'mix'
  ): void {
    try {
      const audioTime = time > 0 ? time : Tone.now();
      const targetNode =
        mode === 'audition' ? this.mixer.getAuditionNode(lane) : this.mixer.getChannelNode(lane);
      const bufferSource = new Tone.ToneBufferSource(buffer);
      const gainNode = new Tone.Gain(velocity);
      labelNode(gainNode, `sample:${lane}:${mode}`);
      bufferSource.connect(gainNode as any);
      gainNode.connect(targetNode as any);
      bufferSource.start(audioTime);
    } catch {
      // Safe isolation
    }
  }

  public dispose(): void {
    this.hitListeners.clear();
    this.customSampleBuffers.clear();
    this.disposeRigs();
  }

  private disposeRigs(): void {
    const synths: Tone.ToneAudioNode[] = [];
    this.rigs.forEach((rig) => {
      synths.push(
        rig.kick,
        rig.snareNoise,
        rig.snareMembrane,
        rig.tomHigh,
        rig.tomMid,
        rig.tomFloor,
        rig.crash,
        rig.ride,
        rig.hihat
      );
    });
    this.rigs.clear();

    synths.forEach((synth) => {
      try {
        synth.dispose();
      } catch {
        // Safe disposal
      }
    });
  }

  private executeVoiceSound(
    voice: DrumVoice,
    time: number,
    velocity: number,
    lane: DrumLane,
    mode: RigMode
  ): void {
    const customBuffer = this.customSampleBuffers.get(voice);
    if (customBuffer) {
      this.playCustomSample(customBuffer, time, velocity, lane, mode);
      return;
    }

    const rig = this.rigs.get(`${lane}:${mode}`);
    if (!rig) return;

    try {
      const audioTime = time > 0 ? time : Tone.now();

      switch (voice) {
        case 'kick':
          rig.kick.triggerAttackRelease('C1', '8n', audioTime, velocity);
          break;

        case 'snare':
          rig.snareMembrane.triggerAttackRelease('D2', '16n', audioTime, velocity * 0.7);
          rig.snareNoise.triggerAttackRelease('16n', audioTime, velocity);
          break;

        case 'snare_ghost':
          rig.snareNoise.triggerAttackRelease('32n', audioTime, velocity * 0.4);
          break;

        case 'tom_high':
          rig.tomHigh.triggerAttackRelease('G2', '8n', audioTime, velocity);
          break;

        case 'tom_mid':
          rig.tomMid.triggerAttackRelease('D2', '8n', audioTime, velocity);
          break;

        case 'tom_floor':
          rig.tomFloor.triggerAttackRelease('A1', '8n', audioTime, velocity);
          break;

        case 'ride':
          rig.ride.triggerAttackRelease('16n', audioTime, velocity);
          break;

        case 'ride_bell':
          rig.ride.triggerAttackRelease('32n', audioTime, velocity * 1.1);
          break;

        case 'hihat_closed':
        case 'hihat_foot':
          rig.hihat.triggerAttackRelease('32n', audioTime, velocity);
          break;

        case 'hihat_open':
          rig.hihat.triggerAttackRelease('8n', audioTime, velocity);
          break;

        case 'crash':
          rig.crash.triggerAttackRelease('4n', audioTime, velocity);
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
