# Pre-analysis — provisional

Measured by Claude in a cloud sandbox (librosa 0.11, ffmpeg decode) before the
real analysis pass. **This is a hypothesis to falsify, not a result.** It exists
so that the pipeline has a bar grid to run against on day one, and so that the
analysis pass has something to disagree with. Where it and the real analysis
differ, the real analysis wins — and the difference gets explained in
`ANALYSIS.md`.

Frozen copy: `analysis.pre.json`. The working copy the pipeline reads is
`analysis.json`, which starts as a duplicate and is replaced by the analysis
pass.

## The grid

| | value | confidence |
|---|---|---|
| duration | 293.4073 s (4:53.4) | exact |
| BPM | **144.000** | **high** |
| beat | 0.4166667 s | high |
| bar (4/4) | 1.6666667 s | high |
| grid origin (downbeat of bar 1) | **0.7525 s** | medium |
| bars in the file | 175 full bars | medium |
| first audible sample | 0.0512 s | exact |

**BPM.** A fine-resolution DFT of the onset envelope over 70–200 BPM, scored on
the fundamental plus the 2nd and 4th harmonics, peaks at 144.00 with the next
candidate more than a factor of two down. `librosa`'s default tempo estimator
returns 95.7 BPM for this track — a metrical error, not a near miss. This is a
good illustration of why the plan asks for the fine search rather than the
library default.

**Drift.** Small but measurable. The phase of the strongest transients slips
about −4.4 ms across 225 s, which corresponds to a true tempo nearer 144.003
than 144.000. That is a quarter of a video frame over the whole track and can
almost certainly be ignored — but it should be measured properly rather than
assumed away, and it may be an artefact of the MP3 decode rather than the music.

**Phase.** The 25 strongest broadband transients in the track land at a
consistent sixteenth-note phase of 0.021–0.026 s (spread 5 ms), which is what
pins the grid. Independently, 95.7 % of 2 221 detected onsets fall within 20 ms
of the resulting sixteenth grid, with a median deviation of 2.6 ms.

**Downbeat — the weakest number here.** The beat grid is solid; *which* beat is
beat 1 was settled indirectly, by requiring that the section boundaries found by
a self-similarity novelty curve land on bar starts. Origin 0.7525 s puts all
nine of them within 0.06 bar of an integer; the three other candidates are a
quarter, a half and three quarters of a bar out. That is good evidence, but it
has not been auditioned against a click track — do that first.

**A loose end.** The audio begins at 0.0512 s and bar 1 begins at 0.7525 s, so
there are about 0.70 s — 1.7 beats — of music before the first complete bar.
Either the file was trimmed part-way through a bar, or the intro genuinely has a
pickup. The analysis pass should decide which, and set `pickup_beats`.

## Structure — provisional

Boundaries from per-bar kick-band energy (which finds the drum entries and cuts
to the exact bar) cross-checked against a mel self-similarity novelty curve. The
*names* are the Suno sheet's running order mapped onto those boundaries by
plausibility, and are the least reliable thing on this page.

| section | bars | time | evidence |
|---|---|---|---|
| Intro | 1–29 | 0:00.8 | breakbeat with little low end; kick lifts at bar 10 (0:15.8) |
| Groove | 30–53 | 0:49.1 | full kick and bass enter hard at bar 30 |
| Build | 54–69 | 1:29.1 | kick drops back at 54 and again at 62 |
| Chorus (vocoder) | 70–95 | 1:55.8 | kick returns at 70; 2-bar break at 78–79; new phrase at 80 |
| Groove 2 | 96–112 | 2:39.1 | drums back partially at 96, fully at 104 |
| Breakdown | 113–119 | 3:07.4 | drums cut |
| Rebuild | 120–127 | 3:19.1 | drums return |
| Climax | 128–149 | 3:32.4 | highest measured RMS and kick of the track |
| DJ Outro | 150–175 | 4:09.1 | drums return at 150 after a 1-bar cut; layers thin from 173 |

Phrase arithmetic: boundaries up to bar 77 sit on an 8-bar grid, then a two-bar
drum cut at bars 78–79 shifts the phrase grid by two bars for the rest of the
track. There is a second, smaller irregularity somewhere in bars 137–146 that
was not resolved. Both are the kind of thing the analysis pass should nail down,
because a scene cut placed two bars off a phrase reads as a mistake.

## Vocals — not attempted

No usable vocal analysis was produced here: the sandbox could not reach the
model host, so no ASR was run, and a center-channel extraction on the full mix
returned windows up to 16 seconds long that are plainly sustained synth rather
than singing. That is exactly the failure mode the plan is written to avoid —
**separate the stem first.** Nothing about vocal timing in this document should
be relied on, because there is nothing here.

## What was not measured

- Anything about the vocal.
- Time signature was assumed 4/4 throughout and not tested.
- Key, chord changes, and the piano motif the sheet mentions.
- Whether the 2-bar irregularity at 137–146 is an insertion or a truncation.
