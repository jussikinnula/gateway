import * as THREE from 'three';
import { Tunnel } from '../env/tunnel.js';

/* S15 — Last passage.  Bars 144–149.
 *
 * 'The last gateway does not work properly. The rings are not concentric any
 * more.'
 *
 * Every other passage in this film is a tunnel the camera is inside. This one
 * is a tunnel the camera is inside BY ACCIDENT, and the whole scene is that one
 * difference stated three ways:
 *
 *   The rings come off the axis. Tunnel.js's `warp` displaces each ring
 *   sideways and tilts it, and every other scene keeps it near zero — S6 tops
 *   out at 0.75 and calls that 'a ride coming apart'. This one starts where S6
 *   ends and goes past 1.6, which is far enough that consecutive rings no
 *   longer share a centre at all. That is the shot list's own sentence, made
 *   out of the one uniform that already existed for it.
 *
 *   The camera is not on the tunnel's axis either. 'On an axis that is not the
 *   tunnel's' — so the position is offset from the centreline by a slow wander
 *   rather than sitting at x = z = 0 like every previous passage, and the look
 *   direction is not the direction of travel. The rings therefore pass at an
 *   angle and off-centre, which is what being in the wrong place inside a
 *   tunnel actually looks like.
 *
 *   The roll reverses. Bars 147-149, per the shot list. Roll everywhere else
 *   in the film is driven by distance travelled and therefore only ever
 *   increases; reversing it needs the sign to change while the distance keeps
 *   climbing, so what turns over here is not the ride, it is the ride's
 *   relationship to the camera — which is worse.
 *
 * The perturbation follows measured energy rather than an authored ramp: the
 * shot list asks for that by name, and it is also the difference between rings
 * that tear because the track is tearing and rings that tear on a curve
 * somebody drew.
 */

