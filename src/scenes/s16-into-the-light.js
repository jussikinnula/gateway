import * as THREE from 'three';
import { Tunnel } from '../env/tunnel.js';

/* S16 — Into the light.  Bars 150–157.
 *
 * 'The final hook. The last thing the tunnel does is stop being a tunnel.'
 *
 * Two shots and they are opposites, which is the shape of the scene:
 *
 *   150-152, 'Gateway'. The tunnel is beautiful again, and the beauty is a
 *   subtraction rather than an addition — S15 left the rings off-axis, the
 *   camera off the centreline and the roll reversing, and this simply puts all
 *   three back. Warp to zero, the camera onto the axis, roll monotonic and
 *   slow. Nothing is added to make it lovely; it stops being broken, and after
 *   ten seconds of S15 that reads as relief.
 *
 *   153-155, 'White'. The rings dissolve into a flat field. Not a fade to
 *   white — a fade would take the tunnel with it evenly, and what the shot
 *   list asks for is that the tunnel STOPS BEING a tunnel, which means the
 *   thing that replaces it has to arrive from where the tunnel's own vanishing
 *   point already is. So the core opens: tunnel.js's cone of light down the
 *   axis, held to a pinprick everywhere else in the film and let go here until
 *   it has eaten the frame. The rings fade at the same time, so the last thing
 *   to disappear is the geometry nearest the camera, which is what being
 *   swallowed by something ahead actually looks like.
 *
 * White peaks on 'Into the light' at 155.37 and then HOLDS for four and a half
 * seconds, to bar 158. Two of those bars were added late: the ending was moved
 * to 04:22 to land on the beat, and the hold is where the second, echoed
 * 'into the light' sits — 'tässä valkoista'. Measured across it the frame is
 * mean 0.844, sd 0.041, frame-to-frame difference 0.007. That is a card, and
 * it is meant to be one.
 *
 * S17 then comes OUT of it rather than being cut to: it opens on this scene's
 * own value (uFlash 0.355, matched by measurement) and racks into focus over
 * two bars. That hand-off is the reason this scene does not fade out — there
 * is nothing to fade to that is not already on screen, and the next scene
 * starts from the card rather than replacing it.
 */

/* Where the tunnel starts, and it is deliberately S15's own last colour: that
   scene ends on a hot near-red, and a hard cut into a fresh palette would make
   this a fourth passage rather than the last one recovering. It drifts from
   there to white across the scene, which is the only colour move in it. */
const FROM = [1.00, 0.32, 0.14];
const TO   = [1.00, 0.99, 0.96];

