# Lyric cue realignment — second pass

`ANALYSIS.md` describes the first analysis pass. This document describes what was
re-measured afterwards and why. **The grid, the structure and the energy data are
untouched** — they were checked and they hold. Only `lyrics.json`, and therefore
`lyrics.srt` and `timeline.json`, changed.

## What was wrong

The first pass produced 35 cues. Measuring each cue's start against the supplied
vocal stem — 180–6000 Hz magnitude at 2.49 ms resolution, converted into the stem
clock with the same 2256-sample MP3 delay the first pass measured — showed that

> **16 of the 35 cues began in complete silence, 150–440 ms before any vocal
> energy existed.**

Not "slightly early": the stem's energy at those cue starts was 0.000. The worst:

| cue | first pass | error |
|---|---:|---:|
| Open wide | 147.70 | 440 ms early |
| Don't look back. | 120.32 | 387 ms |
| Keep moving. | 114.71 | 380 ms |
| Gateway (first hook) | 62.04 | 364 ms |
| Open your eyes. | 27.08 | 354 ms |
| The gateway is open. | 30.58 | 341 ms |

The cause is visible in `work/asr-primed-chunks.json`: several cues are the raw
energy-VAD chunk start, verbatim. "The gateway is open." was written as 30.58,
which is exactly the chunk boundary — neither the +51.156 ms clock conversion nor
the promised 5 ms energy refinement had touched it. The refinement window was too
narrow to pull back a Whisper segment start that was already a third of a second
out, and it failed silently rather than reporting that it had failed.

Two further defects: one cue carried a 13.6 s span (`Go!`, 190.78–204.33) over
what the first pass itself called a repeated loop, and three cue pairs overlapped.

## What was done

Text, running order and `kind` are **unchanged**. Deciding words needs ears and a
better transcription than either pass has; that is not what this was.

Every start and end was re-derived from the stem:

- **Voiced regions** by hysteresis on the smoothed envelope (enter 0.055, leave
  0.015, 160 ms of silence to close) — 26 regions across the track.
- **Attacks** by spectral flux, 713 candidates. An attack counts when it rises to
  at least 2.5x the preceding 120 ms and carries at least 25 % of the energy of
  the following two seconds.
- **A cue is moved only when it demonstrably starts before its word**: its own
  start carries under 30 % of the coming phrase's peak, *and* a qualifying attack
  sits within +1.5 s that is at least three times louder. **Cues are never moved
  earlier** — the documented failure is a start that fires ahead of the vocal, so
  a backwards nudge is far more likely to be wrong than right.
- Inside a continuous vocoder passage there is no measurable attack. Those cues
  are **held at their first-pass position and marked `low`**. `method` on each cue
  says which case it is: `phrase`, `attack`, `nudge`, `weak` or `held`.
- **Ends** are the release of the phrase body — smoothed envelope under 22 % of
  its own peak for 150 ms — capped for readability (1.2 s + 0.5 s per word, max
  3.2 s) and never running into the next cue.
- The 13.6 s `Go!` became **three cues**, one per voiced region.

37 cues. **None begins in stem silence.**

## Corroboration the method did not use

Cue times were derived from the stem alone; the bar grid was never consulted.
Measuring the result against the grid afterwards:

| | mean distance from the nearest sixteenth |
|---|---:|
| first pass, 35 cues | 0.230 of a sixteenth |
| this pass, 37 cues | 0.183 |
| this pass, the 24 measured-attack cues only | **0.173** |

and thirteen of the measured cues land within about 13 ms of the grid, several of
them on an exact downbeat — "Gateway" at bar 88.00, "Keep moving." at bar 141.00,
"Don't look back." at bar 142.99, "Woo!" at bar 107.99. Nothing in the alignment
pushed them there. A vocal that was scattered at random against the grid before
and lands on downbeats after is the strongest independent evidence available here
that the new times are the right ones.

The vocal is nevertheless **not tightly quantised** — a mean of 0.17 of a
sixteenth is about 18 ms of genuine scatter. Do not snap picture cuts to the cue
times; cut to the bar grid and let the cues fall where they fall.

## Clock

Unchanged and re-verified. All times are the runtime MP3 clock. Cross-correlating
the stem's vocal-band envelope against the MP3's centre channel gives +0.050 s,
consistent with the first pass's 2256-sample (51.156 ms) figure and confirming its
sign.

