# Analysis plan — Spot, *Gateway (Mix 2026)*

This is a work order, not a description. It is written to be handed to an agent
with a shell, the track and this repository, and executed start to finish. The
deliverables are four data files and one report; the acceptance criteria at the
end are the definition of done.

Choose your own libraries. The plan states what has to be true of the output,
how to measure whether it is, and where the previous attempt at this went wrong.

---

## 0. Why this is being specified so tightly

On the previous project (`stingray`) the analysis was done ad hoc, in one pass,
with no separate check. It produced a bar grid that was right and a lyric cue
list that was not: cues were placed from a whole-mix transcription, several
lines that are audible on the record were missed, several lines in the source
lyric sheet were never sung, and the ones that were placed had to be re-measured
by hand later, twice, after they had already been used to cut picture. Every one
of those errors was cheap to find and expensive to find *late*, because scenes
had been designed against them.

So: **separate the measurement from the checking, and make the checking
mechanical.** Nothing below is exotic. The discipline is the point.

The single largest technical change from last time: **isolate the vocal stem
before doing anything with vocals.** Last time the transcription was run on the
full mix, under a breakbeat, against a vocoded lead. That is the root cause of
most of what went wrong.

---

## 1. What must exist when this is finished

| File | What it is |
|---|---|
| `analysis.json` | Bar grid and measured per-bar / per-beat energy. Machine output. |
| `structure.json` | Sections of the song, in whole bars. Machine output, human-labelled. |
| `lyrics.json` | Every vocal event on the record, with verified start and end times. |
| `lyrics.srt` | Generated from `lyrics.json` by `npm run srt`. Never hand-edited. |
| `ANALYSIS.md` | The report: what was measured, how, what is uncertain, what disagrees with the Suno sheet. |

`npm run timeline` merges the first three (plus `scenes.json`) into
`timeline.json`, which is the only file the runtime reads. It already runs and
already asserts the structural invariants — run it after every change.

---

## 2. Inputs

- `Spot - Gateway (Mix 2026).mp3` — 320 kbps CBR, 44.1 kHz stereo, 293.407 s.
- `Spot - Gateway (Mix 2026).txt` — **Suno's own lyric sheet.** Treat it as a
  hint about vocabulary and running order, nothing more. It is known to contain
  lines that were never rendered to audio, and to omit ad-libs that were. The
  audio is the authority. Every disagreement gets written down in `ANALYSIS.md`.
- `analysis.pre.json` — a provisional pre-analysis (see `PREANALYSIS.md`). It is
  a **hypothesis to falsify**, not a starting point to build on. Re-measure
  everything independently; then compare, and explain any difference.

---

## 3. Stage 1 — the bar grid

Everything else in this project is expressed in bars. If the grid is wrong,
every cut in the film is wrong, and it will be wrong in a way that looks like
bad timing rather than like a bug.

**Do**

1. Decode the MP3 to 32-bit float WAV once and work from that. Note the decoder
   you used. MP3 has encoder delay; if two tools disagree about where the audio
   starts by ~25 ms, that is why. Fix one decoder and state it in `ANALYSIS.md`.
2. Estimate tempo at fine resolution — not `librosa.beat.beat_track`'s default
   grid. Compute an onset-strength envelope, then score candidate tempos over
   70–200 BPM at ≤0.005 BPM steps using the magnitude of the envelope's DFT at
   the candidate frequency and its 2nd and 4th harmonics. The correct answer for
   a machine-produced track is normally exact to two decimals.
3. **Test for drift.** Re-run step 2 independently on the first, middle and last
   third. If the three estimates differ by more than 0.01 BPM, or if the grid
   phase measured on late transients differs from the phase measured on early
   ones by more than ~10 ms, the track is not a constant tempo and the whole
   downstream model (`origin + (N-1) * barSec`) has to be replaced by an explicit
   beat table. Say which case it is, with the numbers.
4. Fix the grid **phase** from transients, not from the onset envelope. The
   envelope peaks a few milliseconds late by construction. Take the 20–40
   strongest broadband transients across the track, measure each to ≤2 ms, and
   fit the grid origin by circular mean modulo the sixteenth-note period.
   Report the per-transient residual: median and 90th percentile.
5. Resolve the **downbeat** (which of the four beats is beat 1). Three
   independent tests, all of which must agree:
   - fold the kick-band and full onset envelopes over one bar and look at the
     pattern;
   - check that the section boundaries found in Stage 3 land on bar starts;
   - listen. Generate a click track (Stage 6) and play it against the record.
6. Fix the **bar-numbering convention** and write it down: bar 1 is the first
   *complete* bar of the grid that lies within the file. If the file begins
   part-way through a bar, say so, give the length of that pickup in beats, and
   never renumber afterwards.

**Output** into `analysis.json`:

