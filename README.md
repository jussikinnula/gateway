# Gateway — music video

A generative music video for **Spot — Gateway (Mix 2026)**, rendered with
Three.js and WebGL. Everything on screen is procedural: no models, no image
textures, no footage, and every cut and camera move derived from the track's own
bar grid.

The song is about a wormhole. The picture goes through it: a surface like water
seen from underneath, a tunnel of changing light, and then somewhere else — a
jungle, a volcanic world, a dark world of strobes and red eyes, islands floating
in space with waterfalls falling off their edges, a desert. Calm at first, and
less and less sure what is real as it goes on.

> **The track is not in this repository.** It is not released, so the audio file
> is deliberately absent and git-ignored. Drop it in the repository root and run
> `npm run setup`.

## State of this repository

The render and preview pipeline is **built and verified end to end**: preview,
single-file pack, stills, offline render to mp4 with the audio muxed in, and the
scene-dispatch check all run. It is ported from the `stingray` project, with all
of that project's scenes, environments and objects removed.

What does not exist yet:

- **The analysis.** `analysis.json` currently holds a provisional pre-analysis
  (see [`docs/PREANALYSIS.md`](docs/PREANALYSIS.md)) and `lyrics.json` is empty. The work
  order for producing the real thing is [`docs/ANALYSIS-PLAN.md`](docs/ANALYSIS-PLAN.md).
- **The film.** `src/scenes/s00-portal-test.js` is a test card, not a scene. It
  exists to prove the pipeline and should be deleted once S4 is written.

The analysis is done — see [`docs/ANALYSIS.md`](docs/ANALYSIS.md) and
[`docs/LYRICS-REALIGNMENT.md`](docs/LYRICS-REALIGNMENT.md) — and the film is designed in
[`SCENES.md`](SCENES.md): 17 scenes, 40 shots, bar-accurate. `npm run check` now
doubles as the build checklist: every scene it reports as a mismatch is a scene
that has not been written yet.

## Quick start

```bash
npm install                       # Node 20 LTS or newer
npx playwright install chromium   # only needed for offline rendering
npm run setup                     # copies the track and timeline data into public/
npm run dev                       # preview on localhost
```

Click once in the page to start audio.

## Preview controls

Space toggles play/pause, `H` hides the interface, the arrow keys step one bar
(hold shift for one beat), and the buttons jump to scenes and shots. `ALL` plays
the whole film with the clock switching scenes — the one view that catches a
scene-dispatch bug.

The button on the right cycles the render scale: **1× → 1.5× → 2× → 0.75× →
0.5×**. Above 1× is supersampling; below 1× is an escape hatch for slower
machines.

## Single-file preview

```bash
npm run pack                  # -> preview.html, opens on package.json's preview.scene
npm run pack -- --scene S3
```

One self-contained file with the bundle and the timeline data inlined, reading
the track from alongside it. Double-click to open — no server, no install. This
is the right way to review a finished scene, because it runs in real time on a
GPU. Offline rendering exists only to produce the final file.

## Offline rendering

```bash
npm run setup
npm run film                      # the whole thing -> gateway.mp4
npm run render -- --from 115.75 --to 159.09 --out chorus.mp4
```

Defaults are **2560×1440, 60 fps, straight into ffmpeg** — no frames directory.
1440p is deliberate: YouTube serves 1440p and above with VP9 or AV1 at several
times the bitrate it gives 1080p, so a viewer watching in a 1080p window sees a
better picture than the same shot uploaded at 1080p.

Useful flags: `--w --h` size, `--ss` supersample, `--jobs` pages, `--crf
--preset` the encoder, `--scene S3` to pin one builder, `--gpu off` for the
software rasteriser, `--png <dir>` to write frames instead of piping, `--keep`
to leave the part files behind.

`render.mjs` prints which renderer it actually got. If that line names
SwiftShader the frames are coming out of the CPU and will be about an order of
magnitude slower.

### The one precondition

**Every frame must be a pure function of its index.** No clock, no accumulator,
no `Math.random` in the frame path. Parallel rendering splits the film into
blocks and joins them with `-c copy`; anything that integrates over time shows
up as a jump at a block boundary in the finished file. Check it rather than
trusting it:

