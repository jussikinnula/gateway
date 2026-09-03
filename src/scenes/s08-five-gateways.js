import * as THREE from 'three';
import { Tunnel } from '../env/tunnel.js';
import { makeWorlds, drawWorld } from './worlds.js';

/* S8 — Five gateways.  Bars 77–79.
 *
 * 'The five Gateway shouts are five passages. We go through all of them and
 * arrive nowhere good.' And, from the tech note: 'This is the shot the whole
 * analysis was for.'
 *
 * Three bars, five seconds, five cuts, and every one of them is on a measured
 * cue — 77.69, 78.36, 78.74, 79.11, 79.49, which the analysis calls a
 * 1.5-beat pulse. Nothing here is on the bar grid and nothing is eased: the
 * scene is a membrane, five interruptions, and the membrane again.
 *
 * What is between the flashes matters as much as the flashes. It is the
 * tunnel — briefly, tightly, and going nowhere — because the alternative
 * (black, or one of the worlds held) makes the five shouts read as five cuts
 * in a sequence rather than as five doors in a corridor. 'None of them is
 * entered' is the line, and the way to stage that is for the corridor to
 * still be there afterwards each time.
 *
 * The flashes are longer than S12's two frames and much shorter than a shot:
 * see FLASH_DUR. Long enough to see what is behind the door, short enough
 * that seeing it is not the same as going through it.
 */

/* Six frames at 60. The count is exact at every phase for the same reason
 * S12's two are — the frames inside [c, c + D) number ceil(60c + 60D) -
 * ceil(60c), which for 60D = 6 is 6 whatever the cue's phase against the grid.
 * Six is a tenth of a second: comfortably visible, and still less than a third
 * of the gap between two of these shouts. */
const FLASH_DUR = 6/60;

/* One world per shout, and the order is the film's own so far — where the
 * traveller has been, in sequence, with the desert at the end as the one place
 * he has not. The fifth door showing a world the film has not reached is the
 * 'nowhere good' the shot list is after: four doors onto the past and one onto
 * something that has not happened. */
const DOORS = ['jungle', 'volcanic', 'dark', 'islands', 'desert'];

/* The corridor's build, its path and its colour — EXPORTED, because S7 draws
 * this same tunnel for the last two bars before the cut. Same contract as the
 * first two passages: one spec, one path, one colour, or bar 77 swaps a tunnel
 * for a different tunnel that looks a bit like it.
 *
 * travel() is defined for t < T0, where it runs backwards out of the scene —
 * which is exactly what the volcanic plain evaluates. */
export const GATEWAY_TUNNEL = { count: 210, radius: 21, perBeat: 4, streaks: 4200, mist: 3000 };
export const GATEWAY_C0 = [0.62, 0.42, 1.00];
export function gatewayPath(tl){
  const span = tl.scene('S8') || { t: tl.timeOfBar(77), tEnd: tl.timeOfBar(80) };
  const T0 = span.t, D = span.tEnd - span.t;
  const V0 = 260, acc = (520 - V0)/D;
  return {
    T0,
    travel: (t) => { const u = t - T0; return V0*u + 0.5*acc*u*u; },
    speed:  (t) => V0 + acc*(t - T0)
  };
}

