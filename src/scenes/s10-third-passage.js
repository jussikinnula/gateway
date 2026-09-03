import * as THREE from 'three';
import { Tunnel } from '../env/tunnel.js';

/* S10 — Third passage.  Bars 88–93.
 *
 * The third gateway, and the shot list is blunt about what it is: 'same
 * language as the first, played faster and with less ceremony'. So this is
 * deliberately not a new idea. It is S4's tunnel with everything that made S4
 * an ARRIVAL taken out — no membrane to break, no approach, no settle onto the
 * axis — and the speed already up when the cut lands.
 *
 * Three things carry 'less ceremony', and all three are subtractions:
 *
 *   No ramp from rest. S4 starts at 55 units/second because it is being born
 *   out of water; S6 starts at 20 because it is guttering into existence. This
 *   one starts at 430 and ends near 1000. Nothing forms — the cut arrives
 *   inside a tunnel that was already running, which is what 'hard onto the
 *   axis, already at speed' means and is the whole difference in register.
 *
 *   No settle. S4 eases its axis to vertical over its first two bars because
 *   it has just come through a surface and has to find its footing. Here the
 *   axis wanders from the first frame to the last and never resolves.
 *
 *   Colour arrives on the cues rather than drifting. S6 crossfades one colour
 *   into another across eight bars because nothing in it is being announced.
 *   This scene has four measured hook cues in ten seconds, so it does what S4
 *   does: the hook is the colour, and each shout repaints the tunnel.
 *
 * The exit is on 'Into the light' at bar 93.37, not on the bar line — the shot
 * list says so and the cue is measured to the millisecond.
 */

/* The same hook palette S4 paints with. Reused rather than re-picked on
   purpose: these are the film's gateway colours, and a third passage that
   invented its own would be a fourth idea rather than a third instance. */
const HOOK_COLOURS = [
  [0.62, 0.42, 1.00],   // Gateway          violet
  [1.00, 0.36, 0.82],   // Open wide        magenta
  [1.00, 0.64, 0.26],   // Take me through  amber
  [1.00, 0.99, 0.96]    // Into the light   white
];

/* The corridor's build, path and last colour — EXPORTED, because S11 keeps
 * drawing this same tunnel for its first two bars while the islands come into
 * focus behind it. Same contract as the three morphs before it: one spec, one
 * path, one colour.
 *
 * travel() is defined past T1 as well, where it runs on out of the scene —
 * which is exactly what the islands evaluate. The last hook colour is the one
 * the corridor is wearing when the cut happens, so that is the one to leave
 * with. */
export const THIRD_TUNNEL = { count: 240, radius: 16, perBeat: 6, streaks: 5600, mist: 3800 };
export const THIRD_CZ = HOOK_COLOURS[HOOK_COLOURS.length - 1];
export function thirdPath(tl){
  const span = tl.scene('S10') || { t: tl.timeOfBar(88), tEnd: tl.timeOfBar(94) };
  const T0 = span.t, D = span.tEnd - span.t;
  const V0 = 430, acc = (1000 - V0)/D;
  return {
    T0,
    travel: (t) => { const u = t - T0; return V0*u + 0.5*acc*u*u; },
    speed:  (t) => V0 + acc*(t - T0)
  };
}

