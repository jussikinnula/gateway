# Gateway — scenes

The design document. **Generated from `scenes.json` by `npm run scenes` — edit the
JSON, never this file.** Every bar number here appears exactly once in the project.

17 scenes, 40 shots, 175 bars, 4:53.41, 144.002 BPM.

## The two registers

Every shot is one of two things, and the difference is carried by movement and
grade rather than by geometry:

**TRANSIT** — inside the gateway. The membrane seen from underneath, and the
tunnel of light beyond it. Forced perspective, motion along a single axis, roll,
saturated colour that changes by phrase, heavy bloom and chromatic aberration.
The camera is always going somewhere and always arrives.

**WORLD** — being in a place. Slower, wider, atmospheric. Height fog, volumetric
light, motion that is motivated by something in the frame. The camera looks
rather than travels.

There is no third register and no visible traveller. The viewer is the traveller;
nothing in the film ever cuts away to look at them. That is what keeps five
worlds from being a slideshow — the constant is not a character, it is a pair of
eyes with two ways of behaving.

## Shape

Five worlds, four passages, and an ending that does not resolve.

The three hook entries are the spine: **bar 38.02**, **bar 88.00** and **bar
144.00**, each a measured vocal attack that lands on a bar line. The hook is
always sung *inside* the tunnel, never in a world, and `Into the light` is
always the exit. The fourth passage is the two-bar inserted break at bars 78–79,
where five `Gateway` shouts a beat and a half apart become five membranes in
five seconds.

The passages get shorter and worse: fourteen bars, then eight, then six, then
three. By the last one the tunnel does not work.

## Scenes

| | scene | register | bars | time | section |
|---|---|---|---|---|---|
| S1 | Under | WORLD | 1–12 | 0:00.75 | Intro |
| S2 | Open your eyes | WORLD | 13–19 | 0:20.75 | Intro |
| S3 | Ascent | WORLD | 20–29 | 0:32.42 | Intro |
| S4 | First passage | TRANSIT | 30–43 | 0:49.09 | Groove / Drop A |
| S5 | Jungle | WORLD | 44–61 | 1:12.42 | Groove / Drop A |
| S6 | Second passage | TRANSIT | 62–69 | 1:42.42 | Build |
| S7 | Volcanic | WORLD | 70–76 | 1:55.75 | Groove / Hook B |
| S8 | Five gateways | TRANSIT | 77–79 | 2:07.42 | Groove / Hook B |
| S9 | Dark | WORLD | 80–87 | 2:12.42 | Groove / Hook B |
| S10 | Third passage | TRANSIT | 88–93 | 2:25.75 | Groove / Hook B |
| S11 | Floating islands | WORLD | 94–112 | 2:35.75 | Groove / Hook B |
| S12 | Void | WORLD | 113–119 | 3:07.42 | Breakdown |
| S13 | Bleed | WORLD | 120–127 | 3:19.08 | Rebuild |
| S14 | Collapse | WORLD | 128–143 | 3:32.42 | Climax |
| S15 | Last passage | TRANSIT | 144–149 | 3:59.08 | Climax |
| S16 | Into the light | TRANSIT | 150–157 | 4:09.08 | DJ Outro |
| S17 | Desert | WORLD | 158–175 | 4:22.42 | DJ Outro |

---

## S1 — Under

**bars 1–12 · 0:00.75–0:20.75 · 12 bars, 20.0 s** · WORLD · Intro  
*Deep water, no surface in sight*

The film opens where the traveller already is, not where the story starts. Black, then the suggestion of a ceiling. Nothing is a world yet.

**Tech.** New: the water column (particulate, caustic light from an unseen surface), the height-fog and grain floor, the base grade. Everything S4 needs for the membrane is built here from below. The pulses on 'Hey!' and 'Move!' are a multiplier on the exposure, not the compositor's flat uFlash: that term adds to every pixel in linear light before the gamma, so on a shot built to be almost black it was a white card over the column. Only the pre-burst into S4 uses it, where erasing the frame is the job. The climb starts already moving (a twelfth of the end speed from the first frame, integral still closed-form so both endpoints hold exactly), the seabed sits a hundred and sixty units under the lens instead of five hundred out of frame, and the marine snow is centred on the camera rather than hung below it — three layers that were built and never seen, on the one shot that has nothing else to measure its own movement against.

### 1–4 · Nothing  <sub>0:00.75–0:07.42</sub>

Black, with only the film's grain floor and a gradient a few percent above black at the top of frame. The picture is not empty by accident — it is empty because there is nothing to see yet.

- **Camera.** Dead still. No move at all, for four bars.
- **Sync.** Breakbeat is already running with no low end (measured kick 0.03). The picture ignores it completely.

### 5–9 · Something above  <sub>0:07.42–0:15.75</sub>

A slow drift upward begins. The gradient resolves into caustic light moving across an unseen ceiling.

- **Camera.** Slow rise, no rotation. The frame is doing one thing.
- **Sync.** Air band lifts at bar 5; the caustics gain contrast with it.

### 10–12 · Power  <sub>0:15.75–0:20.75</sub>

The kick arrives and the water column becomes visible: particulate, lit in shafts from above.

- **Camera.** Still rising. First slight tilt upward.
- **Sync.** Bar 10 is the measured kick entry (0.18 to 0.69). The particulate field appears on that downbeat.
- **Cues.** Hey! (bar 12.71)

---

## S2 — Open your eyes

**bars 13–19 · 0:20.75–0:32.42 · 7 bars, 11.7 s** · WORLD · Intro  
*Deep water, the surface resolving*

The picture opens on the words that ask it to. Above us a membrane resolves out of the dark, and there is light behind it.

**Tech.** The membrane shader: a Gerstner surface seen from underneath, refracting a single bright source. Shared with S4, which passes through it. The climb starts already moving (a twelfth of the end speed from the first frame, integral still closed-form so both endpoints hold exactly), the seabed sits a hundred and sixty units under the lens instead of five hundred out of frame, and the marine snow is centred on the camera rather than hung below it — three layers that were built and never seen, on the one shot that has nothing else to measure its own movement against.

### 13–16 · Hey  <sub>0:20.75–0:27.42</sub>

The caustics tighten. Two pulses cross the water column.

- **Camera.** Rising, tilt continuing upward.
- **Sync.** 'Hey!' at bar 12.71 and 'Move!' at bar 15.01 each fire one pulse. Both are measured cue times, not beats.
- **Cues.** Move! (bar 15.01)

### 17–19 · The surface  <sub>0:27.42–0:32.42</sub>

The frame opens: the membrane above resolves into a rippling surface with a single bright source behind it.

- **Camera.** The tilt completes; the surface fills the top third.
- **Sync.** 'Open your eyes.' at bar 17.02 opens the frame. 'The gateway is open.' at 19.15 brightens the source behind the membrane.
- **Cues.** Open your eyes. (bar 17.02) · The gateway is open. (bar 19.15)

---

## S3 — Ascent

**bars 20–29 · 0:32.42–0:49.09 · 10 bars, 16.7 s** · WORLD · Intro  
*Rising water column*

Rising. The only shot in the film where speed increases without a cut.