One note on `analysis.json`: `grid_origin_wav` + `mp3_delay_sec` = 0.752500000
exactly, to nine decimals. The WAV origin is therefore derived from the
pre-analysis figure rather than measured independently, so `ANALYSIS.md`'s claim
that the conversion "reproduces the provisional 0.7525 s origin" is not the
independent confirmation it reads as. The value is very probably right to within a
millisecond either way — the strong-transient residual supports it — but it has
not actually been confirmed twice.

`ANALYSIS.md` also quotes a median onset residual of 3.74 ms and p90 of 9.97 ms;
`analysis.json` records 5.013 and 10.211 for the same measurement. The data file
is presumably the correct one.

## Still open

- **Two stretches of clear vocal energy carry no cue**: 71.37–72.81 (bar 43.4) and
  245.62–249.03 (bar 147.9). The second is the extra `Gateway` repeats the ASR
  puts at about 243.5 and 249.0 in the final hook. They are listed under
  `unaccountedVocalRegions` in `lyrics.json`. Deciding whether to caption them is a
  text decision, not a timing one.
- **18 of 37 cues are `low` confidence**, almost all of them held inside sustained
  vocoder passages where no attack can be measured. Their positions are as good as
  the first pass's transcription and no better.
- The three text ambiguities `ANALYSIS.md` flagged (the `Gateway` at 145.75, the
  `Hey!`/`Go!` at 219.13, the `Gateway` at 255.66) are untouched and still open.
- **`work/lyrics-check-v2.mp4`** burns the exact `t`..`e` spans, with each cue's
  bar, confidence and method. Watching it once through is the outstanding
  acceptance check and the only thing that can settle the `held` cues.

---

# Third pass — corrections from the burn-in

The second pass fixed what could be measured without ears. This pass applies
corrections made by watching `work/lyrics-check-v2.mp4`, each one then re-measured
in the stem so the final time is a measurement rather than a guess at a number.

41 cues.

| Correction heard | What was measured | Result |
|---|---|---|
| "Open wide" too early, really ~1:05 | attack at 64.919 | 64.919, bar 39.50 |
| "Take me through" too early, ~1:07 | attack at 67.992 | 67.992, bar 41.34 |
| the "Gateway" after it too early, ~1:08 | sub-onset inside the same phrase | 69.104, **bar 42.01** |
| "Into the light" belongs at 1:11 | attack at 71.379 | 71.379, bar 43.38 |
| "Don't look back." (1:00) too short | phrase release at 121.82 | 0.49 s → 1.09 s |
| bar 77.7 "Gateway" ~150 ms early, and there are **five** of them | a 1.5-beat pulse in the stem: 128.574 / 129.689 / 130.313 / 130.939 / 131.565 | one cue became five |
| bar 103 "Go!" belongs where the figure *ends* | the strong attack at 172.080 after seven even 1-beat chops | 170.750 → 172.080, bar 103.80 |
| "Don't look back." (3:57) too short, position right | release at 239.00 | 0.44 s → 1.60 s |
| final hook: keep the first "Gateway", drop the others, add one at ~4:09 | strongest attack in the stretch at 248.639 | the 255.66 cue deleted, 248.639 added |
| "Into the light" belongs at 4:18 | attack at 258.027 | 256.788 → 258.027 |
| "Go!" at bar 157 is not in the music | — | deleted |
| "Everybody!" missing at 4:28 | **not in the vocal stem** — see below | 268.420, bar 161.60, `low` |
| "Go!" missing at 4:34 | **not in the vocal stem** — see below | 274.060, bar 164.99, `low` |

Two of these landed on exact bar lines without being put there: the "Gateway" at
1:09 sits on **bar 42.01** and the "Gateway" at 3:59 on **bar 144.00** — the same
place in the bar as the hook openings at bar 38.02 and bar 88.00. The first
"Don't look back." now runs to bar 73.64, the second to bar 143.94.

## The vocal stem stops at 4:23

`Spot - Gateway (2026 Mix) - Only vocals.wav` has **no energy at all after about
263 s**. The "Everybody!" at 4:28 and the "Go!" at 4:34 are audible in the mix and
are simply not in that export — they must live on another multitrack element, a
chop or FX bus. They are in the cue list, marked `low`, placed from the timings
given by ear plus the mix's own transient structure: 4:28 falls on a clear change
in the mix at bar 161.60, and 4:34 on the downbeat of bar 165.

