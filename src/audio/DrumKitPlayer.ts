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

// The Audio Voice Pool (docs/adr/0011): every voice slot holds a small ring of
// interchangeable synth instances cycled per stroke, so a rapid stroke never
// cancels the live attack of the previous one on the same monophonic voice.
interface DrumRig {
  kick: Tone.MembraneSynth[];
  snareNoise: Tone.NoiseSynth[];
  snareMembrane: Tone.MembraneSynth[];
  tomHigh: Tone.MembraneSynth[];
  tomMid: Tone.MembraneSynth[];
  tomFloor: Tone.MembraneSynth[];
  crash: Tone.MetalSynth[];
  ride: Tone.MetalSynth[];
  hihat: Tone.MetalSynth[];
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

  const buildMembers = <T extends Tone.ToneAudioNode>(
    create: () => T,
    count: number,
    label: string
  ): T[] => {
    const members: T[] = [];
    for (let index = 0; index < count; index++) {
      const member = create();
      labelNode(member, label);
      member.connect(lineNode as any);
      members.push(member);
    }
    return members;
  };

  const kick = buildMembers(
    () => new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.3 },
    }),
    2,
    named('kick')
  );

  const snareNoise = buildMembers(
    () => new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    }),
    2,
    named('snare')
  );

  const snareMembrane = buildMembers(
    () => new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 2,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    }),
    2,
    named('snare')
  );

  const tomHigh = buildMembers(
    () => new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.3 },
    }),
    2,
    named('tom_high')
  );

  const tomMid = buildMembers(
    () => new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.3 },
    }),
    2,
    named('tom_mid')
  );

  const tomFloor = buildMembers(
    () => new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.45, sustain: 0.01, release: 0.4 },
    }),
    2,
    named('tom_floor')
  );

  const crash = buildMembers(
    () => new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.2, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }),
    3,
    named('crash')
  );

  const ride = buildMembers(
    () => new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.6, release: 0.15 },
      harmonicity: 4.8,
      modulationIndex: 28,
      resonance: 5000,
      octaves: 1.2,
    }),
    3,
    named('ride')
  );

  const hihat = buildMembers(
    () => new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
      harmonicity: 5.2,
      modulationIndex: 36,
      resonance: 6000,
      octaves: 1.5,
    }),
    3,
    named('hihat')
  );

  return { kick, snareNoise, snareMembrane, tomHigh, tomMid, tomFloor, crash, ride, hihat };
}

/**
 * DrumKitPlayer — the Drum Kit and Sample Manager.
 *
 * Owns a rig per Mixing Channel line (one audible, one Audition) plus the stored custom
 * sample buffers. Scheduled composed events play through the audible line of the channel
 * their source names; a tap on a voice plays through that channel's Audition node, which
 * is never silenced. A silent Mixing Channel, muted or turned all the way down, plays nothing
 * at all: its rig is not even triggered.
 */
export class DrumKitPlayer implements IDrumKitPlayer {
  private mixer: IAudioMixer;
  private rigs: Map<RigKey, DrumRig> = new Map();
  private customSampleBuffers: Map<DrumVoice, any> = new Map();
  // Which ring member each voice slot uses next, per rig (docs/adr/0011 voice pool).
  private rigCursors: Map<RigKey, Record<string, number>> = new Map();

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
  }

  public triggerVoice(
    voice: DrumVoice,
    time: number = 0,
    velocity: number = 0.8,
    source?: DrumLane
  ): void {
    const isOstinatoVoice = voice === 'ride' || voice === 'ride_bell' || voice.startsWith('hihat');
    const lane: DrumLane = source ?? (isOstinatoVoice ? 'ostinato' : 'orchestration');

    // A manual tap is an Audition tap: it plays through the Audition node of its channel,
    // which is never silenced.
    this.executeVoiceSound(voice, time, velocity, lane, 'audition');
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
    this.customSampleBuffers.clear();
    this.disposeRigs();
  }

  /**
   * Cycles the voice slot's ring: consecutive strokes on one voice use distinct
   * synth instances, so a rapid stroke never cancels the previous live attack.
   */
  private nextMember(rigKey: RigKey, slot: string, ring: any[]): any {
    const cursors = this.rigCursors.get(rigKey) ?? {};
    const index = cursors[slot] ?? 0;
    cursors[slot] = index + 1;
    this.rigCursors.set(rigKey, cursors);
    return ring[index % ring.length];
  }

  private disposeRigs(): void {
    const synths: Tone.ToneAudioNode[] = [];
    this.rigs.forEach((rig) => {
      for (const ring of Object.values(rig)) {
        synths.push(...(ring as Tone.ToneAudioNode[]));
      }
    });
    this.rigs.clear();
    this.rigCursors.clear();

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

    const rigKey = `${lane}:${mode}` as RigKey;
    const rig = this.rigs.get(rigKey);
    if (!rig) return;

    try {
      const audioTime = time > 0 ? time : Tone.now();

      switch (voice) {
        case 'kick':
          this.nextMember(rigKey, 'kick', rig.kick)
            .triggerAttackRelease('C1', '8n', audioTime, velocity);
          break;

        case 'snare':
          this.nextMember(rigKey, 'snareMembrane', rig.snareMembrane)
            .triggerAttackRelease('D2', '16n', audioTime, velocity * 0.7);
          this.nextMember(rigKey, 'snareNoise', rig.snareNoise)
            .triggerAttackRelease('16n', audioTime, velocity);
          break;

        case 'snare_ghost':
          this.nextMember(rigKey, 'snareNoise', rig.snareNoise)
            .triggerAttackRelease('32n', audioTime, velocity * 0.4);
          break;

        case 'tom_high':
          this.nextMember(rigKey, 'tomHigh', rig.tomHigh)
            .triggerAttackRelease('G2', '8n', audioTime, velocity);
          break;

        case 'tom_mid':
          this.nextMember(rigKey, 'tomMid', rig.tomMid)
            .triggerAttackRelease('D2', '8n', audioTime, velocity);
          break;

        case 'tom_floor':
          this.nextMember(rigKey, 'tomFloor', rig.tomFloor)
            .triggerAttackRelease('A1', '8n', audioTime, velocity);
          break;

        case 'ride':
          this.nextMember(rigKey, 'ride', rig.ride)
            .triggerAttackRelease('16n', audioTime, velocity);
          break;

        case 'ride_bell':
          this.nextMember(rigKey, 'ride', rig.ride)
            .triggerAttackRelease('32n', audioTime, velocity * 1.1);
          break;

        case 'hihat_closed':
        case 'hihat_foot':
          this.nextMember(rigKey, 'hihat', rig.hihat)
            .triggerAttackRelease('32n', audioTime, velocity);
          break;

        case 'hihat_open':
          this.nextMember(rigKey, 'hihat', rig.hihat)
            .triggerAttackRelease('8n', audioTime, velocity);
          break;

        case 'crash':
          this.nextMember(rigKey, 'crash', rig.crash)
            .triggerAttackRelease('4n', audioTime, velocity);
          break;

        default:
          break;
      }
    } catch {
      // Graceful error isolation for headless audio
    }
  }
}