**Tech.** Speed is a function of bar phase and measured energy, not an accumulator — see the purity rule in README. The climb starts already moving (a twelfth of the end speed from the first frame, integral still closed-form so both endpoints hold exactly), the seabed sits a hundred and sixty units under the lens instead of five hundred out of frame, and the marine snow is centred on the camera rather than hung below it — three layers that were built and never seen, on the one shot that has nothing else to measure its own movement against. The climb gets a run-in from this scene's own downbeat: a second speed term rising as a cube, so the acceleration is itself still growing at the break, taking the end speed from 55 to 95 — a number shared with S4's V0 by contract. And the marine snow is drawn as real motion blur: the motes are fixed in the world and the camera moves, so each one smears by exactly the camera's displacement through the shutter, which makes round specks in the deep water and long streaks at the break out of one expression that cannot disagree with the speed. S3 and S4 do not cut or cross-fade: for the last two bars the climb draws S4's OWN tunnel — same build, same path evaluated backwards into the water, same colour — additively into water that is nearly black, first as rings inside Snell's window and then as the geometry beyond it, so bar 30 changes nothing about an object that is already there.

### 20–25 · Rising  <sub>0:32.42–0:42.42</sub>

Ascent. The surface grows. Shafts converge toward where we will break through.

- **Camera.** Continuous rise, accelerating. No cut inside the shot.
- **Sync.** Speed is derived from measured RMS, so the picture accelerates exactly as the mix does.
- **Cues.** Higher! (bar 25.90)

### 26–29 · Higher  <sub>0:42.42–0:49.09</sub>

The last four bars before the surface. The membrane is close enough to see its thickness.

- **Camera.** Fastest sustained move in the first minute.
- **Sync.** 'Higher!' at bar 25.90 is a surge in speed. 'Go!' at 29.69 is the last quarter beat before the drop — hold on it.
- **Cues.** Go! (bar 29.69)

---

## S4 — First passage

**bars 30–43 · 0:49.09–1:12.42 · 14 bars, 23.3 s** · TRANSIT · Groove / Drop A  
*Through the surface, into the light tunnel*

The first gateway. We break the surface from beneath and there is no sky on the other side — there is a tunnel of light. The hook is sung inside it.

**Tech.** New: the light tunnel. Concentric emissive rings with per-phrase colour, forced perspective, chromatic aberration and bloom driven by the hook cues. S3 and S4 do not cut or cross-fade: for the last two bars the climb draws S4's OWN tunnel — same build, same path evaluated backwards into the water, same colour — additively into water that is nearly black, first as rings inside Snell's window and then as the geometry beyond it, so bar 30 changes nothing about an object that is already there. The camera never quite finds the axis: a camera sitting on the axis of a radially symmetric tunnel and looking along it cannot make a picture that changes, which is what twenty of these twenty-three seconds were. A few degrees of aim and a few units of offset, both wandering on incommensurable rates and both zero at the break, move the vanishing point out of the frame's centre and make the rings eccentric. And the tunnel's strength comes from the track, so the loudest two bars of the scene — which sit in the thirteen seconds before the first hook cue — are the brightest.

### 30–33 · Break  <sub>0:49.09–0:55.75</sub>

We come through the surface from beneath. There is no sky. There is a tunnel.

- **Camera.** Through, then straight down the axis.
- **Sync.** Bar 30 is the measured full-kick entry. The break is on that downbeat and nowhere else.

### 34–37 · Tunnel  <sub>0:55.75–1:02.42</sub>

Concentric rings of light, forced perspective, colour shifting by phrase.

- **Camera.** On the axis, slight roll.
- **Sync.** Ring spacing is one ring per beat; the roll rate comes from the bar grid.

### 38–43 · The hook  <sub>1:02.42–1:12.42</sub>

The tunnel's colour changes on each hook line. At the last line it opens white.

- **Camera.** Accelerating on the axis.
- **Sync.** 'Gateway' 38.02, 'Open wide' 39.50, 'Take me through' 41.34, 'Gateway' 42.01, 'Into the light' 43.38. The exit is on the last one.
- **Cues.** Gateway (bar 38.02) · Open wide (bar 39.50) · Take me through (bar 41.34) · Gateway (bar 42.01) · Into the light (bar 43.38)

---

## S5 — Jungle

**bars 44–61 · 1:12.42–1:42.42 · 18 bars, 30.0 s** · WORLD · Groove / Drop A  
*A jungle so bright it is hard to look at*

The first arrival, and the most beautiful thing in the film. It gets the longest run because everything after it is a decline.

**Tech.** New: env/jungle.js — canopy, god-rays through leaves, wet surfaces, insect-scale motes. The volumetric pass earns its place here. The canopy shot steps off the centre line as it rises and keeps aiming at the deck, so the walkway runs diagonally out of a corner instead of standing vertically down the middle: from fifteen metres up a centred walkway makes a bilaterally symmetric frame, which has half the information it appears to have — measured, the middle third of this scene ran at a standard deviation of 9.5 out of 255 against 22 at its opening. The grade lowers the lift with height at the same time, because on a frame with no highlight in it a raised black is the whole range. S5 and S6 do not cut: for the last two bars the jungle draws S6's OWN tunnel — same build, same path evaluated backwards out of the scene, same colour — laid along the lens by a quarter turn rather than standing vertically as Tunnel builds it, drawn additively into a forest that is already draining, with warp on the rings and the compositor's fisheye and chromatic split rising under them. The scene's own note always said the jungle stops holding together and the tunnel is what is left; this is that sentence made visible.  Two things the canopy shot broke and did not own up to. The corridor clearance is ASYMMETRIC now: the camera's lateral offset up there is high*(6.2 + 3.4*sin), between 2.8 and 9.6 units to the RIGHT and never negative, while the funnel was cleared around x = 0 at 0.115 per unit of height — 3.6 units wide at canopy level. So the camera spent that whole shot six units outside the cleared shaft, flying through the leaf field, and every frond it passed was shoved aside by the vertex displacement. Clearing it symmetrically would take twice the foliage out for no reason, since nothing is ever on the left up there, so the right side opens at 0.62 and the left keeps 0.115. And the morph's corridor now ARRIVES rather than switching on: Tunnel.update takes a `from` distance, the point ahead at which the corridor currently begins, swept from 520 units down to -30 across the two bars so the far rings come up first and the corridor builds back toward the camera. Ramping every ring's brightness together, which is what it did, is a dissolve wearing a tunnel's clothes — the whole object appears at once at every distance, which is the one thing an object coming toward you never does. The streaks are gated on the same sweep; gating the rings alone left the arrival exactly as abrupt, because the long filaments are what fills the frame.

### 44–49 · Arrival  <sub>1:12.42–1:22.42</sub>

Jungle. Overexposed for half a bar, then the eye adjusts and it is the most beautiful thing in the film.

- **Camera.** Slow forward drift, low, looking slightly up.
- **Sync.** Exposure recovery is a fixed curve from bar 44, not an auto-exposure — it must be identical every render.
- **Cues.** Hey! (bar 45.75) · Come on! (bar 49.36) · Move! (bar 49.87)

### 50–53 · Canopy  <sub>1:22.42–1:29.08</sub>

God-rays through leaves. Water on everything.

- **Camera.** Rising through the canopy.
- **Sync.** 'Hey!' 45.75, 'Come on!' 49.36 and 'Move!' 49.87 are in this run — treat them as movement in the leaves, not as cuts.

### 54–57 · Wrong light  <sub>1:29.08–1:35.75</sub>

The Build starts. The light in the jungle begins to come from the wrong direction.

- **Camera.** Forward, but the camera stops tracking anything.
- **Sync.** Bar 54 is the measured kick drop (0.68 to 0.23). The light shift starts exactly there.

### 58–61 · Losing it  <sub>1:35.75–1:42.42</sub>

Colour draining toward the tunnel's palette. The jungle is still there and no longer convincing.

- **Camera.** Slow, unmotivated drift.