**If that element can be exported, both cues can be measured properly in minutes.**
Until then they are the two least reliable entries in the file.

## What is still unverified

- The four remaining `low` cues inside continuous vocoder passages: "Hey!" at
  1:14, "Move!" at 1:22, "Open wide" at 4:11, "Take me through" at 4:14. They were
  not flagged in the burn-in, so they are probably close, but no attack is
  measurable under them.
- The three "Go!" ad-libs at 3:10-3:18 are one label each over a repeated loop;
  the count and spacing inside each are not resolved.
- The word at 3:39 is still `Hey!` or `Go!` — the blind and primed transcriptions
  disagree and the burn-in did not settle it.

## The check video now has a bar meter

`work/lyrics-check-v3.mp4` shows, at the top of frame, running time, the current
bar to a beat, and a four-dot beat indicator that highlights the current beat with
the downbeat picked out in blue. The bottom carries the cue text and, under it,
its exact span, bar and confidence. The overlay is generated from `analysis.json`
and `lyrics.json` by the script embedded in `work/check.ass`, so re-rendering it
after any change is one ffmpeg command:

```
ffmpeg -f lavfi -i color=c=black:s=1280x720:r=25 -i "Spot - Gateway (Mix 2026).mp3" \
       -vf "ass=work/check.ass" -shortest -c:v libx264 -crf 28 -c:a aac lyrics-check.mp4
```

---

# Fourth pass — second round of ear checks

| Correction heard | What was measured | Result |
|---|---|---|
| the 1:14 "Hey!" is around bar 45 beat 3–4 | rise 0.50 → 0.89 at 75.333, the only clean one in that range | 74.998 → **75.333**, bar 45.75 |
| 1:22 "Move!", 4:11 "Open wide", 4:14 "Take me through" are right | — | positions kept, `low` → `high` |
| a repeated "Open wide" before 4:14, at bar 152 beat 3 | the only attack in the stretch, at 253.577 = bar 152.70 | **new cue** |
| the 3:39 word is "Go!" | — | `Hey!` → `Go!`, `low` → `high` |

42 cues. The repeated "Open wide" is worth noting: both ASR passes had it
(`Open` 252.65, `wide` 253.57 in the stem clock) and there is a clean attack under
it, but the first two passes dropped it because the surrounding vocoder pad is
continuous and nothing in the machine pipeline could separate one hook line from
the next. It took an ear to know it was there and a measurement to place it.

Five cues remain `low`:

- the three `Go!` ad-libs at 3:10–3:18, each one label over a repeated loop whose
  internal count is unresolved;
- `Everybody!` at 4:28 and `Go!` at 4:34, which are **not in the supplied vocal
  stem at all** and are placed from the mix. Exporting whatever multitrack element
  carries them is the one thing left that would move the file forward.

Everything else is `high` or `med`, and every `high` is either a measured attack in
the stem or a position confirmed by ear.

---

# Fifth pass — the "Go!" triple, and what is still uncaptioned

The three `Go!` ad-libs around 3:11 were the last `low` cues that could be settled
from the stem, and the first passes had them wrong in kind rather than in degree:
they were spread one per voiced burst across nine seconds, when by ear they are a
tight triple inside a bar and a half.

Placed at bar 115 beat 3, bar 115 beat 4 and bar 116 beat 1, the stem shows three
clean attacks — silence to 0.89, 0.11 to 0.62, 0.06 to 0.21 — at 191.798, 192.227
and 192.648. They are **0.429 s and 0.421 s apart, against a beat of 0.4167 s**,
and each lands on the eighth after its beat to within 25 ms. Three shouts, one
beat apart, on the off-beat. Nothing in the placement used the grid; it agrees
anyway.

42 cues, and **only two remain `low`**: `Everybody!` at 4:28 and `Go!` at 4:34,
which are not in the supplied vocal stem at all.

## Ten stretches of vocal that no cue covers

Moving the three `Go!` cues left the bursts they used to sit on uncovered, which
raised a more general question: what else is audible in the stem and not in the
caption list? These are now listed in `lyrics.json` under
`unaccountedVocalRegions`, and **marked in red in the check video** so they can be
identified by ear in one pass:

