import * as THREE from 'three';
import { Dark } from '../env/dark.js';

/* S9 — Dark.  Bars 80–87.
 *
 * 'Figures stand in the dark with red eyes and do not move. The strobe shows
 * them for a frame at a time.'
 *
 * The camera very nearly does not move either. The shot list says twice, for
 * both shots, that this one is static, and the first pass took that literally:
 * position, target and up set once in the constructor, the approach done
 * entirely by narrowing the lens.
 *
 * That was wrong, and it was wrong in a way worth writing down. A zoom is not
 * a move. Narrowing the field of view scales every part of the frame by the
 * same factor, so the near crowd and the far crowd grow together and the
 * picture stays exactly as flat as a photograph of itself — which is what it
 * looked like: eight bars of a still image being cropped. Depth in a rendered
 * frame comes from PARALLAX, and parallax comes only from the camera changing
 * position; nothing else in the pipeline can produce it, and no amount of
 * grade or depth of field is a substitute.
 *
 * So the camera now drifts — see CAM below — by about a metre sideways and
 * five metres forward across the whole scene, which is little enough that
 * 'static' is still a fair description of the shot and enough that the front
 * row and the back row separate. The crowd is still nailed down. Nothing in
 * this world moves; the frame moves past it, barely, and that is what makes it
 * a place rather than a backdrop.
 *
 * The strobe is the film's one licensed exception to its own rule. SCENES.md:
 * 'Nothing that pulses with the beat may touch geometry or global brightness.
 * One exception, declared here: the strobe in S9 IS global brightness, because
 * the strobe is the scene.' So this scene is allowed to drive exposure off the
 * beat grid, and it is the only one that does.
 *
 * What the strobe is, precisely, matters more than that it exists:
 *
 *   It is a function of beat PHASE, not of a timer. tl.beatPhase(t) is the
 *   position inside the current beat, derived from the measured grid, so the
 *   flashes land on the beat at whatever the track actually does and a frame
 *   rendered on its own knows where it sits without counting.
 *
 *   It is short. A flash that occupies a quarter of a beat is a light that
 *   blinks; one that occupies a twentieth is a photograph. The figures are
 *   only ever a photograph.
 *
 *   It does not decay to nothing. There is a floor — see FLOOR — because a
 *   frame at true zero between flashes is indistinguishable from a dropped
 *   frame or a dead render, and this scene has no other content to prove
 *   otherwise. The floor is far too low to see the crowd by. It is enough to
 *   see the eyes by, which is the point of the second shot.
 *
 * The eyes are the only thing that persists between flashes, and in bars 84-87
 * they are almost all there is: 'the figures are close now, they have not
 * moved and they are not going to'. The crowd cannot move closer, since it is
 * built once, so the approach is a narrowing lens over a creeping camera: the
 * FOV does most of it and the drift supplies the parallax that tells the eye
 * the narrowing is an approach rather than a crop.
 *
 * The eyes themselves are not still either, and this is the cheapest life in
 * the film. They blink, each on its own period, and they GAZE — holding a
 * direction for a second or two and then darting to another. Both are pure
 * functions of (t, figure index), both cost one shader and no geometry, and
 * between them they are the difference between a crowd standing there and a
 * crowd waiting. See env/dark.js.
 */

/* How much light there is between flashes. Not zero — see the note above. */
const FLOOR = 0.030;

/* How long a flash lasts, in SECONDS, not in beat phase — and the distinction
 * is the whole difference between a strobe and a flicker.
 *
 * The first pass here made the window a fraction of a beat: 0.055 of one,
 * which at this tempo is 1.4 frames. A window narrower than the frame grid
 * does not produce a short flash, it produces a flash of RANDOM BRIGHTNESS,
 * because whether a frame lands early or late inside it decides how far down
 * the decay curve that frame is sampled. Measured off a render, beats came out
 * anywhere from full to a tenth, with no pattern except the phase of the grid
 * against the beat — a strobe that visibly stutters for no musical reason.
 *
 * Two frames of absolute time fixes it, by the same argument S12's flashes
 * use: the number of frames inside [c, c + 2/60) is ceil(60c + 2) - ceil(60c),
 * which is exactly 2 at every phase. So every beat gets two fully lit frames,
 * whatever the grid is doing, and 'shows them for a frame at a time' stays
 * true. */