export class LastPassageScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S15') || { t: tl.timeOfBar(144), tEnd: tl.timeOfBar(150) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.tWorse = tl.timeOfBar(147);         // 'Worse' — where the roll reverses

    const V0 = 520, V1 = 940, D = this.T1 - this.T0;
    this.v0 = V0; this.acc = (V1 - V0)/D; this.D = D;
    this.travel = (t) => { const u = t - this.T0; return V0*u + 0.5*this.acc*u*u; };
    this.speed  = (t) => V0 + this.acc*(t - this.T0);

    /* The energy band this scene's damage follows, min-max normalised across
       its own six bars and read once — the same construction S6 uses for its
       formation, and for the same reason: a raw band is a number whose range
       depends on the whole track, and what this needs is where the loudest and
       quietest moments of THESE bars sit. */
    let lo = Infinity, hi = -Infinity;
    for (const b of (tl.d.bars || [])){
      if (b.bar >= 144 && b.bar < 150){ lo = Math.min(lo, b.rms); hi = Math.max(hi, b.rms); }
    }
    this._lo = Number.isFinite(lo) ? lo : 0;
    this._hi = Number.isFinite(hi) && hi > lo ? hi : this._lo + 1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(76, 16/9, 0.1, 3000);
    /* Wider than S10's and with fewer rings per beat: a tunnel whose rings are
       no longer concentric needs space between them to read as broken rather
       than as noise. */
    this.tunnel = new Tunnel({ count: 230, radius: 24, perBeat: 4, streaks: 5000, mist: 4400 });
    this.scene.add(this.tunnel.group);

    /* 'Gateway' at bar 144.00, exactly on the downbeat — the cut is on it. */
    const cues = (tl.d.lyrics || []).filter(c => c.t >= this.T0 && c.t < this.T1);
    this.cues = cues.map(c => c.t);

    this._col = new THREE.Color();
    this._colB = new THREE.Color();
    this._pos = new THREE.Vector3();
    this._tgt = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._ref = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._hsl = { h: 0, s: 0, l: 0 };
  }

  /** Measured RMS, normalised across this scene alone. */
  energy(t){
    const raw = this.tl.energy(t, 'rms');
    return Math.min(1, Math.max(0, (raw - this._lo)/(this._hi - this._lo)));
  }

  /** Hot and sour, and drifting further that way — the film has spent its
      beautiful gateway colours by now. Starts near S10's amber and ends on a
      red that no working passage in this film has used. */
  colourAt(t){
    const p = Math.min(1, Math.max(0, (t - this.T0)/this.D));
    return this._col.setRGB(1.00, 0.52 - 0.34*p, 0.20 - 0.14*p);
  }

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
    const e = this.energy(t);
    /* 0 through the first shot, 0-1 across 'Worse'. */
    const worse = Math.min(1, Math.max(0, (t - this.tWorse)/(this.T1 - this.tWorse)));
    const colour = this.colourAt(t);
    const colour2 = this.colour2At();

    // ---- camera --------------------------------------------------------------
    /* OFF the axis, which no other passage in this film is. The offset is a
       pair of slow sines at incommensurate rates, so the camera drifts across
       the tunnel's centreline without ever settling on it or orbiting it. */
    const offR = 5.0 + 9.0*worse;
    const ox = offR*Math.sin(t*0.77 + 0.4);
    const oz = offR*Math.sin(t*0.53 + 2.1);
    this._pos.set(ox, y, oz);

    /* And looking somewhere that is not where it is going. The tilt is larger
       than any working passage uses, and it grows: by the last bar the tunnel
       is arriving from noticeably off to one side. */
    const bar = tl.bar(t);
    const az = bar*0.14;
    const tilt = 0.30 + (0.14 + 0.16*worse)*Math.sin(t*1.07) + 0.08*Math.sin(t*2.53 + 1.3);
    this._dir.set(Math.sin(tilt)*Math.sin(az), Math.cos(tilt), Math.sin(tilt)*Math.cos(az)).normalize();
    this._ref.set(0, 1, 0);
    if (Math.abs(this._dir.y) > 0.985) this._ref.set(0, 0, 1);
    this._right.crossVectors(this._dir, this._ref).normalize();
    this._up.crossVectors(this._right, this._dir).normalize();

    /* The reversal. Roll is distance-driven and therefore monotonic like every
       other passage's, right up to bar 147, where a second term of the
       opposite sign grows faster than the first and takes the total back the
       other way. Written as a sum rather than as a sign flip on purpose: a
       flipped sign is a discontinuity, and this has to turn over rather than
       snap. */
    const roll = y*0.0015 - worse*worse*y*0.0034 + e*0.30*Math.sin(t*11.3);
    this._q.setFromAxisAngle(this._dir, roll);
    this._up.applyQuaternion(this._q);

    const fov = 76 + 12*worse;
    if (Math.abs(this.camera.fov - fov) > 1e-4){
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }
    this.camera.position.copy(this._pos);
    this.camera.up.copy(this._up);
    this._tgt.copy(this._pos).add(this._dir);
    this.camera.lookAt(this._tgt);

    // ---- the tunnel ----------------------------------------------------------
    /* The damage. A floor that rises across the scene so the rings are already
       wrong at the cut, plus the measured band on top of it — so the tearing
       has a shape the track gave it rather than one drawn onto it. S6's own
       ceiling was 0.75; this starts near there and ends past twice it. */
    const warp = 0.55 + 0.75*worse + 0.45*e;
    this.tunnel.update(t, {
      travel: this.travel, speed: v,
      beat0: tl.origin, beat: tl.beat,
      colour, colour2,
      px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
      mist: 0.85 + 0.15*e,
      floorY: -1e9,
      brightness: 0.80 + 0.45*e,
      /* No opening. Every other passage ends by opening its core into the next
         world; this one hands off to S16, which is where the light finally
         is. Holding it shut is the scene's last statement — the gateway does
         not work. */
      core: 0.004,
      warp
    });

    // ---- grade ---------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;
    let hit = 0;
    /* Causal — see Timeline.hit(). */
    for (const ct of this.cues) hit = Math.max(hit, this.tl.hit(t, ct, 7.5));

    /* The hit, spent multiplicatively — same fault and same fix as S10, which
       has the long note. This one is milder in intent because its single cue
       is on the cut out of S14, where a flash is a transition and not an
       accident; but it was 0.30 flat, which put a 0.72 grey card over the
       first quarter-second of the scene, and a transition that erases the
       corridor is a transition to nothing. Kept as a flare on the rings, and
       the flat term goes to zero rather than small — see S10's note on why
       uFlash has no small settings on a dark frame. */
    c.uExposure.value = 0.98 + 0.22*e + 0.30*hit;
    c.uBloom.value    = 0.34 + 0.30*e + 0.22*worse + 0.45*hit;
    /* The chromatic split is a lens artefact everywhere else in this film and
       a signal here — uSplit is flat and large where uCA is radial and small,
       so it reads as the picture itself failing to register rather than as
       glass. Held at zero until the rings start tearing. */
    c.uCA.value       = 0.0030 + 0.0050*worse;
    c.uSplit.value    = 0.0016*worse*(0.4 + 0.6*e);
    c.uVignette.value = 0.78 + 0.14*worse;
    c.uGrain.value    = 0.042 + 0.030*worse;
    c.uLift.value.setRGB(0.012, 0.004, 0.004);
    c.uGain.value.setRGB(1.06, 0.95, 0.92);
    c.uFlash.value    = 0.0;

    d.uStart.value = 80 - 30*worse;
    d.uEnd.value   = 500 - 180*worse;
    d.uMaxRadius.value = 2.4 + 2.0*worse;
  }

  debugLayers(){ return { tunnel: this.tunnel.group }; }

  dispose(){ this.tunnel.dispose(); }
}