export class ThirdPassageScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S10') || { t: tl.timeOfBar(88), tEnd: tl.timeOfBar(94) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.tTight = tl.timeOfBar(91);          // 'Take me through' — the second shot

    /* Linear speed ramp, and therefore a closed-form distance: the integral of
       V0 + a*u is V0*u + a*u^2/2, which frame 900 can evaluate without frame
       899 ever having run. Every tunnel scene in this film does it this way
       and none of them accumulates. */
    const V0 = 430, V1 = 1000, D = this.T1 - this.T0;
    this.v0 = V0; this.acc = (V1 - V0)/D; this.D = D;
    this.travel = (t) => { const u = t - this.T0; return V0*u + 0.5*this.acc*u*u; };
    this.speed  = (t) => V0 + this.acc*(t - this.T0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 16/9, 0.1, 3000);
    /* Shorter rings and more of them per beat than S4's: at this speed S4's
       spacing would put the arcs so far apart that the tunnel reads as a row
       of separate hoops rather than as a passage. Radius down as well — this
       one is tighter than the first gateway, which is most of why it feels
       faster at a speed the eye cannot actually measure. */
    this.tunnel = new Tunnel(THIRD_TUNNEL);
    this.scene.add(this.tunnel.group);

    /* The cues, read out of the timeline. Four of them land inside this scene
       and each one repaints the tunnel; the last is the exit. */
    const cues = (tl.d.lyrics || []).filter(c => c.t >= this.T0 && c.t < this.T1);
    this.keys = cues.map((c, i) => ({
      t: c.t, c: new THREE.Color(...HOOK_COLOURS[Math.min(i, HOOK_COLOURS.length - 1)])
    }));
    if (!this.keys.length) this.keys = [{ t: this.T0, c: new THREE.Color(...HOOK_COLOURS[0]) }];
    this.tOut = this.keys[this.keys.length - 1].t;

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

  /** The hook colour, held from each cue and snapped to the next. Snapped
      rather than crossfaded, unlike S6: a shout is an event, and a colour that
      eases into place over half a second is a colour nobody heard arrive. */
  colourAt(t){
    let k = this.keys[0];
    for (const key of this.keys) if (t >= key.t - 0.02) k = key;
    return this._col.copy(k.c);
  }

  /** The accent, never the same hue as the lead — same construction as S4 and
      S6, so all three passages share a look without sharing a constant. */
  colour2At(){
    this._col.getHSL(this._hsl);
    return this._colB.setHSL((this._hsl.h + 0.46) % 1,
      Math.min(1, this._hsl.s*0.92 + 0.20), Math.min(1, this._hsl.l*0.85 + 0.12));
  }

  update(t, post){
    const tl = this.tl;
    const y = this.travel(t);
    const v = this.speed(t);
    const p = Math.min(1, Math.max(0, (t - this.T0)/this.D));
    const colour = this.colourAt(t);
    const colour2 = this.colour2At();

    // ---- camera --------------------------------------------------------------
    /* Wandering from the first frame, never settling — see the note at the top.
       Two sines at incommensurate rates, both pure functions of t, so the axis
       never repeats inside the scene and never accumulates. */
    const bar = tl.bar(t);
    const az = bar*0.09;
    const tilt = 0.24 + 0.11*Math.sin(t*1.21) + 0.06*Math.sin(t*2.87 + 0.9);
    this._dir.set(Math.sin(tilt)*Math.sin(az), Math.cos(tilt), Math.sin(tilt)*Math.cos(az)).normalize();
    this._ref.set(0, 1, 0);
    if (Math.abs(this._dir.y) > 0.985) this._ref.set(0, 0, 1);
    this._right.crossVectors(this._dir, this._ref).normalize();
    this._up.crossVectors(this._right, this._dir).normalize();
    /* Roll off distance travelled, as in S4 and S6, so it speeds up exactly as
       the tunnel does without a second curve to keep in step. */
    const roll = y*0.0016;
    this._q.setFromAxisAngle(this._dir, roll);
    this._up.applyQuaternion(this._q);

    const fov = 74 + 8*p;
    if (Math.abs(this.camera.fov - fov) > 1e-4){
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(0, y, 0);
    this.camera.up.copy(this._up);
    this._tgt.copy(this.camera.position).add(this._dir);
    this.camera.lookAt(this._tgt);

    // ---- the tunnel ----------------------------------------------------------
    /* Bright from the first frame. There is no formation envelope here at all,
       which is the point: S6 has one because it is assembling out of nothing,
       and this scene is explicitly not doing that. */
    const brightness = 1.0;
    /* Rising from bar 91 — 'faster, tighter rings' — and small even at the
       end. Warp is what S15 will open all the way; here it is a texture on a
       tunnel that still works. */
    const tight = Math.min(1, Math.max(0, (t - this.tTight)/(this.T1 - this.tTight)));
    this.tunnel.update(t, {
      travel: this.travel, speed: v,
      beat0: tl.origin, beat: tl.beat,
      colour, colour2,
      px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
      mist: 0.75 + 0.25*tight,
      floorY: -1e9,
      brightness,
      /* The exit. Held to a pinprick until the last cue and then opened —
         same shape S4 and S6 both use, and for the same reason: a core term
         is far more effective per unit of opacity than it looks, and left up
         through a whole scene it fills the frame with a flat dome. */
      core: 0.006 + 0.60*Math.pow(Math.min(1, Math.max(0, (t - this.tOut)/Math.max(this.T1 - this.tOut, 1e-3))), 2),
      warp: 0.22*tight
    });

    // ---- grade ---------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;
    /* Each shout is a hit: a short decaying flash on the cue itself rather
       than a pulse on the beat grid, which the film's own rules reserve for
       things that are already local and already moving. */
    let hit = 0;
    /* Causal — see Timeline.hit(). A flash that begins before its own cue is
       a picture reacting to something that has not happened. */
    for (const k of this.keys) hit = Math.max(hit, tl.hit(t, k.t, 7.0));

    /* And the hit is spent where light can come FROM something.
 
       uFlash was 0.26 here, and uFlash is `col += uFlash` in the composite: a
       flat constant added to every pixel before the exposure, before the
       tonemap and before the gamma. This corridor is very nearly black, so on
       each of its three cues the whole frame went to a uniform light grey with
       the rings barely visible inside it — measured mean 0.60 to 0.68 with the
       5th and 95th percentiles fourteen per cent apart, which is a grey card
       and not a picture. The arithmetic accounts for all of it: 0.26 through
       this scene's own exposure, lift, gain, ACES and 1/2.2 predicts 0.684 and
       the frame at 151.37 measures 0.683.
 
       This is what 'pestyt vaaleat käytäväruudut' was, in S8 and here, and
       neither was ever found because both scenes were tuned on the tunnel
       instead of on the one line above it. S17 had already written the rule
       down: a flat lift over every pixel reads as a global brightening, and
       the fix is to make the light come from somewhere.
 
       So the hit is an exposure and a bloom. Both are multiplicative — they
       can only brighten a pixel that already has something in it — so the
       rings flare and the void behind them stays a void.
 
       And the flat term goes to zero rather than to a small number, because
       uFlash HAS no small numbers on a black frame. It is added in linear
       light and the composite ends in 1/2.2, so the gamma pulls the bottom of
       the range apart: 0.05 comes out at 0.26, 0.02 at 0.17, 0.01 at 0.12.
       Left at a twentieth 'as a trace of veil' this scene still measured a
       0.287 floor across the whole frame. There is no setting of it that
       veils gently; it either is not there or it is a card. */
    c.uExposure.value = 1.02 + 0.30*p + 0.34*hit;
    c.uBloom.value    = 0.42 + 0.26*tight + 0.55*hit;
    c.uCA.value       = 0.0026 + 0.0038*tight + 0.0030*hit;
    c.uVignette.value = 0.76 + 0.10*p;
    c.uGrain.value    = 0.036;
    c.uLift.value.setRGB(0.006, 0.006, 0.014);
    c.uGain.value.setRGB(1.02, 0.99, 1.03);
    c.uFlash.value    = 0.0;

    d.uStart.value = 90 - 30*tight;
    d.uEnd.value   = 520 - 140*tight;
    d.uMaxRadius.value = 2.0 + 1.4*tight;
  }

  debugLayers(){ return { tunnel: this.tunnel.group }; }

  dispose(){ this.tunnel.dispose(); }
}