const FLASH_S = 2/60;

/* The drift. Small enough to stay inside the shot list's 'static', large
 * enough to separate the rows — see the note at the top on why a zoom alone
 * could not.
 *
 * The amplitudes are chosen from the geometry rather than by eye. The nearest
 * figures stand about 26 units out; a lateral offset of A units swings them
 * through A/26 radians, and at the opening 46-degree lens that is
 * A/26 * 1280/0.80 pixels across a 1280-wide frame. One unit is therefore
 * about fifty pixels of travel for the front row — a slow, obvious slide —
 * against 340 units for the back row, which is four pixels. That RATIO is the
 * whole effect: 'takarivi liikkuu vähän eri tahtiin kuin eturivi'.
 *
 * Two sine terms with incommensurable rates, so the sway never repeats inside
 * the scene and never arrives back at a place the eye recognises. The slow one
 * carries the drift across the whole eight bars; the faster one, at about a
 * ten-second period, is what makes the movement visible inside any few seconds
 * of it. A single slow term measured out a thirty-pixel swing over thirteen
 * seconds, which is real parallax that nobody can see.
 *
 * The forward creep does most of the work, and it is the term to reach for
 * first if this needs more: a dolly changes the SIZE RATIO between the rows,
 * and seven units takes the front row thirty per cent bigger while the back
 * row grows two. Sideways drift separates the rows; forward drift separates
 * their scale, and the second is the one the eye reads as depth. It is an
 * exponential approach rather than a ramp, so it is quickest at the top where
 * the lens has not started narrowing yet and has nearly stopped by the time
 * the lens takes over — the two never both accelerate at once. */
/* The last thing that happens in this world.
 *
 * 'Ja sit ihan scenen lopussa silmät valaisevat kaiken ja tilanne ylivalottuu.'
 * — at the very end of the scene the eyes light everything and the frame
 * overexposes.
 *
 * Which is the only ending this scene can have that is not a cut. The crowd
 * cannot advance and a fade to black on a scene that is already black is not
 * an ending, it is a power cut. The one thing in frame with any light in it is
 * the eyes, so the ending is the eyes — they stop being points seen in someone
 * else's strobe and become the source, the bodies they belong to lit red from
 * the front by two hundred pairs of them, and then the whole thing past what
 * the frame can hold.
 *
 * Its shape matters as much as its existence. On a cubic ramp almost nothing
 * happens for the first second: the crowd is still doing what it has done for
 * eight bars, and then in the last third of a second it is gone. A linear ramp
 * gives it away a full bar early and turns the last two bars into a fade. */
const BLAZE_S = 1.60;

/* THE FLASHBACK STROBE, and it is a different light from the one above.
 *
 * 'Pimeässä hohtavilla silmillä olevat henkilöt näkyivät väläyksissä liian
 * suuressa valaistuksessa. Haluaisin pitää että henkilöt ovat hämärässä ja
 * voisi lisätä väläyksissä strobovaloa niihin.'
 *
 * The scene's own strobe is lit for two frames out of every beat — eight per
 * cent — and the rest of the beat is the FLOOR. That is right when you are in
 * the scene for eight bars; it is wrong when a flashback shows this world for
 * a fifth of a second, because whatever it lands on is the whole cut. That is
 * why worlds.js sampled it INSIDE a flash and gave it a window of one flash's
 * length (0.026 s): anything wider walked the phase across the dark part and
 * put a black frame on one cut in six. Sampling inside the flash is exactly
 * what makes the crowd read as fully lit — the complaint.
 *
 * So a flashback gets its own light, and it is the opposite shape: a dim base
 * that is ALWAYS there, with a fast pulse on top of it. Two consequences fall
 * out of that and both are the point. The figures are in half-dark, which is
 * what they are supposed to be. And the window can be opened wide enough for
 * the pulse to actually run inside a cut, because there is no longer a dark
 * part to land in.
 *
 * Sinusoidal and not square. A square strobe at this rate is one or two
 * frames wide and undersampled — the same fault FLASH_S was written to fix,
 * and worse here because the flashbacks may be rendered at any frame rate. A
 * cosine is sampled correctly at every rate there is; the power curve gives
 * it back the short peak and long dark that make it read as a strobe rather
 * than as a throb.
 *
 * 11 Hz against a 1.667 s bar is 18.3 cycles, so consecutive bars land at
 * different phases and the four vantage points do not all catch the same part
 * of it. */
