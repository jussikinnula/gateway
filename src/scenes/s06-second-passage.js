import * as THREE from 'three';
import { Tunnel } from '../env/tunnel.js';

/* S6 — Second passage.  Bars 62–69.
 *
 * The first gateway had a threshold: a surface to break, a membrane that let
 * light through before it let us through. This one does not. There is no
 * water here — the jungle simply stops holding together and the tunnel is
 * what is left. So the scene is the S4 tunnel with the membrane pass removed
 * and nothing put in its place; the doorway is missing on purpose.
 *
 * Two things carry the difference from S4 rather than any new geometry:
 *
 *   Ring visibility is not authored, it is measured. `formAmt` below is the
 *   air band's own value, min–max normalised across this scene's eight bars
 *   and floored so the tunnel is dim rather than gone at its low points. Bars
 *   62–65 sit low and uneven in that band — the tunnel visibly gutters rather
 *   than opening cleanly — and 66–69 is where the air band actually climbs,
 *   which is the literal riser the shot list calls for under 'Rush'. Nothing
 *   here is an eased curve pretending to be the music; it is the music.
 *
 *   `warp` (0 at bar 62, past S4's own ceiling by the last bar) feeds the
 *   tunnel's own jag and tumble terms — the same knob S4 leaves at zero. The
 *   rings were never conic sections here, only closer to one early on.
 *
 * Colour drifts rather than cuts. It starts at (0.42, 0.86, 1.00) — the exact
 * value S5's drain fades toward — so the hard cut from the jungle lands on a
 * colour the previous scene was already leaning on, and ends hot: less
 * beautiful than the first passage was asked to be, and a colour the film has
 * not shown yet.
 *
 * Speed is a closed form, p^1.6 rather than S4's p^1: slower to leave the
 * start than a straight ramp and steeper into the last bar, so the same
 * curve reads as 'forms' early and 'Rush' late without being two curves.
 */

const APPROACH = [0.42, 0.86, 1.00];   // where S5's drain and S4's own start both sit
const ROUGH    = [1.00, 0.30, 0.09];   // where this one ends: hot, not blue

/* The tunnel's build, its path and the colour it wears at the start — all
 * EXPORTED, because S5 draws this same tunnel for the last two bars before the
 * cut. The reasoning is the one s01-under.js records for the first passage:
 * two tunnels that are meant to be one tunnel have to come from one spec and
 * one path, or the cut swaps a tunnel for a different tunnel that looks a bit
 * like it, and that is the tell.
 *
 * travel() is defined for t < T0 as well — it runs backwards out of the scene,
 * which is exactly what the jungle evaluates. */
export const SECOND_TUNNEL = { count: 260, radius: 18, perBeat: 4, streaks: 6200, mist: 3400 };
export function secondPath(tl){
  const span = tl.scene('S6') || { t: tl.timeOfBar(62), tEnd: tl.timeOfBar(70) };
  const T0 = span.t, D = span.tEnd - span.t;
  const V0 = 20, dV = 760 - 20;
  return {
    T0,
    travel: (t) => { const u = t - T0, p = Math.min(1, Math.max(0, u/D));
                     return V0*u + dV*D*Math.pow(p, 2.6)/2.6; },
    speed:  (t) => { const p = Math.min(1, Math.max(0, (t - T0)/D));
                     return V0 + dV*Math.pow(p, 1.6); }
  };
}
export const SECOND_C0 = APPROACH;

