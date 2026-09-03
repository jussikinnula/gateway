# Audio analysis — Spot, *Gateway (Mix 2026)*

## Result and source clocks

The musical analysis was measured from `Spot - Gateway (2026 Mix).wav` and the
sample-aligned vocal stem `Spot - Gateway (2026 Mix) - Only vocals.wav`, both
44.1 kHz, stereo, 16-bit PCM and exactly 293.333333 s long. The runtime still
plays `Spot - Gateway (Mix 2026).mp3`.

Cross-correlation at 0:04, 2:00 and 4:00 gives the same offset at all three
positions: the MP3 is **51.156 ms later** than the WAV. There is no source-clock
drift. Every bar and lyric time in the authored JSON files is therefore in the
runtime MP3 clock; WAV measurements are shifted by +51.156 ms before writing.

## Grid

| Measurement | Result |
|---|---:|
| Tempo | **144.001942 BPM** |
| Beat | 0.416661 s |
| 4/4 bar | 1.666644 s |
| Bar 1 downbeat, MP3 clock | **0.752500 s** |
| Same downbeat, WAV clock | 0.701344 s |
| Pickup before bar 1 | 1.6832 beats |
| Complete bars | 175 |
| Last complete bar | bar 175, 4:50.75-4:52.41 |
| MP3 duration | 293.407325 s |

Tempo was scored from 70-200 BPM in 0.005 BPM increments using a zoom-DFT of
the onset-strength envelope at the candidate frequency and its second and
fourth harmonics. The full-track maximum is 144.000 on that grid. Independent
thirds give 144.015, 144.000 and 144.005 BPM; the spread is the short-window
spectral uncertainty, not a step change in tempo. A linear phase fit to 120
strong broadband transients gives 144.001942 BPM and a first-to-last phase
change of -3.05 ms. A constant-tempo model is therefore appropriate.

The sixteenth phase was measured with 2.9 ms onset frames and a 64-sample
backtracked verification pass. The strong-transient residual is 0.78 ms median
and 1.88 ms at the 90th percentile. Of 2,018 detected, backtracked onsets,
**96.68% are within 20 ms** of a sixteenth; median residual is 3.74 ms and the
90th percentile is 9.97 ms.

The downbeat was resolved independently of the pre-analysis by comparing all
16 possible sixteenth phases against mel and MFCC/chroma novelty boundaries.
The winning phase is the one that places the hard kick/bass entries at bars 30,
70, 120, 128 and 150. Converting that WAV phase into the MP3 clock reproduces
the provisional 0.7525 s origin. A click/section-mark track has been rendered
to `work/grid-check.wav`; subjective listening remains listed under uncertainty.

## Structure

Every section boundary is a whole bar. Times are in the MP3/runtime clock and
`end` is exclusive in `structure.json`.

| Section | Bars | Time | Evidence |
|---|---:|---:|---|
| Intro | 1-29 | 0:00.8-0:49.1 | Kick lifts at bar 10; vocals enter in bar 13; full kick and bass enter at 30. |
| Groove / Drop A | 30-53 | 0:49.1-1:29.1 | Kick rises 0.16→0.75 at 30; first full vocoder hook is around bars 38-45. |
| Build | 54-69 | 1:29.1-1:55.8 | Kick falls 0.68→0.23 and RMS 0.79→0.38 at 54, then rebuilds. |
| Groove / Hook B | 70-95 | 1:55.8-2:39.1 | Full kick returns at 70; two-bar cut at 78-79; one-bar cut at 95. |
| Groove C | 96-112 | 2:39.1-3:07.4 | Partial drums at 96, full drive at 104, collapse through 112-113. |
| Breakdown | 113-119 | 3:07.4-3:19.1 | Kick falls to 0.15; seven-bar truncated phrase leads directly to bar 120. |
| Rebuild | 120-127 | 3:19.1-3:32.4 | Kick 0.23→0.90 and RMS 0.46→0.92; exact eight-bar phrase. |
| Climax | 128-149 | 3:32.4-4:09.1 | Highest RMS/kick; cuts at 137 and 140; spoken reprise at 141-143; hook from 144. |
| DJ Outro | 150-175 | 4:09.1-4:52.4 | Kick returns 0.02→0.80; vocals end in bar 158; layers thin at 173-175. |

