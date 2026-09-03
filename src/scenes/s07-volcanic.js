import * as THREE from 'three';
import { Volcanic, terrainHeightAt, HERO } from '../env/volcanic.js';
import { Tunnel, layTunnelAlong } from '../env/tunnel.js';
import { GATEWAY_TUNNEL, GATEWAY_C0, gatewayPath } from './s08-five-gateways.js';

/* S7 — Volcanic.  Bars 70–76.
 *
 * 'Beautiful in a way that wants us gone. Nothing here is at human scale.'
 *
 * Seven bars, two shots, and they are shot in opposite directions — which is
 * the whole structure:
 *
 *   70-72, 'Ash'. Wide and slow, LOOKING UP at the columns. The camera is
 *   high and the pitch is above the horizon, so the frame is mostly smoke
 *   going somewhere the shot never shows. Arrival is on the downbeat at bar
 *   70, which is the measured drop.
 *
 *   73-76, 'Don't look back'. Low and fast, embers passing the lens. The cut
 *   is on the line — 'Don't look back.' lands at bar 72.98, one hundredth of a
 *   bar before the shot starts, so the line and the cut are the same instant
 *   and this scene does not get to choose otherwise.
 *
 * The two shots share one continuous forward path. Nothing about the cut moves
 * the camera in space — only its height, its pitch and its speed change, and
 * all three are driven by one shot-boundary ramp. A hard reposition would give
 * the world a second vantage point and therefore a size, which is precisely
 * what 'nothing at human scale' forbids.
 */