---

## S6 — Second passage

**bars 62–69 · 1:42.42–1:55.75 · 8 bars, 13.3 s** · TRANSIT · Build  
*The tunnel, without a membrane*

The second gateway is rougher than the first: no water, no threshold, the tunnel simply closes around us as the build rises.

**Tech.** Reuses the S4 tunnel with a different palette and no membrane pass. The Build section is the transit; the drop at bar 70 is the arrival. 'Keep moving.' is a flare on the exposure and the bloom; only the arrival into the drop uses the compositor's flat uFlash, where a whiteout straddling the cut is the intent. S5 and S6 do not cut: for the last two bars the jungle draws S6's OWN tunnel — same build, same path evaluated backwards out of the scene, same colour — laid along the lens by a quarter turn rather than standing vertically as Tunnel builds it, drawn additively into a forest that is already draining, with warp on the rings and the compositor's fisheye and chromatic split rising under them. The scene's own note always said the jungle stops holding together and the tunnel is what is left; this is that sentence made visible.  env/tunnel.js: a near-lens fade for the ring arcs was written for the flicker at 118.6 and then reverted with everything else from that session, so the arcs still fade only from -26 to 0 — full brightness at the moment they reach the lens. The finding stands and the fix is waiting: they are the only layer in that file without a near fade. The arcs faded from -26 to 0, which is to say they were at FULL brightness at the instant they reached the lens and only dimmed once they were behind it. An arc at that moment is a ring of radius 18 to 22 centred on the axis: with the camera on the axis that is a hoop around the frame edge and nobody notices, but every passage in this film puts the camera deliberately OFF the axis, and the near side of that hoop then passes a few units from the lens and subtends most of the picture — a thick opaque tube sweeping in from one side and gone in two frames, always on the side the camera is offset toward. Measured over the second passage at ten frames a second: the bright fraction of the left third of the frame peaked at 0.207 with two spikes, and 0.065 with none after.

### 62–65 · The tunnel forms  <sub>1:42.42–1:49.08</sub>

Rings assemble out of the jungle geometry itself.

- **Camera.** Forward, speed rising with the build.
- **Sync.** Bar 62 is a measured boundary. Ring opacity follows the risers in the air band.

### 66–69 · Rush  <sub>1:49.08–1:55.75</sub>

Full tunnel, no membrane. Faster than the first passage and less beautiful.

- **Camera.** On the axis, roll increasing.
- **Sync.** 'Keep moving.' at bar 69.61 is the last thing before the drop at 70.
- **Cues.** Keep moving. (bar 69.61)

---

## S7 — Volcanic

**bars 70–76 · 1:55.75–2:07.42 · 7 bars, 11.7 s** · WORLD · Groove / Hook B  
*Ash, smoke, and fire under a black sky*

Beautiful in a way that wants us gone. Nothing here is at human scale.

**Tech.** env/volcanic.js — the ground is one height field, and the volcanoes are places in it rather than cones standing on it: a concave stratovolcano profile with a flattened rim and a bowl, gullies its own ejecta cut, and lava running out of the crater and down them, reddening as it cools. The lava morphology is in the HEIGHT FIELD and not in a normal map: overlapping flat-topped inflation lobes (a max over plateaus, because flows stack where hills would add), pressure ridges lying across the flow, and seams that cut as well as glow — sampled in a bounded domain warp rather than in a rotated frame, because a rotation by a position-dependent angle multiplies the frequency by the distance from the origin and turns a 240-unit lobe into an 8-unit spike. Two meshes draw it from one shared material: the 19-unit plane, which discards inside 1250 units of the camera, and a 6.8-unit patch snapped under the camera that fills that hole and carries the near-field forms. Both evaluate the same expression wherever they overlap, and the lobe fronts widen with distance so the coarse mesh is never asked to draw a step it cannot sample. Same lattice snapping the desert uses, so the terrain holds still under a flying camera; the camera's own height is read from a CPU mirror of the same field, because at thirty-four units a fixed altitude flies through a hillside. The first shot orbits the hero volcano and the second runs down its own exit tangent, so the two moves are one curve with nothing to smooth at the join. Ash particulate, ember fields, smoke columns rising out of the craters — the puffs carry no baked position at all: the instance matrix is identity and each puff's height, width and drift are a closed form of (attributes, time) in the vertex shader, age = fract(phase + t/life), the same pattern the embers use, so the smoke recycles and rises without anything integrating. One wind for the world shears every column the same way, superlinearly in height, so they bend rather than lean. Steam off the live flows, placed from a CPU read of the same field the shader draws the lava with, ground glow in the fissures. Reuses the height fog from core/glsl.js.  Last two bars, the second morph: the volcanic scene draws S8's OWN gateway tunnel — same build spec, same path evaluated outside its span, same accent computed by S8's own HSL formula — laid along the camera's forward vector so the mouth opens in mid-air over the plain, centred on the hero volcano, and ramped by a cubed parameter so it is a suggestion until the last beats. Additive into a darkening world: nothing is taken away to pay for it, which is what makes it a morph and not a dissolve. Warp on the rings, the compositor's fisheye and split rising under them, and the cut at bar 76 lands inside an object that was already there.  Four defects behind 'värinää tulivuorien pinnalla ja vieressä', found by measurement and all of them real. (1) The CAMERA WAS INSIDE THE HEIGHT FIELD: the lobe front widened with distance from the camera, and surfH() reads it, so every vertex's height was a function of where the camera was and the lattice snapping that holds the terrain still held the sample points still while the field moved under them. Worse, the volcanic world is photographed from four different vantage points in the flashbacks, so it had four different shapes. The front is a constant now — the mesh's sampling density does not fall off with distance, it is 19.35 units on the coarse plane and 6.8 on the near patch and uniform across each; what falls off is the screen density, which is an aliasing problem and not a geometry one. (2) The two meshes OVERLAPPED rather than tiling. The old note claimed the band was a hundred units of two meshes evaluating one identical expression, 'the only kind of seam that cannot show'. Both halves were wrong: the patch is a square and the hole is a circle, so the band ran from 100 units on the axes to 871 in the corners, and one expression evaluated by a 19-unit lattice and a 6.8-unit lattice is not one surface — where the two reconstructions are close they z-fight, and each is snapped to its own lattice so the fight re-rolls every step. They tile at equal radii. A geomorph of the near patch onto the coarse surface at the seam was written and then taken out again while this scene was being made cheap enough to run at all; it is the right fix for the seam and it needs a cheaper form than four extra height evaluations per ring vertex — the field sampled on the coarse lattice and bilinearly interpolated, which is exactly what the plane outside draws, so at the boundary the two surfaces are identical and there is nothing left to disagree about. Butting them together at equal radii without that was not enough: each mesh decides which side of the boundary a pixel is on from ITS OWN interpolated world position, so where the surfaces disagree the two boundaries do not coincide and along that curve there is a band where both discard — nothing drawn at all, sky through the mountain, a dark curve that appears and vanishes as the boundary sweeps and a vertical tear where it runs down the fall line. Four extra evaluations for about a fifth of that mesh's vertices, under a tenth of the scene. The tiling history: The first fix left forty units of deliberate overlap with a depth offset to win it, arguing that a shared edge would leave a one-pixel crack where the two reconstructions disagree about which side of 1250 a pixel is on. Right about the crack, wrong about the cure: a depth offset wins by a fixed bias, and on a cone flank two lattices 27 and 8.8 units apart reconstruct the surface metres apart. What that band was is a ring of contested pixels at a fixed distance from the camera, sweeping across the mountainside as the camera moves — which looks like a vein flickering on the slope. At equal radii the two tests are complementary and no pixel is contested except the single row where the meshes' own interpolated world positions disagree about the boundary; the depth offset stays to settle that row. (3) The vertex NORMALS are forward differences, so every vertex is given the normal of the cell to its +x/+z and the interpolated shading changes slope at every cell boundary. Central differences were tried and taken out again: they bought 8.57 to 8.41 on the motion-compensated residual, which is inside the instrument's noise, and they cost two extra evaluations of surfH per vertex — three to five, a 67% rise on the heaviest expression in the film across 579,000 vertices, which tripped a driver watchdog on a real GPU and crashed the tab while SwiftShader had run it without complaint. A more correct normal is not worth a scene that does not render. (4) The crack seams are 7.2 and 3.2 world units wide with no band-limiting at all — sub-pixel past the foreground, which is a network of bright lines over near-black basalt that does not move under a moving camera, it sparkles. Each seam is now widened to at least its own pixel footprint (dFdx/dFdy of the world position, which is the real variable; distance was the proxy this shader used and at a grazing angle a near pixel has a larger footprint than a far one seen square on) and dimmed by the same factor, which is what a mip level is. The bump fades on the footprint too. What is left after all four is honest camera motion: measured, nine pixels a frame at output resolution through the run-in, on a very high-contrast surface with no motion blur.  The footprint is computed as the FIRST thing in the fragment shader, above both discards, and that placement is the whole of it: screen-space derivatives are taken across a 2x2 quad of fragments and are therefore only defined in control flow that is uniform across that quad. Taken after a discard, as the first version did, the quad may have lost a lane and the result is undefined by the specification — one driver returns garbage, another NaN, a third hangs and takes the browser tab with it. It did. SwiftShader tolerates it and rendered the same frame byte-identically through every check, which is the second time in one round that the software renderer certified something a real GPU would not run.  And the mesh was HALVED, because this scene had stopped running in the live preview and the bill was this file's own. Measured against the other worlds at the same size and the same frame: about ten seconds a frame in the software renderer where the next most expensive scene costs one, and muting layers put half of that on the coarse ground alone — 620 squared is 385,000 vertices each evaluating surfH() three times, and surfH() is the heaviest expression in the film. The plane went from 12000 to 11400, which is free: the height fog takes this ground to haze by 5600 units and a 12000 plane reaches 8485 into its corners, so those corners drew nothing anyone could see. The segments went from 620 to 420 (a 27.1-unit lattice) and the near patch's from 440 to 340 (8.8), taking the pair from 579,000 vertices to 292,000. LAVA_FRONT went from 62 to 85 with it, which keeps the front at the same three-samples-across ratio the coarse lattice always had. Cost fell 45%; the picture moved by a mean of 0.84 levels out of 255 with 1.2% of pixels differing by more than 10, which is a difference nobody will find without the two frames side by side.  THE VERTEX BUDGET is what decides whether this scene runs, and the evidence is that its cost does not change with resolution: one frame at 2560x1440 and one at 320x180 — a sixty-fourth of the pixels — take the same time. Two rounds were spent lowering the resolution and hunting a fragment-side fault, and neither could ever have shown anything, because 292,000 vertices each evaluating surfH() three times is the same work whatever the frame is. It is also why the failure looked the way it did: one still renders fine because one slow frame is acceptable, a sequence does not, and on a real GPU a draw that size can outrun the driver's watchdog outright. 300 and 240 segments now: 148,000 vertices, from 579,000 when the lava geometry was rebuilt and 292,000 after the first cut. The coarse plane draws only beyond 1250 units where its 38-unit lattice subtends about 44 pixels at 1440 lines, and the patch's 12.5 units is still three samples across lavaFine's 30-unit fronts. Measured cost of the second cut: the picture moved by a mean of 0.83 levels out of 255 with 0.95% of pixels differing by more than 10.  REVERTED to the last configuration known to run: everything this file gained after that commit is out. Three things were tried against a crash and none of them was the cause — a seam geomorph, a second halving of the mesh, and a near-lens fade on the tunnel arcs. Two known-wrong conclusions are worth keeping: the vertex count was NOT the cause, because it was larger at the commit that worked; and the measurement made to support that cut is still true on its own terms — this scene's cost is vertex-bound and does not fall with resolution, one frame at 2560x1440 and one at 320x180 take the same time — it simply did not answer the question it was made for. What is still open: S7 crashes the browser in the live preview while every other scene runs, and a lost WebGL context now announces itself (main.js) so the next attempt starts from a message instead of an inference.