```jsonc
{
  "file": "Spot - Gateway (Mix 2026).mp3",
  "method": "one paragraph: decoder, tempo method, phase method, what was auditioned",
  "bpm": 144.0,
  "beat": 0.4166667,          // seconds
  "bar_sec": 1.6666667,
  "grid_origin": 0.7525,      // absolute time of the downbeat of bar 1
  "duration": 293.4073,
  "total_bars": 175,
  "pickup_beats": 0,          // beats of audio before bar 1, if any
  "drift": { "measured": true, "bpm_first_third": 144.0, "bpm_last_third": 144.0,
             "phase_residual_ms": { "median": 0.0, "p90": 0.0 } },
  "peaks": [ /* 3000 waveform peaks, 0..1, for the scrub tool */ ],
  "bars":  [ /* see Stage 2 */ ],
  "beats": [ /* see Stage 2 */ ]
}
```

**Acceptance**

- ≥95 % of detected onsets fall within 20 ms of a sixteenth of the grid.
- The 25 strongest transients fall within ±8 ms of a beat.
- The click track sounds locked for the full 4:53, checked by ear at the start,
  at 2:30 and at the last bar — not only at the start.

---

## 4. Stage 2 — measured energy

The scene files read this instead of hard-coding numbers, so the grid and the
animation cannot drift apart.

Per **bar** and per **beat**, aggregate from an STFT (2048/256 is enough):

| key | band | what it drives |
|---|---|---|
| `rms` | full | overall level |
| `sub` | 20–60 Hz | the deep bass the Suno sheet mentions |
| `kick` | 40–140 Hz | drum presence — the single most useful section detector |
| `bass` | 60–250 Hz | |
| `mid` | 800–2500 Hz | |
| `vox` | 300–3400 Hz, measured **on the isolated vocal stem** | vocal presence |
| `air` | 8–16 kHz | hats, risers, the "widen" gestures |

Also useful, and cheap: onset density per bar, spectral centroid, and stereo
width (mid/side energy ratio) — the last one is how a "synths widen" instruction
becomes a number a scene can read.

Normalise each series to 0..1 against its own 99th percentile and round to three
decimals. Keep raw values out of the file; scenes want a 0..1 control signal.

---

## 5. Stage 3 — structure

**Do**

1. Compute a novelty curve from a self-similarity matrix over at least two
   feature sets (mel spectrogram *and* chroma or MFCC) and take boundaries both
   agree on.
2. Compute a separate, blunter curve: per-bar kick-band energy, and its
   bar-to-bar difference. In this genre most real boundaries are a drum entry or
   a drum cut, and this finds them to the exact bar where a novelty curve finds
   them to about half a second.
3. **Snap every boundary to a whole bar.** No section may begin inside a bar.
4. Check the phrase arithmetic. Sections in this idiom are 8 or 16 bars.
   Compute the boundaries' spacing; where a gap is not a multiple of 8, look for
   an inserted 2-bar break or a truncated phrase and say which it is. An
   unexplained non-multiple usually means the grid origin is off, not that the
   music is odd.
5. Only then attach names, using the Suno sheet's running order as a guide:
   Intro, Groove, Build, Chorus (vocoder), Groove, Breakdown, Rebuild, Climax,
   DJ Outro. If the audio has more or fewer sections than the sheet, follow the
   audio and note the difference.

**Output** `structure.json`:

```jsonc
{ "sections": [
  { "id": "intro", "name": "Intro", "bar": 1, "end": 30,
    "label": "short human line for the scrub tool",
    "color": "#20243f",
    "evidence": "kick enters bar 10; full drums at 30",
    "conf": "high" }
] }
```

`bar` is inclusive, `end` is exclusive, sections are contiguous and cover the
whole track — `npm run timeline` enforces this.

---

## 6. Stage 4 — the lyrics (the part that went wrong last time)

**Do, in this order.**

1. **Separate the vocal.** Run a source separator (Demucs or equivalent) and
   keep the vocal stem as `work/vocals.wav`. Everything below is measured on the
   stem; the mix is only for listening. This is not optional and it is the main
   reason to expect a better result than last time.
2. **Transcribe blind.** Run ASR on the stem *without* the Suno sheet as a
   prompt, with word timestamps. Save the raw result. Doing this first is what
   makes step 5 meaningful — a prompted transcription will happily reproduce
   lines that are not there.
3. **Transcribe primed.** Run it again with the Suno sheet supplied as a prompt
   or bias list. Save this separately.
4. **Detect activity independently of both.** Run VAD on the stem to get the
   windows where *something* is being sung. Every window must end up either as a
   cue or in an explicit "not a word" list (ad-lib, vocal-shaped synth, breath,
   separation artefact). This is the check that catches the failure mode from
   last time: lines that are on the record and in nobody's transcript.
5. **Decide the text**, window by window, by listening. The audio wins. Produce
   three lists: agreed lines; lines in the sheet that are **not** on the record;
   vocal events on the record that are **not** in the sheet. Expect all three to
   be non-empty — the sheet's bracketed production notes (`[spoken]`,
   `[risers]`) are not lyrics, and its repeated hook lines may not match the
   number of repeats that were actually rendered.
