# Default WAV Samples (`public/samples/`)

Place one `.wav` file per voice in this directory (`public/samples/<voiceId>.wav`).
Only `.wav` files are used (no `.mp3`, to avoid encoder-padding timing offset on drum/click transients).
Any voice without a `.wav` file here (or a custom override in Sample Bank) will remain silent.

## Drum Kit Voices (12)

| File | Voice ID | Sound / Description |
| --- | --- | --- |
| `kick.wav` | `kick` | Bass drum |
| `snare.wav` | `snare` | Primary snare drum |
| `snare_ghost.wav` | `snare_ghost` | Soft ghost snare stroke |
| `tom_high.wav` | `tom_high` | High rack tom |
| `tom_mid.wav` | `tom_mid` | Mid rack tom |
| `tom_floor.wav` | `tom_floor` | Low floor tom |
| `hihat_closed.wav` | `hihat_closed` | Closed hi-hat (stick) |
| `hihat_open.wav` | `hihat_open` | Open hi-hat (stick) |
| `hihat_foot.wav` | `hihat_foot` | Foot hi-hat (chick) |
| `ride.wav` | `ride` | Ride cymbal (bow ping) |
| `ride_bell.wav` | `ride_bell` | Ride cymbal (bell accent) |
| `crash.wav` | `crash` | Crash cymbal |

## Metronome Click Voices (3)

| File | Voice ID | Sound / Description |
| --- | --- | --- |
| `click_downbeat.wav` | `click_downbeat` | Beat 1 accent click |
| `click_regular.wav` | `click_regular` | Regular beat pulse click |
| `click_subdivision.wav` | `click_subdivision` | Subdivision / gap-click pulse |