### 70–72 · Ash  <sub>1:55.75–2:00.75</sub>

Out into ash. Black sky, ground glowing in cracks, smoke columns going up for kilometres.

- **Camera.** Wide, slow, looking up at the columns.
- **Sync.** Bar 70 is the measured drop. Arrival is on the downbeat.
- **Cues.** Don’t look back. (bar 72.98)

### 73–76 · Don't look back  <sub>2:00.75–2:07.42</sub>

Closer to the ground. Embers passing the camera.

- **Camera.** Forward, low, fast enough to feel dangerous.
- **Sync.** 'Don't look back.' at bar 72.98 lands one hundredth of a bar before this shot starts — the line and the cut are the same instant.

---

## S8 — Five gateways

**bars 77–79 · 2:07.42–2:12.42 · 3 bars, 5.0 s** · TRANSIT · Groove / Hook B  
*Five membranes, one after another*

The five Gateway shouts are five passages. We go through all of them and arrive nowhere good.

**Tech.** One flash cut per shout, on the measured cue times. This is the shot the whole analysis was for. The afterimage after each door is an exposure drop and a bloom rise, never the compositor's flat uFlash: that term is added to every pixel in linear light before a 1/2.2 gamma, so on a corridor this dark 0.18 does not brighten the picture, it replaces it with a 24% grey card — which is what a third of this scene used to be.  Its tunnel spec, its start colour and its path are exported, because the volcanic scene two bars earlier draws them itself.

### 77–79 · Five  <sub>2:07.42–2:12.42</sub>

Five membranes, one per shout, each opening onto a different world for a few frames. None of them is entered.

- **Camera.** Straight through each one.
- **Sync.** The five 'Gateway' shouts at bars 77.69, 78.36, 78.74, 79.11 and 79.49 — measured as a 1.5-beat pulse. One flash each, on the cue time.
- **Cues.** Gateway (bar 77.69) · Gateway (bar 78.36) · Gateway (bar 78.74) · Gateway (bar 79.11) · Gateway (bar 79.49)

---

## S9 — Dark

**bars 80–87 · 2:12.42–2:25.75 · 8 bars, 13.3 s** · WORLD · Groove / Hook B  
*A black plain under strobe light*

Figures stand in the dark with red eyes and do not move. The strobe shows them for a frame at a time.