6. **Align.** Force-align the decided text to the stem at word level, then take
   each cue's start from the **measured onset in the stem**, not from the
   aligner's frame boundary: find the first sample where the vocal stem's
   energy in 200–4000 Hz rises above the local floor, within ±120 ms of the
   aligner's estimate. Resolve to ≤10 ms. Take the end the same way, from where
   the line's energy falls back.
7. **Sanity-check against the grid, but do not snap to it.** Record each cue's
   bar position (`bar 71.00`, `bar 71.53`). A vocoded hook in a 144 BPM track
   almost always begins on a beat or an eighth. A cue that lands at bar 71.37 is
   probably mismeasured — go back and look. A cue that really is off-grid stays
   off-grid: the audio is the authority here too.
8. **Classify.** Give every cue a `kind` so the renderer can treat the hook, the
   spoken lines and the shouts differently: `hook`, `spoken`, `shout`, `adlib`.

**Output** `lyrics.json`:

```jsonc
{
  "source": "Spot - Gateway (Mix 2026).mp3",
  "method": "separator, ASR model, aligner, and what was auditioned by hand",
  "reference": "Spot - Gateway (Mix 2026).txt",
  "notInAudio": [ "lines the Suno sheet has that the record does not" ],
  "notInSheet": [ "vocal events on the record the sheet does not have" ],
  "lyrics": [
    { "t": 115.83, "e": 117.20, "text": "Gateway",
      "kind": "hook", "bar": 70.0, "conf": "high",
      "note": "onset measured in the stem at 115.83; vowel at 115.89" }
  ]
}
```

Sorted by `t`. `text` is what a viewer should read — sentence case, real
punctuation, no production tags. Ad-libs that are words (`Hey!`, `Go!`) are
cues; ad-libs that are not (breaths, risers) are not.

Then `npm run srt`. **Never hand-edit `lyrics.srt`** — it is generated, and the
whole point of generating it is that the captions cannot drift away from the
cue list the renderer reads.

---

## 7. Stage 5 — the report

`ANALYSIS.md`, written for a human who will design picture against it:

- the grid, with the residuals, and how the downbeat was settled;
- the section table, in bars and in minutes:seconds, with the evidence column;
- the full lyric table, with bar positions;
- the three disagreement lists from Stage 4.5;
- **an explicit uncertainty section**: every number you would not bet the render
  on, and what it would take to settle it.

That last section is the deliverable that was missing last time.

---

## 8. Stage 6 — verification, mechanically

Build these before declaring the analysis done. Each one takes minutes and each
one has caught a real error on this kind of project.

1. **Click track.** Render `work/grid-check.wav`: the track with a short click
   on every downbeat and a quieter one on every beat. Listen to the first bar,
   a bar around 2:30, and the last bar. A grid that is a sixteenth out is
   obvious here and invisible in every plot.
2. **Caption burn-in.** Render `work/lyrics-check.mp4`: black frame, the track,
   and each cue's text on screen for exactly its `t`..`e`. Watch it once through.
   A cue that is 300 ms late is unmistakable and no amount of staring at
   waveforms will show it.
3. **Section marks.** Add a distinct sound at each section boundary in the click
   track. A section boundary landing on a drum fill instead of the drop is
   audible instantly.
4. **`npm run timeline`.** It fails on gaps, overlaps, cuts inside a bar, shots
   outside their scene and cues past the end of the track. It must exit 0.
5. **Compare against `analysis.pre.json`** and explain every difference in BPM,
   grid origin or section boundary. "The pre-analysis was wrong because X" is a
   perfectly good explanation; silence is not.

---

## 9. Acceptance criteria

The analysis is done when all of these hold:

- [ ] `npm run timeline` exits 0.
- [ ] `npm run srt` regenerates `lyrics.srt` with no manual edits afterwards.
- [ ] ≥95 % of detected onsets are within 20 ms of the sixteenth grid, and the
      figure is stated in `ANALYSIS.md`.
- [ ] Tempo drift has been measured and reported, not assumed.
- [ ] The click track has been auditioned at the start, the middle and the end.
- [ ] Every section boundary is a whole bar, and every gap that is not a
      multiple of 8 bars has a written explanation.
- [ ] Every VAD window on the vocal stem is either a cue or on the "not a word"
      list.
- [ ] The caption burn-in video has been watched end to end.
- [ ] The three disagreement lists against the Suno sheet exist and are non-empty
      or explicitly justified as empty.
- [ ] `ANALYSIS.md` has an uncertainty section.

---

## 10. Working notes

- Put intermediate files (stems, WAVs, check videos) under `work/`. It is
  git-ignored. Do not commit stems.
- Do not modify `src/`, `render.mjs`, `pack.mjs` or `check-scenes.mjs` — the
  render pipeline is already working and verified, and the analysis pass has no
  reason to touch it.
- `analysis.pre.json` stays in the repository after you are done. It is the
  record of what the first-pass estimate was, and it is what the next person
  will compare against.