export class FiveGatewaysScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S8') || { t: tl.timeOfBar(77), tEnd: tl.timeOfBar(80) };
    this.T0 = span.t; this.T1 = span.tEnd;

    /* The five cues, read out of the timeline. If the analysis moves, this
       moves with it — 'no timing is hard-coded in a scene file'. */
    const cues = (tl.d.lyrics || [])
      .filter(c => c.t >= this.T0 - 0.05 && c.t < this.T1)
      .map(c => c.t).sort((a, b) => a - b);
    this.cues = cues.length >= 5 ? cues.slice(0, 5)
      : [77.69, 78.36, 78.74, 79.11, 79.49].map(b => tl.timeOfBar(b));

    this.worlds = makeWorlds(tl, DOORS);

    /* The corridor. Fast, tight and short — this is three bars of tunnel that
       nobody is meant to look at, and its whole job is to be the thing the
       doors interrupt. */
    this._scene = new THREE.Scene();
    this._cam = new THREE.PerspectiveCamera(78, 16/9, 0.1, 3000);
    this.tunnel = new Tunnel(GATEWAY_TUNNEL);
    this._scene.add(this.tunnel.group);
    this.scene = this._scene;
    this.camera = this._cam;

    /* Much slower than the first pass's 700-1250. At that speed with a
       fourteen-unit radius the rings were past the lens before they were
       drawn and all that was left was the mist, which filled the frame with a
       flat pale grey — a corridor with no walls in it. The doors need
       something to be doors IN. */
    const V0 = 260, V1 = 520, D = this.T1 - this.T0;
    this.v0 = V0; this.acc = (V1 - V0)/D; this.D = D;
    this.travel = (t) => { const u = t - this.T0; return V0*u + 0.5*this.acc*u*u; };
    this.speed  = (t) => V0 + this.acc*(t - this.T0);

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

  /** Which door, if any, this instant is inside. -1 for the corridor. */
  doorAt(t){
    for (let i = 0; i < this.cues.length; i++){
      if (t >= this.cues[i] && t < this.cues[i] + FLASH_DUR) return i;
    }
    return -1;
  }

  update(t, post){
    const tl = this.tl;

    // ---- the doors -----------------------------------------------------------
    const di = this.doorAt(t);
    if (di >= 0 && di < this.worlds.length){
      const out = drawWorld(this.worlds[di], post, this._cam.aspect, 0, 0, t);
      this.scene = out.scene;
      this.camera = out.camera;
      this.refractScene = out.refractScene;
      /* The world grades itself, and then this puts a hard white edge on the
         first frames of it — a door opening is an exposure change, and
         without one the cut reads as an edit rather than as a threshold. */
      const k = 1 - (t - this.cues[di])/FLASH_DUR;
      /* Small. 0.45 here washed the world behind the door to white — the
         point is to see what is through it, and an exposure change big enough
         to read as a threshold is much smaller than one that erases the
         thing it is a threshold to.
 
         Smaller again, and most of it moved into the bloom for the reason the
         afterimage below records: 0.16 flat is a 49 % grey floor over every
         dark part of the world behind the door, which is a fog between the
         viewer and the thing the door was opened to show. Bloom cannot do
         that — it only brightens what is already lit — so the threshold now
         blows out the sky and the lava and the light through the leaves, and
         leaves their shadows alone.
 
         To zero, not to a small number: uFlash is added in linear light before
         a 1/2.2, so the gamma pulls the bottom of its range wide open and even
         a sixteenth still laid a 0.18 floor over the jungle's shadows. See
         S10's note — it has no gentle setting. */
      post.qComp.u.uFlash.value += 0.0;
      post.qComp.u.uBloom.value += 0.55*k;
      return;
    }
    this.scene = this._scene;
    this.camera = this._cam;
    this.refractScene = undefined;

    // ---- the corridor --------------------------------------------------------
    const y = this.travel(t);
    const v = this.speed(t);
    const p = Math.min(1, Math.max(0, (t - this.T0)/this.D));

    /* Violet, and it does not change. Every other passage in this film moves
       its colour across the scene; this one is three bars long and has five
       interruptions in it, so a colour that also travelled would be a sixth
       thing happening. */
    const colour = this._col.setRGB(...GATEWAY_C0);
    this._col.getHSL(this._hsl);
    const colour2 = this._colB.setHSL((this._hsl.h + 0.46) % 1,
      Math.min(1, this._hsl.s*0.92 + 0.20), Math.min(1, this._hsl.l*0.85 + 0.12));

    const bar = tl.bar(t);
    const az = bar*0.14;
    const tilt = 0.26 + 0.10*Math.sin(t*1.7);
    this._dir.set(Math.sin(tilt)*Math.sin(az), Math.cos(tilt), Math.sin(tilt)*Math.cos(az)).normalize();
    this._ref.set(0, 1, 0);
    if (Math.abs(this._dir.y) > 0.985) this._ref.set(0, 0, 1);
    this._right.crossVectors(this._dir, this._ref).normalize();
    this._up.crossVectors(this._right, this._dir).normalize();
    this._q.setFromAxisAngle(this._dir, y*0.0022);
    this._up.applyQuaternion(this._q);
    this._cam.position.set(0, y, 0);
    this._cam.up.copy(this._up);
    this._tgt.copy(this._cam.position).add(this._dir);
    this._cam.lookAt(this._tgt);

    this.tunnel.update(t, {
      travel: this.travel, speed: v,
      beat0: tl.origin, beat: tl.beat,
      colour, colour2,
      px: 0.5*post.dofTarget.height/Math.tan(this._cam.fov*Math.PI/360),
      mist: 0.20, floorY: -1e9, brightness: 0.55,
      /* Never opens. Five doors have already opened in this scene and none of
         them was this one. */
      core: 0.005,
      warp: 0.18
    });

    // ---- grade ---------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;
    /* The corridor darkens after each door rather than before it — an
       afterimage, the same idea S12 uses, and here it is what keeps five
       flashes in five seconds from reading as a strobe.
 
       THAT IS WHAT THE COMMENT SAID AND THE OPPOSITE OF WHAT THE CODE DID.
       All three of exposure, bloom and flash went UP after every door, and the
       third of them was the damage: uFlash is `col += uFlash` in the composite
       — a flat constant added to every pixel in the frame, before the exposure,
       before the tonemap and before the gamma. On a corridor that is very
       nearly black between the doors, 0.18*after does not brighten anything;
       it REPLACES the picture with a grey card and leaves the membrane faintly
       visible inside it.
 
       It is arithmetic, not an impression. At 0.267 of `after` the flat term
       is 0.048; through this scene's own exposure and lift and the ACES curve
       and 1/2.2 that lands at 0.2425, and the measured mean of those frames is
       0.245 with a 95th percentile of 0.276 — a frame with no structure in it
       at all. And it happens for 0.35 s after each of five doors, which is
       1.75 s of a five-second scene: thirty-five per cent of S8 was a grey
       card. That is the whole of the note 'S8:n käytävä on kirkkaampi kuin
       muiden tunneliscenejen' — it is not brighter, it is washed.
 
       S17 has already been through this and its comment is the precedent:
       spend the light where it comes FROM something. So the afterimage is now
       what an afterimage is — the eye's gain drops and the glow of the thing
       that blinded it lingers. Exposure goes DOWN and recovers; bloom goes up,
       which can only brighten pixels that already have something in them, so
       what lingers is the membrane and not the void around it. */
    let after = 0;
    for (const ct of this.cues){
      const dt = t - (ct + FLASH_DUR);
      if (dt >= 0 && dt < 0.35) after = Math.max(after, Math.exp(-dt*11.0));
    }
    c.uExposure.value = 0.78 + 0.16*p - 0.30*after;
    c.uBloom.value    = 0.40 + 0.55*after;
    c.uCA.value       = 0.0030 + 0.0040*after;
    c.uVignette.value = 0.84;
    c.uGrain.value    = 0.038;
    c.uLift.value.setRGB(0.008, 0.004, 0.016);
    c.uGain.value.setRGB(1.00, 0.97, 1.06);
    /* And never a flat lift on a black corridor. See above. */
    c.uFlash.value    = 0.0;

    d.uStart.value = 80;
    d.uEnd.value   = 460;
    d.uMaxRadius.value = 2.6;
  }

  debugLayers(){ return { tunnel: this.tunnel.group }; }

  dispose(){
    this.tunnel.dispose();
    for (const w of this.worlds) if (w.scene.dispose) w.scene.dispose();
  }
}