export class IntoTheLightScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S16') || { t: tl.timeOfBar(150), tEnd: tl.timeOfBar(156) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.tWhite = tl.timeOfBar(153);         // where the rings begin to go

    const V0 = 620, V1 = 1180, D = this.T1 - this.T0;
    this.v0 = V0; this.acc = (V1 - V0)/D; this.D = D;
    this.travel = (t) => { const u = t - this.T0; return V0*u + 0.5*this.acc*u*u; };
    this.speed  = (t) => V0 + this.acc*(t - this.T0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 16/9, 0.1, 3000);
    /* S4's own proportions, near enough. This is the film's last tunnel and it
       is supposed to remind you of its first one. */
    this.tunnel = new Tunnel({ count: 220, radius: 22, perBeat: 4, streaks: 5200, mist: 4200 });
    this.scene.add(this.tunnel.group);

    /* Five cues land in these six bars; the last, 'Into the light' at 155.37,
       is where white peaks. Read out of the timeline rather than written here
       — if the analysis moves, this moves with it. */
    const cues = (tl.d.lyrics || []).filter(c => c.t >= this.T0 && c.t < this.T1);
    this.cues = cues.map(c => c.t);
    this.tPeak = this.cues.length ? this.cues[this.cues.length - 1] : this.T1 - 0.6;

    this._colA = new THREE.Color(...FROM);
    this._colZ = new THREE.Color(...TO);
    this._col = new THREE.Color();
    this._colB = new THREE.Color();
    this._tgt = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._ref = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._hsl = { h: 0, s: 0, l: 0 };
  }

  update(t, post){
    const tl = this.tl;
    const y = this.travel(t);
    const v = this.speed(t);
    const p = Math.min(1, Math.max(0, (t - this.T0)/this.D));

    /* The dissolve. 0 through 'Gateway', then a smoothstep across the last
       three bars, driven past 1 into the hold: white has to be AT white before
       bar 156 and stay there, because the cut to S17 is white-to-near-white
       and a frame still on its way up would read as a cut on a fade. */
    const wRaw = Math.min(1, Math.max(0, (t - this.tWhite)/Math.max(this.tPeak - this.tWhite, 1e-3)));
    const white = wRaw*wRaw*(3 - 2*wRaw);

    const e = p*p*(3 - 2*p);
    const colour = this._col.copy(this._colA).lerp(this._colZ, Math.max(e, white));
    this._col.getHSL(this._hsl);
    const colour2 = this._colB.setHSL((this._hsl.h + 0.46) % 1,
      Math.min(1, this._hsl.s*0.92 + 0.20), Math.min(1, this._hsl.l*0.85 + 0.12));

    // ---- camera --------------------------------------------------------------
    /* Back on the axis, and the wander that every other passage carries is
       damped to almost nothing — 'the calmest move since the jungle'. What
       little is left keeps it from being a locked-off shot, which at this
       speed would read as a still. */
    const bar = tl.bar(t);
    const az = bar*0.035;
    const tilt = 0.16 + 0.035*Math.sin(t*0.61);
    this._dir.set(Math.sin(tilt)*Math.sin(az), Math.cos(tilt), Math.sin(tilt)*Math.cos(az)).normalize();
    this._ref.set(0, 1, 0);
    if (Math.abs(this._dir.y) > 0.985) this._ref.set(0, 0, 1);
    this._right.crossVectors(this._dir, this._ref).normalize();
    this._up.crossVectors(this._right, this._dir).normalize();
    /* Monotonic and slow. S15's reversal is gone; so is its jitter. */
    const roll = y*0.0010;
    this._q.setFromAxisAngle(this._dir, roll);
    this._up.applyQuaternion(this._q);

    /* Widening into the dissolve, which does two things at once: it opens the
       frame as the light takes it, and it drops the rings' angular size so
       they leave faster than the core grows. */
    const fov = 70 + 16*white;
    if (Math.abs(this.camera.fov - fov) > 1e-4){
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(0, y, 0);
    this.camera.up.copy(this._up);
    this._tgt.copy(this.camera.position).add(this._dir);
    this.camera.lookAt(this._tgt);

    // ---- the tunnel ----------------------------------------------------------
    this.tunnel.update(t, {
      travel: this.travel, speed: v,
      beat0: tl.origin, beat: tl.beat,
      colour, colour2,
      px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
      /* The mist goes before the rings do — it is the depth cue, and taking it
         first is what flattens the tunnel into a field rather than merely
         brightening it. */
      mist: 0.9*(1 - white),
      floorY: -1e9,
      /* The rings dissolve. Not to zero: a handful of arcs still visible at
         the cut keeps the last frame from being a flat card, and S17 opens on
         a sky that is nearly this bright anyway. */
      brightness: 1.0 - 0.86*white,
      /* And the core eats the frame. This is the term the whole scene is
         built on — see the note at the top. */
      core: 0.006 + 0.94*white,
      warp: 0
    });

    // ---- grade ---------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;
    let hit = 0;
    /* Causal — see Timeline.hit(). */
    for (const ct of this.cues) hit = Math.max(hit, this.tl.hit(t, ct, 8.0));

    /* Exposure carries the last of it. The core gets the frame most of the way
       to white on its own; this is what takes it the rest, and it is held flat
       after the peak rather than allowed to keep climbing, so the last half
       second is a hold and not a ramp. */
    c.uExposure.value = 1.00 + 0.85*white;
    c.uBloom.value    = 0.34 + 0.45*white + 0.16*hit;
    c.uCA.value       = 0.0022*(1 - white);
    /* The vignette has to go too. A white field with a dark surround is a
       lamp; a white field without one is light. */
    c.uVignette.value = 0.72*(1 - white);
    c.uGrain.value    = 0.034*(1 - 0.8*white);
    c.uLift.value.setRGB(0.006, 0.006, 0.010);
    c.uGain.value.setRGB(1.00, 1.00, 1.00);
    c.uFlash.value    = 0.22*hit + 0.30*white;

    d.uStart.value = 110;
    d.uEnd.value   = 620;
    d.uMaxRadius.value = 2.0*(1 - white);
  }

  debugLayers(){ return { tunnel: this.tunnel.group }; }

  dispose(){ this.tunnel.dispose(); }
}