Phrase arithmetic is deliberately not forced into an all-8-bar description.
The opening section is 29 bars because the file contains a 1.68-beat pickup and
a progressive intro. Bars 78-79 are an inserted two-bar break. Bar 95 is a
one-bar cut before the partial return at 96. The seven-bar breakdown 113-119 is
a truncated phrase. The 22-bar climax contains the measured cuts at 137 and 140
before the 150 return. These explain the non-multiples instead of treating them
as grid errors.

## Lyrics and vocal events

The supplied vocal-only export replaces source separation and is better than an
estimated stem. `faster-whisper` large-v3-turbo was run blind first, then with a
lyric-only vocabulary bias. The original full-stem blind pass is retained in
`work/asr-blind.json`; its long vocoder tail causes a documented repetition
hallucination. Both passes were then repeated on independent energy-VAD windows
of at most 6.5 seconds. WebRTC VAD provides a second activity detector.

Cue starts and ends were refined against 200-4,000 Hz stem energy at 5 ms
resolution and then converted to the MP3 clock. Confidence is lexical and
boundary confidence together.

| Start | End | Bar | Text | Kind | Confidence |
|---:|---:|---:|---|---|---|
| 20.10 | 20.48 | 12.61 | Hey! | shout | high |
| 23.20 | 24.46 | 14.47 | Move! | shout | high |
| 27.08 | 28.42 | 16.80 | Open your eyes. | spoken | high |
| 30.58 | 32.14 | 18.90 | The gateway is open. | spoken | high |
| 41.50 | 42.96 | 25.45 | Higher! | shout | medium |
| 48.03 | 48.94 | 29.37 | Go! | shout | medium |
| 62.04 | 62.79 | 37.77 | Gateway | hook | high |
| 63.45 | 65.90 | 38.62 | Open wide | hook | medium |
| 66.01 | 68.56 | 40.16 | Take me through | hook | medium |
| 68.54 | 69.24 | 41.67 | Gateway | hook | medium |
| 69.53 | 72.81 | 42.27 | Into the light | hook | medium |
| 75.24 | 75.58 | 45.69 | Hey! | shout | medium |
| 81.04 | 81.94 | 49.17 | Come on! | shout | high |
| 82.20 | 84.32 | 49.87 | Move! | shout | medium |
| 114.71 | 115.49 | 69.38 | Keep moving. | spoken | high |
| 120.32 | 121.77 | 72.74 | Don’t look back. | spoken | high |
| 128.48 | 129.40 | 77.64 | Gateway | hook | medium |
| 129.34 | 130.19 | 78.15 | Gateway | hook | medium |
| 145.38 | 146.11 | 87.78 | Gateway | hook | **low** |
| 147.70 | 149.44 | 89.17 | Open wide | hook | high |
| 150.90 | 152.23 | 91.09 | Take me through | hook | high |
| 154.39 | 156.12 | 93.18 | Into the light | hook | high |
| 158.42 | 159.16 | 95.60 | Everybody! | shout | high |
| 170.75 | 172.12 | 103.00 | Go! | shout | medium |
| 178.88 | 184.54 | 107.88 | Woo! | ad-lib | high |
| 190.78 | 204.33 | 115.02 | Go! (repeated loop) | ad-lib | medium |
| 218.87 | 220.56 | 131.87 | Hey! | ad-lib | **low** |
| 233.91 | 234.64 | 140.90 | Keep moving. | spoken | high |
| 237.14 | 238.38 | 142.83 | Don’t look back. | spoken | high |
| 239.20 | 249.44 | 144.07 | Gateway | hook | medium |
| 251.39 | 254.65 | 151.38 | Open wide | hook | medium |
| 254.46 | 255.55 | 153.23 | Take me through | hook | high |
| 255.66 | 256.75 | 153.95 | Gateway | hook | **low** |
| 256.78 | 261.07 | 154.62 | Into the light | hook | medium |
| 261.39 | 261.68 | 157.38 | Go! | shout | medium |