const FB_HZ = 11.0, FB_BASE = 0.13, FB_PEAK = 0.80;

const CAM = {
  /* The pan. A yaw of 0.155 rad is nine degrees, which at the opening lens is
     about a quarter of the frame's width each way — a real sweep, and still
     far inside the crowd's own 54-degree wedge, so the frame never pans off
     the end of the world.

     PAN_LAT is the dolly that goes with it. A pure pan is a rotation, and a
     rotation moves every part of the picture by the same amount: the front row
     and the back row sweep together and the shot is as flat as it was when the
     zoom was doing all the work. Panning and tracking at once is what makes
     the sweep have depth in it — the yaw carries the frame across the crowd,
     the dolly makes the near figures cross the far ones while it happens. */
  panYaw: 0.155, panLat: 1.70,

  /* The arc. The camera swings 0.030 rad around a centre 175 units down the
     plain, which puts it five metres to the right by the end of it, and the
     lookAt stays on that centre — so the back of the crowd holds still in
     frame and the front row travels a fifth of a radian across it. That
     differential IS the arc; the number to change if it wants more is orbR
     times arcA, not the lens. */
  arcA: 0.030, orbR: 175,

  /* The dolly in, which the closing zoom sits on top of. Exponential rather
     than linear so it is quickest at the top, where the lens has not started
     narrowing, and has nearly stopped by the time the lens takes over. */
  creep: 7.0, wC: 0.11,

  /* And the push, which is the last two bars on their own. The exponential
     dolly above has all but stopped by then — it is designed to, so that it
     and the lens never accelerate together — so without this the end of the
     scene is a zoom and nothing else, and a zoom is not a move: it scales the
     whole frame by one number and the crowd arrives no closer than a crop of
     it would. Nine units in three seconds takes the nearest figure in frame
     from thirty-six units out to twenty-seven, which is a third bigger, and
     the back of the crowd grows by three per cent. That difference is the
     part a lens cannot do. */
  push: 9.0,

  /* A low bob and a rise under everything, at rates that share no factor with
     the movements above. Small — a quarter of a unit — and its only job is
     that no part of this scene is ever perfectly still, including the parts
     between one move and the next. */
  bob: 0.26, wB: 0.62, rise: 0.40, wR: 0.21,

  /* The nudge. A damped wobble in the first second and a half, and its job is
     not really to move the camera — half a unit is barely a move. Its job is
     to be the first thing that happens: the crowd's eyes are coupled to the
     camera's velocity, so a settle at the cut makes two hundred and sixty
     pairs of eyes flick at the same instant, before anything else in the scene
     has had a chance to. */
  introA: 0.55, introW: 7.0, introD: 2.2
};

/* Where the four movements change over, as fractions of the scene. The scene
 * is eight bars, so these are exactly two bars each and every move lands on a
 * downbeat:
 *
 *   80-82  pan left to right
 *   82-84  pan back to the left
 *   84-86  arc right, around the crowd          (and the lens starts closing)
 *   86-88  the arc easing off under the zoom
 *
 * Written as fractions rather than as bar numbers so the shape survives the
 * analysis moving, which is the rule everywhere else in this film.
 */