**Tech.** env/dark.js — instanced silhouettes, emissive eye pairs, strobe driven by the beat grid. The strobe is the one place brightness may pulse; see the note below. The figure is a jointed distance field, not a set of stacked boxes, so head, arms, legs and feet are one connected shape in every pose; poses, blink phase, gaze and placement are all pure functions of the figure's index. The crowd is laid out against the camera's whole path, not one vantage point: any figure whose head would overlap another's on screen from anywhere the shot goes is turned away. Four two-bar movements — pan left, pan back right, arc right, then the closing zoom — and the eyes are coupled to them, by bearing and by the camera's own velocity. The scene ends on its own light: the last 1.6 bars bring the eyes up from points to source, the bodies are lit red from the front, and the frame overexposes. The eyes are given back the exposure the strobe takes away: this scene drives exposure off the beat grid, which is the film's one licensed exception and the right call, but the exposure is global — so between flashes the one light source in this world was being dimmed to a quarter along with the rock it stands on. Clamped so it can only lift between flashes and never dim during one, on its own uniform rather than sharing the crowd's.  A FLASHBACK gets a different light from this scene's own. The strobe here is lit for two frames out of every beat — eight per cent — which is right when you are in the scene for eight bars and wrong when a cut shows this world for a fifth of a second, because whatever it lands on is the whole cut. That is why worlds.js used to sample it INSIDE a flash, with a window one flash long, and sampling inside the flash is exactly what made the crowd read as fully lit. So a flashback gets a dim base that is always there with a fast pulse on top: sinusoidal and not square, because a square strobe at this rate is one or two frames wide and undersampled at 60 fps and worse at anything lower, and a cosine is sampled correctly at every rate there is; the power curve gives it back the short peak and long dark that make it read as a strobe rather than as a throb. 11 Hz against a 1.667 s bar is 18.3 cycles, so consecutive vantage points do not all catch the same part of it. Driven from the CALLER'S clock: a cut's phase advances 0.55 across the cut, so on this scene's own clock the rate would have varied eightfold with the length of the cut, and inside a bar-length cut 11 Hz came out as 2. Peak exposure 0.93 against the 1.30 the scene itself uses, and the eyes keep their compensation, so the figures are in half-dark with the eyes the brightest thing in the frame and the pulse showing the bodies.

### 80–83 · Strobe  <sub>2:12.42–2:19.08</sub>

A black plain. The strobe shows it a frame at a time.

- **Camera.** Static. The camera does not move in this world at all.
- **Sync.** Bar 80 begins a new eight-bar phrase after the inserted two-bar break. Strobe fires on the beat grid.

### 84–87 · Red eyes  <sub>2:19.08–2:25.75</sub>

The figures are close now. They have not moved and they are not going to.

- **Camera.** Still static. The only motion is the strobe.
- **Sync.** Nothing is synced to the vocal here — there is no vocal. The silence is the effect.

---

## S10 — Third passage

**bars 88–93 · 2:25.75–2:35.75 · 6 bars, 10.0 s** · TRANSIT · Groove / Hook B  
*The tunnel, urgent*

The third gateway. Same language as the first, played faster and with less ceremony.

**Tech.** Tunnel again, shorter rings, higher speed, hook-cue colour. Each shout is a flare rather than a lift: exposure and bloom, both multiplicative, so the rings blow out and the void behind them stays a void. The compositor's flat uFlash is zero here — added in linear light before the gamma it has no small setting on a black frame, and 0.26 put a uniform 0.68 grey over the whole picture on all three cues.  Its tunnel spec, its hook colour and its path are exported: the islands keep drawing this corridor for a bar after the cut.

### 88–90 · Open wide  <sub>2:25.75–2:30.75</sub>

The tunnel takes us out. Same language as the first passage, no ceremony.

- **Camera.** Hard onto the axis, already at speed.
- **Sync.** 'Gateway' at bar 88.00 — a measured attack that lands on the downbeat to within milliseconds. The cut is on it.
- **Cues.** Gateway (bar 88.00) · Open wide (bar 89.43)

### 91–93 · Take me through  <sub>2:30.75–2:35.75</sub>

Faster, tighter rings.

- **Camera.** Axis, high roll.
- **Sync.** 'Take me through' 91.35, 'Into the light' 93.37. The exit is on the second.
- **Cues.** Take me through (bar 91.35) · Into the light (bar 93.37)

---

## S11 — Floating islands

**bars 94–112 · 2:35.75–3:07.42 · 19 bars, 31.7 s** · WORLD · Groove / Hook B  
*Fragments of ground adrift in open space*

Islands of earth hanging in space, each with its own thin atmosphere. Waterfalls fall off their edges into nothing. Roots hang below them.

**Tech.** env/islands.js — each island is a generated ROCK: a subdivided icosahedron displaced by band-limited 3D gradient noise into an irregular plan outline, a flat forested plateau with a hard rim, bedded cliffs and a torn keel. Sizes span an order of magnitude and the corridor clearance scales with them. A forest, vines, waterfalls and roots all stand on the island's own vertices rather than on a formula about where it probably is. Per-island atmospheric shell, falling water that thins into vapour, hanging root geometry. The sky is a nebula rather than an aurora: the field is inside it. Each body — the small ones included — carries a thin atmosphere that shows a star's light on its own limb, lit side and forward-scattering crescent, which is what proves a shell is air and not a glow. Rivers run across the plateaus into the falls, and the falls stop being water before they reach anything. The camera orbits from island to island above plateau level, so the field is always behind the subject and the undersides stay out of frame. 'Everybody!' is spent where it has a source — the island's own atmosphere, the exposure and the bloom — and not on the compositor's flat uFlash, which decays here over seconds and put a white fog over the whole world. The long hanging roots are gone: bundles of straight parallel tapered strips, which is not what a root is and not something the primitive could have been turned into. The rim vines stay.  The arrival is a rack, not a cut. For one bar after bar 94 the scene keeps drawing S10's OWN corridor — same spec, same path, laid along the camera's forward vector so the rings still surround a camera that is no longer in a tunnel — falling away as a cube on its own one-bar window, because rings arrive periodically and a slow tail fades one ring while the next is being drawn. Behind them the islands come up out of focus and rack in over two bars: near plane held at sixty units so the corridor stays hard while the field beyond it is light, radius 26 px against a 1080-line frame, and the SKY racks with them. That last part needed a new uniform in the defocus pass (uSkyDefocus): the dome is exempt from the defocus by default so stars stay points, but this scene's background is a nebula and several thousand stars, and a rack that leaves them sharp is not a rack — it is a soft foreground. The camera is unsteady over the same window, applied to the aim rather than the position, on two incommensurable rates, because a hand that has not settled turns, it does not slide.  It also owns a shot the film never plays in sequence: a camera under one island's waterfall that rises past the crest and then accelerates up the river to the lake, authored as an arc-length curve on the water's own numbers — the lake's centre and level, the lip and its height, the channel's bearing and the same closed-form meander the carve and the ribbon both read, and the radius at which the falling water hangs clear of the rock. The flashbacks address it as a fifth vantage on this world. Speed is 0.16u + 0.84u², ten times faster over the lake than under the fall, because the note asks for a slow rise and a fast river. The aim is the crest while the camera climbs and a lead point on its own path once it is over the lip, and it can be neither of those at the other's moment: the rise is nearly vertical, so a lead point during it is a point overhead and the lens photographs the sky; the crest, once the camera is on it, is where the lens is. It settles on the lake's far bank, which is a place, rather than along the path, which is a direction that puts the water below the frame.

### 94–99 · Islands  <sub>2:35.75–2:45.75</sub>

Open space. Fragments of ground hanging in it, each wrapped in its own thin atmosphere.

- **Camera.** Wide, drifting between two islands.
- **Sync.** 'Everybody!' at bar 95.56 — one island's atmosphere lights from within on the cue.
- **Cues.** Everybody! (bar 95.56)

### 100–104 · Falling water  <sub>2:45.75–2:54.08</sub>

A waterfall leaves the edge of an island and thins into vapour before it reaches anything.

- **Camera.** Descending alongside the fall.
- **Sync.** 'Go!' at bar 103.80 — measured, off the grid by design. Let the water carry it.
- **Cues.** Go! (bar 103.80)