```bash
npm run render -- --w 640 --h 360 --from 115.0 --to 115.9 --jobs 1 --png /tmp/r1
npm run render -- --w 640 --h 360 --from 115.0 --to 115.9 --jobs 3 --png /tmp/r3
diff -r /tmp/r1 /tmp/r3
```

Pick a range that crosses a scene boundary.

### Checking a single shot

```bash
npm run stills -- --scene S3 --t 118.4,120.1,121.9 --out stills
```

Reports any shader error the page logged — a program that fails to compile draws
whatever the last valid one left behind, which looks like a badly tuned
parameter and is not one.

## How the timing works

```
bar N starts at  grid_origin + (N-1) x bar_sec
```

with the constants in `analysis.json`. Every cut lands on a bar boundary; none
falls inside a bar. **No timing is hard-coded in a scene file.** Scenes read
`timeline.json` through `src/timeline.js` and derive bar numbers, beat phase,
section and scene boundaries and measured energy from it, so the plan and the
render cannot drift apart.

## Data flow

```
scenes.json  --npm run scenes-->  SCENES.md   <- the design document

analysis.json  +  structure.json  +  scenes.json  +  lyrics.json
                        |  npm run timeline
                   timeline.json          <- the only file the runtime reads
                        |  npm run setup / pack
                 public/data/timeline.json

lyrics.json  --npm run srt-->  lyrics.srt   <- the YouTube caption track
```

Run `npm run timeline` after editing any of the four. It asserts that scenes are
contiguous, that shots stay inside their scenes, that nothing runs past the end
of the track and that no boundary falls inside a bar — and refuses to write on
any of those.

## Layout

| Path | What it is |
|---|---|
| `src/scenes/*.js` | One file per scene block. Owns its shot list, camera choreography and per-shot grade. |
| `src/env/*.js` | Environments. Empty — the worlds go here. |
| `src/objects/*.js` | Procedural objects. Empty. |
| `src/core/post.js` | Post chain: distance defocus, CRT/phosphor, bloom, chromatic aberration, vignette, grain, ACES. Inherited from `stingray`; the volumetric pass is switched off and needs re-authoring or deleting before it is used. |
| `src/core/glsl.js` | Shared GLSL: noise, height fog, Gerstner waves. |
| `src/core/fsq.js` | Fullscreen pass helper. |
| `src/timeline.js` | Reads `timeline.json`. Time to bar, beat, section, scene, beat pulse, measured energy. |
| `tools/build-timeline.mjs` | Merges the four authored data files into `timeline.json`, with assertions. |
| `tools/build-scenes-doc.mjs` | Generates `SCENES.md` from `scenes.json`. `npm run scenes`. |
| `SCENES.md` | The design document. **Generated — edit `scenes.json`.** |
| `render.mjs` | Headless Chromium steps frames and pipes them into ffmpeg. |
| `stills.mjs` | Single frames at chosen times. Fails loudly on shader errors. |
| `encode.mjs` | PNG directory to mp4, for the `--png` path. |
| `check-scenes.mjs` | Asserts every second of the film draws the scene it should. `npm run check`. |
| `pack.mjs` | Builds the single-file preview. |
| `srt.mjs` | Regenerates `lyrics.srt` from `lyrics.json`. |
| `sweep.mjs` | Parameter sweeps. |

## Conventions worth keeping

**Nothing that pulses with the beat may touch geometry or global brightness.** A
field-of-view punch reads as judder; modulating bloom flips thousands of small
bright details in and out of glow and reads as flicker. Beat response belongs in
things that are already local and moving.

**Repeating patterns must fade by their own pixel footprint,** not by distance.
`fwidth` gives the true footprint; a distance threshold lands in the wrong place
at some other focal length or resolution.

**Sub-pixel lines get fainter, not narrower.** Narrowing a ramp below a pixel
breaks the line into dashes. Hold the geometry at half a pixel and express
anything thinner as intensity.

## Captions

```bash
npm run srt
```

Regenerates `lyrics.srt` from `lyrics.json`, which is the same cue list the
renderer reads. Run it after nudging any cue. Never hand-edit the SRT.

## Licence

MIT — see [LICENSE](LICENSE). This covers the code, the shaders and the design
documents. It does **not** cover the music, which is not included here and is
all rights reserved.
