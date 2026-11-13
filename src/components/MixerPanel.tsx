import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import {
  AudioMixerState,
  ChannelState,
  MixerChannelId,
  ComposedChannels,
  composedChannels,
} from '../audio/AudioMixer';
import { MetronomeClickConfig } from '../domain/metronome/MetronomeEngine';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Sliders, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';

export interface MixerPanelProps {
  scheduler: ToneTransportScheduler;
  className?: string;
}

type ClickVoiceKey = 'downbeat' | 'regular' | 'subdivision';

const CLICK_VOICE_ROWS: {
  voice: ClickVoiceKey;
  title: string;
  muteName: string;
  detail: string;
  ariaLabel: string;
}[] = [
  {
    voice: 'downbeat',
    title: 'Downbeat',
    muteName: 'Downbeat',
    detail: '(Beat 1)',
    ariaLabel: 'Downbeat Volume',
  },
  {
    voice: 'regular',
    title: 'Regular',
    muteName: 'Regular',
    detail: '(Beats 2, 3, 4...)',
    ariaLabel: 'Regular Volume',
  },
  {
    voice: 'subdivision',
    title: 'Subdivision',
    muteName: 'Subdivision',
    detail: '(Gap Clicks)',
    ariaLabel: 'Subdivision Volume',
  },
];

const CHANNEL_ROWS: {
  channel: MixerChannelId;
  title: string;
  muteName: string;
  detail: string;
  ariaLabel: string;
}[] = [
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

function levelReadout(state: { muted: boolean; volume: number }): string {
  if (state.muted) return 'MUTED';
  if (state.volume <= 0) return 'SILENT';
  return `${Math.round(state.volume * 100)}%`;
}

interface MixerRowProps {
  testId: string;
  title: string;
  muteName: string;
  detail: string;
  ariaLabel: string;
  state: ChannelState;
  onMuteToggle: () => void;
  onVolumeChange: (volume: number) => void;
  children?: React.ReactNode;
}

const MixerRow: React.FC<MixerRowProps> = ({
  testId,
  title,
  muteName,
  detail,
  ariaLabel,
  state,
  onMuteToggle,
  onVolumeChange,
  children,
}) => (
  <div
    data-testid={testId}
    data-composed="true"
    className="flex items-center gap-3 bg-secondary/20 p-2.5 rounded-none border border-border"
  >
    <Button
      type="button"
      variant={state.muted ? 'destructive' : 'ghost'}
      size="sm"
      aria-label={state.muted ? `Unmute ${muteName}` : `Mute ${muteName}`}
      onClick={onMuteToggle}
      className={cn(
        'w-8 h-8 p-0 rounded-none shrink-0',
        !state.muted && 'text-muted-foreground hover:text-foreground'
      )}
    >
      {state.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
        onChange={onVolumeChange}
        ariaLabel={ariaLabel}
      />
      {children}
    </div>
  </div>
);

/**
 * MixerPanel — loudness control: per-voice click rows (Downbeat, Regular, Subdivision)
 * and one row per drum Mixing Channel (Ostinato, Orchestrated Line).
 */
export const MixerPanel: React.FC<MixerPanelProps> = ({ scheduler, className }) => {
  const mixer = useMemo(() => scheduler.getAudioMixer(), [scheduler]);
  const engine = useMemo(() => scheduler.getDawsonEngine(), [scheduler]);

  const [mixerState, setMixerState] = useState<AudioMixerState>(() => mixer.getState());
  const [composed, setComposed] = useState<ComposedChannels>(() => composedChannels(engine));
  const [clickConfig, setClickConfig] = useState<MetronomeClickConfig>(() =>
    scheduler.getClickConfig()
  );

  useEffect(() => mixer.onStateChange((state) => setMixerState(state)), [mixer]);

  useEffect(
    () => engine.onChange(() => setComposed(composedChannels(engine))),
    [engine]
  );

  useEffect(
    () => scheduler.onClickConfigChange((config) => setClickConfig(config)),
    [scheduler]
  );

  const handleVolumeChange = useCallback(
    (channel: MixerChannelId, volume: number) => {
      mixer.setChannelVolume(channel, volume);
    },
    [mixer]
  );

  const handleMuteToggle = useCallback(
    (channel: MixerChannelId) => {
      mixer.toggleChannelMute(channel);
    },
    [mixer]
  );

  const handleClickVoiceVolumeChange = useCallback(
    (voice: ClickVoiceKey, volume: number) => {
      scheduler.updateVoiceConfig(voice, { volume });
    },
    [scheduler]
  );

  const handleClickVoiceMuteToggle = useCallback(
    (voice: ClickVoiceKey) => {
      const current = scheduler.getClickConfig()[voice];
      scheduler.updateVoiceConfig(voice, { muted: !current.muted });
    },
    [scheduler]
  );

  const handleSubdivisionDivisionsChange = useCallback(
    (divisions: number) => {
      scheduler.updateVoiceConfig('subdivision', { divisions });
    },
    [scheduler]
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
              Channel loudness controls
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          Loudness
        </span>
      </div>

      {/* Per-voice click rows + Ostinato and Orchestrated Line rows */}
      <div className="flex flex-col gap-2.5">
        {CLICK_VOICE_ROWS.map(({ voice, title, muteName, detail, ariaLabel }) => {
          const voiceState = clickConfig[voice];
          return (
            <MixerRow
              key={voice}
              testId={`mixer-row-${voice}`}
              title={title}
              muteName={muteName}
              detail={detail}
              ariaLabel={ariaLabel}
              state={{ volume: voiceState.volume, muted: voiceState.muted }}
              onMuteToggle={() => handleClickVoiceMuteToggle(voice)}
              onVolumeChange={(volume) => handleClickVoiceVolumeChange(voice, volume)}
            >
              {voice === 'subdivision' && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Divisions{' '}
                      <span className="text-[10px] font-normal">
                        ({clickConfig.subdivision.divisions === 1 ? 'No gap clicks' : `${clickConfig.subdivision.divisions} per beat`})
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-foreground">
                      {clickConfig.subdivision.divisions}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={8}
                    step={1}
                    value={clickConfig.subdivision.divisions}
                    onChange={handleSubdivisionDivisionsChange}
                    ariaLabel="Subdivision Divisions"
                  />
                </div>
              )}
            </MixerRow>
          );
        })}

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
            <MixerRow
              key={channel}
              testId={`mixer-row-${channel}`}
              title={title}
              muteName={muteName}
              detail={detail}
              ariaLabel={ariaLabel}
              state={state}
              onMuteToggle={() => handleMuteToggle(channel)}
              onVolumeChange={(volume) => handleVolumeChange(channel, volume)}
            />
          );
        })}
      </div>
    </div>
  );
};