### 105–112 · Roots  <sub>2:54.08–3:07.42</sub>

Underneath. Roots hang for hundreds of metres below the islands.

- **Camera.** Rising through the roots, looking up.
- **Sync.** 'Woo!' at bar 107.99 lands on a downbeat. The longest continuous shot in the film ends into the breakdown.
- **Cues.** Woo! (bar 107.99)

---

## S12 — Void

**bars 113–119 · 3:07.42–3:19.08 · 7 bars, 11.7 s** · WORLD · Breakdown  
*No ground, no light, no direction*

The drums cut. There is no world here at all — this is the space between them, and it is the first time the traveller has been in it without a tunnel.

**Tech.** No environment. Only fog, grain and a horizonless gradient. The cheapest scene in the film and the one that has to be graded most carefully.  The churn's frequencies are set by the FIELD OF VIEW: at one cell per sixty-two degrees the picture is a single flat sample of the field, whatever the field is doing. Three-dimensional (triplanar) noise, because 2-D noise on two of the direction's components mirrors the field through the plane of the third - and the mirror's axis is a line across the frame, which is a horizon.  Twelve flashes, not three: the three shouts keep their place and their weight, and around them the void is pierced on the beat, building toward them and decaying after. Two frames for the strong, one for the weak.  And the fog HOLDS THE WORLDS. Jungle, desert and islands are each photographed once into a small render target - own scene, own camera, at the same fixed instant its flash uses - and what the dome draws is not the picture but its LOCAL CONTRAST at two scales: a coarse pass for the masses (a ridge against a sky, an island against space) and a fine one to put a line on them. Mapped by the view-space direction, with the frustum's own half-angles as the scale, each panning at its own rate. A world's outline rises after its own flash and fades, so what pierced the void a moment ago is what the void is still holding. The afterglow's colour is the lift and its brightness is the exposure and the bloom; the compositor's flat white uFlash is gone, because it bleached the very tint that makes the afterimage read as a place. The flash worlds are jungle, tunnel, the crowd and the islands — the crowd in place of the desert, because the one world in this film with a face in it was missing from the sequence that is supposed to be memory, and because a flashback to the closing scene is not a flashback.

### 113–116 · No ground  <sub>3:07.42–3:14.08</sub>

The drums cut. Nothing — not black, a grey with no direction in it. The camera falls with nothing to fall past. The three shouts land at the very end of this shot, at bars 115.63, 115.89 and 116.14, and each one shows a world for two frames.

- **Camera.** Falling, but with nothing to fall past, so it does not read as falling.
- **Sync.** Bar 113 is the measured drum cut; the picture empties on that downbeat. The three flashes are on the measured 'Go!' cues, one beat apart — not on bar lines. An earlier draft of this document put them in the following shot; they were never there, and the rules section is the one that was right.
- **Cues.** Go! (bar 115.63) · Go! (bar 115.89) · Go! (bar 116.14)

### 117–119 · Nothing after  <sub>3:14.08–3:19.08</sub>

The shouts are over and nothing replaces them. Three and a half bars of the same grey — longer than the emptiness that preceded the flashes, and worse for having had something in it.

- **Camera.** Static. Still falling.
- **Sync.** The fourth 'Go!' at 119.74 sits ten milliseconds off beat four of bar 119; use it as the cut into S13.
- **Cues.** Go! (bar 119.74)

---

## S13 — Bleed

**bars 120–127 · 3:19.08–3:32.42 · 8 bars, 13.3 s** · WORLD · Rebuild  
*Two worlds in the same frame*

The drums return and so does the world — but two of them at once, occupying the same space and neither winning.

**Tech.** Two environments rendered into the same frame with a depth-aware cross-dissolve. The first scene that needs more than one env module live at a time.  Built as a LATTICE instead, after two versions that were not: three chambers strung along the shot, one world to a chamber, fog between them and nothing else.  What was tried first and why it failed is the useful part. (1) All the worlds' groups in one scene, interleaved by the shared depth buffer - on paper a depth-aware dissolve for free, in the frame two landscapes cutting through each other along the seams where their geometry happens to meet. The seam is not a tuning error, it is what interleaving is. (2) One camera with the worlds moved and scaled to meet it - the worlds cannot intersect, but it asks each of them to survive being rotated and scaled by twenty, and a world is not just geometry: it is geometry plus a camera plus a fog density in world units plus bounding spheres the renderer culls against. Scaled up, the fog is thirty lengths deep and the world is a white wash; with the culling disabled a sky dome meant to be behind you fills the frame.  So nothing is transformed. Each chamber is that world rendered by its own scene through its own camera along its own path, graded by its own compositor settings - the jungle looks exactly like S5 because it IS S5. Only one world is ever drawn, so no world can intersect another; that is structural rather than arranged. The fog is a stack of cards in the CAMERA'S own frame (view-space distances need no scale reconciliation, which is what broke the previous version), opaque at the chamber walls and gone in the middle of the room; the world is swapped at the moment the wall is thickest, so there is no cut to see. Each chamber's grade is the world's own, added to rather than replaced. Bar 124 starts a second, quicker lap through the same three places, picking up where the first left off.  A FISHEYE runs over the whole scene (post uFish: a resample of the composite that scales the offset down with radius, so the destination edge reads from inside the source and nothing is sampled from outside the frame). It is what makes six unrelated places read as six views out of one eye rather than as six shots. And the transition is an IRIS: the fog cards are in the camera's own frame, so their screen position is available in the shader and the cloud is gated by a closing circle - it comes in from the corners and shuts like a lid, faster shutting than opening, holding shut for a beat, on the same three numbers the figures in S9 blink on. The world is swapped while the lid is down. The lens bends harder as the lid comes, which is what an eye does to a picture as it closes.

### 120–123 · Two at once  <sub>3:19.08–3:25.75</sub>

The drums return. Jungle and volcanic occupy the same space, neither of them winning.

- **Camera.** Slow forward. The camera behaves as if only one world were there.
- **Sync.** Bar 120 is the measured drum return. The cross-dissolve weight follows measured kick energy.

### 124–127 · Four at once  <sub>3:25.75–3:32.42</sub>

Two becomes four. The frame is legible and wrong.

- **Camera.** Same move, unchanged, while the frame falls apart around it.

---

## S14 — Collapse

**bars 128–143 · 3:32.42–3:59.08 · 16 bars, 26.7 s** · WORLD · Climax  
*All of them, faster than they can be read*

The cut rate goes from the bar to the beat to the eighth. By the end of it there is no way to tell which world is the real one, which is the point.

**Tech.** Cut times come from the bar grid, not from a timer. Every environment is on the GPU at once here — budget for it. The hit on each cut is a gain on what the world just graded, so the join is a bright version of that place rather than a pale one. The dark world is sampled inside a strobe flash rather than across it: S9 is lit for eight per cent of each beat, so walking a 1.2-second phase through it put a flat black frame on one cut in six. Five worlds, not six — the desert belongs to the ending — and each is sampled from a list of vantage points taken off that scene's own camera path rather than from one fixed instant, chosen by walking back to the last cut that showed the same world and taking anything but the angle it used.  The tunnel's fourth vantage was bar 43, and bar 43 plus this world's 1.4 s window is inside S4's arrival — the passage blows out into the jungle over its last second, so one cut in this scene was a flat 0.84 grey card, sd 15. A vantage here is an instant PLUS a window, and it has to be legible for the whole of it. Measured across all 54 frames of the scene at two frames a second afterwards: nothing above 0.30 mean with no structure, nothing below 0.03.