export class SecondPassageScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S6') || { t: tl.timeOfBar(62), tEnd: tl.timeOfBar(70) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.tRush = tl.timeOfBar(66);

    /* Distance is the closed-form integral of speed = V0 + (V1-V0)*p^1.6,
       p = (t-T0)/D. Elementary because the exponent on p carries through the
       integral unchanged: ∫p^1.6 dp = p^2.6/2.6. Nothing here accumulates —
       frame 900 does not need frame 899. */
    const V0 = 20, V1 = 760, D = this.T1 - this.T0;
    this.V0 = V0; this.dV = V1 - V0; this.D = D;
    this.travel = (t) => {
      const u = Math.max(0, t - this.T0), p = Math.min(1, u/D);
      return V0*u + this.dV*D*Math.pow(p, 2.6)/2.6;
    };
    this.speed = (t) => {
      const p = Math.min(1, Math.max(0, (t - this.T0)/D));
      return V0 + this.dV*Math.pow(p, 1.6);
    };

    /* The air band's own range across bars 62–69, read once from the measured
       data and never touched again — a constant like S1's VEND, not a value
       recomputed per frame. */
    let lo = Infinity, hi = -Infinity;
    for (const b of (tl.d.bars || [])){
      if (b.bar >= 62 && b.bar < 70){ lo = Math.min(lo, b.air); hi = Math.max(hi, b.air); }
    }
    this._airLo = Number.isFinite(lo) ? lo : 0;
    this._airHi = Number.isFinite(hi) && hi > lo ? hi : this._airLo + 1;

    /* 'Keep moving.' — the only lyric in the scene, and the last thing before
       the drop. Read out of the timeline rather than hand-timed. */
    const km = (tl.d.lyrics || []).find(c => /keep moving/i.test(c.text || ''));
    this.tKeep = km ? km.t : tl.timeOfBar(69.61);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 16/9, 0.1, 3000);
    /* Slightly tighter and faster-spiralling than S4's tunnel — this one was
       never built to be lived in. */
    this.tunnel = new Tunnel(SECOND_TUNNEL);
    this.scene.add(this.tunnel.group);

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

  /** The tunnel's own colour, drifting from S5's hand-off blue to a hot
      amber-red across the whole scene — no cue drives it, the shot does. */
  colourAt(t){
    if (!this._colA){ this._colA = new THREE.Color(...APPROACH); this._colZ = new THREE.Color(...ROUGH); }
    const p = Math.min(1, Math.max(0, (t - this.T0)/this.D));
    const e = p*p*(3 - 2*p);
    return this._col.copy(this._colA).lerp(this._colZ, e);
  }

  /** The accent — never the same hue as the lead, same technique as S4. */
  colour2At(){
    this._col.getHSL(this._hsl);
    return this._colB.setHSL((this._hsl.h + 0.46) % 1,
      Math.min(1, this._hsl.s*0.92 + 0.20), Math.min(1, this._hsl.l*0.85 + 0.12));
  }

  /** The air band, min–max normalised across this scene — the texture on top
      of the formation, not the formation itself: bars 62–65 sit low and
      uneven in it, which is right for a tunnel guttering into existence, but
      left alone it never reads as *nothing* at the cut from S5, only as dim.
      See formEnv() for the envelope that actually does that. */
  formAmt(t){
    const raw = this.tl.energy(t, 'air');
    const n = Math.min(1, Math.max(0, (raw - this._airLo)/(this._airHi - this._airLo)));
    return n;
  }

  /** 0 at the cut, 1 by bar 66 — the rings assembling out of nothing rather
      than arriving already lit. A small floor rather than a true zero: a
      single fully black frame at the exact cut instant would read as a
      dropped frame, not a choice. */
  formEnv(t){
    const k = Math.min(1, Math.max(0, (t - this.T0)/(this.tRush - this.T0)));
    const e = k*k*(3 - 2*k);
    return 0.04 + 0.96*e;
  }

  update(t, post){
    const tl = this.tl;
    const bar = tl.bar(t);
    const y = this.travel(t);
    const v = this.speed(t);
    const form = this.formAmt(t);
    const p = Math.min(1, Math.max(0, (t - this.T0)/this.D));

    const colour = this.colourAt(t);
    const colour2 = this.colour2At();

    // ---- camera --------------------------------------------------------------
    /* No threshold means no eased-to-vertical settle either. The axis wanders
       the whole way through on a couple of slow sines — pure functions of t,
       nothing accumulated — so the ride never quite steadies the way S4's
       does after its first two bars. */
    const az = bar*0.052;
    const tilt = 0.30 + 0.09*Math.sin(t*0.83) + 0.05*Math.sin(t*2.31 + 1.7);
    this._dir.set(Math.sin(tilt)*Math.sin(az), Math.cos(tilt), Math.sin(tilt)*Math.cos(az)).normalize();
    this._ref.set(0, 1, 0);
    if (Math.abs(this._dir.y) > 0.985) this._ref.set(0, 0, 1);
    this._right.crossVectors(this._dir, this._ref).normalize();
    this._up.crossVectors(this._right, this._dir).normalize();
    /* Roll follows distance travelled, same as S4, at closer to twice the
       rate — and gains a fast, small jitter as warp rises, so the last bars
       read as a ride coming apart rather than just a faster clean spin. */
    const warp = Math.min(1, Math.max(0, (p - 0.15)/0.85));
    const roll = y*0.0018 + warp*0.35*Math.sin(t*9.7);
    this._q.setFromAxisAngle(this._dir, roll);
    this._up.applyQuaternion(this._q);

    const fov = 68 + 10*p;
    if (Math.abs(this.camera.fov - fov) > 1e-4){
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(0, y, 0);
    this.camera.up.copy(this._up);
    this._tgt.copy(this.camera.position).add(this._dir);
    this.camera.lookAt(this._tgt);

    // ---- the tunnel ------------------------------------------------------------
    const env = this.formEnv(t);
    const brightness = env*(0.30 + 0.70*form);
    this.tunnel.update(t, {
      travel: this.travel, speed: v,
      beat0: tl.origin, beat: tl.beat,
      colour, colour2,
      px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
      mist: env*(0.45 + 0.55*form),
      floorY: -1e9,
      brightness,
      /* A point of light ahead. This cone is what S4 opens white with at its
         own last line, and it is far more effective per unit of opacity than
         it looks — checked directly: even 0.02-0.04 here, held constant
         through 'Rush', filled most of the frame with a flat, badly-lit dome
         long before anything should be opening (the frame is close, and
         wide). Kept under 0.005 until the last beat and a half, then let go
         hard into the drop, it stays a pinprick through the whole scene and
         only becomes the thing S4 already does: opens. */
      core: 0.004 + 0.55*Math.pow(Math.max(0, (p - 0.85)/0.15), 3),
      warp: 0.75*warp
    });

    // ---- grade -------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;
    c.uExposure.value = 0.85 + 0.55*p + 0.32*this.tl.hit(t, this.tKeep, 3.2);
    c.uBloom.value    = 0.30 + 0.35*brightness + 0.30*warp
                      + 0.45*this.tl.hit(t, this.tKeep, 3.2);
    c.uCA.value       = 0.0018 + 0.0040*warp;
    c.uVignette.value = 0.80 + 0.12*p;
    c.uGrain.value    = 0.040 + 0.024*warp;
    c.uLift.value.setRGB(0.004 + 0.006*p, 0.008, 0.020 - 0.014*p);
    c.uGain.value.setRGB(0.97 + 0.10*p, 0.99, 1.05 - 0.10*p);

    /* One pulse on 'Keep moving.', and a second rising into the drop itself —
       same shape as the pulses in S1, not a mask for anything broken, just
       the hit a drum drop is owed. */
    /* Causal — see Timeline.hit(). A pulse on a spoken line cannot begin
       before the line. */
    const arrive = Math.exp(-Math.max(0, this.T1 - t)*10.0);
    /* Only the ARRIVAL is a flat whiteout, and that one is meant to be: it
       rises into the cut and meets S4's own burst at the same peak on the
       same instant, one flash straddling a scene swap.
 
       'Keep moving.' is not that. It was 0.30 flat, which put a 0.70 grey
       card over a corridor whose own floor is 0.059 — measured 0.659 at the
       line, i.e. the tunnel simply disappeared for half a second on a spoken
       word. Moved into the exposure and the bloom above, where it flares the
       rings instead of erasing them.

       uFlash is `col += uFlash` in the composite — a constant added to every pixel in linear light, before the
       exposure and before the 1/2.2 gamma, so the gamma pulls the bottom of
       its range wide open and it has no gentle setting on a dark frame:
       0.10 comes out as a 0.41 grey over the WHOLE picture, 0.16 as 0.53,
       0.30 as 0.70. See s10-third-passage.js for the measurement that found
       this and the arithmetic that predicts it.
    */
    c.uFlash.value = 0.55*arrive;

    d.uStart.value = 100 - 40*warp;
    d.uEnd.value   = 560 - 160*warp;
    d.uMaxRadius.value = 2.2 + 1.6*warp;
  }

  dispose(){ this.tunnel.dispose(); }
}