const SEG = [0.25, 0.50, 0.75];

/* Smoothstep and its derivative, which is needed for the eye tracking — the
   camera's velocity has to be available in closed form, so every term in the
   path has to be differentiable on paper. */
const ss  = (x) => { const c = Math.min(1, Math.max(0, x)); return c*c*(3 - 2*c); };
const dss = (x) => { const c = Math.min(1, Math.max(0, x)); return 6*c*(1 - c); };

export class DarkScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S9') || { t: tl.timeOfBar(80), tEnd: tl.timeOfBar(88) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.tClose = tl.timeOfBar(84);          // 'Red eyes'

    this.scene = new THREE.Scene();
    /* A long lens for a still camera. 46 degrees at the start is already
       tighter than anything else in the film — a wide angle would put the
       crowd at a comfortable distance and this scene is not comfortable. */
    this.camera = new THREE.PerspectiveCamera(46, 16/9, 0.1, 900);
    this.camera.up.set(0, 1, 0);
    this._pos = new THREE.Vector3();
    this._tgt = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._track = new THREE.Vector2();

    /* The crowd is laid out against the path, not against one vantage point.
       env/dark.js turns away any figure whose head would overlap another's on
       screen, and 'on screen' now means from anywhere this shot goes — the
       camera pans a quarter of the frame each way and then arcs five metres
       right, and a spacing that only held at the opening frame would collapse
       somewhere in the middle of that. Nine samples across the scene is more
       than enough: the path is smooth and the exclusion has half again the
       margin it needs. */
    const views = [];
    for (let k = 0; k <= 8; k++) views.push(this.camAt((this.T1 - this.T0)*k/8));
    this.dark = new Dark({ views });
    this.scene.add(this.dark.group);

    /* The measured energy this scene's flash intensity rides on, normalised
       across its own eight bars. The strobe's TIMING is the grid; its
       strength is the track, so the flashes are not all the same photograph. */
    let lo = Infinity, hi = -Infinity;
    for (const b of (tl.d.bars || [])){
      if (b.bar >= 80 && b.bar < 88){ lo = Math.min(lo, b.kick); hi = Math.max(hi, b.kick); }
    }
    this._lo = Number.isFinite(lo) ? lo : 0;
    this._hi = Number.isFinite(hi) && hi > lo ? hi : this._lo + 1;
  }

  /** The camera at a time, as a pure function of it: position, the extra pan
      yaw laid on top of the look direction, and the lateral and vertical
      velocity the crowd's eyes are coupled to.

      One function, because three things need it and they must not disagree —
      update() drives the shot from it, and the constructor samples it to lay
      the crowd out so that no two heads overlap from anywhere the camera
      actually goes. */
  camAt(u, out){
    const D = this.T1 - this.T0;
    const A = D*SEG[0], B = D*SEG[1], C = D*SEG[2];
    const uu = Math.min(Math.max(u, 0), D);

    /* The pan, as one number running -1 (left) to +1 (right) and back, then
       released to zero as the arc takes over. Cosines rather than eased
       ramps: a cosine is already at full speed in the middle of its travel and
       only slows at the reversal, which is what a pan does. An eased ramp
       would stop dead at every join, which is the note this move exists to
       answer. */
    let pan, dpan;
    if (uu < A){
      pan = -Math.cos(Math.PI*uu/A);
      dpan = (Math.PI/A)*Math.sin(Math.PI*uu/A);
    } else if (uu < B){
      pan = Math.cos(Math.PI*(uu - A)/(B - A));
      dpan = -(Math.PI/(B - A))*Math.sin(Math.PI*(uu - A)/(B - A));
    } else {
      const x = (uu - B)/(C - B);
      pan = -1 + ss(x);
      dpan = dss(x)/(C - B);
    }

    /* The arc. It opens across bars 84-86 and then keeps going, slower, under
       the closing zoom — a third as far again across the last two bars. The
       tail is what stops the shot arriving at a standstill just as the lens
       takes over. */
    const phi = CAM.arcA*(ss((uu - B)/(C - B)) + 0.35*ss((uu - C)/(D - C)));
    const dphi = CAM.arcA*(dss((uu - B)/(C - B))/(C - B)
                         + 0.35*dss((uu - C)/(D - C))/(D - C));

    const damp  = CAM.introA*Math.exp(-uu*CAM.introD);
    const intro = damp*Math.sin(uu*CAM.introW);
    const dintro = damp*(CAM.introW*Math.cos(uu*CAM.introW)
                       - CAM.introD*Math.sin(uu*CAM.introW));

    const bob  = CAM.bob*Math.sin(uu*CAM.wB + 1.7);
    const dbob = CAM.bob*CAM.wB*Math.cos(uu*CAM.wB + 1.7);
    const rise  = CAM.rise*Math.sin(uu*CAM.wR + 0.6);
    const drise = CAM.rise*CAM.wR*Math.cos(uu*CAM.wR + 0.6);

    const x = CAM.panLat*pan + CAM.orbR*Math.sin(phi) + bob + intro;
    const y = 11.5 + rise + intro*0.45;
    const z = -CAM.creep*(1 - Math.exp(-uu*CAM.wC)) + CAM.orbR*(Math.cos(phi) - 1)
            - CAM.push*ss((uu - C)/(D - C));

    if (out) out.set(x, y, z);
    return {
      x, y, z,
      yaw: CAM.panYaw*pan,
      dx: CAM.panLat*dpan + CAM.orbR*Math.cos(phi)*dphi + dbob + dintro,
      dy: drise + 0.45*dintro
    };
  }

  /** The strobe. Flat 1 for two frames on every beat, then a short tail, then
      FLOOR. Flat rather than decaying across the window on purpose — see
      FLASH_S: a curve inside a window this narrow is a curve nobody samples
      the same way twice. The tail is outside the window and is what gives the
      flash an edge rather than a click. */
  strobe(t){
    const dt = this.tl.beatPhase(t)*this.tl.beat;     // seconds since the beat
    if (dt < FLASH_S) return 1;
    return FLOOR + (1 - FLOOR)*0.55*Math.exp(-(dt - FLASH_S)*26.0);
  }

  update(t, post, shot){
    const tl = this.tl;
    const p = Math.min(1, Math.max(0, (t - this.T0)/(this.T1 - this.T0)));
    const close = Math.min(1, Math.max(0, (t - this.tClose)/(this.T1 - this.tClose)));

    const fb = !!(shot && shot.flashback);

    const raw = tl.energy(t, 'kick');
    const e = Math.min(1, Math.max(0, (raw - this._lo)/(this._hi - this._lo)));
    /* Timing from the grid, strength from the track. */
    let flash = this.strobe(t)*(0.62 + 0.38*e);

    /* The blaze. Cubic, so it is late — see BLAZE_S. Clamped to reach exactly
       1 at T1 and not before, because whatever follows this scene starts on a
       white frame and a blaze that peaked early would have started coming
       back down by then. */
    const bz = Math.min(1, Math.max(0, (t - (this.T1 - BLAZE_S))/BLAZE_S));
    let blaze = bz*bz*bz;

    /* Inside the blaze the strobe stops being the thing that lights the
       crowd. Not switched off — raised to a floor, so the two frames a beat
       still land on top of it and the last bar keeps its pulse. */
    flash = Math.max(flash, blaze);

    /* A flashback replaces both of those — see FB_HZ. The blaze is dropped
       and not merely overridden: it belongs to the end of this scene and a
       cut that happened to sample the last two bars would otherwise arrive
       already white. */
    if (fb){
      /* Driven from the CALLER'S clock — see the note in worlds.js. On this
         scene's own clock the rate would have varied eightfold with the length
         of the cut, and inside a bar-length cut 11 Hz came out as 2. */
      const now = (shot.now || t);
      flash = FB_BASE + FB_PEAK*Math.pow(0.5 - 0.5*Math.cos(2*Math.PI*FB_HZ*now), 2.2);
      blaze = 0;
    }

    /* The approach. Most of it is the lens — 46 degrees to 28 is a bit under
       a half — but not all of it, and that matters: the last two bars put a
       nine-unit dolly under the zoom (see CAM.push) so the crowd arrives
       rather than merely enlarges. The crowd itself still has not moved and
       is not going to; not a single instance matrix changes in this scene. */
    const fov = 46 - 18*close;
    if (Math.abs(this.camera.fov - fov) > 1e-4){
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }

    /* The shot. Four two-bar movements, all of it a closed form in u — see
       camAt(). A frame rendered on its own knows where the camera is without
       having watched it get there, which is the rule every travelling scene in
       this film obeys, and it applies to a pan of nine degrees exactly as it
       applies to S17's two thousand units. */
    const u = Math.max(0, t - this.T0);
    const cam = this.camAt(u, this._pos);
    this.camera.position.copy(this._pos);

    /* Aimed at a FIXED point far down the plain, and then turned off it by the
       pan. The fixed target is what makes the dolly and the arc read as depth:
       keeping the gaze on something 190 units away holds the back of the crowd
       still in frame while the front row slides across it. A camera that
       carried its own target would swing the whole picture together and the
       parallax would be there but invisible. The pan is added on top as a
       rotation about that, which is what a pan is. */
    this._dir.set(0 - this._pos.x, 10.8 - this._pos.y, -190 - this._pos.z);
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    /* Rotated so a positive yaw looks RIGHT — the sign that makes `pan`
       running -1 to +1 mean left to right, which is how the move is written
       down. */
    const rx = this._dir.x*cy - this._dir.z*sy;
    const rz = this._dir.x*sy + this._dir.z*cy;
    this._tgt.set(this._pos.x + rx, this._pos.y + this._dir.y, this._pos.z + rz);
    this.camera.lookAt(this._tgt);

    /* The eyes come up as the bodies stop being visible: by the last bars the
       flash is still doing its work but what the scene is ABOUT is the pairs
       of red points that are there the whole time, in between. */
    /* The camera's lateral and vertical VELOCITY, differentiated in closed
       form rather than by remembering the last frame — the same reason
       everything else here is a closed form, and here it matters twice over,
       because a finite difference would make one frame's eyes depend on
       another frame's camera and this render is split across processes.

       Scaled and clipped into a gaze offset the whole crowd shares. The sign
       is 'toward': the camera slides right, the heads look right after it. */
    const clip = (x, m) => Math.max(-m, Math.min(m, x));
    this._track.set(clip(cam.dx*0.26, 0.150), clip(cam.dy*0.26, 0.090));

    /* Blink rate rises through the scene. Nothing else in this world is
       allowed to speed up, and by bars 84-87 the eyes are most of what is on
       screen, so this is where the scene's own acceleration has to live.

       Handed over as a rate AND as its integral. A rising rate cannot be
       applied by shortening the period, because a period that moves drags the
       phase with it — see the note in dark.js — so the shader is given a clock
       that has already accumulated the rate. The integral is written out in
       closed form rather than summed frame by frame, for the usual reason:
       frame 8400 has to know what this clock reads without having watched it
       get there. */
    const dur = this.T1 - this.T0, durC = this.T1 - this.tClose;
    const rate = 1.0 + 0.55*p + 0.35*close;
    const uT = Math.max(0, t - this.T0), uC = Math.max(0, t - this.tClose);
    const clock = uT + 0.55*uT*uT/(2*dur) + 0.35*uC*uC/(2*durC);
    /* THE EYES DO NOT GO OUT WHEN THE STROBE DOES.
     *
     * This scene drives the exposure off the beat grid — the film's one
     * licensed exception, and the right call, because the strobe IS the scene.
     * But the exposure is global, so between flashes the eyes were being
     * dimmed by exactly the same factor as the rock they are standing on: 0.32
     * against 1.30 during a flash, a factor of four. A pair of eyes is a
     * SOURCE. A source does not dim because the room light does.
     *
     * Measured with everything else in place, a frame a quarter of a second
     * after a beat: the standard deviation of the whole picture is 2.5 out of
     * 255 and the 99.9th percentile is 0.086 — that is, ninety-nine point nine
     * per cent of the frame sits inside nine per cent of the range, and the
     * eyes, which are what the shot list says this scene is about ('figures
     * stand in the dark with red eyes'), are a handful of pixels at a fifth of
     * the way up the scale. Across the whole film S9 measures a standard
     * deviation of 3.1 against a median of 27 — the flattest scene by a factor
     * of nearly three, and it has now been flagged in two reviews.
     *
     * So the eyes are given back the exposure the strobe takes away, capped so
     * that they can only ever be lifted between flashes and never dimmed
     * during one — and never lifted so far that they outshine the flash they
     * are supposed to be seen in spite of. Nothing about the strobe, the
     * bodies or the grade changes; the only thing that changes is that the one
     * light in this world stops flickering with the room. */
    const expoNow = 0.30 + 1.00*flash + 2.40*blaze;
    const live = Math.min(3.0, Math.max(1, 1.30/Math.max(expoNow, 1e-3)));
    this.dark.update(t, { flash, open: Math.min(1, 0.55 + 0.45*close + blaze), blaze,
                          rate, clock, track: this._track, live });

    // ---- grade ---------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;
    /* The licensed exception. Exposure is on the beat grid here and nowhere
       else in this film. */
    c.uExposure.value = 0.30 + 1.00*flash + 2.40*blaze;
    c.uBloom.value    = 0.22 + 0.55*flash + 0.95*blaze;
    c.uCA.value       = 0.0014 + 0.0060*blaze;
    /* Heavy, and heavier as the crowd closes. This world has no sky and no
       distance; the vignette is what stops the frame having corners. */
    /* And the vignette opens as the blaze takes the frame. A vignette is a
       statement that the light in this world falls off at the edges, and by
       the last third of a second it does not. */
    c.uVignette.value = (0.82 + 0.12*close)*(1.0 - 0.92*blaze);
    /* High. The gaps between flashes are nearly black, and a nearly black
       frame with no grain in it bands into visible steps on any display. */
    c.uGrain.value    = 0.052;
    /* A red lift, which is the one place in the film the black itself is
       coloured: between flashes the only thing in frame is the eyes, and a
       neutral black under them reads as a picture of lights rather than as a
       dark that has something in it. */
    c.uLift.value.setRGB(0.020, 0.002, 0.004);
    /* Warmed through the blaze. uFlash is a scalar and adds equally to all
       three channels, so an unmodified gain takes the whiteout to a cold blue
       grey — which is a lamp being switched on, not two hundred pairs of red
       eyes overwhelming a camera. The gain is what keeps the clipping warm. */
    c.uGain.value.setRGB(1.06 + 0.16*blaze, 0.94 - 0.12*blaze, 0.95 - 0.22*blaze);
    /* The overexposure itself, on top of the exposure lift: uFlash is added
       before the exposure multiply, so a small number here becomes a large
       one by the time the frame is graded, and the last few frames of this
       scene are genuinely clipped rather than merely bright. */
    c.uFlash.value    = 0.80*blaze*blaze;

    /* Shallow, and shallower as the lens tightens — a long lens on a crowd at
       this range has almost no depth of field, and the far figures dissolving
       is what keeps the wedge from reading as a grid. */
    d.uStart.value = 60 - 20*close;
    d.uEnd.value   = 400 - 140*close;
    d.uMaxRadius.value = 1.8 + 1.2*close;
  }

  debugLayers(){ return this.dark.debugLayers(); }

  dispose(){ this.dark.dispose(); }
}
