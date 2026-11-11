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
        'w-full h-full flex flex-col justify-between gap-4 bg-card border border-border rounded-none p-5 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Mixer Panel
            </h2>
            <p className="text-xs text-muted-foreground">
              Master & channel loudness controls
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          Loudness
        </span>
      </div>

      {/* Practice Preset row: mute flags only, never a volume value */}
      <div
        data-testid="mixer-preset-row"
        className="flex flex-wrap items-center gap-1 bg-secondary/40 p-1 rounded-none border border-border"
      >
        <span className="text-[11px] font-medium text-muted-foreground px-1.5 uppercase font-mono">
          Preset:
        </span>
        {PRACTICE_PRESETS.map((practicePreset) => (
          <Button
            key={practicePreset}
            type="button"
            variant={preset === practicePreset ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={preset === practicePreset}
            onClick={() => handlePresetPress(practicePreset)}
            className="h-6 px-2 text-[11px] rounded-none"
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
            'h-6 px-2 text-[11px] rounded-none',
            preset === 'custom' && 'bg-secondary text-secondary-foreground'
          )}
        >
          Custom
        </Button>
      </div>

      {/* Master: volume only, no Master mute */}
      <div
        data-testid="mixer-row-master"
        data-composed="true"
        className="flex items-center gap-3 bg-secondary/30 p-2.5 rounded-none border border-border"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
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
      <div className="flex flex-col gap-2.5">
        {CHANNEL_ROWS.map(({ channel, title, muteName, detail, ariaLabel }) => {
          const isComposed = composed[channel];
          const state = mixerState[channel];

          if (!isComposed) {
            return (
              <div
                key={channel}
                data-testid={`mixer-row-${channel}`}
                data-composed="false"
                className="flex items-center justify-between gap-3 bg-secondary/10 p-2 rounded-none border border-border/40"
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
              className="flex items-center gap-3 bg-secondary/20 p-2.5 rounded-none border border-border"
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
                  'w-8 h-8 p-0 rounded-none shrink-0',
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
                <div className="flex items-center justify-between mb-1">
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