### 128–133 · Bar cuts  <sub>3:32.42–3:42.42</sub>

One cut per bar between worlds.

- **Camera.** Each cut lands mid-move, so no move is ever completed.
- **Sync.** Bar 128 is the measured climax entry — the highest RMS and kick in the track.
- **Cues.** Go! (bar 132.03)

### 134–139 · Beat cuts  <sub>3:42.42–3:52.42</sub>

One cut per beat.

- **Camera.** Moves are now shorter than the shots that contain them.
- **Sync.** 'Go!' at bar 132.03 is in the previous run; from 134 the cut rate is the beat grid itself.

### 140–143 · Eighth cuts  <sub>3:52.42–3:59.08</sub>

One cut per eighth. Unreadable, and meant to be.

- **Camera.** No camera move survives long enough to be seen.
- **Sync.** 'Keep moving.' 141.00 and 'Don't look back.' 142.99 both land on downbeats. Cut on them.
- **Cues.** Keep moving. (bar 141.00) · Don’t look back. (bar 142.99)

---

## S15 — Last passage

**bars 144–149 · 3:59.08–4:09.08 · 6 bars, 10.0 s** · TRANSIT · Climax  
*The tunnel, coming apart*

The last gateway does not work properly. The rings are not concentric any more.

**Tech.** Tunnel with the ring transform perturbed by measured energy. Same builder, one uniform. The cue on the cut is a flare on the rings — exposure and bloom — and not the compositor's flat uFlash, which at 0.30 laid a 0.70 grey card over the first quarter-second of the scene.

### 144–146 · It does not work  <sub>3:59.08–4:04.08</sub>

The tunnel, but the rings are not concentric. The axis wanders.

- **Camera.** On an axis that is not the tunnel's.
- **Sync.** 'Gateway' at bar 144.00 — exactly on the downbeat, matching bars 38.02 and 88.00. The cut is on it.
- **Cues.** Gateway (bar 144.00)

### 147–149 · Worse  <sub>4:04.08–4:09.08</sub>

The rings are tearing.

- **Camera.** Roll reversing.
- **Sync.** Ring perturbation follows measured energy.

---

## S16 — Into the light

**bars 150–157 · 4:09.08–4:22.42 · 8 bars, 13.3 s** · TRANSIT · DJ Outro  
*White*

The final hook. The last thing the tunnel does is stop being a tunnel.

**Tech.** The rings dissolve into a flat field. White peaks on 'Into the light' at 155.37 and then HOLDS to bar 158 — four and a half seconds, mean 0.844, sd 0.041, frame-to-frame difference 0.007. A card, deliberately: two bars were added to this scene when the ending moved to 04:22, and the hold is where the echoed second 'into the light' sits. Hand off to S17 not on a cut and not on a fade: S17 opens on THIS scene's own value and racks out of it.

### 150–152 · Gateway  <sub>4:09.08–4:14.08</sub>

A second Gateway, and for four bars the tunnel is beautiful again.

- **Camera.** Straight, steady, the calmest move since the jungle.
- **Sync.** 'Gateway' at bar 150.00 sits two milliseconds off the downbeat — the tightest cue in the file.
- **Cues.** Gateway (bar 150.00) · Open wide (bar 151.38) · Open wide (bar 152.70)

### 153–157 · White  <sub>4:14.08–4:22.42</sub>

The rings dissolve into a flat white field.

- **Camera.** Nothing to move relative to.
- **Sync.** 'Open wide' 151.38 and 152.70, 'Take me through' 153.23, 'Into the light' 155.37. White peaks on the last.
- **Cues.** Take me through (bar 153.23) · Into the light (bar 155.37)

---

## S17 — Desert

**bars 158–175 · 4:22.42–4:52.42 · 18 bars, 30.0 s** · WORLD · DJ Outro  
*A desert under a pale sky that goes over to storm*

We are somewhere. It is quiet and it is enormous and there is nothing in it. Twenty times across the scene something on the horizon flickers that looks like a gateway and is not — once early, twice where the shot list always had them, a scattering further out, and then a fast accelerating run over bars 172-174. The sky goes over to storm, black starts at 173.3, and the mix's last hit at 174.1 fires one more flicker that the black takes mid-flash. Full black at 174.4, held over the reverb.

