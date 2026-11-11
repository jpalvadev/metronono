import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import {
  AudioMixerState,
  ChannelState,
  MixerChannelId,
} from '../audio/AudioMixer';
import {
  ComposedChannels,
  PRACTICE_PRESETS,
  PracticePreset,
  applyPracticePreset,
  composedChannels,
  derivePracticePreset,
} from '../audio/PracticePresets';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Sliders, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';

export interface MixerPanelProps {
  scheduler: ToneTransportScheduler;
  className?: string;
}

const CHANNEL_ROWS: {
  channel: MixerChannelId;
  title: string;
  muteName: string;
  detail: string;
  ariaLabel: string;
}[] = [
  {
    channel: 'click',
    title: 'Metronome Click',
    muteName: 'Click',
    detail: '(Downbeat / Regular / Subdivision)',
    ariaLabel: 'Click Volume',
  },
  {
    channel: 'ostinato',
    title: 'Ostinato',
    muteName: 'Ostinato',
    detail: '(Ride / Hi-Hat)',
    ariaLabel: 'Ostinato Volume',
  },
  {
    channel: 'orchestration',
    title: 'Orchestrated Line',
    muteName: 'Orchestrated Line',
    detail: '(Snare / Kick)',
    ariaLabel: 'Orchestrated Line Volume',
  },
];

const PRESET_LABELS: Record<Exclude<PracticePreset, 'custom'>, string> = {
  'click-only': 'Click Only',
  'drums-only': 'Drums Only',
  'full-mix': 'Full Mix',
};

function levelReadout(channel: ChannelState): string {
  if (channel.muted) return 'MUTED';
  if (channel.volume <= 0) return 'SILENT';
  return `${Math.round(channel.volume * 100)}%`;
}

/**
 * MixerPanel — the app's only loudness control: one row per Mixing Channel plus the Master
 * they all feed, and a Practice Preset row whose lit preset is derived from the live mixer
 * state. Every value it shows and writes is the same one the audio graph plays at.
 */
export const MixerPanel: React.FC<MixerPanelProps> = ({ scheduler, className }) => {
  const mixer = useMemo(() => scheduler.getAudioMixer(), [scheduler]);
  const engine = useMemo(() => scheduler.getDawsonEngine(), [scheduler]);

  const [mixerState, setMixerState] = useState<AudioMixerState>(() => mixer.getState());
  const [composed, setComposed] = useState<ComposedChannels>(() => composedChannels(engine));

  useEffect(() => mixer.onStateChange((state) => setMixerState(state)), [mixer]);

  useEffect(
    () => engine.onChange(() => setComposed(composedChannels(engine))),
    [engine]
  );

  const preset = derivePracticePreset(mixerState, composed);

  const handleVolumeChange = useCallback(
    (channel: MixerChannelId, volume: number) => {
      mixer.setChannelVolume(channel, volume);
    },
    [mixer]
  );

  const handleMasterVolumeChange = useCallback(
    (volume: number) => {
      mixer.setMasterVolume(volume);
    },
    [mixer]
  );

  const handleMuteToggle = useCallback(
    (channel: MixerChannelId) => {
      mixer.toggleChannelMute(channel);
    },
    [mixer]
  );

  const handlePresetPress = useCallback(
    (practicePreset: PracticePreset) => {
      applyPracticePreset(mixer, practicePreset, composed);
    },
    [mixer, composed]
  );

  return (
    <div
      className={cn(
        'w-full flex flex-col gap-4 bg-card/60 backdrop-blur border border-border/70 rounded-2xl p-4 md:p-6 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Mixer Panel
            </h3>
            <p className="text-xs text-muted-foreground">
              Master and the three Mixing Channels
            </p>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">
          The app&apos;s only loudness controls
        </span>
      </div>

      {/* Practice Preset row: mute flags only, never a volume value */}
      <div
        data-testid="mixer-preset-row"
        className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1.5 rounded-xl border border-border/60"
      >
        <span className="text-[11px] font-medium text-muted-foreground px-2">
          Practice Preset:
        </span>
        {PRACTICE_PRESETS.map((practicePreset) => (
          <Button
            key={practicePreset}
            type="button"
            variant={preset === practicePreset ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={preset === practicePreset}
            onClick={() => handlePresetPress(practicePreset)}
            className={cn(
              'h-7 px-2.5 text-xs',
              preset === practicePreset && 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {PRESET_LABELS[practicePreset]}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          aria-pressed={preset === 'custom'}
          className={cn(
            'h-7 px-2.5 text-xs',
            preset === 'custom' && 'bg-amber-500/20 text-amber-300'
          )}
        >
          Custom
        </Button>
      </div>

      {/* Master: volume only, no Master mute */}
      <div
        data-testid="mixer-row-master"
        data-composed="true"
        className="flex items-center gap-3 bg-muted/20 p-2.5 rounded-xl border border-border/60"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Master
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {levelReadout({ volume: mixerState.master.volume, muted: false })}
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={mixerState.master.volume}
            onChange={handleMasterVolumeChange}
            ariaLabel="Master Volume"
          />
        </div>
      </div>

      {/* One row per Mixing Channel */}
      <div className="flex flex-col gap-3">
        {CHANNEL_ROWS.map(({ channel, title, muteName, detail, ariaLabel }) => {
          const isComposed = composed[channel];
          const state = mixerState[channel];

          if (!isComposed) {
            return (
              <div
                key={channel}
                data-testid={`mixer-row-${channel}`}
                data-composed="false"
                className="flex items-center justify-between gap-3 bg-card/40 p-2.5 rounded-lg border border-border/40"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {title} <span className="text-[10px] font-normal">{detail}</span>
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  No {title} composed
                </span>
              </div>
            );
          }

          return (
            <div
              key={channel}
              data-testid={`mixer-row-${channel}`}
              data-composed="true"
              className="flex items-center gap-3 bg-card/60 p-2.5 rounded-lg border border-border/60"
            >
              <Button
                type="button"
                variant={state.muted ? 'destructive' : 'ghost'}
                size="sm"
                aria-label={
                  state.muted ? `Unmute ${muteName}` : `Mute ${muteName}`
                }
                onClick={() => handleMuteToggle(channel)}
                className={cn(
                  'w-9 h-9 p-0 rounded-lg shrink-0',
                  !state.muted && 'text-muted-foreground hover:text-foreground'
                )}
              >
                {state.muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-foreground">
                    {title}{' '}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {detail}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {levelReadout(state)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.volume}
                  onChange={(volume) => handleVolumeChange(channel, volume)}
                  ariaLabel={ariaLabel}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