export class VolcanicScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S7') || { t: tl.timeOfBar(70), tEnd: tl.timeOfBar(77) };
    this.T0 = span.t; this.T1 = span.tEnd;

    /* The shot boundary, taken from the LINE and not from the bar. 'Don't look
       back.' is measured at bar 72.98 and the shot list is explicit that the
       line and the cut are the same instant; rounding that to bar 73 would put
       the cut a thirtieth of a second late, which is exactly long enough to
       hear. */
    const back = (tl.d.lyrics || []).find(c => /don.?t look back/i.test(c.text || ''));
    this.tBack = back ? back.t : tl.timeOfBar(73);

    /* Two moves, one continuous path — and the join is the whole design.
     *
     *   70-72, 'Ash'.  The camera ORBITS the hero volcano, left to right,
     *   high and looking up past its summit into the plume. Circling is the
     *   only move that says 'this is one enormous object' without ever
     *   showing its base against something: a track past it gives parallax,
     *   but only an orbit keeps the same thing in frame while everything
     *   behind it changes, which is what makes the eye read the subject as
     *   the fixed point and the world as turning around it.
     *
     *   73-76, 'Don't look back'.  The camera lets go of the orbit and runs.
     *
     * The join is free, which is why it is built this way: at the end of an
     * orbit the camera is already travelling along the circle's TANGENT, so
     * the run is simply that tangent continued. No repositioning, no change
     * of direction, nothing to smooth — the shot breaks away from the volcano
     * exactly as something that had been circling it would.
     *
     * Speeds are arc length, not angle, so the ramp is the same closed form it
     * has always been and the orbit and the run share it: V0 -> V1 across the
     * orbit, V1 -> V2 down the corridor. Distance is its exact integral, so
     * nothing accumulates.
     */
    this.V0 = 118; this.V1 = 196; this.V2 = 340;
    this.orb = {
      cx: HERO.x, cz: HERO.z,
      /* Six hundred units clear of the mountain's own base. */
      R: 1900,
      /* Ending at pi/2 puts the exit tangent on -z exactly, which is the
         corridor the rest of the cones are placed around. */
      th1: Math.PI/2
    };
    this.travel = (t) => {
      const u = Math.max(0, t - this.T0);
      const a = Math.min(u, this.tBack - this.T0);
      const b = Math.max(0, t - this.tBack);
      const D1 = this.tBack - this.T0, D2 = this.T1 - this.tBack;
      const s1 = this.V0*a + 0.5*((this.V1 - this.V0)/D1)*a*a;
      const k = Math.min(1, b/D2);
      const s2 = this.V1*b + (this.V2 - this.V1)*D2*k*k*k/3;
      return { s1, s2 };
    };
    this.speed = (t) => {
      if (t < this.tBack){
        const D1 = this.tBack - this.T0;
        return this.V0 + (this.V1 - this.V0)*Math.min(1, Math.max(0, (t - this.T0)/D1));
      }
      const k = Math.min(1, (t - this.tBack)/(this.T1 - this.tBack));
      return this.V1 + (this.V2 - this.V1)*k*k;
    };
    /* The whole arc the orbit gets, in radians: the distance the speed ramp
       covers in the first shot, divided by the orbit's radius. Derived rather
       than chosen, so changing a speed cannot silently leave the camera
       halfway round. */
    const S1 = this.travel(this.tBack).s1;
    this.orb.th0 = this.orb.th1 - S1/this.orb.R;

        this.scene = new THREE.Scene();
    /* Far plane past the column ring (up to 4100 out) plus the ground's own
       reach — a shorter one clips the smoke off at a distance and gives the
       world an edge, which is a size. */
    this.camera = new THREE.PerspectiveCamera(62, 16/9, 0.5, 9000);
    this.volcanic = new Volcanic();
    this.scene.add(this.volcanic.group);

    /* THE TUNNEL, two bars early, in the air over the plain.
     *
     * 'Tulivuorikohtauksen lopussa voitaisiin tunnelin alku ottaa niin että se
     * tulee keskelle ilmaa tulivuorikohtauksessa josta morfaudutaan
     * tunneliin.'
     *
     * Same contract as the two morphs before it: S8's OWN tunnel
     * (GATEWAY_TUNNEL), on S8's own path evaluated backwards out of its scene
     * (gatewayPath), in S8's own colour (GATEWAY_C0) — so at bar 77 nothing
     * about the object changes and the cut lands underneath something that is
     * already there and already coming.
     *
     * 'Keskelle ilmaa' is what layTunnelAlong() does: the tunnel is laid on
     * the lens axis rather than standing vertically as Tunnel builds it, so it
     * opens straight ahead in the air over the lava plain rather than in the
     * ground under it. That fix is in env/tunnel.js because the jungle needs
     * the identical thing, and one idea gets one spelling.
     *
     * Additive, into a world whose sky is nearly black — nothing of the
     * volcano is taken away to pay for it. */
    this.tunnel = new Tunnel(GATEWAY_TUNNEL);
    this.tunnel.group.visible = false;
    this.scene.add(this.tunnel.group);
    this.path   = gatewayPath(tl);
    this.tMorph = this.T1 - 2*tl.barSec;
    this._cT    = new THREE.Color(...GATEWAY_C0);
    this._cT2   = new THREE.Color();
    this._hslT  = { h: 0, s: 0, l: 0 };
    this._fwd   = new THREE.Vector3();

    this._pos = new THREE.Vector3();
    this._tgt = new THREE.Vector3();
  }

  update(t, post){
    /* The look's own pitch during the run: level, dropping just under the
       horizon as the camera gets down into the embers. */
    const pitchOf = (k) => 0.10 - 0.06*k;
    const u = Math.max(0, t - this.T0);
    const p = Math.min(1, Math.max(0, u/(this.T1 - this.T0)));
    /* 0 through 'Ash', 0..1 across 'Don't look back'. Every difference between
       the two shots hangs off this one number. */
    const lowRaw = Math.min(1, Math.max(0, (t - this.tBack)/(this.T1 - this.tBack)));
    const low = lowRaw*lowRaw*(3 - 2*lowRaw);

    // ---- camera --------------------------------------------------------------
    /* The path: an orbit, then its own tangent. See the note in the
       constructor — the two are one curve and the join costs nothing. */
    const tr = this.travel(t);
    const O = this.orb;
    let px, pz, tanx, tanz;
    if (t < this.tBack){
      const th = O.th0 + tr.s1/O.R;
      px = O.cx + O.R*Math.sin(th);
      pz = O.cz + O.R*Math.cos(th);
      tanx = Math.cos(th); tanz = -Math.sin(th);
    } else {
      const c = Math.cos(O.th1), sn = Math.sin(O.th1);
      px = O.cx + O.R*sn + c*tr.s2;
      pz = O.cz + O.R*c  - sn*tr.s2;
      tanx = c; tanz = -sn;
    }

    /* High and looking up, then low and looking level. 420 units down to 34 is
       a big drop and it is deliberately not linear — smoothstepped through
       `low`, so the descent is already underway when the line lands rather
       than starting on it.

       And it is height ABOVE THE GROUND, not above zero, which it did not need
       to be while the ground was a plain and absolutely has to be now that it
       has six hundred metres of relief in it. At thirty-four units a camera
       flying at a fixed altitude spends the last shot inside a hillside. The
       terrain height comes from env/volcanic.js's own mirror of the field the
       vertex shader displaces by — a lookalike would put the camera
       confidently just under the surface. */
    const ground = terrainHeightAt(px, pz);
    /* 420 down to 95, not down to 34. At thirty-four units the ground is seen
       at such a grazing angle that the whole lower half of frame is one
       compressed, fogged band with nothing in it — the shot ended on an empty
       brown void with a volcano floating in it. Ninety-five still reads as
       low and fast (the embers are at the lens either way) and gives the plain
       enough depth to show what is on it. */
    const above = 420 - 325*low;
    this._pos.set(px, ground + above, pz);
    this.camera.position.copy(this._pos);

    /* What it is looking at, and the swing between the two is the cut.
       Through the orbit the aim is locked to the hero volcano's plume, well
       above its rim — which is what makes the move read as circling something
       rather than as drifting sideways, and it is also the shot list's 'the
       frame is mostly smoke going somewhere the shot never shows'.

       Then it lets go. The blend runs on its own faster ramp than the
       descent, so the camera has turned to face down the corridor within the
       first third of the run: at the instant the line lands it is still
       looking at the mountain, ninety degrees off its own direction of
       travel, and then it looks away and goes. 'Don't look back.' */
    /* Aimed at the MOUNTAIN, near its rim, and not at the sky above it. The
       first pass targeted nine hundred units over the crater on the reasoning
       that the shot list wants 'mostly smoke going somewhere the shot never
       shows' — and got a frame that was almost entirely smoke, with the
       volcano being circled sitting on the bottom edge of it. The plume leaves
       the top of frame on its own from here; it does not need to be aimed at. */
    /* terrainHeightAt() at the hero's centre is the CRATER FLOOR — it already
       contains the whole mountain. Adding most of the cone's height on top of
       it, as the last two passes did, aimed the camera a second mountain above
       the first: twenty-four degrees up, with the volcano being circled sitting
       on the bottom edge of an otherwise empty frame. The rim is the crater
       floor plus the bowl, and a little over that is where this wants to look. */
    const heroTop = terrainHeightAt(HERO.x, HERO.z) + HERO.H*0.18;
    const away = Math.min(1, Math.max(0, (t - this.tBack)/((this.T1 - this.tBack)*0.30)));
    const swing = away*away*(3 - 2*away);

    const yawWob = 0.055*Math.sin(u*0.19);
    const cw = Math.cos(yawWob), sw = Math.sin(yawWob);
    const fx = tanx*cw - tanz*sw, fz = tanx*sw + tanz*cw;
    const aheadX = px + fx*600, aheadZ = pz + fz*600;
    const aheadY = terrainHeightAt(aheadX, aheadZ) + above + Math.sin(pitchOf(low))*600;

    this._tgt.set(HERO.x + (aheadX - HERO.x)*swing,
                  heroTop + (aheadY - heroTop)*swing,
                  HERO.z + (aheadZ - HERO.z)*swing);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._tgt);

    /* Tighter for the orbit than for the run: circling something wants a lens
       that holds it at a size, running past things wants one that lets them
       pass. */
    const fov = 54 + 22*low;
    if (Math.abs(this.camera.fov - fov) > 1e-4){
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }

    // ---- the world -----------------------------------------------------------
    /* The measured drop at bar 70 is the arrival, so heat opens at full and
       stays there — there is no build in this scene, it is already at its
       worst when the cut lands. */
    const heat = 0.85 + 0.15*Math.min(1, u/2.5);
    /* Embers grow as the camera drops into them: the same particles, closer,
       which is the cheapest way to make a field feel entered rather than
       observed. */
    this.volcanic.update(t, { camera: this.camera, heat, emberSize: 1 + 2.6*low });

    // ---- grade ---------------------------------------------------------------
    // ---- the tunnel, arriving ----------------------------------------------
    /* Cubed, so for most of the two bars this is a suggestion in the air and
       only in the last beats does it become an object — a linear ramp reads as
       a dissolve that started on a downbeat. */
    const mo = Math.min(1, Math.max(0, (t - this.tMorph)/(this.T1 - this.tMorph)));
    const morph = mo*mo*mo;
    this.tunnel.group.visible = morph > 0.004;
    if (this.tunnel.group.visible){
      const T = this.path.travel(t);
      this._fwd.subVectors(this._tgt, this._pos).normalize();
      layTunnelAlong(this.tunnel.group, this._pos, this._fwd, T);
      /* The accent by S8's own formula and not a lookalike — a hand-picked
         second colour here would put a hue change on the cut, which is the one
         thing the morph exists to remove. */
      this._cT2.copy(this._cT).getHSL(this._hslT);
      this._cT2.setHSL((this._hslT.h + 0.46) % 1,
                       Math.min(1, this._hslT.s*0.92 + 0.20),
                       Math.min(1, this._hslT.l*0.85 + 0.12));
      this.tunnel.update(t, {
        travel: this.path.travel, speed: this.path.speed(t),
        beat0: this.tl.origin, beat: this.tl.beat,
        colour: this._cT, colour2: this._cT2,
        px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
        floorY: -1e9,
        brightness: morph,
        /* No mist: mist is a volume, and this one is not in the volcano's air
           yet. No core: the exit is S8's and belongs to it. */
        mist: 0.08*morph,
        core: 0.004,
        /* And it arrives jagged, which is the same word S15 spends on a
           corridor coming apart — here on one that has not finished arriving. */
        warp: 0.50*morph
      });
    }

    const c = post.qComp.u, d = post.qDof.u;
    /* The opening is the brightest part of this scene, and that reverses what
       it used to be. The reasoning behind the old low key still holds for the
       RUN — this world's own light is the only light in it, and lifting the
       exposure to see the rock turns a black sky grey — but the first shot is
       not a shot of rock, it is a shot of a mountain with lava on it against
       its own plume, and it was coming back too dark to read as either. The
       run then settles back down into the dark it needs. */
    c.uExposure.value = 1.28 - 0.34*low;
    /* High, because everything bright in frame is genuinely an emitter — the
       cracks, the embers — and bloom is what makes an emitter read as hot
       rather than as a bright surface. */
    /* Trimmed once the ground stopped clipping on its own: bloom on an
       already-blown foreground is what turned the near cracks into a sheet
       rather than into light. */
    c.uBloom.value    = 0.24 + 0.14*low;
    c.uCA.value       = 0.0016 + 0.0026*low;
    c.uVignette.value = 0.72 + 0.10*low;
    c.uGrain.value    = 0.044;
    /* A warm lift and a cooled gain: the blacks in this world are not neutral,
       they have fire under them, and the mid-greys have to stay ashy or the
       whole frame turns orange. */
    c.uLift.value.setRGB(0.018, 0.006, 0.004);
    c.uGain.value.setRGB(1.05, 0.94, 0.90);
    c.uFlash.value    = 0.0;
    /* And the frame bends as it arrives — the same threshold lens S13's blink
       is built on and the jungle's morph now uses, so the film has one idea
       for this and not three. */
    c.uFish.value     = 0.38*morph;
    c.uCA.value       = (c.uCA.value || 0) + 0.0050*morph;
    c.uSplit.value    = 0.0020*morph;

    /* Shallow late: at 250 units a second with embers a few metres off the
       lens, a deep focus reads as a diagram. */
    d.uStart.value = 260 - 200*low;
    d.uEnd.value   = 3200 - 2200*low;
    d.uMaxRadius.value = 1.4 + 2.2*low;
  }

  debugLayers(){ return this.volcanic.debugLayers(); }

  dispose(){ this.volcanic.dispose(); }
}