**Tech.** env/desert.js — dune field, heat shimmer, a single low sun, and a storm in the last bars. The dune plane is snapped to its own vertex lattice so the terrain is static in world space while the camera flies over it, and fades into the sky inside its own edge so a finite ground never shows one. The flickers are buildShardCluster(), a growing-then-settling clump of glass shards, stood on the dune surface at a fixed point in the world rather than hung at a fixed distance from the camera. The storm is one ramp read by everything: cloud deck, the sun covered rather than set, colour drained from the sand, and lightning inside the deck. Aurora: still considered and still held back — an aurora is a resolution, and a beautiful one. CHANGED FROM THE ORIGINAL BRIEF: this scene was authored to go soft rather than dark and to end mid-move without a fade ('the film has done enough fading'). The direction changed during production — darkening sky, cloud, lightning, and a fade to black cut to the last hit at bar 174.1 rather than to the end of the audio file — the tail rings on for another three and a half seconds over black. What is written here is what the film does. It starts at bar 158, not 156: bar 157 is a measured break in the mix — rms 0.48 against 0.78 either side, kick 0.29 against 0.77 — and the desert now lands on the re-entry at 4:22.42 rather than two bars early, in the middle of the previous phrase. The flight is 190 units a second, not 70: the dune field's primary ridge has a 1333-unit wavelength, so at 70 it passed less than twice in the whole scene and the ground read as frozen under a camera that was nominally flying. The flicker that used to fire into the fade is gone: a fade is a statement that the picture is ending, and something bright arriving inside one reads as the fade failing to cover it rather than as punctuation.  The arrival is a match on the white. S16 ends on a genuinely flat card — nothing in it to carry across — so the other four transitions' recipe, in which two scenes share an object drawn additively, has nothing to work with: neither side has a tunnel and one side has no geometry at all. The shared thing is the white itself. On the downbeat of bar 158 this scene starts at S16's measured value (0.32, giving 0.860 against S16's 0.845) and the card SHATTERS over one bar while the defocus racks in over two — near plane on the lens, wide radius, and uSkyDefocus on, because a desert is two thirds sky and leaving the sky sharp would have left the frame legible through the whole rack. The frame-to-frame difference at the join went from 75.5 to 15.2, and what remains of it is the desert beginning to appear. This is the one place in the film where a flat added card is the right instrument rather than a bug: everywhere else it was wrong because it lays a card over a picture, and here the frame before the cut IS a card. But a card that fades evenly fades like a card, so it comes apart instead, in the same figure as the false gateways on this scene's own horizon — F1/F2 cellular noise at the size of the whole frame (core/post.js, shardCell), each cell carrying its own departure threshold from its cell id so they leave scattered rather than together, each flaring along its own edges as it goes. Nine cells across. The arithmetic is written so both ends are exact: every cell fully white at T=1 and fully gone at T=0, because a threshold scheme that only approaches zero leaves a permanent haze on the picture it uncovered. The rim flare is k*k*(1-k) and not k*(1-k), which was the obvious form and left the last cells as hollow outlines drawn over a resolved desert. The start time itself was the older fault. scenes.json said bar 158 and had done for two rounds; data/timeline.json — which is what every scene actually reads — still said 156, because tools/build-timeline.mjs had not been re-run. The design document and the film disagreed by two bars, and every render since carried the old number.  The first five bars turn — left, then right, then straight for the remaining thirteen. This partly reverses an earlier instruction and the reversal is scoped rather than total: the first cut swept this camera through a wide searching arc and the note that removed it was explicit that the camera flies forward and does not turn to the side. What is here now is not that arc back. A camera that keeps turning is searching; a camera that settles has arrived. The heading, the bank and the lateral displacement all come off ONE function of one variable — f(s) = sin(2*pi*s)*sin^2(pi*s), yaw = -A*f, roll proportional to df/ds, lateral to the integral of f — because they are three views of one manoeuvre and three separate curves would eventually disagree. f is chosen so that it, its derivative and its integral are all exactly zero at both ends: the scene starts and finishes level, on heading, on the centre line. The integral is in closed form because desert.js places each flicker at a fixed world point worked out from where the camera will be at that event's own moment, so the camera's position has to be answerable at any t. 7.4 degrees of heading and 6.6 of bank; the bank peaks in the middle, where the heading crosses back through zero, because that is where a turn is changing fastest. Both the size and the sign of the bank were wrong first: the maximum of df/ds is on the branch where sin(a) = 0 and not on the obvious cos(a) = 0.25 one, which made the bank 1.78x what it was written to be — 11.3 degrees measured off the horizon against 6.6 authored — and the first sign banked right through the left turn, which reads as a dutch angle rather than as flying.  THE RIDGE-FOLLOWING IS GONE and the weave runs the whole scene as a closed form. What follows is the record of why, because the idea was sound and the implementation was not. (The paragraph after this describes the version that was removed.) A steering law that picks a heading from the TANGENT to a gradient has to choose between two tangents and chose the one pointing forwards; near the moment a crest runs across the heading rather than along it that test flips, the desired heading swings by half a turn, the rate saturates against its own limit in the opposite direction, and the bank goes from one end of its clamp to the other. Measured on the table it produced: through the weave the bank changed by 0.04 to 0.15 degrees per frame, and inside the ridge section by TWENTY-ONE AND A HALF DEGREES per frame, several times over ten seconds. Stabilising a feedback loop was not what was wanted after seeing it — an even weave for the whole scene was — so the path is one function again: f(s) = sin(2*pi*s)*sin^2(pi*s) repeated, with the heading, the bank and the lateral offset taken as -A*f, df/ds and the integral of f. It can repeat because all three are exactly zero at both ends of a period, so no drift accumulates over eighteen bars; amplitude and direction vary only a little per period, because 'tasainen' is the word and a weave whose swing changed by half from one pass to the next would not be even. Measured after: 5.5 degrees of heading, 7.5 of bank, a maximum of 0.13 degrees of bank change per frame, and every period boundary exactly level, on heading and on the centre line. The removed version: That made the closed form untenable and the path is ONE TABLE instead: integrated once in the constructor at 60 Hz into (x, z, yaw, roll) and read by every consumer — this camera, the look azimuth, desert.js's flicker placement. Filled once from constants and the height field and read afterwards as a pure function of t, so two processes rendering different halves of the film build the same table. The weave is the opening five bars' own f(s) repeated, which it can be because f, df and the integral of f are all exactly zero at both ends of a period — every period joins the next level, on heading and on the centre line, with no drift accumulating — with amplitude and direction per period off a hash of its index. The ridge section looks 320 units up the current heading, takes the gradient of the REAL dune field there (desert.js's own duneHeightAt, the same function it stands its flickers on, not a second opinion about where the sand is) and steers toward the tangent, which runs along a crest rather than across it, with a third of the uphill gradient mixed in — because a contour is not a ridge: the tangent alone held a constant height, which took the sd of the ground under the camera from 32 to 23 but left the mean lower than a straight run, and the uphill term walks it onto the crest and then stops there, since on a crest the gradient vanishes and the tangent is all that is left. Rate-limited and angle-limited: 'löyhästi seurata', not a machine locked onto a contour. Coming out of it the heading is pulled back onto the WEAVE'S OWN curve rather than towards zero — during the weave the two already agree so the term is nothing and the weave is untouched, and after the ridge lets go it is the only thing acting and takes the residual out with a two-second time constant, measured 2.96 degrees down to 0.16 over five seconds. The bank comes off the integrated yaw rate throughout, so it is one rule for the weave and the ridge both.  A closed form also cannot depend on the frame rate it was integrated at, and answers where the camera is at any t without a table, which is what desert.js needs to stand its flickers on the sand.

### 158–161 · Somewhere  <sub>4:22.42–4:29.08</sub>

Desert. Pale sky, massive dunes to the horizon, heat shimmer. One flicker about two and a half seconds in — the scene states its subject before it has finished establishing its silence.

- **Camera.** Straight forward at 70 units/s, no pan, no drift. A low aerial line over the crests rather than a satellite view.
- **Sync.** Hard cut in at bar 156. No fade in — the film has done enough fading.
- **Cues.** Everybody! (bar 161.60)

### 162–167 · Flickers  <sub>4:29.08–4:39.08</sub>

On the horizon something flickers that looks like a gateway and is not. Two of them here, the pair the shot list always had.

- **Camera.** Still straight forward. The camera does not go looking any more — the events sit off-centre by their own bearing instead.
- **Sync.** 'Everybody!' at bar 161.60 and 'Go!' at 164.99 — both placed by ear; they are the two least certain cues in the file, so do not hang a cut on either.
- **Cues.** Go! (bar 164.99)

### 168–175 · End  <sub>4:39.08–4:52.42</sub>

Bars 167-172: more flickers, further out and smaller with it. From bar 170 the sky goes over to storm — cloud deck, the sun covered, the sand losing its colour, lightning inside the cloud. Bars 172-174: fast flickers, accelerating, gaps closing from about a second to a tenth of one. The last one fires on the final hit at 174.1 and is the biggest of them.

- **Camera.** Still moving forward when the picture goes.
- **Sync.** Cut to the mix's last stroke, not to the end of the file. The final hit and its reverb land at bar 174.1; black starts at 173.3, is about half down by the hit, and is complete at 174.4. The remaining three and a half seconds of reverb play over black — the darkness arrives WITH the music rather than after it. Measured layer thinning still begins at bar 173.

---

## Rules that outrank anything above

**Every frame is a pure function of its index.** No clock, no accumulator, no
`Math.random` in the frame path. Speed ramps, cut rates and strobes are all
derived from the bar grid, so a range rendered on six pages is identical to the
same range rendered on one. This is checkable — see README — and it has been
broken twice on the previous project, both times invisibly.

**Nothing that pulses with the beat may touch geometry or global brightness.**
One exception, declared here: the strobe in S9 *is* global brightness, because
the strobe is the scene. Everywhere else, beat response belongs in things that
are already local and already moving.

**Cuts land on bar lines.** The only cuts inside a bar are the five flashes in
S8, the three in S12 and the eighth-note run in S14, and all of those are on
measured cue or grid times taken from `timeline.json`.

**No timing is hard-coded in a scene file.** Scenes read `timeline.json` and
derive bar numbers, beat phase and measured energy from it. If a number in this
document is wrong, it is wrong in `scenes.json` and nowhere else.

## Build order

S4 first — it is the only scene three others reuse, and if the tunnel is not
good the film has no spine. Then S5, because the jungle is the hardest
environment and everything after it is cheaper. Then S1–S3 as one block, since
they share the water column with S4's membrane. Then the worlds in order of
cost: S17 desert, S12 void, S9 dark, S7 volcanic, S11 islands. S13 and S14 come
last because they need every environment to exist first.

Delete `src/scenes/s00-portal-test.js` when S4 runs.