Nine short VAD windows at 52.79-54.73, 77.94-78.08, 173.69-174.31 and
184.66-184.93 are explicitly classified in `lyrics.json` as vocoder/reverb
tails with no distinct word. Every other energy-VAD window overlaps a cue.

### Disagreements with the Suno sheet

Agreed lines: every lexical line in the sheet is detected at least once. The
bracketed production instructions are excluded from the lyric comparison.

Lines in the sheet but not in the audio: **none**. This is explicitly empty;
both ASR passes or the biased pass plus the independent vocal activity confirm
each lexical item at least once.

Vocal events in the audio but not represented in the sheet:

- `Woo!` at 178.88-184.54.
- A long rhythmic `Go!` loop at 190.78-204.33.
- An ambiguous `Hey!`/`Go!` ad-lib at 218.87-220.56.
- Repeated `Keep moving.` and `Don’t look back.` at 233.91-238.38.
- A third extended `Gateway / Open wide / Take me through / Gateway / Into the light` hook at 239.20-261.07.
- A final short `Go!` at 261.39.

The sheet also says the intro has no vocals, while the stem contains clear
lexical vocals from 20.10 s (bar 12.61). Its section tags therefore cannot be
used as structure boundaries.

## Energy data

`analysis.json` contains 175 bar rows and 700 beat rows. `rms`, `sub`, `kick`,
`bass`, `mid`, `vox`, `air`, onset density, spectral centroid and stereo width
are normalized independently to their 99th percentiles and rounded to three
decimals. `vox` is measured only from the supplied vocal stem. The file also
contains 3,000 runtime-MP3 waveform peaks for the scrub view.

## Comparison with `analysis.pre.json`

- BPM changes from 144.000 to the transient-fit value 144.001942. The difference
  is about 4 ms over the useful bar grid and confirms, rather than invalidates,
  the pre-analysis drift note.
- MP3 `grid_origin` remains 0.7525 s. Independent structure novelty supports it.
  The new analysis additionally proves that this is 0.701344 s in the WAV clock
  because the MP3 decoder delay is 51.156 ms.
- The nine main structural boundaries are retained, but the labels and evidence
  are rewritten around the actual vocal order. The one-bar cut at 95 and the
  staggered cuts at 137 and 140 resolve the pre-analysis loose end.
- `analysis.json` now has a vocal-stem `vox` feature and the previously missing
  700-beat table. `lyrics.json` now has 35 cues and explicit VAD accounting.

## Uncertainty and required subjective checks

The machine-verifiable analysis is complete, but three lyric decisions should
not be treated as final picture-lock facts until a human listens to the supplied
check video:

1. `Gateway` at 145.38-146.11: the biased pass and hook order support it, while
   the blind pass is ambiguous.
2. The 218.87-220.56 ad-lib: blind ASR says `Hey`, biased ASR says `Go`.
3. `Gateway` at 255.66-256.75: the hook order is strong evidence, but vocoder
   overlap obscures the independent word boundary.

There are also two subjective acceptance checks an automated agent cannot
truthfully claim to have heard or watched end to end:

- Listen to `work/grid-check-start.wav`, `work/grid-check-middle.wav` and
  `work/grid-check-end.wav` (or the full `work/grid-check.wav`) and confirm the
  click stays locked and the low triple section marks land on musical changes.
- Watch `work/lyrics-check.mp4` once through. It uses the exact `t..e` cue spans,
  not the longer readability spans in the generated `lyrics.srt`.

If either subjective check moves a cue or the downbeat, regenerate the outputs
from the JSON/script source rather than editing `lyrics.srt` by hand.

## Verification status

- [x] Timeline builder exits 0: 175 bars, 9 sections, 35 cues.
- [x] `lyrics.srt` regenerated from `lyrics.json`; no hand edits afterwards.
- [x] 96.68% of detected onsets are within 20 ms of the sixteenth grid.
- [x] Tempo drift measured and reported.
- [ ] Click track auditioned by a human at the start, middle and end.
- [x] All section boundaries are whole bars; non-8-bar gaps are explained.
- [x] Every energy-VAD window is a cue or an explicit non-word.
- [ ] Caption burn-in watched end to end by a human.
- [x] Sheet disagreement lists exist; the empty `notInAudio` list is justified.
- [x] Explicit uncertainty section exists.