| meter | time | length | peak |
|---|---|---:|---:|
| 45.2 | 74.71–75.13 | 0.4 s | 0.98 |
| 96.4 | 160.64–162.85 | 2.2 s | 0.46 |
| 98.3 | 163.50–164.10 | 0.6 s | 0.39 |
| 99.2 | 164.76–165.76 | 1.0 s | 0.37 |
| 101.1 | 167.67–171.68 | 4.0 s | 0.41 |
| **117.2** | **194.91–196.01** | **1.1 s** | **1.19** |
| **119.3** | **198.65–198.95** | **0.3 s** | **1.39** |
| 145.4 | 242.32–248.43 | 6.1 s | 0.63 |
| 150.4 | 250.55–251.17 | 0.6 s | 0.54 |
| 157.2 | 261.33–262.20 | 0.9 s | 0.73 |

The two in bold are the loudest vocal events in the whole passage and carry no
caption at all. The 145.4 stretch is the `Gateway` repeats in the final hook. The
101.1 stretch is the run of seven even one-beat chops before the `Go!` at bar
103.8. Several of the others are probably vocoder tails rather than words — the
first passes classified nine such stretches as non-words already — but that is a
judgement only an ear can make.

---

# Sixth pass

- **bar 117 beat 2** (194.91–196.01, the loudest thing in the passage) is an
  **instrument bleeding into the vocal-only stem**, not a word. Moved to
  `notWords`. Worth remembering: a "vocals only" export is not automatically only
  vocals, and an energy detector cannot tell the difference.
- **bar 119 beat 4** (198.66) is a **`Go!`** and is now a cue. It sits 10 ms off
  beat 4 — the tightest cue in the file.

**43 cues. Two `low`:** `Everybody!` at 4:28 and `Go!` at 4:34, still absent from
the stem.

Eight stretches of stem energy remain uncaptioned, all of them now quiet
(peak 0.37–0.98 against the loud events' 1.19–1.39). The largest, at bar 145 beat
4, is the six-second run of `Gateway` repeats in the final hook that were
deliberately dropped; the one at bar 101 beat 1 is the run of even one-beat chops
before the `Go!` at bar 103.8. The rest are most likely vocoder tails.

---

# Seventh pass — every cue auditioned

The whole cue list has now been checked by ear against the burn-in video.

**One correction.** The `Gateway` at 4:08 was in the wrong place; by ear it belongs
at bar 150 beat 1. The stem has an onset there — 0.30 rising to 0.62 — at
**249.080 s, two milliseconds off the downbeat**. That is the third cue in the
file to land on an exact bar line without the grid being used to place it.

**Two decisions not to caption.** The `Gateway` swell at 4:02–4:08 is the hook
echoing rather than a sung line — recorded in `notWords` with the reason, so the
next person does not rediscover it as a gap. The shout before the five `Gateway`s
at 2:08 was also ruled out by ear; it is not in `notWords` because no separate
vocal event is measurable there in the stem — the whole burst reads as one voiced
region beginning at 128.67.

**Ten cues upgraded to `high`** on ear confirmation: `Higher!`, the `Go!` at 0:48,
the `Gateway` at 1:09, all five `Gateway` shouts at 2:08–2:11, and the `Gateway`s
at 2:25 and 4:08.

## Final state

**43 cues. 41 `high`, 2 `med`, none `low`.**

The two `med` are `Everybody!` at 4:28 and `Go!` at 4:34. Their positions are
confirmed by ear, but they stay at `med` because they are **not in the supplied
vocal-only stem** and there is nothing measurable underneath them — they were
placed from the mix. If the multitrack element that carries them can be exported,
they become measurements like everything else.

Seven quiet stretches of stem energy (peak 0.37–0.98) remain uncaptioned and
unauditioned. They are marked in red in the check video. None of them looks like a
missing word any more; the two that did — the loudest events in the track, at bar
117 and bar 119 — turned out to be an instrument bleeding into the stem and a
`Go!` respectively, and both are now resolved.

## What this cost, and what it bought

The first analysis pass produced 35 cues, 16 of which began in silence. Getting to
43 cues that are 95 % `high` took three machine passes and four rounds of ear
checks. Every round found something the previous one could not: measurement found
the cues that started before their words, the grid found the ones that were a
whole utterance out, and only an ear could tell a vocoder tail from a word, an
instrument from a voice, or a sung line from its own echo.
